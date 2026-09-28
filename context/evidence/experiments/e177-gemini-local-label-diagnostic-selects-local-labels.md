---
title: E177 — Gemini local-label diagnostic selects local labels
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4c-compact-bar-paired-development.md
---

# E177 — Gemini local-label diagnostic selects local labels

## Verdict

The frozen Gemini diagnostic returns `select-local-labels`. All eight frozen
gates passed. The locally labeled compact row advances as the candidate for
the offline benchmark-hardening follow-up.

This result does not select a public format or start holdout. The cases were
selected after the v12 result, and the run used only Gemini.

[D24](../../decisions/d24-forward-compact-benchmarks-retain-fields-and-local-labels.md)
later retains both `FIELDS` and local labels for forward work. It preserves
this diagnostic result but supersedes its single-candidate consequence.

## Completed run

All 32 approved message requests completed. No request failed, retried, or
reached a budget stop. Every response used `gemini-3.8-flash`.

The run cost USD 0.057254 after final aggregate rounding. The exact settled
total was USD 0.05725425 against the USD 0.150000 hard limit.

Both arms passed strict syntax on all 16 responses.

## Analysis result

| Case | `FIELDS` full pass | Local-label full pass | `FIELDS` correct checks | Local-label correct checks |
|---|---:|---:|---:|---:|
| 95 | 1/4 | 4/4 | 20/32 | 32/32 |
| 97 | 0/4 | 4/4 | 17/32 | 32/32 |
| **Total** | **1/8** | **8/8** | **37/64** | **64/64** |

The local-label payload was identical across all four repeats for each case.
The `FIELDS` arm produced one correct result and several distinct wrong
results. Its repeated failures affected root, quality, inversion, and function
classification.

Local labels exceeded the frozen minimum on both cases. They gained seven
full passes and 27 correct field checks over `FIELDS`.

## Progression diagnostic

Local labels passed 3/8 progression responses. `FIELDS` passed 1/8. Both arms
passed syntax on all eight responses.

This difference did not promote local labels. The frozen rule treats
progression musical pass as diagnostic because the current task is at a
reasoning floor.

## Frozen gates

All gates passed:

- complete calls;
- strict syntax;
- repeated analysis benefit on both cases;
- total analysis full-pass benefit;
- total analysis component benefit;
- analysis prompt size;
- progression payload size; and
- progression syntax.

The deterministic size ratios remain 1.078625 for analysis prompts and
1.836469 for perfect progression payloads.

## Evidence limit

This is strong repeated evidence for local semantic binding on the selected
Gemini stress cases. It is not a fresh family estimate. It does not establish
the effect on other Gemini cases, other providers, or the full task suite.

The run did not repeat exact JSON or positional v1. It answers only whether
the local-label candidate clearly beats current `FIELDS` on the predeclared
stress diagnostic.

## Identity

The raw-response aggregate SHA-256 is
`363098b76f9d1516130ee6db07bf02bfcff4145ab664425495742aea31e81c73`.
The provider manifest SHA-256 is
`cf639b8e7693dc8c82b7ae047d3d4c729c984327ea10a2a3898f9360249e070d`.
The summary SHA-256 is
`3d8541fdf5264813bbe6ad8fc2111479007b6eb0a3bcaf589d212d88bd13f126`.

## Consequence

Phase 8c4c diagnostic selection is complete. D24 retains local labels and
`FIELDS` in the symbolic benchmark-hardening follow-up. That follow-up must
freeze both candidates in a new corrected package before targeted holdout.

Do not change a frozen historical package or start provider work during the
hardening session.

## Retrospective

Repeated stress cases separated stable format binding from one-shot success.
Keep the post-hoc evidence limit explicit and require fresh validation later.
