---
id: E16
kind: evidence
state: active
source: FINDINGS.md
---

# E16 rows D–G — A/B by mute is audibly CORRECT, but duplication glitches and a collapsed group hides our own branches [K] (2026-07-26)

**Verdict: ● the row that mattered most goes the design's way — muting a branch
cuts its sends, pre- and post-fader alike, so A/B by mute is correct in the wet
path and not just the dry one.** Mute toggling is click-free and reads as
musically instant to the user. Two costs are now measured rather than assumed:
**every duplication audibly glitches the transport** (5/5 against 0/3 placebo),
and **collapsing a group makes its children unaddressable in a way that is
indistinguishable from deletion** — which reaches past E16 into D1's tombstone
semantics and standing rule 5. Groups are duplicable with their children and
delete as one act. Placement is confirmed *not* ours by a second route.
Probes: `e16d-sends.ts`, `e16e-mute.ts`, `e16f-groups.ts`, `e16g-glitch.ts`;
wire surface gained `Send.sendMode()`, `isGroupExpanded`, `branch.moveTrack`.

### E2 — does mute cut SENDS? ● yes, in BOTH fader modes

The highest-value open row, and it does not fire. With the sender **muted** and
its send swept across the full range:

| mode | send 0.00 | 0.50 | 1.00 | sender's own (pre-mute) meter |
|---|---|---|---|---|
| POST | FX 0 / master 0 | 0 / 0 | 0 / 0 | 56 — still playing |
| PRE | 0 / 0 | 0 / 0 | 0 / 0 | 55–57 — still playing |

Positive control, **unmuted**: PRE @0.25 → FX 19, PRE @1.00 → FX 74. The axis is
live, so the flat muted line is not a dead knob. Single-sender and
isolated-branch phases agree (FX 38→1 POST, 51→2 PRE, against a rolling floor
of 1). **A branch's reverb contribution goes away when you mute it.**

⚠ **`Send.sendMode()` had to be added to measure this at all** — `isPreFader()`
is read-only, so PRE could not otherwise be driven. `AUTO` resolves to POST for
an ordinary FX track; the probe asserts both the setting and Bitwig's resolution
of it.

⚠ **NOT measured: whether the return DOUBLES with two branches.** The same
condition read 52 and 40 in different phases — ±12 on a 0-127 peak-hold over a
3-note loop whose copies are not phase-aligned. The effect is smaller than the
variance, so the branch was isolated and the binary question asked instead.
Any "it doubled" from those numbers would be reading noise. A level claim needs
a better instrument than a peak-hold.

### E1 — A/B by mute ● usable; the latency NUMBER is below the instrument

The human's ear is the finding; the meter contributed nothing.

- **click-free ●** — *"N"* to clicks or pops across 16 toggles
- **musically instant ●** — *"instant - unsure about quantized to the beat as I
  didn't think to listen to that (and a quicker rhythm would help)"*
- **usable as the A/B gesture ●** — *"Yes, usable. Clicks, pops, glitches, and
  lag would make it distracting, but none of those happened"*
- ⚠ **latency: ◐ unresolvable.** Unmute → first signal on master, median 105ms
  (min 57), which is bounded by the VU observer's own reporting period, not by
  mute. The mute direction measured 3371ms — that is the meter's **peak-decay
  ballistic**, and the control proves it: all five control samples came back at
  exactly 3000ms, the `pollUntil` TIMEOUT, i.e. an unmuted track never touches
  the floor by itself at all. The guard fired and said "quote unmute only".

### E5 — the window, and a route with no doubling in it

| route | measured |
|---|---|
| A "mute after" | copy visible **260–314ms**, muted **47–50ms** later ⇒ **~307–386ms** of doubled mix |
| B "born muted" | source silent **321ms**; ● the copy **inherits `mute=true`** and is born silent |

⚠ **A branch is audible the instant it exists, with no clip ever launched on
it** — confirmed with a hold armed *after* the duplicate (56 on its own meter).
Row A–C's E5 stands.

