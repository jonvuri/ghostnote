import assert from 'node:assert/strict';
import test from 'node:test';
import { BASELINE, VARIANTS, decodePage, fetchCost, rotation, rowsDigest, summarize, type PageRecord } from './phase8h3b-fetch-lib.js';
import type { DecodedRow, Wire } from './phase8h2a-replay-lib.js';

const rows: DecodedRow[] = [
  [0, 0, 60, 100 / 127, 4, 0.5, 0.24, true, false],
  [3, 512, 61, 64 / 127, 64, 0, 1, false, true],
  [15, 4_194_303, 127, 100 / 127, 1, 0.5, 0.74, true, false],
];
const column = (f: number): number[] => rows.map(row => typeof row[f] === 'boolean' ? (row[f] ? 1 : 0) : row[f] as number);
const base = { count: 3, from: 0, size: 3, next: -1, epoch: 1 };

/** Build a packed block in the extension layout: sections in order, little-endian, widest type first. */
function packed(sections: [string, string, number[]][]): string {
  const parts = sections.map(([, type, values]) => {
    const size = { f64: 8, i32: 4, u16: 2, u8: 1 }[type]!, buffer = Buffer.alloc(values.length * size);
    values.forEach((v, i) => { if (type === 'f64') buffer.writeDoubleLE(v, i * 8); else if (type === 'i32') buffer.writeInt32LE(v, i * 4);
      else if (type === 'u16') buffer.writeUInt16LE(v, i * 2); else buffer.writeUInt8(v, i); });
    return buffer;
  });
  return Buffer.concat(parts).toString('base64');
}

test('8h3b: every format decodes to the same rows, bit for bit', () => {
  const reference = rowsDigest(rows);
  const pages: Wire[] = [
    { ...base, format: 'rows', rows },
    { ...base, format: 'columns', omitted: [], channel: column(0), cell: column(1), pitch: column(2), velocity: column(3),
      durationCells: column(4), gain: column(5), chance: column(6), chanceEnabled: column(7), muted: column(8) },
    { ...base, format: 'ints', omitted: [], channel: column(0), cell: column(1), pitch: column(2), durationCells: column(4),
      velocity: [0, 1, 0], gain: [0, 1, 0], chance: column(6), chanceEnabled: column(7), muted: column(8),
      tables: { velocity: [100 / 127, 64 / 127], gain: [0.5, 0] } },
    { ...base, format: 'packed', omitted: [], sections: [['velocity', 'f64'], ['gain', 'f64'], ['chance', 'f64'], ['cell', 'i32'],
      ['durationCells', 'i32'], ['channel', 'u8'], ['pitch', 'u8'], ['chanceEnabled', 'u8'], ['muted', 'u8']],
      data: packed([['velocity', 'f64', column(3)], ['gain', 'f64', column(5)], ['chance', 'f64', column(6)], ['cell', 'i32', column(1)],
        ['durationCells', 'i32', column(4)], ['channel', 'u8', column(0)], ['pitch', 'u8', column(2)], ['chanceEnabled', 'u8', column(7)],
        ['muted', 'u8', column(8)]]) },
    { ...base, format: 'packedDict', omitted: [], tables: { velocity: [100 / 127, 64 / 127], chance: [0.24, 1, 0.74] },
      sections: [['gain', 'f64'], ['cell', 'i32'], ['durationCells', 'i32'], ['chance', 'u16'], ['channel', 'u8'], ['pitch', 'u8'],
        ['velocity', 'u8'], ['chanceEnabled', 'u8'], ['muted', 'u8']],
      data: packed([['gain', 'f64', column(5)], ['cell', 'i32', column(1)], ['durationCells', 'i32', column(4)], ['chance', 'u16', [0, 1, 2]],
        ['channel', 'u8', column(0)], ['pitch', 'u8', column(2)], ['velocity', 'u8', [0, 1, 0]], ['chanceEnabled', 'u8', column(7)],
        ['muted', 'u8', column(8)]]) },
  ];
  for (const page of pages) assert.equal(rowsDigest(decodePage(page)), reference, String(page.format));
});

test('8h3b: omitted fields take the host defaults; a missing column is an error', () => {
  const one: Wire = { ...base, size: 1, format: 'columns', omitted: ['gain', 'chance', 'chanceEnabled', 'muted'],
    channel: [0], cell: [0], pitch: [60], velocity: [100 / 127], durationCells: [4] };
  assert.deepEqual(decodePage(one), [[0, 0, 60, 100 / 127, 4, 0, 1, true, false]]);
  assert.throws(() => decodePage({ ...one, omitted: ['gain'] }), /no chance column/);
  const bad: Wire = { ...base, size: 1, format: 'packed', omitted: [], sections: [['cell', 'i32']], data: Buffer.alloc(8).toString('base64') };
  assert.throws(() => decodePage(bad), /packed block/);
});

test('8h3b: a digest separates every field, also negative zero', () => {
  const changed = rows.map(row => [...row] as DecodedRow);
  changed[2]![8] = true;
  assert.notEqual(rowsDigest(changed), rowsDigest(rows));
  assert.notEqual(rowsDigest([[0, 0, 0, -0, 1, 0, 1, true, false]]), rowsDigest([[0, 0, 0, 0, 1, 0, 1, true, false]]));
});

test('8h3b: rotation covers each variant once in each trial', () => {
  assert(VARIANTS.some(v => v.name === BASELINE));
  for (const trial of [0, 1, 7]) assert.deepEqual(new Set(rotation(trial).map(v => v.name)).size, VARIANTS.length);
  assert.notEqual(rotation(0)[0]!.name, rotation(1)[0]!.name);
});

test('8h3b: fetch cost separates controller, transfer, parse, and ping delay', () => {
  const page = (id: string, sent: number, size: number): PageRecord => ({ id, sentMs: sent, firstByteMs: sent + 10, receivedMs: sent + 15,
    bytes: 100, chunks: 2, parseMs: 1, decodeMs: 0.5, encodeMs: 4, size, bridge: { queuedMs: 0.1, dispatchMs: 5, serializeMs: 3, writeMs: 1, chars: 99 } });
  const cost = fetchCost([page('f1', 0, 2), page('f2', 20, 1)], [{ id: 'p1', sentMs: 1, rttMs: 9, queuedMs: 8 }, { id: 'p2', sentMs: 100, rttMs: 1 }]);
  assert.equal(cost.wallMs, 36.5); assert.equal(cost.controllerMs, 18); assert.equal(cost.maxPageControllerMs, 9);
  assert.equal(cost.transferMs, 10); assert.equal(cost.gapMs, 5); assert.equal(cost.notes, 3); assert.equal(cost.pings, 1);
  assert.equal(cost.maxPingQueuedMs, 8);
  const summary = summarize([{ fixture: 'x', closeMs: 50, fetches: [{ variant: BASELINE, exact: true, cost }, { variant: 'rows-all', exact: false, cost }] }]);
  assert.equal(((summary.x as Wire)[BASELINE] as Wire).exact, 1);
  assert.deepEqual((((summary.x as Wire)[BASELINE] as Wire).totalMs as Wire).median, 86.5);
  assert.equal(((summary.x as Wire)['rows-all'] as Wire).wallMs, undefined);
});
