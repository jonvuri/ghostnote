import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { control } from '../adapters/fake/control.js';
import type { FakeDevice } from '../adapters/fake/model.js';
import { addressKey, track, type Op, type TrackAddress } from '../contract/index.js';
import { Executor, type RunOptions } from './executor.js';
import {
  ManagedFxChainError, buildManagedFxChain, reverseManagedFxChain,
  type ManagedFxChainHost, type ManagedFxChainRequest,
} from './managed-fx-chain.js';

interface ApplyCall {
  readonly ops: readonly Op[];
  readonly options: RunOptions | undefined;
}

interface Fixture {
  readonly fake: FakeAdapter;
  readonly track: TrackAddress;
  readonly host: ManagedFxChainHost;
  readonly calls: ApplyCall[];
}

const existingDevice = (name: string, value: number): FakeDevice => ({
  name,
  enabled: true,
  paramsLive: true,
  params: [{ id: 'P1', name: `${name} parameter`, value }],
});

function fixture(
  beforeReturn?: (ops: readonly Op[], fake: FakeAdapter, call: number) => void,
  beforeApply?: (ops: readonly Op[], fake: FakeAdapter, call: number) => void,
): Fixture {
  const fake = new FakeAdapter({ tracks: ['Managed'], scenes: 1 });
  const modelTrack = fake.model.visibleTracks()[0]!;
  const trackRef = track(modelTrack.channelId);
  let id = 0;
  let call = 0;
  const executor = new Executor(fake, {
    newId: () => `managed-${++id}`,
    now: () => id,
  });
  const calls: ApplyCall[] = [];
  const host: ManagedFxChainHost = {
    devices: (target) => fake.devices(target),
    read: (addresses) => fake.read(addresses),
    async apply(ops, options) {
      call++;
      calls.push({ ops, options });
      beforeApply?.(ops, fake, call);
      const take = await executor.run(ops, options);
      beforeReturn?.(ops, fake, call);
      return { take };
    },
  };
  return { fake, track: trackRef, host, calls };
}

function modelTrack(fx: Fixture) {
  return fx.fake.model.findByChannelId(fx.track.channelId)!.track;
}

function failFirstChainProofAfter(fx: Fixture, operation: Op['op']): ManagedFxChainHost {
  let failNextProof = false;
  return {
    ...fx.host,
    async devices(target) {
      const observed = await fx.host.devices(target);
      if (!failNextProof) return observed;
      failNextProof = false;
      return { ...observed, devicesComplete: false };
    },
    async apply(ops, options) {
      const result = await fx.host.apply(ops, options);
      if (ops[0]?.op === operation) failNextProof = true;
      return result;
    },
  };
}

const mixedRequest = (trackRef: TrackAddress): ManagedFxChainRequest => ({
  track: trackRef,
  devices: [
    {
      token: 'native',
      source: { from: 'bitwig', uuid: 'native-fx' },
      position: 1,
      parameters: [{ directId: 'P1', value: 0.1 }],
      enabled: false,
    },
    {
      token: 'vst3',
      source: { from: 'vst3', classUid: 'D39D5B69D6AF42FA123456785A334D44' },
      position: 3,
      parameters: [{ name: 'Param 2', value: 0.2 }],
    },
    {
      token: 'clap',
      source: { from: 'clap', id: 'com.u-he.Zebra3' },
      position: 5,
      parameters: [{ directId: 'P3', value: 0.3 }],
    },
  ],
  existingEnabled: [{
    device: { kind: 'device', track: trackRef, chainIndex: 3 },
    expectedName: 'Output',
    enabled: false,
  }],
});

