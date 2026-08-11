---
id: E7
kind: evidence
state: active
source: FINDINGS.md
---

# E7 — Modulators: author-by-template, drive-at-runtime (2026-07-19)

**Verdict: ◐→ author-by-template, drive-at-runtime, via a slot-bank.** Runtime
authoring of modulation is ○ (no create API; map idiom inert even foregrounded;
classic modulation-source API **uncallable**, throws at init). BUT modulation
baked into a template `.bwpreset` **materialises via `insertFile`, routing intact
and live — verified ● (E7b)**, the E4g pattern one level deeper, and the agent
then fully **reads/writes the modulator's own controls** at runtime via its
auto-created remote page (E7d ●) — including gating a route on/off by driving
`Amount` (0.839↔0.000). The two levers that would have given *arbitrary*
flexibility are both closed: **routing-target change** is unreachable in every
runtime state incl. foregrounded (E7f ○), and **modulator-type GUID substitution
fails** (unwired / page-less / "Missing" — E7e/g ○, unlike clean device
substitution E4g). ⇒ the shippable design is a **slot-bank template** (Finding H):
one fat per-device template with dormant pre-wired modulator slots the agent
switches on and tunes. Arbitrary-target routing is a sequenced-later binary
escape hatch. Probes `e07-modulators` / `e07b-modtemplate` / `e07c-modparams` /
`e07d-modtweak` / `e07e-modswap` / `e07f-routing` / `e07g-samefamily`. Resolves
§12 #6, the last ◐. Credit: the template + slot-bank path was opened by the user
pushing back on the initial "never author" ○ — the E4c→E4d single-mechanism
over-generalisation, caught again.

### Finding 0 — the classic ModulationSource API is UNCALLABLE (○, the headline)

The API sweep found `Device.getModulationSource(int)`, `Macro
.getModulationSource()`, `ModulationSource.{isMapped,isMapping,toggleIsMapping}`
and recorded §12 #6 as "partial surface exists." **That surface cannot be
touched from a modern controller extension.** A build that carried
`getModulationSource(i)` handles (created at init, like every other rig view)
**crashed the whole extension on load** with Bitwig's hard-deprecation guard:

> `ghostnote did something wrong — This has been deprecated since API version 2:
> Use remote controls instead`
> `DeviceProxy.getModulationSource → deprecatedFail` (BitwigStudio.log)

