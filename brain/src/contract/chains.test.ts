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
  chain, device, deviceIn, lookupChain, lookupDevice, lookupNestedDevice, nestingDepth,
  nestingObservable, track,
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
