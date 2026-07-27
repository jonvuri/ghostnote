---
title: ghostnote mini-spike — Handoff for E16 (rows A–G measured)
status: rows A–G measured. Gate OPEN, E2 ● (mute cuts sends), C5 ● (duplication
        glitches), and a collapsed group hides our own branches. §8 UNTOUCHED.
        Remaining: C4 per-branch delta, D3, D4, F2, F3, G3, nested groups, B3.
updated: 2026-07-26
successor: HANDOFF-E16-SIBLINGS.md (session 3 — named actions re-test, the
           sibling-track simplification, then D4/G3 if the branch system stays)
---

# Handoff: finish E16 — branches as duplicated tracks

You are picking up a **mini-spike inside Phase 1** of **ghostnote** (a personal
Bitwig Studio MCP server: thin `.bwextension` + TypeScript brain). E16 asks
whether a "branch" of an agent edit can be **a duplicated track** — revert by
deleting a track, A/B by muting one.

**The previous sitting ran the gate rows A–C. None of the four kill criteria
fired, so the idea is still alive and the remaining rows are the audible ones.**

## Read these first (in order)
1. `context/spike/SPIKE-E16-BRANCHES-AS-TRACKS.md` — the plan. Read the STATUS
   block at the top, then **§4 kill criteria**, then §5's row matrix (D–G are
   what is left), then **§8 — nine decisions that are the USER'S, not yours.**
2. `context/spike/FINDINGS.md` → the **`E16 rows A–C`** section at the top. The
   measurements, and four traps you must not re-learn.
3. `context/PROJECT_PLAN.md` §4 — the standing rules. Rules 1, 3, 3a, 3c, 5, 6,
   9, 10, 13 all bit during rows A–C.

## Where things stand

| row | verdict |
|---|---|
| A | ● 3 of 4 routes duplicate a top-level track. ⚠ `copyTracks` **and** `moveTracks` are both silent no-ops — placement is **not** ours, on two routes |
| A4 | ● fresh `channelId`, lands adjacent, ⚠ **carries the same NAME** as its source |
| B1/B2/B4/B5 | ● devices, **opaque CLAP *and* VST3 state**, clips, full mixer strip incl. send pre/post-fader |
| B3 | ◐ modulator *pages* come across; *liveness* unproven — **owed: a fixture with a modulator routed to a remote-visible target** |
| C1/C2/C3 | ● 117–190 ms light, 330–520 ms heavy, ≈0.6 pp engine CPU per branch, freed on delete |
| C4 | ◐ baseline only: **385,619 bytes / ~1.5 s save at 0 branches**; per-branch delta needs a second human `⌘S` |
| **C5** | ● ⚠ **every duplication audibly glitches the transport** — 5/5 real vs 0/3 placebo |
| D1/D2 | ● resolves + tombstones, no scene-epoch bump |
| **E1** | ● click-free and "instant" by ear; ⚠ the latency **number** is below the VU meter's resolution and is not quotable |
| **E2** | ● ⚠ **the good answer: mute CUTS sends, pre- and post-fader alike.** A/B by mute is audibly correct in the wet path |
| **E3** | ● groups duplicate **with their children**; a branch of an in-group track lands **inside**; deleting a group **cascades**. ⚠ ○ group *creation* — the typed candidate is init-only, and named actions are forbidden, so **only a human makes a group** |
| **E4** | ● `isGroupExpanded` is drivable — ⚠ **and that is the hazard, see below** |
| **E5** | ● a branch is audible the instant it exists. Route A ~307–386 ms doubled; **route B "born muted" ●** trades it for a ~321 ms gap |
| F1/G1 | ● one undo per duplicate; delete frees CPU |

⚠ **Two corrections made after the rows were first written up — read these.**

1. **Collapsing a group hides its children from the bank** (`itemCount` drops,
   `resolveByChannelId` says `found:false` while the child still sounds). First
   recorded as a cross-cutting hazard; **retracted** — it is our bank's content
   filter, and `setContentFilter(ALL_CHANNELS)` fixes it AT RUNTIME. Residue:
   the default filter is the dangerous one, standing rule 5's `itemCount()` is
   only trustworthy on `ALL_CHANNELS`, and the extra visible tracks cost bank
   window (D4, unmeasured under that filter).
