// R01 round 2 format-dependent families (R01-D19, R01-D20), offline: generator
// rules recomputed independently, block-traversal order, lifecycle cross-checked
// with the reference editor, level-aware wrong answers, and the retained v4
// calibration packages and execution manifests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { add, canonical, cmp } from './common.mjs';
import { editNote, validateStructuredFixture } from './structured.mjs';
import { encodeCompactFields, decodeCompactFields } from './compact-fields.mjs';
import { encodeNestedFields, decodeNestedFields } from './nested-fields.mjs';
import { FAMILY_GENERATORS, FAMILY_WRONG, LADDERS_V4, homeOrder } from './round2-families.mjs';
import { checkExecution, loadExecution, pilotPlan, resolvePackage, round2Selection, selectionFor } from './cli-pilot-runner.mjs';

const FAMILIES = LADDERS_V4['claude-current'];
const build = (family, level, k = 1) => { const t = FAMILY_GENERATORS[family](level, k); return { ...t, ladder: { family, level, instance: k, ...t.detail } }; };
const owner = (fixture, id) => fixture.groups.find(g => Object.hasOwn(g.spread ?? {}, id));
const onsetByEquation = (fixture, id) => { const g = owner(fixture, id); return g ? add(add(g.anchor, g.delay ?? '0'), g.spread[id]) : null; };
const byId = fixture => new Map(fixture.notes.map(x => [x.id, x]));
const groupById = fixture => new Map(fixture.groups.map(g => [g.id, g]));

test('every family level validates, keeps C4 block-traversal order and round-trips in both FIELDS surfaces', () => {
  for (const [family, ladder] of Object.entries(FAMILIES)) for (const level of ladder.levels) for (const k of [1, 2]) {
    const t = build(family, level, k);
    for (const fixture of [t.input, t.expected]) {
      validateStructuredFixture(fixture);
      assert.equal(new Set(fixture.notes.map(x => x.id)).size, fixture.notes.length, `${family} ${level}: unique IDs`);
      assert.deepEqual(fixture.notes.map(x => x.id), homeOrder(fixture), `${family} ${level}: note order`);
      const c4 = encodeNestedFields(fixture), c3 = encodeCompactFields(fixture);
      assert(!/FIELDS[^\n]*\border\b/.test(c4), `${family} ${level}: no order cells`);
      assert.equal(canonical(decodeNestedFields(c4)), canonical(fixture));
      assert.equal(canonical(decodeCompactFields(c3)), canonical(fixture));
    }
    assert.notEqual(canonical(t.input), canonical(t.expected), `${family} ${level}: the request changes state`);
  }
});

test('query-edit: selection and edits follow the stated rule, with near misses at both bounds', () => {
  for (const G of FAMILIES['query-edit'].levels) {
    const t = build('query-edit', G), { from: X, to: Y, shift: D } = t.ladder;
    const timed = t.input.groups.filter(g => g.spread);
    assert.equal(timed.length, G);
    // Recompute onsets from group equations, independently of the generator.
    for (const x of t.input.notes) if (owner(t.input, x.id)) assert.equal(cmp(x.at, onsetByEquation(t.input, x.id)), 0);
    const inside = x => cmp(x.at, X) >= 0 && cmp(x.at, Y) < 0;
    const notes = new Set(t.input.notes.filter(inside).map(x => x.id));
    const moved = new Set(timed.filter(g => g.members.some(id => notes.has(id))).map(g => g.id));
    const after = byId(t.expected), groups = groupById(t.expected);
    for (const x of t.input.notes) {
      assert.equal(after.get(x.id).pitch, x.pitch + (notes.has(x.id) ? 12 : 0), `${x.id}: pitch`);
      const g = owner(t.input, x.id), shift = g && moved.has(g.id) ? D : '0';
      assert.equal(cmp(after.get(x.id).at, add(x.at, shift)), 0, `${x.id}: onset`);
    }
    for (const g of t.input.groups.filter(g => g.spread)) assert.equal(cmp(groups.get(g.id).anchor, add(g.anchor, moved.has(g.id) ? D : '0')), 0);
    // Bound cases: a group just below X and one starting at Y stay; one ending at X moves (from level 8).
    const latest = g => g.members.map(id => byId(t.input).get(id).at).sort(cmp).at(-1);
    const earliest = g => g.members.map(id => byId(t.input).get(id).at).sort(cmp)[0];
    assert(timed.some(g => cmp(latest(g), add(X, '-1/512')) === 0 && !moved.has(g.id)), `${G}: group ending 1/512 below X`);
    assert(timed.some(g => cmp(earliest(g), Y) === 0 && !moved.has(g.id)), `${G}: group starting at Y`);
    if (G >= 8) assert(timed.some(g => cmp(latest(g), X) === 0 && earliest(g) !== X && moved.has(g.id)), `${G}: group ending at X`);
    assert(notes.has('lb') && !notes.has('lc') && !notes.has('fb') && notes.has('fa'), 'loose and untimed bound cases');
  }
});

