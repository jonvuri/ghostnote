/**
 * `LiveAdapter` — the contract over a running Bitwig.
 *
 * Everything interesting is elsewhere on purpose: the wire vocabulary is in
 * `wiremap.ts`, the trap mitigations and beats/step maths are in `encoder.ts`,
 * and the staging plan is in the contract. What is left here is the part that
 * genuinely needs a live DAW — resolving durable ids to live indices, polling
 * readback instead of blind-sleeping, and refusing to work half-blind.
 *
 * ⚠ Behaviour here is NOT covered by the offline suite. Its verification is
 * `npm run probe:conformance`, which runs the same conformance cases the fake
 * passes against real Bitwig. Until that runs, treat this file as unproven.
 */
import {
  AddressUnresolvedError, BankWindowOverflowError, CONTRACT_TAG, CONTRACT_VERSION,
  ContractVersionError, StaleAddressError, WireDriftError,
  addressKey, addressScene, addressTrack, assertOpsWritable, hasUnverifiedProps, planStages,
  type Address, type AdapterInfo, type BatchReceipt, type BatchRequest, type BitwigAdapter,
  type Fidelity, type NoteRecord, type ResolveResult, type ResolvedAddress, type RevisionMark,
  type SettleBudget, type Snapshot, type StageReceipt, type StateEntry, type TrackAddress,
} from '../../contract/index.js';
import { SETTLE_MS } from '../../contract/index.js';
import { STEP_SIZES, decodeVerboseNote, encodeStage, type EncodeContext } from './encoder.js';
import { BridgeTransport, type Transport } from './transport.js';
import { WIRE } from './wiremap.js';

interface WireTrack {
  index: number;
  name: string;
  position: number;
  type: string;
  channelId: string;
}

interface TrackListResult {
  tracks: WireTrack[];
  count: number;
  itemCount?: number;
  bankSize?: number;
}

export interface LiveOptions {
  readonly transport?: Transport;
  /** Which pool cursor to drive. The pool is pre-allocated at init (E1). */
  readonly cursor?: string;
  /** Expected wire methodsHash from extension/methods.golden.json, if checking. */
  readonly expectMethodsHash?: string;
}

export class LiveAdapter implements BitwigAdapter {
  private readonly transport: Transport;
  private readonly cursor: string;
  private readonly expectMethodsHash: string | undefined;

  /** channelId -> bank index. Invalidated by every structural op, never trusted across one. */
  private index = new Map<string, number>();

  /**
   * ⚠ KNOWN LIMIT — this counter only sees OUR OWN scene ops (`apply` bumps it
   * below). A scene the USER creates or deletes in Bitwig does not move it, so a
   * scene-relative address minted before that edit still resolves as `found` and
   * `read` does not refuse it — while E3's compaction has already shifted every
   * row beneath it. That is exactly the silent mis-write the epoch exists to
   * prevent, and against a concurrent human it does not prevent it.
   *
   * Not fixable from here: detecting a foreign scene edit needs a Bitwig
   * OBSERVER, and D4 puts observers in the daemon precisely so the change log can
   * tell agent edits from the user's. So this is a Phase-1 dependency, not an
   * oversight — but until then, treat `sceneEpoch` as "no scene op happened THAT
   * WE KNOW OF", which is weaker than what `address.ts` promises.
   */
  private sceneEpoch = 1;
  /** The rig's cursor-clip width, learned at hello(); bounds the scan window. */
  private gridSteps: number | undefined;

  constructor(options: LiveOptions = {}) {
    this.transport = options.transport ?? new BridgeTransport();
    this.cursor = options.cursor ?? '0';
    this.expectMethodsHash = options.expectMethodsHash;
  }

