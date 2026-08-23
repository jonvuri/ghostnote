import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { track, type Op, type TrackAddress } from '../contract/index.js';
import { listModulators, validate } from '../bwmod/index.js';
import { FIXTURE_DIR } from '../bwmod/fixtures.js';
import { Executor } from './executor.js';
import {
  ModulatorAuthoringError, authorModulatorAdd, type ModulatorAuthoringHost,
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
    name: 'Filt Freq',
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
  witness: { pageName: 'Filter', controlName: 'Filt Freq', samples: 3, sampleIntervalMs: 0 },
  expectedChain: [],
  expectedEnabledChain: [],
} as const);

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
    kind: 'remote',
    device: result.minted,
    pageIndex: 1,
    pageName: 'Filter',
    controlIndex: 0,
    controlName: 'Filt Freq',
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

test('5a-readback: a name-only ambiguous selector refuses and reports its candidates', async () => {
  const fx = fixture(0.75, true);
  const input = request(fx.track);
  const { pageName: _pageName, ...nameOnlyWitness } = input.witness;
  const result = await authorModulatorAdd(fx.host, {
    ...input,
    witness: nameOnlyWitness,
  }, { wait: async () => undefined });

  assert.equal(result.verification.verified, false);
  assert.match(result.verification.verified ? '' : result.verification.why,
    /matched 2 remote selectors/);
  assert.match(result.verification.verified ? '' : result.verification.why,
    /1:"Filter"\/0:"Filt Freq", 2:"Common"\/0:"Filt Freq"/);
});

test('5a-footprint: an unmeasured donor on a sampled preset refuses before apply', async () => {
  const fx = fixture();
  const sampled = {
    ...request(fx.track),
    templatePath: join(FIXTURE_DIR, 'Sampler', 'gn_sampler_one_lfo.bwpreset'),
    donorId: 'vibrato-poly',
    routing: { target: 'CONTENTS/AMP_DECAY_TIME', amount: 1 },
  };

  await assert.rejects(
    authorModulatorAdd(fx.host, sampled, { wait: async () => undefined }),
    (error: unknown) => error instanceof ModulatorAuthoringError
      && error.stage === 'edit'
      && /no measured footprint/.test(error.message),
  );
  assert.equal(fx.calls.length, 0, 'the sampled-preset refusal happens before the executor');
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
