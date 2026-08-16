---
title: Phase 2, session 2b — theory and generation core
kind: plan
state: planned
updated: 2026-08-16
parent: README.md
prev: 2a-musical-contract.md
next: 2c-harmonic-transforms.md
scope: Phase 2 musical vocabulary
evidence: INITIAL_PROMPT §7 · D8, D9
---

# Phase 2, session 2b — theory and generation core

> **Purpose.** Build a pure, deterministic theory boundary that turns musical
> specifications into canonical clip notes.

## Scope

1. Add and pin the selected `tonal.js` packages.
2. Put the library behind a local TypeScript boundary. Public patch types do not
   expose library-specific objects or spellings.
3. Support notes, intervals, chords, scales, modes, keys, chord and scale
   detection, progressions, and pitch-class sets required by the 2a corpus.
4. Generate canonical notes with explicit start, duration, velocity, and MIDI
   channel. Reject pitches outside MIDI range unless the 2a contract defines an
   explicit fold or clamp operation.
5. Make enharmonic spelling and octave choice deterministic where MIDI output
   requires one answer.
6. Keep theory calculation pure. It receives data and returns notes, facts,
   warnings, or refusals. It cannot read or write Bitwig.

## Out of scope

- transformation of existing clip material;
- random performance changes;
- clip lifecycle or MCP tools;
- style heuristics that are not required by the request corpus.

## Exit criteria

1. Every theory and generation case in the 2a corpus has a deterministic result.
2. Equivalent inputs have canonical output independent of library ordering.
3. Invalid note names, unknown scales or chords, impossible ranges, and empty
   results refuse with actionable messages.
4. Output always carries explicit MIDI channel and beats-native units.
5. Focused tests, full offline tests, typecheck, context check, and
   `git diff --check` pass.
