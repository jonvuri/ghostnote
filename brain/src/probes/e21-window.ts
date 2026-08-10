/**
 * E21 — the SCENE window: is rule 5 implementable one population down, and does
 * the fix hold against real Bitwig?
 *
 * Session 3c. `probe:e19` stranded a scene at project index 99 of a 16-wide bank,
 * where nothing could address or delete it and the operator had to remove it by
 * hand — standing rule 5's named failure verbatim, in the population the rule was
 * never implemented for. This measures the premise that fix rests on, then proves
 * the fix.
 *
 * ## The arms, and which of them can run on a shared project
 *
 *   PART A  (`probe:e21`)         no reload, no mutation beyond one create it
 *                                 gives straight back. The refusals are
 *                                 PRECONDITIONS, so an over-budget create is
 *                                 refused without a single scene being made —
 *                                 which is what makes them safe to prove here.
 *   PART B  (`probe:e21-shrink`)  ⚠ reloads the extension with a NARROW scene
 *                                 window, so the project outgrows its bank
 *                                 without growing. Restores the config and
 *                                 reloads back on the way out.
 *   PART C  (`probe:e21-scale`)   B6: what `config.scenes` costs at init.
 *
 * ⚠⚠ **Why PART B shrinks the window instead of adding scenes.** Growing is the
 * one-way half: a create past the window mints a row `sceneBank.getScene(i)`
 * cannot address, so nothing can delete it either. Shrinking produces the same
 * inequality — project rows > bank width — and is undone by putting the config
 * back. E5 swept the track bank the same way for the same reason.
 *
 * ⚠ **Arm 1 is a MEASUREMENT and it runs first.** Everything else rests on
 * `sceneBank.itemCount()` reporting the PROJECT total rather than the window
 * size. `Rig.java` records that as ◐ UNPROVEN for banks in general; E15-A and
 * E16r measured it for TRACKS, and `probe:e19` saw 99 for scenes once, in
 * passing, while doing something else. If it reports the window size the budget
 * needs a different instrument and this session's shape changes.
 *
 * Usage:
 *   npm run probe:e21          — PART A, safe on the open project
 *   npm run probe:e21-shrink   — PART B, reloads the extension twice
 *   npm run probe:e21-scale    — PART C, reloads once per configuration
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import {
  BankWindowOverflowError, BlindSpotError, addressKey, clip, deltaComplete, scene, slot, track,
  type TrackAddress,
} from '../contract/index.js';
import { check, client, failureCount, note, pollUntil, trackedRequest } from './lib.js';

const req = trackedRequest();

const CONFIG_PATH = path.join(os.homedir(), '.ghostnote', 'rig.json');
const JAR = path.resolve('../extension/build/libs/ghostnote-0.0.1.bwextension');
const DEPLOYED = path.join(
  os.homedir(), 'Documents', 'Bitwig Studio', 'Extensions', 'ghostnote-0.0.1.bwextension');

/**
 * ⚠ Whatever was on disk when we started, restored verbatim on the way out.
 *
 * Read rather than reconstructed: the operator's rig.json is theirs, and a probe
 * that "restores" a config it composed itself has silently edited someone's
 * environment. `undefined` means there was no file, and then there is none after.
 */
const ORIGINAL_CONFIG: string | undefined =
  fs.existsSync(CONFIG_PATH) ? fs.readFileSync(CONFIG_PATH, 'utf8') : undefined;

interface RigInfo { tracks: number; scenes: number; cursorPool: number; sceneCount: number }
interface RigStats {
  config: { scenes: number; tracks: number; stamp: string };
  rigConstructMicros: number;
  initMicros: number;
  slotObjects: number;
  markedValues: number;
  heapUsedMb: number;
}
interface WireMark {
  sceneCount: number;
  sceneEpoch: number;
  contentEpoch: number;
  generation: string;
  contentEvents: { seq: number; slotIndex: number; trackIndex: number; channelId: string }[];
}

const rigInfo = async () => (await req('rig.info')) as RigInfo;
const rigStats = async () => (await req('rig.stats')) as RigStats;
const wireMark = async () => (await req('revision.get')) as WireMark;

