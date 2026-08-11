---
title: Phase 1, session 3g — the record, the classifier, and the v1 freeze
kind: plan
state: planned
status: PLANNED 2026-08-09. The last session of the 3-family, and it lands last
        ON PURPOSE.
        ⚠⚠ **This is the one-way door.** D18c: guidance can always be ADDED on
        evidence — that is L3-open degrading gracefully toward L3/L1 — but
        choice-mapping can never be cleanly REMOVED, because a leak contaminates
        every event logged after it, irrecoverably.
        ⚠ Depends on 3e AND 3f: all three mechanisms must exist before they can be
        described honestly, and the classifier has nothing to classify until they
        do.
        ⚠⚠ **The vocabulary it freezes already EXISTS** — 3d wrote it
        (`brain/src/surface/`), under D18c from the first line, and held it with a
        lexical ban list (`naming.ts`) asserted against the JSON schema an agent
        receives, every refusal the surface can produce and everything it emits.
        So this session AMENDS one naming pass when the branch verbs join and then
        declares the version; it does not start one. ⚠ The ban list is where the
        mechanisms are banned BY NAME, which is exactly what has to be relaxed,
        deliberately and entry by entry, when a branch verb needs to describe
        itself — and the guard is what makes that a reviewable act instead of a
        sentence nobody noticed.
        ⚠ Was part of **session 3″**.
updated: 2026-08-10
parent: README.md
prev: 3f-fork-chain.md
next: 4-control-layer.md
scope: PHASE-1-ENGINE.md §Re-plan session 3g
evidence: E14-A1/A3/A4/C1/C2, E20c, E20d ·
          HYBRID-AUTONOMY-LEVELS §1a/§1b/§4/§5a/§5b/§5c/§5d ·
          E18-VERDICT §1/§6 · D18b/c/d, D19, D20 · standing rules 8, 10, 13
---

# Phase 1, session 3g — the record, the classifier, and the v1 freeze

> **Purpose.** Make D18's hybrid *measurable*. The agent experiences L4 — open
> tool descriptions, no dispatch rule anywhere on its surface. The record captures
> L3 — every branch event stores a deterministic rule's verdict, computed silently
> and used for nothing, beside the agent's actual choice and the human's response.
> **Only reporting is imposed.**

## Why this session is last, and why that is not scheduling

Three reasons, in order of how much they cost to get wrong.

1. ⚠⚠ **The freeze is a one-way door.** *"Freeze a version, gather events under it,
   then edit — an edit mid-cohort splits the cohort and neither half is
   interpretable alone"* (HYBRID §5b). Freezing v1 while a mechanism is still being
   designed guarantees an edit mid-cohort.
2. ⚠⚠ **A description written before its mechanism exists is written from a plan,
   not from the thing.** D18c requires *correctness recipes* — group-then-duplicate,
   append-only rows, the empty-destination precondition — as **required knowledge**,
   because *"deficient knowledge is a CONFOUND in the judgment measurement, not a
   purer form of it. We measure judgment, not ignorance."* Those recipes are only
   trustworthy once each mechanism has been built and probed.
3. **The classifier has nothing to classify** until all three mechanisms exist. A
   rule that can only ever return two of its three answers is not the rule
   E18-VERDICT §6 analysed.

## Scope

### In

1. **The branch-event record** (D18d), one row per branch event, in the document
   setting `UiPanel` already creates and hides.
2. **The deterministic dispatch classifier**, in the executor — computed per branch
   event and **used for nothing**.
3. ⚠⚠ **The unreachability guard.** The classifier must be *provably* absent from
   the agent's surface, asserted rather than intended.
4. **The v1 freeze** — description text as a first-class versioned artifact, and the
   version stamped into every record row.
5. **How the record is read** — the four-cell table below, and the two confounds
   stated rather than buried.

### Out — named so it does not drift in

- **Any new mechanism, op or wire verb.** 3e and 3f closed those. If this session
  finds itself adding a verb, something upstream was left undone.
- ⚠ **Acting on the classifier's verdict, in any way, ever.** It informs nothing.
  A fallback that uses it *"if the agent does not choose"* is the leak arriving
  through behaviour instead of text — D18c: *"if the agent does not choose, the
  system reports and stops."*
- ⚠ **Retention policy for the record.** D17f died with the store and no policy
  replaced it. ⚠ The record is **human-owned** under rule 8, so its privilege
  boundary and its pruning are a decision the operator owns — flag it, do not
  improvise it.
- **Phase 3's rendering of the record.** A2 is still Phase-3 work.

