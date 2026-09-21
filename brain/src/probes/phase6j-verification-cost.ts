/** Offline cost audit of existing context functions. No host or provider calls. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';

import {
  COMPACT_AGENT_CONTEXT, GROOVE_AGENT_CONTEXT, AGENT_CONTEXT_CORPUS_V0_SHA256,
  fingerprintAgentContextCorpus,
} from '../musical/agent-context-corpus.js';
import {
  parseAgentContext, renderAgentContext, fingerprintAgentContext, type AgentContext,
} from '../musical/agent-context.js';

const digest = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
const warmups = 20;
const samples = 15;
const iterations = 25;
let sink: unknown;

function measure(work: () => unknown) {
  for (let index = 0; index < warmups; index += 1) sink = work();
  const times: number[] = [];
  for (let sample = 0; sample < samples; sample += 1) {
    const start = performance.now();
    for (let index = 0; index < iterations; index += 1) sink = work();
    times.push((performance.now() - start) / iterations);
  }
  times.sort((left, right) => left - right);
  return { minMs: times[0], medianMs: times[Math.floor(samples / 2)], maxMs: times.at(-1) };
}

function compactFixture(count: number): AgentContext {
  return parseAgentContext({
    ...COMPACT_AGENT_CONTEXT,
    source: {
      ...COMPACT_AGENT_CONTEXT.source,
      coverage: {
        ...COMPACT_AGENT_CONTEXT.source.coverage,
        toBeats: String(count), trackIds: ['drums'], eventCount: count,
      },
    },
    tempoMap: [{ atBeats: '0', bpm: 120 }],
    harmony: [],
    regions: [],
    events: Array.from({ length: count }, (_, index) => ({
      id: `event-${index}`, track: 'drums', role: 'kick', atBeats: String(index),
      durationBeats: '1/8', pitch: 36, velocity: 100, mute: false,
    })).reverse(),
  });
}

assert.equal(fingerprintAgentContextCorpus(), AGENT_CONTEXT_CORPUS_V0_SHA256);
const cases = [
  ['compact-3', COMPACT_AGENT_CONTEXT],
  ['groove-3', GROOVE_AGENT_CONTEXT],
  ['compact-128', compactFixture(128)],
  ['compact-1024', compactFixture(1024)],
] as const;

const results = cases.map(([name, context]) => {
  const json = JSON.stringify(context);
  const rendered = renderAgentContext(context);
  const expected = digest(rendered);
  assert.equal(fingerprintAgentContext(context), expected);
  assert.equal(renderAgentContext(parseAgentContext(JSON.parse(json))), rendered);
  const costs = {
    jsonParse: measure(() => JSON.parse(json)),
    validate: measure(() => parseAgentContext(context)),
    renderIncludingValidation: measure(() => renderAgentContext(context)),
    fingerprintIncludingRenderAndValidation: measure(() => fingerprintAgentContext(context)),
    hashRenderedTextOnly: measure(() => digest(rendered)),
    parseRenderFingerprint: measure(() => {
      const parsed = parseAgentContext(JSON.parse(json));
      return [renderAgentContext(parsed), fingerprintAgentContext(parsed)];
    }),
  };
  assert.equal(JSON.stringify(context), json);
  assert.equal(fingerprintAgentContext(context), expected);
  return {
    name, events: context.events.length, jsonBytes: Buffer.byteLength(json),
    renderedBytes: Buffer.byteLength(rendered), jsonSha256: digest(json),
    renderedSha256: expected, costs,
  };
});

assert.notEqual(sink, undefined);
console.log(JSON.stringify({
  schema: 'ghostnote-phase6j-cost-audit-v0',
  runtime: { node: process.version, platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model },
  method: { warmups, samples, iterations, unit: 'ms per call; batch means', startupIncluded: false },
  domain: 'existing context JSON and rendered text; not exact-note-source-v0',
  corpusSha256: AGENT_CONTEXT_CORPUS_V0_SHA256,
  results,
}, null, 2));
