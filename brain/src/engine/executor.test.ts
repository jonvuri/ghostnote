/**
 * The executor against the Phase-0 fake — offline, deterministic, ~ms.
 *
 * This is where PHASE-1-SESSION-1's exit criteria are proven:
 *
 *   X-roundtrip  1. N note ops apply, verify by readback, and revert to a
 *                   BYTE-IDENTICAL note set across every writable property
 *   X-revision   3. a stale-revision batch is rejected WHOLE, at the executor
 *   X-blindspot  4. an address outside the bank window is a loud refusal
 *   X-label      5. every take value carries a derived fidelity label, and a
 *                   revert that cannot fully restore says exactly what it could not
 *
 * Cases that must also hold against real Bitwig live in the conformance suite
 * (criterion 6); the ones here use `TrapControl`, which is deliberately not on
 * `BitwigAdapter` and therefore cannot leak into a portable case.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { control } from '../adapters/fake/control.js';
import { noteKey } from '../adapters/fake/model.js';
import {
  AddressUnresolvedError, BlindSpotError, NOTE_PROP_FIDELITY, addressKey, clip,
  notes as notesAt, scene, slot, track,
  type BitwigAdapter, type NoteRecord, type Op, type TrackAddress,
} from '../contract/index.js';
import { Executor } from './executor.js';

/**
 * One value per property `NOTE_PROP_FIDELITY` calls `exact`.
 *
 * Kept as a table rather than a literal so `X-coverage` below can prove it is
 * COMPLETE — exit criterion 1 says "every writable expression property", and a
 * hand-written note would silently stop covering a property the day one is
 * added.
 */
const EXACT_VALUES: Record<string, unknown> = {
  velocity: 96,
  duration: 0.75,
  releaseVelocity: 0.4,
  velocitySpread: 0.2,
  pan: -0.25,
  timbre: 0.3,
  transpose: 2,
  chance: 0.6,
  isChanceEnabled: true,
  isMuted: true,
  isOccurrenceEnabled: true,
  occurrence: 'FIRST',
  isRecurrenceEnabled: true,
  recurrence: [4, 5],
  isRepeatEnabled: true,
  repeatCount: 3,
  repeatCurve: 0.2,
  repeatVelocityCurve: -0.1,
  repeatVelocityEnd: 0.8,
};

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, ...over,
});

/** A note carrying every property we can promise to round-trip. */
function fullNote(over: Partial<NoteRecord> = {}): NoteRecord {
  const bag: Record<string, unknown> = {
    startBeats: 0,
    pitch: 60,
    velocity: EXACT_VALUES['velocity'],
    durationBeats: EXACT_VALUES['duration'],
  };
  for (const [key, value] of Object.entries(EXACT_VALUES)) {
    if (key === 'velocity' || key === 'duration') continue;
    bag[key] = value;
  }
  return { ...(bag as unknown as NoteRecord), ...over };
}

interface Fixture {
  readonly fake: FakeAdapter;
  readonly executor: Executor;
  readonly trackA: TrackAddress;
  readonly trackB: TrackAddress;
  readonly clipA: ReturnType<typeof clip>;
  readonly clipB: ReturnType<typeof clip>;
}

/** Two tracks, a clip in scene 0 of each, ready to write. */
async function fixture(options: { clips?: boolean } = {}): Promise<Fixture> {
  const fake = new FakeAdapter({ tracks: ['gn-A', 'gn-B'], scenes: 8 });
  const [a, b] = fake.model.visibleTracks();
  const trackA = track(a!.channelId);
  const trackB = track(b!.channelId);
  const slotA = slot(trackA, scene(0, 1));
  const slotB = slot(trackB, scene(0, 1));
  if (options.clips !== false) {
    // ⚠ E2: the clip MUST exist before anything points at that slot.
    await fake.apply({
      ops: [
        { op: 'clip.create', slot: slotA, lengthBeats: 4 },
        { op: 'clip.create', slot: slotB, lengthBeats: 4 },
      ],
    });
    await fake.settle('trackStruct');
  }
  let n = 0;
  const executor = new Executor(fake, { newId: () => `take-${++n}`, now: () => 1_000_000 });
  return { fake, executor, trackA, trackB, clipA: clip(slotA), clipB: clip(slotB) };
}

