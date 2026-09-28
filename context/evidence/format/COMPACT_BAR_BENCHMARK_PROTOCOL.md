---
title: Compact-bar benchmark protocol
kind: reference
state: active
updated: 2026-09-28
parent: COMPACT_BAR_RATIONALE.md
---

# Compact-bar benchmark protocol

This document records the original v0 protocol. The
[symbolic benchmark design backlog](SYMBOLIC_BENCHMARK_DESIGN_BACKLOG.md)
tracks cross-version experiment-design findings and requirements for the next
benchmark package.

## Version and artifacts

The protocol version is `ghostnote-compact-bar-benchmark-v0`.

The fixed package contains:

- the generated semantic [corpus](../../../brain/benchmarks/compact-bar-v0/corpus.py);
- the format renderers, parsers, prompts, compiler, and
  [scorer](../../../brain/benchmarks/compact-bar-v0/benchmark.py);
- the pinned [deterministic result](../../../brain/benchmarks/compact-bar-v0/expected-deterministic.json);
- the [legacy E114 and E115 map](../../../brain/benchmarks/compact-bar-v0/legacy-baselines.json);
  and
- dated [provider manifests](../../../brain/benchmarks/compact-bar-v0/runs/2026-09-25-summary.json).

The corpus SHA-256 is
`bf17a441b4d69c7e80616dc56755904e65adf9f1fc863f5a9ba75dfed9f9791e`.
The deterministic package SHA-256 is
`837b4f4a50891e9abee665c06d2e0fd559313320f79c9f9f3672bfd64bab9fbd`.

## Corpus

All notes are generated for Ghostnote under the repository MIT license. No
third-party score, MIDI, or audio is present.

| Fixture | Notes | Bars | Coverage |
|---|---:|---:|---|
| Short | 12 | 1 | Core reconstruction, polyphony, expression, and articulation |
| Medium | 47 | 4 | 4/4, 3/4, 5/4, triplets, swing, arbitrary performed time, extended harmony, chromatic motion, quartal voicing, roles, and regions |
| Long | 94 | 8 | Repetition, long-context lookup, and token scaling |

The exact fields include channel, mute, release velocity, articulation, and four
note-expression values. Reduced renderers must declare omissions, side planes,
defaults, and loss.

## Deterministic gate

Every finite-edit arm must render and parse all represented core notes exactly.
The gate checks IDs, tracks, rational starts and durations, pitches, velocities,
note count, text hash, parsed hash, bytes, and lexemes.

Strudel has a separate native gate. The fixed pattern `[bd sd, hh*4]` expands
to six events in one cycle. Its finite Ghostnote round trip is unsupported by
design.

LilyPond is rejected before model calls because this repository does not pin a
compiler for the cohort. This is an unavailable deterministic dependency, not
a judgment about LilyPond notation.

## Agent tasks

Every finite-edit arm receives the same semantic fixtures, task text, patch
examples, output keys, and scoring rules. Its representation and format grammar
are the only format-specific prompt sections.

The scored tasks are:

- five structural facts;
- exact represented-core reconstruction of the short fixture;
- one local transpose constraint;
- six transfer constraints;
- seven continuation constraints;
- one masked-value refusal;
- one format-native task; and
- one repair after exact compiler errors.

The initial total is 22 points. Invalid-patch error exposure is recorded but is
not an extra score. The repair is reported separately.

Existing-note operations must preserve every unnamed exact field. Insertions
must use `track-neutral-v0`. The compiler supplies one source track channel,
mute false, release velocity 64, articulation `normal`, and neutral expression.

The native Strudel arm has one point. It is not combined with the 22-point
Ghostnote score.

## Measurements

The deterministic result records bytes, whitespace lexemes, rendered hashes,
field coverage, side planes, defaults, and loss.

Each provider manifest records:

- provider, requested and returned model, client, and settings;
- prompt, response, raw-response, raw-run, and manifest hashes;
- input, cached input, and output tokens;
- input tokens per note, bar, and prompt lexeme;
- initial and repair latency and retry count;
- parsed response and exact scoring details; and
- corpus and task identities.

Prompt token counts include task text, grammar, examples, and side ledgers.

## Dated controlled result

The 2026-09-25 run used GPT-5.4 Mini and Gemini 3.8 Flash. Both used low
reasoning or thinking. Gemini used temperature zero. Neither run retried.

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

All finite arms passed deterministic represented-core round trip before these
calls. Both providers passed all format-native tasks. Both also produced valid
patches for all 14 counted patch constraints in every finite arm. All 14 repair
calls passed.

The summary SHA-256 is
`45c6aae049bbb6508651b5914dd9fc821fc46446d381595d577802a33c86ef0c`.
The OpenAI raw-run SHA-256 is
`b9ccfe043a0e6d40bf40daabcc1dfa3dd6042d7377c90f507743e606781a58fd`.
The Gemini raw-run SHA-256 is
`f2897f6690a3685a7e89c73ad0e2d1e32e2b6f62cbcb42ee3f63d3885e5705ed`.

## Interpretation rules

Report native-purpose and Ghostnote round-trip tasks separately. Do not rank
Strudel on a task it does not claim to own. Do not treat the ABC or Alda side
ledger as a base-format feature. Do not infer private training data from a
published-label result.

Human readability and native strengths are qualitative notes. They are not
objective score points.
