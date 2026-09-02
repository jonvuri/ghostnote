/**
 * The editors — BWMOD_DESIGN §3. Buffer in, a NEW buffer out; the input is
 * never mutated.
 *
 * Every editor maintains the same five invariants (DECISIONS D1):
 *   1. object bounds snap to the list SENTINEL — insert before it, end at it (E11h);
 *   2. each `0x1a1a`/`0x1a1b` identity stays unique within its list (E88);
 *   3. meta `referenced_modulator_ids` tracks the required modulator GUIDs (E10c/E71);
 *   4. header `f4` is patched whenever META changed size;
 *   5. header `f6` is re-pointed whenever it is non-zero and byte length changed (E11i);
 * plus, on a preset that embeds a sample, the Tier-2 count-stub relocation (E12).
 * New objects also use compact three-row grid identities so every tile remains
 * visible and interactive (E95).
 *
 * ⚠ `validate()` passing is necessary but NOT sufficient. A wrong Ramona route
 * path loads fine and carries no modulation (E10b) — every edit still has to be
 * confirmed by a live load + remote-page readback.
 */
import type { DonorObject, Routing } from './types.js';
import { fail, patchString, spliceBuffer } from './format.js';
import { repointF6 } from './header.js';
import { writeModulatorRefs } from './meta.js';
import { identifyCuratedDonor } from './donors.js';
import {
  findModulatorList, instanceGroupOffset, instanceIdOffset, modulatorBounds, modulatorListOffsets, nameFieldOffset,
  routeSlots,
} from './stream.js';
import { listModulators, nextFreeInstanceId } from './readers.js';
import { hasCountStubs, relocateStubs } from './stubs.js';

const MODULATOR_GRID_ROWS = 3;

/** Options shared by the editors that add or remove objects. */
export interface FootprintOptions {
  /** Exact MODULATORS list in a container preset. Omit for a plain device. */
  listIndex?: number;
  /**
   * Object footprint of the modulator being REMOVED, for Tier-2 relocation.
   * Only consulted when the preset embeds a sample; ignored otherwise.
   *
   * When omitted, the resident object must match a curated donor exactly (see
   * `identifyCuratedDonor`) — footprint belongs to the OBJECT, not the type, so
   * anything looser would be a guess, and a guessed footprint rejects the whole
   * preset silently.
   */
  removedFootprint?: number;
}

export interface AddOptions {
  /** Exact MODULATORS list in a container preset. Omit for a plain device. */
  listIndex?: number;
  /** Override grid column `0x1a1a`. Its pair with `0x1a1b` must stay unique. */
  instanceGroup?: number;
  /** Override grid row `0x1a1b`. Its pair with `0x1a1a` must stay unique. */
  instanceId?: number;
  /** Override cosmetic `0x02b9`; defaults to the grid slot number that Bitwig writes. */
  name?: string;
}

/** Retarget a modulation route — rewrite the `0x0e3d` Ramona path, any length (E10/E10b). */
export function retarget(
  buf: Buffer,
  index: number,
  target: string,
  routeIndex = 0,
  listIndex?: number,
): Buffer {
  const list = findModulatorList(buf, listIndex);
  const [start, end] = modulatorBounds(buf, index, list);
  const slots = routeSlots(buf, start, end);
  if (routeIndex >= slots.length) {
    fail(`modulator ${index} has ${slots.length} route(s); cannot retarget route ${routeIndex}`);
  }
  if (target.length === 0) fail('refusing to write an empty route target');
  // Stream-only: META is untouched, so f4 does not move. Length may change, so f6 might.
  return repointF6(patchString(buf, slots[routeIndex].targetAt, target));
}

/** Set a route's modulation amount. `0` leaves the route present but dormant (E7d). */
export function setAmount(
  buf: Buffer,
  index: number,
  amount: number,
  routeIndex = 0,
  listIndex?: number,
): Buffer {
  const list = findModulatorList(buf, listIndex);
  const [start, end] = modulatorBounds(buf, index, list);
  const slots = routeSlots(buf, start, end);
  if (routeIndex >= slots.length) {
    fail(`modulator ${index} has ${slots.length} route(s); cannot set amount on route ${routeIndex}`);
  }
  if (slots[routeIndex].amountAt === -1) fail(`route ${routeIndex} of modulator ${index} has no 0x0e32 amount`);
  const out = Buffer.from(buf);
  out.writeDoubleBE(amount, slots[routeIndex].amountAt);
  return out; // fixed width: nothing moved, so no f4/f6/stub work
}

