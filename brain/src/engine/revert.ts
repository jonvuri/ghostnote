/**
 * `revertOps` — turning captured STATE back into OPS.
 *
 * This is the piece §8b's "revert = apply the stash" makes sound trivial and is
 * not. Four things hide inside it, and each one is a musician's data:
 *
 *   1. **A revert must CLEAR before it writes.** `note.write` merges into what
 *      is already there; replaying a stash on top of the batch's output would
 *      union the two, so the clip ends up with both versions' notes. `note.clear`
 *      first is not tidiness, it is the difference between restore and merge.
 *   2. **⚠ `gain` must not be replayed.** It reads back 2x written (E2) and the
 *      inverse is UNVERIFIED (D8: "labelled, never corrected"), so a stash of a
 *      note written at 0.7 holds 1.4 — and replaying that would write 1.4 and
 *      read back 2.8. Every revert would double it again. So gain is WITHHELD
 *      and reported. That is a bounded, visible failure; replaying is an
 *      unbounded, compounding one, and both are wrong until a live probe
 *      measures the inverse. When it does, `NOTE_PROP_FIDELITY['gain']` becomes
 *      `'exact'` and this stops withholding it — one edit, in `state.ts`.
 *   3. **⚠ `pressure` cannot be replayed at all.** A human may have authored it
 *      in a clip we are about to overwrite, so readback captures it — and then
 *      `assertOpsWritable` REFUSES to emit it (E15-E). A revert that throws
 *      because of a property the user authored is a worse failure than one that
 *      reports "restored all but pressure", so the stash→ops path strips it here
 *      and the take says so.
 *   4. **Structural ops have no inverse.** D5's rule is a constraint on
 *      REPORTING, not a reason to refuse the whole operation: apply what can be
 *      applied and say the rest loudly (`unrestored`).
 *
 * Pure — no adapter, no clock, no I/O. That is what lets the hardest logic in
 * the phase be tested as a function of two values.
 */
import {
  addressKey, assertNever, type Address, type NoteRecord, type Op, type Snapshot, type StateValue,
} from '../contract/index.js';
import { splitReplayable } from './fidelity.js';
import type { Take } from './take.js';
import type { UnrevertableOp, WriteTarget } from './write-set.js';

/** Something the stash holds but the revert will not put back, and why. */
export interface Unrestored {
  readonly address?: Address;
  /** The property, op kind or address kind that could not be restored. */
  readonly what: string;
  readonly why: string;
}

export interface RevertPlan {
  /**
   * Ready for `planStages`. Ordering is load-bearing — see `orderOps` below.
   */
  readonly ops: readonly Op[];
  /** D5: a revert never silently under-delivers. This is the "never silently" half. */
  readonly unrestored: readonly Unrestored[];
}

export interface RevertInput {
  readonly targets: readonly WriteTarget[];
  readonly unrevertable: readonly UnrevertableOp[];
  readonly stash: Snapshot;
}

/**
 * Materialize the ops that put the stashed state back.
 *
 * Accepts a whole `Take` or the three fields it needs, so session 2's partial
 * revert can pass a SLICED target list against the same stash and get a plan for
 * just that slice — no new concepts, which is the point of `addressKey` being
 * canonical.
 */
export function revertOps(input: Take | RevertInput): RevertPlan {
  const { targets, unrevertable, stash } = input;
  const unrestored: Unrestored[] = [];

  /** Per-clip note restores, kept together so `planStages` interleaves them. */
  const noteOps: Op[] = [];
  /** Scalar restores — order-independent among themselves. */
  const scalarOps: Op[] = [];
  /** Un-creates, deliberately LAST. See `orderOps`. */
  const removalOps: Op[] = [];

  for (const target of targets) {
    if (target.restore === 'none') {
      unrestored.push({ address: target.address, what: target.address.kind, why: target.reason ?? 'no inverse exists' });
      continue;
    }

    if (stash.unreachable.some((a) => addressKey(a) === target.key)) {
      unrestored.push({
        address: target.address,
        what: target.address.kind,
        why: 'outside the bank window when the stash was taken — invisible, not empty, so there ' +
          'is nothing to replay (E5, standing rule 5).',
      });
      continue;
    }

    const entry = stash.entries[target.key];
    if (entry === undefined) {
      // Nothing was there. Restoring nothing is correct and needs no op — and
      // for a slot the batch CREATED, the clip target below supplies the delete
      // that actually reproduces the absence.
      continue;
    }

    restoreValue(target, entry.value, { noteOps, scalarOps, removalOps, unrestored });
  }

  for (const op of unrevertable) {
    unrestored.push({ what: op.op, why: op.why });
  }

  return { ops: orderOps({ noteOps, scalarOps, removalOps }), unrestored };
}

