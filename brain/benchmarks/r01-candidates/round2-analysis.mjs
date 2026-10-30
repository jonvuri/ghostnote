// R01 round 2 measures (offline): per cohort x arm x family x level, first-attempt
// and within-budget success, pass^3, generated tokens and elapsed time to the
// first correct answer, output size, collateral edits and error visibility; per
// cohort x arm x family, a breaking point from a logistic fit over levels with
// an instance bootstrap; and paired C3/C4 FIELDS tests per level. Scores come
// from the current scorer, as in pilot-analysis.mjs.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generatedTokens } from './cli-effort-calibration.mjs';
import { classifySubmission } from './pilot-analysis.mjs';
import { resolvePackage } from './cli-pilot-runner.mjs';
import { surfaces } from './development-surfaces.mjs';

export const MEASURES_VERSION = 'r01-round2-measures-v1';
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const median = values => {
  const v = values.filter(x => x !== null && x !== undefined).sort((a, b) => a - b);
  return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null;
};
const VALIDATION = 'parse-or-validation-error';

/**
 * Penalized logistic regression of success on x (Newton steps with a small
 * ridge, so a separated ladder still gives a finite, flagged estimate).
 */
export function logisticFit(points, { ridge = 0.01, iterations = 50 } = {}) {
  let b0 = 0, b1 = 0;
  for (let it = 0; it < iterations; it++) {
    let g0 = -ridge * b0, g1 = -ridge * b1, h00 = ridge, h01 = 0, h11 = ridge;
    for (const { x, y } of points) {
      const p = 1 / (1 + Math.exp(-(b0 + b1 * x))), w = p * (1 - p);
      g0 += y - p; g1 += (y - p) * x; h00 += w; h01 += w * x; h11 += w * x * x;
    }
    const det = h00 * h11 - h01 * h01;
    if (!(Math.abs(det) > 1e-12)) break;
    const d0 = (h11 * g0 - h01 * g1) / det, d1 = (h00 * g1 - h01 * g0) / det;
    b0 += d0; b1 += d1;
    if (Math.abs(d0) + Math.abs(d1) < 1e-10) break;
  }
  return { intercept: b0, slope: b1 };
}

/** Seeded uniform draws for the bootstrap; reproducible from the seed alone. */
function uniforms(seed) {
  let counter = 0;
  return () => createHash('sha256').update(`${seed}:${counter++}`).digest().readUInt32BE(0) / 0x100000000;
}

/**
 * Breaking point: the level (log2 scale) where fitted first-attempt success is
 * 50%. Instances are resampled as clusters (each instance index carries its
 * runs at every level) for a 95% percentile interval. A ladder that never
 * crosses 50% is reported as above or below its range rather than extrapolated.
 */
export function breakingPoint(runs, { levels, resamples = 1000, seed = 'r01-round2-breaking-point-v1' } = {}) {
  const x = level => Math.log2(level), lo = Math.min(...levels), hi = Math.max(...levels);
  const rate = level => { const r = runs.filter(p => p.level === level); return r.length ? r.filter(p => p.pass).length / r.length : null; };
  const observed = levels.map(level => ({ level, runs: runs.filter(p => p.level === level).length, rate: rate(level) }));
  const firstBelow = observed.find(o => o.rate !== null && o.rate < 0.5)?.level ?? null;
  const estimate = sample => {
    const { intercept, slope } = logisticFit(sample.map(p => ({ x: x(p.level), y: p.pass ? 1 : 0 })));
    if (!(slope < 0)) return sample.every(p => p.pass) ? Infinity : sample.every(p => !p.pass) ? -Infinity : null;
    return 2 ** (-intercept / slope);
  };
  const point = estimate(runs);
  const clip = v => v === null ? null : v === Infinity || v > hi ? `above ${hi}` : v === -Infinity || v < lo ? `below ${lo}` : Number(v.toPrecision(4));
  const instances = [...new Set(runs.map(p => p.instance))].sort((a, b) => a - b);
  let interval = null;
  if (instances.length >= 2) {
    const u = uniforms(seed), draws = [];
    for (let i = 0; i < resamples; i++) {
      const picked = instances.map(() => instances[Math.floor(u() * instances.length)]);
      const v = estimate(picked.flatMap(k => runs.filter(p => p.instance === k)));
      if (v !== null) draws.push(Math.max(lo / 2, Math.min(hi * 2, v)));
    }
    draws.sort((a, b) => a - b);
    if (draws.length) interval = { low: clip(draws[Math.floor(0.025 * (draws.length - 1))]), high: clip(draws[Math.ceil(0.975 * (draws.length - 1))]),
      resamples, usable: draws.length, seed };
  }
  return { observed, firstLevelBelowHalf: firstBelow, fitted: clip(point), interval,
    method: 'logistic on log2(level), ridge 0.01; 95% percentile interval over instance-cluster resamples' };
}

