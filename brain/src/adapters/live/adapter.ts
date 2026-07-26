/**
 * `LiveAdapter` — the contract over a running Bitwig.
 *
 * Everything interesting is elsewhere on purpose: the wire vocabulary is in
 * `wiremap.ts`, the trap mitigations and beats/step maths are in `encoder.ts`,
 * the cursor allocator is in `pool.ts`, and the staging plan is in the contract.
 * What is left here is the part that genuinely needs a live DAW — resolving
 * durable ids to live indices, polling readback instead of blind-sleeping, and
 * refusing to work half-blind.
 *
 * Phase 1 session 1 gave it the RESOLVER DISCIPLINE D6 asks for, replacing the
 * Phase-0 stubs one by one:
 *
 *   - a real cursor pool instead of the hardcoded `'0'`, allocated across a
 *     batch's clips — which is a correctness mechanism, not a throughput one
 *     (E15-F; see `pool.ts`);
 *   - RE-POINT AFTER ANY STRUCTURAL OP, not merely after a `track.create`;
 *   - the TRAILING SELECTION RESTORE D6 says Phase 1 owes (E14-F);
 *   - `read` and `resolve` now REPORT a bank-window blind spot where they used
 *     to throw from a shared helper, which is what makes `Snapshot.unreachable`
 *     something other than decoration.
 *
 * ⚠ Behaviour here is NOT covered by the offline suite. Its verification is
 * `npm run probe:conformance`, which runs the same conformance cases the fake
 * passes against real Bitwig — including this session's executor cases. Until
 * that runs, treat this file as unproven.
 */
import {
  AddressUnresolvedError, BankWindowOverflowError, CONTRACT_TAG, CONTRACT_VERSION,
  ContractVersionError, StaleAddressError, WireDriftError,
  addressKey, addressScene, addressTrack, assertOpsWritable, hasUnverifiedProps, planStages,
  type Address, type AdapterInfo, type BatchReceipt, type BatchRequest, type BitwigAdapter,
  type Fidelity, type NoteRecord, type Op, type ResolveResult, type ResolvedAddress,
  type RevisionMark, type SettleBudget, type Snapshot, type StageReceipt, type StateEntry,
  type TrackAddress,
} from '../../contract/index.js';
import { SETTLE_MS } from '../../contract/index.js';
import { STEP_SIZES, decodeVerboseNote, encodeStage, type EncodeContext } from './encoder.js';
import { CursorPool } from './pool.js';
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

/** Where the user's own clip selection was before we borrowed it (E1, D6). */
interface SelectionState {
  readonly trackIndex: number;
  readonly slotIndex: number;
}

export interface LiveOptions {
  readonly transport?: Transport;
  /**
   * How many pool cursors to allocate across. Learned from `rig.info` at
   * `hello()` when omitted; the rig pre-allocates them at init (E1, D7).
   */
  readonly cursorPool?: number;
  /** Expected wire methodsHash from extension/methods.golden.json, if checking. */
  readonly expectMethodsHash?: string;
}

/**
 * Ops after which no held index or cursor assignment may be trusted.
 *
 * ⚠ Standing rule 2 / D6, and it is broader than it looks: scene deletion
 * compacts rows (E3), track create/delete re-indexes the bank (E2c/E3), and a
 * device chain re-indexes on delete exactly like tracks. A held pin survives all
 * of them looking healthy while pointing somewhere else.
 */
const STRUCTURAL: ReadonlySet<string> = new Set([
  'clip.create', 'clip.delete', 'track.create', 'track.delete',
  'scene.create', 'scene.delete', 'device.insert', 'device.delete',
]);

/** Does this op move the pool cursor, and so borrow the user's selection (E1)? */
const pointsAtAClip = (op: Op): boolean =>
  op.op === 'note.write' || op.op === 'note.props' || op.op === 'note.clear';

export class LiveAdapter implements BitwigAdapter {
  private readonly transport: Transport;
  private readonly expectMethodsHash: string | undefined;
  /** Allocated at `hello()` from the rig's real pool size; see `pool.ts`. */
  private pool: CursorPool;

