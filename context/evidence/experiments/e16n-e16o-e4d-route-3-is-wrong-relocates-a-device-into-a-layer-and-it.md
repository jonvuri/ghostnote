---
id: E16n
kind: evidence
state: active
source: FINDINGS.md
---

# E16n / E16o — ⚠ E4d route 3 is WRONG: `moveDevices` relocates a device into a layer, and it carries its state [K] (2026-07-30)

**Verdict: ● devices CAN be moved into a layer chain, and the moved device keeps
its parameter state. ○ it still cannot CREATE a chain.** E4d recorded
`InsertionPoint.copyDevices()` into a layer as a silent no-op and concluded
devices cannot be relocated into layer chains. ⚠ **That was a single-mechanism
check, and it is the FIFTH false negative of this spike from exactly that
shape** — after CLAP params, `channelId`, chain creation (E4c→E4d) and group
creation (E3→E16j). The sibling verb, never called until now, works.
Probes: `e16n-devmove.ts`, `e16o-movestate.ts`. New wire: `layer.moveDeviceInto`,
`device.moveTo`, `layer.pasteInto`. All silent; nothing launched.

| row | question | result |
|---|---|---|
| **target** | `moveDevices` into a layer chain | ● top level `[FX Layer, Polysynth]` → `[FX Layer]`; layer 0 `[]` → `[Polysynth]` |
| VERB control | `moveDevices` reorders a flat chain | ● `[FX Layer, Polysynth]` → `[Polysynth, FX Layer]`, count stable |
| DEST control | `layer.insertDevice` into the same chain | ● 1 → 2 devices (E4c ●, re-run in situ) |
| **O1** | does the moved device keep its STATE? | ● **`F1FREQ`=0.17 and `F1RESO`=0.83 both survived**, read through the nested cursor |
| **O2** | can `moveDevices` CREATE a chain? | ○ **no** — 0→0 on Instrument Selector, Instrument Layer and Note FX Layer; 1→1 growing an FX Layer |

### The complete-recall pass that found it

Grepped all **1968** members for every relocation-shaped token (`move`,
`relocate`, `reparent`, `transfer`, `reorder`, `copy`, `cut`, `paste`, `drag`,
`drop`, `insert`), then enumerated `InsertionPoint`, `Device`, `DeviceChain`,
`DeviceLayer` and `ChainSelector` in full. **`InsertionPoint` has exactly 14
members**, three of which relocate devices: `copyDevices` (○, E4d),
**`moveDevices`** and **`paste()`**. `relocate`/`reparent`/`reorder`/`drag`/`drop`
return **zero** hits, so no fourth route exists under another name.

⚠ **The javadoc argued AGAINST the reopen.** `moveDevices` and `copyDevices`
carry identical wording — *"If it's not possible to do so then this does
nothing"* — and the class doc specifies the silent no-op as intended. A doc pass
would have closed this ○ a second time. What justified the probe was empirical:
**E4c had measured a new device landing in that same layer chain in ~143 ms**, so
`copyDevices`' no-op was verb-specific rather than destination-specific — and row
A had already seen `copyTracks` ○ alongside three working duplication verbs on
the same object.

### Why the controls are the finding as much as the result

The run takes two independent controls so that **every outcome is
interpretable**, which is what E6 lacked:

| VERB | DEST | target | reading |
|---|---|---|---|
| ● | ● | ● | **what happened** — relocation works, E4d's ○ was verb-specific |
| ● | ● | ○ | layers specifically refuse relocation — E4d stands, on two verbs |
| ○ | ● | ○ | ⚠ inconclusive about layers; the verb is dead everywhere |

⚠ **The moved device is a Polysynth on purpose**: E4c proved a Polysynth can be
*inserted* into an FX Layer chain, so a refusal could not have been explained
away as "that type does not belong there". The only difference between the DEST
control and the target is the verb.

### ⚠ The method trap this sitting produced, and it nearly wrote a false finding

**`rig.layerBank0` follows `cursorDevice0`, and that binds the WRITE as well as
the read.** `layer.moveDeviceInto` reaches its destination through that bank, so
the container must be the selected device when it is called.

`e16o`'s first run marked the Polysynth's parameters — which selects the
Polysynth — and then moved. The destination resolved
`layerBank0.getItemAt(0)` against a Polysynth, which has no layers, so the
insertion point had no referent and did nothing. The transcript read
`layer 0 now holds [—]`: **byte-identical to a genuine API refusal.** The run
reported `O1: a relocated device DOES NOT KEEP its state`, which is not merely
wrong but wrong in the specific way that would have killed the capability — the
device had never moved at all.

⚠ It was caught only because the probe asserts a *precondition* ("the device did
relocate") separately from the *question* ("did its state survive"). **A probe
that tested only its headline question would have published the false negative.**
The fix is a `moveInto` helper that re-selects the container and asserts
`hasLayers` before every move. Generalisable: **any handler reaching a
cursor-following bank has the cursor as a hidden argument**, and aiming it wrongly
produces a silent no-op rather than an error.

### What this changes, and what it deliberately does not

⚠ **E4d's residual gap STANDS** — now against a fourth verb, and E4e's
architectural reasoning (*"an InsertionPoint must bind to a referent, and 'layer
3' has no referent until it exists"*) survives its sharpest test. Layer-type
containers still cannot grow chains: 0-chain containers cannot be seeded, and an
FX Layer will not go to two.

⇒ **So multi-chain structure still comes from a `.bwpreset`** (E4d route 4,
268 ms), and the preset-library posture is unchanged.

**What IS new is the half a preset could never supply.** Before today, a chain
could only be filled with a *freshly inserted* device. Now the human's **own
device, carrying its own state**, can be moved into one (O1). That was the actual
blocker for auditioning an existing patch: you could always build a two-chain
selector from an asset, and you could never get the user's Zebra into it.

⚠ **E4d's decision-impact line needs amending.** It says *"the contract should
express 'work inside the structure you find' for layers"*. That is now too
narrow: you may **also relocate existing devices into the structure you find**,
losslessly. Creation remains preset-only.

**Still owed before the chain-selector A/B is real** (E16 §3.4e): whether
switching chains glitches, its latency, and whether it cuts sends. This row makes
that measurement worth taking; it does not pre-answer it.

---
