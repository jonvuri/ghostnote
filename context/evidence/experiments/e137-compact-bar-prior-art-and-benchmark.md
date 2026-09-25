---
title: E137 — Compact-bar prior art and benchmark are reproducible
kind: evidence
state: active
updated: 2026-09-25
parent: ../../plan/phase-8/8c-compact-bar-prior-art-and-benchmark.md
---

# E137 — Compact-bar prior art and benchmark are reproducible

## Verdict

The Phase 8c comparison package is fixed and reproducible. It separates
deterministic conformance, provider-dependent agent behavior, format-native
tasks, Ghostnote finite-edit tasks, and current live evidence.

Compact-bar keeps its main measured advantage: small task context with explicit
musical fields and opaque edit IDs. It uses 33.4% of exact JSON bytes across the
fixed corpus. It uses 56.0% fewer GPT input tokens and 52.8% fewer Gemini input
tokens than exact JSON. It did not win the objective score. GPT scored it 19/22
and exact JSON 20/22. Gemini scored both 22/22.

All finite arms produced valid patches for all 14 compiler constraints on both
providers. All 14 repair calls passed. Strudel passed its native pattern task on
both providers and was not scored as a finite note editor.

This result does not freeze compact-bar syntax. It makes no claim about private
model training data. No live Bitwig write or external publication occurred.

## Durable package

The reusable package is
[compact-bar v0](../../../brain/benchmarks/compact-bar-v0/README.md). Its corpus
contains generated MIT material only.

| Fixture | Notes | Bars | Main coverage |
|---|---:|---:|---|
| Short | 12 | 1 | Core reconstruction, polyphony, expression, articulation |
| Medium | 47 | 4 | Several meters, triplets, swing, arbitrary performed time, harmony, chromatic motion, roles, regions |
| Long | 94 | 8 | Repetition and context scaling |

The corpus SHA-256 is
`bf17a441b4d69c7e80616dc56755904e65adf9f1fc863f5a9ba75dfed9f9791e`.
The deterministic package SHA-256 is
`837b4f4a50891e9abee665c06d2e0fd559313320f79c9f9f3672bfd64bab9fbd`.

The seven finite arms parsed and rendered every represented core event exactly.
The Strudel pattern expansion also passed. LilyPond was screened out before
model calls because the repository does not pin a compiler for this cohort.
This is a reproducibility limit, not a notation-quality verdict.

The [rationale](../format/COMPACT_BAR_RATIONALE.md),
[prior-art matrix](../format/SYMBOLIC_MUSIC_PRIOR_ART.md),
[limitations](../format/COMPACT_BAR_LIMITATIONS.md),
[protocol](../format/COMPACT_BAR_BENCHMARK_PROTOCOL.md), and
[reproducibility guide](../format/COMPACT_BAR_REPRODUCIBILITY.md) form the fixed
documentation package.

## Dated provider result

The controlled run used `gpt-5.4-mini-2026-03-17` and
`gemini-3.8-flash`. Both endpoints returned the requested model. Both used low
reasoning or thinking. Gemini used temperature zero. No call retried.

| Format | GPT score | Gemini score | GPT input | Gemini input |
|---|---:|---:|---:|---:|
| Exact JSON | 20/22 | 22/22 | 12,534 | 13,264 |
| Compact-bar | 19/22 | 22/22 | 5,513 | 6,255 |
| ABC with side ledger | 22/22 | 22/22 | 6,429 | 7,566 |
| Alda with side ledger | 22/22 | 22/22 | 6,581 | 7,448 |
| MIDI-Like task profile | 22/22 | 20/22 | 7,127 | 9,385 |
| REMI+ task profile | 22/22 | 22/22 | 7,718 | 8,858 |
| OctupleMIDI task profile | 20/22 | 22/22 | 9,138 | 10,510 |
| Strudel native task | 1/1 | 1/1 | 162 | 160 |

GPT lost compact-bar points by returning second-repeat IDs from the long fixture
and by adding objects where two structural fields required string lists. These
were strict output errors. Its patches, reconstruction, refusal, and native task
passed. Gemini passed every compact-bar check.

The MIDI-Like Gemini result confused one time shift with an absolute performed
start, missed exact reconstruction, and missed one transfer constraint. The
OctupleMIDI GPT result reconstructed the medium fixture instead of the short
fixture and returned no structural object. The score keeps these errors. It
does not repair or reinterpret them after the run.

The OpenAI raw-run SHA-256 is
`b9ccfe043a0e6d40bf40daabcc1dfa3dd6042d7377c90f507743e606781a58fd`.
The Gemini raw-run SHA-256 is
`f2897f6690a3685a7e89c73ad0e2d1e32e2b6f62cbcb42ee3f63d3885e5705ed`.
The scored summary SHA-256 is
`45c6aae049bbb6508651b5914dd9fc821fc46446d381595d577802a33c86ef0c`.

## Historical trace

The [legacy baseline manifest](../../../brain/benchmarks/compact-bar-v0/legacy-baselines.json)
pins the E114 and E115 fixture, representation, raw-run, claim, and scorer
identities. The old probes remain runnable. The new corpus does not pretend to
be the same prompt or score.

The new result agrees with the useful historical boundary. Compact-bar uses
about half the input tokens of exact JSON and gives enough identity and timing
for guarded edits. It does not repeat E115's claim that compact-bar has the top
objective score. Several composite prior-art arms score higher here.

## Native-purpose boundary

ABC, Alda, and the model-token families receive exact task extensions where
their base form does not own a Ghostnote field. Those bytes and tokens are
counted. Their successful Ghostnote edits are results for the composite
profile, not the base format alone.

Strudel receives only one native cyclic pattern task. Its success confirms that
the benchmark does not penalize a pattern language for lacking finite edit
identity. Human readability and format-native strengths remain qualitative.

## Live evidence kept separate

E120 records one 775-byte compact live read with no write. E121 records one
reference-conditioned live patch, exact readback, reversal, and operator
acceptance. E129 records range refusal, visible consolidation, reacquisition,
one guarded insertion, exact reversal, and cleanup.

These results show that compact context and guarded patches connect to live
state. They are not direct provider-format comparisons and do not add points to
the Phase 8c table.

## Cause separation

Compact-bar's byte and token result comes from sparse syntax and selected task
fields. Its grounded edits come from opaque identities. Preservation, defaults,
and rejection come from the compiler outside the model. The current run does
not isolate a syntax-only accuracy advantage.

The composite ABC and Alda arms show this distinction. Once an exact side ledger
supplies task fields and identities, they can match or exceed compact-bar task
accuracy. That does not make the side ledger a native score feature.

## Verification and cleanup

The fixed self-test passes 17 checks. The deterministic expected-result check
passes. The legacy E114 and E115 self-tests pass 16 and 8 checks. The complete
brain check passes 1,182 tests. The context check passes 368 active documents
with intact links. The staged diff check passes.

The provider manifests contain generated symbolic text only. No live project,
audio, or MIDI file was sent. No provider cache, generated music file, or live
test residue remains. The dated run manifests are retained as evidence.

## Retrospective

Literal patch examples removed generic schema noise before the retained run.
The remaining result shows no syntax-only winner. Future comparisons must keep
task fields, edit identities, and compiler behavior as separate causes.
