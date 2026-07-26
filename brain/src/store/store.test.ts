/**
 * The take store against the Phase-0 fake — offline, on a real temp directory.
 *
 * PHASE-1-SESSION-2's exit criteria, and they carry unusual weight: D14 moved
 * take navigation to Phase 3, so **no human exercises this store's core verb
 * inside Phase 1**. These tests are the only thing standing between a wrong
 * store design and a phase-late discovery, which is why they drive real ops
 * through the executor rather than asserting on the store's own bookkeeping.
 *
 *   S-branch    1. two takes created, compared, jumped between; jumping back and
 *                  writing again BRANCHES, and the abandoned branch is reachable
 *   S-partial   2. a partial revert restores one clip and leaves the rest alone
 *   S-restart   3. the store survives a process restart, labels intact
 *   S-fidelity  4. every take carries a fidelity summary, and a `none` entry says
 *                  so BEFORE a revert is attempted
 *   (5 is `surface.test.ts` — the read/mutate split)
 *   S-*         6. all of it offline, no Bitwig and no daemon
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import {
  addressKey, clip, notes as notesAt, scene, slot, track,
  type ClipAddress, type NoteRecord, type Op, type TrackAddress,
} from '../contract/index.js';
import { Executor, type Take } from '../engine/index.js';
import { EmptySliceError, DuplicateTakeError } from './errors.js';
import { TakeStore } from './store.js';

// --- fixture -----------------------------------------------------------------

interface Fixture {
  readonly fake: FakeAdapter;
  readonly executor: Executor;
  readonly store: TakeStore;
  readonly root: string;
  readonly trackA: TrackAddress;
  readonly clipA: ClipAddress;
  readonly clipB: ClipAddress;
}

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, ...over,
});

const PROJECT = 'proj-test';

async function fixture(options: { maxTakes?: number } = {}): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), 'ghostnote-store-'));
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
  const executor = new Executor(fake, { newId: () => `take-${++n}`, now: () => (clock += 1000) });
  const store = await TakeStore.open({
    projectKey: PROJECT,
    root,
    now: () => clock,
    ...(options.maxTakes === undefined ? {} : { retention: { maxTakes: options.maxTakes } }),
  });
  return { fake, executor, store, root, trackA, clipA: clip(slotA), clipB: clip(slotB) };
}

async function readNotes(fake: FakeAdapter, address: ClipAddress, channel = 0): Promise<readonly NoteRecord[]> {
  const target = notesAt(address, channel);
  const snap = await fake.read([target]);
  const entry = snap.entries[addressKey(target)];
  return entry?.value.of === 'notes' ? entry.value.notes : [];
}

const pitches = async (fake: FakeAdapter, c: ClipAddress): Promise<number[]> =>
  (await readNotes(fake, c)).map((n) => n.pitch).sort((x, y) => x - y);

/** Run a patch and record it — what session 3 will do on every agent write. */
async function commit(fx: Fixture, ops: readonly Op[], label?: string): Promise<Take> {
  const take = await fx.executor.run(ops);
  await fx.store.append(take, label === undefined ? {} : { label });
  return take;
}

/**
 * Navigate to a take: apply the plan, then do what `plan.lands` says.
 *
 * This is the reference wiring session 3 inherits, and the reason it is written
 * out here rather than hidden in the store is that the store must not apply
 * anything — it has no adapter and cannot know whether the ops landed.
 */
async function goTo(fx: Fixture, id: string): Promise<void> {
  const plan = fx.store.log.planTo(id);
  assert.equal(plan.lands, 'take');
  await fx.executor.run(plan.ops);
  await fx.store.setHead(id);
}

// --- exit criterion 1 --------------------------------------------------------

test('S-branch: two takes are created, compared and jumped between', async () => {
  const fx = await fixture();
  const one = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 })] }]);
  const two = await commit(fx, [
    { op: 'note.clear', clip: fx.clipA },
    { op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 72 })] },
  ]);

  assert.equal(fx.store.log.head(), two.id);
  assert.deepEqual(fx.store.log.ancestry(two.id), [two.id, one.id]);

  // Compared: the diff is computed from the stashes the takes already carry —
  // §8f's "one mechanism, two features", with no second model of the song.
  const diff = fx.store.log.diff(one.id, two.id);
  const changed = diff.filter((d) => d.changed);
  assert.equal(changed.length, 1);
  assert.equal(changed[0]!.key, addressKey(notesAt(fx.clipA)));
  assert.deepEqual(
    changed[0]!.before?.of === 'notes' ? changed[0]!.before.notes.map((n) => n.pitch) : [],
    [60],
  );
  assert.deepEqual(
    changed[0]!.after?.of === 'notes' ? changed[0]!.after.notes.map((n) => n.pitch) : [],
    [72],
  );

  // Jumped between: and the clip really changes, which is the claim that matters.
  assert.deepEqual(await pitches(fx.fake, fx.clipA), [72]);
  await goTo(fx, one.id);
  assert.deepEqual(await pitches(fx.fake, fx.clipA), [60]);
  await goTo(fx, two.id);
  assert.deepEqual(await pitches(fx.fake, fx.clipA), [72]);
});

