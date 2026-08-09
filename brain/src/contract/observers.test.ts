/**
 * The launcher-content observer, offline — session 3's exit criteria 3 and 4.
 *
 * ⚠ Every case here is one a live DAW cannot be asked to produce on demand. A
 * human clip drag needs a human; a ring that has dropped events needs 25 edits
 * in the window of one batch; a restarted extension needs a restarted Bitwig.
 * They are the cases that matter most and they are exactly the ones nobody would
 * ever get round to running by hand — which is what the fake is for
 * (PHASE-0 §Risks), and why the fake models the SAME ring size rather than a
 * generous one.
 *
 * The live half is `probes/e19-observers.ts`, which measures the two things the
 * fake cannot vouch for: that Bitwig fires these callbacks at all, and that the
 * pair arrives for a real drag.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { control } from '../adapters/fake/control.js';
import {
  clip, contentTouching, deltaComplete, notes as notesAt, scene, slot, track,
  type ClipAddress, type TrackAddress,
} from './index.js';

interface Fixture {
  readonly fake: FakeAdapter;
  readonly trackA: TrackAddress;
  readonly clipA: ClipAddress;
}

async function fixture(): Promise<Fixture> {
  const fake = new FakeAdapter({ tracks: ['gn-A'], scenes: 8 });
  const a = fake.model.visibleTracks()[0]!;
  const trackA = track(a.channelId);
  await fake.apply({ ops: [{ op: 'clip.create', slot: slot(trackA, scene(0, 1)), lengthBeats: 4 }] });
  await fake.settle('trackStruct');
  return { fake, trackA, clipA: clip(slot(trackA, scene(0, 1))) };
}

// --- the epoch is a difference, never an absolute -----------------------------

test('O-relative: the epoch is nonzero at rest, and only a DIFFERENCE means anything', async () => {
  const { fake } = await fixture();
  const mark = await fake.revision();
  // The fixture's own clip.create already moved it. §3.2.3's warning is that
  // Bitwig delivers INITIAL values through the same callbacks, so a reader that
  // treated "epoch > 0" as "something happened" would fire on a fresh project.
  assert.ok(mark.contentEpoch > 0, 'the epoch carries history we did not cause');

  const quiet = await fake.contentSince(mark);
  assert.deepEqual(quiet.events, [], 'nothing has happened SINCE the mark');
  assert.ok(deltaComplete(quiet), 'and the window saying so is intact');
});

// --- exit criterion: a human clip drag is detected ---------------------------

test('O-drag: a human clip drag arrives as a PAIR, and the scene count sits still (E16s)', async () => {
  const { fake, trackA } = await fixture();
  const before = await fake.revision();

  control(fake).dragClip(trackA.channelId, 0, 5);

  const delta = await fake.contentSince(before);
  assert.deepEqual(
    delta.events.map((e) => `${e.slotIndex}=${e.filled ? 'filled' : 'emptied'}`),
    ['5=filled', '0=emptied'],
    'source emptied and destination filled — the pair E16s measured',
  );
  // ⚠ THE FINDING, asserted next to its measurement: the scene-count epoch is
  // blind to this. §3.2.3 predicted the blind spot and E16s measured it (3 -> 3
  // through a real drag); if these ever stop differing, the two observers have
  // collapsed into one and the content epoch has stopped earning its place.
  const after = await fake.revision();
  assert.equal(after.sceneEpoch, before.sceneEpoch, 'a move changes no scene count');
  assert.notEqual(after.contentEpoch, before.contentEpoch, 'and the content epoch sees it');
});

test('O-drag: the events are matched by channelId, never by bank index', async () => {
  const { fake, trackA, clipA } = await fixture();
  const before = await fake.revision();
  control(fake).dragClip(trackA.channelId, 0, 5);
  const delta = await fake.contentSince(before);

  assert.equal(contentTouching(delta, clipA).length, 1, 'the address we hold was touched');
  assert.deepEqual(
    contentTouching(delta, clip(slot(track('some-other-uuid'), scene(0, 1)))),
    [],
    'a different track at the same slot index is a different address',
  );
});

test('O-scope: a track or scene address matches no cell event — it names no cell', async () => {
  const { fake, trackA } = await fixture();
  const before = await fake.revision();
  control(fake).dragClip(trackA.channelId, 0, 5);
  const delta = await fake.contentSince(before);

  assert.deepEqual(contentTouching(delta, trackA), [], 'a track address has no slot');
  assert.deepEqual(contentTouching(delta, scene(0, 1)), [], 'a scene address spans every track');
});

// --- exit criterion: a USER scene op moves the epoch -------------------------

test('O-scene: a scene the USER deleted bumps the epoch — the limit session 3 closed', async () => {
  const { fake, clipA } = await fixture();
  const before = await fake.revision();

  // ⚠ Not through `apply`. This is the case the old adapter-side counter could
  // not see AT ALL: it only bumped on our own ops, so a human deleting a scene
  // left every scene-relative address resolving as `found` while E3's
  // compaction had already moved every row beneath it.
  control(fake).compactScene(0);

  const after = await fake.revision();
  assert.notEqual(after.sceneEpoch, before.sceneEpoch, 'the observer saw an edit we did not make');
  const [resolved] = (await fake.resolve([clipA])).resolved;
  assert.equal(resolved?.found, false);
  assert.equal(resolved?.reason, 'stale-epoch', 'and the address is REFUSED, not resolved');
});

test('O-scene: a compaction is visible to the CONTENT observer too, not only the count', async () => {
  const { fake, trackA } = await fixture();
  const before = await fake.revision();
  control(fake).compactScene(0);
  const delta = await fake.contentSince(before);
  // Two independent detectors agreeing is worth asserting; two that could only
  // ever agree would not be. They disagree in `O-drag`, which is what makes this
  // agreement information rather than a tautology.
  assert.ok(delta.events.length > 0, 'the emptied row is a content event');
  assert.equal(delta.events[0]?.channelId, trackA.channelId);
});

// --- the three ways a window is not a quiet window ---------------------------

test('O-truncated: a ring that dropped events reports FEWER than happened, and says so', async () => {
  const { fake } = await fixture();
  const before = await fake.revision();

  control(fake).floodContentEvents(40);

  const delta = await fake.contentSince(before);
  assert.equal(delta.now - delta.since, 40, 'forty edits happened');
  assert.equal(delta.events.length, 24, 'and only the ring\'s worth can be named');
  assert.equal(delta.truncated, true);
  // ⚠ The whole point: a caller that only counted `events` would see a shorter
  // list and read the world as calmer than it was.
  assert.equal(deltaComplete(delta), false);
});

test('O-restart: a mark from a previous life of the extension is INCOMPARABLE, not old', async () => {
  const { fake, trackA } = await fixture();
  const before = await fake.revision();
  control(fake).dragClip(trackA.channelId, 0, 5);

  control(fake).restartExtension();

  const after = await fake.revision();
  // ⚠ The sharp edge: the counter came back SMALLER, so a naive comparison reads
  // "nothing has happened since" for a mark taken before a restart that
  // destroyed and rebuilt every observer.
  assert.ok(after.contentEpoch <= before.contentEpoch, 'the counters restarted lower');
  const delta = await fake.contentSince(before);
  assert.equal(delta.discontinuous, true);
  assert.equal(deltaComplete(delta), false, 'and it must never read as quiet');
});

test('O-project: a DIFFERENT PROJECT is incomparable — and has NO numeric tell', async () => {
  const { fake, trackA } = await fixture();
  const before = await fake.revision();
  control(fake).dragClip(trackA.channelId, 0, 5);

  control(fake).loadProject('fake-project-B', ['gn-Z']);

  const after = await fake.revision();
  // ⚠⚠ THE WHOLE POINT, asserted first because it is what makes this case worse
  // than a restart rather than milder. Nothing about the numbers looks wrong:
  assert.equal(after.generation, before.generation, 'the extension never restarted');
  assert.ok(after.contentEpoch > before.contentEpoch, 'and the epoch went UP, not back to zero');
  // ...so without the project field this reads as an ordinary busy window, and
  // every address in the old mark names a track that no longer exists.
  assert.notEqual(after.project, before.project);

  const delta = await fake.contentSince(before);
  assert.equal(delta.discontinuous, true);
  assert.equal(delta.discontinuity, 'project-changed');
  assert.equal(deltaComplete(delta), false);
});

test('O-project: an UNKNOWN project is not a match — "we could not tell" fails closed', async () => {
  const { fake } = await fixture();
  const before = await fake.revision();
  // ⚠ An older extension, or one whose `projectName()` handle was never obtained
  // (`projectStatus`), reports ''. Treating that as "the same project" is the one
  // direction that writes into the wrong one.
  const unknown = { ...before, project: '' };
  const delta = await fake.contentSince(unknown);
  assert.equal(delta.discontinuity, 'project-changed');
  assert.equal(deltaComplete(delta), false);
});

test('O-project: a restart is reported as a RESTART, not as a project change', async () => {
  const { fake } = await fixture();
  const before = await fake.revision();
  control(fake).restartExtension();
  // Both fields differ in the restart case; generation is checked first because
  // it is the more fundamental fact and needs the more specific sentence.
  assert.equal((await fake.contentSince(before)).discontinuity, 'extension-restarted');
});

test('O-restart: a restart resets the SCENE epoch too, so an old address is refused', async () => {
  const { fake, trackA } = await fixture();
  // ⚠ Minted at a NON-RESTING epoch on purpose. The resting value is what a
  // fresh init produces, so an address carrying it would still authorise after a
  // restart by coincidence — and a test that could not fail proves nothing
  // (E17 method guard 10's converse).
  control(fake).compactScene(7);
  control(fake).compactScene(6);
  const before = await fake.revision();
  assert.ok(before.sceneEpoch > 1, 'the fixture must not sit at the resting epoch');
  const held = clip(slot(trackA, scene(0, before.sceneEpoch)));
  assert.equal((await fake.resolve([held])).resolved[0]?.found, true, 'valid before the restart');

  control(fake).restartExtension();

  // Live, `sceneCountChanges` and `lastSceneCount` are re-initialised with every
  // other observer, so the counter comes back at its resting value — measured:
  // 7 -> 2 across a controller reload (FINDINGS E19). A fake that carried the old
  // epoch across a restart would AUTHORISE an address live Bitwig refuses, which
  // is the one direction a fake must never be wrong in.
  const [resolved] = (await fake.resolve([held])).resolved;
  assert.equal(resolved?.found, false);
  assert.equal(resolved?.reason, 'stale-epoch');
});

test('O-unattributable: an event that cannot name its track fails the window closed', async () => {
  const { fake } = await fixture();
  const before = await fake.revision();
  control(fake).unattributableContentEvent(3);

  const delta = await fake.contentSince(before);
  assert.equal(delta.truncated, false, 'the event is present — it is its TRACK that is missing');
  assert.equal(delta.discontinuous, false);
  assert.equal(deltaComplete(delta), false, 'so the window still cannot be believed');
});

test('O-window: a mark taken after an edit does not report that edit', async () => {
  const { fake, trackA } = await fixture();
  control(fake).dragClip(trackA.channelId, 0, 5);
  const after = await fake.revision();
  const delta = await fake.contentSince(after);
  assert.deepEqual(delta.events, [], 'the window is (since, now], exclusive at the left');
  assert.ok(deltaComplete(delta));
});

test('O-notes: writing notes into an OCCUPIED clip is not a content event', async () => {
  const { fake, clipA } = await fixture();
  const before = await fake.revision();
  await fake.apply({
    ops: [{ op: 'note.write', clip: clipA, notes: [{ pitch: 60, startBeats: 0, durationBeats: 1, velocity: 100 }] }],
  });
  await fake.settle('noteWrite');
  const delta = await fake.contentSince(before);
  // ⚠ Only a CHANGE of occupancy fires. A detector that also fired on every note
  // write would be noise within a batch, and silence is the thing this mechanism
  // sells — so the fake must not be noisier than Bitwig here.
  assert.deepEqual(delta.events, []);
  assert.deepEqual(await readPitches(fake, clipA), [60], 'the write really happened');
});

async function readPitches(fake: FakeAdapter, target: ClipAddress): Promise<number[]> {
  const address = notesAt(target);
  const snap = await fake.read([address]);
  const entry = Object.values(snap.entries)[0];
  return entry?.value.of === 'notes' ? entry.value.notes.map((n) => n.pitch) : [];
}
