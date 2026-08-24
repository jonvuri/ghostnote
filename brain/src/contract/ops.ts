/**
 * The op union — the batch unit, and the whole write surface.
 *
 * "The patch is the interface, the tools are the implementation" resolves to
 * this: capabilities are DATA VARIANTS, not methods. Beat Twin abandoned a
 * 57-tool surface learning that lesson; here the adapter has one write method
 * and everything else is a union member. Consequences that matter:
 *
 *   - Adding a capability in Phase 4/5 adds a variant. The adapter interface
 *     never grows, and `assertNever` turns an unimplemented variant into a
 *     COMPILE error in every adapter rather than a runtime surprise.
 *   - Capabilities that must never exist are simply unrepresentable. There is no
 *     `app.invokeAction` variant (standing rule 6, E6) and no `app.undo` variant
 *     (E3 killed native undo as a revert mechanism). Their absence is a positive
 *     design act, not an omission.
 *
 * ⚠ Every mitigation for a silent-no-op trap lives in the ENCODER, not here.
 * Callers cannot write `set` instead of `setImmediately` (E4), cannot pass
 * `resolution=128` (E4b), cannot order pressure before gain (E2/e02e) and cannot
 * hand `insertFile` a relative path (E4h) — because none of those are
 * expressible. That is the point of a typed seam over a string wire.
 */
import { addressKey, chainPath, clip, device } from './address.js';
import type { ChainAddress, ClipAddress, DeviceAddress, DrumPadAddress, ParamAddress, RemoteAddress, SceneAddress, SlotAddress, TrackAddress } from './address.js';
import {
  lookupChain, nestingObservable, projectedReorder, reorderIndistinguishable,
  type ObservedChain, type ObservedContainer, type ObservedDevice, type ObservedDeviceSequence,
} from './chains.js';
import { unwritableProps, type ClipMetadataState, type LaunchMode, type LaunchQuantization, type NoteRecord } from './state.js';
import type { SettleBudget } from './budgets.js';
import {
  AddressUnresolvedError, BankWindowOverflowError, BlindSpotError, InvalidOpError,
  NoteTimingUnrepresentableError, SlotOccupiedError,
} from './errors.js';
import { STEP_SIZES, stepSizeFor } from './grid.js';
import type { WindowCoverage } from './snapshot.js';

/** A device to insert. Each identifier is checked before a frame is emitted. */
export type DeviceSource =
  | { readonly from: 'bitwig'; readonly uuid: string }
  | { readonly from: 'vst3'; readonly classUid: string }
  | { readonly from: 'clap'; readonly id: string }
  /** ⚠ MUST be absolute and MUST end `.bwpreset` — both fail silently otherwise (E4h). */
  | { readonly from: 'file'; readonly path: string };

