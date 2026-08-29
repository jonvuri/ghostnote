import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { listModulators } from '../bwmod/index.js';
import { TemplateCompositionError, type CompositionEntryRequest } from '../composition/index.js';
import { track, type Op, type TrackAddress } from '../contract/index.js';
import { Executor } from './executor.js';
import {
  buildOwnedTemplateComposition, type OwnedTemplateCompositionHost,
} from './owned-template-composition.js';

interface CompositionFixture {
  readonly fake: FakeAdapter;
  readonly executor: Executor;
  readonly host: OwnedTemplateCompositionHost;
  readonly track: TrackAddress;
  readonly calls: Op[][];
  readonly paths: string[];
  readonly presets: Buffer[];
}

function fixture(entries: readonly CompositionEntryRequest[]): CompositionFixture {
  const fake = new FakeAdapter({ tracks: ['Composition'], scenes: 1 });
  const trackRef = track(fake.model.visibleTracks()[0]!.channelId);
  const executor = new Executor(fake, { newId: () => 'composition-take', now: () => 5 });
  const calls: Op[][] = [];
  const paths: string[] = [];
  const presets: Buffer[] = [];
  const host: OwnedTemplateCompositionHost = {
    read: (addresses) => fake.read(addresses),
    async apply(ops, options) {
      calls.push([...ops]);
      const insert = ops[0];
      let preset: Buffer | undefined;
      if (insert?.op === 'device.insert' && insert.source.from === 'file') {
        paths.push(insert.source.path);
        preset = await readFile(insert.source.path);
        presets.push(preset);
      }
      const take = await executor.run(ops, options);
      const minted = take.receipt.minted[0];
      if (minted?.kind === 'device' && preset !== undefined) {
        const inserted = fake.model.findByChannelId(trackRef.channelId)!.track.devices[minted.chainIndex]!;
        inserted.name = 'Instrument Layer';
        inserted.paramsLive = true;
        inserted.params = [];
        inserted.chains = entries.map((entry, index) => ({
          name: `gn-entry-${index}`,
          id: `gn-entry-id-${index}`,
          solo: false,
          devices: [{
            name: entry.deviceName,
            paramsLive: true,
            params: directParameters(preset!, index + 1),
            remotePages: remotePages(preset!, index + 1),
          }],
        }));
      }
      return { take };
    },
  };
  return { fake, executor, host, track: trackRef, calls, paths, presets };
}

function directParameters(preset: Buffer, listIndex: number) {
  const routes = listModulators(preset, listIndex).flatMap((modulator) => modulator.routes);
  return [
    {
      id: 'CONTENTS/F1FREQ', name: 'Filter Frequency', value: 0.4,
      modulatedValue: routes.some((route) => route.target === 'CONTENTS/F1FREQ') ? 0.75 : 0.4,
      hasAutomation: false,
    },
    {
      id: 'CONTENTS/AMP_ATTACK_TIME', name: 'AEG Attack Time', value: 0.2,
      modulatedValue: routes.some((route) => route.target === 'CONTENTS/AMP_ATTACK_TIME') ? 0.6 : 0.2,
      hasAutomation: false,
    },
  ];
}

function remotePages(preset: Buffer, listIndex: number) {
  const routes = listModulators(preset, listIndex).flatMap((modulator) => modulator.routes);
  const modulatorPages = listModulators(preset, listIndex).map((modulator) => ({
    name: modulator.deviceName,
    controls: [{ name: 'Rate', value: 0.5, modulatedValue: 0.5, hasAutomation: false }],
  }));
  return [
    ...modulatorPages,
    {
      name: 'FILTER',
      controls: [{
        name: 'Filt Freq',
        value: 0.4,
        modulatedValue: routes.some((route) => route.target === 'CONTENTS/F1FREQ') ? 0.75 : 0.4,
        hasAutomation: false,
      }],
    },
    {
      name: 'Amp EG',
      controls: [{
        name: 'Attack',
        value: 0.2,
        modulatedValue: routes.some((route) => route.target === 'CONTENTS/AMP_ATTACK_TIME') ? 0.6 : 0.2,
        hasAutomation: false,
      }],
    },
  ];
}

const liveEntries = (): readonly CompositionEntryRequest[] => [
  {
    deviceName: 'Polysynth',
    modulators: [{
      kind: 'add', modulator: 'lfo', target: 'polysynth-filter-frequency', amount: 1,
    }],
  },
  {
    deviceName: 'Sampler',
    modulators: [{
      kind: 'add', modulator: 'lfo', target: 'sampler-amp-attack', amount: 1,
    }],
  },
];

