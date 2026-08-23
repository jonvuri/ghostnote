/**
 * The address grammar, and specifically what NESTING was allowed to change:
 * nothing that already existed.
 *
 * `addressKey` is the canonical form the stash indexes by, the write-set diffs
 * on, and the partial-revert slice matches prefixes against. The golden strings
 * below keep existing keys stable. Session 4c gives DirectParameter ids their
 * own escaped namespace so they cannot collide with typed numeric indices.
 *
 * The other half is the seam: a deep parameter owns a confirmed recursive route.
 * Other device writes still refuse instead of indexing a nested position into
 * the track's own device chain.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ADDRESS_IDENTITY, InvalidOpError, addressKey, addressScene, addressTrack, assertDevicesRoutable,
  chain, chainPath, clip, clipLaunch, clipMetadata, clipPlay, device, deviceEnabled, deviceIn, deviceSlot,
  isNestedDevice, notes as notesAt,
  param, scene, slot, track,
  type Op,
} from './index.js';

const TRACK = track('cid-1');
const ROW = scene(2, 7);

// --- stable keys and the DirectParameter namespace -----------------------------

test('A-key: the canonical address grammar is explicit', () => {
  // ⚠ Written out, not computed. This case catches unintended grammar changes.
  assert.equal(addressKey(TRACK), 'track:cid-1');
  assert.equal(addressKey(ROW), 'scene:2@7');
  assert.equal(addressKey(slot(TRACK, ROW)), 'slot:cid-1:2@7');
  assert.equal(addressKey(clip(slot(TRACK, ROW))), 'clip:cid-1:2@7');
  assert.equal(addressKey(clipLaunch(clip(slot(TRACK, ROW)))), 'clipLaunch:cid-1:2@7');
  assert.equal(addressKey(clipMetadata(clip(slot(TRACK, ROW)))), 'clipMetadata:cid-1:2@7');
  assert.equal(addressKey(clipPlay(clip(slot(TRACK, ROW)))), 'clipPlay:cid-1:2@7');
  assert.equal(addressKey(notesAt(clip(slot(TRACK, ROW)), 3)), 'notes:cid-1:2@7:ch3');
  assert.equal(
    addressKey(notesAt(clip(slot(TRACK, ROW)), 0, { startBeats: 1, endBeats: 5 })),
    'notes:cid-1:2@7:ch0:1-5',
  );
  assert.equal(addressKey(device(TRACK, 4)), 'device:cid-1:4');
  assert.equal(addressKey(deviceEnabled(device(TRACK, 4))), 'deviceEnabled:cid-1:4');
  assert.equal(addressKey(param(device(TRACK, 4), 9)), 'param:cid-1:4:9');
  assert.equal(
    addressKey(param(device(TRACK, 4), 9, 'direct-id')),
    'param:cid-1:4:direct:direct-id',
  );
});

test('A-key: typed indices and DirectParameter ids have separate namespaces', () => {
  const target = device(TRACK, 4);
  const typed = param(target, 0);
  const direct = param(target, '0');

  assert.equal(addressKey(typed), 'param:cid-1:4:0');
  assert.equal(addressKey(direct), 'param:cid-1:4:direct:0');
  assert.notEqual(addressKey(typed), addressKey(direct));
  assert.equal(
    addressKey(param(target, 'group:id/0')),
    'param:cid-1:4:direct:group%3Aid%2F0',
  );
});

test('A-key: a top-level device key holds no nesting separator at all', () => {
  // The property the compatibility above rests on: `/` appears only in a nested
  // key, so no nested address can ever collide with a flat one.
  assert.equal(addressKey(device(TRACK, 4)).includes('/'), false);
  assert.equal(addressKey(param(device(TRACK, 4), 0)).includes('/'), false);
});

// --- what nesting adds ---------------------------------------------------------

test('A-key: a chain, a device inside it and that device\'s param each key distinctly', () => {
  const container = device(TRACK, 1);
  const alt = chain(container, 'A take');
  const inner = deviceIn(alt, 0);

  assert.equal(addressKey(alt), 'chain:cid-1:1/A%20take');
  assert.equal(addressKey(inner), 'device:cid-1:1/A%20take/0');
  assert.equal(addressKey(param(inner, 2)), 'param:cid-1:1/A%20take/0:2');

  // ⚠ And the one that matters: the nested device is NOT the top-level device at
  // the same index. These two keys addressed the same stash entry before nesting
  // was expressible at all.
  assert.notEqual(addressKey(inner), addressKey(device(TRACK, 0)));
});

test('A-key: nesting composes to arbitrary depth, outermost first', () => {
  const outer = chain(device(TRACK, 0), 'outer');
  const inner = chain(deviceIn(outer, 1), 'inner');
  const leaf = deviceIn(inner, 2);

  assert.equal(addressKey(leaf), 'device:cid-1:0/outer/1/inner/2');
  const parentName = (parent: ReturnType<typeof chainPath>[number]) => parent.kind === 'chain'
    ? parent.name
    : parent.kind === 'drumPad' ? parent.channel : parent.name;
  assert.deepEqual(chainPath(leaf).map(parentName), ['outer', 'inner']);
  assert.deepEqual(chainPath(inner).map(parentName), ['outer', 'inner']);
  assert.deepEqual(chainPath(device(TRACK, 0)), []);
  assert.equal(isNestedDevice(leaf), true);
  assert.equal(isNestedDevice(device(TRACK, 0)), false);
});

test('A-key: a named device slot cannot collide with a layer-chain name', () => {
  const container = device(TRACK, 0);
  const inSlot = deviceIn(deviceSlot(container, 'CHAIN'), 0);
  const inChain = deviceIn(chain(container, 'slot:CHAIN'), 0);

  assert.equal(addressKey(inSlot), 'device:cid-1:0/slot:CHAIN/0');
  assert.equal(addressKey(inChain), 'device:cid-1:0/slot%3ACHAIN/0');
  assert.notEqual(addressKey(inSlot), addressKey(inChain));
});

test('A-key: a chain NAME cannot forge another address\'s key', () => {
  // ⚠ The reason names are escaped, as an ACTUAL collision rather than a worry.
  // These two addresses name different devices in different places:
  const container = device(TRACK, 1);
  const forger = deviceIn(chain(container, 'A/0/B'), 5);
  const victim = deviceIn(chain(deviceIn(chain(container, 'A'), 0), 'B'), 5);

  // Unescaped, both would spell `device:cid-1:1/A/0/B/5` — one address wearing
  // another's key in the string the stash is indexed by and a partial revert
  // matches prefixes against.
  assert.equal(addressKey(forger).replaceAll('%2F', '/'), addressKey(victim));
  assert.notEqual(addressKey(forger), addressKey(victim));
  assert.equal(addressKey(forger), 'device:cid-1:1/A%2F0%2FB/5');

  // A colon is the other delimiter, and it is escaped for the same reason.
  assert.equal(addressKey(chain(container, 'a:b')), 'chain:cid-1:1/a%3Ab');
});

test('A-key: a blank chain name is refused, because it identifies nothing', () => {
  // A chain's channelId is minted afresh by every project load (E17ad, E18b), so
  // the name is the whole of its identity — and an empty one is shared by every
  // unnamed chain on the container.
  assert.throws(() => chain(device(TRACK, 0), ''), /non-empty name/);
  assert.throws(() => chain(device(TRACK, 0), '   '), /non-empty name/);
});

// --- what a nested address is anchored to --------------------------------------

test('A-anchor: the durable track survives every level of nesting', () => {
  const deep = deviceIn(chain(deviceIn(chain(device(TRACK, 0), 'a'), 0), 'b'), 0);
  assert.equal(addressTrack(deep)?.channelId, 'cid-1');
  assert.equal(addressTrack(chain(device(TRACK, 3), 'a'))?.channelId, 'cid-1');
  assert.equal(addressTrack(deviceEnabled(device(TRACK, 4)))?.channelId, 'cid-1');
  assert.equal(addressTrack(param(deep, 0))?.channelId, 'cid-1');
  // A device address hangs off no scene row, at any depth — so a scene op cannot
  // stale one, and `addressScene` must not start claiming otherwise.
  assert.equal(addressScene(deep), undefined);
  assert.equal(addressScene(chain(device(TRACK, 3), 'a')), undefined);
});

test('A-anchor: a chain is POSITIONAL despite the durable name inside it', () => {
  // The container is a chain position, and a device-chain edit re-indexes it (E3).
  assert.equal(ADDRESS_IDENTITY.chain, 'positional');
  assert.equal(ADDRESS_IDENTITY.track, 'durable');
});

// --- the seam between naming something and being able to write to it -----------

test('A-route: only parameter writes own the confirmed nested route', () => {
  const inner = deviceIn(chain(device(TRACK, 1), 'A take'), 0);

  assert.throws(
    () => assertDevicesRoutable([{ op: 'device.delete', device: inner }]),
    (error: unknown) => error instanceof InvalidOpError && /device-layer chain/.test(String(error)),
  );
  assert.throws(
    () => assertDevicesRoutable([{ op: 'device.setEnabled', device: inner, enabled: false }]),
    (error: unknown) => error instanceof InvalidOpError && /device-layer chain/.test(String(error)),
  );
  assert.doesNotThrow(
    () => assertDevicesRoutable([{ op: 'param.set', param: param(inner, 0), value: 0.5 }]),
  );
});

test('A-route: the refusal names the path, so a caller can see WHICH chain', () => {
  const deep = deviceIn(chain(deviceIn(chain(device(TRACK, 0), 'outer'), 0), 'inner'), 0);
  assert.throws(
    () => assertDevicesRoutable([{ op: 'device.delete', device: deep }]),
    /outer > inner/,
  );
});

test('A-route: top-level device ops still pass, so the refusal is not blanket', () => {
  const ops: Op[] = [
    { op: 'device.delete', device: device(TRACK, 0) },
    { op: 'device.setEnabled', device: device(TRACK, 0), enabled: false },
    { op: 'param.set', param: param(device(TRACK, 1), 0), value: 0.25 },
    { op: 'device.insert', track: TRACK, source: { from: 'bitwig', uuid: 'u' } },
    { op: 'note.clear', clip: clip(slot(TRACK, ROW)) },
  ];
  assert.doesNotThrow(() => assertDevicesRoutable(ops));
});
