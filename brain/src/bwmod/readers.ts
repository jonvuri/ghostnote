/**
 * Pure, read-only views over a preset — BWMOD_DESIGN §2.
 */
import type { Chain, Modulator, Routing } from './types.js';
import { CLASS_CHAIN, FID, TYPE, fieldSig, formatGuid, readStr } from './format.js';
import {
  findField, findModulatorList, instanceGroupOffset, instanceIdOffset, modulatorBounds, nameFieldOffset, readStrField,
  routeSlots,
} from './stream.js';
import { streamOffset } from './header.js';

/** Decode every modulation entry in `[start, end)`. */
export function readRoutes(buf: Buffer, start: number, end: number): Routing[] {
  return routeSlots(buf, start, end).map((slot) => {
    const route: Routing = {
      target: readStr(buf, slot.targetAt),
      amount: slot.amountAt === -1 ? 0 : buf.readDoubleBE(slot.amountAt),
    };
    if (slot.rangeLoAt !== -1) route.rangeLo = buf.readDoubleBE(slot.rangeLoAt);
    if (slot.rangeHiAt !== -1) route.rangeHi = buf.readDoubleBE(slot.rangeHiAt);
    return route;
  });
}

/**
 * The modulators of one device. `listIndex` selects among the several
 * MODULATORS lists a container preset carries; omit it for a plain device.
 */
export function listModulators(buf: Buffer, listIndex?: number): Modulator[] {
  const list = findModulatorList(buf, listIndex);
  return list.itemStarts.map((start, index) => {
    const [, end] = modulatorBounds(buf, index, list);
    const guidAt = findField(buf, start, end, FID.DEVICE_GUID, TYPE.GUID);
    const routes = readRoutes(buf, start, end);
    return {
      index,
      name: readStr(buf, nameFieldOffset(buf, start)),
      deviceName: readStrField(buf, start, end, FID.DEVICE_NAME),
      category: readStrField(buf, start, end, FID.DEVICE_CATEGORY),
      guid: guidAt === -1 ? '' : formatGuid(buf.subarray(guidAt, guidAt + 16)),
      instanceGroup: buf.readUInt8(instanceGroupOffset(buf, start, end)),
      instanceId: buf.readUInt8(instanceIdOffset(buf, start, end)),
      routing: routes[0] ?? null,
      routes,
      span: [start, end] as [number, number],
    };
  });
}

/** Every `0x1a1b` value in one selected group. */
export function instanceIds(buf: Buffer, listIndex?: number, instanceGroup?: number): number[] {
  return listModulators(buf, listIndex)
    .filter((modulator) => instanceGroup === undefined || modulator.instanceGroup === instanceGroup)
    .map((modulator) => modulator.instanceId);
}

/**
 * `max(existing) + 1`, or 0 when there are none.
 *
 * Ids need not be contiguous or zero-based. The load gate applies to the
 * `0x1a1a`/`0x1a1b` pair. This allocator stays globally conservative so its
 * cosmetic names also stay distinct. Golden reconstructions remain identical.
 */
export function nextFreeInstanceId(buf: Buffer, listIndex?: number, instanceGroup?: number): number {
  const ids = instanceIds(buf, listIndex, instanceGroup);
  return ids.length === 0 ? 0 : Math.max(...ids) + 1;
}

/**
 * Layer-container chains (E10d) — informational.
 *
 * ⚠ Only the STARTS are resolved. Chains nest (a 4-chain template holds 14
 * `0x018f` objects), and E10d never established an exact end for the LAST chain
 * because its tail belongs to the parent. Each chain's `end` is therefore the
 * next chain's start, and the last chain's is `null`. There are deliberately no
 * chain editors: trimming is done by dropping earlier chains.
 */
export function listChains(buf: Buffer): Chain[] {
  const ss = streamOffset(buf);
  const sig = fieldSig(FID.CHAIN_LIST, TYPE.LIST);
  const fieldOffset = buf.indexOf(sig, ss);
  if (fieldOffset === -1) return [];
  const listStart = fieldOffset + sig.length;
  if (buf.readUInt32BE(listStart) !== CLASS_CHAIN) return [];

  // A top-level chain either opens the list or follows a sibling's object
  // terminator, and names itself "CHAIN<n>" in its first field. Nested 0x018f
  // objects fail one test or the other.
  const named = new Map<number, string>();
  const siblingHead = Buffer.from([0, 0, 0, 0, 0x00, 0x00, 0x01, 0x8f]);
  const candidates = [listStart];
  for (let i = buf.indexOf(siblingHead, listStart); i !== -1; i = buf.indexOf(siblingHead, i + 1)) {
    candidates.push(i + 4);
  }
  for (const start of candidates) {
    const nameAt = start + 4;
    if (buf.readUInt32BE(nameAt) !== FID.NAME || buf.readUInt8(nameAt + 4) !== TYPE.STR) continue;
    const name = readStr(buf, nameAt + 5);
    if (/^CHAIN\d+$/.test(name)) named.set(start, name);
  }

  const starts = [...named.keys()].sort((a, b) => a - b);
  return starts.map((start, index) => ({
    index,
    name: named.get(start) as string,
    start,
    end: index + 1 < starts.length ? starts[index + 1] : null,
  }));
}
