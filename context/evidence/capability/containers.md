---
title: Containers — device layers, selectors and drum machines
kind: capability
state: active
updated: 2026-08-15
scope: nested device containers; chain lifecycle, switching, addressing and state
evidence: E4c, E4d, E16 §3.4e, E16n/o, E16w, E17, E18a-h; D6, D18
---

# Containers

> **Provenance.** Each claim carries `[K]` known, `[I]` inferred or `[U]`
> unknown, and cites its E-number or names its observer and date. Read the four
> rules in [INDEX.md](INDEX.md) before you edit this page.

A container is a device that holds device chains. Bitwig has three kinds, and
they differ in ways that decide the product.

| Container | Chains run | Which chain is live | Ships with |
|---|---|---|---|
| Instrument / FX / Note FX **Layer** | in **parallel** | N mute and N solo flags | FX Layer **1**, Instrument Layer **0** |
| Instrument / FX **Selector** | one at a time | one integer, `activeChainIndex()` | **0** |
| **Drum Machine** | one per MIDI note | the note played | 0 pads; a pad appears when you fill it |

⚠ **Layer chains are the product path.** The Selector has the cleaner switch
model and cannot be used for live A/B. §"Why the Selector is out" states why.

---

## 1. Bootstrap — what a fresh container gives you

- A fresh **FX Layer** ships with **1 chain**. A fresh **Instrument Layer** ships
  with **0** [K, [E17](../experiments/e17-device-layers-a-chain-can-be-created-and-soloed-and-never-grown-.md), re-confirmed at three destinations by [E18a](../experiments/e18a-6-s-load-bearing-assumption-is-now-a-measurement-a-multi-chain-c.md)].
- An FX Layer can therefore grow from nothing, fully typed: insert it, select
  chain 0, duplicate, repeat [K, E17 `e17ak`].
- An Instrument Layer has no first chain to copy. Production creation uses the
  bundled build-time seed asset
  (`brain/assets/device-alternates/instrument-layer-seed.bwpreset`) [K, live
  conformance, 2026-08-14].
- `hasLayers=true` does **not** mean a chain exists. Read the layer bank count,
  never the capability flag [K, [E4c](../experiments/e4c-device-nesting-layers-pads-slots-selectors-2026-07-19.md)].
- A container can be placed on an ordinary track, on an **FX return** and on the
  **Master**, and grown there, with no preset, no named action and no human
  [K, E18a]. The API applies no device-type gate at those destinations.

---

## 2. Chain lifecycle

### Create — ● autonomous and typed

`layer.select(editor, index)` then `Channel.duplicate()` creates a full chain
copy [K, E17 `e17ak`]. The selection is the precondition the whole spike missed.

⚠ Two verbs that older write-ups reported together are different:

| verb | with a chain selected |
|---|---|
| `Channel.duplicate()` | ● creates a full chain copy |
| `DeviceLayer.duplicateObject()` | ○ dead |

### Delete — ○ every typed verb refuses

`deleteObject()`, `deleteObjectAction().invoke()` and `host.deleteObjects()` all
refuse on a `DeviceLayer`, each tested with and against the selection
precondition that unlocked create, and each bracketed by the `Track` sibling
control passing in the same run [K, E17 `e17al`/`e17am`].

**The mechanism predicts the ○ rather than recording it:** a `DeviceLayer`
honours the verbs `Channel` declares itself and declines every verb it merely
inherits. `Channel` declares no delete at all, so nothing is left to try
[K, E17]. `Track` honours all of them because a track is a first-class deletable
object.

⇒ Reduction therefore relocates devices and deletes the **container**.
`Device.deleteObject()` on a container is ● [K, E17].

### Rename — ● and it is the only durable handle

