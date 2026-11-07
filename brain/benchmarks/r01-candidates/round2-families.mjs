// R01 round 2 format-dependent families (R01-D19, R01-D20). Difficulty comes
// from how a format represents structure, not from counting independent
// operations: selection by derived onsets, overlapping memberships, a small
// edit inside a large rich document, and interpretation lifecycle under mixed
// provenance. Every family is synthetic (seed r01-round2-families-v1), scales
// one axis and keeps note-array order equal to C4 block traversal, so neither
// FIELDS surface needs order cells. Expected states follow the stated rules
// without any codec. Each family also declares its level-aware wrong answers.
import assert from 'node:assert/strict';
import { add, canonical, cmp, mul, rational, spell } from './common.mjs';
import { draw as seededDraw } from './pilot-tasks.mjs';

export const FAMILY_SEED = 'r01-round2-families-v1';
const draw = (domain, low, high) => seededDraw(domain, low, high, FAMILY_SEED);
const clone = structuredClone;
const cell = k => spell(BigInt(k), 512n);
const sub = (a, b) => add(a, mul(b, '-1'));
const own = (object, key) => Object.hasOwn(object ?? {}, key);
const declared = () => ({ kind: 'declared', source: 'pilot-synthetic-author' });
const inferred = () => ({ kind: 'inferred', source: 'pilot-groove-analysis' });
const n = (id, pitch, at, duration, velocity, extra = {}) => ({ id, pitch, at, duration, velocity, ...extra });
const MEMBER = 'abcdefgh';
const oddSixteenth = domain => spell(BigInt(2 * draw(domain, 1, 5) + 1), 16n);
function floorQuarter(value) {
  const [num, den] = rational(value);
  let q = num / den;
  if (num < 0n && num % den !== 0n) q -= 1n;
  return spell(q);
}
const floorTo = (value, perQuarter) => { const [num, den] = rational(value); return spell((num * perQuarter) / den, perQuarter); };

/** Spread cells rising strictly from 0 by seeded steps. */
function spreadCells(domain, size, low, high) {
  const cells = [0];
  for (let i = 1; i < size; i++) cells.push(cells[i - 1] + draw([...domain, 'step', i], low, high));
  return cells;
}
const specOnset = (spec, j) => add(add(spec.anchor, spec.delay), cell(spec.cells[j]));
/** A timed-group spec whose member j sounds exactly at onset T (positive delay under one quarter plus 1/512). */
function plantAt(domain, T, j, size) {
  const cells = spreadCells(domain, size, 10, 20), base = sub(T, cell(cells[j]));
  const anchor = floorQuarter(sub(base, cell(1)));
  return { domain, size, cells, anchor, delay: sub(base, anchor) };
}
/** Notes and group of a timed spec; members are `${id}a`, `${id}b`, ... */
function materialize(spec, id, extra = {}) {
  const ids = spec.cells.map((_, i) => `${id}${MEMBER[i]}`);
  const notes = ids.map((noteId, i) => n(noteId, spec.root + spec.intervals[i], specOnset(spec, i),
    cell(draw([...spec.domain, 'duration', i], 128, 1024)), draw([...spec.domain, 'velocity', i], 50, 115)));
  const group = { id, members: [...ids], label: spec.label, provenance: spec.provenance ?? declared(), anchor: spec.anchor, delay: spec.delay,
    spread: Object.fromEntries(ids.map((x, i) => [x, cell(spec.cells[i])])), performanceOrder: [...ids], ...extra };
  return { notes, group };
}

/** Recompute the onset of every member owned by the named timed groups (all when null). */
function realize(fixture, groupIds = null) {
  const byId = new Map(fixture.notes.map(x => [x.id, x]));
  for (const g of fixture.groups ?? []) if (g.spread && (groupIds === null || groupIds.includes(g.id)))
    for (const [id, spread] of Object.entries(g.spread)) byId.get(id).at = add(add(g.anchor, g.delay ?? '0'), spread);
  return fixture;
}

/**
 * C4 block traversal: each note is homed in its timing owner, else its first
 * containing group, else NOTES; groups emit their homed members in member order.
 */
export function homeOrder(fixture) {
  const groups = fixture.groups ?? [];
  const home = id => groups.find(g => own(g.spread, id))?.id ?? groups.find(g => g.members.includes(id))?.id ?? null;
  const homes = new Map(fixture.notes.map(x => [x.id, home(x.id)]));
  return [...groups.flatMap(g => g.members.filter(id => homes.get(id) === g.id)), ...fixture.notes.filter(x => homes.get(x.id) === null).map(x => x.id)];
}
function inHomeOrder(fixture) {
  const byId = new Map(fixture.notes.map(x => [x.id, x]));
  return { ...fixture, notes: homeOrder(fixture).map(id => byId.get(id)) };
}

const KEEP = 'Keep each changed group\'s common delay and group equation. Preserve every other field, membership, member order, performanceOrder, label and provenance, and every other note and group. Do not round values to a grid.';

// ---------------------------------------------------------------------------
// Query-selected edit: level = timed groups scanned; half sit at the bounds.

