/**
 * 8i8 (E250): the readback of every write tool when its verification read fails, and when it completes with other
 * values.
 *
 * `throw`: every host read after the last write of the call throws. The write applied, so the result is a write
 * result with readback status `unavailable`, the warning `readback-unavailable`, and the change ID in `effects`.
 * `stale`: the last write is acknowledged, but the project keeps its earlier state. Each read completes and finds
 * other values, so the status is `differs`.
 *
 * compose_devices and the three preset-modulation tools need a simulated host preset load, as in
 * `call-budget.test.ts`. The shared rules that they use are tested below (`readbackStatusOf`, the measured-body
 * code, and `requireProved` through the layer-chain tools).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import type { FakeDevice } from '../adapters/fake/model.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { scene, slot, track, type NoteRecord } from '../contract/index.js';
import { parse, type StateDocument } from '../document/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { combinedReadbackStatus, readbackStatusOf } from './agent-native-result.js';
import { measuredBody } from './agent-native-retained.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool, toolsForProfile, type ToolSpec } from './tools.js';
import { workspaceOf, type Workspace } from './workspace.js';

type Wire = Record<string, any>;
type Mode = 'throw' | 'stale';

/** A fake whose host reads fail, or whose writes do not land, from the `armAt`-th apply of one call. */
class FaultyAdapter extends FakeAdapter {
  mode: Mode | undefined;
  armAt = 1;
  /** In `stale` mode: change the project after the last apply instead of keeping its earlier state. */
  tamper: (() => void) | undefined;
  private applies = 0;
  private armed = false;

  arm(mode: Mode, armAt: number): void { this.mode = mode; this.armAt = armAt; this.applies = 0; this.armed = false; }
  disarm(): void { this.mode = undefined; this.armed = false; this.tamper = undefined; }

  private check(): void { if (this.armed && this.mode === 'throw') throw new Error('the bridge timed out'); }

  override async apply(...args: Parameters<FakeAdapter['apply']>) {
    this.applies += 1;
    const last = this.mode !== undefined && this.applies === this.armAt;
    const before = last && this.mode === 'stale' && this.tamper === undefined
      ? { tracks: structuredClone(this.model.tracks), scenes: this.model.sceneCount } : undefined;
    const receipt = await super.apply(...args);
    if (last && this.mode === 'stale') this.tamper?.();
    if (before !== undefined) {
      this.model.tracks.splice(0, this.model.tracks.length, ...before.tracks);
      this.model.sceneCount = before.scenes;
    }
    if (last) this.armed = true;
    return receipt;
  }
  override async read(...args: Parameters<FakeAdapter['read']>) { this.check(); return super.read(...args); }
  override async tracks(...args: Parameters<FakeAdapter['tracks']>) { this.check(); return super.tracks(...args); }
  override async devices(...args: Parameters<FakeAdapter['devices']>) { this.check(); return super.devices(...args); }
  override async revision(...args: Parameters<FakeAdapter['revision']>) { this.check(); return super.revision(...args); }
}

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, releaseVelocity: 100 / 127,
  isChanceEnabled: true, isOccurrenceEnabled: true, isRecurrenceEnabled: true, isRepeatEnabled: true, ...over,
});
const device = (name: string, over: Partial<FakeDevice> = {}): FakeDevice => ({
  name, enabled: true, paramsLive: true, params: [{ id: `P-${name}`, name, value: 0.5 }], ...over,
});

