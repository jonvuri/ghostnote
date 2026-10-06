/** 8h3e pure checks: the expected D32 verdict from an independent raw read, and the retained-artifact checks. */
import { isDeepStrictEqual } from 'node:util';
import { notesByChannel, type RawNoteFields } from '../adapters/live/clip-read.js';
import type { ContentDelta, NoteRecord, RevisionMark } from '../contract/index.js';

export type Wire = Record<string, any>;
export const SCHEMA = 'phase8h3e-snapshots-v1';
export const NORMAL: readonly [string, number, string] = ['normal-v1', 87, 'ca139a3e62a55e68'];
export const PROBE: readonly [string, number, string] = ['phase-8-probe-v1', 98, '659635435255b259'];

/** One independent raw read: the decoded `clip.read` rows and its bound extent, or an absent clip. */
export interface RawClip {
  readonly present: boolean;
  readonly rows: readonly RawNoteFields[];
  readonly extent: readonly number[];
}

/** E231 typical density: 256 notes, one every 1/4 beat, each 1/8 beat long, channel by index, in 64 beats. */
export function typicalNotes(offset = 0): number[][][] {
  return Array.from({ length: 16 }, (_, channel) => Array.from({ length: 16 }, (_, k) => k * 16 + channel)
    .map(i => [i, 36 + ((i + offset) % 48), 100, 0.125]));
}

const order = (a: RawNoteFields, b: RawNoteFields): number =>
  Number(a.channel) - Number(b.channel) || Number(a.cell) - Number(b.cell) || Number(a.pitch) - Number(b.pitch);
/** Equal raw content: every raw field of every note, and the bound extent. */
export function sameRaw(a: RawClip, b: RawClip): boolean {
  return a.present === b.present && isDeepStrictEqual(a.extent, b.extent)
    && isDeepStrictEqual([...a.rows].sort(order), [...b.rows].sort(order));
}

/** The raw rows as contract channels, for comparison with a returned snapshot. */
export function rawChannels(raw: RawClip): NoteRecord[][] {
  const channels = notesByChannel(raw.rows);
  return Array.from({ length: 16 }, (_, channel) => channels.get(channel) ?? []);
}

/**
 * The D32 verdict that the guards and an independent raw read require. It does not use the adapter fingerprint.
 * `before` is the raw read at the reference mark; `after` is the raw read at use time.
 */
export function expectedVerdict(input: {
  mark: RevisionMark; now: RevisionMark; delta: ContentDelta; channelId: string; row: number;
  before: RawClip; after: RawClip; trackFound: boolean;
}): string {
  const { mark, now, delta } = input;
  if (mark.generation !== now.generation || mark.project !== now.project || mark.project === '' || delta.discontinuous) {
    return 'incomparable';
  }
  const covers = (m: RevisionMark): boolean => [m.window.tracks, m.window.scenes].every(c => c.count >= 0 && c.count <= c.bankSize);
  if (!covers(mark) || !covers(now) || delta.uncovered) return 'uncovered';
  if (mark.sceneEpoch !== now.sceneEpoch || mark.window.scenes.count !== now.window.scenes.count) return 'identity-changed';
  if (delta.truncated || delta.events.some(e => e.channelId === '')
    || delta.events.some(e => e.channelId === input.channelId && e.slotIndex === input.row)) return 'identity-changed';
  if (!input.trackFound || !input.after.present) return 'absent';
  return sameRaw(input.before, input.after) ? 'current' : 'stale';
}

/** Recompute one retained case. Returns the issues; an empty list passes. */
export function caseIssues(c: Wire): string[] {
  const issues: string[] = [];
  const expected = expectedVerdict({ mark: c.mark, now: c.now, delta: c.delta, channelId: c.channelId, row: c.row,
    before: c.before, after: c.after, trackFound: c.trackFound });
  if (expected !== c.expected) issues.push(`${c.label}: recomputed ${expected}, recorded ${c.expected}`);
  if (c.verdict !== expected) issues.push(`${c.label}: verdict ${c.verdict}, expected ${expected}`);
  if (c.verdict === 'stale') {
    if (!isDeepStrictEqual(c.newChannels, rawChannels(c.after))) issues.push(`${c.label}: new snapshot differs from the raw read`);
    if (c.recheck !== 'current') issues.push(`${c.label}: new snapshot rechecks as ${c.recheck}`);
  } else if (c.newChannels !== undefined) {
    issues.push(`${c.label}: a ${c.verdict} verdict returned a snapshot`);
  }
  return issues;
}
