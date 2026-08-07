---
title: The hybrid branching model — agent autonomy, and the decision to run at L3-open
status: ⚠⚠ DECIDED BY THE OPERATOR 2026-08-06. This document records a CHOSEN
        design, not an open question. §0 states it; §1–§3 are the record of how
        the argument got there and should not be re-litigated.
        ⚠ NOTHING HAS BEEN WRITTEN TO `DECISIONS.md` — rule 10 and
        `E16-REPLAN.md` §5 both say those entries are the USER'S to author.
        §7 is shaped so lifting it is mechanical.
        ⚠ READ THIS COLD BEFORE THE RE-PLAN. §7 is what the next session
        inherits; §8 is what is still owed and none of it blocks starting.
updated: 2026-08-06
parent: E18-VERDICT.md §5
supersedes: E18-VERDICT.md §5's A/B/C framing (they were points on one ladder)
evidence: E18-VERDICT §1 · FINDINGS e18b, e18c, e18f, e18h, e18a, E16k K3,
        E16l, E16m, E16r, E16s, E16u · C3, C5, G1/D1 · D6, D10, D15, D16, D17g ·
        E16-TRACK-NATIVE answer 2, §4.16 · standing rules 5, 8, 10
---

# Agent autonomy over the branching mechanism

## 0. ⚠⚠ THE DECISION

**A hybrid is assumed. All three mechanisms exist — track fork, layer chain, clip
block — and the agent chooses between them.** The operator settled this and it is
not re-opened here.

> ⚠⚠ **THE CHOSEN LEVEL: "L3-open".**
>
> **What the agent experiences is L4.** All three mechanisms are available. ⚠ **Tool
> descriptions are OPEN-ENDED — guidance, never prescription.** No dispatch rule is
> shown to the agent, no default is presented, nothing is "departed from". The agent
> chooses on the merits as it understands them.
>
> **What the record captures is L3.** Every branch event stores the deterministic
> rule's verdict — **computed silently, used for nothing** — beside the agent's
> actual choice and the human's response.
>
> ⚠ **Only REPORTING is imposed.** There is **no automatic mechanism-level
> branching** and no prescriptive fallback anywhere in the system.

**The operator's framing, verbatim, because the distinction is easy to lose:**

> *"I don't want the inherent prescriptiveness of L0/L1 to bleed up; I specifically
> want to see how agents work with more autonomy and iterate on tool descriptions in
> that world, with the deterministic branching as a useful measurement control. This
> holds for all measurements in general; only reporting is imposed, no automatic
> mechanism-level branching or prescriptiveness."*

⇒ ⚠ **The deterministic rule is an INSTRUMENT, not a governor.** It lives in the
executor and must never reach the agent's tool surface. §4 makes that architectural.

---

## 1. ⚠⚠ Why this beats the L1 recommendation it replaced — including where the analyst was wrong

A first draft of this document recommended **L1** (fixed dispatch + mechanical
exceptions) and proposed measuring in *shadow mode* before building anything. ⚠ **The
operator dismantled it in two moves, and both were right.**

### 1a. ⚠ Log the write-set, not the classification

The shadow proposal said *"compute what the dispatch would have chosen and log it."*
⚠ **That throws away optionality for nothing.** The dispatch is a **pure function over
the write-set**, which D16's executor already computes before any structural call.

⇒ ⚠⚠ **Log the INPUT.** Then any rule can be replayed later — including rules not yet
invented, and two candidate dispatch tables A/B'd against each other months from now.
**The deterministic arm is free, retroactive and permanent**, which removes the only
thing L1 was buying.

### 1b. ⚠⚠ Agent judgement is PERISHABLE; the rule's verdict is not

> **Operator:** *"we can run that on changesets at anytime later […] agent judgment in
> the wild we cannot run anytime; not without cost at least, and still not
> deterministic."*

⚠ **And it is stronger than "expensive to replay" — it is IMPOSSIBLE to replay
faithfully.** The in-the-wild choice is made with the conversation, the human's stated
intent, and what they just said and why. **None of that is in the changeset.** A later
replay over a stored write-set does not have those inputs and never will.

⇒ **Capture agent judgement live or lose it permanently. The rule keeps forever.**
Given a fixed budget of real sessions, spending them on the perishable signal is
correct.

### 1c. ⚠ The operator's correction FIXES a confound the analyst had raised

⚠ Worth stating because it inverts an objection rather than merely answering it. The
draft's own critique of L3 was:

> *"L3 measures agent judgement under L3's own incentives, not under a neutral
> condition. If the agent knows it must justify a departure from a default, it will
> depart less often and justify more fluently."*

⚠⚠ **Hiding the rule from the agent removes that anchoring bias entirely.** With no
default presented, there is no "departure" to under-produce and no deviation to
rationalise — the agent simply chooses, and the rule's verdict is computed
independently afterwards. **The comparison becomes unbiased**, which the draft's
version of L3 could not have been.

