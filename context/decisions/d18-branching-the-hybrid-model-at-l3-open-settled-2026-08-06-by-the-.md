---
id: D18
kind: decision
state: active
source: DECISIONS.md
---

# D18 — Branching: the hybrid model at L3-open **[SETTLED 2026-08-06 by the operator; recorded 2026-08-07]**

**All three branch mechanisms exist — track fork, layer chain, clip block — and
the agent chooses between them freely. What the agent experiences is L4:
open-ended tool descriptions, no dispatch rule anywhere on its surface. What the
record captures is L3: every branch event stores a deterministic rule's verdict —
computed silently, used for nothing — beside the agent's actual choice and the
human's response. Only reporting is imposed.**

Closes the E16→E18 branching arc. The argument is
`spike/HYBRID-AUTONOMY-LEVELS.md` (the ladder, and why L3-open beats both the L1
recommendation it replaced and plain L4); the measured substance is
`spike/E18-VERDICT.md` §1. The operator's framing, verbatim:

> *"I don't want the inherent prescriptiveness of L0/L1 to bleed up; I
> specifically want to see how agents work with more autonomy and iterate on tool
> descriptions in that world, with the deterministic branching as a useful
> measurement control. This holds for all measurements in general; only reporting
> is imposed, no automatic mechanism-level branching or prescriptiveness."*

### a. The hybrid — all three mechanisms are built

Track fork: ● proven (E16k, C5, E16u, E16r). Layer chain: ◐ most of the wire
exists (`e18a`/`e18c`/`e18e`/`e18g`/`e18h`). Clip block: ⚠ **the gap** —
`launchWithOptions(quantization, launchMode)` and
`ClipLauncherSlot.duplicateClip()` are unprobed and not on the wire; **the one
early build item** (Phase 1). The track-vs-layer question closed by dissolving:
layers were committed regardless (`e18a` — the Master and FX returns are
reachable no other way), and the clip block is the only beat-aligned A/B in the
design (E16m's complaint; E18-VERDICT §4c). ⚠ Three owed measurements were
dispositioned by operator judgement with named retirement conditions
(E18-VERDICT §7a: dormant-chain CPU, container PDC/transparency, launch
quantisation) — that dependency stays visible, not buried.

### b. L3-open — what the agent sees, what the record keeps

The agent is never shown a default, a dispatch table, or anything to "depart
from"; it chooses on the merits as it understands them. Hiding the rule removes
the anchoring bias that made plain L3 a poor instrument (HYBRID §1c); the matched
pair — silent verdict beside live choice, neither informing the other — is what
makes autonomy *measurable* rather than merely granted. L4 alone has no tell;
L3-open takes L4's freedom and keeps one. Agent judgement is **perishable** (the
conversation and the human's stated intent are not in the changeset); the rule's
verdict is free, retroactive and permanent — so real sessions are spent on the
perishable signal (HYBRID §1a/§1b).

### c. ⚠ The firewall is scoped to CHOICE-MAPPING, not to prescription

> **Tool descriptions carry complete mechanical knowledge — capabilities, costs,
> traps, and correct procedures, as prescriptive as correctness requires — and
> ZERO choice-mapping: nothing that maps the shape of a change onto a mechanism.
> Facts and procedures, never pre-drawn conclusions.**

⚠ Replaces a first draft's blanket *"guidance, never prescription"* (operator,
2026-08-07): correctness recipes — group-then-duplicate, append-only scenes,
rename-on-fork — are *required* knowledge, and deficient knowledge is a
**confound** in the judgment measurement, not a purer form of it. We measure
judgment, not ignorance. Facts that let an agent *derive* the rule are fine — a
derived conclusion is a finding (§5c row 1 of HYBRID: high agreement means the
rule captures what good judgement does); a pre-drawn one is compliance.

- **Preconditions are DOCUMENTED** (the bank-window budget, the fidelity floor),
  so refusals are predictable. Refusal text is fully informative — even
  procedurally directive — *within* the attempted mechanism, and **never
  redirects across mechanisms** ("fork won't fit — use a layer" is the leak
  arriving through an error message). Unpredictable refusals also pollute the
  instrument: wall-bump mechanism switches are not judgment.
- ⚠ **The floor is RESTATED** (E16-OPEN-QUESTIONS §3.3.5): predicate unchanged
  (*fidelity worse than `exact`*), response changed — a **loud
  refusal-unless-branch-protected, never an automatic fork**. Same for the
  damage-precedes-the-stash member (§3.3.6): unconditional refusal unless
  branch-protected, before reading anything. An automatic fork is automatic
  mechanism-level branching, which the operator's framing forbids outright.
- **No prescriptive fallback in behaviour**: if the agent does not choose, the
  system reports and stops.
- **The deterministic dispatch rule** (E18-VERDICT §6, repurposed:
  split-by-object-type with the track fork as escape hatch) **lives in the
  executor and never reaches the agent surface in any form** — not a tool
  description, a parameter name, an error message, or a receipt. A leak
  contaminates every event logged after it, irrecoverably (HYBRID §4). This is
  the one one-way door: guidance can always be *added* on evidence — that is
  L3-open degrading gracefully toward L3/L1 — but choice-mapping can never be
  cleanly *removed*.
- ⚠ **Fresh surface language** (operator, 2026-08-07): tool names and
  descriptions are written from scratch for a general-purpose agent — **none of
  the spike's internal jargon** (fork/reap/lineage/stash/floor as terms of art)
  crosses the surface. Each domain concept gets self-explanatory naming; names
  should naturally suggest capabilities and seams while leaving room for
  judgment. Internal docs keep their vocabulary; the surface earns its own.

