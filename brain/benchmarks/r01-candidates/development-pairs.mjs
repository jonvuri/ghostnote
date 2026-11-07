// Offline development package builder. No provider, host, or reserved-corpus access.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonical, noteKey, equivalence } from './common.mjs';
import { developmentTasks, cardExample, cohortScopes } from './development-tasks.mjs';
import { formatCard, commonInstructions } from './development-cards.mjs';
import { ARMS, DIAGNOSTICS, eligibility, surfaces, scoreResponse, goldenResponse } from './development-surfaces.mjs';
import { auditDetachedLayout } from './detached-fields.mjs';
import { createAdapter } from './precision.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
export const sha = value => createHash('sha256').update(value).digest('hex');
const factHash = (fixture, cohort) => sha(cohort === 'source' ? canonical(fixture)
  : canonical(fixture.notes.map(noteKey).sort()));
const json = value => JSON.stringify(value, null, 2) + '\n';
const descriptors = (text, tokenizer) => ({ sha256: sha(text), bytes: Buffer.byteLength(text), tokens: tokenizer.encode(text).length });
function checkedFacts(codec, arm, fixture, cohort, text) {
  const decoded = codec.decode(arm, text).fixture;
  assert(cohort === 'source' ? canonical(decoded) === canonical(fixture)
    : equivalence(fixture.notes, decoded.notes).equal, `${arm}: input/example fact mismatch`);
  return factHash(decoded, cohort);
}

// One deliberately wrong semantic result per eligible cell, plus gratuitous
// refusal for every non-refusal task. Detailed fault cases live in the tests.
export function rehearse(task, arm, codec) {
  const golden = goldenResponse(task, arm, codec);
  const good = scoreResponse(task, arm, golden, codec);
  assert(good.pass, `${task.id}/${arm}: golden failed: ${JSON.stringify(good)}`);
  let bad;
  if (task.response === 'refusal') bad = 'REFUSE wrong-reason';
  else if (task.response === 'answer') bad = JSON.stringify({ ...task.answer, unexpected: true });
  else {
    const mutated = structuredClone(task.expected);
    mutated.notes[0].velocity = mutated.notes[0].velocity === 1 ? 2 : 1;
    bad = codec.encode(arm, mutated);
  }
  const wrong = scoreResponse(task, arm, bad, codec);
  assert(!wrong.pass, `${task.id}/${arm}: wrong result accepted`);
  const refusal = task.response === 'refusal' ? null : scoreResponse(task, arm, 'REFUSE unsupported', codec);
  assert(!refusal?.pass);
  return { golden, result: { golden: good, wrongResult: wrong, gratuitousRefusal: refusal } };
}

// The E358 development package. A pilot package supplies its own tasks,
// header (schema, status, stage) and limits; cards and contracts are shared.
export const DEVELOPMENT_HEADER = Object.freeze({ schema: 'r01-development-pairs-v1', status: 'offline-development-only' });

