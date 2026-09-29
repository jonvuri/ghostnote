---
title: E194 — 8c4e full benchmark awaits approval
kind: evidence
state: active
updated: 2026-09-29
parent: ../../plan/phase-8/8c4e-compact-only-full-benchmark.md
---

# E194 — 8c4e full benchmark awaits approval

## Verdict

The Phase 8c4e offline package and run plan are frozen. The affine freshness
flaw is repaired. No provider call is approved.

The package runs only the unchanged `FIELDS` and local-label candidates. It
covers all nine Phase 8c3 task families, one repeated-prompt sentinel for each
family, and two literal serialization controls.

## Freshness repair

The new affine generator derives source notes, durations, velocities, voice
assignment, axes, shifts, output anchors, and rhythmic factors from the cohort
seed. Changing only the seed changes all seven affine content hashes and both
serialization content hashes.

Each task now has an ID-free content hash. The hash excludes cohort, fixture,
source-note, output-note, and analysis-group IDs. It includes musical values,
rules, contracts, and references.

The frozen cohort has 65 fixtures and 21 analysis cases. It has no internal
duplicate. It has no official historical full, semantic, or analysis-case
overlap. Its ID-free content hashes do not overlap v18 or another stored
content hash. The audit reconstructs the v18 cohort, where the flaw was found.

| Identity | SHA-256 |
|---|---|
| Corpus | `a3a96a392c67c9ecbcbda21b980f6700b700c2a8c368f3f2a28899ecc788a0c1` |
| Cohort audit | `a43fd44ba580974c3768462e528deaa64b5dd628bbf0446a4508df881a261473` |
| Historical content snapshot | `c6d6be652d288323e11f07a40b5c7a41362832a3d036e954fce4e19542d391a2` |

## Frozen run

Each provider has 148 messages: 130 unique fixture-arm prompts and 18
sentinel-repeat prompts. The total is 444 messages. There is one sample, no
automatic retry, and no repair call.

| Provider | Model | Setting | Messages | Estimate | Hard limit |
|---|---|---|---:|---:|---:|
| OpenAI | `gpt-5.4-mini-2026-03-17` | low reasoning | 148 | USD 0.750000 | USD 0.950000 |
| Gemini | `gemini-3.8-flash` | low thinking | 148 | USD 0.420000 | USD 0.600000 |
| Claude Haiku | `claude-haiku-4-5-20251001` | 1,024 thinking tokens | 148 | USD 3.100000 | USD 4.000000 |
| **Total** | — | — | **444** | **USD 4.270000** | **USD 5.550000** |

The decision rule treats structural and canonical failures as benchmark
outcomes. It does not treat them as experiment-invalidating events. The rule
uses 70 percent component and case floors, an 80 percent structural floor, a
70 percent canonical floor, and 90 percent serialization gates. Ninety percent
remains a maximum calibration target for task difficulty.

The result is `matrix-plausible`, `revise`, or `stop`. A
`matrix-plausible` result can support a later matrix plan. It cannot authorize
matrix calls or select a public format.

| Identity | SHA-256 |
|---|---|
| Protocol | `b4b8e798544b63a309c6fa7c3a528c72be1b4f8f936bb9298896b89e3544a90a` |
| Run plan | `b5ed80eb9ebcfd9010cbeb0e64eef6c0557aa725c7e594648c8a3e381d2335fa` |
| Deterministic screen | `90ec45143dfc8d55e8f57323befc4378638aa96de537f7bd3f7da314ab2b77bb` |
| Deterministic package | `8c30d06dada30a5fa31b8679729fc1a5573792861a06760db332d64276c8ffc4` |

## Verification

The pinned v19 check passes. It verifies candidate identities, all perfect
references, retained component denominators after parse failure, focused
single-component mutations, prompt visibility, request size, schedules,
provider settings, cost reservations, summary decisions, and the approval
boundary.

The pending approval file rejects provider execution before credential or
network work. No provider request was made.

## Retrospective

One shared suite can repair the weak v18 generator and reuse its scoring
contracts inside the nine-family benchmark. Explicit content hashes make that
boundary easier to audit than package-name freshness.
