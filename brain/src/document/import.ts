import { fail, DocumentError } from './error.js';
import { type Event, LIMITS } from './model.js';
import { validateEventStructure, validateId } from './structure.js';
import { cloneJson } from './json.js';
import { ascii, eventRules } from './semantic.js';
import { cmp, normalizeTiming, sum, spelling, fraction } from './rational.js';
export type SourceNote = Omit<Event, 'at' | 'duration'> & {
    at: string | number;
    duration: string | number;
};
export interface ImportReport {
    boundary: 'explicit-source-notes';
    notes: (ReturnType<typeof normalizeTiming> & {
        id: string;
    })[];
    changedOverlaps: {
        ids: [
            string,
            string
        ];
        before: boolean;
        after: boolean;
        beforeSpan: {
            from: string;
            to: string;
        } | null;
        afterSpan: {
            from: string;
            to: string;
        } | null;
    }[];
    collisionGroups: {
        clip: string;
        channel: number;
        pitch: number;
        at: string;
        ids: string[];
    }[];
    codecLoss: 0;
}
export class ImportCollisionError extends DocumentError {
    constructor(readonly report: ImportReport) {
        super('R07', '$import.collisionGroups', 'normalized addresses collide; no notes were materialized');
        this.name = 'ImportCollisionError';
    }
}
/** Compare overlap intervals within each clip. */
function overlaps(notes: {
    id: string;
    clip: string;
    channel?: number;
    pitch: number;
    at: string;
    duration: string;
}[]): Map<string, {
    ids: [
        string,
        string
    ];
    from: string;
    to: string;
}> {
    const groups = new Map<string, typeof notes>();
    for (const n of notes) {
        const key = n.clip;
        const group = groups.get(key) ?? [];
        group.push(n);
        groups.set(key, group);
    }
    const pairs = new Map<string, {
        ids: [
            string,
            string
        ];
        from: string;
        to: string;
    }>();
    for (const group of groups.values()) {
        group.sort((a, b) => cmp(a.at, b.at) || ascii(a.id, b.id));
        const active: typeof group = [];
        for (const n of group) {
            for (let i = active.length - 1; i >= 0; i--) {
                const prev = active[i];
                if (cmp(sum(prev.at, prev.duration), n.at) <= 0) {
                    active.splice(i, 1);
                    continue;
                }
                const ids = [prev.id, n.id].sort(ascii) as [
                    string,
                    string
                ];
                const end = sum(prev.at, prev.duration), nextEnd = sum(n.at, n.duration);
                pairs.set(ids.join('\0'), { ids, from: n.at, to: cmp(end, nextEnd) < 0 ? end : nextEnd });
                if (pairs.size > LIMITS.events)
                    fail('R28', '$import.changedOverlaps', 'overlap report exceeds bounded pair count');
            }
            active.push(n);
        }
    }
    return pairs;
}
export function importNotes(source: SourceNote[]): {
    events: Event[];
    report: ImportReport;
} {
    if (source.length > LIMITS.events)
        fail('R28', '$import', 'too many source notes');
    const ids = new Set<string>(), report: ImportReport = { boundary: 'explicit-source-notes', notes: [], changedOverlaps: [], collisionGroups: [], codecLoss: 0 };
    const events: Event[] = [], groups = new Map<string, Event[]>();
    for (const n of source) {
        if (ids.has(n.id))
            fail('R07', '$import.id', `duplicate source ID ${n.id}`);
        ids.add(n.id);
        const timing = normalizeTiming(n.at, n.duration);
        report.notes.push({ id: n.id, ...timing });
        const e = cloneJson({ ...n, at: timing.at, duration: timing.duration }) as Event;
        validateEventStructure(e);
        eventRules(e, '$import');
        events.push(e);
        const key = `${e.clip}\0${e.channel ?? 1}\0${e.pitch}\0${e.at}`, group = groups.get(key) ?? [];
        group.push(e);
        groups.set(key, group);
    }
    const before = overlaps(source.map((n, i) => ({ ...n, at: report.notes[i].sourceAt, duration: report.notes[i].sourceDuration }))), after = overlaps(events);
    for (const key of new Set([...before.keys(), ...after.keys()])) {
        const a = before.get(key), b = after.get(key);
        if (a?.from !== b?.from || a?.to !== b?.to)
            report.changedOverlaps.push({ ids: (a ?? b)!.ids, before: !!a, after: !!b, beforeSpan: a ? { from: a.from, to: a.to } : null, afterSpan: b ? { from: b.from, to: b.to } : null });
    }
    for (const group of groups.values())
        if (group.length > 1) {
            const e = group[0];
            report.collisionGroups.push({ clip: e.clip, channel: e.channel ?? 1, pitch: e.pitch, at: e.at, ids: group.map(n => n.id).sort(ascii) });
        }
    if (report.collisionGroups.length)
        throw new ImportCollisionError(report);
    return { events, report };
}
/** Label acquired cells. Source multiplicity stays unknown. */
export function observeCells(cells: {
    id: string;
    cell: bigint;
    duration: string | number;
}[]) {
    if (cells.length > LIMITS.events)
        fail('R28', '$cells', 'too many acquired cells');
    const ids = new Set<string>();
    for (const n of cells) {
        validateId(n.id, '$cells.id');
        if (ids.has(n.id))
            fail('R07', '$cells.id', 'duplicate acquired ID');
        ids.add(n.id);
        if (typeof n.cell !== 'bigint')
            fail('R07', '$cells.cell', 'exact cell must be a bigint');
    }
    return { boundary: 'D23-host-cell-observation' as const, sourceIdsRecovered: false as const, collisionCount: null,
        notes: cells.map(n => {
            if (n.cell < 0n)
                fail('R07', '$cell', 'cell index must be nonnegative');
            const at = spelling(fraction(n.cell, 512n)), timing = normalizeTiming('0', n.duration);
            return { id: n.id, at, duration: timing.duration, sourceAt: null, atDelta: null, durationDelta: timing.durationDelta };
        }) };
}
