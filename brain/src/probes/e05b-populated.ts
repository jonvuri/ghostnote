/**
 * E5b — Scale limits against a POPULATED project.
 *
 * E5's sweep ran on a ~6-track project, where most bank rows point at nothing
 * and therefore cost nothing: it measured scaffold allocation, not scaffold
 * load. This probe builds a realistically-sized project (48 instrument tracks
 * × 8 clip-bearing scenes) in a scratch project and re-measures at several
 * bank sizes, so the shipped-size decision rests on loaded numbers.
 *
 * Also demonstrates the bank-window constraint on a project big enough for it
 * to bite: with TRACKS=32 and 54 real tracks, the tail is unaddressable —
 * channelId (E2f) resolves only inside the window.
 *
 * ⚠ RUN IN A SCRATCH PROJECT. Creates ~48 tracks. Teardown deletes exactly
 * the channelIds it created (E2f set-difference — never positional), and
 * leaves the baseline rig config installed.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  client, check, note, failureCount, pollUntil, point, getNotes, sameNotes,
  ensureFixtureTracks,
} from './lib.js';

const CONFIG_PATH = path.join(os.homedir(), '.ghostnote', 'rig.json');
const JAR = path.resolve('../extension/build/libs/ghostnote-0.0.1.bwextension');
const DEPLOYED = path.join(
  os.homedir(), 'Documents', 'Bitwig Studio', 'Extensions', 'ghostnote-0.0.1.bwextension');

const NEW_TRACKS = 48;
const SCENES_USED = 8;
const CLIP_BEATS = 4;

interface Cfg { stamp: string; tracks: number; scenes: number }
interface RigStats {
  config: Cfg & { fromFile: boolean };
  rigConstructMicros: number; initMicros: number; upMs: number;
  slotObjects: number; heapUsedMb: number;
}
interface ScanResult {
  scanMicros: number; existing: number; withChannelId: number;
  slotsWithContent: number; sceneCount: number;
}
type TrackRow = { index: number; name: string; position: number; type: string; channelId: string };

const stats = async () => (await client.request('rig.stats')) as RigStats;
const scan = async () => (await client.request('rig.scanTracks')) as ScanResult;
const list = async () =>
  (await client.request('track.list')) as { tracks: TrackRow[]; count: number };

async function reload(cfg: Cfg): Promise<number> {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg));
  client.disconnect();
  const start = Date.now();
  execFileSync('cp', [JAR, DEPLOYED]);
  for (;;) {
    if (Date.now() - start > 90_000) throw new Error(`bridge did not return for ${cfg.stamp}`);
    try {
      if ((await stats()).config.stamp === cfg.stamp) return Date.now() - start;
    } catch { /* bridge still down */ }
    client.disconnect();
    await new Promise((r) => setTimeout(r, 250));
  }
}

/**
 * Time from bridge-up until the bank has streamed in its tracks, their
 * channelIds and their clip content. Polled at 10ms so the metric's own floor
 * (~30ms) stays well below anything we'd call a cost.
 */
