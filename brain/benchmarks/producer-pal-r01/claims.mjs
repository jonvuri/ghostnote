// R01 pure-stage attribution. No host adapter, connection, or deployment imports.
// node --expose-gc --import tsx benchmarks/producer-pal-r01/claims.mjs
import assert from 'node:assert/strict';
import { cpus } from 'node:os';
import { execFileSync } from 'node:child_process';
import { parseSealable, sealProposal, dependencyExpansion } from '../../src/bindings/overlay-seal.ts';
import { carryOverlays } from '../../src/bindings/overlay-carry.ts';
import { validate, sealOverlays, applyPatch, contentHash } from '../../src/document/index.ts';

function document(notes, pairs, roles = 0) {
  const clip = 'clip', events = [], overlays = [], length = String(Math.max(8, Math.ceil(notes / 4)));
  const provenance = { kind: 'declared', source: 'r01-fixture', method: 'quarter-grid' };
  for (let i = 0; i < notes; i++) {
    const id = `n${i}`, at = `${i}/4`, duration = '1/4';
    events.push({ id, clip, at, duration, pitch: 36 + i % 48, velocity: 100 });
    if (i >= pairs) continue;
    const depends = { events: [{ id, fields: ['clip', 'at', 'duration'] }], clips: [], overlays: [], membership: [] };
    overlays.push({ id: `nom${i}`, type: 'nominal', state: 'current', provenance, depends,
      data: { event: id, at, duration, division: '1/4' } });
    overlays.push({ id: `groove${i}`, type: 'groove', state: 'current', provenance,
      depends: { ...depends, overlays: [`nom${i}`] }, data: {
        event: id, nominal: `nom${i}`, intent: 'resolved', phase: '0', template: '0', cross: '0', local: '0',
        unassigned: '0', durationIntent: '0', durationUnassigned: '0', sourceAt: at, sourceDuration: duration,
        atDelta: '0', durationDelta: '0' } });
  }
  for (let i = 0; i < roles; i++) overlays.push({ id: `role${i}`, type: 'role', state: 'current', provenance,
    depends: { events: [], clips: [{ id: clip, fields: ['length'] }], overlays: [], membership: [clip] },
    data: { clip, label: `role ${i}`, events: [] } });
  return { format: 'ghostnote-document', version: '1.0', kind: 'desired', clips: [{ id: clip, length }], events, overlays,
    coverage: [{ clip, from: '0', to: length, channels: Array.from({ length: 16 }, (_, i) => i + 1), fields: 'all', status: 'complete' }] };
}
const timed = fn => { const start = performance.now(), value = fn(); return { ms: performance.now() - start, value }; };
const median = values => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
const cases = [[28, 0, 0], [28, 28, 0], [256, 0, 0], [256, 128, 0], [4096, 0, 0], [4096, 2048, 0],
  [16384, 0, 0], [16384, 6000, 128]];
const results = [];
// Warm small pure code paths once; large cases are not used to tune anything.
const warm = parseSealable(JSON.stringify(document(28, 28)), 'json');
validate(sealProposal(warm.document, warm.seal));
for (const [notes, pairs, roles] of cases) {
  const input = JSON.stringify(document(notes, pairs, roles));
  const samples = [];
  for (let run = 0; run < 3; run++) {
    globalThis.gc?.();
    const parsed = timed(() => parseSealable(input, 'json'));
    const expansion = timed(() => dependencyExpansion(parsed.value.document, parsed.value.seal));
    const sealed = timed(() => sealProposal(parsed.value.document, parsed.value.seal));
    const validated = timed(() => validate(sealed.value));
    const valid = validated.value;
    const bare = { ...valid, overlays: [] };
    const carried = timed(() => carryOverlays(valid.overlays, bare));
    assert.deepEqual(carried.value.overlays, valid.overlays);
    assert.equal(valid.events.length, notes);
    assert.equal(valid.overlays.length, pairs * 2 + roles);
    assert.ok(expansion.value <= 4194304, 'admitted dependency-expansion bound');
    samples.push({ parseMs: parsed.ms, expansionMs: expansion.ms, sealMs: sealed.ms,
      validateMs: validated.ms, carryMs: carried.ms, units: expansion.value });
  }
  const medians = Object.fromEntries(Object.keys(samples[0]).map(key => [key, median(samples.map(s => s[key]))]));
  results.push({ notes, pairs, roles, claims: pairs * 2 + roles, bytes: Buffer.byteLength(input), samples, medians });
  console.error(JSON.stringify({ notes, claims: pairs * 2 + roles, medians }));
}
// Separate correctness witnesses: identity alone does not keep interpretation current.
const parsed = parseSealable(JSON.stringify(document(28, 28)), 'json');
const base = validate(sealProposal(parsed.document, parsed.seal));
const patch = set => ({ format: 'ghostnote-document', version: '1.0', kind: 'patch', base: { sha256: contentHash(base) },
  add: [], remove: [], update: [{ id: 'n0', set }], clipUpdate: [], overlayPut: [], overlayRemove: [] });
const unrelated = applyPatch(base, patch({ velocity: 110 })).document;
assert.deepEqual(unrelated.overlays, base.overlays);
const related = applyPatch(base, patch({ duration: '1/2' })).document;
assert.deepEqual(related.overlays.filter(o => o.state === 'stale').map(o => o.id).sort(), ['groove0', 'nom0']);
const removed = { ...patch({ velocity: 100 }), update: [], overlayRemove: ['groove0', 'nom0'] };
assert.deepEqual(applyPatch(base, removed).document.events, base.events);
assert.deepEqual(sealOverlays(base).overlays, base.overlays);
console.log(JSON.stringify({ schema: 'r01-claim-stages-v1', node: process.version, platform: process.platform,
  arch: process.arch, cpu: cpus()[0]?.model, commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  repetitions: 3, results, correctness: ['unrelated velocity retains claims', 'duration change stales only dependent pair',
    'claim removal preserves notes', 'independent whole-document reseal agrees'],
  limits: 'Independent pure stages, not end-to-end latency; carry includes validation even for the no-claim control. No host measurements.' }, null, 2));
