/**
 * 8h4f representative workflows through both profiles (E239). Live driver, normal profile, owned unsaved project
 * (refuses the saved anchor, D29). Every step calls the tools through the MCP dispatch path, with wall time,
 * result bytes, and wire calls. The read, 16-note insertion, and E45/E48-style clip workflow are
 * `phase8h4d-workflow.ts workflow`.
 *
 *   controls <dir>        a 27-control write on Polysynth: stable-v1 set_parameter, then agent-native-v1
 *                         set_device_controls, 2 runs each, each on a fresh track
 *   ab <dir>              the A/B audition and winner collapse: stable-v1 managed alternates (create, fill, switch,
 *                         keep), then the agent-native-v1 recipe (compose_devices, set_layer_chain_solo, move_devices,
 *                         delete_device), 2 runs each, each on a fresh track
 *   retained <dir>        one live call of each 8h4f tool on agent-native-v1 (the cost-model trace): connection,
 *                         list_tracks, add_tracks (audio and instrument), duplicate_track (Audio and Hybrid),
 *                         rename_track, list_changes, check_revert, revert_change, set_device_enabled and its revert,
 *                         and delete_track. Needs one Hybrid track with a device at position 0.
 *   verify-offline <dir>  recompute the totals from the retained artifacts
 *
 * Each run deletes its track at the end.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, STABLE_TOOL_PROFILE, callTool, type ToolProfile } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { WireTransport } from './phase8h3c-promotion.js';

type Wire = Record<string, any>;
const SCHEMA = 'phase8h4f-measure-v1';
export const NORMAL_8H4F = ['normal-v1', 89, '0ef817f4bac8a8a7'] as const;
const ANCHOR = 'gn-scale-test';
const CONTROLS = 27;
const RUNS = 2;

const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const workspace = workspaceOf({
  ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
  observationStore: new FakeObservationStore(),
});
const request = async (method: string, params?: Wire): Promise<Wire> =>
  await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
const say = (value: unknown): void => console.log(JSON.stringify(value));

interface Step { run: number; profile: ToolProfile; step: string; tool: string; ms: number; bytes: number; wire: number }
const steps: Step[] = [];

const failed = (result: Wire): boolean => result.failure !== undefined || result.refused === true
  || result.partialSuccess === true;

async function call(run: number, profile: ToolProfile, step: string, tool: string, args: Wire): Promise<Wire> {
  const from = transport.calls.length;
  const started = performance.now();
  const result = await callTool(workspace, tool, args, profile) as Wire;
  const entry: Step = { run, profile, step, tool, ms: Math.round(performance.now() - started),
    bytes: Buffer.byteLength(JSON.stringify(result)), wire: transport.calls.length - from };
  steps.push(entry); say(entry);
  assert(!failed(result), `${profile} ${step} ${tool}: ${JSON.stringify(result).slice(0, 800)}`);
  return result;
}

async function guard(): Promise<Wire> {
  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], [...NORMAL_8H4F]);
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project) && mark.project !== ANCHOR, `use an owned unsaved project, got ${mark.project}`);
  await adapter.hello();
  return { hello, project: mark.project };
}

/** A fresh track through the profile's own creation tool. Not counted in the workflow totals. */
async function freshTrack(run: number, profile: ToolProfile, name: string): Promise<string> {
  if (profile === AGENT_NATIVE_TOOL_PROFILE) {
    const added = await call(run, profile, 'setup-track', 'add_tracks', { tracks: [{ name }] });
    return added.readback.tracks[0].trackId as string;
  }
  const added = await call(run, profile, 'setup-track', 'add_track', { names: [name] });
  return added.created[0].trackId as string;
}

async function deleteTrack(run: number, profile: ToolProfile, trackId: string): Promise<void> {
  await call(run, profile, 'cleanup', 'delete_track', { trackIds: [trackId] });
}

// --- 27-control write ---------------------------------------------------------

async function controlsRun(run: number, profile: ToolProfile): Promise<void> {
  const native = profile === AGENT_NATIVE_TOOL_PROFILE;
  const trackId = await freshTrack(run, profile, `gn-8h4f-controls-${run}`);
  try {
    if (native) await call(run, profile, 'setup-device', 'add_devices', { trackId, devices: [{ kind: 'native', name: 'Polysynth' }] });
    else await call(run, profile, 'setup-device', 'add_native_devices', { trackId, deviceNames: ['Polysynth'] });
    const device = { trackId, devicePosition: 0 };
    const read = await call(run, profile, 'read', native ? 'read_device_controls' : 'inspect_device_parameters', { device });
    const continuous = (read.parameters as Wire[]).filter((item) => item.discreteValueCount === undefined
      && typeof item.normalizedValue === 'number').slice(0, CONTROLS);
    assert.equal(continuous.length, CONTROLS, 'Polysynth has 27 continuous DirectParameters');
    const settings = continuous.map((item, index) => ({ kind: 'direct', device, parameterId: item.id,
      normalizedValue: Math.round(((item.normalizedValue as number) > 0.5 ? 0.2 : 0.8) * 1000 + index) / 1000 }));
    const written = await call(run, profile, 'write', native ? 'set_device_controls' : 'set_parameter', { settings });
    assert.equal(written.verified, true);
  } finally {
    await deleteTrack(run, profile, trackId);
  }
}

