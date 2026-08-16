---
title: Phase 2, session 2c — harmonic transformations
kind: plan
state: planned
updated: 2026-08-16
parent: README.md
prev: 2b-theory-generation.md
next: 2d-rhythm-performance.md
scope: Phase 2 manipulation vocabulary
evidence: E24 · D8, D9, D16
---

# Phase 2, session 2c — harmonic transformations

> **Purpose.** Transform pitch structure without losing timing, channel, or
> expression that the requested verb does not own.

## Scope

1. Implement transpose, harmonize, arpeggiate, and re-voice as pure transforms
   over canonical clip content.
2. Define selection by channel, beat range, pitch range, or complete clip as
   settled in 2a.
3. Preserve note identity fields and all 20 exact expression properties unless
   the verb explicitly changes one. Continue to refuse an output that attempts
   to write pressure.
4. Report pitch-range rejection, octave displacement, collapsed duplicates, and
   every other material change not named directly by the request.
5. Keep operation order explicit when several transforms form one patch.
6. Use the 2b theory boundary for exact interval, scale, chord, and voice
   calculations. Do not call `tonal.js` directly from the planner or surface.

## Out of scope

- quantize, humanize, thin, or densify;
- reading clips from Bitwig;
- stash, clip blocks, lifecycle, or MCP registration.

## Exit criteria

1. Each verb has invariant tests for unchanged timing, channel, and expression.
2. Sequential transforms produce the same result on repeated runs.
3. Duplicate-note and out-of-range policies match the 2a contract and are never
   silent.
4. Round-trip fixtures cover all writable note properties, including exact gain,
   and confirm pressure refusal.
5. Focused tests, full offline tests, typecheck, context check, and
   `git diff --check` pass.
