---
id: D20
kind: decision
state: active
source: DECISIONS.md
---

# D20 — Destruction: zero initiative, directed execution behind an annotated seam **[SETTLED 2026-08-07]**

**Privileges attach to DECISIONS, not to executions. The agent never *decides* to
destroy; it may *execute* destruction the operator explicitly directed. Axis C is
pinned at zero initiative, not zero capability.**

The letter of *"the agent may never reap"* (D17g, §4.16, rule 8) said never; the
spirit was always never *uninvited* — E18-VERDICT §3f: pruning is a user-visible
act, and the chain-delete ○ *"binds the agent, not the human."* This entry amends
the letter to match, at the operator's direction (2026-08-07). Unsolicited
destruction stays at absolute zero — and making zero-initiative *structural* is
precisely what lets directed destruction be allowed without re-litigating trust
every time.

- **The seam: destructive verbs live on a SEPARATE MCP tool surface, annotated**
  (`destructiveHint`; read tools carry `readOnlyHint`), so the **host's
  permission flow is the stop-and-ask**. Tool names and descriptions are chosen
  to suggest the capability class naturally (revised D18e's naming rule applies).
  *"Always allow"* is the operator's prerogative and accepted — they may have
  good reasons (e.g. directed cleanup of a large cluttered project). Amends D12:
  the adapter contract keeps one `Op` union; only the MCP tool surface partitions.
- ⚠ **The boundary is host-mediated: nothing INSIDE our system gates a directed
  destructive call.** Threat model is the confused agent, not a malicious client —
  consistent with D12's socket posture. ~~⚠ **Annotation handling is currently a
  SPEC READING, not a measurement**~~ — ⚠⚠ **MEASURED 2026-08-09, and the reading
  was wrong. See the revision below.**

> ### ⚠⚠ REVISED 2026-08-09 (E20c) — the seam stands, the STATED REASON does not
>
> **Settled by the operator, 2026-08-09.** The mechanism is unchanged; the sentence
> justifying it is replaced, because the thing it named turned out to be
> decorative.
>
> **Measured** (`FINDINGS.md` E20c, `probe:e20c` ARM A 7/7 + ARM B in a live
> Claude Code session): we emit `destructiveHint` / `readOnlyHint` /
> `idempotentHint` correctly — asserted field by field at an MCP client — and
> ⚠⚠ **Claude Code prompts IDENTICALLY for all four tools**, annotated or not,
> including an unannotated baseline. There is no visible indication that the
> annotations are read at all.
>
> ⚠ **But the grain it DOES gate on is the tool NAME**, per project — the prompt
> offers *"Yes, and don't ask again for **this tool** in this project."* That is
> exactly what the seam is built out of, so nothing about the design changes:
>
> - **The gate is the tool NAME**, not the annotation. Destructive verbs live on
>   separately-named tools; that is what the host's allow-list keys on, and it is
>   why the partition is load-bearing rather than cosmetic.
> - ⚠⚠ **Consequence, stated so it is not discovered later: *"don't ask again for
>   this tool"* is a PER-NAME BLANKET GRANT.** D20 already accepts *"always
>   allow"* as the operator's prerogative — this is what that looks like in
>   practice. ⇒ **A destructive verb must never share a tool name with a benign
>   one, and must never be widened to cover a benign case later.** Tool-surface
>   granularity IS permission granularity.
> - **Annotations stay on, and nothing relies on them** (operator's direction):
>   they are correct, they cost nothing, and a host that starts honouring them
>   makes the seam sharper rather than different. ⚠ They are **future-proofing,
>   not a mechanism** — no design may assume a host reads them.
> - ⚠ Measured against **Claude Code only** (the operator's target host, chosen
>   while planning session 3b). Other hosts are **unmeasured**, not assumed
>   equivalent — and under the rule above it does not matter much, since the name
>   grain is what carries the weight.
- ⚠ **Rejected: a document-state arming toggle** (API-enforced human-only —
  Bitwig refuses `Signal.fire()`, E14-A1 — checked extension-side as a
  conditional `WIRE_METHODS_BANNED`). Proposed as the hard gate; dismissed by the
  operator as too awkward. Recorded so a future reopening inherits the design
  rather than rediscovering it.
- **The revert/reap boundary**: reversal of the session's own changesets is not
  destruction (D19). v1 line: **own changesets ungated; destruction of anything
  else rides the destructive surface.** A fingerprint refinement is available if
  the simple line chafes: ungated iff current content matches what our changeset
  last wrote.
- **Merges come apart three ways**, and only one moves:
  1. *Store-level merge* — dead with the store (D17 rev); the old tripwire's
     object is gone.
  2. *Project-level consolidation* — collapse-to-winner, reduce, mechanism
     conversion (chain→top then fork, `e18c`) — becomes **directed + annotated
     surface**, with a save-the-project-first suggestion in the warning (a
     collapse is 7 undo steps, `e18f`) and the conversion asymmetry stated:
     layer→track exists; **clip→layer is impossible outright** (a chain carries
     no clips).
  3. *State-level merge* — time/pitch-sliced revert — **stays REFUSED,
     mechanically** (E8-E: same-pitch truncation outside the write's extent).
     ⚠ **Authorization changes "may we", never "how" — mechanical walls do not
     move for permission.**
- **Execution discipline is authorization-independent**: enumerate the cascade by
  identity before any delete (§4.16 — a group delete takes the winner with it
  whether or not it was ordered); **name the survivor, never count it** (rule 13);
  bound the delta; verify by readback. A directed delete on a name-addressed
  chain (`e18b`: ids minted by the project loader) can still hit the wrong take —
  only discipline prevents that, and no instruction relaxes it.
- **Untouched**: the revert *decision* stays human, and the document-state button
  stays API-enforced (E14-A1) — Bitwig enforces that, not us.

---

## Consolidation status

**D6–D15 discharge the SPIKE_PLAN §5 debt** — addressing (D6), scaffold sizes
(D7), checkpoint fidelity (D8), grid/units (D9), batch mechanics (D10), toolchain
(D11), transport and frame (D12), escape hatch (D13) — plus the two the plan did
not anticipate: the human control layer (D14, PHASE-0 exit criterion 3) and the
verification discipline that the E15 arc produced (D15).

`PROJECT_PLAN.md` §4 "Standing rules" was the working summary until these existed
and is now a pointer at them.

**D18–D20 (2026-08-06/07) discharge the E16-REPLAN §5 debt**: the branching model
(D18), undo (D19), destruction (D20), and the revision banners on D4, D6, D12,
D13, D14, D16 and D17 that land the stateless re-plan. Standing rules 5, 6, 7 and
8 were restated in `PROJECT_PLAN.md` §4 the same day; rule 7 is struck with a
tombstone rather than renumbered, so the spike record's cross-references stay
valid.
