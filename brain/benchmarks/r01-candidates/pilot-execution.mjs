// R01 pilot execution manifest and task-specific offline rehearsal
// (development or rigorous stage). The manifest pins one package's payload, oracle and
// prompt hashes together with the pilot runner's materialized order. The
// rehearsal scores named, task-specific wrong answers on every eligible cell
// and requires each to fail while every golden passes. No model call occurs.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { add, canonical, cmp, equivalence, mul, numeric, rational, spell } from './common.mjs';
import { SCORING_VERSION, goldenResponse, scoreResponse, surfaces } from './development-surfaces.mjs';
import { FEEDBACK_VERSION } from './cli-paired-runner.mjs';
import { orderOf, pilotPlan, pilotSelection, planSha256, resolvePackage, round2Selection } from './cli-pilot-runner.mjs';
import { sha } from './cli-attempt.mjs';
import { FAMILY_WRONG } from './round2-families.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const json = value => JSON.stringify(value, null, 2) + '\n';
const clone = structuredClone;
const subtract = (a, b) => add(a, mul(b, '-1'));
const byOnsetThenId = (a, b) => cmp(a.at, b.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// ---------------------------------------------------------------------------
// Task-specific wrong answers. Each variant is a plausible misreading of one
// task: a fixture (encoded per arm) or raw response text. Variants that equal
// the oracle under the task's own comparison are dropped and listed, so a
// "rejected" count never includes an answer that was actually correct.

const byId = notes => new Map(notes.map(n => [n.id, n]));
const sortedNotes = notes => [...notes].sort((a, b) => cmp(a.at, b.at) || a.pitch - b.pitch || a.id.localeCompare(b.id));
const changed = (input, expected, field) => {
  const before = byId(input.notes);
  return expected.notes.filter(n => before.has(n.id) && before.get(n.id)[field] !== n[field]);
};
/** The note after `target` in onset/pitch/ID order (or before it, at the end). */
function neighbor(notes, target) {
  const order = sortedNotes(notes), i = order.findIndex(n => n.id === target.id);
  return order[i + 1] ?? order[i - 1];
}
const surface = (name, fixture) => ({ name, kind: 'surface', fixture });
const text = (name, value) => ({ name, kind: 'text', text: value });
const answer = (name, value) => text(name, JSON.stringify(value));
const mapNotes = (fixture, fn) => ({ ...clone(fixture), notes: fixture.notes.map(n => fn(clone(n))) });
/** Rewrite a timed group's delay/spreads and recompute its member onsets consistently. */
function regroup(fixture, groupId, { delay, spread }) {
  const result = clone(fixture), group = result.groups.find(g => g.id === groupId);
  if (delay !== undefined) group.delay = delay;
  if (spread) group.spread = Object.fromEntries(group.members.map(id => [id, spread(group.spread[id])]));
  for (const note of result.notes) if (group.members.includes(note.id))
    note.at = add(add(group.anchor, group.delay), group.spread[note.id]);
  return result;
}

const WRONG = {
  'p01-read-count-window'(task) {
    const notes = task.input.notes, { total, before } = task.answer;
    return [
      answer('total-off-by-one', { total: total - 1, before }),
      answer('before-includes-onset-8', { total, before: notes.filter(n => cmp(n.at, '8') <= 0).length }),
      answer('before-counts-eight-bars', { total, before: notes.filter(n => cmp(n.at, '32') < 0).length }),
      answer('total-collapses-pitch-onset-duplicates', { total: new Set(notes.map(n => `${n.pitch}@${n.at}`)).size, before }),
      answer('fields-swapped', { total: before, before: total }),
      answer('counts-as-strings', { total: String(total), before: String(before) }),
      answer('missing-before', { total }),
    ];
  },
  'p02-read-group-timing'(task) {
    const group = task.input.groups[0], { delay, spread, at } = task.answer;
    const other = group.members.find(id => group.spread[id] !== spread);
    return [
      answer('delay-and-spread-swapped', { delay: spread, spread: delay, at }),
      answer('onset-omits-common-delay', { delay, spread, at: add(group.anchor, spread) }),
      answer('onset-omits-spread', { delay, spread, at: add(group.anchor, delay) }),
      answer('another-members-spread', { delay, spread: group.spread[other], at }),
      answer('decimal-instead-of-rational', { delay, spread, at: String(numeric(at)) }),
    ];
  },
  'p03-author-constrained'(task) {
    const notes = task.expected.notes;
    return [
      surface('one-note-missing', { notes: notes.slice(0, -1) }),
      surface('extra-seventh-note', { notes: [...notes, { ...notes[0], id: 'new7', pitch: notes[0].pitch + 1 }] }),
      surface('two-onsets-swapped', mapNotes(task.expected, n => n.id === notes[0].id ? { ...n, at: notes[1].at }
        : n.id === notes[1].id ? { ...n, at: notes[0].at } : n)),
      surface('pitch-off-by-octave', mapNotes(task.expected, n => n.id === notes[2].id ? { ...n, pitch: n.pitch + 12 } : n)),
      surface('velocities-default-100', mapNotes(task.expected, n => ({ ...n, velocity: 100 }))),
    ];
  },
  'p04-author-known-spread'(task) {
    const expected = task.expected, group = expected.groups[0];
    const groupWith = patch => ({ ...clone(expected), groups: [{ ...clone(group), ...patch }] });
    return [
      surface('onset-omits-common-delay', regroup(expected, group.id, { delay: '0' })),
      surface('spreads-doubled', regroup(expected, group.id, { spread: s => mul(s, '2') })),
      surface('group-omitted', { notes: clone(expected.notes) }),
      surface('performance-order-reversed', groupWith({ performanceOrder: [...group.performanceOrder].reverse() })),
      surface('provenance-inferred', groupWith({ provenance: { kind: 'inferred', source: group.provenance.source } })),
      surface('label-omitted', (() => { const f = clone(expected); delete f.groups[0].label; return f; })()),
    ];
  },
  'p05-edit-velocity-large'(task) {
    const [target] = changed(task.input, task.expected, 'velocity'), value = byId(task.expected.notes).get(target.id).velocity;
    const other = neighbor(task.input.notes, target), original = byId(task.input.notes).get(target.id);
    return [
      surface('untouched-target', clone(task.input)),
      surface('wrong-note-edited', mapNotes(task.input, n => n.id === other.id ? { ...n, velocity: value } : n)),
      surface('whole-onset-edited', mapNotes(task.input, n => n.at === original.at ? { ...n, velocity: value } : n)),
      surface('whole-pitch-edited', mapNotes(task.input, n => n.pitch === original.pitch ? { ...n, velocity: value } : n)),
      surface('target-deleted', { notes: task.input.notes.filter(n => n.id !== target.id) }),
      surface('other-velocities-reset-64', mapNotes(task.expected, n => n.id === target.id ? n : { ...n, velocity: 64 })),
    ];
  },
  'p06-edit-transpose'(task) {
    const [target] = changed(task.input, task.expected, 'pitch'), other = neighbor(task.input.notes, target);
    const original = byId(task.input.notes).get(target.id);
    const shift = (pred, by) => mapNotes(task.input, n => pred(n) ? { ...n, pitch: n.pitch + by } : n);
    return [
      surface('untouched-target', clone(task.input)),
      surface('transposed-down', shift(n => n.id === target.id, -2)),
      surface('transposed-one-semitone', shift(n => n.id === target.id, 1)),
      surface('wrong-note-transposed', shift(n => n.id === other.id, 2)),
      surface('whole-onset-transposed', shift(n => n.at === original.at, 2)),
      surface('copy-added-original-kept', { notes: [...clone(task.input.notes), { ...original, id: `${original.id}copy`, pitch: original.pitch + 2 }] }),
      surface('end-time-preserved-duration-changed', mapNotes(task.expected, n => n.id === target.id ? { ...n, duration: add(n.duration, '1/4') } : n)),
    ];
  },
  'p07-halve-group-spread'(task) {
    const input = task.input, group = input.groups[0];
    const loose = input.notes.find(n => !input.groups.some(g => g.members.includes(n.id)));
    const halved = regroup(input, group.id, { spread: s => mul(s, '1/2') });
    return [
      surface('untouched', clone(input)),
      surface('spreads-doubled', regroup(input, group.id, { spread: s => mul(s, '2') })),
      surface('spreads-quartered', regroup(input, group.id, { spread: s => mul(s, '1/4') })),
      surface('common-delay-halved-too', regroup(halved, group.id, { delay: mul(group.delay, '1/2') })),
      surface('protected-group-dropped', { ...clone(task.expected), groups: [clone(task.expected.groups[0])] }),
      surface('loose-note-moved', mapNotes(task.expected, n => n.id === loose.id ? { ...n, at: add(n.at, '1/8') } : n)),
    ];
  },
  'p08-shift-onset-range'(task) {
    const before = byId(task.input.notes), moved = new Set(changed(task.input, task.expected, 'at').map(n => n.id));
    const [, from, to] = task.request.match(/at least (\S+) and less than (\S+) /);
    const inRange = (n, a, b) => cmp(n.at, a) >= 0 && cmp(n.at, b) < 0;
    const shift = (pred, by, durationBy = null) => mapNotes(task.input, n => !pred(n) ? n
      : { ...n, at: add(n.at, by), duration: durationBy ? add(n.duration, durationBy) : n.duration });
    const canShorten = [...moved].every(id => cmp(before.get(id).duration, '1/8') > 0);
    return [
      surface('untouched', clone(task.input)),
      surface('moved-end-time-not-onset', shift(n => moved.has(n.id), '0', '1/8')),
      ...canShorten ? [surface('end-time-preserved', shift(n => moved.has(n.id), '1/8', '-1/8'))] : [],
      surface('shifted-earlier', shift(n => moved.has(n.id), '-1/8')),
      surface('shifted-by-quarter-beat', shift(n => moved.has(n.id), '1/4')),
      surface('inclusive-upper-bound', shift(n => cmp(n.at, from) >= 0 && cmp(n.at, to) <= 0, '1/8')),
      surface('range-one-quarter-late', shift(n => inRange(n, add(from, '1'), add(to, '1')), '1/8')),
      surface('every-note-shifted', shift(() => true, '1/8')),
    ];
  },
  'p09-delete-one-note'(task) {
    const kept = new Set(task.expected.notes.map(n => n.id)), target = task.input.notes.find(n => !kept.has(n.id));
    const other = neighbor(task.input.notes, target);
    return [
      surface('untouched-target', clone(task.input)),
      surface('wrong-note-deleted', { notes: task.input.notes.filter(n => n.id !== other.id) }),
      surface('neighbor-deleted-too', { notes: task.input.notes.filter(n => n.id !== target.id && n.id !== other.id) }),
      surface('whole-pitch-deleted', { notes: task.input.notes.filter(n => n.pitch !== target.pitch) }),
      surface('whole-onset-deleted', { notes: task.input.notes.filter(n => n.at !== target.at) }),
    ];
  },
  'p10-refuse-ambiguous-pitch'(task) {
    const matches = task.input.notes.filter(n => n.pitch === 64 && cmp(n.at, '2') >= 0 && cmp(n.at, '3') < 0);
    assert.equal(matches.length, 2);
    return [
      text('wrong-refusal-code', 'REFUSE ambiguous'),
      text('unsupported-refusal-code', 'REFUSE unsupported'),
      text('refusal-with-explanation', `REFUSE ${task.refusal}: two notes match`),
      text('lowercase-refusal', `refuse ${task.refusal}`),
      surface('first-match-deleted', { notes: task.input.notes.filter(n => n.id !== matches[0].id) }),
      surface('both-matches-deleted', { notes: task.input.notes.filter(n => !matches.includes(n)) }),
      surface('untouched-input', clone(task.input)),
    ];
  },
  // Package v4 (D61) replacements.
  'p01-read-sounding-at'(task) {
    const notes = task.input.notes, { total, sounding } = task.answer;
    const [, t] = task.request.match(/sounding at quarter (\S+):/);
    const end = n => add(n.at, n.duration), count = pred => notes.filter(pred).length;
    return [
      answer('total-off-by-one', { total: total - 1, sounding }),
      answer('excludes-note-starting-at-t', { total, sounding: count(n => cmp(n.at, t) < 0 && cmp(end(n), t) > 0) }),
      answer('includes-note-ending-at-t', { total, sounding: count(n => cmp(n.at, t) <= 0 && cmp(end(n), t) >= 0) }),
      answer('counts-onsets-before-t', { total, sounding: count(n => cmp(n.at, t) < 0) }),
      answer('counts-onsets-at-t-only', { total, sounding: count(n => cmp(n.at, t) === 0) }),
      answer('counts-as-strings', { total: String(total), sounding: String(sounding) }),
      answer('missing-sounding', { total }),
    ];
  },
  'p06-transpose-every-pitch'(task) {
    const moved = changed(task.input, task.expected, 'pitch').map(n => n.id), pitch = byId(task.input.notes).get(moved[0]).pitch;
    const targets = sortedNotes(task.input.notes.filter(n => moved.includes(n.id)));
    const shift = (pred, by) => mapNotes(task.input, n => pred(n) ? { ...n, pitch: n.pitch + by } : n);
    const nearby = [...new Set(task.input.notes.map(n => n.pitch))].filter(p => p !== pitch).sort((a, b) => Math.abs(a - pitch) - Math.abs(b - pitch))[0];
    return [
      surface('untouched', clone(task.input)),
      surface('first-match-only', shift(n => n.id === targets[0].id, 2)),
      surface('last-match-missed', shift(n => moved.includes(n.id) && n.id !== targets.at(-1).id, 2)),
      surface('transposed-down', shift(n => moved.includes(n.id), -2)),
      surface('transposed-one-semitone', shift(n => moved.includes(n.id), 1)),
      surface('nearest-other-pitch-transposed', shift(n => n.pitch === nearby, 2)),
      surface('copies-added-originals-kept', { notes: [...clone(task.input.notes), ...targets.map(n => ({ ...n, id: `${n.id}copy`, pitch: n.pitch + 2 }))] }),
    ];
  },
  'p07-halve-spread-move-anchor'(task) {
    const input = task.input, group = input.groups[0], target = task.expected.groups[0].anchor;
    const loose = input.notes.find(n => !input.groups.some(g => g.members.includes(n.id)));
    const reanchor = (fixture, anchor) => { const f = clone(fixture); f.groups[0].anchor = anchor; return regroup(f, group.id, {}); };
    const halved = regroup(input, group.id, { spread: s => mul(s, '1/2') });
    const onGrid = s => quantizeDown(mul(s, '1/2'), 512n);
    return [
      surface('untouched', clone(input)),
      surface('spreads-halved-anchor-kept', halved),
      surface('anchor-moved-spreads-kept', reanchor(input, target)),
      surface('halves-floored-to-grid', reanchor(regroup(input, group.id, { spread: onGrid }), target)),
      surface('common-delay-halved-too', regroup(reanchor(halved, target), group.id, { delay: mul(group.delay, '1/2') })),
      surface('protected-group-dropped', { ...clone(task.expected), groups: [clone(task.expected.groups[0])] }),
      surface('loose-note-moved', mapNotes(task.expected, n => n.id === loose.id ? { ...n, at: add(n.at, '1/8') } : n)),
    ];
  },
  'p08-shift-transpose-range'(task) {
    const [, from, to] = task.request.match(/at least (\S+) and less than (\S+),/);
    const inRange = (n, a, b, upper = false) => cmp(n.at, a) >= 0 && (upper ? cmp(n.at, b) <= 0 : cmp(n.at, b) < 0);
    const edit = (pred, { at = '1/8', pitch = 2 } = {}) => mapNotes(task.input, n => pred(n) ? { ...n, at: add(n.at, at), pitch: n.pitch + pitch } : n);
    const inside = n => inRange(n, from, to);
    return [
      surface('untouched', clone(task.input)),
      surface('shifted-not-transposed', edit(inside, { pitch: 0 })),
      surface('transposed-not-shifted', edit(inside, { at: '0' })),
      surface('exclusive-lower-bound', edit(n => cmp(n.at, from) > 0 && cmp(n.at, to) < 0)),
      surface('inclusive-upper-bound', edit(n => inRange(n, from, to, true))),
      surface('shifted-earlier', edit(inside, { at: '-1/8' })),
      surface('transposed-down', edit(inside, { pitch: -2 })),
      surface('every-note-edited', edit(() => true)),
    ];
  },
  'p09-delete-near-miss'(task) {
    const kept = new Set(task.expected.notes.map(n => n.id)), target = task.input.notes.find(n => !kept.has(n.id));
    const [, to] = task.request.match(/and less than (\S+)\./);
    const excluded = task.input.notes.find(n => n.pitch === target.pitch && cmp(n.at, to) === 0);
    return [
      text('refused-as-ambiguous', 'REFUSE ambiguous-selector'),
      surface('untouched', clone(task.input)),
      surface('boundary-note-deleted-instead', { notes: task.input.notes.filter(n => n.id !== excluded.id) }),
      surface('both-near-notes-deleted', { notes: task.input.notes.filter(n => n.id !== target.id && n.id !== excluded.id) }),
      surface('whole-pitch-deleted', { notes: task.input.notes.filter(n => n.pitch !== target.pitch) }),
      surface('wrong-note-deleted', { notes: task.input.notes.filter(n => n.id !== neighbor(task.input.notes, target).id) }),
    ];
  },
  // Package v5 (D63) group-timing tasks. Every variant is a valid fixture, so
  // its rejection is a semantic mismatch rather than a validation error.
  'p13-read-derived-window'(task) {
    const { notes, groups } = task.input, [, from, to] = task.request.match(/at least (\S+) and less than (\S+),/);
    const owner = id => groups.find(g => Object.hasOwn(g.spread ?? {}, id));
    const grouped = id => groups.some(g => g.members.includes(id));
    const select = (onset, { lower = (x, a) => cmp(x, a) >= 0, upper = (x, b) => cmp(x, b) < 0, keep = () => true, sort = byOnsetThenId } = {}) =>
      notes.map(x => ({ ...x, at: onset(x) })).filter(x => keep(x) && lower(x.at, from) && upper(x.at, to)).sort(sort).map(x => x.id);
    const performed = x => x.at, ids = (name, list) => answer(name, { ids: list });
    const order = new Map(notes.map((x, i) => [x.id, i]));
    return [
      ids('omits-common-delay', select(x => owner(x.id) ? add(owner(x.id).anchor, owner(x.id).spread[x.id]) : x.at)),
      ids('spread-only', select(x => owner(x.id)?.spread[x.id] ?? x.at)),
      ids('inclusive-upper-bound', select(performed, { upper: (x, b) => cmp(x, b) <= 0 })),
      ids('exclusive-lower-bound', select(performed, { lower: (x, a) => cmp(x, a) > 0 })),
      ids('skips-loose-notes', select(performed, { keep: x => grouped(x.id) })),
      ids('skips-timing-free-members', select(performed, { keep: x => !grouped(x.id) || owner(x.id) })),
      ids('id-order', select(performed, { sort: (a, b) => (a.id < b.id ? -1 : 1) })),
      ids('ties-in-note-order', select(performed, { sort: (a, b) => cmp(a.at, b.at) || order.get(a.id) - order.get(b.id) })),
    ];
  },
  'p14-group-existing-notes'(task) {
    const expected = task.expected, group = expected.groups.at(-1), last = group.members.at(-1);
    const others = clone(expected.groups.slice(0, -1));
    const withGroup = (patch, drop = []) => ({ notes: clone(expected.notes), groups: [...clone(others),
      Object.fromEntries(Object.entries({ ...clone(group), ...patch }).filter(([k]) => !drop.includes(k)))] });
    const { anchor, delay, spread } = group;
    const retimed = (patch, drop, onset) => {
      const f = withGroup(patch, drop);
      for (const x of f.notes) if (group.members.includes(x.id)) x.at = onset(f.groups.at(-1), x.id);
      return f;
    };
    return [
      surface('untouched', clone(task.input)),
      surface('onsets-moved-delay-dropped', retimed({}, ['delay'], (g, id) => add(anchor, g.spread[id]))),
      surface('spreads-measured-from-anchor', retimed({ spread: Object.fromEntries(group.members.map(id => [id, add(spread[id], delay)])) }, [],
        (g, id) => add(add(anchor, delay), g.spread[id]))),
      surface('group-without-timing', withGroup({}, ['anchor', 'delay', 'spread'])),
      surface('performance-order-missing', withGroup({}, ['performanceOrder'])),
      surface('one-note-left-loose', withGroup({ members: group.members.slice(0, -1),
        spread: Object.fromEntries(Object.entries(spread).filter(([id]) => id !== last)),
        performanceOrder: group.performanceOrder.filter(id => id !== last) })),
      surface('group-inserted-first', { notes: clone(expected.notes), groups: [clone(group), ...clone(others)] }),
    ];
  },
  'p15-move-member-between-groups'(task) {
    const expected = task.expected, [to, from] = expected.groups, input = task.input;
    const moved = to.members.at(-1), stated = to.spread[moved], original = input.notes.find(x => x.id === moved);
    const variant = edit => { const f = clone(expected); edit(f, f.groups[0], f.groups[1], f.notes.find(x => x.id === moved)); return f; };
    const retime = (f, target, at) => { f.notes.find(x => x.id === moved).at = at; target.spread[moved] = subtract(subtract(at, target.anchor), target.delay); };
    return [
      surface('untouched', clone(input)),
      surface('onset-kept-spread-derived', variant((f, t) => retime(f, t, original.at))),
      surface('still-member-of-source-group', variant((f, t, s) => { s.members.unshift(moved); s.performanceOrder.unshift(moved); })),
      surface('inserted-at-front-of-target', variant((f, t) => {
        t.members = [moved, ...t.members.slice(0, -1)]; t.performanceOrder = [moved, ...t.performanceOrder.slice(0, -1)];
      })),
      surface('removed-from-timing-free-group', variant(f => { const g = f.groups[2]; g.members = g.members.filter(id => id !== moved); })),
      surface('onset-omits-target-delay', variant((f, t) => retime(f, t, add(t.anchor, stated)))),
      surface('onset-from-source-equation', variant((f, t) => retime(f, t, add(add(from.anchor, from.delay), stated)))),
    ];
  },
  'p16-retime-two-groups'(task) {
    const input = task.input, expected = task.expected, [first, second] = input.groups;
    const move = subtract(expected.groups[0].anchor, first.anchor);
    const free = input.notes.find(x => !input.groups.some(g => g.members.includes(x.id)));
    const untimed = input.groups[2].members.find(id => !input.groups.some(g => Object.hasOwn(g.spread ?? {}, id)));
    const reanchor = (fixture, patch) => { const f = clone(fixture); Object.assign(f.groups[0], patch); return regroup(f, first.id, {}); };
    const moved = fixture => reanchor(fixture, { anchor: expected.groups[0].anchor });
    const shift = (fixture, id) => mapNotes(fixture, x => x.id === id ? { ...x, at: add(x.at, move) } : x);
    return [
      surface('untouched', clone(input)),
      surface('only-first-group-changed', moved(input)),
      surface('only-second-group-changed', regroup(input, second.id, { spread: s => mul(s, '2') })),
      surface('second-group-spreads-halved', regroup(moved(input), second.id, { spread: s => mul(s, '1/2') })),
      surface('first-group-delay-moved-too', reanchor(expected, { delay: add(first.delay, move) })),
      surface('loose-note-moved', shift(expected, free.id)),
      surface('untimed-member-moved', shift(expected, untimed)),
      surface('timing-free-group-dropped', { ...clone(expected), groups: clone(expected.groups.slice(0, 2)) }),
    ];
  },
  'p11-preserve-window'(task) {
    const notes = task.expected.notes, last = sortedNotes(notes).at(-1);
    return [
      surface('one-note-dropped', { notes: notes.filter(n => n.id !== last.id) }),
      surface('velocities-reset-64', mapNotes(task.expected, n => ({ ...n, velocity: 64 }))),
      surface('onsets-quantized-sixteenth', mapNotes(task.expected, n => ({ ...n, at: quantize(n.at, 4n) }))),
      surface('duplicate-added', { notes: [...clone(notes), { ...last, id: `${last.id}dup` }] }),
      surface('durations-halved', mapNotes(task.expected, n => ({ ...n, duration: mul(n.duration, '1/2') }))),
    ];
  },
  'p12-preserve-exact-wider'(task) {
    const without = (i, key) => { const f = clone(task.expected); delete f.notes[i][key]; return f; };
    return [
      surface('annotation-dropped', without(1, 'annotation')),
      surface('note-order-swapped', { notes: [task.expected.notes[1], task.expected.notes[0], task.expected.notes[2]].map(n => clone(n)) }),
      surface('onset-rounded-to-1-512', mapNotes(task.expected, n => n.id === 'x1' ? { ...n, at: quantize(n.at, 512n) } : n)),
      surface('pan-zeroed', mapNotes(task.expected, n => n.expression ? { ...n, expression: { ...n.expression, pan: 0 } } : n)),
      surface('chance-dropped', without(0, 'chance')),
      surface('channel-defaulted', mapNotes(task.expected, n => n.id === 'x2' ? { ...n, channel: 1 } : n)),
    ];
  },
};

/** Floor a nonnegative rational to a 1/perQuarter grid, as a reduced rational. */
function quantizeDown(value, perQuarter) {
  const [n, d] = rational(value);
  return spell((n * perQuarter) / d, perQuarter);
}

/** Round a rational onset to the nearest 1/perQuarter quarter, as a reduced rational. */
function quantize(at, perQuarter) {
  const [n, d] = rational(at);
  return spell((2n * n * perQuarter + d) / (2n * d), perQuarter);
}

/** Respell every rational string outside opaque annotations with a doubled denominator. */
function unreduce(value, key = null) {
  if (key === 'annotation') return value;
  if (typeof value === 'string' && /^-?\d+(\/[1-9]\d*)?$/.test(value) && key !== 'id') {
    const [n, d] = rational(value); return `${2n * n}/${2n * d}`;
  }
  if (Array.isArray(value)) return value.map(v => unreduce(v, key === 'members' || key === 'performanceOrder' ? 'id' : null));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, unreduce(v, k)]));
  return value;
}

