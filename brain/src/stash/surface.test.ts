/**
 * The read/mutate split — **the one part of D17 that survives outright** (D17g),
 * asserted "in the spirit of `WIRE_METHODS_BANNED`".
 *
 * That spirit is the load-bearing part. `wiremap.test.ts` does not merely declare
 * that `app.invokeAction` is banned — it asserts the name appears nowhere the
 * contract can reach, so the ban survives a refactor by someone who never read
 * the finding.
 *
 * ⚠ **What this file asserts is unchanged; what it is FOR has moved.** D17g's
 * claim was about a take log: *the agent may read and explain it; it may never
 * mutate it.* D20 generalises the privilege boundary to *"a structural seam, not
 * a remembered rule — now at the MCP tool surface (D12 amendment) rather than
 * around a store object."* So this split is no longer THE boundary; it is the
 * in-process seam that makes the boundary cheap to hold, and the reason to keep
 * asserting it is narrower and sharper than it was: `record` and `forget` are how
 * the *"before"* for every unbranched write gets written and thrown away, and a
 * component holding a `StashLog` has no business doing either.
 *
 * It also asserts the stash is a LIBRARY — no adapter, no daemon, no wire — which
 * is what lets the whole of session 2 be proven offline in milliseconds.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STASH_MUTATORS, Stash, type StashLog } from './stash.js';

const HERE = dirname(fileURLToPath(import.meta.url));

test('S-split: every name in STASH_MUTATORS is a real mutator on the stash', () => {
  const s = new Stash();
  for (const name of Object.keys(STASH_MUTATORS)) {
    assert.equal(
      typeof (s as unknown as Record<string, unknown>)[name],
      'function',
      `${name} is listed as a mutator but is not one — the list would then ban nothing`,
    );
  }
  // The compiler already ties the list to `keyof StashWriter`; this catches the
  // other direction going stale, where a mutator is added and the map is not.
  //
  // ⚠ TWO, where the store had six. That is the retirement showing through, not a
  // weakened check: `append`/`setHead`/`label`/`prune`/`adopt`/`publishPointer`
  // were all ways of editing a HISTORY, and D18 left no history to edit.
  assert.equal(Object.keys(STASH_MUTATORS).length, 2);
});

test('S-split: NO mutator is reachable from the read half', () => {
  const s = new Stash();
  const log: StashLog = s.log;

  for (const [name, why] of Object.entries(STASH_MUTATORS)) {
    // `in` walks the whole prototype chain, which is the check that matters: a
    // read half implemented as `this` narrowed by a cast would pass a
    // `hasOwnProperty` test and fail this one.
    assert.equal(name in (log as object), false, `${name} is reachable from StashLog — ${why}`);
  }

  // ...and not by a route around the names, either.
  assert.equal(Object.getPrototypeOf(log), Object.prototype, 'no class prototype to inherit from');
  assert.ok(Object.isFrozen(log), 'a client must not be able to bolt a mutator on');
  for (const value of Object.values(log)) {
    assert.notEqual(value, s, 'no own property hands the stash back');
  }
  assert.throws(() => {
    (log as unknown as Record<string, unknown>)['record'] = () => undefined;
  }, TypeError);
});

test('S-split: the read half hands out COPIES, so a reader cannot edit the record in place', () => {
  const s = new Stash();
  assert.deepEqual(s.log.list(), []);
  assert.equal(s.log.get('nope'), undefined);
  // ⚠ Sharper here than it was for the store: the record a caller could mutate is
  // the "before" a reversal replays, so a shared reference is not an aliasing
  // wart, it is a route to restoring a state that never existed.
  assert.notEqual(s.log.list(), s.log.list());
});

test('S-offline: the stash imports no adapter, no daemon and no wire', async () => {
  const files = (await readdir(HERE)).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  assert.ok(files.length >= 4, 'the sweep must actually be looking at the module');

  for (const file of files) {
    const source = await readFile(join(HERE, file), 'utf8');
    for (const line of source.split('\n')) {
      if (!/^\s*(import|export)\b.*\bfrom\s+'/.test(line)) continue;
      assert.doesNotMatch(
        line,
        /from '[^']*\/adapters\//,
        `${file} imports an adapter. The stash is a pure library — that is why it can be tested ` +
          'exhaustively offline, and why the MCP server can hold one rather than be one.',
      );
      assert.doesNotMatch(line, /from '[^']*\/(client|mcp-server|probes)/, `${file} imports a process`);
    }
  }
});
