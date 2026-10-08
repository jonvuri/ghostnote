/**
 * Adapter call budgets of the agent-native document tools (8h4c2 follow-up).
 *
 * Each live adapter call costs control-surface turns: a mark (`revision`,
 * `contentSince`) is one turn (E246: `revision.get` and `track.list` go out
 * together), a sourced read is one `clip.read` capture plus its marks and slot
 * checks, and an apply points a writer cursor. A new mark or read in a tool or
 * the executor adds about 24 ms for each turn. These budgets make such a change
 * visible offline. When a budget changes on purpose, update the expected counts
 * here and the performance ledger (context/contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md)
 * in the same session, and state the cost in the E record.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { clip, scene, slot, track, type NoteRecord } from '../contract/index.js';
import { parse, type StateDocument } from '../document/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from './tools.js';
import { workspaceOf } from './workspace.js';

type Wire = Record<string, any>;
type Counts = Record<string, number>;

/** Counts the adapter calls that cost host turns. A sourced read is a `clip.read` capture. */
class CountingAdapter extends FakeAdapter {
  counts: Counts = {};
  private count(name: string): void { this.counts[name] = (this.counts[name] ?? 0) + 1; }
  override async revision(...args: Parameters<FakeAdapter['revision']>) { this.count('mark'); return super.revision(...args); }
  override async contentSince(...args: Parameters<FakeAdapter['contentSince']>) { this.count('delta'); return super.contentSince(...args); }
  override async tracks(...args: Parameters<FakeAdapter['tracks']>) { this.count('tracks'); return super.tracks(...args); }
  override async devices(...args: Parameters<FakeAdapter['devices']>) { this.count('devices'); return super.devices(...args); }
  override async resolve(...args: Parameters<FakeAdapter['resolve']>) { this.count('resolve'); return super.resolve(...args); }
  override async apply(...args: Parameters<FakeAdapter['apply']>) { this.count('apply'); return super.apply(...args); }
  override async read(...args: Parameters<FakeAdapter['read']>) {
    this.count(args[1]?.sources === undefined ? 'read' : 'clipRead');
    return super.read(...args);
  }
}

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, releaseVelocity: 100 / 127,
  isChanceEnabled: true, isOccurrenceEnabled: true, isRecurrenceEnabled: true, isRepeatEnabled: true, ...over,
});

