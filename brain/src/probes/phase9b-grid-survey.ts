/**
 * Survey: <project name> <new absolute output directory> <preset-list.json> [query.json].
 * The list is an array of absolute paths or an object with a candidates array.
 * Read only: read <target.json> <new output directory> [projection-query.json].
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { BridgeClient } from '../client.js';
import { compareDeployment, deployedAtMs } from '../deploy.js';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { readSurvey, validateProjection, type Wire, type Projection, type Request } from './phase9b-grid-survey-read.js';
import { readFocused, validateFocusIndices } from './phase9b-grid-focused-read.js';

const ROOT = join(import.meta.dirname, '../../..');
const load = (path: string): Wire => {
  assert.ok(statSync(path).size <= 2 * 1024 * 1024, 'JSON input exceeds 2 MiB');
  return JSON.parse(readFileSync(path, 'utf8'));
};
const pause = () => new Promise(resolve => setTimeout(resolve, 50));
export function presetList(input: unknown): Wire[] {
  const values = Array.isArray(input) ? input : (input as Wire)?.candidates;
  assert.ok(Array.isArray(values) && values.length > 0 && values.length <= 32, 'Use 1–32 presets');
  return values.map(value => {
    const row = typeof value === 'string' ? { path: value } : value;
    assert.ok(row && typeof row.path === 'string' && isAbsolute(row.path) && row.path.endsWith('.bwpreset'),
      'Use absolute .bwpreset paths');
    validateFocusIndices(row.focusModuleIndices);
    const stat = statSync(row.path);
    assert.ok(stat.isFile() && stat.size <= 32 * 1024 * 1024, 'Preset file limit');
    return row;
  });
}
export type ScratchWorkflow = {
  marker?: string;
  stopOnRefusal?: boolean;
  budget?: { calls: number; milliseconds: number; bytes: number };
  prepare?(request: Request, save: (name: string, value: unknown) => void): Promise<void>;
  complete?(request: Request, results: Wire[], before: Wire, after: Wire): Promise<void>;
  run(request: Request, target: Wire, candidate: Wire, save: (name: string, value: unknown) => void): Promise<Wire>;
};
export async function runSurvey(args: string[], workflow?: ScratchWorkflow) {
  const readOnly = args[0] === 'read';
  const [projectOrMode, outputOrTarget, listOrOutput, optionalQuery] = args;
  const output = readOnly ? listOrOutput : outputOrTarget;
  assert.ok(output && isAbsolute(output), 'Use a new absolute output directory');
  const candidates = readOnly ? [] : presetList(load(listOrOutput!));
  assert.ok(!workflow || !readOnly, 'A write workflow requires scratch fixtures');
  const scratchPrefix = workflow ? 'gn-9b-write-' : 'gn-9b-survey-';
  const explicitTarget = readOnly ? load(outputOrTarget!) : undefined;
  const project = readOnly ? explicitTarget!.project : projectOrMode;
  assert.ok(typeof project === 'string' && project.length > 0, 'Expected project is required');
  const query = load(optionalQuery ?? join(ROOT, 'context/evidence/data/phase9a-grid-read/semantic-query.json'));
  const mode = query.mode ?? 'graph';
  assert.ok(mode === 'graph' || mode === 'catalog' || mode === 'focused', 'Unknown survey mode');
  const projection: Projection = structuredClone(query.projection);
  validateProjection(projection);
  validateFocusIndices(query.focusModuleIndices);
  const readTarget = (target: Wire, saveCapture: (name: string, value: unknown) => void, baseline?: Wire,
    indices?: number[]) =>
    mode === 'focused' ? readFocused(request, target, projection, saveCapture, baseline, indices ?? query.focusModuleIndices)
      : readSurvey(request, target, projection, saveCapture, baseline, mode);
  const control = load(join(ROOT, 'context/evidence/data/phase9a-grid-read/live-23-semantic-baseline/capture-0.json')).graph;
  mkdirSync(output);
  const save = (name: string, value: unknown) =>
    writeFileSync(join(output, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  const client = new BridgeClient();
  const calls: Wire[] = [], results: Wire[] = [];
  let scratch: string | undefined, uncertain = false;
  let before: Wire | undefined;
  let serial = 0, evidenceBytes = 0;
  const started = performance.now();
  const request = async (method: string, params: Wire = {}, timeout?: number): Promise<Wire> => {
    const start = performance.now();
    if (workflow?.budget) {
      assert.ok(calls.length < workflow.budget.calls && start - started < workflow.budget.milliseconds
        && evidenceBytes < workflow.budget.bytes, 'doctor-driver-budget');
    }
    try {
      const result = await client.request(method, params, timeout) as Wire;
      evidenceBytes += Buffer.byteLength(JSON.stringify(result));
      calls.push({ method, params, ms: performance.now() - start, bytes: Buffer.byteLength(JSON.stringify(result)) });
      return result;
    } catch (error) {
      calls.push({ method, params, ms: performance.now() - start, error: String(error) }); throw error;
    }
  };
  const adapter = new LiveAdapter({ transport: {
    send: frame => request(frame.method, frame.params, frame.timeoutMs),
    close: async () => client.disconnect(),
  } });
  const workspace = workspaceOf({ ready: async () => undefined, adapter, stash: new Stash(),
    executor: new Executor(adapter), observationStore: new FakeObservationStore() });
  const selection = async () => {
    const s = await request('selection.status');
    return { project: s.project, mixerChannelId: s.mixerChannelId, trackIndex: s.trackIndex, slotIndex: s.slotIndex };
  };
  const tracks = async (): Promise<Wire[]> => {
    assert.equal((await request('revision.get')).project, project, 'project-changed');
    const list = await request('track.list');
    assert.equal(list.count, list.itemCount, 'partial-track-bank'); return list.tracks;
  };
  const point = async (track: Wire, cursor = 0) => {
    assert.ok(!track.hidden, 'Expand hidden tracks before the survey');
    await request('cursor.pointTrack', { cursor: String(cursor), trackIndex: track.index });
    let prior: Wire | undefined;
    for (let i = 0; i < 40; i++) {
      const list = await request('device.list', { cursor });
      if (list.trackChannelId === track.channelId && list.count === list.itemCount
          && prior && JSON.stringify(list) === JSON.stringify(prior)) {
        return list;
      }
      prior = list;
      await pause();
    }
    throw new Error('cursor-did-not-settle');
  };
  const snapshot = async (): Promise<Wire> => {
    const list = await tracks();
    assert.ok(list.length <= 32, 'Survey preservation scope is at most 32 tracks');
    const mixer = await request('track.mixer', { tracks: list.map(t => ({ trackIndex: t.index, channelId: t.channelId })) });
    assert.ok(mixer.tracks.every((t: Wire) => t.matches), 'mixer-target-changed');
    const devices: Wire = {};
    for (const t of list) devices[t.channelId] = await point(t);
    return { tracks: list, mixer, devices, selection: await selection() };
  };
  const owned = async (): Promise<Wire> => {
    assert.ok(scratch, 'No owned scratch track');
    const list = await tracks(), found = list.find(t => t.channelId === scratch);
    assert.ok(found && found.name.startsWith(scratchPrefix) && !found.hidden, 'scratch-ownership-changed');
    assert.deepEqual(await selection(), before!.selection, 'operator-selection-changed');
    return found;
  };
  const tool = async (name: string, input: Wire) => {
    assert.equal((await request('revision.get')).project, project);
    uncertain = true;
    const result = await callTool(workspace, name, input, AGENT_NATIVE_TOOL_PROFILE) as Wire;
    save(`tool-${serial++}-${name}`, result);
    assert.equal(result.failure, undefined, `${name}: ${JSON.stringify(result.failure)}`);
    assert.equal(result.readback?.status, 'verified', `${name}: independent readback required`);
    uncertain = false; return result;
  };
  const cleanup = async () => {
    if (!scratch) return;
    const state = await request('probe.gridRead', { operation: 'status' });
    assert.ok(!state.bound && !state.busy && !state.locked && !state.nativeUnfinished && !state.foreignOwner,
      'native-read-or-write-not-released');
    await owned();
    const park = (await tracks()).find(t => before!.tracks.some((b: Wire) => b.channelId === t.channelId));
    assert.ok(park, 'No preserved track for cursor parking');
    await point(park, 0); await point(park, 1);
    await owned();
    const id = scratch;
    await tool('delete_track', { trackIds: [id] });
    uncertain = true;
    assert.ok(!(await tracks()).some(t => t.channelId === id), 'scratch-delete-readback');
    scratch = undefined; uncertain = false;
  };
  const verifyControl = async (label: string) => {
    const t = (await tracks()).find(t => t.name === 'grid-probe');
    assert.ok(t && before!.tracks.filter((b: Wire) => b.name === 'grid-probe').length === 1, 'control-track-required');
    const bank = await point(t), grids = bank.devices.filter((d: Wire) => d.name === 'Poly Grid');
    assert.equal(grids.length, 1, 'control-grid-required');
    const semantic = load(join(ROOT, 'context/evidence/data/phase9a-grid-read/semantic-query.json')).projection;
    await readSurvey(request, { project, trackId: t.channelId, trackName: t.name,
      deviceIndex: grids[0].index, deviceName: grids[0].name }, semantic,
    (name, value) => save(`${label}-${name}`, value), control);
    assert.deepEqual(await selection(), before!.selection, 'control-selection-changed');
  };
  try {
    const hello = await request('contract.hello'), rig = await request('rig.info'), stats = await request('rig.stats');
    assert.equal(hello.runtimeProfile, 'phase-8-probe-v1');
    assert.equal(hello.methodCount, 118); assert.equal(hello.methodsHash, '2e939035ea90b8b0');
    assert.equal(compareDeployment(deployedAtMs(), stats.initEpochMs ?? -1).state, 'fresh');
    const status = await request('probe.gridRead', { operation: 'status' });
    assert.equal(status.marker, workflow?.marker ?? '9b-grid-writes-v18');
    assert.ok(!status.bound && !status.busy && !status.locked && !status.nativeUnfinished && !status.foreignOwner);
    save('entry', { hello, rig, stats, status, project, candidates });
    if (readOnly) {
      const t = (await tracks()).find(t => t.channelId === explicitTarget!.trackId);
      assert.ok(t); const selected = await selection(); await point(t);
      const result = await readTarget(explicitTarget!, save);
      assert.deepEqual(await selection(), selected);
      save('result', result); return;
    }
    if (workflow?.prepare) await workflow.prepare(request, save);
    await adapter.hello();
    before = await snapshot(); save('before', before);
    assert.ok(!before.tracks.some((t: Wire) => /^gn-9b-(survey|write)-/.test(t.name)), 'Inspect old scratch residue first');
    if (workflow) await verifyControl('control-before');
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]!;
      const name = `${scratchPrefix}${workflow ? randomUUID() : randomUUID().slice(0, 8)}`;
      assert.deepEqual(await tracks(), before.tracks, 'track-state-changed-before-setup');
      assert.deepEqual(await selection(), before.selection, 'selection-changed-before-setup');
      const added = await tool('add_tracks', { tracks: [{ name }] });
      scratch = added.readback.tracks[0].trackId;
      await owned();
      await tool('set_track_mixer', { tracks: [{ trackId: scratch, mute: true }] });
      const t = await owned();
      uncertain = true;
      const mixer = await request('track.mixer', { tracks: [{ trackIndex: t.index, channelId: scratch }] });
      assert.equal(mixer.tracks[0].mute, true); uncertain = false;
      const empty = await point(t); assert.equal(empty.count, 0);
      await owned();
      uncertain = true;
      await request('device.insertFile', { cursor: 0, path: candidate.path,
        expectedTrackChannelId: scratch, expectedDeviceNames: [] });
      let inserted: Wire | undefined;
      for (let poll = 0; poll < 80; poll++) {
        const bank = await request('device.list', { cursor: 0 });
        if (bank.count > 0 && bank.count === bank.itemCount) { inserted = bank; break; }
        await pause();
      }
      assert.ok(inserted, 'preset-insertion-readback-timeout');
      const independent = await point(t, 1);
      assert.deepEqual(independent.devices, inserted.devices, 'independent-device-bank-disagrees');
      uncertain = false;
      save(`preset-${i}-inserted`, { candidate, devices: independent });
      const grids = inserted.devices.filter((d: Wire) => /^(Poly|FX|Note) Grid$/.test(d.name));
      if (grids.length !== 1) {
        const result = { path: candidate.path, verdict: 'no-single-named-top-level-grid',
          deviceNames: inserted.devices.map((d: Wire) => d.name) };
        results.push(result); save(`preset-${i}-summary`, result);
        await cleanup();
        assert.deepEqual(await tracks(), before.tracks, 'track-state-changed-after-cleanup');
        console.log(JSON.stringify(result)); continue;
      }
      const target = { project, trackId: scratch, trackName: t.name, deviceIndex: grids[0].index, deviceName: grids[0].name };
      save(`preset-${i}-target`, { candidate, target, devices: inserted });
      let result: Wire;
      try {
        if (workflow) {
          uncertain = true;
          result = await workflow.run(request, target, candidate, (label, value) => save(`preset-${i}-${label}`, value));
          uncertain = false;
        } else result = await readTarget(target, (label, value) => save(`preset-${i}-${label}`, value),
          candidate.role === '9a baseline control' ? control : undefined, candidate.focusModuleIndices);
      } catch (error) {
        if (workflow) throw error;
        if (!/work-or-time-limit|byte-limit|schema-(child|property)-limit|path-(limit|index-limit)|survey-(schema|capture)-limit|focused-(schema|capture|module|atom|summary)-limit|focused-schema-truncated/.test(String(error))) throw error;
        result = { verdict: 'cap-refusal', error: String(error) };
        save(`preset-${i}-cap-refusal`, result);
      }
      results.push({ presetPath: candidate.path, flavour: grids[0].name, ...result });
      await cleanup();
      assert.deepEqual(await tracks(), before.tracks, 'track-state-changed-after-cleanup');
      if (workflow?.stopOnRefusal && result.verdict !== 'passed') break;
      console.log(JSON.stringify({ preset: basename(candidate.path), verdict: result.verdict,
        modules: result.moduleCount, cables: result.projectedAudioCableCount }));
    }
    if (workflow) await verifyControl('control-after');
    const after = await snapshot(); save('after', after);
    assert.deepEqual(after, before, 'preserved-state-changed-after-survey');
    save('results', results);
    if (workflow?.complete) await workflow.complete(request, results, before, after);
  } catch (error) {
    save('failure', { error: String(error), scratch, uncertain });
    // Inspect after uncertainty. Do not repeat a write or delete an uncertain fixture.
    try { save('failure-state', { tracks: await tracks(), selection: await selection(),
      survey: await request('probe.gridRead', { operation: 'status' }) }); } catch {}
    throw error;
  } finally {
    try {
      if (scratch && !uncertain) await cleanup();
    } finally {
      save('calls', { calls, count: calls.length, wireMs: calls.reduce((n, c) => n + c.ms, 0) });
      save('exit', { scratch: scratch ?? null, uncertain, completedPresets: results.length });
      client.disconnect();
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runSurvey(process.argv.slice(2));
