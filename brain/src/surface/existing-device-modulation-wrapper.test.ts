import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { z } from 'zod';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { listModulators } from '../bwmod/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import {
  existingDeviceModulationWrapperInputSchema,
} from './existing-device-modulation-wrapper.js';
import { callTool, TOOLS } from './tools.js';
import { workspaceOf, type Workspace } from './workspace.js';

function fixture() {
  const fake = new FakeAdapter({ tracks: ['Wrapper'], scenes: 1 });
  const row = fake.model.visibleTracks()[0]!;
  const target = {
    name: 'Polysynth', enabled: true, paramsLive: true,
    params: [{
      id: 'CONTENTS/F1FREQ', name: 'Filter Frequency', value: 0.31,
      modulatedValue: 0.31, hasAutomation: false,
    }],
  };
  row.devices.push(target, {
    name: 'Tool', enabled: false, paramsLive: true,
    params: [{ id: 'CONTENTS/P1', name: 'Gain', value: 0.5 }],
  });
  const stash = new Stash({ now: () => 1 });
  const base = workspaceOf({
    ready: async () => undefined,
    adapter: fake,
    executor: new Executor(fake, {
      newId: () => `public-wrapper-${stash.log.list().length + 1}`,
      now: () => 2,
    }),
    stash,
    observationStore: new FakeObservationStore(),
  });
  let preset: Buffer | undefined;
  const workspace: Workspace = Object.freeze({
    ...base,
    async apply(
      ops: Parameters<Workspace['apply']>[0],
      run?: Parameters<Workspace['apply']>[1],
    ) {
      const op = ops[0];
      if (op?.op === 'device.insert' && op.source.from === 'file') {
        preset = await readFile(op.source.path);
      }
      const change = await base.apply(ops, run);
      if (op?.op === 'device.insert' && preset !== undefined) {
        const minted = change.take.receipt.minted[0];
        if (minted?.kind === 'device') {
          const container = row.devices[minted.chainIndex]!;
          const modulators = listModulators(preset, 0);
          container.name = 'FX Layer';
          container.paramsLive = true;
          container.chains = [{
            name: 'Layer 1', id: fake.model.mintChannelId(), solo: false, devices: [],
          }];
          container.remotePages = modulators.map((item) => ({
            name: item.deviceName,
            controls: [{ name: 'Rate', value: 0.5, modulatedValue: 0.5, hasAutomation: false }],
          }));
        }
      }
      if (op?.op === 'chain.relocate' && op.destination.kind === 'chain') {
        const container = row.devices.find((item) => item.name === 'FX Layer')!;
        const nested = container.chains![0]!.devices[0]!;
        nested.params[0]!.modulatedValue = 0.7;
      }
      return change;
    },
  });
  return { row, target, trackId: row.channelId, workspace };
}

const request = (trackId: string) => ({
  trackId,
  devicePosition: 0,
  expectedDeviceOrder: [
    { name: 'Polysynth', enabled: true },
    { name: 'Tool', enabled: false },
  ],
  containerKind: 'FX Layer',
  entryName: 'Layer 1',
  modulators: [{
    modulator: 'lfo',
    target: { parameterId: 'CONTENTS/F1FREQ', parameterName: 'Filter Frequency' },
    amount: 1,
  }],
});

test('5p-schema: the wrapper exposes proved names and hides asset mechanics', () => {
  const wrap = TOOLS.find((item) => item.name === 'wrap_existing_device_modulation');
  const reverse = TOOLS.find((item) => item.name === 'reverse_existing_device_modulation_wrap');
  assert.equal(wrap?.kind, 'write');
  assert.deepEqual(wrap?.emits, [
    'device.insert', 'device.relocate', 'chain.rename', 'chain.relocate',
  ]);
  assert.equal(reverse?.kind, 'write');
  assert.deepEqual(reverse?.emits, ['chain.relocate', 'device.relocate', 'device.delete']);
  const schema = JSON.stringify(z.toJSONSchema(z.object(existingDeviceModulationWrapperInputSchema)));
  for (const hidden of ['presetPath', 'templatePath', 'uuid', 'guid', 'donorId', 'route', 'listIndex', 'offset']) {
    assert.equal(schema.includes(hidden), false, `${hidden} crossed the public schema`);
  }
  assert.match(schema, /FX Layer/);
  assert.match(schema, /Layer 1/);
});

test('5p-public: one ordered receipt preserves the instance and reverses through its checkpoint', async () => {
  const fx = fixture();
  const wrapped = await callTool(
    fx.workspace, 'wrap_existing_device_modulation', request(fx.trackId),
  ) as Record<string, unknown>;
  assert.equal(wrapped['complete'], true, JSON.stringify(wrapped));
  assert.equal(wrapped['partialCompletion'], false);
  assert.deepEqual((wrapped['stages'] as { stage: string }[]).map((item) => item.stage), [
    'insert-container', 'position-container', 'prepare-entry-name',
    'confirm-entry-name', 'relocate-device',
  ]);
  const verification = wrapped['verification'] as {
    preservedOpaqueState: boolean;
    opaqueStateQualification: string;
    scalarFingerprint: { preserved: boolean };
  };
  assert.equal(verification.preservedOpaqueState, true);
  assert.equal(verification.scalarFingerprint.preserved, true);
  assert.match(verification.opaqueStateQualification, /not read back byte for byte/);
  assert.equal(fx.row.devices[0]!.chains![0]!.devices[0], fx.target);

  const reversed = await callTool(fx.workspace, 'reverse_existing_device_modulation_wrap', {
    checkpoint: wrapped['reversalCheckpoint'],
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));
  assert.equal(reversed['containerRemoved'], true);
  assert.equal(reversed['restoredDeviceOrder'], true);
  assert.deepEqual(fx.row.devices.map((item) => [item.name, item.enabled]), [
    ['Polysynth', true], ['Tool', false],
  ]);
  assert.equal(fx.row.devices[0], fx.target);
});

