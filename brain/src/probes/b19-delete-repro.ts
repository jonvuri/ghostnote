/**
 * Reproduce the dropped `delete_track` deletions seen in E414's teardown. The operator allowed scratch tracks and
 * clips in `gn-scale-test` (2026-11-08).
 *
 *   run <project> <delete> <keep> <scenes> <callSize> [gapMs] [tool|raw]
 *       Add <delete> target tracks gn-dr-dNN, then <keep> canary tracks gn-dr-kNN after them. When <scenes> > 0,
 *       raise the project to <scenes> scenes and fill every scratch slot below it with a clip, and wait until all
 *       are present. Then send delete_track for the targets in calls of <callSize>, <gapMs> apart (default 0, back to
 *       back), recording each call's readback and the track.delete frames it sent. Then poll slot.occupancy until
 *       the listing has not changed for 120 s, logging each change, and report which targets, canaries, and entry
 *       tracks are gone. Route `raw` sends each call as one batch.run of guarded track.delete frames (highest index
 *       first, indices from a track.list just before), without the tool's wait, to test the extension guard alone.
 *   cleanup <project>
 *       Delete the remaining scratch tracks in awaited calls of 16 and the added scenes, then check entry.
 *
 * State: /tmp/b19/delete-repro.json. Output: JSON lines on stdout.
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
const STATE = '/tmp/b19/delete-repro.json';
const PREFIX = 'gn-dr-';
const [mode, expectedProject, ...rest] = process.argv.slice(2);
if ((mode !== 'run' && mode !== 'cleanup') || expectedProject === undefined) {
  throw new Error('Usage: b19-delete-repro.ts run <project> <delete> <keep> <scenes> <callSize> [gapMs] | cleanup <project>');
}
const golden = readGolden();
const transport = new WireTransport();
const adapter = new LiveAdapter({ transport, expectRuntimeProfile: golden.identity, expectMethodsHash: golden.methodsHash });
const workspace = workspaceOf({
  ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
  observationStore: new FakeObservationStore(),
});
const t0 = performance.now();
const at = (): number => Math.round(performance.now() - t0);
const out = (entry: Wire): void => console.log(JSON.stringify({ at: at(), ...entry }));
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
const listing = async (): Promise<Wire[]> =>
  ((await raw('slot.occupancy')).tracks as Wire[]).map((t) => ({ id: t.channelId, name: t.name, index: t.index }));

/** track.delete frames sent since call index `from`, with their bank index; also inside batch.run. */
const deleteFrames = (from: number): Wire[] => transport.calls.slice(from).flatMap((c: Wire) => {
  const frame = c.request ?? c.frame ?? c;
  const method = frame.method ?? c.method;
  const params = frame.params ?? c.params;
  if (method === 'track.delete') return [{ trackIndex: params?.trackIndex }];
  if (method === 'batch.run') {
    return ((params?.ops ?? []) as Wire[]).filter((op) => op.method === 'track.delete')
      .map((op) => ({ trackIndex: op.params?.trackIndex }));
  }
  return [];
});

await adapter.hello();
const project = (await must('check_bitwig_connection', {})).data.project;
assert.equal(project, expectedProject, `foreground project is ${project}`);