export type Op =
  // --- notes: Phase 1's only object class -----------------------------------
  | { readonly op: 'note.write'; readonly clip: ClipAddress; readonly channel?: number; readonly notes: readonly NoteRecord[] }
  /** Clear all MIDI channels in one clip. The host has no channel-scoped clear. */
  | { readonly op: 'note.clear'; readonly clip: ClipAddress }
  /**
   * Set expression properties on notes that ALREADY exist, touching nothing else.
   *
   * ⚠ This op is the ONLY write in the contract whose wire handler READS before
   * it writes — `cursor.setNoteProps` resolves `clip.getStep(channel, x, y)` and
   * mutates the returned `NoteStep`. Every same-request staleness rule therefore
   * applies to it and to nothing else:
   *
   *   - it cannot share a request with the `note.write` that CREATES the note
   *     (the `NoteStep` would be stale and every property silently discarded —
   *     E15-B);
   *   - it cannot run within `gridChange` of a `cursor.setStepSize` that changed
   *     the grid, for the same reason and with the same silence (E15-D).
   *
   * Both are why it carries a settle class AND `OP_SETTLE_BEFORE` below, and why
   * `planStages` splits a property-bearing write automatically. Callers just set
   * fields on a `NoteRecord`.
   */
  | { readonly op: 'note.props'; readonly clip: ClipAddress; readonly channel?: number; readonly notes: readonly NoteRecord[] }

  // --- clips & slots --------------------------------------------------------
  // ⚠ clip.create must precede pointing at a slot: pointing at an EMPTY slot
  // silently lands the cursor on the WRONG clip, and status looks healthy (E2).
  | { readonly op: 'clip.create'; readonly slot: SlotAddress; readonly lengthBeats: number }
  | { readonly op: 'clip.delete'; readonly slot: SlotAddress }
  | { readonly op: 'clip.update'; readonly clip: ClipAddress; readonly metadata: ClipMetadataState }
  | { readonly op: 'clip.duplicate'; readonly source: ClipAddress; readonly destination: SlotAddress }
  | { readonly op: 'clip.move'; readonly source: ClipAddress; readonly destination: SlotAddress }
  | { readonly op: 'clip.launch'; readonly clip: ClipAddress; readonly quantization: LaunchQuantization; readonly mode: LaunchMode }
  | { readonly op: 'clip.launchSettings'; readonly clip: ClipAddress; readonly quantization: LaunchQuantization; readonly mode: LaunchMode; readonly useLoopStartAsQuantizationReference: boolean }

  // --- tracks: the only ops that MINT identity ------------------------------
  // `createInstrumentTrack(position)` does not honour positions (E2c), so the
  // receipt reports the channelId the new track was FOUND at, never a guess.
  | { readonly op: 'track.create'; readonly name: string }
  /** Duplicate one addressed track. The receipt reports the fresh channelId. */
  | { readonly op: 'track.duplicate'; readonly track: TrackAddress }
  | { readonly op: 'track.rename'; readonly track: TrackAddress; readonly name: string }
  | { readonly op: 'track.delete'; readonly track: TrackAddress }

  // --- scenes: in v0 mainly because they are what stales an epoch (E3) ------
  | { readonly op: 'scene.create'; readonly count: number }
  | { readonly op: 'scene.delete'; readonly scene: SceneAddress }

  // --- devices & params -----------------------------------------------------
  | {
    readonly op: 'device.insert';
    readonly track: TrackAddress;
    readonly source: DeviceSource;
    /** Complete top-level names from the caller's last accepted observation. */
    readonly expectedChain?: readonly string[];
    /** Aligned top-level enabled flags from the same observation. */
    readonly expectedEnabledChain?: readonly boolean[];
  }
  | {
    readonly op: 'device.delete';
    readonly device: DeviceAddress;
    readonly expectedName?: string;
    /** Complete top-level names from the caller's last accepted observation. */
    readonly expectedChain?: readonly string[];
    /** Aligned top-level enabled flags from the same observation. */
    readonly expectedEnabledChain?: readonly boolean[];
    /** Exact occupied-pad structure for an owned Drum Machine removal. */
    readonly expectedDrumPads?: readonly {
      readonly channel: number;
      readonly deviceName: string;
    }[];
  }
  /** Set one top-level device's enabled flag after an independent readback. */
  | {
    readonly op: 'device.setEnabled';
    readonly device: DeviceAddress;
    readonly enabled: boolean;
    readonly expectedName?: string;
    /** Enabled state from the caller's last accepted observation. */
    readonly expectedEnabled?: boolean;
    /** Complete top-level names from the caller's last accepted observation. */
    readonly expectedChain?: readonly string[];
    /** Aligned top-level enabled flags from the same observation. */
    readonly expectedEnabledChain?: readonly boolean[];
  }
  /** Move one named top-level device from the observed tail immediately before another. */
  | {
    readonly op: 'device.relocate';
    readonly track: TrackAddress;
    readonly sourceFromEnd: number;
    readonly expectedName: string;
    readonly before: DeviceAddress;
    /** Complete top-level names from the caller's last accepted observation. */
    readonly expectedChain?: readonly string[];
    /** Aligned top-level enabled flags from the same observation. */
    readonly expectedEnabledChain?: readonly boolean[];
  }
  | {
    readonly op: 'param.set';
    readonly param: ParamAddress;
    readonly value: number;
    /** Device name from the same observation that minted the parameter address. */
    readonly expectedName?: string;
    /** Complete top-level names from the caller's last accepted observation. */
    readonly expectedChain?: readonly string[];
    /** Aligned top-level enabled flags from the same observation. */
    readonly expectedEnabledChain?: readonly boolean[];
  }
  | {
    readonly op: 'remote.set';
    readonly remote: RemoteAddress;
    readonly value: number;
    /** Device name from the inventory that minted the remote address. */
    readonly expectedName?: string;
    /** Complete top-level names from the caller's last accepted observation. */
    readonly expectedChain?: readonly string[];
    /** Aligned top-level enabled flags from the same observation. */
    readonly expectedEnabledChain?: readonly boolean[];
  }

  // --- device-layer chains: the FIRST typed verb that reaches inside one -----
  /**
   * ⚠⚠ Make a new chain in a container, by COPYING one that is already there,
   * and give it a name. Session 3f step 6b-2, and the first write in this
   * system that addresses anything below the track's own device chain.
   *
   * **Why copying, and why that is not a limitation of this op.** There is no
   * create-from-nothing. `e17ak` measured the whole space and exactly one typed
   * route works: select the chain (`DeviceChain.selectInEditor()`), then call
   * `Channel.duplicate()` on it. Its sibling `DuplicableObject.duplicateObject()`
   * is dead on a `DeviceLayer`, the named actions need a human click (`e17ab`),
   * and a container's own insertion point does not exist. So a container with no
   * chain at all cannot be grown, and the op says so by requiring a SOURCE
   * rather than by pretending the seam is a placement choice.
   *
   * **Why the name is part of the verb rather than a second op.** A duplicate
   * carries its source's name, so the moment it lands the container holds two
   * chains that `lookupChain` correctly refuses as `ambiguous` — a state in
   * which the new chain has no address at all. A separate rename op would have
   * to be addressed with exactly the address that does not yet exist. The verb
   * therefore owns both halves, and `mintedChain` is what tells them apart in
   * between.
   *
   * ⚠ It is UNREVERTABLE, and measured so rather than assumed: every typed
   * chain DELETE refuses — `DeleteableObject.deleteObject()` and
   * `deleteObjectAction().invoke()`, both with a `Track` sibling deleting in the
   * same run (`e17al`, `e17am`). Reduction is *move the devices out, delete the
   * CONTAINER*, which is a different verb this op does not pretend to have.
   */
  | { readonly op: 'chain.create'; readonly source: ChainAddress; readonly name: string }
  /**
   * Give one uniquely named, observed chain a new durable name. This is the
   * bootstrap half that `chain.create` cannot provide: fresh FX containers and
   * the bundled Instrument seed both begin with a chain whose shipped name must
   * be replaced before it becomes a lifecycle address.
   */
  | { readonly op: 'chain.rename'; readonly chain: ChainAddress; readonly name: string }
  /**
   * Relocate one device between the track's top-level chain and a named layer
   * chain, or between two named layer chains. The destination is always the end
   * of its device chain; repeating the verb therefore preserves caller order.
   *
   * ⚠ This is the ONLY device write allowed to carry a nested `DeviceAddress`.
   * Its adapters resolve both chain names immediately before the write and
   * prove both structural halves afterwards. `device.delete` and `param.set`
   * remain behind `assertDevicesRoutable` exactly as before.
   */
  | {
    readonly op: 'chain.relocate';
    readonly source: DeviceAddress;
    readonly destination: ChainAddress | TrackAddress;
    readonly mode: 'move' | 'copy';
  }
  /** Make one named chain the sole soloed chain in its container. */
  | { readonly op: 'chain.activate'; readonly chain: ChainAddress }

  /** Fill one empty pad in the Drum Machine inserted earlier in this batch. */
  | {
    readonly op: 'drumPad.insert';
    readonly pad: DrumPadAddress;
    readonly source: { readonly from: 'bitwig'; readonly uuid: string };
    readonly expectedDeviceName: string;
    readonly expectedContainerName: 'Drum Machine';
    /** Complete top-level state after the owned container insertion. */
    readonly expectedChain: readonly string[];
    readonly expectedEnabledChain: readonly boolean[];
  }

  // --- progress signal ------------------------------------------------------
  // Free: E8-C interleaved notify ops into a paced batch and all fired, spaced
  // across it, without stalling it. Under optimistic apply this is not politeness
  // — the user needs to know their session changed while they were playing (§8d).
  | { readonly op: 'notify'; readonly message: string };

export type OpKind = Op['op'];

/**
 * What each op costs to settle. `instant` ops all land in ONE control-surface
 * turn together (the 232x batch win, E8); everything else is staged behind its
 * own settle budget because an op that depends on a preceding structural op
 * would otherwise run before its target exists.
 */
export const OP_SETTLE: Record<OpKind, SettleBudget | 'instant'> = {
  'note.write': 'instant',
  'note.clear': 'instant',
  // ⚠ NOT 'instant', and this is the whole point of the op: its handler reads a
  // `NoteStep` before mutating it, so it must land in a different REQUEST from
  // the write that created the note (E15-B). Giving it a settle class is what
  // forces `planStages` to break the batch here.
  'note.props': 'noteWrite',
  // One confirmed device cursor serves this route. Each write gets its own turn
  // and independent observer readback.
  'param.set': 'tick',
  'remote.set': 'tick',
  notify: 'instant',
  'clip.create': 'trackStruct',
  'clip.delete': 'trackStruct',
  'clip.update': 'instant',
  'clip.duplicate': 'trackStruct',
  'clip.move': 'trackStruct',
  'clip.launch': 'tick',
  'clip.launchSettings': 'instant',
  'track.create': 'trackStruct',
  'track.duplicate': 'trackStruct',
  'track.rename': 'trackStruct',
  'track.delete': 'trackStruct',
  'scene.create': 'tick',
  'scene.delete': 'tick',
  'device.insert': 'deviceInsert',
  'device.delete': 'trackStruct',
  'device.setEnabled': 'tick',
  'device.relocate': 'deviceInsert',
  // ⚠ `deviceInsert`, the slowest budget measured (600ms, E3), and NOT
  // `trackStruct`. Duplicating a chain instantiates a copy of every device in
  // it, which is the same plugin-loading work an insert pays for; the empty
  // chain a fresh FX Layer ships with is the cheap case, not the case a budget
  // has to cover. Under-waiting here is not a slow readback — it is a diff taken
  // before the copy is in the bank, which reports no mint and leaves a chain
  // wearing its source's name.
  'chain.create': 'deviceInsert',
  'chain.rename': 'trackStruct',
  'chain.relocate': 'deviceInsert',
  'chain.activate': 'tick',
  'drumPad.insert': 'deviceInsert',
};

/**
 * What must have SETTLED before an op may run — the mirror image of `OP_SETTLE`.
 *
 * ⚠ E15-D, and the distinction is the whole finding. `OP_SETTLE` waits after a
 * stage so that whatever comes next sees its effect. That is useless when the
 * hazard is the other way round: `cursor.setNoteProps` reads through the step
 * grid, and the `cursor.setStepSize` that a preceding `note.write` emitted needs
 * ~120ms before that read is usable. Waiting AFTER the props op cannot help — by
 * then the properties have already been discarded, silently.
 *
 * Measured: 0 of 3 properties landed at gaps of 0/24/48/72/96ms, 3 of 3 at
 * 120/144/192/288ms. `planStages` attaches this to the stage, and both adapters
 * honour it before sending.
 */
