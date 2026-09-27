---
title: Phase 8c1 — Expanded symbolic-format comparison
kind: plan
state: complete
status: The expanded comparison is complete. Develop compact candidates, then run a fresh full matrix.
updated: 2026-09-27
parent: README.md
prev: 8e-cache-scale-limits-and-degradation.md
next: 8c2-compact-grammar-correction.md
evidence: E109, E110, E115, E117, E137, E140; D21, D23
---

# Phase 8c1 — Expanded symbolic-format comparison

## Result

Complete. [E140](../../evidence/experiments/e140-expanded-symbolic-format-comparison-requires-revision.md)
records the fixed package, three-provider run, and `revise` decision.

Compact-bar stayed inside the frozen 12.5 percentage-point paired margin
against every eligible comparator. It did not pass the separate repeated-loss
rule. Each provider had at least one task family with two or more compact-only
losses against a comparator.

The v1 compact arm also changed the retained labeled v0 spelling to an
unlabeled development shorthand. [Phase 8c2](8c2-compact-grammar-correction.md)
now owns a focused, multi-iteration compact-format development loop and fresh
targeted holdout. [Phase 8c3](8c3-full-symbolic-format-matrix.md) then owns the
fresh full retained matrix. Phase 8f remains blocked until 8c3 gives a
`proceed` decision.

## Purpose

Resolve the main limit of the Phase 8c benchmark before the compact-bar
contract becomes stable. Test comprehension, generation, continuation, and
transformation with deterministic musical checks and repeated provider calls.

Compare established formats in two conditions where the task permits it:

- the native format without a Ghostnote side ledger; and
- the existing composite form with exact task fields and identities.

The native condition is an intentional best-case comparison. It can show
whether an established notation helps a model complete a musical task. It
cannot prove stable edit identity, omitted-field preservation, sparse changes,
or safe merge behavior.

Keep the public compact-bar contract and the internal cache contract unchanged
in this session. Do not begin the original Phase 8f contract work until this
comparison is complete.

## Questions

1. Does compact-bar match established formats on deterministic musical tasks?
2. Does a native notation gain accuracy when it does not coordinate with a
   side ledger?
3. How much accuracy, token cost, output size, and failure risk does a side
   ledger add?
4. Does bounded one-cycle mini-notation help on tasks that fit its native
   semantics?
5. Are the results stable across fixtures, repeated calls, and three provider
   families?
6. Which compact-bar problems, if any, need correction before Phase 8f?

Do not infer provider training data from a format result. Treat familiarity as
a behavioral hypothesis only.

## Benchmark package

Create a new versioned benchmark package. Do not modify the fixed Phase 8c v0
artifacts or their recorded hashes. Reuse their canonical corpus, renderer,
parser, provider, and scoring code where it remains valid.

Use a new protocol identifier such as
`ghostnote-symbolic-format-benchmark-v1`. Pin generated fixtures, prompts,
grammars, expected results, provider settings, and run manifests. Keep the
semantic source independent from every renderer.

## Representation arms

Retain these controls:

- compact-bar;
- exact JSON as the complete event and ledger-only control; and
- bounded one-cycle mini-notation as a native pattern control.

Run native and composite pairs for:

- ABC 2.1;
- Alda;
- MIDI-Like;
- REMI+; and
- OctupleMIDI.

The composite arms include the Ghostnote side planes or task extensions needed
for exact fields and identities. The native arms can use documented native
features. They must not use Ghostnote IDs, duplicated exact events, or
Ghostnote-only labels.

Define an eligibility manifest before provider calls. For each arm and task,
state:

- represented fields and timing resolution;
- native defaults and loss;
- whether the arm can express the input and required output;
- whether it returns a full replacement or a sparse change;
- whether identity and preservation can be scored; and
- every external parser, renderer, or semantic assumption.

Mark an unsupported native task ineligible before the run. Do not score it as
a model failure. Do not combine scores across different eligible task sets.

## Mini-notation boundary

Use one fixed cycle with a declared beat length. Keep the subset deterministic.
Permit subdivision, sequencing, superposition, grouping, rests, and bounded
repetition only when the local expander supports them exactly.

Do not use cross-cycle state, probability, alternation, stochastic functions,
or unbounded pattern transforms. Use native aligned property patterns only if
the retained contract can expand them into one canonical cycle without an
external side ledger.

Mini-notation can join comprehension, generation, continuation, and
transformation tasks that fit this boundary. It remains ineligible for stable
finite note identity and preservation claims.

## Musical cohort

Use generated material under the repository MIT license. Cover:

- monophony, chords, independent voices, and synchronized tracks;
- 3/4, 4/4, 5/4, binary subdivisions, triplets, swing, and exact offsets;
- major, minor, modal, altered-dominant, extended, and non-tertian harmony;
- repeated and transformed motifs;
- voice ranges, inversions, voice leading, cadence, and role separation; and
- velocity and other performance fields when the tested arm represents them.

