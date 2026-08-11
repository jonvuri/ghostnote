/**
 * The stash against the Phase-0 fake — offline, no disk, no daemon, no Bitwig.
 *
 * ⚠ These tests replace the take store's. The store's exit criteria were about a
 * GRAPH — branching, jumping, restart, retention — and D18 retired every one of
 * them by making the project the take log. What is left is the three jobs the
 * stash kept (D19), and they carry the same unusual weight the store's did: no
 * human exercises agent-edit reversal inside Phase 1, so these tests are the only
 * thing between a wrong boundary and a phase-late discovery. They drive real ops
 * through the executor against the fake rather than asserting on bookkeeping.
 *
 *   B-record    what a batch did is recorded, including a batch that did nothing
 *   B-revert    job 1 — an unbranched write is put back from the stash
 *   B-partial   D17d — partial revert by address survives the store's retirement
 *   B-bound     ⚠ job 3, D19 — reversal is bounded to the session's own changesets
 *               and to what we ourselves last wrote; past that it WITHHOLDS
 *   B-print     job 2 — the same check, run before a write, is the clip fingerprint
 *   B-fidelity  D5 — what a reversal cannot put back is readable BEFORE it runs
 *   B-device    D16 amendment 2 — an insert is undone at the index it minted
 *   (the read/mutate split and the offline sweep are `surface.test.ts`)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { control } from '../adapters/fake/control.js';
import {
  addressKey, clip, notes as notesAt, scene, slot, track,
  type BitwigAdapter, type ClipAddress, type NoteRecord, type Op, type SlotAddress,
  type TrackAddress,
} from '../contract/index.js';
import { branchProtected, Executor, type Take } from '../engine/index.js';
import { ChangesetNotFoundError, DuplicateChangesetError, EmptySliceError } from './errors.js';
import { Stash, type ReversalPlan } from './stash.js';

// --- fixture -----------------------------------------------------------------

interface Fixture {
  readonly fake: FakeAdapter;
  readonly executor: Executor;
  readonly stash: Stash;
  readonly trackA: TrackAddress;
  readonly clipA: ClipAddress;
  readonly clipB: ClipAddress;
  /** An empty slot on track A — where a clip this session CREATES can live. */
  readonly emptySlot: SlotAddress;
}

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, ...over,
});

async function fixture(): Promise<Fixture> {
  const fake = new FakeAdapter({ tracks: ['gn-A', 'gn-B'], scenes: 8 });
  const [a, b] = fake.model.visibleTracks();
  const trackA = track(a!.channelId);
  const slotA = slot(trackA, scene(0, 1));
  const slotB = slot(track(b!.channelId), scene(0, 1));
  // ⚠ E2: the clip must exist before anything points at that slot.
  await fake.apply({
    ops: [
      { op: 'clip.create', slot: slotA, lengthBeats: 4 },
      { op: 'clip.create', slot: slotB, lengthBeats: 4 },
    ],
  });
  await fake.settle('trackStruct');

  let n = 0;
  let clock = 1_000_000;
  const executor = new Executor(fake, { newId: () => `c-${++n}`, now: () => (clock += 1000) });
  return {
    fake,
    executor,
    stash: new Stash({ now: () => clock }),
    trackA,
    clipA: clip(slotA),
    clipB: clip(slotB),
    emptySlot: slot(trackA, scene(3, 1)),
  };
}

async function readNotes(fake: FakeAdapter, address: ClipAddress, channel = 0): Promise<readonly NoteRecord[]> {
  const target = notesAt(address, channel);
  const snap = await fake.read([target]);
  const entry = snap.entries[addressKey(target)];
  return entry?.value.of === 'notes' ? entry.value.notes : [];
}

const pitches = async (fake: FakeAdapter, c: ClipAddress): Promise<number[]> =>
  (await readNotes(fake, c)).map((n) => n.pitch).sort((x, y) => x - y);

/**
 * Run a patch and record it — what session 3 will do on every agent write.
 *
 * ⚠ `protect` is the fidelity floor showing through (D18c): a batch whose prior
 * state cannot be restored exactly is REFUSED unless something is protecting it,
 * and the cases below that overwrite a human's expression or delete a track have
 * to say so. It is a per-call argument rather than a blanket default precisely so
 * the ordinary commits stay ordinary — if this helper cleared everything, these
 * tests would stop noticing the floor at all.
 */
