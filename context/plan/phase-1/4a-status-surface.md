---
title: Phase 1, session 4a — status surface and panel cleanup
kind: plan
state: active
status: READY 2026-08-16. Session 3g-e left the observation record hidden and
        live-proven. This slice removes probe UI and adds product status only.
updated: 2026-08-16
parent: 4-control-layer.md
prev: 3g-e-reporting.md
next: 4b-change-navigation.md
evidence: E14 rows A–D and F–I, E14-A1, E20d; D14, D18–D20
needs: Bitwig foregrounded, a human at the keyboard
---

# Phase 1, session 4a — status surface and panel cleanup

> **Purpose.** Leave one small, truthful product status surface in Bitwig while
> preserving the hidden per-project observation record.

## Scope

1. Remove product-visible Signal, Enum, slot, shape, hardware, bitmap, and other
   E14 probe controls. Keep historical evidence and probes as records, but do not
   present their apparatus as product UI.
2. Keep one visible `Last change` String setting. Create it during `init()`.
3. Keep the observation record created and hidden during `init()`. Preserve the
   guarded `Setting` downcast and the refusal to create a large visible field.
4. Replace generic probe reads and writes with the smallest production status
   seam. Do not promote the generic `ui.set`, `ui.get`, or `ui.status` surface.
5. Push status after a recorded product change and after directed reversal. Do
   not call an accepted refusal or a zero-write result a change.
6. Name ordinary track copies, managed device alternates, and managed clip
   alternates separately. A mixed operation can name both managed
   representations. Do not add a score, recommendation, or dispatch rule.
7. Detect and repair user edits inside the extension. The repair must not open a
   bridge connection or depend on the MCP server.
8. Remove the Revert signal and all server-side polling assumptions. Preserve the
   source and wire bans on `ui.signalFire`.

## Decisions this slice must make

- **Status text shape.** Keep it concise enough for the controller pane. Prefer a
  stable factual category plus the recorded change id. Do not claim that an
  unrecoverable or zero-write operation changed Bitwig.
- **Local repair mechanism.** Use the setting observer and an explicit
  extension-side last-pushed value. Guard against observer recursion and the
  initial persisted-value callback.
- **Probe retirement boundary.** Remove probe apparatus from the product build
  where practical. Retain evidence and historical scripts that explain the
  measured API behavior.

## Exit criteria

1. The controller pane shows one product status field and no Revert, take,
   pre-allocated slot, enum-shape, hardware, bitmap, or late-setting probe UI.
2. Production changes update status through a narrow seam. Tests cover an
   ordinary track copy, a device alternate, a clip alternate, a mixed result, a
   reversal, a refusal, and a zero-write result.
3. Editing the status field restores the last product value locally. It starts no
   timer, bridge connection, or MCP request.
4. The observation setting is hidden at construction. Its existing large-value
   persistence and responsive-pane checks remain green.
5. `ui.signalFire` remains absent from handler source and the wire golden.
6. Brain typecheck and tests, extension tests, context check, and
   `git diff --check` pass. A focused live check confirms the reduced pane,
   status update and repair, restart behavior, and hidden large record.

## Out of scope

- recorded-change navigation — session 4b;
- pane action buttons or an event transport;
- automatic progress notifications;
- changes to reversal semantics or permission annotations;
- observation reporting or description-cohort changes.
