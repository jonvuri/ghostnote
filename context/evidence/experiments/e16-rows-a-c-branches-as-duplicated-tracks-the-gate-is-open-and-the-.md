---
id: E16
kind: evidence
state: active
source: FINDINGS.md
---

# E16 rows A–C — branches as duplicated tracks: the gate is OPEN, and the mix is wrong while they coexist [K] (2026-07-26)

**Verdict: ● none of the four kill criteria fires.** A top-level track duplicates
by three independent routes; the copy carries its device chain including **opaque
CLAP *and* VST3 plugin state**, its authored-modulator pages, its clips and its
mixer strip; it costs **330–520 ms** and **≈0.6 % engine CPU** per branch on a
two-Zebra3 fixture, and deleting it is one undo step that returns the CPU.
⚠ **The one thing measured that the design must now answer: a branch is audible
the instant it exists, and three branches sounded simultaneously** — §6.2's
hazard is not hypothetical. Probes: `e16a-dup.ts`, `e16b-heavy.ts`,
`e16c-cost.ts`; wire surface `branch.*` + `device.insertVst3` + `transport.play`.

### Row A — duplication exists, by three routes of four ●

| route | API | result |
|---|---|---|
| `channelDuplicate` | `Channel.duplicate()` (v1) | ● 117–190 ms |
| `duplicateObject` | `DuplicableObject.duplicateObject()` (v19) | ● 117–123 ms |
| `hostDuplicate` | `ControllerHost.duplicateObjects(undoName, …)` (v19) | ● 122–123 ms |
| `copyTracksAfter` | `Track.afterTrackInsertionPoint().copyTracks(…)` | ○ **silent no-op** |

`Track ⊂ Channel ⊂ DuplicableObject`, so all four compile — and the fourth does
nothing, which is exactly why E4c's lesson (a supertype method is a claim, not a
capability) was worth applying here. **`copyTracks` is the only route that could
have said WHERE a copy lands**, found by walking `InsertionPoint` rather than the
duplicate-shaped names, and it is unavailable: placement is not ours to choose.

### Row A4 — identity and landing ●

- Every copy mints a **fresh UUID `channelId`**, as E2f semantics predicted.
- The copy lands **adjacent (source position + 1)**, by all three routes. ⚠ This
  is *not* E2c's finding about `createInstrumentTrack(position)` ignoring
  positions — duplication does honour adjacency; creation does not.
- Same track type; **⚠ the same NAME** — a duplicate of `gn-A` is called `gn-A`,
  not `gn-A 2`. Row F2 therefore starts from "branches are indistinguishable in
  the mixer unless we rename them", which is a naming *policy* the design owes.

### Row B — what comes across ● (with one ◐)

Fixture `gn-E16`: Zebra3 as **CLAP** (carrying a surgically-authored LFO) +
Zebra3 as **VST3** + a Polysynth carrying an authored LFO, clips in 3 scenes,
non-default mixer state. Every reading was taken through a cursor that did not
make the copy (standing rule 3a).

| row | result |
|---|---|
| B1 devices | ● identical chain, in order: `[Zebra3, Zebra3, Polysynth]` |
| B2 **opaque plugin state** | ● **2193 DirectParameters, identical count AND values** on the copy — kill criterion 2 does not fire, for CLAP and VST3 alike |
| B3 modulators | ◐ **structure yes, liveness UNPROVEN** — see below |
| B4 clips | ● all three scenes' notes byte-identical |
| B5 mixer | ● volume, pan, colour, send value and **send pre/post-fader mode** all carried |

⚠ **B3 is the honest ◐ and it is the row that matters most for Phase 5.** The
copy shows the same remote pages as the original — including the `LFO` page that
only exists because a modulator was added by file surgery — which is *exactly the
oracle E11g used* to prove modulators survive save→restart. What is NOT shown is
that the modulation is still **live**: the E7 divergence oracle (base value still
while `modulatedValue` sweeps) reported nothing **on the original either**, on
two different fixtures, with a clip launched. So the comparison has nothing to
compare and the row is inconclusive, not green. ⚠ The probe deliberately FAILS
this check rather than passing it — an early version had an `||
original-showed-none-either` escape clause that turned two silences into a green,
which is the precise failure standing rule 1 exists to prevent. **Owed: a fixture
whose modulator is known-routed to a remote-visible target.**

### Row C — cost ●, both criteria clear

| | measurement |
|---|---|
| C1 ordinary instrument track | **117–190 ms** to visible |
| C2 the heavy fixture, transport rolling | **330–472 ms** to visible, **376–520 ms** to *readable* (device chain enumerates) — kill criterion 3 wanted < 5 s |
| C3 engine CPU | baseline 2.5 % → 3.0 / 4.0 / 4.4 % at 1 / 2 / 3 branches ⇒ **≈ 0.6 pp per branch**, roughly linear |
| C3 recovery | deleting every branch returned the engine to **2.4 %** — the CPU is genuinely freed |

