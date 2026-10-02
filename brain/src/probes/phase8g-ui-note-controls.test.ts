import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { ACQUIRED_FIELDS, MUTATION_MARKER } from './phase8g-shadow-mutations.js';
import { checkStructureComparison } from './phase8g-shadow-structure.js';
import { summarizeUiNoteFences, UI_NOTE_METHODS, UI_NOTE_WARM_REFUSALS, uiNoteSeedSettled, uiVelocityTarget, uiWarmOracleFailure,
  verifyUiNoteCleanup, verifyUiNoteMethods, verifyUiNoteReport } from './phase8g-ui-note-controls.js';
import { GROUP_CONTROL_REVISION } from './phase8g-ui-group-controls.js';
import type { ShadowNote } from './phase8g-shadow-cache-lib.js';
type Wire = Record<string, unknown>;
const fields = { ...Object.fromEntries(ACQUIRED_FIELDS.map(field => [field, field.startsWith('is') ? false : field === 'occurrence' ? 'ALWAYS' : 0])),
  velocity: 80 / 127, duration: 8 / 512, rawDuration: 8 / 512, durationCells: 8, pressure: 0, rawTimbre: 0, timbre: .5, gain: 1, rawGain: 1,
  chance: .375, isChanceEnabled: false, repeatCount: 2, isRepeatEnabled: false };
