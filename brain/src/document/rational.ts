import { fail } from './error.js';
import { LIMITS } from './model.js';
export interface Rational {
    n: bigint;
    d: bigint;
}
/** The first magnitude with more than LIMITS.bits binary digits. */
const BIT_LIMIT = 1n << BigInt(LIMITS.bits);
export function boundedInteger(n: bigint, path = '$'): bigint {
    if (n >= BIT_LIMIT || -n >= BIT_LIMIT)
        fail('R28', path, 'arithmetic exceeds 4096 bits');
    return n;
}
function gcd(a: bigint, b: bigint): bigint {
    a = a < 0n ? -a : a;
    while (b)
        [a, b] = [b, a % b];
    return a;
}
export function fraction(n: bigint, d = 1n): Rational {
    boundedInteger(n);
    boundedInteger(d);
    if (d === 0n)
        fail('R05', '$', 'zero denominator');
    if (d < 0n) {
        n = -n;
        d = -d;
    }
    const g = gcd(n, d);
    return { n: n / g, d: d / g };
}
/** Parsed rational text. The values are frozen; the cache is cleared when it is full. */
const PARSED = new Map<string, Rational>();
const PARSED_MAX = 1 << 16;
export function rational(value: unknown, path = '$'): Rational {
    const known = typeof value === 'string' ? PARSED.get(value) : undefined;
    if (known !== undefined)
        return known;
    const parsed = Object.freeze(parseRational(value, path));
    if (PARSED.size >= PARSED_MAX)
        PARSED.clear();
    PARSED.set(value as string, parsed);
    return parsed;
}
function parseRational(value: unknown, path: string): Rational {
    if (typeof value !== 'string' || !/^-?(0|[1-9][0-9]*)(\/[1-9][0-9]*)?$/.test(value))
        fail('R05', path, 'expected exact rational text');
    const [n, d = '1'] = value.split('/');
    if (n.replace('-', '').length > LIMITS.rationalDigits || d.length > LIMITS.rationalDigits)
        fail('R28', path, 'rational exceeds 96 digits');
    return fraction(BigInt(n), BigInt(d));
}
export function spelling(r: Rational, path = '$'): string {
    if ((r.n < 0n ? -r.n : r.n).toString().length > LIMITS.rationalDigits || r.d.toString().length > LIMITS.rationalDigits)
        fail('R28', path, 'output rational exceeds 96 digits');
    return r.d === 1n ? `${r.n}` : `${r.n}/${r.d}`;
}
export function add(a: Rational, b: Rational): Rational {
    return fraction(boundedInteger(boundedInteger(a.n * b.d) + boundedInteger(b.n * a.d)), boundedInteger(a.d * b.d));
}
export function sub(a: Rational, b: Rational): Rational {
    return add(a, { n: -b.n, d: b.d });
}
export function compare(a: Rational, b: Rational): number {
    const x = boundedInteger(a.n * b.d), y = boundedInteger(b.n * a.d);
    return x < y ? -1 : x > y ? 1 : 0;
}
export const ZERO = fraction(0n);
export function cmp(a: string, b: string): number {
    return compare(rational(a), rational(b));
}
export function sum(...values: string[]): string {
    return spelling(values.map(v => rational(v)).reduce(add, ZERO));
}
export function difference(a: string, b: string): string {
    return spelling(sub(rational(a), rational(b)));
}
export function onGrid(value: string): boolean {
    const r = rational(value);
    return boundedInteger(r.n * 512n) % r.d === 0n;
}
/** Decode binary64 bits before acquisition normalization. */
export function binary64(value: number): Rational {
    if (!Number.isFinite(value))
        fail('R07', '$source', 'host timing must be finite');
    const b = new DataView(new ArrayBuffer(8));
    b.setFloat64(0, value, false);
    const bits = b.getBigUint64(0, false), exponent = Number((bits >> 52n) & 2047n);
    let n = bits & ((1n << 52n) - 1n);
    if (exponent)
        n += 1n << 52n;
    if (bits >> 63n)
        n = -n;
    const shift = exponent ? exponent - 1023 - 52 : -1074;
    return shift >= 0 ? fraction(n << BigInt(shift)) : fraction(n, 1n << BigInt(-shift));
}
export function normalizeTiming(at: string | number, duration: string | number) {
    const s = typeof at === 'number' ? binary64(at) : rational(at, '$source.at');
    const d = typeof duration === 'number' ? binary64(duration) : rational(duration, '$source.duration');
    if (s.n < 0n || d.n <= 0n)
        fail('R07', '$source', 'onset must be nonnegative and duration positive');
    const onset = fraction(boundedInteger(s.n * 512n) / s.d, 512n);
    const rounded = boundedInteger(boundedInteger(d.n * 1024n) + d.d) / boundedInteger(d.d * 2n);
    const length = fraction(rounded < 1n ? 1n : rounded, 512n);
    return { sourceAt: spelling(s), sourceDuration: spelling(d), at: spelling(onset), duration: spelling(length), atDelta: spelling(sub(onset, s)), durationDelta: spelling(sub(length, d)), minimumDurationPromotion: rounded < 1n };
}
