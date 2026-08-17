import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import {
  addressKey, clip, notes as notesAt, scene, slot, track, type NoteRecord,
} from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { workspaceOf, type Workspace } from '../surface/workspace.js';
import {
  MUSICAL_CORPUS_V1_SHA256, MUSICAL_OPERATION_SEMANTICS, MUSICAL_PATCH_POLICY,
  MUSICAL_PATCH_VERSION, MUSICAL_REQUEST_CORPUS, MusicalPatchError,
  assertMusicalToolBoundary, compileMusicalClip, decodeMusicalPatch,
  describeMusicalPatch, encodeMusicalPatch, fingerprintMusicalCorpus,
  musicalRandom, musicalSeedScope, parseMusicalPatch,
} from './index.js';

const accepted = MUSICAL_REQUEST_CORPUS.filter((entry) => entry.outcome.kind === 'patch');

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, ...over,
});

function materialized(
  channel: number,
  write: 'merge' | 'replace',
  notes: readonly NoteRecord[],
  targetIndex = 0,
) {
  return {
    channel, write, notes, targetIndex, variationIndex: 0, operationIndex: 0,
  } as const;
}

async function offlineFixture(): Promise<{
  fake: FakeAdapter;
  workspace: Workspace;
  address: ReturnType<typeof clip>;
}> {
  const fake = new FakeAdapter({ tracks: ['gn-A'], scenes: 4 });
  const [trackState] = await fake.tracks();
  const at = await fake.revision();
  const address = clip(slot(track(trackState!.channelId), scene(0, at.sceneEpoch)));
  const stash = new Stash({ now: () => 1 });
  let change = 0;
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter: fake,
    executor: new Executor(fake, { newId: () => `musical-${++change}`, now: () => 1 }),
    stash,
    observationStore: new FakeObservationStore(),
  });
  await workspace.apply([{ op: 'clip.create', slot: address.slot, lengthBeats: 8 }]);
  return { fake, workspace, address };
}

async function preflight(workspace: Workspace, address: ReturnType<typeof clip>) {
  const addresses = Array.from({ length: 16 }, (_, channel) => notesAt(address, channel));
  const snapshot = await workspace.read(addresses);
  return {
    revision: snapshot.at.revision,
    channels: addresses.map((notesAddress) => {
      const entry = snapshot.entries[addressKey(notesAddress)];
      assert.equal(entry?.value.of, 'notes');
      return {
        channel: notesAddress.channel,
        notes: entry!.value.of === 'notes' ? entry!.value.notes : [],
      };
    }),
  };
}

async function channelNotes(
  workspace: Workspace,
  address: ReturnType<typeof clip>,
  channel: number,
): Promise<readonly NoteRecord[]> {
  const notesAddress = notesAt(address, channel);
  const snapshot = await workspace.read([notesAddress]);
  const entry = snapshot.entries[addressKey(notesAddress)];
  return entry?.value.of === 'notes' ? entry.value.notes : [];
}

test('M-golden: the representative requests, canonical patches, and report shapes stay fixed', () => {
  assert.equal(fingerprintMusicalCorpus(), MUSICAL_CORPUS_V1_SHA256);
});

test('M-corpus: every request maps to a valid canonical patch or an explicit refusal', () => {
  assert.ok(MUSICAL_REQUEST_CORPUS.length >= 10);
  for (const entry of MUSICAL_REQUEST_CORPUS) {
    if (entry.outcome.kind === 'refusal') {
      assert.ok(entry.outcome.reason.length > 20, entry.id);
      continue;
    }
    const encoded = encodeMusicalPatch(entry.outcome.patch);
    assert.equal(encodeMusicalPatch(decodeMusicalPatch(encoded)), encoded, entry.id);
    assertMusicalToolBoundary(entry.outcome.patch, entry.tool);
    assert.equal(describeMusicalPatch(entry.outcome.patch).targets.length,
      entry.outcome.patch.targets.length, entry.id);
  }
});

