---
title: E148 — Compact JSON calibration requires measurement repair
kind: evidence
state: active
updated: 2026-09-27
parent: ../../plan/phase-8/8c2-3-compact-json-factorial-and-native-decision.md
---

# E148 — Compact JSON calibration requires measurement repair

## Verdict

Return `repair-measurement` and stop provider work. The frozen calibration r1
completed all 210 approved calls. Progression was at a control floor on OpenAI
and Gemini. Revoicing was at a complete control ceiling on all three
providers. Role continuation was eligible, but a JSON prompt defect prevents
reuse of its format comparison.

Do not start development. A fresh conditional r2 repair plan is frozen and
awaits separate approval.

## Completed run

Each provider completed 70/70 calls with the requested model and no transport
error.

| Provider | Model | Estimate | Recorded cost |
|---|---|---:|---:|
| OpenAI | `gpt-5.4-mini-2026-03-17` | USD 0.404167 | USD 0.416980 |
| Gemini | `gemini-3.8-flash` | USD 0.256802 | USD 0.215447 |
| Claude | `claude-sonnet-5` | USD 1.429609 | USD 1.931190 |
| Total | — | USD 2.090578 | USD 2.563617 |

The operator should compare these records with the provider dashboards.

| Provider | Raw-run SHA-256 | Manifest SHA-256 |
|---|---|---|
| OpenAI | `12b86908f4fc2ec01c46f32800b5b34b7e30eaac6c66899bf975eff697b5fbc6` | `026df5fe320ea1fbded1a82ec94b2916277db3d237db1ac3986f3d9dafe99e19` |
| Gemini | `3e4362ebb9c47996c64dbc4c24722a119d23743820d138f408fb9cd4c97748ce` | `abd42a470757ce70fda534b49c087867b265217ae5fa029636a1a77630e66c55` |
| Claude | `f597f801b8d5ea474cbaa3b7df22a5574fc574ea73612706fbbe1f3b7505a0cb` | `8012c806888baa4ac7250b048f13b70215e2e226a289fb21fbddb2ed6d77e4c8` |

The retained summary SHA-256 is
`9a295ff55df68447f84aacfb2d10aa29e39ea2d8116293d0a6b9aa6bbc593a6a`.
The integrity and diagnosis report SHA-256 is
`6919a45e6995c4101fd92530c181db6269d008a3801e20d03270198ad683ce40`.
The reporter passes 41 checks.

## Eligibility result

Calibration pooled exact-object MIDI and native MIDI-like controls. A family
needed a pass rate from 0.20 through 0.90 on at least two providers.

| Family | OpenAI | Gemini | Claude | Eligible providers | Result |
|---|---:|---:|---:|---:|---|
| Progression | 0/6 | 1/6 | 2/6 | 1 | Floor; repair |
| Role continuation | 1/6 | 3/6 | 2/6 | 2 | Eligible |
| Revoicing | 6/6 | 6/6 | 6/6 | 0 | Ceiling; demote |

Revoicing is no longer a decision family. Keep it as a regression and
component diagnostic. With two future decision families, use ten development
fixtures per family. This gives a smallest macro step of 5 percentage points.

## Prompt defect

The r1 example had one note and one track. It parsed, but it could not show
the required multi-voice order. The grammar did not state the exact collection
order or task-specific score, bar, track, and region metadata.

Across progression and role continuation, JSON responses therefore used
plausible but noncanonical note or track order and invented metadata. Three
Claude exact-object progression responses also ended as unterminated nested
JSON under the 3,000-token output limit.

The r2 prompt supplies exact task metadata, a complete multi-voice example,
explicit collection order, and explicit progression pitch-class coverage.
The JSON scorer adds an `exact_metadata` check. The output limit increases to
4,000 tokens.

## Frozen repair calibration

The r2 run ID is
`phase8c2-3-json-grammar-repair-calibration-r2`. It has three fresh
progression fixtures and three fresh role-continuation fixtures. Each provider
has 30 calls across all five arms.

Run OpenAI and Gemini first. Their 60-call estimate is USD 0.338800. Run
Claude's 30 calls only if the two-provider summary returns `require-claude`.
The maximum 90-call estimate is USD 1.373366.

| Identity | SHA-256 |
|---|---|
| R2 corpus | `38bd3cb3cb490bc5cd8cf17322c460f12ffc9e623acd9549476951eb0d493663` |
| R2 cohort manifest | `fba1fd466ca26399065540e58970d1570a8eea6ed9fd242b2fa683d96e84d6a2` |
| Scorer | `f02e6d77d9d7a9d68475a2020051a2c4f32753db91cafea6952e952075bd67f4` |
| R2 protocol | `88827047bed644a810d3a09fb8b07c111be37c79badbc9ba1f37842471345aad` |
| R2 run plan | `85bbd74b344fa9986cd852f043ae70f4e248be14151a4665c7b8136eec0d5715` |
| R2 deterministic package | `9981d84c889d73a3295e26f1af3dd8e808ed591bf3f3a4331699f97a9333b93f` |

The r2 deterministic screen passes 75 checks. Its six semantic fixture hashes
do not overlap a prior or reserved cohort. The pending approval record has no
operator statement, so the harness rejects it.

## Retrospective

A parsing example must exercise every ordering dimension and required metadata
field. A one-note round trip cannot validate a multi-voice prompt contract.