async function warmup(): Promise<{ ms: number; final: ScanResult }> {
  const start = Date.now();
  let stable = 0;
  let sig = '';
  let final = await scan();
  while (Date.now() - start < 60_000) {
    final = await scan();
    const s = `${final.existing}/${final.withChannelId}/${final.slotsWithContent}`;
    const ready = final.existing > 0 && final.withChannelId === final.existing;
    stable = ready && s === sig ? stable + 1 : 0;
    sig = s;
    if (stable >= 3) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  return { ms: Date.now() - start, final };
}

async function pingLatency(n = 100) {
  const samples: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = process.hrtime.bigint();
    await client.request('ping');
    samples.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  samples.sort((a, b) => a - b);
  return { p50: samples[Math.floor(n * 0.5)], p95: samples[Math.floor(n * 0.95)], max: samples[n - 1] };
}

await client.connect();
console.log('connected — E5b populated-project scale test\n');

// ------------------------------------------------- 1. room to build in
await reload({ stamp: 'e05b-build', tracks: 128, scenes: 128 });
await warmup();

const fixture = await ensureFixtureTracks();
const before = await list();
const baselineIds = new Set(before.tracks.map((t) => t.channelId));
note(`baseline project: ${before.count} tracks — these are PRESERVED by teardown`);

const haveScenes = (await scan()).sceneCount;
if (haveScenes < SCENES_USED) {
  await client.request('scene.create', { count: SCENES_USED - haveScenes });
  await pollUntil(async () => (await scan()).sceneCount >= SCENES_USED);
}
note(`scenes available: ${(await scan()).sceneCount}`);

// ------------------------------------------------- 2. populate
console.log(`\n-- populating: +${NEW_TRACKS} instrument tracks × ${SCENES_USED} clips`);
const tCreate = Date.now();
for (let i = 0; i < NEW_TRACKS; i++) {
  await client.request('track.create', { position: before.count + i });
}
const grew = await pollUntil(async () => (await list()).count >= before.count + NEW_TRACKS, 120_000, 250);
check(`${NEW_TRACKS} tracks created`, grew.ok, { ms: Date.now() - tCreate, count: (await list()).count });

const after = await list();
const created = after.tracks.filter((t) => !baselineIds.has(t.channelId));
const createdIds = created.map((t) => t.channelId);
check('created tracks identified by channelId set-difference (never by position)',
  createdIds.length === NEW_TRACKS, { identified: createdIds.length });

const tClips = Date.now();
for (const t of created) {
  for (let s = 0; s < SCENES_USED; s++) {
    await client.request('clip.create', { trackIndex: t.index, slotIndex: s, lengthBeats: CLIP_BEATS });
  }
}
const wantContent = created.length * SCENES_USED;
const filled = await pollUntil(async () => (await scan()).slotsWithContent >= wantContent, 120_000, 250);
const loaded = await scan();
check('clips created across the new tracks', filled.ok,
  { ms: Date.now() - tClips, slotsWithContent: loaded.slotsWithContent, wanted: wantContent });
note(`populated project: ${loaded.existing} tracks, ${loaded.slotsWithContent} clips`);

// ------------------------------------------------- 3. re-measure loaded
const MEASURE: Cfg[] = [
  { stamp: 'p0-32x32-undersized', tracks: 32, scenes: 32 },
  { stamp: 'p1-64x64', tracks: 64, scenes: 64 },
  { stamp: 'p2-128x128', tracks: 128, scenes: 128 },
  { stamp: 'p3-256x128', tracks: 256, scenes: 128 },
];

interface Row {
  stamp: string; bank: string; reloadMs: number; constructMs: number; initMs: number;
  warmupMs: number; scanMicros: number; p50: number; p95: number; max: number;
  heapMb: number; visible: number; clips: number; functional: string;
}
const rows: Row[] = [];

console.log('\n-- measuring against the populated project');
for (const cfg of MEASURE) {
  const reloadMs = await reload(cfg);
  const w = await warmup();
  const s = await stats();
  const lat = await pingLatency();
  const steady = await scan();

  let functional = 'n/a';
  const fx = await list();
  const gnA = fx.tracks.find((t) => t.name === 'gn-A' && t.type === 'Instrument');
  if (!gnA) {
    functional = 'fixture-outside-bank';
  } else {
    const fp: [number, number, number, number][] = [[0, 60, 100, 1]];
    const p = await point('0', gnA.index, 0, 'trackThenSlot');
    if (!p.ok) functional = 'POINT-FAILED';
    else {
      await client.request('cursor.clearNotes', { cursor: '0' });
      await client.request('cursor.setNotes', { cursor: '0', notes: fp });
      functional = (await pollUntil(async () => sameNotes(await getNotes('0'), fp))).ok
        ? 'ok' : 'READBACK-FAILED';
    }
  }

  rows.push({
    stamp: cfg.stamp, bank: `${cfg.tracks}×${cfg.scenes}`, reloadMs,
    constructMs: s.rigConstructMicros / 1000, initMs: s.initMicros / 1000,
    warmupMs: w.ms, scanMicros: steady.scanMicros,
    p50: lat.p50, p95: lat.p95, max: lat.max, heapMb: s.heapUsedMb,
    visible: steady.existing, clips: steady.slotsWithContent, functional,
  });
  note(`${cfg.stamp}: reload ${reloadMs}ms | construct ${(s.rigConstructMicros / 1000).toFixed(1)}ms | ` +
    `warmup ${w.ms}ms | scan ${steady.scanMicros}µs | ping p50 ${lat.p50.toFixed(1)} p95 ${lat.p95.toFixed(1)} | ` +
    `visible ${steady.existing} tracks / ${steady.slotsWithContent} clips | ${functional}`);
}

// ------------------------------------------------- 4. the window constraint
console.log('\n-- bank-window constraint on a project that actually exceeds the window');
const undersized = rows.find((r) => r.stamp.startsWith('p0'));
const sized = rows.find((r) => r.stamp.startsWith('p2'));
if (undersized && sized) {
  check('an undersized bank makes the project TAIL unaddressable (hard cap, not a perf knob)',
    undersized.visible < sized.visible,
    { bank: undersized.bank, visible: undersized.visible, actual: sized.visible,
      hidden: sized.visible - undersized.visible });
  check('tracks outside the window also hide their clips (checkpoint blind spot)',
    undersized.clips < sized.clips, { visible: undersized.clips, actual: sized.clips });
}

// ------------------------------------------------- 5. teardown
console.log('\n-- teardown: deleting exactly the created channelIds');
await reload({ stamp: 'e05b-teardown', tracks: 128, scenes: 128 });
await warmup();

let deleted = 0;
for (const id of createdIds) {
  const r = (await client.request('track.resolveByChannelId', { channelId: id })) as
    { found: boolean; index?: number };
  if (!r.found) continue;
  await client.request('track.delete', { trackIndex: r.index });
  const gone = await pollUntil(async () =>
    !((await client.request('track.resolveByChannelId', { channelId: id })) as { found: boolean }).found,
    8000, 50);
  if (gone.ok) deleted++;
}
check('every created track deleted', deleted === createdIds.length,
  { deleted, created: createdIds.length });

const final = await list();
const strays = final.tracks.filter((t) => createdIds.includes(t.channelId));
check('no created track survives teardown', strays.length === 0, { strays: strays.map((t) => t.name) });
const lost = [...baselineIds].filter((id) => !final.tracks.some((t) => t.channelId === id));
check('no pre-existing track was harmed', lost.length === 0, { lostChannelIds: lost });
note(`project back to ${final.count} tracks (started at ${before.count})`);

// ------------------------------------------------- 6. restore baseline rig
await reload({ stamp: 'baseline-restored', tracks: 256, scenes: 128 });
await warmup();
check('baseline rig config restored', (await stats()).config.tracks === 256);

// ------------------------------------------------- summary
console.log('\n== E5b populated-project results ==');
console.log('config'.padEnd(21), 'bank'.padStart(9), 'reload'.padStart(8), 'constr'.padStart(7),
  'warmup'.padStart(8), 'scan'.padStart(9), 'p50'.padStart(6), 'p95'.padStart(6),
  'heap'.padStart(6), 'vis'.padStart(4), 'clips'.padStart(6), ' state');
for (const r of rows) {
  console.log(
    r.stamp.padEnd(21), r.bank.padStart(9), `${r.reloadMs}ms`.padStart(8),
    r.constructMs.toFixed(1).padStart(7), `${r.warmupMs}ms`.padStart(8),
    `${r.scanMicros}µs`.padStart(9), r.p50.toFixed(1).padStart(6), r.p95.toFixed(1).padStart(6),
    `${r.heapMb}M`.padStart(6), String(r.visible).padStart(4), String(r.clips).padStart(6),
    ` ${r.functional}`);
}
console.log('(constr/p50/p95 in ms)');

console.log(failureCount() === 0 ? '\nE5b: all checks passed' : `\nE5b: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
