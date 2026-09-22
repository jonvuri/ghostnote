import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WORKSTATION_REQUEST_SCHEMA, WorkstationModuleRegistry,
} from '../workstation/index.js';
import { addressKey, notes, type NoteRecord, type StateEntry } from '../contract/index.js';
import {
  exactNoteSourceFixture, exactSourceFixtureClipA as clipA,
  exactSourceFixtureSnapshot as fixtureSnapshot,
} from './exact-note-source.fixture.js';
import {
  SymbolicContextError, exactSourceToContext, hostBeatToRational,
  symbolicContextModule, type SymbolicContextRequest,
} from './symbolic-context.js';

function request() {
  const source = exactNoteSourceFixture();
  return {
    source,
    expectedGeneration: source.observedAt.generation,
    task: {
      id: 'explain-and-propose-unapplied-revision',
      mode: 'compact-bar-v0' as const,
      coverage: { fromBeats: 0, toBeats: 4 },
      meter: { numerator: 4, denominator: 4 as const },
      tempoMap: [{ atBeats: 0, bpm: 105 }],
      measurements: ['note-count-v0', 'pitch-span-v0'] as const,
    },
  };
}

test('7a-S04: complete exact state renders a strict compact view with source-scoped identities', () => {
  const result = exactSourceToContext(request());
  assert.equal(result.schema, 'symbolic-context-v0');
  assert.equal(result.source.digestDomain, 'exact-note-source-v0');
  assert.equal(result.exactCoverage.channelsPerClip, 16);
  assert.equal(result.context.events.length, 3);
  assert.equal(new Set(result.context.events.map((event) => event.id)).size, 3);
  assert.deepEqual(result.context.source.coverage.trackIds, ['t-1', 't-2']);
  assert.equal(result.aliasMap.some((item) => item.trackId === 'raw uuid/A'), true);
  assert.equal(result.context.events.filter((event) => event.pitch === 64).length, 2,
    'same-pitch events on different channels remain distinct');
  assert.equal(result.context.events.every((event) => event.role === 'unassigned'), true);
  assert.equal(result.authority.filter((item) => item.fieldId.endsWith('.role'))
    .every((item) => item.authority === 'unavailable'), true);
  assert.deepEqual(result.derivedMeasurements.map((item) => item.fieldId), [
    'note-count-v0', 'pitch-span-v0',
  ]);
  assert.equal(result.derivedMeasurements[0]!.value, 3);
  assert.equal(result.derivedMeasurements[1]!.value, 16);
  assert.deepEqual(result.missingCapabilities.map((item) => item.dependency), ['Music21']);
  assert.match(result.rendered, /^CONTEXT ghostnote-agent-context-v0 MODE compact-bar-v0/m);
  assert.equal(result.source.sha256, result.context.source.sha256);
  assert.equal(result.contextDigest.value.length, 64);
  assert.equal(result.contextCoverage.omittedFields.includes('releaseVelocity'), true);
  assert.equal(result.contextCoverage.unavailableFields.includes('articulation'), true);
});

test('7a-S04: qualified harmony is bounded, stays inferred, and retains alternatives', () => {
  const base = request();
  const provider = {
    id: 'controlled-theory-fixture', adapterVersion: '0',
    dependencyVersion: 'fixture', settings: { rule: 'margin-v0' },
  };
  const selected = exactSourceToContext({
    ...base,
    task: {
      ...base.task,
      harmony: [{
        fieldId: 'harmony.0', atBeats: 0, selected: 'Cmaj',
        alternatives: [{ symbol: 'Cmaj', score: 0.9 }, { symbol: 'Am', score: 0.2 }],
        confidenceRule: 'select when margin is at least 0.08',
        sourceSha256: base.source.digest.value, provider,
      }],
    },
  });
  assert.deepEqual(selected.context.harmony, [{ atBeats: '0', symbol: 'Cmaj' }]);
  assert.equal(selected.authority.find((item) => item.fieldId === 'context.harmony.0')?.authority,
    'inferred-label');
  assert.equal(selected.alternatives[0]!.candidates.length, 2);

  const ambiguous = exactSourceToContext({
    ...base,
    task: {
      ...base.task,
      harmony: [{
        fieldId: 'harmony.ambiguous', atBeats: 0,
        alternatives: [{ symbol: 'Cmaj', score: 0.51 }, { symbol: 'Am', score: 0.50 }],
        confidenceRule: 'withhold when margin is below 0.08',
        sourceSha256: base.source.digest.value, provider,
      }],
    },
  });
  assert.deepEqual(ambiguous.context.harmony, []);
  assert.equal(ambiguous.alternatives[0]!.selected, undefined);
  assert.equal(ambiguous.exactFacts.some((fact) => fact.fieldId.includes('harmony')), false);

  assert.throws(() => exactSourceToContext({
    ...base,
    task: {
      ...base.task,
      harmony: [{
        fieldId: 'harmony.outside', atBeats: 4, selected: 'Cmaj',
        alternatives: [{ symbol: 'Cmaj' }], confidenceRule: 'fixture selection',
        sourceSha256: base.source.digest.value, provider,
      }],
    },
  }), /outside the task beat coverage/);
});