Use separate development and retained cohorts. Freeze the retained fixtures,
prompts, renderers, parsers, and scoring rules before the retained provider
calls. If a later compact-bar revision uses retained results, give that revision
a new cohort and protocol version.

## Core task set

Use focused calls. Do not put all tasks into one model response.

### Comprehension

1. Reconstruct the represented event structure. Include exact onsets,
   durations, polyphony, meter changes, and performed offsets.
2. Identify supplied harmonic functions, chord roots and inversions, motif
   relations, and rhythmic structure. Accept a declared set of valid analyses
   where theory is ambiguous.

### Generation

3. Realize a supplied Roman-numeral progression. Require selected inversions,
   voice ranges, no voice crossing, a bounded voice-leading cost, and a stated
   cadence. Permit multiple valid voicings.
4. Create a melody and rhythm under a supplied key or mode, chord progression,
   range, density, motif, cadence, and syncopation contract. Permit multiple
   valid melodies.

### Continuation

5. Continue a seed motif with a specified transposition, inversion, sequence,
   augmentation, or diminution relation. Require an exact relation but permit
   more than one valid continuation.
6. Continue a multi-role phrase over fixed harmony and accompaniment. Check
   role ranges, strong-beat chord membership, voice leading, density,
   collisions, overlap, and cadence.

### Transformation

7. Apply exact local pitch, timing, insertion, or deletion changes while all
   unrelated represented events remain unchanged.
8. Revoice a chord progression under drop-2, inversion, range, or nearest-voice
   constraints while the harmony remains unchanged.
9. Apply rhythmic augmentation, diminution, quantization, or a declared groove
   transfer. Check the exact onset and duration relation.

Give each core task at least three independent retained fixture variants. An
exact edit can have one correct result. A creative task should permit multiple
results that satisfy the same deterministic contract.

For native-only transformations, use unambiguous musical coordinates and allow
a complete rewritten score. Derive the canonical event diff after parsing.
Score the musical result separately from edit size, identity, and preservation.

## Secondary tasks

Use a smaller secondary cohort for:

- malformed notation and one exact-feedback repair;
- masked or missing musical values that require refusal;
- score and side-ledger disagreement;
- unknown, duplicated, or stale IDs in identity-bearing arms; and
- unsupported native requests that must be identified without invention.

Score the initial response and repair response separately. Do not replace an
initial failure with its repaired score.

## Deterministic verification

Compile every valid response into one canonical note representation before
musical scoring. Use:

- the exact-note wrapper for event identity, coverage, timing, ranges,
  collisions, overlap, invariants, and canonical diffs;
- Music21 for chord roots, inversions, Roman numerals, keys, cadence, and basic
  voicing checks;
- Musicpy for drop-2 and nearest-progression voicing checks; and
- Tonal for notes, pitch classes, scales, intervals, chord membership, and
  transposition checks.

Do not accept a third-party analyzer result without a bounded contract. Give
each verifier known-pass, near-miss, and known-fail fixtures. Prefer supplied
keys and harmonic functions over unconstrained key inference. Preserve valid
alternative labels when the musical evidence is ambiguous.

This benchmark measures constraint satisfaction. It does not measure general
musical quality. Keep any later blind listening ballot separate.

## Provider protocol

Extend the current direct provider harness with Claude support. Read
`CLAUDE_API_KEY` from the existing environment loader. Never print, copy, hash,
or retain the key.

Use these provider families:

- the pinned GPT-5.4 Mini snapshot used by Phase 8c;
- Gemini 3.8 Flash, with the returned version recorded; and
- Claude Sonnet 5 through the Messages API.

Use low reasoning or effort on all three providers. For Claude, set
`output_config.effort` to `low`. Use structured output for the common outer
response envelope only. Parse and validate the musical payload separately so
that provider JSON constraints cannot hide notation errors.

Keep semantic instructions, examples, output fields, and maximum output sizes
equivalent. Record every format-specific grammar byte and token. Use one seeded
interleaved call order. Record requested and returned model identity, settings,
usage, cached usage, latency, retries, stop reason, and raw-response hash.

Retry only transport, rate-limit, and provider-server failures. Do not retry a
valid model response because it scored poorly.

## Trial count and stopping rule

Run a short cost and validity pilot before the retained cohort. Use it to fix
provider integration, estimate prompt and output cost, and set a paired
non-inferiority margin before any retained result is visible.

Start each retained eligible format, task, and provider cell with the three
independent fixture variants. Add a repeated-prompt sentinel for each task
family. The sentinel must include compact-bar, one native-only arm, and one
composite arm on every provider.

