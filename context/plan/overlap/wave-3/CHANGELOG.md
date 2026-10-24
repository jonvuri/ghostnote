---
title: Wave-3 changes after the preparation pass
kind: note
state: active
updated: 2026-10-24
---

# Wave-3 changes after the preparation pass

The [preparation report](../wave-2/WAVE_3_PREPARATION.md) describes the
original collection. This file records later changes to wave 3 so that the
preparation report stays as written.

## 2026-10-24: record schema and small fixes

A review of the collection found no factual errors but several gaps in shape
and scope. This pass fixed the shape and the small gaps. The external
implementation register is the next session.

- **Record schema.** Capability rows (object plus aspect), seven fixed verb
  columns, status as a cell value from six values, a separate qualifier, and
  a separate proof level from the wave-1 audit's five levels with the Bitwig
  build on Live cells. Work records keep their IDs and point at cells. The
  matrix rule (path, predicate, counterexample) applies to every claim cell.
  See the [record conventions](README.md#record-conventions).
- **Source of truth.** [`data/records.json`](data/records.json) holds 70
  rows, 132 cells, and 58 work records. `data/check_records.py` validates it
  and checks that the documents agree. `data/render_tables.py` prints the
  tables the documents use.
- **Product rows.** All 45 current tools now appear as capability rows with
  verb cells in [current surface](current-surface.md), each with a path,
  predicate, counterexample, and proof build.
- **Normalized statuses.** Labels such as "Planned survey", "Deferred provider
  candidate", "Source lead only", and "Proposed preparation session" became
  one of the six statuses plus a qualifier.
- **New work records.** SM-9 Launcher clip and track stop; SM-10 track input
  and output routing; SM-11 project save; CA-8 Launcher audio clip reads;
  DP-6 export a device's state as a preset file; DL-7 publish the format
  spec; DL-8 publish the device and parameter-ID catalog; DL-9 publish the
  extension. Each names a pinned source path or records Not found.
- **Finding.** Gig Maestro calls `Application.createEffectTrack` and
  `Track.createParentTrack`. The v53 `add_tracks` description says no such
  route exists. Ghostnote's own E239 names the effect route as not measured,
  and E16j and E221 hold the group evidence. SM-7 carries the measurement; no
  description changed.
- **Correction after review.** `launch_clip` is a write cell only; the
  playback-state result is part of the launch, not a standalone read.
- **Dependencies.** Prerequisite and enabling IDs are separate fields; the
  typed table is in [dependencies](dependencies.md).
- **Small notes.** E4 is recorded as not an open correction
  ([delivery](delivery.md)). The two unreferenced stashes are recorded in
  [sources](sources.md). One wave-1 link label now shows the new path.
- **Provisional vision statement.** Recorded in
  [dependencies](dependencies.md#provisional-user-statement-2026-10-24),
  marked provisional, with no change to D15 or D49.

Not done in this pass: the external implementation register (per-project
columns with the same row keys), the final report, and any specification or
tool-description change.

## 2026-10-24: external implementation register

- **Register.** [external-register.md](external-register.md) and the
  `externalCells` list in `data/records.json`: 129 cells on
  59 shared rows across 13 projects, each with
  pinned path, predicate, counterexample, proof level, and evidence note.
  All 40 wave-1 audit rows map to cells or a stated exclusion. The 12 clone
  HEADs were confirmed against the pins; every cited path was re-read.
- **Cross-cutting rows.** `write.readback`, `write.selection`, `write.basis`,
  `write.destructive-separation`, `cost.ledger`, and `descriptions.versioning`
  hold the audit's safety and operations comparison, with Ghostnote claim
  cells of their own.
- **Correction from re-verification.** Control Deck has
  `bitwig_save_device_preset`, an action-based Save to Library route with
  fixed sleeps and no file readback. DP-6 is now Candidate with that source
  instead of Unresolved and Not found. bitwig_agent also has an
  enabled-state setter, a create_effect_track flag, and a named-action group
  route; those appear as external cells on the SM-7 and device.enabled rows.
- **Tooling.** `check_records.py` validates external cells and checks that
  the register names each one exactly once. `render_tables.py` has
  `external-matrix` and `external <area>` modes.
- **Links.** Each feature-area document, the current surface, the source
  register, the README, and the next-session brief point to the register.
- **Totals after this pass.** `records.json` holds 76 rows, 137 Ghostnote
  cells, 58 work records, and 129 external cells.

## 2026-10-24: input synthesis and vision review

- **Report.** [report.html](report.html) is a static page with workflow
  summaries, filterable Ghostnote and external matrices, separate status and
  proof views, dependency diagrams, effort drivers, and six possible
  sequences. Each cell opens its full source, predicate, and counterexample.
  All 58 work records have a disposition; none is excluded. The report keeps
  all 76 rows, 137 Ghostnote cells, and 129 external cells.
- **Baseline.** Confirmed 45 tools in the v53 artifact, v53 in source, and
  installed Bitwig 6.1.4. No runtime changes existed since HEAD `217cfb99`
  at entry. No Bitwig request ran.
- **Vision.** D15 and D49 are explained separately. The provisional preference
  for capabilities, speed, and functional equivalence remains provisional.
  The report gives outcomes equal attention. No new priority order, contract
  change, or implementation brief was selected.
- **Owners.** The report retains Phase 11 for GI-1/GI-2, 8i17 for MA-6,
  Phase 5 closeout, and the Phase 10 publication and release owners.
  [Vision selection](vision-selection.md) is the next decision session.
- **DL-6.** Corrected the current format spec and parser comment: real
  `0x02` body fields, scoped `0x06`/`0x1a` non-observation, recursive codec
  evidence, the `0004` decoder with a blocked exact-build extractor, and
  E276's scoped descriptor result. Sentinel and sampled-reference rules
  remain. Runtime bytes after the opening comment are unchanged. No E/D
  record or tool description changed.
- **DP-6 consistency.** Corrected the remaining prose that said no pinned
  clone had preset export. It now agrees with the register's action-based
  route and lack of saved-file or reload proof. The source data is unchanged.
- **Checks.** Record validation and deterministic report checks pass. The
  builder checks all dispositions and cells, local links, and internal
  anchors. Browser checks cover filters, nested evidence links, desktop and
  narrow layouts, and console errors. `git diff --check` passes. The context
  check reports only 18 missing-frontmatter errors confirmed in HEAD.

Maintenance lesson: a record validator can check IDs and statuses but cannot
catch a contradicted sentence outside a table. When a register fact changes,
check the nearby narrative as well. DP-6 exposed this gap.

## 2026-10-24: compact external comparison

- Keep Ghostnote first. Sort external columns by recorded capability-cell
  count, excluding Not found, with project name as the tie break.
- Put each verb above its proof level. Use narrow columns and vertical
  headers with counts. All 13 external projects fit beside Ghostnote at
  1280- and 1440-pixel desktop widths. Project and verb filters still work.
- Clarify that the records do not classify verb applicability. Retain
  Ghostnote dashes for unrecorded standing; do not infer N/A from missing data.
- Record and report checks pass. All 266 cell details and 58 work records
  remain. The 320-pixel viewport keeps matrix overflow inside its scroll area.
