---
title: Handoff for E18 — the device-branch REBUILD path, and the measurements it gates
status: ⚠⚠ THE BRANCHING CALL IS DECIDED (operator, 2026-08-06) — E18's job is
        DONE. ⇒ ⚠⚠ START AT `HYBRID-AUTONOMY-LEVELS.md` §7, NOT HERE. This
        handoff is now the evidence trail behind that decision.
        ⚠ THE DECISION, in one line: a HYBRID is the model — track fork, layer
        chain and clip block all get built, and the agent chooses between them
        at "L3-open" (the agent experiences full freedom with guidance-only,
        VERSIONED tool descriptions; the record silently captures a
        deterministic rule's verdict beside the agent's choice and the human's
        response). ⚠ Only REPORTING is imposed — no automatic mechanism-level
        branching, no prescriptive fallback, and ⚠⚠ the rule must NEVER reach
        the agent's tool surface.
        ⚠ `E18-VERDICT.md` §6 is REPURPOSED as that deterministic control rule.
        ⚠ Nothing is in `DECISIONS.md` — the operator authors it (rule 10).
        ⚠ NEXT SESSION: the re-plan, from clean context.
        ⚠⚠ THE ONE EARLY BUILD ITEM: `launchWithOptions(quantization,
        launchMode)` and `ClipLauncherSlot.duplicateClip()` are UNPROBED and NOT
        ON THE WIRE, and the clip half's whole ergonomic claim runs through
        them.
        --- the E18 record follows ---
        ⚠ Session 1 (2026-08-02/03) ran EIGHT probes and closed §3.1's bar.
        The capability rows came back ●●; the cost rows are where the argument is:
          e18a  §3.3 — a multi-chain container reaches the MASTER and an FX RETURN
                autonomously. §6.1 is a measurement now, not an assumption.
          e18c  §3.1 — ⚠⚠ THE MAIN QUESTION. All four move directions work and
                state survives. The chain-DELETE ○ becomes a COST, not a wall.
          e18d  E4d route 3 overturned: `copyDevices` into a chain works.
          e18b  §3.2 — ⚠⚠ CLOSED as a MATCHED PAIR: chain ids SURVIVE an extension
                reload (twice) and REGENERATE on a project reload. They are minted by
                the project LOADER. e17ad confirmed; the operator's "weird" resolved.
          e18f  §3.1's BAR — ⚠⚠ ONE REBUILD = SEVEN UNDO STEPS (one per structural
                API call), 6 of 7 intermediate states hold both containers, and the
                whole reduce costs 4276 ms. ⚠ The FIRST genuinely negative result
                for the layer model in E18, and it is a UX cost the track model
                does not have.
          e18e  §3.4 — ⚠ MODULATION SURVIVES all three relocations (●● 3/3), for a
                modulator ON the moved device. Needed a bwmod-authored fixture: every
                preset on disk was `routes=0`. ⚠ E11e's CROSS-DEVICE form, whose path
                encodes a device INDEX, is STILL OWED — see §3.4.
          e18g  §3.1 — chain COLOUR is ●● per-chain and re-appliable; ⚠⚠ a chain has
                NO SENDS AT ALL (Bitwig refuses the bank outright), which closes that
                half. ⚠ But a TRACK fork DOES carry sends (E16d).
          e18h  glitch — ⚠⚠ THE VERB DECIDES. MOVE 0/2 (SILENT), COPY 2/2, placebo
                0/2, control 2/2. Instantiating a plugin is the audible event;
                relocating one is free. ⚠ A layer rebuild can be SILENT where a
                track fork cannot — the first row layers win outright. (Runs 1 and 2
                were thrown away by the probe's own gates; see FINDINGS.)
        ⚠⚠ §3.1's BAR IS NOW FULLY MEASURED. Every item the operator named —
        efficiency, stability, glitch, undo, atomicity, modulators, chain state —
        has a number. THE DECISION IS THE USER'S AND IS UNTOUCHED (standing rule 10).
        ⚠ §3.2 IS ALSO CLOSED (2026-08-04): the project-reload arm ran as a matched
        pair — extension reload 4/4 SURVIVE, project reload 4/4 REGENERATE. The id is
        minted by the project LOADER; take identity across sessions rests on the NAME.
        ⚠ TWO THINGS REMAIN OWED, neither blocking the decision:
          1. the MOVE trade-off's other half — does a MOVE leave an audible HOLE in
             the migrated take's OWN output? (e18h measured the engine, not the take)
          2. the cross-device modulator case (§3.4) — the path encodes a device INDEX
        ⚠ Also owed, but a session of its own: the cross-device modulator case (§3.4).
        ⚠ ~~The track-vs-device branching DECISION is still pending~~ — ⚠⚠ MADE
        2026-08-06, see the header. `E16-REPLAN.md` §3 unblocks with it, and its
        premise CHANGED: §3 scoped layers to the Master and FX returns only,
        which the hybrid supersedes.
        ⚠⚠ 2026-08-04: `E18-VERDICT.md` argued both models end to end at the
        user's request and recommended one (split by object type, with the track
        fork as the escape hatch). ⚠ The operator reviewed it, corrected two
        sections, then chose a HYBRID instead — so ⚠⚠ **§6 of that document is
        now the DETERMINISTIC CONTROL RULE, not a policy.** See §6 below for the
        NINE things it adds that this handoff's §5 table does not carry —
        including two that CORRECT this handoff's framing (the bank-window row
        should be retired; there is no one-click exclusive A/B for tracks at
        all) and one wholly new mechanism (the CLIP BLOCK).
        ⚠ Nothing goes into DECISIONS.md — the operator authors it (rule 10).
