/**
 * Write-set derivation — pure, so no adapter and no clock.
 *
 * What is being protected: §8b's whole claim is that a patch has a KNOWN
 * write-set before it executes. Every failure here is a take that silently
 * cannot restore something it appeared to cover, which is the one failure class
 * this project exists to prevent.
 *
 *   W-notes    granularity is the whole clip channel, never the written range
 *   W-merge    one address touched by several ops is ONE target
 *   W-pessim   a merge takes the WORST restorability, never the first
 *   W-identity ops that mint or destroy identity are `none`, with a reason
 *   W-mint     ops with no prior address at all are reported separately
 *   W-risk     positional degradation is gated on ADDRESS_IDENTITY
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addressKey, clip, device, notes as notesAt, param, scene, slot, track, type Op } from '../contract/index.js';
import { isAtRisk, structuralRisk, writeSet, writeSetOf } from './write-set.js';

const T = track('b07f6b06-8f4f-4f4f-802d-ddf1a5190515');
const S0 = slot(T, scene(0, 1));
const CLIP = clip(S0);
const note = { startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1 };

test('W-notes: the write-set of a note op is the WHOLE clip channel, never its range (E8-E)', () => {
  const ranged: Op = {
    op: 'note.clear', clip: CLIP, channel: 2, range: { startBeats: 4, endBeats: 8 },
  };
  const [address] = writeSet([ranged]);
  assert.equal(address?.kind, 'notes');
  // A write truncates same-pitch neighbours OUTSIDE its own extent (E8-E), so a
  // bounding-box stash would miss exactly the state the op is about to damage.
  assert.equal(addressKey(address!), addressKey(notesAt(CLIP, 2)));
});

test('W-merge: several ops on one address produce ONE target carrying all their indices', () => {
  const { targets } = writeSetOf([
    { op: 'note.clear', clip: CLIP },
    { op: 'note.write', clip: CLIP, notes: [note] },
    { op: 'note.props', clip: CLIP, notes: [note] },
  ]);
  assert.equal(targets.length, 1);
  assert.deepEqual(targets[0]!.opIndices, [0, 1, 2]);
  assert.equal(targets[0]!.restore, 'replay');
});

test('W-pessim: a batch that writes notes and then deletes their clip restores NEITHER', () => {
  const { targets } = writeSetOf([
    { op: 'note.write', clip: CLIP, notes: [note] },
    { op: 'clip.delete', slot: S0 },
  ]);
  const notesTarget = targets.find((t) => t.address.kind === 'notes')!;
  // Merging optimistically here would produce a take that offers to replay notes
  // into a clip that no longer exists — which mispoints, silently (E2).
  assert.equal(notesTarget.restore, 'none');
  assert.match(notesTarget.reason ?? '', /deleted clip cannot be recreated/);
});

test('W-clipcreate: a create stashes the slot AND its notes, and both stay replayable', () => {
  const { targets } = writeSetOf([{ op: 'clip.create', slot: S0, lengthBeats: 4 }]);
  assert.deepEqual(targets.map((t) => t.address.kind), ['clip', 'notes']);
  // `exists: false` is what makes the inverse available and exact: absence has
  // no content to fail to recreate.
  assert.ok(targets.every((t) => t.restore === 'replay'));
});

test('W-identity: track.delete is `none` — a recreated track is a DIFFERENT track (E2f)', () => {
  const { targets } = writeSetOf([{ op: 'track.delete', track: T }]);
  assert.equal(targets[0]!.restore, 'none');
  assert.match(targets[0]!.reason ?? '', /channelId. is minted fresh/);
});

test('W-identity: track.rename IS replayable — the name round-trips exactly', () => {
  const { targets } = writeSetOf([{ op: 'track.rename', track: T, name: 'x' }]);
  assert.equal(targets[0]!.restore, 'replay');
});

test('W-mint: ops with no prior address are reported, not dropped on the floor', () => {
  const { targets, unrevertable } = writeSetOf([
    { op: 'track.create', name: 'gn-new' },
    { op: 'scene.create', count: 1 },
    { op: 'device.insert', track: T, source: { from: 'bitwig', uuid: 'abc' } },
    { op: 'notify', message: 'hi' },
  ]);
  assert.deepEqual(targets, [], 'none of these has prior state to stash');
  // `notify` mutates nothing, so its absence from BOTH lists is correct.
  assert.deepEqual(unrevertable.map((u) => u.op), ['track.create', 'scene.create', 'device.insert']);
  assert.ok(unrevertable.every((u) => u.why.length > 0), 'D5: never silently under-deliver');
});

test('W-risk: a positional address degrades only when the batch can actually MOVE it', () => {
  const quiet = structuralRisk([{ op: 'note.write', clip: CLIP, notes: [note] }]);
  assert.deepEqual(quiet, { scenes: false, deviceChains: false });
  assert.equal(isAtRisk(notesAt(CLIP), quiet), false);

  // ⚠ E3: scene deletion COMPACTS the rows below it, so every scene-relative
  // address in the same batch is suspect.
  const scenes = structuralRisk([{ op: 'scene.delete', scene: scene(1, 1) }]);
  assert.equal(isAtRisk(notesAt(CLIP), scenes), true);
  // ...but a track address is anchored to a durable channelId, so it is not.
  assert.equal(isAtRisk(T, scenes), false);
  // ...and a device chain is a different hazard with a different trigger.
  assert.equal(isAtRisk(param(device(T, 0), 3), scenes), false);

  const chains = structuralRisk([{ op: 'device.delete', device: device(T, 0) }]);
  assert.equal(isAtRisk(param(device(T, 0), 3), chains), true);
  assert.equal(isAtRisk(notesAt(CLIP), chains), false);
});
