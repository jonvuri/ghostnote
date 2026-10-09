/**
 * 8i3 long device write profile (E252). Live driver, normal profile, owned unsaved project (refuses the saved
 * anchor, D29). Each case calls one agent-native-v1 tool through the MCP dispatch path at its largest admitted
 * input, and records the wall time, every wire call with its time, the host turns, the wire time for each method,
 * the gaps between turns (settles and poll waits), and the brain CPU time.
 *
 *   controls <dir> [device]  set_device_controls: 1, 27, and every continuous control of one native device
 *                            (default Polysynth) in one call, then up to 64 remote controls
 *   compose <dir> [shapes]   staged compose_devices and its revert_change: shapes as chains x devices, default
 *                            5x1,3x2,2x3 (the D44 limit is 6 device units; the 8i3 baseline ran 5x1,5x2,5x4)
 *   drum <dir>               compose_devices, Drum Machine with 16 pads, and its revert_change
 *   add <dir>                add_devices of 16 native devices, then delete_device of 10 in one call
 *   tracks <dir>             add_tracks 16, rename_track 16, set_device_enabled 16, delete_track 16; add_scenes 16,
 *                            delete_scene 16
 *   tracks-max <dir>         rename_track 64, set_device_enabled 32, delete_track 64
 *   plugins <dir>            u-he Diva (CLAP): control writes 1/27/64, 64 settings on 4 Diva routes, add 6 and
 *                            delete 10, a 3-chain staged composition and its revert. The operator turns the audio engine on in the owned project first.
 *   clips <dir>              the clip batch tools at the D44 limits (typical clips), each with its revert
 *   clips-large <dir>        the clip batch limits with 16,384-note clips, each with its revert
 *   modulation <dir>         one preset edit, wrap modulators 1/8/15, a 6-device composition with 0 and 4 modulators
 *                            (8i5, D46: agent-native-v1 has no behaviorChecks input; the 8-check case left)
 *   identity <dir>           8i5: the sparse Blur remote write and its direct-ID control arm; the Sampler ADSR wrap
 *                            of Filter Frequency (the 2026-10-09 failure) and its reversal; wrap 15, one preset edit,
 *                            and a composition with 4 modulators under D46, each with its reversal
 *   poll-ab <dir>            the host primitive of the cohort integrity poll, with a settled-inventory control arm
 *   summary <dir>            print the rows of every retained file
 *
 * Each command makes its own tracks and deletes them at the end. One file for each command.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { WireTransport, type Call } from './phase8h3c-promotion.js';
import { typicalDesired, wireSummary, worstDesired } from './phase8h4g-inventory.js';
import { FIXTURE_DIR } from '../bwmod/fixtures.js';

type Wire = Record<string, any>;
const SCHEMA = 'phase8i3-long-writes-v1';
const ANCHOR = 'gn-scale-test';
const DIVA = 'com.u-he.Diva';
const POLY_BARE = join(FIXTURE_DIR, 'Polysynth', 'mp_bare.bwpreset');
/** A gap between two turns longer than this is listed: a settle or a poll wait. */
const GAP_MS = 40;

const say = (value: unknown): void => console.log(JSON.stringify(value));

export interface Profile {
  step: string; tool: string; ok: boolean; code?: string; status?: string; ms: number; bytes: number;
  calls: number; turns: number; wireMs: number; brainMs: number; idleMs: number;
  methods: Record<string, number>;
  /** Wire time for each method, ms. */
  methodMs: Record<string, number>;
  /** Gaps between turns above GAP_MS: [after method, before method, ms]. */
  gaps: [string, string, number][];
  gapMs: number;
  /** Each wire call: method, start and duration in ms from the tool call start. */
  sequence: [string, number, number][];
}

/** Wire time for each method and the gaps between turns. */
export function profileOf(calls: readonly Pick<Call, 'method' | 'sent' | 'received'>[]) {
  const sorted = [...calls].sort((a, b) => a.sent - b.sent);
  const methodMs: Record<string, number> = {};
  const gaps: [string, string, number][] = [];
  let end = -Infinity;
  let last = '';
  for (const call of sorted) {
    const received = call.received < 0 ? call.sent : call.received;
    methodMs[call.method] = Math.round((methodMs[call.method] ?? 0) + received - call.sent);
    if (end > -Infinity && call.sent - end > GAP_MS) gaps.push([last, call.method, Math.round(call.sent - end)]);
    if (received >= end) { end = received; last = call.method; }
  }
  return { methodMs, gaps, gapMs: gaps.reduce((sum, item) => sum + item[2], 0) };
}

const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const workspace = workspaceOf({
  ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
  observationStore: new FakeObservationStore(),
});
const request = async (method: string, params?: Wire): Promise<Wire> =>
  await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
const rows: Profile[] = [];

