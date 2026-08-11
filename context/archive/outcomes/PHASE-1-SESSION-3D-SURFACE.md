---
title: Phase 1, session 3d — the write surface
status: ● **DONE 2026-08-10.** NEW in the re-cut — it did not exist under the
        prime-suffix numbering, and it absorbs session 3's **B3**.
        Built: **18 tools** in `brain/src/surface/` — 5 reading, 9 writing, 4
        destroying — over the existing `Op` union, partitioned by NAME per D20/E20c,
        with D18c naming from the first line and a lexical ban list (`naming.ts`)
        asserted against tool names, the JSON schema an agent receives, every
        refusal the surface can produce, and every sentence it emitted while the
        suite ran. **B3 is wired**: `Workspace.apply` is `executor.run` →
        `stash.record` in one expression, and no tool can see an executor to go
        around it. Every reversal is planned against the launcher window, and
        ⚠ **`moved` is produced through the production path** — a clip replaced by
        an identical one is REFUSED, with a control proving the window is what
        catches it. Offline **344/344** (was 320); `npm run check` green.
        ⚠⚠ **What it found, and what is PROPOSED rather than settled**: the
        fidelity floor refuses **every** directed deletion, because nothing that
        already exists can be put back exactly — which would have made D20's
        destructive surface unable to run at all. Closed with a third `Clearance`
        kind (`directed-destruction`); see §What this session found. ⚠ The contract
        also gained its **eighth** method (`tracks()`): nothing could enumerate,
        so an agent had nowhere to get a first id.
        ⚠ **The live arm is narrow and is not a tool-set sweep** (that is session
        5's): `probe:e09` plus the new `C-list` conformance case are the only live
        paths through anything this session wrote. ⚠ E9's check C **failed on
        first run** — on its own hard-coded fixture assumption, which was
        pre-existing; replaced by a two-route comparison and ● **green at 4/4**.
        ● Live conformance **45/0/6**, `C-list` green.
        `moved` is proven offline through the production path, not live.
        ⚠ D18c's fresh naming applies from the first line, but **v1 is NOT frozen
        here**: a description cohort needs branch events and there are none yet.
        The freeze is 3g.
updated: 2026-08-10
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

---

# What was built, 2026-08-10

## The surface

`brain/src/surface/`, four modules and a suite:

| file | what it is |
|---|---|
| `tools.ts` | the tools **as data** — name, class, title, description, input schema, and the op kinds each may emit. `registerTools` puts them on an MCP server; `callTool` runs one by name. The same path both ways, so an offline case is a wire case |
| `workspace.ts` | ⚠⚠ the only route to the engine. `apply(ops)` is `executor.run` → `stash.record` in ONE expression, and `changes` is the stash's READ half — so a tool cannot record by hand, cannot forget, and cannot reach an executor to bypass either |
| `report.ts` | every sentence an agent reads. ⚠ Nothing internal is forwarded: verdicts are re-said per enum value, losses are derived from the recorded VALUE against `NOTE_PROP_FIDELITY`, refusals are re-said from each error's structured fields |
| `naming.ts` | ⚠ the ban list, in the `WIRE_METHODS_BANNED` idiom — the mechanisms by name, this project's jargon, and D18d's "typically/recommended" hedges, each with its reason |
| `surface.test.ts` | 23 cases, offline, ~15 ms |

**The tools.** Read: `check_connection`, `list_tracks`, `read_clip`,
`list_changes`, `check_revert`. Write: `write_notes`, `erase_notes`, `add_clip`,
`add_track`, `rename_track`, `add_scenes`, `add_device`, `set_parameter`,
`revert_change`. Destructive: `delete_clip`, `delete_track`, `delete_scene`,
`delete_device`.

⚠ **Where the line falls**, stated once and then asserted: **destroying is
removing a container** (clip, track, row, device), because what is inside goes
with it and no record here can rebuild it; **editing inside a clip is ordinary**,
because the prior state is read and recorded first and the engine refuses outright
when it cannot be. The one crossing is `revert_change`, named in
`WRITE_TOOLS_THAT_MAY_REMOVE` with its reason (D19).

⚠ **Four delete names, not one `delete` with a kind.** *"Don't ask again for this
tool"* is a blanket grant on a NAME (E20c), so the grain of the naming IS the grain
of the permission: granting clip deletion must not grant track deletion.

⚠ **Every write tool takes a LIST**, so a call is a batch (rule 4). One tool per op
kind with scalar arguments would have made "the batch is the unit" a claim the
surface itself broke.

## Exit criteria, one by one

| # | | where |
|---|---|---|
| 1 | applies, verifies, reverts through the surface, no probe | `T-roundtrip` (and a partial undo, scoped to one track) |
| 2 | every applied batch recorded, and provably so | `T-record` — structural (`Workspace` has no executor, `changes` has no `record`/`forget`) plus a source guard on `tools.ts` |
| 3 | every reversal passes the launcher window; `moved` produced | `T-moved`, ⚠ **with a control**: the same case planned WITHOUT the window offers to overwrite. ⚠ Offline only — the live arm is owed |
| 4 | the partition asserted, not documented | three `T-partition` cases: names, annotations, and what each tool may emit checked against what it actually sent |
| 5 | no description, parameter, refusal or receipt maps a change onto a mechanism | `T-words` ×4, over the JSON schema an agent receives, the whole refusal catalogue, every verdict sentence, and everything the suite emitted |
| 6 | no spike jargon | the same guard; `SURFACE_WORDS_BANNED` is the record |
| 7 | offline coverage | `T-surface` runs every tool and fails if one has no case |
| 8 | `npm run check` green | 344/344 |

## ⚠⚠ What this session found that it was not looking for

**1. The fidelity floor refuses every directed deletion, and D20 says it must
not.** The floor refuses any batch whose prior state cannot be reproduced exactly.
That is *every* deletion of anything that already exists: a track's identity, a
row's arrangement and a device's settings have no readback at all, and a clip's
name, colour and automation do not either. So the destructive surface D20 asks for
could never run — not once, not for anything. D20 says the opposite about exactly
these calls, in its own words: *"the boundary is host-mediated: nothing INSIDE our
system gates a directed destructive call"*, and *"the agent never DECIDES to
destroy; it may EXECUTE destruction the operator explicitly directed."*

⇒ Closed with a third `Clearance` kind, **`directed-destruction`**, carried only by
the four destructive tools and stamped with the tool NAME it rode in on — because
the name is what the operator granted. ⚠ **PROPOSED, not settled** (rule 10): it is
recorded in `PHASE-1-ENGINE.md` §Decisions proposed by session 3d.

⚠ Two things it deliberately does **not** do. It does not clear
`gateBeforeReading` — being unable to say what a deletion destroys is the one
condition no authorization changes (D20: *"mechanical walls do not move for
permission"*). And it does not touch the REPORTING: every destructive receipt still
carries what it could not put back.

**2. The contract could not enumerate anything.** `resolve` maps identity to a
handle and `read` reads addresses a caller already holds; nothing answers *which
addresses exist*, and no `Op` or `Address` variant could — an enumeration has
nothing to be addressed by. Invisible while the only client was a probe with its
ids hard-coded, load-bearing the moment a tool surface had to hand an agent
something to write to. ⇒ `BitwigAdapter.tracks()`, the **eighth** method, on both
adapters, with a conformance case (`C-list`) asserting that every id it hands out
is one `resolve` accepts. No new wire method: the live side is the `track.list`
scan it already did.

**3. A `clip.create` into an occupied slot reaches the floor before it reaches the
occupancy rule.** An occupied slot holds something unrecordable, so the general
refusal fires first and says *"this would replace something it cannot put back"* —
true, and useless. `add_clip` therefore reads the slots first and refuses with the
sentence that names them (E21's own refusal). ⚠ The engine's rule is untouched and
still fires second; this one exists to be actionable.

## ⚠ Owed

- **The live arm, and it is NARROW.** Only two pieces of today's work can be
  exercised live at all: `probe:e09` (re-pointed, and now also checking that the
  annotations survive the transport and that the two sets stay disjoint) and the
  new `C-list` conformance case, which is the only live path through
  `LiveAdapter.tracks()`. Everything else — all 18 tools, the workspace, the
  report layer — is adapter-agnostic and runs the identical code path offline.
  ⚠ **A live sweep of the tool set is session 5's**, not this session's: exit
  criterion 7 asks for *offline* coverage and criterion 1 asks for it *"with no
  probe involved"*.
  > ⚠⚠ **Run 2026-08-10, and check C FAILED — on its own assumption, not on the
  > code.** It asserted a hard-coded fingerprint in gn-A row 0 (*beat 0, pitch 60,
  > velocity 100, duration 1*); against `gn-scale-test` that slot holds a 16-note
  > chromatic run some other probe wrote, at duration 0.9. Nothing guarantees that
  > clip's CONTENTS — `ensureFixtureTracks` guarantees the slot holds *a* clip and
  > never writes a note into it — so the check was a claim about one project while
  > E9's question is about the transport. ⚠ The predicate was character-identical
  > before the re-point, so this was pre-existing rather than introduced.
  > ⇒ Check C now compares the MCP layer's answer against a **direct adapter read
  > of the same address**: project-independent, and a sharper question — does
  > anything change on the way through? ● **Re-run 2026-08-10: 4/4** — the tools
  > enumerate over stdio with the annotations intact and the two sets disjoint, the
  > connection check names the open project, and the notes the MCP layer returns
  > are identical to a direct adapter read of the same slot.
  >
  > ● **Live conformance, 2026-08-10: 45 pass / 0 fail / 6 skipped** (`gn-scale-test`,
  > 80 s). `C-list` is green, so `LiveAdapter.tracks()` — the only adapter code
  > this session added — is proven against real Bitwig, and the id it hands out is
  > one `resolve` accepts.
  > ⚠⚠ **`C-minted` passed too, and that does NOT retire it.** 3c's carry-forward
  > diagnosed it as a timing flake that fails CLOSED — the mint diff waits a fixed
  > budget where a readback exists, so under a loaded session the create has not
  > landed and the identity is correctly withheld. A green run is exactly what that
  > diagnosis predicts some of the time, so it is evidence about this run and not
  > about the defect. **Session 5's B7 stands**, and the fix it names
  > (`budgets.ts`: use the readback, not the budget) is unchanged.
- **`moved` live.** Proven offline through the production path, with a control.
  The plan's ○ note stands: a live arm that does not produce it means the arm did
  not reproduce a drag, so **re-arm rather than record a negative**.
- ⚠ **Standing rule 5 is still post-hoc for TRACK creates.** 3c made the scene
  budget a precondition; `track.create` has no equivalent, so a create that pushes
  the project past the track window is caught by the *next* batch's
  `assertBankVisible` rather than refused before the call. Found while writing
  `add_track`'s description, which now describes what the code does rather than
  what the rule wants. Not in this session's scope; named so it is not discovered
  by a stranded track.
- **`notify` has no tool.** It is in the `Op` union and not in planning decision
  3's list (*notes, clips, scenes, tracks, devices, params*), so it was left off
  rather than quietly added.
