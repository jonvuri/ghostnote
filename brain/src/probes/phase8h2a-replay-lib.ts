/**
 * 8h2a replay cold read: pure helpers. The research build adds a full-width 1/512 reader proxy that decodes
 * notes from note-step callbacks only. Every live result stays `complete:false` and `eligible:false`.
 */
import assert from 'node:assert/strict';
import { fixtureNote, widthConfig, type Wire } from './phase8h1a-knee-lib.js';

export type { Wire };
export const REPLAY_MARKER = '8h2a-replay-v1';
export const REPLAY_PROFILE = 'phase-8-probe-v1';
/** The research build adds operations to `cache.shadow` only. The method table is the 8h1a table. */
export const REPLAY_METHOD_COUNT = 98;
export const REPLAY_METHODS_HASH = 'd89cee6bf21c1f96';
/** The largest research width: 8,192 beats at 1/512. */
export const REPLAY_WIDTH = 4_194_304;
/** The oracle for a late callback: observe at least this long after the bind and after the last callback. */
export const ORACLE_MS = 2_000;

/** Research rig config: the 8h1a width config at the largest width, with the replay reader and no sounding proxies. */
export function replayConfig(): Wire {
  return { ...widthConfig(REPLAY_WIDTH), stamp: '8h2a-replay', cacheShadowCursorScenes: 0, cacheReplayResearch: true };
}

/**
 * One fixture clip, alone at row 0 of its own owned track. `spec` uses the 8h1a even-spread writer. `one`
 * is a single note at cell 0. `empty` has no note.
 */
export interface FixturePlan { name: string; kind: 'empty' | 'one' | 'spec'; beats: number; count: number; cap: number }
export const FIXTURES: readonly FixturePlan[] = [
  { name: 'empty-64', kind: 'empty', beats: 64, count: 0, cap: 64 },
  { name: 'one-64', kind: 'one', beats: 64, count: 1, cap: 64 },
  { name: 'final-8192', kind: 'spec', beats: 8_192, count: 1, cap: 64 },
  { name: 'n4096-64', kind: 'spec', beats: 64, count: 4_096, cap: 64 },
  { name: 'n16384-512', kind: 'spec', beats: 512, count: 16_384, cap: 64 },
  { name: 'n131072-2048', kind: 'spec', beats: 2_048, count: 131_072, cap: 4 },
  { name: 'sustain-2048', kind: 'spec', beats: 2_048, count: 16_384, cap: 64 },
  { name: 'n4096-8192', kind: 'spec', beats: 8_192, count: 4_096, cap: 64 },
];
export const fixturePlan = (name: string): FixturePlan => {
  const plan = FIXTURES.find(row => row.name === name); assert(plan, `unknown fixture ${name}`); return plan;
};
export const widthCells = (plan: FixturePlan): number => plan.beats * 512;
/** The `one` fixture note. */
export const ONE_NOTE = { channel: 0, cell: 0, pitch: 60, velocity: 100, durationCells: 4 } as const;

/**
 * Mirror of ShadowKneeFixture.decorate, as settled host reads. A null field keeps the host default. A settled
 * gain reads back twice the written value (E2); an immediate read returns the cached written value.
 */
export interface Decoration { gain: number | null; chance: number | null; chanceEnabled: boolean | null; muted: boolean | null }
export function decoration(index: number): Decoration {
  const kind = index % 8, none: Decoration = { gain: null, chance: null, chanceEnabled: null, muted: null };
  if (kind === 4) return none;
  if (kind === 0) return { ...none, chanceEnabled: false };
  if (kind % 4 === 1) return { ...none, gain: 2 * (0.05 + (index * 13 % 90) / 100) };
  if (kind % 4 === 2) return { ...none, chance: 0.1 + (index * 7 % 80) / 100 };
  return { ...none, muted: true };
}

/** One declared note with its full value set. Default fields come from a host read (`defaults`). */
export interface DeclaredNote { channel: number; cell: number; pitch: number; velocity: number; durationCells: number;
  gain: number; chance: number; chanceEnabled: boolean; muted: boolean }
