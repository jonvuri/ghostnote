/**
 * Object-stream navigation — enough of BWFORMAT_SPEC §3/§4 to find and bound a
 * modulator object exactly.
 *
 * A full recursive parse is impossible without Bitwig's Ramona schema (deep
 * lists inside a modulator's CONTENTS desync, spec §3.1), and it is not needed:
 * every edit locates a field by signature and snaps object bounds to the list
 * SENTINEL. The one hard rule (E11h, DECISIONS D1 invariant 1) is that a
 * modulator object ends at the byte before `00 00 00 03 00 00 00 00` — a
 * diff-derived bound can land 2 bytes INTO the sentinel and silently reject the
 * whole preset.
 */
import {
  CLASS_MODULATOR, FID, SENTINEL, TYPE, fail, fieldSig, isSentinel, readStr, valueSize,
} from './format.js';
import { streamOffset } from './header.js';

export interface ModulatorList {
  /** absolute offset of the `0x1a46` field id */
  fieldOffset: number;
  /** absolute offset of the first list item (or of the sentinel when empty) */
  listStart: number;
  /** absolute offsets of each `0x06c9` item */
  itemStarts: number[];
  /** absolute offset of the terminating SENTINEL — where `addModulator` inserts */
  listEnd: number;
}

const INSTANCE_ID_SIG = fieldSig(FID.INSTANCE_ID, TYPE.U8);
const MODULATOR_LIST_SIG = fieldSig(FID.MODULATOR_LIST, TYPE.LIST);

/**
 * Bound one modulator object: walk the trailing scalar fields that follow its
 * `0x1a1b` instance id until the object's own `u32(0)` terminator, then require
 * the result to abut either the next item's `0x06c9` classId or the list
 * SENTINEL. That cross-check is what makes the bound trustworthy — it is the
 * guard the E11i extractor lacked.
 */
function findItemEnd(buf: Buffer, itemStart: number, searchLimit: number): number {
  let candidate = buf.indexOf(INSTANCE_ID_SIG, itemStart);
  while (candidate !== -1 && candidate < searchLimit) {
    const end = walkTrailingFields(buf, candidate, searchLimit);
    if (end !== null && (isSentinel(buf, end) || (end + 4 <= buf.length && buf.readUInt32BE(end) === CLASS_MODULATOR))) {
      return end;
    }
    // A byte coincidence rather than the real field — keep looking.
    candidate = buf.indexOf(INSTANCE_ID_SIG, candidate + 1);
  }
  return fail(`could not bound the modulator object at 0x${itemStart.toString(16)} (no 0x1a1b + terminator)`);
}

/** Walk scalar fields from `at` to the enclosing object's `u32(0)`; null if the run is not scalar. */
function walkTrailingFields(buf: Buffer, at: number, limit: number): number | null {
  let p = at;
  while (p + 4 <= limit) {
    const fid = buf.readUInt32BE(p);
    if (fid === 0) return p + 4;
    p += 4;
    if (p >= limit) return null;
    const type = buf.readUInt8(p);
    p += 1;
    let size: number | null;
    try {
      size = valueSize(buf, p, type);
    } catch {
      return null; // unknown type byte => this was not a field boundary
    }
    if (size === null) return null; // a nested object/list: not the trailing scalar run
    p += size;
  }
  return null;
}

/**
 * Every `0x1a46` MODULATORS list in the stream, in file order.
 *
 * A plain device preset has exactly one. A CONTAINER (layer, chain, drum
 * machine) has one per nested device, so an edit has to say which — see
 * `findModulatorList`.
 */
export function modulatorListOffsets(buf: Buffer): number[] {
  const out: number[] = [];
  for (let i = buf.indexOf(MODULATOR_LIST_SIG, streamOffset(buf)); i !== -1; i = buf.indexOf(MODULATOR_LIST_SIG, i + 1)) {
    out.push(i);
  }
  return out;
}

/**
 * Locate a `MODULATORS` list and every item in it.
 *
 * `listEnd` is the SENTINEL offset: `addModulator` inserts there,
 * `deleteModulator` removes `[itemStart, nextItemStart)` and leaves it alone.
 *
 * With several lists present (a container preset) this REFUSES unless
 * `listIndex` names one. Editing "the first list" would silently rewrite
 * whichever nested device happened to serialize first, and a silent wrong
 * target is the failure mode this library exists to prevent.
 */
