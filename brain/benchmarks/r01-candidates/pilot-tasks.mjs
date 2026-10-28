// R01 pilot tasks p01-p12 (development stage). Real-source tasks use the
// retained windows of works A-C; synthetic tasks come from a seeded generator
// with independently computed expected results. Cards, shared instructions and
// response contracts are the E358 versions (development-pairs.mjs).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { add, cmp, numeric, rational, spell } from './common.mjs';
import { DATA } from './pilot-inputs.mjs';

const clone = structuredClone;
export const SYNTHETIC_SEED = 'r01-pilot-synthetic-v1';
export const VELOCITY_SEED = 'r01-pilot-velocity-v1';
export const WINDOWS_PATH = `${DATA}/v2/windows.json`;
export const TASK_RULES = Object.freeze({
  schema: 'r01-pilot-task-rules-v2',
  target: 'Sort notes by onset, then pitch, then ID. From index floor(n/2), take the first note whose pitch/onset address is unique and whose edited result neither collides with another note address nor leaves MIDI range 0-127. Instances sharing a window choose in instance order; a later instance skips notes already targeted.',
  velocity: `Transcriptions carry placeholder velocity 64, so real windows receive synthetic dynamics from ${VELOCITY_SEED}: per-work base 64-84, phrase depth 6-12 and phase 0-7 quarters; per note, beat accent +6 (+4 more on a four-quarter downbeat) within 1/16 quarter of a beat, +2 within 1/16 of an off-beat, a triangular eight-quarter phrase swell, register emphasis round((pitch - median pitch) / 6) clamped to +/-4, and jitter -5..5; rounded and clamped to 20-120. They are not recovered performance dynamics.`,
  shiftRange: 'The first of [4,6), [6,8), [8,10), [10,12) containing at least two onsets whose shifted result has no pitch/onset collision.',
  editVelocity: '91, or 37 if the target velocity is already 91.',
  synthetic: `Seeded SHA-256 draws from ${SYNTHETIC_SEED}; spreads are even 1/512 cells so halving stays on the grid.`,
});

// Task revision 4 (package v4): harder variants of p01, p06, p07, p08 and p09
// over the same inputs, and a conditional-refusal response line for p09/p10.
export const TASK_RULES_V4 = Object.freeze({ ...TASK_RULES, schema: 'r01-pilot-task-rules-v3',
  sounding: 'Work C. T is the note onset nearest quarter 8 (earlier on a tie) at which another note ends and a third note is held across (onset < T < end); a note sounds at T when onset <= T < onset + duration.',
  transposePitch: 'Work C. Among pitches with 5-10 notes, by descending count then ascending pitch, the first whose notes can all move up two semitones within MIDI range without landing on an existing pitch/onset address.',
  shiftTransposeRange: 'Work A. Over distinct onsets F >= 4 in ascending order, T is the first distinct onset >= F + 2; take the first [F, T) holding 4-12 notes whose shifted (+1/8) and transposed (+2) results collide with no other address. Both bounds are note onsets.',
  nearMiss: 'Work B. Same-pitch onset pairs x < y with y - x <= 1 quarter, by x in the edit-target order from the median and excluding the p05 target; F = floor(x) and T = y, and x must be the only note of that pitch in [F, T). The note at T lies just outside the half-open range.',
  synthetic: `Seeded SHA-256 draws from ${SYNTHETIC_SEED}. p02/p04 spreads are even 1/512 cells; p07 (revision 4) uses six members with odd and even cells, so halving leaves the 1/512 grid.`,
});

// Task revision 5 (package v5, D63): revision 4 plus four synthetic
// group-timing tasks p13-p16 for the C3/C4 question. Earlier tasks are unchanged.
export const TASK_RULES_V5 = Object.freeze({ ...TASK_RULES_V4, schema: 'r01-pilot-task-rules-v4',
  groupTiming: `Package v5 (D63): p13-p16 are synthetic and seeded from ${SYNTHETIC_SEED} under new draw domains (p13-v5 to p16-v5). Timed groups have whole-quarter anchors, a positive common delay and strictly increasing 1/512 spread cells from 0; timing-free groups have no anchor, delay or spread. Note-array order equals C4 block traversal (timed groups, then notes homed in timing-free groups, then loose notes) in every input and expected state, so neither format must reorder rows or add order cells.`,
  readDerivedWindow: 'p13: three timed groups (5, 4 and 5 members), a timing-free group with two untimed notes and one timed member, and three loose notes. X is the derived onset of the first group\'s third member and Y that of the third group\'s third member, so omitting the common delay moves a note across each bound. One loose note shares a timed member\'s onset, so the ID tie-break applies.',
  groupExisting: 'p14: five loose notes whose onsets equal anchor + delay + spread for a hidden decomposition (delay an odd multiple of 1/128, spreads 1/512 cells) become one timed group appended after an existing timed group; the expected spreads reproduce every onset.',
  moveMember: 'p15: groups are ordered target, source, timing-free. The moved note is the source group\'s first member and also belongs to the timing-free group; its stated spread exceeds every target spread, so appending it keeps note-array order.',
  retimeTwo: 'p16: the first group\'s anchor moves later by an odd multiple of 1/16 and the second group\'s spreads (odd cells after 0) double. A timing-free group holds one member of each and an untimed note; a loose note lies between the two groups.',
});

