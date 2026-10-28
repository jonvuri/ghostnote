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
  const cells = draftCells();
  assert(cells.filter(c => c.cohort === 'performed').every(c => c.eligible && c.role === 'primary'));
  assert(cells.filter(c => !c.eligible).every(c => c.reason));
  assert.equal(cells.find(c => c.instance === 'p12-preserve-exact-wider' && c.arm === 'c4-detached-fields').eligible, false);
});

test('draft stays unfrozen: no held-out hashes, one proposed cohort, and no work selected', () => {
  assert.equal(DRAFT.status, 'UNFROZEN-DRAFT-FOR-REVIEW');
  assert(Object.values(DRAFT.heldoutHashes).every(v => v === 'materialize-after-freeze'));
  assert.deepEqual(DRAFT.cohorts.filter(c => c.proposed).map(c => c.id), ['claude-historical']);
  const works = reservedWorks();
  assert.equal(works.filter(w => w.eligible).length, 11);
  assert(works.every(w => !('selected' in w)));
  assert.equal(works.find(w => w.title === 'psychomania splices').eligible, false);
});

const retained = fileURLToPath(new URL('../../../context/evidence/data/r01-pilot-draft/draft-manifest.json', import.meta.url));
test('retained draft manifest matches the generator', { skip: !existsSync(retained) }, () => {
  assert.deepEqual(JSON.parse(readFileSync(retained, 'utf8')), JSON.parse(JSON.stringify(draftManifest())));
});