This is not a soft `@Deprecated` you can ignore: `deprecatedFail` **throws**,
`init()` aborts, and the bridge never binds. The interface docs corroborate the
redirect — `Macro` is `@Deprecated` ("Macros no longer exist as built in
features… the user can customize pages of controls"), and `ModulationSource`
itself is `@Deprecated`. ⇒ **the rig carries NO getModulationSource/Macro
handles**; doing so is a load-time crash, not a runtime no-op. Everything below
uses the surface Bitwig redirects to: **remote controls**.

⚠ **New gotcha class (worse than a silent no-op):** some API methods are
*fatally* deprecated — calling one at init takes the extension down with a user
popup. `getModulationSource`, `getMacro`, and the whole `ModulationSource`/
`Macro`/`RemoteControl(old)` mapping family are the known members. **Check for
`@Deprecated` on the javadoc interface/method before wiring any handle at
init** — a deprecated method here is a crash, not a warning. (Countermeasure
added to Method notes.)

### Finding A — remote controls are fully readable (●)

`Device.createCursorRemoteControlsPage(n)` + `RemoteControlsPage.getParameter(i)`
→ `RemoteControl` (which **extends `Parameter`**). On a freshly-inserted
Polysynth: **9 pages** (`OSC1, OSC2, MIX, FILTER, FILTER/EG, AMP, Envelope,
Common, Vibrato`), 8 remotes on page 0, each self-describing
(`[0]"Osc1Pitch"=0.500, [1]"Sync1"=0.000, …`). `pageCount`, `pageNames`,
`selectedPageIndex` all read. This is the modern macro/mod surface and it
enumerates cleanly, re-scoping as the cursor repoints (same pool model as E4).

### Finding A2 — the agent can DRIVE a remote control end to end (●)

`RemoteControl.value().setImmediately(v)` (it's a `Parameter`, so E4's
take-over rule applies). Writing remote[0] "Osc1Pitch" → 0.8 moved **both** the
remote (0.800) **and its pre-mapped device parameter `OSC1_PITCH` → 0.800**,
verified by reading the Polysynth param handle. ⇒ **remotes are a live control
surface**: any macro a user or a template has already wired, the agent can
turn. This is the **indirect route to modulation sound-design** — you don't
build the modulation graph, you drive the knobs it exposes.

### Finding B — `Parameter.modulatedValue()` works; the checkpoint lever (●)

`Parameter.modulatedValue()` returns a `RangedValue` (not deprecated) and reads
for every param handle. With no modulation, `value == modulatedValue` exactly
(0 divergence), and `modulatedValue` tracks a base-value write (F1FREQ→0.200,
mv=0.200). ⇒ **this is the checkpoint-fidelity lever for modulation:** a
modulated param reports `value` (the static base we can set/snapshot) separately
from `modulatedValue` (what is actually heard). Revert correctness reads the
base; "what's happening now" reads the modulated value. Pairs with E4's
`hasAutomation()` flag as the two "this param isn't holding a static write"
signals.

### Finding C — the map idiom is inert headless (○)

`RemoteControl.isBeingMapped()` is the modern "enter mapping mode, then touch a
target" idiom. `set(true)` is **accepted without error but does not take**:
`isBeingMappedBefore=false → isBeingMappedAfter=false`. Mapping mode won't even
*latch* from a background controller, let alone complete (completion needs a
real UI parameter touch). **Same focus dependency that made E6 named actions
inert** — creating a route programmatically is out of reach. Recorded, not
fought (per the timebox rule).

### Finding D — modulators cannot be CREATED (○)

No `insertModulator` API and no modulator-specific `InsertionPoint`. Swept
`insertFile(<abs .bwmodulator>)` at **every** device-chain insertion point —
track end-of-chain, `afterDeviceInsertionPoint`, `beforeDeviceInsertionPoint` —
with `LFO.bwmodulator` / `ADSR.bwmodulator`: **inert at all three** (chain
1→1, no change, no error). A `.bwmodulator` is not chain content, and there is
no insertion point that binds to a device's modulator slot. (Multi-mechanism
sweep per the no-false-negatives rule — this ○ is not a single-mechanism miss.)
⚠ **`.bwmodulator` files are binary-compressed** (`BtWg0003…` header, not the
readable TLV that `.bwpreset` uses), so the E3/E4 structured UUID harvest does
not apply to the standalone files.

### Finding D2 — template-borne modulation MATERIALISES (● E7b, verified)

Finding D's ○ is correct but **narrow**: it disproves *runtime* modulator
creation and *bare `.bwmodulator`* insertion. It does **not** disprove
modulation shipped inside a `.bwpreset` — and community tooling said that is
exactly where modulators live:

- **`jaxter184/bwEdit-Python`** — a Python editor for the binary preset/device
  format; its changelog reads *"Added support for modulators,"* and the UI
  shows an **atom graph** where you click a node to start a connection and wire
  it to another atom. ⇒ **modulators + their routing are atoms *inside* the
  `.bwpreset` payload**, not separate insertables. This is the same binary
  substrate E4f–E4g patch by GUID. (Its later *"Fixed FX chain atom (no longer
  crashes Bitwig)"* is the same host-crash warning E4f already flagged —
  malformed structural atoms crash the host, so editing modulator topology at
  the binary level is hazardous.)
- **`zezic/bitwig-device-hacks`** — hand-writes `.bwmodulator` files (Nitro DSP)
  and drops them into the **modulator *library folder***. Confirms modulators
  load as discrete file artifacts **via the library/browser, not a chain
  insertion point** — which is *why* Finding D's `insertFile(.bwmodulator)` was
  inert (wrong destination), not evidence modulators are unreachable.
- **`zezic/bitwig-whitelister`** — patches `bitwig.jar`; adjacent confirmation
  that device/modulator identity is **UUID-keyed** (as E4f/E4g found for
  devices). Not insertion evidence.

⇒ **Confirmed, mirroring E4d overturning E4c.** A user built a minimal template
(a Polysynth with an **LFO wired to Filter Frequency**) and saved it as a
preset — necessarily by hand, since there is **no save API** (E4f). Probe
`e07b-modtemplate` loaded it via `insertFile` and sampled the F1FREQ handle over
~1s:

| sample | base `value` | `modulatedValue` |
|---|---|---|
| 0 | 0.490 | 0.317 |
| 1 | 0.490 | 0.738 |
| 2 | 0.490 | 0.934 |
| 3 | 0.490 | 0.935 |
| 4 | 0.490 | 0.703 |
| 5 | 0.490 | 0.320 |