updated: 2026-08-04
predecessor: HANDOFF-E17-DEVICE-LAYERS.md (closed)
carries: the track-vs-device branching call · E16-REPLAN.md §3
evidence: FINDINGS "E17"/"E18" · E18-VERDICT.md (the live argument)
        · HYBRID-AUTONOMY-LEVELS.md (⚠ 2026-08-05 — the operator now takes a
          HYBRID as inevitable and asked for the autonomy ladder inside it.
          Five rungs L0–L4 on the MECHANISM axis; ⚠ the WHETHER axis is already
          pinned low by "deliberate and coarse" and the DESTRUCTION axis at zero
          by D17g. ⚠⚠ Its §7 is the actionable one: run the dispatch classifier
          in SHADOW MODE off the existing write-set, wired to nothing, to
          measure the mixed-change rate — the distribution that decides the
          whole ladder and that nobody has measured.)
        · E17-VERDICT.md (⚠ RETIRED — record only)
---

# E18 — can a device branch be managed without a chain DELETE?

## 0. Read first, in this order

1. **§1 below — the METHOD GUARDS.** ⚠ Read these before writing a single probe.
   E17 produced roughly a dozen false negatives and **five dead hypotheses**, almost
   all from the harness rather than the API. Every guard here is paid for.
2. **§2 — what is SETTLED.** Do not re-measure it.
3. **§3 — the open queue**, in priority order.
4. `FINDINGS.md`, section "E17" — the detail behind both.
5. `E17-VERDICT.md` — ⚠ the CALL is still live but its reasoning turned over three
   times; §6 says what to do with it.

---

## 1. ⚠⚠ THE METHOD GUARDS — the most transferable thing E17 produced

**Four of our own calls silently break the thing being measured.** Each produced ○s
that were written up as properties of Bitwig:

| our call | what it really does | cost |
|---|---|---|
| `cursor.pointTrack` | `CursorTrack.selectChannel()` — sets the **UI track selection** (E16j) | voided ~6 probes |
| `device.selectInEditor` | sets the device panel's current DEVICE, which **beats** the chain selection | voided `e17ac` |
| `focus_or_toggle_device_panel` | a **TOGGLE** — an odd number of fires **closes** the panel | voided `e17ae` ×1 |
| a stray named `Duplicate` | forks a **TRACK** via the UI selection (E6 blocker 3) | voided `e17ae` ×2 |

**The rules they earn.** Numbered so a probe can cite them.

1. ⚠ **A NAME IS NOT AN IDENTITY — for fixtures, not just for product code.** D6 says
   this for addressing and no probe applied it to its own `tracks.find(t => t.name
   === …)`. Two tracks called `gn-lay4` meant we selected a chain on one and fired at
   the other. **Refuse when a name matches more than one track; resolve by
   `channelId` after any action that can shift indices.**
2. ⚠ **Measure EVERY level, every time** — tracks (by identity), devices, chains, and
   devices-inside-chains. Three separate probes read "nothing happened" while a
   container was being duplicated one level above where they looked.
3. ⚠ **Check for objects REMOVED, not just added.** `e17ag` deleted a track and
   scored it `●● REMOVED Sampler`; the chain reading came from a different track that
   slid into the index. **After any action, verify the SUBJECT still exists by
   `channelId` before believing anything read below it.**
4. ⚠ **Bound the delta.** One `Delete` cannot change a chain count by −2. An
   impossible delta means you are reading the wrong object — **abort, do not score.**
5. ⚠ **Between establishing a precondition and firing, call NOTHING** except a
   cursor-free readback (`layer.selectionState`). `e17aa` worked and `e17z` did not
   for exactly this reason, and no amount of argument would have found it — only
   diffing the two call sequences did.
6. ⚠ **A probe's SETUP is part of its experiment.** `e17ac` held its variable fixed
   correctly and was still void, because the scaffolding that built its fixture
   called a method already proven to override what was being measured. **Audit the
   constants, not just the variable.**
