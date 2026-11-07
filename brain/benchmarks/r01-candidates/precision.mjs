// R01 research adapter. No host clients or product-runtime integration.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
export const UPSTREAM_PIN = '52a4c219eca338b95e94dbfddcffeeb303ff8dd3';
const patchPath = fileURLToPath(new URL('../../../context/evidence/data/r01-candidates/precision-upstream.patch', import.meta.url));
export const SUPPORTED_FIELDS = ['pitch', 'start_time', 'duration', 'velocity', 'probability', 'velocity_deviation'];
export function unsupportedFields(notes) {
  return [...new Set(notes.flatMap(note => Object.keys(note).filter(key => !SUPPORTED_FIELDS.includes(key))))].sort();
}
function optionsChecked(options = {}) {
  const result = { notation: 'barbeat', timeSigNumerator: 4, timeSigDenominator: 4, ...options };
  assert.ok(['barbeat', 'midi-json'].includes(result.notation), 'unsupported notation');
  assert.ok(Number.isInteger(result.timeSigNumerator) && result.timeSigNumerator > 0 && result.timeSigNumerator <= 32, 'unsupported meter numerator');
  assert.ok([4, 8].includes(result.timeSigDenominator), 'research adapter supports meter denominators 4 and 8');
  assert.ok(!result.existingNotes && !result.keepV0Deletes, 'research parse does not edit an existing note set');
  return result;
}
function notesChecked(notes) {
  const unsupported = unsupportedFields(notes);
  assert.equal(unsupported.length, 0, `unsupported fields: ${unsupported.join(', ')}`);
  for (const n of notes) {
    assert.ok(Number.isInteger(n.pitch) && n.pitch >= 0 && n.pitch <= 127, 'invalid pitch');
    assert.ok(Number.isInteger(n.velocity) && n.velocity >= 1 && n.velocity <= 127, 'invalid velocity');
    assert.ok(Number.isFinite(n.start_time) && Math.abs(n.start_time) <= 1e9, 'invalid onset');
    assert.ok(Number.isFinite(n.duration) && n.duration >= 1 / 512 && n.duration <= 1e9, 'duration outside research range');
    assert.ok(Number.isFinite(n.probability ?? 1) && (n.probability ?? 1) >= 0 && (n.probability ?? 1) <= 1, 'invalid probability');
    assert.ok(Number.isInteger(n.velocity_deviation ?? 0) && (n.velocity_deviation ?? 0) >= 0 && n.velocity + (n.velocity_deviation ?? 0) <= 127, 'unsupported velocity deviation');
  }
}
// Verification is a guard, not realization: the emitted text and parsed source
// numbers are unchanged. Native one-based beat arithmetic can cross a grid edge
// even when the serializer emits all digits (e.g. adding 1 erases a small ULP).
function comparisonProjection(notes) {
  return notes.map(n => JSON.stringify([n.pitch, Math.floor(n.start_time * 512),
    Math.max(1, Math.round(n.duration * 512)), n.velocity,
    n.probability ?? 1, n.velocity_deviation ?? 0])).sort();
}
function assertPreserved(before, after, notation) {
  const expected = comparisonProjection(before), actual = comparisonProjection(after);
  if (JSON.stringify(expected) === JSON.stringify(actual)) return;
  const first = expected.findIndex((value, index) => value !== actual[index]);
  const diagnostic = { notation, expectedCount: expected.length, actualCount: actual.length,
    firstDifference: first < 0 ? expected.length : first,
    expected: expected[first] ?? null, actual: actual[first] ?? null };
  const error = new Error(`R01_PRECISION_LOSS: native codec cannot preserve normalized notes: ${JSON.stringify(diagnostic)}`);
  error.code = 'R01_PRECISION_LOSS';
  error.diagnostic = diagnostic;
  throw error;
}
export async function createAdapter(upstreamPath) {
  const upstream = resolve(upstreamPath);
  const pin = execFileSync('git', ['-C', upstream, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert.equal(pin, UPSTREAM_PIN, 'wrong upstream pin');
  assert.equal(execFileSync('git', ['-C', upstream, 'diff', 'HEAD', '--', 'src', 'package.json'], { encoding: 'utf8' }), '', 'upstream tracked source is modified');
  const copy = mkdtempSync(join(tmpdir(), 'ghostnote-r01-precision-'));
  try {
    cpSync(join(upstream, 'src'), join(copy, 'src'), { recursive: true });
    cpSync(join(upstream, 'package.json'), join(copy, 'package.json'));
    execFileSync('git', ['apply', '--check', patchPath], { cwd: copy });
    execFileSync('git', ['apply', patchPath], { cwd: copy });
    const raw = await import(pathToFileURL(join(upstream, 'src/notation/notation.ts')).href);
    const adapted = await import(pathToFileURL(join(copy, 'src/notation/notation.ts')).href);
    return {
      pin, patchSha256: createHash('sha256').update(readFileSync(patchPath)).digest('hex'),
      formatExact(notes, options) {
        notesChecked(notes);
        const checked = optionsChecked(options);
        const text = adapted.formatNotation(notes, checked);
        assertPreserved(notes, adapted.interpretNotation(text, checked), checked.notation);
        return text;
      },
      // Native parser semantics, including tolerant invalid-note handling; no realization.
      parse(text, options) { return adapted.interpretNotation(text, optionsChecked(options)); },
      formatUpstream(notes, options) { return raw.formatNotation(notes, optionsChecked(options)); },
      parseUpstream(text, options) { return raw.interpretNotation(text, optionsChecked(options)); },
      dispose() { rmSync(copy, { recursive: true, force: true }); },
    };
  } catch (error) { rmSync(copy, { recursive: true, force: true }); throw error; }
}