async function commit(fx: Fixture, ops: readonly Op[], protect?: string): Promise<Take> {
  const take = await fx.executor.run(
    ops,
    protect === undefined ? {} : { clearance: branchProtected(protect) },
  );
  fx.stash.record(take);
  return take;
}

/**
 * ⚠ A HUMAN edit: straight at the adapter, with no executor and no stash record.
 *
 * That is the whole point — it is a write the session has no changeset for, which
 * is exactly what the boundary exists to notice.
 */
async function human(fx: Fixture, ops: readonly Op[]): Promise<void> {
  await fx.fake.apply({ ops });
  await fx.fake.settle('noteWrite');
}

/**
 * The reversal protocol, written out here rather than hidden inside the stash:
 * read the set, plan against what came back, apply with the plan's own clearance.
 *
 * The stash must not apply anything — it has no adapter and cannot know whether
 * the ops landed, which is the same reason the store was never allowed to.
 */
async function reverse(fx: Fixture, id: string, slice?: Parameters<typeof fx.stash.log.planReversal>[2]): Promise<ReversalPlan> {
  const current = await fx.fake.read(fx.stash.log.readSetFor(id));
  const plan = fx.stash.log.planReversal(id, current, slice);
  if (plan.ops.length > 0) {
    fx.stash.record(await fx.executor.run(plan.ops, { clearance: plan.clearance }));
  }
  return plan;
}

// --- B-record ----------------------------------------------------------------

test('B-record: changesets are kept in session order, newest first out of `list`', async () => {
  const fx = await fixture();
  const one = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 })] }]);
  const two = await commit(fx, [{ op: 'note.write', clip: fx.clipB, notes: [note({ pitch: 36 })] }]);

  assert.deepEqual(fx.stash.log.list().map((c) => c.id), [two.id, one.id]);
  assert.deepEqual(fx.stash.log.list().map((c) => c.seq), [2, 1]);
  assert.equal(fx.stash.log.require(one.id).seq, 1);
  assert.equal(fx.stash.log.has('nobody'), false);
  assert.equal(fx.stash.log.get('nobody'), undefined);
});

test('B-record: a REJECTED batch is recorded, and is nobody\'s last writer', async () => {
  const fx = await fixture();
  const key = addressKey(notesAt(fx.clipA));
  const good = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 })] }]);

  // ⚠ A stale `ifRevision` rejects the batch WHOLE, applying zero ops (D10/E8-D).
  // Its stash is still a true record of that moment — so it is kept — but it
  // wrote nothing, and treating it as the last writer would make the NEXT
  // reversal think an untouched address had been superseded.
  const stale = await fx.executor.run([{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 99 })] }]);
  const rejected: Take = { ...stale, report: { ...stale.report, applied: false } };
  fx.stash.record(rejected);

  assert.equal(fx.stash.log.summary(rejected.id).applied, false);
  assert.equal(fx.stash.log.lastWriterOf(key), good.id);

  // ⚠ And it reverses to NOTHING. Its stash and its verify are the same snapshot,
  // so a boundary check would read `ours` and `revertOps` would emit a
  // clear/write pair that rewrites the clip to itself — which is not free: E8-E's
  // same-pitch truncation means a rewrite can still change durations.
  const current = await fx.fake.read(fx.stash.log.readSetFor(rejected.id));
  const plan = fx.stash.log.planReversal(rejected.id, current);
  assert.deepEqual(plan.ops, []);
  assert.match(plan.caveats.join(' '), /applied nothing/);
});

test('B-record: recording the same changeset twice is refused, not silently overwritten', async () => {
  const fx = await fixture();
  const take = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note()] }]);
  assert.throws(() => fx.stash.record(take), DuplicateChangesetError);
});

// --- B-revert: job 1, the unbranched write -----------------------------------

test('B-revert: an unbranched write is put back from the stash, exactly', async () => {
  const fx = await fixture();
  await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 })] }]);
  const over = await commit(fx, [
    { op: 'note.clear', clip: fx.clipA },
    { op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 72 })] },
  ]);
  assert.deepEqual(await pitches(fx.fake, fx.clipA), [72]);

  const plan = await reverse(fx, over.id);
  assert.equal(plan.fidelity, 'exact');
  assert.deepEqual(plan.unrestored, []);
  assert.deepEqual(await pitches(fx.fake, fx.clipA), [60], 'the hats are back');
});

