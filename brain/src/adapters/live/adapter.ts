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
  addressKey, addressScene, addressTrack, assertDevicesRoutable, assertOpsAddressable, assertOpsWritable,
  assertClipSources, assertSceneRoom, assertTrackRoom, assertSlotsFree, clip as clipAt, contentDelta, hasUnverifiedProps, planStages,
  lookupChain, lookupNestedDevice, nestingObservable, windowCovers,
  type Address, type AddressKey, type AdapterInfo, type BatchReceipt, type BatchRequest,
  type BitwigAdapter, type ChainMiss, type ClipAddress, type ContentDelta, type ContentEvent, type Fidelity,
  type NoteRecord, type ObservedChain, type ObservedContainer, type Op, type ResolveResult, type ResolvedAddress, type RevisionMark,
  type LaunchMode, type LaunchQuantization, type SceneAddress, type SettleBudget, type Snapshot, type StageReceipt, type StateEntry,
  type TrackAddress, type TrackState, type WindowCoverage,
} from '../../contract/index.js';
import { SETTLE_MS } from '../../contract/index.js';
import {
  STEP_SIZES, decodeVerboseNote, encodeStage, sceneRowIn, type EncodeContext,
} from './encoder.js';
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

/**
 * `chain.inventory`'s reply — the container structure of the pointed track.
 *
 * ⚠ Every field is optional except the ones an OLDER extension also sent, and
 * that is the versioning discipline: `methodsHash` is over method NAMES, so a
 * deployment too old to carry `trackChannelId` or the bank sizes answers with
 * SILENCE and the handshake cannot tell. Silence must fail closed, so a missing
 * identity refuses the whole observation and a missing bank size makes the view
 * incomplete rather than complete.
 */
interface WireInventoryChain {
  index: number;
  name?: string;
  channelId?: string;
  devices?: { index: number; name?: string }[];
}

interface WireInventoryScope {
  slot: number;
  status?: string;
  deviceExists?: boolean;
  deviceName?: string;
  chains?: WireInventoryChain[];
  chainCount?: number;
  chainBankSize?: number;
  deviceBankSize?: number;
}

interface WireInventory {
  scopes?: WireInventoryScope[];
  trackName?: string;
  trackChannelId?: string;
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

/**
 * ⚠ `RigConfig.scenes`' shipped default, and a PLACEHOLDER, not a reading.
 *
 * `hello()` replaces it with the rig's real allocation. It exists for the same
 * reason `CursorPool(1)` and `gridSteps ?? 64` do: an adapter used before the
 * handshake must behave no worse than the Phase-0 one did, and an offline stub
 * transport that never answers `rig.info` still has to produce a scene window.
 *
 * ⚠ It is a claim about the world and it can be WRONG — a rig configured with
 * `scenes: 8` and used before `hello()` would consider row 10 addressable. The
 * contract says `hello()` is called "once, before anything else", and every
 * production path (`Session.ready()`, both harnesses, every probe) does.
 */
const RIG_DEFAULT_SCENES = 16;

export interface LiveOptions {
  readonly transport?: Transport;
  /**
   * How many pool cursors to allocate across. Learned from `rig.info` at
   * `hello()` when omitted; the rig pre-allocates them at init (E1, D7).
   */
  readonly cursorPool?: number;
  /**
   * How wide the scene bank window is. Learned from `rig.info` at `hello()` when
   * omitted; like the cursor pool it is fixed at the rig's `init()` (D7), which
   * is why it can be cached at all.
   */
  readonly sceneBankSize?: number;
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
  'clip.create', 'clip.delete', 'track.create', 'track.duplicate', 'track.delete',
  'clip.duplicate', 'clip.move',
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
  || op.op === 'device.insert' || op.op === 'device.delete'
  || op.op === 'clip.launchSettings';

export class LiveAdapter implements BitwigAdapter {
  private readonly transport: Transport;
  private readonly expectMethodsHash: string | undefined;
  /** Allocated at `hello()` from the rig's real pool size; see `pool.ts`. */
  private pool: CursorPool;

