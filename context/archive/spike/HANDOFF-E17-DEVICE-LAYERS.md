---
title: Handoff for E17 — unlock device layers, then decide the DEVICE branching model
status: ⚠ CLOSED 2026-08-02 — SUPERSEDED BY `HANDOFF-E18-BRANCH-UNLOCK.md`.
        E17 answered its question and then overturned its own answer three times.
        ⚠ Do not read the body below for current state: almost every ○ in it was a
        HARNESS artifact, corrected later. The surviving results and the method
        guards that cost the most to learn are consolidated in the E18 handoff §1
        and §2; `FINDINGS.md` "E17" carries the detail and the corrections.
        ⚠ In one line: a chain can be CREATED autonomously
        (`layer.select` + `Channel.duplicate()`); it CANNOT be destroyed by any
        typed route (exhausted, with a mechanism that predicts it); rows 5 and 6
        stand ●●; the track-vs-device DECISION is still the user's and is carried
        forward to E18 along with `E16-REPLAN.md` §3.
        ⚠ Nothing went into DECISIONS.md.
updated: 2026-08-01
predecessor: E16-OPEN-QUESTIONS.md (session 4), E16-REPLAN.md (session 5)
model doc: E16-TRACK-NATIVE-BRANCHING.md (⚠ carries a staleness banner)
evidence: FINDINGS E16s/E16t/E16u/E16w + §3.4e (session 5) · E16m, E16n/E16o,
        E16p/E16q, E16r · E4c, E4d, E4e, E4f, E4g · E10c/E10d · E13 · E16j, E16l
---

# Handoff: E17 — device layers

## Read first, in order

1. **`E16-REPLAN.md`** — session 5's re-plan. §3 is where this session lands.
2. `FINDINGS.md` → **`E16w`** (layer mute works), **`E16 §3.4e`** (selector
   switching), **`E16n`/`E16o`** (moveDevices), then **`E4d`** and **`E4e`**
   (the chain-creation gap and its architectural reason).
3. `E16-OPEN-QUESTIONS.md` §3.1 — the complete-recall pass that found
   `moveDevices`, and §3.1.2 on why the javadoc argued *against* the reopen.
4. `FINDINGS.md` → **`E10d` Finding A** (chains are trimmable in the file
   format) and **`E4g`** (per-layer substitution on a hand-built template).

---

## 1. The pitch

**Split branching by SCOPE.** Device/param takes become **layer chains inside one
track**; note takes become **clips in different scenes**. Tracks stop being the
universal branch unit and become the thing that holds both.

The case for it, from what session 5 measured:

| | track fork (chosen model) | layer chain |
|---|---|---|
| bank-window cost | ⚠ 1 slot per branch + 1 per lineage group | **none** |
| ⚠ the Master and FX returns | **cannot be forked at all** (§4.8) | **reachable** |
| audio glitch on branch | ⚠ **5/5 vs 0/3 placebo** (C5) | **none measured** (§3.4e, 0/4 vs 0/4) |
| disk | 20,391 B/fork (E16u) | ~0 |
| A/B gesture | mute, ⚠ **not quantised** (E16m) | mute ● (E16w), or `activeChainIndex` |
| "which is live", readable | ⚠ N mute flags | ● **one integer**, with a Selector |
| carries different CLIPS | ● | ○ **never** — hence the clips half |
| ⚠ identity | `channelId`, durable (E2f) | `channelId` exists (E16w), **durability unprobed** |
| ⚠ human-editable tag | track name, round-trips exactly (E16q) | ⚠ **layers auto-rename after their content** (E4c) |

⚠ **The honest cost is two mechanisms instead of one**, and a take that changes
*both* notes and devices needs both of them. That is the thing to weigh at the
end of the session, not to assume away at the start.

### ⚠ Drum Machine is RULED OUT, and the reason is decisive

E4d route 5 makes Drum Machine the one container that already creates chains
programmatically, and session 5's inventory flagged it as the obvious candidate.
**It does not work for takes.**

> **User, 2026-08-01:** *"Drum machine is not as desirable because of its
> note-triggering. It will not allow MIDI devices inside of it to receive notes
> unless their pad is currently being triggered. This makes it impossible to test
> polyphonic clips across multiple takes."*

