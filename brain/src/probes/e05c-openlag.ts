/**
 * E5c — Cold project-open lag (closes E5's main caveat).
 *
 * E5/E5b measured hot-reload init only. This measures what a large scaffold
 * costs when Bitwig OPENS A PROJECT, and when Bitwig COLD-STARTS — the two
 * moments a user would actually perceive as "the extension made this slow".
 *
 * Method: a recorder polls the bridge continuously (ping for control-surface
 * thread latency, rig.scanTracks for bank population) and detects, without
 * needing to be told:
 *   - bridge outages (a Bitwig restart) and the init that follows
 *   - project transitions (the visible track set changing)
 *   - how long the bank takes to settle after each, and whether the
 *     control-surface thread stalled while it happened
 *
 * The same project is opened at a LARGE and a SMALL rig; the difference is
 * the scaffold's contribution. Bitwig's own load time cancels out.
 *
 * Modes:
 *   populate   build ~48 tracks so there is a realistic project to save
 *   record     run the recorder until stopped (this is the measurement)
 *   stop       signal a running recorder to finish and print its summary
 *   rig <n>    install a rig size and hot-reload (e.g. `rig 256` / `rig 16`)
 *   teardown   delete the tracks `populate` created (by channelId)
 *
 * ⚠ SCRATCH PROJECT ONLY.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { client, check, note, failureCount, pollUntil } from './lib.js';

const HOME_DIR = path.join(os.homedir(), '.ghostnote');
const CONFIG_PATH = path.join(HOME_DIR, 'rig.json');
const CREATED_PATH = path.join(HOME_DIR, 'e05c-created.json');
const STOP_PATH = path.join(HOME_DIR, 'e05c-stop');
const JAR = path.resolve('../extension/build/libs/ghostnote-0.0.1.bwextension');
const DEPLOYED = path.join(
  os.homedir(), 'Documents', 'Bitwig Studio', 'Extensions', 'ghostnote-0.0.1.bwextension');

const NEW_TRACKS = 48;
const SCENES_USED = 8;

interface RigStats {
  config: { stamp: string; tracks: number; scenes: number };
  rigConstructMicros: number; initMicros: number; initEpochMs: number; upMs: number;
}
interface ScanResult {
  scanMicros: number; existing: number; withChannelId: number;
  slotsWithContent: number; sceneCount: number;
}
type TrackRow = { index: number; name: string; type: string; channelId: string };

const stats = async () => (await client.request('rig.stats', undefined, 3000)) as RigStats;
const scan = async () => (await client.request('rig.scanTracks', undefined, 3000)) as ScanResult;
const list = async () =>
  (await client.request('track.list', undefined, 5000)) as { tracks: TrackRow[]; count: number };

function writeConfig(tracks: number, scenes: number, stamp: string) {
  fs.mkdirSync(HOME_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ tracks, scenes, stamp }));
}

async function reload(tracks: number, scenes: number, stamp: string): Promise<number> {
  writeConfig(tracks, scenes, stamp);
  client.disconnect();
  const start = Date.now();
  execFileSync('cp', [JAR, DEPLOYED]);
  for (;;) {
    if (Date.now() - start > 90_000) throw new Error(`bridge did not return for ${stamp}`);
    try {
      if ((await stats()).config.stamp === stamp) return Date.now() - start;
    } catch { /* down */ }
    client.disconnect();
    await new Promise((r) => setTimeout(r, 250));
  }
}

const mode = process.argv[2] ?? 'record';

// ==================================================================== rig
if (mode === 'rig') {
  const tracks = Number(process.argv[3] ?? 256);
  const scenes = tracks >= 128 ? 128 : 16;
  await client.connect();
  const ms = await reload(tracks, scenes, `e05c-rig-${tracks}`);
  const s = await stats();
  console.log(`rig now ${s.config.tracks}×${s.config.scenes} ` +
    `(construct ${(s.rigConstructMicros / 1000).toFixed(1)}ms, reload ${ms}ms)`);
  client.disconnect();
  process.exit(0);
}

