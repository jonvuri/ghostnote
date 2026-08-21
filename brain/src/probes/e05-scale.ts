/**
 * E5 — Scale limits (§12 #5, the last fully-open question).
 *
 * Sweeps the Rig scaffold sizes via ~/.ghostnote/rig.json + a hot-reload and
 * measures, per configuration:
 *   - reload→bridge-up wall time (what a user perceives as "the extension
 *     froze Bitwig for a moment")
 *   - Rig construction / total init CPU time (measured inside the extension)
 *   - observer warm-up: how long after init until the bank actually reports
 *     its tracks and their channelIds (the async cost markInterested defers)
 *   - control-surface thread latency (ping RTT p50/p95/max) — the proxy for
 *     "is Bitwig sluggish now"
 *   - full track-bank scan cost, and functional correctness at that size
 *
 * The bank-window constraint matters as much as perf: channelId addressing
 * (E2f) can only resolve tracks INSIDE the bank window, so TRACKS bounds the
 * maximum addressable project. Config `undersized` demonstrates that directly.
 *
 * Leaves the baseline config installed and the fixture intact.
 *
 * Usage: npm run probe:e05            (full sweep)
 *        npm run probe:e05 -- s00,s01 (named subset)
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

interface RigCfg {
  stamp: string;
  tracks?: number;
  scenes?: number;
  gridSteps?: number;
  cursorPool?: number;
  deviceBank?: number;
  paramHandles?: number;
  directObservers?: boolean;
}

/**
 * Ascending so a degrading rig shows a trend before it shows a wall, and any
 * abort leaves the smaller configs already measured.
 */
const SWEEP: RigCfg[] = [
  { stamp: 's00-baseline', tracks: 16, scenes: 16 },
  { stamp: 's01-undersized', tracks: 4, scenes: 8 },
  { stamp: 's02-32x32', tracks: 32, scenes: 32 },
  { stamp: 's03-64x64', tracks: 64, scenes: 64 },
  { stamp: 's04-128x64', tracks: 128, scenes: 64 },
  { stamp: 's05-128x128', tracks: 128, scenes: 128 },
  { stamp: 's06-256x128', tracks: 256, scenes: 128 },
  { stamp: 's07-512x128', tracks: 512, scenes: 128 },
  // Isolate the non-bank knobs at a fixed, sane bank size.
  { stamp: 's08-pool16', tracks: 64, scenes: 64, cursorPool: 16 },
  { stamp: 's09-params256', tracks: 64, scenes: 64, paramHandles: 256 },
  { stamp: 's10-grid512', tracks: 64, scenes: 64, gridSteps: 512 },
  { stamp: 's11-candidate', tracks: 64, scenes: 64, cursorPool: 8, deviceBank: 16, paramHandles: 64 },
];

const BASELINE: RigCfg = {
  stamp: 'baseline-restored', tracks: 256, scenes: 128,
  cursorPool: 8, deviceBank: 16, paramHandles: 64,
};

interface RigStats {
  config: Required<RigCfg> & { gridKeys: number; fineSteps: number; fromFile: boolean };
  rigConstructMicros: number;
  initMicros: number;
  initEpochMs: number;
  upMs: number;
  slotObjects: number;
  markedValues: number;
  heapUsedMb: number;
  heapMaxMb: number;
}
interface ScanResult {
  scanMicros: number;
  existing: number;
  withChannelId: number;
  slotsWithContent: number;
  sceneCount: number;
}

const stats = async () => (await client.request('rig.stats')) as RigStats;
const scan = async () => (await client.request('rig.scanTracks')) as ScanResult;

/**
 * Write a config and force Bitwig to re-init the extension.
 * NOTE: a bare `touch` does NOT trigger the hot-reload — Bitwig watches for a
 * content change, so the jar must actually be rewritten.
 */
async function reload(cfg: RigCfg): Promise<{ ok: boolean; ms: number }> {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg));
  client.disconnect();

  const start = Date.now();
  execFileSync('cp', [JAR, DEPLOYED]);

  // Poll until a bridge answers AND reports our stamp — proves we're talking
  // to the new init, not a bridge that never went down.
  for (;;) {
    if (Date.now() - start > 90_000) return { ok: false, ms: Date.now() - start };
    try {
      const s = await stats();
      if (s.config.stamp === cfg.stamp) return { ok: true, ms: Date.now() - start };
    } catch {
      /* bridge still down */
    }
    client.disconnect();
    await new Promise((r) => setTimeout(r, 250));
  }
}

