/**
 * 8h1b sounding-cell cost reduction: pure helpers. The research build adds a full-width release proxy and a
 * coarse sentinel proxy. Every live result stays `complete:false` and `eligible:false`.
 */
import assert from 'node:assert/strict';
import { widthConfig, type Wire } from './phase8h1a-knee-lib.js';

export type { Wire };
export const SOUNDING_MARKER = '8h1b-sounding-v2';
export const SOUNDING_PROFILE = 'phase-8-probe-v1';
/** The research build adds operations to `cache.shadow` only. The method table is the 8h1a table. */
export const SOUNDING_METHOD_COUNT = 98;
export const SOUNDING_METHODS_HASH = 'd89cee6bf21c1f96';
export const NOTE_STEP_CLASS = 'com.bitwig.flt.control_surface.proxy.NoteStep';
/** Mirror of ShadowSoundingProbe.SENTINEL_RATIO: the sentinel grid has width / 32 steps. */
export const SENTINEL_RATIO = 32;
/** Research width: a one-million-cell sustained fixture fits; the sentinel then covers 2,048 beats at 1/16. */
export const SOUNDING_WIDTH = 1_048_576;

/** Research rig config: two cache views, a 16×16 bank, the knee fixture writer, and the sounding proxies. */
export function soundingConfig(): Wire {
  return { ...widthConfig(SOUNDING_WIDTH), stamp: '8h1b-sounding', cacheShadowCursorScenes: 0, cacheSoundingResearch: true };
}

/** Instances and bytes of the named classes in `jcmd <pid> GC.class_histogram`. An absent class counts zero. */
export function classCounts(text: string, names: readonly string[]): Record<string, { instances: number; bytes: number }> {
  const counts: Record<string, { instances: number; bytes: number }> = {};
  for (const name of names) counts[name] = { instances: 0, bytes: 0 };
  for (const line of text.split('\n')) {
    const row = line.match(/^\s*\d+:\s+(\d+)\s+(\d+)\s+(\S+)/);
    if (row && counts[row[3]!] !== undefined) counts[row[3]!] = { instances: Number(row[1]), bytes: Number(row[2]) };
  }
  return counts;
}

/** Step sizes of the sentinel matrix, finest first. Each value is the coarse cell in 1/512-beat cells. */
export const SENTINEL_STEPS = [32, 128, 512] as const;
export type SentinelStep = typeof SENTINEL_STEPS[number];
export const stepBeats = (cells: number): number => cells / 512;

/** One 1/512 edit operation for `soundingEdit`. All operations of one call share one host update. */
export type EditOp =
  | { op: 'set'; channel: number; x: number; y: number; velocity: number; durationCells: number }
  | { op: 'clear'; channel: number; x: number; y: number }
  | { op: 'move'; channel: number; x: number; y: number; dx: number; dy: number }
  | { op: 'field'; channel: number; x: number; y: number; field: string; value: number | boolean }
  | { op: 'loopLength' | 'playStop'; beats: number };

/** A cell that the sentinel must report: fine cell, pitch, and channel. */
export interface Expected { x: number; y: number; channel: number }
export interface MatrixRow { label: string; kind: string; ops: EditOp[]; expected: Expected[] }

/** Matrix clip: 64 beats. Each row has its own 1,024-cell region, a whole number of coarse cells at each step. */
export const MATRIX_BEATS = 64;
export const MATRIX_WIDTH = MATRIX_BEATS * 512;
export const REGION = 1024;
const PITCH = 60, VELOCITY = 100, DURATION = 4;

/**
 * The baseline notes, the field setup, and the edit rows. Every row edits only its own region, so the rows
 * are independent.
 * A field edit through the host uses a 0..1 velocity; a set uses 0..127.
 */
