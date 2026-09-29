---
title: Phase 8c4f follow-up — MusicXML and MIDI-like probe
kind: plan
state: complete
updated: 2026-09-29
phase: phase-8-agent-native-live-engine
session: phase8c4f-musicxml-midi-probe-complete
---

# Phase 8c4f follow-up — MusicXML and MIDI-like probe

## Goal

Validate MusicXML 4.0 and the Ghostnote MIDI-like profile before the final
eight-arm matrix.

## Acceptance criteria

1. Add both formats through the reusable adapter boundary.
2. Keep musical scoring independent from public-surface parsing.
3. Use a fresh cohort with ID-free content hashes.
4. Run two fixtures from each decision family and one serialization control.
5. Freeze the exact provider, model, settings, schedule, estimate, and hard
   cost limit before a provider call.
6. After the run, audit one full case from every family-format cell.
7. Treat component accuracy as primary. Keep structure, alignment, and
   canonical form as diagnostics.

## Frozen probe

Use Gemini `gemini-3.8-flash` with low thinking. Run 19 tasks on MusicXML 4.0
composite and 19 tasks on the Ghostnote MIDI-like profile. This is 38 calls.
Make no retry or repair call.

The recent-cost estimate is USD 0.090000. The provider and total hard limit is
USD 0.200000. The run needs explicit approval of the frozen hashes and limit.

Gemini completed all 38 approved calls. The actual cost was USD 0.13523475.
[E200](../../evidence/experiments/e200-musicxml-midi-probe-validates-final-matrix-arms.md)
records the result and audit.

## Final matrix scope

If both probes are valid, prepare a fresh full matrix with these arms:

- compact bar `FIELDS`;
- compact bar local labels;
- exact object JSON;
- ABC 2.1 composite;
- Strudel 1.2.0 composite;
- LilyPond 2.24.4 composite;
- MusicXML 4.0 composite; and
- Ghostnote MIDI-like profile.

The full suite has 74 messages per arm and provider. This scope has 592
messages per provider and 1,776 messages across three providers.

## Boundaries

Do not call a provider before exact approval. Do not change the v3 package,
cache, `normal-v1`, or a live Bitwig project. Do not describe the MIDI-like
profile as a public standard. Do not describe a composite result as native
notation performance.

## Retrospective target

Check format prompt size before freeze. MusicXML whitespace has no benchmark
value and can make a valid prompt exceed the request-byte guard.
