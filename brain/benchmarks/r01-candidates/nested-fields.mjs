/** Research C4 text surface. Group-local rows; exact semantics reuse the JSON oracle. */
import { encodeGrouped, decodeGrouped } from './structured.mjs';

const own = (o, k) => Object.hasOwn(o, k);
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const fail = message => { throw new Error(`R01 nested FIELDS: ${message}`); };
const put = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: true, configurable: true, writable: true });
const CORE = ['id', 'pitch', 'at', 'duration', 'velocity'];
const COLUMNS = ['id', 'pitch', 'at', 'duration', 'velocity', 'spread', 'order', 'spelling', 'nominal', 'extra'];
const ATTRS = ['anchor', 'delay', 'label', 'prose'];
const omit = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
const stringToken = s => /^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(s) ? s : JSON.stringify(s);
const readString = s => {
  if (s === undefined || s === '-') fail('missing string');
  if (!s.startsWith('"')) return s;
  const value = JSON.parse(s);
  if (typeof value !== 'string') fail('expected string');
  return value;
};

// Split only at whitespace outside quoted strings and balanced JSON containers.
function tokens(line) {
  const out = []; let start = -1, quoted = false, escaped = false;
  const stack = [];
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (start < 0) { if (/\s/.test(c)) continue; start = i; }
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '[' || c === '{') stack.push(c);
    else if (c === ']' || c === '}') {
      if (stack.pop() !== (c === ']' ? '[' : '{')) fail('unbalanced JSON container');
    } else if (/\s/.test(c) && !stack.length) {
      out.push(line.slice(start, i)); start = -1;
    }
  }
  if (quoted || stack.length) fail('unterminated string/container');
  if (start >= 0) out.push(line.slice(start));
  return out;
}

/** The authoritative note definition lives in its timing owner, else first member group. */
export function encodeNestedFields(input) {
  const surface = encodeGrouped(input), context = structuredClone(surface.context);
  const groups = context.groups ?? [];
  const hadGroups = own(context, 'groups'); delete context.groups;
  const nominalMap = record(context.musical) && own(context.musical, 'nominal')
    ? context.musical.nominal : null;
  if (nominalMap) context.musical.nominal = {};
  const rows = new Map(surface.rows.map((row, index) => [row.note.id, { ...row, index }]));
  const homes = new Map(surface.rows.map(row => [row.note.id,
    row.time?.group ?? groups.find(g => g.members.includes(row.note.id))?.id ?? null]));
  const traversal = groups.flatMap(g => g.members.filter(id => homes.get(id) === g.id))
    .concat(surface.rows.filter(r => homes.get(r.note.id) === null).map(r => r.note.id));
  const needOrder = traversal.some((id, index) => rows.get(id).index !== index);
  const lines = ['R01-GROUPED-FIELDS 1'];
  if (Object.keys(context).length) lines.push(`CONTEXT ${JSON.stringify(context)}`);
  if (hadGroups && !groups.length) lines.push('EMPTY_GROUPS');

  function emitRows(ids, groupId) {
    const definitions = ids.filter(id => homes.get(id) === groupId);
    const data = new Map(definitions.map(id => {
      const row = rows.get(id), note = row.note;
      const data = { ...Object.fromEntries(CORE.filter(k => own(note, k)).map(k => [k, note[k]])) };
      if (row.time) data.spread = groups.find(g => g.id === row.time.group).spread[id];
      if (needOrder) data.order = row.index;
      if (row.time && own(row.time, 'spelling')) data.spelling = row.time.spelling;
      if (nominalMap && own(nominalMap, id)) data.nominal = nominalMap[id];
      const extra = omit(note, CORE);
      if (Object.keys(extra).length) data.extra = extra;
      return [id, data];
    }));
    const fields = COLUMNS.filter(k => definitions.some(id => own(data.get(id), k)));
    if (definitions.length) lines.push(`  FIELDS ${fields.join(' ')}`);
    for (const id of ids) {
      if (!data.has(id)) { lines.push(`  REF ${stringToken(id)}`); continue; }
      lines.push('  NOTE ' + fields.map(k => {
        const row = data.get(id);
        if (!own(row, k)) return '-';
        if (k === 'id') return stringToken(row[k]);
        if (['nominal', 'extra'].includes(k)) return JSON.stringify(row[k]);
        return String(row[k]);
      }).join(' '));
    }
  }
  for (const group of groups) {
    const attrs = ATTRS.filter(k => own(group, k)).map(k => `${k}=${
      ['anchor', 'delay'].includes(k) ? group[k] : stringToken(group[k])}`);
    const extra = omit(group, ['id', 'members', 'spread', ...ATTRS]);
    if (own(group, 'spread') && !Object.keys(group.spread).length) extra.spread = {};
    const withExtra = Object.keys(extra).length ? ` WITH ${JSON.stringify(extra)}` : '';
    lines.push(`GROUP ${stringToken(group.id)}${attrs.length ? ' ' + attrs.join(' ') : ''}${withExtra} {`);
    emitRows(group.members, group.id);
    lines.push('}');
  }
  const ungrouped = surface.rows.filter(r => homes.get(r.note.id) === null).map(r => r.note.id);
  if (ungrouped.length || !surface.rows.length) {
    lines.push('NOTES {'); emitRows(ungrouped, null); lines.push('}');
  }
  return lines.join('\n') + '\n';
}

