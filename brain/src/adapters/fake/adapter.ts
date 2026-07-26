/**
 * `FakeAdapter` — a whole Bitwig, in-process, wrong in all the right places.
 *
 * PHASE-0 §Scope: "an in-process implementation of the contract with enough
 * fidelity to be worth testing against — which specifically means modelling the
 * traps, not the happy path". It never speaks the wire; that is the structural
 * proof the JSON-RPC frame is an implementation detail.
 *
 * What it deliberately does NOT model: the encoder-only traps (E4, E4b, E4h, E6),
 * which are unreachable through the op union and are proven in
 * `live/encoder.test.ts` instead. See `traps.ts`.
 */
import {
  AddressUnresolvedError, BankWindowOverflowError, CONTRACT_TAG, CONTRACT_VERSION,
  StaleAddressError, UnsupportedOpError, addressKey, addressScene, addressTrack, assertNever,
  assertOpsWritable, budgetTicks, hasUnverifiedProps, orderedNoteProps, stepSizeFor,
  type Address, type AdapterInfo, type BatchReceipt, type BatchRequest, type BitwigAdapter,
  type Fidelity, type NoteRecord, type Op, type OpReceipt, type ResolveResult, type ResolvedAddress,
  type RevisionMark, type SettleBudget, type Snapshot, type StageReceipt, type StateEntry,
} from '../../contract/index.js';
import { planStages } from '../../contract/index.js';
import { VirtualClock } from './clock.js';
import { ProjectModel, noteKey, type FakeTrack } from './model.js';
import {
  applyNotePropsInOrder, bankBlindSpot, gridChangePoisonsRead, noteOnReadback, pointAtSlot,
  propsReadsTurnStartClip, stepDataIsStale, writeNoteProps,
} from './traps.js';

/** How the fake names the clip a cursor points at. Identity, never index (E2f). */
const clipKey = (channelId: string, sceneIndex: number): string => `${channelId}:${sceneIndex}`;

export interface FakeOptions {
  /** Tracks to start with, by name. All Instrument type. */
  readonly tracks?: readonly string[];
  readonly scenes?: number;
  readonly trackBankSize?: number;
}

export class FakeAdapter implements BitwigAdapter {
  readonly model = new ProjectModel();
  readonly clock = new VirtualClock();
  private closed = false;
  /** Where the cursor was when the current stage (== one turn) began (E15-F). */
  private turnStartClip: string | undefined = undefined;

  constructor(options: FakeOptions = {}) {
    if (options.scenes !== undefined) this.model.sceneCount = options.scenes;
    if (options.trackBankSize !== undefined) this.model.trackBankSize = options.trackBankSize;
    for (const name of options.tracks ?? []) this.model.createTrack(name);
    // Every real project has these, and E2c's finding is that they sit at the
    // TAIL of the flat bank — code that assumes bank size == regular track count
    // is wrong, and the fake should make that mistake visible.
    this.model.tracks.push({
      channelId: this.model.mintChannelId(), name: 'FX 1', type: 'Effect',
      slots: this.model.makeSlots(), devices: [],
    });
    this.model.tracks.push({
      channelId: this.model.mintChannelId(), name: 'Master', type: 'Master',
      slots: this.model.makeSlots(), devices: [],
    });
  }

  async hello(): Promise<AdapterInfo> {
    return {
      contract: CONTRACT_TAG,
      contractVersion: CONTRACT_VERSION,
      kind: 'fake',
      limits: {
        trackBankSize: this.model.trackBankSize,
        sceneBankSize: this.model.sceneBankSize,
        trackCount: this.model.trackCount,
      },
      capabilities: {
        hasRealBitwig: false,
        hasDeterministicClock: true,
        canOverflowBank: true,
        canInjectInterference: true,
        hasDeviceModel: true,
      },
    };
  }

  private mark(): RevisionMark {
    return { revision: this.model.revision, sceneEpoch: this.model.sceneEpoch };
  }

  async revision(): Promise<RevisionMark> {
    return this.mark();
  }

  /**
   * Durable key -> live index, with the two refusals that make E3 and E5 safe.
   * A stale epoch and a blind spot are reported DIFFERENTLY from genuine absence,
   * because conflating them is how a revert silently under-delivers.
   */
  async resolve(refs: readonly Address[]): Promise<ResolveResult> {
    const resolved: ResolvedAddress[] = refs.map((address) => {
      const sceneRef = addressScene(address);
      if (sceneRef !== undefined && sceneRef.epoch !== this.model.sceneEpoch) {
        return { address, found: false, reason: 'stale-epoch' as const };
      }
      const trackRef = addressTrack(address);
      if (trackRef === undefined) {
        const ok = sceneRef === undefined || sceneRef.index < this.model.sceneCount;
        return ok ? { address, found: true } : { address, found: false, reason: 'absent' as const };
      }
      const hit = this.model.findByChannelId(trackRef.channelId);
      if (hit !== undefined) return { address, found: true, index: hit.index };
      return {
        address,
        found: false,
        // Existing but out of view is NOT the same as deleted (E5 vs E2f).
        reason: this.model.existsAnywhere(trackRef.channelId)
          ? ('outside-bank-window' as const)
          : ('absent' as const),
      };
    });
    return { at: this.mark(), resolved };
  }