A chain name survives a content change [K, E17 row 5] and a save plus restart
[K, E17 `e17ad`, 8/8 names kept while 8/8 ids changed in the same read].
⚠ Cite `e17ad` and not `e17n` for the restart half. E17 marks its own `e17n`
table *"not independently trustworthy"*, because that probe never asserted how
many containers sat on the track.
⚠ An **untouched** shipped chain auto-renames itself to its first inserted
device [K, [E4c](../experiments/e4c-device-nesting-layers-pads-slots-selectors-2026-07-19.md); re-discovered live by the 3f conformance row, 2026-08-14].
⇒ Name every chain explicitly before you rely on its address.

### Fill and relocate — ●

- `moveDevices` moves a device into a layer chain, and the device keeps its
  parameter state [K, [E16n/o](../experiments/e16n-e16o-e4d-route-3-is-wrong-relocates-a-device-into-a-layer-and-it.md)].
- `copyDevices` into a layer chain works too, from a top-level source and from a
  nested one [K, [E18d](../experiments/e18d-e4d-route-3-is-a-false-negative-into-a-layer-chain-works-k-2026-.md)]. E4d route 3's ○ was a single-mechanism false negative.
- A device can leave a chain and cross containers, and it keeps its state. All
  four directions were measured, and the parameter marks survived 2/2 read
  through a different handle than the one that wrote them
  [K, [E18c](../experiments/e18c-the-rebuild-strategy-is-mechanically-available-a-device-can-leav.md)]:

  | direction | needed by | result |
  |---|---|---|
  | chain → top level | collapse | ●● 926 ms |
  | chain → chain, same container | — | ●● 716 ms |
  | chain → chain, different containers | reduce | ●● 706 ms |
  | copy across containers | reduce | ●● 705 ms |

  ⇒ The missing chain delete stops being a **wall** and becomes a **cost**.
- Modulation on a relocated device survives every one of those legs, 3/3
  [K, [E18e](../experiments/e18e-modulation-survives-every-relocation-and-the-fixture-that-proves.md)]. ⚠ See §10 for the form this does **not** cover.
- `insertFile` materialises an arbitrary multi-chain structure in one call
  [K, [E4d](../experiments/e4d-chain-creation-e4c-s-was-wrong-2026-07-19.md) route 4].
- ○ No relocation verb creates a chain. `moveDevices` reads 0→0 on an Instrument
  Selector, an Instrument Layer and a Note FX Layer, and 1→1 on an FX Layer
  [K, E16o].

---

## 3. Switching and audibility

### The Selector — one integer, 25 ms, and it does not touch routing

| row | result |
|---|---|
| `chainselector.status` | ● `chainCount=2 activeChainIndex=0` |
| switch latency | ● **25 ms** to `activeChainIndex==1` (50 ms round trip) |
| does the switch cut the track's SENDS? | ● **No** — FX 1 reads 51 before, 52 after |
| does the switch GLITCH? | ○ **No** — 0/4 real against 0/4 placebo, forced balance |

[K, all four rows, [E16 §3.4e](../experiments/e16-3-4e-chain-selector-switching-latency-and-sends-glitch-owed-k-20.md)]

A chain switch happens **inside** the instrument, upstream of the send tap. A
track mute cuts sends; this does not. That is the property that would make a
Selector usable on an FX return and on the Master [K, E16 §3.4e].

For contrast, track duplication glitched **5/5 against 0/3 placebo** (C5), so
the device-scoped switch is free of the one cost that makes a track fork
expensive [K, E16 §3.4e].

⚠ **The positive control is still owed.** A null ear result cannot separate "no
glitch" from "this listener and rig could not have heard one". The missing arm
is a trial where an artifact certainly occurs. Record this as **owed evidence,
not as a defect**: the row is real, and it must not be quoted as strongly as C5,
which had an audible artifact in its own real arm [K, E16 §3.4e].

### The Layer — N flags, not one integer

A `DeviceLayer` chain's `mute()` works. Muting the chains takes the track out of
the mix as completely as muting the whole track: 57 open against **11**, on a
room floor of 12 [K, [E16w](../experiments/e16w-a-devicelayer-chain-s-works-a-device-scoped-a-b-exists-k-2026-07.md)].

