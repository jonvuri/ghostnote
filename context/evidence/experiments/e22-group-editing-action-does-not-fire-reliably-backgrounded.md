---
id: E22
kind: evidence
state: active
source: phase-1-session-3f
---

# E22 — ⚠⚠ `Group` dispatches on whatever holds PRIMARY FOCUS, and silently does something else [K] (2026-08-11, matrix 2026-08-12)

**Verdict: there is no session latch. `Group` is dispatched to whichever UI area
holds the primary focus highlight at the moment of invocation, and when that area
is not the track header it either does nothing or performs a different structural
edit on the same track.** The 2026-08-11 sitting measured a human track-header
click as the thing that makes the track fork work, and read it as a persistent
latch because nothing had yet been tried between the click and the fire. The
2026-08-12 destruction matrix removed that reading: one ordinary click elsewhere
in the same untouched session destroys it, **including a click on the target
track's own launcher slot, which leaves the track selected the whole time.**

⚠⚠ **The device-panel row is the important one.** With primary focus on a device
header, the same call built an **Instrument Layer around that device inside the
track's own device chain** and no track group at all. `branch.groupTrack`'s three
guards — bank-row `channelId`, non-following cursor `channelId`, and the selected
mixer row — **all passed**, because the track selection really was still correct.
The guard cannot see primary focus, so a failed autonomous fork can silently
restructure a user's device chain while reporting only that the group is missing.

⇒ This is D13's **misdispatch hazard**, not a fragile precondition. A
once-per-Bitwig-session operator prompt is not a viable product contract: the
precondition is not established once, it is re-broken by ordinary work, it is
invisible to every observer the controller has, and its failure mode is not a
clean no-op.

## The destruction matrix (2026-08-12, one clean lifecycle)

A third full Bitwig restart, `gn-scale-test` reopened, no click before the cold
row. `probe:hello` first: 6.0.6/API 25, 143 methods, hash `4c4d687667d4804b`, 12
visible identities, 10 scenes, `Group 7` collapsed, full bank visibility, and the
running extension fresher than the deployed file. **No extension was deployed for
this matrix**; the local `BranchHandlers.groupTrack` reordering stayed undeployed
so a controller reload could not become an extra variable.

Every arm was one process invocation: its own disposable fixtures, the same
`pinTrack → pointTrack → selection.status → branch.groupTrack` measured window with
nothing between the last precondition and the fire, a diff at track, scene, clip,
device and chain level, the collapse oracle on any new group, and cleanup that
refuses if anything pre-existing moved.

| row | intervening human action | result | primary focus at fire |
|---|---|---|---|
| COLD | none since restart | **miss**, 5103 ms, no delta anywhere | untouched |
| PRIME | clicked the target's track header | **wrap**, 145 ms, exact child | track header |
| WARM | none; new target | **wrap**, 145 ms | track header |
| WARM+deep | none; plus a 14-row device/chain sweep | **wrap**, 249 ms | track header |
| CLIP | clicked the target's own EMPTY launcher slot | **miss**, 5025 ms, no delta anywhere | launcher slot |
| recovery | clicked a new target's track header | **wrap**, 142 ms | track header |
| DEVICE | clicked the target's Polysynth device header | ⚠⚠ **misdispatch**, 5017 ms | device header |
| CHAIN | clicked a chain lane in the target's FX Layer | **miss**, 5036 ms, no delta anywhere | chain lane |
| recovery | clicked a new target's track header | **wrap**, 137 ms | track header |
| PROJECT-TAB | switched to another open project tab and back | **miss**, 5114 ms, no delta anywhere | demoted to secondary |
| recovery | clicked a new target's track header | **wrap**, 145 ms | track header |

Every row passed the same durable-target, cursor-target and selected-mixer-row
guards, including every miss and the misdispatch. **No row touched any identity it
did not create**, and every row returned `gn-scale-test` to 12 identities, 10
scenes, stopped transport and `Group 7` collapsed.

Each destructor row is paired with a recovery control in a separate invocation:
**4/4 recovery clicks re-wrapped, at 145/142/137/145 ms.** The action channel was
alive throughout, so every miss above is focus state and not a dead channel, a
broken handler or a harness fault. The DEVICE row needs no such control — a
redirect is itself proof of a live channel.

### What the misdispatch actually did

```text
devices on the disposable target:  0:Polysynth  →  0:Instrument Layer
chains  on the disposable target:  slot0 Polysynth, hasLayers=false, chainCount=0
                                →  slot0 Instrument Layer, hasLayers=true, chainCount=1
                                   chain[0] "Polysynth" containing Polysynth
```

No track group was ever created; the track-level poll timed out at 5017 ms. The
redirect landed wholly inside the probe-owned fixture, which is why the fixture
was disposable and on the target's own row.

### The mechanism, in the operator's words

The three destructor rows were reported verbatim at the keyboard:

- CLIP — *"The topmost, empty clip slot — the main focus highlight moved to that
  empty clip slot, with a secondary highlight still on the track header."*
