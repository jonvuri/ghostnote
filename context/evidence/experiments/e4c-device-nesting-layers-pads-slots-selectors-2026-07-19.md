---
id: E4c
kind: evidence
state: active
source: FINDINGS.md
---

# E4c — Device nesting: layers, pads, slots, selectors (2026-07-19)

> **⚠ AMENDED BY E4d:** this section's "nesting structure cannot be CREATED"
> conclusion is **WRONG** — it tested one mechanism. Drum pads, `insertFile`
> and container duplication all create structure. The claim that survives is
> narrower: *layer-type containers* cannot grow new layers. Read with E4d.
> The Drum Machine claim below is also wrong — see the correction there.

**Verdict: ◐ nested devices can be NAVIGATED and DRIVEN perfectly; creation
is possible by routes this experiment did not test (see E4d).**
Probes `e04c` (all green) + `e04c-diag` / `e04c-diag2` (the controlled trials
that corrected the first run's expectations).

### Four mechanisms, not one

The plan said "device layers". The API actually has four distinct nesting
surfaces, and a device advertises which it offers:

| device | hasLayers | layers shipped | hasDrumPads | slotNames |
|---|---|---|---|---|
| Polysynth (flat) | false | 0 | false | FX, Note FX |
| **FX Layer** | true | **1** | false | — |
| Note FX Layer | true | **0** | false | — |
| Instrument Layer | true | **0** | false | FX |
| Instrument Selector | true | 0 (+ChainSelector, chainCount=1) | false | FX |

### The headline: E4's param apparatus works at depth, unchanged

`CursorDevice.selectFirstInLayer(0)` moves **the same device cursor** into the
nested chain, and every E4 handle follows it down:

- cursor `"FX Layer"` → `selectFirstInLayer(0)` → cursor `"Polysynth"`,
  **14/16 param handles resolve**, self-describing exactly as at top level
  (`F1FREQ="Filter Frequency"=2.59 kHz`).
- **Writes land at depth**: `F1FREQ` → 0.200, displayed "50.6 Hz".
- `isNested()` correctly flips true for the nested device.
- **Nesting is real**: the top-level chain still reports only the container.
- **The model is RECURSIVE** — FX Layer inside FX Layer, descend twice, and
  params still resolve 14/16 at depth 2. The layer bank **re-scopes to
  whatever the cursor points at**, so one pre-allocated bank serves every
  depth. ⇒ **deep device addressing needs no new machinery** — E4's pool +
  repoint model extends downward for free.
- Insert into a layer via `DeviceLayer.endOfDeviceChainInsertionPoint()`
  (DeviceLayer *is* a DeviceChain), ~143ms — same budget as a top-level
  insert. A layer **renames itself after its content** ("Layer 1" →
  "Polysynth"), so layer names are not stable identifiers.

### The gap: layers cannot be created (○)

There is **no create-layer API**. `Device` offers `createLayerBank` /
`createCursorLayer` — *views*, not constructors. Consequences, all confirmed
by controlled trial (`e04c-diag2`):

- **FX Layer ships with exactly one chain.** Inserting at layerIndex 1 or 2
  **silently no-ops** — no error, no new layer, count stays 1.
- **Note FX Layer / Instrument Layer / Instrument Selector ship with ZERO
  chains**, so they cannot be populated programmatically *at all*. The
  container inserts fine and reports `hasLayers=true`, and every insert into
  it vanishes silently.
- ⇒ **`hasLayers=true` does NOT imply a layer exists.** Check the layer
  bank's count, never the capability flag.
- ⇒ Programmatic multi-layer construction (build an Instrument Layer with 3
  layered synths) is **out of reach**; only single-chain FX Layer is
  drivable. Deep work is limited to structures the *user* built.

### Silent no-op traps (the E2 family, now three members)

Both new traps are invisible without readback — same shape as E2's empty-slot
clip trap and E4's swallowed `set()`:

- **Inserting into a non-existent layer index** — no error, nothing happens.
- **`selectFirstInSlot("FX")` on an EMPTY slot** leaves the cursor exactly
  where it was (`exists=true`, same name, `isNested=false`), looking healthy.
- ⇒ reinforces the standing rule: **verify the cursor's target before every
  write**; a mis-descend is undetectable from the cursor's own state.

### Not verified: drum pads — ⚠ AND THE STATED REASON WAS FALSE

E4c recorded that **"Drum Machine has no `Default.bwpreset` in the app
bundle"** and concluded the offline catalog harvest was incomplete. **Both
claims are wrong.** Drum Machine is present:
`8ea97e45-0255-40fd-bc7e-94419741e9d1`, and it loads.

**Root cause of the miss — a genuinely nasty search trap.** Preset files
store names as `<length-byte><name>`. macOS `strings` strips the length byte
only when it is non-printable; `0x0C` (form feed) survives. So a device whose
name is **exactly 12 characters** emits `\fDrum Machine`, and an anchored
grep for `^Drum Machine$` silently fails. Exactly **7 of 151** devices are
affected — every one with a 12-character name:

> Drum Machine · Freq Shifter · HW Clock Out · Note Repeats · Oscilloscope ·
> Peak Limiter · Stereo Split

(The tell was visible and ignored: "Stereo Split" sorted out of alphabetical
order in the container dump, because of its invisible prefix.)

**Correct harvest method:** extract the structured field —
`strings f | grep -A1 '^device_name$' | sed -n 2p | tr -d '\f'` — never grep
for an anchored name. The catalog **is** complete (151 devices with presets);
E3/E4's claim stands and the "hole" recorded here did not exist.

Drum pad *behaviour* is now verified in **E4d** (pads are creatable and
addressable).

### Decision impact

- **Phase 2 ranking:** deep device work (drum pads, layered synths) is
  **read/drive-capable but not build-capable**. Sound-design *into* existing
  user-built layers is viable and cheap; "construct me a layered patch" is
  not. Rank direct-param sound design above structural device building.
- **Param model:** unchanged and validated at depth — one cursor-device pool
  covers arbitrary nesting. No per-depth allocation.
- **Addressing:** layer *names* are content-derived and unstable; address
  layers by index within the cursor's current scope, and re-verify after any
  descend. (No layer equivalent of `channelId` was found — worth the same
  stable-id question in Phase 1 that E2f settled for tracks.)
- **Catalog (§6a):** the bundle harvest is incomplete; the catalog builder
  needs a fallback for devices with no preset (browser enumeration, E6).

---