test('7a-S04 refusal: invalid tasks, stale state, and missing mute fail closed', () => {
  const base = request();
  assert.throws(() => exactSourceToContext({
    ...base, task: { ...base.task, coverage: { fromBeats: 3, toBeats: 4 } },
  }), /selected context is empty/);
  assert.throws(() => exactSourceToContext({
    ...base, task: { ...base.task, tempoMap: [] },
  }), /tempoMap.*Too small|tempoMap.*at least/i);
  assert.throws(() => exactSourceToContext({
    ...base, expectedGeneration: 'older-generation',
  }), /generation is stale/);
  assert.throws(() => exactSourceToContext({
    ...base,
    task: { ...base.task, measurements: ['invented-metric-v9'] },
  } as unknown as SymbolicContextRequest), /selected measurement invented-metric-v9 is unsupported/);

  const snapshot = fixtureSnapshot();
  const address = notes(clipA, 2);
  const entry = snapshot.entries[addressKey(address)]!;
  assert.equal(entry.value.of, 'notes');
  if (entry.value.of !== 'notes') return;
  const first = { ...entry.value.notes[0] } as Record<string, unknown>;
  delete first['isMuted'];
  (snapshot.entries as Record<string, StateEntry>)[addressKey(address)] = {
    address, fidelity: 'exact', value: { of: 'notes', notes: [first as unknown as NoteRecord] },
  };
  const source = exactNoteSourceFixture(snapshot);
  assert.throws(() => exactSourceToContext({ ...base, source }), /requires an observed isMuted/);

  const liveSource = exactNoteSourceFixture(snapshot, 'live-bitwig');
  const liveResult = exactSourceToContext({ ...base, source: liveSource });
  assert.equal(liveResult.context.events.find((event) => event.id === 'e-1')?.mute, false);
  assert.equal(liveResult.exactFacts.find((fact) => fact.fieldId === 'event.e-1')
    ?.value['mute'], undefined);
  assert.equal(liveResult.warnings.some((warning) => warning.code === 'live-default-elision'), true);
});

test('7a-beats: binary, triplet, decimal, and negative-zero host beats stay reduced', () => {
  assert.equal(hostBeatToRational(-0), '0');
  assert.equal(hostBeatToRational(17 / 64), '17/64');
  assert.equal(hostBeatToRational(1 / 768), '1/768');
  assert.equal(hostBeatToRational(0.1), '1/10');
});

test('7a-S17: supplied state renders with no Bitwig session or optional Python provider', async () => {
  const registry = new WorkstationModuleRegistry();
  registry.register(symbolicContextModule());
  const before = registry.discover()[0]!;
  assert.equal(before.state, 'uninitialized');
  assert.deepEqual(before.missingCapabilities.map((item) => item.dependency), ['Music21']);

  const payload = request();
  const response = await registry.request<typeof payload, ReturnType<typeof exactSourceToContext>>(
    'ghostnote-symbolic-context',
    {
      schema: WORKSTATION_REQUEST_SCHEMA,
      requestId: 'request-7a-offline',
      inputSchema: 'ghostnote-exact-note-source-v0',
      sourceSha256: payload.source.digest.value,
      payload,
    },
  );
  assert.equal(response.payload.context.events.length, 3);
  assert.equal(registry.discover()[0]!.state, 'degraded');
  await assert.rejects(
    registry.request('ghostnote-symbolic-context', {
      schema: WORKSTATION_REQUEST_SCHEMA,
      requestId: 'request-7a-mismatch',
      inputSchema: 'ghostnote-exact-note-source-v0',
      sourceSha256: 'b'.repeat(64),
      payload,
    }),
    /request source digest does not match/,
  );
  assert.throws(
    () => exactSourceToContext({ ...payload, expectedGeneration: 'stale' }),
    (error) => error instanceof SymbolicContextError && /stale/.test(error.message),
  );
});