export interface Defaults { gain: number; chance: number; chanceEnabled: boolean; muted: boolean }
export function declaredNotes(plan: FixturePlan, defaults: Defaults): DeclaredNote[] {
  if (plan.kind === 'empty') return [];
  if (plan.kind === 'one') return [{ ...ONE_NOTE, ...defaults }];
  const notes: DeclaredNote[] = [];
  for (let index = 0; index < plan.count; index++) {
    const note = fixtureNote(index, plan.count, widthCells(plan), 0, plan.cap), d = decoration(index);
    notes.push({ ...note, gain: d.gain ?? defaults.gain, chance: d.chance ?? defaults.chance,
      chanceEnabled: d.chanceEnabled ?? defaults.chanceEnabled, muted: d.muted ?? defaults.muted });
  }
  return notes;
}
/** Indexes that `decorate` leaves at host defaults. A host read of one of them gives the defaults. */
export const undecorated = (index: number): boolean => index % 8 === 4;

/** Decoded row columns: channel,cell,pitch,velocity,durationCells,gain,chance,chanceEnabled,muted. */
export type DecodedRow = [number, number, number, number, number, number, number, boolean, boolean];
const noteKey = (channel: number, cell: number, pitch: number): string => `${channel}:${cell}:${pitch}`;
const VALUE_TOLERANCE = 0.005;

/** Compare decoded rows with declared notes on every field. Return issue text; an empty list is exact. */
export function decodeIssues(rows: readonly DecodedRow[], declared: readonly DeclaredNote[], limit = 20): string[] {
  const issues: string[] = [], expected = new Map(declared.map(note => [noteKey(note.channel, note.cell, note.pitch), note]));
  if (rows.length !== declared.length) issues.push(`decoded ${rows.length} notes for ${declared.length} declared`);
  for (const row of rows) {
    if (issues.length >= limit) break;
    const [channel, cell, pitch, velocity, durationCells, gain, chance, chanceEnabled, muted] = row;
    const key = noteKey(channel, cell, pitch), note = expected.get(key);
    if (note === undefined) { issues.push(`foreign note ${key}`); continue; }
    expected.delete(key);
    if (Math.abs(velocity * 127 - note.velocity) >= 0.51) issues.push(`velocity ${velocity} at ${key}`);
    if (durationCells !== note.durationCells) issues.push(`duration ${durationCells} at ${key}`);
    if (Math.abs(gain - note.gain) > VALUE_TOLERANCE) issues.push(`gain ${gain} at ${key}`);
    if (Math.abs(chance - note.chance) > VALUE_TOLERANCE) issues.push(`chance ${chance} at ${key}`);
    if (chanceEnabled !== note.chanceEnabled) issues.push(`chanceEnabled ${String(chanceEnabled)} at ${key}`);
    if (muted !== note.muted) issues.push(`muted ${String(muted)} at ${key}`);
  }
  if (expected.size > 0 && issues.length < limit) issues.push(`${expected.size} declared notes are absent`);
  return issues;
}

/** Compare decoded rows with targeted `getStep` reads of the fixture writer at the same coordinates. */
export function targetedAgreement(rows: readonly DecodedRow[], targeted: readonly Wire[]): string[] {
  const decoded = new Map(rows.map(row => [noteKey(row[0], row[1], row[2]), row]));
  const issues: string[] = [];
  for (const note of targeted) {
    const key = noteKey(Number(note.channel), Number(note.cell), Number(note.pitch)), row = decoded.get(key);
    if (row === undefined) { issues.push(`targeted note ${key} is not decoded`); continue; }
    const same = Math.abs(row[3] - Number(note.velocity)) < 1e-9 && row[4] === note.durationCells && Math.abs(row[5] - Number(note.gain)) < 1e-9
      && Math.abs(row[6] - Number(note.chance)) < 1e-9 && row[7] === note.isChanceEnabled && row[8] === note.isMuted;
    if (!same) issues.push(`targeted note ${key} differs: ${JSON.stringify(row)} vs ${JSON.stringify(note)}`);
  }
  return issues;
}

/** Batch row: firstSeq, firstMs, taskSeq, taskMs, lastCallbackAtTaskMs, confirmSeq, confirmMs. Times are from the arm. */
export type BatchRow = [number, number, number, number, number, number, number];
/** Value row: kind, value, seq, ms, taskSeq, taskMs. */
export type ValueRow = [string, string, number, number, number, number];

/**
 * Completion verdict for one bind. The single-task signal passes when the task of the first batch saw every
 * callback of the binding, its confirmation saw no more, and no cell was delivered twice.
 */