export function decodeNestedFields(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 8 * 1024 * 1024) fail('expected text up to 8 MiB');
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (lines.shift() !== 'R01-GROUPED-FIELDS 1') fail('expected version header');
  let context = {}, contextSeen = false, emptyGroups = false, body = false;
  let block = null, fields = null;
  const groups = [], rows = [], definitions = new Set(), orders = [], nominal = [];
  for (const line of lines) {
    if (!block) {
      if (line.startsWith('CONTEXT ')) {
        if (contextSeen || body) fail('CONTEXT must occur once before blocks');
        context = JSON.parse(line.slice(8)); contextSeen = true;
        if (!record(context) || own(context, 'notes') || own(context, 'groups')) fail('invalid CONTEXT');
        if (record(context.musical) && own(context.musical, 'nominal')
            && (!record(context.musical.nominal) || Object.keys(context.musical.nominal).length)) {
          fail('CONTEXT nominal must be an empty marker; entries belong to note rows');
        }
        continue;
      }
      if (line === 'EMPTY_GROUPS') {
        if (emptyGroups || body) fail('EMPTY_GROUPS must occur once before blocks');
        emptyGroups = true; continue;
      }
      if (!line.endsWith(' {')) fail('expected GROUP or NOTES block');
      body = true; fields = null;
      const parts = tokens(line.slice(0, -2));
      if (parts[0] === 'NOTES' && parts.length === 1) { block = { kind: 'notes' }; continue; }
      if (parts.shift() !== 'GROUP' || emptyGroups) fail('invalid GROUP header');
      const id = readString(parts.shift()), group = { id, members: [] };
      if (groups.some(g => g.id === id)) fail(`duplicate group ${id}`);
      while (parts.length) {
        const attr = parts.shift();
        if (attr === 'WITH') {
          if (parts.length !== 1) fail('WITH requires one final JSON object');
          const extra = JSON.parse(parts.shift());
          if (!record(extra) || Object.keys(extra).some(k => ['id', 'members', ...ATTRS].includes(k))) fail('group extra redefines structural field');
          if (own(extra, 'spread') && (!record(extra.spread) || Object.keys(extra.spread).length)) fail('spread values belong to note rows');
          for (const [k, v] of Object.entries(extra)) put(group, k, v);
          continue;
        }
        const match = /^(anchor|delay|label|prose)=(.+)$/.exec(attr);
        if (!match || own(group, match[1])) fail('unknown/duplicate group attribute');
        group[match[1]] = readString(match[2]);
      }
      groups.push(group); block = { kind: 'group', group }; continue;
    }
    if (line === '}') { block = null; fields = null; continue; }
    const parts = tokens(line), kind = parts.shift();
    if (kind === 'FIELDS') {
      if (parts.some(k => !COLUMNS.includes(k)) || new Set(parts).size !== parts.length
          || !['id', 'pitch', 'duration', 'velocity'].every(k => parts.includes(k))) fail('invalid FIELDS binding');
      fields = parts; continue;
    }
    if (kind === 'REF') {
      if (block.kind !== 'group' || parts.length !== 1) fail('REF requires a group and one ID');
      block.group.members.push(readString(parts[0])); continue;
    }
    if (kind !== 'NOTE' || !fields || parts.length !== fields.length) fail('NOTE must match local FIELDS');
    const data = {};
    fields.forEach((k, i) => {
      if (parts[i] !== '-') put(data, k, ['pitch', 'velocity', 'order', 'nominal', 'extra'].includes(k)
        ? JSON.parse(parts[i]) : readString(parts[i]));
    });
    if (!['id', 'pitch', 'duration', 'velocity'].every(k => own(data, k))) fail('missing required note field');
    if (definitions.has(data.id)) fail(`duplicate note definition ${data.id}`);
    definitions.add(data.id);
    const timed = own(data, 'spread');
    if (timed === own(data, 'at')) fail('note requires exactly one of at or spread');
    if (own(data, 'spelling') && !timed) fail('spelling requires spread timing');
    if (timed && (block.kind !== 'group' || !own(block.group, 'anchor'))) fail('spread requires containing group anchor');
    const extra = own(data, 'extra') ? data.extra : {};
    if (!record(extra) || CORE.some(k => own(extra, k))) fail('note extra redefines core field');
    const note = { ...Object.fromEntries(CORE.filter(k => own(data, k)).map(k => [k, data[k]])), ...extra };
    if (timed) {
      block.group.spread ??= {};
      put(block.group.spread, note.id, data.spread);
    }
    if (block.kind === 'group') block.group.members.push(note.id);
    rows.push({ note, time: timed ? { group: block.group.id,
      ...(own(data, 'spelling') ? { spelling: data.spelling } : {}) } : null });
    orders.push(data.order);
    if (own(data, 'nominal')) nominal.push([note.id, data.nominal]);
  }
  if (block) fail('unclosed block');
  if (!body) fail('expected at least one block');
  if (groups.length || emptyGroups) context.groups = groups;
  if (nominal.length) {
    if (!record(context.musical?.nominal)) fail('nominal row requires CONTEXT marker');
    for (const [id, value] of nominal) put(context.musical.nominal, id, value);
  }
  if (orders.some(v => v !== undefined)) {
    if (new Set(orders).size !== rows.length || orders.some(v => !Number.isInteger(v) || v < 0 || v >= rows.length)) fail('order must be a complete permutation');
    const sorted = rows.map((row, i) => ({ row, order: orders[i] })).sort((a, b) => a.order - b.order);
    rows.splice(0, rows.length, ...sorted.map(v => v.row));
  }
  return decodeGrouped({ format: 'r01-grouped', version: 1, context, rows });
}
