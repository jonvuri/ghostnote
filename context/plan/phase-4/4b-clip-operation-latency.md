---
title: Phase 4, session 4b — exact clip-operation latency
kind: plan
state: planned
status: Ready. Measure and remove the repeated exact-read bottleneck before
        device implementation starts.
updated: 2026-08-21
parent: README.md
prev: 4a-device-side-scale.md
next: 4c-direct-parameter-core.md
scope: Exact long-clip read and verification latency
evidence: E45, E47, E48 · D9, D10, D15
---

# Phase 4, session 4b — exact clip-operation latency

> **Purpose.** Reduce the measured latency of exact long-clip reads without
> reducing their coverage or safety.

## Carry-in

E45 measured 15.482 seconds to read two 32-beat clips. E48 measured about 5.3
seconds for each independent 32-beat read. Empty-clip creation also took 13.436
seconds for two clips because verification reads the created state.

The current exact reader scans binary and triplet grids across each fixed cursor
page. It then makes one bridge request for each of 16 MIDI channels on each page.
A 32-beat clip uses seven pages across both grids and can therefore make about
112 channel requests. This is the leading explanation, not yet a measured phase
breakdown.

Session 2x solved blocking completion and cancellation. It did not reduce the
project work. Do not reopen that protocol.

## Scope

1. Add timing and request-count instrumentation for target acquisition,
   metadata, grid settlement, page turns, channel reads, reconciliation,
   selection restoration, and executor verification.
2. Reproduce one exact 32-beat read and the two-empty-clip creation workflow on
   the same host and project shape used by E48.
3. Replace per-channel page traffic with one bounded bulk page read. Prefer one
   extension request that returns all 16 verbose channel results. Use another
   mechanism only when the measurement proves it is safer or faster.
4. Keep binary and triplet scans, all 16 channels, every expression field, page
   bounds, cursor target confirmation, pin confirmation, page reset, and user
   selection restoration unchanged in meaning.
5. Re-run the exact-read, creation, reversal, long-clip, triplet, expression,
   interference, and cancellation checks.
6. Record before-and-after server time, bridge request counts, settlement time,
   and the remaining dominant cost.

## Required boundaries

- Do not weaken the dual-grid reconciliation rule.
- Do not skip empty channels unless the host provides a complete channel
  presence signal.
- Do not reduce a measured settle budget to make a benchmark pass.
- Do not combine read-based note-property stages. E15-F proves that optimization
  is unsafe.
- Do not redesign the public tools or background-operation protocol.
- Leave broad device performance work to session 4h.

## Exit criteria

1. The timing record explains at least 90 percent of the baseline wall-clock
   time by named phases or bridge requests.
2. One bulk page reply preserves the exact verbose note result for all 16 MIDI
   channels.
3. The median exact-read time for the same 32-beat fixture is at most half of the
   baseline median. If it is not, stop and revise the next action from the new
   measurement.
4. The two-empty-clip workflow reports its own before-and-after time and keeps
   exact reversal.
5. Binary, triplet, long-clip, expression, pin, selection, interference, and
   cancellation behavior has no regression.
6. The scratch fixture and accepted project return to their exact entry state.
7. Focused tests, the full brain check, extension tests, context check, and
   `git diff --check` pass.

## Retrospective target

Record whether bridge call count or host settlement was the dominant cost. Keep
only timing that can guide a later performance decision.
