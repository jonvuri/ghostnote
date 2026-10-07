/**
 * D32 snapshot references: fingerprint, token, every verdict, the survey, and
 * the executor guard. The fake adapter models the launcher events and window
 * coverage that the verdict reads.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { control } from '../adapters/fake/control.js';
import {
  CLIP_SOURCE_DOMAIN, ClipSnapshotRefusedError, addressKey, clip, clipSourceFingerprint,
  decodeClipSnapshotRef, encodeClipSnapshotRef, notes as notesAt, scene, slot, track,
  type ClipAddress, type ClipSnapshot, type ClipSnapshotRef, type NoteRecord,
} from '../contract/index.js';
import { acquireClipSnapshot, checkClipSnapshots, type SnapshotPort } from './clip-snapshots.js';
import { Executor } from './executor.js';

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 0.5, ...over,
});

interface Fixture {
  readonly fake: FakeAdapter;
  readonly port: SnapshotPort;
  readonly channelA: string;
  readonly channelB: string;
  readonly clipA: ClipAddress;
}

async function fixture(): Promise<Fixture> {
  const fake = new FakeAdapter({ tracks: ['gn-A', 'gn-B'], scenes: 8 });
  const [a, b] = fake.model.visibleTracks();
  const clipA = clip(slot(track(a!.channelId), scene(0, 1)));
  const clipA1 = clip(slot(track(a!.channelId), scene(1, 1)));
  await fake.apply({ ops: [
    { op: 'clip.create', slot: clipA.slot, lengthBeats: 4 },
    { op: 'clip.create', slot: clipA1.slot, lengthBeats: 4 },
    { op: 'clip.create', slot: slot(track(b!.channelId), scene(0, 1)), lengthBeats: 4 },
  ] });
  await fake.settle('trackStruct');
  await fake.apply({ ops: [
    { op: 'note.write', clip: clipA, notes: [note(), note({ startBeats: 1, pitch: 64 })] },
    { op: 'note.write', clip: clipA1, notes: [note({ pitch: 48 })] },
  ] });
  await fake.settle('noteWrite');
  const port: SnapshotPort = {
    mark: () => fake.revision(),
    read: (addresses, options) => fake.read(addresses, options),
    contentSince: (since) => fake.contentSince(since),
  };
  return { fake, port, channelA: a!.channelId, channelB: b!.channelId, clipA };
}

async function acquire(fx: Fixture, channelId: string, row = 0): Promise<ClipSnapshot> {
  const result = await acquireClipSnapshot(fx.port, channelId, row);
  assert.equal(result.found, true);
  return (result as Extract<typeof result, { found: true }>).snapshot;
}

async function verdictOf(fx: Fixture, ref: ClipSnapshotRef) {
  const [verdict] = await checkClipSnapshots(fx.port, [ref]);
  return verdict!;
}

test('S-fingerprint: domain, note order, raw values, and address fields', () => {
  const base = {
    clipMetadata: { name: 'x', loopLength: 4, colorAlpha: 1 },
    clipRead: { loopStartBeats: 0, loopEndBeats: 4, playStopBeats: 4 },
    notes: [
      { channel: 1, cell: 0, pitch: 60, velocity: 0.5 },
      { channel: 0, cell: 512, pitch: 61, velocity: 0.5 },
      { channel: 0, cell: 0, pitch: 62, velocity: 0.5 },
    ],
  };
  const digest = clipSourceFingerprint(base);
  assert.equal(digest.domain, CLIP_SOURCE_DOMAIN);
  assert.match(digest.sha256, /^[0-9a-f]{64}$/);
  // Note order and the address fields of the clip.read extent do not change the digest.
  assert.deepEqual(clipSourceFingerprint({ ...base, notes: [...base.notes].reverse() }), digest);
  assert.deepEqual(clipSourceFingerprint({
    ...base, clipRead: { ...base.clipRead, channelId: 'other', row: 9 },
  }), digest);
  // A raw binary64 difference below MIDI resolution changes it.
  const changed = clipSourceFingerprint({
    ...base, notes: [{ ...base.notes[0]!, velocity: 0.5000001 }, ...base.notes.slice(1)],
  });
  assert.notEqual(changed.sha256, digest.sha256);
  assert.notEqual(clipSourceFingerprint({ ...base, clipMetadata: { ...base.clipMetadata, colorAlpha: 0.5 } }).sha256,
    digest.sha256);
});

test('S-token: a reference round-trips and every other shape refuses', async () => {
  const fx = await fixture();
  const { ref } = await acquire(fx, fx.channelA);
  const token = encodeClipSnapshotRef(ref);
  assert.deepEqual(decodeClipSnapshotRef(token), ref);
  assert.throws(() => decodeClipSnapshotRef('nope'), /unknown token format/);
  const tampered = 'gcs1.' + Buffer.from(JSON.stringify({ ...ref, extra: 1 })).toString('base64url');
  assert.throws(() => decodeClipSnapshotRef(tampered), /has fields/);
  const badRow = 'gcs1.' + Buffer.from(JSON.stringify({ ...ref, row: -1 })).toString('base64url');
  assert.throws(() => decodeClipSnapshotRef(badRow), /row is not an integer/);
});

test('S-current: no edit gives current, and an equal read gives an equal reference', async () => {
  const fx = await fixture();
  const first = await acquire(fx, fx.channelA);
  const second = await acquire(fx, fx.channelA);
  assert.equal(first.ref.source.sha256, second.ref.source.sha256);
  assert.equal(first.channels[0]!.length, 2);
  assert.equal((await verdictOf(fx, first.ref)).verdict, 'current');
});

test('S-stale: the E231 edit classes give stale with the new snapshot', async () => {
  const edits: readonly [string, (fx: Fixture) => Promise<void>][] = [
    ['add', async (fx) => { await fx.fake.apply({ ops: [{ op: 'note.insert', clip: fx.clipA, notes: [note({ pitch: 70 })] }] }); }],
    ['delete', async (fx) => { await fx.fake.apply({ ops: [{ op: 'note.clear', clip: fx.clipA }] }); }],
    ['velocity', async (fx) => { await fx.fake.apply({ ops: [{ op: 'note.write', clip: fx.clipA, notes: [note({ velocity: 90 })] }] }); }],
    ['nudge', async (fx) => {
      fx.fake.model.tracks.find((t) => t.channelId === fx.channelA)!.slots[0]!.notes.clear();
      await fx.fake.apply({ ops: [{ op: 'note.write', clip: fx.clipA, notes: [note({ startBeats: 1 / 512 })] }] });
    }],
    ['executor note.insert', async (fx) => {
      await new Executor(fx.fake).run([{ op: 'note.insert', clip: fx.clipA, notes: [note({ startBeats: 2, pitch: 71 })] }]);
    }],
    ['editor move', async (fx) => {
      await fx.fake.apply({ ops: [{ op: 'note.remove', clip: fx.clipA, notes: [note({ startBeats: 1, pitch: 64 })] }] });
      await fx.fake.settle('noteWrite');
      await fx.fake.apply({ ops: [{ op: 'note.insert', clip: fx.clipA, notes: [note({ startBeats: 1.75, pitch: 64 })] }] });
    }],
    ['loop length', async (fx) => {
      fx.fake.model.tracks.find((t) => t.channelId === fx.channelA)!.slots[0]!.lengthBeats = 8;
    }],
  ];
  for (const [name, edit] of edits) {
    const fx = await fixture();
    const before = await acquire(fx, fx.channelA);
    await edit(fx);
    await fx.fake.settle('noteWrite');
    const verdict = await verdictOf(fx, before.ref);
    assert.equal(verdict.verdict, 'stale', name);
    const fresh = await acquire(fx, fx.channelA);
    const stale = verdict as Extract<typeof verdict, { verdict: 'stale' }>;
    assert.deepEqual(stale.snapshot.channels, fresh.channels, name);
    assert.deepEqual(stale.snapshot.metadata, fresh.metadata, name);
    assert.equal(stale.snapshot.ref.source.sha256, fresh.ref.source.sha256, name);
    assert.equal((await verdictOf(fx, stale.snapshot.ref)).verdict, 'current', name);
  }
});

test('S-row: a reference names its row; an edit on another row of the track leaves it current', async () => {
  const fx = await fixture();
  const row0 = await acquire(fx, fx.channelA, 0);
  const row1 = await acquire(fx, fx.channelA, 1);
  assert.notEqual(row0.ref.source.sha256, row1.ref.source.sha256);
  const clipA1 = clip(slot(track(fx.channelA), scene(1, 1)));
  await fx.fake.apply({ ops: [{ op: 'note.insert', clip: clipA1, notes: [note({ pitch: 72 })] }] });
  await fx.fake.settle('noteWrite');
  const verdicts = await checkClipSnapshots(fx.port, [row0.ref, row1.ref]);
  assert.deepEqual(verdicts.map((item) => item.verdict), ['current', 'stale']);
});

test('S-identity: scene layout, clip replacement, and a moved clip refuse without a snapshot', async () => {
  const cases: readonly [string, (fx: Fixture) => void, string][] = [
    ['scene compaction', (fx) => control(fx.fake).compactScene(5), 'scene-layout'],
    ['delete and recreate', (fx) => control(fx.fake).replaceClipInPlace(fx.channelA, 0), 'slot-event'],
    ['clip moved away', (fx) => control(fx.fake).dragClip(fx.channelA, 0, 3), 'slot-event'],
  ];
  for (const [name, edit, why] of cases) {
    const fx = await fixture();
    const { ref } = await acquire(fx, fx.channelA);
    edit(fx);
    const verdict = await verdictOf(fx, ref);
    assert.equal(verdict.verdict, 'identity-changed', name);
    assert.equal((verdict as { why: string }).why, why, name);
    assert.equal('snapshot' in verdict, false, name);
  }
});

test('S-identity: a truncated ring and an unattributable event refuse', async () => {
  const flood = await fixture();
  const flooded = await acquire(flood, flood.channelA);
  control(flood.fake).floodContentEvents(40);
  const truncated = await verdictOf(flood, flooded.ref);
  assert.equal(truncated.verdict, 'identity-changed');
  assert.equal((truncated as { why: string }).why, 'delta-incomplete');

  const unnamed = await fixture();
  const before = await acquire(unnamed, unnamed.channelA);
  control(unnamed.fake).unattributableContentEvent(4);
  const verdict = await verdictOf(unnamed, before.ref);
  assert.equal(verdict.verdict, 'identity-changed');
  assert.equal((verdict as { why: string }).why, 'delta-incomplete');
});

test('S-identity: an event on another slot leaves the reference current', async () => {
  const fx = await fixture();
  const { ref } = await acquire(fx, fx.channelA);
  control(fx.fake).dragClip(fx.channelB, 0, 2);
  assert.equal((await verdictOf(fx, ref)).verdict, 'current');
});

test('S-incomparable: a reload and a project change refuse', async () => {
  const reload = await fixture();
  const reloaded = await acquire(reload, reload.channelA);
  control(reload.fake).restartExtension();
  const restarted = await verdictOf(reload, reloaded.ref);
  assert.equal(restarted.verdict, 'incomparable');
  assert.equal((restarted as { why: string }).why, 'extension-restarted');

  const project = await fixture();
  const before = await acquire(project, project.channelA);
  control(project.fake).loadProject('Q');
  const changed = await verdictOf(project, before.ref);
  assert.equal(changed.verdict, 'incomparable');
  assert.equal((changed as { why: string }).why, 'project-changed');
});

test('S-detour: P to Q to P is current only when no guard records it', async () => {
  // The fake models a detour as a project name change and back with no slot event.
  const quiet = await fixture();
  const quietRef = (await acquire(quiet, quiet.channelA)).ref;
  quiet.fake.model.project = 'Q';
  quiet.fake.model.project = quietRef.mark.project;
  assert.equal((await verdictOf(quiet, quietRef)).verdict, 'current');

  // A detour that delivers a target-slot event refuses.
  const loud = await fixture();
  const loudRef = (await acquire(loud, loud.channelA)).ref;
  loud.fake.model.pushContentEvent(loud.channelA, 0, true);
  const verdict = await verdictOf(loud, loudRef);
  assert.equal(verdict.verdict, 'identity-changed');

  // A detour through a project with another scene count moves the scene guard.
  const scenes = await fixture();
  const scenesRef = (await acquire(scenes, scenes.channelA)).ref;
  scenes.fake.model.sceneEpoch += 2;
  const scened = await verdictOf(scenes, scenesRef);
  assert.equal(scened.verdict, 'identity-changed');
  assert.equal((scened as { why: string }).why, 'scene-layout');
});

test('S-uncovered: at the mark, at use time, and at both', async () => {
  const atMark = await fixture();
  control(atMark.fake).setBankWindow(1);
  const markRef = (await acquire(atMark, atMark.channelA)).ref;
  control(atMark.fake).setBankWindow(32);
  const first = await verdictOf(atMark, markRef);
  assert.equal(first.verdict, 'uncovered');
  assert.equal((first as { uncoveredIn: string }).uncoveredIn, 'tracks');

  const atUse = await fixture();
  const useRef = (await acquire(atUse, atUse.channelA)).ref;
  control(atUse.fake).setSceneWindow(4);
  const second = await verdictOf(atUse, useRef);
  assert.equal(second.verdict, 'uncovered');
  assert.equal((second as { uncoveredIn: string }).uncoveredIn, 'scenes');

  const both = await fixture();
  control(both.fake).setBankWindow(1);
  const bothRef = (await acquire(both, both.channelA)).ref;
  control(both.fake).setSceneWindow(4);
  const third = await verdictOf(both, bothRef);
  assert.equal(third.verdict, 'uncovered');
  assert.equal((third as { uncoveredIn: string }).uncoveredIn, 'both');
});

test('S-absent: an unknown track and an empty slot refuse with their reasons', async () => {
  const gone = await fixture();
  const goneRef = (await acquire(gone, gone.channelA)).ref;
  gone.fake.model.tracks = gone.fake.model.tracks.filter((t) => t.channelId !== gone.channelA);
  const unknown = await verdictOf(gone, goneRef);
  assert.equal(unknown.verdict, 'absent');
  assert.equal((unknown as { why: string }).why, 'unknown-track');

  const empty = await fixture();
  const emptyRef = (await acquire(empty, empty.channelA)).ref;
  // An empty slot with no launcher event: the delta is complete and names nothing.
  empty.fake.model.tracks.find((t) => t.channelId === empty.channelA)!.slots[0]!.hasContent = false;
  const absent = await verdictOf(empty, emptyRef);
  assert.equal(absent.verdict, 'absent');
  assert.equal((absent as { why: string }).why, 'absent-clip');
});

test('S-survey: only the edited clips are stale, in input order', async () => {
  const fx = await fixture();
  const refs = [
    (await acquire(fx, fx.channelA, 0)).ref,
    (await acquire(fx, fx.channelA, 1)).ref,
    (await acquire(fx, fx.channelB, 0)).ref,
  ];
  await fx.fake.apply({ ops: [
    { op: 'note.insert', clip: fx.clipA, notes: [note({ pitch: 80 })] },
    { op: 'note.insert', clip: clip(slot(track(fx.channelB), scene(0, 1))), notes: [note({ pitch: 81 })] },
  ] });
  await fx.fake.settle('noteWrite');
  const verdicts = await checkClipSnapshots(fx.port, refs);
  assert.deepEqual(verdicts.map((item) => item.verdict), ['stale', 'current', 'stale']);
  assert.deepEqual(verdicts.map((item) => 'snapshot' in item), [true, false, true]);
});

test('S-executor: a stale reference refuses before any host mutation; a current one applies', async () => {
  const fx = await fixture();
  const executor = new Executor(fx.fake, { newId: () => 'take', now: () => 0 });
  const { ref } = await acquire(fx, fx.channelA);
  await fx.fake.apply({ ops: [{ op: 'note.insert', clip: fx.clipA, notes: [note({ pitch: 90 })] }] });
  await fx.fake.settle('noteWrite');
  const revision = fx.fake.model.revision;
  const before = await fx.fake.read([notesAt(fx.clipA)]);
  const write = [{ op: 'note.insert' as const, clip: fx.clipA, notes: [note({ pitch: 91, startBeats: 2 })] }];
  await assert.rejects(executor.run(write, { ifSnapshot: [ref] }), (error: unknown) => {
    assert.ok(error instanceof ClipSnapshotRefusedError);
    assert.equal(error.verdicts[0]!.verdict, 'stale');
    return true;
  });
  assert.equal(fx.fake.model.revision, revision);
  assert.deepEqual(await fx.fake.read([notesAt(fx.clipA)]), before);

  const current = await acquire(fx, fx.channelA);
  const take = await executor.run(write, { ifSnapshot: [current.ref] });
  assert.equal(take.report.applied, true);
  assert.deepEqual(Object.keys(take.stash.entries), [addressKey(notesAt(fx.clipA))]);
  const after = await fx.fake.read([notesAt(fx.clipA)]);
  const entry = after.entries[addressKey(notesAt(fx.clipA))];
  assert.ok(entry?.value.of === 'notes' && entry.value.notes.some((item) => item.pitch === 91));
});

test('S-executor: a supplied preflight read replaces the stash read; the verify read covers the whole clip', async () => {
  class Counting extends FakeAdapter {
    sourced = 0;
    override async read(...args: Parameters<FakeAdapter['read']>) {
      if (args[1]?.sources !== undefined) this.sourced += 1;
      return super.read(...args);
    }
  }
  const fake = new Counting({ tracks: ['gn-A'], scenes: 4 });
  const id = fake.model.visibleTracks()[0]!.channelId;
  const target = clip(slot(track(id), scene(0, 1)));
  await fake.apply({ ops: [{ op: 'clip.create', slot: target.slot, lengthBeats: 4 }] });
  await fake.settle('trackStruct');
  const port: SnapshotPort = { mark: () => fake.revision(), read: (a, o) => fake.read(a, o), contentSince: (m) => fake.contentSince(m) };
  const executor = new Executor(fake, { newId: () => 'take', now: () => 0 });
  const write = [{ op: 'note.insert' as const, clip: target, notes: [note({ pitch: 91, startBeats: 2 })] }];

  // A Ghostnote write after the preflight read: the revision guard rejects the batch whole.
  const stale = await acquireClipSnapshot(port, id, 0);
  assert.equal(stale.found, true);
  await fake.apply({ ops: [{ op: 'note.insert', clip: target, notes: [note({ pitch: 90 })] }] });
  await fake.settle('noteWrite');
  const revision = fake.model.revision;
  const rejected = await executor.run(write, { ifSnapshot: [(stale as Extract<typeof stale, { found: true }>).snapshot.ref],
    snapshotPreflight: stale.read, ifRevision: stale.read.at.revision });
  assert.equal(rejected.report.applied, false);
  assert.equal(fake.model.revision, revision);

  // A preflight read that does not hold the write set refuses.
  const narrow = await fake.read([notesAt(target, 3)]);
  const fresh = await acquireClipSnapshot(port, id, 0);
  const ref = (fresh as Extract<typeof fresh, { found: true }>).snapshot.ref;
  await assert.rejects(executor.run(write, { ifSnapshot: [ref], snapshotPreflight: narrow }), /does not cover/);
  assert.equal(fake.model.revision, revision);

  fake.sourced = 0;
  const take = await executor.run(write, { ifSnapshot: [ref], snapshotPreflight: fresh.read, verifySources: [target] });
  assert.equal(take.report.applied, true);
  assert.equal(fake.sourced, 1, 'one sourced read: the verify read');
  assert.deepEqual(Object.keys(take.stash.entries), [addressKey(notesAt(target))]);
  assert.ok(take.verify.sources?.[addressKey(target)] !== undefined);
  const channels = Array.from({ length: 16 }, (_, channel) => take.verify.entries[addressKey(notesAt(target, channel))]);
  assert.ok(channels.every((entry) => entry?.value.of === 'notes'));

  // A scene change after the preflight read: the verdict on the new mark refuses before any host call.
  const later = await acquireClipSnapshot(port, id, 0);
  const laterRef = (later as Extract<typeof later, { found: true }>).snapshot.ref;
  const before = fake.model.revision;
  control(fake).compactScene(3);
  await assert.rejects(executor.run(write, { ifSnapshot: [laterRef], snapshotPreflight: later.read }));
  assert.equal(fake.model.revision, before);
});

/** A port whose read lets one scene change happen after the read's own mark. */
function changingDuringRead(fx: Fixture, change: () => void): SnapshotPort {
  return {
    ...fx.port,
    read: async (addresses, options) => {
      const read = await fx.fake.read(addresses, options);
      change();
      return read;
    },
  };
}

