---
title: Phase 1, session 4 — Bitwig status and change navigation
kind: plan
state: complete
status: COMPLETE 2026-08-16. Status and explicit clip navigation pass offline
        and focused live checks. There is no pane action button or polling loop.
updated: 2026-08-16
parent: README.md
prev: 3g-e-reporting.md
next: 5-proving.md
evidence: E8-C, E14 rows A–I, E14-A1, E20d; D14, D18–D20
needs: Bitwig foregrounded, a human at the keyboard
---

# Phase 1, session 4 — Bitwig status and change navigation

> **Purpose.** Replace the UI probe with a small product feedback surface, then
> add explicit navigation from a recorded change to Bitwig's clip editor.

## Design cut

The MCP server does not poll the extension. A document-state action button would
need polling or push only to carry its click into the TypeScript process. It adds
no reversal bound: `revert_change` already uses the session stash and current
readback, and its description requires a human request.

Navigation also needs no event channel. The user asks through chat, and the MCP
server sends one request to the extension. Status flows in the same direction
after a completed change. The extension repairs a user edit to the status field
locally.

The pane therefore has no Revert button, take chooser, or navigation button.
Managed layer and clip A/B continue to use Bitwig-native controls. An ordinary
copied track continues to use normal track controls without managed-take
semantics.

Automatic progress notifications are not part of this session. The `notify`
operation is implemented and live-proven, but no Phase 1 exit criterion needs an
automatic notification policy. Reconsider it only when measured batch duration
justifies it.

## Execution order

1. [4a — status surface](4a-status-surface.md): reduce the pane, publish truthful
   last-change status, and preserve the hidden observation record.
2. [4b — change navigation](4b-change-navigation.md): add an explicit MCP path
   from a recorded clip change to Bitwig's editor.

## Combined exit criteria

1. The pane contains the product status surface and no obsolete action, take, or
   probe controls.
2. Status identifies ordinary track copies, managed device alternates, and
   managed clip alternates accurately. A user edit is repaired without an MCP
   poll.
3. An explicit MCP request opens one recorded changed clip in Bitwig and fits it
   in the editor. Missing, unsupported, and ambiguous targets return an honest
   result without navigation.
4. The observation field remains absent from the pane, and the pane stays
   responsive with a realistically large stored value.
5. No timer, long poll, or extension-to-server event path is added. The MCP
   connection remains lazy.
6. Offline and focused live checks pass. The live exit-criteria sweep remains
   session 5.

## Out of scope

- a pane-directed reversal path;
- any track-group or grouped-fork control;
- a ghostnote take chooser;
- automatic or unsolicited navigation;
- navigation to tracks, devices, arrangement content, or a rendered diff;
- automatic progress-notification policy;
- a daemon, persistent custom window, or push protocol;
- agent-initiated destruction. Directed destructive tools remain under D20.