  /** Reads COMMITTED state only — never flushes pending, never advances the clock. */
  async read(sel: readonly Address[]): Promise<Snapshot> {
    const entries: Record<string, StateEntry> = {};
    const missing: Address[] = [];
    const unreachable: Address[] = [];

    for (const address of sel) {
      const sceneRef = addressScene(address);
      if (sceneRef !== undefined && sceneRef.epoch !== this.model.sceneEpoch) {
        throw new StaleAddressError(address, sceneRef.epoch, this.model.sceneEpoch);
      }
      const trackRef = addressTrack(address);
      const hit = trackRef ? this.model.findByChannelId(trackRef.channelId) : undefined;
      if (trackRef !== undefined && hit === undefined) {
        // ⚠ Out of the bank window is UNREACHABLE, not missing (E5).
        if (this.model.existsAnywhere(trackRef.channelId)) unreachable.push(address);
        else missing.push(address);
        continue;
      }
      const entry = this.readOne(address, hit?.track, hit?.index ?? -1);
      if (entry === undefined) missing.push(address);
      else entries[addressKey(address)] = entry;
    }

    return { contract: CONTRACT_TAG, at: this.mark(), entries, missing, unreachable };
  }

  private readOne(address: Address, track: FakeTrack | undefined, index: number): StateEntry | undefined {
    switch (address.kind) {
      case 'track':
        return track === undefined ? undefined : {
          address,
          fidelity: 'exact',
          value: { of: 'track', track: { channelId: track.channelId, name: track.name, position: index, type: track.type } },
        };
      case 'clip':
      case 'slot': {
        const sceneIndex = address.kind === 'clip' ? address.slot.scene.index : address.scene.index;
        const slotState = track?.slots[sceneIndex];
        if (slotState === undefined) return undefined;
        return {
          address,
          fidelity: 'none', // a clip's existence has no readback that could recreate it
          value: { of: 'clip', exists: slotState.hasContent, lengthBeats: slotState.lengthBeats },
        };
      }
      case 'notes': {
        const slotState = track?.slots[address.clip.slot.scene.index];
        if (slotState === undefined) return undefined;
        const all = [...slotState.notes.values()]
          .filter((n) => (address.range === undefined
            ? true
            : n.startBeats >= address.range.startBeats && n.startBeats < address.range.endBeats))
          .map(noteOnReadback)
          .sort((a, b) => a.startBeats - b.startBeats || a.pitch - b.pitch);
        // ⚠ Any unverified property (today: gain, E2) degrades the whole entry, so
        // a revert declares up front that it cannot promise a full restore (D5).
        const fidelity: Fidelity = all.some(hasUnverifiedProps) ? 'lossy' : 'exact';
        return { address, fidelity, value: { of: 'notes', notes: all } };
      }
      case 'device': {
        const dev = track?.devices[address.chainIndex];
        if (dev === undefined) return undefined;
        return {
          address,
          fidelity: 'none',
          value: {
            of: 'device',
            device: {
              chainIndex: address.chainIndex,
              name: dev.name,
              params: dev.params.map((p, i) => ({ index: i, name: p.name, value: p.value })),
            },
          },
        };
      }
      case 'param': {
        const dev = track?.devices[address.device.chainIndex];
        const p = dev?.params[address.index];
        if (dev === undefined || p === undefined) return undefined;
        // ⚠ E4: parameters are not readable until ~194ms AFTER the insert lands.
        if (!dev.paramsLive) return undefined;
        return { address, fidelity: 'exact', value: { of: 'param', param: { index: address.index, name: p.name, value: p.value } } };
      }
      case 'scene':
        return undefined;
      default:
        return assertNever(address, 'readOne');
    }
  }

