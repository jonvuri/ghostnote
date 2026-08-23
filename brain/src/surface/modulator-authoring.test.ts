import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { z } from 'zod';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { listModulators } from '../bwmod/index.js';
import { FIXTURE_DIR } from '../bwmod/fixtures.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callTool, TOOLS } from './tools.js';
import {
  modulatorAuthoringInputSchema,
} from './modulator-authoring.js';
import { cancellableWorkspace, workspaceOf, type Workspace } from './workspace.js';

interface Fixture {
  readonly fake: FakeAdapter;
  readonly workspace: Workspace;
  readonly trackId: string;
  readonly appliedPresets: Buffer[];
}

function fixture(): Fixture {
  const fake = new FakeAdapter({ tracks: ['Authoring'], scenes: 1 });
  const trackId = fake.model.visibleTracks()[0]!.channelId;
  const stash = new Stash({ now: () => 1 });
  const base = workspaceOf({
    ready: async () => undefined,
    adapter: fake,
    executor: new Executor(fake, { newId: () => `surface-change-${stash.log.list().length + 1}`, now: () => 2 }),
    stash,
    observationStore: new FakeObservationStore(),
  });
  const appliedPresets: Buffer[] = [];
  const workspace: Workspace = Object.freeze({
    ...base,
    async apply(
      ops: Parameters<Workspace['apply']>[0],
      options?: Parameters<Workspace['apply']>[1],
    ) {
      const inserted = ops[0];
      const preset = inserted?.op === 'device.insert' && inserted.source.from === 'file'
        ? await readFile(inserted.source.path)
        : undefined;
      const change = await base.apply(ops, options);
      if (preset !== undefined) {
        appliedPresets.push(preset);
        const minted = change.take.receipt.minted[0];
        if (minted?.kind === 'device') {
          const device = fake.model.findByChannelId(trackId)!.track.devices[minted.chainIndex]!;
          const modulators = listModulators(preset);
          const routes = modulators.flatMap((modulator) => modulator.routes);
          const active = (target: string): boolean => routes.some((route) => route.target === target);
          device.name = 'Authored preset';
          device.remotePages = [
            {
              name: 'FILTER',
              controls: [
                {
                  name: 'Filt Freq', value: 0.4,
                  modulatedValue: active('CONTENTS/F1FREQ') ? 0.7 : 0.4,
                  hasAutomation: false,
                },
                {
                  name: 'Reso', value: 0.3,
                  modulatedValue: active('CONTENTS/F1RESO') ? 0.65 : 0.3,
                  hasAutomation: false,
                },
              ],
            },
            {
              name: 'Amp EG',
              controls: [{
                name: 'Attack', value: 0.2,
                modulatedValue: active('CONTENTS/AMP_ATTACK_TIME') ? 0.55 : 0.2,
                hasAutomation: false,
              }],
            },
            ...modulators
              .filter((modulator) => modulator.deviceName !== 'Expressions')
              .map((modulator) => ({
                name: modulator.deviceName,
                controls: [{ name: 'Rate', value: 0.5, modulatedValue: 0.5, hasAutomation: false }],
              })),
          ];
        }
      }
      return change;
    },
  });
  return { fake, workspace, trackId, appliedPresets };
}

const poly = (name: string): string => join(FIXTURE_DIR, 'Polysynth', `${name}.bwpreset`);

test('5f-schema: the public contract hides all format and donor controls', () => {
  const tool = TOOLS.find((candidate) => candidate.name === 'author_modulators');
  assert.ok(tool !== undefined);
  assert.equal(tool.kind, 'write');
  assert.deepEqual(tool.emits, ['device.insert']);
  const schema = JSON.stringify(z.toJSONSchema(z.object(modulatorAuthoringInputSchema)));
  for (const hidden of [
    'donorId', 'templatePath', 'listIndex', 'routeIndex', 'removedFootprint',
    'insertedFootprint', 'stubDelta', 'CONTENTS/',
  ]) {
    assert.equal(schema.includes(hidden), false, `${hidden} crossed the public schema`);
  }
});

test('5f-add: named type and target record one insertion and prove exact live behavior', async () => {
  const fx = fixture();
  const result = await callTool(fx.workspace, 'author_modulators', {
    trackId: fx.trackId,
    presetPath: poly('mp_bare'),
    operation: {
      kind: 'add', modulator: 'lfo', target: 'polysynth-filter-frequency', amount: 1,
    },
  }) as Record<string, unknown>;

  assert.equal(result['applied'], true, JSON.stringify(result));
  assert.equal((result['verification'] as { verified: boolean }).verified, true, JSON.stringify(result));
  const change = result['change'] as { changeId: string; canBeUndone: boolean };
  assert.equal(change.changeId, 'surface-change-1');
  assert.equal(change.canBeUndone, true);
  assert.equal(fx.workspace.changes.require(change.changeId).take.id, change.changeId);
  assert.equal(fx.appliedPresets.length, 1);
  assert.deepEqual(
    listModulators(fx.appliedPresets[0]!).map((modulator) => modulator.deviceName),
    ['LFO'],
  );

  const reversed = await callTool(fx.workspace, 'revert_change', { changeId: change.changeId }) as {
    applied: boolean;
  };
  assert.equal(reversed.applied, true, JSON.stringify(reversed));
  assert.deepEqual(fx.fake.model.findByChannelId(fx.trackId)!.track.devices, []);
});

