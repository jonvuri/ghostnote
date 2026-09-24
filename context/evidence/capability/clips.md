---
title: Launcher clips — timing, metadata, paging, and duplication
kind: capability
state: active
updated: 2026-09-24
scope: launcher-clip notes, metadata, exact reads, writes, and copies
evidence: E2, E24, E41–E46, E51–E54, E116, E119, E130; D8, D9, D15, D16, D21
---

# Launcher clips

> **Provenance.** Each claim carries `[K]` known, `[I]` inferred or `[U]`
> unknown, and cites its E-number. Read the four rules in
> [INDEX.md](INDEX.md) before you edit this page.

## Current statement

**Launcher clips have exact typed note and measured metadata paths. A step-data
observer replays sparse occupancy, but complete notes still require targeted or
full `getStep` reads. A copy is safe only after the next row is proved empty.** [K,
[E43](../experiments/e43-clip-metadata-and-duplication-routes.md),
[E45](../experiments/e45-first-real-musical-dogfood.md),
[E46](../experiments/e46-long-clip-editing-follow-up.md),
[E130](../experiments/e130-constant-time-launcher-clip-read-search.md)]

The product supports launcher clips only. Arrangement clips and audio clips are
not in this contract [K, [D21](../../decisions/d21-musical-patch-and-public-tool-grain.md)].

## Timing and grids

- Start positions stay exact integer coordinates on one supported per-operation
  grid [K, [E2](../experiments/e2-note-round-trip-fidelity-grid-observer-gotcha-2026-07-18.md),
  [E41](../experiments/e41-triplet-rhythm-readback-and-seeded-transforms.md)].
- Supported binary grids run from 1 beat through `1/512` beat. This limit equals
  a conventional 2048th note. Supported triplet grids run from `1/3` through
  `1/768` beat. The triplet limit equals `1/3072` of a whole note and matches
  the binary floor [K, [E116](../experiments/e116-fine-timing-and-two-layer-groove-contract-pass.md)].
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
channels [K, E45, E52, E116]. One bounded reply returns all 16 verbose channels
for each page. At the E116 limits, a 32-beat read with the selected 2,048-step
reader uses 8 binary and 12 triplet pages. A 512-step reader uses 32 and 48.
E119's offline transport proof corrects the reader-width assumption in the E116
handoff [K, [E119](../experiments/e119-offline-verification-cost-audit.md)].

The selected read window reduced the measured median from 5,323 to 1,744 ms.
It passed the 50-percent Phase 4 gate. Grid and page zero share one complete
144 ms settlement. Multi-page reads still restore and settle page zero [K,
E52]. These historical medians predate E116's finer grids. For 32 beats at the
selected width, the current reader schedules 3,168 ms of page/reset waits alone
[K, E119]. Current complete live latency is unknown [U, E119]. Use the
[verification ledger](../format/WORKSTATION_VERIFICATION.md) for scope and timing
rules.

A complete API 25 and runtime-proxy inventory found no supported direct note
enumeration, serialization payload, clipboard read, in-memory MIDI export, or
project-state route. Playback monitoring is incomplete. `Clip.getStep` remains
the only supported source of complete `NoteStep` fields [K,
[E130](../experiments/e130-constant-time-launcher-clip-read-search.md)].

`addStepDataObserver` replays occupied cells after target, grid, and page
changes. It reports `x`, `y`, and state only. It collapses MIDI channels and
has no completion signal. It can index targeted 16-channel `getStep` reads, but
that combined route is not yet authoritative [K, E130].

`addNoteStepObserver` remains a partial wake hint. It does not replay initial
state and misses some note-field changes. Do not carry those limits to the
separate step-data observer [K, E53, E130].

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

## Mutation settlement

Compatible adjacent note writes share one transport frame only within the same
clip, channel, and exact grid. One batch caches confirmed writer targets, grids,
and pages. It restores and verifies page zero once. Structural operations clear
the cache [K, [E54](../experiments/e54-clip-mutation-settlement-is-bounded.md)].

Final exact reconciliation compares the complete expected state on all 16 MIDI
channels. It detects missing, changed, and unexpected notes. A delayed result
gets one exact read retry. A mutation is not replayed after an ambiguous result
[K, E54].

If a later dependency stage rejects, changed targets from completed stages stay
reversible. Exact before-and-after state excludes untouched later clips. A
changed note clip keeps all 16 captured channels in its inverse [K, E54].

The controlled two-clip expression workflow fell from 11,444 ms to a 7,749 ms
median. It passed the fixed 9,000 ms gate with all eight exact bulk page reads,
exact reversal, and cleanup [K, E54].

## Supersession record

| Date | Change |
|---|---|
| 2026-09-24 | E130 follow-up proves sparse occupancy replay from `addStepDataObserver` and selects targeted channel enrichment for the next proof. |
| 2026-09-24 | E130 finds no direct note-enumeration method in Controller API 25. |
| 2026-09-21 | E119 corrects the E116 page-count reading by reader width and separates scheduled waits from live latency. |
| 2026-09-13 | E116 extends binary timing through 1/512 beat and triplet timing through 1/768 beat. |
| 2026-08-21 | E54 bounds mutation settlement and complete exact reconciliation. |
| 2026-08-21 | E53 classifies note-step callbacks as an operation-specific wake hint. |
| 2026-08-21 | E52 selects the 2,048-step read cursor and closes the latency gate. |
| 2026-08-21 | E51 adds the bounded bulk-page path and its measured latency limit. |
| 2026-08-20 | Page created from the Phase 2 closeout audit. It consolidates E2, E24, and E41–E46 without changing any experiment record. |