⇒ ⚠ **"L3-open" is a better instrument than L3, not a looser one.**

### 1d. ⚠ And the sequencing argument evaporated on its own

The shadow proposal's selling point was *"wired to nothing, before any branching is
built, costs nothing to be wrong about."* ⚠ **The operator elected to build all three
mechanisms first** — *"just building it, then measuring, sounds like the right call"*
— so that advantage no longer exists. **Most of the case for starting low went with
it.**

---

## 2. ⚠ Two other axes, both already pinned — do not move them by accident

This document governs **mechanism choice only**. Three decisions are separable and a
design can sit at a different height on each:

| axis | question | state |
|---|---|---|
| **A. MECHANISM** | fork, chain, or block? | ⚠⚠ **L3-open — this document** |
| **B. WHETHER** | branch at all, or direct-write with a stash revert? | ⚠ **pinned LOW already** — `E16-TRACK-NATIVE` answer 2: *"deliberate and coarse"*. Most batches are never branched |
| **C. DESTRUCTION** | may the agent prune, consolidate or convert what exists? | ⚠⚠ **pinned at ZERO** — D17g / §4.16 / rule 8: *"the agent may never reap"* |

⚠⚠ **Axis C is the one that could be moved by accident, and must not be.** Raising
mechanism autonomy is not a licence to reap. Three measured reasons:

1. ⚠ **The cascade.** §4.16: deleting a group destroys its children *including the
   winner*; deleting a layer container does the same to its chains.
2. ⚠ **A layer rebuild is 7 undo steps, and 6 of its 7 intermediate states hold BOTH
   containers** (`e18f`). On the agent's schedule that is restructuring nobody asked
   for and nobody can cleanly undo.
3. ⚠ **Chain identity is a human-editable NAME** — the id is minted by the project
   loader (`e18b`). An automatic restructurer addressing takes by string, on a
   structure that regenerates its ids every session, will act on the wrong take.
   Rule 13: *name the survivor, never count it.*

---

## 3. The ladder, kept as the record of how the argument moved

⚠ Not to be re-litigated — kept because the failure modes remain the things to watch
for, and because §5's instrumentation is designed to detect exactly these.

| | rule | its deciding failure | has a tell? |
|---|---|---|---|
| **L0** fixed dispatch | pure function; ambiguity refuses | ⚠ **"both" swallows the wins** — one device tweak beside one note edit forks a whole track (C5 5/5 audible, a bank slot, 20 KB, litter) to protect a clip change a block would have held. ⚠ And *"deliberate and coarse"* predicts mixed changes are the **normal** case at branch points | ● refusal rate |
| **L1** + mechanical exceptions | closed-form conditions, no judgement | exception list is open-ended; long enough and it is judgement in a mechanical costume | ● exception count |
| **L2** human tie-break | rule proposes, human decides contested cases | ⚠ **interruption lands at the worst moment** — branch points are rare but important; and question fatigue turns consent into noise the log records as real | ⚠⚠ **●● default-acceptance rate** |
| **L3** default + justified departure | agent may depart, must justify | ⚠ **plausible-and-wrong** — a fluent, well-cited reason for a poor choice, and fluency reads as correctness. ⚠ Also anchors the agent (§1c) | ◐ veto rate |
| **L4** free choice, reported | agent picks; receipt records | ⚠⚠ **no tell at all** — the failure is invisible until the project is a mess, and every wrong choice needs individually-expensive correction | ⚠⚠ **○ NONE** |
| ⚠⚠ **L3-open** ⚠⚠ | ⚠ **agent experiences L4; record captures L3** | ⚠ inherits L4's live risks — **accepted deliberately** (§6) — and buys back L3's instrumentation *without* its anchoring | ⚠⚠ **●● the matched pair, §5** |

⚠ **The column that decides is the last one.** Autonomy is survivable in proportion to
how fast you learn it was set too high. **L3-open is the only rung that takes L4's
freedom and still has a tell.**

---

## 4. ⚠⚠ The architectural constraint that makes this real

> ⚠⚠ **The dispatch classifier lives in the executor and MUST NOT reach the agent's
> tool surface** — not in a tool description, not in a parameter name, not in an
> error message, not in a receipt the agent reads back.

⚠ **This is a correctness requirement for the measurement, not a style preference.**
The moment the rule leaks into the agent's context, §1c's unbiased comparison is gone
and cannot be recovered retroactively — every event logged after the leak is
contaminated and indistinguishable from the clean ones.

**Concretely:**

- ⚠ **Tool descriptions describe CAPABILITIES AND TRADE-OFFS, never rules.** *"A layer
  chain carries devices but never clips; switching is one exclusive flag; removing one
  costs a 7-step rebuild"* is guidance. *"Use a layer when the change is device-only"*
  is prescription and is forbidden.
