import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { addressKey, notes, type StateEntry } from '../contract/index.js';
import {
  WORKSTATION_REQUEST_SCHEMA, WorkstationModuleRegistry,
} from '../workstation/index.js';
import {
  exactSourceFixtureClipA, exactSourceFixtureClipB,
  exactSourceFixtureSnapshot,
} from './exact-note-source.fixture.js';
import {
  serializeExactNoteSource, snapshotToExactSource, type ExactNoteSource,
} from './exact-note-source.js';
import {
  NOTE_INVARIANTS_SCHEMA, NOTE_PROPOSAL_SCHEMA,
  compileNoteProposal, type NoteProposal,
} from './note-compiler.js';
import {
  REFERENCE_CONTEXT_REQUEST_SCHEMA, ReferenceContextError,
  compareCandidateToReference, referenceContextModule, referenceProjection,
  referenceContextResultValidator,
  type ReferenceContextRequest,
} from './reference-context.js';

function source(id: string, pitchChange = 0): ExactNoteSource {
  const snapshot = exactSourceFixtureSnapshot();
  if (pitchChange !== 0) {
    const address = notes(exactSourceFixtureClipA, 2);
    const entry = snapshot.entries[addressKey(address)]!;
    assert.equal(entry.value.of, 'notes');
    if (entry.value.of === 'notes') {
      const changed = entry.value.notes.map((item, index) =>
        index === 0 ? { ...item, pitch: item.pitch + pitchChange } : item);
      (snapshot.entries as Record<string, StateEntry>)[addressKey(address)] = {
        address, fidelity: 'exact', value: { of: 'notes', notes: changed },
      };
    }
  }
  return snapshotToExactSource({
    snapshot,
    clips: [exactSourceFixtureClipA, exactSourceFixtureClipB],
    source: {
      kind: 'supplied-exact-state', id,
      permission: 'generated repository fixture under the MIT license',
    },
  });
}

function request(
  seed = source('seed-v0'),
  reference = source('reference-v0'),
): ReferenceContextRequest {
  return {
    seed,
    reference,
    expectedReferenceSha256: reference.digest.value,
    task: {
      id: 'reference-transfer-fixture',
      profile: 'extracted-structure-v0',
      coverage: { fromBeats: 0, toBeats: 4 },
      roles: [
        ...seed.aliases.map((item, index) => ({
          source: 'seed' as const, trackId: item.trackId,
          role: index === 0 ? 'lead' : 'bass', provenance: 'fixture declaration',
        })),
        ...reference.aliases.map((item, index) => ({
          source: 'reference' as const, trackId: item.trackId,
          role: index === 0 ? 'lead' : 'bass', provenance: 'fixture declaration',
        })),
      ],
    },
  };
}

function withPermission(sourceValue: ExactNoteSource, permission: string): ExactNoteSource {
  const changed = structuredClone(sourceValue) as ExactNoteSource;
  (changed as { source: { permission: string } }).source.permission = permission;
  const digest = createHash('sha256').update(serializeExactNoteSource(changed), 'utf8').digest('hex');
  (changed as { digest: { value: string } }).digest.value = digest;
  for (const item of changed.eventMap) {
    (item as { sourceSha256: string }).sourceSha256 = digest;
  }
  return changed;
}

function candidate(seed: ExactNoteSource, semitones: number) {
  const proposal: NoteProposal = {
    schema: NOTE_PROPOSAL_SCHEMA,
    base_sha256: seed.digest.value,
    ops: [{
      op: 'transpose', note_ids: seed.eventMap.map((item) => item.id), semitones,
    }],
  };
  return compileNoteProposal({
    source: seed,
    proposal,
    invariants: {
      schema: NOTE_INVARIANTS_SCHEMA,
      preserveUnmentionedFields: true,
      samePitchOverlap: 'refuse',
      allowedOperations: ['transpose'],
      allowedTrackAliases: seed.aliases.map((item) => item.alias),
      noteCount: { min: 3, max: 3 },
      pitchRange: { min: 0, max: 127 },
      beatRange: { from: '0', to: '4', noteEndsWithin: true },
      requiredEventIds: seed.eventMap.map((item) => item.id),
    },
  }).candidate;
}

test('7b-S09: extracted structure is the default and a raw excerpt stays bounded and justified', () => {
  const base = request();
  const extracted = referenceProjection(base);
  assert.equal(referenceContextResultValidator.safeParse(extracted).success, true);
  assert.equal(extracted.schema, 'reference-context-v0');
  assert.equal(extracted.profile, 'extracted-structure-v0');
  assert.equal(extracted.rawContext, undefined);
  assert.equal(extracted.coverage.used.eventCount, 3);
  assert.equal(extracted.coverage.used.completeReferenceUsedForComparison, true);
  assert.equal(extracted.extractedEvidence.some((item) =>
    item.fieldId === 'reference.pitch-class-histogram-v0'), true);
  assert.notEqual(extracted.seed.sha256, extracted.reference.sha256);

  const mixed = referenceProjection({
    ...base,
    task: {
      ...base.task,
      profile: 'mixed-v0',
      rawExcerpt: {
        reason: 'the task needs the opening voicing detail',
        contextTask: {
          id: 'bounded-reference-excerpt',
          mode: 'compact-bar-v0',
          coverage: { fromBeats: 0, toBeats: 0.25 },
          meter: { numerator: 4, denominator: 4 },
          tempoMap: [{ atBeats: 0, bpm: 120 }],
          measurements: ['note-count-v0'],
        },
      },
    },
  });
  assert.equal(mixed.rawContext?.context.events.length, 2);
  assert.equal(mixed.coverage.excerpt?.eventCount, 2);
  assert.equal(mixed.coverage.used.eventCount, 3,
    'the excerpt does not replace complete used-reference coverage');
  assert.equal(mixed.coverage.excerpt?.reason.includes('voicing'), true);
});

