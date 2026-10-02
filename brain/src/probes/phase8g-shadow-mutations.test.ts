import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ACQUIRED_FIELDS, MUTATION_LABELS, MUTATION_MARKER, PROPERTY_CASES, applyExpectedProps,
  checkMutationComparison, checkMutationNotes, collectMutationRegistry, REQUIRED_MUTATION_METHODS, verifyMutationMethods,
  verifyMutationOverflow, verifyMutationRegistry, verifyMutationReport } from './phase8g-shadow-mutations.js';
import type { ShadowNote } from './phase8g-shadow-cache-lib.js';

const fields = Object.fromEntries(ACQUIRED_FIELDS.map(field => [field, field.startsWith('is') ? false : field === 'occurrence' ? 'ALWAYS' : 0]));
Object.assign(fields, { velocity: 80 / 127, gain: 1, rawGain: 1, timbre: .25, rawTimbre: -.5,
  chance: .375, duration: 2 / 512, durationCells: 2, rawDuration: 2 / 512 });
const note: ShadowNote = { channel: 0, cell: 0, pitch: 60, fields };
const coverage = { startCell: 0, width: 2048, allChannels: true, fields: [...ACQUIRED_FIELDS],
  unsupportedFields: ['portableRepeat', 'articulation'], timingBasis: '1/512-beat' };
const snapshot = { clipRef: 'owned-A', address: { trackId: 'owned', row: 0 },
  token: { initDomain: 'loaded-controller-one', project: 1, structure: 1, binding: 1, rebuild: 1 },
  contentGeneration: 1, invalidationSequence: 0, coverage,
  metadata: { name: 'gn-8g-reuse-A', exists: true, length: 4 }, notes: [note], fingerprint: 'notes' };
const result = { instrumentationRevision: MUTATION_MARKER, comparison: 'match', complete: false, eligible: false,
  callbackSourceIdentityKnown: false, authorityAvailable: true, contentComparisonComplete: true,
  physicalPendingHints: 0, pendingCoordinates: 0, physicalHintOverflow: false,
  stepDataObservers: 3, residentHandles: 2, observerKind: 'addStepDataObserver', diagnosticSnapshot: snapshot,
  authorityNotes: [note], authorityMetadata: snapshot.metadata, authorityCoverage: coverage };

test('the driver requires only active methods and refuses a missing write route before mutation', async () => {
  const golden = JSON.parse(await readFile(new URL('../../../extension/methods.probe.golden.json', import.meta.url), 'utf8')) as { identity: string; methods: string[] };
  const table = { runtimeProfile: golden.identity, methods: golden.methods };
  assert.doesNotThrow(() => verifyMutationMethods(table)); assert(!REQUIRED_MUTATION_METHODS.some(method => String(method) === 'cursor.moveNote'));
  assert.throws(() => verifyMutationMethods({ ...table, methods: golden.methods.filter(method => method !== 'cursor.clearNote') }), /cursor.clearNote/);
  assert.throws(() => verifyMutationMethods({ ...table, runtimeProfile: 'normal-v1' }));
});

test('the warm corpus has one canonical sequence and covers every writable host field', () => {
  assert.equal(MUTATION_LABELS.length, 38); assert.equal(new Set(MUTATION_LABELS).size, 38);
  const written = new Set(PROPERTY_CASES.flatMap(value => Object.keys(value.props)));
  const expected = ACQUIRED_FIELDS.filter(field => !['pressure', 'durationCells', 'rawDuration', 'rawGain', 'rawTimbre', 'recurrenceLength', 'recurrenceMask'].includes(field));
  assert.deepEqual([...written].sort(), [...expected, 'recurrence'].sort());
  assert(!written.has('pressure'));
  for (const suffix of ['chance', 'occurrence', 'recurrence', 'repeat']) for (const prefix of ['enable-only', 'disable-only']) {
    const value = PROPERTY_CASES.find(value => value.label === `${prefix}-${suffix}`)!;
    assert.equal(Object.keys(value.props).length, 1); assert.equal(typeof Object.values(value.props)[0], 'boolean');
  }
});

test('the expected model uses raw host units and refuses a pressure write', () => {
  const value = { ...structuredClone(note), fields: { ...note.fields } };
  applyExpectedProps(value, { gain: .625, timbre: -.5, duration: 9 / 512, recurrence: [8, 85] });
  assert.equal(value.fields.gain, 1.25); assert.equal(value.fields.rawGain, 1.25);
  assert.equal(value.fields.timbre, .25); assert.equal(value.fields.rawTimbre, -.5);
  assert.equal(value.fields.durationCells, 9); assert.equal(value.fields.rawDuration, 9 / 512);
  assert.equal(value.fields.recurrenceLength, 8); assert.equal(value.fields.recurrenceMask, 85);
  assert.throws(() => applyExpectedProps(value, { pressure: .5 }), /unwritable/);
});

test('equal wrong fields, disabled values, and membership cannot pass the fixture oracle', () => {
  assert.deepEqual(checkMutationComparison(result, 0, 'owned', [note]), []);
  for (const changed of [{ chance: .625 }, { isChanceEnabled: true }, { rawTimbre: .5 }, { gain: .625 }, { recurrenceMask: 85 }]) {
    const wrong = { ...note, fields: { ...fields, ...changed } };
    assert(checkMutationComparison({ ...result, diagnosticSnapshot: { ...snapshot, notes: [wrong] }, authorityNotes: [wrong] }, 0, 'owned', [note]).length > 0);
  }
  assert.deepEqual(checkMutationNotes([{ ...note, channel: 15 }], [note]), ['fixture-membership-mismatch']);
  assert.deepEqual(checkMutationNotes([note, note], [note]), ['fixture-membership-mismatch']);
  assert(checkMutationNotes([{ ...note, fields: { ...fields, velocity: NaN } }], [note]).length > 0);
});

