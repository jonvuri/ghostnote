---
title: Phase 1, session 3b — the early probes
status: ● **DONE 2026-08-09.** Four design-gating unknowns, measured before the
        clip block was designed — plus one defect found by accident. All four
        answered, all operator-gated arms run.
        ⚠⚠ **E20a ●● 12/12** — `launchWithOptions` confirms E18-VERDICT §4a″-bis
        by measurement (`FINDINGS.md` E20a), after two APPARATUS bugs that first
        produced a confident refutation of a claim that is true (see §What the
        first live sitting cost); ● the EAR arm then agreed with the numbers.
        ⚠⚠ **E20b ●● 11/11** — `duplicateClip` OVERWRITES an occupied next row and
        the launcher-content observer cannot see it, so an empty destination is a
        HARD PRECONDITION for 3e (`FINDINGS.md` E20b).
        ⚠⚠ **E20c ●● 7/7 + ARM B** — Claude Code prompts IDENTICALLY for all four
        tools, annotated or not: D20's seam stands, gating on the tool NAME, and
        its stated reason was amended (D20 rev).
        ⚠⚠ **E20d** — 262144 chars store and survive a restart byte for byte, and
        DRAWING the field hard-locks Bitwig ⇒ the record is hidden at `init()`
        (D18d rev), built and re-probed the same day.
        ● **E20e** — the bridge client corrupted any non-ASCII reply split across
        a TCP chunk boundary. Found by accident, fixed, regression-tested in both
        directions.
        ⚠ RENUMBERED 2026-08-09: this was **session 3′**.
updated: 2026-08-09
parent: PHASE-1-ENGINE.md
prev: PHASE-1-SESSION-3-BRIDGE.md
next: PHASE-1-SESSION-3C-WINDOW.md
scope: PHASE-1-ENGINE.md §Re-plan session 3b
evidence: E14-A1/A3/C2, E16m, E16s, E16w, E18-VERDICT §4a′/§4a″/§4a″-bis/§4b/§4c,
          E19 · D18c, D18d, D19, D20 · standing rules 1, 3c, 5, 9, 10, 13
---

# Phase 1, session 3b — the early probes

> ⚠ **This session was `3′` until 2026-08-09.** The prime suffixes recorded the
> order sessions were *proposed*, which disagreed with the order they *run* — see
> `PHASE-1-ENGINE.md` §The renumbering. Nothing about the session changed.

> **Purpose.** Measure the four things the clip block's design would otherwise
> assume, **before** it is designed. Every one of them is a call nobody has made
> or a behaviour nobody has watched, and each carries a whole design claim.

## Why this session exists, and why now

`PHASE-1-ENGINE.md`'s re-plan puts a row 3b between session 3 and the branch
mechanisms, for a reason `PROJECT_PLAN.md` §7 states plainly: two of these are
**"readings, not measurements"**, and *"the clip block's entire ergonomic claim
runs through them"*. E18-VERDICT §7b is blunter — ⚠ **wire it and probe it before
the clip half is designed**.

The sequencing is the whole point. A design built on a javadoc and then measured
is a design that gets defended; a design built on a measurement is one that gets
made once.

