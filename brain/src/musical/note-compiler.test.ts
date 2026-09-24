import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import {
  clip, scene, slot, track, type ClipAddress, type NoteRecord, type Op,
  type BitwigAdapter,
} from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { workspaceOf, type Workspace } from '../surface/workspace.js';
import {
  WORKSTATION_REQUEST_SCHEMA, WorkstationModuleRegistry,
} from '../workstation/index.js';
import {
  EXACT_NOTE_SOURCE_MAX_NOTES, readExactNoteSource, type ExactNoteSource,
} from './exact-note-source.js';
import {
  NOTE_INVARIANTS_SCHEMA, NOTE_PROPOSAL_SCHEMA, NoteCompilerError,
  applyNoteProposal, compareCandidateReadback, compileNoteProposal, noteCompilerModule,
  noteProposalSchema, type NoteProposal, type NoteProposalInvariants,
} from './note-compiler.js';

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 96, durationBeats: 1, isMuted: false, ...over,
});

interface Fixture {
  readonly fake: FakeAdapter;
  readonly workspace: Workspace;
  readonly clips: readonly [ClipAddress, ClipAddress];
  readonly source: ExactNoteSource;
}

async function fixture(options: { pressure?: boolean; mixedInsertTrack?: boolean } = {}): Promise<Fixture> {
  const fake = new FakeAdapter({ tracks: ['gn-seed', 'gn-insert'], scenes: 4 });
  const tracks = await fake.tracks();
  const at = await fake.revision();
  const clips = tracks.slice(0, 2).map((item) => clip(slot(
    track(item.channelId), scene(0, at.sceneEpoch),
  ))) as [ClipAddress, ClipAddress];
  const ops: Op[] = [
    { op: 'clip.create', slot: clips[0].slot, lengthBeats: 8 },
    { op: 'clip.create', slot: clips[1].slot, lengthBeats: 8 },
    {
      op: 'note.write', clip: clips[0], channel: 2, notes: [
        note({ pitch: 60, pan: 0.25, ...(options.pressure ? { pressure: 0.4 } : {}) }),
        note({ startBeats: 2, pitch: 62, durationBeats: 1, timbre: 0.3 }),
      ],
    },
    {
      op: 'note.write', clip: clips[0], channel: 9,
      notes: [note({ pitch: 48, durationBeats: 4, gain: 0.7 })],
    },
    {
      op: 'note.write', clip: clips[1], channel: 5,
      notes: [note({ pitch: 72, durationBeats: 2 })],
    },
    ...(options.mixedInsertTrack ? [{
      op: 'note.write' as const, clip: clips[1], channel: 6,
      notes: [note({ startBeats: 4, pitch: 76 })],
    }] : []),
  ];
  // Pressure cannot use the public writer. Add it as human-authored fake state.
  const safeOps = options.pressure
    ? ops.map((op) => op.op === 'note.write' && op.clip === clips[0] && op.channel === 2
      ? { ...op, notes: op.notes.map((item) => ({ ...item, pressure: undefined })) } : op)
    : ops;
  let id = 0;
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter: fake,
    executor: new Executor(fake, { newId: () => `compiler-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }),
    observationStore: new FakeObservationStore(),
  });
  await workspace.apply(safeOps);
  if (options.pressure) {
    const stored = fake.model.tracks[0]!.slots[0]!.notes.values().next().value as NoteRecord;
    fake.model.tracks[0]!.slots[0]!.notes.set('2:60:0', { ...stored, pressure: 0.4 });
  }
  const marked = await fake.revision();
  const source = (await readExactNoteSource(fake, {
    clips,
    source: {
      kind: 'live-bitwig', id: '7b-compiler-fixture',
      permission: 'generated repository fixture under the MIT license',
    },
    expectedGeneration: marked.generation,
  })).source;
  return { fake, workspace, clips, source };
}

async function refreshedSource(fx: Fixture): Promise<ExactNoteSource> {
  return (await readExactNoteSource(fx.fake, {
    clips: fx.clips,
    source: fx.source.source,
    expectedGeneration: fx.source.observedAt.generation,
  })).source;
}

function adapterOf(fake: FakeAdapter): BitwigAdapter {
  return {
    hello: () => fake.hello(),
    resolve: (refs) => fake.resolve(refs),
    tracks: () => fake.tracks(),
    devices: (trackRef) => fake.devices(trackRef),
    drumPads: (container) => fake.drumPads(container),
    read: (addresses) => fake.read(addresses),
    apply: (batch) => fake.apply(batch),
    settle: (budget) => fake.settle(budget),
    revision: () => fake.revision(),
    contentSince: (since) => fake.contentSince(since),
    preserveSelection: (work) => fake.preserveSelection(work),
    showClipInEditor: (clipRef, verifiedAt) => fake.showClipInEditor(clipRef, verifiedAt),
    close: () => fake.close(),
  };
}

function idFor(source: ExactNoteSource, pitch: number): string {
  const id = source.eventMap.find((item) => item.pitch === pitch)?.id;
  if (id === undefined) throw new Error(`fixture pitch ${pitch} has no event ID`);
  return id;
}

function aliasFor(source: ExactNoteSource, trackIndex: number): string {
  const trackId = source.clips[trackIndex]!.track.channelId;
  return source.aliases.find((item) => item.trackId === trackId)!.alias;
}

function invariants(source: ExactNoteSource, over: Partial<NoteProposalInvariants> = {}): NoteProposalInvariants {
  return {
    schema: NOTE_INVARIANTS_SCHEMA,
    preserveUnmentionedFields: true,
    samePitchOverlap: 'refuse',
    allowedOperations: ['transpose', 'delete', 'move', 'insert'],
    allowedTrackAliases: source.aliases.map((item) => item.alias),
    noteCount: { min: 4, max: 4 },
    pitchRange: { min: 0, max: 127 },
    beatRange: { from: '0', to: '8', noteEndsWithin: true },
    ...over,
  };
}

function completeProposal(source: ExactNoteSource): NoteProposal {
  return {
    schema: NOTE_PROPOSAL_SCHEMA,
    base_sha256: source.digest.value,
    ops: [
      { op: 'transpose', note_ids: [idFor(source, 60)], semitones: 7 },
      { op: 'delete', note_ids: [idFor(source, 62)] },
      { op: 'move', note_id: idFor(source, 48), start: '1' },
      {
        op: 'insert', default_policy: 'track-neutral-v0', notes: [{
          id: 'new-reference-note', track: aliasFor(source, 1),
          start: '4', duration: '1', pitch: 74, velocity: 88,
        }],
      },
    ],
  };
}

test('7b-S06: all four operations preserve complete unnamed state and emit typed operations', async () => {
  const { source } = await fixture();
  const result = compileNoteProposal({
    source, proposal: completeProposal(source), invariants: invariants(source),
  });
  assert.equal(result.schema, 'note-compiler-v0');
  assert.equal(result.previewDigest.value.length, 64);
  assert.deepEqual(result.losses, []);
  assert.deepEqual(result.operations.map((op) => op.op), [
    'note.clear', 'note.write', 'note.write', 'note.insert',
  ]);
  const seed = result.candidate.clips[0]!;
  const moved = seed.channels[9]!.notes[0]!.note;
  assert.equal(moved.startBeats, 1);
  assert.equal(moved.gain, 0.7);
  const transposed = seed.channels[2]!.notes[0]!.note;
  assert.equal(transposed.pitch, 67);
  assert.equal(transposed.pan, 0.25);
  assert.equal(seed.channels[2]!.notes.some((item) => item.note.pitch === 62), false);
  const inserted = result.candidate.clips[1]!.channels[5]!.notes
    .find((item) => item.id === 'new-reference-note')!.note;
  assert.deepEqual(inserted, {
    startBeats: 4,
    pitch: 74,
    velocity: 88,
    durationBeats: 1,
    releaseVelocity: 64 / 127,
    velocitySpread: 0,
    gain: 1,
    pan: 0,
    pressure: 0,
    timbre: 0,
    transpose: 0,
    chance: 1,
    isChanceEnabled: true,
    isMuted: false,
    isOccurrenceEnabled: true,
    occurrence: 'ALWAYS',
    isRecurrenceEnabled: true,
    recurrence: [1, 1],
    isRepeatEnabled: true,
    repeatCount: 0,
    repeatCurve: 0,
    repeatVelocityCurve: 0,
    repeatVelocityEnd: 0,
  });
  assert.deepEqual(result.insertionDefaults, {
    policy: 'track-neutral-v0',
    candidateNormalization: 'explicit-host-normalized',
    releaseVelocityMidi: 64,
    releaseVelocityHost: 64 / 127,
    velocitySpread: 0,
    gain: 1,
    pan: 0,
    pressure: 0,
    timbre: 0,
    transpose: 0,
    chance: 1,
    isChanceEnabled: true,
    isMuted: false,
    isOccurrenceEnabled: true,
    occurrence: 'ALWAYS',
    isRecurrenceEnabled: true,
    recurrence: [1, 1],
    isRepeatEnabled: true,
    repeatCount: 0,
    repeatCurve: 0,
    repeatVelocityCurve: 0,
    repeatVelocityEnd: 0,
    omittedFromOperations: ['pressure'],
    pressureProof: 'candidate pressure 0 is omitted from operations; complete readback compares host 0',
  });
  const insertedOperation = result.operations.find((op) => op.op === 'note.insert'
    && op.notes.some((item) => item.pitch === 74));
  assert.equal(insertedOperation?.op, 'note.insert');
  if (insertedOperation?.op !== 'note.insert') throw new Error('insert operation is absent');
  const insertedWireNote = insertedOperation.notes.find((item) => item.pitch === 74)!;
  assert.equal(Object.hasOwn(insertedWireNote, 'pressure'), false);
  assert.equal(insertedWireNote.pan, 0);
  assert.equal(insertedWireNote.isMuted, false);
});

test('7b-S06: a pure insertion emits only a targeted insertion operation', async () => {
  const { source } = await fixture();
  const proposal: NoteProposal = {
    schema: NOTE_PROPOSAL_SCHEMA,
    base_sha256: source.digest.value,
    ops: [{
      op: 'insert', default_policy: 'track-neutral-v0', notes: [{
        id: 'pure-insert', track: aliasFor(source, 1),
        start: '4', duration: '1', pitch: 74, velocity: 88,
      }],
    }],
  };
  const result = compileNoteProposal({
    source,
    proposal,
    invariants: invariants(source, { noteCount: { min: 5, max: 5 } }),
  });

  assert.deepEqual(result.operations.map((op) => op.op), ['note.insert']);
  const operation = result.operations[0];
  if (operation?.op !== 'note.insert') throw new Error('targeted insertion is absent');
  assert.equal(operation.channel, 5);
  assert.deepEqual(operation.notes.map((item) => item.pitch), [74]);
  assert.equal(operation.notes.some((item) => item.pitch === 72), false);
});

test('7b-S06: same-clip reconstruction omits only inserted neutral pressure', async () => {
  const { source } = await fixture();
  const proposal: NoteProposal = {
    schema: NOTE_PROPOSAL_SCHEMA,
    base_sha256: source.digest.value,
    ops: [
      { op: 'move', note_id: idFor(source, 72), start: '1' },
      {
        op: 'insert', default_policy: 'track-neutral-v0', notes: [{
          id: 'same-clip-insert', track: aliasFor(source, 1),
          start: '4', duration: '1', pitch: 74, velocity: 88,
        }],
      },
    ],
  };
  const result = compileNoteProposal({
    source,
    proposal,
    invariants: invariants(source, { noteCount: { min: 5, max: 5 } }),
  });
  assert.equal(result.operations.some((op) => op.op === 'note.insert'), false);
  const reconstructed = result.operations.find((op) => op.op === 'note.write'
    && op.notes.some((item) => item.pitch === 72)
    && op.notes.some((item) => item.pitch === 74));
  assert.equal(reconstructed?.op, 'note.write');
  if (reconstructed?.op !== 'note.write') throw new Error('reconstructed write is absent');
  const inserted = reconstructed.notes.find((item) => item.pitch === 74)!;
  assert.equal(Object.hasOwn(inserted, 'pressure'), false);
  assert.deepEqual(inserted, {
    startBeats: 4,
    pitch: 74,
    velocity: 88,
    durationBeats: 1,
    releaseVelocity: 64 / 127,
    velocitySpread: 0,
    gain: 1,
    pan: 0,
    timbre: 0,
    transpose: 0,
    chance: 1,
    isChanceEnabled: true,
    isMuted: false,
    isOccurrenceEnabled: true,
    occurrence: 'ALWAYS',
    isRecurrenceEnabled: true,
    recurrence: [1, 1],
    isRepeatEnabled: true,
    repeatCount: 0,
    repeatCurve: 0,
    repeatVelocityCurve: 0,
    repeatVelocityEnd: 0,
  });
});

test('7b-S06 refusal: literal stale, unknown, sequential, ID, field, grid, range, and collision cases fail closed', async () => {
  const { source } = await fixture();
  const base = completeProposal(source);
  const declared = invariants(source);
  const compile = (proposal: unknown, custom = declared) => compileNoteProposal({
    source, proposal: proposal as NoteProposal, invariants: custom,
  });
  assert.throws(() => compile(JSON.parse(JSON.stringify({
    ...base, base_sha256: 'a'.repeat(64),
  }))), /base_sha256/);
  assert.throws(() => compile({
    ...base, ops: [{ op: 'delete', note_ids: ['e-999'] }],
  }), /unknown or deleted/);
  const target = idFor(source, 60);
  assert.throws(() => compile({
    ...base,
    ops: [
      { op: 'delete', note_ids: [target] },
      { op: 'move', note_id: target, start: '2' },
    ],
  }), /more than one operation/);
  assert.throws(() => compile({
    ...base,
    ops: [{ op: 'insert', default_policy: 'track-neutral-v0', notes: [
      { id: target, track: aliasFor(source, 1), start: '4', duration: '1', pitch: 70, velocity: 80 },
    ] }],
  }, invariants(source, { noteCount: { min: 5, max: 5 } })), /already in use/);
  assert.equal(noteProposalSchema.safeParse({
    ...base,
    ops: [{ op: 'insert', default_policy: 'track-neutral-v0', notes: [{
      id: 'host-field', track: aliasFor(source, 1), start: '4', duration: '1',
      pitch: 70, velocity: 80, pressure: 0,
    }] }],
  }).success, false);
  assert.throws(() => compile({
    ...base,
    ops: [{ op: 'move', note_id: target, start: '1/1000' }],
  }, invariants(source, { noteCount: { min: 4, max: 4 } })), /host grid|represent/i);
  assert.throws(() => compile({
    ...base,
    ops: [{ op: 'transpose', note_ids: [target], semitones: 80 }],
  }), /outside MIDI/);
  assert.throws(() => compile({
    ...base,
    ops: [{ op: 'insert', default_policy: 'track-neutral-v0', notes: [{
      id: 'collision', track: aliasFor(source, 1), start: '0', duration: '1', pitch: 72, velocity: 80,
    }] }],
  }, invariants(source, { noteCount: { min: 5, max: 5 } })), /duplicate note cell|same-pitch overlap/);
});

test('7b-S06 refusal: ambiguous insertion channels and unwritable preserved pressure create no plan', async () => {
  const mixed = await fixture({ mixedInsertTrack: true });
  const alias = aliasFor(mixed.source, 1);
  const insert: NoteProposal = {
    schema: NOTE_PROPOSAL_SCHEMA, base_sha256: mixed.source.digest.value,
    ops: [{ op: 'insert', default_policy: 'track-neutral-v0', notes: [{
      id: 'ambiguous', track: alias, start: '6', duration: '1', pitch: 78, velocity: 90,
    }] }],
  };
  assert.throws(() => compileNoteProposal({
    source: mixed.source, proposal: insert,
    invariants: invariants(mixed.source, { noteCount: { min: 6, max: 6 } }),
  }), /one unique source channel/);

  const pressured = await fixture({ pressure: true });
  const proposal: NoteProposal = {
    schema: NOTE_PROPOSAL_SCHEMA, base_sha256: pressured.source.digest.value,
    ops: [{ op: 'transpose', note_ids: [idFor(pressured.source, 60)], semitones: 1 }],
  };
  assert.throws(() => compileNoteProposal({
    source: pressured.source, proposal,
    invariants: invariants(pressured.source, { noteCount: { min: 4, max: 4 } }),
  }), /pressure cannot be written/);
});

test('7b-S06 refusal: split inserts cannot exceed complete readback capacity', async () => {
  const { fake, workspace, source } = await fixture();
  const alias = aliasFor(source, 1);
  const sourceNoteCount = source.eventMap.length;
  const insertedNoteCount = EXACT_NOTE_SOURCE_MAX_NOTES - sourceNoteCount + 1;
  const pitches = Array.from({ length: 128 }, (_, pitch) => pitch).filter((pitch) => pitch !== 72);
  const rational = (numerator: number, denominator: number): string => {
    let left = numerator;
    let right = denominator;
    while (right !== 0) [left, right] = [right, left % right];
    return denominator / left === 1
      ? String(numerator / left)
      : `${numerator / left}/${denominator / left}`;
  };
  const inserted = Array.from({ length: insertedNoteCount }, (_, index) => ({
    id: `capacity-${index}`,
    track: alias,
    start: rational(Math.floor(index / pitches.length), 8),
    duration: '1/16',
    pitch: pitches[index % pitches.length]!,
    velocity: 80,
  }));
  const proposal: NoteProposal = {
    schema: NOTE_PROPOSAL_SCHEMA,
    base_sha256: source.digest.value,
    ops: [
      { op: 'insert', default_policy: 'track-neutral-v0', notes: inserted.slice(0, 2_048) },
      { op: 'insert', default_policy: 'track-neutral-v0', notes: inserted.slice(2_048) },
    ],
  };
  const beforeChanges = workspace.changes.list().length;
  const beforeNotes = fake.model.tracks[1]!.slots[0]!.notes.size;

  await assert.rejects(applyNoteProposal(workspace, {
    source,
    proposal,
    invariants: invariants(source, {
      noteCount: { min: EXACT_NOTE_SOURCE_MAX_NOTES + 1, max: EXACT_NOTE_SOURCE_MAX_NOTES + 1 },
    }),
    acceptedPreviewSha256: 'a'.repeat(64),
  }), (error) => error instanceof NoteCompilerError
    && error.message === `candidate note count ${EXACT_NOTE_SOURCE_MAX_NOTES + 1} `
      + `exceeds the exact source limit of ${EXACT_NOTE_SOURCE_MAX_NOTES}`);
  assert.equal(workspace.changes.list().length, beforeChanges);
  assert.equal(fake.model.tracks[1]!.slots[0]!.notes.size, beforeNotes);
});

test('7b-S07: accepted preview uses a fresh guard, preserves all channels, and reads back completely', async () => {
  const { fake, workspace, clips, source } = await fixture();
  const request = {
    source, proposal: completeProposal(source), invariants: invariants(source),
  };
  const preview = compileNoteProposal(request);
  const beforeChanges = workspace.changes.list().length;
  const result = await applyNoteProposal(workspace, {
    ...request, acceptedPreviewSha256: preview.previewDigest.value,
  });
  assert.equal(result.applied, true);
  assert.equal(workspace.changes.list().length, beforeChanges + 1);
  assert.deepEqual(result.readback?.discrepancies, []);
  assert.equal(result.readback?.source.coverage.channelsPerClip, 16);
  assert.equal(result.change.disagreements.length, 0);
  assert.equal(result.reversal.changeId, result.change.id);
  assert.deepEqual(result.reversal.unrestored, []);
  assert.equal(result.readback?.source.clips[0]!.channels[9]!.notes[0]!.gain, 0.7);
  assert.equal(result.readback?.source.clips[1]!.channels[5]!.notes
    .some((item) => item.pitch === 74), true);

  const liveDefaults = fake.model.tracks[1]!.slots[0]!.notes;
  for (const [key, item] of liveDefaults) {
    if (item.pitch !== 74) continue;
    liveDefaults.set(key, {
      ...item,
      isChanceEnabled: true,
      isOccurrenceEnabled: true,
      isRecurrenceEnabled: true,
      recurrence: [1, 1],
      isRepeatEnabled: true,
    });
  }
  const observed = (await readExactNoteSource(fake, {
    clips,
    source: source.source,
    expectedGeneration: source.observedAt.generation,
  })).source;
  assert.deepEqual(compareCandidateReadback(result.preview, observed), [],
    'explicit live enabled defaults equal omitted insertion defaults');
});

test('7b-S07 refusal: a mismatched preview or changed guard writes nothing', async () => {
  const first = await fixture();
  const request = {
    source: first.source,
    proposal: completeProposal(first.source),
    invariants: invariants(first.source),
  };
  const before = first.workspace.changes.list().length;
  await assert.rejects(applyNoteProposal(first.workspace, {
    ...request, acceptedPreviewSha256: 'a'.repeat(64),
  }), /accepted preview digest/);
  assert.equal(first.workspace.changes.list().length, before);

  const preview = compileNoteProposal(request);
  first.fake.model.revision += 1;
  await assert.rejects(applyNoteProposal(first.workspace, {
    ...request, acceptedPreviewSha256: preview.previewDigest.value,
  }), /guards changed/);
  assert.equal(first.workspace.changes.list().length, before);
});

test('7b-S07: a rejected later stage keeps the partial change record and exact discrepancies', async () => {
  const { fake, source } = await fixture();
  const base = adapterOf(fake);
  let applyCalls = 0;
  const partial: BitwigAdapter = {
    ...base,
    apply: async (batch) => {
      applyCalls += 1;
      const first = await fake.apply({ ops: [batch.ops[0]!] });
      return {
        ...first,
        accepted: false,
        rejected: {
          reason: 'stale-revision' as const,
          expected: first.at.revision,
          actual: first.at.revision + 1,
        },
      };
    },
  };
  let id = 0;
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter: partial,
    executor: new Executor(partial, { newId: () => `partial-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }),
    observationStore: new FakeObservationStore(),
  });
  const request = {
    source, proposal: completeProposal(source), invariants: invariants(source),
  };
  const preview = compileNoteProposal(request);
  const result = await applyNoteProposal(workspace, {
    ...request, acceptedPreviewSha256: preview.previewDigest.value,
  });
  assert.equal(applyCalls, 1, 'a partial mutation is never replayed');
  assert.equal(workspace.changes.list().length, 1);
  assert.equal(result.applied, true, 'the first applied stage remains an owned effect');
  assert.ok((result.readback?.discrepancies.length ?? 0) > 0);
  assert.equal(result.change.id, workspace.changes.list()[0]!.id);
});

