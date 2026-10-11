/**
 * 8i13 automated dogfood stretch set (E262). Live driver, normal profile, owned project gn-scale-test.
 *
 *   <task> setup     Make the fixture of the task with the product tools. Tasks: s1, s2, s3, s4.
 *   <task> state     Print the state for the check of the task. Raw wire reads give the tracks, the mixer of every
 *                    track, the scene count, the slot occupancy of every track, and the selection. The clip
 *                    documents (s1, s4) and the device list and controls (s2) come from the product read tools in
 *                    this process: a raw clip or device read needs a cursor.
 *   <task> cleanup   Delete the fixture tracks. Refuse to continue when the scene count is not the entry count.
 *
 * Each mode adds and deletes its own tracks only. S5 uses `phase8i7-mixer.ts trial-setup`.
 */
import assert from 'node:assert/strict';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { WireTransport } from './phase8h3c-promotion.js';

type Wire = Record<string, any>;
const ANCHOR = 'gn-scale-test';
/** The scene count of the gn-scale-test baseline. */
const SCENES = 10;
const say = (value: unknown): void => console.log(JSON.stringify(value));

const FIXTURE: Readonly<Record<string, readonly string[]>> = {
  s1: ['Drums', 'Bass', 'Pad', 'Lead'],
  s2: ['Keys'],
  s3: Array.from({ length: 12 }, (_, index) => `T${String(index + 1).padStart(2, '0')}`),
  s4: ['Seq'],
};

const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const workspace = workspaceOf({
  ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
  observationStore: new FakeObservationStore(), documents: new IdentityRegistry(),
});
const request = async (method: string, params?: Wire): Promise<Wire> =>
  await transport.send({ method, ...(params ? { params } : {}) }) as Wire;

async function tool(name: string, args: Wire): Promise<Wire> {
  const result = await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  assert(result.failure === undefined, `${name}: ${JSON.stringify(result).slice(0, 800)}`);
  return result;
}

const trackList = async (): Promise<Wire[]> => (await request('track.list')).tracks as Wire[];
const fixtureRows = async (task: string): Promise<Wire[]> =>
  (await trackList()).filter((row) => FIXTURE[task]!.includes(row.name));

async function requireAnchor(): Promise<void> {
  assert.equal((await request('contract.hello')).runtimeProfile, 'normal-v1');
  const project = (await request('selection.status')).project;
  assert.equal(project, ANCHOR, `the owned project ${ANCHOR} is required, not ${project}`);
}

/** One clip of `beats` beats with eight notes on the half beat. */
function clipDocument(id: string, pitch: number, beats = 4): string {
  const events = Array.from({ length: 8 }, (_, n) => `EVENT ${id}-n${n} ${id} ${n}/2 1/4 ${pitch + (n % 4)} ${90 + n} 1 false`);
  return ['DOC ghostnote-document 1.0 desired', `CLIP {"id":"${id}","length":"${beats}","loop":{"from":"0","to":"${beats}"}}`,
    `COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"${id}","fields":"all","from":"0","status":"complete","to":"${beats}"}`,
    'FIELDS id clip at duration pitch velocity channel mute', ...events].join('\n') + '\n';
}

async function addClip(trackId: string, row: number, name: string, pitch: number): Promise<void> {
  await tool('add_launcher_clip', { trackId, row, document: clipDocument(`c${row}`, pitch), format: 'fields' });
  await tool('set_launcher_clip_properties', { clips: [{ trackId, row, properties: { name } }] });
}

async function setup(task: string): Promise<void> {
  await requireAnchor();
  assert.deepEqual(await fixtureRows(task), [], 'a fixture track exists; run cleanup first');
  assert.equal((await request('scene.count')).sceneCount, SCENES, 'the entry scene count');
  const added = await tool('add_tracks', { tracks: FIXTURE[task]!.map((name) => ({ name })) });
  const ids = (added.readback.tracks as Wire[]).map((item) => item.trackId as string);
  if (task === 's1') {
    for (const [index, id] of ids.entries()) await addClip(id, 0, 'A', 36 + 12 * index);
  } else if (task === 's2') {
    await tool('add_devices', { trackId: ids[0], devices: [{ kind: 'native', name: 'Polymer' }] });
  } else if (task === 's4') {
    for (const [row, name] of ['A', 'B', 'C', 'D'].entries()) await addClip(ids[0]!, row, name, 48 + 5 * row);
  }
  say({ task, created: ids });
}

