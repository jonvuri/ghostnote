/**
 * The editors — BWMOD_DESIGN §3. Buffer in, a NEW buffer out; the input is
 * never mutated.
 *
 * Every editor maintains the same five invariants (DECISIONS D1):
 *   1. object bounds snap to the list SENTINEL — insert before it, end at it (E11h);
 *   2. `0x1a1b` stays unique across modulators — the one proven load gate (E10f);
 *   3. meta `referenced_modulator_ids` tracks the modulator GUIDs, in order (E10c/E10f);
 *   4. header `f4` is patched whenever META changed size;
 *   5. header `f6` is re-pointed whenever it is non-zero and byte length changed (E11i);
 * plus, on a preset that embeds a sample, the Tier-2 count-stub relocation (E12).
 *
 * ⚠ `validate()` passing is necessary but NOT sufficient. A wrong Ramona route
 * path loads fine and carries no modulation (E10b) — every edit still has to be
 * confirmed by a live load + remote-page readback.
 */
import type { DonorObject, Routing } from './types.js';
import { fail, patchString, spliceBuffer } from './format.js';
import { repointF6 } from './header.js';
import { appendMetaRef, removeMetaRefAt, replaceMetaRefAt } from './meta.js';
import { identifyCuratedDonor } from './donors.js';
import {
  findModulatorList, instanceIdOffset, modulatorBounds, nameFieldOffset, routeSlots,
} from './stream.js';
import { listModulators, nextFreeInstanceId } from './readers.js';
import { hasCountStubs, relocateStubs } from './stubs.js';

/** Options shared by the editors that add or remove objects. */
export interface FootprintOptions {
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
  /** override the auto-assigned `0x1a1b` (must stay unique — the load gate) */
  instanceId?: number;
  /** override the cosmetic `0x02b9` name; defaults to the instance id, as Bitwig writes it */
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
 * give it an unused `0x1a1b`, append its GUID to the meta refs, patch `f4`,
 * relocate the sample count stubs, re-point `f6`. (E10f-B1, E12.)
 */
export function addModulator(buf: Buffer, donor: DonorObject, routing?: Routing, opts: AddOptions = {}): Buffer {
  const list = findModulatorList(buf);
  const instanceId = opts.instanceId ?? nextFreeInstanceId(buf);
  assertFreeId(buf, instanceId);
  const object = prepareDonor(donor, instanceId, opts.name ?? String(instanceId), routing);

  let out = spliceBuffer(buf, list.listEnd, list.listEnd, object); // insert BEFORE the sentinel
  out = appendMetaRef(out, donor.guid);
  out = relocate(out, footprintFor(out, donor, 'insert'));
  return repointF6(out);
}

/**
 * Replace a modulator with a donor object — a type-swap, across any category
 * (E10f-C1; category is not a gate). The donor gets a fresh unique id and the
 * meta ref is swapped in place, keeping ref order aligned with the list.
 */
export function replaceModulator(
  buf: Buffer,
  index: number,
  donor: DonorObject,
  opts: FootprintOptions & AddOptions = {},
): Buffer {
  const list = findModulatorList(buf);
  const [start, end] = modulatorBounds(buf, index, list);
  const instanceId = opts.instanceId ?? nextFreeInstanceId(buf);
  assertFreeId(buf, instanceId, index);
  const object = prepareDonor(donor, instanceId, opts.name ?? String(instanceId));

  let out = spliceBuffer(buf, start, end, object);
  out = replaceMetaRefAt(out, index, donor.guid);
  if (hasCountStubs(out)) {
    const inserted = footprintFor(out, donor, 'insert');
    const gone = removedFootprint(buf, index, start, end, opts, 'replace');
    out = relocateStubs(out, inserted - gone);
  }
  return repointF6(out);
}

/** Remove a modulator — object plus its meta ref (E10c/E10d), sentinel untouched. */
export function deleteModulator(buf: Buffer, index: number, opts: FootprintOptions = {}): Buffer {
  const list = findModulatorList(buf);
  const [start, end] = modulatorBounds(buf, index, list);

  let out = spliceBuffer(buf, start, end, Buffer.alloc(0));
  out = removeMetaRefAt(out, index);
  if (hasCountStubs(out)) {
    out = relocateStubs(out, -removedFootprint(buf, index, start, end, opts, 'delete'));
  }
  return repointF6(out);
}

// ---------------------------------------------------------------------------

function assertFreeId(buf: Buffer, id: number, ignoreIndex = -1): void {
  if (!Number.isInteger(id) || id < 0 || id > 0xff) {
    fail(`instance id ${id} is out of range — 0x1a1b is a u8`);
  }
  const clash = listModulators(buf).find((m) => m.index !== ignoreIndex && m.instanceId === id);
  if (clash) fail(`instance id ${id} is already used by modulator ${clash.index} — duplicates reject the preset`);
}

/** Stamp the donor's identity fields (and optional route) into a private copy. */
function prepareDonor(donor: DonorObject, instanceId: number, name: string, routing?: Routing): Buffer {
  let object: Buffer = Buffer.from(donor.bytes);
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
        'load-triangulation and record it in assets/modulators/index.json — a guess rejects the preset.',
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
  const resident = listModulators(buf)[index];
  const asset = identifyCuratedDonor(buf.subarray(start, end));
  if (asset?.footprint != null) return asset.footprint;
  return fail(
    `this preset embeds a sample, so a ${what} must relocate its count stubs by the footprint of the ` +
      `modulator being removed (${index}: ${resident.deviceName}, ${resident.guid}), but ` +
      `${asset ? `curated donor ${asset.id} has no measured footprint` : 'it matches no curated donor'}. ` +
      'Pass removedFootprint explicitly — a guessed footprint rejects the whole preset silently (E12a).',
  );
}