/**
 * Write a config and force Bitwig to re-init the extension.
 *
 * ⚠ A bare `touch` does NOT trigger the hot-reload — Bitwig watches for a CONTENT
 * change, so the jar has to be rewritten (E5). The poll is on our own `stamp`,
 * which is what proves we are talking to the new init rather than to a bridge
 * that never went down.
 */
async function reload(stamp: string, scenes: number): Promise<boolean> {
  const cfg = { ...JSON.parse(ORIGINAL_CONFIG ?? '{}'), scenes, stamp };
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg));
  client.disconnect();
  execFileSync('cp', [JAR, DEPLOYED]);

  const start = Date.now();
  for (;;) {
    if (Date.now() - start > 90_000) return false;
    try {
      if ((await rigStats()).config.stamp === stamp) return true;
    } catch {
      /* the bridge is still down, which is what a reload looks like */
    }
    client.disconnect();
    await new Promise((r) => setTimeout(r, 250));
  }
}

/**
 * What the rig will report once the operator's own config is live again.
 *
 * ⚠ `RigConfig`'s defaults, applied here rather than assumed, because the file
 * may set neither field — an absent `stamp` reads back as `"default"` and an
 * absent `scenes` as 16.
 */
const RESTORED: { stamp: string; scenes: number } = (() => {
  const cfg = JSON.parse(ORIGINAL_CONFIG ?? '{}') as { stamp?: string; scenes?: number };
  return { stamp: cfg.stamp ?? 'default', scenes: cfg.scenes ?? 16 };
})();

/**
 * Put the operator's config back and reload onto it. Never skipped.
 *
 * ⚠⚠ It polls for the RESTORED stamp, not merely for a bridge that answers —
 * and the first version of this function did the latter. It reported *"config
 * restored: scenes=5"* while the file on disk already said 16, because the very
 * first `rig.stats` reached the extension that had not gone down yet. A restore
 * that can only say yes is the same defect as a control that can only say yes
 * (E17 method guard 10): it confirms nothing and reads like confirmation.
 */
async function restoreConfig(): Promise<void> {
  if (ORIGINAL_CONFIG === undefined) fs.rmSync(CONFIG_PATH, { force: true });
  else fs.writeFileSync(CONFIG_PATH, ORIGINAL_CONFIG);
  client.disconnect();
  execFileSync('cp', [JAR, DEPLOYED]);
  const start = Date.now();
  for (;;) {
    if (Date.now() - start > 90_000) {
      check('restore: the operator\'s rig.json is live again', false,
        'the extension never came back on the restored config — reload the controller BY HAND '
        + `and confirm rig.stats reports scenes=${RESTORED.scenes}`);
      return;
    }
    try {
      const s = await rigStats();
      if (s.config.stamp === RESTORED.stamp && s.config.scenes === RESTORED.scenes) {
        check('restore: the operator\'s rig.json is live again', true,
          { scenes: s.config.scenes, stamp: s.config.stamp });
        return;
      }
    } catch {
      /* still down, which is what a reload looks like */
    }
    client.disconnect();
    await new Promise((r) => setTimeout(r, 250));
  }
}

/** A live adapter over the shared client, handshaken. */
async function adapterOf(): Promise<LiveAdapter> {
  const adapter = new LiveAdapter({ transport: new BridgeTransport(client) });
  await adapter.hello();
  return adapter;
}

async function rejects(what: string, run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
    return undefined;
  } catch (error) {
    note(`  ${what} -> ${error instanceof Error ? error.constructor.name : typeof error}`);
    return error;
  }
}

// ---------------------------------------------------------------- PART A

