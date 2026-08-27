import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { track, type Op, type TrackAddress } from '../contract/index.js';
import { listModulators, stubValues, validate } from '../bwmod/index.js';
import { FIXTURE_DIR } from '../bwmod/fixtures.js';
import { Executor } from './executor.js';
import {
  ModulatorAuthoringError, authorModulatorAdd, authorModulatorEdit,
  type ModulatorAuthoringHost, type ModulatorEditRequest,
} from './modulator-authoring.js';

interface AuthoringFixture {
  readonly fake: FakeAdapter;
  readonly executor: Executor;
  readonly host: ModulatorAuthoringHost;
  readonly track: TrackAddress;
  readonly calls: Op[][];
  readonly appliedPresets: Buffer[];
}

function fixture(
  modulatedValue = 0.75,
  duplicateWitness = false,
  automation: boolean | 'unknown' = false,
): AuthoringFixture {
  const fake = new FakeAdapter({ tracks: ['Authoring'], scenes: 1 });
  const trackRef = track(fake.model.visibleTracks()[0]!.channelId);
  const executor = new Executor(fake, { newId: () => 'modulator-take', now: () => 1 });
  const calls: Op[][] = [];
  const appliedPresets: Buffer[] = [];
  const witnessControl = () => ({
    id: 'CONTENTS/F1FREQ',
    name: 'Filter Frequency',
    value: 0.4,
    modulatedValue,
    ...(automation === 'unknown' ? {} : { hasAutomation: automation }),
  });
  const host: ModulatorAuthoringHost = {
    read: (addresses) => fake.read(addresses),
    async apply(ops, options) {
      calls.push([...ops]);
      const insertedOp = ops[0];
      if (insertedOp?.op === 'device.insert' && insertedOp.source.from === 'file') {
        appliedPresets.push(await readFile(insertedOp.source.path));
      }
      const take = await executor.run(ops, options);
      const minted = take.receipt.minted[0];
      if (minted?.kind === 'device') {
        const inserted = fake.model.findByChannelId(trackRef.channelId)!.track.devices[minted.chainIndex]!;
        inserted.name = 'Polysynth';
        inserted.params = [
          witnessControl(),
          ...(duplicateWitness ? [{ ...witnessControl(), id: 'CONTENTS/F1FREQ_COPY' }] : []),
        ];
        inserted.remotePages = [
          {
            name: 'Main',
            controls: [{ name: 'Volume', value: 0.5 }],
          },
          {
            name: 'Filter',
            controls: [witnessControl()],
          },
          ...(duplicateWitness ? [{
            name: 'Common',
            controls: [witnessControl()],
          }] : []),
        ];
      }
      return { take };
    },
  };
  return { fake, executor, host, track: trackRef, calls, appliedPresets };
}

const request = (trackRef: TrackAddress) => ({
  track: trackRef,
  templatePath: join(FIXTURE_DIR, 'Polysynth', 'mp_bare.bwpreset'),
  donorId: 'lfo-sampler',
  routing: { target: 'CONTENTS/F1FREQ', amount: 1 },
  witness: {
    parameterId: 'CONTENTS/F1FREQ', parameterName: 'Filter Frequency',
    samples: 3, sampleIntervalMs: 0,
  },
  expectedChain: [],
  expectedEnabledChain: [],
} as const);

