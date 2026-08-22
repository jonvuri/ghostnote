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
  assertChainActivatable, assertChainCreatable, assertChainRelocatable, assertChainRenamable, assertClipSources, assertDeviceRelocatable, assertDevicesRoutable, assertOpsAddressable, assertOpsWritable, assertSceneRoom, assertTrackRoom, assertSlotsFree, budgetTicks,
  chain as chainAt, chainCopyUnnamed, contentDelta,
  hasUnverifiedProps, lookupChain, lookupNestedDevice, mintedChain, nestingObservable, orderedNoteProps, stepSizeFor,
  verifyDeviceRelocation, verifyDeviceReorder, verifyExclusiveChain,
  type Address, type AdapterInfo, type BatchReceipt, type BatchRequest, type BitwigAdapter,
  type ClipAddress, type ClipMetadataState, type ClipNavigationResult, type ContentDelta, type DeviceAddress, type Fidelity, type NoteRecord, type ObservedContainer,
  type Op, type OpReceipt, type ResolveResult,
  type ParamState, type ResolvedAddress, type RevisionMark, type SceneAddress, type SettleBudget, type Snapshot,
  type StageReceipt, type StateEntry, type TrackState, type WindowCoverage,
} from '../../contract/index.js';
import { INSTRUMENT_LAYER_SEED_BASENAME } from '../../device-alternates/assets.js';
import { basename } from 'node:path';
import { planStages } from '../../contract/index.js';
import { VirtualClock } from './clock.js';
import { ProjectModel, noteKey, type FakeDevice, type FakeTrack } from './model.js';
import {
  applyNotePropsInOrder, bankBlindSpot, gridChangePoisonsRead, noteOnReadback, pointAtSlot,
  propsReadsTurnStartClip, stepDataIsStale, writeNoteProps, type PointOrigin,
} from './traps.js';

/** How the fake names the clip a cursor points at. Identity, never index (E2f). */
const clipKey = (channelId: string, sceneIndex: number): string => `${channelId}:${sceneIndex}`;

const clipMetadataState = (slot: import('./model.js').FakeSlot): ClipMetadataState => ({
  name: slot.name,
  color: { ...slot.color },
  lengthBeats: slot.lengthBeats,
  playStartBeats: slot.playStartBeats,
  loopEnabled: slot.loopEnabled,
  loopStartBeats: slot.loopStartBeats,
  loopEndBeats: slot.loopStartBeats + slot.lengthBeats,
});

function fakeParamState(
  param: FakeDevice['params'][number],
  index: number,
  typed: boolean,
): ParamState {
  const observed = {
    display: param.display !== undefined,
    modulatedValue: param.modulatedValue !== undefined,
    hasAutomation: param.hasAutomation !== undefined,
  };
  return {
    id: param.id ?? `param-${index}`,
    ...(typed ? { index } : {}),
    name: param.name,
    value: param.value,
    observed,
    ...(param.display === undefined ? {} : { display: param.display }),
    ...(param.modulatedValue === undefined ? {} : { modulatedValue: param.modulatedValue }),
    ...(param.hasAutomation === undefined ? {} : { hasAutomation: param.hasAutomation }),
  };
}

