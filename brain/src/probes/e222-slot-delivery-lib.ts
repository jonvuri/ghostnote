/** E222 pure analysis for slot delivery. These summaries describe delivered controller state. They are not host fences. */
import assert from 'node:assert/strict';
import { parseSignature } from './e216-delivery-coherence-lib.js';

type Wire = Record<string, unknown>;
export const E222_MARKER = 'e222-slot-delivery-v1';
export type Side = 'P' | 'Q';
/** One owned project: its name, its first window track UUID, and its settled window occupancy. */
export interface SlotSide { name: string; trackId: string; occupancy: string }
export interface SlotSides { P: SlotSide; Q: SlotSide }

/** Mark rows of window track 0 as occupied. Other tracks must stay empty. */
export function occupancyFor(rows: readonly number[], base: string): string {
  const tracks = base.split(','); assert(tracks.length >= 1);
  const first = tracks[0]!.split('').map((cell, row) => cell === '-' ? '-' : rows.includes(row) ? 'X' : '.');
  return [first.join(''), ...tracks.slice(1)].join(',');
}

function sorted(trace: Wire): Wire[] {
  const all = [...trace.events as Wire[], ...trace.ticks as Wire[], ...trace.commands as Wire[]];
  return all.sort((a, b) => Number(a.seq) - Number(b.seq));
}

/** Keep the records that the slot analysis reads. Verification recomputes every summary from this trace. */
export function compactSlotTrace(trace: Wire): Wire {
  assert.equal(trace.slotMarker, E222_MARKER);
  const events = (trace.events as Wire[]).filter(e => e.kind === 'slot' || (e.kind === 'value' && e.name === 'projectName'));
  const keys = ['marker', 'orderingMarker', 'slotMarker', 'ordering', 'eventsDropped', 'ticksDropped', 'commandsDropped',
    'runError', 'signature', 'slotSignature', 'slotCallbacks'];
  const result: Wire = {};
  for (const key of keys) result[key] = trace[key];
  return { ...result, events, ticks: trace.ticks, commands: trace.commands };
}

/**
 * Summarize one scripted run. A tick is foreign when its slots differ from every declared
 * state of the project that its delivered name names. `allowedP` declares the intermediate
 * P states of a separate-callback edit; a same-callback edit declares none. Each foreign tick must have a
 * depth-1 confirmation with a changed slot-callback count, or the window would admit it.
 * A change between recorded ticks without a slot callback is a missed delivery.
 */
