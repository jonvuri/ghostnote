---
title: Phase 1, session 3c — the window
status: ● **DONE 2026-08-09.** Session 3's carry-forward B1, B2 and B6, which share
        one fix. ⚠ **Not new design** — standing rule 5 already mandates B1 in
        words that cover scenes verbatim, so this implements an existing decision
        rather than proposing one.
        Offline **320/320**; live `probe:e21` **11/11 + 9/9 + 5/5** (`FINDINGS.md`
        E21). ⚠ **ARM 1 measured**: `sceneBank.itemCount()` reports the PROJECT
        total, so the budget is implementable on the same instrument as the track
        one. ⚠⚠ **And the session found something bigger than it came for** —
        `clip.create` into an OCCUPIED slot is a silent, unbudgeted `scene.create`
        that appends a row past the window; see §What this session found that it
        was not looking for, and closed it. ⚠ The live conformance suite is **43/1/6**;
        its one red (`C-minted`) is verified PRE-EXISTING and carried to session 5.
        ⚠⚠ **It BLOCKS 3e**: the clip block makes room with `scene.create`, which
        is the exact call that had no precondition. Under the old prime-suffix
        numbering this session sorted *after* the one that depends on it — the
        contradiction that triggered the 2026-08-09 re-cut.
        ⚠ Was proposed as **session 3‴**.
updated: 2026-08-09
parent: PHASE-1-ENGINE.md
prev: PHASE-1-SESSION-3B-PROBES.md
next: PHASE-1-SESSION-3D-SURFACE.md
scope: PHASE-1-ENGINE.md §Re-plan session 3c
evidence: E3, E5, E5c, E15-A, E16r, E19, E20b · D5, D6, D7 · standing rules 1, 5, 13
---

# Phase 1, session 3c — the window

> **Purpose.** Make the bank window tell the truth in **both** dimensions. The
> model implemented standing rule 5 for tracks and never generalised it, so today
> a scene created past the window is unaddressable and un-deletable, clip rows past
> it are missing from `Snapshot.unreachable` entirely, and `ContentDelta` reports a
> window as **complete** when the world moved outside the bank.

## Why this session exists, and why it is first

Three items, one shape: **bank-window truth the model assumed for tracks and never
generalised.** They share a fix — one budget that the ops, the snapshot *and* the
observers all read — and splitting them across sessions is how one gets done and
the other does not.

⚠ **It was found by a probe, not by reasoning.** `probe:e19`'s first run stranded a
scene in a 99-scene project: `sceneBank.itemCount()` reports the PROJECT total (as
`trackBank.itemCount()` does, E15-A) while `sceneBank.getScene(i)` is bounded to
the 16-wide WINDOW, so `scene.create` appended at index 99 where nothing can
address or delete it. **Rule 5's named failure verbatim, one population down.**

⚠⚠ **And it is why this session runs before the clip block.** E18-VERDICT §4a′
makes `Project.createScene()` the clip block's room-making primitive — *"called
only to make room when a track's column has no free slot for another alternate"*.
So the mechanism that E20b just proved destroys an occupied row would be reaching
for a create with **no precondition at all**. `probe:e20b` had to hand-roll the
budget check itself to run safely; that check belongs in the contract, once.

## Scope

### In

1. **B1a — a scene budget as a PRECONDITION on `scene.create`.** Checked before
   the call, refused loudly, mirroring the track path exactly:
   `assertBankVisible` → `BankWindowOverflowError` (`contract/errors.ts`,
   `adapters/live/adapter.ts`). ⚠ Rule 5's own words: *"a precondition on every
   structural create… never a licence to reap."*
2. **B1b — a window guard on `scene.delete`.** `adapters/live/encoder.ts` passes
   `op.scene.index` straight through as a bank index, so a `SceneAddress` at or
   past the window throws from a real batch today.
