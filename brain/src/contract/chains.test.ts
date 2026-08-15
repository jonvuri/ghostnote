/**
 * Chain LOOKUP — the four answers, and why none of them may borrow another's.
 *
 * Step 6a made a chain nameable and refused everything else. This is the other
 * half: a name is walked against a real observation, and the ways it can fail
 * are kept apart because each asserts a different fact about the world.
 *
 *   found                 we saw the whole path.
 *   ambiguous             the name matched more than one chain — a SURPLUS, and
 *                         the one refusal `ChainAddress` names as an obligation.
 *   outside-bank-window   we saw a bank that may not hold everything.
 *   absent                we saw everything there was, and it is not there.
 *
 * ⚠ The pair that matters most is the last two, and the reason is the same one
 * `LiveAdapter.resolve` gives for tracks: a blind spot reported as a tombstone
 * makes a reversal silently under-deliver (E5, D5). A layer bank is FOUR wide,
 * so this is not a theoretical distinction — the fourth chain of a container is
 * the case, not the corner.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  chain, device, deviceIn, lookupChain, lookupDevice, lookupNestedDevice, mintedChain,
  nestingDepth, nestingObservable, track, verifyDeviceRelocation,
  type ObservedChain, type ObservedContainer,
} from './index.js';

const TRACK = track('cid-1');
const CONTAINER = device(TRACK, 0);

const oneChain = (name: string, index = 0, devices: string[] = [], complete = true): ObservedChain => ({
  index,
  name,
  devices: devices.map((n, i) => ({ index: i, name: n })),
  devicesComplete: complete,
});

/**
 * A chain with an explicit WITHIN-SESSION id — the only thing `mintedChain`
 * reads, and deliberately separate from `oneChain` so every lookup case above
 * keeps proving that resolution never touches it.
 */
const withId = (name: string, id: string, index = 0): ObservedChain =>
  ({ ...oneChain(name, index), id });

const container = (chains: ObservedChain[], complete = true): ObservedContainer =>
  ({ chains, chainsComplete: complete });

// --- the name is the identifier, and it is not unique --------------------------

test('N-lookup: a single name match is found, at the position the container reported', () => {
  const found = lookupChain(container([oneChain('other', 0), oneChain('A take', 3)]), 'A take');
  assert.equal(found.ok, true);
  // ⚠ 3, not 1. The enumeration skips empty bank slots, so the position in the
  // reply's array and the position in the bank are different numbers the moment
  // a container has a hole in it — and the bank position is the one a verb needs.
  assert.equal(found.ok && found.chain.index, 3);
});

test('N-lookup: a name matching TWO chains refuses as ambiguous, never the first hit', () => {
  // ⚠ The `e17n` artifact as a rule: duplicating a container gives its chains
  // identical names and different ids, and the ids are worthless across a
  // project load (E17ad, E18b). So this is the ordinary state of a duplicated
  // container, not a pathological fixture.
  const found = lookupChain(container([oneChain('A take', 0), oneChain('A take', 1)]), 'A take');
  assert.deepEqual(found, { ok: false, miss: 'ambiguous' });
});

test('N-lookup: ambiguity beats incompleteness — a surplus is not a window question', () => {
  const found = lookupChain(container([oneChain('dup', 0), oneChain('dup', 1)], false), 'dup');
  assert.deepEqual(found, { ok: false, miss: 'ambiguous' });
});

// --- absence and blindness ------------------------------------------------------

test('N-lookup: no match in a COMPLETE view is absent', () => {
  assert.deepEqual(
    lookupChain(container([oneChain('a', 0)]), 'nope'),
    { ok: false, miss: 'absent' },
  );
});

test('N-lookup: no match in a view that may be short is outside-bank-window', () => {
  // ⚠ The case that must never read as `absent`: four chains in a four-wide bank
  // is indistinguishable from five, because the reply carries only what exists.
  assert.deepEqual(
    lookupChain(container([oneChain('a', 0), oneChain('b', 1)], false), 'nope'),
    { ok: false, miss: 'outside-bank-window' },
  );
});

test('N-lookup: an empty container that was fully seen answers absent, not unsupported', () => {
  // A container with no chains is an OBSERVATION. Reporting it as "we cannot
  // look" would make an Instrument Layer — which ships with zero chains (e17ai)
  // — indistinguishable from a container nothing can see.
  assert.deepEqual(lookupChain(container([]), 'x'), { ok: false, miss: 'absent' });
});

// --- devices inside a chain -----------------------------------------------------

