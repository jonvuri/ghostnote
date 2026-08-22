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
 *   4. **Some structural ops have no inverse, and fewer than it looks.** D5's
 *      rule is a constraint on REPORTING, not a reason to refuse the whole
 *      operation: apply what can be applied and say the rest loudly
 *      (`unrestored`). ⚠ Two ops were on the wrong side of that line until the
 *      2026-08-07 D16 amendment, and both are handled below: a deleted CLIP is
 *      recreated at its captured length and refilled from the stash, and an
 *      inserted DEVICE is deleted at the chain index the receipt minted. Neither
 *      needed a new capability — one needed a field the live adapter was already
 *      reading, the other needed the mint `track.create` has always had.
 *
 * Pure — no adapter, no clock, no I/O. That is what lets the hardest logic in
 * the phase be tested as a function of two values.
 */
import {
  addressKey, assertNever,
  type Address, type DeviceAddress, type NoteRecord, type Op, type Snapshot, type StateValue,
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
  /**
   * The executed batches this plan is undoing — each one's ops paired with the
   * identity its execution MINTED. Used for the one op whose inverse is knowable
   * afterwards but not before (D16 amendment 2, `device.insert`).
   *
   * ⚠ A LIST, not one pair, and that is the fix for the bug the shape caused.
   * `minted` is indexed by op index WITHIN a batch, so a walk composing several
   * takes cannot flatten them — op 0 means a different op in every take. The
   * first cut therefore took a single optional pair, which meant every store-side
   * path (`planUndo`, `planBetween`) had to decline to undo inserts at all, even
   * the single-take undo that has exactly one batch's mint in hand. Keeping the
   * pairs separate is all it took.
   *
   * Omitted by a caller with no execution record, which then reports rather than
   * undoes — because the one thing no path may do is say nothing.
   */
  readonly batches?: readonly InsertBatch[];
}

/** One executed batch: what it asked for, and what its execution minted. */
export interface InsertBatch {
  readonly ops: readonly Op[];
  readonly minted: Readonly<Record<number, Address>>;
}

/**
 * Why an insert nobody watched land cannot be undone.
 *
 * Exported because TWO places have to say it and they must not drift: the
 * executor records it on the take the moment the receipt comes back
 * (`unobservedInserts`), and `revertOps` says it for any caller that arrives
 * without that record.
 */
export const NO_MINT_NO_INVERSE =
  'the chain index this insert produced was never read back, so there is no address to delete. ' +
  'Inferring one would mean deleting whatever now sits at a position we counted rather than ' +
  'observed (E2c, D20) — reported instead. The device is still in the chain.';

/**
 * Materialize the ops that put the stashed state back.
 *
 * Accepts a whole `Take` or just the fields it needs, so session 2's partial
 * revert can pass a SLICED target list against the same stash and get a plan for
 * just that slice — no new concepts, which is the point of `addressKey` being
 * canonical. A `Take` additionally carries its receipt, which is where the one
 * inverse that cannot be known before execution comes from (`deviceRemovals`).
 */