test('7b-S17: the pure note compiler module correlates the exact source without Bitwig startup', async () => {
  const { source } = await fixture();
  const payload = {
    source, proposal: completeProposal(source), invariants: invariants(source),
  };
  const registry = new WorkstationModuleRegistry();
  registry.register(noteCompilerModule());
  const response = await registry.request<typeof payload, ReturnType<typeof compileNoteProposal>>(
    'ghostnote-note-compiler', {
      schema: WORKSTATION_REQUEST_SCHEMA,
      requestId: 'request-7b-compiler',
      inputSchema: NOTE_PROPOSAL_SCHEMA,
      sourceSha256: source.digest.value,
      payload,
    },
  );
  assert.equal(response.payload.schema, 'note-compiler-v0');
  assert.equal(registry.discover()[0]!.state, 'available');
  await assert.rejects(registry.request('ghostnote-note-compiler', {
    schema: WORKSTATION_REQUEST_SCHEMA,
    requestId: 'request-7b-mismatch',
    inputSchema: NOTE_PROPOSAL_SCHEMA,
    sourceSha256: 'b'.repeat(64),
    payload,
  }), (error) => error instanceof NoteCompilerError && /source digest/.test(error.message));
});

test('7b-follow-up: every targeted proposal operation refuses incompatible clip geometry', async () => {
  const fx = await fixture();
  fx.fake.model.tracks[0]!.slots[0]!.lengthBeats = 16;
  fx.fake.model.tracks[0]!.slots[0]!.loopStartBeats = 24;
  const source = await refreshedSource(fx);
  const alias = aliasFor(source, 0);
  const cases: readonly { proposal: NoteProposal; count: number }[] = [
    {
      proposal: {
        schema: NOTE_PROPOSAL_SCHEMA, base_sha256: source.digest.value,
        ops: [{ op: 'transpose', note_ids: [idFor(source, 60)], semitones: 1 }],
      },
      count: 4,
    },
    {
      proposal: {
        schema: NOTE_PROPOSAL_SCHEMA, base_sha256: source.digest.value,
        ops: [{ op: 'delete', note_ids: [idFor(source, 62)] }],
      },
      count: 3,
    },
    {
      proposal: {
        schema: NOTE_PROPOSAL_SCHEMA, base_sha256: source.digest.value,
        ops: [{ op: 'move', note_id: idFor(source, 48), start: '1' }],
      },
      count: 4,
    },
    {
      proposal: {
        schema: NOTE_PROPOSAL_SCHEMA, base_sha256: source.digest.value,
        ops: [{
          op: 'insert', default_policy: 'track-neutral-v0', notes: [{
            id: 'range-insert', track: alias,
            start: '6', duration: '1', pitch: 80, velocity: 90,
          }],
        }],
      },
      count: 5,
    },
  ];
  for (const item of cases) {
    assert.throws(() => compileNoteProposal({
      source,
      proposal: item.proposal,
      invariants: invariants(source, {
        noteCount: { min: item.count, max: item.count },
        beatRange: { from: '0', to: '16', noteEndsWithin: true },
      }),
    }), /requires consolidation.*use Consolidate.*preview the change again/);
  }
});

