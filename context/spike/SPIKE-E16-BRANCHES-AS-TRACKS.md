---
title: ghostnote mini-spike — E16: branches as duplicated tracks
status: ROWS A–G MEASURED, gate open — no kill criterion fired. E2 ● (mute cuts
        sends), C5 ● (duplication glitches), group creation ○ (human-only).
        Still nothing in DECISIONS: §8 is untouched and remains the user's
        (standing rule 10). Evidence: spike/FINDINGS.md "E16 rows A–C" and
        "E16 rows D–G" (2026-07-26).
updated: 2026-07-26
parent: ../SPIKE_PLAN.md
evidence it builds on: E1, E2c, E2f, E3, E5, E5c, E8, E11g, E14-G · D5, D6, D7, D10, D14, D16, D17
decides: whether Phase 1's take model gains a second, coarser layer — and whether
         D17b/D17c survive in their current form
---

# E16 — branches as duplicated tracks

> **The idea.** A branch point **duplicates the tracks an operation is about to
> touch**, and every write lands on the duplicate. The original is never edited.
> Reverting is deleting a track; A/B is muting one. Both live in the project
> simultaneously, so comparison happens **while the transport is running**.

⚠ **This document records a design conversation, not a finding.** The whole idea
rests on one API call nobody has probed. Read §4 before §3 — the kill criteria
are cheap to reach and the spike should end the moment one fires.

