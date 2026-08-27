export const COMPOSITION_TARGET_IDS = [
  'polysynth-filter-frequency',
  'polysynth-filter-resonance',
  'sampler-amp-attack',
] as const;

export type CompositionTargetId = typeof COMPOSITION_TARGET_IDS[number];

export interface CompositionTargetRecipe {
  readonly deviceName: string;
  readonly route: string;
  readonly parameterId: string;
  readonly parameterName: string;
}

/** Named routes that have exact live remote-control witnesses. */
export const COMPOSITION_TARGETS: Readonly<Record<CompositionTargetId, CompositionTargetRecipe>> = {
  'polysynth-filter-frequency': {
    deviceName: 'Polysynth',
    route: 'CONTENTS/F1FREQ',
    parameterId: 'CONTENTS/F1FREQ',
    parameterName: 'Filter Frequency',
  },
  'polysynth-filter-resonance': {
    deviceName: 'Polysynth',
    route: 'CONTENTS/F1RESO',
    parameterId: 'CONTENTS/F1RESO',
    parameterName: 'Filter Resonance',
  },
  'sampler-amp-attack': {
    deviceName: 'Sampler',
    route: 'CONTENTS/AMP_ATTACK_TIME',
    parameterId: 'CONTENTS/AMP_ATTACK_TIME',
    parameterName: 'Amp Attack',
  },
};