interface Sink {
  readonly noteOps: Op[];
  readonly scalarOps: Op[];
  readonly removalOps: Op[];
  readonly unrestored: Unrestored[];
}

function restoreValue(target: WriteTarget, value: StateValue, sink: Sink): void {
  switch (value.of) {
    case 'notes': {
      if (target.address.kind !== 'notes') return;
      const clip = target.address.clip;
      const channel = target.address.channel;
      const replay: NoteRecord[] = [];
      const withheld = new Map<string, number>();
      for (const note of value.notes) {
        const split = splitReplayable(note);
        replay.push(split.note);
        for (const prop of split.withheld) withheld.set(prop, (withheld.get(prop) ?? 0) + 1);
      }

      // ⚠ CLEAR FIRST, ALWAYS — including when the stash is empty, which is the
      // case that matters most: "there were no notes here" is restored by
      // removing whatever the batch wrote, and a plan that only ever writes
      // could never express it.
      sink.noteOps.push({ op: 'note.clear', clip, channel });
      if (replay.length > 0) sink.noteOps.push({ op: 'note.write', clip, channel, notes: replay });

      for (const [prop, count] of withheld) {
        sink.unrestored.push({
          address: target.address,
          what: prop,
          why: withheldReason(prop, count),
        });
      }
      return;
    }

    case 'clip': {
      if (target.address.kind !== 'clip') return;
      if (value.exists) {
        // The clip was already there. We did not create it, so there is nothing
        // to un-create — and its content is restored by the notes target above,
        // not from here.
        return;
      }
      // The slot was EMPTY before the batch, and deleting the clip reproduces
      // that exactly. This is the one structural inverse that is not a guess:
      // absence has no content to fail to recreate.
      sink.removalOps.push({ op: 'clip.delete', slot: target.address.slot });
      return;
    }

    case 'track':
      if (target.address.kind !== 'track') return;
      sink.scalarOps.push({ op: 'track.rename', track: target.address, name: value.track.name });
      return;

    case 'param':
      if (target.address.kind !== 'param') return;
      sink.scalarOps.push({ op: 'param.set', param: target.address, value: value.param.value });
      return;

    case 'device':
      sink.unrestored.push({
        address: target.address,
        what: 'device',
        why: 'a device chain has no readback that could reproduce it (E3, D8).',
      });
      return;

    default:
      return assertNever(value, 'revertOps.restoreValue');
  }
}

function withheldReason(prop: string, count: number): string {
  const notes = count === 1 ? '1 note' : `${count} notes`;
  if (prop === 'pressure') {
    return `withheld on ${notes}: \`pressure\` cannot be written through this API (E15-E) — the ` +
      'value reaches only the writing cursor\'s own NoteStep cache. The stash keeps what the ' +
      'human authored; the revert cannot put it back, and refusing the whole revert over it ' +
      'would be the worse failure.';
  }
  return `withheld on ${notes}: \`${prop}\` reads back doubled and the inverse is UNVERIFIED ` +
    '(E2, D8). Replaying the stashed value would double it AGAIN, and compound on every ' +
    'subsequent revert. Withheld rather than corrected on a guess — flipping ' +
    'NOTE_PROP_FIDELITY to `exact` after a live probe is what re-enables it.';
}

/**
 * ⚠ Ordering is correctness, not cosmetics.
 *
 * Note restores run FIRST and clip deletions LAST. Pointing at an empty slot
 * silently lands the cursor on the wrong clip (E2), so a plan that deleted a
 * clip before writing into a neighbouring one would be writing through a cursor
 * whose target had just evaporated. Deleting last also means the notes the batch
 * wrote into a clip it created are simply carried away with the clip, instead of
 * being cleared and then orphaned.
 *
 * Within `noteOps` the per-clip pairing is preserved exactly as built, because
 * `splitNoteWrite` expands each `note.write` in place and `planStages` must end
 * up with every generated `note.props` stage directly behind its own create
 * (E15-F). Reordering here would reintroduce the hoist that D10 rejects.
 */
function orderOps(parts: { noteOps: Op[]; scalarOps: Op[]; removalOps: Op[] }): Op[] {
  return [...parts.noteOps, ...parts.scalarOps, ...parts.removalOps];
}