export function completion(epoch: Wire): Wire {
  const batches = epoch.batches as BatchRow[], callbacks = Number(epoch.callbacks);
  assert.equal(epoch.droppedBatches, 0, 'batch list overflow');
  if (callbacks === 0) return { callbacks, batches: 0, singleTask: null, completeMs: null };
  const first = batches[0]!, last = batches.at(-1)!;
  const singleTask = batches.length === 1 && first[2] === callbacks && first[5] === callbacks && Number(epoch.duplicates) === 0;
  return { callbacks, batches: batches.length, singleTask, lateCallbacks: callbacks - first[2],
    bindToFirstMs: Number(epoch.firstCallbackMs), firstToLastMs: Number(epoch.lastCallbackMs) - Number(epoch.firstCallbackMs),
    completeMs: first[3], chainCompleteMs: last[3], confirmMs: first[6], chainSteadyAtTask: last[2] === callbacks };
}

/**
 * Start-signal candidates for one bind. A candidate passes when its target value callback arrived and the task
 * that it scheduled saw every step callback of the binding. Then that task can close the read, also for an
 * empty clip.
 */
export const START_KINDS = ['clipExists', 'loopLength', 'playStop', 'sceneIndex', 'trackChannelId'] as const;
export function startCandidates(epoch: Wire, target: { beats: number; row: number; trackId: string }): Record<string, Wire> {
  const values = epoch.values as ValueRow[], callbacks = Number(epoch.callbacks);
  assert.equal(epoch.droppedValues, 0, 'value list overflow');
  const want: Record<typeof START_KINDS[number], (value: string) => boolean> = {
    clipExists: value => value === 'true', loopLength: value => Number(value) === target.beats,
    playStop: value => Number(value) === target.beats, sceneIndex: value => Number(value) === target.row,
    trackChannelId: value => value === target.trackId,
  };
  const result: Record<string, Wire> = {};
  for (const kind of START_KINDS) {
    const event = values.find(row => row[0] === kind && want[kind](row[1]));
    result[kind] = event === undefined ? { present: false, closes: false }
      : { present: true, seq: event[2], ms: event[3], taskSeq: event[4], taskMs: event[5], closes: event[4] === callbacks };
  }
  return result;
}

/** Aggregate a fixture's trials. */
export function summarizeTrials(trials: readonly Wire[]): Wire {
  const done = trials.map(trial => trial.completion as Wire);
  const populated = done.filter(row => Number(row.callbacks) > 0);
  const kinds: Record<string, Wire> = {};
  for (const kind of START_KINDS) {
    const rows = trials.map(trial => (trial.start as Record<string, Wire>)[kind]!);
    kinds[kind] = { present: rows.filter(row => row.present === true).length, closes: rows.filter(row => row.closes === true).length };
  }
  const range = (values: number[]): Wire | null => values.length === 0 ? null : { min: Math.min(...values), max: Math.max(...values) };
  return {
    trials: trials.length, populated: populated.length,
    singleTaskPass: populated.filter(row => row.singleTask === true).length,
    batchCounts: [...new Set(populated.map(row => Number(row.batches)))].sort((a, b) => a - b),
    callbacks: [...new Set(done.map(row => Number(row.callbacks)))],
    bindToFirstMs: range(populated.map(row => Number(row.bindToFirstMs))),
    firstToLastMs: range(populated.map(row => Number(row.firstToLastMs))),
    completeMs: range(populated.map(row => Number(row.completeMs))),
    decodeExact: trials.filter(trial => (trial.decodeIssues as string[]).length === 0).length,
    start: kinds,
  };
}

/**
 * The step-delta window verdict for a read: refuse when a callback arrives after the completion task, before
 * its confirmation, or after it within the oracle, or when one cell is delivered twice.
 */
export function windowVerdict(epoch: Wire): Wire {
  const batches = epoch.batches as BatchRow[], callbacks = Number(epoch.callbacks);
  if (batches.length === 0) return { refuse: false, reason: 'empty' };
  const first = batches[0]!;
  const reasons: string[] = [];
  if (first[5] !== first[2]) reasons.push('changed-before-confirmation');
  if (batches.length > 1 || first[2] !== callbacks) reasons.push('late-batch');
  if (Number(epoch.duplicates) > 0) reasons.push('duplicate-cell');
  return { refuse: reasons.length > 0, reasons };
}
