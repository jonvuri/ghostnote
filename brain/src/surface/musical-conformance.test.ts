import assert from 'node:assert/strict';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { control } from '../adapters/fake/control.js';
import {
  clip, scene, slot, track,
  type BatchRequest, type BitwigAdapter, type NoteRecord,
} from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callTool, registerTools } from './tools.js';
import { exactMusicalNote, runPublicMusicalConformance } from './musical-conformance.js';
import { workspaceOf, type Workspace } from './workspace.js';

function routedAdapter(
  writer: BitwigAdapter,
  read: BitwigAdapter['read'],
  apply: BitwigAdapter['apply'] = (batch) => writer.apply(batch),
): BitwigAdapter {
  return {
    hello: () => writer.hello(),
    resolve: (refs) => writer.resolve(refs),
    tracks: () => writer.tracks(),
    devices: (trackRef) => writer.devices(trackRef),
    read,
    apply,
    settle: (budget) => writer.settle(budget),
    revision: () => writer.revision(),
    contentSince: (since) => writer.contentSince(since),
    preserveSelection: (work) => writer.preserveSelection(work),
    showClipInEditor: (clipRef, verifiedAt) => writer.showClipInEditor(clipRef, verifiedAt),
    close: () => writer.close(),
  };
}

function workspace(adapter: BitwigAdapter): { readonly value: Workspace; readonly stash: Stash } {
  const stash = new Stash();
  return {
    stash,
    value: workspaceOf({
      ready: async () => undefined,
      adapter,
      executor: new Executor(adapter),
      stash,
      observationStore: new FakeObservationStore(),
    }),
  };
}

function parseResult(value: unknown): Record<string, unknown> {
  const result = value as {
    readonly isError?: boolean;
    readonly content?: readonly { readonly type: string; readonly text?: string }[];
  };
  const text = result.content?.find((item) => item.type === 'text')?.text;
  if (result.isError === true) throw new Error(text ?? 'MCP tool error');
  if (text === undefined) throw new Error('the MCP tool returned no text result');
  return JSON.parse(text) as Record<string, unknown>;
}

const simplePatch = (trackId: string, row: number, note: NoteRecord = exactMusicalNote()) => ({
  schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
  targets: [{
    clip: { trackId, row }, channel: 0, write: 'replace',
    operations: [{ op: 'generate', source: { kind: 'notes', notes: [note] } }],
  }],
});