⚠ Recorded as a **user report, not our measurement** — but it is a statement
about how the device works rather than a preference, and it kills the route
outright: a take container that only passes notes while one note is held cannot
audition a polyphonic clip. **Do not spend a row re-deriving this.** It also
retires session 5's "the container you want already exists" line.

---

## 2. The six rows

Ordered by suspicion of a false negative, not by value.

### Row 1 — ⚠ GROUP existing devices into a new layer (the most suspect)

**Prior verdict:** ○, from E4d route 7 — a sweep of all **781** named actions
found none that create chains.

**Why it is suspect, and this is the strongest lead in the session:**

- ⚠ **It has a menu item and a hotkey in Bitwig's own UI** (user, 2026-08-01).
  So the capability exists; the only question is whether it is reachable.
- ⚠ **This is E16j's exact shape.** E6 concluded named actions were "unusable AND
  hazardous"; E16j overturned it and found `Create Group Track` and `Group` — a
  UI gesture with a hotkey that turned out to be a named action after all. The
  track-level analogue of this very row is the thing that unblocked the whole
  track-native model.
- ⚠ **Route 7 swept for the wrong concept.** It asked which actions *create
  chains*. An action named something like "group devices" or "wrap in layer"
  would not obviously answer that description, and an action list is scanned by a
  human reading names. A miss here is a naming problem, not a capability one.
- ⚠ `Application.getActions()` is a **curated subset**, not every menu command.
  A hotkey that is not in the list is a genuine dead end for us — but proving
  that requires reading the list for the *concept*, not for the guess.

**Method (standing rule 10):**
1. Dump all actions with **ids and categories**, and grep the ids/names for
   `group`, `layer`, `wrap`, `chain`, `nest`, `container`, `combine`, `merge`,
   `stack`, `fold`. ⚠ Grep the **id** as well as the display name — E16j's
   working action ids were not what their menu labels suggested.
2. ⚠ **Enumerate `Application` in full.** E16l's and E16n's complete-recall
   passes covered `InsertionPoint`, `Device`, `DeviceChain`, `DeviceLayer`,
   `ChainSelector` — **not `Application`**, and not `Bank`/`ChannelBank`/
   `DeviceLayerBank`. That is a real hole in the previous sweeps.
3. Only then probe live, with the **device** selection established first —
   the action acts on the UI selection (E6 blocker 3), which for devices is
   `devcursor.selectAt`, not a track selection.

⚠ **The hazard is real and E6 earned it:** a named action fires against whatever
is selected *now*. E16j made seven orphan duplicates this way. Assert the
selection, fire, then verify by `device.list` / `layer.list` **diff** — never by
the return value.

### Row 2 — ⚠ DUPLICATE a layer (untrustworthy ○, for a specific reason)

**Prior verdict:** ○, E4d routes 1 and 2 — `DeviceLayer.duplicateObject()` and
`Channel.duplicate()`, both "silent no-op".

**⚠ Both were run through a cursor-following bank with no precondition
assertion, before the trap that shape produces was discovered.** Read the
handlers as they still stand in `ContainerHandlers.java`:

```java
private JsonElement layerDuplicate(JsonObject params) {
    rig.layerBank0.getItemAt(params.get("layerIndex").getAsInt()).duplicateObject();
```

`rig.layerBank0` **follows `cursorDevice0`**. E16o established that aiming it at
a device with no layers produces a silent no-op that is **byte-identical to an
API refusal** — and that this nearly published a false negative on the
`moveDevices` row, caught only because that probe asserted its precondition
separately from its question. **E4d predates that finding by eleven days.**

⇒ Re-run both verbs with the container **proved selected** (`devcursor.status`
reporting the container, `layer.list` reporting `count == N`) immediately before
each call. If they still no-op, the ○ is real and now rests on an asserted
precondition. ⚠ Also try duplicating a layer that is **populated** versus empty —
E4d's fixture state is not recorded and an empty chain may be refused for a
different reason than a full one.

### Row 3 — CREATE a new layer (well covered; one untried reading)

**Prior verdict:** ○ against five mechanisms plus a positive architectural
reason (E4e). ⚠ **The user agrees this looks genuinely closed.** Do not spend the
session here — but there is one reading of the primary source nobody has tested:

