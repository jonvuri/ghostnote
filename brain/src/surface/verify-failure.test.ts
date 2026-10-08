/**
 * E250: a verification read that throws after an applied write keeps the apply receipt. The dogfood trial lost the
 * creation effect and its change record when the clip reader refused at the verify read of `add_launcher_clip`.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { AddressUnresolvedError } from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from './tools.js';
import { workspaceOf } from './workspace.js';

/** A fake whose reads throw after an apply, until `reads` reads have thrown. */
function faultyWorkspace(reads: number) {
  const fake = new FakeAdapter({ tracks: ['diagnostic'], scenes: 2 });
  const apply = fake.apply.bind(fake);
  const read = fake.read.bind(fake);
  let armed = false;
  let left = reads;
  fake.apply = async (batch) => {
    const receipt = await apply(batch);
    armed = true;
    return receipt;
  };
  fake.read = async (addresses, options) => {
    if (armed && left > 0) {
      left -= 1;
      throw new AddressUnresolvedError(addresses[0]!, 'clip.read refused deadline: the read did not close');
    }
    return read(addresses, options);
  };
  let id = 0;
  const workspace = workspaceOf({
    ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `v-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), documents: new IdentityRegistry(),
    observationStore: new FakeObservationStore(),
  });
  return { fake, workspace, trackId: fake.model.visibleTracks()[0]!.channelId };
}

test('E250: a creation whose verify read throws reports and records the creation', async () => {
  const { fake, workspace, trackId } = faultyWorkspace(Number.POSITIVE_INFINITY);
  const document = 'DOC ghostnote-document 1.0 desired\nCLIP {"id":"c1","length":"8"}\n'
    + 'COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"c1","fields":"all","from":"0",'
    + '"status":"complete","to":"8"}\nFIELDS id clip at duration pitch velocity channel\n';
  const result = await callTool(workspace, 'add_launcher_clip', { trackId, row: 0, document },
    AGENT_NATIVE_TOOL_PROFILE) as Record<string, any>;
  assert.equal(fake.model.visibleTracks()[0]!.slots[0]!.hasContent, true, 'the creation landed');
  assert.ok(result.failure, 'the content step still refuses while the reads fail');
  assert.deepEqual(result.failure.effects.map((effect: any) => effect.summary), ['Created an empty clip of 8 beats.']);
  assert.equal(result.detail.revert.changeId, result.failure.effects[0].changeId);
  assert.equal(workspace.changes.list().length, 1, 'the creation is a recorded change');
});

test('E250: a rename whose verify read throws keeps its effect and is not verified', async () => {
  const { fake, workspace, trackId } = faultyWorkspace(1);
  const result = await callTool(workspace, 'rename_track', { tracks: [{ trackId, name: 'renamed' }] },
    AGENT_NATIVE_TOOL_PROFILE) as Record<string, any>;
  assert.equal(fake.model.visibleTracks()[0]!.name, 'renamed');
  assert.equal(result.applied, true);
  assert.equal(result.effects.length, 1);
  assert.notEqual(result.readback.status, 'verified');
  assert.equal(workspace.changes.list().length, 1);
});

test('E250: the executor take of an unread verify names each address as unverified', async () => {
  const fake = new FakeAdapter({ tracks: ['diagnostic'], scenes: 2 });
  const read = fake.read.bind(fake);
  const apply = fake.apply.bind(fake);
  let armed = false;
  fake.apply = async (batch) => { const receipt = await apply(batch); armed = true; return receipt; };
  fake.read = async (addresses, options) => {
    if (armed) throw new Error('verify read lost');
    return read(addresses, options);
  };
  const track = fake.model.visibleTracks()[0]!;
  const take = await new Executor(fake).run([{ op: 'track.rename', track: { kind: 'track', channelId: track.channelId },
    name: 'renamed' } as never]);
  assert.equal(fake.model.visibleTracks()[0]!.name, 'renamed');
  assert.equal(take.report.applied, true, 'the receipt is kept');
  assert.ok(take.report.unverified.length > 0);
  assert.ok(take.report.unverified.every((item) => /verification read failed: verify read lost/.test(item.why)));
});
