import assert from 'node:assert/strict';
import test from 'node:test';
import { E222_MARKER, aggregateSlotRuns, compactSlotTrace, occupancyFor, summarizeSlotRun } from './e222-slot-delivery-lib.js';
import type { SlotSides } from './e222-slot-delivery-lib.js';
import { compareOccupancy, declaredOccupancy, scanOccupancy } from './phase8g5b-slot-lib.js';

type Wire = Record<string, unknown>;
const EMPTY = '........,........,........,--------';
const P = occupancyFor([0, 1, 2], EMPTY), Q = occupancyFor([0, 4, 5], EMPTY);
const sides: SlotSides = { P: { name: 'New 6', trackId: 'p0', occupancy: P }, Q: { name: 'New 7', trackId: 'q0', occupancy: Q } };
const sig = (name: string): string => `${name}|root|cursor|C|....|....|-|.`;
let seq = 0;
const command = (): Wire => ({ seq: ++seq, us: seq, kind: 'command', op: 'invoked' });
const slot = (s: number, has: boolean): Wire => ({ seq: ++seq, us: seq, kind: 'slot', t: 0, s, has });
const name = (value: string): Wire => ({ seq: ++seq, us: seq, kind: 'value', name: 'projectName', value });
const tick = (project: string, slots: string, slotCallbacks: number): Wire =>
  ({ seq: ++seq, us: seq, kind: 'tick', start: sig(project), slots, slotCallbacks, steps: 0 });
const confirm = (t: Wire, slotCallbacks: number): Wire =>
  ({ seq: ++seq, us: seq, kind: 'confirm', depth: 1, tickSeq: t.seq, tickSlotCallbacks: t.slotCallbacks, slotCallbacks });
function trace(records: Wire[], finalName = 'New 6', finalSlots = P): Wire {
  return { slotMarker: E222_MARKER, eventsDropped: 0, ticksDropped: 0, runError: '', signature: sig(finalName), slotSignature: finalSlots,
    commands: records.filter(r => r.kind === 'command'), events: records.filter(r => r.kind === 'slot' || r.kind === 'value'),
    ticks: records.filter(r => r.kind === 'tick' || r.kind === 'confirm') };
}

test('occupancy patterns mark the first window track only', () => {
  assert.equal(P, 'XXX.....,........,........,--------');
  assert.equal(Q, 'X...XX..,........,........,--------');
});

test('a mid-batch foreign tick with a changed confirmation passes', () => {
  seq = 0; const records: Wire[] = [tick('New 6', P, 0), command(), slot(1, false), slot(2, false), slot(4, true), slot(5, true)];
  const foreign = tick('New 6', Q, 4); records.push(foreign);
  records.push(slot(4, false), slot(5, false), slot(1, true), slot(2, true), confirm(foreign, 8), tick('New 6', P, 8));
  const summary = summarizeSlotRun(trace(records), sides, [{ t: 0, s: 0 }]);
  assert.equal(summary.outcome, 'unseen-endpoint-P'); assert.equal(summary.foreignTicks, 1);
  assert.equal(summary.admittedForeignTicks, 0); assert.equal(summary.missedDeliveries, 0);
  assert.deepEqual(summary.watchedSlotEvents, [0]);
});

test('a foreign tick with an unchanged confirmation is a violation', () => {
  seq = 0; const records: Wire[] = [tick('New 6', P, 0), command(), slot(1, false)];
  const foreign = tick('New 6', Q, 1); records.push(foreign, confirm(foreign, 1), slot(1, true), tick('New 6', P, 2));
  const summary = summarizeSlotRun(trace(records), sides);
  assert.equal(summary.admittedForeignTicks, 1);
  assert.equal(aggregateSlotRuns([summary]).admittedForeignTicks, 1);
});

test('an occupancy change between ticks without a slot callback is a missed delivery', () => {
  seq = 0; const records: Wire[] = [tick('New 6', P, 0), command(), tick('New 7', Q, 0), name('New 7'), name('New 6'), tick('New 6', P, 0)];
  const summary = summarizeSlotRun(trace(records), sides);
  assert.equal(summary.missedDeliveries, 2); assert.equal(summary.outcome, 'seen');
});

test('a declared intermediate edit state is not foreign', () => {
  seq = 0; const edited = occupancyFor([0, 1, 2, 6], EMPTY); const records: Wire[] = [tick('New 6', P, 0), command(), slot(6, true)];
  const t = tick('New 6', edited, 1); records.push(t, confirm(t, 1), slot(6, false), tick('New 6', P, 2));
  assert.equal(summarizeSlotRun(trace(records), sides).admittedForeignTicks, 1);
  const allowed = summarizeSlotRun(trace(records), sides, [], [edited]);
  assert.equal(allowed.foreignTicks, 0); assert.equal(allowed.admittedForeignTicks, 0);
});

test('a coherent Q tick in a seen detour is not foreign', () => {
  seq = 0; const records: Wire[] = [tick('New 6', P, 0), command(), slot(1, false), name('New 7')];
  const q = tick('New 7', Q, 6); records.push(q, confirm(q, 6), name('New 6'), tick('New 6', P, 12));
  const summary = summarizeSlotRun(trace(records), sides);
  assert.equal(summary.foreignTicks, 0); assert.equal(summary.outcome, 'seen');
});

test('compaction keeps only slot and project-name events', () => {
  seq = 0; const records: Wire[] = [command(), slot(0, true), name('New 7'), { seq: ++seq, kind: 'stepData' }];
  const compact = compactSlotTrace({ ...trace(records), events: records.filter(r => r.kind !== 'command') });
  assert.deepEqual((compact.events as Wire[]).map(e => e.kind), ['slot', 'value']);
});

test('scan occupancy separates group slots from clip slots', () => {
  const scan = { groupIds: ['g'], slots: [{ trackId: 'a', row: 1, hasContent: true }, { trackId: 'g', row: 1, hasContent: true },
    { trackId: 'a', row: 2, hasContent: false }] };
  assert.deepEqual(scanOccupancy(scan), { clips: ['a:1'], groupSlots: ['g:1'] });
});

test('declared native operations transform the prior scan', () => {
  const prior = ['a:0', 'a:1', 'b:3'];
  assert.deepEqual(declaredOccupancy(prior, [{ op: 'insertScene', row: 1 }]), ['a:0', 'a:2', 'b:4']);
  assert.deepEqual(declaredOccupancy(prior, [{ op: 'deleteScene', row: 1 }]), ['a:0', 'b:2']);
  assert.deepEqual(declaredOccupancy(prior, [{ op: 'move', from_trackId: 'a', from_row: 1, to_trackId: 'b', to_row: 5 }]), ['a:0', 'b:3', 'b:5']);
  assert.deepEqual(declaredOccupancy(prior, [{ op: 'create', trackId: 'a', row: 4 }, { op: 'delete', trackId: 'b', row: 3 }]), ['a:0', 'a:1', 'a:4']);
  assert.throws(() => declaredOccupancy(prior, [{ op: 'create', trackId: 'a', row: 0 }]));
});

test('comparison reports foreign and missing slots and the declaration', () => {
  assert.equal(compareOccupancy(['a:0'], ['a:0'], ['a:0']).matches, true);
  const foreign = compareOccupancy(['a:0', 'q:4'], ['a:0']);
  assert.deepEqual(foreign.foreignSlots, ['q:4']); assert.equal(foreign.matches, false);
  assert.equal(compareOccupancy(['a:0'], ['a:0'], ['a:1']).matches, false);
});
