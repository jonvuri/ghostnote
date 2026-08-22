---
title: Phase 4 — Sound design: devices & parameters
kind: plan
state: active
status: Session 4j dogfood is accepted. Save, final proof, and closeout remain.
updated: 2026-08-22
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
2. [4b — exact clip-operation latency](4b-clip-operation-latency.md) — complete.
   The 2,048-step reader closes the half-time gate. Writers stay at 512 steps.
3. [4b follow-up — note completion signals](4b-note-completion-signals.md) —
   complete. E53 classifies scoped note events as a partial wake hint.
4. [4b follow-up — clip mutation settlement](4b-clip-mutation-settlement.md) —
   complete. E54 bounds writer settlement and complete exact reconciliation.
5. [4c — direct-parameter core](4c-direct-parameter-core.md) — complete. E55
   proves safe top-level enumeration, write, independent readback, and replay.
6. [4d — native device catalog](4d-native-device-catalog.md) — complete. E56
   records deterministic bundle generation and live Polysynth and Sampler
   resolution.
7. [4e — VST3 and CLAP parameter proof](4e-plugin-parameter-proof.md) — complete.
   E57 records explicit formats, independent write and readback, and cleanup.
8. [4f — deep parameters and remote controls](4f-deep-parameters-and-remotes.md) —
   complete. E58 proves nested paths, drum-pad channels, remote replay, and
   selection isolation.
9. [4g — managed FX-chain workflow](4g-managed-fx-chain.md) — complete. E59
   records guarded mixed insertion, scalar control, current-position reversal,
   retryable recovery, and cleanup.
10. [4h — device performance gate](4h-device-performance-gate.md) — complete.
   E60 measures full workflows and finds repeated observer work.
11. [4h1 — device observer efficiency](4h1-device-observer-efficiency.md) —
   complete. E61 removes the remote-page loop and stabilizes plugin readback.
12. [4i — device and parameter MCP surface](4i-device-surface.md) — complete.
   E62 records the frozen six-tool cohort and registered MCP proof.
13. [4j — dogfood and closeout](4j-dogfood-and-closeout.md) — dogfood accepted;
    save, the complete live matrix, cleanup, evidence audit, and Phase 5 handoff
    remain.

### Dependency rule

- Session 4b is a measured prerequisite. It changes shared adapter and bridge
  read behavior before the parameter implementation adds another live path.
- E53 permits note events only as an early wake hint. Silent enable fields and
  callback timeout keep bounded polling or the fixed fallback. Exact readback
  remains the proof.
- Session 4c starts after the exact-read gate and both clip-performance
  follow-ups close. Device-specific optimization remains in session 4h.
- Sessions 4d, 4e, and 4f depend on the 4c parameter core. Their catalog,
  plugin, and deep-routing work stays separate.
- Session 4g composes the completed parameter paths into one guarded managed
  workflow. E59 keeps mint provenance separate from current observed position.
- E60 activates session 4h1 before the public freeze. It owns the measured
  remote-page loop and unstable large-plugin completion.
- E61 closes the observer gate. Session 4i can freeze the public cohort against
  the final budgets and exact completion contract.
- Session 4j starts only after the public cohort and performance budgets are
  fixed.

## Scope

### In

1. **The bounded clip-performance track.** E45 and E48 show that exact 32-beat
   clip reads remain slow after safe asynchronous completion shipped. Session 4b
   measures the complete path and replaces repeated per-channel page traffic
   with a bounded bulk read. Two follow-ups then measure scoped note events and
   remove repeated safe mutation settlement. They keep dual-grid, E15-F,
   checkpoint, interference, and exact-read rules.
2. **The two-API parameter layer.** E4b established they are complementary, not
   redundant — carry both, per role:

   | | `createParameter` (typed) | `DirectParameter` |
   |---|---|---|
   | Devices | VST2/VST3/Bitwig | **any, incl. CLAP** |
   | Discovery | IDs/indices known upfront | **self-enumerates all IDs** |
   | Access | pull (`get()`) | push (init-time observers) |
   | Displays | ✅ `"2.59 kHz"` | observer stayed empty; not required |
   | Writes | `setImmediately` | `setDirectParameterValueNormalized(…, 1)` |

   One confirmed cursor-device carries both: direct observers for enumeration
   and CLAP reach, plus typed handles for the devices supported deeply. The first
   route stays serialized until session 4h measures a need for concurrency.