/** Deterministic integer in [low, high] from a hash domain. */
export function draw(domain, low, high, seed = SYNTHETIC_SEED) {
  const bound = high - low + 1, limit = Math.floor(0x100000000 / bound) * bound;
  for (let counter = 0; ; counter++) {
    const value = createHash('sha256').update(JSON.stringify([seed, domain, counter])).digest().readUInt32BE(0);
    if (value < limit) return low + value % bound;
  }
}

const address = n => `${n.pitch}@${n.at}`;
const sorted = notes => [...notes].sort((a, b) => cmp(a.at, b.at) || a.pitch - b.pitch || a.id.localeCompare(b.id));

/** The edit-target rule over a normalized window; `taken` holds IDs targeted by earlier instances. */
export function editTarget(notes, edit, taken = new Set()) {
  const order = sorted(notes), counts = new Map();
  for (const n of notes) counts.set(address(n), (counts.get(address(n)) ?? 0) + 1);
  for (let i = Math.floor(order.length / 2); i < order.length; i++) {
    const note = order[i], edited = edit(note);
    if (taken.has(note.id) || counts.get(address(note)) !== 1 || edited.pitch < 0 || edited.pitch > 127) continue;
    if (address(edited) !== address(note) && counts.has(address(edited))) continue;
    return note;
  }
  throw new Error('no eligible edit target');
}

export function shiftRange(notes) {
  for (const [from, to] of [['4', '6'], ['6', '8'], ['8', '10'], ['10', '12']]) {
    const inside = n => cmp(n.at, from) >= 0 && cmp(n.at, to) < 0;
    if (notes.filter(inside).length < 2) continue;
    const after = notes.map(n => inside(n) ? { ...n, at: add(n.at, '1/8') } : n);
    if (new Set(after.map(address)).size === after.length) return { from, to, after };
  }
  throw new Error('no eligible shift range');
}

const end = n => add(n.at, n.duration);
const floorQuarter = value => { const [num, den] = rational(value); return spell(num / den); };

/** Revision 4 p01: the boundary time T and the notes sounding at T (see TASK_RULES_V4.sounding). */
export function soundingTime(notes) {
  const distance = t => Math.abs(numeric(t) - 8);
  const times = [...new Set(notes.map(n => n.at))].sort((x, y) => distance(x) - distance(y) || cmp(x, y));
  for (const t of times) {
    if (!notes.some(n => cmp(end(n), t) === 0) || !notes.some(n => cmp(n.at, t) < 0 && cmp(end(n), t) > 0)) continue;
    return { at: t, sounding: notes.filter(n => cmp(n.at, t) <= 0 && cmp(end(n), t) > 0) };
  }
  throw new Error('no boundary time');
}

/** Revision 4 p06: the pitch whose every note moves up two semitones (see TASK_RULES_V4.transposePitch). */
export function transposePitch(notes) {
  const counts = new Map(), addresses = new Set(notes.map(address));
  for (const n of notes) counts.set(n.pitch, (counts.get(n.pitch) ?? 0) + 1);
  const candidates = [...counts].filter(([, c]) => c >= 5 && c <= 10).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  for (const [pitch] of candidates) {
    if (pitch + 2 > 127) continue;
    if (notes.filter(n => n.pitch === pitch).every(n => !addresses.has(`${pitch + 2}@${n.at}`))) return pitch;
  }
  throw new Error('no eligible transpose pitch');
}

/** Revision 4 p08: a range bounded by note onsets, shifted and transposed (see TASK_RULES_V4.shiftTransposeRange). */
export function shiftTransposeRange(notes) {
  const onsets = [...new Set(notes.map(n => n.at))].sort(cmp);
  for (const from of onsets.filter(x => cmp(x, '4') >= 0)) {
    const to = onsets.find(x => cmp(x, add(from, '2')) >= 0);
    if (!to) break;
    const inside = n => cmp(n.at, from) >= 0 && cmp(n.at, to) < 0, count = notes.filter(inside).length;
    if (count < 4 || count > 12) continue;
    const after = notes.map(n => inside(n) ? { ...n, at: add(n.at, '1/8'), pitch: n.pitch + 2 } : n);
    if (after.every(n => n.pitch <= 127) && new Set(after.map(address)).size === after.length) return { from, to, count, after };
  }
  throw new Error('no eligible shift/transpose range');
}

/** Revision 4 p09: a same-pitch near miss just outside a half-open range (see TASK_RULES_V4.nearMiss). */
export function nearMiss(notes, taken = new Set()) {
  const order = sorted(notes);
  for (let i = Math.floor(order.length / 2); i < order.length; i++) {
    const x = order[i];
    if (taken.has(x.id)) continue;
    const y = order.slice(i + 1).find(n => n.pitch === x.pitch);
    if (!y || cmp(y.at, x.at) === 0 || cmp(y.at, add(x.at, '1')) > 0) continue;
    const from = floorQuarter(x.at), to = y.at;
    const matches = notes.filter(n => n.pitch === x.pitch && cmp(n.at, from) >= 0 && cmp(n.at, to) < 0);
    if (matches.length === 1 && matches[0] === x) return { target: x, excluded: y, from, to };
  }
  throw new Error('no eligible near miss');
}

export function loadWindows() {
  return JSON.parse(readFileSync(new URL(`../../../${WINDOWS_PATH}`, import.meta.url), 'utf8'));
}

