---
title: Phase 1, session 3g-e — reporting and live closure
kind: plan
state: complete
status: COMPLETE 2026-08-16. Raw and aggregate reporting, restart survival,
        hidden-field visibility, and exact cleanup pass offline and live.
updated: 2026-08-16
parent: 3g-record.md
prev: 3g-d-instrumentation.md
next: 4a-status-surface.md
scope: revised D18e/f
evidence: E20d; D18
needs: Bitwig running; human confirmation of the settings pane
---

# Phase 1, session 3g-e — reporting and live closure

> **Purpose.** Make the observation instrument readable and prove the complete
> record, restart, and reporting path against a real project.

## Scope

1. Add a read-only raw record view.
2. Add reporting stratified by requested scope and actual structure.
3. Report managed events, ordinary track-copy uses, and instructions with no
   structure as distinct outcomes.
4. Keep raw entries available beside aggregates so a later analysis can replay
   them.
5. Report operator-response counts for `accepted`, `vetoed`, and `silent`
   separately.
6. Report choice diversity beside response rates. Do not interpret a lower veto
   rate as proof of better choices.
7. Keep reporting descriptive. Do not add a default, score, recommendation,
   redirect, or dispatch rule.
8. Exercise device-only, launcher-clip-only, mixed, track-copy, veto, and
   no-action observations through the production MCP surface.
9. Save and reopen the project, then prove exact record and description-version
   survival.
10. Confirm by eye that the hidden setting is absent and that the settings pane
    remains responsive with the test record loaded.
11. Remove every project fixture and return the live project to its documented
    baseline.

## Out of scope

- changing v1 wording in response to this first controlled run;
- retention, compaction, export files, or record deletion;
- a policy engine or automatic choice;
- session 4 status, navigation, or human control actions.

## Exit criteria

1. Raw export reproduces every persisted entry without classification loss.
2. Aggregate counts reconcile exactly with the raw entries.
3. Requested scope and actual structure can be cross-tabulated without linking
   independent lifecycles.
4. Track-copy uses remain outside managed-event counts.
5. Accepted, vetoed, and silent responses remain distinct after restart.
6. Every row reports the v1 description version.
7. The hidden field remains absent and the pane remains responsive.
8. Brain checks, extension tests, context check, `git diff --check`, live
   conformance, and the full 3g production MCP smoke pass.
9. No track, clip, scene, container, device, or transport residue remains.

## Completion — 2026-08-16

`read_observation_record` returns the complete validated record and its canonical
JSON. `report_observations` returns descriptive entry totals, independent device
and clip event counts, ordinary track-copy counts, unreferenced-result counts,
response counts and rates, description-version totals, scope summaries, and an
exact requested-scope by result-profile cross-tab. Each result profile keeps
device events, clip events, and track-copy uses separate. The report makes no
score, default, recommendation, redirect, or dispatch decision.

The controlled production record held six instructions: device-only,
launcher-clip-only, mixed, ordinary track-copy, explicit veto, and no action. It
held 11 rows: six instructions, four managed events, and one ordinary use. The
responses were three accepted, one vetoed, and two silent. Raw JSON and the full
aggregate report survived a save, full Bitwig restart, and project reopen
exactly. Every row retained `ghostnote-description-v1`. The operator confirmed
that the `Observation record` field was absent and that the controller pane was
responsive.

The first cleanup found a positional batch defect in `delete_track`. Two durable
ids were resolved before either removal, so removing the lower position first
shifted the second position onto `FX 1`. The operator restored `FX 1` with native
undo under its original durable id. `delete_track` now refuses repeated ids and
orders several removals from the highest observed position to the lowest. A
focused offline regression and a live two-track cleanup rerun both pass. The
prior empty record and all 10 baseline track ids are restored exactly.

Brain typecheck and **492/492** offline tests pass. Extension Gradle test,
context check, and `git diff --check` pass. Live conformance passes **52/0/6**.
The restart reporting smoke passes **P0-P7**, and the corrected preserving
cleanup passes **3/3** with no fixture residue.

## Retrospective

Structural batches need an ordering audit whenever one operation changes the
position used by a later operation. A durable input id does not make a
pre-resolved wire position durable within that batch.
