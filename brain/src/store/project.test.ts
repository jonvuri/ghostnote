/**
 * Project identity and the two-record disagreement.
 *
 * The store keeps take CONTENTS; the project document keeps the ACTIVE TAKE
 * POINTER (E14-A3/A4: document state survives save + a full Bitwig restart, and
 * is scoped per project). Two records can disagree, and PHASE-1 is explicit that
 * *"detection matters more than resolution here — surface it, don't guess."*
 *
 * These cases are the surfacing, and the one that decides the design is
 * `P-unsaved`: the pointer and the music are written by the same save, so a
 * project that comes back from disk is at the pointer's take no matter what the
 * store's own head remembers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { clip, scene, slot, track, type ClipAddress, type NoteRecord } from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { ProjectKeyError } from './errors.js';
import { MemoryProjectKeySource, assertProjectKey, resolveProjectIdentity } from './project.js';
import { TakeStore } from './store.js';

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, ...over,
});

interface Fixture {
  readonly executor: Executor;
  readonly store: TakeStore;
  readonly root: string;
  readonly clipA: ClipAddress;
}

async function fixture(): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), 'ghostnote-project-'));
  const fake = new FakeAdapter({ tracks: ['gn-A'], scenes: 4 });
  const [a] = fake.model.visibleTracks();
  const slotA = slot(track(a!.channelId), scene(0, 1));
  await fake.apply({ ops: [{ op: 'clip.create', slot: slotA, lengthBeats: 4 }] });
  await fake.settle('trackStruct');
  let n = 0;
  const executor = new Executor(fake, { newId: () => `take-${++n}`, now: () => 1000 });
  const store = await TakeStore.open({ projectKey: 'proj-pointer', root });
  return { executor, store, root, clipA: clip(slotA) };
}

async function commit(fx: Fixture, pitch: number): Promise<string> {
  const take = await fx.executor.run([{ op: 'note.write', clip: fx.clipA, notes: [note({ pitch })] }]);
  await fx.store.append(take);
  return take.id;
}

// --- the key -----------------------------------------------------------------

test('P-key: a project key is minted once and reused thereafter', async () => {
  const source = new MemoryProjectKeySource(null, 'Untitled');
  const first = await resolveProjectIdentity(source, () => 'proj-abc');
  assert.deepEqual(first, { key: 'proj-abc', minted: true, hint: 'Untitled' });

  // The second call is the reopen: same document, same key, and nothing minted.
  const again = await resolveProjectIdentity(source, () => 'proj-SHOULD-NOT-BE-USED');
  assert.equal(again.key, 'proj-abc');
  assert.equal(again.minted, false);
});

test('P-key: an unsafe key is REFUSED, never sanitized', () => {
  // Sanitizing would map two projects onto one directory and merge two humans'
  // take logs — the same class of silent aliasing D6 outlaws for tracks.
  for (const bad of ['../escape', 'has/slash', '', '.', 'x'.repeat(129)]) {
    assert.throws(() => assertProjectKey(bad), ProjectKeyError, bad);
  }
  assertProjectKey('9f6d2c1a-0b3e-4d5f-8a71-2c3d4e5f6a7b');
});

// --- the pointer -------------------------------------------------------------

test('P-agree: matching records are not a divergence at all', async () => {
  const fx = await fixture();
  const one = await commit(fx, 60);
  assert.equal(await fx.store.adopt(one), undefined);
  assert.equal(fx.store.head(), one);
});

test('P-unsaved: the PROJECT wins, because the pointer and the music are saved together', async () => {
  const fx = await fixture();
  const source = new MemoryProjectKeySource('proj-pointer');

  const one = await commit(fx, 60);
  await fx.store.publishPointer(source);
  source.save(); // the human hits Cmd-S here, and nowhere after it.

  const two = await commit(fx, 62);
  const three = await commit(fx, 64);
  await fx.store.publishPointer(source);
  assert.equal(fx.store.head(), three);

  // Close without saving, reopen: what comes back off disk is the project as of
  // the last save — its clips AND its pointer, written by the same operation.
  const reopened = await TakeStore.open({ projectKey: 'proj-pointer', root: fx.root });
  const divergence = await reopened.adopt(await source.reopen().readPointer());

  assert.equal(divergence?.reason, 'store-ahead');
  assert.equal(divergence?.adopted, true);
  assert.equal(reopened.head(), one, 'the head moves back to where the music actually is');
  assert.match(divergence!.detail, /written by the same save/);

  // ⚠ And the takes after it are not lost — they are an abandoned branch, which
  // is the branching model doing its job rather than a special case.
  assert.deepEqual(reopened.log.children(one), [two]);
  assert.notEqual(reopened.log.get(three), undefined);
});

test('P-unknown: a pointer we have never seen moves NOTHING and says so', async () => {
  const fx = await fixture();
  const one = await commit(fx, 60);

  const divergence = await fx.store.adopt('take-from-another-machine');
  assert.equal(divergence?.reason, 'unknown-take');
  assert.equal(divergence?.adopted, false);
  assert.equal(fx.store.head(), one, 'nothing moved');
  assert.match(divergence!.detail, /guessing a nearby take would be worse/);
});

test('P-nopointer: a project document with no pointer is surfaced, not assumed about', async () => {
  const fx = await fixture();
  const one = await commit(fx, 60);

  const divergence = await fx.store.adopt(null);
  assert.equal(divergence?.reason, 'no-pointer');
  assert.equal(divergence?.adopted, false);
  assert.equal(fx.store.head(), one);
  assert.match(divergence!.detail, /backup or a copy/);
});

test('P-diverged: a project that came back on another branch still wins', async () => {
  const fx = await fixture();
  const one = await commit(fx, 60);
  const two = await commit(fx, 62);
  await fx.store.setHead(one);
  const branch = await commit(fx, 64);

  const divergence = await fx.store.adopt(two);
  assert.equal(divergence?.reason, 'diverged');
  assert.equal(divergence?.adopted, true);
  assert.equal(fx.store.head(), two);
  assert.notEqual(fx.store.log.get(branch), undefined, "and our branch is not deleted");
});

test('P-corrupt: a head naming an unreadable take is cleared rather than trusted', async () => {
  const fx = await fixture();
  await commit(fx, 60);
  await rm(join(fx.root, 'projects', 'proj-pointer', 'takes', 'take-1.json'));

  const reopened = await TakeStore.open({ projectKey: 'proj-pointer', root: fx.root });
  assert.equal(reopened.head(), null);
  assert.match(reopened.log.unreadable()[0]!.why, /head pointed at take take-1/);
});

test.after(async () => {
  const base = tmpdir();
  for (const entry of await readdir(base)) {
    if (entry.startsWith('ghostnote-project-')) await rm(join(base, entry), { recursive: true, force: true });
  }
});