test('B-revert: reversing a `clip.delete` rebuilds the clip and refills it (D16 amendment 1)', async () => {
  const fx = await fixture();
  await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 }), note({ pitch: 64, startBeats: 1 })] }]);

  // ⚠ `lossy`, not `none` — the live adapter captures `lengthBeats` now, so the
  // clip is rebuildable and the floor has something real to grade.
  const deleted = await commit(fx, [{ op: 'clip.delete', slot: fx.clipA.slot }], 'B-revert');
  assert.equal(deleted.fidelity, 'lossy');
  assert.deepEqual(await pitches(fx.fake, fx.clipA), []);

  const plan = await reverse(fx, deleted.id);
  assert.ok(plan.ops.some((o) => o.op === 'clip.create'), 'the clip is recreated at its captured length');
  assert.deepEqual(await pitches(fx.fake, fx.clipA), [60, 64]);
  assert.match(plan.caveats.join(' '), /AUTOMATION LANES/, 'and it says what it could not bring back');
});

// --- B-partial: D17d ---------------------------------------------------------

test('B-partial: a partial reversal restores ONE clip and leaves the rest of the write-set alone', async () => {
  const fx = await fixture();
  await commit(fx, [
    { op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 })] },
    { op: 'note.write', clip: fx.clipB, notes: [note({ pitch: 36 })] },
  ]);

  // One batch, two clips — "keep the hats, revert the snare" (D5), which no
  // amount of track-level branching reaches because it is WITHIN a track.
  const both = await commit(fx, [
    { op: 'note.clear', clip: fx.clipA },
    { op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 72 })] },
    { op: 'note.clear', clip: fx.clipB },
    { op: 'note.write', clip: fx.clipB, notes: [note({ pitch: 48 })] },
  ]);
  assert.deepEqual(await pitches(fx.fake, fx.clipA), [72]);
  assert.deepEqual(await pitches(fx.fake, fx.clipB), [48]);

  const plan = await reverse(fx, both.id, { slice: fx.stash.log.selectClip(both.id, fx.clipA) });
  assert.deepEqual(plan.addresses, [addressKey(notesAt(fx.clipA))]);

  assert.deepEqual(await pitches(fx.fake, fx.clipA), [60], 'clip A is back');
  assert.deepEqual(await pitches(fx.fake, fx.clipB), [48], 'clip B is untouched');
});

test('B-partial: a slice that selects nothing is a REFUSAL, never a silent no-op', async () => {
  const fx = await fixture();
  const take = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note()] }]);
  const current = await fx.fake.read(fx.stash.log.readSetFor(take.id));

  assert.throws(
    () => fx.stash.log.planReversal(take.id, current, { slice: { keys: ['notes:nobody:0@1:ch0'] } }),
    EmptySliceError,
    'zero ops reported as success is indistinguishable from a reversal that worked',
  );
  // ...and the clip-selector for a clip the changeset never touched is the same case.
  assert.throws(
    () => fx.stash.log.planReversal(take.id, current, { slice: fx.stash.log.selectClip(take.id, fx.clipB) }),
    EmptySliceError,
  );
});

// --- B-bound: D19's two structural bounds ------------------------------------

test('B-bound: reversing anything outside this session\'s changesets is UNASKABLE', async () => {
  const fx = await fixture();
  const current = await fx.fake.read([]);
  // ⚠ The first bound, and it is the shape of the API rather than a check
  // somebody has to remember: the stash holds this session's batches and nothing
  // else, so there is no id for a human edit or another session's write.
  assert.throws(() => fx.stash.log.planReversal('c-99', current), ChangesetNotFoundError);
  assert.throws(() => fx.stash.log.readSetFor('c-99'), ChangesetNotFoundError);
  assert.throws(() => fx.stash.log.boundary('c-99', current), ChangesetNotFoundError);
  assert.throws(() => fx.stash.log.summary('c-99'), ChangesetNotFoundError);
});

test('B-bound: ⚠ a HUMAN edit since our write is withheld and reported, never overwritten', async () => {
  const fx = await fixture();
  await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 })] }]);
  const ours = await commit(fx, [
    { op: 'note.clear', clip: fx.clipA },
    { op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 72 })] },
  ]);

  // The human plays something into the clip we just wrote.
  await human(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 79, startBeats: 2 })] }]);

  const plan = await reverse(fx, ours.id);
  assert.deepEqual(plan.ops, [], 'nothing is written');
  assert.equal(plan.withheld.length, 1);
  assert.equal(plan.withheld[0]!.verdict, 'changed');
  assert.equal(plan.withheld[0]!.lastWrittenBy, ours.id);
  assert.match(plan.unrestored.map((u) => u.why).join(' '), /a human edited it/);
  // ⚠ `none`, not `exact`. A reversal that dropped its whole write-set and still
  // claimed a clean label is the precise shape of under-delivery D5 forbids.
  assert.equal(plan.fidelity, 'none');
  assert.deepEqual(await pitches(fx.fake, fx.clipA), [72, 79], 'the human\'s note is still there');
});

