/**
 * 8h4a write boundary on the fake adapter: the scene guard at the apply and
 * the group-slot refusal. The live adapter has the same cases in
 * `adapters/live/adapter.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { control } from '../adapters/fake/control.js';
import {
  GroupSlotError, StaleAddressError, addressKey, clip, notes as notesAt, scene, slot, snapshotAddresses,
  track, type BatchRequest, type NoteRecord,
} from '../contract/index.js';
import { acquireClipSnapshot, checkClipSnapshots, type SnapshotPort } from './clip-snapshots.js';
import { Executor } from './executor.js';

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 0.5, ...over,
});

/** A fake whose `apply` lets one host change happen first: after every read and mark, before the batch. */
class BeforeApply extends FakeAdapter {
  change: (() => void) | undefined;
  readonly requests: BatchRequest[] = [];
  override async apply(batch: BatchRequest) {
    this.requests.push(batch);
    const change = this.change;
    this.change = undefined;
    change?.();
    return super.apply(batch);
  }
}

function portOf(fake: FakeAdapter): SnapshotPort {
  return { mark: () => fake.revision(), read: (a, o) => fake.read(a, o), contentSince: (m) => fake.contentSince(m) };
}

/** Rows 1 and 2 of one track hold one clip each, with different notes. */
async function twoRows() {
  const fake = new BeforeApply({ tracks: ['gn-A'], scenes: 8 });
  const id = fake.model.visibleTracks()[0]!.channelId;
  await fake.apply({ ops: [1, 2].map((row) => ({ op: 'clip.create' as const, slot: slot(track(id), scene(row, 1)), lengthBeats: 4 })) });
  await fake.settle('trackStruct');
  const row = (index: number) => clip(slot(track(id), scene(index, 1)));
  await fake.apply({ ops: [
    { op: 'note.write', clip: row(1), notes: [note({ pitch: 60 })] },
    { op: 'note.write', clip: row(2), notes: [note({ pitch: 72 })] },
  ] });
  await fake.settle('noteWrite');
  fake.requests.length = 0;
  return { fake, id, row };
}

async function pitchesAt(fake: FakeAdapter, id: string, index: number, epoch: number): Promise<number[]> {
  const address = notesAt(clip(slot(track(id), scene(index, epoch))));
  const entry = (await fake.read([address])).entries[addressKey(address)];
  assert.ok(entry?.value.of === 'notes');
  return entry.value.notes.map((item) => item.pitch);
}

test('8h4a: a scene delete after the post-read mark and before the apply refuses; the next clip is not written', async () => {
  const { fake, id, row } = await twoRows();
  const got = await acquireClipSnapshot(portOf(fake), id, 1);
  assert.equal(got.found, true);
  const ref = (got as Extract<typeof got, { found: true }>).snapshot.ref;
  const revision = fake.model.revision;
  // Row 1 is deleted; row 2's clip slides into row 1 with no event for row 1.
  fake.change = () => control(fake).compactScene(1);
  await assert.rejects(
    new Executor(fake).run([{ op: 'note.insert', clip: row(1), notes: [note({ startBeats: 2, pitch: 90 })] }],
      { ifSnapshot: [ref] }),
    (error: unknown) => error instanceof StaleAddressError && error.why === undefined,
  );
  assert.equal(fake.model.revision, revision, 'no operation ran');
  assert.deepEqual(await pitchesAt(fake, id, 1, fake.model.sceneEpoch), [72], 'the clip that slid in is unchanged');
  assert.deepEqual(fake.requests.at(-1)?.ifScene, { generation: ref.mark.generation, project: ref.mark.project,
    sceneEpoch: ref.mark.sceneEpoch });
});

test('8h4a: an ordinary executor write carries the scene guard and refuses a scene insert before the apply', async () => {
  const { fake, id, row } = await twoRows();
  const revision = fake.model.revision;
  fake.change = () => { fake.model.sceneEpoch += 1; };
  await assert.rejects(
    new Executor(fake).run([{ op: 'note.insert', clip: row(1), notes: [note({ startBeats: 2, pitch: 90 })] }]),
    StaleAddressError,
  );
  assert.equal(fake.model.revision, revision);
  assert.deepEqual(await pitchesAt(fake, id, 1, fake.model.sceneEpoch), [60]);
  // A batch with no launcher row sends no scene guard.
  await new Executor(fake).run([{ op: 'track.rename', track: track(id), name: 'renamed' }]);
  assert.equal(fake.requests.at(-1)?.ifScene, undefined);
});