test('overlap-edit: heavy notes hold L memberships; group timing moves only owned members; removal touches one group', () => {
  for (const L of FAMILIES['overlap-edit'].levels) {
    const t = build('overlap-edit', L), { ops, heavy } = t.ladder;
    for (const id of heavy) assert.equal(t.input.groups.filter(g => g.members.includes(id)).length, L, `${L}: ${id}`);
    const before = groupById(t.input), after = groupById(t.expected), notesAfter = byId(t.expected);
    // Referenced (non-owned) members of the retimed and scaled groups exist and keep their own timing.
    for (const name of ['retime', 'scale']) {
      const g = before.get(ops[name].group), refs = g.members.filter(id => !Object.hasOwn(g.spread, id));
      assert(refs.length, `${L}: ${name} group references members it does not own`);
      for (const id of refs) assert.equal(cmp(notesAfter.get(id).at, onsetByEquation(t.expected, id)), 0);
      for (const id of refs) assert.equal(owner(t.expected, id).id, owner(t.input, id).id);
    }
    assert.equal(cmp(after.get(ops.retime.group).anchor, add(before.get(ops.retime.group).anchor, ops.retime.by)), 0);
    for (const [id, s] of Object.entries(before.get(ops.scale.group).spread)) assert.equal(cmp(after.get(ops.scale.group).spread[id], add(s, s)), 0);
    assert.equal(after.get(ops.set.group).spread[ops.set.note], ops.set.spread);
    // Removal: only the named group loses the note; every other membership stays.
    for (const g of t.input.groups) {
      const kept = after.get(g.id).members.includes(ops.remove.note);
      assert.equal(kept, g.members.includes(ops.remove.note) && g.id !== ops.remove.group, `${L}: ${g.id}`);
      for (const key of ['performanceOrder', 'presentationOrder']) if (g[key]) assert.deepEqual(after.get(g.id)[key], g[key].filter(x => g.id !== ops.remove.group || x !== ops.remove.note));
    }
    // Every onset equals its owner's equation; untouched groups' owned members did not move.
    const touched = new Set([ops.retime.group, ops.scale.group, ops.set.group]);
    for (const x of t.input.notes) {
      const g = owner(t.input, x.id);
      if (g) assert.equal(cmp(notesAfter.get(x.id).at, onsetByEquation(t.expected, x.id)), 0);
      if (!g || !touched.has(g.id)) assert.equal(notesAfter.get(x.id).at, x.at, `${x.id} moved`);
    }
  }
});

test('large-edit: exactly N rich notes; only the moved note and the retimed group change', () => {
  for (const N of FAMILIES['large-edit'].levels) {
    const t = build('large-edit', N), { ops } = t.ladder;
    assert.equal(t.input.notes.length, N);
    const notes = t.input.notes;
    assert(notes.some(x => x.annotation) && notes.some(x => x.chance) && notes.some(x => x.expression) && notes.some(x => x.nominal), `${N}: rich fields`);
    assert(Object.keys(t.input.musical.nominal).length && t.input.groups.some(g => g.presentationOrder) && t.input.groups.some(g => g.state === 'current'));
    const retimed = new Set(Object.keys(groupById(t.input).get(ops.retime.group).spread));
    const changedNotes = t.expected.notes.filter((x, i) => canonical(x) !== canonical(notes[i])).map(x => x.id).sort();
    assert.deepEqual(changedNotes, [ops.move.note, ...retimed].sort());
    for (const id of [ops.move.note, ...retimed]) assert(!Object.hasOwn(t.input.musical.nominal, id) && !byId(t.input).get(id).nominal, `${id}: no nominal`);
    const changedGroups = t.expected.groups.filter((g, i) => canonical(g) !== canonical(t.input.groups[i])).map(g => g.id).sort();
    assert.deepEqual(changedGroups, [ops.move.from, ops.move.to, ops.retime.group].sort());
    assert.equal(canonical(t.expected.musical), canonical(t.input.musical));
    const to = groupById(t.expected).get(ops.move.to);
    assert.equal(to.members.at(-1), ops.move.note);
    assert.equal(cmp(byId(t.expected).get(ops.move.note).at, add(add(to.anchor, to.delay), ops.move.spread)), 0);
  }
});

