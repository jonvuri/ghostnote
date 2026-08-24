import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { z } from 'zod';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { NATIVE_CATALOG_PATH } from '../composition/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import {
  nativeDeviceInsertionInputSchema, runNativeDeviceInsertion,
} from './native-device-insertion.js';
import { callTool, TOOLS } from './tools.js';
import { workspaceOf, type Workspace } from './workspace.js';

function fixture(): { readonly fake: FakeAdapter; readonly workspace: Workspace; readonly trackId: string } {
  const fake = new FakeAdapter({ tracks: ['Native'], scenes: 1 });
  const trackId = fake.model.visibleTracks()[0]!.channelId;
  const stash = new Stash({ now: () => 1 });
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter: fake,
    executor: new Executor(fake, {
      newId: () => `native-change-${stash.log.list().length + 1}`,
      now: () => 2,
    }),
    stash,
    observationStore: new FakeObservationStore(),
  });
  return { fake, workspace, trackId };
}

test('d02-s6-schema: exact-name insertion exposes no UUID or file controls', () => {
  const tool = TOOLS.find((candidate) => candidate.name === 'add_native_devices');
  assert.ok(tool !== undefined);
  assert.deepEqual(tool.emits, ['device.insert']);
  const schema = JSON.stringify(z.toJSONSchema(z.object(nativeDeviceInsertionInputSchema)));
  for (const hidden of ['uuid', 'guid', 'preset', 'path', 'file', 'asset']) {
    assert.equal(schema.toLowerCase().includes(hidden), false, `${hidden} crossed the schema`);
  }
});

test('d02-s6-public: one exact-name call appends two top-level devices and reverses them', async () => {
  const fx = fixture();
  const result = await callTool(fx.workspace, 'add_native_devices', {
    trackId: fx.trackId,
    deviceNames: ['Polysynth', 'Delay+'],
  }) as Record<string, unknown>;

  assert.equal(result['applied'], true, JSON.stringify(result));
  assert.equal(result['verified'], true);
  assert.equal(result['partialSuccess'], false);
  const added = result['added'] as Array<{
    deviceName: string; position: number; verified: boolean; change: { changeId: string };
  }>;
  assert.deepEqual(added.map(({ deviceName, position, verified }) =>
    ({ deviceName, position, verified })), [
    { deviceName: 'Polysynth', position: 0, verified: true },
    { deviceName: 'Delay+', position: 1, verified: true },
  ]);
  const track = fx.fake.model.findByChannelId(fx.trackId)!.track;
  assert.deepEqual(track.devices.map((device) => device.name), ['Polysynth', 'Delay+']);
  const takes = fx.workspace.changes.list().map((summary) =>
    fx.workspace.changes.get(summary.id)!.take);
  assert.deepEqual(
    takes.reverse().flatMap((take) => take.ops).map((op) =>
      op.op === 'device.insert'
        ? [op.expectedChain, op.expectedEnabledChain, op.expectedDeviceName]
        : []),
    [
      [[], [], 'Polysynth'],
      [['Polysynth'], [true], 'Delay+'],
    ],
  );

  for (const item of [...added].reverse()) {
    const reversed = await callTool(fx.workspace, 'revert_change', {
      changeId: item.change.changeId,
    }) as Record<string, unknown>;
    assert.equal(reversed['applied'], true, JSON.stringify(reversed));
  }
  assert.deepEqual(track.devices, []);
});

test('d02-s6-refusal: all absent and non-unique caller names return before a write', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ghostnote-d02-s6-'));
  try {
    const catalog = JSON.parse(await readFile(NATIVE_CATALOG_PATH, 'utf8')) as {
      devices: Record<string, unknown>[];
    };
    const device = catalog.devices.find((item) => item['name'] === 'Polysynth');
    assert.ok(device !== undefined);
    catalog.devices.push({ ...device });
    const catalogPath = join(directory, 'catalog.json');
    await writeFile(catalogPath, JSON.stringify(catalog));
    const fx = fixture();
    const result = await runNativeDeviceInsertion(fx.workspace, {
      trackId: fx.trackId,
      deviceNames: ['Missing A', 'Polysynth', 'Missing B'],
    }, { catalogPath });
    assert.equal(result['refused'], true);
    assert.equal(result['nothingWasWritten'], true);
    assert.deepEqual(result['failedDeviceNames'], [
      { deviceName: 'Missing A', reason: 'absent', exactMatches: 0 },
      { deviceName: 'Polysynth', reason: 'non-unique', exactMatches: 2 },
      { deviceName: 'Missing B', reason: 'absent', exactMatches: 0 },
    ]);
    assert.equal(fx.workspace.changes.list().length, 0);
    assert.deepEqual(fx.fake.model.findByChannelId(fx.trackId)!.track.devices, []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('d02-s6-reversal: complete top-level drift blocks exact-name removal', async () => {
  const fx = fixture();
  const result = await callTool(fx.workspace, 'add_native_devices', {
    trackId: fx.trackId,
    deviceNames: ['Polysynth', 'Delay+'],
  }) as { added: Array<{ change: { changeId: string } }> };
  const track = fx.fake.model.findByChannelId(fx.trackId)!.track;
  track.devices.push({ name: 'Human device', paramsLive: true, params: [] });

  const reversed = await callTool(fx.workspace, 'revert_change', {
    changeId: result.added[1]!.change.changeId,
  }) as Record<string, unknown>;
  assert.match(
    ((reversed['failed'] as { error?: string }[] | undefined)?.[0]?.error ?? ''),
    /device chain changed/,
  );
  assert.deepEqual(track.devices.map((device) => device.name), [
    'Polysynth', 'Delay+', 'Human device',
  ]);
});

test('d02-s6-classification: a failed first explicit insertion is not partial success', async () => {
  const fx = fixture();
  const base = fx.workspace;
  const workspace: Workspace = Object.freeze({
    ...base,
    async apply(
      ops: Parameters<Workspace['apply']>[0],
      options?: Parameters<Workspace['apply']>[1],
    ) {
      const change = await base.apply(ops, options);
      fx.fake.model.findByChannelId(fx.trackId)!.track.devices.pop();
      return {
        ...change,
        take: {
          ...change.take,
          receipt: { ...change.take.receipt, minted: {} },
          report: {
            ...change.take.report,
            applied: true,
            failed: [{ op: 'device.insert', ok: false, error: 'fixture insertion did not land' }],
          },
        },
      };
    },
  });

  const result = await callTool(workspace, 'add_device', { devices: [{
    trackId: fx.trackId,
    from: 'bitwig',
    id: 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef',
  }] }) as Record<string, unknown>;
  assert.equal(result['applied'], false);
  assert.equal(result['partialSuccess'], false);
  assert.deepEqual(result['added'], []);
  assert.equal((result['changes'] as unknown[]).length, 1);
});
