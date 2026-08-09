/**
 * The deploy-freshness check — the guard `contract.hello` structurally cannot be.
 *
 * ⚠ Every case here is pure arithmetic on two timestamps, deliberately: the
 * filesystem is injected so each branch is reachable without deploying anything,
 * and so the comparison cannot hide behind a `statSync` that happens to work on
 * one machine.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { compareDeployment } from './deploy.js';

const T = Date.parse('2026-08-08T19:41:00Z');

test('D-stale: a file written AFTER the running extension started is stale', () => {
  // The exact shape of the cycle this exists to prevent: `copyExtension` landed
  // the jar at 19:41 and Bitwig was still running an instance from before it.
  const d = compareDeployment(T, T - 60_000);
  assert.equal(d.state, 'stale');
  // ⚠ The remedy has to be IN the message. The failure looks like a Bitwig bug
  // from every angle except this one, and the fix is a manual controller reload
  // that nothing else in the toolchain mentions.
  assert.match(d.detail, /reloaded by hand/);
  assert.match(d.detail, /Settings -> Controllers/);
  // And it must say why the handshake did not catch it, or the next person
  // trusts the handshake again.
  assert.match(d.detail, /method NAMES/);
});

test('D-fresh: an extension that started after the deploy is fresh', () => {
  assert.equal(compareDeployment(T, T + 2_000).state, 'fresh');
});

test('D-fresh: equal timestamps are fresh, not stale', () => {
  // Strictly-after is the test, so a file and an init stamped the same
  // millisecond do not produce a permanent false alarm.
  assert.equal(compareDeployment(T, T).state, 'fresh');
});

test('D-unknown: no deployed file blocks nothing', () => {
  // ⚠ A brain running without the deploy tree must still work. The check is
  // local-only by construction (D12's loopback posture) and absence is not
  // evidence of staleness.
  const d = compareDeployment(undefined, T);
  assert.equal(d.state, 'unknown');
  assert.match(d.detail, /GHOSTNOTE_EXTENSION/);
});

test('D-unknown: the -1 sentinel is UNKNOWN, never a timestamp', () => {
  // ⚠ `initEpochMs` is -1 until init() completes. Treating the sentinel as a
  // date would put the running build in 1969 and make every extension look
  // stale by about fifty-five years — a check that always fires is a check that
  // gets switched off.
  const d = compareDeployment(T, -1);
  assert.equal(d.state, 'unknown');
  assert.match(d.detail, /sentinel/);
});