/** Exact two-sided McNemar test over paired outcomes [a, b]. */
export function mcnemar(pairs) {
  const onlyA = pairs.filter(([a, b]) => a && !b).length, onlyB = pairs.filter(([a, b]) => !a && b).length, n = onlyA + onlyB;
  let tail = 0;
  for (let k = 0; k <= Math.min(onlyA, onlyB); k++) tail += Math.exp(lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1) - n * Math.LN2);
  return { pairs: pairs.length, onlyFirst: onlyA, onlySecond: onlyB, p: n ? Math.min(1, 2 * tail) : 1 };
}
function lgamma(z) {
  let s = 0; for (let i = 2; i < z; i++) s += Math.log(i); return s; // integer arguments only
}

/** One row per scored run with its round-2 measures inputs. */
export function runRows({ plan, results, tasks, codec, tokenizer }) {
  const byId = new Map(tasks.map(t => [t.id, t])), cohorts = new Map(plan.cohorts.map(c => [c.configSha256, c]));
  return results.runs.filter(r => r.submissions?.length).map(run => {
    const task = byId.get(run.task), cohort = cohorts.get(run.configSha256), provider = cohort.profile.provider;
    const scored = run.submissions.filter(s => s.outcome === 'pass' || s.outcome === 'fail');
    const first = scored[0], firstPass = scored.findIndex(s => s.outcome === 'pass');
    const upTo = firstPass >= 0 ? run.submissions.slice(0, run.submissions.indexOf(scored[firstPass]) + 1) : null;
    const gen = s => generatedTokens(provider, s.usage);
    const classified = first?.answer != null ? classifySubmission(task, run.arm, first.answer, codec) : null;
    return { cohort: cohort.id, task: run.task, arm: run.arm, role: run.role, repetition: run.repetition,
      family: task.ladder.family, level: task.ladder.level, instance: task.ladder.instance, status: run.status,
      firstAttemptPass: run.firstAttemptPass, withinBudgetPass: run.withinBudgetPass, repairsUsed: run.repairsUsed,
      submissions: run.submissions.length, stalls: run.submissions.filter(s => s.outcome === 'stall').length,
      firstReason: first?.score?.reason ?? null,
      failedReasons: scored.filter(s => s.outcome === 'fail').map(s => s.score?.reason ?? null),
      firstGenerated: first ? gen(first).generated : null, firstReasoning: first ? gen(first).reasoning : null,
      firstElapsedMs: first?.elapsedMs ?? null,
      generatedToFirstCorrect: upTo ? upTo.reduce((s, x) => s + (gen(x).generated ?? 0), 0) : null,
      // R01-D17: submissions stalled by host sleep are excluded from elapsed time.
      elapsedToFirstCorrectMs: upTo ? upTo.filter(x => !x.elapsedExcluded).reduce((s, x) => s + (x.elapsedMs ?? 0), 0) : null,
      elapsedExcludedSubmissions: run.submissions.filter(x => x.elapsedExcluded).length,
      firstOutputLocalTokens: first?.answer != null && tokenizer ? tokenizer.encode(first.answer).length : null,
      collateralRemoved: classified?.collateralRemoved ?? null, wrongAdded: classified?.wrongAdded ?? null,
      missedIntended: classified?.missedIntended ?? null,
      firstShape: !first ? null : first.answer == null ? 'no-answer' : classified.shape ?? 'json' };
  });
}