  async hello(): Promise<AdapterInfo> {
    const hello = (await this.transport.send({ method: WIRE.hello })) as {
      contractVersion: number;
      extensionVersion: string;
      hostApiVersion: number;
      methodsHash: string;
    };

    // Exact equality, and refuse rather than proceed — a version-mismatched
    // adapter that limps along is how incompatible data gets written silently.
    if (hello.contractVersion !== CONTRACT_VERSION) {
      throw new ContractVersionError(CONTRACT_VERSION, hello.contractVersion);
    }
    if (this.expectMethodsHash !== undefined && hello.methodsHash !== this.expectMethodsHash) {
      throw new WireDriftError(this.expectMethodsHash, hello.methodsHash);
    }

    const host = (await this.transport.send({ method: WIRE.hostInfo })) as {
      hostApiVersion: number;
      hostProduct: string;
      hostVersion: string;
    };
    const list = await this.refreshIndex();

    const rig = (await this.transport.send({ method: WIRE.rigInfo })) as { gridSteps?: number };
    this.gridSteps = rig.gridSteps;

    return {
      contract: CONTRACT_TAG,
      contractVersion: CONTRACT_VERSION,
      kind: 'live',
      host: {
        apiVersion: host.hostApiVersion,
        product: host.hostProduct,
        version: host.hostVersion,
        extensionVersion: hello.extensionVersion,
      },
      methodsHash: hello.methodsHash,
      limits: {
        trackBankSize: list.bankSize ?? list.count,
        sceneBankSize: 0,
        ...(list.itemCount === undefined ? {} : { trackCount: list.itemCount }),
      },
      capabilities: {
        hasRealBitwig: true,
        hasDeterministicClock: false,
        // Deliberately false: manufacturing an overflowing project inside
        // someone's real session is not something a test run may do. The live
        // evidence for the behaviour is banked in probe e05b.
        canOverflowBank: false,
        canInjectInterference: false,
        hasDeviceModel: true,
      },
    };
  }

  /**
   * Re-scan the bank and rebuild the channelId -> index map.
   *
   * ⚠ Standing rule 2: re-point after ANY structural op. A held index is only
   * valid until the next create/delete, because `createInstrumentTrack` does not
   * honour positions and deletes re-index everything after them (E2c, E3).
   */
  private async refreshIndex(): Promise<TrackListResult> {
    const list = (await this.transport.send({ method: WIRE.trackList })) as TrackListResult;
    this.index = new Map(list.tracks.map((t) => [t.channelId, t.index]));

    // ⚠ E5, standing rule 5: never operate on a partially-visible project.
    //
    // ● PROVEN in Phase 0: `TrackBank.itemCount()` reports the PROJECT's track
    // count, not the window size — measured live at itemCount=17 against
    // bankSize=16, with only 16 rows visible. That is what makes rule 5
    // implementable at all; before this, "16 tracks exist" and "16 of 54 are
    // visible" were indistinguishable.
    if (list.itemCount !== undefined && list.bankSize !== undefined && list.itemCount > list.bankSize) {
      throw new BankWindowOverflowError(list.count, list.itemCount, list.bankSize);
    }
    return list;
  }

  private trackIndex(track: TrackAddress): number {
    const index = this.index.get(track.channelId);
    if (index === undefined) {
      throw new AddressUnresolvedError(track, `no visible track with channelId ${track.channelId}`);
    }
    return index;
  }

  private get ctx(): EncodeContext {
    return { cursor: this.cursor, trackIndex: (t) => this.trackIndex(t) };
  }

  /**
   * The finest step size whose `gridSteps`-wide window still covers `lengthBeats`.
   * Learned from the rig rather than assumed, because it is configurable
   * (`~/.ghostnote/rig.json`) and the fine cursor uses a different width.
   */
  private scanStepSize(lengthBeats: number): number {
    const steps = this.gridSteps ?? 64;
    const candidate = [...STEP_SIZES].reverse().find((size) => steps * size >= lengthBeats);
    return candidate ?? STEP_SIZES[0]!;
  }

  async revision(): Promise<RevisionMark> {
    const r = (await this.transport.send({ method: WIRE.revisionGet })) as { revision: number };
    return { revision: r.revision, sceneEpoch: this.sceneEpoch };
  }

  async resolve(refs: readonly Address[]): Promise<ResolveResult> {
    await this.refreshIndex();
    const resolved: ResolvedAddress[] = refs.map((address) => {
      const sceneRef = addressScene(address);
      if (sceneRef !== undefined && sceneRef.epoch !== this.sceneEpoch) {
        return { address, found: false, reason: 'stale-epoch' as const };
      }
      const trackRef = addressTrack(address);
      if (trackRef === undefined) return { address, found: true };
      const index = this.index.get(trackRef.channelId);
      return index === undefined
        // We cannot distinguish "deleted" from "outside the window" from a single
        // bank scan; `absent` is the honest answer, and the overflow guard above
        // is what makes the blind-spot case impossible to reach silently.
        ? { address, found: false, reason: 'absent' as const }
        : { address, found: true, index };
    });
    return { at: await this.revision(), resolved };
  }