/** Time from bridge-up until the bank has streamed in tracks + channelIds. */
async function warmup(): Promise<{ ms: number; final: ScanResult }> {
  const start = Date.now();
  let stable = 0;
  let last = -1;
  let final = await scan();
  while (Date.now() - start < 30_000) {
    final = await scan();
    const ready = final.existing > 0 && final.withChannelId === final.existing;
    stable = ready && final.existing === last ? stable + 1 : 0;
    last = final.existing;
    if (stable >= 3) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  return { ms: Date.now() - start, final };
}

/** Control-surface thread latency: every request is marshaled onto it. */
async function pingLatency(n = 100): Promise<{ p50: number; p95: number; max: number }> {
  const samples: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = process.hrtime.bigint();
    await client.request('ping');
    samples.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  samples.sort((a, b) => a - b);
  return {
    p50: samples[Math.floor(n * 0.5)],
    p95: samples[Math.floor(n * 0.95)],
    max: samples[n - 1],
  };
}

interface Row {
  stamp: string;
  tracks: number;
  scenes: number;
  slots: number;
  reloadMs: number;
  constructMs: number;
  initMs: number;
  warmupMs: number;
  scanMicros: number;
  p50: number;
  p95: number;
  max: number;
  heapMb: number;
  visible: number;
  functional: string;
}

const only = process.argv[2]?.split(',').map((s) => s.trim()).filter(Boolean);
const plan = only?.length ? SWEEP.filter((c) => only.some((o) => c.stamp.startsWith(o))) : SWEEP;

await client.connect();
console.log(`connected — E5 sweep over ${plan.length} configurations\n`);

// The fixture must exist before the sweep; every round re-verifies it works.
const fixture = await ensureFixtureTracks();
const baselineScan = await scan();
note(`project has ${baselineScan.existing} tracks (incl. FX/Master); fixture gn-A=${fixture.trackA} gn-B=${fixture.trackB}`);
console.log();

const rows: Row[] = [];

for (const cfg of plan) {
  console.log(`-- ${cfg.stamp}: tracks=${cfg.tracks} scenes=${cfg.scenes}` +
    (cfg.cursorPool ? ` cursorPool=${cfg.cursorPool}` : '') +
    (cfg.paramHandles ? ` paramHandles=${cfg.paramHandles}` : '') +
    (cfg.gridSteps ? ` gridSteps=${cfg.gridSteps}` : ''));

  const r = await reload(cfg);
  if (!r.ok) {
    check(`${cfg.stamp}: extension came back after reload`, false, { waitedMs: r.ms });
    note('bridge did not return — aborting sweep and restoring baseline');
    break;
  }

  const w = await warmup();
  const s = await stats();
  const lat = await pingLatency();
  const steady = await scan();

  // Functional check at this size: can we still point, write and read back?
  // A rig that is fast but broken is not a shipped size.
  let functional = 'n/a';
  const inWindow = fixture.trackA < s.config.tracks;
  if (inWindow) {
    const fp: [number, number, number, number][] = [[0, 60, 100, 1]];
    const p = await point('0', fixture.trackA, 0, 'trackThenSlot');
    if (!p.ok) {
      functional = 'POINT-FAILED';
    } else {
      await client.request('cursor.clearNotes', { cursor: '0' });
      await client.request('cursor.setNotes', { cursor: '0', notes: fp });
      const ok = await pollUntil(async () => sameNotes(await getNotes('0'), fp));
      functional = ok.ok ? 'ok' : 'READBACK-FAILED';
    }
  } else {
    functional = 'fixture-outside-bank';
  }

  rows.push({
    stamp: cfg.stamp,
    tracks: s.config.tracks,
    scenes: s.config.scenes,
    slots: s.slotObjects,
    reloadMs: r.ms,
    constructMs: s.rigConstructMicros / 1000,
    initMs: s.initMicros / 1000,
    warmupMs: w.ms,
    scanMicros: steady.scanMicros,
    p50: lat.p50,
    p95: lat.p95,
    max: lat.max,
    heapMb: s.heapUsedMb,
    visible: steady.existing,
    functional,
  });

  note(`reload ${r.ms}ms | construct ${(s.rigConstructMicros / 1000).toFixed(1)}ms | ` +
    `init ${(s.initMicros / 1000).toFixed(1)}ms | warmup ${w.ms}ms | ` +
    `scan ${steady.scanMicros}µs | ping p50 ${lat.p50.toFixed(1)} p95 ${lat.p95.toFixed(1)} max ${lat.max.toFixed(1)}ms | ` +
    `tracks visible ${steady.existing} | ${functional}`);

  check(`${cfg.stamp}: rig functional`, functional === 'ok' || functional === 'fixture-outside-bank',
    { functional });
  console.log();
}

// ---------------------------------------------------------------- the window
console.log('-- bank-window constraint (channelId is only resolvable inside the window)');
const under = rows.find((r) => r.stamp === 's01-undersized');
if (under) {
  check('an undersized bank HIDES project tracks (scale bounds max project size, not just perf)',
    under.visible < baselineScan.existing,
    { bankTracks: under.tracks, visible: under.visible, actualProjectTracks: baselineScan.existing });
}

// ---------------------------------------------------------------- restore
console.log('\n-- restoring baseline config');
const restored = await reload(BASELINE);
check('baseline rig restored', restored.ms > 0 && restored.ms < 90_000, { ms: restored.ms });
await warmup();
await ensureFixtureTracks();
const fp: [number, number, number, number][] = [[0, 60, 100, 1]];
await point('0', fixture.trackA, 0, 'trackThenSlot');
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: fp });
check('fixture intact after sweep', (await pollUntil(async () => sameNotes(await getNotes('0'), fp))).ok);

// ---------------------------------------------------------------- summary
console.log('\n== E5 sweep results ==');
console.log(
  'config'.padEnd(16), 'slots'.padStart(7), 'reload'.padStart(8), 'constr'.padStart(8),
  'init'.padStart(8), 'warmup'.padStart(8), 'scan'.padStart(9), 'p50'.padStart(7),
  'p95'.padStart(7), 'max'.padStart(8), 'heap'.padStart(6), 'vis'.padStart(4), ' state');
for (const r of rows) {
  console.log(
    r.stamp.padEnd(16),
    String(r.slots).padStart(7),
    `${r.reloadMs}ms`.padStart(8),
    `${r.constructMs.toFixed(1)}`.padStart(8),
    `${r.initMs.toFixed(1)}`.padStart(8),
    `${r.warmupMs}ms`.padStart(8),
    `${r.scanMicros}µs`.padStart(9),
    r.p50.toFixed(1).padStart(7),
    r.p95.toFixed(1).padStart(7),
    r.max.toFixed(1).padStart(8),
    `${r.heapMb}M`.padStart(6),
    String(r.visible).padStart(4),
    ` ${r.functional}`);
}
console.log('(constr/init/p50/p95/max in ms)');

console.log(failureCount() === 0 ? '\nE5: all checks passed' : `\nE5: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