| # | unknown | what rests on it | status |
|---|---|---|---|
| 1 | `launchWithOptions(quantization, launchMode)` | per-call `"1"`/`"8"` quantisation, and ⚠⚠ `"continue_or_synced"` — take B resumes at A's position, **the only answer to E16m** and the one thing no mute, solo or chain switch can imitate (§4c) | ⚠⚠ ●● **MEASURED 2026-08-09, 12/12** (`FINDINGS.md` E20a). Both claims hold, and ● the EAR arm agreed |
| 2 | `ClipLauncherSlot.duplicateClip()` | the primitive that mints the next take, and whether **append-only geometry** is sound or a mint is a structural op that stales addresses | ⚠⚠ ●● **MEASURED 2026-08-09, 11/11** (`FINDINGS.md` E20b). Copies into the next row down, both routes agreeing — but ⚠⚠ **OVERWRITES an occupied row**, invisibly to the observers |
| 3 | MCP `destructiveHint` handling | **D20's entire stop-and-ask** — *"the host's permission flow is the gate"*, which D20 itself flags as a spec reading | ⚠⚠ **ANSWERED 2026-08-09** (`FINDINGS.md` E20c): Claude Code prompts **identically for all four**, annotated or not. The seam stands — the host gates on tool **NAME** — but D20's stated reason needs amending (rule 10, proposed below) |
| 4 | `getDocumentState()` JSON capacity | where **D18d's branch-event record** lives | ⚠⚠ **ANSWERED 2026-08-09, and the question was the wrong one** (`FINDINGS.md` E20d). All three storage ceilings ● at **262144 chars** — wire, setting, and a full save+restart. ⚠⚠ But **interacting with the field HARD-LOCKED BITWIG** (force quit). The constraint is that the value is DRAWN, not that it is large. ● Fixed by hiding at `init()`; `probe:e20d-hidden` H1/H2/H3 PASS at full size |

## Scope

### In

1. **A probe-only wire surface** — five methods, none of them contract surface.
2. **Four probes**, `E20a`–`E20d`, each with its control arm named.
3. **A finding per unknown** in `FINDINGS.md`, and the two decisions this session
   can only **propose** (rule 10) put to the operator.

### Out — named so it does not drift in

- **The contract.** Nothing enters `WIRE`, the adapter contract, or the fake.
  `wiremap.test.ts`'s new `E20` case asserts it, the same way it does for E16.
- **The clip block's design, the tool surface, D18c's fresh naming** — sessions 3d and 3e.
  A name minted in a probe would freeze a v0 vocabulary the moment before the
  vocabulary is designed, which is why the E20c tools are called `gn_probe_*`.