// promptRevision 1 is the E358 assembly. Revision 2 (pilot package v3) uses
// instruction/card revision 2 and omits the TASK SCOPE block, whose facts the
// contract prose now states for every arm.
export function buildPackage(adapter, tokenizer, { tasks = developmentTasks(), header = DEVELOPMENT_HEADER, limits = null, promptRevision = 1 } = {}) {
  assert([1, 2].includes(promptRevision), 'unknown prompt revision');
  const codec = surfaces(adapter), cards = {}, pairs = [], cells = [], oracles = [], rehearsal = [];
  for (const task of tasks) {
    const sharedScope = promptRevision === 1 ? `TASK SCOPE\n${JSON.stringify(cohortScopes[task.cohort])}` : null;
    const instructions = commonInstructions(task.cohort, { revision: promptRevision });
    // Request and response instruction are byte-identical across each pair.
    // A conditional-refusal task (pilot v4: p09 and p10) uses one line for the
    // refusal and the write outcome, so the line does not reveal which applies.
    const response = task.conditionalRefusal ? 'Return the complete native output surface, or only the specified REFUSE code when its condition holds.'
      : task.response === 'answer' ? 'Return only the requested JSON answer.'
      : task.response === 'refusal' ? 'Return only the specified REFUSE code when its condition holds.'
      : 'Return only the complete native output surface.';
    const request = `TASK\n${task.request}\n${response}`;
    const sourceFactsSha256 = factHash(task.input, task.cohort);
    const taskCells = [];
    for (const arm of ARMS.filter(a => !DIAGNOSTICS.has(a) || task.diagnostics)) {
      const admission = eligibility(task, arm), id = `${task.id}--${arm}`;
      const cell = { id, task: task.id, arm, cohort: task.cohort, family: task.family,
        role: DIAGNOSTICS.has(arm) ? 'diagnostic' : 'primary', ...admission };
      cells.push(cell); taskCells.push(id);
      if (!admission.eligible) continue;
      const cardId = `${task.cohort}--${arm}`;
      if (!cards[cardId]) {
        const fixture = cardExample(task.cohort), text = codec.encode(arm, fixture);
        const exampleFactsSha256 = checkedFacts(codec, arm, fixture, task.cohort, text);
        const card = formatCard(arm, task.cohort, text, { revision: promptRevision }) + '\n';
        cards[cardId] = { text: card, arm, cohort: task.cohort, exampleFactsSha256,
          example: descriptors(text, tokenizer), ...descriptors(card, tokenizer) };
      }
      const input = codec.encode(arm, task.input);
      const decodedFactsSha256 = checkedFacts(codec, arm, task.input, task.cohort, input);
      assert.equal(decodedFactsSha256, sourceFactsSha256);
      const prompt = `${instructions}\n\n${cards[cardId].text}\n\n${sharedScope ? `${sharedScope}\n\n` : ''}${request}\n\nTASK INPUT\n${input.trimEnd()}\n`;
      Object.assign(cell, { card: `cards/${cardId}.txt`, sourceFactsSha256, decodedFactsSha256,
        instructions: descriptors(instructions, tokenizer), ...(sharedScope ? { scope: descriptors(sharedScope, tokenizer) } : {}),
        request: descriptors(request, tokenizer), input: descriptors(input, tokenizer),
        prompt: descriptors(prompt, tokenizer), exampleFactsSha256: cards[cardId].exampleFactsSha256 });
      pairs.push({ id, task: task.id, arm, prompt, input });
      const check = rehearse(task, arm, codec);
      rehearsal.push({ id, ...check.result });
      oracles.push({ id, response: check.golden, sha256: sha(check.golden) });
      if (arm === 'c4-detached-fields') {
        assert(auditDetachedLayout(task.input));
        if (task.expected) assert(auditDetachedLayout(task.expected));
        cell.layoutAudit = { identicalGroupHeadersAndOrderedRowBodies: true,
          groupReferences: (task.input.groups ?? task.expected.groups).length, rowTables: (task.input.groups ?? task.expected.groups).length };
      }
    }
    assert(taskCells.length >= 6);
  }
  const eligible = cells.filter(c => c.eligible);
  const counts = { tasks: tasks.length, cards: Object.keys(cards).length, scheduledCells: cells.length,
    primaryCells: cells.filter(c => c.role === 'primary').length,
    diagnosticCells: cells.filter(c => c.role === 'diagnostic').length,
    eligibleCells: eligible.length, exclusions: cells.length - eligible.length,
    goldenPasses: rehearsal.filter(r => r.golden.pass).length,
    wrongResultsRejected: rehearsal.filter(r => !r.wrongResult.pass).length,
    gratuitousRefusalsRejected: rehearsal.filter(r => r.gratuitousRefusal && !r.gratuitousRefusal.pass).length };
  const manifest = { ...header, ...(promptRevision === 1 ? { cohortScopes } : { promptRevision, scopeDelivery: 'contract prose (no TASK SCOPE block)' }),
    node: process.version, upstreamPin: adapter.pin, precisionPatchSha256: adapter.patchSha256,
    tokenizer: 'js-tiktoken@1.0.21/o200k_base', counts,
    limits: limits ?? [
      'No model calls; this is an offline scorer rehearsal, not agent performance evidence.',
      'Only retained development excerpts and synthetic fixtures; reserved works remain unopened.',
      'Six primary arms; three separately marked diagnostics on five source tasks, with one layout exclusion.',
      'Source-context exclusions describe the supplied adapters, not a claim that other formats cannot carry annotations.',
      'Common performed scoring normalizes once at 1/512; IDs/order are not cross-format scored. Source scoring is exact.',
      'Complete native writes only; no hidden preservation, tool execution, repair, or identity recovery.',
      'Native Producer Pal parsing is tolerant; semantic pass does not establish canonical or strictly valid syntax.',
      'Component token counts do not sum to whole-prompt counts. Local tokenizer excludes CLI context and provider/cache accounting.',
      'C4 JSON comparison changes encoding and layout; detached FIELDS changes row location and adds counted references.',
      'Task/cell order is deterministic build order, not randomized trial order or a frozen scored pilot.',
    ],
    tasks: tasks.map(({ id, version, family, cohort, response, source }) => ({ id, version, family, cohort, response, source })),
    cards: Object.fromEntries(Object.entries(cards).map(([id, { text, ...meta }]) => [id, meta])), cells,
  };
  return { manifest, pairs, cards, privateOracles: { tasks, responses: oracles }, rehearsal };
}

