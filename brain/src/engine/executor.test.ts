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
  AddressUnresolvedError, BlindSpotError, NOTE_PROP_FIDELITY, addressKey, clip, device,
  notes as notesAt, param, scene, slot, track,
  type BitwigAdapter, type NoteRecord, type Op, type TrackAddress,
} from '../contract/index.js';
import { Executor } from './executor.js';
import { branchProtected, gateBeforeReading, UnprotectedWriteError } from './floor.js';

/** Addresses for the pure cases below — well-formed, and never resolved. */
const FIXTURE_TRACK = track('b07f6b06-8f4f-4f4f-802d-ddf1a5190515');
const CLIP_FIXTURE = clip(slot(FIXTURE_TRACK, scene(0, 1)));

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

  const reverted = await executor.revertUnchecked(take);
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
  const reverted = await executor.revertUnchecked(take);

  assert.equal(reverted.of, take.id);
  assert.notEqual(reverted.take.id, take.id);
  // The revert's OWN stash is the state it replaced — which is what makes
  // "undo the undo" just another revert.
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
    tracks: () => fake.tracks(),
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
    contentSince: (since) => fake.contentSince(since),
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
  const reverted = await executor.revertUnchecked(take);
  assert.deepEqual(reverted.plan.ops.map((o) => o.op), ['clip.delete']);
  const after = await fake.read([clip(target)]);
  const entry = after.entries[addressKey(clip(target))];
  assert.equal(entry?.value.of === 'clip' ? entry.value.exists : true, false);
});

// --- the D16 amendment, end to end through the pipeline ----------------------

test('X-clip: a deleted clip comes BACK — at its captured length, carrying its notes (D16 rev)', async () => {
  const { fake, executor, clipA } = await fixture();
  const address = notesAt(clipA);
  await fake.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [note({ pitch: 62, pan: 0.25 })] }] });
  await fake.settle('noteWrite');

  const take = await executor.run(
    [{ op: 'clip.delete', slot: clipA.slot }],
    { clearance: branchProtected('X-clip') },
  );
  assert.equal(take.report.applied, true);
  assert.deepEqual(await readNotes(fake, address), [], 'the clip really went');

  const reverted = await executor.revertUnchecked(take);
  // ⚠ The order is the correctness: create, THEN write. Replaying notes into a
  // slot with no clip lands the cursor on a different clip, silently (E2).
  assert.deepEqual(reverted.plan.ops.map((o) => o.op), ['clip.create', 'note.clear', 'note.write']);
  const back = await fake.read([clipA, address]);
  const entry = back.entries[addressKey(clipA)];
  assert.equal(entry?.value.of === 'clip' ? entry.value.exists : false, true);
  assert.equal(entry?.value.of === 'clip' ? entry.value.lengthBeats : undefined, 4);
  const notes = back.entries[addressKey(address)];
  assert.deepEqual(
    notes?.value.of === 'notes' ? notes.value.notes.map((n) => [n.pitch, n.pan]) : [],
    [[62, 0.25]],
    'and its content came with it',
  );
});

test('X-device: an insert is undone at the chain index the RECEIPT minted (D16 rev)', async () => {
  const { fake, executor, trackA } = await fixture();
  const source = { from: 'bitwig', uuid: 'gn-device' } as const;

  const take = await executor.run([{ op: 'device.insert', track: trackA, source }]);
  assert.equal(take.report.applied, true);
  assert.deepEqual(take.unrevertable, [], 'an insert is no longer filed as having no inverse');
  // ⚠ Minted, not counted. The receipt reports where the device actually landed,
  // which is the same discipline `track.create` has always followed (E2c).
  assert.deepEqual(take.receipt.minted[0], device(trackA, 0));
  assert.equal(control(fake).model.tracks[0]!.devices.length, 1);

  const reverted = await executor.revertUnchecked(take);
  assert.deepEqual(reverted.plan.ops, [{ op: 'device.delete', device: device(trackA, 0) }]);
  assert.deepEqual(reverted.unrestored, [], 'nothing is reported, because nothing was lost');
  assert.equal(control(fake).model.tracks[0]!.devices.length, 0, 'the chain is back where it was');
});

