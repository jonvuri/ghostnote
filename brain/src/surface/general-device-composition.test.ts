import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { z } from 'zod';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { listChains, listModulators } from '../bwmod/index.js';
import { Executor, fingerprintPreset, inspectPresetModulation } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callTool, TOOLS } from './tools.js';
import {
  generalDeviceCompositionInputSchema,
} from './general-device-composition.js';
import { workspaceOf, type Workspace } from './workspace.js';

const PRESET = join(import.meta.dirname, '..', '..', 'fixtures', 'Polysynth', 'mp_bare.bwpreset');
const NESTED_PRESET = join(
  import.meta.dirname, '..', '..', 'fixtures', 'InstrumentLayer', 'gn_layer_4chain.bwpreset',
);
const SAMPLED_PRESET = join(
  import.meta.dirname, '..', '..', 'fixtures', 'Sampler', 'gn_sampler_multi_bare.bwpreset',
);

function fixture() {
  const fake = new FakeAdapter({ tracks: ['Composition'], scenes: 1 });
  const row = fake.model.visibleTracks()[0]!;
  const existing = {
    name: 'Existing Twin', enabled: true, paramsLive: true,
    params: [{
      id: 'CONTENTS/F1FREQ', name: 'Filter Frequency', value: 0.31,
      modulatedValue: 0.31, hasAutomation: false,
    }],
  };
  row.devices.push(existing, {
    name: 'Tool', enabled: false, paramsLive: true,
    params: [{
      id: 'CONTENTS/F1FREQ', name: 'Filter Frequency', value: 0.4,
      modulatedValue: 0.4, hasAutomation: false,
    }],
  });
  const stash = new Stash({ now: () => 1 });
  const base = workspaceOf({
    ready: async () => undefined,
    adapter: fake,
    executor: new Executor(fake, {
      newId: () => `general-${stash.log.list().length + 1}`,
      now: () => 2,
    }),
    stash,
    observationStore: new FakeObservationStore(),
  });
  const workspace: Workspace = Object.freeze({
    ...base,
    async apply(
      ops: Parameters<Workspace['apply']>[0],
      run?: Parameters<Workspace['apply']>[1],
    ) {
      const op = ops[0];
      let preset: Buffer | undefined;
      if (op?.op === 'device.insert' && op.source.from === 'file') {
        preset = await readFile(op.source.path);
      }
      const change = await base.apply(ops, run);
      if (op?.op === 'device.insert') {
        const minted = change.take.receipt.minted[0];
        if (minted?.kind === 'device') {
          const inserted = row.devices[minted.chainIndex]!;
          if ((op.expectedDeviceName === 'FX Layer'
              || op.expectedDeviceName === 'Instrument Layer') && preset !== undefined) {
            inserted.name = op.expectedDeviceName;
            inserted.paramsLive = true;
            inserted.params = [];
            inserted.chains = listChains(preset).map((_, index) => ({
              name: `Observed seed ${index + 1}`,
              id: fake.model.mintChannelId(), solo: false, devices: [],
            }));
            inserted.remotePages = listModulators(preset, 0).map((item) => ({
              name: item.deviceName,
              controls: [{ name: 'Rate', value: 0.5, modulatedValue: 0.5, hasAutomation: false }],
            }));
          } else if (op.expectedDeviceName === 'Chain' && preset !== undefined) {
            inserted.name = 'Chain';
            inserted.paramsLive = true;
            inserted.params = [];
            inserted.deviceSlots = { CHAIN: [] };
            inserted.remotePages = listModulators(preset, 0).map((item) => ({
              name: item.deviceName,
              controls: [{ name: 'Rate', value: 0.5, modulatedValue: 0.5, hasAutomation: false }],
            }));
          } else {
            if (op.source.from === 'vst3' || op.source.from === 'clap') inserted.name = 'Repeated Twin';
            inserted.paramsLive = true;
            const sampler = op.source.from === 'file' && op.source.path.includes('gn_sampler');
            const inspection = preset === undefined ? undefined : inspectPresetModulation(preset);
            if (preset !== undefined && inspection?.supported && inspection.containerKind !== null) {
              const containerPreset = preset;
              inserted.name = inspection.host.name;
              inserted.params = [];
              inserted.chains = inspection.entries.map((entry, entryIndex) => ({
                name: entry.devices[0]?.name ?? entry.name,
                id: fake.model.mintChannelId(), solo: false,
                devices: entry.devices.map((entryDevice) => {
                  const modulators = listModulators(containerPreset, entryIndex + 1);
                  const targetId = entryDevice.name === 'Phase-4'
                    ? 'CONTENTS/PITCH' : 'CONTENTS/F1FREQ';
                  const targetName = entryDevice.name === 'Phase-4'
                    ? 'Pitch' : 'Filter Frequency';
                  const active = modulators.some((modulator) =>
                    modulator.routes.some((route) => route.target === targetId));
                  return {
                    name: entryDevice.name, enabled: true, paramsLive: true,
                    params: [{
                      id: targetId, name: targetName, value: 0.31,
                      modulatedValue: active ? 0.72 : 0.31, hasAutomation: false,
                    }],
                    remotePages: [{
                      name: 'FILTER',
                      controls: [{
                        name: 'Filt Freq', value: 0.31,
                        modulatedValue: active ? 0.72 : 0.31, hasAutomation: false,
                      }],
                    }, ...modulators.map((modulator) => ({
                      name: modulator.deviceName,
                      controls: [{
                        name: 'Rate', value: 0.5, modulatedValue: 0.5, hasAutomation: false,
                      }],
                    }))],
                  };
                }),
              }));
              inserted.remotePages = listModulators(containerPreset, 0).map((item) => ({
                name: item.deviceName,
                controls: [{ name: 'Rate', value: 0.5, modulatedValue: 0.5, hasAutomation: false }],
              }));
            } else {
              inserted.params = [{
                id: sampler ? 'CONTENTS/AMP_ATTACK_TIME' : 'CONTENTS/F1FREQ',
                name: sampler ? 'AEG Attack Time' : 'Filter Frequency', value: 0.31,
                modulatedValue: 0.31, hasAutomation: false,
              }];
            }
            if (preset !== undefined && inserted.remotePages === undefined) {
              inserted.remotePages = listModulators(preset).map((item) => ({
                name: item.deviceName,
                controls: [{ name: 'Rate', value: 0.5, modulatedValue: 0.5, hasAutomation: false }],
              }));
            }
          }
        }
      }
      if (op?.op === 'chain.relocate' && op.destination.kind === 'chain') {
        const destination = op.destination;
        const container = row.devices.find((item) =>
          item.chains?.some((entry) => entry.name === destination.name))!;
        const entry = container.chains!.find((item) => item.name === destination.name)!;
        const nested = entry.devices[entry.devices.length - 1]!;
        const target = nested.chains?.[0]?.devices[0] ?? nested;
        target.paramsLive = true;
        target.params[0]!.modulatedValue = 0.72;
        target.params[0]!.hasAutomation = false;
      }
      if (op?.op === 'chain.relocate' && op.destination.kind === 'deviceSlot') {
        const destination = op.destination;
        const container = row.devices.find((item) => item.deviceSlots?.[destination.name] !== undefined)!;
        const nested = container.deviceSlots![destination.name]!.at(-1)!;
        nested.paramsLive = true;
        nested.params[0]!.modulatedValue = 0.72;
        nested.params[0]!.hasAutomation = false;
      }
      return change;
    },
  });
  return { existing, fake, row, trackId: row.channelId, workspace };
}

