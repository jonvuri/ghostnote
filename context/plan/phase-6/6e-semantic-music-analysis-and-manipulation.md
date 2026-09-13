---
title: Phase 6e — Semantic music analysis and manipulation
kind: plan
state: complete
status: Complete. E109 and E110 select a verified, library-backed boundary.
updated: 2026-09-13
parent: README.md
prev: 6d-perceptual-audio-model-evaluation.md
next: 6d2-perceptual-listener-agreement-evaluation.md
---

# Phase 6e — Semantic music analysis and manipulation

## Purpose

Determine which typed music analysis and transformations give a measured
advantage over direct agent editing.

## Starting facts

- The public clip surface can read and write exact note data.
- Phase 2 proved bounded note transformations and long-clip handling.
- E105 owns deterministic audio facts. It does not own note semantics.
- E106 through E108 found no accepted perceptual provider. Do not depend on
  one.

## Work

1. Define typed harmony, rhythm, register, voice-leading, motif, and tension
   results with exact clip and note coverage.
2. Compare established local libraries with direct agent analysis on controlled
   clips and one bounded live clip.
3. Separate exact note facts, inferred musical labels, and operator judgments.
4. Test at least one constrained before-and-after transformation.
5. Measure accuracy, determinism, latency, failure behavior, license, and
   platform limits.
6. Select replaceable provider boundaries or record precise blockers.
7. Remove all owned live and generated artifacts after the proof.

## Acceptance criteria

- Every result names its exact clip identity, note range, provider, version,
  unit or label type, and confidence rule.
- Controlled cases cover major and minor harmony, syncopation, register,
  repeated motifs, and at least one ambiguous case.
- Repeated results have measured agreement.
- One constrained transformation has exact before-and-after readback.
- No inferred label is reported as an exact note fact.
- No aesthetic result is reported without an operator verdict.
- The result selects a provider boundary or records a precise blocker.
- No retained live project or test artifact remains.

## Out of scope

- Automatic aesthetic acceptance.
- Generating a complete composition from an unbounded prompt.
- Replacing exact note readback with audio transcription.
- A public theory tool before the private boundary passes.

## Retrospective target

Record which ambiguous control best separated a useful label from false
precision.

## Result

[E109](../../evidence/experiments/e109-exact-note-structure-is-the-semantic-boundary.md)
selects an exact-note contract for structural facts and constrained
transformations. It passed all five controlled checks with identical results in
three repeats. One six-clip run took from 0.25 to 0.34 ms.

[E110](../../evidence/experiments/e110-wider-symbolic-provider-survey-selects-music21-and-musicpy.md)
corrects the narrow provider conclusion. It screened 12 off-the-shelf projects
and executed five. Music21 is the primary private analysis provider. Musicpy is
a replaceable voicing specialist candidate. The exact-note layer wraps and
verifies them. It does not replace their theory logic.

Music21 and Musicpy each recognized all eight chord semantic cores. Musicpy
also passed four exact voicing transforms. Every executed local provider was
repeatable. No tested key provider had a safe ambiguity policy, so the adapter
must expose alternatives and withhold low-margin results.

The constrained live transform moved 17 notes into MIDI 48 through 72 by
octave. Exact readback preserved note count, onset pitch classes, and all
non-pitch fields. Cleanup restored the exact four-track baseline. No public
theory tool or product runtime dependency was added.
