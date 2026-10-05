/** 8h3b replay fetch cost: format decoders, exact comparison, and summaries. Research only. */
import { createHash } from 'node:crypto';
import { percentile } from './phase8h1a-knee-lib.js';
import type { DecodedRow, Wire } from './phase8h2a-replay-lib.js';

export const FETCH_MARKER = '8h3b-fetch-v1';
export const FETCH_FIXTURES = ['one-64', 'n4096-64', 'n16384-512', 'n131072-2048', 'sustain-2048'] as const;
export const FORMATS = ['rows', 'columns', 'ints', 'packed', 'packedDict'] as const;
export type Format = typeof FORMATS[number];
/** The host defaults that the omitted fields take (E227 `one-64`). The extension uses the same values. */
export const DEFAULTS = { gain: 0, chance: 1, chanceEnabled: true, muted: false } as const;
export const BASELINE_PAGE = 16_384;
export const ALL = 1 << 22;

/** One fetch variant: a format, a page size, and whether the extension encoded it off the controller thread. */
export interface Variant { name: string; format: Format; limit: number; prepared: boolean }
export const VARIANTS: readonly Variant[] = [
  { name: 'rows-16k', format: 'rows', limit: BASELINE_PAGE, prepared: false },
  { name: 'rows-64k', format: 'rows', limit: 65_536, prepared: false },
  { name: 'rows-all', format: 'rows', limit: ALL, prepared: false },
  ...FORMATS.filter(f => f !== 'rows').map(format => ({ name: `${format}-16k`, format, limit: BASELINE_PAGE, prepared: false })),
  ...FORMATS.filter(f => f !== 'rows').map(format => ({ name: `${format}-all`, format, limit: ALL, prepared: false })),
  ...FORMATS.map(format => ({ name: `${format}-prepared`, format, limit: ALL, prepared: true })),
];
export const BASELINE = 'rows-16k';
/** A different variant order in each trial, so that no variant always runs first after the bind. */
export const rotation = (trial: number): Variant[] => VARIANTS.map((_, i) => VARIANTS[(i + trial) % VARIANTS.length]!);

const NUMBER_FIELDS = ['channel', 'cell', 'pitch', 'durationCells'] as const;
const DOUBLE_FIELDS = ['velocity', 'gain', 'chance'] as const;
const FLAG_FIELDS = ['chanceEnabled', 'muted'] as const;
type Field = typeof NUMBER_FIELDS[number] | typeof DOUBLE_FIELDS[number] | typeof FLAG_FIELDS[number];
type Column = ArrayLike<number>;

const SIZE: Record<string, number> = { f64: 8, i32: 4, u16: 2, u8: 1 };
function packedColumns(page: Wire, size: number): Map<Field, Column> {
  const bytes = Buffer.from(String(page.data), 'base64');
  // A copy at offset 0 keeps every typed column aligned. The extension orders sections from the widest type.
  const buffer = new Uint8Array(bytes).buffer, columns = new Map<Field, Column>();
  let offset = 0;
  for (const [name, type] of page.sections as [Field, string][]) {
    const view = type === 'f64' ? new Float64Array(buffer, offset, size) : type === 'i32' ? new Int32Array(buffer, offset, size)
      : type === 'u16' ? new Uint16Array(buffer, offset, size) : new Uint8Array(buffer, offset, size);
    columns.set(name, view); offset += size * SIZE[type]!;
  }
  if (offset !== buffer.byteLength) throw new Error(`packed block holds ${buffer.byteLength} bytes for ${offset}`);
  return columns;
}

/** Decode one page of any format to the rows of the 8h2a format. */
export function decodePage(page: Wire): DecodedRow[] {
  if (page.format === 'rows') return page.rows as DecodedRow[];
  const size = Number(page.size), packed = String(page.format).startsWith('packed');
  const columns = packed ? packedColumns(page, size) : new Map<Field, Column>();
  if (!packed) for (const name of [...NUMBER_FIELDS, ...DOUBLE_FIELDS, ...FLAG_FIELDS]) if (page[name] !== undefined) columns.set(name, page[name] as number[]);
  const tables = (page.tables ?? {}) as Record<string, number[]>;
  const omitted = new Set(page.omitted as string[]);
  for (const name of NUMBER_FIELDS) if (!columns.has(name)) throw new Error(`page has no ${name} column`);
  for (const name of [...DOUBLE_FIELDS, ...FLAG_FIELDS]) if (!columns.has(name) && !omitted.has(name)) throw new Error(`page has no ${name} column`);
  const value = (name: typeof DOUBLE_FIELDS[number], i: number): number => {
    const column = columns.get(name);
    if (column === undefined) return DEFAULTS[name as 'gain' | 'chance'];
    const table = tables[name];
    return table === undefined ? column[i]! : table[column[i]!]!;
  };
  const flag = (name: typeof FLAG_FIELDS[number], i: number): boolean => {
    const column = columns.get(name);
    return column === undefined ? DEFAULTS[name] : column[i] === 1;
  };
  const [channel, cell, pitch, duration] = NUMBER_FIELDS.map(name => columns.get(name)!);
  const rows: DecodedRow[] = new Array(size);
  for (let i = 0; i < size; i++) {
    rows[i] = [channel![i]!, cell![i]!, pitch![i]!, value('velocity', i), duration![i]!, value('gain', i), value('chance', i),
      flag('chanceEnabled', i), flag('muted', i)];
  }
  return rows;
}