**Coexistence is plainly audible; the 307ms transient is not.** The user heard
*"alternating states of single mix and doubled mix roughly equal in length
cycling about 3-4 times"* — that is the steady-state phase (master 56→68,
delta 12; independently 61→75, delta 14, non-overlapping spreads). But asked
what they heard at the branch point itself, the honest answer was *"I don't know
when the branch was created exactly."* So the hazard is **coexistence, not the
window**, and route B removes coexistence entirely at the cost of a gap.

§8 preference, recorded verbatim and **not** treated as a decision: *"probably a
gap, but that's not what I heard this time around."*

### C5 — ⚠ duplication GLITCHES the audio ● (5/5 vs 0/3 placebo)

The first attempt at this row was unanswerable and the user said so: *"Needs a
more focused test with a clear signal of when that happens."* Rebuilt as
countdown-marked trials, one question each, asked immediately — **and with
placebo trials that count down to NOW and do nothing.**

| | glitch reported | "louder/thicker" |
|---|---|---|
| duplicated (5) | **5/5** | 5/5 |
| placebo (3) | **0/3** | 0/3 |

Perfect discrimination. ⚠ The load-bearing datum is **trial 5: a clean "no"
immediately after four consecutive glitchy trials** — that is what rules out
expectation bias, and no raw count could have. One trial drew *"this one dropped
out slightly instead of just glitching"*.

⚠ **The "louder" column does NOT re-measure E5's 307ms window.** The copy stays
unmuted for the full 2.5s judgement window here, so that column re-confirms
2.5s of coexistence, which was already known. Only the glitch column is about
the duplication instant.

**C5 is therefore a real cost of a mid-session branch point**, and it lands on
top of route A's doubled window or route B's gap — the glitch happens either way.

### E3 / E4 — groups ●, with one hazard that outgrows this row

| | result |
|---|---|
| create a group, TYPED api | ○ **confirmed by live probe** — the one candidate, `createParentTrack`, THROWS "This can only be called during driver initialization" |
| create a group, NAMED ACTION | ● exists: `Create Group Track` ("Add Group Track", Project) and `Group`/`Ungroup` (Editing) — forbidden by standing rule 6 / D13, and `Group` acts on the SELECTION our own addressing sets, which is the mechanism that made 7 orphan duplicates in E6 |
| duplicate a group | ● adds `[Group 8, gn-E16]` — **children come with it** |
| is the copy's child really nested | ● proved by the collapse oracle, not by position |
| duplicate a track *inside* a group | ● the copy lands **inside** — the only route to "branch into a group" |
| delete a group | ● **cascades to its children**; revert-by-delete works on a whole group in one act |
| `isGroupExpanded` | ● drivable and reversible |
| `InsertionPoint.moveTracks` | ○ **silent no-op** |

⚠ **Row E3's group-creation ○ was first recorded from a DOC PASS, withdrawn,
and has now been re-established by live probe.** The original basis was a
member-index sweep plus a reading of `Track.createParentTrack(int,int)`'s
javadoc — "Creates an object that represent[s] the parent track" — which reads
like an accessor. Standing rule 10 forbids exactly that inference, and the same
sweep also failed to note that named actions for grouping exist.

`gregrossdev/bitwig-extensions` (`gig-maestro`) disputed it in effect: its
`track/createGroup` RPC is that call on a CursorTrack, with the design note *"the
only way to create a group is Track.createParentTrack(...), which creates a
parent group above the current track."*

**Probed live (`e16i`): the call THROWS `This can only be called during driver
initialization`, and no group appears.** Three independent legs now agree on the
accessor reading, where before there was only the javadoc:

1. the javadoc's own wording ("creates an OBJECT that represents")
2. ⚠ the runtime guard is the standard **allocation** guard — the same sentence
   rule 13 was derived from (`getDocumentState`, `host.createBitmap`, cursor
   pools, device handles)
3. document-mutating calls in this API are **not** init-guarded —
   `duplicateObject`, `deleteObject` and `insert*` all work fine at runtime

⚠ **So `gig-maestro`'s `track/createGroup` cannot work as shipped** — it calls an
init-only method from a runtime RPC handler. Its test suite passes because the
only test is `verify(mockCursorTrack).createParentTrack(4, 5)`: an assertion that
the call was ISSUED. **This is the clearest external evidence the spike has for
its own standing rules** — mock-verified capability claims survive CI and fail on
contact, which is why standing rule 1 says readback is the only truth and why
E4c's "a supertype method is a claim, not a capability" keeps being worth
re-applying. Their repository remains useful as a LEAD GENERATOR (it is what
reopened this row, correctly) and unusable as evidence.