// --- A/B audition and winner collapse -------------------------------------------------

async function abRun(run: number, profile: ToolProfile): Promise<void> {
  const trackId = await freshTrack(run, profile, `gn-8h4f-ab-${run}`);
  try {
    if (profile === AGENT_NATIVE_TOOL_PROFILE) {
      await call(run, profile, 'compose', 'compose_devices', { trackId, containerKind: 'Instrument Layer', layerChains: [
        { name: 'A', devices: [{ source: { kind: 'native', name: 'Polysynth' } }] },
        { name: 'B', devices: [{ source: { kind: 'native', name: 'Phase-4' } }] }] });
      await call(run, profile, 'read', 'read_devices', { trackId });
      await call(run, profile, 'audition-A', 'set_layer_chain_solo', { trackId, containerPosition: 0, layerChain: 'A', mode: 'exclusive' });
      await call(run, profile, 'audition-B', 'set_layer_chain_solo', { trackId, containerPosition: 0, layerChain: 'B', mode: 'exclusive' });
      // Winner collapse: B wins. Move its device out, delete the emptied container, and read the result.
      await call(run, profile, 'collapse-read', 'read_devices', { trackId });
      await call(run, profile, 'collapse-move', 'move_devices', { trackId,
        devices: [{ from: 'layer-chain', containerPosition: 0, layerChain: 'B', devicePosition: 0 }],
        destination: { to: 'track-end' } });
      await call(run, profile, 'collapse-delete', 'delete_device', { devices: [{ trackId, devicePosition: 0 }] });
      const after = await call(run, profile, 'collapse-verify', 'read_devices', { trackId });
      assert.deepEqual((after.data.devices as Wire[]).map((item) => item.name), ['Phase-4']);
      return;
    }
    // stable-v1: managed alternates. The container must be at position 0 or 1 to expose its contents.
    await call(run, profile, 'compose', 'create_device_alternates', { trackId, containerType: 'instrument', names: ['A', 'B'] });
    await call(run, profile, 'compose-devices', 'add_native_devices', { trackId, deviceNames: ['Polysynth', 'Phase-4'] });
    await call(run, profile, 'compose-fill-A', 'fill_device_alternate', { trackId, containerPosition: 0, alternateName: 'A',
      sourceDevicePositions: [1], mode: 'move' });
    await call(run, profile, 'compose-fill-B', 'fill_device_alternate', { trackId, containerPosition: 0, alternateName: 'B',
      sourceDevicePositions: [1], mode: 'move' });
    await call(run, profile, 'read', 'inspect_device_alternates', { trackId, containerPosition: 0 });
    await call(run, profile, 'audition-A', 'switch_device_alternate', { trackId, containerPosition: 0, alternateName: 'A' });
    await call(run, profile, 'audition-B', 'switch_device_alternate', { trackId, containerPosition: 0, alternateName: 'B' });
    await call(run, profile, 'collapse-keep', 'keep_device_alternate', { trackId, containerPosition: 0, alternateName: 'B' });
    const after = await call(run, profile, 'collapse-verify', 'inspect_devices', { trackId });
    assert.deepEqual((after.devices as Wire[]).map((item) => item.name), ['Phase-4']);
  } finally {
    await deleteTrack(run, profile, trackId);
  }
}

// --- the 8h4f retained tools ---------------------------------------------------------