- ⚠ **No prescriptive fallback anywhere.** If the agent does not choose, the system
  does not choose for it — it reports and stops. An automatic default is the same leak
  arriving through behaviour instead of text.
- ⚠ **Error and refusal text is part of the surface.** Rule 5's bank-window refusal
  must say *what is impossible* (*"a fork here would mint a track we cannot address"*),
  never *what to do instead*.

---

## 5. ⚠⚠ The measurement design

### 5a. The record — one row per branch event

⚠ **The matched pair is the point**, and it is the same shape that made `e18b`'s reload
result trustworthy: two independent verdicts on one event, neither informed by the
other.

| field | notes |
|---|---|
| **the write-set** | ⚠ **the raw input, not a classification** (§1a) — so any future rule replays against it |
| ⚠ **the rule's verdict** | computed silently, **used for nothing** |
| ⚠ **the agent's choice** | fork / chain / block |
| **agreed?** | derived, not stored |
| **the agent's stated rationale** | ⚠ its OWN reasoning for its choice — **not** a justification of a deviation, since it never saw a default |
| **the human's response** | accepted / vetoed / silent — ⚠ *silent* must be distinguishable from *accepted* |
| ⚠⚠ **the tool-description version** | see §5b |
| the resulting structure | what was actually built, by identity |

### 5b. ⚠⚠ Version the tool descriptions, or the two experiments confound each other

⚠ **This falls straight out of the operator's own plan** — *"iterate on tool
descriptions in that world"* — and it is easy to miss:

> **If tool descriptions are being iterated AND agent choices are being measured, the
> descriptions must be versioned in every record.** Otherwise a shift in agent
> behaviour cannot be attributed: it is equally explained by a description edit and by
> anything else that changed.

⇒ ⚠ **Tool-description text becomes a first-class versioned artifact**, not prose
maintained in passing. **Freeze a version, gather events under it, then edit** — an
edit mid-cohort splits the cohort and neither half is interpretable alone.

### 5c. How to read it

| rule vs agent | human response | reading |
|---|---|---|
| high agreement | — | the rule captures what good judgement does ⇒ L1 would lose little |
| ⚠ **low agreement** | choices accepted | ⚠ **the agent is adding real value the rule cannot express** — the outcome that justifies L3-open |
| low agreement | choices vetoed | the agent is wrong; tighten the *descriptions* first, the rule only if that fails |
| high agreement | vetoed anyway | ⚠ **both are wrong** — the rule encodes a misconception the agent shares |

### 5d. ⚠ Two confounds, stated rather than buried

1. ⚠ **The veto rate is not clean.** A falling veto rate reads as the agent improving
   and is equally consistent with the human having stopped reading. ⚠ **Report veto
   rate and choice-diversity together, and treat "agent departs from the rule more,
   human vetoes less" as SUSPICIOUS rather than as success.** There is no clean control
   for this; naming it is the honest move.
2. ⚠ **The deterministic arm is not a clean counterfactual** — E18 method guard 6,
   *a probe's SETUP is part of its experiment.* The agent's choices shape the project,
   so later write-sets are **downstream of agent policy**. Replaying the rule tells you
   what it would say **about real work**, which is what is needed — ⚠ but it must never
   be read as *"what would have happened under L1."*

---

## 6. ⚠ The costs accepted, and the operator's reasoning

**Undo depth becomes unpredictable** — `e18f`: one structural call = one undo step, so
Cmd-Z travels ≈1 (clip duplicate), 3 (fork + rename + group) or 7 (layer rebuild)
depending on a choice the human did not make.

⚠⚠ **ACCEPTED, with a reason that reframes rather than tolerates it:**

> **Operator:** *"I expect that undoing within Bitwig will mostly be a gesture for
> human edits; the operator is not likely to be very surprised that undo history is
> filled with several opaque entries for an agent edit. We will still be able to
> execute a best-effort agent-assisted undo of its own edits with the changesets in
> the chat log."*

⇒ ⚠ **Two design consequences the re-plan must carry, because this is not merely an
acceptance:**

1. **Bitwig's undo stack is the HUMAN's tool.** The agent's edits are not expected to
   be reversible through it, and nothing should be designed as if they were.
2. ⚠⚠ **Agent-edit reversal is OUR job, from the changesets** — which makes the
   **stash load-bearing again**, now for a third reason on top of D16's unbranched
   writes and E16-REPLAN §2's clip fingerprint. ⚠ **Best-effort, and it must SAY so**:
   D8/D16's fidelity labels are the existing machinery for that and should be reused
   rather than reinvented.

**Also accepted:** every measurement point is a real structure in the project rather
than a logged row, and correcting one is a conversion that is **asymmetric** — layer →
track is available (`e18c` ●● chain→top, then fork), **clip → layer is impossible
outright** (a chain carries no clips, ○ never).

