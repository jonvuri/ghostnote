---
title: E173 — Fresh full-family comparison awaits approval
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4c-compact-bar-paired-development.md
---

# E173 — Fresh full-family comparison awaits approval

## Verdict

The fresh v12 comparison passes offline and awaits exact operator approval.
No token-count or provider request occurred.

The package tests all three main decision families after the validated v11
prompt repair. It does not reuse an audited screen case or consume the
reserved v10 holdout.

## Analysis contract repair

The analysis payload contains the same eight field assignments for every
input arm. A leading legacy `ANALYSIS` label is optional and ignored. The
label cannot affect syntax or musical scoring.

Deterministic checks prove that all three arms receive the same analysis
output grammar, that correct results score identically with and without the
label, and that a missing analysis field still fails syntax.

Strict public-document parsing is unchanged.

## Fresh comparison

The comparison uses eight fresh unique fixtures for each family:

- comprehension analysis;
- motif continuation; and
- progression generation.

It runs exact-object JSON, positional compact-bar v1, and compact-bar
`FIELDS` on OpenAI, Gemini, and Haiku. It repeats the first fixture once for
each arm and family. This gives 81 message requests per provider and 243 in
total.

The report keeps each provider and family separate. It reports strict syntax,
strict full pass, paired discordant results, and repeated-sentinel stability.
It makes no repair call and no automatic retry.

The 24 new task hashes and their analysis-case hashes have no overlap with
prior benchmark artifacts. The cohort SHA-256 is
`3999a7c017aea1d0ec3c3a41b5ba505bdf5f12ac9590ffe630d37d28318f845b`.

## Cost and approval

Recent observed per-call costs estimate this run at USD 2.036394.

| Provider | Maximum messages | Estimated cost | Hard limit |
|---|---:|---:|---:|
| OpenAI | 81 | USD 0.554243 | USD 0.650000 |
| Gemini | 81 | USD 0.163238 | USD 0.300000 |
| Haiku | 81 | USD 1.318913 | USD 1.500000 |
| **Total** | **243** | **USD 2.036394** | **USD 2.450000** |

Haiku can make at most 81 token-count requests. The guard records each attempt
before its external request starts. A failed token-count or message request is
not retried.

The protocol SHA-256 is
`bfeae5de5963391d1fd751391183c1fe9ed8825abd373edb18af8b3c88f33626`.
The run-plan SHA-256 is
`879db5b7b88176af0699eae30088c6699a415e376f129e1d605e28a96a3ed405`.
The deterministic SHA-256 is
`d7d5df091f5be8df7a364b4922db131f9ce0f1312ad2e65a1cb40bbc09ba879c`.

Approval must name this run, both protocol hashes, at most 243 message
requests, at most 81 Haiku token-count requests, no repairs or automatic
retries, and the USD 2.450000 hard cost limit.

## Consequence

Do not make a provider or token-count request until exact approval exists.
The result can inform the next format decision. It cannot select a public
format or enter holdout by itself.

## Retrospective

Remove benchmark-only framing tokens from semantic measurements. Keep strict
parsing for the public format under test.
