import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { developmentTasks, cardExample, scope, cohortScopes } from './development-tasks.mjs';
import { ARMS, DIAGNOSTICS, eligibility, surfaces, goldenResponse, scoreResponse } from './development-surfaces.mjs';
import { encodeDetachedFields, decodeDetachedFields, auditDetachedLayout } from './detached-fields.mjs';
import { encodeNestedFields } from './nested-fields.mjs';
import { createAdapter } from './precision.mjs';
import { rational, equivalence, add, cmp } from './common.mjs';
import { buildPackage, sha } from './development-pairs.mjs';

const adapter = await createAdapter(process.env.R01_UPSTREAM ?? '/tmp/ghostnote-r01-producer-pal');
after(() => adapter.dispose());
const codec = surfaces(adapter), tasks = developmentTasks();
const taskById = id => {
  const task = tasks.find(t => t.id === id);
  assert(task, `missing development task ${id}`);
  return task;
};
const onGrid = value => { const [n, d] = rational(value); return n * 512n % d === 0n; };
const eligibleArms = task => ARMS.filter(arm => eligibility(task, arm).eligible);
const scoreFixture = (task, arm, fixture) => scoreResponse(task, arm, codec.encode(arm, fixture), codec);

test('development manifest has 14 unique tasks and all shared performed outcomes are grid-closed', () => {
  assert.equal(tasks.length, 14);
  assert.equal(new Set(tasks.map(t => t.id)).size, 14);
  assert.deepEqual(new Set(tasks.map(t => t.family)), new Set([
    'comprehension', 'individual-edit', 'constrained-authoring', 'count-change',
    'preservation', 'group-transform', 'refusal',
  ]));
  assert.deepEqual(scope, { displayMeter: [4, 4], clipLength: '64', channel: 1, timingUnit: 'quarter note' });
  for (const task of tasks.filter(t => t.cohort === 'performed')) {
    for (const fixture of [task.input, task.expected].filter(Boolean)) {
      for (const note of fixture.notes) {
        assert(onGrid(note.at), `${task.id}: onset ${note.at}`);
        assert(onGrid(note.duration), `${task.id}: duration ${note.duration}`);
        assert(cmp(note.at, '0') >= 0 && cmp(note.at, scope.clipLength) < 0);
        assert(cmp(note.duration, '0') > 0 && cmp(add(note.at, note.duration), scope.clipLength) <= 0);
      }
    }
  }
});

test('individual performed edit/delete selectors match exactly one input note', () => {
  for (const [id, index] of [['edit-velocity-guitar', 3], ['edit-onset-drums', 0], ['delete-one-note', 1]]) {
    const task = taskById(id), target = task.input.notes[index];
    assert.equal(task.input.notes.filter(n => n.pitch === target.pitch && n.at === target.at).length, 1);
    assert(task.request.includes(target.at));
    assert(task.request.includes(String(target.pitch)));
  }
});

test('gold group arithmetic is exact, grid-closed, and preserves every unrelated field', () => {
  const task = taskById('halve-group-spread'), before = task.input, after = task.expected;
  assert.deepEqual(after.notes.map(n => n.at), ['2049/256', '1025/128', '513/64', '1027/128']);
  assert.deepEqual(after.groups[0].spread, { a: '0', b: '1/256', c: '3/256', d: '5/256' });
  assert.equal(after.groups[0].anchor, '8');
  assert.equal(after.groups[0].delay, '1/256');
  const omit = (value, key) => Object.fromEntries(Object.entries(value).filter(([k]) => k !== key));
  assert.deepEqual(after.notes.map(n => omit(n, 'at')), before.notes.map(n => omit(n, 'at')));
  assert.deepEqual(omit(after.groups[0], 'spread'), omit(before.groups[0], 'spread'));
  assert.deepEqual(after.groups.slice(1), before.groups.slice(1));
  for (const note of after.notes) {
    assert(onGrid(note.at));
    assert.equal(note.at, add(add('8', '1/256'), after.groups[0].spread[note.id]));
  }
});

test('gold nominal edit moves only b2 and stales only its inferred nominal entry', () => {
  const { input, expected } = taskById('edit-inferred-nominal');
  const before = input.notes.find(n => n.id === 'b2'), afterNote = expected.notes.find(n => n.id === 'b2');
  assert.equal(afterNote.at, '1027/3072');
  assert.equal(afterNote.at, add(before.at, '1/1024'));
  const restored = structuredClone(expected);
  restored.notes.find(n => n.id === 'b2').at = before.at;
  delete restored.musical.nominal.b2.state;
  assert.deepEqual(restored, input);
  assert.equal(expected.musical.nominal.b2.state, 'stale');
});

