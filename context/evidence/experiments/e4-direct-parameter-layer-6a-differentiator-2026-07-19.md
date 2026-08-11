---
id: E4
kind: evidence
state: active
source: FINDINGS.md
---

# E4 — Direct parameter layer (§6a differentiator) (2026-07-19)

**Verdict: ● the differentiating capability WORKS and exceeds the plan.**
`createParameter` gives named, valued, settable, repointable handles far
past the 8-per-remote-page ceiling, and the Bitwig-internal param IDs —
INITIAL_PROMPT's "harder case" needing semi-manual harvesting — turn out
to be **sitting in the app bundle as plain text**. Probe `e04`, all green.

### Enumeration proof (§6a "effective enumeration")

Pre-allocated 16 `SpecificBitwigDevice.createParameter(String id)` handles
on a repointable cursor device. Pointed at a freshly-inserted Polysynth,
14/16 resolved (2 harvested IDs were section markers, not params), each
**self-describing**: name + normalized value + human displayed value, e.g.
`F1FREQ="Filter Frequency"=2.59 kHz`, `F1RESO="Filter Resonance"=39.5 %`,
`OSCMIX="OSC 1/2 Mix"=0.00 %`. This is the WigAI issue-#15 gap closed:
arbitrary count of named params, not capped at 8. Params became live
**~194ms after device insert** (device insert itself ~144ms).

### Param ID harvesting — much easier than assumed (§6a upgrade)

Bitwig-internal device param IDs are readable straight from
`…/Bitwig Studio.app/Contents/Resources/Library/device-settings/<uuid>/
Default.bwpreset` (`strings | grep -E '^[A-Z][A-Z0-9_]{2,}$'`). Polysynth
yielded 63 tokens, ~14/16 sampled were valid createParameter IDs (rest are
section markers: CONTENTS, MODULATORS, FAKE1…). **No `can-copy-device-and-
param-ids` context-menu workflow needed** — the whole internal-device
catalog is harvestable offline from the bundle. Promotes §6a's "one-time
semi-manual harvest, plausibly a community artifact" to "a script over the
app bundle." (Validity still needs a resolve-check per ID against a live
device, since presets include non-param tokens.)

### Read/write + the take-over trap

- **`param.value().setImmediately(v)` works** (0..1 normalized); round-trips
  exactly and the displayed string tracks it (`0.25`→"75.4 Hz",
  `0.8`→"6.08 kHz").
- **⚠ `param.value().set(v)` is SILENTLY SWALLOWED** by the controller's
  take-over strategy (a plain `set` "may not be set immediately if the user
  configured a take over strategy" — value stayed exactly at the preset
  default). ⇒ **all agent param writes must use `setImmediately`, never
  `set`.** This is the param-layer analogue of E2's gain/pressure traps:
  another silent-no-op write path that only readback verification would
  catch. → DECISIONS.

### Repointing — the pre-allocation architecture question, ANSWERED

`createParameter` handles bind to the **cursor device**, not a fixed slot,
and follow it as it repoints:
- **Within a chain:** `selectDevice(bank.getDevice(i))` moved the cursor
  across two Polysynths; the same 16 handles read/wrote each independently
  (device[1] F1FREQ=0.1 vs device[0]=0.8, no cross-talk).
- **Across tracks:** pointing the parent cursor-track at gn-B moved the
  device cursor (FIRST_INSTRUMENT follow) to gn-B's device; handles read it.
- ⇒ **the §3a "pre-allocate a pool, repoint" strategy applies to params
  exactly as it did to clips (E1).** A modest pool of cursor-devices ×
  N param handles covers the session; no per-slot allocation explosion.

### Type specificity + pinning subtleties

- **`SpecificBitwigDevice(uuid)` view is device-type-specific:** pointed at
  a Polymer, all Polysynth param handles report `exists=false`. So a param
  pool must carry a view **per device type** we want deep access to (the
  cursor device itself still enumerates any device's name/position). Per-type
  ID catalogs are the unit of the eventual catalog.
- **Device-cursor `isPinned` is subordinate to its track cursor:** pinning
  the device cursor does NOT hold the device when its parent cursor-track is
  repointed (params jumped to gn-A's device after a track move). **The
  robust hold is: pin the TRACK cursor (E1) + address the device by
  `selectDevice(index)`.** With the track pinned, params stayed on gn-B's
  device (GAIN=0.33) under a selection change. → DECISIONS: device pool
  addressing = pinned track cursor + explicit device index, not device-pin.

### Scope note (superseded by E4b)

- The **typed** specific-device path is VST2/VST3/Bitwig only — no
  `createSpecificClapDevice`. My first reading ("CLAP direct params NOT
  accessible") was **WRONG**: it ruled out one path and missed the
  format-agnostic `DirectParameter` API. See E4b — CLAP params ARE
  accessible. VST index-path (`SpecificPluginDevice.createParameter(int)`)
  still unexercised (needs a known VST id-at-init); deferred.

### Decision impact

- **§6a differentiator confirmed buildable** — named/valued param access at
  arbitrary count, repointable via the pool model, with an offline-harvestable
  internal-device catalog. This is the genuinely novel capability and it holds.
- **Writes: `setImmediately` only** (take-over swallows `set`).
- **Device addressing model:** pinned track cursor + `selectDevice(index)`;
  per-device-type `SpecificBitwigDevice` views; pool of cursor-devices ×
  param handles sized in E5.
- **Param catalog:** promote to a straightforward Phase-1/2 deliverable
  (harvest bundle → resolve-check per device). CLAP excluded; VST via index.

---
