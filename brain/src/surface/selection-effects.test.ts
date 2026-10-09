/**
 * 8i8 (E250, E251): the selection effects of add_launcher_clip, add_tracks, and delete_track.
 *
 * Bitwig selects a new clip, selects a new track in the mixer, and moves the mixer selection on a track delete. The
 * fake models these host moves. Each tool runs its writes in one selection scope: the scope restores the person's
 * selection, or the result states the move with a warning.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { control } from '../adapters/fake/control.js';
import { selectionWarnings } from './agent-native.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from './tools.js';
import { workspaceOf } from './workspace.js';

type Wire = Record<string, any>;

function fixture() {
  const fake = new FakeAdapter({ tracks: ['gn-a', 'gn-b', 'gn-c'], scenes: 4 });
  const [a, b, c] = fake.model.visibleTracks();
  let id = 0;
  const workspace = workspaceOf({
    ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `sel-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore: new FakeObservationStore(), documents: new IdentityRegistry(),
  });
  const call = async (name: string, args: Wire) => await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  return { fake, call, a: a!.channelId, b: b!.channelId, c: c!.channelId };
}

const DESIRED = 'DOC ghostnote-document 1.0 desired\nCLIP {"id":"c1","length":"4"}\n'
  + 'COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"c1","fields":"all","from":"0",'
  + '"status":"complete","to":"4"}\nFIELDS id clip at duration pitch velocity channel mute\nEVENT n1 c1 0 1 60 100 1 false\n';
const codes = (result: Wire): string[] => (result.warnings ?? []).map((item: Wire) => item.code);

test('8i8 add_launcher_clip: the person\'s slot selection comes back after the creation and the content', async () => {
  const fx = fixture();
  control(fx.fake).selectSlot(2, 1);
  const before = fx.fake.model.selection;
  const added = await fx.call('add_launcher_clip', { trackId: fx.a, row: 0, document: DESIRED });
  assert.equal(added.failure, undefined, JSON.stringify(added).slice(0, 400));
  assert.deepEqual(fx.fake.model.selection, before);
  assert.ok(!codes(added).includes('slot-selection-moved'));
});

test('8i8 add_launcher_clip: with no slot selected before, the result states that the new clip is selected', async () => {
  const fx = fixture();
  assert.equal(fx.fake.model.selection, undefined);
  const added = await fx.call('add_launcher_clip', { trackId: fx.a, row: 0, document: DESIRED });
  assert.equal(added.failure, undefined, JSON.stringify(added).slice(0, 400));
  assert.deepEqual(fx.fake.model.selection, { trackIndex: 0, slotIndex: 0, project: fx.fake.model.project });
  assert.ok(codes(added).includes('slot-selection-moved'), JSON.stringify(added.warnings));
});

test('8i8 add_tracks: Bitwig selects the new track; the entry mixer track is selected again', async () => {
  const fx = fixture();
  fx.fake.model.mixerSelection = fx.b;
  const added = await fx.call('add_tracks', { tracks: [{ name: 'gn-new' }] });
  assert.equal(added.failure, undefined, JSON.stringify(added).slice(0, 400));
  assert.equal(fx.fake.model.mixerSelection, fx.b);
  assert.ok(!codes(added).includes('mixer-selection-moved'));
});

test('8i8 add_tracks: a newer selection is not changed, and the result names the move', async () => {
  const fx = fixture();
  fx.fake.model.mixerSelection = fx.b;
  fx.fake.model.mixerRestoreRefused = true;
  const added = await fx.call('add_tracks', { tracks: [{ name: 'gn-new' }] });
  const created = added.readback.tracks[0].trackId as string;
  assert.equal(fx.fake.model.mixerSelection, created);
  const warning = (added.warnings as Wire[]).find((item) => item.code === 'mixer-selection-moved');
  assert.ok(warning, JSON.stringify(added.warnings));
  assert.match(warning.message, new RegExp(created));
});

test('8i8 delete_track: an unrelated mixer selection that the host moves is restored (the E251 control arm)', async () => {
  const fx = fixture();
  fx.fake.model.mixerSelection = fx.a;
  const deleted = await fx.call('delete_track', { trackIds: [fx.b] });
  assert.equal(deleted.readback.status, 'verified', JSON.stringify(deleted).slice(0, 400));
  assert.equal(fx.fake.model.mixerSelection, fx.a);
  assert.ok(!codes(deleted).includes('mixer-selection-moved'));
});

test('8i8 delete_track: a deleted selected track cannot be selected again; the result names the move', async () => {
  const fx = fixture();
  fx.fake.model.mixerSelection = fx.b;
  const deleted = await fx.call('delete_track', { trackIds: [fx.b] });
  const warning = (deleted.warnings as Wire[]).find((item) => item.code === 'mixer-selection-moved');
  assert.ok(warning, JSON.stringify(deleted.warnings));
  assert.match(warning.message, /is gone/);
  assert.equal(fx.fake.model.mixerSelection, fx.c);
});

test('8i8 duplicate_track: Bitwig selects the copy; the entry mixer track is selected again (E258)', async () => {
  const fx = fixture();
  fx.fake.model.mixerSelection = fx.c;
  const copied = await fx.call('duplicate_track', { trackId: fx.a, name: 'gn-a copy' });
  assert.equal(copied.failure, undefined, JSON.stringify(copied).slice(0, 400));
  assert.equal(fx.fake.model.mixerSelection, fx.c);
  assert.ok(!codes(copied).includes('mixer-selection-moved'));
});

test('8i8 review: an unconfirmed slot restore is not a restore; the result states the move', () => {
  const warnings = selectionWarnings({ slot: 'unconfirmed' });
  assert.deepEqual(warnings.map((item) => item.code), ['slot-selection-moved']);
  assert.match(warnings[0]!.message, /did not confirm/);
  assert.deepEqual(selectionWarnings({ slot: 'restored' }), []);
});