- DEVICE — *"I saw the device get the primary selection, with the track still
  having the secondary selection."*
- CHAIN — *"The first chain called 'Layer 1' in the chain lane. It got the primary
  selection — the track header appears to have the secondary selection."*
- PROJECT-TAB — *"I saw the track still selected, but apparently as a secondary
  focus."*

Bitwig draws a **primary** and a **secondary** highlight. The track selection our
guards read is the secondary one and it stayed correct in every failing row. The
named action follows the primary one, which no observer on the wire reports.

This also re-reads the older evidence without contradicting it: E16j's four
background and one minimised positives were sittings whose primary focus happened
to be the track area, and E17's "foreground requirement" for device-panel actions
is the same rule seen from the device panel's side.

### What is NOT claimed

- The CLIP, CHAIN and PROJECT-TAB misses are **clean** — no structural change at
  any readable level. Only the device panel produced a redirect. Whether other
  focus targets have their own receivers is unmeasured.
- **RELOAD was not run**, deliberately. It existed to find the destruction
  boundary beyond a restart; four destroyers inside an untouched session were
  found first, so its answer changes no decision.
- **`clip-other` was not run.** It existed to disambiguate a *wrapping* CLIP row.
  CLIP missed with the selected mixer row provably pinned to the target
  throughout, so focus was already isolated from track selection.

## ⚠ Three harness lags this matrix had to fix first

All three produced readings that looked exactly like findings. They are recorded
because any future probe reading banks through a cursor will meet them.

1. **The selected-mixer observer lags a cursor sweep.** After pointing the cursor
   at 14 rows in turn, the pre-fire readback returned the sweep's last row
   (Master) instead of the target, 25 ms after `pointTrack`. The arm refused to
   fire — correctly — and scored nothing. Fix: park deliberately on a neutral row
   and block until the observer confirms it, then poll the pre-fire readback with
   the threshold unchanged.