function topologyFixture(): AuthoringFixture {
  const fake = new FakeAdapter({ tracks: ['Authoring'], scenes: 1 });
  const trackRef = track(fake.model.visibleTracks()[0]!.channelId);
  const executor = new Executor(fake, { newId: () => 'topology-take', now: () => 2 });
  const calls: Op[][] = [];
  const appliedPresets: Buffer[] = [];
  const host: ModulatorAuthoringHost = {
    read: (addresses) => fake.read(addresses),
    async apply(ops, options) {
      calls.push([...ops]);
      const insertedOp = ops[0];
      let preset: Buffer | undefined;
      if (insertedOp?.op === 'device.insert' && insertedOp.source.from === 'file') {
        preset = await readFile(insertedOp.source.path);
        appliedPresets.push(preset);
      }
      const take = await executor.run(ops, options);
      const minted = take.receipt.minted[0];
      if (minted?.kind === 'device' && preset !== undefined) {
        const inserted = fake.model.findByChannelId(trackRef.channelId)!.track.devices[minted.chainIndex]!;
        const modulators = listModulators(preset);
        const routes = modulators.flatMap((modulator) => modulator.routes);
        inserted.name = 'Polysynth';
        inserted.params = [
          {
            id: 'CONTENTS/F1FREQ', name: 'Filter Frequency', value: 0.4,
            modulatedValue: routes.some((route) => route.target === 'CONTENTS/F1FREQ') ? 0.75 : 0.4,
            hasAutomation: false,
          },
          {
            id: 'CONTENTS/F1RESO', name: 'Filter Resonance', value: 0.3,
            modulatedValue: routes.some((route) => route.target === 'CONTENTS/F1RESO') ? 0.65 : 0.3,
            hasAutomation: false,
          },
        ];
        inserted.remotePages = [
          {
            name: 'FILTER',
            controls: [
              {
                name: 'Filt Freq', value: 0.4,
                modulatedValue: routes.some((route) => route.target === 'CONTENTS/F1FREQ') ? 0.75 : 0.4,
                hasAutomation: false,
              },
              {
                name: 'Reso', value: 0.3,
                modulatedValue: routes.some((route) => route.target === 'CONTENTS/F1RESO') ? 0.65 : 0.3,
                hasAutomation: false,
              },
            ],
          },
          ...modulators
            .filter((modulator) => modulator.deviceName !== 'Expressions')
            .map((modulator) => ({
              name: modulator.deviceName,
              controls: [{ name: 'Rate', value: 0.5, modulatedValue: 0.5, hasAutomation: false }],
            })),
        ];
      }
      return { take };
    },
  };
  return { fake, executor, host, track: trackRef, calls, appliedPresets };
}

function containerFixture(): AuthoringFixture {
  const fake = new FakeAdapter({ tracks: ['Authoring'], scenes: 1 });
  const trackRef = track(fake.model.visibleTracks()[0]!.channelId);
  const executor = new Executor(fake, { newId: () => 'container-take', now: () => 3 });
  const calls: Op[][] = [];
  const appliedPresets: Buffer[] = [];
  const host: ModulatorAuthoringHost = {
    read: (addresses) => fake.read(addresses),
    async apply(ops, options) {
      calls.push([...ops]);
      const insertedOp = ops[0];
      let preset: Buffer | undefined;
      if (insertedOp?.op === 'device.insert' && insertedOp.source.from === 'file') {
        preset = await readFile(insertedOp.source.path);
        appliedPresets.push(preset);
      }
      const take = await executor.run(ops, options);
      const minted = take.receipt.minted[0];
      if (minted?.kind === 'device' && preset !== undefined) {
        const inserted = fake.model.findByChannelId(trackRef.channelId)!.track.devices[minted.chainIndex]!;
        const route = listModulators(preset, 1)[0]?.routing?.target;
        inserted.name = 'Chain';
        inserted.remotePages = [{
          name: 'LFO',
          controls: [{ name: 'Rate', value: 0.5, modulatedValue: 0.5, hasAutomation: false }],
        }];
        inserted.deviceSlots = {
          CHAIN: [{
            name: 'Polysynth',
            paramsLive: true,
            params: [{
              id: 'CONTENTS/F1FREQ',
              name: 'Filter Frequency',
              value: 0.4,
              modulatedValue: route?.endsWith('0:CONTENTS/F1FREQ') ? 0.7 : 0.4,
              hasAutomation: false,
            }],
            remotePages: [{
              name: 'FILTER',
              controls: [{
                name: 'Filt Freq',
                value: 0.4,
                modulatedValue: route?.endsWith('0:CONTENTS/F1FREQ') ? 0.7 : 0.4,
                hasAutomation: false,
              }],
            }],
          }],
        };
      }
      return { take };
    },
  };
  return { fake, executor, host, track: trackRef, calls, appliedPresets };
}

