---
id: E11d
kind: evidence
state: active
source: FINDINGS.md
---

# E11d-2 — the Sampler "wall" was the loaded SAMPLE, not the device [K] (2026-07-23)

**Verdict: ● a SAMPLE-LESS Sampler is fully modulator-surgery-general — the plain
3-step recipe adds/replaces/deletes AND introduces NEW types AND holds multiple
types, exactly like Delay+/Repro/Polysynth. The entire E11d Sampler exception was
caused by the embedded sample, whose state mirrors the modulator count and blocks
type introduction. This CORRECTS E11d.** The user caught the confound: the E11d
Sampler fixtures had `7 Reso Chime.aiff` loaded; they authored `gn_sampler_no_sample`
(truly bare) which settled it.

### The evidence

The two count-u32 fields (`0x129c`/`0x1422`) are **absent from a sample-less Sampler**
and are **introduced by loading a sample** — a `no_sample→bare` diff shows the sample
adds its ~731 B data structure *plus* the 8-byte block `01 00 00 00 1a 00 00 00 03 00
00 00 00` (the `0x1422` count field). And `bare` (sample, **0** modulators) already
carries `0x19`/`0x1a` there — so those fields belong to the sample's state and merely
*track* modulator count (`base + 0x10·count`).

On `gn_sampler_no_sample` (no count fields exist), the plain recipe loads everything:

| build (plain 3-step recipe) | result |
|---|---|
| + LFO | ● LOAD |
| + **Random (a NEW type)** | ● **LOAD** — the exact op E11d found impossible on the sampled Sampler |
| + LFO + Random (two distinct types) | ● LOAD |

### Corrected model of the Sampler

- **Sample-less Sampler:** general. Plain recipe, any op, any type, multi-type. No
  count field to maintain. Same as every other host tested.
- **Sampled Sampler:** the embedded sample carries modulator-mirroring state, so
  (a) same-type add/delete needs the two count-u32s deltaed by `±0x10` (E11d/E11c),
  and (b) introducing a NEW type is rejected even with the count fix (the sample's
  state has no entry for the new type; surgery can't synthesise it).

### Decision impact (supersedes E11d's)

- **The Sampler is NOT a host-class exception.** `bwmod`'s plain recipe covers
  Polysynth, native FX, CLAP, **and sample-less Sampler**. The host-gating in
  BWMOD_DESIGN should key on **"does this device embed a sample"**, not on device name.
- **Slot-bank on Sampler is fully achievable by surgery — author it sample-less.** The
  agent can add one modulator of every type to a bare Sampler (ns_add_random_newtype +
  ns_two_types prove new-type + multi-type; E11c's 32-scale extends it). The earlier
  "must be human-authored" conclusion for Sampler is **retracted** for the sample-less
  path.
- **Only when a preset must carry BOTH a sample and surgically-authored modulators**
  do the sampled-Sampler constraints apply: maintain the count-u32s for same-type
  add/delete; new-type introduction on an already-sampled preset is ○. Open question
  [U]: whether authoring modulators sample-less and loading the sample afterward
  recombines cleanly (the sample-load would need to regenerate its mirrored count) —
  untested; likely a runtime/UI path, not file surgery.
- **Residual it opened [RESOLVED by E11i-corrected, 2026-07-24]:** the worry that a
  plugin's opaque state chunk (VST3/CLAP) might mirror modulator state *like the sample*
  is **disproven** — Zebra 3 (VST3 **and** CLAP) is fully surgery-general; its DEFLATE-ZIP
  plugin state does not gate the modulator set. The hazard is specifically an **embedded
  sample/bulk blob**, not plugin opaqueness. Convolution IR / wavetable / nested
  containers remain untested but are lower-suspicion now (the "opaque = hazard" heuristic
  was wrong). The original E11i "opaque topology mirror" reading was a test bug (E11h).
- Credit: the user's `gn_sampler_no_sample` minimal pair is what isolated sample-vs-device.

---