// --- exit criterion 5 --------------------------------------------------------

test('X-label: a take value is labelled from its write-set, not by its caller (D5)', async () => {
  const { executor, clipA, trackA } = await fixture();

  const plain = await executor.run([{ op: 'note.write', clip: clipA, notes: [note()] }]);
  assert.equal(plain.fidelity, 'exact');
  assert.deepEqual(plain.values[0]!.caveats, []);

  // ⚠ E3: a scene op compacts rows, so every scene-relative address in the same
  // batch is positional-at-risk — derived from ADDRESS_IDENTITY, not remembered.
  // ⚠ And as of D18c a batch that labels itself worse than `exact` is REFUSED
  // unless something is protecting its prior state — so every case below has to
  // say what that is. X-floor asserts the refusal itself.
  const risky = await executor.run([
    { op: 'note.write', clip: clipA, notes: [note({ pitch: 62 })] },
    { op: 'scene.create', count: 1 },
  ], { clearance: branchProtected('X-label') });
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
  const destructive = await executor.run(
    [{ op: 'track.delete', track: trackA }],
    { clearance: branchProtected('X-label') },
  );
  assert.equal(destructive.fidelity, 'none');
});

test('X-label: a clip that was THERE is lossy and says what a rebuild cannot carry (D16 rev)', async () => {
  const { executor, trackA } = await fixture({ clips: false });
  const target = slot(trackA, scene(2, 1));

  // An empty slot is EXACT — absence has no content to fail to recreate (D16d),
  // which is what keeps the flagship create+write case off the floor entirely.
  const created = await executor.run([{ op: 'clip.create', slot: target, lengthBeats: 4 }]);
  assert.equal(created.fidelity, 'exact');
  assert.deepEqual(created.values.find((v) => v.address.kind === 'clip')!.caveats, []);

  // Deleting it is LOSSY, not `none`: the length was captured and the notes are
  // stashed, so the clip comes back — minus the things nothing can read back.
  const deleted = await executor.run(
    [{ op: 'clip.delete', slot: target }],
    { clearance: branchProtected('X-label') },
  );
  const clipValue = deleted.values.find((v) => v.address.kind === 'clip')!;
  assert.equal(clipValue.fidelity, 'lossy');
  assert.equal(clipValue.value?.of === 'clip' ? clipValue.value.lengthBeats : undefined, 4);
  assert.match(clipValue.caveats.join(' '), /AUTOMATION LANES/);
  assert.match(clipValue.caveats.join(' '), /4-beat clip/);
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
  ], { clearance: branchProtected('X-label-pressure') });
  assert.equal(take.fidelity, 'lossy');
  assert.match(take.values[0]!.caveats.join(' '), /pressure: cannot be written/);

  // ⚠ The revert must NOT throw. A revert that fails because of a property the
  // USER authored is a worse failure than one that reports it.
  const reverted = await executor.revertUnchecked(take);
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

// --- the fidelity floor (D18c, §3.3.5) ---------------------------------------

test('X-floor: a batch that cannot be put back exactly is REFUSED, and nothing is written', async () => {
  const { fake, executor, clipA } = await fixture();
  const address = notesAt(clipA);
  // A human played expression into this clip. That is what makes the SAME
  // `note.write` lossy here and exact on a clean clip — the floor is a predicate
  // over the stash, which is the one thing a hand-kept list of op classes could
  // never be (§3.3.5).
  await fake.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [note({ gain: 0.7 })] }] });
  await fake.settle('noteWrite');

  await assert.rejects(
    executor.run([{ op: 'note.clear', clip: clipA }]),
    UnprotectedWriteError,
    'the response is a refusal, never an automatic branch (D18c)',
  );
  assert.equal((await readNotes(fake, address)).length, 1, 'and the clip is untouched');

  // ⚠ The refusal says what it cannot restore and what would clear it, and it
  // names NO mechanism. A redirect arriving through an error message is the
  // choice-mapping leak wearing a disguise (D18c), and it would contaminate
  // every branch event logged after it.
  const refused = await executor.run([{ op: 'note.clear', clip: clipA }])
    .then(() => undefined, (e: unknown) => e as UnprotectedWriteError);
  assert.ok(refused instanceof UnprotectedWriteError);
  assert.equal(refused.fidelity, 'lossy');
  assert.match(refused.message, /gain/);
  assert.doesNotMatch(refused.message, /fork|layer|chain|duplicate|track instead/i);
});

