---
title: Overlap planning workspace
kind: index
state: active
updated: 2026-10-24
---

# Overlap planning workspace

This workspace collects inputs for decisions about feature breadth. It does
not select a new implementation phase or replace the Phase 11 plan.

| Wave | Contents | Use |
|---|---|---|
| [Wave 1](wave-1/OVERLAP_REPORT.md) | Original report, capability audit, improvement candidates, and source record | Historical investigation. The audit corrects the first report. Paths are repaired; findings are retained. |
| [Wave 2 summary](wave-2/OVERLAP_STATUS_SUMMARY.md) | Another agent's status report | Historical assessment after Phase 9 |
| [Wave 2 independent judgment](wave-2/INDEPENDENT_REVIEW.md) | Confirmations and qualifications of that summary | Read with the summary |
| [Wave 3 report](wave-3/report.html) | Static synthesis with matrices, source details, dependencies, and possible sequences | Start here to compare outcomes |
| [Wave 3 inputs](wave-3/README.md) | Standalone inputs by feature area, with source and delivery records | Read the report sources |
| [Wave 3 preparation report](wave-2/WAVE_3_PREPARATION.md) | Plain account of this reorganization and preparation | Review the work done in the first pass |
| [Wave 3 changelog](wave-3/CHANGELOG.md) | Later changes to wave 3: record schema, data file, new records | Review the work done after the first pass |
| [Wave 3 external register](wave-3/external-register.md) | What each pinned project implements on the shared capability rows | Compare Ghostnote with other projects without the wave-1 audit |
| [Wave 3 data](wave-3/data/README.md) | `records.json`, check script, render script | Machine-readable source of truth for the matrices |

Wave 3 uses code, saved evidence, decisions, and current plans directly. It
does not require either earlier wave. Its candidate IDs are navigation keys,
not priorities. Raw audit data and executable checks stay in
[`context/evidence/data/overlap-audit/`](../../evidence/data/overlap-audit/).

The [input synthesis](wave-3/next-session.md) is complete. The next planning
session is [vision selection](wave-3/vision-selection.md). It will record the
user's selected outcomes and create briefs only for that work.
