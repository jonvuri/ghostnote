import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { z } from 'zod';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import type { FakeDevice } from '../adapters/fake/model.js';
import type { DeviceSource } from '../contract/index.js';
import { listChains, listModulators } from '../bwmod/index.js';
import { Executor, fingerprintPreset, inspectPresetModulation } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool, TOOLS } from './tools.js';
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
  // Model the host device that one leaf source creates: names, parameters, nested chains and modulator pages.
  function decorate(inserted: FakeDevice, source: DeviceSource, preset: Buffer | undefined): void {
    if (source.from === 'vst3' || source.from === 'clap') inserted.name = 'Repeated Twin';
    inserted.paramsLive = true;
    const sampler = source.from === 'file' && source.path.includes('gn_sampler');
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
      const chainPresets = new Map<string, Buffer>();
      for (const [index, item] of ops.entries()) {
        if (item.op !== 'chain.insert') continue;
        for (const [at, source] of item.sources.entries()) {
          if (source.from === 'file') chainPresets.set(`${index}:${at}`, await readFile(source.path));
        }
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
            decorate(inserted, op.source, preset);
          }
        }
      }
      for (const [index, item] of ops.entries()) {
        if (item.op !== 'chain.insert') continue;
        const container = row.devices[item.chain.container.chainIndex]!;
        const entry = container.chains!.find((candidate) => candidate.name === item.chain.name)!;
        const added = entry.devices.slice(item.expectedDeviceCount, item.expectedDeviceCount + item.sources.length);
        for (const [at, inserted] of added.entries()) {
          decorate(inserted, item.sources[at]!, chainPresets.get(`${index}:${at}`));
          // As a relocation does, a device that arrives in its chain shows the outer route as active.
          const target = inserted.chains?.[0]?.devices[0] ?? inserted;
          if (target.params[0] !== undefined) target.params[0].modulatedValue = 0.72;
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

test('5q-move: an existing move preserves the exact instance', async () => {
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
    instance: string; stateClaim: string; scalarFingerprint?: unknown;
  }[])[0]!;
  assert.equal(entry.instance, 'preserved');
  // D65: no per-stage scalar fingerprint; the instance identity below is the fixture's proof.
  assert.equal(entry.scalarFingerprint, undefined);
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

test('B17: a sixth modulated entry still refuses before writing', async () => {
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
  }[])[0]!;
  // The nested host at depth 2 matched its semantic name before the page and route witnesses.
  assert.equal(acceptedEntry.pages.verified, true);
  assert.equal(acceptedEntry.behaviors[0]?.verified, true);
  assert.deepEqual(accepted['capacities'], {
    parameterTopLevelPositions: 16, parameterEntriesPerLayer: 5,
    parameterDevicesPerEntry: 4, parameterRouteDepth: 2,
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
    parameterTopLevelPositions: 16, parameterEntriesPerLayer: 5,
    parameterDevicesPerEntry: 4, parameterRouteDepth: 2,
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
    // B08: positions 3 through 15 are inside the scrolled scopes' reach; the bank edge is the refusal.
    containerKind: 'FX Layer', containerPosition: 16,
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
  assert.equal(tooWide['complete'], true, JSON.stringify(tooWide));
  assert.deepEqual(tooWide['capacities'], result['capacities']);
  assert.ok(fx.workspace.changes.list().length > changes);
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

test('B17: composition needs no spare physical top-level slot', async () => {
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
  assert.equal(result['complete'], true, JSON.stringify(result));
  assert.ok(fx.workspace.changes.list().length > changes);
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

test('5q-partial: a later chain insertion that throws keeps the landed source reversible', async () => {
  const fx = fixture();
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async apply(
      ops: Parameters<Workspace['apply']>[0],
      run?: Parameters<Workspace['apply']>[1],
    ) {
      // The first chain's insertion lands; the second throws after possible effects.
      if (ops.length > 1 && ops.every((op) => op.op === 'chain.insert')) {
        await fx.workspace.apply(ops.slice(0, 1), run);
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
  assert.equal(result['effectsPossible'], true);
  assert.match(String(result['why']), /later plug-in source/);
  // The one final read reports what landed; the batch is never repeated.
  assert.deepEqual((result['structure'] as { devices: unknown[] }[]).map((item) => item.devices.length), [1, 0]);

  const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint: result['reversalCheckpoint'],
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Existing Twin', 'Tool']);
});

test('8i3 names: all entry names are one guarded stage', async () => {
  const fx = fixture();
  const renames: number[] = [];
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async apply(
      ops: Parameters<Workspace['apply']>[0],
      run?: Parameters<Workspace['apply']>[1],
    ) {
      if (ops.some((op) => op.op === 'chain.rename')) renames.push(ops.length);
      return fx.workspace.apply(ops, run);
    },
  });
  const request = fourSourceRequest(fx.trackId);
  const result = await callTool(workspace, 'compose_device_sources', {
    ...request, entries: request.entries.slice(0, 3),
  }) as Record<string, unknown>;
  assert.equal(result['complete'], true, JSON.stringify(result));
  assert.deepEqual(renames, [3]);
  assert.deepEqual((result['stages'] as { stage: string }[]).filter((item) => item.stage.endsWith('entry-name'))
    .map((item) => item.stage), ['confirm-entry-name']);
});

test('D65 proofs: the seed read and one final structure read, with no nested inventory', async () => {
  const fx = fixture();
  const reads: { readonly topLevel: boolean; readonly structure: boolean }[] = [];
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async read(
      addresses: Parameters<Workspace['read']>[0],
      options?: Parameters<Workspace['read']>[1],
    ) {
      for (const address of addresses) {
        if (address.kind === 'device') {
          reads.push({ topLevel: address.chain === undefined, structure: options?.structure === true });
        }
      }
      return fx.workspace.read(addresses, options);
    },
  });
  const request = fourSourceRequest(fx.trackId);
  const result = await callTool(workspace, 'compose_device_sources', {
    ...request, entries: request.entries.slice(0, 3),
  }) as Record<string, unknown>;
  assert.equal(result['complete'], true, JSON.stringify(result));
  const containerReads = reads.filter((item) => item.topLevel);
  assert.equal(containerReads.length, 2, 'the seed names and the final result');
  assert.equal(containerReads.every((item) => item.structure), true);
  assert.equal(reads.some((item) => !item.topLevel), false, 'no per-source inventory or fingerprint');
});

test('8i3 names: a requested name that is another seed name takes temporary names first', async () => {
  const fx = fixture();
  const renames: string[][] = [];
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async apply(
      ops: Parameters<Workspace['apply']>[0],
      run?: Parameters<Workspace['apply']>[1],
    ) {
      if (ops.some((op) => op.op === 'chain.rename')) {
        renames.push(ops.map((op) => (op.op === 'chain.rename' ? op.name : '')));
      }
      return fx.workspace.apply(ops, run);
    },
  });
  const request = fourSourceRequest(fx.trackId);
  const entries = request.entries.slice(0, 2);
  const result = await callTool(workspace, 'compose_device_sources', {
    ...request, entries: [{ ...entries[0]!, entryName: 'Observed seed 2' }, { ...entries[1]!, entryName: 'Observed seed 1' }],
  }) as Record<string, unknown>;
  assert.equal(result['complete'], true, JSON.stringify(result));
  assert.equal(renames.length, 2);
  assert.match(renames[0]![0]!, /^ghostnote pending general entry 1/);
  assert.deepEqual(renames[1], ['Observed seed 2', 'Observed seed 1']);
  assert.deepEqual((result['structure'] as { entryName: string }[]).map((item) => item.entryName),
    ['Observed seed 2', 'Observed seed 1']);
});

test('8i3 names: a refused name stage keeps the seed names, and the untouched seed reverses', async () => {
  const fx = fixture();
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async apply(
      ops: Parameters<Workspace['apply']>[0],
      run?: Parameters<Workspace['apply']>[1],
    ) {
      if (ops.some((op) => op.op === 'chain.rename' && op.name === 'VST3')) {
        throw new Error('the seed entries could not be renamed');
      }
      return fx.workspace.apply(ops, run);
    },
  });
  const request = fourSourceRequest(fx.trackId);
  const result = await callTool(workspace, 'compose_device_sources', {
    ...request, entries: request.entries.slice(0, 3),
  }) as Record<string, unknown>;
  assert.equal(result['complete'], false);
  const checkpoint = result['reversalCheckpoint'] as { preparedEntryNames: string[]; seedUnchanged: boolean };
  assert.equal(checkpoint.seedUnchanged, true);
  assert.equal(checkpoint.preparedEntryNames.includes('VST3'), false);

  const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint,
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Existing Twin', 'Tool']);
});