test('N-device: a device is found by its reported POSITION, not by array order', () => {
  const c: ObservedChain = {
    index: 0,
    name: 'A',
    devices: [{ index: 0, name: 'first' }, { index: 2, name: 'third' }],
    devicesComplete: true,
  };
  const at2 = lookupDevice(c, 2);
  assert.equal(at2.ok && at2.device.name, 'third');
  // ⚠ Position 1 is a HOLE in a complete view, so it is absent — an array-order
  // lookup would have answered "third" here, under the wrong address.
  assert.deepEqual(lookupDevice(c, 1), { ok: false, miss: 'absent' });
});

test('N-device: a device past a full device bank is outside-bank-window', () => {
  assert.deepEqual(
    lookupDevice(oneChain('A', 0, ['a', 'b'], false), 7),
    { ok: false, miss: 'outside-bank-window' },
  );
});

test('N-device: the whole path is walked — a missing chain is never a found device', () => {
  const inner = deviceIn(chain(CONTAINER, 'gone'), 0);
  assert.deepEqual(
    lookupNestedDevice(container([oneChain('present', 0, ['x'])]), inner),
    { ok: false, miss: 'absent' },
  );
});

test('N-device: an ambiguous chain refuses the device inside it with the same reason', () => {
  const inner = deviceIn(chain(CONTAINER, 'dup'), 0);
  assert.deepEqual(
    lookupNestedDevice(container([oneChain('dup', 0, ['x']), oneChain('dup', 1, ['y'])]), inner),
    { ok: false, miss: 'ambiguous' },
  );
});

// --- depth ----------------------------------------------------------------------

test('N-depth: only one level of nesting is observable, and deeper is unsupported', () => {
  const shallow = deviceIn(chain(CONTAINER, 'a'), 0);
  const deep = deviceIn(chain(deviceIn(chain(CONTAINER, 'a'), 0), 'b'), 0);
  assert.equal(nestingDepth(device(TRACK, 0)), 0);
  assert.equal(nestingDepth(shallow), 1);
  assert.equal(nestingDepth(deep), 2);
  assert.equal(nestingObservable(shallow), true);
  assert.equal(nestingObservable(deep), false);
  // ⚠ `unsupported`, and specifically NOT a truncated walk of the part we can
  // see. Answering about the outer chain would answer a question about one
  // device with a fact about another — the failure class the whole nested
  // refusal seam exists to prevent.
  assert.deepEqual(
    lookupNestedDevice(container([oneChain('a', 0, ['x'])]), deep),
    { ok: false, miss: 'unsupported' },
  );
});

test('N-depth: a top-level device is not a nested lookup at all', () => {
  assert.deepEqual(
    lookupNestedDevice(container([oneChain('a', 0)]), device(TRACK, 0)),
    { ok: false, miss: 'unsupported' },
  );
});

// --- which chain a CREATE just made ---------------------------------------------

test('N-mint: the new chain is identified by IDENTITY, not by where it landed', () => {
  // ⚠⚠ The case that makes position useless, and it is the ordinary one rather
  // than a corner: `Channel.duplicate()` copies a chain, and a copy carries its
  // SOURCE'S NAME. Both chains below are called "A take" and neither the name
  // nor the ordering separates them — only the id does.
  const before = container([withId('A take', 'id-src', 0)]);
  const after = container([withId('A take', 'id-src', 0), withId('A take', 'id-new', 1)]);
  const mint = mintedChain(before, after);
  assert.equal(mint.ok, true);
  assert.equal(mint.ok && mint.chain.id, 'id-new');
});

test('N-mint: the copy is found wherever it landed, not only after its source', () => {
  // Nothing has measured WHERE a duplicate lands, so nothing may depend on it.
  // Here it lands first, which a positional rule would resolve to the source.
  const before = container([withId('A take', 'id-src', 0)]);
  const after = container([withId('A take', 'id-new', 0), withId('A take', 'id-src', 1)]);
  const mint = mintedChain(before, after);
  assert.equal(mint.ok && mint.chain.id, 'id-new');
});

test('N-mint: a container that was already full BEFORE the copy mints NOTHING', () => {
  // ⚠ A full bank hides whatever is past it, so the prior set is unknown and a
  // chain that was already there could pass for the new one. Failing closed here
  // costs a mint; guessing costs a rename aimed at somebody else's chain.
  const before = container([withId('A', 'id-1', 0)], false);
  const after = container([withId('A', 'id-1', 0), withId('A', 'id-2', 1)]);
  assert.equal(mintedChain(before, after).ok, false);
});