⚠ **NOT probed: what `createParentTrack` does when called AT init.** It could
only ever be an accessor for a parent that already exists, and even if it did
create, an init-only call cannot serve on-demand branch management — so it
cannot change E16's answer and was not worth a fourth Bitwig restart.

**Consequence for §8's decision 5:** a group topology is available, but **only a
human can bring a group into existence.** We can duplicate one (with children),
duplicate into one, collapse one and delete one — we cannot create one.

⚠ **`moveTracks` is a no-op, so row A's "placement is not ours to choose" now
rests on TWO independent `InsertionPoint` routes** rather than the single
`copyTracks` mechanism it was recorded from. Duplicate-then-move does not exist.
Placement is only ever "adjacent to the source".

### ⚠ A collapsed group hides our branches — but that is OUR BANK, not Bitwig

⚠ **This was first written up as an inherent property of the flat bank and a
cross-cutting hazard. That framing was wrong and is retracted.** The behaviour
is real and reproduces; the cause is a bank we constructed with the wrong
content filter, and it is fixable at runtime.

Under the filter the legacy `createTrackBank(tracks, sends, scenes, flat)` gives
us, collapsing a group removes its children from the bank entirely:

| while collapsed | |
|---|---|
| `track.list` count / **`itemCount`** | 10 → **9** (both) |
| `track.resolveByChannelId` | **`found:false`** — identical to a deleted track |
| `branch.vu` | row absent entirely |
| master meter | **58 — still sounding** |
| on expand | fully restored, `channelId` intact |

**The fix: `TrackBank.setContentFilter(ALL_CHANNELS)`, and it works AT RUNTIME.**
With the group still collapsed, the count went 9 → 10 and the hidden child
resolved again. The enum is explicit: `ALL_CHANNELS` = "include all tracks, even
the ones that are not visible in the mixer"; `ALL_VISIBLE_CHANNELS` (what the
legacy constructor gives) skips whatever the human has folded.

⚠ **`setContentFilter` is a genuine RUNTIME setter** — a real exception to
standing rule 13, which is otherwise near-universal. Worth remembering as a
counter-example when reasoning about what must be allocated at `init()`.

What survives from the original write-up, as a caution rather than a hazard:

1. **The default is the dangerous one.** A bank built the obvious way silently
   loses folded tracks, and `found:false` then does not distinguish "deleted"
   from "folded". Anything reading a tombstone as a deletion (D1/E2f, F3) is
   wrong unless the bank is on `ALL_CHANNELS`.
2. **`itemCount()` inherits the filter.** Standing rule 5 leans on it reporting
   "the PROJECT total" (E15-A); under `ALL_VISIBLE_CHANNELS` it reports the
   visible total. The rule is implementable, but only on the right filter.
3. ⚠ **`ALL_CHANNELS` is not free and is UNMEASURED.** Folded children now
   occupy bank slots, so a grouped project consumes the 16-slot window faster —
   which is D4's question and it has not been asked with this filter on.
   Independently corroborated by the Bitwig scripting community: *"folded groups
   are hidden from trackbanks when you try to get a flat list of the channel
   list"*.

### C4 — project size ◐ (baseline only)

Saved with the fixture and **0 branches: 385,619 bytes, ~1.5s save** (user
reported, "about average"). The pre-fixture project was 340,354 bytes, so
`gn-E16` — two Zebra3s and a Polysynth — costs ~45KB. **Per-branch delta is NOT
measured**; it needs a second human `⌘S` with branches live.

### ⚠ Six method traps, every one of which produced a false result first

1. **`addVuMeterObserver` is PRE-MUTE.** A muted track reports 55–58 while
   master reads 2. The oracle the E16 plan nominated for rows E1/E2/E5 **cannot
   see mute at all**. `isActivated(false)` DOES read 0, so mute and deactivate
   sit on opposite sides of the meter tap. Every audibility verdict must read
   the FX return or the MASTER, never the sender's own strip.