test('X-floor: the same write into a CLEAN clip pays nothing — the predicate is over the stash', async () => {
  const { executor, clipA } = await fixture();
  const take = await executor.run([{ op: 'note.write', clip: clipA, notes: [note({ gain: 0.7 })] }]);
  // ⚠ A take's fidelity describes what it can RESTORE, not what it wrote. The
  // clip was empty, so the prior state is exactly restorable and the batch is
  // ordinary — even though the gain it writes will read back doubled.
  assert.equal(take.fidelity, 'exact');
  assert.equal(take.report.applied, true);
});

test('X-floor: clearance lets it through, and the take still says what it cannot restore', async () => {
  const { fake, executor, clipA } = await fixture();
  await fake.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [note({ gain: 0.7 })] }] });
  await fake.settle('noteWrite');

  const take = await executor.run(
    [{ op: 'note.clear', clip: clipA }],
    { clearance: branchProtected('take-42') },
  );
  assert.equal(take.report.applied, true);
  // Clearance changes whether the batch RUNS. It never changes what the take
  // claims: D5's "a revert never silently under-delivers" is untouched by it.
  assert.equal(take.fidelity, 'lossy');
  assert.match(take.values[0]!.caveats.join(' '), /gain/);
});

test('X-floor: reverting our own changeset is NOT gated, or a lossy take could never be undone', async () => {
  const { fake, executor, clipA } = await fixture();
  const address = notesAt(clipA);
  await fake.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [note({ pan: 0.25 })] }] });
  await fake.settle('noteWrite');

  const take = await executor.run([
    { op: 'note.clear', clip: clipA },
    { op: 'note.write', clip: clipA, notes: [note({ pitch: 72, gain: 0.7 })] },
  ]);
  assert.equal(take.fidelity, 'exact', 'the prior state was clean, so the write was ordinary');

  // ⚠ The state the revert is about to overwrite now carries a doubled gain, so
  // the floor would refuse it — and refusing a revert of our own take is the
  // deadlock version of the rule. D19/D20: own changesets ride the ordinary
  // surface ungated, and the fidelity machinery REPORTS instead.
  const reverted = await executor.revertUnchecked(take);
  assert.equal(reverted.take.report.applied, true);
  assert.deepEqual((await readNotes(fake, address)).map((n) => n.pan), [0.25]);
});

test('X-floor: every op in the contract is classified against the damage-precedes-stash rule', () => {
  // ⚠ §3.3.6's one hard-coded member, and today it matches NOTHING — which is a
  // fact about the contract, not about Bitwig. `device.insertFileAt` with
  // `where: 'replace'` is on the wire; the `device.insert` op carries no
  // placement, so a replace is not expressible and cannot reach the executor.
  // When Phase 5 adds it, `damagePrecedesTheStash`'s exhaustive switch makes
  // "forgot to classify it" a compile error rather than an ungated replace.
  const everyOp: Op[] = [
    { op: 'note.write', clip: CLIP_FIXTURE, notes: [note()] },
    { op: 'note.clear', clip: CLIP_FIXTURE },
    { op: 'note.props', clip: CLIP_FIXTURE, notes: [note()] },
    { op: 'clip.create', slot: CLIP_FIXTURE.slot, lengthBeats: 4 },
    { op: 'clip.delete', slot: CLIP_FIXTURE.slot },
    { op: 'track.create', name: 'gn-x' },
    { op: 'track.rename', track: CLIP_FIXTURE.slot.track, name: 'gn-x' },
    { op: 'track.delete', track: CLIP_FIXTURE.slot.track },
    { op: 'scene.create', count: 1 },
    { op: 'scene.delete', scene: scene(0, 1) },
    { op: 'device.insert', track: CLIP_FIXTURE.slot.track, source: { from: 'bitwig', uuid: 'abc' } },
    { op: 'device.delete', device: device(CLIP_FIXTURE.slot.track, 0) },
    { op: 'param.set', param: param(device(CLIP_FIXTURE.slot.track, 0), 1), value: 0.5 },
    { op: 'notify', message: 'hi' },
  ];
  assert.equal(gateBeforeReading(everyOp, undefined), undefined);
  assert.equal(
    new Set(everyOp.map((o) => o.op)).size,
    everyOp.length,
    'one of every variant, or this stops meaning "every op in the contract"',
  );
});