test('S-identity: a scene change during the read refuses (post-read scene guard)', async () => {
  // An empty scene deletion: epoch and count change, no slot event.
  const empty = await fixture();
  const emptyRef = (await acquire(empty, empty.channelA)).ref;
  const [quiet] = await checkClipSnapshots(changingDuringRead(empty, () => control(empty.fake).compactScene(7)), [emptyRef]);
  assert.equal(quiet!.verdict, 'identity-changed');
  assert.equal((quiet as { why: string }).why, 'scene-layout');

  // A compaction slides another clip into the target row: the target slot stays filled, so no event names it.
  const slide = await fixture();
  await slide.fake.apply({ ops: [{ op: 'clip.create', slot: slot(track(slide.channelA), scene(2, 1)), lengthBeats: 4 }] });
  await slide.fake.settle('trackStruct');
  const slideRef = (await acquire(slide, slide.channelA, 1)).ref;
  const [slid] = await checkClipSnapshots(changingDuringRead(slide, () => control(slide.fake).compactScene(1)), [slideRef]);
  assert.equal(slid!.verdict, 'identity-changed');
  assert.equal((slid as { why: string }).why, 'scene-layout');
});

test('S-executor: a compaction during the stash read refuses before the write', async () => {
  class Racing extends FakeAdapter {
    race: (() => void) | undefined;
    override async read(...args: Parameters<FakeAdapter['read']>) {
      const read = await super.read(...args);
      const race = this.race;
      if (args[1]?.sources !== undefined && race !== undefined) { this.race = undefined; race(); }
      return read;
    }
  }
  const fake = new Racing({ tracks: ['gn-A'], scenes: 8 });
  const id = fake.model.visibleTracks()[0]!.channelId;
  await fake.apply({ ops: [1, 2].map((row) => ({ op: 'clip.create' as const, slot: slot(track(id), scene(row, 1)), lengthBeats: 4 })) });
  await fake.settle('trackStruct');
  const target = clip(slot(track(id), scene(1, 1)));
  await fake.apply({ ops: [{ op: 'note.write', clip: target, notes: [note()] }] });
  await fake.settle('noteWrite');
  const port: SnapshotPort = { mark: () => fake.revision(), read: (a, o) => fake.read(a, o), contentSince: (m) => fake.contentSince(m) };
  const got = await acquireClipSnapshot(port, id, 1);
  assert.equal(got.found, true);
  const ref = (got as Extract<typeof got, { found: true }>).snapshot.ref;
  // Row 2's clip slides into row 1; the target slot stays filled, so no event names it.
  fake.race = () => control(fake).compactScene(1);
  const revision = fake.model.revision;
  await assert.rejects(new Executor(fake).run([{ op: 'note.insert', clip: target, notes: [note({ startBeats: 2, pitch: 72 })] }],
    { ifSnapshot: [ref] }), (error: unknown) => error instanceof ClipSnapshotRefusedError
      && error.verdicts[0]!.verdict === 'identity-changed');
  assert.equal(fake.model.revision, revision);
});
