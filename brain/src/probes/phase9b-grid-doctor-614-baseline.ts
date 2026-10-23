/**
 * 9b.6i read-only baseline check of `gn-grid-spike` on Bitwig 6.1.4 (D52, E339 recovery).
 * Usage: <new absolute output directory> [prior baseline-check.json to compare].
 * It sends only reads: no scratch track, no doctor bind, no native command. The control read
 * points the probe-owned cursor at `grid-probe`; the operator selection is read and compared.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';
import { compareDeployment, deployedAtMs } from '../deploy.js';
import { readSurvey, type Wire, type Request } from './phase9b-grid-survey-read.js';
import { MARKER, HOST_VERSION } from './phase9b-grid-doctor-614.js';

const ROOT = join(import.meta.dirname, '../../..');
export const PROJECT = 'gn-grid-spike';
/** The historical control: only these tracks, in this order, with `grid-probe` muted and one Poly Grid. */
export const BASELINE_TRACKS = [['grid-probe', 'Instrument'], ['FX 1', 'Effect'], ['Master', 'Master']];
const load = (path: string): Wire => {
  assert.ok(statSync(path).size <= 2 * 1024 * 1024, 'JSON input exceeds 2 MiB');
  return JSON.parse(readFileSync(path, 'utf8'));
};
const pause = () => new Promise(resolve => setTimeout(resolve, 50));

/**
 * The fields of a check that must agree with the prior recovery check. Counters, timing, and per-load
 * identities are excluded: the selection `revision` and `changes` counters restart with each extension
 * instance, and module and cable `uuid` values are assigned again when the project is reopened.
 */
export function comparable(check: Wire): Wire {
  const { revision: _revision, changes: _changes, ...selection } = check.selection;
  const identity = (rows: Wire[]) => rows.map(({ uuid: _uuid, ...row }) => row);
  return {
    project: check.revision.project,
    tracks: check.tracks.tracks.map((t: Wire) => ({ name: t.name, type: t.type, channelId: t.channelId, position: t.position })),
    selection,
    mixer: check.mixer.tracks.map((t: Wire) => ({ channelId: t.channelId, matches: t.matches, type: t.type,
      volumeDisplayed: t.volumeDisplayed, panRaw: t.panRaw, mute: t.mute, solo: t.solo })),
    devices: check.devices.devices.map((d: Wire) => ({ index: d.index, name: d.name, enabled: d.enabled })),
    control: { verdict: check.control.verdict, moduleCount: check.control.moduleCount,
      projectedAudioCableCount: check.control.projectedAudioCableCount, modules: identity(check.control.modules),
      cables: identity(check.control.cables), paired: check.control.paired, additions: check.control.additions },
    status: check.status, doctor: { ...check.doctor, metadata: undefined, guards: undefined },
    host: { hostVersion: check.host.hostVersion, hostApiVersion: check.host.hostApiVersion },
  };
}

/** Assert the recovered baseline. The check is pure; it throws on the first disagreement. */
export function requireBaseline(check: Wire) {
  assert.equal(check.revision.project, PROJECT, 'project');
  assert.equal(check.host.hostVersion, HOST_VERSION, 'host-version');
  const tracks = check.tracks.tracks as Wire[];
  assert.equal(check.tracks.count, check.tracks.itemCount, 'partial-track-bank');
  assert.deepEqual(tracks.map(t => [t.name, t.type]), BASELINE_TRACKS, 'baseline-tracks');
  assert.ok(!tracks.some(t => /^gn-9b-(survey|write)-/.test(t.name)), 'scratch-residue');
  const mixer = check.mixer.tracks as Wire[];
  assert.ok(mixer.every(t => t.matches), 'mixer-target-changed');
  assert.equal(mixer[0]!.mute, true, 'grid-probe-muted'); assert.equal(mixer[0]!.solo, false, 'grid-probe-solo');
  assert.ok(mixer.slice(1).every(t => !t.mute && !t.solo), 'other-tracks-mute-or-solo');
  assert.equal(check.devices.trackChannelId, tracks[0]!.channelId, 'control-device-bank');
  assert.deepEqual(check.devices.devices.map((d: Wire) => d.name), ['Poly Grid'], 'control-device');
  for (const status of [check.status, check.statusAfter]) {
    assert.equal(status.marker, MARKER, 'marker');
    assert.ok(!status.bound && !status.busy && !status.locked && !status.nativeUnfinished && !status.foreignOwner, 'reader-status');
  }
  const doctor = check.doctor;
  assert.equal(doctor.marker, MARKER); assert.equal(doctor.phase, 0, 'doctor-phase'); assert.equal(doctor.used, false, 'doctor-used');
  assert.ok(!doctor.failed && !doctor.bound && !doctor.busy && !doctor.timeoutLocked && !doctor.nativeUnfinished && !doctor.foreignOwner, 'doctor-status');
  assert.equal(check.control.verdict, 'projected-read-agrees', 'control-verdict');
  assert.equal(check.control.paired, true, 'control-paired');
  assert.equal(check.control.moduleCount, 4); assert.equal(check.control.projectedAudioCableCount, 2);
  assert.deepEqual(check.selectionAfter, check.selection, 'operator-selection-changed');
  assert.equal(check.selection.project, PROJECT); assert.equal(check.selection.mixerChannelId, tracks[0]!.channelId);
}