const NEAR_KINDS = ['x-out', 'y-out', 'x-in', 'y-in'];
function queryEdit(G, k) {
  assert(G >= 4 && G % 2 === 0, 'query-edit levels are even and at least 4');
  const d = ['query-edit', G, k], coreCount = G / 2, a = draw([...d, 'anchor'], 2, 4);
  const core = Array.from({ length: coreCount }, (_, i) => {
    const size = i % 2 ? 4 : 5, domain = [...d, 'core', i];
    return { domain, size, anchor: String(a + 2 * i), delay: cell(draw([...domain, 'delay'], 2, 24)), cells: spreadCells(domain, size, 3, 12),
      root: draw([...domain, 'root'], 48, 57), intervals: [0, 4, 7, 12, 16], role: 'core' };
  });
  const ix = Math.floor(coreCount / 4), iy = Math.floor(3 * coreCount / 4);
  const X = specOnset(core[ix], 1), Y = specOnset(core[iy], 3);
  // Near misses: the latest member just below X (out) or at/just above X (in);
  // the earliest member at/just above Y (out) or just below Y (in).
  const near = Array.from({ length: G - coreCount }, (_, j) => {
    const kind = NEAR_KINDS[j % 4], domain = [...d, 'near', j];
    const delta = j < 4 ? { 'x-out': 1, 'y-out': 0, 'x-in': 0, 'y-in': 1 }[kind]
      : draw([...domain, 'delta'], kind === 'x-out' || kind === 'y-in' ? 1 : 0, 8);
    const T = { 'x-out': sub(X, cell(delta)), 'x-in': add(X, cell(delta)), 'y-out': add(Y, cell(delta)), 'y-in': sub(Y, cell(delta)) }[kind];
    return { ...plantAt(domain, T, kind[0] === 'x' ? 3 : 0, 4), root: draw([...domain, 'root'], 60, 67), intervals: [0, 3, 7, 10], role: kind };
  });
  const specs = [...core, ...near].sort((p, q) => cmp(specOnset(p, 0), specOnset(q, 0)) || JSON.stringify(p.domain).localeCompare(JSON.stringify(q.domain)));
  const built = specs.map((spec, i) => materialize({ ...spec, label: `strum ${i + 1}` }, `q${i + 1}`));
  const coreIx = built[specs.indexOf(core[ix])];
  const pad = { id: 'pad', members: ['fa', 'fb', coreIx.notes[0].id], label: 'sustained pad', provenance: declared() };
  const untimed = [n('fa', draw([...d, 'fa'], 72, 84), add(X, cell(draw([...d, 'faAt'], 1, 64))), '1', draw([...d, 'faVel'], 50, 90)),
    n('fb', draw([...d, 'fb'], 72, 84), Y, '1', draw([...d, 'fbVel'], 50, 90))];
  const loose = [n('la', draw([...d, 'la'], 30, 40), add(String(a - 1), cell(draw([...d, 'laAt'], 0, 255))), '1/2', draw([...d, 'laVel'], 60, 100)),
    n('lb', draw([...d, 'lb'], 30, 40), X, '1/2', draw([...d, 'lbVel'], 60, 100)),
    n('lc', draw([...d, 'lc'], 30, 40), add(Y, cell(draw([...d, 'lcAt'], 1, 64))), '1/2', draw([...d, 'lcVel'], 60, 100)),
    n('ld', draw([...d, 'ld'], 30, 40), add(String(a + 2 * coreCount), cell(draw([...d, 'ldAt'], 0, 255))), '1/2', draw([...d, 'ldVel'], 60, 100))];
  const input = inHomeOrder({ notes: [...built.flatMap(b => b.notes), ...untimed, ...loose], groups: [...built.map(b => b.group), pad] });
  const D = oddSixteenth([...d, 'shift']);
  const selection = querySelection(input, X, Y);
  const expected = applyQuery(input, selection, D);
  return { input, expected, response: 'surface',
    detail: { groups: G, nearMisses: G - coreCount, from: X, to: Y, shift: D, selectedNotes: selection.notes, selectedGroups: selection.groups },
    request: `Select using the input's performed onsets, then make two changes. (1) Transpose up 12 semitones every note whose performed onset is at least ${X} and less than ${Y}. (2) Move the anchor of every timed group (a group with an anchor) that has at least one member whose performed onset is in that range later by ${D}, and update its timed members' onsets to match. A note outside the range keeps its pitch even when its group moves. ${KEEP}` };
}
function querySelection(input, X, Y, { lowerInclusive = true, upperInclusive = false, onset = x => x.at } = {}) {
  const inRange = x => (lowerInclusive ? cmp(onset(x), X) >= 0 : cmp(onset(x), X) > 0) && (upperInclusive ? cmp(onset(x), Y) <= 0 : cmp(onset(x), Y) < 0);
  const notes = input.notes.filter(inRange).map(x => x.id);
  const groups = input.groups.filter(g => g.spread && g.members.some(id => notes.includes(id))).map(g => g.id);
  return { notes, groups };
}
function applyQuery(input, { notes, groups }, D, { transpose = true, move = true, field = 'anchor' } = {}) {
  const expected = clone(input);
  if (transpose) for (const x of expected.notes) if (notes.includes(x.id)) x.pitch += 12;
  if (move) for (const g of expected.groups) if (groups.includes(g.id)) g[field] = add(g[field], D);
  return realize(expected, groups);
}

// ---------------------------------------------------------------------------
// Overlapping memberships: level = memberships of each heavy note.