test('8h4a: a project change or a restart before the apply refuses with its reason', async () => {
  for (const [change, why] of [
    [(fake: FakeAdapter) => { fake.model.project = 'fake-project-Q'; }, 'project-changed'],
    [(fake: FakeAdapter) => { fake.model.generation = 'fake-gen-other'; }, 'extension-restarted'],
  ] as const) {
    const { fake, row } = await twoRows();
    const revision = fake.model.revision;
    fake.change = () => change(fake);
    await assert.rejects(
      new Executor(fake).run([{ op: 'note.insert', clip: row(1), notes: [note({ startBeats: 2, pitch: 90 })] }]),
      (error: unknown) => error instanceof StaleAddressError && error.why === why,
    );
    assert.equal(fake.model.revision, revision);
  }
});

test('8h4a: an empty current project fails closed', async () => {
  const { fake, row } = await twoRows();
  const at = await fake.revision();
  fake.model.project = '';
  await assert.rejects(fake.apply({
    ops: [{ op: 'note.insert', clip: row(1), notes: [note({ pitch: 90 })] }],
    ifScene: { generation: at.generation, project: '', sceneEpoch: at.sceneEpoch },
  }), (error: unknown) => error instanceof StaleAddressError && error.why === 'project-changed');
});

/** Track 0 is a group track with a clip in its own slot model; track 1 is a child. */
async function grouped() {
  const fake = new FakeAdapter({ tracks: ['Group 1', 'gn-child'], scenes: 8 });
  const [group, child] = fake.model.visibleTracks();
  const childClip = clip(slot(track(child!.channelId), scene(0, 1)));
  await fake.apply({ ops: [{ op: 'clip.create', slot: childClip.slot, lengthBeats: 4 }] });
  await fake.settle('trackStruct');
  await fake.apply({ ops: [{ op: 'note.write', clip: childClip, notes: [note()] }] });
  await fake.settle('noteWrite');
  group!.type = 'Group';
  // The group's own slot mirrors the child occupancy (E222).
  group!.slots[0] = { ...child!.slots[0]! };
  const groupClip = clip(slot(track(group!.channelId), scene(0, 1)));
  return { fake, group: group!, child: child!, groupClip, childClip };
}

test('8h4a: a group track slot refuses read, write, copy, move, launch, snapshot, and check', async () => {
  const { fake, group, groupClip, childClip } = await grouped();
  const revision = fake.model.revision;
  await assert.rejects(fake.read([notesAt(groupClip)]), (error: unknown) =>
    error instanceof GroupSlotError && error.reason === 'group-slot' && error.track.channelId === group.channelId);
  await assert.rejects(new Executor(fake).run([{ op: 'note.insert', clip: groupClip, notes: [note({ pitch: 90 })] }]),
    GroupSlotError);
  for (const ops of [
    [{ op: 'clip.duplicate' as const, source: groupClip, destination: slot(track(group.channelId), scene(1, 1)) }],
    [{ op: 'clip.move' as const, source: groupClip, destination: slot(track(group.channelId), scene(1, 1)) }],
    [{ op: 'clip.launch' as const, clip: groupClip, quantization: '1' as const, mode: 'default' as const }],
  ]) {
    await assert.rejects(fake.apply({ ops }), GroupSlotError);
  }
  assert.equal(fake.model.revision, revision, 'no operation ran');
  const { resolved } = await fake.resolve([groupClip, track(group.channelId)]);
  assert.deepEqual(resolved.map((item) => item.reason), ['group-slot', undefined]);
  await assert.rejects(acquireClipSnapshot(portOf(fake), group.channelId, 0), GroupSlotError);

  const got = await acquireClipSnapshot(portOf(fake), childClip.slot.track.channelId, 0);
  assert.equal(got.found, true, 'the child clip reads');
  const childRef = (got as Extract<typeof got, { found: true }>).snapshot.ref;
  assert.deepEqual((await checkClipSnapshots(portOf(fake), [childRef])).map((item) => item.verdict), ['current']);
  await assert.rejects(checkClipSnapshots(portOf(fake), [{ ...childRef, channelId: group.channelId }]), GroupSlotError);
  // A listed child keeps its own address. (Live, ALL_CHANNELS keeps a collapsed group's children in the bank: D33.)
  assert.ok((await fake.read(snapshotAddresses(childClip))).entries[addressKey(childClip)]);
});
