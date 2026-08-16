---
title: Phase 1, session 3g-e — reporting and live closure
kind: plan
state: planned
status: not started; depends on production recording through 3g-d
updated: 2026-08-15
parent: 3g-record.md
prev: 3g-d-instrumentation.md
next: 4-control-layer.md
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
