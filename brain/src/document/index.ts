import { DocumentError, fail } from './error.js';
import { cloneJson, decodeInput, readJson, canonicalJson } from './json.js';
import { readFields, writeFields } from './fields.js';
import { validateStructure, normalizeTimingFields } from './structure.js';
import { normalizedContentHash, normalizeDocument, validateSemantics, expandClipDefaults } from './semantic.js';
import { LIMITS, type Document } from './model.js';
export * from './model.js';
export * from './error.js';
export { modelReference, REFERENCE_SECTIONS, type ReferenceSection } from './reference.js';
export { normalizeTiming } from './rational.js';
export { importNotes, observeCells, ImportCollisionError } from './import.js';
export { applyPatch, applyDesired } from './materialize.js';
export { canonicalClipDefaults } from './semantic.js';
export type { SourceNote, ImportReport } from './import.js';
export type { ChangeReport, Materialized } from './materialize.js';
export type Encoding = 'fields' | 'json';
/** Validate native I/O data and return its normalized semantic value. */
export function validate(input: unknown, options: {
    requiredExtensions?: string[];
} = {}): Document {
    if (options.requiredExtensions?.length)
        fail('R01', '$.extensions', `unknown extension behavior required: ${options.requiredExtensions.join(',')}`);
    return validateValue(input, true);
}
function validateValue(input: unknown, nativeBytes: boolean): Document {
    preflight(input);
    const doc = cloneJson(input, '$', 1, new Set(), { bytes: 0, max: nativeBytes ? LIMITS.bytes : Infinity });
    validateStructure(doc);
    normalizeTimingFields(doc);
    expandClipDefaults(doc);
    validateSemantics(doc);
    const normalized = normalizeDocument(doc);
    for (const output of [canonicalJson(normalized), writeFields(normalized)])
        if (Buffer.byteLength(output) > LIMITS.bytes)
            fail('R28', '$', 'canonical encoding exceeds 8 MiB');
    return normalized;
}
function preflight(input: unknown): void {
    if (!input || typeof input !== 'object')
        return;
    const d = Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(input)).filter(([, property]) => 'value' in property).map(([key, property]) => [key, property.value]));
    for (const [key, max] of Object.entries({ clips: LIMITS.clips, coverage: LIMITS.clips, events: LIMITS.events, add: LIMITS.events, remove: LIMITS.events, update: LIMITS.events, clipUpdate: LIMITS.clips }))
        if (Array.isArray(d[key]) && d[key].length > max)
            fail('R28', `$.${key}`, 'array exceeds declared count');
    if (d.kind === 'patch' && ['add', 'remove', 'update', 'clipUpdate'].reduce((n, k) => n + (Array.isArray(d[k]) ? d[k].length : 0), 0) > LIMITS.patchEntries)
        fail('R28', '$', 'total patch entries exceed 131072');
}
export function parse(input: string | Uint8Array, encoding: Encoding): Document {
    const text = decodeInput(input);
    if (encoding === 'fields') {
        const source = readFields(text);
        try {
            return validateValue(source.value, false);
        }
        catch (e) {
            if (!(e instanceof DocumentError) || e.line)
                throw e;
            let path = e.path;
            while (!source.locations.has(path) && path !== '$')
                path = path.replace(/(?:\.[^.\[\]]+|\[\d+\])$/, '');
            throw new DocumentError(e.rule, e.path, e.message.slice(e.message.indexOf(': ') + 2), source.locations.get(path) ?? source.locations.get('$'));
        }
    }
    if (encoding !== 'json')
        fail('R29', '$encoding', 'unknown encoding');
    const source = readJson(text);
    try {
        return validateValue(source.value, false);
    }
    catch (e) {
        if (!(e instanceof DocumentError) || e.line)
            throw e;
        let path = e.path;
        while (!source.locations.has(path) && path !== '$')
            path = path.replace(/(?:\.[^.\[\]]+|\[\d+\])$/, '');
        const offset = source.locations.get(path) ?? 0, prefix = text.slice(0, offset);
        throw new DocumentError(e.rule, e.path, e.message.slice(e.message.indexOf(': ') + 2), { line: prefix.split('\n').length, column: offset - prefix.lastIndexOf('\n') });
    }
}
export function serialize(doc: Document, encoding: Encoding): string {
    const normalized = validate(doc);
    if (encoding === 'json')
        return canonicalJson(normalized);
    if (encoding === 'fields')
        return writeFields(normalized);
    return fail('R29', '$encoding', 'unknown encoding');
}
export function contentHash(doc: Document): string {
    return normalizedContentHash(validate(doc));
}
export function convert(input: string | Uint8Array, from: Encoding, to: Encoding): string {
    return serialize(parse(input, from), to);
}
