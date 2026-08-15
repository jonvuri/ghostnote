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
import { addressKey, clip } from './address.js';
import type { ClipAddress, DeviceAddress, ParamAddress, SceneAddress, SlotAddress, TrackAddress, BeatRange } from './address.js';
import { unwritableProps, type LaunchMode, type LaunchQuantization, type NoteRecord } from './state.js';
import type { SettleBudget } from './budgets.js';
import {
  AddressUnresolvedError, BankWindowOverflowError, BlindSpotError, InvalidOpError, SlotOccupiedError,
} from './errors.js';
import type { WindowCoverage } from './snapshot.js';

/** A device to insert. Both forms are checked before a frame is emitted (E4h). */
export type DeviceSource =
  | { readonly from: 'bitwig'; readonly uuid: string }
  | { readonly from: 'clap'; readonly uuid: string }
  /** ⚠ MUST be absolute and MUST end `.bwpreset` — both fail silently otherwise (E4h). */
  | { readonly from: 'file'; readonly path: string };

export type Op =
  // --- notes: Phase 1's only object class -----------------------------------
  | { readonly op: 'note.write'; readonly clip: ClipAddress; readonly channel?: number; readonly notes: readonly NoteRecord[] }
  | { readonly op: 'note.clear'; readonly clip: ClipAddress; readonly channel?: number; readonly range?: BeatRange }
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
  | { readonly op: 'device.insert'; readonly track: TrackAddress; readonly source: DeviceSource }
  | { readonly op: 'device.delete'; readonly device: DeviceAddress }
  | { readonly op: 'param.set'; readonly param: ParamAddress; readonly value: number }

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
  'param.set': 'instant',
  notify: 'instant',
  'clip.create': 'trackStruct',
  'clip.delete': 'trackStruct',
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
    case 'param.set':
    case 'notify':
      return [];
    default:
      return assertNever(op, 'sceneRowsOf');
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