// Round 2 (R01-D13): each ladder family reuses its round-1 task's variants,
// which read their bounds from the request and their targets from the fixtures,
// and adds level-aware variants that miss one of several requested operations.
const LADDER_WRONG = {
  'derived-read'(task) {
    const base = WRONG['p13-read-derived-window'](task), { notes, groups } = task.input;
    const [, from, to] = task.request.match(/at least (\S+) and less than (\S+),/);
    const timed = groups.filter(g => g.spread), last = timed.at(-1);
    const onset = x => last.members.includes(x.id) ? add(last.anchor, last.spread[x.id]) : x.at;
    const ids = notes.map(x => ({ ...x, at: onset(x) })).filter(x => cmp(x.at, from) >= 0 && cmp(x.at, to) < 0).sort(byOnsetThenId).map(x => x.id);
    const firstOnly = notes.filter(x => cmp(x.at, from) >= 0 && cmp(x.at, to) < 0 && !timed.slice(1).some(g => g.members.includes(x.id)))
      .sort(byOnsetThenId).map(x => x.id);
    return [...base, answer('last-group-omits-delay', { ids }),
      ...timed.length > 1 ? [answer('later-groups-skipped', { ids: firstOnly })] : []];
  },
  'group-retime'(task) {
    const ops = task.ladder.ops, input = task.input, pad = input.groups.find(g => !g.spread);
    const apply = (list, edit = (g, op) => { if (op.op === 'move-anchor') g.anchor = add(g.anchor, op.by);
      else g.spread = Object.fromEntries(g.members.map(x => [x, mul(g.spread[x], '2')])); }) => {
      let f = clone(input);
      for (const op of list) edit(f.groups.find(x => x.id === op.group), op);
      for (const op of list) f = regroup(f, op.group, {});
      return f;
    };
    const by = ops[0].by, loose = input.notes.find(x => !input.groups.some(g => g.members.includes(x.id)));
    const untimed = pad.members.find(id => !input.groups.some(g => Object.hasOwn(g.spread ?? {}, id)));
    const shift = (f, id) => mapNotes(f, x => x.id === id ? { ...x, at: add(x.at, by) } : x);
    const swapped = ops.map(o => o.op === 'move-anchor' ? { op: 'double-spreads', group: o.group } : { op: 'move-anchor', group: o.group, by });
    return [
      surface('untouched', clone(input)),
      surface('last-change-missing', apply(ops.slice(0, -1))),
      surface('anchors-moved-earlier', apply(ops, (g, op) => { if (op.op === 'move-anchor') g.anchor = subtract(g.anchor, op.by);
        else g.spread = Object.fromEntries(g.members.map(x => [x, mul(g.spread[x], '2')])); })),
      surface('delay-moved-instead-of-anchor', apply(ops, (g, op) => { if (op.op === 'move-anchor') g.delay = add(g.delay, op.by);
        else g.spread = Object.fromEntries(g.members.map(x => [x, mul(g.spread[x], '2')])); })),
      ...ops.length >= 2 ? [surface('operations-swapped-between-groups', apply(swapped)),
        surface('spreads-halved-instead', apply(ops, (g, op) => { if (op.op === 'move-anchor') g.anchor = add(g.anchor, op.by);
          else g.spread = Object.fromEntries(g.members.map(x => [x, mul(g.spread[x], '1/2')])); }))] : [],
      surface('loose-note-moved', shift(task.expected, loose.id)),
      surface('untimed-member-moved', shift(task.expected, untimed)),
      surface('timing-free-group-dropped', { ...clone(task.expected), groups: clone(task.expected.groups.filter(g => g.id !== pad.id)) }),
    ];
  },
  regroup(task) {
    const expected = task.expected, created = expected.groups.slice(1), base = WRONG['p14-group-existing-notes'](task);
    const variants = [...base, surface('last-group-not-created', { notes: clone(expected.notes), groups: clone(expected.groups.slice(0, -1)) })];
    if (created.length > 1) {
      const first = clone(expected), g = first.groups[1];
      g.spread = Object.fromEntries(g.members.map(id => [id, add(g.spread[id], g.delay)]));
      variants.push(surface('first-group-spreads-measured-from-anchor', regroup(first, g.id, {})));
    }
    return variants;
  },
  'member-move'(task) {
    const moves = task.ladder.moves, input = task.input;
    const apply = (list, { onset = (to, m) => add(add(to.anchor, to.delay), m.spread), front = false, leavePad = false } = {}) => {
      const f = clone(input), group = id => f.groups.find(g => g.id === id), pad = f.groups.find(g => !g.spread);
      for (const m of list) {
        const to = group(m.to), from = group(m.from), note = f.notes.find(x => x.id === m.note);
        to.members[front ? 'unshift' : 'push'](m.note); to.performanceOrder[front ? 'unshift' : 'push'](m.note);
        note.at = onset(to, m, note); to.spread[m.note] = subtract(subtract(note.at, to.anchor), to.delay);
        from.members = from.members.filter(x => x !== m.note); from.performanceOrder = from.performanceOrder.filter(x => x !== m.note);
        delete from.spread[m.note];
        if (leavePad) pad.members = pad.members.filter(x => x !== m.note);
      }
      return f;
    };
    const variants = [
      surface('untouched', clone(input)),
      surface('last-move-missing', apply(moves.slice(0, -1))),
      surface('onsets-kept-spreads-derived', apply(moves, { onset: (to, m, note) => note.at })),
      surface('onsets-omit-target-delay', apply(moves, { onset: (to, m) => add(to.anchor, m.spread) })),
      surface('onsets-from-source-equation', apply(moves, { onset: (to, m) => { const from = input.groups.find(g => g.id === m.from);
        return add(add(from.anchor, from.delay), m.spread); } })),
      surface('inserted-at-front-of-target', apply(moves, { front: true })),
    ];
    if (input.groups.find(g => !g.spread).members.some(id => moves.some(m => m.note === id)))
      variants.push(surface('removed-from-timing-free-group', apply(moves, { leavePad: true })));
    return variants;
  },
  'range-edit'(task) {
    const base = WRONG['p08-shift-transpose-range'](task);
    const moved = new Set(changed(task.input, task.expected, 'at').map(n => n.id));
    const last = sortedNotes(task.input.notes.filter(n => moved.has(n.id))).at(-1);
    return [...base, surface('last-range-note-missed', mapNotes(task.expected, n => n.id === last.id ? clone(byId(task.input.notes).get(n.id)) : n))];
  },
  'selective-delete'(task) {
    const base = WRONG['p09-delete-near-miss'](task), { nearMissIds, target } = task.ladder;
    const misses = task.input.notes.filter(n => nearMissIds.includes(n.id));
    const before = misses.filter(n => cmp(n.at, task.ladder.from) < 0);
    return [...base, surface('every-same-pitch-near-note-deleted', { notes: task.input.notes.filter(n => n.id !== target && !nearMissIds.includes(n.id)) }),
      ...before.length ? [surface('near-miss-before-range-deleted', { notes: task.input.notes.filter(n => n.id !== before.at(-1).id) })] : []];
  },
  'preserve-performed': task => WRONG['p11-preserve-window'](task),
  'preserve-exact'(task) {
    const notes = task.expected.notes;
    const offGrid = notes.findIndex(n => n.at !== quantize(n.at, 512n)), annotated = notes.findIndex(n => n.annotation), chance = notes.findIndex(n => n.chance);
    const expressive = notes.findIndex(n => n.expression), without = (i, key) => { const f = clone(task.expected); delete f.notes[i][key]; return f; };
    return [
      surface('one-note-dropped', { notes: clone(notes.slice(0, -1)) }),
      surface('annotation-dropped', without(annotated, 'annotation')),
      surface('first-two-notes-swapped', { notes: [notes[1], notes[0], ...notes.slice(2)].map(n => clone(n)) }),
      ...offGrid >= 0 ? [surface('one-onset-rounded-to-1-512', { notes: notes.map((n, i) => i === offGrid ? { ...clone(n), at: quantize(n.at, 512n) } : clone(n)) })] : [],
      surface('every-onset-rounded-to-1-512', mapNotes(task.expected, n => ({ ...n, at: quantize(n.at, 512n), duration: quantize(n.duration, 512n) }))),
      surface('chance-dropped', without(chance, 'chance')),
      surface('pan-zeroed', mapNotes(task.expected, n => n.expression ? { ...n, expression: { ...n.expression, pan: 0 } } : n)),
      surface('channel-defaulted', mapNotes(task.expected, n => n.id === notes[expressive].id ? { ...n, channel: 1 } : n)),
      surface('velocities-reset-64', mapNotes(task.expected, n => ({ ...n, velocity: 64 }))),
    ];
  },
};

