/** The device and layer-chain tools of agent-native-v1 (8h4e), against the fake adapter. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import type { FakeDevice } from '../adapters/fake/model.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { compositionBackend } from './agent-native-devices.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from './tools.js';
import { workspaceOf } from './workspace.js';

type Wire = Record<string, any>;

const device = (name: string, over: Partial<FakeDevice> = {}): FakeDevice => ({
  name, enabled: true, paramsLive: true, params: [{ id: `CONTENTS/${name}`, name: `${name} level`, value: 0.5 }],
  ...over,
});

function fixture(top: (id: () => string) => FakeDevice[]) {
  const fake = new FakeAdapter({ tracks: ['gn-devices'], scenes: 2 });
  const row = fake.model.visibleTracks()[0]!;
  let chainId = 0;
  row.devices.push(...top(() => `chain-${++chainId}`));
  let id = 0;
  const stash = new Stash({ now: () => id });
  const workspace = workspaceOf({
    ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `dev-${++id}`, now: () => id }),
    stash, observationStore: new FakeObservationStore(), documents: new IdentityRegistry(),
  });
  const native = async (name: string, args: unknown) =>
    await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  return { fake, row, trackId: row.channelId, native, stash };
}

const abFixture = () => fixture((id) => [
  device('Polysynth'),
  device('FX Layer', { params: [], chains: [
    { name: 'A', solo: false, id: id(), devices: [device('EQ+')] },
    { name: 'B', solo: false, id: id(), devices: [device('Delay+')] },
  ] }),
  device('Tool'),
]);

test('8h4e read_devices: top-level order, addressed layer chains, and coverage in one envelope', async () => {
  const fx = fixture((id) => [
    device('Polysynth'),
    device('FX Layer', { params: [], chains: [
      { name: 'A', solo: true, id: id(), devices: [device('EQ+'), device('Delay+')] },
      { name: 'B', solo: false, id: id(), devices: [] },
    ] }),
    device('Tool'),
    device('Late FX Layer', { params: [], chains: [{ name: 'X', solo: false, id: id(), devices: [] }] }),
  ]);
  const read = await fx.native('read_devices', { trackId: fx.trackId });
  assert.equal(read.schema, 'ghostnote-devices/1', JSON.stringify(read));
  assert.equal(read.coverage.status, 'complete');
  assert.deepEqual(read.data.devices.map((item: Wire) => item.name), ['Polysynth', 'FX Layer', 'Tool', 'Late FX Layer']);
  const container = read.data.devices[1].container;
  assert.equal(container.containerKind, 'FX Layer');
  assert.deepEqual(container.layerChains.map((item: Wire) => [item.name, item.solo, item.devices.map((d: Wire) => d.name)]),
    [['A', true, ['EQ+', 'Delay+']], ['B', false, []]]);
  assert.equal(read.data.devices[0].container, undefined);
  assert.equal(read.data.devices[3].layerChains, 'outside-limit');
  assert.ok(!('parameters' in read.data.devices[0]), 'read_devices reads no parameters');
});

test('8h4e set_layer_chain_solo: exclusive, on, off, and an idempotent no-op', async () => {
  const fx = abFixture();
  const call = (layerChain: string, mode: string) => fx.native('set_layer_chain_solo',
    { trackId: fx.trackId, containerPosition: 1, layerChain, mode });
  const solos = () => fx.row.devices[1]!.chains!.map((item) => item.solo);
  const exclusive = await call('B', 'exclusive');
  assert.equal(exclusive.applied, true, JSON.stringify(exclusive));
  assert.equal(exclusive.readback.status, 'verified');
  assert.deepEqual(solos(), [false, true]);
  const again = await call('B', 'exclusive');
  assert.equal(again.applied, false);
  assert.equal(again.readback.status, 'already-set');
  assert.equal(again.effects.length, 0);
  const on = await call('A', 'on');
  assert.equal(on.readback.status, 'verified', JSON.stringify(on));
  assert.deepEqual(solos(), [true, true]);
  const off = await call('B', 'off');
  assert.equal(off.readback.status, 'verified');
  assert.deepEqual(solos(), [true, false]);
  const absent = await call('C', 'on');
  assert.equal(absent.failure.code, 'absent');
  const outside = await fx.native('set_layer_chain_solo', { trackId: fx.trackId, containerPosition: 0,
    layerChain: 'A', mode: 'on' });
  assert.ok(['unsupported', 'absent'].includes(outside.failure.code), JSON.stringify(outside));
  assert.equal(outside.failure.effects.length, 0);
});

test('8h4e rename and duplicate: unique names, readback, and no typed reversal of a copy', async () => {
  const fx = abFixture();
  const renamed = await fx.native('rename_layer_chain', { trackId: fx.trackId, containerPosition: 1,
    layerChain: 'A', name: 'Bright' });
  assert.equal(renamed.readback.status, 'verified', JSON.stringify(renamed));
  assert.deepEqual(renamed.readback.layerChains, ['Bright', 'B']);
  const taken = await fx.native('rename_layer_chain', { trackId: fx.trackId, containerPosition: 1,
    layerChain: 'Bright', name: 'B' });
  assert.equal(taken.failure.code, 'collision');
  const copy = await fx.native('duplicate_layer_chain', { trackId: fx.trackId, containerPosition: 1,
    layerChain: 'Bright', name: 'Bright 2' });
  assert.equal(copy.readback.status, 'verified', JSON.stringify(copy));
  assert.deepEqual(copy.readback.layerChain.devices.map((item: Wire) => item.name), ['EQ+']);
  assert.match(copy.next.remove, /computer control/);
});

test('8h4e winner collapse recipe: move out, delete the container, restore the position', async () => {
  const fx = abFixture();
  const extracted = await fx.native('move_devices', { trackId: fx.trackId,
    devices: [{ from: 'layer-chain', containerPosition: 1, layerChain: 'B', devicePosition: 0 }],
    destination: { to: 'track-end' } });
  assert.equal(extracted.readback.status, 'verified', JSON.stringify(extracted));
  assert.deepEqual(extracted.readback.topLevel.map((item: Wire) => item.name), ['Polysynth', 'FX Layer', 'Tool', 'Delay+']);
  assert.deepEqual(extracted.readback.layerChains[0].devices, []);

  const refused = await fx.native('delete_device', { devices: [{ trackId: fx.trackId, position: 1, layerChain: 'A' }] });
  assert.equal(refused.failure.code, 'unsupported');
  assert.equal(refused.detail.reason, 'layer-chain-delete');
  assert.equal(fx.row.devices.length, 4, 'the refusal wrote nothing');

  const deleted = await fx.native('delete_device', { devices: [{ trackId: fx.trackId, position: 1 }] });
  assert.equal(deleted.applied, true, JSON.stringify(deleted));
  assert.deepEqual(deleted.readback.removedLayerChains[0].layerChains.map((item: Wire) => item.name), ['A', 'B']);

  const restored = await fx.native('move_devices', { trackId: fx.trackId,
    devices: [{ from: 'top-level', devicePosition: 2 }], destination: { to: 'top-level-position', position: 1 } });
  assert.equal(restored.readback.status, 'verified', JSON.stringify(restored));
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['Polysynth', 'Delay+', 'Tool']);
});

test('8h4e move and copy into a layer chain; unsupported routes refuse before a write', async () => {
  const fx = abFixture();
  const copied = await fx.native('copy_devices', { trackId: fx.trackId,
    devices: [{ from: 'top-level', devicePosition: 0 }],
    destination: { to: 'layer-chain', containerPosition: 1, layerChain: 'A' } });
  assert.equal(copied.readback.status, 'verified', JSON.stringify(copied));
  assert.deepEqual(fx.row.devices[1]!.chains![0]!.devices.map((item) => item.name), ['EQ+', 'Polysynth']);
  assert.equal(fx.row.devices[0]!.name, 'Polysynth');

  const moved = await fx.native('move_devices', { trackId: fx.trackId,
    devices: [{ from: 'top-level', devicePosition: 0 }],
    destination: { to: 'layer-chain', containerPosition: 1, layerChain: 'B' } });
  assert.equal(moved.readback.status, 'verified', JSON.stringify(moved));
  assert.deepEqual(fx.row.devices.map((item) => item.name), ['FX Layer', 'Tool']);
  assert.equal(moved.readback.layerChains[0].containerPosition, 0);

  const before = fx.stash.log.list().length;
  for (const args of [
    { devices: [{ from: 'top-level', devicePosition: 0 }], destination: { to: 'track-end' } },
    { devices: [{ from: 'top-level', devicePosition: 0 },
      { from: 'layer-chain', containerPosition: 0, layerChain: 'A', devicePosition: 0 }],
    destination: { to: 'layer-chain', containerPosition: 0, layerChain: 'B' } },
  ]) {
    const result = await fx.native('move_devices', { trackId: fx.trackId, ...args });
    assert.equal(result.failure.code, 'unsupported', JSON.stringify(result));
  }
  assert.equal(fx.stash.log.list().length, before, 'no refused route recorded a change');
});

test('8h4e add_devices: every unknown native name refuses together before a write', async () => {
  const fx = abFixture();
  const result = await fx.native('add_devices', { trackId: fx.trackId,
    devices: [{ kind: 'native', name: 'Not A Device' }, { kind: 'native', name: 'Polysynth' }] });
  assert.equal(result.failure.code, 'invalid-input', JSON.stringify(result));
  assert.ok(Array.isArray(result.detail.failedDeviceNames));
  assert.equal(fx.row.devices.length, 3);
  const preset = await fx.native('add_devices', { trackId: fx.trackId,
    devices: [{ kind: 'preset', path: 'relative.bwpreset' }] });
  assert.equal(preset.failure.code, 'invalid-input');
});

test('8h4e compose_devices: the private backend boundary', () => {
  const chain = (name: string, source: Wire, extra: Wire = {}) => ({ name, devices: [{ source, ...extra }] });
  const native = (name: string) => ({ kind: 'native' as const, name });
  const base = { trackId: 't', containerKind: 'Instrument Layer' as const };
  const two = { ...base, layerChains: [chain('A', native('Polysynth')), chain('B', native('Phase-4'))] };
  assert.equal(compositionBackend(two as never, 0), 'offline');
  assert.equal(compositionBackend({ ...two, layerChains: [...two.layerChains, chain('C', native('FM-4')),
    chain('D', native('Organ'))] } as never, 1), 'offline');
  assert.equal(compositionBackend({ ...two, layerChains: [...two.layerChains, chain('C', native('FM-4')),
    chain('D', native('Organ')), chain('E', native('Sampler'))] } as never, 0), 'staged', 'five layer chains');
  assert.equal(compositionBackend({ ...two, containerKind: 'FX Layer' } as never, 0), 'staged');
  assert.equal(compositionBackend(two as never, 3), 'staged', 'the end is outside the observable positions');
  assert.equal(compositionBackend({ ...two, containerPosition: 0 } as never, 1), 'staged', 'a caller position');
  assert.equal(compositionBackend({ ...base, layerChains: [chain('A', { kind: 'clap', id: 'x' })] } as never, 0),
    'staged');
  assert.equal(compositionBackend({ ...base, layerChains: [chain('A', native('Polysynth'), { modulators: [] })] } as never, 0),
    'staged', 'outer modulators');
  assert.equal(compositionBackend({ ...base, layerChains: [chain('A', native('Polysynth')),
    chain('B', native('Polysynth'))] } as never, 0), 'staged', 'repeated native names');
  assert.equal(compositionBackend({ trackId: 't', containerKind: 'Drum Machine', pads: [] } as never, 0),
    'drum-machine');
});

test('8h4e compose_devices: offline-only edits refuse on the staged path before a write', async () => {
  const fx = abFixture();
  const result = await fx.native('compose_devices', { trackId: fx.trackId, containerKind: 'FX Layer',
    containerPosition: 2, layerChains: [{ name: 'A', devices: [{ source: { kind: 'native', name: 'EQ+' },
      modulatorEdits: [{ kind: 'delete', modulator: 'LFO' }] }] }] });
  assert.equal(result.failure.code, 'unsupported', JSON.stringify(result));
  assert.equal(result.detail.reason, 'offline-only-edits');
  assert.equal(fx.stash.log.list().length, 0);
});

test('8h4e read_device_controls: display completeness and the layer-chain route', async () => {
  const fx = abFixture();
  const read = await fx.native('read_device_controls', { device: { trackId: fx.trackId, devicePosition: 1,
    route: [{ through: 'layer-chain', name: 'A', devicePosition: 0 }] } });
  assert.equal(read.standing, 'stable', JSON.stringify(read));
  assert.equal(read.deviceName, 'EQ+');
  assert.equal(typeof read.displayComplete, 'boolean');
  const set = await fx.native('set_device_controls', { settings: [{ kind: 'direct',
    device: { trackId: fx.trackId, devicePosition: 1, route: [{ through: 'layer-chain', name: 'A', devicePosition: 0 }] },
    parameterId: 'CONTENTS/EQ+', normalizedValue: 0.25 }] });
  assert.equal(set.verified, true, JSON.stringify(set));
  assert.equal(fx.row.devices[1]!.chains![0]!.devices[0]!.params[0]!.value, 0.25);
});

test('8h4e set_device_controls: a 27-control success stays at or below 3,181 bytes (E126)', async () => {
  const fx = fixture(() => [{ name: 'Size synth', paramsLive: true,
    params: Array.from({ length: 27 }, (_, index) => ({ id: `P${index + 1}`, name: `Parameter ${index + 1}`, value: 0 })) }]);
  const result = await fx.native('set_device_controls', { settings: Array.from({ length: 27 }, (_, index) => ({
    kind: 'direct', device: { trackId: fx.trackId, devicePosition: 0 }, parameterId: `P${index + 1}`,
    normalizedValue: (index + 1) / 28 })) });
  assert.equal(result.verified, true);
  assert.ok(Buffer.byteLength(JSON.stringify({ ...result, elapsedMs: 0 }), 'utf8') <= 3181);
});

test('8h4e compose_devices: a Drum Machine write that the revision guard refuses reports no effect', async () => {
  const fake = new FakeAdapter({ tracks: ['gn-drums'], scenes: 1 });
  const row = fake.model.visibleTracks()[0]!;
  let id = 0;
  const base = workspaceOf({
    ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `drum-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore: new FakeObservationStore(), documents: new IdentityRegistry(),
  });
  // A stale revision guard: the executor refuses the whole batch before any write.
  const workspace = { ...base, apply: (ops: Parameters<typeof base.apply>[0], run?: Parameters<typeof base.apply>[1]) =>
    base.apply(ops, { ...run, ifRevision: -1 }) };
  const result = await callTool(workspace, 'compose_devices', { trackId: row.channelId, containerKind: 'Drum Machine',
    pads: [{ midiNote: 36, deviceName: 'v1 Kick' }] }, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  assert.equal(row.devices.length, 0, 'nothing was inserted');
  assert.equal(result.applied, undefined, JSON.stringify(result).slice(0, 400));
  assert.equal(result.failure?.code, 'target-changed', JSON.stringify(result).slice(0, 400));
  assert.deepEqual(result.failure.effects, []);
  assert.match(result.message, /changed before the write/);
});
