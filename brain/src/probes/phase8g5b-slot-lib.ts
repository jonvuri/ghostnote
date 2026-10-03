/** 8g5b pure checks for published occupancy against an independent slot scan. */
import assert from 'node:assert/strict';

type Wire = Record<string, unknown>;
export const SLOT_WINDOW_MARKER = '8g5b-slot-window-v1';
export interface Slot { trackId: string; row: number }
export const slotKey = (slot: Slot): string => `${slot.trackId}:${slot.row}`;

/** Clip occupancy from a scan. Group tracks hold no clip of their own; their slots are a separate diagnostic. */
export function scanOccupancy(scan: Wire): { clips: string[]; groupSlots: string[] } {
  const groups = new Set((scan.groupIds as string[]) ?? []);
  const occupied = (scan.slots as Wire[]).filter(slot => slot.hasContent === true)
    .map(slot => ({ trackId: String(slot.trackId), row: Number(slot.row) }));
  return { clips: occupied.filter(slot => !groups.has(slot.trackId)).map(slotKey).sort(),
    groupSlots: occupied.filter(slot => groups.has(slot.trackId)).map(slotKey).sort() };
}

export function publishedOccupancy(list: Wire): string[] {
  assert.equal(list.occupancyAdmitted, true, `occupancy refused: ${String(list.reason)}`);
  assert.equal(list.clipIdentityClaimed, false);
  return (list.occupancy as Wire[]).map(row => slotKey({ trackId: String(row.trackId), row: Number(row.row) })).sort();
}

/** Apply declared native operations to a prior scan. Rows and track UUIDs come from the declaration. */
export function declaredOccupancy(prior: readonly string[], operations: readonly Wire[]): string[] {
  let slots = prior.map(key => { const at = key.lastIndexOf(':'); return { trackId: key.slice(0, at), row: Number(key.slice(at + 1)) }; });
  const has = (s: Slot): boolean => slots.some(x => slotKey(x) === slotKey(s));
  for (const op of operations) {
    const at = (prefix = ''): Slot => ({ trackId: String(op[`${prefix}trackId`]), row: Number(op[`${prefix}row`]) });
    switch (op.op) {
      case 'create': assert(!has(at()), `declared create on an occupied slot ${slotKey(at())}`); slots.push(at()); break;
      case 'delete': assert(has(at()), `declared delete on an empty slot ${slotKey(at())}`); slots = slots.filter(s => slotKey(s) !== slotKey(at())); break;
      case 'move': {
        const from = at('from_'), to = at('to_');
        assert(has(from) && !has(to), 'declared move needs a filled source and an empty destination');
        slots = slots.map(s => slotKey(s) === slotKey(from) ? to : s); break;
      }
      case 'insertScene': slots = slots.map(s => s.row >= Number(op.row) ? { ...s, row: s.row + 1 } : s); break;
      case 'deleteScene': slots = slots.filter(s => s.row !== Number(op.row)).map(s => s.row > Number(op.row) ? { ...s, row: s.row - 1 } : s); break;
      case 'replace': slots = (op.occupancy as string[]).map(key => { const i = key.lastIndexOf(':'); return { trackId: key.slice(0, i), row: Number(key.slice(i + 1)) }; }); break;
      default: throw new Error(`unknown declared operation ${String(op.op)}`);
    }
  }
  return slots.map(slotKey).sort();
}

/** Every check in one trial. Foreign slots are published slots outside the independent scan. */
export function compareOccupancy(published: readonly string[], scan: readonly string[], declared?: readonly string[]): Wire {
  const scanSet = new Set(scan), publishedSet = new Set(published);
  const foreign = published.filter(key => !scanSet.has(key)), missing = scan.filter(key => !publishedSet.has(key));
  const declarationMatches = declared === undefined ? null
    : declared.length === scan.length && declared.every((key, index) => key === scan[index]);
  return { matches: foreign.length === 0 && missing.length === 0 && declarationMatches !== false,
    publishedCount: published.length, scanCount: scan.length, foreignSlots: foreign, missingSlots: missing, declarationMatches };
}
