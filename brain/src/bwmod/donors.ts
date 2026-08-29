/**
 * Donor objects — BWMOD_DESIGN decision 3: a modulator is EXTRACTED from a
 * human-authored template and transplanted, never synthesized.
 *
 * The curated set lives in `brain/assets/modulators/` as raw `0x06c9` object
 * bytes plus a manifest carrying identity fields and the measured
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

export type DonorCapability = 'add' | 'replace';
export type DonorWitnessMode = 'structural' | 'free-running' | 'note-driven';

export interface DonorType {
  id: string;
  publicName: string;
  category: string;
  donorId: string;
  capabilities: DonorCapability[];
  sampledPreset: 'supported' | 'tier-1-only';
  witness: {
    mode: DonorWitnessMode;
    requirements: string[];
  };
  provenance: string;
}

export interface HostModulatorInventoryEntry {
  name: string;
  supportedType?: string;
  unsupportedReason?: string;
}

/** One extracted object in `assets/modulators/manifest.json`. */
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
  /** Human-saved fixture and modulator position this was lifted from. */
  source: {
    fixture: string;
    index: number;
  };
  /** the donor's own route target, or null when it is unrouted */
  route: string | null;
}

export interface DonorManifest {
  schemaVersion: 1;
  host: {
    product: string;
    version: string;
    inventorySource: string;
    unsupportedReasons: Record<string, string>;
    inventory: HostModulatorInventoryEntry[];
  };
  types: DonorType[];
  donors: DonorAsset[];
}

export const DONOR_MANIFEST_PATH = join(ASSET_DIR, 'manifest.json');

let cachedManifest: DonorManifest | null = null;
const cachedBytes = new Map<string, Buffer>();

function donorManifest(): DonorManifest {
  if (!cachedManifest) {
    const value = JSON.parse(readFileSync(DONOR_MANIFEST_PATH, 'utf8')) as DonorManifest;
    assertManifest(value);
    cachedManifest = value;
  }
  return cachedManifest;
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
  return donorManifest().donors.slice();
}

/** Public type entries for the current host. */
export function listDonorTypes(): DonorType[] {
  return donorManifest().types.slice();
}

/** Resolve one public type to its curated donor. */
export function donorType(id: string, capability?: DonorCapability): DonorType {
  const entry = donorManifest().types.find((type) => type.id === id);
  if (!entry) fail(`no supported modulator type ${JSON.stringify(id)}`);
  if (capability !== undefined && !entry.capabilities.includes(capability)) {
    fail(`modulator type ${JSON.stringify(id)} does not support ${capability}`);
  }
  return entry;
}

/** Complete factory inventory with explicit public or refusal standing. */
export function listHostModulatorInventory(): Array<{
  name: string;
  supportedType: string | null;
  unsupportedReason: string | null;
}> {
  const manifest = donorManifest();
  return manifest.host.inventory.map((entry) => ({
    name: entry.name,
    supportedType: entry.supportedType ?? null,
    unsupportedReason: entry.unsupportedReason === undefined
      ? null
      : manifest.host.unsupportedReasons[entry.unsupportedReason]!,
  }));
}

export function donorHost(): { product: string; version: string } {
  const { product, version } = donorManifest().host;
  return { product, version };
}

/** Load a curated donor by its asset id (e.g. `lfo-sampler`). */
export function loadDonor(id: string): DonorObject {
  const asset = donorManifest().donors.find((d) => d.id === id);
  if (!asset) fail(`no curated donor ${JSON.stringify(id)} (have: ${donorManifest().donors.map((d) => d.id).join(', ')})`);
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
  for (const asset of donorManifest().donors) {
    const candidate = normalizeForMatch(donorBytes(asset));
    if (candidate && candidate.equals(needle)) return asset;
  }
  return null;
}

function assertManifest(manifest: DonorManifest): void {
  if (manifest.schemaVersion !== 1) fail('unsupported donor manifest schema');
  const donorIds = new Set<string>();
  for (const asset of manifest.donors) {
    if (donorIds.has(asset.id)) fail(`duplicate donor id ${JSON.stringify(asset.id)}`);
    donorIds.add(asset.id);
  }
  const typeIds = new Set<string>();
  const publicNames = new Set<string>();
  for (const type of manifest.types) {
    if (typeIds.has(type.id)) fail(`duplicate public modulator type ${JSON.stringify(type.id)}`);
    if (publicNames.has(type.publicName)) fail(`duplicate public modulator name ${JSON.stringify(type.publicName)}`);
    if (!donorIds.has(type.donorId)) fail(`type ${JSON.stringify(type.id)} names an unknown donor`);
    if (type.capabilities.length === 0
        || type.capabilities.some((capability) => capability !== 'add' && capability !== 'replace')
        || new Set(type.capabilities).size !== type.capabilities.length) {
      fail(`type ${JSON.stringify(type.id)} has invalid capabilities`);
    }
    if (type.sampledPreset !== 'supported' && type.sampledPreset !== 'tier-1-only') {
      fail(`type ${JSON.stringify(type.id)} has invalid sampled-preset standing`);
    }
    if (!['structural', 'free-running', 'note-driven'].includes(type.witness.mode)
        || type.witness.requirements.length === 0) {
      fail(`type ${JSON.stringify(type.id)} has an invalid witness`);
    }
    const donor = manifest.donors.find((asset) => asset.id === type.donorId)!;
    if (donor.deviceName !== type.publicName || donor.category !== type.category) {
      fail(`type ${JSON.stringify(type.id)} does not match its donor identity`);
    }
    if (type.capabilities.includes('add')) {
      if (donor.route === null) fail(`add type ${JSON.stringify(type.id)} has no donor route`);
    }
    if (type.sampledPreset === 'supported') {
      if (donor.footprint === null || donor.footprintSource.trim() === '') {
        fail(`sampled type ${JSON.stringify(type.id)} has no measured footprint`);
      }
    }
    typeIds.add(type.id);
    publicNames.add(type.publicName);
  }
  const inventoryNames = new Set<string>();
  for (const entry of manifest.host.inventory) {
    if (inventoryNames.has(entry.name)) fail(`duplicate host modulator ${JSON.stringify(entry.name)}`);
    if ((entry.supportedType === undefined) === (entry.unsupportedReason === undefined)) {
      fail(`host modulator ${JSON.stringify(entry.name)} needs one standing`);
    }
    if (entry.supportedType !== undefined && !typeIds.has(entry.supportedType)) {
      fail(`host modulator ${JSON.stringify(entry.name)} names an unknown public type`);
    }
    if (entry.supportedType !== undefined
        && manifest.types.find((type) => type.id === entry.supportedType)!.publicName !== entry.name) {
      fail(`host modulator ${JSON.stringify(entry.name)} does not match its public type`);
    }
    if (entry.unsupportedReason !== undefined
        && manifest.host.unsupportedReasons[entry.unsupportedReason] === undefined) {
      fail(`host modulator ${JSON.stringify(entry.name)} names an unknown refusal`);
    }
    inventoryNames.add(entry.name);
  }
  for (const type of manifest.types) {
    if (!manifest.host.inventory.some((entry) => entry.supportedType === type.id)) {
      fail(`public type ${JSON.stringify(type.id)} is absent from the host inventory`);
    }
  }
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