async function partA(): Promise<void> {
  console.log('\n== PART A — the control reading, and the refusals ==\n');

  const rig = await rigInfo();
  const m0 = await wireMark();
  note(`scene bank window ${rig.scenes}, project scenes ${rig.sceneCount} (observer says ${m0.sceneCount})`);
  note(`track bank window ${rig.tracks}`);

  // --- ARM 1, control half ---------------------------------------------------
  //
  // ⚠ With the window WIDER than the project, both hypotheses predict the same
  // number, so this proves nothing on its own — it is the control that makes
  // PART B's reading a measurement rather than an isolated observation. Stated
  // out loud because a control silently treated as evidence is how E20a produced
  // a confident refutation of a true claim.
  check('A1-control: the scene count reads the same through rig.info and the observer',
    rig.sceneCount === m0.sceneCount, { rigInfo: rig.sceneCount, observer: m0.sceneCount });
  check('A1-control: this project FITS inside its scene window, so the reading cannot discriminate',
    rig.sceneCount <= rig.scenes, { sceneCount: rig.sceneCount, window: rig.scenes });

  // --- ARM 2, the refusals ---------------------------------------------------
  const adapter = await adapterOf();
  const before = await adapter.revision();
  check('A2-mark: the mark carries what the banks can see, in both dimensions',
    before.window.scenes.bankSize === rig.scenes && before.window.tracks.bankSize === rig.tracks,
    before.window);

  const budget = before.window.scenes.bankSize - before.window.scenes.count;
  note(`scene budget: ${budget} of a ${before.window.scenes.bankSize}-wide window`);

  // ⚠ Clamped to 1. On a project that is ALREADY past its window the budget is
  // negative, and asking for a negative count would test the arithmetic rather
  // than the rule — a create of one is over budget there by definition.
  const over = await rejects('scene.create past the budget',
    () => adapter.apply({ ops: [{ op: 'scene.create', count: Math.max(1, budget + 1) }] }));
  check('A2-create: a scene.create past the window is REFUSED', over instanceof BankWindowOverflowError,
    over instanceof Error ? over.message : over);

  const afterRefusal = await adapter.revision();
  check('A2-create: and refused BEFORE the call — nothing was created, nothing stranded',
    afterRefusal.window.scenes.count === before.window.scenes.count
    && afterRefusal.sceneEpoch === before.sceneEpoch,
    { was: before.window.scenes.count, now: afterRefusal.window.scenes.count });

  const outside = scene(before.window.scenes.bankSize + 4, afterRefusal.sceneEpoch);
  const del = await rejects('scene.delete on a row past the window',
    () => adapter.apply({ ops: [{ op: 'scene.delete', scene: outside }] }));
  check('A2-delete: a row past the window is REFUSED, not sent as a bank index',
    del instanceof BlindSpotError, del instanceof Error ? del.message : del);

  const fixture = await fixtureTrack();
  if (fixture !== undefined) {
    const clipOut = await rejects('clip.create on a row past the window',
      () => adapter.apply({
        ops: [{ op: 'clip.create', slot: slot(fixture, outside), lengthBeats: 4 }],
      }));
    check('A2-delete: the SLOT bank is the same width, so clip ops refuse identically',
      clipOut instanceof BlindSpotError, clipOut instanceof Error ? clipOut.message : clipOut);
  }

  // --- ARM 2b, the CONTROL for the refusals ----------------------------------
  //
  // ⚠ Without this, "refuses everything" passes every assertion above. A create
  // INSIDE the budget must still work — and be given straight back, from the END
  // (E3: a mid-grid delete compacts every row beneath it permanently).
  if (budget < 1) {
    check('A2-control: an ALLOWED create still works', false,
      'SKIPPED — no budget left in this project, so the permitting half cannot be shown');
  } else {
    const start = afterRefusal.window.scenes.count;
    await adapter.apply({ ops: [{ op: 'scene.create', count: 1 }] });
    const grew = await pollUntil(async () => (await wireMark()).sceneCount === start + 1, 8000, 100);
    check('A2-control: a create INSIDE the budget is permitted and lands', grew.ok,
      { from: start, to: (await wireMark()).sceneCount });

    if (grew.ok) {
      const now = await adapter.revision();
      await adapter.apply({ ops: [{ op: 'scene.delete', scene: scene(start, now.sceneEpoch) }] });
      const shrank = await pollUntil(async () => (await wireMark()).sceneCount === start, 8000, 100);
      check('A2-control: and it is given back from the END, leaving the project as found', shrank.ok,
        { sceneCount: (await wireMark()).sceneCount, expected: start });
    } else {
      note('⚠ the create did not verify — NOT deleting anything. Check the project by hand.');
    }
  }

  // --- ARM 3, the covered-window control -------------------------------------
  const mark = await adapter.revision();
  const delta = await adapter.contentSince(mark);
  check('A3-cover: a window that DOES cover the project reports itself covered',
    delta.uncovered === false && delta.uncoveredIn === undefined && deltaComplete(delta),
    { uncovered: delta.uncovered, uncoveredIn: delta.uncoveredIn, complete: deltaComplete(delta) });

  // --- ARM 5-lite, how far do the observers reach ----------------------------
  reportObserverReach(await wireMark(), rig.scenes, rig.tracks);
}