export async function runBaselineCheck(output: string, priorPath?: string) {
  assert.ok(output && isAbsolute(output), 'Use a new absolute output directory');
  mkdirSync(output);
  const save = (name: string, value: unknown) =>
    writeFileSync(join(output, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  const client = new BridgeClient();
  const calls: Wire[] = [];
  const request: Request = async (method, params = {}, timeout?: number) => {
    const start = performance.now();
    assert.ok(calls.length < 120, 'baseline-call-budget');
    try {
      const result = await client.request(method, params, timeout) as Wire;
      calls.push({ method, params, ms: performance.now() - start, bytes: Buffer.byteLength(JSON.stringify(result)) });
      return result;
    } catch (error) {
      calls.push({ method, params, ms: performance.now() - start, error: String(error) }); throw error;
    }
  };
  try {
    const hello = await request('contract.hello'), rig = await request('rig.info'), stats = await request('rig.stats');
    const deployment = compareDeployment(deployedAtMs(), stats.initEpochMs ?? -1);
    save('hello', { at: new Date().toISOString(), hello, rig, stats, deployment });
    assert.equal(hello.runtimeProfile, 'phase-8-probe-v1'); assert.equal(hello.methodCount, 118);
    assert.equal(hello.methodsHash, '2e939035ea90b8b0'); assert.equal(rig.gridReadProbe, MARKER);
    assert.equal(deployment.state, 'fresh', deployment.detail);
    const check: Wire = {
      revision: await request('revision.get'), tracks: await request('track.list'), selection: await request('selection.status'),
      status: await request('probe.gridRead', { operation: 'status' }),
      doctor: await request('probe.gridRead', { operation: 'doctorStatus' }), host: await request('host.info'),
    };
    const control = (check.tracks.tracks as Wire[]).find(t => t.name === 'grid-probe');
    assert.ok(control, 'control-track-required');
    await request('cursor.pointTrack', { cursor: '0', trackIndex: control.index });
    let prior: Wire | undefined, devices: Wire | undefined;
    for (let i = 0; i < 40 && !devices; i++) {
      const list = await request('device.list', { cursor: 0 });
      if (list.trackChannelId === control.channelId && list.count === list.itemCount && prior && JSON.stringify(list) === JSON.stringify(prior)) devices = list;
      prior = list; await pause();
    }
    assert.ok(devices, 'cursor-did-not-settle'); check.devices = devices;
    const grid = (devices.devices as Wire[]).find(d => d.name === 'Poly Grid'); assert.ok(grid, 'control-grid-required');
    const semantic = load(join(ROOT, 'context/evidence/data/phase9a-grid-read/semantic-query.json')).projection;
    const e276 = load(join(ROOT, 'context/evidence/data/phase9a-grid-read/live-23-semantic-baseline/capture-0.json')).graph;
    check.control = await readSurvey(request, { project: PROJECT, trackId: control.channelId, trackName: control.name,
      deviceIndex: grid.index, deviceName: grid.name }, semantic, (name, value) => save(`control-${name}`, value), e276);
    check.selectionAfter = await request('selection.status');
    check.mixer = await request('track.mixer', { tracks: (check.tracks.tracks as Wire[]).map(t => ({ trackIndex: t.index, channelId: t.channelId })) });
    check.statusAfter = await request('probe.gridRead', { operation: 'status' });
    check.calls = calls.length;
    save('baseline-check', check);
    requireBaseline(check);
    const result: Wire = { verdict: 'baseline-confirmed', calls: calls.length, project: PROJECT,
      tracks: (check.tracks.tracks as Wire[]).map(t => t.name), initialization: new Date(stats.initEpochMs).toISOString() };
    if (priorPath) {
      const prior = load(priorPath);
      assert.deepEqual(comparable(check), comparable(prior), 'baseline-differs-from-prior-check');
      result.priorCheck = priorPath; result.priorAgrees = true;
    }
    save('result', result); console.log(JSON.stringify(result)); return result;
  } catch (error) {
    save('failure', { error: String(error) }); throw error;
  } finally {
    save('calls', { calls, count: calls.length, wireMs: calls.reduce((n, c) => n + c.ms, 0) });
    client.disconnect();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [output, prior] = process.argv.slice(2);
  assert.ok(process.argv.length === 3 || process.argv.length === 4, 'argv: <output> [prior baseline-check.json]');
  await runBaselineCheck(output!, prior);
}
