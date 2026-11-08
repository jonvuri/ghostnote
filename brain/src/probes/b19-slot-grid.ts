/**
 * B19 session 2: build and remove a scratch grid for the `slot.occupancy` live check. The operator allowed scratch
 * tracks and clips in `gn-scale-test` (2026-11-08).
 *
 *   setup <project> <tracks> <scenes>  add <tracks> instrument tracks named gn-b19-NNN with add_tracks, raise the
 *                                      project to <scenes> scenes with add_scenes, and fill every scratch slot below
 *                                      <scenes> with a raw `clip.create` (about 8 ms each, E405), after confirming
 *                                      each track index by channelId. The owned IDs go to the state file.
 *   teardown <project>                 delete the owned tracks with delete_track and the added scenes with
 *                                      delete_scene, then check that the track list and scene count equal entry.
 *
 * Both host effects land after the requests return (E414), so each phase waits for the listing to show them.
 * State: /tmp/b19/grid-state.json. Writes only to owned tracks and added scenes.
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
const STATE = '/tmp/b19/grid-state.json';
const PREFIX = 'gn-b19-';
const CHUNK = 64;
const [mode, expectedProject, tracksArg, scenesArg] = process.argv.slice(2);
if ((mode !== 'setup' && mode !== 'teardown') || expectedProject === undefined) {
  throw new Error('Usage: b19-slot-grid.ts setup <project> <tracks> <scenes> | teardown <project>');
}
const golden = readGolden();
const transport = new WireTransport();
const adapter = new LiveAdapter({ transport, expectRuntimeProfile: golden.identity, expectMethodsHash: golden.methodsHash });
const workspace = workspaceOf({
  ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
  observationStore: new FakeObservationStore(),
});
const raw = async (method: string, params?: Wire): Promise<Wire> =>
  await transport.sendRecorded({ method, ...(params ? { params } : {}) }) as Wire;
const call = async (name: string, args: Wire): Promise<Wire> => {
  const result = await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  if (result.failure !== undefined) throw new Error(`${name}: ${JSON.stringify(result.failure).slice(0, 800)}`);
  return result;
};
const note = (entry: Wire): void => console.error(JSON.stringify(entry));
const trackKey = async (): Promise<string> =>
  JSON.stringify(((await call('list_tracks', {})).data.tracks as Wire[]).map((t) => [t.trackId, t.name]));

await adapter.hello();
const project = (await call('check_bitwig_connection', {})).data.project;
assert.equal(project, expectedProject, `foreground project is ${project}`);

if (mode === 'setup') {
  const count = Number(tracksArg);
  const scenes = Number(scenesArg);
  assert.ok(Number.isInteger(count) && count > 0 && Number.isInteger(scenes) && scenes > 0, 'tracks and scenes');
  const entry = await raw('slot.occupancy');
  const entryTracks = await trackKey();
  assert.ok(!(entry.tracks as Wire[]).some((t) => String(t.name).startsWith(PREFIX)), 'scratch names already exist');
  assert.ok(entry.itemCount + count <= entry.bankSize, `${entry.itemCount} + ${count} tracks exceed the bank`);
  assert.ok(scenes <= entry.sceneBankSize, 'scenes exceed the scene bank');
  const state: Wire = { project, entryTracks, entrySceneCount: entry.sceneCount, addedScenes: 0, trackIds: [] };
  const save = async (): Promise<void> => {
    await mkdir('/tmp/b19', { recursive: true });
    await writeFile(STATE, JSON.stringify(state, null, 1));
  };
  await save();
  const started = performance.now();
  for (let i = 0; i < count; i += 16) {
    const names = Array.from({ length: Math.min(16, count - i) }, (_, k) => `${PREFIX}${String(i + k).padStart(3, '0')}`);
    const added = await call('add_tracks', { tracks: names.map((name) => ({ name })) });
    state.trackIds.push(...(added.readback.tracks as Wire[]).map((t) => t.trackId));
    await save();
  }
  note({ step: 'tracks', added: state.trackIds.length, ms: Math.round(performance.now() - started) });
  if (scenes > entry.sceneCount) {
    await call('add_scenes', { count: scenes - entry.sceneCount });
    state.addedScenes = scenes - entry.sceneCount;
    await save();
  }
  const listed = await raw('track.list');
  const owned = new Set(state.trackIds as string[]);
  const indices = (listed.tracks as Wire[]).filter((t) => owned.has(t.channelId)).map((t) => t.index as number);
  assert.equal(indices.length, owned.size, 'every owned track is in the bank once');
  const cells = indices.flatMap((trackIndex) => Array.from({ length: scenes }, (_, slotIndex) => ({ trackIndex, slotIndex })));
  const fillStarted = performance.now();
  for (let i = 0; i < cells.length; i += CHUNK) {
    await Promise.all(cells.slice(i, i + CHUNK).map((cell) => raw('clip.create', { ...cell, lengthBeats: 4 })));
  }
  const fillMs = performance.now() - fillStarted;
  // Clip creation lands in later host tasks, at about 64 clips per second on a full grid (E414). Wait until the
  // listing shows every scratch slot, allowing 40 clips per second.
  let filled = 0;
  for (const deadline = performance.now() + Math.max(120_000, cells.length * 25); performance.now() < deadline;) {
    const now = await raw('slot.occupancy');
    filled = (now.tracks as Wire[]).filter((t) => owned.has(t.channelId))
      .reduce((sum, t) => sum + (t.occupied as number[]).length, 0);
    if (filled === cells.length) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  note({ step: 'clips', requested: cells.length, filled, ms: Math.round(fillMs) });
  assert.equal(filled, cells.length, 'every scratch slot holds a clip');
} else {
  const state = JSON.parse(await readFile(STATE, 'utf8')) as Wire;
  assert.equal(state.project, project, 'state file names this project');
  const ids = state.trackIds as string[];
  const started = performance.now();
  for (let i = 0; i < ids.length; i += 64) {
    const deleted = await call('delete_track', { trackIds: ids.slice(i, i + 64) });
    note({ step: 'delete', from: i, readback: deleted.readback?.status, applied: deleted.applied });
  }
  if (state.addedScenes > 0) {
    const rows = Array.from({ length: state.addedScenes }, (_, k) => state.entrySceneCount + k);
    await call('delete_scene', { rows });
  }
  // Deletions also land in later host tasks: about four tracks of 128 clips a minute (E414). Wait for them,
  // allowing 30 s for each track, and never resend a delete.
  let after = await raw('slot.occupancy');
  const owned = new Set(ids);
  for (const deadline = performance.now() + Math.max(60_000, ids.length * 30_000); performance.now() < deadline;) {
    after = await raw('slot.occupancy');
    if (!(after.tracks as Wire[]).some((t) => owned.has(t.channelId)) && after.sceneCount === state.entrySceneCount) break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  assert.equal(await trackKey(), state.entryTracks, 'the track list equals entry');
  assert.equal(after.sceneCount, state.entrySceneCount, 'the scene count equals entry');
  note({ step: 'teardown', tracks: ids.length, scenes: state.addedScenes, ms: Math.round(performance.now() - started),
    matchesEntry: true });
}
await transport.close?.();
