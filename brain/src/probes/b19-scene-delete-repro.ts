/**
 * Check whether back-to-back delete_scene calls hit the wrong rows while earlier deletions are still pending, as
 * back-to-back delete_track calls did (b19-delete-repro.ts). The operator allowed scratch tracks, scenes, and clips in
 * `gn-scale-test` (2026-11-08).
 *
 *   run <project> <tracks> <rows> <perCall> <calls>
 *       Add <tracks> scratch tracks gn-sr-NN and <rows> scratch scenes after the entry scenes. Scenes have no
 *       identity, so each scratch row carries one: its index among the scratch rows, in binary, as clips on the first
 *       scratch tracks; every other scratch track holds a clip in every scratch row to make the deletion heavy. Then
 *       delete scratch rows 0..perCall*calls-1 in <calls> back-to-back calls of <perCall>, each computing its rows
 *       from the listing just before it, and poll until the listing has not changed for 60 s. Report which row
 *       identities survived; only the targets should be gone.
 *   cleanup <project>
 *       Delete the scratch tracks in awaited calls of 16 and every scene after the entry scenes, then check entry.
 *
 * Every misdirected delete can only hit a row below its target, and every row below the entry rows is scratch.
 * State: /tmp/b19/scene-repro.json. Output: JSON lines on stdout.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { readGolden } from '../tools/wire-golden.js';
import { WireTransport } from './phase8h3c-promotion.js';

type Wire = Record<string, any>;
const STATE = '/tmp/b19/scene-repro.json';
const PREFIX = 'gn-sr-';
const [mode, expectedProject, ...rest] = process.argv.slice(2);
if ((mode !== 'run' && mode !== 'cleanup') || expectedProject === undefined) {
  throw new Error('Usage: b19-scene-delete-repro.ts run <project> <tracks> <rows> <perCall> <calls> | cleanup <project>');
}
const golden = readGolden();
const transport = new WireTransport();
const adapter = new LiveAdapter({ transport, expectRuntimeProfile: golden.identity, expectMethodsHash: golden.methodsHash });
const workspace = workspaceOf({
  ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
  observationStore: new FakeObservationStore(),
});
const t0 = performance.now();
const out = (entry: Wire): void => console.log(JSON.stringify({ at: Math.round(performance.now() - t0), ...entry }));
const raw = async (method: string, params?: Wire): Promise<Wire> =>
  await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
const call = async (name: string, args: Wire): Promise<Wire> =>
  await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
const must = async (name: string, args: Wire): Promise<Wire> => {
  const result = await call(name, args);
  if (result.failure !== undefined) throw new Error(`${name}: ${JSON.stringify(result.failure).slice(0, 800)}`);
  return result;
};
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

await adapter.hello();
const project = (await must('check_bitwig_connection', {})).data.project;
assert.equal(project, expectedProject, `foreground project is ${project}`);

if (mode === 'run') {
  const [tracksArg, rowsArg, perCallArg, callsArg] = rest.map(Number);
  const nTracks = tracksArg!; const nRows = rowsArg!; const perCall = perCallArg!; const calls = callsArg!;
  const bits = Math.ceil(Math.log2(nRows));
  assert.ok(nTracks > bits && perCall * calls < nRows, 'arguments');
  const entry = await raw('slot.occupancy');
  assert.ok(!(entry.tracks as Wire[]).some((t) => String(t.name).startsWith(PREFIX)), 'scratch names already exist');
  const entrySceneCount = entry.sceneCount as number;
  assert.ok(entrySceneCount + nRows <= entry.sceneBankSize, 'rows exceed the scene bank');
  const state: Wire = { project, entryTracks: (entry.tracks as Wire[]).map((t) => ({ id: t.channelId, name: t.name })),
    entrySceneCount, trackIds: [] };
  const save = async (): Promise<void> => {
    await mkdir('/tmp/b19', { recursive: true });
    await writeFile(STATE, JSON.stringify(state, null, 1));
  };
  await save();
  for (let i = 0; i < nTracks; i += 16) {
    const names = Array.from({ length: Math.min(16, nTracks - i) }, (_, k) => `${PREFIX}${String(i + k).padStart(2, '0')}`);
    const added = await must('add_tracks', { tracks: names.map((name) => ({ name })) });
    state.trackIds.push(...(added.readback.tracks as Wire[]).map((t) => t.trackId));
    await save();
  }
  await must('add_scenes', { count: nRows });
  const ids = state.trackIds as string[];
  const scratchTracks = (): Promise<Wire[]> => raw('slot.occupancy').then((r) =>
    ids.map((id) => (r.tracks as Wire[]).find((t) => t.channelId === id)!));
  const placed = await scratchTracks();
  const cells: Wire[] = [];
  for (let row = 0; row < nRows; row++) {
    placed.forEach((t, k) => {
      if (k >= bits || ((row >> k) & 1) === 1) cells.push({ trackIndex: t.index, slotIndex: entrySceneCount + row });
    });
  }
  for (let i = 0; i < cells.length; i += 64) {
    await Promise.all(cells.slice(i, i + 64).map((cell) => raw('clip.create', { ...cell, lengthBeats: 4 })));
  }
  let filled = 0;
  for (const deadline = performance.now() + Math.max(120_000, cells.length * 25); performance.now() < deadline;) {
    filled = (await scratchTracks()).reduce((sum, t) => sum + (t.occupied as number[]).length, 0);
    if (filled === cells.length) break;
    await sleep(1000);
  }
  out({ step: 'setup', tracks: nTracks, rows: nRows, clips: cells.length, filled });
  assert.equal(filled, cells.length, 'every scratch cell holds a clip');

  /** The identity of every scratch row now: row index -> identity, or -1 when a row matches no pattern. */
  const identities = async (): Promise<{ count: number; ids: number[] }> => {
    const r = await raw('slot.occupancy');
    const tracks = ids.map((id) => (r.tracks as Wire[]).find((t) => t.channelId === id)!);
    const count = (r.sceneCount as number) - entrySceneCount;
    return { count, ids: Array.from({ length: count }, (_, row) => {
      const at = entrySceneCount + row;
      if (tracks.slice(bits).some((t) => !(t.occupied as number[]).includes(at))) return -1;
      return tracks.slice(0, bits).reduce((sum, t, k) => sum + ((t.occupied as number[]).includes(at) ? 1 << k : 0), 0);
    }) };
  };
  const start = await identities();
  assert.deepEqual(start.ids, Array.from({ length: nRows }, (_, k) => k), 'every scratch row carries its identity');

  // Delete identities [c*perCall, (c+1)*perCall) in call c, highest group first, back to back.
  for (let c = calls - 1; c >= 0; c--) {
    const wanted = Array.from({ length: perCall }, (_, k) => c * perCall + k);
    const now = await identities();
    const rows = wanted.map((id) => now.ids.indexOf(id)).filter((row) => row >= 0).map((row) => entrySceneCount + row);
    const started = performance.now();
    const result = await call('delete_scene', { rows });
    out({ step: 'delete-call', identities: wanted, rows, ms: Math.round(performance.now() - started),
      failure: result.failure?.code, readback: result.readback?.status, scenes: result.readback?.scenes });
  }
  let last = JSON.stringify(await identities());
  let lastChange = performance.now();
  while (performance.now() - lastChange < 60_000 && performance.now() - t0 < 30 * 60_000) {
    await sleep(1000);
    const now = await identities();
    const key = JSON.stringify(now);
    if (key !== last) { out({ step: 'change', count: now.count, ids: now.ids }); lastChange = performance.now(); }
    last = key;
  }
  const final = JSON.parse(last) as { count: number; ids: number[] };
  const targets = perCall * calls;
  out({ step: 'summary', survivors: final.ids,
    targetsSurviving: final.ids.filter((id) => id >= 0 && id < targets),
    keepersDeleted: Array.from({ length: nRows - targets }, (_, k) => targets + k).filter((id) => !final.ids.includes(id)),
    settledAfterMs: Math.round(lastChange - t0) });
} else {
  const state = JSON.parse(await readFile(STATE, 'utf8')) as Wire;
  assert.equal(state.project, project, 'state file names this project');
  const owned = new Set<string>(state.trackIds);
  const left = async (): Promise<string[]> =>
    ((await raw('slot.occupancy')).tracks as Wire[]).filter((t) => owned.has(t.channelId)).map((t) => t.channelId);
  for (let now = await left(); now.length > 0; now = await left()) {
    const batch = now.slice(0, 16);
    const result = await call('delete_track', { trackIds: batch });
    let after = now.length;
    for (const deadline = performance.now() + 120_000; performance.now() < deadline;) {
      after = (await left()).length;
      if (after <= now.length - batch.length) break;
      await sleep(1000);
    }
    out({ step: 'cleanup-tracks', sent: batch.length, before: now.length, after, readback: result.readback?.status });
    assert.ok(after <= now.length - batch.length, 'a cleanup batch did not land; inspect before continuing');
  }
  const count = (await raw('slot.occupancy')).sceneCount as number;
  if (count > state.entrySceneCount) {
    const rows = Array.from({ length: count - state.entrySceneCount }, (_, k) => state.entrySceneCount + k);
    const result = await call('delete_scene', { rows });
    for (const deadline = performance.now() + 120_000; performance.now() < deadline;) {
      if ((await raw('slot.occupancy')).sceneCount === state.entrySceneCount) break;
      await sleep(1000);
    }
    out({ step: 'cleanup-scenes', rows: rows.length, readback: result.readback?.status });
  }
  const end = await raw('slot.occupancy');
  const endTracks = (end.tracks as Wire[]).map((t) => ({ id: t.channelId, name: t.name }));
  out({ step: 'cleanup', matchesEntry: JSON.stringify(endTracks) === JSON.stringify(state.entryTracks),
    sceneCount: end.sceneCount, entrySceneCount: state.entrySceneCount,
    clips: (end.tracks as Wire[]).reduce((n, t) => n + (t.occupied as number[]).length, 0) });
}
await transport.close?.();