const topologyRequest = (
  trackRef: TrackAddress,
  edit: ModulatorEditRequest['edit'],
  proof: Pick<ModulatorEditRequest, 'pageWitnesses' | 'behaviorWitnesses'>,
): ModulatorEditRequest => ({
  track: trackRef,
  templatePath: join(FIXTURE_DIR, 'Polysynth', 'modtest.bwpreset'),
  edit,
  ...proof,
  expectedChain: [],
  expectedEnabledChain: [],
});

test('5a-add: edits, validates, checkpoints, proves one exact selector, and reverses', async () => {
  const fx = fixture();
  const input = request(fx.track);
  const template = await readFile(input.templatePath);
  const result = await authorModulatorAdd(fx.host, input, { wait: async () => undefined });

  assert.equal(fx.calls.length, 1);
  assert.equal(fx.calls[0]![0]?.op, 'device.insert');
  const source = fx.calls[0]![0]?.op === 'device.insert' ? fx.calls[0]![0].source : undefined;
  assert.equal(source?.from, 'file');
  assert.equal(source?.from === 'file' ? existsSync(source.path) : true, false, 'the temp preset is removed');
  assert.equal(fx.appliedPresets.length, 1);
  const appliedPreset = fx.appliedPresets[0]!;
  assert.notDeepEqual(appliedPreset, template, 'the executor receives edited bytes');
  assert.equal(validate(appliedPreset, { reference: template }).ok, true);
  assert.deepEqual(listModulators(appliedPreset).map((modulator) => modulator.routing), [{
    target: 'CONTENTS/F1FREQ',
    amount: 1,
    rangeLo: -3,
    rangeHi: 1,
  }]);

  assert.equal(result.take.report.applied, true);
  assert.equal(result.take.id, 'modulator-take');
  assert.equal(result.take.fidelity, 'exact', 'deleting the mint restores the prior absence exactly');
  assert.equal(result.edit.structural, true, 'preset loading remains a structural operation');
  assert.equal(result.edit.modulatorCountBefore, 0);
  assert.equal(result.edit.modulatorCountAfter, 1);
  assert.deepEqual(result.minted, { kind: 'device', track: fx.track, chainIndex: 0 });

  assert.equal(result.verification.verified, true);
  assert.deepEqual(result.verification.selector, {
    kind: 'param',
    device: result.minted,
    directId: 'CONTENTS/F1FREQ',
  });
  assert.equal(result.verification.samples.length, 3);
  assert.ok(result.verification.maximumDivergence > 0.3);

  const reversed = await fx.executor.revertUnchecked(result.take);
  assert.deepEqual(reversed.unrestored, []);
  assert.equal(fx.fake.model.findByChannelId(fx.track.channelId)!.track.devices.length, 0);
});

test('5a-readback: validate success without base-to-modulated divergence is not proof', async () => {
  const fx = fixture(0.4);
  const result = await authorModulatorAdd(fx.host, request(fx.track), { wait: async () => undefined });

  assert.equal(result.take.report.applied, true);
  assert.equal(result.verification.verified, false);
  assert.match(result.verification.verified ? '' : result.verification.why, /never diverged/);
});

test('5a-readback: an unknown automation state is not modulation proof', async () => {
  const fx = fixture(0.75, false, 'unknown');
  const result = await authorModulatorAdd(fx.host, request(fx.track), { wait: async () => undefined });

  assert.equal(result.verification.verified, false);
  assert.match(result.verification.verified ? '' : result.verification.why,
    /automation state was not observed/);
});