test('M-semantics: every operation states input, output, ownership, order, and possible loss', () => {
  assert.deepEqual(Object.keys(MUSICAL_OPERATION_SEMANTICS).sort(), [
    'arpeggiate', 'densify', 'generate', 'harmonize', 'humanize',
    'quantize', 'revoice', 'thin', 'transpose',
  ]);
  for (const semantics of Object.values(MUSICAL_OPERATION_SEMANTICS)) {
    assert.ok(semantics.input.length > 0);
    assert.ok(semantics.output.length > 0);
    assert.ok(semantics.changedFields.length > 0);
    assert.ok(semantics.ordering.length > 0);
    assert.ok(Array.isArray(semantics.preservedFields));
    assert.ok(Array.isArray(semantics.possibleLoss));
  }
});

test('M-version: an incompatible serialized version is rejected explicitly', () => {
  const patch = accepted[0]!.outcome;
  assert.equal(patch.kind, 'patch');
  const incompatible = { ...patch.patch, version: MUSICAL_PATCH_VERSION + 1 };
  assert.throws(
    () => parseMusicalPatch(incompatible),
    (error) => error instanceof MusicalPatchError && /version mismatch.*v2/.test(error.message),
  );
});

test('M-channel: merge emits its channel and replace reconstructs all preserved channels', () => {
  const address = clip(slot(track('track-a'), scene(2, 7)));
  const notes = [{ startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1 }];
  const preserved = [{ startBeats: 0, pitch: 48, velocity: 90, durationBeats: 2 }];
  const channels = Array.from({ length: 16 }, (_, channel) => ({
    channel, notes: channel === 1 ? preserved : [],
  }));
  assert.deepEqual(compileMusicalClip(
    address, [materialized(9, 'merge', notes)], { revision: 4, channels },
  ).ops, [
    { op: 'note.write', clip: address, channel: 9, notes },
  ]);
  assert.deepEqual(compileMusicalClip(
    address, [
      materialized(3, 'replace', notes),
      materialized(9, 'replace', preserved, 1),
    ], { revision: 4, channels },
  ).ops, [
    { op: 'note.clear', clip: address },
    { op: 'note.write', clip: address, channel: 1, notes: preserved },
    { op: 'note.write', clip: address, channel: 3, notes },
    { op: 'note.write', clip: address, channel: 9, notes: preserved },
  ]);
  assert.throws(
    () => compileMusicalClip(
      address,
      [materialized(3, 'replace', notes)],
      { revision: 4, channels: channels.slice(0, 15) },
    ),
    /every MIDI channel 0-15/,
  );
});

test('M-merge-apply: duplicate identities refuse and overlaps report before offline apply', async () => {
  const { workspace, address } = await offlineFixture();
  await workspace.apply([{
    op: 'note.write', clip: address, channel: 4,
    notes: [note({ durationBeats: 2 })],
  }]);

  const before = await preflight(workspace, address);
  assert.throws(
    () => compileMusicalClip(
      address,
      [materialized(4, 'merge', [note({ durationBeats: 0.5 })])],
      before,
    ),
    /duplicate note identity refused.*channel 4.*pitch 60.*beat 0/,
  );

  const compiled = compileMusicalClip(
    address,
    [materialized(4, 'merge', [note({ startBeats: 1, durationBeats: 1 })])],
    before,
  );
  assert.deepEqual(compiled.loss.map((item) => item.code), ['note-shortened']);
  assert.equal(compiled.loss[0]!.before?.durationBeats, 2);
  assert.equal(compiled.loss[0]!.after?.durationBeats, 1);
  const change = await workspace.apply(compiled.ops, { ifRevision: compiled.ifRevision });
  assert.equal(change.take.report.applied, true);
  assert.deepEqual(
    (await channelNotes(workspace, address, 4)).map((item) => [item.startBeats, item.durationBeats]),
    [[0, 1], [1, 1]],
  );
});