export function summarizeSlotRun(trace: Wire, sides: SlotSides, watch: readonly { t: number; s: number }[] = [],
  allowedP: readonly string[] = []): Wire {
  assert.equal(trace.slotMarker, E222_MARKER);
  const records = sorted(trace);
  const invokes = records.filter(r => r.kind === 'command' && r.op !== 'mark');
  assert(invokes.length >= 1, 'a run needs one command');
  const firstSeq = Number(invokes[0]!.seq);
  const after = records.filter(r => Number(r.seq) > firstSeq);
  const slotEvents = after.filter(r => r.kind === 'slot');
  const names = after.filter(r => r.kind === 'value' && r.name === 'projectName');
  const ticks = records.filter(r => r.kind === 'tick' && typeof r.slots === 'string');
  const confirms = new Map<number, Wire>();
  for (const r of records) if (r.kind === 'confirm' && Number(r.depth) === 1) confirms.set(Number(r.tickSeq), r);
  const sideOf = (name: string): Side | 'other' => name === sides.P.name ? 'P' : name === sides.Q.name ? 'Q' : 'other';
  const missed: Wire[] = [], foreign: Wire[] = [], admittedForeign: Wire[] = [];
  let previous: Wire | undefined, unconfirmedForeign = 0;
  for (const tick of ticks) {
    if (previous && previous.slots !== tick.slots && Number(previous.slotCallbacks) === Number(tick.slotCallbacks))
      missed.push({ fromSeq: previous.seq, toSeq: tick.seq, from: previous.slots, to: tick.slots, slotCallbacks: tick.slotCallbacks });
    if (tick.slotsEnd !== undefined && tick.slotsEnd !== tick.slots)
      missed.push({ insideTickSeq: tick.seq, from: tick.slots, to: tick.slotsEnd, slotCallbacks: tick.slotCallbacks });
    previous = tick;
    if (Number(tick.seq) < firstSeq) continue;
    const side = sideOf(parseSignature(String(tick.start)).name);
    const expected = side === 'other' ? undefined : side === 'P' ? [sides.P.occupancy, ...allowedP] : [sides.Q.occupancy];
    if (expected === undefined || expected.includes(String(tick.slots))) continue;
    const confirm = confirms.get(Number(tick.seq));
    const row = { seq: tick.seq, side, slots: tick.slots, tickSlotCallbacks: tick.slotCallbacks,
      confirmSlotCallbacks: confirm?.slotCallbacks ?? null };
    foreign.push(row);
    if (!confirm) unconfirmedForeign++;
    else if (Number(confirm.slotCallbacks) === Number(tick.slotCallbacks)) admittedForeign.push(row);
  }
  const final = String(trace.slotSignature), finalSide = sideOf(parseSignature(String(trace.signature)).name);
  const byAddress: Record<string, number> = {};
  for (const e of slotEvents) { const key = `${String(e.t)}:${String(e.s)}`; byAddress[key] = (byAddress[key] ?? 0) + 1; }
  const errors = records.filter(r => r.kind === 'command' && r.op === 'error');
  return {
    outcome: errors.length ? 'command-error' : finalSide !== 'P' ? 'endpoint-not-P' : final !== sides.P.occupancy ? 'occupancy-not-P'
      : names.some(r => r.value === sides.Q.name) ? 'seen' : 'unseen-endpoint-P',
    commands: invokes.length, slotEvents: slotEvents.length, slotEventsByAddress: byAddress,
    watchedSlotEvents: watch.map(w => byAddress[`${w.t}:${w.s}`] ?? 0),
    qProjectNameEvents: names.filter(r => r.value === sides.Q.name).length,
    ticks: ticks.filter(t => Number(t.seq) > firstSeq).length,
    foreignTicks: foreign.length, unconfirmedForeignTicks: unconfirmedForeign,
    admittedForeignTicks: admittedForeign.length, missedDeliveries: missed.length, missed, foreign: foreign.slice(0, 8),
    finalSide, finalOccupancy: final, finalOccupancyIsP: final === sides.P.occupancy,
    eventsDropped: trace.eventsDropped, ticksDropped: trace.ticksDropped, hostFenceProved: false,
  };
}

/** Aggregate run summaries. Violations are missed deliveries and admitted foreign ticks. */
export function aggregateSlotRuns(rows: readonly Wire[]): Wire {
  const count = (outcome: string): number => rows.filter(r => r.outcome === outcome).length;
  const sum = (key: string): number => rows.reduce((total, r) => total + Number(r[key]), 0);
  return { runs: rows.length, seen: count('seen'), unseenEndpointP: count('unseen-endpoint-P'),
    otherOutcomes: rows.length - count('seen') - count('unseen-endpoint-P'),
    runsWithSlotEvents: rows.filter(r => Number(r.slotEvents) > 0).length,
    runsWithoutSlotEvents: rows.filter(r => Number(r.slotEvents) === 0).length,
    runsWithForeignTicks: rows.filter(r => Number(r.foreignTicks) > 0).length,
    foreignTicks: sum('foreignTicks'), unconfirmedForeignTicks: sum('unconfirmedForeignTicks'),
    admittedForeignTicks: sum('admittedForeignTicks'), missedDeliveries: sum('missedDeliveries'),
    droppedRecords: sum('eventsDropped') + sum('ticksDropped'),
    watchedWithoutEvents: rows.filter(r => (r.watchedSlotEvents as number[]).some(n => n === 0)).length };
}