test('7b-follow-up: incompatible unrelated clips do not block a compatible target', async () => {
  const fx = await fixture();
  fx.fake.model.tracks[1]!.slots[0]!.lengthBeats = 16;
  fx.fake.model.tracks[1]!.slots[0]!.loopStartBeats = 24;
  const source = await refreshedSource(fx);
  const result = compileNoteProposal({
    source,
    proposal: {
      schema: NOTE_PROPOSAL_SCHEMA, base_sha256: source.digest.value,
      ops: [{ op: 'transpose', note_ids: [idFor(source, 60)], semitones: 1 }],
    },
    invariants: invariants(source),
  });
  assert.equal(result.operations[0]?.op, 'note.clear');
  assert.equal(result.guards.clipAddresses.length, 1);
  assert.deepEqual(result.guards.clipAddresses[0], fx.clips[0]);
});

test('7b-follow-up: apply-time range drift uses the preview refusal and writes nothing', async () => {
  const fx = await fixture();
  const proposal: NoteProposal = {
    schema: NOTE_PROPOSAL_SCHEMA, base_sha256: fx.source.digest.value,
    ops: [{ op: 'transpose', note_ids: [idFor(fx.source, 60)], semitones: 1 }],
  };
  const request = { source: fx.source, proposal, invariants: invariants(fx.source) };
  const preview = compileNoteProposal(request);
  const beforeChanges = fx.workspace.changes.list().length;
  fx.fake.model.tracks[0]!.slots[0]!.lengthBeats = 16;
  fx.fake.model.tracks[0]!.slots[0]!.loopStartBeats = 24;
  const drifted = await refreshedSource(fx);
  let previewMessage = '';
  assert.throws(() => compileNoteProposal({ ...request, source: drifted }), (error) => {
    previewMessage = error instanceof Error ? error.message : String(error);
    return error instanceof NoteCompilerError && /requires consolidation/.test(error.message);
  });
  await assert.rejects(applyNoteProposal(fx.workspace, {
    ...request,
    acceptedPreviewSha256: preview.previewDigest.value,
  }), (error) => error instanceof NoteCompilerError && error.message === previewMessage);
  assert.equal(fx.workspace.changes.list().length, beforeChanges);
});
