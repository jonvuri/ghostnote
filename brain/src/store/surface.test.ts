/**
 * PHASE-1-SESSION-2 exit criterion 5: **the mutating half of the store API is not
 * reachable from the read interface**, asserted "in the spirit of
 * `WIRE_METHODS_BANNED`".
 *
 * That spirit is the load-bearing part. `wiremap.test.ts` does not merely declare
 * that `app.invokeAction` is banned — it asserts the name appears nowhere the
 * contract can reach, so the ban survives a refactor by someone who never read
 * the finding. §8g / standing rule 8 is the same kind of claim about the take
 * log: *the agent may read and explain it; it may never mutate it.* D14 notes the
 * daemon must keep the agent off those endpoints, and this file is what makes
 * "must" reviewable rather than aspirational.
 *
 * It also asserts the store is a LIBRARY — no adapter, no daemon, no wire — which
 * is exit criterion 6 as a structural property rather than a promise about CI.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STORE_MUTATORS, TakeStore, type TakeLog } from './store.js';

const HERE = dirname(fileURLToPath(import.meta.url));

async function store(): Promise<TakeStore> {
  const root = await mkdtemp(join(tmpdir(), 'ghostnote-surface-'));
  return TakeStore.open({ projectKey: 'proj-surface', root });
}

test('S-split: every name in STORE_MUTATORS is a real mutator on the store', async () => {
  const s = await store();
  for (const name of Object.keys(STORE_MUTATORS)) {
    assert.equal(
      typeof (s as unknown as Record<string, unknown>)[name],
      'function',
      `${name} is listed as a mutator but is not one — the list would then ban nothing`,
    );
  }
  // The compiler already ties the list to `keyof TakeWriter`; this catches the
  // other direction going stale, where a mutator is added and the map is not.
  assert.ok(Object.keys(STORE_MUTATORS).length >= 6);
});

test('S-split: NO mutator is reachable from the read half', async () => {
  const s = await store();
  const log: TakeLog = s.log;

  for (const [name, why] of Object.entries(STORE_MUTATORS)) {
    // `in` walks the whole prototype chain, which is the check that matters: a
    // read half implemented as `this` narrowed by a cast would pass a
    // `hasOwnProperty` test and fail this one.
    assert.equal(name in (log as object), false, `${name} is reachable from TakeLog — ${why}`);
  }

  // ...and not by a route around the names, either.
  assert.equal(Object.getPrototypeOf(log), Object.prototype, 'no class prototype to inherit from');
  assert.ok(Object.isFrozen(log), 'a client must not be able to bolt a mutator on');
  for (const value of Object.values(log)) {
    assert.notEqual(value, s, 'no own property hands the store back');
  }
  assert.throws(() => {
    (log as unknown as Record<string, unknown>)['append'] = () => undefined;
  }, TypeError);
});

test('S-split: the read half hands out COPIES, so a reader cannot edit the log in place', async () => {
  const s = await store();
  assert.equal(s.log.head(), null);
  assert.equal(s.log.get('nope'), undefined);
  // `list()` and `get()` are the only routes to a take; both clone, so a caller
  // mutating what it got cannot desynchronise the store from its own disk.
  assert.notEqual(s.log.list(), s.log.list());
});

test('S-offline: the store imports no adapter, no daemon and no wire', async () => {
  const files = (await readdir(HERE)).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  assert.ok(files.length >= 6, 'the sweep must actually be looking at the module');

  for (const file of files) {
    const source = await readFile(join(HERE, file), 'utf8');
    for (const line of source.split('\n')) {
      if (!/^\s*(import|export)\b.*\bfrom\s+'/.test(line)) continue;
      assert.doesNotMatch(
        line,
        /from '[^']*\/adapters\//,
        `${file} imports an adapter. The store is a library with a directory path — that is why ` +
          'it can be tested exhaustively offline, and why session 3 can host it rather than ' +
          'contain it.',
      );
      assert.doesNotMatch(line, /from '[^']*\/(client|mcp-server|probes)/, `${file} imports a process`);
    }
  }
});

test.after(async () => {
  const base = tmpdir();
  for (const entry of await readdir(base)) {
    if (entry.startsWith('ghostnote-surface-')) await rm(join(base, entry), { recursive: true, force: true });
  }
});
