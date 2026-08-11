---
id: D19
kind: decision
state: active
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
- ⚠ **This makes the STASH load-bearing a third way** — after D16's unbranched
  writes and the clip content fingerprint. It survives the take store's
  retirement (D17 rev) and must not be deleted with it.
- What a reversal cannot restore is governed by the labels as they already exist:
  `gain` withheld (D16b), `pressure` stripped and named (D16c), `none`-fidelity
  reported loudly (D16d) — reused, never reinvented.

---