/**
 * ⚠ The cheap half of "are the observers coverable after all?".
 *
 * Bitwig delivers initial values through the same callbacks, so a ring read at
 * rest holds recent ones — and if the observers only exist inside the windows,
 * no event in it can name a row or a bank position outside them. It is corroboration
 * for a fact `Rig.java` establishes by construction, not a substitute for it;
 * PART B is where a row outside the window is actually filled.
 */
function reportObserverReach(m: WireMark, scenes: number, tracks: number): void {
  const rows = m.contentEvents.map((e) => e.slotIndex);
  const cols = m.contentEvents.map((e) => e.trackIndex);
  note(`content ring: ${m.contentEvents.length} events, slotIndex ${rows.length ? Math.min(...rows) : '-'}..`
    + `${rows.length ? Math.max(...rows) : '-'}, trackIndex ${cols.length ? Math.max(...cols) : '-'} max`);
  check('A5-reach: no observed event names a row or track OUTSIDE its bank window',
    rows.every((r) => r < scenes) && cols.every((c) => c < tracks),
    { window: { scenes, tracks }, maxRow: rows.length ? Math.max(...rows) : -1 });
}

/** gn-A if it is there — used only for read-only addressing. Never created here. */
async function fixtureTrack(): Promise<TrackAddress | undefined> {
  const list = (await req('track.list')) as {
    tracks: { name: string; type: string; channelId: string }[];
  };
  const row = list.tracks.find((t) => t.type === 'Instrument');
  if (row === undefined) note('⚠ no instrument track in this project — skipping the clip-row arms');
  return row === undefined ? undefined : track(row.channelId);
}

// ---------------------------------------------------------------- PART B

async function partB(): Promise<void> {
  console.log('\n== PART B — the project outgrows its bank, without growing ==\n');

  const baseline = await rigInfo();
  const projectScenes = baseline.sceneCount;
  // Narrow enough that rows plainly exist outside it, wide enough that the grid
  // is still usable if something goes wrong mid-run.
  const narrow = Math.max(2, Math.floor(projectScenes / 2));
  if (projectScenes < 4) {
    check('B0: the project has enough scenes to outgrow a narrowed window', false,
      `SKIPPED — this project holds ${projectScenes} scenes. Add a few rows and re-run.`);
    return;
  }
  note(`project holds ${projectScenes} scenes; narrowing the window to ${narrow}`);

  try {
    const up = await reload(`e21-narrow-${narrow}`, narrow);
    check('B0: the extension came back on the narrowed config', up, { scenes: narrow });
    if (!up) return;

    // --- ARM 1, THE MEASUREMENT ---------------------------------------------
    //
    // ⚠⚠ The window is now SMALLER than the project, so the two hypotheses
    // disagree and the reading decides between them. Everything this session
    // builds rests on the first branch being the true one.
    const rig = await rigInfo();
    const m = await wireMark();
    note(`window ${rig.scenes}, sceneBank.itemCount() -> ${rig.sceneCount} (observer ${m.sceneCount})`);
    const isProjectTotal = rig.sceneCount === projectScenes;
    const isWindowSize = rig.sceneCount === narrow;
    check('B1: sceneBank.itemCount() reports the PROJECT total, not the window size',
      isProjectTotal && !isWindowSize,
      { window: narrow, reported: rig.sceneCount, projectHolds: projectScenes });
    if (!isProjectTotal) {
      note('⚠⚠ ARM 1 FAILED. The scene budget needs a different instrument and session 3c\'s');
      note('   shape changes — do NOT paper over this. Record the reading and stop.');
      return;
    }

    const adapter = await adapterOf();
    const at = await adapter.revision();
    check('B1: and the adapter carries it as coverage on the mark',
      at.window.scenes.count === projectScenes && at.window.scenes.bankSize === narrow,
      at.window.scenes);

    // --- ARM 3, blind clip ROWS in Snapshot.unreachable ----------------------
    const fixture = await fixtureTrack();
    if (fixture !== undefined) {
      const blindRow = clip(slot(fixture, scene(narrow + 1, at.sceneEpoch)));
      const snap = await adapter.read([blindRow]);
      check('B3: a clip row past the window is UNREACHABLE, not a clean empty read',
        snap.unreachable.length === 1 && snap.missing.length === 0
        && snap.entries[addressKey(blindRow)] === undefined,
        { unreachable: snap.unreachable.length, missing: snap.missing.length });

      const visibleRow = clip(slot(fixture, scene(0, at.sceneEpoch)));
      const ok = await adapter.read([visibleRow]);
      check('B3-control: a row INSIDE the window still reads normally',
        ok.unreachable.length === 0, { unreachable: ok.unreachable.length });
    }

    // --- ARM 4, deltaComplete ------------------------------------------------
    const delta = await adapter.contentSince(at);
    check('B4: the launcher window reports that it could not cover the project',
      delta.uncovered && delta.uncoveredIn === 'scenes' && !deltaComplete(delta),
      { uncovered: delta.uncovered, uncoveredIn: delta.uncoveredIn, events: delta.events.length });
    check('B4: and it is the ONLY verdict firing — the other three see a quiet window',
      !delta.truncated && !delta.discontinuous && delta.events.every((e) => e.channelId !== ''),
      { truncated: delta.truncated, discontinuous: delta.discontinuous });

    // --- ARM 5, observer reach ----------------------------------------------
    reportObserverReach(await wireMark(), rig.scenes, rig.tracks);

    // --- the scale reading at this size, for free ---------------------------
    const s = await rigStats();
    note(`scale @ scenes=${narrow}: initMicros=${s.initMicros} construct=${s.rigConstructMicros} `
      + `markedValues=${s.markedValues} slots=${s.slotObjects} heapMb=${s.heapUsedMb}`);
  } finally {
    console.log('\n-- restoring the operator\'s rig.json --');
    await restoreConfig();
  }
}