test('4g managed chain binds minted addresses, places three formats, and reverses by current position', async () => {
  const fx = fixture();
  modelTrack(fx).devices.push(
    existingDevice('Input', 0.25), existingDevice('Dry A', 0.35),
    existingDevice('Dry B', 0.65), existingDevice('Output', 0.75),
  );

  const checkpoint = await buildManagedFxChain(fx.host, mixedRequest(fx.track));
  const vstName = 'D39D5B69D6AF42FA123456785A334D44';
  assert.deepEqual(checkpoint.final.devices.map((item) => item.name), [
    'Input', 'native-fx', 'Dry A', vstName, 'Dry B', 'com.u-he.Zebra3', 'Output',
  ]);
  assert.deepEqual(checkpoint.inserted.map((item) => item.minted.chainIndex), [4, 5, 6]);
  assert.deepEqual(checkpoint.inserted.map((item) => item.current.chainIndex), [1, 3, 5]);
  assert.deepEqual(checkpoint.finalOrder, [
    { owner: 'entry', entryIndex: 0 },
    { owner: 'inserted', token: 'native' },
    { owner: 'entry', entryIndex: 1 },
    { owner: 'inserted', token: 'vst3' },
    { owner: 'entry', entryIndex: 2 },
    { owner: 'inserted', token: 'clap' },
    { owner: 'entry', entryIndex: 3 },
  ]);
  assert.equal(modelTrack(fx).devices.find((item) => item.name === 'native-fx')!.params[0]!.value, 0.1);
  assert.equal(modelTrack(fx).devices.find((item) => item.name === vstName)!.params[1]!.value, 0.2);
  assert.equal(modelTrack(fx).devices.find((item) => item.name === 'com.u-he.Zebra3')!.params[2]!.value, 0.3);
  assert.equal(modelTrack(fx).devices.find((item) => item.name === 'native-fx')!.enabled, false);
  assert.equal(modelTrack(fx).devices.find((item) => item.name === 'Output')!.enabled, false);
  assert.deepEqual(checkpoint.report.promises, {
    insertedDevice: 'delete-current-observed-owned-position',
    scalar: 'restore-entry-base-or-remove-with-owned-device',
    existingDeviceDelete: 'none',
  });
  assert.deepEqual(checkpoint.report.nonTaking, []);

  const reversalCallStart = fx.calls.length;
  const reversal = await reverseManagedFxChain(fx.host, checkpoint);
  assert.equal(reversal.complete, true);
  assert.deepEqual(reversal.deleted, ['clap', 'vst3', 'native']);
  assert.deepEqual(reversal.after.devices.map((item) => item.name), ['Input', 'Dry A', 'Dry B', 'Output']);
  assert.equal(modelTrack(fx).devices[3]!.enabled, true, 'the surviving enabled checkpoint is restored');

  const reversalCalls = fx.calls.slice(reversalCallStart);
  const deletes = reversalCalls.filter((call) => call.ops[0]?.op === 'device.delete');
  assert.deepEqual(deletes.map((call) => {
    const op = call.ops[0]!;
    return op.op === 'device.delete'
      ? [op.device.chainIndex, op.expectedName, call.options?.clearance?.kind]
      : [];
  }), [
    [5, 'com.u-he.Zebra3', 'own-changeset-reversal'],
    [3, vstName, 'own-changeset-reversal'],
    [1, 'native-fx', 'own-changeset-reversal'],
  ]);
});

test('4g managed chain reports modulation, automation, and a non-taking named parameter', async () => {
  const fx = fixture((ops, fake) => {
    if (ops[0]?.op !== 'device.insert') return;
    const inserted = fake.model.visibleTracks()[0]!.devices.at(-1)!;
    inserted.params[0]!.modulatedValue = 0.8;
    inserted.params[0]!.hasAutomation = true;
  });
  control(fx.fake).setParameterWritesTake(false);

  const checkpoint = await buildManagedFxChain(fx.host, {
    track: fx.track,
    devices: [{
      token: 'warned',
      source: { from: 'bitwig', uuid: 'warned-device' },
      parameters: [{ name: 'Param 1', value: 0.9 }],
    }],
  });

  assert.deepEqual(checkpoint.report.warnings.map((item) => item.condition), [
    'modulation', 'automation',
  ]);
  assert.deepEqual(checkpoint.report.nonTaking, [{
    token: 'warned', kind: 'parameter', requested: 0.9, readback: 0.5,
  }]);
  const parameter = checkpoint.scalars.find((item) => item.kind === 'parameter');
  assert.equal(parameter?.took, false);
  await reverseManagedFxChain(fx.host, checkpoint);
  assert.deepEqual(modelTrack(fx).devices, []);
});

test('4g managed chain reports modulation and automation that appear after the write', async () => {
  const fx = fixture((ops, fake) => {
    if (ops[0]?.op !== 'param.set') return;
    const inserted = fake.model.visibleTracks()[0]!.devices.at(-1)!;
    inserted.params[0]!.modulatedValue = 0.8;
    inserted.params[0]!.hasAutomation = true;
  });

  const checkpoint = await buildManagedFxChain(fx.host, {
    track: fx.track,
    devices: [{
      token: 'late-warning',
      source: { from: 'bitwig', uuid: 'late-warning' },
      parameters: [{ directId: 'P1', value: 0.2 }],
    }],
  });

  assert.deepEqual(checkpoint.report.warnings.map((item) => item.condition), [
    'modulation', 'automation',
  ]);
  await reverseManagedFxChain(fx.host, checkpoint);
});

test('4g managed chain refuses an incomplete device bank before any write', async () => {
  const fx = fixture();
  modelTrack(fx).devices.push(existingDevice('A', 0.1), existingDevice('B', 0.2));
  fx.fake.model.deviceBankSize = 1;

  await assert.rejects(
    buildManagedFxChain(fx.host, {
      track: fx.track,
      devices: [{ token: 'never', source: { from: 'bitwig', uuid: 'never' } }],
    }),
    (error: unknown) => error instanceof ManagedFxChainError
      && error.stage === 'preflight'
      && /complete top-level/.test(error.message),
  );
  assert.equal(fx.calls.length, 0);
  assert.deepEqual(modelTrack(fx).devices.map((item) => item.name), ['A', 'B']);
});

test('4g managed chain requires enabled state in every preflight row', async () => {
  const fx = fixture();
  modelTrack(fx).devices.push(existingDevice('A', 0.1));
  const blindEnabled: ManagedFxChainHost = {
    ...fx.host,
    async devices(target) {
      const observed = await fx.host.devices(target);
      return {
        ...observed,
        devices: observed.devices.map((item) => ({ index: item.index, name: item.name })),
      };
    },
  };
  await assert.rejects(
    buildManagedFxChain(blindEnabled, {
      track: fx.track,
      devices: [{ token: 'never', source: { from: 'bitwig', uuid: 'never' } }],
    }),
    /enabled state must be observed for every top-level device/,
  );
  assert.equal(fx.calls.length, 0);
});

