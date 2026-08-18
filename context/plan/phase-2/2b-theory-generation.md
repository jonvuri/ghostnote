---
title: Phase 2, session 2b — theory and generation core
kind: plan
state: complete
status: Complete 2026-08-16. The pure theory boundary supports the full 2a
        theory corpus and emits canonical, channel-explicit generated notes.
updated: 2026-08-16
parent: README.md
prev: ../../archive/outcomes/PHASE-2-SESSION-2A-MUSICAL-CONTRACT.md
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
   channel. Keep target, variation, and operation provenance for compiler loss
   reports. Reject pitches outside MIDI range unless the 2a contract defines an
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

## Outcome

The brain now pins nine focused `@tonaljs` packages. `musical/theory.ts` is the
only import boundary. It returns local fact types, warnings, or explicit
refusals. It supports notes, intervals, chords, scales, modes, major and minor
keys, chord and scale detection, Roman-numeral progressions, and pitch-class
sets.

Generation covers every 2a generation case. It emits beats-native notes with an
explicit channel and target, variation, and operation provenance. The compiler
conversion removes boundary-only note fields but keeps target provenance for
loss reports. Literal expression remains exact. Theory generation refuses
invalid names, empty results, duplicate identities, and MIDI pitches outside
0–127.

Canonical MIDI spelling uses flats. Detection results and pitch-class sets have
stable order. Literal notes keep their explicit order for later `as-played`
arpeggiation. Unaltered minor-key progression degrees resolve against the
natural-minor scale. Thus the corpus progression `i VI III VII` in C minor
resolves to `Cm Ab Eb Bb`.

The focused theory suite passes 10/10. The full offline check passes 567/567.
Typecheck is part of that check. The context check and `git diff --check` pass.

## Retrospective

The 2a corpus did not state how unaltered Roman numerals resolve in a minor key.
This session fixed the rule from the representative request. Future corpus
changes must state the degree basis when they add another minor-key form. Review
also caught a premature note sort that removed literal source order. Preserve
semantic array order at pure boundaries and sort only where order is irrelevant.
Tonal uses a null MIDI value for both pitch classes and out-of-range notes. Check
the octave before interpreting that value.
