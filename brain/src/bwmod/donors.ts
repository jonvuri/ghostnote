/**
 * Donor objects — BWMOD_DESIGN decision 3: a modulator is EXTRACTED from a
 * human-authored template and transplanted, never synthesized.
 *
 * The curated set lives in `brain/assets/modulators/` as raw `0x06c9` object
 * bytes plus an index carrying the identity fields and, crucially, the measured
 * object FOOTPRINT that Tier-2 relocation needs (see stubs.ts).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { DonorObject } from './types.js';
import { CLASS_MODULATOR, FID, OBJ_TERMINATOR, TYPE, fail, findAll, formatGuid, patchString } from './format.js';
import {
  findField, findModulatorList, instanceIdOffset, modulatorBounds, nameFieldOffset, readStrField,
  routeSlots,
} from './stream.js';

export const ASSET_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'modulators');

/** One entry of `assets/modulators/index.json`. */
export interface DonorAsset {
  id: string;
  deviceName: string;
  category: string;
  guid: string;
  /** measured object footprint, or null when it has never been measured (see DonorObject) */
  footprint: number | null;
  /** how the footprint was established — provenance matters; a guessed footprint rejects presets */
  footprintSource: string;
  /** the extracted object, relative to ASSET_DIR */
  file: string;
  /** `<fixture>#<modulator index>` this was lifted from */
  source: string;
  /** the donor's own route target, or null when it is unrouted */
  route: string | null;
}

interface DonorIndex {
  donors: DonorAsset[];
}

let cachedIndex: DonorIndex | null = null;
const cachedBytes = new Map<string, Buffer>();

function donorIndex(): DonorIndex {
  if (!cachedIndex) cachedIndex = JSON.parse(readFileSync(join(ASSET_DIR, 'index.json'), 'utf8')) as DonorIndex;
  return cachedIndex;
}

/** Asset bytes, read once. Callers get a private copy — donors are never mutated. */
function donorBytes(asset: DonorAsset): Buffer {
  let bytes = cachedBytes.get(asset.file);
  if (!bytes) {
    bytes = readFileSync(join(ASSET_DIR, asset.file));
    assertModulatorObject(bytes);
    cachedBytes.set(asset.file, bytes);
  }
  return Buffer.from(bytes);
}

/** Metadata for every curated donor. */
export function listDonorAssets(): DonorAsset[] {
  return donorIndex().donors.slice();
}

/** Load a curated donor by its asset id (e.g. `lfo-sampler`). */
export function loadDonor(id: string): DonorObject {
  const asset = donorIndex().donors.find((d) => d.id === id);
  if (!asset) fail(`no curated donor ${JSON.stringify(id)} (have: ${donorIndex().donors.map((d) => d.id).join(', ')})`);
  return {
    bytes: donorBytes(asset),
    guid: asset.guid,
    category: asset.category,
    deviceName: asset.deviceName,
    footprint: asset.footprint,
  };
}

/**
 * Identify a resident modulator object as one of the curated donors, by exact
 * bytes once the per-instance and routing fields are normalized away.
 *
 * This is how a replace/delete on a SAMPLED preset learns the footprint of the
 * modulator it is REMOVING. Matching on the GUID alone would not do: a GUID
 * names a modulator TYPE, but footprint belongs to the exact OBJECT — a routed
 * Random costs 0x0d and an unrouted one 0x0b, same GUID. An exact-bytes match
 * is sound; anything looser is a guess, and a guessed footprint rejects the
 * whole preset silently (E12a).
 */
export function identifyCuratedDonor(objectBytes: Buffer): DonorAsset | null {
  const needle = normalizeForMatch(objectBytes);
  if (!needle) return null;
  for (const asset of donorIndex().donors) {
    const candidate = normalizeForMatch(donorBytes(asset));
    if (candidate && candidate.equals(needle)) return asset;
  }
  return null;
}

/**
 * Blank everything the editors themselves rewrite, so a planted donor still
 * matches its asset after being retargeted or re-amounted: the `0x1a1b` id, the
 * `0x02b9` name, and each modulation entry's target/amount/range.
 *
 * Normalizing those is sound for FOOTPRINT purposes specifically: retarget and
 * setAmount add and remove no objects (E12e — they need no relocation), so an
 * object that differs only there has the same object count. Nothing looser is
 * safe; differing PARAM values elsewhere are left alone, so two same-type
 * modulators from different presets deliberately do NOT match.
 */
function normalizeForMatch(object: Buffer): Buffer | null {
  try {
    let out: Buffer = Buffer.from(object);
    out.writeUInt8(0, instanceIdOffset(out, 0, out.length));
    out = patchString(out, nameFieldOffset(out, 0), '');
    for (let i = routeSlots(out, 0, out.length).length - 1; i >= 0; i--) {
      const slot = routeSlots(out, 0, out.length)[i];
      for (const at of [slot.amountAt, slot.rangeLoAt, slot.rangeHiAt]) {
        if (at !== -1) out.writeDoubleBE(0, at);
      }
      out = patchString(out, slot.targetAt, '');
    }
    return out;
  } catch {
    return null;
  }
}

function assertModulatorObject(bytes: Buffer): void {
  if (bytes.length < 8 || bytes.readUInt32BE(0) !== CLASS_MODULATOR) {
    fail('donor bytes do not open with a 0x06c9 modulator classId');
  }
  if (bytes.compare(OBJ_TERMINATOR, 0, 4, bytes.length - 4, bytes.length) !== 0) {
    fail(`donor bytes do not end on an object terminator (end ${bytes.subarray(-4).toString('hex')})`);
  }
  if (findAll(bytes, Buffer.from([0x00, 0x00, 0x1a, 0x1b, TYPE.U8])).length !== 1) {
    fail('donor object does not carry exactly one 0x1a1b instance id');
  }
}

/**
 * Lift the modulator at `index` out of a template.
 *
 * Bounds come from the sentinel-snapped list walk, so the object ends exactly on
 * its own terminator (E11h). `footprint` is passed in because it cannot be
 * derived from the bytes — see DonorObject.
 */
export function extractModulator(templatePreset: Buffer, index: number, footprint: number | null = null): DonorObject {
  const [start, end] = modulatorBounds(templatePreset, index, findModulatorList(templatePreset));
  const bytes = Buffer.from(templatePreset.subarray(start, end));
  assertModulatorObject(bytes);
  const guidAt = findField(templatePreset, start, end, FID.DEVICE_GUID, TYPE.GUID);
  if (guidAt === -1) fail(`modulator ${index} has no 0x18c6 GUID`);
  return {
    bytes,
    guid: formatGuid(templatePreset.subarray(guidAt, guidAt + 16)),
    category: readStrField(templatePreset, start, end, FID.DEVICE_CATEGORY),
    deviceName: readStrField(templatePreset, start, end, FID.DEVICE_NAME),
    footprint,
  };
}
