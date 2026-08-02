---
title: E17 — the call on DEVICE branching: layers or tracks?
status: ⚠⚠ SUPERSEDED FOR CURRENT STATE — read `HANDOFF-E18-BRANCH-UNLOCK.md`
        §2 and §5 instead. This document's CALL never changed, but its REASONING
        turned over three times and the body below is a stack of correction
        banners; it is kept as the record of how the argument moved, not as a
        statement of what is true.
        ⚠ WHAT ACTUALLY SURVIVES: a chain CAN be created autonomously
        (`layer.select` + `Channel.duplicate()`, typed, no human); it CANNOT be
        destroyed by any typed route — exhausted across both `DeleteableObject`
        forms with a Track sibling control deleting in the same run, and with a
        mechanism that predicts it (a DeviceLayer honours the verb `Channel`
        declares itself and declines every verb it merely inherits). Rows 5 and 6
        stand ●●. §1a's premise was FALSE in all three of its drafts. §5's
        preset-library dependency is STALE — a multi-chain FX Layer can be built at
        runtime from nothing.
        ⚠ THE CALL IS STILL THE USER'S AND STILL PENDING (standing rule 10), now
        turning on three rows rather than one: destroy, durable identity, clips.
        E18 §3.1 measures the rebuild strategy that could dissolve the first.
        ⚠ REWRITE THIS DOCUMENT, do not patch it further. Nothing in DECISIONS.md.
updated: 2026-08-01
parent: HANDOFF-E17-DEVICE-LAYERS.md §3
evidence: FINDINGS E17 (rows 1–6, e17a–e17p) · E16w, E16 §3.4e, E16n/E16o, E16m,
        E16r, E16u, E16j, E16k · E4c, E4d, E4e, E4g, E4h · E10c/E10d · E13 · E2f
---

# ⚠⚠ The call is RE-OPENED. Layers are no longer a fixed-shape fixture.

> ⚠ **Read this before anything below.** The heading that stood here — *"DEVICE
> takes are TRACKS; layers are a fixed-shape A/B fixture"* — rested on layers being
> **incapable** of a branch lifecycle. `e17ab` shows they are fully capable, and
> that the incapacity was **our own `cursor.pointTrack` clearing the actionable
> state before every measurement**. "Fixed-shape" is simply false: we can add and
> remove chains at will.
>
> ⚠ The call may still land on tracks — §1b is real and clips are real — but it can
> no longer be reached by the argument this document makes, and §§1a, 2, 5 and 6 all
> need rewriting rather than patching. That is the user's call to direct (rule 10).
>
> **What survives unchanged:** §1b (durable identity), rows 2, 5, 6, the row-4
> typed-verb ○s, and §3's control discipline.

## 0. ⚠ What changed, and why the first version of this document was wrong

The first draft said: *"A layer chain cannot be created beside a sibling, and
cannot be thrown away."* **That is false, and a user report is what caught it.**

> **User, 2026-08-01:** *"Selecting a layer, copying it, and pasting directly at
> the same selection results in inserting a duplicate of that layer, for me."*

`e17l` measured it: a human selects a chain, and `Copy`+`Paste` gives 4 → 5,
`Delete` gives 4 → 3 removing the correct chain by `channelId`. ⚠ **And the
actions do not have to be fired by the human** — with a human-set selection, *our*
`Copy`+`Paste` and *our* `Delete` both worked. So Bitwig can do all of it; the
named actions can do all of it; **the only thing that fails is our selection.**

⇒ The call survives, but on completely different grounds, and the difference
matters because one version is permanent and the other is a bug-shaped gap
someone could close tomorrow.

---

## 1. The two reasons, in order of strength

### 1a. ⚠ A chain IS addressable — and panel-focused actions ignore that address

