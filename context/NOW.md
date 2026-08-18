---
title: Current state
kind: status
state: active
updated: 2026-08-18
phase: phase-2
session: 2d-rhythm-performance
---

# Now

Phase 1 is complete. The [Phase 1 outcome](archive/outcomes/PHASE-1.md) maps all
six original exit criteria to evidence and records their qualifications. E39
records full live conformance. E40 records passing remote CI for candidate
`01b716265a20cbf91e6c2c1e357fb69d489ee707` and the standing regression matrix.

## Start here

1. Run [Phase 2 session 2d](plan/phase-2/2d-rhythm-performance.md).
2. Implement quantize, humanize, thin, and densify as seeded pure transforms.
3. Measure triplet readback through an independent live handle. Restore the
   documented project baseline after the probe.
4. Do not schedule [async batch completion](plan/phase-1/6-async.md) unless a
   measured Phase 2 workload justifies it.

## Baseline

- Project: `gn-scale-test`; 10 launcher rows; 10 visible tracks.
- Observation record: exact empty schema-v1 canonical value.
- `Last change`: `Change · 4a-live-check`.
- Selection: track 0, row 1.
- Transport: stopped.
- Wire: 134 methods / `c2aa57be11e1f47e`.
- Description cohort: `ghostnote-description-v1`, 15 tools, SHA-256
  `9fa9bc1cc390f7a274b64b41c6aea26235562822ed7f804d9f6aac7dea540ebd`.
- E39 cleanup removed generated tracks `06cd7b87-70b1-4cdd-8634-feb267a25b28`
  and `15a1a9fe-9964-414d-b9b4-ab1746342c3d`. Final checks found the same 10
  tracks, 10 scenes, 22 occupied cells, selection at track 0 row 1, stopped
  transport, and exact observation value. All three cursor tracks and clips
  were unpinned on `gn-lay` row 0. `Last change` was restored.

Confirm these track identities before a destructive live sweep:

| Track | Durable id |
|---|---|
| Instrument Layer | `98ba8aa3-dbce-4e51-8bb2-de9302542b6e` |
| Hybrid 2 | `4a6a024a-f213-48f1-9029-532fc077d857` |
| gn-A | `d61c23c2-4f85-4eee-bc08-8bb9baf6ff63` |
| gn-B | `78a40fcf-3eae-48fc-badf-1ff18900166b` |
| Group 5 | `ae4caa0f-f689-4f17-88cf-a5ae0d9ebdd3` |
| gn-lay | `d367ac16-b7bd-4662-971f-fe924ec033a3` |
| gn-lay4 | `9a88b37d-337a-4ef2-96a8-a147419d7cda` |
| gn-sel | `6fb96670-abde-4958-9147-f573a4b43918` |
| FX 1 | `52bd865e-c958-4bda-b9d3-97d0ea2f463a` |
| Master | `834e65ab-efa4-4bc6-ae9d-4eafd818d16e` |

## Session retrospective

Session 2c added pure ordered harmonic transforms. Beat selection is half-open;
pitch selection is inclusive. Exact-onset grouping and harmony-region resolution
are replaceable policies. The current resolver uses one full-range context and
fills missing chord or scale tones near each group's lowest pitch. Duplicate
identities and MIDI range failures refuse. Pressure refuses before compilation.
All 20 writable note properties round-trip in the focused fixture. Re-voice now
reports `octave-displaced`, which changed only the version-1 report fingerprint.
Merge transformations emit only new or changed notes. Group reconstruction keeps
interleaved unselected notes in place. Future key-change work can provide several
regions through the existing resolver. No repository instruction change is
needed.
