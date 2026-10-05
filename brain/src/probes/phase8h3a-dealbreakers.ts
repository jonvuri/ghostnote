/** 8h3a live research. Keep all results ineligible. Refuse the saved anchor. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { ORIGINAL_CONFIG_SHA256 } from './phase8g5-consumers-lib.js';
import { FIXTURES, ORACLE_MS, declaredNotes, replayConfig, type DecodedRow, type Defaults, type FixturePlan, type Wire } from './phase8h2a-replay-lib.js';
import { arm, armViaSlot, armSelectedTarget, bindFixture, disconnectReplay, fixtures, guard, observe, parkFixture, parkReader, readJson, request, restore,
  save, setReplayMarker, setup, shadow, trackIndexOf, wait } from './phase8h2a-replay.js';
import { DEALBREAKER_MARKER, verdict } from './phase8h3a-dealbreakers-lib.js';

setReplayMarker(DEALBREAKER_MARKER, true);
const configPath = join(homedir(), '.ghostnote', 'rig.json');
const hash = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
interface Target extends FixturePlan { trackId: string; row: number; written: boolean }
async function config(path: string): Promise<void> {
  const bytes = await readFile(configPath); assert.equal(hash(bytes), ORIGINAL_CONFIG_SHA256);
  const research = { ...replayConfig(), scenes: 64, stamp: '8h3a-dealbreakers' };
  await save(path, { schema: 'phase8h3a-config-entry-v1', originalBase64: bytes.toString('base64'), originalSha256: hash(bytes), research }, true);
  await writeFile(configPath, JSON.stringify(research) + '\n');
  console.log(JSON.stringify({ research, sha256: hash(await readFile(configPath)) }));
}
async function rowSetup(path: string): Promise<void> {
  await guard(); const state = await readJson(path), all = state.fixtures as Record<string, Target>;
  // The one-note track also holds exact copies at rows 1 and 63.
  const one = all['one-64']!, track = await trackIndexOf(one.trackId);
  const missing = 64 - Number((await request('scene.count')).sceneCount);
  if (missing > 0) { await request('scene.create', { count: missing }); await wait(500); }
  for (const row of [1, 63]) {
    const key = `one-row-${row}`;
    assert.notEqual((await request('slot.status', { trackIndex: track, slotIndex: row })).hasContent, true);
    await request('clip.create', { trackIndex: track, slotIndex: row, lengthBeats: one.beats });
    await bindFixture(track, row);
    await shadow('fixtureEdit', { ops: [{ op: 'set', channel: 0, x: 0, y: 60, velocity: 100, durationCells: 4 }] });
    await wait(2_000);
    all[key] = { ...one, row }; await save(path, state);
  }
  await parkFixture(state);
}
async function rows(epoch: number, closed: boolean): Promise<DecodedRow[]> {
  const result: DecodedRow[] = [];
  for (let from = 0; ;) {
    const page = await shadow(closed ? 'replayClosedNotes' : 'replayNotes', { epoch, from, limit: 16_384 });
    result.push(...page.rows as DecodedRow[]);
    if (Number(page.next) < 0) return result; from = Number(page.next);
  }
}
async function capture(state: Wire, key: string, params: Wire = {}, onClosed?: (status: Wire) => void): Promise<Wire> {
  const target = (state.fixtures as Record<string, Target>)[key]!;
  assert(target?.written, `fixture ${key} is absent`);
  const { resolvedTrack, selectionBefore, watchMs, route, ...actionParams } = params;
  const before = selectionBefore ?? await request('selection.status');
  const trackIndex = resolvedTrack ?? await trackIndexOf(target.trackId);
  const actionStarted = performance.now();
  const act = route === 'select-first' ? await armSelectedTarget(Number(trackIndex), target.row, actionParams) : route === 'slot' ? await armViaSlot(Number(trackIndex), target.row) : await arm({ action: 'bind', trackIndex, row: target.row,
    measureClose: true, label: key, ...actionParams });
  let watch: Wire | undefined;
  if (watchMs !== undefined || onClosed !== undefined) {
    let close: Wire;
    for (;;) {
      const current = await shadow('replayStatus'); close = current.epoch as Wire;
      assert.equal(close.epoch, act.epoch);
      if (Number(close.closeMs) >= 0) { onClosed?.(current); break; }
      assert(performance.now() - actionStarted < 10_000, 'D30 close did not arrive');
    }
    const seenAt = performance.now(), pause = Number(watchMs ?? 0);
    if (pause > 0) await wait(pause);
    const watched = await shadow('replayStatus');
    watch = { requestedMs: pause, firstCloseSeenMs: seenAt - actionStarted,
      returnedMs: performance.now() - actionStarted, addedWallMs: performance.now() - seenAt,
      epoch: watched.epoch };
  }
  const status = await observe(Number(act.epoch), ORACLE_MS), epoch = status.epoch as Wire;
  const decoded = await rows(Number(act.epoch), Number(epoch.closeMs) >= 0);
  const result: Wire = { key, target, params, before, after: await request('selection.status'), cursor: status,
    status: epoch, rows: decoded, observedAt: new Date().toISOString(), actMs: act.actMs,
    oracleElapsedMs: performance.now() - actionStarted };
  if (watch !== undefined) result.watch = watch;
  result.verdict = verdict(result, state.defaults as Defaults);
  return result;
}
async function artifact(path: string, report: Wire): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const data = JSON.stringify(report) + '\n';
  await writeFile(path, path.endsWith('.gz') ? gzipSync(data) : data);
}
async function source(path: string, state: Wire, n: number): Promise<void> {
  const pairs = [['n4096-64', 'n16384-512'], ['sustain-2048', 'n131072-2048'],
    ['n4096-64', 'empty-64'], ['empty-64', 'n4096-64'], ['one-64', 'one-row-1'], ['one-64', 'one-64']];
  const report: Wire = { schema: 'phase8h3a-source-v1', complete: false, eligible: false, marker: DEALBREAKER_MARKER,
    entry: await guard(), defaults: state.defaults, trials: [] };
  try {
    await parkFixture(state);
    for (const [from, to] of pairs) for (let i = 0; i < n; i++) {
      await parkReader(state); await capture(state, from!);
      const direct = await capture(state, to!);
      const release = await parkReader(state);
      const parked = await capture(state, to!);
      (report.trials as Wire[]).push({ from, to, i, direct, release, parked });
      await artifact(path, report);
      console.log(JSON.stringify({ from, to, i, direct: direct.verdict, parked: parked.verdict }));
      // A park bind is the known D30 condition. Stop immediately if it fails.
      assert.equal((parked.verdict as Wire).pass, true, 'D30 violation from park: stop and report');
    }
  } finally { await parkReader(state); await parkFixture(state); await artifact(path, report); }
}
async function selection(path: string, state: Wire, route = 'default'): Promise<void> {
  const report: Wire = { schema: 'phase8h3a-selection-v1', complete: false, eligible: false, marker: DEALBREAKER_MARKER,
    entry: await guard(), defaults: state.defaults, route, trials: [] };
  try {
    await parkFixture(state);
    for (const key of ['one-64', 'one-row-1', 'one-row-63']) for (const otherTrack of [false, true]) for (const equal of [true, false])
      for (const when of ['none', 'bind', 'close', 'release']) {
        const target = (state.fixtures as Record<string, Target>)[key]!, track = await trackIndexOf(target.trackId);
        const priorRow = equal ? target.row : target.row === 0 ? 1 : 0;
        await parkReader(state);
        await request('slot.select', { trackIndex: track, slotIndex: priorRow, mechanism: 'track' });
        const priorTrack = otherTrack ? await trackIndexOf(String((state.tracks as Wire).park)) : track;
        if (otherTrack) await request('slot.select', { trackIndex: priorTrack, slotIndex: 0, mechanism: 'track' });
        await wait(500);
        const selectionBefore = await request('selection.status');
        const params = { ownerToken: `8h3a-${key}-${otherTrack}-${equal}-${when}`, restoreTrack: Number(selectionBefore.trackIndex), restoreRow: Number(selectionBefore.slotIndex),
          restoreMixerTrack: Number(selectionBefore.mixerTrackIndex), restoreMechanism: 'slot',
          restoreWhen: when, route };
        const trial = await capture(state, key, { ...params, selectionBefore });
        if (when === 'release') {
          const park = await trackIndexOf(String((state.tracks as Wire).park));
          const act = await arm({ action: 'point', trackIndex: park, ownerToken: params.ownerToken,
            leaseFromTrack: track, leaseFromRow: target.row, label: 'owned-release' });
          trial.release = { act, cursor: await observe(Number(act.epoch), 1_000) };
          trial.restore = await shadow('replayAct', { ...params, action: 'restore', trackIndex: park, row: -1 });
        }
        await wait(300);
        trial.finalSelection = await request('selection.status');
        trial.finalCursor = await shadow('replayStatus');
        trial.equal = equal; trial.otherTrack = otherTrack; trial.when = when;
        (report.trials as Wire[]).push(trial); await artifact(path, report);
        console.log(JSON.stringify({ key, equal, when, verdict: trial.verdict, before: trial.before,
          after: trial.after, final: trial.finalSelection, restore: (trial.cursor as Wire).restore }));
      }
    // E1 rejected slot.select alone. This candidate also points the track, in the same task.
    if (route === 'default') for (const key of ['one-64', 'one-row-1', 'one-row-63']) for (const equal of [true, false]) {
      const target = (state.fixtures as Record<string, Target>)[key]!, track = await trackIndexOf(target.trackId);
      await parkReader(state);
      await request('slot.select', { trackIndex: track, slotIndex: equal ? target.row : target.row === 0 ? 1 : 0, mechanism: 'track' });
      await wait(300);
      const trial = await capture(state, key, { route: 'slot' }); trial.equal = equal; trial.when = 'slot-route';
      (report.trials as Wire[]).push(trial); await artifact(path, report);
      console.log(JSON.stringify({ key, equal, route: 'point-then-slot-select', verdict: trial.verdict, before: trial.before, after: trial.after }));
    }
  } finally { await parkReader(state); await parkFixture(state); await artifact(path, report); }
}
/** Give the operator repeated row-1 reads with a close-task restore to row 0. */
async function visual(path: string, state: Wire, n: number, operatorVisual = true): Promise<void> {
  const report: Wire = { schema: operatorVisual ? 'phase8h3a-visual-v1' : 'phase8h3a-release-selection-v1', complete: false, eligible: false, marker: DEALBREAKER_MARKER,
    entry: await guard(), defaults: state.defaults, trials: [] };
  const target = (state.fixtures as Record<string, Target>)['one-row-1']!, track = await trackIndexOf(target.trackId);
  const phases: Wire[] = [];
  const phase = (i: number, name: string, detail: string): void => {
    if (!operatorVisual) return;
    const at = new Date().toISOString();
    phases.push({ i, name, detail, at });
    console.log(`\n[${at.slice(11, 23)}] ${i < 0 ? '' : `${i + 1}/${n} `}${name}: ${detail}`);
  };
  if (operatorVisual) {
    report.labelledPhases = true; report.phases = phases;
    console.log('Watch Bitwig when WATCH READ appears. Setup and cleanup can move track selection.');
    console.log('READ starts after a countdown. RESTORE ISSUED means the close task sent the restore.');
  }
  try {
    for (let i = 0; i < n; i++) {
      phase(i, 'SETUP', 'Prepare park and Scene 1. Selection changes in this phase are expected.');
      await parkReader(state); await shadow('replayAct', { action: 'subscribe' });
      await request('slot.select', { trackIndex: track, slotIndex: 0, mechanism: 'track' });
      await wait(1_000);
      const selectionBefore = await request('selection.status');
      if (operatorVisual) for (let seconds = 3; seconds > 0; seconds--) {
        phase(i, 'READY', `Read starts in ${seconds}...`); await wait(1_000);
      }
      phase(i, 'WATCH READ', 'Watch track and Scene 2 selection now.');
      const trial = await capture(state, 'one-row-1', { ownerToken: `8h3a-visual-${i}`, selectionBefore,
        restoreTrack: Number(selectionBefore.trackIndex), restoreRow: Number(selectionBefore.slotIndex),
        restoreMixerTrack: Number(selectionBefore.mixerTrackIndex), restoreMechanism: 'slot', restoreWhen: 'close', route: 'select-first' },
        operatorVisual ? status => phase(i, 'RESTORE ISSUED', (status.restore as Wire)?.selected === true
          ? 'Close task sent the restore. Observe the remaining quiet window.'
          : 'Close task could not restore selection.') : undefined);
      const selectionKeys = ['trackIndex', 'slotIndex', 'mixerTrackIndex'];
      const restored = selectionKeys.every(key => (trial.after as Wire)[key] === (trial.before as Wire)[key]);
      phase(i, 'READ DONE', `Exact read: ${(trial.verdict as Wire).pass}. Selection restored: ${restored}.`);
      phase(i, 'RELEASE', 'Unsubscribe. Selection should stay unchanged.');
      const release = await arm({ action: 'unsubscribe', label: 'selection-preserving-release' });
      trial.release = { act: release, cursor: await observe(Number(release.epoch), 1_000) };
      trial.afterReleaseSelection = await request('selection.status');
      (report.trials as Wire[]).push(trial); await artifact(path, report);
      assert.equal((trial.verdict as Wire).pass, true, 'visual read failed');
      assert.equal(restored, true, 'close task did not restore selection');
      for (const key of selectionKeys) assert.equal((trial.afterReleaseSelection as Wire)[key], (trial.before as Wire)[key]);
      assert.equal(((trial.release as Wire).cursor as Wire).subscribed, false);
      if (!operatorVisual) console.log(JSON.stringify({ i, verdict: trial.verdict, before: trial.before, after: trial.after }));
      phase(i, 'RELEASE DONE', 'Selection checked. Next setup follows.');
      await wait(operatorVisual ? 3_000 : 1_000);
    }
  } finally {
    phase(-1, 'CLEANUP', 'Return the reader to park. A track change here is expected.');
    await parkReader(state); await shadow('replayAct', { action: 'subscribe' });
    phase(-1, 'DONE', `Finished ${String((report.trials as Wire[]).length)} trials. Save results to ${path}.`);
    await artifact(path, report);
  }
}

