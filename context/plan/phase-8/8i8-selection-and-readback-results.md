---
title: Phase 8i8 selection effects and unavailable readback
kind: plan
state: planned
status: Report a failed verification read as unavailable, and keep or report the selection effects of clip and track writes. From E250 and E251.
updated: 2026-10-09
parent: README.md
prev: 8i7-track-mixer.md
next: 8i-agent-native-hybrid-dogfood.md
evidence: E250, E251; D43
---

# Phase 8i8 selection effects and unavailable readback

Close three result defects that E250 and E251 found live. Each one makes a
result state less than, or other than, what happened.

## Evidence and scope

1. A write tool other than `add_launcher_clip` whose verification read
   throws reports readback `differs`, not `unavailable` (E250). The
   executor keeps the receipt (`verifyOrUnread`, `engine/executor.ts`) and
   marks each address unverified with a reason text. The surface maps every
   unverified address to `differs`. Most result contracts have no
   `unavailable` status. `edit_launcher_clip` already reports
   `unavailable` with warning `readback-unavailable`.
2. `add_launcher_clip` leaves the slot selection on the new clip (E250).
   `createNewLauncherClip` makes Bitwig select the clip, and the creation
   records no selection borrow. D43: only the operator changes the
   selection.
3. Bitwig moves the mixer selection on a track delete, also for a track
   with no owned cursor (E251, host behaviour). `add_tracks` moves it to
   the new track. `delete_track` and `add_tracks` report no selection effect.

## Entry reads

- E250, E251, D43, and the [performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md).
- `engine/executor.ts` (`verifyOrUnread`, the take and its `unverified`
  list), `surface/agent-native-result.ts`, and the readback mapping of each
  write tool in `agent-native-clips.ts`, `agent-native-devices.ts`,
  `agent-native-retained.ts`, and `agent-native-edit.ts`.
- The selection lease and borrow in `surface/workspace.ts` and the
  extension `selection.status` and `slot.select` handlers.
- `call-budget.test.ts`, the live adapter frame test, and
  `description-cohort.ts`.

## Work

1. Give an unverified address a structured cause. A failed verification
   read has its own cause; the surface does not parse the reason text. Map
   that cause to readback status `unavailable` and warning
   `readback-unavailable` in the shared result module, as the edit limb
   does. Keep `differs` for a read that completed with other values. Add
   `unavailable` to each write tool's `readbackStatus`. Test each write tool
   with a fake verification read that throws.
2. `add_launcher_clip`: restore the slot selection that the person had
   before the creation, with the existing selection lease. If the host
   cannot restore it exactly (for example, no slot was selected), report
   the effect as a warning. Measure the added turns.
3. `delete_track` and `add_tracks`: check whether the mixer selection can be
   restored after the host moves it. If it can, restore it within the
   existing lease rules. If it cannot, report a warning that names the
   moved selection. Do not change the selection of an unrelated operator
   action.
4. Update the descriptions and result contracts that change, bump
   `TOOL_DESCRIPTION_VERSION`, and keep `stable-v1` frozen. If 8i7 ran
   first and its description items are still open, include them here.

## Cost model

Item 1 adds no host call. Items 2 and 3 add at most one selection read and
one restore turn each (about 48 ms). State the added turns in the ledger and
the call-budget tests. A restore that needs more turns needs a reason.

## Acceptance criteria

- A thrown verification read reports `unavailable` on every write tool, and
  the change ID stays in `effects`. A completed read with other values still
  reports `differs`. Tests cover both for each tool.
- After `add_launcher_clip`, the slot selection is the person's selection,
  or the result states the change. Live check in an owned project.
- After `delete_track` and `add_tracks`, the mixer selection is restored, or
  the result states the move. Live check, with the E251 control arm.
- Call budgets and the ledger state each added turn. Live reruns of the
  changed paths are within 20 percent, or explained.
- `npm run check`, `LANG=en_US.UTF-8 ruby context/check.rb`, and
  `git diff --check` pass. Add the E record and index row; update the
  charter and NOW. Stage only session changes; do not commit.

## Out of scope

New selection features, the mixer tools (8i7), and selection changes made
by the operator.