  /** channelId -> bank index. Invalidated by every structural op, never trusted across one. */
  private index = new Map<string, number>();
  /**
   * The rows the last scan returned, so a `read` does not re-scan what the mark
   * it was just handed already scanned.
   *
   * ⚠ Derived state from `scanTracks`, exactly like `index` and `overflowing`,
   * and subject to the same rule: valid only until the next structural op. Every
   * reader here takes it immediately after a scan rather than holding it.
   */
  private bank: readonly WireTrack[] = [];
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
  /**
   * ⚠ How wide the SCENE window is — the number rule 5's second population is an
   * inequality over, and the one nothing in this file used to hold.
   *
   * `ClipLauncherSlotBank` and `SceneBank` are both created `config.scenes` wide
   * at the rig's `init()` and cannot grow (D7), so unlike the track side — where
   * `track.list` re-reports `bankSize` on every scan — this is learned once and
   * cached. Learned at `hello()`; see `RIG_DEFAULT_SCENES` for what it is until
   * then.
   */
  private sceneBankSize: number;

  constructor(options: LiveOptions = {}) {
    this.transport = options.transport ?? new BridgeTransport();
    this.expectMethodsHash = options.expectMethodsHash;
    // A pool of one until `hello()` learns the rig's real size — which is the
    // Phase-0 behaviour exactly, so an adapter used before the handshake is no
    // worse than it was, merely no better.
    this.pool = new CursorPool(options.cursorPool ?? 1);
    this.sceneBankSize = options.sceneBankSize ?? RIG_DEFAULT_SCENES;
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
    // ⚠ Same rule, second population: the scene bank and every slot bank are
    // created `config.scenes` wide at init and cannot grow. This is the real
    // ceiling on which ROWS exist for us at all.
    if (rig.scenes !== undefined) this.sceneBankSize = rig.scenes;

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
        // ⚠⚠ The KNOWN GAP that used to be recorded here — *"there is no
        // scene-side equivalent of the E5 overflow refusal"* — is CLOSED in
        // session 3c. It cost a stranded scene at project index 99 to notice
        // (`FINDINGS.md` E19), and the premise it was waiting on is now measured
        // rather than assumed: `sceneBank.itemCount()` reports the PROJECT total,
        // not the window size (E21 arm 1). The refusals are `assertSceneRoom` and
        // `assertOpsAddressable` in `apply`, the blind rows are in
        // `Snapshot.unreachable`, and the observers' reach is on the mark.
        sceneBankSize: this.sceneBankSize,
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
    this.bank = list.tracks;
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
   *
   * ⚠ Takes the coverage off the MARK rather than re-deriving it from a list, so
   * the refusal and the delta's `uncovered` verdict are the same two numbers. They
   * were separate readings of the same fact for a phase, and separate readings are
   * how one of them ends up right and the other stale.
   */
  private assertBankVisible(tracks: WindowCoverage): void {
    if (windowCovers(tracks)) return;
    throw new BankWindowOverflowError('tracks', this.bank.length, tracks.count, tracks.bankSize);
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
      sceneRow: sceneRowIn(this.sceneWindow),
    };
  }