3. **B1c — scenes counted into `Snapshot.unreachable`.** It reports blind tracks
   and stays silent about blind clip rows — the under-delivery D5 forbids.
4. ⚠⚠ **B2 — `ContentDelta` must be able to say the window does not cover the
   world.** By construction in `Rig.java`, `addHasContentObserver` is attached per
   bank row across `config.tracks`, on a slot bank sized by `config.scenes`. An
   edit on a track past the track window, or a scene row past the scene window,
   fires **nothing** — and `deltaComplete()` returns `true`.
5. **B6 — `config.scenes` scale, measured.** It sizes the scene bank *and* every
   slot bank, so raising it to fit real projects multiplies observer count. E5
   measured track-side scale only.
6. **Both adapters, the conformance suite, and one live probe.**

### Out — named so it does not drift in

- **Any branch mechanism.** 3e/3f. This session adds no new verb; it adds
  preconditions to verbs that already exist.
- **The tool surface.** 3d. A refusal that no tool can reach is still worth having
  — the executor is the caller today.
- ⚠ **Scrolling the bank to cover more of the project.** Tempting and wrong here:
  it converts a *refusal* into a *retry loop*, and the whole value of rule 5 is
  that the failure is loud rather than half-blind. If the window ever needs to
  move, that is its own session with its own re-resolution discipline (D6).
- ⚠ **Deleting anything to make room.** Rule 5: never a licence to reap. D20 puts
  destruction outside what this session decides.
- **A2, the persistent "what the user did" log.** Phase 3, and it unblocks the
  moment B2 lands — that is the point of doing B2 here.

## ⚠⚠ The design question this session actually has to answer

B1 is mechanical. **B2 is not**, and it is worth stating the choice before
building, because the obvious fix is the wrong one.

`deltaComplete()` returning `true` for a window that observed nothing is a **fourth
way a window can lie**, sitting beside `truncated`, `discontinuous` and
`unattributable`. ⚠ Unlike those three, **it is not detectable from the delta** —
the delta has no idea what it could not see.

Session 3's own proposed decision 4 is the precedent and it is binding here:

> *"Three named ways a window is unusable, never collapsed into 'no events'. Each
> reads as an empty window if you only count, and each means the opposite of
> quiet."*

⇒ **The fix is a fourth named verdict, not more observers.** The delta must carry
what the window *covered* — track count and scene count against the project totals
the marks already read — so `deltaComplete()` can answer honestly. ⚠ **Rejected in
advance: inferring coverage at the consumer.** Every consumer would have to
re-derive it, and the one that forgets fails silently in the direction that reads
as "nothing happened".

⚠ **Where the coverage comes from is the sub-question**: the mark already carries
`sceneCount`, and `track.list` already returns `{count, itemCount, bankSize}`. A
coverage statement should be assembled from what is on the wire rather than adding
a reply field — `methodsHash` is over method NAMES and cannot see a new field, the
gap that cost session 3 a sitting and produced `deploy.ts`.

## Exit criteria

1. A `scene.create` that would land past the window is **refused before the call**,
   with a message naming the budget and the totals — never a partial operation.
   ⚠ The refusal names what is impossible, never what to do instead (D18c).
2. A `scene.delete` addressed at or past the window is refused for the same reason,
   and `encoder.ts` no longer conflates a project index with a bank index.
3. `Snapshot.unreachable` reports **blind clip rows as well as blind tracks**, and
   a test proves a project with more scenes than the window produces a non-empty
   `unreachable` rather than a clean-looking snapshot.
4. ⚠⚠ `deltaComplete()` returns **false** for a window whose observers could not
   have seen the whole project, in **both** dimensions, and the reason is a named
   verdict rather than an absence.
5. `config.scenes` scale reported as numbers — `initMicros` and `markedValues` at
   raised counts, beside E5's track-side figures. ⚠ A number, not a verdict: this
   session measures the cost, it does not choose the default.