> Bitwig user guide, quoted in E4e: *"there is only one **Add Device** button in
> the main interface of Instrument Layer, with each added device being placed on
> a **newly created** instrument chain."*

⇒ ⚠ **Chain creation may be a side effect of inserting a device at the
CONTAINER's own insertion point**, rather than into a chain. Everything tried so
far inserted into an existing chain (E4c) or called a duplication verb. The
untried call is an insert aimed at the container itself. Cheap to add, and it is
the mechanism the vendor's own documentation describes.

Also still untried: **`layer.pasteInto`** — on the wire since session 4, **never
called**. It is the last of `InsertionPoint`'s 14 members unexercised. It cannot
invent a referent, so expect nothing, but the clipboard is an independent
mechanism and this is the row where "independent mechanism" has paid five times.
⚠ Filling the clipboard means `Application.copy()` on a UI selection — E6
blocker 3 — so it is human-assisted or it is nothing.

### Row 4 — DELETE a layer (unprobed; the minimum viable unlock)

`DeviceLayer` extends `DeleteableObject`. **E4d probed duplicate and never
probed delete.** One wire method.

⚠ **This row alone is the bare minimum for the model**, because revert-by-delete
is what makes a branch exact regardless of its contents (§4.2) — and with
`moveDevices` ● and `insertFile` ●, delete is the last piece of a workable
create-by-rebuild loop. If it works and rows 1–3 all fail, layers are still
usable; they are just more expensive to grow.

⚠ Watch for a **removable-but-not-addable** asymmetry: that is exactly the shape
E10c and E10d already found *in the file format*, one level down (chains are
trimmable, not insertable). Two independent layers of the product showing the
same asymmetry would be a finding in its own right.

### Row 5 — RENAME a layer

`Channel.name()` is a `SettableStringValue` for tracks. ⚠ But E4c recorded that
**layers rename themselves after their content**, so a set may be silently
overwritten the next time the chain changes.

**This decides whether §1b's naming scheme survives the move to layers.** The tag
lives in the name; if layer names are volatile, the lineage tag needs a different
home — and `channelId` cannot be it, because a tag has to be human-readable and
human-editable *by design*. ⚠ Test the write, then **change the chain's contents
and re-read**, which is the case that actually bites.

### Row 6 — SOLO a layer

`Channel.solo()` on a `DeviceLayer`. E16w proved the `Channel` **mixer** works on
a layer (mute ●), so the prior is good.

⚠ **The question is SCOPE, not whether it sets.** Track solo is project-global,
which would make it useless — soloing take B would silence the drums. The
evidence that Bitwig models solo **per container** is `DrumPadBank.hasSoloedPads()`
and `clearSoloedPads()`: solo state scoped to one device. If `DeviceLayer.solo()`
is container-scoped, **it is the mutually-exclusive selection gesture** the user
asked for in session 5's closing exchange — one call, no selector, no routing.

Also read `SoloValue.toggle(boolean exclusive)`, which is the exclusivity
primitive itself.

⚠ Measure scope with the **master** as oracle and at least one unrelated track
playing. A solo that silences the project reads identically to one that does not,
if the project is silent — that is rows D–G trap 6, and session 5 shipped exactly
that mistake once (`fxOnChain0: 0` vs `fxOnChain1: 0` passing as a green).

---

## 3. The decision at the end

**Then make the call: are DEVICE takes layers or tracks?** The clips half (note
takes as clips in scenes) is a separate question and is not decided here.

Inputs the call needs, and most are already in hand:

- **Rows 1–6.** ⚠ Delete alone is sufficient-but-expensive; delete + duplicate is
  comfortable; delete + duplicate + create/group is parity with tracks.
- **Already settled:** layer mute works and is as complete as a track mute
  (E16w); a selector switch is 25 ms, cuts no sends, and does not glitch
  (§3.4e); `moveDevices` relocates a device with its state (E16n); a preset
  materialises N chains in 268 ms (E4d route 4) and chains are **trimmable
  offline** from a max-count template (E10d + E13), so the preset supply problem
  is one hand-built asset, not one per shape.
- ⚠ **Still unmeasured and load-bearing if layers win:** whether a layer's
  `channelId` survives save + restart (the E2f question, never asked of layers),
  and whether cross-device modulator routings survive a `moveDevices` relocation.

