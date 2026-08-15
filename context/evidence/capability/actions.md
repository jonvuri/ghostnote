---
title: Named actions — why the seam is closed
kind: capability
state: active
updated: 2026-08-15
scope: Application.getActions(), dispatch, and the product ban
evidence: E6, E16j, E16k, E17, E22; D13, D18, D20
---

# Named actions

> **Provenance.** Each claim carries `[K]` known, `[I]` inferred or `[U]`
> unknown, and cites its E-number or names its observer and date. Read the four
> rules in [INDEX.md](INDEX.md) before you edit this page.

## Current statement

**A named action dispatches to whichever UI area holds the PRIMARY focus
highlight at the moment of invocation.** No observer on the wire reports that
highlight. When the primary focus is not where you assume, the action either does
nothing or performs a **different structural edit on the same track**
[K, [E22](../experiments/e22-group-editing-action-does-not-fire-reliably-backgrounded.md), 2026-08-12 matrix].

⇒ Named actions are **product-banned** [[D13](../../decisions/d13-there-is-no-escape-hatch-settled-2026-07-19-e6.md)]. The ban survived three
re-tests, and its stated reason changed each time.

---

## 1. The arc — read it in order, because each stage corrected the last

| Stage | Claim | Status |
|---|---|---|
| [E6](../experiments/e6-named-actions-unusable-and-hazardous-2026-07-19.md) 2026-07-19 | Actions need Bitwig in the foreground, and Editing actions additionally need panel keyboard focus | ⚠ blockers 1 and 2 **did not reproduce** |
| [E16j](../experiments/e16j-e6-is-wrong-named-actions-fire-backgrounded-and-one-of-them-crea.md) 2026-07-26 | Actions fire backgrounded **and minimised**, 5 runs | ⚠ correct for those sittings; **cause misattributed** |
| [E17](../experiments/e17-device-layers-a-chain-can-be-created-and-soloed-and-never-grown-.md) 2026-08-01 | A chain action needs "priming" by a human click | ⚠ real observation; the latch model is superseded |
| [E22](../experiments/e22-group-editing-action-does-not-fire-reliably-backgrounded.md) 2026-08-12 | **Primary focus at the instant of the call**, no latch | ● **current** |

⚠ **E22 re-reads the older evidence without contradicting it.** E16j's four
background and one minimised positives were sittings whose primary focus happened
to be the track area. E17's "foreground requirement" for device-panel actions is
the same rule seen from the device panel's side. **Nothing measured was wrong;
the mechanism offered for it was.**

---

## 2. ⚠⚠ The destruction matrix — the measurement that settled it

One clean lifecycle, a third full Bitwig restart, each arm its own process
invocation with nothing between the last precondition and the fire
[K, E22, 2026-08-12]:

| Intervening human action | Result | Primary focus at fire |
|---|---|---|
| none since restart | **miss**, 5103 ms | untouched |
| clicked the target's **track header** | **wrap**, 145 ms | track header |
| none; new target | **wrap**, 145 ms | track header |
| clicked the target's own **empty launcher slot** | **miss**, 5025 ms | launcher slot |
| clicked the target's **Polysynth device header** | ⚠⚠ **MISDISPATCH**, 5017 ms | device header |
| clicked a **chain lane** in the target's FX Layer | **miss**, 5036 ms | chain lane |
| switched to another **project tab** and back | **miss**, 5114 ms | demoted to secondary |

**4/4 recovery clicks re-wrapped**, at 145/142/137/145 ms. The action channel was
alive throughout, so every miss is focus state and not a dead channel.

⚠ **One ordinary click elsewhere in the same untouched session destroys the
precondition — including a click on the target track's own launcher slot, which
leaves the track selected the whole time.** That is why the E17 "session latch"
reading is superseded.

### The mechanism, in the operator's words

Bitwig draws a **primary** and a **secondary** highlight. Reported at the
keyboard: *"I saw the device get the primary selection, with the track still
having the secondary selection."*

⇒ **The track selection our guards read is the secondary one, and it stayed
correct in every failing row.** The named action follows the primary one.

---

## 3. ⚠⚠ The misdispatch — this is the hazard, not the misses

With primary focus on a device header, `Group` built an **Instrument Layer around
that device inside the track's own device chain**, and no track group at all:

```text
devices: 0:Polysynth  →  0:Instrument Layer
chains:  slot0 Polysynth, hasLayers=false, chainCount=0
      →  slot0 Instrument Layer, hasLayers=true, chainCount=1
         chain[0] "Polysynth" containing Polysynth
```

⚠⚠ **All three of `branch.groupTrack`'s guards passed** — bank-row `channelId`,
non-following cursor `channelId`, and the selected mixer row — because the track
selection really was still correct. **The guard cannot see primary focus.**

⇒ A failed autonomous fork can **silently restructure a user's device chain**
while reporting only that the group is missing. Structural readback correctly
reported no group; the Instrument Layer it had built remained, and nothing in the
surface said so or undid it.

⇒ ⚠ **This is a misdispatch hazard, not a fragile precondition.** A
once-per-session operator prompt is not a viable product contract: the
precondition is not established once, it is re-broken by ordinary work, it is
invisible to every observer the controller has, and its failure mode is not a
clean no-op.

⚠ The CLIP, CHAIN and PROJECT-TAB misses were **clean** — no structural change at
any readable level. Only the device panel produced a redirect. Whether other
focus targets have their own receivers is **`[U]`**.

---

