---
id: E17
kind: evidence
state: active
source: FINDINGS.md
---

# E17 — device layers: a chain can be CREATED and SOLOED, and never grown, duplicated or deleted [K] (2026-08-01)

**Verdict: ⚠⚠ a layer chain is UNADDRESSABLE, not fixed-shape — and that
distinction is the whole finding.** Six rows asked whether DEVICE branching
should be layer chains rather than track forks. The first pass concluded chains
could not be created or deleted. **A user report overturned that**: selecting a
layer by hand and pressing copy/paste duplicates it, and `Delete` removes it. So
the capabilities EXIST. What does not exist is any way for a controller extension
to make a layer chain the UI selection — and every one of those gestures is
selection-scoped. Probes: `e17a`–`e17p`, `e17-setup`, `e17-diag`, `e17-cleanup`.
New wire: ten methods across two restarts, `methodsHash` **`d7afe1a9c253b7ba`**
(117 → 127).

| row | question | verdict |
|---|---|---|
| 1 | GROUP existing devices into a layer | ⚠ **◐ a container is created, with exactly ONE chain** |
| 2 | DUPLICATE a layer | ○ — 3 mechanisms, 2 fixture states, verb control ● |
| 3 | CREATE a chain | ⚠ **◐ a HUMAN can; we cannot reach the selection** |
| 4 | DELETE a layer | ⚠ **◐ a HUMAN can; the typed verbs refuse (4 routes, both controls ●)** |
| 5 | RENAME a layer | ⚠ **● survives a content change AND save+restart — E4c corrected** |
| 6 | SOLO a layer | ⚠ **● container-scoped AND locally exclusive** |
| — | ⚠ **a chain's `channelId` across save+restart** | ⚠ **○ NOT durable — 8/8 changed** |

⇒ **DEVICE takes are still TRACKS** — but for two reasons neither of which is
"layers cannot do it". Reasoning in `E17-VERDICT.md`; per standing rule 10
nothing here goes into `DECISIONS.md`.

### ⚠⚠ Rows 3 and 4 REOPENED, then re-closed on a different basis

**The user, 2026-08-01:** *"Selecting a layer, copying it, and pasting directly at
the same selection results in inserting a duplicate of that layer, for me."*

`e17l` put a human in the loop to split the one variable that mattered — **who
sets the selection** — and the answer is unambiguous:

| arm | who selects | who fires | result |
|---|---|---|---|
| A | human | human | ● **4 → 5 chains** |
| B | ⚠ **human** | ⚠ **us** (`Copy`+`Paste`) | ⚠ **● 4 → 5** |
| C | human | us (`Delete`) | ⚠ **● 4 → 3, the correct chain by channelId** |

⇒ ⚠ **The named actions reach a selected layer perfectly well. Our SELECTION is
the broken link** — which is exactly the shape row 1 had before
`device.selectInEditor` existed. Everything we can point at a chain fails:

### ⚠⚠ RETRACTED: `DeviceChain.selectInEditor()` works. Every test aimed at the chain that was already selected

⚠ **This is the largest correction in E17 and a user objection is what forced it:**

> **User, 2026-08-01:** *"I never saw that 'ambient selection' change the whole
> time. Change it to a different chain so I can see it actually does move separate
> from the track selection."*

`e17u` varied the **TARGET** instead of the setter, and asked the one question no
earlier probe asked — *before I touch anything, which chain is highlighted?* The
answer was **Polysynth, chain 1**. ⚠ **`e17k`, `e17o`, `e17q` and `e17r` every
single one used `layerIndex: 1`.** So every trial in this session set the chain
selection to where it already sat: the setter worked the whole time, its effect
was invisible in every trial, and each action fired afterwards ran against a state
indistinguishable from having done nothing.

