/** Research-only C3/C4 surfaces. No host access, normalization, or product codec dependency. */
const own = (object, key) => Object.hasOwn(object, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = message => { throw new Error(`R01 structured: ${message}`); };
function clone(value) {
  if (value === undefined) fail('undefined is not JSON');
  const visit = v => {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
    if (typeof v === 'number' && Number.isFinite(v)) return;
    if (Array.isArray(v)) { for (const x of v) visit(x); return; }
    if (record(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)) {
      for (const x of Object.values(v)) visit(x);
      return;
    }
    fail('expected finite JSON data');
  };
  visit(value);
  return JSON.parse(JSON.stringify(value));
}
function rational(value) {
  if (typeof value !== 'string' || value.length > 200 || !/^-?(0|[1-9]\d*)(\/[1-9]\d*)?$/.test(value)) fail(`invalid rational ${String(value)}`);
  const [n, d = '1'] = value.split('/');
  return [BigInt(n), BigInt(d)];
}
function text([n, d]) {
  let a = n < 0n ? -n : n, b = d;
  while (b) [a, b] = [b, a % b];
  n /= a; d /= a;
  return d === 1n ? String(n) : `${n}/${d}`;
}
const add = (a, b) => { const [n, d] = rational(a), [m, e] = rational(b); return text([n * e + m * d, d * e]); };
const subtract = (a, b) => { const [n, d] = rational(b); return add(a, text([-n, d])); };
const multiply = (a, b) => { const [n, d] = rational(a), [m, e] = rational(b); return text([n * m, d * e]); };
const equalRational = (a, b) => { const [n, d] = rational(a), [m, e] = rational(b); return n * e === m * d; };
const finite = (value, name) => { if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${name} must be finite`); };
const id = (value, name) => { if (typeof value !== 'string' || !value.length) fail(`${name} must be a nonempty string`); };
function uniqueIds(values, name) {
  if (!Array.isArray(values)) fail(`${name} must be an array`);
  const seen = new Set();
  for (const v of values) { id(v, name); if (seen.has(v)) fail(`duplicate ${name}: ${v}`); seen.add(v); }
  return seen;
}
function order(value, members, name) {
  const set = uniqueIds(value, name);
  if (set.size !== members.size || [...set].some(v => !members.has(v))) fail(`${name} must be a permutation of members`);
}
function nominal(value) {
  if (!record(value)) fail('nominal must be an object');
  rational(value.at);
  for (const key of ['duration', 'division']) if (own(value, key) && rational(value[key])[0] <= 0n) fail(`nominal ${key} must be positive`);
  if (own(value, 'state') && !['current', 'stale'].includes(value.state)) fail('nominal state must be current or stale');
}
/** Validate and clone a fixture. Extra JSON fields are carried without assigning semantics. */
export function validateStructuredFixture(input) {
  const fixture = clone(input);
  if (!record(fixture) || !Array.isArray(fixture.notes)) fail('fixture requires notes');
  const notes = new Map();
  for (const note of fixture.notes) {
    if (!record(note)) fail('note must be an object');
    id(note.id, 'note id');
    if (notes.has(note.id)) fail(`duplicate note definition: ${note.id}`);
    notes.set(note.id, note);
    finite(note.pitch, 'pitch'); finite(note.velocity, 'velocity');
    if (!Number.isInteger(note.pitch) || note.pitch < 0 || note.pitch > 127) fail('pitch outside MIDI range');
    rational(note.at);
    if (rational(note.duration)[0] <= 0n) fail('duration must be positive');
    if (own(note, 'channel') && (!Number.isInteger(note.channel) || note.channel < 1 || note.channel > 16)) fail('channel must be 1..16');
    if (own(note, 'nominal')) nominal(note.nominal);
  }
  if (record(fixture.musical) && own(fixture.musical, 'nominal')) {
    if (!record(fixture.musical.nominal)) fail('musical.nominal must be an ID map');
    for (const [noteId, entry] of Object.entries(fixture.musical.nominal)) {
      if (!notes.has(noteId)) fail(`unknown nominal note: ${noteId}`);
      if (own(notes.get(noteId), 'nominal')) fail(`duplicate nominal definition: ${noteId}`);
      nominal(entry);
    }
  }
  const groups = new Set(), timingOwners = new Map();
  if (fixture.groups !== undefined && !Array.isArray(fixture.groups)) fail('groups must be an array');
  for (const group of fixture.groups ?? []) {
    if (!record(group)) fail('group must be an object');
    id(group.id, 'group id');
    if (groups.has(group.id)) fail(`duplicate group: ${group.id}`);
    groups.add(group.id);
    const members = uniqueIds(group.members, 'group member');
    for (const member of members) if (!notes.has(member)) fail(`unknown group member: ${member}`);
    for (const name of ['presentationOrder', 'performanceOrder']) if (own(group, name)) order(group[name], members, name);
    for (const name of ['label', 'prose']) if (own(group, name) && typeof group[name] !== 'string') fail(`${name} must be text`);
    if (own(group, 'state') && !['current', 'stale'].includes(group.state)) fail('group state must be current or stale');
    if (own(group, 'anchor')) rational(group.anchor);
    if (own(group, 'delay')) { rational(group.delay); if (!own(group, 'anchor')) fail('delay requires anchor'); }
    if (own(group, 'spread')) {
      if (!record(group.spread) || !own(group, 'anchor')) fail('spread requires anchor and an object');
      for (const [member, spread] of Object.entries(group.spread)) {
        rational(spread);
        if (!members.has(member)) fail(`spread references nonmember: ${member}`);
        if (timingOwners.has(member)) fail(`ambiguous timing owner: ${member}`);
        timingOwners.set(member, group.id);
        if (!equalRational(notes.get(member).at, add(add(group.anchor, group.delay ?? '0'), spread))) fail(`timing equation mismatch: ${member}`);
      }
    }
  }
  return fixture;
}
function parseSurface(surface, kind) {
  const value = typeof surface === 'string' ? JSON.parse(surface) : clone(surface);
  if (!record(value) || value.format !== kind || value.version !== 1 || !record(value.context) || !Array.isArray(value.rows)) fail(`expected ${kind} version 1`);
  if (own(value.context, 'notes')) fail('context cannot redefine notes');
  if (Object.keys(value).some(k => !['format', 'version', 'context', 'rows'].includes(k))) fail('unknown surface key');
  return value;
}
const CORE = ['id', 'pitch', 'at', 'duration', 'velocity'];
const remaining = (object, keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));
function memberships(fixture, noteId) { return (fixture.groups ?? []).filter(g => g.members.includes(noteId)).map(g => g.id); }

/** C3: realized note tuples, untouched optional fields, and explicit adjacent group references. */
export function encodeCompact(input) {
  const fixture = validateStructuredFixture(input);
  const context = remaining(fixture, ['notes']);
  const nominalMap = record(context.musical) && own(context.musical, 'nominal') ? context.musical.nominal : null;
  if (nominalMap) context.musical = { ...context.musical, nominal: {} };
  return {
    format: 'r01-compact', version: 1, context,
    rows: fixture.notes.map(note => [...CORE.map(k => note[k]), remaining(note, CORE), memberships(fixture, note.id), nominalMap && own(nominalMap, note.id) ? nominalMap[note.id] : null]),
  };
}
export function decodeCompact(input) {
  const surface = parseSurface(input, 'r01-compact');
  const fixture = { ...surface.context, notes: surface.rows.map(row => {
    if (!Array.isArray(row) || row.length !== 8 || !record(row[5]) || !Array.isArray(row[6]) || (row[7] !== null && !record(row[7]))) fail('invalid compact row');
    if (CORE.some(k => own(row[5], k))) fail('optional fields cannot redefine core fields');
    return { ...Object.fromEntries(CORE.map((k, i) => [k, row[i]])), ...row[5] };
  }) };
  const hasNominal = record(fixture.musical) && own(fixture.musical, 'nominal');
  if (hasNominal && (!record(fixture.musical.nominal) || Object.keys(fixture.musical.nominal).length)) fail('compact nominal marker must be an empty map');
  for (const row of surface.rows) if (row[7] !== null) {
    if (!hasNominal) fail('nominal row requires shared nominal marker');
    Object.defineProperty(fixture.musical.nominal, row[0], { value: row[7], writable: true, enumerable: true, configurable: true });
  }
  const checked = validateStructuredFixture(fixture);
  surface.rows.forEach((row, i) => {
    uniqueIds(row[6], 'compact group reference');
    const actual = memberships(checked, checked.notes[i].id);
    if (actual.length !== row[6].length || actual.some(v => !row[6].includes(v))) fail('compact group references disagree with membership');
  });
  return checked;
}

/** C4: a note has one definition; explicit timing ownership replaces only its onset. */
export function encodeGrouped(input) {
  const fixture = validateStructuredFixture(input);
  return {
    format: 'r01-grouped', version: 1, context: remaining(fixture, ['notes']),
    rows: fixture.notes.map(note => {
      const owner = (fixture.groups ?? []).find(g => own(g.spread ?? {}, note.id));
      const realized = owner && add(add(owner.anchor, owner.delay ?? '0'), owner.spread[note.id]);
      return owner
        ? { note: remaining(note, ['at']), time: { group: owner.id, ...(realized === note.at ? {} : { spelling: note.at }) } }
        : { note, time: null };
    }),
  };
}
export function decodeGrouped(input) {
  const surface = parseSurface(input, 'r01-grouped');
  if (surface.context.groups !== undefined && !Array.isArray(surface.context.groups)) fail('groups must be an array');
  const fixture = { ...surface.context, notes: surface.rows.map(row => {
    if (!record(row) || !record(row.note) || !own(row, 'time') || Object.keys(row).some(k => !['note', 'time'].includes(k))) fail('invalid grouped row');
    if (row.time === null) return row.note;
    if (!record(row.time) || Object.keys(row.time).some(k => !['group', 'spelling'].includes(k)) || own(row.note, 'at')) fail('conflicting or invalid timing definition');
    const owners = (surface.context.groups ?? []).filter(g => g.id === row.time.group);
    if (owners.length !== 1 || !record(owners[0].spread) || !own(owners[0].spread, row.note.id)) fail('unknown timing owner');
    const group = owners[0], at = add(add(group.anchor, group.delay ?? '0'), group.spread[row.note.id]);
    // Spelling records lexical preservation only; its numeric value cannot override the equation.
    if (own(row.time, 'spelling') && !equalRational(at, row.time.spelling)) fail('onset spelling disagrees with timing equation');
    return { ...row.note, at: row.time.spelling ?? at };
  }) };
  return validateStructuredFixture(fixture);
}

function changeReport(before, after) {
  const changed = (old, next) => Object.keys({ ...old, ...next }).filter(k => JSON.stringify(old[k]) !== JSON.stringify(next[k]));
  return {
    notes: after.notes.map(note => ({ id: note.id, fields: changed(before.notes.find(n => n.id === note.id), note) })).filter(v => v.fields.length),
    groups: (after.groups ?? []).map(group => ({ id: group.id, fields: changed((before.groups ?? []).find(g => g.id === group.id), group) })).filter(v => v.fields.length),
    nominal: Object.entries(after.musical?.nominal ?? {}).map(([id, entry]) => ({ id, fields: changed(before.musical.nominal[id], entry) })).filter(v => v.fields.length),
  };
}
function staleNominal(fixture, noteId) {
  const note = fixture.notes.find(n => n.id === noteId);
  if (note.nominal?.provenance?.kind === 'inferred') note.nominal.state = 'stale';
  const map = fixture.musical?.nominal;
  const entry = record(map) && own(map, noteId) ? map[noteId] : undefined;
  if (entry && (entry.provenance ?? fixture.musical.provenance)?.kind === 'inferred') entry.state = 'stale';
}
function staleInterpretations(fixture, changedIds) {
  for (const group of fixture.groups ?? []) {
    if (group.provenance?.kind === 'inferred' && group.members.some(id => changedIds.has(id))) group.state = 'stale';
  }
}
/** Sparse local edit. Missing fields are preserved; null is ordinary JSON, not clearing syntax. */
export function editNote(input, noteId, set) {
  const before = validateStructuredFixture(input), fixture = clone(before);
  if (!record(set) || own(set, 'id')) fail('edit requires field object without id');
  const note = fixture.notes.find(n => n.id === noteId);
  if (!note) fail(`unknown note: ${noteId}`);
  for (const [key, value] of Object.entries(clone(set))) Object.defineProperty(note, key, { value, writable: true, enumerable: true, configurable: true });
  if (own(set, 'at')) {
    for (const group of fixture.groups ?? []) if (own(group.spread ?? {}, noteId)) {
      group.spread[noteId] = subtract(subtract(note.at, group.anchor), group.delay ?? '0');
    }
  }
  const original = before.notes.find(n => n.id === noteId);
  if (['at', 'duration'].some(k => JSON.stringify(note[k]) !== JSON.stringify(original[k]))) staleNominal(fixture, noteId);
  if (['pitch', 'at', 'duration'].some(k => JSON.stringify(note[k]) !== JSON.stringify(original[k]))) staleInterpretations(fixture, new Set([noteId]));
  validateStructuredFixture(fixture);
  return { fixture, changes: changeReport(before, fixture) };
}
/** Scale explicit member spread around anchor + common delay. Never infer spread from prose. */
export function scaleGroupSpread(input, groupId, factor) {
  const before = validateStructuredFixture(input), fixture = clone(before);
  if (rational(factor)[0] < 0n) fail('spread factor must be nonnegative');
  const group = (fixture.groups ?? []).find(g => g.id === groupId);
  if (!group || !record(group.spread) || !own(group, 'anchor')) fail('group needs explicit anchor and spread');
  if (group.state === 'stale') fail('cannot execute stale group interpretation');
  const changedIds = new Set();
  for (const [noteId, spread] of Object.entries(group.spread)) {
    const next = multiply(spread, factor), note = fixture.notes.find(n => n.id === noteId);
    const at = add(add(group.anchor, group.delay ?? '0'), next);
    if (!equalRational(note.at, at)) changedIds.add(noteId);
    group.spread[noteId] = next;
    note.at = at;
    if (changedIds.has(noteId)) staleNominal(fixture, noteId);
  }
  staleInterpretations(fixture, changedIds);
  validateStructuredFixture(fixture);
  return { fixture, changes: changeReport(before, fixture) };
}
