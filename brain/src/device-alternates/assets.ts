import { basename, join } from 'node:path';

/** Build-time product asset: one empty entry inside an Instrument Layer. */
export const INSTRUMENT_LAYER_SEED_PATH = join(
  import.meta.dirname,
  '..',
  '..',
  'assets',
  'device-alternates',
  'instrument-layer-seed.bwpreset',
);

export const INSTRUMENT_LAYER_SEED_BASENAME = basename(INSTRUMENT_LAYER_SEED_PATH);

export const FX_LAYER_UUID = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