export const OP_SETTLE_BEFORE: Partial<Record<OpKind, SettleBudget>> = {
  'note.props': 'gridChange',
};

/**
 * Ops that change the scene layout, and therefore invalidate every scene epoch (E3).
 *
 * ⚠ **Nothing bumps a counter from this set any more, and that is the point.**
 * Both adapters used to increment their own scene epoch when they saw one of
 * these, which is exactly why the epoch could see us and not the user. The epoch
 * is an OBSERVER in the extension now (session 3, D4 rev), so a scene op moves it
 * because Bitwig moved it — including one a human performed while nothing was
 * connected. Kept as the declaration of WHICH ops have that consequence, which is
 * still a fact about the op union and is what `structuralRisk` reads it for.
 */
export const OP_BUMPS_SCENE_EPOCH: ReadonlySet<OpKind> = new Set<OpKind>(['scene.create', 'scene.delete']);

/**
 * Refuse a batch that asks for something the API accepts and then discards.
 *
 * ⚠ E15-E: `pressure` is the only such property today. Writing it leaves a value
 * in the writing cursor's own `NoteStep` cache that no other cursor can see and
 * that vanishes the moment that cursor is re-pointed — so a caller who set it
 * would see it "work" on readback through the same cursor and lose it for real.
 * That is strictly worse than an error, and worse still than a missing feature,
 * because a snapshot taken through the writing cursor would record a value the
 * clip does not contain.
 *
 * Lives in the CONTRACT rather than the live encoder because it must be the same
 * refusal on both adapters — otherwise the conformance suite could not assert it
 * and the fake would go on certifying a write that does nothing.
 */
export function assertOpsWritable(ops: readonly Op[]): void {
  for (const op of ops) {
    if ((op.op === 'note.write' || op.op === 'note.props')
        && op.notes.length > 0 && stepSizeFor(op.notes) === undefined) {
      throw new NoteTimingUnrepresentableError(STEP_SIZES[STEP_SIZES.length - 1]!, op.op);
    }
    if (op.op === 'drumPad.insert') {
      if (op.source.from !== 'bitwig'
          || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(op.source.uuid)) {
        throw new InvalidOpError(op.op, 'a native pad device needs one valid Bitwig UUID');
      }
      if (op.pad.container.chain !== undefined
          || op.pad.channel < 0 || op.pad.channel > 15
          || op.expectedDeviceName.trim() === '') {
        throw new InvalidOpError(
          op.op,
          'the target must be channel 0 through 15 of one top-level Drum Machine',
        );
      }
      if (op.expectedEnabledChain.length !== op.expectedChain.length
          || op.expectedChain[op.pad.container.chainIndex] !== op.expectedContainerName) {
        throw new InvalidOpError(op.op, 'the complete chain guard must identify the Drum Machine');
      }
    }
    if (op.op === 'device.delete' && op.expectedDrumPads !== undefined) {
      const channels = new Set<number>();
      for (const item of op.expectedDrumPads) {
        if (!Number.isInteger(item.channel) || item.channel < 0 || item.channel > 15
            || item.deviceName.trim() === '' || channels.has(item.channel)) {
          throw new InvalidOpError(op.op, 'the owned Drum Machine guard has invalid pad witnesses');
        }
        channels.add(item.channel);
      }
    }
    if (op.op === 'param.set') {
      if (!Number.isFinite(op.value) || op.value < 0 || op.value > 1) {
        throw new InvalidOpError(op.op, 'a normalized parameter value must be from 0 through 1');
      }
      if (op.param.directId === undefined && op.param.index === undefined) {
        throw new InvalidOpError(op.op, 'a parameter address needs a DirectParameter id or typed index');
      }
    }
    if (op.op === 'remote.set') {
      if (!Number.isFinite(op.value) || op.value < 0 || op.value > 1) {
        throw new InvalidOpError(op.op, 'a normalized remote-control value must be from 0 through 1');
      }
      if (!Number.isInteger(op.remote.pageIndex) || op.remote.pageIndex < 0
          || op.remote.pageName.trim() === ''
          || !Number.isInteger(op.remote.controlIndex) || op.remote.controlIndex < 0
          || op.remote.controlName.trim() === '') {
        throw new InvalidOpError(op.op, 'a remote control needs confirmed page and control names and indices');
      }
    }
    if (op.op === 'clip.update') {
      const { metadata } = op;
      const beats = [
        metadata.lengthBeats,
        metadata.playStartBeats,
        metadata.loopStartBeats,
        metadata.loopEndBeats,
      ];
      if (beats.some((value) => !Number.isFinite(value))) {
        throw new InvalidOpError(op.op, 'all clip beat values must be finite');
      }
      if (metadata.lengthBeats <= 0
          || metadata.playStartBeats < 0
          || metadata.loopStartBeats < 0
          || metadata.loopEndBeats <= metadata.loopStartBeats
          || Math.abs(metadata.loopStartBeats + metadata.lengthBeats - metadata.loopEndBeats) > 1e-9) {
        throw new InvalidOpError(
          op.op,
          'clip metadata must have a non-negative play start, a positive loop length, '
          + 'and loop end equal to loop start plus length',
        );
      }
      for (const [name, value] of Object.entries(metadata.color)) {
        if (!Number.isInteger(value) || value < 0 || value > 255) {
          throw new InvalidOpError(op.op, `${name} must be an integer from 0 to 255`);
        }
      }
    }
    if (op.op === 'clip.duplicate') {
      const source = op.source.slot;
      if (source.track.channelId !== op.destination.track.channelId
          || op.destination.scene.index !== source.scene.index + 1) {
        throw new InvalidOpError(
          op.op,
          'duplicateClip always writes exactly one row below its source on the same track; '
          + 'the typed destination must name that measured landing row',
        );
      }
    }
    if (op.op === 'clip.move'
        && addressKey(op.source.slot) === addressKey(op.destination)) {
      throw new InvalidOpError(op.op, 'source and destination must be different slots');
    }
    if (op.op === 'chain.create') {
      // ⚠ A blank name is not a weak address, it is no address at all: a chain's
      // `channelId` regenerates on every project load (E18b), so the name is the
      // only durable identifier and a blank one identifies every unnamed chain
      // on the container equally. The `chain()` constructor refuses one too; this
      // refuses it BEFORE the copy is made rather than after.
      if (op.name.trim() === '') {
        throw new InvalidOpError(
          op.op,
          'a created chain needs a non-empty name — its channelId is minted fresh by every '
          + 'project load (E18b), so an unnamed chain is one nothing can address twice',
        );
      }
      // ⚠ And it must differ from the source's, because the copy ARRIVES with the
      // source's name. "Renaming" it to what it already is would leave two chains
      // sharing one name, which `lookupChain` refuses as `ambiguous` — the verb
      // would have manufactured the exact state the resolver exists to reject.
      if (op.name === op.source.name) {
        throw new InvalidOpError(
          op.op,
          `the copy arrives carrying its source's name, so naming it "${op.name}" again would `
          + 'leave two chains sharing one name and neither of them addressable',
        );
      }
    }
    if (op.op === 'chain.rename') {
      if (op.name.trim() === '') {
        throw new InvalidOpError(op.op, 'a device alternate needs a non-empty durable name');
      }
      if (op.name === op.chain.name) {
        throw new InvalidOpError(op.op, 'the new name must differ from the current name');
      }
      if (!nestingObservable(op.chain)) {
        throw new InvalidOpError(op.op, 'the addressed chain is deeper than the measured one-chain slot scopes');
      }
    }
    if (op.op === 'chain.relocate') {
      if (op.source.chain !== undefined && op.source.chain.kind !== 'chain') {
        throw new InvalidOpError(op.op, 'a chain relocation needs a layer-chain parent');
      }
      const destinationTrack = op.destination.kind === 'chain'
        ? op.destination.container.track
        : op.destination;
      if (op.source.track.channelId !== destinationTrack.channelId) {
        throw new InvalidOpError(op.op, 'source and destination must be on the same track');
      }
      if (op.source.chain === undefined && op.destination.kind === 'track') {
        throw new InvalidOpError(op.op, 'at least one side of a chain relocation must be a chain');
      }
      if (op.source.chain !== undefined && !nestingObservable(op.source)) {
        throw new InvalidOpError(op.op, 'the source is deeper than the measured one-chain slot scopes');
      }
      if (op.destination.kind === 'chain' && !nestingObservable(op.destination)) {
        throw new InvalidOpError(op.op, 'the destination is deeper than the measured one-chain slot scopes');
      }
      if (op.source.chain?.kind === 'chain' && op.destination.kind === 'chain'
          && addressKey(op.source.chain) === addressKey(op.destination)) {
        throw new InvalidOpError(op.op, 'source and destination chains must be different');
      }
      if (op.source.chain === undefined && op.destination.kind === 'chain'
          && op.source.chainIndex === op.destination.container.chainIndex) {
        throw new InvalidOpError(op.op, 'a container cannot be relocated into one of its own chains');
      }
    }
    if (op.op === 'chain.activate' && !nestingObservable(op.chain)) {
      throw new InvalidOpError(op.op, 'the addressed chain is deeper than the measured one-chain slot scopes');
    }
    if (op.op === 'device.relocate') {
      if (op.before.chain !== undefined) {
        throw new InvalidOpError(op.op, 'the before-anchor must be a top-level device');
      }
      if (op.track.channelId !== op.before.track.channelId) {
        throw new InvalidOpError(op.op, 'source and anchor must be on the same track');
      }
      if (!Number.isInteger(op.sourceFromEnd) || op.sourceFromEnd < 0) {
        throw new InvalidOpError(op.op, 'sourceFromEnd must be a non-negative integer');
      }
      if (op.expectedName.trim() === '') {
        throw new InvalidOpError(op.op, 'the moved device needs an expected name guard');
      }
    }
    if (op.op !== 'note.write' && op.op !== 'note.props') continue;
    for (const note of op.notes) {
      const refused = unwritableProps(note);
      if (refused.length === 0) continue;
      throw new InvalidOpError(
        op.op,
        `${refused.join(', ')} cannot be written through this API: the value lands only in the ` +
          'writing cursor\'s NoteStep cache, is invisible to every other cursor, and is gone as ' +
          'soon as that cursor is re-pointed (E15-E). Refusing beats writing a phantom that a ' +
          'later snapshot would read back as real.',
      );
    }
  }
}

