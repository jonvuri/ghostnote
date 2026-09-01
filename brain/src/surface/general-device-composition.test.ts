import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { z } from 'zod';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { listModulators } from '../bwmod/index.js';
import { Executor, fingerprintPreset } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callTool, TOOLS } from './tools.js';
import {
  generalDeviceCompositionInputSchema,
} from './general-device-composition.js';
import { workspaceOf, type Workspace } from './workspace.js';

const PRESET = join(import.meta.dirname, '..', '..', 'fixtures', 'Polysynth', 'mp_bare.bwpreset');
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
          if (op.expectedDeviceName === 'FX Layer' && preset !== undefined) {
            inserted.name = 'FX Layer';
            inserted.paramsLive = true;
            inserted.params = [];
            inserted.chains = [{
              name: 'Layer 1', id: fake.model.mintChannelId(), solo: false, devices: [],
            }];
            inserted.remotePages = listModulators(preset, 0).map((item) => ({
              name: item.deviceName,
              controls: [{ name: 'Rate', value: 0.5, modulatedValue: 0.5, hasAutomation: false }],
            }));
          } else {
            if (op.source.from === 'vst3' || op.source.from === 'clap') inserted.name = 'Repeated Twin';
            inserted.paramsLive = true;
            const sampler = op.source.from === 'file' && op.source.path.includes('gn_sampler');
            inserted.params = [{
              id: sampler ? 'CONTENTS/AMP_ATTACK_TIME' : 'CONTENTS/F1FREQ',
              name: sampler ? 'AEG Attack Time' : 'Filter Frequency', value: 0.31,
              modulatedValue: 0.31, hasAutomation: false,
            }];
            if (preset !== undefined) {
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
        const container = row.devices[destination.container.chainIndex]!;
        const entry = container.chains!.find((item) => item.name === destination.name)!;
        const nested = entry.devices[entry.devices.length - 1]!;
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
    'device.insert', 'device.relocate', 'chain.rename', 'chain.create', 'chain.relocate',
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

test('5q-capacity: the fifth entry refuses before any project write', async () => {
  const fx = fixture();
  const request = fourSourceRequest(fx.trackId);
  await assert.rejects(callTool(fx.workspace, 'compose_device_sources', {
    ...request,
    entries: [...request.entries, {
      entryName: 'Fifth', source: { kind: 'existing-copy', devicePosition: 0 }, modulators: [outer],
    }],
  }), /Too big|maximum|4/i);
  assert.equal(fx.workspace.changes.list().length, 0);
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

test('5q-partial: prepared entry names stay exact after a later create fails', async () => {
  const fx = fixture();
  let creates = 0;
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async apply(
      ops: Parameters<Workspace['apply']>[0],
      run?: Parameters<Workspace['apply']>[1],
    ) {
      if (ops[0]?.op === 'chain.create' && ++creates === 2) {
        throw new Error('the later entry could not be created');
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
  assert.deepEqual(checkpoint.preparedEntryNames, ['Native', 'VST3']);

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
  assert.match(String(reversed['why']), /structure changed|not empty/);
  assert.equal(container.chains![0]!.devices[0], unexpected);
  assert.ok(fx.row.devices.includes(container));
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
  assert.match(String(reversed['why']), /project changed|device order/);
  assert.ok(fx.row.devices.includes(intervening));
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