test('B-bound: a LATER changeset of ours names itself rather than reading as a human edit', async () => {
  const fx = await fixture();
  const first = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 })] }]);
  const second = await commit(fx, [
    { op: 'note.clear', clip: fx.clipA },
    { op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 72 })] },
  ]);

  // ⚠ Reversing the middle of two writes to the same clip would silently discard
  // the later one. Withholding is right; saying WHICH changeset to reverse first
  // is what makes the withholding actionable rather than a dead end.
  const plan = await reverse(fx, first.id);
  assert.deepEqual(plan.ops, []);
  assert.equal(plan.withheld[0]!.verdict, 'superseded');
  assert.equal(plan.withheld[0]!.lastWrittenBy, second.id);
  assert.match(plan.unrestored[0]!.why, new RegExp(`changeset ${second.id} wrote this address after`));

  // ...and reversing the later one first works, which is what the message says.
  await reverse(fx, second.id);
  assert.deepEqual(await pitches(fx.fake, fx.clipA), [60]);
});

test('B-bound: an address nobody read just now is WITHHELD, not assumed unchanged', async () => {
  const fx = await fixture();
  const take = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 72 })] }]);

  // ⚠ Absent evidence is not evidence of absence. A plan built against a snapshot
  // that never looked at the address must not conclude the address is ours.
  const nothing = await fx.fake.read([]);
  const plan = fx.stash.log.planReversal(take.id, nothing);
  assert.deepEqual(plan.ops, []);
  assert.equal(plan.withheld[0]!.verdict, 'unread');
  assert.match(plan.unrestored[0]!.why, /an unchecked address is not an unchanged one/);
});

test('B-bound: ⚠ un-creating a clip we created needs mint AND last-write, not just the mint', async () => {
  const fx = await fixture();
  // The batch creates the clip and fills it, so the stash has both the mint and a
  // record of the contents — which is what makes the delete honest.
  const made = await commit(fx, [
    { op: 'clip.create', slot: fx.emptySlot, lengthBeats: 4 },
    { op: 'note.write', clip: clip(fx.emptySlot), notes: [note({ pitch: 48 })] },
  ]);
  assert.deepEqual(await pitches(fx.fake, clip(fx.emptySlot)), [48]);

  // A human plays into the clip we made. The mint is still ours; the last write
  // is not, and deleting the clip would take their notes with it.
  await human(fx, [{ op: 'note.write', clip: clip(fx.emptySlot), notes: [note({ pitch: 55, startBeats: 2 })] }]);

  const blocked = await reverse(fx, made.id);
  assert.deepEqual(blocked.ops.filter((o) => o.op === 'clip.delete'), [], 'the clip stays');
  assert.match(
    blocked.unrestored.map((u) => u.why).join(' '),
    /Deleting the clip would take those contents with it/,
  );
  // ⚠ The clip's slot still reads exactly as we left it, so on its own terms it is
  // `ours`. The verdict PROPAGATES from the notes address, or `withheld` would
  // carry an `ours` entry contradicting the withholding it is there to explain.
  assert.deepEqual([...blocked.withheld].map((w) => w.verdict).sort(), ['changed', 'changed']);
  assert.deepEqual(await pitches(fx.fake, clip(fx.emptySlot)), [48, 55]);
});

test('B-bound: a BARE create is protected too, because its write-set already carries the evidence', async () => {
  const fx = await fixture();
  // ⚠ No note op — and the protection still holds, for a reason worth pinning
  // down: `clip.create` pairs its clip address with the channel-0 notes address
  // in `write-set.ts`, so a bare create still stashes what was in the slot and
  // verifies what it left. The stash never has to go minting addresses it did not
  // write to find out, which would be the contract's job and not its own (D16a).
  const bare = await commit(fx, [{ op: 'clip.create', slot: fx.emptySlot, lengthBeats: 4 }]);
  assert.equal(bare.targets.length, 2, 'the pairing is what makes this case safe');

  await human(fx, [{ op: 'note.write', clip: clip(fx.emptySlot), notes: [note({ pitch: 55 })] }]);

  const plan = await reverse(fx, bare.id);
  assert.deepEqual(plan.ops, []);
  assert.match(plan.unrestored.map((u) => u.why).join(' '), /Deleting the clip would take those contents with it/);
  assert.deepEqual(await pitches(fx.fake, clip(fx.emptySlot)), [55]);
});

