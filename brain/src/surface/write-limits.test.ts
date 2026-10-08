/**
 * D44 (8i3, E252): each long write refuses a request above its limit before any project read or write, with code
 * outside-limit and the limit in detail.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { z } from 'zod';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, AGENT_NATIVE_TOOLS, callTool } from './tools.js';
import { workspaceOf } from './workspace.js';
import { WRITE_LIMITS, type WriteLimit } from './write-limits.js';

type Wire = Record<string, any>;

/** Counts every adapter call. A refusal at the limit makes none. */
class CountingAdapter extends FakeAdapter {
  calls = 0;
  override async revision(...args: Parameters<FakeAdapter['revision']>) { this.calls++; return super.revision(...args); }
  override async contentSince(...args: Parameters<FakeAdapter['contentSince']>) { this.calls++; return super.contentSince(...args); }
  override async tracks(...args: Parameters<FakeAdapter['tracks']>) { this.calls++; return super.tracks(...args); }
  override async devices(...args: Parameters<FakeAdapter['devices']>) { this.calls++; return super.devices(...args); }
  override async resolve(...args: Parameters<FakeAdapter['resolve']>) { this.calls++; return super.resolve(...args); }
  override async apply(...args: Parameters<FakeAdapter['apply']>) { this.calls++; return super.apply(...args); }
  override async read(...args: Parameters<FakeAdapter['read']>) { this.calls++; return super.read(...args); }
}

async function fixture() {
  const fake = new CountingAdapter({ tracks: ['gn-limits'], scenes: 4 });
  const [row] = await fake.tracks();
  const workspace = workspaceOf({
    ready: async () => undefined, adapter: fake, executor: new Executor(fake), stash: new Stash(),
    observationStore: new FakeObservationStore(), documents: new IdentityRegistry(),
  });
  const call = async (name: string, args: Wire): Promise<{ result: Wire; calls: number }> => {
    fake.calls = 0;
    const result = await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
    return { result, calls: fake.calls };
  };
  return { trackId: row!.channelId, call };
}

const times = <T>(count: number, make: (index: number) => T): T[] => Array.from({ length: count }, (_, index) => make(index));
const native = (name: string) => ({ source: { kind: 'native', name } });
const lfo = (index: number) => ({ location: 'container', modulator: 'lfo',
  target: { parameterId: `CONTENTS/P${index}`, parameterName: `P${index}` }, amount: 0.3 });

function assertRefused(result: Wire, calls: number, limit: WriteLimit, requested: number): void {
  assert.equal(result.failure?.code, 'outside-limit', JSON.stringify(result).slice(0, 600));
  assert.equal(result.failure?.stage, 'input');
  assert.deepEqual(result.detail, { limit, maximum: WRITE_LIMITS[limit], requested, decision: 'D44' });
  assert.equal(calls, 0, 'the refusal reads and writes nothing');
}

