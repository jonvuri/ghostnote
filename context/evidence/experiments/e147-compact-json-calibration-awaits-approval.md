---
title: E147 — Compact JSON calibration awaits approval
kind: evidence
state: active
updated: 2026-09-27
parent: ../../plan/phase-8/8c2-3-compact-json-factorial-and-native-decision.md
---

# E147 — Compact JSON calibration awaits approval

## Verdict

The Phase 8c2.3 offline prototype is complete. The
[compact-json v1](../../../brain/benchmarks/compact-json-v1/README.md) package
contains four JSON factorial cells and one separate native MIDI-like anchor.
Its first diagnostic calibration plan is frozen and pending operator approval.
No provider call ran.

## Representation contract

The four JSON cells vary object or tuple shape and MIDI or
pitch-class/register pitch values. Tuple JSON uses separate named collections
for bars, tracks, regions, and notes. It does not use one heterogeneous array.
Each cell contains the same normalized semantic document. Each pitch has one
encoding.

Object and tuple patches compile to the same normalized sparse operation. They
reject stale bases, unknown IDs, unsupported fields, and repeated target IDs.
Native MIDI-like has no identity or patch capability. It stays outside the
factorial and has a separate capability record.

## Offline result

The deterministic screen passes 205 checks. It covers all 128 MIDI values,
pitch-class/register conversion, round trips, collection order, identity,
metadata, preservation, sparse patches, conflicts, invalid tuples, size,
token estimates, scorer mutations, paired contrasts, and all nine prompt
grammar forms.

All four JSON arms decode to one equal semantic document. The calibration,
development, and holdout cohorts contain 14, 44, and 44 fixtures. Their full
and semantic hashes do not overlap. No semantic hash overlaps the Phase 8c1,
8c2, or 8c2.2 provider cohorts.

The eight development fixtures in each of three decision families give a
smallest hard-macro step of 4.17 percentage points. This is below the required
5-point maximum.

On the offline structure example, tuple MIDI used 1,349 output bytes and an
estimated 567 prompt tokens. Exact-object MIDI used 2,580 bytes and an
estimated 916 prompt tokens. These are diagnostic values. They are not a
provider result or a selection claim.

## Frozen calibration

The run ID is `phase8c2-3-compact-json-calibration-r1`. It has 14 fixtures per
arm, five arms, three providers, and no repeated prompts. Each provider has 70
calls. The total is 210 calls.

| Provider | Model | Calls | Estimated cost |
|---|---|---:|---:|
| OpenAI | `gpt-5.4-mini-2026-03-17` | 70 | USD 0.404167 |
| Gemini | `gemini-3.8-flash` | 70 | USD 0.256802 |
| Claude | `claude-sonnet-5` | 70 | USD 1.429609 |
| Total | — | 210 | USD 2.090578 |

All models use their low-effort setting and provider default temperature. The
plan shuffles isolated calls with seed 8323.

| Identity | SHA-256 |
|---|---|
| Calibration corpus | `b7b43ef309af6af20aaef0982d60ad73f97ef8ddf73e391e608a3672f8b11fb5` |
| Cohort manifest | `b9da13e9663ba3d1c60fc04581e39c4d4b8b044098d90ddf5d5598e68f46fd2b` |
| Schema manifest | `7f2d3e53d85416de88572192528bac9d6d8dae745a8cd55e20c0f4a5be34c46f` |
| Scorer | `f02e6d77d9d7a9d68475a2020051a2c4f32753db91cafea6952e952075bd67f4` |
| Protocol | `6ca7985ac2fe24658f30ffb6cb59bc2957766190434a2ae84e1cb5567e2881f1` |
| Run plan | `c2f2d90725e0f07881efa3b7504ebde71b587a309ec17d5de809f95ad655472e` |
| Deterministic package | `b851eea023536328f93a7e244297324ac3c715adde0f4960c4c713c0b5ebc74f` |

Calibration pools exact-object MIDI and native MIDI-like controls. Progression,
role continuation, and revoicing must each have a pooled control pass rate from
0.20 through 0.90 on at least two providers. Otherwise, the result is
`repair-measurement` and provider work stops. A passing calibration permits a
new development freeze only. It does not approve development calls.

## Approval boundary

The pending approval record has no operator statement. The provider harness
rejects it. Operator approval must name this exact run, protocol hash, run-plan
hash, 210-call scope, and USD 2.090578 estimate.

## Retrospective

One schema manifest and one normalized decoder made semantic parity easier to
check across four cells. The prompt-form matrix also found every permitted
document and patch form before the provider freeze. No instruction change is
needed.
