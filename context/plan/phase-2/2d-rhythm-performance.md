---
title: Phase 2, session 2d — rhythm and performance transformations
kind: plan
state: planned
updated: 2026-08-16
parent: README.md
prev: 2c-harmonic-transforms.md
next: 2e-clip-lifecycle.md
scope: Phase 2 manipulation vocabulary and grid contract
evidence: E2, E15-D/F, E24 · D8–D10, D15, D16
---

# Phase 2, session 2d — rhythm and performance transformations

> **Purpose.** Add time, feel, and density changes with reproducible randomness
> and no silent quantization loss.

## Scope

1. Implement quantize, humanize, thin, and densify as pure transforms.
2. Require an explicit seed for every random choice. Return the effective seed
   so the result can be reproduced.
3. Define quantize strength, swing or offset where selected in 2a, range
   clipping, note collisions, and same-pitch truncation before output is emitted.
4. Report requested and realized timing. A snapped, clipped, shortened, removed,
   or added note appears in the result report.
5. Extend the per-operation grid contract for triplet positions and durations.
   Measure the live host behavior through an independent read handle before
   declaring a triplet grid exact.
6. Preserve channel and all properties that the chosen transform does not own.
7. Keep the D9 grid-change settle rule and D10 staging discipline intact.

## Out of scope

- an init-time or project-wide grid;
- unseeded randomness;
- async completion;
- public MCP wording or clip metadata.

## Exit criteria

1. The same patch and seed always produce the same notes and report.
2. Straight and triplet fixtures pass exact offline and independent live
   readback, or triplets remain refused with recorded evidence.
3. Quantization loss is either refused or named. It is never silent.
4. Same-pitch collisions cannot cause unreported duration changes.
5. All writable expression properties survive transforms that do not target
   them; pressure remains refused.
6. The live probe restores the documented baseline.
7. Focused tests, full offline tests, typecheck, context check, and
   `git diff --check` pass.