/** Seeded synthetic dynamics over one work's normalized notes (see TASK_RULES.velocity). */
export function synthesizeVelocities(notes, workId) {
  const v = (domain, low, high) => draw([workId, ...domain], low, high, VELOCITY_SEED);
  const base = v(['base'], 64, 84), depth = v(['depth'], 6, 12), phase = v(['phase'], 0, 7);
  const pitches = notes.map(n => n.pitch).sort((a, b) => a - b), median = pitches[Math.floor(pitches.length / 2)];
  return notes.map(note => {
    const x = numeric(note.at), beat = Math.round(x), half = Math.round(x * 2) / 2;
    const accent = Math.abs(x - beat) <= 1 / 16 ? 6 + (beat % 4 === 0 ? 4 : 0) : Math.abs(x - half) <= 1 / 16 ? 2 : 0;
    const position = ((x + phase) / 8) % 1, swell = depth * (1 - 4 * Math.abs(position - 0.5));
    const register = Math.max(-4, Math.min(4, Math.round((note.pitch - median) / 6)));
    const velocity = Math.round(base + accent + swell + register + v(['jitter', note.id], -5, 5));
    return { ...note, velocity: Math.max(20, Math.min(120, velocity)) };
  });
}

const n = (id, pitch, at, duration, velocity, extra = {}) => ({ id, pitch, at, duration, velocity, ...extra });
const cell = k => spell(BigInt(k), 512n);
const sameDuration = 'Preserve its duration (not its end time)';

/** A declared four-member group whose onsets follow anchor + delay + spread. */
function spreadGroup(prefix, domain) {
  const root = draw([domain, 'root'], 48, 64), anchor = String(draw([domain, 'anchor'], 2, 12));
  const delay = cell(draw([domain, 'delay'], 1, 8));
  const spreads = [0, ...[1, 2, 3].map(i => 2 * draw([domain, 'spread', i], 1 + 3 * (i - 1), 3 * i))];
  const intervals = [0, 4, 7, 11];
  const ids = ['a', 'b', 'c', 'd'].map(s => `${prefix}${s}`);
  const notes = ids.map((id, i) => n(id, root + intervals[i], add(add(anchor, delay), cell(spreads[i])),
    cell(draw([domain, 'duration', i], 256, 1024)), draw([domain, 'velocity', i], 60, 110)));
  const group = { id: `${prefix}Group`, members: ids, label: 'strummed seventh chord',
    provenance: { kind: 'declared', source: 'pilot-synthetic-author' }, anchor, delay,
    spread: Object.fromEntries(ids.map((id, i) => [id, cell(spreads[i])])), performanceOrder: [...ids] };
  return { notes, group, spreads, anchor, delay };
}

// Task wording revisions. Revision 2 is the E366/E367 wording (package v2).
// Revision 3 (package v3, E370): selectors say "onset" so "at 8" cannot read
// as list position 8, and requests no longer demand reduced or exact
// rational spellings, which D59 scoring does not require.
// Revision 4 (package v4) replaces p01, p06, p07, p08 and p09 with harder
// tasks under new IDs (version 1) and gives p10 the conditional-refusal
// response line it shares with p09 (version 2).
// Revision 5 (package v5, D63) adds p13-p16 (version 1); p01-p12 are unchanged.
export const TASK_REVISIONS = [2, 3, 4, 5];
const REVISED = new Set(['p02', 'p04', 'p05', 'p06', 'p09', 'p12']);
const REPLACED_V4 = new Set(['p01', 'p06', 'p07', 'p08', 'p09']);
const pick = (revision, v2, v3) => revision >= 3 ? v3 : v2;
function versionOf(id, revision) {
  const prefix = id.slice(0, 3);
  if (revision >= 4 && REPLACED_V4.has(prefix)) return 1;
  if (revision >= 4 && prefix === 'p10') return 2;
  return revision >= 3 && REVISED.has(prefix) ? 2 : 1;
}
const versioned = (tasks, revision) => tasks.map(t => ({ version: versionOf(t.id, revision), ...t }));

/** Revision 4 p07: a six-member group with odd and even spread cells, so halving leaves the grid. */
function wideSpreadGroup(prefix, domain) {
  const root = draw([domain, 'root'], 40, 52), anchor = String(draw([domain, 'anchor'], 2, 10));
  const delay = cell(draw([domain, 'delay'], 1, 9));
  // Cells 0 < s1 < ... < s5; odd draws for members b, d and e guarantee off-grid halves.
  const spreads = [0];
  for (let i = 1; i < 6; i++) {
    const step = draw([domain, 'spread', i], 2, 9), next = spreads[i - 1] + step;
    spreads.push([1, 3, 4].includes(i) && next % 2 === 0 ? next + 1 : next);
  }
  const intervals = [0, 7, 12, 16, 19, 24], ids = ['a', 'b', 'c', 'd', 'e', 'f'].map(s => `${prefix}${s}`);
  const notes = ids.map((id, i) => n(id, root + intervals[i], add(add(anchor, delay), cell(spreads[i])),
    cell(draw([domain, 'duration', i], 256, 1024)), draw([domain, 'velocity', i], 55, 115)));
  const group = { id: `${prefix}Group`, members: ids, label: 'open-voiced strum',
    provenance: { kind: 'declared', source: 'pilot-synthetic-author' }, anchor, delay,
    spread: Object.fromEntries(ids.map((id, i) => [id, cell(spreads[i])])), performanceOrder: [...ids] };
  return { notes, group, spreads, anchor, delay };
}