async function readNotes(adapter: BitwigAdapter, address: ReturnType<typeof notesAt>): Promise<readonly NoteRecord[]> {
  const snap = await adapter.read([address]);
  const entry = snap.entries[addressKey(address)];
  return entry?.value.of === 'notes' ? entry.value.notes : [];
}

// --- exit criterion 1 --------------------------------------------------------

test('X-coverage: the round-trip note covers EVERY property NOTE_PROP_FIDELITY calls exact', () => {
  const exact = Object.entries(NOTE_PROP_FIDELITY).filter(([, f]) => f === 'exact').map(([k]) => k);
  assert.deepEqual(
    exact.filter((k) => !(k in EXACT_VALUES)),
    [],
    'a property promoted to `exact` must be given a value here, or criterion 1 stops meaning ' +
      '"every writable expression property"',
  );
});

test('X-roundtrip: a batch applies, verifies by readback, and reverts BYTE-IDENTICALLY', async () => {
  const { fake, executor, clipA } = await fixture();
  const address = notesAt(clipA);

  // The state a human authored, carrying all 19 exact properties.
  await fake.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [fullNote(), fullNote({ startBeats: 2, pitch: 67 })] }] });
  await fake.settle('noteWrite');
  const baseline = await readNotes(fake, address);
  assert.equal(baseline.length, 2);
  assert.equal(baseline[0]?.occurrence, 'FIRST', 'the fixture itself must have landed');

  // The agent overwrites it.
  const take = await executor.run([
    { op: 'note.clear', clip: clipA },
    { op: 'note.write', clip: clipA, notes: [note({ startBeats: 1, pitch: 72, pan: 0.5 })] },
  ]);
  assert.equal(take.report.applied, true);
  assert.deepEqual((await readNotes(fake, address)).map((n) => n.pitch), [72]);

  // The stash is the PRIOR state, read back — not what anyone requested.
  const stashed = take.values[0]!;
  assert.equal(stashed.value?.of, 'notes');
  assert.deepEqual(stashed.value?.of === 'notes' ? stashed.value.notes : [], baseline);

  const reverted = await executor.revert(take);
  assert.deepEqual(reverted.unrestored, [], 'nothing here is unverified or unwritable');
  assert.deepEqual(await readNotes(fake, address), baseline);
});

test('X-roundtrip: a revert is a take of its own, so the branch it left is still reachable (D5)', async () => {
  const { fake, executor, clipA } = await fixture();
  await fake.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [note({ pitch: 60 })] }] });
  await fake.settle('noteWrite');

  const take = await executor.run([
    { op: 'note.clear', clip: clipA },
    { op: 'note.write', clip: clipA, notes: [note({ pitch: 72 })] },
  ]);
  const reverted = await executor.revert(take);

  assert.equal(reverted.of, take.id);
  assert.notEqual(reverted.take.id, take.id);
  // The revert's OWN stash is the state it replaced — which is what makes
  // "undo the undo" just another revert, and branching free in session 2.
  const replaced = reverted.take.values[0]!;
  assert.deepEqual(
    replaced.value?.of === 'notes' ? replaced.value.notes.map((n) => n.pitch) : [],
    [72],
  );
});

// --- exit criterion 3 --------------------------------------------------------

/** A human nudging a clip in the window between our stash and our apply. */
function racing(fake: FakeAdapter): BitwigAdapter {
  let fired = false;
  return {
    hello: () => fake.hello(),
    resolve: (refs) => fake.resolve(refs),
    read: async (sel) => {
      const snapshot = await fake.read(sel);
      if (!fired) {
        fired = true;
        control(fake).bumpRevision();
      }
      return snapshot;
    },
    apply: (batch) => fake.apply(batch),
    settle: (budget) => fake.settle(budget),
    revision: () => fake.revision(),
    close: () => fake.close(),
  };
}

