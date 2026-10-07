/**
 * 8h4b2 host note defaults and gain meaning. Live driver. Use an owned unsaved project; refuse the saved anchor (D29).
 * The operator does each editor step. The driver waits for a flag file `<dir>/go-<step>` after each instruction.
 *
 *   probe <dir>   create gn-8h4b2-gain with an empty 8-beat clip in row 0. Then:
 *                 draw  - the operator draws five notes in the editor; read their raw fields (host insertion defaults);
 *                 gain  - the operator sets inspector gain on notes 1-4; read the raw gain of each note;
 *                 sweep - the driver writes five notes in row 1 with setter gain 0, 0.25, 0.5, 0.75, and 1; read them.
 *                         The operator reports the inspector display of each note in the evidence.
 *   verify-offline <dir>   project the retained raw rows through the binding and check them against the
 *                          operator reports (E245)
 */
import assert from 'node:assert/strict';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { decodeNoteFrame, type NoteFrame, type RawNoteFields } from '../adapters/live/clip-read.js';
import { clip, scene, slot, track, type ClipAddress } from '../contract/index.js';
import type { E131Context } from './e131-diagnostic.js';
import { WireTransport } from './phase8h3c-promotion.js';
import { projectRawClip, type RawNote } from '../bindings/ghostnote-document.js';
import { NORMAL, type Wire } from './phase8h4b-document-read-lib.js';

const PAGE = 131_072;
const ANCHOR = 'gn-scale-test';
const NAME = 'gn-8h4b2-gain';
const SWEEP = [0, 0.25, 0.5, 0.75, 1] as const;
const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const request = async (method: string, params?: Wire): Promise<Wire> =>
  await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
