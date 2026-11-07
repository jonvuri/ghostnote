import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeCompact, decodeCompact, encodeGrouped, decodeGrouped, editNote, scaleGroupSpread, validateStructuredFixture } from './structured.mjs';

const chord = () => ({
  meter: [4, 4], musical: { provider: 'authored-example', nominal: { b: { at: '8', duration: '7/4' } } },
  notes: [
    { id: 'b', pitch: 64, at: '4105/512', duration: '7/4', velocity: 84, channel: 2, mute: true, expression: { pressure: 0.3 } },
    { id: 'a', pitch: 60, at: '4099/512', duration: '2', velocity: 90, chance: { enabled: true, value: 0.5 } },
    { id: 'free', pitch: 67, at: '125/13', duration: '2/7', velocity: 81, opaque: ['preserve', { raw: true }] },
  ],
  groups: [
    { id: 'c7', members: ['a', 'b'], label: 'C major fragment', prose: 'Arrive late, then open upward.', provenance: { kind: 'declared', source: 'fixture' }, anchor: '8', delay: '3/512', spread: { a: '0', b: '6/512' }, presentationOrder: ['b', 'a'], performanceOrder: ['a', 'b'] },
    { id: 'phrase', members: ['b', 'free'], label: 'answer', provenance: { kind: 'inferred', source: 'analysis' } },
  ],
});

for (const [name, encode, decode] of [['compact', encodeCompact, decodeCompact], ['grouped', encodeGrouped, decodeGrouped]]) {
  test(`${name}: preserves every field, ordering, overlap and unknown intent`, () => {
    const fixture = chord(), before = structuredClone(fixture);
    assert.deepEqual(decode(encode(fixture)), fixture);
    assert.deepEqual(decode(JSON.stringify(encode(fixture))), fixture);
    assert.deepEqual(fixture, before);
  });
  test(`${name}: repeated cycles preserve exact non-grid and unreduced timing`, () => {
    const fixture = chord(); fixture.notes[0].at = '8210/1024';
    let next = fixture;
    for (let i = 0; i < 20; i++) next = decode(encode(next));
    assert.deepEqual(next, fixture);
  });
  test(`${name}: duplicate note definition and contradictory timing are refused`, () => {
    const fixture = chord(); fixture.notes.push({ ...fixture.notes[0] });
    assert.throws(() => encode(fixture), /duplicate note definition/);
    fixture.notes.pop(); fixture.notes[0].at = '8';
    assert.throws(() => encode(fixture), /timing equation mismatch/);
  });
  test(`${name}: imported pickup stays exact and has direct fallback`, () => {
    const fixture = { notes: [{ id: 'p', pitch: 62, at: '-1/3', duration: '1/7', velocity: 70 }] };
    assert.deepEqual(decode(encode(fixture)), fixture);
  });
}

