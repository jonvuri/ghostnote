/** Shared helpers for spike probes. */
import { BridgeClient } from '../client.js';

export const client = new BridgeClient();

export type Note = [x: number, y: number, vel: number, dur: number];

export interface CursorStatus {
  exists: boolean;
  loopLength: number;
  trackExists: boolean;
  trackName: string;
  trackPosition: number;
  slotExists: boolean;
  sceneIndex: number;
  slotName: string;
  isPinned?: boolean;
  cursorTrackPosition?: number;
  cursorTrackPinned?: boolean;
}

let failures = 0;
export function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  ${JSON.stringify(detail)}` : ''}`);
  if (!ok) failures++;
}
export function note(msg: string) {
  console.log(`      ${msg}`);
}
export function failureCount() {
  return failures;
}

export async function pollUntil(
  predicate: () => Promise<boolean>,
  timeoutMs = 4000,
  intervalMs = 100,
): Promise<{ ok: boolean; ms: number }> {
  const start = Date.now();
  for (;;) {
    if (await predicate()) return { ok: true, ms: Date.now() - start };
    if (Date.now() - start > timeoutMs) return { ok: false, ms: Date.now() - start };
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export async function cursorStatus(cursor: string): Promise<CursorStatus> {
  return (await client.request('cursor.status', { cursor })) as CursorStatus;
}

export async function getNotes(cursor: string): Promise<Note[]> {
  const res = (await client.request('cursor.getNotes', { cursor })) as { notes: Note[] };
  return res.notes;
}

export function sameNotes(a: Note[], b: Note[]): boolean {
  const key = (n: Note) => n.join(',');
  return a.length === b.length && new Set(a.map(key)).size === new Set([...a, ...b].map(key)).size;
}

/** Points cursor `c` at (trackIndex, sceneIndex) using a given mechanism. */
export async function point(
  cursor: string,
  trackIndex: number,
  slotIndex: number,
  mechanism: 'selectClip' | 'slotSelect' | 'trackThenSlot',
): Promise<{ ok: boolean; ms: number }> {
  await client.request('cursor.pin', { cursor, pinned: false });
  switch (mechanism) {
    case 'selectClip':
      await client.request('slot.select', { trackIndex, slotIndex, mechanism: 'slot' });
      await client.request('cursor.pointToClipOf', { cursor, from: 'follower' });
      break;
    case 'slotSelect':
      await client.request('slot.select', { trackIndex, slotIndex, mechanism: 'slot' });
      break;
    case 'trackThenSlot':
      await client.request('cursor.pointTrack', { cursor: Number(cursor), trackIndex });
      await client.request('slot.select', { trackIndex, slotIndex, mechanism: 'track' });
      break;
  }
  return pollUntil(async () => {
    const s = await cursorStatus(cursor);
    return s.exists && s.trackPosition === trackIndex && s.sceneIndex === slotIndex;
  });
}

export interface Fixture {
  trackA: number;
  trackB: number;
  fpA0: Note[];
  fpA1: Note[];
  fpB0: Note[];
}

export const FIXTURE_FPS: Pick<Fixture, 'fpA0' | 'fpA1' | 'fpB0'> = {
  fpA0: [[0, 60, 100, 1]],
  fpA1: [[1, 61, 100, 1]],
  fpB0: [[2, 62, 100, 1]],
};

/** Find gn-A/gn-B tracks if present; create them (at end) if not. */
export async function ensureFixtureTracks(): Promise<{ trackA: number; trackB: number }> {
  const list = async () =>
    (await client.request('track.list')) as { tracks: { index: number; name: string }[]; count: number };

  let { tracks, count } = await list();
  let a = tracks.find((t) => t.name === 'gn-A')?.index;
  let b = tracks.find((t) => t.name === 'gn-B')?.index;

  if (a === undefined) {
    await client.request('track.create', { position: count });
    await pollUntil(async () => (await list()).count === count + 1);
    await client.request('track.setName', { trackIndex: count, name: 'gn-A' });
    a = count;
    count++;
  }
  if (b === undefined) {
    await client.request('track.create', { position: count });
    await pollUntil(async () => (await list()).count === count + 1);
    await client.request('track.setName', { trackIndex: count, name: 'gn-B' });
    b = count;
    count++;
  }

  for (const [trackIndex, slotIndex] of [[a, 0], [a, 1], [b, 0]] as const) {
    const has = async () =>
      ((await client.request('slot.status', { trackIndex, slotIndex })) as { hasContent: boolean }).hasContent;
    if (!(await has())) {
      await client.request('clip.create', { trackIndex, slotIndex, lengthBeats: 4 });
      await pollUntil(has);
    }
  }
  return { trackA: a, trackB: b };
}

/** Point cursor at target, clear, write fingerprint, verify readback. */
export async function stampFingerprint(
  cursor: string,
  trackIndex: number,
  slotIndex: number,
  fp: Note[],
  mechanism: 'selectClip' | 'slotSelect' | 'trackThenSlot',
): Promise<boolean> {
  const p = await point(cursor, trackIndex, slotIndex, mechanism);
  if (!p.ok) return false;
  await client.request('cursor.clearNotes', { cursor });
  await client.request('cursor.setNotes', { cursor, notes: fp });
  const r = await pollUntil(async () => sameNotes(await getNotes(cursor), fp));
  return r.ok;
}