function filesUnder(path) {
  return readdirSync(join(root, path), { withFileTypes: true }).flatMap(e => e.isDirectory()
    ? filesUnder(`${path}/${e.name}`) : [`${path}/${e.name}`]);
}
export function writePackage(packageData, output, { extraSources = [] } = {}) {
  // Refuse overwrites so evidence refreshes use a new temporary build first.
  mkdirSync(output);
  const { manifest, cards, pairs, privateOracles, rehearsal } = packageData;
  const sources = ['development-pairs.mjs', 'development-pairs.test.mjs', 'development-cards.mjs',
    'development-tasks.mjs', 'development-surfaces.mjs', 'detached-fields.mjs', 'common.mjs',
    'structured.mjs', 'compact-fields.mjs', 'nested-fields.mjs', 'fixtures.mjs', 'precision.mjs']
    .map(p => `brain/benchmarks/r01-candidates/${p}`);
  sources.push('brain/package-lock.json', 'context/evidence/data/r01-candidates/corpus-excerpts.json',
    'context/evidence/data/r01-candidates/precision-upstream.patch', ...filesUnder('brain/src/document'), ...extraSources);
  manifest.sources = sources.sort().map(path => ({ path, sha256: sha(readFileSync(join(root, path))) }));
  const artifacts = { 'pairs.json': json(pairs), 'private-oracles.json': json(privateOracles), 'rehearsal.json': json(rehearsal),
    ...Object.fromEntries(Object.entries(cards).map(([id, { text }]) => [`cards/${id}.txt`, text])) };
  manifest.artifacts = Object.entries(artifacts).map(([path, bytes]) => ({ path, sha256: sha(bytes), bytes: Buffer.byteLength(bytes) }));
  for (const [path, text] of Object.entries(artifacts)) {
    mkdirSync(dirname(join(output, path)), { recursive: true }); writeFileSync(join(output, path), text);
  }
  writeFileSync(join(output, 'manifest.json'), json(manifest));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [upstream, tooling, output] = process.argv.slice(2);
  assert(upstream && tooling && output, 'usage: node --import tsx development-pairs.mjs <pinned-PP-checkout> <tokenizer-tooling> <new-output-directory>');
  const tokenizerPackage = JSON.parse(readFileSync(resolve(tooling, 'node_modules/js-tiktoken/package.json')));
  assert.equal(tokenizerPackage.version, '1.0.21');
  const { getEncoding } = await import(pathToFileURL(resolve(tooling, 'node_modules/js-tiktoken/dist/index.js')));
  const adapter = await createAdapter(upstream);
  try {
    const built = buildPackage(adapter, getEncoding('o200k_base'));
    writePackage(built, resolve(output));
    console.log(json(built.manifest.counts));
  } finally { adapter.dispose(); }
}