---

## 7. ⚠⚠ WHAT THE RE-PLAN INHERITS — read this section first if context is cold

### 7a. Locked

1. **The hybrid is the model.** All three mechanisms are built. The track-vs-layer
   question is closed by being dissolved.
2. **L3-open.** Agent experiences L4; the record captures L3. §4's constraint is
   architectural.
3. **Only reporting is imposed.** No automatic mechanism-level branching, no
   prescriptive fallback, anywhere.
4. **Tool descriptions are guidance-only and versioned** (§4, §5b).
5. **Undo:** Bitwig's stack belongs to the human; agent-edit reversal is best-effort
   from changesets, labelled (§6).
6. **Axes B and C do not move** (§2).

### 7b. ⚠ What this does to `E18-VERDICT.md`

⚠ **Its §6 recommendation is not discarded — it is REPURPOSED.** §6 recommended
*split by object type, with the track fork as the escape hatch for changes that span
both*. ⇒ **That is now the deterministic control rule** (§5a's silent verdict) rather
than an enforced policy. **The analysis stands; only its job changed.**

⚠ Its §1 scoreboard remains the substance of what tool descriptions must convey —
as trade-offs, never as rules (§4).

### 7c. ⚠ Build order implied, and one gap that bites

| | state |
|---|---|
| **track fork** | ● built and proven — E16k, C5, E16u, E16r |
| **layer chain** | ◐ **most of the wire exists** — `chain.move`, `chain.inventory`, `layer.select`/`duplicateChannel`, solo, colour, container delete. ⚠ Removal is a **7-step rebuild**, and axis C says the human reaps |
| ⚠⚠ **clip block** | ⚠⚠ **THE GAP.** `slot.launch` ships, but **`launchWithOptions(quantization, launchMode)` and `ClipLauncherSlot.duplicateClip()` are UNPROBED and NOT ON THE WIRE** |

⚠⚠ **`launchWithOptions` is the highest-value unclaimed primitive in the design.**
Quantisation is a **per-call** override (`"1"` = bar, `"8"` = phrase), and
**`"continue_or_synced"` makes take B resume at take A's playback position instead of
restarting the loop** — the same bar rendered differently. ⚠ **No mute, solo or chain
switch can imitate that**, and it is the only answer to `E16m`'s recorded complaint
that the A/B is not beat-aligned. **Wire it and probe it early**; the clip half's whole
ergonomic claim runs through it and is currently a javadoc reading, not a measurement.

⚠ **Scope the auto-advance claim correctly.** Hands-off round-robin over a clip block
needs the human to arm a **Next Action that is NOT in the controller API** — five
classes enumerated in full with descriptions, and the string *"next action"* absent
from the entire javadoc tree, in docs that name these settings by their inspector
label. ⇒ **the agent owns the block's geometry** (`hasContent()` makes contiguity
checkable, `slot.moveTo` ● 163 ms restores it) **and can never verify its behaviour.**
⚠ Decide deliberately what the agent says when it builds a block it cannot arm.

### 7d. ⚠ `DECISIONS.md` is the operator's to author

⚠ Per rule 10 and `E16-REPLAN.md` §5, nothing here has been written to it. §7a is
shaped to be lifted directly. ⚠ `E16-REPLAN.md` §5 also still lists **D4, D13, D14 and
D17's sub-decisions** as owed revisions, and this decision does not touch them.

---

## 8. ⚠ Still owed — none of it blocks starting

- ⚠ **`launchWithOptions` and `duplicateClip`** — unprobed, not on the wire (§7c).
  **The one item that should be early rather than eventual.**
- ⚠ **The block-delimiting premise** — that contiguous clips bounded by empty slots
  are what a Next Action's round-robin scopes itself to. Operator experience, never
  measured here. Cheap to confirm by ear the first time a block is built.
- ⚠ **The MOVE trade-off's other half** — `e18h` measured the *engine* with audio on a
  different track. Whether a MOVE leaves an audible **hole in the migrated take's own
  output** is unmeasured. **Record both, decide neither.**
- ⚠ **The cross-device modulator case** — E11e's form, whose path encodes a device
  **INDEX**, exactly what a rebuild renumbers. `e18e`'s ●● 3/3 says nothing about it.
- ⚠ **`getDocumentState()` capacity** for a JSON payload — never measured, and the
  branch metadata lands there.
- ⚠ **Dispositioned by operator judgement, not measurement** (retirement conditions in
  `E18-VERDICT.md` §7a): dormant-chain CPU, container PDC/transparency, clip-launch
  quantisation. ⚠ If exploration ever degrades the engine, or a take structure ever
  sounds different from its top-level equivalent, those are the first assumptions to
  re-test.