for (const disturbance of ['none', 'operator-rename', 'unproved-rename'] as const) {
  test(`8i3 names: partial receipts preserve only proved names (${disturbance})`, async () => {
    const fx = fixture();
    const workspace: Workspace = Object.freeze({
      ...fx.workspace,
      async apply(ops: Parameters<Workspace['apply']>[0], run?: Parameters<Workspace['apply']>[1]) {
        if (!ops.some((op) => op.op === 'chain.rename')) return fx.workspace.apply(ops, run);
        // The renames share one stage. Its first entry is proved; the second is not.
        const first = await fx.workspace.apply(ops.slice(0, 1), run);
        const container = fx.row.devices.find((item) => item.chains?.length)!;
        if (disturbance === 'operator-rename') container.chains![0]!.name = 'Operator edit';
        if (disturbance === 'unproved-rename') container.chains![2]!.name = 'CLAP';
        const failed = { op: 'chain.rename', ok: false, error: 'The rename was not proved.' };
        const stage = first.take.receipt.stages[0]!;
        return {
          ...first,
          take: {
            ...first.take, ops,
            receipt: { ...first.take.receipt, stages: [{ ...stage, ops: [...stage.ops, failed] }] },
            report: { ...first.take.report, failed: [failed] },
          },
        };
      },
    });
    const request = fourSourceRequest(fx.trackId);
    const entries = request.entries.slice(0, 3);
    // The unchanged first entry has no op. Receipt indices refer to the remaining rename ops.
    entries[0] = { ...entries[0]!, entryName: 'Observed seed 1' };
    const result = await callTool(workspace, 'compose_device_sources', { ...request, entries }) as Record<string, unknown>;
    assert.equal(result['complete'], false);
    const checkpoint = result['reversalCheckpoint'] as { preparedEntryNames: string[]; seedUnchanged: boolean };
    assert.deepEqual(checkpoint.preparedEntryNames, ['Observed seed 1', 'VST3', 'Observed seed 3']);
    assert.equal(checkpoint.seedUnchanged, false);
    const before = structuredClone(fx.row.devices);
    const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', { checkpoint }) as Record<string, unknown>;
    assert.equal(reversed['complete'], disturbance === 'none', JSON.stringify(reversed));
    if (disturbance === 'none') {
      assert.deepEqual(fx.row.devices.map((item) => item.name), ['Existing Twin', 'Tool']);
    } else {
      assert.equal((reversed['stages'] as unknown[]).length, 0, 'reversal refuses before a write');
      assert.deepEqual(fx.row.devices, before, 'reversal preserves the changed container');
    }
  });
}

