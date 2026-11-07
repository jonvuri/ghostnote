// Offline development scheduling and explicit repair accounting. No CLI/provider calls.
import { createHash } from 'node:crypto';

const fail = message => { throw new Error(`R01 CLI trial plan: ${message}`); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function json(value) {
  const ancestors = new Set();
  const sorted = value => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Array.isArray(value) || record(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
      if (ancestors.has(value)) fail('cyclic values are not JSON');
      ancestors.add(value);
      const result = Array.isArray(value)
        ? Array.from({ length: value.length }, (_, i) => sorted(value[i]))
        : Object.fromEntries(Object.keys(value).sort().map(k => [k, sorted(value[k])]));
      ancestors.delete(value); return result;
    }
    fail('expected finite JSON data');
  };
  return JSON.stringify(sorted(value));
}
const hash = value => createHash('sha256').update(json(value)).digest('hex');
const text = (value, name) => {
  if (typeof value !== 'string' || !value.length || value.trim() !== value || /[\r\n]/.test(value)) fail(`${name} requires nonempty text`);
};
const integer = (value, name, minimum, maximum = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(`invalid ${name}`);
};
const digest = (value, name) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail(`invalid ${name} hash`);
};

// Each draw is derived from its own hash domain; arm ordering does not consume
// the task-order stream. Rejection sampling avoids modulo bias.
export function shuffled(values, domain) {
  const result = [...values]; let counter = 0;
  const draw = bound => {
    const limit = Math.floor(0x100000000 / bound) * bound;
    for (;;) {
      const value = createHash('sha256').update(json([domain, counter++])).digest().readUInt32BE(0);
      if (value < limit) return value % bound;
    }
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = draw(i + 1); [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Accepted task packages. A pilot package carries its own stage label; the
// E358 development package predates stage labels and is development material.
const PACKAGE_SCHEMAS = { 'r01-development-pairs-v1': 'offline-development-only', 'r01-pilot-package-v1': 'offline-materialized' };
export const STAGES = ['development', 'rigorous'];

export function buildTrialPlan(developmentManifest, options) {
  if (!record(developmentManifest) || !Object.hasOwn(PACKAGE_SCHEMAS, developmentManifest.schema)
      || developmentManifest.status !== PACKAGE_SCHEMAS[developmentManifest.schema]) fail('requires an offline development or pilot manifest');
  if (!record(options) || Object.keys(options).some(k => !['models', 'seed', 'repeats', 'repeatsByTask', 'maxRepairs', 'timeoutMs', 'timeouts', 'stage'].includes(k))) fail('invalid options');
  // `timeouts` (round 2, R01-D12) maps task IDs to per-submission limits; absent, every run uses timeoutMs.
  // `repeatsByTask` (round 2 v3, R01-D18) maps task IDs to repetition counts; absent, every task uses `repeats`.
  const { models, seed, repeats = 1, repeatsByTask = null, maxRepairs = 2, timeoutMs = 120000, timeouts = null, stage = 'development' } = options;
  if (!STAGES.includes(stage)) fail('stage must be development or rigorous');
  if ((developmentManifest.stage ?? 'development') !== stage) fail('plan stage differs from the package stage');
  if (!(typeof seed === 'string' && seed.length || Number.isSafeInteger(seed))) fail('seed must be nonempty text or a safe integer');
  integer(repeats, 'repeats', 1); integer(maxRepairs, 'maxRepairs', 0, 2); integer(timeoutMs, 'timeoutMs', 1);
  if (timeouts !== null && (!record(timeouts) || Object.values(timeouts).some(v => !Number.isSafeInteger(v) || v < 1))) fail('invalid timeouts');
  if (repeatsByTask !== null && (!record(repeatsByTask) || Object.values(repeatsByTask).some(v => !Number.isSafeInteger(v) || v < 1))) fail('invalid repeatsByTask');
  if (!Array.isArray(models) || !models.length) fail('models must be nonempty');
  const configurations = models.map(model => {
    if (!record(model) || Object.keys(model).some(k => !['provider', 'model', 'effort', 'thinkingBudget', 'maxOutputTokens'].includes(k))) fail('invalid model configuration');
    for (const key of ['provider', 'model']) text(model[key], key);
    if (Object.hasOwn(model, 'effort')) text(model.effort, 'effort');
    if (Object.hasOwn(model, 'thinkingBudget')) {
      integer(model.thinkingBudget, 'thinkingBudget', 1);
      if (Object.hasOwn(model, 'effort')) fail('effort and thinkingBudget are mutually exclusive');
    }
    if (Object.hasOwn(model, 'maxOutputTokens')) {
      integer(model.maxOutputTokens, 'maxOutputTokens', 1);
      if (Object.hasOwn(model, 'thinkingBudget') && model.maxOutputTokens <= model.thinkingBudget) fail('maxOutputTokens must exceed thinkingBudget');
    }
    const config = { ...model, maxRepairs, timeoutMs, ...(timeouts ? { timeouts } : {}), wrapperFallback: false, wrapperAutomaticRetry: false };
    return { ...config, configSha256: hash(config) };
  });
  if (new Set(configurations.map(c => c.configSha256)).size !== configurations.length) fail('duplicate model configuration');
  const { tasks, cells } = developmentManifest;
  if (!Array.isArray(tasks) || !tasks.length || !Array.isArray(cells) || !cells.length) fail('tasks and cells must be nonempty');
  const taskIds = tasks.map(t => { if (!record(t)) fail('invalid task'); text(t.id, 'task ID'); return t.id; });
  if (new Set(taskIds).size !== taskIds.length) fail('duplicate task ID');
  if (timeouts && taskIds.some(id => !Object.hasOwn(timeouts, id))) fail('a task has no timeout');
  if (repeatsByTask && taskIds.some(id => !Object.hasOwn(repeatsByTask, id))) fail('a task has no repeat count');
  const repeatsOf = task => repeatsByTask ? repeatsByTask[task] : repeats;
  const cellIds = new Set(), taskArms = new Set();
  for (const cell of cells) {
    if (!record(cell)) fail('invalid cell');
    text(cell.id, 'cell ID'); text(cell.arm, 'arm');
    if (cellIds.has(cell.id)) fail('duplicate cell ID'); cellIds.add(cell.id);
    const pair = json([cell.task, cell.arm]);
    if (taskArms.has(pair)) fail('duplicate task/arm cell'); taskArms.add(pair);
    if (!taskIds.includes(cell.task) || !['primary', 'diagnostic'].includes(cell.role) || typeof cell.eligible !== 'boolean') fail('invalid cell task/role/eligibility');
    if (!cell.eligible) text(cell.reason, 'exclusion reason');
    else {
      digest(cell.prompt?.sha256, 'prompt'); digest(cell.request?.sha256, 'request');
      digest(cell.sourceFactsSha256, 'source facts'); digest(cell.decodedFactsSha256, 'decoded facts');
      if (cell.sourceFactsSha256 !== cell.decodedFactsSha256) fail('input facts disagree');
    }
  }
  const eligible = cells.filter(c => c.eligible);
  if (!eligible.length) fail('no eligible cells');
  for (const task of taskIds) {
    const paired = eligible.filter(c => c.task === task);
    if (new Set(paired.map(c => c.request.sha256)).size > 1
        || new Set(paired.map(c => c.sourceFactsSha256)).size > 1) fail('paired request/input facts disagree');
  }
  // Bound the in-memory schedule rather than accepting accidental billion-run plans.
  integer(cells.length * configurations.length * (repeatsByTask ? Math.max(...Object.values(repeatsByTask)) : repeats), 'expanded scheduled cell count', 1, 1000000);
  const developmentManifestSha256 = hash(developmentManifest);
  const configuration = { seed, repeats, maxRepairs, timeoutMs, ...(timeouts ? { timeouts } : {}), ...(repeatsByTask ? { repeatsByTask } : {}), models: configurations };
  const blocks = [], runs = [], exclusions = [];
  for (const config of configurations) {
    const domain = [seed, config.configSha256];
    const taskBlocks = [];
    for (let repetition = 0; repetition < (repeatsByTask ? Math.max(...taskIds.map(repeatsOf)) : repeats); repetition++) {
      for (const task of taskIds) if (repetition < repeatsOf(task)) taskBlocks.push({ task, repetition });
    }
    for (const { task, repetition } of shuffled(taskBlocks, [domain, 'task-blocks'])) {
      const blockId = `${config.configSha256}:r${repetition}:${task}`;
      const selected = shuffled(eligible.filter(c => c.task === task), [domain, 'arms', task, repetition]);
      if (selected.length) {
        const blockRuns = selected.map(cell => ({
          id: `${config.configSha256}:r${repetition}:${cell.id}`, blockId,
          cell: cell.id, task, arm: cell.arm, role: cell.role, repetition,
          provider: config.provider, model: config.model,
          ...Object.fromEntries(['effort', 'thinkingBudget', 'maxOutputTokens']
            .filter(k => Object.hasOwn(config, k)).map(k => [k, config[k]])),
          configSha256: config.configSha256, maxRepairs, timeoutMs: timeouts ? timeouts[task] : timeoutMs,
          promptSha256: cell.prompt.sha256, requestSha256: cell.request.sha256,
          sourceFactsSha256: cell.sourceFactsSha256,
        }));
        blocks.push({ id: blockId, task, repetition, provider: config.provider, model: config.model,
          configSha256: config.configSha256, runs: blockRuns.map(r => r.id) });
        runs.push(...blockRuns);
      }
      for (const cell of cells.filter(c => c.task === task && !c.eligible)) exclusions.push({
        cell: cell.id, task, arm: cell.arm, role: cell.role, reason: cell.reason,
        repetition, provider: config.provider, model: config.model, configSha256: config.configSha256,
      });
    }
  }
  return {
    schema: 'r01-cli-development-trial-plan-v1', status: 'offline-development-rehearsal', stage,
    developmentManifestSha256, manifestHashEncoding: 'canonical sorted-key JSON, UTF-8',
    configurationSha256: hash(configuration), ...configuration,
    controls: { scoredPilot: false, inferencePerformed: false, wrapperFallback: false,
      wrapperAutomaticRetry: false, underlyingCliRetryAndFallback: 'not-verified-by-plan',
      repairsRequireExplicitSubmission: true, maxCorrectionTurns: maxRepairs,
      stopOnTransportFailure: true, stopOnControlFailure: true },
    counts: { configurations: configurations.length, blocks: blocks.length, initialAttempts: runs.length,
      primaryAttempts: runs.filter(r => r.role === 'primary').length,
      diagnosticAttempts: runs.filter(r => r.role === 'diagnostic').length,
      exclusions: exclusions.length, maximumTaskAttempts: runs.length * (1 + maxRepairs) },
    blocks, runs, exclusions,
  };
}

function repairState(maxRepairs, attempts) {
  integer(maxRepairs, 'maxRepairs', 0, 2);
  if (!Array.isArray(attempts)) fail('attempt history must be an array');
  let status = 'ready';
  for (const [i, result] of attempts.entries()) {
    if (!['ready', 'awaiting-correction'].includes(status)) fail('cannot append after terminal outcome');
    if (!record(result) || !['task', 'transport', 'control'].includes(result.kind) || typeof result.pass !== 'boolean') fail('invalid attempt result');
    if (result.kind !== 'task' && result.pass) fail('transport/control failures cannot pass');
    if (result.kind === 'transport') status = 'halted-transport';
    else if (result.kind === 'control') status = 'halted-control';
    else if (result.pass) status = 'complete';
    else status = i < maxRepairs ? 'awaiting-correction' : 'exhausted';
  }
  const repairsUsed = Math.max(0, attempts.length - 1);
  return { schema: 'r01-cli-repair-state-v1', maxRepairs, attempts: structuredClone(attempts),
    status, repairsUsed, remainingRepairs: maxRepairs - repairsUsed,
    nextAction: status === 'ready' ? 'initial-submission-allowed'
      : status === 'awaiting-correction' ? 'explicit-correction-allowed' : 'none' };
}

export function createRepairState(options = {}) {
  if (!record(options) || Object.keys(options).some(k => k !== 'maxRepairs')) fail('invalid repair options');
  const { maxRepairs = 2 } = options;
  return repairState(maxRepairs, []);
}

/** Append the caller's explicit result; never executes, retries, or repairs itself. */
export function recordAttempt(state, result) {
  if (!record(state) || state.schema !== 'r01-cli-repair-state-v1') fail('invalid repair state');
  const checked = repairState(state.maxRepairs, state.attempts);
  if (json(checked) !== json(state)) fail('inconsistent repair state');
  json(result); // Reject non-JSON evidence rather than silently losing fields.
  return repairState(state.maxRepairs, [...state.attempts, structuredClone(result)]);
}
