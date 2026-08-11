---
id: E18c
kind: evidence
state: active
source: FINDINGS.md
---

# E18c — ⚠⚠ THE REBUILD STRATEGY IS MECHANICALLY AVAILABLE: a device can leave a chain, cross containers, and keep its state [K] (2026-08-02)

**Verdict: ⚠⚠ ●● all four directions, 2/2 parameter marks survived, both controls
passed.** E18's main question. A chain cannot be deleted by any typed route — the
best-founded ○ in E17 — so the operator proposed working without one: *reduce*
(clone the container with fewer chains, migrate the devices across, delete the old)
and *collapse* (migrate the chosen chain's devices out, delete the container).
⚠ **E16n had only ever measured `moveDevices` in ONE direction, top level INTO a
chain.** Every direction the strategy needs was untested, and no wire method could
even name a device inside a chain as a SOURCE. Probe: `e18c`. New wire:
`chain.move` + `chain.inventory`, `methodsHash` **`f1c6401540eb9daa`** (133 → 135).

| row | direction | needed by | verdict |
|---|---|---|---|
| 1 | ⚠ **chain → TOP LEVEL** | **collapse** | ⚠⚠ **●● 926 ms** — `A1` lost its Polysynth, top level gained it |
| 2 | chain → chain, same container | either | ●● 716 ms — `A2` lost its Organ, `A0` gained it |
| 3 | ⚠ **chain → chain, DIFFERENT containers** | **reduce** | ⚠⚠ **●● 706 ms** — `A3` lost its Sampler, `B0` gained it |
| 4 | ⚠ the **COPY** verb, across containers | a rebuild with no gap in the signal path | ⚠⚠ **●● 705 ms** — source KEPT its Phase-4, `B1` gained one |
| — | ⚠ **STATE across a relocation OUT** | the whole point | ⚠ **●● 2/2** — `F1FREQ` 0.170, `F1RESO` 0.830, exact |

⇒ ⚠⚠ **The missing chain DELETE stops being a WALL and becomes a COST.** Both
primitives work, and `Device.deleteObject()` on the container was already ●.

### ⚠ Why COPY working matters more than the row count suggests

A `move`-based rebuild has a window where the device is **out of the signal path
entirely**. A `copy`-based one does not: copy across, then delete the old container,
and the audio never loses the device. ⚠ That speaks directly to the operator's bar —
*"low on (or free of) intermediate states that are undesirable or glitchy"* — and it
was not a given **on the prior standing at the time**: sibling verbs on this exact
interface had disagreed repeatedly — `copyDevices` ○ beside `moveDevices` ● (E4d
route 3 / E16n), `duplicateObject()` ○ beside `Channel.duplicate()` ●, `copyTracks`
○ beside three working duplication verbs. ⚠ **That particular prior turned out to be
wrong**, and row 4 is what exposed it: see **E18d**, which re-ran the `copyDevices`
question deliberately and found E4d route 3 to be a false negative. The reasoning
above is kept as the prior the row was designed against, not as a current claim.

### ⚠ State survives the direction that matters

`e16o` measured state across a relocation **INTO** a chain. Out of one was never
tested, and it is the direction *collapse* depends on — a take system that rescues
your chosen patch by resetting it is worthless for the one job it exists for.

Two parameters were marked, not one: a single value could coincide with a fresh
instance's default and read as "state survived" when the device was silently
replaced. Marked through `devcursor.selectFirstInLayer(1)` (descending into the
chain), read back through `devcursor.selectAt(topIndex)` after the move — ⚠ **a
different handle than the one that wrote them** (rule 3a / D15), because Bitwig's
cursors cache what you write and report it back whether or not it landed.

### The new wire, and why it is shaped this way

⚠ **`layerBank0` follows `cursorDevice0`, so exactly ONE container is addressable at
a time** — fatal for row 3, where scoping to the destination re-scopes the handle
pointing at the source. `Device.createLayerBank(int)` is declared on `Device`, not
on `CursorDevice` (checked against the 6.0.6 javadoc index before wiring), so layer
banks now hang off top-level device **SLOTS**: two containers, side by side on one
track, never contending.

⚠ **It also removes the e16o trap from the whole row.** Every `layer.*` call is a
silent no-op byte-identical to an API refusal when the cursor is not on the
container; a slot-scoped bank has no such hidden argument, because the container is
named by a parameter rather than by cursor state. Both scopes reported
`status: "held"` — ⚠ and the probe **aborts** unless they do, because standing rule
13 makes *"the handle was never built"* and *"the API declines"* identical in the
outcome, which produced three false ○s in E17.

### Method

- ⚠ **Guard #4 as a CONSERVATION LAW.** Total device population = top-level count +
  every device inside every chain. A `move` must conserve it and a `copy` must add
  exactly one; anything else ABORTS rather than scoring.
- ⚠ **Both halves of every relocation.** The source must lose it *and* the
  destination must gain it. *"The chain is now empty"* is what a successful move and
  a **destructive** one have in common, and only the second half separates them.
  For row 4 the polarity inverts — a copy must KEEP its source — and that is checked
  as its own condition rather than folded into a single boolean.
- ⚠ **Explicit chain names are load-bearing, not cosmetic.** E4c: a layer's DEFAULT
  name tracks its content, so a chain renames itself exactly when its device leaves
  — i.e. precisely when a move succeeds. Row 5's sticky explicit names (`A0`…`A3`,
  `B0`…`B2`) are what let every survivor be NAMED rather than counted (e16t / #13).
  Container B was built EMPTY so anything appearing in it can only have come from A.
- ⚠ **Two independent readers, cross-checked.** The same container was read through
  the cursor-scoped `layer.list` and the slot-scoped `chain.inventory`; they share no
  handle, so their agreement is evidence where one reader agreeing with itself is not.
- ⚠ **`where` is always `chainEnd` for a move to top level.** `chainStart` would
  insert BEFORE the containers and shift them out of slots 0/1, silently invalidating
  every scope. The probe asserts both containers are still at indices 0 and 1 after
  every arm, and that `chain.inventory.trackName` is still the subject.
- **The E16n direction is the CONTROL**, fired through a *different* handler
  (`layer.moveDeviceInto`) before and after the run — both ●, so a ○ on any row would
  have meant the direction and not a dead verb or a dead bridge.

⇒ ⚠ **STILL OWED before this is a recommendation rather than a mechanism:**
modulator routings across a relocation, chain-level state not carried by moving
devices (colour and sends are untested; name/mute/solo/volume/pan are ●), audible
glitch, undo granularity, atomicity if a migration fails halfway, and cost at
realistic N. **Feasibility is not sufficiency** — that was the operator's point.

---
