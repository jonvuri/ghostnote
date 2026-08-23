import { join } from 'node:path';

/** Human-authored E4g preset, promoted in place as an immutable product asset. */
export const OWNED_LAYER_TEMPLATE_PATH = join(
  import.meta.dirname,
  '..',
  '..',
  'fixtures',
  'InstrumentLayer',
  'gn_layer_4chain.bwpreset',
);

export const OWNED_LAYER_MANIFEST_PATH = join(
  import.meta.dirname,
  '..',
  '..',
  'assets',
  'composition',
  'instrument-layer-4.json',
);

export const NATIVE_CATALOG_PATH = join(
  import.meta.dirname,
  '..',
  '..',
  'assets',
  'native-devices',
  'catalog.json',
);
