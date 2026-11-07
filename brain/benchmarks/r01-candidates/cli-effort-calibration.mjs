// D57 effort calibration: fresh initial submissions of one fixed development
// cell set under each configuration, compared by generated tokens. Correctness
// is recorded but never used to choose a setting. Development evidence only.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PROFILES } from './cli-controls.mjs';
import { scoreResponse, surfaces } from './development-surfaces.mjs';
import { auditAttempt } from './cli-control-audit.mjs';
import { preflightProvider, runCliAttempt, sha } from './cli-attempt.mjs';
import { loadPackage, classify } from './cli-paired-runner.mjs';

const json = value => JSON.stringify(value, null, 2) + '\n';

export const CALIBRATION = Object.freeze({
  schema: 'r01-effort-calibration-v1',
  stage: 'development',
  seed: 'r01-effort-calibration-v1',
  reference: 'codex-low',
  // Haiku 5.5 effort levels accepted by Claude Code 2.1.302.
  configurations: Object.freeze({
    'codex-low': { ...PROFILES['codex-current'], effort: 'low' },
    'claude-low': { ...PROFILES['claude-current'], effort: 'low' },
    'claude-medium': { ...PROFILES['claude-current'], effort: 'medium' },
    'claude-high': { ...PROFILES['claude-current'], effort: 'high' },
  }),
  repeats: 1, timeoutMs: 120000,
  cellRule: 'every task; primary arms only. Performed tasks with all six arms alternate between the first and second halves of the sorted arm list; other tasks use every eligible primary arm.',
});

/** The fixed calibration cell set: all families, balanced across formats. */
export function calibrationCells(manifest) {
  const primary = manifest.cells.filter(c => c.eligible && c.role === 'primary');
  const arms = [...new Set(primary.map(c => c.arm))].sort();
  let full = 0;
  return manifest.tasks.flatMap(task => {
    const cells = primary.filter(c => c.task === task.id);
    if (cells.length !== arms.length) return cells;
    const half = full++ % 2 ? arms.slice(3) : arms.slice(0, 3);
    return cells.filter(c => half.includes(c.arm));
  });
}

