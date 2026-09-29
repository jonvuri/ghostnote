---
title: Phase 8c4f follow-up — Fresh eight-arm full matrix
kind: plan
state: active
updated: 2026-09-29
phase: phase-8-agent-native-live-engine
session: phase8c4f-eight-arm-matrix-frozen
---

# Phase 8c4f follow-up — Fresh eight-arm full matrix

## Goal

Compare the eight selected symbolic representations on one fresh full task
suite. Keep musical component accuracy primary. Keep structure, notation
alignment, and canonical form diagnostic.

## Arms

- compact bar `FIELDS`;
- compact bar local labels;
- exact object JSON;
- ABC 2.1 composite;
- Strudel 1.2.0 composite;
- LilyPond 2.24.4 composite;
- MusicXML 4.0 composite; and
- Ghostnote MIDI-like profile.

## Acceptance criteria

1. Run seven fixtures from each of nine decision families and two literal
   serialization controls.
2. Repeat the first fixture from each decision family as an exact sentinel.
3. Use 74 messages per arm and 592 messages per provider.
4. Use OpenAI, Gemini, and Claude Haiku at the frozen low-effort settings.
5. Make no automatic retry or repair call.
6. Report musical components by provider, family, and format before pooled
   totals.
7. Exclude failed or unavailable calls from musical denominators.
8. Keep public notation and the composite side ledger as separate diagnostics.
9. Reproduce every prompt, task, candidate, score, schedule, and cost record.
10. Manually audit a sample across providers, families, and formats.

## Freshness

Keep the task shapes, prompts, adapters, scorers, aggregation, and run policy
fixed. Change only deterministic musical fixture parameters. Transpose open-
generation contracts by one semitone. Shift revoice fixtures by one octave and
rhythm fixtures by two octaves. Require 65 unique ID-free content hashes and no
overlap with v19, symbolic v3, or symbolic v4.

## Approval and cost

The plan has 1,776 calls. The estimated cost is USD 15.550000. The total hard
limit is USD 20.250000. Provider approval must match the frozen protocol, run
plan, cohort, candidate, schedule, model, setting, and cost hashes.

Do not call a provider before explicit approval. Stop a provider on the first
transport, budget, approval, identity, freshness, or deterministic-screen
failure.

## Later paired diagnostic

After the matrix, plan a separate native-versus-composite diagnostic for ABC,
Strudel, LilyPond, and MusicXML. Include only tasks and fields that the native
notation can represent. Do not pool this result with the full matrix. Require a
fresh freeze and explicit cost approval.

## Boundaries

Do not change the completed v3 or v4 artifacts. Do not change the cache,
`normal-v1`, or a live Bitwig project. Do not describe the MIDI-like profile as
a public standard. Do not describe a composite result as native notation
performance.

## Retrospective target

Check whether the fixture transform preserved difficulty while it removed
content overlap. Keep a direct source-to-transformed-task assertion.