const outer = {
  location: 'container', modulator: 'lfo',
  target: { parameterId: 'CONTENTS/F1FREQ', parameterName: 'Filter Frequency' },
  amount: 1,
} as const;

function fourSourceRequest(trackId: string) {
  return {
    trackId,
    expectedDeviceOrder: [
      { name: 'Existing Twin', enabled: true },
      { name: 'Tool', enabled: false },
    ],
    containerKind: 'FX Layer',
    entries: [
      { entryName: 'Native', source: { kind: 'native', name: 'Polysynth' }, modulators: [outer] },
      {
        entryName: 'VST3', source: { kind: 'vst3', classUid: 'D39D5B69D6AF42FA123456785A334D44' },
        modulators: [],
      },
      { entryName: 'CLAP', source: { kind: 'clap', id: 'com.u-he.Zebra3' }, modulators: [] },
      { entryName: 'Sampled preset', source: { kind: 'preset', path: PRESET }, modulators: [] },
    ],
  };
}

test('5q-schema: all explicit source kinds are public and asset mechanics stay hidden', () => {
  const compose = TOOLS.find((item) => item.name === 'compose_device_sources');
  const reverse = TOOLS.find((item) => item.name === 'reverse_device_source_composition');
  assert.equal(compose?.kind, 'write');
  assert.deepEqual(compose?.emits, [
    'device.insert', 'device.relocate', 'chain.rename', 'chain.relocate',
  ]);
  assert.equal(reverse?.kind, 'write');
  const schema = JSON.stringify(z.toJSONSchema(z.object(generalDeviceCompositionInputSchema)));
  for (const kind of ['native', 'vst3', 'clap', 'preset', 'existing-move', 'existing-copy']) {
    assert.match(schema, new RegExp(kind));
  }
  for (const hidden of ['uuid', 'donorId', 'route', 'listIndex', 'offset']) {
    assert.equal(schema.includes(hidden), false, `${hidden} crossed the public schema`);
  }
});

test('5q-public: four new source classes compose in caller order and reverse exactly', async () => {
  const fx = fixture();
  const result = await callTool(
    fx.workspace, 'compose_device_sources', fourSourceRequest(fx.trackId),
  ) as Record<string, unknown>;
  assert.equal(result['complete'], true, JSON.stringify(result));
  const structure = result['structure'] as { entryName: string; devices: { name: string }[] }[];
  assert.deepEqual(structure.map((item) => item.entryName), [
    'Native', 'VST3', 'CLAP', 'Sampled preset',
  ]);
  assert.deepEqual(structure.slice(1, 3).map((item) => item.devices[0]!.name), [
    'Repeated Twin', 'Repeated Twin',
  ]);
  const entries = result['entries'] as {
    sourceIdentity: { presetMetadataName?: string; nameMatchesPresetMetadata?: boolean };
  }[];
  assert.equal(entries[3]?.sourceIdentity.presetMetadataName, 'Polysynth');
  assert.equal(entries[3]?.sourceIdentity.nameMatchesPresetMetadata, false);
  const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint: result['reversalCheckpoint'],
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));
  assert.equal(reversed['containerRemoved'], true);
  assert.deepEqual(fx.row.devices.map((item) => [item.name, item.enabled]), [
    ['Existing Twin', true], ['Tool', false],
  ]);
  assert.equal(fx.row.devices[0], fx.existing);
});