test('S-branch: jumping back and writing again BRANCHES, and the abandoned branch is reachable', async () => {
  const fx = await fixture();
  const one = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 })] }]);
  const two = await commit(fx, [
    { op: 'note.clear', clip: fx.clipA },
    { op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 72 })] },
  ]);

  await goTo(fx, one.id);
  const three = await commit(fx, [
    { op: 'note.clear', clip: fx.clipA },
    { op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 64 })] },
  ]);

  // Branch, not truncation: `two` was not touched.
  assert.equal(fx.store.log.get(three.id)?.parent, one.id);
  assert.deepEqual([...fx.store.log.children(one.id)].sort(), [two.id, three.id].sort());
  assert.deepEqual([...fx.store.log.leaves()].sort(), [three.id, two.id].sort());
  assert.notEqual(fx.store.log.get(two.id), undefined);

  // ...and the abandoned branch is REACHABLE, not merely remembered: jumping to
  // it unwinds `three` and replays `two` in one plan.
  assert.deepEqual(await pitches(fx.fake, fx.clipA), [64]);
  await goTo(fx, two.id);
  assert.deepEqual(await pitches(fx.fake, fx.clipA), [72]);
  await goTo(fx, three.id);
  assert.deepEqual(await pitches(fx.fake, fx.clipA), [64]);
});

test('S-branch: a cross-branch jump unwinds addresses the target never touched', async () => {
  const fx = await fixture();
  // The case the cheap design gets wrong: two branches touching DIFFERENT clips.
  const base = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 })] }]);
  const bass = await commit(fx, [{ op: 'note.write', clip: fx.clipB, notes: [note({ pitch: 36 })] }]);

  await goTo(fx, base.id);
  assert.deepEqual(await pitches(fx.fake, fx.clipB), [], 'the bass is unwound on the way back');

  const hats = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 90 })] }]);
  assert.deepEqual(await pitches(fx.fake, fx.clipA), [60, 90]);

  // Crossing from the hats branch to the bass branch must undo the hats AND
  // replay the bass. "Restore the target take's own write-set" would leave the
  // hats in place and call it the state at `bass`.
  await goTo(fx, bass.id);
  assert.deepEqual(await pitches(fx.fake, fx.clipA), [60]);
  assert.deepEqual(await pitches(fx.fake, fx.clipB), [36]);
  assert.equal(fx.store.log.get(hats.id)?.parent, base.id, 'and the hats branch is still there');
});

// --- exit criterion 2 --------------------------------------------------------

test('S-partial: a partial revert restores ONE clip and leaves the rest of the write-set alone', async () => {
  const fx = await fixture();
  await commit(fx, [
    { op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 })] },
    { op: 'note.write', clip: fx.clipB, notes: [note({ pitch: 36 })] },
  ]);

  // One batch, two clips — "keep the hats, revert the snare" (D5).
  const both = await commit(fx, [
    { op: 'note.clear', clip: fx.clipA },
    { op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 72 })] },
    { op: 'note.clear', clip: fx.clipB },
    { op: 'note.write', clip: fx.clipB, notes: [note({ pitch: 48 })] },
  ]);
  assert.deepEqual(await pitches(fx.fake, fx.clipA), [72]);
  assert.deepEqual(await pitches(fx.fake, fx.clipB), [48]);

  const onlyA = fx.store.log.selectClip(both.id, fx.clipA);
  const plan = fx.store.log.planRevert(both.id, onlyA);
  // A partial revert lands on a state no take describes, so it becomes one.
  assert.equal(plan.lands, 'new-state');
  assert.deepEqual(plan.addresses, [addressKey(notesAt(fx.clipA))]);

  const applied = await fx.executor.run(plan.ops);
  await fx.store.append(applied);

  assert.deepEqual(await pitches(fx.fake, fx.clipA), [60], 'clip A is back');
  assert.deepEqual(await pitches(fx.fake, fx.clipB), [48], 'clip B is untouched');
});