7. ⚠ **A probe can poison the NEXT probe.** State leaks across runs; "this probe
   doesn't call it" is no defence when the previous one did.
8. ⚠ **Rule 13 applies to `*Action()` handles.** `deleteObjectAction()` returns a
   `HardwareActionBindable` — a RESOURCE. Obtaining it outside `init()` throws
   *"This can only be called during driver initialization"*, which reads as a clean
   ○. **Hold the handle at init, report a `handleStatus`, and ABORT unless it says
   `held:N`.** Three false ○s came from this.
9. ⚠ **Mark each observer/handle in its OWN `try`.** A `@Deprecated` sibling threw and
   took a documented-current observer down with it (`FAILED@0`), costing a restart
   and the readback the whole session needed.
10. ⚠ **A control that reproduces the FAILURE is worth as much as one that reproduces
    the success.** `e17ab`'s DESTROYER arm turned "we think our reads were the
    problem" into a measurement.
11. ⚠ **Vary the TARGET, not just the mechanism.** `e17k`/`e17o`/`e17q`/`e17r` all
    aimed at `layerIndex: 1`, which was already selected. The setter worked the whole
    time and its effect was invisible in every trial.
12. ⚠ **Sibling controls are the strongest shape available.** `Track` and
    `DeviceLayer` are both bare `Channel`s, so the identical inherited call differing
    only in receiver is what made row 4's ○ mean something.
13. ⚠ **Name the survivor, never count it** (e16t). A count of 3 is also what deleting
    the *wrong* chain produces.

**⚠ Session-state preconditions**, which are invisible and therefore lethal:

- **Named actions** fired at a chain need a chain lane to have been **clicked by a
  human** since the project loaded. Priming survives our calls and repeated cycles;
  it is destroyed by a **cross-track** `cursor.pointTrack` and by a project reload.
  A **same-track** re-point is harmless. ⚠ **The primed and unprimed states look
  identical on screen** — neither the user nor the extension can tell.
- **Typed calls** have no focus, foreground or priming dependency at all.
- ⇒ **Prefer a typed route always.** If a probe must use a named action, arrange the
  foreground with the operator first — never start one opportunistically.

---

## 2. ⚠ SETTLED — do not re-measure

**The branch lifecycle, at device level:**

| | |
|---|---|
| ⚠ **CREATE a chain** | ⚠ **● FULLY AUTONOMOUS** — `layer.select(editor, N)` then `layer.duplicateChannel(N)` (`Channel.duplicate()`). Typed; no focus, priming, foreground or human |
| ⚠ **DESTROY a chain** | ⚠ **○ EXHAUSTED** — see the mechanism below. Named `Delete` works but needs human-clicked focus; `app.undo` also removes one |
| grow a container | ● `Group` yields exactly ONE chain, and `Duplicate` grows it without limit |
| bootstrap | ⚠ a fresh **FX Layer ships with 1 chain**, an **Instrument Layer with 0** — so an FX Layer grows from nothing, typed, no preset |
| fill a chain | ● `insertBitwigDevice`, `moveDevices` (state preserved, E16n), `layer.pasteInto` |
| rename | ●● survives a content change AND two save+restart cycles |
| solo | ●● container-scoped AND locally exclusive |
| chain `channelId` | ○ does not survive a reload — ⚠ **but see §3.2, being re-measured** |
| carries clips | ○ never |

**⚠ The mechanism behind the create/destroy asymmetry, which PREDICTS it:**

    Channel extends DeviceChain, DeleteableObject, DuplicableObject
       ↑                              ↑
    Track                        DeviceLayer   ← `interface DeviceLayer
    + isGroup, position, …                        extends Channel {}` — EMPTY BODY

> **A `DeviceLayer` honours the verb `Channel` declares ITSELF, and declines every
> verb it merely INHERITS.** `Channel.duplicate()` ● · `duplicateObject()` ○ ·
> `duplicateObjectAction()` ○ · `deleteObject()` ○ · `deleteObjectAction()` ○.
> **`Channel` declares no delete at all**, so nothing remains to try. `Track`
> honours all of them because a track is a first-class deletable object — and the
> `Track` sibling control deleted successfully in the same run.

**Selection and focus, which cost most of the session:**

- `DeviceChain.selectInEditor()` **● sets the chain selection** — identical to a
  human click, confirmed by both `addIsSelectedInEditorObserver` and human eyes.
- Readbacks: `layer.selectionState` (cursor-free, preferred) and `cursorLayerName`
  (valid only while `cursorDevice0` is on the container).
- `CursorDeviceLayer.selectChannel()` is **inert**. `Channel.selectInMixer()` scopes
  the panel but does not select.