async function call(step: string, tool: string, args: Wire, required = true): Promise<Wire> {
  const from = transport.calls.length;
  const cpu = process.cpuUsage();
  const started = performance.now();
  const result = await callTool(workspace, tool, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const ms = performance.now() - started;
  const used = process.cpuUsage(cpu);
  const brainMs = (used.user + used.system) / 1000;
  const calls = transport.calls.slice(from);
  const wire = wireSummary(calls);
  const profile = profileOf(calls);
  const ok = result.failure === undefined && result.refused !== true && result.partialSuccess !== true;
  const row: Profile = { step, tool, ok, ...(result.failure?.code === undefined ? {} : { code: result.failure.code }),
    ...(typeof result.readback?.status === 'string' ? { status: result.readback.status } : {}),
    ms: Math.round(ms), bytes: Buffer.byteLength(JSON.stringify(result)), calls: calls.length,
    turns: wire.turns, wireMs: wire.wireMs, brainMs: Math.round(brainMs),
    idleMs: Math.max(0, Math.round(ms - wire.wireMs - brainMs)), methods: wire.methods, ...profile,
    sequence: calls.map((item) => [item.method, Math.round(item.sent - started),
      Math.round((item.received < 0 ? item.sent : item.received) - item.sent)]) };
  rows.push(row);
  say({ ...row, sequence: undefined, gaps: row.gaps.length > 12 ? `${row.gaps.length} gaps` : row.gaps });
  if (required) assert(ok, `${step} ${tool}: ${JSON.stringify(result).slice(0, 1200)}`);
  return result;
}

async function guard(): Promise<Wire> {
  const hello = await request('contract.hello');
  assert.equal(hello.runtimeProfile, 'normal-v1');
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project) && mark.project !== ANCHOR, `use an owned unsaved project, got ${mark.project}`);
  await adapter.hello();
  const stats = await request('rig.stats').catch(() => undefined);
  return { hello, project: mark.project, heapStart: stats?.heap ?? stats ?? null };
}

async function newTrack(name: string): Promise<string> {
  const added = await call(`add-track-${name}`, 'add_tracks', { tracks: [{ name }] });
  return added.readback.tracks[0].trackId as string;
}

async function save(dir: string, name: string, guarded: Wire, extra: Wire = {}): Promise<void> {
  const stats = await request('rig.stats').catch(() => undefined);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), JSON.stringify({ schema: SCHEMA, ...guarded, heapEnd: stats?.heap ?? stats ?? null,
    rows, ...extra }, null, 1) + '\n');
}

const nextValue = (value: number): number => (value > 0.5 ? 0.25 : 0.75);

/** Continuous controls first: a discrete control admits only its returned values. */
function writable(parameters: Wire[]): Wire[] {
  return parameters.filter((item) => typeof item.normalizedValue === 'number' && item.discreteValueCount === undefined);
}

async function controls(dir: string, deviceName = 'Polysynth'): Promise<void> {
  const guarded = await guard();
  const trackId = await newTrack('gn-8i3-controls');
  const counts: number[] = [];
  try {
    await call('add-device', 'add_devices', { trackId, devices: [{ kind: 'native', name: deviceName }] });
    const device = { trackId, devicePosition: 0 };
    const read = await call('read-controls', 'read_device_controls', { device });
    const all = writable(read.parameters as Wire[]);
    for (const count of [1, 27, all.length]) {
      if (count > all.length || counts.includes(count)) continue;
      counts.push(count);
      const before = await call(`read-before-${count}`, 'read_device_controls', { device });
      const byId = new Map((before.parameters as Wire[]).map((item) => [item.id, item]));
      const set = await call(`set-${count}`, 'set_device_controls', { settings: all.slice(0, count).map((item) => ({
        kind: 'direct', device, parameterId: item.id, normalizedValue: nextValue(byId.get(item.id)!.normalizedValue) })) });
      assert.equal(set.verified, true, `set-${count} is not verified`);
    }
    // The remote-control route: every visible remote control without a discrete domain, up to 64, in one call.
    const pages = (await call('read-remotes', 'read_device_controls', { device, view: 'remote-controls' })).remotePages as Wire[];
    const remotes = pages.flatMap((page) => (page.controls as Wire[])
      .filter((control) => control.discreteValueCount === undefined && typeof control.normalizedValue === 'number')
      .map((control) => ({ kind: 'remote', device, pagePosition: page.position, pageName: page.name,
        controlPosition: control.position, controlName: control.name, normalizedValue: nextValue(control.normalizedValue) })))
      .slice(0, 64);
    counts.push(-remotes.length);
    const remoteSet = await call(`set-remote-${remotes.length}`, 'set_device_controls', { settings: remotes });
    assert.equal(remoteSet.verified, true, 'the remote-control write is not verified');
  } finally {
    await call('cleanup', 'delete_track', { trackIds: [trackId] });
  }
  await save(dir, `controls-${deviceName}.json`, guarded, { deviceName, counts });
}

const INSTRUMENTS = ['Polysynth', 'Phase-4', 'FM-4', 'Organ', 'Polymer'];
const EFFECTS = ['EQ+', 'Delay+', 'Tool'];

/** One staged request: chains x devices; each chain is one instrument and up to three effects. */
function stagedRequest(trackId: string, chains: number, devices: number): Wire {
  return { trackId, containerKind: 'Instrument Layer', layerChains: INSTRUMENTS.slice(0, chains).map((name, index) => ({
    name: `L${index + 1}`,
    devices: [name, ...EFFECTS].slice(0, devices).map((device) => ({ source: { kind: 'native', name: device } })),
  })) };
}

