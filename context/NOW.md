---
title: Current state
kind: status
state: active
updated: 2026-08-18
phase: phase-2
session: 2d-grid-precision-follow-up
---

# Now

Phase 1 is complete. The [Phase 1 outcome](archive/outcomes/PHASE-1.md) maps all
six original exit criteria to evidence and records their qualifications. E39
records full live conformance. E40 records passing remote CI for candidate
`01b716265a20cbf91e6c2c1e357fb69d489ee707` and the standing regression matrix.

## Start here

1. Run the [Phase 2 session 2d grid-precision follow-up](plan/phase-2/2d-grid-precision-follow-up.md).
2. Measure raw host duration doubles before changing the grid tolerance.
3. Keep start identity exact and normalize durations only under a measured rule.
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

Session 2d added quantize, humanize, thin, and densify to the ordered pure
pipeline. Random output returns the caller seed and derived operation scopes.
Timing reports contain requested and realized beats. Thin probability means
removal and requires replace mode. Densify fills empty grid lines between onset
groups from the preceding group. Duplicate identities and unsupported grids
refuse. Same-pitch truncation is applied and reported before compilation. E41
proves mixed straight and triplet positions and durations through an independent
live witness. The probe restored all 22 occupied cells, selection, cursor homes,
transport, and observation state. Define probability direction and density
behavior when future operation shapes enter the grammar. Review found that the
measured 1/3-beat duration does not pass the unmeasured grid epsilon. Measure and
fix that boundary before session 2e. Review also made grid-cell collision checks
match encoder identity, revalidated truncated notes, and rounded humanized
velocities to the host integer representation.
