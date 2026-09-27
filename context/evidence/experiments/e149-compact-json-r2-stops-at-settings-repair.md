---
title: E149 — Compact JSON r2 stops at settings repair
kind: evidence
state: active
updated: 2026-09-27
parent: ../../plan/phase-8/8c2-3-compact-json-factorial-and-native-decision.md
---

# E149 — Compact JSON r2 stops at settings repair

## Verdict

Return `repair-measurement` and stop. OpenAI and Gemini completed the approved
r2 cheap stage. The frozen rule does not permit Claude. Do not start
development.

Role continuation reached a complete ceiling. Progression remains the only
decision family. A transport audit also found that the provider helper used a
3,000-token output limit while the frozen plan declared 4,000 tokens.

## Completed run

The operator approved r2 with the statement, "I approve, proceed with R2."
Each provider completed 30/30 calls with the requested model and no transport
error.

| Provider | Model | Estimate | Recorded cost |
|---|---|---:|---:|
| OpenAI | `gpt-5.4-mini-2026-03-17` | USD 0.223382 | USD 0.213571 |
| Gemini | `gemini-3.8-flash` | USD 0.115418 | USD 0.110506 |
| Total | — | USD 0.338800 | USD 0.324077 |

The operator should compare these records with the provider dashboards.

| Provider | Raw-run SHA-256 | Manifest SHA-256 |
|---|---|---|
| OpenAI | `e32aef2e353a0ab51e7625251a3489b5bb1dcd4b1319e5718af2f10f2b826d82` | `e2be7e7721f93b7a90a42e830cc55185c5434dc080ac8811a65a907a41ee24ea` |
| Gemini | `2f68b5e5723105c9c8fbad17007611e491b961b9deab1b20775b49aae9a0f85e` | `3d48d040e490912d8421aa57f0ea3d60adf4c950aab13cbf417b8c61cec670b5` |

The retained summary SHA-256 is
`c4d8b4cb18f4f6bca598a9db4298c2e5ff68c7a7a89538275785d192d6b38c4a`.
The integrity report SHA-256 is
`03f0c8462e236eb88bb8ff49d4bac3ab79033640fed1b07e3eda0feb35a3b917`.
The reporter passes 32 checks.

## Eligibility result

Calibration pooled exact-object MIDI and native MIDI-like controls. A family
needed a pass rate from 0.20 through 0.90 on at least two providers.

| Family | OpenAI | Gemini | Eligible providers | Result |
|---|---:|---:|---:|---|
| Progression | 4/6 | 1/6 | 1 | Retain; needs a second provider |
| Role continuation | 6/6 | 6/6 | 0 | Ceiling; demote |

The metadata repair had no failure across 60 calls. One OpenAI tuple response
used noncanonical note order. No Gemini response had a syntax failure.
With one remaining decision family, a later development run must use 20
progression fixtures. This gives a smallest primary macro step of 5 percentage
points.

## Settings defect

The r2 manifest declared a 4,000-token output limit for each provider. The
inherited request helper used 3,000 tokens. One OpenAI exact-object
pitch-class/register call and one OpenAI tuple MIDI call stopped at 3,000
tokens with no payload.

Preserve the frozen r2 code and responses. Do not use r2 to select a format.
The result already returned `repair-measurement`, so this defect does not
change its terminal decision.

## Frozen r3 repair

The r3 run ID is
`phase8c2-3-json-settings-repair-calibration-r3`. It has three fresh
progression fixtures across all five arms. Each provider has 15 calls.

Run OpenAI and Gemini first. Their 30-call estimate is USD 0.202548. Run 15
Claude calls only if the two-provider summary returns `require-claude`. The
maximum 45-call estimate is USD 0.719831.

| Identity | SHA-256 |
|---|---|
| R3 corpus | `92bed1dac86bc6fd92db724fa82403cf40c61c98656193fbd3c203462aa76037` |
| R3 cohort manifest | `7e533c1c95b44851ef33288bd2a9bb1a4006b5df0090f23ea01cb59f885fc288` |
| Scorer | `2d6ea56cd427b1539e0451641028630987967b34216d33b9b9a1226556b147d3` |
| Transport audit | `bf1ab0a87773a550852b7e45a07f64733e6249d7729e8d2b963c4e47b4877fb4` |
| R3 protocol | `424bcf3e2889424c0b0f5752fc33d98ca4391bba41a714f93543da46d1f7e6ff` |
| R3 run plan | `15c5e47a1484645bb16e88c15926fcb649203cd44376d7035958a090ea835c22` |
| R3 deterministic package | `1adaba0dc6161fed04f8d1280dfb4487c75e90b92408b2e4366ef72e52389e2c` |

The r3 deterministic screen passes 55 checks. The request builder matches the
declared settings for all three providers. The three semantic fixture hashes
do not overlap a prior or reserved cohort. The pending approval record has no
operator statement, so the harness rejects it.

## Retrospective

Verify the request payload, not only the run manifest. A declared setting does
not prove that a shared transport helper sent it.