test('B-bound: a clip we created and DID look into is un-created cleanly', async () => {
  const fx = await fixture();
  const made = await commit(fx, [
    { op: 'clip.create', slot: fx.emptySlot, lengthBeats: 4 },
    { op: 'note.write', clip: clip(fx.emptySlot), notes: [note({ pitch: 48 })] },
  ]);

  // ⚠ The other half of the rule, and the reason it is not simply "never delete":
  // D16d's asymmetry is that absence HAS an exact inverse. Nothing was in this
  // slot, we put something there, nobody else touched it — so removing it is a
  // true reversal, not destruction.
  const plan = await reverse(fx, made.id);
  assert.ok(plan.ops.some((o) => o.op === 'clip.delete'));
  assert.deepEqual(plan.withheld, []);
  const after = await fx.fake.read([clip(fx.emptySlot)]);
  const entry = after.entries[addressKey(clip(fx.emptySlot))];
  assert.equal(entry?.value.of === 'clip' && entry.value.exists, false, 'the slot is empty again');
});

test('B-bound: an address the batch could not VERIFY is withheld, and is not even in the read set (E3)', async () => {
  const fx = await fixture();
  // ⚠ A batch that bumps the scene epoch invalidates its own verify read, so this
  // changeset knows what the clip was BEFORE and does not know what it became.
  const blind = await commit(fx, [
    { op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 67 })] },
    { op: 'scene.create', count: 1 },
  ], 'B-bound');
  assert.equal(fx.stash.log.require(blind.id).take.report.unverified.length, 1);

  // The address is stale now, so reading it THROWS. A read set that contained it
  // would be a read set nobody could use.
  const notesKey = addressKey(notesAt(fx.clipA));
  assert.equal(fx.stash.log.readSetFor(blind.id).some((a) => addressKey(a) === notesKey), false);
  await assert.rejects(fx.fake.read([notesAt(fx.clipA)]));

  const current = await fx.fake.read(fx.stash.log.readSetFor(blind.id));
  const plan = fx.stash.log.planReversal(blind.id, current);
  const check = plan.withheld.find((w) => w.key === notesKey);
  assert.equal(check?.verdict, 'unverified');
  assert.match(check!.why, /no record of what we left here/);
  assert.deepEqual(plan.ops, []);
});

// --- B-print: job 2, the clip content fingerprint -----------------------------

test('B-print: the same check, run BEFORE a write, is the positional-clip fingerprint', async () => {
  const fx = await fixture();
  const written = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 })] }]);
  const read = () => fx.fake.read(fx.stash.log.readSetFor(written.id));

  // ⚠ Clips are addressed positionally (D16a — there is no durable clip id), so a
  // positional address is only trustworthy while the content behind it is still
  // what we last saw. This is that guard, and it is deliberately the SAME function
  // the reversal boundary uses: one mechanism, two features.
  assert.deepEqual(
    fx.stash.log.boundary(written.id, await read()).map((c) => c.verdict),
    ['ours'],
  );

  // A human drags a different clip into the slot — the E16s case the launcher
  // content observer exists for. The address still resolves; it is simply not
  // pointing at our music any more.
  await human(fx, [{ op: 'note.clear', clip: fx.clipA }, { op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 41 })] }]);
  assert.deepEqual(
    fx.stash.log.boundary(written.id, await read()).map((c) => c.verdict),
    ['changed'],
  );
});

