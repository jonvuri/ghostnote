// R01 research only: independent exact oracle and a pure guarded document backend.
import assert from 'node:assert/strict';
import * as gn from '../../src/document/index.ts';

const gcd = (a, b) => { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a; };
export function rational(text) {
  assert.equal(typeof text, 'string', 'timing must be exact rational text');
  assert.match(text, /^-?\d+(\/\d+)?$/);
  const [n, d = 1n] = text.split('/').map(BigInt);
  assert(d > 0n, 'positive denominator required');
  const g = gcd(n, d); return [n / g, d / g];
}
export function spell(n, d = 1n) {
  assert(d > 0n); const g = gcd(n, d); n /= g; d /= g;
  return d === 1n ? String(n) : `${n}/${d}`;
}
export function add(a, b) { const [n, d] = rational(a), [m, e] = rational(b); return spell(n * e + m * d, d * e); }
export function mul(a, b) { const [n, d] = rational(a), [m, e] = rational(b); return spell(n * m, d * e); }
export function cmp(a, b) { const [n, d] = rational(a), [m, e] = rational(b); return n * e < m * d ? -1 : n * e > m * d ? 1 : 0; }
export const numeric = a => { const [n, d] = rational(a); return Number(n) / Number(d); };
const floor = (n, d) => n / d - (n < 0n && n % d ? 1n : 0n);