test('5q-partial: a thrown existing move reports possible effects and reverses the owned container', async () => {
  const fx = fixture();
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async apply(
      ops: Parameters<Workspace['apply']>[0],
      run?: Parameters<Workspace['apply']>[1],
    ) {
      if (ops[0]?.op === 'chain.relocate' && ops[0].destination.kind === 'chain') {
        throw new Error('the destination stopped resolving');
      }
      return fx.workspace.apply(ops, run);
    },
  });
  const result = await callTool(workspace, 'compose_device_sources', {
    trackId: fx.trackId,
    expectedDeviceOrder: [{ name: 'Existing Twin', enabled: true }, { name: 'Tool', enabled: false }],
    containerKind: 'FX Layer',
    entries: [{ entryName: 'Moved', source: { kind: 'existing-move', devicePosition: 0 }, modulators: [] }],
  }) as Record<string, unknown>;
  assert.equal(result['complete'], false);
  assert.equal(result['effectsPossible'], true);
  const checkpoint = result['reversalCheckpoint'] as { completedEntries: unknown[] };
  assert.deepEqual(checkpoint.completedEntries, [], 'the final read observed the move did not land');

  const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint,
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));
  assert.equal(fx.row.devices[0], fx.existing);
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Existing Twin', 'Tool']);
});