async function compose(dir: string, shapes = '5x1,3x2,2x3'): Promise<void> {
  const guarded = await guard();
  const trackId = await newTrack('gn-8i3-compose');
  try {
    for (const shape of shapes.split(',')) {
      const [chains, devices] = shape.split('x').map(Number) as [number, number];
      const composed = await call(`compose-${shape}`, 'compose_devices', stagedRequest(trackId, chains, devices));
      assert.equal(composed.readback.status, 'verified');
      assert.equal(composed.readback.backend, 'staged');
      await call(`revert-${shape}`, 'revert_change', { changeId: composed.next.revert.changeId });
      const after = await call(`after-${shape}`, 'read_devices', { trackId });
      assert.deepEqual(after.data.devices, [], `${shape}: the revert left ${JSON.stringify(after.data.devices)}`);
    }
  } finally {
    await call('cleanup', 'delete_track', { trackIds: [trackId] });
  }
  await save(dir, 'compose.json', guarded, { shapes });
}

const DRUMS = ['v1 Kick', 'v1 Snare', 'v1 Hat', 'v1 Clap', 'v1 Tom', 'v1 Cowbell', 'v0 Kick', 'v0 Snare', 'v0 Hat',
  'v0 Tom', 'v0 Cymbal', 'v8 Kick', 'v8 Snare', 'v8 Hat', 'v8 Clap', 'v8 Rimshot'];

async function drum(dir: string): Promise<void> {
  const guarded = await guard();
  const trackId = await newTrack('gn-8i3-drum');
  try {
    const composed = await call('drum-16', 'compose_devices', { trackId, containerKind: 'Drum Machine',
      pads: DRUMS.map((deviceName, index) => ({ midiNote: 36 + index, deviceName })) });
    assert.equal(composed.readback.status, 'verified');
    await call('revert-drum-16', 'revert_change', { changeId: composed.next.revert.changeId });
    const after = await call('after-drum-16', 'read_devices', { trackId });
    assert.deepEqual(after.data.devices, []);
  } finally {
    await call('cleanup', 'delete_track', { trackIds: [trackId] });
  }
  await save(dir, 'drum.json', guarded);
}

const SIXTEEN = ['EQ+', 'Delay+', 'Tool', 'Filter', 'Chorus', 'Compressor', 'Reverb', 'Bit-8', 'Distortion', 'Phaser',
  'Flanger', 'Tremolo', 'Gate', 'Saturator', 'Ladder', 'Comb'];

async function add(dir: string): Promise<void> {
  const guarded = await guard();
  const trackId = await newTrack('gn-8i3-add');
  try {
    await call('add-16', 'add_devices', { trackId, devices: SIXTEEN.map((name) => ({ kind: 'native', name })) });
    // The D44 limit is 10 removals in one call (the 8i3 baseline removed 16).
    await call('delete-10', 'delete_device', { devices: Array.from({ length: 10 }, (_, devicePosition) => ({ trackId,
      devicePosition })) });
    const after = await call('after-delete-10', 'read_devices', { trackId });
    assert.equal(after.data.devices.length, 6);
  } finally {
    await call('cleanup', 'delete_track', { trackIds: [trackId] });
  }
  await save(dir, 'add.json', guarded);
}

async function tracks(dir: string): Promise<void> {
  const guarded = await guard();
  const names = Array.from({ length: 16 }, (_, index) => `gn-8i3-t${index + 1}`);
  let ids: string[] = [];
  try {
    const added = await call('add-tracks-16', 'add_tracks', { tracks: names.map((name) => ({ name })) });
    ids = (added.readback.tracks as Wire[]).map((item) => item.trackId as string);
    await call('rename-16', 'rename_track', { tracks: ids.map((trackId, index) => ({ trackId, name: `${names[index]}-r` })) });
    // One device on each of 16 tracks, then one enabled-state call for all of them.
    for (const [index, trackId] of ids.entries()) {
      await call(`add-tool-${index}`, 'add_devices', { trackId, devices: [{ kind: 'native', name: 'Tool' }] });
    }
    await call('enabled-16', 'set_device_enabled', { settings: ids.map((trackId) => ({ trackId, devicePosition: 0,
      enabled: false })) });
    await call('add-scenes-16', 'add_scenes', { count: 16 });
    const scenes = (await adapter.revision()).window.scenes.count;
    await call('delete-scenes-16', 'delete_scene', { rows: Array.from({ length: 16 }, (_, index) => scenes - 1 - index) });
  } finally {
    if (ids.length > 0) await call('delete-tracks-16', 'delete_track', { trackIds: ids });
  }
  await save(dir, 'tracks.json', guarded);
}

/**
 * The track limits: 64 tracks (four add_tracks calls), rename_track of 64, one device on each of 32 tracks and
 * set_device_enabled of 32, then delete_track of 64.
 */
async function tracksMax(dir: string): Promise<void> {
  const guarded = await guard();
  let ids: string[] = [];
  try {
    for (let batch = 0; batch < 4; batch += 1) {
      const added = await call(`add-tracks-${batch}`, 'add_tracks', { tracks: Array.from({ length: 16 }, (_, index) => ({
        name: `gn-8i3-m${batch * 16 + index + 1}` })) });
      ids = [...ids, ...(added.readback.tracks as Wire[]).map((item) => item.trackId as string)];
    }
    await call('rename-64', 'rename_track', { tracks: ids.map((trackId, index) => ({ trackId, name: `gn-8i3-r${index + 1}` })) });
    for (const [index, trackId] of ids.slice(0, 32).entries()) {
      await call(`add-tool-${index}`, 'add_devices', { trackId, devices: [{ kind: 'native', name: 'Tool' }] });
    }
    await call('enabled-32', 'set_device_enabled', { settings: ids.slice(0, 32).map((trackId) => ({ trackId,
      devicePosition: 0, enabled: false })) });
  } finally {
    if (ids.length > 0) await call('delete-tracks-64', 'delete_track', { trackIds: ids });
  }
  await save(dir, 'tracks-max.json', guarded);
}