test('4g managed chain returns a reversible partial checkpoint after inventory failure', async () => {
  const fx = fixture((ops, fake) => {
    if (ops[0]?.op !== 'device.insert') return;
    fake.model.visibleTracks()[0]!.devices.at(-1)!.params[1]!.name = 'Param 1';
  });
  let partial: ManagedFxChainError['partial'];
  let failedTakes: readonly string[] = [];
  await assert.rejects(
    buildManagedFxChain(fx.host, {
      track: fx.track,
      devices: [{
        token: 'owned',
        source: { from: 'bitwig', uuid: 'owned' },
        parameters: [{ name: 'Param 1', value: 0.8 }],
      }],
    }),
    (error: unknown) => {
      if (!(error instanceof ManagedFxChainError)) return false;
      partial = error.partial;
      failedTakes = error.takes.map((take) => take.id);
      return error.stage === 'inventory' && partial?.inserted[0]?.current.chainIndex === 0;
    },
  );
  assert.deepEqual(failedTakes, ['managed-1']);
  assert.ok(partial);
  await reverseManagedFxChain(fx.host, partial);
  assert.deepEqual(modelTrack(fx).devices, []);
});

test('4g managed chain reconciles a landed insert after its first chain proof fails', async () => {
  const fx = fixture();
  modelTrack(fx).devices.push(existingDevice('Entry', 0.25));
  const transient = failFirstChainProofAfter(fx, 'device.insert');

  let partial: ManagedFxChainError['partial'];
  await assert.rejects(
    buildManagedFxChain(transient, {
      track: fx.track,
      devices: [{ token: 'owned', source: { from: 'bitwig', uuid: 'owned' } }],
    }),
    (error: unknown) => {
      if (!(error instanceof ManagedFxChainError)) return false;
      partial = error.partial;
      return error.stage === 'insert'
        && error.takes.map((take) => take.id).join(',') === 'managed-1'
        && partial?.inserted[0]?.current.chainIndex === 1;
    },
  );
  assert.deepEqual(modelTrack(fx).devices.map((item) => item.name), ['Entry', 'owned']);
  assert.deepEqual(partial?.final.devices.map((item) => item.name), ['Entry', 'owned']);
  assert.equal(fx.calls.filter((call) => call.ops[0]?.op === 'device.insert').length, 1);

  assert.ok(partial);
  const reversal = await reverseManagedFxChain(fx.host, partial);
  assert.deepEqual(reversal.deleted, ['owned']);
  assert.deepEqual(modelTrack(fx).devices.map((item) => item.name), ['Entry']);
});

test('4g managed chain reconciles a landed relocation before partial reversal', async () => {
  const fx = fixture();
  modelTrack(fx).devices.push(existingDevice('Entry', 0.25));
  const transient = failFirstChainProofAfter(fx, 'device.relocate');

  let partial: ManagedFxChainError['partial'];
  await assert.rejects(
    buildManagedFxChain(transient, {
      track: fx.track,
      devices: [{
        token: 'owned', source: { from: 'bitwig', uuid: 'owned' }, position: 0,
      }],
    }),
    (error: unknown) => {
      if (!(error instanceof ManagedFxChainError)) return false;
      partial = error.partial;
      return error.stage === 'relocate'
        && error.takes.map((take) => take.id).join(',') === 'managed-1,managed-2'
        && partial?.inserted[0]?.current.chainIndex === 0;
    },
  );
  assert.deepEqual(modelTrack(fx).devices.map((item) => item.name), ['owned', 'Entry']);
  assert.deepEqual(partial?.finalOrder, [
    { owner: 'inserted', token: 'owned' },
    { owner: 'entry', entryIndex: 0 },
  ]);
  assert.equal(fx.calls.filter((call) => call.ops[0]?.op === 'device.relocate').length, 1);

  assert.ok(partial);
  const reversal = await reverseManagedFxChain(fx.host, partial);
  assert.deepEqual(reversal.deleted, ['owned']);
  assert.deepEqual(modelTrack(fx).devices.map((item) => item.name), ['Entry']);
});

test('4g managed chain keeps earlier ownership when a later insert is an accepted no-op', async () => {
  let inserts = 0;
  const fx = fixture((ops, fake) => {
    if (ops[0]?.op !== 'device.insert' || ++inserts !== 2) return;
    fake.model.visibleTracks()[0]!.devices.pop();
  });

  let partial: ManagedFxChainError['partial'];
  await assert.rejects(
    buildManagedFxChain(fx.host, {
      track: fx.track,
      devices: [
        { token: 'one', source: { from: 'bitwig', uuid: 'one' } },
        { token: 'two', source: { from: 'bitwig', uuid: 'two' } },
      ],
    }),
    (error: unknown) => {
      if (!(error instanceof ManagedFxChainError)) return false;
      partial = error.partial;
      return error.stage === 'insert'
        && partial?.inserted.map((item) => item.token).join(',') === 'one';
    },
  );
  assert.deepEqual(modelTrack(fx).devices.map((item) => item.name), ['one']);

  assert.ok(partial);
  await reverseManagedFxChain(fx.host, partial);
  assert.deepEqual(modelTrack(fx).devices, []);
});

