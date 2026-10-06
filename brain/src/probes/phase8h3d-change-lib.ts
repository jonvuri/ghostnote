/** 8h3d change awareness. Pure helpers for the live driver and its verifiers. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { RawNoteFields } from '../adapters/live/clip-read.js';
import { fixtureNote } from './phase8h1a-knee-lib.js';

export type Wire = Record<string, any>;

export const WATCH_REVISION = '8h3d-watch-v1';
export const RESEARCH_PROFILE = 'phase-8-probe-v1';
/** The probe build after the 8h3e trim. The E231 runs used 100 methods, hash `4232fd6c9f325749`. */
export const RESEARCH_METHODS = 98;
export const RESEARCH_HASH = '659635435255b259';
export const FINGERPRINT_VERSION = 'pull-fp-v1';
export const WATCH_COUNTS = [1, 8, 32] as const;
export const SURVEY_SIZES = [16, 64] as const;
/**
 * Survey and watch clips: 64 tracks with one clip each, at row 0. The 8h3c reader does not bind a requested
 * row other than the row that its cursor holds for that track (8h3d finding), so each target is alone on its track.
 */
export const SINGLE_TRACKS = 64;

/**
 * Typical density: 16 bars, 256 notes, one note every 1/4 beat, each 1/8 beat long, on all 16 channels.
 * The even-spread writer gives 16,321 sounding cells: the last note ends at the clip end.
 */
export const TYPICAL = { beats: 64, count: 256, cap: 64 } as const;
export const typicalWidth = TYPICAL.beats * 512;

/** The E227 fixture sizes. `spec` uses the even-spread writer; `one` is one note; `empty` has no note. */
export interface SizePlan { name: string; kind: 'empty' | 'one' | 'spec'; beats: number; count: number; cap: number }
export const SIZES: readonly SizePlan[] = [
  { name: 'empty-64', kind: 'empty', beats: 64, count: 0, cap: 64 },
  { name: 'one-64', kind: 'one', beats: 64, count: 1, cap: 64 },
  { name: 'final-8192', kind: 'spec', beats: 8_192, count: 1, cap: 64 },
  { name: 'n4096-64', kind: 'spec', beats: 64, count: 4_096, cap: 64 },
  { name: 'n16384-512', kind: 'spec', beats: 512, count: 16_384, cap: 64 },
  { name: 'n4096-8192', kind: 'spec', beats: 8_192, count: 4_096, cap: 64 },
  { name: 'n131072-2048', kind: 'spec', beats: 2_048, count: 131_072, cap: 4 },
  { name: 'sustain-2048', kind: 'spec', beats: 2_048, count: 16_384, cap: 64 },
];
export const ONE_NOTE = { channel: 0, cell: 0, pitch: 60, velocity: 100, durationCells: 4 } as const;

/** Declared notes as `[channel, cell, pitch, velocity, durationCells]`, sorted. */
export function declared(plan: Pick<SizePlan, 'kind' | 'beats' | 'count' | 'cap'>): number[][] {
  if (plan.kind === 'empty') return [];
  if (plan.kind === 'one') return [[ONE_NOTE.channel, ONE_NOTE.cell, ONE_NOTE.pitch, ONE_NOTE.velocity, ONE_NOTE.durationCells]];
  const rows: number[][] = [];
  for (let i = 0; i < plan.count; i++) {
    const n = fixtureNote(i, plan.count, plan.beats * 512, 0, plan.cap);
    rows.push([n.channel, n.cell, n.pitch, n.velocity, n.durationCells]);
  }
  return rows.sort(byNote);
}

const byNote = (a: readonly number[], b: readonly number[]): number => a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!;

/** Compact rows from decoded reader rows. Velocity is MIDI; duration is in 1/512 cells. */
export function compact(rows: readonly RawNoteFields[]): number[][] {
  return rows.map(row => [Number(row.channel), Number(row.cell), Number(row.pitch),
    Math.round(Number(row.velocity) * 127), Math.round(Number(row.duration) * 512)]).sort(byNote);
}

/** Issues between decoded rows and a declared plan. An empty list is an exact match. */
export function declaredIssues(rows: readonly RawNoteFields[], plan: Pick<SizePlan, 'kind' | 'beats' | 'count' | 'cap'>, limit = 10): string[] {
  const got = compact(rows), want = declared(plan), issues: string[] = [];
  if (got.length !== want.length) issues.push(`count ${got.length} for ${want.length}`);
  for (let i = 0; i < Math.min(got.length, want.length) && issues.length < limit; i++) {
    if (got[i]!.join() !== want[i]!.join()) issues.push(`row ${i}: ${got[i]!.join()} for ${want[i]!.join()}`);
  }
  return issues;
}

/**
 * Versioned pull fingerprint. Input: every raw field of each note, sorted by channel, cell, and pitch, and the
 * bound clip extent. It excludes read IDs, timings, and callback counts. Equality is a content witness only.
 */
export function snapshotFingerprint(rows: readonly RawNoteFields[], bound: Wire): string {
  const notes = [...rows].map(row => Object.keys(row).sort().map(key => [key, row[key]]))
    .sort((a, b) => {
      const get = (r: unknown[][], k: string): number => Number(r.find(([key]) => key === k)![1]);
      return get(a, 'channel') - get(b, 'channel') || get(a, 'cell') - get(b, 'cell') || get(a, 'pitch') - get(b, 'pitch');
    });
  const extent = [bound.loopStartBeats, bound.loopEndBeats, bound.playStopBeats];
  return createHash('sha256').update(JSON.stringify([FINGERPRINT_VERSION, extent, notes])).digest('hex');
}

/** Keys whose fingerprint differs from the baseline. A missing survey key is stale. */
export function staleKeys(baseline: ReadonlyMap<string, string>, survey: ReadonlyMap<string, string>): string[] {
  return [...baseline.keys()].filter(key => survey.get(key) !== baseline.get(key)).sort();
}

/**
 * Agent-facing result proxy for one clip. A current snapshot needs only its reference and verdict. A stale
 * snapshot needs a fresh snapshot before a patch: here the compact rows. This is a size proxy, not the 8h4 format.
 */
export function agentResult(clip: string, fingerprint: string, current: boolean, rows?: readonly RawNoteFields[]): string {
  return JSON.stringify(current ? { clip, fingerprint, current } : { clip, fingerprint, current, notes: compact(rows ?? []) });
}

/** Value observers whose callback count is not zero since the mark. The flat-bank count is separate. */
export function changedValues(status: Wire): string[] {
  const names = Object.entries(status.values as Record<string, Wire>).filter(([, v]) => Number(v.count) > 0).map(([k]) => k);
  if (Number(status.flatBankContentEvents) > 0) names.push('flatBank.hasContent');
  return names.sort();
}

/**
 * Edit-to-stale time. `sent` and `received` are brain clock values; `agoMs` is the extension age of the first
 * change at the reply. The transit time of the status reply is not subtracted.
 */
export function editToStaleMs(sent: number, received: number, agoMs: number): number {
  assert(agoMs >= 0, 'no change recorded');
  return received - agoMs - sent;
}

/** The research rig config. It adds the watch cursors and the knee fixture writer at the reader width. */
export function researchConfig(): Wire {
  return { recordChars: 0, stamp: '8h3d-change', tracks: 96, scenes: 16, contentFilter: 'ALL_CHANNELS',
    cacheKneeResearch: true, cacheShadowSteps: 4_194_304, changeWatchCursors: 32 };
}

export const median = (values: readonly number[]): number => {
  const s = [...values].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length === 0 ? NaN : s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