/**
 * The plug-in arms with u-he Diva (CLAP, 281 IDs): control writes of 1, 27, and 64 settings, then 16 settings on each
 * of 4 Divas in one call (the 4-route limit), one delete_device call for 10 Divas (the limit), and a staged
 * composition of three layer chains with one Diva each (the 6-unit limit) and its revert. The operator turns the audio engine on in the owned project first (E244).
 */
async function plugins(dir: string): Promise<void> {
  const guarded = await guard();
  const trackId = await newTrack('gn-8i3-plugins');
  try {
    await call('add-diva-1', 'add_devices', { trackId, devices: [{ kind: 'clap', id: DIVA }] });
    const device = { trackId, devicePosition: 0 };
    const read = await call('diva-controls', 'read_device_controls', { device });
    assert.equal(read.standing, 'stable', 'turn the audio engine on in the owned project');
    const all = writable(read.parameters as Wire[]);
    for (const count of [1, 27, 64]) {
      if (count > all.length) break;
      const before = await call(`diva-before-${count}`, 'read_device_controls', { device });
      const byId = new Map((before.parameters as Wire[]).map((item) => [item.id, item]));
      // Endpoints: some Diva controls are switches with no discrete domain, so 0.25 or 0.75 reads back as 0 or 1.
      const set = await call(`diva-set-${count}`, 'set_device_controls', { settings: all.slice(0, count).map((item) => ({
        kind: 'direct', device, parameterId: item.id,
        normalizedValue: byId.get(item.id)!.normalizedValue > 0.5 ? 0 : 1 })) });
      assert.equal(set.verified, true, `diva-set-${count} is not verified`);
    }
    // Four Diva routes, 16 settings each: 64 settings in one call.
    await call('add-diva-3', 'add_devices', { trackId, devices: [1, 2, 3].map(() => ({ kind: 'clap', id: DIVA })) });
    const routes: Wire[] = [];
    for (const devicePosition of [0, 1, 2, 3]) {
      const route = { trackId, devicePosition };
      const before = await call(`diva-route-before-${devicePosition}`, 'read_device_controls', { device: route });
      assert.equal(before.standing, 'stable', `Diva ${devicePosition} has no stable inventory`);
      routes.push(...writable(before.parameters as Wire[]).slice(0, 16).map((item) => ({ kind: 'direct', device: route,
        parameterId: item.id, normalizedValue: item.normalizedValue > 0.5 ? 0 : 1 })));
    }
    const fourRoutes = await call('diva-set-4x16', 'set_device_controls', { settings: routes });
    assert.equal(fourRoutes.verified, true, 'diva-set-4x16 is not verified');
    await call('add-diva-6', 'add_devices', { trackId, devices: [1, 2, 3, 4, 5, 6].map(() => ({ kind: 'clap', id: DIVA })) });
    await call('delete-diva-10', 'delete_device', { devices: Array.from({ length: 10 }, (_, devicePosition) => ({ trackId,
      devicePosition })) });
    const empty = await call('after-delete-diva-10', 'read_devices', { trackId });
    assert.deepEqual(empty.data.devices, []);
    // Three plug-in layer chains are the 6-unit staged limit (a plug-in counts as two).
    const composed = await call('compose-diva-3', 'compose_devices', { trackId, containerKind: 'Instrument Layer',
      layerChains: [1, 2, 3].map((n) => ({ name: `D${n}`, devices: [{ source: { kind: 'clap', id: DIVA } }] })) });
    assert.equal(composed.readback.backend, 'staged');
    await call('revert-compose-diva-3', 'revert_change', { changeId: composed.next.revert.changeId });
  } finally {
    await call('cleanup', 'delete_track', { trackIds: [trackId] });
  }
  await save(dir, 'plugins.json', guarded);
}

/**
 * The clip batch tools with the typical clip (256 notes, E231). One track; the even rows 0 through 30 hold 16 source
 * clips, and the odd rows take the copies. The D44 limits: copy 8, properties and launch settings 8 (one write
 * stage confirms 8 clips), delete 4 (its revert writes each clip again), and an 8-row move; each with its revert.
 */
