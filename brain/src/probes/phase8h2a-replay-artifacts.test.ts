import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FIXTURES, ORACLE_MS, REPLAY_MARKER, completion, startCandidates, summarizeTrials, windowVerdict, type Wire } from './phase8h2a-replay-lib.js';

const dir = new URL('../../../context/evidence/data/phase8h2a-replay/', import.meta.url);
const read = (name: string): Wire => JSON.parse(readFileSync(new URL(name, dir), 'utf8')) as Wire;
const research = (report: Wire): void => {
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.marker, REPLAY_MARKER);
  assert.equal(report.error, undefined, 'a retained artifact has no error');
};
const steps = (sample: unknown): number => Number((sample as Wire).noteSteps);

test('E227: every replay is one batch, decodes exactly from callbacks, and clipExists closes the read', () => {
  for (const plan of FIXTURES) {
    const report = read(`trials-${plan.name}.json`); research(report);
    assert.equal(report.oracleMs, ORACLE_MS);
    const fixture = report.fixture as Wire, trials = report.trials as Wire[];
    assert.equal(trials.length, 20, `${plan.name} has 20 trials`);
    for (const trial of trials) {
      const epoch = trial.status as Wire;
      // Recompute each verdict from the raw epoch.
      const done = completion(epoch), start = startCandidates(epoch, { beats: plan.beats, row: 0, trackId: String(fixture.trackId) });
      assert.deepEqual(trial.completion, done); assert.deepEqual(trial.start, start); assert.deepEqual(trial.window, windowVerdict(epoch));
      assert.equal((trial.window as Wire).refuse, false, `${plan.name} clean read is admitted`);
      assert.deepEqual(trial.decodeIssues, [], `${plan.name} decodes exactly`);
      assert.equal(trial.notes, plan.count);
      assert.equal(start.clipExists!.closes, true, `${plan.name} clipExists task saw every callback`);
      if (plan.count > 0) { assert.equal(done.singleTask, true); assert.equal(Number(epoch.duplicates), 0); }
      else assert.equal(epoch.callbacks, 0);
    }
    const summary = summarizeTrials(trials);
    assert.deepEqual(report.summary, summary);
    // Targeted getStep reads through the fixture writer agree with the decoded values.
    assert.deepEqual(trials[0]!.targetedIssues, []);
    // Release to the park target returns the note-step count to the baseline.
    assert.equal(steps(trials[0]!.releasedHeap), steps(report.baseline), `${plan.name} release returns to baseline`);
    assert.equal(steps(trials[0]!.boundHeap) - steps(report.baseline), Number((trials[0]!.status as Wire).callbacks), 'one note step for each cell');
  }
  const sustain = read('trials-sustain-2048.json').trials as Wire[];
  assert.equal((sustain[0]!.status as Wire).callbacks, 1_048_513);
});

test('E227: an edit before the replay is a duplicate cell; an edit from inside the replay can follow the confirmation', () => {
  const counts: Record<string, Record<string, number>> = {};
  for (const name of ['n16384-512', 'n4096-64']) {
    const report = read(`edit-${name}.json`); research(report);
    assert.equal(((report.clean as Wire).window as Wire).refuse, false);
    for (const trial of report.trials as Wire[]) {
      const epoch = trial.status as Wire, verdict = windowVerdict(epoch);
      assert.deepEqual(trial.window, verdict); assert.equal(trial.editVisible, true);
      const reasons = verdict.reasons as string[], key = `${name}:${String(trial.mode)}`;
      counts[key] ??= { trials: 0, duplicate: 0, beforeConfirmation: 0 };
      counts[key]!.trials++;
      if (reasons.includes('duplicate-cell')) counts[key]!.duplicate++;
      if (reasons.includes('changed-before-confirmation')) counts[key]!.beforeConfirmation++;
      if (trial.mode === 'pre-replay') assert.equal((epoch.batches as unknown[]).length, 1, 'the edit is inside the replay batch');
      else assert.equal((epoch.batches as unknown[]).length, 2, 'the in-replay edit arrives in a later batch');
    }
  }
  assert.deepEqual(counts, {
    'n16384-512:in-replay': { trials: 5, duplicate: 5, beforeConfirmation: 0 },
    'n16384-512:pre-replay': { trials: 5, duplicate: 5, beforeConfirmation: 0 },
    'n4096-64:in-replay': { trials: 5, duplicate: 5, beforeConfirmation: 4 },
    'n4096-64:pre-replay': { trials: 5, duplicate: 5, beforeConfirmation: 0 },
  });
});

test('E227: paired E131 reads are exact and take more than 11 s at 64 beats', () => {
  for (const name of ['one-64', 'n4096-64']) {
    const report = read(`e131-${name}.json`); research(report);
    for (const row of report.reads as Wire[]) { assert.deepEqual(row.issues, []); assert(Number(row.wallMs) > 11_000); }
  }
});

test('E227: the original config and the normal runtime are restored', () => {
  const report = read('restoration.json');
  assert.equal(report.configSha256, '256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0');
  assert.deepEqual(report.hello, { runtimeProfile: 'normal-v1', methodCount: 85, methodsHash: 'bba7383dce25c0f0',
    initializedAt: '2026-10-05T07:48:57.336Z', freshness: 'fresh', allPass: true });
});
