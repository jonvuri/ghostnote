# R01 candidate contracts and offline experiment

This is a version 0.4 research specification, authorized by the operator after
the [R01 checkpoint](../../context/work/r01-format-comparison.md#checkpoint-candidate-specifications-and-experiment-design-next).
It defines four bounded candidates and an executable deterministic screen.
It does not select a product format. Current Ghostnote FIELDS/JSON remains the
baseline and product default. Stark is excluded. Persistence, storage ownership,
format migration, API-funded model runs, and live host evidence remain separate work.

The operator suggested Ghostworks transcriptions as realistic source material.
The [corpus contract](CORPUS.md) records the inspected inventory, four development
excerpts, exact extraction, and reserved source families. Synthetic fixtures
supply known intent and edge cases that transcriptions cannot establish.

## Package map

| Component | Contract and implementation |
|---|---|
| Findings at the pause (2026-10-31) | [Citable summary of the format comparison, by capability cell](FINDINGS.md) |
| Shared equality, commands and views | This document; [pure oracle/backend](../../brain/benchmarks/r01-candidates/common.mjs) |
| Candidate 2 | [Producer Pal adaptation](PRODUCER-PAL.md); [adapter](../../brain/benchmarks/r01-candidates/precision.mjs) |
| Candidates 3 and 4 | [Structured contracts](STRUCTURED.md); [codecs and edit helpers](../../brain/benchmarks/r01-candidates/structured.mjs) |
| Candidate 3 model-facing surface | [Explicit-note FIELDS](COMPACT-FIELDS.md); [codec](../../brain/benchmarks/r01-candidates/compact-fields.mjs); [compact screen](../../context/evidence/data/r01-compact-fields/screen.json) |
| Candidate 4 model-facing surface | [Group-local FIELDS](NESTED-FIELDS.md); [codec](../../brain/benchmarks/r01-candidates/nested-fields.mjs); [nested screen](../../context/evidence/data/r01-nested-fields/screen.json) |
| Matched examples and deterministic results | [Screen artifact](../../context/evidence/data/r01-candidates/screen.json), including complete before/after examples |
| Matched development cards/tasks | [Contracts and reproduction](DEVELOPMENT-PAIRS.md); [manifest and local prompt accounting](../../context/evidence/data/r01-development-pairs/manifest.json) |
| Future agent experiment | [Protocol](TRIAL-PROTOCOL.md); [pilot draft 2](PILOT-DRAFT.md); [CLI controls](CLI-CONTROLS.md); [trial stages](PILOT-DRAFT.md#trial-stages) |
| Protocol decisions | [D55–D64 and R01-D1–R01-D7](decisions/), listed in the [R01 brief](../../context/work/r01-format-comparison.md#r01-protocol-decisions); R01-only, not in the project decision index |
| Current claims controls | [Selective/timing-rich baseline builder](../../brain/benchmarks/r01-candidates/claims-control.mjs) |

## Common musical state and normalization

The comparison fixture has `notes`, optional `groups` and `musical`, and explicit
meter/context. Notes have unique fixture-local `id`, MIDI `pitch` 0–127,
`velocity` in current Ghostnote units, rational-text `at` and `duration` in
quarter-note beats, and optional channel 1–16 and wider event fields. IDs are
comparison handles, not a claim about identity recovered from the DAW or a
notation that omits them. Source paths, models, extraction provenance and
expected answers are evaluation records, not automatic model input.

The common performed-state defaults are current Ghostnote defaults: channel 1,
mute false, release velocity 100/127, normal articulation; expression spread 0,
gain 1, pan 0, pressure 0, timbre 0.5 and transpose 0; chance disabled/value 1,
occurrence disabled/always, recurrence disabled/length 1/mask 1, and repeat
disabled/count 1/curve 0/velocity curve 0/end 1. Absence equals an explicit
default, but never an arbitrary replacement value. Opaque extra fields are
compared rather than discarded; their preservation does not prove supported
host semantics. Clip, tempo/meter and loop metadata are assessed separately.

Source and nominal rationals remain exact until explicit realization:

- Onsets map to `floor(at * 512) / 512`.
- Positive durations round to the nearest 1/512 beat, ties upward, with a
  minimum duration of one cell. Onset and duration normalize independently;
  preserving duration can change the normalized end time.
- Serialization of already normalized values must not move them to another
  cell. Quantization is not silently reapplied to nominal musical information.
- Negative source coordinates remain representable in the oracle/structured
  candidates, but the current document backend refuses them. Same-channel,
  same-pitch onsets that collide after normalization likewise refuse admission.
  No note is discarded to make a fixture pass.

The [independent oracle](../../brain/benchmarks/r01-candidates/common.mjs)
implements integer rational arithmetic separately from the product normalizer.
It compares full note multisets, retaining multiplicity and every supplied
field. Order and fixture IDs do not affect performed equality. Exact golden
values and all 512 onset cells exercise the normalization rules. Probability,
velocity and expression receive no additional tolerance allowance.

Report these dimensions separately:

1. **Performed state:** missing/extra multiset entries after the declared
   normalization, with clip/clock/loop equality reported separately.
2. **Intent:** authored nominal values, prose, group membership and performance
   structure, including declared/inferred provenance and current/stale state.
3. **Correspondence:** known shared IDs may establish edited/added/removed
   identities within one fixture domain. Without that domain, only unique exact
   matches are reported. Duplicate matches are ambiguous; a pitch/time move is
   not recovered by nearest-neighbor guessing.
4. **Admission:** codec success does not imply the current document/host accepts
   the result. Unsupported cases remain visible even when all admitted cases
   pass. Simulated readback is not independent host evidence under D15.

## Candidate 1: current documents, commands and views

This arm keeps the current model and compiles a small interaction API into
ordinary guarded document patches. Existing
[musical patch semantics](../../brain/src/musical/patch.ts) informed the bounded
selection/transform vocabulary; the prototype uses the document patch route,
not that module's host `Op` compiler. An ordinary-code edit over the same data
compiles through the same `patchBetween` seam and is an executable control.

### Read and retrieval contract

`view(document, selection, fields)` returns a full-document base hash, selected
note IDs and requested fields, plus an explicit list of omitted fields.
Selections intersect supplied `ids`, exact `pitch`, and half-open `[from,to)`
onset criteria. IDs must exist and be unique; empty selection, unknown keys,
or invalid intervals refuse. The prototype supports one clip per fixture.
Display order is generated from current document order. Targeting always uses
IDs or the frozen explicit selector; reordering rows does not change a target.

`retrieve(document, base, ids, fields)` supplies omitted details under the same
hash. A changed document refuses retrieval until the caller reacquires its view.
Omitted fields are unknown, never defaults or permission to overwrite. A concise
view reduces transmitted context, not the document's stored validation work.

### Commands and affected fields

Every command requires `base`. A non-add command also requires `select`.

| Operation | Arguments | Effect |
|---|---|---|
| `shift` | `by`: exact rational quarter beats | Add to selected realized onsets, normalize once; preserve duration and other fields |
| `transpose` | `semitones`: integer | Change selected pitches; out-of-range results refuse |
| `velocity` | `value`: admitted velocity | Change selected velocities only |
| `remove` | selection | Remove selected notes; existing patch backend handles dependent claims |
| `add` | `notes`: nonempty complete note definitions | Normalize explicit new sources and insert; duplicate IDs/addresses refuse |

For example, a frozen request to change only note `b2` is:

```json
{"base":"<current document SHA-256>","op":"velocity","select":{"ids":["b2"]},"value":100}
```

The patch contains one event update. An equivalent ordinary program changes
`b2.velocity` on a copy and calls `patchBetween`. Both must yield the same
normalized readback and unchanged unrelated notes. Unknown command arguments
refuse rather than silently becoming ignored prose. Clip expansion and
end-time-preserving shifts are outside this initial command API; a note that
moves outside the existing clip refuses rather than changing its length.

Group transforms resolve an explicit, validated membership/timing definition
before generating note changes. The prototype's `scaleGroupSpread(fixture,
groupId,factor)` is shared with candidates 3/4; candidate 1 can receive that
definition as task context. It does not infer a strum from a chord name.
The resulting performed changes compile into a guarded patch. Group context
updates and their cost must also be included when comparing full workflows.

Stale bases refuse even if the concurrent change was unrelated. Current sparse
patches do not implement a general three-way merge. No automatic retry applies
an old proposal to a new base. Unknown/ambiguous targets and normalization
collisions refuse. There is one final full-state validation after the existing
patch backend has carried or staled claims; old claim bases are not incorrectly
validated against newly edited notes before that transition.

The baseline controls include no claims, selective role/membership claims,
and nominal/groove pairs for explicitly authored timing. The control builder
does not invent nominal values for transcriptions. It represents only fields
that map to existing claims, not every freeform group property. Current claim
dependency semantics and the experimental structured lifecycle remain distinct.

## Matched examples and task coverage

The [fixture source](../../brain/benchmarks/r01-candidates/fixtures.mjs) supplies
these four before/after examples in every admitted surface. The screen artifact
contains the exact source, FIELDS, C3, C4, candidate-2 text or refusal, one-note
command, and expected normalized readback. No prose example is an untested
replacement for these generated values.

| Family | Known information and edit |
|---|---|
| Humanized drums | Unequal dynamics, an intentional push, flam spacing and irregular fill; one-note velocity edit and scoped phrase movement |
| Syncopated bass | Exact triplets and an anticipation; optional declared nominal rhythm; one-note edit without changing timing |
| Strummed harmony | Anchor 8, common delay 3/512, spreads 0/512, 6/512, 13/512, 21/512; halve spread while preserving delay, durations and dynamics |
| Irregular unknown intent | Unordered notes, overlapping same pitch on distinct channels, expression and chance; preserve state and refuse unsupported full-state encodings |

After halving the harmony spread, exact starts are `4099/512`, `2051/256`,
`8211/1024`, and `8219/1024`; the last two normalize down once. Changing the
inner voice pitch is independent of membership and timing. Arbitrary overlapping
labels reference one note definition; presentation order and performance order
are separate. Unknown intent has no invented chord or nominal position.

The four real excerpts repeat the one-note task and codec checks with irregular
timing and dense polyphony. Separate tests cover a one-note edit in 1,024 notes,
count changes, duplicate multiplicity, normalization collisions, negative pickups,
stale bases/views, inferred-label invalidation, and invalid/ambiguous membership.
Variable source clocks remain in corpus metadata; the PP comparison uses fixed
display meter and explicitly does not claim meter-map or elapsed-time fidelity.

## Deterministic measurements and interpretation

The screen checks each supported conversion, source-context preservation for
C3/C4, guarded one-note updates, independent reparse, known-ID correspondence,
group arithmetic and claim carry/staleness. Precision sweeps are a separate
candidate-2 test. Unsupported wider state remains a refusal, not a passing
projection. A declared single-channel scope can support a narrower PP workflow,
but that requires explicit scope metadata and is not native channel encoding.

Per-stage measurements use one warm-up and five local samples. Raw samples and
medians are retained for encoding, decoding, guarded commands, and baseline
combined claim build/seal and separate parse. Sampled `heapUsed` changes are
recorded separately;
they are neither peak allocation nor retained-memory measurements and may
include garbage collection. These are development observations, not latency
gates or end-to-end speedup claims.

Local `o200k_base` token counts describe emitted payloads only. Baseline documents,
structured source/context surfaces, and PP note-only surfaces contain different
information. The artifact labels those differences; their sizes cannot rank
candidates. Model instructions, retrieval, repairs and equal-information task
context must be included in the future protocol. Dense-claim optimization is
not inferred from a smaller annotation syntax.

## Reproduction and completion boundary

Prepare the pinned upstream and tokenizer using
[E353](../../context/evidence/experiments/e353-producer-pal-offline-formats-and-claims.md#reproduction-and-verification).
From `brain/`:

```sh
node --import tsx --test benchmarks/r01-candidates/common.test.mjs benchmarks/r01-candidates/structured.test.mjs benchmarks/r01-candidates/corpus.test.mjs
node --import tsx benchmarks/r01-candidates/precision.test.mjs /path/to/upstream > /tmp/r01-precision.json
node --expose-gc --import tsx benchmarks/r01-candidates/run.mjs /path/to/upstream /path/to/tooling > /tmp/r01-screen.json
```

The screen runs from retained excerpt data without Ghostworks access. Optional
source regeneration reads only the pinned development files as described in
the corpus contract. No command connects to a DAW, deploys an extension, writes
the library, or calls a model. This package completes the initial specification,
prototype and deterministic screen, with explicit bounded coverage. Next is
review of these concrete contracts and preparation of the frozen agent pilot;
it does not establish that any candidate improves agent performance.

Separately, [E355](../../context/evidence/experiments/e355-r01-subscription-cli-smoke.md)
records two unscored subscription CLI smoke calls and their accounting/isolation
limits. The smoke driver makes external model calls; the commands above remain
offline. See the [CLI trial controls](TRIAL-PROTOCOL.md#subscription-cli-route)
before preparing scored runs.

The operator subsequently accepted C4 note rows inside group-local FIELDS.
[E356](../../context/evidence/experiments/e356-r01-nested-fields-prototype.md)
records exact-state checks, local payload measurements and two unscored agent
development edits. [E357](../../context/evidence/experiments/e357-r01-compact-fields-prototype.md)
adds the verified C3 FIELDS surface. [E358](../../context/evidence/experiments/e358-r01-matched-development-pairs.md)
completes matched cards/tasks and the offline scorer rehearsal.
[E359](../../context/evidence/experiments/e359-r01-cli-controls-and-model-selection.md)
adds [CLI controls](CLI-CONTROLS.md), seeded order and bounded repairs, plus
the [historical model inventory](MODEL-HISTORY.md).
[E361](../../context/evidence/experiments/e361-r01-claude-controls-and-paired-rehearsal.md)
admits historical Haiku for development runs and rehearses the paired runner on
11 development attempts.
[E362](../../context/evidence/experiments/e362-r01-codex-isolation-and-remaining-gates.md)
verifies Codex global AGENTS/skill isolation and explores retries locally;
[D55](decisions/d55-r01-luna-model-selection-evidence.md) admits
pinned Luna model selection without server attestation.
[D56](decisions/d56-r01-codex-reject-tool-use.md) allows unused
declarations and rejects any tool invocation.
[E363](../../context/evidence/experiments/e363-r01-codex-luna-admission.md) admits
Luna with the fixed context policy and a fresh correct edit.
[D58](decisions/d58-r01-retries-are-reporting.md) makes retries
reporting only and accepts normal in-turn self-correction.
[D57](decisions/d57-r01-natural-token-use.md) removes the output
ceiling gate; [E365](../../context/evidence/experiments/e365-r01-haiku-effort-calibration.md) calibrates Haiku to `low` effort and reports the remaining gap. The operator answered
the [pilot draft](PILOT-DRAFT.md)'s review list: Haiku 5.5 and Luna cohorts,
with Luna (E363) and Haiku 5.5 ([E364](../../context/evidence/experiments/e364-r01-haiku55-admission.md)) admitted, in the development [trial stage](PILOT-DRAFT.md#trial-stages). Neither unpaired edits, the
small development rehearsal nor local token
savings establish candidate superiority. The brief tracks the
[remaining steps](../../context/work/r01-format-comparison.md#immediate-next-steps).