async function writes(path: string, state: Wire, n: number): Promise<void> {
  let report: Wire = { schema: 'phase8h3a-writes-v1', complete: false, eligible: false, marker: DEALBREAKER_MARKER,
    entry: await guard(), defaults: state.defaults, trials: [] };
  try {
    const bytes = await readFile(path);
    report = JSON.parse((path.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString()) as Wire;
    assert.equal(report.marker, DEALBREAKER_MARKER); assert.equal(report.schema, 'phase8h3a-writes-v1');
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const target = (state.fixtures as Record<string, Target>)['n4096-64']!, track = await trackIndexOf(target.trackId);
  const note = declaredNotes(target, state.defaults as Defaults).at(-1)!;
  const edit = (v: number): Wire => ({ operation: 'fixtureEdit', ops: [{ op: 'field', channel: note.channel,
    x: note.cell, y: note.pitch, field: 'velocity', value: v }] });
  try {
    await bindFixture(track, 0);
    for (const mode of ['gap-0', 'gap-1', 'gap-2', 'delayed', 'confirmed']) for (let i = 0; i < n; i++) {
      if ((report.trials as Wire[]).some(t => t.mode === mode && t.i === i)) continue;
      await parkReader(state);
      const v = (i % 2 ? 38 : 25) / 127;
      const selectionBefore = await request('selection.status');
      const writtenBefore = Number((await shadow('fixtureStatus')).written);
      await shadow('replayAct', { action: 'watchWrite', channel: note.channel, x: note.cell, y: note.pitch, velocity: v });
      const start = performance.now();
      const write = (mode === 'delayed' || mode === 'confirmed') ? await request('batch.run', { delayMs: 100,
        ops: [{ method: 'ping' }, { method: 'cache.shadow', params: edit(v) }] }) : await request('cache.shadow', edit(v));
      const gap = mode.startsWith('gap-') ? Number(mode.slice(4)) : 0;
      for (let task = 0; task < gap; task++) await request('ping');
      let barrier: Wire | undefined;
      if (mode === 'confirmed') {
        const started = performance.now();
        for (;;) {
          const status = await shadow('fixtureStatus');
          if (Number(status.written) >= writtenBefore + 1) {
            barrier = { kind: 'execution-counter-in-later-task', ms: performance.now() - started, writtenBefore, status }; break;
          }
          assert(performance.now() - started < 5_000, 'scheduled write did not execute within 5 s'); await wait(10);
        }
      }
      const trial = await capture(state, 'n4096-64', { resolvedTrack: track, selectionBefore, route: 'select-first' });
      trial.mode = mode; trial.i = i; trial.write = write; trial.writeVelocity = v;
      if (barrier !== undefined) trial.barrier = barrier;
      trial.verdict = verdict(trial, state.defaults as Defaults); trial.writeToObservedMs = performance.now() - start;
      (report.trials as Wire[]).push(trial); await artifact(path, report);
      console.log(JSON.stringify({ mode, i, verdict: trial.verdict }));
      await parkReader(state); await request('cache.shadow', edit(note.velocity / 127));
      await wait(500); await parkFixture(state); await bindFixture(track, 0); await wait(500);
    }
  } finally {
    await request('cache.shadow', edit(note.velocity / 127)); await wait(500);
    await parkReader(state); await parkFixture(state); await artifact(path, report);
  }
}
async function soak(dir: string, state: Wire, count: number): Promise<void> {
  await guard(); await parkFixture(state);
  const keys = [...FIXTURES.map(f => f.name), 'one-row-1', 'one-row-63'];
  let pauseRequested = false;
  const pause = (): void => { pauseRequested = true; };
  process.on('SIGINT', pause);
  try {
    for (let start = 0; start < count; start += 25) {
      const playing = start >= count / 2;
      const current = await shadow('replayStatus');
      if (current.isPlaying !== playing) await shadow('replayAct', { action: playing ? 'play' : 'stop' });
      for (let attempt = 0; ; attempt++) {
        if ((await shadow('replayStatus')).isPlaying === playing) break;
        assert(attempt < 100, 'transport did not reach the required state'); await wait(10);
      }
      let report: Wire = { schema: 'phase8h3a-soak-v1', complete: false, eligible: false, marker: DEALBREAKER_MARKER,
        entry: await guard(), defaults: state.defaults, playing, trials: [] };
      const path = join(dir, `soak-${String(start).padStart(3, '0')}.json.gz`);
      try {
        const bytes = await readFile(path); report = JSON.parse(gunzipSync(bytes).toString()) as Wire;
        assert.equal(report.marker, DEALBREAKER_MARKER); assert.equal(report.schema, 'phase8h3a-soak-v1');
        assert.equal(report.playing, playing);
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      for (let i = start; i < Math.min(start + 25, count); i++) {
        if (pauseRequested) return;
        if ((report.trials as Wire[]).some(t => t.i === i)) continue;
        await parkReader(state);
        const trial = await capture(state, keys[i % keys.length]!, { route: 'select-first', watchMs: [0, 50, 100][Math.floor(i / keys.length) % 3] });
        trial.i = i; trial.transport = await shadow('replayStatus');
        assert.equal((trial.transport as Wire).isPlaying, playing, 'transport changed during the trial');
        (report.trials as Wire[]).push(trial); await artifact(path, report);
        console.log(JSON.stringify({ i, playing, key: trial.key, verdict: trial.verdict }));
        assert.equal((trial.verdict as Wire).pass, true, 'D30 violation: stop and report');
      }
    }
  } finally { process.off('SIGINT', pause); await shadow('replayAct', { action: 'stop' }); await parkReader(state); await parkFixture(state); }
}
const [command, path, statePath, n] = process.argv.slice(2);
const lockPath = join(tmpdir(), 'ghostnote-phase8h2a-live.lock');
const lock = await open(lockPath, 'wx');
await lock.writeFile(JSON.stringify({ pid: process.pid, command, started: new Date().toISOString() }) + '\n');
try {
  if (command === 'config') await config(path!);
  else if (command === 'restore') await restore(path!);
  else if (command === 'setup') await setup(path!);
  else if (command === 'fixtures') await fixtures(path!);
  else if (command === 'rows') await rowSetup(path!);
  else {
    const state = await readJson(statePath!);
    if (command === 'source') await source(path!, state, Number(n ?? 20));
    else if (command === 'selection') await selection(path!, state);
    else if (command === 'order') await selection(path!, state, 'select-first');
    else if (command === 'release') await visual(path!, state, Number(n ?? 5), false);
    else if (command === 'visual') await visual(path!, state, Number(n ?? 5));
    else if (command === 'writes') await writes(path!, state, Number(n ?? 10));
    else if (command === 'soak') await soak(path!, state, Number(n ?? 500));
    else throw new Error(`unknown command ${command}`);
  }
} finally { disconnectReplay(); await lock.close(); await unlink(lockPath); }
