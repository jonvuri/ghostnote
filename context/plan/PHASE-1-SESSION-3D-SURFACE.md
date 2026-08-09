---
title: Phase 1, session 3d — the write surface
status: PLANNED 2026-08-09. NEW in the re-cut — it did not exist under the
        prime-suffix numbering, and it absorbs session 3's **B3**.
        ⚠⚠ The MCP surface is still `ping` and `read_notes`, so nothing in
        production calls `stash.record()` or `planReversal()` — the stash and the
        whole reversal path are UNWIRED, and `moved` / `undecidable` are exercised
        by tests only.
        ⚠ D18c's fresh naming applies from the first line, but **v1 is NOT frozen
        here**: a description cohort needs branch events and there are none yet.
        The freeze is 3g.
updated: 2026-08-09
parent: PHASE-1-ENGINE.md
prev: PHASE-1-SESSION-3C-WINDOW.md
next: PHASE-1-SESSION-3E-CLIPBLOCK.md
scope: PHASE-1-ENGINE.md §Re-plan session 3d
evidence: E8, E8b, E15-E, E19, E20c · D8, D12, D15, D16, D17g, D18c, D19, D20 ·
          standing rules 1, 4, 8, 10, 12
---

# Phase 1, session 3d — the write surface

> **Purpose.** Turn the engine into something an agent can drive. Sessions 1, 2
> and 3 built an executor, a stash and a detector that **nothing in production
> calls**. This session gives them a caller, partitions that caller by privilege
> class, and closes session 3's B3.

## Why this session exists, and why it is not part of a mechanism session

Two independent reasons, and the second is the load-bearing one.

**1. The engine has no caller.** `Session` owns a `Stash` nothing writes to.
`brain/src/mcp-server.ts` registers two tools. So `stash.record()` and
`planReversal()` are dead code in production, which means the stash's `moved` and
`undecidable` verdicts — *the two that session 3's entire justification rests on*
— have never run outside a test. B3, verbatim: **record every take**, and pass
**`launcher: await adapter.contentSince(take.at)`** to every reversal.

**2. ⚠⚠ D18c's one-way door must not open by accident.** The tool surface is where
the choice-mapping firewall lives, and a leak *"contaminates every event logged
after it, irrecoverably"* (HYBRID §4). Building the surface in the same session as
a branch mechanism means writing that mechanism's description while it is still
being designed — which is exactly how a "use X when Y" sentence gets written as a
placeholder and never removed. ⇒ **The surface is built with no branch verbs on
it at all**, so there is nothing to map a choice onto yet.

⚠ **A cohort does not start here.** D18d's record counts *branch events*; there
are none until 3e. So descriptions written here are written to v1's rules and
amended when the branch verbs join, but the version is declared in 3g. **One
naming pass with an amendment, not two passes.**

## Scope

### In

1. **A write surface over the EXISTING `Op` union** — notes, clips, scenes,
   tracks, devices, params. No new ops, no new wire methods. ⚠ The breadth is
   already decided: *"enough to make all three mechanisms real"* (planning decision
   3, `PHASE-1-ENGINE.md`), and this session ships everything in that list that
   exists today.
2. ⚠⚠ **D20's partition, keyed on the tool NAME.** Read tools, write tools and
   destructive tools live on separately-named surfaces. Annotations
   (`readOnlyHint` / `destructiveHint` / `idempotentHint`) go on and stay on, and
   **nothing relies on them**.
3. **B3 — the stash and the reversal path, wired.** Every applied take recorded;
   every reversal passing the launcher window; reversal structurally bounded to
   the session's own changesets (D19).
4. **D18c naming, from the first line.** Fresh, jargon-free, written for a
   general-purpose agent. No spike jargon crosses the surface.
5. **Offline test coverage for the MCP surface**, which has none today.

### Out — named so it does not drift in

- **Every branch mechanism.** 3e, 3f. ⚠ This is the whole point of the split; see
  above.
- **The v1 freeze, the record, the classifier.** 3g.
- ⚠ **A "do what I mean" tool.** The surface exposes verbs, not intentions. An
  intention-shaped tool has to classify, and classification on the surface is the
  leak.
- ⚠ **Any prescriptive fallback.** *"If the agent does not choose, the system
  reports and stops"* (D18c). An automatic default is the same leak arriving
  through behaviour instead of text.
- **Phase 3's local API.** PHASE-1 §Risks names the hazard by name: *"the local API
  grows into Phase 3's UI backend by accident."*

## ⚠⚠ What E20c changed about D20, and what this session must therefore do

D20's mechanism is unchanged; its *reason* was measured wrong and amended.

| | |
|---|---|
| what D20 assumed | the host prompts **because of** `destructiveHint` |
| ⚠⚠ what E20c measured | Claude Code prompts **identically for all four tools**, annotated or not, including an unannotated baseline. No visible sign the annotations are read at all |
| ⚠ what it DOES gate on | the tool **NAME**, per project — *"Yes, and don't ask again for **this tool** in this project"* |