- **10 focus primers swept, all ○** — `device.selectInEditor`, `selectInMixer`,
  `selectFirstInLayer`, the deprecated `select()`, and all six `e17p` navigation
  actions. There is no chain equivalent of `Device.selectInEditor()`.

---

## 3. ⚠ THE OPEN QUEUE, in priority order

### 3.1 ⚠⚠ THE REBUILD STRATEGY — the operator's proposal, and E18's main question

Since a chain cannot be deleted, the operator proposes working without one:

> **reduce**: clone the container with fewer chains, migrate devices across, delete
> the old container.
> **collapse to a chosen take**: migrate that chain's devices out to top level, then
> delete the container.

⚠ **This is a NEW shape, not the E16 K3 track pattern.** K3 was *delete-all-but-one
then `Ungroup`*, which works at track level **because track delete works**. At device
level delete is the blocked thing, so it cannot be step one. `Ungroup` is **not** a
simplifier here — do not reach for it as one.

**Deleting the CONTAINER is ● already** (`Device.deleteObject()`). What gates the
whole strategy is one untested direction:

⚠⚠ **ANSWERED, 2026-08-02 — `e18c`, all four ●●.** New wire `chain.move` +
`chain.inventory`, `methodsHash` **`f1c6401540eb9daa`** (135 methods).

| move | status |
|---|---|
| top level → chain, state preserved | ● E16n |
| ⚠ **chain → top level** | ⚠⚠ **●● 926 ms — and STATE survives, 2/2 marks exact** |
| ⚠ **chain → chain (same container)** | ⚠⚠ **●● 716 ms** |
| ⚠ **chain → chain across DIFFERENT containers** | ⚠⚠ **●● 706 ms** |
| ⚠ **COPY across containers** (not in the original table) | ⚠⚠ **●● 705 ms** — so a rebuild need never drop the device out of the signal path |

⇒ ⚠⚠ **The missing chain DELETE stops being a WALL and becomes a COST.** Both of the
operator's primitives work, and deleting the CONTAINER was already ●.
⚠ **Free rider: `e18d` overturned E4d route 3** — `copyDevices` into a chain works
from a top-level source too, the fifth capability ○ in the spike killed by re-aiming
a written-off verb.
⚠ **The bar is still not met** — see the owed list below, which is what separates a
mechanism from a recommendation.

⚠ **And feasibility is not sufficient.** The operator's bar: *"reasonably efficient,
stable, and low on (or free of) intermediate states that are undesirable or glitchy…
It doesn't need to be perfect — track branching isn't either."* So measure:

- ⚠ ~~**modulator routings across a relocation**~~ ⚠⚠ **MEASURED — `e18e`: ●● 3/3.**
  Modulation survives top→chain, chain→chain **across containers**, and chain→top.
  The silent-breakage risk does NOT materialise **for a modulator on the moved
  device**. ⚠ Required building a fixture first: every modulator preset on disk was
  `routes=0` and modulated nothing. ⚠ **STILL OWED:** E11e's cross-device form, where
  the path encodes a device INDEX — see §3.4.
- ⚠ ~~**chain-level state is NOT carried by moving devices**~~ ⚠ **MEASURED — `e18g`.**
  Colour is ●● readable, writable and per-chain; migration does NOT carry it, but it
  can be re-applied (a cost, not a loss). ⚠⚠ **A chain has NO SENDS AT ALL** —
  `Channel.sendBank()` refuses outright: *"No send bank exists: Requested a send bank
  size of 0"*. That CLOSES the sends half: a rebuild cannot lose what does not exist.
  ⚠ **But a TRACK fork DOES carry sends (E16d)**, so it is a real difference between
  the models, not a non-issue.
- ⚠ ~~**glitch**~~ ⚠⚠ **MEASURED — `e18h` run 3: THE VERB DECIDES.**
  **`MOVE` 0/2 (SILENT) · `COPY` 2/2 · placebo 0/2 · control 2/2.** The two rebuild
  arms differ by one parameter and separate cleanly. ⇒ the operator's mechanism is
  confirmed: **instantiating a plugin is the audible event; relocating an existing
  one is free.** ⚠⚠ **A layer rebuild can be done SILENTLY during playback, which a
  track fork cannot** (5/5 audible, no silent variant) — the first row layers win
  outright, and it partly offsets the 7-undo-step cost.
  ⚠ **HALF THE TRADE-OFF IS UNMEASURED:** the audio ran on a track OTHER than the one
  being rebuilt, so this is the ENGINE-wide glitch. Whether a `MOVE` leaves an
  audible HOLE in the migrated take's own output is a separate probe. **Record both,
  decide neither.**
  ⚠ Runs 1 and 2 were thrown away — one fixture too light to fire the control, one
  window too wide to attribute. Neither was a wrong answer; both were caught by the
  probe's own gates. See FINDINGS "E18h".
