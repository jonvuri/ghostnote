import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGENT_CONTEXT_CORPUS, AGENT_CONTEXT_CORPUS_V0_SHA256,
  COMPACT_AGENT_CONTEXT, GROOVE_AGENT_CONTEXT, fingerprintAgentContextCorpus,
} from './agent-context-corpus.js';
import {
  AgentContextError, fingerprintAgentContext, parseAgentContext, renderAgentContext,
} from './agent-context.js';

const clone = <T>(value: T): T => structuredClone(value);

test('A-context-golden: the two modal views keep one reviewed fingerprint', () => {
  assert.equal(AGENT_CONTEXT_CORPUS.length, 2);
  assert.equal(fingerprintAgentContextCorpus(), AGENT_CONTEXT_CORPUS_V0_SHA256);
  assert.equal(fingerprintAgentContext(COMPACT_AGENT_CONTEXT).length, 64);
  assert.equal(fingerprintAgentContext(GROOVE_AGENT_CONTEXT).length, 64);
});

test('A-context-mode: compact stays small and groove facts stay contextual', () => {
  const compact = renderAgentContext(COMPACT_AGENT_CONTEXT);
  const groove = renderAgentContext(GROOVE_AGENT_CONTEXT);
  assert.match(compact, /MODE compact-bar-v0/);
  assert.doesNotMatch(compact, /^GROOVE |^REFERENCE |^TIMING /m);
  assert.match(groove, /MODE groove-two-layer-v0/);
  assert.match(groove, /^REFERENCE funk-hat .*SWING 17:15/m);
  assert.match(groove, /^TIMING f-h2 NOMINAL 1\/4 .*DEVIATION 1\/64/m);
  assert.ok(compact.length < groove.length);
});

test('A-context-link: groove timing resolves to the compact realized events', () => {
  const parsed = parseAgentContext(GROOVE_AGENT_CONTEXT);
  const hat = parsed.events.find((event) => event.id === 'f-h2');
  const guitar = parsed.events.find((event) => event.id === 'f-g1');
  assert.equal(hat?.atBeats, '17/64');
  assert.equal(guitar?.atBeats, '63/128');
  assert.deepEqual(parsed.groove?.events.map((event) => event.eventId), ['f-h2', 'f-g1']);
});

test('A-context-refusal: a mode cannot silently gain or lose its groove plane', () => {
  assert.throws(
    () => parseAgentContext({ ...COMPACT_AGENT_CONTEXT, groove: GROOVE_AGENT_CONTEXT.groove }),
    (error) => error instanceof AgentContextError && /must not include the groove overlay/.test(error.message),
  );
  const withoutGroove = clone(GROOVE_AGENT_CONTEXT) as Record<string, unknown>;
  delete withoutGroove['groove'];
  assert.throws(
    () => parseAgentContext(withoutGroove),
    (error) => error instanceof AgentContextError && /requires the groove overlay/.test(error.message),
  );
});

test('A-context-refusal: stale coverage, unknown identities, and timing drift fail closed', () => {
  const stale = clone(GROOVE_AGENT_CONTEXT);
  stale.source.coverage.eventCount = 2;
  assert.throws(() => parseAgentContext(stale), /event count must equal/);

  const unknown = clone(GROOVE_AGENT_CONTEXT);
  unknown.groove!.events[0]!.referenceId = 'missing';
  assert.throws(() => parseAgentContext(unknown), /timing reference must exist/);

  const drift = clone(GROOVE_AGENT_CONTEXT);
  drift.groove!.events[0]!.deviationBeats = '0';
  assert.throws(() => parseAgentContext(drift), /deviation must equal/);

  const wrongRealized = clone(GROOVE_AGENT_CONTEXT);
  wrongRealized.events[1]!.atBeats = '1/4';
  assert.throws(() => parseAgentContext(wrongRealized), /must equal the compact realized position/);
});

test('A-context-refusal: rational and tempo-qualified timing stay exact', () => {
  const unreduced = clone(GROOVE_AGENT_CONTEXT);
  unreduced.groove!.events[0]!.nominalAtBeats = '2/8';
  assert.throws(() => parseAgentContext(unreduced), /canonical reduced form/);

  const wrongMilliseconds = clone(GROOVE_AGENT_CONTEXT);
  wrongMilliseconds.groove!.events[0]!.deviationMs = 9;
  assert.throws(() => parseAgentContext(wrongMilliseconds), /milliseconds must match/);
});

test('A-context-determinism: repeats are exact and a musical change changes identity', () => {
  const first = renderAgentContext(GROOVE_AGENT_CONTEXT);
  assert.equal(renderAgentContext(parseAgentContext(clone(GROOVE_AGENT_CONTEXT))), first);
  const reordered = clone(GROOVE_AGENT_CONTEXT);
  reordered.events.reverse();
  reordered.groove!.references.reverse();
  reordered.groove!.events.reverse();
  assert.equal(renderAgentContext(reordered), first);
  const changed = clone(GROOVE_AGENT_CONTEXT);
  changed.events[1]!.velocity += 1;
  assert.notEqual(fingerprintAgentContext(changed), fingerprintAgentContext(GROOVE_AGENT_CONTEXT));
});
