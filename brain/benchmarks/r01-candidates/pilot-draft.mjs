// Pilot draft 2 manifest: records the operator's review answers and the
// development trial stage. It computes coverage and attempt counts from the runner's
// eligibility rules and lists reserved works from retained metadata only. It
// opens no MIDI file and selects no work.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARMS, DIAGNOSTICS, eligibility } from './development-surfaces.mjs';
import { PROFILES } from './cli-controls.mjs';
import { CLAUDE_CONTEXT_POLICY, CLAUDE_CONTEXT_POLICY_SHA256, CLAUDE_CONTEXT_POLICY_V2,
  CLAUDE_CONTEXT_POLICY_V2_SHA256 } from './claude-context-policy.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const sha = value => createHash('sha256').update(value).digest('hex');
const LATER = 'materialize-at-extraction';

// Two instances per protocol family. Real-source instances share one window
// per selected work (works A, B, C); synthetic instances use a new seed family.
export const INSTANCES = [
  { id: 'p01-read-count-window', family: 'read', cohort: 'performed', source: 'reserved:A', response: 'answer',
    operation: 'Report {"total": count, "before": count of notes with onset strictly before quarter 8 of the window}.' },
  { id: 'p02-read-group-timing', family: 'read', cohort: 'source', source: 'synthetic', groups: true, response: 'answer',
    operation: 'Report the named member\'s common delay, residual and derived onset as reduced rational strings.' },
  { id: 'p03-author-constrained', family: 'constrained-authoring', cohort: 'performed', source: 'synthetic', response: 'write',
    operation: 'From an empty input, write six fully specified notes (pitch, onset, duration, velocity stated in prose).' },
  { id: 'p04-author-known-spread', family: 'constrained-authoring', cohort: 'source', source: 'synthetic', groups: true, response: 'write',
    operation: 'Write a declared four-member group from its stated anchor, delay, residuals, IDs and order.' },
  { id: 'p05-edit-velocity-large', family: 'individual-edit', cohort: 'performed', source: 'reserved:B', response: 'write',
    operation: 'Set the velocity of the uniquely described target note to 91 (37 if already 91); preserve all else.' },
  { id: 'p06-edit-transpose', family: 'individual-edit', cohort: 'performed', source: 'reserved:C', response: 'write',
    operation: 'Transpose the uniquely described target note up two semitones; preserve all else.' },
  { id: 'p07-halve-group-spread', family: 'group-arithmetic', cohort: 'source', source: 'synthetic', groups: true, response: 'write',
    operation: 'Halve declared residuals (even grid-cell values); retain common delay, durations and protected state.' },
  { id: 'p08-shift-onset-range', family: 'group-arithmetic', cohort: 'performed', source: 'reserved:A', response: 'write',
    operation: 'Move every note with onset in a stated half-open quarter range later by 1/8 quarter; retain durations.' },
  { id: 'p09-delete-one-note', family: 'count-change', cohort: 'performed', source: 'reserved:B', response: 'write',
    operation: 'Delete the exact pitch/onset match; preserve every other note.' },
  { id: 'p10-refuse-ambiguous-pitch', family: 'count-change', cohort: 'performed', source: 'synthetic', response: 'refusal',
    refusal: 'ambiguous-selector',
    operation: 'Delete "the pitch-64 note in quarter 2" where two such notes exist at distinct onsets; require REFUSE ambiguous-selector.' },
  { id: 'p11-preserve-window', family: 'preservation', cohort: 'performed', source: 'reserved:C', response: 'write',
    operation: 'Rewrite the complete irregular window unchanged.' },
  { id: 'p12-preserve-exact-wider', family: 'preservation', cohort: 'source', source: 'synthetic', groups: false, response: 'write',
    operation: 'Rewrite non-grid timing, wider fields and an opaque annotation unchanged (no groups).' },
];

