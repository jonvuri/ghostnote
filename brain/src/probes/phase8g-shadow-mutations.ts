/** Check warm shadow mutations and restore the owned replay fixture. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { BridgeClient } from '../client.js';
import { checkExpectedFixture } from './phase8g-lifecycle-reuse.js';
import { compareShadowSnapshots, shadowSnapshotFromWire, type NormalizedValue, type ShadowCacheWireSnapshot, type ShadowNote } from './phase8g-shadow-cache-lib.js';

type Wire = Record<string, unknown>;
type Note = { channel: number; cell: number; pitch: number; fields: Record<string, NormalizedValue> };
const GRID = 1 / 512, WIDTH = 2048, LIMIT = 2048;
export const MUTATION_MARKER = '8g-shadow-physical-hints-v5';
export const MUTATION_OUTPUT = '/tmp/ghostnote-8g-shadow-mutations-v5-results.json';
export const REQUIRED_MUTATION_METHODS = ['cache.shadow', 'contract.hello', 'cursor.clearNote', 'cursor.clearNotes',
  'cursor.pin', 'cursor.pinTrack', 'cursor.pointTrack', 'cursor.scrollToStep', 'cursor.setNoteProps', 'cursor.setNotes',
  'cursor.setStepSize', 'cursor.status', 'ping', 'rig.methods', 'slot.select', 'track.list'] as const;
/** Check the active wire table before any cursor or clip change. */
export function verifyMutationMethods(value: Wire): void {
  assert.equal(value.runtimeProfile, 'phase-8-probe-v1');
  assert(Array.isArray(value.methods) && value.methods.every(method => typeof method === 'string'));
  const missing = REQUIRED_MUTATION_METHODS.filter(method => !(value.methods as string[]).includes(method));
  assert.deepEqual(missing, [], `required mutation methods unavailable: ${missing.join(', ')}`);
}
export function verifyMutationRegistry(value: Wire): void {
  assert.equal(value.rebuildTerminal, true); assert.equal(value.registryPublished, true, 'private registry did not publish');
  const state = value.inventoryRebuild as Wire; assert(state, 'inventory status unavailable');
  assert.equal(state.phase, 'published'); assert.equal(state.terminal, true); assert.equal(state.registryPublished, true);
  assert.equal(state.fullInventoryEnumerated, true); assert.equal(state.membershipComplete, false);
  assert.equal(state.complete, false); assert.equal(state.eligible, false);
  assert.equal(value.complete, false); assert.equal(value.eligible, false);
}
/** Continue this attempt only. A failed attempt needs an explicit caller action. */
export async function collectMutationRegistry(first: Wire, readNext: () => Promise<Wire>, retained: Wire[] = []): Promise<Wire> {
  let value = first; const started = performance.now();
  for (;;) {
    retained.push(value);
    assert.equal(typeof value.rebuildTerminal, 'boolean'); assert.equal(typeof value.registryPublished, 'boolean');
    assert(value.inventoryRebuild, 'inventory attempt did not start');
    if (value.rebuildTerminal) { verifyMutationRegistry(value); return value; }
    assert.equal(value.registryPublished, false); assert.equal(value.complete, false); assert.equal(value.eligible, false);
    assert(performance.now() - started < 45_000, 'inventory attempt expired');
    await wait(); value = await readNext();
  }
}
export const ACQUIRED_FIELDS = ['velocity', 'releaseVelocity', 'velocitySpread', 'duration', 'durationCells', 'rawDuration',
  'gain', 'rawGain', 'pan', 'pressure', 'timbre', 'rawTimbre', 'transpose', 'chance', 'isChanceEnabled', 'isMuted',
  'isOccurrenceEnabled', 'occurrence', 'isRecurrenceEnabled', 'recurrenceLength', 'recurrenceMask', 'isRepeatEnabled',
  'repeatCount', 'repeatCurve', 'repeatVelocityCurve', 'repeatVelocityEnd'] as const;