function overlapEdit(L, k) {
  assert(L >= 2, 'overlap-edit needs at least two memberships');
  const d = ['overlap-edit', L, k], a = draw([...d, 'anchor'], 2, 3), V = L + 1;
  const owners = Array.from({ length: 4 }, (_, i) => {
    const domain = [...d, 'o', i];
    return materialize({ domain, size: 5, anchor: String(a + 3 * i), delay: cell(draw([...domain, 'delay'], 2, 24)), cells: spreadCells(domain, 5, 3, 12),
      root: draw([...domain, 'root'], 48, 57), intervals: [0, 4, 7, 11, 14], label: `chord ${i + 1}` }, `o${i + 1}`);
  });
  // Overlay j: timed (odd j, owns three notes) or timing-free (even j, homes one untimed note).
  const overlays = Array.from({ length: V }, (_, j) => {
    const domain = [...d, 'v', j];
    if (j % 2) {
      const w = (j + 1) / 2;
      return materialize({ domain, size: 3, anchor: String(a + 3 * (w - 1) + 1), delay: cell(draw([...domain, 'delay'], 2, 24)),
        cells: spreadCells(domain, 3, 3, 12), root: draw([...domain, 'root'], 72, 79), intervals: [0, 3, 7], label: `counterline ${w}` }, `w${w}`);
    }
    const v = j / 2 + 1, note = n(`v${v}x`, draw([...domain, 'pitch'], 36, 47), add(String(a + 3 * (v - 1) + 2), cell(draw([...domain, 'at'], 0, 255))), '1', draw([...domain, 'vel'], 50, 90));
    return { notes: [note], group: { id: `v${v}`, members: [note.id], label: `voice ${v}`, provenance: declared() }, free: true };
  });
  const heavy = owners.map(o => o.notes[2].id), [o1, o2, , o4] = owners.map(o => o.group.id), w1 = overlays[1].group.id;
  const join = (group, id) => { group.members.push(id); if (group.performanceOrder) group.performanceOrder.push(id); };
  // Required overlaps: heavy 1 is referenced by w1, heavy 2 by owner o2, and o2 references w1's second note.
  const required = [[], [w1], [o2], []];
  const groupOf = id => [...owners, ...overlays].find(b => b.group.id === id).group;
  heavy.forEach((id, i) => {
    const pool = overlays.map(b => b.group.id).filter(g => !required[i].includes(g));
    const ranked = pool.map(g => ({ g, r: draw([...d, 'pick', i, g], 0, 1e6) })).sort((p, q) => p.r - q.r || p.g.localeCompare(q.g)).map(p => p.g);
    for (const g of [...required[i], ...ranked.slice(0, L - 1 - required[i].length)]) join(groupOf(g), id);
  });
  join(groupOf(o2), overlays[1].notes[1].id);
  // Light overlaps: each overlay also references one non-heavy owner note.
  overlays.forEach((b, j) => {
    const o = draw([...d, 'light', j], 0, 3), m = [0, 1, 3, 4][draw([...d, 'lightMember', j], 0, 3)];
    const id = owners[o].notes[m].id;
    if (!b.group.members.includes(id)) join(b.group, id);
  });
  // Timing-free overlays: every second one presents its members in reverse.
  overlays.filter(b => b.free).forEach((b, i) => { if (i % 2) b.group.presentationOrder = [...b.group.members].reverse(); });
  const timedOverlays = overlays.filter(b => !b.free), freeOverlays = overlays.filter(b => b.free);
  const timed = [...owners.flatMap((o, i) => [o, ...(timedOverlays[i] ? [timedOverlays[i]] : [])]), ...timedOverlays.slice(owners.length)];
  const input = inHomeOrder({ notes: [...owners, ...overlays].flatMap(b => b.notes), groups: [...timed, ...freeOverlays].map(b => b.group) });
  for (const id of heavy) assert.equal(input.groups.filter(g => g.members.includes(id)).length, L, `${id}: memberships`);
  const D = oddSixteenth([...d, 'shift']), cells = owners[0].group.spread;
  const c2 = rational(cells[heavy[0]]), c3 = rational(cells[owners[0].notes[3].id]);
  const gap = Number((c3[0] * 512n) / c3[1] - (c2[0] * 512n) / c2[1]);
  const S = add(cells[heavy[0]], cell(draw([...d, 'spread'], 1, gap - 1)));
  const removeFrom = input.groups.find(g => g.id !== o4 && g.members.includes(heavy[3])).id;
  const ops = { retime: { group: o2, by: D }, scale: { group: w1, factor: '2' }, set: { note: heavy[0], group: o1, spread: S }, remove: { note: heavy[3], group: removeFrom } };
  return { input, expected: applyOverlap(input, ops), response: 'surface', detail: { memberships: L, overlays: V, heavy, ops },
    request: `Make four changes: (1) move the anchor of group ${o2} later by ${D}; (2) double every spread in group ${w1}; (3) set the spread of note ${heavy[0]} in group ${o1} to ${S}; (4) remove note ${heavy[3]} from group ${removeFrom} only. A group's anchor, delay and spreads time only the members it owns; update each owned member's onset to match its group equation. Keep every other membership, member order, performanceOrder and presentationOrder entry, label and provenance, and every other note and group unchanged. Do not round values to a grid.` };
}
function applyOverlap(input, ops, { skip = [], moveReferenced = false, doubleReferenced = false, removeEverywhere = false, removeFrom = null, addSpread = false } = {}) {
  const f = clone(input), group = id => f.groups.find(g => g.id === id);
  const owner = id => f.groups.find(g => own(g.spread, id));
  const touched = new Set();
  if (!skip.includes('retime')) {
    const g = group(ops.retime.group);
    g.anchor = add(g.anchor, ops.retime.by); touched.add(g.id);
    if (moveReferenced) for (const id of g.members.filter(x => !own(g.spread, x))) { const o = owner(id); o.spread[id] = add(o.spread[id], ops.retime.by); touched.add(o.id); }
  }
  if (!skip.includes('scale')) {
    const g = group(ops.scale.group);
    // Misreading: double the spreads of referenced members in their own timing groups too.
    if (doubleReferenced) for (const id of g.members.filter(x => !own(g.spread, x))) { const o = owner(id); o.spread[id] = mul(o.spread[id], ops.scale.factor); touched.add(o.id); }
    g.spread = Object.fromEntries(Object.entries(g.spread).map(([id, s]) => [id, mul(s, ops.scale.factor)])); touched.add(g.id);
  }
  if (!skip.includes('set')) {
    const g = group(ops.set.group);
    g.spread[ops.set.note] = addSpread ? add(g.spread[ops.set.note], ops.set.spread) : ops.set.spread; touched.add(g.id);
  }
  if (!skip.includes('remove')) {
    const targets = removeEverywhere ? f.groups.filter(g => g.members.includes(ops.remove.note) && !own(g.spread, ops.remove.note)).map(g => g.id) : [removeFrom ?? ops.remove.group];
    for (const id of targets) {
      const g = group(id);
      for (const key of ['members', 'performanceOrder', 'presentationOrder']) if (g[key]) g[key] = g[key].filter(x => x !== ops.remove.note);
    }
  }
  return realize(f, [...touched]);
}

// ---------------------------------------------------------------------------
// Edit within large state: level = notes in a rich synthetic document.