| setter | moves the chain selection? | evidence |
|---|---|---|
| ⚠ **`DeviceChain.selectInEditor()`** | ⚠ **●** | `e17u` eyes + `e17v` ×2 machine-read, 3 distinct targets |
| `Channel.selectInMixer()` | ○ | `e17v` — aimed Phase-4, stayed Polysynth. It scopes the panel (#3) and nothing more |
| ⚠ `CursorChannel.selectChannel()` on `CursorDeviceLayer` | ⚠ **○ — INERT** | `e17u` 3 targets, `e17v` 1, zero movement |
| 6 navigation actions from a selected container | ○ (`e17p`) | |

⚠ **`e17o`'s MECHANISM B ● is RETRACTED, and it did damage.** `cursorLayer0.exists()`
flipping false → true was **not** `selectChannel` binding — the cursor was already
resolved to the container's ambient current chain. `e17o` then *chose* `pointCursor`
for rows 3 and 4 off that false positive (`const setter = (bSets || cursorLanded)
? 'pointCursor' : …`), so those rows ran on a setter that does nothing at all.

⚠ **The `e17r` "ambient highlight" is retired too** — the highlight is real, but
`selectInEditor` drives it, not the cursor. `cursorLayer0` is a **READBACK** of it,
not a pointer to it.

### ⚠ A machine-readable chain-selection readback exists after all

`cursorLayerName` tracked the human's eyes **5/5** in `e17u`, and `e17v` PART 0
showed the read is non-disturbing: set the selection to Phase-4, leave the track
entirely, come back, still Phase-4. So the precondition can finally be asserted
apart from the question (E16o) **with no human in the loop** — the instrument
`e17k` lacked and `e17q` went hunting for in the observers that died to a
deprecated sibling.

⚠ Valid **only while `cursorDevice0` sits on the container**: `e17u` arm E moved
the device cursor into a chain and `cursorLayerExists` went false while the
selection plainly stayed put. That is the cursor losing its domain, not the
selection moving.

⇒ ⚠ **Rows 3 and 4 keep their ○, but their REASON is replaced.** The old reason —
*"nothing we can call selects a chain"* — is false. The measured reason is that a
verified chain selection is **not what panel-focused actions consume**; see the
re-measurement below.

### ⚠⚠ THREE things were being conflated, and it took human eyes to separate them

⚠ **`e17q` claimed our layer setters "hit the CONTAINER". That reading is VOID**,
and the user is who caught it — *"does that not indicate the cursor might actually
be pointing to the container?"* `e17s` added the arm `e17q` never ran: fire
`Duplicate` with **no selection call at all**. It duplicated the container,
identically to every "our setter hit the container" arm. So those arms were
measuring **ambient panel state**, and the layer setters are simply **inert**.

⚠ **And `e17r` — human eyes, no actions fired — broke the framing underneath it.**
Asked what `Device.selectInEditor()` had selected, the user reported: *"The
gn-lay4 track. Nothing in the device is selected."* Every one of five arms
answered "the track". There are **four** distinct things here, not the two the
earlier write-ups assumed:

| # | thing | who can set it | visible? |
|---|---|---|---|
| 1 | the UI **selection** (the highlight) | our calls only ever set it to the **TRACK** | ● yes |
| 2 | the device panel's **current DEVICE** | ⚠ `Device.selectInEditor` ● — **this is what panel-focused actions consume** | ○ **invisible** |
| 3 | the device panel's **SCOPE** | `Channel.selectInMixer()` on a chain scopes the panel INTO it | ● yes |
| 4 | ⚠ the **chain selection** | ⚠ `DeviceChain.selectInEditor()` ● — and `cursorLayerName` READS IT BACK | ● yes (`e17u`, human-confirmed) |

⇒ **Row 1 needed `device.selectInEditor` + panel focus + foreground because all
three feed #2**, which is invisible and is not the UI selection at all. Naming it
"the UI selection" is what made two write-ups wrong.

⚠ **`Device.selectInEditor()` IS real, proven by a discriminating fixture**
(`e17t`) — the discriminator row 1 should have had. Two DISTINGUISHABLE devices,
`[Polysynth, Organ]`:

| arm | which device got wrapped |
|---|---|
| ambient, nothing selected | **Organ** — ⚠ the panel's default is the **LAST** device, not the first |
| `selectInEditor(0)` | **Polysynth** |
| `selectInEditor(1)` | **Organ** |

Selecting index 0 pulls the outcome away from ambient, so the call drives #2. ⚠ It
also retro-validates row 1: `e17d` ran `[Polysynth, Polysynth]` → `[Instrument
Layer, Polysynth]`, i.e. device 0, where ambient would have given `[Polysynth,
Instrument Layer]`. That output was discriminating and nobody noticed at the time.

**What reaches a CHAIN: nothing.** `selectInMixer` scopes the panel into the chain
(#3, and the user can see it — *"the Polysynth chain … has taken up the whole
device panel"*), but `Duplicate`/`Select All`/`Copy`+`Paste` then land on
**nothing at all** — Δ0 at tracks, devices, chains AND devices-inside-chains. So
scoping is not selecting: a scoped panel has no current item to act on.

⇒ ⚠ **CORRECTED AGAIN, 2026-08-01.** "Our layer setters are inert" was right about
`selectChannel` and `selectInMixer` and **wrong about `selectInEditor`**, for the
target-never-varied reason above. What the evidence supports now: *the chain
selection is settable and readable; whether the device panel consumes it is
**unmeasured**.*

### ⚠⚠ Rows 3 and 4, re-measured against a VERIFIED chain selection: still ○ — but now a POSITIVE result

`e17v` (second run, clean). Every arm asserted the chain selection **at the moment
of firing**, and every arm is bracketed by a container reference that proves
dispatch was live in the same conditions:

| arm | chain selection at firing | Δtracks | Δdevices | Δchains | |
|---|---|---|---|---|---|
| REF before | — | 0 | ⚠ **+1** | 0 | ◐ gate ALIVE |
| ⚠ **`selectInEditor` + `Duplicate`** | ⚠ **verified `Phase-4`** | 0 | ⚠ **+1** | **0** | ◐ **CONTAINER** |
| REF between | — | 0 | ⚠ **+1** | 0 | ◐ gate ALIVE |
| ⚠ **`selectInEditor` + `Copy`+`Paste`** | ⚠ **verified `Polysynth`** | 0 | ⚠ **+1** | **0** | ◐ **CONTAINER** |
| REF after | — | 0 | ⚠ **+1** | 0 | ◐ gate ALIVE |

⇒ ⚠ **The chain selection is set, readable, verified on target — and the action
duplicates the CONTAINER anyway.** Row 4 was correctly SKIPPED on the create gate,
and the fixture restored to baseline at all three levels.

⚠ **This is a much stronger ○ than the one it replaces.** The old ○ was an absence
("nothing happened, and we could not tell whether anything was even firing"). This
one is a *presence*: the action fires, lands somewhere specific, and that somewhere
is never the chain. §1a survives — with its wording changed from **"a chain is not
addressable"** to **"a chain IS addressable as a selection, and panel-focused
actions do not consume that address."**

### ⚠⚠ SETTLED by `e17x`: the panel's current DEVICE wins outright, and the chain selection contributes nothing

`e17v`'s fixture held exactly ONE device, so two mechanisms predicted its outcome
identically — **A.** the panel ignored our chain selection and used its current
device (necessarily the container); or **B.** the panel *consumed* the selection
and coarsened it to the chain's PARENT. Under B the gap would be a granularity bug
rather than a wall, so this had to be separated rather than assumed.

**The discriminator is a second, DISTINGUISHABLE device on the same track** — an
Organ after the container, so "the panel's choice" and "the chain's parent" name
different objects for the first time:

| arm | panel points at | chain selection | duplicated |
|---|---|---|---|
| gate A | container | — | **Instrument Layer** |
| control | ⚠ **Organ** | — | ⚠ **Organ** |
| ⚠ **THE DISCRIMINATOR** | ⚠ **Organ** | ⚠ **verified `Phase-4`** | ⚠⚠ **Organ** |
| gate B | container | — | **Instrument Layer** |

⇒ ⚠ **A, decisively.** The outcome tracks the **panel target** in all four cells and
is completely unmoved by the chain selection. The chain selection is settable,
readable, verified on target — and contributes **nothing** to what the action does.

⚠ **It also explains `e17v` retroactively**: on a one-device track the panel's
current device *is* the container, so "the container got duplicated" was never
about the chain at all. ⚠ Both readings of `e17v` were wrong in the same way — the
container was a coincidence of the fixture, not a finding.

⚠ **This narrows the reopening path rather than widening it.** Rows 3/4 are not a
granularity bug someone could round off; the device panel does not read the chain
selection *at all*. Reopening needs an action or API that reads it — not a
better-aimed version of what we have.

### ⚠⚠⚠ `e17y` — the selection was NEVER the blocker. Our own focus call is the prime suspect

With `addIsSelectedInEditorObserver` finally attached (`observing:8` — the split-`try`
fix worked, and its @Deprecated sibling still reads `FAILED@0` beside it):

| arm | who selected | observer flag | cursor | operator saw |
|---|---|---|---|---|
| baseline | — | none set | (none) | — |
| ⚠ **H: HUMAN click** | the operator | ⚠ **`Organ:EDITOR`** | Organ | "the Organ chain is what's selected" |
| ⚠ **C: our `selectInEditor()`** | us | ⚠ **`Phase-4:EDITOR`** | Phase-4 | "Phase-4 is selected" |
| L: `DeviceChain.select()` | us | `Polysynth:EDITOR` | Polysynth | "Polysynth is selected" |

⇒ ⚠⚠ **A human's click and our call set the IDENTICAL object.** Same reader, same
flag, no divergence. The "we cannot select a chain" framing — which three drafts of
`E17-VERDICT` §1a rested on in one form or another — is **dead**.

⚠ **And the operator settled it beyond argument, unprompted:**

> *"I deleted and then undid the operation, just to confirm it is indeed selected."*

**A chain that OUR call had selected was deleted by hand, successfully.** So the
selection we set is not a lookalike, not a highlight, not ambient — Bitwig honours
it. ⇒ **The blocker is not selection at all. It is our named-action dispatch.**

⚠ **Two predictions were wrong and are recorded as such:**
- `DeviceChain.select()` is @Deprecated and was expected to THROW like its sibling
  observer. It **returned**, and set the same flag. Deprecation is not uniform in
  this API — the legacy *observer* throws while the legacy *setter* works.
- The `NotificationSettings` device-layer oracle produced **nothing on any arm**,
  including the human click. It is uninformative here rather than contradicting;
  recorded so nobody re-runs it expecting a signal.

### ⚠⚠ The one variable separating the run that worked from every run that failed

`e17l` — where our `Copy`+`Paste` gave 4→5 and our `Delete` gave 4→3 on a chain —
**never called `focusDevicePanel()`.** `e17k`, `e17q`, `e17v` and `e17x` all did,
and none of them reached the chain.

    focus_or_toggle_clip_launcher  →  focus_or_toggle_device_panel

⚠ Both are **toggles, not setters**, and that round trip is *ours* — added to
"focus from a known state". The plain reading is that it resets the device panel's
target to its default DEVICE, which is exactly what `e17x` measured and recorded as
"the panel's current device wins outright".

⚠ **That does not make `e17x` wrong; it makes it SCOPED.** Its finding holds *with
the panel explicitly focused* — a condition we imposed on ourselves and never
varied.

### ⚠ `e17z` — the focus-toggle hypothesis is DEAD, and the arms are still informative

Three focus regimes, one variable, flag verified SET at firing in every arm, all
four container-reference gates alive:

| arm | focus | flag at firing | result |
|---|---|---|---|
| A | ⚠ **none** (the `e17l` condition) | ● set | ⚠ **○ nothing at all** |
| B | full toggle (the failing recipe) | ● set | ◐ container |
| C | panel only, no launcher | ● set | ⚠ **○ nothing at all** |

⇒ **The toggle was not the explanation.** ⚠ But it does decide whether the action
has *any* target: with it the action lands on the container, without it nothing
happens whatsoever. **Neither is ever the chain.**

⚠ **Two hypotheses died here in one session** — the foreground gate (`e17m`
rescued it) and now the focus toggle. Both were mine, both were plausible, both
were single explanations for an outcome with more than one cause.

### ⚠⚠ What is left, stated exactly: the same flag, the same action, opposite outcomes

| | who set the selection | who fired | result |
|---|---|---|---|
| `e17l` arms B/C | ⚠ **human click** | us, `invokeAction` | ⚠ **● 4→5, and Delete 4→3 by channelId** |
| `e17z` arms A/B/C | ⚠ **our `selectInEditor()`** | us, `invokeAction` | ⚠ **○ never the chain** |
| `e17y` | either | — | ⚠ **the observer flag is IDENTICAL** |

⚠ **`e17l` was re-read before building on it and it holds**: it asks the human to
confirm our own read had not stolen the selection first, so its ● is not an
instrument artifact.

⇒ ⚠ **The click carries something the selection model does not**, and
`invokeAction` dispatches against *that*, not against the flag. The leading
candidate is input/keyboard FOCUS on the chain lane widget — but that is a
hypothesis, and the last two died.

### ⚠⚠⚠ `e17aa` — ROWS 3 AND 4 FLIP. Our selection IS honoured

| | |
|---|---|
| arm 1, baseline | human clicks Organ → we fire `Duplicate` → ⚠ **Organ duplicated, 4→5.** `e17l` reproduced with the reader attached |
| ⚠ **arm 2, the discriminator** | human clicks **Organ** → we call `selectInEditor(`**`Phase-4`**`)` → observer confirms `Phase-4`, operator's eyes confirm `Phase-4` → we fire → ⚠⚠ **`Phase-4` duplicated** |

⇒ ⚠⚠ **OUR SELECTION WON.** The chain that duplicated is the one *we* chose, not
the one the human clicked. **A layer chain can be created programmatically.** Every
○ from `e17k` through `e17z` was a missing precondition, not a missing capability,
and `E17-VERDICT` §1a — in all three of its drafts — is **void**.

### ⚠ Why it worked, and the one question left: is a HUMAN needed?

Two explanations survive `e17aa`, and they differ on the only thing a product cares
about. The mechanical difference between the runs is exact:

| | calls between the selection and the fire |
|---|---|
| ⚠ `e17aa` (worked) | `layer.selectionState` only — ⚠ **moves no cursor** |
| `e17z` (failed) | `levels()` and `scope()` first — ⚠ **both call `cursor.pointTrack`** |

  **(a)** the human's CLICK is required (input focus on a chain lane, which no API
  call we have reaches) ⇒ rows 3/4 are ◐ human-assisted, forever.
  **(b)** ⚠ **our own `cursor.pointTrack` destroys it.** That call is
  `CursorTrack.selectChannel()`, which **E16j proved sets the UI track selection** —
  so our own instrumentation would have been clearing the actionable state before
  every measurement ⇒ **no human needed, rows 3/4 ● outright.**

### ⚠⚠⚠ RETRACTED and re-measured COLD: a HUMAN CLICK IS REQUIRED

⚠ **`e17ab`'s first run was scored as cold and was not.** "COLD" meant *no click
inside the probe* — but the operator had been clicking chains throughout `e17y` and
`e17aa` in the same session. The claim *"no human is needed"* was never established.

⚠ **The operator then quit and reopened Bitwig to get a genuinely unprimed session**
and re-ran the identical probe. It is self-bracketing — the COLD ○ is only
meaningful because the PRIMED arms succeeded in the same sitting:

| arm | gesture | result |
|---|---|---|
| ⚠ **COLD** — genuinely unprimed | none | ⚠⚠ **4→4, ○ nothing** |
| PRIMED 1 | one click, then unaided | 4→5 +Phase-4 ● |
| PRIMED 2 | still unaided | 5→6 +Polysynth ● |
| PRIMED 3 | still unaided | 6→7 +Organ ● |
| DESTROYER | + `cursor.pointTrack` | 7→7 ○ — replicated cold |
| ROW 4 | re-primed, `Delete` | 7→6 −Phase-4 ●, no track lost |

⇒ ⚠⚠ **ROWS 3 AND 4 ARE ◐ HUMAN-ASSISTED, not ●.** A chain branch cannot be minted
autonomously. For a take system that is a material limitation, not a footnote: the
user must click a chain before the extension can create or destroy one.

### ⚠⚠⚠ THE MECHANISM: named actions target the most recently FOCUSED UI element

⚠ The operator pushed on "priming" — *"a plausible but odd mechanism, especially
that moving the track cursor to a different track affects it in the same way"* —
and asked for it to be tested with a **different** chain action. `e17ag` used
`Delete` (independently ● in `e17ab`/`e17ae`) across six arms:

| arm | condition | result |
|---|---|---|
| 1 | COLD, no click since project open | ○ nothing |
| ⚠ 2 | human clicks the **TRACK HEADER** | ⚠⚠ **deleted the TRACK** (see below) |
| 3 | human clicks a **chain lane** | ● 4→3, named survivor |
| 4 | our `pointTrack` to the **SAME** track | ● 4→3 — harmless |
| 5 | our `pointTrack` **away and back** | ○ nothing |
| 6 | human clicks a chain again | ● 4→3 — recoverable |

⇒ ⚠⚠ **One rule explains every observation in E17:**

> **A named action acts on whatever UI element the human last gave FOCUS to.**
> Our API calls set selection *models*; they never deliver focus.

- chain lane focused → `Delete` removes the chain
- ⚠ **track header focused → `Delete` removes the TRACK**
- nothing focused since load → the action does nothing at all
- switching tracks re-renders the device panel and discards the focused widget;
  re-pointing at the **same** track does not re-render, so focus survives (arm 4 vs
  arm 5 — same call, opposite outcome, and that pair is the proof)

⚠ **The operator's objection is answered: the reload case and the track-switch case
are not two coincidences.** Both leave no focused chain widget. Nothing odd remains.

⚠ **It also retro-explains two older results with the same rule** — E6 blocker 3's
seven orphan duplicate tracks (focus was a track, `Duplicate` duplicated tracks) and
E16j's `Group` wrapping exactly the selected track.

⇒ ⚠⚠ **PRODUCT HAZARD, now with a precise trigger.** Our chain `Delete` is only
safe while a chain lane holds focus. **If the user's focus is on a track, the same
call destroys a track.** Any shipped code path that fires a chain action must
establish and verify chain focus, and there is no API to do so — which is E6
blocker 3 restated at chain granularity.

### ⚠⚠ `e17ag` arm 2 DELETED A TRACK AND REPORTED `●● REMOVED Sampler`

⚠ The operator caught it: *"Arm 2 actually deleted the whole track, not just the
chain — was that intended?"* It was not, and the probe could not see it.

`Delete` destroyed `gn-lay4`. `scopeContainer()` then read index 9, which after the
deletion was **`gn-sel`** — and `gn-sel` holds exactly 2 chains. Hence the
impossible `4 -> 2`, scored as a success. ⚠ `app.undo` restored the track **with its
`channelId` intact** (`9a88b37d`, still matching `e17ad`'s snapshot), so nothing was
lost — but that was luck, not design.

**Four faults, and the last one is the general lesson:**
1. the integrity check looked for tracks **added**, never **removed**;
2. no sanity bound on the delta — one `Delete` cannot change a chain count by −2;
3. `scopeContainer()` ignored its own poll result and read whatever was there;
4. ⚠ the subject was trusted **by index** after an action that can shift indices.

⇒ ⚠⚠ **This is the first instrument failure in E17 that was DESTRUCTIVE rather than
merely wrong.** Every guard now added is the same guard: **after any action, verify
the SUBJECT still exists by `channelId` before believing a single reading taken
below it**, and refuse on an impossible delta rather than recording it.

### ⚠ The PRIMING model, as measured

Taking both `e17ab` runs together — the first is now readable as the WARM arm — the
picture is complete and consistent:

| session state | click in probe | result |
|---|---|---|
| warm (clicked earlier in `e17y`/`e17aa`) | none | ● worked |
| ⚠ **cold** (fresh project load) | none | ⚠ **○ nothing** |
| cold | ⚠ **one click** | ● and it holds for ≥3 further cycles |

**Priming SURVIVES:** our `layer.select` calls, our `Duplicate`/`Delete` actions,
repeated cycles, and `cursor.pointTrack` **to the same track**.
⚠ **Priming is DESTROYED by:** moving the track cursor to a **different** track and
back (`DESTROYER`, replicated in both runs), and by a **project reload**.

⇒ ⚠ **This retro-explains the whole spike.** Most E17 named-action probes ran
unprimed, or primed-then-destroyed by their own `cursor.pointTrack`. The ○s were
real observations of a precondition we did not know existed.

### ⚠⚠ `e17ah` — THE PRIMER SWEEP: 10 candidates, all ○, both human controls ●

The question, stated precisely: **can anything WE call put focus into a container's
chain list?** Selection was never the problem — it is ours and verified. Focus is
the only missing ingredient.

| primer | result |
|---|---|
| ⚠ **POS-A: human chain-lane click** | ⚠ **●● CHAIN+1** |
| A `device.selectInEditor(container)` then select a chain | ○ |
| B `Channel.selectInMixer()` — `e17s`'s *"scopes the panel into the chain"* | ○ |
| C `devcursor.selectFirstInLayer(2)` | ○ |
| D `layer.selectLegacy` — `DeviceChain.select()`, returns rather than throwing | ○ |
| E `Enter Group` | ○ |
| E `Expand Item` | ○ |
| E `Focus widget below` | ○ |
| E `Focus widget to the right` | ○ |
| E `Select Next` | ○ |
| E `toggle_children_expanded_state` | ○ |
| ⚠ **POS-B: human chain-lane click** | ⚠ **●● CHAIN+1** |

⚠ **Why this ○ is worth more than the session's earlier ones.** Both human controls
passed, bracketing the run, so the ○s are not drift or a dead gate. **Each arm
carried its own negative control** — reset, fire with no primer, confirm ○ — so a
reset that stopped working could not manufacture a false ●. Every arm was
`pointTrack`-reset, and every outcome was constrained to exactly two legal states
(UNCHANGED or CHAIN+1 of the named target) with anything else aborting.

⚠ **And the off-subject check the operator asked for.** `snapshot()` verified the
track list by identity but **never looked inside any track but the subject** — so a
`Duplicate` landing elsewhere would have read as ○ everywhere. The operator spotted
the risk by eye: *"the track that was briefly switched to each time seemed to have
several duplicated layers."* ⚠ A full read-only inventory (`e17-fullinv`) cleared it:
every track matches its documented state. What they saw was **track 0, the track
literally named `Instrument Layer`, carrying its documented EIGHT stacked containers**
— pre-existing, untouched, and an unfortunate choice of reset track on our part
(now changed to an empty one, and a cross-track content fingerprint added).

⇒ ⚠ **There is no chain equivalent of `Device.selectInEditor()`.** That call both
focuses the device row and selects a device (`e17t`); `DeviceChain.selectInEditor()`
only selects. Ten candidates, swept, none supplies focus.
⚠ **This is a swept ○, not proof of impossibility** — but it is the strongest
negative in E17 and the search space it covers is the whole of what we can reach.

⚠ **One observation from the operator that matters for the product:** *"the primed
state is NOT visibly different from the unprimed state."* So a user cannot tell by
looking whether the extension will work, and neither can we ask them. A precondition
that is invisible to everyone is worse than one that fails loudly.

### ⚠ Which measurements depend on session state, and which do not

| kind | primed session needed? |
|---|---|
| ⚠ named actions fired at a CHAIN (rows 1, 3, 4, `Ungroup`, named paste) | ⚠⚠ **YES — must be primed** |
| typed API verbs (row 2 duplicate, row 4's `deleteObject`/`host.deleteObjects`) | no — they never touch the UI selection |
| row 5 naming, row 6 solo | no |
| §1b `channelId` durability (`e17ad`) | no — typed reads; a reload is inherent to it |
| VU/audibility measurements | no |

### ⚠ Superseded: the earlier "(b), no human needed" reading

| arm | what it did | result |
|---|---|---|
| ⚠ **COLD** | no click, no priming, hands off Bitwig entirely | ⚠⚠ **4→5, +Organ ●** |
| PRIMED 1 | one click, then unaided: select Phase-4, fire | 5→6, +Phase-4 ● |
| PRIMED 2 | unaided: select Polysynth, fire | 6→7, +Polysynth ● |
| PRIMED 3 | unaided: select Organ, fire | 7→8, +Organ ● |
| ⚠ **DESTROYER** | same recipe **+ `cursor.pointTrack`** | ⚠⚠ **8→8, nothing ○** |
| ⚠ **ROW 4** | select Phase-4, fire `Delete` | ⚠⚠ **8→7, −Phase-4 ●**, no track lost |

⇒ ⚠⚠⚠ **ROWS 3 AND 4 ARE ● OUTRIGHT.** A layer chain can be created and destroyed
programmatically, with no human gesture, naming the survivor every time. The layer
model has a **complete branch lifecycle**.

⚠ **The DESTROYER arm is a positive control for the CAUSE, not just the effect** —
identical recipe, one extra call, and it stops working. `cursor.pointTrack` is
`CursorTrack.selectChannel()`, which **E16j proved sets the UI track selection**;
selecting the track clears the chain as the actionable target. Our own
instrumentation called it before nearly every measurement in this spike.

⇒ **`E17-VERDICT` §1a is void in full**, in all three of its drafts. `e17aa`'s
human click was a red herring: it merely re-established what our own read had
cleared.

### ⚠⚠ Which earlier E17 results are CONTAMINATED by this, and which are not

The wound only reaches measurements where a **named action** was fired at a chain
after one of our cursor moves. Typed API verbs are unaffected.

| result | named action? | status |
|---|---|---|
| ⚠ **row 1** — `Group` makes a one-chain container that *"cannot grow to two"* | ⚠ yes | ⚠⚠ **SUSPECT — re-measure.** `Duplicate` on a selected chain now demonstrably adds one, so a one-chain container almost certainly CAN grow |
| ⚠ `e17i` — group depth, `Ungroup` ○ | ⚠ yes | ⚠ SUSPECT |
| ⚠ `e17j` — clipboard `paste()` | ⚠ yes | ⚠ SUSPECT |
| `e17k`/`e17p`/`e17q`/`e17v`/`e17x`/`e17z` ○s | yes | ⚠ **superseded — all measured the cleared state** |
| row 2 — duplicate a layer, 3 typed mechanisms | no | ● unaffected |
| row 4 typed verbs (`deleteObject`, `host.deleteObjects`) | no | ● unaffected — they genuinely refuse; the NAMED action is what works |
| rows 5, 6 — naming, solo | no | ●● unaffected |
| §1b — chain `channelId` not durable | no | ● unaffected |

⚠ **The §5 consequence is the big one and it is STILL NOT measured.** The verdict
argues *"containers ship with zero chains, `Group` gives exactly one, and nothing
we can call seeds a second — so a multi-chain container is a human-authored
`.bwpreset` via `insertFile`"*, making rule 11 / E4h / `bwmod`'s offline chain trim
load-bearing dependencies of the whole A/B story. **If row 1 re-measures ●, that
entire dependency chain dissolves.** Do not rely on §5.

### ⚠⚠ `e17ac` IS VOID — two faults, both mine, and the second is the instructive one

The first attempt to re-measure row 1 produced three ○s. **None of them count.**

**1. The blind spot, for the THIRD time.** `growAttempt` measured only
`chainsNow()`, so when `Duplicate` copied the CONTAINER the reading printed
*"chains 1 -> 1"* — nothing happened. The next section's device list gave it away:
`[Instrument Layer, Instrument Layer]`. This is the `e17p` failure, which was
diagnosed in `e17v`, written up as a method trap, and then written again.

**2. ⚠ The CONFOUND, which is worse than the blind spot.** To make `Group` build a
container, the recipe calls `device.selectInEditor(0)` — and **`e17x` proved that
call sets the device panel's current device, which beats the chain selection.** So
the build step poisoned the measurement that followed it. `e17ab` succeeded
precisely because it never called `device.selectInEditor` at all.

⇒ ⚠ **A probe's SETUP is part of its experiment.** The confound was not in the arm
under test; it was in the scaffolding built to reach the arm. Nothing in the
"one variable" discipline catches that, because the variable really was held
fixed — it was the constant that was wrong.

⚠ **`e17ae` re-does it without needing `Group` at all**: `gn-lay4` already has a
container and `Delete` now works, so the chain COUNT is varied on an existing
container using only the recipe proven clean, and `device.selectInEditor` is never
called. It carries a positive control that grows a 4-chain container **in the same
sitting** — the thing `e17ac` lacked, and the reason its ○ was uninterpretable.

### ⚠ Method: the first `e17v` run was void, and how it was caught

The first attempt read Δ0 on every arm — and **the container reference arm read Δ0
too**, so dispatch had stopped between the control passing (round 8, 47 s) and the
arms running. The probe refused to score rather than banking three false negatives.

⚠ **The confound is procedural**: the operator brought Bitwig forward to satisfy
the gate, then alt-tabbed to their terminal to send a message, and the gate closed
behind them. **A foreground-gated probe and a live conversation cannot share one
screen** — see the standing instruction recorded below.

⚠ **The fix is ordering, not effort.** The reference arm originally ran LAST, so a
dead gate was only discovered after the whole run was spent. It now runs **before,
between and after** every chain arm, and aborts on the first failure — which turns
a void run into an early refusal, and is what makes the table above trustworthy.

⚠ One blind spot was checked rather than assumed: `e17v`'s reading took
`devices[0]` per chain, so a `Duplicate` landing *inside* a chain would have been
invisible — the `e17p` failure one level down. `e17w` inventoried every device in
every chain: `gn-lay4` is byte-for-byte its baseline. (`gn-lay` chain 0 `A·take`
holds `[Polysynth ×3]`, on a track `e17v` never touched — consistent with the
earlier chain-FILL routes, and recorded as unexplained rather than assigned.)

### ⚠ The contamination that produced that table, and what it did NOT touch

⚠ **`e17p` stacked duplicate containers onto `gn-lay4` and could not see it doing
so** (method trap 5 below). The user then reported having noticed the duplicates
*"quite a while ago"*, which dates them EARLIER than `e17p` — its own control
printed FOUR containers after a single `Group`, so ~3 pre-existed. The window is
`e17k` → `e17p`, and every ○ in it was a container duplication misread as
"nothing happened".

⚠ **Two separate piles, and only one was ours.** The track literally named
`Instrument Layer` (track 0, Hybrid) carries **8 stacked containers of the E4g
shape** and always has — they are visible in the first truthful `e17-diag`, before
any of this, and no E17 probe ever addressed track 0. They are a leftover fixture
from an earlier session, and they are also what the stale-read bug kept bleeding
into other tracks' listings.

**What was re-measured rather than argued** (`e17q`, on a fixture proved clean at
`devices=1/itemCount=1` first):

- ⚠ **Row 4's typed deletes** — the single most load-bearing ○ in the session.
  Re-run clean: both still refuse, chain `channelId`s byte-identical before and
  after.
- **Every selection mechanism** — the table above.
- **The fixture restored exactly** at all three levels afterwards.

**What was never at risk, and why** — the contamination lived entirely in
`gn-lay4`'s DEVICE list, one level above the chains every reading used:

| measurement | fixture | status |
|---|---|---|
| rows 1, 2, 3 (typed), 5, 6 | `gn-lay`, `gn-A`, `gn-sel` — one container each | outside the window entirely |
| row 4 typed delete | `gn-lay4` | ⚠ **re-run clean, same result** |
| the persistence rows | `gn-lay` + `gn-sel` (1 device each) **and** `gn-lay4` | replicates on two uncontaminated containers |
| rows 3/4 reachability | `gn-lay4` | ⚠ **re-run clean, result strengthened** |

⇒ **No conclusion changes.** One interpretation gets stronger.

**Free rider: `app.undo` removes a chain** — the only mechanism that does, since
every typed delete refuses. Used as this session's only chain-cleanup route.

### ⚠⚠ A layer's `channelId` does NOT survive save + restart

The E2f question, never asked of layers until now, and it is an independent nail.
Captured before saving, compared after (`e17n`):

| | before → after |
|---|---|
| **track** `channelId` ×3 | ● unchanged (E2f re-confirmed) |
| chain count ×3 containers | ● unchanged |
| ⚠ **chain `channelId` ×8** | ⚠ **ALL EIGHT CHANGED** |
| chain names ×8, incl. `A·take` | ● all survived |

### ⚠⚠ §1b RE-CONFIRMED under a fingerprint gate — and the artifact `e17n` could not exclude

⚠ **The user asked the right question: could the changed ids have been our own
mess?** `e17n` reads chains via `devcursor.selectAt(deviceIndex: 0)` and **never
asserts how many containers are on the track.** During the `e17k`→`e17p` window
`gn-lay4` carried stacked duplicates, so if index 0 held a different container at
snapshot than at verify, we compared **two different objects** — and a duplicate
container has identical chain NAMES with different IDS. ⚠ **The artifact predicts
the exact table `e17n` recorded.**

`e17ad` re-ran it with the two controls `e17n` lacked:

**PHASE 1 — the question never asked: is `channelId` stable WITHIN a session?**
Five reads of `gn-lay4` — back-to-back, after re-selecting the container, after a
track-cursor round trip, after a wait — **identical every time**
(`867ee297 4a0d0d5d 28f5be64 102d0b4e`). ⇒ It IS a real in-session identity, not a
per-read handle. That matters: had it been unstable, §1b would have been true for a
much stronger reason and the "does not survive a restart" framing would be wrong.

**PHASE 2 — a STRUCTURAL FINGERPRINT gate.** Container count, chain count, chain
names and device contents captured at both ends; ⚠ the verify **refuses to compare
ids at all** unless the fingerprint matches, so "we read a different container" can
never masquerade as "the ids changed". All three tracks passed the gate at
`containers=1/1`:

| track | track `channelId` (E2f control) | chain ids | chain names |
|---|---|---|---|
| `gn-lay4` ×4 chains | ● `9a88b37d` unchanged | ⚠ **all 4 changed** | ● all kept |
| `gn-lay` ×2 chains | ● `d367ac16` unchanged | ⚠ **both changed** | ● both kept |
| `gn-sel` ×2 chains | ● `6fb96670` unchanged | ⚠ **both changed** | ● both kept |

⇒ ⚠ **8/8 ids changed, 8/8 names survived, with the track ids unchanged in the same
read.** The track control is what rules out a broken reader. **§1b stands, and this
time the artifact is excluded by construction rather than by argument.**

⚠ Incidentally a FOURTH disjoint id set for `gn-lay4`, distinct from the three
below — consistent with regeneration on every load.

⚠ **Previously** (kept for the record, and NOT independently trustworthy):
replicated across a second save + restart on a fixture believed clean at the time.
`gn-lay4`'s four chains carried three disjoint sets of ids across two reload
cycles:

| generation | `gn-lay4` chain ids |
|---|---|
| before the 1st save | `28b7a8b7 7eb5bf9d 2decef2a 407011d4` |
| after the 1st restart | `7f7c729c 001823fa 226030bf 4893bf75` |
| after the 2nd restart | `05259794 f7fe3663 82c606e0 b3bd0010` |

…while `A·take` survived **both** cycles. Two independent replications, and the
name outlives the id every time.

⇒ ⚠ **E16w's "free rider: layer chains have their own `channelId`" is retired as
an identity story.** A chain's `channelId` is a **session handle, not a key**. Even
if a chain could be created and deleted, no take could be durably identified
across sessions — and addressing by index is precisely what D6 forbids.

⇒ ⚠ **And the inverse, which is the useful half: for a layer chain the NAME is the
only durable identifier.** That inverts D6 one level down — for tracks
`channelId` is the key and the name is the human tag; for chains there is no key
and the tag is all there is.

### ⚠⚠⚠ Row 1's SECOND half is OVERTURNED — a one-chain container grows freely

The claim *"`Group` gives exactly one chain and nothing we can call seeds a
second"* is **false**. `e17ae`, in a primed session, on the corrected harness
(no `device.selectInEditor`, no mid-sequence `cursor.pointTrack`, all levels read):

| step | result |
|---|---|
| CONTROL: grow at 4 chains | 4→5 ● — the recipe is live in this sitting |
| SHRINK: `Delete` ×3, named survivor each time | 4→3→2→1 ● |
| ⚠⚠ **QUESTION: grow at ONE chain** | ⚠⚠ **1→2 ●, `Δdevices=0`** |

⇒ **Chain count does not gate growth.** `Group` still yields one chain — that half
stands — but `Duplicate` then grows it without limit.

⚠ **`e17ac`'s ○ on this question was our own scaffolding**: to build a container it
called `device.selectInEditor`, which `e17x` had already proven overrides the chain
selection. The setup poisoned the arm.

⇒ ⚠ **§5's dependency is WEAKENED, not dissolved** — an earlier draft of this entry
overstated it and the operator's question is what caught it. A multi-chain container
*can* be built at runtime from `Group` + `Duplicate`, **but both are named actions
and therefore need the human click** (`e17ab` cold). So:

| route to a multi-chain container | autonomous? |
|---|---|
| runtime: `Group` + `Duplicate` | ⚠ **no — needs priming** |
| preset: `insertFile` a `.bwpreset` | ⚠ **● yes — fully typed** |

⇒ **Rule 11 / E4h stop being the ONLY way to get a multi-chain container, but they
remain the only way to get one WITHOUT a human click.** The preset route is the
autonomous route.

### ⚠⚠⚠ RETRACTED: a chain CAN be created by a TYPED call. It needed a SELECTION all along

⚠ **The operator predicted this**: *"those are the ones that really seem like they
should have worked from the start."* They should have, and they do.

`e17ak`, on a **fresh FX Layer that had never been selected or clicked**, four arms,
each on a rebuilt container:

| arm | selection flag at the call | result |
|---|---|---|
| A no primer | none | ○ |
| ⚠⚠ **B `layer.select(editor, 0)`** | ⚠ **chain 0** | ⚠⚠ **●● CHAIN CREATED** |
| C `layer.pointCursor(0)` | none | ○ |
| D `insertViaCursor` | none | ○ |

⇒ ⚠⚠ **`Channel.duplicate()` requires the chain to be SELECTED — and `layer.select`
is OURS.** Typed, no focus, no priming, no foreground, no human. `e17y` had already
proved it sets the identical flag a human click does.

## ⇒ **CHAIN CREATION IS FULLY AUTONOMOUS: `layer.select` + `layer.duplicateChannel`.**

⚠ **Why the whole spike missed it.** Every earlier probe scoped the **device cursor**
to the container — the e16o discipline — and never selected a **chain**. `e17b`,
`e17f`, `e17q`, `e17aj` CELL 1: all the same omission. `e17aj` CELL 3 succeeded only
because `gn-lay4` still carried a selection from the operator's clicking, which is
also why it looked like container type mattered.

⚠ **Two verbs that were always reported together turn out to differ:**

| verb | with a selection |
|---|---|
| ⚠ `Channel.duplicate()` (`layer.duplicateChannel`) | ⚠ **● creates a full chain copy** |
| `DeviceLayer.duplicateObject()` (`layer.duplicate`) | ○ genuinely dead |

⚠ **And a bootstrap consequence for §5.** A fresh **FX Layer ships with ONE chain**
while a fresh **Instrument Layer ships with ZERO** (`e17ai`). So an FX Layer can be
grown from nothing — insert it, select chain 0, duplicate, repeat — **entirely
typed, no preset and no human**. An Instrument Layer has no first chain to copy, so
it still needs a preset or `Group`. ⚠ §6's use case is the **Master and the FX
returns**, where an FX Layer is exactly the container you would use.

### ⚠ CORRECTION: `Ungroup` is NOT a route around the missing delete

An earlier suggestion in session 6 was *"delete all but the chosen chain, then
`Ungroup`"* — the device-level analogue of E16 K3. ⚠ **The operator caught that it
is circular:** K3 works at TRACK level *because track delete works*, and at device
level delete is the blocked thing, so it cannot be step one.

⇒ `Ungroup` is worth re-measuring as a loose end (its ○ came from the broken
harness) but it is **not** a simplifier for collapse. The operator's shape is
genuinely new and needs no `Ungroup`:

    reduce    clone the container with fewer chains, migrate devices, delete the old
    collapse  migrate the chosen chain's devices out to top level, delete the container

⚠ Deleting the CONTAINER is already ● (`Device.deleteObject()`). What gates the whole
strategy is a direction never tested: **moving a device OUT of a chain**, and across
chains/containers. E16n only ever measured top-level → chain. See
`HANDOFF-E18-BRANCH-UNLOCK.md` §3.1.

### ⚠⚠ DESTROY: exhausted, with a MECHANISM that predicts the ○

The operator pushed after CREATE was overturned: *"odd that duplicate works after
all but delete does not."* A type sweep makes the two receivers **siblings**:

    Channel extends DeviceChain, DeleteableObject, DuplicableObject
       ↑                              ↑
    Track                        DeviceLayer   ← `interface DeviceLayer
    + isGroup, position, …                        extends Channel {}` — EMPTY BODY

`track.delete` calls `Track.deleteObject()` and works every time; **the same
inherited method refuses on a `DeviceLayer`.** So `e17am` tried the one remaining
form, with the `Track` sibling as the control:

| declared on | method | on a `DeviceLayer` | on a `Track` |
|---|---|---|---|
| `DuplicableObject` | `duplicateObject()` | ○ | — |
| `DuplicableObject` | ⚠ `duplicateObjectAction()` | ⚠ **○** | — |
| ⚠ **`Channel`** | ⚠ **`duplicate()`** | ⚠⚠ **● creates a chain** | — |
| `DeleteableObject` | `deleteObject()` | ○ | ⚠ **● deletes** |
| `DeleteableObject` | ⚠ `deleteObjectAction().invoke()` | ⚠ **○** | ⚠⚠ **● deletes** |
| `Channel` | — | ⚠ **declares no delete at all** | |

⇒ ⚠⚠ **THE MECHANISM: a `DeviceLayer` honours the verb `Channel` declares ITSELF,
and declines every verb it merely INHERITS.** `Track` honours all of them because a
track is a first-class deletable object. That **predicts** the ○ rather than merely
recording it — there is no Channel-level delete for a layer to honour, so there is
nothing left to try.

⚠ **Both `DeleteableObject` forms are now exhausted**, each tested with and without
the selection precondition that unlocked CREATE, and each bracketed by the sibling
control passing in the same run. This is the best-founded ○ in E17.

⚠ **A rule-13 violation produced three false ○s first, and it is worth recording.**
The initial attempt called `deleteObjectAction()` lazily inside the handler and every
arm threw *"This can only be called during driver initialization"*. A
`HardwareActionBindable` is a Bitwig RESOURCE and resources are init-only — standing
rule 13, written down long before, walked straight past. The handles are now held at
init in separate try blocks, each reporting its own status, and the probe **aborts**
unless `handleStatus` reads `held:N`. ⇒ ⚠ *"The handle does not exist"* and *"the
layer declines"* are indistinguishable in the outcome; any probe invoking a
`*Action()` must prove the handle first.

### ⚠ DESTROY is NOT autonomous — the asymmetry, measured

`e17al`, same recipe, two distinguishable chains so a survivor is NAMED:

| arm | flag at the call | result |
|---|---|---|
| A no selection on the target | chain 0 | ○ |
| ⚠ B `layer.select(1)` + `DeviceLayer.deleteObject()` | ⚠ **chain 1** | ○ |
| ⚠ C `layer.select(1)` + `host.deleteObjects()` | ⚠ **chain 1** | ○ |

⇒ **The typed deletes really do refuse**, and now for a properly founded reason: the
precondition that unlocked CREATE does nothing for DESTROY. Removal remains
named-action-only (human focus) or `app.undo`.

⇒ ⚠ **The branch lifecycle is ASYMMETRIC: mint autonomously, remove only with help.**

### ⚠ The typed/named split, and why it decides the whole use case

None of the `layer.*` handlers call `invokeAction` — verified by reading them. Every
chain operation is typed API **except create and destroy**, whose typed verbs
(`deleteObject`, `deleteObjects`, `duplicateObject`, `duplicateChannel`) all refuse:

| operation | route | autonomous? |
|---|---|---|
| solo a chain (the A/B gesture) | `DeviceLayer.solo()` | ● typed |
| rename a chain | `DeviceChain.name()` | ● typed |
| fill a chain | `moveDevices` / `insertBitwigDevice` / `pasteInto` | ● typed |
| insert a whole container | `insertFile` | ● typed |
| ⚠ **create a chain** | typed verbs refuse → `Duplicate` only | ⚠ **named ⇒ needs a click** |
| ⚠ **destroy a chain** | typed verbs refuse → `Delete` only | ⚠ **named ⇒ needs a click** |

⚠ **And the focus requirement is CHAIN-SPECIFIC, not a property of named actions.**
Track-targeted ones fire autonomously (E16j: `Group` backgrounded and minimised, 5/5,
against a `cursor.pointTrack` selection); device-targeted ones fire autonomously
(`Device.selectInEditor` supplies focus AND selection, `e17t`). Chains are the one
level where we can set selection but not focus.

⇒ ⚠⚠ **CONSEQUENCE FOR §6, and it is the useful half:** a **fixed-shape** A/B
fixture never creates or destroys a chain at runtime, so it **never touches a named
action and is fully autonomous**. The human-click limitation bites only if the shape
must change at runtime. §6 already froze the shape at authoring time; that is
precisely what dodges the problem.

⚠ **UNTESTED and load-bearing for §6:** `insertFile` has never been run against the
**Master or an FX return**. The entire "layers are the only device-scoped A/B that
reaches them" argument assumes a container can be placed there autonomously. That is
an assumption, not a measurement — and it is a cheap typed probe with no focus
dependency.

### ⚠ Row 1 — `Group` DOES create a chain, and E4d route 7's ○ is wrong

With the device panel focused and a device selected, the named action `Group`
turned `[Polysynth, Polysynth]` into `[Instrument Layer, Polysynth]` with the new
container reporting **1 chain holding the Polysynth**. A device chain came into
existence programmatically. That is the second time a *"no named action does
this"* ○ has fallen to E16j's shape.

⚠ **Two things had to be fixed before the row was probeable at all, and both are
findings in their own right.**

1. **`devcursor.selectAt` does NOT set Bitwig's UI selection.** It calls
   `CursorDevice.selectDevice()` on a cursor track created with
   `shouldFollowSelection=false`, so it moves *our* handle and leaves Bitwig's
   selection alone. `Device.selectInEditor()` is the actual setter and was not on
   the wire. **So row 1 was never ○ — it was unreachable**, and every previous
   argument about device-scoped actions concerned a selection nobody had set.
2. ⚠ **The device-panel gesture needs Bitwig in the FOREGROUND** — measured
   properly in `e17m` after a first, wrong diagnosis (below). **0/8 backgrounded**
   across both focus regimes, against ● every time frontmost. In the same runs
   `Create Group Track` (a **Project** action) fired backgrounded in 282–286 ms.
   ⚠ **The mechanism is UNEXPLAINED and the obvious generalisation is false:**
   E16j ran `Group` — an *Editing* action — backgrounded AND minimised across 5
   runs and it fired every time, on a TRACK selection. So the rule is not "Editing
   actions need foreground"; it is narrower and stranger — *this device-panel-routed
   gesture* does, and track-selection actions do not. Recorded as an empirical
   rule, unexplained, exactly as E16j recorded its own discrepancy.

**But one chain is not a branch, and it never becomes two:**

| follow-up (`e17i`) | result |
|---|---|
| group the neighbouring device — does it join as chain 2? | ○ **1 → 1**, the Organ stayed outside |
| ⚠ `Select All` + one `Group` — Bitwig's own multi-device gesture | ○ **1 chain holding `[Polysynth+Organ+Phase-4]` in SERIES** |
| group the container itself | nests, does not grow |
| ⚠ **`Ungroup`** — the missing counterpart | ○ **the container survives** |

⇒ ⚠ **`Group` is a device WRAPPER, not a take container.** It always produces
exactly one chain, whatever is selected, and nothing dissolves it again. E4e's
architectural negative survives where it matters: **no route reaches a second
chain**, and the preset (E4d route 4) remains the only way to obtain one.

### Rows 2 and 3 — duplicate ○ and create ○, both now bracketed

E4d recorded routes 1 and 2 as silent no-ops **through a cursor-following bank
with no precondition assertion**, eleven days before E16o discovered that shape
produces a no-op byte-identical to an API refusal. Re-run with the container
proved selected before every call:

| | populated (2 filled chains) | empty (fresh FX Layer, 1 chain) |
|---|---|---|
| `DeviceLayer.duplicateObject()` | 2 → 2 ○ | 1 → 1 ○ |
| `Channel.duplicate()` | 2 → 2 ○ | 1 → 1 ○ |
| `host.duplicateObjects()` (3rd mechanism, `e17e`) | 2 → 2 ○ | — |
| ⚠ **VERB CONTROL** — the same verb on a `Device` | ● **1 → 2 in 280 ms** | |

Row 3 added the last two untried readings, against three fixture states:

| | 0 chains | 1 chain | 2 chains |
|---|---|---|---|
| insert via the CONTAINER-SCOPED cursor | 0 → 0 ○ | 1 → 1 ○ | 2 → 2 ○ |
| ⚠ **CONTROL** — `startOfDeviceChainInsertionPoint` | | | ● **a device landed in chain 0** |

⚠ **Row 3, route 3 — the CLIPBOARD, and it closes `InsertionPoint` completely.**
`paste()` was the **14th of 14** members and had never been called: `layer.pasteInto`
went on the wire in session 4 and sat unused, because filling the clipboard needs
`Application.copy()` on a UI selection and **nothing could set a device selection
until `device.selectInEditor` landed this session**. Row 1's ● also changed the
prior — the named-action surface demonstrably reaches into device-chain structure,
so `Paste` was worth aiming at a container.

| route | result |
|---|---|
| ⚠ **CONTROL** — `Copy` then `Paste` at top level | ● **2 → 3 devices**, so the clipboard is live and reachable |
| the named action `Paste` with the CONTAINER selected | ○ **chains 1 → 1** — the device landed BESIDE the container, not inside it |
| ⚠ **`layer.pasteInto`** (member 14/14) | ⚠ **● FILLS a chain: `0:[Polysynth]` → `0:[Polysynth+Organ]`**, chains 1 → 1 |

⇒ ⚠ **A new capability, small but real: a chain can be populated from the
CLIPBOARD.** That is a third route into an existing chain beside
`insertBitwigDevice` (E4c) and `moveDevices` (E16n) — and it is the only one that
**copies** rather than moves, so the human's own device can be auditioned inside a
container *without being taken off the track*. Useful for the residual role
(`E17-VERDICT.md` §5); useless for creating a chain.

⇒ **All 14 `InsertionPoint` members are now exercised.** Row 3's ○ rests on the
complete interface rather than on a sample of it.

⚠ **And row 3 produced the mechanism, not just the verdict: `cursorLayer0.exists()`
is FALSE on every container, including ones that HAVE chains.**
`createCursorLayer()` never acquires a referent unless something selects a layer,
so the insertion point had nothing to bind to — which is E4e's *"an
`InsertionPoint` must bind to a referent"* demonstrated rather than argued. A
javadoc sweep confirms the shape of the gap: **exactly 11 methods in the whole
API return an `InsertionPoint`, and not one hangs off a container `Device`.**

Complete-recall pass over the hole the previous sweeps left (standing rule 10):
**`Application` has 94 members** and contains no creation verb of any kind —
`navigateIntoTrackGroup` / `navigateToParentTrackGroup` are navigation.
**`DeviceLayerBank` declares exactly ONE member** (`getChannel`, and it is
`@Deprecated`).

### ⚠ Row 4 — DELETE is ○, and this is the row that decides the session

`DeviceLayer` extends `DeleteableObject`. **It does not honour it.** Four routes
on a 4-chain container (`[Phase-4, Polysynth, Organ, Sampler]`, four distinct
devices so every survivor is *named* rather than counted):

| route | result |
|---|---|
| `DeviceLayer.deleteObject()` | 4 → 4 ○ |
| `host.deleteObjects(layer)` | 4 → 4 ○ |
| `deleteObject()` after `layer.selectInEditor()` | 4 → 4 ○ |
| `host.deleteObjects` after `layer.selectInMixer()` | 4 → 4 ○ |
| ⚠ **VERB CONTROL 1** — `Device.deleteObject()` | ● **1 → 0 in 577 ms** |
| ⚠ **VERB CONTROL 2** — `host.deleteObjects()` on a clip slot | ● **emptied in 256 ms** |

Both controls fired **in the same run**, so the verb is alive and the refusal is
specific to layers.

⚠ **The direction is the OPPOSITE of the file format, which is worth more than
the row itself.** E10c/E10d found chains **removable** offline but not
insertable, and the handoff predicted the live API might show the same
asymmetry — *"two independent layers of the product showing the same asymmetry
would be a finding in its own right"*. They do not agree. Live, chains are
**neither** insertable nor removable; offline they are removable. So `bwmod`'s
chain trim is not a preview of an API capability — it is a **strictly
offline-only** one, and the only route to a chosen chain count.

### ⚠ Row 5 — rename ●, and it CORRECTS E4c

E4c recorded that a layer *"renames itself after its content"* and the handoff
inherited that as *"layer names are volatile, so the lineage tag needs a
different home"*. **An explicitly set name is sticky.**

| | |
|---|---|
| `layer.setName(0, "A·take")` | ● read back exactly — the middle dot round-trips, as E16q found for tracks |
| ⚠ then INSERT A DEVICE into that chain and re-read | ● **still `A·take`** |

⇒ E4c's observation is about the **default** name tracking content, not about the
API overwriting a name someone chose. **§1b's naming scheme would survive a move
to layers** — a human-readable, human-editable lineage tag can live in a layer
name. (Recorded even though rows 1–4 make the move moot: it is a standing
correction to E4c, and it applies to the preset-supplied containers §3 keeps.)

### ⚠ Row 6 — solo is CONTAINER-SCOPED and LOCALLY EXCLUSIVE ●●

The one row that came back better than hoped, and the only one still load-bearing
after the model call.

**Scope, measured silently.** `isMutedBySolo()` is marked at init and reported
per track by `branch.vu`, so the scope question needed no ears:

| | tracks flipped to `mutedBySolo` |
|---|---|
| ⚠ **CONTROL** — solo the TRACK `gn-lay` | **10** — the oracle can see a global solo |
| solo one CHAIN of its Instrument Layer | ⚠ **0** |
| `SoloValue.toggle(exclusive=true)` on a chain | ⚠ **0**, flag sets |

**Local exclusivity, measured by meter against a mute calibration.** "Not global"
is not "usefully exclusive" — a layer chain exposes no `isMutedBySolo`, so a
solo that does nothing locally reads identically to one that is politely scoped.
⚠ The mute-based A/B (E16w ●) supplies today's ground truth for each arm, which
makes this quantitative rather than an ear trial:

| state | subject's own tap |
|---|---|
| both chains open | 66 |
| chain 0 alone (by MUTE — calibration) | 63 |
| chain 1 alone, dark, F1FREQ 15.3 Hz (by MUTE — calibration) | **25** |
| ⚠ **SOLO chain 1** | ⚠ **23** — distance 2 from "chain 1 alone", **43** from "both open" |
| ⚠ **SOLO chain 0** (the mirror) | **60** — against "chain 0 alone" 63 |
| every solo cleared (CONTROL) | 67 |

⇒ ⚠ **This is the mutually-exclusive selection gesture the user asked for in
session 5's closing exchange** — *"internal exclusive solo among a group"* —
and it needs no selector and no routing. It also answers §4.4's real complaint:
the live state is **one flag per chain that is exclusive by construction**, not
E16m's N independent mute flags where a child's own flag says nothing.

⚠ **Deliberately stronger than an ear trial, and that is method rather than
convenience.** §3.4e had to state that a null ear result *"cannot distinguish
'no glitch' from 'this listener and rig could not have heard one anyway'"*.
Calibrating against the mute arms removes that whole class of caveat: the reading
lands on one of two numbers measured minutes earlier on the same fixture, and the
probe refuses to read the solo arms at all unless those two differ by ≥ 10.

### ⚠ Three method traps this session paid for

1. **A positive result does not need its control to pass; a NEGATIVE does.**
   `e17d` printed "INCONCLUSIVE" over a genuine ● because its verdict logic
   checked a failed control before the row's own result. The clip-launcher
   control had failed for an unrelated reason while the row itself succeeded —
   and the row succeeding *is* proof the dispatch path worked. Controls exist to
   make ○ meaningful, and ordering them ahead of a ● inverts that.
2. ⚠ **`device.list` right after `cursor.pointTrack` returns the PREVIOUS track's
   chain** — up to 6 of 13 tracks, reproducibly (`e17-diag`). A probe that
   baselines with that read is comparing two different tracks; the first `e17b`
   run did exactly that and its precondition caught it. ⚠ **And the obvious fix
   is not enough:** polling for *"two consecutive equal reads"* is satisfied
   immediately by a stale-but-*stable* value. **Wait on the cursor's own
   `trackPosition`** — the bank cannot have re-scoped before the cursor arrived.
   ⚠ This bit twice, and the second time is the instructive one: `e17-diag`, the
   diagnostic written specifically to expose this trap, used the two-equal-reads
   heuristic itself and reported `gn-lay` as holding `gn-E16`'s devices. An
   instrument built to detect a fault is not automatically immune to it.
3. **A predicate any wrong answer satisfies is not a check.** `e17-setup`'s first
   descend polled for *"a device whose name does not contain 'Layer'"* and went
   green in 43 ms against `Instrument Selector` — the previous fixture, which the
   cursor had never left. Name the expected object (the e16t rule) rather than
   excluding one wrong one.
4. ⚠⚠ **A RETRACTED DIAGNOSIS, recorded because the retraction is the lesson.**
   `focus_or_toggle_*` IS a toggle and therefore not idempotent — that much is
   true from the javadoc. On that basis a mid-session note claimed the toggle
   explained every dispatch failure and that the foreground gate did not exist.
   ⚠ **`e17m` then measured 0/8 backgrounded with focus handled deterministically,
   so the toggle explains nothing and the gate is real.** The `e17j` pair that
   looked decisive — fail, fix the toggle, succeed — had an unnoticed confound:
   the operator had said they were foregrounding Bitwig just before the failing
   run, and the succeeding run came a minute later. A timing effect was attributed
   to the fix. ⇒ **The toggle remains a real hazard in principle and has never been
   shown to cause a single failure.** Two rules fall out: *"the user brought Bitwig
   forward"* is never one variable, it is also *"the user clicked, changing panel
   focus"*; and a new explanation that contradicts an existing measurement (E16j's
   5 backgrounded runs) has to beat it, not walk past it.
5. ⚠ **A probe that fires a selection-scoped action must diff EVERY level the
   action could land on.** `e17p` swept 6 navigation candidates, firing `Duplicate`
   after each, and measured *chains inside device 0* and *devices inside those
   chains*. The navigation never moved the selection, so all six fires duplicated
   the CONTAINER — which changes neither quantity. The instrument was blind to its
   own side effect, the `app.undo` cleanup was gated on a signal that could not
   appear, and the fixture ended with **8 stacked Instrument Layers**. The row's ○
   is unaffected (chains were read through device 0 throughout), but the whole
   point of a selection-scoped action is not knowing where it landed.
6. ⚠ **The device cursor ORPHANS after a burst of deletes, and only a track-cursor
   MOVE recovers it.** After deleting 7 devices, `devcursor.status` read
   `exists:false, name:""`, and neither `devcursor.selectAt` nor
   `devcursor.selectInChannel` re-bound it — so `layer.list` reported the surviving
   container as having **zero chains**, which reads exactly like "the cleanup
   deleted the wrong ones". Pointing the TRACK cursor at another track and back
   restored all 4. E1/E3's "re-point after any structural op" needs the sharper
   detail: **the re-point must be a real move; re-pointing at the same track is not
   enough.**
7. ⚠ **Marking two handles in one `try` block means one bad call costs both.** The
   selection observers were added at init inside a single guard;
   `addIsSelectedObserver` is `@Deprecated` and threw *"This has been deprecated
   since API version 2"*, so `addIsSelectedInEditorObserver` — documented
   **current** — never attached either. The guard did its job (rules 9/13: the
   extension stayed up), but the readback that would have made `e17k`
   interpretable was lost to the same single-mechanism error the spike keeps
   finding elsewhere. ⚠ Chain selection therefore remains **unobservable** in this
   rig, which is why `e17l` needed a human at all.

### ⚠ The complete-recall pass, stated so the ○s can be audited

Prompted by a challenge that the sweeps might have been searching `chain`/`channel`
naming rather than `layer`. Re-run three ways, and the answer is the same each time:

- **By NAME:** exactly **8 members** in the whole 1968-member API contain "layer" —
  `Device.createCursorLayer` / `createLayerBank` / `hasLayers`,
  `CursorDevice.selectFirstInLayer`×2 / `selectLastInLayer`×2, and
  `NotificationSettings.setShouldShowDeviceLayerSelectionNotifications`. Views,
  navigation and a preference; none creates. Of **291 types**, only `DeviceLayer`,
  `CursorDeviceLayer` and `DeviceLayerBank` carry the name.
- **By SUPERTYPE, transitively:** a `DeviceLayer` reaches **46 members** across 6
  supertypes (`Channel` 24, `DeviceChain` 12, `Subscribable` 4, `DeleteableObject`
  2, `DuplicableObject` 2, `ObjectProxy` 2); `CursorDeviceLayer` 59 across 11;
  `DeviceLayerBank` 53 across 7. ⚠ `Subscribable` was the one supertype no previous
  pass had enumerated — its four members are subscription lifecycle and cannot
  create or delete anything.
- **By CONCEPT, ignoring naming entirely:** 110 create-shaped members survive
  stripping observers and view factories. The ones that touch DOCUMENT CONTENT are
  `Application.create*Track` ×3, `Project.createScene*` ×2,
  `Track.createNewLauncherClip`/`createParentTrack`, the clip-slot creators,
  `DrumPad.insertionPoint()`, the three duplication verbs, and `InsertionPoint`'s
  14 — every one probed. ⚠ `ControllerHost` (112 members) had never been
  enumerated either; every `create*` on it is a proxy factory or infrastructure.

---