test('B-print: ⚠ the FINGERPRINT is keyed on addresses, which is how a write has to ask', async () => {
  const fx = await fixture();
  const target = notesAt(fx.clipA);
  const untouched = notesAt(fx.clipB);

  // ⚠ Before we have written anything, the stash has NO OPINION — and says so.
  // `unseen` must never read as a pass: an address we have never written is
  // exactly what the live launcher-content epoch exists to cover (E16s).
  const cold = await fx.fake.read([target, untouched]);
  assert.deepEqual(fx.stash.log.fingerprint([target, untouched], cold).map((c) => c.verdict),
    ['unseen', 'unseen']);

  const written = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 })] }]);

  // Now one address resolves to the changeset that last wrote it, and the other
  // still does not — which is the whole reason this is keyed on addresses. A
  // caller about to write has addresses, never a changeset id.
  const warm = await fx.fake.read([target, untouched]);
  const checks = fx.stash.log.fingerprint([target, untouched], warm);
  assert.deepEqual(checks.map((c) => c.verdict), ['ours', 'unseen']);
  assert.equal(checks[0]!.lastWrittenBy, written.id);

  await human(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 90, startBeats: 3 })] }]);
  const after = await fx.fake.read([target]);
  assert.equal(fx.stash.log.fingerprint([target], after)[0]!.verdict, 'changed');
});

test('B-print: a LATER changeset of ours re-establishes the print, and never reads `superseded`', async () => {
  const fx = await fixture();
  const target = notesAt(fx.clipA);
  await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 })] }]);
  const later = await commit(fx, [
    { op: 'note.clear', clip: fx.clipA },
    { op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 72 })] },
  ]);

  // ⚠ `boundary` compares against the changeset you name; `fingerprint` compares
  // against the LAST writer. So the same world reads `superseded` for the first
  // changeset and `ours` for the print — and that is not a disagreement, it is
  // two different questions sharing one comparison.
  const current = await fx.fake.read([target]);
  const check = fx.stash.log.fingerprint([target], current)[0]!;
  assert.equal(check.verdict, 'ours');
  assert.equal(check.lastWrittenBy, later.id);
});

test('B-print: note ORDER is not a change — a fingerprint that cries wolf is not honoured', async () => {
  const fx = await fixture();
  const written = await commit(fx, [{
    op: 'note.write',
    clip: fx.clipA,
    notes: [note({ pitch: 64, startBeats: 1 }), note({ pitch: 60 })],
  }]);

  // Readback order is the adapter's business, not the clip's. The comparison
  // sorts before it compares, which is why this is `ours` and not `changed`.
  const current = await fx.fake.read(fx.stash.log.readSetFor(written.id));
  assert.deepEqual(fx.stash.log.boundary(written.id, current).map((c) => c.verdict), ['ours']);
});

// --- B-fidelity: D5, readable before it runs ---------------------------------