async function clips(dir: string): Promise<void> {
  const guarded = await guard();
  const document = typicalDesired();
  let trackId: string | undefined;
  const scenesBefore = (await adapter.revision()).window.scenes.count;
  const outcomes: Record<string, unknown> = {};
  const keep = async (step: string, result: Wire): Promise<Wire> => {
    outcomes[step] = { status: result.readback?.status ?? null, failure: result.failure ?? null,
      notRestored: result.readback?.notRestored?.length ?? null, message: result.message ?? null };
    return result;
  };
  try {
    trackId = await newTrack('gn-8i3-clips');
    if (scenesBefore < 44) await call('add-scenes', 'add_scenes', { count: 44 - scenesBefore });
    for (let row = 0; row < 32; row += 2) await call(`add-clip-${row}`, 'add_launcher_clip', { trackId, row, document });
    const copies = Array.from({ length: 8 }, (_, k) => ({
      source: { trackId: trackId!, row: 2 * k }, destination: { trackId: trackId!, row: 2 * k + 1 } }));
    const copied = await call('copy-8', 'copy_launcher_clips', { copies });
    await keep('revert-copy-8', await call('revert-copy-8', 'revert_change', { changeId: copied.next.revert.changeId }, false));
    await call('copy-8-again', 'copy_launcher_clips', { copies });
    const targets = copies.map((item) => item.destination);
    const props = await call('props-8', 'set_launcher_clip_properties', { clips: targets.slice(0, 8).map((item, index) => ({
      ...item, properties: { name: `gn-8i3-${index}` } })) });
    await keep('revert-props-8', await call('revert-props-8', 'revert_change', { changeId: props.effects[0].changeId }, false));
    await call('launch-8', 'set_launcher_clip_launch_settings', { clips: targets.slice(0, 8).map((item) => ({ ...item,
      quantization: '1', mode: 'default' })) });
    const deleted = await call('delete-4', 'delete_launcher_clip', { clips: targets.slice(0, 4) });
    await keep('revert-delete-4', await call('revert-delete-4', 'revert_change', { changeId: deleted.effects[0].changeId }, false));
    const moved = await call('move-8', 'move_launcher_clips', { trackId, firstRow: 0, lastRow: 7, destinationFirstRow: 33 }, false);
    await keep('move-8', moved);
    const moveRevert = moved.next?.revert?.changeId ?? moved.effects?.[0]?.changeId;
    if (moveRevert !== undefined) {
      await keep('revert-move-8', await call('revert-move-8', 'revert_change', { changeId: moveRevert }, false));
    }
  } finally {
    if (trackId !== undefined) await call('cleanup', 'delete_track', { trackIds: [trackId] });
    const scenes = (await adapter.revision()).window.scenes.count;
    if (scenes > scenesBefore) {
      await call('cleanup-scenes', 'delete_scene', { rows: Array.from({ length: scenes - scenesBefore },
        (_, index) => scenesBefore + index) });
    }
  }
  await save(dir, 'clips.json', guarded, { scenesBefore, outcomes });
}

/**
 * The clip batch limit with the largest clip (16,384 notes, the E246 reader case): 8 source clips on the even rows
 * 0 through 14. Copy 8, properties 8, launch settings 8, delete 4, and a move of 8 rows, each with its revert.
 */
async function clipsLarge(dir: string): Promise<void> {
  const guarded = await guard();
  const document = worstDesired(16_384);
  let trackId: string | undefined;
  const scenesBefore = (await adapter.revision()).window.scenes.count;
  const outcomes: Record<string, unknown> = {};
  const keep = (step: string, result: Wire): Wire => {
    outcomes[step] = { status: result.readback?.status ?? null, failure: result.failure ?? null,
      notRestored: result.readback?.notRestored?.length ?? null, message: result.message ?? null };
    return result;
  };
  try {
    trackId = await newTrack('gn-8i3-large');
    if (scenesBefore < 32) await call('add-scenes', 'add_scenes', { count: 32 - scenesBefore });
    for (let row = 0; row < 16; row += 2) await call(`add-large-${row}`, 'add_launcher_clip', { trackId, row, document });
    const copies = Array.from({ length: 8 }, (_, k) => ({
      source: { trackId: trackId!, row: 2 * k }, destination: { trackId: trackId!, row: 2 * k + 1 } }));
    const copied = await call('copy-8-large', 'copy_launcher_clips', { copies });
    keep('revert-copy-8-large', await call('revert-copy-8-large', 'revert_change', { changeId: copied.next.revert.changeId }, false));
    await call('copy-8-large-again', 'copy_launcher_clips', { copies });
    const targets = copies.map((item) => item.destination);
    const props = await call('props-8-large', 'set_launcher_clip_properties', { clips: targets.map((item, index) => ({
      ...item, properties: { name: `gn-8i3-large-${index}` } })) });
    keep('revert-props-8-large', await call('revert-props-8-large', 'revert_change', { changeId: props.effects[0].changeId }, false));
    await call('launch-8-large', 'set_launcher_clip_launch_settings', { clips: targets.map((item) => ({ ...item,
      quantization: '1', mode: 'default' })) });
    const deleted = await call('delete-4-large', 'delete_launcher_clip', { clips: targets.slice(0, 4) });
    keep('revert-delete-4-large', await call('revert-delete-4-large', 'revert_change', { changeId: deleted.effects[0].changeId }, false));
    const moved = await call('move-8-large', 'move_launcher_clips', { trackId, firstRow: 0, lastRow: 7, destinationFirstRow: 17 }, false);
    keep('move-8-large', moved);
    const moveRevert = moved.next?.revert?.changeId ?? moved.effects?.[0]?.changeId;
    if (moveRevert !== undefined) {
      keep('revert-move-8-large', await call('revert-move-8-large', 'revert_change', { changeId: moveRevert }, false));
    }
  } finally {
    if (trackId !== undefined) await call('cleanup', 'delete_track', { trackIds: [trackId] });
    const scenes = (await adapter.revision()).window.scenes.count;
    if (scenes > scenesBefore) {
      await call('cleanup-scenes', 'delete_scene', { rows: Array.from({ length: scenes - scenesBefore },
        (_, index) => scenesBefore + index) });
    }
  }
  await save(dir, 'clips-large.json', guarded, { scenesBefore, outcomes });
}