> **STATUS 2026-07-26 (second sitting) — rows D–G are measured too. Evidence:
> `FINDINGS.md` "E16 rows D–G".**
> **E2 ●** mute cuts sends in BOTH pre- and post-fader modes, so A/B by mute is
> audibly correct in the wet path — the objection most likely to kill the
> ergonomics does not hold. **E1 ●** click-free and "instant" by ear (the
> latency *number* is below the VU meter's resolution and is not quotable).
> **E5**: route A leaves ~307–386 ms of doubled mix; **route B "born muted" ●** —
> a copy inherits `mute=true`, trading the doubling for a ~321 ms gap.
> **⚠ C5 ●** every duplication audibly glitches the transport (5/5 vs 0/3
> placebo). **E3 ●** groups are duplicable *with* their children, a branch of an
> in-group track lands inside, and deleting a group cascades — but group
> *creation* is ○ (see below) and **`moveTracks` is a silent no-op**, so row A's
> "placement is not ours" now stands on two routes.
> **⚠ Collapsing a group hides its children from the bank** — `itemCount` drops
> and `resolveByChannelId` returns `found:false`, identical to a deleted track,
> while the child is still audible. ⚠ **First written up as a cross-cutting
> hazard; that framing is RETRACTED** — the cause is our own bank filter, and
> `setContentFilter(ALL_CHANNELS)` fixes it at runtime. What remains is that the
> DEFAULT filter is the dangerous one, `itemCount()` inherits it (standing rule
> 5 needs `ALL_CHANNELS`), and the extra visible tracks cost bank window (D4,
> unmeasured under that filter).
> **⚠ Group creation is ○ and now on live evidence:** `createParentTrack` throws
> "This can only be called during driver initialization" and creates nothing —
> so **only a human can bring a group into existence.** Named actions exist
> (`Create Group Track`, `Group`) and remain forbidden by standing rule 6.
>
> **§8's nine decisions remain open and remain the user's**, now with four more
> inputs: duplication always glitches (C5), A/B by mute is audibly correct (E2),
> "born muted" exists as a route (E5), and **§8.5's group topology requires a
> HUMAN to create every group** — we can duplicate, nest into, collapse and
> delete them, but never make one.
>
> **STATUS 2026-07-26 (first sitting) — the gate rows ran; full evidence in `FINDINGS.md`.**
> **A ●** (three of four routes duplicate a top-level track; `copyTracks` is a
> silent no-op, so we cannot choose where a copy lands). **A4 ●** (fresh
> `channelId`, lands adjacent, ⚠ carries the SAME NAME). **B ●** except **B3 ◐**
> — opaque **CLAP and VST3** state both come across (2193 params, identical
> values), modulator *pages* come across, modulator *liveness* is unproven
> because the fixture showed none on either side. **C ●**: 330–520 ms for a
> two-Zebra3 track, ≈0.6 pp engine CPU per branch, freed on delete.
> **D1/D2 ●, F1 ●, G1 ●.**
>
> ⚠ **E5 is answered and it is the bad answer:** a branch is **audible the
> instant it exists**, three branches sounded **simultaneously**, and nothing
> pre-mutes them. §6.2 is measured, not hypothetical.
>
> **Still unmeasured:** C4, C5, D3, D4, E1–E4, F2 (beyond naming), F3, G2, G3.
> **§8's nine decisions are all still open**, which is unchanged by any of this.

---

## 1. Why this is on the table

Two problems with the direct-write model as built (Phase 1 sessions 1–2):

1. **The write path has soft edges.** Positional addressing for everything but
   tracks (D16a); `none`-fidelity structural ops with no inverse (D16d);
   readback that disagrees with the request as normal behaviour (E2 gain, E8-E
   truncation, E15-E pressure). Each is handled honestly, but they compound as
   later phases add object classes, and Phases 4–5 are made almost entirely of
   the object classes we handle worst.
2. **A/B has latency, and the latency is in the wrong place.** D5 calls A/B
   comparison *the core verb* and says you evaluate by listening. Today an
   audition round-trip is a staged batch — D10 measured N clips carrying
   expression at 2N stages plus N × 144ms of grid-change settling — and worse
   than the number is the shape: **it interrupts what you are hearing.** You
   cannot compare two grooves while the transport rolls.

---

## 2. What the idea does and does not fix

### It fixes — and one of these is bigger than it first looks

- **⚠ The revert-fidelity ceiling, categorically.** Today `device.insert`,
  `track.create` and `scene.create` are `unrevertable`, and `clip.delete` is
  `none` because a deleted clip has no readback that could recreate it (D16d).
  Those are not edge cases — they are the object classes of Phases 4 and 5. If a
  branch is a whole track, revert is *delete the duplicate*, which is **exact
  regardless of what happened inside it**. An open-ended set of "we cannot undo
  this" collapses into one uniform lossless operation. This is the strongest
  argument for the idea and it is stronger than the A/B argument.
- **A/B while the transport rolls.** Mute toggle instead of a staged batch.
- **⚠ It may retire D14's blocker on the core verb.** A/B moved to the Phase-3
  web view because the controller pane closes on click-away (E14). If A/B is
  **mute state**, the human does it in Bitwig's own mixer with no ghostnote UI at
  all. That would move D5's core verb from "blocked on a UI we have not built"
  to "needs no UI" — which matters because `PHASE-1-ENGINE.md` currently ships
  the take store with its motivating verb unexercised by any human.
- **Partial restoration of the preview §8a gave up.** INITIAL_PROMPT §8a: removing
  the approval gate removes the mutation-free preview, *"so undo becomes
  load-bearing infrastructure."* Branch-on-duplicate is not mutation-free, but it
  is **original-preserving** — a batch that goes wrong damages a copy. Undo stops
  being the only safety net.
- **Free diff rendering.** Two tracks side by side, drawn by Bitwig. The
  `PROJECT_PLAN.md` §3 corollary ("their piano roll is better than ours"),
  extended to comparison.
- **Tidier undo history.** `duplicateObjects(undoName, …)` groups into one named
  entry — ● confirmed live on clips (E14-G). A branch point would be a single
  undo step, which is better than what note writes do today (E3).

### It does not fix

⚠ **The motivating framing conflates two problems, and this addresses only one.**

Writing into a duplicated track uses **exactly the same write path**. Pointing at
an empty slot still lands on the wrong clip (E2). Scene deletion still compacts
rows and stales every scene-relative address (E3). Same-pitch notes still truncate
each other (E8-E). Gain still reads back doubled (E2). The resolve guard, the
stash, the verify read and the disagreement report are all still load-bearing and
unchanged.

**The fidelity of *undo* improves dramatically. The fidelity of *writing* does not
improve at all.**

### It makes one thing worse

A duplicate mints a fresh `channelId` (expected, per E2f semantics — see row A4),
so every address in a take becomes **branch-scoped**. "Apply this take's change to
that branch" then needs a track-identity mapping across branches: a side table of
the kind **D16a explicitly rejected** for clips. It is more tractable than the clip
case — tracks are durable and a deleted one resolves as a clean tombstone (E2f) —
but it is a second source of truth, and cross-branch application gets *harder*, not
easier.

---

## 3. The framing that must survive into any design

### 3a. ⚠ A layer over the engine, not a replacement for it

The pitch reads as "replace direct-write with track branches." That does not
survive contact:

- **The stash still has to exist.** The moment a branch track is deleted — by the
  user, by retention, by resolving a branch — the take's content is gone unless
  the store independently holds it.
- **Partial revert cannot be expressed by deleting a track.** "Revert just the
  snare from that batch" is D5's named verb and it is already built (D17d).

So the honest version is: **track-branching is an audition and coarse-revert layer
above the existing engine, and the engine does not get to shrink.** Both run.
That is more machinery, not less — fine, but it should be priced in rather than
counted as simplification.

### 3b. ⚠ Per-track branches do not compose into a project-wide state

**The deepest design problem, and the one most likely to eat a week.**

An agent batch routinely touches several tracks. A branch point duplicates that
set. A later batch touches a different, overlapping set — and now "which version
of Bass pairs with which version of Drums" is a real question the model must
answer. The store as built has exactly one head and one unambiguous notion of *the
project state at take N* (D17b/D17c). Per-track branching naturally produces
**per-track heads**.

Two exits, both with a cost:

| exit | cost |
|---|---|
| Materialize every session-relevant track at every branch point | expensive, and §5's CPU multiplication makes it worse |
| **Accept per-track branches, give up "the project state at take N"** | the take graph's central abstraction changes |

**The user's stated preference is the second.** ⚠ That is a change to the thing
`brain/src/store/graph.ts` is built around, and this document does not pretend
otherwise — but see §7 for why it is likely a generalization rather than a rewrite.

---

## 4. Kill criteria — check these first, stop early

Any one of these ends the spike and the idea:

1. **A top-level track cannot be duplicated at all** (row A) → dead, no
   workaround. Rebuilding a track by hand would be `none`-fidelity in exactly the
   way the idea exists to avoid.
2. **Duplication does not carry opaque plugin state** (row B2) → dead for any
   project with VSTs, which is the target use.
3. **Duplication of a realistic track costs more than ~5 s** (row C2) → the
   agent-chat latency budget the idea was premised on is gone.
4. **CPU multiplies such that 2 branches make a normal project unusable**
   (row C3) → the branch ceiling is below the useful minimum.

⚠ Rows A–C are the gate. Do not build any of §7 before they return ●.

---

## 5. E16 — the experiment matrix

Format follows `SPIKE_PLAN.md` §4: **Q / Method / Settles.** Standing rule 10
applies throughout — **grep `member-search-index.js` across all API versions and
walk supertypes before recording any ○.** Standing rule 3c applies to every call:
validate inputs before calling, because a handler's `try/catch` is not a safety
net (E14-A1 crashed Bitwig from a deferred throw).

### Row A — does track duplication exist?

| | Q | Settles |
|---|---|---|
| A1 | Is a top-level `Track` accepted by `ControllerHost.duplicateObjects(undoName, …)`? E14-G proved it on **clips**; whether `Track` is a `DuplicableObject` is a doc-pass question, not a measured one. | the entire idea |
| A2 | Does any other route exist — a `Track`-side duplicate, or something reachable from `TrackBank`? The wire surface already carries `layer.duplicate`, `layer.duplicateChannel`, `device.duplicate`, `drumpad.duplicate`, which raises the prior that *channel* duplication exists in some form. | fallback if A1 is ○ |
| A3 | Complete-recall grep for `duplicate` across **all** API versions + supertype walk, before recording anything. | standing rule 10 |
| A4 | Does the duplicate mint a **new `channelId`**, and **where does it land**? ⚠ E2c found `createInstrumentTrack(position)` does **not** honour positions, so "adjacent" is an assumption — create, then diff the bank by `channelId`, never assume a requested position. | addressing, §2's branch-scoping problem |

**Method:** extend a probe on the E14-G pattern. One fixture track, duplicate it,
`rig.scanTracks` before and after, diff by `channelId`.

### Row B — does it carry state?

| | Q | Settles |
|---|---|---|
| B1 | Devices present, in order, with **scalar param values** intact? | Phase 4 viability |
| B2 | ⚠ **Opaque VST3/CLAP plugin state** — a Zebra with a real loaded patch, verified by remote-page readback, not by the device merely existing. | kill criterion 2 |
| B3 | ⚠ **D1's surgically-authored modulators.** E11g proved they survive save → restart; duplication is a *different* test. Verify by remote-page readback + the E7 modulation-liveness oracle (a base value holding still while `modulatedValue` sweeps). | Phase 5, the crown jewel |
| B4 | All clips in all scenes, with note content and expression? Spot-check against the E2 21-property sweep. | Phase 1–2 viability |
| B5 | Mixer state: volume, pan, **sends**, routing, mute/solo, colour, group membership. | §6's audio-correctness problem |

**Method:** build a fixture track that is deliberately hard — 2 native devices, 1
VST3, 1 CLAP, one surgically-authored modulator, clips in 3 scenes with expression
— duplicate it, and read every property back **through a different handle than the
one that made it** (standing rule 3a; two spike findings were wrong for exactly
this reason).

### Row C — what does it cost?

| | Q | Settles |
|---|---|---|
| C1 | Latency: empty track. | baseline |
| C2 | ⚠ Latency: the row-B fixture — 2–3 large VSTs, **not** an empty track. ⚠ E5's scale numbers are from empty tracks and `PROJECT_PLAN.md` §7 flags device-side scale as explicitly **unmeasured**. | kill criterion 3 |
| C3 | ⚠ **CPU delta per duplicate**, and how many duplicates before a normal project degrades. Three branches of a Zebra track is three Zebra instances — this is the real ceiling and it is far lower than the 256-track bank window (D7). | kill criterion 4 |
| C4 | Project **file size** delta per branch, and save-time delta. Branches are saved with the project. | practicality on sample-heavy projects |
| C5 | Does duplication stall the **control-surface thread** or glitch **audio** while the transport is rolling? | whether a branch point can happen mid-session at all |

**Method:** the E5 harness pattern — config-driven, repeated, with the
control-surface tick watched throughout. Measure with the transport **rolling**,
because that is when it will actually be used.

### Row D — is the result addressable?

| | Q | Settles |
|---|---|---|
| D1 | Does the new `channelId` resolve, survive save → quit → reopen, and tombstone cleanly on delete (the E2f properties)? | can a branch be a durable store key |
| D2 | Does track duplication **bump the scene epoch** or otherwise stale held addresses? ⚠ `write-set.ts` currently asserts that track create/delete "degrades nothing" because we store `channelId` and never a bank index — confirm that holds for duplication too. | D16a, fidelity labelling |
| D3 | Cursor pool behaviour: 8 pinned cursors (D7) across original + branch tracks. Does duplication invalidate a pin? D6 already says re-point after **any** structural op — confirm the refusal, do not assume it. | E1/D6 |
| D4 | How close does branching bring a normal project to the **bank-window refusal** (E5, standing rule 5)? | scale policy |

### Row E — can we A/B it audibly?

| | Q | Settles |
|---|---|---|
| E1 | Mute/unmute latency while the transport rolls: is it click-free and is it *musically* instant? | the whole A/B claim |
| E2 | ⚠ Does mute cut **sends**? A branch doubles the reverb-bus contribution, and pre- vs post-fader sends behave differently. An audibly wrong mix during comparison would defeat the purpose. | audio correctness |
| E3 | Can we **create a group** and is a group track itself duplicable? Can we duplicate *into* a group? | the proposed management topology |
| E4 | Is there a routing/selector topology that gives the human a single control, and can the extension drive it? (Explicitly **not** a named action — standing rule 6 / D13 rules those out.) | human ergonomics |
| E5 | ⚠ Is there any window in which **both branches are audible**? Any moment with both unmuted is a wrong mix in the user's ears, live. Can mute be applied before the duplicate becomes audible, or is there an unavoidable gap? | whether this is usable at all mid-session |

### Row F — does the human survive it?

| | Q | Settles |
|---|---|---|
| F1 | Undo history: does duplication group into **one named entry** as `duplicateObjects` did for clips (E14-G)? | user-facing tidiness |
| F2 | What does the mixer look like at 3 branches? Naming, ordering, colour, clutter. | ⚠ the project becomes shared mutable state between us and the human — branch tracks sit where they can be renamed, reordered or casually deleted |
| F3 | If the user **deletes or renames a branch track**, can we detect it? (Resolve returns a clean tombstone, E2f — but detection needs the daemon's observers, session 3.) | §8g cuts both ways: the log is human-owned, and now its contents are destroyable by accident |
| F4 | ⚠ Does launching a **scene** fire every branch's clip? Scenes are global rows, so a branch track's clips sit in the same scene. Convenient for A/B, strange for ordinary use. | launcher semantics |

### Row G — deletion, the revert path

| | Q | Settles |
|---|---|---|
| G1 | Delete a branch track: clean, one undo entry, CPU actually freed? | revert-by-delete |
| G2 | Does deleting a track re-index the ones after it, and does anything we hold go stale? (E3 says tracks re-index; confirm nothing depends on it.) | D6 |
| G3 | Can a branch be **collapsed into** the original — i.e. promote a branch to be the trunk — without a rebuild? | resolving a session |

---

## 6. New challenges the design will have to answer

Ranked by how likely each is to bite, from the discussion this document records:

1. **⚠ CPU and voice count multiply per branch** (row C3). The real scaling
   ceiling, far below the bank window. Likely needs a **refusal** in the spirit of
   standing rule 5 — a branch budget that fails loud rather than a knob.
2. **⚠ A duplicated track makes sound immediately** (rows E2/E5). Sends make it
   worse. There may be no window in which the mix is correct.
3. **The project becomes shared mutable state** (row F). Our bookkeeping is
   visible in the human's mixer and destroyable by them. Groups help with clutter
   but are themselves a structural change to *their* arrangement.
4. **Per-track heads do not compose** (§3b). The design problem, not a measurement.
5. **Branch-scoped addresses need a cross-branch identity map** (§2), which is the
   shape D16a rejected once already.
6. **Retention gains teeth.** Pruning a take is currently deleting a JSON file.
   Pruning a *branch* deletes audible material and frees CPU — so retention
   becomes a user-visible, audible act, and D17f's "only childless takes may go"
   protections need re-derivation.
7. **Scene-launch semantics** (row F4).
8. **Cursor pool pressure** (row D3).

---

## 7. If it works: potential changes to the plan

⚠ Nothing below is a commitment. It is the shape of the change, so the cost is
visible at review time.

### What survives untouched

**All of Phase 1 session 1.** The write path is unchanged: resolve → stash →
apply → verify → report, with every E2/E3/E5/E8 guard still load-bearing. D16's
five sub-decisions all stand. **Nothing in `brain/src/engine/` is invalidated.**

**Most of session 2.** `format.ts` (the record, atomic writes), `slice.ts`
(partial revert by `addressKey`), `errors.ts`, the `TakeLog`/`TakeWriter`
privilege split, and retention's mechanics are all **topology-independent**.
D17a (project key), D17d (slicing), D17e (the pointer argument — which gets
*stronger*, since the project would then literally contain the branches) and
D17g (the split) are unaffected.

### What changes

| what | how |
|---|---|
| `graph.ts`'s single global head | becomes a head **per branch lineage**. ⚠ Likely a **generalization rather than a rewrite**: `stateAlong` already operates over addresses, so partitioning takes per track makes the graph a *forest* and the same walk runs over each disconnected component. Verify this before assuming it. |
| **D17b** (branching = path walk) | probably survives, scoped per lineage rather than project-wide |
| **D17c** (`lands: take \| new-state`) | ⚠ most at risk. "Navigation moves the head" may become "navigation re-mutes", which is a different act with different failure modes |
| a **materialization** concept | new: which takes are currently live as tracks, versus recorded only as a stash |
| the branch ↔ track identity map | new, and it is a second source of truth (§2) |
| retention | new: pruning is now audible and CPU-relevant (§6.6) |
| **D14** | possibly amended — A/B may no longer need the Phase-3 web view (§2) |

### Where it would land in the plan

Most likely a **new Phase-1 session between the store and the daemon**, since the
daemon has to own materialization. Alternatively a Phase-2 addition if E16 shows
it is only worth having once there is real musical material to compare. That is a
decision, not a foregone conclusion — see §8.

---

## 8. ⚠ Decisions owed after review — even if every row returns ●

A green E16 does not settle the design. These stay open and are the user's:

1. **Layer or replacement?** §3a argues *layer*, and that the stash is mandatory
   regardless. Accepting that means accepting that the system gets bigger.
2. **Per-track heads, or materialize everything at each branch point?** §3b. The
   stated preference is per-track; this is where it gets ratified or reconsidered
   with the row-C numbers in hand.
3. **Does "the project state at take N" survive in any form?** If not, say so
   explicitly and amend D17b/D17c rather than letting the two models coexist
   silently — the second source of truth is the failure class this project exists
   to prevent.
4. **The branch ceiling and what happens at it.** A loud refusal (standing rule 5's
   posture) or a soft warning? Derived from C3's measured CPU.
5. **Group topology.** Do we create groups for branch management, and is
   restructuring the human's arrangement acceptable?
6. **Branch lifetime.** Who deletes a branch and when. Retention is now audible.
7. **Naming and visibility convention** for branch tracks in the human's mixer.
8. **Does D14 get amended?** If A/B works in Bitwig's own mixer, the Phase-3
   pull-forward may be unnecessary — which changes what Phase 3 is *for*.
9. **Where this lands in the plan**, and whether Phase 1 sessions 3–5 re-order.

---

## 9. Cost of finding out

Rows A–C are **one sitting** and they are the gate. Row A alone may end it. The
fixture for row B is the most work — a deliberately hard track with a VST3, a
CLAP and a surgically-authored modulator — but that fixture is reusable for Phase
4 and Phase 5 regardless of the outcome, so it is not wasted even if the idea
dies.

⚠ **Nothing from this document goes into `DECISIONS.md` until measured.** Standing
rule 10 exists because five-plus false capability verdicts in the spike came from
skipping exactly this step, and D15's first rule is that readback is the only
truth.
