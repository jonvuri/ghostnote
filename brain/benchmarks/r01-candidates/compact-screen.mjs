// Offline C3 encoding screen. Uses retained development excerpts, never model calls.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fixtures, stressFixtures } from './fixtures.mjs';
import { encodeCompactFields, decodeCompactFields } from './compact-fields.mjs';
import { encodeCompact, editNote, scaleGroupSpread } from './structured.mjs';
import { equivalence, document, patchBetween, documentNotes } from './common.mjs';
import * as gn from '../../src/document/index.ts';

const tooling = process.argv[2];
assert(tooling, 'usage: node --import tsx compact-screen.mjs <tokenizer-tooling-directory>');
const { getEncoding } = await import(pathToFileURL(resolve(tooling, 'node_modules/js-tiktoken/dist/index.js')).href);
const tokenizer = getEncoding('o200k_base');
const sha = text => createHash('sha256').update(text).digest('hex');
const corpusBytes = readFileSync(new URL('../../../context/evidence/data/r01-candidates/corpus-excerpts.json', import.meta.url));
const corpus = JSON.parse(corpusBytes);
const data = [...fixtures, ...corpus.excerpts.map(f => ({ id: f.id, family: f.family, meter: f.meter, notes: f.notes })), ...stressFixtures];
const results = [];
for (const fixture of data) {
  const text = encodeCompactFields(fixture), reference = JSON.stringify(encodeCompact(fixture));
  const decoded = decodeCompactFields(text);
  assert.deepEqual(decoded, fixture);
  assert(equivalence(fixture.notes, decoded.notes).equal);
  assert.equal(encodeCompactFields(decoded), text);
  const target = fixture.notes[Math.floor(fixture.notes.length / 2)];
  const value = target.velocity === 100 ? 99 : 100;
  const edited = editNote(decoded, target.id, { velocity: value }).fixture;
  const reread = decodeCompactFields(encodeCompactFields(edited));
  const expected = structuredClone(fixture); expected.notes.find(n => n.id === target.id).velocity = value;
  assert.deepEqual(reread, expected);
  const isStress = stressFixtures.some(f => f.id === fixture.id);
  if (!isStress) {
    const before = document(fixture), after = document(reread);
    const applied = gn.applyPatch(before, patchBetween(before, after)).document;
    const readback = gn.parse(gn.serialize(applied, 'fields'), 'fields');
    assert(equivalence(expected.notes, documentNotes(readback)).equal);
  }
  results.push({ fixture: fixture.id, notes: fixture.notes.length, exactRoundTrip: true,
    canonicalStable: true, velocityEditPreservesOtherState: true,
    guardedBackendReadback: isStress ? 'not attempted; codec stress only' : 'pass',
    compactFields: { bytes: Buffer.byteLength(text), tokens: tokenizer.encode(text).length },
    compactJson: { bytes: Buffer.byteLength(reference), tokens: tokenizer.encode(reference).length },
    textSha256: sha(text), example: ['synthetic-bass', 'synthetic-harmony'].includes(fixture.id) ? text : undefined });
}
const half = scaleGroupSpread(decodeCompactFields(encodeCompactFields(fixtures[2])), 'c7', '1/2').fixture;
assert.deepEqual(half.notes.map(n => n.at), ['4099/512', '2051/256', '8211/1024', '8219/1024']);
assert.equal(half.groups[0].delay, '3/512');
assert.deepEqual(decodeCompactFields(encodeCompactFields(half)), half);
const sources = ['compact-fields.mjs', 'compact-fields.test.mjs', 'compact-screen.mjs', 'structured.mjs', 'fixtures.mjs', 'common.mjs'];
console.log(JSON.stringify({ schema: 'r01-compact-fields-screen-v1', node: process.version,
  tokenizer: 'js-tiktoken@1.0.21/o200k_base', corpusSha256: sha(corpusBytes),
  sources: sources.map(path => ({ path, sha256: sha(readFileSync(new URL(path, import.meta.url))) })),
  limits: ['Development fixtures only; no held-out source opened or model call made.',
    'C3 JSON and FIELDS carry identical fixture state; sizes exclude instructions and model/tool overhead.',
    'C3 preserves shared group context and adjacent membership references; group-derived note timing belongs to C4.',
    'Source-state fidelity does not establish host admission or claim-engine equivalence.'],
  spreadCheck: { exactOnsets: half.notes.map(n => n.at), commonDelayPreserved: true }, results,
}, null, 2));