function largeEdit(N, k) {
  assert(N >= 64, 'large-edit needs at least 64 notes');
  const d = ['large-edit', N, k], blocks = [], loose = [];
  let count = 0, t = 1, slot = 0, g = 0, f = 0, edit = null, lastPlainTimed = null;
  const timedBlock = (size, role, provenance) => {
    const domain = [...d, 'g', g], spec = { domain, size, anchor: String(t), delay: cell(draw([...domain, 'delay'], 2, 24)), cells: spreadCells(domain, size, 3, 12),
      root: draw([...domain, 'root'], 40, 64), intervals: [0, 4, 7, 12, 16, 19], label: provenance.kind === 'inferred' ? `groove cluster ${g + 1}` : `strum ${g + 1}`, provenance };
    const b = materialize(spec, `g${g + 1}`, provenance.kind === 'inferred' ? { state: 'current' } : {});
    const block = { ...b, role, cells: spec.cells };
    g++; t++; count += size; blocks.push(block);
    return block;
  };
  while (count < N) {
    const remaining = N - count;
    if (!edit && count >= Math.floor(N / 2) && remaining >= 12) {
      edit = { target: timedBlock(4, 'edit', declared()), source: timedBlock(4, 'edit', declared()), retime: timedBlock(4, 'edit', declared()) };
      continue;
    }
    const roll = draw([...d, 'slot', slot++], 0, 9);
    if (roll <= 5 && remaining >= 3) {
      const b = timedBlock(Math.min(remaining, draw([...d, 'size', g], 3, 6)), 'plain', draw([...d, 'prov', g], 0, 3) === 0 ? inferred() : declared());
      lastPlainTimed = b;
    } else if (roll === 6 && remaining >= 2) {
      const size = Math.min(remaining, draw([...d, 'fsize', f], 2, 3)), domain = [...d, 'f', f], id = `f${f + 1}`;
      const cells = spreadCells(domain, size, 32, 96);
      const notes = cells.map((c, i) => n(`${id}${MEMBER[i]}`, draw([...domain, 'pitch', i], 66, 88), add(String(t), cell(c)), cell(draw([...domain, 'dur', i], 256, 1536)), draw([...domain, 'vel', i], 40, 100)));
      const members = [...notes.map(x => x.id), ...(lastPlainTimed ? [lastPlainTimed.notes[0].id] : [])];
      const group = { id, members, label: `phrase ${f + 1}`, provenance: declared(), ...(f % 3 === 0 ? { presentationOrder: [...members].reverse() } : {}) };
      blocks.push({ notes, group, role: 'free' }); f++; t++; count += size;
    } else {
      const domain = [...d, 'l', loose.length];
      loose.push(n(`l${loose.length + 1}`, draw([...domain, 'pitch'], 28, 52), add(String(t), cell(draw([...domain, 'at'], 0, 511))), cell(draw([...domain, 'dur'], 64, 512)), draw([...domain, 'vel'], 45, 110)));
      count++; if (draw([...domain, 'advance'], 0, 1)) t++;
    }
  }
  assert(edit, 'large-edit placed no edit block');
  const editIds = new Set([edit.target, edit.source, edit.retime].flatMap(b => b.notes.map(x => x.id)));
  const base = inHomeOrder({ notes: [...blocks.flatMap(b => b.notes), ...loose], groups: blocks.map(b => b.group) });
  // Rich fields by final note index; edited notes carry no nominal timing, so no lifecycle rule applies.
  const nominal = {};
  base.notes.forEach((x, i) => {
    if (i % 32 === 7) Object.assign(x, { channel: draw([...d, 'channel', i], 2, 4), expression: { velocitySpread: 0, gain: 1,
      pan: draw([...d, 'pan', i], -4, 4) / 8, pressure: draw([...d, 'pressure', i], 0, 8) / 8, timbre: 0.3, transpose: 0.5 } });
    if (i % 64 === 19) x.annotation = { origin: 'unknown', confidence: null, tags: ['kept'] };
    if (i % 48 === 11) Object.assign(x, { mute: false, chance: { enabled: true, value: 0.7 } });
    if (editIds.has(x.id)) return;
    if (i % 5 === 2) nominal[x.id] = { at: floorTo(x.at, 8n), duration: '1/4', ...(i % 15 === 2 ? { provenance: declared() } : {}) };
    else if (i % 40 === 23) x.nominal = { at: floorTo(x.at, 4n), division: '1/4', provenance: declared() };
  });
  const input = { ...base, musical: { nominal, provenance: { kind: 'inferred', source: 'pilot-grid-analysis' } } };
  const moved = edit.source.notes[0].id, S = cell(edit.target.cells.at(-1) + draw([...d, 'spread'], 4, 16)), D = oddSixteenth([...d, 'shift']);
  const ops = { move: { note: moved, from: edit.source.group.id, to: edit.target.group.id, spread: S }, retime: { group: edit.retime.group.id, by: D } };
  const expected = applyLarge(input, ops);
  assert.deepEqual(expected.notes.map(x => x.id), homeOrder(expected), 'large-edit move keeps block traversal');
  return { input, expected, response: 'surface',
    detail: { notes: N, groups: input.groups.length, timedGroups: input.groups.filter(x => x.spread).length, loose: loose.length, ops },
    request: `Make two changes. (1) Move note ${moved} from group ${ops.move.from} to group ${ops.move.to} with spread ${S}: append it to ${ops.move.to}'s members and performanceOrder, remove it from ${ops.move.from}'s members, spread and performanceOrder, and set its onset by ${ops.move.to}'s group equation. (2) Move the anchor of group ${ops.retime.group} later by ${D}, keeping its delay and spreads, and update its members' onsets. Preserve every other note, group, field, nominal entry, annotation and order exactly. Do not round values to a grid.` };
}
function applyLarge(input, ops, { skip = [], keepOnset = false, field = 'anchor', retimeGroup = null } = {}) {
  const f = clone(input), group = id => f.groups.find(g => g.id === id), touched = [];
  if (!skip.includes('move')) {
    const m = ops.move, to = group(m.to), from = group(m.from), note = f.notes.find(x => x.id === m.note);
    to.members.push(m.note); to.performanceOrder.push(m.note);
    to.spread[m.note] = keepOnset ? sub(sub(note.at, to.anchor), to.delay) : m.spread;
    from.members = from.members.filter(x => x !== m.note); from.performanceOrder = from.performanceOrder.filter(x => x !== m.note);
    delete from.spread[m.note]; touched.push(m.to);
  }
  if (!skip.includes('retime')) { const g = group(retimeGroup ?? ops.retime.group); g[field] = add(g[field], ops.retime.by); touched.push(g.id); }
  return realize(f, touched);
}

