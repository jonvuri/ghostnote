/**
 * 8i8 selection effects (E258). Live driver for an owned project on the 8i8 build.
 *
 *   accept <dir>   scratch tracks only: add_tracks, add_launcher_clip (typical), the E251 control arm (a delete of a
 *                  track that was never read, with the mixer on an unrelated track), a delete of a read track, a
 *                  delete of the selected track (the mixer selection cannot come back), rename_track and its revert
 *                  (the 8i8 rename comparison), and duplicate_track. After each tool, the driver
 *                  reads the slot and mixer selection. The existing tracks are not touched. The exit restores the
 *                  entry mixer track with the guarded restore if a step left it elsewhere.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { WireTransport } from './phase8h3c-promotion.js';
import { typicalDesired, wireSummary } from './phase8h4g-inventory.js';
import { assertCurrentNormal } from './phase8h4f-measure.js';

type Wire = Record<string, any>;
const SCHEMA = 'phase8i8-selection-v1';
const PREFIX = 'gn-8i8-';
const say = (value: unknown): void => console.log(JSON.stringify(value));
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function accept(dir: string): Promise<void> {
  const transport = new WireTransport();
  const traces: string[] = [];
  const adapter = new LiveAdapter({ transport, onTrace: (event: Wire) => {
    if (/selection|mixer/.test(String(event.action))) traces.push(`${event.action} ${event.target}`);
  } });
  const workspace = workspaceOf({
    ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
    observationStore: new FakeObservationStore(),
  });
  const request = async (method: string, params?: Wire): Promise<Wire> =>
    await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
  const rows: Wire[] = [];
  const selection = async (): Promise<Wire> => {
    const s = await request('selection.status');
    return { track: s.trackIndex, slot: s.slotIndex, mixer: s.mixerChannelId, revision: s.revision };
  };
  const same = (left: Wire, right: Wire) => left.track === right.track && left.slot === right.slot
    && left.mixer === right.mixer;
  /** Test setup only: select a mixer track with the guarded restore, then wait for the observer. */
  const selectMixer = async (channelId: string): Promise<void> => {
    const s = await request('selection.status');
    const reply = await request('selection.restoreMixer', { channelId, expectedChannelId: s.mixerChannelId,
      expectedRevision: s.revision });
    assert.equal(reply.restored, true, `select ${channelId}: ${JSON.stringify(reply)}`);
    for (let i = 0; i < 40 && (await selection()).mixer !== channelId; i += 1) await pause(25);
  };

  const hello = await request('contract.hello');
  assertCurrentNormal(hello);
  const rig = await request('rig.info');
  assert.equal(rig.selectionEffects, 'mixer-restore-v1', 'deploy the 8i8 build');
  const mark = await request('revision.get');
  await adapter.hello();
  const before = (await request('track.list')).tracks as Wire[];
  assert(!before.some((row) => String(row.name).startsWith(PREFIX)), `a ${PREFIX} track is left; delete it first`);
  const entry = await selection();
  assert(typeof entry.mixer === 'string' && entry.mixer !== '', 'select a mixer track before the run');
  assert(entry.track >= 0 && entry.slot >= 0, 'select a Launcher slot before the run');

  const call = async (step: string, tool: string, args: Wire, expect?: Wire): Promise<Wire> => {
    const from = transport.calls.length;
    traces.length = 0;
    const started = performance.now();
    const result = await callTool(workspace, tool, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
    const ms = performance.now() - started;
    const calls = transport.calls.slice(from);
    const wire = wireSummary(calls);
    const after = await selection();
    const row = { step, tool, ok: result.failure === undefined, code: result.failure?.code,
      status: result.readback?.status, warnings: (result.warnings ?? []).map((item: Wire) => item.code),
      ms: Math.round(ms), calls: calls.length, turns: wire.turns,
      selectionCalls: calls.filter((item) => item.method.startsWith('selection.')).map((item) => item.method),
      selection: after, kept: expect === undefined ? undefined : same(after, expect), traces: [...traces],
      ...(result.failure === undefined ? {} : { failure: JSON.stringify(result).slice(0, 1500) }) };
    rows.push(row);
    say(row);
    assert(row.ok, `${step} ${tool}: ${JSON.stringify(result).slice(0, 800)}`);
    if (expect !== undefined) assert(row.kept, `${step}: the selection is ${JSON.stringify(after)}, not ${JSON.stringify(expect)}`);
    return result;
  };

  const results: Wire = { schema: SCHEMA, hello, project: mark.project, entry, rows };
  const scratch: string[] = [];
  try {
    // add_tracks: Bitwig selects the new track; the tool selects the entry mixer track again.
    const a = (await call('add-a', 'add_tracks', { tracks: [{ name: `${PREFIX}a` }] }, entry)).readback.tracks[0].trackId;
    scratch.push(a);
    // add_launcher_clip: Bitwig selects the new clip; the tool selects the entry slot again.
    await call('add-clip', 'add_launcher_clip', { trackId: a, row: 0, document: typicalDesired() }, entry);
    await call('read-clip', 'read_launcher_clip', { trackId: a, row: 0 }, entry);
    // rename_track and its revert: the 8i8 rename comparison reads back verified.
    const renamed = await call('rename', 'rename_track', { tracks: [{ trackId: a, name: `${PREFIX}a2` }] }, entry);
    assert.equal(renamed.readback.status, 'verified');
    const reverted = await call('revert-rename', 'revert_change', { changeId: renamed.effects[0].changeId }, entry);
    assert.equal(reverted.readback.status, 'verified');
    // The E251 control arm: a track that was never read, deleted with the mixer on an unrelated track.
    const quiet = (await call('add-quiet', 'add_tracks', { tracks: [{ name: `${PREFIX}quiet` }] }, entry))
      .readback.tracks[0].trackId;
    scratch.push(quiet);
    const quietDelete = await call('delete-quiet', 'delete_track', { trackIds: [quiet] }, entry);
    assert.equal(quietDelete.readback.status, 'verified');
    scratch.splice(scratch.indexOf(quiet), 1);
    // A read track (a clip and its pool cursor), deleted with the mixer on an unrelated track.
    const pointed = await call('delete-pointed', 'delete_track', { trackIds: [a] }, entry);
    assert.equal(pointed.readback.status, 'verified');
    scratch.splice(scratch.indexOf(a), 1);
    // duplicate_track: Bitwig selects the copy; the tool selects the entry mixer track again.
    const b = (await call('add-b', 'add_tracks', { tracks: [{ name: `${PREFIX}b` }] }, entry)).readback.tracks[0].trackId;
    scratch.push(b);
    const copy = (await call('duplicate-b', 'duplicate_track', { trackId: b, name: `${PREFIX}b copy` }, entry))
      .readback.copy.trackId;
    scratch.push(copy);
    // The selected track is deleted: the entry mixer track cannot come back, and the result names the move.
    await selectMixer(copy);
    const own = await call('delete-selected', 'delete_track', { trackIds: [copy] });
    scratch.splice(scratch.indexOf(copy), 1);
    assert(own.warnings.some((item: Wire) => item.code === 'mixer-selection-moved'), 'the selected-track delete warns');
    results.selectedDelete = { warning: own.warnings.find((item: Wire) => item.code === 'mixer-selection-moved'),
      mixerAfter: rows.at(-1)!.selection.mixer };
    await selectMixer(entry.mixer);
    const last = await call('delete-b', 'delete_track', { trackIds: [b] }, entry);
    assert.equal(last.readback.status, 'verified');
    scratch.splice(scratch.indexOf(b), 1);
  } finally {
    if (scratch.length > 0) await call('cleanup', 'delete_track', { trackIds: scratch });
    if ((await selection()).mixer !== entry.mixer) await selectMixer(entry.mixer);
    const after = (await request('track.list')).tracks as Wire[];
    results.tracksRestored = JSON.stringify(after.map((row) => row.channelId))
      === JSON.stringify(before.map((row) => row.channelId));
    results.exit = await selection();
    results.selectionRestored = same(results.exit, entry);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'accept.json'), `${JSON.stringify(results, null, 2)}\n`);
    say({ tracksRestored: results.tracksRestored, selectionRestored: results.selectionRestored, exit: results.exit });
    await transport.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  const [mode, dir] = process.argv.slice(2);
  if (mode === 'accept' && dir !== undefined) await accept(dir);
  else {
    console.error('usage: phase8i8-selection.ts accept <dir>');
    process.exitCode = 2;
  }
}
