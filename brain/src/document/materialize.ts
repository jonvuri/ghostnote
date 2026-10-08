import { fail } from './error.js';
import { cloneJson } from './json.js';
import { CLIP_DEFAULTS, EVENT_DEFAULTS, type Document, type Patch, type StateDocument } from './model.js';
import { validate } from './index.js';
import { cmp } from './rational.js';
import { ascii, basisFromIndex, normalizedContentHash, clipValues, equal, eventValues, indexState, overlayOrder } from './semantic.js';
export interface ChangeReport {
    added: string[];
    removed: string[];
    changedFields: {
        id: string;
        fields: string[];
    }[];
    clipFields: {
        id: string;
        fields: string[];
    }[];
    clearedDefaults: {
        id: string;
        fields: string[];
    }[];
    overlayChanges: {
        id: string;
        from: 'current' | 'stale' | null;
        to: 'current' | 'stale' | null;
    }[];
}
export interface Materialized {
    document: StateDocument;
    report: ChangeReport;
}
function fullBase(base: StateDocument): void {
    for (const c of base.clips) {
        const coverage = base.coverage.find(v => v.clip === c.id)!;
        if (coverage.status !== 'complete' || coverage.fields !== 'all' || coverage.channels.length !== 16 || cmp(coverage.from, '0') || cmp(coverage.to, c.length))
            fail('R09', '$.base', `pure application requires full coverage for ${c.id}`);
    }
}
/** `base` is the normalized result of `validate`. */
function guard(base: StateDocument, proposal: Document): void {
    if (!proposal.base || proposal.base.sha256 !== normalizedContentHash(base))
        fail('R09', '$.base.sha256', 'base guard does not match');
    fullBase(base);
}
function finish(base: StateDocument, result: StateDocument, explicit: Set<string>): Materialized {
    const index = indexState(result);
    for (const o of overlayOrder(result.overlays)) {
        if (explicit.has(o.id) || o.state === 'stale')
            continue;
        if (o.depends.overlays.some(id => index.overlays.get(id)!.state === 'stale') || o.basis !== basisFromIndex(index, o))
            o.state = 'stale';
    }
    const document = validate(result) as StateDocument;
    const old = indexState(base), next = indexState(document);
    const report: ChangeReport = { added: [], removed: [], changedFields: [], clipFields: [], clearedDefaults: [], overlayChanges: [] };
    for (const [id, e] of next.events) {
        const prev = old.events.get(id);
        if (!prev) {
            report.added.push(id);
            continue;
        }
        const a = eventValues(prev), b = eventValues(e), fields = Object.keys(b).filter(k => !equal(a[k as keyof typeof a], b[k as keyof typeof b])).sort(ascii);
        if (fields.length)
            report.changedFields.push({ id, fields });
        const cleared = fields.filter(k => Object.hasOwn(EVENT_DEFAULTS, k) && equal(b[k as keyof typeof b], EVENT_DEFAULTS[k as keyof typeof EVENT_DEFAULTS]));
        if (cleared.length)
            report.clearedDefaults.push({ id, fields: cleared });
    }
    for (const id of old.events.keys())
        if (!next.events.has(id))
            report.removed.push(id);
    for (const [id, c] of next.clips) {
        const prev = old.clips.get(id);
        if (!prev)
            continue;
        const a = clipValues(prev), b = clipValues(c), fields = Object.keys(b).filter(k => !equal(a[k as keyof typeof a], b[k as keyof typeof b])).sort(ascii);
        if (fields.length)
            report.clipFields.push({ id, fields });
        const cleared = fields.filter(k => Object.hasOwn(CLIP_DEFAULTS, k) && equal(b[k as keyof typeof b], CLIP_DEFAULTS[k as keyof typeof CLIP_DEFAULTS]));
        if (cleared.length)
            report.clearedDefaults.push({ id, fields: cleared });
    }
    for (const id of new Set([...old.overlays.keys(), ...next.overlays.keys()])) {
        const a = old.overlays.get(id), b = next.overlays.get(id);
        if (!equal(a ?? null, b ?? null))
            report.overlayChanges.push({ id, from: a?.state ?? null, to: b?.state ?? null });
    }
    report.added.sort(ascii);
    report.removed.sort(ascii);
    for (const key of ['changedFields', 'clipFields', 'clearedDefaults', 'overlayChanges'] as const)
        report[key].sort((a, b) => ascii(a.id, b.id));
    return { document, report };
}
export function applyPatch(baseInput: StateDocument, patchInput: Patch): Materialized {
    return applyPatchTo(validate(baseInput), patchInput);
}
/** `applyPatch` on a base that `validate` already normalized. The base is not changed. */
export function applyPatchTo(base: Document, patchInput: Patch): Materialized {
    const patch = validate(patchInput);
    if (base.kind === 'patch' || patch.kind !== 'patch')
        fail('R09', '$', 'expected a full base and sparse patch');
    guard(base, patch);
    const result = cloneJson(base) as StateDocument;
    result.kind = 'desired';
    delete result.base;
    const index = indexState(result);
    for (const id of patch.remove) {
        if (!index.events.delete(id))
            fail('R09', '$.remove', `missing event ${id}`);
    }
    for (const u of patch.update) {
        const e = index.events.get(u.id);
        if (!e)
            fail('R09', '$.update', `missing event ${u.id}`);
        for (const [k, v] of Object.entries(u.set))
            if (v === null)
                delete (e as any)[k];
            else
                (e as any)[k] = v;
    }
    for (const e of patch.add) {
        if (index.events.has(e.id))
            fail('R09', '$.add', `existing event ${e.id}`);
        index.events.set(e.id, e);
    }
    for (const u of patch.clipUpdate) {
        const c = index.clips.get(u.id);
        if (!c)
            fail('R09', '$.clipUpdate', `missing clip ${u.id}`);
        for (const [k, v] of Object.entries(u.set))
            if (v === null)
                delete (c as any)[k];
            else
                (c as any)[k] = v;
    }
    for (const c of result.coverage)
        c.to = index.clips.get(c.clip)!.length;
    for (const id of patch.overlayRemove)
        if (!index.overlays.delete(id))
            fail('R09', '$.overlayRemove', `missing overlay ${id}`);
    for (const o of patch.overlayPut)
        index.overlays.set(o.id, o);
    result.events = [...index.events.values()];
    result.overlays = [...index.overlays.values()];
    return finish(base, result, new Set(patch.overlayPut.map(o => o.id)));
}
export function applyDesired(baseInput: StateDocument, desiredInput: StateDocument): Materialized {
    return applyDesiredTo(validate(baseInput), desiredInput);
}
/** `applyDesired` on a base that `validate` already normalized. The base is not changed. */
export function applyDesiredTo(base: Document, desiredInput: StateDocument): Materialized {
    const desired = validate(desiredInput);
    if (base.kind === 'patch' || desired.kind !== 'desired')
        fail('R09', '$', 'expected full base and desired replacement');
    guard(base, desired);
    const result = cloneJson(desired) as StateDocument;
    delete result.base;
    const prior = indexState(base), explicit = new Set(result.overlays.filter(o => !equal(o, prior.overlays.get(o.id) ?? null)).map(o => o.id));
    return finish(base, result, explicit);
}
