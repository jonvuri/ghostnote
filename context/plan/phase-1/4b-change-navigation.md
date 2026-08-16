---
title: Phase 1, session 4b — navigation to a recorded clip change
kind: plan
state: complete
status: COMPLETE 2026-08-16. Offline and focused live checks pass. The probe
        restored the project baseline.
updated: 2026-08-16
parent: 4-control-layer.md
prev: 4a-review-follow-up.md
next: 5-proving.md
evidence: E14 row E, E2, E15-D; D6, D14, D19
needs: Bitwig foregrounded, a human at the keyboard
---

# Phase 1, session 4b — navigation to a recorded clip change

> **Purpose.** Let an explicit MCP request open one clip from this session's
> recorded changes in Bitwig's own editor.

## Scope

1. Add one narrow production MCP tool for recorded clip navigation. Do not expose
   the generic E14 probe handler as a product tool.
2. Accept a change id from `list_changes`. When the change has several navigable
   clip targets, require an explicit target. Do not choose one by order or
   proximity.
3. Return the available clip targets when the request is ambiguous. Return a
   factual unsupported result when the change has no clip target.
4. Resolve the durable track identity at invocation time. Validate the current
   launcher address before any UI call. Do not trust a recorded track index.
5. Use `ClipLauncherSlot.showInEditor()`, request Bitwig's edit layout, and call
   `Application.zoomToFit()`.
6. Treat navigation as UI focus, not a project change. Do not record it in the
   stash, observation record, or branch-event totals.
7. Keep navigation explicit. Do not navigate after a write, on pane open, or from
   a background loop.

## Decisions this slice must make

- **Tool name and target input.** Prefer a name that states the supported object,
  such as `show_changed_clip`. Use the same durable address vocabulary returned
  by change reporting.
- **Missing-content result.** A clip can move or disappear after the recorded
  change. Report the current mismatch and stop. Do not navigate to a different
  occupant with a healthy status.
- **Tool annotation.** Describe the UI-focus effect accurately. Do not imply that
  opening an editor mutates project content.

## Exit criteria

1. A request for one valid recorded clip opens that clip in Bitwig's detail
   editor and fits its content.
2. A multi-clip change returns candidates until the caller selects one. It never
   chooses silently.
3. Track-only, device-only, missing, moved, stale-generation, and unknown-change
   cases return honest results and do not navigate elsewhere.
4. The production adapter resolves durable identity before sending the narrow
   wire request. No product path accepts a raw track index.
5. Navigation creates no stash entry, observation event, revision bump, timer,
   poll, or automatic callback.
6. Brain typecheck and tests, extension tests, context check, and
   `git diff --check` pass. A focused live check confirms the editor target,
   layout, zoom, ambiguity response, and missing-target refusal.

## Out of scope

- navigation buttons in the controller pane;
- automatic navigation;
- track, device, arrangement, or diff navigation;
- reversal, deletion, or other project mutation;
- a web view or custom renderer.

## Implementation record

`show_changed_clip` accepts a recorded change id and an optional durable clip
target. It returns candidates for ambiguous changes. It refuses unsupported,
missing, moved, stale, and unknown targets without opening another clip.

The surface closes verification with one state mark. The adapter resolves the
durable track id at invocation time and requires its new mark to match the
verified mark. The narrow `navigation.showChangedClip` handler rechecks the
revision, generation, project, scene epoch, content epoch, track id, row bounds,
and clip occupancy before the first UI call. It requests the Edit layout, opens
the launcher clip, and calls zoom-to-fit. The path changes UI focus only. It adds
no project revision, stash entry, observation event, status update, timer, poll,
or automatic callback.

Verification passed: brain typecheck and **523/523** tests; extension Gradle
test; context check; `git diff --check`; live handshake **134 /
`c2aa57be11e1f47e`**. The focused live probe confirmed target selection,
ambiguity, Edit layout, fitted content, missing-target refusal, exact record
preservation, and complete cleanup. Review follow-up tests confirm that a project
switch or occupied-slot replacement during the final navigation gap refuses.

Retrospective: request the layout before editor focus. A same-turn layout change
after focus can make zoom-to-fit act before the detail editor is ready. Carry the
approved state mark through a narrow handler. Do not create a new authority mark
after validation.