test('comparison authority needs exact identity, full coverage, a new controller domain, and closed eligibility', () => {
  for (const changed of [{ complete: true }, { eligible: true }, { callbackSourceIdentityKnown: true },
    { authorityAvailable: false }, { contentComparisonComplete: false }, { pendingCoordinates: 1 },
    { physicalPendingHints: 1 }, { physicalHintOverflow: true }, { stepDataObservers: 4 },
    { residentHandles: 3 }, { instrumentationRevision: 'old' }, { observerKind: 'addNoteStepObserver' },
    { authorityCoverage: { ...coverage, allChannels: false } }, { authorityCoverage: { ...coverage, width: 1024 } },
    { diagnosticSnapshot: { ...snapshot, address: { ...snapshot.address, row: 2 } } },
    { diagnosticSnapshot: { ...snapshot, token: { ...snapshot.token, initDomain: '' } } }]) {
    assert(checkMutationComparison({ ...result, ...changed }, 0, 'owned', [note]).length > 0);
  }
});

test('an empty or truncated retained report cannot certify the live mutation corpus', () => {
  const registry = { rebuildTerminal: true, registryPublished: true, complete: false, eligible: false,
    inventoryRebuild: { phase: 'published', terminal: true, registryPublished: true, fullInventoryEnumerated: true,
      membershipComplete: false, complete: false, eligible: false } };
  const inventory = { operation: 'inventory', statuses: [registry], result: registry }, rebuild = { ...inventory, operation: 'rebuild' };
  const report = { marker: MUTATION_MARKER, researchOnly: true, complete: false, eligible: false,
    fixtureRestored: true, ended: '2026-10-01T00:00:00Z', ownedTrackId: 'owned',
    initialInventory: inventory, recoveryInventory: rebuild, cleanupInventory: rebuild,
    methods: { runtimeProfile: 'phase-8-probe-v1', methods: [...REQUIRED_MUTATION_METHODS] }, cases: [] };
  assert.throws(() => verifyMutationReport(report));
  assert.throws(() => verifyMutationReport({ ...report, cases: [{ label: 'baseline-A', result }] }));
  assert.throws(() => verifyMutationReport({ ...report, marker: 'old' }));
  assert.throws(() => verifyMutationReport({ ...report, fixtureRestored: false }));
});

test('the real burst witness requires 2049 distinct inputs, bounded storage, shedding, and refusal', () => {
  const status = { instrumentationRevision: MUTATION_MARKER, complete: false, eligible: false,
    callbackSourceIdentityKnown: false, pendingWorkItemsIncludingPhysicalHints: 0, physicalPendingHints: 0,
    stepDataObservers: 3, physicalHintOverflow: true, physicalHintDrops: 1, resident: 0 };
  const refusal = { complete: false, eligible: false, authorityAvailable: false, reason: 'physical-hint-backpressure-rebuild-required' };
  const input = { channel: 15, notes: Array.from({ length: 2049 }, (_, key) => [Math.floor(key / 128), key % 128, 100, 1 / 512]) };
  const burst = { label: 'overflow-2049', action: { written: 2049 }, request: input,
    statuses: [status], pointRefusal: refusal, compareRefusal: refusal };
  assert.doesNotThrow(() => verifyMutationOverflow(burst));
  for (const changed of [{ pendingWorkItemsIncludingPhysicalHints: 2049 }, { physicalPendingHints: 2049 },
    { physicalHintDrops: 0 }, { resident: 1 }, { physicalHintOverflow: false }, { eligible: true },
    { callbackSourceIdentityKnown: true }]) assert.throws(() => verifyMutationOverflow({ ...burst, statuses: [{ ...status, ...changed }] }));
  assert.throws(() => verifyMutationOverflow({ ...burst, request: { ...input, notes: input.notes.slice(0, 2048) } }));
  assert.throws(() => verifyMutationOverflow({ ...burst, compareRefusal: { ...refusal, authorityAvailable: true } }));
  assert.throws(() => verifyMutationOverflow({ ...burst, pointRefusal: { ...refusal, reason: 'warming' } }));
});

test('private inventory polling ends on publication and never retries an aborted attempt', async () => {
  const pending = { rebuildTerminal: false, registryPublished: false, complete: false, eligible: false,
    inventoryRebuild: { phase: 'enumerating', terminal: false, registryPublished: false } };
  const published = { ...pending, rebuildTerminal: true, registryPublished: true,
    inventoryRebuild: { phase: 'published', terminal: true, registryPublished: true, fullInventoryEnumerated: true,
      membershipComplete: false, complete: false, eligible: false } };
  const retained: Record<string, unknown>[] = []; let calls = 0;
  assert.deepEqual(await collectMutationRegistry(pending, async () => { calls++; return published; }, retained), published);
  assert.equal(calls, 1); assert.deepEqual(retained, [pending, published]);
  const aborted = { ...pending, rebuildTerminal: true, inventoryRebuild: { phase: 'aborted', terminal: true, registryPublished: false } };
  calls = 0;
  await assert.rejects(collectMutationRegistry(aborted, async () => { calls++; return published; }), /did not publish/);
  assert.equal(calls, 0);
  await assert.rejects(collectMutationRegistry({ ...pending, inventoryRebuild: undefined }, async () => published), /did not start/);
  for (const changed of [{ registryPublished: false }, { eligible: true }, { complete: true },
    { inventoryRebuild: { ...published.inventoryRebuild, membershipComplete: true } }]) {
    assert.throws(() => verifyMutationRegistry({ ...published, ...changed }));
  }
});