/**
 * ⚠ D19's *"structurally bounded"*, made structural — the `WIRE_METHODS_BANNED`
 * idiom aimed at the leak a reviewer found in this exact spot.
 *
 * `revertUnchecked` cannot evaluate the half of D19 that needs a read of the
 * world (*and last wrote it*), so the only safe route is `Stash.planReversal`.
 * That was true before this test existed too — it was just written in a comment,
 * and the obvious call was still the unsafe one. A convenience alias re-added for
 * ergonomics is the way this regresses, so the name is banned rather than merely
 * unused.
 */
test('X-ban: `revert` is not on the Executor — the bounded route is the stash\'s', () => {
  const executor = new Executor(new FakeAdapter({ tracks: ['gn-A'], scenes: 4 }));
  for (const name of ['revert', 'revertTake', 'undo']) {
    assert.equal(
      name in (executor as object),
      false,
      `Executor.${name} would be the obvious call and the unbounded one. D19 bounds reversal to ` +
        'what we ourselves last wrote, which needs a live read compared against the stash — ' +
        '`Stash.planReversal`. Keep the unbounded primitive named `revertUnchecked`.',
    );
  }
  // ⚠ Proves the check is not vacuous: `in` really does see a prototype method on
  // this object, so the falses above mean "absent" and not "wrong operator".
  assert.equal('revertUnchecked' in (executor as object), true);
  assert.equal(typeof executor.revertUnchecked, 'function', 'and the honest name is still there');
});

// --- session 3: the concurrent-edit detector ---------------------------------

test('X-concurrent: an edit OUTSIDE the write-set is reported, and the batch still lands', async () => {
  const fx = await fixture();
  // A human dragging a clip on the other track while our batch runs. It touches
  // nothing we address, which is exactly why nothing else in the system can see
  // it: the verify reads our addresses, the fingerprint compares our addresses.
  const racingFake: BitwigAdapter = {
    ...adapterOf(fx.fake),
    apply: async (batch) => {
      const receipt = await fx.fake.apply(batch);
      control(fx.fake).dragClip(fx.trackB.channelId, 0, 6);
      return receipt;
    },
  };
  const executor = new Executor(racingFake, { newId: () => 'take-c', now: () => 1 });

  const take = await executor.run([{ op: 'note.write', clip: fx.clipA, notes: [note()] }]);

  assert.equal(take.report.applied, true, 'detection is not refusal — the batch ran');
  assert.equal(take.report.undecidable, undefined);
  assert.deepEqual(
    take.report.concurrent.map((c) => `${c.slotIndex}:${c.filled}`),
    ['6:true', '0:false'],
    'both halves of the drag, on a track this batch never addressed',
  );
  assert.match(take.report.concurrent[0]!.why, /addressed by position/);
});

test('X-concurrent: an event on OUR OWN slot is not reported — the callback has no author', async () => {
  const fx = await fixture({ clips: false });
  const slotA = slot(fx.trackA, scene(0, 1));

  const take = await fx.executor.run([{ op: 'clip.create', slot: slotA, lengthBeats: 4 }]);

  // The create really did fire the observer...
  assert.ok((await fx.fake.revision()).contentEpoch > 0);
  // ...and it is deliberately NOT reported. A detector that flagged every
  // clip.create as a concurrent edit would be noise by the end of the day, and
  // our own addresses are arbitrated by the verify readback instead.
  assert.deepEqual(take.report.concurrent, []);
  assert.equal(take.report.undecidable, undefined);
});