## 4. The two blockers that never stopped standing

### Zero readback — ● [K, E6 blocker 4, confirmed live by E16j]

`invoke()` returns `{"success":true,"resolved":true,"resolvedName":…}` for
**every** action, whether or not anything happened. A resolved action that did
nothing is indistinguishable from one that worked, from the return value alone.

⇒ Disqualifying for an optimistic-apply-then-verify model. An executor could
never confirm what an action did, on top of not controlling whether it fires.

### The selection hazard — ● [K, E6 blocker 3, watched happening in E16j]

Our own addressing sets the UI selection: `cursor.pointTrack` is
`CursorTrack.selectChannel()`, which sets the UI track selection.

- E6 created **seven orphan `gn-A` duplicates** before the mechanism was
  understood.
- E16j watched `Group` wrap exactly the throwaway track `cursor.pointTrack` had
  selected moments earlier — aimed at something disposable on purpose.
- E17 acquired **two tracks named `gn-lay4`** the same way, and every probe that
  resolved its subject by name silently took the first match. See
  [identity](identity.md) §6.

⇒ ⚠ **Nothing in the executor may ever invoke a selection-consuming action.**

---

## 5. ⚠⚠ Our own calls disable chain actions

Every one of these was in ghostnote's tooling, not in Bitwig, and each produced
○s that were written up as properties of the API [K, E16j method section, E17]:

| Our call | What it really does |
|---|---|
| `cursor.pointTrack` | `CursorTrack.selectChannel()` — sets the UI track selection |
| `device.selectInEditor` | sets the device panel's current device, which beats the chain selection |
| `focus_or_toggle_device_panel` | a **toggle** — an odd number of fires closes the panel, after which chain actions do nothing |

⚠ **Classify every helper as READ or WRITE and write it in the name.** A function
called `levels()` that silently re-selects a track is a trap. If a "read" invokes
any `select*`, it is a write.

⚠ **Between establishing a precondition and firing the action, call NOTHING.**
That single difference separated the one probe that worked from every probe that
failed, and no argument about focus or foreground would have found it — only
diffing the two call sequences did.

⚠ **A probe's SETUP is part of its experiment.** One run held its variable fixed
correctly and was still void, because the scaffolding that built its fixture
called a method already proven to override the thing being measured. Audit the
constants, not just the variable.

---

## 6. ⚠ What no longer needs a named action

This is the part of the arc that ended well, and it is easy to miss under the
retractions.

| Operation | Once believed | Now |
|---|---|---|
| Create a device chain | named `Duplicate`, needs a human click | ⚠⚠ **● fully typed and autonomous**: `layer.select` + `layer.duplicateChannel` [K, E17 `e17ak`] |
| Grow a one-chain container | impossible | ● grows freely [K, E17 `e17ae`] |
| Place a container on the Master or an FX return | assumed | ● measured [K, E18a] |
| Delete a device chain | named `Delete` | ○ still refuses typed — reduction deletes the **container** instead. See [containers](containers.md) §2 |

⇒ **The layer model reaches its product shape without touching this seam at all.**

---

## 7. Product status

- No `track.group` contract op, no `make_track_copy`, and no
  `WriteEffectUnobservedError` [K, [D18](../../decisions/d18-branching-the-hybrid-model-at-l3-open-settled-2026-08-06-by-the-.md) revision, operator disposition
  2026-08-14].
- `Group` is reachable only through `branch.groupTrack`, which is **kept
  registered to reproduce E22 and is product-banned** [K, same disposition].
- The accepted capability gap is small and it is not compositional: track
  `Group`/`Ungroup` and automation `wrap`/`unwrap` [K, E6].
- ⚠ `moveTracks` and `copyTracks` are silent no-ops, so a track cannot be moved
  into a group after the fact. The only known route to a populated lineage is to
  group the original **first**, then duplicate [K, [E16k](../experiments/e16k-a-group-is-a-usable-branch-container-the-collapse-primitive-work.md)].

---

## 8. Standing operator constraints

⚠ Two instructions govern any future probe in this area. Both are the user's and
neither has been withdrawn:

1. **Bitwig being the focused app must not be load-bearing**, and no OS-level
   focus work — no `osascript`, no focus detection, no bringing Bitwig up
   programmatically. If foreground turns out to be required, the answer is to
   abandon named actions, not to build a precondition check around them
   [K, E16j, user, 2026-07-26].
2. **Never start a foreground-gated probe on your own initiative.** Arrange it
   with the operator first. ⚠ A foreground-gated probe and a live conversation
   cannot share one screen [K, E17, user, 2026-08-01].

---

## Open questions

| # | Question | Tag | Probe |
|---|---|---|---|
| 1 | Do other primary-focus targets have their own receivers, as the device panel does? | `[U]` | Extend the E22 matrix to the browser, the automation lane and the mixer panel. ⚠ Foreground-gated — arrange with the operator first |
| 2 | Why did E6's foreground gate reproduce in 2026-07 and not in 2026-07-26? | `[U]` | ⚠ Superseded in practice by E22's mechanism; not worth chasing unless the ban is ever reconsidered |

---

## Supersession record

| Date | Change |
|---|---|
| 2026-08-15 | Page created. It supersedes the *reading* of E6's foreground and panel-focus blockers, of E16j's "the foreground gate does not exist", and of E17's session-latch model. All three E-files stay frozen; E22's primary-focus rule is the current mechanism. |
| 2026-08-15 | Recorded that chain create no longer needs this seam at all. §6. |