test('M-replace-apply: all-channel guard refuses a stale preflight and reconstruction does not duplicate channels', async () => {
  const { fake, workspace, address } = await offlineFixture();
  await workspace.apply([
    { op: 'note.write', clip: address, channel: 1, notes: [note({ pitch: 48 })] },
    { op: 'note.write', clip: address, channel: 9, notes: [note({ pitch: 69 })] },
  ]);
  const stale = await preflight(workspace, address);

  await fake.apply({
    ops: [{
      op: 'note.write', clip: address, channel: 7,
      notes: [note({ startBeats: 2, pitch: 55 })],
    }],
    ifRevision: stale.revision,
  });
  await fake.settle('noteWrite');

  const staleCompilation = compileMusicalClip(
    address,
    [materialized(3, 'replace', [note({ pitch: 72 })])],
    stale,
  );
  const rejected = await workspace.apply(
    staleCompilation.ops,
    { ifRevision: staleCompilation.ifRevision },
  );
  assert.equal(rejected.take.report.applied, false);
  assert.equal(rejected.take.report.rejected?.reason, 'stale-revision');
  assert.deepEqual((await channelNotes(workspace, address, 7)).map((item) => item.pitch), [55]);
  assert.deepEqual(await channelNotes(workspace, address, 3), []);

  const current = await preflight(workspace, address);
  const compiled = compileMusicalClip(
    address,
    [materialized(3, 'replace', [note({ pitch: 72 })])],
    current,
  );
  const applied = await workspace.apply(compiled.ops, { ifRevision: compiled.ifRevision });
  assert.equal(applied.take.report.applied, true);
  assert.deepEqual((await channelNotes(workspace, address, 1)).map((item) => item.pitch), [48]);
  assert.deepEqual((await channelNotes(workspace, address, 3)).map((item) => item.pitch), [72]);
  assert.deepEqual((await channelNotes(workspace, address, 7)).map((item) => item.pitch), [55]);
  assert.deepEqual((await channelNotes(workspace, address, 9)).map((item) => item.pitch), [69]);
  assert.equal(fake.model.tracks[0]!.slots[0]!.notes.size, 4);
});

test('M-seed: scopes are stable and distinct by target, variation, and operation', () => {
  assert.equal(
    musicalSeedScope('seed', 1, 2, 3),
    'd464f44de37b4a3e5ce145d15ad5575d86d8f68a4814b6736c0ce81bc51f95f6',
  );
  assert.notEqual(musicalSeedScope('seed', 1, 2, 3), musicalSeedScope('seed', 1, 3, 3));
  assert.equal(musicalRandom(musicalSeedScope('seed', 1, 2, 3), 0), 0.6283643633400076);
  assert.ok(musicalRandom(musicalSeedScope('seed', 1, 2, 3), 1) >= 0);
  assert.ok(musicalRandom(musicalSeedScope('seed', 1, 2, 3), 1) < 1);
  assert.throws(() => musicalRandom('scope', -1), /non-negative safe integer/);
});

test('M-refusal: pressure, missing random seeds, duplicate targets, and mixed boundaries refuse', () => {
  const literal = accepted.find((entry) => entry.id === 'literal-expression-merge')!.outcome;
  assert.equal(literal.kind, 'patch');
  const raw = JSON.parse(encodeMusicalPatch(literal.patch)) as Record<string, unknown>;
  const targets = raw['targets'] as { operations: { source: { notes: Record<string, unknown>[] } }[] }[];
  targets[0]!.operations[0]!.source.notes[0]!['pressure'] = 0.5;
  assert.throws(() => parseMusicalPatch(raw), /pressure|Unrecognized key/);

  const humanize = accepted.find((entry) => entry.id === 'expression-preserving-humanize')!.outcome;
  assert.equal(humanize.kind, 'patch');
  assert.throws(() => parseMusicalPatch({ ...humanize.patch, seed: undefined }), /seed is required/);

  const channels = accepted.find((entry) => entry.id === 'several-midi-channels')!.outcome;
  assert.equal(channels.kind, 'patch');
  assert.throws(() => parseMusicalPatch({
    ...channels.patch, targets: [channels.patch.targets[0], channels.patch.targets[0]],
  }), /duplicate clip channel target/);

  assert.throws(() => assertMusicalToolBoundary(literal.patch, 'transformation'), /existing clip content/);
});

test('M-policy: range, collision, merge, replace, and protection rules are explicit', () => {
  assert.match(MUSICAL_PATCH_POLICY.merge, /Keep existing notes/);
  assert.match(MUSICAL_PATCH_POLICY.replace, /Preflight all 16 channels.*reconstruct/);
  assert.match(MUSICAL_PATCH_POLICY.collision, /Shorten.*report/);
  assert.match(MUSICAL_PATCH_POLICY.midiRange, /Refuse.*0-127/);
  assert.match(MUSICAL_PATCH_POLICY.protection, /stash-backed.*clip block/);
});
