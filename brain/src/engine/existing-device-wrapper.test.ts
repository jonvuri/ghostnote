import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { listModulators } from '../bwmod/index.js';
import { track } from '../contract/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { workspaceOf, type Workspace } from '../surface/workspace.js';
import { Executor } from './executor.js';
import {
  reverseExistingDeviceModulation, wrapExistingDeviceModulation,
} from './existing-device-wrapper.js';

const TARGET = {
  modulator: 'lfo',
  target: { parameterId: 'CONTENTS/F1FREQ', parameterName: 'Filter Frequency' },
  amount: 1,
};

function fixture(options: {
  readonly active?: boolean;
  readonly tail?: boolean;
  readonly occupied?: boolean;
  readonly missingEntry?: boolean;
  readonly interfereAfterExtraction?: boolean;
} = {}) {
  const fake = new FakeAdapter({ tracks: ['Wrapper'], scenes: 1 });
  const row = fake.model.visibleTracks()[0]!;
  const target = {
    name: 'Polysynth', enabled: false, paramsLive: true,
    params: [{
      id: 'CONTENTS/F1FREQ', name: 'Filter Frequency', value: 0.37,
      modulatedValue: 0.37, hasAutomation: false,
    }],
  };
  row.devices.push(target);
  if (!options.tail) {
    row.devices.push({
      name: 'Tool', enabled: true, paramsLive: true,
      params: [{ id: 'CONTENTS/P1', name: 'Gain', value: 0.5 }],
    });
  }
  const stash = new Stash({ now: () => 1 });
  const base = workspaceOf({
    ready: async () => undefined,
    adapter: fake,
    executor: new Executor(fake, {
      newId: () => `wrapper-change-${stash.log.list().length + 1}`,
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
      const insert = ops[0];
      if (insert?.op === 'device.insert' && insert.source.from === 'file') {
        preset = await readFile(insert.source.path);
      }
      const change = await base.apply(ops, run);
      if (insert?.op === 'device.insert' && preset !== undefined) {
        const minted = change.take.receipt.minted[0];
        if (minted?.kind === 'device') {
          const container = row.devices[minted.chainIndex]!;
          const modulators = listModulators(preset, 0);
          container.name = 'FX Layer';
          container.paramsLive = true;
          container.chains = options.missingEntry ? [] : [{
            name: 'Layer 1', id: fake.model.mintChannelId(), solo: false,
            devices: options.occupied ? [{
              name: 'Occupied', enabled: true, paramsLive: true, params: [],
            }] : [],
          }];
          container.remotePages = modulators.map((item) => ({
            name: item.deviceName,
            controls: [{ name: 'Rate', value: 0.5, modulatedValue: 0.5, hasAutomation: false }],
          }));
        }
      }
      if (insert?.op === 'chain.relocate' && insert.destination.kind === 'chain'
          && options.active !== false && preset !== undefined) {
        const container = row.devices.find((item) => item.name === 'FX Layer')!;
        const nested = container.chains![0]!.devices[0]!;
        nested.params[0]!.modulatedValue = 0.72;
      }
      if (insert?.op === 'chain.relocate' && insert.destination.kind === 'track'
          && options.interfereAfterExtraction) {
        row.devices[0]!.chains![0]!.devices.push({
          name: 'Interference', enabled: true, paramsLive: true, params: [],
        });
      }
      return change;
    },
  });
  return { fake, workspace, row, target, track: track(row.channelId) };
}

test('5p-workflow: native FX wraps, preserves its scalar fingerprint, and reverses exactly', async () => {
  const fx = fixture();
  const result = await wrapExistingDeviceModulation(fx.workspace, {
    track: fx.track,
    devicePosition: 0,
    expectedDeviceOrder: [
      { name: 'Polysynth', enabled: false },
      { name: 'Tool', enabled: true },
    ],
    containerKind: 'FX Layer',
    entryName: 'Layer 1',
    modulators: [TARGET],
  }, { wait: async () => undefined });

  assert.equal(result.complete, true, JSON.stringify(result));
  assert.deepEqual(result.stages.map((item) => item.stage), [
    'insert-container', 'position-container', 'prepare-entry-name',
    'confirm-entry-name', 'relocate-device',
  ]);
  assert.equal(result.verification?.scalarFingerprint.preserved, true);
  assert.equal(result.verification?.preservedOpaqueState, true);
  assert.match(result.verification?.opaqueStateQualification ?? '', /not read back byte for byte/);
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['FX Layer', 'Tool']);
  assert.equal(fx.row.devices[0]!.chains![0]!.devices[0], fx.target);

  const reversed = await reverseExistingDeviceModulation(fx.workspace, result.checkpoint!);
  assert.equal(reversed.complete, true, JSON.stringify(reversed));
  assert.deepEqual(reversed.stages.map((item) => item.stage), [
    'relocate-device', 'restore-position', 'remove-container',
  ]);
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Polysynth', 'Tool']);
  assert.equal(fx.row.devices[0], fx.target);
  assert.equal(fx.row.devices[0]!.params[0]!.value, 0.37);
  assert.equal(fx.row.devices[0]!.enabled, false);
});