function target(): { id: string; row: number; name: string; notes: ShadowNote[] } {
  return { id: 'owned', row: 0, name: 'owned-clip', notes: [{ channel: 0, cell: 0, pitch: 60, fields: { ...fields } }] };
}
test('velocity oracle changes only the one acquired field and keeps raw disabled values', () => {
  const original = target(), edited = uiVelocityTarget(original); assert.equal(edited.notes[0]!.fields.velocity, .5);
  assert.equal(original.notes[0]!.fields.velocity, 80 / 127);
  for (const field of ACQUIRED_FIELDS.filter(field => field !== 'velocity')) assert.equal(edited.notes[0]!.fields[field], original.notes[0]!.fields[field]);
});
test('UI seed oracle refuses another note, address, pitch, duration or unwritable pressure', () => {
  for (const patch of [{ pitch: 61 }, { channel: 1 }, { cell: 1 }]) { const value = target(); Object.assign(value.notes[0]!, patch); assert.throws(() => uiVelocityTarget(value)); }
  for (const patch of [{ velocity: .25 }, { durationCells: 9 }, { pressure: .5 }]) { const value = target(); Object.assign(value.notes[0]!.fields, patch); assert.throws(() => uiVelocityTarget(value)); }
  assert.throws(() => uiVelocityTarget({ ...target(), row: 1 })); assert.throws(() => uiVelocityTarget({ ...target(), notes: [] }));
});
const closed = { complete: false, eligible: false };
function fences(): Wire {
  return { read: { ...closed, comparison: 'match', readMode: 'refuse', reason: 'authority-handle-busy' },
    comparePoll: { ...closed, comparison: 'match' }, exactPoll: { ...closed, terminal: true, phase: 'refused', reason: 'authority-window-changed' }, status: { ...closed } };
}
test('current refusal and historical match remain separate from an exact window refusal', () => {
  const value = summarizeUiNoteFences(fences()); assert.equal(value.cacheCurrentOutputAbsent, true);
  assert.equal(value.cacheReadComparisonLabel, 'match'); assert.equal(value.historicalComparisonLabel, 'match');
  assert.equal(value.exactTerminalRefusalObserved, true); assert.equal(value.exactWindowChangeRefusalObserved, true);
  assert.equal(value.exactCallbackCancellationProved, false); assert.equal(value.hostInputOrderingProved, false); assert.equal(value.missingEventContinuityProved, false);
  const active = fences(); active.exactPoll = { ...closed, terminal: false, phase: 'scanning' };
  assert.equal(summarizeUiNoteFences(active).exactTerminalRefusalObserved, false);
  const acquired = fences(); acquired.exactPoll = { ...closed, terminal: true, phase: 'acquired', authorityNotes: [] };
  assert.equal(summarizeUiNoteFences(acquired).exactTerminalRefusalObserved, false);
  for (const reason of ['authority-scan-timeout', 'authority-handle-busy', 'caller-cancel']) { const raw = fences(); (raw.exactPoll as Wire).reason = reason;
    assert.equal(summarizeUiNoteFences(raw).exactWindowChangeRefusalObserved, false); assert.equal(summarizeUiNoteFences(raw).exactCallbackCancellationProved, false); }
});
test('unproved gates stay closed and retained output is visible as a failed fence observation', () => {
  const raw = fences(); (raw.read as Wire).diagnosticSnapshot = {};
  assert.equal(summarizeUiNoteFences(raw).cacheCurrentOutputAbsent, false);
  for (const field of ['read', 'comparePoll', 'exactPoll', 'status']) { const value = fences(); (value[field] as Wire).eligible = true;
    assert.throws(() => summarizeUiNoteFences(value)); }
});
function comparison(): Wire {
  const edited = uiVelocityTarget(target()), coverage = { startCell: 0, width: 2048, allChannels: true, fields: [...ACQUIRED_FIELDS],
    unsupportedFields: ['portableRepeat', 'articulation'], timingBasis: '1/512-beat' }, metadata = { name: edited.name };
  return { ...closed, instrumentationRevision: MUTATION_MARKER, comparison: 'match', callbackSourceIdentityKnown: false, contentComparisonComplete: true,
    authorityAvailable: true, stepDataObservers: 3, residentHandles: 2, observerKind: 'addStepDataObserver', physicalPendingHints: 0, pendingCoordinates: 0,
    physicalHintOverflow: false, authorityNotes: structuredClone(edited.notes), authorityMetadata: metadata, authorityCoverage: coverage,
    diagnosticSnapshot: { clipRef: 'clip', address: { trackId: edited.id, row: 0 }, token: { initDomain: 'domain', project: 1, structure: 1, binding: 1, rebuild: 1 },
      contentGeneration: 2, invalidationSequence: 1, coverage, metadata, notes: edited.notes, fingerprint: 'snapshot' } };
}
test('full edited-note oracle rejects stale velocity and changes to unrelated disabled fields', () => {
  const edited = uiVelocityTarget(target()); checkStructureComparison(comparison(), edited);
  for (const patch of [{ velocity: 80 / 127 }, { chance: .5 }, { isChanceEnabled: true }, { repeatCount: 3 }]) {
    const value = comparison(); Object.assign((value.authorityNotes as ShadowNote[])[0]!.fields, patch);
    assert.throws(() => checkStructureComparison(value, edited));
  }
  const cached = comparison(); Object.assign(((cached.diagnosticSnapshot as Wire).notes as ShadowNote[])[0]!.fields, { velocity: 80 / 127 });
  assert.throws(() => checkStructureComparison(cached, edited));
});
test('nested all-channel raw seed must contain exactly the intended one note', () => {
  const raw = { count: 1, channels: Array.from({ length: 16 }, (_, channel) => ({ channel,
    notes: channel === 0 ? [{ x: 0, y: 60, velocity: 80 / 127, duration: 8 / 512 }] : [] })) };
  assert.equal(uiNoteSeedSettled(raw), true); assert.equal(uiNoteSeedSettled({ count: 1, notes: raw.channels[0]!.notes }), false);
  for (const patch of [{ x: 1 }, { y: 61 }, { velocity: .5 }, { duration: 9 / 512 }]) {
    const value = structuredClone(raw); Object.assign(value.channels[0]!.notes[0]!, patch); assert.equal(uiNoteSeedSettled(value), false);
  }
  const extra = structuredClone(raw); extra.channels[15]!.notes = [...extra.channels[0]!.notes]; assert.equal(uiNoteSeedSettled(extra), false);
  const wrong = structuredClone(raw); wrong.channels[0]!.channel = 15; assert.equal(uiNoteSeedSettled(wrong), false);
});
test('warm mismatch remains fatal and is not replaced by a successful later recovery', () => {
  const edited = uiVelocityTarget(target());
  assert.equal(uiWarmOracleFailure(comparison(), edited), undefined);
  assert.match(uiWarmOracleFailure({ ...closed, comparison: 'mismatch' }, edited)!, /mismatch/);
  assert.match(uiWarmOracleFailure({ ...closed, comparison: 'coverage-mismatch' }, edited)!, /mismatch/);
  const stale = comparison(); Object.assign((stale.authorityNotes as ShadowNote[])[0]!.fields, { velocity: 80 / 127 });
  assert.match(uiWarmOracleFailure(stale, edited)!, /oracle/);
  assert.equal(uiWarmOracleFailure(refusal('window-changed'), edited), undefined);
});
function refusal(cause: string): Wire {
  return { ...closed, comparison: cause, reason: cause, terminal: true, readMode: 'refuse', authorityAvailable: false, fallbackPerformed: false };
}
test('warm terminal refusals require closed gates and absent output', () => {
  const edited = uiVelocityTarget(target());
  for (const cause of UI_NOTE_WARM_REFUSALS) {
    assert.equal(uiWarmOracleFailure(refusal(cause), edited), undefined);
    for (const patch of [{ complete: true }, { eligible: true }, { terminal: false }, { readMode: 'exact-fallback' },
      { authorityAvailable: true }, { fallbackPerformed: true }, { reason: 'other' }, { contentComparisonComplete: true },
      ...['diagnosticSnapshot', 'authorityNotes', 'historicalSnapshot', 'authoritativeSnapshot', 'authorityMetadata', 'authorityCoverage'].map(field => ({ [field]: [] }))])
      assert(uiWarmOracleFailure({ ...refusal(cause), ...patch }, edited));
  }
  for (const outcome of [undefined, null, {}, [], 'match', { comparison: 'pending' }, { comparison: 'not-run' },
    { comparison: 'invented' }, { comparison: 1 }, { comparison: null }])
    assert(uiWarmOracleFailure(outcome as Wire, edited));
});
test('retained note report rejects every current warm mismatch despite a matching recovery', async () => {
  const retained = JSON.parse(gunzipSync(await readFile(new URL('../../../context/evidence/data/phase8g-followup-acceptance/native-note-controls.json.gz', import.meta.url))).toString('utf8')) as Wire;
  assert.equal(verifyUiNoteReport(retained).uiVelocityEdits, 1);
  for (const cause of ['mismatch', 'metadata-mismatch', 'membership-mismatch', 'field-mismatch', 'coverage-mismatch']) {
    const value = structuredClone(retained), finish = value.finish as Wire;
    assert.equal((finish.recoveryComparison as Wire).comparison, 'match');
    ((finish.reacquisition as Wire).comparison as Wire).comparison = cause;
    assert.throws(() => verifyUiNoteReport(value), /warm comparison reported/);
    const historical = structuredClone(retained), raw = ((historical.finish as Wire).preBarrier as Wire);
    (raw.read as Wire).comparison = cause; (raw.comparePoll as Wire).comparison = cause;
    (historical.finish as Wire).fences = summarizeUiNoteFences(raw);
    assert.equal(verifyUiNoteReport(historical).uiVelocityEdits, 1);
  }
  for (const cause of UI_NOTE_WARM_REFUSALS) {
    const value = structuredClone(retained); ((value.finish as Wire).reacquisition as Wire).comparison = refusal(cause);
    assert.equal(verifyUiNoteReport(value).reacquisitionObservations, 1);
  }
  for (const outcome of [undefined, null, [], 'match', {}, { ...closed, comparison: 'pending' }, { ...closed, comparison: 'invented' }]) {
    const value = structuredClone(retained); ((value.finish as Wire).reacquisition as Wire).comparison = outcome;
    assert.throws(() => verifyUiNoteReport(value));
  }
  const requestError = structuredClone(retained), warm = (requestError.finish as Wire).reacquisition as Wire;
  delete warm.comparison; warm.error = 'request refused';
  assert.equal(verifyUiNoteReport(requestError).reacquisitionObservations, 1);
});
test('guarded abort cleanup rejects a wrapper, another UUID, extra clips or baseline changes', () => {
  const uuid = (n: number): string => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  const list = (numbers: number[]): Wire => ({ count: numbers.length, itemCount: numbers.length, bankSize: 256,
    tracks: numbers.map((n, index) => ({ index, position: index, name: `track-${n}`, type: 'Instrument', channelId: uuid(n) })) });
  const baseline = list([1, 2]), current = list([1, 3, 2]), groups = { groupControlRevision: GROUP_CONTROL_REVISION, coherent: true,
    fullWindow: true, researchOnly: true, groupMembershipProved: false, hostInputOrderingProved: false, totalCount: 3,
    tracks: (current.tracks as Wire[]).map(track => ({ ...track, isGroup: false, isGroupExpanded: false })) };
  const slots = [1, 3, 2].flatMap(n => Array.from({ length: 8 }, (_, row) => ({ id: uuid(n), row, hasContent: n === 1 && row < 3 || n === 3 && row === 0 })));
  verifyUiNoteCleanup(baseline, current, groups, slots, uuid(1), uuid(3), 'track-3', true);
  const wrapped = structuredClone(groups); wrapped.tracks[1]!.isGroup = true;
  assert.throws(() => verifyUiNoteCleanup(baseline, current, wrapped, slots, uuid(1), uuid(3), 'track-3', true));
  assert.throws(() => verifyUiNoteCleanup(baseline, current, groups, slots, uuid(1), uuid(2), 'track-3', true));
  const extra = structuredClone(slots); extra[9]!.hasContent = true;
  assert.throws(() => verifyUiNoteCleanup(baseline, current, groups, extra, uuid(1), uuid(3), 'track-3', true));
  const changed = structuredClone(current); (changed.tracks as Wire[])[2]!.name = 'baseline changed';
  assert.throws(() => verifyUiNoteCleanup(baseline, changed, groups, slots, uuid(1), uuid(3), 'track-3', true));
});
test('verifier rejects incomplete cleanup, premature handoff and invented aggregate proof counts', () => {
  const value = { marker: MUTATION_MARKER, researchOnly: true, complete: false, eligible: false, stage: 'finished', fixtureRestored: true,
    temporaryFixturesRemoved: true, uiEditCount: 1, reacquisitionObservationCount: 1, missingEventContinuityProved: false,
    hostInputOrderingProved: false, simultaneousAuthorityScansSupported: false, ended: 'retained' };
  for (const patch of [{ stage: 'prepared' }, { fixtureRestored: false }, { temporaryFixturesRemoved: false }, { aggregateAcceptanceCount: 2 },
    { simultaneousAuthorityScansSupported: true }, { missingEventContinuityProved: true }, { hostInputOrderingProved: true }, { error: 'cleanup remains' }])
    assert.throws(() => verifyUiNoteReport({ ...value, ...patch }));
});
test('method preflight and package alias make the offline protocol discoverable', async () => {
  verifyUiNoteMethods({ runtimeProfile: 'phase-8-probe-v1', methods: [...UI_NOTE_METHODS] });
  for (const missing of UI_NOTE_METHODS) assert.throws(() => verifyUiNoteMethods({ runtimeProfile: 'phase-8-probe-v1', methods: UI_NOTE_METHODS.filter(method => method !== missing) }));
  const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts['probe:phase8g-ui-note-controls'], 'node --import tsx src/probes/phase8g-ui-note-controls.ts');
});
