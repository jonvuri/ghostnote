---
title: Phase 2, session 2e — clip lifecycle
kind: plan
state: planned
updated: 2026-08-16
parent: README.md
prev: 2d-rhythm-performance.md
next: 2f-application-planner.md
scope: Phase 2 launcher-clip lifecycle
evidence: E2, E3, E20a/b, E24 · D8, D15, D16, D18–D20
---

# Phase 2, session 2e — clip lifecycle

> **Purpose.** Complete the measured launcher-clip object contract that musical
> work will use.

## Execution order

1. Probe read and write behavior for clip length, loop start and end, name, and
   colour through an independent handle.
2. Compare `duplicateObject`, `Clip.duplicateContent`, and `duplicateClip` for
   destination control, metadata coverage, overwrite behavior, identity effects,
   and readback.
3. Record evidence before product code relies on a route. If a premise fails,
   stop and re-plan the affected capability.
4. Add verified state, typed operations, fake behavior, live encoding, write-set
   entries, fidelity labels, reversal behavior, and public low-level lifecycle
   support.

## Required boundaries

- Launcher clips only. Arrangement and audio clips remain out.
- Existing `duplicateClip` empty-destination protection remains mandatory.
- Do not expose three duplicate tools only because three API methods exist.
- Destructive delete remains on the D20 surface.
- Automation and any unreadable metadata remain named fidelity gaps.

## Exit criteria

1. Each shipped metadata field has independent read-after-write proof.
2. The selected duplication route has a stated purpose and verified empty-slot
   behavior. Unselected routes remain internal or absent.
3. The fake models each measured host trap and the conformance suite asserts it.
4. Stash and reversal reports state exactly which clip state can and cannot be
   restored.
5. Create, edit, duplicate, and directed delete work through typed operations.
6. Live cleanup restores the exact Phase 1 baseline.
7. Focused tests, full offline tests, typecheck, extension build, context check,
   and `git diff --check` pass.
