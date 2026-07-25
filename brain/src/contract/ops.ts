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
import type { ClipAddress, DeviceAddress, ParamAddress, SceneAddress, SlotAddress, TrackAddress, BeatRange } from './address.js';
import { unwritableProps, type NoteRecord } from './state.js';
import type { SettleBudget } from './budgets.js';
import { InvalidOpError } from './errors.js';

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

  // --- tracks: the only ops that MINT identity ------------------------------
  // `createInstrumentTrack(position)` does not honour positions (E2c), so the
  // receipt reports the channelId the new track was FOUND at, never a guess.
  | { readonly op: 'track.create'; readonly name: string }
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
  'track.create': 'trackStruct',
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

/** Ops that change the scene layout, and therefore invalidate every scene epoch (E3). */
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

/** Exhaustiveness guard: an unhandled variant fails to compile, not at runtime. */
export function assertNever(x: never, context: string): never {
  throw new Error(`${context}: unhandled variant ${JSON.stringify(x)}`);
}
