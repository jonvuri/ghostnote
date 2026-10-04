import assert from 'node:assert/strict';
import test from 'node:test';
import { ACQUIRED_FIELDS } from './phase8g-shadow-mutations.js';
import { CANARY_FIXTURE, FINAL_MARKER, LIVE_EXPECTED, PURE_EXPECTED, TARGET_FIXTURE, TARGET_NAME, TARGET_ROW, applyChange,
  caseIssues, declaredIssues, exactIssues, hostWork, liveAdmission, liveDecision, pureControls, rawNotesOf, refusalIssues,
  stableSourceIssues, type DeclaredNote, type Wire } from './phase8g5-consumers-lib.js';

const GRID = 1 / 512;
const DEFAULTS: Wire = { releaseVelocity: .5, velocitySpread: 0, gain: .5, pan: 0, pressure: 0, timbre: 0, transpose: 0, chance: 1,
  isChanceEnabled: true, isMuted: false, isOccurrenceEnabled: true, occurrence: 'ALWAYS', isRecurrenceEnabled: true, recurrenceLength: 1,
  recurrenceMask: 1, isRepeatEnabled: true, repeatCount: 0, repeatCurve: 0, repeatVelocityCurve: 0, repeatVelocityEnd: 0 };
/** Model the raw verbose read that the bridge returns for declared writes. */
function rawOf(declared: readonly DeclaredNote[]): Wire {
  const channels = Array.from({ length: 16 }, (_, channel) => {
    const notes = declared.filter(note => note.channel === channel).map(note => {
      const raw: Wire = { x: note.cell, y: note.pitch, ...DEFAULTS, velocity: note.velocity / 127, duration: note.durationCells * GRID };
      for (const [field, value] of Object.entries(note.props ?? {})) {
        if (field === 'gain') raw.gain = Number(value) * 2;
        else if (field === 'recurrence') { raw.recurrenceLength = (value as number[])[0]; raw.recurrenceMask = (value as number[])[1]; }
        else raw[field] = value;
      }
      return raw;
    });
    return { channel, count: notes.length, notes };
  });
  return { clipExists: true, count: declared.length, channels };
}
const metadata = { exists: true, name: TARGET_NAME, loopEnabled: true, playStart: 0, playStop: 4, loopStart: 0, loopLength: 4,
  colorRed: .78, colorGreen: .31, colorBlue: .16, colorAlpha: 1 };
const snapMetadata = { name: TARGET_NAME, isLoopEnabled: true, playStart: 0, playStop: 4, loopStart: 0, loopLength: 4,
  colorRed: .78, colorGreen: .31, colorBlue: .16, colorAlpha: 1 };
const address = { trackId: 'track-p', row: TARGET_ROW };
const coverage = { startCell: 0, width: 2048, allChannels: true, fields: [...ACQUIRED_FIELDS], unsupportedFields: [], timingBasis: '1/512-beat' };
function comparison(raw: Wire, content = 1): Wire {
  const notes = rawNotesOf(raw);
  return { comparison: 'match', complete: false, eligible: false, instrumentationRevision: FINAL_MARKER, stepWindowConfirmed: true,
    contentComparisonComplete: true, authorityAvailable: true, authorityNotes: notes, authorityMetadata: snapMetadata, authorityCoverage: coverage,
    diagnosticSnapshot: { clipRef: 'clip-1', address, token: { initDomain: 'init', project: 1, structure: 1, binding: 1, rebuild: 0 },
      contentGeneration: content, invalidationSequence: content, coverage, metadata: snapMetadata, notes, fingerprint: `f${content}` },
    resourceAccounting: { totalEstimatedBytes: 4096 } };
}

test('declared target and canary writes read back with defaults', () => {
  assert.deepEqual(declaredIssues(rawOf(TARGET_FIXTURE), TARGET_FIXTURE), []);
  assert.deepEqual(declaredIssues(rawOf(CANARY_FIXTURE), CANARY_FIXTURE), []);
  const lost = rawOf(TARGET_FIXTURE); ((lost.channels as Wire[])[3]!.notes as Wire[])[0]!.chance = 1;
  assert.deepEqual(declaredIssues(lost, TARGET_FIXTURE), ['declared-field:3:256:62:chance']);
  const missing = TARGET_FIXTURE.slice(1);
  assert(declaredIssues(rawOf(missing), TARGET_FIXTURE).includes('declared-membership:0:0:60'));
});