test('5q-copy: a copied existing source is a new instance and reversal keeps the original', async () => {
  const fx = fixture();
  const result = await callTool(fx.workspace, 'compose_device_sources', {
    trackId: fx.trackId,
    expectedDeviceOrder: [
      { name: 'Existing Twin', enabled: true }, { name: 'Tool', enabled: false },
    ],
    containerKind: 'FX Layer',
    entries: [{
      entryName: 'Copy', source: { kind: 'existing-copy', devicePosition: 0 }, modulators: [outer],
    }],
  }) as Record<string, unknown>;
  assert.equal(result['complete'], true, JSON.stringify(result));
  const entry = (result['entries'] as { instance: string; stateClaim: string }[])[0]!;
  assert.equal(entry.instance, 'new');
  assert.match(entry.stateClaim, /No state-identity claim/);
  assert.notEqual(fx.row.devices[0]!.chains![0]!.devices[0], fx.existing);

  const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint: result['reversalCheckpoint'],
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Existing Twin', 'Tool']);
  assert.equal(fx.row.devices[0], fx.existing);
});

test('5q-move: an existing move preserves the exact instance and scalar fingerprint', async () => {
  const fx = fixture();
  const result = await callTool(fx.workspace, 'compose_device_sources', {
    trackId: fx.trackId,
    expectedDeviceOrder: [
      { name: 'Existing Twin', enabled: true }, { name: 'Tool', enabled: false },
    ],
    containerKind: 'FX Layer',
    entries: [{
      entryName: 'Moved', source: { kind: 'existing-move', devicePosition: 0 }, modulators: [outer],
    }],
  }) as Record<string, unknown>;
  assert.equal(result['complete'], true, JSON.stringify(result));
  const entry = (result['entries'] as {
    instance: string; stateClaim: string; scalarFingerprint: { preserved: boolean };
  }[])[0]!;
  assert.equal(entry.instance, 'preserved');
  assert.equal(entry.scalarFingerprint.preserved, true);
  assert.match(entry.stateClaim, /same device instance/);
  assert.equal(fx.row.devices[0]!.chains![0]!.devices[0], fx.existing);

  const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint: result['reversalCheckpoint'],
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));
  assert.equal(fx.row.devices[0], fx.existing);
});

test('5q-witness: one transient parameter sample retries the complete active proof', async () => {
  const fx = fixture();
  let parameterReads = 0;
  let dropped = false;
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async read(addresses: Parameters<Workspace['read']>[0]) {
      const snapshot = await fx.workspace.read(addresses);
      if (addresses[0]?.kind === 'param' && ++parameterReads === 5) {
        dropped = true;
        return { ...snapshot, entries: {}, unstable: addresses };
      }
      return snapshot;
    },
  });
  const result = await callTool(workspace, 'compose_device_sources', {
    trackId: fx.trackId,
    expectedDeviceOrder: [
      { name: 'Existing Twin', enabled: true }, { name: 'Tool', enabled: false },
    ],
    containerKind: 'FX Layer',
    entries: [{
      entryName: 'Copy', source: { kind: 'existing-copy', devicePosition: 0 }, modulators: [outer],
    }],
  }) as Record<string, unknown>;
  assert.equal(dropped, true);
  assert.equal(result['complete'], true, JSON.stringify(result));

  const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint: result['reversalCheckpoint'],
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));
});

test('5q-preset-local: sampled preset modulation keeps semantic and sample-reference proof', async () => {
  const fx = fixture();
  const bytes = await readFile(SAMPLED_PRESET);
  const result = await callTool(fx.workspace, 'compose_device_sources', {
    trackId: fx.trackId,
    expectedDeviceOrder: [
      { name: 'Existing Twin', enabled: true }, { name: 'Tool', enabled: false },
    ],
    containerKind: 'FX Layer',
    entries: [{
      entryName: 'Sampled local',
      source: {
        kind: 'preset', path: SAMPLED_PRESET,
        fingerprint: fingerprintPreset(bytes), modulatorLocation: { kind: 'self' },
      },
      modulators: [{
        location: 'device', modulator: 'lfo', amount: 1,
        target: {
          parameterId: 'CONTENTS/AMP_ATTACK_TIME', parameterName: 'AEG Attack Time',
        },
      }],
    }],
  }) as Record<string, unknown>;
  assert.equal(result['complete'], true, JSON.stringify(result));
  const entry = (result['entries'] as {
    sourceIdentity: { sampledPreset: boolean; adjustedSampleReferences: number };
    pages: { verified: boolean };
  }[])[0]!;
  assert.equal(entry.sourceIdentity.sampledPreset, true);
  assert.ok(entry.sourceIdentity.adjustedSampleReferences > 0);
  assert.equal(entry.pages.verified, true);

  const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint: result['reversalCheckpoint'],
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));
});