test('4g managed chain keeps the append address when relocation is an accepted no-op', async () => {
  const fx = fixture((ops, fake) => {
    if (ops[0]?.op !== 'device.relocate') return;
    const devices = fake.model.visibleTracks()[0]!.devices;
    devices.push(devices.shift()!);
  });
  modelTrack(fx).devices.push(existingDevice('Entry', 0.25));

  let partial: ManagedFxChainError['partial'];
  await assert.rejects(
    buildManagedFxChain(fx.host, {
      track: fx.track,
      devices: [{
        token: 'owned', source: { from: 'bitwig', uuid: 'owned' }, position: 0,
      }],
    }),
    (error: unknown) => {
      if (!(error instanceof ManagedFxChainError)) return false;
      partial = error.partial;
      return error.stage === 'relocate'
        && partial?.inserted[0]?.current.chainIndex === 1;
    },
  );
  assert.deepEqual(modelTrack(fx).devices.map((item) => item.name), ['Entry', 'owned']);

  assert.ok(partial);
  await reverseManagedFxChain(fx.host, partial);
  assert.deepEqual(modelTrack(fx).devices.map((item) => item.name), ['Entry']);
});

test('4g managed chain retains only earlier ownership when a landed insert has no mint', async () => {
  const fx = fixture();
  let inserts = 0;
  const missingMint: ManagedFxChainHost = {
    ...fx.host,
    async apply(ops, options) {
      const result = await fx.host.apply(ops, options);
      if (ops[0]?.op !== 'device.insert' || ++inserts !== 2) return result;
      return {
        take: {
          ...result.take,
          receipt: { ...result.take.receipt, minted: [] },
        },
      };
    },
  };

  let partial: ManagedFxChainError['partial'];
  await assert.rejects(
    buildManagedFxChain(missingMint, {
      track: fx.track,
      devices: [
        { token: 'one', source: { from: 'bitwig', uuid: 'one' } },
        { token: 'unknown', source: { from: 'bitwig', uuid: 'unknown' } },
      ],
    }),
    (error: unknown) => {
      if (!(error instanceof ManagedFxChainError)) return false;
      partial = error.partial;
      return error.stage === 'insert'
        && partial?.inserted.map((item) => item.token).join(',') === 'one'
        && partial.final.devices.map((item) => item.name).join(',') === 'one';
    },
  );
  assert.deepEqual(modelTrack(fx).devices.map((item) => item.name), ['one', 'unknown']);

  assert.ok(partial);
  await assert.rejects(
    reverseManagedFxChain(fx.host, partial),
    (error: unknown) => error instanceof ManagedFxChainError
      && error.stage === 'reversal-boundary',
  );
  assert.deepEqual(modelTrack(fx).devices.map((item) => item.name), ['one', 'unknown']);

  modelTrack(fx).devices.pop();
  const continued = await reverseManagedFxChain(fx.host, partial);
  assert.equal(continued.complete, true);
  assert.deepEqual(modelTrack(fx).devices, []);
});

test('4g managed chain reconciles a landed inserted enabled write', async () => {
  const fx = fixture();
  const transient = failFirstChainProofAfter(fx, 'device.setEnabled');

  let partial: ManagedFxChainError['partial'];
  await assert.rejects(
    buildManagedFxChain(transient, {
      track: fx.track,
      devices: [{
        token: 'owned', source: { from: 'bitwig', uuid: 'owned' }, enabled: false,
      }],
    }),
    (error: unknown) => {
      if (!(error instanceof ManagedFxChainError)) return false;
      partial = error.partial;
      return error.stage === 'scalar'
        && partial?.final.devices[0]?.enabled === false;
    },
  );
  assert.ok(partial);
  await reverseManagedFxChain(fx.host, partial);
  assert.deepEqual(modelTrack(fx).devices, []);
});

test('4g managed chain reconciles and reverses an existing enabled-only write', async () => {
  const fx = fixture();
  modelTrack(fx).devices.push(existingDevice('Entry', 0.25));
  const transient = failFirstChainProofAfter(fx, 'device.setEnabled');

  let partial: ManagedFxChainError['partial'];
  await assert.rejects(
    buildManagedFxChain(transient, {
      track: fx.track,
      devices: [],
      existingEnabled: [{
        device: { kind: 'device', track: fx.track, chainIndex: 0 },
        expectedName: 'Entry',
        enabled: false,
      }],
    }),
    (error: unknown) => {
      if (!(error instanceof ManagedFxChainError)) return false;
      partial = error.partial;
      return error.stage === 'scalar'
        && partial?.inserted.length === 0
        && partial.scalars.length === 1
        && partial.final.devices[0]?.enabled === false;
    },
  );
  assert.equal(modelTrack(fx).devices[0]!.enabled, false);

  assert.ok(partial);
  await reverseManagedFxChain(fx.host, partial);
  assert.equal(modelTrack(fx).devices[0]!.enabled, true);
});

