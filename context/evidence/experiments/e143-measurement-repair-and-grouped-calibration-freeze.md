---
title: E143 — Measurement repair and grouped calibration freeze
kind: evidence
state: active
updated: 2026-09-27
parent: ../../plan/phase-8/8c2-2-measurement-repair-and-grouped-compact-iteration.md
---

# E143 — Measurement repair and grouped calibration freeze

This evidence records the pre-run freeze. [E144](e144-calibration-rejects-progression-floor.md)
records the completed calibration and its `repair-measurement` decision.

## Result

The Phase 8c2.2 offline gate passes. The new
[compact-format v3 package](../../../brain/benchmarks/compact-format-v3/README.md)
repairs the task measurement, adds one grouped-label candidate, and freezes
three fresh cohorts. No provider call has started.

The calibration run ID is `phase8c2-2-calibration-r1`. Its protocol SHA-256 is
`b74a1793406bfee7e5143ca9673a7de82e1a7573e429e291f2e3fbc5846a4c26`.
Its corpus SHA-256 is
`dd87fb7df5aebc4515f2bc5f3ed72ab029914f02d59d95de9cefefd35a0027b1`.
Its run-plan SHA-256 is
`cdd26d8daad166f1329dcf66571ab2aec71804e190b12204d9f173ceca5771e7`.
The approval record is pending.

## Measurement repair

The new revoice prompt and scorer use the same properties. They preserve note
count, chord starts, IDs when present, duration, voice, velocity, pitch
classes, global and per-voice ranges, and strict voice order. The prompt
defines `nearest`, `drop-2`, and `first-inversion`. The scorer tests properties
instead of one hidden pitch answer. It accepts both valid realizations in a
fixed tied-nearest case.

The progression result keeps an all-constraints primary result. It also
reports chord starts and named voices, harmony and bass inversion, voice ranges
and crossing, total voice leading, and cadence separately. Calibration will
keep the primary result only if the pooled exact JSON and native MIDI-Like
controls are from 0.20 through 0.90 on at least two providers.

The task-to-scorer audit covers every retained family. The deterministic suite
has positive and invalid negative cases for every arm and task. Every scorer
check has a one-property mutation case. Each case fails only its related check.
The final calibration aggregation has an informative test and a
revoice-floor test. The tests require the correct `proceed-development` and
`repair-measurement` results before paid calls.

## Frozen v2 diagnostic

The new scorer was applied to the old responses as a labeled post-run
diagnostic. The diagnostic has SHA-256
`e320a56a45e8edd090c7225b502781f3272659f7caeab6fa4f72196ce971664a`.
It does not change the frozen v2 files, responses, hashes, or `do-not-select`
decision.

Across the old development outputs, the repaired diagnostic found 42/54
revoice passes. Across the old holdout outputs, it found 20/36. The old scorer
found zero in both cases because it used the wrong duration and one exact pitch
answer. The old holdout progression primary stayed at 2/36. Its component
vector shows that harmony and bass inversion are the main constraint loss.

Under the post-run counterfactual, the old holdout gate would pass on Gemini
and Claude. Their label-only hard-macro deltas become +8.33 points. OpenAI
stays at 0.00 points. This result cannot select label-only compact. The old
prompt did not define its revoice operations, and the definitions were added
after the responses existed. The frozen holdout decision remains
`do-not-select`.

## Grouped-label candidate

The candidate uses one onset block for two or more notes. It shares duration at
the block level when possible. Named `SLOT` rows keep role or voice, ID, pitch,
and velocity explicit. A single note uses one labeled event row. The format has
one canonical score and no side ledger.

The capability suite passes renderer, parser, canonical-order, round-trip,
identity, exact-preservation, sparse-patch, and mixed-duration tests. On the
fixed structure fixture, the grouped output-byte ratio to exact JSON is 0.501.
The prompt token estimate ratio is 0.626. Provider-measured tokens and response
bytes remain the selection authority.

## Fresh cohorts

Calibration, development, and holdout contain 14, 44, and 44 semantic
fixtures. Their full fixture hashes and semantic hashes have no pairwise
overlap. They also have no semantic overlap with symbolic-format v1 or either
compact-format v2 cohort.

The development corpus SHA-256 is
`9e1db0a422e63a1983e04203ff43f9a53e5e169c6405354b6cd0357b383abd7c`.
The holdout corpus SHA-256 is
`cf34bfd93948d6c7fe63b157193fce78247a16e562caef557ea9f1f9eb80d846`.
The cohort manifest records every full and semantic fixture hash. Its SHA-256
is `6c8cfda41855a5840532c92be07518153d83fcb54130f2fc032cef00a7ba746e`.

Development and holdout each reserve eight fixtures for each of progression,
role continuation, and revoicing. With three decision families, the smallest
hard-macro step is 4.17 points. Each also reserves four melody fixtures and
four fixtures for each guard family. Calibration has three fixtures for each
decision family, one melody fixture, and one fixture for each guard.

## Calibration scope and cost

The five arms are compact-bar v1, label-only compact, grouped-label compact,
exact JSON, and native MIDI-Like. Each provider gets 70 calls. The total is 210
calls. There are no repeated prompts.

| Provider | Model | Settings | Calls | Estimated cost |
|---|---|---|---:|---:|
| OpenAI | `gpt-5.4-mini-2026-03-17` | low reasoning, 3,000 maximum completion tokens | 70 | USD 0.404167 |
| Gemini | `gemini-3.8-flash` | low thinking, 3,000 maximum output tokens | 70 | USD 0.256802 |
| Claude | `claude-sonnet-5` | low effort, 3,000 maximum tokens | 70 | USD 1.429609 |
| Total | — | provider default temperature | 210 | USD 2.090578 |

The estimate uses the larger recent observed mean call cost for each provider
and adds 25 percent. The model prices were rechecked on 2026-09-27 against the
[OpenAI model page](https://developers.openai.com/api/docs/models/gpt-5.4-mini),
[Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), and
[Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing).
The provider dashboards remain the external spend authority.

The stopping rule is fixed. Pool exact JSON and native MIDI-Like within each
provider and family. A decision family is eligible only when its primary pass
rate is from 0.20 through 0.90 on at least two providers. If one family is not
eligible, return `repair-measurement` and stop provider work. Otherwise, return
`proceed-development`. Do not start development without a new plan and
separate approval.

## Verification

The self-test passes 186 checks. The deterministic package SHA-256 is
`ae57e2ef3b0e326e7ba1ec4313359053e10bdcfdb28d96726358446b6916734b`.
The frozen compact-format v2 tree SHA-256 stays
`57d854205d62f97e1fd79614b6d723cbbb9d79ce59fd581103bbfd16d193235a`.
No provider, cache, runtime, or live Bitwig project changed.

## Retrospective

Keep semantic overlap checks in addition to full fixture hashes. They found
cohort collisions during offline implementation that metadata-specific fixture
hashes did not show. Contract mutations and aggregation branch tests now run
before paid calls.