test('D44: each bounded write refuses one more than its limit before any read or write', async () => {
  const { trackId, call } = await fixture();
  const device = { trackId, devicePosition: 0 };
  const settings = (count: number, devicePosition = 0) => times(count, (index) => ({ kind: 'direct',
    device: { trackId, devicePosition }, parameterId: `CONTENTS/P${index}`, normalizedValue: 0.5 }));
  const slots = (count: number) => times(count, (row) => ({ trackId, row }));
  const cases: [string, Wire, WriteLimit, number][] = [
    ['set_device_controls', { settings: settings(WRITE_LIMITS.deviceControlSettings + 1) }, 'deviceControlSettings',
      WRITE_LIMITS.deviceControlSettings + 1],
    ['set_device_controls', { settings: times(WRITE_LIMITS.deviceControlCohorts + 1, (position) => settings(1, position)[0]) },
      'deviceControlCohorts', WRITE_LIMITS.deviceControlCohorts + 1],
    ['compose_devices', { trackId, containerKind: 'Instrument Layer',
      layerChains: times(5, (index) => ({ name: `L${index}`, devices: times(index === 0 ? 3 : 1, () => native('Tool')) })) },
    'stagedCompositionDevices', 7],
    ['compose_devices', { trackId, containerKind: 'FX Layer',
      layerChains: times(5, (index) => ({ name: `L${index}`, devices: [{ source: { kind: 'clap', id: 'com.u-he.Diva' } }] })) },
    'stagedCompositionDevices', 10],
    ['compose_devices', { trackId, containerKind: 'Instrument Layer',
      layerChains: [{ name: 'A', devices: [{ ...native('Polysynth'), modulators: times(WRITE_LIMITS.compositionModulators + 1, lfo) }] }] },
    'compositionModulators', WRITE_LIMITS.compositionModulators + 1],
    // E252: 3 devices with modulators in 6 devices took 45.6 s; each such device counts two more units.
    ['compose_devices', { trackId, containerKind: 'Instrument Layer', layerChains: times(3, (index) => ({ name: `L${index}`,
      devices: [{ ...native('Polysynth'), modulators: [lfo(index)] }, native('Tool')] })) },
    'stagedCompositionDevices', 12],
    ['delete_device', { devices: times(WRITE_LIMITS.deviceDeletions + 1, (devicePosition) => ({ trackId, devicePosition })) },
      'deviceDeletions', WRITE_LIMITS.deviceDeletions + 1],
    ['set_device_enabled', { settings: times(WRITE_LIMITS.deviceEnabledSettings + 1, () => ({ ...device, enabled: false })) },
      'deviceEnabledSettings', WRITE_LIMITS.deviceEnabledSettings + 1],
    ['rename_track', { tracks: times(WRITE_LIMITS.trackBatch + 1, (index) => ({ trackId, name: `t${index}` })) },
      'trackBatch', WRITE_LIMITS.trackBatch + 1],
    ['delete_track', { trackIds: times(WRITE_LIMITS.trackBatch + 1, (index) => `track-${index}`) },
      'trackBatch', WRITE_LIMITS.trackBatch + 1],
    ['set_launcher_clip_properties', { clips: slots(WRITE_LIMITS.clipCursorBatch + 1).map((item) => ({ ...item,
      properties: { name: 'x' } })) }, 'clipCursorBatch', WRITE_LIMITS.clipCursorBatch + 1],
    ['set_launcher_clip_launch_settings', { clips: slots(WRITE_LIMITS.clipCursorBatch + 1).map((item) => ({ ...item,
      quantization: '1', mode: 'default' })) }, 'clipCursorBatch', WRITE_LIMITS.clipCursorBatch + 1],
    ['copy_launcher_clips', { copies: times(WRITE_LIMITS.clipCopyBatch + 1, (k) => ({ source: { trackId, row: 2 * k },
      destination: { trackId, row: 2 * k + 1 } })) }, 'clipCopyBatch', WRITE_LIMITS.clipCopyBatch + 1],
    ['delete_launcher_clip', { clips: slots(WRITE_LIMITS.clipDeleteBatch + 1) }, 'clipDeleteBatch',
      WRITE_LIMITS.clipDeleteBatch + 1],
    ['move_launcher_clips', { trackId, firstRow: 0, lastRow: WRITE_LIMITS.clipMoveRows, destinationFirstRow: 20 },
      'clipMoveRows', WRITE_LIMITS.clipMoveRows + 1],
    ['wrap_existing_device_modulation', { trackId, devicePosition: 0, expectedDeviceOrder: [{ name: 'Polysynth', enabled: true }],
      containerKind: 'FX Layer', entryName: 'Layer 1', modulators: times(WRITE_LIMITS.wrapModulators + 1, (index) => ({
        modulator: 'lfo', target: { parameterId: `CONTENTS/P${index}`, parameterName: `P${index}` }, amount: 0.3 })) },
    'wrapModulators', WRITE_LIMITS.wrapModulators + 1],
  ];
  for (const [name, args, limit, requested] of cases) {
    const { result, calls } = await call(name, args);
    assertRefused(result, calls, limit, requested);
  }
});

