---
title: Phase 4, session 4b follow-up — note completion signals
kind: plan
state: complete
status: Complete. E53 classifies note-step events as a partial wake hint. Four
        enable fields stay silent, and exact readback remains the proof.
updated: 2026-08-21
parent: README.md
prev: 4b-clip-operation-latency.md
next: 4b-clip-mutation-settlement.md
scope: Note mutation scaling and scoped completion evidence
evidence: E2, E8, E15, E19, E20b, E51–E53 · D6, D9, D10, D15
---

# Phase 4, session 4b follow-up — note completion signals

> **Purpose.** Find a reliable, scoped signal that can wake exact note
> verification as soon as a complete mutation becomes readable.

## Carry-in

E8 applied 240 basic note writes in one controller turn. One `note.write`
operation already has constant application overhead as its note count grows.
The remaining question is where stage, page, settlement, and verification costs
still repeat.

The public API has no monotonic project-wide change counter. `canUndo`,
`canRedo`, and `Project.isModified()` are Boolean values that usually remain
true across later edits. Launcher-content observers report occupancy changes,
but E19 and E20b prove that note edits and occupied-to-occupied replacement are
silent to them.

`Clip.addNoteStepObserver()` is the unmeasured candidate. A matching event can
be a completion fence only if it identifies the current target generation and
does not arrive before exact readback can observe the change.

## Scope

1. Measure the current request, stage, page, fixed-wait, and verification counts
   for increasing note counts on one clip. Repeat for expression-rich notes,
   multiple writer pages, and multiple clips.
2. Add guarded probe instrumentation for `addNoteStepObserver()` on a dedicated
   pinned cursor. Record target generation, grid, page, channel, cell, state,
   callback sequence, and callback time.
3. Measure note add, clear, move, full clear, and every writable expression
   property. Include all 16 MIDI channels, binary and triplet positions, muted
   notes, and a 32-beat clip.
4. Separate initial callback delivery from mutation callbacks after cursor
   point, pin, grid change, page change, and controller reload.
5. Compare each matching callback with the first later bulk read that observes
   the complete expected state. Test whether one callback proves only one note
   or the complete submitted batch.
6. Run one unrelated-edit arm and one same-target edit arm. A foreign event may
   wake a read, but it must not report false completion.
7. Measure observer allocation, initialization, callback volume, and control-
   thread latency at the accepted D7 scaffold.
8. Classify the observer as a completion fence, a wake hint, or unusable. Record
   the exact operation classes and limits behind that classification.

## Required boundaries

- Exact bulk readback remains the success proof.
- Do not treat project dirty state, undo availability, or launcher occupancy as
  proof that a note batch settled.
- Do not save the project or change the user's undo history to reset a Boolean
  signal.
- Do not reduce a fixed settle budget in this evidence session.
- Do not infer off-page, off-channel, expression, or batch coverage from a basic
  note-on callback.
- Keep every callback bound to a confirmed cursor target and observation
  generation. Ignore callbacks from an older target.
- Leave product batching and public tools to the next session.

## Exit criteria

1. The baseline states which costs grow with notes, clips, writer pages, and
   property stages. It does not describe an existing constant-cost batch as a
   new optimization opportunity.
2. The live matrix covers note existence and all writable expression fields on
   binary and triplet grids across all MIDI channels.
3. Callback timing is compared with the first exact read that observes the full
   expected batch.
4. Initial, stale-target, unrelated, and same-target events cannot cause false
   completion.
5. Observer scale cost is measured against the accepted D7 scaffold.
6. The final classification names where the next session can use an event and
   where it must use bounded polling or a fixed fallback.
7. The scratch fixture, project content, undo history, and user selection return
   to their documented entry state.
8. Focused tests, the brain check, extension tests, context check, and
   `git diff --check` pass.

## Retrospective target

Record whether the event reports host completion or only host activity. Keep
the distinction explicit in the next session.

## Result

E53 closes this evidence session. Existing request, stage, settle, page, and
verification counts are constant from one through 64 basic notes. They grow
with expression dependency stages, writer pages, and clips.

The dedicated observer covered add, clear, move, full clear, all channels, both
grids, the 32-beat edge, four writer pages, and all 20 writable note entries.
Most operations produced an early callback. The four enable fields produced no
callback. A same-target foreign edit produced an eligible callback, so no
callback proves ownership or complete settlement.

The observer is a wake hint for event-producing operations and unusable for the
silent fields. The next session must keep exact bulk readback, bounded polling,
and a fixed timeout fallback. Cleanup restored the accepted project and entry
selection.
