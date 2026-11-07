import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DRAFT, INSTANCES, draftCells, draftCounts, reservedWorks, draftManifest } from './pilot-draft.mjs';

test('draft covers each protocol family twice with real and synthetic sources', () => {
  assert.equal(INSTANCES.length, 12);
  const families = new Map();
  for (const i of INSTANCES) families.set(i.family, [...(families.get(i.family) ?? []), i]);
  assert.equal(families.size, 6);
  for (const [family, list] of families) assert.equal(list.length, 2, family);
  // Each selected work supplies two instances; known intent stays synthetic.
  for (const work of ['A', 'B', 'C']) assert.equal(INSTANCES.filter(i => i.source === `reserved:${work}`).length, 2);
  assert(INSTANCES.filter(i => i.cohort === 'source').every(i => i.source === 'synthetic'));
});

test('eligible counts, diagnostics and exclusions are computed, not assumed', () => {
  const counts = draftCounts();
  assert.deepEqual(counts.perRepeat, { scheduledCells: 84, eligible: 67, primary: 56, diagnostic: 11, exclusions: 17 });
  assert.deepEqual([counts.initialAttempts, counts.primaryAttempts, counts.diagnosticAttempts, counts.maximumSubmissions],
    [201, 168, 33, 603]);
  assert.deepEqual([counts.proposedCohorts, counts.allCohorts.initialAttempts, counts.allCohorts.maximumSubmissions], [2, 402, 1206]);
  const cells = draftCells();
  assert(cells.filter(c => c.cohort === 'performed').every(c => c.eligible && c.role === 'primary'));
  assert(cells.filter(c => !c.eligible).every(c => c.reason));
  assert.equal(cells.find(c => c.instance === 'p12-preserve-exact-wider' && c.arm === 'c4-detached-fields').eligible, false);
});

test('draft 2 is a development-stage draft: admitted cohorts, no materialized hashes, and no work selected', () => {
  assert.equal(DRAFT.status, 'REVIEW-ANSWERED-COHORTS-ADMITTED');
  assert.equal(DRAFT.stage, 'development');
  assert(Object.values(DRAFT.materializedHashes).every(v => v === 'materialize-at-extraction'));
  assert.deepEqual(DRAFT.cohorts.filter(c => c.proposed).map(c => c.id), ['claude-current', 'codex-current']);
  assert(DRAFT.cohorts.filter(c => c.proposed).every(c => c.admission.startsWith('admitted')));
  assert.equal(DRAFT.cohorts.find(c => c.id === 'claude-current').profile.model, 'claude-haiku-5-5');
  const works = reservedWorks();
  assert.equal(works.filter(w => w.eligible).length, 11);
  assert(works.every(w => !('selected' in w)));
  assert.equal(works.find(w => w.title === 'psychomania splices').eligible, false);
});

const retained = fileURLToPath(new URL('../../../context/evidence/data/r01-pilot-draft/draft-2-manifest.json', import.meta.url));
test('retained draft manifest matches the generator', { skip: !existsSync(retained) }, () => {
  assert.deepEqual(JSON.parse(readFileSync(retained, 'utf8')), JSON.parse(JSON.stringify(draftManifest())));
});