/**
 * The scene ROW an op puts on the wire, if any.
 *
 * ⚠ Deliberately not `writeSetOf` (which lives in the engine and answers a
 * different question — *which addresses need stashing*). This one answers *which
 * rows does the wire address*, and the two differ: `scene.delete` names a row it
 * has no stashable prior state for, and a `notes` write names its clip's row
 * without the row itself being in the write-set.
 *
 * Exhaustive on purpose: a Phase-4/5 variant that carries a scene row and is not
 * listed here fails to COMPILE rather than slipping past the window guard.
 */
function sceneRowsOf(op: Op): readonly SceneAddress[] {
  switch (op.op) {
    case 'note.write':
    case 'note.clear':
    case 'note.props':
      return [op.clip.slot.scene];
    case 'clip.create':
    case 'clip.delete':
      return [op.slot.scene];
    case 'clip.update':
      return [op.clip.slot.scene];
    case 'clip.duplicate':
    case 'clip.move':
      return [op.source.slot.scene, op.destination.scene];
    case 'clip.launch':
    case 'clip.launchSettings':
      return [op.clip.slot.scene];
    case 'scene.delete':
      return [op.scene];
    case 'scene.create':
    case 'track.create':
    case 'track.duplicate':
    case 'track.rename':
    case 'track.delete':
    case 'device.insert':
    case 'device.delete':
    case 'device.setEnabled':
    case 'device.relocate':
    case 'param.set':
    case 'remote.set':
    case 'chain.create':
    case 'chain.rename':
    case 'chain.relocate':
    case 'chain.activate':
    case 'drumPad.insert':
    case 'notify':
      return [];
    default:
      return assertNever(op, 'sceneRowsOf');
  }
}

/**
 * The DEVICE addresses an op puts on the wire.
 *
 * Exhaustive for the same reason `sceneRowsOf` is: a Phase-4/5 variant that
 * carries a device address and is not listed here would slip past the routing
 * guard below, which is the one check standing between a nested address and a
 * write aimed at a different device.
 */
function deviceRefsOf(op: Op): readonly DeviceAddress[] {
  switch (op.op) {
    case 'device.delete':
      return [op.device];
    case 'device.setEnabled':
      return [op.device];
    case 'param.set':
    case 'remote.set':
      // These verbs own the confirmed recursive cursor route.
      return [];
    case 'device.relocate':
      // This verb owns its top-level-only validation above.
      return [];
    // ⚠⚠ The CONTAINER, and listing it here is what makes the routing guard do
    // this op's depth check for free. `chain.duplicate` addresses its container
    // by slot position in `Rig.slotLayerBanks`, which hang off TOP-LEVEL device
    // slots and nowhere else — so a container that is itself inside a chain has
    // no scope to be named through, and sending its `chainIndex` would aim the
    // duplicate at whatever top-level device shares that number. That is exactly
    // the failure `assertDevicesRoutable` refuses, so the op declares the
    // address rather than re-implementing the refusal.
    case 'chain.create':
      return [op.source.container];
    case 'chain.rename':
      return [op.chain.container];
    // This verb owns its nested route and performs the corresponding depth,
    // name and identity checks itself. Listing its source here would make the
    // general refusal erase the one deliberately promoted capability.
    case 'chain.relocate':
      return [];
    case 'chain.activate':
      return [op.chain.container];
    case 'drumPad.insert':
      // This route owns the top-level container and pad checks.
      return [];
    // ⚠ `device.insert` names a TRACK, not a device, so it cannot be nested today.
    // When an insert into a chain is measured it gains its own addressing, and
    // this switch is where that fact has to be restated.
    case 'device.insert':
    case 'note.write':
    case 'note.clear':
    case 'note.props':
    case 'clip.create':
    case 'clip.delete':
    case 'clip.update':
    case 'clip.duplicate':
    case 'clip.move':
    case 'clip.launch':
    case 'clip.launchSettings':
    case 'track.create':
    case 'track.duplicate':
    case 'track.rename':
    case 'track.delete':
    case 'scene.create':
    case 'scene.delete':
    case 'notify':
      return [];
    default:
      return assertNever(op, 'deviceRefsOf');
  }
}