If the three equivalent trials agree and the paired conclusion is clear, stop
that cell. If results are mixed, or if a decision-critical comparison remains
within one outcome, add trials in batches of two. Stop at five when the result
settles. Extend to seven only when the conclusion is still unstable.

Treat USD 5 per provider as a soft planning ceiling, not a spending target.
Stop below it when the stopping rule is satisfied. Before the retained run,
project the cost from measured pilot usage. Notify the operator before a run
that is expected to exceed USD 5 for any provider. Do not change models or give
providers different semantic cohorts to meet the budget.

Report actual cost per call, task, format, and provider. Report cached and
uncached token cost separately where the API supplies enough usage data.

## Measurements

Primary measurements:

- first-response deterministic musical-task success;
- exact constraint and field checks by task family;
- paired compact-versus-native and compact-versus-composite deltas; and
- paired native-versus-composite side-ledger deltas.

Secondary measurements:

- syntax, parser, and compiler success;
- score-to-ledger alignment failures;
- repair success and error locality;
- exact preservation and identity checks where applicable;
- complete-output and sparse-edit bytes and tokens;
- input, cached input, output, thinking, latency, retries, and USD cost; and
- provider and repeated-call variation.

Report provider results separately. Pool a result only when the task,
eligibility, and result direction match. Use paired fixtures for every claimed
format delta. Do not turn an unavailable product capability into a zero musical
score or a missing musical score into a product pass.

## Decision rule

Freeze the sample size rule and non-inferiority margin after the pilot and
before retained calls. State whether the available sample can support the
claimed margin. Do not claim equivalence from an underpowered tie.

Compact-bar can remain the Phase 8f direction when:

- it is not materially worse on the eligible deterministic musical tasks;
- no provider shows a repeated compact-specific failure that the pooled result
  hides; and
- its stable identity, exact preservation, sparse edit, conflict, and intent
  advantages remain intact.

A native-only win is evidence about musical task performance. It is not a
product-contract win unless the arm also meets the identity and preservation
gates.

If compact-bar has a material deficit, classify it as grammar, prompt,
renderer, parser, missing musical structure, or unrelated provider variation.
Revise compact-bar only against development fixtures. Test a revision on a new
retained cohort. If a fresh rerun still shows the deficit, keep Phase 8f blocked
and record the next bounded change instead of tuning against the holdout.

## Outputs

- A versioned expanded benchmark package beside, not over, the Phase 8c v0
  package.
- Native and composite renderers, parsers, capability manifests, and exact
  reconstruction gates.
- Deterministic music-theory verifiers and their positive and negative tests.
- A Claude provider adapter and usage accounting.
- A frozen protocol and retained run manifests for all three providers.
- One evidence report that separates musical task results, side-ledger cost,
  product capability, nondeterminism, and provider cost.
- Updates to the compact-bar rationale, prior-art matrix, limitations, and
  reproducibility guide where the evidence changes them.
- A clear proceed, revise, or block decision for Phase 8f.

## Acceptance criteria

- The fixed Phase 8c v0 package and hashes remain unchanged.
- Every retained arm passes its deterministic capability screen before model
  calls.
- Native and composite conditions use the same semantic fixtures wherever both
  are eligible.
- The retained cohort covers comprehension, generation, continuation, exact
  local transformation, harmonic transformation, and rhythmic transformation.
- Creative tasks accept multiple correct outputs through deterministic
  constraints.
- Native-only transforms are scored on canonical results without pretending
  that they preserve stable identity.
- Mini-notation uses one declared cycle and no hidden unrolling or side ledger.
- Exact JSON, compact-bar, native formats, and composite formats remain
  separate arms.
- GPT, Gemini, and Claude run the same eligible retained cohort with recorded
  low-reasoning settings.
- Trial growth follows the frozen stopping rule. Cost can stop below USD 5 per
  provider. The operator receives notice before a projected overrun.
- Initial and repaired results remain separate.
- Side-ledger mismatches and overhead are explicit measurements.
- The evidence states whether compact-bar is non-inferior, underpowered, or
  materially worse. It does not turn a tie into a win.
- No API key, third-party composition, provider cache, live project mutation,
  or temporary generated music remains in the repository.
- Focused benchmark tests, the complete brain check, `context/check.rb`, and
  `git diff --check` pass.

## Out of scope

- General musical-aesthetic ranking.
- Claims about private provider training data.
- Fine-tuning or training a music model.
- Live Bitwig writes or cache changes.
- Freezing the final compact-bar syntax.
- Making a native-only arm satisfy identity requirements it does not claim.
- External publication.

## Retrospective target

Record which result came from notation syntax, supplied musical structure,
side-ledger coordination, stable identity, or compiler enforcement. Record
whether the adaptive stopping rule saved calls without weakening a decision.