export const PROPERTY_CASES: readonly { label: string; props: Wire }[] = [
  { label: 'field-velocity', props: { velocity: .625 } },
  { label: 'field-releaseVelocity', props: { releaseVelocity: .375 } },
  { label: 'field-velocitySpread', props: { velocitySpread: .125 } },
  { label: 'field-duration-sustain', props: { duration: 9 * GRID } },
  { label: 'field-gain', props: { gain: .625 } },
  { label: 'field-pan', props: { pan: -.25 } },
  { label: 'field-timbre', props: { timbre: .5 } },
  { label: 'field-transpose', props: { transpose: 3 } },
  { label: 'disabled-chance-value', props: { chance: .625 } },
  { label: 'enable-only-chance', props: { isChanceEnabled: true } },
  { label: 'disable-only-chance', props: { isChanceEnabled: false } },
  { label: 'mute-only', props: { isMuted: true } },
  { label: 'unmute-only', props: { isMuted: false } },
  { label: 'disable-expression-groups', props: { isOccurrenceEnabled: false, isRecurrenceEnabled: false, isRepeatEnabled: false } },
  { label: 'disabled-occurrence-value', props: { occurrence: 'FIRST' } },
  { label: 'enable-only-occurrence', props: { isOccurrenceEnabled: true } },
  { label: 'disable-only-occurrence', props: { isOccurrenceEnabled: false } },
  { label: 'disabled-recurrence-value', props: { recurrence: [8, 85] } },
  { label: 'enable-only-recurrence', props: { isRecurrenceEnabled: true } },
  { label: 'disable-only-recurrence', props: { isRecurrenceEnabled: false } },
  { label: 'disabled-repeat-count', props: { repeatCount: 3 } },
  { label: 'disabled-repeat-curve', props: { repeatCurve: -.25 } },
  { label: 'disabled-repeat-velocity-curve', props: { repeatVelocityCurve: .5 } },
  { label: 'disabled-repeat-velocity-end', props: { repeatVelocityEnd: .75 } },
  { label: 'enable-only-repeat', props: { isRepeatEnabled: true } },
  { label: 'disable-only-repeat', props: { isRepeatEnabled: false } },
];
export const MUTATION_LABELS = ['baseline-A', 'baseline-B', 'baseline-empty', ...PROPERTY_CASES.map(value => value.label),
  'channel15-disabled-fields', 'add-sustain', 'move-sparse', 'remove-sparse', 'final-covered-cell', 'clear', 'refill',
  'overflow-2049', 'rebuild-recovery'] as const;