export const DRAFT = Object.freeze({
  schema: 'r01-pilot-draft-v2',
  status: 'REVIEW-ANSWERED-COHORTS-ADMITTED',
  stage: 'development',
  notApproval: 'Both cohorts are admitted for development runs; Haiku effort is calibrated to low (E365). The rigorous stage needs a separate freeze.',
  stages: {
    record: 'spec/r01-research/PILOT-DRAFT.md#trial-stages',
    development: 'Inputs may be reused and formats, cards, tasks and harness revised between versioned runs; results support design iteration only.',
    rigorous: 'Run once design and formats appear well tuned: freeze every version, then use fresh inputs never shown to a model, with the protocol\'s full freeze and stop rules.',
    reporting: 'Every plan, result, evidence record and summary states its stage.',
  },
  cohorts: [{ id: 'claude-current', proposed: true, profile: PROFILES['claude-current'],
      admission: 'admitted for development (E364): context policy v2 and six admitted development submissions; effort low chosen by D57 calibration (E365), median generated tokens 6.1x Luna low' },
    { id: 'codex-current', proposed: true, profile: PROFILES['codex-current'],
      admission: 'admitted (E363): isolated home, fixed four-tool context policy, no tool use (D55-D58)' },
    { id: 'claude-historical', proposed: false, profile: PROFILES['claude-historical'],
      admission: 'E361 development rehearsal only; not a pilot cohort' }],
  repeats: 3, maxRepairs: 2, timeoutMs: 120000,
  seeds: { workSelection: 'r01-pilot-selection-v1', synthetic: 'r01-pilot-synthetic-v1', order: 'r01-pilot-order-v1',
    status: 'development stage: works 1-3 in seeded order and this synthetic seed; the rigorous stage uses the next unused works in the same order and a new synthetic seed' },
  window: { quarters: 16, maxNotes: 128, start: 'first note onset of the selected asset',
    refusals: ['unpaired or unclosed note events', 'zero-duration notes', 'more than 128 notes', 'fewer than 16 notes',
      'normalization collision (same pitch and normalized onset)', 'invalid or conflicting timing metadata', 'content hash mismatch'],
    next: 'advance to the first onset at or after the refused window start + 16 quarters, at most 8 windows per asset; then the next asset in seeded order; then the next work in seeded order' },
  assets: { pool: 'transcript-muscriptor-large/ assets with General MIDI program below 128 (from the path prefix)',
    order: 'seeded shuffle of asset IDs within the work, using the planner\'s SHA-256 rejection-sampling shuffle',
    timing: 'record mapped or baked timing from registry metadata at extraction; report the two separately' },
  context: { 'claude-current': { policy: CLAUDE_CONTEXT_POLICY_V2.schema, policySha256: CLAUDE_CONTEXT_POLICY_V2_SHA256, cliVersion: CLAUDE_CONTEXT_POLICY_V2.cliVersion,
      change: 'a CLI or binary change requires a new context-policy check; retry fault evidence is optional reporting (D58)' },
    'codex-current': { policy: 'r01-codex-context-policy-v2', record: 'E363; D62 accepts an absent access_programs field' },
    reference: { policy: CLAUDE_CONTEXT_POLICY.schema, policySha256: CLAUDE_CONTEXT_POLICY_SHA256, cliVersion: CLAUDE_CONTEXT_POLICY.cliVersion } },
  feedback: 'reason code plus native validation message (at most 400 characters); never expected values, differences or golden responses',
  quotaResume: 'retain the interrupted submission as a quota outcome; on resume, resubmit that attempt as a new submission labeled resumed-after-quota; it consumes no correction',
  thinking: 'report observed thinking tokens; exceeding a requested budget is expected Haiku behavior, not a control failure',
  sourceExclusions: 'no annotation adapter or sidecar: source tasks exclude current-document and Producer Pal arms; every report lists the exclusions and limits source-task conclusions to C3 versus C4',
  reviewAnswers: { date: '2026-10-26', record: 'spec/r01-research/PILOT-DRAFT.md#review-answers' },
  materializedHashes: { payloads: LATER, oracles: LATER, prompts: LATER, order: LATER },
});

/** Coverage and attempt counts derived with the runner's eligibility rules. */
export function draftCells() {
  return INSTANCES.flatMap(instance => {
    const task = { cohort: instance.cohort, diagnostics: instance.cohort === 'source',
      input: { groups: instance.groups ? [{}] : [] } };
    return ARMS.filter(arm => !DIAGNOSTICS.has(arm) || task.diagnostics).map(arm => ({
      instance: instance.id, family: instance.family, cohort: instance.cohort, source: instance.source, arm,
      role: DIAGNOSTICS.has(arm) ? 'diagnostic' : 'primary', ...eligibility(task, arm) }));
  });
}

export function draftCounts(cells = draftCells(), repeats = DRAFT.repeats, maxRepairs = DRAFT.maxRepairs) {
  const eligible = cells.filter(c => c.eligible);
  const perRepeat = { scheduledCells: cells.length, eligible: eligible.length,
    primary: eligible.filter(c => c.role === 'primary').length,
    diagnostic: eligible.filter(c => c.role === 'diagnostic').length, exclusions: cells.length - eligible.length };
  const families = Object.fromEntries([...new Set(INSTANCES.map(i => i.family))].map(f => [f,
    { instances: INSTANCES.filter(i => i.family === f).length,
      primaryPerRepeat: eligible.filter(c => c.family === f && c.role === 'primary').length }]));
  const initial = perRepeat.eligible * repeats;
  const cohorts = DRAFT.cohorts.filter(c => c.proposed).length;
  // Counts are per cohort; results are compared within each pinned cohort.
  return { perRepeat, families, repeats, initialAttempts: initial, primaryAttempts: perRepeat.primary * repeats,
    diagnosticAttempts: perRepeat.diagnostic * repeats, exclusions: perRepeat.exclusions * repeats,
    maximumSubmissions: initial * (1 + maxRepairs), maximumCorrections: initial * maxRepairs,
    proposedCohorts: cohorts, allCohorts: { initialAttempts: initial * cohorts, maximumSubmissions: initial * (1 + maxRepairs) * cohorts } };
}

/** Reserved work families from retained metadata only. No selection is made. */
export function reservedWorks() {
  const manifest = JSON.parse(readFileSync(resolve(root, 'context/evidence/data/r01-candidates/corpus-manifest.json'), 'utf8'));
  return manifest.groups.filter(g => g.split === 'reserved').map(g => {
    const pool = g.assets.filter(a => a.path.split('/')[2] === 'transcript-muscriptor-large'
      && Number(a.path.split('/').at(-1).slice(0, 3)) < 128);
    return { shardId: g.shardId, title: g.title, midiAssets: g.assets.length, pitchedLargePoolAssets: pool.length,
      eligible: pool.length > 0, reason: pool.length ? null : 'no MIDI asset in the proposed pool' };
  }).sort((a, b) => a.shardId.localeCompare(b.shardId));
}

export function draftManifest() {
  const cells = draftCells();
  return { ...DRAFT, instances: INSTANCES, counts: draftCounts(cells), cells, reservedWorks: reservedWorks(),
    developmentRehearsal: 'context/evidence/data/r01-claude-paired-rehearsal/run/results.json' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = resolve(process.argv[2] ?? '');
  assert(process.argv[2] && !existsSync(output), 'usage: node --import tsx pilot-draft.mjs NEW_OUTPUT_FILE');
  const text = JSON.stringify(draftManifest(), null, 2) + '\n';
  writeFileSync(output, text);
  console.log(JSON.stringify({ sha256: sha(text), counts: draftManifest().counts }, null, 2));
}
