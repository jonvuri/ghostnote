import assert from 'node:assert/strict';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { clip, scene, slot, track, type NoteRecord, type Op } from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { MUSICAL_REQUEST_CORPUS } from '../musical/index.js';
import { decodeObservationRecord, FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callTool, registerTools, TOOLS } from './tools.js';
import { TOOL_DESCRIPTION_VERSION } from './description-cohort.js';
import { workspaceOf } from './workspace.js';

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 96, durationBeats: 1, ...over,
});

function parseToolResult(value: unknown): Record<string, unknown> {
  const content = (value as { content?: { type: string; text?: string }[] }).content ?? [];
  const text = content.find((item) => item.type === 'text')?.text;
  if (text === undefined) throw new Error('the MCP tool returned no text result');
  return JSON.parse(text) as Record<string, unknown>;
}

test('2g corpus routes through exactly two public musical tool schemas', () => {
  const names = { generation: 'generate_clip_music', transformation: 'transform_clip_music' } as const;
  for (const entry of MUSICAL_REQUEST_CORPUS) {
    const spec = TOOLS.find((tool) => tool.name === names[entry.tool]);
    assert.ok(spec !== undefined, `${entry.id} has no public tool`);
    if (entry.outcome.kind === 'patch') {
      assert.equal(z.object(spec.inputSchema).safeParse(entry.outcome.patch).success, true, entry.id);
    }
  }
  assert.deepEqual(
    TOOLS.filter((tool) => tool.name.endsWith('_clip_music')).map((tool) => tool.name),
    ['generate_clip_music', 'transform_clip_music'],
  );
});