/**
 * ⚠⚠ Refuse an op naming a device INSIDE a layer chain unless that op owns a
 * measured nested route. Today the exceptions are the chain verbs that own
 * their slot-scoped routing.
 *
 * `DeviceAddress.chain` exists so that nested structure can be named, stashed and
 * reported before any verb can reach it — the address grammar and the routes are
 * separate deliveries, and this is the seam between them. Without this refusal a
 * nested address would be handed to `deviceDelete`/`param.set` as a bare
 * `deviceIndex`, and Bitwig would happily apply it to whatever sits at that
 * position in the track's own chain: a real device, addressed by nobody, removed
 * or retuned silently. That is the exact failure class the contract refuses on
 * principle (E4h, D20 *"name the survivor, never count it"*).
 *
 * ⚠ In the CONTRACT rather than in the live encoder so both adapters refuse
 * identically. The fake models a flat per-track device list, so an unguarded
 * nested address there reads and writes the wrong device too — and would certify
 * a capability neither adapter has (PHASE-0 §Risks' one-directional rule).
 *
 * ⚠ Relaxing this is a MEASUREMENT, not a default. Each chain verb promotes one
 * slot-scoped route through its own validation and readback; no general device
 * operation inherits that reach.
 */
export function assertDevicesRoutable(ops: readonly Op[]): void {
  for (const op of ops) {
    for (const ref of deviceRefsOf(op)) {
      if (ref.chain === undefined) continue;
      const path = chainPath(ref).map((c) => c.kind === 'chain'
        ? c.name
        : c.kind === 'drumPad' ? `drum pad ${c.channel}` : `slot ${c.name}`).join(' > ');
      throw new InvalidOpError(
        op.op,
        `this address names a device inside a device-layer chain (${path}), and no measured wire ` +
        'route reaches one. Every device route addresses `chainIndex` against the TRACK\'s ' +
        'top-level chain, so honouring it would hit whatever sits at that position on the track ' +
        '— a real device that nobody addressed. Refused before the first frame; the nested ' +
        'routes are measured before this is relaxed.',
      );
    }
  }
}

/** Refuse a chain switch unless every sibling and its solo flag were observed. */
export function assertChainActivatable(
  ops: readonly Op[],
  observe: (container: DeviceAddress) => ObservedContainer | undefined,
): void {
  for (const op of ops) {
    if (op.op !== 'chain.activate') continue;
    const observed = observe(op.chain.container);
    if (observed === undefined) {
      throw new InvalidOpError(op.op, 'the addressed container is not observable through a slot scope');
    }
    if (!observed.chainsComplete) {
      throw new InvalidOpError(op.op, 'the container chain view is partial, so every sibling cannot be switched safely');
    }
    const found = lookupChain(observed, op.chain.name);
    if (!found.ok) {
      throw new InvalidOpError(op.op, `the addressed chain is ${found.miss}`);
    }
    const unknown = observed.chains.filter((item) => typeof item.solo !== 'boolean');
    if (unknown.length > 0) {
      throw new InvalidOpError(
        op.op,
        `solo state was not observed exactly for: ${unknown.map((item) => item.name).join(', ')}`,
      );
    }
  }
}

/**
 * ⚠⚠ Everything `chain.create` needs to be TRUE about the container before the
 * copy is made — checked against a real observation, never assumed, and
 * PROJECTED ACROSS THE BATCH.
 *
 * ⚠ The RULE is here and the OBSERVATION is not, exactly as `assertSlotsFree`
 * splits them: each adapter supplies the lookup (live through `chain.inventory`,
 * the fake through its own model) and the refusal stays identical, which is what
 * lets a conformance row assert it on both and stops the fake from being the
 * lenient one.
 *
 * ⚠⚠ **The projection is not a refinement, it is the guard.** Nothing has been
 * applied when this runs, so every create in a batch sees the SAME reading —
 * and checking each one against it independently is the post-hoc check wearing a
 * precondition's clothes, which is the exact mistake `assertSceneRoom`'s header
 * already names ("two `scene.create`s of 4 in one batch are a create of 8").
 * Measured here, before the fix: two creates against a 3-of-4 container produced
 * FIVE chains, stranding one past a bank nothing can address; two creates named
 * `dup` produced two chains called `dup`, and both stage receipts said `ok`.
 * So each create is checked against the container as the creates BEFORE it
 * leave it, in caller order — the same shape `assertSlotsFree` uses for slot
 * occupancy, and for the same reason.
 *
 * Four preconditions, and each of them is a different way the create would
 * otherwise leave the container in a state nothing can address:
 *
 *   1. **We could look at all.** `undefined` is a refusal, not a pass. The
 *      container scopes exist on the first few top-level device positions only
 *      (D7, init-allocated), and a create aimed through a scope that was never
 *      built is a write nothing could then observe or name.
 *   2. ⚠⚠ **Standing rule 5, one population down, and CUMULATIVE.** The same
 *      hazard E19 paid for with a scene stranded at project index 99 of a
 *      16-wide window: the chain bank is FIVE wide (`Rig.SLOT_LAYER_BANK`), the
 *      enumeration reports nothing past it, and a chain created out there can be
 *      resolved by nothing, renamed by nothing and removed by nothing — there is
 *      no typed chain delete at all. Counting requires the bank SIZE, which is
 *      why `ObservedContainer` carries one; a reading that omits it is refused
 *      rather than treated as room.
 *   3. **The source resolves, uniquely** — against the projected container, so a
 *      chain an earlier create in the same batch made is a usable source, and a
 *      name that earlier creates made ambiguous is refused. `Channel.duplicate()`
 *      copies the chain that is SELECTED (`e17ak`), so a source that does not
 *      identify exactly one chain would copy whichever one we picked.
 *   4. **The new name is free, and provably so** — also against the projection,
 *      which is what stops two creates in one batch claiming one name.
 */
export function assertChainCreatable(
  ops: readonly Op[],
  observe: (container: DeviceAddress) => ObservedContainer | undefined,
): void {
  /** The container as the creates so far leave it: the names in it, and how wide it is. */
  const projected = new Map<string, { names: string[]; bankSize: number }>();

  for (const op of ops) {
    if (op.op !== 'chain.create') continue;
    const container = op.source.container;
    if (!nestingObservable(op.source)) {
      throw new InvalidOpError(
        op.op,
        'the container of this chain is itself inside a chain, and no measured route enumerates '
        + 'or writes one level deeper than a top-level container',
      );
    }

    const key = addressKey(container);
    let state = projected.get(key);
    if (state === undefined) {
      const observed = observe(container);
      if (observed === undefined) {
        throw new InvalidOpError(
          op.op,
          `no container scope covers device position ${container.chainIndex} on this track, so `
          + 'nothing could observe the chain this create would make. Refused rather than written '
          + 'blind — a chain we cannot see is one nothing can name, and there is no typed delete',
        );
      }
      // ⚠ Both checks, because they fail for different reasons and only one of
      // them is arithmetic. `chainsComplete` is the ADAPTER's own answer to "did
      // this reading see everything"; the size is what the projection below
      // counts against. An extension too old to report the size makes
      // `chainsComplete` false as well, so neither check is reachable alone
      // today — and neither may be dropped on that basis.
      if (observed.chainsBankSize === undefined) {
        throw new InvalidOpError(
          op.op,
          'the container enumeration did not report how wide the chain bank is, so there is no '
          + 'way to prove this create lands inside it. Refused rather than counted on',
        );
      }
      if (!observed.chainsComplete) {
        // ⚠ Deliberately NOT a `BankWindowOverflowError`. That error's whole
        // remedy is *"raise the knob in ~/.ghostnote/rig.json"*, and this window
        // has no knob: it is `Rig.SLOT_LAYER_BANK`, fixed in the extension and
        // allocated at init (D7). Reusing the class would put a false
        // instruction in a refusal, which is worse than a plainer error.
        throw new InvalidOpError(
          op.op,
          `the container's chain bank is full at ${observed.chains.length} visible chains, so a `
          + 'new chain would land outside the window — unresolvable, un-nameable, and with no '
          + 'typed delete to take it back. Refused before the copy is made (standing rule 5)',
        );
      }
      state = {
        names: observed.chains.map((c) => c.name),
        bankSize: observed.chainsBankSize,
      };
      projected.set(key, state);
    }

    // ⚠ The cumulative half of rule 5. The FIRST create is covered by
    // `chainsComplete` above; every one after it is covered only here.
    if (state.names.length >= state.bankSize) {
      throw new InvalidOpError(
        op.op,
        `this batch would leave the container holding ${state.names.length + 1} chains in a bank `
        + `${state.bankSize} wide, so a chain would land outside the window — unresolvable, `
        + 'un-nameable, and with no typed delete to take it back. The whole batch is refused '
        + 'before any copy is made (standing rule 5, summed over the batch)',
      );
    }

    // ⚠ Against the PROJECTION, not the reading. Counted rather than looked up,
    // because `lookupChain` answers about an `ObservedContainer` and the state
    // here is one no observation has been taken of — it is the container as the
    // earlier creates in this batch leave it.
    const sources = state.names.filter((n) => n === op.source.name).length;
    if (sources !== 1) {
      throw new InvalidOpError(
        op.op,
        `the source chain "${op.source.name}" ${sources === 0 ? 'is absent from' : 'names more than one chain in'} `
        + 'this container at the point this op runs. A copy is made of the chain that is SELECTED '
        + '(`e17ak`), so a source that does not identify exactly one chain would copy whichever '
        + 'one we happened to select',
      );
    }
    if (state.names.includes(op.name)) {
      throw new InvalidOpError(
        op.op,
        `the name "${op.name}" is already used by a chain in this container at the point this op `
        + 'runs — a chain is addressed by name, so minting a second one under a name that is '
        + 'taken produces two chains neither of which can be addressed',
      );
    }
    state.names.push(op.name);
  }
}