test('5r-partial: a lost final read reports possible effects, and reversal refuses without a write', async () => {
  const fx = fixture();
  let containerReads = 0;
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async read(
      addresses: Parameters<Workspace['read']>[0],
      options?: Parameters<Workspace['read']>[1],
    ) {
      if (addresses[0]?.kind === 'device' && addresses[0].chain === undefined && options?.structure === true
          && ++containerReads === 2) {
        throw new Error('the final container read failed');
      }
      return fx.workspace.read(addresses, options);
    },
  });
  const request = fourSourceRequest(fx.trackId);
  const result = await callTool(workspace, 'compose_device_sources', {
    ...request, entries: request.entries.slice(0, 1),
  }) as Record<string, unknown>;
  assert.equal(result['complete'], false);
  assert.equal(result['failedStage'], 'final-witness');
  const checkpoint = result['reversalCheckpoint'] as { completedEntries: unknown[] };
  assert.deepEqual(checkpoint.completedEntries, [], 'nothing unobserved is claimed');

  const changes = fx.workspace.changes.list().length;
  const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint,
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], false);
  assert.match(String(reversed['why']), /structure changed/);
  assert.equal(fx.workspace.changes.list().length, changes, 'the unverified container is left for inspection');
});

test('5r-reversal: an untouched inserted seed reverses exactly', async () => {
  const fx = fixture();
  let containerReads = 0;
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async read(
      addresses: Parameters<Workspace['read']>[0],
      options?: Parameters<Workspace['read']>[1],
    ) {
      if (addresses[0]?.kind === 'device' && addresses[0].chain === undefined && options?.structure === true
          && ++containerReads === 1) {
        throw new Error('the inserted container did not settle');
      }
      return fx.workspace.read(addresses, options);
    },
  });
  const request = fourSourceRequest(fx.trackId);
  const result = await callTool(workspace, 'compose_device_sources', {
    ...request, entries: request.entries.slice(0, 1),
  }) as Record<string, unknown>;
  const checkpoint = result['reversalCheckpoint'] as { state: string; preparedEntryNames: string[] };
  assert.equal(checkpoint.state, 'container-positioned');
  assert.equal(checkpoint.preparedEntryNames.length, 1, 'the final read adopted the untouched seed');

  const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint,
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Existing Twin', 'Tool']);
});

test('5q-reversal: an unproved inserted container must be empty before removal', async () => {
  const fx = fixture();
  let containerReads = 0;
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async read(
      addresses: Parameters<Workspace['read']>[0],
      options?: Parameters<Workspace['read']>[1],
    ) {
      if (addresses[0]?.kind === 'device' && addresses[0].chain === undefined && options?.structure === true
          && ++containerReads === 1) {
        throw new Error('the inserted container did not settle');
      }
      return fx.workspace.read(addresses, options);
    },
  });
  const request = fourSourceRequest(fx.trackId);
  const result = await callTool(workspace, 'compose_device_sources', {
    ...request, entries: request.entries.slice(0, 1),
  }) as Record<string, unknown>;
  const checkpoint = result['reversalCheckpoint'] as { state: string };
  assert.equal(checkpoint.state, 'container-positioned');

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
  assert.match(String(reversed['why']), /structure changed/);
  assert.equal(container.chains![0]!.devices[0], unexpected);
  assert.deepEqual(
    fx.row.devices.map((item) => item.name),
    ['FX Layer', 'Existing Twin', 'Tool'],
    'a changed seed refuses before any write',
  );
});