  /**
   * The only write path. Stages are planned by the CONTRACT (`planStages`), so
   * the fake and the live adapter pace identically and the conformance suite can
   * assert on staging without knowing which adapter it holds.
   */
  async apply(batch: BatchRequest): Promise<BatchReceipt> {
    // ⚠ E15-E: the same refusal the live adapter makes, from the same shared
    // contract function — so the conformance suite can assert it on both.
    assertOpsWritable(batch.ops);

    // ⚠ Standing rule 5: never operate on a partially-visible project.
    const blind = bankBlindSpot(this.model);
    if (blind !== undefined) {
      throw new BankWindowOverflowError(blind.visible, blind.total, this.model.trackBankSize);
    }

    // ⚠ E8-D: a stale guard rejects the batch WHOLE, applying zero ops.
    if (batch.ifRevision !== undefined && batch.ifRevision !== this.model.revision) {
      return {
        contract: CONTRACT_TAG,
        accepted: false,
        rejected: { reason: 'stale-revision', expected: batch.ifRevision, actual: this.model.revision },
        stages: [],
        minted: {},
        at: this.mark(),
      };
    }

    const stages = planStages(batch.ops);
    const minted: Record<number, Address> = {};
    const receipts: StageReceipt[] = [];

    for (const [i, stage] of stages.entries()) {
      // ⚠ E15-D: waited BEFORE the stage, so the step data a `getStep` op is
      // about to read has been re-fetched. Without it the write below lands
      // inside `stepDataIsStale`'s window and is discarded, exactly as live.
      if (stage.settleBefore !== undefined) this.clock.settle(stage.settleBefore);

      // ⚠ E15-F: one stage is one control-surface turn, and `setNoteProps`
      // resolves its note against the clip the cursor held when the turn began.
      this.turnStartClip = this.model.cursorClip;

      // Turn boundary: last batch's writes become visible, then this one stages.
      this.clock.commit();
      this.clock.advance();
      this.model.revision++;

      const ops: OpReceipt[] = stage.ops.map((op, j) => {
        try {
          this.runOp(op, stage.opIndices[j]!, minted);
          return { op: op.op, ok: true };
        } catch (e) {
          return { op: op.op, ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      });

      receipts.push({
        index: i,
        ...(stage.settle === undefined ? {} : { settled: stage.settle }),
        applied: true,
        ops,
        revision: this.model.revision,
      });

      if (stage.settle !== undefined) this.clock.settle(stage.settle);
    }

    return { contract: CONTRACT_TAG, accepted: true, stages: receipts, minted, at: this.mark() };
  }

  private requireTrack(ref: { channelId: string }, op: string): FakeTrack {
    const hit = this.model.findByChannelId(ref.channelId);
    if (hit === undefined) {
      throw new AddressUnresolvedError(
        { kind: 'track', channelId: ref.channelId },
        this.model.existsAnywhere(ref.channelId)
          ? `${op}: track is outside the bank window`
          : `${op}: no track with channelId ${ref.channelId}`,
      );
    }
    return hit.track;
  }

  private runOp(op: Op, opIndex: number, minted: Record<number, Address>): void {
    switch (op.op) {
      case 'note.write': {
        const track = this.requireTrack(op.clip.slot.track, op.op);
        const channel = op.channel ?? 0;
        const sceneIndex = op.clip.slot.scene.index;
        const notesToWrite = op.notes;
        const grid = stepSizeFor(notesToWrite);
        // Pointing is cursor state, so it moves NOW rather than at commit — a
        // re-point steers the calls that follow it in the same turn (E15-D).
        this.model.cursorClip = clipKey(op.clip.slot.track.channelId, sceneIndex);
        this.clock.stage(() => {
          // ⚠ E2: pointing at an empty slot silently lands on the WRONG clip.
          const point = pointAtSlot(track, sceneIndex);
          const written = notesToWrite.map(writeNoteProps);
          // ⚠ E8-E: same-pitch adjacency truncates; readback != request.
          const merged = [...point.slot.notes.values(), ...written];
          for (const n of ProjectModel.applyAdjacencyTruncation(merged)) {
            point.slot.notes.set(noteKey(channel, n.pitch, n.startBeats), n);
          }
          // ⚠ E15-D: a note write always sets the step grid on the way in, and
          // that leaves `getStep` unusable until the grid has been re-fetched.
          point.slot.stepDataStaleUntilTick = this.clock.tick + budgetTicks('gridChange');
          // ...and it leaves the CURSOR on that grid, for whatever touches it
          // next. That residue is what the props op below has to match.
          if (grid !== undefined) this.model.cursorStepSize = grid;
        });
        return;
      }

      case 'note.props': {
        const track = this.requireTrack(op.clip.slot.track, op.op);
        const channel = op.channel ?? 0;
        const sceneIndex = op.clip.slot.scene.index;
        const updates = op.notes;
        const grid = stepSizeFor(updates);
        // ⚠ E15-F: the lookup resolves against the clip the cursor held when
        // this TURN began, so a props op that re-points loses everything. Read
        // before the re-point below, because the re-point is what causes it.
        const wrongTurnStartClip = propsReadsTurnStartClip(
          this.turnStartClip, clipKey(op.clip.slot.track.channelId, sceneIndex));
        this.model.cursorClip = clipKey(op.clip.slot.track.channelId, sceneIndex);
        this.clock.stage(() => {
          const point = pointAtSlot(track, sceneIndex);
          // ⚠ E15-D, both halves. The op emits `setStepSize` then `getStep` in
          // one turn, so it loses everything either if a PREVIOUS request moved
          // the grid too recently, or if this op moves it itself. No error, no
          // failed op, and `cursor.status` looks healthy in both cases.
          const poisoned = gridChangePoisonsRead(this.model.cursorStepSize, grid);
          if (grid !== undefined) this.model.cursorStepSize = grid;
          if (wrongTurnStartClip || poisoned || stepDataIsStale(point.slot, this.clock.tick)) return;
          for (const update of updates) {
            const key = noteKey(channel, update.pitch, update.startBeats);
            const existing = point.slot.notes.get(key);
            // Properties only ever land on notes that already exist; there is no
            // create-by-side-effect here.
            if (existing !== undefined) {
              point.slot.notes.set(key, applyNotePropsInOrder(existing, orderedNoteProps(update)));
            }
          }
        });
        return;
      }

      case 'note.clear': {
        const track = this.requireTrack(op.clip.slot.track, op.op);
        const sceneIndex = op.clip.slot.scene.index;
        this.model.cursorClip = clipKey(op.clip.slot.track.channelId, sceneIndex);
        this.clock.stage(() => {
          const point = pointAtSlot(track, sceneIndex);
          point.slot.notes.clear();
        });
        return;
      }

      case 'clip.create': {
        const track = this.requireTrack(op.slot.track, op.op);
        const sceneIndex = op.slot.scene.index;
        const length = op.lengthBeats;
        this.clock.stage(() => {
          const slotState = track.slots[sceneIndex];
          if (slotState !== undefined) {
            slotState.hasContent = true;
            slotState.lengthBeats = length;
          }
        });
        return;
      }

      case 'clip.delete': {
        const track = this.requireTrack(op.slot.track, op.op);
        const sceneIndex = op.slot.scene.index;
        this.clock.stage(() => {
          const slotState = track.slots[sceneIndex];
          if (slotState !== undefined) {
            slotState.hasContent = false;
            slotState.lengthBeats = 0;
            slotState.notes.clear();
          }
        });
        return;
      }

      case 'track.create': {
        // ⚠ E2c: the requested position is not honoured, so identity comes from
        // reading back what was actually created — never from an assumption.
        const created = this.model.createTrack(op.name);
        minted[opIndex] = { kind: 'track', channelId: created.channelId };
        return;
      }

      case 'track.rename': {
        const track = this.requireTrack(op.track, op.op);
        const name = op.name;
        this.clock.stage(() => { track.name = name; });
        return;
      }

      case 'track.delete':
        this.requireTrack(op.track, op.op);
        this.model.deleteTrack(op.track.channelId);
        return;

      case 'scene.create':
        this.model.createScenes(op.count);
        return;

      case 'scene.delete':
        // ⚠ E3: compacts rows below it and bumps the epoch, invalidating every
        // scene-relative address that was minted before now.
        this.model.deleteScene(op.scene.index);
        return;

      case 'device.insert': {
        const track = this.requireTrack(op.track, op.op);
        const name = op.source.from === 'file' ? op.source.path.split('/').pop()! : op.source.uuid;
        const device = { name, paramsLive: false, params: [{ name: 'Param 1', value: 0.5 }] };
        track.devices.push(device);
        // ⚠ E4: the device exists immediately but its parameters are not readable
        // for another ~194ms. A timer, not a tick counter, is what expresses that.
        this.clock.after('paramsLive', `paramsLive:${name}`, () => { device.paramsLive = true; });
        return;
      }

      case 'device.delete': {
        const track = this.requireTrack(op.device.track, op.op);
        this.model.deleteDevice(track, op.device.chainIndex);
        return;
      }

      case 'param.set': {
        const track = this.requireTrack(op.param.device.track, op.op);
        const device = track.devices[op.param.device.chainIndex];
        if (device === undefined) throw new UnsupportedOpError(`param.set on missing device`, 'fake');
        const index = op.param.index;
        const value = op.value;
        this.clock.stage(() => {
          const p = device.params[index];
          if (p !== undefined) p.value = value;
        });
        return;
      }

      case 'notify':
        // E8-C: interleaved notifies fire spaced across a paced batch without
        // stalling it. Nothing to model beyond "it is free".
        return;

      default:
        assertNever(op, 'FakeAdapter.runOp');
    }
  }

  async settle(budget: SettleBudget): Promise<void> {
    this.clock.settle(budget);
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  get isClosed(): boolean {
    return this.closed;
  }
}