test('5r-capacity: the fifth entry completes and the sixth refuses before a write', async () => {
  const fx = fixture();
  const request = fourSourceRequest(fx.trackId);
  const fifth = await callTool(fx.workspace, 'compose_device_sources', {
    ...request,
    entries: [...request.entries, {
      entryName: 'Fifth', source: { kind: 'existing-copy', devicePosition: 0 }, modulators: [],
    }],
  }) as Record<string, unknown>;
  assert.equal(fifth['complete'], true, JSON.stringify(fifth));
  assert.equal((fifth['structure'] as unknown[]).length, 5);
  assert.equal((fifth['stages'] as { stage: string }[])
    .some((stage) => stage.stage === 'create-entry'), false);
  await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint: fifth['reversalCheckpoint'],
  });
  const changesBeforeRefusal = fx.workspace.changes.list().length;
  const sixth = await callTool(fx.workspace, 'compose_device_sources', {
    ...request,
    entries: [...request.entries,
      { entryName: 'Fifth', source: { kind: 'existing-copy', devicePosition: 0 }, modulators: [] },
      { entryName: 'Sixth', source: { kind: 'existing-copy', devicePosition: 0 }, modulators: [] }],
  }) as Record<string, unknown>;
  assert.equal(sixth['refused'], true, JSON.stringify(sixth));
  assert.deepEqual(sixth['capacities'], fifth['capacities']);
  assert.equal(fx.workspace.changes.list().length, changesBeforeRefusal);
});

test('5r-route-depth: total depth 2 completes and total depth 3 refuses before a write', async () => {
  const fx = fixture();
  const bytes = await readFile(NESTED_PRESET);
  const entry = {
    entryName: 'Nested',
    source: {
      kind: 'preset' as const, path: NESTED_PRESET,
      fingerprint: fingerprintPreset(bytes),
      modulatorLocation: {
        kind: 'entry' as const,
        entry: { position: 1, name: 'CHAIN1' },
        devicePath: [{ position: 0, name: 'Polysynth' }],
      },
    },
    modulators: [{
      ...outer, location: 'device' as const,
      target: { parameterId: 'CONTENTS/F1FREQ', parameterName: 'Filter Frequency' },
    }],
  };
  assert.equal(generalDeviceCompositionInputSchema.entries.safeParse([entry]).success, true);
  const accepted = await callTool(fx.workspace, 'compose_device_sources', {
    trackId: fx.trackId, containerKind: 'FX Layer',
    expectedDeviceOrder: [
      { name: 'Existing Twin', enabled: true }, { name: 'Tool', enabled: false },
    ],
    entries: [entry],
  }) as Record<string, unknown>;
  assert.equal(accepted['complete'], true, JSON.stringify(accepted));
  const acceptedEntry = (accepted['entries'] as {
    pages: { verified: boolean };
    behaviors: { verified: boolean }[];
    scalarFingerprint: { after: { parameterCount: number } };
  }[])[0]!;
  assert.equal(acceptedEntry.pages.verified, true);
  assert.equal(acceptedEntry.behaviors[0]?.verified, true);
  assert.equal(acceptedEntry.scalarFingerprint.after.parameterCount, 1);
  const acceptedCheckpoint = accepted['reversalCheckpoint'] as {
    completedEntries: { fingerprintLocation?: unknown }[];
  };
  assert.deepEqual(
    acceptedCheckpoint.completedEntries[0]?.fingerprintLocation,
    entry.source.modulatorLocation,
  );
  assert.deepEqual(accepted['capacities'], {
    topLevelContainerPositions: 3, entriesPerLayer: 5,
    devicesPerEntry: 4, parameterRouteDepth: 2,
  });
  const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint: accepted['reversalCheckpoint'],
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));

  const changes = fx.workspace.changes.list().length;
  const refused = await callTool(fx.workspace, 'compose_device_sources', {
    trackId: fx.trackId, containerKind: 'FX Layer',
    expectedDeviceOrder: [
      { name: 'Existing Twin', enabled: true }, { name: 'Tool', enabled: false },
    ],
    entries: [{
      ...entry,
      source: {
        ...entry.source,
        modulatorLocation: {
          ...entry.source.modulatorLocation,
          devicePath: [
            ...entry.source.modulatorLocation.devicePath,
            { position: 0, name: 'Too deep' },
          ],
        },
      },
    }],
  }) as Record<string, unknown>;
  assert.equal(refused['refused'], true, JSON.stringify(refused));
  assert.equal(refused['nothingWasWritten'], true);
  assert.equal(fx.workspace.changes.list().length, changes);
});