test('S-partial: a slice that selects nothing is a REFUSAL, never a silent no-op', async () => {
  const fx = await fixture();
  const take = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note()] }]);

  assert.throws(
    () => fx.store.log.planRevert(take.id, { keys: ['notes:nobody:0@1:ch0'] }),
    EmptySliceError,
    'zero ops reported as success is indistinguishable from a revert that worked',
  );
  // ...and the clip-selector for a clip the take never touched is the same case.
  assert.throws(() => fx.store.log.planRevert(take.id, fx.store.log.selectClip(take.id, fx.clipB)), EmptySliceError);
});

// --- exit criterion 3 --------------------------------------------------------

test('S-restart: takes written before a restart are readable after, with fidelity intact', async () => {
  const fx = await fixture();
  // ⚠ A take's fidelity describes what it can RESTORE — i.e. its stash — not what
  // it wrote. So the gain has to be in the clip BEFORE the take that stashes it.
  await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pan: 0.25, gain: 0.7 })] }]);
  const one = await commit(fx, [
    { op: 'note.clear', clip: fx.clipA },
    { op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 72 })] },
  ], 'better hats');
  const two = await commit(fx, [{ op: 'track.delete', track: fx.trackA }]);

  // A second process, same directory. Nothing is shared but the disk.
  const reopened = await TakeStore.open({ projectKey: PROJECT, root: fx.root });
  assert.equal(reopened.log.head(), two.id);
  assert.equal(reopened.log.ancestry(two.id).length, 3);

  const back = reopened.log.require(one.id);
  assert.equal(back.label, 'better hats');
  assert.equal(back.take.fidelity, 'lossy', 'gain makes it lossy, and that survives the disk');
  assert.match(back.take.values[0]!.caveats.join(' '), /INVERSE IS UNVERIFIED/);
  assert.deepEqual(back.take, fx.store.log.require(one.id).take, 'byte-for-byte the same take');

  assert.equal(reopened.log.summary(two.id).fidelity, 'none');
  assert.deepEqual(reopened.log.unreadable(), []);
});

test('S-restart: a half-written take file is ignored, and a foreign one is quarantined', async () => {
  const fx = await fixture();
  const one = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note()] }]);
  const takes = join(fx.root, 'projects', PROJECT, 'takes');

  // Crash debris from a write-then-rename that never reached the rename.
  await writeFile(join(takes, 'take-99.json.tmp-abcdef12'), '{"format":1,"tak');
  // A take from a future contract. Refused, per version.ts's exact equality.
  await writeFile(
    join(takes, 'take-98.json'),
    JSON.stringify({ format: 1, projectKey: PROJECT, parent: null, storedAtMs: 0, take: { contract: 'ghostnote/99', id: 'take-98', stash: {}, verify: {} } }),
  );

  const reopened = await TakeStore.open({ projectKey: PROJECT, root: fx.root });
  assert.deepEqual(reopened.log.list().map((t) => t.id), [one.id], 'the good take still loads');
  assert.equal(reopened.log.unreadable().length, 1, 'the .tmp debris is not even a candidate');
  assert.match(reopened.log.unreadable()[0]!.why, /contract ghostnote\/99/);
});

test('S-restart: a corrupt meta.json costs the head pointer and nothing else', async () => {
  const fx = await fixture();
  const one = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note()] }]);
  await writeFile(join(fx.root, 'projects', PROJECT, 'meta.json'), '{ not json');

  const reopened = await TakeStore.open({ projectKey: PROJECT, root: fx.root });
  assert.equal(reopened.log.head(), null, 'no head is claimed');
  assert.deepEqual(reopened.log.list().map((t) => t.id), [one.id], 'but every take is still here');
  assert.match(reopened.log.unreadable()[0]!.why, /not valid JSON/);
});

test('S-restart: appending the same take id twice is refused, not silently overwritten', async () => {
  const fx = await fixture();
  const take = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note()] }]);
  await assert.rejects(fx.store.append(take), DuplicateTakeError);
});

// --- exit criterion 4 --------------------------------------------------------