The base value sat **rock-still at 0.490** while `modulatedValue` swept a full
LFO cycle. ⇒ the modulator **materialised from the preset, its routing survived,
and it is live** — with zero modulation authored by us. The E4f–E4h "shape from
a template" pipeline extends to modulation; it does not stop at it.

**Bonus — this is the checkpoint model working on a real modulated param.** The
static base (0.490) is what a snapshot captures and a revert restores;
`modulatedValue` is what is heard. Finding B's claim is no longer hypothetical:
snapshot `value`, and treat a divergent `modulatedValue` as "this param is under
modulation, its static write is not the whole story."

⚠ **Authoring the routing at the BINARY level is still out of scope.** E7b used
a *whole* user-built preset, unedited. Editing modulator topology inside the
`.bwpreset` (adding/rewiring atoms à la bwEdit-Python) is the same undocumented,
host-crashing binary work E4f ruled out — templates come from a human saving
one, not from atom surgery. Whether per-modulator GUID substitution works like
per-device substitution (E4g) is untested — see the cardinality note in
Finding E.

### Finding E — a loaded modulator is READ+WRITE at runtime (● E7c/E7d)

The follow-up question: once a modulator materialises from a template, can the
agent reach the **modulator's own controls** (the LFO's rate/depth), or only the
modulated target? **Yes — via remote-control pages.** Probes `e07c-modparams`
(discovery) + `e07d-modtweak` (read+write).

- **Discovery (E7c):** the modulator's params do NOT appear in the device's
  DirectParameter tree (bare Polysynth 55 ids → modtest 55, delta 0). Instead,
  **adding a modulator adds a remote-controls PAGE named after it**: the bare
  Polysynth has 9 pages (`OSC1…Vibrato`); modtest has 10 — a new **`LFO`** page.
- **Read (E7d):** selecting the `LFO` page (by `selectedPageIndex`) re-scopes
  the rig's RemoteControl handles to the modulator's own controls:
  **`Rate=0.440, Timebase, Tilt, Curve, Delay, Fade-in, Mode, Amount=1.000`** —
  the LFO's full control set, self-describing.
- **Write (E7d):** `Rate` → 0.85 round-trips (it's a `Parameter`, so
  `setImmediately` applies). And driving **`Amount` → 0 collapsed the F1FREQ
  modulation sweep from 0.839 spread to 0.000** — writing the modulator's own
  control had the exact expected effect on the heard value.

⚠ **`selectNextPageMatching(expr, …)` did NOT land the page** from a string like
`"LFO"` (stayed on page 0, silently — another silent no-op). Selecting by
explicit `selectedPageIndex` after finding the name in `pageNames()` is the
reliable idiom.

⇒ **The SETTINGS axis of any modulator is fully runtime-addressable** through
its auto-created remote page. Load one template, then tweak rate/shape/depth/
amount live — no template-per-setting.

### Cardinality (the "N+1" question) — sized precisely

Given E7b (materialise) + E7d (tweak), the template-explosion concern shrinks to
three axes, only some of which need per-template variants:

| axis | covered at runtime? | cost |
|---|---|---|
| modulator **settings** (rate/shape/depth/amount…) | ● yes (E7d, remote page) | free — one template |
| modulator **type** (LFO↔Random↔ADSR) | ○ no | GUID substitution FAILS (E7e/g); **template variant per type** |
| routing **target** (filter↔pitch↔…) | ○ no (E7f: closed even foregrounded) | template variant, or hazardous atom edit |
| modulator **count** (add another) | ○ no (creation ○) | template variant, or hazardous atom edit |

So runtime driving removes the largest contributor (settings). The remaining
explosion is `type × target × count`, and the two levers that might have collapsed
it were **both probed and both closed** — see Findings F and G. What is left is
the **slot-bank template design** (Finding H).

### Finding F — a runtime routing-target angle does NOT exist (○, exhaustive)

Before accepting that changing a modulator's *target* needs binary work, swept
every remaining live angle (probe `e07f-routing`, + full-recall offline grep):

- **Offline recall** (`member-search-index`, all 25 API versions + `new-list`):
  no route-creating member anywhere — only the dead `ModulationSource` mapping
  family and hardware-binding (`addBinding*`, which maps *hardware controls*, not
  modulation sources). Notably `bitwig.jar` *does* carry internal
  `ModulatorInsertionPoint` / `clipboard/modulator` classes — **Bitwig has the
  concept and does not export it.**