test('5q-reversal: a copied source leaves with the owned container in one removal', async () => {
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

  const reversed = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint: composed['reversalCheckpoint'],
  }) as Record<string, unknown>;
  assert.equal(reversed['complete'], true, JSON.stringify(reversed));
  assert.deepEqual((reversed['stages'] as { stage: string }[]).map((item) => item.stage), ['remove-container']);
  assert.equal(fx.row.devices[0], fx.existing);
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Existing Twin', 'Tool']);

  const stale = await callTool(fx.workspace, 'reverse_device_source_composition', {
    checkpoint: composed['reversalCheckpoint'],
  }) as Record<string, unknown>;
  assert.equal(stale['refused'], true, 'a completed reversal checkpoint is no longer issued');
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
  const unexpected = {
    name: 'Unexpected nested device', enabled: false, paramsLive: true,
    params: [{
      id: 'CONTENTS/F1FREQ', name: 'Filter Frequency', value: 0.7,
      modulatedValue: 0.7, hasAutomation: false,
    }],
  };
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async apply(ops: Parameters<Workspace['apply']>[0], run?: Parameters<Workspace['apply']>[1]) {
      const change = await fx.workspace.apply(ops, run);
      if (ops[0]?.op === 'chain.insert') {
        fx.row.devices[0]!.chains![0]!.devices.push(unexpected);
        fx.fake.model.revision++;
      }
      return change;
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
  assert.deepEqual((result['structure'] as { devices: { name: string }[] }[])[0]!.devices.map((item) => item.name)
    .at(-1), 'Unexpected nested device', 'the result reports the observed structure');
});

test('8h4e compose_devices: the staged backend composes and revert_change reverses it by change ID', async () => {
  const fx = fixture();
  const request = fourSourceRequest(fx.trackId);
  const result = await callTool(fx.workspace, 'compose_devices', {
    trackId: fx.trackId,
    containerKind: 'FX Layer',
    // D44: the CLAP source would make 8 device units; the limit is 6.
    layerChains: request.entries.filter((entry) => entry.entryName !== 'CLAP').map((entry) => ({
      name: entry.entryName, devices: [{ source: entry.source, modulators: entry.modulators }],
    })),
  }, AGENT_NATIVE_TOOL_PROFILE) as {
    applied: boolean; readback: { status: string; backend: string };
    next: { revert: { tool: string; changeId: string } }; effects: { changeId: string }[];
  };
  assert.equal(result.applied, true, JSON.stringify(result).slice(0, 600));
  assert.equal(result.readback.backend, 'staged');
  assert.equal(result.readback.status, 'verified');
  assert.equal(result.next.revert.tool, 'revert_change');
  assert.ok(result.effects.length > 1);
  const checked = await callTool(fx.workspace, 'check_revert', { changeId: result.next.revert.changeId },
    AGENT_NATIVE_TOOL_PROFILE) as Record<string, unknown>;
  assert.equal((checked['data'] as Record<string, unknown>)['compositionReversal'], true);
  // 8h4f: the write envelope; each reversal stage is one effect.
  const reversed = await callTool(fx.workspace, 'revert_change', { changeId: result.next.revert.changeId },
    AGENT_NATIVE_TOOL_PROFILE) as { applied: boolean; readback: { status: string; compositionReversal: boolean };
      effects: { target: { undoOf: string } }[]; target: { changeId: string } };
  assert.equal(reversed.applied, true, JSON.stringify(reversed).slice(0, 600));
  assert.equal(reversed.readback.status, 'verified');
  assert.equal(reversed.readback.compositionReversal, true);
  assert.ok(reversed.effects.length > 0);
  assert.ok(reversed.effects.every((effect) => effect.target.undoOf === result.next.revert.changeId));
  assert.equal(reversed.target.changeId, result.next.revert.changeId);
  assert.deepEqual(fx.row.devices.map((item) => [item.name, item.enabled]), [
    ['Existing Twin', true], ['Tool', false],
  ]);
});