test('grouped timing is derived once and irregular notes remain direct', () => {
  const surface = encodeGrouped(chord());
  assert.deepEqual(surface.rows[0].time, { group: 'c7' });
  assert.equal(Object.hasOwn(surface.rows[0].note, 'at'), false);
  assert.equal(surface.rows[2].time, null);
  assert.equal(surface.rows[2].note.at, '125/13');
});
test('labels and prose never infer timing or a transform', () => {
  const fixture = chord();
  assert.throws(() => scaleGroupSpread(fixture, 'phrase', '1/2'), /explicit anchor and spread/);
  assert.equal(encodeGrouped(fixture).rows[2].time, null);
});
test('one-note pitch edit preserves performance and stales only inferred dependent labels', () => {
  const fixture = chord(), { fixture: next, changes } = editNote(fixture, 'b', { pitch: 65 });
  assert.equal(next.notes[0].pitch, 65);
  assert.equal(next.notes[0].at, '4105/512');
  assert.equal(next.groups[0].state, undefined);
  assert.equal(next.groups[1].state, 'stale');
  assert.deepEqual(changes.notes, [{ id: 'b', fields: ['pitch'] }]);
  assert.deepEqual(decodeGrouped(encodeGrouped(next)), next);
  assert.equal(fixture.notes[0].pitch, 64);
});
test('one-note onset edit reconciles residual while retaining anchor/common delay', () => {
  const { fixture } = editNote(chord(), 'b', { at: '4109/512' });
  assert.equal(fixture.groups[0].spread.b, '5/256');
  assert.equal(fixture.groups[0].anchor, '8');
  assert.equal(fixture.groups[0].delay, '3/512');
  assert.equal(fixture.notes[0].duration, '7/4');
  assert.deepEqual(decodeGrouped(encodeGrouped(fixture)), fixture);
});
test('halving spread golden result retains common lateness, duration and unrelated fields', () => {
  const original = chord(), { fixture, changes } = scaleGroupSpread(original, 'c7', '1/2');
  assert.equal(fixture.notes[0].at, '2051/256'); // 8 + (3 + 3)/512
  assert.equal(fixture.notes[1].at, '4099/512');
  assert.equal(fixture.groups[0].spread.b, '3/512');
  assert.equal(fixture.groups[0].delay, '3/512');
  const expected = structuredClone(original.notes); expected[0].at = '2051/256';
  assert.deepEqual(fixture.notes, expected);
  assert.deepEqual(changes.notes, [{ id: 'b', fields: ['at'] }]);
  assert.deepEqual(decodeGrouped(encodeGrouped(fixture)), fixture);
});
test('fractional cell scaling remains exact until external realization', () => {
  const fixture = chord();
  fixture.groups[0].spread.b = '1/512'; fixture.notes[0].at = '1025/128';
  const { fixture: next } = scaleGroupSpread(fixture, 'c7', '1/2');
  assert.equal(next.groups[0].spread.b, '1/1024');
  assert.equal(next.notes[0].at, '8199/1024');
});
test('stale or ambiguous groups and invalid references are refused', () => {
  const fixture = chord(); fixture.groups[0].state = 'stale';
  assert.throws(() => scaleGroupSpread(fixture, 'c7', '1/2'), /stale/);
  delete fixture.groups[0].state;
  fixture.groups.push({ ...structuredClone(fixture.groups[0]), id: 'duplicate-owner' });
  assert.throws(() => validateStructuredFixture(fixture), /ambiguous timing owner/);
  fixture.groups.pop(); fixture.groups[0].members.push('missing');
  assert.throws(() => validateStructuredFixture(fixture), /unknown group member/);
});
test('presentation and performance orders are independent validated permutations', () => {
  const fixture = chord(); fixture.groups[0].performanceOrder = ['b', 'a'];
  assert.deepEqual(decodeGrouped(encodeGrouped(fixture)).notes, fixture.notes);
  fixture.groups[0].presentationOrder = ['a', 'a'];
  assert.throws(() => encodeGrouped(fixture), /duplicate/);
});
test('compact membership cannot contradict group definition', () => {
  const surface = encodeCompact(chord()); surface.rows[0][6] = ['c7'];
  assert.throws(() => decodeCompact(surface), /disagree/);
});
test('grouped explicit onset cannot override derived timing', () => {
  const surface = encodeGrouped(chord()); surface.rows[0].note.at = '9';
  assert.throws(() => decodeGrouped(surface), /conflicting/);
  delete surface.rows[0].note.at; surface.rows[0].time.spelling = '9';
  assert.throws(() => decodeGrouped(surface), /disagrees/);
});
test('unknown targets, missing fields, invalid values, and invalid factors refuse without mutation', () => {
  const fixture = chord(), before = structuredClone(fixture);
  assert.throws(() => editNote(fixture, 'missing', { pitch: 61 }), /unknown note/);
  assert.throws(() => editNote(fixture, 'b', { id: 'x' }), /without id/);
  assert.throws(() => editNote(fixture, 'b', { duration: '0' }), /positive/);
  assert.throws(() => editNote(fixture, 'b', { pitch: 128 }), /MIDI/);
  assert.throws(() => editNote(fixture, 'b', { velocity: NaN }), /finite/);
  assert.throws(() => scaleGroupSpread(fixture, 'c7', '-1'), /nonnegative/);
  assert.deepEqual(fixture, before);
});
test('compact nominal entries move beside notes and shared provenance remains shared', () => {
  const fixture = chord(); fixture.musical.provenance = { kind: 'declared', source: 'composer' };
  const surface = encodeCompact(fixture);
  assert.deepEqual(surface.context.musical.nominal, {});
  assert.deepEqual(surface.rows[0][7], { at: '8', duration: '7/4' });
  assert.equal(surface.rows[1][7], null);
  assert.deepEqual(decodeCompact(surface), fixture);
});
test('inferred nominal timing stales through direct and group edits; declared intent remains', () => {
  const fixture = chord(); fixture.musical.provenance = { kind: 'inferred', source: 'grid-fit' };
  const pitch = editNote(fixture, 'b', { pitch: 65 }).fixture;
  assert.equal(pitch.musical.nominal.b.state, undefined);
  const moved = editNote(fixture, 'b', { at: '4109/512' });
  assert.equal(moved.fixture.musical.nominal.b.state, 'stale');
  assert.deepEqual(moved.changes.nominal, [{ id: 'b', fields: ['state'] }]);
  assert.equal(scaleGroupSpread(fixture, 'c7', '1/2').fixture.musical.nominal.b.state, 'stale');
  fixture.musical.nominal.b.provenance = { kind: 'declared', source: 'composer' };
  assert.equal(editNote(fixture, 'b', { duration: '1' }).fixture.musical.nominal.b.state, undefined);
  fixture.notes[2].nominal = { at: '9', provenance: { kind: 'inferred' } };
  assert.equal(editNote(fixture, 'free', { duration: '1' }).fixture.notes[2].nominal.state, 'stale');
});
test('nominal invalid references, contradictory definitions and malformed timing refuse', () => {
  const fixture = chord(); fixture.musical.nominal.missing = { at: '1' };
  assert.throws(() => encodeCompact(fixture), /unknown nominal note/);
  delete fixture.musical.nominal.missing; fixture.notes[0].nominal = { at: '8' };
  assert.throws(() => encodeCompact(fixture), /duplicate nominal definition/);
  delete fixture.notes[0].nominal; fixture.musical.nominal.b.at = '1/0';
  assert.throws(() => encodeCompact(fixture), /invalid rational/);
  fixture.musical.nominal.b.at = '8'; fixture.musical.nominal.b.duration = '-1';
  assert.throws(() => encodeCompact(fixture), /positive/);
});