/** The task's named wrong answers; refuses a task without a declared set. */
export function wrongAnswers(task) {
  const make = WRONG[task.id] ?? LADDER_WRONG[task.ladder?.family] ?? FAMILY_WRONG[task.ladder?.family];
  assert(make, `${task.id}: no task-specific wrong answers declared`);
  const variants = make(task);
  assert.equal(new Set(variants.map(v => v.name)).size, variants.length, `${task.id}: duplicate variant name`);
  return variants;
}

/** Whether a fixture variant is the oracle under the task's own comparison. */
function equalsOracle(task, variant) {
  if (variant.kind === 'text') {
    if (task.response === 'refusal') return variant.text.trim() === `REFUSE ${task.refusal}`;
    if (task.response !== 'answer') return false;
    try { return canonical(JSON.parse(variant.text)) === canonical(task.answer); } catch { return false; }
  }
  if (task.response !== 'surface') return false;
  return task.cohort === 'source' ? canonical(variant.fixture) === canonical(task.expected)
    : equivalence(task.expected.notes, variant.fixture.notes).equal;
}

/**
 * Score every eligible cell: the golden must pass, each task-specific wrong
 * answer and a gratuitous refusal must fail. Throws on any violation.
 */
export function rehearseExecution(pkg, codec) {
  const cells = pkg.manifest.cells.filter(c => c.eligible), tasks = new Map(pkg.tasks.map(t => [t.id, t]));
  const records = [], notDistinguishing = [], unencodable = [];
  for (const task of pkg.tasks) {
    for (const v of wrongAnswers(task)) if (equalsOracle(task, v))
      notDistinguishing.push({ task: task.id, variant: v.name });
  }
  const dropped = new Set(notDistinguishing.map(d => `${d.task}/${d.variant}`));
  for (const cell of cells) {
    const task = tasks.get(cell.task);
    const golden = scoreResponse(task, cell.arm, goldenResponse(task, cell.arm, codec), codec);
    assert(golden.pass, `${cell.id}: golden failed`);
    const wrong = [];
    for (const v of wrongAnswers(task).filter(v => !dropped.has(`${task.id}/${v.name}`))) {
      let response;
      try { response = v.kind === 'text' ? v.text : codec.encode(cell.arm, v.fixture); } catch (error) {
        // The arm cannot express this state, so a model cannot submit it in this format.
        unencodable.push({ cell: cell.id, variant: v.name, error: error.message.split('\n')[0] }); continue;
      }
      const score = scoreResponse(task, cell.arm, response, codec);
      assert(!score.pass, `${cell.id}: wrong answer ${v.name} accepted`);
      wrong.push({ variant: v.name, kind: v.kind, responseSha256: sha(response), pass: score.pass, reason: score.reason });
    }
    // D59: the oracle with every rational respelled unreduced must also pass.
    let equivalent = null;
    if (task.response !== 'refusal') {
      const respelled = task.response === 'answer' ? JSON.stringify(unreduce(task.answer))
        : codec.encode(cell.arm, unreduce(task.expected));
      const score = scoreResponse(task, cell.arm, respelled, codec);
      assert(score.pass, `${cell.id}: equivalent spelling rejected`);
      equivalent = { pass: score.pass, respelled: respelled !== goldenResponse(task, cell.arm, codec) };
    }
    const refusal = task.response === 'refusal' ? null : scoreResponse(task, cell.arm, 'REFUSE unsupported', codec);
    assert(!refusal?.pass, `${cell.id}: gratuitous refusal accepted`);
    records.push({ id: cell.id, task: task.id, arm: cell.arm, golden: { pass: golden.pass }, equivalentSpelling: equivalent,
      wrongAnswers: wrong, gratuitousRefusal: refusal && { pass: refusal.pass, reason: refusal.reason } });
  }
  const variants = Object.fromEntries(pkg.tasks.map(t => [t.id,
    wrongAnswers(t).map(v => v.name).filter(name => !dropped.has(`${t.id}/${name}`))]));
  const counts = { eligibleCells: records.length, goldenPasses: records.filter(r => r.golden.pass).length,
    taskSpecificVariants: Object.values(variants).reduce((s, v) => s + v.length, 0),
    wrongAnswersScored: records.reduce((s, r) => s + r.wrongAnswers.length, 0),
    wrongAnswersRejected: records.reduce((s, r) => s + r.wrongAnswers.filter(w => !w.pass).length, 0),
    gratuitousRefusalsScored: records.filter(r => r.gratuitousRefusal).length,
    gratuitousRefusalsRejected: records.filter(r => r.gratuitousRefusal && !r.gratuitousRefusal.pass).length,
    notDistinguishing: notDistinguishing.length, unencodable: unencodable.length,
    equivalentSpellingsScored: records.filter(r => r.equivalentSpelling).length,
    equivalentSpellingsAccepted: records.filter(r => r.equivalentSpelling?.pass).length,
    equivalentSpellingsDelivered: records.filter(r => r.equivalentSpelling?.respelled).length };
  return { schema: 'r01-pilot-execution-rehearsal-v2', scoring: SCORING_VERSION, stage: pkg.manifest.stage, package: pkg.name,
    packageManifestSha256: pkg.manifestSha256, counts, variants, notDistinguishing, unencodable, cells: records };
}

