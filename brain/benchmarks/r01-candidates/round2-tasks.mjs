// R01 round 2 difficulty ladders (R01-D8, R01-D11, R01-D13). Each family scales
// one format-dependent axis of a round-1 task; every other axis stays at its
// base. Synthetic families draw from r01-round2-synthetic-v1. Performed
// families use the round-2 windows of works 4-6 (round2-inputs.mjs) with
// velocities from r01-round2-velocity-v1. Expected results are computed
// independently of every format.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { add, cmp, numeric, rational, spell } from './common.mjs';
import { draw as seededDraw, synthesizeVelocities } from './pilot-tasks.mjs';
import { FAMILY_GENERATORS, LADDERS_V4, LADDERS_V5, LADDERS_V6, ROUND2_FAMILY_RULES, ROUND2_FAMILY_RULES_V5, ROUND2_FAMILY_RULES_V6 } from './round2-families.mjs';

export const ROUND2_DATA = 'context/evidence/data/r01-round2';
export const ROUND2_WINDOWS_PATH = `${ROUND2_DATA}/windows.json`;
// R01-D18: the v1 windows plus 128-note instances 5-8 (round2-inputs.mjs version 3).
export const ROUND2_WINDOWS_V3_PATH = `${ROUND2_DATA}/v3/windows.json`;
export const ROUND2_SEEDS = Object.freeze({ synthetic: 'r01-round2-synthetic-v1', velocity: 'r01-round2-velocity-v1' });
export const INSTANCES = 4;

// Families in package order. `levels` are R01-D11's starting ladders;
// calibration may change them per cohort. `diagnosticLevel` is the one level
// index at which the three source diagnostics run (brief: arms).
export const LADDERS = Object.freeze({
  'derived-read': { short: 'read', from: ['p02', 'p13'], cohort: 'source', family: 'read', axis: 'timed groups whose members are read', levels: [1, 2, 4, 8], diagnosticLevel: 1 },
  'group-retime': { short: 'retime', from: ['p16'], cohort: 'source', family: 'group-arithmetic', axis: 'groups changed in one request', levels: [1, 2, 4, 8], diagnosticLevel: 1 },
  'regroup': { short: 'regroup', from: ['p14'], cohort: 'source', family: 'group-arithmetic', axis: 'loose five-note sets converted into timed groups', levels: [1, 2, 4, 6], diagnosticLevel: 1 },
  'member-move': { short: 'move', from: ['p15'], cohort: 'source', family: 'group-arithmetic', axis: 'members moved between timed groups', levels: [1, 2, 4, 6], diagnosticLevel: 1 },
  'range-edit': { short: 'range', from: ['p08'], cohort: 'performed', family: 'group-arithmetic', axis: 'window notes (range notes scale with the window)', levels: [64, 128, 256, 512] },
  'selective-delete': { short: 'delete', from: ['p09'], cohort: 'performed', family: 'count-change', axis: 'same-pitch near misses around the range', levels: [1, 3, 6] },
  'preserve-performed': { short: 'keep', from: ['p11'], cohort: 'performed', family: 'preservation', axis: 'window notes returned unchanged', levels: [128, 256, 512] },
  'preserve-exact': { short: 'exact', from: ['p12'], cohort: 'source', family: 'preservation', axis: 'window notes at exact source timing with wider fields, returned unchanged', levels: [128, 256, 512], diagnosticLevel: 1 },
});
// Ladder v2 (R01-D14): harder shared levels for Haiku 5.5 low and Luna high,
// starting near the top of v1 (E382, E383). Preservation runs once at 512 as a cost measure.
const v1 = family => LADDERS[family];
export const LADDERS_V2 = Object.freeze({
  'derived-read': { ...v1('derived-read'), levels: [4, 8, 16, 32] },
  'group-retime': { ...v1('group-retime'), levels: [4, 8, 16, 32] },
  regroup: { ...v1('regroup'), levels: [4, 8, 12, 16] },
  'member-move': { ...v1('member-move'), levels: [4, 8, 12, 16] },
  'range-edit': { ...v1('range-edit'), levels: [128, 256, 512] },
  'selective-delete': { ...v1('selective-delete'), levels: [6, 12, 24] },
  'preserve-performed': { ...v1('preserve-performed'), levels: [512] },
  'preserve-exact': { ...v1('preserve-exact'), levels: [512], diagnosticLevel: 0 },
});
// Ladder v3 (R01-D18): per-cohort levels chosen for discordance from E385
// (design-round2-v2-dev-r3.json), fresh instances and one repeat. Synthetic
// families run instances 5-16; range-edit has only four fresh low-overlap
// 128-note windows (instances 5-8), so it keeps three repeats. No diagnostics.
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
export const V3_SOURCE_INSTANCES = Object.freeze(range(5, 16));
export const V3_RANGE_INSTANCES = Object.freeze(range(5, 8));
const v3 = (family, levels, extra = {}) => ({ ...v1(family), levels, diagnosticLevel: null, instances: V3_SOURCE_INSTANCES, repeats: 1, ...extra });
export const LADDERS_V3 = Object.freeze({
  'claude-current': Object.freeze({
    'derived-read': v3('derived-read', [8, 16, 32, 48]),
    'group-retime': v3('group-retime', [16, 32, 48]),
    regroup: v3('regroup', [12, 16, 24]),
  }),
  'codex-current-high': Object.freeze({
    'derived-read': v3('derived-read', [8, 16, 32, 48]),
    'group-retime': v3('group-retime', [16, 32, 48]),
    regroup: v3('regroup', [16, 24]),
    'member-move': v3('member-move', [16, 24]),
    'range-edit': v3('range-edit', [128], { instances: V3_RANGE_INSTANCES, repeats: 3 }),
  }),
});
export const WINDOW_SIZES = [64, 128, 256, 512];
export const DELETE_WINDOW = 128;