- ⚠ ~~**undo granularity**~~ ⚠⚠ **MEASURED — `e18f`: SEVEN undo steps per rebuild.**
  The rule is **one structural API call = one undo step**, and the trail maps the six
  rebuild steps exactly. ⇒ the user's single Cmd-Z does NOT undo "the take change";
  it lands mid-migration. **This is the real regression versus the track model**,
  where a branch is one op and one Cmd-Z. ⚠ Invisible until the user hits undo once.
- ⚠ ~~**atomicity**~~ ⚠ **MEASURED — `e18f`: 6 of 7 intermediate states hold BOTH
  containers**, takes duplicated across them. Reachable by one keystroke.
- ⚠ ~~**cost**~~ ⚠ **MEASURED — `e18f`: 4276 ms** for a 4→2 reduce carrying 2 devices
  (wall-clock, settle-inclusive, so an upper bound). ⚠ **The migrations are the cheap
  part** (~300 ms each); the fixed container insert (777) + grow (805) + **delete
  (1688)** dominate. So cost scales gently in devices — that is the good news.

### 3.2 ⚠ Chain `channelId` durability — RE-MEASURE FROM SCRATCH (operator's request)

`e17ad` found 8/8 chain ids changed across a reload while names survived, under a
structural-fingerprint gate with the `Track` id control passing — and `channelId` is
stable *within* a session. **The operator wants it rebuilt anyway**, and the reason is
good:

> *"it is weird that channel identity is stable for tracks but not for chains when
> they share the same underlying object that channelId's name implies."*

⚠ That asymmetry now has a possible explanation worth testing directly: `Track` and
`DeviceLayer` differ elsewhere in exactly this way — a `Track` is a first-class
persisted object, a `DeviceLayer` is not. **Build it fresh, with a fresh fixture, and
do not reuse `e17ad`.**

⚠ **The operator has already de-escalated what rides on it:** identity holds within a
live project, which covers most needs; a mid-session reload can fall back to
best-effort take identification, or to treating a take layer as an ordinary layer.
So this is a *characterisation*, not a blocker.

⚠⚠ **CLOSED, 2026-08-04 — `e18b`, a MATCHED PAIR on ONE fixture.** Rebuilt from
scratch as asked, and it splits the reload `e17ad` could only test as a lump:

| arm | chain ids | proof |
|---|---|---|
| ⚠ **extension reload** (project stayed open) | ⚠⚠ **●● 4/4 SURVIVED** | `methodsHash` moved |
| ⚠ *replicated, 2nd extension reload* | ⚠ **●● 4/4 SURVIVED** | new jar |
| ⚠⚠ **PROJECT reload** (save + quit + reopen) | ⚠⚠ **○ 4/4 REGENERATED** | ⚠ undo stack CLEARED |

⇒ ⚠⚠ **A chain `channelId` lives in the RUNNING PROJECT and is minted by the project
LOADER.** The operator's "weird" is answered: the asymmetry with tracks is about what
the project **FILE** persists — a track id is written to disk, a chain id is created
at load. ⚠ **Nothing on our side can recover it**, and `e17ad` is CONFIRMED
independently on a fresh fixture.

⚠ Two method points worth carrying: a `resnap` mode was needed because rebuilding the
fixture would have MINTED NEW IDS and turned the matched pair into two unrelated
experiments; and proving WHICH reload happened needed a project-level detector
(`canUndo` true → false), since `methodsHash`/`initEpochMs` only prove the JAR
re-inited and a controller reload would otherwise have masqueraded as this arm.

⇒ **Addressing a take layer across sessions must rest on the NAME** (E17 row 5:
sticky across a content change AND a save + restart). ⚠ This is the one place D6
inverts — for tracks the id is the key and the name is the human tag; for chains
there is no key and the tag is all there is.

### 3.4 ⚠ MODULATOR ROUTINGS — ANSWERED for the common case; ONE case still owed

⚠⚠ **ANSWERED, 2026-08-02 — `e18e`, ●● 3/3.** A modulator riding on the relocated
device keeps working across every direction a rebuild uses, including chain → chain
across DIFFERENT containers and chain → top level. Baseline divergence 0.00357,
legs 0.00239 / 0.00303 / 0.00359.

**It took building the instrument first, and both halves are worth carrying forward:**

- ⚠ **Every modulator preset on disk was `routes=0`** — they modulate nothing, being
  `bwmod` FORMAT fixtures where the question was whether a modulator *loads*. A probe
  on them would have compared 0 against 0 and reported success.
  ⇒ `src/tools/build-e18-modfixture.ts` authors a real one. **Two candidates, because
  whether a modulator RUNS at rest is not knowable offline** — `lfo-sampler` works,
  `vibrato-poly` validates and routes perfectly and produces **exactly zero** movement.