test('5a-readback: host automation is not modulation proof', async () => {
  const fx = fixture(0.75, false, true);
  const result = await authorModulatorAdd(fx.host, request(fx.track), { wait: async () => undefined });

  assert.equal(result.verification.verified, false);
  assert.match(result.verification.verified ? '' : result.verification.why, /has host automation/);
});

test('5j-readback: an id and name mismatch fails after the recorded insert', async () => {
  const fx = fixture();
  const input = request(fx.track);
  const result = await authorModulatorAdd(fx.host, {
    ...input,
    witness: { ...input.witness, parameterName: 'Wrong name' },
  }, { wait: async () => undefined });

  assert.equal(result.take.report.applied, true);
  assert.equal(result.verification.verified, false);
  assert.match(result.verification.verified ? '' : result.verification.why, /has name.*not.*Wrong name/);
});

test('5j-readback: an unstable DirectParameter inventory fails after insertion', async () => {
  const fx = fixture();
  const host: ModulatorAuthoringHost = {
    read: (addresses) => fx.host.read(addresses),
    async apply(ops, options) {
      const applied = await fx.host.apply(ops, options);
      fx.fake.model.staleParameterInventories = 10;
      return applied;
    },
  };
  const result = await authorModulatorAdd(host, request(fx.track), { wait: async () => undefined });

  assert.equal(result.take.report.applied, true);
  assert.equal(result.verification.verified, false);
  assert.match(result.verification.verified ? '' : result.verification.why, /did not settle/);
});

test('5j-readback: moving base values cannot prove an active route', async () => {
  const fx = fixture();
  let reads = 0;
  const host: ModulatorAuthoringHost = {
    async read(addresses) {
      if (reads > 0) {
        const parameter = fx.fake.model.findByChannelId(fx.track.channelId)
          ?.track.devices[0]?.params[0];
        if (parameter !== undefined) parameter.value += 0.01;
      }
      reads += 1;
      return fx.host.read(addresses);
    },
    apply: (ops, options) => fx.host.apply(ops, options),
  };
  const result = await authorModulatorAdd(host, request(fx.track), { wait: async () => undefined });

  assert.equal(result.take.report.applied, true);
  assert.equal(result.verification.verified, false);
  assert.match(result.verification.verified ? '' : result.verification.why, /base moved/);
});

test('5j-readback: duplicate names remain distinct through exact parameter ids', async () => {
  const fx = fixture(0.75, true);
  const result = await authorModulatorAdd(fx.host, request(fx.track), { wait: async () => undefined });

  assert.equal(result.verification.verified, true);
  assert.equal(result.verification.selector?.directId, 'CONTENTS/F1FREQ');
});

test('5c-add: a sampled add reports the measured footprint and every shifted stub', async () => {
  const fx = fixture();
  const templatePath = join(FIXTURE_DIR, 'Sampler', 'gn_sampler_bare.bwpreset');
  const template = await readFile(templatePath);
  const result = await authorModulatorAdd(fx.host, {
    ...request(fx.track),
    templatePath,
    donorId: 'random-sampler',
    routing: { target: 'CONTENTS/AMP_ATTACK_TIME', amount: 1 },
  }, { wait: async () => undefined });

  const relocation = result.edit.stubRelocation;
  assert.ok(relocation);
  assert.equal(relocation.stubCount, 2);
  assert.equal(relocation.insertedFootprint, 0x0d);
  assert.equal(relocation.removedFootprint, 0);
  assert.equal(relocation.delta, 0x0d);
  assert.deepEqual(relocation.before, stubValues(template));
  assert.deepEqual(relocation.after, relocation.before.map((value) => value + 0x0d));
  assert.equal(validate(fx.appliedPresets[0]!, { reference: template, stubDelta: 0x0d }).ok, true);
});