export const ROUND2_RULES = Object.freeze({
  schema: 'r01-round2-task-rules-v1',
  ladders: 'One family per round-1 task (or pair); each varies one axis; levels are the R01-D11 starting ladders. All formats within a cohort share one ladder.',
  synthetic: `Seeded SHA-256 draws from ${ROUND2_SEEDS.synthetic} under domains [family, level, instance, ...]. Timed groups have whole-quarter anchors, a positive common delay and strictly increasing 1/512 spread cells from 0 (odd cells where a task doubles them). Note-array order equals C4 block traversal (timed groups, then notes homed in timing-free groups, then loose notes) in every input and expected state.`,
  velocity: `Real windows receive the round-1 synthetic dynamics model with seed ${ROUND2_SEEDS.velocity}; they are not recovered performance dynamics.`,
  derivedRead: 'G timed groups (sizes alternate 5 and 4; anchors two quarters apart), a timing-free group with one timed member and two untimed notes (one 1/512 after the first group\'s third member, inside the window), a loose note before the first group, one per later group, one after the last, and loose note bt sharing the last group\'s third member onset (its ID sorts first, so ID and note-array tie orders differ). X is the derived onset of the first group\'s second member and Y that of the last group\'s fourth member. Answer: IDs with performed onset in [X, Y), ascending onset, ties by ID.',
  groupRetime: 'G timed groups (sizes alternate 4 and 5; anchors three quarters apart). Group i is changed: an even i moves its anchor later by an odd multiple of 1/16; an odd i doubles its spreads (odd cells after 0). A timing-free group holds one member of the first two groups and an untimed note; a loose note follows.',
  regroup: 'One existing four-member timed group, then K sets of five loose notes whose onsets equal anchor + delay + spread for a hidden decomposition (whole-quarter anchors three quarters apart, delay an odd multiple of 1/128, spreads strictly increasing 1/512 cells from 0), then two other loose notes. Each set becomes a timed group appended in order; the expected spreads reproduce every onset.',
  memberMove: 'ceil(M/2) pairs of four-member timed groups (target, source; anchors two quarters apart, pairs four apart). Pair i moves the first one or two members of its source to its target with stated spreads above every target spread, so appending keeps note-array order. A timing-free group holds one target member, the first moved note of each pair and an untimed note.',
  rangeEdit: 'Window of N notes. Over distinct onsets F at or after the onset of note index floor(N/3) in onset/pitch/ID order, T is the first distinct onset after F at which [F, T) holds at least ceil(N/16) notes; accept the first range holding at most floor(N/8) notes whose shifted (+1/8) and transposed (+2) results collide with no other address, stay within MIDI range and keep the clip length.',
  selectiveDelete: `A ${DELETE_WINDOW}-note window. F = floor(onset of note index floor(N/2)), T = F + 1/2. P is the pitch nearest the window's median pitch (lower on a tie) with no note whose onset lies in [F - 1, T + 1]. One target at pitch P inside [F, T) and K near misses at pitch P outside it, within one quarter (the first at T itself), are planted. Notes are then renumbered in onset/pitch order with the window's ID prefix.`,
  preservePerformed: 'Window of N notes at 1/512-normalized timing, returned unchanged.',
  preserveExact: 'Window of N notes at exact source timing (unreduced by normalization) with synthetic velocities; note index i carries channel and expression when i mod 32 = 7, an opaque annotation when i mod 64 = 19, and chance when i mod 48 = 11. Returned unchanged.',
  instances: `${INSTANCES} instances per level; instance k of a performed level uses window instance k at that size.`,
});
export const ROUND2_RULES_V2 = Object.freeze({ ...ROUND2_RULES, schema: 'r01-round2-task-rules-v2',
  ladders: 'Ladder v2 (R01-D14): one shared harder ladder for Haiku 5.5 low and Luna high; levels in LADDERS_V2. Generators are unchanged; group prefixes past the v1 letters are tag + index, loose read notes past twelve are l + index, and near misses past six alternate after T and before F at seeded distinct distances under one quarter.' });

