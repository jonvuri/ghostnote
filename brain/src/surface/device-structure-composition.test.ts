import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { z } from 'zod';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { listModulators } from '../bwmod/index.js';
import {
  NATIVE_CATALOG_PATH, type CompositionEntryRequest,
} from '../composition/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callTool, TOOLS } from './tools.js';
import {
  deviceStructureCompositionInputSchema, runDeviceStructureComposition,
} from './device-structure-composition.js';
import { cancellableWorkspace, workspaceOf, type Workspace } from './workspace.js';

const REQUEST = {
  entries: [
    {
      deviceName: 'Polysynth',
      modulators: [{
        kind: 'add' as const,
        modulator: 'lfo' as const,
        target: 'polysynth-filter-frequency' as const,
        amount: 1,
      }],
    },
    {
      deviceName: 'Sampler',
      modulators: [{
        kind: 'add' as const,
        modulator: 'lfo' as const,
        target: 'sampler-amp-attack' as const,
        amount: 1,
      }],
    },
  ],
};

interface Fixture {
  readonly fake: FakeAdapter;
  readonly workspace: Workspace;
  readonly trackId: string;
  readonly presets: Buffer[];
}

function fixture(
  entries: readonly CompositionEntryRequest[] = REQUEST.entries,
  decorate = true,
): Fixture {
  const fake = new FakeAdapter({ tracks: ['Composition'], scenes: 1 });
  const trackId = fake.model.visibleTracks()[0]!.channelId;
  const stash = new Stash({ now: () => 1 });
  const base = workspaceOf({
    ready: async () => undefined,
    adapter: fake,
    executor: new Executor(fake, {
      newId: () => `composition-change-${stash.log.list().length + 1}`,
      now: () => 2,
    }),
    stash,
    observationStore: new FakeObservationStore(),
  });
  const presets: Buffer[] = [];
  const workspace: Workspace = Object.freeze({
    ...base,
    async apply(
      ops: Parameters<Workspace['apply']>[0],
      options?: Parameters<Workspace['apply']>[1],
    ) {
      const insert = ops[0];
      const preset = insert?.op === 'device.insert' && insert.source.from === 'file'
        ? await readFile(insert.source.path)
        : undefined;
      const change = await base.apply(ops, options);
      if (preset !== undefined) {
        presets.push(preset);
        const minted = change.take.receipt.minted[0];
        if (decorate && minted?.kind === 'device') {
          const device = fake.model.findByChannelId(trackId)!.track.devices[minted.chainIndex]!;
          device.name = 'Instrument Layer';
          device.paramsLive = true;
          device.params = [];
          device.chains = entries.map((entry, index) => ({
            name: `gn-entry-${index}`,
            id: `gn-entry-id-${index}`,
            solo: false,
            devices: [{
              name: entry.deviceName,
              paramsLive: true,
              params: [],
              remotePages: remotePages(preset, index + 1),
            }],
          }));
        }
      }
      return change;
    },
  });
  return { fake, workspace, trackId, presets };
}

function remotePages(preset: Buffer, listIndex: number) {
  const modulators = listModulators(preset, listIndex);
  const routes = modulators.flatMap((modulator) => modulator.routes);
  return [
    ...modulators.map((modulator) => ({
      name: modulator.deviceName,
      controls: [{ name: 'Rate', value: 0.5, modulatedValue: 0.5, hasAutomation: false }],
    })),
    {
      name: 'FILTER',
      controls: [{
        name: 'Filt Freq', value: 0.4,
        modulatedValue: routes.some((route) => route.target === 'CONTENTS/F1FREQ') ? 0.75 : 0.4,
        hasAutomation: false,
      }],
    },
    {
      name: 'Amp EG',
      controls: [{
        name: 'Attack', value: 0.2,
        modulatedValue: routes.some((route) => route.target === 'CONTENTS/AMP_ATTACK_TIME') ? 0.6 : 0.2,
        hasAutomation: false,
      }],
    },
  ];
}