test('D44: a request at the limit is not refused for its size', async () => {
  const { trackId, call } = await fixture();
  const atLimit: [string, Wire][] = [
    ['set_device_enabled', { settings: times(WRITE_LIMITS.deviceEnabledSettings, () => ({ trackId, devicePosition: 0,
      enabled: false })) }],
    ['compose_devices', { trackId, containerKind: 'FX Layer',
      layerChains: times(3, (index) => ({ name: `L${index}`, devices: [{ source: { kind: 'clap', id: 'com.u-he.Diva' } }] })) }],
    ['delete_launcher_clip', { clips: times(WRITE_LIMITS.clipDeleteBatch, (row) => ({ trackId, row })) }],
    ['delete_device', { devices: times(WRITE_LIMITS.deviceDeletions, (devicePosition) => ({ trackId, devicePosition })) }],
    ['set_device_controls', { settings: times(WRITE_LIMITS.deviceControlCohorts, (devicePosition) => ({ kind: 'direct',
      device: { trackId, devicePosition }, parameterId: 'CONTENTS/P0', normalizedValue: 0.5 })) }],
    ['compose_devices', { trackId, containerKind: 'Instrument Layer', layerChains: [
      { name: 'A', devices: [{ ...native('Polysynth'), modulators: [lfo(0), lfo(1)] }, native('Tool')] },
      { name: 'B', devices: [native('Polysynth'), native('Tool')] }] }],
  ];
  for (const [name, args] of atLimit) {
    const { result } = await call(name, args);
    assert.notEqual(result.failure?.code, 'outside-limit', `${name}: ${JSON.stringify(result).slice(0, 400)}`);
  }
});

test('D44: each bounded input states its limit in its JSON schema text, with no maxItems', () => {
  const bounded: [string, string, WriteLimit][] = [
    ['set_device_controls', 'settings', 'deviceControlSettings'],
    ['compose_devices', 'layerChains', 'stagedCompositionDevices'],
    ['delete_device', 'devices', 'deviceDeletions'],
    ['set_device_enabled', 'settings', 'deviceEnabledSettings'],
    ['rename_track', 'tracks', 'trackBatch'],
    ['delete_track', 'trackIds', 'trackBatch'],
    ['set_launcher_clip_properties', 'clips', 'clipCursorBatch'],
    ['set_launcher_clip_launch_settings', 'clips', 'clipCursorBatch'],
    ['copy_launcher_clips', 'copies', 'clipCopyBatch'],
    ['delete_launcher_clip', 'clips', 'clipDeleteBatch'],
    ['move_launcher_clips', 'lastRow', 'clipMoveRows'],
    ['wrap_existing_device_modulation', 'modulators', 'wrapModulators'],
  ];
  const json = (name: string, field: string): Wire => {
    const spec = AGENT_NATIVE_TOOLS.find((item) => item.name === name)!;
    return z.toJSONSchema((spec.inputSchema as Record<string, z.ZodType>)[field]!) as Wire;
  };
  for (const [name, field, limit] of bounded) {
    const schema = json(name, field);
    assert.match(schema.description ?? '', new RegExp(`At most ${WRITE_LIMITS[limit]} `), `${name}.${field}`);
    const spec = AGENT_NATIVE_TOOLS.find((item) => item.name === name)!;
    assert.match(spec.description, new RegExp(`(at most|1 through) ${WRITE_LIMITS[limit]} `), `${name} description`);
    // compose_devices keeps its five-chain shape maximum; wrap keeps the shared 16 (the limit is 15).
    if (name !== 'compose_devices' && name !== 'wrap_existing_device_modulation') {
      assert.equal(schema.maxItems, undefined, `${name}.${field} has maxItems`);
    }
  }
  assert.match(json('set_device_controls', 'settings').description,
    new RegExp(`At most ${WRITE_LIMITS.deviceControlCohorts} device routes`));
  assert.match(AGENT_NATIVE_TOOLS.find((item) => item.name === 'set_device_controls')!.description,
    new RegExp(`at most ${WRITE_LIMITS.deviceControlCohorts} device routes`));
});
