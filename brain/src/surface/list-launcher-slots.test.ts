/** list_launcher_slots (B19 session 2): the whole-bank slot occupancy listing. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { LAUNCHER_SLOTS_SCHEMA } from './agent-native-retained.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from './tools.js';
import { workspaceOf } from './workspace.js';

type Wire = Record<string, any>;

function fixture(options: ConstructorParameters<typeof FakeAdapter>[0] = { tracks: ['Bass', 'Keys'], scenes: 6 }) {
  const fake = new FakeAdapter(options);
  let id = 0;
  const workspace = workspaceOf({
    ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `slots-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore: new FakeObservationStore(), documents: new IdentityRegistry(),
  });
  const fill = (track: number, ...rows: number[]): void => {
    for (const row of rows) fake.model.visibleTracks()[track]!.slots[row]!.hasContent = true;
  };
  const list = async (): Promise<Wire> =>
    await callTool(workspace, 'list_launcher_slots', {}, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  return { fake, fill, list };
}

test('list_launcher_slots: each track lists its ascending occupied rows; a track with no clip lists none', async () => {
  const fx = fixture();
  fx.fill(0, 4, 0, 2);
  const result = await fx.list();
  assert.equal(result.schema, LAUNCHER_SLOTS_SCHEMA);
  assert.equal(result.failure, undefined);
  assert.equal(result.coverage.status, 'complete');
  assert.deepEqual(result.warnings, []);
  assert.equal(result.data.rowCount, 6);
  const [bass, keys] = result.data.tracks as Wire[];
  const tracks = await fx.fake.tracks();
  assert.deepEqual(bass, { trackId: tracks[0]!.channelId, name: 'Bass', kind: 'Instrument', occupiedRows: [0, 2, 4] });
  assert.deepEqual(keys!.occupiedRows, []);
  assert.equal(result.data.tracks.length, tracks.length, 'every addressable track is listed');
});

test('list_launcher_slots: a group track mirrors its children and lists no rows', async () => {
  const fx = fixture();
  fx.fake.model.tracks.unshift({ channelId: 'group-1', name: 'Drums', type: 'Group',
    slots: fx.fake.model.makeSlots(), devices: [] });
  fx.fill(0, 1);
  const group = (await fx.list()).data.tracks[0] as Wire;
  assert.deepEqual(group, { trackId: 'group-1', name: 'Drums', kind: 'Group', group: true,
    launcherSlots: 'mirror-children' });
});

test('list_launcher_slots: tracks and scenes outside the window make the listing partial', async () => {
  const tracks = fixture({ tracks: ['A', 'B', 'C'], scenes: 4, trackBankSize: 2 });
  const overTracks = await tracks.list();
  assert.equal(overTracks.coverage.status, 'partial');
  assert.equal(overTracks.coverage.listed, 2);
  assert.equal(overTracks.coverage.notListed, 3);
  assert.equal(overTracks.warnings[0].code, 'partial');

  const scenes = fixture({ tracks: ['A'], scenes: 6 });
  scenes.fake.model.sceneBankSize = 4;
  scenes.fill(0, 3, 5);
  const overScenes = await scenes.list();
  assert.equal(overScenes.coverage.status, 'partial');
  assert.equal(overScenes.data.rowCount, 4);
  assert.deepEqual(overScenes.data.tracks[0].occupiedRows, [3], 'row 5 is outside the scene window');
  assert.match(overScenes.warnings[0].message, /scenes/);
});

test('list_launcher_slots: no open project is a failure with code unhealthy', async () => {
  const fx = fixture();
  fx.fake.model.project = '';
  const result = await fx.list();
  assert.equal(result.failure.code, 'unhealthy');
});
