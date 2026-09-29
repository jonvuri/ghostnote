---
title: E183 — V16 medium-difficulty direction awaits approval
kind: evidence
state: active
updated: 2026-09-29
parent: ../../plan/phase-8/8c4d-follow-up-v16-medium-difficulty-tuning.md
---

# E183 — V16 medium-difficulty direction awaits approval

## Verdict

The v16 directional difficulty package passes offline. It is ready for an
explicit operator approval decision. No provider request occurred.

The package keeps the v15 formats, component scorer, Gemini medium setting,
schedule blocks, no-retry policy, and operational accounting. It changes only
fresh task content and the directional run scope.

## Scope

| Family | Unique prompts | Formats | Messages |
|---|---:|---:|---:|
| Comprehension analysis | 10 | 3 | 30 |
| Affine continuation | 10 | 3 | 30 |
| Literal serialization guard | 2 | 3 | 6 |
| **Total** | **22** | **3** | **66** |

Gemini runs first because it completed v15 with 100 percent component accuracy
and 462/462 perfect cases. Ten unique prompts give a 10-point prompt-level
step. Case and component results remain the musical measures. This screen does
not claim a powered 10-point population MDE.

## Complexity change

Analysis keeps one independent case per prompt. It selects harder seventh and
diminished chords, extends each motif pair from four to eight values, and adds
eight represented distractor notes outside the named chord group.

Affine continuation keeps `pitch=(2*axis)-source_pitch+semitones` and the v15
numeric example. It adds interleaved voices, irregular rational starts and
durations, and rational factors such as `7/5` and `9/7`.

Literal serialization stays a positive control.

## Offline checks

The deterministic screen passes reference scoring, granular mutations,
failure denominators, aggregation, prompt visibility, request size, freshness,
balanced blocks, realized schedule identity, effective settings, cost
reservation, network preflight behavior, and malformed-response accounting.

The cohort contains 22 unique full and semantic hashes and ten unique analysis
case hashes. It has no overlap with the frozen historical snapshot through
v15.

## Approval identity

| Identity | SHA-256 |
|---|---|
| Protocol | `10a3eb283494557707319ced55566783bb94b8908f62c0e84be927d98fc74a13` |
| Run plan | `ce2e4f3cd7dd2035bcfa76a738f7c86f6aa86a33f84ea024504c7419b470eaa2` |
| Cohort | `d5514ddb07d705b00c66c7d58c6310f58e40724e269d867728d3e5a16154dfc4` |
| Deterministic package | `3c6fa75d55615ec4d8688d68039d15f9d88f6fbc137094c94095488dcbdf8f7f` |

The v15 candidate hashes are unchanged:

- `FIELDS`: `5125c847ad08dc795a82c235b3fcdf42dede5392805db36a3df2a0941c11a30a`;
- local labels: `3fcb182bfa6cfa4935a8e4b5c6ef876407fcd27e5bb2e6ac7df3177b2789c349`;
- exact JSON: `facd901ef30d98dec39f6023a779ce8ee3b3d3cab35e156ba0d6dffc05a99833`.

The maximum is 66 Gemini messages. The recent-cost estimate is USD 0.500000.
The cumulative hard limit is USD 0.650000.

## Retrospective

The package separates the ten-prompt directional resolution from statistical
power. A promising result requires a fresh, separately approved confirmation
cohort.
