---
title: Phase 7b follow-up — Flush-boundary clip settlement
kind: plan
state: complete
status: Complete. E132 rejects flush cycles as note-grid replay completion fences.
updated: 2026-09-24
parent: 7b-follow-up-consolidated-clip-acquisition.md
prev: 7b-follow-up-consolidated-clip-acquisition.md
next: 7b-follow-up-hybrid-observer-acquisition.md
evidence: E0, E8, E14, E51-E53, E130-E132
---

# Phase 7b follow-up — Flush-boundary clip settlement

## Purpose

Test whether `ControllerExtension.flush()` supplies a reliable empirical batch
boundary for `Clip.addStepDataObserver` replay. Determine whether one or two
quiet flush cycles can replace conservative polling or fixed grid settlement.
Do not promote a rule until it covers empty views, identical targets, grid
changes, and page changes without an early completion.

## Starting facts

- API 25 documents `flush()` as the time to send pending controller output. It
  does not define it as a host-input completion fence.
- API 25 documents `scheduleTask` only as delayed callback execution. Every
  Ghostnote bridge request already enters the control-surface thread through
  `scheduleTask(..., 0)`.
- E14 measured passive `flush()` near 1 Hz. `requestFlush()` makes an output
  flush prompt, but it can also create a flush before note replay arrives.
- E51 and E52 prove that full `getStep` scans need grid and page settlement.
  Moving the scan into Java does not make the host cursor update synchronous.
- E53 proves that `addNoteStepObserver` has no initial replay and is only a
  partial mutation wake hint. Do not use it for this experiment.
- E130 proves that `addStepDataObserver` clears and replays sparse occupancy.
  Page callbacks began near 48 ms. Grid and target callbacks began near 145 to
  173 ms. Replay bursts lasted no more than 2.1 ms in the measured fixture.
- E131 proves that dual-grid sparse enrichment is complete on its fixtures, but
  conservative settlement makes it slower than the complete reader.
- `Clip` exposes `scrollToStep`, but API 25 exposes no exact current page or
  scroll-position value. Metadata and `exists()` cannot prove a grid or page
  transition and can stay unchanged across targets.

## Probe boundary

Keep all flush logic probe-only until the result is clear. Add a bounded
extension recorder that captures, on the control-surface thread:

- monotonic flush sequence and timestamp;
- whether the flush was passive or requested by the probe;
- current probe generation, requested target, grid, and page;
- step-data callback count and last callback timestamp;
- callbacks since the prior flush; and
- each candidate completion rule that fired.

Do not perform network I/O or an unbounded scan inside `flush()`. Let `flush()`
record a bounded event and schedule any follow-up work. Preserve the current
hardware-output behavior if the extension uses it during the probe.

## Candidate rules

Test these rules independently. Do not assume that one implies another:

1. First flush after the requested action.
2. First flush after at least one callback in the current generation.
3. First quiet flush after a dirty flush.
4. Second consecutive quiet flush after a dirty flush.
5. The same rules with an explicit `requestFlush()`.
6. Follow-up checks scheduled at 0, 24, and 48 ms after a dirty flush.

Use the existing verified track and scene cursor status as the target canary.
Record that there is no equivalent exact canary for grid or page settlement.
Do not treat loop length, play start, `exists()`, or scroll-capability booleans
as a universal canary. Their values can remain unchanged.

A local generation counter can reject state captured before an action. It does
not prove that callbacks labelled with the new local generation came from the
new host view. Test late callbacks from the prior view explicitly.

## Controlled matrix

Reuse the E131 fixture vocabulary where practical. Cover both `1/512` and
`1/768` views, all 16 MIDI channels, same-pitch adjacency, optional fields,
sparse and dense pages, and late content. Include these transitions:

- populated target to a different populated target;
- populated target to identical content;
- populated target to empty and empty target to empty;
- page zero to an interior page;
- one interior page to another interior page;
- populated page to empty and empty page to empty;
- binary grid to triplet grid and back; and
- a note edit after the initial replay.

Run passive and explicitly requested flush arms separately. Repeat each
transition arm at least 30 times. Do not mix a prompt flush result with a
passive flush claim.

## Truth comparison and timing

At every candidate boundary, copy the observer state and run targeted
all-channel enrichment on the next safe task turn. Compare it with:

1. a late stable observer snapshot; and
2. the settled complete dual-grid reader.

Compare occupied coordinates, notes, fields, channels, and normalized timing.
Record the action, first callback, last callback, dirty flush, quiet flush,
candidate enrichment, stable truth, and total time. Record false completion,
missed completion, and timeout separately.

Test immediate `getStep` at the candidate boundary on known occupied cells.
This determines whether a flush boundary applies only to observer delivery or
also to the cached step view used by the complete reader.

## Decision rules

Classify the result as one of these outcomes:

- **Complete fence:** One rule has zero early completions across the complete
  matrix, including empty-to-empty changes, and improves measured latency. Add
  it only to the experimental acquisition path, then remeasure sparse and full
  reads independently.
- **Partial wake:** A rule works only after a dirty replay or only for some
  transitions. It can trigger an early verification attempt. Keep the current
  fixed or stable fallback and do not call the wake authoritative.
- **Rejected:** A quiet flush can precede late callbacks, cannot prove empty
  views, or is not faster. Keep E131 settlement and remove probe-only product
  hooks.

A timeout must never return “probably complete” as authoritative. It must use
the known complete reader, retain the measured settlement fallback, or return
an explicit best-effort result.

## Acceptance criteria

- Exact API 25 lifecycle claims remain separate from measured behavior.
- The probe uses `addStepDataObserver`, not `addNoteStepObserver`.
- Passive and requested flushes are measured separately.
- Target, grid, page, and empty-view cases cannot be confused.
- Every candidate result is compared with settled complete truth.
- Any accepted rule has zero early completions in at least 30 repetitions per
  transition arm and improves the relevant end-to-end time.
- A partial rule remains only a wake hint with an authoritative fallback.
- A rejected rule leaves the product reader and experimental acquisition route
  unchanged.
- Owned fixtures are removed, and tracks, selection, cursors, and transport
  return to their exact entry baseline.
- Focused tests, the full brain check, extension tests, `context/check.rb`, the
  wire-golden check, and `git diff --check` pass.

## Out of scope

- A stable public clip contract.
- A persistent observer-backed cache.
- Treating `requestFlush()` as a documented host-input fence.
- Reducing the 144 ms reader budget without direct live equality evidence.
- The independent played-range consolidation trial.

## Completion and return route

E132 rejects the flush boundary. First flushes completed early, dirty rules
could not classify empty-to-empty changes, and passive second-quiet boundaries
still completed early. The E131 complete reader and sparse settlement stay
unchanged. Continue with the
[hybrid observer acquisition](7b-follow-up-hybrid-observer-acquisition.md)
experiment. It treats empty-to-empty as an authoritative fallback case and
tests the requested dirty-and-quiet rule under adversarial timing.

## Retrospective target

The lifecycle callback supplied only an output opportunity. Empty-view controls
prevented a dirty-only wake hint from becoming a false completion rule.