test('4g managed chain replaces a stale enabled readback with the chain proof', async () => {
  const fx = fixture();
  modelTrack(fx).devices.push(existingDevice('Entry', 0.25));
  let staleRead = false;
  let failNextChain = false;
  const contradictory: ManagedFxChainHost = {
    ...fx.host,
    async apply(ops, options) {
      const result = await fx.host.apply(ops, options);
      if (ops[0]?.op === 'device.setEnabled') {
        staleRead = true;
        failNextChain = true;
      }
      return result;
    },
    async read(addresses) {
      const snapshot = await fx.host.read(addresses);
      const enabledAddress = addresses.find((address) => address.kind === 'deviceEnabled');
      if (!staleRead || enabledAddress === undefined) return snapshot;
      staleRead = false;
      const key = addressKey(enabledAddress);
      const entry = snapshot.entries[key];
      assert.equal(entry?.value.of, 'deviceEnabled');
      return {
        ...snapshot,
        entries: {
          ...snapshot.entries,
          [key]: { ...entry!, value: { of: 'deviceEnabled', enabled: true } },
        },
      };
    },
    async devices(target) {
      const observed = await fx.host.devices(target);
      if (!failNextChain) return observed;
      failNextChain = false;
      return { ...observed, devicesComplete: false };
    },
  };

  let partial: ManagedFxChainError['partial'];
  await assert.rejects(
    buildManagedFxChain(contradictory, {
      track: fx.track,
      devices: [],
      existingEnabled: [{
        device: { kind: 'device', track: fx.track, chainIndex: 0 },
        expectedName: 'Entry',
        enabled: false,
      }],
    }),
    (error: unknown) => {
      if (!(error instanceof ManagedFxChainError)) return false;
      partial = error.partial;
      const scalar = partial?.scalars[0];
      return error.stage === 'scalar'
        && scalar?.kind === 'enabled'
        && scalar.readback === false
        && scalar.took
        && partial?.report.nonTaking.length === 0;
    },
  );
  assert.equal(modelTrack(fx).devices[0]!.enabled, false);

  assert.ok(partial);
  await reverseManagedFxChain(fx.host, partial);
  assert.equal(modelTrack(fx).devices[0]!.enabled, true);
});

test('4g managed chain does not own a live-shaped failed enabled guard', async () => {
  const fx = fixture(undefined, (ops, fake) => {
    if (ops[0]?.op !== 'device.setEnabled') return;
    fake.model.visibleTracks()[0]!.devices[0]!.enabled = false;
  });
  modelTrack(fx).devices.push(existingDevice('Entry', 0.25));
  const liveShaped: ManagedFxChainHost = {
    ...fx.host,
    async apply(ops, options) {
      const result = await fx.host.apply(ops, options);
      if (ops[0]?.op !== 'device.setEnabled') return result;
      return {
        take: {
          ...result.take,
          report: {
            ...result.take.report,
            failed: result.take.report.failed.map((failure) => ({
              ...failure,
              error: 'device.setEnabled state changed from true to false',
            })),
          },
        },
      };
    },
  };

  await assert.rejects(
    buildManagedFxChain(liveShaped, {
      track: fx.track,
      devices: [],
      existingEnabled: [{
        device: { kind: 'device', track: fx.track, chainIndex: 0 },
        expectedName: 'Entry',
        enabled: false,
      }],
    }),
    (error: unknown) => error instanceof ManagedFxChainError
      && error.stage === 'scalar'
      && /enabled-state guard/.test(error.message)
      && error.partial === undefined,
  );
  const op = fx.calls[0]?.ops[0];
  assert.equal(op?.op === 'device.setEnabled' ? op.expectedEnabled : undefined, true);
  assert.equal(modelTrack(fx).devices[0]!.enabled, false, 'the human state remains unchanged');
});

test('4g managed chain keeps a recovery handle when a later scalar stage is rejected', async () => {
  const fx = fixture();
  const rejecting: ManagedFxChainHost = {
    ...fx.host,
    async apply(ops, options) {
      if (ops.length !== 2 || !ops.every((op) => op.op === 'param.set')) {
        return fx.host.apply(ops, options);
      }
      const landed = await fx.host.apply([ops[0]!], options);
      const at = landed.take.receipt.at;
      const rejected = {
        reason: 'stale-revision' as const,
        expected: at.revision,
        actual: at.revision + 1,
      };
      return {
        take: {
          ...landed.take,
          ops,
          receipt: { ...landed.take.receipt, accepted: false, rejected },
          report: { ...landed.take.report, applied: false, rejected },
        },
      };
    },
  };
  let partial: ManagedFxChainError['partial'];
  await assert.rejects(
    buildManagedFxChain(rejecting, {
      track: fx.track,
      devices: [{
        token: 'partial',
        source: { from: 'bitwig', uuid: 'partial' },
        parameters: [
          { directId: 'P1', value: 0.1 },
          { directId: 'P2', value: 0.2 },
        ],
      }],
    }),
    (error: unknown) => {
      if (!(error instanceof ManagedFxChainError)) return false;
      partial = error.partial;
      return error.stage === 'scalar' && partial?.failedStage === 'scalar';
    },
  );
  assert.equal(modelTrack(fx).devices[0]!.params[0]!.value, 0.1, 'the earlier scalar stage landed');
  assert.equal(modelTrack(fx).devices[0]!.params[1]!.value, 0.5, 'the later stage did not land');
  assert.ok(partial);
  await reverseManagedFxChain(fx.host, partial);
  assert.deepEqual(modelTrack(fx).devices, []);
});

