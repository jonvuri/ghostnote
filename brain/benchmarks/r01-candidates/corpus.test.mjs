import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decodeSource, excerptFrom, hash, validateSplits } from './corpus.mjs';
import { writeSmf, metaEvent } from '../../src/midi/smf.ts';
import { fraction, spelling } from '../../src/document/rational.ts';

const fixture = JSON.parse(await readFile(new URL('../../../context/evidence/data/r01-candidates/corpus-excerpts.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('../../../context/evidence/data/r01-candidates/corpus-manifest.json', import.meta.url), 'utf8'));
const spellingTicks = (tick, ppq) => spelling(fraction(BigInt(tick), BigInt(ppq)));

test('retained excerpts reconstruct every selected source note exactly, including tails', () => {
  assert.equal(fixture.manifestHash, hash(JSON.stringify(manifest)));
  assert.equal(fixture.excerpts.length, 4);
  let tails = 0;
  for (const excerpt of fixture.excerpts) {
    assert.equal(excerpt.notes.length, excerpt.sourceEventDetails.length);
    for (const [i, note] of excerpt.notes.entries()) {
      const detail = excerpt.sourceEventDetails[i];
      assert.equal(detail.id, note.id);
      assert.equal(note.at, spellingTicks(detail.startTick - excerpt.extraction.startTick, excerpt.source.ticksPerQuarter));
      assert.equal(note.duration, spellingTicks(detail.endTick - detail.startTick, excerpt.source.ticksPerQuarter));
      assert.ok(detail.startTick >= excerpt.extraction.startTick && detail.startTick < excerpt.extraction.endTickExclusive);
      if (detail.endTick > excerpt.extraction.endTickExclusive) tails++;
    }
  }
  assert.equal(tails, 3);
});

test('development and reserved assets have disjoint known lineages', () => {
  validateSplits(manifest);
  const overlapping = structuredClone(manifest);
  const development = overlapping.groups.find(group => group.split === 'development');
  const reserved = overlapping.groups.find(group => group.split === 'reserved');
  reserved.sourceRefs.push(development.sourceRefs[0]);
  assert.throws(() => validateSplits(overlapping), /lineage overlap/);
  const reservedRead = structuredClone(manifest);
  reservedRead.groups.find(group => group.shardId === reservedRead.sources[0].shardId).split = 'reserved';
  assert.throws(() => validateSplits(reservedRead), /reserved work/);
});

const source = {
  id: 'synthetic-test', family: 'test', assetId: 'test', contentHash: 'test',
  midi: { timeOrigin: 'clip' }, resolution: { timing: 'baked', sourceSecondsAtTickZero: 0 },
  selection: { widthQuarterBeats: 1, maxNotes: 10 },
};
const note = (id, startTick, endTick) => ({ id, startTick, endTick, pitch: 60, channel: 1, velocity: 64, trackIndex: 0, noteOff: { status: 128, dataVelocity: 23 } });
const decoded = notes => ({ ppq: 9600, notes, tempoMap: [{ tick: 0, microsecondsPerQuarter: 500000 }], meterMap: [], tempoIsImplicit: true, overlappingNoteOns: 0, otherEvents: {} });

test('half-open selection preserves full tails and refuses oversized selections', () => {
  const result = excerptFrom(source, decoded([note('a', 100, 15000), note('b', 9700, 9800)]));
  assert.equal(result.notes.length, 1);
  assert.equal(result.notes[0].duration, '149/96');
  assert.equal(result.extraction.fullTailEndTick, 15000);
  assert.equal(result.metrics.tailsBeyondWindow, 1);
  assert.throws(() => excerptFrom({ ...source, selection: { ...source.selection, maxNotes: 0 } }, decoded([note('a', 100, 15000)])), /do not truncate/);
});

test('normalization collisions preserve multiplicity and mark host admission refused', () => {
  const result = excerptFrom(source, decoded([note('a', 100, 200), note('b', 101, 201)]));
  assert.equal(result.notes.length, 2);
  assert.deepEqual(result.metrics.normalizedAddressCollisions[0].ids, ['a', 'b']);
  assert.match(result.limitations.hostAdmission, /refused/);
});

function midi(events) {
  return writeSmf([[...events, { tick: 100, priority: 99, bytes: metaEvent(0x2f, Buffer.alloc(0)) }]], 9600);
}
function sourceFor(bytes, noteCount = 1) {
  return { assetId: 'test', contentHash: hash(bytes), midi: { ticksPerQuarter: 9600, noteCount, endTick: 100, tempoMap: [{ tick: 0, microsecondsPerQuarter: 500000 }], tempoIsImplicit: true } };
}
test('decoder keeps release event metadata and refuses hash mismatch and ambiguous truncation', () => {
  const bytes = midi([{ tick: 0, priority: 0, bytes: Buffer.from([0x90, 60, 64]) }, { tick: 50, priority: 0, bytes: Buffer.from([0x80, 60, 23]) }]);
  const result = decodeSource(bytes, sourceFor(bytes));
  assert.deepEqual(result.notes[0].noteOff, { status: 128, dataVelocity: 23 });
  assert.throws(() => decodeSource(bytes, { ...sourceFor(bytes), contentHash: 'sha256:changed' }), /hash mismatch/);
  const unclosed = midi([{ tick: 0, priority: 0, bytes: Buffer.from([0x90, 60, 64]) }]);
  assert.throws(() => decodeSource(unclosed, sourceFor(unclosed)), /unclosed notes/);
  const zero = midi([{ tick: 0, priority: 0, bytes: Buffer.from([0x90, 60, 64]) }, { tick: 0, priority: 1, bytes: Buffer.from([0x80, 60, 0]) }]);
  assert.throws(() => decodeSource(zero, sourceFor(zero)), /Zero or negative/);
});
