import { createHash } from 'node:crypto';
import { fail } from './error.js';
import { canonicalJson, cloneJson } from './json.js';
import { BINDING, CLIP_DEFAULTS, EVENT_DEFAULTS, EVENT_FIELDS, LIMITS, type Clip, type Document, type Event, type Overlay, type StateDocument } from './model.js';
import { cmp, onGrid, rational, normalizeTiming, sum, difference, boundedInteger } from './rational.js';
export const ascii = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
export const digest = (domain: string, value: unknown): string => createHash('sha256').update(domain + '\n' + canonicalJson(value), 'utf8').digest('hex');
export const equal = (a: unknown, b: unknown): boolean => canonicalJson(a) === canonicalJson(b);
export function eventValues(event: Event): Required<Event> {
    return { ...EVENT_DEFAULTS, ...event };
}
export function clipValues(clip: Clip): Required<Clip> {
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
function dependencyBounds(overlays: Overlay[]): void {
    let refs = 0;
    for (const [i, o] of overlays.entries()) {
        const d = o.depends;
        if (d.events.length + d.clips.length + d.overlays.length + d.membership.length > LIMITS.dependencies)
            fail('R28', `$.overlays[${i}].depends`, 'more than 1024 dependencies');
        refs += d.events.reduce((n, e) => n + e.fields.length, 0) + d.clips.reduce((n, c) => n + c.fields.length, 0);
        if (refs > LIMITS.fieldReferences)
            fail('R28', `$.overlays[${i}].depends`, 'too many declared field references');
    }
}
function overlayMinimum(o: Overlay, path: string): void {
    const dep = o.depends, data = o.data;
    unique(dep.events, e => e.id, `${path}.depends.events`, 'R21');
    unique(dep.clips, c => c.id, `${path}.depends.clips`, 'R21');
    if (dep.overlays.includes(o.id))
        fail('R21', `${path}.depends.overlays`, 'self dependency');
    const event = (id: string, fields: string[]) => {
        const entry = dep.events.find(e => e.id === id);
        if (!entry || fields.some(f => !entry.fields.includes(f as keyof Event)))
            fail('R21', `${path}.depends.events`, `missing dependency fields for ${id}: ${fields.join(',')}`);
    };
    const clip = (id: string) => {
        const entry = dep.clips.find(c => c.id === id);
        if (!entry?.fields.includes('length'))
            fail('R21', `${path}.depends.clips`, `missing length dependency for ${id}`);
    };
    if (o.type === 'nominal' || o.type === 'groove') {
        event(o.data.event, ['clip', 'at', 'duration']);
        if (o.type === 'groove') {
            if (!dep.overlays.includes(o.data.nominal))
                fail('R21', `${path}.depends.overlays`, 'missing nominal dependency');
            if (o.data.anchor)
                event(o.data.anchor, ['clip', 'at']);
        }
    }
    else {
        const d = data as {
            clip: string;
            events?: string[];
        };
        clip(d.clip);
        if (d.events) {
            if (!dep.membership.includes(d.clip))
                fail('R21', `${path}.depends.membership`, 'missing group membership dependency');
            for (const id of d.events)
                event(id, o.type === 'region' ? ['clip', 'at'] : ['clip', 'pitch', 'at', 'duration']);
        }
    }
    if ('from' in data && cmp(data.from, data.to) >= 0)
        fail('R20', `${path}.data`, 'span must be positive');
}
export interface StateIndex {
    events: Map<string, Event>;
    clips: Map<string, Clip>;
    overlays: Map<string, Overlay>;
    coverage: Map<string, StateDocument['coverage'][number]>;
    members: Map<string, string[]>;
}
export function indexState(doc: StateDocument): StateIndex {
    const events = unique(doc.events, e => e.id, '$.events', 'R04'), clips = unique(doc.clips, c => c.id, '$.clips', 'R03'), overlays = unique(doc.overlays, o => o.id, '$.overlays', 'R21'), coverage = unique(doc.coverage, c => c.clip, '$.coverage', 'R03');
    const members = new Map<string, string[]>();
    for (const id of clips.keys())
        members.set(id, []);
    for (const e of events.values())
        members.get(e.clip)?.push(e.id);
    for (const ids of members.values())
        ids.sort(ascii);
    return { events, clips, overlays, coverage, members };
}
export function overlayOrder(overlays: Overlay[]): Overlay[] {
    const positions = new Map(overlays.map((o, i) => [o.id, i]));
    const map = new Map(overlays.map(o => [o.id, o])), remaining = new Map<string, number>(), dependents = new Map<string, string[]>();
    for (const o of overlays) {
        remaining.set(o.id, o.depends.overlays.length);
        for (const id of o.depends.overlays) {
            if (!map.has(id))
                fail('R21', `$.overlays[${positions.get(o.id)}].depends.overlays`, `dangling overlay ${id}`);
            const list = dependents.get(id) ?? [];
            list.push(o.id);
            dependents.set(id, list);
        }
    }
    const queue = overlays.filter(o => !remaining.get(o.id)), out: Overlay[] = [];
    for (let i = 0; i < queue.length; i++) {
        const o = queue[i];
        out.push(o);
        for (const id of dependents.get(o.id) ?? []) {
            remaining.set(id, remaining.get(id)! - 1);
            if (!remaining.get(id))
                queue.push(map.get(id)!);
        }
    }
    if (out.length !== overlays.length)
        fail('R21', '$.overlays', 'overlay dependency cycle');
    return out;
}
export function dependencyProjection(index: StateIndex, o: Overlay) {
    const values = (bag: any, fields: string[]) => Object.fromEntries(fields.map(f => [f, bag[f]]));
    return {
        events: o.depends.events.map(d => {
            const e = index.events.get(d.id);
            if (!e)
                fail('R21', `$.overlays.${o.id}`, `dangling event ${d.id}`);
            return { id: d.id, values: values(eventValues(e), d.fields) };
        }).sort((a, b) => ascii(a.id, b.id)),
        clips: o.depends.clips.map(d => {
            const c = index.clips.get(d.id);
            if (!c)
                fail('R21', `$.overlays.${o.id}`, `dangling clip ${d.id}`);
            return { id: d.id, values: values(clipValues(c), d.fields) };
        }).sort((a, b) => ascii(a.id, b.id)),
        overlays: o.depends.overlays.map(id => {
            const target = index.overlays.get(id);
            if (!target)
                fail('R21', `$.overlays.${o.id}`, `dangling overlay ${id}`);
            const { basis, ...rest } = cloneJson(target);
            normalizeOverlay(rest);
            return rest;
        }).sort((a, b) => ascii(a.id, b.id)),
        membership: o.depends.membership.map(id => {
            const ids = index.members.get(id);
            if (!ids)
                fail('R21', `$.overlays.${o.id}`, `dangling membership clip ${id}`);
            return { clip: id, events: ids };
        }).sort((a, b) => ascii(a.clip, b.clip)),
    };
}
export function basisFromIndex(index: StateIndex, o: Overlay): string {
    return digest('ghostnote-dependencies/1.0', dependencyProjection(index, o));
}
export function checkReferences(index: StateIndex, o: Overlay, path: string): void {
    for (const d of o.depends.events) {
        const e = index.events.get(d.id);
        if (!e)
            fail('R21', `${path}.depends.events`, `dangling event ${d.id}`);
        const coverage = index.coverage.get(e.clip)!;
        if (coverage.fields !== 'all' && d.fields.some(f => !coverage.fields.includes(f)))
            fail('R21', `${path}.depends.events`, `uncovered event field for ${d.id}`);
    }
    for (const d of o.depends.clips)
        if (!index.clips.has(d.id))
            fail('R21', `${path}.depends.clips`, `dangling clip ${d.id}`);
    for (const id of o.depends.membership)
        if (!index.clips.has(id))
            fail('R21', `${path}.depends.membership`, `dangling clip ${id}`);
    if ('event' in o.data && !index.events.has(o.data.event))
        fail('R21', `${path}.data.event`, `dangling event ${o.data.event}`);
    if ('clip' in o.data && !index.clips.has(o.data.clip))
        fail('R21', `${path}.data.clip`, `dangling clip ${o.data.clip}`);
    if ('events' in o.data)
        for (const id of o.data.events)
            if (!index.events.has(id))
                fail('R21', `${path}.data.events`, `dangling event ${id}`);
    if (o.type === 'groove') {
        if (!index.overlays.has(o.data.nominal))
            fail('R21', `${path}.data.nominal`, `dangling overlay ${o.data.nominal}`);
        if (o.data.anchor && !index.events.has(o.data.anchor))
            fail('R21', `${path}.data.anchor`, `dangling anchor ${o.data.anchor}`);
    }
    if (o.state === 'current')
        for (const id of o.depends.overlays)
            if (index.overlays.get(id)?.state === 'stale')
                fail('R21', `${path}.depends.overlays`, `current dependency on stale overlay ${id}`);
}
function currentOverlay(index: StateIndex, o: Overlay, path: string, checkBasis: boolean): void {
    if (o.type === 'nominal') {
        const a = rational(o.data.at), d = rational(o.data.division);
        if (boundedInteger(a.n * d.d) % boundedInteger(a.d * d.n) !== 0n)
            fail('R13', `${path}.data.at`, 'position is not on the nominal division');
    }
    else if (o.type === 'groove') {
        const g = o.data, e = index.events.get(g.event)!, nominal = index.overlays.get(g.nominal)!;
        if (nominal.type !== 'nominal' || nominal.data.event !== g.event || nominal.state !== 'current')
            fail('R14', `${path}.data.nominal`, 'groove requires its current subject nominal overlay');
        if (g.anchor && index.events.get(g.anchor)!.clip !== e.clip)
            fail('R14', `${path}.data.anchor`, 'anchor is in another clip');
        const n = nominal.data;
        const equation = (a: string | null | undefined, b: string, field: string, rule: string) => {
            if (a === null || a === undefined || cmp(a, b) !== 0)
                fail(rule, `${path}.data.${field}`, 'timing equation does not match');
        };
        const intentional = ['phase', 'template', 'cross', 'local', 'durationIntent'] as const;
        if (g.sourceAt !== undefined) {
            const norm = normalizeTiming(g.sourceAt, g.sourceDuration!);
            equation(e.at, norm.at, 'sourceAt', 'R15');
            equation(e.duration, norm.duration, 'sourceDuration', 'R15');
            equation(g.atDelta, norm.atDelta, 'atDelta', 'R15');
            equation(g.durationDelta, norm.durationDelta, 'durationDelta', 'R15');
            equation(g.sourceAt, sum(n.at, g.phase, g.template, g.cross, g.local, g.unassigned), 'sourceAt', 'R15');
            equation(g.sourceDuration, sum(n.duration, g.durationIntent, g.durationUnassigned), 'sourceDuration', 'R15');
            if (g.intent === 'resolved' && (cmp(g.unassigned, '0') || cmp(g.durationUnassigned, '0')))
                fail('R15', `${path}.data.intent`, 'resolved intent cannot have unassigned residuals');
            if (o.provenance.kind === 'measured' && (g.intent !== 'unresolved' || intentional.some(f => cmp(g[f], '0'))))
                fail('R15', `${path}.provenance`, 'measured timing cannot assign intent');
        }
        else {
            if (g.atDelta !== null || g.durationDelta !== null || g.intent !== 'unresolved' || intentional.some(f => cmp(g[f], '0')))
                fail('R16', `${path}.data`, 'unknown source requires null deltas and zero intentional components');
            equation(g.unassigned, difference(e.at, n.at), 'unassigned', 'R16');
            equation(g.durationUnassigned, difference(e.duration, n.duration), 'durationUnassigned', 'R16');
        }
    }
    else {
        const d = o.data, c = index.clips.get(d.clip)!;
        if ('from' in d && (cmp(d.from, '0') < 0 || cmp(d.to, c.length) > 0))
            fail(o.type === 'harmony' ? 'R17' : 'R20', `${path}.data`, 'span is outside clip');
        if ('at' in d && (cmp(d.at, c.length) >= 0 && !(cmp(c.length, '0') === 0 && cmp(d.at, '0') === 0)))
            fail('R19', `${path}.data.at`, 'point is outside clip');
        if ('events' in d)
            for (const id of d.events) {
                const e = index.events.get(id)!;
                if (e.clip !== d.clip || 'from' in d && (cmp(e.at, d.from) < 0 || cmp(e.at, d.to) >= 0))
                    fail(o.type === 'harmony' ? 'R17' : o.type === 'region' ? 'R20' : 'R18', `${path}.data.events`, `member ${id} is outside clip or span`);
            }
    }
    if (checkBasis && o.basis !== basisFromIndex(index, o))
        fail('R22', `${path}.basis`, 'current dependency basis does not match');
}
export function validateSemantics(doc: Document, checkBasis = true): void {
    const overlays = doc.kind === 'patch' ? doc.overlayPut : doc.overlays;
    dependencyBounds(overlays);
    overlays.forEach((o, i) => overlayMinimum(o, `$.${doc.kind === 'patch' ? 'overlayPut' : 'overlays'}[${i}]`));
    if (doc.kind === 'patch') {
        const eventIds = new Set<string>(), overlayIds = new Set<string>();
        for (const key of ['add', 'remove', 'update'] as const) {
            unique(doc[key] as any[], v => typeof v === 'string' ? v : v.id, `$.${key}`, 'R09');
            for (const entry of doc[key]) {
                const id = typeof entry === 'string' ? entry : entry.id;
                if (eventIds.has(id))
                    fail('R09', `$.${key}`, `conflicting event operation ${id}`);
                eventIds.add(id);
            }
        }
        for (const key of ['overlayPut', 'overlayRemove'] as const)
            for (const entry of doc[key]) {
                const id = typeof entry === 'string' ? entry : entry.id;
                if (overlayIds.has(id))
                    fail('R09', `$.${key}`, `conflicting overlay operation ${id}`);
                overlayIds.add(id);
            }
        unique(doc.clipUpdate, u => u.id, '$.clipUpdate', 'R09');
        doc.add.forEach((e, i) => eventRules(e, `$.add[${i}]`));
        doc.update.forEach((u, i) => eventRules(u.set as Partial<Event>, `$.update[${i}].set`));
        return;
    }
    const index = indexState(doc), addresses = new Set<string>();
    doc.clips.forEach((c, i) => {
        for (const field of ['loop', 'playRange'] as const) {
            const range = c[field];
            if (range && (cmp(range.from, '0') < 0 || cmp(range.from, range.to) >= 0 || cmp(range.to, c.length) > 0))
                fail('R03', `$.clips[${i}].${field}`, 'range is outside clip or not positive');
        }
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
        if (c.fields !== 'all' && BINDING.some(f => !c.fields.includes(f)))
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
    const currentKeys = new Set<string>(), positions = new Map(doc.overlays.map((o, i) => [o.id, i]));
    for (const o of overlayOrder(doc.overlays)) {
        const path = `$.overlays[${positions.get(o.id)}]`;
        checkReferences(index, o, path);
        if (o.state === 'stale')
            continue;
        let key: string | undefined;
        if (o.type === 'nominal' || o.type === 'groove')
            key = o.type + '\0' + o.data.event;
        if (o.type === 'meter' || o.type === 'tempo')
            key = o.type + '\0' + o.data.clip + '\0' + o.data.at;
        if (key) {
            if (currentKeys.has(key))
                fail(o.type === 'nominal' ? 'R13' : o.type === 'groove' ? 'R14' : 'R19', path, 'duplicate current claim');
            currentKeys.add(key);
        }
        currentOverlay(index, o, path, checkBasis);
    }
}
/** Omit defaults only after validation has checked unknown snapshot fields. */
export function normalizeDocument(doc: Document): Document {
    const omit = (bag: any, defaults: any) => {
        for (const k of Object.keys(defaults))
            if (Object.hasOwn(bag, k) && equal(bag[k], defaults[k]))
                delete bag[k];
    };
    for (const key of ['meta', 'extensions'] as const)
        if (doc[key] && !Object.keys(doc[key]!).length)
            delete doc[key];
    const events = doc.kind === 'patch' ? doc.add : doc.events;
    events.forEach(e => omit(e, EVENT_DEFAULTS));
    if (doc.kind === 'patch') {
        for (const key of ['add', 'remove', 'update', 'clipUpdate', 'overlayPut', 'overlayRemove'] as const)
            (doc[key] as any[]).sort((a, b) => ascii(typeof a === 'string' ? a : a.id, typeof b === 'string' ? b : b.id));
    }
    else {
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
    const overlays = doc.kind === 'patch' ? doc.overlayPut : doc.overlays;
    overlays.sort((a, b) => ascii(a.id, b.id));
    for (const o of overlays)
        normalizeOverlay(o);
    return doc;
}
export function normalizeOverlay(o: Omit<Overlay, 'basis'>): void {
    for (const key of ['events', 'clips'] as const) {
        o.depends[key].sort((a, b) => ascii(a.id, b.id));
        for (const dep of o.depends[key])
            dep.fields.sort(ascii);
    }
    o.depends.overlays.sort(ascii);
    o.depends.membership.sort(ascii);
    if ('events' in o.data)
        o.data.events.sort(ascii);
}
