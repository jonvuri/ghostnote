// Offline development screen; does not open reserved corpus or invoke models.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fixtures, stressFixtures } from './fixtures.mjs';
import { encodeNestedFields, decodeNestedFields } from './nested-fields.mjs';
import { encodeGrouped, editNote, scaleGroupSpread } from './structured.mjs';
import { equivalence, document, patchBetween, documentNotes } from './common.mjs';
import * as gn from '../../src/document/index.ts';

const tooling = process.argv[2];
assert(tooling, 'usage: node --import tsx nested-screen.mjs <tokenizer-tooling-directory>');
const { getEncoding } = await import(pathToFileURL(resolve(tooling, 'node_modules/js-tiktoken/dist/index.js')).href);
const tokenizer = getEncoding('o200k_base');
const sha = text => createHash('sha256').update(text).digest('hex');
const corpusBytes = readFileSync(new URL('../../../context/evidence/data/r01-candidates/corpus-excerpts.json', import.meta.url));
const corpus = JSON.parse(corpusBytes);
const data = [...fixtures, ...corpus.excerpts.map(f => ({ id: f.id, family: f.family, meter: f.meter, notes: f.notes })), ...stressFixtures];
const results = [];
for (const fixture of data) {
  const text = encodeNestedFields(fixture), reference = JSON.stringify(encodeGrouped(fixture));
  const decoded = decodeNestedFields(text);
  assert.deepEqual(decoded, fixture);
  assert(equivalence(fixture.notes, decoded.notes).equal);
  assert.equal(encodeNestedFields(decoded), text);
  const target = fixture.notes[Math.floor(fixture.notes.length / 2)];
  const value = target.velocity === 100 ? 99 : 100;
  const edited = editNote(decoded, target.id, { velocity: value }).fixture;
  const reread = decodeNestedFields(encodeNestedFields(edited));
  const expected = structuredClone(fixture); expected.notes.find(n => n.id === target.id).velocity = value;
  assert.deepEqual(reread, expected);
  const isStress = stressFixtures.some(f => f.id === fixture.id);
  if (!isStress) {
    const before = document(fixture), after = document(reread);
    const result = gn.applyPatch(before, patchBetween(before, after)).document;
    const readback = gn.parse(gn.serialize(result, 'fields'), 'fields');
    assert(equivalence(expected.notes, documentNotes(readback)).equal);
  }
  results.push({ fixture: fixture.id, notes: fixture.notes.length, exactRoundTrip: true,
    canonicalStable: true, velocityEditPreservesOtherState: true,
    guardedBackendReadback: isStress ? 'not attempted; codec stress only' : 'pass',
    nestedFields: { bytes: Buffer.byteLength(text), tokens: tokenizer.encode(text).length },
    groupedJson: { bytes: Buffer.byteLength(reference), tokens: tokenizer.encode(reference).length },
    textSha256: sha(text), example: fixture.id === 'synthetic-harmony' ? text : undefined });
}
const harmony = fixtures[2];
const half = scaleGroupSpread(decodeNestedFields(encodeNestedFields(harmony)), 'c7', '1/2').fixture;
assert.deepEqual(half.notes.map(n => n.at), ['4099/512', '2051/256', '8211/1024', '8219/1024']);
assert.equal(half.groups[0].delay, '3/512');
assert.deepEqual(decodeNestedFields(encodeNestedFields(half)), half);
const sources = ['nested-fields.mjs', 'nested-fields.test.mjs', 'nested-screen.mjs', 'structured.mjs', 'fixtures.mjs', 'common.mjs'];
console.log(JSON.stringify({ schema: 'r01-nested-fields-screen-v1', node: process.version,
  tokenizer: 'js-tiktoken@1.0.21/o200k_base', corpusSha256: sha(corpusBytes),
  sources: sources.map(path => ({ path, sha256: sha(readFileSync(new URL(path, import.meta.url))) })),
  limits: ['Development fixtures only; no held-out source opened.',
    'JSON and nested FIELDS carry identical fixture state; sizes exclude instructions and model/tool overhead.',
    'Nested GROUP-within-GROUP composition is not supported; notes nest one level inside groups.',
    'Preserved source rational state does not establish host admission or claim-engine equivalence.'],
  spreadCheck: { exactOnsets: half.notes.map(n => n.at), commonDelayPreserved: true }, results,
}, null, 2));
