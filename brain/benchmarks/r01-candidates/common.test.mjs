import test from 'node:test';
import assert from 'node:assert/strict';
import * as gn from '../../src/document/index.ts';
import { normalize, equivalence, correspondence, document, documentNotes, command, view, retrieve, patchBetween, canonical } from './common.mjs';
import { fixtures, stressFixtures } from './fixtures.mjs';
import { claimedDocument } from './claims-control.mjs';
const note = (id, at = '0', duration = '1') => ({ id, pitch: 60, at, duration, velocity: 90 });

test('independent normalization goldens, ties, promotion and negative coordinates', () => {
  assert.deepEqual(normalize(note('a', '1/3', '1/3')), note('a', '85/256', '171/512'));
  assert.deepEqual(normalize(note('a', '341/512', '3/1024')), note('a', '341/512', '1/256'));
  assert.equal(normalize(note('a', '-1/1024', '1/4096')).at, '-1/512');
  assert.equal(normalize(note('a', '0', '1/4096')).duration, '1/512');
  assert.throws(() => normalize(note('a', '0', '0')));
  // Product is checked against the independent oracle, never used to construct it.
  for (let cell = 0; cell < 512; cell++) {
    const source = note('a', `${cell * 3 + 1}/1536`, `${cell * 2 + 1}/1024`);
    const expected = normalize(source), actual = gn.normalizeTiming(source.at, source.duration);
    assert.equal(actual.at, expected.at); assert.equal(actual.duration, expected.duration);
  }
});
test('multiset equality is order/ID independent but preserves duplicates and every field', () => {
  const a = [note('a'), note('b')];
  assert(equivalence(a, [note('d'), note('c')]).equal);
  assert(!equivalence(a, [note('d')]).equal);
  assert(!equivalence([note('a')], [{ ...note('a'), channel: 2 }]).equal);
  assert(!equivalence([note('a')], [{ ...note('a'), releaseVelocity: 0.4 }]).equal);
  assert(equivalence([note('a')], [{ ...note('b'), channel: 1 }]).equal);
});
test('correspondence does not invent lineage for duplicates or moves', () => {
  assert.equal(correspondence([note('a'), note('b')], [note('x'), note('y')]).ambiguous.length, 2);
  assert.equal(correspondence([note('a')], [note('a', '1')]).matches.length, 0);
  assert.deepEqual(correspondence([note('a')], [note('a', '1')], true).matches, [{ before: 'a', after: 'a', changed: true }]);
});
test('shared backend preserves expression/channels and refuses stale or unknown targets', () => {
  const doc = document(fixtures[3]), base = gn.contentHash(doc);
  const result = command(doc, { base, op: 'transpose', select: { ids: ['u1'] }, semitones: 1 });
  assert.equal(result.document.events.find(n => n.id === 'u1').pitch, 62);
  for (const n of doc.events) assert.equal(canonical(result.document.events.find(x => x.id === n.id)), canonical(n.id === 'u1' ? { ...n, pitch: 62 } : n));
  assert.throws(() => command(result.document, { base, op: 'velocity', select: { ids: ['u1'] }, value: 99 }), /stale/);
  assert.throws(() => command(doc, { base, op: 'remove', select: { ids: ['absent'] } }), /unknown/);
  assert.throws(() => command(doc, { base, op: 'remove', select: { ids: ['u1'] }, accidental: true }), /unknown/);
});
test('view omissions are retrievable under the same guard; reordering does not retarget', () => {
  const doc = document(fixtures[0]);
  const summary = view(doc, { ids: ['push', 'kick'] }, ['pitch', 'at']);
  assert(summary.omittedFields.includes('velocity'));
  assert(retrieve(doc, summary.base, ['push'], ['velocity']).notes[0].velocity === 102);
  const changed = command(doc, { base: summary.base, op: 'velocity', select: { ids: ['kick'] }, value: 109 }).document;
  assert.throws(() => retrieve(changed, summary.base, ['push'], ['velocity']), /stale/);
});
test('admission refusals stay distinct from equivalence and count-changing commands', () => {
  for (const f of stressFixtures.slice(0, 3)) assert.throws(() => document(f));
  const doc = document(fixtures[0]), base = gn.contentHash(doc);
  const added = command(doc, { base, op: 'add', notes: [note('new', '7/2')] });
  assert.equal(added.document.events.length, doc.events.length + 1);
  const removed = command(added.document, { base: gn.contentHash(added.document), op: 'remove', select: { ids: ['new'] } });
  assert(equivalence(documentNotes(doc), documentNotes(removed.document)).equal);
  assert.throws(() => command(doc, { base, op: 'add', notes: [note('kick', '4')] }));
});
test('small edit in 1024 notes, half-open selection, ordinary-code control and independent readback', () => {
  const doc = document(stressFixtures[3]), base = gn.contentHash(doc);
  const result = command(doc, { base, op: 'velocity', select: { from: '128', to: '513/4' }, value: 101 });
  assert.equal(result.patch.update.length, 1); assert.equal(result.patch.update[0].id, 'n512');
  const coded = structuredClone(doc); coded.events.find(n => n.id === 'n512').velocity = 101;
  assert.deepEqual(gn.applyPatch(doc, patchBetween(doc, coded)).document, result.document);
  const changedClip = structuredClone(coded); changedClip.clips[0].name = 'unrequested';
  assert.throws(() => patchBetween(doc, changedClip), /cannot change clip/);
  const readback = gn.parse(gn.serialize(result.document, 'fields'), 'fields');
  assert.equal(readback.events.filter(n => n.velocity === 101).length, 1);
  for (const n of doc.events) if (n.id !== 'n512') assert.deepEqual(readback.events.find(x => x.id === n.id), n);
});
test('commands carry unrelated claims and stale dependent claims through the real patch backend', () => {
  const doc = claimedDocument(fixtures[1], 'timing-rich'), base = gn.contentHash(doc);
  const velocity = command(doc, { base, op: 'velocity', select: { ids: ['b1'] }, value: 100 }).document;
  assert.equal(canonical(velocity.overlays), canonical(doc.overlays));
  const shifted = command(doc, { base, op: 'shift', select: { ids: ['b1'] }, by: '1/512' }).document;
  assert.deepEqual(shifted.overlays.filter(o => o.state === 'stale').map(o => o.id).sort(), ['groove-b1', 'group-triplet', 'nom-b1']);
  assert.equal(shifted.overlays.find(o => o.id === 'nom-b2').state, 'current');
  assert.equal(gn.validate(shifted).events.find(n => n.id === 'b1').at, '1/512');
});