export function revertOps(input: Take | RevertInput): RevertPlan {
  const { targets, unrevertable, stash } = input;
  const batches: readonly InsertBatch[] = 'receipt' in input
    ? [{ ops: input.ops, minted: input.receipt.minted }]
    : input.batches ?? [];
  const unrestored: Unrestored[] = [];

  /** Clip re-creates, deliberately FIRST. See `orderOps`. */
  const createOps: Op[] = [];
  /** Per-clip note restores, kept together so `planStages` interleaves them. */
  const noteOps: Op[] = [];
  /** Scalar restores — order-independent among themselves. */
  const scalarOps: Op[] = [];
  /** Un-creates, deliberately LAST. See `orderOps`. */
  const removalOps: Op[] = [];

  // ⚠ Two passes, because the notes pass has to know whether the clip under it
  // is going to exist. A clip whose length was never captured cannot be
  // recreated, and replaying its notes anyway would point at an empty slot —
  // which lands on a DIFFERENT clip, silently, with a healthy status (E2).
  const unrecreatable = unrecreatableClips(targets, stash, unrestored);
  const incompleteNoteClips = incompleteNoteRestores(targets, stash, unrestored);
  const clearedNoteClips = new Set<string>();

  for (const target of targets) {
    if (target.restore === 'none') {
      unrestored.push({
        address: target.address,
        what: target.unrestoredAs ?? target.address.kind,
        why: target.reason ?? 'no inverse exists',
      });
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

    if (target.address.kind === 'notes'
        && incompleteNoteClips.has(addressKey(target.address.clip))) continue;
    restoreValue(target, entry.value, {
      createOps, noteOps, scalarOps, removalOps, unrestored, unrecreatable, clearedNoteClips,
    });
  }

  for (const op of unrevertable) {
    unrestored.push({ what: op.unrestoredAs ?? op.op, why: op.why });
  }

  removalOps.push(...deviceRemovals(batches, unrevertable, unrestored));

  return { ops: orderOps({ createOps, noteOps, scalarOps, removalOps }), unrestored };
}

/**
 * A note replay clears the complete clip. Refuse a partial channel replay unless
 * the stash has one readable value for every MIDI channel in that clip.
 */
function incompleteNoteRestores(
  targets: readonly WriteTarget[],
  stash: Snapshot,
  unrestored: Unrestored[],
): ReadonlySet<string> {
  const byClip = new Map<string, { clip: Extract<Address, { kind: 'clip' }>; targets: WriteTarget[] }>();
  for (const target of targets) {
    if (target.address.kind !== 'notes' || target.restore !== 'replay') continue;
    const key = addressKey(target.address.clip);
    const group = byClip.get(key) ?? { clip: target.address.clip, targets: [] };
    group.targets.push(target);
    byClip.set(key, group);
  }

  const blocked = new Set<string>();
  for (const [key, group] of byClip) {
    const readable = group.targets.filter((target) =>
      stash.entries[target.key]?.value.of === 'notes');
    if (readable.length === 0) continue;
    const channels = new Set(group.targets.map((target) =>
      target.address.kind === 'notes' ? target.address.channel : -1));
    const complete = channels.size === 16
      && Array.from({ length: 16 }, (_, channel) => channel).every((channel) =>
        group.targets.some((target) => target.address.kind === 'notes'
          && target.address.channel === channel
          && stash.entries[target.key]?.value.of === 'notes'));
    if (complete) continue;
    blocked.add(key);
    unrestored.push({
      address: group.clip,
      what: 'notes',
      why: 'the host can clear only the complete clip, but this restore does not have one '
        + 'readable stashed value for every MIDI channel. No note channel was changed.',
    });
  }
  return blocked;
}

/**
 * Clips the stash says were THERE but cannot describe well enough to rebuild.
 *
 * The captured length is what makes a clip re-creatable at all (D16 amendment 1),
 * so a clip entry that exists without one is a hole — the live adapter omits
 * `lengthBeats` rather than defaulting it, because a clip silently recreated at
 * the wrong length is a musical value invented from nothing. Reported here, once,
 * and used below to suppress the note replay that would otherwise mispoint.
 */
function unrecreatableClips(
  targets: readonly WriteTarget[],
  stash: Snapshot,
  unrestored: Unrestored[],
): ReadonlySet<string> {
  const out = new Set<string>();
  for (const target of targets) {
    if (target.address.kind !== 'clip' || target.restore !== 'replay') continue;
    const value = stash.entries[target.key]?.value;
    if (value?.of !== 'clip' || !value.exists || value.lengthBeats !== undefined) continue;
    out.add(target.key);
    unrestored.push({
      address: target.address,
      what: 'clip',
      why: 'a clip was here, but its length was not captured — so recreating it would mean ' +
        'inventing a musical value the stash never held. The clip is left as the batch made it, ' +
        'and its notes are not replayed, because writing into a slot with no clip lands the ' +
        'cursor on a DIFFERENT clip, silently (E2).',
    });
  }
  return out;
}

/**
 * ⚠ The inverse of `device.insert`, materialised from what execution OBSERVED.
 *
 * D16d gave `clip.create` an exact inverse — delete it — and every word of that
 * reasoning is true of a device that did not exist: the delete is structural, so
 * no readback is needed, and it returns the chain to a state that provably
 * existed. The objection D16d applied to `track.create` (*a human may already
 * have put work in it*) is answered the same way it already is for clips: the
 * revert SAYS what it deletes, and D5's reporting rule is the protection.
 *
 * ⚠ It is emitted only from an OBSERVED mint, never from a computed index. A
 * chain index that was inferred rather than read back can be off by any structural
 * op that ran in between, and the cost of being wrong here is deleting a device
 * the user cares about — D20's execution discipline in miniature (*name the
 * survivor, never count it*), and E2c's rule for `track.create` applied to the
 * only other op that mints. An insert nobody watched land is REPORTED, not
 * guessed at.
 */
function deviceRemovals(
  batches: readonly InsertBatch[],
  unrevertable: readonly UnrevertableOp[],
  unrestored: Unrestored[],
): Op[] {
  // ⚠ Already said, by whoever knew it first. The executor stamps an unobserved
  // insert onto the take the moment the receipt comes back, so by the time a plan
  // is built the report exists — and the `unrevertable` loop above has already
  // pushed it. Matching on (op, opIndex) can only ever collapse two reports of the
  // same thing into one; it cannot suppress a report that nothing else makes,
  // because an entry has to BE in `unrevertable` to match.
  const alreadySaid = new Set(
    unrevertable.filter((u) => u.op === 'device.insert').map((u) => u.opIndex),
  );
  const devices: DeviceAddress[] = [];
  for (const batch of batches) {
    batch.ops.forEach((op, opIndex) => {
      if (op.op !== 'device.insert') return;
      const address = batch.minted[opIndex];
      if (address?.kind === 'device') {
        devices.push(address);
        return;
      }
      if (alreadySaid.has(opIndex)) return;
      unrestored.push({ what: op.op, why: NO_MINT_NO_INVERSE });
    });
  }
  // ⚠ Descending, because a chain RE-INDEXES on delete (E3): removing device 1
  // first would shift device 2 into its place and the second delete would take
  // the wrong device. Ascending order is the bug that looks like it works on a
  // one-device batch. Sorting across ALL batches is what makes a multi-take undo
  // safe too — the hazard is the chain's shape, not which take caused it.
  return devices
    .sort((a, b) => b.chainIndex - a.chainIndex)
    .map((device) => ({ op: 'device.delete', device }));
}

interface Sink {
  readonly createOps: Op[];
  readonly noteOps: Op[];
  readonly scalarOps: Op[];
  readonly removalOps: Op[];
  readonly unrestored: Unrestored[];
  readonly unrecreatable: ReadonlySet<string>;
  readonly clearedNoteClips: Set<string>;
}

function restoreValue(target: WriteTarget, value: StateValue, sink: Sink): void {
  switch (value.of) {
    case 'notes': {
      if (target.address.kind !== 'notes') return;
      if (sink.unrecreatable.has(addressKey(target.address.clip))) return;
      const clip = target.address.clip;
      const channel = target.address.channel;
      const clipKey = addressKey(clip);
      const replay: NoteRecord[] = [];
      const withheld = new Map<string, number>();
      for (const note of value.notes) {
        const split = splitReplayable(note);
        replay.push(split.note);
        for (const prop of split.withheld) withheld.set(prop, (withheld.get(prop) ?? 0) + 1);
      }

      // Clear once, then reconstruct every protected channel. The host clear is
      // clip-wide even though note reads and writes are channel-scoped.
      if (!sink.clearedNoteClips.has(clipKey)) {
        sink.noteOps.push({ op: 'note.clear', clip });
        sink.clearedNoteClips.add(clipKey);
      }
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
      if (!value.exists) {
        // The slot was EMPTY before the batch, and deleting the clip reproduces
        // that exactly. This is the one structural inverse that is not a guess:
        // absence has no content to fail to recreate.
        sink.removalOps.push({ op: 'clip.delete', slot: target.address.slot });
        return;
      }
      // A clip was here. Recreate it before notes, metadata, and launch settings
      // are restored. `orderOps` enforces this order because a cursor pointed at
      // an empty slot can land on another clip (E2).
      const lengthBeats = value.lengthBeats;
      // Already reported by `unrecreatableClips`; a default here would be the
      // invented value that function exists to refuse.
      if (lengthBeats === undefined) return;
      sink.createOps.push({ op: 'clip.create', slot: target.address.slot, lengthBeats });
      return;
    }

    case 'clipLaunch':
      if (target.address.kind !== 'clipLaunch') return;
      sink.scalarOps.push({
        op: 'clip.launchSettings',
        clip: target.address.clip,
        quantization: value.launch.quantization,
        mode: value.launch.mode,
        useLoopStartAsQuantizationReference: value.launch.useLoopStartAsQuantizationReference,
      });
      return;

    case 'clipMetadata':
      if (target.address.kind !== 'clipMetadata') return;
      sink.scalarOps.push({
        op: 'clip.update',
        clip: target.address.clip,
        metadata: value.metadata,
      });
      return;

    case 'clipPlay':
      return;

    case 'track':
      if (target.address.kind !== 'track') return;
      sink.scalarOps.push({ op: 'track.rename', track: target.address, name: value.track.name });
      return;

    case 'param':
      if (target.address.kind !== 'param') return;
      sink.scalarOps.push({ op: 'param.set', param: target.address, value: value.param.value });
      return;

    case 'remote':
      if (target.address.kind !== 'remote') return;
      sink.scalarOps.push({ op: 'remote.set', remote: target.address, value: value.remote.value });
      return;

    case 'remotes':
      return;

    case 'device':
      sink.unrestored.push({
        address: target.address,
        what: 'device',
        why: 'a device chain has no readback that could reproduce it (E3, D8).',
      });
      return;

    // ⚠ Reported, never inverted. See the caveat in `fidelity.ts`: the measured
    // lifecycle is asymmetric — a chain can be minted by duplication and removed
    // by nothing typed — so the honest report is that the chain stands as
    // observed, which is what an unrestored entry says.
    case 'chain':
      sink.unrestored.push({
        address: target.address,
        what: 'chain',
        why: 'a layer chain has no typed delete and no create-from-nothing (e17al, e17am, e17ak), '
          + 'so neither adding nor removing one can be reversed.',
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
  return `withheld on ${notes}: \`${prop}\` has no verified write/read inverse. The stash keeps ` +
    'the observed value, but replay does not guess a correction.';
}

/**
 * ⚠ Ordering is correctness, not cosmetics.
 *
 * Clip re-creates run FIRST, note restores next, and every removal LAST. Both
 * ends of that are the same measurement: pointing at an empty slot silently lands
 * the cursor on the wrong clip and reports a healthy status (E2). So a plan that
 * replayed notes before recreating their clip would write into somebody else's
 * music, and one that deleted a clip before writing into a neighbouring one would
 * be writing through a cursor whose target had just evaporated. Deleting last
 * also means the notes the batch wrote into a clip it created are carried away
 * with the clip instead of being cleared and then orphaned.
 *
 * `planStages` gives each `clip.create` its own stage and a `trackStruct` settle,
 * so "first" in this list really is "before the slot is pointed at".
 *
 * Within `noteOps` the per-clip pairing is preserved exactly as built, because
 * `splitNoteWrite` expands each `note.write` in place and `planStages` must end
 * up with every generated `note.props` stage directly behind its own create
 * (E15-F). Reordering here would reintroduce the hoist that D10 rejects.
 */
function orderOps(parts: { createOps: Op[]; noteOps: Op[]; scalarOps: Op[]; removalOps: Op[] }): Op[] {
  return [...parts.createOps, ...parts.noteOps, ...parts.scalarOps, ...parts.removalOps];
}