// =============================================================== populate
if (mode === 'populate') {
  await client.connect();
  await reload(256, 128, 'e05c-populate');
  await pollUntil(async () => (await scan()).withChannelId > 0);

  const before = await list();
  const baselineIds = new Set(before.tracks.map((t) => t.channelId));
  note(`baseline: ${before.count} tracks (preserved)`);

  const haveScenes = (await scan()).sceneCount;
  if (haveScenes < SCENES_USED) {
    await client.request('scene.create', { count: SCENES_USED - haveScenes });
    await pollUntil(async () => (await scan()).sceneCount >= SCENES_USED);
  }

  for (let i = 0; i < NEW_TRACKS; i++) {
    await client.request('track.create', { position: before.count + i });
  }
  const grew = await pollUntil(async () => (await list()).count >= before.count + NEW_TRACKS, 120_000, 250);
  check(`${NEW_TRACKS} tracks created`, grew.ok);

  const after = await list();
  const created = after.tracks.filter((t) => !baselineIds.has(t.channelId));
  for (const t of created) {
    for (let s = 0; s < SCENES_USED; s++) {
      await client.request('clip.create', { trackIndex: t.index, slotIndex: s, lengthBeats: 4 });
    }
  }
  await pollUntil(async () => (await scan()).slotsWithContent >= created.length * SCENES_USED, 120_000, 250);

  fs.writeFileSync(CREATED_PATH, JSON.stringify(created.map((t) => t.channelId)));
  const final = await scan();
  check('project populated', final.existing >= before.count + NEW_TRACKS,
    { tracks: final.existing, clips: final.slotsWithContent });
  note(`created channelIds saved to ${CREATED_PATH} for teardown`);
  client.disconnect();
  process.exit(failureCount() === 0 ? 0 : 1);
}

// =============================================================== teardown
if (mode === 'teardown') {
  await client.connect();
  await reload(256, 128, 'e05c-teardown');
  await pollUntil(async () => (await scan()).withChannelId > 0);

  const ids: string[] = JSON.parse(fs.readFileSync(CREATED_PATH, 'utf8'));
  let deleted = 0;
  let absent = 0;
  for (const id of ids) {
    const r = (await client.request('track.resolveByChannelId', { channelId: id })) as
      { found: boolean; index?: number };
    if (!r.found) { absent++; continue; }
    await client.request('track.delete', { trackIndex: r.index });
    const gone = await pollUntil(async () =>
      !((await client.request('track.resolveByChannelId', { channelId: id })) as { found: boolean }).found,
      8000, 50);
    if (gone.ok) deleted++;
  }
  check('all created tracks removed from this project', deleted + absent === ids.length,
    { deleted, alreadyAbsent: absent, total: ids.length });
  if (absent > 0) {
    note(`${absent} were not in this project — teardown only affects the project that is open`);
  }
  await reload(16, 16, 'baseline-restored');
  fs.rmSync(CONFIG_PATH, { force: true });
  await reload(16, 16, 'default').catch(() => {});
  client.disconnect();
  process.exit(failureCount() === 0 ? 0 : 1);
}

// ==================================================================== stop
if (mode === 'stop') {
  fs.mkdirSync(HOME_DIR, { recursive: true });
  fs.writeFileSync(STOP_PATH, '');
  console.log('stop signal written; the recorder will print its summary shortly');
  process.exit(0);
}

// ================================================================== record
interface Episode {
  kind: 'project-open' | 'extension-init';
  startedAt: number;
  settledMs: number;
  fromTracks: number;
  toTracks: number;
  toClips: number;
  maxRttMs: number;
  stallSamples: number;   // RTT > 100ms: the thread was actually blocked
  outageMs: number;       // bridge unreachable (Bitwig restart)
  constructMs?: number;
}

fs.rmSync(STOP_PATH, { force: true });
await client.connect();
const rig0 = await stats();
console.log(`recording — rig ${rig0.config.tracks}×${rig0.config.scenes} (stamp ${rig0.config.stamp})`);
console.log('go ahead and drive Bitwig; `npm run probe:e05c -- stop` ends the session\n');

let lastInitEpoch = rig0.initEpochMs;
let lastSig = '';
let lastScan = await scan();
lastSig = `${lastScan.existing}/${lastScan.slotsWithContent}`;

const episodes: Episode[] = [];
let current: Episode | null = null;
let stableSince = Date.now();
let outageStart = 0;
const SETTLE_MS = 1000;

