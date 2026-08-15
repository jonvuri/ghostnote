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
 *   W-mint     ops with no prior address AND no inverse are reported separately
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

test('W-pessim: a batch that writes notes and then deletes their clip restores BOTH (D16 rev)', () => {
  const { targets } = writeSetOf([
    { op: 'note.write', clip: CLIP, notes: [note] },
    { op: 'clip.delete', slot: S0 },
  ]);
  // ⚠ AMENDED 2026-08-07. This case used to assert `none` on the reason that a
  // deleted clip "has no readback that could reproduce it" — an ADAPTER ARTIFACT,
  // not an API limit (§3.3.3). The content was always stashed and the length was
  // always readable, so the clip is recreated at its captured length and the
  // notes go back into it; `revert.test.ts`'s R-clip proves the ORDER, which is
  // where the old objection was really pointing: replaying notes into a clip that
  // does not exist yet mispoints, silently (E2).
  const notesTarget = targets.find((t) => t.address.kind === 'notes')!;
  assert.equal(notesTarget.restore, 'replay');
  assert.deepEqual(notesTarget.opIndices, [0, 1], 'both ops touched it, and both are recorded');
  assert.equal(targets.find((t) => t.address.kind === 'clip')!.restore, 'replay');

  // The pessimistic MERGE itself is untouched and still load-bearing: no op pair
  // in today's contract produces a `none` on an address another op also touches,
  // and the day a Phase-4/5 variant does, "any op that cannot be reverted makes
  // the target `none` for all of them" is what stops the take over-promising.
  const mixed = writeSetOf([
    { op: 'note.write', clip: CLIP, notes: [note] },
    { op: 'track.delete', track: T },
  ]);
  assert.equal(mixed.targets.find((t) => t.address.kind === 'track')!.restore, 'none');
  assert.equal(mixed.targets.find((t) => t.address.kind === 'notes')!.restore, 'replay');
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
  // ⚠ AMENDED 2026-08-07 (D16 rev 2). `device.insert` is NOT here any more: it
  // has no prior state, but it does have an exact inverse — delete it at the
  // chain index the receipt minted — and this list is for ops that have neither.
  // `notify` mutates nothing, so its absence from BOTH lists is correct.
  assert.deepEqual(unrevertable.map((u) => u.op), ['track.create', 'scene.create']);
  assert.ok(unrevertable.every((u) => u.why.length > 0), 'D5: never silently under-deliver');
});

test('W-mint: `unrevertable` contains structural additions with no safe automatic delete', () => {
  // The fidelity floor can ignore this list: these ops have no prior state to
  // label. Created/copied tracks may receive human work before reversal, and a
  // new scene is not take-scoped; all remain visible in the report.
  const everyMinting: Op[] = [
    { op: 'track.create', name: 'gn-new' },
    { op: 'track.duplicate', track: T },
    { op: 'scene.create', count: 1 },
    { op: 'device.insert', track: T, source: { from: 'bitwig', uuid: 'abc' } },
    { op: 'clip.create', slot: S0, lengthBeats: 4 },
  ];
  assert.deepEqual(
    writeSetOf(everyMinting).unrevertable.map((u) => u.op).sort(),
    ['scene.create', 'track.create', 'track.duplicate'],
  );
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
