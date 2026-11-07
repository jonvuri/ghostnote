import assert from 'node:assert/strict';
import * as gn from '../../src/document/index.ts';
import { document, documentNotes, numeric, equivalence, canonical, noteKey, rational, spell } from './common.mjs';
import { encodeCompact, decodeCompact, encodeGrouped, decodeGrouped } from './structured.mjs';
import { encodeCompactFields, decodeCompactFields } from './compact-fields.mjs';
import { encodeNestedFields, decodeNestedFields } from './nested-fields.mjs';
import { encodeDetachedFields, decodeDetachedFields } from './detached-fields.mjs';

export const ARMS = ['baseline-fields', 'baseline-json', 'c3-fields', 'c4-fields',
  'pp-barbeat', 'pp-midi-json', 'c3-json', 'c4-json', 'c4-detached-fields'];
export const DIAGNOSTICS = new Set(['c3-json', 'c4-json', 'c4-detached-fields']);
const structured = {
  'c3-fields': [encodeCompactFields, decodeCompactFields],
  'c4-fields': [encodeNestedFields, decodeNestedFields],
  'c3-json': [f => JSON.stringify(encodeCompact(f)), decodeCompact],
  'c4-json': [f => JSON.stringify(encodeGrouped(f)), decodeGrouped],
  'c4-detached-fields': [encodeDetachedFields, decodeDetachedFields],
};
// Coverage is task scope, not a bounding box that changes after an edit. The
// clip is 64 quarters, or the next multiple of 64 for a longer round-2 window.
export const clipLength = fixture => {
  const end = fixture.notes.reduce((a, n) => Math.max(a, numeric(n.at) + numeric(n.duration)), 0);
  return String(64 * Math.max(1, Math.ceil(end / 64)));
};
const baselineDoc = fixture => {
  const doc = document(fixture), length = clipLength(fixture);
  return gn.validate({ ...doc, clips: doc.clips.map(c => ({ ...c, length })),
    coverage: doc.coverage.map(c => ({ ...c, to: length })) });
};
const withoutEvents = doc => Object.fromEntries(Object.entries(doc).filter(([k]) => k !== 'events'));

export function eligibility(task, arm) {
  assert(ARMS.includes(arm));
  if (DIAGNOSTICS.has(arm) && !task.diagnostics) return { eligible: false, reason: 'diagnostic not scheduled for this task' };
  if (task.cohort === 'source' && !structured[arm]) return { eligible: false,
    reason: 'exact source/context contract not supplied by this arm; no supplemental annotation adapter in this cohort' };
  if (arm.startsWith('baseline-') && task.baselineExclusion) return { eligible: false, reason: task.baselineExclusion };
  // A write that creates groups exercises the layout even from an empty input.
  if (arm === 'c4-detached-fields' && !task.input.groups?.length && !task.expected?.groups?.length) return { eligible: false,
    reason: 'no group block to relocate; not an informative layout control' };
  return { eligible: true };
}

export function surfaces(adapter) {
  const options = arm => ({ notation: arm === 'pp-barbeat' ? 'barbeat' : 'midi-json',
    timeSigNumerator: 4, timeSigDenominator: 4, drumMode: false });
  return {
    encode(arm, fixture) {
      if (structured[arm]) return structured[arm][0](fixture);
      if (arm.startsWith('baseline-')) return gn.serialize(baselineDoc(fixture), arm.slice(9));
      assert(adapter, 'Producer Pal adapter required');
      return adapter.formatExact(fixture.notes.map(n => ({ pitch: n.pitch, start_time: numeric(n.at),
        duration: numeric(n.duration), velocity: n.velocity })), options(arm));
    },
    decode(arm, text) {
      if (structured[arm]) return { fixture: structured[arm][1](text), envelope: null };
      if (arm.startsWith('baseline-')) {
        const doc = gn.parse(text, arm.slice(9));
        return { fixture: { notes: documentNotes(doc) }, envelope: withoutEvents(doc) };
      }
      assert(adapter, 'Producer Pal adapter required');
      const notes = adapter.parse(text, options(arm));
      return { fixture: { notes: notes.map((n, i) => {
        assert.equal(n.probability ?? 1, 1, 'probability changed outside task scope');
        assert.equal(n.velocity_deviation ?? 0, 0, 'velocity deviation changed outside task scope');
        const { at, duration } = gn.normalizeTiming(n.start_time, n.duration);
        return { id: `parsed${i}`, pitch: n.pitch, velocity: n.velocity, at, duration };
      }) }, envelope: null };
    },
    expectedEnvelope(fixture) { return withoutEvents(baselineDoc(fixture)); },
  };
}