test('5s-public: the wrapper replaces a second-position device in place', async () => {
  const fx = fixture();
  const [target, instrument] = fx.row.devices;
  fx.row.devices.splice(0, 2, instrument!, target!);
  const input = {
    ...request(fx.trackId),
    devicePosition: 1,
    expectedDeviceOrder: [
      { name: 'Tool', enabled: false },
      { name: 'Polysynth', enabled: true },
    ],
  };
  const wrapped = await callTool(
    fx.workspace, 'wrap_existing_device_modulation', input,
  ) as Record<string, unknown>;

  assert.equal(wrapped['complete'], true, JSON.stringify(wrapped));
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Tool', 'FX Layer']);
  assert.equal(fx.row.devices[1]!.chains![0]!.devices[0], fx.target);
  assert.equal(
    (wrapped['reversalCheckpoint'] as { currentContainerPosition: number })
      .currentContainerPosition,
    1,
  );

  const reversed = await callTool(fx.workspace, 'reverse_existing_device_modulation_wrap', {
    checkpoint: wrapped['reversalCheckpoint'],
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Tool', 'Polysynth']);
  assert.equal(fx.row.devices[1], fx.target);
});

test('5p-public: a post-insertion read error returns a reversible partial result', async () => {
  const fx = fixture();
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async read(addresses: Parameters<Workspace['read']>[0]) {
      if (fx.workspace.changes.list().length > 0) {
        throw new Error('the post-write inventory disconnected');
      }
      return fx.workspace.read(addresses);
    },
  });
  const wrapped = await callTool(
    workspace, 'wrap_existing_device_modulation', request(fx.trackId),
  ) as Record<string, unknown>;

  assert.equal(wrapped['complete'], false);
  assert.equal(wrapped['partialCompletion'], true);
  assert.match(String(wrapped['why']), /post-write inventory disconnected/);
  assert.deepEqual(wrapped['currentLocation'], { kind: 'unknown' });
  assert.equal(
    (wrapped['reversalCheckpoint'] as { state: string }).state,
    'container-inserted',
  );

  const reversed = await callTool(fx.workspace, 'reverse_existing_device_modulation_wrap', {
    checkpoint: wrapped['reversalCheckpoint'],
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Polysynth', 'Tool']);
});

test('5p-public: a forged insertion change refuses reversal before any write', async () => {
  const fx = fixture();
  const wrapped = await callTool(
    fx.workspace, 'wrap_existing_device_modulation', request(fx.trackId),
  ) as Record<string, unknown>;
  const checkpoint = {
    ...(wrapped['reversalCheckpoint'] as Record<string, unknown>),
    containerInsertChangeId: 'not-this-session',
  };
  const before = fx.workspace.changes.list().length;
  const result = await callTool(fx.workspace, 'reverse_existing_device_modulation_wrap', {
    checkpoint,
  }) as Record<string, unknown>;
  assert.equal(result['refused'], true);
  assert.equal(result['nothingWasWritten'], true);
  assert.equal(fx.workspace.changes.list().length, before);
  assert.equal(fx.row.devices[0]!.chains![0]!.devices[0], fx.target);
});

test('5p-public: changed fields on a valid checkpoint cannot delete another FX Layer', async () => {
  const fx = fixture();
  const wrapped = await callTool(
    fx.workspace, 'wrap_existing_device_modulation', request(fx.trackId),
  ) as Record<string, unknown>;
  const unrelated = {
    name: 'FX Layer', enabled: true, paramsLive: true, params: [],
    chains: [{
      name: 'Layer 1', id: fx.workspace.changes.list()[0]!.id,
      solo: false, devices: [],
    }],
  };
  fx.row.devices.splice(1, 0, unrelated);
  const checkpoint = {
    ...(wrapped['reversalCheckpoint'] as Record<string, unknown>),
    state: 'container-positioned',
    currentContainerPosition: 1,
    originalDeviceOrder: [
      { name: 'FX Layer', enabled: true },
      { name: 'Tool', enabled: false },
    ],
  };
  const before = fx.workspace.changes.list().length;
  const result = await callTool(fx.workspace, 'reverse_existing_device_modulation_wrap', {
    checkpoint,
  }) as Record<string, unknown>;

  assert.equal(result['refused'], true);
  assert.equal(result['nothingWasWritten'], true);
  assert.match(String(result['why']), /exact value issued/);
  assert.equal(fx.workspace.changes.list().length, before);
  assert.equal(fx.row.devices[1], unrelated);
});
