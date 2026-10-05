/** Verify each retained 8h3a verdict from raw notes and callback records. */
import assert from 'node:assert/strict';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { DEALBREAKER_MARKER, verdict } from './phase8h3a-dealbreakers-lib.js';
import { ORACLE_MS, decodeIssues, declaredNotes, type Defaults, type DecodedRow, type FixturePlan, type Wire } from './phase8h2a-replay-lib.js';
const dir = process.argv[2]!;
assert(dir, 'artifact directory required');
let count = 0, soaked = 0, playing = 0, visualTrials = 0, playbackAttempts = 0;
const sourceSummary: Record<string, Wire> = {}, selectionSummary: Wire[] = [], writeSummary: Wire[] = [], watches: Record<string, number[]> = {};
const stats = (input: number[]): Wire | null => {
  const values = input.filter(v => v >= 0).sort((a, b) => a - b);
  return values.length === 0 ? null : { n: values.length, median: values[Math.floor(values.length / 2)],
    p95: values[Math.ceil(values.length * 0.95) - 1], max: values.at(-1) };
};
const soakClose: Record<string, number[]> = {}, watchesByPlayback: Record<string, number[]> = {};
const sources = new Map<string, number>(), writeModes = new Map<string, number>(), selectionCases = new Set<string>(), soakIds = new Set<number>();
for (const name of (await readdir(dir)).filter(n => /^(source(?:-smoke)?|selection(?:-ordered|-release)?|visual(?:-labelled)?|writes|soak(?:-toggle)?-\d+)\.json(\.gz)?$/.test(n))) {
  const bytes = await readFile(join(dir, name));
  const report = JSON.parse((name.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString()) as Wire;
  assert(['8h3a-dealbreakers-v1', DEALBREAKER_MARKER].includes(String(report.marker)));  assert.equal(report.complete, false); assert.equal(report.eligible, false);
  assert.equal(report.error, undefined);
  for (const entry of report.trials as Wire[]) {
    if (report.schema === 'phase8h3a-source-v1' && name !== 'source-smoke.json.gz') {
      const pair = `${String(entry.from)}>${String(entry.to)}`; sources.set(pair, (sources.get(pair) ?? 0) + 1);
      assert.equal(((entry.parked as Wire).verdict as Wire).pass, true);
      const d = entry.direct as Wire, p = entry.parked as Wire, e = d.status as Wire;
      const summary = sourceSummary[pair] ??= { trials: 0, directStart: 0, directDecodeExact: 0, parkedPass: 0,
        ordering: {}, directTaskMs: [], parkedCloseMs: [], releaseLastMs: [] };
      summary.trials = Number(summary.trials) + 1;
      if ((d.verdict as Wire).startCloses === true) summary.directStart = Number(summary.directStart) + 1;
      if (decodeIssues(d.rows as DecodedRow[], declaredNotes(d.target as unknown as FixturePlan, report.defaults as Defaults)).length === 0)
        summary.directDecodeExact = Number(summary.directDecodeExact) + 1;
      summary.parkedPass = Number(summary.parkedPass) + 1;
      const shape = Number(e.empty) > 0 && Number(e.onset) > 0 ? Number(e.stateTransitions) === 1 && Number(e.lastEmptySeq) < Number(e.firstNonEmptySeq)
        ? 'empty-then-notes' : 'interleaved' : Number(e.callbacks) === 0 ? 'no-callback' : Number(e.empty) > 0 ? 'empty-only' : 'notes-only';
      const ordering = summary.ordering as Record<string, number>; ordering[shape] = (ordering[shape] ?? 0) + 1;
      (summary.directTaskMs as number[]).push(Number((e.batches as number[][])[0]?.[3] ?? -1));
      (summary.parkedCloseMs as number[]).push(Number((p.status as Wire).closeMs));
      (summary.releaseLastMs as number[]).push(Number((entry.release as Wire).lastCallbackMs));
    }
    if (report.schema === 'phase8h3a-writes-v1') {
      const mode = String(entry.mode); writeModes.set(mode, (writeModes.get(mode) ?? 0) + 1);
      writeSummary.push({ mode, pass: (entry.verdict as Wire).pass, duplicates: (entry.status as Wire).duplicates,
        afterClose: (entry.status as Wire).afterClose, receipt: (entry.cursor as Wire).writeReceipt, barrier: entry.barrier });
      if (mode === 'confirmed') {
        assert.equal((entry.verdict as Wire).pass, true, 'execution barrier gives an exact read');
        const barrier = entry.barrier as Wire;
        assert.equal(barrier.kind, 'execution-counter-in-later-task');
        assert(Number((barrier.status as Wire).written) >= Number(barrier.writtenBefore) + 1);
        assert.equal((entry.write as Wire).paced, true);
      }
    }
    if (report.schema === 'phase8h3a-selection-v1') {
      const before = entry.before as Wire, after = (entry.finalSelection ?? entry.after) as Wire;
      selectionSummary.push({ artifact: name, key: entry.key, otherTrack: entry.otherTrack ?? false, equal: entry.equal,
        when: entry.when, route: report.route ?? 'default', pass: (entry.verdict as Wire).pass, duplicates: (entry.status as Wire).duplicates,
        afterClose: (entry.status as Wire).afterClose, restored: ['trackIndex', 'slotIndex', 'mixerTrackIndex'].every(k => before[k] === after[k]),
        slotEvents: Number(after.changes) - Number(before.changes), allEvents: Number(after.revision) - Number(before.revision) });
    }
    if (report.schema === 'phase8h3a-selection-v1' && report.route === 'select-first') {
      assert.equal((entry.verdict as Wire).pass, true);
      if (entry.when === 'close' || entry.when === 'release') {
        const before = entry.before as Wire, after = entry.finalSelection as Wire;
        for (const key of ['trackIndex', 'slotIndex', 'mixerTrackIndex']) assert.equal(after[key], before[key]);
        const final = entry.finalCursor as Wire;
        if (entry.when === 'close') {
          assert.equal((final.restore as Wire).selected, true);
          assert.equal(final.trackChannelId, (entry.target as Wire).trackId);
          assert.equal(final.sceneIndex, (entry.target as Wire).row);
          assert.equal(final.trackPinned, true); assert.equal(final.clipPinned, true);
        } else {
          assert.equal(((entry.release as Wire).act as Wire).leaseTransferred, true);
          assert.equal((final.restore as Wire).selected, true);
          assert.equal(final.clipExists, false);
        }
      }
    }
    if (report.schema === 'phase8h3a-selection-v1' && report.route === 'select-first') selectionCases.add(`${String(entry.key)}:${String(entry.otherTrack)}:${String(entry.equal)}:${String(entry.when)}`);
    const trials = report.schema === 'phase8h3a-source-v1' ? [entry.direct as Wire, entry.parked as Wire] : [entry];
    for (const trial of trials) {
      assert.deepEqual(trial.verdict, verdict(trial, report.defaults as Defaults));
      assert(Number((trial.status as Wire).msSinceLastCallback) < 0 || Number((trial.status as Wire).msSinceLastCallback) >= ORACLE_MS);
      assert(Number(trial.oracleElapsedMs) >= ORACLE_MS); count++;
      if (report.schema === 'phase8h3a-visual-v1' || report.schema === 'phase8h3a-release-selection-v1') {
        assert.equal((trial.verdict as Wire).pass, true);
        const before = trial.before as Wire, after = trial.after as Wire;
        for (const key of ['trackIndex', 'slotIndex', 'mixerTrackIndex']) {
          assert.equal(after[key], before[key]);
          assert.equal((trial.afterReleaseSelection as Wire)[key], before[key]);
        }
        assert.equal(((trial.release as Wire).cursor as Wire).subscribed, false);
        if (report.schema === 'phase8h3a-visual-v1') visualTrials++;
      }
      if (String(report.schema).includes('soak') && name.startsWith('soak-toggle-')) {
        assert.equal((trial.verdict as Wire).pass, true);
        assert.equal((trial.transport as Wire).isPlaying, false); playbackAttempts++;
      }
      if (String(report.schema).includes('soak') && !name.startsWith('soak-toggle-')) {
        assert.equal((trial.verdict as Wire).pass, true);
        assert(!soakIds.has(Number(trial.i)), 'soak ids are unique'); soakIds.add(Number(trial.i)); soaked++;
        (soakClose[`${String(report.playing)}:${String(trial.key)}`] ??= []).push(Number((trial.status as Wire).closeMs));
        const watch = trial.watch as Wire;
        (watchesByPlayback[`${String(report.playing)}:${String(watch.requestedMs)}`] ??= []).push(Number(watch.addedWallMs));
        assert([0, 50, 100].includes(Number(watch.requestedMs)));
        (watches[String(watch.requestedMs)] ??= []).push(Number(watch.addedWallMs));
        assert(Number(watch.addedWallMs) >= Number(watch.requestedMs) - 1);
        if (report.playing === true) { assert.equal((trial.transport as Wire).isPlaying, true); playing++; }
      }
    }
  }
}
assert(count > 0, 'no retained trial artifacts');
console.log(JSON.stringify({ verified: count, soaked, playing }));
if (process.argv.includes('--complete')) {
  assert.equal(sources.size, 6); for (const count of sources.values()) assert(count >= 20);
  for (const mode of ['gap-0', 'gap-1', 'gap-2', 'delayed', 'confirmed']) assert((writeModes.get(mode) ?? 0) >= 10);
  for (const key of ['one-64', 'one-row-1', 'one-row-63']) for (const other of [false, true]) for (const equal of [false, true])
    for (const when of ['none', 'bind', 'close', 'release']) assert(selectionCases.has(`${key}:${other}:${equal}:${when}`));
  assert(soaked >= 500); assert(playing >= 250);
  for (let i = 0; i < 500; i++) assert(soakIds.has(i));
  assert(visualTrials >= 1, 'a raw visual trial is required');
  const visual = JSON.parse((await readFile(join(dir, 'operator-visual.json'))).toString()) as Wire;
  assert.equal(visual.operatorConfirmed, true, 'operator visual confirmation is required');
  assert.equal(visual.row, 1);
  assert.equal(typeof visual.observedSelectionChange, 'boolean');
  assert(typeof visual.report === 'string' && visual.report.length > 0);
  if (visual.observedSelectionChange) assert.equal(visual.userAcceptedRule, true, 'the user must decide a visible selection change');
  const restoration = JSON.parse((await readFile(join(dir, 'restoration.json'))).toString()) as Wire;
  assert.equal(restoration.configSha256, '256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0');
  assert.equal(restoration.ownedProjectClosedWithoutSaving, true);
  assert.equal((restoration.hello as Wire).runtimeProfile, 'normal-v1');
  assert.equal((restoration.hello as Wire).methodCount, 85);
  assert.equal((restoration.hello as Wire).methodsHash, 'bba7383dce25c0f0');
  assert.equal((restoration.hello as Wire).freshness, 'fresh');
  assert.equal(restoration.researchArchiveRemoved, true);
}

for (const row of Object.values(sourceSummary)) for (const key of ['directTaskMs', 'parkedCloseMs', 'releaseLastMs']) row[key] = stats(row[key] as number[]);
const summary = { schema: 'phase8h3a-summary-v1', complete: false, eligible: false, verified: count, soaked, playing, playbackAttempts,
  sources: sourceSummary, selection: selectionSummary, writes: writeSummary, visualTrials,
  soakCloseMs: Object.fromEntries(Object.entries(soakClose).map(([key, values]) => [key, stats(values)])),
  watchByPlaybackMs: Object.fromEntries(Object.entries(watchesByPlayback).map(([key, values]) => [key, stats(values)])),
  watchAddedWallMs: Object.fromEntries(Object.entries(watches).map(([key, values]) => [key, stats(values)])) };
const outAt = process.argv.indexOf('--out');
if (outAt >= 0) await writeFile(process.argv[outAt + 1]!, JSON.stringify(summary, null, 2) + '\n');
