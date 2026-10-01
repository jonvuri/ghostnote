import { DocumentError, fail } from './error.js';
import { cloneJson, decodeInput, readJson, canonicalJson } from './json.js';
import { readFields, writeFields } from './fields.js';
import { validateStructure, normalizeTimingFields } from './structure.js';
import { digest, normalizeDocument, validateSemantics, basisFromIndex, indexState, overlayOrder, checkReferences } from './semantic.js';
import { LIMITS, type Document, type Overlay, type StateDocument } from './model.js';
export * from './model.js';
export * from './error.js';
export { modelReference, REFERENCE_SECTIONS, type ReferenceSection } from './reference.js';
export { timingDisplay } from './display.js';
export { normalizeTiming } from './rational.js';
export { importNotes, observeCells, ImportCollisionError } from './import.js';
export { applyPatch, applyDesired } from './materialize.js';
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
    for (const [key, max] of Object.entries({ clips: LIMITS.clips, coverage: LIMITS.clips, events: LIMITS.events, overlays: LIMITS.overlays, add: LIMITS.events, remove: LIMITS.events, update: LIMITS.events, clipUpdate: LIMITS.clips, overlayPut: LIMITS.overlays, overlayRemove: LIMITS.overlays }))
        if (Array.isArray(d[key]) && d[key].length > max)
            fail('R28', `$.${key}`, 'array exceeds declared count');
    if (d.kind === 'patch' && ['add', 'remove', 'update', 'clipUpdate', 'overlayPut', 'overlayRemove'].reduce((n, k) => n + (Array.isArray(d[k]) ? d[k].length : 0), 0) > LIMITS.patchEntries)
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
    return digest('ghostnote-document/1.0', validate(doc));
}
export function convert(input: string | Uint8Array, from: Encoding, to: Encoding): string {
    return serialize(parse(input, from), to);
}
/** Compute a claim's basis from a valid base. The claim need not be in the base. */
export function dependencyBasis(doc: StateDocument, overlay: Overlay): string {
    const base = validate(doc);
    if (base.kind === 'patch')
        fail('R22', '$', 'a dependency basis needs full state');
    const proposal = validate({ format: 'ghostnote-document', version: '1.0', kind: 'patch', base: { sha256: '0'.repeat(64) }, add: [], remove: [], update: [], clipUpdate: [], overlayPut: [overlay], overlayRemove: [] });
    if (proposal.kind !== 'patch')
        fail('R22', '$claim', 'expected a claim');
    const claim = proposal.overlayPut[0], index = indexState(base);
    checkReferences(index, claim, '$claim');
    const overlays = new Map(base.overlays.map(o => [o.id, o]));
    overlays.set(claim.id, claim);
    overlayOrder([...overlays.values()]);
    return basisFromIndex(index, claim);
}
/** Seal explicit claims in dependency order, then validate every relationship. */
export function sealOverlays(input: StateDocument): StateDocument {
    const doc = cloneJson(input);
    validateStructure(doc);
    normalizeTimingFields(doc);
    if (doc.kind === 'patch')
        fail('R22', '$', 'sealing requires a state document');
    validateSemantics(doc, false);
    normalizeDocument(doc);
    const index = indexState(doc);
    for (const o of overlayOrder(doc.overlays))
        if (o.state === 'current')
            o.basis = basisFromIndex(index, o);
    return validate(doc) as StateDocument;
}
