---
title: E353 — Producer Pal offline formats and claim costs
kind: evidence
state: done
updated: 2026-10-25
owner: R01
---

# E353 — Producer Pal offline formats and claim costs

## Scope and sources

Initial offline rounds for [R01](../../work/r01-format-comparison.md).
No Bitwig/Ableton connection, live read/write, extension build/deployment,
controller check, server restart, or paid model trial was performed.

Producer Pal source: commit
[`52a4c219eca338b95e94dbfddcffeeb303ff8dd3`](https://github.com/adamjmurray/producer-pal/tree/52a4c219eca338b95e94dbfddcffeeb303ff8dd3),
package version 2.4.0, commit date 2026-10-01. The
[public notation page](https://producer-pal.org/features/midi-notation) was
consulted on 2026-10-25; reproducible claims below use the
[pinned documentation](https://github.com/adamjmurray/producer-pal/blob/52a4c219eca338b95e94dbfddcffeeb303ff8dd3/docs/features/midi-notation.md)
and code, not an assumption that the website always matches that commit.
Ghostnote runtime sources: `6eba1ee91752f7580e747ac96f2b15c6f36907b9`.
Only research drivers and documents were added in this worktree.

Retained artifacts:

- [Comparison](../data/r01-format-comparison/comparison.json): fixtures,
  serialized examples, per-field differences, warnings, source hashes,
  instruction sizes, and 12 executable witnesses.
- [Claim stage measurements](../data/r01-format-comparison/claims.json):
  every sample, environment, and four lifecycle assertions.
- [Driver hashes](../data/r01-format-comparison/driver-hashes.json),
  [tooling manifest](../data/r01-format-comparison/package.json), and
  [tooling lock](../data/r01-format-comparison/package-lock.json).
- Drivers: [comparison](../../../brain/benchmarks/producer-pal-r01/compare.mjs)
  and [claims](../../../brain/benchmarks/producer-pal-r01/claims.mjs).

Upstream code stays in a temporary checkout; it was not copied into the
Ghostnote product. Peggy 5.0.6 generates the three upstream grammars locally.
Node is 24.11.1. Token counts use `js-tiktoken` 1.0.21, `o200k_base`, locally.
They are not provider billing figures or measured agent success.

## Test design

Thirteen fixtures × five encodings = 65 round-trip attempts. Ghostnote uses
native document validation and deep equality after serialization/parsing.
Producer Pal uses its actual notation router, serializer, and interpreter.
Common numeric note fields are compared with a `1e-12` tolerance; additional
channel, mute, release-velocity, and expression fields are explicitly checked
for loss. They are deliberate capability probes, not fields presumed to be
part of Producer Pal's public note model. Notes are paired by sorted onset,
pitch, and velocity only to report fixture differences, never to recover
identity. Changed counts are recorded separately.

Stark's `Math.random` is fixed to 0.5 during each isolated call so the returned
velocities are reproducible. This exposes a representative draw, not a claim
that all runs produce these velocities. No aggregate winner is calculated.
All successful parses retain their serialized text and result in the artifact.

## Round-trip results

| Fixture / property | Ghostnote FIELDS and JSON | bar\|beat | MIDI JSON | Stark |
|---|---|---|---|---|
| Quarters; 6/8; 5/4; repeated sixteenth drums | Exact admitted document | Common note fields preserved | Common note fields preserved | Timing/pitch preserved; velocity changes |
| Chord with distinct lengths and velocities | Exact | Preserved | Preserved | Simultaneous notes take representative duration/dynamic |
| Normalized triplets on Ghostnote's 1/512 grid | Exact | Fine timing changes | Fine timing changes | Timing and velocity change |
| Exact 1/3-beat triplets | Refused as realized core; normalization needed | Preserved in this fixture | Preserved in this fixture | Timing preserved; velocity changes |
| Negative pickup | Refused by current core timing rule | Preserved, warning about negative time | Preserved | Pickup and following onset shift |
| Same-pitch notes at different overlapping onsets | Exact document | Preserved by codec | Preserved by codec | Earlier duration shortened |
| Same pitch/onset on two MIDI channels | Channels and events preserved | No channel field | No channel field | No channel field; duplicate count also changes |
| Probability 0.75 | Enabled chance preserved | Preserved | Preserved | Lost |
| Eight-beat sustain | Exact | Preserved | Preserved | Shortened to six beats, with warning |
| Expression, mute, release velocity | Preserved in document | Not represented in note text | Not represented in note text | Not represented in note text |

The four Ghostnote refusals (two fixtures × two encodings) were expected and
asserted. Its other 22 round trips passed deep equality. All 39 Producer Pal
round trips parsed; the artifact records losses rather than labeling a
successful parse a fidelity pass. Ghostnote's loop/play-range witness also
round-trips both offsets. Producer Pal's note text leaves clip metadata to
tool arguments and results; absence from that text is not absence from its
clip tools.

These are codec results. They establish neither host overlap preservation
nor pressure/expression write support. Ghostnote's current host binding has
separate acquisition and field limits; a portable field is not proof of a
working Bitwig setter.

## Findings beyond the overview documentation

**Probability is not exclusive to bar|beat.** The MIDI JSON interpreter and
serializer preserve `c:0.75`. The overview's exclusivity sentence conflicts
with its own MIDI JSON description and the executable witness.

**MIDI JSON is a custom numeric object-literal language.** Its canonical output
has bare keys and can contain division expressions. `JSON.parse` rejects that
output. The dedicated parser accepts quoted keys and standard numeric values,
so ordinary JSON is usable as a restricted input. Internally it evaluates
fractions to JavaScript numbers. Selected fractions are reconstructed on
output; arbitrary rational fidelity is not guaranteed: `1/17` becomes
`0.0588`. The tested normalized duration `171/512` becomes `0.334`, while one
onset `85/256` does survive as a fraction. This is not a blanket claim that
all high-denominator fractions fail.

The cross-format witness shows why even small differences matter at an import
boundary: MIDI JSON emits onset `341/512` as `0.666`; Ghostnote's explicit
import floors that to `85/128` (340/512), one cell earlier. Adapter tests must
check the final normalized event, not only a small floating-point error.

**Tolerance and rejection are different product choices.** MIDI JSON clamps
out-of-range values, defaults missing duration/velocity, ignores unrecognized
numeric fields, and drops semantically invalid notes with a warning. The
fixture with pitch 999, an invalid duration, and division by zero retains one
clamped note and warns about two dropped notes. Ghostnote's strict document
validation refuses unsupported or invalid state. The research does not assume
that either error policy is always preferable.

**Stark has timing losses as well as dynamic losses.** Its serializer uses a
finite note-value grid, a maximum six-beat duration, and sequential pitched
groups. It can shorten overlapping tails, unify simultaneous note durations,
and lose rests below its grid. The normalized-triplet fixture contradicts
the serializer comment's unqualified statement that all onsets are exact.
Symbolic chords are input convenience; readback spells concrete pitches.
Those limits do not negate the value of drum lines, repeats, and chord input
for tasks that accept them.

## Addressability, preservation, and lineage

The 1,024-note fixture changes exactly one note using each of a Ghostnote
sparse patch, Producer Pal MIDI JSON merge, and a Producer Pal transform.
Their payloads are 70 FIELDS tokens, 93 Ghostnote JSON tokens, 14 MIDI JSON
tokens, and 11 transform tokens. These are different contracts: the Ghostnote
patch carries a base hash; Producer Pal obtains clip context and meter outside
the note string. Full tool wrappers and instructions are excluded here.

Producer Pal merge matches pitch plus onset within `0.001` quarter-note beat
and keeps the last matching note. This is genuine local request addressability,
without a persistent public note ID. A restated note replaces the matched
note's represented values: the witness supplying pitch/start/velocity changes
duration 2 to default 1, probability 0.6 to default 1, and loses the old release
velocity from the merged object. It is not a sparse field patch.

Transforms offer another route. A selector changes velocity and onset on one
existing object, retains its release velocity, and leaves the unrelated note
unchanged. A whole-bar selector deletes precisely the intended half-open bar.
The in-memory object correspondence survives these tested operations. This is
not durable host identity.

Source inspection of `note-updates.ts`, `note-transforms.ts`, and
`clip-notes.ts` shows that both update paths read existing raw note values,
copy supported fields, remove notes in the scan window, and add the resulting
notes back. Muted notes are kept aside and reintroduced; merge collisions can
replace one. `note_id` is stripped. Thus a compact request is not necessarily
a narrow host write, and omitted notation fields need not be lost on every
edit. No live preservation assertion follows from that source inspection.

Ghostnote's event-ID patch retains identity through the tested pitch/onset
change and preserves unrelated events. A changed base hash refuses. The
current guarded planner also requires fresh reprojection to match its base;
it does not implement a general three-way merge. Identity is useful input to
such a design, not evidence that the design already exists. Cross-session
source-document attachment remains a separate open question for both formats.

## Instruction and representation cost

| Surface | Selected notation instructions, tokens | Repeated 64-note drum payload, tokens |
|---|---:|---:|
| Ghostnote FIELDS | Core 938; Core + Patch 1,213 | 1,337 |
| Ghostnote JSON | Same semantic reference; FIELDS examples in maintained card | 1,919 |
| bar\|beat | Standard read 1,275 + writing 1,636 | 13 |
| MIDI JSON | 344 | 1,057 |
| Stark | Standard read 932 + writing 273 | 8 |

The compact drum payloads are actual serializer output: bar|beat uses a repeat
and Stark a repeated drum hit. Stark changes velocity; Ghostnote carries IDs,
clip/coverage state, and a broader schema. The rows must not be read as equal
information compressed at different rates. The repeated pattern is also
especially favorable to repetition syntax, not a representative average.

Costs outside those notation fragments matter. Producer Pal's actual default
assembled instructions for read/create/update-clip, with no user overrides or
experimental code execution, are 10,516 tokens for bar|beat, 7,947 for MIDI
JSON, and 8,808 for Stark at standard depth. Basic-mode totals are 1,202, 996,
and 1,666. They include guidance beyond note syntax and are not comparable to
Ghostnote Core alone. Individual transform fragments are also retained:
core 1,568; editing 324; expressions 731; generative operations 1,473 tokens.
Ghostnote Core + Timing overlays is 2,838 tokens, before tool templates/wrappers.
No full conversation-cost or composition-quality claim is made.

## Claims stage costs

Three samples per case after a small warm-up; medians below, in milliseconds.
Local Apple M4 Pro, Node 24.11.1. Other sessions were allowed to continue, so
these are descriptive local costs, not isolated-machine performance gates.

| Notes / claims | Parse sealable input | Count expansion | Seal stated claims | Validate sealed state | Carry stored claims |
|---|---:|---:|---:|---:|---:|
| 28 / 0 | 0.63 | 0.01 | <0.01 | 0.29 | 0.35 |
| 28 / 56 | 7.79 | 0.11 | 1.06 | 6.93 | 7.89 |
| 256 / 0 | 2.89 | 0.01 | <0.01 | 1.70 | 1.94 |
| 256 / 256 | 35.10 | 0.41 | 3.75 | 32.70 | 35.94 |
| 4,096 / 0 | 41.17 | 0.35 | <0.01 | 23.90 | 28.30 |
| 4,096 / 4,096 | 533.05 | 7.44 | 60.00 | 491.06 | 544.04 |
| 16,384 / 0 | 161.26 | 1.68 | <0.01 | 91.34 | 113.63 |
| 16,384 / 12,128 | 1,633.85 | 23.56 | 325.68 | 1,596.14 | 1,924.26 |

The largest case has 6,000 nominal/groove pairs plus 128 membership claims,
2,682,542 dependency-expansion units, below the 4,194,304 admission bound.
It is a bounded dense case, not a newly discovered maximum. Native input and
both canonical serializations pass the codec's size checks.

These are separate pure stages, not additive end-to-end tool timings. Parse
and carry include validation; carry includes dependency projection and basis
comparisons. The no-claim carry control still invokes validation, whereas the
actual acquisition path skips `carryOverlays` when no overlays exist. Seal
itself immediately returns for no current claims. Counting expansion units
is cheap here; actually projecting dependencies occurs during seal/validation/
carry and must not be confused with the count.

The measured parse/validation/carry stages outweigh explicit seal work. This
supports investigating repeated validation and projection before attributing
the whole cost to hashing or removing annotations. [E253](e253-overlay-basis-sealing.md)
previously profiled failed schema-union branches; no new CPU-profile percentage
is asserted. [E256](e256-overlay-authoring-and-creation.md)'s full add-path
costs include other work and different fixtures; these numbers neither replace
them nor predict a live latency improvement.

Lifecycle assertions pass: an unrelated velocity change retains claims;
changing one duration stales only its nominal/groove pair; removing that pair
preserves all notes; independent whole-document resealing agrees with the
stored bases. This separates optional interpretation from note identity.

## Reproduction and verification

Use a temporary directory for the upstream checkout and another for tooling.
Clone Producer Pal and check out the exact commit above. Copy the retained
tooling `package.json` and `package-lock.json` into the tooling directory, then
run `npm ci --ignore-scripts --no-audit --no-fund` there. From the upstream root,
run the installed Peggy executable with `--format es` for each grammar:

- `src/notation/barbeat/parser/barbeat-grammar.peggy` →
  `src/notation/barbeat/parser/generated-barbeat-parser.js`
- `src/notation/stark/parser/stark-grammar.peggy` →
  `src/notation/stark/parser/generated-stark-parser.js`
- `src/notation/transform/parser/transform-grammar.peggy` →
  `src/notation/transform/parser/generated-transform-parser.js`

Install Ghostnote's locked brain dependencies locally if needed. From `brain/`:

```sh
node --import tsx benchmarks/producer-pal-r01/compare.mjs /path/to/upstream /path/to/tooling > /tmp/r01-comparison.json
node --expose-gc --import tsx benchmarks/producer-pal-r01/claims.mjs > /tmp/r01-claims.json
node --import tsx --test src/document/*.test.ts src/bindings/*.test.ts
```

Both research drivers completed. All 286 existing document/binding tests
passed. This is focused local evidence; the entire upstream suite was not
run. No upstream source was changed apart from generated ignored parsers.
The R01 brief records the resulting options, remaining research, and deferred
host checks.

Changed-document local links and anchors pass. The global context checker
reports 60 pre-existing broken links to absent `reference/` checkouts and a
sibling Ghostworks repository in this separate worktree; their source links
were checked against HEAD. No new broken link was introduced.
