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
  AddressUnresolvedError, BankWindowOverflowError, CONTRACT_TAG, CONTRACT_VERSION, InvalidOpError,
  ContractVersionError, StaleAddressError, WireDriftError,
  addressKey, addressScene, addressTrack, assertChainActivatable, assertChainCreatable, assertChainRelocatable, assertChainRenamable, assertDeviceInsertable, assertDeviceRelocatable, assertDevicesRoutable, assertOpsAddressable, assertOpsWritable,
  assertClipSources, assertSceneRoom, assertTrackRoom, assertSlotsFree, chain as chainAt, chainCopyUnnamed,
  chainPath, chooseStepSize, clip as clipAt, contentDelta, device as deviceAt, hasUnverifiedProps, planStages,
  lookupChain, lookupNestedDevice, mintedChain, nestingObservable, verifyDeviceRelocation, verifyDeviceReorder, verifyExclusiveChain, windowCovers,
  type Address, type AddressKey, type AdapterInfo, type BatchReceipt, type BatchRequest,
  type BitwigAdapter, type ChainAddress, type ChainMiss, type ClipAddress, type ClipMetadataState, type ClipNavigationResult, type ContentDelta, type ContentEvent, type DeviceAddress, type Fidelity,
  type NoteRecord, type ObservedContainer, type ObservedDeviceSequence, type Op, type ParamState, type ResolveResult, type ResolvedAddress, type RevisionMark,
  type LaunchMode, type LaunchQuantization, type SceneAddress, type SettleBudget, type Snapshot, type StageReceipt, type StateEntry,
  type Stage, type TrackAddress, type TrackState, type WindowCoverage,
} from '../../contract/index.js';
import { SETTLE_MS } from '../../contract/index.js';
import {
  STEP_SIZES, decodeVerboseNote, encodeStage, notePageStarts, notePropertyPageStarts,
  sceneRowIn, type EncodeContext,
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

interface BatchRunResult {
  readonly applied: boolean;
  readonly rejected?: boolean;
  readonly reason?: string;
  readonly expected?: number;
  readonly actual?: number;
  readonly revision: number;
  readonly results?: readonly { method: string; ok: boolean; error?: string; result?: unknown }[];
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
  enabled?: boolean;
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
  solo?: boolean | string;
  mute?: boolean | string;
  volume?: number | string;
  pan?: number | string;
  color?: string;
  devices?: { index: number; name?: string }[];
  deviceCount?: number;
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

interface WriterView {
  readonly clipKey: AddressKey;
  readonly clip: ClipAddress;
  readonly stepSize: number;
  readonly page: number;
}

interface NoteWake {
  readonly generation: number;
  readonly afterSequence: number;
  readonly trackId: string;
  readonly trackIndex: number;
  readonly slotIndex: number;
}

interface NoteWakeRead {
  readonly dropped?: number;
  readonly firstRetainedSequence?: number;
  readonly events?: readonly {
    readonly sequence?: number;
    readonly generation?: number;
    readonly armed?: boolean;
    readonly trackId?: string;
    readonly trackIndex?: number;
    readonly slotIndex?: number;
  }[];
}

/** A device chain as one observation, with whether we could see all of it. */
interface ChainSnapshot {
  readonly devices: readonly WireDevice[];
  /** The chain is longer than the device bank window, so this view is partial. */
  readonly blind: boolean;
  readonly bankSize?: number;
}

interface WireDirectParameter {
  readonly id?: string;
  readonly name?: string;
  readonly value?: number;
  readonly displayed?: string;
}

interface WireDirectInventory {
  readonly params?: readonly WireDirectParameter[];
  readonly generation?: number;
  readonly idsGeneration?: number;
  readonly deviceExists?: boolean;
  readonly deviceName?: string;
  readonly deviceIndex?: number;
  readonly trackChannelId?: string;
  readonly trackPosition?: number;
  readonly observedTrackChannelId?: string;
  readonly observedDeviceName?: string;
  readonly observedDeviceIndex?: number;
}

type ParameterInventory =
  | {
    readonly standing: 'stable';
    readonly deviceName: string;
    readonly params: readonly ParamState[];
    readonly typed: readonly ParamState[];
  }
  | { readonly standing: 'missing' | 'unreachable' | 'ambiguous' }
  | { readonly standing: 'unstable'; readonly deviceName?: string };

type DeviceTarget =
  | { readonly standing: 'stable'; readonly deviceName: string }
  | { readonly standing: 'missing' | 'unreachable' | 'ambiguous' }
  | { readonly standing: 'unstable'; readonly deviceName?: string };

type RemoteInventory =
  | {
    readonly standing: 'stable';
    readonly deviceName: string;
    readonly remotes: import('../../contract/index.js').RemoteControlsState;
  }
  | { readonly standing: 'missing' | 'unreachable' | 'ambiguous' }
  | { readonly standing: 'unstable'; readonly deviceName?: string };

interface DeviceCursorStatus {
  readonly exists?: boolean;
  readonly name?: string;
  readonly isPinned?: boolean;
  readonly deviceIndex?: number;
  readonly trackChannelId?: string;
  readonly trackPosition?: number;
  readonly cursorTrackPinned?: boolean;
  readonly isNested?: boolean;
}

interface WireLayerInventory {
  readonly layers?: readonly {
    readonly index?: number;
    readonly name?: string;
    readonly devices?: readonly WireDevice[];
    readonly deviceCount?: number;
  }[];
  readonly itemCount?: number;
  readonly bankSize?: number;
  readonly deviceBankSize?: number;
  readonly hasLayers?: boolean;
}

interface WireDrumPadInventory {
  readonly pads?: readonly { readonly index?: number; readonly name?: string }[];
  readonly itemCount?: number;
  readonly bankSize?: number;
  readonly hasDrumPads?: boolean;
}

interface WireRemoteControl {
  readonly index?: number;
  readonly exists?: boolean;
  readonly name?: string;
  readonly value?: number;
  readonly modulatedValue?: number;
  readonly isBeingMapped?: boolean;
  readonly hasAutomation?: boolean;
}

interface WireRemotePage {
  readonly pages?: readonly WireBoundedRemotePage[];
  readonly pageBankSize?: number;
  readonly pagesComplete?: boolean;
  readonly remotes?: readonly WireRemoteControl[];
  readonly existing?: number;
  readonly bankSize?: number;
  readonly pageCount?: number;
  readonly selectedPageIndex?: number;
  readonly selectedPageName?: string;
  readonly pageNames?: readonly string[];
  readonly deviceExists?: boolean;
  readonly deviceName?: string;
  readonly isNested?: boolean;
  readonly generation?: number;
  readonly observedGeneration?: number;
  readonly observedTrackChannelId?: string;
  readonly observedDeviceName?: string;
  readonly observedDeviceIndex?: number;
}

interface WireBoundedRemotePage {
  readonly index?: number;
  readonly name?: string;
  readonly remotes?: readonly WireRemoteControl[];
  readonly existing?: number;
  readonly bankSize?: number;
  readonly selectedPageIndex?: number;
  readonly observedGeneration?: number;
  readonly observedTrackChannelId?: string;
  readonly observedDeviceName?: string;
  readonly observedDeviceIndex?: number;
}

interface WireDirectCompletion {
  readonly generation?: number;
  readonly observedGeneration?: number;
  readonly id?: string;
  readonly value?: number;
  readonly trackChannelId?: string;
  readonly deviceName?: string;
  readonly deviceIndex?: number;
  readonly currentTrackChannelId?: string;
  readonly currentDeviceName?: string;
  readonly currentDeviceIndex?: number;
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

/**
 * What one look into a container position returned — an observation, or the
 * reason there was not one.
 *
 * ⚠ Named rather than inlined because the create carries it ACROSS the write:
 * the diff that identifies the new chain compares a reading from before the copy
 * against one from after, and a "before" that was really a miss must not be
 * silently treated as an empty container. The union makes that unrepresentable.
 */
type ContainerScope =
  | { ok: true; container: ObservedContainer; deviceName: string | undefined }
  | { ok: false; miss: ChainMiss };

interface RelocationSequence extends ObservedDeviceSequence {
  readonly bankSize?: number;
}

interface RelocationReading {
  readonly source: RelocationSequence;
  readonly destination: RelocationSequence;
}

/** Where the user's own clip selection was before we borrowed it (E1, D6). */
interface SelectionState {
  readonly trackIndex: number;
  readonly slotIndex: number;
}

/** Eight attempts keep target and dual-pin confirmation bounded. */
const CLIP_POINT_ATTEMPTS = 8;
/** About two seconds after paramsLive for large plugin observer generations. */
const PARAMETER_INVENTORY_ATTEMPTS = 80;
/** Re-arm an observer that does not complete within its bounded generation. */
const PARAMETER_INVENTORY_ACQUISITIONS = 3;

interface ClipCursorStatus {
  readonly trackPosition?: number;
  readonly sceneIndex?: number;
  readonly isPinned?: boolean;
  readonly cursorTrackPinned?: boolean;
}

/** One exact, reconciled note reading for all 16 MIDI channels in a clip. */
type ClipNoteChannels = ReadonlyMap<number, readonly NoteRecord[]>;

interface WireVerboseChannel {
  readonly channel: number;
  readonly notes: readonly Record<string, number | boolean | string>[];
  readonly count: number;
}

interface WireVerboseAllChannels {
  readonly channels: readonly WireVerboseChannel[];
  readonly count: number;
  readonly scanMicros: number;
  readonly clipExists?: boolean;
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
const RIG_DEFAULT_SCENES = 128;

export interface LiveOptions {
  readonly transport?: Transport;
  /**
   * How many pool cursors to allocate across. Learned from `rig.info` at
   * `hello()` when omitted; the rig pre-allocates them at init (E1, D7).
   */
  readonly cursorPool?: number;
  /**
   * Exact cursor references this adapter may use.
   *
   * A focused live harness can partition the rig into a writer and an
   * independent witness. When set, `hello()` does not replace this partition
   * with the rig's full cursor pool.
   */
  readonly cursorRefs?: readonly string[];
  /**
   * Dedicated cursor for exact note reads.
   *
   * Set this to `fine` in a focused harness that must keep its read handle
   * separate from its write handles. A normal session selects `fine` after
   * `hello()` learns that the extension provides the fine cursor.
   */
  readonly noteReadCursorRef?: 'fine';
  /**
   * How wide the scene bank window is. Learned from `rig.info` at `hello()` when
   * omitted; like the cursor pool it is fixed at the rig's `init()` (D7), which
   * is why it can be cached at all.
   */
  readonly sceneBankSize?: number;
  /** Expected wire methodsHash from extension/methods.golden.json, if checking. */
  readonly expectMethodsHash?: string;
  /** Optional phase timing for focused performance probes. */
  readonly onTiming?: (event: LiveTimingEvent) => void;
}

export interface LiveTimingEvent {
  readonly phase:
    | 'targetAcquisition'
    | 'metadata'
    | 'gridSettlement'
    | 'pageTurn'
    | 'bulkPageRead'
    | 'reconciliation'
    | 'pageReset'
    | 'selectionRestoration'
    | 'observerArm'
    | 'firstCallback'
    | 'observerFallback';
  readonly elapsedMs: number;
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
  'device.relocate', 'chain.relocate',
  // ⚠ `chain.create` is deliberately NOT here, and the omission is a claim: it
  // re-indexes a container's LAYER bank and nothing else. No track bank row
  // moves, no scene row moves, and the track's own device chain is untouched —
  // so no pool cursor assignment and no held `channelId` index goes stale. The
  // one thing it does invalidate is a chain's bank position, which no address
  // holds and which `readContainers` re-reads for every batch anyway.
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
  || op.op === 'clip.update'
  || op.op === 'device.insert' || op.op === 'device.delete' || op.op === 'device.setEnabled'
  || op.op === 'device.relocate' || op.op === 'param.set'
  || op.op === 'remote.set'
  // ⚠ `chain.create` borrows it TWICE over: `containerScope` points cursor 0 at
  // the track before every observation it takes, and the create takes three.
  // ⚠⚠ And the verb's own middle step is a SELECTION — `layer.select` is how
  // `Channel.duplicate()` knows which chain to copy (`e17ak`), so this op moves
  // the user's device-layer selection as well as their clip selection. Only the
  // clip half is restorable today: `selection.status` reports a track/slot pair
  // and nothing on the wire reads back which chain a human had selected. Named
  // here so the gap is on the record rather than discovered as a complaint.
  || op.op === 'chain.create'
  || op.op === 'chain.relocate'
  || op.op === 'chain.activate'
  || op.op === 'clip.launchSettings';

/** Does reading or resolving this address move a pool cursor? */
const addressBorrowsSelection = (address: Address): boolean =>
  address.kind === 'notes' || address.kind === 'clip' || address.kind === 'slot'
  || address.kind === 'clipLaunch' || address.kind === 'clipPlay' || address.kind === 'clipMetadata'
  || address.kind === 'device' || address.kind === 'deviceEnabled' || address.kind === 'param'
  || address.kind === 'remotes' || address.kind === 'remote' || address.kind === 'drumPad'
  || address.kind === 'chain';

export class LiveAdapter implements BitwigAdapter {
  private readonly transport: Transport;
  private readonly expectMethodsHash: string | undefined;
  private readonly onTiming: ((event: LiveTimingEvent) => void) | undefined;
  /** Allocated at `hello()` from the rig's real pool size; see `pool.ts`. */
  private pool: CursorPool;
  /** The caller supplied an exact cursor partition that `hello()` must keep. */
  private readonly fixedCursorRefs: boolean;

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
   * ⚠ Chain `addressKey` -> the bank position the last observation reported —
   * filled by `apply`'s preconditions and read by the encoder, and by nothing
   * else.
   *
   * Deliberately short-lived and deliberately narrow. It is not a cache and must
   * never become one: a chain's position is not part of its address, a container
   * re-indexes when a chain is added or removed, and the one moment a position
   * is trustworthy is the turn its container was observed in. `apply` clears it
   * on the way in so no batch can inherit another's.
   */
  private chainPositions = new Map<AddressKey, number>();
  /** Chain address -> within-turn identity from the same fresh observation. */
  private chainIds = new Map<AddressKey, string>();
  /** Device names from the relocation reading immediately preceding the wire call. */
  private deviceNames = new Map<AddressKey, string>();
  /** Device enabled values from the read immediately before one scalar write. */
  private deviceEnabledValues = new Map<AddressKey, boolean>();
  /** Complete device-name sequences read in the turn before a device mutation. */
  private deviceChainNames = new Map<string, readonly string[]>();
  /** Enabled flags aligned with the complete device-name reading. */
  private deviceChainEnabled = new Map<string, readonly boolean[]>();
  /** Tail-relative reorder source -> absolute position from the same fresh reading. */
  private deviceTailIndices = new Map<string, number>();

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
  /** The writer cursor width, learned at hello(). */
  private fineSteps: number | undefined;
  /** The dedicated exact-note reader width, learned at hello(). */
  private noteReadSteps: number | undefined;
  /** A dedicated cursor for dual-grid note reads. */
  private noteReadCursorRef: 'fine' | undefined;
  /** True when a harness selected the note-read cursor. */
  private readonly fixedNoteReadCursorRef: boolean;
  /** Top-level device-bank width, fixed at extension init. */
  private deviceBankSize: number | undefined;
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
  /** One shared selection scope for overlapping or composed executor pipelines. */
  private selectionScope:
    | {
      saved: SelectionState | undefined;
      borrowed: boolean;
      capture: Promise<SelectionState | undefined> | undefined;
      users: number;
    }
    | undefined;
  /** A completed scope must finish its UI restore before a new scope can start. */
  private selectionRestore: Promise<void> | undefined;
  /** Cursor ref -> clip target confirmed by live cursor readback. */
  private readonly heldClips = new Map<string, AddressKey>();
  /** One armed single-clip wake. Exact bulk readback remains the proof. */
  private pendingNoteWake: NoteWake | undefined;
  /** One confirmed device cursor is the complete DirectParameter route. */
  private parameterQueue: Promise<void> = Promise.resolve();

  constructor(options: LiveOptions = {}) {
    this.transport = options.transport ?? new BridgeTransport();
    this.expectMethodsHash = options.expectMethodsHash;
    this.onTiming = options.onTiming;
    // A pool of one until `hello()` learns the rig's real size — which is the
    // Phase-0 behaviour exactly, so an adapter used before the handshake is no
    // worse than it was, merely no better.
    this.fixedCursorRefs = options.cursorRefs !== undefined;
    this.pool = new CursorPool(options.cursorRefs ?? options.cursorPool ?? 1);
    this.fixedNoteReadCursorRef = options.noteReadCursorRef !== undefined;
    this.noteReadCursorRef = options.noteReadCursorRef;
    this.sceneBankSize = options.sceneBankSize ?? RIG_DEFAULT_SCENES;
  }

  private async timed<T>(phase: LiveTimingEvent['phase'], work: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await work();
    } finally {
      this.onTiming?.({ phase, elapsedMs: performance.now() - start });
    }
  }

  /** Serialize work through the one DirectParameter cursor. */
  private withParameterCursor<T>(work: () => Promise<T>): Promise<T> {
    const run = this.parameterQueue.then(work, work);
    this.parameterQueue = run.then(() => undefined, () => undefined);
    return run;
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
      fineSteps?: number;
      noteReadSteps?: number;
      cursorPool?: number;
      scenes?: number;
      deviceBank?: number;
    };
    this.gridSteps = rig.gridSteps;
    this.fineSteps = rig.fineSteps;
    this.noteReadSteps = rig.noteReadSteps ?? rig.fineSteps;
    if (!this.fixedNoteReadCursorRef && !this.fixedCursorRefs && this.noteReadSteps !== undefined) {
      this.noteReadCursorRef = 'fine';
    }
    this.deviceBankSize = rig.deviceBank;
    // The rig allocates its cursor pool at init and cannot grow it afterwards
    // (D7 — allocation is init-only and enforced), so this is the real ceiling.
    if (!this.fixedCursorRefs && rig.cursorPool !== undefined) {
      this.pool = new CursorPool(rig.cursorPool);
    }
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
      shouldPointClip: (clipRef, cursor) => {
        const held = this.heldClips.get(cursor) === addressKey(clipRef);
        if (!held) this.heldClips.delete(cursor);
        return !held;
      },
      writerSteps: this.fineSteps ?? this.gridSteps ?? 64,
      cursorForTrack: (t) => {
        const cursor = this.pool.cursorForTrack(t);
        this.heldClips.delete(cursor);
        return cursor;
      },
      trackIndex: (t) => this.trackIndex(t),
      chainIndex: (c) => this.chainIndex(c),
      chainId: (c) => this.chainId(c),
      deviceName: (d) => {
        const name = this.deviceNames.get(addressKey(d));
        if (name === undefined) throw new AddressUnresolvedError(d, 'no fresh structural reading named this device');
        return name;
      },
      deviceEnabled: (d) => {
        const enabled = this.deviceEnabledValues.get(addressKey(d));
        if (enabled === undefined) {
          throw new AddressUnresolvedError(d, 'no fresh structural reading observed the device enabled flag');
        }
        return enabled;
      },
      deviceChainNames: (trackRef) => {
        const names = this.deviceChainNames.get(trackRef.channelId);
        if (names === undefined) {
          throw new AddressUnresolvedError(trackRef, 'no fresh complete device-chain reading is available');
        }
        return names;
      },
      deviceChainEnabled: (trackRef) => {
        const enabled = this.deviceChainEnabled.get(trackRef.channelId);
        if (enabled === undefined) {
          throw new AddressUnresolvedError(trackRef, 'no fresh complete device-enabled reading is available');
        }
        return enabled;
      },
      deviceTailIndex: (trackRef, fromEnd, expectedName) => {
        const key = `${trackRef.channelId}\u0000${fromEnd}\u0000${expectedName}`;
        const index = this.deviceTailIndices.get(key);
        if (index === undefined) {
          throw new AddressUnresolvedError(trackRef, 'no fresh structural reading resolved the tail device');
        }
        return index;
      },
      sceneRow: sceneRowIn(this.sceneWindow),
    };
  }

  /**
   * The bank position an observation THIS BATCH took reported for this chain.
   *
   * ⚠ It refuses rather than resolving on demand, and the refusal is the design.
   * A chain's position is not part of its address and cannot be derived from
   * one; the only honest source is a `chain.inventory` reply, and re-reading one
   * here would be a second observation the guards did not check — so a position
   * that was never recorded means the op reached the encoder without its
   * precondition, which is a bug rather than a slow path.
   */
  private chainIndex(chainRef: ChainAddress): number {
    const at = this.chainPositions.get(addressKey(chainRef));
    if (at === undefined) {
      throw new AddressUnresolvedError(
        chainRef,
        `no observation of this container recorded a chain named "${chainRef.name}"`,
      );
    }
    return at;
  }

  private chainId(chainRef: ChainAddress): string {
    const id = this.chainIds.get(addressKey(chainRef));
    if (id === undefined) {
      throw new AddressUnresolvedError(
        chainRef,
        `no fresh observation recorded an identity for chain "${chainRef.name}"`,
      );
    }
    return id;
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
    this.heldClips.delete(cursor);
    await this.transport.send({ method: WIRE.cursorPointTrack, params: { cursor, trackIndex } });
    await this.settle('cursorPoint');
    const res = (await this.transport.send({
      method: WIRE.deviceList,
      params: { cursor },
    })) as {
      devices?: WireDevice[];
      count?: number;
      itemCount?: number;
      trackChannelId?: string;
      bankSize?: number;
    };
    const devices = res.devices ?? [];
    // ⚠ E5's rule, one level down. `deviceList` walks `rig.config.deviceBank`
    // slots while `itemCount` is the CHAIN's true length, so a chain longer than
    // the bank window is partially visible — and a diff over a partial view
    // cannot tell an insert from something scrolling into frame. Looking is
    // allowed; concluding from a half-view is not.
    const bankSize = res.bankSize ?? this.deviceBankSize;
    const contiguous = devices.every((device, index) => device.index === index);
    const complete = res.trackChannelId === trackRef.channelId
      && Number.isInteger(res.itemCount) && res.itemCount! >= 0
      && res.itemCount === devices.length
      && res.count === devices.length
      && bankSize !== undefined && devices.length <= bankSize
      && contiguous;
    return { devices, blind: !complete, ...(bankSize === undefined ? {} : { bankSize }) };
  }

  /** Accept completeness only after two equal consecutive device-bank replies. */
  private async stableDeviceChain(trackRef: TrackAddress): Promise<ChainSnapshot | undefined> {
    const first = await this.deviceChain(trackRef);
    const second = await this.deviceChain(trackRef);
    if (first === undefined || second === undefined) return undefined;
    const same = JSON.stringify(first.devices) === JSON.stringify(second.devices)
      && first.bankSize === second.bankSize;
    return { ...second, blind: first.blind || second.blind || !same };
  }

  /** Validate one caller-owned full-chain boundary before a device mutation. */
  private guardedDeviceNames(
    trackRef: TrackAddress,
    observed: ChainSnapshot | undefined,
    expected: readonly string[] | undefined,
    expectedEnabled: readonly boolean[] | undefined,
    op: Op['op'],
  ): readonly string[] {
    if (observed === undefined || observed.blind) {
      throw new AddressUnresolvedError(
        trackRef,
        'the complete top-level device chain is unavailable at the mutation boundary',
      );
    }
    const actual = observed.devices.map((item) => item.name);
    if (expected !== undefined
        && (actual.length !== expected.length
          || actual.some((name, index) => name !== expected[index]))) {
      throw new InvalidOpError(
        op,
        `the top-level device chain changed: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      );
    }
    const actualEnabled = observed.devices.map((item) => item.enabled);
    if (expectedEnabled !== undefined
        && (expected === undefined
          || expectedEnabled.length !== expected.length
          || actualEnabled.some((enabled, index) => enabled !== expectedEnabled[index]))) {
      throw new InvalidOpError(
        op,
        `the top-level device enabled chain changed: expected ${JSON.stringify(expectedEnabled)}, got ${JSON.stringify(actualEnabled)}`,
      );
    }
    if (expectedEnabled !== undefined) {
      this.deviceChainEnabled.set(trackRef.channelId, expectedEnabled);
    } else if (actualEnabled.every((enabled): enabled is boolean => enabled !== undefined)) {
      this.deviceChainEnabled.set(trackRef.channelId, actualEnabled);
    }
    return expected ?? actual;
  }

  /** Point the serialized device cursor through one confirmed recursive path. */
  private async acquireDeviceTarget(device: DeviceAddress, row: WireTrack): Promise<DeviceTarget> {
    const path = chainPath(device);
    if (path.length > 2) return { standing: 'unreachable' };

    // Force every cursor-bound observer to leave the prior target first.
    const detour = this.bank.find((candidate) => candidate.channelId !== device.track.channelId);
    if (detour !== undefined) {
      await this.transport.send({ method: WIRE.cursorPinTrack, params: { cursor: '0', pinned: false } });
      await this.transport.send({ method: WIRE.deviceCursorPin, params: { pinned: false } });
      await this.transport.send({
        method: WIRE.cursorPointTrack, params: { cursor: '0', trackIndex: detour.index },
      });
      let confirmed = false;
      for (let attempt = 0; attempt < CLIP_POINT_ATTEMPTS; attempt++) {
        await this.settle('cursorPoint');
        const status = await this.transport.send({ method: WIRE.deviceCursorStatus }) as DeviceCursorStatus;
        confirmed = status.trackChannelId === detour.channelId
          && status.trackPosition === detour.index;
        if (confirmed) break;
      }
      if (!confirmed) return { standing: 'unstable' };
      await this.settle('paramsLive');
    }

    await this.transport.send({ method: WIRE.cursorPinTrack, params: { cursor: '0', pinned: false } });
    await this.transport.send({ method: WIRE.deviceCursorPin, params: { pinned: false } });
    await this.transport.send({
      method: WIRE.cursorPointTrack, params: { cursor: '0', trackIndex: row.index },
    });

    type ParameterDeviceList = {
      readonly devices?: readonly WireDevice[];
      readonly itemCount?: number;
      readonly trackChannelId?: string;
    };
    let top: ParameterDeviceList | undefined;
    for (let attempt = 0; attempt < CLIP_POINT_ATTEMPTS; attempt++) {
      await this.settle('cursorPoint');
      const observed = await this.transport.send({
        method: WIRE.deviceList, params: { cursor: '0' },
      }) as ParameterDeviceList;
      if (observed.trackChannelId === device.track.channelId) {
        top = observed;
        break;
      }
    }
    if (top === undefined) return { standing: 'unstable' };

    const topAddress = path[0]?.container ?? device;
    if (topAddress.chain !== undefined) return { standing: 'unstable' };
    const topDevices = top.devices ?? [];
    const topTarget = topDevices.find((item) => item.index === topAddress.chainIndex);
    if (topTarget === undefined) {
      const blind = typeof top.itemCount === 'number' && top.itemCount > topDevices.length;
      return { standing: blind ? 'unreachable' : 'missing' };
    }
    await this.transport.send({
      method: WIRE.deviceCursorSelectAt, params: { deviceIndex: topAddress.chainIndex },
    });

    let targetName = topTarget.name;
    for (const [at, step] of path.entries()) {
      const nestedAddress = path[at + 1]?.container ?? device;
      if (nestedAddress.chain === undefined
          || addressKey(nestedAddress.chain) !== addressKey(step)) {
        return { standing: 'unstable', deviceName: targetName };
      }
      await this.settle('cursorPoint');
      const parentStatus = await this.transport.send({ method: WIRE.deviceCursorStatus }) as DeviceCursorStatus;
      if (parentStatus.exists !== true || parentStatus.name !== targetName
          || parentStatus.trackChannelId !== device.track.channelId
          || parentStatus.trackPosition !== row.index
          || parentStatus.deviceIndex !== step.container.chainIndex) {
        return { standing: 'unstable', deviceName: targetName };
      }

      if (step.kind === 'drumPad') {
        if (nestedAddress.chainIndex !== 0) return { standing: 'unreachable' };
        const pads = await this.transport.send({ method: WIRE.drumPadList }) as WireDrumPadInventory;
        if (typeof pads.bankSize !== 'number' || step.channel >= pads.bankSize) {
          return { standing: 'unreachable' };
        }
        const pad = (pads.pads ?? []).find((item) => item.index === step.channel);
        if (pad === undefined) return { standing: 'missing' };
        await this.transport.send({
          method: WIRE.deviceCursorSelectFirstInPad, params: { padIndex: step.channel },
        });
        targetName = '';
      } else {
        const inventory = await this.transport.send({ method: WIRE.layerList }) as WireLayerInventory;
        const layers = inventory.layers ?? [];
        const complete = typeof inventory.itemCount === 'number'
          && typeof inventory.bankSize === 'number'
          && inventory.itemCount <= inventory.bankSize;
        if (!complete) return { standing: 'unreachable' };
        const matches = layers.filter((item) => item.name === step.name);
        if (matches.length > 1) return { standing: 'ambiguous' };
        const layer = matches[0];
        if (layer === undefined) {
          return { standing: 'missing' };
        }
        const devices = layer.devices ?? [];
        const nested = devices.find((item) => item.index === nestedAddress.chainIndex);
        if (nested === undefined) {
          const complete = typeof layer.deviceCount === 'number'
            && typeof inventory.deviceBankSize === 'number'
            && layer.deviceCount <= inventory.deviceBankSize;
          return { standing: complete ? 'missing' : 'unreachable' };
        }
        if (!Number.isInteger(layer.index)) return { standing: 'unstable', deviceName: targetName };
        await this.transport.send({
          method: WIRE.deviceCursorSelectInLayer,
          params: { layerIndex: layer.index, deviceIndex: nestedAddress.chainIndex },
        });
        targetName = nested.name;
      }

      let descended = false;
      for (let attempt = 0; attempt < CLIP_POINT_ATTEMPTS; attempt++) {
        await this.settle('cursorPoint');
        const status = await this.transport.send({ method: WIRE.deviceCursorStatus }) as DeviceCursorStatus;
        const nameMatches = targetName === ''
          ? status.exists === true && typeof status.name === 'string' && status.name.length > 0
          : status.name === targetName;
        descended = nameMatches && status.isNested === true
          && status.trackChannelId === device.track.channelId
          && status.trackPosition === row.index
          && status.deviceIndex === nestedAddress.chainIndex;
        if (descended) {
          targetName = status.name!;
          break;
        }
      }
      if (!descended) return { standing: 'unstable', deviceName: targetName || undefined };
    }

    await this.transport.send({ method: WIRE.cursorPinTrack, params: { cursor: '0', pinned: true } });
    await this.transport.send({ method: WIRE.deviceCursorPin, params: { pinned: true } });
    let pinned = false;
    for (let attempt = 0; attempt < CLIP_POINT_ATTEMPTS; attempt++) {
      await this.settle('cursorPoint');
      const status = await this.transport.send({ method: WIRE.deviceCursorStatus }) as DeviceCursorStatus;
      pinned = status.exists === true && status.name === targetName
        && status.trackChannelId === device.track.channelId && status.trackPosition === row.index
        && status.isPinned === true && status.cursorTrackPinned === true
        && status.deviceIndex === device.chainIndex;
      if (pinned) break;
    }
    return pinned
      ? { standing: 'stable', deviceName: targetName }
      : { standing: 'unstable', deviceName: targetName };
  }

  /**
   * Resolve, point and confirm one top-level device before reading observers.
   * A generation reset removes every id and value from the prior target.
   */
  private parameterInventory(
    device: DeviceAddress,
    row: WireTrack,
  ): Promise<ParameterInventory> {
    return this.withParameterCursor(async () => {
      let last: ParameterInventory = { standing: 'unstable' };
      for (let acquisition = 0;
        acquisition < PARAMETER_INVENTORY_ACQUISITIONS;
        acquisition++) {
        last = await this.parameterInventoryAttempt(device, row);
        if (last.standing !== 'unstable') return last;
      }
      return last;
    });
  }

  /** Read one target-bound observer generation without changing project state. */
  private async parameterInventoryAttempt(
    device: DeviceAddress,
    row: WireTrack,
  ): Promise<ParameterInventory> {
      const begun = await this.transport.send({
        method: WIRE.directParamList,
        params: { begin: true },
      }) as WireDirectInventory;
      if (!Number.isInteger(begun.generation)) return { standing: 'unstable' };
      const generation = begun.generation!;
      const target = await this.acquireDeviceTarget(device, row);
      if (target.standing !== 'stable') return target;

      // DirectParameter observers can follow the device cursor more slowly than
      // its identity fields. Give them the measured live budget before polling.
      await this.settle('paramsLive');

      let prior: string | undefined;
      for (let attempt = 0; attempt < PARAMETER_INVENTORY_ATTEMPTS; attempt++) {
        const observed = await this.transport.send({
          method: WIRE.directParamList,
          params: { generation },
        }) as WireDirectInventory;
        const rows = observed.params ?? [];
        const complete = observed.generation === generation
          && observed.idsGeneration === generation
          && observed.deviceExists === true
          && observed.deviceName === target.deviceName
          && (device.chain !== undefined || observed.deviceIndex === device.chainIndex)
          && observed.trackChannelId === device.track.channelId
          && observed.trackPosition === row.index
          && observed.observedTrackChannelId === device.track.channelId
          && observed.observedDeviceName === target.deviceName
          && (observed.observedDeviceIndex === undefined
            || observed.observedDeviceIndex < 0
            || observed.observedDeviceIndex === device.chainIndex)
          && new Set(rows.map((item) => item.id)).size === rows.length
          && rows.every((item) => typeof item.id === 'string'
            && typeof item.name === 'string'
            && typeof item.value === 'number'
            && Number.isFinite(item.value)
            && item.value >= 0
            && item.value <= 1);
        if (complete) {
          const params = rows.map((item): ParamState => ({
            id: item.id!,
            name: item.name!,
            value: item.value!,
            observed: {
              display: typeof item.displayed === 'string',
              modulatedValue: false,
              hasAutomation: false,
              origin: false,
              discreteValueCount: false,
              discreteValueNames: false,
            },
            ...(typeof item.displayed === 'string' ? { display: item.displayed } : {}),
          }));
          const signature = JSON.stringify(params);
          if (signature === prior) {
            const typedReply = await this.transport.send({ method: WIRE.paramList }) as {
              readonly params?: readonly {
                readonly id?: string;
                readonly exists?: boolean;
                readonly name?: string;
                readonly value?: number;
                readonly displayed?: string;
                readonly modulatedValue?: number;
                readonly hasAutomation?: boolean;
                readonly origin?: number;
                readonly discreteValueCount?: number;
                readonly discreteValueNames?: readonly string[];
              }[];
            };
            const typed = (typedReply.params ?? []).flatMap((item, index): ParamState[] => {
              if (item.exists !== true || typeof item.id !== 'string'
                  || typeof item.name !== 'string' || typeof item.value !== 'number') return [];
              return [{
                id: item.id,
                index,
                name: item.name,
                value: item.value,
                observed: {
                  display: typeof item.displayed === 'string',
                  modulatedValue: typeof item.modulatedValue === 'number',
                  hasAutomation: typeof item.hasAutomation === 'boolean',
                  origin: typeof item.origin === 'number',
                  discreteValueCount: typeof item.discreteValueCount === 'number',
                  discreteValueNames: Array.isArray(item.discreteValueNames)
                    && item.discreteValueNames.every((name) => typeof name === 'string'),
                },
                ...(typeof item.displayed === 'string' ? { display: item.displayed } : {}),
                ...(typeof item.modulatedValue === 'number'
                  ? { modulatedValue: item.modulatedValue } : {}),
                ...(typeof item.hasAutomation === 'boolean'
                  ? { hasAutomation: item.hasAutomation } : {}),
                ...(typeof item.origin === 'number' ? { origin: item.origin } : {}),
                ...(typeof item.discreteValueCount === 'number'
                  ? { discreteValueCount: item.discreteValueCount } : {}),
                ...(Array.isArray(item.discreteValueNames)
                    && item.discreteValueNames.every((name) => typeof name === 'string')
                  ? { discreteValueNames: item.discreteValueNames } : {}),
              }];
            });
            const typedById = new Map<string, ParamState>();
            for (const item of typed) {
              typedById.set(item.id, item);
              typedById.set(`CONTENTS/${item.id}`, item);
            }
            const enriched = params.map((item): ParamState => {
              const supplement = typedById.get(item.id);
              if (supplement === undefined) return item;
              return {
                ...item,
                observed: {
                  display: item.observed.display || supplement.observed.display,
                  modulatedValue: supplement.observed.modulatedValue,
                  hasAutomation: supplement.observed.hasAutomation,
                  origin: supplement.observed.origin,
                  discreteValueCount: supplement.observed.discreteValueCount,
                  discreteValueNames: supplement.observed.discreteValueNames,
                },
                ...(item.display !== undefined
                  ? { display: item.display }
                  : supplement.display === undefined ? {} : { display: supplement.display }),
                ...(supplement.modulatedValue === undefined
                  ? {} : { modulatedValue: supplement.modulatedValue }),
                ...(supplement.hasAutomation === undefined
                  ? {} : { hasAutomation: supplement.hasAutomation }),
                ...(supplement.origin === undefined ? {} : { origin: supplement.origin }),
                ...(supplement.discreteValueCount === undefined
                  ? {} : { discreteValueCount: supplement.discreteValueCount }),
                ...(supplement.discreteValueNames === undefined
                  ? {} : { discreteValueNames: supplement.discreteValueNames }),
              };
            });
            return { standing: 'stable', deviceName: target.deviceName, params: enriched, typed };
          }
          prior = signature;
        } else {
          prior = undefined;
        }
        await this.settle('cursorPoint');
      }
      return { standing: 'unstable', deviceName: target.deviceName };
  }

  private parameterState(
    address: import('../../contract/index.js').ParamAddress,
    inventory: Extract<ParameterInventory, { standing: 'stable' }>,
  ): ParamState | undefined {
    return address.directId !== undefined
      ? inventory.params.find((item) => item.id === address.directId)
      : inventory.typed.find((item) => item.index === address.index);
  }

  /** Confirm one direct write from its exact value callback on the held target. */
  private async directParameterCompletion(
    address: import('../../contract/index.js').ParamAddress,
    deviceName: string,
    generation: number,
    requested: number,
  ): Promise<ParamState | undefined> {
    if (address.directId === undefined) return undefined;
    let prior: string | undefined;
    for (let attempt = 0; attempt < CLIP_POINT_ATTEMPTS; attempt++) {
      const observed = await this.transport.send({
        method: WIRE.directParamCompletion,
      }) as WireDirectCompletion;
      const complete = observed.generation === generation
        && observed.observedGeneration === generation
        && observed.id === address.directId
        && typeof observed.value === 'number' && Number.isFinite(observed.value)
        && observed.trackChannelId === address.device.track.channelId
        && observed.deviceName === deviceName
        && observed.deviceIndex === address.device.chainIndex
        && observed.currentTrackChannelId === address.device.track.channelId
        && observed.currentDeviceName === deviceName
        && observed.currentDeviceIndex === address.device.chainIndex
        && Math.abs(observed.value - requested) <= 2e-3;
      if (complete) {
        const signature = JSON.stringify(observed);
        if (signature === prior) {
          return {
            id: address.directId,
            name: '',
            value: observed.value!,
            observed: {
              display: false,
              modulatedValue: false,
              hasAutomation: false,
              origin: false,
              discreteValueCount: false,
              discreteValueNames: false,
            },
          };
        }
        prior = signature;
      } else {
        prior = undefined;
      }
      await this.settle('cursorPoint');
    }
    return undefined;
  }

  /** Enumerate the complete configured remote-page window in one bounded reply. */
  private remoteInventory(device: DeviceAddress, row: WireTrack): Promise<RemoteInventory> {
    return this.withParameterCursor(async () => {
      // Confirm and pin the target before resetting the remote generation. If
      // this cursor already names the target, selecting it again emits no page
      // callback. The extension seeds the new generation from this confirmed
      // current state.
      const target = await this.acquireDeviceTarget(device, row);
      if (target.standing !== 'stable') return target;
      const begun = await this.transport.send({
        method: WIRE.remoteList,
        params: { begin: true },
      }) as WireRemotePage;
      if (!Number.isInteger(begun.generation)) return { standing: 'unstable' };
      const generation = begun.generation!;
      await this.settle('paramsLive');

      let prior: string | undefined;
      for (let attempt = 0; attempt < CLIP_POINT_ATTEMPTS; attempt++) {
        const observed = await this.transport.send({ method: WIRE.remoteList }) as WireRemotePage;
        const pageNames = observed.pageNames ?? [];
        const wirePages = observed.pages ?? [];
        const pages = wirePages.flatMap((wirePage): import('../../contract/index.js').RemotePageState[] => {
          const rows = wirePage.remotes ?? [];
          const controls = rows.flatMap((item): import('../../contract/index.js').RemoteControlState[] => {
            if (item.exists !== true || !Number.isInteger(item.index)
                || typeof item.name !== 'string' || item.name.trim() === ''
                || typeof item.value !== 'number' || !Number.isFinite(item.value)
                || item.value < 0 || item.value > 1
                || typeof item.modulatedValue !== 'number' || !Number.isFinite(item.modulatedValue)
                || typeof item.isBeingMapped !== 'boolean') return [];
            return [{
              index: item.index!,
              name: item.name,
              value: item.value,
              modulatedValue: item.modulatedValue,
              isBeingMapped: item.isBeingMapped,
              ...(typeof item.hasAutomation === 'boolean'
                ? { hasAutomation: item.hasAutomation } : {}),
            }];
          });
          const bankComplete = Number.isInteger(wirePage.bankSize) && wirePage.bankSize! >= 0
            && rows.length === wirePage.bankSize
            && rows.every((item, index) => item.index === index
              && typeof item.exists === 'boolean');
          const pageIndex = wirePage.index;
          const pageName = Number.isInteger(pageIndex) ? pageNames[pageIndex!] : undefined;
          const complete = Number.isInteger(pageIndex)
            && typeof pageName === 'string' && pageName.trim() !== ''
            && wirePage.name === pageName
            && wirePage.selectedPageIndex === pageIndex
            && wirePage.observedGeneration === generation
            && wirePage.observedTrackChannelId === device.track.channelId
            && wirePage.observedDeviceName === target.deviceName
            && wirePage.observedDeviceIndex === device.chainIndex
            && bankComplete
            && Number.isInteger(wirePage.existing)
            && controls.length === wirePage.existing;
          return complete ? [{ index: pageIndex!, name: pageName, controls }] : [];
        });
        const complete = observed.generation === generation
          && observed.observedGeneration === generation
          && observed.observedTrackChannelId === device.track.channelId
          && observed.observedDeviceName === target.deviceName
          && observed.observedDeviceIndex === device.chainIndex
          && observed.deviceExists === true
          && observed.deviceName === target.deviceName
          && observed.pagesComplete === true
          && Number.isInteger(observed.pageBankSize)
          && Number.isInteger(observed.pageCount)
          && observed.pageCount === pageNames.length
          && observed.pageCount! <= observed.pageBankSize!
          && pageNames.every((name) => typeof name === 'string' && name.trim() !== '')
          && wirePages.length === pageNames.length
          && pages.length === pageNames.length
          && pages.every((page, index) => page.index === index && page.name === pageNames[index]);
        if (complete) {
          // Selector stability is structural. A live modulator changes
          // `modulatedValue` between these reads by design, so including values
          // makes the inventory impossible to settle on the exact devices this
          // path exists to inspect. Return the latest values after two equal
          // page/control layouts.
          const signature = JSON.stringify(pages.map((page) => ({
            index: page.index,
            name: page.name,
            controls: page.controls.map((control) => ({
              index: control.index,
              name: control.name,
            })),
          })));
          if (signature === prior) {
            return {
              standing: 'stable',
              deviceName: target.deviceName,
              remotes: { pages },
            };
          }
          prior = signature;
        } else {
          prior = undefined;
        }
        await this.settle('cursorPoint');
      }
      return { standing: 'unstable', deviceName: target.deviceName };
    });
  }

  private remoteState(
    address: import('../../contract/index.js').RemoteAddress,
    inventory: Extract<RemoteInventory, { standing: 'stable' }>,
  ): import('../../contract/index.js').RemoteControlState | undefined {
    const page = inventory.remotes.pages[address.pageIndex];
    if (page?.name !== address.pageName) return undefined;
    const control = page.controls.find((item) => item.index === address.controlIndex);
    return control?.name === address.controlName ? control : undefined;
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
   *
   * ⚠⚠ **The identity guard is POLLED, because `cursorPoint` is the wrong budget
   * for this read and was borrowed rather than measured.** `settle('cursorPoint')`
   * is 25ms (E1), which is what a cursor POINT costs; this reply comes through
   * `Rig.slotLayerBanks`, which have to follow the cursor to a different track
   * before the inventory means anything. Measured on 2026-08-15, re-pointing from
   * one track to another and reading immediately: the reply named the track we
   * had just pointed at 0/6 at 0ms, **3/6 at 25ms**, 5/6 at 50ms and 6/6 from
   * 100ms — so at the borrowed budget this read was a coin flip, and
   * `C-chain-switch` failed two runs in three on exactly that.
   *
   * Nothing was ever mis-reported, because the guard below fails closed — but a
   * refusal on a container that is perfectly observable a tick later is a
   * capability that works or does not depending on where the cursor last was.
   * So a MISMATCH is retried within a bound rather than answered: a mismatch is
   * a staleness signal and never an observation. Every other miss still answers
   * immediately, because each of those IS an observation (see the list above).
   */
  private async containerScope(
    trackRef: TrackAddress,
    containerIndex: number,
  ): Promise<ContainerScope> {
    const trackIndex = this.index.get(trackRef.channelId);
    if (trackIndex === undefined) return { ok: false, miss: 'absent' };
    if (containerIndex < 0) return { ok: false, miss: 'absent' };
    // ⚠ Bounded by ATTEMPTS, not by a clock. A wall-clock deadline spins hot
    // wherever `settle` is not real time — which is every offline test of this
    // class — and a bound that means something different in the suite from what
    // it means live is not a bound. Eight passes is ~1s at the structural budget
    // against a measured need of ~100ms.
    let reply: WireInventory | undefined;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      this.heldClips.delete('0');
      await this.transport.send({
        method: WIRE.cursorPointTrack, params: { cursor: '0', trackIndex },
      });
      // The fast path stays fast: a cursor already on this track answers on the
      // first pass at the cursor budget. Only a mismatch pays the structural one.
      await this.settle(attempt === 0 ? 'cursorPoint' : 'trackStruct');
      reply = (await this.transport.send({ method: WIRE.chainInventory })) as WireInventory;
      // ⚠ The identity guard, before anything in the reply is believed. `trackName`
      // rides along too and is deliberately NOT used for this: a name is not an
      // identity (standing rule 2), and two tracks may share one.
      if (reply.trackChannelId === trackRef.channelId) break;
      reply = undefined;
    }
    if (reply === undefined) return { ok: false, miss: 'unsupported' };
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
          ...(typeof c.mute === 'boolean' ? { mute: c.mute } : {}),
          ...(typeof c.solo === 'boolean' ? { solo: c.solo } : {}),
          ...(typeof c.volume === 'number' ? { volume: c.volume } : {}),
          ...(typeof c.pan === 'number' ? { pan: c.pan } : {}),
          ...(() => {
            if (typeof c.color !== 'string' || c.color.startsWith('ERR')) return {};
            const [red, green, blue] = c.color.split(',').map(Number);
            return [red, green, blue].every((value) => Number.isFinite(value))
              ? { color: { red: red!, green: green!, blue: blue! } }
              : {};
          })(),
          // ⚠ `layer.channelId()`, carried through as a WITHIN-SESSION WITNESS
          // and nothing else — see `ObservedChain.id`. It is worthless across a
          // project load (E17ad, E18b), which is exactly why `ChainAddress`
          // addresses by name; its one job is telling a fresh copy from the
          // chain it was copied from, in the turn that made it.
          //
          // ⚠ `putGuarded` writes an `ERR:` string rather than throwing when a
          // value is unreadable, and an unparsed one would be a plausible-looking
          // identity that matches nothing. Dropping it makes `mintedChain`
          // decline, which is the fail-closed direction.
          ...(typeof c.channelId === 'string' && !c.channelId.startsWith('ERR')
            ? { id: c.channelId }
            : {}),
          devices: (c.devices ?? []).map((d) => ({ index: d.index, name: d.name ?? '' })),
          devicesComplete: deviceBank !== undefined && typeof c.deviceCount === 'number'
            && c.deviceCount <= deviceBank && (c.devices ?? []).length === c.deviceCount,
          ...(deviceBank === undefined ? {} : { devicesBankSize: deviceBank }),
        })),
        chainsComplete: chainBank !== undefined && chains.length < chainBank,
        // ⚠ Carried through so a guard can count a container it has no second
        // reading of — see `ObservedContainer.chainsBankSize`. Absent from an
        // older extension, which also makes `chainsComplete` false above, so a
        // create is refused either way rather than counted against a guess.
        ...(chainBank === undefined ? {} : { chainsBankSize: chainBank }),
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

  /** Read exact metadata plus the readable but unwritable play-stop marker. */
  private async readClipMetadata(
    clip: ClipAddress,
    trackIndex: number,
    pointedAt: Map<string, AddressKey>,
    cursorRef?: string,
  ): Promise<{ readonly metadata: ClipMetadataState; readonly playStopBeats: number }> {
    const cursor = await this.pointAtClip(clip, trackIndex, pointedAt, cursorRef);
    const raw = (await this.transport.send({
      method: WIRE.cursorClipMetadata,
      params: { cursor },
    })) as Readonly<Record<string, unknown>>;
    const number = (name: string): number => {
      const value = raw[name];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`clip metadata ${name} did not return a finite number`);
      }
      return value;
    };
    const text = raw.name;
    if (typeof text !== 'string' || typeof raw.loopEnabled !== 'boolean') {
      throw new Error('clip metadata name or loopEnabled did not return its measured type');
    }
    const colorByte = (name: string): number => Math.max(0, Math.min(255, Math.round(number(name) * 255)));
    const loopStartBeats = number('loopStart');
    const lengthBeats = number('loopLength');
    return {
      metadata: {
        name: text,
        color: {
          red: colorByte('colorRed'),
          green: colorByte('colorGreen'),
          blue: colorByte('colorBlue'),
        },
        lengthBeats,
        playStartBeats: number('playStart'),
        loopEnabled: raw.loopEnabled,
        loopStartBeats,
        loopEndBeats: loopStartBeats + lengthBeats,
      },
      playStopBeats: number('playStop'),
    };
  }

  /**
   * Read all note channels through the dedicated fine cursor at both grid
   * families, then reconcile the two observations.
   *
   * Bitwig rounds an off-grid note start down. A binary scan alone corrupts a
   * triplet start, and a triplet scan alone corrupts a binary start. The later
   * of the two observed starts is therefore the exact start for every value in
   * the supported binary-or-triplet grid family. If either scan loses a note or
   * reports different note data, refuse the reading instead of guessing.
   */
  private async readFineClipNotes(
    clipRef: ClipAddress,
    trackIndex: number,
    pointedAt: Map<string, AddressKey>,
  ): Promise<ClipNoteChannels> {
    const cursor = this.noteReadCursorRef;
    const steps = this.noteReadSteps;
    if (cursor !== 'fine' || steps === undefined) {
      throw new AddressUnresolvedError(
        clipRef,
        'exact note read requires the dedicated fine cursor and its measured width',
      );
    }
    await this.timed('targetAcquisition', () =>
      this.pointAtClip(clipRef, trackIndex, pointedAt, cursor));
    const observed = await this.timed('metadata', () =>
      this.readClipMetadata(clipRef, trackIndex, pointedAt, cursor));
    const extent = Math.max(observed.playStopBeats, observed.metadata.loopEndBeats);
    const lengthBeats = extent > 0 ? extent : 4;
    const binaryStep = 1 / 64;
    const tripletStep = 1 / 48;
    const scan = async (stepSize: number): Promise<ReadonlyMap<number, readonly NoteRecord[]>> => {
      await this.transport.send({ method: WIRE.cursorSetStepSize, params: { cursor, stepSize } });
      const channels = new Map<number, NoteRecord[]>();
      for (let channel = 0; channel < 16; channel += 1) channels.set(channel, []);
      const totalSteps = Math.max(1, Math.ceil(lengthBeats / stepSize));
      let currentPageStart = 0;
      try {
        for (let pageStart = 0; pageStart < totalSteps; pageStart += steps) {
          currentPageStart = pageStart;
          await this.timed('pageTurn', () => this.transport.send({
            method: WIRE.cursorScrollToStep,
            params: { cursor, step: pageStart },
          }));
          // One full settlement covers the grid and page-zero transition. Later
          // pages keep the same measured budget. Neither transition has readback.
          await this.timed('gridSettlement', () => this.settle('gridChange'));
          const pageSteps = Math.min(steps, totalSteps - pageStart);
          const result = (await this.timed('bulkPageRead', () => this.transport.send({
            method: WIRE.cursorGetNotesVerboseAllChannels,
            params: { cursor, maxX: pageSteps },
          }))) as WireVerboseAllChannels;
          if (!Array.isArray(result.channels) || result.channels.length !== 16) {
            throw new AddressUnresolvedError(
              clipRef,
              'the bulk note reply did not return all 16 MIDI channels',
            );
          }
          const seen = new Set<number>();
          let returnedCount = 0;
          for (const returned of result.channels) {
            const channel = returned.channel;
            if (!Number.isInteger(channel) || channel < 0 || channel > 15 || seen.has(channel)
                || !Array.isArray(returned.notes) || returned.count !== returned.notes.length) {
              throw new AddressUnresolvedError(
                clipRef,
                'the bulk note reply returned an invalid or duplicate MIDI channel',
              );
            }
            seen.add(channel);
            returnedCount += returned.count;
            channels.get(channel)!.push(...returned.notes.map((note: Record<string, number | boolean | string>) => {
              const x = note['x'];
              if (typeof x !== 'number') {
                throw new AddressUnresolvedError(clipRef, 'a note step returned no numeric position');
              }
              return decodeVerboseNote({ ...note, x: x + pageStart }, stepSize);
            }));
          }
          if (result.count !== returnedCount || result.clipExists === false
              || !Number.isFinite(result.scanMicros) || result.scanMicros < 0) {
            throw new AddressUnresolvedError(
              clipRef,
              'the bulk note reply returned inconsistent page bounds or counts',
            );
          }
        }
      } finally {
        if (currentPageStart !== 0) {
          // The reader is shared across calls. Do not leak a nonzero page.
          await this.timed('pageReset', async () => {
            await this.transport.send({
              method: WIRE.cursorScrollToStep,
              params: { cursor, step: 0 },
            });
            await this.settle('gridChange');
          });
        }
      }
      return channels;
    };

    const binary = await scan(binaryStep);
    const triplet = await scan(tripletStep);
    return this.timed('reconciliation', async () => {
      const reconciled = new Map<number, readonly NoteRecord[]>();
      for (let channel = 0; channel < 16; channel += 1) {
        reconciled.set(channel, this.reconcileNoteScans(
          clipRef,
          channel,
          binary.get(channel) ?? [],
          triplet.get(channel) ?? [],
        ));
      }
      return reconciled;
    });
  }

  /** Pair notes by pitch and order, and keep the scan that did not round down. */
  private reconcileNoteScans(
    clipRef: ClipAddress,
    channel: number,
    binary: readonly NoteRecord[],
    triplet: readonly NoteRecord[],
  ): readonly NoteRecord[] {
    const byPitch = (notes: readonly NoteRecord[]): ReadonlyMap<number, readonly NoteRecord[]> => {
      const grouped = new Map<number, NoteRecord[]>();
      for (const note of notes) {
        const found = grouped.get(note.pitch) ?? [];
        found.push(note);
        grouped.set(note.pitch, found);
      }
      for (const found of grouped.values()) found.sort((left, right) => left.startBeats - right.startBeats);
      return grouped;
    };
    const left = byPitch(binary);
    const right = byPitch(triplet);
    const pitches = new Set([...left.keys(), ...right.keys()]);
    const result: NoteRecord[] = [];
    for (const pitch of pitches) {
      const binaryPitch = left.get(pitch) ?? [];
      const tripletPitch = right.get(pitch) ?? [];
      if (binaryPitch.length !== tripletPitch.length) {
        throw new AddressUnresolvedError(
          clipRef,
          `binary and triplet scans disagree on channel ${channel}, pitch ${pitch} note count`,
        );
      }
      for (let index = 0; index < binaryPitch.length; index += 1) {
        const binaryNote = binaryPitch[index]!;
        const tripletNote = tripletPitch[index]!;
        const { startBeats: binaryStart, ...binaryBody } = binaryNote;
        const { startBeats: tripletStart, ...tripletBody } = tripletNote;
        if (JSON.stringify(binaryBody) !== JSON.stringify(tripletBody)
            || Math.abs(binaryStart - tripletStart) > 1 / 48) {
          throw new AddressUnresolvedError(
            clipRef,
            `binary and triplet scans disagree on channel ${channel}, pitch ${pitch} note identity`,
          );
        }
        result.push({
          ...binaryNote,
          startBeats: Math.max(binaryStart, tripletStart),
        });
      }
    }
    return result.sort((leftNote, rightNote) =>
      leftNote.startBeats - rightNote.startBeats || leftNote.pitch - rightNote.pitch);
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
   * Session 5 hoists this work through `preserveSelection`. The executor knows
   * the complete read -> apply -> read pipeline, so that path captures at entry
   * and restores once. A direct adapter call still preserves selection by
   * itself.
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
    await this.timed('selectionRestoration', () => this.restoreSelectionNow(saved));
  }

  private async restoreSelectionNow(saved: SelectionState | undefined): Promise<void> {
    // A direct call has no ownership across its return boundary. Another adapter
    // or probe can move the same physical cursor before the next call. Keep a
    // hold only inside `preserveSelection`, where this adapter owns the complete
    // pipeline and both the cursor track and clip remain pinned.
    if (this.selectionScope === undefined) this.heldClips.clear();
    if (saved === undefined) return;
    await this.transport.send({
      method: WIRE.slotSelect,
      params: { trackIndex: saved.trackIndex, slotIndex: saved.slotIndex, mechanism: 'track' },
    });
    // The call returns before the selection observer moves. Do not let the
    // executor return while the UI still shows the borrowed target. Poll the
    // observer because it is the readback for this UI state (D15).
    //
    // A timeout does not throw. The content write may already have landed, and
    // losing its receipt is worse than returning after a UI-only restore miss.
    const started = Date.now();
    while (Date.now() - started < 4000) {
      const status = (await this.transport.send({ method: WIRE.selectionStatus })) as {
        trackIndex: number;
        slotIndex: number;
      };
      if (status.trackIndex === saved.trackIndex && status.slotIndex === saved.slotIndex) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  /**
   * Preserve clip selection across the complete executor pipeline (B4).
   *
   * `read` and `apply` still preserve selection when called directly. Inside
   * this scope they only record that they borrowed it. The outer scope restores
   * once after verify and concurrent-edit reporting finish. A nested scope uses
   * the same capture, which keeps reversal composition from adding flicker.
   */
  async preserveSelection<T>(work: () => Promise<T>): Promise<T> {
    if (this.selectionRestore !== undefined) {
      await this.selectionRestore;
      return this.preserveSelection(work);
    }

    const active = this.selectionScope;
    if (active !== undefined) {
      active.users += 1;
      try {
        active.saved = await active.capture;
        return await work();
      } finally {
        await this.finishSelectionScope(active);
      }
    }

    const scope = {
      saved: undefined as SelectionState | undefined,
      borrowed: false,
      // Start the wire read before any resolve, stash, or other asynchronous
      // work can let a human selection replace the pipeline-entry state.
      capture: this.captureSelection(),
      users: 1,
    };
    this.selectionScope = scope;
    try {
      scope.saved = await scope.capture;
      return await work();
    } finally {
      await this.finishSelectionScope(scope);
    }
  }

  /** Restore only after the last overlapping pipeline leaves the shared scope. */
  private async finishSelectionScope(scope: NonNullable<LiveAdapter['selectionScope']>): Promise<void> {
    scope.users -= 1;
    if (scope.users !== 0 || this.selectionScope !== scope) return;
    this.selectionScope = undefined;
    // A verified hold belongs to this pipeline. Do not carry it across a gap in
    // which an external structural edit can move the track or scene layout.
    this.heldClips.clear();
    if (!scope.borrowed) return;
    const restore = this.restoreSelection(scope.saved);
    this.selectionRestore = restore;
    try {
      await restore;
    } finally {
      if (this.selectionRestore === restore) this.selectionRestore = undefined;
    }
  }

  /** Capture locally, or mark the executor-owned scope as borrowed. */
  private async beginSelectionBorrow(needed: boolean): Promise<SelectionState | undefined> {
    if (!needed) return undefined;
    if (this.selectionScope !== undefined) {
      const scope = this.selectionScope;
      scope.saved = await scope.capture;
      scope.borrowed = true;
      return undefined;
    }
    return this.captureSelection();
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

  async devices(trackRef: TrackAddress) {
    const selection = await this.beginSelectionBorrow(true);
    try {
      await this.scanTracks();
      const observed = await this.stableDeviceChain(trackRef);
      if (observed === undefined) {
        throw new AddressUnresolvedError(trackRef, 'the track device order is absent');
      }
      return {
        devices: observed.devices,
        devicesComplete: !observed.blind,
        ...(observed.bankSize === undefined ? {} : { bankSize: observed.bankSize }),
      };
    } finally {
      await this.restoreSelection(selection);
    }
  }

  async resolve(refs: readonly Address[]): Promise<ResolveResult> {
    // ⚠ The mark is taken FIRST, and it is the mark returned. Two reasons, both
    // fail-closed: the epoch every address below is checked against has to be a
    // real reading rather than a remembered one, and a caller that baselines on
    // the returned mark then sees any foreign edit that happened DURING this
    // call. A mark taken at the end would swallow exactly those.
    const at = await this.revision();
    const selection = await this.beginSelectionBorrow(refs.some(addressBorrowsSelection));
    try {
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
        if (address.kind === 'chain' || address.kind === 'drumPad' || address.kind === 'device'
            || address.kind === 'deviceEnabled'
            || address.kind === 'param' || address.kind === 'remotes' || address.kind === 'remote') {
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
      if (address.kind === 'device' && address.chain === undefined) {
        const chain = await this.deviceChain(trackRef);
        const found = chain?.devices.find((item) => item.index === address.chainIndex);
        resolved.push(found !== undefined
          ? { address, found: true, index: found.index }
          : { address, found: false, reason: chain?.blind
            ? 'outside-bank-window' : 'absent' });
        continue;
      }
      if (address.kind === 'deviceEnabled') {
        if (address.device.chain !== undefined) {
          resolved.push({ address, found: false, reason: 'unsupported' });
          continue;
        }
        const chain = await this.deviceChain(trackRef);
        const found = chain?.devices.find((item) => item.index === address.device.chainIndex);
        resolved.push(found === undefined
          ? { address, found: false, reason: chain?.blind
            ? 'outside-bank-window' : 'absent' }
          : found.enabled === undefined
            ? { address, found: false, reason: 'unstable' }
            : { address, found: true, index: found.index });
        continue;
      }
      if (address.kind === 'param') {
        const row = this.bank.find((item) => item.channelId === trackRef.channelId);
        if (row === undefined) {
          resolved.push({ address, found: false, reason: 'absent' });
          continue;
        }
        const inventory = await this.parameterInventory(address.device, row);
        if (inventory.standing !== 'stable') {
          resolved.push({
            address,
            found: false,
            reason: inventory.standing === 'missing' ? 'absent'
              : inventory.standing === 'unreachable' ? 'outside-bank-window'
                : inventory.standing === 'ambiguous' ? 'ambiguous' : 'unstable',
          });
          continue;
        }
        resolved.push(this.parameterState(address, inventory) === undefined
          ? { address, found: false, reason: 'absent' }
          : { address, found: true, index: address.device.chainIndex });
        continue;
      }
      if (address.kind === 'remotes' || address.kind === 'remote') {
        const row = this.bank.find((item) => item.channelId === trackRef.channelId);
        if (row === undefined) {
          resolved.push({ address, found: false, reason: 'absent' });
          continue;
        }
        const inventory = await this.remoteInventory(address.device, row);
        if (inventory.standing !== 'stable') {
          resolved.push({
            address,
            found: false,
            reason: inventory.standing === 'missing' ? 'absent'
              : inventory.standing === 'unreachable' ? 'outside-bank-window'
                : inventory.standing === 'ambiguous' ? 'ambiguous' : 'unstable',
          });
          continue;
        }
        resolved.push(address.kind === 'remotes' || this.remoteState(address, inventory) !== undefined
          ? { address, found: true, index: address.device.chainIndex }
          : { address, found: false, reason: 'absent' });
        continue;
      }
      if (address.kind === 'drumPad') {
        const row = this.bank.find((item) => item.channelId === trackRef.channelId);
        if (row === undefined) {
          resolved.push({ address, found: false, reason: 'absent' });
          continue;
        }
        const target: DeviceAddress = {
          kind: 'device', track: address.container.track, chainIndex: 0, chain: address,
        };
        const inventory = await this.parameterInventory(target, row);
        resolved.push(inventory.standing === 'stable'
          ? { address, found: true, index: address.channel }
          : {
            address,
            found: false,
            reason: inventory.standing === 'missing' ? 'absent'
              : inventory.standing === 'unreachable' ? 'outside-bank-window'
                : inventory.standing === 'ambiguous' ? 'ambiguous' : 'unstable',
          });
        continue;
      }
      // ⚠ `resolveNested` is the only thing that may answer `found` for a
      // chain-family address, and it is shared, line for line, with the fake.
      resolved.push(await this.resolveNested(address, trackRef)
        ?? { address, found: false, reason: 'unsupported' as const });
    }
      return { at, resolved };
    } finally {
      await this.restoreSelection(selection);
    }
  }

  async read(sel: readonly Address[]): Promise<Snapshot> {
    const entries: Record<string, StateEntry> = {};
    const missing: Address[] = [];
    const unreachable: Address[] = [];
    const unstable: Address[] = [];
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
    const selection = await this.beginSelectionBorrow(sel.some(addressBorrowsSelection));
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
    // A dual-grid read scans all channels while each grid is settled. Keep the
    // result for this snapshot so 16 channel addresses cost two grid changes,
    // not 32 grid changes and 32 waits.
    const noteReads = new Map<AddressKey, Promise<ClipNoteChannels>>();
    const parameterReads = new Map<AddressKey, Promise<ParameterInventory>>();
    const remoteReads = new Map<AddressKey, Promise<RemoteInventory>>();

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
      const entry = await this.readOne(
        address, row, pointedAt, noteReads, parameterReads, remoteReads,
      );
      // ⚠ A chain-family address whose container has no observable scope is
      // UNREACHABLE, not missing — the same E5 distinction the track bank makes
      // one level up. The layer banks are init-allocated and narrow (D7), so
      // "there is no container scope at that position" is a fact about our
      // reach and never about the music.
      if (entry === 'unreachable') unreachable.push(address);
      else if (entry === 'unstable') unstable.push(address);
      else if (entry === undefined) missing.push(address);
      else entries[addressKey(address)] = entry;
    }

    // ⚠ D6, E14-F: reading notes POINTS the pool cursor, which steals the user's
    // clip selection. Restoring it is what Phase 1 owes.
    await this.restoreSelection(selection);

    return { contract: CONTRACT_TAG, at, entries, missing, unreachable, unstable };
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
    cursorRef?: string,
  ): Promise<string> {
    const cursor = cursorRef ?? this.pool.cursorFor(clipRef);
    const key = addressKey(clipRef);
    if (this.heldClips.get(cursor) === key) {
      pointedAt.set(cursor, key);
      return cursor;
    }
    if (pointedAt.get(cursor) === key) return cursor;
    this.heldClips.delete(cursor);

    let confirmingPins = false;
    let lastStatus: ClipCursorStatus | undefined;
    for (let attempt = 0; attempt < CLIP_POINT_ATTEMPTS; attempt += 1) {
      if (!confirmingPins) {
        // Re-send the complete point. A target mismatch means that cursor state
        // is stale. It does not prove that the occupied clip is absent.
        await this.transport.send({
          method: WIRE.cursorPin,
          params: { cursor, pinned: false },
        });
        await this.transport.send({
          method: WIRE.cursorPinTrack,
          params: { cursor, pinned: false },
        });
        await this.transport.send({ method: WIRE.cursorPointTrack, params: { cursor, trackIndex } });
        await this.transport.send({
          method: WIRE.slotSelect,
          params: { trackIndex, slotIndex: clipRef.slot.scene.index, mechanism: 'track' },
        });
      }
      // A re-send restarts the follower. Later checks use the structural budget
      // instead of treating several 25 ms waits as one longer wait.
      await this.settle(attempt === 0 ? 'cursorPoint' : 'trackStruct');
      lastStatus = (await this.transport.send({
        method: WIRE.cursorStatus,
        params: { cursor },
      })) as ClipCursorStatus;
      const targetConfirmed = lastStatus.trackPosition === trackIndex
        && lastStatus.sceneIndex === clipRef.slot.scene.index;
      if (!targetConfirmed) {
        confirmingPins = false;
        continue;
      }
      if (!confirmingPins) {
        await this.transport.send({
          method: WIRE.cursorPinTrack,
          params: { cursor, pinned: true },
        });
        await this.transport.send({
          method: WIRE.cursorPin,
          params: { cursor, pinned: true },
        });
        // Pinning is asynchronous. E36 observed the next slot selection move a
        // cursor after target confirmation but before its pin had settled. The
        // adapter then cached the old target and read two clips through one
        // physical handle. A target is reusable only after both facts are true
        // in one independent status reading.
        await this.settle('cursorPoint');
        lastStatus = (await this.transport.send({
          method: WIRE.cursorStatus,
          params: { cursor },
        })) as ClipCursorStatus;
      }
      const pinnedTargetConfirmed = lastStatus.trackPosition === trackIndex
        && lastStatus.sceneIndex === clipRef.slot.scene.index;
      if (pinnedTargetConfirmed
          && lastStatus.isPinned === true
          && lastStatus.cursorTrackPinned === true) {
        this.heldClips.set(cursor, key);
        pointedAt.set(cursor, key);
        return cursor;
      }
      // Do not cancel a pin that is still settling. Poll it in place. Re-point
      // only when the exact target itself moved.
      confirmingPins = pinnedTargetConfirmed;
    }

    const detail = confirmingPins
      ? `target track ${trackIndex}, row ${clipRef.slot.scene.index} confirmed, but clip pin `
        + `${String(lastStatus?.isPinned)} and track pin ${String(lastStatus?.cursorTrackPinned)} `
        + `did not both confirm after ${CLIP_POINT_ATTEMPTS} attempts`
      : `target track ${trackIndex}, row ${clipRef.slot.scene.index} did not confirm after `
        + `${CLIP_POINT_ATTEMPTS} attempts; last observed track `
        + `${String(lastStatus?.trackPosition)}, row ${String(lastStatus?.sceneIndex)}`;
    throw new AddressUnresolvedError(
      clipRef,
      `cursor ${cursor} ${detail}`,
    );
  }

  /** Check every writer page before the stage can mutate project state. */
  private async confirmWriterPages(
    ops: readonly Op[],
    views: Map<string, WriterView>,
    writerPageStart?: number,
  ): Promise<void> {
    const writerSteps = this.fineSteps ?? this.gridSteps ?? 64;
    for (const op of ops) {
      if ((op.op !== 'note.write' && op.op !== 'note.props') || op.notes.length === 0) continue;
      const cursor = this.pool.cursorFor(op.clip);
      const stepSize = chooseStepSize(op.notes);
      const requiredPages = op.op === 'note.props'
        ? notePropertyPageStarts(op.notes, writerSteps)
        : notePageStarts(op.notes, writerSteps);
      const pages = writerPageStart === undefined
        ? requiredPages
        : requiredPages.filter((page) => page === writerPageStart);
      for (const page of pages) {
        await this.confirmWriterPage(op.clip, cursor, stepSize, page, views);
      }
    }
  }

  /** Settle one grid and page together, then confirm the exact pinned target. */
  private async confirmWriterPage(
    clipRef: ClipAddress,
    cursor: string,
    stepSize: number,
    page: number,
    views: Map<string, WriterView>,
  ): Promise<void> {
    const clipKey = addressKey(clipRef);
    const current = views.get(cursor);
    if (current?.clipKey === clipKey && current.stepSize === stepSize && current.page === page) return;
    await this.transport.send({ method: WIRE.cursorSetStepSize, params: { cursor, stepSize } });
    await this.transport.send({ method: WIRE.cursorScrollToStep, params: { cursor, step: page } });
    // Record the attempted view before its status check. If the check fails,
    // cleanup must still reset the physical cursor that already moved.
    views.set(cursor, { clipKey, clip: clipRef, stepSize, page });
    await this.settle('gridChange');
    const status = (await this.transport.send({
      method: WIRE.cursorStatus,
      params: { cursor },
    })) as ClipCursorStatus;
    const confirmed = status.trackPosition === this.trackIndex(clipRef.slot.track)
      && status.sceneIndex === clipRef.slot.scene.index
      && status.isPinned === true
      && status.cursorTrackPinned === true;
    if (confirmed) {
      views.set(cursor, { clipKey, clip: clipRef, stepSize, page });
      return;
    }
    this.heldClips.delete(cursor);
    throw new AddressUnresolvedError(
      clipRef,
      `writer cursor ${cursor} did not confirm the target at page ${page}`,
    );
  }

  /** Restore every writer to page zero and verify the reset once. */
  private async resetWriterViews(views: Map<string, WriterView>): Promise<void> {
    const moved = [...views.entries()].filter(([, view]) => view.page !== 0);
    if (moved.length === 0) return;
    for (const [cursor] of moved) {
      await this.transport.send({
        method: WIRE.cursorScrollToStep,
        params: { cursor, step: 0 },
      });
    }
    await this.settle('gridChange');
    for (const [cursor, view] of moved) {
      const status = (await this.transport.send({
        method: WIRE.cursorStatus,
        params: { cursor },
      })) as ClipCursorStatus;
      const confirmed = status.trackPosition === this.trackIndex(view.clip.slot.track)
        && status.sceneIndex === view.clip.slot.scene.index
        && status.isPinned === true
        && status.cursorTrackPinned === true;
      if (!confirmed) {
        this.heldClips.delete(cursor);
        throw new AddressUnresolvedError(
          view.clip,
          `writer cursor ${cursor} did not confirm page zero after reset`,
        );
      }
      views.set(cursor, { ...view, page: 0 });
    }
  }

  /** Send one stage after settling its optional read-based property page. */
  private async sendStage(
    ops: readonly Op[],
    guard: number | undefined,
    views: Map<string, WriterView>,
    writerPageStart?: number,
  ): Promise<BatchRunResult> {
    if (writerPageStart === undefined) {
      return await this.transport.send(encodeStage(ops, this.ctx, guard)) as BatchRunResult;
    }
    const props = ops[0];
    if (ops.length !== 1 || props?.op !== 'note.props') {
      throw new InvalidOpError('note.props', 'a settled writer page must contain one property op');
    }
    const cursor = this.pool.cursorFor(props.clip);
    await this.confirmWriterPage(
      props.clip,
      cursor,
      chooseStepSize(props.notes),
      writerPageStart,
      views,
    );
    return await this.transport.send(encodeStage(
      ops,
      { ...this.ctx, writerPageStart },
      guard,
    )) as BatchRunResult;
  }

  /** Confirm every existing cursor-clip target and writer page for one stage. */
  private async confirmClipMutationStage(
    ops: readonly Op[],
    views: Map<string, WriterView>,
    skip: ReadonlySet<AddressKey> = new Set(),
    writerPageStart?: number,
  ): Promise<void> {
    const clipTargets = new Map<AddressKey, ClipAddress>();
    for (const op of ops) {
      if (op.op !== 'clip.update' && op.op !== 'note.clear' && op.op !== 'note.write') continue;
      const key = addressKey(op.clip);
      if (!skip.has(key)) clipTargets.set(key, op.clip);
    }
    for (const target of clipTargets.values()) {
      await this.pointAtClip(
        target,
        this.trackIndex(target.slot.track),
        new Map(),
      );
    }
    await this.confirmWriterPages(ops.filter((op) => {
      if (op.op !== 'note.write' && op.op !== 'note.props') return true;
      return !skip.has(addressKey(op.clip));
    }), views, writerPageStart);
  }

  /** Arm the measured note-step wake only for one confirmed existing clip. */
  private async armNoteWake(ops: readonly Op[]): Promise<void> {
    this.pendingNoteWake = undefined;
    const clips = new Map<AddressKey, ClipAddress>();
    const created = new Set<AddressKey>();
    const notes: NoteRecord[] = [];
    for (const op of ops) {
      if (op.op === 'clip.create') created.add(addressKey(clipAt(op.slot)));
      if (op.op === 'clip.duplicate' || op.op === 'clip.move') {
        created.add(addressKey(clipAt(op.destination)));
      }
      if (op.op === 'note.write' || op.op === 'note.clear') clips.set(addressKey(op.clip), op.clip);
      if (op.op === 'note.write') notes.push(...op.notes);
    }
    if (clips.size !== 1) return;
    const [clipKey, clipRef] = clips.entries().next().value as [AddressKey, ClipAddress];
    if (created.has(clipKey)) return;

    await this.timed('observerArm', async () => {
      try {
        const prepared = await this.transport.send({ method: WIRE.noteObserverPrepare }) as {
          readonly generation?: number;
        };
        if (!Number.isInteger(prepared.generation)) return;
        await this.pointAtClip(
          clipRef,
          this.trackIndex(clipRef.slot.track),
          new Map(),
          'observer',
        );
        if (notes.length > 0) {
          const stepSize = chooseStepSize(notes);
          await this.transport.send({
            method: WIRE.cursorSetStepSize,
            params: { cursor: 'observer', stepSize },
          });
          await this.transport.send({
            method: WIRE.cursorScrollToStep,
            params: { cursor: 'observer', step: 0 },
          });
          await this.settle('gridChange');
        }
        const trackIndex = this.trackIndex(clipRef.slot.track);
        const armed = await this.transport.send({
          method: WIRE.noteObserverArm,
          params: {
            generation: prepared.generation,
            trackId: clipRef.slot.track.channelId,
            trackIndex,
            slotIndex: clipRef.slot.scene.index,
          },
        }) as { readonly afterSequence?: number };
        if (!Number.isInteger(armed.afterSequence)) return;
        this.pendingNoteWake = {
          generation: prepared.generation!,
          afterSequence: armed.afterSequence!,
          trackId: clipRef.slot.track.channelId,
          trackIndex,
          slotIndex: clipRef.slot.scene.index,
        };
      } catch {
        // The signal is optional. The fixed fallback remains safe.
        this.pendingNoteWake = undefined;
      }
    });
  }

  private async readOne(
    address: Address,
    row: WireTrack | undefined,
    pointedAt: Map<string, AddressKey>,
    noteReads: Map<AddressKey, Promise<ClipNoteChannels>>,
    parameterReads: Map<AddressKey, Promise<ParameterInventory>>,
    remoteReads: Map<AddressKey, Promise<RemoteInventory>>,
  ): Promise<StateEntry | 'unreachable' | 'unstable' | undefined> {
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
        const observed = await this.readClipMetadata(clipRef, row.index, pointedAt);
        // ⚠ NOT defaulted. The `notes` branch may fall back to 4 beats because a
        // scan window that is too wide only costs resolution; here the number IS
        // the captured value, and a clip silently recreated at a guessed length is
        // a musical value invented from nothing. Absent means absent, and
        // `revertOps` refuses to recreate the clip rather than pick a length.
        const lengthBeats = observed.metadata.lengthBeats > 0
          ? observed.metadata.lengthBeats
          : undefined;
        return {
          address,
          fidelity: 'lossy',
          value: lengthBeats === undefined
            ? { of: 'clip', exists: true }
            : { of: 'clip', exists: true, lengthBeats },
        };
      }

      case 'clipMetadata': {
        if (row === undefined) return undefined;
        const sceneIndex = address.clip.slot.scene.index;
        const status = (await this.transport.send({
          method: WIRE.slotStatus,
          params: { trackIndex: row.index, slotIndex: sceneIndex },
        })) as { hasContent: boolean };
        if (!status.hasContent) return undefined;
        const observed = await this.readClipMetadata(address.clip, row.index, pointedAt);
        return { address, fidelity: 'exact', value: { of: 'clipMetadata', metadata: observed.metadata } };
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

        if (this.noteReadCursorRef === 'fine') {
          const key = addressKey(address.clip);
          let reading = noteReads.get(key);
          if (reading === undefined) {
            reading = this.readFineClipNotes(address.clip, row.index, pointedAt);
            noteReads.set(key, reading);
          }
          const channelNotes = (await reading).get(address.channel ?? 0) ?? [];
          const selected = channelNotes.filter((note) => (address.range === undefined
            ? true
            : note.startBeats >= address.range.startBeats
              && note.startBeats < address.range.endBeats));
          const fidelity: Fidelity = selected.some(hasUnverifiedProps) ? 'lossy' : 'exact';
          return { address, fidelity, value: { of: 'notes', notes: selected } };
        }

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
        const observed = await this.readClipMetadata(address.clip, row.index, pointedAt);
        const observedExtent = Math.max(observed.playStopBeats, observed.metadata.loopEndBeats);
        const lengthBeats = observedExtent > 0 ? observedExtent : 4;
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
        if (row === undefined) return undefined;
        // A nested device first uses the confirmed parameter cursor. The old
        // structural fallback remains bounded to the one level it can observe.
        if (address.chain !== undefined) {
          const key = addressKey(address);
          let reading = parameterReads.get(key);
          if (reading === undefined) {
            reading = this.parameterInventory(address, row);
            parameterReads.set(key, reading);
          }
          const inventory = await reading;
          if (inventory.standing !== 'stable') {
            if (address.chain.kind === 'chain' && nestingObservable(address)) {
              const scope = await this.containerScope(
                address.chain.container.track, address.chain.container.chainIndex,
              );
              if (scope.ok) {
                const found = lookupNestedDevice(scope.container, address);
                if (found.ok) {
                  return {
                    address,
                    fidelity: 'none',
                    value: {
                      of: 'device',
                      device: { chainIndex: found.device.index, name: found.device.name },
                    },
                  };
                }
              }
            }
            return inventory.standing === 'missing' || inventory.standing === 'ambiguous'
              ? undefined : inventory.standing === 'unstable' ? 'unstable' : 'unreachable';
          }
          return {
            address,
            fidelity: 'none',
            value: {
              of: 'device',
              device: {
                chainIndex: address.chainIndex,
                name: inventory.deviceName,
                params: inventory.params,
              },
            },
          };
        }
        const key = addressKey(address);
        let reading = parameterReads.get(key);
        if (reading === undefined) {
          reading = this.parameterInventory(address, row);
          parameterReads.set(key, reading);
        }
        const inventory = await reading;
        if (inventory.standing !== 'stable') {
          // A device-bank observation can be stable while its separate
          // DirectParameter observer is not. Keep the device and any container
          // inventory readable. Only a parameter address is unstable here.
          if (inventory.standing === 'unstable' && inventory.deviceName !== undefined) {
            const scope = await this.containerScope(address.track, address.chainIndex);
            return {
              address,
              fidelity: 'none',
              value: {
                of: 'device',
                device: {
                  chainIndex: address.chainIndex,
                  name: inventory.deviceName,
                  ...(scope.ok ? { container: scope.container } : {}),
                },
              },
            };
          }
          if (inventory.standing === 'unstable') return 'unstable';
          if (inventory.standing === 'unreachable') return 'unreachable';
          if (inventory.standing === 'ambiguous') return undefined;
          const absentScope = await this.containerScope(address.track, address.chainIndex);
          return absentScope.ok || absentScope.miss === 'absent' ? undefined : 'unreachable';
        }
        const scope = await this.containerScope(address.track, address.chainIndex);
        return {
          address,
          fidelity: 'none',
          value: {
            of: 'device',
            device: {
              chainIndex: address.chainIndex,
              name: inventory.deviceName,
              params: inventory.params,
              ...(scope.ok ? { container: scope.container } : {}),
            },
          },
        };
      }

      case 'deviceEnabled': {
        if (row === undefined) return undefined;
        if (address.device.chain !== undefined) return 'unreachable';
        const chain = await this.deviceChain(address.device.track);
        if (chain === undefined || chain.blind) return 'unreachable';
        const found = chain.devices.find((item) => item.index === address.device.chainIndex);
        if (found === undefined) return undefined;
        if (found.enabled === undefined) return 'unstable';
        return {
          address,
          fidelity: 'exact',
          value: { of: 'deviceEnabled', enabled: found.enabled },
        };
      }

      case 'param': {
        if (row === undefined) return undefined;
        const key = addressKey(address.device);
        let reading = parameterReads.get(key);
        if (reading === undefined) {
          reading = this.parameterInventory(address.device, row);
          parameterReads.set(key, reading);
        }
        const inventory = await reading;
        if (inventory.standing !== 'stable') {
          return inventory.standing === 'missing' || inventory.standing === 'ambiguous'
            ? undefined : inventory.standing;
        }
        const found = address.directId !== undefined
          ? inventory.params.find((item) => item.id === address.directId)
          : inventory.typed.find((item) => item.index === address.index);
        if (found === undefined) return undefined;
        return { address, fidelity: 'exact', value: { of: 'param', param: found } };
      }
      case 'remotes': {
        if (row === undefined) return undefined;
        const key = addressKey(address.device);
        let reading = remoteReads.get(key);
        if (reading === undefined) {
          reading = this.remoteInventory(address.device, row);
          remoteReads.set(key, reading);
        }
        const inventory = await reading;
        if (inventory.standing !== 'stable') {
          return inventory.standing === 'missing' || inventory.standing === 'ambiguous'
            ? undefined : inventory.standing === 'unstable' ? 'unstable' : 'unreachable';
        }
        return { address, fidelity: 'none', value: { of: 'remotes', remotes: inventory.remotes } };
      }
      case 'remote': {
        if (row === undefined) return undefined;
        const key = addressKey(address.device);
        let reading = remoteReads.get(key);
        if (reading === undefined) {
          reading = this.remoteInventory(address.device, row);
          remoteReads.set(key, reading);
        }
        const inventory = await reading;
        if (inventory.standing !== 'stable') {
          return inventory.standing === 'missing' || inventory.standing === 'ambiguous'
            ? undefined : inventory.standing === 'unstable' ? 'unstable' : 'unreachable';
        }
        const found = this.remoteState(address, inventory);
        return found === undefined
          ? undefined
          : { address, fidelity: 'exact', value: { of: 'remote', remote: found } };
      }
      case 'drumPad':
        return undefined;
      case 'scene':
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
        : op.op === 'clip.launch' || op.op === 'clip.launchSettings' || op.op === 'clip.update'
          ? [op.clip.slot]
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

  /**
   * Every container a `chain.create` in this batch names, observed once, before
   * anything is written.
   *
   * ⚠ It also RECORDS each observed chain's bank position into
   * `chainPositions`, which is what the encoder reads. Two things follow from
   * doing it here rather than at encode time: the position the wire receives
   * comes from the same reading the preconditions were checked against, and a
   * chain nobody observed has no position at all — so a stale or invented one
   * cannot reach the wire, it fails in `chainIndex` instead.
   *
   * ⚠ Cleared first. A map carried over from a previous batch would be exactly
   * the "held index across a structural op" that standing rule 2 forbids.
   */
  private async readContainers(
    ops: readonly Op[],
  ): Promise<Map<AddressKey, ObservedContainer | undefined>> {
    this.chainPositions.clear();
    this.chainIds.clear();
    const seen = new Map<AddressKey, ObservedContainer | undefined>();
    for (const op of ops) {
      if (op.op !== 'chain.create' && op.op !== 'chain.rename' && op.op !== 'chain.activate') continue;
      const container = op.op === 'chain.create' ? op.source.container : op.chain.container;
      const key = addressKey(container);
      if (seen.has(key)) continue;
      const scope = await this.containerScope(container.track, container.chainIndex);
      // ⚠ EVERY miss maps to `undefined`, deliberately — including `absent`. The
      // contract's refusal says "nothing could observe the chain this would
      // make", which is true of all four of them, and a create is the one moment
      // where the difference between "we could not look" and "we looked and it
      // is empty" changes nothing: neither is a container we can safely write a
      // chain into and then find again.
      seen.set(key, scope.ok ? scope.container : undefined);
      if (scope.ok) this.recordChainPositions(container, scope.container);
    }
    return seen;
  }

  /** One observation's chain positions, keyed by the address that names each one. */
  private recordChainPositions(container: DeviceAddress, observed: ObservedContainer): void {
    for (const item of observed.chains) {
      // ⚠ Only a name that identifies EXACTLY ONE chain gets a position, and a
      // blank one gets none. `lookupChain` refuses both cases and
      // `assertChainCreatable` runs before the encoder, so this is belt and
      // braces — but the braces are cheap and the failure they guard is a
      // duplicate aimed at whichever of two same-named chains was enumerated
      // last. (A blank name would also throw in `chain()`, which builds an
      // address, not a position.)
      if (item.name.trim() === '' || !lookupChain(observed, item.name).ok) continue;
      const key = addressKey(chainAt(container, item.name));
      this.chainPositions.set(key, item.index);
      if (item.id !== undefined) this.chainIds.set(key, item.id);
    }
  }

  /** Enumerate one relocation endpoint through a handle other than the writer. */
  private async relocationSequence(
    endpoint: TrackAddress | ChainAddress,
  ): Promise<RelocationSequence> {
    if (endpoint.kind === 'track') {
      const observed = await this.deviceChain(endpoint);
      if (observed === undefined) throw new AddressUnresolvedError(endpoint, 'track device chain is absent');
      return {
        devices: observed.devices,
        devicesComplete: !observed.blind,
        ...(observed.bankSize === undefined ? {} : { bankSize: observed.bankSize }),
      };
    }

    const scope = await this.containerScope(
      endpoint.container.track, endpoint.container.chainIndex);
    if (!scope.ok) {
      throw new AddressUnresolvedError(endpoint, `container structure is ${scope.miss}`);
    }
    this.recordChainPositions(endpoint.container, scope.container);
    const found = lookupChain(scope.container, endpoint.name);
    if (!found.ok) {
      const observed = scope.container.chains.map((item) => item.name).join(', ');
      throw new AddressUnresolvedError(
        endpoint,
        `chain name is ${found.miss}; observed chain names: [${observed}]`,
      );
    }
    return {
      devices: found.chain.devices,
      devicesComplete: found.chain.devicesComplete,
      ...(found.chain.devicesBankSize === undefined
        ? {} : { bankSize: found.chain.devicesBankSize }),
    };
  }

  /** Fresh source/destination reading, used both before and after the wire call. */
  private async relocationReading(
    op: Extract<Op, { op: 'chain.relocate' }>,
    preflight: boolean,
  ): Promise<RelocationReading> {
    if (op.source.chain?.kind === 'drumPad') {
      throw new InvalidOpError(op.op, 'a chain relocation cannot use a drum-pad parent');
    }
    const sourceEndpoint = op.source.chain ?? op.source.track;
    const source = await this.relocationSequence(sourceEndpoint);
    // A top-level MOVE from before the destination container compacts the top
    // device list. The wire correctly addresses the container at its pre-write
    // position; independent readback must address where that same container
    // moved, or it would inspect the now-empty old position and reject a write
    // that actually landed.
    const destination = await this.relocationSequence(
      !preflight
        && op.mode === 'move'
        && op.source.chain === undefined
        && op.destination.kind === 'chain'
        && op.source.chainIndex < op.destination.container.chainIndex
        ? chainAt(
          deviceAt(op.destination.container.track, op.destination.container.chainIndex - 1),
          op.destination.name,
        )
        : op.destination,
    );
    if (preflight) {
      if (!source.devicesComplete || !destination.devicesComplete) {
        throw new InvalidOpError(op.op, 'source and destination must both be fully inside their device bank windows');
      }
      const sourceDevice = source.devices.find((device) => device.index === op.source.chainIndex);
      if (sourceDevice === undefined) {
        throw new InvalidOpError(op.op, `no source device exists at index ${op.source.chainIndex}`);
      }
      if (destination.bankSize === undefined) {
        throw new InvalidOpError(op.op, 'the destination did not report its device-bank width');
      }
      if (destination.devices.length >= destination.bankSize) {
        throw new InvalidOpError(
          op.op,
          `the destination device bank is full at ${destination.devices.length}/${destination.bankSize}`,
        );
      }
      this.deviceNames.set(addressKey(op.source), sourceDevice.name);
    }
    return { source, destination };
  }

  /** Validate every projected relocation before the first settling stage writes. */
  private async assertRelocationsPreflight(ops: readonly Op[]): Promise<void> {
    const relocations = ops.filter((op): op is Extract<Op, { op: 'chain.relocate' }> =>
      op.op === 'chain.relocate');
    if (relocations.length === 0) return;

    const tracks = new Map<string, RelocationSequence>();
    const containers = new Map<string, ObservedContainer | undefined>();
    for (const trackRef of new Map(relocations.map((op) =>
      [op.source.track.channelId, op.source.track])).values()) {
      const observed = await this.relocationSequence(trackRef);
      tracks.set(trackRef.channelId, observed);
      for (const item of observed.devices) {
        const at = deviceAt(trackRef, item.index);
        const scope = await this.containerScope(trackRef, item.index);
        containers.set(addressKey(at), scope.ok ? scope.container : undefined);
      }
    }
    assertChainRelocatable(
      ops,
      (trackRef) => tracks.get(trackRef.channelId),
      (container) => containers.get(addressKey(container)),
    );
  }

  /** Poll structural readback until relocation is proved or the bounded window closes. */
  private async finishRelocation(
    op: Extract<Op, { op: 'chain.relocate' }>,
    before: RelocationReading,
  ): Promise<{ readonly ok: true } | { readonly ok: false; readonly why: string }> {
    const started = Date.now();
    let last = 'structural readback did not change';
    do {
      try {
        const after = await this.relocationReading(op, false);
        const proof = verifyDeviceRelocation(
          op.source.chainIndex,
          op.mode,
          before.source,
          before.destination,
          after.source,
          after.destination,
        );
        if (proof.ok) return { ok: true };
        last = proof.why;
      } catch (error) {
        last = error instanceof Error ? error.message : String(error);
      }
      if (Date.now() - started < 8000) await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() - started < 8000);
    return { ok: false, why: `relocation was not proved by structural readback: ${last}` };
  }

  /** Complete top-level reading around one before-anchor device reorder. */
  private async deviceReorderReading(
    op: Extract<Op, { op: 'device.relocate' }>,
    preflight: boolean,
  ): Promise<{ readonly reading: ObservedDeviceSequence; readonly sourceIndex: number }> {
    const reading = await this.relocationSequence(op.track);
    if (!reading.devicesComplete) {
      throw new InvalidOpError(op.op, 'the complete top-level device order must be observable');
    }
    const names = preflight
      ? this.guardedDeviceNames(
        op.track,
        { devices: reading.devices, blind: false, bankSize: reading.bankSize },
        op.expectedChain,
        op.expectedEnabledChain,
        op.op,
      )
      : reading.devices.map((item) => item.name);
    const sourceIndex = reading.devices.length - 1 - op.sourceFromEnd;
    if (preflight) {
      const source = reading.devices.find((item) => item.index === sourceIndex);
      const anchor = reading.devices.find((item) => item.index === op.before.chainIndex);
      if (source === undefined || anchor === undefined || source.name !== op.expectedName) {
        throw new InvalidOpError(op.op, 'the source and anchor must both exist in the current device order');
      }
      this.deviceNames.set(addressKey(op.before), anchor.name);
      this.deviceChainNames.set(
        op.track.channelId,
        names,
      );
      this.deviceTailIndices.set(
        `${op.track.channelId}\u0000${op.sourceFromEnd}\u0000${op.expectedName}`,
        sourceIndex,
      );
    }
    return { reading, sourceIndex };
  }

  /** Validate the complete projected reorder batch before its first stage. */
  private async assertDeviceReordersPreflight(ops: readonly Op[]): Promise<void> {
    const moves = ops.filter((op): op is Extract<Op, { op: 'device.relocate' }> =>
      op.op === 'device.relocate');
    if (moves.length === 0) return;
    const tracks = new Map<string, RelocationSequence>();
    for (const trackRef of new Map(moves.map((op) =>
      [op.track.channelId, op.track])).values()) {
      tracks.set(trackRef.channelId, await this.relocationSequence(trackRef));
    }
    assertDeviceRelocatable(ops, (trackRef) => tracks.get(trackRef.channelId));
  }

  /** Poll an independent full-device read until the requested order is proved. */
  private async finishDeviceReorder(
    op: Extract<Op, { op: 'device.relocate' }>,
    before: ObservedDeviceSequence,
    sourceIndex: number,
  ): Promise<{ readonly ok: true } | { readonly ok: false; readonly why: string }> {
    const started = Date.now();
    let last = 'device order did not change';
    do {
      try {
        const after = await this.deviceReorderReading(op, false);
        const proof = verifyDeviceReorder(
          sourceIndex, op.before.chainIndex, before, after.reading);
        if (proof.ok) return { ok: true };
        last = proof.why;
      } catch (error) {
        last = error instanceof Error ? error.message : String(error);
      }
      if (Date.now() - started < 8000) await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() - started < 8000);
    return { ok: false, why: `device reorder was not proved by structural readback: ${last}` };
  }

  /** Poll independent container readback until exactly one requested solo remains. */
  private async finishChainActivation(
    op: Extract<Op, { op: 'chain.activate' }>,
  ): Promise<{ readonly ok: true } | { readonly ok: false; readonly why: string }> {
    const started = Date.now();
    let last = 'container readback did not show the requested solo';
    do {
      const scope = await this.containerScope(
        op.chain.container.track, op.chain.container.chainIndex);
      if (scope.ok) {
        const proof = verifyExclusiveChain(scope.container, op.chain.name);
        if (proof.ok) return { ok: true };
        last = proof.why;
      } else {
        last = `the container became ${scope.miss}`;
      }
      if (Date.now() - started < 4000) await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() - started < 4000);
    return { ok: false, why: `exclusive switch was not proved by container readback: ${last}` };
  }

  /** Prove a rename by resolving the new name to the identity observed before it. */
  private async finishChainRename(
    op: Extract<Op, { op: 'chain.rename' }>,
    id: string,
  ): Promise<{ readonly ok: true } | { readonly ok: false; readonly why: string }> {
    const started = Date.now();
    let last = 'the new name did not resolve';
    do {
      const scope = await this.containerScope(
        op.chain.container.track, op.chain.container.chainIndex);
      if (scope.ok) {
        const found = lookupChain(scope.container, op.name);
        if (found.ok && found.chain.id === id) return { ok: true };
        last = found.ok ? 'the new name resolved to a different identity' : `the new name was ${found.miss}`;
      } else {
        last = `the container became ${scope.miss}`;
      }
      if (Date.now() - started < 4000) await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() - started < 4000);
    return { ok: false, why: `rename was not proved by container readback: ${last}` };
  }

  /**
   * ⚠⚠ Select the chain about to be copied — `e17ak`'s enabling half, sent as
   * ITS OWN REQUEST.
   *
   * `Channel.duplicate()` copies the chain that is SELECTED; with no selection
   * it is a silent no-op (`e17ak` arm A). E2 says a write is not visible to a
   * read in the same request, and the select in `e17ak` was fired a turn
   * earlier — so bundling it into the duplicate's own turn would rest on a
   * timing nobody measured, failing as a ○ that looks exactly like the route
   * being dead. The extension re-selects inside the duplicate as well; that one
   * is the belt, this one is the braces.
   *
   * ⚠ `expectedName` rides along so the extension refuses a bank position that
   * has re-indexed since it was observed, rather than selecting a chain nobody
   * addressed and copying that.
   *
   * ⚠ It waits `trackStruct`, and the number is borrowed rather than measured —
   * stated plainly because `budgets.ts` requires every number to cite one. No
   * chain-selection settle has ever been measured; the two neighbouring measured
   * budgets are 25ms for a cursor point (E1) and ~144ms for a structural change
   * (E1/E3), and the create takes the larger of the two once. Under-waiting here
   * produces a copy that never happened, so erring long is the cheap direction.
   */
  private async selectSourceChain(op: Extract<Op, { op: 'chain.create' }>): Promise<void> {
    await this.transport.send({
      method: WIRE.chainSelect,
      params: {
        slot: op.source.container.chainIndex,
        layerIndex: this.chainIndex(op.source),
        expectedName: op.source.name,
      },
    });
    await this.settle('trackStruct');
  }

  /**
   * ⚠⚠ NAME THE CHAIN THE COPY JUST MADE — the half of `chain.create` that no
   * encoder could emit, because it has to be told which chain that is.
   *
   * Four steps, in this order, and each one refuses rather than assuming:
   *
   *   1. **Observe the container again.** A write is not visible to a read in
   *      the same request (E2), so this is a new one, after the op's settle.
   *   2. **Diff by identity** (`mintedChain`, shared with the fake). The copy
   *      carries its SOURCE'S NAME, so nothing name-shaped can tell them apart
   *      and position is not a fallback — see that function for the five ways it
   *      declines.
   *   3. **Rename by the id the diff returned**, never by name or position. The
   *      extension refuses an id it cannot find, so a bank that re-indexed
   *      between the two calls is an error rather than a rename aimed at the
   *      source.
   *   4. ⚠ **Prove it by RESOLVING the new name**, on the object we created —
   *      the id has to match too. This is the acceptance criterion the slice was
   *      written to: *"success requires independent resolution/readback of the
   *      created chain; acknowledgement or the writer's selected handle is not
   *      proof"*. The writer's own belief is not consulted anywhere here.
   *
   * ⚠ A failure at any step leaves a real chain in the container, wearing the
   * source's name, and says so. Nothing rolls back, because nothing CAN: every
   * typed chain delete refuses (`e17al`, `e17am`). Silence would be the worst of
   * the available options — the container would be quietly ambiguous, and the
   * next resolve of the source's own name would start failing.
   */
  private async finishChainCreate(
    op: Extract<Op, { op: 'chain.create' }>,
    before: ContainerScope,
  ): Promise<{ ok: true; address: ChainAddress } | { ok: false; why: string }> {
    const container = op.source.container;
    // ⚠ The sentence comes from the contract, so the fake reports the same one.
    // Two hand-written copies is how the offline suite ends up asserting a
    // softer version of what a user actually sees.
    const unnamed = (why: string): { ok: false; why: string } =>
      ({ ok: false, why: chainCopyUnnamed(op.source.name, why) });

    // ⚠ The "before" reading is checked HERE rather than at the call site, so a
    // container that could not be observed before the copy can never be mistaken
    // for one that held no chains — which would make the diff below see the
    // whole container as new.
    if (!before.ok) return unnamed(`the container was not observable before the copy (${before.miss})`);
    const after = await this.containerScope(container.track, container.chainIndex);
    if (!after.ok) return unnamed(`the container became unobservable (${after.miss})`);
    const witness = mintedChain(before.container, after.container);
    if (!witness.ok) return unnamed(`the copy could not be identified: ${witness.why}`);

    // ⚠⚠ FROM HERE ON NOTHING MAY THROW, and the try is the mechanism rather
    // than defensive habit. The copy exists by this point, so a thrown error
    // would leave `apply` reporting nothing at all about a container that now
    // holds an unaddressable chain — and the extension really does refuse this
    // call, deliberately, when no chain carries the id (a bank that re-indexed
    // between the two readings). Refusing is right; escaping as an exception is
    // not, because the whole promise of this path is that a create which could
    // not be finished SAYS SO in the receipt. There is no typed delete to undo
    // it with, so the sentence is the entire remedy.
    try {
      await this.transport.send({
        method: WIRE.chainSetName,
        params: { slot: container.chainIndex, channelId: witness.chain.id, name: op.name },
      });
      // A rename is a name write, not a structural one; `trackStruct` is the
      // budget `track.rename` already pays for the same class of change.
      await this.settle('trackStruct');

      const settled = await this.containerScope(container.track, container.chainIndex);
      if (!settled.ok) return unnamed(`the container became unobservable after the rename (${settled.miss})`);
      const found = lookupChain(settled.container, op.name);
      if (!found.ok) return unnamed(`the new name reads back as ${found.miss}`);
      if (found.chain.id !== witness.chain.id) {
        return unnamed('the new name resolved to a DIFFERENT chain than the one that was created');
      }
      return { ok: true, address: chainAt(container, op.name) };
    } catch (error) {
      // ⚠ The message is carried verbatim rather than summarised: it is the
      // extension's own refusal, and it is the only thing that says WHY the
      // rename was declined.
      return unnamed(`the rename failed: ${error instanceof Error ? error.message : String(error)}`);
    }
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
    const preflightSelection = await this.beginSelectionBorrow(batch.ops.some((op) =>
      op.op === 'device.insert' || op.op === 'device.relocate'));
    try {
      const insertChains = new Map<string, RelocationSequence>();
      for (const trackRef of new Map(batch.ops
        .filter((op): op is Extract<Op, { op: 'device.insert' }> => op.op === 'device.insert')
        .map((op) => [op.track.channelId, op.track])).values()) {
        const observed = await this.stableDeviceChain(trackRef);
        if (observed !== undefined) {
          insertChains.set(trackRef.channelId, {
            devices: observed.devices,
            devicesComplete: !observed.blind,
            ...(observed.bankSize === undefined ? {} : { bankSize: observed.bankSize }),
          });
        }
      }
      assertDeviceInsertable(batch.ops, (trackRef) => insertChains.get(trackRef.channelId));
    // ⚠⚠ The chain-create preconditions, from the same shared contract function
    // the fake calls — the container is observable, the source names exactly one
    // chain, the new name is provably free, and the bank has room. Only the
    // observation is the adapter's.
    //
    // ⚠ It doubles as the encoder's source of truth for the source chain's bank
    // position, which is why the observations are recorded rather than
    // discarded: a chain has no position in its address, so the only honest one
    // comes from a reply, and it must come from a reply this batch took.
      const containers = await this.readContainers(batch.ops);
      assertChainCreatable(batch.ops, (container) => containers.get(addressKey(container)));
      assertChainRenamable(batch.ops, (container) => containers.get(addressKey(container)));
      assertChainActivatable(batch.ops, (container) => containers.get(addressKey(container)));
      await this.assertRelocationsPreflight(batch.ops);
      await this.assertDeviceReordersPreflight(batch.ops);
    } finally {
      await this.restoreSelection(preflightSelection);
    }
    this.deviceNames.clear();
    this.deviceEnabledValues.clear();
    this.deviceChainNames.clear();
    this.deviceChainEnabled.clear();
    this.deviceTailIndices.clear();

    type LiveStage = Stage & { readonly writerPageStart?: number };
    const writerSteps = this.fineSteps ?? this.gridSteps ?? 64;
    const stages: LiveStage[] = planStages(batch.ops).flatMap((stage) => {
      const props = stage.ops.length === 1 && stage.ops[0]?.op === 'note.props'
        ? stage.ops[0]
        : undefined;
      if (props === undefined) return [stage];
      const pages = notePropertyPageStarts(props.notes, writerSteps);
      return pages.length === 0
        ? [stage]
        : pages.map((writerPageStart) => ({ ...stage, writerPageStart }));
    });
    for (const stage of stages) {
      const clips = new Set(stage.ops
        .filter((op) => op.op === 'clip.update' || op.op === 'note.clear' || op.op === 'note.write')
        .map((op) => addressKey(op.clip)));
      if (clips.size > this.pool.size) {
        throw new InvalidOpError(
          'clip targets',
          `one write stage addresses ${clips.size} clips through cursors, but only `
            + `${this.pool.size} writer cursors can confirm targets before the turn`,
        );
      }
    }
    const receipts: StageReceipt[] = [];
    const minted: Record<number, Address> = {};
    const writerViews = new Map<string, WriterView>();
    const confirmedMutationTargets = new Set<AddressKey>();
    let guard = batch.ifRevision;
    // ⚠ D6, E14-F: pointing borrows the user's clip selection, and a whole batch
    // costs exactly ONE observable selection change — so one restore at the end
    // suffices. Captured before the first stage, because by the end the cursor
    // has already moved.
    const selection = await this.beginSelectionBorrow(batch.ops.some(borrowsSelection));

    try {
      // Validate every note grid before any stage can mutate the project. Then
      // confirm every page of each target that exists at batch start. A clip
      // that this batch creates, duplicates, or moves cannot be pointed at yet;
      // its stage keeps the same check immediately before its first write.
      const createdClipKeys = new Set<AddressKey>();
      for (const op of batch.ops) {
        if (op.op === 'clip.create') createdClipKeys.add(addressKey(clipAt(op.slot)));
        if (op.op === 'clip.duplicate' || op.op === 'clip.move') {
          createdClipKeys.add(addressKey(clipAt(op.destination)));
        }
        if (op.op === 'note.write' || op.op === 'note.props') {
          notePageStarts(op.notes, this.fineSteps ?? this.gridSteps ?? 64);
        }
      }
      for (const stage of stages) {
        const preflightSkip = new Set<AddressKey>([
          ...createdClipKeys,
          ...confirmedMutationTargets,
        ]);
        await this.confirmClipMutationStage(
          stage.ops,
          writerViews,
          preflightSkip,
          stage.writerPageStart,
        );
        for (const op of stage.ops) {
          if (op.op === 'note.write' || op.op === 'note.props') {
            const key = addressKey(op.clip);
            if (!createdClipKeys.has(key)) confirmedMutationTargets.add(key);
          }
        }
      }
      await this.resetWriterViews(writerViews);
      await this.armNoteWake(batch.ops);
    } catch (error) {
      this.pendingNoteWake = undefined;
      try { await this.resetWriterViews(writerViews); } catch {}
      await this.restoreSelection(selection);
      throw error;
    }

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
      if (insertOp?.op === 'device.insert') {
        let names: readonly string[];
        try {
          names = this.guardedDeviceNames(
            insertOp.track, chainBefore, insertOp.expectedChain,
            insertOp.expectedEnabledChain, insertOp.op,
          );
        } catch (error) {
          await this.restoreSelection(selection);
          throw error;
        }
        this.deviceChainNames.set(
          insertOp.track.channelId,
          names,
        );
      }

      // ⚠⚠ And a chain create needs the same bracket, one level down and with a
      // WRITE in the middle of it — see `finishChainCreate`. Taken here, freshly,
      // rather than reusing the precondition reading above: that one was taken
      // before the whole batch, and an earlier stage may have moved the world.
      //
      // ⚠ `OP_SETTLE['chain.create']` is not `instant`, so `planStages` gives it
      // a stage to itself and these two observations bracket exactly one op.
      const createAt = stage.ops.findIndex((o) => o.op === 'chain.create');
      const createOp = createAt === -1 ? undefined : stage.ops[createAt];
      const containerBefore = createOp?.op === 'chain.create'
        ? await this.containerScope(
          createOp.source.container.track, createOp.source.container.chainIndex)
        : undefined;
      if (createOp?.op === 'chain.create' && containerBefore?.ok === true) {
        // ⚠ The positions the ENCODER will use come from THIS reading, not from
        // the pre-batch one. A container re-indexes when a chain is added, and an
        // earlier stage in the same batch is allowed to have added one.
        this.recordChainPositions(createOp.source.container, containerBefore.container);
        await this.selectSourceChain(createOp);
      }

      const renameAt = stage.ops.findIndex((o) => o.op === 'chain.rename');
      const renameOp = renameAt === -1 ? undefined : stage.ops[renameAt];
      let renameId: string | undefined;
      if (renameOp?.op === 'chain.rename') {
        try {
          const scope = await this.containerScope(
            renameOp.chain.container.track, renameOp.chain.container.chainIndex);
          assertChainRenamable([renameOp], () => scope.ok ? scope.container : undefined);
          if (scope.ok) this.recordChainPositions(renameOp.chain.container, scope.container);
          renameId = this.chainId(renameOp.chain);
        } catch (error) {
          await this.restoreSelection(selection);
          throw error;
        }
      }

      // Relocation is one settling op per stage, so this reading brackets
      // exactly one device transfer. It also refreshes both chain positions and
      // the source-name identity guard used by the encoder.
      const relocateAt = stage.ops.findIndex((o) => o.op === 'chain.relocate');
      const relocateOp = relocateAt === -1 ? undefined : stage.ops[relocateAt];
      let relocationBefore: RelocationReading | undefined;
      try {
        relocationBefore = relocateOp?.op === 'chain.relocate'
          ? await this.relocationReading(relocateOp, true)
          : undefined;
      } catch (error) {
        this.pendingNoteWake = undefined;
        await this.restoreSelection(selection);
        throw error;
      }
      const reorderAt = stage.ops.findIndex((o) => o.op === 'device.relocate');
      const reorderOp = reorderAt === -1 ? undefined : stage.ops[reorderAt];
      let reorderBefore: { readonly reading: ObservedDeviceSequence; readonly sourceIndex: number } | undefined;
      try {
        reorderBefore = reorderOp?.op === 'device.relocate'
          ? await this.deviceReorderReading(reorderOp, true)
          : undefined;
      } catch (error) {
        this.pendingNoteWake = undefined;
        await this.restoreSelection(selection);
        throw error;
      }
      // A switch is also one settling op per stage. Re-read immediately before
      // encoding so its positional wire target comes from current structure.
      const activateAt = stage.ops.findIndex((o) => o.op === 'chain.activate');
      const activateOp = activateAt === -1 ? undefined : stage.ops[activateAt];
      if (activateOp?.op === 'chain.activate') {
        try {
          const scope = await this.containerScope(
            activateOp.chain.container.track, activateOp.chain.container.chainIndex);
          assertChainActivatable(
            [activateOp],
            () => scope.ok ? scope.container : undefined,
          );
          if (scope.ok) this.recordChainPositions(activateOp.chain.container, scope.container);
        } catch (error) {
          await this.restoreSelection(selection);
          throw error;
        }
      }

      const enabledOp = stage.ops.length === 1 && stage.ops[0]?.op === 'device.setEnabled'
        ? stage.ops[0]
        : undefined;
      let enabledBefore: WireDevice | undefined;
      if (enabledOp !== undefined) {
        const chain = await this.deviceChain(enabledOp.device.track);
        let names: readonly string[];
        try {
          names = this.guardedDeviceNames(
            enabledOp.device.track, chain, enabledOp.expectedChain,
            enabledOp.expectedEnabledChain, enabledOp.op,
          );
        } catch (error) {
          await this.restoreSelection(selection);
          throw error;
        }
        const found = chain?.devices.find((item) => item.index === enabledOp.device.chainIndex);
        if (found === undefined
            || found.enabled === undefined
            || (enabledOp.expectedName !== undefined && found.name !== enabledOp.expectedName)) {
          await this.restoreSelection(selection);
          throw new AddressUnresolvedError(
            enabledOp.device,
            'the complete device chain did not confirm the enabled-state target',
          );
        }
        enabledBefore = found;
        this.deviceNames.set(addressKey(enabledOp.device), found.name);
        this.deviceEnabledValues.set(addressKey(enabledOp.device), found.enabled);
        this.deviceChainNames.set(
          enabledOp.device.track.channelId,
          names,
        );
      }

      const deleteOp = stage.ops.length === 1 && stage.ops[0]?.op === 'device.delete'
        ? stage.ops[0]
        : undefined;
      if (deleteOp !== undefined) {
        const chain = await this.deviceChain(deleteOp.device.track);
        let names: readonly string[];
        try {
          names = this.guardedDeviceNames(
            deleteOp.device.track, chain, deleteOp.expectedChain,
            deleteOp.expectedEnabledChain, deleteOp.op,
          );
        } catch (error) {
          await this.restoreSelection(selection);
          throw error;
        }
        const found = chain?.devices.find((item) => item.index === deleteOp.device.chainIndex);
        if (found === undefined
            || (deleteOp.expectedName !== undefined && found.name !== deleteOp.expectedName)) {
          await this.restoreSelection(selection);
          throw new AddressUnresolvedError(
            deleteOp.device,
            'the complete device chain did not confirm the deletion target',
          );
        }
        this.deviceChainNames.set(
          deleteOp.device.track.channelId,
          names,
        );
      }

      // Confirm targets that the batch-wide preflight could not yet resolve,
      // such as a clip that an earlier stage created. Cached targets keep their
      // confirmed writer view through the remaining dependency turns.
      try {
        await this.confirmClipMutationStage(
          stage.ops,
          writerViews,
          confirmedMutationTargets,
          stage.writerPageStart,
        );
        for (const op of stage.ops) {
          if (op.op === 'note.write' || op.op === 'note.props') {
            confirmedMutationTargets.add(addressKey(op.clip));
          }
        }
      } catch (error) {
        this.pendingNoteWake = undefined;
        try { await this.resetWriterViews(writerViews); } catch {}
        await this.restoreSelection(selection);
        throw error;
      }

      const parameterOp = stage.ops.length === 1 && stage.ops[0]?.op === 'param.set'
        ? stage.ops[0]
        : undefined;
      let parameterBefore: Extract<ParameterInventory, { standing: 'stable' }> | undefined;
      if (parameterOp !== undefined) {
        const row = this.bank.find((item) =>
          item.channelId === parameterOp.param.device.track.channelId);
        if (row === undefined) {
          await this.restoreSelection(selection);
          throw new AddressUnresolvedError(parameterOp.param, 'the parameter track is not visible');
        }
        let names: readonly string[] | undefined;
        if (parameterOp.expectedChain !== undefined) {
          const chain = await this.deviceChain(parameterOp.param.device.track);
          try {
            names = this.guardedDeviceNames(
              parameterOp.param.device.track,
              chain,
              parameterOp.expectedChain,
              parameterOp.expectedEnabledChain,
              parameterOp.op,
            );
          } catch (error) {
            await this.restoreSelection(selection);
            throw error;
          }
        }
        const inventory = await this.parameterInventory(parameterOp.param.device, row);
        if (inventory.standing !== 'stable') {
          await this.restoreSelection(selection);
          throw new AddressUnresolvedError(
            parameterOp.param,
            `the parameter inventory is ${inventory.standing}`,
          );
        }
        if (this.parameterState(parameterOp.param, inventory) === undefined) {
          await this.restoreSelection(selection);
          throw new AddressUnresolvedError(parameterOp.param, 'the parameter id is not in the stable inventory');
        }
        if (parameterOp.expectedName !== undefined
            && inventory.deviceName !== parameterOp.expectedName) {
          await this.restoreSelection(selection);
          throw new AddressUnresolvedError(
            parameterOp.param,
            `the parameter device was "${inventory.deviceName}", expected "${parameterOp.expectedName}"`,
          );
        }
        if (names !== undefined) {
          this.deviceChainNames.set(parameterOp.param.device.track.channelId, names);
          this.deviceNames.set(addressKey(parameterOp.param.device), inventory.deviceName);
        }
        parameterBefore = inventory;
      }
      const remoteOp = stage.ops.length === 1 && stage.ops[0]?.op === 'remote.set'
        ? stage.ops[0]
        : undefined;
      let remoteBefore: Extract<RemoteInventory, { standing: 'stable' }> | undefined;
      if (remoteOp !== undefined) {
        const row = this.bank.find((item) =>
          item.channelId === remoteOp.remote.device.track.channelId);
        if (row === undefined) {
          await this.restoreSelection(selection);
          throw new AddressUnresolvedError(remoteOp.remote, 'the remote-control track is not visible');
        }
        const inventory = await this.remoteInventory(remoteOp.remote.device, row);
        if (inventory.standing !== 'stable'
            || this.remoteState(remoteOp.remote, inventory) === undefined) {
          await this.restoreSelection(selection);
          throw new AddressUnresolvedError(
            remoteOp.remote,
            `the remote-control inventory is ${inventory.standing} or its target did not settle`,
          );
        }
        remoteBefore = inventory;
      }

      let result: BatchRunResult;
      try {
        result = await this.sendStage(stage.ops, guard, writerViews, stage.writerPageStart);
      } catch (error) {
        this.pendingNoteWake = undefined;
        try { await this.resetWriterViews(writerViews); } catch {}
        await this.restoreSelection(selection);
        throw error;
      }

      // ⚠ E8-D: this guarded stage applied nothing. Earlier dependency turns
      // can already have landed, so keep their receipts and stop without replay.
      // Restore the user's selection in both cases.
      if (result.rejected) {
        this.pendingNoteWake = undefined;
        await this.resetWriterViews(writerViews);
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

      const receipt: StageReceipt = {
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
      };
      receipts.push(receipt);

      // Each stage guards on what the previous one returned, so an interfering
      // write between stages is caught for free.
      guard = result.revision;

      if (stage.settle !== undefined) await this.settle(stage.settle);

      if (parameterOp !== undefined && parameterBefore !== undefined
          && receipts[receipts.length - 1]!.ops.every((entry) => entry.ok)) {
        const row = this.bank.find((item) =>
          item.channelId === parameterOp.param.device.track.channelId);
        const wireCompletion = result.results?.find((entry) =>
          entry.method === WIRE.directParamSet)?.result as {
            readonly completionGeneration?: unknown;
          } | undefined;
        const completionGeneration = wireCompletion?.completionGeneration;
        const completed = typeof completionGeneration === 'number'
          ? await this.directParameterCompletion(
            parameterOp.param,
            parameterBefore.deviceName,
            completionGeneration,
            parameterOp.value,
          )
          : undefined;
        const after = completed !== undefined || row === undefined
          ? undefined
          : await this.parameterInventory(parameterOp.param.device, row);
        const state = completed ?? (after?.standing === 'stable'
          ? this.parameterState(parameterOp.param, after)
          : undefined);
        const sameTarget = completed !== undefined
          || (after?.standing === 'stable' && after.deviceName === parameterBefore.deviceName);
        if (!sameTarget || state === undefined || Math.abs(state.value - parameterOp.value) > 2e-3) {
          const readback = state?.value;
          const why = after?.standing === 'stable'
            ? `parameter readback disagreed: requested ${parameterOp.value}, got ${readback ?? 'missing'}`
            : `parameter readback was ${after?.standing ?? 'unstable'}`;
          const ops = receipts[receipts.length - 1]!.ops.map((entry) =>
            (entry.op === WIRE.directParamSet || entry.op === WIRE.paramSet
              || entry.op === 'param.set')
              ? { ...entry, ok: false, error: why }
              : entry);
          receipts[receipts.length - 1] = { ...receipts[receipts.length - 1]!, ops };
        }
      }
      if (remoteOp !== undefined && remoteBefore !== undefined
          && receipts[receipts.length - 1]!.ops.every((entry) => entry.ok)) {
        const row = this.bank.find((item) =>
          item.channelId === remoteOp.remote.device.track.channelId);
        const after = row === undefined
          ? { standing: 'missing' as const }
          : await this.remoteInventory(remoteOp.remote.device, row);
        const state = after.standing === 'stable'
          ? this.remoteState(remoteOp.remote, after)
          : undefined;
        const sameTarget = after.standing === 'stable'
          && after.deviceName === remoteBefore.deviceName;
        if (!sameTarget || state === undefined || Math.abs(state.value - remoteOp.value) > 2e-3) {
          const why = after.standing === 'stable'
            ? `remote readback disagreed: requested ${remoteOp.value}, got ${state?.value ?? 'missing'}`
            : `remote readback was ${after.standing}`;
          const ops = receipts[receipts.length - 1]!.ops.map((entry) =>
            entry.op === WIRE.remoteSet || entry.op === 'remote.set'
              ? { ...entry, ok: false, error: why }
              : entry);
          receipts[receipts.length - 1] = { ...receipts[receipts.length - 1]!, ops };
        }
      }
      if (enabledOp !== undefined && enabledBefore !== undefined
          && receipts[receipts.length - 1]!.ops.every((entry) => entry.ok)) {
        const after = await this.deviceChain(enabledOp.device.track);
        const state = after?.devices.find((item) => item.index === enabledOp.device.chainIndex);
        const sameStructure = after !== undefined && !after.blind
          && after.devices.length > enabledOp.device.chainIndex
          && state?.name === enabledBefore.name;
        if (!sameStructure || state?.enabled !== enabledOp.enabled) {
          const why = state === undefined
            ? 'device enabled readback was missing'
            : `device enabled readback disagreed: requested ${enabledOp.enabled}, got ${state.enabled ?? 'unobserved'}`;
          const ops = receipts[receipts.length - 1]!.ops.map((entry) =>
            entry.op === WIRE.deviceSetEnabled || entry.op === 'device.setEnabled'
              ? { ...entry, ok: false, error: why }
              : entry);
          receipts[receipts.length - 1] = { ...receipts[receipts.length - 1]!, ops };
        }
      }

      // ⚠ AFTER the settle and BEFORE `pool.invalidate()`. `deviceInsert` is the
      // slowest budget measured (600ms, E3) precisely because the device is not
      // in the chain until it lands, so a diff taken any earlier would report the
      // chain we already had and mint nothing — the failure that looks like a
      // missing capability rather than a race.
      if (insertOp?.op === 'device.insert') {
        const chainAfter = chainBefore === undefined
          ? undefined
          : await this.deviceChain(insertOp.track);
        const at = stage.opIndices[insertAt];
        const chainIndex = chainBefore === undefined || chainAfter === undefined
          ? undefined
          : mintedChainIndex(chainBefore, chainAfter);
        if (at !== undefined && chainIndex !== undefined) {
          minted[at] = { kind: 'device', track: insertOp.track, chainIndex };
        } else {
          const insertMethods = new Set<string>([
            WIRE.deviceInsertBitwig, WIRE.deviceInsertVst3,
            WIRE.deviceInsertClap, WIRE.deviceInsertFile,
          ]);
          const ops = receipts[receipts.length - 1]!.ops.map((entry) =>
            insertMethods.has(entry.op)
              ? { ...entry, ok: false, error: 'device insertion was not proved by structural readback' }
              : entry);
          receipts[receipts.length - 1] = { ...receipts[receipts.length - 1]!, ops };
        }
      }

      // ⚠⚠ The chain create's SECOND HALF, after its settle for the same reason
      // the device mint waits for its own: the copy is not in the bank until it
      // lands, and a diff taken earlier would see the container we already had.
      if (createOp?.op === 'chain.create' && containerBefore !== undefined) {
        const at = stage.opIndices[createAt];
        const named = await this.finishChainCreate(createOp, containerBefore);
        if (named.ok) {
          if (at !== undefined) minted[at] = named.address;
        } else {
          // ⚠⚠ REPORTED AS A FAILED OP, and this is the one place in `apply`
          // where a stage's own `ok` is overruled from outside the wire result.
          // The reason is that the wire told the truth and it is not the whole
          // truth: `chain.duplicate` really did apply, and the op it belongs to
          // did not — the copy is sitting in the container wearing its source's
          // name, where `lookupChain` will refuse both of them as `ambiguous`.
          // Letting the receipt say `ok` would report a create that produced an
          // unaddressable chain as a success, and there is no typed delete to
          // clean it up with, so the user has to be told.
          // ⚠ Matched against BOTH names on purpose. A verbose reply labels each
          // entry with the WIRE method it ran; the fallback above labels them
          // with the contract op. Matching only one would silently stop
          // reporting the failure the day the other shape is taken.
          const ops = receipt.ops.map((entry) =>
            (entry.op === WIRE.chainDuplicate || entry.op === 'chain.create'
              ? { ...entry, ok: false, error: named.why }
              : entry));
          receipts[receipts.length - 1] = { ...receipt, ops };
        }
      }
      if (renameOp?.op === 'chain.rename' && renameId !== undefined
          && receipts[receipts.length - 1]!.ops.every((entry) => entry.ok)) {
        const proved = await this.finishChainRename(renameOp, renameId);
        if (!proved.ok) {
          const ops = receipts[receipts.length - 1]!.ops.map((entry) =>
            (entry.op === WIRE.chainSetName || entry.op === 'chain.rename'
              ? { ...entry, ok: false, error: proved.why }
              : entry));
          receipts[receipts.length - 1] = { ...receipts[receipts.length - 1]!, ops };
        }
      }
      if (relocateOp?.op === 'chain.relocate' && relocationBefore !== undefined
          && receipts[receipts.length - 1]!.ops.every((entry) => entry.ok)) {
        const proved = await this.finishRelocation(relocateOp, relocationBefore);
        if (!proved.ok) {
          const ops = receipts[receipts.length - 1]!.ops.map((entry) =>
            (entry.op === WIRE.chainMove || entry.op === 'chain.relocate'
              ? { ...entry, ok: false, error: proved.why }
              : entry));
          receipts[receipts.length - 1] = {
            ...receipts[receipts.length - 1]!,
            ops,
          };
        }
      }
      if (reorderOp?.op === 'device.relocate' && reorderBefore !== undefined
          && receipts[receipts.length - 1]!.ops.every((entry) => entry.ok)) {
        const proved = await this.finishDeviceReorder(
          reorderOp, reorderBefore.reading, reorderBefore.sourceIndex);
        if (!proved.ok) {
          const ops = receipts[receipts.length - 1]!.ops.map((entry) =>
            (entry.op === WIRE.deviceMoveTo || entry.op === 'device.relocate'
              ? { ...entry, ok: false, error: proved.why }
              : entry));
          receipts[receipts.length - 1] = { ...receipts[receipts.length - 1]!, ops };
        }
      }
      if (activateOp?.op === 'chain.activate'
          && receipts[receipts.length - 1]!.ops.every((entry) => entry.ok)) {
        const proved = await this.finishChainActivation(activateOp);
        if (!proved.ok) {
          const ops = receipts[receipts.length - 1]!.ops.map((entry) =>
            (entry.op === WIRE.chainActivate || entry.op === 'chain.activate'
              ? { ...entry, ok: false, error: proved.why }
              : entry));
          receipts[receipts.length - 1] = { ...receipts[receipts.length - 1]!, ops };
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
        await this.resetWriterViews(writerViews);
        writerViews.clear();
        confirmedMutationTargets.clear();
        this.pool.invalidate();
        this.heldClips.clear();
        // Logical invalidation is not enough. Reads pin the physical writer
        // cursors, and a pinned cursor ignores later selection changes. Release
        // every writer cursor and wait before the next stage.
        for (const cursor of this.pool.references) {
          await this.transport.send({
            method: WIRE.cursorPin,
            params: { cursor, pinned: false },
          });
          await this.transport.send({
            method: WIRE.cursorPinTrack,
            params: { cursor, pinned: false },
          });
        }
        await this.settle('cursorPoint');
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

    await this.resetWriterViews(writerViews);
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
    const wake = budget === 'noteWrite' ? this.pendingNoteWake : undefined;
    if (wake === undefined) {
      await new Promise((resolve) => setTimeout(resolve, SETTLE_MS[budget]));
      return;
    }
    this.pendingNoteWake = undefined;
    const started = performance.now();
    try {
      const read = await this.transport.send({
        method: WIRE.noteObserverRead,
        params: { afterSequence: wake.afterSequence },
      }) as NoteWakeRead;
      const eligible = read.dropped === 0
        && (read.firstRetainedSequence === undefined
          || read.firstRetainedSequence <= wake.afterSequence + 1)
        && (read.events ?? []).some((event) => event.armed === true
          && event.generation === wake.generation
          && event.trackId === wake.trackId
          && event.trackIndex === wake.trackIndex
          && event.slotIndex === wake.slotIndex
          && typeof event.sequence === 'number'
          && event.sequence > wake.afterSequence);
      if (eligible) {
        this.onTiming?.({ phase: 'firstCallback', elapsedMs: performance.now() - started });
        return;
      }
    } catch {
      // The fixed budget below is the recorded fallback.
    }
    const elapsed = performance.now() - started;
    const remaining = Math.max(0, SETTLE_MS.noteWrite - elapsed);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    this.onTiming?.({ phase: 'observerFallback', elapsedMs: performance.now() - started });
  }

  async showClipInEditor(
    clipRef: ClipAddress,
    verifiedAt: RevisionMark,
  ): Promise<ClipNavigationResult> {
    // Resolve the durable track identity now. The bank index stays inside the
    // adapter and is checked again by the narrow handler before any UI call.
    const resolution = await this.resolve([clipRef]);
    if (resolution.at.revision !== verifiedAt.revision
        || resolution.at.generation !== verifiedAt.generation
        || resolution.at.project !== verifiedAt.project
        || resolution.at.sceneEpoch !== verifiedAt.sceneEpoch
        || resolution.at.contentEpoch !== verifiedAt.contentEpoch) {
      return {
        navigated: false,
        layoutRequested: 'EDIT',
        layoutConfirmed: false,
        why: 'Bitwig state changed after the clip target was verified',
      };
    }
    const target = resolution.resolved[0];
    if (target?.found !== true || target.index === undefined) {
      return {
        navigated: false,
        layoutRequested: 'EDIT',
        layoutConfirmed: false,
        why: `the recorded clip address is ${target?.reason ?? 'unresolved'}`,
      };
    }
    const reply = (await this.transport.send({
      method: WIRE.showChangedClip,
      params: {
        trackIndex: target.index,
        expectedChannelId: clipRef.slot.track.channelId,
        slotIndex: clipRef.slot.scene.index,
        expectedRevision: verifiedAt.revision,
        expectedGeneration: verifiedAt.generation,
        expectedProject: verifiedAt.project,
        expectedSceneEpoch: verifiedAt.sceneEpoch,
        expectedContentEpoch: verifiedAt.contentEpoch,
      },
    })) as {
      navigated?: boolean;
      layout?: string;
      error?: string;
    };
    return {
      navigated: reply.navigated === true,
      layoutRequested: 'EDIT',
      layoutConfirmed: reply.layout === 'EDIT',
      ...(reply.navigated === true ? {} : { why: reply.error ?? 'Bitwig did not open the clip' }),
    };
  }

  async close(): Promise<void> {
    await this.transport.close();
  }
}