- ⚠ **The floor must be MEASURED, not asserted.** A first draft hard-coded 0.01 and
  would have discarded a working fixture swinging ±0.0036. An unmodulated parameter
  reads `modulatedValue == value` **exactly**, so the test is *non-zero vs exactly
  zero* (~3600:1), and an unrouted NEGATIVE CONTROL establishes it in the same sitting.

⚠⚠ **STILL OWED — E11e's CROSS-DEVICE form, and it is the nastier one.** A modulator
on the **outer container** routed into a chain has the path
`…/DEVICE_CHAIN/<deviceIndex>:CONTENTS/<PARAM>` — it **encodes a device INDEX**, which
is exactly what a rebuild renumbers. ⚠ `e18e`'s green says NOTHING about it.

Two things block it, and only the first is hard:

1. `gn_crossdev_outer`'s route targets the inner **Delay+ at index 1**;
   `devcursor.selectFirstInSlot("CHAIN")` lands on device **0**, and no wire method
   addresses the *n*th device inside a non-layer container.
2. A container-modulator fixture would have to be authored against an
   Instrument/FX **Layer** rather than a `Chain` device, so the route crosses a real
   take chain.

⇒ Both are tractable — `bwmod` can author it and one wire method reaches the target —
but it is a session of its own, not a follow-on.

### 3.3 Owed, and each cheap

- ⚠ ~~**`insertFile` against the MASTER and an FX RETURN.**~~ ⚠⚠ **DONE — `e18a`,
  2026-08-02, ●● all nine cells.** §6.1's load-bearing assumption is now a
  measurement: a **multi-chain container reaches both destinations autonomously**
  (FX Layer by UUID → `layer.select` → `duplicateChannel`, 1 → 2 chains on the
  Master and on `FX 1`, control bracketing before/between/after). `insertFile` of
  the 4-chain instrument preset also lands **filled** at both, and an Instrument
  Layer by UUID lands too — ⚠ so **there is no device-type gate at these
  destinations**, and the type/route confound the probe was built to separate does
  not exist. Costs are equal (~465 ms settle-inclusive for both routes). See
  FINDINGS "E18a". ⚠ Two readback traps paid for there: `cursor.status.trackPosition`
  is the cursor CLIP's track and reads `-1` on the Master and FX returns, and
  `cursorTrack.position()` is **per-parent-group, not the bank index** — two tracks
  in this project genuinely share position `0`.
- **`Ungroup`** and the **named `Copy`+`Paste` route** — both ○ under the broken
  harness, never re-run. Neither can move the call, but both are loose ends.
- **`app.undo` as a destroy path** — it demonstrably removes a chain, but whether it
  is *usable* (it undoes the last operation, not a chosen one) is unexamined.

---

## 4. What E18 must NOT do

- ⚠ Do not re-measure §2.
- ⚠ Do not put anything in `DECISIONS.md` (standing rule 10) — propose, the user
  decides.
- ⚠ Do not run a foreground-gated probe unprompted (operator instruction, 2026-08-01).
- ⚠ Do not use named actions where a typed route exists.

---

## 5. Carried forward

**The track-vs-device branching decision is STILL PENDING and is the user's.**
E17 did not settle it; it changed what the arguments are. The honest current state:

| | track fork | layer chain |
|---|---|---|
| ⚠ ~~bank-window cost~~ | ⚠ **RETIRE THIS ROW — E18-VERDICT §3a.** E16r's ceiling was a rig configured at `bankSize=16`; E5b/E5c measured **256×128** at 25–28 ms cold and recommend it. The budget is `256 − project size`. What survives is the *failure mode* (an orphan we cannot name), not the ceiling | — |
| ⚠⚠ **ONE-CLICK exclusive A/B** | ⚠⚠ **○ DOES NOT EXIST** — mute is not exclusive (≥2 writes), solo is not local (10 tracks flipped) | ⚠⚠ **● one flag, `toggle(exclusive=true)`, 0 of 10** |
| ⚠ **one mechanism across ALL destinations** | ⚠ **○ a SEAM** — fork on a track, layer on the Master/FX | ⚠ **● uniform** |
| ⚠ **post-hoc restructuring** | ⚠ **○ none — `moveTracks`/`copyTracks` are silent no-ops (K2)** | ⚠⚠ **●● all four directions, state preserved (`e18c`)** |
| Master / FX returns | cannot be forked at all | ⚠ **● reachable AND growable — measured, `e18a`** |
| audio glitch | 5/5 vs 0/3 placebo | none measured |
| disk | 20,391 B/fork | ~0 |
| A/B gesture | mute, not quantised | **solo — exclusive, one flag** |
| human-editable tag | ● | ● survives reload |
| CREATE | ● | ⚠ **● autonomous** |
| ⚠ **DESTROY** | ● exact | ⚠ **○ typed — but §3.1's REBUILD is now ●● measured (`e18c`)** |
| ⚠ **durable identity** | ● `channelId` | ○ name only — ⚠ and `e18b` shows *why*: the id is minted at project load, so it is unrecoverable in principle |
| **carries CLIPS** | ● | ○ never |

