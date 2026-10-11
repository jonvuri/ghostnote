/**
 * 8i15 device-add revert report (E264). Live driver for the owned project gn-scale-test, one scratch track.
 *
 *   accept <dir>   normal profile, 8i15 build: `add_devices` (two devices), `check_revert` and `revert_change` for
 *                  each, the refusal of a revert in the wrong order, and the revert of an added clip. The driver
 *                  reads the device list with `read_devices` after each step and prints the wire calls of each
 *                  revert.
 *
 * The mode adds and deletes its own track (`gn-8i15-a`).
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
import { NORMAL_8I15 } from './phase8h4f-measure.js';
import { wireSummary } from './phase8h4g-inventory.js';

type Wire = Record<string, any>;
const SCHEMA = 'phase8i15-revert-v1';
const ANCHOR = 'gn-scale-test';
const TRACK = 'gn-8i15-a';
const DEVICES = ['Polysynth', 'Delay+'] as const;
const say = (value: unknown): void => console.log(JSON.stringify(value));

const DESIRED = ['DOC ghostnote-document 1.0 desired', 'CLIP {"id":"c1","length":"4","loop":{"from":"0","to":"4"}}',
  'COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"c1","fields":"all","status":"complete","from":"0","to":"4"}',
  'FIELDS id clip at duration pitch velocity channel',
  ...[0, 1, 2, 3].map((beat) => `EVENT n${beat} c1 ${beat} 1/2 ${60 + beat} ${80 + beat} 1`)].join('\n') + '\n';

async function accept(dir: string): Promise<void> {
  const transport = new WireTransport();
  const adapter = new LiveAdapter({ transport });
  const workspace = workspaceOf({
    ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
    observationStore: new FakeObservationStore(),
  });
  const request = async (method: string, params?: Wire): Promise<Wire> =>
    await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
  const state = async (): Promise<Wire> => {
    const selection = await request('selection.status');
    return { tracks: ((await request('track.list')).tracks as Wire[]).map((row) => `${row.index}:${row.name}:${row.type}:${row.channelId.slice(0, 4)}`),
      scenes: (await request('scene.count')).sceneCount,
      selection: { track: selection.trackIndex, slot: selection.slotIndex, mixer: selection.mixerChannelId } };
  };
  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], [...NORMAL_8I15], 'deploy the 8i15 build');
  assert.equal((await request('selection.status')).project, ANCHOR, `the owned project ${ANCHOR} is required`);
  assert(!((await request('track.list')).tracks as Wire[]).some((row) => row.name === TRACK), `${TRACK} is left; delete it first`);
  await adapter.hello();
  const entry = await state();
  const rows: Wire[] = [];
  const results: Wire = { schema: SCHEMA, hello, entry, rows };
  let trackId: string | undefined;
  /** One timed tool call with its wire calls. */
  const call = async (step: string, name: string, args: Wire): Promise<Wire> => {
    const from = transport.calls.length;
    const started = performance.now();
    const result = await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
    const ms = Math.round(performance.now() - started);
    const calls = transport.calls.slice(from);
    const wire = wireSummary(calls);
    rows.push({ step, tool: name, ms, calls: calls.length, turns: wire.turns,
      writes: calls.filter((item) => item.method === 'batch.run').length, methods: wire.methods, result });
    say({ step, tool: name, ms, calls: calls.length, turns: wire.turns, code: result.failure?.code,
      effects: result.effects, readback: result.readback, data: result.data });
    return result;
  };
  const devices = async (): Promise<string[]> => {
    const read = await callTool(workspace, 'read_devices', { trackId }, AGENT_NATIVE_TOOL_PROFILE) as Wire;
    assert(read.failure === undefined, JSON.stringify(read).slice(0, 600));
    return (read.data.devices as Wire[]).map((item) => item.name as string);
  };
  try {
    const made = await call('add-track', 'add_tracks', { tracks: [{ name: TRACK }] });
    trackId = made.readback.tracks[0].trackId as string;
    const place = (devicePosition: number, name: string) => ({ what: 'device', trackId, devicePosition, name });
    results.devicesBefore = await devices();
    const added = await call('add-devices', 'add_devices', { trackId, devices: DEVICES.map((name) => ({ kind: 'native', name })) });
    assert.equal(added.readback?.status, 'verified', JSON.stringify(added).slice(0, 600));
    const [first, second] = (added.effects as Wire[]).map((item) => item.changeId as string) as [string, string];
    const base = results.devicesBefore.length as number;
    assert.deepEqual(await devices(), [...results.devicesBefore, ...DEVICES]);

    for (const [index, changeId] of [first, second].entries()) {
      const check = await call(`check-${index}`, 'check_revert', { changeId });
      assert.deepEqual(check.data.wouldRemove, [place(base + index, DEVICES[index]!)]);
      assert.equal(check.data.fullyRestorable, true);
      assert.equal(check.data.fidelity, 'exact');
    }
    // The wrong order: the delete guard refuses, and the devices stay.
    const early = await call('revert-first-early', 'revert_change', { changeId: first });
    assert.equal(early.failure?.code, 'target-changed', JSON.stringify(early).slice(0, 600));
    assert.deepEqual(await devices(), [...results.devicesBefore, ...DEVICES], 'the refused revert removes nothing');

    for (const [index, changeId] of [[1, second], [0, first]] as const) {
      const reverted = await call(`revert-${index}`, 'revert_change', { changeId });
      assert.equal(reverted.readback?.status, 'verified', JSON.stringify(reverted).slice(0, 600));
      assert.deepEqual(reverted.readback.removed, [place(base + index, DEVICES[index]!)]);
      assert.deepEqual(reverted.readback.notRestored, []);
      assert.equal(reverted.effects[0].fidelity, 'exact');
      assert.equal(reverted.effects[0].redoFidelity, 'none');
      assert.deepEqual(await devices(), [...results.devicesBefore, ...DEVICES.slice(0, index)]);
    }
    results.devicesAfter = await devices();

    // The same report form for a clip that a change put in an empty slot.
    const clip = await call('add-clip', 'add_launcher_clip', { trackId, row: 0, document: DESIRED, format: 'fields' });
    assert(clip.failure === undefined, JSON.stringify(clip).slice(0, 600));
    const created = clip.effects[0].changeId as string;
    const content = clip.effects[1]?.changeId as string | undefined;
    if (content !== undefined) await call('revert-clip-content', 'revert_change', { changeId: content });
    const clipCheck = await call('check-clip', 'check_revert', { changeId: created });
    assert.deepEqual(clipCheck.data.wouldRemove, [{ what: 'launcher_clip', trackId, row: 0 }]);
    const clipRevert = await call('revert-clip', 'revert_change', { changeId: created });
    assert.deepEqual(clipRevert.readback?.removed, [{ what: 'launcher_clip', trackId, row: 0 }], JSON.stringify(clipRevert).slice(0, 600));
    assert.equal(clipRevert.effects[0].fidelity, 'exact');
  } finally {
    if (trackId !== undefined) {
      results.cleanup = (await callTool(workspace, 'delete_track', { trackIds: [trackId] }, AGENT_NATIVE_TOOL_PROFILE) as Wire).readback ?? 'failed';
    }
    const exit = await state();
    results.exit = { ...exit, tracksSame: JSON.stringify(entry.tracks) === JSON.stringify(exit.tracks),
      selectionKept: JSON.stringify(entry.selection) === JSON.stringify(exit.selection) };
    say(results.exit);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'accept.json'), `${JSON.stringify(results, null, 2)}\n`);
    await transport.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  const [mode, dir] = process.argv.slice(2);
  if (mode === 'accept' && dir !== undefined) await accept(dir);
  else {
    console.error('usage: phase8i15-revert.ts accept <dir>');
    process.exitCode = 2;
  }
  process.exit();
}