test('5r-position-and-device-capacity: position 2 and four ordered devices reverse exactly', async () => {
  const fx = fixture();
  const result = await callTool(fx.workspace, 'compose_device_sources', {
    trackId: fx.trackId,
    expectedDeviceOrder: [
      { name: 'Existing Twin', enabled: true }, { name: 'Tool', enabled: false },
    ],
    containerKind: 'FX Layer', containerPosition: 2,
    entries: [{
      entryName: 'Wide',
      devices: [
        { source: { kind: 'native', name: 'Polysynth' }, modulators: [outer] },
        { source: { kind: 'vst3', classUid: 'D39D5B69D6AF42FA123456785A334D44' }, modulators: [] },
        { source: { kind: 'clap', id: 'com.u-he.Zebra3' }, modulators: [] },
        { source: { kind: 'existing-copy', devicePosition: 0 }, modulators: [] },
      ],
    }],
  }) as Record<string, unknown>;
  assert.equal(result['complete'], true, JSON.stringify(result));
  assert.deepEqual(result['capacities'], {
    topLevelContainerPositions: 3, entriesPerLayer: 5,
    devicesPerEntry: 4, parameterRouteDepth: 2,
  });
  const structure = result['structure'] as { devices: { position: number }[] }[];
  assert.deepEqual(structure[0]!.devices.map((item) => item.position), [0, 1, 2, 3]);
  assert.equal(fx.row.devices[2]?.name, 'FX Layer');
  const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint: result['reversalCheckpoint'],
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Existing Twin', 'Tool']);

  fx.row.devices.push({
    name: 'Third anchor', enabled: true, paramsLive: true,
    params: [{
      id: 'CONTENTS/F1FREQ', name: 'Filter Frequency', value: 0.2,
      modulatedValue: 0.2, hasAutomation: false,
    }],
  });
  fx.fake.model.revision++;
  const changes = fx.workspace.changes.list().length;
  const outside = await callTool(fx.workspace, 'compose_device_sources', {
    trackId: fx.trackId,
    expectedDeviceOrder: [
      { name: 'Existing Twin', enabled: true }, { name: 'Tool', enabled: false },
      { name: 'Third anchor', enabled: true },
    ],
    containerKind: 'FX Layer', containerPosition: 3,
    entries: [{ entryName: 'No write', source: { kind: 'native', name: 'Polysynth' }, modulators: [] }],
  }) as Record<string, unknown>;
  assert.equal(outside['refused'], true, JSON.stringify(outside));
  assert.deepEqual(outside['capacities'], result['capacities']);
  const tooWide = await callTool(fx.workspace, 'compose_device_sources', {
    trackId: fx.trackId,
    expectedDeviceOrder: [
      { name: 'Existing Twin', enabled: true }, { name: 'Tool', enabled: false },
      { name: 'Third anchor', enabled: true },
    ],
    containerKind: 'FX Layer',
    entries: [{
      entryName: 'Too wide',
      devices: Array.from({ length: 5 }, () => ({
        source: { kind: 'native', name: 'Polysynth' }, modulators: [],
      })),
    }],
  }) as Record<string, unknown>;
  assert.equal(tooWide['refused'], true, JSON.stringify(tooWide));
  assert.deepEqual(tooWide['capacities'], result['capacities']);
  assert.equal(fx.workspace.changes.list().length, changes);
});

test('5r-position: moving a source before position 2 updates the container checkpoint', async () => {
  const fx = fixture();
  const result = await callTool(fx.workspace, 'compose_device_sources', {
    trackId: fx.trackId,
    expectedDeviceOrder: [
      { name: 'Existing Twin', enabled: true }, { name: 'Tool', enabled: false },
    ],
    containerKind: 'FX Layer', containerPosition: 2,
    entries: [{
      entryName: 'Moved', source: { kind: 'existing-move', devicePosition: 0 }, modulators: [],
    }],
  }) as Record<string, unknown>;
  assert.equal(result['complete'], true, JSON.stringify(result));
  assert.equal((result['reversalCheckpoint'] as { currentContainerPosition: number })
    .currentContainerPosition, 1);
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Tool', 'FX Layer']);

  const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint: result['reversalCheckpoint'],
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Existing Twin', 'Tool']);
});

test('5r-reversal-capacity: an owned source reserves one top-level scratch slot', async () => {
  const fx = fixture();
  fx.fake.model.deviceBankSize = 3;
  const changes = fx.workspace.changes.list().length;
  const result = await callTool(fx.workspace, 'compose_device_sources', {
    trackId: fx.trackId,
    expectedDeviceOrder: [
      { name: 'Existing Twin', enabled: true }, { name: 'Tool', enabled: false },
    ],
    containerKind: 'FX Layer', containerPosition: 0,
    entries: [{
      entryName: 'Copy', source: { kind: 'existing-copy', devicePosition: 0 }, modulators: [],
    }],
  }) as Record<string, unknown>;
  assert.equal(result['refused'], true, JSON.stringify(result));
  assert.match(String(result['why']), /scratch slot/);
  assert.equal(fx.workspace.changes.list().length, changes);
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Existing Twin', 'Tool']);
});

test('5r-shapes: Instrument Layer passes later behavior and reversal', async () => {
  for (const containerKind of ['Instrument Layer'] as const) {
    const fx = fixture();
    const entries = Array.from({ length: 5 }, (_, index) => ({
      entryName: `Instrument ${index + 1}`,
      devices: [{
        source: { kind: 'native' as const, name: 'Polysynth' },
        modulators: index === 4 ? [outer] : [],
      }],
    }));
    const result = await callTool(fx.workspace, 'compose_device_sources', {
      trackId: fx.trackId,
      expectedDeviceOrder: [
        { name: 'Existing Twin', enabled: true }, { name: 'Tool', enabled: false },
      ],
      containerKind, containerPosition: 1, entries,
    }) as Record<string, unknown>;
    assert.equal(result['complete'], true, JSON.stringify(result));
    const verifications = result['entries'] as {
      entryIndex: number; deviceIndex: number; behaviors: { verified: boolean }[];
    }[];
    const witness = verifications.find((item) => item.behaviors.length > 0)!;
    assert.equal(witness.behaviors[0]?.verified, true);
    assert.deepEqual([witness.entryIndex, witness.deviceIndex], [4, 0]);
    const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
      checkpoint: result['reversalCheckpoint'],
    }) as Record<string, unknown>;
    assert.equal(reversed['complete'], true, JSON.stringify(reversed));
    assert.deepEqual(fx.row.devices.map((item) => item.name), ['Existing Twin', 'Tool']);
  }
});