> ⚠⚠ **REWRITTEN 2026-08-01 after a user objection. The conclusion survives; the
> premise it originally rested on was false.**
>
> The old claim was *"nothing we can call makes a chain the selection"*. That is
> wrong. **`DeviceChain.selectInEditor()` sets the chain selection** — confirmed by
> human eyes (`e17u`) and machine-read across three targets in two sittings
> (`e17v`). ⚠ **Every earlier test aimed at `layerIndex: 1`, which was already
> selected**, so the setter worked all along and its effect was invisible in every
> trial. `CursorDeviceLayer.selectChannel()` is **inert**, and `e17o`'s "it binds
> the cursor" ● goes with it — the `exists()` flip was ambient, and `e17o` then
> *chose* that inert setter for rows 3/4.
>
> ⚠ There **is** a readback: `cursorLayerName`, 5/5 against human eyes,
> non-disturbing, valid while the device cursor is on the container.
>
> **Re-measured with the selection VERIFIED at the instant of firing**, bracketed
> by a container reference arm before / between / after that proves dispatch was
> live each time: `Duplicate` → ◐ container, `Copy`+`Paste` → ◐ container,
> **Δchains = 0 both times**.
>
> ⇒ ⚠ **The corrected claim: a chain can be addressed as a selection, and
> panel-focused actions do not consume that address.** That is a *positive* result
> — the action fires, lands somewhere specific, and it is never the chain — where
> the old ○ was a bare absence.
>
> ⚠⚠ **SETTLED by `e17x`.** With one device on the track, "the panel ignored the
> chain" and "the panel coarsened it to the parent" predicted the same outcome. A
> second distinguishable device separates them — panel on an **Organ**, a chain
> verifiably selected inside the container, and **the Organ was duplicated**. The
> outcome tracks the panel target in all four cells (container→container,
> Organ→Organ, ×2 gates) and is unmoved by the chain selection.
>
> ⇒ ⚠ **The panel's current DEVICE wins outright; the chain selection contributes
> nothing.** ⚠ This also means `e17v`'s container result was a coincidence of a
> one-device fixture, not a finding about chains.
>
> ⚠ **This NARROWS the reopening path.** Rows 3/4 are not a granularity bug that
> could be rounded off — the device panel does not read the chain selection at all.
> Reopening needs an action or API that *reads* it, not a better-aimed version of
> what we already have.

Every create/delete gesture Bitwig offers for a chain is selection-scoped, and
⚠ ~~nothing we can call makes a chain the selection~~ **the selection we can set is
not the one these actions read**:

⚠ **First, the thing two earlier drafts got wrong.** What a panel-focused named
action consumes is **not** "the UI selection" — it is the **device panel's current
DEVICE**, which is invisible and is a different object. `e17r` established this
with human eyes: asked what `Device.selectInEditor()` had selected, the user
reported *"the gn-lay4 track. Nothing in the device is selected."* Four things
exist and only the second one matters to actions:

| # | thing | who sets it | visible |
|---|---|---|---|
| 1 | the UI selection / highlight | our calls set it to the **TRACK**, only ever | yes |
| 2 | ⚠ **the device panel's current DEVICE** | `Device.selectInEditor` ● | **no** |
| 3 | the device panel's scope | `Channel.selectInMixer()` on a chain scopes into it | yes |
| 4 | our cursors | `cursorLayer0` = an "ambient highlight" | yes, drives nothing |