const pause = async (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
const say = (value: Wire): void => console.log(JSON.stringify(value));

async function until(next: () => Promise<Wire>, done: (value: Wire) => boolean, limit = 30_000): Promise<Wire> {
  const started = performance.now();
  for (;;) {
    const value = await next(); if (done(value)) return value;
    assert(performance.now() - started < limit, `live state did not settle: ${JSON.stringify(value).slice(0, 400)}`);
    await pause(50);
  }
}
async function indexOf(id: string): Promise<number> {
  const found = ((await request('track.list')).tracks as Wire[]).find(row => row.channelId === id);
  assert(found !== undefined, `track ${id} is missing`);
  return Number(found.index);
}
async function clipOf(id: string, row: number): Promise<ClipAddress> {
  return clip(slot(track(id), scene(row, (await adapter.revision()).sceneEpoch)));
}
async function rawRead(id: string, row: number): Promise<RawNoteFields[]> {
  const index = await indexOf(id);
  let result = await request('clip.read', { trackIndex: index, row, channelId: id });
  for (let attempt = 0; result.refused !== undefined && attempt < 5; attempt++) {
    await pause(500);
    result = await request('clip.read', { trackIndex: index, row, channelId: id });
  }
  assert.equal(result.refused, undefined, `raw read refused: ${result.refused} ${result.message ?? ''}`);
  const rows: RawNoteFields[] = [];
  let frame = result.frame as NoteFrame;
  for (;;) {
    rows.push(...decodeNoteFrame(frame, PAGE));
    if (frame.next < 0) break;
    frame = await request('clip.readPage', { readId: result.readId, from: frame.next }) as NoteFrame;
  }
  return rows.sort((a, b) => Number(a.cell) - Number(b.cell) || Number(a.pitch) - Number(b.pitch));
}
/** Wait for the operator: print the instruction, then wait for the flag file. */
async function operator(dir: string, step: string, instruction: string): Promise<void> {
  say({ operator: step, instruction, flag: join(dir, `go-${step}`) });
  for (;;) {
    try { await access(join(dir, `go-${step}`)); return; } catch { await pause(500); }
  }
}
async function emptyClip(index: number, row: number, lengthBeats: number): Promise<void> {
  if ((await request('slot.status', { trackIndex: index, slotIndex: row })).hasContent === true) {
    await request('slot.delete', { trackIndex: index, slotIndex: row });
    await until(() => request('slot.status', { trackIndex: index, slotIndex: row }), value => value.hasContent !== true);
  }
  await request('clip.create', { trackIndex: index, slotIndex: row, lengthBeats });
  await until(() => request('slot.status', { trackIndex: index, slotIndex: row }), value => value.hasContent === true);
}

async function probe(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], NORMAL);
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project) && mark.project !== ANCHOR, `use an owned unsaved project, got ${mark.project}`);
  await adapter.hello();
  let found = ((await request('track.list')).tracks as Wire[]).find(row => row.name === NAME);
  if (found === undefined) {
    const before = new Set(((await request('track.list')).tracks as Wire[]).map(row => row.channelId));
    await request('track.create', { position: 0 });
    const after = await until(() => request('track.list'),
      value => (value.tracks as Wire[]).some(row => row.index === 0 && !before.has(row.channelId)));
    found = (after.tracks as Wire[]).find(row => row.index === 0)!;
    await request('track.setName', { trackIndex: 0, name: NAME });
  }
  const id = String(found.channelId);
  const out: Wire = { schema: 'phase8h4b2-defaults-v1', hello, mark, trackId: id };
  await emptyClip(await indexOf(id), 0, 8);

  await operator(dir, 'draw', `In ${NAME} row 1 (scene 1), open the empty clip in the editor. Draw five notes with the `
    + 'pencil at pitch C3 (60): one note on each of beats 1.1.1, 1.2.1, 1.3.1, 1.4.1, and 2.1.1. Change nothing else.');
  out.draw = await rawRead(id, 0);
  say({ step: 'draw', rows: out.draw });
  assert.equal(out.draw.length, 5, 'expected five drawn notes');

  await operator(dir, 'gain', 'In the note inspector, set the gain of note 1 to -inf dB, note 2 to -6 dB, note 3 '
    + 'to 0 dB (type 0 even if it shows 0), and note 4 to +6 dB. Leave note 5 unchanged. Then report the gain that '
    + 'note 5 displays, and the highest gain that the inspector accepts.');
  out.gain = await rawRead(id, 0);
  say({ step: 'gain', gains: out.gain.map((row: RawNoteFields) => [row.cell, row.gain]) });

  const index = await indexOf(id);
  await emptyClip(index, 1, 8);
  await (adapter as unknown as E131Context).pointAtClip(await clipOf(id, 1), index, new Map(), 'fine');
  await request('cursor.setStepSize', { cursor: 'fine', stepSize: 1 });
  await request('cursor.setNotes', { cursor: 'fine', channel: 0, notes: SWEEP.map((_, x) => [x, 60, 100, 0.5]) });
  await pause(500);
  for (const [x, gain] of SWEEP.entries()) {
    await request('cursor.setNoteProps', { cursor: 'fine', channel: 0, x, y: 60, props: { gain } });
    await pause(300);
  }
  await pause(500);
  out.sweep = { setter: SWEEP, rows: await rawRead(id, 1) };
  say({ step: 'sweep', pairs: out.sweep.rows.map((row: RawNoteFields, i: number) => [SWEEP[i], row.gain]) });
  await operator(dir, 'sweep', `In ${NAME} row 2 (scene 2), select each of the five notes in turn and report the gain `
    + 'that the inspector displays.');

  await writeFile(join(dir, 'probe.json.gz'), gzipSync(JSON.stringify(out) + '\n'));
  say({ done: join(dir, 'probe.json.gz') });
}

/** The inspector gain of each note, as the operator reported it (2026-10-07). `null` is -inf dB. */
export const OPERATOR_REPORTS = {
  gain: [null, -6, 0, 6, 0],
  sweep: [0, -18.1, 0, 10.6, 18.1],
  maximumDb: 18.1,
} as const;

