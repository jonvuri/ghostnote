---
title: Phase 4 — Sound design: devices & parameters
kind: plan
state: active
status: Session 4a is complete. E50 confirms the scaffold baseline. Plan the
        parameter surface next.
updated: 2026-08-21
parent: ../ROADMAP.md
prev: ../phase-3/README.md
next: ../phase-5/README.md
---

# Phase 4 — Sound design: devices & parameters

> **Purpose.** INITIAL_PROMPT §6a's differentiator, built. Named, valued, settable
> access to **any** parameter on native, VST and CLAP devices — far past the
> 8-per-remote-page ceiling that caps every other agent-facing Bitwig tool — plus the
> device-chain operations to put those devices there in the first place.

## Why this is here

§6a is the capability no known prior art has implemented; it is an open feature
request against WigAI (issue #15) precisely because remote pages cap agents at 8
params while most devices have 50–300. E4/E4b confirmed it works and **exceeds the
plan**: `createParameter` handles bind to a repointable *cursor* device rather than a
fixed slot, so the pool-and-repoint strategy applies to params exactly as it did to
clips — no per-slot allocation explosion.

It lands after the musical phases because it is the second-most-useful capability,
not the first, and because Phase 5 depends on it: **a modulator edit is verified by
remote-page readback**, so the param layer is Phase 5's test instrument.

## Execution order

1. [4a — device-side scale and scaffold baseline](4a-device-side-scale.md) —
   complete. E50 closes the E5 caveat and confirms D7.

Plan the parameter surface from the confirmed scaffold. Do not add per-device
views before the general direct-parameter and typed-handle roles are explicit.

## Scope

### In

1. **The two-API parameter layer.** E4b established they are complementary, not
   redundant — carry both, per role:

   | | `createParameter` (typed) | `DirectParameter` |
   |---|---|---|
   | Devices | VST2/VST3/Bitwig | **any, incl. CLAP** |
   | Discovery | IDs/indices known upfront | **self-enumerates all IDs** |
   | Access | pull (`get()`) | push (init-time observers) |
   | Displays | ✅ `"2.59 kHz"` | ◐ never populated (open question) |
   | Writes | `setImmediately` | `setDirectParameterValueNormalized(…, 1)` |

   A pool cursor-device carries both: direct observers for enumeration and CLAP
   reach, typed handles for the devices we support deeply.
2. **The device & parameter catalog.** E3/E4 turned this from INITIAL_PROMPT's
   "one-time semi-manual harvest, plausibly a community artifact" into *a script over
   the app bundle*: device UUIDs and internal param IDs sit as plain text in
   `…/Bitwig Studio.app/…/Library/device-settings/<uuid>/Default.bwpreset`. Harvest,
   then resolve-check each ID against a live device (presets include non-param tokens
   like `CONTENTS`, `MODULATORS`, `FAKE1` — E10d Finding C explains these are object
   names at a different tree depth, so a structural read could replace the check).
3. **Device chain operations.** Insert by UUID / VST3 ID / CLAP ID / `insertFile`;
   delete; enumerate; bypass; position. Budget **~600ms per device insert** (E3) —
   the executor's staged pacing exists for this.
4. **Deep addressing.** `selectFirstInLayer` repoints a cursor into a nested chain
   and all param handles follow, recursively, verified at depth 2 (E4c). Drum-pad
   addressing via `selectFirstInChannel(pad)`.
5. **Remote controls.** `createCursorRemoteControlsPage` read/write — the runtime
   surface for anything a template exposes, and Phase 5's verification instrument.
6. **`modulatedValue` as a required checkpoint field** (E7, not optional): a
   modulated param's base `value` and its heard value genuinely diverge — E7b watched
   a base pinned at 0.490 while the heard value swept a full LFO cycle. Snapshot the
   base; flag divergence, with `hasAutomation()`, as *"static write ≠ what is heard."*
7. **`createLastClickedParameter`** (API 20) as a human addressing affordance — the
   user clicks a knob in Bitwig and says "modulate this", sidestepping param
   discovery entirely for the most common case. ◐ unprobed.

### Out

- Modulator topology authoring — Phase 5.
- The browser as a primary path. Prefer `insertBitwigDevice(UUID)` and `insertFile`;
  the popup browser is modal and stateful, awkward for a stateless tool surface, and
  stays an exploratory fallback (§6b).
- Grid patch internals. Not reachable by any documented API (§9).
- Growing new layers in a layer container. A reasoned ○, not merely observed
  (E4d/E4e): a drum pad has a referent to insert into, an unborn layer does not.

## Decisions this phase must make

- **Scaffold implementation.** Resolved by E50. D7's `256/128/8/16/64` holds on
  384 native devices and is the repository default.
- **Catalog scope and shipping form.** Native devices only, or VST/CLAP index scans
  too? In-repo asset or generated on first run? This is the "personal but releasable"
  decision in miniature — the catalog is the most plausibly publishable artifact
  besides `bwmod`.
- **Per-device-type views.** `SpecificBitwigDevice(uuid)` is type-specific — pointed
  at a Polymer, Polysynth handles all report `exists=false` (E4). So the pool carries
  a view per device type we support deeply. Decide how many, and what the fallback is
  for everything else (DirectParameter enumeration, which reaches anything).
- **Checkpoint fidelity for device inserts.** Scalar params are exact; insert/delete
  is low. Decide what a take promises for a chain change before building it.
- **Whether to chase the display-string gap** — `addDirectParameterValueDisplayObserver`
  never populated, hypothesis is parameter-page scoping (E4b). Only matters if CLAP
  display strings are wanted.

## Exit criteria

1. Enumerate, name, read and write **arbitrary parameters** on a native device, a
   VST3 and a CLAP — well past 8 — with values verified by readback.
2. Build an FX chain of multiple plugins with per-parameter control, checkpointed and
   revertible (§6b's first scoping question, answered in code).
3. The catalog resolves for the native devices you actually use, with a resolve-check
   proving each ID is a real parameter.
4. Device-side scale is **measured**, closing E5's stated caveat: its populated
   project was synthetic — empty tracks, no chains — while `DEVICE_BANK` observers
   stream per chain.

## Risks

- **Silent-no-op writes are the dominant failure mode here**, and the traps are
  device-specific: `set` swallowed by the take-over strategy (use `setImmediately`),
  DirectParameter needing `resolution=1`, and plugins that reject host writes
  entirely for their own reasons (Stochas did — plugin-specific, not an API limit).
  Mitigation: readback is structural, and a write that does not take must be
  *reported*, per §8c.
- **Device-side scale is measured.** E50 found sequential cursor-sweep cost but
  no warm-up or control-thread latency trend through 384 native devices.
- **The catalog rots** across Bitwig versions. Mitigation: it is generated from the
  installed bundle, so regeneration is a script run, not a re-harvest.
- **Per-type views multiply.** Resist supporting every device deeply; DirectParameter
  enumeration is the general fallback and it reaches everything.
