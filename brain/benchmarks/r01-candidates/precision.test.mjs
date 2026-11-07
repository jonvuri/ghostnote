// Standalone deterministic capability screen; prints a reproducible JSON report.
// From brain: node --import tsx benchmarks/r01-candidates/precision.test.mjs <upstream>
import assert from 'node:assert/strict';
import { createAdapter, unsupportedFields } from './precision.mjs';
const adapter = await createAdapter(process.env.R01_UPSTREAM ?? '/tmp/ghostnote-r01-producer-pal');
const note = (start_time, duration = 171 / 512, extra = {}) => ({ pitch: 60, start_time, duration, velocity: 100, probability: 1, velocity_deviation: 0, ...extra });
const normalized = notes => notes.map(n => ({ pitch: n.pitch, at: Math.floor(n.start_time * 512), duration: Math.max(1, Math.round(n.duration * 512)), velocity: n.velocity, probability: n.probability ?? 1, deviation: n.velocity_deviation ?? 0 })).sort((a, b) => a.at - b.at || a.pitch - b.pitch || a.duration - b.duration || a.velocity - b.velocity || a.probability - b.probability);
const rows = [], controls = [], witnesses = [], precisionScreens = [];
function roundtrip(name, notes, options, cycles = 3) {
  const expected = normalized(notes);
  let actual = notes, text;
  for (let cycle = 0; cycle < cycles; cycle++) {
    text = adapter.formatExact(actual, options);
    actual = adapter.parse(text, options);
    assert.deepEqual(normalized(actual), expected, `${name} ${JSON.stringify(options)} cycle ${cycle}`);
  }
  rows.push({ name, options, notes: notes.length, cycles, normalizedEquality: true });
  return { text, actual };
}
try {
  for (const [timeSigNumerator, timeSigDenominator] of [[4, 4], [6, 8], [5, 4]]) {
    for (const notation of ['barbeat', 'midi-json']) {
      const options = { notation, timeSigNumerator, timeSigDenominator };
      const bar = timeSigNumerator * 4 / timeSigDenominator;
      for (const base of [0, bar - 1, 1_000_000]) {
        roundtrip(`all-512-cells-at-${base}`, Array.from({ length: 512 }, (_, i) => note(base + i / 512, (i + 1) / 512)), options);
      }
      // Different musical-beat scaling must not alter the accepted quarter-note boundary.
      const delta = 2 ** -30;
      const durations = [1 / 512, 1.5 / 512 - delta, 1.5 / 512, 1.5 / 512 + delta,
        170.5 / 512 - delta, 170.5 / 512, 170.5 / 512 + delta, 1, 8, 1_000_000 + 171 / 512];
      roundtrip('duration-half-cell-boundaries', durations.map((d, i) => note(i, d)), options);
      roundtrip('onset-floor-boundaries', [1 / 512 - delta, 1 / 512, 1 / 512 + delta, bar - delta, bar, bar + delta].map(at => note(at)), options);
      roundtrip('negative-pickup', [note(-1 / 512), note(-341 / 512), note(0)], options);
      roundtrip('overlap-and-duplicate-multiplicity', [note(0, 2), note(0, 2), note(1, 2)], options);
      roundtrip('same-onset-distinct-duration-and-chance', [note(0, 171 / 512, { probability: 0.500001 }), note(0, 172 / 512, { pitch: 64, probability: 0.500002 }), note(1, 172 / 512, { probability: 0.500003 })], options);
      roundtrip('across-duration-rounding-boundary', [note(0, 1.5 / 512 - delta), note(1, 1.5 / 512 + delta)], options);
      roundtrip('across-onset-floor-boundary', [note(1 / 512 - delta), note(1 / 512 + delta)], options);
      roundtrip('very-small-chance', [note(0, 1, { probability: 1e-8 })], options);
      if (notation === 'barbeat') {
        roundtrip('drums-regular-repeat', Array.from({ length: 32 }, (_, i) => note(i / 4, 1 / 4, { pitch: 42 })), { ...options, drumMode: true });
        roundtrip('drums-irregular-near-repeat', [0, 1 / 4, 1 / 2 + 1 / 512, 3 / 4, 1].map(at => note(at, 1 / 4, { pitch: 42 })), { ...options, drumMode: true });
        roundtrip('drums-adjacent-duration-states', [note(0, 171 / 512), note(1, 172 / 512), note(2, 171 / 512)], { ...options, drumMode: true });
        roundtrip('drums-default-step-boundary', [0, 1 / 4, 1 / 2, 3 / 4].map(at => note(at, 1 / 4 - 1 / 2048)), { ...options, drumMode: true });
      }
      const before = [note(341 / 512)];
      const text = adapter.formatUpstream(before, options);
      controls.push({ options, text, normalizedEquality: JSON.stringify(normalized(adapter.parseUpstream(text, options))) === JSON.stringify(normalized(before)) });
    }
  }
  for (const notation of ['barbeat', 'midi-json']) {
    const input = notation === 'barbeat' ? 'v100 n/12 C3 1|1+n/12' : '[{p:60,t:1/3,d:1/3,v:100}]';
    const authored = adapter.parse(input, { notation });
    assert.ok(Math.abs(authored[0].start_time - 1 / 3) < 1e-14);
    assert.equal(authored[0].duration, 1 / 3);
    assert.notEqual(authored[0].start_time * 512, Math.floor(authored[0].start_time * 512));
    const { actual, text } = roundtrip('authored-tuplet-unquantized', authored, { notation }, 10);
    assert.ok(Math.abs(actual[0].start_time - 1 / 3) < 1e-14);
    assert.equal(actual[0].duration, 1 / 3);
    witnesses.push({ name: 'authored-tuplet', notation, input, output: text, authored, after: actual });
  }
  // Adjacent IEEE-754 numbers, rather than an arbitrary decimal epsilon, expose
  // cancellation when the native barbeat pipeline adds and subtracts 1.
  const bits = new DataView(new ArrayBuffer(8));
  function neighbor(value, direction) {
    if (value === 0) return direction * Number.MIN_VALUE;
    bits.setFloat64(0, value);
    bits.setBigUint64(0, bits.getBigUint64(0) + BigInt((value > 0 ? 1 : -1) * direction));
    return bits.getFloat64(0);
  }
  for (const at of [1 / 512 - 2 ** -60, 4 - 2 ** -51]) {
    assert.throws(() => adapter.formatExact([note(at)], { notation: 'barbeat' }),
      error => error.code === 'R01_PRECISION_LOSS');
    const text = adapter.formatExact([note(at)], { notation: 'midi-json' });
    assert.deepEqual(normalized(adapter.parse(text, { notation: 'midi-json' })), normalized([note(at)]));
    witnesses.push({ name: 'ULP-adjacent-onset-refusal', at, expectedCell: Math.floor(at * 512),
      barbeat: 'R01_PRECISION_LOSS', midiJson: text });
  }
  for (const [timeSigNumerator, timeSigDenominator] of [[4, 4], [6, 8], [5, 4]]) {
    for (const notation of ['barbeat', 'midi-json']) {
      const options = { notation, timeSigNumerator, timeSigDenominator };
      const bar = timeSigNumerator * 4 / timeSigDenominator;
      for (const base of [0, bar - 1, 1_000_000]) {
        for (const field of ['onset', 'duration']) {
          const screen = { options, base, field, inputs: 0, accepted: 0, precisionRefused: 0 };
          for (let cell = 1; cell <= 512; cell++) {
            const boundary = base + (field === 'onset' ? cell : cell + 0.5) / 512;
            for (const value of [neighbor(boundary, -1), boundary, neighbor(boundary, 1)]) {
              const source = [field === 'onset' ? note(value) : note(0, value)];
              screen.inputs++;
              try {
                const text = adapter.formatExact(source, options);
                const parsed = adapter.parse(text, options);
                assert.deepEqual(normalized(parsed), normalized(source));
                // An accepted output must also remain stable on the next cycle.
                const second = adapter.formatExact(parsed, options);
                assert.deepEqual(normalized(adapter.parse(second, options)), normalized(source));
                screen.accepted++;
              } catch (error) {
                if (error.code !== 'R01_PRECISION_LOSS') throw error;
                screen.precisionRefused++;
              }
            }
          }
          assert.equal(screen.accepted + screen.precisionRefused, screen.inputs);
          precisionScreens.push(screen);
        }
      }
    }
  }
  const unsupported = { ...note(0), channel: 2, mute: true, release_velocity: 0.5, expression: { pan: 0.2 } };
  assert.deepEqual(unsupportedFields([unsupported]), ['channel', 'expression', 'mute', 'release_velocity']);
  assert.throws(() => adapter.formatExact([unsupported]), /unsupported fields/);
  for (const invalid of [note(0, 0), note(0, 1, { velocity: 0 }), note(Infinity), note(0, 1, { velocity_deviation: 28 })]) {
    assert.throws(() => adapter.formatExact([invalid]));
  }
  console.log(JSON.stringify({ upstreamPin: adapter.pin, patchSha256: adapter.patchSha256, node: process.version,
    command: 'node --import tsx benchmarks/r01-candidates/precision.test.mjs <upstream>',
    summary: { cases: rows.length, serializationCycles: rows.reduce((a, r) => a + r.cycles, 0), noteCycleChecks: rows.reduce((a, r) => a + r.notes * r.cycles, 0), allPassed: true },
    precisionScreenSummary: { inputs: precisionScreens.reduce((a, s) => a + s.inputs, 0),
      accepted: precisionScreens.reduce((a, s) => a + s.accepted, 0),
      precisionRefused: precisionScreens.reduce((a, s) => a + s.precisionRefused, 0),
      silentNormalizedLosses: 0 },
    cases: rows, diagnosticControls: controls, witnesses, precisionScreens, unsupportedFields: unsupportedFields([unsupported]),
    limits: ['No live host checks.', 'No model trials.', 'Meter denominators outside 4 and 8 are not admitted.', 'Native parsers retain tolerant/clamping semantics; this adapter guards serialized inputs.', 'Tuplet sources retain numeric floating representations, not symbolic rational ASTs.', 'formatExact reparses and refuses native arithmetic that changes normalized supported state; not every admitted numeric input is serializable.'] }, null, 2));
} finally { adapter.dispose(); }