test('S-fidelity: every take carries a summary, and a `none` entry says so BEFORE the revert', async () => {
  const fx = await fixture();
  await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note()] }]);
  const destructive = await commit(fx, [{ op: 'track.delete', track: fx.trackA }]);

  for (const summary of fx.store.log.list()) {
    assert.ok(['exact', 'lossy', 'none'].includes(summary.fidelity), 'every take is labelled');
  }

  // The listing already says it — no plan, no apply, no adapter round-trip.
  const summary = fx.store.log.summary(destructive.id);
  assert.equal(summary.fidelity, 'none');
  assert.equal(summary.unrestorable.length, 1);
  assert.match(summary.unrestorable[0]!.why, /channelId` is minted fresh/);

  // ...and so does the plan, which is where someone about to revert would look.
  const plan = fx.store.log.planRevert(destructive.id);
  assert.equal(plan.fidelity, 'none');
  assert.equal(plan.ops.length, 0, 'nothing is attempted');
  assert.match(plan.unrestored.map((u) => u.why).join(' '), /a track cannot be un-deleted/);
});

test('S-fidelity: an address the take could not VERIFY is refused on the way forward (E3)', async () => {
  const fx = await fixture();
  const one = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 })] }]);
  // ⚠ A batch that bumps the scene epoch invalidates its own verify read, so this
  // take knows what the clip was BEFORE and does not know what it became.
  const blind = await commit(fx, [
    { op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 67 })] },
    { op: 'scene.create', count: 1 },
  ]);
  assert.equal(fx.store.log.require(blind.id).take.report.unverified.length, 1);

  // Undoing it is fine — the STASH was read cleanly, before the scene op.
  const undo = fx.store.log.planRevert(blind.id);
  assert.ok(undo.ops.length > 0);

  // Replaying it FORWARD is not, and the failure mode matters: an absent verify
  // entry means "we could not look", and treating it as "the clip was empty"
  // would emit a note.clear against music that is very probably fine.
  await fx.store.setHead(one.id);
  const forward = fx.store.log.planTo(blind.id);
  assert.deepEqual(forward.ops, [], 'nothing is replayed from a readback we never got');
  assert.match(forward.unrestored.map((u) => u.why).join(' '), /could not verify this address/);
});

test('S-fidelity: gain is withheld on the way FORWARD too, not just on a revert (D16b)', async () => {
  const fx = await fixture();
  const base = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ gain: 0.7 })] }]);
  const cleared = await commit(fx, [{ op: 'note.clear', clip: fx.clipA }]);

  // ⚠ Replaying a take FORWARD replays its VERIFY, and verify holds the doubled
  // readback (E2). Session 1 never exercised this direction — but the withholding
  // is derived from NOTE_PROP_FIDELITY rather than from which snapshot it came
  // out of, so it protects both. If it did not, every A/B comparison would double
  // the gain again, compounding, in silence.
  await fx.store.setHead(cleared.id);
  const forward = fx.store.log.planTo(base.id);
  const written = forward.ops.flatMap((o) => (o.op === 'note.write' ? o.notes : []));
  assert.equal(written.length, 1);
  assert.equal(written[0]!.gain, undefined, 'the doubled value is not replayed');
  assert.match(forward.unrestored.map((u) => u.what).join(' '), /gain/);
});

// --- retention ---------------------------------------------------------------

test('S-retention: pruning trims an abandoned branch, and protects head, labels and parents', async () => {
  const fx = await fixture({ maxTakes: 4 });
  const one = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 })] }], 'keep me');
  const two = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 62 })] }]);
  const three = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 64 })] }]);

  // A branch off `one`, then walk away from it.
  await fx.store.setHead(one.id);
  const abandoned = await commit(fx, [{ op: 'note.write', clip: fx.clipB, notes: [note({ pitch: 36 })] }]);
  await fx.store.setHead(three.id);
  assert.equal(fx.store.log.list().length, 4);

  const five = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 65 })] }]);

  // `one` is labelled, `two`/`three` have children, `five` is the head — the only
  // eligible take is the abandoned tip, which is the whole intent of the policy.
  assert.deepEqual(
    fx.store.log.list().map((t) => t.id).sort(),
    [one.id, two.id, three.id, five.id].sort(),
  );
  assert.equal(fx.store.log.get(abandoned.id), undefined);
  const onDisk = await readdir(join(fx.root, 'projects', PROJECT, 'takes'));
  assert.deepEqual(onDisk.filter((f) => f.includes(abandoned.id)), [], 'and the file is gone too');
});

test('S-retention: overshooting the depth beats deleting something protected', async () => {
  const fx = await fixture({ maxTakes: 1 });
  const one = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 60 })] }], 'mine');
  const two = await commit(fx, [{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch: 62 })] }]);

  // One is labelled and two is the head, so nothing may go. The store is over
  // depth and says so by simply still holding both, rather than by picking one.
  assert.deepEqual(await fx.store.prune(), []);
  assert.deepEqual(fx.store.log.list().map((t) => t.id).sort(), [one.id, two.id].sort());
});

// --- teardown ----------------------------------------------------------------

test.after(async () => {
  // node:test has no per-file fixture teardown; the temp roots are small and
  // uniquely named, so one sweep at the end is enough.
  const base = tmpdir();
  for (const entry of await readdir(base)) {
    if (entry.startsWith('ghostnote-store-')) await rm(join(base, entry), { recursive: true, force: true });
  }
});