⇒ Three consequences this session is built around:

1. **The partition is load-bearing rather than cosmetic**, because the name is what
   the host's allow-list keys on.
2. ⚠⚠ **"Don't ask again for this tool" is a PER-NAME BLANKET GRANT.** ⇒ **A
   destructive verb must never share a tool name with a benign one, and must never
   be widened to cover a benign case later.** Tool-surface granularity IS
   permission granularity — a test should assert the partition, not a comment.
3. **Annotations stay on as future-proofing, not as a mechanism.** They are
   correct, they cost nothing, and a host that starts honouring them makes the seam
   sharper rather than different. ⚠ No design may assume a host reads them.

⚠ **Measured against Claude Code only** (the operator's target host). Other hosts
are unmeasured, not assumed equivalent — and under rule 2 above it matters less
than it would have, since the name grain carries the weight.

## ⚠ The reversal boundary, stated before it is built

D19: reversal is **directed** (the human asks), rides the **ordinary** write
surface, and is **structurally bounded to the session's own changesets**.

- **Clean reverts are not reaping** (the D20 boundary) and need no approval beyond
  the instruction that directed them.
- **Reversal that would destroy anything we did not mint-and-last-write is withheld
  and reported** through the fidelity machinery — never silently escalated to
  destruction. The machinery exists: `ChangesetNotFoundError` is already D19's
  structural bound; `planReversal`'s `undeletable` pass already computes it.
- ⚠ **It must SAY best-effort.** `gain` withheld (D16b), `pressure` stripped and
  named (D16c), `none`-fidelity reported loudly (D16d) — reused, never reinvented.

⚠⚠ **And the launcher window is the part that is easy to forget.** `planReversal`
takes an optional `launcher: ContentDelta`; omit it and the boundary degrades to a
documented caveat instead of producing the `moved` verdict. ⇒ **Passing it is not
optional in production**, and a test should make omitting it fail rather than
quietly report a caveat.

## Exit criteria

1. A batch of note ops **applies, verifies and reverts** end to end **through the
   MCP surface**, with no probe involved — the first time the pipeline runs with a
   real caller.
2. `stash.record()` is called for **every** applied take, and a test proves a take
   that applied cannot fail to be recorded.
3. Every reversal passes the launcher window, and ⚠ **`moved` is produced in
   production for the first time**: a clip dragged out and an identical one dragged
   back is refused, which no content comparison in the system can catch.
4. ⚠⚠ **The partition is asserted, not documented.** A test enumerates every
   registered tool and proves: no destructive verb shares a name with a benign one;
   every read tool carries `readOnlyHint`; every destructive tool carries
   `destructiveHint`; and the sets do not overlap.
5. ⚠⚠ **No description, parameter name, refusal message or receipt maps a change
   onto a mechanism.** A lexical ban guard in the reviewable style of
   `WIRE_METHODS_BANNED` and `STASH_MUTATORS` — the ban list IS the record, and it
   is read at review time. ⚠ `executor.test.ts`'s existing assertion that refusal
   text names no mechanism must keep passing.
6. **No spike jargon on the surface**: fork, reap, lineage, stash, floor, take,
   changeset, epoch as terms of art. Asserted by the same guard.
7. The MCP surface has **offline** coverage — today its only exercise is a probe
   that needs a live bridge.
8. `npm run check` green.

## ⚠ What a ○ means here, stated in advance

- ⚠⚠ **A tool that cannot be described without naming a mechanism is a design
  smell, not a documentation problem.** If v1's wording keeps wanting to say *"use
  this when…"*, the verb is at the wrong altitude and should be split or renamed —
  not annotated with a caveat. Fixing it in prose is how the leak ships.
- **The lexical ban guard producing false positives** is expected and fine; a guard
  that never fires is not a guard, and the remedy is to widen the exemption list
  **explicitly**, one entry at a time, the way `WIRE_METHODS_BANNED` does.
- **`moved` never firing in the live arm** would mean the arm did not reproduce a
  drag, not that the verdict is wrong — E19 measured the pair. ⚠ Re-arm rather than
  record a negative.

## Risks

- ⚠⚠ **The naming is the expensive part and it does not feel like it.** D18c asks
  for every domain concept renamed from scratch, for a general-purpose agent, with
  names that *"naturally suggest capabilities and seams while leaving room for
  judgment"*. That is design work, and doing it hastily here is how 3g inherits a
  vocabulary it has to break.
- ⚠ **stdio uses stdout for JSON-RPC.** A stray `console.log` in the server breaks
  the transport — already noted in the file and easy to reintroduce.
- **Two chat sessions are two MCP servers are two writers** (rule 7's replacement).
  The revision guard makes them *ordered*, not *coherent*: a rejected batch must be
  re-planned against the new world by whoever sent it. ⚠ The surface must report a
  rejection in terms an agent can act on, not as an opaque failure.
- ⚠ **Widening a destructive tool later is the failure this design cannot
  recover from**, because the operator may already have granted it blanket. Any
  future widening is a **new name**.