test('5h-schema: public input hides every asset and binary control', () => {
  const tool = TOOLS.find((candidate) => candidate.name === 'compose_device_structure');
  assert.ok(tool !== undefined);
  assert.equal(tool.kind, 'write');
  assert.deepEqual(tool.emits, ['device.insert']);
  const schema = JSON.stringify(z.toJSONSchema(z.object(deviceStructureCompositionInputSchema)));
  for (const hidden of [
    'presetPath', 'templatePath', 'uuid', 'guid', 'chainStart', 'chainEnd', 'listIndex',
    'donorId', 'route', 'footprint', 'offset', 'assetPath', 'CONTENTS/',
  ]) {
    assert.equal(schema.toLowerCase().includes(hidden.toLowerCase()), false, `${hidden} crossed the schema`);
  }
});

test('5h-public: one complete request reports distinct facts and reverses its recorded insertion', async () => {
  const fx = fixture();
  const result = await callTool(fx.workspace, 'compose_device_structure', {
    trackId: fx.trackId,
    ...REQUEST,
  }) as Record<string, unknown>;

  assert.equal(result['applied'], true, JSON.stringify(result));
  assert.deepEqual((result['requested'] as { entryOrder: string[] }).entryOrder, ['Polysynth', 'Sampler']);
  assert.deepEqual((result['observed'] as { entryOrder: string[] }).entryOrder, ['Polysynth', 'Sampler']);
  const validated = result['validated'] as {
    entries: { modulators: { name: string }[] }[]; warnings: string[];
  };
  assert.deepEqual(validated.entries.map((item) => item.modulators.map((modulator) => modulator.name)), [
    ['Vibrato', 'Expressions', 'LFO'],
    ['Vibrato', 'Expressions', 'LFO'],
  ]);
  assert.deepEqual(validated.warnings, []);
  const verification = result['verification'] as { verified: boolean; witnesses: unknown[] };
  assert.equal(verification.verified, true, JSON.stringify(result));
  assert.equal(verification.witnesses.length, 2);
  const change = result['change'] as { changeId: string; canBeUndone: boolean };
  assert.equal(change.changeId, 'composition-change-1');
  assert.equal(change.canBeUndone, true);
  assert.equal(fx.presets.length, 1);

  const encoded = JSON.stringify(result);
  assert.doesNotMatch(encoded, /bwpreset|template|manifest|uuid|guid|listIndex|donor|footprint|offset|CONTENTS\//i);

  const reversed = await callTool(fx.workspace, 'revert_change', { changeId: change.changeId }) as {
    applied: boolean;
  };
  assert.equal(reversed.applied, true, JSON.stringify(reversed));
  assert.deepEqual(fx.fake.model.findByChannelId(fx.trackId)!.track.devices, []);
});

test('5h-editors: all five named edits cross the public runner', async () => {
  const entries = [{
    deviceName: 'Polysynth',
    modulators: [
      { kind: 'add' as const, modulator: 'lfo' as const,
        target: 'polysynth-filter-frequency' as const, amount: 0.4 },
      { kind: 'amount' as const, modulator: 'LFO',
        target: 'polysynth-filter-frequency' as const, amount: 0.6 },
      { kind: 'replace' as const, existing: 'Vibrato', modulator: 'random' as const },
      { kind: 'retarget' as const, modulator: 'Random',
        target: 'polysynth-filter-frequency' as const, amount: 0.7 },
      { kind: 'delete' as const, modulator: 'Expressions' },
    ],
  }];
  const fx = fixture(entries);
  const result = await callTool(fx.workspace, 'compose_device_structure', {
    trackId: fx.trackId,
    entries,
  }) as Record<string, unknown>;

  assert.equal(result['applied'], true, JSON.stringify(result));
  assert.deepEqual(
    ((result['requested'] as { entries: { modulators: { kind: string }[] }[] })
      .entries[0]?.modulators ?? []).map((edit) => edit.kind),
    ['add', 'amount', 'replace', 'retarget', 'delete'],
  );
  const validated = result['validated'] as {
    entries: { modulators: { name: string }[] }[];
  };
  assert.deepEqual(validated.entries[0]?.modulators.map((modulator) => modulator.name), [
    'Random', 'LFO',
  ]);
  const verification = result['verification'] as { verified: boolean; witnesses: unknown[] };
  assert.equal(verification.verified, true, JSON.stringify(result));
  assert.equal(verification.witnesses.length, 5);
});

test('5h-refusals: request shape, repeated names, and incompatible targets stop before apply', async () => {
  const invalid = [
    { entries: [] },
    { entries: Array.from({ length: 5 }, () => ({ deviceName: 'Sampler' })) },
    { entries: [{ deviceName: 'Sampler' }, { deviceName: 'Sampler' }] },
    { entries: [{
      deviceName: 'Sampler',
      modulators: [{
        kind: 'add', modulator: 'lfo', target: 'polysynth-filter-frequency', amount: 1,
      }],
    }] },
    { entries: [{
      deviceName: 'Sampler',
      modulators: [{ kind: 'add', modulator: 'unsupported', target: 'sampler-amp-attack', amount: 1 }],
    }] },
  ];
  for (const request of invalid) {
    const fx = fixture();
    await assert.rejects(callTool(fx.workspace, 'compose_device_structure', {
      trackId: fx.trackId,
      ...request,
    }));
    assert.equal(fx.workspace.changes.list().length, 0);
  }
});

test('5h-refusal: an unknown exact device name writes nothing', async () => {
  const fx = fixture([{ deviceName: 'No Such Device' }]);
  const result = await callTool(fx.workspace, 'compose_device_structure', {
    trackId: fx.trackId,
    entries: [{ deviceName: 'No Such Device' }],
  }) as Record<string, unknown>;
  assert.equal(result['refused'], true, JSON.stringify(result));
  assert.equal(result['nothingWasWritten'], true);
  assert.match(result['why'] as string, /not in the current catalog/i);
  assert.equal(fx.workspace.changes.list().length, 0);
  assert.equal(fx.presets.length, 0);
});

test('5h-refusal: an ambiguous exact catalog match writes nothing', async () => {
  const fx = fixture([{ deviceName: 'Polysynth' }]);
  const directory = await mkdtemp(join(tmpdir(), 'ghostnote-5h-test-'));
  try {
    const catalog = JSON.parse(await readFile(NATIVE_CATALOG_PATH, 'utf8')) as {
      devices: Record<string, unknown>[];
    };
    const device = catalog.devices.find((item) => item['name'] === 'Polysynth');
    assert.ok(device !== undefined);
    catalog.devices.push({ ...device });
    const catalogPath = join(directory, 'catalog.json');
    await writeFile(catalogPath, JSON.stringify(catalog));

    const result = await runDeviceStructureComposition(fx.workspace, {
      trackId: fx.trackId,
      entries: [{ deviceName: 'Polysynth' }],
    }, { catalogPath }) as Record<string, unknown>;
    assert.equal(result['refused'], true, JSON.stringify(result));
    assert.match(result['why'] as string, /more than one catalog entry/i);
    assert.equal(fx.workspace.changes.list().length, 0);
    assert.equal(fx.presets.length, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('5h-refusal: failed final validation stays before the project write', async () => {
  const fx = fixture([{ deviceName: 'Sampler' }]);
  const result = await runDeviceStructureComposition(fx.workspace, {
    trackId: fx.trackId,
    entries: [{ deviceName: 'Sampler' }],
  }, {
    compose: {
      beforeValidate(preset) { preset.fill(0, 0, 16); },
    },
  }) as Record<string, unknown>;
  assert.equal(result['refused'], true, JSON.stringify(result));
  assert.match(result['why'] as string, /complete pre-write checks/i);
  assert.equal(fx.workspace.changes.list().length, 0);
  assert.equal(fx.presets.length, 0);
});

test('5h-verification: a failed live witness keeps the recorded insertion visible', async () => {
  const fx = fixture(REQUEST.entries, false);
  const result = await callTool(fx.workspace, 'compose_device_structure', {
    trackId: fx.trackId,
    ...REQUEST,
  }) as Record<string, unknown>;
  assert.equal(result['applied'], true, JSON.stringify(result));
  assert.equal((result['verification'] as { verified: boolean }).verified, false);
  assert.equal((result['change'] as { changeId: string }).changeId, 'composition-change-1');
  assert.equal(fx.workspace.changes.list().length, 1);
  assert.equal(result['nothingWasWritten'], undefined);
});

test('5h-cancellation: a stop after apply propagates and keeps the recorded change', async () => {
  const fx = fixture();
  const controller = new AbortController();
  const abortAfterApply: Workspace = Object.freeze({
    ...fx.workspace,
    async apply(
      ops: Parameters<Workspace['apply']>[0],
      options?: Parameters<Workspace['apply']>[1],
    ) {
      const change = await fx.workspace.apply(ops, options);
      controller.abort('cancelled by caller');
      return change;
    },
  });

  await assert.rejects(
    callTool(cancellableWorkspace(abortAfterApply, controller.signal), 'compose_device_structure', {
      trackId: fx.trackId,
      ...REQUEST,
    }),
    (error) => error === 'cancelled by caller',
  );
  assert.equal(fx.workspace.changes.list().length, 1);
  assert.equal(fx.fake.model.findByChannelId(fx.trackId)!.track.devices.length, 1);
});

test('5h-cancellation: a stop during post-write readback propagates', async () => {
  const fx = fixture();
  const controller = new AbortController();
  let reads = 0;
  const abortDuringRead: Workspace = Object.freeze({
    ...fx.workspace,
    async read(addresses: Parameters<Workspace['read']>[0]) {
      const snapshot = await fx.workspace.read(addresses);
      reads += 1;
      if (reads === 1) controller.abort('cancelled during verification');
      return snapshot;
    },
  });

  await assert.rejects(
    callTool(cancellableWorkspace(abortDuringRead, controller.signal), 'compose_device_structure', {
      trackId: fx.trackId,
      ...REQUEST,
    }),
    (error) => error === 'cancelled during verification',
  );
  assert.equal(fx.workspace.changes.list().length, 1);
  assert.equal(fx.fake.model.findByChannelId(fx.trackId)!.track.devices.length, 1);
});

for (const cancellation of [
  { stage: 'structure readback', readNumber: 1 },
  { stage: 'remote-page inventory', readNumber: 2 },
  { stage: 'remote sampling', readNumber: 4 },
] as const) {
  test(`5h-cancellation: an Error reason propagates during ${cancellation.stage}`, async () => {
    const fx = fixture();
    const controller = new AbortController();
    const reason = new Error(`cancelled during ${cancellation.stage}`);
    let reads = 0;
    const abortDuringRead: Workspace = Object.freeze({
      ...fx.workspace,
      async read(addresses: Parameters<Workspace['read']>[0]) {
        const snapshot = await fx.workspace.read(addresses);
        reads += 1;
        if (reads === cancellation.readNumber) controller.abort(reason);
        return snapshot;
      },
    });

    await assert.rejects(
      callTool(cancellableWorkspace(abortDuringRead, controller.signal), 'compose_device_structure', {
        trackId: fx.trackId,
        ...REQUEST,
      }),
      (error) => error === reason,
    );
    assert.equal(fx.workspace.changes.list().length, 1);
    assert.equal(fx.fake.model.findByChannelId(fx.trackId)!.track.devices.length, 1);
  });
}

test('5h-cancellation: a stop before inspection writes nothing', async () => {
  const fx = fixture();
  const controller = new AbortController();
  controller.abort('cancelled before write');
  const result = await callTool(
    cancellableWorkspace(fx.workspace, controller.signal),
    'compose_device_structure',
    { trackId: fx.trackId, ...REQUEST },
  ) as Record<string, unknown>;
  assert.equal(result['refused'], true, JSON.stringify(result));
  assert.equal(result['nothingWasWritten'], true);
  assert.equal(fx.workspace.changes.list().length, 0);
  assert.equal(fx.fake.model.findByChannelId(fx.trackId)!.track.devices.length, 0);
});
