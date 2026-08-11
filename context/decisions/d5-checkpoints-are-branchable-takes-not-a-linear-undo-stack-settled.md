---
id: D5
kind: decision
state: active
source: DECISIONS.md
---

# D5 — Checkpoints are branchable takes, not a linear undo stack **[SETTLED 2026-07-24]**

**A batch creates a named, addressable *take* that can be compared, jumped between and
partially reverted. Reverting to an earlier take and proceeding does not destroy the
branch left behind.**

The reasoning is musical, not technical. Cursor's loop is *preview → accept → apply*,
and once you accept, the old version is worthless. Music inverts both halves:

1. **You evaluate by listening, so application must precede judgment.** Given "Bitwig
   is the only sound surface" (§2), optimistic apply is not a compromise tolerated for
   ergonomics — it is the only preview mechanism that exists. The UI's job is not to
   help you decide *before*; it is to make comparing and undoing trivial *after*.
2. **The previous version is not disposable.** "That take had a better hi-hat" is the
   normal case. A/B comparison is the core verb; accept/reject is the wrong primitive.

Consequences for the store (built in Phase 1):
- Take content is the §8b stash — the prior state of exactly the addresses written —
  which is also the "before" side of the Phase-3 diff. **One mechanism, two features**
  (§8f).
- **Partial revert is sliced by musical address** ("keep the hats, revert the snare").
  The write-set is already addressed, so this is nearly free.
- **Every take carries a fidelity label** — exact for notes and scalar params, low for
  structural create/delete and anything without readback — so a revert never silently
  under-delivers.
- **A take stores what readback reported, never what was requested** (E8: consecutive
  same-pitch notes truncate each other, so a written duration may not survive).
- **Human-owned.** The agent may read and explain the log; it may never mutate it.

---