## ⚠⚠ The firewall, stated exactly

D18c, verbatim, because paraphrasing it is how it erodes:

> **Tool descriptions carry complete mechanical knowledge — capabilities, costs,
> traps, and correct procedures, as prescriptive as correctness requires — and
> ZERO choice-mapping: nothing that maps the shape of a change onto a mechanism.
> Facts and procedures, never pre-drawn conclusions.**

| allowed | forbidden |
|---|---|
| *"A layer chain carries devices but never clips; switching is one exclusive flag; removing one costs a 7-step rebuild"* | *"Use a layer when the change is device-only"* |
| *"`duplicateClip` overwrites the destination row if it is occupied"* | *"Prefer the clip block for note changes"* |
| refusal text saying **what is impossible** — *"a fork here would mint a track we cannot address"* | refusal text saying **what to do instead** — *"fork won't fit, use a layer"* |

⚠ **Facts that let an agent DERIVE the rule are fine.** A derived conclusion is a
finding — HYBRID §5c row 1: high agreement means the rule captures what good
judgement does. A pre-drawn one is compliance.

⚠ **Refusals must be predictable**, which is why preconditions are documented: the
bank-window budget, the scene budget, the empty-destination row, the fidelity floor.
*"Unpredictable refusals also pollute the instrument: wall-bump mechanism switches
are not judgment."*

⚠ **Error and refusal text is part of the surface.** So is a parameter name. So is
a receipt the agent reads back.

## The record — one row per branch event

⚠ **The matched pair is the point**: two independent verdicts on one event, neither
informed by the other. Same shape that made `e18b`'s reload result trustworthy.

| field | notes |
|---|---|
| the **raw write-set** | ⚠ the INPUT, never a classification — so any future rule, including ones not yet invented, replays against it (HYBRID §1a) |
| the rule's **silent verdict** | computed in the executor, **used for nothing** |
| the **agent's choice** | which mechanism it built |
| *agreed?* | ⚠ **derived, never stored** |
| the agent's **own rationale** | ⚠ its reasoning for its choice — **not** a justification of a deviation, since it never saw a default |
| the **human's response** | accepted / vetoed / **silent** — ⚠ silent must be distinguishable from accepted |
| the **resulting structure** | by identity |
| ⚠ the **tool-description version** | without it, a shift in agent behaviour is equally explained by a description edit and by anything else |

⚠⚠ **Why agent judgement is worth spending real sessions on**: it is
**perishable** — the conversation and the human's stated intent are not in the
changeset, and cannot be recovered later. The rule's verdict is free, retroactive
and permanent. So live sessions buy the signal that cannot be reconstructed
(HYBRID §1a/§1b).

## ⚠⚠ Where the record lives, and the finding that nearly moved it

**`getDocumentState()`, hidden at `init()`** (D18d rev). The plumbing is built —
`UiPanel`'s constructor creates the setting, hides it where it creates it, and
refuses to create one it cannot hide. What this session adds is the content, a
contract-reachable name, and the discipline.

| measured (E20d) | |
|---|---|
| capacity | ● **262144 chars** round-trip the wire exactly, store exactly, and **survive a save plus a full application restart byte for byte**. Init costs 16.7 ms |
| ⚠⚠ drawing it | **hard-locked Bitwig** — the pane hung with a busy cursor, drew over other windows, force quit required. The operator reported lag from **1024 chars up**, so the lock is the top of a continuous curve |
| the fix | ● hidden at `init()`, **not at runtime** — `hide()` is a runtime call and `init()` re-creates the setting **visible**, so a runtime hide re-arms the hazard on every restart |
| a hidden setting's value | ● holds byte for byte at full size (`E20d-H3`), 19 ms settle |

⇒ **Capacity was the wrong question.** What the document setting buys — and the
reason it survived the finding — is that the record stays **per-project** and
**survives a restart** (E14-A3/A4), while never being rendered. ⚠ *Rejected: a
pointer or rolling window with the log elsewhere*, and *rejected: dropping the
document setting as the record's home* — both were live while capacity looked like
the constraint, and both would have cost exactly the property the record is there
for.

Three things this session must get right:

- ⚠ **A contract-reachable name.** `ui.*` is asserted probe-only by
  `wiremap.test.ts`, so the record needs its own wire name and its own golden
  bucket — not a widening of the probe surface.
- ⚠ **`ui.set` is ASYNCHRONOUS, and intermittently so.** 3b measured a 4096-char
  write reading back as exactly the length of the value written before it, while
  8192 passed on either side — *"a one-shot readback is usually right and
  occasionally wrong, the hardest kind of wrong to notice."* ⇒ **Poll until it
  lands**, and use 3b's measured settle time.