test('N-mint: a container the copy FILLED is still minted — the last slot is usable', () => {
  // ⚠⚠ The asymmetry, and it is the difference between a working last slot and a
  // permanently broken one. A complete before view has strictly fewer chains
  // than the bank is wide, so the copy always lands inside the window — and
  // lands the container in the state a full bank always reports, incomplete.
  // Demanding completeness on both sides would decline every create that fills a
  // container and leave the copy wearing its source's name, every time.
  const before = container([withId('A', 'id-1', 0), withId('B', 'id-2', 1)]);
  const after = container(
    [withId('A', 'id-1', 0), withId('A', 'id-3', 1), withId('B', 'id-2', 2)], false);
  const mint = mintedChain(before, after);
  assert.equal(mint.ok && mint.chain.id, 'id-3');
});

test('N-mint: a copy that pushed a chain OUT of the window mints NOTHING', () => {
  // ⚠ The case the relaxation above must not let through, and the reason the
  // `lost` check is not redundant with the count: the after view grew by exactly
  // one AND a chain we could see before is gone from it, which is what a
  // container overflowing its bank looks like from here.
  const before = container([withId('A', 'id-1', 0), withId('B', 'id-2', 1)]);
  const after = container(
    [withId('A', 'id-1', 0), withId('A', 'id-3', 1), withId('C', 'id-4', 2)], false);
  const mint = mintedChain(before, after);
  assert.equal(mint.ok, false);
  assert.match(mint.ok ? '' : mint.why, /no longer there/);
});

test('N-mint: an enumeration with no per-chain identity mints NOTHING', () => {
  // An extension too old to report `channelId` answers with silence, which
  // `methodsHash` cannot see (it is over method NAMES). Silence must not decay
  // into a positional guess.
  const before = container([oneChain('A', 0)]);
  const after = container([oneChain('A', 0), oneChain('A', 1)]);
  const mint = mintedChain(before, after);
  assert.equal(mint.ok, false);
  assert.match(mint.ok ? '' : mint.why, /identity/);
});

test('N-mint: a container that did not grow by exactly one mints NOTHING', () => {
  const before = container([withId('A', 'id-1', 0)]);
  assert.equal(mintedChain(before, before).ok, false, 'nothing happened');
  assert.equal(
    mintedChain(before, container([
      withId('A', 'id-1', 0), withId('A', 'id-2', 1), withId('A', 'id-3', 2),
    ])).ok,
    false,
    'two appeared, so what happened is not the create that was asked for',
  );
});

test('N-mint: a chain that VANISHED across the create mints NOTHING', () => {
  // Same count, different objects. A rule that only counted would call this a
  // clean create and then rename a chain that replaced one somebody else lost.
  const before = container([withId('A', 'id-1', 0), withId('B', 'id-2', 1)]);
  const after = container([withId('A', 'id-1', 0), withId('B', 'id-3', 1), withId('B', 'id-4', 2)]);
  const mint = mintedChain(before, after);
  assert.equal(mint.ok, false);
  assert.match(mint.ok ? '' : mint.why, /no longer there/);
});

test('N-mint: a blank id counts as no id at all', () => {
  // `putGuarded` writes a string for an unreadable value, and an empty one would
  // otherwise be a perfectly good map key that matches every other blank.
  const before = container([withId('A', 'id-1', 0)]);
  const after = container([withId('A', 'id-1', 0), withId('A', '', 1)]);
  assert.equal(mintedChain(before, after).ok, false);
});

test('N-relocate: move and copy are proved from both structural halves', () => {
  const seq = (names: string[], complete = true) => ({
    devices: names.map((name, index) => ({ index, name })),
    devicesComplete: complete,
  });
  assert.equal(verifyDeviceRelocation(
    0, 'move', seq(['A', 'B']), seq([]), seq(['B']), seq(['A']),
  ).ok, true);
  assert.equal(verifyDeviceRelocation(
    0, 'copy', seq(['A']), seq(['B']), seq(['A']), seq(['B', 'A']),
  ).ok, true);
  const wrongOrder = verifyDeviceRelocation(
    0, 'move', seq(['A', 'B']), seq([]), seq(['B']), seq(['B', 'A']),
  );
  assert.equal(wrongOrder.ok, false);
  assert.match(wrongOrder.ok ? '' : wrongOrder.why, /destination readback/);
  const blind = verifyDeviceRelocation(
    0, 'move', seq(['A'], false), seq([]), seq([]), seq(['A']),
  );
  assert.equal(blind.ok, false, 'a partial bank cannot certify a relocation');
});