function consumeStaleParameterInventory(model: ProjectModel): boolean {
  if (model.staleParameterInventories <= 0) return false;
  model.staleParameterInventories--;
  return true;
}

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
  /** Last explicit UI focus request. It is not project state. */
  lastNavigation: ClipAddress | undefined;

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

  async devices(trackRef: import('../../contract/index.js').TrackAddress) {
    const track = this.requireTrack(trackRef, 'devices');
    return {
      devices: track.devices.slice(0, this.model.deviceBankSize)
        .map((item, index) => ({ index, name: item.name })),
      devicesComplete: track.devices.length <= this.model.deviceBankSize,
      bankSize: this.model.deviceBankSize,
    };
  }

  private mark(): RevisionMark {
    return {
      revision: this.model.revision,
      sceneEpoch: this.model.sceneEpoch,
      contentEpoch: this.model.contentEpoch,
      generation: this.model.generation,
      project: this.model.project,
      // ⚠ The same two pairs the live adapter assembles off the wire. Reporting
      // the WINDOW's occupancy here instead of the project total would make every
      // fake window look covered, which is the fake certifying a reach live
      // Bitwig does not have (B2, session 3c).
      window: {
        tracks: { count: this.model.trackCount, bankSize: this.model.trackBankSize },
        scenes: { count: this.model.sceneCount, bankSize: this.model.sceneBankSize },
      },
    };
  }

  /** The scene window every row-bearing address is measured against. */
  private get sceneWindow(): WindowCoverage {
    return { count: this.model.sceneCount, bankSize: this.model.sceneBankSize };
  }

  /**
   * ⚠ Where a scene ROW falls relative to the window — the live adapter's
   * `sceneRowStanding`, and it must answer identically or the conformance suite
   * is proving two different things.
   */
  private sceneRowStanding(row: SceneAddress): 'visible' | 'unreachable' | 'absent' {
    if (row.index < this.model.sceneBankSize) return 'visible';
    return row.index >= this.model.sceneCount ? 'absent' : 'unreachable';
  }

  async revision(): Promise<RevisionMark> {
    return this.mark();
  }

  /**
   * ⚠ The same slicing the live adapter does, over the same ring size, so the
   * offline suite cannot be kinder about a dropped event than Bitwig is.
   *
   * A mark from another generation is answered rather than thrown, because this
   * is a REPORT: the caller decides whether an incomparable window is fatal
   * (a reversal) or merely worth surfacing (a finished batch).
   */
  async contentSince(since: RevisionMark): Promise<ContentDelta> {
    return contentDelta(since, this.mark(), this.model.contentRing);
  }

  /** The fake has no UI selection, but shares the executor's pipeline shape. */
  async preserveSelection<T>(work: () => Promise<T>): Promise<T> {
    return work();
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
      // ⚠ The row before the track, exactly as live: a row outside the scene
      // window is unaddressable however reachable its track is, and `found` for
      // one hands back an index the bank rejects (E19's stranded scene).
      if (sceneRef !== undefined) {
        const standing = this.sceneRowStanding(sceneRef);
        if (standing === 'unreachable') {
          return { address, found: false, reason: 'outside-bank-window' as const };
        }
        if (standing === 'absent') return { address, found: false, reason: 'absent' as const };
      }
      const trackRef = addressTrack(address);
      if (trackRef === undefined) return { address, found: true };
      const hit = this.model.findByChannelId(trackRef.channelId);
      if (hit !== undefined) {
        // ⚠⚠ Resolving the durable TRACK anchor is not resolving the structure
        // hanging off it. Every chain-family address is walked to the end
        // through the container scopes, or refused with the reason that says
        // which of the four things happened — see `resolveNested`.
        if (address.kind === 'device' && address.chain === undefined) {
          if (address.chainIndex >= this.model.deviceBankSize) {
            return { address, found: false, reason: 'outside-bank-window' as const };
          }
          return hit.track.devices[address.chainIndex] === undefined
            ? { address, found: false, reason: 'absent' as const }
            : { address, found: true, index: address.chainIndex };
        }
        if (address.kind === 'param' && address.device.chain === undefined) {
          const device = hit.track.devices[address.device.chainIndex];
          if (address.device.chainIndex >= this.model.deviceBankSize) {
            return { address, found: false, reason: 'outside-bank-window' as const };
          }
          if (device === undefined) return { address, found: false, reason: 'absent' as const };
          this.model.parameterObservationGeneration++;
          if (!device.paramsLive || consumeStaleParameterInventory(this.model)) {
            return { address, found: false, reason: 'unstable' as const };
          }
          const found = address.directId !== undefined
            ? device.params.some((item, at) =>
              (item.id ?? `param-${at}`) === address.directId)
            : address.index !== undefined && device.params[address.index] !== undefined;
          return found
            ? { address, found: true, index: address.device.chainIndex }
            : { address, found: false, reason: 'absent' as const };
        }
        if (address.kind === 'chain' || address.kind === 'device' || address.kind === 'param') {
          const nested = this.resolveNested(address, hit.track);
          if (nested !== undefined) return nested;
        }
        return { address, found: true, index: hit.index };
      }
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

  /**
   * Chain-family resolution, or `undefined` when the address is not one.
   *
   * ⚠⚠ The whole point is that a `found` here is earned by walking the PATH.
   * Before step 6b both adapters answered every chain-family address
   * `unsupported` on the grounds that no lookup had happened; now one has, and
   * the four ways it can fail are kept apart because each asserts a different
   * observed fact: `unsupported` (no route could look), `outside-bank-window`
   * (we looked at a bank that may not hold everything), `ambiguous` (the name
   * matched more than one chain) and `absent` (we saw the whole bank and it is
   * not there).
   *
   * ⚠ A nested PARAM stays `unsupported` even now, and the distinction is not
   * pedantry: resolving a device is a statement about a device handle, and a
   * parameter hangs off a SEPARATE handle that nothing has built or measured
   * inside a chain. Promoting it implicitly is how a `param.set` ends up aimed
   * at whatever the top-level parameter list has at that index.
   */
  private resolveNested(address: Address, track: FakeTrack): ResolvedAddress | undefined {
    if (address.kind === 'param') {
      return address.device.chain === undefined
        ? undefined
        : { address, found: false, reason: 'unsupported' as const };
    }
    if (address.kind === 'device' && address.chain === undefined) return undefined;
    if (address.kind !== 'chain' && address.kind !== 'device') return undefined;
    if (!nestingObservable(address)) {
      return { address, found: false, reason: 'unsupported' as const };
    }
    const container = address.kind === 'chain' ? address.container : address.chain!.container;
    const observed = this.model.observeContainer(track, container.chainIndex);
    if (observed === undefined) {
      return { address, found: false, reason: 'outside-bank-window' as const };
    }
    if (address.kind === 'chain') {
      const found = lookupChain(observed, address.name);
      return found.ok
        ? { address, found: true, index: found.chain.index }
        : { address, found: false, reason: found.miss };
    }
    const found = lookupNestedDevice(observed, address);
    return found.ok
      ? { address, found: true, index: found.device.index }
      : { address, found: false, reason: found.miss };
  }

  /**
   * ⚠ The bank VIEW, not the project — so the tracks a caller can be handed are
   * exactly the tracks it can then address, and the ones beyond the window are
   * absent from the answer rather than listed and unusable.
   *
   * How many were left out is on the mark (`window.tracks`), which is where the
   * live adapter puts it too; a listing that carried its own count would be a
   * second reading of the same fact.
   */
  async tracks(): Promise<readonly TrackState[]> {
    return this.model.visibleTracks().map((t, index) => ({
      channelId: t.channelId,
      name: t.name,
      position: index,
      type: t.type,
    }));
  }

  /** Reads COMMITTED state only — never flushes pending, never advances the clock. */
  async read(sel: readonly Address[]): Promise<Snapshot> {
    const entries: Record<string, StateEntry> = {};
    const missing: Address[] = [];
    const unreachable: Address[] = [];
    const unstable: Address[] = [];
    const parameterReads = new Map<string, readonly ParamState[] | 'unstable'>();

    for (const address of sel) {
      const sceneRef = addressScene(address);
      if (sceneRef !== undefined && sceneRef.epoch !== this.model.sceneEpoch) {
        throw new StaleAddressError(address, sceneRef.epoch, this.model.sceneEpoch);
      }
      // ⚠⚠ B1c: a clip ROW past the scene window is UNREACHABLE, not missing —
      // the same classification the live adapter makes, from the same numbers.
      if (sceneRef !== undefined) {
        const standing = this.sceneRowStanding(sceneRef);
        if (standing !== 'visible') {
          (standing === 'unreachable' ? unreachable : missing).push(address);
          continue;
        }
      }
      const trackRef = addressTrack(address);
      const hit = trackRef ? this.model.findByChannelId(trackRef.channelId) : undefined;
      if (trackRef !== undefined && hit === undefined) {
        // ⚠ Out of the bank window is UNREACHABLE, not missing (E5).
        if (this.model.existsAnywhere(trackRef.channelId)) unreachable.push(address);
        else missing.push(address);
        continue;
      }
      const entry = this.readOne(address, hit?.track, hit?.index ?? -1, parameterReads);
      // ⚠ Same three-way answer the live adapter gives: an entry, "nothing is
      // there" (missing), or "we could not look" (unreachable). The third one is
      // what a chain-family address gets when its container has no scope.
      if (entry === 'unreachable') unreachable.push(address);
      else if (entry === 'unstable') unstable.push(address);
      else if (entry === undefined) missing.push(address);
      else entries[addressKey(address)] = entry;
    }

    return { contract: CONTRACT_TAG, at: this.mark(), entries, missing, unreachable, unstable };
  }

  private readOne(
    address: Address,
    track: FakeTrack | undefined,
    index: number,
    parameterReads: Map<string, readonly ParamState[] | 'unstable'>,
  ): StateEntry | 'unreachable' | 'unstable' | undefined {
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
        // ⚠ AMENDED 2026-08-07 (D16, §3.3.3). Both adapters said `none` here and
        // meant two different things by it — the fake populated `lengthBeats`
        // and the live adapter did not, which is PHASE-0 §Risks' named failure
        // mode sitting unexercised because nothing read the field. The label is
        // now derived from the same fact on both sides:
        //
        //   absent — restorable EXACTLY, by deleting whatever the batch created
        //            (D16d: absence has no content to fail to recreate);
        //   present — restorable as a clip of the captured length carrying the
        //            stashed notes, minus the metadata nothing can read back.
        if (!slotState.hasContent) {
          return { address, fidelity: 'exact', value: { of: 'clip', exists: false } };
        }
        return {
          address,
          fidelity: 'lossy',
          value: { of: 'clip', exists: true, lengthBeats: slotState.lengthBeats },
        };
      }
      case 'clipMetadata': {
        const slotState = track?.slots[address.clip.slot.scene.index];
        if (slotState === undefined || !slotState.hasContent) return undefined;
        return {
          address,
          fidelity: 'exact',
          value: { of: 'clipMetadata', metadata: clipMetadataState(slotState) },
        };
      }
      case 'notes': {
        const slotState = track?.slots[address.clip.slot.scene.index];
        // ⚠ A slot with no clip has no note state to report, and reporting an
        // EMPTY one instead is a fake/live divergence with teeth: `LiveAdapter`
        // checks `slot.status` and returns `undefined` here, so the fake used to
        // answer "the clip is empty" where Bitwig answers "there is no clip".
        // The executor's E2 guard reads exactly this distinction to refuse a
        // write into a never-created slot, so the fake certifying the softer
        // answer would let the guard pass offline and mispoint live — PHASE-0
        // §Risks' named failure mode.
        if (slotState === undefined || !slotState.hasContent) return undefined;
        const channelPrefix = `${address.channel}:`;
        const all = [...slotState.notes.entries()]
          .filter(([key]) => key.startsWith(channelPrefix))
          .map(([, note]) => note)
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
      case 'clipLaunch': {
        const slotState = track?.slots[address.clip.slot.scene.index];
        if (slotState === undefined || !slotState.hasContent) return undefined;
        return { address, fidelity: 'exact', value: { of: 'clipLaunch', launch: {
          quantization: slotState.launchQuantization,
          mode: slotState.launchMode,
          useLoopStartAsQuantizationReference: slotState.useLoopStartAsQuantizationReference,
        } } };
      }
      case 'clipPlay': {
        const slotState = track?.slots[address.clip.slot.scene.index];
        if (slotState === undefined) return undefined;
        return { address, fidelity: 'exact', value: { of: 'clipPlay', play: {
          hasContent: slotState.hasContent,
          isPlaying: slotState.isPlaying,
          isPlaybackQueued: slotState.isPlaybackQueued,
          isStopQueued: slotState.isStopQueued,
          playingStep: slotState.isPlaying ? 0 : -1,
          sampledAtMs: this.clock.tick,
          playPosition: 0,
        } } };
      }
      // ⚠ A chain reads back as WHAT WAS OBSERVED — its position, its name and
      // the devices in it — and as nothing else. There is no chain state a
      // reversal could replay: creation exists only as duplication of an
      // existing chain (`e17ak`) and every typed delete refuses (`e17al`,
      // `e17am`), so the entry is `none` and `revertOps` files it unrestored.
      case 'chain': {
        if (track === undefined || !nestingObservable(address)) return undefined;
        const observed = this.model.observeContainer(track, address.container.chainIndex);
        if (observed === undefined) return 'unreachable';
        const found = lookupChain(observed, address.name);
        // ⚠ Ambiguity and absence both read as NO ENTRY, deliberately. A read
        // reports what is there; the reason lives on `resolve`, which is the
        // call a caller makes before it acts. Inventing a "which one did you
        // mean" value here would put a refusal inside a stash.
        return found.ok ? { address, fidelity: 'none', value: { of: 'chain', chain: found.chain } } : undefined;
      }
      case 'device': {
        // ⚠ NESTED IS NOT INDEXABLE IN THE TRACK'S LIST. `chainIndex` counts
        // positions inside `address.chain`, so the nested case walks the
        // container scopes instead of reaching into `track.devices`, and it
        // reports NO PARAMS — the enumeration has no parameter handle, and an
        // empty list would claim a device with no controls.
        if (address.chain !== undefined) {
          if (track === undefined) return undefined;
          const observed = this.model.observeContainer(track, address.chain.container.chainIndex);
          if (observed === undefined) return 'unreachable';
          const found = lookupNestedDevice(observed, address);
          return found.ok
            ? {
              address,
              fidelity: 'none',
              value: { of: 'device', device: { chainIndex: found.device.index, name: found.device.name } },
            }
            : undefined;
        }
        if (track === undefined) return undefined;
        // ⚠⚠ UNREACHABLE past the container scopes, and the fake reports it even
        // though its own list could answer — because live cannot. `device.list`
        // reads a device bank; the CONTAINER structure and the device names this
        // entry carries both come from the slot scopes, which exist at the first
        // `containerScopes` positions and nowhere else. A fake that answered
        // here would certify a read live Bitwig has no route for, which is
        // PHASE-0 §Risks' named failure mode pointed the wrong way.
        const dev = track.devices[address.chainIndex];
        if (dev === undefined) {
          return address.chainIndex >= this.model.containerScopes ? 'unreachable' : undefined;
        }
        const key = addressKey(address);
        let params = parameterReads.get(key);
        if (params === undefined) {
          this.model.parameterObservationGeneration++;
          params = !dev.paramsLive || consumeStaleParameterInventory(this.model)
            ? 'unstable'
            : dev.params.map((item, at) => fakeParamState(item, at, false));
          parameterReads.set(key, params);
        }
        if (params === 'unstable') return 'unstable';
        const observed = this.model.observeContainer(track, address.chainIndex);
        return {
          address,
          fidelity: 'none',
          value: {
            of: 'device',
            device: {
              chainIndex: address.chainIndex,
              name: dev.name,
              params,
              // ⚠ The bootstrap: a container's read is how anything ever learns
              // what its chains are CALLED, because a chain is addressed by name
              // and has no address of its own to be enumerated by.
              ...(observed === undefined ? {} : { container: observed }),
            },
          },
        };
      }
      case 'param': {
        // Same reason as the device case above: a param on a nested device hangs
        // off a list this model does not have.
        if (address.device.chain !== undefined) return undefined;
        const dev = track?.devices[address.device.chainIndex];
        if (dev === undefined) return undefined;
        const deviceKey = addressKey(address.device);
        let inventory = parameterReads.get(deviceKey);
        if (inventory === undefined) {
          this.model.parameterObservationGeneration++;
          inventory = !dev.paramsLive || consumeStaleParameterInventory(this.model)
            ? 'unstable'
            : dev.params.map((item, at) => fakeParamState(item, at, false));
          parameterReads.set(deviceKey, inventory);
        }
        if (inventory === 'unstable') return 'unstable';
        const found = address.directId !== undefined
          ? inventory.find((item) => item.id === address.directId)
          : address.index === undefined ? undefined : dev.params[address.index];
        if (found === undefined) return undefined;
        const state = address.directId !== undefined
          ? found as ParamState
          : fakeParamState(found as FakeDevice['params'][number], address.index!, true);
        return { address, fidelity: 'exact', value: { of: 'param', param: state } };
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
    // ⚠ And the same for a device inside a layer chain. This model is FLAT — one
    // device list per track — so an unguarded nested address would index straight
    // into it and mutate the wrong device, which is precisely what the live route
    // would do. The fake must never be the permissive one.
    assertDevicesRoutable(batch.ops);

    // ⚠ Standing rule 5: never operate on a partially-visible project.
    const blind = bankBlindSpot(this.model);
    if (blind !== undefined) {
      throw new BankWindowOverflowError('tracks', blind.visible, blind.total, this.model.trackBankSize);
    }
    assertTrackRoom(batch.ops, {
      count: this.model.trackCount,
      bankSize: this.model.trackBankSize,
    });
    // ⚠⚠ Rule 5's SECOND population, from the same shared contract functions the
    // live adapter calls — a create that would land past the scene window, and an
    // op naming a row already past it. Both are preconditions: a scene minted
    // outside the window is unaddressable and un-deletable, so a post-hoc check
    // runs after the damage (E19, and rule 5's own words).
    assertSceneRoom(batch.ops, this.sceneWindow);
    assertOpsAddressable(batch.ops, this.sceneWindow);
    // ⚠⚠ E21, the door the scene budget above does not cover: a `clip.create`
    // into an OCCUPIED slot appends a row at the END of the project, past the
    // window. The rule is the contract's; only the lookup is the fake's.
    assertSlotsFree(batch.ops, (s) => {
      const hit = this.model.findByChannelId(s.track.channelId);
      return hit?.track.slots[s.scene.index]?.hasContent;
    });
    assertClipSources(batch.ops, (s) => {
      const hit = this.model.findByChannelId(s.track.channelId);
      return hit?.track.slots[s.scene.index]?.hasContent;
    });
    // ⚠⚠ The chain-create preconditions, from the same shared contract function
    // the live adapter calls: the container is observable, the source names
    // exactly one chain, the new name is provably free, and the chain bank has
    // room. Only the LOOKUP is the fake's — the refusals are the contract's, so
    // neither adapter can be the lenient one and a conformance row can assert
    // them on both.
    assertChainCreatable(batch.ops, (container) => this.observeAt(container));
    assertChainRenamable(batch.ops, (container) => this.observeAt(container));
    assertChainActivatable(batch.ops, (container) => this.observeAt(container));
    assertChainRelocatable(
      batch.ops,
      (trackRef) => {
        const track = this.requireTrack(trackRef, 'chain.relocate');
        return {
          devices: track.devices.slice(0, this.model.deviceBankSize)
            .map((item, index) => ({ index, name: item.name })),
          devicesComplete: track.devices.length <= this.model.deviceBankSize,
          bankSize: this.model.deviceBankSize,
        };
      },
      (container) => this.observeAt(container),
    );
    assertDeviceRelocatable(batch.ops, (trackRef) => {
      const track = this.requireTrack(trackRef, 'device.relocate');
      return {
        devices: track.devices.slice(0, this.model.deviceBankSize)
          .map((item, index) => ({ index, name: item.name })),
        devicesComplete: track.devices.length <= this.model.deviceBankSize,
        bankSize: this.model.deviceBankSize,
      };
    });

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

  /**
   * The clip the pool cursor is holding RIGHT NOW.
   *
   * ⚠ Must be read BEFORE the op re-points, because `cursorClip` moves
   * immediately while the staged closure that uses it runs at commit (E15-D). It
   * feeds E2's trial 2: a point that finds nothing to attach to leaves the cursor
   * on the clip it already had, which is usually on another track.
   */
  private cursorOrigin(): PointOrigin | undefined {
    const hit = this.model.resolveClipKey(this.model.cursorClip);
    return hit === undefined ? undefined : { slot: hit.slot, sceneIndex: hit.sceneIndex };
  }

  /**
   * The container at a top-level device position, as an observation — the fake's
   * half of `chain.inventory`, in the shape the contract's guards take.
   *
   * ⚠ `undefined` means the position is past `containerScopes`, i.e. NOTHING WAS
   * LOOKED AT, and every caller treats that as a refusal rather than as "no
   * chains". A position inside the scopes that holds no container is a different
   * answer and reports an empty, complete container — see `observeContainer`.
   *
   * ⚠ An unresolvable track THROWS rather than answering `undefined`, so the two
   * cannot be conflated: "your track is not in the window" and "we cannot see
   * that deep into this track" are different refusals with different fixes.
   */
  private observeAt(container: DeviceAddress): ObservedContainer | undefined {
    const track = this.requireTrack(container.track, 'chain.create');
    return this.model.observeContainer(track, container.chainIndex);
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
        const origin = this.cursorOrigin();
        // Pointing is cursor state, so it moves NOW rather than at commit — a
        // re-point steers the calls that follow it in the same turn (E15-D).
        this.model.cursorClip = clipKey(op.clip.slot.track.channelId, sceneIndex);
        this.clock.stage(() => {
          // ⚠ E2: pointing at an empty slot silently lands on the WRONG clip.
          const point = pointAtSlot(track, sceneIndex, origin);
          // ⚠ E2 with nothing reachable: the cursor holds no clip and the write
          // is inert. This is what makes a missing `clip.create` fail offline
          // instead of silently landing somewhere else on a real project.
          if (point.slot === undefined) return;
          const written = notesToWrite.map(writeNoteProps);
          // ⚠ E8-E: same-pitch adjacency truncates; readback != request.
          const channelPrefix = `${channel}:`;
          const existingChannel = [...point.slot.notes.entries()]
            .filter(([key]) => key.startsWith(channelPrefix))
            .map(([, note]) => note);
          const merged = [...existingChannel, ...written];
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
        const origin = this.cursorOrigin();
        this.model.cursorClip = clipKey(op.clip.slot.track.channelId, sceneIndex);
        this.clock.stage(() => {
          const point = pointAtSlot(track, sceneIndex, origin);
          if (point.slot === undefined) return;
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
        const origin = this.cursorOrigin();
        this.model.cursorClip = clipKey(op.clip.slot.track.channelId, sceneIndex);
        this.clock.stage(() => {
          // ⚠ E2 again, and worse here than for a write: a mispointed clear wipes
          // a clip nobody addressed. Reproduced rather than prevented.
          const point = pointAtSlot(track, sceneIndex, origin);
          point.slot?.notes.clear();
        });
        return;
      }

      case 'clip.create': {
        const track = this.requireTrack(op.slot.track, op.op);
        const sceneIndex = op.slot.scene.index;
        const length = op.lengthBeats;
        this.clock.stage(() => {
          const slotState = track.slots[sceneIndex];
          if (slotState === undefined) return;
          // ⚠⚠ E21, REPRODUCED rather than prevented — `apply` refuses this
          // before it can happen, and modelling it is what turns removing that
          // refusal into a failing offline test instead of a project that grows
          // a row every time a case runs.
          if (slotState.hasContent) {
            this.model.appendSceneForOverflowingClip(track, length);
            return;
          }
          // Through the model, so the launcher-content observer fires exactly
          // where Bitwig's would — see `ProjectModel.setSlotContent`.
          this.model.setSlotContent(track, sceneIndex, true);
          slotState.lengthBeats = length;
          slotState.name = '';
          slotState.color = { red: 87, green: 97, blue: 198 };
          slotState.playStartBeats = 0;
          slotState.playStopBeats = length;
          slotState.loopEnabled = true;
          slotState.loopStartBeats = 0;
        });
        return;
      }

      case 'clip.delete': {
        const track = this.requireTrack(op.slot.track, op.op);
        const sceneIndex = op.slot.scene.index;
        this.clock.stage(() => {
          const slotState = track.slots[sceneIndex];
          if (slotState !== undefined) {
            this.model.setSlotContent(track, sceneIndex, false);
            slotState.lengthBeats = 0;
            slotState.name = '';
            slotState.color = { red: 87, green: 97, blue: 198 };
            slotState.playStartBeats = 0;
            slotState.playStopBeats = 0;
            slotState.loopEnabled = true;
            slotState.loopStartBeats = 0;
            slotState.notes.clear();
          }
        });
        return;
      }

      case 'clip.update': {
        const track = this.requireTrack(op.clip.slot.track, op.op);
        const sceneIndex = op.clip.slot.scene.index;
        this.clock.stage(() => {
          const target = track.slots[sceneIndex];
          if (target === undefined || !target.hasContent) return;
          target.name = op.metadata.name;
          target.color = { ...op.metadata.color };
          target.playStartBeats = op.metadata.playStartBeats;
          target.playStopBeats = op.metadata.loopEndBeats;
          target.loopEnabled = op.metadata.loopEnabled;
          target.loopStartBeats = op.metadata.loopStartBeats;
          target.lengthBeats = op.metadata.loopEndBeats - op.metadata.loopStartBeats;
        });
        return;
      }

      case 'clip.duplicate': {
        const track = this.requireTrack(op.source.slot.track, op.op);
        const sourceIndex = op.source.slot.scene.index;
        const destinationIndex = op.destination.scene.index;
        this.clock.stage(() => {
          const source = track.slots[sourceIndex];
          const destination = track.slots[destinationIndex];
          if (source === undefined || destination === undefined || !source.hasContent) return;
          this.model.setSlotContent(track, destinationIndex, true);
          destination.lengthBeats = source.lengthBeats;
          destination.name = source.name;
          destination.color = { ...source.color };
          destination.playStartBeats = source.playStartBeats;
          destination.playStopBeats = source.playStopBeats;
          destination.loopEnabled = source.loopEnabled;
          destination.loopStartBeats = source.loopStartBeats;
          destination.notes = new Map(source.notes);
          destination.launchQuantization = source.launchQuantization;
          destination.launchMode = source.launchMode;
          destination.useLoopStartAsQuantizationReference = source.useLoopStartAsQuantizationReference;
        });
        return;
      }

      case 'clip.move': {
        const from = this.requireTrack(op.source.slot.track, op.op);
        const to = this.requireTrack(op.destination.track, op.op);
        const sourceIndex = op.source.slot.scene.index;
        const destinationIndex = op.destination.scene.index;
        this.clock.stage(() => {
          const source = from.slots[sourceIndex];
          const destination = to.slots[destinationIndex];
          if (source === undefined || destination === undefined || !source.hasContent) return;
          destination.lengthBeats = source.lengthBeats;
          destination.name = source.name;
          destination.color = { ...source.color };
          destination.playStartBeats = source.playStartBeats;
          destination.playStopBeats = source.playStopBeats;
          destination.loopEnabled = source.loopEnabled;
          destination.loopStartBeats = source.loopStartBeats;
          destination.notes = new Map(source.notes);
          destination.launchQuantization = source.launchQuantization;
          destination.launchMode = source.launchMode;
          destination.useLoopStartAsQuantizationReference = source.useLoopStartAsQuantizationReference;
          this.model.setSlotContent(to, destinationIndex, true);
          this.model.setSlotContent(from, sourceIndex, false);
          source.lengthBeats = 0;
          source.name = '';
          source.color = { red: 87, green: 97, blue: 198 };
          source.playStartBeats = 0;
          source.playStopBeats = 0;
          source.loopEnabled = true;
          source.loopStartBeats = 0;
          source.notes.clear();
        });
        return;
      }

      case 'clip.launch': {
        const track = this.requireTrack(op.clip.slot.track, op.op);
        const sceneIndex = op.clip.slot.scene.index;
        this.clock.stage(() => {
          for (const slot of track.slots) slot.isPlaying = false;
          const slot = track.slots[sceneIndex];
          if (slot?.hasContent) slot.isPlaying = true;
        });
        return;
      }

      case 'clip.launchSettings': {
        const track = this.requireTrack(op.clip.slot.track, op.op);
        const sceneIndex = op.clip.slot.scene.index;
        this.clock.stage(() => {
          const slot = track.slots[sceneIndex];
          if (slot === undefined || !slot.hasContent) return;
          slot.launchQuantization = op.quantization;
          slot.launchMode = op.mode;
          slot.useLoopStartAsQuantizationReference = op.useLoopStartAsQuantizationReference;
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

      case 'track.duplicate': {
        this.requireTrack(op.track, op.op);
        const copy = this.model.duplicateTrack(op.track.channelId);
        if (copy === undefined) throw new AddressUnresolvedError(op.track, 'track.duplicate target disappeared');
        minted[opIndex] = { kind: 'track', channelId: copy.channelId };
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
        const isInstrumentSeed = op.source.from === 'file'
          && basename(op.source.path) === INSTRUMENT_LAYER_SEED_BASENAME;
        const name = isInstrumentSeed
          ? 'Instrument Layer'
          : op.source.from === 'file' ? op.source.path.split('/').pop()! : op.source.uuid;
        // ⚠ A container inserted by uuid arrives with the chains its type ships
        // with — one for an FX Layer, none for an Instrument Layer (`e17ai`,
        // E18a at three destinations). That asymmetry is the bootstrap fact the
        // whole lifecycle turns on, so the fake models it rather than treating
        // every inserted device as an opaque box.
        const shipped = isInstrumentSeed
          ? [{
            name: 'fake-seed-alternate',
            mute: false,
            solo: false,
            volume: 1,
            pan: 0.5,
            color: { red: 0.341, green: 0.38, blue: 0.776 },
            id: this.model.mintChannelId(),
            devices: [],
          }]
          : op.source.from === 'file' ? undefined : this.model.shippedChains(op.source.uuid);
        const device: FakeDevice = {
          name,
          paramsLive: false,
          params: Array.from({ length: 12 }, (_, index) => ({
            id: `P${index + 1}`,
            name: `Param ${index + 1}`,
            value: 0.5,
          })),
          ...(shipped === undefined ? {} : { chains: shipped }),
        };
        track.devices.push(device);
        // ⚠ The chain index the insert PRODUCED, read off the chain rather than
        // predicted — the same discipline `track.create` follows (E2c). It is
        // what `revertOps` turns into the exact inverse (D16 amendment 2), and
        // emitting it from anything but an observation is how a revert deletes a
        // device nobody addressed.
        minted[opIndex] = { kind: 'device', track: op.track, chainIndex: track.devices.length - 1 };
        // ⚠ E4: the device exists immediately but its parameters are not readable
        // for another ~194ms. A timer, not a tick counter, is what expresses that.
        this.clock.after('paramsLive', `paramsLive:${name}`, () => { device.paramsLive = true; });
        return;
      }

      case 'device.delete': {
        const track = this.requireTrack(op.device.track, op.op);
        const current = track.devices[op.device.chainIndex];
        if (op.expectedName !== undefined && current?.name !== op.expectedName) {
          throw new UnsupportedOpError(
            `${op.op}: expected "${op.expectedName}" at position ${op.device.chainIndex}, got "${current?.name ?? ''}"`,
            'fake',
          );
        }
        this.model.deleteDevice(track, op.device.chainIndex);
        return;
      }

      case 'device.relocate': {
        const track = this.requireTrack(op.track, op.op);
        const before = {
          devices: track.devices.map((item, index) => ({ index, name: item.name })),
          devicesComplete: track.devices.length <= this.model.deviceBankSize,
        };
        const sourceIndex = track.devices.length - 1 - op.sourceFromEnd;
        const source = track.devices[sourceIndex];
        const anchor = track.devices[op.before.chainIndex];
        if (source === undefined || anchor === undefined || source.name !== op.expectedName) {
          throw new UnsupportedOpError(`${op.op}: source or anchor is absent`, 'fake');
        }
        track.devices.splice(sourceIndex, 1);
        const anchorAt = track.devices.indexOf(anchor);
        track.devices.splice(anchorAt, 0, source);
        const after = {
          devices: track.devices.map((item, index) => ({ index, name: item.name })),
          devicesComplete: track.devices.length <= this.model.deviceBankSize,
        };
        const proof = verifyDeviceReorder(
          sourceIndex, op.before.chainIndex, before, after);
        if (!proof.ok) throw new UnsupportedOpError(`${op.op}: ${proof.why}`, 'fake');
        return;
      }

      case 'param.set': {
        const track = this.requireTrack(op.param.device.track, op.op);
        const device = track.devices[op.param.device.chainIndex];
        if (device === undefined) throw new UnsupportedOpError(`param.set on missing device`, 'fake');
        const index = op.param.directId !== undefined
          ? device.params.findIndex((param, at) => (param.id ?? `param-${at}`) === op.param.directId)
          : op.param.index ?? -1;
        const value = op.value;
        this.clock.stage(() => {
          const p = device.params[index];
          if (p !== undefined && this.model.parameterWritesTake) p.value = value;
        });
        return;
      }

      // ⚠⚠ Chain creation, and the fake runs the same TWO-STEP the live adapter
      // runs rather than a shortcut, because the interesting part is the middle.
      //
      // `Channel.duplicate()` hands back nothing (E6 blocker 4: the
      // acknowledgement is identical whether or not anything happened) and the
      // copy arrives wearing its source's name, so the only way to know which
      // chain is the new one is to observe the container before and after and
      // diff by identity. That diff is `mintedChain`, it lives in the contract,
      // and running it here is what makes a bug in it fail offline instead of
      // live — the fake performing the copy and simply remembering the answer
      // would exercise nothing.
      case 'chain.create': {
        const track = this.requireTrack(op.source.container.track, op.op);
        const containerIndex = op.source.container.chainIndex;
        const before = this.model.observeContainer(track, containerIndex);
        const copy = this.model.duplicateChain(track, containerIndex, op.source.name);
        const after = this.model.observeContainer(track, containerIndex);
        // ⚠ `assertChainCreatable` proved all of this before the batch started;
        // reaching any of these is a bug in this adapter, not a refusal a caller
        // can provoke, so it throws rather than silently minting nothing.
        if (before === undefined || after === undefined || copy === undefined) {
          throw new UnsupportedOpError('chain.create: the container stopped being observable', 'fake');
        }
        // ⚠⚠ FAILS LOUDLY and leaves the copy in place, exactly as live does.
        // The chain is really there, it is wearing the source's name, and
        // nothing renamed it — so this THROWS, which `apply` turns into an
        // `ok: false` op receipt carrying the reason.
        //
        // ⚠ It used to `return` here, and that was the fake being kinder than
        // Bitwig in the one direction PHASE-0 §Risks forbids: the batch reported
        // `ok: true` for a create that had produced an unaddressable chain, while
        // the live adapter reported it failed. The sentence comes from the
        // contract so the two cannot drift apart again.
        //
        // ⚠ With the batch-cumulative preconditions in place these are no longer
        // REACHABLE from the fake's public surface — nothing races this model, so
        // the projected container and the real one agree. They stay because the
        // live adapter's equivalents are reachable (a real bank re-indexes, and
        // the extension really does refuse a rename it cannot aim), and an
        // adapter pair whose failure SHAPES differ is one the conformance suite
        // cannot speak about at all.
        const witness = mintedChain(before, after);
        if (!witness.ok) {
          throw new UnsupportedOpError(chainCopyUnnamed(op.source.name, witness.why), 'fake');
        }
        this.model.renameChain(track, containerIndex, witness.chain.id!, op.name);
        // ⚠ And the mint is only claimed once the NAME resolves — the readback
        // discipline, not the writer's own belief. `lookupChain` refuses the
        // ambiguity a failed rename would have left, so this is the assertion
        // that the whole two-step landed.
        const settled = this.model.observeContainer(track, containerIndex);
        const found = settled === undefined ? undefined : lookupChain(settled, op.name);
        if (found?.ok !== true) {
          throw new UnsupportedOpError(
            chainCopyUnnamed(op.source.name, `the new name reads back as ${found?.ok === false ? found.miss : 'unreadable'}`),
            'fake',
          );
        }
        if (found.chain.id !== witness.chain.id) {
          throw new UnsupportedOpError(
            chainCopyUnnamed(
              op.source.name,
              'the new name resolved to a DIFFERENT chain than the one that was created'),
            'fake',
          );
        }
        minted[opIndex] = chainAt(op.source.container, op.name);
        return;
      }

      case 'chain.rename': {
        const track = this.requireTrack(op.chain.container.track, op.op);
        const observed = this.model.observeContainer(track, op.chain.container.chainIndex);
        const found = observed === undefined ? undefined : lookupChain(observed, op.chain.name);
        if (found?.ok !== true || found.chain.id === undefined) {
          throw new UnsupportedOpError(`${op.op}: the addressed chain is not uniquely observable`, 'fake');
        }
        this.model.renameChain(track, op.chain.container.chainIndex, found.chain.id, op.name);
        const settled = this.model.observeContainer(track, op.chain.container.chainIndex);
        const renamed = settled === undefined ? undefined : lookupChain(settled, op.name);
        if (renamed?.ok !== true || renamed.chain.id !== found.chain.id) {
          throw new UnsupportedOpError(`${op.op}: the new name was not independently resolved`, 'fake');
        }
        return;
      }

      case 'chain.relocate': {
        const track = this.requireTrack(op.source.track, op.op);
        const findChain = (address: typeof op.destination & { kind: 'chain' }) => {
          const chains = track.devices[address.container.chainIndex]?.chains;
          const matches = chains?.filter((chain) => chain.name === address.name) ?? [];
          if (matches.length !== 1) {
            throw new UnsupportedOpError(
              `${op.op}: chain "${address.name}" ${matches.length === 0 ? 'is absent' : 'is ambiguous'}`,
              'fake',
            );
          }
          return matches[0]!.devices;
        };
        const sourceDevices = op.source.chain === undefined
          ? track.devices
          : findChain(op.source.chain);
        const destinationDevices = op.destination.kind === 'track'
          ? track.devices
          : findChain(op.destination);
        const sourceLimit = op.source.chain === undefined
          ? this.model.deviceBankSize
          : this.model.chainDeviceBankSize;
        const destinationLimit = op.destination.kind === 'track'
          ? this.model.deviceBankSize
          : this.model.chainDeviceBankSize;
        if (sourceDevices.length > sourceLimit || destinationDevices.length >= destinationLimit) {
          throw new UnsupportedOpError(
            `${op.op}: source or destination is outside its device bank window`, 'fake');
        }
        const observe = (devices: readonly FakeDevice[], limit: number) => ({
          devices: devices.slice(0, limit).map((device, index) => ({ index, name: device.name })),
          devicesComplete: devices.length <= limit,
        });
        const beforeSource = observe(sourceDevices, sourceLimit);
        const beforeDestination = observe(destinationDevices, destinationLimit);
        const source = sourceDevices[op.source.chainIndex];
        if (source === undefined) {
          throw new UnsupportedOpError(`${op.op}: no source device at index ${op.source.chainIndex}`, 'fake');
        }
        const clone = (device: FakeDevice): FakeDevice => ({
          ...device,
          params: device.params.map((param) => ({ ...param })),
          ...(device.chains === undefined ? {} : {
            chains: device.chains.map((chain) => ({
              ...chain,
              id: this.model.mintChannelId(),
              devices: chain.devices.map(clone),
            })),
          }),
        });
        if (op.mode === 'move') sourceDevices.splice(op.source.chainIndex, 1);
        destinationDevices.push(op.mode === 'copy' ? clone(source) : source);
        const proof = verifyDeviceRelocation(
          op.source.chainIndex,
          op.mode,
          beforeSource,
          beforeDestination,
          observe(sourceDevices, sourceLimit),
          observe(destinationDevices, destinationLimit),
        );
        if (!proof.ok) throw new UnsupportedOpError(`${op.op}: ${proof.why}`, 'fake');
        return;
      }

      case 'chain.activate': {
        const track = this.requireTrack(op.chain.container.track, op.op);
        const container = track.devices[op.chain.container.chainIndex]?.chains;
        if (container === undefined) {
          throw new UnsupportedOpError(`${op.op}: the container is absent`, 'fake');
        }
        const matches = container.filter((item) => item.name === op.chain.name);
        if (matches.length !== 1) {
          throw new UnsupportedOpError(
            `${op.op}: the addressed chain is ${matches.length === 0 ? 'absent' : 'ambiguous'}`,
            'fake',
          );
        }
        for (const item of container) item.solo = item === matches[0];
        const observed = this.model.observeContainer(track, op.chain.container.chainIndex);
        const proof = observed === undefined
          ? { ok: false as const, why: 'the container became unobservable' }
          : verifyExclusiveChain(observed, op.chain.name);
        if (!proof.ok) throw new UnsupportedOpError(`${op.op}: ${proof.why}`, 'fake');
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

  async showClipInEditor(
    clipRef: ClipAddress,
    verifiedAt: RevisionMark,
  ): Promise<ClipNavigationResult> {
    const resolved = await this.resolve([clipRef]);
    if (resolved.at.revision !== verifiedAt.revision
        || resolved.at.generation !== verifiedAt.generation
        || resolved.at.project !== verifiedAt.project
        || resolved.at.sceneEpoch !== verifiedAt.sceneEpoch
        || resolved.at.contentEpoch !== verifiedAt.contentEpoch) {
      return {
        navigated: false,
        layoutRequested: 'EDIT',
        layoutConfirmed: false,
        why: 'Bitwig state changed after the clip target was verified',
      };
    }
    const target = resolved.resolved[0];
    if (target?.found !== true) {
      return {
        navigated: false,
        layoutRequested: 'EDIT',
        layoutConfirmed: false,
        why: `the clip address is ${target?.reason ?? 'unresolved'}`,
      };
    }
    const track = this.model.findByChannelId(clipRef.slot.track.channelId)?.track;
    const slot = track?.slots[clipRef.slot.scene.index];
    if (slot?.hasContent !== true) {
      return {
        navigated: false,
        layoutRequested: 'EDIT',
        layoutConfirmed: false,
        why: 'the launcher slot no longer holds a clip',
      };
    }
    this.lastNavigation = structuredClone(clipRef);
    return { navigated: true, layoutRequested: 'EDIT', layoutConfirmed: true };
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  get isClosed(): boolean {
    return this.closed;
  }
}
