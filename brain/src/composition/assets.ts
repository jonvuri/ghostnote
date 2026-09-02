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

/** Human-authored Session 5o FX Layer seed with one empty target entry. */
export const OWNED_FX_LAYER_TEMPLATE_PATH = join(
  import.meta.dirname,
  '..',
  '..',
  'fixtures',
  'FXLayer',
  'gn_latebound_fx_layer.bwpreset',
);

export const OWNED_FX_LAYER_MANIFEST_PATH = join(
  import.meta.dirname,
  '..',
  '..',
  'assets',
  'composition',
  'fx-layer-late-bound.json',
);

/** Exact manifests for the two supported human-saved container seeds. */
export const GENERAL_CONTAINER_SEED_MANIFEST_PATH = join(
  import.meta.dirname,
  '..',
  '..',
  'assets',
  'composition',
  'general-container-seeds.json',
);

export const NATIVE_CATALOG_PATH = join(
  import.meta.dirname,
  '..',
  '..',
  'assets',
  'native-devices',
  'catalog.json',
);