/**
 * The modulation verifications that grow with the input: `edit_preset_modulation` with 1 and 8 behavior checks,
 * `wrap_existing_device_modulation` with 1, 8, and 15 modulators, and a staged composition of 6 devices with 0 and
 * 4 container modulators (on three devices). Each result is reverted before the next case.
 */
async function modulation(dir: string): Promise<void> {
  const guarded = await guard();
  const wrapProofs: Record<number, unknown> = {};
  const trackId = await newTrack('gn-8i3-mod');
  try {
    const bare = await call('read-preset-bare', 'read_preset_modulation', { presetPath: POLY_BARE });
    const add = { kind: 'add', modulator: 'lfo', target: 'polysynth-filter-frequency', amount: 0.3 };
    const edit1 = await call('edit-preset-1', 'edit_preset_modulation', { trackId, presetPath: POLY_BARE,
      fingerprint: bare.fingerprint, location: { kind: 'self' }, operation: add });
    const target = (item: Wire) => ({ parameterId: item.id, parameterName: item.name });
    for (const [step, result] of [['edit-preset-1', edit1]] as const) {
      const changeId = result.effects?.[0]?.changeId ?? result.next?.revert?.changeId;
      if (changeId !== undefined) await call(`revert-${step}`, 'revert_change', { changeId });
    }
    const left = await call('after-presets', 'read_devices', { trackId });
    for (let index = left.data.devices.length - 1; index >= 0; index -= 1) {
      await call(`clear-${index}`, 'delete_device', { devices: [{ trackId, devicePosition: index }] });
    }

    await call('add-poly', 'add_devices', { trackId, devices: [{ kind: 'native', name: 'Polysynth' }] });
    // These controls move less than the 0.001 proof divergence (E252: per control, not per count); not targets here.
    const quiet = new Set(['CONTENTS/F1FREQ', 'CONTENTS/FEGDEPTH', 'CONTENTS/NOISE', 'CONTENTS/F1A', 'CONTENTS/F1R']);
    const wrapTargets = writable((await call('read-poly', 'read_device_controls', {
      device: { trackId, devicePosition: 0 } })).parameters as Wire[]).filter((item) => !quiet.has(item.id));
    // 15 is the D44 limit: the container page and 15 modulator pages fill the 16-page remote window.
    for (const count of [1, 8, 15]) {
      const order = (await call(`order-${count}`, 'read_devices', { trackId })).data.devices
        .map((item: Wire) => ({ name: item.name, enabled: item.enabled }));
      const wrapped = await call(`wrap-${count}`, 'wrap_existing_device_modulation', { trackId, devicePosition: 0,
        expectedDeviceOrder: order, containerKind: 'FX Layer', entryName: 'Layer 1',
        modulators: wrapTargets.slice(0, count).map((item) => ({ modulator: 'lfo', target: target(item), amount: 1 })) },
      false);
      // A control whose proof does not diverge fails its own witness (per control, E252); the time is the measure.
      wrapProofs[count] = (wrapped.verification?.behaviors ?? wrapped.behaviors ?? []).map((item: Wire) =>
        [item.selector?.directId, item.verified, item.maximumDivergence]);
      await call(`unwrap-${count}`, 'reverse_existing_device_modulation_wrap', { checkpoint: wrapped.reversalCheckpoint });
    }
    await call('clear-poly', 'delete_device', { devices: [{ trackId, devicePosition: 0 }] });

    // The staged limit with modulators: 3 layer chains of Polysynth and Tool (6 devices), with 0 modulators, and with
    // container modulators on the Polysynths (4 behavior proofs on three devices: the modulator limit).
    for (const count of [0, 4]) {
      const composed = await call(`compose-3x2-mod-${count}`, 'compose_devices', { trackId, containerKind: 'Instrument Layer',
        layerChains: [1, 2, 3].map((n, index) => ({ name: `M${n}`, devices: [
          { source: { kind: 'native', name: 'Polysynth' }, ...(count === 0 ? {} : { modulators: wrapTargets
            .slice(index === 0 ? 0 : index + 1, index === 0 ? 2 : index + 2).map((item) => ({ location: 'container',
              modulator: 'lfo', target: target(item), amount: 1 })) }) },
          { source: { kind: 'native', name: 'Tool' } }] })) });
      assert.equal(composed.readback.backend, 'staged');
      await call(`revert-compose-3x2-mod-${count}`, 'revert_change', { changeId: composed.next.revert.changeId });
    }
  } finally {
    await call('cleanup', 'delete_track', { trackIds: [trackId] });
  }
  await save(dir, 'modulation.json', guarded, { wrapProofs });
}

/**
 * 8i5 (E254). Blur `Common` lists controls at host positions 0, 1, 2, 3, and 7: the returned selector of the last
 * control is not its array position. The direct-ID write of the same parameter is the control arm. Then the D46
 * modulation writers, which run no behavior witness: the Sampler ADSR wrap of `Filter Frequency` (its remote label
 * is `Filt Freq`), wrap at the 15-modulator limit, one preset edit, and a composition with 4 modulators. Each write
 * is reversed. The audio engine can be off: no step samples behavior.
 */