// ---------------------------------------------------------------------------
// Interpretation maintenance: level = edits under mixed provenance.

const EDIT_KINDS = ['onset-spread', 'velocity', 'pitch', 'duration', 'anchor', 'loose-onset'];
const NOMINAL_KINDS = ['mapped-inherited', 'mapped-declared', 'local-inferred', 'none'];
function interpMaintain(E, k) {
  assert(E >= 1, 'interp-maintain needs at least one edit');
  const d = ['interp-maintain', E, k], T = E + 1, a = draw([...d, 'anchor'], 2, 3);
  const timed = Array.from({ length: T }, (_, i) => {
    const domain = [...d, 'c', i], kind = i === 0 ? 'inferred' : i === 1 ? 'declared' : draw([...domain, 'prov'], 0, 1) ? 'inferred' : 'declared';
    return materialize({ domain, size: 4, anchor: String(a + 2 * i), delay: cell(draw([...domain, 'delay'], 2, 24)), cells: spreadCells(domain, 4, 3, 12),
      root: draw([...domain, 'root'], 48, 57), intervals: [0, 4, 7, 12], label: kind === 'inferred' ? `groove cluster ${i + 1}` : `strum ${i + 1}`,
      provenance: kind === 'inferred' ? inferred() : declared() }, `c${i + 1}`, kind === 'inferred' ? { state: 'current' } : {});
  });
  // Three loose notes, or one more than the loose-onset edits past 17 edits (v4 levels unchanged).
  const loose = Array.from({ length: Math.max(3, Math.ceil(E / 6) + 1) }, (_, i) => n(`l${i + 1}`, draw([...d, 'l', i], 30, 40), add(String(a + 2 * T + i), cell(draw([...d, 'lAt', i], 0, 255))), '1/2', draw([...d, 'lVel', i], 60, 100)));
  // Edit i targets timed group i (or the next loose note); targets get a cycle of nominal kinds.
  let nextLoose = 0;
  const edits = Array.from({ length: E }, (_, i) => {
    const kind = EDIT_KINDS[i % EDIT_KINDS.length], domain = [...d, 'edit', i];
    if (kind === 'loose-onset') return { kind, note: loose[nextLoose++].id, by: cell(draw([...domain, 'by'], 3, 60)) };
    const b = timed[i], j = draw([...domain, 'member'], 0, 3), note = b.notes[j];
    if (kind === 'anchor') return { kind, group: b.group.id, note: note.id, by: oddSixteenth([...domain, 'by']) };
    if (kind === 'onset-spread') {
      const c = b.group.spread, cellOf = id => { const [num, den] = rational(c[id]); return Number((num * 512n) / den); };
      const here = cellOf(note.id), next = j < 3 ? cellOf(b.notes[j + 1].id) : here + 9;
      return { kind, group: b.group.id, note: note.id, spread: cell(here + draw([...domain, 'cell'], 1, next - here - 1)) };
    }
    if (kind === 'velocity') { let v = draw([...domain, 'v'], 30, 120); if (v === note.velocity) v++; return { kind, note: note.id, velocity: v }; }
    if (kind === 'pitch') return { kind, note: note.id, pitch: note.pitch + [-5, -3, -2, 2, 3, 5][draw([...domain, 'p'], 0, 5)] };
    let duration = cell(draw([...domain, 'dur'], 128, 1024)); if (duration === note.duration) duration = add(duration, cell(1));
    return { kind, note: note.id, duration };
  });
  // Timing-free overlays alternate inferred and declared; each spans two edit targets and the last group.
  const overlayCount = Math.ceil(E / 2) + 1, targets = edits.map(e => e.note);
  const overlays = Array.from({ length: overlayCount }, (_, j) => {
    const kind = j % 2 ? 'declared' : 'inferred';
    const members = [...new Set([targets[(2 * j) % E], targets[(2 * j + 1) % E], timed[T - 1].notes[draw([...d, 'ov', j], 0, 3)].id])];
    return { id: `m${j + 1}`, members, label: kind === 'inferred' ? `inferred motif ${j + 1}` : `motif ${j + 1}`,
      provenance: kind === 'inferred' ? inferred() : declared(), ...(kind === 'inferred' ? { state: 'current' } : {}) };
  });
  const input = inHomeOrder({ notes: [...timed.flatMap(b => b.notes), ...loose], groups: [...timed.map(b => b.group), ...overlays],
    musical: { nominal: {}, provenance: { kind: 'inferred', source: 'pilot-grid-analysis' } } });
  // Nominal timing: velocity and pitch targets carry inferred nominal timing (which
  // must stay current); timing targets rotate inferred, declared and note-local by
  // instance; other notes draw any kind.
  const ordinal = { content: 0, timing: 0 };
  const targetKind = new Map(edits.map(e => [e.note, ['velocity', 'pitch'].includes(e.kind)
    ? ['mapped-inherited', 'local-inferred'][(ordinal.content++ + k - 1) % 2]
    : ['mapped-inherited', 'mapped-declared', 'local-inferred'][(ordinal.timing++ + k - 1) % 3]]));
  input.notes.forEach(x => {
    const kind = targetKind.get(x.id) ?? NOMINAL_KINDS[draw([...d, 'nominal', x.id], 0, 3)];
    const entry = { at: floorTo(x.at, 4n), duration: '1/4' };
    if (kind === 'mapped-inherited') input.musical.nominal[x.id] = { ...entry, state: 'current' };
    else if (kind === 'mapped-declared') input.musical.nominal[x.id] = { ...entry, provenance: declared() };
    else if (kind === 'local-inferred') x.nominal = { ...entry, provenance: inferred(), state: 'current' };
  });
  const expected = applyInterp(input, edits);
  const phrase = e => ({ 'onset-spread': `set the spread of note ${e.note} in its timing group to ${e.spread}`, velocity: `set the velocity of note ${e.note} to ${e.velocity}`,
    pitch: `set the pitch of note ${e.note} to ${e.pitch}`, duration: `set the duration of note ${e.note} to ${e.duration}`,
    anchor: `move the anchor of group ${e.group} later by ${e.by}`, 'loose-onset': `move note ${e.note} later by ${e.by}` })[e.kind];
  return { input, expected, response: 'surface', detail: { edits: E, kinds: edits.map(e => e.kind), edited: edits },
    request: `Make ${E === 1 ? 'one edit' : `${E} edits`}: ${edits.map((e, i) => `(${i + 1}) ${phrase(e)}`).join('; ')}. Then apply exactly the lifecycle updates the task contract requires for these edits: mark each affected inferred interpretation stale, and leave declared and unaffected interpretations unchanged. Keep each changed group's common delay and group equation. Preserve every other field, membership, order, label and provenance. Do not round values to a grid.` };
}
/** Apply the edits, then the contract's lifecycle rules (or a named misreading of them). */
function applyInterp(input, edits, { lifecycle = true, velocityStales = false, staleDeclared = false, pitchStalesNominal = false, overlays = true,
  anchorNominals = true, inherit = true, staleDeclaredNominal = false } = {}) {
  const f = clone(input), byId = new Map(f.notes.map(x => [x.id, x])), group = id => f.groups.find(g => g.id === id);
  const changed = new Set(), timing = new Set(), velocityOnly = new Set(), pitchOnly = new Set(), anchorMembers = new Set();
  for (const e of edits) {
    if (e.kind === 'velocity') { byId.get(e.note).velocity = e.velocity; velocityOnly.add(e.note); }
    else if (e.kind === 'pitch') { byId.get(e.note).pitch = e.pitch; changed.add(e.note); pitchOnly.add(e.note); }
    else if (e.kind === 'duration') { byId.get(e.note).duration = e.duration; changed.add(e.note); timing.add(e.note); }
    else if (e.kind === 'loose-onset') { const x = byId.get(e.note); x.at = add(x.at, e.by); changed.add(e.note); timing.add(e.note); }
    else if (e.kind === 'onset-spread') { group(e.group).spread[e.note] = e.spread; realize(f, [e.group]); changed.add(e.note); timing.add(e.note); }
    else if (e.kind === 'anchor') {
      const g = group(e.group); g.anchor = add(g.anchor, e.by); realize(f, [e.group]);
      for (const id of Object.keys(g.spread)) { changed.add(id); anchorMembers.add(id); if (anchorNominals) timing.add(id); }
    }
  }
  if (!lifecycle) return f;
  const staleSet = new Set([...changed, ...(velocityStales ? velocityOnly : [])]);
  for (const g of f.groups) {
    if (!overlays && !g.spread) continue;
    const kind = g.provenance?.kind;
    if ((kind === 'inferred' || staleDeclared && kind === 'declared') && g.members.some(id => staleSet.has(id))) g.state = 'stale';
  }
  const nominalSet = new Set([...timing, ...(velocityStales ? velocityOnly : []), ...(pitchStalesNominal ? pitchOnly : [])]);
  for (const id of nominalSet) {
    const x = byId.get(id), entry = f.musical.nominal[id];
    const stales = p => p?.kind === 'inferred' || staleDeclaredNominal && p?.kind === 'declared';
    if (x.nominal && stales(x.nominal.provenance)) x.nominal.state = 'stale';
    if (entry && stales(entry.provenance ?? (inherit ? f.musical.provenance : undefined))) entry.state = 'stale';
  }
  return f;
}

