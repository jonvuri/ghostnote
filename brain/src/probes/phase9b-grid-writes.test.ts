import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CASES, MARKER, runBreadth, selectedMapping, transformMapping, validateSnapshot, type Case } from './phase9b-grid-writes.js';
import type { Wire } from './phase9b-grid-survey-read.js';

const data = JSON.parse(readFileSync(join(import.meta.dirname,
  '../../../extension/src/harnessTest/resources/grid-breadth-fixtures.json'), 'utf8'));
const initial = (kind: Case): Wire => structuredClone(data[kind === 'factory' ? 'boolean' : kind]);
function changed(kind: Case, stage: number): Wire {
  const next = initial(kind);
  if (kind === 'boolean') next.fixture.modules[9].atoms[7].fields['210'] = stage === 1;
  if (kind === 'mapping' && stage > 0) {
    const old = selectedMapping(next.fixture)!, mapping = next.fixture.mappings[old];
    next.fixture = transformMapping(next.fixture, old, false);
    if (stage === 2) {
      mapping.reference.id = 'new-reference'; next.fixture.mappings['new-mapping'] = mapping;
      next.fixture.modules[13].atoms[1].fields['3616'].push('new-mapping');
      next.fixture.modules[24].atoms[0].fields['3615'].push('new-mapping');
    }
  }
  if (kind === 'factory' && stage === 1) {
    const module = structuredClone(next.fixture.modules[9]); module.uuid = 'new-factory-uuid';
    for (const a of module.atoms) if ('7125' in a.fields) a.fields['7125'] = [];
    next.detached = { module, mappings: {}, ownedObjects: 100 };
  }
  if (kind === 'factory' && stage === 2) next.disposed = true;
  return next;
}
function fake(kind: Case, fault = '') {
  let stage = 0, bound = false, locked = false, reads = 0;
  const calls: Wire[] = [], saved: Wire = {};
  const request = async (method: string, p: Wire = {}): Promise<Wire> => {
    calls.push({ method, ...p });
    if (method === 'selection.status') return { revision: 23 };
    if (p.operation === 'breadthStatus') return { marker: MARKER, bound, locked, commands: stage };
    if (p.operation === 'breadthBind') {
      assert.equal(p.selectionRevision, 23); bound = true;
      return { marker: MARKER, session: 'session', status: { locked } };
    }
    if (p.operation === 'breadthRelease') { bound = false; locked = false; return { success: true }; }
    if (p.operation === 'breadthInspect') return { snapshot: changed(kind, stage) };
    if (p.operation === 'breadthCommand') {
      assert.equal(method, CASES[kind].method); assert.equal(p.action, CASES[kind].actions[stage]);
      if (fault === 'domain') { locked = true; throw new Error('native-domain-refusal-before-entry'); }
      stage++;
      if (fault === 'timeout') { locked = true; throw new Error('native timeout'); }
      return { receipt: { commandReturned: true, readback: 'pending-independent-pair' }, status: { locked } };
    }
    assert.equal(p.operation, 'breadthRead'); reads++;
    if (fault === 'refuse' && stage === 0) { locked = true; throw new Error('domain-or-schema-refusal'); }
    const snapshot = changed(kind, stage);
    if (fault === 'echo' && stage === 1) snapshot.fixture = initial(kind).fixture;
    if (fault === 'pair' && reads === 2) snapshot.fixture.modules[0].x++;
    return { marker: MARKER, session: 'session', snapshot, status: { locked } };
  };
  return { request, calls, saved, save: (name: string, value: unknown) => { saved[name] = value; } };
}
for (const kind of Object.keys(CASES) as Case[]) test(`bounded ${kind} sequence and call budget`, async () => {
  const f = fake(kind);
  const result = await runBreadth(f.request, { deviceName: 'Poly Grid' }, { case: kind }, f.save);
  assert.equal(result.verdict, 'passed'); assert.equal(result.protocolCalls, 10);
  assert.equal(f.calls.length, 13); // Two status calls, one selection, and ten protocol calls.
  assert.equal(f.calls.filter(c => c.operation === 'breadthCommand').length, 2);
  assert.equal(f.calls.filter(c => c.operation === 'breadthRead').length, 6);
});
test('a receipt cannot replace independent readback or authorize a restore', async () => {
  const f = fake('boolean', 'echo');
  await assert.rejects(runBreadth(f.request, { deviceName: 'Poly Grid' }, { case: 'boolean' }, f.save));
  assert.equal(f.calls.filter(c => c.operation === 'breadthCommand').length, 1);
  assert.equal(f.calls.filter(c => c.operation === 'breadthRelease').length, 0);
});
test('uncertain command is inspected at most twice and never retried or released', async () => {
  const f = fake('boolean', 'timeout');
  await assert.rejects(runBreadth(f.request, { deviceName: 'Poly Grid' }, { case: 'boolean' }, f.save));
  assert.equal(f.calls.filter(c => c.operation === 'breadthCommand').length, 1);
  assert.equal(f.calls.filter(c => c.operation === 'breadthInspect').length, 2);
  assert.equal(f.calls.filter(c => c.operation === 'breadthRelease').length, 0);
});
test('a refusal before any command can cancel and release the scratch claim', async () => {
  const f = fake('boolean', 'refuse');
  const result = await runBreadth(f.request, { deviceName: 'Poly Grid' }, { case: 'boolean' }, f.save);
  assert.equal(result.verdict, 'refused-before-command');
  assert.equal(f.calls.filter(c => c.operation === 'breadthCommand').length, 0);
  assert.equal(f.calls.find(c => c.operation === 'breadthRelease')?.cancel, true);
});
test('unequal initial reads prevent a command', async () => {
  const f = fake('boolean', 'pair');
  const result = await runBreadth(f.request, { deviceName: 'Poly Grid' }, { case: 'boolean' }, f.save);
  assert.equal(result.verdict, 'refused-before-command');
  assert.equal(f.calls.filter(c => c.operation === 'breadthCommand').length, 0);
});
test('a proved domain refusal before native entry can release the fixture', async () => {
  const f = fake('mapping', 'domain');
  const result = await runBreadth(f.request, { deviceName: 'Poly Grid' }, { case: 'mapping' }, f.save);
  assert.equal(result.verdict, 'refused-before-command');
  assert.equal(f.calls.filter(c => c.operation === 'breadthCommand').length, 1);
  assert.equal(f.calls.find(c => c.operation === 'breadthRelease')?.cancel, true);
});
test('mapping permits only the selected new identities and selected list position', () => {
  const base = initial('mapping'), good = changed('mapping', 2);
  validateSnapshot(base, good, 'mapping', 2);
  for (const mutate of [
    (n: Wire) => { n.fixture.mappings['new-mapping'].reference.id = base.fixture.modules[13].atoms[1].id; },
    (n: Wire) => { n.fixture.modules[13].atoms[1].fields['3616'].reverse(); },
    (n: Wire) => { n.fixture.mappings['new-mapping']['11481'] = false; },
    (n: Wire) => { n.fixture.modules[13].atoms[1].input.ports[0]['249'] = 1; },
    (n: Wire) => { n.fixture.modules[0].uuid = 'unrelated-new-uuid'; },
  ]) {
    const bad = structuredClone(good); mutate(bad);
    assert.throws(() => validateSnapshot(base, bad, 'mapping', 2));
  }
});
test('factory requires fresh UUID, empty external connections, and disposal evidence', () => {
  const base = initial('factory'), detached = changed('factory', 1);
  validateSnapshot(base, detached, 'factory', 1);
  detached.detached.module.uuid = base.fixture.modules[9].uuid;
  assert.throws(() => validateSnapshot(base, detached, 'factory', 1));
  assert.throws(() => validateSnapshot(base, changed('factory', 0), 'factory', 2));
});