test('X-revision: a write that lands between stash and apply rejects the batch WHOLE (E8-D)', async () => {
  const { fake, clipA } = await fixture();
  const executor = new Executor(racing(fake), { newId: () => 'take-r', now: () => 0 });

  const take = await executor.run([{ op: 'note.write', clip: clipA, notes: [note()] }]);

  assert.equal(take.report.applied, false);
  assert.equal(take.report.rejected?.reason, 'stale-revision');
  assert.deepEqual(take.receipt.stages, [], 'zero ops may be applied');
  // ...and the clip is untouched, which is the claim that actually matters.
  await fake.settle('noteWrite');
  assert.deepEqual(await readNotes(fake, notesAt(clipA)), []);
  // A rejected batch is still a fact about the session, so it is a take rather
  // than an exception — but one that carries the stash and no verify delta.
  assert.equal(take.stash, take.verify);
});

// --- exit criterion 4 --------------------------------------------------------

test('X-blindspot: an address outside the bank window is a LOUD refusal, never partial (E5)', async () => {
  const { fake, executor, clipB } = await fixture();
  // gn-B still exists in the project; the window simply cannot see it.
  control(fake).setBankWindow(1);

  await assert.rejects(
    executor.run([{ op: 'note.write', clip: clipB, notes: [note()] }]),
    BlindSpotError,
    'a checkpoint blind spot is not a slow read: its prior state was never captured',
  );
});

// --- E2, the trap the pipeline exists to catch before it happens -------------

test('X-emptyslot: a note write into a slot with no clip is REFUSED before the batch goes out (E2)', async () => {
  const { executor, trackA } = await fixture({ clips: false });
  const target = clip(slot(trackA, scene(3, 1)));

  await assert.rejects(
    executor.run([{ op: 'note.write', clip: target, notes: [note()] }]),
    AddressUnresolvedError,
    'pointing at an empty slot lands on a DIFFERENT clip and reports a healthy status',
  );
});

test('X-emptyslot: ...but a clip.create in the SAME batch satisfies it (planStages orders them)', async () => {
  const { fake, executor, trackA } = await fixture({ clips: false });
  const target = slot(trackA, scene(3, 1));

  const take = await executor.run([
    { op: 'clip.create', slot: target, lengthBeats: 4 },
    { op: 'note.write', clip: clip(target), notes: [note()] },
  ]);
  assert.equal(take.report.applied, true);
  assert.deepEqual((await readNotes(fake, notesAt(clip(target)))).map((n) => n.pitch), [60]);

  // And the revert un-creates the clip, because "the slot was empty" is a state
  // with an exact inverse.
  const reverted = await executor.revert(take);
  assert.deepEqual(reverted.plan.ops.map((o) => o.op), ['clip.delete']);
  const after = await fake.read([clip(target)]);
  const entry = after.entries[addressKey(clip(target))];
  assert.equal(entry?.value.of === 'clip' ? entry.value.exists : true, false);
});

// --- exit criterion 5 --------------------------------------------------------

test('X-label: a take value is labelled from its write-set, not by its caller (D5)', async () => {
  const { executor, clipA, trackA } = await fixture();

  const plain = await executor.run([{ op: 'note.write', clip: clipA, notes: [note()] }]);
  assert.equal(plain.fidelity, 'exact');
  assert.deepEqual(plain.values[0]!.caveats, []);

  // ⚠ E3: a scene op compacts rows, so every scene-relative address in the same
  // batch is positional-at-risk — derived from ADDRESS_IDENTITY, not remembered.
  const risky = await executor.run([
    { op: 'note.write', clip: clipA, notes: [note({ pitch: 62 })] },
    { op: 'scene.create', count: 1 },
  ]);
  assert.equal(risky.fidelity, 'lossy');
  assert.match(risky.values[0]!.caveats.join(' '), /POSITIONAL address/);
  // ...and the scene create itself is reported as having no inverse at all.
  assert.deepEqual(risky.unrevertable.map((u) => u.op), ['scene.create']);
  // ⚠ And the batch invalidated its OWN write-set, so the verify could not read
  // it back. "No disagreement" must never be mistaken for "it landed" here.
  assert.equal(risky.report.unverified.length, 1);
  assert.match(risky.report.unverified[0]!.why, /changed the scene layout/);
  assert.deepEqual(risky.report.disagreements, []);

  // A track delete is `none`: `channelId` is minted fresh, so no stash can be
  // replayed onto a recreated track.
  const destructive = await executor.run([{ op: 'track.delete', track: trackA }]);
  assert.equal(destructive.fidelity, 'none');
});

