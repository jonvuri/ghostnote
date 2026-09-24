---
title: E131 — Consolidated clip acquisition
kind: evidence
state: active
updated: 2026-09-24
parent: ../../plan/phase-7/7b-follow-up-consolidated-clip-acquisition.md
---

# E131 — Consolidated clip acquisition [K]

## Verdict

One `1/512` step-data view is not a complete note-time discovery grid. A
`1/512` and `1/768` sparse union matches the complete dual-grid host reads on
the tested fixtures after lossless reconciliation. However, conservative
observer settlement makes the sparse route slower end to end. Keep it as a
probe. The complete dual-grid reader remains the authoritative route. Its
reconciliation now retains a note that only one grid reports and refuses
nearby unmatched identities from both grids.

The experimental `phase-7b-agent-note-patch-v0` profile now exposes
`acquire_clip_note_source`. It resolves one launcher clip by durable track ID
and row, reads all 16 channels through the complete reader, rejects unsupported
geometry and normalization collisions, and returns normalized `1/512` ticks
with the exact guarded source. The stable profile is unchanged.

## Sparse enrichment proof

The live probe used short and long sparse and dense clips. The fixtures covered
all 16 MIDI channels, straight and triplet starts, late pages, same-pitch
adjacency and overlap, and every readable optional note field. The probe read
all channels only at settled occupied coordinates. It compared every raw field
and normalized time with the complete reader.

An exact adjacent same-pitch pair appeared as two occupied notes at `1/512` and
one note at `1/768`. Thus, strict equality between the two host grids is not a
valid reconciliation rule. The probe kept the `1/512` set as the identity base,
matched compatible `1/768` notes by channel, pitch, fields, and nearest time,
and retained unmatched notes from either grid. This preserved the adjacent
pair and matched the complete dual-grid result. The complete reader now uses
the same lossless rule.

| Fixture | Notes | Pages | Sparse `getStep` calls | Settlement ms | Host reads ms | Bridge ms | Normalize ms | Sparse total ms | Complete total ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Short sparse | 22 | 2 | 208 | 988.447 | 0.573 | 47.667 | 3.237 | 1,651.801 | 776.603 |
| Short dense | 96 | 2 | 3,072 | 993.996 | 1.748 | 51.865 | 7.105 | 1,666.541 | 816.895 |
| Long sparse | 24 | 5 | 288 | 1,751.253 | 0.814 | 122.125 | 1.625 | 2,555.685 | 1,930.498 |
| Long dense | 280 | 5 | 8,480 | 1,723.092 | 6.331 | 114.125 | 13.837 | 2,552.252 | 1,816.085 |

The sparse targeted host work scales with occupied coordinates. Its observer
has no completion signal. The probe therefore required five unchanged polls
and at least 250 ms for each view. This wait dominates the saved host calls.
A cache would still need an authoritative initial scan and uncertainty
invalidation. No cache was added.

## Acquisition boundary

`acquire_clip_note_source` is a read-only experimental tool. It requires a
settled and completely covered track and scene inventory. It refuses a missing
or ambiguous target and project, generation, scene, or content drift during
the read. It uses the existing complete reader and reports
`authoritative-complete-scan` with complete coverage across 16 channels.

The result includes clip metadata, normalized note starts and durations,
logical event IDs, coverage, project and content guards, the source digest,
and the existing exact source accepted by the proposal tool. Normalization
refuses two same-channel and same-pitch notes that map to the same tick. The
played-range diagnostic runs before the result is returned.

`GHOSTNOTE_TOOL_PROFILE=phase-7b-agent-note-patch-v0` enables the route. An
unknown profile refuses at server start. The default stable server profile and
its tool list do not change.

## Live route check

The deployed extension reported Controller API 25, 157 methods, and method
hash `905bc2531512025b`. The read-only live acquisition check used the selected
empty launcher clip in project `New 1`. It returned a valid guarded zero-note
source in 2,418.774 ms. Acquisition used 2,350.355 ms and normalization used
0.152 ms. The adapter restored launcher track 0 and row 0. The read moved the
mixer selection from track 1 to track 0, which is an existing exact-reader
boundary. Probe cleanup restored mixer track 1. Focused fake-adapter coverage
proves the same route with three notes and proves normalized collision refusal.

The sparse fixture probe created one owned track and five owned clips. It
removed them, restored the exact four-track launcher selection, and stopped
transport. The acquisition check was read-only. No test residue remains.

## Verification

The complete brain check passes 1,176 tests. The extension build, context link
check, generated wire-golden check, and whitespace check pass. The sparse live
probe and guarded acquisition live check both pass.

## Retrospective

The agent-facing timing lattice is not a host discovery guarantee. Keep the
representation lattice separate from the acquisition grids. Measure observer
settlement before treating reduced host calls as a latency improvement.