  /** channelId -> bank index. Invalidated by every structural op, never trusted across one. */
  private index = new Map<string, number>();
  /**
   * ⚠ Whether the PROJECT holds more tracks than the bank can show (E5).
   *
   * Kept as state rather than re-derived because it is the difference between
   * "this channelId was deleted" and "this channelId is invisible", and a single
   * bank scan cannot tell them apart on its own. `read` and `resolve` REPORT it;
   * only `apply` refuses on it — see `assertBankVisible`.
   */
  private overflowing = false;

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
    this.expectMethodsHash = options.expectMethodsHash;
    // A pool of one until `hello()` learns the rig's real size — which is the
    // Phase-0 behaviour exactly, so an adapter used before the handshake is no
    // worse than it was, merely no better.
    this.pool = new CursorPool(options.cursorPool ?? 1);
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
    // ⚠ Deliberately a SCAN, not a scan-and-refuse. `hello()` on an overflowing
    // project used to throw `BankWindowOverflowError`, which made the one call
    // that could TELL you the window is too small the one call you could not
    // make. The refusal belongs on `apply` (standing rule 5 is about operating,
    // not about looking) and the numbers below are what a caller needs to fix it.
    const list = await this.scanTracks();

    const rig = (await this.transport.send({ method: WIRE.rigInfo })) as {
      gridSteps?: number;
      cursorPool?: number;
      scenes?: number;
    };
    this.gridSteps = rig.gridSteps;
    // The rig allocates its cursor pool at init and cannot grow it afterwards
    // (D7 — allocation is init-only and enforced), so this is the real ceiling.
    if (rig.cursorPool !== undefined) this.pool = new CursorPool(rig.cursorPool);

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
        // ⚠ Was hardcoded `0` through Phase 0 — harmless while nothing read it
        // and wrong the moment something did (PHASE-0-SESSION-2 item 5). It is
        // the rig's `scenes` allocation: `ClipLauncherSlotBank` is created that
        // wide at init and cannot grow (D7), so it bounds the scene window the
        // same way `tracks` bounds the track window.
        //
        // ⚠ KNOWN GAP, stated rather than half-fixed: there is no scene-side
        // equivalent of the E5 overflow refusal below. `rig.info` also reports
        // the project's true `sceneCount`, so the check is implementable — but
        // it has never been measured against a project with more scenes than the
        // window, and standing rule 10 says a capability is not banked from a
        // doc pass. → Phase 1, session 5.
        sceneBankSize: rig.scenes ?? 0,
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
   * Re-scan the bank and rebuild the channelId -> index map. Does NOT refuse.
   *
   * ⚠ Standing rule 2: re-point after ANY structural op. A held index is only
   * valid until the next create/delete, because `createInstrumentTrack` does not
   * honour positions and deletes re-index everything after them (E2c, E3).
   *
   * ⚠ Splitting the scan from the refusal is deliberate and it fixes a Phase-0
   * carry-over. `read` declared an `unreachable` array it could never populate,
   * because this method threw first — so a blind spot presented as a hard error
   * from every path, including the paths whose whole job is to REPORT it.
   * `Snapshot.unreachable` exists precisely so a caller can tell "invisible"
   * from "empty" (E5); making that unreachable made the distinction decorative.
   */
  private async scanTracks(): Promise<TrackListResult> {
    const list = (await this.transport.send({ method: WIRE.trackList })) as TrackListResult;
    this.index = new Map(list.tracks.map((t) => [t.channelId, t.index]));
    // ● PROVEN in Phase 0: `TrackBank.itemCount()` reports the PROJECT's track
    // count, not the window size — measured live at itemCount=17 against
    // bankSize=16, with only 16 rows visible. That is what makes rule 5
    // implementable at all; before this, "16 tracks exist" and "16 of 54 are
    // visible" were indistinguishable.
    this.overflowing =
      list.itemCount !== undefined && list.bankSize !== undefined && list.itemCount > list.bankSize;
    return list;
  }