test('X-label: a human-authored pressure is captured, labelled, and reported unrestored (E15-E)', async () => {
  const { fake, executor, clipA } = await fixture();
  // Only a human can put pressure in a clip — `assertOpsWritable` refuses to,
  // and the fake models the refusal — so the model is poked directly.
  const slotState = control(fake).model.tracks[0]!.slots[0]!;
  slotState.notes.set(noteKey(0, 60, 0), note({ pressure: 0.9, pan: 0.25 }));

  const take = await executor.run([
    { op: 'note.clear', clip: clipA },
    { op: 'note.write', clip: clipA, notes: [note({ pitch: 72 })] },
  ]);
  assert.equal(take.fidelity, 'lossy');
  assert.match(take.values[0]!.caveats.join(' '), /pressure: cannot be written/);

  // ⚠ The revert must NOT throw. A revert that fails because of a property the
  // USER authored is a worse failure than one that reports it.
  const reverted = await executor.revert(take);
  assert.equal(reverted.take.report.applied, true);
  assert.deepEqual(reverted.unrestored.map((u) => u.what), ['pressure']);
  // Everything else came back.
  const [restored] = await readNotes(fake, notesAt(clipA));
  assert.equal(restored?.pan, 0.25);
  assert.equal(restored?.pressure, undefined, 'and it is honestly absent, not faked');
});

// --- §8c: the report ---------------------------------------------------------

test('X-report: readback disagreeing with the request is REPORTED, not swallowed (E8-E)', async () => {
  const { executor, clipA } = await fixture();
  // Four adjacent same-pitch dur=1 notes: Bitwig ends each where the next begins.
  const written = [0, 0.25, 0.5, 0.75].map((startBeats) => note({ startBeats, durationBeats: 1 }));
  const take = await executor.run([{ op: 'note.write', clip: clipA, notes: written }]);

  assert.equal(take.report.applied, true, 'every op reported ok — that is the point');
  assert.deepEqual(take.report.failed, []);
  const durations = take.report.disagreements.filter((d) => d.field === 'durationBeats');
  assert.equal(durations.length, 3, 'the last note has no successor to truncate it');
  assert.match(durations[0]!.known ?? '', /same-pitch adjacency/);
});

test('X-report: gain is reported as diverging by exactly the measured factor (E2)', async () => {
  const { executor, clipA } = await fixture();
  const take = await executor.run([{ op: 'note.write', clip: clipA, notes: [note({ gain: 0.7 })] }]);

  const gain = take.report.disagreements.find((d) => d.field === 'gain')!;
  assert.equal(gain.requested, 0.7);
  assert.equal(gain.readback, 1.4);
  assert.match(gain.known ?? '', /2x written, as measured/);
  // The take says lossy up front, so a revert can never quietly under-deliver.
  assert.equal(take.verify.entries[addressKey(notesAt(clipA))]?.fidelity, 'lossy');
});

test('X-empty: an empty patch is a no-op take, not a crash', async () => {
  const { executor } = await fixture();
  const take = await executor.run([]);
  assert.equal(take.report.applied, true);
  assert.deepEqual(take.values, []);
  assert.equal(take.fidelity, 'exact');
});

test('X-pressure: a patch ASKING for pressure is refused before anything is read (E15-E)', async () => {
  const { executor, clipA } = await fixture();
  const asked: Op[] = [{ op: 'note.write', clip: clipA, notes: [note({ pressure: 0.9 })] }];
  await assert.rejects(executor.run(asked), /pressure cannot be written/);
});