6. ⚠⚠ **The fake refuses everything the live adapter refuses.** PHASE-0 §Risks
   names fake-more-permissive-than-Bitwig as the one direction it must never be
   wrong in, and session 3's own review caught exactly that defect
   (`restartExtension` resetting one epoch and not the other). The conformance
   suite carries the assertions so neither adapter can be more forgiving.
7. `npm run check` green; one live probe green against a real project.

## ⚠ What a ○ means here, stated in advance

Written before the sitting so a negative is not quietly re-run until it turns
green (rule 10's habit, applied to our own expectations).

- ⚠⚠ **`sceneBank.itemCount()` NOT reporting the project total** would invalidate
  the budget's whole implementability. `Rig.java` already records this as
  **◐ UNPROVEN** for banks in general — E15-A and E16r measured it for *tracks*,
  and `probe:e19` observed 99 for scenes once, in passing, while doing something
  else. ⇒ **Measure it deliberately as arm 1**, with a control, before anything
  is built on it. If it reports the window size instead, the budget needs a
  different instrument and this session's shape changes.
- **The observers being coverable after all** — i.e. a bank that reports content
  outside its own window — would make B2 a smaller fix, not a different one. Worth
  a single check before accepting the design above.
- ⚠ **`config.scenes` scaling badly** is an input to a decision the operator owns,
  not a failure. E5 measured tracks; if scenes cost more per unit, the number goes
  in the record and the default stays where it is until someone decides otherwise.

## Running order

1. `npm run check` green on a clean tree, so the baseline is known.
2. ⚠ **Arm 1 first, and it is a measurement**: does `sceneBank.itemCount()` report
   the project total or the window size? Everything else rests on the answer.
3. B1a/B1b/B1c in the contract, both adapters, conformance.
4. B2 — coverage on the mark, the fourth verdict, `deltaComplete()`.
5. B6's scale sweep last: it reloads the extension repeatedly, and every reload
   mints a new `generation`, so marks taken before it are incomparable by design.
6. `./gradlew copyExtension`, ⚠ **reload the controller by hand** (a deploy is not
   a reload), `npm run probe:hello` — which fails rather than warns on a stale
   extension — then the live probe.

## ⚠⚠ What this session found that it was not looking for

**`clip.create` into an OCCUPIED slot appends a scene to the project** —
`Track.createNewLauncherClip` neither fails nor overwrites; it makes room by adding
a row at the END, past the bank window on anything bigger than it, and puts the new
clip out there where nothing can address, delete or observe it (`FINDINGS.md` E21).

⇒ **B1a as specified was necessary and not sufficient.** A budget on `scene.create`
alone has a door beside it, and that door is what took the test project from 10
scenes to 170 in an afternoon — two or three dozen rows per live conformance run,
every one of them through `withClip`'s unconditional `clip.create`, while
`scene.create` was being correctly refused throughout.

⚠ It is also the likeliest explanation for the **99-scene project `probe:e19` tripped
over**. E19's account of the symptom stands; its implied cause was incomplete.

**Built, as scope this session added deliberately:** `SlotOccupiedError` and
`assertSlotsFree`, a precondition on both adapters — the RULE in the contract, the
occupancy LOOKUP per adapter, so neither can be the lenient one. Refusing is right on
its own terms before any of the above: a caller naming a slot means THAT slot, and
*"create a clip somewhere you choose"* is not expressible in the op union. ⚠ It is
the same precondition E20b puts on `duplicateClip` — where an occupied destination is
worse still, because the existing clip is DESTROYED and no occupancy event fires —
so **3e inherits it rather than inventing it**.

## The live conformance suite, and the two leaks it was carrying

⚠ **The suite was growing every project it ran against**, and the bigger half was
this session's finding: `withClip` created a clip unconditionally, so once a real
project held a clip in row 0 every case after the first appended a scene. Two or
three dozen rows per run.

| leak | fix |
|---|---|
| ⚠⚠ `withClip`, `C-twoclips`, `C-revert` created into slots a real project already filled | delete before create — the refusal now makes it a hard error rather than silent growth |
| ⚠ `C-epoch` and `C-content` each created a scene and never gave it back | `giveBackLastScene`, from the END (E3: a mid-grid delete compacts every row beneath it) |
| `C-slot`, `C-exec` asserted a row was empty because *no case writes to it* | establish it. A real project arrives with its own clips, and "no case writes here" is not "this is empty" |

● **43 pass / 1 fail / 6 skipped, and the project is unchanged across a run** —
measured 14 scenes before, 14 after. The 6 skips are the `canOverflowBank` cases,
which a live harness cannot stage: reaching them costs a create past the window,
which strands a row nothing can delete (E19). Their live evidence is `probe:e21`
instead, which proves the same refusals from the other side.

## ⚠ CARRY-FORWARD — `C-minted` fails in a full live run only (pre-existing)

**Not this session's, and verified so**: it fails identically on the pre-session
tree (`git stash`, same project, same case). Recorded because it is now the only
red in the live suite.

| | |
|---|---|
| symptom | `track.create` reports no minted identity — `receipt.minted[0]` is `undefined` |
| ⚠ passes | in isolation, and in every 3–5 case subset tried (`C-revision+`, `C-twoclips+C-stash+`, `C-notes+C-props+C-gain+`) |
| fails | only in the full 50-case run |

⇒ **Diagnosis: the mint diff waits a fixed budget where a readback exists.**
`apply` scans the bank, sends the create, waits `trackStruct` (144 ms, E1/E3) and
diffs. Under a loaded session the create has not landed, the diff sees no new
`channelId`, and the mint is correctly withheld — failing CLOSED, which is why it
is a flake and not a wrong answer. ⚠ `budgets.ts`'s own header already prescribes
the fix: *"where a readback exists, use it instead of a budget — `refreshIndex`
re-reads the bank rather than waiting out a track create"*. The mint path does not.

⇒ **Home: session 5's live sweep**, beside B4 (the three selection capture/restore
pairs) and B5 (the two unmeasured drags).