Solo on a chain is **container-scoped and locally exclusive** [K, E17 row 6].
Both halves were measured:

- **Scope.** Solo the *track* `gn-lay` and **10** tracks flip to `mutedBySolo`.
  Solo one *chain* of its Instrument Layer and **0** do. The chain solo does not
  leave the container.
- **Local exclusivity, by meter.** Both chains open 66. Chain 0 alone by mute 63;
  chain 1 alone by mute 25. **Solo chain 1 reads 23**, a distance of 2 from
  "chain 1 alone" and 43 from "both open". **Solo chain 0 reads 60**, against 63.
  Every solo cleared reads 67.

⚠ The probe refuses to read the solo arms at all unless the two mute arms differ
by 10 or more. The exclusivity claim rests on a calibrated instrument, not on a
bare flag readback [K, E17 row 6].

Ghostnote's `chain.activate` uses this: it makes one named chain the sole soloed
sibling, and it accepts success only after an independent complete container
readback proves it [K, live, 2026-08-14].

⚠ Layer chains run in **parallel**, so muting is not switching, and the live
state is N flags rather than one readable integer. That is a real cost of the
layer model and it is stated rather than hidden [K, E16w].

⚠ **A per-track VU tap is pre-mute.** A muted track still reads 56-58 on its own
meter. The Master is the arbiter for "does it reach the mix"; the track's own tap
is the arbiter for "did the device stop producing" [K, E16w].

---

## 4. ⚠⚠ Why the Selector is out — the disqualifying fact

> **[I], observed by the user, live, 2026-08-15.**
> A deactivated Selector chain is **fully disabled**. Its tail continues to sound
> after deactivation, and a newly activated chain takes no input until it is
> active.

⇒ Switching is **not instantaneous at the audio boundary**. That rules the
Selector out for live A/B — the exact use its exclusivity was attractive for.

⚠ This is the **same mechanism as the CPU saving**, not a separate defect: only
the active chain runs. It qualifies [E16 §3.4e](../experiments/e16-3-4e-chain-selector-switching-latency-and-sends-glitch-owed-k-20.md) materially, and the E-file is
correct as written — it measured switch latency and sends, and it did not
measure the audio boundary across the switch.

**Probe that would raise this to `[K]`:** switch between two chains that hold a
long release-tail patch, and measure the decay across the switch point against a
layer-mute control.

⇒ **Layer chains remain the product path.** This page records the Selector's
capability; the product stays on layers.

---

## 5. ⚠ Corrected in place — "Selectors cannot be seeded"

**Superseded, 2026-08-15.** The claim *"Selectors ship with zero chains and
cannot be seeded"* is **two claims**, and only one of them survives.

| claim | status |
|---|---|
| No verb creates a chain in a Selector | ● **stands** [K, E16o] |
| No shell can be obtained, so a human must build it | ⚠ **superseded** |

A bundled build-time preset supplies the shell. That is exactly what
`instrument-layer-seed.bwpreset` does for the Instrument Layer, and `insertFile`
is fully typed with no focus dependency [K, E4d route 4; E18a].

**Where the stale statement lived, and why that matters.** The freshest
statement of this verdict was a comment in
`extension/src/main/java/com/ghostnote/extension/handlers/ContainerHandlers.java:188`.
It was stale against the build-time seed-asset rule now in
[PROJECT.md](../../PROJECT.md). Supersession had nowhere else to land, because
an experiment file is a frozen record by design. **This axis exists so that it
lands here instead of in code.**

⚠ `[U]` **Untested link.** Nobody has run `Channel.duplicate()` against a
**Selector** chain as opposed to a Layer chain. E17 `e17ak` proved the recipe on
a fresh FX Layer only. **Probe:** seed a Selector from a preset, select chain 0
with `layer.select`, call `layer.duplicateChannel`, and read the chain count
back. Do not assume the Layer result transfers.

---

## 6. Addressing and cursor descent

