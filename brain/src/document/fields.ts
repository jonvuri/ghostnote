import { BINDING, EVENT_DEFAULTS, EVENT_FIELDS, REQUIRED_FIELDS, type Document, type Event, type EventField } from './model.js';
import { DocumentError, fail } from './error.js';
import { canonicalJson, readJson } from './json.js';
export interface FieldSource {
    value: any;
    locations: Map<string, {
        line: number;
        column: number;
    }>;
}
export function readFields(text: string): FieldSource {
    const lines = text.split('\n'), locations = new Map<string, {
        line: number;
        column: number;
    }>();
    let value: any, binding: EventField[] | undefined;
    const seen = new Set<string>();
    function tokens(line: string, lineNumber: number): {
        text: string;
        column: number;
    }[] {
        const out: {
            text: string;
            column: number;
        }[] = [];
        let i = 0;
        while (i < line.length) {
            while (line[i] === ' ' || line[i] === '\t')
                i++;
            if (i === line.length)
                break;
            const start = i;
            let depth = 0, quoted = false, escape = false;
            do {
                const c = line[i++];
                if (quoted) {
                    if (escape)
                        escape = false;
                    else if (c === '\\')
                        escape = true;
                    else if (c === '"')
                        quoted = false;
                }
                else if (c === '"')
                    quoted = true;
                else if (c === '{' || c === '[')
                    depth++;
                else if (c === '}' || c === ']')
                    depth--;
                if (depth < 0)
                    throw new DocumentError('R11', '$', 'unbalanced JSON', { line: lineNumber, column: i });
            } while (i < line.length && (quoted || depth > 0 || line[i] !== ' ' && line[i] !== '\t'));
            if (quoted || depth !== 0)
                throw new DocumentError('R11', '$', 'unbalanced JSON', { line: lineNumber, column: start + 1 });
            out.push({ text: line.slice(start, i), column: start + 1 });
        }
        return out;
    }
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index].endsWith('\r') ? lines[index].slice(0, -1) : lines[index];
        if (!/[^ \t]/.test(line))
            continue;
        const lineNumber = index + 1, parts = tokens(line, lineNumber), word = parts[0].text;
        const loc = { line: lineNumber, column: parts[0].column };
        const error = (reason: string, rule = 'R10'): never => {
            throw new DocumentError(rule, '$', reason, loc);
        };
        const json = (p: {
            text: string;
            column: number;
        } | undefined): any => {
            if (!p)
                error('missing JSON object');
            try {
                return readJson(p!.text).value;
            }
            catch (e) {
                if (e instanceof DocumentError)
                    throw new DocumentError(e.rule, e.path, e.message.split(': ').slice(1).join(': '), { line: lineNumber, column: p!.column + (e.column ?? 1) - 1 });
                throw e;
            }
        };
        const mark = (path: string, p = parts[0]) => locations.set(path, { line: lineNumber, column: p.column });
        if (!value) {
            if (parts.length !== 4 || word !== 'DOC')
                error('expected DOC format version kind');
            value = { format: parts[1].text, version: parts[2].text, kind: parts[3].text };
            if (!['snapshot', 'desired', 'patch'].includes(value.kind))
                error('unknown document kind');
            for (const key of value.kind === 'patch' ? ['add', 'remove', 'update', 'clipUpdate', 'overlayPut', 'overlayRemove'] : ['clips', 'coverage', 'events', 'overlays'])
                value[key] = [];
            mark('$');
            mark('$.format', parts[1]);
            mark('$.version', parts[2]);
            mark('$.kind', parts[3]);
            continue;
        }
        if (word === 'FIELDS') {
            if (binding)
                error('repeated FIELDS binding');
            const names = parts.slice(1).map(p => p.text);
            if (!names.length || new Set(names).size !== names.length || names.some(n => !EVENT_FIELDS.includes(n as EventField)) || REQUIRED_FIELDS.some(n => !names.includes(n)))
                error('invalid or incomplete FIELDS binding');
            binding = names as EventField[];
            continue;
        }
        const envelopes: Record<string, string> = { META: 'meta', BASE: 'base', EXTENSIONS: 'extensions', CLIP: 'clips', COVERAGE: 'coverage' };
        if (Object.hasOwn(envelopes, word)) {
            if (binding)
                error('envelope record follows binding');
            if (parts.length !== 2)
                error('expected one JSON object');
            const key = envelopes[word];
            if (['clips', 'coverage'].includes(key)) {
                if (value.kind === 'patch')
                    error('full-state record in patch');
                mark(`$.${key}[${value[key].length}]`, parts[1]);
                value[key].push(json(parts[1]));
            }
            else {
                if (seen.has(key))
                    error(`repeated ${word}`);
                seen.add(key);
                mark(`$.${key}`, parts[1]);
                value[key] = json(parts[1]);
            }
            continue;
        }
        if (!binding)
            throw new DocumentError('R10', '$', 'body record before FIELDS binding', loc);
        if (word === 'EVENT' || word === 'ADD') {
            if (word !== (value.kind === 'patch' ? 'ADD' : 'EVENT'))
                error('wrong-kind event record');
            const key = word === 'ADD' ? 'add' : 'events', path = `$.${key}[${value[key].length}]`, row: any = Object.create(null);
            mark(path);
            if (parts.length < binding.length + 1)
                error('too few row slots');
            for (let i = 0; i < binding.length; i++) {
                const field = binding[i], p = parts[i + 1];
                mark(`${path}.${field}`, p);
                if (p.text === '_') {
                    if (REQUIRED_FIELDS.includes(field))
                        error(`required ${field} is omitted`);
                    continue;
                }
                if (!p.text.startsWith('"') && (['id', 'clip', 'at', 'duration'].includes(field) || field === 'articulation' && /^[A-Za-z][A-Za-z0-9_.:-]*$/.test(p.text)))
                    row[field] = p.text;
                else
                    row[field] = json(p);
            }
            if (parts.length !== binding.length + 1) {
                if (parts.length !== binding.length + 3 || parts[binding.length + 1].text !== 'WITH')
                    error('surplus row slots or invalid WITH');
                const extra = json(parts[binding.length + 2]);
                if (extra === null || typeof extra !== 'object' || Array.isArray(extra))
                    error('WITH must be an object');
                for (const field of Object.keys(extra)) {
                    if (binding.includes(field as EventField))
                        error(`binding/WITH conflict for ${field}`);
                    row[field] = extra[field];
                    mark(`${path}.${field}`, parts[binding.length + 2]);
                }
            }
            value[key].push(row);
            continue;
        }
        const bodies: Record<string, string> = { OVERLAY: 'overlays', OVERLAY_PUT: 'overlayPut', OVERLAY_REMOVE: 'overlayRemove', REMOVE: 'remove', UPDATE: 'update', CLIP_UPDATE: 'clipUpdate' };
        if (!Object.hasOwn(bodies, word))
            error('unknown or repeated record', 'R01');
        const key = bodies[word];
        if (!Object.hasOwn(value, key))
            error('wrong-kind body record');
        const path = `$.${key}[${value[key].length}]`;
        mark(path);
        if (word === 'UPDATE' || word === 'CLIP_UPDATE') {
            if (parts.length !== 3)
                error('expected ID and set object');
            value[key].push({ id: parts[1].text, set: json(parts[2]) });
            mark(`${path}.id`, parts[1]);
            mark(`${path}.set`, parts[2]);
        }
        else {
            if (parts.length !== 2)
                error('wrong record width');
            value[key].push(word === 'OVERLAY' || word === 'OVERLAY_PUT' ? json(parts[1]) : parts[1].text);
        }
    }
    if (!value)
        throw new DocumentError('R10', '$', 'empty output lacks DOC header', { line: 1, column: 1 });
    if (!binding)
        throw new DocumentError('R10', '$', 'missing FIELDS binding', locations.get('$'));
    return { value, locations };
}
function row(event: Event): string {
    const e = { ...EVENT_DEFAULTS, ...event }, extra: Record<string, unknown> = {};
    for (const k of Object.keys(event) as EventField[])
        if (!BINDING.includes(k))
            extra[k] = event[k];
    return BINDING.map(k => ['id', 'clip', 'at', 'duration'].includes(k) ? String(e[k]) : canonicalJson(e[k])).join(' ') + (Object.keys(extra).length ? ' WITH ' + canonicalJson(extra) : '');
}
export function writeFields(doc: Document): string {
    const lines = [`DOC ghostnote-document 1.0 ${doc.kind}`];
    for (const [key, record] of [['meta', 'META'], ['base', 'BASE'], ['extensions', 'EXTENSIONS']] as const)
        if (doc[key])
            lines.push(record + ' ' + canonicalJson(doc[key]));
    if (doc.kind !== 'patch') {
        for (const c of doc.clips)
            lines.push('CLIP ' + canonicalJson(c));
        for (const c of doc.coverage)
            lines.push('COVERAGE ' + canonicalJson(c));
    }
    lines.push('FIELDS ' + BINDING.join(' '));
    if (doc.kind === 'patch') {
        for (const id of doc.remove)
            lines.push('REMOVE ' + id);
        for (const u of doc.update)
            lines.push('UPDATE ' + u.id + ' ' + canonicalJson(u.set));
        for (const e of doc.add)
            lines.push('ADD ' + row(e));
        for (const u of doc.clipUpdate)
            lines.push('CLIP_UPDATE ' + u.id + ' ' + canonicalJson(u.set));
        for (const id of doc.overlayRemove)
            lines.push('OVERLAY_REMOVE ' + id);
        for (const o of doc.overlayPut)
            lines.push('OVERLAY_PUT ' + canonicalJson(o));
    }
    else {
        for (const e of doc.events)
            lines.push('EVENT ' + row(e));
        for (const o of doc.overlays)
            lines.push('OVERLAY ' + canonicalJson(o));
    }
    return lines.join('\n') + '\n';
}
