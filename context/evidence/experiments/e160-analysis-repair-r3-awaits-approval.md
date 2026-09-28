---
title: E160 — Analysis repair r3 awaits approval
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4b-focused-compact-calibration.md
---

# E160 — Analysis repair r3 awaits approval

## Verdict

The offline analysis repair passes. Calibration r3 is frozen at the provider
approval gate. Do not make a provider call until the operator approves the
exact protocol hash, run-plan hash, call limit, and cost limit.

The new package is
[`compact-format-v6`](../../../brain/benchmarks/compact-format-v6/README.md).
It does not change the frozen v5 package or calibration r2 artifacts.

## Measurement repair

Calibration r2 already made motif informative on two providers and progression
informative on three. This package replaces only the analysis calibration
evidence. It does not rerun OpenAI.

Each analysis task now contains an ordered batch of chord groups and motif
pairs. The output has eight ordered lists. The scorer keeps chord identity,
root, bass, quality, inversion, function, motif relation, and rhythm as
independent checks.

Gemini uses a frozen easy, medium, and hard ladder. Each tier has five unique
tasks and one repeated-prompt sentinel. Later tiers run only after a complete
ceiling on every earlier tier. Claude runs once, and only on the first tier
where Gemini scores from 0.20 through 0.80. A Gemini floor, incomplete result,
or hard-tier ceiling stops the run without Claude.

The tier case counts are 1,2,2,3,3; 2,3,4,5,6; and 4,6,8,10,12. The tiers have
no task, semantic, or individual-case overlap with each other. They have no
semantic overlap with a retained provider-bearing cohort.

The offline screen passes 222 checks. It verifies the generated chord,
function, motif, and rhythm formulas independently. It also tests the tier and
Claude gates. The calibration corpus SHA-256 is
`3064095d9624d4a7f361b764bc0dc260c911a484976fc571ae3b98bf60e1811d`.
The cohort-manifest SHA-256 is
`e2efeec760735e77919467be3b299f7e39a3ce8b5c838bd11389eed63718277d`.
The deterministic package SHA-256 is
`497acee6ac3ebdb3befd7b0ea1c206834ae30a38644fa96ce5981c8922217d7d`.

## Frozen calibration r3

The run ID is `phase8c4b-analysis-repair-calibration-r3`. The protocol
SHA-256 is
`469fa3bf8c0d9c2b66c2fb8132b3bc942b90a4e39b84c2bd784a9395495e0f2c`.
The run-plan SHA-256 is
`e0a97521b4b8790c1b1432adf99f4cd79d315b931db0897a017f5b1941bf890a`.

Gemini can use at most 36 calls across three tiers. Conditional Claude can use
at most 12 calls on one tier. The total maximum is 48 calls.

| Provider | Maximum calls | Maximum estimated cost |
|---|---:|---:|
| Gemini | 36 | USD 0.269561 |
| Claude, conditional | 12 | USD 0.867870 |
| Total | 48 | USD 1.137431 |

The estimate uses each provider's maximum observed calibration r2 call cost
plus 25 percent. Actual use can be lower because the ladder stops at the first
eligible Gemini tier, and Claude does not run unless Gemini is eligible.

No provider call occurred in this repair session. The pending approval record
rejects a provider run before it reads the credential file.

## Approval boundary

Approval must name the run and exact hashes. It must allow no more than 48
calls and USD 1.137431. Calibration r2 approval does not carry to r3.

Phase 8c4b remains active. Phase 8c4c and Phase 8f remain blocked.

## Retrospective

A frozen difficulty ladder makes the cost-sensitive iteration rule explicit.
Keep provider order and conditional spending in the executable gate.