## ⚠ A deliberate asymmetry with the track path, stated so it is not read as an omission

The track dimension REFUSES EVERY WRITE on an overflowing project
(`assertBankVisible`). The scene dimension does not: it refuses **per address**
(a row outside the window), refuses the **creates** that would make one, and REPORTS
the rest — `Snapshot.unreachable` for what it could not see, `uncovered` for what the
observers could not have seen.

The reason is that the two blind spots differ in kind. A track outside the window
cannot be RESOLVED at all — `channelId` resolution silently fails, so an address may
mean nothing. A row outside the window is perfectly resolvable for every row inside
it; what is lost is concurrent-edit reach, and that is reported rather than guessed.
⚠ **Whether a scene-overflowing project should refuse writes wholesale is a PRODUCT
decision, not an implementation detail** — it would refuse most real projects — and
it is not this session's to take. Recorded here as a question the operator may want.

## Risks

- ⚠⚠ **Growing the scene count is easy and shrinking it is not.** `Scene.deleteObject()`
  compacts rows **upward** (E3), so a mid-grid delete stales every address beneath
  it permanently. A probe that creates scenes must give them back **from the end**,
  which is what `probe:e20b` did.
- ⚠ **The live probe touches a shared project.** It must claim only rows it has
  verified empty, delete only what it created, and abort without deleting if
  anything moved outside its region — `probe:e20b`'s discipline, and the reason it
  refused to clear the operator's clips to make room.
- **Init-cost regression from B6.** Raising `config.scenes` multiplies observers
  across every track. Report the delta rather than assuming it away (E5).
- ⚠ **Scope creep into the write surface.** The natural next thought after "the
  refusal works" is "let the agent see it", and that is 3d. This session's callers
  are the executor and the conformance suite.
