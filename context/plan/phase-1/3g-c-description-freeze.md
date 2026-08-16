---
title: Phase 1, session 3g-c — v1 description cohort freeze
kind: plan
state: active
status: READY 2026-08-15. The schema-v1 record and reviewed per-project
        persistence transport are complete. This session freezes the first cohort.
updated: 2026-08-15
parent: 3g-record.md
prev: 3g-b-persistence.md
next: 3g-d-instrumentation.md
scope: revised D18e
evidence: E20c; E22; D18–D20
---

# Phase 1, session 3g-c — v1 description cohort freeze

> **Purpose.** Review the complete alternate-choice surface and assign v1 to one
> exact, light description cohort before production observations begin.

## Cohort

The minimum cohort is:

- device alternates: `inspect_device_alternates`,
  `create_device_alternates`, `fill_device_alternate`,
  `switch_device_alternate`, `keep_device_alternate`, and
  `remove_device_alternate`;
- clip blocks: `inspect_clip_block`, `copy_clip_down`, `set_clip_launch`,
  `launch_clip`, `move_clip_block`, and `delete_clip`;
- ordinary coarse copying: `copy_track`.

Add a support tool only when its wording is part of a required procedure in this
cohort. Record the reason in the manifest.

## Scope

1. Create an explicit cohort manifest and one declared v1 identifier.
2. Review each name, title, description, input schema description, privilege
   class, and correctness precondition as one public artifact.
3. State object scope, mechanical costs, bank or container limits, audible
   effects, destructive seams, automatic-reversal limits, and required readback.
4. Identify `copy_track` as ordinary track editing. Do not market it as a managed
   alternate.
5. Review every `naming.ts` entry against the complete cohort. `fork`, `branch`,
   and `lineage` remain permanent bans. The existing decisions to keep `layer`,
   `chain`, and `duplicate` banned remain unless the final cohort proves that one
   is necessary.
6. Rewrite the reason in place for every reopened entry. Do not delete a ban
   without a replacement reason.
7. Freeze a canonical snapshot or fingerprint of the names, titles,
   descriptions, and agent-visible schemas. A later wording change requires a
   new version.
8. Keep the 3f-i tool identities, input identities, privilege classes, and
   emitted contract operations unchanged.

## Out of scope

- observation persistence or event writes;
- a classifier, recommendation, worked example, or automatic choice;
- lifecycle mechanics;
- a response to an ordinary anecdote before observation begins.

## Exit criteria

1. Every cohort member is explicit and no relevant tool is included by accident.
2. v1 maps to one exact canonical artifact.
3. Tests fail if the cohort wording or schema changes without a deliberate
   version update.
4. The lexical guard covers tool names, titles, descriptions, schemas, and all
   exercised emitted text.
5. No stale grouped-track or three-way-classifier language reaches an agent.
6. The cohort remains light and factual, with no choice mapping.
7. Brain typecheck, full offline tests, context check, and
   `git diff --check` pass. No live project mutation is required.