2. **Group creation ○ was first recorded from a doc pass**, withdrawn, then
   re-established by live probe: `createParentTrack` throws "This can only be
   called during driver initialization". **Only a human can create a group.**
   ⚠ A shipped third-party extension (`gig-maestro`) has a `track/createGroup`
   RPC built on that call; it cannot work, and its tests pass because they
   verify a mock. Treat that repo as a lead generator, never as evidence.

## Your job, in priority order

Rows A–G are all measured (`FINDINGS.md` → "E16 rows D–G"). What is left:

1. **C4's per-branch delta.** Baseline is recorded: 385,619 bytes / ~1.5s save
   at 0 branches. Needs a second human `⌘S` with 3 branches live. There is no
   save API, so this is a human action plus a file-size watch.
2. **D3 / D4** — cursor-pool pressure across original + branches, and how close
   branching brings a project to the bank-window refusal.
3. **F3, and it is now HARDER than the plan assumed.** Detecting a human
   deleting or renaming a branch has to contend with the collapse hazard: a
   collapsed group's child returns `found:false`, exactly like a deletion. Any
   detector must track every group's `isGroupExpanded` to disambiguate.
4. **Nested groups** — a collapsed group inside a collapsed group is unmeasured
   and would compound the same hazard.
5. **G3** — can a branch be promoted to trunk without a rebuild.
6. **F2 beyond naming** — the mixer at 3 branches, now knowing that the obvious
   tidying gesture (collapse) makes them invisible to us.
7. **Owed from row B:** a fixture whose modulator is **known-routed to a
   remote-visible target**, so B3's liveness half can actually be asked.
8. **Deferred extension fix:** make `branch.vu` zero a slot's hold when the
   `channelId` at that index changes, so a stale bank-indexed reading
   self-invalidates instead of silently reporting the previous occupant's peak
   (trap 2 below). Fold it into the next deploy that already needs a restart.

⚠ **Do not write `DECISIONS.md`.** §8's nine design decisions stay open and are
the user's — layer-or-replacement, per-track heads, whether "the project state
at take N" survives, the branch budget, groups, branch lifetime, naming, D14,
and where this lands in the plan. Standing rule 10.

## The working rig

- **Bitwig 6.0.6** running with the ghostnote controller loaded, sandbox project
  open. Verify with `cd brain && npm run probe:hello` — it checks the bridge,
  the contract version and that `methodsHash` matches `extension/methods.golden.json`.
- ⚠ **A Java extension change needs a FULL BITWIG RESTART.** Toggling the
  controller off/on in Settings re-runs `init()` on classes the JVM already
  loaded, so the new jar is deployed and silently ignored — and `probe:hello`
  still passes whenever the method table is unchanged. The `methodsHash` drift
  check is what catches it. Save first (`⌘S`): the sandbox project holds the
  `gn-E16` fixture and a restart without saving loses it.
- **Deploy loop:** `cd extension && ./gradlew copyExtension` — now an **atomic
  rename**. ⚠ It used to rewrite the jar in place; Bitwig read a half-written
  zip, wedged, and kept port 8686 bound (`Address already in use`, requests
  connect-but-never-answer) until a full restart. If you ever see that shape
  again, it is this, and only a Bitwig restart clears it.
- **Adding a wire method:** add the `r.on(...)`, then `npm run wire:golden --
  --write`, rebuild, deploy, re-run `probe:hello`. `wiremap.test.ts` fails until
  you do, and it also asserts **no E16 method is reachable from the adapter
  contract** — keep it that way.
- **Probes:** `npm run probe:e16a` (row A + D1/D2/F1/G1, self-cleaning),
  `probe:e16b` (the hard fixture + rows B/C2), `probe:e16c` (row C3 CPU + F4).
  `src/probes/lib.ts` has `ask`/`askYesNo`/`waitForEnter` for rows that need the
  human's ears, and `trackedRequest()` for surface that might kill Bitwig.