test('5a-validation: edited bytes are validated before apply', async () => {
  const fx = fixture();
  let validatedPreset: Buffer | undefined;
  let validationPassed = false;
  const host: ModulatorAuthoringHost = {
    read: (addresses) => fx.host.read(addresses),
    async apply(ops, options) {
      assert.equal(validationPassed, true, 'validation finishes before apply');
      return fx.host.apply(ops, options);
    },
  };

  await authorModulatorAdd(host, request(fx.track), {
    wait: async () => undefined,
    onValidated(preset, checked) {
      assert.equal(checked.ok, true);
      validatedPreset = Buffer.from(preset);
      preset.fill(0, 0, Math.min(8, preset.length));
      validationPassed = true;
    },
  });

  assert.equal(listModulators(validatedPreset!).length, 1, 'validation receives the edited preset');
  assert.deepEqual(fx.appliedPresets, [validatedPreset], 'apply receives the validated bytes');
});

test('5a-request: a zero divergence threshold refuses before apply', async () => {
  const fx = fixture(0.4);
  const input = request(fx.track);

  await assert.rejects(
    authorModulatorAdd(fx.host, {
      ...input,
      witness: { ...input.witness, minimumDivergence: 0 },
    }),
    (error: unknown) => error instanceof ModulatorAuthoringError
      && error.stage === 'request'
      && /must be positive/.test(error.message),
  );
  assert.equal(fx.calls.length, 0);
});

test('5a-request: a relative template path refuses before file access or apply', async () => {
  const fx = fixture();
  await assert.rejects(
    authorModulatorAdd(fx.host, { ...request(fx.track), templatePath: 'mp_bare.bwpreset' }),
    (error: unknown) => error instanceof ModulatorAuthoringError && error.stage === 'request',
  );
  assert.equal(fx.calls.length, 0);
});

test('5b-replace: checkpoints a type swap, proves page replacement, and reverses', async () => {
  const fx = topologyFixture();
  const input = topologyRequest(fx.track, {
    kind: 'replace', index: 0, donorId: 'classiclfo-poly',
  }, {
    pageWitnesses: [
      { pageName: 'Classic LFO', expectedCount: 1 },
      { pageName: 'Vibrato', expectedCount: 0 },
    ],
  });
  const template = await readFile(input.templatePath);
  const result = await authorModulatorEdit(fx.host, input, { wait: async () => undefined });

  assert.equal(fx.calls.length, 1);
  assert.equal(result.take.report.applied, true);
  assert.equal(result.take.id, 'topology-take');
  assert.equal(result.edit.kind, 'modulator.replace');
  assert.equal(result.edit.structural, true);
  assert.equal(result.edit.restoreFidelity, 'exact');
  assert.deepEqual(result.edit.modulatorsBefore.map((modulator) => modulator.deviceName),
    ['Vibrato', 'Expressions', 'LFO']);
  assert.deepEqual(result.edit.modulatorsAfter.map((modulator) => modulator.deviceName),
    ['Classic LFO', 'Expressions', 'LFO']);
  assert.equal(result.verification.verified, true);
  assert.deepEqual(result.minted, { kind: 'device', track: fx.track, chainIndex: 0 });
  const source = fx.calls[0]![0]?.op === 'device.insert' ? fx.calls[0]![0].source : undefined;
  assert.equal(source?.from === 'file' ? existsSync(source.path) : true, false,
    'the temp preset is removed');
  assert.equal(validate(fx.appliedPresets[0]!, { reference: template }).ok, true);

  const reversed = await fx.executor.revertUnchecked(result.take);
  assert.deepEqual(reversed.unrestored, []);
  assert.equal(fx.fake.model.findByChannelId(fx.track.channelId)!.track.devices.length, 0);
});