test('5q-order: a later source cannot reuse an existing device after it moves', async () => {
  const fx = fixture();
  const result = await callTool(fx.workspace, 'compose_device_sources', {
    trackId: fx.trackId,
    expectedDeviceOrder: [
      { name: 'Existing Twin', enabled: true }, { name: 'Tool', enabled: false },
    ],
    containerKind: 'FX Layer',
    entries: [
      {
        entryName: 'Moved', source: { kind: 'existing-move', devicePosition: 0 }, modulators: [outer],
      },
      {
        entryName: 'Copied later', source: { kind: 'existing-copy', devicePosition: 0 }, modulators: [],
      },
    ],
  }) as Record<string, unknown>;
  assert.equal(result['refused'], true);
  assert.match(String(result['why']), /after it moves/);
  assert.equal(fx.workspace.changes.list().length, 0);
});

test('5q-partial: a bad later plug-in keeps earlier completed stages reversible', async () => {
  const fx = fixture();
  let inserts = 0;
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async apply(
      ops: Parameters<Workspace['apply']>[0],
      run?: Parameters<Workspace['apply']>[1],
    ) {
      if (ops[0]?.op === 'device.insert' && ++inserts === 3) {
        throw new Error('the later plug-in source did not resolve');
      }
      return fx.workspace.apply(ops, run);
    },
  });
  const request = fourSourceRequest(fx.trackId);
  const result = await callTool(workspace, 'compose_device_sources', {
    ...request, entries: request.entries.slice(0, 2),
  }) as Record<string, unknown>;
  assert.equal(result['complete'], false);
  assert.equal(result['partialCompletion'], true);
  assert.equal((result['entries'] as unknown[]).length, 1);
  assert.match(String(result['why']), /later plug-in source/);

  const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint: result['reversalCheckpoint'],
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Existing Twin', 'Tool']);
});

test('5r-partial: prepared entry names stay exact after a later seed rename fails', async () => {
  const fx = fixture();
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async apply(
      ops: Parameters<Workspace['apply']>[0],
      run?: Parameters<Workspace['apply']>[1],
    ) {
      if (ops[0]?.op === 'chain.rename' && ops[0].name === 'VST3') {
        throw new Error('the later seed entry could not be renamed');
      }
      return fx.workspace.apply(ops, run);
    },
  });
  const request = fourSourceRequest(fx.trackId);
  const result = await callTool(workspace, 'compose_device_sources', {
    ...request, entries: request.entries.slice(0, 3),
  }) as Record<string, unknown>;
  assert.equal(result['complete'], false);
  const checkpoint = result['reversalCheckpoint'] as { preparedEntryNames: string[] };
  assert.equal(checkpoint.preparedEntryNames[0], 'Native');
  assert.match(checkpoint.preparedEntryNames[1]!, /^ghostnote pending general entry 2/);
  assert.match(checkpoint.preparedEntryNames[2]!, /^ghostnote pending general entry 3/);

  const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint,
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Existing Twin', 'Tool']);
});

test('5q-partial: an inserted source is checkpointed before relocation', async () => {
  const fx = fixture();
  let refusedRelocation = false;
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async apply(
      ops: Parameters<Workspace['apply']>[0],
      run?: Parameters<Workspace['apply']>[1],
    ) {
      if (ops[0]?.op === 'chain.relocate' && ops[0].destination.kind === 'chain'
          && !refusedRelocation) {
        refusedRelocation = true;
        throw new Error('the destination stopped resolving');
      }
      return fx.workspace.apply(ops, run);
    },
  });
  const request = fourSourceRequest(fx.trackId);
  const result = await callTool(workspace, 'compose_device_sources', {
    ...request, entries: request.entries.slice(0, 1),
  }) as Record<string, unknown>;
  assert.equal(result['complete'], false);
  const checkpoint = result['reversalCheckpoint'] as {
    pendingEntry: { location: string; sourceKind: string };
  };
  assert.equal(checkpoint.pendingEntry.location, 'top-level');
  assert.equal(checkpoint.pendingEntry.sourceKind, 'native');

  const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint,
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Existing Twin', 'Tool']);
});

test('5r-partial: an inserted source is reversible before its first stable name read', async () => {
  const fx = fixture();
  let sourceInserted = false;
  let refusedRead = false;
  let inserts = 0;
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async apply(
      ops: Parameters<Workspace['apply']>[0],
      run?: Parameters<Workspace['apply']>[1],
    ) {
      const change = await fx.workspace.apply(ops, run);
      if (ops[0]?.op === 'device.insert' && ++inserts === 2) sourceInserted = true;
      return change;
    },
    async devices(track: Parameters<Workspace['devices']>[0]) {
      if (sourceInserted && !refusedRead) {
        refusedRead = true;
        throw new Error('the first source name read failed');
      }
      return fx.workspace.devices(track);
    },
  });
  const request = fourSourceRequest(fx.trackId);
  const result = await callTool(workspace, 'compose_device_sources', {
    ...request, entries: request.entries.slice(0, 1),
  }) as Record<string, unknown>;
  assert.equal(result['complete'], false);
  const checkpoint = result['reversalCheckpoint'] as { pendingUnwitnessedSource?: unknown };
  assert.ok(checkpoint.pendingUnwitnessedSource);

  const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint,
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Existing Twin', 'Tool']);
});