export function matrixPlan(step: number): { baseline: EditOp[]; setup: EditOp[]; rows: MatrixRow[] } {
  assert(SENTINEL_STEPS.includes(step as SentinelStep), 'unknown sentinel step');
  // A field edit needs the note start in the host grid, so field setup follows the baseline in a later call.
  const baseline: EditOp[] = [], setup: EditOp[] = [], rows: MatrixRow[] = [];
  let region = 0;
  const note = (x: number, channel = 0, y = PITCH, durationCells = DURATION): Expected => {
    baseline.push({ op: 'set', channel, x, y, velocity: VELOCITY, durationCells }); return { x, y, channel };
  };
  const next = (): number => { const base = region * REGION; region++; assert(base + REGION <= MATRIX_WIDTH - REGION); return base; };
  const field = (label: string, name: string, value: number | boolean, kind = 'field', prior?: { name: string; value: number | boolean }): void => {
    const at = note(next() + 3);
    if (prior) setup.push({ op: 'field', ...at, field: prior.name, value: prior.value });
    rows.push({ label, kind, ops: [{ op: 'field', ...at, field: name, value }], expected: [at] });
  };
  {
    const at = note(next() + 1);
    rows.push({ label: 'nudge-inside-cell', kind: 'nudge', ops: [{ op: 'move', ...at, dx: 1, dy: 0 }], expected: [at, { ...at, x: at.x + 1 }] });
  }
  {
    const at = note(next() + step - 1, 0, PITCH, 1);
    rows.push({ label: 'nudge-across-boundary', kind: 'nudge', ops: [{ op: 'move', ...at, dx: 1, dy: 0 }], expected: [at, { ...at, x: at.x + 1 }] });
  }
  field('velocity', 'velocity', 0.25);
  field('gain', 'gain', 0.3);
  // A new host note has chance enabled (E226 diagnostic). Disabling it is the real flag change.
  field('chance-disable', 'chanceEnabled', false);
  field('chance-value', 'chance', 0.5);
  field('mute', 'muted', true);
  // A disabled control: the chance value changes while its enable flag is off.
  field('chance-while-disabled', 'chance', 0.3, 'disabled-control', { name: 'chanceEnabled', value: false });
  {
    const at = note(next() + 1);
    rows.push({ label: 'duration-inside-footprint', kind: 'duration', ops: [{ op: 'field', ...at, field: 'duration', value: DURATION * 2 }], expected: [at] });
  }
  {
    const at = note(next() + 5);
    rows.push({ label: 'delete-readd-one-update', kind: 'delete-readd', expected: [at], ops: [
      { op: 'clear', ...at }, { op: 'set', ...at, velocity: 40, durationCells: DURATION }] });
  }
  {
    const first = note(next() + 2); note(first.x + 8);
    rows.push({ label: 'same-cell-first', kind: 'same-pitch-channel', ops: [{ op: 'field', ...first, field: 'velocity', value: 0.2 }], expected: [first] });
    const base = next(); note(base + 2); const second = note(base + 10);
    rows.push({ label: 'same-cell-second', kind: 'same-pitch-channel', ops: [{ op: 'field', ...second, field: 'velocity', value: 0.2 }], expected: [second] });
  }
  for (let channel = 0; channel < 16; channel++) {
    const at = note(next() + 7, channel);
    rows.push({ label: `channel-${channel}`, kind: 'channel', ops: [{ op: 'field', ...at, field: 'velocity', value: 0.5 }], expected: [at] });
  }
  const last = note(MATRIX_WIDTH - 1, 0, PITCH + 1, 1);
  rows.push({ label: 'final-cell-field', kind: 'final-cell', ops: [{ op: 'field', ...last, field: 'velocity', value: 0.4 }], expected: [last] });
  const added = { x: MATRIX_WIDTH - 1, y: PITCH + 2, channel: 0 };
  rows.push({ label: 'final-cell-add', kind: 'final-cell', ops: [{ op: 'set', ...added, velocity: 90, durationCells: 1 }], expected: [added] });
  // Clip extent rows change no note. Their expectation is the fine recorder's projection.
  rows.push({ label: 'loop-shorten', kind: 'clip-extent', ops: [{ op: 'loopLength', beats: MATRIX_BEATS / 2 }], expected: [] });
  rows.push({ label: 'loop-restore', kind: 'clip-extent', ops: [{ op: 'loopLength', beats: MATRIX_BEATS }], expected: [] });
  rows.push({ label: 'length-shorten', kind: 'clip-extent', ops: [{ op: 'playStop', beats: MATRIX_BEATS / 2 }], expected: [] });
  rows.push({ label: 'length-restore', kind: 'clip-extent', ops: [{ op: 'playStop', beats: MATRIX_BEATS }], expected: [] });
  return { baseline, setup, rows };
}

