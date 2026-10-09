---
id: D46
kind: decision
state: active
updated: 2026-10-09
source: phase-8i5
---

# D46 — Modulation writers claim the route, not the sound **[SETTLED 2026-10-09]**

The behavior witness proved active modulation by sampling the target's
`modulatedValue`. API 25 gives that value only on a `Parameter` handle: a
remote control (no ID) or a typed handle that the extension creates for one
device type at startup. DirectParameter observers have IDs but no modulated
value. The witness also needs the audio engine and, for an envelope,
sounding notes. On 2026-10-09 it had nothing to observe on a Sampler, so a
correct wrap returned a partial result and the agent sampled by hand (E254).

The silent failures that the witness guarded against came from guessed
route paths (E10 `CONTENTS/GAIN`, E11e). Since E85, Ghostnote derives the
route from the exact DirectParameter ID of a stable inventory and a
structurally proved location.

## Rule

1. **The live product claims the authored route.** In `agent-native-v1`,
   `wrap_existing_device_modulation`, `edit_preset_modulation`, and
   `compose_devices` run no behavior witness and have no behavior input.
   Their structural, scalar-fingerprint, and page checks stay, and so does
   the exact ID and name check of each target in the stable inventory (the
   wrapper before the first write; authoring and composition after the
   insertion, as a recorded post-write failure). Each result
   has `modulation.behaviorWitness: "not-run"` and states that activity is
   not observed. Ghostnote does not attribute existing modulation on a
   target to a new route.
2. **Only proved route forms.** A target ID must have a route form that the
   conformance suite proves live: `CONTENTS/` and one segment (native), or
   `CONTENTS/PID` and a hex number (plug-in), at the top level or inside one
   container entry. Another form refuses before any read or write (code
   `unsupported`, reason `unproved-route-form`).
3. **The suite owns the proof.** `npm run probe:modulation-routes` samples
   ID-bound handles on each admitted form. Run it after a change to the
   route path (route derivation, preset composition, wrapper or composition
   stages) and after each Bitwig upgrade. A failure blocks the change.
4. **Compatibility.** `stable-v1` stays frozen and keeps its witness,
   including the equal-name remote fallback. The fallback is not identity
   proof; it remains only there and in the suite as labelled weak evidence.

## Consequences

- Native modulation work needs no audio engine or playing notes. Plug-in
  work still needs the engine to list parameters (E244).
- The wrapper takes 9.4 s (13.6 s), the preset edit 2.1 s (7.1 s), and a
  composition with 4 modulators 12.4 s (25.3 s) (E254).
- A new route form (deeper module paths, Grid, Polymer) needs a suite case
  before the product admits it. CLAP has no ID-bound witness in the suite.
- A typed Sampler family is not needed for the product. A catalog from
  `Default.bwremotecontrols` could later give an ID mapping for default
  remote pages.
- Result schemas: `ghostnote-device-modulation-wrap/2`,
  `ghostnote-preset-modulation-edit/2`, `ghostnote-device-compose/2`. Tool
  descriptions: `ghostnote-description-v40`.
