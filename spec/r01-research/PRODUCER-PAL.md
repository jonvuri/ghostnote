# R01 candidate 2: precision-adapted Producer Pal

This is an offline research adapter for Producer Pal bar|beat and MIDI JSON,
not a Ghostnote product codec or a format-adoption decision. It retains upstream
syntax and native note semantics. The shared experiment must score omissions,
identity limits, and editing behavior independently of timing precision.

## Source and implementation

The upstream pin is
[`52a4c219eca338b95e94dbfddcffeeb303ff8dd3`](https://github.com/adamjmurray/producer-pal/tree/52a4c219eca338b95e94dbfddcffeeb303ff8dd3),
version 2.4.0, GPL-3.0-or-later. The
[retained adaptation diff](../../context/evidence/data/r01-candidates/precision-upstream.patch)
changes seven upstream files. The
[adapter](../../brain/benchmarks/r01-candidates/precision.mjs) checks the pin and
tracked source cleanliness, copies the source and package metadata into a fresh
temporary directory, applies the diff, imports the native notation router, and
provides explicit cleanup. The original checkout remains the diagnostic control.
No upstream runtime dependency is added to Ghostnote.

The adaptation changes serialization and comparison, not the parser grammar:

- Whole-note fractions extend through denominator 2048, covering a
  1/512-quarter-note cell. MIDI JSON fractions cover its meter-scaled units.
- Fraction and dotted/triplet spelling require exact numeric equality. Off-grid
  fallbacks retain floating-point digits and expand exponent notation into
  parser-compatible decimals.
- Position grouping, inherited durations, probability state, comma merging,
  drum state runs, and omitted repeat steps require equal values. Strict equality
  is deliberately more conservative than cell equality: distinct authored
  values remain distinct before realization.
- Drum repeats require the entire arithmetic sequence to match. A nearly regular
  passage must retain its irregular hits. Actual regular repeats and shared
  states retain their compression.
- Bar/beat conversion no longer rounds source timing to nine decimal places.

Neither codec quantizes the emitted text or parsed authored values. After
serialization, `formatExact` reparses with the adapted native parser and checks
the normalized supported-field multiset against its input. This guard floors
onset cells and rounds positive duration cells to nearest, with a minimum of one
cell, without changing the emitted values. Any mismatch refuses with
`R01_PRECISION_LOSS` and a diagnostic; it does not return a lossy serialization.
The independent comparison harness applies the same declared realization rule. Exact authored tuplets
remain unquantized numeric values. Upstream uses floating-point numbers, so this
adapter does not introduce a symbolic rational expression model or claim exact
symbolic preservation across arithmetic.

## API and admitted fields

```js
const adapter = await createAdapter('/path/to/pinned-producer-pal');
try {
  const options = {
    notation: 'barbeat', // or 'midi-json'
    timeSigNumerator: 6,
    timeSigDenominator: 8,
    drumMode: false,
  };
  const text = adapter.formatExact(notes, options);
  const authoredNotes = adapter.parse(text, options);
  const control = adapter.formatUpstream(notes, options);
} finally {
  adapter.dispose();
}
```

Inputs use quarter-note units: `pitch`, `start_time`, `duration`, `velocity`,
optional `probability` (default 1), and optional `velocity_deviation` (default 0).
The bounded adapter admits meter numerators 1–32 and denominators 4 or 8; test
coverage is 4/4, 6/8, and 5/4. Other meters explicitly refuse pending a separate
precision check, including upstream minimum-duration scaling. Durations range
from 1/512 to 10^9 quarter notes; onset magnitudes are at most 10^9. Pitch and
velocity must already be valid integers, velocity is 1–127, probability is
0–1, and deviation is a nonnegative integer whose addition to velocity stays
within 127. The test's long-value representative is 10^6 quarter notes. Passing these
range checks is necessary but does not promise serializability: the native
bar|beat arithmetic can lose an IEEE-754 unit at a grid boundary when adding and
subtracting its one-based beat offset. Such an input is explicitly refused by
the post-serialization guard. For example, onset `1/512 - 2**-60` is in cell 0,
but native bar|beat recomposition moves it to cell 1; `4 - 2**-51` similarly
moves from cell 2047 to 2048. Both refuse instead of quantizing the source or
modifying native parser semantics. MIDI JSON passes these two inputs.

`unsupportedFields(notes)` reports unknown keys. Formatting refuses channels,
mute, release velocity, expression, IDs, annotations, and any other unencoded
field instead of discarding it. A harness may explicitly extract the supported
projection and report excluded fields separately. Channel assignment may be
supplied by an external clip scope, but that is not channel round-trip evidence.
Two-channel notes cannot be scored as a full-state success after projection.

The native parser remains tolerant: MIDI JSON can clamp values, skip invalid
notes, and resolve velocity-zero deletion markers; bar|beat has its own stateful
rules. `parse` is therefore an authoring seam, not strict patch validation.
A common guarded backend must validate the realized proposal and compare the
actual produced set before accepting an edit. The adapter does not expose
`existingNotes` or deferred deletion markers. It makes no live write.

## Grammar, defaults, and targeting

Bar|beat uses upstream stateful `v` velocity, `n` whole-note duration, `p`
probability, pitch names, and one-based `bar|beat` positions. A beat follows the
meter denominator; an `n` fraction always denotes a whole note. State carries
across whitespace/newlines; a duration/velocity statement remains active until
changed. Pitches grouped before a position sound at that position. Comma beat
lists and repeat syntax compact repeated states. The serializer emits an
explicit initial velocity and duration. Probability 1 and deviation 0 may be
omitted. Stateful text must be parsed as a whole scope; an extracted line is not
necessarily a self-contained edit.

MIDI JSON is an array of object literals parsed by upstream, **not standard
JSON**. Keys are `p` pitch, `t` onset, `d` duration, `v` velocity, `vd` deviation,
and `c` probability. Fractions are numeric expressions accepted by its parser.
Times and durations are musical beats, scaled by the meter denominator; no
state carries across objects. The serializer explicitly emits `p/t/d/v` and
omits only default `vd/c`. Native input defaults for omitted duration/velocity
remain upstream behavior; generated examples specify them explicitly.

Neither notation stores persistent note IDs or intent/group metadata. Snapshot
presentation order may change during bar|beat grouping and merging. Explicit
onsets determine performance; text order supplies no durable addressing contract.
For a one-note or group edit, the common experiment must use an explicit frozen
selection and its expected notes, then apply the resulting supported-field change
through the shared backend. A complete notation rewrite proposes all encoded
fields; it is not a sparse update. Missing wider fields must be preserved from
the guarded source by the backend or reported unsupported. Ambiguous selection,
stale base, and conflicting realization refuse. An overlapping or same-address
multiset survives the tested codec seam, but this does not establish upstream
host-writer behavior or unique note correspondence.

## Worked precision and edit examples

The same normalized note, quarter onset 341/512 and duration 171/512 at velocity
100, has these 4/4 spellings:

```text
bar|beat: v100 n171/2048 C3 1|1+n341/2048
MIDI JSON: [{p:60,t:341/512,d:171/512,v:100}]
```

In 6/8 the MIDI JSON timing doubles:

```text
[{p:60,t:341/256,d:171/256,v:100}]
```

For an explicitly selected C3, transposing by two semitones changes `C3` to
`D3`, or `p:60` to `p:62`; onset, duration, velocity, deviation, and probability
must compare equal. The notation itself cannot say which duplicate C3 identity
to preserve. A group transposition needs the frozen group selection outside
these notations. This keeps an interaction benefit separate from the format's
own identity/intent limits.

An authored triplet is accepted without grid quantization:

```text
bar|beat: v100 n/12 C3 1|1+n/12
MIDI JSON: [{p:60,t:1/3,d:1/3,v:100}]
```

Passing `{pitch:60, start_time:0, duration:1, velocity:100, channel:2}` to
`formatExact` refuses with `unsupported fields: channel`. Zero duration,
nonfinite timing, out-of-range pitch/velocity, and an excessive velocity range
also refuse. Native MIDI JSON input such as `{p:999,t:0,v:999}` may instead
clamp; the distinction between guarded formatting and native tolerant authoring
must remain visible in trials.

## Verification and reproduction

[The retained results](../../context/evidence/data/r01-candidates/precision-results.json)
record **80 cases, 254 serialization cycles, and 28,604 note-cycle checks**, all
passing normalized multiset equality. Coverage includes all 512 onset cells and
all positive duration cells up to one quarter, three representative onset
regions per meter/notation, duration half-cell boundaries, onset floor
boundaries, long values, pickups, repeated cycles, same-pitch overlaps and exact
duplicate multiplicity, probability/default suppression, and regular/irregular
drum compression. Two authored-tuplet tests run ten cycles and separately check
that onset/duration remain unquantized. Unsupported-field and invalid-input
refusals are asserted as well.

A separate immediate-neighbor screen tests **55,296 inputs** around every
1/512 onset boundary and duration half-cell boundary in the same three regions,
meters, and notations. It accepts 53,248 and explicitly refuses 2,048; all refusals
are bar|beat, and all 27,648 MIDI JSON inputs pass. Each accepted output is checked
again after a second serialization cycle. The screen asserts no silent normalized
losses. These counts describe this bounded sweep, not universal coverage of
floating-point numbers. The two concrete ULP-adjacent onset failures above have
explicit regression assertions requiring bar|beat refusal.

The six retained diagnostic controls use the original 341/512 onset witness.
Five lose normalized equality; 6/8 MIDI JSON already represents this particular
witness exactly. This is a counterexample screen, not an aggregate upstream
failure rate. Expected upstream warnings for negative pickups are written to
stderr; they do not indicate dropped notes in the passing comparisons.

Prepare the pinned checkout and generated parsers using
[E353's reproduction steps](../../context/evidence/experiments/e353-producer-pal-offline-formats-and-claims.md#reproduction-and-verification).
Then, from `brain/`:

```sh
node --import tsx benchmarks/r01-candidates/precision.test.mjs /path/to/upstream > /tmp/r01-precision-results.json
```

The test computes the adaptation SHA-256 in its report. The guard adds a native
parse and multiset comparison to `formatExact`; include that cost in any later
codec timing measurement. It is independent of the retained upstream source
patch, which remains limited to the seven precision-related source files. No model benchmark,
agent-performance conclusion, full upstream regression run, host check, or
product behavior change is implied by this bounded codec verification.