// D59: a parsed answer passes when it is functionally equivalent to the
// oracle. Rational strings compare by value (1032/512 equals 129/64); strings
// outside rational syntax, such as decimals, are not reinterpreted. Opaque
// annotations stay exact.
export const SCORING_VERSION = 'r01-scoring-v2-functional-rationals';
const RATIONAL = /^-?\d+\/[1-9]\d*$/;
export function functionalForm(value, key = null) {
  if (key === 'annotation') return value;
  if (typeof value === 'string' && RATIONAL.test(value)) return spell(...rational(value));
  if (Array.isArray(value)) return value.map(v => functionalForm(v));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, functionalForm(v, k)]));
  return value;
}
const functionallyEqual = (a, b) => canonical(functionalForm(a)) === canonical(functionalForm(b));

/** Paths at which an answer differs from the oracle; locations only, no expected values. */
export function differencePaths(answer, expected, path = '$', out = []) {
  const record = v => v && typeof v === 'object';
  if (Array.isArray(answer) && Array.isArray(expected)) {
    for (let i = 0; i < Math.max(answer.length, expected.length); i++) {
      if (i >= answer.length) out.push(`${path}[${i}]: missing`);
      else if (i >= expected.length) out.push(`${path}[${i}]: unexpected`);
      else differencePaths(answer[i], expected[i], `${path}[${i}]`, out);
    }
  } else if (record(answer) && record(expected) && !Array.isArray(answer) && !Array.isArray(expected)) {
    for (const k of [...new Set([...Object.keys(answer), ...Object.keys(expected)])].sort()) {
      if (!Object.hasOwn(answer, k)) out.push(`${path}.${k}: missing`);
      else if (!Object.hasOwn(expected, k)) out.push(`${path}.${k}: unexpected`);
      else differencePaths(answer[k], expected[k], `${path}.${k}`, out);
    }
  } else if (canonical(answer) !== canonical(expected)) out.push(`${path}: differs`);
  return out;
}

export function scoreResponse(task, arm, text, codec) {
  if (!eligibility(task, arm).eligible) return { status: 'ineligible', pass: false };
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (task.response === 'refusal') return { status: 'scored', pass: trimmed === `REFUSE ${task.refusal}`,
    expectedRefusal: true, reason: trimmed === `REFUSE ${task.refusal}` ? null : 'required-refusal-mismatch' };
  if (trimmed.startsWith('REFUSE ')) return { status: 'scored', pass: false, reason: 'gratuitous-refusal' };
  try {
    if (task.response === 'answer') {
      const answer = JSON.parse(trimmed), equal = functionallyEqual(answer, task.answer);
      return { status: 'scored', pass: equal, reason: equal ? null : 'answer-mismatch',
        ...(equal ? {} : { differences: differencePaths(functionalForm(answer), functionalForm(task.answer)) }) };
    }
    const parsed = codec.decode(arm, text);
    if (task.cohort === 'source') {
      const equal = functionallyEqual(parsed.fixture, task.expected);
      return { status: 'scored', pass: equal, sourceAndContextEquivalent: equal,
        exactSpelling: canonical(parsed.fixture) === canonical(task.expected), reason: equal ? null : 'source-state-mismatch',
        ...(equal ? {} : { differences: differencePaths(functionalForm(parsed.fixture), functionalForm(task.expected)) }) };
    }
    const difference = equivalence(task.expected.notes, parsed.fixture.notes);
    const rootPreserved = Object.keys(parsed.fixture).length === 1 && Object.hasOwn(parsed.fixture, 'notes');
    const envelopePreserved = !arm.startsWith('baseline-')
      || canonical(parsed.envelope) === canonical(codec.expectedEnvelope(task.expected));
    // IDs are structural in this cohort and never reconstructed for native PP.
    const identity = arm.startsWith('pp-') || task.family === 'constrained-authoring' ? null
      : task.expected.notes.every(n => parsed.fixture.notes.some(p => p.id === n.id && noteKey(p) === noteKey(n)));
    return { status: 'scored', pass: difference.equal && rootPreserved && envelopePreserved,
      performedState: difference.equal, rootPreserved, envelopePreserved,
      nativeIdentityDiagnostic: identity, missing: difference.missing, extra: difference.extra,
      reason: difference.equal && rootPreserved && envelopePreserved ? null : 'performed-state-or-envelope-mismatch' };
  } catch (error) {
    return { status: 'scored', pass: false, reason: 'parse-or-validation-error', error: error.message };
  }
}

export function goldenResponse(task, arm, codec) {
  if (task.response === 'refusal') return `REFUSE ${task.refusal}`;
  if (task.response === 'answer') return JSON.stringify(task.answer);
  return codec.encode(arm, task.expected);
}