test('B-fidelity: a `none` entry is in the SUMMARY, before any reversal is planned', async () => {
  const fx = await fixture();
  await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note()] }]);
  const destructive = await commit(fx, [{ op: 'track.delete', track: fx.trackA }], 'B-fidelity');

  for (const summary of fx.stash.log.list()) {
    assert.ok(['exact', 'lossy', 'none'].includes(summary.fidelity), 'every changeset is labelled');
  }
  const summary = fx.stash.log.summary(destructive.id);
  assert.equal(summary.fidelity, 'none');
  assert.equal(summary.unrestorable.length, 1);
  assert.match(summary.unrestorable[0]!.why, /channelId` is minted fresh/);

  // ...and so does the plan, which is where someone about to reverse would look.
  // ⚠ The `none` target bypasses the boundary and keeps the write-set's own
  // sentence — a vaguer "we did not read it" would be a worse report.
  const current = await fx.fake.read(fx.stash.log.readSetFor(destructive.id));
  const plan = fx.stash.log.planReversal(destructive.id, current);
  assert.equal(plan.fidelity, 'none');
  assert.deepEqual(plan.ops, [], 'nothing is attempted');
  assert.match(plan.unrestored.map((u) => u.why).join(' '), /a track cannot be un-deleted/);
});

test('B-fidelity: `gain` is withheld from the reversal and named, never replayed (D16b)', async () => {
  const fx = await fixture();
  // ⚠ A changeset's fidelity describes what it can RESTORE — its stash — not what
  // it wrote. So the gain has to be in the clip BEFORE the batch that stashes it.
  await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pan: 0.25, gain: 0.7 })] }]);
  const over = await commit(fx, [
    { op: 'note.clear', clip: fx.clipA },
    { op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 72 })] },
  ], 'B-fidelity');
  assert.equal(over.fidelity, 'lossy');
  assert.match(over.values[0]!.caveats.join(' '), /INVERSE IS UNVERIFIED/);

  const plan = await reverse(fx, over.id);
  const written = plan.ops.flatMap((o) => (o.op === 'note.write' ? o.notes : []));
  assert.equal(written.length, 1);
  assert.equal(written[0]!.gain, undefined, 'the doubled value is not replayed');
  assert.match(plan.unrestored.map((u) => u.what).join(' '), /gain/);
  assert.deepEqual(await pitches(fx.fake, fx.clipA), [60], 'and everything else does come back');
});

// --- B-device: D16 amendment 2 -----------------------------------------------

test('B-device: an insert is undone at the chain index its receipt minted', async () => {
  const fx = await fixture();
  const source = { from: 'bitwig', uuid: 'gn-dev' } as const;
  const take = await commit(fx, [
    { op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 64 })] },
    { op: 'device.insert', track: fx.trackA, source },
  ]);
  assert.equal(fx.fake.model.tracks[0]!.devices.length, 1, 'the device really went in');

  const plan = await reverse(fx, take.id);
  assert.deepEqual(
    plan.ops.filter((o) => o.op === 'device.delete').map((o) => (o.op === 'device.delete' ? o.device.chainIndex : -1)),
    [0],
  );
  assert.equal(fx.fake.model.tracks[0]!.devices.length, 0);
  // ⚠ And it says the thing no fidelity label produces: a chain index is a COUNT,
  // and devices have no readback to fingerprint the occupant with first (D20).
  assert.match(plan.caveats.join(' '), /cannot be fingerprinted first/);
});

test('B-device: a SLICED reversal declines to un-insert, and says which move would', async () => {
  const fx = await fixture();
  const source = { from: 'bitwig', uuid: 'gn-dev' } as const;
  const take = await commit(fx, [
    { op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 64 })] },
    { op: 'device.insert', track: fx.trackA, source },
  ]);

  // Slicing selects ADDRESSES and an insert has none, so "restore just this clip"
  // has no reading under which a device also disappears.
  const current = await fx.fake.read(fx.stash.log.readSetFor(take.id));
  const sliced = fx.stash.log.planReversal(take.id, current, {
    slice: fx.stash.log.selectClip(take.id, fx.clipA),
  });
  assert.deepEqual(sliced.ops.filter((o) => o.op === 'device.delete'), []);
  assert.match(sliced.unrestored.find((u) => u.what === 'device.insert')?.why ?? '', /outside the slice/);
});

test('B-device: an insert nobody watched land is reported BEFORE any reversal (D5)', async () => {
  const fx = await fixture();
  // An adapter that performs the insert but cannot see where it landed — a chain
  // longer than the device bank window, or one that did not change the way an
  // append changes it. Wrapping the fake is the only honest way to reach this:
  // the fake itself always observes its own model.
  const blind: BitwigAdapter = {
    hello: () => fx.fake.hello(),
    resolve: (refs) => fx.fake.resolve(refs),
    tracks: () => fx.fake.tracks(),
    read: (sel) => fx.fake.read(sel),
    settle: (budget) => fx.fake.settle(budget),
    revision: () => fx.fake.revision(),
    contentSince: (since) => fx.fake.contentSince(since),
    close: () => fx.fake.close(),
    apply: async (batch) => ({ ...(await fx.fake.apply(batch)), minted: {} }),
  };
  const executor = new Executor(blind, { newId: () => 'c-blind', now: () => 1 });

  const take = await executor.run(
    [{ op: 'device.insert', track: fx.trackA, source: { from: 'bitwig', uuid: 'gn-dev' } }],
  );
  fx.stash.record(take);
  assert.equal(fx.fake.model.tracks[0]!.devices.length, 1, 'the device is really in the chain');
  assert.deepEqual(take.unrevertable.map((u) => u.op), ['device.insert']);

  const plan = await reverse(fx, take.id);
  assert.deepEqual(plan.ops, [], 'nothing is attempted at an index nobody read back');
  assert.equal(
    plan.unrestored.filter((u) => u.what === 'device.insert').length,
    1,
    'said ONCE — both channels know it, and D5 asks for a report a human reads',
  );
});

// --- forget ------------------------------------------------------------------

test('B-record: `forget` empties the stash, and reversal is unaskable afterwards', async () => {
  const fx = await fixture();
  const take = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note()] }]);
  fx.stash.forget();
  assert.deepEqual(fx.stash.log.list(), []);
  // ⚠ Which is exactly why `forget` is a named mutator: dropping the stash does
  // not lose a log, it loses the ability to put the music back.
  assert.throws(() => fx.stash.log.readSetFor(take.id), ChangesetNotFoundError);
});

// --- session 3: the launcher window, and what it buys the boundary -----------

test('B-moved: a clip REPLACED by an identical one fingerprints as ours, and is not', async () => {
  const fx = await fixture();
  const take = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 })] }]);

  // ⚠ The control that reproduces the FAILURE (E17 method guard 10). A human
  // deletes our clip and drops an identical one in the same slot: every byte
  // compares equal afterwards, and the slot is not holding the clip we wrote.
  control(fx.fake).replaceClipInPlace(fx.trackA.channelId, 0);

  const current = await fx.fake.read(fx.stash.log.readSetFor(take.id));

  // Without the window, the boundary can only compare contents — and they match.
  const blind = fx.stash.log.boundary(take.id, current);
  assert.deepEqual([...new Set(blind.map((c) => c.verdict))], ['ours'],
    'content comparison alone says this is ours to put back');

  // With it, the same addresses read `moved`. This is the whole justification
  // for building a second mechanism instead of tuning the first one.
  const launcher = await fx.fake.contentSince(take.at);
  const seeing = fx.stash.log.boundary(take.id, current, launcher);
  assert.ok(seeing.some((c) => c.verdict === 'moved'), 'the launcher saw what the bytes could not');
  assert.match(seeing.find((c) => c.verdict === 'moved')!.why, /no durable id|position/);
});

test('B-moved: a reversal withholds a moved address and says why', async () => {
  const fx = await fixture();
  const take = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 })] }]);
  control(fx.fake).replaceClipInPlace(fx.trackA.channelId, 0);

  const current = await fx.fake.read(fx.stash.log.readSetFor(take.id));
  const launcher = await fx.fake.contentSince(take.at);
  const plan = fx.stash.log.planReversal(take.id, current, { launcher });

  assert.deepEqual(plan.ops, [], 'nothing is written over a clip that moved under us');
  assert.ok(plan.withheld.some((w) => w.verdict === 'moved'));
  assert.equal(plan.fidelity, 'none', 'a wholly withheld reversal restores nothing');
});

test('B-moved: our OWN batch\'s occupancy change is not a move', async () => {
  const fx = await fixture();
  // `clip.create` on an empty slot fires the observer exactly as a human drag
  // does. If that read as `moved`, every flagship reversal would be withheld.
  const emptied = slot(fx.trackA, scene(3, 1));
  const take = await commit(fx, [
    { op: 'clip.create', slot: emptied, lengthBeats: 4 },
    { op: 'note.write', clip: clip(emptied), notes: [note({ pitch: 64 })] },
  ]);

  const current = await fx.fake.read(fx.stash.log.readSetFor(take.id));
  const launcher = await fx.fake.contentSince(take.at);
  const checks = fx.stash.log.boundary(take.id, current, launcher);

  assert.deepEqual([...new Set(checks.map((c) => c.verdict))], ['ours']);
  const plan = fx.stash.log.planReversal(take.id, current, { launcher });
  assert.ok(plan.ops.some((o) => o.op === 'clip.delete'), 'and the reversal still un-creates it');
});

test('B-undecidable: an unusable window downgrades `ours`, and only `ours`', async () => {
  const fx = await fixture();
  const take = await commit(fx, [
    { op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 })] },
    { op: 'track.rename', track: fx.trackA, name: 'gn-A2' },
  ]);

  control(fx.fake).floodContentEvents(40);

  const current = await fx.fake.read(fx.stash.log.readSetFor(take.id));
  const launcher = await fx.fake.contentSince(take.at);
  const checks = fx.stash.log.boundary(take.id, current, launcher);

  const byKind = new Map(checks.map((c) => [c.address.kind, c.verdict]));
  assert.equal(byKind.get('notes'), 'undecidable', 'a launcher cell cannot be vouched for');
  // ⚠ Pessimism must not spread past its evidence: the launcher observer never
  // had anything to say about a track address, so a dropped launcher event
  // cannot be a reason to withhold one.
  assert.equal(byKind.get('track'), 'ours');
});

test('B-undecidable: a reversal planned WITHOUT the window says so in its caveats', async () => {
  const fx = await fixture();
  const take = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 })] }]);
  const current = await fx.fake.read(fx.stash.log.readSetFor(take.id));

  const plan = fx.stash.log.planReversal(take.id, current);

  assert.ok(plan.ops.length > 0, 'it still plans — the omission is reported, not fatal');
  assert.ok(plan.caveats.some((c) => /WITHOUT the clip-launcher window/.test(c)));
});