test('5g-workflow: one insertion proves full structure, pages, behavior, cleanup, and reversal', async () => {
  const entries = liveEntries();
  const fx = fixture(entries);
  let validated: Buffer | undefined;
  const result = await buildOwnedTemplateComposition(fx.host, {
    track: fx.track,
    entries,
    expectedChain: [],
    expectedEnabledChain: [],
  }, {
    wait: async () => undefined,
    onValidated(preset) { validated = preset; },
  });

  assert.equal(fx.calls.length, 1);
  assert.equal(fx.calls[0]!.length, 1);
  assert.equal(fx.calls[0]![0]?.op, 'device.insert');
  assert.equal(fx.paths.length, 1);
  assert.equal(existsSync(fx.paths[0]!), false, 'temporary preset and directory remain');
  assert.deepEqual(fx.presets, [validated]);
  assert.equal(result.take.id, 'composition-take');
  assert.equal(result.take.report.applied, true);
  assert.equal(result.composition.structural, true);
  assert.equal(result.composition.restoreFidelity, 'exact');
  assert.equal(result.composition.reversalBoundary, 'remove-observed-container');
  assert.deepEqual(result.minted, { kind: 'device', track: fx.track, chainIndex: 0 });

  assert.equal(result.verification.verified, true);
  assert.equal(result.verification.structure.verified, true);
  assert.equal(result.verification.structure.containerName, 'Instrument Layer');
  assert.deepEqual(result.verification.structure.requested, ['Polysynth', 'Sampler']);
  assert.deepEqual(
    result.verification.structure.entries.map((entry) => [entry.chainName, ...entry.deviceNames]),
    [['gn-entry-0', 'Polysynth'], ['gn-entry-1', 'Sampler']],
  );
  assert.deepEqual(result.verification.witnesses.map((witness) => witness.request.modulatorPage),
    ['LFO', 'LFO']);
  assert.ok(result.verification.witnesses.every((witness) => witness.pages.verified));
  assert.ok(result.verification.witnesses.every((witness) => witness.behavior?.verified));
  for (const witness of result.verification.witnesses) {
    assert.ok((witness.behavior?.maximumDivergence ?? 0) > 0);
    assert.ok(witness.behavior?.samples.every((sample) => sample.hasAutomation === false));
    assert.equal(witness.behavior?.baseSpread, 0);
  }

  const reversed = await fx.executor.revertUnchecked(result.take);
  assert.deepEqual(reversed.unrestored, []);
  assert.equal(fx.fake.model.findByChannelId(fx.track.channelId)!.track.devices.length, 0);
});

test('5g-workflow: a failed final validation refuses before apply', async () => {
  const entries = liveEntries();
  const fx = fixture(entries);
  await assert.rejects(
    buildOwnedTemplateComposition(fx.host, {
      track: fx.track,
      entries,
      expectedChain: [],
      expectedEnabledChain: [],
    }, {
      compose: {
        beforeValidate(preset) {
          preset.fill(0, 0, 16);
        },
      },
    }),
    (error: unknown) => error instanceof TemplateCompositionError && error.stage === 'validate',
  );
  assert.equal(fx.calls.length, 0);
});

test('5g-workflow: request and edit refusals do not cross apply', async () => {
  for (const entries of [
    [],
    [{ deviceName: 'Unknown' }],
    [{
      deviceName: 'Polysynth',
      modulators: [{
        kind: 'add', modulator: 'lfo', target: 'sampler-amp-attack', amount: 1,
      }],
    }],
  ] as const) {
    const fx = fixture(entries as readonly CompositionEntryRequest[]);
    await assert.rejects(buildOwnedTemplateComposition(fx.host, {
      track: fx.track,
      entries: entries as readonly CompositionEntryRequest[],
    }), TemplateCompositionError);
    assert.equal(fx.calls.length, 0);
  }
});

test('5g-workflow: a superseded active-route witness does not cross apply', async () => {
  const entries: readonly CompositionEntryRequest[] = [{
    deviceName: 'Polysynth',
    modulators: [
      {
        kind: 'replace', existing: 'Vibrato', modulator: 'random',
        target: 'polysynth-filter-resonance', amount: 0.5,
      },
      {
        kind: 'retarget', modulator: 'Random',
        target: 'polysynth-filter-frequency', amount: 0.7,
      },
    ],
  }];
  const fx = fixture(entries);

  await assert.rejects(
    buildOwnedTemplateComposition(fx.host, { track: fx.track, entries }),
    (error: unknown) => error instanceof TemplateCompositionError
      && error.stage === 'edit'
      && /conflicts with the final route/.test(error.message),
  );
  assert.equal(fx.calls.length, 0);
});