for (const task of tasks) test(`eligible input facts and golden responses: ${task.id}`, () => {
  const before = structuredClone(task);
  for (const arm of ARMS) {
    const eligible = eligibility(task, arm);
    if (!eligible.eligible) {
      assert.equal(typeof eligible.reason, 'string');
      assert(eligible.reason.length);
      assert.deepEqual(scoreResponse(task, arm, 'not a valid response', codec), { status: 'ineligible', pass: false });
      continue;
    }
    const parsed = codec.decode(arm, codec.encode(arm, task.input));
    if (task.cohort === 'source') assert.deepEqual(parsed.fixture, task.input, `${task.id}/${arm}: source facts`);
    else assert.equal(equivalence(task.input.notes, parsed.fixture.notes).equal, true, `${task.id}/${arm}: performed facts`);
    if (arm.startsWith('baseline-')) {
      assert.deepEqual(parsed.envelope, codec.expectedEnvelope(task.input));
      assert.equal(parsed.envelope.clips[0].length, '64');
      assert.equal(parsed.envelope.coverage[0].to, '64');
    }
    const result = scoreResponse(task, arm, goldenResponse(task, arm, codec), codec);
    assert.equal(result.pass, true, `${task.id}/${arm}: ${JSON.stringify(result)}`);
  }
  assert.deepEqual(task, before, 'encoding/scoring must not mutate a task');
});

test('eligibility makes source limitations, collision exclusions, and diagnostic scope explicit', () => {
  const source = taskById('halve-group-spread');
  for (const arm of ['baseline-fields', 'baseline-json', 'pp-barbeat', 'pp-midi-json']) {
    assert.equal(eligibility(source, arm).eligible, false);
  }
  for (const arm of DIAGNOSTICS) assert.equal(eligibility(taskById('preserve-piano'), arm).eligible, false);
  for (const arm of ['baseline-fields', 'baseline-json']) {
    assert.equal(eligibility(taskById('refuse-ambiguous-selector'), arm).eligible, false);
  }
  assert.equal(eligibility(taskById('preserve-exact-wider'), 'c4-detached-fields').eligible, false);
  assert.throws(() => eligibility(source, 'unknown-arm'));
});

test('format-card examples roundtrip and do not reuse task note IDs', () => {
  const taskIds = new Set(tasks.flatMap(t => t.input.notes.map(n => n.id)));
  for (const cohort of ['performed', 'source']) {
    const fixture = cardExample(cohort);
    for (const note of fixture.notes) assert.equal(taskIds.has(note.id), false);
    const exampleTask = { cohort, input: fixture, diagnostics: true };
    for (const arm of eligibleArms(exampleTask)) {
      const parsed = codec.decode(arm, codec.encode(arm, fixture)).fixture;
      if (cohort === 'source') assert.deepEqual(parsed, fixture);
      else assert.equal(equivalence(fixture.notes, parsed.notes).equal, true);
    }
  }
});

test('missing notes and protected pitch/velocity/duration/onset changes fail performed scoring', () => {
  const task = taskById('edit-velocity-guitar');
  for (const arm of eligibleArms(task)) {
    for (const field of ['missing', 'pitch', 'velocity', 'duration', 'at']) {
      const changed = structuredClone(task.expected);
      if (field === 'missing') changed.notes.splice(1, 1);
      else if (['pitch', 'velocity'].includes(field)) changed.notes[1][field] += 1;
      else changed.notes[1][field] = add(changed.notes[1][field], '1/512');
      assert.equal(scoreFixture(task, arm, changed).pass, false, `${arm}/${field}`);
    }
  }
});

test('duplicate multiplicity fails scoring, including a baseline validation refusal', () => {
  const task = taskById('delete-one-note');
  for (const arm of eligibleArms(task).filter(a => !a.startsWith('baseline-'))) {
    const changed = structuredClone(task.expected);
    changed.notes.push({ ...changed.notes[0], id: 'additionalDuplicate' });
    assert.equal(scoreFixture(task, arm, changed).pass, false, arm);
  }
  const baseline = JSON.parse(goldenResponse(task, 'baseline-json', codec));
  baseline.events.push({ ...baseline.events[0], id: 'additionalDuplicate' });
  assert.equal(scoreResponse(task, 'baseline-json', JSON.stringify(baseline), codec).pass, false);
});

test('source scoring rejects annotation loss and note order changes; equal rational spellings pass (D59)', () => {
  const task = taskById('preserve-exact-wider');
  for (const arm of eligibleArms(task)) {
    const lost = structuredClone(task.expected); delete lost.notes[0].annotation;
    assert.equal(scoreFixture(task, arm, lost).pass, false, `${arm}/lost annotation`);
    const spelling = structuredClone(task.expected); spelling.notes[0].at = '1774/1026';
    assert.equal(scoreFixture(task, arm, spelling).pass, true, `${arm}/equivalent spelling`);
    const value = structuredClone(task.expected); value.notes[0].at = '1775/1026';
    assert.equal(scoreFixture(task, arm, value).pass, false, `${arm}/changed value`);
    const reordered = structuredClone(task.expected); reordered.notes.reverse();
    assert.equal(scoreFixture(task, arm, reordered).pass, false, `${arm}/changed order`);
  }
});