/** Aggregate rows per cohort x arm x family x level, plus breaking points and paired C3/C4 tests. */
export function round2Measures(rows, { ladders }) {
  const key = r => `${r.cohort}|${r.arm}|${r.family}|${r.level}`, groups = new Map();
  for (const r of rows) groups.set(key(r), [...(groups.get(key(r)) ?? []), r]);
  const cells = [...groups.values()].map(list => {
    const [{ cohort, arm, family, level }] = list, failed = list.flatMap(r => r.failedReasons);
    const firstFailed = list.filter(r => !r.firstAttemptPass && r.firstReason !== null);
    const instances = [...new Set(list.map(r => r.instance))];
    const repeats = Math.max(...list.map(r => r.repetition)) + 1;
    return { cohort, arm, family, level, runs: list.length, instances: instances.length, repeats,
      firstAttemptPasses: list.filter(r => r.firstAttemptPass).length, withinBudgetPasses: list.filter(r => r.withinBudgetPass).length,
      // pass^3: instances whose every repeat passed on the first attempt (needs three repeats).
      passCubed: repeats >= 3 ? instances.filter(k => list.filter(r => r.instance === k).every(r => r.firstAttemptPass)).length : null,
      medianGeneratedToFirstCorrect: median(list.map(r => r.generatedToFirstCorrect)),
      medianElapsedToFirstCorrectMs: median(list.map(r => r.elapsedToFirstCorrectMs)),
      neverCorrect: list.filter(r => r.generatedToFirstCorrect === null).length,
      medianFirstGenerated: median(list.map(r => r.firstGenerated)), medianFirstReasoning: median(list.map(r => r.firstReasoning)),
      medianFirstOutputLocalTokens: median(list.map(r => r.firstOutputLocalTokens)),
      collateral: { firstAttemptsWithCollateral: list.filter(r => (r.collateralRemoved ?? 0) + (r.wrongAdded ?? 0) > 0 && !r.firstAttemptPass).length,
        removed: list.reduce((s, r) => s + (r.collateralRemoved ?? 0), 0), wrongAdded: list.reduce((s, r) => s + (r.wrongAdded ?? 0), 0) },
      errorVisibility: { firstAttemptFailures: firstFailed.length, firstAttemptValidatorCaught: firstFailed.filter(r => r.firstReason === VALIDATION).length,
        failedSubmissions: failed.length, validatorCaught: failed.filter(x => x === VALIDATION).length,
        validatorShare: failed.length ? failed.filter(x => x === VALIDATION).length / failed.length : null },
      stalls: list.reduce((s, r) => s + r.stalls, 0) };
  });
  const series = new Map();
  for (const r of rows) series.set(`${r.cohort}|${r.arm}|${r.family}`, [...(series.get(`${r.cohort}|${r.arm}|${r.family}`) ?? []), r]);
  const breakingPoints = [...series.values()].map(list => ({ cohort: list[0].cohort, arm: list[0].arm, family: list[0].family,
    ...breakingPoint(list.map(r => ({ level: r.level, instance: r.instance, pass: r.firstAttemptPass })), { levels: ladders[list[0].family].levels }) }));
  const paired = [];
  for (const [, list] of groups) {
    const [{ cohort, arm, family, level }] = list;
    if (arm !== 'c3-fields') continue;
    const other = groups.get(`${cohort}|c4-fields|${family}|${level}`) ?? [];
    const pairs = list.flatMap(r => other.filter(o => o.instance === r.instance && o.repetition === r.repetition).map(o => [r.firstAttemptPass, o.firstAttemptPass]));
    paired.push({ cohort, family, level, first: 'c3-fields', second: 'c4-fields', ...mcnemar(pairs) });
  }
  return { schema: MEASURES_VERSION, cells, breakingPoints, pairedC3C4: paired };
}

