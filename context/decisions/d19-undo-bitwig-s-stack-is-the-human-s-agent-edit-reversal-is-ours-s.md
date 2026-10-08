---
id: D19
kind: decision
state: active
updated: 2026-10-01
source: DECISIONS.md
---

# D19 — Undo: Bitwig's stack is the human's; agent-edit reversal is ours **[SETTLED 2026-08-06; separated out 2026-08-07]**

**The agent's edits are not expected to be reversible through Bitwig's undo, and
nothing is designed as if they were. Agent-edit reversal is our job — best-effort,
from the changesets, and it must SAY best-effort through D8/D16's existing
fidelity labels.** Split out of D18 at the operator's request, because this is
expected to mutate as the model refines.

- **The cost accepted, with numbers**: one structural API call = one undo step
  (`e18f`), so Cmd-Z travels ≈1 (clip duplicate), 3 (fork + rename + group) or
  **7** (layer rebuild — with both containers live in 6 of 7 intermediate states)
  depending on a mechanism choice the human did not make. The operator's reframe,
  verbatim: *"undoing within Bitwig will mostly be a gesture for human edits; the
  operator is not likely to be very surprised that undo history is filled with
  several opaque entries for an agent edit. We will still be able to execute a
  best-effort agent-assisted undo of its own edits with the changesets in the
  chat log."*
- **Reversal is DIRECTED** — the human asks for it — and rides the ordinary
  (non-destructive) write surface, **structurally bounded to the session's own
  changesets**. Reversal that would destroy anything the agent did not itself
  mint-and-last-write is **withheld and reported** through the fidelity
  machinery, never silently escalated to destruction. Clean reverts are NOT
  reaping (the D20 boundary), and need no approval beyond the instruction that
  directed them.
  A request through chat satisfies this direction. A separate physical button
  does not add a structural bound and is not required.
- ⚠ **This makes the STASH load-bearing a third way** — after D16's unbranched
  writes and the clip content fingerprint. It survives the take store's
  retirement (D17 rev) and must not be deleted with it.
- What a reversal cannot restore is governed by the labels as they already exist:
  `gain` restored through its measured inverse (D16b), `pressure` stripped and
  named (D16c), and `none` fidelity reported loudly (D16d). These rules are
  reused, never reinvented.

---

## Phase 8f3 effect ownership amendment — 2026-10-01

Read-only operations and ephemeral navigation, launch, or transport actions
have no Ghostnote reversal record. External computer-use actions also have no
Ghostnote ownership. Reacquire structured state after a UI change before the
next semantic write. A later durable owned edit starts from that new base.

Durable bounded effects retain their change IDs, actual observed effects, and
D8/D16 reversal evidence. A failed readback or partial write cannot erase this
record. 8h result migration and 8i hybrid trials must verify these boundaries
under the [risk policy](../contracts/GHOSTNOTE_MIGRATION_AND_VERIFICATION.md).

## 8h implemented surface — 2026-10-08 (8h4g closeout, E247)

Every durable write of `agent-native-v1` returns its change IDs in
`effects`, with `next.revert` for `revert_change`. `check_revert` reads what
a reversal would restore without a write. `launch_clip` and
`show_launcher_clip_in_detail_editor` have no change record. A failed or
partial write reports each recorded change in `failure.effects`.

8h4g removed the background route of `agent-native-v1` (D39 amendment):
`edit_launcher_clip` and `add_launcher_clip` return their effects in the
direct result, so there is no operation handle to inspect for them.
