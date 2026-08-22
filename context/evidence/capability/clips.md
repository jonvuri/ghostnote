---
title: Launcher clips — timing, metadata, paging, and duplication
kind: capability
state: active
updated: 2026-08-21
scope: launcher-clip notes, metadata, exact reads, writes, and copies
evidence: E2, E24, E41–E46, E51–E53; D8, D9, D15, D16, D21
---

# Launcher clips

> **Provenance.** Each claim carries `[K]` known, `[I]` inferred or `[U]`
> unknown, and cites its E-number. Read the four rules in
> [INDEX.md](INDEX.md) before you edit this page.

## Current statement

**Launcher clips have exact typed note and measured metadata paths. Long reads
and writes must page fixed cursor windows. A copy is safe only after the next row
is proved empty.** [K, [E43](../experiments/e43-clip-metadata-and-duplication-routes.md),
[E45](../experiments/e45-first-real-musical-dogfood.md),
[E46](../experiments/e46-long-clip-editing-follow-up.md)]

The product supports launcher clips only. Arrangement clips and audio clips are
not in this contract [K, [D21](../../decisions/d21-musical-patch-and-public-tool-grain.md)].

## Timing and grids

- Start positions stay exact integer coordinates on one supported per-operation
  grid [K, [E2](../experiments/e2-note-round-trip-fidelity-grid-observer-gotcha-2026-07-18.md),
  [E41](../experiments/e41-triplet-rhythm-readback-and-seeded-transforms.md)].
- Supported binary grids run from 1 beat through 1/64 beat. Supported triplet
  grids are 1/3, 1/6, 1/12, 1/24, and 1/48 beat [K, E41].
- Host durations settle on `2^-20`-beat values. The rule is measured for Bitwig
  6.0.6, host API 25, and the tested grid values. It is not a general epsilon
  [K, [E42](../experiments/e42-host-duration-fixed-point-grid-normalization.md)].
- A captured duration that no writable grid represents makes the prior state
  lossy. The fidelity floor refuses before mutation [K, E46].

## Note fidelity

Twenty of 21 note properties round-trip exactly through an independent cursor.
Gain uses the measured divide-by-two encoder. Pressure is readable but not
writable and is refused before mutation [K,
[E24](../experiments/e24-gain-inverse-and-complete-note-contract.md)].

Consecutive notes with the same pitch can shorten the earlier duration. The
musical path reports this change. Duplicate note identities refuse [K, E2,
[E44](../experiments/e44-public-musical-conformance-and-writer-window.md)].

## Metadata and duplication

The exact typed metadata state includes name, 8-bit colour, loop length, play
start, loop enabled, loop start, and loop end. The raw loop-start setter also
moves play markers, so the writer applies the complete state in a safe order
[K, E43].

The play-stop setter is inert. Automation lanes have no complete readback.
Deleting and recreating a clip is therefore lossy even though the shipped
metadata, launch settings, and note channels restore exactly [K, E43].

`duplicateClip` and `duplicateObject` both copy to the next row and can silently
overwrite it. The product uses only `duplicateClip`, only for a same-track next-
row copy, and only after independent occupancy readback proves that row empty
[K, E43]. `Clip.duplicateContent` edits the source and is not an object-copy
route [K, E43].

## Cursor windows and paging

A 64-step writer can silently lose fine-grid notes after its window. Production
writers use a fixed 512-step window [K, E44]. Exact reads use a separate
2,048-step cursor. They reconcile binary and triplet scans across all 16 MIDI
channels [K, E45, E52]. One bounded reply returns all 16 verbose channels for
each page. A 32-beat read uses two page replies instead of 112 channel replies
[K, E51, [E52](../experiments/e52-dedicated-read-window-closes-the-exact-read-gate.md)].

The selected read window reduced the measured median from 5,323 to 1,744 ms.
It passed the 50-percent Phase 4 gate. Grid and page zero share one complete
144 ms settlement. Multi-page reads still restore and settle page zero [K,
E52].

Long writes group notes by page. They confirm the pinned track and row on every
required page before mutation, use page-local steps, and restore page zero.
Read-based note properties use a separate settled turn for each page [K, E46].

## Completion signals

`Clip.addNoteStepObserver()` is a target-scoped wake hint for note existence,
numeric and enum properties, recurrence, and mute. It is not a completion
fence. The four chance, occurrence, recurrence, and repeat enable fields are
silent. Same-target foreign activity is indistinguishable until exact readback
[K, [E53](../experiments/e53-note-step-observer-is-a-partial-wake-hint.md)].

Use an eligible callback only to start exact verification early. Keep bounded
polling or a fixed fallback for silent fields and timeout. Exact bulk readback
remains the success proof [K, E53].

## Supersession record

| Date | Change |
|---|---|
| 2026-08-21 | E53 classifies note-step callbacks as an operation-specific wake hint. |
| 2026-08-21 | E52 selects the 2,048-step read cursor and closes the latency gate. |
| 2026-08-21 | E51 adds the bounded bulk-page path and its measured latency limit. |
| 2026-08-20 | Page created from the Phase 2 closeout audit. It consolidates E2, E24, and E41–E46 without changing any experiment record. |