async function fixture() {
  const fake = new CountingAdapter({ tracks: ['gn-budget'], scenes: 4 });
  const [trackState] = await fake.tracks();
  const trackId = trackState!.channelId;
  let id = 0;
  const workspace = workspaceOf({
    ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `budget-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore: new FakeObservationStore(),
    documents: new IdentityRegistry(),
  });
  for (const row of [0, 1]) {
    await workspace.apply([{ op: 'clip.create', slot: slot(track(trackId), scene(row, (await fake.revision()).sceneEpoch)), lengthBeats: 8 }]);
    const fakeSlot = fake.model.visibleTracks()[0]!.slots[row]!;
    for (let channel = 0; channel < 16; channel += 1) {
      for (let k = 0; k < 4; k += 1) {
        const item = note({ pitch: 60 + k, startBeats: k });
        fakeSlot.notes.set(`${channel}:${item.pitch}:${item.startBeats}`, item);
      }
    }
  }
  fake.model.revision += 1;
  const call = async (name: string, args: Wire): Promise<{ result: Wire; counts: Counts }> => {
    fake.counts = {};
    const result = await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
    return { result, counts: fake.counts };
  };
  return { trackId, call, fake, clip: (row: number) => clip(slot(track(trackId), scene(row, 1))) };
}

const patch = (base: Wire, lines: string[]) => ['DOC ghostnote-document 1.0 patch',
  `BASE ${JSON.stringify({ sha256: base.sha256, ref: base.ref })}`,
  'FIELDS id clip at duration pitch velocity channel mute', ...lines].join('\n') + '\n';
const documentOf = (result: Wire) => parse(result.data.document as string, 'fields') as StateDocument;

test('call budget: read_launcher_clip, first and repeated', async () => {
  const fx = await fixture();
  const first = await fx.call('read_launcher_clip', { trackId: fx.trackId, row: 0 });
  assert.equal(first.result.failure, undefined);
  assert.deepEqual(first.counts, { mark: 1, tracks: 1, clipRead: 1, delta: 1 });
  // A repeated read also judges the prior ref: one more delta.
  const again = await fx.call('read_launcher_clip', { trackId: fx.trackId, row: 0 });
  assert.deepEqual(again.counts, { mark: 1, tracks: 1, clipRead: 1, delta: 2 });
});

test('call budget: check_launcher_clips reads all refs in one adapter read', async () => {
  const fx = await fixture();
  const refs = [];
  for (const row of [0, 1]) refs.push((await fx.call('read_launcher_clip', { trackId: fx.trackId, row })).result.authority.base.ref);
  const checked = await fx.call('check_launcher_clips', { refs });
  assert.equal(checked.result.failure, undefined);
  // Refs with one mark share one delta.
  assert.deepEqual(checked.counts, { mark: 2, clipRead: 1, delta: 1 });
});

test('call budget: edit_launcher_clip on the targeted, whole-clip, and property routes', async () => {
  const fx = await fixture();
  let read = (await fx.call('read_launcher_clip', { trackId: fx.trackId, row: 0 })).result;
  const clipId = documentOf(read).clips[0]!.id;
  // Targeted: the fresh read is the stash read (D38); the verify read is the readback.
  const targeted = await fx.call('edit_launcher_clip', { trackId: fx.trackId, row: 0,
    document: patch(read.authority.base, Array.from({ length: 16 }, (_, c) => `ADD i${c} ${clipId} 9/2 1/4 96 100 ${c + 1} false`)) });
  assert.equal(targeted.result.readback?.status, 'verified', JSON.stringify(targeted.result).slice(0, 300));
  assert.deepEqual(targeted.counts, { mark: 1, tracks: 1, clipRead: 2, delta: 3, apply: 1 });

  // Whole-clip: the executor reads the clip again before the write (D38).
  read = (await fx.call('read_launcher_clip', { trackId: fx.trackId, row: 0 })).result;
  const id = documentOf(read).events.find((event) => event.pitch === 60 && event.at === '0' && event.channel === undefined)!.id;
  const whole = await fx.call('edit_launcher_clip', { trackId: fx.trackId, row: 0,
    document: patch(read.authority.base, [`UPDATE ${id} {"velocity":70}`]) });
  assert.equal(whole.result.plan.route, 'whole-clip');
  assert.equal(whole.result.readback?.status, 'verified');
  assert.deepEqual(whole.counts, { mark: 2, tracks: 1, clipRead: 3, delta: 3, resolve: 1, apply: 1 });

  // A clip property change: also the executor stash read.
  read = (await fx.call('read_launcher_clip', { trackId: fx.trackId, row: 0 })).result;
  const named = await fx.call('edit_launcher_clip', { trackId: fx.trackId, row: 0,
    document: patch(read.authority.base, [`CLIP_UPDATE ${clipId} {"name":"budget"}`]) });
  assert.equal(named.result.readback?.status, 'verified');
  assert.deepEqual(named.counts, { mark: 2, tracks: 1, clipRead: 3, delta: 3, resolve: 1, apply: 1 });
});

test('call budget: the 8h4d Launcher clip tools', async () => {
  const fx = await fixture();
  const desired = ['DOC ghostnote-document 1.0 desired', 'CLIP {"id":"c1","length":"8"}',
    'COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"c1","fields":"all","from":"0","status":"complete","to":"8"}',
    'FIELDS id clip at duration pitch velocity channel',
    ...Array.from({ length: 16 }, (_, c) => `EVENT n${c} c1 ${c}/4 1/4 60 100 ${c + 1}`)].join('\n') + '\n';
  // Creation: resolve, one occupancy read, one apply. Content: the edit replace path on the new clip; the
  // fake's new clip loops, so the loop change adds a clip property stage (the executor reads the clip again).
  const added = await fx.call('add_launcher_clip', { trackId: fx.trackId, row: 2, document: desired });
  assert.equal(added.result.readback?.status, 'verified', JSON.stringify(added.result).slice(0, 300));
  assert.deepEqual(added.counts, { mark: 3, tracks: 2, read: 3, resolve: 2, apply: 2, delta: 4, clipRead: 3 });
  // Copy, properties: one occupancy read; the executor verify read is the readback.
  const copied = await fx.call('copy_launcher_clips', { copies: [{ source: { trackId: fx.trackId, row: 2 },
    destination: { trackId: fx.trackId, row: 3 } }] });
  assert.equal(copied.result.readback?.status, 'verified');
  assert.deepEqual(copied.counts, { mark: 1, tracks: 1, read: 3, resolve: 1, apply: 1, delta: 1 });
  const props = await fx.call('set_launcher_clip_properties', { clips: [{ trackId: fx.trackId, row: 0,
    properties: { name: 'budget' } }] });
  assert.equal(props.result.readback?.status, 'verified');
  assert.deepEqual(props.counts, { mark: 1, tracks: 1, read: 3, resolve: 1, apply: 1, delta: 1 });
  // A launch: no change record; one playback read after the executor.
  const launched = await fx.call('launch_clip', { trackId: fx.trackId, row: 0, quantization: 'none', mode: 'from_start' });
  assert.equal(launched.result.applied, true);
  assert.deepEqual(launched.counts, { mark: 1, tracks: 1, read: 4, apply: 1, delta: 1 });
  // Show: the second mark is the mark that the adapter and the extension validate.
  const shown = await fx.call('show_launcher_clip_in_detail_editor', { trackId: fx.trackId, row: 0 });
  assert.equal(shown.result.failure, undefined);
  assert.deepEqual(shown.counts, { mark: 2, tracks: 1, read: 1, resolve: 1 });
});

test('call budget: the 8h4e device and layer-chain tools', async () => {
  const fx = await fixture();
  const dev = (name: string) => ({ name, enabled: true, paramsLive: true, params: [{ id: `P-${name}`, name, value: 0.5 }] });
  fx.fake.model.visibleTracks()[0]!.devices.push(dev('Polysynth'), { ...dev('FX Layer'), params: [], chains: [
    { name: 'A', solo: false, id: 'budget-a', devices: [dev('EQ+')] },
    { name: 'B', solo: false, id: 'budget-b', devices: [dev('Delay+')] },
  ] });
  const counts: Record<string, Counts> = {};
  const run = async (label: string, name: string, args: Wire) => {
    const { result, counts: used } = await fx.call(name, args);
    assert.equal(result.failure, undefined, `${label}: ${JSON.stringify(result).slice(0, 300)}`);
    counts[label] = used;
  };
  // A structure read: one bank read and one read for the containers in positions 0 through 2.
  await run('read', 'read_devices', { trackId: fx.trackId });
  await run('solo', 'set_layer_chain_solo', { trackId: fx.trackId, containerPosition: 1, layerChain: 'A', mode: 'exclusive' });
  await run('solo-noop', 'set_layer_chain_solo', { trackId: fx.trackId, containerPosition: 1, layerChain: 'A', mode: 'exclusive' });
  await run('rename', 'rename_layer_chain', { trackId: fx.trackId, containerPosition: 1, layerChain: 'B', name: 'C' });
  await run('move', 'move_devices', { trackId: fx.trackId,
    devices: [{ from: 'layer-chain', containerPosition: 1, layerChain: 'C', devicePosition: 0 }], destination: { to: 'track-end' } });
  await run('controls', 'read_device_controls', { device: { trackId: fx.trackId, devicePosition: 0 } });
  assert.deepEqual(counts, EXPECTED_DEVICE_BUDGETS);
});

// Each limb reads the container before the write and once after it; the executor adds its own preflight and
// readback reads and one delta. A no-op solo is one read.
const EXPECTED_DEVICE_BUDGETS: Record<string, Counts> = {
  read: { devices: 1, read: 1 },
  solo: { read: 4, apply: 1, delta: 1 },
  'solo-noop': { read: 1 },
  rename: { read: 4, apply: 1, delta: 1 },
  move: { devices: 2, read: 4, apply: 1, delta: 1 },
  controls: { read: 1 },
};

test('call budget: the 8h4f retained and track tools', async () => {
  const fx = await fixture();
  const dev = (name: string) => ({ name, enabled: true, paramsLive: true, params: [{ id: `P-${name}`, name, value: 0.5 }] });
  fx.fake.model.visibleTracks()[0]!.devices.push(dev('Polysynth'));
  const counts: Record<string, Counts> = {};
  const run = async (label: string, name: string, args: Wire): Promise<Wire> => {
    const { result, counts: used } = await fx.call(name, args);
    assert.equal(result.failure, undefined, `${label}: ${JSON.stringify(result).slice(0, 300)}`);
    counts[label] = used;
    return result;
  };
  await run('connection', 'check_bitwig_connection', {});
  await run('tracks', 'list_tracks', {});
  const added = await run('add', 'add_tracks', { tracks: [{ name: 'gn-audio', kind: 'audio' }] });
  const audio = added.readback.tracks[0].trackId as string;
  const copied = await run('duplicate', 'duplicate_track', { trackId: audio, name: 'gn-audio copy' });
  const renamed = await run('rename', 'rename_track', { tracks: [{ trackId: audio, name: 'gn-audio 2' }] });
  await run('changes', 'list_changes', {});
  await run('check', 'check_revert', { changeId: renamed.effects[0].changeId });
  await run('revert', 'revert_change', { changeId: renamed.effects[0].changeId });
  await run('enabled', 'set_device_enabled', { settings: [{ trackId: fx.trackId, devicePosition: 0, enabled: false }] });
  await run('delete', 'delete_track', { trackIds: [copied.readback.copy.trackId, audio] });
  assert.deepEqual(counts, EXPECTED_RETAINED_BUDGETS);
});

// Against stable-v1 (the same fixture): the same counts, except three. add_tracks reads the bank once for the kind
// readback where add_track read the minted addresses (read 5); duplicate_track reads the bank where copy_track
// took a mark (mark 1, tracks 1, read 5); rename_track reads the bank once more, because the executor records a
// rename of a missing track as a failed op, not a refusal. Net: one more call, on rename_track only.
const EXPECTED_RETAINED_BUDGETS: Record<string, Counts> = {
  connection: { mark: 1 },
  tracks: { mark: 1, tracks: 1 },
  add: { read: 4, apply: 2, delta: 2, resolve: 1, tracks: 1 },
  duplicate: { tracks: 2, read: 4, apply: 2, delta: 2, resolve: 1 },
  rename: { tracks: 1, resolve: 1, read: 2, apply: 1, delta: 1 },
  changes: {},
  check: { read: 1, delta: 1 },
  revert: { read: 3, delta: 2, resolve: 1, apply: 1 },
  enabled: { devices: 1, resolve: 1, read: 2, apply: 1, delta: 1 },
  delete: { tracks: 1, resolve: 1, read: 2, apply: 1, delta: 1 },
};

test('call budget: the 8h4g rows for the remaining tools', async () => {
  const fx = await fixture();
  const dev = (name: string) => ({ name, enabled: true, paramsLive: true, params: [{ id: `P-${name}`, name, value: 0.5 }] });
  const counts: Record<string, Counts> = {};
  const run = async (label: string, name: string, args: Wire): Promise<void> => {
    const { result, counts: used } = await fx.call(name, args);
    assert.equal(result.failure, undefined, `${label}: ${JSON.stringify(result).slice(0, 300)}`);
    counts[label] = used;
  };
  fx.fake.model.visibleTracks()[0]!.devices.push(dev('Polysynth'), { ...dev('FX Layer'), params: [], chains: [
    { name: 'A', solo: false, id: 'budget-a', devices: [dev('EQ+')] },
    { name: 'B', solo: false, id: 'budget-b', devices: [dev('Delay+')] },
  ] });
  await run('launch-settings', 'set_launcher_clip_launch_settings', { clips: [{ trackId: fx.trackId, row: 0,
    quantization: '1', mode: 'default' }] });
  await run('move', 'move_launcher_clips', { trackId: fx.trackId, firstRow: 1, lastRow: 1, destinationFirstRow: 2 });
  await run('delete-clip', 'delete_launcher_clip', { clips: [{ trackId: fx.trackId, row: 2 }] });
  await run('add-scenes', 'add_scenes', { count: 1 });
  await run('delete-scene', 'delete_scene', { rows: [4] });
  await run('modulator-types', 'list_modulator_types', {});
  await run('add-devices', 'add_devices', { trackId: fx.trackId, devices: [{ kind: 'native', name: 'Polysynth' }] });
  await run('duplicate-chain', 'duplicate_layer_chain', { trackId: fx.trackId, containerPosition: 1, layerChain: 'A', name: 'C' });
  await run('copy-devices', 'copy_devices', { trackId: fx.trackId, devices: [{ from: 'layer-chain', containerPosition: 1,
    layerChain: 'A', devicePosition: 0 }], destination: { to: 'layer-chain', containerPosition: 1, layerChain: 'B' } });
  await run('set-controls', 'set_device_controls', { settings: [{ kind: 'direct', device: { trackId: fx.trackId,
    devicePosition: 0 }, parameterId: 'P-Polysynth', normalizedValue: 0.25 }] });
  await run('delete-device', 'delete_device', { devices: [{ trackId: fx.trackId, devicePosition: 1 }] });
  assert.deepEqual(counts, EXPECTED_8H4G_BUDGETS);
});

// 8h4g: the rows that the call-budget test did not have. compose_devices, wrap_existing_device_modulation, its
// reversal, and edit_preset_modulation need a simulated host preset load; their budget is the live wire count in
// the performance ledger (E247 inventory). read_preset_modulation and list_modulator_types make no adapter call.
const EXPECTED_8H4G_BUDGETS: Record<string, Counts> = {
  'launch-settings': { mark: 1, tracks: 1, read: 3, resolve: 1, apply: 1, delta: 1 },
  move: { mark: 1, tracks: 1, read: 3, resolve: 1, apply: 1, delta: 1 },
  'delete-clip': { mark: 1, tracks: 1, read: 3, resolve: 1, apply: 1, delta: 1 },
  'add-scenes': { mark: 2, read: 2, apply: 1, delta: 1 },
  'delete-scene': { mark: 2, resolve: 1, read: 2, apply: 1, delta: 1 },
  'modulator-types': {},
  'add-devices': { devices: 2, read: 2, apply: 1, delta: 1 },
  'duplicate-chain': { read: 4, apply: 1, delta: 1 },
  'copy-devices': { devices: 2, read: 5, apply: 1, delta: 1 },
  'set-controls': { devices: 1, read: 2, apply: 1, delta: 1 },
  'delete-device': { read: 3, devices: 3, resolve: 1, apply: 1, delta: 1 },
};