- ⚠ `devcursor.selectFirstInLayer` descends an **Instrument Layer** chain in
  **141 ms** and **times out on an Instrument Selector's** at 6 s, with the
  cursor left on the container [K, E16 §3.4e]. The two container types expose the
  same chains to `layer.list` and diverge on cursor descent.
- **Mitigation, and it is the shipped design.** Product container reads and
  writes use the cursor-free `Rig.slotLayerBanks` and do not move `cursorDevice0`
  [K, live, 2026-08-14].
- A chain is addressed by **container position plus name** [K, live, 2026-08-14].
  See [identity](identity.md) for why the name and not the id.
- The device-cursor model is recursive: the layer bank re-scopes to whatever the
  cursor points at, so one pre-allocated bank serves every depth [K, E4c].
- ⚠ **Any handler that reaches a cursor-following bank has the cursor as a hidden
  argument.** Aim it wrongly and you get a silent no-op, not an error — which is
  byte-identical to a genuine API refusal [K, E16o method trap].

### ⚠ Container scope lags the cursor, and the budget was wrong

`LiveAdapter.containerScope` re-points cursor 0 and reads `chain.inventory`. It
waited the `cursorPoint` budget (25 ms) — a budget borrowed from what a cursor
*point* costs, while this reply arrives through `Rig.slotLayerBanks`, which must
follow the cursor to another track first.

Measured, re-pointing between tracks and reading immediately, the reply named the
track just pointed at:

| wait | correct |
|---|---|
| 0 ms | 0/6 |
| 25 ms | 3/6 |
| 50 ms | 5/6 |
| 100 ms and above | **6/6** |

[K, measured live, 2026-08-15, session 3f-g review]

Nothing was ever mis-reported, because the identity guard fails closed. But
every container write refused about half the time when the cursor had been
elsewhere. A mismatch is now retried within a bound of 8 attempts, because a
mismatch is a staleness signal and never an observation. ⚠ The bound counts
**attempts, not wall-clock**: a clock spins hot wherever `settle` is not real
time, which is every offline test of this class.

---

## 7. Chain-level state

Relocation carries the devices and nothing else. A rebuild must re-apply or
report every chain property that was set.

| property | status |
|---|---|
| name | ● re-appliable, and durable across save + restart [K, E17 row 5] |
| colour | ● readable and writable per chain [K, [E18g](../experiments/e18g-chain-level-state-colour-is-re-appliable-and-a-chain-has-no-send.md)] |
| mute, solo, volume, pan | ● re-appliable [K, E16w, E17 row 6] |
| ⚠⚠ **sends** | ⚠⚠ **○ a chain has none at all** [K, E18g] |

⚠ `Channel.sendBank()` does not return an empty bank on a layer. It refuses to
create one: `No send bank exists: Requested a send bank size of 0`. That is a
far stronger negative than a silent no-op — the API states the capability is
absent [K, E18g]. ⇒ A rebuild cannot lose what does not exist.

⚠ A **track** fork does carry sends, so this is a real difference between the two
branching models rather than a non-issue [K, [E16 rows D–G](../experiments/e16-rows-d-g-a-b-by-mute-is-audibly-correct-but-duplication-glitches.md), cited by E18g].

---

## 8. Cost

### Undo — ⚠⚠ one rebuild is seven undo steps

The rule is **one structural API call, one undo step**. A `reduce` rebuild of six
structural calls produced **seven** undo entries, because the container delete
un-deletes as its own entry [K, [E18f](../experiments/e18f-one-rebuild-is-seven-undo-steps-the-first-real-cost-of-the-layer.md)].

⇒ **The user's single Cmd-Z does not undo "the take change". It lands inside the
migration.** ⚠ Six of the seven intermediate states hold **both** containers.

Wall-clock for a 4→2 rebuild carrying two devices: **4276 ms** across six steps.
The container delete alone was **1688 ms**, the most expensive step. ⚠ These are
settle-inclusive and poll-quantised at 200-250 ms, **not** API latencies — E17
measured `Device.deleteObject()` at 577 ms, so the 1688 is inflated by our own
settle policy [K, E18f].

