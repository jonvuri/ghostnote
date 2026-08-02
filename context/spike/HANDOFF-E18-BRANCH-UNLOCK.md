---
title: Handoff for E18 — the device-branch REBUILD path, and the measurements it gates
status: ⚠ OPEN. E17 answered its question and then overturned its own answer three
        times; what survives is below under SETTLED and must not be re-measured.
        ⚠ E18's job is the REBUILD STRATEGY — the operator's proposal for working
        without a chain delete — plus five owed measurements. The track-vs-device
        branching DECISION is still pending and is the user's (standing rule 10);
        E16-REPLAN.md §3 is still pending behind it.
        ⚠ Nothing goes into DECISIONS.md.
updated: 2026-08-02
predecessor: HANDOFF-E17-DEVICE-LAYERS.md (closed)
carries: the track-vs-device branching call · E16-REPLAN.md §3
evidence: FINDINGS "E17" · E17-VERDICT.md (⚠ needs a full rewrite, see §6)
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

| move | status |
|---|---|
| top level → chain, state preserved | ● E16n |
| ⚠ **chain → top level** | ⚠ **NEVER TESTED** — E16n only measured *in* |
| ⚠ **chain → chain (same container)** | ⚠ **NEVER TESTED** |
| ⚠ **chain → chain across DIFFERENT containers** | ⚠ **NEVER TESTED** |

⚠ **And feasibility is not sufficient.** The operator's bar: *"reasonably efficient,
stable, and low on (or free of) intermediate states that are undesirable or glitchy…
It doesn't need to be perfect — track branching isn't either."* So measure:

- ⚠ **modulator routings across a relocation** (owed since E17) — cross-device
  modulation may break silently, and *silently* is the bad part
- ⚠ **chain-level state is NOT carried by moving devices** — a chain is a `Channel`
  with name, mute, solo, volume, pan, color, sends. Re-applying name/mute/solo/
  volume/pan is ●; **color and sends are untested**
- **glitch** — E16 measured 5/5 audible on track forks vs 0/3 placebo; container
  delete-and-rebuild is heavier than a mute and completely unmeasured
- **undo granularity** — a rebuild is many operations, so one user Cmd-Z lands
  mid-migration. A real UX regression versus the track model
- **atomicity** — if migration fails halfway the old container is already gone
- **cost** — inserts ran ~143 ms, `insertFile` ~764 ms; N chains × M devices adds up

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

### 3.3 Owed, and each cheap

- ⚠ **`insertFile` against the MASTER and an FX RETURN.** §6 of the verdict claims
  layers are the only device-scoped A/B that reaches them; that assumes a container
  can be placed there autonomously and **it has never been tested**.
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
| bank-window cost | 1 slot per branch | **none** |
| Master / FX returns | cannot be forked at all | **reachable** |
| audio glitch | 5/5 vs 0/3 placebo | none measured |
| disk | 20,391 B/fork | ~0 |
| A/B gesture | mute, not quantised | **solo — exclusive, one flag** |
| human-editable tag | ● | ● survives reload |
| CREATE | ● | ⚠ **● autonomous** |
| ⚠ **DESTROY** | ● exact | ⚠ **○ — §3.1 is the workaround, unmeasured** |
| ⚠ **durable identity** | ● `channelId` | ○ name only (§3.2 re-measuring) |
| **carries CLIPS** | ● | ○ never |

⇒ Layers lose on **three** rows now, not the one E17 started with: destroy,
identity, clips. Whether §3.1 dissolves the first is E18's main question.

**`E16-REPLAN.md` §3 is still pending behind the decision.** Its proposed mechanism
(`DeviceLayer.solo()`) is unaffected by everything E17 found — solo is typed and
autonomous. ⚠ But §5's *"the preset library is the whole story"* is **stale**: a
multi-chain FX Layer can now be built at runtime with no preset at all.

---

## 6. ⚠ `E17-VERDICT.md` needs a REWRITE, not a patch

Its conclusion has stayed roughly put while its reasoning turned over three times,
and the document is now a stack of correction banners. **Everything load-bearing has
been consolidated into §2 and §5 above; prefer those.** Rewrite the verdict against
them, or retire it in favour of a fresh one, once §3.1 reports.