test('8h4e check_revert: the composition preview runs the first reversal guards and agrees with revert_change', async () => {
  const fx = fixture();
  const request = fourSourceRequest(fx.trackId);
  const result = await callTool(fx.workspace, 'compose_devices', {
    trackId: fx.trackId, containerKind: 'FX Layer',
    // D44: the CLAP source would make 8 device units; the limit is 6.
    layerChains: request.entries.filter((entry) => entry.entryName !== 'CLAP').map((entry) => ({
      name: entry.entryName, devices: [{ source: entry.source, modulators: entry.modulators }],
    })),
  }, AGENT_NATIVE_TOOL_PROFILE) as { next: { revert: { changeId: string } } };
  const changeId = result.next.revert.changeId;
  const data = async (): Promise<Record<string, unknown>> => ((await callTool(fx.workspace, 'check_revert', { changeId },
    AGENT_NATIVE_TOOL_PROFILE)) as { data: Record<string, unknown> }).data;
  const before = await data();
  assert.equal(before['wouldWriteAnything'], true, JSON.stringify(before));
  // An operator adds a device: the projected top-level order no longer holds.
  fx.row.devices.push({ name: 'Operator EQ', enabled: true, paramsLive: true, params: [] });
  fx.fake.model.revision += 1;
  const after = await data();
  assert.equal(after['wouldWriteAnything'], false, JSON.stringify(after));
  assert.equal(typeof after['why'], 'string');
  assert.equal('wouldRestore' in after, false);
  const devicesBefore = fx.row.devices.map((item) => item.name);
  const reversed = await callTool(fx.workspace, 'revert_change', { changeId }, AGENT_NATIVE_TOOL_PROFILE) as {
    failure: { code: string; effects: unknown[] }; detail: { failedStage: string } };
  assert.equal(reversed.failure.code, 'target-changed', JSON.stringify(reversed));
  assert.deepEqual(reversed.failure.effects, []);
  assert.equal(reversed.detail.failedStage, 'reversal-boundary');
  assert.deepEqual(fx.row.devices.map((item) => item.name), devicesBefore, 'the refused reversal wrote nothing');
});

test('8i5 review: agent-native compose_devices keeps the exact target identity check', async () => {
  for (const target of [
    { parameterId: 'CONTENTS/DOES_NOT_EXIST', parameterName: 'Nothing' },
    { parameterId: 'CONTENTS/F1FREQ', parameterName: 'Wrong Name' },
  ]) {
    const fx = fixture();
    const result = await callTool(fx.workspace, 'compose_devices', {
      trackId: fx.trackId, containerKind: 'FX Layer', containerPosition: 2,
      layerChains: [{ name: 'Copy', devices: [{ source: { kind: 'existing-copy', devicePosition: 0 },
        modulators: [{ ...outer, target }] }] }],
    }, AGENT_NATIVE_TOOL_PROFILE) as Record<string, any>;
    const text = JSON.stringify(result).slice(0, 800);
    assert.notEqual(result['readback']?.status, 'verified', text);
    assert.ok(result['failure'] !== undefined, text);
    assert.ok(result['failure'].effects.length > 0, `${text}: the recorded stages stay reversible`);
  }
  const fx = fixture();
  const valid = await callTool(fx.workspace, 'compose_devices', {
    trackId: fx.trackId, containerKind: 'FX Layer', containerPosition: 2,
    layerChains: [{ name: 'Copy', devices: [{ source: { kind: 'existing-copy', devicePosition: 0 },
      modulators: [outer] }] }],
  }, AGENT_NATIVE_TOOL_PROFILE) as Record<string, any>;
  assert.equal(valid['readback']?.status, 'verified', JSON.stringify(valid).slice(0, 800));
  assert.equal(valid['readback'].modulationClaim.behaviorWitness, 'not-run');
});