test('an ordinary MCP client generates, transforms, reads, opens, and reverts', async (t) => {
  const fake = new FakeAdapter({ tracks: ['gn-A'], scenes: 8 });
  const trackId = (await fake.tracks())[0]!.channelId;
  const observationStore = new FakeObservationStore();
  let id = 0;
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter: fake,
    executor: new Executor(fake, { newId: () => `surface-music-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }),
    observationStore,
  });
  const at = await workspace.mark();
  const clips = [0, 1].map((row) => clip(slot(track(trackId), scene(row, at.sceneEpoch))));
  const setup: Op[] = [
    { op: 'clip.create', slot: clips[0]!.slot, lengthBeats: 4 },
    { op: 'clip.create', slot: clips[1]!.slot, lengthBeats: 4 },
    { op: 'note.write', clip: clips[1]!, channel: 0, notes: [note()] },
  ];
  await workspace.apply(setup);

  const server = new McpServer({ name: 'ghostnote-test', version: '0.0.1' });
  registerTools(server, workspace);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'ordinary-2g-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  t.after(async () => client.close());

  const listed = await client.listTools();
  const music = listed.tools.filter((tool) => tool.name.endsWith('_clip_music'));
  assert.deepEqual(music.map((tool) => tool.name), [
    'generate_clip_music', 'transform_clip_music',
  ]);
  assert.ok(music.every((tool) => tool.annotations?.destructiveHint === false));

  const beforeInvalid = workspace.changes.list().length;
  const invalid = await client.callTool({
    name: 'generate_clip_music',
    arguments: {
      schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
      pressure: 0.5,
      targets: [{
        clip: { trackId, row: 0 }, channel: 2, write: 'merge',
        operations: [{
          op: 'generate',
          source: { kind: 'notes', notes: [note({ pitch: 64 })] },
        }],
      }],
    },
  });
  const invalidResult = invalid as {
    readonly isError?: boolean;
    readonly content?: readonly { readonly type: string; readonly text?: string }[];
  };
  assert.equal(invalidResult.isError, true);
  const invalidText = invalidResult.content?.find((item) => item.type === 'text')?.text ?? '';
  assert.match(invalidText, /Input validation error/);
  assert.equal(workspace.changes.list().length, beforeInvalid);

  const begun = parseToolResult(await client.callTool({
    name: 'record_observation',
    arguments: {
      operation: 'begin',
      requestedScope: 'launcher-clip-only',
      rawScope: 'Add a C minor chord to channel 2.',
    },
  }));

  const generated = parseToolResult(await client.callTool({
    name: 'generate_clip_music',
    arguments: {
      schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
      targets: [{
        clip: { trackId, row: 0 }, channel: 2, write: 'merge',
        operations: [{
          op: 'generate', source: { kind: 'chord', symbol: 'Cm', octave: 4 },
          placement: { kind: 'stack', startBeats: 0, durationBeats: 1 }, velocity: 90,
        }],
      }],
    },
  }));
  assert.equal(generated['applied'], true);
  assert.equal(typeof generated['musicalUseId'], 'string');
  const generatedChange = (generated['changes'] as { changeId: string }[])[0]!.changeId;
  parseToolResult(await client.callTool({
    name: 'record_observation',
    arguments: {
      operation: 'enrich',
      instructionId: begun['instructionId'],
      operatorResponse: 'accepted',
    },
  }));

  const transformed = parseToolResult(await client.callTool({
    name: 'transform_clip_music',
    arguments: {
      schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
      targets: [{
        clip: { trackId, row: 1 }, channel: 0, write: 'replace',
        operations: [{ op: 'transpose', semitones: 7 }],
      }],
    },
  }));
  assert.equal(transformed['applied'], true);
  assert.equal(typeof transformed['musicalUseId'], 'string');
  const transformedChange = (transformed['changes'] as { changeId: string }[])[0]!.changeId;

  const read = parseToolResult(await client.callTool({
    name: 'read_clip', arguments: { trackId, row: 1, channel: 0 },
  }));
  assert.deepEqual((read['notes'] as NoteRecord[]).map((item) => item.pitch), [67]);

  const opened = parseToolResult(await client.callTool({
    name: 'show_changed_clip',
    arguments: { changeId: transformedChange, target: { trackId, row: 1 } },
  }));
  assert.equal(opened['navigated'], true);

  const revertedTransform = parseToolResult(await client.callTool({
    name: 'revert_change', arguments: { changeId: transformedChange },
  }));
  assert.equal(revertedTransform['applied'], true);
  const restored = parseToolResult(await client.callTool({
    name: 'read_clip', arguments: { trackId, row: 1, channel: 0 },
  }));
  assert.deepEqual((restored['notes'] as NoteRecord[]).map((item) => item.pitch), [60]);

  const revertedGeneration = parseToolResult(await client.callTool({
    name: 'revert_change', arguments: { changeId: generatedChange },
  }));
  assert.equal(revertedGeneration['applied'], true);
  const cleared = parseToolResult(await client.callTool({
    name: 'read_clip', arguments: { trackId, row: 0, channel: 2 },
  }));
  assert.deepEqual(cleared['notes'], []);

  const stored = decodeObservationRecord((await observationStore.read()).value);
  const uses = stored.entries.filter((entry) => entry.type === 'musical-use');
  assert.deepEqual(uses.map((entry) => entry.tool), [
    'generate_clip_music', 'transform_clip_music',
  ]);
  assert.ok(uses.every((entry) => entry.descriptionVersion === TOOL_DESCRIPTION_VERSION));
  const instruction = stored.entries.find((entry) => entry.type === 'instruction-observation');
  assert.equal(instruction?.rawScope, 'Add a C minor chord to channel 2.');
  assert.equal(instruction?.operatorResponse, 'accepted');
  assert.deepEqual(instruction?.resultIds, [generated['musicalUseId']]);
});

test('public validation refuses version, boundary, pressure, and MIDI range before a write', async () => {
  const fake = new FakeAdapter({ tracks: ['gn-A'], scenes: 4 });
  const trackId = (await fake.tracks())[0]!.channelId;
  let id = 0;
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter: fake,
    executor: new Executor(fake, { newId: () => `surface-refusal-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }),
    observationStore: new FakeObservationStore(),
  });
  const at = await workspace.mark();
  const target = clip(slot(track(trackId), scene(0, at.sceneEpoch)));
  await workspace.apply([
    { op: 'clip.create', slot: target.slot, lengthBeats: 4 },
    { op: 'note.write', clip: target, channel: 0, notes: [note({ pitch: 120 })] },
  ]);
  const before = workspace.changes.list().length;
  const generation = TOOLS.find((tool) => tool.name === 'generate_clip_music')!;
  const transformation = TOOLS.find((tool) => tool.name === 'transform_clip_music')!;

  const validGeneration = {
    schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
    targets: [{
      clip: { trackId, row: 0 }, channel: 0, write: 'merge',
      operations: [{ op: 'generate', source: { kind: 'notes', notes: [note({ pitch: 64 })] } }],
    }],
  };
  await assert.rejects(
    callTool(workspace, 'generate_clip_music', { ...validGeneration, pressure: 0.5 }),
    /unrecognized key/i,
  );
  assert.equal(z.object(generation.inputSchema).safeParse({ ...validGeneration, version: 2 }).success, false);
  assert.equal(z.object(generation.inputSchema).safeParse({
    ...validGeneration,
    targets: [{
      ...validGeneration.targets[0],
      operations: [{
        op: 'generate', source: { kind: 'notes', notes: [{ ...note(), pressure: 0.5 }] },
      }],
    }],
  }).success, false);
  const wrongBoundary = await transformation.run(workspace, validGeneration as never) as {
    refused?: boolean; unexpected?: string;
  };
  assert.equal(wrongBoundary.refused, true);
  assert.equal(wrongBoundary.unexpected, undefined);
  const outOfRange = await transformation.run(workspace, {
    schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
    targets: [{
      clip: { trackId, row: 0 }, channel: 0, write: 'replace',
      operations: [{ op: 'transpose', semitones: 12 }],
    }],
  } as never) as { refused?: boolean; unexpected?: string };
  assert.equal(outOfRange.refused, true);
  assert.equal(outOfRange.unexpected, undefined);
  assert.equal(workspace.changes.list().length, before);
});
