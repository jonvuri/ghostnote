---
title: Current state
kind: status
state: active
updated: 2026-08-18
phase: phase-2
session: 2h-conformance
---

# Now

Phase 1 is complete. The [Phase 1 outcome](archive/outcomes/PHASE-1.md) maps all
six original exit criteria to evidence and records their qualifications. E39
records full live conformance. E40 records passing remote CI for candidate
`01b716265a20cbf91e6c2c1e357fb69d489ee707` and the standing regression matrix.

## Start here

1. Run [Phase 2 session 2h](plan/phase-2/2h-conformance.md).
2. Extend fake and live conformance through both public musical tools.
3. Restore the documented live baseline after every arm and record measured
   workload latency before any async decision.
4. Do not schedule [async batch completion](plan/phase-1/6-async.md) unless a
   measured Phase 2 workload justifies it.

## Baseline

- Project: `gn-scale-test`; 10 launcher rows; 10 visible tracks.
- Observation record: exact empty schema-v1 canonical value.
- `Last change`: `Change · 4a-live-check`.
- Selection: track 0, row 1.
- Transport: stopped.
- Wire: 138 methods / `87619942d7eac74d`.
- Description cohort: `ghostnote-description-v2`, 28 tools, SHA-256
  `5842b7410066a3e89bb17dc51b4fb884052e9eec844c2c95c0834ca0675a57bc`.
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

The 2g surface exposes `generate_clip_music` and `transform_clip_music` over one
strict patch grammar and the single 2f planner. The public result keeps musical
output, differences, warnings, readback, change identity, and reversal limits.
Description v2 freezes 28 tools and the musical result contract without changing
the v1 artifact. Observation schema v2 records concise musical use and migrates
valid v1 records exactly.
The review follow-up keeps root-level patch validation strict and states that
requested variations can copy source clips into adjacent rows.
The first live probe printed complete JSON schemas in a passing check. It now
reports only names and privilege annotations. Keep large artifacts in goldens
and live evidence concise. No repository instruction change is needed.
