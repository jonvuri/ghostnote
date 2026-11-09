/** B19 session 4: the pure derivation of a new clip from a source clip document. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { parse, type StateDocument } from '../document/index.js';
import { DeriveRefusal, checkBound, deriveClip } from './launcher-clip-derive.js';

const source = (clip: Record<string, unknown>, rows: string[], fields = 'id clip at duration pitch velocity') =>
  parse(['DOC ghostnote-document 1.0 snapshot', `CLIP ${JSON.stringify({ id: 'c1', length: '8', ...clip })}`,
    'COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"c1","fields":"all","from":"0","status":"complete","to":"8"}',
    `FIELDS ${fields}`, ...rows.map((row) => `EVENT ${row}`)].join('\n') + '\n', 'fields') as StateDocument;

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

test('B19 deriveClip: onsets in [from, to) stay; a note ending exactly at to is not shortened', () => {
  const doc = source({}, ['a c1 0 1 60 100', 'b c1 3 1 62 100', 'c c1 7/2 1 64 100', 'd c1 4 1 65 100']);
  const derived = deriveClip(doc, { from: '1', to: '4' });
  assert.deepEqual(derived.kept, ['b', 'c']);
  assert.deepEqual(derived.shortened, ['c']);
  assert.equal(derived.omitted, 2);
  assert.deepEqual(derived.document.events.map((event) => [event.id, event.at, event.duration]),
    [['b', '2', '1'], ['c', '5/2', '1/2']]);
  assert.equal(derived.document.kind, 'desired');
  assert.equal(derived.document.base, undefined);
});

test('B19 deriveClip: clip defaults expand into each kept note; play range drops; empty name stays absent', () => {
  const doc = source({ defaults: { releaseVelocity: 0 }, playRange: { from: '0', to: '4' }, name: '' },
    ['a c1 0 1 60 100', 'b c1 2 1 62 100']);
  const derived = deriveClip(doc, { from: '2', shift: '1' });
  assert.equal(derived.length, '7');
  assert.deepEqual(derived.document.events.map((event) => [event.id, event.at, event.releaseVelocity]), [['b', '1', 0]]);
  const clip = derived.document.clips[0]!;
  assert.equal(clip.playRange ?? null, null);
  assert.equal(clip.name, undefined);
});

test('B19 deriveClip: a source range narrows only when it spans the source clip; the generator stays', () => {
  const provenance = { sources: [{ path: '/a.mid', range: { from: '16', to: '24' } }, { path: '/b.mid' },
    { path: '/c.mid', range: { from: '0', to: '32' } }], generator: { path: '/make.py' } };
  const derived = deriveClip(source({ provenance }, []), { from: '2', to: '6' });
  assert.deepEqual(derived.narrowedSources, [0]);
  assert.deepEqual(plain(derived.document.clips[0]!.provenance), { ...provenance,
    sources: [{ path: '/a.mid', range: { from: '18', to: '22' } }, { path: '/b.mid' }, { path: '/c.mid', range: { from: '0', to: '32' } }] });
  assert.equal(derived.kept.length, 0, 'an empty slice is a valid empty clip');
  const whole = deriveClip(source({ provenance }, []), {});
  assert.deepEqual(whole.narrowedSources, [], 'the whole clip narrows nothing');
  assert.deepEqual(plain(whole.document.clips[0]!.provenance), provenance);
});

test('B19 deriveClip: bounds are exact nonnegative text on the cell plane, inside the source', () => {
  const doc = source({}, []);
  for (const [field, value] of [['from', '-1'], ['to', '1.5'], ['shift', '1/1024'], ['from', 'x']] as const) {
    assert.throws(() => checkBound(field, value), (error) => error instanceof DeriveRefusal && error.field === field);
  }
  assert.throws(() => deriveClip(doc, { to: '9' }), /after the end of the source clip/);
  assert.throws(() => deriveClip(doc, { from: '3', to: '3' }), /must be after from/);
  assert.equal(deriveClip(doc, { from: '1/512', to: '8' }).length, '4095/512');
});