test('interp-maintain: lifecycle matches the reference editor; declared intent and velocity-only edits stay', () => {
  for (const E of FAMILIES['interp-maintain'].levels) for (const k of [1, 2, 3]) {
    const t = build('interp-maintain', E, k), edits = t.ladder.edited;
    // Reference: structured.mjs editNote for every non-anchor edit (an onset-spread edit is an onset edit).
    if (!edits.some(e => e.kind === 'anchor')) {
      let f = t.input;
      for (const e of edits) {
        const x = f.notes.find(n => n.id === e.note), g = e.group && f.groups.find(gr => gr.id === e.group);
        const set = { velocity: () => ({ velocity: e.velocity }), pitch: () => ({ pitch: e.pitch }), duration: () => ({ duration: e.duration }),
          'loose-onset': () => ({ at: add(x.at, e.by) }), 'onset-spread': () => ({ at: add(add(g.anchor, g.delay), e.spread) }) }[e.kind]();
        f = editNote(f, e.note, set).fixture;
      }
      assert.equal(canonical(f), canonical(t.expected), `${E}/${k}: reference lifecycle`);
    }
    // Rule checks that cover anchor edits too.
    const before = groupById(t.input), after = groupById(t.expected);
    for (const g of t.input.groups) {
      if (g.provenance.kind === 'declared') assert.equal(after.get(g.id).state, undefined, `${g.id}: declared stays`);
    }
    for (const e of edits.filter(e => e.kind === 'velocity')) {
      const containers = t.input.groups.filter(g => g.members.includes(e.note));
      const others = new Set(edits.filter(o => o !== e && o.kind !== 'velocity').flatMap(o => o.kind === 'anchor' ? Object.keys(before.get(o.group).spread) : [o.note]));
      for (const g of containers) if (!g.members.some(id => others.has(id))) assert.equal(after.get(g.id).state, g.state, `${g.id}: velocity-only`);
      assert.equal(canonical(t.expected.musical.nominal[e.note] ?? null), canonical(t.input.musical.nominal[e.note] ?? null));
    }
    for (const e of edits.filter(e => e.kind === 'anchor')) for (const id of Object.keys(before.get(e.group).spread)) {
      for (const g of t.input.groups.filter(g => g.members.includes(id) && g.provenance.kind === 'inferred')) assert.equal(after.get(g.id).state, 'stale');
      const entry = t.input.musical.nominal[id];
      if (entry && !entry.provenance) assert.equal(t.expected.musical.nominal[id].state, 'stale', `${id}: inherited nominal`);
    }
  }
});

test('wrong answers are level-aware and distinct from the oracle', () => {
  const expectations = { 'query-edit': ['upper-bound-inclusive', 'onsets-omit-delay', 'delay-moved-instead-of-anchor'],
    'overlap-edit': ['retime-moves-referenced-members', 'scale-moves-referenced-members', 'removed-from-every-other-group'],
    'large-edit': ['moved-note-keeps-onset', 'nominal-entry-dropped', 'annotation-dropped'],
    'interp-maintain': ['velocity-edit-stales', 'declared-groups-staled', 'mapped-inheritance-ignored', 'anchor-member-nominals-kept'] };
  for (const [family, ladder] of Object.entries(FAMILIES)) {
    for (const level of ladder.levels) {
      const t = build(family, level), variants = FAMILY_WRONG[family](t);
      assert.equal(new Set(variants.map(v => v.name)).size, variants.length);
      for (const v of variants) {
        assert.notEqual(canonical(v.fixture), canonical(t.expected), `${family} ${level}: ${v.name}`);
        validateStructuredFixture(v.fixture);
      }
    }
    const top = FAMILY_WRONG[family](build(family, ladder.levels.at(-1))).map(v => v.name);
    for (const name of expectations[family]) assert(top.includes(name), `${family}: ${name} at the top level`);
  }
  // A misreading that cannot occur at a level is omitted (no anchor edit at two edits).
  assert(!FAMILY_WRONG['interp-maintain'](build('interp-maintain', 2)).some(v => v.name === 'anchor-member-nominals-kept'));
});