3. **The device & parameter catalog.** E3/E4 turned this from INITIAL_PROMPT's
   "one-time semi-manual harvest, plausibly a community artifact" into *a script over
   the app bundle*: device UUIDs and internal param IDs sit as plain text in
   `…/Bitwig Studio.app/…/Library/device-settings/<uuid>/Default.bwpreset`. Harvest,
   then resolve-check each ID against a live device (presets include non-param tokens
   like `CONTENTS`, `MODULATORS`, `FAKE1` — E10d Finding C explains these are object
   names at a different tree depth, so a structural read could replace the check).
4. **Device chain operations.** Insert by UUID / VST3 ID / CLAP ID / `insertFile`;
   delete; enumerate; enable or bypass; position. E59 composes these operations
   under the prior accepted complete name-and-enabled chain. It keeps minted
   ownership provenance and uses current observed positions for later work.
   Budget **~600ms per device insert** (E3) — the executor's staged pacing
   exists for this.
5. **Deep addressing.** `selectFirstInLayer` repoints a cursor into a nested chain
   and all param handles follow, recursively, verified at depth 2 (E4c). Drum-pad
   addressing via `selectFirstInChannel(pad)`.
6. **Remote controls.** `createCursorRemoteControlsPage` read/write — the runtime
   surface for anything a template exposes, and Phase 5's verification instrument.
7. **`modulatedValue` as a required checkpoint field** (E7, not optional): a
   modulated param's base `value` and its heard value genuinely diverge — E7b watched
   a base pinned at 0.490 while the heard value swept a full LFO cycle. Snapshot the
   base; flag divergence, with `hasAutomation()`, as *"static write ≠ what is heard."*

### Out

- Modulator topology authoring — Phase 5.
- The browser as a primary path. Prefer `insertBitwigDevice(UUID)` and `insertFile`;
  the popup browser is modal and stateful, awkward for a stateless tool surface, and
  stays an exploratory fallback (§6b).
- Grid patch internals. Not reachable by any documented API (§9).
- Growing new layers in a layer container. A reasoned ○, not merely observed
  (E4d/E4e): a drum pad has a referent to insert into, an unborn layer does not.
- A VST3 or CLAP parameter catalog. Installed plugins are machine-specific and
  DirectParameter enumerates their parameters at runtime.
- DirectParameter display-string investigation. Normalized readback is enough
  for the general path. Typed handles and remote pages supply displays where the
  API exposes them.

## Decisions

- **Scaffold implementation.** Resolved by E50. D7's `256/128/8/16/64` holds on
  384 native devices and is the repository default.
- **Catalog scope and shipping form.** Ship a deterministic checked-in native
  catalog with Bitwig-version provenance. Keep VST3 and CLAP out.
- **Per-device-type views.** Polysynth is the first typed deep view. Add another
  only after real use needs its typed-only fields. DirectParameter is the
  general fallback.
- **Checkpoint fidelity.** An inserted device reverts by deleting its current
  observed owned position under the last accepted complete name-and-enabled
  chain. Minted position is ownership provenance, not a durable address. Scalar
  base values and enabled state restore exactly after readback. Deleting an
  existing device remains directed and unrecoverable.
- **Plugin source identity.** Use explicit `vst3` and `clap` variants. The old
  generic `plugin` source is too ambiguous.
- **Display strings.** The DirectParameter display observer is not a Phase 4
  deliverable. It does not affect safe arbitrary parameter control.
- **Performance sequence.** Optimize the repeated exact clip-read bottleneck
  first. Measure device workflows after they exist and before public freeze.

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
5. Exact 32-beat clip reads remove the repeated per-channel bridge loop and cut
   the identical measured baseline by at least half without reduced fidelity.
6. Complete device workflows have measured host, observer, bridge, and
   verification costs before the MCP cohort freezes.

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
- **Performance work can hide a correctness regression.** Keep exact before and
  after fixtures. Never lower a settle budget or skip a channel to meet a target.