const startedAt = Date.now();
while (!fs.existsSync(STOP_PATH) && Date.now() - startedAt < 30 * 60_000) {
  let rtt = -1;
  let ok = true;
  const t = process.hrtime.bigint();
  try {
    await client.request('ping', undefined, 3000);
    rtt = Number(process.hrtime.bigint() - t) / 1e6;
  } catch {
    ok = false;
    client.disconnect();
  }

  if (!ok) {
    // Bitwig is restarting (or wedged): remember when it went away.
    if (outageStart === 0) {
      outageStart = Date.now();
      console.log(`[${new Date().toLocaleTimeString()}] bridge went away — Bitwig restarting?`);
    }
    await new Promise((r) => setTimeout(r, 250));
    continue;
  }

  // Back after an outage → a fresh init happened. Measure it.
  let justInit = false;
  if (outageStart !== 0) {
    const s = await stats().catch(() => null);
    if (s) {
      const outageMs = Date.now() - outageStart;
      outageStart = 0;
      justInit = true;
      lastInitEpoch = s.initEpochMs;
      current = {
        kind: 'extension-init', startedAt: Date.now(), settledMs: 0,
        fromTracks: 0, toTracks: 0, toClips: 0, maxRttMs: rtt, stallSamples: 0,
        outageMs, constructMs: s.rigConstructMicros / 1000,
      };
      console.log(`[${new Date().toLocaleTimeString()}] bridge back after ${(outageMs / 1000).toFixed(1)}s ` +
        `— init construct ${(s.rigConstructMicros / 1000).toFixed(1)}ms; waiting for bank to settle`);
    }
  }

  const sc = await scan().catch(() => null);
  if (!sc) continue;
  const sig = `${sc.existing}/${sc.slotsWithContent}`;

  if (sig !== lastSig) {
    if (!current) {
      current = {
        kind: 'project-open', startedAt: Date.now(), settledMs: 0,
        fromTracks: lastScan.existing, toTracks: sc.existing, toClips: sc.slotsWithContent,
        maxRttMs: rtt, stallSamples: 0, outageMs: 0,
      };
      console.log(`[${new Date().toLocaleTimeString()}] project change detected ` +
        `(${lastScan.existing} tracks → …)`);
    }
    stableSince = Date.now();
    lastSig = sig;
  }

  if (current) {
    current.maxRttMs = Math.max(current.maxRttMs, rtt);
    if (rtt > 100) current.stallSamples++;
    current.toTracks = sc.existing;
    current.toClips = sc.slotsWithContent;
    const settled = Date.now() - stableSince > SETTLE_MS && sc.withChannelId === sc.existing;
    if (settled && !justInit) {
      current.settledMs = stableSince - current.startedAt;
      episodes.push(current);
      console.log(`[${new Date().toLocaleTimeString()}] settled: ${current.kind} — ` +
        `${current.toTracks} tracks / ${current.toClips} clips in ${current.settledMs}ms ` +
        `(max RTT ${current.maxRttMs.toFixed(0)}ms, ${current.stallSamples} stalled samples)`);
      current = null;
    }
  }

  lastScan = sc;
  await new Promise((r) => setTimeout(r, 25));
}

fs.rmSync(STOP_PATH, { force: true });
const rigEnd = await stats().catch(() => null);

console.log('\n== E5c recorded episodes ==');
console.log('kind'.padEnd(16), 'tracks'.padStart(8), 'clips'.padStart(7), 'settle'.padStart(9),
  'maxRTT'.padStart(9), 'stalls'.padStart(7), 'outage'.padStart(9), 'construct'.padStart(10));
for (const e of episodes) {
  console.log(
    e.kind.padEnd(16),
    `${e.fromTracks}→${e.toTracks}`.padStart(8),
    String(e.toClips).padStart(7),
    `${e.settledMs}ms`.padStart(9),
    `${e.maxRttMs.toFixed(0)}ms`.padStart(9),
    String(e.stallSamples).padStart(7),
    e.outageMs ? `${(e.outageMs / 1000).toFixed(1)}s`.padStart(9) : '—'.padStart(9),
    (e.constructMs !== undefined ? `${e.constructMs.toFixed(1)}ms` : '—').padStart(10));
}
if (rigEnd) {
  console.log(`\nrig during this session: ${rigEnd.config.tracks}×${rigEnd.config.scenes}`);
}
console.log('\n"settle" = bank fully repopulated after the event. "stalls" = samples where the');
console.log('control-surface thread took >100ms to answer a ping (real UI-blocking).');

client.disconnect();
process.exit(0);