test('4g managed chain rejects a concurrent chain edit before a minted parameter can mis-aim', async () => {
  const fx = fixture(undefined, (ops, fake, call) => {
    if (call !== 2 || ops[0]?.op !== 'param.set') return;
    fake.model.visibleTracks()[0]!.devices.unshift(existingDevice('Human', 0.4));
    control(fake).bumpRevision();
  });
  modelTrack(fx).devices.push(existingDevice('Input', 0.25), existingDevice('Output', 0.75));

  await assert.rejects(
    buildManagedFxChain(fx.host, {
      track: fx.track,
      devices: [{
        token: 'inserted',
        source: { from: 'bitwig', uuid: 'inserted' },
        position: 1,
        parameters: [{ directId: 'P1', value: 0.9 }],
      }],
    }),
    (error: unknown) => error instanceof ManagedFxChainError
      && error.stage === 'scalar'
      && /revision guard/.test(error.message),
  );
  assert.equal(modelTrack(fx).devices.find((item) => item.name === 'inserted')!.params[0]!.value, 0.5);
  assert.equal(modelTrack(fx).devices.find((item) => item.name === 'Output')!.params[0]!.value, 0.75);
  assert.equal(fx.calls.some((call) => call.ops[0]?.op === 'device.relocate'), false);
});

test('4g managed chain refuses a raw pre-insert edit without relying on the revision counter', async () => {
  const fx = fixture(undefined, (ops, fake, call) => {
    if (call !== 1 || ops[0]?.op !== 'device.insert') return;
    fake.model.visibleTracks()[0]!.devices.splice(1, 0, existingDevice('Human', 0.4));
  });
  modelTrack(fx).devices.push(existingDevice('Input', 0.25), existingDevice('Output', 0.75));

  await assert.rejects(
    buildManagedFxChain(fx.host, {
      track: fx.track,
      devices: [{ token: 'owned', source: { from: 'bitwig', uuid: 'owned' } }],
    }),
    (error: unknown) => error instanceof ManagedFxChainError && error.stage === 'insert',
  );
  assert.deepEqual(modelTrack(fx).devices.map((item) => item.name), ['Input', 'Human', 'Output']);
  const op = fx.calls[0]?.ops[0];
  assert.equal(op?.op, 'device.insert');
  assert.deepEqual(op?.op === 'device.insert' ? op.expectedChain : undefined, ['Input', 'Output']);
});

test('4g managed chain refuses an unrelated raw enabled toggle before insert', async () => {
  const fx = fixture(undefined, (ops, fake) => {
    if (ops[0]?.op !== 'device.insert') return;
    fake.model.visibleTracks()[0]!.devices[1]!.enabled = false;
  });
  modelTrack(fx).devices.push(existingDevice('Input', 0.25), existingDevice('Output', 0.75));

  await assert.rejects(
    buildManagedFxChain(fx.host, {
      track: fx.track,
      devices: [{ token: 'owned', source: { from: 'bitwig', uuid: 'owned' } }],
    }),
    (error: unknown) => error instanceof ManagedFxChainError
      && error.stage === 'insert'
      && error.partial === undefined,
  );
  assert.deepEqual(modelTrack(fx).devices.map((item) => item.name), ['Input', 'Output']);
  assert.equal(modelTrack(fx).devices[1]!.enabled, false);
  const op = fx.calls[0]?.ops[0];
  assert.deepEqual(op?.op === 'device.insert' ? op.expectedEnabledChain : undefined, [true, true]);
});

test('4g managed chain refuses a raw edit before a minted parameter can write the new occupant', async () => {
  const fx = fixture(undefined, (ops, fake, call) => {
    if (call !== 2 || ops[0]?.op !== 'param.set') return;
    fake.model.visibleTracks()[0]!.devices.unshift(existingDevice('Human', 0.4));
  });
  modelTrack(fx).devices.push(existingDevice('Input', 0.25), existingDevice('Output', 0.75));

  await assert.rejects(
    buildManagedFxChain(fx.host, {
      track: fx.track,
      devices: [{
        token: 'owned',
        source: { from: 'bitwig', uuid: 'owned' },
        parameters: [{ directId: 'P1', value: 0.9 }],
      }],
    }),
    (error: unknown) => error instanceof ManagedFxChainError && error.stage === 'scalar',
  );
  assert.equal(modelTrack(fx).devices.find((item) => item.name === 'Output')!.params[0]!.value, 0.75);
  assert.equal(modelTrack(fx).devices.find((item) => item.name === 'owned')!.params[0]!.value, 0.5);
  const op = fx.calls[1]?.ops[0];
  assert.equal(op?.op, 'param.set');
  assert.deepEqual(op?.op === 'param.set' ? op.expectedChain : undefined, [
    'Input', 'Output', 'owned',
  ]);
  assert.equal(op?.op === 'param.set' ? op.expectedName : undefined, 'owned');
});

