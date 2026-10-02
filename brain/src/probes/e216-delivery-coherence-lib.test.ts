import assert from 'node:assert/strict';
import test from 'node:test';
import { E216_MARKER, aggregateDetours, classifyTick, parseSignature, summarizeDetour, summarizeSpin, summarizeToggle } from './e216-delivery-coherence-lib.js';

type Wire = Record<string, unknown>;
const ids = { P: { name: 'New 2', root: 'rootP', cursor: 'trackP' }, Q: { name: 'New 3', root: 'rootQ', cursor: 'trackQ' } };
const P = 'New 2|rootP|trackP|C|NNNN|....|-|.', Q = 'New 3|rootQ|trackQ|C|....|NNNN|-|.';
let seq = 0;
const ev = (us: number, extra: Wire): Wire => ({ seq: ++seq, us, tick: 0, ...extra });
function trace(events: Wire[], ticks: Wire[], commands: Wire[]): Wire {
  return { marker: E216_MARKER, events, ticks, commands, eventsDropped: 0, ticksDropped: 0 };
}

test('signature parsing and tick classification', () => {
  assert.equal(classifyTick(parseSignature(P), ids).coherent, true);
  const foreign = classifyTick(parseSignature('New 2|rootP|trackP|C|....|NNNN|-|.'), ids);
  assert.equal(foreign.foreignContent, true); assert.equal(foreign.coherent, false);
  assert.equal(classifyTick(parseSignature('New 2|rootQ|trackQ|C|....|NNNN|-|.'), ids).project, 'split');
  assert.throws(() => parseSignature('a|b'));
});

test('a delivered Q value makes a detour seen', () => {
  seq = 0;
  const commands = [ev(0, { kind: 'command', op: 'invoked' }), ev(10, { kind: 'command', op: 'invoked' })];
  const events = [ev(500, { kind: 'value', name: 'projectName', value: 'New 3' }), ev(900, { kind: 'value', name: 'projectName', value: 'New 2' })];
  const ticks = [ev(600, { kind: 'tick', start: Q }), ev(1000, { kind: 'tick', start: P })];
  const summary = summarizeDetour(trace(events, ticks, commands), ids, P);
  assert.equal(summary.outcome, 'seen'); assert.equal(summary.firstQDeliveryAfterInvokeUs, 500);
  assert.equal(summary.foreignContentTicks, 0); assert.equal(summary.qTicks, 1);
});

test('a P endpoint with no Q delivery is unseen, and a Q endpoint is not', () => {
  seq = 0;
  const commands = [ev(0, { kind: 'command', op: 'invoked' }), ev(0, { kind: 'command', op: 'invoked' })];
  assert.equal(summarizeDetour(trace([], [], commands), ids, P).outcome, 'unseen-endpoint-P');
  const stepOnly = summarizeDetour(trace([ev(3, { kind: 'stepData', x: 8, y: 12, state: 2 })], [], commands), ids, P);
  assert.equal(stepOnly.outcome, 'unseen-endpoint-P'); assert.equal(stepOnly.qWitnessOnStepEvents, 1);
  assert.equal(summarizeDetour(trace([], [], commands), ids, Q).outcome, 'endpoint-not-P');
  const errored = [...commands, ev(1, { kind: 'command', op: 'error' })];
  assert.equal(summarizeDetour(trace([], [], errored), ids, P).outcome, 'command-error');
});

test('foreign content and in-tick changes are counted', () => {
  seq = 0;
  const commands = [ev(0, { kind: 'command', op: 'invoked' }), ev(1, { kind: 'command', op: 'invoked' })];
  const ticks = [ev(5, { kind: 'tick', start: 'New 3|rootQ|trackQ|C|NNNN|....|-|.', end: Q })];
  const summary = summarizeDetour(trace([], ticks, commands), ids, P);
  assert.equal(summary.foreignContentTicks, 1); assert.equal(summary.inTickChanges, 1);
});

test('toggle summaries detect coalescing and endpoint restoration', () => {
  seq = 0;
  const initial = parseSignature(P);
  const commands = [ev(0, { kind: 'command', op: 'mute', step: { count: 2 } })];
  const none = summarizeToggle(trace([], [], commands), 'mute', initial, P);
  assert.equal(none.coalesced, true); assert.equal(none.endpointRestored, true); assert.equal(none.deliveredChanges, 0);
  const both = summarizeToggle(trace([ev(5, { kind: 'value', name: 'cursorMute', value: 'true' }), ev(6, { kind: 'value', name: 'cursorMute', value: 'false' })], [], commands), 'mute', initial, P);
  assert.equal(both.coalesced, false);
  const scratch = [ev(0, { kind: 'command', op: 'scratchStep', step: { count: 2 } })];
  const step = summarizeToggle(trace([ev(5, { kind: 'stepData', x: 15, y: 6, state: 2 })], [], scratch), 'scratchStep', initial, P);
  assert.equal(step.deliveredChanges, 1); assert.equal(step.coalesced, true);
});

test('spin and aggregate summaries', () => {
  const spin = summarizeSpin(trace([], [], [{ op: 'spin', reads: 10, changes: [], eventsDuringSpin: 0 }]));
  assert.equal(spin.changesInsideCallback, 0);
  const rows = [{ dwell: 0, summary: { outcome: 'seen', foreignContentTicks: 0, inTickChanges: 0 } },
    { dwell: 0, summary: { outcome: 'unseen-endpoint-P', foreignContentTicks: 1, inTickChanges: 0 } }];
  const agg = aggregateDetours(rows);
  assert.equal(agg.unseenTotal, 1); assert.equal(agg.foreignContentTotal, 1);
});
