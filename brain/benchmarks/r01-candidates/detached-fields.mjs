// Diagnostic presentation control only. The primary C4 surface stays group-local.
import { encodeNestedFields, decodeNestedFields } from './nested-fields.mjs';
const fail = message => { throw new Error(`R01 detached control: ${message}`); };
function blocks(text, header) {
  const lines = text.trimEnd().split(/\r?\n/);
  if (lines.shift()?.trim() !== header) fail('wrong header');
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (/^(GROUP .+|NOTES|ROWS r\d+) \{$/.test(line.trim())) {
      const body = [];
      while (++i < lines.length && lines[i].trim() !== '}') body.push(lines[i]);
      if (i === lines.length) fail('unclosed block');
      result.push({ header: line.trim(), body });
    } else result.push({ line });
  }
  return result;
}
export function encodeDetachedFields(fixture) {
  const source = blocks(encodeNestedFields(fixture), 'R01-GROUPED-FIELDS 1');
  const out = ['R01-DETACHED-FIELDS 1'], tables = [];
  let nextTable = 0;
  for (const part of source) {
    if (part.line !== undefined) { out.push(part.line); continue; }
    if (part.header.startsWith('GROUP ')) {
      const id = `r${nextTable++}`;
      out.push(part.header, `  ROWS ${id}`, '}');
      tables.push(`ROWS ${id} {`, ...part.body, '}');
    } else out.push(part.header, ...part.body, '}');
  }
  return [...out, ...tables].join('\n') + '\n';
}
export function decodeDetachedFields(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 8 * 1024 * 1024) fail('invalid text size');
  const source = blocks(text, 'R01-DETACHED-FIELDS 1'), tables = new Map();
  for (const part of source) if (part.header?.startsWith('ROWS ')) {
    const id = part.header.split(' ')[1];
    if (tables.has(id)) fail('duplicate ROWS definition');
    tables.set(id, part.body);
  }
  const out = ['R01-GROUPED-FIELDS 1'], used = new Set();
  for (const part of source) {
    if (part.header?.startsWith('ROWS ')) continue;
    if (part.line !== undefined) { out.push(part.line); continue; }
    if (part.header.startsWith('GROUP ')) {
      const rows = part.body.map(s => s.trim()).filter(Boolean);
      if (rows.length !== 1 || !/^ROWS r\d+$/.test(rows[0])) fail('GROUP requires one ROWS reference');
      const id = rows[0].split(' ')[1];
      if (!tables.has(id) || used.has(id)) fail('missing/shared ROWS definition');
      used.add(id); out.push(part.header, ...tables.get(id), '}');
    } else out.push(part.header, ...part.body, '}');
  }
  if (used.size !== tables.size) fail('unreferenced ROWS definition');
  return decodeNestedFields(out.join('\n') + '\n');
}
export function auditDetachedLayout(fixture) {
  const local = blocks(encodeNestedFields(fixture), 'R01-GROUPED-FIELDS 1')
    .filter(p => p.header?.startsWith('GROUP '));
  const detached = blocks(encodeDetachedFields(fixture), 'R01-DETACHED-FIELDS 1');
  const groups = detached.filter(p => p.header?.startsWith('GROUP '));
  const tables = detached.filter(p => p.header?.startsWith('ROWS '));
  return local.length === groups.length && local.length === tables.length
    && local.every((p, i) => p.header === groups[i].header
      && JSON.stringify(p.body) === JSON.stringify(tables[i].body));
}