test('4g managed chain retains earlier ownership after an unrelated enabled guard rejects a parameter', async () => {
  const fx = fixture(undefined, (ops, fake, call) => {
    if (call !== 2 || ops[0]?.op !== 'param.set') return;
    fake.model.visibleTracks()[0]!.devices[0]!.enabled = false;
  });
  modelTrack(fx).devices.push(existingDevice('Entry', 0.25));

  let partial: ManagedFxChainError['partial'];
  await assert.rejects(
    buildManagedFxChain(fx.host, {
      track: fx.track,
      devices: [{
        token: 'owned',
        source: { from: 'bitwig', uuid: 'owned' },
        parameters: [{ directId: 'P1', value: 0.9 }],
      }],
    }),
    (error: unknown) => {
      if (!(error instanceof ManagedFxChainError)) return false;
      partial = error.partial;
      return error.stage === 'scalar'
        && partial?.inserted.map((item) => item.token).join(',') === 'owned';
    },
  );
  assert.equal(modelTrack(fx).devices[0]!.enabled, false);
  assert.equal(modelTrack(fx).devices[1]!.params[0]!.value, 0.5);
  const op = fx.calls[1]?.ops[0];
  assert.deepEqual(op?.op === 'param.set' ? op.expectedEnabledChain : undefined, [true, true]);

  assert.ok(partial);
  await assert.rejects(
    reverseManagedFxChain(fx.host, partial),
    (error: unknown) => error instanceof ManagedFxChainError
      && error.stage === 'reversal-boundary',
  );
  modelTrack(fx).devices[0]!.enabled = true;
  await reverseManagedFxChain(fx.host, partial);
  assert.deepEqual(modelTrack(fx).devices.map((item) => item.name), ['Entry']);
});

test('4g managed chain keeps the active stage when a host guard throws', async () => {
  const fx = fixture();
  const guarded: ManagedFxChainHost = {
    ...fx.host,
    async apply(ops, options) {
      if (ops[0]?.op === 'param.set') throw new Error('the raw chain changed');
      return fx.host.apply(ops, options);
    },
  };
  let partial: ManagedFxChainError['partial'];
  await assert.rejects(
    buildManagedFxChain(guarded, {
      track: fx.track,
      devices: [{
        token: 'owned',
        source: { from: 'bitwig', uuid: 'owned' },
        parameters: [{ directId: 'P1', value: 0.9 }],
      }],
    }),
    (error: unknown) => {
      if (!(error instanceof ManagedFxChainError)) return false;
      partial = error.partial;
      return error.stage === 'scalar'
        && /raw chain changed/.test(error.message)
        && error.takes.map((take) => take.id).join(',') === 'managed-1';
    },
  );
  assert.ok(partial);
  await reverseManagedFxChain(fx.host, partial);
  assert.deepEqual(modelTrack(fx).devices, []);
});

test('4g managed chain refuses a raw anchor edit before relocation', async () => {
  const fx = fixture(undefined, (ops, fake, call) => {
    if (call !== 2 || ops[0]?.op !== 'device.relocate') return;
    fake.model.visibleTracks()[0]!.devices.splice(1, 0, existingDevice('Human', 0.4));
  });
  modelTrack(fx).devices.push(existingDevice('Input', 0.25), existingDevice('Anchor', 0.75));

  await assert.rejects(
    buildManagedFxChain(fx.host, {
      track: fx.track,
      devices: [{
        token: 'owned', source: { from: 'bitwig', uuid: 'owned' }, position: 1,
      }],
    }),
    (error: unknown) => error instanceof ManagedFxChainError && error.stage === 'relocate',
  );
  assert.deepEqual(modelTrack(fx).devices.map((item) => item.name), [
    'Input', 'Human', 'Anchor', 'owned',
  ]);
  const op = fx.calls[1]?.ops[0];
  assert.equal(op?.op, 'device.relocate');
  assert.deepEqual(op?.op === 'device.relocate' ? op.expectedChain : undefined, [
    'Input', 'Anchor', 'owned',
  ]);
});

test('4g managed reversal refuses a changed final chain before an owned delete', async () => {
  const fx = fixture();
  modelTrack(fx).devices.push(existingDevice('Entry', 0.25));
  const checkpoint = await buildManagedFxChain(fx.host, {
    track: fx.track,
    devices: [{ token: 'owned', source: { from: 'bitwig', uuid: 'owned' }, position: 0 }],
  });
  const callsBefore = fx.calls.length;
  modelTrack(fx).devices.push(existingDevice('Human', 0.6));
  control(fx.fake).bumpRevision();

  await assert.rejects(
    reverseManagedFxChain(fx.host, checkpoint),
    (error: unknown) => error instanceof ManagedFxChainError
      && error.stage === 'reversal-boundary'
      && /expected/.test(error.message),
  );
  assert.equal(fx.calls.length, callsBefore, 'the reversal sent no scalar or delete write');
  assert.deepEqual(modelTrack(fx).devices.map((item) => item.name), ['owned', 'Entry', 'Human']);
});