  /**
   * ⚠ E5, standing rule 5: never OPERATE on a partially-visible project.
   *
   * Only `apply` calls this. Reads report the blind spot instead, which is the
   * asymmetry the rule actually states: tracks outside the window are
   * unsnapshottable, so no write is safe — but looking is how you find out.
   */
  private assertBankVisible(list: TrackListResult): TrackListResult {
    if (this.overflowing) {
      throw new BankWindowOverflowError(list.count, list.itemCount ?? -1, list.bankSize ?? -1);
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
    return {
      cursorFor: (clipRef) => this.pool.cursorFor(clipRef),
      trackIndex: (t) => this.trackIndex(t),
    };
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

  /**
   * Save the user's clip selection so it can be put back.
   *
   * ⚠ D6's last open item, and the one PROJECT_PLAN §7 closed with E14-F:
   * pointing STEALS the user's clip selection (E1), the prior selection CAN be
   * saved and restored, restoring it does not disturb the pool cursor, and a
   * whole batch costs exactly ONE observable selection change — so a single
   * restore at the end suffices. "Phase 1 owes that restore."
   *
   * `undefined` when nothing has ever been selected: `selection.status` reports
   * an observer's last value, which starts at -1, and "restoring" that would
   * move the user somewhere they never were.
   *
   * ⚠ KNOWN COST, named so it is not rediscovered as a bug. E14-F's "one restore
   * per batch suffices" is measured per BATCH; the adapter can only see one CALL,
   * so the executor's read→apply→read pipeline pays three capture/restore pairs
   * instead of one. That is two extra round-trips and two extra selection
   * changes per run — visible to the user as flicker, not as a wrong result.
   * Hoisting it to one pair around the whole pipeline needs a component that
   * knows a pipeline is in progress, which is the daemon (session 3).
   */
  private async captureSelection(): Promise<SelectionState | undefined> {
    const status = (await this.transport.send({ method: WIRE.selectionStatus })) as {
      trackIndex: number;
      slotIndex: number;
    };
    return status.trackIndex >= 0 && status.slotIndex >= 0
      ? { trackIndex: status.trackIndex, slotIndex: status.slotIndex }
      : undefined;
  }

  /**
   * Put it back — one call, at the end, exactly as E14-F2/F3/F4 measured.
   *
   * The same `track.selectSlot` mechanism pointing uses, because it is the only
   * one of three that works (E1) and because restoring through a different
   * mechanism would be a second unmeasured thing.
   */
  private async restoreSelection(saved: SelectionState | undefined): Promise<void> {
    if (saved === undefined) return;
    await this.transport.send({
      method: WIRE.slotSelect,
      params: { trackIndex: saved.trackIndex, slotIndex: saved.slotIndex, mechanism: 'track' },
    });
  }

  async resolve(refs: readonly Address[]): Promise<ResolveResult> {
    await this.scanTracks();
    const resolved: ResolvedAddress[] = refs.map((address) => {
      const sceneRef = addressScene(address);
      if (sceneRef !== undefined && sceneRef.epoch !== this.sceneEpoch) {
        return { address, found: false, reason: 'stale-epoch' as const };
      }
      const trackRef = addressTrack(address);
      if (trackRef === undefined) return { address, found: true };
      const index = this.index.get(trackRef.channelId);
      if (index !== undefined) return { address, found: true, index };
      // ⚠ A single bank scan cannot tell "deleted" from "outside the window" for
      // one channelId — but it CAN tell whether a window exists to fall out of.
      // `itemCount` is the project total (E15-A), so when it exceeds the bank
      // size, "not in the window" is exactly what we cannot rule out, and
      // `absent` would be a claim we have no evidence for. A tombstone and a
      // blind spot must read differently, or a revert quietly under-delivers.
      return {
        address,
        found: false,
        reason: this.overflowing ? ('outside-bank-window' as const) : ('absent' as const),
      };
    });
    return { at: await this.revision(), resolved };
  }

  async read(sel: readonly Address[]): Promise<Snapshot> {
    const entries: Record<string, StateEntry> = {};
    const missing: Address[] = [];
    const unreachable: Address[] = [];
    const list = await this.scanTracks();
    // ⚠ Only a `notes` read points the cursor, and only pointing steals the
    // selection — so a metadata-only read costs nothing extra (D6, E14-F).
    const selection = sel.some((a) => a.kind === 'notes') ? await this.captureSelection() : undefined;

    for (const address of sel) {
      const sceneRef = addressScene(address);
      if (sceneRef !== undefined && sceneRef.epoch !== this.sceneEpoch) {
        throw new StaleAddressError(address, sceneRef.epoch, this.sceneEpoch);
      }
      const trackRef = addressTrack(address);
      const row = trackRef ? list.tracks.find((t) => t.channelId === trackRef.channelId) : undefined;
      if (trackRef !== undefined && row === undefined) {
        // ⚠ E5: out of the bank window is UNREACHABLE, not missing. Collapsing
        // the two is how a blind spot becomes a silently empty snapshot and a
        // revert that quietly under-delivers — which is why the field exists,
        // and why it stayed permanently empty here until `scanTracks` stopped
        // throwing (PHASE-0-SESSION-2 item 5).
        if (this.overflowing) unreachable.push(address);
        else missing.push(address);
        continue;
      }
      const entry = await this.readOne(address, row);
      if (entry === undefined) missing.push(address);
      else entries[addressKey(address)] = entry;
    }

    // ⚠ D6, E14-F: reading notes POINTS the pool cursor, which steals the user's
    // clip selection. Restoring it is what Phase 1 owes.
    await this.restoreSelection(selection);

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

        // The SAME allocator the write path uses, so a read of clip A followed
        // by a write to clip A costs no re-point — and, more to the point, so a
        // read never silently re-targets the cursor a pending props op depends
        // on (E15-F). See `pool.ts`.
        const cursor = this.pool.cursorFor(address.clip);
        await this.transport.send({ method: WIRE.cursorPointTrack, params: { cursor, trackIndex: row.index } });
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
          params: { cursor },
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
        await this.transport.send({ method: WIRE.cursorSetStepSize, params: { cursor, stepSize } });
        await this.settle('gridChange');

        // The VERBOSE scan, not the lean one: `cursor.getNotes` returns only
        // [x, y, velocity, duration], so reading it would silently drop every
        // expression property — a snapshot that looks complete, restores wrong,
        // and reports `fidelity: 'exact'` while doing it.
        const res = (await this.transport.send({
          method: WIRE.cursorGetNotesVerbose,
          params: { cursor, channel: address.channel },
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
    // ⚠ E5, standing rule 5: this is the one path that REFUSES rather than
    // reports. Tracks outside the window cannot be snapshotted, so no write is
    // safe — but `read` and `resolve` above are allowed to look and say so.
    this.assertBankVisible(await this.scanTracks());

    const stages = planStages(batch.ops);
    const receipts: StageReceipt[] = [];
    const minted: Record<number, Address> = {};
    let guard = batch.ifRevision;
    // ⚠ D6, E14-F: pointing borrows the user's clip selection, and a whole batch
    // costs exactly ONE observable selection change — so one restore at the end
    // suffices. Captured before the first stage, because by the end the cursor
    // has already moved.
    const selection = batch.ops.some(pointsAtAClip) ? await this.captureSelection() : undefined;

    for (const [i, stage] of stages.entries()) {
      // ⚠ E15-D: waited BEFORE the request goes out, not after it comes back.
      // `cursor.setNoteProps` reads a NoteStep before mutating it, and that read
      // is unusable until the grid change from the preceding stage has landed.
      // Waiting afterwards would be waiting for damage that already happened.
      if (stage.settleBefore !== undefined) await this.settle(stage.settleBefore);

      // Track creates need the bank diffed afterwards to learn what was minted.
      const before = stage.ops.some((o) => o.op === 'track.create')
        ? new Set((await this.scanTracks()).tracks.map((t: WireTrack) => t.channelId))
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

      // ⚠ E8-D: rejected means the WHOLE batch applied nothing. Stop here — and
      // still give the user their selection back, because we pointed on the way
      // in whether or not anything landed.
      if (result.rejected) {
        await this.restoreSelection(selection);
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

      // ⚠ Standing rule 2 / D6: RE-POINT AFTER ANY STRUCTURAL OP. This used to
      // happen only for `track.create`, and only because the mint diff needed
      // it — which left every other structural op running on a stale bank map
      // and stale cursor assignments. A held pin's `sceneIndex` goes permanently
      // stale after compaction while looking perfectly healthy (E3), so the
      // damage is silent and arbitrarily delayed.
      if (stage.ops.some((o) => STRUCTURAL.has(o.op))) {
        this.pool.invalidate();
        const after = (await this.scanTracks()).tracks;
        if (before !== undefined) {
          const created = after.find((t: WireTrack) => !before.has(t.channelId));
          const at = stage.opIndices[stage.ops.findIndex((o) => o.op === 'track.create')];
          if (created !== undefined && at !== undefined) {
            minted[at] = { kind: 'track', channelId: created.channelId };
          }
        }
      }
    }

    await this.restoreSelection(selection);
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