/**
 * Prove every rename has one identity-bearing source and one provably free
 * destination name. Projection makes several renames in one batch refer to the
 * names left by the preceding renames rather than to a stale common snapshot.
 */
export function assertChainRenamable(
  ops: readonly Op[],
  observe: (container: DeviceAddress) => ObservedContainer | undefined,
): void {
  const projected = new Map<string, ObservedChain[]>();
  for (const op of ops) {
    if (op.op !== 'chain.rename') continue;
    const key = addressKey(op.chain.container);
    let chains = projected.get(key);
    if (chains === undefined) {
      const observed = observe(op.chain.container);
      if (observed === undefined || !observed.chainsComplete) {
        throw new InvalidOpError(op.op, 'the complete sibling set must be observable before a rename');
      }
      chains = observed.chains.map((item) => ({ ...item }));
      projected.set(key, chains);
    }
    const matches = chains.filter((item) => item.name === op.chain.name);
    if (matches.length !== 1) {
      throw new InvalidOpError(
        op.op,
        `the addressed chain is ${matches.length === 0 ? 'absent' : 'ambiguous'}`,
      );
    }
    if (matches[0]!.id === undefined) {
      throw new InvalidOpError(op.op, 'the addressed chain did not report its within-turn identity');
    }
    if (chains.some((item) => item.name === op.name)) {
      throw new InvalidOpError(op.op, `the name "${op.name}" is already in use in this container`);
    }
    const at = chains.indexOf(matches[0]!);
    chains[at] = { ...matches[0]!, name: op.name };
  }
}

/** A complete device enumeration plus the fixed bank width it must fit inside. */
export interface ObservedDeviceBank extends ObservedDeviceSequence {
  readonly bankSize?: number;
}

/** One occupied reachable Drum Machine pad and its complete nested device chain. */
export interface ObservedDrumPad {
  readonly channel: number;
  readonly devices: readonly ObservedDevice[];
  readonly devicesComplete: boolean;
  readonly deviceBankSize?: number;
}

/** One Drum Machine plus the complete top-level and reachable-pad structure. */
export interface ObservedDrumPadBank {
  readonly containerName: string;
  readonly topLevel: ObservedDeviceBank;
  readonly pads: readonly ObservedDrumPad[];
  readonly padsComplete: boolean;
  readonly bankSize?: number;
}

/** Refuse inserts unless every affected top-level chain is complete and has room. */
export function assertDeviceInsertable(
  ops: readonly Op[],
  observeTrack: (track: TrackAddress) => ObservedDeviceBank | undefined,
): void {
  const requested = new Map<string, { track: TrackAddress; count: number }>();
  for (const op of ops) {
    if (op.op !== 'device.insert') continue;
    const current = requested.get(op.track.channelId);
    requested.set(op.track.channelId, {
      track: op.track,
      count: (current?.count ?? 0) + 1,
    });
  }
  for (const { track, count } of requested.values()) {
    const observed = observeTrack(track);
    if (observed === undefined || !observed.devicesComplete) {
      throw new InvalidOpError(
        'device.insert',
        `the complete top-level device chain on ${track.channelId} must be observable`,
      );
    }
    if (observed.bankSize === undefined) {
      throw new InvalidOpError(
        'device.insert',
        `device-bank room on ${track.channelId} cannot be proved because the bank size was not observed`,
      );
    }
    if (observed.devices.length + count > observed.bankSize) {
      throw new InvalidOpError(
        'device.insert',
        `the top-level device bank would hold ${observed.devices.length + count} devices, but its width is ${observed.bankSize}`,
      );
    }
  }
}

/** Refuse pad composition unless it belongs to one new container in this batch. */
export function assertDrumPadInsertable(ops: readonly Op[]): void {
  const inserts = ops
    .map((op, index) => ({ op, index }))
    .filter((item): item is { op: Extract<Op, { op: 'device.insert' }>; index: number } =>
      item.op.op === 'device.insert');
  const pads = ops
    .map((op, index) => ({ op, index }))
    .filter((item): item is { op: Extract<Op, { op: 'drumPad.insert' }>; index: number } =>
      item.op.op === 'drumPad.insert');
  if (pads.length === 0) return;
  const channels = new Set<string>();
  for (const { op, index } of pads) {
    const parent = inserts.find((candidate) => candidate.index < index
      && candidate.op.track.channelId === op.pad.container.track.channelId
      && candidate.op.expectedChain !== undefined
      && candidate.op.expectedEnabledChain !== undefined
      && candidate.op.expectedChain.length === op.pad.container.chainIndex);
    if (parent === undefined) {
      throw new InvalidOpError(
        op.op,
        'a pad insert must follow its guarded top-level container insert in the same batch',
      );
    }
    const expectedChain = [...parent.op.expectedChain!, op.expectedContainerName];
    const expectedEnabled = [...parent.op.expectedEnabledChain!, true];
    if (JSON.stringify(op.expectedChain) !== JSON.stringify(expectedChain)
        || JSON.stringify(op.expectedEnabledChain) !== JSON.stringify(expectedEnabled)) {
      throw new InvalidOpError(op.op, 'the pad guard does not match the inserted container projection');
    }
    const key = `${op.pad.container.track.channelId}:${op.pad.container.chainIndex}:${op.pad.channel}`;
    if (channels.has(key)) {
      throw new InvalidOpError(op.op, 'one batch cannot address the same Drum Machine pad twice');
    }
    channels.add(key);
  }
}