| what we tried | selects a chain? | the action then acts on |
|---|---|---|
| ⚠ **`DeviceChain.selectInEditor()`** | ⚠ **● YES — and it is readable** | ⚠ **the CONTAINER. Δchains=0** |
| `Channel.selectInMixer()` | ○ | scopes the panel into the chain (#3); no actionable item results |
| ⚠ `CursorChannel.selectChannel()` on `CursorDeviceLayer` | ○ ⚠ **inert** | — |
| 6 navigation actions from a selected container | ○ | nothing |
| `device.selectInEditor` | (n/a) | ● sets #2 — **proven** by a discriminating fixture |
| a HUMAN clicking the chain | ⚠ **●** | ⚠ **the CHAIN — this is the gap** |

⚠ **So the difference between us and the human is no longer "they can select a
chain and we cannot".** Both can. The difference is that whatever the human's click
sets, it is not the object `DeviceChain.selectInEditor()` writes to — or it is, and
the actions read a *third* thing. `e17x` is the next cut at it.

⚠ **The inertness is measured, not inferred.** `e17s` fired `Duplicate` with **no
selection call at all** and got the same container duplication as every layer arm
— so an earlier draft's "our setters hit the container" was reading ambient panel
state. ⚠ **And `Device.selectInEditor` is not inert**, which `e17t` proves with
two distinguishable devices: ambient wraps the Organ (the panel defaults to the
LAST device), `selectInEditor(0)` wraps the Polysynth, `selectInEditor(1)` wraps
the Organ. The call steers #2; nothing steers #2 to a chain.

⇒ **The claim, at the strength the evidence supports:** *the device panel's
current device can be set by us, and a chain can never be it.*

⚠ **The asymmetry is not the odd one it looked like.** It is not "cursors drive
the UI for tracks and devices but not layers" — `CursorDevice.selectDevice` was
never shown to drive anything either, and the device case works through
`Device.selectInEditor`, which is not a cursor method. The pattern that fits
everything: **`selectInEditor` on a DEVICE steers the device panel; `selectChannel`
on a CursorTrack steers the track selection; nothing steers anything to a chain.**
`cursorLayer0` binding is visible to the user as an "ambient highlight" and is
inert.

⚠ This is a REACHABILITY ○ and must never be written as "impossible". It is
reopenable the moment a selection setter is found, and the one instrument that
would settle it — `DeviceChain.addIsSelectedInEditorObserver`, documented
current — was lost this session to a single-`try` marking error and is worth one
restart if the question is ever reopened.

### 1b. ⚠ A chain has no durable identity, and that is INDEPENDENT

Even granting 1a were solved tomorrow, this would still bite. Measured across a
real save + quit + reopen (`e17n`):

| | before → after |
|---|---|
| **track** `channelId` ×3 | ● unchanged (E2f re-confirmed) |
| chain count ×3 containers | ● unchanged |
| ⚠ **chain `channelId` ×8** | ⚠ **all eight CHANGED** |
| chain names ×8, including `A·take` | ● all survived |

⚠ **Replicated over a second save + restart** on a clean fixture: `gn-lay4`'s four
chains have now held three disjoint id sets across two reload cycles, while
`A·take` survived both. Two independent replications.

⇒ **E16w's "free rider: layer chains have their own `channelId`" is retired.** A
chain `channelId` is a session handle, not a key. A take system needs to say
*which* branch is which across sessions, and for chains the only thing that
persists is the NAME — so addressing would rest on a human-editable string, or on
index, which D6 forbids. ⚠ **Tracks have exactly the opposite property** and that
is why they win: `channelId` durable (E2f), name free for the human (E16q).

---

## 2. The pitch table, fully re-scored

The handoff's §1 table with every row measured. ⚠ Bold = changed from the handoff.

| | track fork (chosen) | layer chain |
|---|---|---|
| bank-window cost | ⚠ 1 slot per branch + 1 per lineage group | **none** |
| the Master and FX returns | cannot be forked at all (§4.8) | **reachable** |
| audio glitch on branch | ⚠ 5/5 vs 0/3 placebo (C5) | none measured (§3.4e) |
| disk | 20,391 B/fork (E16u) | ~0 |
| A/B gesture | mute, ⚠ not quantised (E16m) | ⚠ **solo — exclusive, one flag** |
| "which is live", readable | ⚠ N mute flags | ⚠ **● one exclusive flag per chain** |
| human-editable tag | track name (E16q) | ⚠ **● survives content change AND save+restart** |
| carries different CLIPS | ● | ○ never |
| ⚠ **durable identity** | ⚠ **● `channelId` (E2f)** | ⚠ **○ `channelId` CHANGES on reload** |
| ⚠ **CREATE a branch** | ● duplicate a track, autonomously | ⚠⚠ **● `layer.select` + `Channel.duplicate()` — TYPED, autonomous (`e17ak`)** |
| ⚠ **DESTROY a branch** | ● delete the track, exact (§4.2) | ⚠⚠ **◐ typed deletes refuse even when selected; named `Delete` or `app.undo` only** |
| ⚠ **AUTONOMY** | ● ours throughout | ⚠ **◐ create yes, destroy no** |

⚠⚠ **RE-SCORED THREE TIMES. The honest tally: layers win or draw on nine of twelve
rows, and lose the three that decide it** — durable identity (§1b), carrying
different CLIPS, and now **autonomy**.

⚠ **What changed and what did not.** Capability is no longer a differentiator: a
chain can be created, named, destroyed, soloed exclusively and A/B'd, all
programmatically. Everything the first three drafts of this document argued about
addressability was **wrong** — a chain is addressable, identically to a human's
click. What survives is narrower and sharper: **the first gesture of a chain branch
cannot be ours.** After the user clicks once, the extension can do everything;
before that click, nothing. Priming does not survive a project reload, so it is
once per session, forever.

⚠ **Whether that is disqualifying is a product judgement, not a measurement,** and
it is the user's (rule 10). A defensible reading either way:
- **against layers** — a take system whose branch creation stalls until the user
  clicks the right lane is not a take system; it is a macro.
- **for layers** — a single click to arm a container is a plausible affordance, and
  in exchange: zero bank-window cost, zero glitch, ~0 disk, reaching the Master and
  FX returns that no fork touches at all (§4.8), and exclusive one-flag A/B.

---

## 3. Why the ○s are worth trusting

Every negative is bracketed by a positive control in the same run (rule 10):

| row | mechanisms | control |
|---|---|---|
| 2 duplicate | 3, × 2 fixture states | `Device.duplicateObject()` ● 1 → 2, 280 ms |
| 3 create (typed) | 3, × 3 fixture states | a device landed in chain 0 ●; `Copy`+`Paste` at top level ● |
| 4 delete (typed) | 4 | `Device.deleteObject()` ● 577 ms **and** `host.deleteObjects()` on a slot ● 256 ms |
| 3+4 (selection) | 3 setters + 6 navigation actions | ⚠ a HUMAN selection ● in the same fixture |

**All 14 `InsertionPoint` members are now exercised**, `paste()` last. ⚠ **And the
layer-naming worry is closed three ways** — by NAME (8 members API-wide contain
"layer", all views/navigation/a preference), by transitive SUPERTYPE (46 members
on a `DeviceLayer`; `Subscribable` was the one nobody had enumerated), and by
CONCEPT ignoring naming (110 create-shaped members; the ~25 touching document
content all probed). `ControllerHost`'s 112 members were enumerated for the first
time — every `create*` is a proxy factory.

---

## 4. ⚠ The cost of the named-action route, if 1a is ever solved

Recorded now so a future reopening inherits it rather than rediscovering it:

- **It runs on named actions against the UI selection** — rule 6's territory, and
  E6 blocker 3's hazard. `e17p` demonstrates the failure mode: six `Duplicate`
  fires aimed at a chain all landed on the container instead, silently, and the
  probe's own instrument could not see it.
- ⚠ **It needs Bitwig in the FOREGROUND.** `e17m`: **0/8 backgrounded**, ● every
  time frontmost. The mechanism is unexplained and does not generalise — E16j ran
  `Group` backgrounded and minimised 5 times against a TRACK selection and it
  fired every time. A product feature that silently does nothing when the user
  alt-tabs is not shippable without a foreground precondition.
- ⚠ ~~**There is no readback**~~ **RETRACTED — there is one.** `cursorLayerName`
  tracks the chain selection (5/5 against human eyes, `e17u`) and survives a full
  re-scope without being disturbed (`e17v` PART 0). A probe *can* assert the
  precondition, and `e17v` did: aimed Phase-4, read back Phase-4 at the instant of
  firing. ⚠ Valid only while `cursorDevice0` is on the container.
- ⚠ **A foreground-gated probe cannot be run opportunistically.** `e17v` passed
  its dispatch control at 47 s, then lost the gate when the operator alt-tabbed to
  type a message, and every arm after that was void. **Arrange the foreground with
  the operator before starting; never assume they will see a prompt mid-run.**

---

## 5. What this changes in `E16-REPLAN.md`

**§3 is UNBLOCKED and stands, with one upgrade.** It assumed a device-scoped A/B
fills a *hole* — the Master and the FX returns, which no fork reaches (§4.8) and
which E16r showed leave the addressable set first. Confirmed: layers are the
answer **there and only there**.

> ⚠ **Proposed replacement for §3's mechanism choice.** Use **`DeviceLayer.solo()`**.
> It is container-scoped (0 of 10 tracks flipped, where a track solo flipped all
> 10) and **locally exclusive** — soloing chain 1 reads 23 against a
> mute-calibrated "chain 1 alone" of 25, with "both open" at 66, and the mirror
> confirms. One flag per chain, no `ChainSelector`, no routing, no second preset
> shape. ⚠ It is also *"internal exclusive solo among a group"*, which is what the
> user asked for in session 5's closing exchange.

Consequences:

- ⚠⚠ ~~**The preset-library coupling is the whole story.**~~ **RETRACTED — `e17ae`.**
  `Group` does give exactly one chain, but `Duplicate` on a selected chain grows it
  1→2 and onward (`Δdevices=0`, control passing in the same sitting). **A
  multi-chain container is buildable at RUNTIME from `Group` + `Duplicate` alone.**
  ⚠ Rule 11 / E4h / `insertFile` / `bwmod`'s offline chain trim stay useful for
  shipping *authored* content, but they are **no longer prerequisites** of the A/B
  story. The old ○ came from `e17ac`'s own `device.selectInEditor` scaffolding
  overriding the chain selection.
  ⚠ **The one gesture that still cannot be ours is the FIRST CLICK** (`e17ab`
  cold) — priming, not preset authoring, is what the layer model now depends on.
- ⚠ **`bwmod`'s chain trim is the only way to choose a chain count, and it is
  strictly offline.** E10d collapsed "a template per shape" into "one wide
  template plus a trim"; the live API can do neither half. Pipeline: hand-build
  wide once → trim offline → `insertFile` → fill with `moveDevices` (E16n ●) or
  `layer.pasteInto` (new this session ●).
- ⚠ **Address a chain by NAME, never by `channelId` or index.** §1b. This is the
  one place D6 inverts, and it needs saying explicitly because D6's habit is
  exactly backwards here.
- **§1's restated rule 5 does NOT change shape.** The bank window remains the
  budget for device takes, because device takes are tracks.

---

## 6. What layers are still FOR

1. **The Master and the FX returns** — the only device-scoped A/B that reaches
   them, and the hole §4.8 had no answer for.
2. **A fixed, human-authored set of alternatives.** Row 5 gives each chain a
   durable human-editable label; row 6 makes switching one exclusive flag; §3.4e
   makes the switch 25 ms, send-preserving and glitch-free.
3. **Three ways to fill a chain**, one new: `insertBitwigDevice` (E4c),
   `moveDevices` (the human's device WITH its state, E16n), and **`layer.pasteInto`
   from the clipboard** — the only one that COPIES, so a patch can be auditioned
   inside a container without leaving the track.
4. **Not** an open-ended take history. Shape is frozen at authoring time, and
   nothing we can call changes it.

---

## 7. ⚠ Still owed

- **Cross-device modulator routings across a `moveDevices` relocation** — scoped
  now to §6's use case rather than the whole model.
- ⚠ ~~`e17x` — the open mechanism question~~ **RUN AND SETTLED.** The panel target
  decides in all four cells; the chain selection contributes nothing. Rows 3/4 are
  a wall, not a granularity gap.
- ⚠ ~~one restart for `DeviceChain.addIsSelectedInEditorObserver`~~ **DONE and no
  longer load-bearing.** The two observers were marked in ONE try block, so the
  @Deprecated `addIsSelectedObserver` threw on the first layer and took the
  documented-current one with it (`FAILED@0`). They are now split, each reporting
  its own status. ⚠ But the readback it would have provided **already existed**:
  `cursorLayerName` tracks the chain selection. Kept as an INDEPENDENT second
  instrument — two disagreeing readbacks is a finding; one agreeing with itself is
  not. Takes effect on the next extension restart; no wire method added, so the
  golden and `methodsHash` are unchanged.
- ⚠ **Re-check rule 6's one sanctioned use against the foreground gate.**
  Lineage-group creation is a named action. E16j says it fires backgrounded on a
  track selection, and that is the arm that matters — but it was measured before
  this session found a gesture that does not, so it deserves one confirming run.

---

## 8. The honest counter-argument

The handoff asked that the two-mechanism cost be weighed rather than assumed
away. **This outcome avoids it entirely**: device takes and note takes are both
tracks, there is one branch mechanism, and "a take that changes both notes and
devices needs both of them" never arises.

⚠ **What is genuinely lost** is the bank window. Every device take still costs a
slot, and E16r measured that the Master and the FX returns cross the ceiling
first — so the instrument that measures audibility degrades before the music
does. Layers would have made device takes free of that budget, and on the two
counts that matter they came closer than the first draft of this document
admitted. They fail on addressability and on identity, not on capability.
