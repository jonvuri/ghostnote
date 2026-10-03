---
title: Phase 8g4 — Native topology and ordering coverage
kind: plan
state: active
status: Ready. 8g3 is complete; live acquisitions use the step-delta window and bounded enrichment.
updated: 2026-10-03
parent: 8g-shadow-project-cache.md
prev: 8g3-snapshot-and-global-budgets.md
next: 8g5-final-shadow-acceptance.md
---

# Phase 8g4 — Native topology and ordering coverage

## Entry and scope

Use the [8g2](8g2-project-continuity.md) guard decision, the
[step-delta window](8g2b-step-delta-read-window.md), and the 8g3 resource results
in [E219](../../evidence/experiments/e219-snapshot-budgets-and-combined-storage.md).
Comparisons now take 2–3 s; each enrichment poll runs one bounded batch.
Read the [review ledger](../../evidence/format/PHASE8G_INTERMEDIATE_REVIEW.md),
8d state machine, identity rules, and later E214 native controls. Reuse 14
structural fences, three inventory interruptions, Group/Ungroup, isolated Add
Scene, compound Add Scene then Move, one velocity edit, and the one B overlap.
Keep each denominator separate. 8g remains active; do not enter 8h.

## Owned files and interfaces

- `ShadowGroupControl.java`, `ShadowSceneControl.java`, and rig topology reads.
- `ShadowCacheProbe.java` and core repair/rebuild seams for native topology.
- Structure, UI group/scene/note, and ordering drivers and tests.
- Followup artifact roles, semantic verifiers, and new immutable reports.

The identity protocol, selected StepData replay, pool, and independent field
oracles are dependencies. A flat census cannot prove group descendants.

## Work and independent oracles

1. List the remaining native clip/scene/track/group transitions against the
   8d repair/rebuild rules. Identify accepted rows that need no repeat. Include
   ambiguous equal-content moves and incomplete event windows with refusal.
2. Establish a group membership oracle independent of flat bank appearance.
   Include expanded/collapsed groups, nested groups, child position changes,
   and unchanged unrelated tracks. If no safe oracle exists, preserve the
   unsupported membership state and rebuild/refuse affected cache paths.
3. Extend native ordering at the specific 8g2 publication boundaries. Run
   prepare and sampling in one process. Check acquisition remains active before
   counting a command overlap. Include a return transition during acquisition
   as a separate case when the intended protocol needs it.
4. Use external command logs and current host reads independently of callback
   traces. Preserve callback drops, sample errors, event gaps, current payload,
   and historical labels. A trace with zero drops does not prove no host loss.
5. For scene and note controls, declare the exact native operation and keep
   action count separate from observation count. Persist failed preparations
   and compound actions under separate diagnostic roles.

## Acceptance criteria

- Each in-scope native transition either preserves identity with the required
  ordered proof or retires/rebuilds before current output. Equal content alone
  never proves a move, replacement, or loaded continuity.
- Group membership has a complete independent oracle for the supported scope.
  Missing descendants or unknown topology cannot be marked complete.
- Each accepted ordering trial has a command interval inside active acquisition,
  current guarded outcomes, no stale payload, and independent recovery.
- One prior B overlap remains one bounded trial. A after retirement is not an
  additional overlap case. Late commands and observation gaps stay diagnostics.
- Native note fields, all channels, and unrelated tracks remain equal to their
  independent expected state. R2's retained rejection remains effective.
- Cleanup proves the stated topology and API baseline. Identical viewport is
  claimed only with separate visual evidence; it is not implied by API checks.

## Checks, live cleanup, and stopping rule

Run affected model/adapter/native-helper tests and artifact mutants for omitted
descendants, wrong addresses, current output after retirement, late commands,
and altered declarations. Run the full required checks at handoff.

Use guarded owned tracks/clips and exact baseline IDs. Reload by the repository
procedure and verify the marker. Do not delete a group wrapper while descendant
ownership is unproved. Use native Ungroup and prove exact census restoration
before deleting an owned empty child. Restore scenes, notes, selection, cursors,
pins, config, engines, and normal runtime. Never save or close original `New 1`.

An unknown descendant, incomplete census, action outside acquisition, unexpected
mutation, or unavailable authority stops that arm. Keep the diagnostic and use
the safe restoration path. Do not turn absence of a callback into a defect claim.
Unresolved host knowledge questions remain unsent without user authorization.

## Exit

Map every remaining structural criterion to a pass or explicit unsupported
state. Keep any required unproved gate open. Stage changes without a commit and
hand off to 8g5.
Suggested commit message: `test: cover native shadow topology and acquisition ordering`.