// Independent of the product normalizer. Negative time is comparable here but
// remains a separate admission refusal in the current document backend.
export function normalize(note) {
  const [n, d] = rational(note.at), [m, e] = rational(note.duration);
  assert(m > 0n, 'duration must be positive');
  let duration = (m * 1024n + e) / (2n * e);
  if (duration < 1n) duration = 1n;
  return { ...structuredClone(note), at: spell(floor(n * 512n, d), 512n), duration: spell(duration, 512n) };
}
export const canonical = value => JSON.stringify(sortKeys(value));
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, sortKeys(value[k])]));
  if (typeof value === 'number') assert(Number.isFinite(value), 'nonfinite value');
  return value;
}
export function noteKey(note) {
  const { id, clip, ...fields } = normalize(note);
  // Explicit common-contract defaults; absence never erases a nondefault value.
  return canonical({ channel: 1, mute: false, releaseVelocity: 100 / 127, articulation: 'normal',
    expression: { velocitySpread: 0, gain: 1, pan: 0, pressure: 0, timbre: 0.5, transpose: 0 },
    chance: { enabled: false, value: 1 }, occurrence: { enabled: false, condition: 'always' },
    recurrence: { enabled: false, length: 1, mask: 1 },
    repeat: { enabled: false, count: 1, curve: 0, velocityCurve: 0, velocityEnd: 1 }, ...fields });
}
export function equivalence(before, after) {
  const counts = notes => {
    const result = new Map();
    for (const n of notes) { const key = noteKey(n); result.set(key, (result.get(key) ?? 0) + 1); }
    return result;
  };
  const a = counts(before), b = counts(after), missing = [], extra = [];
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const delta = (a.get(key) ?? 0) - (b.get(key) ?? 0);
    if (delta > 0) missing.push({ note: JSON.parse(key), count: delta });
    if (delta < 0) extra.push({ note: JSON.parse(key), count: -delta });
  }
  return { equal: !missing.length && !extra.length, missing, extra };
}
// IDs are authoritative only when the caller establishes their common domain.
// Without that domain, exact unique matches are observations, never move recovery.
export function correspondence(before, after, sharedIdentity = false) {
  const uniqueIds = notes => { assert.equal(new Set(notes.map(n => n.id)).size, notes.length, 'duplicate id'); };
  uniqueIds(before); uniqueIds(after);
  const matches = [], ambiguous = [], unmatchedBefore = [], used = new Set();
  for (const note of before) {
    const candidates = after.filter(n => sharedIdentity ? n.id === note.id : noteKey(n) === noteKey(note));
    const sourceCount = sharedIdentity ? 1 : before.filter(n => noteKey(n) === noteKey(note)).length;
    if (candidates.length === 1 && sourceCount === 1) {
      matches.push({ before: note.id, after: candidates[0].id, changed: noteKey(note) !== noteKey(candidates[0]) });
      used.add(candidates[0].id);
    } else if (candidates.length) ambiguous.push({ before: note.id, candidates: candidates.map(n => n.id) });
    else unmatchedBefore.push(note.id);
  }
  return { matches, ambiguous, unmatchedBefore, unmatchedAfter: after.filter(n => !used.has(n.id)).map(n => n.id) };
}
export function document(fixture, overlays = []) {
  const events = fixture.notes.map(n => ({ ...normalize(n), clip: 'clip' }));
  const end = events.reduce((a, n) => cmp(add(n.at, n.duration), a) > 0 ? add(n.at, n.duration) : a, '1');
  const [n, d] = rational(end), length = String((n + d - 1n) / d);
  return gn.validate({ format: 'ghostnote-document', version: '1.0', kind: 'desired',
    clips: [{ id: 'clip', length, ...(fixture.clip ?? {}) }], events, overlays,
    coverage: [{ clip: 'clip', from: '0', to: length, channels: Array.from({ length: 16 }, (_, i) => i + 1), fields: 'all', status: 'complete' }] });
}
export const documentNotes = doc => doc.events.map(({ clip, ...note }) => note);
export function select(doc, selection) {
  assert(selection && Object.keys(selection).length, 'explicit selector required');
  assert(Object.keys(selection).every(k => ['ids', 'pitch', 'from', 'to'].includes(k)), 'unknown selector');
  if (selection.ids) {
    assert(Array.isArray(selection.ids) && selection.ids.length && new Set(selection.ids).size === selection.ids.length, 'unique nonempty ids');
    assert(selection.ids.every(id => doc.events.some(n => n.id === id)), 'unknown target');
  }
  if (selection.from !== undefined || selection.to !== undefined) assert(cmp(selection.from, selection.to) < 0, 'half-open range required');
  const selected = doc.events.filter(n => (!selection.ids || selection.ids.includes(n.id))
    && (selection.pitch === undefined || n.pitch === selection.pitch)
    && (selection.from === undefined || cmp(n.at, selection.from) >= 0 && cmp(n.at, selection.to) < 0));
  assert(selected.length, 'empty target'); return selected;
}
export function view(doc, selection, fields) {
  const allowed = ['pitch', 'at', 'duration', 'velocity', 'channel', 'mute', 'releaseVelocity', 'expression', 'chance', 'articulation', 'occurrence', 'recurrence', 'repeat'];
  assert(Array.isArray(fields) && new Set(fields).size === fields.length && fields.every(f => allowed.includes(f)), 'unknown view field');
  return { base: gn.contentHash(doc), fields, omittedFields: allowed.filter(f => !fields.includes(f)),
    notes: select(doc, selection).map(n => Object.fromEntries(['id', ...fields].filter(f => Object.hasOwn(n, f)).map(f => [f, n[f]]))) };
}
export function retrieve(doc, base, ids, fields) {
  assert.equal(gn.contentHash(doc), base, 'stale view'); return view(doc, { ids }, fields);
}
export function patchBetween(before, after, base = gn.contentHash(before)) {
  assert.equal(base, gn.contentHash(before), 'stale base');
  const surrounding = ({ events, overlays, ...rest }) => rest;
  assert.equal(canonical(surrounding(after)), canonical(surrounding(before)), 'event patch cannot change clip or envelope state');
  const old = new Map(before.events.map(n => [n.id, n])), next = new Map(after.events.map(n => [n.id, n]));
  assert.equal(next.size, after.events.length, 'duplicate id');
  const update = [];
  for (const [id, n] of next) if (old.has(id)) {
    assert.equal(n.clip, old.get(id).clip, 'moving clips is outside this prototype');
    const set = {};
    for (const key of new Set([...Object.keys(n), ...Object.keys(old.get(id))])) {
      if (['id', 'clip'].includes(key)) continue;
      if (canonical(n[key]) !== canonical(old.get(id)[key])) set[key] = n[key] ?? null;
    }
    if (Object.keys(set).length) update.push({ id, set });
  }
  return { format: 'ghostnote-document', version: '1.0', kind: 'patch', base: { sha256: base },
    add: after.events.filter(n => !old.has(n.id)), remove: before.events.filter(n => !next.has(n.id)).map(n => n.id),
    update, clipUpdate: [], overlayPut: [], overlayRemove: [] };
}
export function command(doc, request) {
  assert.equal(request.base, gn.contentHash(doc), 'stale base');
  const { op } = request, allowed = {
    shift: ['base', 'op', 'select', 'by'], transpose: ['base', 'op', 'select', 'semitones'],
    velocity: ['base', 'op', 'select', 'value'], remove: ['base', 'op', 'select'], add: ['base', 'op', 'notes'],
  }[op];
  assert(allowed && Object.keys(request).every(k => allowed.includes(k)), 'unknown operation or argument');
  const next = structuredClone(doc);
  if (op === 'add') {
    assert(Array.isArray(request.notes) && request.notes.length, 'nonempty notes required');
    next.events.push(...request.notes.map(n => ({ ...normalize(n), clip: 'clip' })));
  } else {
    const targets = new Set(select(doc, request.select).map(n => n.id));
    if (op === 'remove') next.events = next.events.filter(n => !targets.has(n.id));
    else for (const n of next.events) if (targets.has(n.id)) {
      if (op === 'shift') n.at = normalize({ ...n, at: add(n.at, request.by) }).at;
      if (op === 'transpose') { assert(Number.isInteger(request.semitones)); n.pitch += request.semitones; }
      if (op === 'velocity') n.velocity = request.value;
    }
  }
  // Existing validator supplies field bounds, collision and full-state rules.
  // Old claim bases describe the old notes. Validate proposed event state here;
  // applyPatch carries/stales the existing claims and validates the full result.
  const desired = gn.validate({ ...next, overlays: [] }), patch = patchBetween(doc, desired, request.base);
  return { patch, ...gn.applyPatch(doc, patch) };
}
