/**
 * `bwmod` — modulator surgery on Bitwig `.bwpreset` files.
 *
 * The brain constructs modulator topology by byte-editing a template preset and
 * loading it with `device.insertFile` (DECISIONS D1). There is no runtime
 * create/route API; runtime only DRIVES what a template already contains.
 *
 *   import { addModulator, loadDonor, validate } from './bwmod/index.js';
 *
 *   const donor = loadDonor('lfo-sampler');
 *   const out = addModulator(template, donor, { target: 'CONTENTS/AMP_ATTACK_TIME', amount: 0.5 });
 *   const { ok, problems } = validate(out, { reference: template, stubDelta: donor.footprint });
 *
 * ⚠ `validate()` predicts a load; it cannot predict MODULATION. A wrong Ramona
 * path loads and silently does nothing (E10b), so confirm every edit with a live
 * load plus a remote-page readback.
 *
 * Layout: format.ts (TLV primitives) · header.ts (f4/f6) · meta.ts (the ref list)
 * · stream.ts (sentinel-snapped object bounds) · stubs.ts (Tier-2 relocation)
 * · readers.ts · donors.ts · editors.ts · validate.ts.
 */
export type { Chain, DonorObject, Header, Modulator, Routing, ValidationResult } from './types.js';

export { BwFormatError, SENTINEL, FID, TYPE, patchString, formatGuid } from './format.js';
export { parseHeader, repointF6, setF4, shiftF4, streamOffset } from './header.js';
export {
  appendMetaRef, readMeta, readModulatorRefs, removeMetaRef, removeMetaRefAt, replaceMetaRefAt,
  writeModulatorRefs,
} from './meta.js';
export type { MetaRecord, MetaValue } from './meta.js';
export { findModulatorList, modulatorBounds, modulatorListOffsets, routeSlots } from './stream.js';
export type { ModulatorList, RouteSlot } from './stream.js';
export { findCountStubs, hasCountStubs, relocateStubs, stubValues } from './stubs.js';
export type { CountStub } from './stubs.js';
export { instanceIds, listChains, listModulators, nextFreeInstanceId, readRoutes } from './readers.js';
export {
  ASSET_DIR, DONOR_MANIFEST_PATH, donorHost, donorType, extractModulator,
  identifyCuratedDonor, listDonorAssets, listDonorTypes, listHostModulatorInventory, loadDonor,
} from './donors.js';
export type {
  DonorAsset, DonorCapability, DonorManifest, DonorType, DonorWitnessMode,
  HostModulatorInventoryEntry,
} from './donors.js';
export { addModulator, deleteModulator, replaceModulator, retarget, setAmount } from './editors.js';
export type { AddOptions, FootprintOptions } from './editors.js';
export { validate } from './validate.js';
export type { ValidateOptions } from './validate.js';