// ---------------------------------------------------------------- PART C

/**
 * B6 — what `config.scenes` costs.
 *
 * ⚠ A NUMBER, not a verdict. E5 measured the track side; this session measures
 * the scene side and puts it in the record. Whether the default moves is the
 * operator's call, and nothing here makes it.
 *
 * ⚠ `scenes` sizes the scene bank AND every track's slot bank, so the marked
 * volume goes as `tracks × scenes × 6` (six per slot since E20a). Ascending, so a
 * degrading rig shows a trend before it shows a wall and an abort leaves the
 * smaller configurations already measured.
 */
const SCENE_SWEEP = [8, 16, 32, 64, 128] as const;

async function partC(): Promise<void> {
  console.log('\n== PART C — B6: what config.scenes costs at init ==\n');
  const rows: string[] = [];
  try {
    for (const scenes of SCENE_SWEEP) {
      const up = await reload(`e21-scale-${scenes}`, scenes);
      if (!up) {
        check(`C-${scenes}: the extension came back`, false, 'the bridge never returned');
        rows.push(`${String(scenes).padStart(4)} | DID NOT COME BACK`);
        break;
      }
      const s = await rigStats();
      const t0 = Date.now();
      await req('rig.scanTracks');
      const scanMs = Date.now() - t0;
      check(`C-${scenes}: the rig constructed and answers`, s.config.scenes === scenes, {
        initMicros: s.initMicros, markedValues: s.markedValues,
      });
      rows.push(
        `${String(scenes).padStart(4)} | ${String(s.slotObjects).padStart(6)} `
        + `| ${String(s.markedValues).padStart(7)} | ${String(s.rigConstructMicros).padStart(8)} `
        + `| ${String(s.initMicros).padStart(8)} | ${String(s.heapUsedMb).padStart(5)} `
        + `| ${String(scanMs).padStart(6)}`);
    }
  } finally {
    console.log('\nscenes |  slots | marked  | constructUs |   initUs | heapMb | scanMs');
    for (const r of rows) console.log(r);
    console.log('\n-- restoring the operator\'s rig.json --');
    await restoreConfig();
  }
}

// ----------------------------------------------------------------------------

const mode = process.argv[2] ?? 'a';
await client.connect();
try {
  if (mode === 'a') await partA();
  else if (mode === 'shrink') await partB();
  else if (mode === 'scale') await partC();
  else throw new Error(`unknown mode "${mode}" — expected one of: a, shrink, scale`);
} finally {
  client.disconnect();
}

console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILED`}`);
process.exit(failureCount() === 0 ? 0 : 1);