### Audibility — ⚠ the verb decides

| arm | heard |
|---|---|
| rebuild by **copy** | ⚠ **2/2 audible** — it instantiates a second plugin instance |
| rebuild by **move** | ⚠⚠ **0/2 — silent** |
| placebo | 0/2 — the listener is not pattern-matching |
| control, a track fork on E16 C5's fixture | 2/2 — the rig resolves a glitch |

[K, [E18h](../experiments/e18h-the-verb-decides-a-move-based-rebuild-is-silent-a-copy-based-one.md) **run 3 only**; runs 1 and 2 are void and conflated, and this page
must not cite them]

⇒ **Instantiating a plugin is the audible event. Relocating an existing one is
free.** This partly offsets the seven-undo-step cost above.

⚠ **What E18h did not measure, and must not be reported as if it had:** whether
the migrated take's **own** output has an audible hole while it is between
containers. What was measured is that a move-based rebuild causes no engine
glitch anywhere in the project.

### Other

- `insertFile` at an FX return or the Master costs no more than a plain device
  insert [K, E18a]. The preset route is not the expensive one.
- A branch costs about 20 KB on disk and nothing in save time
  [K, [E16u](../experiments/e16u-a-branch-costs-20-kb-on-disk-and-nothing-in-save-time-k-2026-07-.md)].

---

## 9. ⚠ Do not transplant the track-level collapse primitive

[E16k](../experiments/e16k-a-group-is-a-usable-branch-container-the-collapse-primitive-work.md) proved a **track-level** collapse: delete all but one child, then
`Ungroup`, and the group dissolves in about 243 ms with the survivor's
`channelId` intact.

⚠⚠ **That primitive does not transfer to containers, and E17 records why: it is
circular here.** K3 works at track level *because track delete works*. At device
level the delete is the blocked thing, so it cannot be step one [K, E17].

⇒ At device level the two shapes are:

```
reduce    clone the container with fewer chains, migrate devices, delete the old
collapse  migrate the chosen chain's devices out to top level, delete the container
```

---

## 10. Open questions

| # | Question | Tag | Probe that would settle it |
|---|---|---|---|
| 1 | Does the Selector's audio boundary behave as §4 describes? | `[I]` | Long release-tail patch, measure decay across the switch against a layer-mute control |
| 2 | Does `Channel.duplicate()` fire on a **Selector** chain? | `[U]` | Seed a Selector from a preset, `layer.select` chain 0, `layer.duplicateChannel`, read the count back |
| 3 | Does a Selector switch glitch, against a positive control? | owed | A trial where an artifact certainly occurs; the layer-mute A/B (E16w) is that control and was never run in the same sitting |
| 4 | Is **cross-device** modulation carried across a rebuild? | `[U]` | See below. Keep it outside every claim until measured |
| 5 | Does a move-based rebuild leave a hole in the moved take's **own** output? | `[U]` | E18h measured the project, not the take. Measure the take's own tap across the migration window |

⚠⚠ **Question 4, stated exactly, because the green E18e result does not touch
it.** E18e measured a modulator **on the device being moved**, routed to **its
own** parameter. It did not measure E11e's cross-device form — a modulator on the
**outer container** routed into a chain, whose path is
`…/DEVICE_CHAIN/<deviceIndex>:CONTENTS/<PARAM>` and therefore **encodes a device
index**. That is precisely the path a rebuild could renumber. **E18e's result says
nothing about it** [K, E18e scope note].

---

## Supersession record

| Date | Change |
|---|---|
| 2026-08-15 | Page created. It supersedes the *reading* of E4c's "layers cannot be created", E4d route 3's ○, and E17's early "a chain is not addressable" drafts. Every one of those E-files is already self-corrected and is left frozen. |
| 2026-08-15 | *"Selectors cannot be seeded"* split into two claims; the shell half superseded. §5. |
| 2026-08-15 | Selector deactivation recorded at `[I]`; Selector closed for live A/B. §4. |