/**
 * Add a donor as a NEW modulator: insert the object before the list sentinel,
 * give it the first free grid identity, append its GUID to the meta refs, patch `f4`,
 * relocate the sample count stubs, re-point `f6`. (E10f-B1, E12.)
 */
export function addModulator(buf: Buffer, donor: DonorObject, routing?: Routing, opts: AddOptions = {}): Buffer {
  const list = findModulatorList(buf, opts.listIndex);
  const identity = addIdentity(buf, donor, opts);
  assertFreeIdentity(buf, identity.group, identity.id, -1, opts.listIndex);
  const object = prepareDonor(
    donor,
    identity.group,
    identity.id,
    opts.name ?? String(identity.group * MODULATOR_GRID_ROWS + identity.id),
    routing,
  );

  let out = spliceBuffer(buf, list.listEnd, list.listEnd, object); // insert BEFORE the sentinel
  out = synchronizeModulatorRefs(out);
  out = relocate(out, footprintFor(out, donor, 'insert'));
  return repointF6(out);
}

/**
 * Replace a modulator with a donor object — a type-swap, across any category
 * (E10f-C1; category is not a gate). The donor keeps the resident grid slot and
 * the meta ref is swapped in place, keeping ref order aligned with the list.
 */
export function replaceModulator(
  buf: Buffer,
  index: number,
  donor: DonorObject,
  opts: FootprintOptions & AddOptions = {},
): Buffer {
  const list = findModulatorList(buf, opts.listIndex);
  const [start, end] = modulatorBounds(buf, index, list);
  const resident = listModulators(buf, opts.listIndex)[index];
  const instanceGroup = opts.instanceGroup ?? resident.instanceGroup;
  const instanceId = opts.instanceId ?? resident.instanceId;
  assertFreeIdentity(buf, instanceGroup, instanceId, index, opts.listIndex);
  const object = deactivateSecondaryRoutes(
    prepareDonor(donor, instanceGroup, instanceId, opts.name ?? resident.name),
  );

  let out = spliceBuffer(buf, start, end, object);
  out = synchronizeModulatorRefs(out);
  if (hasCountStubs(out)) {
    const inserted = footprintFor(out, donor, 'insert');
    const gone = removedFootprint(buf, index, start, end, opts, 'replace');
    out = relocateStubs(out, inserted - gone);
  }
  return repointF6(out);
}

/** Remove a modulator — object plus its meta ref (E10c/E10d), sentinel untouched. */
export function deleteModulator(buf: Buffer, index: number, opts: FootprintOptions = {}): Buffer {
  const list = findModulatorList(buf, opts.listIndex);
  const [start, end] = modulatorBounds(buf, index, list);

  let out = spliceBuffer(buf, start, end, Buffer.alloc(0));
  out = synchronizeModulatorRefs(out);
  if (hasCountStubs(out)) {
    out = relocateStubs(out, -removedFootprint(buf, index, start, end, opts, 'delete'));
  }
  return repointF6(out);
}

// ---------------------------------------------------------------------------

function assertFreeIdentity(
  buf: Buffer,
  group: number,
  id: number,
  ignoreIndex = -1,
  listIndex?: number,
): void {
  if (!Number.isInteger(group) || group < 0 || group > 0xff) {
    fail(`instance group ${group} is out of range — 0x1a1a is a u8`);
  }
  if (!Number.isInteger(id) || id < 0 || id > 0xff) {
    fail(`instance id ${id} is out of range — 0x1a1b is a u8`);
  }
  const clash = listModulators(buf, listIndex)
    .find((m) => m.index !== ignoreIndex && m.instanceGroup === group && m.instanceId === id);
  if (clash) {
    fail(`instance identity ${group}:${id} is already used by modulator ${clash.index} — duplicates reject the preset`);
  }
}

function addIdentity(buf: Buffer, donor: DonorObject, opts: AddOptions): { group: number; id: number } {
  if (opts.instanceGroup !== undefined || opts.instanceId !== undefined) {
    const donorGroup = donor.bytes.readUInt8(instanceGroupOffset(donor.bytes, 0, donor.bytes.length));
    const group = opts.instanceGroup ?? donorGroup;
    return {
      group,
      id: opts.instanceId ?? nextFreeInstanceId(buf, opts.listIndex, group),
    };
  }

  const occupied = new Set(listModulators(buf, opts.listIndex)
    .map((modulator) => `${modulator.instanceGroup}:${modulator.instanceId}`));
  for (let group = 0; group <= 0xff; group += 1) {
    for (let id = 0; id < MODULATOR_GRID_ROWS; id += 1) {
      if (!occupied.has(`${group}:${id}`)) return { group, id };
    }
  }
  fail('the modulator grid has no free slot');
}