// ---------------------------------------------------------------------------
// Ladders and level-aware wrong answers.

export const FAMILY_GENERATORS = Object.freeze({ 'query-edit': queryEdit, 'overlap-edit': overlapEdit, 'large-edit': largeEdit, 'interp-maintain': interpMaintain });
const family = (short, categoryName, axis, levels) => ({ short, from: [], cohort: 'source', family: categoryName, axis, levels, diagnosticLevel: null, instances: Object.freeze([1]), repeats: 1 });
const V4_FAMILIES = Object.freeze({
  'query-edit': family('query', 'selection-edit', 'timed groups scanned, half of them near-miss groups at the range bounds', [4, 8, 16, 32]),
  'overlap-edit': family('overlap', 'membership-edit', 'memberships of each heavy note (owner plus overlay groups)', [2, 4, 6, 8]),
  'large-edit': family('large', 'edit-in-state', 'notes in the surrounding rich document', [64, 128, 256, 384]),
  'interp-maintain': family('interp', 'interpretation', 'edits under mixed provenance', [2, 4, 8, 12]),
});
// Ladder v4 (R01-D20): one calibration instance per level, the same ladder for both cohorts.
export const LADDERS_V4 = Object.freeze({ 'claude-current': V4_FAMILIES, 'codex-current-high': V4_FAMILIES });
// Ladder v5 (R01-D21): Haiku-only recalibration above v4's tops, saturated in E389.
// Large-edit stays capped by output size (R01-D20) and is not probed.
const V5_HAIKU = Object.freeze({
  'query-edit': { ...V4_FAMILIES['query-edit'], levels: [48, 64, 96] },
  'overlap-edit': { ...V4_FAMILIES['overlap-edit'], levels: [12, 16, 24] },
  'interp-maintain': { ...V4_FAMILIES['interp-maintain'], levels: [16, 24, 32] },
});
export const LADDERS_V5 = Object.freeze({ 'claude-current': V5_HAIKU });
// Ladder v6 (R01-D21): the development pass. Each family's levels are the union
// of Luna's (from E389) and Haiku's (from the v5 rule), run identically by both
// models on fresh instances 2-13 with one repeat.
export const V6_LUNA_LEVELS = Object.freeze({ 'query-edit': [8, 16], 'overlap-edit': [4, 6], 'large-edit': [128, 256], 'interp-maintain': [2, 4] });
export const V6_HAIKU_LEVELS = Object.freeze({ 'query-edit': [64, 96], 'overlap-edit': [24], 'large-edit': [], 'interp-maintain': [32] });
export const V6_INSTANCES = Object.freeze(Array.from({ length: 12 }, (_, i) => i + 2));
const V6_FAMILIES = Object.freeze(Object.fromEntries(Object.entries(V4_FAMILIES).map(([name, ladder]) => [name, { ...ladder,
  levels: [...new Set([...V6_LUNA_LEVELS[name], ...V6_HAIKU_LEVELS[name]])].sort((x, y) => x - y), instances: V6_INSTANCES }])));
