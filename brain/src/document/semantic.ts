import { createHash } from 'node:crypto';
import { fail } from './error.js';
import { canonicalJson, cloneJson } from './json.js';
import { COVERAGE_FIELDS, CLIP_DEFAULTS, EVENT_DEFAULTS, EVENT_FIELDS, OPTIONAL_FIELDS, type Clip, type ClipDefaults, type ClipProvenance, type Document, type Event, type StateDocument } from './model.js';
import { cmp, onGrid } from './rational.js';
export const ascii = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
export const digest = (domain: string, value: unknown): string => createHash('sha256').update(domain + '\n' + canonicalJson(value), 'utf8').digest('hex');
/** R27 content hash of a document that `validate` already normalized. */
export const normalizedContentHash = (doc: unknown): string => digest('ghostnote-document/1.0', doc);
export const equal = (a: unknown, b: unknown): boolean => canonicalJson(a) === canonicalJson(b);
export function eventValues(event: Event): Required<Event> {
    return { ...EVENT_DEFAULTS, ...event };
}
export function clipValues(clip: Clip): Clip {
    return { ...CLIP_DEFAULTS, ...clip };
}
function unique<T>(rows: T[], key: (row: T) => string, path: string, rule: string): Map<string, T> {
    const map = new Map<string, T>();
    rows.forEach((row, i) => {
        const id = key(row);
        if (map.has(id))
            fail(rule, `${path}[${i}]`, `duplicate ID ${id}`);
        map.set(id, row);
    });
    return map;
}
export function eventRules(event: Partial<Event>, path: string): void {
    for (const field of ['at', 'duration'] as const)
        if (event[field] !== undefined && (!onGrid(event[field]!) || field === 'duration' && cmp(event[field]!, '1/512') < 0))
            fail('R06', `${path}.${field}`, 'realized timing must use the 1/512 grid');
    if (event.recurrence && BigInt(event.recurrence.mask) >= 1n << BigInt(event.recurrence.length))
        fail('R04', `${path}.recurrence.mask`, 'mask must be below 2^length');
}
export interface StateIndex {
    events: Map<string, Event>;
    clips: Map<string, Clip>;
    coverage: Map<string, StateDocument['coverage'][number]>;
}
export function indexState(doc: StateDocument): StateIndex {
    const events = unique(doc.events, e => e.id, '$.events', 'R04'), clips = unique(doc.clips, c => c.id, '$.clips', 'R03'), coverage = unique(doc.coverage, c => c.clip, '$.coverage', 'R03');
    return { events, clips, coverage };
}
const coveredField = (coverage: StateDocument['coverage'][number] | undefined, field: string): boolean =>
    coverage !== undefined && (coverage.fields === 'all' || coverage.fields.includes(field as keyof Event));
/**
 * R34: expand the clip defaults of a state document into its events, then drop them. An explicit event value wins.
 * A default must name a covered field. Runs after structure checks and before semantic validation.
 */
export function expandClipDefaults(doc: Document): void {
    if (doc.kind === 'patch')
        return;
    const coverage = new Map(doc.coverage.map(c => [c.clip, c]));
    const defaults = new Map<string, ClipDefaults>();
    doc.clips.forEach((c, i) => {
        if (!c.defaults)
            return;
        for (const field of Object.keys(c.defaults))
            if (!coveredField(coverage.get(c.id), field))
                fail('R34', `$.clips[${i}].defaults.${field}`, 'a clip default must name a covered field');
        if (!defaults.has(c.id))
            defaults.set(c.id, c.defaults);
        delete c.defaults;
    });
    if (!defaults.size)
        return;
    for (const e of doc.events) {
        const values = defaults.get(e.clip);
        if (values)
            for (const [field, value] of Object.entries(values))
                if (!Object.hasOwn(e, field))
                    (e as any)[field] = cloneJson(value);
    }
}
/**
 * R34 canonical clip defaults of a normalized state document: for each clip with events and each covered optional
 * field, the value that every event of the clip shares, when it is not the portable default.
 */
