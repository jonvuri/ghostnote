import assert from 'node:assert/strict';
import test from 'node:test';
import { checkBinding, checkCancellation, checkComparison, verifyShadowReuseReport } from './phase8g-shadow-reuse.js';

const empty = {
  comparison: 'match', complete: false, eligible: false, callbackSourceIdentityKnown: false,
  physicalPendingHints: 0, physicalHintOverflow: false, pendingWorkItemsIncludingPhysicalHints: 0,
  stepDataObservers: 3, residentHandles: 2, observerKind: 'addStepDataObserver',
  diagnosticSnapshot: {
    clipRef: 'owned-empty', address: { trackId: 'owned-track', row: 2 },
    token: { project: 1, structure: 1, binding: 1, rebuild: 1 },
    contentGeneration: 1, invalidationSequence: 0,
    coverage: { startCell: 0, width: 2048, allChannels: true, fields: [],
      unsupportedFields: [], timingBasis: '1/512-beat' },
    metadata: { exists: true, name: 'gn-8g-reuse-empty', length: 4 }, notes: [], fingerprint: 'empty',
  },
  authorityNotes: [], authorityMetadata: { exists: true, name: 'gn-8g-reuse-empty', length: 4 },
  authorityCoverage: { startCell: 0, width: 2048, allChannels: true, fields: [],
    unsupportedFields: [], timingBasis: '1/512-beat' },
};

test('bounded reuse cannot accept a fabricated eligibility or a changed physical pool', () => {
  assert.deepEqual(checkComparison(empty, 2), []);
  for (const changed of [{ complete: true }, { eligible: true }, { callbackSourceIdentityKnown: true },
    { physicalPendingHints: 1 }, { physicalHintOverflow: true }, { pendingWorkItemsIncludingPhysicalHints: 1 }, { stepDataObservers: 4 },
    { residentHandles: 3 }, { observerKind: 'addNoteStepObserver' }]) {
    assert(checkComparison({ ...empty, ...changed }, 2).length > 0);
  }
});

test('a host match label cannot hide absent-clip metadata or wrong fixture membership', () => {
  assert(checkComparison({ ...empty, authorityMetadata: { ...empty.authorityMetadata, exists: false } }, 2)
    .includes('typed-comparison'));
  assert(checkComparison(empty, 0).includes('fixture-membership-mismatch'));
  assert(checkComparison(empty, 2, 'other-track').includes('fixture-address-mismatch'));
  assert(checkComparison({ ...empty, authorityCoverage: { ...empty.authorityCoverage, width: 1024 } }, 2)
    .includes('fixture-coverage-mismatch'));
});

test('reset evidence needs a verified canary and an advanced binding revision', () => {
  const result = { before: { physicalBindingRevision: 4 }, binding: [{ recorderPreserved: false,
    canaryPhase: 'target', bindingReady: true, canaryVerifiedForBinding: true, physicalBindingRevision: 6 }] };
  checkBinding(result, true);
  for (const changed of [{ canaryVerifiedForBinding: false }, { recorderPreserved: true },
    { physicalBindingRevision: 4 }, { canaryPhase: 'canary' }]) {
    assert.throws(() => checkBinding({ ...result, binding: [{ ...result.binding[0], ...changed }] }, true));
  }
});

test('cancelled scans cannot remain pending or publish staged output', () => {
  const status = { comparison: 'window-changed', authorityAvailable: false, complete: false, eligible: false,
    readMode: 'refuse', fallbackReason: 'authority-scan-cancelled', windowChanges: 3 };
  const value = { active: { comparison: 'pending', scanProgressCoordinates: 100, scanTotalCoordinates: 262144, windowChanges: 2 },
    after: [status, status] };
  checkCancellation(value);
  for (const changed of [{ comparison: 'pending' }, { authorityNotes: [] }, { diagnosticSnapshot: {} },
    { windowChanges: 4 }, { authorityAvailable: true }]) {
    assert.throws(() => checkCancellation({ ...value, after: [status, { ...status, ...changed }] }));
  }
  assert.throws(() => checkCancellation({ ...value, active: { ...value.active, scanProgressCoordinates: 0 } }));
});

test('empty and truncated reports cannot pass bounded reuse verification', () => {
  const report = { researchOnly: true, complete: false, eligible: false,
    initial: { instrumentationRevision: '8g-shadow-physical-hints-v2', steps: 2048, residentHandles: 2 },
    ended: '2026-10-01T00:00:00Z', cases: [] };
  assert.throws(() => verifyShadowReuseReport(report), /sequence is incomplete/);
  assert.throws(() => verifyShadowReuseReport({ ...report,
    cases: [{ label: 'empty-only', row: 2, outcome: 'match', result: empty }] }), /sequence is incomplete/);
});
