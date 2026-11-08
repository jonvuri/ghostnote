/** P01 metadata-only clip reads, live: set_launcher_clip_properties and set_launcher_clip_launch_settings through MCP
 * dispatch on one scratch track with one typical clip and eight clips of 16,384 notes. Each write and each revert is
 * read back through a separate `clip.read` capture (notes, metadata and launch of each clip) and compared with the
 * tool's readback; the scratch track and any added scenes are removed. The track list, the scene count and the
 * selection must match the baseline. Brain code only; run probe:hello first and confirm the normal build is loaded.
 * node --import tsx src/probes/p01-clip-metadata-live.ts --out NEW_DIRECTORY --operator-file FILE [--project gn-scale-test]
 * Stop on uncertain effects; never auto-retry writes.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import {
  addressKey, clip as clipAt, clipLaunch, clipMetadata, notes as notesAt, scene as sceneAt, slot as slotAt,
  track as trackAt,
} from '../contract/index.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { readGolden } from '../tools/wire-golden.js';
import { WireTransport } from './phase8h3c-promotion.js';
import { typicalDesired, worstDesired } from './phase8h4g-inventory.js';

type Wire = Record<string, any>;
const { values } = parseArgs({ options: {
  out: { type: 'string' }, 'operator-file': { type: 'string' },
  project: { type: 'string', default: 'gn-scale-test' },
} });
assert(values.out && values['operator-file'], 'required: --out NEW_DIRECTORY --operator-file FILE');
const operator = JSON.parse(readFileSync(values['operator-file'], 'utf8')) as Wire;
assert(typeof operator.reply === 'string' && operator.reply.trim(), 'record the actual operator confirmation');
mkdirSync(values.out, { recursive: false });

const transport = new WireTransport();
const golden = readGolden();
const adapter = new LiveAdapter({ transport, expectRuntimeProfile: golden.identity, expectMethodsHash: golden.methodsHash });
const workspace = workspaceOf({ ready: async () => undefined, adapter, executor: new Executor(adapter),
  stash: new Stash(), observationStore: new FakeObservationStore(), documents: new IdentityRegistry() });
const scratchName = 'gn-p01-clipmeta';
const LARGE_ROWS = [0, 1, 2, 3, 4, 5, 6, 7];
const TYPICAL_ROW = 8;
let scratchId: string | undefined;
let scenesBefore: number | undefined;
let sequence = 0;
const record = (label: string, value: unknown, compressed = false) => {
  const path = join(values.out!, `${String(sequence++).padStart(3, '0')}-${label}.json`);
  const text = JSON.stringify(value, null, compressed ? undefined : 2) + '\n';
  writeFileSync(path + (compressed ? '.gz' : ''), compressed ? gzipSync(text) : text);
  console.log(label);
};
const request = async (method: string, params?: Wire): Promise<Wire> => await transport.send({ method, params }) as Wire;
const selectionFields = (s: Wire) => Object.fromEntries(
  ['project', 'trackIndex', 'slotIndex', 'mixerTrackIndex', 'mixerChannelId'].map(k => [k, s[k]]));

/** Refuse a write while another probe driver or bridge client is active. */
function checkClients(): void {
  const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf8' }).trim().split('\n')
    .map(line => { const m = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/)!;
      return { pid: Number(m[1]), ppid: Number(m[2]), command: m[3]! }; });
  const ancestors = new Set([process.pid]);
  for (let pid = process.ppid; pid > 1;) {
    ancestors.add(pid);
    const row = rows.find(p => p.pid === pid);
    if (!row) break;
    pid = row.ppid;
  }
  const drivers = rows.filter(p => !ancestors.has(p.pid) && /src\/probes\/.*\.[cm]?[jt]s(?:\s|$)/.test(p.command)
    && !/\.test\.[cm]?[jt]s/.test(p.command));
  let sockets = '';
  try {
    sockets = execFileSync('lsof', ['-nP', '-iTCP:8686', '-sTCP:ESTABLISHED', '-Fp'], { encoding: 'utf8' });
  } catch { /* lsof exits 1 when nothing matches */ }
  const clients = [...new Set(sockets.split('\n').filter(s => /^p\d+$/.test(s)).map(s => Number(s.slice(1))))]
    .filter(pid => pid !== process.pid).map(pid => rows.find(p => p.pid === pid)).filter(p => p !== undefined)
    .filter(p => !p.command.includes('BitwigStudio'));
  assert.equal(drivers.length, 0, `competing probe driver: ${JSON.stringify(drivers)}`);
  assert.equal(clients.length, 0, `another bridge client is connected: ${JSON.stringify(clients)}`);
}
async function beforeWrite(): Promise<void> {
  checkClients();
  const mark = await request('revision.get');
  assert.equal(mark.project, values.project);
  const tracks = await request('track.list');
  if (scratchId) assert.equal(tracks.tracks.find((t: Wire) => t.channelId === scratchId)?.name, scratchName);
  else assert(!tracks.tracks.some((t: Wire) => t.name === scratchName));
}
async function tool(label: string, name: string, args: Wire = {}, write = false, verified = true)
  : Promise<{ result: Wire; measurement: Wire }> {
  if (write) await beforeWrite();
  const from = transport.calls.length, started = performance.now();
  const result = await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const calls = transport.calls.slice(from);
  const methods: Record<string, number> = {};
  for (const call of calls) methods[call.method] = (methods[call.method] ?? 0) + 1;
  const measurement = { ms: Math.round(performance.now() - started), turns: calls.length,
    bytes: calls.reduce((n, c) => n + c.bytes, 0), methods };
  record(label, { name, args, ...measurement, result, calls: calls.map(({ method, sent, received, bytes }) => ({ method, ms: received - sent, bytes })) },
    true);
  assert.equal(result.failure, undefined, JSON.stringify(result).slice(0, 2000));
  if (verified && result.readback?.status !== undefined) {
    assert.equal(result.readback.status, 'verified', JSON.stringify(result).slice(0, 2000));
  }
  return { result, measurement };
}

