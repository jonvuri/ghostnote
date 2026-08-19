import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { noteKey } from '../adapters/fake/model.js';
import {
  SlotOccupiedError, addressKey, clip, notes, scene, slot, track,
  type NoteRecord, type Op,
} from '../contract/index.js';
import { Executor, UnprotectedWriteError } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { workspaceOf, type Workspace } from '../surface/workspace.js';
import { applyMusicalPatch, MusicalPatchError, planMusicalPatch } from './index.js';

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 96, durationBeats: 1, ...over,
});

async function fixture(trackNames: readonly string[] = ['gn-A', 'gn-B']): Promise<{
  fake: FakeAdapter;
  workspace: Workspace;
  trackIds: readonly string[];
}> {
  const fake = new FakeAdapter({ tracks: trackNames, scenes: 8 });
  const trackIds = (await fake.tracks()).map((item) => item.channelId);
  let id = 0;
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter: fake,
    executor: new Executor(fake, { newId: () => `planner-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }),
    observationStore: new FakeObservationStore(),
  });
  return { fake, workspace, trackIds };
}

async function createClips(
  workspace: Workspace,
  clips: readonly { trackId: string; row: number; notes?: readonly NoteRecord[]; channel?: number }[],
): Promise<void> {
  const at = await workspace.mark();
  const ops: Op[] = [];
  for (const item of clips) {
    const address = clip(slot(track(item.trackId), scene(item.row, at.sceneEpoch)));
    ops.push({ op: 'clip.create', slot: address.slot, lengthBeats: 8 });
    if (item.notes !== undefined) {
      ops.push({ op: 'note.write', clip: address, channel: item.channel ?? 0, notes: item.notes });
    }
  }
  await workspace.apply(ops);
}

async function channelNotes(
  workspace: Workspace,
  trackId: string,
  row: number,
  channel: number,
): Promise<readonly NoteRecord[]> {
  const at = await workspace.mark();
  const address = notes(clip(slot(track(trackId), scene(row, at.sceneEpoch))), channel);
  const snapshot = await workspace.read([address]);
  const entry = snapshot.entries[addressKey(address)];
  return entry?.value.of === 'notes' ? entry.value.notes : [];
}

async function clipExists(workspace: Workspace, trackId: string, row: number): Promise<boolean> {
  const at = await workspace.mark();
  const address = clip(slot(track(trackId), scene(row, at.sceneEpoch)));
  const snapshot = await workspace.read([address]);
  const entry = snapshot.entries[addressKey(address)];
  return entry?.value.of === 'clip' && entry.value.exists;
}

test('P-apply: several clips, channels, triplets, expression, and ordered pipelines use one changeset', async () => {
  const { workspace, trackIds: [trackA, trackB] } = await fixture();
  await createClips(workspace, [
    { trackId: trackA!, row: 0 },
    { trackId: trackA!, row: 2, notes: [note({ startBeats: 1 / 6, pitch: 64, pan: -0.4 })], channel: 9 },
    { trackId: trackB!, row: 1 },
  ]);
  const beforeChanges = workspace.changes.list().length;
  const patch = {
    schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
    targets: [
      {
        clip: { trackId: trackA!, row: 0 }, channel: 1, write: 'merge',
        operations: [{
          op: 'generate', source: { kind: 'notes', notes: [
            note({ pitch: 60, durationBeats: 1 / 3, gain: 0.7, pan: -0.25 }),
            note({ startBeats: 1 / 3, pitch: 64, durationBeats: 1 / 3, timbre: 0.5 }),
          ] },
        }],
      },
      {
        clip: { trackId: trackA!, row: 0 }, channel: 9, write: 'replace',
        operations: [
          { op: 'generate', source: { kind: 'notes', notes: [note({ pitch: 48, releaseVelocity: 0.4 })] } },
          { op: 'transpose', semitones: 12 },
        ],
      },
      {
        clip: { trackId: trackB!, row: 1 }, channel: 3, write: 'replace',
        operations: [{
          op: 'generate', source: { kind: 'chord', symbol: 'Fm', octave: 3 },
          placement: { kind: 'stack', startBeats: 0, durationBeats: 2 }, velocity: 84,
        }],
      },
    ],
  } as const;

  const result = await applyMusicalPatch(workspace, patch, 'generation');
  assert.equal(result.changesets.length, 1);
  assert.equal(result.changesets[0]!.applied, true);
  assert.equal(workspace.changes.list().length, beforeChanges + 1);
  assert.equal(result.results.length, 3);
  assert.deepEqual(result.clipBlocks, []);
  assert.deepEqual(result.disagreements, []);
  assert.ok(result.reversal[0]!.unrestored.length === 0);
  assert.ok(result.results.every((item) => item.notes.every((value) => value.pressure === undefined)));

  const channel1 = await channelNotes(workspace, trackA!, 0, 1);
  assert.deepEqual(channel1.map((value) => value.startBeats), [0, 1 / 3]);
  assert.equal(channel1[0]!.gain, 0.7);
  assert.equal(channel1[1]!.timbre, 0.5);
  assert.deepEqual((await channelNotes(workspace, trackA!, 0, 9)).map((value) => value.pitch), [60]);
  assert.equal(await clipExists(workspace, trackA!, 1), false, 'direct work did not create an alternate');

  const reversal = await workspace.planRevert(result.changesets[0]!.id);
  assert.deepEqual(reversal.unrestored, []);
  await workspace.apply(reversal.ops, { clearance: reversal.clearance });
  assert.deepEqual(await channelNotes(workspace, trackA!, 0, 1), []);
  assert.deepEqual(await channelNotes(workspace, trackA!, 0, 9), []);
  assert.deepEqual(await channelNotes(workspace, trackB!, 1, 3), []);
});

test('P-transform: operation order changes timing and pitch while preserving expression', async () => {
  const { workspace, trackIds: [trackId] } = await fixture(['gn-A']);
  await createClips(workspace, [{
    trackId: trackId!, row: 0, channel: 7,
    notes: [note({ startBeats: 1 / 6, pitch: 60, durationBeats: 1 / 3, gain: 0.8, timbre: 0.3 })],
  }]);
  const patch = {
    schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
    targets: [{
      clip: { trackId: trackId!, row: 0 }, channel: 7, write: 'replace',
      operations: [
        { op: 'transpose', semitones: 7 },
        { op: 'quantize', gridBeats: 1 / 3, strength: 1 },
      ],
    }],
  } as const;
  const result = await applyMusicalPatch(workspace, patch, 'transformation');
  const [written] = await channelNotes(workspace, trackId!, 0, 7);
  assert.equal(written!.pitch, 67);
  assert.equal(written!.startBeats, 1 / 3);
  assert.equal(written!.gain, 0.8);
  assert.equal(written!.timbre, 0.3);
  assert.ok(result.differences.some((item) => item.code === 'timing-moved'));
});

test('P-variations: the complete copy chain settles before any take reconstruction', async () => {
  const { workspace, trackIds: [trackId] } = await fixture(['gn-A']);
  const source = Array.from({ length: 8 }, (_, index) => note({
    startBeats: index * 0.5, pitch: 60 + index % 3, durationBeats: 0.25,
  }));
  await createClips(workspace, [{ trackId: trackId!, row: 1, notes: source }]);
  const patch = {
    schema: 'ghostnote-musical-patch', version: 1, seed: 'four-rhythm-variations',
    protection: { kind: 'clip-block', reason: 'requested-variations', takes: 4 },
    targets: [{
      clip: { trackId: trackId!, row: 1 }, channel: 0, write: 'replace',
      operations: [
        { op: 'thin', probability: 0.15 },
        { op: 'densify', gridBeats: 0.25, probability: 0.2 },
        { op: 'humanize', maxTimingBeats: 0.015625, maxVelocity: 3 },
      ],
    }],
  } as const;

  const planned = await planMusicalPatch(workspace, patch, 'transformation');
  const duplicates = planned.ops.filter((op) => op.op === 'clip.duplicate');
  assert.deepEqual(duplicates.map((op) => op.op === 'clip.duplicate'
    ? [op.source.slot.scene.index, op.destination.scene.index] : []), [
    [1, 2], [2, 3], [3, 4],
  ]);
  assert.deepEqual(planned.ops.slice(0, 3).map((op) => op.op), [
    'clip.duplicate', 'clip.duplicate', 'clip.duplicate',
  ]);
  assert.equal(planned.ops[3]?.op, 'note.clear');
  assert.ok(planned.ops.every((op) => op.op !== 'track.duplicate'));
  assert.deepEqual(planned.clipBlocks[0]!.createdRows, [2, 3, 4]);

  const beforeChanges = workspace.changes.list().length;
  const result = await applyMusicalPatch(workspace, patch, 'transformation');
  assert.equal(workspace.changes.list().length, beforeChanges + 1);
  assert.equal(result.results.length, 4);
  assert.equal(new Set(result.results.flatMap((item) =>
    item.seedScopes.map((scope) => scope.scope))).size, 12);
  for (const row of [1, 2, 3, 4]) assert.equal(await clipExists(workspace, trackId!, row), true);
  assert.deepEqual(result.reversal[0]!.unrestored, []);

  const reversal = await workspace.planRevert(result.changesets[0]!.id);
  assert.deepEqual(
    reversal.ops.filter((op) => op.op === 'clip.delete').map((op) => op.slot.scene.index),
    [2, 3, 4],
  );
  await workspace.apply(reversal.ops, { clearance: reversal.clearance });
  assert.deepEqual(await channelNotes(workspace, trackId!, 1, 0), source);
  for (const row of [2, 3, 4]) assert.equal(await clipExists(workspace, trackId!, row), false);
});

test('P-preflight: an invalid grid or occupied destination creates no partial block', async () => {
  const { workspace, trackIds: [trackId] } = await fixture(['gn-A']);
  await createClips(workspace, [{ trackId: trackId!, row: 1, notes: [note()] }]);
  const changes = workspace.changes.list().length;
  const invalidGrid = {
    schema: 'ghostnote-musical-patch', version: 1, seed: 'grid-refusal',
    protection: { kind: 'clip-block', reason: 'requested-variations', takes: 2 },
    targets: [{
      clip: { trackId: trackId!, row: 1 }, channel: 0, write: 'replace',
      operations: [
        { op: 'generate', source: { kind: 'notes', notes: [note({ startBeats: 0.01, durationBeats: 0.01 })] } },
        { op: 'humanize', maxTimingBeats: 0, maxVelocity: 0 },
      ],
    }],
  };
  await assert.rejects(
    applyMusicalPatch(workspace, invalidGrid, 'generation'),
    /grid floor|no exact straight or triplet host grid/,
  );
  assert.equal(await clipExists(workspace, trackId!, 2), false);
  assert.equal(workspace.changes.list().length, changes);

  await createClips(workspace, [{ trackId: trackId!, row: 2, notes: [note({ pitch: 72 })] }]);
  const occupiedChanges = workspace.changes.list().length;
  await assert.rejects(
    applyMusicalPatch(workspace, {
      ...invalidGrid,
      targets: [{
        ...invalidGrid.targets[0],
        operations: [
          { op: 'generate', source: { kind: 'notes', notes: [note()] } },
          { op: 'humanize', maxTimingBeats: 0, maxVelocity: 0 },
        ],
      }],
    }, 'generation'),
    SlotOccupiedError,
  );
  assert.deepEqual((await channelNotes(workspace, trackId!, 2, 0)).map((value) => value.pitch), [72]);
  assert.equal(workspace.changes.list().length, occupiedChanges);
});

test('P-preflight: an oversized take count refuses before it allocates block rows', async () => {
  const { workspace, trackIds: [trackId] } = await fixture(['gn-A']);
  await createClips(workspace, [{ trackId: trackId!, row: 1, notes: [note()] }]);
  const changes = workspace.changes.list().length;

  await assert.rejects(
    applyMusicalPatch(workspace, {
      schema: 'ghostnote-musical-patch', version: 1, seed: 'oversized-block',
      protection: {
        kind: 'clip-block', reason: 'requested-variations', takes: 4_294_967_296,
      },
      targets: [{
        clip: { trackId: trackId!, row: 1 }, channel: 0, write: 'replace',
        operations: [
          { op: 'generate', source: { kind: 'notes', notes: [note()] } },
          { op: 'humanize', maxTimingBeats: 0, maxVelocity: 0 },
        ],
      }],
    }, 'generation'),
    (error: unknown) => error instanceof MusicalPatchError
      && /refused last row 4294967296/.test(error.message),
  );
  assert.equal(workspace.changes.list().length, changes);
});

test('P-fidelity: direct work refuses a lossy floor and an existing matching take clears it', async () => {
  const { fake, workspace, trackIds: [trackId] } = await fixture(['gn-A']);
  await createClips(workspace, [{ trackId: trackId!, row: 0 }]);
  const hostNote = note({ pitch: 50, pressure: 0.6 });
  fake.model.tracks[0]!.slots[0]!.notes.set(noteKey(7, 50, 0), hostNote);
  const at = await workspace.mark();
  await workspace.apply([{
    op: 'clip.duplicate',
    source: clip(slot(track(trackId!), scene(0, at.sceneEpoch))),
    destination: slot(track(trackId!), scene(1, at.sceneEpoch)),
  }]);
  const direct = {
    schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
    targets: [{
      clip: { trackId: trackId!, row: 0 }, channel: 0, write: 'merge',
      operations: [{ op: 'generate', source: { kind: 'notes', notes: [note({ pitch: 72 })] } }],
    }],
  } as const;
  const before = workspace.changes.list().length;
  await assert.rejects(applyMusicalPatch(workspace, direct, 'generation'), UnprotectedWriteError);
  assert.equal(workspace.changes.list().length, before);
  assert.deepEqual(await channelNotes(workspace, trackId!, 0, 0), []);

  const protectedPatch = {
    ...direct,
    protection: { kind: 'clip-block', reason: 'fidelity-required', takes: 1 },
  } as const;
  const planned = await planMusicalPatch(workspace, protectedPatch, 'generation');
  assert.equal(planned.results.length, 1);
  assert.deepEqual(planned.clipBlocks[0]!.protectedRows, [1]);
  assert.ok(planned.ops.every((op) => op.op !== 'clip.duplicate' && op.op !== 'track.duplicate'));
  const result = await applyMusicalPatch(workspace, protectedPatch, 'generation');
  assert.deepEqual((await channelNotes(workspace, trackId!, 0, 0)).map((value) => value.pitch), [72]);
  assert.deepEqual(await channelNotes(workspace, trackId!, 1, 0), []);
  assert.ok(result.reversal[0]!.unrestored.some((item) => /pressure/.test(item.why)));
});

test('P-revision: a rejected lossy plan reports no reversal loss', async () => {
  const { fake, workspace, trackIds: [trackId] } = await fixture(['gn-A']);
  await createClips(workspace, [{ trackId: trackId!, row: 0 }]);
  const hostNote = note({ pitch: 50, pressure: 0.6 });
  fake.model.tracks[0]!.slots[0]!.notes.set(noteKey(7, 50, 0), hostNote);
  const at = await workspace.mark();
  await workspace.apply([{
    op: 'clip.duplicate',
    source: clip(slot(track(trackId!), scene(0, at.sceneEpoch))),
    destination: slot(track(trackId!), scene(1, at.sceneEpoch)),
  }]);
  const staleWorkspace: Workspace = {
    ...workspace,
    async apply(ops, options) {
      fake.model.revision += 1;
      return workspace.apply(ops, options);
    },
  };
  const patch = {
    schema: 'ghostnote-musical-patch', version: 1,
    protection: { kind: 'clip-block', reason: 'fidelity-required', takes: 1 },
    targets: [{
      clip: { trackId: trackId!, row: 0 }, channel: 0, write: 'merge',
      operations: [{ op: 'generate', source: { kind: 'notes', notes: [note({ pitch: 76 })] } }],
    }],
  } as const;
  const result = await applyMusicalPatch(staleWorkspace, patch, 'generation');
  assert.equal(result.changesets[0]!.applied, false);
  assert.equal(result.reversal[0]!.fidelity, 'exact');
  assert.deepEqual(result.reversal[0]!.unrestored, []);
  assert.deepEqual(await channelNotes(workspace, trackId!, 0, 0), []);
});