test('7b-S09: exact copy and structural-only transfer remain separate complete-reference metrics', () => {
  const base = request();
  const projection = referenceProjection(base);
  const exact = compareCandidateToReference(projection, base.reference, candidate(base.seed, 0));
  assert.equal(exact.exactCopy.find((item) =>
    item.fieldId === 'reference.exact-event-count-v0')?.value, 3);
  assert.equal(exact.exactCopy.every((item) =>
    item.coverage.referenceEventCount === 3 && item.coverage.candidateEventCount === 3), true);

  const structural = compareCandidateToReference(
    projection, base.reference, candidate(base.seed, 12),
  );
  assert.equal(structural.exactCopy.find((item) =>
    item.fieldId === 'reference.exact-event-count-v0')?.value, 0);
  assert.equal(structural.structural.find((item) =>
    item.fieldId === 'reference.pitch-class-jaccard-v0')?.value, 1);
  assert.equal(structural.structural.find((item) =>
    item.fieldId === 'reference.rhythm-onset-jaccard-v0')?.value, 1);
});

test('7b-S09 refusal: identity collision, permission omission, excerpt expansion, and changed hash fail closed', () => {
  const base = request();
  assert.throws(() => referenceProjection(request(
    source('same-source'), source('same-source', 1),
  )), /identities must be separate/);

  const withoutPermission = structuredClone(base.reference) as ExactNoteSource;
  (withoutPermission as { source: { permission: string } }).source.permission = '';
  assert.throws(() => referenceProjection({
    ...base, reference: withoutPermission,
  }), /permission is missing/);

  assert.throws(() => referenceProjection({
    ...base,
    task: {
      ...base.task,
      profile: 'mixed-v0',
      coverage: { fromBeats: 0, toBeats: 1 },
      rawExcerpt: {
        reason: 'fixture detail',
        contextTask: {
          id: 'too-wide', mode: 'compact-bar-v0',
          coverage: { fromBeats: 0, toBeats: 2 },
          meter: { numerator: 4, denominator: 4 },
          tempoMap: [{ atBeats: 0, bpm: 120 }],
          measurements: ['note-count-v0'],
        },
      },
    },
  }), /must stay within/);

  const projection = referenceProjection(base);
  assert.equal(referenceContextResultValidator.safeParse({
    ...projection, schema: 'reference-context-v1',
  }).success, false);
  assert.throws(() => compareCandidateToReference(
    projection, source('reference-v0', 1), candidate(base.seed, 0),
  ), /reference changed/);
});

test('7b-S09 refusal: comparison rejects an exact reference without permission', () => {
  const base = request();
  const reference = withPermission(base.reference, '');
  const projection = referenceProjection(base);
  const forged = {
    ...projection,
    reference: {
      ...projection.reference,
      sha256: reference.digest.value,
      permission: 'forged permission claim',
    },
    extractedEvidence: projection.extractedEvidence.map((item) => ({
      ...item, sourceSha256: reference.digest.value,
    })),
  };
  assert.equal(referenceContextResultValidator.safeParse(forged).success, true);
  assert.throws(() => compareCandidateToReference(
    forged, reference, candidate(base.seed, 0),
  ), /reference permission is missing/);
});

test('7b-S09 refusal: comparison rejects projected permission that differs from its exact reference', () => {
  const base = request();
  const projection = referenceProjection(base);
  const forged = {
    ...projection,
    reference: { ...projection.reference, permission: 'forged permission claim' },
  };
  assert.equal(referenceContextResultValidator.safeParse(forged).success, true);
  assert.throws(() => compareCandidateToReference(
    forged, base.reference, candidate(base.seed, 0),
  ), /reference permission changed/);
});

test('7b-S09/S17: the reference profile propagates permission and correlates the reference hash', async () => {
  const payload = request();
  const registry = new WorkstationModuleRegistry();
  registry.register(referenceContextModule());
  const response = await registry.request<typeof payload, ReturnType<typeof referenceProjection>>(
    'ghostnote-symbolic-reference-context', {
      schema: WORKSTATION_REQUEST_SCHEMA,
      requestId: 'request-7b-reference',
      inputSchema: REFERENCE_CONTEXT_REQUEST_SCHEMA,
      sourceSha256: payload.reference.digest.value,
      payload,
    },
  );
  assert.equal(response.payload.reference.permission,
    'generated repository fixture under the MIT license');
  assert.equal(registry.discover()[0]!.state, 'available');
  await assert.rejects(registry.request('ghostnote-symbolic-reference-context', {
    schema: WORKSTATION_REQUEST_SCHEMA,
    requestId: 'request-7b-reference-mismatch',
    inputSchema: REFERENCE_CONTEXT_REQUEST_SCHEMA,
    sourceSha256: 'c'.repeat(64),
    payload,
  }), (error) => error instanceof ReferenceContextError && /source digest/.test(error.message));
});