for (const [chainCount, devicesPerChain, initialCount] of [[6, 1, 2], [1, 5, 2], [6, 1, 18], [1, 5, 18]]) {
  test(`B17 composition: ${chainCount}x${devicesPerChain} at position ${initialCount}, and reversal`, async () => {
    const fx = fixture();
    while (fx.row.devices.length < initialCount!) {
      fx.row.devices.push({ name: `Anchor ${fx.row.devices.length}`, enabled: true, paramsLive: true, params: [] });
    }
    const before = structuredClone(fx.row.devices);
    const result = await callTool(fx.workspace, 'compose_devices', {
      trackId: fx.trackId, containerKind: 'FX Layer',
      layerChains: Array.from({ length: chainCount! }, (_, index) => ({ name: `Chain ${index}`,
        devices: Array.from({ length: devicesPerChain! }, () => ({ source: { kind: 'native', name: 'Tool' } })),
      })),
    }, AGENT_NATIVE_TOOL_PROFILE) as Record<string, any>;
    assert.equal(result.applied, true, JSON.stringify(result));
    assert.equal(result.readback.status, 'verified');
    assert.equal(result.effects.filter((effect: { summary: string }) =>
      effect.summary === 'Composition stage grow-entries.').length, Math.max(0, chainCount! - 5));
    const container = fx.row.devices[initialCount!]!;
    assert.equal(container.chains!.length, chainCount);
    assert.deepEqual(container.chains!.map(c => c.devices.length), Array(chainCount).fill(devicesPerChain));
    assert.deepEqual(fx.row.devices.slice(0, initialCount), before);
    const reversed = await callTool(fx.workspace, 'revert_change', {
      changeId: result.next.revert.changeId,
    }, AGENT_NATIVE_TOOL_PROFILE) as Record<string, any>;
    assert.equal(reversed.failure, undefined, JSON.stringify(reversed));
    assert.deepEqual(fx.row.devices, before);
  });
}

test('D67: compose_devices refuses nine layer chains before any write', async () => {
  const fx = fixture();
  const before = fx.workspace.changes.list().length;
  const result = await callTool(fx.workspace, 'compose_devices', {
    trackId: fx.trackId, containerKind: 'FX Layer', layerChains: Array.from({ length: 9 }, (_, i) => ({
      name: `Chain ${i}`, devices: [{ source: { kind: 'native', name: 'Tool' } }],
    })),
  }, AGENT_NATIVE_TOOL_PROFILE) as Record<string, any>;
  assert.equal(result.failure.code, 'outside-limit');
  assert.equal(fx.workspace.changes.list().length, before);
});

test('B17: an uncertain seed-growth result preserves the effect and stops before source insertion', async () => {
  const fx = fixture();
  let attempts = 0;
  const workspace: Workspace = { ...fx.workspace, async apply(ops, run) {
    const result = await fx.workspace.apply(ops, run);
    if (ops.some(op => op.op === 'chain.create')) {
      attempts++;
      throw new Error('growth acknowledgement lost');
    }
    return result;
  } };
  const result = await callTool(workspace, 'compose_device_sources', {
    trackId: fx.trackId, expectedDeviceOrder: [{ name: 'Existing Twin', enabled: true }, { name: 'Tool', enabled: false }],
    containerKind: 'FX Layer', containerPosition: 2,
    entries: Array.from({ length: 6 }, (_, i) => ({ entryName: `Chain ${i}`,
      source: { kind: 'native', name: 'Tool' }, modulators: [] })),
  }) as Record<string, any>;
  assert.equal(result.complete, false);
  assert.equal(result.partialCompletion, true);
  assert.equal(result.failedStage, 'grow-entries');
  assert.equal(result.reversalCheckpoint.seedUnchanged, false);
  assert.equal(attempts, 1);
  assert.equal(fx.row.devices.length, 3);
  assert.equal(fx.row.devices[2]!.chains!.length, 6);
  assert(fx.row.devices[2]!.chains!.every(c => c.devices.length === 0));
});