function rawNote(row: RawNoteFields, index: number): RawNote {
  const n = (name: string): number => Number(row[name]);
  return {
    id: `n${index}`, channel: n('channel'), at: n('cell') / 512, duration: n('duration'), pitch: n('pitch'),
    velocity: Math.round(n('velocity') * 127), mute: row['isMuted'] === true, releaseVelocity: n('releaseVelocity'),
    expression: { velocitySpread: n('velocitySpread'), gain: n('gain'), pan: n('pan'), pressure: n('pressure'),
      timbre: n('timbre'), transpose: n('transpose') },
    chance: { enabled: row['isChanceEnabled'] === true, value: n('chance') },
    occurrence: { enabled: row['isOccurrenceEnabled'] === true, condition: String(row['occurrence']) },
    recurrence: { enabled: row['isRecurrenceEnabled'] === true, length: n('recurrenceLength'), mask: n('recurrenceMask') },
  };
}
function project(rows: readonly RawNoteFields[]) {
  const clip = { id: 'c1', length: '8', name: '', loop: { from: '0', to: '8' } };
  return projectRawClip(clip, rows.map(rawNote)).document.events;
}

/** Recompute every E245 claim from the artifact. */
export function verify(a: Wire): { issues: string[]; summary: Wire } {
  const issues: string[] = [];
  const required = ['at', 'clip', 'duration', 'id', 'pitch', 'velocity'];
  for (const event of project(a.draw)) {
    if (JSON.stringify(Object.keys(event).sort()) !== JSON.stringify(required)) issues.push(`drawn ${event.id} has ${Object.keys(event)}`);
  }
  for (const row of a.draw as RawNoteFields[]) {
    if (row.releaseVelocity !== 100 / 127 || row.gain !== 0) issues.push(`drawn raw ${JSON.stringify(row)}`);
  }
  // The inspector shows 60*log10(raw) dB; raw 0 shows 0 dB on a drawn note and -inf on an edited one.
  const shown = (raw: number): number | null => raw === 0 ? null : Math.round(600 * Math.log10(raw)) / 10;
  const gainRaw = (a.gain as RawNoteFields[]).map((row) => Number(row.gain));
  gainRaw.forEach((raw, index) => {
    const reported = OPERATOR_REPORTS.gain[index]!;
    if (raw === 0 ? reported !== null && reported !== 0 : Math.abs(shown(raw)! - reported) > 0.05) {
      issues.push(`gain note ${index + 1}: raw ${raw}, reported ${reported}`);
    }
  });
  const sweepRaw = (a.sweep.rows as RawNoteFields[]).map((row) => Number(row.gain));
  sweepRaw.forEach((raw, index) => {
    if (raw !== 2 * a.sweep.setter[index]) issues.push(`sweep ${index}: raw ${raw} is not twice the setter`);
    const reported = OPERATOR_REPORTS.sweep[index]!;
    if (raw === 0 ? reported !== 0 : Math.abs(shown(raw)! - reported) > 0.05) issues.push(`sweep ${index}: reported ${reported}`);
  });
  const portable = (rows: readonly RawNoteFields[]) => project(rows).map((event) => event.expression?.gain ?? 1);
  const summary = { gainRaw, gainPortable: portable(a.gain), sweepRaw, sweepPortable: portable(a.sweep.rows) };
  if (JSON.stringify(summary.sweepPortable) !== JSON.stringify([1, 0.125, 1, 3.375, 8])) issues.push('sweep projection');
  return { issues, summary };
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === 'probe') await probe(args[0]!);
    else if (command === 'verify-offline') {
      const a = JSON.parse(gunzipSync(await readFile(join(args[0]!, 'probe.json.gz'))).toString('utf8'));
      const result = verify(a);
      console.log(JSON.stringify(result, null, 1)); if (result.issues.length > 0) process.exitCode = 1;
    } else throw new Error('usage: probe <dir> | verify-offline <dir>');
  } finally { await transport.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