test('2h one fake invocation covers the complete public musical contract and protections', async (t) => {
  const fake = new FakeAdapter({ tracks: ['gn-A', 'gn-B', 'gn-C'], scenes: 10 });
  let witnessReads = 0;
  const adapter = routedAdapter(fake, async (refs) => {
    witnessReads += 1;
    return fake.read(refs);
  });
  const { value, stash } = workspace(adapter);
  const tracks = await value.tracks();
  const trackIds = tracks.filter((item) => item.name.startsWith('gn-')).map((item) => item.channelId);

  const server = new McpServer({ name: 'ghostnote-2h-fake', version: '1.0.0' });
  registerTools(server, value);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'phase-2h-conformance', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  t.after(async () => client.close());

  const report = await runPublicMusicalConformance({
    slots: [
      { trackId: trackIds[0]!, row: 1 },
      { trackId: trackIds[1]!, row: 2 },
      { trackId: trackIds[2]!, row: 3 },
    ],
    call: async (name, args = {}) => parseResult(await client.callTool({ name, arguments: args })),
    change: (changeId) => stash.log.require(changeId),
  });
  assert.equal(report.exactProperties.length, 20);
  assert.ok(report.generationStageCount >= 6);
  assert.ok(report.generationPropertyStageCount >= 3);
  assert.ok(witnessReads > 0, 'all workspace reads must cross the witness route');
  assert.ok(fake.lastNavigation !== undefined, 'the editor-navigation route must run');

  const staleFake = new FakeAdapter({ tracks: ['gn-stale'], scenes: 4 });
  const staleBase = workspace(staleFake);
  const staleTrackId = (await staleBase.value.tracks())[0]!.channelId;
  const staleAt = await staleBase.value.mark();
  await staleBase.value.apply([{
    op: 'clip.create', slot: slot(track(staleTrackId), scene(0, staleAt.sceneEpoch)), lengthBeats: 4,
  }]);
  let injectStale = true;
  const staleWorkspace: Workspace = Object.freeze({
    ...staleBase.value,
    async apply(
      ops: Parameters<Workspace['apply']>[0],
      options?: Parameters<Workspace['apply']>[1],
    ) {
      if (injectStale) {
        injectStale = false;
        control(staleFake).bumpRevision();
      }
      return staleBase.value.apply(ops, options);
    },
  });
  const stale = await callTool(staleWorkspace, 'generate_clip_music', simplePatch(staleTrackId, 0)) as {
    readonly applied: boolean;
    readonly changes: readonly { readonly changeId: string }[];
  };
  assert.equal(stale.applied, false);
  assert.equal(staleBase.stash.log.require(stale.changes[0]!.changeId).take.receipt.stages.length, 0);
  assert.equal(staleFake.model.tracks[0]!.slots[0]!.notes.size, 0);

  const bankFake = new FakeAdapter({ tracks: ['gn-visible'], scenes: 4, trackBankSize: 2 });
  const bank = workspace(bankFake);
  const bankTrack = bankFake.model.tracks[0]!;
  bankFake.model.setSlotContent(bankTrack, 0, true);
  bankTrack.slots[0]!.lengthBeats = 4;
  const beforeBankChanges = bank.stash.log.list().length;
  const refused = await callTool(
    bank.value,
    'generate_clip_music',
    simplePatch(bankTrack.channelId, 0),
  ) as { readonly refused?: boolean; readonly why?: string };
  assert.equal(refused.refused, true);
  assert.match(refused.why ?? '', /outside|address/i);
  assert.equal(bank.stash.log.list().length, beforeBankChanges);
  assert.equal(bankTrack.slots[0]!.notes.size, 0);

  const concurrentFake = new FakeAdapter({ tracks: ['gn-main', 'gn-other'], scenes: 8 });
  let injectConcurrent = false;
  const concurrentAdapter = routedAdapter(
    concurrentFake,
    (refs) => concurrentFake.read(refs),
    async (batch: BatchRequest) => {
      const receipt = await concurrentFake.apply(batch);
      if (injectConcurrent) {
        injectConcurrent = false;
        const other = concurrentFake.model.tracks[1]!;
        concurrentFake.model.setSlotContent(other, 7, true);
        other.slots[7]!.lengthBeats = 4;
      }
      return receipt;
    },
  );
  const concurrent = workspace(concurrentAdapter);
  const concurrentTrackId = concurrentFake.model.tracks[0]!.channelId;
  const concurrentAt = await concurrent.value.mark();
  await concurrent.value.apply([{
    op: 'clip.create',
    slot: slot(track(concurrentTrackId), scene(0, concurrentAt.sceneEpoch)),
    lengthBeats: 4,
  }]);
  injectConcurrent = true;
  const reported = await callTool(
    concurrent.value,
    'generate_clip_music',
    simplePatch(concurrentTrackId, 0),
  ) as { readonly readback: { readonly concurrent: readonly unknown[] } };
  assert.equal(reported.readback.concurrent.length, 1);
});

test('2h cleanup registers an applied generation before checking its readback', async () => {
  const fake = new FakeAdapter({ tracks: ['gn-A', 'gn-B', 'gn-C'], scenes: 8 });
  const setup = workspace(fake);
  const trackIds = (await setup.value.tracks()).map((item) => item.channelId);
  const slots = [
    { trackId: trackIds[0]!, row: 1 },
    { trackId: trackIds[1]!, row: 2 },
    { trackId: trackIds[2]!, row: 3 },
  ] as const;

  await assert.rejects(runPublicMusicalConformance({
    slots,
    change: (changeId) => setup.stash.log.require(changeId),
    async call(name, args = {}) {
      const result = await callTool(setup.value, name, args) as Record<string, unknown>;
      if (name !== 'generate_clip_music') return result;
      const readback = result['readback'] as Record<string, unknown>;
      return { ...result, readback: { ...readback, disagreements: [{ field: 'test' }] } };
    },
  }), /deep-equal/);

  for (const target of slots) {
    const modelTrack = fake.model.tracks.find((item) => item.channelId === target.trackId)!;
    assert.equal(modelTrack.slots[target.row]?.hasContent ?? false, false);
  }
});