  async read(sel: readonly Address[]): Promise<Snapshot> {
    const entries: Record<string, StateEntry> = {};
    const missing: Address[] = [];
    const unreachable: Address[] = [];
    const list = await this.refreshIndex();

    for (const address of sel) {
      const sceneRef = addressScene(address);
      if (sceneRef !== undefined && sceneRef.epoch !== this.sceneEpoch) {
        throw new StaleAddressError(address, sceneRef.epoch, this.sceneEpoch);
      }
      const trackRef = addressTrack(address);
      const row = trackRef ? list.tracks.find((t) => t.channelId === trackRef.channelId) : undefined;
      if (trackRef !== undefined && row === undefined) {
        missing.push(address);
        continue;
      }
      const entry = await this.readOne(address, row);
      if (entry === undefined) missing.push(address);
      else entries[addressKey(address)] = entry;
    }

    return { contract: CONTRACT_TAG, at: await this.revision(), entries, missing, unreachable };
  }

  private async readOne(address: Address, row: WireTrack | undefined): Promise<StateEntry | undefined> {
    switch (address.kind) {
      case 'track':
        return row === undefined ? undefined : {
          address,
          fidelity: 'exact',
          value: { of: 'track', track: { channelId: row.channelId, name: row.name, position: row.position, type: row.type } },
        };

      case 'slot':
      case 'clip': {
        if (row === undefined) return undefined;
        const sceneIndex = address.kind === 'clip' ? address.slot.scene.index : address.scene.index;
        const status = (await this.transport.send({
          method: WIRE.slotStatus,
          params: { trackIndex: row.index, slotIndex: sceneIndex },
        })) as { hasContent: boolean };
        return { address, fidelity: 'none', value: { of: 'clip', exists: status.hasContent } };
      }

      case 'notes': {
        if (row === undefined) return undefined;
        const sceneIndex = address.clip.slot.scene.index;
        // ⚠ E2: the cursor must not be pointed at an empty slot, so the clip's
        // existence is checked before pointing at it.
        const status = (await this.transport.send({
          method: WIRE.slotStatus,
          params: { trackIndex: row.index, slotIndex: sceneIndex },
        })) as { hasContent: boolean };
        if (!status.hasContent) return undefined;

        await this.transport.send({ method: WIRE.cursorPointTrack, params: { cursor: this.cursor, trackIndex: row.index } });
        await this.transport.send({
          method: WIRE.slotSelect,
          params: { trackIndex: row.index, slotIndex: sceneIndex, mechanism: 'track' },
        });
        await this.settle('cursorPoint');

        // ⚠ Two constraints pull against each other here.
        //
        // E2 says scan at the FINEST grid: off-grid notes are reported snapped
        // DOWN on a coarse grid, so a coarse scan misreports positions rather
        // than losing notes — which is worse, because it still looks like data.
        //
        // But the cursor clip is a FIXED number of steps (`gridSteps`, 64 by
        // default), so the scanned window is only `gridSteps * stepSize` beats
        // wide. Scanning a 4-beat clip at 1/64 would cover just the first beat
        // and silently return nothing for the rest — a blind spot dressed up as
        // an empty clip.
        //
        // So: the finest grid whose window still spans the whole clip.
        const loop = (await this.transport.send({
          method: WIRE.cursorStatus,
          params: { cursor: this.cursor },
        })) as { loopLength?: number };
        const lengthBeats = typeof loop.loopLength === 'number' && loop.loopLength > 0 ? loop.loopLength : 4;
        const stepSize = this.scanStepSize(lengthBeats);
        // ⚠ E2/E15-D: setStepSize works at runtime but needs a settle — not
        // instant. Under-waiting does not fail loudly: the scan runs on the OLD
        // grid and every x is then decoded against the NEW one, so a note at beat
        // 1 reads back at beat 0.125. Wrong data, no error. E15-D measured the
        // floor at ~120ms and named the budget, so this now says what it means
        // instead of borrowing `trackStruct`'s number; the read path was already
        // waiting long enough, which is why only the WRITE path was broken.
        await this.transport.send({ method: WIRE.cursorSetStepSize, params: { cursor: this.cursor, stepSize } });
        await this.settle('gridChange');

        // The VERBOSE scan, not the lean one: `cursor.getNotes` returns only
        // [x, y, velocity, duration], so reading it would silently drop every
        // expression property — a snapshot that looks complete, restores wrong,
        // and reports `fidelity: 'exact'` while doing it.
        const res = (await this.transport.send({
          method: WIRE.cursorGetNotesVerbose,
          params: { cursor: this.cursor, channel: address.channel },
        })) as { notes: Record<string, number | boolean | string>[] };

        const all: NoteRecord[] = res.notes
          .map((step) => decodeVerboseNote(step, stepSize))
          .filter((n) => (address.range === undefined
            ? true
            : n.startBeats >= address.range.startBeats && n.startBeats < address.range.endBeats));
        const fidelity: Fidelity = all.some(hasUnverifiedProps) ? 'lossy' : 'exact';
        return { address, fidelity, value: { of: 'notes', notes: all } };
      }

      case 'device':
      case 'param':
      case 'scene':
        // Device and param READS need the device-cursor apparatus, which is
        // Phase-4 work. Writing them already works; reading them back does not,
        // so v0 reports them missing rather than inventing a value.
        return undefined;
    }
  }