// Deterministic SHA-256 rejection-sampling shuffle, as in the trial planner.
function shuffled(values, domain) {
  const result = [...values]; let counter = 0;
  const draw = bound => {
    const limit = Math.floor(0x100000000 / bound) * bound;
    for (;;) {
      const v = createHash('sha256').update(JSON.stringify([domain, counter++])).digest().readUInt32BE(0);
      if (v < limit) return v % bound;
    }
  };
  for (let i = result.length - 1; i > 0; i--) { const j = draw(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}

/** Cells in seeded order; each cell runs every configuration back to back in seeded order. */
export function calibrationSchedule(cells, configurationIds, { seed = CALIBRATION.seed, repeats = CALIBRATION.repeats } = {}) {
  const runs = [];
  for (let repetition = 0; repetition < repeats; repetition++)
    for (const cell of shuffled(cells, [seed, 'cells', repetition]))
      for (const configuration of shuffled([...configurationIds].sort(), [seed, 'configurations', repetition, cell.id]))
        runs.push({ id: `${configuration}:r${repetition}:${cell.id}`, configuration, repetition,
          cell: cell.id, task: cell.task, arm: cell.arm, family: cell.family, cohort: cell.cohort,
          promptSha256: cell.prompt.sha256 });
  return runs;
}

/** Generated tokens = reported output (which includes reasoning); reasoning kept separately. */
export function generatedTokens(provider, usage) {
  if (!usage || !Number.isSafeInteger(usage.output_tokens)) return { generated: null, reasoning: null };
  const reasoning = provider === 'codex' ? usage.reasoning_output_tokens ?? null
    : usage.output_tokens_details?.thinking_tokens ?? null;
  return { generated: usage.output_tokens, reasoning };
}

const quantile = (values, q) => {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return null;
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
};
const distribution = values => values.length ? { n: values.length, min: Math.min(...values), p25: quantile(values, 0.25),
  median: quantile(values, 0.5), p75: quantile(values, 0.75), max: Math.max(...values),
  mean: values.reduce((a, b) => a + b, 0) / values.length } : { n: 0 };

/** Summaries per configuration and the median ratio to the reference. */
export function summarize(results, reference = CALIBRATION.reference) {
  const ids = [...new Set(results.map(r => r.configuration))].sort();
  const byConfig = Object.fromEntries(ids.map(id => {
    const rows = results.filter(r => r.configuration === id);
    const ok = rows.filter(r => r.controlPass && r.generated !== null);
    const families = [...new Set(ok.map(r => r.family))].sort();
    return [id, { submissions: rows.length, admitted: ok.length,
      generated: distribution(ok.map(r => r.generated)),
      reasoning: distribution(ok.filter(r => r.reasoning !== null).map(r => r.reasoning)),
      totalInput: distribution(ok.map(r => r.totalInputTokens).filter(v => v !== null)),
      elapsedMs: distribution(ok.map(r => r.elapsedMs).filter(v => v !== null)),
      byFamilyMedianGenerated: Object.fromEntries(families.map(f => [f, quantile(ok.filter(r => r.family === f).map(r => r.generated), 0.5)])),
      // Recorded for completeness; never used to choose a setting (D57).
      passes: ok.filter(r => r.outcome === 'pass').length,
      failures: rows.filter(r => r.outcome !== 'pass').map(r => ({ cell: r.cell, outcome: r.outcome, reason: r.reason ?? null })) }];
  }));
  const ref = byConfig[reference]?.generated.median;
  for (const s of Object.values(byConfig))
    s.medianRatioToReference = ref ? s.generated.median / ref : null;
  // Matched per-cell ratios against the reference.
  for (const id of ids) {
    const ratios = results.filter(r => r.configuration === id && r.controlPass).flatMap(r => {
      const m = results.find(x => x.configuration === reference && x.cell === r.cell && x.repetition === r.repetition && x.controlPass);
      return m && m.generated > 0 ? [r.generated / m.generated] : [];
    });
    byConfig[id].pairedRatioToReference = distribution(ratios);
  }
  return byConfig;
}

async function main([upstream, outputArg, configurationList]) {
  assert(upstream && outputArg && configurationList,
    'usage: node --import tsx cli-effort-calibration.mjs PINNED_PP NEW_OUTPUT_DIRECTORY CONFIG[,CONFIG...]');
  const configurationIds = configurationList.split(',');
  for (const id of configurationIds) assert(CALIBRATION.configurations[id], `unknown configuration ${id}`);
  const output = resolve(outputArg); mkdirSync(output);
  const binaries = {}, authentication = {};
  for (const provider of new Set(configurationIds.map(id => CALIBRATION.configurations[id].provider))) {
    const profile = Object.values(CALIBRATION.configurations).find(p => p.provider === provider);
    ({ binary: binaries[provider], authentication: authentication[provider] } = preflightProvider(provider, profile.version));
  }
  const { manifest, pairs, tasks } = loadPackage();
  const cells = calibrationCells(manifest);
  const runs = calibrationSchedule(cells, configurationIds);
  const pairById = new Map(pairs.map(p => [p.id, p])), taskById = new Map(tasks.map(t => [t.id, t]));
  writeFileSync(join(output, 'plan.json'), json({ ...CALIBRATION, configurationIds,
    configurations: Object.fromEntries(configurationIds.map(id => [id, CALIBRATION.configurations[id]])),
    cells: cells.map(c => c.id), runs }));
  writeFileSync(join(output, 'preflight.json'), json({ stage: 'development', binaries, authentication,
    startedAt: new Date().toISOString(),
    sources: ['cli-effort-calibration.mjs', 'cli-paired-runner.mjs', 'cli-attempt.mjs', 'cli-controls.mjs', 'cli-control-audit.mjs',
      'claude-context-policy.mjs', 'codex-context-policy.mjs', 'development-surfaces.mjs']
      .map(path => ({ path: `brain/benchmarks/r01-candidates/${path}`, sha256: sha(readFileSync(new URL(path, import.meta.url))) })) }));
  const { createAdapter } = await import('./precision.mjs');
  const adapter = await createAdapter(upstream);
  const codec = surfaces(adapter), results = [];
  let status = 'complete';
  try {
    for (const [index, run] of runs.entries()) {
      const pair = pairById.get(run.cell), task = taskById.get(run.task);
      assert.equal(sha(pair.prompt), run.promptSha256, `${run.cell}: delivered prompt differs from plan`);
      const profile = CALIBRATION.configurations[run.configuration];
      const directory = join(output, 'attempts', `${String(index + 1).padStart(3, '0')}-${run.configuration}-${run.cell}`);
      mkdirSync(join(output, 'attempts'), { recursive: true });
      const { processResult } = runCliAttempt({ profile, binary: binaries[profile.provider], prompt: pair.prompt,
        output: directory, timeoutMs: CALIBRATION.timeoutMs,
        meta: { kind: 'effort-calibration', stage: 'development', runId: run.id, cell: run.cell, configuration: run.configuration } });
      const audited = auditAttempt(directory, {});
      writeFileSync(join(directory, 'audit.json'), json(audited));
      const failure = classify(audited);
      const tokens = generatedTokens(profile.provider, audited.rawFinalUsage);
      const row = { ...run, directory: directory.slice(output.length + 1), controlPass: audited.controlPass,
        controlIssues: audited.issues, usage: audited.rawFinalUsage, totalInputTokens: audited.totalInputTokens ?? null,
        ...tokens, elapsedMs: processResult.elapsedMs, retryReport: audited.retryReport };
      if (failure) {
        results.push({ ...row, outcome: failure });
        status = failure === 'quota' ? 'paused-quota' : `halted-${failure}`;
        console.error(`${run.id}: ${failure} ${audited.issues.join(',')}`);
        break;
      }
      const score = scoreResponse(task, run.arm, audited.answer, codec);
      results.push({ ...row, outcome: score.pass ? 'pass' : 'fail', reason: score.reason ?? null });
      console.error(`${index + 1}/${runs.length} ${run.configuration} ${run.cell}: gen ${tokens.generated} (reasoning ${tokens.reasoning}) ${Math.round(processResult.elapsedMs)} ms ${score.pass ? 'pass' : 'fail'}`);
    }
  } finally {
    adapter.dispose();
    const summary = summarize(results);
    writeFileSync(join(output, 'results.json'), json({ schema: 'r01-effort-calibration-results-v1', stage: 'development',
      status, evidence: 'development calibration; correctness recorded, not used for selection', summary, results }));
    console.log(json({ status, summary: Object.fromEntries(Object.entries(summary).map(([k, v]) =>
      [k, { admitted: v.admitted, generated: v.generated, reasoning: v.reasoning.median, ratio: v.medianRatioToReference, paired: v.pairedRatioToReference.median, passes: v.passes }])) }));
    if (status !== 'complete') process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