- **Fixture `gn-E16` is LEFT IN PLACE** in the sandbox project: Zebra3 CLAP
  (with an authored LFO) + Zebra3 VST3 + Polysynth, clips in 3 scenes,
  non-default mixer state. `probe:e16b` rebuilds its device chain from empty if
  it has drifted. It is reusable for Phases 4/5 regardless of E16's outcome.
- **The audibility oracle:** `branch.vu` returns per-track `now` (last VU level)
  and `hold` (peak that only rises). Arm with `{reset:true}`, do the thing, read
  `hold` — that answers "did ANY signal appear", which ears cannot do for a
  100 ms window. This is how E5 and F4 were measured and it is how E2 should be.

## Traps — do not re-learn these

**From rows A–C:**

1. **`Channel.sendBank()` THROWS if the bank was created with 0 sends** — from
   inside the `Rig` constructor, taking the whole extension down before the
   bridge binds. Sends are a **bank-creation-time** decision; `RigConfig.sends`
   (default 4) now exists and every reader guards on it.
2. **E4's `setImmediately`-never-`set` trap is `Parameter`-WIDE.** Track volume,
   pan and `Send.value()` all acknowledge a plain `set()` and never move.
   `color()`, `mute()` and `isGroupExpanded()` are not `Parameter`s and take a
   plain `set` fine.
3. **`device.list` rows carry `index` and `name` only — no `exists` field.**
   Filtering on it empties the list, and a comparison of two empty lists PASSES.
4. **A supertype method is a claim, not a capability** — `copyTracks` AND
   `moveTracks` both compile, acknowledge, and do nothing.
5. **`transport.play()` then `isPlaying()` read `false` while VU showed signal.**
   Gate on VU, not on `isPlaying`.
6. **Never let two silences make a green.** If the control is inconclusive, the
   check must FAIL and say so.

**From rows D–G — every one of these produced a false result first:**

7. ⚠ **`addVuMeterObserver` is PRE-MUTE.** A muted track reports 55–58 while
   master reads 2. The oracle the plan nominated for E1/E2/E5 cannot see mute at
   all. Read the FX return or MASTER, never the sender's own strip.
   (`isActivated(false)` DOES read 0 — opposite side of the tap.)
8. ⚠ **`vuHold` is BANK-INDEXED and goes stale across a structural change.**
   Proved: FX 1 had accumulated 38, a copy landed on its slot, and the copy's
   "peak" came back as exactly 38. **Arm the hold only AFTER the structural
   change**, or the number belongs to another track.
9. **A short settle after a mute measures note TAILS** — 400ms read master 26;
   the next window, same state, read 2. Settle ~3s before arming.
10. **`track.delete` needs POLL-verification, not a fixed wait** — 400ms between
    deletes mis-targeted the next and removed an unrelated track (G2, live).
11. **`ask()` on a non-TTY fabricates a human answer.** It now refuses; ear-row
    probes must be run by the human in their own terminal.
12. ⚠ **A collapsed group's children leave the flat bank** — `itemCount` drops
    and `resolveByChannelId` says `found:false` while the child is still
    audible. Do not read a tombstone as a deletion without checking group state.

**About the QUESTIONS, not the instruments:**

13. ⚠ **Ask a perceptual question IMMEDIATELY, and ask it OPEN.** C5's first
    attempt asked forty seconds and two structural changes after the event and
    got "I don't know when the branch was created exactly" — a defect in the
    experiment, not a missing observation. And "did you hear it double?" would
    have collected agreement with a broken check; "what did you hear?" did not.
14. ⚠ **Use PLACEBO trials for anything decided by ear.** C5 is ● only because
    5/5 real scored against 0/3 placebo — the load-bearing datum was a clean
    "no" straight after four glitchy trials. A raw count could not have ruled
    out expectation bias.

## Posture

Bitwig's sandbox project is throwaway — churn it freely, but delete the branch
tracks you create and leave `gn-E16` intact. The user is at the keyboard for the
audible rows: **ask before making noise**, and ask them what they heard rather
than summarising it into a bare ●/○. Stop after each row group for review.
