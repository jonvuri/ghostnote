/** Pure D03 helpers used to classify the local preset inventory. */
export type PresetSuffixClass =
  | 'bitwig-file'
  | 'clap-discovery'
  | 'host-external'
  | 'unknown';

const BITWIG_FILES = new Set(['bwpreset', 'h2p', 'fxp', 'fxb', 'vstpreset']);
const HOST_EXTERNAL = new Set([
  'aupreset', 'nksf', 'kelvin', 'vpreset', 'serumpreset', 'serumfx',
  'serumfxrack', 'preset', 'xml',
]);

export function classifyPresetSuffix(suffix: string): PresetSuffixClass {
  const normalized = suffix.toLowerCase().replace(/^\./, '');
  if (BITWIG_FILES.has(normalized)) return 'bitwig-file';
  if (isClapDiscoverySuffix(normalized)) return 'clap-discovery';
  if (HOST_EXTERNAL.has(normalized)) return 'host-external';
  return 'unknown';
}

function isClapDiscoverySuffix(suffix: string): boolean {
  return suffix === 'clap-discovered';
}

export function timingSummary(values: readonly number[]): {
  readonly median: number;
  readonly range: readonly [number, number];
} {
  if (values.length !== 3 || values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('D03 warm timing needs exactly three finite non-negative samples');
  }
  const sorted = [...values].sort((left, right) => left - right);
  return { median: sorted[1]!, range: [sorted[0]!, sorted[2]!] };
}

export function directRouteVerdict(
  indexedLoaded: readonly boolean[],
  unindexedLoaded: boolean,
): 'direct' | 'indexed-direct' | 'unsupported' | 'nondeterministic' {
  if (indexedLoaded.length === 0 || new Set(indexedLoaded).size !== 1) return 'nondeterministic';
  if (!indexedLoaded[0]) return unindexedLoaded ? 'nondeterministic' : 'unsupported';
  return unindexedLoaded ? 'direct' : 'indexed-direct';
}