test('5b-retarget: proves modulation left the old control and reached the new control', async () => {
  const fx = topologyFixture();
  const result = await authorModulatorEdit(fx.host, topologyRequest(fx.track, {
    kind: 'retarget', index: 2, target: 'CONTENTS/F1RESO',
  }, {
    behaviorWitnesses: [
      {
        expected: 'inactive', parameterId: 'CONTENTS/F1FREQ', parameterName: 'Filter Frequency',
        samples: 3, sampleIntervalMs: 0,
      },
      {
        expected: 'active', parameterId: 'CONTENTS/F1RESO', parameterName: 'Filter Resonance',
        samples: 3, sampleIntervalMs: 0,
      },
    ],
  }), { wait: async () => undefined });

  assert.equal(result.verification.verified, true);
  assert.deepEqual(result.edit.modulatorsAfter[2]?.routing?.target, 'CONTENTS/F1RESO');
  assert.deepEqual(result.verification.behaviors.map((behavior) => behavior.verified), [true, true]);
  assert.deepEqual(result.verification.behaviors.map((behavior) => behavior.selector?.directId),
    ['CONTENTS/F1FREQ', 'CONTENTS/F1RESO']);
});

test('5d-container: selects one list and proves the route on one nested device', async () => {
  const fx = containerFixture();
  const templatePath = join(FIXTURE_DIR, 'InstrumentLayer', 'gn_layer_4chain.bwpreset');
  const target = 'CONTENTS/DEVICE_CHAIN/Chain/DEVICE_CHAIN/0:CONTENTS/F1FREQ';
  const result = await authorModulatorEdit(fx.host, {
    track: fx.track,
    templatePath,
    listIndex: 1,
    edit: { kind: 'retarget', index: 0, target },
    pageWitnesses: [{ pageName: 'LFO', expectedCount: 1 }],
    behaviorWitnesses: [{
      expected: 'active',
      parameterId: 'CONTENTS/F1FREQ',
      parameterName: 'Filter Frequency',
      nestedDevice: { slotName: 'CHAIN', chainIndex: 0 },
      samples: 3,
      sampleIntervalMs: 0,
    }],
    expectedChain: [],
    expectedEnabledChain: [],
  }, { wait: async () => undefined });

  assert.equal(result.verification.verified, true);
  assert.equal(result.edit.listIndex, 1);
  assert.equal(result.edit.modulatorsAfter[0]?.routing?.target, target);
  assert.equal(listModulators(fx.appliedPresets[0]!, 0).length, 0);
  assert.deepEqual(result.verification.behaviors[0]?.selector?.device.chain, {
    kind: 'deviceSlot',
    container: result.minted,
    name: 'CHAIN',
  });
});

test('5d-container: omitting list selection refuses before apply', async () => {
  const fx = containerFixture();
  await assert.rejects(
    authorModulatorEdit(fx.host, {
      track: fx.track,
      templatePath: join(FIXTURE_DIR, 'InstrumentLayer', 'gn_layer_4chain.bwpreset'),
      edit: {
        kind: 'retarget',
        index: 0,
        target: 'CONTENTS/DEVICE_CHAIN/Chain/DEVICE_CHAIN/0:CONTENTS/F1FREQ',
      },
      behaviorWitnesses: [{
        expected: 'active',
        parameterId: 'CONTENTS/F1FREQ',
        parameterName: 'Filter Frequency',
        nestedDevice: { slotName: 'CHAIN', chainIndex: 0 },
      }],
    }),
    (error: unknown) => error instanceof ModulatorAuthoringError
      && error.stage === 'edit'
      && /pass a listIndex/.test(error.message),
  );
  assert.equal(fx.calls.length, 0);
});