**If the answer is layers, `E16-REPLAN.md` needs revising** — §3 in particular,
which currently treats the device-scoped A/B as the answer to the master and FX
returns *only*, and would instead become the primary device-branching mechanism.
⚠ §1's restated standing rule 5 also changes shape: the bank window stops being
the budget for device takes, though it still binds note takes if those become
tracks-plus-scenes.

---

## 4. Rig notes

- **No restart is owed on arrival.** Bitwig 6.0.6 / API 25, **117 wire methods**,
  `methodsHash` **`85bf5f73a856a00c`**, golden in sync, `probe:hello` green.
- Session 5 added `slot.moveTo`, `slot.epoch`, `layer.setMixer`, `equals.status`,
  `equals.tryCreate`, plus mixer fields on `layer.list`.
- ⚠ **Rows 1, 4, 5 and 6 all need Java.** Plan **ONE restart**: a layer delete, a
  layer rename, a layer solo, a container-level insert (row 3), and whatever row
  1's action sweep turns up. A toggle silently keeps the old jar;
  `./gradlew copyExtension` is an atomic rename; run `npm run wire:golden --
  --write` **before** the build and add every new method **by name** to the
  allowed list in `wiremap.test.ts` — the E16 guard names them one by one on
  purpose.
- ⚠ `~/.ghostnote/rig.json` currently has **no `contentFilter`**, so the bank is
  *not* on `ALL_CHANNELS`. Set it if any row folds a group.

### Fixtures on disk

- `~/Documents/Bitwig Studio/Library/Presets/Instrument Layer/gn_instrument_layer_2.bwpreset`
- `~/Documents/Bitwig Studio/Library/Presets/Instrument Selector/gn_instrument_selector_2.bwpreset`
- `brain/fixtures/InstrumentLayer/gn_layer_4chain.bwpreset` (the E4g template)
- In the sandbox: **`gn-lay`** and **`gn-sel`**, each carrying its container with
  two Polysynth-filled chains; `gn-lay`'s chain 1 has `F1FREQ` at 19.4 Hz so the
  two chains are audibly distinct.

⚠ `insertFile` needs an **absolute path** and a **`.bwpreset` extension** — both
fail silently otherwise (E4h, standing rule 11).

### New probes from session 5

`e16s-clipmove`, `e16s-human` (arm/read), `e16t-equals`, `e16t-diag`,
`e16t-diag2`, `e16u-filesize` (baseline/fork/read/cleanup), `e16v-devab`
(setup/meter/ab-run/ab-score/cleanup), `e16v-diag`, `e16w-lead`
(run/ab-run/ab-score/restore), `e16-unmute`. All registered in `package.json`.

---

## 5. Posture

The sandbox is throwaway — churn it, but leave **`gn-E16`** and its parent
**`Group 7`** intact.

The user is at the keyboard for anything audible: **ask before making noise**,
ask **immediately** after the event, ask **open** questions, and **force the
placebo arm balance** rather than trusting a coin. Stop after each task for
review.

⚠ **Four method traps session 5 paid for, all of which apply directly to these
rows:**

1. **Assert the precondition separately from the question.** Row 2 exists because
   E4d did not. E16w's lead needed *four* attempts and every failure was caught
   by a control rather than by luck — including one where the headline check
   **PASSED while comparing silence to silence**.
2. **Name it, do not count it.** `e16t` reported "matches 1 bank row"; naming the
   row turned that into the finding that a pinned cursor slides onto its target's
   heir.
3. ⚠ **Check that a check can FAIL.** Session 5 shipped a send test that compared
   `0` to `0` and passed, and a glitch test that scored a clean result as a
   failure because it asserted the wrong direction. Two silences must never make
   a green, and a null result must not be scored as a discrimination.
4. **Launcher clips start the transport themselves.** An explicit
   `transport.play` after `slot.launch`, with `transport.stop` between retries,
   tears down the playback it is retrying.

⚠ **Do not write `DECISIONS.md` unless explicitly directed to** (rule 10).
Session 4's and session 5's work is **uncommitted**; do not run writing git
commands. Two D16 amendments (`clip.delete`'s `none`, `device.insert`'s missing
inverse) are still waiting on the user — see `E16-OPEN-QUESTIONS.md` §3.3.3–4.
