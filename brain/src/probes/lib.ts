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

/**
 * Ask the human a question and wait for the answer.
 *
 * E6, E7 and E8b all needed a user at the keyboard and handled it with a fixed
 * `setTimeout`, which works when the interaction is "interfere for 16 seconds"
 * and not when it is "click this button, then tell me what you saw". E14 is
 * almost entirely the latter — several of its rows have no programmatic
 * observable at all, because the question is what Bitwig DREW.
 *
 * Answers are echoed into the transcript, which is deliberate: a row whose
 * verdict is a human report should carry that report verbatim into FINDINGS
 * rather than being summarised into a bare ●/○ by whoever writes it up.
 */
export async function ask(question: string): Promise<string> {
  // ⚠ Refuse rather than answer when there is nobody there. With stdin closed or
  // piped, readline resolves immediately with '' — and `askYesNo` reads that as
  // a confident NO, which is a human verdict fabricated out of an empty pipe.
  // E16 rows E1/E5 are decided by what the user HEARD, so a row that silently
  // invents its own answer is the rows-A-C trap-6 failure in another costume.
  if (!process.stdin.isTTY) {
    throw new Error(
      'this probe needs a human at the keyboard, but stdin is not a TTY.\n'
      + '     Run it directly in your own terminal:  npm run probe:<name>',
    );
  }
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(`\n  ?  ${question}\n     > `)).trim();
  } finally {
    rl.close();
  }
}

/** `ask`, narrowed to yes/no. Anything not beginning with `y` is a no. */
export async function askYesNo(question: string): Promise<boolean> {
  const answer = await ask(`${question} [y/N]`);
  return answer.toLowerCase().startsWith('y');
}

/** Pause until the human has done something in Bitwig. */
export async function waitForEnter(instruction: string): Promise<void> {
  await ask(`${instruction}\n     (press Enter when done)`);
}

/**
 * A `client.request` that remembers what it was doing when the bridge died.
 *
 * ⚠ Born in `e14-ui.ts` after row A1 killed Bitwig mid-run and the probe died
 * with a bare `Connection closed with request 17 in flight` — true, and useless:
 * it buried the finding under a stack trace and named no suspect. A probe of ◐
 * doc-only surface should EXPECT to find a fatal call, so a dropped connection
 * is a RESULT here rather than an accident, and it deserves to be reported like
 * one.
 *
 * Lifted out of that probe when E14 rows H and I needed the same guard. The
 * original keeps its inline copy: it is the record of a sitting that already
 * happened, and rewriting it would edit history to save 20 lines.
 */
export function trackedRequest(): (method: string, params?: Record<string, unknown>) => Promise<unknown> {
  let lastMethod = '(none yet)';
  for (const signal of ['uncaughtException', 'unhandledRejection'] as const) {
    process.on(signal, (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Connection closed') || message.includes('ECONNREFUSED')) {
        console.log(`\n${'!'.repeat(72)}`);
        console.log(` THE BRIDGE DIED during "${lastMethod}".`);
        console.log('');
        console.log(' Something in that call took the extension — or Bitwig — down. That is');
        console.log(' a finding, not a bug in the probe: check whether Bitwig is still');
        console.log(' running, then read the crash report at');
        console.log('   ~/Library/Application Support/Bitwig/Bitwig Studio/crash-report/');
        console.log(' Record the verdict for that row and do NOT simply re-run the call.');
        console.log('!'.repeat(72));
      } else {
        console.log(`\nunexpected failure after "${lastMethod}": ${message}`);
      }
      process.exit(1);
    });
  }
  return async (method, params) => {
    lastMethod = method;
    return client.request(method, params);
  };
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
      await client.request('cursor.pointTrack', { cursor, trackIndex });
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

type TrackRow = { index: number; name: string; position: number; type: string };

/**
 * Find gn-A/gn-B tracks if present; create them if not.
 *
 * E2c lessons baked in: the flat bank includes FX/Master rows at the tail;
 * createInstrumentTrack(position) does not honor bank positions; default
 * names auto-renumber. So: match fixtures by name AND type=Instrument;
 * after creating, locate the new track as the LAST Instrument-type row
 * (end-requests land at the end of the regular section); poll-verify the
 * rename landed there.
 */
export async function ensureFixtureTracks(): Promise<{ trackA: number; trackB: number }> {
  const list = async () =>
    (await client.request('track.list')) as { tracks: TrackRow[]; count: number };

  const findFixture = (tracks: TrackRow[], name: string) =>
    tracks.find((t) => t.name === name && t.type === 'Instrument')?.index;

  async function createFixtureTrack(name: string): Promise<number> {
    const before = await list();
    await client.request('track.create', { position: before.count });
    await pollUntil(async () => (await list()).count === before.count + 1);

    const after = await list();
    const instruments = after.tracks.filter((t) => t.type === 'Instrument');
    const target = instruments[instruments.length - 1];
    if (!target) throw new Error('created track not found among Instrument rows');

    await client.request('track.setName', { trackIndex: target.index, name });
    const renamed = await pollUntil(async () => {
      const l = await list();
      const row = l.tracks.find((t) => t.index === target.index);
      return row?.name === name && row.type === 'Instrument';
    });
    if (!renamed.ok) throw new Error(`rename of created track to ${name} did not verify`);
    return target.index;
  }

  let { tracks } = await list();
  let a = findFixture(tracks, 'gn-A');
  let b = findFixture(tracks, 'gn-B');

  if (a === undefined) a = await createFixtureTrack('gn-A');
  if (b === undefined) b = await createFixtureTrack('gn-B');

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
