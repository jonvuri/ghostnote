import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { clip, scene, slot, track, type NoteRecord } from '../contract/index.js';
import { Executor } from '../engine/index.js';
import {
  NOTE_INVARIANTS_SCHEMA, NOTE_PROPOSAL_SCHEMA, readExactNoteSource,
} from '../musical/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import {
  EXPERIMENTAL_7B_TOOL_PROFILE, STABLE_TOOL_PROFILE, TOOLS,
  callTool, toolsForProfile,
} from './tools.js';
import { workspaceOf } from './workspace.js';

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 4, ...over,
});

async function fixture() {
  const fake = new FakeAdapter({ tracks: ['gn-agent'], scenes: 4 });
  const trackState = (await fake.tracks())[0]!;
  const at = await fake.revision();
  const target = clip(slot(track(trackState.channelId), scene(0, at.sceneEpoch)));
  let id = 0;
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter: fake,
    executor: new Executor(fake, { newId: () => `experimental-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }),
    observationStore: new FakeObservationStore(),
  });
  await workspace.apply([
    { op: 'clip.create', slot: target.slot, lengthBeats: 8 },
    { op: 'note.write', clip: target, channel: 3, notes: [
      note({ pitch: 48 }), note({ pitch: 55 }), note({ pitch: 60 }),
    ] },
  ]);
  const marked = await fake.revision();
  const source = (await readExactNoteSource(fake, {
    clips: [target],
    source: {
      kind: 'live-bitwig', id: 'experimental-7b-fixture',
      permission: 'generated repository fixture under the MIT license',
    },
    expectedGeneration: marked.generation,
  })).source;
  return { workspace, source };
}

test('7b profile: stable registration stays byte-for-byte scoped while the experimental transform is a union', () => {
  assert.equal(toolsForProfile(STABLE_TOOL_PROFILE), TOOLS);
  const stable = toolsForProfile(STABLE_TOOL_PROFILE)
    .find((item) => item.name === 'transform_clip_music')!;
  const experimental = toolsForProfile(EXPERIMENTAL_7B_TOOL_PROFILE)
    .find((item) => item.name === 'transform_clip_music')!;
  assert.notEqual(experimental, stable);
  assert.equal(toolsForProfile(EXPERIMENTAL_7B_TOOL_PROFILE).length, TOOLS.length);
  assert.deepEqual(
    toolsForProfile(EXPERIMENTAL_7B_TOOL_PROFILE).map((item) => item.name),
    TOOLS.map((item) => item.name),
  );
  assert.notEqual(experimental.inputValidator, stable.inputValidator);
  assert.match(experimental.description, /Preview is read-only/);
});

test('7b profile: preview writes nothing and apply needs the accepted exact preview', async () => {
  const { workspace, source } = await fixture();
  const middle = source.eventMap.find((item) => item.pitch === 55)!.id;
  const input = {
    mode: 'agent-note-proposal-v0' as const,
    source,
    proposal: {
      schema: NOTE_PROPOSAL_SCHEMA,
      base_sha256: source.digest.value,
      ops: [{ op: 'transpose' as const, note_ids: [middle], semitones: 12 }],
    },
    invariants: {
      schema: NOTE_INVARIANTS_SCHEMA,
      preserveUnmentionedFields: true as const,
      samePitchOverlap: 'refuse' as const,
      allowedOperations: ['transpose' as const],
      allowedTrackAliases: source.aliases.map((item) => item.alias),
      noteCount: { min: 3, max: 3 },
      pitchRange: { min: 48, max: 67 },
      beatRange: { from: '0', to: '8', noteEndsWithin: true as const },
      requiredEventIds: source.eventMap.map((item) => item.id),
    },
  };
  const before = workspace.changes.list().length;
  const preview = await callTool(workspace, 'transform_clip_music', {
    ...input, action: 'preview',
  }, EXPERIMENTAL_7B_TOOL_PROFILE) as {
    applied: boolean;
    preview: { previewDigest: { value: string }; operations: unknown[] };
  };
  assert.equal(preview.applied, false);
  assert.equal(preview.preview.operations.length, 2);
  assert.equal(workspace.changes.list().length, before);

  await assert.rejects(callTool(workspace, 'transform_clip_music', {
    ...input, action: 'preview',
  }, STABLE_TOOL_PROFILE), /invalid input|Unrecognized key|expected/i);

  const applied = await callTool(workspace, 'transform_clip_music', {
    ...input,
    action: 'apply',
    acceptedPreviewSha256: preview.preview.previewDigest.value,
  }, EXPERIMENTAL_7B_TOOL_PROFILE) as {
    applied: boolean;
    profile: string;
    readback: { discrepancies: unknown[] };
    change: { id: string };
    reversal: { changeId: string };
  };
  assert.equal(applied.applied, true);
  assert.equal(applied.profile, EXPERIMENTAL_7B_TOOL_PROFILE);
  assert.deepEqual(applied.readback.discrepancies, []);
  assert.equal(applied.reversal.changeId, applied.change.id);
  assert.equal(workspace.changes.list().length, before + 1);
});