  async apply(batch: BatchRequest): Promise<BatchReceipt> {
    // ⚠ E15-E: refuse a write the API would accept and discard, BEFORE anything
    // is applied. Shared with the fake so both adapters refuse identically.
    assertOpsWritable(batch.ops);
    await this.refreshIndex();

    const stages = planStages(batch.ops);
    const receipts: StageReceipt[] = [];
    const minted: Record<number, Address> = {};
    let guard = batch.ifRevision;

    for (const [i, stage] of stages.entries()) {
      // ⚠ E15-D: waited BEFORE the request goes out, not after it comes back.
      // `cursor.setNoteProps` reads a NoteStep before mutating it, and that read
      // is unusable until the grid change from the preceding stage has landed.
      // Waiting afterwards would be waiting for damage that already happened.
      if (stage.settleBefore !== undefined) await this.settle(stage.settleBefore);

      // Track creates need the bank diffed afterwards to learn what was minted.
      const before = stage.ops.some((o) => o.op === 'track.create')
        ? new Set((await this.refreshIndex()).tracks.map((t) => t.channelId))
        : undefined;

      const result = (await this.transport.send(encodeStage(stage.ops, this.ctx, guard))) as {
        applied: boolean;
        rejected?: boolean;
        reason?: string;
        expected?: number;
        actual?: number;
        revision: number;
        results?: { method: string; ok: boolean; error?: string }[];
      };

      // ⚠ E8-D: rejected means the WHOLE batch applied nothing. Stop here.
      if (result.rejected) {
        return {
          contract: CONTRACT_TAG,
          accepted: false,
          rejected: { reason: 'stale-revision', expected: result.expected ?? -1, actual: result.actual ?? -1 },
          stages: receipts,
          minted,
          at: await this.revision(),
        };
      }

      receipts.push({
        index: i,
        ...(stage.settle === undefined ? {} : { settled: stage.settle }),
        applied: result.applied,
        ops: (result.results ?? stage.ops.map((o) => ({ method: o.op, ok: true, error: undefined })))
          .map((r) => ({
            op: r.method,
            ok: r.ok,
            ...(r.error === undefined ? {} : { error: r.error }),
          })),
        revision: result.revision,
      });

      // Each stage guards on what the previous one returned, so an interfering
      // write between stages is caught for free.
      guard = result.revision;

      if (stage.settle !== undefined) await this.settle(stage.settle);

      for (const op of stage.ops) {
        if (op.op === 'scene.create' || op.op === 'scene.delete') this.sceneEpoch++;
      }

      if (before !== undefined) {
        const after = (await this.refreshIndex()).tracks;
        const created = after.find((t) => !before.has(t.channelId));
        const at = stage.opIndices[stage.ops.findIndex((o) => o.op === 'track.create')];
        if (created !== undefined && at !== undefined) {
          minted[at] = { kind: 'track', channelId: created.channelId };
        }
      }
    }

    return { contract: CONTRACT_TAG, accepted: true, stages: receipts, minted, at: await this.revision() };
  }

  /**
   * Wait out a named budget.
   *
   * ⚠ This is a paced WAIT, not a poll, and the doc comment here used to claim
   * otherwise. Stating it plainly, because the difference matters: E1's
   * poll-until-`trackPosition`-confirms rule applies to POINTING, which has an
   * observable target to poll for. Most budgets do not — E15-D's `gridChange`
   * is "the cursor has re-fetched its step data", which has no readback at all;
   * the only way to observe it is to attempt the write and see whether it was
   * silently discarded, which is the thing being prevented. So the budget is a
   * measured duration here, and every one of them cites its measurement.
   *
   * Where a readback DOES exist, it is used instead of this: `refreshIndex`
   * re-reads the bank rather than waiting for a track create, and `apply` diffs
   * by channelId rather than assuming a create landed.
   */
  async settle(budget: SettleBudget): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS[budget]));
  }

  async close(): Promise<void> {
    await this.transport.close();
  }
}