/** The metadata and launch settings of each row, read through a separate full `clip.read` capture. */
async function captured(label: string, rows: readonly number[]): Promise<Map<number, Wire>> {
  const at = await adapter.revision();
  const of = (row: number) => clipAt(slotAt(trackAt(scratchId!), sceneAt(row, at.sceneEpoch)));
  const read = await adapter.preserveSelection(() => adapter.read(rows.flatMap(row =>
    [clipMetadata(of(row)), clipLaunch(of(row)), notesAt(of(row), 0)])));
  const out = new Map<number, Wire>();
  for (const row of rows) {
    const metadata = read.entries[addressKey(clipMetadata(of(row)))]?.value;
    const launch = read.entries[addressKey(clipLaunch(of(row)))]?.value;
    const notes = read.entries[addressKey(notesAt(of(row), 0))]?.value;
    assert(metadata?.of === 'clipMetadata' && launch?.of === 'clipLaunch' && notes?.of === 'notes', `${label} row ${row}`);
    out.set(row, { metadata: metadata.metadata, launch: launch.launch, channel1: notes.notes.length });
  }
  record(label, Object.fromEntries(out));
  return out;
}

/** A properties case: write, compare the tool readback with a capture, revert, and compare the capture again. */
async function propertiesCase(label: string, rows: readonly number[], properties: (row: number) => Wire): Promise<Wire> {
  const before = await captured(`${label}-before`, rows);
  const set = await tool(`${label}-set`, 'set_launcher_clip_properties', { clips: rows.map(row => ({
    trackId: scratchId, row, properties: properties(row) })) }, true);
  const after = await captured(`${label}-after`, rows);
  for (const item of set.result.readback.clips as Wire[]) {
    assert.deepEqual(item.properties, after.get(item.row)!.metadata, `${label} row ${item.row}: readback and capture`);
    for (const [field, value] of Object.entries(properties(item.row))) {
      if (field !== 'color') assert.deepEqual(after.get(item.row)!.metadata[field], value, `${label} ${field}`);
    }
    assert.equal(after.get(item.row)!.channel1, before.get(item.row)!.channel1, `${label} notes unchanged`);
  }
  const revert = await tool(`${label}-revert`, 'revert_change', { changeId: set.result.next.revert.changeId }, true);
  const restored = await captured(`${label}-restored`, rows);
  // D42: Bitwig can store a written colour byte one off, so a reverted colour matches within one byte.
  const colourWritten = rows.some(row => 'color' in properties(row));
  for (const row of rows) {
    const [was, now] = [before.get(row)!, restored.get(row)!];
    if (colourWritten) {
      for (const k of ['red', 'green', 'blue']) {
        assert(Math.abs(now.metadata.color[k] - was.metadata.color[k]) <= 1, `${label} row ${row} colour ${k}`);
      }
      assert.deepEqual({ ...now, metadata: { ...now.metadata, color: null } },
        { ...was, metadata: { ...was.metadata, color: null } }, `${label} row ${row} restored`);
    } else assert.deepEqual(now, was, `${label} row ${row} restored`);
  }
  return { label, clips: rows.length, set: set.measurement, revert: revert.measurement };
}

/** A launch-settings case, checked the same way. */
async function launchCase(label: string, rows: readonly number[]): Promise<Wire> {
  const before = await captured(`${label}-before`, rows);
  const set = await tool(`${label}-set`, 'set_launcher_clip_launch_settings', { clips: rows.map(row => ({
    trackId: scratchId, row, quantization: '1', mode: 'synced' })) }, true);
  const after = await captured(`${label}-after`, rows);
  for (const item of set.result.readback.clips as Wire[]) {
    assert.deepEqual(item.launch, after.get(item.row)!.launch, `${label} row ${item.row}: readback and capture`);
    assert.deepEqual([item.launch.quantization, item.launch.mode], ['1', 'synced']);
    assert.deepEqual(after.get(item.row)!.metadata, before.get(item.row)!.metadata, `${label} metadata unchanged`);
  }
  const revert = await tool(`${label}-revert`, 'revert_change', { changeId: set.result.next.revert.changeId }, true);
  const restored = await captured(`${label}-restored`, rows);
  for (const row of rows) assert.deepEqual(restored.get(row), before.get(row), `${label} row ${row} restored`);
  return { label, clips: rows.length, set: set.measurement, revert: revert.measurement };
}