/**
 * A bit-exact digest of decoded rows: every field of every row, in order, as float64 bytes. Flags are 1 or 0.
 * Two decodes are exact copies when their digests are equal.
 */
export function rowsDigest(rows: readonly DecodedRow[]): string {
  const values = new Float64Array(rows.length * 9);
  rows.forEach((row, i) => { for (let f = 0; f < 9; f++) values[i * 9 + f] = typeof row[f] === 'boolean' ? (row[f] ? 1 : 0) : row[f] as number; });
  return createHash('sha256').update(new Uint8Array(values.buffer)).digest('hex');
}

/** One received page with brain and extension times. Extension times come from the bridge timing sink. */
export interface PageRecord {
  id: string; sentMs: number; firstByteMs: number; receivedMs: number; bytes: number; chunks: number;
  parseMs: number; decodeMs: number; encodeMs: number; size: number;
  bridge?: { queuedMs: number; dispatchMs: number; serializeMs: number; writeMs: number; chars: number };
}
export interface PingRecord { id: string; sentMs: number; rttMs: number; queuedMs?: number }

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);
const median = (values: number[]): number => percentile(values, 0.5);

/** Summarize one variant fetch. The controller time of a page is dispatch, serialize, and write. */
export function fetchCost(pages: readonly PageRecord[], pings: readonly PingRecord[]): Wire {
  const first = pages[0]!, last = pages[pages.length - 1]!;
  const controller = pages.map(p => p.bridge === undefined ? NaN : p.bridge.dispatchMs + p.bridge.serializeMs + p.bridge.writeMs);
  const gaps = pages.slice(1).map((p, i) => p.sentMs - pages[i]!.receivedMs);
  const end = last.receivedMs + last.parseMs + last.decodeMs;
  const during = pings.filter(p => p.sentMs + p.rttMs >= first.sentMs && p.sentMs <= end);
  const queued = during.map(p => p.queuedMs).filter((v): v is number => v !== undefined);
  return {
    pages: pages.length, notes: sum(pages.map(p => p.size)), bytes: sum(pages.map(p => p.bytes)), frames: pages.length,
    chunks: sum(pages.map(p => p.chunks)),
    wallMs: end - first.sentMs,
    encodeMs: sum(pages.map(p => p.encodeMs)),
    serializeMs: sum(pages.map(p => p.bridge?.serializeMs ?? NaN)), writeMs: sum(pages.map(p => p.bridge?.writeMs ?? NaN)),
    controllerMs: sum(controller), maxPageControllerMs: Math.max(...controller),
    receiptMs: sum(pages.map(p => p.receivedMs - p.sentMs)), transferMs: sum(pages.map(p => p.receivedMs - p.firstByteMs)),
    parseMs: sum(pages.map(p => p.parseMs)), decodeMs: sum(pages.map(p => p.decodeMs)),
    gapMs: sum(gaps), pings: during.length, maxPingMs: during.length ? Math.max(...during.map(p => p.rttMs)) : null,
    maxPingQueuedMs: queued.length ? Math.max(...queued) : null,
  };
}

const COST_KEYS = ['wallMs', 'totalMs', 'encodeMs', 'serializeMs', 'writeMs', 'controllerMs', 'maxPageControllerMs', 'receiptMs',
  'transferMs', 'parseMs', 'decodeMs', 'gapMs', 'maxPingMs', 'maxPingQueuedMs', 'prepareMs'] as const;

/**
 * Median, p95, and maximum of each cost over the trials, for each fixture and variant. Only exact fetches
 * count. The total is the D30 close time plus the fetch; a prepared variant adds its own encode time.
 */
export function summarize(trials: readonly Wire[]): Wire {
  const groups = new Map<string, Wire[]>();
  for (const trial of trials) for (const fetch of trial.fetches as Wire[]) {
    const key = `${String(trial.fixture)}|${String(fetch.variant)}`;
    groups.set(key, [...groups.get(key) ?? [], { ...(fetch.cost as Wire), exact: fetch.exact, closeMs: trial.closeMs, prepareMs: fetch.prepareMs }]);
  }
  const out: Wire = {};
  for (const [key, rows] of groups) {
    const [fixture, variant] = key.split('|') as [string, string];
    const exact = rows.filter(row => row.exact === true);
    const stats: Wire = { trials: rows.length, exact: exact.length, bytes: exact[0]?.bytes ?? null, pages: exact[0]?.pages ?? null };
    for (const name of COST_KEYS) {
      const values = exact.map(row => name === 'totalMs'
        ? Number(row.closeMs) + Number(row.wallMs) + (row.prepareMs === undefined ? 0 : Number(row.prepareMs))
        : row[name] === null || row[name] === undefined ? NaN : Number(row[name])).filter(Number.isFinite);
      if (values.length) stats[name] = { median: round(median(values)), p95: round(percentile(values, 0.95)), max: round(Math.max(...values)) };
    }
    ((out[fixture] ??= {}) as Wire)[variant] = stats;
  }
  return out;
}
const round = (value: number): number => Math.round(value * 100) / 100;