export function syntheticTasks(revision = 5) {
  assert(TASK_REVISIONS.includes(revision), `unknown task revision ${revision}`);
  const tasks = [];
  // p02: read one member's common delay, residual and derived onset.
  {
    const { notes, group } = spreadGroup('r', 'p02');
    const member = notes[draw(['p02', 'member'], 1, 3)];
    tasks.push({ id: 'p02-read-group-timing', family: 'read', cohort: 'source', input: { notes, groups: [group] },
      request: `For group ${group.id} and its member ${member.id}, return JSON with exactly delay (the group common delay), spread (the member residual) and at (the member performed onset). ${pick(revision, 'Use reduced rational strings.', 'Use rational strings.')}`,
      response: 'answer', answer: { delay: group.delay, spread: group.spread[member.id], at: member.at },
      source: 'synthetic', diagnostics: true });
  }
  // p03: author six fully specified notes from an empty input.
  {
    const notes = Array.from({ length: 6 }, (_, i) => n(`new${i + 1}`, draw(['p03', 'pitch', i], 40, 84),
      cell(draw(['p03', 'at', i], 0, 4095)), cell(draw(['p03', 'duration', i], 32, 1024)), draw(['p03', 'velocity', i], 30, 120)));
    assert.equal(new Set(notes.map(address)).size, 6);
    tasks.push({ id: 'p03-author-constrained', family: 'constrained-authoring', cohort: 'performed', input: { notes: [] },
      request: `Create exactly six notes, as (pitch, onset, duration, velocity): ${notes.map(x => `(${x.pitch},${x.at},${x.duration},${x.velocity})`).join(', ')}. No other notes. Use valid unique IDs if the format stores them.`,
      response: 'surface', expected: { notes }, source: 'synthetic' });
  }
  // p04: author a declared group from its stated decomposition.
  {
    const { notes, group } = spreadGroup('w', 'p04');
    const rows = notes.map(x => `${x.id} (pitch ${x.pitch}, duration ${x.duration}, velocity ${x.velocity}, spread ${group.spread[x.id]})`);
    tasks.push({ id: 'p04-author-known-spread', family: 'constrained-authoring', cohort: 'source', input: { notes: [] },
      request: `Create exactly four notes, in this note-array order: ${rows.join('; ')}. Each onset is anchor + delay + spread, written as a ${pick(revision, 'reduced rational', 'rational')}. Create one group with id ${group.id}, members ${group.members.join(', ')} in that order, label "${group.label}", provenance {"kind":"declared","source":"pilot-synthetic-author"}, anchor ${group.anchor}, delay ${group.delay}, the stated spreads, and performanceOrder ${group.performanceOrder.join(', ')}. No other notes, groups or properties.`,
      response: 'surface', expected: { notes, groups: [group] }, source: 'synthetic', diagnostics: true });
  }
  // p07 (revision 4): halve odd and even spreads and move the anchor; protected state as before.
  if (revision >= 4) {
    const { notes, group, spreads, anchor, delay } = wideSpreadGroup('h', 'p07-v4');
    const moved = String(Number(anchor) + draw(['p07-v4', 'anchorMove'], 1, 3));
    const loose = n('hLoose', draw(['p07-v4', 'loose'], 30, 39), cell(draw(['p07-v4', 'looseAt'], 0, 1023)), '1', 77);
    const protectedGroup = { id: 'hInner', members: ['hb', 'hd'], label: 'inner voices', provenance: { kind: 'declared', source: 'pilot-synthetic-author' } };
    const input = { notes: [...notes, loose], groups: [group, protectedGroup] };
    const expected = clone(input), half = s => spell(BigInt(s), 1024n);
    Object.assign(expected.groups[0], { anchor: moved, spread: Object.fromEntries(group.members.map((id, i) => [id, half(spreads[i])])) });
    expected.notes.slice(0, 6).forEach((x, i) => { x.at = add(add(moved, delay), half(spreads[i])); });
    tasks.push({ id: 'p07-halve-spread-move-anchor', family: 'group-arithmetic', cohort: 'source', input,
      request: `In group ${group.id}, halve every spread and move the anchor to ${moved}. Keep the common delay and the group equation, and update every member onset to match. Preserve note durations/pitches/velocities, membership, orders, labels and provenance, and every other note and group. Do not round values to a grid.`,
      response: 'surface', expected, source: 'synthetic', diagnostics: true });
  } else {
    const { notes, group, spreads, anchor, delay } = spreadGroup('h', 'p07');
    const loose = n('hLoose', draw(['p07', 'loose'], 36, 47), cell(draw(['p07', 'looseAt'], 0, 1023)), '1', 77);
    const protectedGroup = { id: 'hInner', members: ['hb', 'hc'], label: 'inner voices', provenance: { kind: 'declared', source: 'pilot-synthetic-author' } };
    const input = { notes: [...notes, loose], groups: [group, protectedGroup] };
    const expected = clone(input);
    expected.groups[0].spread = Object.fromEntries(group.members.map((id, i) => [id, cell(spreads[i] / 2)]));
    expected.notes.slice(0, 4).forEach((x, i) => { x.at = add(add(anchor, delay), cell(spreads[i] / 2)); });
    tasks.push({ id: 'p07-halve-group-spread', family: 'group-arithmetic', cohort: 'source', input,
      request: `Halve every spread in group ${group.id}. Preserve its anchor, common delay, note durations/pitches/velocities, membership, orders, labels and provenance, and every other note and group. Keep the group equation and explicit or derived onsets consistent.`,
      response: 'surface', expected, source: 'synthetic', diagnostics: true });
  }
  // p10: a pitch-only selector with two matches at distinct onsets in [2, 3).
  {
    const notes = Array.from({ length: 6 }, (_, i) => n(`amb${i + 1}`, [60, 67, 64, 72, 64, 55][i],
      cell([0, 512, 1024 + draw(['p10', 'first'], 1, 200), 1536, 1024 + draw(['p10', 'second'], 260, 500), 2048][i]),
      cell(draw(['p10', 'duration', i], 64, 512)), draw(['p10', 'velocity', i], 50, 110)));
    tasks.push({ id: 'p10-refuse-ambiguous-pitch', family: 'count-change', cohort: 'performed', input: { notes },
      request: 'Delete the note with pitch 64 whose onset is at least 2 and less than 3. Select only by that pitch and onset range; do not choose by ID, duration, velocity or order. If the selector matches more than one note, return REFUSE ambiguous-selector.',
      response: 'refusal', refusal: 'ambiguous-selector', source: 'synthetic', ...(revision >= 4 ? { conditionalRefusal: true } : {}) });
  }
  // p12: exact non-grid timing, wider fields and an opaque annotation; no groups.
  {
    const denominators = [513, 1536, 960];
    const notes = [0, 1, 2].map(i => n(`x${i + 1}`, draw(['p12', 'pitch', i], 50, 80),
      spell(BigInt(draw(['p12', 'at', i], 1, 4000)), BigInt(denominators[i])),
      spell(BigInt(draw(['p12', 'duration', i], 50, 900)), BigInt(denominators[(i + 1) % 3])), draw(['p12', 'velocity', i], 40, 115)));
    Object.assign(notes[0], { channel: 2, mute: false, releaseVelocity: 0.4, chance: { enabled: true, value: 0.7 },
      expression: { velocitySpread: 0, gain: 1, pan: -0.25, pressure: 0.5, timbre: 0.3, transpose: 0.5 } });
    Object.assign(notes[1], { channel: 3, annotation: { origin: 'unknown', confidence: null, tags: ['kept'] } });
    tasks.push({ id: 'p12-preserve-exact-wider', family: 'preservation', cohort: 'source', input: { notes },
      request: `Return the entire fixture unchanged, including exact rational ${pick(revision, 'spellings', 'values')}, original note order, all channels/expression/conditional state, and opaque annotations. Do not invent musical intent.`,
      response: 'surface', expected: clone({ notes }), source: 'synthetic', diagnostics: true });
  }
  return tasks;
}