// ---------------------------------------------------------------------------
// Execution manifest.

export const EXECUTION_SOURCES = ['pilot-execution.mjs', 'cli-pilot-runner.mjs', 'cli-paired-runner.mjs', 'cli-trial-plan.mjs',
  'cli-controls.mjs', 'development-surfaces.mjs', 'pilot-tasks.mjs', 'pilot-package.mjs'];
const ROUND2_SOURCES = ['round2-tasks.mjs', 'round2-families.mjs', 'round2-inputs.mjs', 'round2-package.mjs', 'cli-control-audit.mjs', 'codex-context-policy.mjs',
  'codex-context-template.json', 'codex-context-template-gpt-5.6-terra.json', 'claude-context-policy.mjs'];
// Round 2 context policies and admissions (E364, E380, R01-D13); development stage, no freeze.
export const ROUND2_CONTROLS = Object.freeze({ decisions: ['D64', 'R01-D8', 'R01-D9', 'R01-D10', 'R01-D11', 'R01-D12', 'R01-D13'],
  contextPolicies: { 'claude-current': 'r01-claude-context-policy-v2', 'claude-historical-uncapped': 'r01-claude-context-policy-v1',
    'codex-current-medium': 'r01-codex-context-policy-v4', 'codex-terra': 'r01-codex-context-policy-v4', 'codex-terra-6-1': 'r01-codex-context-policy-v4' },
  retries: 'r01-retries-reported-v1',
  stopRules: 'A control failure halts; a stall gets one identical resubmission and a second consecutive stall halts; a quota pause resumes with a labeled resubmission.' });