if (mode === 'run') {
  const [deleteArg, keepArg, scenesArg, callArg, gapArg, routeArg] = rest;
  const route = routeArg ?? 'tool';
  assert.ok(route === 'tool' || route === 'raw', 'route is tool or raw');
  const nDelete = Number(deleteArg); const nKeep = Number(keepArg); const scenes = Number(scenesArg);
  const callSize = Number(callArg); const gapMs = Number(gapArg ?? 0);
  assert.ok([nDelete, nKeep, scenes, callSize, gapMs].every((n) => Number.isInteger(n) && n >= 0) && nDelete > 0
    && callSize > 0, 'arguments');
  const entry = await raw('slot.occupancy');
  const entryTracks = (entry.tracks as Wire[]).map((t) => ({ id: t.channelId, name: t.name }));
  assert.ok(!entryTracks.some((t) => String(t.name).startsWith(PREFIX)), 'scratch names already exist');
  const state: Wire = { project, entryTracks, entrySceneCount: entry.sceneCount, addedScenes: 0, deleteIds: [], keepIds: [] };
  const save = async (): Promise<void> => {
    await mkdir('/tmp/b19', { recursive: true });
    await writeFile(STATE, JSON.stringify(state, null, 1));
  };
  await save();
  const names = [
    ...Array.from({ length: nDelete }, (_, k) => `${PREFIX}d${String(k).padStart(2, '0')}`),
    ...Array.from({ length: nKeep }, (_, k) => `${PREFIX}k${String(k).padStart(2, '0')}`),
  ];
  for (let i = 0; i < names.length; i += 16) {
    const added = await must('add_tracks', { tracks: names.slice(i, i + 16).map((name) => ({ name })) });
    for (const t of added.readback.tracks as Wire[]) {
      (String(t.name).startsWith(`${PREFIX}d`) ? state.deleteIds : state.keepIds).push(t.trackId);
    }
    await save();
  }
  if (scenes > entry.sceneCount) {
    await must('add_scenes', { count: scenes - entry.sceneCount });
    state.addedScenes = scenes - entry.sceneCount;
    await save();
  }
  const owned = new Set<string>([...state.deleteIds, ...state.keepIds]);
  const before = await listing();
  out({ step: 'tracks', positions: before.map((t) => `${t.index}:${t.name}`) });
  if (scenes > 0) {
    const cells = before.filter((t) => owned.has(t.id))
      .flatMap((t) => Array.from({ length: scenes }, (_, slotIndex) => ({ trackIndex: t.index, slotIndex })));
    for (let i = 0; i < cells.length; i += 64) {
      await Promise.all(cells.slice(i, i + 64).map((cell) => raw('clip.create', { ...cell, lengthBeats: 4 })));
    }
    out({ step: 'clips-sent', cells: cells.length });
    let filled = 0;
    for (const deadline = performance.now() + Math.max(120_000, cells.length * 25); performance.now() < deadline;) {
      filled = ((await raw('slot.occupancy')).tracks as Wire[]).filter((t) => owned.has(t.channelId))
        .reduce((sum, t) => sum + (t.occupied as number[]).length, 0);
      if (filled === cells.length) break;
      await sleep(1000);
    }
    out({ step: 'clips-landed', filled, cells: cells.length });
    assert.equal(filled, cells.length, 'every scratch slot holds a clip');
  }

  // The deletes: back to back unless gapMs, as E414's teardown sent them.
  const ids = state.deleteIds as string[];
  const nameOf = new Map(before.map((t) => [t.id, t.name]));
  for (let i = 0; i < ids.length; i += callSize) {
    const slice = ids.slice(i, i + callSize);
    const from = transport.calls.length;
    const started = performance.now();
    let result: Wire;
    if (route === 'tool') {
      result = await call('delete_track', { trackIds: slice });
    } else {
      const bank = (await raw('track.list')).tracks as Wire[];
      const ops = slice.map((id) => ({ id, index: bank.find((t) => t.channelId === id)?.index as number }))
        .filter((item) => item.index !== undefined).sort((x, y) => y.index - x.index)
        .map((item) => ({ method: 'track.delete', params: { trackIndex: item.index, expectedChannelId: item.id } }));
      const reply = await raw('batch.run', { ops, verbose: true });
      result = { applied: true, readback: { status: 'raw' },
        warnings: ((reply.results ?? []) as Wire[]).filter((r) => r.ok === false).map((r) => ({ code: String(r.error).slice(0, 120) })) };
    }
    const frames = deleteFrames(from);
    out({
      step: 'delete-call', names: slice.map((id) => nameOf.get(id)), ms: Math.round(performance.now() - started),
      failure: result.failure?.code, applied: result.applied, readback: result.readback?.status,
      removed: (result.readback?.removed ?? []).length, warnings: (result.warnings ?? []).map((w: Wire) => w.code),
      frames: frames.map((f) => f.trackIndex),
    });
    if (gapMs > 0) await sleep(gapMs);
  }

  // Watch until the listing has not changed for 120 s, or 30 minutes.
  let last = await listing();
  let lastChange = performance.now();
  const watchEnd = performance.now() + 30 * 60_000;
  while (performance.now() - lastChange < 120_000 && performance.now() < watchEnd) {
    await sleep(1000);
    const now = await listing();
    const gone = last.filter((t) => !now.some((n) => n.id === t.id)).map((t) => t.name);
    const added = now.filter((t) => !last.some((l) => l.id === t.id)).map((t) => t.name);
    if (gone.length > 0 || added.length > 0) {
      out({ step: 'change', gone, added, count: now.length });
      lastChange = performance.now();
    }
    last = now;
  }
  const present = new Set(last.map((t) => t.id));
  const summary = {
    step: 'summary',
    targetsDeleted: ids.filter((id) => !present.has(id)).length,
    targetsRemaining: ids.filter((id) => present.has(id)).map((id) => nameOf.get(id)),
    canariesDeleted: (state.keepIds as string[]).filter((id) => !present.has(id)).map((id) => nameOf.get(id)),
    entryMissing: (state.entryTracks as Wire[]).filter((t) => !present.has(t.id)).map((t) => t.name),
    settledAfterMs: Math.round(lastChange - t0),
  };
  out(summary);
} else {
  const state = JSON.parse(await readFile(STATE, 'utf8')) as Wire;
  assert.equal(state.project, project, 'state file names this project');
  const owned = new Set<string>([...state.deleteIds, ...state.keepIds]);
  for (;;) {
    const left = (await listing()).filter((t) => owned.has(t.id)).map((t) => t.id);
    if (left.length === 0) break;
    const batch = left.slice(0, 16);
    const result = await call('delete_track', { trackIds: batch });
    let now = left.length;
    for (const deadline = performance.now() + 120_000; performance.now() < deadline;) {
      now = (await listing()).filter((t) => owned.has(t.id)).length;
      if (now <= left.length - batch.length) break;
      await sleep(1000);
    }
    out({ step: 'cleanup-call', sent: batch.length, before: left.length, after: now,
      failure: result.failure?.code, readback: result.readback?.status });
    assert.ok(now <= left.length - batch.length, 'a cleanup batch did not land; inspect before continuing');
  }
  if (state.addedScenes > 0) {
    await must('delete_scene', { rows: Array.from({ length: state.addedScenes }, (_, k) => state.entrySceneCount + k) });
    for (const deadline = performance.now() + 120_000; performance.now() < deadline;) {
      if ((await raw('slot.occupancy')).sceneCount === state.entrySceneCount) break;
      await sleep(1000);
    }
  }
  const end = await raw('slot.occupancy');
  const endTracks = (end.tracks as Wire[]).map((t) => ({ id: t.channelId, name: t.name }));
  out({ step: 'cleanup', matchesEntry: JSON.stringify(endTracks) === JSON.stringify(state.entryTracks),
    sceneCount: end.sceneCount, entrySceneCount: state.entrySceneCount });
}
await transport.close?.();