- ⚠ **The record self-limits by DECISION, not by measurement.** Operator's call in
  3b: no deliberate over-length write, so the E14-A1 async-throw class is never
  re-entered. That consequence was accepted knowingly.
- ⚠ **`RigConfig.recordChars` defaults to 0**, which is a documented **safety**
  default rather than tidiness. Changing it is part of this session and should be
  stated as such.

## The classifier

E18-VERDICT §6, form C — *split by object type, with the track fork as the escape
hatch for changes that span both* — **repurposed, not discarded**. It went from a
policy proposal to an instrument; the analysis stands, only its job changed.

⚠⚠ **It must never reach the agent's surface in any form.** The existing idioms are
the model, and all three are reviewable because the ban list *is* the record:

- `WIRE_METHODS_BANNED` + the `src/` filesystem walk that greps every non-probe
  file for a banned method name.
- `STASH_MUTATORS` + `surface.test.ts`'s proof that no mutator is reachable from
  the read half, walking the whole prototype chain.
- `executor.test.ts`'s `X-ban`, which asserts by name that a method is absent — and
  its sibling assertion that the floor's refusal text matches no mechanism word.

⇒ **A fourth guard in the same family**, aimed at the classifier: its verdict must
be absent from every description, parameter name, refusal message and receipt.

## Exit criteria

1. A branch event through any of the three mechanisms writes **one row**, carrying
   every field above, and the row survives a save plus a full restart.
2. ⚠⚠ **The classifier's verdict is provably unreachable** from the tool surface —
   asserted by a guard that fails loudly, not by review discipline.
3. ⚠ **The record round-trips through a HIDDEN setting**, confirmed by eye that the
   row is absent from the pane and the pane stays responsive — the two human
   observations D18d asked for, which were owed once and are now the standing check
   before anything writes a large record.
4. **v1 is declared and frozen**: description text versioned as an artifact, the
   version stamped in every row, and an explicit statement that the next edit
   starts a new cohort.
5. v1's content is **lean** — mechanics, trade-offs and correctness recipes; ⚠ no
   worked examples, no heuristics, no *"typically"* or *"recommended"* language.
6. ⚠ **Silent is distinguishable from accepted** in the stored row, and a test
   proves the two cannot collapse.
7. `npm run check` green; a live end-to-end branch event recorded and read back.

## ⚠ How to read the record, and the two confounds

| rule vs agent | human response | reading |
|---|---|---|
| high agreement | — | the rule captures what good judgement does ⇒ L1 would lose little |
| ⚠ **low agreement** | choices accepted | ⚠ **the agent is adding real value the rule cannot express** — the outcome that justifies L3-open |
| low agreement | choices vetoed | the agent is wrong ⇒ tighten the **descriptions** first, the rule only if that fails |
| high agreement | vetoed anyway | ⚠ **both are wrong** — the rule encodes a misconception the agent shares |

1. ⚠⚠ **The veto rate is not clean.** A falling veto rate reads as the agent
   improving and is equally consistent with the human having stopped reading.
   ⇒ **Report veto rate and choice-diversity together, and treat "departs more,
   vetoed less" as SUSPICIOUS rather than as success.** There is no clean control;
   naming it is the honest move.
2. ⚠ **The deterministic arm is not a clean counterfactual.** The agent's choices
   shape the project, so later write-sets are downstream of agent policy. Replaying
   the rule says what it would say **about real work** — which is what is needed —
   ⚠ but it must never be read as *"what would have happened under L1."*

## Risks

- ⚠⚠ **The leak is silent and retroactive.** Nothing fails when a description
  acquires a *"use X when Y"* sentence; the events logged afterwards are simply
  worthless, and indistinguishable from the clean ones. ⇒ The guard is the only
  real defence, and it has to run in CI rather than at review time.
- ⚠⚠ **A large value in a visible field kills Bitwig.** Same severity class as
  E14-A1, reached by a different route, and nothing extension-side contains either.
  The hide is in the constructor for a reason; moving it is not a refactor.
- ⚠ **Freezing too early is as bad as leaking.** If any mechanism's recipes are
  still moving when this session starts, the cohort splits on its first edit. ⇒ The
  honest response is to hold the freeze, not to freeze and amend.
- ⚠ **Retention has no policy.** The record grows, the field is finite, and the log
  is human-owned. Left as an operator decision on purpose — but it should be
  *raised* here rather than discovered when the field fills.
