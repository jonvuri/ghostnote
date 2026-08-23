export const COMPOSITION_TARGET_IDS = [
  'polysynth-filter-frequency',
  'polysynth-filter-resonance',
  'sampler-amp-attack',
] as const;

export type CompositionTargetId = typeof COMPOSITION_TARGET_IDS[number];

export interface CompositionTargetRecipe {
  readonly deviceName: string;
  readonly route: string;
  readonly pageName: string;
  readonly controlName: string;
}

/** Named routes that have exact live remote-control witnesses. */
export const COMPOSITION_TARGETS: Readonly<Record<CompositionTargetId, CompositionTargetRecipe>> = {
  'polysynth-filter-frequency': {
    deviceName: 'Polysynth',
    route: 'CONTENTS/F1FREQ',
    pageName: 'FILTER',
    controlName: 'Filt Freq',
  },
  'polysynth-filter-resonance': {
    deviceName: 'Polysynth',
    route: 'CONTENTS/F1RESO',
    pageName: 'FILTER',
    controlName: 'Reso',
  },
  'sampler-amp-attack': {
    deviceName: 'Sampler',
    route: 'CONTENTS/AMP_ATTACK_TIME',
    pageName: 'Amp EG',
    controlName: 'Attack',
  },
};