test('4g managed reversal continues from the last proved delete after a later refusal', async () => {
  const fx = fixture();
  modelTrack(fx).devices.push(existingDevice('Entry', 0.25));
  const checkpoint = await buildManagedFxChain(fx.host, {
    track: fx.track,
    devices: [
      { token: 'one', source: { from: 'bitwig', uuid: 'one' } },
      { token: 'two', source: { from: 'bitwig', uuid: 'two' } },
    ],
  });
  let deleteCalls = 0;
  const rejecting: ManagedFxChainHost = {
    ...fx.host,
    async apply(ops, options) {
      if (ops[0]?.op === 'device.delete' && ++deleteCalls === 2) {
        throw new Error('the later delete guard rejected the write');
      }
      return fx.host.apply(ops, options);
    },
  };

  let partial: ManagedFxChainError['partial'];
  await assert.rejects(
    reverseManagedFxChain(rejecting, checkpoint),
    (error: unknown) => {
      if (!(error instanceof ManagedFxChainError)) return false;
      partial = error.partial;
      return error.stage === 'delete'
        && error.takes.map((take) => take.id).join(',') === 'managed-3';
    },
  );
  assert.deepEqual(modelTrack(fx).devices.map((item) => item.name), ['Entry', 'one']);
  assert.deepEqual(partial?.final.devices.map((item) => item.name), ['Entry', 'one']);
  assert.deepEqual(partial?.inserted.map((item) => [item.token, item.current.chainIndex]), [
    ['one', 1],
  ]);

  assert.ok(partial);
  const continued = await reverseManagedFxChain(fx.host, partial);
  assert.equal(continued.complete, true);
  assert.deepEqual(continued.deleted, ['one']);
  assert.deepEqual(continued.after.devices.map((item) => item.name), ['Entry']);
  assert.deepEqual(modelTrack(fx).devices.map((item) => item.name), ['Entry']);
});

test('4g managed reversal reconciles a landed enabled restore before retry', async () => {
  const fx = fixture();
  modelTrack(fx).devices.push(existingDevice('Entry', 0.25));
  const checkpoint = await buildManagedFxChain(fx.host, {
    track: fx.track,
    devices: [],
    existingEnabled: [{
      device: { kind: 'device', track: fx.track, chainIndex: 0 },
      expectedName: 'Entry',
      enabled: false,
    }],
  });
  const transient = failFirstChainProofAfter(fx, 'device.setEnabled');

  let partial: ManagedFxChainError['partial'];
  await assert.rejects(
    reverseManagedFxChain(transient, checkpoint),
    (error: unknown) => {
      if (!(error instanceof ManagedFxChainError)) return false;
      partial = error.partial;
      return error.stage === 'restore-scalar'
        && partial?.scalars.length === 0
        && partial.final.devices[0]?.enabled === true;
    },
  );
  assert.equal(modelTrack(fx).devices[0]!.enabled, true);

  assert.ok(partial);
  const continued = await reverseManagedFxChain(fx.host, partial);
  assert.equal(continued.complete, true);
  assert.equal(fx.calls.filter((call) => call.ops[0]?.op === 'device.setEnabled').length, 2);
});

test('4g managed reversal reconciles a landed delete before retry', async () => {
  const fx = fixture();
  modelTrack(fx).devices.push(existingDevice('Entry', 0.25));
  const checkpoint = await buildManagedFxChain(fx.host, {
    track: fx.track,
    devices: [{ token: 'owned', source: { from: 'bitwig', uuid: 'owned' } }],
  });
  const transient = failFirstChainProofAfter(fx, 'device.delete');

  let partial: ManagedFxChainError['partial'];
  await assert.rejects(
    reverseManagedFxChain(transient, checkpoint),
    (error: unknown) => {
      if (!(error instanceof ManagedFxChainError)) return false;
      partial = error.partial;
      return error.stage === 'delete'
        && partial?.inserted.length === 0
        && partial.final.devices.map((item) => item.name).join(',') === 'Entry';
    },
  );
  assert.deepEqual(modelTrack(fx).devices.map((item) => item.name), ['Entry']);

  assert.ok(partial);
  const continued = await reverseManagedFxChain(fx.host, partial);
  assert.equal(continued.complete, true);
  assert.equal(fx.calls.filter((call) => call.ops[0]?.op === 'device.delete').length, 1);
});

test('4g managed reversal retains its boundary after an unrelated enabled delete guard', async () => {
  let reversing = false;
  const fx = fixture(undefined, (ops, fake) => {
    if (!reversing || ops[0]?.op !== 'device.delete') return;
    fake.model.visibleTracks()[0]!.devices[0]!.enabled = false;
    reversing = false;
  });
  modelTrack(fx).devices.push(existingDevice('Entry', 0.25));
  const checkpoint = await buildManagedFxChain(fx.host, {
    track: fx.track,
    devices: [{ token: 'owned', source: { from: 'bitwig', uuid: 'owned' } }],
  });
  reversing = true;

  let partial: ManagedFxChainError['partial'];
  await assert.rejects(
    reverseManagedFxChain(fx.host, checkpoint),
    (error: unknown) => {
      if (!(error instanceof ManagedFxChainError)) return false;
      partial = error.partial;
      return error.stage === 'delete'
        && partial?.inserted.map((item) => item.token).join(',') === 'owned'
        && partial.final.devices[0]?.enabled === true;
    },
  );
  assert.deepEqual(modelTrack(fx).devices.map((item) => item.name), ['Entry', 'owned']);
  assert.equal(modelTrack(fx).devices[0]!.enabled, false);
  const deleteOp = fx.calls.flatMap((call) => call.ops)
    .find((op) => op.op === 'device.delete');
  assert.deepEqual(
    deleteOp?.op === 'device.delete' ? deleteOp.expectedEnabledChain : undefined,
    [true, true],
  );

  assert.ok(partial);
  modelTrack(fx).devices[0]!.enabled = true;
  const continued = await reverseManagedFxChain(fx.host, partial);
  assert.equal(continued.complete, true);
  assert.deepEqual(modelTrack(fx).devices.map((item) => item.name), ['Entry']);
});
