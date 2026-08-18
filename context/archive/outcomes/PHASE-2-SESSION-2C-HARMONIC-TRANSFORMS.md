---
title: Phase 2, session 2c — harmonic transformations
kind: outcome
state: complete
updated: 2026-08-18
parent: ../../plan/phase-2/README.md
prev: ../../plan/phase-2/2b-theory-generation.md
next: ../../plan/phase-2/2d-rhythm-performance.md
scope: Phase 2 manipulation vocabulary
evidence: E24 · D8, D9, D16, D21
---

# Phase 2, session 2c — harmonic transformations

Session 2c is complete. Transpose, harmonize, arpeggiate, and re-voice are pure,
ordered transforms over canonical clip notes.

## Delivered transforms

`brain/src/musical/theory.ts` now materializes one harmonic target from generated
or existing notes. It applies operations in patch order and keeps target,
variation, and operation provenance.

Selection uses the target MIDI channel. Beat ranges are half-open. Pitch ranges
are inclusive. An absent range selects the complete target channel.

The default grouping policy uses exact note onsets and keeps source order inside
each group. The grouping function is replaceable. Harmony resolution returns
half-open regions and is also replaceable. The current resolver returns one
full-range region. These seams permit later onset-tolerance policies and
range-local key changes without changing the group processors.

Harmonize uses these initial rules:

- interval harmony adds each requested interval to each selected note;
- detected harmony uses the full selected pitch-class set;
- chord and scale harmony use the named pitch-class collection;
- each onset group receives its missing pitch classes in a compact voicing near
  the group's lowest pitch;
- added notes copy timing, channel, velocity, duration, and expression from the
  first selected note in the group.

Arpeggiation processes each onset group. `as-played` keeps source order. `up` and
`down` sort by pitch. `up-down` does not repeat the end pitches. Re-voice supports
closest, ascending, and drop-2 strategies within an inclusive MIDI range.

## Safety and reporting

Every transform preserves fields that it does not own. Tests cover all 20 exact
writable note properties, including gain through the measured inverse. Pressure
refuses before compilation.

MIDI pitches outside 0–127 refuse. Duplicate channel, pitch, and start identities
refuse instead of collapsing. Arpeggiation reports timing moves, shortened notes,
and added return notes. Harmonize reports every added note. Re-voice reports each
octave displacement.

Merge transformations keep the complete source set while the ordered pipeline
runs. They emit only new or changed notes. Group reconstruction keeps
interleaved unselected notes in their source positions. This keeps later
`as-played` operations stable.

The required `octave-displaced` loss code changed the version-1 report
fingerprint to
`a9d4fd5a5074788fba330d8230a7c6bd8b80909d74d40fa649ca581dc7c8e635`.
The patch grammar and representative requests did not change. D21 records this
report-only amendment.

## Verification

The focused musical suite passes 31/31. The full offline check passes 578/578,
including typecheck. The context check and `git diff --check` pass.

## Retrospective

The 2a contract fixed operation shapes but did not fix onset grouping or how a
harmony source fills each onset. One explicit rule was needed before coding.
Replaceable grouping and region resolution kept that rule out of the group
processors. A future key-change implementation can supply several harmony
regions through the existing resolver. Review found that merge output and
partial-selection ordering needed explicit tests. Those tests now cover both
boundaries. No repository instruction change is needed.