test('B17: lost first-insertion readback reports possible effects without replay or an invented reversal', async () => {
  const fx = fixture();
  let attempts = 0;
  const workspace: Workspace = { ...fx.workspace, async apply(ops, run) {
    attempts++;
    await fx.workspace.apply(ops, run);
    throw new Error('window population changed during paging');
  } };
  const result = await callTool(workspace, 'compose_devices', {
    trackId: fx.trackId, containerKind: 'FX Layer',
    layerChains: [{ name: 'A', devices: Array.from({ length: 5 }, () => ({ source: { kind: 'native', name: 'Tool' } })) }],
  }, AGENT_NATIVE_TOOL_PROFILE) as Record<string, any>;
  assert.equal(attempts, 1);
  assert.equal(fx.row.devices.length, 3);
  assert.equal(fx.row.devices[2]!.name, 'FX Layer');
  assert.equal(result.failure.code, 'unavailable');
  assert.equal(result.failure.stage, 'write');
  assert.equal(result.detail.effectsPossible, true);
  assert.equal(result.detail.compositionChangeId, null);
  assert.match(result.message, /insertion may have applied/);
  assert.doesNotMatch(result.message, /Nothing was written|revert_change/);
});

test('D65 call budget: staged compose_devices and revert_change make a fixed number of adapter calls', async () => {
  const budget = async (chains: number, devices: number) => {
    const fx = fixture();
    const counts: Record<string, number> = {};
    const fake = fx.fake as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
    for (const name of ['revision', 'contentSince', 'tracks', 'devices', 'resolve', 'apply', 'read']) {
      const original = fake[name]!.bind(fx.fake);
      fake[name] = async (...args: unknown[]) => {
        const key = name === 'read' && (args[1] as { structure?: boolean } | undefined)?.structure === true
          ? 'structureRead' : name;
        counts[key] = (counts[key] ?? 0) + 1;
        return original(...args);
      };
    }
    const composed = await callTool(fx.workspace, 'compose_devices', {
      trackId: fx.trackId, containerKind: 'FX Layer',
      layerChains: Array.from({ length: chains }, (_, index) => ({ name: `Budget ${index}`,
        devices: Array.from({ length: devices }, () => ({ source: { kind: 'native', name: 'Tool' } })) })),
    }, AGENT_NATIVE_TOOL_PROFILE) as Record<string, any>;
    assert.equal(composed['readback']?.status, 'verified', JSON.stringify(composed));
    const composeCounts = { ...counts };
    for (const key of Object.keys(counts)) delete counts[key];
    const reversed = await callTool(fx.workspace, 'revert_change', {
      changeId: composed['next'].revert.changeId,
    }, AGENT_NATIVE_TOOL_PROFILE) as Record<string, any>;
    assert.equal(reversed['failure'], undefined, JSON.stringify(reversed));
    assert.deepEqual(fx.row.devices.map((item) => item.name), ['Existing Twin', 'Tool']);
    return { compose: composeCounts, revert: { ...counts } };
  };
  const one = await budget(1, 1);
  const six = await budget(3, 2);
  // Container insertion at the track end, naming, and one batch of direct chain insertions. Each executor run
  // reads its stash and verify marks and one delta; the surface makes the one initial bank read.
  assert.deepEqual(one.compose, { devices: 1, read: 6, apply: 3, contentSince: 3, structureRead: 2 },
    'structure reads: the seed names and the final result');
  // Six devices in three chains cost the same calls as one device: no per-device stage, proof or inventory.
  assert.deepEqual(six.compose, one.compose);
  // Reversal: a top-level and a container guard read, one owned removal (structural stash and verify, E404) and
  // one final top-level read.
  assert.deepEqual(one.revert, { devices: 2, structureRead: 3, resolve: 1, apply: 1, contentSince: 1 });
  assert.deepEqual(six.revert, one.revert);
  // P01: chains beyond the five-chain seed are grown in one apply, which adds that apply and its marks.
  const sixChains = await budget(6, 1);
  assert.deepEqual(sixChains.compose, { ...one.compose, read: 8, apply: 4, contentSince: 4 });
  assert.deepEqual(sixChains.revert, one.revert);
});
