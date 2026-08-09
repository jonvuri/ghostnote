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
  addressKey, addressScene, addressTrack, assertOpsWritable, clip as clipAt, hasUnverifiedProps,
  discontinuityBetween, planStages, sliceDelta,
  type Address, type AddressKey, type AdapterInfo, type BatchReceipt, type BatchRequest,
  type BitwigAdapter, type ClipAddress, type ContentDelta, type ContentEvent, type Fidelity,
  type NoteRecord, type Op, type ResolveResult, type ResolvedAddress, type RevisionMark,
  type SettleBudget, type Snapshot, type StageReceipt, type StateEntry, type TrackAddress,
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

interface WireDevice {
  index: number;
  name: string;
}

/** A device chain as one observation, with whether we could see all of it. */
interface ChainSnapshot {
  readonly devices: readonly WireDevice[];
  /** The chain is longer than the device bank window, so this view is partial. */
  readonly blind: boolean;
}

/**
 * ⚠ The chain index a `device.insert` PRODUCED, from two observations of the
 * chain — never from a count, and never from the position anyone requested.
 *
 * E2c forced this discipline on `track.create` (create, diff the bank, verify)
 * and the cost of being wrong is sharper here: the index a mint reports is the
 * index a revert DELETES, so an index that was inferred rather than seen removes
 * a device nobody addressed (D20 — *name the survivor, never count it*).
 *
 * Every insert handler in the extension uses `endOfDeviceChainInsertionPoint()`,
 * so the new device is the LAST one — and that is VERIFIED here rather than
 * assumed: every entry the chain already had must still be exactly where it was.
 * Anything else (a chain that grew by two, a prefix that moved, a partial view)
 * returns `undefined`, and the insert is REPORTED as un-undoable instead. Failing
 * closed is the whole point; a mint that guesses is worse than no mint.
 *
 * ⚠ If Phase 5 ever reaches an insertion point that is not the end of the chain,
 * this must get stronger before that op ships — appending is what makes "the last
 * entry" identifiable at all when a chain holds two devices of the same name.
 */