2. ⚠ **`vuHold` is BANK-INDEXED and goes stale across a structural change** —
   `Rig.java` says so, and row E5's first run did it anyway. Proved
   unambiguously: FX 1 had accumulated **38**, a copy landed on FX 1's slot, and
   the copy's "peak" came back as exactly **38**. A hold is only attributable if
   it is armed AFTER the structural change. ~~*Recommended extension-side fix,
   not yet made: zero a slot's hold when the `channelId` at that index changes,
   so the value self-invalidates. Deferred because it is Java and costs a
   restart.*~~
   > ● **THE FIX IS IN, noted 2026-07-30.** `Rig.vuIdentity[]` exists and
   > `BranchHandlers.vu()` zeroes `vuHold`/`vuNow` and reports
   > `identityChanged: true` when the `channelId` at a slot changes. Recorded
   > because the "not yet made" above is now stale and would otherwise send
   > someone to re-do it. ⚠ The *trap* still stands — a hold armed before a
   > structural change is still unattributable — the value now merely
   > self-invalidates loudly instead of handing back a plausible lie.
3. **A short settle after a mute measures note TAILS.** The window straight
   after a mute read FX 16 / master 26; the next window, identical state, read
   1 / 2. Settle ~3s before arming any peak-hold.
4. **`track.delete` needs POLL-verification, not a fixed wait.** A 400ms wait
   between deletes mis-targeted the next one and removed an unrelated track as
   collateral — G2's re-indexing, live.
5. **`ask()` on a non-TTY returned `''`, and `askYesNo` read that as a confident
   NO** — a human verdict fabricated from an empty pipe. Now refuses. Ear-row
   probes must be run by the human in their own terminal.
6. ⚠ **`TrackBank.setContentFilter` is a RUNTIME setter** — a genuine exception
   to standing rule 13, which is otherwise near-universal. The default filter
   from the legacy `createTrackBank` silently drops folded tracks; use
   `ALL_CHANNELS` or `found:false` will not distinguish "deleted" from "folded".
7. ⚠ **`Track.createParentTrack` is init-only and creates NOTHING** — it throws
   "This can only be called during driver initialization" at runtime. The
   allocation guard is itself the tell: **document-mutating calls in this API are
   not init-guarded, so an init-guarded `create*` is an ACCESSOR.** That is a
   reusable heuristic for reading this API, not just a fact about one method.
8. ⚠ **A Java `.bwextension` needs a FULL BITWIG RESTART.** Toggling the
   controller off/on re-runs `init()` on classes the JVM has already loaded, so
   the new jar is deployed and ignored — `probe:hello` still passes because the
   method table is unchanged. The methodsHash drift check is what caught it.
   The handoff's deploy loop implies a toggle suffices; it does not.

### ⚠ And one trap about the QUESTIONS, not the instruments

Row C5's first attempt asked "did the audio glitch when the branch was created?"
forty seconds and two structural changes after the fact. The answer — *"I don't
know when the branch was created exactly"* — is a defect in the experiment, not
a missing observation. **A perceptual question separated from its event is a
question about a memory of the wrong thing.** Two rules came out of it and are
now built into the probes: ask immediately, and ask OPEN ("what did you hear?")
rather than leading ("did you hear it double?") — the first sitting reported
hearing no doubling while a broken check claimed otherwise, and a leading
question would have collected agreement with the bug.

### What this settles and what it does not

Rows D–G are measured. **E2's ● is the strongest single result of the sitting**:
the objection that A/B-by-mute would be audibly wrong in the wet path is
answered, and it was the objection most likely to kill the ergonomics.

⚠ It settles **nothing** in `SPIKE-E16 §8`. All nine decisions remain open and
the user's, now with three more inputs: duplication *always* glitches (C5), the
group topology carries an addressing hazard (above), and "born muted" is an
available route that trades the doubled window for a gap. Per standing rule 10,
**nothing here goes into `DECISIONS.md`.**

**Still unmeasured:** C4's per-branch delta, D3 (cursor-pool pressure), D4
(bank-window headroom), F2 beyond naming and the collapse hazard, F3 (detecting
a human's edit — now known to be harder than assumed), G3 (promoting a branch to
trunk), nested-group compounding, and row B3's owed modulator-liveness fixture.

---