async function retained(dir: string): Promise<void> {
  const guarded = await guard();
  const p = AGENT_NATIVE_TOOL_PROFILE;
  const before = ((await request('track.list')).tracks as Wire[]);
  const hybrid = before.find((row) => row.type === 'Hybrid');
  assert(hybrid !== undefined, 'one Hybrid track with a device at position 0');
  await call(1, p, 'connection', 'check_bitwig_connection', {});
  await call(1, p, 'tracks', 'list_tracks', {});
  const added = await call(1, p, 'add', 'add_tracks', { tracks: [{ name: 'gn-8h4f-audio', kind: 'audio' },
    { name: 'gn-8h4f-inst' }] });
  assert.equal(added.readback.status, 'verified');
  assert.deepEqual(added.readback.tracks.map((item: Wire) => item.kind), ['Audio', 'Instrument']);
  const [audio, inst] = (added.readback.tracks as Wire[]).map((item) => item.trackId as string);
  const audioCopy = await call(1, p, 'duplicate-audio', 'duplicate_track', { trackId: audio, name: 'gn-8h4f-audio copy' });
  const hybridCopy = await call(1, p, 'duplicate-hybrid', 'duplicate_track', { trackId: hybrid.channelId,
    name: 'gn-8h4f-hybrid copy' });
  assert.equal(hybridCopy.readback.copy.kind, 'Hybrid');
  const renamed = await call(1, p, 'rename', 'rename_track', { tracks: [{ trackId: inst, name: 'gn-8h4f-inst 2' }] });
  await call(1, p, 'changes', 'list_changes', {});
  const checked = await call(1, p, 'check', 'check_revert', { changeId: renamed.effects[0].changeId });
  assert.equal(checked.data.wouldWriteAnything, true);
  await call(1, p, 'revert', 'revert_change', { changeId: renamed.effects[0].changeId });
  const bypass = await call(1, p, 'enabled', 'set_device_enabled', { settings: [{ trackId: hybridCopy.readback.copy.trackId,
    devicePosition: 0, enabled: false }] });
  assert.equal(bypass.readback.status, 'verified');
  await call(1, p, 'enabled-revert', 'revert_change', { changeId: bypass.effects[0].changeId });
  const removed = await call(1, p, 'delete', 'delete_track', { trackIds: [audio, inst, audioCopy.readback.copy.trackId,
    hybridCopy.readback.copy.trackId] });
  assert.equal(removed.readback.status, 'verified');
  const after = ((await request('track.list')).tracks as Wire[]).map((row) => row.channelId);
  assert.deepEqual(after, before.map((row) => row.channelId), 'no track residue');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'retained.json'), JSON.stringify({ schema: SCHEMA, ...guarded, steps }, null, 1) + '\n');
  say({ written: join(dir, 'retained.json') });
}

// --- totals -------------------------------------------------------------------------

/** The workflow totals of each profile and run, without the track setup and cleanup. */
export function totals(recorded: readonly Step[]): Wire[] {
  const out: Wire[] = [];
  for (const profile of [STABLE_TOOL_PROFILE, AGENT_NATIVE_TOOL_PROFILE] as const) {
    for (let run = 1; run <= RUNS; run++) {
      const work = recorded.filter((item) => item.profile === profile && item.run === run
        && !item.step.startsWith('setup') && item.step !== 'cleanup');
      out.push({ profile, run, calls: work.length, ms: work.reduce((sum, item) => sum + item.ms, 0),
        bytes: work.reduce((sum, item) => sum + item.bytes, 0), wire: work.reduce((sum, item) => sum + item.wire, 0) });
    }
  }
  return out;
}

async function measure(dir: string, name: string, body: (run: number, profile: ToolProfile) => Promise<void>): Promise<void> {
  const guarded = await guard();
  const before = ((await request('track.list')).tracks as Wire[]).map((row) => row.channelId);
  for (const profile of [STABLE_TOOL_PROFILE, AGENT_NATIVE_TOOL_PROFILE] as const) {
    for (let run = 1; run <= RUNS; run++) await body(run, profile);
  }
  const after = ((await request('track.list')).tracks as Wire[]).map((row) => row.channelId);
  assert.deepEqual(after, before, 'no track residue');
  await mkdir(dir, { recursive: true });
  const summary = totals(steps);
  await writeFile(join(dir, `${name}.json`), JSON.stringify({ schema: SCHEMA, ...guarded, steps, totals: summary },
    null, 1) + '\n');
  say({ written: join(dir, `${name}.json`), totals: summary });
}

async function verifyOffline(dir: string): Promise<void> {
  for (const name of ['controls', 'ab']) {
    const artifact = JSON.parse(await readFile(join(dir, `${name}.json`), 'utf8')) as Wire;
    assert.equal(artifact.schema, SCHEMA);
    assert.deepEqual(totals(artifact.steps as Step[]), artifact.totals);
    say({ [name]: artifact.totals });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [command, dir] = process.argv.slice(2);
  try {
    if (command === 'controls' && dir) await measure(dir, 'controls', controlsRun);
    else if (command === 'ab' && dir) await measure(dir, 'ab', abRun);
    else if (command === 'retained' && dir) await retained(dir);
    else if (command === 'verify-offline' && dir) await verifyOffline(dir);
    else throw new Error('usage: phase8h4f-measure.ts controls|ab|retained|verify-offline <dir>');
  } finally {
    await transport.close();
  }
}
