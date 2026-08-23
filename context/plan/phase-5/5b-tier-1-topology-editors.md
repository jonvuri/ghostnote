---
title: Phase 5b — Tier-1 topology editors
kind: plan
state: complete
status: Complete. E66 records the passing Tier-1 editor matrix and exact cleanup.
updated: 2026-08-23
parent: README.md
evidence: D1, D3, E10, E10f, E13, E65, E66
---

# Phase 5b — Tier-1 topology editors

## Purpose

Complete the small Tier-1 editor set that follows Phase 5a. Add replace,
retarget, and delete to the checkpointed preset-load path. Prove each edit with
live remote readback and reverse each executor take.

## Scope

1. Accept an absolute unsampled `.bwpreset` template and one replace, retarget,
   or delete edit.
2. Apply the matching `bwmod` editor and run `validate()` before any project
   write.
3. Load the edited preset through `device.insert` and return its take and minted
   device address.
4. Report the before and after modulator inventory as structural evidence.
5. Verify expected remote-page counts. For route changes, verify exact active
   and inactive page-and-control witnesses.
6. Keep the sampled-preset footprint refusals for replace and delete. Do not
   infer a missing footprint.
7. Reverse every take in the focused live proof and restore the exact entry
   track list.

## Acceptance criteria

- Offline tests prove the edited bytes, validation-before-apply gate, structural
  report, expected page counts, exact active and inactive witnesses, executor
  take, minted address, and reversal.
- Replace proves that the donor page exists and the removed page does not.
- Retarget proves that modulation leaves the old control and reaches the new
  control.
- Delete proves that the removed page and its modulation are absent while a
  sibling modulator page remains.
- A replace or delete with an unknown sampled footprint refuses before
  `apply()`.
- `npm run check` and the extension Gradle tests pass.
- The focused live proof leaves no track, device, or temporary-file residue.

## Out of scope

- Sampled integration and new footprint measurements.
- Containers, list selection, composition, and cross-device routes.
- Public MCP tools.
- New templates or donors.

## Current verification

- `npm run check` passes 777/777.
- The focused changed suites pass 49/49.
- `./gradlew test` passes, and the current extension is deployed and loaded.
- `npm run probe:hello` passes, including deploy freshness.
- `npm run probe:phase5b-authoring` passes replace, retarget, delete, every
  reversal, and exact seven-track cleanup.
- [E66](../../evidence/experiments/e66-tier-1-topology-editors-are-live.md)
  records the implementation, proof, cleanup, and qualifications.

## Implementation finding

The remote-control observer did not mark `hasAutomation` interested. A guarded
read therefore omitted the field, even though the reply handler requested it.
The extension now subscribes to the property, and an offline source assertion
keeps that requirement in place.