Method note: **there is no CPU anywhere in the controller API** (complete-recall
grep: zero hits), so this is `top -l 2` against the *separate* `BitwigAudioEngine`
process, second sample only (the first is a since-boot average), median of three,
with clips confirmed sounding via the VU oracle before each reading.

⚠ **Read C3 as a lower bound, not as the ceiling.** 2.5 % for two Zebra3
instances is low because the fixture plays three short notes on what is probably a
default patch — a real arrangement's per-branch cost will be a larger absolute
number. What the curve establishes is the *shape*: linear per branch, ~+20–25 %
of the single-track cost each, fully reclaimed on delete. **Kill criterion 4 does
not fire, and the branch ceiling is a budget question rather than a wall.**

### Rows D, E, F, G — what fell out for free

| row | result |
|---|---|
| D1 | ● the copy resolves by `channelId`, and tombstones cleanly when deleted |
| D2 | ● duplication staled nothing: every pre-existing track still resolved, and the **scene count did not move** — no scene-epoch bump. `write-set.ts`'s assertion that track create/delete "degrades nothing" holds for duplication too |
| **E5** | ● **⚠ measured, and it is the design's problem: the copy arrives UNMUTED and audible.** With three branches launched, **3 of 3 sounded simultaneously** — the mix is wrong for as long as branches coexist, and nothing pre-mutes them for us |
| F1 | ● **one undo removes a whole duplicated track**, and removed exactly the one we made |
| F2 | ◐ partial — copies share the source's name (above); the mixer-clutter question is unmeasured |
| G1 | ● delete removes the track, tombstones its identity (~145 ms) and frees its CPU |

**Not measured this sitting:** C4 (project file size / save time — there is no
save API, so it needs a human `⌘S`), C5 (control-surface stall / audio glitch
during duplication), D3 (cursor-pool pressure), D4 (bank-window headroom), E1–E4
(mute latency and click-freeness by ear, whether mute cuts SENDS, groups), F3
(detecting a human deleting a branch), G2/G3 (re-indexing; promoting a branch to
trunk).

### ⚠ Four incidental findings, all of them traps

1. **`Channel.sendBank()` THROWS if the track bank was created with 0 sends** —
   `No send bank exists: Requested a send bank size of 0`, from inside the `Rig`
   constructor, which took the whole extension down before the bridge bound. The
   rig had always passed `0` to `createTrackBank(tracks, sends, scenes, flat)`.
   **Sends are a bank-creation-time decision: you cannot look at a send you did
   not ask for at `init()`.** Now `RigConfig.sends = 4`, guarded. (Standing rules
   9 and 13; same shape as E7-Finding-0.)
2. **E4's `setImmediately`-never-`set` trap is `Parameter`-WIDE, not
   device-specific.** A plain `volume().value().set()` / `pan()` / `Send.value()`
   acknowledges and never lands — measured, all three. `color()` and `mute()`
   are not `Parameter`s and take a plain `set` fine. Standing rule 3 should read
   *any* `Parameter`, including the mixer strip.
3. **The deploy loop can wedge Bitwig.** Gradle's `copyExtension` rewrites the
   `.bwextension` **in place**; if Bitwig starts reloading mid-write it reads a
   half-written zip (`ZipException: invalid LOC header` →
   `ClassNotFoundException`), and the dead instance keeps port 8686, so the next
   one logs `failed to start bridge: Address already in use` and every later
   request connects-but-never-answers. Only a Bitwig restart cleared it. **Fixed:
   `copyExtension` now writes a temp file and atomically renames.**
4. **VST3s can be inserted by class UID** (`InsertionPoint.insertVST3Device`),
   and there is **no plugin-enumeration API** — the UID came out of Bitwig's own
   `~/Library/Caches/Bitwig/vst3-metadata-*` cache. New wire method
   `device.insertVst3`, validated to 32 hex chars before the call (rule 3c).

⚠ One unexplained observation, recorded rather than resolved: **`transport.play()`
followed by `isPlaying()` read `false` while the VU meters showed signal.** Clip
launch drove audio regardless, so no row depended on it, but anything that gates
on transport state should verify by VU rather than by `isPlaying`.

### What this does and does not settle

It clears the gate: **rows A–C were the go/no-go and none of the four kill
criteria fires.** ⚠ It settles **nothing** in `SPIKE-E16 §8` — layer-or-
replacement, per-track heads, whether "the project state at take N" survives,
the branch budget, group topology, branch lifetime, naming, D14, and where this
lands in the plan are all still open and all still the user's, exactly as §8
says. Per standing rule 10 and §9, **nothing here goes into `DECISIONS.md`
yet.**

The one new input those decisions now have: **§6.2 is real and measured.** A
branch makes sound the moment it exists, every branch sounds at once, and there
is no API-side window in which the mix is correct — so "mute the new branch
immediately" is not an implementation detail, it is a precondition, and E5's
question shifts from *is there a bad window* to *how short can we make it*.

---
