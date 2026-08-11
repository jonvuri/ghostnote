---
id: E4d
kind: evidence
state: active
source: FINDINGS.md
---

# E4d — Chain CREATION: E4c's ○ was WRONG (2026-07-19)

**Verdict: ● complex device structures CAN be built programmatically — via
drum pads and via preset files.** E4c concluded "layers can be filled and
navigated but never created" from a single mechanism. Challenged, swept
properly, and **overturned**. Probe `e04d` (all green) + `e04d-diag`.
**Third false negative of this spike from a single-mechanism check** (after
CLAP params and channelId) — the pattern is now undeniable, see Method.

### Seven routes tested; three work

| # | route | result |
|---|---|---|
| 1 | `DeviceLayer.duplicateObject()` | ✗ silent no-op — ⚠ **still ○** (e17am, exhausted) |
| 2 | `DeviceLayer.duplicate()` (as Channel) | ⚠⚠ **OVERTURNED — see E17 `e17ak`.** `Channel.duplicate()` creates a chain; it needed the chain SELECTED, which `layer.select` does |
| 3 | `InsertionPoint.copyDevices()` into a layer | ⚠⚠ **OVERTURNED — see E18d.** It works, from a top-level source AND a nested one. The move sibling was overturned first (E16n); this is the same false negative |
| 4 | **`InsertionPoint.insertFile(preset)`** | **● 12-pad structure in 268ms** |
| 5 | **`DrumPad.insertionPoint().insertBitwigDevice()`** | **● creates chains** |
| 6 | **`Device.duplicateObject()` on a container** | **● clones WITH contents** |
| 7 | named actions (`getActions()`, 781 of them) | ✗ none create chains |

### ROUTE 5 — drum pads are fully buildable AND addressable

**`DrumPad` has its own `insertionPoint()` that `DeviceLayer` lacks** — that
asymmetry is the whole story. Inserting into an *empty* pad **creates the
chain**: a fresh Drum Machine reports 0 pads, and pads appear as they are
filled (0→1→2, built entirely programmatically, no UI).

Addressing into them works too, with a gotcha:
- **`selectFirstInChannel(drumPadBank.getItemAt(i))` is the right idiom** —
  `DrumPad` is a `Channel`, so the same call used for tracks works. Verified
  on pads 0 and 3: cursor lands on the nested device, **14/16 params resolve**.
- ⚠ **`selectFirstInKeyPad(n)` takes a MIDI KEY, not a pad index.** Key 36
  (C1) = pad 0; passing `0` silently leaves the cursor on the Drum Machine
  (another silent no-op). Verified across keys 0/36/60 in `e04d-diag`.

⇒ **"Build me a drum kit with N chains, each with its own devices and
routing" is fully in reach.**

### ROUTE 4 — insertFile materialises arbitrary structure in one call

`insertFile()` with a `.bwpreset` loaded a 12-pad Drum Machine — a complete
multi-chain structure with all its devices and routing — **in 268ms, one
call**. This is the general escape hatch for *any* complex structure,
including the ones with no creation API: build it once in the UI, save it,
and the agent can materialise it thereafter. Presets are ordinary files, so a
library of them is a shippable asset.

### ROUTE 6 — containers duplicate wholesale

`Device.duplicateObject()` on a populated FX Layer produced a second FX Layer
**carrying its nested contents** (1 layer, 1 device inside). So an existing
structure can be replicated even where it cannot be authored from scratch.

### The residual gap (genuine, but much narrower than E4c claimed)

What remains impossible: **adding a layer to a layer-type container.**
FX Layer ships with exactly one chain and will not grow; Instrument Layer,
Note FX Layer and the Selectors ship with **zero** and cannot be seeded — no
duplicate, copy, or insert route reaches them, and no named action exists.
So a *multi-layer instrument stack* still cannot be authored from nothing.

### Why — the architectural reason (E4e; positive, not just empirical)

Challenged to prove this is a real API gap rather than another missed
surface, five independent lines of evidence converge, and they explain
*why* rather than merely restating the observation:

1. **Primary source — the Bitwig user guide** states the design difference
   outright. Drum Machine: *"Corresponding with the 128 possible MIDI notes,
   Drum Machine offers up to 128 device chains, each called a drum chain."*
   Instrument Layer: *"there is only one Add Device button in the main
   interface of Instrument Layer, with each added device being placed on a
   **newly created** instrument chain."*
   ⇒ **Drum chains are a fixed, pre-addressable grid indexed by MIDI note;
   layer chains have no predetermined slots and come into existence only as
   a side effect of adding a device.**
2. **That is exactly why the API can offer one and not the other.** An
   `InsertionPoint` must bind to a referent. Pad 36 is well-defined while
   empty, so `DrumPad.insertionPoint()` — javadoc: *"InsertionPoint that can
   be used to insert content in this drum pad"* — is meaningful. "Layer 3"
   has no referent until it exists, so there is nothing to hand back.
3. **Version history shows deliberateness, not oversight.**
   `DrumPad.insertionPoint()` was added at **API v7** to a v1 class — a
   targeted addition. Through **v25**, `DeviceLayer` (v1) still has no
   equivalent. Bitwig also added creating-insertion-points where a referent
   exists (`nextSceneInsertionPoint`), so the pattern is consistent.
4. **The javadoc documents our silent no-op as intended behaviour:**
   InsertionPoint inserts *"as if the user had dragged and dropped them to
   this insertion point… **Some things may not make sense to insert in which
   case nothing happens**."* The no-op is specified, not a bug.
5. **Ecosystem corroboration.** DrivenByMoss — the most comprehensive Bitwig
   extension in existence — exposes only read/navigate/select in its
   `LayerImpl`/`LayerBankImpl`; no creation path, no workaround comment.

**Coverage is now exhaustive (E4e).** Every `InsertionPoint` source in the
API has been exercised. The last two, `before`/`afterDeviceInsertionPoint`
anchored on a device *inside* a layer, add to that layer's **own chain**
(1→2→3 devices) and never spawn a sibling layer.

**Honest limit of this evidence:** no Bitwig document or forum post says
"the API cannot create device layers" in so many words. What exists is a
documented architectural reason plus converging structural evidence. This is
a **reasoned negative**, the strongest available — not merely an empirical
one, and no longer a bare "we tried and it didn't work".

**But the use case is not blocked**, because: drum machines cover multi-chain
construction natively (route 5), and any layer structure can be materialised
from a saved preset (route 4) and then duplicated (route 6) and driven at
depth (E4c). The practical Phase-1 posture is **a preset library + drum-pad
construction**, not "structure creation is unavailable".

### Decision impact (supersedes E4c's ○)

- **Chain construction is IN scope.** Rank it as a viable Phase-2 capability,
  not a blocked one. The boring-setup use case is served.
- **Ship a preset library.** `insertFile` turns "complex routing" into a data
  problem; presets are the unit of reusable structure.
- **Drum pads are the native multi-chain primitive** — prefer a Drum Machine
  over an Instrument Layer whenever the agent must *build* N chains. This is
  not a workaround but a consequence of the design: pads are addressable
  slots, layers are not.
- **Layer-type containers are user-authored, agent-driven.** The contract
  should express "work inside the structure you find" for layers, and
  "build the structure" only for drum machines and preset instantiation.
  A tool that promises to construct instrument layers would be undeliverable.
- **Pad addressing = `selectFirstInChannel(pad)`**, never `selectFirstInKeyPad`
  with an index.
- Named actions (781) contain **nothing** for chain creation — one less reason
  to reach for the escape hatch (feeds E6).

---