test('5d-container: a non-first device-slot witness refuses before apply', async () => {
  const fx = containerFixture();
  await assert.rejects(
    authorModulatorEdit(fx.host, {
      track: fx.track,
      templatePath: join(FIXTURE_DIR, 'InstrumentLayer', 'gn_layer_4chain.bwpreset'),
      listIndex: 1,
      edit: {
        kind: 'retarget',
        index: 0,
        target: 'CONTENTS/DEVICE_CHAIN/Chain/DEVICE_CHAIN/0:CONTENTS/F1FREQ',
      },
      behaviorWitnesses: [{
        expected: 'active',
        parameterId: 'CONTENTS/F1FREQ',
        parameterName: 'Filter Frequency',
        nestedDevice: { slotName: 'CHAIN', chainIndex: 1 },
      }],
    }),
    (error: unknown) => error instanceof ModulatorAuthoringError
      && error.stage === 'request'
      && /chainIndex 0/.test(error.message),
  );
  assert.equal(fx.calls.length, 0);
});

test('5b-delete: proves the page and modulation are absent while a sibling remains', async () => {
  const fx = topologyFixture();
  const result = await authorModulatorEdit(fx.host, topologyRequest(fx.track, {
    kind: 'delete', index: 2,
  }, {
    pageWitnesses: [
      { pageName: 'LFO', expectedCount: 0 },
      { pageName: 'Vibrato', expectedCount: 1 },
    ],
    behaviorWitnesses: [{
      expected: 'inactive', parameterId: 'CONTENTS/F1FREQ', parameterName: 'Filter Frequency',
      samples: 3, sampleIntervalMs: 0,
    }],
  }), { wait: async () => undefined });

  assert.equal(result.verification.verified, true);
  assert.deepEqual(result.edit.modulatorsAfter.map((modulator) => modulator.deviceName),
    ['Vibrato', 'Expressions']);
  assert.equal(result.verification.behaviors[0]?.maximumDivergence, 0);
});

test('5b-readback: an unexpected active route fails an inactive witness', async () => {
  const fx = topologyFixture();
  const result = await authorModulatorEdit(fx.host, topologyRequest(fx.track, {
    kind: 'retarget', index: 2, target: 'CONTENTS/F1RESO',
  }, {
    behaviorWitnesses: [{
      expected: 'inactive', parameterId: 'CONTENTS/F1RESO', parameterName: 'Filter Resonance',
      samples: 2, sampleIntervalMs: 0,
    }],
  }), { wait: async () => undefined });

  assert.equal(result.verification.verified, false);
  assert.match(result.verification.behaviors[0]?.verified ? '' : result.verification.behaviors[0]!.why,
    /inactive limit/);
});

test('5b-pages: a wrong expected page count fails structural verification', async () => {
  const fx = topologyFixture();
  const result = await authorModulatorEdit(fx.host, topologyRequest(fx.track, {
    kind: 'delete', index: 2,
  }, {
    pageWitnesses: [{ pageName: 'LFO', expectedCount: 1 }],
  }), { wait: async () => undefined });

  assert.equal(result.verification.verified, false);
  assert.match(result.verification.pages.why ?? '', /expected 1, got 0/);
});

test('5b-validation: edited bytes are validated before apply', async () => {
  const fx = topologyFixture();
  let validationPassed = false;
  const host: ModulatorAuthoringHost = {
    read: (addresses) => fx.host.read(addresses),
    async apply(ops, options) {
      assert.equal(validationPassed, true);
      return fx.host.apply(ops, options);
    },
  };
  await authorModulatorEdit(host, topologyRequest(fx.track, {
    kind: 'delete', index: 2,
  }, {
    pageWitnesses: [{ pageName: 'LFO', expectedCount: 0 }],
  }), {
    wait: async () => undefined,
    onValidated(_preset, checked) {
      assert.equal(checked.ok, true);
      validationPassed = true;
    },
  });
  assert.equal(validationPassed, true);
});

