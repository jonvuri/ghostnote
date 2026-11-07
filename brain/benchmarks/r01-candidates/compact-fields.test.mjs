import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { encodeCompactFields as encode, decodeCompactFields as decode } from './compact-fields.mjs';
import { editNote, scaleGroupSpread } from './structured.mjs';
import { fixtures, stressFixtures } from './fixtures.mjs';

const corpus = JSON.parse(readFileSync(new URL(
  '../../../context/evidence/data/r01-candidates/corpus-excerpts.json', import.meta.url)));
const sources = [...fixtures, ...stressFixtures, ...corpus.excerpts.map(f => ({
  id: f.id, family: f.family, meter: f.meter, notes: f.notes,
}))];
for (const fixture of sources) test(`compact FIELDS preserves ${fixture.id}`, () => {
  const before = structuredClone(fixture), text = encode(fixture);
  assert.deepEqual(decode(text), fixture);
  assert.equal(encode(decode(text)), text);
  assert.deepEqual(fixture, before);
});
const simple = () => ({ notes: [
  { id: 'n1', pitch: 60, at: '3/512', duration: '1', velocity: 90 },
  { id: 'n2', pitch: 64, at: '9/512', duration: '7/4', velocity: 84 },
] });

test('minimal notes omit unused optional columns and empty containers', () => {
  assert.equal(encode(simple()), `R01-COMPACT-FIELDS 1
FIELDS id pitch at duration velocity
NOTE n1 60 3/512 1 90
NOTE n2 64 9/512 7/4 84
`);
});
test('nominal timing is adjacent, with original map/note location retained', () => {
  const fixture = simple();
  fixture.musical = { nominal: { n1: { at: '0', duration: '1', division: '1/4' } } };
  fixture.notes[1].nominal = { at: '0', provenance: { kind: 'declared' }, opaque: [true, null] };
  const text = encode(fixture);
  assert.match(text, /FIELDS id pitch at duration velocity nominal.location nominal.at nominal.duration nominal.division nominal.extra/);
  assert.match(text, /NOTE n1 60 3\/512 1 90 map 0 1 1\/4 -/);
  assert.match(text, /NOTE n2 64 9\/512 7\/4 84 note 0 - - \{/);
  assert.deepEqual(decode(text), fixture);
});
test('unknown metadata, quoted IDs, empty maps and unreduced timing survive 20 cycles', () => {
  const fixture = simple();
  fixture.notes[0].id = 'id " with\\\n spaces';
  fixture.notes[0].at = '6/1024';
  fixture.notes[0].duration = '2/2';
  fixture.notes[0].unknown = { text: 'x { [ ] } "\n end', values: [false, null, 0] };
  fixture.notes[0].nominal = { at: '0/2', duration: '1/1', division: '2/8', state: 'stale' };
  fixture.groups = []; fixture.musical = { nominal: {}, provenance: { kind: 'inferred' } };
  fixture.unknownContext = ['a b', { keep: true }];
  let current = fixture;
  for (let i = 0; i < 20; i++) current = decode(encode(current));
  assert.deepEqual(current, fixture);
});
test('special property names remain data without prototype mutation', () => {
  const fixture = simple(); fixture.notes[0].id = '__proto__';
  fixture.musical = { nominal: JSON.parse('{"__proto__":{"at":"0","__proto__":{"keep":true}}}') };
  fixture.notes[0].opaque = JSON.parse('{"__proto__":{"value":1}}');
  assert.deepEqual(decode(encode(fixture)), fixture);
  assert.equal({}.keep, undefined);
});
test('empty fixtures and absence/empty distinctions remain exact', () => {
  for (const fixture of [{ notes: [] }, { notes: [], groups: [] },
    { notes: [], musical: { nominal: {} } },
    { notes: [], groups: [{ id: 'empty', members: [], anchor: '0', spread: {} }] }]) {
    assert.deepEqual(decode(encode(fixture)), fixture);
  }
});
test('field order can change between rows without changing the note values or presentation order', () => {
  const text = `R01-COMPACT-FIELDS 1
FIELDS velocity duration at pitch id
NOTE 90 1 3/512 60 n1
FIELDS id pitch at duration velocity
NOTE n2 64 9/512 7/4 84
`;
  assert.deepEqual(decode(text), simple());
});
test('one-note edits preserve unrelated state and retain interpretation invalidation', () => {
  const fixture = simple();
  fixture.musical = { nominal: { n1: { at: '0' } }, provenance: { kind: 'inferred' } };
  fixture.notes[1].nominal = { at: '0', provenance: { kind: 'declared' } };
  const moved = editNote(decode(encode(fixture)), 'n1', { at: '5/512' }).fixture;
  assert.equal(moved.musical.nominal.n1.state, 'stale');
  assert.deepEqual(moved.notes[1], fixture.notes[1]);
  assert.deepEqual(decode(encode(moved)), moved);
});
test('group arithmetic keeps explicit onsets consistent without changing common delay', () => {
  const fixture = fixtures[2];
  const half = scaleGroupSpread(decode(encode(fixture)), 'c7', '1/2').fixture;
  assert.deepEqual(half.notes.map(n => n.at), ['4099/512', '2051/256', '8211/1024', '8219/1024']);
  assert.equal(half.groups[0].delay, '3/512');
  assert.deepEqual(half.notes.map(n => n.duration), fixture.notes.map(n => n.duration));
  assert.deepEqual(decode(encode(half)), half);
  assert.throws(() => decode(encode(fixture).replace('NOTE b 64 4105/512', 'NOTE b 64 8')), /timing equation mismatch/);
});
test('malformed bindings, duplicate IDs, late context and structural overrides refuse', () => {
  const text = encode(simple());
  const cases = [text.replace('FIELDS id pitch at duration velocity\n', ''),
    text.replace('FIELDS id pitch', 'FIELDS id unknown'),
    text.replace('FIELDS id pitch', 'FIELDS id id'),
    text.replace('NOTE n2', 'NOTE n1'),
    text.replace('NOTE n2', 'CONTEXT {}\nNOTE n2'),
    text.replace('n1 60 3/512 1 90', 'n1 60 3/512 1'),
    text.replace('n1 60 3/512 1 90', 'n1 60 - 1 90'),
    text.replace('n1 60 3/512 1 90', 'n1 60 1/0 1 90'),
    text.replace('duration velocity', 'duration velocity extra')
      .replace('1 90', '1 90 {"at":"0"}').replace('7/4 84', '7/4 84 {}'),
    text.replace('duration velocity', 'duration velocity extra')
      .replace('1 90', '1 90 null').replace('7/4 84', '7/4 84 {}'),
  ];
  for (const input of cases) assert.throws(() => decode(input), /R01|JSON/);
});
test('nominal fields cannot override each other or silently move between locations', () => {
  const one = simple(); one.notes.length = 1;
  one.notes[0].nominal = { at: '0' };
  const text = encode(one);
  for (const input of [text.replace('note 0', '- 0'), text.replace('note 0', 'note -'),
    text.replace('note 0', 'map 0'), text.replace('note 0', 'unknown 0'),
    text.replace('nominal.at\n', 'nominal.at nominal.extra\n').replace('note 0', 'note 0 {"at":"1"}'),
    text.replace('nominal.at\n', 'nominal.at extra\n').replace('note 0', 'note 0 {"nominal":{"at":"1"}}')]) {
    assert.throws(() => decode(input), /R01/);
  }
});
test('group membership and shared nominal context cannot contradict row data', () => {
  const fixture = simple(); fixture.groups = [{ id: 'g', members: ['n1'] }];
  const text = encode(fixture);
  assert.throws(() => decode(text.replace('["g"]', '["missing"]')), /group references disagree/);
  assert.throws(() => decode(text.replace('["g"]', '[]')), /group references disagree/);
  assert.throws(() => decode(text.replace('["g"]', '["g","g"]')), /duplicate/);
  const nominal = simple(); nominal.musical = { nominal: { n1: { at: '0' } } };
  assert.throws(() => decode(encode(nominal).replace('"nominal":{}', '"nominal":{"n1":{"at":"0"}}')), /empty map/);
});