### d. The record, and versioned tool descriptions

One row per branch event:

| field | notes |
|---|---|
| the **raw write-set** | the INPUT, never a classification — any future rule, including ones not yet invented, replays against it (HYBRID §1a) |
| the rule's **silent verdict** | computed in the executor, used for nothing |
| the **agent's choice** | fork / chain / block |
| *agreed?* | derived, never stored |
| the agent's **own rationale** | not a justification of a deviation — it never saw a default |
| the **human's response** | accepted / vetoed / **silent** — silent must be distinguishable from accepted |
| the **resulting structure** | by identity |
| ⚠ the **tool-description version** | see below |

> ### ⚠⚠ REVISED 2026-08-09 (E20d) — the record lives in `getDocumentState()`, **HIDDEN AT `init()`**
>
> **Settled by the operator, 2026-08-09.** D18d put the record in
> `getDocumentState()` and the open question was *how much JSON fits*. ⚠⚠ **That
> was the wrong question.** Measured (`FINDINGS.md` E20d):
>
> - ● **Capacity is a non-issue.** 262144 chars round-trip the wire exactly (flat
>   at 16–34 ms), store in the setting exactly at ⅛/½/full declared size, and
>   **survive a save plus a full application restart byte for byte**. Init costs
>   16.7 ms at that size.
> - ⚠⚠ **The value is DRAWN, and drawing it is fatal.** With 262144 chars in the
>   field, interacting with it **hard-locked Bitwig** — the pane hung with a busy
>   cursor, drew over other windows, and the process had to be force-quit. The
>   operator reported the field lagging from **1024** chars up, so the degradation
>   is continuous and the lock is the top of the same curve. Same severity class as
>   E14-A1, reached by a different route; nothing extension-side contains either.
>
> ⇒ **The record stays in `getDocumentState()` and the setting is HIDDEN AT
> `init()`.** `Setting.hide()` is reachable through E14 row C1's undocumented
> downcast — ● measured again here (`E20d-H1/H2`: the cast works, `hide()` is
> accepted) — and ● **a hidden setting still holds its value byte for byte**
> (`E20d-H3` at the full 262144).
>
> ⚠⚠ **AT `init()`, not at runtime, and the distinction is the whole decision.**
> `hide()` is a runtime call and `init()` re-creates the setting **visible**, so a
> runtime hide re-arms the hazard on every restart. The hide therefore belongs in
> `UiPanel`'s constructor beside the creation, where rule 13 already puts
> everything else.
>
> **What this buys, and it is why the document setting survived the finding**: the
> record stays **per-project** and **survives a restart** (E14-A3/A4) — the two
> properties that made `getDocumentState()` the right home — while never being
> rendered.
>
> ⚠ **OWED, not done** (and it is small): the init-time hide is **not built**, and
> the two human observations the hidden arm asks for — *is the row gone from the
> pane, and is the pane responsive* — were **not reported back**, so "hidden means
> safe" is currently inferred from the value surviving rather than confirmed by
> looking. ⚠ Confirm both before anything writes a large record. `RigConfig`'s
> default stays `0`, which is a safety default and is documented as one.
>
> ⚠⚠ **DONE, same day.** `UiPanel`'s constructor now hides the setting where it
> creates it, so `init()` never re-arms the hazard on a restart. Both human
> observations owed above are now in: confirmed by eye, after a hand reload with
> `recordChars=262144`, that the "Branch record" row is absent from the panel and
> that the pane stays responsive; `probe:e20d-hidden`'s H1/H2/H3 all PASS against
> the init-time hide (full 262144 chars, 19 ms settle — `FINDINGS.md` E20d). ⚠ One
> addition beyond what this decision specified: if the `Setting` downcast itself
> is unavailable, the setting is now refused rather than created and left
> unhideable — checked against `statusText` (already created) before
> `getStringSetting` is ever called for the record, since a setting once created
> cannot be un-created through this API.
>
> ⚠ **Rejected: a pointer or rolling window** with the log living elsewhere, and
> **rejected: dropping the document setting as the record's home.** Both were live
> options while capacity looked like the constraint; neither is needed once the
> value can exist unrendered, and both would have cost the per-project persistence
> that is the actual reason the record is there.

⚠ **Tool descriptions are a first-class versioned artifact**: freeze a version,
gather events under it, then edit — an edit mid-cohort splits the cohort and
neither half is interpretable alone (HYBRID §5b). v1 ships the mechanics,
trade-offs and correctness recipes **lean** — no worked examples, no heuristics,
no "typically/recommended" language — and every addition is a deliberate,
versioned response to an observed failure (§5c: vetoed choices → tighten
descriptions first, the rule only if that fails).

Two confounds stated, not buried (HYBRID §5d): a falling veto rate is equally
consistent with the human having stopped reading — report veto rate and
choice-diversity together, and treat "departs more, vetoed less" as suspicious;
and the replayed rule is never *"what would have happened under L1"*, because the
agent's choices shape later write-sets.

### e. Axes B and C do not move

This decision governs **mechanism choice only**. **B (whether to branch) stays
low** — *"deliberate and coarse"* (E16-TRACK-NATIVE answer 2); most batches are
never branched and the stash is the common path. **C (destruction) is pinned at
zero INITIATIVE** — see **D20**, which is where the operator's 2026-08-07
refinement of "never reap" lives.

---