test('5r-reversal: an untouched inserted seed reverses exactly', async () => {
  const fx = fixture();
  let deviceReads = 0;
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async devices(track: Parameters<Workspace['devices']>[0]) {
      if (++deviceReads === 2) throw new Error('the inserted container did not settle');
      return fx.workspace.devices(track);
    },
  });
  const request = fourSourceRequest(fx.trackId);
  const result = await callTool(workspace, 'compose_device_sources', {
    ...request, entries: request.entries.slice(0, 1),
  }) as Record<string, unknown>;
  const checkpoint = result['reversalCheckpoint'] as { state: string };
  assert.equal(checkpoint.state, 'container-inserted');

  const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint,
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Existing Twin', 'Tool']);
});

test('5q-reversal: an unproved inserted container must be empty before removal', async () => {
  const fx = fixture();
  let deviceReads = 0;
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async devices(track: Parameters<Workspace['devices']>[0]) {
      if (++deviceReads === 2) throw new Error('the inserted container did not settle');
      return fx.workspace.devices(track);
    },
  });
  const request = fourSourceRequest(fx.trackId);
  const result = await callTool(workspace, 'compose_device_sources', {
    ...request, entries: request.entries.slice(0, 1),
  }) as Record<string, unknown>;
  const checkpoint = result['reversalCheckpoint'] as { state: string };
  assert.equal(checkpoint.state, 'container-inserted');

  const container = fx.row.devices.find((item) => item.name === 'FX Layer')!;
  const unexpected = {
    name: 'User device', enabled: true, paramsLive: true,
    params: [{
      id: 'CONTENTS/F1FREQ', name: 'Filter Frequency', value: 0.2,
      modulatedValue: 0.2, hasAutomation: false,
    }],
  };
  container.chains![0]!.devices.push(unexpected);
  fx.fake.model.revision++;

  const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint,
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], false);
  assert.match(String(reversed['why']), /boundary changed|structure changed|not empty/);
  assert.equal(container.chains![0]!.devices[0], unexpected);
  assert.ok(fx.row.devices.includes(container));
  assert.deepEqual(
    fx.row.devices.map((item) => item.name),
    ['Existing Twin', 'Tool', 'FX Layer'],
    'a changed untouched seed refuses before top-level relocation',
  );
});

test('5q-reversal: an edit after extraction stops before a tail deletion', async () => {
  const fx = fixture();
  const composed = await callTool(fx.workspace, 'compose_device_sources', {
    trackId: fx.trackId,
    expectedDeviceOrder: [
      { name: 'Existing Twin', enabled: true }, { name: 'Tool', enabled: false },
    ],
    containerKind: 'FX Layer',
    entries: [{
      entryName: 'Copy', source: { kind: 'existing-copy', devicePosition: 0 }, modulators: [],
    }],
  }) as Record<string, unknown>;
  assert.equal(composed['complete'], true, JSON.stringify(composed));

  const intervening = {
    name: 'Existing Twin', enabled: true, paramsLive: true,
    params: [{
      id: 'CONTENTS/F1FREQ', name: 'Filter Frequency', value: 0.91,
      modulatedValue: 0.91, hasAutomation: false,
    }],
  };
  let injected = false;
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async apply(
      ops: Parameters<Workspace['apply']>[0],
      run?: Parameters<Workspace['apply']>[1],
    ) {
      const change = await fx.workspace.apply(ops, run);
      if (ops[0]?.op === 'chain.relocate' && ops[0].destination.kind === 'track' && !injected) {
        injected = true;
        fx.row.devices.push(intervening);
        fx.fake.model.revision++;
      }
      return change;
    },
  });

  const reversed = await callTool(workspace, 'reverse_device_source_composition', {
    checkpoint: composed['reversalCheckpoint'],
  }) as Record<string, unknown>;
  assert.equal(injected, true);
  assert.equal(reversed['complete'], false);
  assert.equal(reversed['partialReversal'], true);
  assert.match(String(reversed['why']), /project changed|device order/);
  assert.ok(fx.row.devices.includes(intervening));
  const continuation = reversed['reversalCheckpoint'] as {
    schemaVersion: number;
    reversalRemainingEntries: unknown[];
    reversalPendingTopLevel: { position: number; observedName: string };
  };
  assert.equal(continuation.schemaVersion, 5);
  assert.deepEqual(continuation.reversalRemainingEntries, []);
  assert.equal(continuation.reversalPendingTopLevel.observedName, 'Existing Twin');
  assert.equal(continuation.reversalPendingTopLevel.position, 3);

  const stale = await callTool(workspace, 'reverse_device_source_composition', {
    checkpoint: composed['reversalCheckpoint'],
  }) as Record<string, unknown>;
  assert.equal(stale['refused'], true);
  assert.equal(stale['nothingWasWritten'], true);

  assert.equal(fx.row.devices.pop(), intervening);
  fx.fake.model.revision++;
  const resumed = await callTool(workspace, 'reverse_device_source_composition', {
    checkpoint: continuation,
  }) as Record<string, unknown>;
  assert.equal(resumed['complete'], true, JSON.stringify(resumed));
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Existing Twin', 'Tool']);
});

