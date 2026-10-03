/** Reject missing self entries, false parents, cycles, and stale fixture trees. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { verifyCandidateArtifact, verifyCandidateCapture, verifyGroupTopology, type GroupOracle } from './phase8g5a-group-lib.js';
import type { Wire } from './phase8g4-native-lib.js';

const id = (n: number): string => `00000000-0000-0000-0000-${n.toString().padStart(12, '0')}`;
const [r, g, h, a, b, e, m] = [1, 2, 3, 4, 5, 6, 7].map(id) as [string, string, string, string, string, string, string];
function fixture(): { report: Wire; oracle: GroupOracle } {
  const oracle: GroupOracle = { project: 'Owned fixture', masterId: m, roots: [r, g, e, m],
    children: { [g]: [h, b], [h]: [a], [e]: [] }, flatOrder: [r, g, h, a, b, e, m],
    expanded: { [g]: true, [h]: false, [e]: true } };
  const row = (channelId: string, index: number): Wire => ({ index, channelId, name: channelId, position: index,
    isGroup: Object.hasOwn(oracle.children, channelId), expanded: oracle.expanded[channelId] ?? false });
  const bank = (ids: string[]): Wire => ({ count: ids.length, offset: 0, ids, rows: ids.map(row) });
  const masterRow = (group: string, index: number): Wire => ({ ...row(group, index), name: group + ' Master', isGroup: false, expanded: false });
  const parents: Wire = {};
  for (const child of oracle.flatOrder) {
    const parent = Object.entries(oracle.children).find(([, children]) => children.includes(child))?.[0];
    parents[child] = { exists: true, row: Object.hasOwn(oracle.children, child) ? masterRow(child, oracle.children[child]!.length) : parent ? row(parent, 0)
      : { ...row(m, 0), position: -1, isGroup: true, name: 'Project' } };
  }
  const raw = { flat: bank(oracle.flatOrder), roots: bank(oracle.roots), parents,
    children: Object.fromEntries(Object.entries(oracle.children).map(([group, children]) => [group, { ...bank([...children, group]), rows: [...children.map(row), masterRow(group, children.length)] }])) };
  const report: Wire = { schema: 'phase8g5a-candidates-v1', project: oracle.project, complete: false, eligible: false,
    tracks: { tracks: oracle.flatOrder.map(channelId => ({ channelId, type: channelId === m ? 'Master' : 'Instrument' })) },
    topology: { complete: false, eligible: false, wrapperDeletionAllowed: false, candidates: {
      revision: '8g5a-topology-candidates-v1', routeProved: false, complete: false, eligible: false,
      coherent: true, sequenceBeforeRead: 1, sequenceAfterRead: 1, first: raw, second: structuredClone(raw) } } };
  return { report, oracle };
}
function raw(report: Wire): Wire { return ((report.topology as Wire).candidates as Wire).first as Wire; }
function repeat(report: Wire): void { ((report.topology as Wire).candidates as Wire).second = structuredClone(raw(report)); }
test('nested, collapsed, one-child, and empty model groups use UUID self entries and group-master parent aliases', () => {
  const value = fixture(); const result = verifyCandidateCapture(value.report, value.oracle);
  assert.equal(result.childTreeMatchesFixture, true); assert.equal(result.routeProved, false);
  assert.equal((result.selfEntries as Wire[]).length, 3);
});
test('a dropped self entry fails after both raw reads have the same mutation', () => {
  const value = fixture(), children = (raw(value.report).children as Wire)[g] as Wire;
  children.ids = [h, b]; children.rows = (children.rows as Wire[]).slice(0, 2); children.count = 2;
  repeat(value.report); assert.throws(() => verifyCandidateCapture(value.report, value.oracle), /self entry/);
});
test('a wrong parent fails despite unchanged child banks', () => {
  const value = fixture(); (((raw(value.report).parents as Wire)[a] as Wire).row as Wire).channelId = g;
  repeat(value.report); assert.throws(() => verifyCandidateCapture(value.report, value.oracle), /wrong independent parent/);
});
test('a cycle fails even when a false fixture declaration agrees with the raw bank edges', () => {
  const value = fixture(); value.oracle.roots = [r, e, m]; value.oracle.children[h] = [a, g];
  const measured = raw(value.report), roots = measured.roots as Wire;
  roots.ids = value.oracle.roots; roots.rows = (roots.rows as Wire[]).filter(row => row.channelId !== g).map((row, index) => ({ ...row, index })); roots.count = 3;
  const bank = (measured.children as Wire)[h] as Wire;
  bank.ids = [a, g, h];
  const flatRows = (measured.flat as Wire).rows as Wire[];
  bank.rows = [a, g, h].map((channelId, index) => ({ ...(channelId === h ? { ...flatRows.find(row => row.channelId === channelId)!, name: h + ' Master', isGroup: false, expanded: false } : flatRows.find(row => row.channelId === channelId)!), index })); bank.count = 3;
  repeat(value.report); assert.throws(() => verifyCandidateCapture(value.report, value.oracle), /cycle/);
});
test('stale trees, changed reads, callback changes, and false eligibility fail', () => {
  for (const mutate of [
    (value: ReturnType<typeof fixture>) => { value.oracle.children[g] = [b, h]; },
    (value: ReturnType<typeof fixture>) => { ((value.report.topology as Wire).candidates as Wire).second = {}; },
    (value: ReturnType<typeof fixture>) => { ((value.report.topology as Wire).candidates as Wire).sequenceAfterRead = 2; },
    (value: ReturnType<typeof fixture>) => { value.report.eligible = true; },
  ]) { const value = fixture(); mutate(value); assert.throws(() => verifyCandidateCapture(value.report, value.oracle)); }
});
test('rehashed report mutants still fail the independent graph checks', () => {
  for (const mutate of [
    (report: Wire) => {
      const children = (raw(report).children as Wire)[g] as Wire;
      children.ids = [h, b]; children.rows = (children.rows as Wire[]).slice(0, 2); children.count = 2;
    },
    (report: Wire) => { (((raw(report).parents as Wire)[a] as Wire).row as Wire).channelId = g; },
    (report: Wire) => {
      const children = (raw(report).children as Wire)[h] as Wire;
      const flat = (raw(report).flat as Wire).rows as Wire[];
      children.ids = [g, h]; children.rows = [g, h].map((channelId, index) => ({ ...flat.find(row => row.channelId === channelId)!, index }));
    },
    (report: Wire) => {
      const children = (raw(report).children as Wire)[g] as Wire;
      const rows = children.rows as Wire[];
      children.ids = [b, h, g]; children.rows = [b, h, g].map((channelId, index) => ({ ...rows.find(row => row.channelId === channelId)!, index }));
    },
  ]) {
    const value = fixture(); mutate(value.report); repeat(value.report);
    const bytes = Buffer.from(JSON.stringify(value.report));
    const record = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    assert.throws(() => verifyCandidateArtifact(bytes, record, value.oracle));
  }
  const value = fixture(), bytes = Buffer.from(JSON.stringify(value.report));
  const record = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  assert.equal(verifyCandidateArtifact(bytes, record, value.oracle).childTreeMatchesFixture, true);
  bytes[0] = 0; assert.throws(() => verifyCandidateArtifact(bytes, record, value.oracle));
});
test('admitted topology must retain the normalized UUID forest and closed gates', () => {
  const value = fixture(), measured = raw(value.report), topology = value.report.topology as Wire;
  Object.assign(topology, { topologyControlRevision: '8g5a-uuid-group-master-v1',
    oracle: 'direct-child-banks-with-uuid-group-master', researchOnly: true, membershipComplete: true,
    coherent: true, groupMembershipProved: true, hostInputOrderingProved: false,
    callbacksChangedDuringRead: false, sequenceBeforeRead: 1, sequenceAfterRead: 1, maximumTracks: 16,
    tree: { flat: (measured.flat as Wire).rows, roots: { count: value.oracle.roots.length, offset: 0, ids: value.oracle.roots },
      children: Object.fromEntries(Object.entries(value.oracle.children).map(([group, ids]) => [group, { count: ids.length, offset: 0, ids }])) } });
  verifyGroupTopology(topology, value.report.tracks as Wire, value.oracle);
  // A stale diagnostic parent must fail candidate comparison but cannot change child-bank admission.
  const stale = structuredClone(value.report);
  (((raw(stale).parents as Wire)[a] as Wire).row as Wire).channelId = m;
  repeat(stale);
  assert.throws(() => verifyCandidateCapture(stale, value.oracle), /wrong independent parent/);
  verifyGroupTopology(stale.topology as Wire, stale.tracks as Wire, value.oracle);
  const badChild = ((raw(stale).children as Wire)[g] as Wire);
  badChild.ids = [b, h, g]; badChild.rows = (badChild.rows as Wire[]).reverse().map((row, index) => ({ ...row, index }));
  repeat(stale); assert.throws(() => verifyGroupTopology(stale.topology as Wire, stale.tracks as Wire, value.oracle));
  for (const mutate of [
    (copy: Wire) => { copy.topologyControlRevision = 'old'; },
    (copy: Wire) => { copy.membershipComplete = false; },
    (copy: Wire) => { copy.eligible = true; },
    (copy: Wire) => { ((((copy.tree as Wire).children as Wire)[g] as Wire).ids as string[]).reverse(); },
    (copy: Wire) => { ((copy.tree as Wire).flat as Wire[]).reverse(); },
  ]) { const copy = structuredClone(topology); mutate(copy); assert.throws(() => verifyGroupTopology(copy, value.report.tracks as Wire, value.oracle)); }
});