export function findModulatorList(buf: Buffer, listIndex?: number): ModulatorList {
  const offsets = modulatorListOffsets(buf);
  if (offsets.length === 0) fail('no 0x1a46 MODULATORS list in the object stream');
  if (listIndex === undefined && offsets.length > 1) {
    fail(
      `this preset holds ${offsets.length} MODULATORS lists (a container preset: one per nested device) — ` +
        'pass a listIndex to say which one to work on',
    );
  }
  const which = listIndex ?? 0;
  if (which < 0 || which >= offsets.length) fail(`no MODULATORS list at index ${which} (found ${offsets.length})`);
  const fieldOffset = offsets[which];

  const listStart = fieldOffset + MODULATOR_LIST_SIG.length;
  const itemStarts: number[] = [];
  let p = listStart;
  for (;;) {
    if (p + SENTINEL.length > buf.length) fail('object stream ends before the MODULATORS sentinel');
    if (isSentinel(buf, p)) return { fieldOffset, listStart, itemStarts, listEnd: p };
    const cls = buf.readUInt32BE(p);
    if (cls !== CLASS_MODULATOR) {
      fail(`MODULATORS item at 0x${p.toString(16)} has classId 0x${cls.toString(16)}, expected 0x06c9`);
    }
    itemStarts.push(p);
    p = findItemEnd(buf, p, buf.length);
  }
}

/** Absolute `[start, end)` of the modulator at `index`; `end` abuts the next item or the sentinel. */
export function modulatorBounds(buf: Buffer, index: number, list = findModulatorList(buf)): [number, number] {
  if (index < 0 || index >= list.itemStarts.length) {
    fail(`no modulator at index ${index} (the preset has ${list.itemStarts.length})`);
  }
  const start = list.itemStarts[index];
  const end = index + 1 < list.itemStarts.length ? list.itemStarts[index + 1] : list.listEnd;
  return [start, end];
}

/** Offset of the value of the first `fid`/`type` field inside `[start, end)`, or -1. */
export function findField(buf: Buffer, start: number, end: number, fid: number, type: number): number {
  const sig = fieldSig(fid, type);
  const at = buf.indexOf(sig, start);
  return at === -1 || at + sig.length > end ? -1 : at + sig.length;
}

/** Every offset of a `fid`/`type` field value inside `[start, end)`, in stream order. */
export function findFields(buf: Buffer, start: number, end: number, fid: number, type: number): number[] {
  const sig = fieldSig(fid, type);
  const hits: number[] = [];
  for (let i = buf.indexOf(sig, start); i !== -1 && i + sig.length <= end; i = buf.indexOf(sig, i + 1)) {
    hits.push(i + sig.length);
  }
  return hits;
}

/** Read a required string field, failing loudly rather than returning a plausible default. */
export function readStrField(buf: Buffer, start: number, end: number, fid: number): string {
  const at = findField(buf, start, end, fid, TYPE.STR);
  if (at === -1) fail(`field 0x${fid.toString(16)} (str) not found in 0x${start.toString(16)}..0x${end.toString(16)}`);
  return readStr(buf, at);
}

/**
 * The object's own `0x02b9` name — the FIRST field of a `0x06c9` object, read
 * positionally so a param called "0" deeper in CONTENTS cannot shadow it.
 */
export function nameFieldOffset(buf: Buffer, itemStart: number): number {
  const at = itemStart + 4;
  if (buf.readUInt32BE(at) !== FID.NAME || buf.readUInt8(at + 4) !== TYPE.STR) {
    fail(`modulator object at 0x${itemStart.toString(16)} does not open with a 0x02b9 name field`);
  }
  return at + 5;
}

/** Offset of the `0x1a1b` instance-id byte inside `[start, end)`. */
export function instanceIdOffset(buf: Buffer, start: number, end: number): number {
  const at = findField(buf, start, end, FID.INSTANCE_ID, TYPE.U8);
  if (at === -1) fail(`no 0x1a1b instance id in the modulator at 0x${start.toString(16)}`);
  return at;
}

/** Offset of the `0x1a1a` instance-group byte inside `[start, end)`. */
export function instanceGroupOffset(buf: Buffer, start: number, end: number): number {
  const at = findField(buf, start, end, FID.INSTANCE_GROUP, TYPE.U8);
  if (at === -1) fail(`no 0x1a1a instance group in the modulator at 0x${start.toString(16)}`);
  return at;
}

/** Where one modulation entry's fields live; `-1` for anything the entry omits. */
export interface RouteSlot {
  /** offset of the `0x0e3d` target string's `u32` length prefix */
  targetAt: number;
  amountAt: number;
  rangeLoAt: number;
  rangeHiAt: number;
}

/**
 * Locate every modulation entry in `[start, end)`. Routing lives inside the
 * modulator object, not a central table (spec §4), and each `0x0e3d` target
 * claims the range/amount fields up to the next target.
 */
export function routeSlots(buf: Buffer, start: number, end: number): RouteSlot[] {
  const targets = findFields(buf, start, end, FID.ROUTING_TARGET, TYPE.STR);
  return targets.map((targetAt, i) => {
    const scopeEnd = i + 1 < targets.length ? targets[i + 1] : end;
    return {
      targetAt,
      amountAt: findField(buf, targetAt, scopeEnd, FID.AMOUNT, TYPE.F64),
      rangeLoAt: findField(buf, targetAt, scopeEnd, FID.RANGE_LO, TYPE.F64),
      rangeHiAt: findField(buf, targetAt, scopeEnd, FID.RANGE_HI, TYPE.F64),
    };
  });
}