test('declared changes keep unchanged values and refuse collisions', () => {
  const base = rawNotesOf(rawOf(TARGET_FIXTURE));
  const moved = applyChange(base, { kind: 'transpose', channel: 0, cell: 0, pitch: 60, semitones: 2 });
  assert(moved.some(note => note.channel === 0 && note.cell === 0 && note.pitch === 62));
  assert(moved.some(note => note.channel === 15 && note.cell === 0 && note.pitch === 60), 'other channel unchanged');
  assert.throws(() => applyChange(base, { kind: 'transpose', channel: 0, cell: 512, pitch: 64, semitones: 0 }), /collides/);
  const edited = applyChange(base, { kind: 'props', channel: 3, cell: 768, pitch: 65, props: { velocity: .25, pan: .5 } });
  const note = edited.find(item => item.channel === 3 && item.cell === 768)!;
  assert.equal(note.fields.velocity, .25); assert.equal(note.fields.pan, .5); assert.equal(note.fields.gain, 1.25);
  assert.equal(applyChange(base, { kind: 'delete', channel: 0, cell: 1024, pitch: 67 }).length, base.length - 1);
  assert.throws(() => applyChange(base, { kind: 'delete', channel: 0, cell: 1, pitch: 67 }), /no source/);
});

test('a case passes only when raw, snapshot, and authority equal the declared oracle', () => {
  const raw = rawOf(TARGET_FIXTURE), expected = rawNotesOf(raw), value = comparison(raw);
  assert.deepEqual(caseIssues(value, raw, metadata, expected, address, TARGET_NAME), []);
  // Equal wrong cache and authority values still fail the independent oracle.
  const wrong = applyChange(expected, { kind: 'props', channel: 0, cell: 0, pitch: 60, props: { velocity: .5 } });
  const both = { ...value, authorityNotes: wrong, diagnosticSnapshot: { ...(value.diagnosticSnapshot as Wire), notes: wrong } };
  const issues = caseIssues(both, raw, metadata, expected, address, TARGET_NAME);
  assert(issues.includes('snapshot:fixture-field:0:0:60:velocity') && issues.includes('authority:fixture-field:0:0:60:velocity'));
  assert.deepEqual(caseIssues({ ...value, comparison: 'field-mismatch' }, raw, metadata, expected, address, TARGET_NAME), ['comparison:field-mismatch']);
  assert(caseIssues({ ...value, eligible: true }, raw, metadata, expected, address, TARGET_NAME).includes('gate-open'));
  assert(caseIssues({ ...value, stepWindowConfirmed: false }, raw, metadata, expected, address, TARGET_NAME).includes('window'));
  assert(caseIssues(value, raw, { ...metadata, name: 'other' }, expected, address, TARGET_NAME).includes('raw-metadata'));
  assert(caseIssues({ ...value, authorityMetadata: { ...snapMetadata, loopLength: 8 } }, raw, metadata, expected, address, TARGET_NAME).includes('authority-metadata'));
  const narrow = { ...coverage, allChannels: false };
  assert(caseIssues({ ...value, authorityCoverage: narrow }, raw, metadata, expected, address, TARGET_NAME).includes('coverage'));
  assert(caseIssues(value, raw, metadata, expected, { ...address, row: 0 }, TARGET_NAME).includes('address'));
});