function mintedChainIndex(before: ChainSnapshot, after: ChainSnapshot): number | undefined {
  if (before.blind || after.blind) return undefined;
  if (after.devices.length !== before.devices.length + 1) return undefined;
  for (const [i, was] of before.devices.entries()) {
    const now = after.devices[i];
    if (now === undefined || now.index !== was.index || now.name !== was.name) return undefined;
  }
  return after.devices[after.devices.length - 1]?.index;
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

/**
 * Does this op move a pool cursor, and so borrow the user's selection (E1)?
 *
 * ⚠ DEVICE ops belong here, which they did not while they were mis-encoded. They
 * now emit `cursor.pointTrack` — `CursorTrack.selectChannel`, the call this
 * codebase has already observed SETTING the UI selection — so a batch that
 * inserts a device steals the selection exactly as a note write does. Leaving
 * them out would mean the one op class that takes 600ms to settle is also the one
 * that never gives the selection back (D6, E14-F).
 */
const borrowsSelection = (op: Op): boolean =>
  op.op === 'note.write' || op.op === 'note.props' || op.op === 'note.clear'
  || op.op === 'device.insert' || op.op === 'device.delete';

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
   * ⚠⚠ **The last mark read off the extension — and the fix for the limit that
   * used to be documented here.**
   *
   * This was a counter the adapter bumped on its OWN scene ops, and its own
   * comment said what was wrong with it: a scene the USER created or deleted did
   * not move it, so a scene-relative address minted before that edit still
   * resolved as `found` while E3's compaction had already shifted every row
   * beneath it — the exact silent mis-write the epoch exists to prevent, absent
   * precisely when a human was at the keyboard. It was filed as a Phase-1
   * dependency on the daemon's observers.
   *
   * ⚠ There is no daemon (D4 rev). The observers live in the EXTENSION, which is
   * a strictly better home than the daemon ever was: it is alive whenever Bitwig
   * is, so it cannot miss an edit made while no client was attached — which a
   * daemon spawned on demand by its first client provably can. Both epochs are
   * now read from there, and this field is a CACHE of the last reading, not a
   * counter we maintain.
   *
   * ⚠ `undefined` until the first `revision()`. Anything that needs an epoch
   * reads one; nothing here invents a starting value, because a made-up epoch
   * that happens to match is the failure this whole mechanism is about.
   */
  private lastMark: RevisionMark | undefined;
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
      cursorForTrack: (t) => this.pool.cursorForTrack(t),
      trackIndex: (t) => this.trackIndex(t),
    };
  }

  /**
   * A track's device chain, as OBSERVED through a pool cursor.
   *
   * ⚠ `device.list` reads `rig.cursorDeviceBanks[cursor]`, i.e. the bank of
   * whatever track that cursor is pointed at — so the point is part of the
   * observation, not a precondition someone else is trusted to have met. Re-pointed
   * on every call rather than relying on an assignment to have survived, because
   * the whole reason this is being read is that a structural op just ran
   * (standing rule 2).
   */
  private async deviceChain(trackRef: TrackAddress): Promise<ChainSnapshot | undefined> {
    const trackIndex = this.index.get(trackRef.channelId);
    if (trackIndex === undefined) return undefined;
    const cursor = this.pool.cursorForTrack(trackRef);
    await this.transport.send({ method: WIRE.cursorPointTrack, params: { cursor, trackIndex } });
    await this.settle('cursorPoint');
    const res = (await this.transport.send({
      method: WIRE.deviceList,
      params: { cursor },
    })) as { devices?: WireDevice[]; count?: number; itemCount?: number };
    const devices = res.devices ?? [];
    // ⚠ E5's rule, one level down. `deviceList` walks `rig.config.deviceBank`
    // slots while `itemCount` is the CHAIN's true length, so a chain longer than
    // the bank window is partially visible — and a diff over a partial view
    // cannot tell an insert from something scrolling into frame. Looking is
    // allowed; concluding from a half-view is not.
    const blind = typeof res.itemCount === 'number' && res.itemCount > devices.length;
    return { devices, blind };
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

  /**
   * The mark, and the launcher events behind it, in ONE round trip.
   *
   * ⚠ They arrive together on purpose. The extension's event log is a ring, so a
   * reader that learns the epoch here and fetches the names in a second call can
   * have the names it needed pushed out in between — and would then read a short
   * window as a quiet one. Together they are one observation of one moment.
   */
  private async readMark(): Promise<{ mark: RevisionMark; events: readonly ContentEvent[] }> {
    const r = (await this.transport.send({ method: WIRE.revisionGet })) as {
      revision: number;
      generation: string;
      sceneEpoch: number;
      contentEpoch: number;
      project?: string;
      contentEvents?: readonly ContentEvent[];
    };
    const mark: RevisionMark = {
      revision: r.revision,
      sceneEpoch: r.sceneEpoch,
      contentEpoch: r.contentEpoch,
      generation: r.generation,
      // ⚠ Absent from an older extension reads as '' — which `discontinuityBetween`
      // treats as UNKNOWN and therefore incomparable, not as a match. A stale
      // extension makes every window fail closed rather than silently pass.
      project: r.project ?? '',
    };
    this.lastMark = mark;
    return { mark, events: r.contentEvents ?? [] };
  }

  async revision(): Promise<RevisionMark> {
    return (await this.readMark()).mark;
  }

  /**
   * ⚠ A REPORT, not a refusal — the caller decides how bad an incomparable window
   * is. A finished batch surfaces it; a reversal refuses on it (D19's boundary).
   * Making that call here would hard-code one policy into the transport layer.
   */
  async contentSince(since: RevisionMark): Promise<ContentDelta> {
    const { mark, events } = await this.readMark();
    const discontinuity = discontinuityBetween(since, mark);
    if (discontinuity !== undefined) {
      return {
        since: since.contentEpoch,
        now: mark.contentEpoch,
        events: [],
        truncated: false,
        discontinuous: true,
        discontinuity,
      };
    }
    return {
      ...sliceDelta(since.contentEpoch, mark.contentEpoch, events),
      discontinuous: false,
    };
  }

  /**
   * The epoch every scene-relative address is checked against.
   *
   * ⚠ Throws rather than defaulting when no mark has been read yet. A zero here
   * would compare equal to a freshly-minted address's epoch and pass a check
   * nothing had performed, which is worse than the limit this replaced.
   */
  private requireSceneEpoch(): number {
    if (this.lastMark === undefined) {
      throw new AddressUnresolvedError(
        { kind: 'scene', index: -1, epoch: -1 },
        'no mark has been read from the extension yet, so there is no scene epoch to check a ' +
        'scene-relative address against. Call revision(), resolve() or read() first — they all ' +
        'take one.',
      );
    }
    return this.lastMark.sceneEpoch;
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
    // ⚠ The mark is taken FIRST, and it is the mark returned. Two reasons, both
    // fail-closed: the epoch every address below is checked against has to be a
    // real reading rather than a remembered one, and a caller that baselines on
    // the returned mark then sees any foreign edit that happened DURING this
    // call. A mark taken at the end would swallow exactly those.
    const at = await this.revision();
    await this.scanTracks();
    const resolved: ResolvedAddress[] = refs.map((address) => {
      const sceneRef = addressScene(address);
      if (sceneRef !== undefined && sceneRef.epoch !== at.sceneEpoch) {
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
    return { at, resolved };
  }

  async read(sel: readonly Address[]): Promise<Snapshot> {
    const entries: Record<string, StateEntry> = {};
    const missing: Address[] = [];
    const unreachable: Address[] = [];
    // ⚠ Before the read, and it is the mark the snapshot carries — see `resolve`.
    // A stash is the thing a reversal later asks "what has happened since?", so
    // the window it opens has to START no later than the read it describes.
    const at = await this.revision();
    const list = await this.scanTracks();
    // ⚠ Pointing steals the user's clip selection (E1, D6, E14-F), so anything
    // that MIGHT point has to be paid for here. That used to be `notes` alone;
    // as of the D16 amendment a `clip` read of an OCCUPIED slot points too, to
    // capture the clip's length. An empty slot still costs nothing — and must
    // not be pointed at in any case (E2).
    const selection = sel.some((a) => a.kind === 'notes' || a.kind === 'clip' || a.kind === 'slot')
      ? await this.captureSelection()
      : undefined;
    // Where each pool cursor is actually pointed, so the common shape — a clip
    // target and its notes target, side by side in one write-set — costs one
    // point and one settle rather than two.
    //
    // ⚠ Keyed by CURSOR, not by clip, and that is the whole correctness of it.
    // The pool EVICTS (`pool.ts`, LRU), so "we already pointed at this clip" does
    // not survive a batch that addresses more clips than the pool holds: the clip
    // comes back, gets a different cursor, and a clip-keyed memo would skip the
    // point and read through a cursor still sitting on somebody else's music —
    // E2's silent mispoint arriving through the mechanism built to prevent it.
    // Asking "is THIS cursor already on THIS clip" cannot be wrong that way.
    const pointedAt = new Map<string, AddressKey>();

    for (const address of sel) {
      const sceneRef = addressScene(address);
      if (sceneRef !== undefined && sceneRef.epoch !== at.sceneEpoch) {
        throw new StaleAddressError(address, sceneRef.epoch, at.sceneEpoch);
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
      const entry = await this.readOne(address, row, pointedAt);
      if (entry === undefined) missing.push(address);
      else entries[addressKey(address)] = entry;
    }

    // ⚠ D6, E14-F: reading notes POINTS the pool cursor, which steals the user's
    // clip selection. Restoring it is what Phase 1 owes.
    await this.restoreSelection(selection);

    return { contract: CONTRACT_TAG, at, entries, missing, unreachable };
  }

  /**
   * Point a pool cursor at a clip, once per read.
   *
   * The pool assigns per clip (`pool.ts`), so asking twice usually returns the
   * same cursor — but the point FRAMES and their settle are not free, and the
   * write-set of any `clip.create`/`clip.delete` asks for the clip and its notes
   * back to back. `pointedAt` is that memo, scoped to the one `read` call so
   * nothing is ever assumed to have survived a structural op (standing rule 2).
   *
   * ⚠ "Usually" is doing real work in that sentence, which is why the memo
   * records CURSOR → clip rather than a set of clips. `cursorFor` evicts the
   * least recently used assignment, so a read addressing more clips than the pool
   * holds can hand the same clip a different cursor the second time round — and a
   * memo that only remembered "we pointed at this clip already" would skip the
   * point and then read a cursor that is still on the clip it was evicted for.
   * Wrong notes, wrong length, healthy status, straight into the stash a revert
   * replays (E2). Reachable today: `note.write`/`note.props` carry a `channel`, so
   * one clip legitimately appears twice in a write-set with other clips between.
   */
  private async pointAtClip(
    clipRef: ClipAddress,
    trackIndex: number,
    pointedAt: Map<string, AddressKey>,
  ): Promise<string> {
    const cursor = this.pool.cursorFor(clipRef);
    const key = addressKey(clipRef);
    if (pointedAt.get(cursor) === key) return cursor;
    await this.transport.send({ method: WIRE.cursorPointTrack, params: { cursor, trackIndex } });
    await this.transport.send({
      method: WIRE.slotSelect,
      params: { trackIndex, slotIndex: clipRef.slot.scene.index, mechanism: 'track' },
    });
    await this.settle('cursorPoint');
    pointedAt.set(cursor, key);
    return cursor;
  }

  private async readOne(
    address: Address,
    row: WireTrack | undefined,
    pointedAt: Map<string, AddressKey>,
  ): Promise<StateEntry | undefined> {
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
        const clipRef = address.kind === 'clip' ? address : clipAt(address);
        const sceneIndex = clipRef.slot.scene.index;
        const status = (await this.transport.send({
          method: WIRE.slotStatus,
          params: { trackIndex: row.index, slotIndex: sceneIndex },
        })) as { hasContent: boolean };
        // ⚠ E2: an empty slot must never be pointed at — the cursor lands on a
        // DIFFERENT clip and reports a healthy status. Absence is also the case
        // that needs nothing more: it is restorable exactly, by deleting whatever
        // the batch put here (D16d).
        if (!status.hasContent) {
          return { address, fidelity: 'exact', value: { of: 'clip', exists: false } };
        }

        // ⚠ AMENDED 2026-08-07 (D16, §3.3.3). This branch used to return
        // `fidelity: 'none'` with no length, on the reason that a clip has no
        // readback that could reproduce it — while the `notes` branch below was
        // already reading `loopLength` off this very cursor to pick its scan
        // grid. The capture was never missing from the API; it was missing from
        // the entry. `StateValue.lengthBeats` had been declared and populated by
        // the fake the whole time, which made this the exact shape PHASE-0 §Risks
        // warned about: a fake certifying a capture the live path did not make.
        const cursor = await this.pointAtClip(clipRef, row.index, pointedAt);
        const loop = (await this.transport.send({
          method: WIRE.cursorStatus,
          params: { cursor },
        })) as { loopLength?: number };
        // ⚠ NOT defaulted. The `notes` branch may fall back to 4 beats because a
        // scan window that is too wide only costs resolution; here the number IS
        // the captured value, and a clip silently recreated at a guessed length is
        // a musical value invented from nothing. Absent means absent, and
        // `revertOps` refuses to recreate the clip rather than pick a length.
        const lengthBeats = typeof loop.loopLength === 'number' && loop.loopLength > 0
          ? loop.loopLength
          : undefined;
        return {
          address,
          fidelity: 'lossy',
          value: lengthBeats === undefined
            ? { of: 'clip', exists: true }
            : { of: 'clip', exists: true, lengthBeats },
        };
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
        const cursor = await this.pointAtClip(address.clip, row.index, pointedAt);

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
    const selection = batch.ops.some(borrowsSelection) ? await this.captureSelection() : undefined;

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

      // ⚠ And so does a device insert, for the same reason and with a sharper
      // consequence — see `mintedChainIndex`. `planStages` gives every
      // `device.insert` a stage of its own (its settle is not `instant`), so a
      // stage holds at most one and the two observations bracket exactly one op.
      const insertAt = stage.ops.findIndex((o) => o.op === 'device.insert');
      const insertOp = insertAt === -1 ? undefined : stage.ops[insertAt];
      const chainBefore = insertOp?.op === 'device.insert'
        ? await this.deviceChain(insertOp.track)
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

      // ⚠ AFTER the settle and BEFORE `pool.invalidate()`. `deviceInsert` is the
      // slowest budget measured (600ms, E3) precisely because the device is not
      // in the chain until it lands, so a diff taken any earlier would report the
      // chain we already had and mint nothing — the failure that looks like a
      // missing capability rather than a race.
      if (insertOp?.op === 'device.insert' && chainBefore !== undefined) {
        const chainAfter = await this.deviceChain(insertOp.track);
        const at = stage.opIndices[insertAt];
        const chainIndex = chainAfter === undefined
          ? undefined
          : mintedChainIndex(chainBefore, chainAfter);
        if (at !== undefined && chainIndex !== undefined) {
          minted[at] = { kind: 'device', track: insertOp.track, chainIndex };
        }
      }

      // ⚠ NOTHING is bumped here any more, and the deletion is the session's
      // point. The epoch used to be incremented from this loop, which is why it
      // could only ever see our own scene ops; it now comes off an observer in
      // the extension that sees the user's too. The next `revision()` reports the
      // new value because Bitwig moved it, not because we remembered to.

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