test('source scoring rejects omitted staleness even when performed notes are correct', () => {
  const task = taskById('edit-inferred-nominal'), changed = structuredClone(task.expected);
  delete changed.musical.nominal.b2.state;
  for (const arm of eligibleArms(task)) assert.equal(scoreFixture(task, arm, changed).pass, false, arm);
});

test('wrong but self-consistent residual arithmetic fails the independent golden comparison', () => {
  const task = taskById('halve-group-spread'), changed = structuredClone(task.expected);
  changed.groups[0].spread.b = '1/128';
  changed.notes.find(n => n.id === 'b').at = '2051/256';
  for (const arm of eligibleArms(task)) assert.equal(scoreFixture(task, arm, changed).pass, false, arm);
  const contradictory = goldenResponse(task, 'c4-json', codec);
  const parsed = JSON.parse(contradictory); parsed.context.groups[0].spread.b = '1/128';
  assert.equal(scoreResponse(task, 'c4-json', JSON.stringify(parsed), codec).pass, false);
});

test('performed IDs are diagnostic; source identities are required', () => {
  const task = taskById('delete-one-note'), changed = structuredClone(task.expected);
  changed.notes[0].id = 'renamed';
  for (const arm of eligibleArms(task)) {
    const result = scoreFixture(task, arm, changed);
    assert.equal(result.pass, true, arm);
    assert.equal(result.nativeIdentityDiagnostic, arm.startsWith('pp-') ? null : false, arm);
  }
  const swapped = structuredClone(task.expected);
  [swapped.notes[0].id, swapped.notes[1].id] = [swapped.notes[1].id, swapped.notes[0].id];
  for (const arm of eligibleArms(task).filter(a => !a.startsWith('pp-'))) {
    const result = scoreFixture(task, arm, swapped);
    assert.equal(result.pass, true, arm);
    assert.equal(result.nativeIdentityDiagnostic, false, `${arm}/swapped IDs`);
  }
  const source = taskById('preserve-exact-wider'), changedSource = structuredClone(source.expected);
  changedSource.notes[0].id = 'renamed';
  for (const arm of eligibleArms(source)) assert.equal(scoreFixture(source, arm, changedSource).pass, false, arm);
});

test('baseline envelope changes and invented structured root state fail preservation', () => {
  const task = taskById('preserve-piano');
  const baseline = JSON.parse(goldenResponse(task, 'baseline-json', codec));
  baseline.clips[0].length = '65';
  baseline.coverage.forEach(c => { c.to = '65'; });
  const result = scoreResponse(task, 'baseline-json', JSON.stringify(baseline), codec);
  assert.equal(result.pass, false);
  assert.equal(result.performedState, true);
  assert.equal(result.envelopePreserved, false);
  for (const arm of ['c3-fields', 'c4-fields']) {
    const changed = structuredClone(task.expected); changed.invented = 'unsupported claim';
    assert.equal(scoreFixture(task, arm, changed).pass, false, arm);
  }
});

test('answers require exact keys/values and refusals require the exact expected reason', () => {
  for (const task of tasks.filter(t => t.response === 'answer')) {
    for (const arm of eligibleArms(task)) {
      assert.equal(scoreResponse(task, arm, JSON.stringify({ ...task.answer, extra: true }), codec).pass, false);
      assert.equal(scoreResponse(task, arm, '{}', codec).pass, false);
      assert.equal(scoreResponse(task, arm, 'REFUSE unknown', codec).reason, 'gratuitous-refusal');
    }
  }
  for (const task of tasks.filter(t => t.response === 'refusal')) {
    for (const arm of eligibleArms(task)) for (const bad of ['', 'REFUSE wrong-reason',
      `REFUSE ${task.refusal}\nextra explanation`, JSON.stringify({ refusal: task.refusal })]) {
      assert.equal(scoreResponse(task, arm, bad, codec).pass, false, `${task.id}/${arm}`);
    }
  }
  const surface = taskById('preserve-piano');
  for (const arm of eligibleArms(surface)) {
    assert.equal(scoreResponse(surface, arm, 'REFUSE missing-timing', codec).reason, 'gratuitous-refusal');
    assert.equal(scoreResponse(surface, arm, 'not a surface', codec).pass, false);
  }
});

