---
title: Phase 1, session 4 — the in-Bitwig control layer
kind: plan
state: active
status: READY 2026-08-16. Session 3g-e closed observation reporting and the v1
        description program offline and live. The panel owns deliberate human
        verbs and status; managed A/B remains in Bitwig's layer-solo and
        clip-launch surfaces.
updated: 2026-08-16
parent: README.md
prev: 3g-e-reporting.md
next: 5-proving.md
evidence: E8-C, E14 rows A–I, E14-A1, E20d; D14, D18–D20
needs: Bitwig foregrounded, a human at the keyboard
---

# Phase 1, session 4 — the in-Bitwig control layer

> **Purpose.** Make deliberate human safety and status operations reachable from
> Bitwig. This session does not build a take switcher: managed layer and clip A/B
> already use Bitwig-native controls, and copied tracks use ordinary track
> controls without take semantics.

## Scope

1. Turn `UiPanel.java` from probe apparatus into the smallest product panel:
   directed reversal, last-change/status, and navigation to what changed.
2. Keep every setting created at `init()`; Bitwig refuses late creation.
3. Preserve the API-enforced human boundary around document-state signal buttons.
   `ui.signalFire` remains forbidden because it can crash Bitwig.
4. Poll the extension from the MCP server for rare button events. There is no
   daemon; optional session 6 may later replace polling with push.
5. Keep the hidden branch-observation setting hidden at creation. E20d proved that
   rendering a large value can lock the DAW.
6. Use `ClipLauncherSlot.showInEditor()` plus `Application.zoomToFit()` for clip
   navigation, and provide truthful status when a change has no visual target.
7. Interleave progress notifications into paced writes without widening mutation
   authority.

Out of scope:

- any track-group or grouped-fork control;
- a ghostnote take chooser;
- runtime authoring/provisioning of layer assets;
- a daemon or persistent custom window;
- agent-initiated destruction. Directed destructive tools remain under D20.

## Exit criteria

1. A human can invoke the supported deliberate operation from the controller pane,
   and the MCP server observes it without exposing an equivalent agent-callable
   privilege.
2. Status is repaired after user edits and identifies ordinary track copies versus
   managed layer/clip alternates accurately.
3. Clip navigation opens the changed clip in Bitwig; unsupported navigation fails
   honestly.
4. The observation field remains absent from the pane and the pane stays
   responsive with a realistically large stored value.
5. Offline and live checks pass; no obsolete take chooser or probe scaffolding is
   presented as product UI.
