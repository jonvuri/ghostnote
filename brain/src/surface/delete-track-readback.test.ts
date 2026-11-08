/**
 * B19 (E415): delete_track names each track that is gone. Bitwig removes a track after the request returns, and the
 * extension refuses a delete when another track is at the index; either way a requested track can still be there.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from './tools.js';
import { workspaceOf } from './workspace.js';

type Wire = Record<string, any>;

function fixture() {
  const fake = new FakeAdapter({ tracks: ['gn-a', 'gn-b', 'gn-c'], scenes: 4 });
  const [a, b, c] = fake.model.visibleTracks().map((track) => track.channelId);
  let id = 0;
  const workspace = workspaceOf({
    ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `del-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore: new FakeObservationStore(), documents: new IdentityRegistry(),
  });
  const call = async (name: string, args: Wire) => await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  return { fake, call, a: a!, b: b!, c: c! };
}

test('B19 delete_track: every requested track gone reads back verified and is named in removed', async () => {
  const fx = fixture();
  const deleted = await fx.call('delete_track', { trackIds: [fx.a, fx.c] });
  assert.equal(deleted.readback.status, 'verified', JSON.stringify(deleted).slice(0, 400));
  assert.deepEqual(deleted.readback.removed, [fx.a, fx.c]);
});

test('B19 delete_track: a track that is still there reads back differs and is left out of removed', async () => {
  const fx = fixture();
  const deleteTrack = fx.fake.model.deleteTrack.bind(fx.fake.model);
  // Bitwig has not removed gn-c by the end of the wait, or the extension refused its delete.
  fx.fake.model.deleteTrack = (channelId: string) => channelId === fx.c ? true : deleteTrack(channelId);
  const deleted = await fx.call('delete_track', { trackIds: [fx.a, fx.c] });
  assert.equal(deleted.failure, undefined, JSON.stringify(deleted).slice(0, 400));
  assert.equal(deleted.readback.status, 'differs');
  assert.deepEqual(deleted.readback.removed, [fx.a]);
  assert.ok(fx.fake.model.visibleTracks().some((track) => track.channelId === fx.c));
});