export const ROUND2_RULES_V3 = Object.freeze({ ...ROUND2_RULES_V2, schema: 'r01-round2-task-rules-v3',
  ladders: 'Ladder v3 (R01-D18): one package per cohort with that cohort\'s levels (LADDERS_V3), chosen for discordance from E385. Generators are those of ladder v2.',
  instances: 'Fresh instances: synthetic families use instances 5-16, unused by packages v1 and v2. Range-edit uses 128-note window instances 5-8, the fresh windows sharing at most 16 notes with any earlier window; instance k uses window instance k. Repeats are per family (manifest repeats.byTask).' });

const draw = (domain, low, high) => seededDraw(domain, low, high, ROUND2_SEEDS.synthetic);
const clone = structuredClone;
const n = (id, pitch, at, duration, velocity, extra = {}) => ({ id, pitch, at, duration, velocity, ...extra });
const cell = k => spell(BigInt(k), 512n);
const declared = () => ({ kind: 'declared', source: 'pilot-synthetic-author' });
const quarterPlus = (whole, domain, low, high) => add(String(whole), cell(draw(domain, low, high)));
const byOnsetThenId = (a, b) => cmp(a.at, b.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const address = x => `${x.pitch}@${x.at}`;
const sorted = notes => [...notes].sort((a, b) => cmp(a.at, b.at) || a.pitch - b.pitch || a.id.localeCompare(b.id));
const floorQuarter = value => { const [num, den] = rational(value); return spell(num / den); };
const end = x => add(x.at, x.duration);
const clipQuarters = notes => 64 * Math.max(1, Math.ceil(Math.max(...notes.map(x => numeric(end(x)))) / 64));
const LETTERS = 'abcdefgh';
// Group prefixes: the v1 letters, then `${tag}${i}` past them (ladder v2), so v1 IDs are unchanged.
const prefixAt = (list, i, tag) => i < list.length ? list[i] : `${tag}${i}`;

/** A timed group whose spread cells rise strictly from 0 and whose onsets are anchor + delay + spread. */
function timedGroup({ id, prefix, domain, size, anchor, delay, label, root, intervals, odd = false }) {
  const cells = [0];
  for (let i = 1; i < size; i++) {
    const next = cells[i - 1] + draw([...domain, 'step', i], 3, 12);
    cells.push(odd && next % 2 === 0 ? next + 1 : next);
  }
  const ids = Array.from({ length: size }, (_, i) => `${prefix}${LETTERS[i]}`);
  const notes = ids.map((noteId, i) => n(noteId, root + intervals[i], add(add(anchor, delay), cell(cells[i])),
    cell(draw([...domain, 'duration', i], 128, 1024)), draw([...domain, 'velocity', i], 50, 115)));
  const group = { id, members: ids, label, provenance: declared(), anchor, delay,
    spread: Object.fromEntries(ids.map((noteId, i) => [noteId, cell(cells[i])])), performanceOrder: [...ids] };
  return { notes, group, cells };
}
const retimed = (fixture, groupIds) => {
  for (const x of fixture.notes) for (const g of fixture.groups) if (groupIds.includes(g.id) && g.members.includes(x.id))
    x.at = add(add(g.anchor, g.delay), g.spread[x.id]);
  return fixture;
};
const PRESERVE = 'Preserve note pitches, durations and velocities, membership, orders, labels and provenance, and every other note and group. Do not round values to a grid.';

function derivedRead(G, k) {
  const d = ['derived-read', G, k], a = draw([...d, 'anchor'], 2, 4), prefixes = 'kmsvwxyz';
  const groups = Array.from({ length: G }, (_, i) => timedGroup({ id: `${prefixAt(prefixes, i, 'g')}Strum`, prefix: prefixAt(prefixes, i, 'g'), domain: [...d, i],
    size: i % 2 ? 4 : 5, anchor: String(a + 2 * i), delay: cell(draw([...d, i, 'delay'], 2, 24)), label: `strum ${i + 1}`,
    root: draw([...d, i, 'root'], 48, 57), intervals: [0, 4, 7, 12, 16] }));
  const last = groups.at(-1);
  const untimed = [n('fa', draw([...d, 'fa'], 72, 84), add(groups[0].notes[2].at, cell(1)), '1', draw([...d, 'faVel'], 50, 90)),
    n('fb', draw([...d, 'fb'], 72, 84), quarterPlus(a + 2 * G - 1, [...d, 'fbAt'], 128, 384), '1', draw([...d, 'fbVel'], 50, 90))];
  const pad = { id: 'pad', members: ['fa', 'fb', groups[Math.min(1, G - 1)].notes[1].id], label: 'sustained pad', provenance: declared() };
  const loose = [n('la', draw([...d, 'la'], 30, 40), quarterPlus(a - 1, [...d, 'laAt'], 0, 255), '1/2', draw([...d, 'laVel'], 60, 100)),
    n('bt', draw([...d, 'lb'], 30, 40), last.notes[2].at, '1/2', draw([...d, 'lbVel'], 60, 100)),
    ...Array.from({ length: G - 1 }, (_, i) => n(i < 12 ? `l${"defghijkmnpq"[i]}` : `l${i}`, draw([...d, 'l', i], 30, 40),
      quarterPlus(a + 2 * i + 1, [...d, 'lAt', i], 0, 255), '1/2', draw([...d, 'lVel', i], 60, 100))),
    n('lc', draw([...d, 'lc'], 30, 40), quarterPlus(a + 2 * G + 1, [...d, 'lcAt'], 0, 255), '1/2', draw([...d, 'lcVel'], 60, 100))];
  const input = { notes: [...groups.flatMap(g => g.notes), ...untimed, ...loose], groups: [...groups.map(g => g.group), pad] };
  const from = groups[0].notes[1].at, to = last.notes[3].at;
  assert(cmp(from, to) < 0);
  const ids = input.notes.filter(x => cmp(x.at, from) >= 0 && cmp(x.at, to) < 0).sort(byOnsetThenId).map(x => x.id);
  return { input, request: `Return JSON with exactly ids: the IDs of every note whose performed onset is at least ${from} and less than ${to}, in ascending onset order, with equal onsets ordered by ID.`,
    response: 'answer', answer: { ids }, detail: { groups: G, from, to, selected: ids.length } };
}

function groupRetime(G, k) {
  const d = ['group-retime', G, k], a = draw([...d, 'anchor'], 2, 3), prefixes = 'abcdeghj';
  const groups = Array.from({ length: G }, (_, i) => timedGroup({ id: `${prefixAt(prefixes, i, 'r')}Strum`, prefix: prefixAt(prefixes, i, 'r'), domain: [...d, i],
    size: i % 2 ? 5 : 4, anchor: String(a + 3 * i), delay: cell(draw([...d, i, 'delay'], 2, 24)), label: `strum ${i + 1}`,
    root: draw([...d, i, 'root'], 48, 57), intervals: [0, 3, 7, 10, 15], odd: i % 2 === 1 }));
  const free = n('fa', draw([...d, 'fa'], 72, 84), quarterPlus(a + 1, [...d, 'faAt'], 128, 384), '1', draw([...d, 'faVel'], 50, 90));
  const tie = { id: 'tie', members: [groups[0].notes[1].id, ...(G > 1 ? [groups[1].notes[2].id] : []), 'fa'], label: 'tied voices', provenance: declared() };
  const loose = n('la', draw([...d, 'la'], 30, 39), quarterPlus(a + 3 * G - 1, [...d, 'laAt'], 0, 255), '1/2', draw([...d, 'laVel'], 60, 100));
  const input = { notes: [...groups.flatMap(g => g.notes), free, loose], groups: [...groups.map(g => g.group), tie] };
  const ops = groups.map((g, i) => i % 2 === 0
    ? { op: 'move-anchor', group: g.group.id, by: spell(BigInt(2 * draw([...d, i, 'move'], 1, 5) + 1), 16n) }
    : { op: 'double-spreads', group: g.group.id });
  const expected = clone(input);
  for (const op of ops) {
    const g = expected.groups.find(x => x.id === op.group);
    if (op.op === 'move-anchor') g.anchor = add(g.anchor, op.by);
    else g.spread = Object.fromEntries(g.members.map(x => [x, add(g.spread[x], g.spread[x])]));
  }
  retimed(expected, ops.map(o => o.group));
  const phrases = ops.map(o => o.op === 'move-anchor' ? `move the anchor of group ${o.group} later by ${o.by}` : `double every spread in group ${o.group}`);
  return { input, expected, response: 'surface', detail: { groups: G, ops },
    request: `Make ${G === 1 ? 'one change' : `${G} changes`}: ${phrases.join('; ')}. Keep each group's common delay and group equation, and update every member onset to match. ${PRESERVE}` };
}

function regroup(K, k) {
  const d = ['regroup', K, k], base = draw([...d, 'anchor'], 5, 6), prefixes = 'npqrtu';
  const e = timedGroup({ id: 'eChord', prefix: 'e', domain: [...d, 'e'], size: 4, anchor: '2', delay: cell(draw([...d, 'e', 'delay'], 2, 16)),
    label: 'opening chord', root: draw([...d, 'e', 'root'], 48, 57), intervals: [0, 4, 7, 12] });
  const sets = Array.from({ length: K }, (_, j) => timedGroup({ id: `${prefixAt(prefixes, j, 'n')}Strum`, prefix: prefixAt(prefixes, j, 'n'), domain: [...d, j],
    size: 5, anchor: String(base + 3 * j), delay: spell(BigInt(2 * draw([...d, j, 'delay'], 1, 7) - 1), 128n),
    label: `upstroke strum ${j + 1}`, root: draw([...d, j, 'root'], 43, 52), intervals: [0, 7, 12, 16, 19] }));
  const tail = base + 3 * K;
  const loose = [n('la', draw([...d, 'la'], 30, 40), quarterPlus(tail, [...d, 'laAt'], 0, 255), '1', draw([...d, 'laVel'], 60, 100)),
    n('lb', draw([...d, 'lb'], 72, 84), quarterPlus(tail + 1, [...d, 'lbAt'], 0, 255), '1/2', draw([...d, 'lbVel'], 60, 100))];
  const input = { notes: [...e.notes, ...sets.flatMap(s => s.notes), ...loose], groups: [e.group] };
  const expected = { notes: clone(input.notes), groups: [clone(e.group), ...sets.map(s => clone(s.group))] };
  const items = sets.map((s, j) => { const ids = s.group.members.join(', ');
    return `(${j + 1}) id ${s.group.id}, members ${ids} in that order, label "${s.group.label}", anchor ${s.group.anchor}, delay ${s.group.delay} and performanceOrder ${ids}`; });
  return { input, expected, response: 'surface', detail: { groups: K, anchors: sets.map(s => s.group.anchor), delays: sets.map(s => s.group.delay) },
    request: `Make ${K === 1 ? 'one new timed group' : `${K} new timed groups`} from loose notes, appended after the existing groups in this order: ${items.join('; ')}. Each new group has provenance {"kind":"declared","source":"pilot-synthetic-author"}. Choose each member's spread so that its onset is unchanged (onset = anchor + delay + spread). Preserve every note's pitch, duration and velocity, and every other note and group. Do not round values to a grid.` };
}

function memberMove(M, k) {
  const d = ['member-move', M, k], a = draw([...d, 'anchor'], 2, 4), pairs = Math.ceil(M / 2);
  const targets = 'uvwxyz', sources = 'dejkmn', built = [];
  for (let i = 0; i < pairs; i++) {
    const t = timedGroup({ id: `${prefixAt(targets, i, 'u')}Strum`, prefix: prefixAt(targets, i, 'u'), domain: [...d, i, 't'], size: 4, anchor: String(a + 4 * i),
      delay: cell(draw([...d, i, 't', 'delay'], 2, 24)), label: `upper strum ${i + 1}`, root: draw([...d, i, 't', 'root'], 60, 67), intervals: [0, 4, 7, 12] });
    const s = timedGroup({ id: `${prefixAt(sources, i, 'd')}Strum`, prefix: prefixAt(sources, i, 'd'), domain: [...d, i, 's'], size: 4, anchor: String(a + 4 * i + 2),
      delay: cell(draw([...d, i, 's', 'delay'], 2, 24)), label: `lower strum ${i + 1}`, root: draw([...d, i, 's', 'root'], 40, 47), intervals: [0, 7, 12, 16] });
    built.push({ t, s, count: i < pairs - 1 ? 2 : M - 2 * (pairs - 1) });
  }
  const free = n('fa', draw([...d, 'fa'], 72, 84), quarterPlus(a + 1, [...d, 'faAt'], 128, 384), '2', draw([...d, 'faVel'], 50, 90));
  const pad = { id: 'pad', members: [built[0].t.notes[1].id, ...built.map(b => b.s.notes[0].id), 'fa'], label: 'held voices', provenance: declared() };
  const loose = n('la', draw([...d, 'la'], 30, 39), quarterPlus(a + 4 * pairs, [...d, 'laAt'], 0, 255), '1/2', draw([...d, 'laVel'], 60, 100));
  const input = { notes: [...built.flatMap(b => [...b.t.notes, ...b.s.notes]), free, loose],
    groups: [...built.flatMap(b => [b.t.group, b.s.group]), pad] };
  const moves = [];
  built.forEach((b, i) => {
    let spread = b.t.cells.at(-1);
    for (let j = 0; j < b.count; j++) {
      spread += draw([...d, i, 'spread', j], 4, 16);
      moves.push({ note: b.s.group.members[j], from: b.s.group.id, to: b.t.group.id, spread: cell(spread) });
    }
  });
  const expected = clone(input), group = id => expected.groups.find(g => g.id === id);
  for (const m of moves) {
    const to = group(m.to), from = group(m.from);
    to.members.push(m.note); to.performanceOrder.push(m.note); to.spread[m.note] = m.spread;
    from.members = from.members.filter(x => x !== m.note); from.performanceOrder = from.performanceOrder.filter(x => x !== m.note);
    delete from.spread[m.note];
    expected.notes.find(x => x.id === m.note).at = add(add(to.anchor, to.delay), m.spread);
  }
  const phrases = moves.map(m => `move note ${m.note} from group ${m.from} to group ${m.to} with spread ${m.spread}`);
  return { input, expected, response: 'surface', detail: { moves },
    request: `Make ${M === 1 ? 'one move' : `${M} moves`}, in this order: ${phrases.join('; ')}. Append each moved note to its new group's members and performanceOrder, and remove it from its old group's members, spread and performanceOrder. Each moved note's onset must follow its new group's equation. Keep its other group memberships, its pitch, duration and velocity, and every other note and group unchanged.` };
}

/** ROUND2_RULES.rangeEdit over a window's notes; throws "no eligible …" when none. */
export function rangeEditTarget(notes) {
  const N = notes.length, order = sorted(notes), lo = Math.ceil(N / 16), hi = Math.floor(N / 8);
  const onsets = [...new Set(order.map(x => x.at))].sort(cmp), start = order[Math.floor(N / 3)].at;
  const clip = clipQuarters(notes);
  for (const from of onsets.filter(x => cmp(x, start) >= 0)) {
    const inside = to => x => cmp(x.at, from) >= 0 && cmp(x.at, to) < 0;
    const to = onsets.find(x => cmp(x, from) > 0 && notes.filter(inside(x)).length >= lo);
    if (!to) break;
    const count = notes.filter(inside(to)).length;
    if (count > hi) continue;
    const after = notes.map(x => inside(to)(x) ? { ...x, at: add(x.at, '1/8'), pitch: x.pitch + 2 } : x);
    if (after.every(x => x.pitch <= 127) && new Set(after.map(address)).size === after.length && clipQuarters(after) === clip)
      return { from, to, count, after };
  }
  throw new Error('no eligible range-edit range');
}

/** ROUND2_RULES.selectiveDelete: the planted target and near misses; throws "no eligible …" when none. */
export function plantNearMisses(notes, K, domain) {
  const order = sorted(notes), from = floorQuarter(order[Math.floor(order.length / 2)].at), to = add(from, '1/2');
  const near = x => cmp(x.at, add(from, '-1')) >= 0 && cmp(x.at, add(to, '1')) <= 0;
  const pitches = notes.map(x => x.pitch).sort((x, y) => x - y), median = pitches[Math.floor(pitches.length / 2)];
  const free = [];
  for (let p = pitches[0]; p <= pitches.at(-1); p++) if (!notes.some(x => x.pitch === p && near(x))) free.push(p);
  if (!free.length) throw new Error('no eligible near-miss pitch');
  const pitch = free.sort((x, y) => Math.abs(x - median) - Math.abs(y - median) || x - y)[0];
  const offsets = [() => to, () => add(from, `-${cell(draw([...domain, 'm1'], 8, 64))}`), () => add(to, cell(draw([...domain, 'm2'], 8, 64))),
    () => add(from, `-${cell(draw([...domain, 'm3'], 128, 250))}`), () => add(to, cell(draw([...domain, 'm4'], 128, 250))),
    () => add(from, `-${cell(draw([...domain, 'm5'], 300, 500))}`)];
  // Ladder v2: beyond six, near misses alternate after T and before F at seeded
  // distinct distances under one quarter; the first six are v1's.
  const used = new Set();
  for (let j = 6; j < K; j++) offsets.push(() => {
    for (let c = 0; ; c++) {
      const distance = cell(draw([...domain, 'mx', j, c], 2, 510)), at = j % 2 ? add(from, `-${distance}`) : add(to, distance);
      if (!used.has(at)) { used.add(at); return at; }
    }
  });
  assert(K >= 1 && K <= Math.max(6, offsets.length), 'near misses must be at least 1');
  const planted = (role, at, i) => ({ role, pitch, at, duration: cell(draw([...domain, 'duration', i], 64, 256)), velocity: draw([...domain, 'velocity', i], 50, 100) });
  const target = planted('target', add(from, cell(draw([...domain, 'target'], 16, 240))), 0);
  return { from, to, pitch, target, misses: offsets.slice(0, K).map((f, i) => { const at = f(); used.add(at); return planted('near-miss', at, i + 1); }) };
}

const strip = notes => notes.map(({ id, pitch, at, duration }) => ({ id, pitch, at, duration }));
const windowNotes = w => synthesizeVelocities(strip(w.notes), w.shardId, ROUND2_SEEDS.velocity);
const windowOf = (windows, size, k) => {
  const w = windows.windows.find(x => x.size === size && x.instance === k);
  assert(w, `no round-2 window of ${size} notes for instance ${k}`);
  return w;
};
const src = w => `round2-window:${w.size}:${w.instance}:${w.work}`;

function rangeEdit(N, k, windows) {
  const w = windowOf(windows, N, k), notes = windowNotes(w), range = rangeEditTarget(notes);
  return { input: { notes }, expected: { notes: range.after }, response: 'surface', source: src(w), detail: { from: range.from, to: range.to, rangeNotes: range.count },
    request: `For every note whose onset is at least ${range.from} and less than ${range.to}, move the onset later by 1/8 and transpose the note up two semitones. Preserve their durations (not end times) and velocities, and every other note.` };
}

function selectiveDelete(K, k, windows) {
  const w = windowOf(windows, DELETE_WINDOW, k), base = windowNotes(w);
  const plan = plantNearMisses(base, K, ['selective-delete', K, k]);
  const prefix = base[0].id.match(/^(t\d+n)/)?.[1] ?? 'n';
  const all = sorted([...base, ...[plan.target, ...plan.misses].map(({ role, ...x }, i) => ({ id: `planted${i}`, ...x, role }))]);
  const notes = all.map(({ role, ...x }, i) => ({ ...x, id: `${prefix}${i + 1}` }));
  const targetId = notes[all.findIndex(x => x.role === 'target')].id;
  return { input: { notes: clone(notes) }, expected: { notes: notes.filter(x => x.id !== targetId) }, response: 'surface', conditionalRefusal: true, source: src(w),
    detail: { from: plan.from, to: plan.to, pitch: plan.pitch, nearMisses: K, target: targetId, nearMissIds: all.flatMap((x, i) => x.role === 'near-miss' ? [notes[i].id] : []) },
    request: `Delete the note with pitch ${plan.pitch} whose onset is at least ${plan.from} and less than ${plan.to}. Select only by that pitch and onset range; do not choose by ID, duration, velocity or order. If the selector matches more than one note, return REFUSE ambiguous-selector.` };
}

function preservePerformed(N, k, windows) {
  const w = windowOf(windows, N, k), notes = windowNotes(w);
  return { input: { notes }, expected: { notes: clone(notes) }, response: 'surface', source: src(w), detail: {},
    request: 'Return the complete note state unchanged, preserving multiplicity, pitch, onset, duration and velocity.' };
}

function preserveExact(N, k, windows) {
  const w = windowOf(windows, N, k), d = ['preserve-exact', N, k];
  const velocity = new Map(windowNotes(w).map(x => [x.id, x.velocity]));
  const notes = w.sourceNotes.map(({ id, pitch, at, duration }, i) => {
    const x = { id, pitch, at, duration, velocity: velocity.get(id) };
    if (i % 32 === 7) Object.assign(x, { channel: draw([...d, 'channel', i], 2, 4), expression: { velocitySpread: 0, gain: 1,
      pan: draw([...d, 'pan', i], -4, 4) / 8, pressure: draw([...d, 'pressure', i], 0, 8) / 8, timbre: 0.3, transpose: 0.5 } });
    if (i % 64 === 19) x.annotation = { origin: 'unknown', confidence: null, tags: ['kept'] };
    if (i % 48 === 11) Object.assign(x, { mute: false, chance: { enabled: true, value: 0.7 } });
    return x;
  });
  return { input: { notes }, expected: clone({ notes }), response: 'surface', source: src(w), detail: {},
    request: 'Return the entire fixture unchanged, including exact rational values, original note order, all channels/expression/conditional state, and opaque annotations. Do not invent musical intent.' };
}

// Format-dependent families (R01-D19, R01-D20) live in round2-families.mjs.
const GENERATORS = { 'derived-read': derivedRead, 'group-retime': groupRetime, regroup, 'member-move': memberMove,
  'range-edit': rangeEdit, 'selective-delete': selectiveDelete, 'preserve-performed': preservePerformed, 'preserve-exact': preserveExact,
  ...FAMILY_GENERATORS };
export { LADDERS_V4, LADDERS_V5, LADDERS_V6, ROUND2_FAMILY_RULES, ROUND2_FAMILY_RULES_V5, ROUND2_FAMILY_RULES_V6 };

export const taskId = (family, level, instance, ladder = LADDERS[family]) => `r2-${ladder.short}-L${level}-i${instance}`;

export function loadRound2Windows(path = ROUND2_WINDOWS_PATH) {
  return JSON.parse(readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8'));
}

/**
 * Every ladder task in package order: family, then level, then instance. A
 * ladder's own `instances` list (v3) overrides the count, which numbers 1..n.
 */
export function round2Tasks(windows = loadRound2Windows(), { ladders = LADDERS, instances = INSTANCES } = {}) {
  const tasks = [];
  for (const [family, ladder] of Object.entries(ladders)) {
    ladder.levels.forEach((level, levelIndex) => {
      for (const instance of ladder.instances ?? range(1, instances)) {
        const built = GENERATORS[family](level, instance, windows);
        const { detail, ...task } = built;
        tasks.push({ id: taskId(family, level, instance, ladder), version: 1, family: ladder.family, cohort: ladder.cohort,
          source: task.source ?? 'synthetic', ...task,
          ...(ladder.cohort === 'source' && ladder.diagnosticLevel === levelIndex ? { diagnostics: true } : {}),
          ladder: { family, level, levelIndex, instance, axis: ladder.axis, from: ladder.from, ...detail } });
      }
    });
  }
  return tasks;
}