/**
 * Keep META aligned after an edit. Plain presets preserve one ref per object.
 * Container presets use the ordered unique GUID set across their device lists.
 */
function synchronizeModulatorRefs(buf: Buffer): Buffer {
  const offsets = modulatorListOffsets(buf);
  const guids = offsets.flatMap((_, listIndex) =>
    listModulators(buf, listIndex).map((modulator) => modulator.guid));
  const refs = offsets.length === 1 ? guids : [...new Set(guids)];
  return writeModulatorRefs(buf, refs);
}

/** Stamp the donor's grid identity fields (and optional route) into a private copy. */
function prepareDonor(
  donor: DonorObject,
  instanceGroup: number,
  instanceId: number,
  name: string,
  routing?: Routing,
): Buffer {
  let object: Buffer = Buffer.from(donor.bytes);
  object.writeUInt8(instanceGroup, instanceGroupOffset(object, 0, object.length));
  object.writeUInt8(instanceId, instanceIdOffset(object, 0, object.length));
  object = patchString(object, nameFieldOffset(object, 0), name);
  if (routing) object = applyRouting(object, routing);
  return object;
}

function applyRouting(object: Buffer, routing: Routing): Buffer {
  const slots = routeSlots(object, 0, object.length);
  if (slots.length === 0) {
    // A route is a structure inside CONTENTS, not a field we can conjure; an
    // invented one is a silent no-op at best (E10). Pick a routed donor instead.
    fail('this donor carries no 0x0e3d modulation entry — cannot attach a route to it');
  }
  let out = patchString(object, slots[0].targetAt, routing.target);
  const after = routeSlots(out, 0, out.length)[0];
  if (after.amountAt !== -1) out.writeDoubleBE(routing.amount, after.amountAt);
  if (routing.rangeLo !== undefined && after.rangeLoAt !== -1) out.writeDoubleBE(routing.rangeLo, after.rangeLoAt);
  if (routing.rangeHi !== undefined && after.rangeHiAt !== -1) out.writeDoubleBE(routing.rangeHi, after.rangeHiAt);
  return deactivateSecondaryRoutes(out);
}

/** Keep the selected first donor output active and make all others dormant. */
function deactivateSecondaryRoutes(object: Buffer): Buffer {
  const out = Buffer.from(object);
  for (const dormant of routeSlots(out, 0, out.length).slice(1)) {
    if (dormant.amountAt !== -1) out.writeDoubleBE(0, dormant.amountAt);
  }
  return out;
}

function relocate(buf: Buffer, delta: number): Buffer {
  return hasCountStubs(buf) ? relocateStubs(buf, delta) : Buffer.from(buf);
}

/** The inserted side of the delta — only demanded when the preset actually has stubs. */
function footprintFor(buf: Buffer, donor: DonorObject, what: string): number {
  if (!hasCountStubs(buf)) return 0;
  if (donor.footprint === null) {
    fail(
      `this preset embeds a sample, so a ${what} must relocate its count stubs, but donor ` +
        `${donor.deviceName} (${donor.guid}) has no measured footprint. Measure it by E12a ` +
        'load-triangulation and record it in assets/modulators/manifest.json — a guess rejects the preset.',
    );
  }
  return donor.footprint;
}

/**
 * The removed side of the delta. An explicit value wins; otherwise the resident
 * object must match a curated donor BYTE FOR BYTE (modulo id and name), because
 * footprint belongs to the object and not to its type — see identifyCuratedDonor.
 */
function removedFootprint(
  buf: Buffer,
  index: number,
  start: number,
  end: number,
  opts: FootprintOptions,
  what: string,
): number {
  if (opts.removedFootprint !== undefined) return opts.removedFootprint;
  const resident = listModulators(buf, opts.listIndex)[index];
  const asset = identifyCuratedDonor(buf.subarray(start, end));
  if (asset?.footprint != null) return asset.footprint;
  return fail(
    `this preset embeds a sample, so a ${what} must relocate its count stubs by the footprint of the ` +
      `modulator being removed (${index}: ${resident.deviceName}, ${resident.guid}), but ` +
      `${asset ? `curated donor ${asset.id} has no measured footprint` : 'it matches no curated donor'}. ` +
      'Pass removedFootprint explicitly — a guessed footprint rejects the whole preset silently (E12a).',
  );
}