  /**
   * ⚠ Where a scene ROW falls relative to the window — E5's question, one
   * population down, and the distinction `Snapshot.unreachable` exists to keep.
   *
   *   `visible`     inside the window; whatever is there can be read.
   *   `unreachable` outside it, and it EXISTS (or we cannot tell whether it does,
   *                 which fails the same way). Invisible is not empty.
   *   `absent`      past the project's own scene count, so there is no row.
   *
   * ⚠ An unknown project total resolves to `unreachable`, never to `absent`.
   * Reporting a row we cannot see as "there is nothing there" is the exact
   * under-delivery D5 forbids.
   */
  private sceneRowStanding(row: SceneAddress): 'visible' | 'unreachable' | 'absent' {
    const scenes = this.sceneWindow;
    if (row.index < scenes.bankSize) return 'visible';
    return scenes.count >= 0 && row.index >= scenes.count ? 'absent' : 'unreachable';
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
   * ⚠⚠ A container device's chains, through `chain.inventory` — the only route
   * by which anything in this system can SEE a layer chain.
   *
   * Everything about this call is narrow, and every limit is reported rather
   * than smoothed over:
   *
   *   - it reads `Rig.slotLayerBanks`, which hang off the FIRST FEW top-level
   *     device slots of the track `cursorTracks[0]` points at. A container
   *     further along the chain has no scope and is `outside-bank-window`;
   *   - the scopes are built at `init()` (D7), so a scope that failed to build
   *     reports its own status. Standing rule 13: *"the handle does not exist"*
   *     and *"the API declines"* are indistinguishable in the outcome, and three
   *     false ○s in E17 came from exactly that. A scope that is not `held` is
   *     `unsupported` — we did not look — never `absent`;
   *   - the bank SIZES come off the reply, and when they do not (an extension
   *     older than this slice) completeness is UNKNOWN, which makes every
   *     zero-match answer `outside-bank-window` instead of `absent`. A stale
   *     deployment fails closed rather than silently reporting tombstones.
   *
   * ⚠⚠ It points cursor `'0'` SPECIFICALLY, and not a pool cursor: the slot
   * scopes were built from `cursorDeviceBanks[0]` at init and follow that one
   * cursor for the life of the extension. Handing this a pool ref would scope
   * the read to whatever track that cursor happens to hold — the e16o trap, one
   * level up, with a reply that looks perfectly healthy.
   *
   * ⚠ And the point is VERIFIED, not assumed: the reply carries the pointed
   * track's own `channelId`, which is compared against the track we were asked
   * about. A mismatch is `unsupported` rather than a guess — reporting another
   * track's chains under this address is the whole failure class.
   */
  private async containerScope(
    trackRef: TrackAddress,
    containerIndex: number,
  ): Promise<
    | { ok: true; container: ObservedContainer; deviceName: string | undefined }
    | { ok: false; miss: ChainMiss }
  > {
    const trackIndex = this.index.get(trackRef.channelId);
    if (trackIndex === undefined) return { ok: false, miss: 'absent' };
    if (containerIndex < 0) return { ok: false, miss: 'absent' };
    await this.transport.send({
      method: WIRE.cursorPointTrack, params: { cursor: '0', trackIndex },
    });
    await this.settle('cursorPoint');
    const reply = (await this.transport.send({ method: WIRE.chainInventory })) as WireInventory;
    // ⚠ The identity guard, before anything in the reply is believed. `trackName`
    // rides along too and is deliberately NOT used for this: a name is not an
    // identity (standing rule 2), and two tracks may share one.
    if (reply.trackChannelId !== trackRef.channelId) return { ok: false, miss: 'unsupported' };
    const scope = (reply.scopes ?? [])[containerIndex];
    if (scope === undefined) return { ok: false, miss: 'outside-bank-window' };
    if (scope.status !== 'held') return { ok: false, miss: 'unsupported' };
    const chainBank = scope.chainBankSize;
    const deviceBank = scope.deviceBankSize;
    const chains = scope.chains ?? [];
    return {
      ok: true,
      // ⚠ `undefined` means the position holds NO DEVICE — which is a real
      // observation (the scope was held and we looked), not a failure to look.
      // It is what makes a device read of an empty position `missing` while a
      // position with no scope at all is `unreachable`.
      deviceName: scope.deviceExists === true ? scope.deviceName ?? '' : undefined,
      container: {
        chains: chains.map((c) => ({
          index: c.index,
          name: c.name ?? '',
          devices: (c.devices ?? []).map((d) => ({ index: d.index, name: d.name ?? '' })),
          devicesComplete: deviceBank !== undefined && (c.devices ?? []).length < deviceBank,
        })),
        chainsComplete: chainBank !== undefined && chains.length < chainBank,
      },
    };
  }

  /**
   * Chain-family resolution, or `undefined` when the address is not one.
   *
   * ⚠ The mirror of `FakeAdapter.resolveNested`, and it has to stay one: the
   * conformance suite asserts the same reasons on both, so a divergence here is
   * a failing test rather than a discovery made live months later.
   */
  private async resolveNested(
    address: Address,
    trackRef: TrackAddress,
  ): Promise<ResolvedAddress | undefined> {
    if (address.kind === 'param') {
      // ⚠ A parameter inside a chain hangs off a handle nothing has built or
      // measured. Device resolution must not promote it implicitly.
      return address.device.chain === undefined
        ? undefined
        : { address, found: false, reason: 'unsupported' as const };
    }
    if (address.kind === 'device' && address.chain === undefined) return undefined;
    if (address.kind !== 'chain' && address.kind !== 'device') return undefined;
    if (!nestingObservable(address)) return { address, found: false, reason: 'unsupported' as const };
    const container = address.kind === 'chain' ? address.container : address.chain!.container;
    const scope = await this.containerScope(trackRef, container.chainIndex);
    if (!scope.ok) return { address, found: false, reason: scope.miss };
    if (address.kind === 'chain') {
      const found = lookupChain(scope.container, address.name);
      return found.ok
        ? { address, found: true, index: found.chain.index }
        : { address, found: false, reason: found.miss };
    }
    const found = lookupNestedDevice(scope.container, address);
    return found.ok
      ? { address, found: true, index: found.device.index }
      : { address, found: false, reason: found.miss };
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
   * The mark, the launcher events behind it, and WHAT THE BANKS COULD SEE.
   *
   * ⚠ The epoch and the events arrive together on purpose. The extension's event
   * log is a ring, so a reader that learns the epoch here and fetches the names in
   * a second call can have the names it needed pushed out in between — and would
   * then read a short window as a quiet one. Together they are one observation of
   * one moment.
   *
   * ⚠⚠ The bank SCAN is the second call, and it is not part of that atomicity
   * requirement — coverage is a fact about how the rig was built, not about the
   * event stream. It rides here so that every mark in the system carries it: a
   * consumer that has to fetch coverage separately is a consumer that can forget
   * to, and forgetting fails in the direction that reads as "nothing happened"
   * (B2, session 3c).
   *
   * ⚠ Assembled entirely from fields the wire ALREADY carried — `revision.get`'s
   * `sceneCount` and `track.list`'s `itemCount`/`bankSize`. No reply field was
   * added, deliberately: `methodsHash` is over method NAMES, so an extension too
   * old to send a new field answers the coverage question with silence and the
   * handshake cannot tell. Absent `sceneCount` reads as `-1`, which every
   * predicate treats as UNCOVERED rather than as covered.
   */
  private async readMark(): Promise<{ mark: RevisionMark; events: readonly ContentEvent[] }> {
    const r = (await this.transport.send({ method: WIRE.revisionGet })) as {
      revision: number;
      generation: string;
      sceneEpoch: number;
      contentEpoch: number;
      project?: string;
      sceneCount?: number;
      contentEvents?: readonly ContentEvent[];
    };
    const list = await this.scanTracks();
    const mark: RevisionMark = {
      revision: r.revision,
      sceneEpoch: r.sceneEpoch,
      contentEpoch: r.contentEpoch,
      generation: r.generation,
      // ⚠ Absent from an older extension reads as '' — which `discontinuityBetween`
      // treats as UNKNOWN and therefore incomparable, not as a match. A stale
      // extension makes every window fail closed rather than silently pass.
      project: r.project ?? '',
      window: {
        // ⚠ `itemCount` is the PROJECT total (E15-A); `count` is only what the
        // window happened to hold. Falling back to `count` would report a FULL
        // window as a complete project — the one substitution that turns the
        // detector into a rubber stamp — so an absent `itemCount` stays `-1`.
        tracks: { count: list.itemCount ?? -1, bankSize: list.bankSize ?? -1 },
        scenes: { count: r.sceneCount ?? -1, bankSize: this.sceneBankSize },
      },
    };
    this.lastMark = mark;
    return { mark, events: r.contentEvents ?? [] };
  }

  async revision(): Promise<RevisionMark> {
    return (await this.readMark()).mark;
  }

  /** The scene window every row-bearing address is measured against. */
  private get sceneWindow(): WindowCoverage {
    return { count: this.lastMark?.window.scenes.count ?? -1, bankSize: this.sceneBankSize };
  }

  /**
   * ⚠ A REPORT, not a refusal — the caller decides how bad an incomparable window
   * is. A finished batch surfaces it; a reversal refuses on it (D19's boundary).
   * Making that call here would hard-code one policy into the transport layer.
   */
  async contentSince(since: RevisionMark): Promise<ContentDelta> {
    const { mark, events } = await this.readMark();
    // ⚠ Assembled by the CONTRACT, not here. Both adapters used to build a delta
    // each from the same parts, which is how a fake drifts into being kinder than
    // Bitwig one forgotten field at a time — and a fourth verdict is exactly the
    // kind of field that gets forgotten in one of two hand-written literals.
    return contentDelta(since, mark, events);
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

  /**
   * ⚠ A fresh SCAN every time, never the cached bank.
   *
   * Standing rule 2: re-point after any structural op. This is the call whose
   * whole output is positions and identities, so serving it from `this.bank`
   * would hand back the world as it was before whatever just happened — and the
   * caller most likely to ask is one that has no ids yet and no way to notice.
   *
   * ⚠ It does not refuse an overflowing project, for the reason `hello()` records
   * at length: looking is how you find out. The tracks past the window are simply
   * not in the bank's own answer, and `RevisionMark.window.tracks` is what says
   * how many were left out.
   */
  async tracks(): Promise<readonly TrackState[]> {
    const list = await this.scanTracks();
    return list.tracks.map((t) => ({
      channelId: t.channelId,
      name: t.name,
      position: t.position,
      type: t.type,
    }));
  }

  async resolve(refs: readonly Address[]): Promise<ResolveResult> {
    // ⚠ The mark is taken FIRST, and it is the mark returned. Two reasons, both
    // fail-closed: the epoch every address below is checked against has to be a
    // real reading rather than a remembered one, and a caller that baselines on
    // the returned mark then sees any foreign edit that happened DURING this
    // call. A mark taken at the end would swallow exactly those.
    const at = await this.revision();
    // ⚠ Chain-family addresses cost a ROUND TRIP each — a point and an inventory
    // read — where every other kind is answered from the bank scan already in
    // hand. They are therefore resolved in a second pass, after the cheap
    // classification below has already refused everything it can refuse for
    // free: a stale epoch, a row outside the scene window, a track that is not
    // in the bank. Nothing reaches the wire on behalf of an address that was
    // never going to resolve.
    const WALK = Symbol('chain-family: needs a path walk');
    const first: (ResolvedAddress | typeof WALK)[] = refs.map((address) => {
      const sceneRef = addressScene(address);
      if (sceneRef !== undefined && sceneRef.epoch !== at.sceneEpoch) {
        return { address, found: false, reason: 'stale-epoch' as const };
      }
      // ⚠ The row before the track: a row outside the scene window cannot be
      // addressed no matter how reachable its track is, and answering `found`
      // for it would hand back an index the bank rejects (E19's stranded scene).
      if (sceneRef !== undefined) {
        const standing = this.sceneRowStanding(sceneRef);
        if (standing === 'unreachable') {
          return { address, found: false, reason: 'outside-bank-window' as const };
        }
        if (standing === 'absent') return { address, found: false, reason: 'absent' as const };
      }
      const trackRef = addressTrack(address);
      if (trackRef === undefined) return { address, found: true };
      const index = this.index.get(trackRef.channelId);
      if (index !== undefined) {
        // ⚠ The track bank resolves only the durable ANCHOR, and a chain-family
        // address is not resolved until its whole path has been walked. Marked
        // for the second pass rather than answered here.
        if (address.kind === 'chain'
          || (address.kind === 'device' && address.chain !== undefined)
          || (address.kind === 'param' && address.device.chain !== undefined)) {
          return WALK;
        }
        return { address, found: true, index };
      }
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
    const resolved: ResolvedAddress[] = [];
    for (const [at_, entry] of first.entries()) {
      const address = refs[at_]!;
      if (entry !== WALK) {
        resolved.push(entry);
        continue;
      }
      const trackRef = addressTrack(address)!;
      // ⚠ `resolveNested` is the only thing that may answer `found` for a
      // chain-family address, and it is shared, line for line, with the fake.
      resolved.push(await this.resolveNested(address, trackRef)
        ?? { address, found: false, reason: 'unsupported' as const });
    }
    return { at, resolved };
  }

  async read(sel: readonly Address[]): Promise<Snapshot> {
    const entries: Record<string, StateEntry> = {};
    const missing: Address[] = [];
    const unreachable: Address[] = [];
    // ⚠ Before the read, and it is the mark the snapshot carries — see `resolve`.
    // A stash is the thing a reversal later asks "what has happened since?", so
    // the window it opens has to START no later than the read it describes.
    // ⚠ `revision()` scans the bank on the way through, so the rows below are the
    // ones this very mark's coverage was computed from — not a second, later
    // reading that could disagree with the mark the snapshot carries.
    const at = await this.revision();
    const list = this.bank;
    // ⚠ Pointing steals the user's clip selection (E1, D6, E14-F), so anything
    // that MIGHT point has to be paid for here. That used to be `notes` alone;
    // as of the D16 amendment a `clip` read of an OCCUPIED slot points too, to
    // capture the clip's length. An empty slot still costs nothing — and must
    // not be pointed at in any case (E2).
    const selection = sel.some((a) =>
      a.kind === 'notes' || a.kind === 'clip' || a.kind === 'slot'
      || a.kind === 'clipLaunch' || a.kind === 'clipPlay')
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
      // ⚠⚠ B1c: a clip ROW past the scene window is UNREACHABLE, and this field
      // stayed silent about it for a whole phase. `unreachable` reported blind
      // TRACKS only, so a project with more scenes than the window produced a
      // clean-looking snapshot of a grid whose lower rows nothing had looked at —
      // the under-delivery D5 forbids, arriving through the very field that
      // exists to prevent it (E19, session 3c).
      if (sceneRef !== undefined) {
        const standing = this.sceneRowStanding(sceneRef);
        if (standing !== 'visible') {
          (standing === 'unreachable' ? unreachable : missing).push(address);
          continue;
        }
      }
      const trackRef = addressTrack(address);
      const row = trackRef ? list.find((t) => t.channelId === trackRef.channelId) : undefined;
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
      // ⚠ A chain-family address whose container has no observable scope is
      // UNREACHABLE, not missing — the same E5 distinction the track bank makes
      // one level up. The layer banks are init-allocated and narrow (D7), so
      // "there is no container scope at that position" is a fact about our
      // reach and never about the music.
      if (entry === 'unreachable') unreachable.push(address);
      else if (entry === undefined) missing.push(address);
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
  ): Promise<StateEntry | 'unreachable' | undefined> {
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

      case 'clipLaunch': {
        if (row === undefined) return undefined;
        const sceneIndex = address.clip.slot.scene.index;
        const status = (await this.transport.send({
          method: WIRE.slotStatus,
          params: { trackIndex: row.index, slotIndex: sceneIndex },
        })) as { hasContent: boolean };
        if (!status.hasContent) return undefined;
        const cursor = await this.pointAtClip(address.clip, row.index, pointedAt);
        const launch = (await this.transport.send({
          method: WIRE.cursorLaunchSettings, params: { cursor },
        })) as {
          launchQuantization: LaunchQuantization;
          launchMode: LaunchMode;
          useLoopStartAsQuantizationReference: boolean;
        };
        return { address, fidelity: 'exact', value: { of: 'clipLaunch', launch: {
          quantization: launch.launchQuantization,
          mode: launch.launchMode,
          useLoopStartAsQuantizationReference: launch.useLoopStartAsQuantizationReference,
        } } };
      }

      case 'clipPlay': {
        if (row === undefined) return undefined;
        const slotPlay = (await this.transport.send({
          method: WIRE.slotPlayState,
          params: { trackIndex: row.index, slotIndex: address.clip.slot.scene.index },
        })) as {
          hasContent: boolean; isPlaying: boolean; isPlaybackQueued: boolean;
          isStopQueued: boolean; playPosition: number; sampledAtMs: number;
        };
        let playingStep = -1;
        let playPosition = slotPlay.playPosition;
        let sampledAtMs = slotPlay.sampledAtMs;
        if (slotPlay.hasContent) {
          const cursor = await this.pointAtClip(address.clip, row.index, pointedAt);
          const cursorPlay = (await this.transport.send({
            method: WIRE.cursorPlayState, params: { cursor },
          })) as { playingStep: number; playPosition: number; sampledAtMs: number };
          playingStep = cursorPlay.playingStep;
          playPosition = cursorPlay.playPosition;
          sampledAtMs = cursorPlay.sampledAtMs;
        }
        const play = { ...slotPlay, playingStep, playPosition, sampledAtMs };
        return { address, fidelity: 'exact', value: { of: 'clipPlay', play } };
      }

      // ⚠⚠ A CHAIN reads back as what the container scope observed, and as
      // nothing else. There is no chain state a reversal could replay — creation
      // exists only as duplication of a chain that is already there (`e17ak`)
      // and every typed delete refuses (`e17al`, `e17am`) — so the entry is
      // `none` and `revertOps` files it unrestored.
      case 'chain': {
        if (row === undefined || !nestingObservable(address)) return undefined;
        const scope = await this.containerScope(address.container.track, address.container.chainIndex);
        if (!scope.ok) return scope.miss === 'absent' ? undefined : 'unreachable';
        const found = lookupChain(scope.container, address.name);
        // ⚠ An ambiguous name reads as NO ENTRY. The reason belongs on
        // `resolve`, which is the call made before acting; a stash is not the
        // place to discover that an address named two objects.
        return found.ok
          ? { address, fidelity: 'none', value: { of: 'chain', chain: found.chain } }
          : undefined;
      }

      case 'device': {
        if (row === undefined || !nestingObservable(address)) return undefined;
        // ⚠ A device INSIDE a chain reports its observed name and position and
        // NO PARAMETERS. The container enumeration has no parameter handle, and
        // an empty list would assert a device with no controls — a claim about
        // the instrument rather than about our reach (`DeviceState.params`).
        if (address.chain !== undefined) {
          const scope = await this.containerScope(address.chain.container.track, address.chain.container.chainIndex);
          if (!scope.ok) return scope.miss === 'absent' ? undefined : 'unreachable';
          const found = lookupNestedDevice(scope.container, address);
          return found.ok
            ? {
              address,
              fidelity: 'none',
              value: { of: 'device', device: { chainIndex: found.device.index, name: found.device.name } },
            }
            : undefined;
        }
        // ⚠⚠ A TOP-LEVEL device answers with its container structure when it has
        // an observable scope — and this is the bootstrap, not a bonus. A chain
        // is addressed by NAME, so something has to be able to say what the
        // names are, and a chain has no address of its own to be enumerated by.
        // Its container has one. Beyond the scopes the answer is `unreachable`,
        // which is the honest half of the same fact.
        //
        // ⚠ Parameters are still absent here: reading them needs the
        // device-cursor apparatus, which is Phase-4 work. `params` is optional
        // precisely so this entry can be silent about them instead of shipping
        // an empty list that reads as "no controls".
        const scope = await this.containerScope(address.track, address.chainIndex);
        if (!scope.ok) return scope.miss === 'absent' ? undefined : 'unreachable';
        if (scope.deviceName === undefined) return undefined;
        return {
          address,
          fidelity: 'none',
          value: {
            of: 'device',
            device: {
              chainIndex: address.chainIndex,
              name: scope.deviceName,
              container: scope.container,
            },
          },
        };
      }

      case 'param':
      case 'scene':
        // Param READS need the device-cursor apparatus, which is Phase-4 work.
        // Writing them already works; reading them back does not, so v0 reports
        // them missing rather than inventing a value — and a param inside a
        // chain is refused before it gets here in any case.
        return undefined;
    }
  }


  /**
   * Is each `clip.create`'s target slot free? One `slot.status` per op, before
   * the batch runs.
   *
   * ⚠ An unreadable slot maps to `true` — occupied — and therefore to a refusal.
   * The hazard it guards is one Bitwig performs SILENTLY (E21: an occupied target
   * appends a scene past the window), so "we could not look" must not resolve to
   * "go ahead".
   */
  private async readOccupancy(ops: readonly Op[]): Promise<Map<AddressKey, boolean | undefined>> {
    const seen = new Map<AddressKey, boolean | undefined>();
    for (const op of ops) {
      const slots = op.op === 'clip.create' ? [op.slot]
        : op.op === 'clip.duplicate' || op.op === 'clip.move' ? [op.source.slot, op.destination]
        : op.op === 'clip.launch' || op.op === 'clip.launchSettings' ? [op.clip.slot]
        : [];
      for (const slot of slots) {
        const key = addressKey(slot);
        if (seen.has(key)) continue;
        const trackIndex = this.index.get(slot.track.channelId);
        if (trackIndex === undefined) {
          seen.set(key, undefined);
          continue;
        }
        const status = (await this.transport.send({
          method: WIRE.slotStatus,
          params: { trackIndex, slotIndex: slot.scene.index },
        })) as { hasContent?: boolean };
        seen.set(key, status.hasContent);
      }
    }
    return seen;
  }

  async apply(batch: BatchRequest): Promise<BatchReceipt> {
    // ⚠ E15-E: refuse a write the API would accept and discard, BEFORE anything
    // is applied. Shared with the fake so both adapters refuse identically.
    assertOpsWritable(batch.ops);
    // ⚠ Before any frame, and before the mark below costs a round trip: a device
    // inside a layer chain has no measured route, and the encoder would send its
    // `chainIndex` as a position in the TRACK's top-level chain — hitting a real
    // device nobody addressed.
    assertDevicesRoutable(batch.ops);
    // ⚠ E5, standing rule 5: this is the one path that REFUSES rather than
    // reports. Tracks outside the window cannot be snapshotted, so no write is
    // safe — but `read` and `resolve` above are allowed to look and say so.
    //
    // ⚠ The mark first, because the two scene refusals below need a scene count
    // and this is the call that reads one. It scans the bank on the way through,
    // so the track check is measuring the same reading.
    const at = await this.revision();
    this.assertBankVisible(at.window.tracks);
    assertTrackRoom(batch.ops, at.window.tracks);
    // ⚠⚠ Standing rule 5's SECOND population, and both halves of it — a create
    // that would land past the scene window, and an op naming a row already past
    // it. Preconditions, before any op runs: a scene minted outside the window is
    // unaddressable and un-deletable, so "detect and fail" would run after the
    // damage (E19). Shared with the fake so neither adapter is more forgiving.
    assertSceneRoom(batch.ops, at.window.scenes);
    assertOpsAddressable(batch.ops, at.window.scenes);
    // ⚠⚠ E21, and the door the scene budget above does not cover. A
    // `clip.create` into an OCCUPIED slot is a silent `scene.create`: Bitwig
    // appends a row at the END of the project and puts the clip out there, past
    // the window, unaddressable and un-deletable. Occupancy is world state, so
    // the lookup is read here and the RULE stays in the contract.
    const occupancy = await this.readOccupancy(batch.ops);
    assertSlotsFree(batch.ops, (s) => occupancy.get(addressKey(s)));
    assertClipSources(batch.ops, (s) => occupancy.get(addressKey(s)));

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

      // Track creates and copies need the bank diffed afterwards to learn what was minted.
      const before = stage.ops.some((o) =>
        o.op === 'track.create' || o.op === 'track.duplicate')
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
        let after = (await this.scanTracks()).tracks;
        // E2c/C-minted: structural rows sometimes enter the observable bank
        // well after the measured settle. A single diff loses the durable id
        // and turns an owned row into an orphan. Poll only when this stage is
        // known to mint, and still report no mint if the bounded window expires.
        if (before !== undefined) {
          const started = Date.now();
          while (!after.some((track: WireTrack) => !before.has(track.channelId))
            && Date.now() - started < 8000) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            after = (await this.scanTracks()).tracks;
          }
        }
        if (before !== undefined) {
          const created = after.find((t: WireTrack) => !before.has(t.channelId));
          const mintingAt = stage.ops.findIndex((o) => o.op === 'track.create' || o.op === 'track.duplicate');
          const at = stage.opIndices[mintingAt];
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
