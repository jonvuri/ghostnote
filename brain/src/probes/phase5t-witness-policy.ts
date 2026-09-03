import type { DonorType } from '../bwmod/index.js';

export interface Phase5tWitnessPolicy {
  readonly exactPage: boolean;
  readonly operatorControl: boolean;
  readonly runningTransport: boolean;
  readonly sustainedNote: boolean;
  readonly targetDivergence: boolean;
}

const KNOWN_REQUIREMENTS = new Set([
  'exact-page',
  'note-trigger',
  'operator-control',
  'target-divergence',
  'transport-running',
]);

/** Convert one manifest witness into the live setup that the 5t probe must apply. */
export function phase5tWitnessPolicy(
  type: Pick<DonorType, 'id' | 'witness'>,
): Phase5tWitnessPolicy {
  const requirements = new Set(type.witness.requirements);
  const unknown = [...requirements].filter((requirement) => !KNOWN_REQUIREMENTS.has(requirement));
  if (unknown.length > 0) {
    throw new Error(`modulator ${JSON.stringify(type.id)} has unknown witness requirements: ${unknown.join(', ')}`);
  }

  const sustainedNote = requirements.has('note-trigger');
  const runningTransport = sustainedNote || requirements.has('transport-running');
  if (type.witness.mode === 'note-driven' && !sustainedNote) {
    throw new Error(`note-driven modulator ${JSON.stringify(type.id)} has no note trigger`);
  }
  if (type.witness.mode === 'free-running' && !runningTransport) {
    throw new Error(`free-running modulator ${JSON.stringify(type.id)} has no running transport`);
  }

  return {
    exactPage: requirements.has('exact-page'),
    operatorControl: requirements.has('operator-control'),
    runningTransport,
    sustainedNote,
    targetDivergence: requirements.has('target-divergence'),
  };
}