/**
 * Refuse a relocation batch unless its COMPLETE projected device structure is
 * safe. Relocations settle one per stage, so a per-stage preflight can run only
 * after earlier stages have already written. This projection is therefore the
 * atomicity boundary: both adapters call it once, before the first stage.
 *
 * Top-level positions are simulated in caller order. A move compacts the list,
 * so a later container address is resolved to the same initial device identity
 * through the projected list rather than re-read at its future position. Each
 * nested destination is then counted cumulatively against its reported bank.
 */
export function assertChainRelocatable(
  ops: readonly Op[],
  observeTrack: (track: TrackAddress) => ObservedDeviceBank | undefined,
  observeContainer: (container: DeviceAddress) => ObservedContainer | undefined,
): void {
  type ProjectedDevice = {
    readonly token: number;
    readonly name: string;
    /** Present only for a device independently observed at top level now. */
    readonly origin?: DeviceAddress;
  };
  type ProjectedSequence = { devices: ProjectedDevice[]; bankSize: number };

  let nextToken = 0;
  const tracks = new Map<string, ProjectedSequence>();
  const nested = new Map<string, ProjectedSequence>();

  const top = (track: TrackAddress): ProjectedSequence => {
    let state = tracks.get(track.channelId);
    if (state !== undefined) return state;
    const observed = observeTrack(track);
    if (observed === undefined) {
      throw new InvalidOpError('chain.relocate', 'the source track device order was not observable');
    }
    if (!observed.devicesComplete) {
      throw new InvalidOpError('chain.relocate', 'the complete source track device order must be observable');
    }
    if (observed.bankSize === undefined) {
      throw new InvalidOpError('chain.relocate', 'the top-level device bank did not report its width');
    }
    state = {
      bankSize: observed.bankSize,
      devices: observed.devices.map((item) => ({
        token: nextToken++,
        name: item.name,
        origin: device(track, item.index),
      })),
    };
    tracks.set(track.channelId, state);
    return state;
  };

  const sequence = (endpoint: TrackAddress | ChainAddress): ProjectedSequence => {
    if (endpoint.kind === 'track') return top(endpoint);
    const parent = top(endpoint.container.track);
    const holder = parent.devices[endpoint.container.chainIndex];
    if (holder === undefined) {
      throw new InvalidOpError(
        'chain.relocate',
        `no destination container exists at projected position ${endpoint.container.chainIndex}`,
      );
    }
    if (holder.origin === undefined) {
      throw new InvalidOpError(
        'chain.relocate',
        'the projected destination container has no pre-write structural identity',
      );
    }
    const key = `${holder.token}\u0000${endpoint.name}`;
    let state = nested.get(key);
    if (state !== undefined) return state;
    const observed = observeContainer(holder.origin);
    if (observed === undefined || !observed.chainsComplete) {
      throw new InvalidOpError(
        'chain.relocate',
        'the complete destination container structure must be observable before filling it',
      );
    }
    const found = lookupChain(observed, endpoint.name);
    if (!found.ok) {
      throw new InvalidOpError('chain.relocate', `the addressed device alternate is ${found.miss}`);
    }
    if (!found.chain.devicesComplete) {
      throw new InvalidOpError('chain.relocate', 'the complete device order of the addressed alternate must be observable');
    }
    if (found.chain.devicesBankSize === undefined) {
      throw new InvalidOpError('chain.relocate', 'the destination device bank did not report its width');
    }
    state = {
      bankSize: found.chain.devicesBankSize,
      devices: found.chain.devices.map((item) => ({ token: nextToken++, name: item.name })),
    };
    nested.set(key, state);
    return state;
  };

  for (const op of ops) {
    if (op.op !== 'chain.relocate') continue;
    if (op.source.chain !== undefined && op.source.chain.kind !== 'chain') {
      throw new InvalidOpError(op.op, 'a chain relocation needs a layer-chain parent');
    }
    const source = sequence(op.source.chain ?? op.source.track);
    const destination = sequence(op.destination);
    const sourceDevice = source.devices[op.source.chainIndex];
    if (sourceDevice === undefined) {
      throw new InvalidOpError(
        op.op,
        `no source device exists at projected position ${op.source.chainIndex}`,
      );
    }
    if (destination.devices.length >= destination.bankSize) {
      throw new InvalidOpError(
        op.op,
        `the complete request would leave ${destination.devices.length + 1} devices in a destination bank `
        + `${destination.bankSize} wide; the whole request was refused before any device moved`,
      );
    }
    if (op.mode === 'move') source.devices.splice(op.source.chainIndex, 1);
    destination.devices.push(op.mode === 'copy'
      ? { token: nextToken++, name: sourceDevice.name }
      : sourceDevice);
  }
}

/**
 * Refuse a top-level reorder unless the complete projected track sequence is
 * visible. Several moves in one batch address the sequence left by the prior
 * moves, so this is the before-first-frame atomicity boundary.
 */
export function assertDeviceRelocatable(
  ops: readonly Op[],
  observeTrack: (track: TrackAddress) => ObservedDeviceBank | undefined,
): void {
  type Item = { readonly token: number; readonly name: string };
  const projected = new Map<string, { devices: Item[]; bankSize: number }>();
  let token = 0;
  for (const op of ops) {
    if (op.op !== 'device.relocate') continue;
    let state = projected.get(op.track.channelId);
    if (state === undefined) {
      const observed = observeTrack(op.track);
      if (observed === undefined || !observed.devicesComplete || observed.bankSize === undefined) {
        throw new InvalidOpError(op.op, 'the complete top-level device order must be observable');
      }
      state = {
        devices: observed.devices.map((item) => ({ token: token++, name: item.name })),
        bankSize: observed.bankSize,
      };
      projected.set(op.track.channelId, state);
    }
    const sourceIndex = state.devices.length - 1 - op.sourceFromEnd;
    const source = state.devices[sourceIndex];
    const anchor = state.devices[op.before.chainIndex];
    if (source === undefined) {
      throw new InvalidOpError(op.op, `no source device exists ${op.sourceFromEnd} positions from the projected end`);
    }
    if (anchor === undefined) {
      throw new InvalidOpError(op.op, `no anchor device exists at projected position ${op.before.chainIndex}`);
    }
    if (source.name !== op.expectedName) {
      throw new InvalidOpError(
        op.op,
        `the projected tail device was "${source.name}", expected "${op.expectedName}"`,
      );
    }
    if (source.token === anchor.token) {
      throw new InvalidOpError(op.op, 'the source and before-anchor resolve to the same device');
    }
    // ⚠⚠ Refused HERE, before the first frame, rather than left for the proof to
    // decline afterwards. `verifyDeviceReorder` cannot certify a move whose
    // result spells the same names it started from — see
    // `reorderIndistinguishable` — and by the time that verdict arrives the move
    // has already been sent. A caller that restores a signal position after a
    // destructive step needs the refusal while it can still act on it.
    const started = state.devices.map((item) => item.name);
    const wanted = projectedReorder(started, sourceIndex, op.before.chainIndex);
    if (wanted === undefined || JSON.stringify(wanted) === JSON.stringify(started)) {
      throw new InvalidOpError(op.op, reorderIndistinguishable(started));
    }
    state.devices.splice(sourceIndex, 1);
    const anchorAt = state.devices.findIndex((item) => item.token === anchor.token);
    state.devices.splice(anchorAt, 0, source);
  }
}