export function canonicalClipDefaults(doc: StateDocument): Map<string, ClipDefaults> {
    const coverage = new Map(doc.coverage.map(c => [c.clip, c])), byClip = new Map<string, Event[]>();
    for (const e of doc.events) {
        const list = byClip.get(e.clip);
        if (list)
            list.push(e);
        else
            byClip.set(e.clip, [e]);
    }
    const out = new Map<string, ClipDefaults>();
    for (const [clip, events] of byClip) {
        const values: ClipDefaults = {};
        for (const field of OPTIONAL_FIELDS) {
            if (!coveredField(coverage.get(clip), field) || !Object.hasOwn(events[0], field))
                continue;
            const first = canonicalJson(events[0][field]);
            if (events.every(e => Object.hasOwn(e, field) && canonicalJson(e[field]) === first))
                (values as any)[field] = events[0][field];
        }
        if (Object.keys(values).length)
            out.set(clip, values);
    }
    return out;
}
function provenanceRules(provenance: ClipProvenance | null | undefined, path: string): void {
    provenance?.sources?.forEach((source, i) => {
        if (source.range && cmp(source.range.from, source.range.to) >= 0)
            fail('R33', `${path}.sources[${i}].range`, 'a source range must be positive');
    });
}
export function validateSemantics(doc: Document): void {
    if (doc.kind === 'patch') {
        const eventIds = new Set<string>();
        for (const key of ['add', 'remove', 'update'] as const) {
            unique(doc[key] as any[], v => typeof v === 'string' ? v : v.id, `$.${key}`, 'R09');
            for (const entry of doc[key]) {
                const id = typeof entry === 'string' ? entry : entry.id;
                if (eventIds.has(id))
                    fail('R09', `$.${key}`, `conflicting event operation ${id}`);
                eventIds.add(id);
            }
        }
        unique(doc.clipUpdate, u => u.id, '$.clipUpdate', 'R09');
        doc.add.forEach((e, i) => eventRules(e, `$.add[${i}]`));
        doc.update.forEach((u, i) => eventRules(u.set as Partial<Event>, `$.update[${i}].set`));
        doc.clipUpdate.forEach((u, i) => provenanceRules(u.set.provenance, `$.clipUpdate[${i}].set.provenance`));
        return;
    }
    const index = indexState(doc), addresses = new Set<string>();
    doc.clips.forEach((c, i) => {
        for (const field of ['loop', 'playRange'] as const) {
            const range = c[field];
            if (range && (cmp(range.from, '0') < 0 || cmp(range.from, range.to) >= 0 || cmp(range.to, c.length) > 0))
                fail('R03', `$.clips[${i}].${field}`, 'range is outside clip or not positive');
        }
        provenanceRules(c.provenance, `$.clips[${i}].provenance`);
        const coverage = index.coverage.get(c.id);
        if (!coverage)
            fail('R03', `$.clips[${i}]`, `missing coverage for ${c.id}`);
    });
    doc.coverage.forEach((c, i) => {
        const clip = index.clips.get(c.clip);
        if (!clip)
            fail('R03', `$.coverage[${i}].clip`, `dangling clip ${c.clip}`);
        if (cmp(c.from, '0') < 0 || cmp(c.from, c.to) > 0 || cmp(c.to, clip.length) > 0 || cmp(c.from, c.to) === 0 && cmp(clip.length, '0') !== 0)
            fail('R03', `$.coverage[${i}]`, 'coverage span is invalid');
        if (c.fields !== 'all' && COVERAGE_FIELDS.some(f => !c.fields.includes(f)))
            fail('R03', `$.coverage[${i}].fields`, 'missing required coverage field');
        if (doc.kind === 'desired' && (c.status !== 'complete' || cmp(c.from, '0') !== 0 || cmp(c.to, clip.length) !== 0 || c.channels.length !== 16 || c.fields !== 'all' && c.fields.length !== EVENT_FIELDS.length))
            fail('R03', `$.coverage[${i}]`, 'desired coverage must contain complete state');
    });
    doc.events.forEach((e, i) => {
        const path = `$.events[${i}]`;
        eventRules(e, path);
        const c = index.clips.get(e.clip);
        if (!c)
            fail('R03', `${path}.clip`, `dangling clip ${e.clip}`);
        if (cmp(e.at, c.length) >= 0)
            fail('R03', `${path}.at`, 'onset is outside clip');
        const coverage = index.coverage.get(e.clip)!;
        if (coverage.status === 'unavailable' || cmp(e.at, coverage.from) < 0 || cmp(e.at, coverage.to) >= 0 || !coverage.channels.includes(e.channel ?? 1))
            fail('R03', path, 'event is outside obtained coverage');
        if (coverage.fields !== 'all' && Object.keys(e).some(f => !coverage.fields.includes(f as keyof Event)))
            fail('R03', path, 'explicit event field is not covered');
        const address = `${e.clip}\0${e.channel ?? 1}\0${e.pitch}\0${e.at}`;
        if (addresses.has(address))
            fail('R04', path, 'duplicate normalized event address');
        addresses.add(address);
    });
}
/**
 * Omit defaults only after validation has checked unknown snapshot fields. A patch keeps explicit values in its
 * adds: an omitted value takes the base clip default (R34), so an explicit portable default is not an omission.
 */
export function normalizeDocument(doc: Document): Document {
    const omit = (bag: any, defaults: any) => {
        for (const k of Object.keys(defaults))
            if (Object.hasOwn(bag, k) && equal(bag[k], defaults[k]))
                delete bag[k];
    };
    for (const key of ['meta', 'extensions'] as const)
        if (doc[key] && !Object.keys(doc[key]!).length)
            delete doc[key];
    if (doc.kind === 'patch') {
        for (const key of ['add', 'remove', 'update', 'clipUpdate'] as const)
            (doc[key] as any[]).sort((a, b) => ascii(typeof a === 'string' ? a : a.id, typeof b === 'string' ? b : b.id));
    }
    else {
        doc.events.forEach(e => omit(e, EVENT_DEFAULTS));
        doc.clips.forEach(c => omit(c, CLIP_DEFAULTS));
        doc.clips.sort((a, b) => ascii(a.id, b.id));
        doc.coverage.sort((a, b) => ascii(a.clip, b.clip));
        doc.events.sort((a, b) => ascii(a.clip, b.clip) || cmp(a.at, b.at) || (a.channel ?? 1) - (b.channel ?? 1) || a.pitch - b.pitch || ascii(a.id, b.id));
        for (const c of doc.coverage) {
            c.channels.sort((a, b) => a - b);
            if (c.fields !== 'all') {
                c.fields.sort(ascii);
                if (c.fields.length === EVENT_FIELDS.length)
                    c.fields = 'all';
            }
        }
    }
    return doc;
}