test('X-concurrent: a window that cannot be evaluated is NOT an empty window', async () => {
  const fx = await fixture();
  const flooding: BitwigAdapter = {
    ...adapterOf(fx.fake),
    apply: async (batch) => {
      const receipt = await fx.fake.apply(batch);
      control(fx.fake).floodContentEvents(40);
      return receipt;
    },
  };
  const executor = new Executor(flooding, { newId: () => 'take-f', now: () => 1 });

  const take = await executor.run([{ op: 'note.write', clip: fx.clipA, notes: [note()] }]);

  assert.equal(take.report.applied, true);
  assert.match(take.report.undecidable ?? '', /more launcher edits/);
});

test('X-concurrent: a REJECTED batch still reports where the world moved', async () => {
  const fx = await fixture();
  const racing: BitwigAdapter = {
    ...adapterOf(fx.fake),
    read: async (sel) => {
      const snapshot = await fx.fake.read(sel);
      control(fx.fake).bumpRevision();
      control(fx.fake).dragClip(fx.trackB.channelId, 0, 6);
      return snapshot;
    },
  };
  const executor = new Executor(racing, { newId: () => 'take-rj', now: () => 1 });

  const take = await executor.run([{ op: 'note.write', clip: fx.clipA, notes: [note()] }]);

  assert.equal(take.report.applied, false, 'the revision guard rejected it whole');
  // The guard says the world moved; this says WHERE. Zero ops applied, so every
  // event in the window is somebody else's by construction.
  assert.equal(take.report.concurrent.length, 2);
});

test('X-concurrent: a detector that cannot answer never takes down a batch that landed', async () => {
  const fx = await fixture();
  const broken: BitwigAdapter = {
    ...adapterOf(fx.fake),
    contentSince: () => Promise.reject(new Error('bridge went away')),
  };
  const executor = new Executor(broken, { newId: () => 'take-b', now: () => 1 });

  const take = await executor.run([{ op: 'note.write', clip: fx.clipA, notes: [note()] }]);

  assert.equal(take.report.applied, true, 'losing the take would be worse than losing detection');
  assert.match(take.report.undecidable ?? '', /bridge went away/);
});

/** The fake, as a plain `BitwigAdapter` object one method can be swapped on. */
function adapterOf(fake: FakeAdapter): BitwigAdapter {
  return {
    hello: () => fake.hello(),
    resolve: (refs) => fake.resolve(refs),
    tracks: () => fake.tracks(),
    read: (sel) => fake.read(sel),
    apply: (batch) => fake.apply(batch),
    settle: (budget) => fake.settle(budget),
    revision: () => fake.revision(),
    contentSince: (since) => fake.contentSince(since),
    close: () => fake.close(),
  };
}

test('X-concurrent: a REJECTED batch reports an edit on a slot it MEANT to write', async () => {
  const fx = await fixture();
  // ⚠ The case the other reject test cannot reach: the human edits the very slot
  // this batch was about to write. Nothing else covers it — a rejected batch
  // takes no verify read (its `verify` IS its stash) and `planReversal` returns
  // empty for an unapplied take, so the boundary never runs either.
  const racing: BitwigAdapter = {
    ...adapterOf(fx.fake),
    read: async (sel) => {
      const snapshot = await fx.fake.read(sel);
      control(fx.fake).bumpRevision();
      control(fx.fake).replaceClipInPlace(fx.trackA.channelId, 0);
      return snapshot;
    },
  };
  const executor = new Executor(racing, { newId: () => 'take-rj2', now: () => 1 });

  const take = await executor.run([{ op: 'note.write', clip: fx.clipA, notes: [note()] }]);

  assert.equal(take.report.applied, false);
  // ZERO ops applied, so every event in the window is somebody else's BY
  // CONSTRUCTION — including events on slots this batch merely intended to touch.
  assert.equal(
    take.report.concurrent.length, 2,
    'both halves of the replacement must be reported, on our own intended slot',
  );
  assert.ok(take.report.concurrent.every((c) => c.slotIndex === 0));
  assert.match(take.report.concurrent[0]!.why, /applied nothing/);
});
