/** Ghostnote Document 1.0 native I/O types. Timing stays exact text. */
export type RationalText = string;
export type Json = null | boolean | number | string | Json[] | {
    [key: string]: Json;
};
export interface Expression {
    velocitySpread: number;
    gain: number;
    pan: number;
    pressure: number;
    timbre: number;
    transpose: number;
}
export interface Event {
    id: string;
    clip: string;
    at: RationalText;
    duration: RationalText;
    pitch: number;
    velocity: number;
    channel?: number;
    mute?: boolean;
    releaseVelocity?: number;
    articulation?: string;
    expression?: Expression;
    chance?: {
        enabled: boolean;
        value: number;
    };
    occurrence?: {
        enabled: boolean;
        condition: string;
    };
    recurrence?: {
        enabled: boolean;
        length: number;
        mask: number;
    };
    repeat?: {
        enabled: boolean;
        count: number;
        curve: number;
        velocityCurve: number;
        velocityEnd: number;
    };
}
export type EventField = keyof Event;
export type EditableEventField = Exclude<EventField, 'id' | 'clip'>;
export type EventSet = {
    [K in EditableEventField]?: Event[K] | (K extends 'at' | 'duration' | 'pitch' | 'velocity' ? never : null);
};
export interface Range {
    from: RationalText;
    to: RationalText;
}
export interface Clip {
    id: string;
    length: RationalText;
    name?: string;
    loop?: Range | null;
    playRange?: Range | null;
}
export type ClipSet = {
    length?: RationalText;
    name?: string | null;
    loop?: Range | null;
    playRange?: Range | null;
};
export interface Coverage {
    clip: string;
    from: RationalText;
    to: RationalText;
    channels: number[];
    fields: 'all' | EventField[];
    status: 'complete' | 'partial' | 'unavailable';
    reason?: string;
}
export interface Depends {
    events: {
        id: string;
        fields: EventField[];
    }[];
    clips: {
        id: string;
        fields: (keyof Clip)[];
    }[];
    overlays: string[];
    membership: string[];
}
export interface Provenance {
    kind: 'declared' | 'measured' | 'inferred';
    source: string;
    method: string;
    confidence?: number;
}
export interface Nominal {
    event: string;
    at: RationalText;
    duration: RationalText;
    division: RationalText;
}
export interface Groove {
    event: string;
    nominal: string;
    intent: 'resolved' | 'unresolved';
    phase: RationalText;
    template: RationalText;
    cross: RationalText;
    local: RationalText;
    unassigned: RationalText;
    durationIntent: RationalText;
    durationUnassigned: RationalText;
    atDelta: RationalText | null;
    durationDelta: RationalText | null;
    sourceAt?: RationalText;
    sourceDuration?: RationalText;
    templateRef?: string;
    swing?: [
        number,
        number
    ];
    shape?: {
        kind: 'point';
    } | {
        kind: 'span';
        width: RationalText;
    };
    anchor?: string;
}
export interface Group {
    clip: string;
    events: string[];
}
export interface OverlayData {
    nominal: Nominal;
    groove: Groove;
    harmony: Group & Range & {
        chord?: string;
        key?: string;
    };
    role: Group & {
        label: string;
        articulation?: string;
    };
    motif: Group & {
        label: string;
        articulation?: string;
    };
    meter: {
        clip: string;
        at: RationalText;
        numerator: number;
        denominator: number;
    };
    tempo: {
        clip: string;
        at: RationalText;
        bpm: number;
    };
    region: Group & Range & {
        label: string;
    };
}
export type Overlay = {
    [K in keyof OverlayData]: {
        id: string;
        type: K;
        state: 'current' | 'stale';
        provenance: Provenance;
        depends: Depends;
        basis: string;
        data: OverlayData[K];
    };
}[keyof OverlayData];
export interface Envelope {
    format: 'ghostnote-document';
    version: '1.0';
    meta?: {
        title?: string;
        description?: string;
        permission?: string;
    };
    base?: {
        sha256: string;
        ref?: string;
    };
    extensions?: {
        [key: string]: Json;
    };
}
export interface StateDocument extends Envelope {
    kind: 'snapshot' | 'desired';
    clips: Clip[];
    coverage: Coverage[];
    events: Event[];
    overlays: Overlay[];
}
export interface Patch extends Envelope {
    kind: 'patch';
    base: {
        sha256: string;
        ref?: string;
    };
    add: Event[];
    remove: string[];
    update: {
        id: string;
        set: EventSet;
    }[];
    clipUpdate: {
        id: string;
        set: ClipSet;
    }[];
    overlayPut: Overlay[];
    overlayRemove: string[];
}
export type Document = StateDocument | Patch;
export const EVENT_FIELDS: EventField[] = ['id', 'clip', 'at', 'duration', 'pitch', 'velocity', 'channel', 'mute', 'releaseVelocity', 'articulation', 'expression', 'chance', 'occurrence', 'recurrence', 'repeat'];
export const REQUIRED_FIELDS: EventField[] = ['id', 'clip', 'at', 'duration', 'pitch', 'velocity'];
export const BINDING: EventField[] = [...REQUIRED_FIELDS, 'channel', 'mute'];
export const EVENT_DEFAULTS = {
    channel: 1, mute: false, releaseVelocity: 0.5, articulation: 'normal',
    expression: { velocitySpread: 0, gain: 1, pan: 0, pressure: 0, timbre: 0.5, transpose: 0 },
    chance: { enabled: false, value: 1 }, occurrence: { enabled: false, condition: 'always' },
    recurrence: { enabled: false, length: 1, mask: 1 },
    repeat: { enabled: false, count: 1, curve: 0, velocityCurve: 0, velocityEnd: 1 },
} satisfies Partial<Event>;
export const CLIP_DEFAULTS = { name: '', loop: null, playRange: null };
export const LIMITS = { bytes: 8 * 1024 * 1024, clips: 256, events: 131072, overlays: 32768, patchEntries: 131072, depth: 32, string: 4096, rationalDigits: 96, bits: 4096, dependencies: 1024, fieldReferences: 262144 } as const;
