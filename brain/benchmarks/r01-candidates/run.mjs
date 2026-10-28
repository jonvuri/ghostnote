// Offline deterministic screen. Run from brain with pinned upstream/tooling paths.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';
import { execFileSync } from 'node:child_process';
import * as gn from '../../src/document/index.ts';
import { fixtures, stressFixtures } from './fixtures.mjs';
import { normalize, equivalence, correspondence, document, documentNotes, command, view, canonical, numeric, patchBetween } from './common.mjs';
import { encodeCompact, decodeCompact, encodeGrouped, decodeGrouped, editNote, scaleGroupSpread } from './structured.mjs';
import { createAdapter } from './precision.mjs';
import { claimedDocument } from './claims-control.mjs';

const upstream = process.argv[2], tooling = process.argv[3];
assert(upstream && tooling, 'usage: node --expose-gc --import tsx benchmarks/r01-candidates/run.mjs <upstream> <tooling>');
const adapter = await createAdapter(upstream);
const { getEncoding } = await import(pathToFileURL(resolve(tooling, 'node_modules/js-tiktoken/dist/index.js')).href);
const encoder = getEncoding('o200k_base');
const size = value => { const text = typeof value === 'string' ? value : JSON.stringify(value); return { bytes: Buffer.byteLength(text), tokens: encoder.encode(text).length }; };
const corpusPath = new URL('../../../context/evidence/data/r01-candidates/corpus-excerpts.json', import.meta.url);
const corpusText = readFileSync(corpusPath, 'utf8'), corpus = JSON.parse(corpusText);
const samples = fn => {
  fn(); const rows = [];
  for (let i = 0; i < 5; i++) {
    globalThis.gc?.(); const before = process.memoryUsage().heapUsed, start = performance.now();
    const value = fn(), ms = performance.now() - start;
    rows.push({ ms, heapDeltaBytes: process.memoryUsage().heapUsed - before });
    assert(value !== undefined);
  }
  return { samples: rows, medianMs: rows.map(r => r.ms).sort((a, b) => a - b)[2] };
};
// Raw transcription provenance stays in the corpus artifact, not every payload.
const inputFixtures = [...fixtures, ...corpus.excerpts.map(f => ({ id: f.id, family: f.family, meter: f.meter, notes: f.notes }))];
const results = [], examples = [], checks = [], claimControls = [];
const check = (name, fn) => { fn(); checks.push(name); };
const ppNotes = notes => notes.map(n => ({ pitch: n.pitch, start_time: numeric(n.at), duration: numeric(n.duration), velocity: n.velocity }));
// Convert parser binary64 through the product's explicit boundary, then compare
// with our independently normalized rational source (not its own writer echo).
const fromPP = notes => notes.map((n, i) => {
  assert.equal(n.probability ?? 1, 1, 'unexpected parsed probability');
  assert.equal(n.velocity_deviation ?? 0, 0, 'unexpected parsed velocity deviation');
  return { id: `pp${i}`, pitch: n.pitch, velocity: n.velocity,
    ...(({ at, duration }) => ({ at, duration }))(gn.normalizeTiming(n.start_time, n.duration)) };
});
try {
  for (const fixture of inputFixtures) {
    const doc = document(fixture), expected = fixture.notes, base = gn.contentHash(doc);
    assert(equivalence(expected, documentNotes(doc)).equal, `${fixture.id}: baseline import`);
    const record = { fixture: fixture.id, family: fixture.family, notes: expected.length, surfaces: [], edit: {} };
    for (const encoding of ['fields', 'json']) {
      const text = gn.serialize(doc, encoding), decoded = gn.parse(text, encoding);
      assert(equivalence(expected, documentNotes(decoded)).equal);
      record.surfaces.push({ candidate: `baseline-${encoding}`, ...size(text), performedEqual: true,
        information: 'normalized notes plus clip/coverage; source rationals and group context are not included',
        encode: samples(() => gn.serialize(doc, encoding)), decode: samples(() => gn.parse(text, encoding)) });
    }
    for (const [candidate, encode, decode] of [['compact', encodeCompact, decodeCompact], ['grouped', encodeGrouped, decodeGrouped]]) {
      const surface = encode(fixture), text = JSON.stringify(surface), decoded = decode(text);
      assert.equal(canonical(decoded), canonical(fixture), `${fixture.id}/${candidate}: source and context preservation`);
      assert(equivalence(expected, decoded.notes).equal);
      for (let i = 0, current = decoded; i < 3; i++) { current = decode(JSON.stringify(encode(current))); assert.equal(canonical(current), canonical(fixture)); }
      record.surfaces.push({ candidate, ...size(text), performedEqual: true, sourceAndContextEqual: true,
        information: 'source rational notes plus supplied groups, musical fields, family and meter',
        encode: samples(() => JSON.stringify(encode(fixture))), decode: samples(() => decode(text)) });
    }
    const unexpected = [...new Set(expected.flatMap(n => Object.keys(n).filter(k => !['id', 'pitch', 'at', 'duration', 'velocity', 'channel'].includes(k))))];
    if (expected.some(n => (n.channel ?? 1) !== 1)) unexpected.push('nondefault channel');
    // A default channel is common binding context, not a native PP field.
    const options = { timeSigNumerator: fixture.meter.numerator, timeSigDenominator: fixture.meter.denominator };
    for (const notation of ['barbeat', 'midi-json']) {
      if (unexpected.length) {
        record.surfaces.push({ candidate: `adapted-${notation}`, status: 'unsupported-full-state', fields: unexpected }); continue;
      }
      const normalized = expected.map(normalize), before = ppNotes(normalized), opts = { ...options, notation };
      const text = adapter.formatExact(before, opts), decoded = fromPP(adapter.parse(text, opts));
      assert(equivalence(normalized, decoded).equal, `${fixture.id}/${notation}: final cells`);
      const diagnosticText = adapter.formatUpstream(before, opts);
      const diagnostic = equivalence(normalized, fromPP(adapter.parseUpstream(diagnosticText, opts)));
      record.surfaces.push({ candidate: `adapted-${notation}`, ...size(text), performedEqual: true,
        information: 'normalized common note fields only; no public IDs, groups, source timing, meter map or clip state',
        upstreamDiagnostic: { ...size(diagnosticText), performedEqual: diagnostic.equal, missing: diagnostic.missing.length, extra: diagnostic.extra.length },
        encode: samples(() => adapter.formatExact(before, opts)), decode: samples(() => adapter.parse(text, opts)) });
    }
    const target = doc.events[Math.floor(doc.events.length / 2)], value = target.velocity === 100 ? 99 : 100;
    const request = { base, op: 'velocity', select: { ids: [target.id] }, value };
    const applied = command(doc, request), readback = gn.parse(gn.serialize(applied.document, 'fields'), 'fields');
    assert.equal(readback.events.find(n => n.id === target.id).velocity, value);
    assert.equal(applied.patch.update.length, 1);
    for (const note of doc.events) if (note.id !== target.id) assert.equal(canonical(readback.events.find(n => n.id === note.id)), canonical(note));
    const correspondenceResult = correspondence(documentNotes(doc), documentNotes(readback), true);
    assert.equal(correspondenceResult.matches.filter(x => x.changed).length, 1);
    for (const [encode, decode] of [[encodeCompact, decodeCompact], [encodeGrouped, decodeGrouped]]) {
      const edited = editNote(decode(JSON.stringify(encode(fixture))), target.id, { velocity: value });
      const after = document(edited.fixture), patch = patchBetween(doc, after);
      assert.equal(canonical(gn.applyPatch(doc, patch).document), canonical(applied.document));
    }
    if (!unexpected.length) for (const notation of ['barbeat', 'midi-json']) {
      const opts = { ...options, notation }, proposed = { ...target, velocity: value };
      const editText = adapter.formatExact(ppNotes([proposed]), opts), parsed = fromPP(adapter.parse(editText, opts));
      assert.equal(parsed.length, 1, 'single-note proposal must contain exactly one note');
      const next = structuredClone(doc), edited = next.events.find(n => n.id === target.id);
      for (const field of ['pitch', 'at', 'duration', 'velocity']) edited[field] = parsed[0][field];
      const patch = patchBetween(doc, next), result = gn.applyPatch(doc, patch).document;
      assert.equal(canonical(result), canonical(applied.document));
      const surface = record.surfaces.find(s => s.candidate === `adapted-${notation}`);
      surface.edit = { ...size(editText), text: editText, selection: { id: target.id, base },
        guardAndSelection: size({ id: target.id, base }), source: 'external frozen selection; not native PP identity', performedEqual: true };
    }
    // Non-ID notations can use ephemeral backend handles in a workflow, but that
    // is an adapter capability, never a native identity claim.
    record.edit = { target: target.id, request: size(request), patch: size(gn.serialize(applied.patch, 'fields')),
      guardedCommand: samples(() => command(doc, request)), changedNotes: 1,
      unchangedNotes: expected.length - 1, sharedDomainCorrespondence: correspondenceResult.matches.length };
    record.view = size(view(doc, { ids: doc.events.map(n => n.id) }, ['pitch', 'at', 'velocity']));
    results.push(record);
    if (fixture.id.startsWith('synthetic-')) examples.push({ fixture: fixture.id, source: fixture,
      baselineFields: gn.serialize(doc, 'fields'), compact: encodeCompact(fixture), grouped: encodeGrouped(fixture),
      command: request, expectedAfter: documentNotes(readback),
      producerPal: unexpected.length ? { refusal: unexpected } : Object.fromEntries(['barbeat', 'midi-json'].map(notation => [notation,
        adapter.formatExact(ppNotes(expected.map(normalize)), { ...options, notation })])) });
  }
  check('halve strum spread preserves common delay, durations and unrelated state', () => {
    const fixture = fixtures[2], edited = scaleGroupSpread(fixture, 'c7', '1/2');
    assert.deepEqual(edited.fixture.notes.map(n => n.at), ['4099/512', '2051/256', '8211/1024', '8219/1024']);
    assert.equal(edited.fixture.groups[0].delay, '3/512');
    const before = document(fixture), after = document(edited.fixture), patch = patchBetween(before, after);
    const readback = gn.parse(gn.serialize(gn.applyPatch(before, patch).document, 'json'), 'json');
    assert(equivalence(edited.fixture.notes, documentNotes(readback)).equal);
    for (const n of fixture.notes) assert.equal(edited.fixture.notes.find(x => x.id === n.id).duration, n.duration);
    examples.push({ fixture: 'synthetic-harmony-half-spread', source: fixture, command: { group: 'c7', scaleSpread: '1/2' },
      exactAfter: edited.fixture, normalizedAfter: documentNotes(readback), changes: edited.changes });
  });
  for (const fixture of stressFixtures.slice(0, 3)) check(`${fixture.id}: explicit baseline admission refusal`, () => {
    assert.throws(() => document(fixture));
    assert(equivalence(fixture.notes, decodeCompact(encodeCompact(fixture)).notes).equal);
    assert(equivalence(fixture.notes, decodeGrouped(encodeGrouped(fixture)).notes).equal);
  });
  check('unrelated concurrent edit invalidates whole-document base', () => {
    const doc = document(fixtures[0]), base = gn.contentHash(doc);
    const changed = command(doc, { base, op: 'velocity', select: { ids: ['kick'] }, value: 100 }).document;
    assert.throws(() => command(changed, { base, op: 'velocity', select: { ids: ['push'] }, value: 99 }), /stale/);
  });
  for (const fixture of fixtures.filter(f => f.groups)) for (const mode of ['selective', 'timing-rich']) {
    const doc = claimedDocument(fixture, mode), text = gn.serialize(doc, 'fields');
    assert(equivalence(fixture.notes, documentNotes(gn.parse(text, 'fields'))).equal);
    const target = doc.events[0], velocity = target.velocity === 100 ? 99 : 100;
    const changed = command(doc, { base: gn.contentHash(doc), op: 'velocity', select: { ids: [target.id] }, value: velocity }).document;
    assert.equal(canonical(changed.overlays), canonical(doc.overlays));
    const shifted = command(doc, { base: gn.contentHash(doc), op: 'shift', select: { ids: [target.id] }, by: '1/512' }).document;
    assert(shifted.overlays.some(o => o.state === 'stale') || !doc.overlays.some(o => o.depends.events.some(d => d.id === target.id)));
    claimControls.push({ fixture: fixture.id, mode, claims: doc.overlays.length, ...size(text),
      buildAndSeal: samples(() => claimedDocument(fixture, mode)), parse: samples(() => gn.parse(text, 'fields')),
      velocityRetainsClaims: true, timingEditStaleClaims: shifted.overlays.filter(o => o.state === 'stale').map(o => o.id) });
  }
  const sourcePaths = ['common.mjs', 'common.test.mjs', 'fixtures.mjs', 'claims-control.mjs',
    'structured.mjs', 'structured.test.mjs', 'precision.mjs', 'precision.test.mjs', 'corpus.mjs', 'corpus.test.mjs', 'run.mjs'];
  console.log(JSON.stringify({ schema: 'r01-candidate-screen-v1', node: process.version, cpu: cpus()[0]?.model,
    ghostnote: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    tokenizer: 'js-tiktoken@1.0.21/o200k_base', upstream: adapter.pin, patchSha256: adapter.patchSha256,
    corpusSha256: createHash('sha256').update(corpusText).digest('hex'),
    sources: sourcePaths.map(path => ({ path, sha256: createHash('sha256').update(readFileSync(new URL(path, import.meta.url))).digest('hex') })),
    limits: ['No host or agent trial.', 'Surface sizes carry different information and are not a winner ranking.',
      'Timing: one warm-up and five local samples per stage; not end-to-end latency.',
      'Heap deltas are sampled heapUsed changes, may include GC; not retained memory or peak allocations.',
      'PP screen realizes timing before serialization; authored tuplets are checked separately by precision tests.',
      'PP common-note payloads use a declared default channel; other channels and extra fields refuse.',
      'Variable source meter/tempo maps remain in corpus context; PP adapter tests fixed meters only.',
      'Structured codecs carry exact source intent fields; claim-envelope equivalence is not implemented.'],
    results, claimControls, checks, examples }, null, 2));
} finally { adapter.dispose(); }