2. **`device.list` and `chain.inventory` return the PREVIOUS track's contents.**
   Both read banks bound to `cursorTracks[0]`, which rebind on the host's
   schedule. A bare new instrument track reported the `Instrument Selector |
   Filter+` belonging to the row above it, and a populated container read as
   empty — while `device.list` for that same track at that same moment reported no
   change, which is what exposed the contradiction. Fix: every per-track reading
   must name its own track (`chain.inventory` carries the cursor's `trackName`)
   **and** repeat unchanged across two consecutive reads; a row that never
   stabilises is recorded as unstable and omitted, never as a change.
3. **A refused cleanup leaves a group standing on purpose.** That is correct
   behaviour, and it needs a guarded exit: `probe:e22 -- rescue --group=<id>
   --child=<id>` re-proves the collapse oracle live before the cascading delete
   and refuses if the group has acquired anything else.

Artifact 2 cost one false `MISDISPATCH` verdict on a control row that had in fact
wrapped in 136 ms. E18 guard 4 is the rule it broke: an impossible delta means you
are reading the wrong object — abort, do not score.

## Fresh-session isolation (2026-08-11, the sitting that found the effect)

⚠ Read the rows below as measured, and the *interpretation* they were given —
a persistent latch — as superseded by the matrix above. Nothing here is wrong;
none of these arms put anything between the priming click and the fire, which is
exactly what the matrix went on to do.

`probe:e22` ran one variable per row. It refused rolling transport or a partial
bank, recorded the 12 visible durable identities, 10 scenes, ARRANGE layout and
`Group 7`'s collapsed state, then created one disposable top-level instrument.
Every measured sequence was:

```text
cursor.pinTrack(false) → cursor.pointTrack once → selected-row readback
→ same-callback bank/cursor/mixer identity checks → Group once → channelId diff
```

No selection-changing call ran between the final precondition and `Group`.

| row | process/project state | extra condition | result |
|---|---|---|---|
| A1 | freshly restarted, reopened `gn-scale-test` | UI untouched | **miss**, no new identity in 5037 ms |
| B1 | same process/project | human clicked disposable track header | **wrap**, exact child, 144 ms |
| C1 | after B1 | `focus_track_header_area`, re-point | wrap in 142 ms, but inherited human priming and therefore not scored for autonomy |
| C2 | second fresh process, first action trial | `focus_track_header_area`, re-point; no human track click | **miss**, no new identity in 5117 ms |
| B2 | same second process | human clicked disposable track header | **wrap**, exact child, 144 ms |
| B3 | same second process | human clicked disposable track header | **wrap**, exact child, 142 ms |
| A2 | immediately after B3 | no click and no focus action; different disposable target | **wrap**, exact child, 144 ms |

The negative and positive rows all passed the same durable target, cursor target
and selected-mixer-row guards. That makes those observers insufficient to detect
the latch. A full restart cleared it; one human header click restored it and it
survived cleanup plus a later API re-selection onto a different track. The exact
destruction boundary beyond a restart/project load was not chased because the
human-only exit condition was already met.

Every row restored all 12 baseline identities, 10 scenes and the pre-existing
collapsed group state. No probe-created identity remains and transport stayed
stopped.

## Production route

`probe:3f-production` created a uniquely named source, inserted Polysynth, wrote
a one-note clip, and entered the purpose-built addressed `branch.groupTrack`
handler. The handler verified the bank-row `channelId`, the non-following cursor's
`channelId`, and the selected mixer-bank row in the same controller callback
before invoking `Group`. The action resolved and returned; repeated bank diffs
found no group row. No duplicate stage ran, and guarded cleanup removed the
source. Repeated attempts left no new identity behind.

The development path also ruled out false negatives from nested-group ordinals,
stale controller builds, nested `batch.run` dispatch, and launcher-slot selection:
the final route is a top-level RPC with its own revision guard, uses the current
`addIsSelectedInMixerObserver`, and verifies structural readback rather than the
action's `void` return. A subsequent prior-art audit did find one composition
drift: production had omitted E16j/E16k's explicit `cursor.pinTrack(false)` before
`cursor.pointTrack`. That omission is corrected. It cannot explain the archived
probe's miss, because that unchanged probe still performs the unpin itself.

## E16j regression

The archived `npm run probe:e16j -- bg` was rerun unchanged against Bitwig 6.0.6
/ API 25:

| trial | result |
|---|---|
| `Create Instrument Track` opening control | fired, new instrument in 238 ms |
| `Create Group Track` | fired, new empty group in 240 ms |
| `Group` on the addressed `gn-J` | **nothing in 4061 ms** |
| `focus_track_header_area`, then `Group` | **nothing in 4106 ms** |
| `Create Scene` | fired, scene count 10 → 11 in 231 ms |
| `Create Instrument Track` closing control | fired, new instrument in 235 ms |

The probe therefore failed its own assertion that the Editing action tracks the
Project actions. Its cleanup passed: no new or missing track remained.

## Prior positive evidence that still stands

- **E16j:** five runs (four backgrounded, one minimized) recorded `Group`
  wrapping exactly the disposable `gn-J` selected through
  `cursor.pointTrack`/`CursorTrack.selectChannel`; the collapse oracle separated
  that result from `Create Group Track`'s empty group.
- **E16k K1:** `Group` wrapped an existing track, the collapse oracle identified
  that exact child, and its `channelId` survived.
- **E16k K4:** the same action wrapped a track already inside a group, producing
  a real nested group.
- Later E17 probes repeatedly cite and use the E16j track-selection result as a
  control; E17's foreground dependency applies to device-panel actions and
  explicitly contrasts them with E16j's five background track wraps.

The E16j source is byte-identical to the version committed with its positive
finding, and the `cursor.pointTrack` Java handler still calls the same
`CursorTrack.selectChannel(target)` route. E22 now identifies the leaked state:
the earlier positive sittings were human-primed, while the negative sitting was
not.

## Phase 3f impact

> ⚠⚠ **DISPOSITION 2026-08-14 (operator; D18 rev). This section is the state at
> the time of the matrix and is now historical in its particulars.** The grouped
> track-fork product path was removed rather than repaired: there is no
> `track.group` contract op, no `make_track_copy`, and no
> `WriteEffectUnobservedError` — the post-send diagnostic described below no
> longer exists, because the write it diagnosed no longer exists. `Group` is
> reachable only through `branch.groupTrack`, kept registered to reproduce this
> experiment and product-banned. ⚠ The FINDINGS below are unaffected; only the
> "therefore Phase 3f will…" reading is superseded. See revised D18 and
> [3f](../../plan/phase-1/3f-fork-chain.md).

The forced topology remains mechanically proven, but Phase 3f has not yet passed
its production live-smoke criterion. An empty group is insufficient: E16k
measured `moveTracks` and `copyTracks` as silent no-ops, so the correct route is
still `Group` the original first. The missing precondition is now measured rather
than speculative, but it is human-only and invisible to the controller. Therefore
the production fork is implemented and offline-green but not autonomously usable.

The surface diagnostic is also corrected: the structural miss now raises a
post-send `WriteEffectUnobservedError`, reports `nothingWasWritten: false`, and
says the request reached Bitwig. It no longer uses `InvalidOpError`'s false
“before anything was sent” wording.

⚠⚠ **The matrix adds a hazard that diagnostic does not cover.** In the DEVICE
row the fork's own guards all passed and `Group` still made a structural change —
just not the one asked for. Structural readback correctly reported that no group
appeared, and the Instrument Layer it had built around the track's first device
remained. So the current failure story is incomplete in a specific way: a fork
that reports “the group is missing” may already have edited the track's device
chain, and nothing in the surface says so or undoes it.

That is a finding about the production path, not a change to it. Nothing was
altered in the surface, the handler, or the contract for this matrix, and the
handoff's instruction to leave the product decision with the operator stands.
When it is taken, the three shapes are no longer equally open: the measured
result is the third one, so the fork cannot ship autonomously behind a prompt.
The routes that remain are a **just-in-time, verified-per-call** arrangement, a
**deferral** of the track fork in favour of the layer chain and clip block, or a
**stronger interlock** than any observer currently on the wire can provide.