- **Named actions**: `map`→1 (`toggle_mappings_browser_panel`, a panel toggle),
  `learn`→1 (`show_online_learning`, docs), `modulat`/`assign`→0. Nothing that
  creates a route, and E6 already disqualified actions anyway.
- **The mapping gesture headless**: `RemoteControl.isBeingMapped().set(true)` →
  stays `false` (won't latch); `Parameter.touch(true)` + write + release forms
  no route; driving the remote after does not move the target.
- **The mapping gesture FOREGROUNDED** (user brought Bitwig frontmost — the E6
  escape that revived global actions): **still inert.** `isBeingMapped` still
  won't latch; no route forms. This is *stronger* than E6 — foreground did not
  help at all. ⇒ modulation-routing creation is closed in every runtime state.

### Finding G — modulator GUID substitution does NOT work (○, overturns the E4g-analog hope)

The device-identity swap that worked cleanly for *devices* (E4g) **fails for
modulators.** Probes `e07e-modswap` + `e07g-samefamily`, with UUIDs harvested by
diffing two user templates (modtest = Polysynth+LFO; modzoo = Polysynth+Classic
LFO+Random; the exclusive UUIDs are the modulators, confirmed by loading modzoo
and reading its `Classic LFO`/`Random` remote pages). Patched modtest's LFO GUID
(`ad947004`, single binary occurrence, length-preserving) to three targets:

| swapped-in GUID | is | result |
|---|---|---|
| `ca8cc421` (Polysynth built-in Vibrato) | internal | materialises ("Vibrato 2" page) but **route DROPS** — dead even with a note held + Rate/Amount driven |
| `dcacb71b` (Polysynth built-in) | internal | **page-less**, no modulation |
| `39f4b136` (Classic LFO) | external modulator | **"Missing"** — unloadable, though it loads fine in its own preset |

Three targets, three distinct failure modes — never a clean wired type-swap.
**Why it differs from E4g:** a device's identity *is* its GUID, so a swap is
total; a modulator instance additionally carries **type-specific payload +
routing atoms**, and a bare 16-byte GUID swap leaves that payload describing the
old type — so Bitwig loads it unwired (internal type it can reconcile), page-less,
or "Missing" (external type whose payload it can't find). ⇒ **the type axis
cannot be collapsed by substitution; each modulator type needs its own template
(or slot).** (Failures were graceful — unwired / page-less / "Missing", never a
crash — which still supports the substitution-class risk read; it just doesn't
*work* for modulators.)

### Finding H — the slot-bank template design (the practical answer to N+1)

Given F (no runtime routing) + G (no type substitution) + E7d (Amount gates a
route: 0.839↔0.000) + E7b (templates carry live routing), the flexible-but-safe
construction is a **fat template per device with a bank of dormant modulator
slots**:

- Ship one template per device carrying **N×M pre-wired modulators**: for each
  of N curated targets (filter, pitch, amp…) × M types (LFO, Random, ADSR…), a
  real modulator wired to that target with **`Amount = 0`** (dormant, inaudible).
- **Runtime "add an LFO to the filter"** = find the (LFO→filter) slot, set its
  `Amount > 0`, then drive rate/shape live (all proven in E7d). "Remove" = Amount
  back to 0. "Swap LFO for Random on the filter" = Amount-down the LFO slot,
  Amount-up the Random slot.
- This moves the explosion **from template-count to slot-count inside one
  template** — and a device holds many modulators cheaply, so it is tractable.
  One human-authored template per device covers its whole curated modulation
  matrix; no per-combination presets, no binary editing.
- **Residual:** the target set is **curated, not arbitrary** — only the N targets
  pre-wired in the template can be modulated. Reaching an *arbitrary* device
  param as a target still requires binary topology surgery (add a connection
  atom), which stays the **sequenced-later escape hatch** — genuinely hazardous
  (novel structure, the crash-prone end of E4f/bwEdit-Python) and only worth it
  if the curated-target set proves too limiting in practice.

⚠ **On the host-crash risk (re-evaluated):** the danger is not uniform. E4g
proved *length-preserving, structurally-valid substitution* (device GUID swap)
loads cleanly, and G confirms modulator GUID swaps also **fail gracefully, never
crash**. The crashes bwEdit-Python fixed were *structural* atom edits (FX-chain
atoms) — the topology end, which is exactly what arbitrary-target routing would
require. Also note Bitwig's "isolation" improvements are about **plugin**
sandboxing (VST/CLAP in a separate process); a malformed native `.bwpreset` is
parsed by Bitwig's **own** deserialiser, which those improvements do not protect
— so "Bitwig got better at isolation" does not de-risk native-format surgery.
Risk tracks *how far the edit deviates from a valid structure*: value/GUID
substitution ≈ safe (but ineffective for modulators); new topology ≈ crash-prone.

### The modulation capability map (settles §6 device matrix, was ◐/unknown)

| capability | verdict | mechanism |
|---|---|---|
| read a param's post-modulation value | ● | `Parameter.modulatedValue()` |
| read remote-control pages (name/value) | ● | `createCursorRemoteControlsPage` |
| **drive** a wired remote/macro | ● | `RemoteControl.value().setImmediately` |
| read/write a loaded modulator's OWN controls | ● | its auto-created remote page (E7d) |
| read a device's modulators via typed API | ○ | `getModulationSource` deprecated-uncallable |
| create a modulator at RUNTIME | ○ | no API; `insertFile(.bwmodulator)` inert |
| author a modulation routing at RUNTIME | ○ | map idiom inert headless |
| ship modulation in a template `.bwpreset` | ● | materialises live via `insertFile`, routing intact (E7b) |
| vary a templated modulator's settings | ● | remote-page writes (E7d) — no per-setting template |
| gate a templated route on/off at runtime | ● | drive its `Amount` to 0 / up (E7d/H) — the slot-bank lever |
| swap a templated modulator's TYPE by GUID | ○ | fails: unwired / page-less / "Missing" (E7e/g) |
| change a routing TARGET at runtime | ○ | closed even foregrounded (E7f) |
| edit modulation topology (target/count) in binary | ○ | undocumented, host-crashing (E4f); sequenced-later escape hatch |

### Decision impact → DECISIONS

- **Modulation is author-by-template, drive-at-runtime** — the same posture as
  structure (E4d–E4h). The agent cannot add modulators or draw routes at
  runtime, but a template `.bwpreset` a human built once carries the modulators
  AND their routing, materialises live via `insertFile` (E7b ●), and the agent
  then drives it (remotes, `modulatedValue` readback, param writes). Rank
  *runtime authoring* out of scope; rank *modulated templates + driving them* IN
  as a Phase-2 capability. Ship a template library that includes
  modulator-bearing patches, not just device/param shapes.
- **Adopt the slot-bank template design for modulation flexibility (Finding H).**
  Neither runtime routing (F) nor GUID type-substitution (G) works, so the way to
  avoid a template-per-combination explosion is **one fat template per device
  with a bank of dormant (`Amount=0`) modulator slots**, each pre-wired to a
  curated target×type. Runtime selects/deselects by driving `Amount`, then tunes
  rate/shape live. Target set is **curated, not arbitrary**; arbitrary-target
  routing stays a **sequenced-later binary-topology escape hatch** (hazardous,
  the crash-prone end — only if curation proves too limiting).
- **`modulatedValue` is a required checkpoint field, not optional.** E7b proved a
  modulated param's base `value` and heard `modulatedValue` genuinely diverge
  (base pinned at 0.490 while the heard value swept a full LFO cycle). Snapshot
  the base; flag divergence (with `hasAutomation()`, E4) as "static write ≠ what
  is heard."
- **Reinforces the templating posture (E4f–E4h).** As with layer construction,
  the modulation graph is **user/template-authored, agent-driven**: ship
  templates whose modulators are pre-wired to remote controls, and the agent
  drives the remotes. A "make an LFO wobble the filter" tool would be
  undeliverable from the API; "turn the wobble macro this patch exposes" is a
  parameter write.
- **Checkpoint model gains `modulatedValue`.** Snapshot/restore the *base*
  `value`; a divergent `modulatedValue` (or `hasAutomation()`, E4) flags a param
  whose static write won't be what's heard — surface it, don't silently trust
  the base.
- **Escape-hatch tally, with E6:** first named actions (○, hazardous), now
  modulator authoring (○). The typed API is the whole toolbox; where it has no
  primitive, the answer is templates + driving, not a back door.
- **Carry-forward:** the remote-controls apparatus (`createCursorRemoteControlsPage`
  + `RemoteControl` handles, `remote.list`/`remote.set`) and the
  `param.modulatedValue` readback are Phase-1-quality; lift them. The
  `getModulationSource`/`Macro` path is a **do-not-touch** landmine.

---