async function identity(dir: string): Promise<void> {
  const guarded = await guard();
  const sparse: Wire = {};
  const trackId = await newTrack('gn-8i5-identity');
  const target = (item: Wire) => ({ parameterId: item.id, parameterName: item.name });
  const order = async (step: string) => (await call(step, 'read_devices', { trackId })).data.devices
    .map((item: Wire) => ({ name: item.name, enabled: item.enabled }));
  try {
    await call('add-blur', 'add_devices', { trackId, devices: [{ kind: 'native', name: 'Blur' }] });
    const remotes = await call('read-blur-remotes', 'read_device_controls', {
      device: { trackId, devicePosition: 0 }, view: 'remote-controls' });
    const pages = remotes.remotePages as Wire[];
    sparse['pages'] = pages.map((page) => [page.position, page.name, page.controls.map((item: Wire) =>
      [item.position, item.name])]);
    const page = pages.find((item) => item.controls.some((control: Wire, index: number) => control.position !== index));
    assert(page !== undefined, `Blur has no sparse page: ${JSON.stringify(sparse['pages'])}`);
    const control = page.controls.find((item: Wire, index: number) => item.position !== index)!;
    sparse['selector'] = [page.position, page.name, control.position, control.name, control.normalizedValue];
    const remoteSet = await call('set-blur-remote', 'set_device_controls', { settings: [{ kind: 'remote',
      device: { trackId, devicePosition: 0 }, pagePosition: page.position, pageName: page.name,
      controlPosition: control.position, controlName: control.name,
      normalizedValue: nextValue(control.normalizedValue) }] });
    await call('revert-blur-remote', 'revert_change',
      { changeId: remoteSet.parameterChanges[0].changes[0].changeId });
    const direct = writable((await call('read-blur-direct', 'read_device_controls', {
      device: { trackId, devicePosition: 0 } })).parameters as Wire[]);
    const same = direct.find((item) => item.name === control.name) ?? direct[0]!;
    sparse['directArm'] = [same.id, same.name];
    const directSet = await call('set-blur-direct', 'set_device_controls', { settings: [{ kind: 'direct',
      device: { trackId, devicePosition: 0 }, parameterId: same.id, normalizedValue: nextValue(same.normalizedValue) }] });
    await call('revert-blur-direct', 'revert_change',
      { changeId: directSet.parameterChanges[0].changes[0].changeId });
    await call('clear-blur', 'delete_device', { devices: [{ trackId, devicePosition: 0 }] });

    await call('add-sampler', 'add_devices', { trackId, devices: [{ kind: 'native', name: 'Sampler' }] });
    const sampler = (await call('read-sampler', 'read_device_controls', {
      device: { trackId, devicePosition: 0 } })).parameters as Wire[];
    const filter = sampler.find((item) => item.id === 'CONTENTS/FILT_FREQ');
    assert(filter !== undefined, 'Sampler has no CONTENTS/FILT_FREQ');
    const wrapped = await call('wrap-sampler-adsr', 'wrap_existing_device_modulation', { trackId, devicePosition: 0,
      expectedDeviceOrder: await order('order-sampler'), containerKind: 'FX Layer', entryName: 'Layer 1',
      modulators: [{ modulator: 'adsr', target: target(filter), amount: 0.5 }] });
    sparse['samplerWrap'] = { complete: wrapped.complete, why: wrapped.why ?? null, modulation: wrapped.modulation,
      behaviors: wrapped.verification?.behaviors?.length ?? null };
    await call('unwrap-sampler-adsr', 'reverse_existing_device_modulation_wrap',
      { checkpoint: wrapped.reversalCheckpoint });
    await call('clear-sampler', 'delete_device', { devices: [{ trackId, devicePosition: 0 }] });

    await call('add-poly', 'add_devices', { trackId, devices: [{ kind: 'native', name: 'Polysynth' }] });
    const poly = writable((await call('read-poly', 'read_device_controls', {
      device: { trackId, devicePosition: 0 } })).parameters as Wire[]);
    for (const count of [1, 15]) {
      const wrap = await call(`wrap-${count}`, 'wrap_existing_device_modulation', { trackId, devicePosition: 0,
        expectedDeviceOrder: await order(`order-${count}`), containerKind: 'FX Layer', entryName: 'Layer 1',
        modulators: poly.slice(0, count).map((item) => ({ modulator: 'lfo', target: target(item), amount: 1 })) });
      await call(`unwrap-${count}`, 'reverse_existing_device_modulation_wrap', { checkpoint: wrap.reversalCheckpoint });
    }
    await call('clear-poly', 'delete_device', { devices: [{ trackId, devicePosition: 0 }] });

    const bare = await call('read-preset-bare', 'read_preset_modulation', { presetPath: POLY_BARE });
    const edit = await call('edit-preset-1', 'edit_preset_modulation', { trackId, presetPath: POLY_BARE,
      fingerprint: bare.fingerprint, location: { kind: 'self' },
      operation: { kind: 'add', modulator: 'lfo', target: 'polysynth-filter-frequency', amount: 0.3 } });
    await call('revert-edit-preset-1', 'revert_change', { changeId: edit.change.changeId });
    const left = await call('after-preset', 'read_devices', { trackId });
    for (let index = left.data.devices.length - 1; index >= 0; index -= 1) {
      await call(`clear-${index}`, 'delete_device', { devices: [{ trackId, devicePosition: index }] });
    }

    // The D44 limits: 6 device units (a device with modulators counts 3) and 4 modulators.
    const composed = await call('compose-2x1-mod-4', 'compose_devices', { trackId, containerKind: 'Instrument Layer',
      layerChains: [0, 1].map((index) => ({ name: `M${index + 1}`, devices: [
        { source: { kind: 'native', name: 'Polysynth' }, modulators: poly.slice(2 * index, 2 * index + 2)
          .map((item) => ({ location: 'container', modulator: 'lfo', target: target(item), amount: 1 })) }] })) });
    assert.equal(composed.readback.backend, 'staged');
    await call('revert-compose-2x1-mod-4', 'revert_change', { changeId: composed.next.revert.changeId });
  } finally {
    await call('cleanup', 'delete_track', { trackIds: [trackId] });
  }
  await save(dir, 'identity.json', guarded, { sparse });
}

