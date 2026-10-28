/** Research C3 text surface: explicit performed notes with adjacent musical fields. */
import { encodeCompact, decodeCompact } from './structured.mjs';

const own = (o, k) => Object.hasOwn(o, k);
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const fail = message => { throw new Error(`R01 compact FIELDS: ${message}`); };
const put = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: true, configurable: true, writable: true });
const CORE = ['id', 'pitch', 'at', 'duration', 'velocity'];
const NOMINAL = ['at', 'duration', 'division'];
const COLUMNS = [...CORE, 'groups', 'nominal.location', ...NOMINAL.map(k => `nominal.${k}`), 'nominal.extra', 'extra'];
const omit = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
const stringToken = s => /^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(s) ? s : JSON.stringify(s);
function readString(s) {
  if (s === undefined || s === '-') fail('missing string');
  if (!s.startsWith('"')) return s;
  const value = JSON.parse(s);
  if (typeof value !== 'string') fail('expected string');
  return value;
}

// Same whitespace/JSON-cell convention as C4, without changing its measured codec.
function tokens(line) {
  const out = [], stack = []; let start = -1, quoted = false, escaped = false;
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

export function encodeCompactFields(input) {
  const { context, rows } = encodeCompact(input);
  const data = rows.map(row => {
    const note = Object.fromEntries(CORE.map((k, i) => [k, row[i]]));
    const extra = omit(row[5], ['nominal']);
    if (row[6].length) note.groups = row[6];
    const local = own(row[5], 'nominal'), nominal = local ? row[5].nominal : row[7];
    if (nominal !== null) {
      note['nominal.location'] = local ? 'note' : 'map';
      for (const key of NOMINAL) if (own(nominal, key)) note[`nominal.${key}`] = nominal[key];
      const rest = omit(nominal, NOMINAL);
      if (Object.keys(rest).length) note['nominal.extra'] = rest;
    }
    if (Object.keys(extra).length) note.extra = extra;
    return note;
  });
  const fields = COLUMNS.filter(k => CORE.includes(k) || data.some(row => own(row, k)));
  const lines = ['R01-COMPACT-FIELDS 1'];
  if (Object.keys(context).length) lines.push(`CONTEXT ${JSON.stringify(context)}`);
  lines.push(`FIELDS ${fields.join(' ')}`);
  for (const row of data) lines.push('NOTE ' + fields.map(k => {
    if (!own(row, k)) return '-';
    if (k === 'id') return stringToken(row[k]);
    if (['groups', 'nominal.extra', 'extra'].includes(k)) return JSON.stringify(row[k]);
    return String(row[k]);
  }).join(' '));
  return lines.join('\n') + '\n';
}

export function decodeCompactFields(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 8 * 1024 * 1024) fail('expected text up to 8 MiB');
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (lines.shift() !== 'R01-COMPACT-FIELDS 1') fail('expected version header');
  let context = {}, contextSeen = false, fields = null;
  const rows = [];
  for (const line of lines) {
    if (line.startsWith('CONTEXT ')) {
      if (contextSeen || fields) fail('CONTEXT must occur once before FIELDS');
      context = JSON.parse(line.slice(8)); contextSeen = true;
      if (!record(context) || own(context, 'notes')) fail('invalid CONTEXT');
      continue;
    }
    const parts = tokens(line), kind = parts.shift();
    if (kind === 'FIELDS') {
      if (parts.some(k => !COLUMNS.includes(k)) || new Set(parts).size !== parts.length
          || !CORE.every(k => parts.includes(k))) fail('invalid FIELDS binding');
      fields = parts; continue;
    }
    if (kind !== 'NOTE' || !fields || parts.length !== fields.length) fail('NOTE must match FIELDS');
    const data = {};
    fields.forEach((k, i) => {
      if (parts[i] !== '-') put(data, k, ['pitch', 'velocity', 'groups', 'nominal.extra', 'extra'].includes(k)
        ? JSON.parse(parts[i]) : readString(parts[i]));
    });
    if (!CORE.every(k => own(data, k))) fail('missing required note field');
    const extra = own(data, 'extra') ? data.extra : {};
    if (!record(extra) || [...CORE, 'nominal'].some(k => own(extra, k))) fail('extra redefines a note/nominal field');
    let mapped = null;
    if (Object.keys(data).some(k => k.startsWith('nominal.'))) {
      if (!['note', 'map'].includes(data['nominal.location']) || !own(data, 'nominal.at')) fail('nominal requires location and at');
      const rest = own(data, 'nominal.extra') ? data['nominal.extra'] : {};
      if (!record(rest) || NOMINAL.some(k => own(rest, k))) fail('nominal.extra redefines timing');
      const nominal = { ...Object.fromEntries(NOMINAL.filter(k => own(data, `nominal.${k}`))
        .map(k => [k, data[`nominal.${k}`]])), ...rest };
      if (data['nominal.location'] === 'note') put(extra, 'nominal', nominal);
      else mapped = nominal;
    }
    const groups = own(data, 'groups') ? data.groups : [];
    rows.push([...CORE.map(k => data[k]), extra, groups, mapped]);
  }
  if (!fields) fail('expected FIELDS binding');
  return decodeCompact({ format: 'r01-compact', version: 1, context, rows });
}