const CHANNEL15_PROPS = { chance: .125, isChanceEnabled: false, gain: .75, timbre: -.25 };
const identity = (note: ShadowNote): string => `${note.channel}:${note.cell}:${note.pitch}`;
const clone = (notes: readonly ShadowNote[]): Note[] => structuredClone(notes) as Note[];
function measure(value: unknown, name: string): number {
  assert(typeof value === 'number' && Number.isFinite(value) && value >= 0, `invalid measurement: ${name}`);
  return value;
}
function close(actual: unknown, expected: unknown): boolean {
  return typeof expected === 'number' ? typeof actual === 'number' && Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-6 : actual === expected;
}
export function checkMutationNotes(actual: readonly ShadowNote[], expected: readonly ShadowNote[]): string[] {
  const issues: string[] = [], values = new Map(actual.map(note => [identity(note), note]));
  if (values.size !== actual.length || JSON.stringify([...values.keys()].sort()) !== JSON.stringify(expected.map(identity).sort())) return ['fixture-membership-mismatch'];
  for (const note of expected) for (const field of ACQUIRED_FIELDS) {
    if (!Object.hasOwn(note.fields, field) || !close(values.get(identity(note))!.fields[field], note.fields[field])) issues.push(`fixture-field:${identity(note)}:${field}`);
  }
  return issues;
}
/** Model raw setter units. Pressure is never a write input. */
export function applyExpectedProps(note: Note, props: Wire): void {
  assert(!Object.hasOwn(props, 'pressure'), 'pressure is unwritable');
  for (const [field, value] of Object.entries(props)) {
    if (field === 'gain') { note.fields.gain = Number(value) * 2; note.fields.rawGain = Number(value) * 2; }
    else if (field === 'timbre') { note.fields.rawTimbre = Number(value); note.fields.timbre = (Number(value) + 1) / 2; }
    else if (field === 'duration') { note.fields.rawDuration = Number(value); note.fields.durationCells = Math.max(1, Math.floor(Number(value) * 512 + .5)); note.fields.duration = Number(note.fields.durationCells) * GRID; }
    else if (field === 'recurrence') { const pair = value as number[]; assert(pair.length === 2 && pair[0]! <= 8); note.fields.recurrenceLength = pair[0]!; note.fields.recurrenceMask = pair[1]!; }
    else { assert(value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'); note.fields[field] = value; }
  }
}
export function checkMutationComparison(value: Wire, row: number, trackId: string, expected: readonly ShadowNote[], marker = MUTATION_MARKER): string[] {
  const issues: string[] = [];
  if (value.comparison !== 'match') return [`comparison:${String(value.comparison)}`];
  const wire = value.diagnosticSnapshot as ShadowCacheWireSnapshot;
  assert(wire && Array.isArray(value.authorityNotes) && value.authorityMetadata, 'comparison payload unavailable');
  if (value.instrumentationRevision !== marker || value.stepDataObservers !== 3 || value.residentHandles !== 2 || value.observerKind !== 'addStepDataObserver') issues.push('physical-pool-or-marker');
  if (value.complete !== false || value.eligible !== false || value.callbackSourceIdentityKnown !== false) issues.push('unproved-eligibility');
  if (value.authorityAvailable !== true || value.contentComparisonComplete !== true) issues.push('comparison-incomplete');
  if (value.physicalPendingHints !== 0 || value.pendingCoordinates !== 0 || value.physicalHintOverflow !== false) issues.push('pending-work');
  if (wire.address.trackId !== trackId || wire.address.row !== row) issues.push('fixture-address');
  if (typeof wire.token.initDomain !== 'string' || !wire.token.initDomain.trim()) issues.push('init-domain');
  const name = `gn-8g-reuse-${['A', 'B', 'empty'][row]}`;
  if (wire.metadata.name !== name || (value.authorityMetadata as Wire).name !== name) issues.push('fixture-name');
  const authorityCoverage = value.authorityCoverage as ShadowCacheWireSnapshot['coverage'];
  for (const coverage of [wire.coverage, authorityCoverage]) {
    if (!coverage || coverage.startCell !== 0 || coverage.width !== WIDTH || coverage.allChannels !== true || coverage.timingBasis !== '1/512-beat'
      || ACQUIRED_FIELDS.some(field => !coverage.fields.includes(field))) issues.push('fixture-coverage');
  }
  if (issues.length > 0) return issues;
  const cached = shadowSnapshotFromWire(wire, 'complete');
  const authority = shadowSnapshotFromWire({ ...wire, coverage: authorityCoverage, notes: value.authorityNotes as ShadowNote[], metadata: value.authorityMetadata as ShadowCacheWireSnapshot['metadata'] }, 'complete');
  if (compareShadowSnapshots(cached, authority, { before: cached.window, after: cached.window }).outcome !== 'match') issues.push('typed-comparison');
  issues.push(...checkMutationNotes(cached.notes, expected), ...checkMutationNotes(authority.notes, expected));
  return issues;
}
function newNote(template: Note, cell: number, pitch: number, duration: number): Note {
  const note = { ...structuredClone(template), channel: 15, cell, pitch };
  applyExpectedProps(note, { velocity: 100 / 127, duration }); return note;
}
function advanceExpected(notes: Note[], label: string, baseline: readonly Note[]): Note[] {
  const properties = PROPERTY_CASES.find(value => value.label === label);
  if (properties) applyExpectedProps(notes.find(note => note.channel === 0)!, properties.props);
  else if (label === 'channel15-disabled-fields') applyExpectedProps(notes.find(note => note.channel === 15)!, CHANNEL15_PROPS);
  else if (label === 'add-sustain') notes.push(newNote(baseline.find(note => note.channel === 15)!, 12, 76, 4 * GRID));
  else if (label === 'move-sparse') { const moved = notes.find(note => note.cell === 12 && note.pitch === 76)!; moved.cell = 20; moved.pitch = 77; }
  else if (label === 'remove-sparse') notes = notes.filter(note => !(note.cell === 20 && note.pitch === 77));
  else if (label === 'final-covered-cell') notes.push(newNote(baseline.find(note => note.channel === 15)!, 2047, 127, GRID));
  else if (label === 'clear') notes = [];
  else if (label === 'refill' || label === 'rebuild-recovery') notes = clone(baseline);
  return notes;
}
function baselineIssues(notes: readonly ShadowNote[], row: number): string[] {
  const issues = [...checkExpectedFixture(notes, row)];
  for (const note of notes) {
    if (!close(note.fields.velocity, (row === 0 ? 80 + note.channel : 100) / 127) || !close(note.fields.rawDuration, 2 * GRID)) issues.push('baseline-note-values');
    if (note.fields.pressure !== 0) issues.push('baseline-pressure-unrestorable');
    if (ACQUIRED_FIELDS.some(field => !Object.hasOwn(note.fields, field))) issues.push('baseline-field-coverage');
  }
  return issues;
}
export function verifyMutationOverflow(value: Wire, marker = MUTATION_MARKER): void {
  assert.equal(value.label, 'overflow-2049'); assert.equal((value.action as Wire)?.written, 2049);
  const input = value.request as { channel: number; notes: number[][] };
  assert.equal(input.channel, 15); assert.deepEqual(input.notes, Array.from({ length: 2049 }, (_, key) => [Math.floor(key / 128), key % 128, 100, GRID]));
  const statuses = value.statuses as Wire[]; assert(Array.isArray(statuses) && statuses.length > 0);
  for (const status of statuses) {
    assert.equal(status.instrumentationRevision, marker); assert.equal(status.complete, false); assert.equal(status.eligible, false);
    assert.equal(status.callbackSourceIdentityKnown, false); assert(measure(status.pendingWorkItemsIncludingPhysicalHints, 'pending') <= LIMIT);
    assert(measure(status.physicalPendingHints, 'physical pending') <= LIMIT); assert.equal(status.stepDataObservers, 3);
  }
  const final = statuses.at(-1)!; assert.equal(final.physicalHintOverflow, true); assert.equal(final.resident, 0);
  assert(measure(final.physicalHintDrops, 'drops') > 0);
  for (const refusal of [value.pointRefusal, value.compareRefusal] as Wire[]) {
    assert.equal(refusal.complete, false); assert.equal(refusal.eligible, false); assert.equal(refusal.authorityAvailable, false);
    assert(!refusal.diagnosticSnapshot && !refusal.authorityNotes);
  }
  assert.match(String((value.pointRefusal as Wire).reason), /rebuild-required/);
}
/** Recompute every expectation from the fixed corpus and its original fixture. */
export function verifyMutationReport(report: Wire, marker = MUTATION_MARKER): number {
  assert.equal(report.marker, marker); assert.equal(report.researchOnly, true); assert.equal(report.complete, false); assert.equal(report.eligible, false);
  assert.equal(report.fixtureRestored, true); assert.equal(typeof report.ended, 'string'); assert.equal(typeof report.ownedTrackId, 'string');
  verifyMutationMethods(report.methods as Wire);
  for (const field of ['initialInventory', 'recoveryInventory', 'cleanupInventory']) {
    const attempt = report[field] as Wire; assert(attempt && Array.isArray(attempt.statuses) && attempt.statuses.length > 0);
    assert.equal(attempt.operation, field === 'initialInventory' ? 'inventory' : 'rebuild');
    for (const status of attempt.statuses.slice(0, -1) as Wire[]) {
      assert.equal(status.rebuildTerminal, false); assert.equal(status.registryPublished, false);
      assert.equal(status.complete, false); assert.equal(status.eligible, false);
    }
    verifyMutationRegistry(attempt.result as Wire);
    assert.deepEqual(attempt.result, attempt.statuses.at(-1));
  }
  const track = report.ownedTrackId as string; assert(track.length > 0);
  const cases = report.cases as Wire[]; assert(Array.isArray(cases)); assert.deepEqual(cases.map(value => value.label), MUTATION_LABELS);
  const baselines = cases.slice(0, 3).map((value, row) => {
    const result = value.result as Wire, notes = (result.diagnosticSnapshot as ShadowCacheWireSnapshot).notes;
    assert.deepEqual(baselineIssues(notes, row), []); assert.deepEqual(checkMutationComparison(result, row, track, notes, marker), []); return clone(notes);
  });
  let expected = clone(baselines[0]!);
  for (const [index, value] of cases.entries()) {
    assert.equal(value.outcome, 'pass');
    for (const name of ['bridgeRequests', 'responseBytes', 'wallMs']) measure(value[name], name);
    if (value.label !== 'overflow-2049') {
      const metrics = value.metrics as Wire;
      for (const name of ['membershipGetStepCalls', 'authorityGetStepCalls', 'enrichmentGetStepCalls', 'membershipHostWorkMs', 'authorityHostWorkMs', 'enrichmentHostWorkMs',
        'recorderEstimatedBytes', 'physicalHintRecorderEstimatedBytes', 'retainedSnapshotEstimatedBytes', 'snapshotPayloadEstimatedBytes']) measure(metrics[name], name);
      assert.equal(metrics.authorityGetStepCalls, WIDTH * 128 * 16, 'independent authority must scan the complete configured grid');
      assert.equal(metrics.serializedBytesAreMemoryMeasurement, false);
    }
    if (index < 3) continue;
    if (value.label === 'overflow-2049') { verifyMutationOverflow(value, marker); continue; }
    expected = advanceExpected(expected, String(value.label), baselines[0]!);
    assert.deepEqual(checkMutationComparison(value.result as Wire, 0, track, expected, marker), []);
    const binding = value.binding as Wire;
    if (value.label === 'rebuild-recovery') assert.equal(binding.canaryVerifiedForBinding, true);
    else { assert.equal(binding.recorderPreserved, true); assert.equal(binding.physicalBindingRevision, (value.before as Wire).physicalBindingRevision); }
  }
  const restored = report.restoration as Wire[]; assert(Array.isArray(restored) && restored.length === 3);
  for (const [row, value] of restored.entries()) {
    assert.equal(value.row, row); assert.deepEqual(checkMutationComparison(value.result as Wire, row, track, baselines[row]!, marker), []);
    assert.deepEqual((value.result as Wire).authorityMetadata, (cases[row]!.result as Wire).authorityMetadata);
  }
  return cases.length;
}

const bridge = new BridgeClient();
let calls = 0, bytes = 0;
const wait = async (ms = 50): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms));
async function request<T = Wire>(method: string, params?: Wire): Promise<T> {
  calls++; const value = await bridge.request(method, params); bytes += Buffer.byteLength(JSON.stringify(value)); return value as T;
}
async function shadow(operation: string, params: Wire = {}): Promise<Wire> { return await request('cache.shadow', { operation, ...params }); }
async function poll(read: () => Promise<Wire>, done: (value: Wire) => boolean, limit = 45_000): Promise<Wire> {
  const started = performance.now();
  for (;;) { const value = await read(); if (done(value)) return value; assert(performance.now() - started < limit, `poll expired: ${JSON.stringify(value)}`); await wait(); }
}
interface Track { index: number; channelId: string; name: string }
async function ownedTrack(id: string): Promise<Track> {
  const tracks = (await request<{ tracks: Track[] }>('track.list')).tracks;
  const selected = tracks.filter(track => track.channelId === id); assert.equal(selected.length, 1, 'owned track identity is not unique');
  const track = selected[0]!; assert.equal(track.name, 'gn-8g-reuse', 'fixture ownership changed'); return track;
}
async function pointWriter(id: string, row: number, page = 0): Promise<void> {
  const track = await ownedTrack(id), cursor = 'fine';
  await request('cursor.pin', { cursor, pinned: false }); await request('cursor.pinTrack', { cursor, pinned: false });
  await request('cursor.pointTrack', { cursor, trackIndex: track.index });
  await poll(() => request('cursor.status', { cursor }), value => value.trackExists === true && value.trackPosition === track.index);
  await request('cursor.pinTrack', { cursor, pinned: true }); await request('slot.select', { trackIndex: track.index, slotIndex: row, mechanism: 'track' });
  await poll(() => request('cursor.status', { cursor }), value => value.slotExists === true && value.sceneIndex === row);
  await request('cursor.pin', { cursor, pinned: true }); await request('cursor.setStepSize', { cursor, stepSize: GRID });
  await request('cursor.scrollToStep', { cursor, step: page }); await wait(150);
}
async function guardWriter(id: string, row = 0): Promise<void> {
  const track = await ownedTrack(id), status = await request('cursor.status', { cursor: 'fine' });
  assert.equal(status.trackPosition, track.index); assert.equal(status.sceneIndex, row); assert.equal(status.slotExists, true);
  assert.equal(status.isPinned, true); assert.equal(status.cursorTrackPinned, true);
}
async function props(channel: number, x: number, y: number, values: Wire): Promise<Wire> {
  assert(!Object.hasOwn(values, 'pressure'));
  const result = await request('cursor.setNoteProps', { cursor: 'fine', channel, x, y, props: values });
  assert.deepEqual(result.applied, Object.fromEntries(Object.keys(values).map(key => [key, 'ok']))); return result;
}
async function forceBind(id: string, index: number, row: number): Promise<Wire> {
  const track = await ownedTrack(id);
  const first = await shadow('point', { index, trackIndex: track.index, row, canaryTrackIndex: track.index, canaryRow: row === 0 ? 1 : 0 });
  assert.equal(first.recorderPreserved, false);
  const final = await poll(() => shadow('poll', { index }), value => value.phase === 'retired' || ((value.phase === 'settled' || value.phase === 'complete') && value.canaryPhase === 'target'));
  assert.equal(final.phase, 'settled'); assert.equal(final.canaryVerifiedForBinding, true); await shadow('reconcile', { index }); return final;
}
async function compare(index: number): Promise<Wire> {
  let value = await shadow('compareStart', { index });
  return await poll(async () => { if (value.comparison === 'pending') value = await shadow('comparePoll'); return value; }, result => result.comparison !== 'pending');
}
function readMetrics(before: Wire, after: Wire, result: Wire): Wire {
  const metrics: Wire = {};
  for (const field of ['membershipGetStepCalls', 'authorityGetStepCalls', 'enrichmentGetStepCalls', 'membershipHostWorkMs', 'authorityHostWorkMs', 'enrichmentHostWorkMs']) {
    metrics[field] = measure(after[field], field) - measure(before[field], field); assert(Number(metrics[field]) >= 0);
  }
  for (const field of ['recorderEstimatedBytes', 'physicalHintRecorderEstimatedBytes', 'retainedSnapshotEstimatedBytes']) metrics[field] = measure(after[field], field);
  metrics.snapshotPayloadEstimatedBytes = (result.diagnosticSnapshot as Wire | undefined)?.payloadEstimatedBytes ?? null;
  metrics.serializedBytesAreMemoryMeasurement = false; return metrics;
}
async function writeOriginal(id: string, row: number, notes: readonly Note[]): Promise<void> {
  await pointWriter(id, row); await guardWriter(id, row); await request('cursor.clearNotes', { cursor: 'fine' }); await wait(150);
  for (const note of notes) {
    assert.equal(note.fields.pressure, 0, 'cannot reconstruct pressure');
    await request('cursor.scrollToStep', { cursor: 'fine', step: note.cell }); await wait(50);
    await request('cursor.setNotes', { cursor: 'fine', channel: note.channel, notes: [[0, note.pitch, Math.round(Number(note.fields.velocity) * 127), note.fields.rawDuration]] }); await wait(50);
    const values: Wire = Object.fromEntries(ACQUIRED_FIELDS.filter(field => !['pressure', 'gain', 'rawGain', 'timbre', 'rawTimbre', 'rawDuration', 'durationCells', 'recurrenceLength', 'recurrenceMask'].includes(field))
      .map(field => [field, note.fields[field]]));
    values.duration = note.fields.rawDuration; values.gain = Number(note.fields.rawGain) / 2; values.timbre = note.fields.rawTimbre;
    values.recurrence = [note.fields.recurrenceLength, note.fields.recurrenceMask];
    await props(note.channel, 0, note.pitch, values);
  }
  await request('cursor.scrollToStep', { cursor: 'fine', step: 0 }); await wait(250);
}
async function run(marker: string, output: string): Promise<void> {
  assert.match(marker, /^8g-shadow-physical-hints-v\d+$/);
  const hello = await request('contract.hello'), methods = await request('rig.methods');
  verifyMutationMethods(methods); assert.equal(hello.runtimeProfile, methods.runtimeProfile); assert.equal(hello.methodsHash, methods.methodsHash);
  const state = JSON.parse(await readFile('/tmp/ghostnote-8g-research-state.json', 'utf8')) as { ownedTrackId: string };
  assert.equal(typeof state.ownedTrackId, 'string'); const id = state.ownedTrackId; await ownedTrack(id);
  const initial = await shadow('info'); assert.equal(initial.instrumentationRevision, marker); assert.equal(initial.steps, WIDTH);
  assert.equal(initial.residentHandles, 2); assert.equal(initial.stepDataObservers, 3); assert.equal(initial.eligible, false);
  const report: Wire = { marker, started: new Date().toISOString(), ownedTrackId: id, researchOnly: true, complete: false, eligible: false, hello, methods, initial, cases: [] };
  const cases = report.cases as Wire[], baselines: Note[][] = [], baselineMetadata: Wire[] = [];
  const persist = async (): Promise<void> => await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  const registry = async (operation: 'inventory' | 'rebuild', field: string): Promise<void> => {
    const attempt: Wire = { operation, statuses: [] }; report[field] = attempt; await persist();
    attempt.result = await collectMutationRegistry(await shadow(operation), async () => {
      await persist(); return await shadow('rebuildPoll');
    }, attempt.statuses as Wire[]);
    await persist();
  };
  const arm = async (label: string, row: number, action: () => Promise<Wire>, expected: () => readonly Note[], index = 0, forced = false): Promise<void> => {
    const started = performance.now(), count = calls, size = bytes, before = await shadow('status', { index });
    const value: Wire = { label, row, before }; cases.push(value); await persist();
    try {
      const track = await ownedTrack(id);
      value.binding = forced ? await forceBind(id, index, row) : await shadow('point', { index, trackIndex: track.index, row });
      if (!forced) { assert.equal((value.binding as Wire).recorderPreserved, true); assert.equal((value.binding as Wire).physicalBindingRevision, before.physicalBindingRevision); }
      value.action = await action(); await wait(250); await shadow('reconcile', { index }); value.result = await compare(index);
      value.issues = checkMutationComparison(value.result as Wire, row, id, expected(), marker); assert.deepEqual(value.issues, []);
      value.outcome = 'pass';
    } catch (error) { value.outcome = 'error'; value.error = String(error); throw error; }
    finally { value.after = await shadow('status', { index }); value.metrics = readMetrics(before, value.after as Wire, value.result as Wire ?? {});
      value.wallMs = performance.now() - started; value.bridgeRequests = calls - count; value.responseBytes = bytes - size; await persist();
      console.log(JSON.stringify({ label, outcome: value.outcome, wallMs: value.wallMs })); }
  };
  let expected: Note[] = [];
  try {
    const pings: number[] = []; for (let n = 0; n < 25; n++) { const started = performance.now(); await request('ping'); pings.push(performance.now() - started); }
    pings.sort((a, b) => a - b); report.pingP95Ms = pings[23]; await shadow('ping', { p95Ms: pings[23] }); await registry('inventory', 'initialInventory');
    for (let row = 0; row < 3; row++) {
      await arm(MUTATION_LABELS[row]!, row, async () => ({}), () => {
        const result = cases.at(-1)!.result as Wire, wire = result.diagnosticSnapshot as ShadowCacheWireSnapshot;
        assert.deepEqual(baselineIssues(wire.notes, row), []); baselines[row] = clone(wire.notes); baselineMetadata[row] = structuredClone(result.authorityMetadata as Wire); return baselines[row]!;
      }, row === 0 ? 0 : 1, true);
    }
    expected = clone(baselines[0]!); await pointWriter(id, 0);
    for (const { label, props: values } of PROPERTY_CASES) await arm(label, 0, async () => { await guardWriter(id); const result = await props(0, 0, 60, values); expected = advanceExpected(expected, label, baselines[0]!); return result; }, () => expected);
    for (const label of ['channel15-disabled-fields', 'add-sustain', 'move-sparse', 'remove-sparse', 'final-covered-cell', 'clear', 'refill']) {
      await arm(label, 0, async () => {
        await guardWriter(id); let result: Wire;
        if (label === 'channel15-disabled-fields') result = await props(15, 0, 60, CHANNEL15_PROPS);
        else if (label === 'add-sustain') result = await request('cursor.setNotes', { cursor: 'fine', channel: 15, notes: [[12, 76, 100, 4 * GRID]] });
        else if (label === 'move-sparse') {
          const removed = await request('cursor.clearNote', { cursor: 'fine', channel: 15, x: 12, y: 76 });
          await wait(50);
          const added = await request('cursor.setNotes', { cursor: 'fine', channel: 15, notes: [[20, 77, 100, 4 * GRID]] });
          result = { removed, added };
        }
        else if (label === 'remove-sparse') result = await request('cursor.clearNote', { cursor: 'fine', channel: 15, x: 20, y: 77 });
        else if (label === 'final-covered-cell') { await request('cursor.scrollToStep', { cursor: 'fine', step: 2047 }); await wait(150); result = await request('cursor.setNotes', { cursor: 'fine', channel: 15, notes: [[0, 127, 100, GRID]] }); await request('cursor.scrollToStep', { cursor: 'fine', step: 0 }); await wait(150); }
        else if (label === 'clear') result = await request('cursor.clearNotes', { cursor: 'fine' });
        else { await writeOriginal(id, 0, baselines[0]!); result = { restoredNotes: 16 }; }
        expected = advanceExpected(expected, label, baselines[0]!); return result;
      }, () => expected);
    }
    const burst: Wire = { label: 'overflow-2049', row: 0 }, started = performance.now(), count = calls, size = bytes;
    cases.push(burst); await persist();
    try {
      await guardWriter(id); const notes = Array.from({ length: 2049 }, (_, key) => [Math.floor(key / 128), key % 128, 100, GRID]);
      burst.requestedDistinctCoordinates = notes.length; burst.request = { channel: 15, notes }; burst.action = await request('cursor.setNotes', { cursor: 'fine', channel: 15, notes });
      const statuses: Wire[] = []; burst.statuses = statuses;
      await poll(async () => { const status = await shadow('status', { index: 0 }); statuses.push(status); return status; }, value => value.physicalHintOverflow === true, 10_000);
      const track = await ownedTrack(id); burst.pointRefusal = await shadow('point', { index: 0, trackIndex: track.index, row: 0 }); burst.compareRefusal = await shadow('compareStart', { index: 0 });
      verifyMutationOverflow(burst, marker); burst.outcome = 'pass';
    } catch (error) { burst.outcome = 'error'; burst.error = String(error); throw error; }
    finally { burst.wallMs = performance.now() - started; burst.bridgeRequests = calls - count; burst.responseBytes = bytes - size; await persist(); }
    await writeOriginal(id, 0, baselines[0]!); await registry('rebuild', 'recoveryInventory');
    await arm('rebuild-recovery', 0, async () => ({}), () => { expected = clone(baselines[0]!); return expected; }, 0, true);
  } finally {
    report.restoration = []; report.fixtureRestored = false;
    try {
      if (baselines.length !== 3 || baselines.some(notes => notes === undefined)) throw new Error('all original fixture snapshots were not acquired');
      await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 });
      for (let row = 0; row < 3; row++) await writeOriginal(id, row, baselines[row]!);
      await registry('rebuild', 'cleanupInventory');
      for (let row = 0; row < 3; row++) {
        const binding = await forceBind(id, 0, row), result = await compare(0);
        (report.restoration as Wire[]).push({ row, binding, result });
        assert.deepEqual(checkMutationComparison(result, row, id, baselines[row]!, marker), []); assert.deepEqual(result.authorityMetadata, baselineMetadata[row]);
      }
      await pointWriter(id, 0); await shadow('retire', { index: 0 }); report.fixtureRestored = true;
    } catch (error) { report.fixtureRestoreError = String(error); }
    report.ended = new Date().toISOString(); report.bridgeRequests = calls; report.responseBytes = bytes; await persist();
  }
  console.log(`Warm mutation corpus passes ${verifyMutationReport(report, marker)} cases. No eligibility is claimed.`);
}
async function main(): Promise<void> {
  if (process.argv[2] === 'verify') console.log(`Warm mutation corpus passes ${verifyMutationReport(JSON.parse(await readFile(process.argv[3] ?? MUTATION_OUTPUT, 'utf8')) as Wire, process.argv[4] ?? MUTATION_MARKER)} retained cases.`);
  else { assert.equal(process.argv[2], 'run'); await run(process.argv[3] ?? MUTATION_MARKER, process.argv[4] ?? MUTATION_OUTPUT); }
}
if (process.argv[1]?.endsWith('phase8g-shadow-mutations.ts')) void main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