test('5p-workflow: a plug-in-shaped inventory wraps and tail reversal needs no reorder', async () => {
  const fx = fixture({ tail: true });
  fx.row.devices[0]!.name = 'Zebra3';
  fx.row.devices[0]!.params = [{
    id: 'CONTENTS/PID411', name: 'Cutoff', value: 0.42,
    modulatedValue: 0.42, hasAutomation: false,
  }];
  const result = await wrapExistingDeviceModulation(fx.workspace, {
    track: fx.track,
    devicePosition: 0,
    expectedDeviceOrder: [{ name: 'Zebra3', enabled: false }],
    containerKind: 'FX Layer',
    entryName: 'Layer 1',
    modulators: [{
      modulator: 'lfo',
      target: { parameterId: 'CONTENTS/PID411', parameterName: 'Cutoff' },
      amount: 0.5,
    }],
  }, { wait: async () => undefined });
  assert.equal(result.complete, true, JSON.stringify(result));
  const reversed = await reverseExistingDeviceModulation(fx.workspace, result.checkpoint!);
  assert.equal(reversed.complete, true, JSON.stringify(reversed));
  assert.deepEqual(reversed.stages.map((item) => item.stage), ['relocate-device', 'remove-container']);
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Zebra3']);
});

test('5p-guard: stale order and a changed target inventory refuse before insertion', async () => {
  const fx = fixture();
  await assert.rejects(
    wrapExistingDeviceModulation(fx.workspace, {
      track: fx.track,
      devicePosition: 0,
      expectedDeviceOrder: [{ name: 'Wrong', enabled: false }, { name: 'Tool', enabled: true }],
      containerKind: 'FX Layer', entryName: 'Layer 1', modulators: [TARGET],
    }),
    /stale/,
  );
  assert.equal(fx.workspace.changes.list().length, 0);

  fx.row.devices[0]!.params[0]!.name = 'Changed';
  await assert.rejects(
    wrapExistingDeviceModulation(fx.workspace, {
      track: fx.track,
      devicePosition: 0,
      expectedDeviceOrder: [
        { name: 'Polysynth', enabled: false }, { name: 'Tool', enabled: true },
      ],
      containerKind: 'FX Layer', entryName: 'Layer 1', modulators: [TARGET],
    }),
    /missing or changed name/,
  );
  assert.equal(fx.workspace.changes.list().length, 0);
});