/**
 * ⚠⚠ Standing rule 5 for SCENES: a create may not land past the window.
 *
 * *"Bank-window overflow is a PRECONDITION on every structural create — never a
 * post-hoc check."* The rule was written about tracks and its words cover scenes
 * verbatim; nothing implemented it, and `probe:e19` paid for that by stranding a
 * scene at project index 99 of a 16-wide window, where nothing could address or
 * delete it and it had to be removed by hand (`FINDINGS.md` E19).
 *
 * ⚠ Checked over the WHOLE batch, and summed. Two `scene.create`s of 4 in one
 * batch are a create of 8, and checking each against the current count would let
 * the pair through and strand the second one — the post-hoc check wearing a
 * precondition's clothes.
 *
 * ⚠ It refuses the batch before ANY op runs, which is what "never a partial
 * operation" means here. `scene.create` has no inverse we could reach: the row it
 * mints is outside the window, so `scene.delete` cannot address it either.
 *
 * Lives in the contract so both adapters refuse identically — PHASE-0 §Risks'
 * one-directional rule, that the fake must never be more permissive than Bitwig.
 */
export function assertSceneRoom(ops: readonly Op[], scenes: WindowCoverage): void {
  let wanted = 0;
  for (const op of ops) {
    if (op.op !== 'scene.create') continue;
    // ⚠ A non-positive count is refused rather than ignored. The handler is
    // `for (int i = 0; i < count; i++) createScene()`, so zero or negative is a
    // SILENT no-op — the trap class this contract refuses on principle (E4h) —
    // and it would also make the budget arithmetic below meaningless.
    if (!Number.isInteger(op.count) || op.count < 1) {
      throw new InvalidOpError('scene.create', `count must be a positive integer, got ${op.count}`);
    }
    wanted += op.count;
  }
  if (wanted === 0) return;
  const would = scenes.count + wanted;
  if (would > scenes.bankSize) {
    throw new BankWindowOverflowError(
      'scenes', Math.min(scenes.count, scenes.bankSize), would, scenes.bankSize);
  }
}

/**
 * Standing rule 5 for every operation that grows the flat track bank.
 *
 * Each create or copy consumes one row. The existing count already includes the
 * Master, FX returns and groups (E16r). The refusal is before the first call
 * because an overflowed create mints an audible track whose channelId cannot be
 * learned or cleaned up.
 */
export function assertTrackRoom(ops: readonly Op[], tracks: WindowCoverage): void {
  let wanted = 0;
  for (const op of ops) {
    if (op.op === 'track.create' || op.op === 'track.duplicate') {
      wanted++;
    }
  }
  if (wanted === 0) return;
  const would = tracks.count + wanted;
  if (tracks.count < 0 || would > tracks.bankSize) {
    throw new BankWindowOverflowError(
      'tracks', Math.min(Math.max(0, tracks.count), tracks.bankSize), would, tracks.bankSize);
  }
}

/**
 * ⚠⚠ Standing rule 5 for scene ROWS already addressed: no op may name one the
 * bank cannot reach.
 *
 * The other half of the scene hole, and the one that throws from inside a live
 * batch today: `encoder.ts` hands `op.scene.index` to `sceneBank.getScene(i)` as
 * a bank index, and the bank is bounded to its window — so a `SceneAddress` at or
 * past it produced *"Parameter index (=99) must be in the range 0 to 16"* from
 * the middle of a batch, after everything staged before it had already landed.
 *
 * ⚠ It refuses rows past the WINDOW, not rows past the project's scene count. A
 * row that does not exist is a different answer (`missing` in a snapshot,
 * `absent` in a resolve) and conflating them is how a blind spot becomes a
 * silently empty result — the distinction `Snapshot.unreachable` exists to keep.
 */
export function assertOpsAddressable(ops: readonly Op[], scenes: WindowCoverage): void {
  const blind = ops
    .flatMap(sceneRowsOf)
    .filter((row) => row.index >= scenes.bankSize);
  if (blind.length > 0) throw new BlindSpotError('scenes', blind, scenes.bankSize);
}

/**
 * ⚠⚠ No `clip.create` may name a slot that already holds a clip.
 *
 * The scene budget's other half, and the one nothing was watching. `scene.create`
 * is the op everybody knows grows the project; `clip.create` into an OCCUPIED
 * slot grows it too, by appending a row at the end — measured, E21 — so a budget
 * that only counts the first is a budget with a door beside it. The 170-scene
 * project this was found on got there entirely through this door.
 *
 * ⚠ The RULE lives here and the OBSERVATION does not: occupancy is world state,
 * so each adapter supplies the lookup and the refusal stays identical. That split
 * is what lets the conformance suite assert it on both — the live adapter reads
 * `slot.status`, the fake reads its model, and neither can be the lenient one.
 *
 * ⚠ `occupied` may answer `undefined` for a slot it cannot see. That is NOT a
 * pass: an unreadable slot is refused, because the failure it guards against is
 * one Bitwig performs silently.
 */
export function assertSlotsFree(
  ops: readonly Op[],
  occupied: (slot: SlotAddress) => boolean | undefined,
): void {
  // Model the occupancy changes in caller order. This permits an overlapping
  // block move when it is ordered from the far edge inward: the first move
  // vacates the destination of the second before the second reaches the wire.
  const projected = new Map<string, boolean | undefined>();
  const state = (slot: SlotAddress): boolean | undefined => {
    const key = addressKey(slot);
    if (!projected.has(key)) projected.set(key, occupied(slot));
    return projected.get(key);
  };
  const set = (slot: SlotAddress, value: boolean): void => {
    projected.set(addressKey(slot), value);
  };

  for (const op of ops) {
    if (op.op === 'clip.create') {
      if (state(op.slot) !== false) throw new SlotOccupiedError([clip(op.slot)]);
      set(op.slot, true);
      continue;
    }
    if (op.op === 'clip.duplicate') {
      if (state(op.destination) !== false) {
        throw new SlotOccupiedError([clip(op.destination)], 'overwrite');
      }
      set(op.destination, true);
      continue;
    }
    if (op.op === 'clip.move') {
      if (state(op.destination) !== false) {
        throw new SlotOccupiedError([clip(op.destination)], 'overwrite');
      }
      set(op.source.slot, false);
      set(op.destination, true);
    }
  }
}

/** Every source clip is positively verified at the point its verb runs. */
export function assertClipSources(
  ops: readonly Op[],
  occupied: (slot: SlotAddress) => boolean | undefined,
): void {
  // As with the destination guard above, caller order matters. In particular,
  // settings for a newly copied clip are safe in the same staged batch: the
  // copy establishes occupancy before the settings stage points at it.
  const projected = new Map<string, boolean | undefined>();
  const state = (slot: SlotAddress): boolean | undefined => {
    const key = addressKey(slot);
    if (!projected.has(key)) projected.set(key, occupied(slot));
    return projected.get(key);
  };
  const set = (slot: SlotAddress, value: boolean): void => {
    projected.set(addressKey(slot), value);
  };
  const requireClip = (slot: SlotAddress): void => {
    if (state(slot) !== true) {
      throw new AddressUnresolvedError(clip(slot), 'the source slot does not contain a verified clip');
    }
  };

  for (const op of ops) {
    switch (op.op) {
      case 'clip.create':
        set(op.slot, true);
        break;
      case 'clip.delete':
        set(op.slot, false);
        break;
      case 'clip.duplicate':
        requireClip(op.source.slot);
        set(op.destination, true);
        break;
      case 'clip.move':
        requireClip(op.source.slot);
        set(op.source.slot, false);
        set(op.destination, true);
        break;
      case 'clip.launch':
      case 'clip.launchSettings':
      case 'clip.update':
        requireClip(op.clip.slot);
        break;
      default:
        break;
    }
  }
}

/** Exhaustiveness guard: an unhandled variant fails to compile, not at runtime. */
export function assertNever(x: never, context: string): never {
  throw new Error(`${context}: unhandled variant ${JSON.stringify(x)}`);
}