/**
 * The host primitive under the cohort integrity poll, with its control arm. After a complete settled inventory,
 * an unawaited raw `directparam.set` changes one control. Arm A polls `directparam.list` without `begin` until
 * the value is visible, then once more. Arm B (control) reads the complete settled inventory (`begin` and the
 * `paramsLive` settle). The two must agree on every ID, name, and value.
 */
async function pollAb(dir: string, trials = 10): Promise<void> {
  const guarded = await guard();
  const trackId = await newTrack('gn-8i3-poll');
  const results: Wire[] = [];
  try {
    await call('add-device', 'add_devices', { trackId, devices: [{ kind: 'native', name: 'Polysynth' }] });
    const device = { trackId, devicePosition: 0 };
    const all = writable((await call('read-controls', 'read_device_controls', { device })).parameters as Wire[]);
    for (let trial = 0; trial < trials; trial += 1) {
      const settled = await call(`settled-${trial}`, 'read_device_controls', { device });
      const before = new Map((settled.parameters as Wire[]).map((item) => [item.id, item.normalizedValue as number]));
      const target = all[(trial * 7) % all.length]!;
      const value = nextValue(before.get(target.id)!);
      const generation = (await request('directparam.list')).generation as number;
      const started = performance.now();
      await request('directparam.set', { id: target.id, value, resolution: 1 });
      let polls = 0;
      let seen: Wire | undefined;
      while (polls < 40) {
        polls += 1;
        const observed = await request('directparam.list');
        assert.equal(observed.generation, generation, 'a poll without begin keeps the generation');
        const row = (observed.params as Wire[]).find((item) => item.id === target.id);
        if (row !== undefined && Math.abs(row.value - value) <= 2e-3) { seen = observed; break; }
      }
      const visibleMs = performance.now() - started;
      const again = await request('directparam.list');
      const pollMap = new Map((again.params as Wire[]).map((item) => [item.id, [item.name, item.value]]));
      const control = await call(`control-${trial}`, 'read_device_controls', { device });
      const differences = (control.parameters as Wire[]).filter((item) => {
        const polled = pollMap.get(item.id);
        return polled === undefined || polled[0] !== item.name || Math.abs((polled[1] as number) - item.normalizedValue) > 1e-9;
      }).map((item) => item.id);
      const changed = (control.parameters as Wire[]).filter((item) =>
        Math.abs(item.normalizedValue - before.get(item.id)!) > 2e-3).map((item) => item.id);
      const result = { trial, id: target.id, value, visible: seen !== undefined, polls, visibleMs: Math.round(visibleMs),
        stableSignature: JSON.stringify(seen?.params) === JSON.stringify(again.params),
        sameIds: pollMap.size === control.parameters.length, differences, changed };
      results.push(result); say(result);
    }
  } finally {
    await call('cleanup', 'delete_track', { trackIds: [trackId] });
  }
  await save(dir, 'poll-ab.json', guarded, { results });
}

async function summary(dir: string): Promise<void> {
  for (const name of (await readdir(dir)).filter((item) => item.endsWith('.json')).sort()) {
    const run = JSON.parse(await readFile(join(dir, name), 'utf8')) as Wire;
    for (const row of run.rows as Profile[]) {
      say({ file: name, step: row.step, tool: row.tool, ok: row.ok, ms: row.ms, calls: row.calls, turns: row.turns,
        wireMs: row.wireMs, gapMs: row.gapMs, brainMs: row.brainMs });
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [command, dir, arg] = process.argv.slice(2);
  assert(dir !== undefined, 'give an output directory');
  const commands: Record<string, () => Promise<void>> = {
    controls: () => controls(dir, arg), compose: () => compose(dir, arg), drum: () => drum(dir), add: () => add(dir),
    tracks: () => tracks(dir), 'tracks-max': () => tracksMax(dir), plugins: () => plugins(dir),
    clips: () => clips(dir), 'clips-large': () => clipsLarge(dir), modulation: () => modulation(dir),
    identity: () => identity(dir), 'poll-ab': () => pollAb(dir), summary: () => summary(dir),
  };
  const run = commands[command ?? ''] ?? (() => Promise.reject(new Error(`unknown command ${command}`)));
  run().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
}