test('R01-D20: v4 calibration packages regenerate from task code and pin their full pass', () => {
  for (const [name, cohort] of [['round2-development-v4-haiku', 'claude-current'], ['round2-development-v4-luna', 'codex-current-high']]) {
    const pkg = resolvePackage(name), pin = loadExecution(name), m = pkg.manifest;
    assert.deepEqual([m.cohort, m.selectionVersion, m.packageVersion, m.windows, m.velocitySeed, m.syntheticSeed],
      [cohort, 4, name, null, null, 'r01-round2-families-v1']);
    assert.deepEqual([m.counts.tasks, m.counts.eligibleCells, m.counts.diagnosticCells], [16, 32, 0]);
    assert.deepEqual(Object.fromEntries(Object.entries(m.ladders).map(([f, l]) => [f, l.levels])),
      Object.fromEntries(Object.entries(LADDERS_V4[cohort]).map(([f, l]) => [f, l.levels])));
    assert(m.cells.filter(c => c.eligible).every(c => ['c3-fields', 'c4-fields'].includes(c.arm)));
    const full = round2Selection({ version: 4, packageCohort: cohort });
    assert.deepEqual([full.cohorts, full.seed, full.repeats, full.pass, full.subset], [[cohort], 'r01-round2-order-v4', 1, 'calibration', false]);
    assert.deepEqual(selectionFor(JSON.parse(JSON.stringify(full))), full);
    const plan = pilotPlan(m, full);
    assert.equal(plan.runs.length, 32);
    assert(plan.runs.every(r => r.timeoutMs === m.timeouts.byTask[r.task] && r.timeoutMs >= 120000));
    assert.equal(pin.package.windowsSha256, null);
    assert.deepEqual(pin.controls.decisions.slice(-2), ['R01-D19', 'R01-D20']);
    assert.equal(pin.controls.contextPolicies[cohort], cohort === 'codex-current-high' ? 'r01-codex-context-policy-v5' : 'r01-claude-context-policy-v2');
    assert.equal(pin.rehearsal.counts.wrongAnswersRejected, pin.rehearsal.counts.wrongAnswersScored);
    assert.deepEqual([pin.rehearsal.counts.goldenPasses, pin.rehearsal.counts.notDistinguishing, pin.rehearsal.counts.unencodable], [32, 0, 0]);
    assert(checkExecution(pin, pkg, plan));
  }
  // Both cohorts see byte-identical prompts for the same cell (shared calibration ladder).
  const [h, l] = ['round2-development-v4-haiku', 'round2-development-v4-luna'].map(resolvePackage);
  assert.deepEqual(h.pairs.map(p => [p.id, p.prompt]), l.pairs.map(p => [p.id, p.prompt]));
  assert.throws(() => round2Selection({ version: 4 }), /package cohort/);
});

test('R01-D21: v5 recalibrates Haiku above v4; v6 runs one shared ladder on fresh instances for both models', async () => {
  const { LADDERS_V5, LADDERS_V6, V6_LUNA_LEVELS, V6_HAIKU_LEVELS, V6_INSTANCES } = await import('./round2-families.mjs');
  const v5 = resolvePackage('round2-development-v5-haiku'), pin5 = loadExecution('round2-development-v5-haiku');
  assert.deepEqual([v5.manifest.cohort, v5.manifest.selectionVersion, v5.manifest.counts.eligibleCells], ['claude-current', 5, 18]);
  const cal = round2Selection({ version: 5, packageCohort: 'claude-current' });
  assert.equal(cal.pass, 'calibration');
  assert(checkExecution(pin5, v5, pilotPlan(v5.manifest, cal)));
  for (const [family, ladder] of Object.entries(LADDERS_V5['claude-current']))
    assert(Math.min(...ladder.levels) > Math.max(...FAMILIES[family].levels), `${family}: above v4`);
  // Interp beyond 17 edits needs more loose notes; v4 levels are unchanged by that rule (v4 regenerates above).
  assert.equal(build('interp-maintain', 32).input.notes.filter(x => /^l\d+$/.test(x.id)).length, 7);
  // v6: the union of the per-model levels, identical tasks and prompts for both models.
  for (const [family, ladder] of Object.entries(LADDERS_V6['claude-current']))
    assert.deepEqual(ladder.levels, [...new Set([...V6_LUNA_LEVELS[family], ...V6_HAIKU_LEVELS[family]])].sort((a, b) => a - b));
  const [h, l] = ['round2-development-v6-haiku', 'round2-development-v6-luna'].map(resolvePackage);
  assert.deepEqual(h.pairs.map(p => [p.id, p.prompt]), l.pairs.map(p => [p.id, p.prompt]));
  const calibrationInputs = new Set([...resolvePackage('round2-development-v4-haiku').tasks, ...v5.tasks].map(t => canonical(t.input)));
  for (const [pkg, cohort] of [[h, 'claude-current'], [l, 'codex-current-high']]) {
    const m = pkg.manifest, pin = loadExecution(pkg.name);
    assert.deepEqual([m.cohort, m.selectionVersion, m.counts.tasks, m.counts.eligibleCells], [cohort, 6, 144, 288]);
    assert(pkg.tasks.every(t => V6_INSTANCES.includes(t.ladder.instance) && !calibrationInputs.has(canonical(t.input))), 'fresh instances only');
    const full = round2Selection({ version: 6, packageCohort: cohort });
    assert.deepEqual([full.seed, full.pass, full.subset], ['r01-round2-order-v6', 'development', false]);
    const plan = pilotPlan(m, full);
    assert.equal(plan.runs.length, 288);
    assert.deepEqual([pin.rehearsal.counts.goldenPasses, pin.rehearsal.counts.notDistinguishing], [288, 0]);
    assert.equal(pin.rehearsal.counts.wrongAnswersRejected, pin.rehearsal.counts.wrongAnswersScored);
    assert(checkExecution(pin, pkg, plan));
  }
});