/**
 * Merge cohort rows from several run directories, each given as DIRECTORY or
 * DIRECTORY:COHORT (only that cohort's runs are taken). Used when cohorts ran
 * as parallel processes (E385). The runs share one package, or (v3, R01-D18)
 * each uses its own cohort's package and is measured against that ladder.
 */
export function analyzeRound2Runs(specs, codec, tokenizer) {
  const parts = specs.map(spec => { const [directory, cohort = null] = spec.split(/:(?=[^/]+$)/); return { directory, cohort }; });
  const analyses = parts.map(({ directory, cohort }) => ({ cohort, ...analyzeRound2Run(directory, codec, tokenizer) }));
  const packages = [...new Set(analyses.map(a => a.package))].map(name => resolvePackage(name));
  assert(packages.length === 1 || packages.every(p => p.manifest.cohort) && new Set(packages.map(p => p.manifest.cohort)).size === packages.length,
    'runs use different packages that are not per-cohort (v3) packages');
  const pick = a => a.rows.filter(r => (!a.cohort || r.cohort === a.cohort) && (!packageOf(a).manifest.cohort || r.cohort === packageOf(a).manifest.cohort));
  const packageOf = a => packages.find(p => p.name === a.package);
  const rows = analyses.flatMap(pick);
  for (const id of new Set(rows.map(r => r.cohort))) assert.equal(analyses.filter(a => pick(a).some(r => r.cohort === id)).length, 1, `${id} taken from more than one run`);
  const measured = packages.map(p => round2Measures(analyses.filter(a => a.package === p.name).flatMap(pick), { ladders: p.manifest.ladders }));
  return { runs: analyses.map(a => ({ run: a.run, cohort: a.cohort, status: a.status, package: a.package })),
    package: packages.length === 1 ? packages[0].name : packages.map(p => p.name), schema: MEASURES_VERSION,
    cells: measured.flatMap(m => m.cells), breakingPoints: measured.flatMap(m => m.breakingPoints), pairedC3C4: measured.flatMap(m => m.pairedC3C4), rows };
}

export function analyzeRound2Run(directory, codec, tokenizer) {
  const plan = readJson(join(directory, 'plan.json')), results = readJson(join(directory, 'results.json'));
  const pkg = resolvePackage(plan.package.name);
  assert.equal(pkg.manifestSha256, plan.package.manifestSha256, 'package changed since the run');
  assert.equal(pkg.manifest.round, 2, 'not a round-2 package');
  const rows = runRows({ plan, results, tasks: pkg.tasks, codec, tokenizer });
  return { run: directory, package: pkg.name, status: results.status, selection: plan.selection, ...round2Measures(rows, { ladders: pkg.manifest.ladders }), rows };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [upstream, tooling, ...specs] = process.argv.slice(2);
  assert(upstream && tooling && specs.length, 'usage: node --import tsx round2-analysis.mjs PINNED_PP TOOLING RUN_DIRECTORY[:COHORT]...');
  const { getEncoding } = await import(pathToFileURL(resolve(tooling, 'node_modules/js-tiktoken/dist/index.js')));
  const { createAdapter } = await import('./precision.mjs');
  const adapter = await createAdapter(upstream);
  try {
    const codec = surfaces(adapter), tokenizer = getEncoding('o200k_base');
    const result = specs.length === 1 && !/:[^/]+$/.test(specs[0]) ? analyzeRound2Run(resolve(specs[0]), codec, tokenizer)
      : analyzeRound2Runs(specs.map(spec => resolve(spec)), codec, tokenizer);
    process.stdout.write(JSON.stringify(result, null, 1) + '\n');
  }
  finally { adapter.dispose(); }
}