test('5p-guard: unstable inventory refuses before insertion; missing or occupied entry stops relocation', async () => {
  const unstable = fixture();
  unstable.fake.model.staleParameterInventories = 1;
  await assert.rejects(
    wrapExistingDeviceModulation(unstable.workspace, {
      track: unstable.track,
      devicePosition: 0,
      expectedDeviceOrder: [
        { name: 'Polysynth', enabled: false }, { name: 'Tool', enabled: true },
      ],
      containerKind: 'FX Layer', entryName: 'Layer 1', modulators: [TARGET],
    }),
    /unstable/,
  );
  assert.equal(unstable.workspace.changes.list().length, 0);

  for (const fx of [fixture({ occupied: true }), fixture({ missingEntry: true })]) {
    const result = await wrapExistingDeviceModulation(fx.workspace, {
      track: fx.track,
      devicePosition: 0,
      expectedDeviceOrder: [
        { name: 'Polysynth', enabled: false }, { name: 'Tool', enabled: true },
      ],
      containerKind: 'FX Layer', entryName: 'Layer 1', modulators: [TARGET],
    }, { wait: async () => undefined });
    assert.equal(result.complete, false);
    assert.equal(result.failedStage, 'container-witness');
    assert.deepEqual(result.stages.map((item) => item.stage), [
      'insert-container', 'position-container',
    ]);
    assert.deepEqual(fx.row.devices.map((item) => item.name), ['FX Layer', 'Polysynth', 'Tool']);
  }
});

test('5p-partial: failed behavior keeps the device reachable and reversal remains available', async () => {
  const fx = fixture({ active: false });
  const result = await wrapExistingDeviceModulation(fx.workspace, {
    track: fx.track,
    devicePosition: 0,
    expectedDeviceOrder: [
      { name: 'Polysynth', enabled: false }, { name: 'Tool', enabled: true },
    ],
    containerKind: 'FX Layer', entryName: 'Layer 1', modulators: [TARGET],
  }, { wait: async () => undefined });
  assert.equal(result.complete, false);
  assert.equal(result.failedStage, 'post-move-witness');
  assert.deepEqual(result.currentLocation, {
    kind: 'container-entry', containerPosition: 0, entryName: 'Layer 1', devicePosition: 0,
  });
  assert.ok(result.checkpoint);
  const reversed = await reverseExistingDeviceModulation(fx.workspace, result.checkpoint!);
  assert.equal(reversed.complete, true, JSON.stringify(reversed));
});

test('5p-reversal: scalar interference refuses before the device moves or container is removed', async () => {
  const fx = fixture();
  const result = await wrapExistingDeviceModulation(fx.workspace, {
    track: fx.track,
    devicePosition: 0,
    expectedDeviceOrder: [
      { name: 'Polysynth', enabled: false }, { name: 'Tool', enabled: true },
    ],
    containerKind: 'FX Layer', entryName: 'Layer 1', modulators: [TARGET],
  }, { wait: async () => undefined });
  const container = fx.row.devices[0]!;
  container.chains![0]!.devices[0]!.params[0]!.value = 0.99;
  const reversed = await reverseExistingDeviceModulation(fx.workspace, result.checkpoint!);
  assert.equal(reversed.complete, false);
  assert.equal(reversed.failedStage, 'reversal-boundary');
  assert.equal(reversed.containerRemoved, false);
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['FX Layer', 'Tool']);
  assert.equal(container.chains![0]!.devices[0]!.name, 'Polysynth');
});

test('5p-reversal: interference after extraction is a loud partial reversal and keeps the container', async () => {
  const fx = fixture({ interfereAfterExtraction: true });
  const result = await wrapExistingDeviceModulation(fx.workspace, {
    track: fx.track,
    devicePosition: 0,
    expectedDeviceOrder: [
      { name: 'Polysynth', enabled: false }, { name: 'Tool', enabled: true },
    ],
    containerKind: 'FX Layer', entryName: 'Layer 1', modulators: [TARGET],
  }, { wait: async () => undefined });
  assert.equal(result.complete, true);
  const reversed = await reverseExistingDeviceModulation(fx.workspace, result.checkpoint!);
  assert.equal(reversed.complete, false);
  assert.equal(reversed.failedStage, 'relocate-device');
  assert.deepEqual(reversed.stages.map((item) => item.stage), ['relocate-device']);
  assert.equal(reversed.containerRemoved, false);
  assert.equal(fx.row.devices[0]!.name, 'FX Layer');
  assert.equal(fx.row.devices[0]!.chains![0]!.devices[0]!.name, 'Interference');
  assert.equal(fx.row.devices.at(-1), fx.target);
});