async function state(task: string): Promise<void> {
  const list = await trackList();
  const mixer = (await request('track.mixer', { tracks: list.map((row) => ({ trackIndex: row.index, channelId: row.channelId })) }))
    .tracks as Wire[];
  const sceneCount = (await request('scene.count')).sceneCount as number;
  for (const row of list) {
    const m = mixer.find((item) => item.channelId === row.channelId)!;
    const slots: number[] = [];
    if (row.type !== 'Master' && row.type !== 'Effect') {
      for (let scene = 0; scene < sceneCount; scene += 1) {
        const slot = await request('slot.status', { trackIndex: row.index, slotIndex: scene }).catch(() => undefined);
        if (slot?.hasContent === true) slots.push(scene);
      }
    }
    say({ name: row.name, type: row.type, position: row.position, volumeRaw: m.volumeRaw, db: 60 * Math.log10(m.volumeRaw),
      pan: m.panRaw, mute: m.mute, solo: m.solo, clipRows: slots });
  }
  const fixture = list.filter((row) => FIXTURE[task]!.includes(row.name));
  if (task === 's1' || task === 's4') {
    for (const row of fixture) {
      for (let scene = 0; scene < sceneCount; scene += 1) {
        const slot = await request('slot.status', { trackIndex: row.index, slotIndex: scene });
        if (slot.hasContent !== true) continue;
        const read = await tool('read_launcher_clip', { trackId: row.channelId, row: scene, format: 'json' });
        const document = read.data?.document ?? read.document ?? read.data;
        const clip = (document.clips ?? [document.clip])[0] ?? {};
        say({ clip: row.name, row: scene, name: clip.name ?? null, length: clip.length ?? null,
          notes: (document.events as Wire[] ?? []).map((event) => `${event.at}:${event.duration}:${event.pitch}:${event.velocity}`) });
      }
    }
  }
  if (task === 's2') {
    for (const row of fixture) {
      const devices = await tool('read_devices', { trackId: row.channelId });
      say({ devices: row.name, data: devices.data });
      // The instrument of the fixture, at its current position.
      const position = (devices.data.devices as Wire[]).find((item) => item.name === 'Polymer')?.devicePosition;
      if (position === undefined) continue;
      const device = { trackId: row.channelId, devicePosition: position };
      const direct = await tool('read_device_controls', { device });
      say({ controls: row.name, devicePosition: position, view: 'direct',
        values: (direct.parameters as Wire[]).map((item) => `${item.id}=${item.normalizedValue}`) });
      const remote = await tool('read_device_controls', { device, view: 'remote-controls' });
      say({ controls: row.name, devicePosition: position, view: 'remote-controls',
        values: (remote.remotePages as Wire[]).flatMap((page) => (page.controls as Wire[]).map((item) =>
          `${page.name}/${item.name}=${item.normalizedValue}/${item.modulatedValue}`)) });
    }
  }
  const selection = await request('selection.status');
  say({ project: selection.project, sceneCount, slotTrackIndex: selection.trackIndex, slotIndex: selection.slotIndex,
    mixerTrackIndex: selection.mixerTrackIndex, mixerChannelId: selection.mixerChannelId });
}

async function cleanup(task: string): Promise<void> {
  await requireAnchor();
  const ids = (await fixtureRows(task)).map((row) => row.channelId as string);
  if (ids.length > 0) await tool('delete_track', { trackIds: ids });
  const sceneCount = (await request('scene.count')).sceneCount;
  say({ task, deleted: ids.length, sceneCount });
  assert.equal(sceneCount, SCENES, 'a scene was added; delete it by its row, then compare the state');
}

const [task, mode] = process.argv.slice(2);
if (task === undefined || FIXTURE[task] === undefined || !['setup', 'state', 'cleanup'].includes(mode ?? '')) {
  throw new Error('usage: phase8i13-stretch.ts <s1|s2|s3|s4> setup|state|cleanup');
}
// The clip reader needs the adapter handshake.
await adapter.hello();
if (mode === 'setup') await setup(task);
else if (mode === 'state') await state(task);
else await cleanup(task);
process.exit(0);
