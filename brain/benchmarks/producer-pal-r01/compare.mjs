// R01 research only. Imports pinned upstream codecs; never imports a host client.
// Run from brain: node --import tsx benchmarks/producer-pal-r01/compare.mjs <upstream> <tooling>
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import * as gn from '../../src/document/index.ts';

const upstream = resolve(process.argv[2]);
const tooling = resolve(process.argv[3]);
const pin = '52a4c219eca338b95e94dbfddcffeeb303ff8dd3';
assert.equal(execFileSync('git', ['-C', upstream, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), pin);
const up = (path) => import(pathToFileURL(resolve(upstream, path)).href);
const pp = await up('src/notation/notation.ts');
const { applyTransforms } = await up('src/notation/transform/transform-evaluator.ts');
const { dedupeNotesKeepingLast } = await up('src/notation/note-sort.ts');
const { rawNotesToCopiedNotes } = await up('src/tools/shared/clip/clip-notes.ts');
const { getEncoding } = await import(pathToFileURL(resolve(tooling, 'node_modules/js-tiktoken/dist/index.js')).href);
const encoder = getEncoding('o200k_base');
const size = (text) => ({ bytes: Buffer.byteLength(text), tokens: encoder.encode(text).length });
const num = (text) => { const [n, d = '1'] = String(text).split('/'); return Number(n) / Number(d); };
const note = (pitch, at, duration = '1', velocity = 100, extra = {}) => ({ pitch, at, duration, velocity, ...extra });
const fixtures = [
  { name: 'quarters', notes: [60, 62, 64, 65].map((p, i) => note(p, String(i))) },
  { name: 'six-eight', numerator: 6, denominator: 8, notes: [0, 1, 2].map(i => note(60 + i, String(i))) },
  { name: 'five-four', numerator: 5, notes: [0, 1, 2, 3, 4].map(i => note(60, String(i))) },
  { name: 'dense-drums', drumMode: true, notes: Array.from({ length: 64 }, (_, i) => note(42, `${i}/4`, '1/4', 100)) },
  { name: 'chord-distinct-lengths', notes: [note(60, '0', '1', 70), note(64, '0', '2', 100), note(67, '0', '4', 120)] },
  { name: 'normalized-triplets', notes: [note(60, '0', '171/512'), note(62, '85/256', '171/512'), note(64, '341/512', '171/512')] },
  { name: 'exact-triplets', notes: [note(60, '0', '1/3'), note(62, '1/3', '1/3'), note(64, '2/3', '1/3')] },
  { name: 'pickup', notes: [note(60, '-1/2', '1/2'), note(62, '0', '1')] },
  { name: 'same-pitch-overlap', notes: [note(60, '0', '2'), note(60, '1', '2')] },
  { name: 'two-channels-same-address', notes: [note(60, '0', '1', 90, { channel: 1 }), note(60, '0', '1', 110, { channel: 2 })] },
  { name: 'probability', notes: [note(60, '0', '1', 100, { chance: { enabled: true, value: 0.75 } })] },
  { name: 'long-sustain', notes: [note(60, '0', '8')] },
  { name: 'expression-and-mute', notes: [note(60, '0', '1', 100, { mute: true, releaseVelocity: 0.4,
    expression: { velocitySpread: 0, gain: 1, pan: -0.3, pressure: 0.2, timbre: 0.7, transpose: 0.5 } })] },
];
function doc(fixture) {
  const length = String(Math.max(8, Math.ceil(Math.max(...fixture.notes.map(n => num(n.at) + num(n.duration))))));
  return { format: 'ghostnote-document', version: '1.0', kind: 'desired',
    clips: [{ id: 'clip', length }],
    events: fixture.notes.map((n, i) => ({ id: `n${i}`, clip: 'clip', ...n })), overlays: [],
    coverage: [{ clip: 'clip', from: '0', to: length, channels: Array.from({ length: 16 }, (_, i) => i + 1), fields: 'all', status: 'complete' }] };
}
function ppNotes(fixture) {
  return fixture.notes.map(n => ({ pitch: n.pitch, start_time: num(n.at), duration: num(n.duration), velocity: n.velocity,
    probability: n.chance?.value ?? 1, velocity_deviation: 0,
    ...(n.channel === undefined ? {} : { channel: n.channel }),
    ...(n.mute === undefined ? {} : { mute: n.mute }),
    ...(n.releaseVelocity === undefined ? {} : { release_velocity: n.releaseVelocity }),
    ...(n.expression === undefined ? {} : { expression: n.expression }) }));
}
const coreKeys = ['pitch', 'start_time', 'duration', 'velocity', 'probability', 'velocity_deviation'];
const sorted = notes => notes.toSorted((a, b) => a.start_time - b.start_time || a.pitch - b.pitch || a.velocity - b.velocity);
function diff(before, after) {
  const a = sorted(before), b = sorted(after), differences = [];
  if (a.length !== b.length) differences.push({ field: 'count', before: a.length, after: b.length });
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    for (const key of coreKeys) {
      const av = a[i][key] ?? (key === 'probability' ? 1 : 0);
      const bv = b[i][key] ?? (key === 'probability' ? 1 : 0);
      if (Math.abs(av - bv) > 1e-12) differences.push({ note: i, field: key, before: av, after: bv });
    }
    for (const key of ['channel', 'mute', 'release_velocity', 'expression']) {
      if (Object.hasOwn(a[i], key) && JSON.stringify(a[i][key]) !== JSON.stringify(b[i][key]))
        differences.push({ note: i, field: key, before: a[i][key], after: b[i][key] ?? null });
    }
  }
  return differences;
}
function captured(fn) {
  const warnings = [], warn = console.warn, error = console.error, random = Math.random;
  console.warn = (...args) => warnings.push(args.join(' '));
  console.error = (...args) => warnings.push(args.join(' '));
  Math.random = () => 0.5; // Fixed illustrative Stark draw, not an agent or musical-quality trial.
  try { return { value: fn(), warnings: [...new Set(warnings)] }; }
  catch (e) { return { error: e.message, warnings: [...new Set(warnings)] }; }
  finally { console.warn = warn; console.error = error; Math.random = random; }
}
const roundtrips = [];
for (const fixture of fixtures) {
  for (const encoding of ['fields', 'json']) {
    const result = captured(() => {
      const expected = gn.validate(doc(fixture)), text = gn.serialize(expected, encoding);
      assert.deepEqual(gn.parse(text, encoding), expected);
      return { text, ...size(text), differences: [] };
    });
    roundtrips.push({ fixture: fixture.name, format: `ghostnote-${encoding}`, ...result });
  }
  for (const notation of ['barbeat', 'midi-json', 'stark']) {
    const result = captured(() => {
      const before = ppNotes(fixture);
      const options = { notation, timeSigNumerator: fixture.numerator ?? 4,
        timeSigDenominator: fixture.denominator ?? 4, drumMode: fixture.drumMode ?? false };
      const text = pp.formatNotation(before, options), after = pp.interpretNotation(text, options);
      return { text, ...size(text), differences: diff(before, after), after };
    });
    roundtrips.push({ fixture: fixture.name, format: notation, ...result });
  }
}
assert.equal(roundtrips.length, 65);
for (const row of roundtrips) {
  const refused = row.format.startsWith('ghostnote-') && ['exact-triplets', 'pickup'].includes(row.fixture);
  assert.equal(Boolean(row.error), refused, `${row.fixture}/${row.format}: unexpected refusal or acceptance`);
}
const witnesses = [];
function witness(name, fn) {
  const result = captured(fn);
  assert.equal(result.error, undefined, `${name}: ${result.error}`);
  witnesses.push({ name, ...result });
}
witness('midi-json-is-not-standard-json', () => {
  const text = pp.formatNotation(ppNotes(fixtures[0]), { notation: 'midi-json' });
  assert.throws(() => JSON.parse(text));
  const probability = pp.interpretNotation('[{p:60,t:0,d:2/3,v:100,c:0.75}]', { notation: 'midi-json' })[0];
  assert.equal(probability.probability, 0.75);
  assert.equal(probability.duration, 2 / 3);
  return { text, probability };
});
witness('midi-json-clamp-drop-and-unknown-field', () => {
  const input = '[{p:999,t:0,v:999,c:2,channel:2},{p:62,t:1,d:0},{p:64,t:2,d:1/0}]';
  const notes = pp.interpretNotation(input, { notation: 'midi-json' });
  assert.equal(notes.length, 1); assert.equal(notes[0].pitch, 127); assert.equal(notes[0].channel, undefined);
  return { input, notes };
});
witness('midi-json-unlisted-denominator', () => {
  const before = [{ pitch: 60, start_time: 0, duration: 1 / 17, velocity: 100 }];
  const text = pp.formatNotation(before, { notation: 'midi-json' });
  const after = pp.interpretNotation(text, { notation: 'midi-json' });
  assert.notEqual(after[0].duration, before[0].duration);
  return { text, differences: diff(before, after) };
});
witness('midi-json-rounding-can-change-reimported-cell', () => {
  const before = [{ pitch: 60, start_time: 341 / 512, duration: 171 / 512, velocity: 100 }];
  const text = pp.formatNotation(before, { notation: 'midi-json' });
  const after = pp.interpretNotation(text, { notation: 'midi-json' })[0];
  const imported = gn.importNotes([{ id: 'note', clip: 'clip', pitch: after.pitch, velocity: after.velocity,
    at: after.start_time, duration: after.duration }]);
  assert.equal(imported.events[0].at, '85/128'); // 340/512, one cell earlier.
  return { text, sourceAt: '341/512', imported };
});
witness('barbeat-patterns-and-meter', () => {
  const text = '[v80 v100] [C3 E3 G3] n/4 1|1x6';
  const notes = pp.interpretNotation(text, { timeSigNumerator: 6, timeSigDenominator: 8 });
  assert.deepEqual(notes.map(n => n.start_time), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(notes.map(n => n.pitch), [60, 64, 67, 60, 64, 67]);
  assert.deepEqual(notes.map(n => n.velocity), [80, 100, 80, 100, 80, 100]);
  return { text, ...size(text), notes };
});
witness('stark-chords-and-drum-repeats', () => {
  const drums = pp.interpretNotation('hihat /16: X*16', { notation: 'stark' });
  const chords = pp.interpretNotation('chords: C Am', { notation: 'stark' });
  assert.equal(drums.length, 16); assert.equal(chords.length, 6);
  return { drumText: 'hihat /16: X*16', chordRead: pp.formatNotation(chords, { notation: 'stark' }), chords };
});
witness('pitch-time-merge-is-local-but-replaces-matched-note', () => {
  const before = rawNotesToCopiedNotes([{ pitch: 60, start_time: 0, duration: 2, velocity: 90,
    note_id: 123, release_velocity: 64, mute: 0, probability: 0.6, velocity_deviation: 3 }]);
  const incoming = pp.interpretNotation('[{p:60,t:0,v:110}]', { notation: 'midi-json' });
  const after = dedupeNotesKeepingLast([...before, ...incoming]);
  assert.equal(after.length, 1); assert.equal(after[0].duration, 1);
  assert.equal(after[0].release_velocity, undefined); assert.equal(after[0].probability, 1);
  return { before, incoming, after };
});
witness('transform-preserves-carried-properties-and-moves', () => {
  const notes = [{ pitch: 60, start_time: 0, duration: 2, velocity: 90, release_velocity: 64, mute: 0, probability: 0.6 },
    { pitch: 64, start_time: 1, duration: 1, velocity: 70, release_velocity: 32, mute: 0 }];
  const before = structuredClone(notes), target = notes[0];
  const text = 'C3: velocity += 10\nC3: timing += n/8';
  applyTransforms(notes, text, 4, 4);
  assert.equal(notes.find(n => n.pitch === 60), target);
  assert.equal(target.start_time, 0.5); assert.equal(target.velocity, 100); assert.equal(target.release_velocity, 64);
  assert.deepEqual(notes.find(n => n.pitch === 64), before[1]);
  return { text, ...size(text), before, after: notes, sameObjectDuringOperation: true };
});
witness('transform-half-open-bars', () => {
  const notes = [0, 4, 8, 12].map(start_time => ({ pitch: 60, start_time, duration: 1, velocity: 100 }));
  applyTransforms(notes, '2|*: delete', 4, 4);
  assert.deepEqual(notes.map(n => n.start_time), [0, 8, 12]);
  return notes;
});
witness('ghostnote-sparse-update-and-stale-base', () => {
  const base = gn.validate(doc(fixtures[0]));
  const patch = { format: 'ghostnote-document', version: '1.0', kind: 'patch', base: { sha256: gn.contentHash(base) },
    add: [], remove: [], update: [{ id: 'n0', set: { pitch: 61, at: '1/2' } }], clipUpdate: [], overlayPut: [], overlayRemove: [] };
  const result = gn.applyPatch(base, patch);
  assert.equal(result.document.events.find(n => n.id === 'n0').pitch, 61);
  assert.deepEqual(result.document.events.filter(n => n.id !== 'n0'), base.events.filter(n => n.id !== 'n0'));
  assert.throws(() => gn.applyPatch(result.document, patch));
  const text = gn.serialize(patch, 'fields');
  return { text, ...size(text), report: result.report ?? result.changes ?? Object.keys(result) };
});
witness('small-edit-in-large-clip', () => {
  const fixture = { notes: Array.from({ length: 1024 }, (_, i) => note(60, String(i), '1', 90)) };
  const base = gn.validate(doc(fixture));
  const patch = { format: 'ghostnote-document', version: '1.0', kind: 'patch', base: { sha256: gn.contentHash(base) },
    add: [], remove: [], update: [{ id: 'n512', set: { velocity: 110 } }], clipUpdate: [], overlayPut: [], overlayRemove: [] };
  const changed = gn.applyPatch(base, patch).document;
  assert.equal(changed.events.filter(n => n.velocity === 110).length, 1);
  const ppBefore = ppNotes(fixture);
  const midiJson = '[{p:60,t:512,d:1,v:110}]';
  const merged = dedupeNotesKeepingLast([...ppBefore, ...pp.interpretNotation(midiJson, { notation: 'midi-json' })]);
  assert.equal(merged.length, 1024); assert.equal(merged.filter(n => n.velocity === 110).length, 1);
  const transform = 'C3 129|1: velocity = 110';
  const transformed = structuredClone(ppBefore);
  applyTransforms(transformed, transform, 4, 4);
  assert.equal(transformed.filter(n => n.velocity === 110).length, 1);
  return { notes: 1024, changed: 1,
    fields: size(gn.serialize(patch, 'fields')), json: size(gn.serialize(patch, 'json')),
    midiJson: { text: midiJson, ...size(midiJson) }, transform: { text: transform, ...size(transform) },
    limit: 'Request payloads only; Ghostnote includes a base hash, PP requires external meter and clip addressing.' };
});
witness('ghostnote-loop-and-play-range', () => {
  const input = doc(fixtures[0]);
  input.clips[0].loop = { from: '2', to: '6' };
  input.clips[0].playRange = { from: '1', to: '7' };
  const base = gn.validate(input);
  assert.deepEqual(gn.parse(gn.serialize(base, 'fields'), 'fields'), base);
  return base.clips;
});
const instructionModules = [
  ['barbeat-standard', 'src/skills/notation/barbeat-standard.ts'],
  ['midi-json', 'src/skills/notation/midi-json.ts'], ['stark', 'src/skills/notation/stark.ts'],
  ['transforms-core', 'src/skills/fragments/transforms/transforms-core.ts'],
  ['transforms-expressions', 'src/skills/fragments/transforms/transforms-expressions.ts'],
  ['transforms-generative', 'src/skills/fragments/transforms/transforms-generative.ts'],
];
const instructions = [];
for (const [group, path] of instructionModules) {
  for (const [name, value] of Object.entries(await up(path)))
    if (typeof value === 'string') instructions.push({ group, name, ...size(value) });
}
for (const sections of [[], ['Patch'], ['Timing overlays']]) {
  const text = gn.modelReference(readFileSync(new URL('../../../spec/ghostnote-document-v1/MODEL-REFERENCE.md', import.meta.url), 'utf8'), sections);
  instructions.push({ group: 'ghostnote', name: `Core+${sections.join('+')}`, ...size(text) });
}
// Actual default assembly for a clip-only toolset, distinct from notation fragments.
const { buildSkills } = await up('src/skills/build-skills.ts');
const priorCodeExec = process.env.ENABLE_CODE_EXEC;
process.env.ENABLE_CODE_EXEC = '';
for (const notation of ['barbeat', 'midi-json', 'stark']) {
  for (const smallModelMode of [false, true]) {
    const text = buildSkills({ notation, smallModelMode,
      tools: ['ppal-read-clip', 'ppal-create-clip', 'ppal-update-clip'] });
    instructions.push({ group: 'producer-pal-assembled-clip-tools', name: `${notation}/${smallModelMode ? 'basic' : 'standard'}`, ...size(text) });
  }
}
if (priorCodeExec === undefined) delete process.env.ENABLE_CODE_EXEC; else process.env.ENABLE_CODE_EXEC = priorCodeExec;
const sourcePaths = ['docs/features/midi-notation.md', 'src/notation/types.ts', 'src/notation/midi-json/midi-json-notation.ts',
  'src/notation/midi-json/midi-json-note.ts', 'src/notation/midi-json/parser/midi-json-parser.ts',
  'src/notation/barbeat/parser/barbeat-grammar.peggy', 'src/notation/stark/parser/stark-grammar.peggy',
  'src/notation/stark/stark-serializer.ts', 'src/notation/transform/parser/transform-grammar.peggy',
  'src/tools/clip/update/helpers/notes/note-updates.ts', 'src/tools/clip/update/helpers/notes/note-transforms.ts',
  'src/tools/shared/clip/clip-notes.ts', 'src/skills/build-skills.ts', 'src/skills/drivers.ts',
  'src/tools/clip/update/update-clip.def.ts', ...instructionModules.map(([, path]) => path)];
console.log(JSON.stringify({ schema: 'r01-offline-format-v1', upstream: pin,
  ghostnote: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), node: process.version,
  tokenizer: 'js-tiktoken@1.0.21/o200k_base', random: 'Math.random=0.5 during each isolated witness',
  comparison: 'Common PP note fields at 1e-12 tolerance; explicit extra-field losses. Ghostnote native round trips use deep equality.',
  sources: sourcePaths.map(path => ({ path, sha256: createHash('sha256').update(readFileSync(resolve(upstream, path))).digest('hex') })),
  fixtures, roundtrips, witnesses, instructions }, null, 2));
