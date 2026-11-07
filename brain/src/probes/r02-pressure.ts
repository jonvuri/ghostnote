/**
 * R02 foreground driver. Each invocation records its full wire exchange and exits.
 * setup OUT PROJECT; read|pressure|velocity|away|back|cleanup OUT.
 * Stop between cases for inspector observations. Never retry an uncertain write.
 * Check competing drivers/clients before invoking this script; it owns no other process.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { FakeAdapter } from '../adapters/fake/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { compareDeployment, deployedAtMs } from '../deploy.js';
import { parse } from '../document/index.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { readProbeGolden } from '../tools/wire-golden.js';
import { WireTransport } from './phase8h3c-promotion.js';

type Wire = Record<string, any>;
const [command, out, project] = process.argv.slice(2);
if (command === 'check') {
  const notes = parse(fixtureDocument('gn-r02-notes', true), 'fields');
  const park = parse(fixtureDocument('gn-r02-park', false), 'fields');
  assert(notes.kind === 'desired' && park.kind === 'desired');
  assert.equal(notes.events.length, 4);
  assert.equal(park.events.length, 0);
  assert.deepEqual(notes.events.map(note => [note.channel ?? 1, note.pitch, note.at]),
    [[1, 60, '0'], [2, 62, '1'], [1, 64, '2'], [1, 65, '3']]);
  const fake = new FakeAdapter({ tracks: ['preserved'], scenes: 2 });
  const before = fake.model.visibleTracks().map(track => [track.channelId, track.name]);
  const offline = workspaceOf({ ready: async () => undefined, adapter: fake, executor: new Executor(fake),
    stash: new Stash(), observationStore: new FakeObservationStore(), documents: new IdentityRegistry() });
  const call = async (name: string, args: Wire): Promise<Wire> =>
    await callTool(offline, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const created = await call('add_tracks', { tracks: [{ name: 'gn-r02-pressure' }] });
  assert.equal(created.failure, undefined);
  const trackId = created.readback.tracks[0].trackId;
  for (const [row, name] of ['gn-r02-notes', 'gn-r02-park'].entries()) {
    const added = await call('add_launcher_clip', { trackId, row, document: fixtureDocument(name, row === 0) });
    assert.equal(added.failure, undefined, JSON.stringify(added));
  }
  const scratch = fake.model.visibleTracks().find(track => track.channelId === trackId)!;
  assert.equal(scratch.slots[0]!.notes.size, 4);
  assert.equal(scratch.slots[1]!.notes.size, 0);
  await call('delete_track', { trackIds: [trackId] });
  assert.deepEqual(fake.model.visibleTracks().map(track => [track.channelId, track.name]), before);
  console.log('R02 fixture parsing, creation, four note identities, parking clip, and cleanup pass offline.');
  process.exit(0);
}
assert(command && ['setup', 'read', 'pressure', 'velocity', 'away', 'back', 'cleanup'].includes(command) && out,
  'usage: r02-pressure.ts setup OUT PROJECT | read|pressure|velocity|away|back|cleanup OUT');
if (command === 'setup') { assert(project, 'setup requires the exact foreground project name'); mkdirSync(out); }
const statePath = join(out, 'state.json');
const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const workspace = workspaceOf({ ready: async () => undefined, adapter, executor: new Executor(adapter),
  stash: new Stash(), observationStore: new FakeObservationStore(), documents: new IdentityRegistry() });
const report: Wire = { command, started: new Date().toISOString(), samples: [] };
const saveState = (state: Wire) => writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
const request = async (method: string, params?: Wire): Promise<Wire> =>
  await transport.send({ method, ...(params ? { params } : {}), timeoutMs: 15_000 }) as Wire;
const probe = (operation: string) => request('probe.pressure', { operation });
async function tool(name: string, args: Wire): Promise<Wire> {
  const result = await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  (report.tools ??= []).push({ name, args, result });
  assert.equal(result.failure, undefined, JSON.stringify(result));
  assert.notEqual(result.refused, true, JSON.stringify(result));
  return result;
}
const inventory = async (): Promise<Wire[]> => (await request('track.list')).tracks;
const identities = (tracks: Wire[]) => tracks.map(({ channelId, name }) => ({ channelId, name }));
const selectionIdentity = (s: Wire, tracks: Wire[]) =>
  [s.mixerChannelId, tracks.find(track => track.index === s.trackIndex)?.channelId ?? '', s.slotIndex];
async function sample(): Promise<void> {
  // 0, 100, 500, and 1500 ms after entering this loop. Reads only; no write retries.
  for (const delay of [0, 100, 400, 1000]) {
    if (delay) await setTimeout(delay);
    report.samples.push({ capturedAt: new Date().toISOString(), value: await probe('read') });
  }
}
async function point(state: Wire, row: number): Promise<void> {
  const target = (await inventory()).find(track => track.channelId === state.trackId);
  assert.equal(target?.name, 'gn-r02-pressure');
  const result = await request('cursor.pointExpanded',
    { cursor: '0', trackIndex: target.index, row, channelId: state.trackId });
  assert.equal(result.refused, undefined, JSON.stringify(result));
  const status = await request('cursor.status', { cursor: '0' });
  assert.equal(status.trackChannelId, state.trackId);
  assert.equal(status.sceneIndex, row);
  assert.equal(status.isPinned, true);
}
function fixtureDocument(name: string, notes: boolean): string {
  return ['DOC ghostnote-document 1.0 desired',
    `CLIP ${JSON.stringify({ id: 'c1', name, length: '4', loop: { from: '0', to: '4' } })}`,
    'COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"c1","fields":"all","status":"complete","from":"0","to":"4"}',
    'FIELDS id clip at duration pitch velocity channel',
    ...(notes ? ['EVENT zero c1 0 1/4 60 100 1', 'EVENT human c1 1 1/4 62 90 2',
      'EVENT setter c1 2 1/4 64 80 1', 'EVENT control c1 3 1/4 65 70 1'] : [])].join('\n') + '\n';
}

try {
  const hello = await request('contract.hello');
  const golden = readProbeGolden();
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash],
    [golden.identity, golden.count, golden.methodsHash]);
  const stats = await request('rig.stats');
  const deployment = compareDeployment(deployedAtMs(), stats.initEpochMs);
  assert.equal(deployment.state, 'fresh', deployment.detail);
  const status = await probe('status');
  assert.equal(status.marker, 'r02-pressure-v1');
  const mark = await request('revision.get');
  report.entry = { hello, stats, deployment, status, mark, host: await request('host.info'),
    selection: await request('selection.status'), tracks: await inventory() };
  await adapter.hello();

  if (command === 'setup') {
    assert.equal(mark.project, project);
    assert(!report.entry.tracks.some((track: Wire) => track.name === 'gn-r02-pressure'), 'existing fixture: inspect it');
    assert(!status.boundSession, 'probe already bound: inspect the previous session');
    const state: Wire = { schema: 'r02-pressure-v1', project, generation: mark.generation,
      initEpochMs: stats.initEpochMs, before: report.entry };
    saveState(state); // Preserve the baseline before creating anything.
    const created = await tool('add_tracks', { tracks: [{ name: 'gn-r02-pressure' }] });
    state.trackId = created.readback.tracks[0].trackId;
    saveState(state);
    for (const [row, name] of ['gn-r02-notes', 'gn-r02-park'].entries()) {
      await tool('add_launcher_clip', { trackId: state.trackId, row, document: fixtureDocument(name, row === 0) });
    }
    await point(state, 0);
    report.point = await probe('point');
    await setTimeout(500);
    await sample();
    for (const role of ['writer', 'reader']) {
      const view = report.samples.at(-1).value[role];
      assert.equal(view.trackId, state.trackId);
      assert.equal(view.slot, 0);
      assert.equal(view.pinned, true);
      assert.deepEqual(view.notes.map((n: Wire) => [n.channel, n.x, n.pitch, n.state]),
        [[0, 0, 60, 'NoteOn'], [1, 4, 62, 'NoteOn'], [0, 8, 64, 'NoteOn'], [0, 12, 65, 'NoteOn']]);
    }
    const selection = await request('selection.status');
    // A previously empty Launcher selection cannot be restored by selecting a prior slot.
    // Clip creation selects the owned fixture; retain and report that effect (D54).
    const selectionAfter = selectionIdentity(selection, await inventory());
    const selectionBefore = selectionIdentity(report.entry.selection, report.entry.tracks);
    if (selectionBefore[2] === -1 && selectionAfter[1] === state.trackId && selectionAfter[2] === 0) {
      assert.equal(selectionAfter[0], selectionBefore[0], 'mixer selection must remain unchanged');
      report.selectionEffect = 'Previously no Launcher slot was selected; setup selected the owned test clip.';
      state.setupSelectionEffect = report.selectionEffect;
    } else assert.deepEqual(selectionAfter, selectionBefore);
    state.ready = true;
    saveState(state);
    console.log('Fixture ready. On channel 2 / pitch 62 / beat offset 1, set pressure to 51% and change velocity; record both inspector values, then run read.');
  } else {
    const state = JSON.parse(readFileSync(statePath, 'utf8')) as Wire;
    assert.equal(mark.project, state.project);
    assert.equal(mark.generation, state.generation, 'project generation changed; inspect before resuming');
    assert.equal(stats.initEpochMs, state.initEpochMs, 'extension session changed; re-establish ownership');
    assert.equal(report.entry.tracks.find((track: Wire) => track.channelId === state.trackId)?.name, 'gn-r02-pressure');
    assert(state.ready || command === 'cleanup', 'setup incomplete; inspect before continuing');
    if (command === 'pressure' || command === 'velocity') {
      report.beforeWrite = await probe('read');
      // Durable attempt marker is written before dispatch, so a timeout cannot invite a replay.
      writeFileSync(join(out, `${command}-attempt.json`), JSON.stringify({ at: report.started, state }, null, 2), { flag: 'wx' });
      report.write = await probe(command === 'pressure' ? 'writePressure' : 'writeVelocity');
      await sample();
    } else if (command === 'away' || command === 'back') {
      await point(state, command === 'away' ? 1 : 0);
      report.point = await probe(command === 'away' ? 'writerAway' : 'writerBack');
      await sample();
    } else if (command === 'read') {
      await sample();
    } else {
      await tool('delete_track', { trackIds: [state.trackId] });
      const after = await inventory();
      assert.deepEqual(identities(after), identities(state.before.tracks));
      // Operator inspection intentionally selects scratch notes. Restore the pre-fixture mixer and slot.
      const saved = state.before.selection;
      if (saved.trackIndex >= 0 && saved.slotIndex >= 0) {
        const original = state.before.tracks.find((track: Wire) => track.index === saved.trackIndex);
        const target = after.find((track: Wire) => track.channelId === original?.channelId);
        assert(target, 'original selected track missing');
        await request('slot.select', { trackIndex: target.index, slotIndex: saved.slotIndex });
        await setTimeout(200);
      }
      const current = await request('selection.status');
      if (saved.mixerChannelId && current.mixerChannelId !== saved.mixerChannelId) {
        const restored = await request('selection.restoreMixer', { channelId: saved.mixerChannelId,
          expectedChannelId: current.mixerChannelId, expectedRevision: current.revision });
        assert.equal(restored.restored, true);
        await setTimeout(200);
      }
      report.restoredSelection = await request('selection.status');
      assert.deepEqual(selectionIdentity(report.restoredSelection, after), selectionIdentity(saved, state.before.tracks));
      state.cleaned = true;
      saveState(state);
    }
  }
  report.after = { tracks: await inventory(), selection: await request('selection.status') };
  if (command !== 'cleanup' && !report.selectionEffect) assert.deepEqual(selectionIdentity(report.after.selection, report.after.tracks),
    selectionIdentity(report.entry.selection, report.entry.tracks));
  report.complete = true;
} catch (error) {
  report.error = String(error);
  process.exitCode = 1;
  console.error(error);
} finally {
  report.wire = transport.calls;
  report.finished = new Date().toISOString();
  writeFileSync(join(out, `${Date.now()}-${command}.json`), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  await transport.close();
}