// Rigorous-stage freeze (R01-D1-D7); recorded in a rigorous manifest.
export const RIGOROUS_FREEZE = Object.freeze({ decisions: ['D64', 'R01-D1', 'R01-D2', 'R01-D3', 'R01-D4', 'R01-D5', 'R01-D6', 'R01-D7'],
  contextPolicies: { claude: 'r01-claude-context-policy-v2', codex: 'r01-codex-context-policy-v3' }, retries: 'r01-retries-reported-v1',
  stopRules: 'A control failure halts; a stall gets one identical resubmission and a second consecutive stall halts; a quota pause resumes with a labeled resubmission. A halted full pass may restart its unfinished cohorts once, in the pinned order (R01-D6).' });

export function buildExecutionManifest(pkg, rehearsal, { selection = null, readWindows = path => readFileSync(join(root, path)) } = {}) {
  const m = pkg.manifest, stage = m.stage ?? 'development', round = m.round ?? 1;
  assert(['development', 'rigorous'].includes(stage), `unknown package stage ${stage}`);
  selection ??= round === 2 ? round2Selection({ version: m.selectionVersion ?? 1, packageCohort: m.cohort ?? null }) : pilotSelection({ stage });
  assert.equal(selection.stage, stage, 'selection stage differs from the package');
  assert.equal(selection.subset, false, 'pin the full pilot pass, not a subset');
  const plan = pilotPlan(m, selection);
  const oracles = new Map(readOracles(pkg).map(o => [o.id, o.sha256]));
  const pairs = new Map(pkg.pairs.map(p => [p.id, p]));
  const rehearsalBytes = json(rehearsal);
  return {
    schema: 'r01-pilot-execution-manifest-v1', stage, status: 'pinned-not-submitted',
    scoring: SCORING_VERSION, feedback: FEEDBACK_VERSION,
    evidence: stage === 'development' ? 'development stage: supports design iteration only, not candidate comparison'
      : 'rigorous stage: frozen versions on fresh inputs',
    ...(stage === 'rigorous' ? { freeze: RIGOROUS_FREEZE } : {}),
    ...(round === 2 ? { round, controls: ROUND2_CONTROLS_BY_VERSION[m.selectionVersion ?? 1], timeouts: { ...m.timeouts, byTask: undefined },
      ...(m.repeats ? { repeats: { ...m.repeats, byTask: undefined } } : {}) } : {}),
    package: { name: pkg.name, directory: relative(root, pkg.directory), manifestSha256: pkg.manifestSha256,
      schema: m.schema, inputVersion: m.inputVersion, windows: m.windows,
      windowsSha256: m.windows === null ? null : sha(readWindows(m.windows)), taskRules: m.taskRules.schema,
      syntheticSeed: m.syntheticSeed, velocitySeed: m.velocitySeed, counts: m.counts },
    tooling: { node: m.node, upstreamPin: m.upstreamPin, precisionPatchSha256: m.precisionPatchSha256, tokenizer: m.tokenizer },
    hashEncoding: { artifacts: 'SHA-256 of the exact UTF-8 bytes', tasks: 'SHA-256 of canonical sorted-key JSON',
      plan: 'SHA-256 of canonical sorted-key JSON of plan.json as the runner writes it' },
    selection: plan.selection,
    cohorts: plan.cohorts.map(c => ({ id: c.id, configSha256: c.configSha256, profile: c.profile })),
    plan: { schema: plan.schema, seed: plan.seed, configurationSha256: plan.configurationSha256,
      developmentManifestSha256: plan.developmentManifestSha256, planSha256: planSha256(plan, pkg), counts: plan.counts },
    tasks: pkg.tasks.map(t => ({ id: t.id, version: t.version, family: t.family, cohort: t.cohort, response: t.response,
      source: t.source, oracleSha256: sha(canonical(t)),
      ...(t.ladder ? { ladder: { family: t.ladder.family, level: t.ladder.level, instance: t.ladder.instance }, timeoutMs: m.timeouts.byTask[t.id] } : {}) })),
    cells: m.cells.map(c => c.eligible
      ? { id: c.id, task: c.task, arm: c.arm, role: c.role, eligible: true, payloadSha256: c.input.sha256,
        promptSha256: c.prompt.sha256, promptTokens: c.prompt.tokens, cardSha256: m.cards[`${c.cohort}--${c.arm}`].sha256,
        oracleSha256: oracles.get(c.id), pairInputSha256: sha(pairs.get(c.id).input) }
      : { id: c.id, task: c.task, arm: c.arm, role: c.role, eligible: false, reason: c.reason }),
    order: Object.fromEntries(plan.cohorts.map(c => [c.id, orderOf(plan, c)])),
    rehearsal: { path: 'rehearsal.json', sha256: sha(rehearsalBytes), counts: rehearsal.counts },
    sources: [...EXECUTION_SOURCES, ...(stage === 'rigorous' ? ['pilot-inputs.mjs'] : []), ...(round === 2 ? ROUND2_SOURCES : [])].map(p => ({ path: `brain/benchmarks/r01-candidates/${p}`,
      sha256: sha(readFileSync(new URL(p, import.meta.url))) })),
  };
}

