import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { encodeNestedFields as encode, decodeNestedFields as decode } from './nested-fields.mjs';
import { editNote, scaleGroupSpread } from './structured.mjs';
import { fixtures, stressFixtures } from './fixtures.mjs';

const corpus = JSON.parse(readFileSync(new URL(
  '../../../context/evidence/data/r01-candidates/corpus-excerpts.json', import.meta.url)));
const sources = [...fixtures, ...stressFixtures, ...corpus.excerpts.map(f => ({
  id: f.id, family: f.family, meter: f.meter, notes: f.notes,
}))];
for (const fixture of sources) test(`nested FIELDS preserves ${fixture.id}`, () => {
  const before = structuredClone(fixture), text = encode(fixture);
  assert.deepEqual(decode(text), fixture);
  assert.equal(encode(decode(text)), text);
  assert.deepEqual(fixture, before);
});
const simple = () => ({ notes: [
  { id: 'n1', pitch: 60, at: '3/512', duration: '1', velocity: 90 },
  { id: 'n2', pitch: 64, at: '9/512', duration: '1', velocity: 84 },
], groups: [{ id: 'g1', anchor: '0', delay: '3/512',
  members: ['n1', 'n2'], spread: { n1: '0', n2: '6/512' } }] });

test('simple grouped example contains the only note definitions and timing refinements', () => {
  assert.equal(encode(simple()), `R01-GROUPED-FIELDS 1
GROUP g1 anchor=0 delay=3/512 {
  FIELDS id pitch duration velocity spread
  NOTE n1 60 1 90 0
  NOTE n2 64 1 84 6/512
}
`);
});
test('partial timing, overlapping groups, forward references and original note order survive', () => {
  const fixture = simple();
  fixture.notes.reverse();
  fixture.groups.unshift({ id: 'phrase', members: ['n2', 'n1'], label: 'answer' });
  delete fixture.groups[1].spread.n2;
  const text = encode(fixture);
  assert.match(text, /REF n1/);
  assert.equal(text.match(/NOTE n1 /g).length, 1);
  assert.deepEqual(decode(text), fixture);
});
test('unreduced timing, nominal context, quoted IDs and opaque JSON stay exact over cycles', () => {
  const fixture = simple();
  fixture.notes[0].at = '6/1024';
  fixture.notes[0].expression = { pressure: 0.3, unknown: ['a } { b', null, false] };
  fixture.notes[0].nominal = { at: '0', provenance: { kind: 'declared' } };
  const id = 'quoted " id\\\n';
  fixture.notes[1].id = id;
  fixture.groups[0].members[1] = id;
  fixture.groups[0].spread[id] = fixture.groups[0].spread.n2;
  delete fixture.groups[0].spread.n2;
  fixture.groups[0].prose = 'quoted " braces { and }\nline';
  fixture.groups[0].metadata = { names: ['one two', 'three'], bool: true };
  fixture.musical = { nominal: { [id]: { at: '0' } }, provenance: { kind: 'declared' } };
  let current = fixture;
  for (let i = 0; i < 20; i++) current = decode(encode(current));
  assert.deepEqual(current, fixture);
});
test('missing and empty groups, spread and nominal maps remain distinct', () => {
  for (const fixture of [{ notes: [] }, { notes: [], groups: [] },
    { notes: [], groups: [{ id: 'empty', members: [], anchor: '0', spread: {} }] },
    { notes: [], musical: { nominal: {} } }]) assert.deepEqual(decode(encode(fixture)), fixture);
});
test('special map keys remain data without prototype mutation', () => {
  const fixture = simple();
  fixture.notes[0].id = '__proto__'; fixture.groups[0].members[0] = '__proto__';
  fixture.groups[0].spread = JSON.parse('{"__proto__":"0","n2":"6/512"}');
  fixture.musical = { nominal: JSON.parse('{"__proto__":{"at":"0"}}') };
  assert.deepEqual(decode(encode(fixture)), fixture);
  assert.equal({}.at, undefined);
});
test('halving nested spread preserves shared delay, durations and exact fractional cells', () => {
  const fixture = fixtures[2];
  const result = scaleGroupSpread(decode(encode(fixture)), 'c7', '1/2').fixture;
  assert.deepEqual(result.notes.map(n => n.at), ['4099/512', '2051/256', '8211/1024', '8219/1024']);
  assert.equal(result.groups[0].delay, '3/512');
  assert.deepEqual(result.notes.map(n => n.duration), fixture.notes.map(n => n.duration));
  assert.deepEqual(decode(encode(result)), result);
});
test('individual edit retains unrelated note state and existing interpretation lifecycle', () => {
  const fixture = simple();
  fixture.groups[0].provenance = { kind: 'inferred' };
  const next = editNote(decode(encode(fixture)), 'n2', { pitch: 65 }).fixture;
  assert.equal(next.groups[0].state, 'stale');
  assert.deepEqual(next.notes[0], fixture.notes[0]);
  assert.deepEqual(decode(encode(next)), next);
});
test('invalid scopes, references, redefinitions and timing conflicts refuse', () => {
  const text = encode(simple());
  const bad = [
    text.replace('  FIELDS id pitch duration velocity spread\n', ''),
    text.replace('velocity spread', 'velocity spread pitch'),
    text.replace('NOTE n2', 'NOTE n1'),
    text.replace('  NOTE n2 64 1 84 6/512', '  REF missing'),
    text.replace('anchor=0 ', ''),
    text.replace('velocity spread', 'velocity at spread')
      .replace('90 0', '90 0 0').replace('84 6/512', '84 0 6/512'),
    text.replace('velocity spread', 'velocity extra spread')
      .replace('90 0', '90 {"pitch":70} 0').replace('84 6/512', '84 {} 6/512'),
    text.replace('GROUP g1 ', 'GROUP g1 anchor=2 '),
    text.slice(0, -2),
    text + 'NOTES {\n  NOTE orphan 60 1 90 0\n}\n',
    text.replace('  NOTE n2', '  GROUP child {\n  NOTE n2'),
  ];
  for (const input of bad) assert.throws(() => decode(input), /R01|JSON/);
});
test('partial order, contradictory spelling and sidecar nominal maps refuse', () => {
  const text = encode(simple());
  const withOrder = text.replace('velocity spread', 'velocity spread order')
    .replace('90 0', '90 0 0').replace('84 6/512', '84 6/512 -');
  assert.throws(() => decode(withOrder), /permutation/);
  const withSpelling = text.replace('velocity spread', 'velocity spread spelling')
    .replace('90 0', '90 0 99').replace('84 6/512', '84 6/512 -');
  assert.throws(() => decode(withSpelling), /spelling disagrees/);
  assert.throws(() => decode(text.replace('GROUP g1',
    'CONTEXT {"musical":{"nominal":{"n1":{"at":"0"}}}}\nGROUP g1')), /nominal/);
});