export const LADDERS_V6 = Object.freeze({ 'claude-current': V6_FAMILIES, 'codex-current-high': V6_FAMILIES });

export const ROUND2_FAMILY_RULES = Object.freeze({
  schema: 'r01-round2-task-rules-v4',
  ladders: 'Ladder v4 (R01-D19, R01-D20): four format-dependent families on C3 and C4 FIELDS, one calibration instance per level and one repeat, the same ladder in both cohort packages.',
  synthetic: `Seeded SHA-256 draws from ${FAMILY_SEED} under domains [family, level, instance, ...]. Timed groups have positive delays and strictly increasing 1/512 spread cells from 0. Note-array order equals C4 block traversal (each note homed in its timing owner, else its first group, else NOTES) in every input and expected state, so no order cells are needed.`,
  queryEdit: 'G timed groups: G/2 core groups two quarters apart and G/2 near-miss groups planted at the bounds (latest member at X - d, out; at X + d, in; earliest member at Y + d, out; at Y - d, in; d = 1/512 or 0 in the first four, then seeded 0-8 cells). X is the onset of core group floor(G/8)\'s second member, Y that of core group floor(3G/8)\'s fourth. A timing-free pad (one untimed note inside, one at Y, one timed member) and loose notes before, at X, after Y and at the end. Selection uses input onsets: notes in [X, Y) rise 12 semitones; every timed group with a member in range moves its anchor later by an odd multiple of 1/16.',
  overlapEdit: 'Four five-member owner groups; L + 1 overlay groups alternating timing-free (one homed untimed note; every second one has a reversed presentationOrder) and timed (three owned notes). Each owner\'s third member (heavy) belongs to exactly L groups; owner 2 references owner 3\'s heavy note and the first timed overlay\'s second note; that overlay references owner 2\'s heavy note. Four changes: retime owner 2, double the first timed overlay\'s spreads, set heavy 1\'s spread, and remove heavy 4 from its first non-owner group.',
  largeEdit: 'N notes in seeded slots: timed groups of 3-6 (one in four inferred with state current), timing-free phrases of 2-3 untimed notes that reference the latest plain timed group\'s first note (the first and every third after it present their members reversed), and loose notes. At N/2 an edit block of three declared four-note groups is placed: its first note of the second group moves to the end of the first (spread above its last), and the third group\'s anchor moves later. Rich fields by final index: channel and expression at i mod 32 = 7, annotation at 19 mod 64, chance at 11 mod 48, mapped nominal timing at 2 mod 5 (declared at 2 mod 15, otherwise inheriting inferred musical provenance) and note-local declared nominal at 23 mod 40; edited notes carry no nominal timing.',
  interpMaintain: 'E + 1 four-member timed groups (the first inferred, the second declared, others seeded; inferred ones carry state current), three loose notes, and ceil(E/2) + 1 timing-free overlays alternating inferred (state current) and declared, each spanning two edit targets and a note of the last group. Edits cycle onset-spread, velocity, pitch, duration, anchor and loose-onset; edit i targets group i (or the next loose note). Velocity and pitch targets carry inferred nominal timing (mapped inheriting inferred musical provenance, or note-local inferred; state current), alternating in edit order from an instance offset; timing targets rotate mapped-inherited, mapped-declared and note-local inferred in edit order from an instance offset; other notes draw any kind or none. Expected: pitch, onset or duration changes stale every inferred group containing the note; onset or duration changes stale its inferred nominal; velocity changes stale nothing; declared intent stays.',
  instances: 'Calibration instance 1 per level, one repeat; the development pass uses fresh instances.',
});
export const ROUND2_FAMILY_RULES_V6 = Object.freeze({ ...ROUND2_FAMILY_RULES, schema: 'r01-round2-task-rules-v6',
  ladders: 'Ladder v6 (R01-D21): per family, the union of Luna\'s levels (E389) and Haiku\'s levels (the pre-stated v5 rule), identical for both models. Generators are v5\'s.',
  instances: 'Fresh instances 2-13 (instance 1 was used in calibration), one repeat.' });
export const ROUND2_FAMILY_RULES_V5 = Object.freeze({ ...ROUND2_FAMILY_RULES, schema: 'r01-round2-task-rules-v5',
  ladders: 'Ladder v5 (R01-D21): Haiku-only recalibration above the v4 tops (query 48-96 groups, overlap 12-24 memberships, interp 16-32 edits); large-edit is not probed. Generators are v4\'s; interp-maintain uses max(3, ceil(E/6) + 1) loose notes, which leaves every v4 level unchanged.',
  instances: 'Calibration instance 1 per level, one repeat.' });

const surface = (name, fixture) => ({ name, kind: 'surface', fixture });
const mapNotes = (fixture, fn) => ({ ...clone(fixture), notes: fixture.notes.map(x => fn(clone(x))) });