// Package v2 (R01-D14): Haiku 5.5 low and Luna high.
export const ROUND2_V2_CONTROLS = Object.freeze({ ...ROUND2_CONTROLS, decisions: ['D64', 'R01-D8', 'R01-D11', 'R01-D12', 'R01-D13', 'R01-D14'],
  contextPolicies: { 'claude-current': 'r01-claude-context-policy-v2', 'codex-current-high': 'r01-codex-context-policy-v4' } });
// Package v3 (R01-D18): the same cohorts, Codex policy v5 (R01-D16), and the
// development continuations of R01-D16 and R01-D17.
export const ROUND2_V3_CONTROLS = Object.freeze({ ...ROUND2_CONTROLS,
  decisions: ['D64', 'R01-D8', 'R01-D11', 'R01-D12', 'R01-D13', 'R01-D14', 'R01-D16', 'R01-D17', 'R01-D18'],
  contextPolicies: { 'claude-current': 'r01-claude-context-policy-v2', 'codex-current-high': 'r01-codex-context-policy-v5' },
  stopRules: `${ROUND2_CONTROLS.stopRules} A development control halt may continue after re-audit (R01-D16); a two-stall halt caused by host sleep may continue (R01-D17).` });
// Package v4 (R01-D19, R01-D20): v3's controls; the full pass is a calibration.
export const ROUND2_V4_CONTROLS = Object.freeze({ ...ROUND2_V3_CONTROLS, decisions: [...ROUND2_V3_CONTROLS.decisions, 'R01-D19', 'R01-D20'] });
// Package v5 (R01-D21): Haiku-only recalibration.
export const ROUND2_V5_CONTROLS = Object.freeze({ ...ROUND2_V4_CONTROLS, decisions: [...ROUND2_V4_CONTROLS.decisions, 'R01-D21'] });
const ROUND2_CONTROLS_BY_VERSION = { 1: ROUND2_CONTROLS, 2: ROUND2_V2_CONTROLS, 3: ROUND2_V3_CONTROLS, 4: ROUND2_V4_CONTROLS, 5: ROUND2_V5_CONTROLS, 6: ROUND2_V5_CONTROLS };

function readOracles(pkg) {
  return JSON.parse(readFileSync(join(pkg.directory, 'private-oracles.json'), 'utf8')).responses;
}

export function writeExecution(output, manifest, rehearsal) {
  mkdirSync(output);
  writeFileSync(join(output, 'rehearsal.json'), json(rehearsal));
  writeFileSync(join(output, 'manifest.json'), json(manifest));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [upstream, packageName, output] = process.argv.slice(2);
  assert(upstream && packageName && output, 'usage: node --import tsx pilot-execution.mjs PINNED_PP PACKAGE NEW_OUTPUT_DIRECTORY');
  const { createAdapter } = await import('./precision.mjs');
  const adapter = await createAdapter(upstream);
  try {
    const pkg = resolvePackage(packageName), rehearsal = rehearseExecution(pkg, surfaces(adapter));
    const manifest = buildExecutionManifest(pkg, rehearsal);
    writeExecution(resolve(output), manifest, rehearsal);
    console.log(json({ plan: manifest.plan.counts, rehearsal: rehearsal.counts }));
  } finally { adapter.dispose(); }
}