test('5c-replace: a multisample replace reports both measured footprints and all four stubs', async () => {
  const fx = topologyFixture();
  const templatePath = join(FIXTURE_DIR, 'Sampler', 'gn_sampler_multi_one_lfo.bwpreset');
  const template = await readFile(templatePath);
  const result = await authorModulatorEdit(fx.host, {
    track: fx.track,
    templatePath,
    edit: { kind: 'replace', index: 0, donorId: 'random-sampler', removedFootprint: 0x10 },
    pageWitnesses: [
      { pageName: 'Random', expectedCount: 1 },
      { pageName: 'LFO', expectedCount: 0 },
    ],
    expectedChain: [],
    expectedEnabledChain: [],
  }, { wait: async () => undefined });

  const relocation = result.edit.stubRelocation;
  assert.ok(relocation);
  assert.equal(result.verification.verified, true);
  assert.equal(relocation.stubCount, 4);
  assert.equal(relocation.insertedFootprint, 0x0d);
  assert.equal(relocation.removedFootprint, 0x10);
  assert.equal(relocation.delta, -3);
  assert.deepEqual(relocation.before, stubValues(template));
  assert.deepEqual(relocation.after, relocation.before.map((value) => value - 3));
  assert.equal(validate(fx.appliedPresets[0]!, { reference: template, stubDelta: -3 }).ok, true);
});

test('5c-delete: a multisample delete reports the measured removed footprint', async () => {
  const fx = topologyFixture();
  const templatePath = join(FIXTURE_DIR, 'Sampler', 'gn_sampler_multi_one_lfo.bwpreset');
  const template = await readFile(templatePath);
  const result = await authorModulatorEdit(fx.host, {
    track: fx.track,
    templatePath,
    edit: { kind: 'delete', index: 0, removedFootprint: 0x10 },
    pageWitnesses: [{ pageName: 'LFO', expectedCount: 0 }],
    expectedChain: [],
    expectedEnabledChain: [],
  }, { wait: async () => undefined });

  const relocation = result.edit.stubRelocation;
  assert.ok(relocation);
  assert.equal(result.verification.verified, true);
  assert.equal(relocation.stubCount, 4);
  assert.equal(relocation.insertedFootprint, 0);
  assert.equal(relocation.removedFootprint, 0x10);
  assert.equal(relocation.delta, -0x10);
  assert.deepEqual(relocation.before, stubValues(template));
  assert.deepEqual(relocation.after, relocation.before.map((value) => value - 0x10));
  assert.equal(validate(fx.appliedPresets[0]!, { reference: template, stubDelta: -0x10 }).ok, true);
});

test('5b-footprint: sampled replace and delete refuse unknown footprints before apply', async () => {
  for (const edit of [
    { kind: 'replace', index: 0, donorId: 'lfo-poly' },
    { kind: 'replace', index: 0, donorId: 'expressions-poly' },
    { kind: 'delete', index: 0 },
  ] as const) {
    const fx = topologyFixture();
    const input: ModulatorEditRequest = {
      track: fx.track,
      templatePath: join(FIXTURE_DIR, 'Sampler', 'gn_sampler_multi_one_lfo.bwpreset'),
      edit,
      pageWitnesses: [{ pageName: 'LFO', expectedCount: 0 }],
    };
    await assert.rejects(
      authorModulatorEdit(fx.host, input, { wait: async () => undefined }),
      (error: unknown) => error instanceof ModulatorAuthoringError
        && error.stage === 'edit'
        && /footprint/.test(error.message),
    );
    assert.equal(fx.calls.length, 0);
  }
});

test('5j-request: behavior proof requires an exact parameter name before apply', async () => {
  const fx = topologyFixture();
  await assert.rejects(
    authorModulatorEdit(fx.host, topologyRequest(fx.track, {
      kind: 'retarget', index: 2, target: 'CONTENTS/F1RESO',
    }, {
      behaviorWitnesses: [{
        expected: 'active', parameterId: 'CONTENTS/F1RESO', parameterName: '',
      }],
    })),
    (error: unknown) => error instanceof ModulatorAuthoringError
      && error.stage === 'request'
      && /parameterName must not be empty/.test(error.message),
  );
  assert.equal(fx.calls.length, 0);
});