test('detached control preserves exact state and identical local row content', () => {
  for (const task of tasks.filter(t => eligibility(t, 'c4-detached-fields').eligible)) {
    for (const fixture of [task.input, task.expected].filter(Boolean)) {
      const detached = encodeDetachedFields(fixture);
      assert.deepEqual(decodeDetachedFields(detached), fixture);
      assert.equal(encodeDetachedFields(decodeDetachedFields(detached)), detached);
      assert.equal(auditDetachedLayout(fixture), true);
      const content = text => text.split('\n').filter(line => /^\s+(FIELDS|NOTE|REF) /.test(line)).sort();
      assert.deepEqual(content(detached), content(encodeNestedFields(fixture)));
    }
  }
});

test('detached control rejects missing, shared, duplicate and unreferenced ROWS definitions', () => {
  const fixture = taskById('halve-group-spread').input, text = encodeDetachedFields(fixture);
  const invalid = [
    text.replace('  ROWS r0', '  ROWS r999'),
    text.replace('  ROWS r1', '  ROWS r0'),
    text + 'ROWS r0 {\n}\n',
    text + 'ROWS r99 {\n}\n',
    text.replace('  ROWS r0', '  ROWS r0\n  REF a'),
    text.replace('ROWS r0 {', 'ROWS bad {'),
    text.slice(0, -2),
    text.replace('R01-DETACHED-FIELDS 1', 'R01-DETACHED-FIELDS 2'),
  ];
  for (const bad of invalid) assert.throws(() => decodeDetachedFields(bad), /R01/);
});

test('package build is deterministic, fully charged, and paired by identical request/fact hashes', async () => {
  const tooling = process.env.R01_TOOLING ?? '/tmp/ghostnote-r01-tooling';
  const { getEncoding } = await import(pathToFileURL(resolve(tooling, 'node_modules/js-tiktoken/dist/index.js')).href);
  const tokenizer = getEncoding('o200k_base');
  const first = buildPackage(adapter, tokenizer), second = buildPackage(adapter, tokenizer);
  assert.deepEqual(second, first);
  const { manifest, pairs, rehearsal, privateOracles } = first;
  assert.equal(manifest.status, 'offline-development-only');
  assert.deepEqual(manifest.cohortScopes, cohortScopes);
  assert.equal(Object.hasOwn(manifest.cohortScopes.source, 'channel'), false);
  assert.match(manifest.cohortScopes.source.channelPolicy, /preserve/);
  assert.equal(manifest.counts.tasks, 14);
  assert.equal(manifest.counts.primaryCells, 84);
  assert.equal(manifest.counts.diagnosticCells, 15);
  assert.equal(manifest.counts.scheduledCells, 99);
  assert.equal(manifest.counts.eligibleCells, pairs.length);
  assert.equal(manifest.counts.goldenPasses, pairs.length);
  assert.equal(manifest.counts.wrongResultsRejected, pairs.length);
  assert.equal(privateOracles.responses.length, pairs.length);
  assert.equal(rehearsal.length, pairs.length);
  for (const task of tasks) {
    const cells = manifest.cells.filter(c => c.task === task.id && c.eligible);
    for (const field of ['sourceFactsSha256', 'decodedFactsSha256', 'exampleFactsSha256']) {
      assert.equal(new Set(cells.map(c => c[field])).size, 1, `${task.id}/${field}`);
    }
    for (const component of ['request', 'instructions', 'scope']) {
      assert.equal(new Set(cells.map(c => c[component].sha256)).size, 1, `${task.id}/${component}`);
    }
  }
  for (const pair of pairs) {
    assert.deepEqual(Object.keys(pair).sort(), ['arm', 'id', 'input', 'prompt', 'task']);
    const cell = manifest.cells.find(c => c.id === pair.id);
    assert.equal(cell.prompt.sha256, sha(pair.prompt));
    assert.equal(cell.prompt.bytes, Buffer.byteLength(pair.prompt));
    assert.equal(cell.prompt.tokens, tokenizer.encode(pair.prompt).length);
    assert.equal(cell.input.sha256, sha(pair.input));
    const cardId = cell.card.slice('cards/'.length, -'.txt'.length);
    assert(pair.prompt.includes(first.cards[cardId].text));
    assert(pair.prompt.includes(pair.input.trimEnd()));
    assert.equal(pair.prompt.includes('private-oracles.json'), false);
    assert.equal(pair.prompt.includes('context/evidence/'), false);
    const deliveredScope = JSON.parse(pair.prompt.split('TASK SCOPE\n')[1].split('\n')[0]);
    assert.deepEqual(deliveredScope, cohortScopes[cell.cohort]);
    if (pair.arm === 'c4-detached-fields') assert.equal(cell.layoutAudit.identicalGroupHeadersAndOrderedRowBodies, true);
  }
});