const declared = () => ({ kind: 'declared', source: 'pilot-synthetic-author' });

/**
 * Revision 5: a timed group whose spread cells rise strictly from 0 and whose
 * member onsets are anchor + delay + spread. With `odd`, every nonzero cell is odd.
 */
function timedGroup({ id, prefix, domain, size, anchor, delay, label, root, intervals, odd = false }) {
  const cells = [0];
  for (let i = 1; i < size; i++) {
    const next = cells[i - 1] + draw([...domain, 'step', i], 3, 12);
    cells.push(odd && next % 2 === 0 ? next + 1 : next);
  }
  const ids = Array.from({ length: size }, (_, i) => `${prefix}${'abcdefgh'[i]}`);
  const notes = ids.map((noteId, i) => n(noteId, root + intervals[i], add(add(anchor, delay), cell(cells[i])),
    cell(draw([...domain, 'duration', i], 128, 1024)), draw([...domain, 'velocity', i], 50, 115)));
  const group = { id, members: ids, label, provenance: declared(), anchor, delay,
    spread: Object.fromEntries(ids.map((noteId, i) => [noteId, cell(cells[i])])), performanceOrder: [...ids] };
  return { notes, group, cells };
}
const quarterPlus = (whole, domain, low, high) => add(String(whole), cell(draw(domain, low, high)));
const byOnsetThenId = (a, b) => cmp(a.at, b.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Revision 5 (D63): synthetic group-timing tasks p13-p16 (see TASK_RULES_V5). */
export function groupTimingTasks() {
  const tasks = [];
  // p13: list the notes whose performed onset lies in [X, Y).
  {
    const d = 'p13-v5', a = draw([d, 'anchor'], 2, 4), groupDelay = key => cell(draw([d, key, 'delay'], 2, 24));
    const k = timedGroup({ id: 'kStrum', prefix: 'k', domain: [d, 'k'], size: 5, anchor: String(a), delay: groupDelay('k'),
      label: 'first strum', root: draw([d, 'k', 'root'], 48, 57), intervals: [0, 4, 7, 12, 16] });
    const m = timedGroup({ id: 'mStrum', prefix: 'm', domain: [d, 'm'], size: 4, anchor: String(a + 2), delay: groupDelay('m'),
      label: 'second strum', root: draw([d, 'm', 'root'], 48, 57), intervals: [0, 3, 7, 10] });
    const s = timedGroup({ id: 'sStrum', prefix: 's', domain: [d, 's'], size: 5, anchor: String(a + 4), delay: groupDelay('s'),
      label: 'third strum', root: draw([d, 's', 'root'], 48, 57), intervals: [0, 5, 7, 12, 17] });
    const untimed = [n('fa', draw([d, 'fa'], 72, 84), quarterPlus(a + 1, [d, 'faAt'], 128, 384), '1', draw([d, 'faVel'], 50, 90)),
      n('fb', draw([d, 'fb'], 72, 84), quarterPlus(a + 3, [d, 'fbAt'], 128, 384), '1', draw([d, 'fbVel'], 50, 90))];
    const pad = { id: 'pad', members: ['fa', 'fb', 'mb'], label: 'sustained pad', provenance: declared() };
    const loose = [n('la', draw([d, 'la'], 30, 40), quarterPlus(a - 1, [d, 'laAt'], 0, 255), '1/2', draw([d, 'laVel'], 60, 100)),
      n('lb', draw([d, 'lb'], 30, 40), m.notes[2].at, '1/2', draw([d, 'lbVel'], 60, 100)),
      n('lc', draw([d, 'lc'], 30, 40), quarterPlus(a + 5, [d, 'lcAt'], 0, 255), '1/2', draw([d, 'lcVel'], 60, 100))];
    const input = { notes: [...k.notes, ...m.notes, ...s.notes, ...untimed, ...loose], groups: [k.group, m.group, s.group, pad] };
    const from = k.notes[2].at, to = s.notes[2].at;
    const ids = input.notes.filter(x => cmp(x.at, from) >= 0 && cmp(x.at, to) < 0).sort(byOnsetThenId).map(x => x.id);
    tasks.push({ id: 'p13-read-derived-window', family: 'read', cohort: 'source', input,
      request: `Return JSON with exactly ids: the IDs of every note whose performed onset is at least ${from} and less than ${to}, in ascending onset order, with equal onsets ordered by ID.`,
      response: 'answer', answer: { ids }, source: 'synthetic', diagnostics: true });
  }
  // p14: five loose notes become one new timed group with unchanged onsets.
  {
    const d = 'p14-v5', anchor = String(draw([d, 'anchor'], 5, 7)), delay = spell(BigInt(2 * draw([d, 'delay'], 1, 7) - 1), 128n);
    const e = timedGroup({ id: 'eChord', prefix: 'e', domain: [d, 'e'], size: 4, anchor: '2', delay: cell(draw([d, 'e', 'delay'], 2, 16)),
      label: 'opening chord', root: draw([d, 'e', 'root'], 48, 57), intervals: [0, 4, 7, 12] });
    const g = timedGroup({ id: 'nStrum', prefix: 'n', domain: [d, 'n'], size: 5, anchor, delay,
      label: 'upstroke strum', root: draw([d, 'n', 'root'], 43, 52), intervals: [0, 7, 12, 16, 19] });
    const loose = [n('oa', draw([d, 'oa'], 30, 40), quarterPlus(Number(anchor) + 1, [d, 'oaAt'], 0, 255), '1', draw([d, 'oaVel'], 60, 100)),
      n('ob', draw([d, 'ob'], 72, 84), quarterPlus(Number(anchor) + 2, [d, 'obAt'], 0, 255), '1/2', draw([d, 'obVel'], 60, 100))];
    const input = { notes: [...e.notes, ...g.notes, ...loose], groups: [e.group] };
    const expected = { notes: clone(input.notes), groups: [clone(e.group), g.group] };
    const ids = g.group.members.join(', ');
    tasks.push({ id: 'p14-group-existing-notes', family: 'group-arithmetic', cohort: 'source', input,
      request: `Make the loose notes ${ids} one new timed group, appended after the existing groups: id ${g.group.id}, members ${ids} in that order, label "${g.group.label}", provenance {"kind":"declared","source":"pilot-synthetic-author"}, anchor ${anchor}, delay ${delay} and performanceOrder ${ids}. Choose each member's spread so that its onset is unchanged (onset = anchor + delay + spread). Preserve every note's pitch, duration and velocity, and every other note and group. Do not round values to a grid.`,
      response: 'surface', expected, source: 'synthetic', diagnostics: true });
  }
  // p15: move one note between timed groups; it stays in a timing-free group.
  {
    const d = 'p15-v5', a = draw([d, 'anchor'], 2, 4);
    const u = timedGroup({ id: 'uStrum', prefix: 'u', domain: [d, 'u'], size: 4, anchor: String(a), delay: cell(draw([d, 'u', 'delay'], 2, 24)),
      label: 'upper strum', root: draw([d, 'u', 'root'], 60, 67), intervals: [0, 4, 7, 12] });
    const w = timedGroup({ id: 'dStrum', prefix: 'd', domain: [d, 'd'], size: 4, anchor: String(a + 2), delay: cell(draw([d, 'd', 'delay'], 2, 24)),
      label: 'lower strum', root: draw([d, 'd', 'root'], 40, 47), intervals: [0, 7, 12, 16] });
    const free = n('fa', draw([d, 'fa'], 72, 84), quarterPlus(a + 1, [d, 'faAt'], 128, 384), '2', draw([d, 'faVel'], 50, 90));
    const pad = { id: 'pad', members: ['ub', 'da', 'fa'], label: 'held voices', provenance: declared() };
    const loose = n('la', draw([d, 'la'], 30, 39), quarterPlus(a + 4, [d, 'laAt'], 0, 255), '1/2', draw([d, 'laVel'], 60, 100));
    const input = { notes: [...u.notes, ...w.notes, free, loose], groups: [u.group, w.group, pad] };
    const spread = cell(u.cells.at(-1) + draw([d, 'spread'], 4, 16)), moved = 'da';
    const expected = clone(input), [to, from] = expected.groups;
    to.members.push(moved); to.performanceOrder.push(moved); to.spread[moved] = spread;
    from.members = from.members.filter(x => x !== moved); from.performanceOrder = from.performanceOrder.filter(x => x !== moved);
    delete from.spread[moved];
    expected.notes.find(x => x.id === moved).at = add(add(to.anchor, to.delay), spread);
    tasks.push({ id: 'p15-move-member-between-groups', family: 'group-arithmetic', cohort: 'source', input,
      request: `Move note ${moved} from group ${from.id} to group ${to.id} with spread ${spread}. Append it to ${to.id}'s members and performanceOrder, and remove it from ${from.id}'s members, spread and performanceOrder. Its onset must follow ${to.id}'s group equation. Keep its other group memberships, its pitch, duration and velocity, and every other note and group unchanged.`,
      response: 'surface', expected, source: 'synthetic', diagnostics: true });
  }
  // p16: move one group's anchor and double another group's spreads.
  {
    const d = 'p16-v5', a = draw([d, 'anchor'], 2, 3);
    const g1 = timedGroup({ id: 'aStrum', prefix: 'a', domain: [d, 'a'], size: 4, anchor: String(a), delay: cell(draw([d, 'a', 'delay'], 2, 24)),
      label: 'first strum', root: draw([d, 'a', 'root'], 48, 57), intervals: [0, 4, 7, 12] });
    const g2 = timedGroup({ id: 'bStrum', prefix: 'b', domain: [d, 'b'], size: 5, anchor: String(a + 3), delay: cell(draw([d, 'b', 'delay'], 2, 24)),
      label: 'second strum', root: draw([d, 'b', 'root'], 48, 57), intervals: [0, 3, 7, 10, 15], odd: true });
    const free = n('fa', draw([d, 'fa'], 72, 84), quarterPlus(a + 4, [d, 'faAt'], 128, 384), '1', draw([d, 'faVel'], 50, 90));
    const tie = { id: 'tie', members: ['ab', 'bc', 'fa'], label: 'tied voices', provenance: declared() };
    const loose = n('la', draw([d, 'la'], 30, 39), quarterPlus(a + 2, [d, 'laAt'], 0, 255), '1/2', draw([d, 'laVel'], 60, 100));
    const input = { notes: [...g1.notes, ...g2.notes, free, loose], groups: [g1.group, g2.group, tie] };
    const move = spell(BigInt(2 * draw([d, 'move'], 1, 5) + 1), 16n);
    const expected = clone(input), [first, second] = expected.groups;
    first.anchor = add(first.anchor, move);
    second.spread = Object.fromEntries(second.members.map(x => [x, add(second.spread[x], second.spread[x])]));
    for (const x of expected.notes) for (const group of [first, second]) if (group.members.includes(x.id))
      x.at = add(add(group.anchor, group.delay), group.spread[x.id]);
    tasks.push({ id: 'p16-retime-two-groups', family: 'group-arithmetic', cohort: 'source', input,
      request: `Make two changes: move the anchor of group ${first.id} later by ${move}, and double every spread in group ${second.id}. Keep each group's common delay and group equation, and update every member onset to match. Preserve note pitches, durations and velocities, membership, orders, labels and provenance, and every other note and group. Do not round values to a grid.`,
      response: 'surface', expected, source: 'synthetic', diagnostics: true });
  }
  return tasks;
}

export function realTasks(windows = loadWindows(), revision = 5) {
  assert(TASK_REVISIONS.includes(revision), `unknown task revision ${revision}`);
  const select = note => pick(revision, `the note at ${note.at} with pitch ${note.pitch}`, `the note with onset ${note.at} and pitch ${note.pitch}`);
  const work = label => windows.works.find(w => w.label === label);
  const notes = label => synthesizeVelocities(work(label).notes.map(({ id, pitch, at, duration }) => ({ id, pitch, at, duration })), work(label).shardId);
  const src = label => `reserved:${label}:${work(label).work}`;
  const tasks = [];
  const a = notes('A'), b = notes('B'), c = notes('C');
  if (revision >= 4) return [...harderRealTasks({ a, b, c, src, select }), ...tasks];
  tasks.push({ id: 'p01-read-count-window', family: 'read', cohort: 'performed', input: { notes: a },
    request: 'Return JSON with exactly total (the number of notes, including multiplicity) and before (the number of notes whose onset is strictly less than 8).',
    response: 'answer', answer: { total: a.length, before: a.filter(x => cmp(x.at, '8') < 0).length }, source: src('A') });
  const velocityTarget = editTarget(b, x => x);
  const velocity = velocityTarget.velocity === 91 ? 37 : 91;
  tasks.push({ id: 'p05-edit-velocity-large', family: 'individual-edit', cohort: 'performed', input: { notes: b },
    request: `Change only the velocity of ${select(velocityTarget)} to ${velocity}. Preserve all other performed state.`,
    response: 'surface', expected: { notes: b.map(x => x === velocityTarget ? { ...x, velocity } : x) }, source: src('B') });
  const transposeTarget = editTarget(c, x => ({ ...x, pitch: x.pitch + 2 }));
  tasks.push({ id: 'p06-edit-transpose', family: 'individual-edit', cohort: 'performed', input: { notes: c },
    request: `Transpose only ${select(transposeTarget)} up two semitones. ${sameDuration}, onset and velocity, and every other note.`,
    response: 'surface', expected: { notes: c.map(x => x === transposeTarget ? { ...x, pitch: x.pitch + 2 } : x) }, source: src('C') });
  const range = shiftRange(a);
  tasks.push({ id: 'p08-shift-onset-range', family: 'group-arithmetic', cohort: 'performed', input: { notes: a },
    request: `Move every note whose onset is at least ${range.from} and less than ${range.to} later by 1/8. Preserve their durations (not end times), pitches and velocities, and every other note.`,
    response: 'surface', expected: { notes: range.after }, source: src('A') });
  const deleteTarget = editTarget(b, x => x, new Set([velocityTarget.id]));
  tasks.push({ id: 'p09-delete-one-note', family: 'count-change', cohort: 'performed', input: { notes: b },
    request: `Delete only ${select(deleteTarget)}. Preserve every field of every other note.`,
    response: 'surface', expected: { notes: b.filter(x => x !== deleteTarget) }, source: src('B') });
  tasks.push({ id: 'p11-preserve-window', family: 'preservation', cohort: 'performed', input: { notes: c },
    request: 'Return the complete note state unchanged, preserving multiplicity, pitch, onset, duration and velocity.',
    response: 'surface', expected: { notes: clone(c) }, source: src('C') });
  return tasks;
}

/**
 * Revision 4: p01 counts notes sounding at a boundary time, p06 transposes
 * every note of one pitch, p08 shifts and transposes an onset-bounded range,
 * and p09 deletes a note whose same-pitch neighbour sits just outside the
 * range. p05 and p11 are unchanged.
 */
function harderRealTasks({ a, b, c, src, select }) {
  const tasks = [];
  const sounding = soundingTime(c);
  tasks.push({ id: 'p01-read-sounding-at', family: 'read', cohort: 'performed', input: { notes: c },
    request: `Return JSON with exactly total (the number of notes, including multiplicity) and sounding (the number of notes sounding at quarter ${sounding.at}: onset at most ${sounding.at} and onset + duration greater than ${sounding.at}).`,
    response: 'answer', answer: { total: c.length, sounding: sounding.sounding.length }, source: src('C') });
  const velocityTarget = editTarget(b, x => x);
  const velocity = velocityTarget.velocity === 91 ? 37 : 91;
  tasks.push({ id: 'p05-edit-velocity-large', family: 'individual-edit', cohort: 'performed', input: { notes: b },
    request: `Change only the velocity of ${select(velocityTarget)} to ${velocity}. Preserve all other performed state.`,
    response: 'surface', expected: { notes: b.map(x => x === velocityTarget ? { ...x, velocity } : x) }, source: src('B') });
  const pitch = transposePitch(c);
  tasks.push({ id: 'p06-transpose-every-pitch', family: 'individual-edit', cohort: 'performed', input: { notes: c },
    request: `Transpose every note with pitch ${pitch} up two semitones. Preserve their durations (not end times), onsets and velocities, and every other note.`,
    response: 'surface', expected: { notes: c.map(x => x.pitch === pitch ? { ...x, pitch: pitch + 2 } : x) }, source: src('C') });
  const range = shiftTransposeRange(a);
  tasks.push({ id: 'p08-shift-transpose-range', family: 'group-arithmetic', cohort: 'performed', input: { notes: a },
    request: `For every note whose onset is at least ${range.from} and less than ${range.to}, move the onset later by 1/8 and transpose the note up two semitones. Preserve their durations (not end times) and velocities, and every other note.`,
    response: 'surface', expected: { notes: range.after }, source: src('A') });
  const miss = nearMiss(b, new Set([velocityTarget.id]));
  tasks.push({ id: 'p09-delete-near-miss', family: 'count-change', cohort: 'performed', input: { notes: b },
    request: `Delete the note with pitch ${miss.target.pitch} whose onset is at least ${miss.from} and less than ${miss.to}. Select only by that pitch and onset range; do not choose by ID, duration, velocity or order. If the selector matches more than one note, return REFUSE ambiguous-selector.`,
    response: 'surface', conditionalRefusal: true, expected: { notes: b.filter(x => x !== miss.target) }, source: src('B') });
  tasks.push({ id: 'p11-preserve-window', family: 'preservation', cohort: 'performed', input: { notes: c },
    request: 'Return the complete note state unchanged, preserving multiplicity, pitch, onset, duration and velocity.',
    response: 'surface', expected: { notes: clone(c) }, source: src('C') });
  return tasks;
}

/** The pilot tasks in instance order at a task revision (5 is current): p01-p12, plus p13-p16 from revision 5. */
export function pilotTasks(windows = loadWindows(), { revision = 5 } = {}) {
  const all = versioned([...realTasks(windows, revision), ...syntheticTasks(revision),
    ...(revision >= 5 ? groupTimingTasks() : [])], revision);
  const order = ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09', 'p10', 'p11', 'p12',
    ...(revision >= 5 ? ['p13', 'p14', 'p15', 'p16'] : [])];
  return order.map(prefix => all.find(t => t.id.startsWith(`${prefix}-`)));
}