async function fixture() {
  const fake = new FaultyAdapter({ tracks: ['gn-a', 'gn-b'], scenes: 6 });
  const [a, b] = fake.model.visibleTracks();
  let id = 0;
  const workspace = workspaceOf({
    ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `ru-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore: new FakeObservationStore(), documents: new IdentityRegistry(),
  });
  for (const row of [0, 1, 3]) {
    await workspace.apply([{ op: 'clip.create', slot: slot(track(a!.channelId), scene(row, (await fake.revision()).sceneEpoch)),
      lengthBeats: 8 }]);
    const item = note({ pitch: 60 + row });
    a!.slots[row]!.notes.set(`0:${item.pitch}:0`, item);
  }
  fake.model.revision += 1;
  a!.devices.push(device('Polysynth'), device('FX Layer', { params: [], chains: [
    { name: 'A', solo: false, id: 'ru-a', devices: [device('EQ+')] },
    { name: 'B', solo: false, id: 'ru-b', devices: [device('Delay+')] },
  ] }), device('Tool'));
  return { fake, workspace, a: a!.channelId, b: b!.channelId };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

interface Case {
  readonly tool: string;
  /** The apply of the call after which the reads fail (1-based). */
  readonly armAt?: number;
  readonly args: (fx: Fixture, ws: Workspace) => Promise<Wire> | Wire;
  /** The result has no change record (a launch) or no `differs` arm. */
  readonly noEffect?: boolean;
  readonly noDiffers?: boolean;
  /** The `stale` arm changes the project this way (the fake names a new track at creation, so a kept state agrees). */
  readonly tamper?: (fx: Fixture) => void;
  /** The result is a measured body: the shared failure code carries the status. */
  readonly measured?: boolean;
}

const DESIRED = 'DOC ghostnote-document 1.0 desired\nCLIP {"id":"c1","length":"8"}\n'
  + 'COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"c1","fields":"all","from":"0",'
  + '"status":"complete","to":"8"}\nFIELDS id clip at duration pitch velocity channel mute\nEVENT n1 c1 0 1 64 100 1 false\n';

const CASES: readonly Case[] = [
  { tool: 'add_tracks', armAt: 2, args: () => ({ tracks: [{ name: 'gn-new' }] }),
    tamper: (fx) => { fx.fake.model.tracks.find((item) => item.name === 'gn-new')!.name = 'gn-other'; } },
  { tool: 'duplicate_track', armAt: 2, args: (fx) => ({ trackId: fx.b, name: 'gn-b copy' }) },
  { tool: 'rename_track', args: (fx) => ({ tracks: [{ trackId: fx.b, name: 'gn-renamed' }] }) },
  { tool: 'delete_track', args: (fx) => ({ trackIds: [fx.b] }) },
  { tool: 'add_scenes', args: () => ({ count: 1 }) },
  { tool: 'delete_scene', args: () => ({ rows: [5] }) },
  { tool: 'launch_clip', noEffect: true, noDiffers: true,
    args: (fx) => ({ trackId: fx.a, row: 0, quantization: 'none', mode: 'default' }) },
  { tool: 'add_launcher_clip', armAt: 2, args: (fx) => ({ trackId: fx.b, row: 0, document: DESIRED }) },
  { tool: 'edit_launcher_clip', args: async (fx, ws) => {
    const read = await callTool(ws, 'read_launcher_clip', { trackId: fx.a, row: 0 }, AGENT_NATIVE_TOOL_PROFILE) as Wire;
    const clipId = (parse(read.data.document as string, 'fields') as StateDocument).clips[0]!.id;
    return { trackId: fx.a, row: 0, document: ['DOC ghostnote-document 1.0 patch',
      `BASE ${JSON.stringify(read.authority.base)}`, 'FIELDS id clip at duration pitch velocity channel mute',
      `ADD n9 ${clipId} 3 1/2 67 90 2 false`].join('\n') + '\n' };
  } },
  { tool: 'copy_launcher_clips', args: (fx) => ({ copies: [{ source: { trackId: fx.a, row: 1 }, destination: { trackId: fx.a, row: 2 } }] }) },
  { tool: 'move_launcher_clips', args: (fx) => ({ trackId: fx.a, firstRow: 3, lastRow: 3, destinationFirstRow: 4 }) },
  { tool: 'set_launcher_clip_launch_settings', args: (fx) => ({ clips: [{ trackId: fx.a, row: 0, quantization: '1', mode: 'default' }] }) },
  { tool: 'set_launcher_clip_properties', args: (fx) => ({ clips: [{ trackId: fx.a, row: 0, properties: { name: 'gn-named' } }] }) },
  { tool: 'delete_launcher_clip', args: (fx) => ({ clips: [{ trackId: fx.a, row: 1 }] }) },
  { tool: 'set_device_enabled', args: (fx) => ({ settings: [{ trackId: fx.a, devicePosition: 0, enabled: false }] }) },
  { tool: 'set_layer_chain_solo', args: (fx) => ({ trackId: fx.a, containerPosition: 1, layerChain: 'B', mode: 'exclusive' }) },
  { tool: 'rename_layer_chain', args: (fx) => ({ trackId: fx.a, containerPosition: 1, layerChain: 'A', name: 'Bright' }) },
  { tool: 'duplicate_layer_chain', args: (fx) => ({ trackId: fx.a, containerPosition: 1, layerChain: 'A', name: 'C' }) },
  { tool: 'move_devices', args: (fx) => ({ trackId: fx.a, devices: [{ from: 'top-level', devicePosition: 2 }],
    destination: { to: 'top-level-position', devicePosition: 0 } }) },
  { tool: 'copy_devices', args: (fx) => ({ trackId: fx.a, devices: [{ from: 'layer-chain', containerPosition: 1,
    layerChain: 'A', devicePosition: 0 }], destination: { to: 'layer-chain', containerPosition: 1, layerChain: 'B' } }) },
  { tool: 'add_devices', args: (fx) => ({ trackId: fx.a, devices: [{ kind: 'native', name: 'Polysynth' }] }) },
  { tool: 'set_device_controls', measured: true, args: (fx) => ({ settings: [{ kind: 'direct', device: { trackId: fx.a, devicePosition: 0 },
    parameterId: 'P-Polysynth', normalizedValue: 0.25 }] }) },
  { tool: 'delete_device', args: (fx) => ({ devices: [{ trackId: fx.a, devicePosition: 2 }] }) },
  { tool: 'set_track_mixer', args: (fx) => ({ tracks: [{ trackId: fx.b, volumeDb: -18 }] }) },
  { tool: 'revert_change', args: async (fx, ws) => {
    const renamed = await callTool(ws, 'rename_track', { tracks: [{ trackId: fx.b, name: 'gn-before-revert' }] },
      AGENT_NATIVE_TOOL_PROFILE) as Wire;
    return { changeId: renamed.effects[0].changeId };
  } },
];

const NOT_RUN = new Set(['compose_devices', 'edit_preset_modulation', 'wrap_existing_device_modulation',
  'reverse_existing_device_modulation_wrap']);

/** The status, the effects, and the warnings of a write result or of a measured body. */
function outcome(result: Wire, measured: boolean): { status: unknown; effects: Wire[]; warned: boolean } {
  if (!measured) {
    return { status: result.readback?.status ?? result.failure?.code, effects: result.effects ?? [],
      warned: (result.warnings ?? []).some((item: Wire) => item.code === 'readback-unavailable') };
  }
  // A measured body (set_device_controls): the shared failure object, with the recorded changes.
  return { status: result.readback === 'unavailable' && result.failure?.code === 'unavailable' ? 'unavailable'
    : result.failure?.code ?? (result.verified === true ? 'verified' : 'differs'),
  effects: result.failure?.effects ?? [], warned: result.failure?.code === 'unavailable' };
}

test('8i8: every write tool of agent-native-v1 has a case here or a stated reason', () => {
  const writes = toolsForProfile(AGENT_NATIVE_TOOL_PROFILE)
    .filter((spec: ToolSpec) => spec.kind === 'write' || spec.kind === 'destructive').map((spec) => spec.name);
  const covered = new Set([...CASES.map((item) => item.tool), ...NOT_RUN]);
  assert.deepEqual(writes.filter((name) => !covered.has(name)), []);
});

for (const item of CASES) {
  test(`8i8 ${item.tool}: a verification read that throws reports readback unavailable`, async () => {
    const fx = await fixture();
    const args = await item.args(fx, fx.workspace);
    fx.fake.arm('throw', item.armAt ?? 1);
    const result = await callTool(fx.workspace, item.tool, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
    fx.fake.disarm();
    const seen = outcome(result, item.measured === true);
    const text = JSON.stringify(result).slice(0, 600);
    assert.equal(seen.status, 'unavailable', text);
    assert.ok(seen.warned, `the readback-unavailable warning: ${text}`);
    if (item.noEffect !== true) {
      assert.ok(seen.effects.length > 0, `the change stays in effects: ${text}`);
      for (const effect of seen.effects) assert.ok(fx.workspace.changes.get(effect.changeId), effect.changeId);
    }
  });
  if (item.noDiffers === true) continue;
  test(`8i8 ${item.tool}: a completed readback with other values still reports differs`, async () => {
    const fx = await fixture();
    const args = await item.args(fx, fx.workspace);
    fx.fake.arm('stale', item.armAt ?? 1);
    if (item.tamper !== undefined) fx.fake.tamper = () => item.tamper!(fx);
    const result = await callTool(fx.workspace, item.tool, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
    fx.fake.disarm();
    const seen = outcome(result, item.measured === true);
    const text = JSON.stringify(result).slice(0, 600);
    assert.notEqual(seen.status, 'unavailable', text);
    assert.notEqual(seen.status, 'verified', text);
    assert.ok(!seen.warned, text);
  });
}

test('8i8 readbackStatusOf: a difference wins; a failed read is unavailable; a moved row stays differs', () => {
  const where = [{ what: 'track' }];
  assert.equal(readbackStatusOf({ applied: true }), 'verified');
  assert.equal(readbackStatusOf({ applied: true, notReadBack: where, readbackUnavailable: true }), 'unavailable');
  assert.equal(readbackStatusOf({ applied: true, notReadBack: where }), 'differs');
  assert.equal(readbackStatusOf({ applied: true, mismatches: [{}], notReadBack: where, readbackUnavailable: true }), 'differs');
  assert.equal(readbackStatusOf({ applied: false, readbackUnavailable: true }), 'differs');
  assert.equal(combinedReadbackStatus(['verified', 'unavailable']), 'unavailable');
  assert.equal(combinedReadbackStatus(['unavailable', 'differs']), 'differs');
});

test('8i8 measured body: a recorded change whose verification read failed is code unavailable at readback', async () => {
  const fx = await fixture();
  const stable: ToolSpec = {
    name: 'gn-measured', kind: 'write', title: 'test', description: 'test', inputSchema: {}, emits: ['track.rename'],
    run: async (workspace) => {
      await workspace.apply([{ op: 'track.rename', track: track(fx.b), name: 'gn-measured' }]);
      return { applied: true, complete: true };
    },
  };
  fx.fake.arm('throw', 1);
  const result = await measuredBody(stable, 'ghostnote-test/1').run(fx.workspace, {} as never) as Wire;
  fx.fake.disarm();
  assert.equal(result.failure.code, 'unavailable', JSON.stringify(result));
  assert.equal(result.failure.stage, 'readback');
  assert.equal(result.failure.effects.length, 1);
});

test('8i8: every write tool of agent-native-v1 lists unavailable in its result contract', () => {
  for (const spec of toolsForProfile(AGENT_NATIVE_TOOL_PROFILE)) {
    if (spec.kind !== 'write' && spec.kind !== 'destructive') continue;
    const contract = spec.resultContract as Record<string, unknown> | undefined;
    if (contract?.['envelope'] === 'measured-body') continue;
    assert.ok((contract?.['readbackStatus'] as string[] | undefined)?.includes('unavailable'), spec.name);
  }
});

test('8i8 review: a deletion that the revision guard refuses reports no effect and refuses target-changed', async () => {
  const fx = await fixture();
  const workspace = { ...fx.workspace, apply: (ops: Parameters<Workspace['apply']>[0], run?: Parameters<Workspace['apply']>[1]) =>
    fx.workspace.apply(ops, { ...run, ifRevision: -1 }) };
  const devices = fx.fake.model.visibleTracks()[0]!.devices.map((item) => item.name);
  const result = await callTool(workspace, 'delete_device', { devices: [{ trackId: fx.a, devicePosition: 2 }] },
    AGENT_NATIVE_TOOL_PROFILE) as Wire;
  assert.equal(result.applied, undefined, JSON.stringify(result).slice(0, 400));
  assert.equal(result.failure?.code, 'target-changed', JSON.stringify(result).slice(0, 400));
  assert.deepEqual(result.failure.effects, []);
  assert.deepEqual(fx.fake.model.visibleTracks()[0]!.devices.map((item) => item.name), devices, 'nothing was removed');
});