const VARIANTS = Object.freeze({
  'query-edit'(task) {
    const { from: X, to: Y, shift: D } = task.ladder, input = task.input, right = querySelection(input, X, Y);
    const timedOwner = id => input.groups.find(g => own(g.spread, id));
    const noDelay = x => { const g = timedOwner(x.id); return g ? add(g.anchor, g.spread[x.id]) : x.at; };
    const selectedMembers = new Set(input.groups.filter(g => right.groups.includes(g.id)).flatMap(g => Object.keys(g.spread)));
    return [
      surface('untouched', clone(input)),
      surface('transpose-only', applyQuery(input, right, D, { move: false })),
      surface('anchors-only', applyQuery(input, right, D, { transpose: false })),
      surface('upper-bound-inclusive', applyQuery(input, querySelection(input, X, Y, { upperInclusive: true }), D)),
      surface('lower-bound-exclusive', applyQuery(input, querySelection(input, X, Y, { lowerInclusive: false }), D)),
      surface('onsets-omit-delay', applyQuery(input, querySelection(input, X, Y, { onset: noDelay }), D)),
      surface('whole-selected-groups-transposed', applyQuery(input, { notes: [...new Set([...right.notes, ...selectedMembers])], groups: right.groups }, D)),
      surface('delay-moved-instead-of-anchor', applyQuery(input, right, D, { field: 'delay' })),
      surface('selected-after-moving', (() => { const moved = applyQuery(input, right, D, { transpose: false });
        const late = querySelection(moved, X, Y); return mapNotes(moved, x => late.notes.includes(x.id) ? { ...x, pitch: x.pitch + 12 } : x); })()),
    ];
  },
  'overlap-edit'(task) {
    const { ops } = task.ladder, input = task.input;
    const others = input.groups.filter(g => g.members.includes(ops.remove.note) && !own(g.spread, ops.remove.note) && g.id !== ops.remove.group);
    return [
      surface('untouched', clone(input)),
      surface('last-change-missing', applyOverlap(input, ops, { skip: ['remove'] })),
      surface('retime-missing', applyOverlap(input, ops, { skip: ['retime'] })),
      surface('retime-moves-referenced-members', applyOverlap(input, ops, { moveReferenced: true })),
      surface('scale-moves-referenced-members', applyOverlap(input, ops, { doubleReferenced: true })),
      surface('spread-added-instead-of-set', applyOverlap(input, ops, { addSpread: true })),
      surface('removed-from-every-other-group', applyOverlap(input, ops, { removeEverywhere: true })),
      ...others.length ? [surface('removed-from-wrong-group', applyOverlap(input, ops, { removeFrom: others[0].id }))] : [],
      surface('removed-note-deleted', (() => { const f = applyOverlap(input, ops, { skip: ['remove'] }), id = ops.remove.note;
        const owner = f.groups.find(g => own(g.spread, id));
        f.notes = f.notes.filter(x => x.id !== id);
        for (const g of f.groups) for (const key of ['members', 'performanceOrder', 'presentationOrder']) if (g[key]) g[key] = g[key].filter(x => x !== id);
        delete owner.spread[id]; return f; })()),
    ];
  },
  'large-edit'(task) {
    const { ops } = task.ladder, input = task.input, expected = task.expected;
    const index = input.groups.findIndex(g => g.id === ops.retime.group), next = input.groups.slice(index + 1).find(g => g.spread);
    const pick = test => expected.notes.findIndex(test);
    const annotated = pick(x => x.annotation), chance = pick(x => x.chance), nominalId = Object.keys(input.musical.nominal)[0];
    const without = (i, key) => { const f = clone(expected); delete f.notes[i][key]; return f; };
    const inferredGroup = expected.groups.find(g => g.state === 'current');
    const freeOrdered = expected.groups.find(g => g.presentationOrder);
    const looseLast = expected.notes.at(-1);
    return [
      surface('untouched', clone(input)),
      surface('move-missing', applyLarge(input, ops, { skip: ['move'] })),
      surface('retime-missing', applyLarge(input, ops, { skip: ['retime'] })),
      surface('moved-note-keeps-onset', applyLarge(input, ops, { keepOnset: true })),
      surface('delay-moved-instead-of-anchor', applyLarge(input, ops, { field: 'delay' })),
      ...next ? [surface('next-group-retimed', applyLarge(input, ops, { retimeGroup: next.id }))] : [],
      surface('annotation-dropped', without(annotated, 'annotation')),
      surface('chance-dropped', without(chance, 'chance')),
      surface('pan-zeroed', mapNotes(expected, x => x.expression ? { ...x, expression: { ...x.expression, pan: 0 } } : x)),
      surface('nominal-entry-dropped', (() => { const f = clone(expected); delete f.musical.nominal[nominalId]; return f; })()),
      ...inferredGroup ? [surface('inferred-state-dropped', (() => { const f = clone(expected); delete f.groups.find(g => g.id === inferredGroup.id).state; return f; })())] : [],
      ...freeOrdered ? [surface('presentation-order-dropped', (() => { const f = clone(expected); delete f.groups.find(g => g.id === freeOrdered.id).presentationOrder; return f; })())] : [],
      surface('last-loose-note-dropped', (() => { const f = clone(expected); f.notes = f.notes.filter(x => x.id !== looseLast.id); delete f.musical.nominal[looseLast.id]; return f; })()),
    ];
  },
  'interp-maintain'(task) {
    const edits = task.ladder.edited, input = task.input;
    return [
      surface('untouched', clone(input)),
      surface('no-lifecycle-updates', applyInterp(input, edits, { lifecycle: false })),
      surface('last-edit-missing', applyInterp(input, edits.slice(0, -1))),
      surface('velocity-edit-stales', applyInterp(input, edits, { velocityStales: true })),
      surface('declared-groups-staled', applyInterp(input, edits, { staleDeclared: true })),
      surface('pitch-stales-nominal', applyInterp(input, edits, { pitchStalesNominal: true })),
      surface('overlay-groups-not-staled', applyInterp(input, edits, { overlays: false })),
      surface('anchor-member-nominals-kept', applyInterp(input, edits, { anchorNominals: false })),
      surface('mapped-inheritance-ignored', applyInterp(input, edits, { inherit: false })),
      surface('declared-nominal-staled', applyInterp(input, edits, { staleDeclaredNominal: true })),
    ];
  },
});

/**
 * Level-aware wrong answers. A misreading that cannot occur at a level (for
 * example, an anchor rule when no anchor edit is requested) equals the oracle
 * there and is omitted, so every listed variant distinguishes.
 */
export const FAMILY_WRONG = Object.freeze(Object.fromEntries(Object.entries(VARIANTS).map(([name, make]) => [name,
  task => make(task).filter(v => canonical(v.fixture) !== canonical(task.expected))])));