⇒ ⚠ **Updated 2026-08-02.** Layers still lose on three rows, but the FIRST one
changed character: destroy is no longer a wall, it is a **rebuild cost** whose
mechanism is measured (`e18c` ●● ×4, state preserved). ⚠ **And the cost is now
partly priced** (`e18f`): 4276 ms, and **7 undo steps per rebuild** against the track
model's one. ⚠ **A fourth row therefore belongs in this table and did not exist
before:**

| | track fork | layer chain |
|---|---|---|
| ⚠ **UNDO granularity** | ⚠ **● one op, one Cmd-Z** | ⚠⚠ **○ 7 steps; one Cmd-Z lands mid-migration** |
| ⚠ **AUDIBLE GLITCH** | ⚠ **○ 5/5 audible, no silent variant** | ⚠⚠ **● SILENT via MOVE** (0/2, control 2/2, placebo 0/2) — COPY is 2/2 audible |

**Identity and clips are unchanged**, and `e18b` makes identity *worse*-founded
rather than better: the id is regenerated by the project loader, so no care on our
side recovers it. ⚠ Still unpriced: glitch, modulator routings, colour + sends.

**`E16-REPLAN.md` §3 is still pending behind the decision.** Its proposed mechanism
(`DeviceLayer.solo()`) is unaffected by everything E17 found — solo is typed and
autonomous. ⚠ But §5's *"the preset library is the whole story"* is **stale**: a
multi-chain FX Layer can now be built at runtime with no preset at all.

---

## 6. ⚠ ~~`E17-VERDICT.md` needs a REWRITE, not a patch~~ — **DONE, 2026-08-04**

⚠⚠ **`E18-VERDICT.md` is the fresh one**, written at the user's request once §3.1
and §3.2 had both reported. `E17-VERDICT.md` is RETIRED — kept as the record of how
the argument moved, with a banner naming the two claims of its that are now measured
false. Prefer §2 and §5 above for state, and `E18-VERDICT.md` for the argument.

⚠ **What E18-VERDICT adds that is NOT in §5's table**, so it is not lost if only the
handoff is read:

1. ⚠⚠ **Retire the bank-window row.** It has flattered the layer model in every
   pitch table since E16. `E16r`'s ceiling was measured on a rig configured at
   `bankSize = 16`; `E5b`/`E5c` measured **256×128** at 25–28 ms cold with zero
   stalls and recommend it as the shipped size. The budget is `256 − project size`.
   What survives is the *failure mode* (an orphan we cannot name), not the ceiling.
2. ⚠ **The identity row nearly dissolves** — not because `e18b` was kind, but
   because `E16-REPLAN` §1.1 CUT UC8 and UC11 and §1.3 made the system stateless.
   Nothing holds ids across sessions in either model, and chain ids are stable
   *within* one. The residual same-name risk is A4, which tracks have identically.
3. ⚠ **The 7-undo cost is 7-vs-3, not 7-vs-1** (a track branch is fork + rename +
   group), **and it lands on the agent only** — §4.16/D17g already say the human
   reaps, and a human's chain delete is one gesture and one undo step.
4. ⚠ **`moveTracks`/`copyTracks` are silent no-ops (K2)** while `e18c` moved devices
   in all four directions with state preserved. ⇒ **layers are the only model whose
   take structure can be reorganised after it exists.** This row was never in the
   table.
5. ⚠ **"Tracks only" was never on the table** — `e18a` makes layers the measured
   answer for the Master and the FX returns, so the mechanism gets built either way.
