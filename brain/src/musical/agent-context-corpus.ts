/** Golden contexts for the experimental agent musical language. */
import { createHash } from 'node:crypto';

import {
  AGENT_CONTEXT_SCHEMA, GROOVE_CONTEXT_SCHEMA, parseAgentContext, renderAgentContext,
  type AgentContext,
} from './agent-context.js';

const source = {
  sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  permission: 'generated MIT project fixture',
  coverage: {
    fromBeats: '0', toBeats: '2', trackIds: ['drums', 'guitar'], eventCount: 3,
    omittedFields: ['channel', 'releaseVelocity', 'noteExpression'],
  },
} as const;

const base = {
  schema: AGENT_CONTEXT_SCHEMA,
  source,
  meter: { numerator: 4, denominator: 4 },
  tempoMap: [{ atBeats: '0', bpm: 105 }, { atBeats: '1/2', bpm: 106 }],
  harmony: [{ atBeats: '0', symbol: 'E9sus4' }],
  regions: [{ id: 'main', fromBeats: '0', toBeats: '2' }],
  events: [
    {
      id: 'f-k1', track: 'drums', role: 'kick', layer: 'anchor', regionId: 'main',
      atBeats: '0', durationBeats: '1/8', pitch: 36, velocity: 112, mute: false,
    },
    {
      id: 'f-h2', track: 'drums', role: 'hat', layer: 'swung', regionId: 'main',
      atBeats: '17/64', durationBeats: '1/16', pitch: 42, velocity: 72, mute: false,
    },
    {
      id: 'f-g1', track: 'guitar', role: 'comp', layer: 'anticipated', regionId: 'main',
      atBeats: '63/128', durationBeats: '3/16', pitch: 52, velocity: 84, mute: false,
    },
  ],
} as const;

export const COMPACT_AGENT_CONTEXT: AgentContext = parseAgentContext({
  ...base,
  mode: 'compact-bar-v0',
});

export const GROOVE_AGENT_CONTEXT: AgentContext = parseAgentContext({
  ...base,
  mode: 'groove-two-layer-v0',
  groove: {
    schema: GROOVE_CONTEXT_SCHEMA,
    references: [
      {
        id: 'funk-anchor', subdivisionBeats: '1/4', phaseBeats: '0',
        shape: { kind: 'span', widthBeats: '1/128' },
      },
      {
        id: 'funk-hat', subdivisionBeats: '1/4', phaseBeats: '0', swingRatio: '17:15',
        shape: { kind: 'span', widthBeats: '1/128' },
      },
    ],
    events: [
      {
        eventId: 'f-h2', nominalAtBeats: '1/4', nominalDurationBeats: '1/16',
        realizedDurationBeats: '1/16', referenceId: 'funk-hat', templateBeats: '1/64',
        crossPartBeats: '0', localBeats: '0', deviationBeats: '1/64',
        deviationMs: 8.928571, confidence: 1,
        provenance: { kind: 'declared', source: 'generated-funk-control-v0' },
      },
      {
        eventId: 'f-g1', nominalAtBeats: '1/2', nominalDurationBeats: '3/16',
        realizedDurationBeats: '3/16', referenceId: 'funk-anchor', templateBeats: '0',
        crossPartBeats: '-1/128', localBeats: '0', deviationBeats: '-1/128',
        deviationMs: -4.42217, anchorEventId: 'f-k1', confidence: 1,
        provenance: { kind: 'declared', source: 'generated-funk-control-v0' },
      },
    ],
    generation: {
      generator: 'ghostnote-control', version: '0', seed: 'groove-seed-a',
      policy: 'sha256-event-offset-v0',
    },
  },
});

export const AGENT_CONTEXT_CORPUS = [COMPACT_AGENT_CONTEXT, GROOVE_AGENT_CONTEXT] as const;

export function fingerprintAgentContextCorpus(): string {
  return createHash('sha256')
    .update(AGENT_CONTEXT_CORPUS.map(renderAgentContext).join('\0'), 'utf8')
    .digest('hex');
}

/** Changing a mode, field, fixture, or renderer requires an explicit language review. */
export const AGENT_CONTEXT_CORPUS_V0_SHA256 =
  '988840b62a1e6d5cb0daa05185c0f33f176d2af77083e595f3c75a663de462b0';
