/** Check raw topology routes against a fixture tree declared outside the host reads. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closed, type Wire } from './phase8g4-native-lib.js';

export interface GroupOracle {
  project: string;
  masterId: string;
  roots: string[];
  children: Record<string, string[]>;
  flatOrder: string[];
  expanded: Record<string, boolean>;
}
interface Row {
  index: number; channelId: string; name: string; position: number; isGroup: boolean; expanded: boolean;
}
interface RawBank { count: number; offset: number; ids: string[]; rows: Row[] }
interface RawCandidates {
  flat: RawBank; roots: RawBank; children: Record<string, RawBank>;
  parents: Record<string, { exists: boolean; row?: Row }>;
}
export interface GroupArtifactRecord { bytes: number; sha256: string }
/** Integrity alone cannot admit a false graph. Check the fixture oracle after the hash. */
export function verifyCandidateArtifact(bytes: Uint8Array, record: GroupArtifactRecord, oracle: GroupOracle): Wire {
  assert(Number.isSafeInteger(record.bytes) && record.bytes > 0 && record.bytes <= 64 * 1024 * 1024);
  assert.equal(bytes.byteLength, record.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256);
  return verifyCandidateCapture(JSON.parse(Buffer.from(bytes).toString()) as Wire, oracle);
}
function bank(value: RawBank): void {
  assert(value); assert.equal(value.offset, 0); assert(Number.isInteger(value.count));
  assert(value.count >= 0 && value.count <= 16); assert.equal(value.count, value.ids.length);
  assert.equal(value.count, value.rows.length); assert.equal(new Set(value.ids).size, value.ids.length);
  value.rows.forEach((row, index) => {
    assert.equal(row.index, index); assert.equal(row.channelId, value.ids[index]);
    assert.match(row.channelId, /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i);
    assert.equal(typeof row.name, 'string'); assert(Number.isInteger(row.position));
    assert.equal(typeof row.isGroup, 'boolean'); assert.equal(typeof row.expanded, 'boolean');
  });
}
/** The self rule remains a candidate until every live fixture shape passes. */
export function verifyCandidateCapture(report: Wire, oracle: GroupOracle): Wire {
  return verifyCapture(report, oracle, true);
}
/** Parent handles are diagnostics. They can retain an old parent after a move. */
function verifyCapture(report: Wire, oracle: GroupOracle, compareParents: boolean): Wire {
  closed(report); assert.equal(report.schema, 'phase8g5a-candidates-v1'); assert.equal(report.project, oracle.project);
  const topology = report.topology as Wire; closed(topology); assert.equal(topology.wrapperDeletionAllowed, false);
  const measured = topology.candidates as Wire; closed(measured);
  assert.equal(measured.revision, '8g5a-topology-candidates-v1'); assert.equal(measured.routeProved, false);
  assert.equal(measured.coherent, true); assert.equal(measured.readError, undefined);
  assert.equal(measured.sequenceBeforeRead, measured.sequenceAfterRead);
  assert.deepEqual(measured.first, measured.second);
  const raw = measured.first as unknown as RawCandidates; bank(raw.flat); bank(raw.roots);
  assert.deepEqual(raw.flat.ids, oracle.flatOrder); assert.deepEqual(raw.roots.ids, oracle.roots);
  const rows = new Map(raw.flat.rows.map(row => [row.channelId, row]));
  const groups = raw.flat.rows.filter(row => row.isGroup).map(row => row.channelId).sort();
  assert.deepEqual(Object.keys(raw.children).sort(), groups);
  assert.deepEqual(Object.keys(oracle.children).sort(), groups);
  assert.deepEqual(Object.keys(oracle.expanded).sort(), groups);
  const tracks = (report.tracks as Wire).tracks as Wire[];
  assert.deepEqual(tracks.map(track => track.channelId), raw.flat.ids);
  assert.equal(tracks.filter(track => track.type === 'Master').length, 1);
  assert.equal(tracks.find(track => track.type === 'Master')!.channelId, oracle.masterId);
  const parent = new Map<string, string | null>();
  for (const id of raw.roots.ids) { assert(rows.has(id)); assert(!parent.has(id)); parent.set(id, null); }
  const selfEntries: Wire[] = [];
  for (const [group, children] of Object.entries(raw.children)) {
    bank(children);
    const own = children.rows.filter(row => row.channelId === group); assert.equal(own.length, 1, 'self entry omitted or duplicated');
    assert.equal(own[0]!.isGroup, false); assert.equal(own[0]!.expanded, false);
    assert.equal(rows.get(group)!.expanded, oracle.expanded[group]);
    selfEntries.push({ group, index: own[0]!.index, position: own[0]!.position, name: own[0]!.name, isGroup: own[0]!.isGroup });
    const ids = children.ids.filter(id => id !== group); assert.deepEqual(ids, oracle.children[group], 'wrong child membership or order');
    for (const id of ids) { assert(rows.has(id), 'unknown child'); assert(!parent.has(id), 'duplicate parent'); parent.set(id, group); }
  }
  assert.equal(parent.size, rows.size, 'omitted descendant');
  for (const id of rows.keys()) {
    const seen = new Set<string>(); let current: string | null = id;
    while (current !== null) { assert(!seen.has(current), 'cycle'); seen.add(current); current = parent.get(current)!; }
  }
  const preorder: string[] = [];
  const visit = (id: string): void => { preorder.push(id); for (const child of oracle.children[id] ?? []) visit(child); };
  oracle.roots.forEach(visit); assert.deepEqual(raw.flat.ids, preorder, 'flat order differs from the fixture tree');
  assert.deepEqual(Object.keys(raw.parents).sort(), [...rows.keys()].sort());
  for (const [id, expected] of parent) {
    const actual = raw.parents[id]!; assert.equal(typeof actual.exists, 'boolean');
    if (actual.exists) {
      assert(actual.row); bank({ count: 1, offset: 0, ids: [actual.row.channelId], rows: [{ ...actual.row, index: 0 }] });
    } else assert.equal(actual.row, undefined);
    if (!compareParents) continue;
    assert.equal(actual.exists, true); assert(actual.row);
    if (rows.get(id)!.isGroup) {
      // Group handles report their own group master, including nested groups.
      assert.equal(actual.row.channelId, id, 'wrong group master parent');
      assert.equal(actual.row.isGroup, false); assert.equal(actual.row.expanded, false);
      const own = raw.children[id]!.rows.find(row => row.channelId === id)!;
      assert.equal(actual.row.name, own.name); assert.equal(actual.row.position, own.position);
    } else if (expected === null) {
      // E221's plain read observes a project proxy with the Master UUID.
      assert.equal(actual.row.channelId, oracle.masterId); assert.equal(actual.row.position, -1); assert.equal(actual.row.isGroup, true);
    } else { assert.equal(actual.row.channelId, expected, 'wrong independent parent'); assert.equal(actual.row.isGroup, true); }
  }
  return { childTreeMatchesFixture: true, parentTreeComplete: false, selfEntries, rootParentAbsentRulePassed: false,
    parentProjectProxyObserved: true, routeProved: false, complete: false, eligible: false };
}
/** Admission must use the measured UUID rule and the external fixture tree. */
export function verifyGroupTopology(topology: Wire, tracks: Wire, oracle: GroupOracle): void {
  verifyCapture({ schema: 'phase8g5a-candidates-v1', project: oracle.project,
    complete: false, eligible: false, topology, tracks }, oracle, false);
  assert.equal(topology.topologyControlRevision, '8g5a-uuid-group-master-v1');
  assert.equal(topology.oracle, 'direct-child-banks-with-uuid-group-master');
  assert.equal(topology.researchOnly, true); assert.equal(topology.membershipComplete, true);
  assert.equal(topology.coherent, true); assert.equal(topology.groupMembershipProved, true);
  assert.equal(topology.hostInputOrderingProved, false); assert.equal(topology.readError, undefined);
  assert.equal(topology.callbacksChangedDuringRead, false);
  assert.equal(topology.sequenceBeforeRead, topology.sequenceAfterRead); assert.equal(topology.maximumTracks, 16);
  const tree = topology.tree as Wire, raw = ((topology.candidates as Wire).first as Wire);
  assert.deepEqual(tree.flat, (raw.flat as Wire).rows);
  assert.deepEqual((tree.roots as Wire).ids, oracle.roots);
  assert.equal((tree.roots as Wire).count, oracle.roots.length); assert.equal((tree.roots as Wire).offset, 0);
  assert.deepEqual(Object.keys(tree.children as Wire).sort(), Object.keys(oracle.children).sort());
  for (const [group, ids] of Object.entries(oracle.children)) {
    const bank = (tree.children as Wire)[group] as Wire;
    assert.deepEqual(bank.ids, ids); assert.equal(bank.count, ids.length); assert.equal(bank.offset, 0);
  }
}
