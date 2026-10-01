import { DocumentError, fail } from './error.js';
import { LIMITS } from './model.js';
export function scalarText(text: string, path: string): void {
    let count = 0;
    for (const c of text) {
        const n = c.codePointAt(0)!;
        if (n >= 0xd800 && n <= 0xdfff)
            fail('R11', path, 'unpaired Unicode surrogate');
        if (++count > LIMITS.string)
            fail('R28', path, 'string exceeds 4096 scalars');
    }
}
export function decodeInput(input: string | Uint8Array): string {
    if (typeof input === 'string') {
        if (Buffer.byteLength(input) > LIMITS.bytes)
            fail('R28', '$', 'input exceeds 8 MiB');
        // Check surrogate pairs before UTF-8 encoding can replace them.
        for (const c of input) {
            const n = c.codePointAt(0)!;
            if (n >= 0xd800 && n <= 0xdfff)
                fail('R11', '$', 'unpaired Unicode surrogate');
        }
        if (input.charCodeAt(0) === 0xfeff)
            fail('R11', '$', 'BOM is forbidden');
        return input;
    }
    if (input.byteLength > LIMITS.bytes)
        fail('R28', '$', 'input exceeds 8 MiB');
    if (input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf)
        fail('R11', '$', 'BOM is forbidden');
    try {
        return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(input);
    }
    catch {
        return fail('R11', '$', 'invalid UTF-8');
    }
}
export interface JsonSource {
    value: unknown;
    locations: Map<string, number>;
}
/** Parse strict JSON and keep paths before duplicate keys can be lost. */
export function readJson(text: string): JsonSource {
    let i = 0;
    const locations = new Map<string, number>();
    const ws = () => {
        while (/[ \t\r\n]/.test(text[i] ?? '\0'))
            i++;
    };
    function error(path: string, reason: string, rule = 'R11'): never {
        const prefix = text.slice(0, i), line = prefix.split('\n').length;
        throw new DocumentError(rule, path, reason, { line, column: i - (prefix.lastIndexOf('\n') + 1) + 1 });
    }
    function str(path: string): string {
        const start = i++;
        let closed = false;
        while (i < text.length) {
            const c = text[i++];
            if (c === '"') {
                closed = true;
                break;
            }
            if (c === '\\') {
                i++;
            }
            else if (c.charCodeAt(0) < 32)
                error(path, 'unescaped control character');
        }
        if (!closed)
            error(path, 'unterminated string');
        let value: string;
        try {
            value = JSON.parse(text.slice(start, i));
        }
        catch {
            return error(path, 'invalid JSON string');
        }
        scalarText(value, path);
        return value;
    }
    function value(path: string, depth: number): unknown {
        ws();
        locations.set(path, i);
        const c = text[i];
        if (c === '"')
            return str(path);
        if (c === '{' || c === '[') {
            if (depth > LIMITS.depth)
                error(path, 'JSON nesting exceeds 32 containers', 'R28');
            i++;
            ws();
            if (c === '[') {
                const out: unknown[] = [];
                if (text[i] === ']') {
                    i++;
                    return out;
                }
                while (true) {
                    out.push(value(`${path}[${out.length}]`, depth + 1));
                    ws();
                    if (text[i] === ']') {
                        i++;
                        return out;
                    }
                    if (text[i++] !== ',')
                        error(path, 'expected comma or closing bracket');
                }
            }
            const out: Record<string, unknown> = Object.create(null);
            if (text[i] === '}') {
                i++;
                return out;
            }
            while (true) {
                ws();
                if (text[i] !== '"')
                    error(path, 'expected object key');
                const key = str(path), child = `${path}.${key}`;
                if (Object.hasOwn(out, key))
                    error(child, 'duplicate JSON key');
                ws();
                if (text[i++] !== ':')
                    error(child, 'expected colon');
                out[key] = value(child, depth + 1);
                ws();
                if (text[i] === '}') {
                    i++;
                    return out;
                }
                if (text[i++] !== ',')
                    error(path, 'expected comma or closing brace');
            }
        }
        for (const [word, v] of [['true', true], ['false', false], ['null', null]] as const)
            if (text.startsWith(word, i)) {
                i += word.length;
                return v;
            }
        const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(i));
        if (!match)
            error(path, 'expected JSON value');
        i += match[0].length;
        const n = Number(match[0]);
        if (!Number.isFinite(n))
            error(path, 'numeric overflow', 'R29');
        return Object.is(n, -0) ? 0 : n;
    }
    const result = value('$', 1);
    ws();
    if (i !== text.length)
        error('$', 'extra text after JSON');
    return { value: result, locations };
}
/** Reject native data that JSON serialization would drop or alter. */
export function cloneJson(input: unknown, path = '$', depth = 1, ancestors = new Set<object>(), budget = { bytes: 0, max: LIMITS.bytes as number }): any {
    const charge = (n: number) => {
        budget.bytes += n;
        if (budget.bytes > budget.max)
            fail('R28', path, 'native JSON input exceeds 8 MiB');
    };
    if (input === null || typeof input === 'boolean') {
        charge(input === null || input === true ? 4 : 5);
        return input;
    }
    if (typeof input === 'string') {
        scalarText(input, path);
        charge(Buffer.byteLength(JSON.stringify(input)));
        return input;
    }
    if (typeof input === 'number') {
        if (!Number.isFinite(input))
            fail('R29', path, 'number must be finite');
        charge(JSON.stringify(input).length);
        return Object.is(input, -0) ? 0 : input;
    }
    if (typeof input !== 'object')
        fail('R29', path, 'expected JSON data');
    if (depth > LIMITS.depth)
        fail('R28', path, 'JSON nesting exceeds 32 containers');
    if (ancestors.has(input))
        fail('R29', path, 'cyclic native object');
    ancestors.add(input);
    let out: any;
    if (Array.isArray(input)) {
        for (const key of Reflect.ownKeys(input))
            if (key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= input.length))
                fail('R29', path, 'extra native array property');
        charge(2 + Math.max(0, input.length - 1));
        out = [];
        for (let i = 0; i < input.length; i++) {
            const item = Object.getOwnPropertyDescriptor(input, i);
            if (!item || !('value' in item))
                fail('R29', `${path}[${i}]`, 'array hole or accessor');
            out.push(cloneJson(item.value, `${path}[${i}]`, depth + 1, ancestors, budget));
        }
    }
    else {
        if (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)
            fail('R29', path, 'expected plain JSON object');
        charge(2 + Math.max(0, Object.keys(input).length - 1));
        out = Object.create(null);
        for (const k of Reflect.ownKeys(input)) {
            const property = Object.getOwnPropertyDescriptor(input, k)!;
            if (typeof k !== 'string' || !property.enumerable || !('value' in property))
                fail('R29', path, 'unsupported native key');
            scalarText(k, path);
            charge(Buffer.byteLength(JSON.stringify(k)) + 1);
            out[k] = cloneJson(property.value, `${path}.${k}`, depth + 1, ancestors, budget);
        }
    }
    ancestors.delete(input);
    return out;
}
export function scalarCompare(a: string, b: string): number {
    const x = Array.from(a, c => c.codePointAt(0)!), y = Array.from(b, c => c.codePointAt(0)!);
    for (let i = 0; i < Math.min(x.length, y.length); i++)
        if (x[i] !== y[i])
            return x[i] - y[i];
    return x.length - y.length;
}
/** Write keys directly. JSON.stringify reorders integer-like object keys. */
export function canonicalJson(value: any): string {
    if (Array.isArray(value))
        return '[' + value.map(canonicalJson).join(',') + ']';
    if (value !== null && typeof value === 'object')
        return '{' + Object.keys(value).sort(scalarCompare).map(k => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
    return JSON.stringify(value);
}