6. ⚠⚠ **ONE-CLICK exclusive A/B does not exist for tracks, and that is a measured
   CAPABILITY GAP** — not an ergonomic preference. Bitwig offers exactly two channel
   gestures and a take A/B needs one that is both exclusive and local: **mute has no
   exclusive variant** (a switch is ≥2 flag writes, for the human as much as for us)
   and **solo is project-global** (E17 row 6's control flipped 10 tracks). A chain's
   `SoloValue.toggle(exclusive=true)` is one flag, 0 of 10. ⚠ This is the row that
   sent the operator looking at layers in the first place.
7. ⚠⚠ **The CLIP BLOCK — new, and the strongest single argument in the comparison.**
   Takes as *contiguous clips in ONE track's column bounded by empty slots*, which
   delimits a Bitwig Next Action's round-robin ⇒ **the A/B advances itself, on the
   bar, with no gesture from the human OR the agent.** Nothing in either device model
   competes with it, and alternates spread across sibling tracks cannot do it at all.
   ⚠⚠ **BUT Next Actions are NOT IN THE CONTROLLER API**, and it is a SHARP
   negative rather than a gap in our search: **the neighbouring inspector fields ARE
   exposed and documented as such** — `Clip.launchMode()` is javadoc'd *"Setting
   "Launch Mode" from the inspector"*, `useLoopStartAsQuantizationReference()` is
   *"Setting "Q to loop" in the inspector"*. Bitwig surfaced that panel and left one
   field out. Method: five classes dumped **in full with descriptions** (`Clip` 61,
   `ClipLauncherSlot` 16, `ClipLauncherSlotOrScene` 21, `ClipLauncherSlotBank` 18,
   `Scene` 8) **plus** the decisive check — the string *"next action"* appears
   **nowhere in the entire javadoc tree**. (`selectNextAction()` is
   `Cursor`/`Application` navigation; `recurrence*` is `NoteStep`.)
   ⇒ **the human arms a block; we own its geometry** (`hasContent()` makes
   contiguity checkable, `slot.moveTo` ● 163 ms restores it) — ⚠ **and we cannot
   tell an armed block from an unarmed one.**
   ⚠⚠ **THE CONSOLATION IS BIGGER THAN THE LOSS — `launchWithOptions(String
   quantization, String launchMode)`** (API v16, on `ClipLauncherSlotOrScene` and
   `Clip`). `quantization` ∈ `"default"|"none"|"8"|"4"|"2"|"1"|"1/2"|"1/4"|"1/8"|
   "1/16"` ⇒ **a PER-CALL override**, bar or phrase. `launchMode` ∈
   `"default"|"from_start"|"continue_or_from_start"|`⚠⚠`"continue_or_synced"`⚠⚠`|
   "synced"` ⇒ **take B resumes at take A's playback position instead of restarting
   the loop** — the same bar rendered differently, which no mute, solo or chain
   switch can imitate. ⚠ UNPROBED and not on our wire — **wire and probe it before
   the clip half is designed**, since the whole ergonomic claim runs through it.
   ⚠⚠ **BUT IT DOES NOT RECOVER THE UNATTENDED HALF** (operator, 2026-08-04, and
   they were right): `launchWithOptions` is a **VERB, one call per switch** — it
   governs how a launch behaves, never *whether* one happens. ⇒ **the MUSICAL
   QUALITY of the clip A/B is ours; its UNATTENDEDNESS is not.** Engine-driven
   cycling exists in Bitwig only through the Next Action, so the human arms it or it
   does not happen. ⚠ **Score the auto-advance as an affordance the block layout
   unlocks FOR THE OPERATOR, never as a system capability.**
   ⚠ One route considered and SET ASIDE: `ControllerHost.scheduleTask(Runnable,
   long)` + `Transport.playPosition()` would let the **extension** fire launches on
   a timer — and quantisation makes that musically exact despite sloppy scheduling,
   since the engine snaps the switch to the bar. The extension is alive whenever
   Bitwig is (`E16-REPLAN` §2 session 3), so it would not die with a chat session.
   ⚠ **The operator excluded it by name** — *"unattended (by the agent or
   extension)"* — because it puts us in the loop driving the musician's listening.
   Recorded so a reopening inherits it.
   ⚠ Other free riders, also unprobed: `ClipLauncherSlot.duplicateClip()` (mints the
   next take), `isPlaybackQueued()`/`isStopQueued()` (a *pending* switch is readable
   — solo flags have no equivalent).
8. ⚠ **Slot launching ALWAYS; a scene is a ROOM primitive, not a take primitive.**
   `createScene()` is called only when a track's column has no free slot.
   ⚠ **Discipline: APPEND ONLY** — `nextSceneInsertionPoint()` inserts mid-grid and
   shifts every row below, exactly as `Scene.deleteObject()`'s upward compaction does
   (E3), with the same permanent `sceneIndex` staleness on a pinned cursor.
9. ⚠ **THREE owed measurements were DISPOSITIONED BY OPERATOR JUDGEMENT** (2026-08-04)
   — dormant-chain CPU, container PDC/transparency, and launch quantisation. ⚠ They
   are recorded in `E18-VERDICT.md` §7a as **judgement with named retirement
   conditions, not as measurements**, per the house convention `E16-TRACK-NATIVE` §2
   uses for `isActivated(false)`. ⇒ §3c's subset-scoping advantage and §3f's
   "pruning is the human's job" now rest on operator experience, and that dependency
   should stay visible.