/** Trace row columns: seq,x,y,channel,state,velocity,duration,gain,chance,chanceEnabled,muted. */
export type TraceRow = [number, number, number, number, number, number, number, number, number, boolean, boolean];

const key = (x: number, y: number, channel: number): string => `${x}:${y}:${channel}`;

/**
 * Judge one row. The explicit check needs a sentinel callback at the coarse cell of every edited note start.
 * The derived check needs a sentinel callback at the coarse projection of every fine callback. A row with no
 * explicit cell uses only the derived check. The fine recorder must see each explicit cell.
 */
export function evaluateRow(row: MatrixRow, step: number, fine: TraceRow[], sentinel: TraceRow[]): Wire {
  const coarse = new Set(sentinel.map(r => key(r[1], r[2], r[3])));
  const fineCells = new Set(fine.map(r => key(r[1], r[2], r[3])));
  const missing = row.expected.filter(e => !coarse.has(key(Math.floor(e.x / step), e.y, e.channel))).map(e => key(e.x, e.y, e.channel));
  const fineMissing = row.expected.filter(e => !fineCells.has(key(e.x, e.y, e.channel))).map(e => key(e.x, e.y, e.channel));
  const projected = [...new Set(fine.map(r => key(Math.floor(r[1] / step), r[2], r[3])))];
  const derivedMissing = projected.filter(cell => !coarse.has(cell));
  const pass = missing.length === 0 && derivedMissing.length === 0;
  return { label: row.label, kind: row.kind, stepCells: step, pass, missing, derivedMissing, fineMissing,
    fineCallbacks: fine.length, sentinelCallbacks: sentinel.length, fineObserved: fineMissing.length === 0 };
}

/** Recompute a matrix artifact. A step size passes only when every row passes and every trace is complete. */
export function verifyMatrix(report: Wire): Wire {
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.marker, SOUNDING_MARKER);
  const step = Number(report.stepCells), plan = matrixPlan(step), rows = report.rows as Wire[];
  assert.equal(rows.length, plan.rows.length, 'every listed edit type is recorded');
  const results = rows.map((row, index) => {
    assert.equal(row.label, plan.rows[index]!.label);
    assert.equal(row.fineComplete, true, `${String(row.label)} fine trace is complete`);
    assert.equal(row.sentinelComplete, true, `${String(row.label)} sentinel trace is complete`);
    const result = evaluateRow(plan.rows[index]!, step, row.fine as TraceRow[], row.sentinel as TraceRow[]);
    assert.deepEqual(row.result, result, `${String(row.label)} result differs from its traces`);
    return result;
  });
  const misses = results.filter(row => row.pass !== true).map(row => String(row.label));
  return { stepCells: step, stepBeats: stepBeats(step), rows: results.length, pass: misses.length === 0, misses,
    fineBlind: results.filter(row => row.fineObserved !== true).map(row => String(row.label)) };
}

/** One release action: the note-step delta it frees and the replay that restores the grid. */
export function releaseDelta(before: number, after: number, cells: number): { freed: number; fraction: number; releases: boolean } {
  const freed = before - after;
  // A release frees at least 95 % of the bound grid. Unrelated host objects can change by a few hundred.
  return { freed, fraction: cells === 0 ? 0 : freed / cells, releases: cells > 0 && freed >= 0.95 * cells };
}
