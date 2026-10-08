import { schema } from './schema-data.js';
import { DocumentError, fail } from './error.js';
import { canonicalJson, scalarLength } from './json.js';
import { rational, spelling } from './rational.js';
import { LIMITS } from './model.js';
const RULES: Record<string, string> = { id: 'R01', extensions: 'R01', stateDocument: 'R02', patch: 'R08', meta: 'R02', base: 'R02', clip: 'R03', range: 'R03', coverage: 'R03', event: 'R04', eventSet: 'R08', clipSet: 'R08', eventUpdate: 'R08', clipUpdate: 'R08', depends: 'R12', eventDependency: 'R21', clipDependency: 'R21', provenance: 'R12', overlay: 'R12', nominalData: 'R13', grooveData: 'R14', shape: 'R14', harmonyData: 'R17', roleData: 'R18', motifData: 'R18', meterData: 'R19', tempoData: 'R19', regionData: 'R20' };
const TIMING_DEFS = new Set(['rational', 'nonnegative', 'positive']);
const BRANCH_KEYWORDS = ['anyOf', 'oneOf'] as const;
const REF_NAMES = new Map<string, string>();
function refName(ref: string): string {
    let name = REF_NAMES.get(ref);
    if (name === undefined)
        REF_NAMES.set(ref, name = ref.replace('#/$defs/', ''));
    return name;
}
const PATTERNS = new Map<string, RegExp>();
function patternOf(source: string): RegExp {
    let pattern = PATTERNS.get(source);
    if (pattern === undefined)
        PATTERNS.set(source, pattern = new RegExp(source));
    return pattern;
}
/** Execute only the local schema vocabulary. No external resolution is allowed. */
function check(s: any, value: any, path: string, rule: string): void {
    if (s.$ref) {
        const name = refName(s.$ref);
        if (!s.$ref.startsWith('#/$defs/') || !schema.$defs[name])
            fail('R32', path, 'unresolved local schema reference');
        if (TIMING_DEFS.has(name)) {
            const r = rational(value, path);
            if (name === 'nonnegative' && r.n < 0n || name === 'positive' && r.n <= 0n)
                fail('R05', path, 'timing has an invalid sign');
        }
        check(schema.$defs[name], value, path, RULES[name] ?? rule);
    }
    if (s.const !== undefined && value !== s.const)
        fail(path === '$.format' || path === '$.version' ? 'R01' : rule, path, `expected ${JSON.stringify(s.const)}`);
    if (s.enum && !s.enum.includes(value))
        fail(rule, path, 'unknown enum value');
    if (s.type) {
        const ok = s.type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value) : s.type === 'array' ? Array.isArray(value) : s.type === 'null' ? value === null : s.type === 'integer' ? Number.isSafeInteger(value) : typeof value === s.type;
        if (!ok)
            fail(rule, path, `expected ${s.type}`);
    }
    if (typeof value === 'string') {
        const n = scalarLength(value);
        if (s.maxLength !== undefined && n > s.maxLength)
            fail('R28', path, 'string exceeds field limit');
        if (s.minLength !== undefined && n < s.minLength)
            fail(rule, path, 'empty string is forbidden');
        if (s.pattern && !patternOf(s.pattern).test(value))
            fail(rule, path, 'invalid field spelling');
    }
    if (typeof value === 'number') {
        if (s.minimum !== undefined && value < s.minimum || s.maximum !== undefined && value > s.maximum || s.exclusiveMinimum !== undefined && value <= s.exclusiveMinimum)
            fail(rule, path, 'number is outside its range');
    }
    if (Array.isArray(value)) {
        if (s.minItems !== undefined && value.length < s.minItems)
            fail(rule, path, 'too few array entries');
        if (s.maxItems !== undefined && value.length > s.maxItems)
            fail('R28', path, 'too many array entries');
        if (s.uniqueItems) {
            const keys = new Set<string>();
            for (const v of value) {
                const k = canonicalJson(v);
                if (keys.has(k))
                    fail(rule, path, 'duplicate set entry');
                keys.add(k);
            }
        }
        value.forEach((v, i) => {
            const item = s.prefixItems?.[i] ?? s.items;
            if (item === false)
                fail(rule, `${path}[${i}]`, 'surplus array entry');
            if (item && typeof item === 'object')
                check(item, v, `${path}[${i}]`, rule);
        });
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        for (const key of s.required ?? [])
            if (!Object.hasOwn(value, key))
                fail(rule, `${path}.${key}`, 'required field is missing');
        if (s.minProperties !== undefined && Object.keys(value).length < s.minProperties)
            fail(rule, path, 'set must be nonempty');
        for (const key of Object.keys(value)) {
            if (s.propertyNames)
                check(s.propertyNames, key, `${path}.${key}`, rule);
            if (s.properties?.[key])
                check(s.properties[key], value[key], `${path}.${key}`, rule);
            else if (s.additionalProperties === false)
                fail('R01', `${path}.${key}`, 'unknown field');
            else if (s.additionalProperties && typeof s.additionalProperties === 'object')
                check(s.additionalProperties, value[key], `${path}.${key}`, rule);
        }
        if (s.dependentRequired) for (const [key, required] of Object.entries(s.dependentRequired))
            if (Object.hasOwn(value, key))
                for (const other of required as string[])
                    if (!Object.hasOwn(value, other))
                        fail(rule, `${path}.${other}`, 'paired field is missing');
    }
    if (s.allOf) for (const child of s.allOf)
        check(child, value, path, rule);
    for (const keyword of BRANCH_KEYWORDS)
        if (s[keyword]) {
            let successes = 0;
            const errors: DocumentError[] = [];
            for (const child of s[keyword])
                try {
                    check(child, value, path, rule);
                    successes++;
                }
                catch (e) {
                    if (!(e instanceof DocumentError))
                        throw e;
                    errors.push(e);
                }
            if (!successes || keyword === 'oneOf' && successes !== 1) {
                // Prefer the branch with the matching discriminator, then its deepest error.
                const branches = s[keyword] as any[];
                const index = branches.findIndex(b => Object.entries(b.properties ?? {}).some(([key, prop]: [
                    string,
                    any
                ]) => prop.const !== undefined && prop.const === value?.[key]));
                if (index >= 0) {
                    check(branches[index], value, path, rule);
                }
                errors.sort((a, b) => b.path.length - a.path.length);
                if (errors.length)
                    throw errors[0];
                fail(rule, path, 'ambiguous schema branch');
            }
        }
    if (s.if) {
        let matches = true;
        try {
            check(s.if, value, path, rule);
        }
        catch (e) {
            if (!(e instanceof DocumentError))
                throw e;
            matches = false;
        }
        if (matches && s.then)
            check(s.then, value, path, rule);
    }
    if (s.not) {
        let matches = true;
        try {
            check(s.not, value, path, rule);
        }
        catch (e) {
            if (!(e instanceof DocumentError))
                throw e;
            matches = false;
        }
        if (matches)
            fail(rule, path, 'forbidden field combination');
    }
}
export function validateStructure(value: any): void {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        fail('R02', '$', 'expected document object');
    if (value.format !== 'ghostnote-document')
        fail('R01', '$.format', 'unsupported format');
    if (value.version !== '1.0')
        fail('R01', '$.version', 'unsupported version');
    const patch = value.kind === 'patch';
    if (patch) {
        const total = ['add', 'remove', 'update', 'clipUpdate', 'overlayPut', 'overlayRemove'].reduce((n, k) => n + (Array.isArray(value[k]) ? value[k].length : 0), 0);
        if (total > LIMITS.patchEntries)
            fail('R28', '$', 'total patch entries exceed 131072');
    }
    check(schema.$defs[patch ? 'patch' : 'stateDocument'], value, '$', patch ? 'R08' : 'R02');
}
/** Reduce only schema timing values. Inert extensions are not timing fields. */
export function normalizeTimingFields(value: any): void {
    const reduce = (bag: any, keys: string[]) => {
        for (const k of keys)
            if (typeof bag[k] === 'string')
                bag[k] = spelling(rational(bag[k], k));
    };
    const range = (bag: any) => {
        if (bag)
            reduce(bag, ['from', 'to']);
    };
    for (const c of value.clips ?? []) {
        reduce(c, ['length']);
        range(c.loop);
        range(c.playRange);
    }
    for (const c of value.coverage ?? [])
        reduce(c, ['from', 'to']);
    for (const e of value.events ?? value.add ?? [])
        reduce(e, ['at', 'duration']);
    for (const u of value.update ?? [])
        reduce(u.set, ['at', 'duration']);
    for (const u of value.clipUpdate ?? []) {
        reduce(u.set, ['length']);
        range(u.set.loop);
        range(u.set.playRange);
    }
    for (const o of value.overlays ?? value.overlayPut ?? []) {
        reduce(o.data, ['at', 'duration', 'division', 'phase', 'template', 'cross', 'local', 'unassigned', 'durationIntent', 'durationUnassigned', 'atDelta', 'durationDelta', 'sourceAt', 'sourceDuration', 'from', 'to']);
        if (o.data.shape?.kind === 'span')
            reduce(o.data.shape, ['width']);
    }
}
export function validateEventStructure(value: unknown, path = '$import'): void {
    check(schema.$defs.event, value, path, 'R04');
}
export function validateId(value: unknown, path: string): void {
    check(schema.$defs.id, value, path, 'R01');
}