test('refusals and exact fallback carry the declared shape', () => {
  assert.deepEqual(refusalIssues({ comparison: 'step-window-changed', complete: false, eligible: false }, ['step-window-changed']), []);
  assert(refusalIssues({ comparison: 'step-window-changed', complete: false, eligible: false, authorityNotes: [] }, ['step-window-changed']).includes('payload:authorityNotes'));
  assert(refusalIssues({ comparison: 'match', complete: false, eligible: false }, ['step-window-changed']).includes('reason:match'));
  const raw = rawOf(TARGET_FIXTURE), expected = rawNotesOf(raw);
  const exact: Wire = { terminal: true, phase: 'acquired', authorityAvailable: true, complete: false, eligible: false, readMode: 'exact-fallback',
    cacheResidenceAdmitted: false, cacheMembershipUsed: false, scannedCoordinates: 2048 * 128, address, authorityNotes: expected };
  assert.deepEqual(exactIssues(exact, expected, address), []);
  assert(exactIssues({ ...exact, cacheMembershipUsed: true }, expected, address).includes('route'));
  assert(exactIssues({ ...exact, scannedCoordinates: 2048 }, expected, address).includes('scope'));
  assert.deepEqual(exactIssues({ ...exact, terminal: true, phase: 'refused', reason: 'authority-busy' }, expected, address), ['exact:authority-busy']);
});

test('the stable public source agrees on identity, timing, velocity, and flags', () => {
  const expected = rawNotesOf(rawOf(TARGET_FIXTURE));
  const channels = Array.from({ length: 16 }, (_, channel) => ({ channel, notes: expected.filter(note => note.channel === channel).map(note => ({
    startBeats: note.cell * GRID, pitch: note.pitch, velocity: Math.round(Number(note.fields.velocity) * 127), durationBeats: note.fields.rawDuration,
    isMuted: note.fields.isMuted })) }));
  const source = { coverage: { complete: true, channelsPerClip: 16 }, clips: [{ channels }] };
  assert.deepEqual(stableSourceIssues(source, expected), []);
  const changed = structuredClone(source); (changed.clips[0]!.channels[9]!.notes[0] as Wire).isMuted = false;
  assert.deepEqual(stableSourceIssues(changed, expected), ['stable-isMuted:9:1536:36']);
  const short = structuredClone(source); short.clips[0]!.channels[0]!.notes.pop();
  assert(stableSourceIssues(short, expected).includes('stable-membership:0:1024:67'));
});

test('live labels force exact fallback; pure controls reach every decision', () => {
  const raw = rawOf(TARGET_FIXTURE), earlier = comparison(raw, 1), later = comparison(raw, 2);
  assert.deepEqual(liveDecision(later, 'read-only'), LIVE_EXPECTED);
  assert.deepEqual(liveDecision(later, 'sparse-patch'), LIVE_EXPECTED);
  assert.throws(() => liveDecision({ ...later, eligible: true }, 'read-only'));
  assert.deepEqual(pureControls(earlier, later), PURE_EXPECTED);
});

test('combined live admission stays closed when budgets pass', () => {
  const info = { totalExperimentalStepDataObservers: 3, physicalPendingHints: 0, cacheBankConstructionMs: 2, canaryPassed: true,
    identityContinuityProved: false, lifecycleSignalsSupported: false, hostInputFenceProved: false };
  const admission = liveAdmission(comparison(rawOf(TARGET_FIXTURE)), info, 10);
  assert.equal(admission.budgetAdmitted, true); assert.equal(admission.eligible, false); assert.equal(admission.reason, 'lifecycle-unverified');
  assert.throws(() => liveAdmission({ ...comparison(rawOf(TARGET_FIXTURE)), resourceAccounting: {} }, info, 10), /combined estimate/);
});

test('host work deltas define avoided reads and refuse counter regressions', () => {
  const before = { membershipGetStepCalls: 10, authorityGetStepCalls: 100, enrichmentGetStepCalls: 5, membershipHostWorkMs: 1, authorityHostWorkMs: 2, enrichmentHostWorkMs: 3 };
  const after = { membershipGetStepCalls: 30, authorityGetStepCalls: 300, enrichmentGetStepCalls: 15, membershipHostWorkMs: 2, authorityHostWorkMs: 4, enrichmentHostWorkMs: 4 };
  assert.equal(hostWork(before, after).avoidedHostReadsIfPromoted, 200 - 20 - 10);
  assert.throws(() => hostWork(after, before), /invalid counter/);
});