test('5f-sampled-add: the public measured asset adjusts every sample reference', async () => {
  const fx = fixture();
  const result = await callTool(fx.workspace, 'author_modulators', {
    trackId: fx.trackId,
    presetPath: join(FIXTURE_DIR, 'Sampler', 'gn_sampler_multi_bare.bwpreset'),
    operation: {
      kind: 'add', modulator: 'lfo', target: 'sampler-amp-attack', amount: 1,
    },
  }) as Record<string, unknown>;

  assert.equal(result['applied'], true, JSON.stringify(result));
  assert.equal(result['sampledPreset'], true);
  assert.equal(result['adjustedSampleReferences'], 4);
  assert.equal((result['verification'] as { verified: boolean }).verified, true, JSON.stringify(result));
  assert.doesNotMatch(JSON.stringify(result), /footprint|stub|offset|CONTENTS\//i);
});

test('5f-edit: replace, retarget, and delete use exact public witnesses', async () => {
  const cases = [
    {
      operation: { kind: 'replace', position: 0, modulator: 'classic-lfo' },
      pageChecks: [
        { pageName: 'Classic LFO', expectedCount: 1 },
        { pageName: 'Vibrato', expectedCount: 0 },
      ],
      after: ['Classic LFO', 'Expressions', 'LFO'],
    },
    {
      operation: { kind: 'retarget', position: 2, target: 'polysynth-filter-resonance' },
      behaviorChecks: [
        { expected: 'inactive', target: 'polysynth-filter-frequency' },
        { expected: 'active', target: 'polysynth-filter-resonance' },
      ],
      after: ['Vibrato', 'Expressions', 'LFO'],
    },
    {
      operation: { kind: 'delete', position: 2 },
      pageChecks: [{ pageName: 'LFO', expectedCount: 0 }],
      behaviorChecks: [{ expected: 'inactive', target: 'polysynth-filter-frequency' }],
      after: ['Vibrato', 'Expressions'],
    },
  ] as const;

  for (const item of cases) {
    const fx = fixture();
    const result = await callTool(fx.workspace, 'author_modulators', {
      trackId: fx.trackId,
      presetPath: poly('modtest'),
      operation: item.operation,
      ...('pageChecks' in item ? { pageChecks: item.pageChecks } : {}),
      ...('behaviorChecks' in item ? { behaviorChecks: item.behaviorChecks } : {}),
    }) as Record<string, unknown>;
    assert.equal(result['applied'], true, JSON.stringify(result));
    assert.equal((result['verification'] as { verified: boolean }).verified, true, JSON.stringify(result));
    assert.deepEqual(
      (result['modulatorsAfter'] as { name: string }[]).map((modulator) => modulator.name),
      item.after,
    );
    const encoded = JSON.stringify(result);
    assert.doesNotMatch(encoded, /CONTENTS\/|Footprint|donorId|stubDelta/);
  }
});

test('5f-refusal: an unmeasured sampled asset refuses before apply without internal details', async () => {
  const fx = fixture();
  const result = await callTool(fx.workspace, 'author_modulators', {
    trackId: fx.trackId,
    presetPath: join(FIXTURE_DIR, 'Sampler', 'gn_sampler_multi_one_lfo.bwpreset'),
    operation: { kind: 'replace', position: 0, modulator: 'expressions' },
    pageChecks: [{ pageName: 'Expressions', expectedCount: 1 }],
  }) as Record<string, unknown>;

  assert.equal(result['refused'], true, JSON.stringify(result));
  assert.equal(result['nothingWasWritten'], true);
  assert.match(result['why'] as string, /sampled preset.*exact measured adjustment/i);
  assert.equal(fx.appliedPresets.length, 0);
  assert.equal(fx.workspace.changes.list().length, 0);
  assert.doesNotMatch(JSON.stringify(result), /footprint|donor|stub|offset/i);
});

test('5f-cancellation: an abort after a recorded insert cannot claim that nothing was written', async () => {
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
    callTool(cancellableWorkspace(abortAfterApply, controller.signal), 'author_modulators', {
      trackId: fx.trackId,
      presetPath: poly('mp_bare'),
      operation: {
        kind: 'add', modulator: 'lfo', target: 'polysynth-filter-frequency', amount: 1,
      },
    }),
    (error) => error === 'cancelled by caller',
  );
  assert.equal(fx.fake.model.findByChannelId(fx.trackId)!.track.devices.length, 1);
  assert.equal(fx.workspace.changes.list().length, 1);
});
