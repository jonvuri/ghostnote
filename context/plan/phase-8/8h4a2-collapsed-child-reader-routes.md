---
title: Phase 8h4a2 — Collapsed-child reader routes
kind: plan
state: planned
status: Planned. Finds a reader route that binds any row of a track inside a collapsed group. Independent of 8h4b–8h4f.
updated: 2026-10-06
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h4a-write-boundary-and-reader-hardening.md
next: 8h4b-document-read-and-identity-registry.md
evidence: E16, E221, E223, E232, E234; D30, D33
---

# Phase 8h4a2 — Collapsed-child reader routes

## Why

Since D33 the product bank lists the children of a collapsed group (E234).
The reader binds only row 0 of such a child. A read of another row refuses
with `bound-target-mismatch` and returns no content (E221, E223, E234). The
refusal is safe, but an agent cannot read those clips until the operator
expands the group.

This is not the E232 defect. E232 was a pin that the host did not remove. In
E221 the reader cursor was unpinned and stayed at row 0 for 30 s. The likely
cause is that a slot in a collapsed group cannot become the launcher
selection, which the reader cursor follows. E221 tried only
`Track.selectSlot` and `ClipLauncherSlot.select`.

## Candidates

Each candidate is one research route in `ClipReadRoute.DIAGNOSTIC_ROUTES`
(probe profile only). It replaces only the select-and-point step of the 8h3c2
open order. The D30 close, the confirmation, the release, the E99 lease, and
the bound-target guard do not change.

1. **`show-in-editor`.** Call `ClipLauncherSlot.showInEditor()` on the target
   slot instead of the row selection, then point the reader.
2. **`cursor-step`.** Bind the row that the reader reaches, then move the
   reader with `selectFirst` and `selectNext` until the bound row equals the
   target row, one task for each step. Refuse after a bounded step count.
   Record whether a step passes empty slots.
3. **`expand-parent`.** Expand the parent group with `isGroupExpanded`, read
   with the product route, and collapse it again in the close task. Find the
   parent through `Track.createParentTrack` if it can be allocated within the
   rule 13 budget; otherwise record that the route needs topology.

Candidates 1 and 2 have no visible UI side effect apart from the selection
that the reader already borrows. Prefer them. Candidate 3 is the fallback.

## Work, in order

1. Add the three routes to the research reader and a unit test of each route
   order in `ClipReaderTest`.
2. Live matrix in an owned unsaved project (D29), with the probe archive
   (`./gradlew copyProbeExtension`). A child track inside a group has distinct
   clips at rows 0, 1, and 63 (the E232 shapes), and row 2 is empty. The
   operator groups the track and collapses the group.
3. Read each row through each route, from three entry selections (another
   track, the target slot, another row of the target track), and repeat after
   an expand-and-collapse. A read passes only when it binds the requested
   track and row, returns exactly the declared notes, keeps the D30 capture
   rules, and restores the slot track, slot row, and mixer track. Compare
   each pass with an independent read made while the group is expanded.
4. Run the same matrix with the group expanded, to show that the route does
   not regress the normal case.
5. If a route passes every case, make it the product open order for a target
   inside a collapsed group, or for all targets if it is equal on expanded
   tracks. Add a build marker and run the normal-profile acceptance. If no
   route passes, keep the refusal, give it a reason that says to expand the
   group, and record the measured failures.

## Acceptance criteria

- Every candidate has a recorded result on every case, including failures.
- A product change is made only for a route that passes the complete matrix,
  collapsed and expanded, with no refused or wrong read.
- No read publishes notes from another row. Refusals stay fail-closed.
- Fresh hello passes with any new marker. The anchor `gn-scale-test` matches
  `phase8h4a-boundary/baseline-final.json`, and owned projects are closed
  without saving.
- Brain check, extension check, wire goldens, retained offline verifiers,
  context check, and `git diff --check` pass. Record the evidence as E240.

## Out of scope

- Group topology and group membership in the product inventory.
- Group-slot reads (8h4a refuses them by design).