- **Standing rule 5 for scenes** (session 3's B1/B2 → 3c). `E20b`
  refuses rather than fixes: it checks the budget, and it will not delete a clip
  to make room.
- **The stash / reversal wiring** (session 3's B3 → 3d).
- **Any deliberate over-length write.** Operator's call, 2026-08-09: the
  doc-state sweep stays at or below the declared `numChars`, so the E14-A1
  async-throw class is not re-entered. The design consequence — the record must
  self-limit — is a decision rather than a discovery, and that is accepted.

## Delivered

| where | what |
|---|---|
| `TrackHandlers.java` | `slot.launchWithOptions` (⚠ both strings validated before the call), `slot.duplicateClip` (two routes, whole column read first), `slot.playState` |
| `CursorHandlers.java` | `cursor.playState` — `Clip.playingStep()`, ⚠ a new NAME so `methodsHash` moves |
| `AppHandlers.java` | `transport.status` += `playPosition`, `sampledAtMs` |
| `Rig.java` | per-slot `isPlaying`/`isPlaybackQueued`/`isStopQueued`, `playingStep` on every pool clip, `transport.playPosition` — all at `init()` (rule 13) |
| `RigConfig.java` / `UiPanel.java` / `UiHandlers.java` | `recordChars` knob, one pre-allocated record setting, `ui.get` (value **and length**) |
| `CoreHandlers.java` | `rig.stats.markedValues` corrected to 6 per slot |
| `brain/src/probes/e20a-launchopts.ts` | PART A autonomous + PART B ⚠ operator, listening |
| `brain/src/probes/e20b-duplicate.ts` | autonomous, silent, refuses rather than clears |
| `brain/src/probes/e20c-{server,annotations}.ts` | ARM A autonomous (no DAW) + ARM B ⚠ operator, in Claude Code |
| `brain/src/probes/e20d-docstate.ts` | `sweep` + `verify`, three ceilings |
| `wiremap.test.ts` | the `E20` case: named methods, contract unreachable |
| `regen-wire-golden.ts` | `addedInE16` frozen, `addedInE20` opened |

Golden: **140 methods**, `d8168372c04c1e07` (was 135, `f1c6401540eb9daa`).
Offline: **294 green**, and nothing in the contract moved.

## ⚠⚠ What the first live sitting cost, 2026-08-09 — and it was the APPARATUS twice

Recorded because both shapes recur, and because the first run of E20a produced a
confident, self-consistent matrix that refuted a design claim **which is in fact
true**.

1. ⚠⚠ **A pre-existing ONE-BAR clip was silently adopted as take B.** `ensureTake`
   created a clip only when the slot was empty. This file's own §"design decisions"
   entry 1 says a clip shorter than the launch grid makes the arms undecidable —
   the warning was written, then not enforced. ⇒ **Standing rule 1 governs the
   SETUP, not only the result**: the length is now read back through a cursor, a
   wrong clip is replaced, and `E20a-S1` refuses the probe rather than measuring.
2. ⚠⚠ **`ui.set` is ASYNCHRONOUS, and a one-shot readback faked a capacity
   ceiling.** A 4096-char write read back as exactly **1024** characters — the
   length of the value written immediately before it — while 8192 passed on either
   side. Recorded naively that is *"the setting truncates at 1024"*, a capacity
   finding that is entirely false; the tell was that a real 1024-char ceiling
   cannot then pass 8192.
   ⚠ **It is INTERMITTENT**, which makes it worse rather than milder: a re-run had
   every first read already correct. A one-shot readback is usually right and
   occasionally wrong — the hardest kind of wrong to notice.
   ⇒ Every write is now polled until it lands and the **settle time is reported**,
   because how long after writing the record a read can be trusted is a number
   D18d needs. Same family as E2's observer gotcha and E15-B/D's 120 ms grid
   settle: standing rule 1 says readback is the only truth, not that it is
   instantaneous.
3. **The on-grid trial was degenerate**: with take A synced and the switch on a bar
   line, all three candidate answers named the same step. ⇒ It now fires inside a
   window whose next bar line falls mid-clip. ⚠ A *trial* that cannot disagree with
   itself is the control problem one level up.

⚠ **The diagnostic is the transferable part** (`probe:e20a-diag`). One question —
does `Clip.playingStep()` track a launcher clip's playhead? — answered with a
per-cursor time series, which **vindicated the instrument** (a per-CLIP playhead,
−1 for the clip that is not playing) and caught the wrong clip length on the way.
Written before any conclusion was recorded, which is the whole point.

## ⚠ The design decisions inside the apparatus

Each of these is a place where the cheap version would have produced a
green result that meant nothing.

1. **A four-bar clip against a one-bar grid.** With a one-bar clip and
   `quantization: "1"`, the switch lands exactly where the loop restarts anyway —
   so `"continue_or_synced"` and `"from_start"` produce the *identical* result and
   the headline arm would pass for both. The clip has to be longer than the
   quantisation grid for "continue" to mean anything.
2. **Both quantisation arms fire deliberately MID-BAR.** A launch fired near a bar
   line lands near one whatever its quantisation, so the `"none"` control could
   pass the `"1"` assertion by luck — and a control that can accidentally agree
   with the experiment is not a control.
3. **The `from_start` control arm.** Same clips, same quantisation, same switch
   point, one word different. Without it, a non-zero `playingStep` proves only
   that `playingStep` is non-zero.
4. ⚠ **E20b reads the NEIGHBOUR, not the copy.** An append and an insert can put a
   clip in the same visible place; only what happened to the clip that was
   *already there* tells them apart — and clips have no identity in the API at all
   (E16l, 1968 members), so contents are the only handle.
5. **E20c's unannotated baseline is called first.** With only annotated tools, a
   host that prompts for everything is indistinguishable from one that reads the
   annotation.
6. **E20d measures the wire before the setting.** A setting limit read through a
   truncating wire is a wrong number, not a smaller one. And the payload carries a
   quote, a backslash, a **newline** (⚠ the bridge is newline-delimited) and a
   non-ASCII character, because a capacity measured with `'a'.repeat(n)` passes
   while the real record corrupts.
7. **`cursor.playState` is a new method, not three new fields.** `methodsHash` is
   over method NAMES, so a field added to an existing reply passes a stale
   handshake — the exact gap that cost a sitting and produced `deploy.ts`.

## Exit criteria

1. ● **MET** — `launchWithOptions` measured at two granularities (`"1"` 1567 ms,
   `"8"` 14266 ms) against a `"none"` control (121 ms, off the bar), with
   `isPlaybackQueued` observed rather than inferred.
2. ● **MET** — `"continue_or_synced"` has ⚠⚠ **a number**: take B enters where
   take A was, separated from the transport grid by 31 steps and from B's own last
   position by 17. ● And **the ear agrees** (`probe:e20a-ear`, master peak 84 so
   the refusal-on-silence guard passed rather than being skipped): landed cleanly
   on a bar line, came in part-way through, and *"is this the A/B you asked for in
   E16m?"* — operator, verbatim: **"Yes."** ⚠ The takes had to be rewritten as
   RISING lines first; at a constant pitch every bar sounded like every other and
   the question had no audible answer.
3. ● **MET** — `duplicateClip` lands in the next row down through **both** routes,
   carries its notes, fires a `channelId`-named FILL, and is selection-independent.
   ⚠⚠ The occupied-next-row verdict is **OVERWRITE**, fired no event, and becomes a
   precondition 3e must enforce.
4. ● **MET** — Claude Code prompts **identically for all four tools**, annotated or
   not, including the unannotated baseline, with no visible sign the annotations
   are read. ⚠ The grain it *does* gate on is the tool **NAME**, per project
   (*"don't ask again for this tool in this project"*). D20's seam stands; its
   stated reason was amended (D20 rev) and the per-name blanket grant recorded as
   its consequence.
5. ● **MET** — all three ceilings ● at **262144 chars**: the wire, the declared
   setting, and a full save plus application restart, byte for byte, 16.7 ms init.
   ⚠⚠ And the *drawable* ceiling is far below the storable one — interacting with
   the field at that size **hard-locked Bitwig** (force quit), with the operator
   reporting lag from 1024 chars up. ⇒ hidden at `init()`, built and re-probed the
   same day (`probe:e20d-hidden` H1/H2/H3, full size, 19 ms settle).
6. ● **MET** — `probe:hello` green against the redeployed extension with the deploy
   check reporting `fresh`; `npm run check` green.

## ● How it closed, 2026-08-09

All six criteria met. Two things landed that this session did not set out to do:

- ⚠⚠ **E20e — the bridge client corrupted any non-ASCII data**, at any size.
  `BridgeClient` decoded every TCP chunk independently, so a multi-byte character
  straddling a boundary became two replacement characters. Surfaced by E20d's
  ceiling arm as *"1 MB comes back two characters longer, intermittently"* and it
  was never about 1 MB. ⚠ **Standing rule 1 could not catch it** — a readback
  travels the same broken path as the write and agrees with itself. Fixed
  (`socket.setEncoding('utf8')`), 4 regression tests over a real loopback socket,
  verified in both directions by reintroducing the bug.
- ● **The init-time hide** for the record setting, built in `UiPanel`'s constructor
  where rule 13 already puts everything else — plus a refusal to create a record
  field that cannot be hidden, checked against an already-created setting *before*
  `getStringSetting` is called for the record, since a setting once created cannot
  be un-created through this API.

⚠ **Owed, found here and deliberately deferred** — the in-flight `connect()` race
(two concurrent first requests opening two sockets) was fixed in a separate commit
rather than folded in, because it was unrelated to the corruption and would have
made that diff unreviewable. ● Now closed.

## ⚠ What a ○ means here, stated in advance

Written down before the sitting so a negative is not quietly re-run until it
turns green (rule 10's habit, applied to our own expectations).

- **`destructiveHint` ignored by Claude Code** is the *expected* outcome, not a
  failed probe: the host gates on tool NAME. D20's seam survives — the
  destructive verbs live on separately-named tools — but its sentence needs
  amending from *"the host prompts because of the annotation"* to *"…because of
  the separate names"*. ⚠ **Proposed to the operator, never recorded.**
  ⇒ ● **This is what happened.** The expected ○ arrived, the amendment was put to
  the operator, and they recorded it as **D20 rev**. Worth noting that the outcome
  written down in advance is the one that occurred: the probe was not re-run until
  it agreed with the spec.
- **`duplicateClip` inserting rather than appending** would not kill the clip
  block; it would make minting a take a structural op, which means the geometry
  needs a pre-cleared row and every held address must be re-resolved after a mint
  (D6). Worth knowing before 3e builds on the other assumption.
- **A small doc-state ceiling** means D18d's record is a pointer or a rolling
  window rather than the whole log — a design input the operator owns, and one
  with a retention question attached (D17f died with the store).
- **`playingStep` never moving** would make the `"continue_or_synced"` claim
  unmeasurable by us; the probe REFUSES in that case rather than scoring the arm,
  because a PASS built on a value that never moves is worse than no result.

## Running order

1. `./gradlew copyExtension`, then ⚠ **reload the controller by hand** — a deploy
   is not a reload, and `build.gradle`'s comment about hot-reload is wrong
   (session 3 §Owed). Then `npm run probe:hello`, which now fails rather than
   warns on a stale extension.
2. `npm run probe:e20c` — needs no DAW at all. ● already green (7/7).
3. `npm run probe:e20a` (⚠ the transport rolls), then `npm run probe:e20b`
   (silent).
4. ⚠ Arrange `probe:e20a-ear` and E20c ARM B with the operator. Neither may be
   started opportunistically.
5. `npm run probe:e20d` last: its sweep reloads the extension repeatedly, and each
   reload mints a new `generation` — every mark taken before it is incomparable by
   design, which is session 3's nonce doing its job.

## ● CLOSED — the "1 MB bridge defect" was a UTF-8 bug in OUR client

Found by E20d's ceiling-1 arm as *"1 MB comes back two characters longer,
intermittently"*, and it was **never about 1 MB**. `BridgeClient` decoded every TCP
chunk independently (`data.toString('utf8')` per chunk), so a multi-byte character
straddling a boundary became two U+FFFD replacement characters — one character
silently becoming two.

⚠⚠ **Any non-ASCII data was corruptible at any size**; size only correlated because
small replies arrive in one chunk. ⚠ And **standing rule 1 could not catch it** — a
readback travels the same broken path as the write and agrees with itself.

● **Fixed** (`socket.setEncoding('utf8')`), with 4 regression tests over a real
loopback socket (`brain/src/client.test.ts`), **verified in both directions** by
reintroducing the bug. ⚠ Two of those tests were decorative until the harness was
made to wait between chunks — loopback coalesces small writes, so the split never
happened and they passed with the bug present. Live: **1 MB now 3/3 exact.**
Written up as `FINDINGS.md` **E20e**.

⚠ **Owed, found on the way and deliberately NOT fixed here**: two concurrent first
requests both call `connect()`, opening two sockets and assigning ids in whichever
order the connects resolve. An in-flight connect is not memoised. Unrelated to the
corruption, and folding it in would have made that diff unreviewable.

## Risks

- **Init-cost regression.** 768 more `markInterested` calls at the default rig.
  `rig.stats` reports `initMicros` beside a corrected `markedValues`; report the
  delta rather than assuming it away (E5).
- **The transport rolls through all of E20a**, and a launch starts it by itself
  (E16w). Every exit path stops it; the ear arm must be arranged, not sprung.
- **E20b touches a shared column.** It claims only rows it has verified are empty,
  deletes only what it created, and aborts without deleting if anything moved
  outside its region.
- **A leftover MCP server.** E20c ARM B registers a server advertising a `destroy`
  tool. ⚠ De-register it — that is exactly the confused-agent surface D20 bounds.