try {
  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash],
    [golden.identity, golden.count, golden.methodsHash]);
  const rig = await request('rig.info');
  assert.equal(rig.windowWriteBlock ?? null, null, 'no write block');
  const stats = await request('rig.stats');
  record('entry', { operator, hello, stats, rig });
  await adapter.hello();
  assert.equal((await tool('connection', 'check_bitwig_connection')).result.target.project, values.project);
  const beforeTracks = await request('track.list'), selected = await request('selection.status');
  scenesBefore = (await adapter.revision()).window.scenes.count;
  record('baseline', { beforeTracks, selected, scenesBefore });

  const added = await tool('scratch', 'add_tracks', { tracks: [{ name: scratchName }] }, true);
  scratchId = added.result.readback.tracks[0].trackId;
  assert.equal(typeof scratchId, 'string'); record('owned', { scratchId });
  if (scenesBefore! <= TYPICAL_ROW) await tool('add-scenes', 'add_scenes', { count: TYPICAL_ROW + 1 - scenesBefore! }, true);
  await tool('add-typical', 'add_launcher_clip', { trackId: scratchId, row: TYPICAL_ROW, document: typicalDesired() }, true);
  const large = worstDesired(16_384);
  for (const row of LARGE_ROWS) await tool(`add-large-${row}`, 'add_launcher_clip', { trackId: scratchId, row, document: large }, true);

  const results: Wire[] = [];
  results.push(await propertiesCase('typical-name', [TYPICAL_ROW], () => ({ name: 'gn-p01-renamed' })));
  results.push(await propertiesCase('typical-colour-length', [TYPICAL_ROW], () => ({
    color: { red: 200, green: 40, blue: 120 }, lengthBeats: 32 })));
  results.push(await launchCase('typical-launch', [TYPICAL_ROW]));
  results.push(await propertiesCase('large-name-1', [0], () => ({ name: 'gn-p01-large' })));
  results.push(await propertiesCase('large-name-8', LARGE_ROWS, row => ({ name: `gn-p01-large-${row}` })));
  results.push(await launchCase('large-launch-8', LARGE_ROWS));
  // An unchanged request writes nothing.
  const current = (await captured('noop-before', [TYPICAL_ROW])).get(TYPICAL_ROW)!.metadata.name;
  const noop = await tool('typical-noop', 'set_launcher_clip_properties', { clips: [{ trackId: scratchId, row: TYPICAL_ROW,
    properties: { name: current } }] }, true, false);
  assert.equal(noop.result.applied, false); assert.equal(noop.result.readback.status, 'unchanged');
  results.push({ label: 'typical-noop', clips: 1, set: noop.measurement });

  // A track with eight large clips can leave the track list after the tool's readback (readback differs).
  const cleanup = await tool('cleanup', 'delete_track', { trackIds: [scratchId] }, true, false);
  assert(['verified', 'differs'].includes(cleanup.result.readback.status), JSON.stringify(cleanup.result));
  const deadline = performance.now() + 30_000;
  while ((await request('track.list')).tracks.some((t: Wire) => t.channelId === scratchId)) {
    assert(performance.now() < deadline, 'the scratch track is still listed 30 s after its deletion');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  results.push({ label: 'cleanup', status: cleanup.result.readback.status, set: cleanup.measurement,
    removedAfterMs: Math.round(performance.now() - deadline + 30_000) });
  scratchId = undefined;
  const scenes = (await adapter.revision()).window.scenes.count;
  if (scenes > scenesBefore!) {
    await tool('cleanup-scenes', 'delete_scene', { rows: Array.from({ length: scenes - scenesBefore! },
      (_, index) => scenesBefore! + index) }, true);
  }
  const afterTracks = await request('track.list'); assert.deepEqual(afterTracks.tracks, beforeTracks.tracks);
  assert.equal((await adapter.revision()).window.scenes.count, scenesBefore);
  const afterSelection = await request('selection.status');
  // With no prior slot selection the adapter cannot clear the slot selection (`no-prior`); compare the mixer only.
  const compared = (s: Wire) => selected.trackIndex < 0 ? { ...selectionFields(s), trackIndex: null, slotIndex: null }
    : selectionFields(s);
  assert.deepEqual(compared(afterSelection), compared(selected));
  record('result', { passed: true, cleanup: true, results, afterTracks, afterSelection });
  for (const item of results) {
    console.log(`${item.label}: set ${item.set.ms} ms / ${item.set.turns} turns`
      + (item.revert === undefined ? '' : `; revert ${item.revert.ms} ms / ${item.revert.turns} turns`));
  }
} catch (error) {
  record('stopped', { scratchId, scratchName, scenesBefore, error: String(error),
    next: 'Inspect effects before any further write; never repeat automatically.' });
  for (const method of ['track.list', 'selection.status', 'rig.info']) {
    try { record(method.replace('.', '-'), await request(method)); } catch { /* retain original error */ }
  }
  throw error;
} finally { await transport.close(); }