test('5r-reversal: an interrupted existing move resumes to its original position', async () => {
  const fx = fixture();
  const composed = await callTool(fx.workspace, 'compose_device_sources', {
    trackId: fx.trackId,
    expectedDeviceOrder: [
      { name: 'Existing Twin', enabled: true }, { name: 'Tool', enabled: false },
    ],
    containerKind: 'FX Layer',
    entries: [{
      entryName: 'Move', source: { kind: 'existing-move', devicePosition: 0 }, modulators: [],
    }],
  }) as Record<string, unknown>;
  assert.equal(composed['complete'], true, JSON.stringify(composed));

  const intervening = {
    name: 'Intervening', enabled: true, paramsLive: true,
    params: [{ id: 'P1', name: 'Param', value: 0.5 }],
  };
  let injected = false;
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async apply(ops: Parameters<Workspace['apply']>[0], run?: Parameters<Workspace['apply']>[1]) {
      const change = await fx.workspace.apply(ops, run);
      if (ops[0]?.op === 'chain.relocate' && ops[0].destination.kind === 'track' && !injected) {
        injected = true;
        fx.row.devices.push(intervening);
        fx.fake.model.revision++;
      }
      return change;
    },
  });
  const partial = await callTool(workspace, 'reverse_device_source_composition', {
    checkpoint: composed['reversalCheckpoint'],
  }) as Record<string, unknown>;
  assert.equal(partial['complete'], false);
  const continuation = partial['reversalCheckpoint'] as Record<string, unknown>;
  assert.equal((continuation['reversalPendingTopLevel'] as { position: number }).position, 2);

  assert.equal(fx.row.devices.pop(), intervening);
  fx.fake.model.revision++;
  const resumed = await callTool(workspace, 'reverse_device_source_composition', {
    checkpoint: continuation,
  }) as Record<string, unknown>;
  assert.equal(resumed['complete'], true, JSON.stringify(resumed));
  assert.equal(fx.row.devices[0], fx.existing);
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Existing Twin', 'Tool']);
});

test('5r-reversal: accepted container removal can resume final proof without deleting twice', async () => {
  const fx = fixture();
  const composed = await callTool(fx.workspace, 'compose_device_sources', {
    trackId: fx.trackId,
    expectedDeviceOrder: [
      { name: 'Existing Twin', enabled: true }, { name: 'Tool', enabled: false },
    ],
    containerKind: 'FX Layer',
    entries: [{
      entryName: 'Copy', source: { kind: 'existing-copy', devicePosition: 0 }, modulators: [],
    }],
  }) as Record<string, unknown>;
  assert.equal(composed['complete'], true, JSON.stringify(composed));

  const intervening = {
    name: 'Intervening', enabled: true, paramsLive: true,
    params: [{ id: 'P1', name: 'Param', value: 0.5 }],
  };
  let injected = false;
  let containerDeletes = 0;
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async apply(ops: Parameters<Workspace['apply']>[0], run?: Parameters<Workspace['apply']>[1]) {
      const change = await fx.workspace.apply(ops, run);
      if (ops[0]?.op === 'device.delete' && ops[0].expectedName === 'FX Layer') {
        containerDeletes++;
        if (!injected) {
          injected = true;
          fx.row.devices.push(intervening);
          fx.fake.model.revision++;
        }
      }
      return change;
    },
  });
  const partial = await callTool(workspace, 'reverse_device_source_composition', {
    checkpoint: composed['reversalCheckpoint'],
  }) as Record<string, unknown>;
  assert.equal(partial['complete'], false);
  assert.equal(partial['containerRemoved'], true);
  const continuation = partial['reversalCheckpoint'] as Record<string, unknown>;
  assert.equal(continuation['reversalContainerRemoved'], true);

  assert.equal(fx.row.devices.pop(), intervening);
  fx.fake.model.revision++;
  const resumed = await callTool(workspace, 'reverse_device_source_composition', {
    checkpoint: continuation,
  }) as Record<string, unknown>;
  assert.equal(resumed['complete'], true, JSON.stringify(resumed));
  assert.equal(containerDeletes, 1);
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Existing Twin', 'Tool']);
});

test('5q-final: unexpected nested state cannot pass the complete witness', async () => {
  const fx = fixture();
  let containerReads = 0;
  const unexpected = {
    name: 'Unexpected nested device', enabled: false, paramsLive: true,
    params: [{
      id: 'CONTENTS/F1FREQ', name: 'Filter Frequency', value: 0.7,
      modulatedValue: 0.7, hasAutomation: false,
    }],
  };
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async read(addresses: Parameters<Workspace['read']>[0]) {
      const snapshot = await fx.workspace.read(addresses);
      const target = addresses[0];
      if (target?.kind === 'device' && target.chain === undefined && target.chainIndex === 0
          && ++containerReads === 3) {
        fx.row.devices[0]!.chains![0]!.devices.push(unexpected);
        fx.fake.model.revision++;
      }
      return snapshot;
    },
  });
  const result = await callTool(workspace, 'compose_device_sources', {
    trackId: fx.trackId,
    expectedDeviceOrder: [
      { name: 'Existing Twin', enabled: true }, { name: 'Tool', enabled: false },
    ],
    containerKind: 'FX Layer',
    entries: [{ entryName: 'Native', source: { kind: 'native', name: 'Polysynth' }, modulators: [] }],
  }) as Record<string, unknown>;
  assert.equal(result['complete'], false, JSON.stringify(result));
  assert.equal(result['failedStage'], 'final-witness');
  assert.equal(result['structure'], undefined);
});
