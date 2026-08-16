---
title: Phase 2, session 2a — musical contract and surface decision
kind: plan
state: active
updated: 2026-08-16
parent: README.md
prev: ../phase-1/5i-closeout.md
next: 2b-theory-generation.md
scope: Phase 2 musical vocabulary and MCP surface decisions
evidence: E24 · D8, D9, D16, D18–D20
---

# Phase 2, session 2a — musical contract and surface decision

> **Purpose.** Define what musical work means before library behavior or public
> tools make the answer difficult to change.

## Scope

1. Create a small representative request corpus. Cover generation, existing-clip
   transformation, replacement, merging, several clips, several MIDI channels,
   triplets, expression, and requested variations.
2. Define one versioned, beats-native `MusicalPatch` contract. It is an internal
   artifact that compiles to the existing typed `Op` union.
3. Decide the public tool grain against the corpus. Start from one generation
   tool and one transformation tool that share the patch grammar. Add another
   tool only when it has a distinct permission or object boundary.
4. Divide responsibility explicitly. The agent chooses musical intent and
   constraints. The brain performs deterministic theory calculation,
   normalization, validation, transformation, and reporting.
5. Define merge and replace semantics, operation order, deterministic random
   seeds, note-collision behavior, MIDI-range behavior, and the shape of a loss
   report.
6. Define protection mapping. Ordinary writes are direct and stash-backed.
   Requested variations use a clip block. Fidelity-required protection follows
   D18 and never falls back to track copying.
7. Make MIDI channel explicit in every note operation produced by the new path.
   Decide whether the older low-level surface keeps a default as compatibility
   behavior or migrates with a versioned schema change.
8. Correct the public gain wording to match E24: the shared encoder applies the
   measured inverse and gain is exact.

## Out of scope

- `tonal.js` installation or musical algorithm implementation;
- Bitwig clip metadata methods;
- public description freeze;
- live project mutation;
- async batch completion.

## Exit criteria

1. Every corpus request maps to a canonical patch or an explicit refusal.
2. Each patch operation states its inputs, output, changed fields, preserved
   fields, ordering, and possible loss.
3. Tool granularity and the agent/brain boundary are recorded as decisions in
   the brief or in a new decision file when they have cross-phase effect.
4. The serializer has an explicit version and rejects an incompatible version.
5. Golden tests protect representative patch shapes and reports.
6. The channel and gain carry-in contradictions are resolved.
7. Typecheck, full offline tests, context check, and `git diff --check` pass.
