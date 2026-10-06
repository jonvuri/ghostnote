import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROWS, declared, orders, verdict } from './phase8h3c2-rows-lib.js';
import { verifyOffline } from './phase8h3c2-rows.js';

const DATA = new URL('../../../context/evidence/data/phase8h3c2-rows', import.meta.url).pathname;

test('8h3c2 fixtures: one distinct clip per row, and all six read orders', () => {
  const clips = ROWS.map(declared);
  for (const key of ['beats', 'channel', 'cell', 'pitch'] as const) {
    assert.equal(new Set(clips.map(clip => clip[key])).size, ROWS.length, `${key} is not distinct`);
  }
  assert.equal(new Set(orders().map(order => order.join())).size, 6);
});

test('8h3c2 verdict: a wrong row, wrong content, or changed selection fails', () => {
  const want = declared(1), selection = { trackIndex: 2, slotIndex: 0, mixerTrackIndex: 2 };
  const read = {
    trackId: 't', row: 1, before: selection, after: selection,
    reply: { batches: 1, duplicates: 0, afterClose: 0, bound: { channelId: 't', row: 1, loopEndBeats: want.beats } },
    rows: [{ channel: want.channel, cell: want.cell, pitch: want.pitch }],
  };
  assert.equal(verdict(read).pass, true);
  const stuck = { ...read, rows: [], reply: { refused: 'bound-target-mismatch', bound: { channelId: 't', row: 0, loopEndBeats: 4 } } };
  assert.deepEqual(verdict(stuck).issues, ['refused bound-target-mismatch', 'bound row 0', 'content row 0']);
  assert.equal(verdict({ ...read, rows: [{ channel: 0, cell: 0, pitch: 60 }] }).pass, false);
  assert.equal(verdict({ ...read, after: { ...selection, slotIndex: 1 } }).pass, false);
});

test('E232 retained artifacts support every claim', async () => {
  const summary = await verifyOffline(DATA);
  assert.equal(summary.repro.reads, 108);
});
