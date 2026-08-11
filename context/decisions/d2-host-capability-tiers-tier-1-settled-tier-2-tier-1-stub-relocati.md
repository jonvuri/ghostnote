---
id: D2
kind: decision
state: active
source: DECISIONS.md
---

# D2 — Host capability tiers **[Tier 1 SETTLED; Tier 2 = "Tier 1 + stub relocation", SETTLED by E12]**

Gate on **whether the preset embeds a sample / bulk blob**, NOT on device class, and
**never** on plugin opaqueness. The gate decides only *whether the relocation step
runs* — NOT *whether an op is possible*. Every op is possible on every tier. Always
confirm a new host/preset with a live load test.

- **Tier 1 — fully general** (plain recipe, all ops incl. NEW-type introduction):
  native instruments/FX (Polysynth, Delay+), CLAP plugins (Repro-5), **VST3 + CLAP
  plugins (Zebra 3)**, and a **sample-less Sampler**. A plugin's own opaque state
  (Zebra's DEFLATE-ZIP `plugin-states/…`) does **not** mirror modulator topology —
  swapping a 0-mod blob under a 1-mod stream still loads (E11i-corrected).
  > ⚠ The original E11i "opaque-topology mirror / tier-3" claim was a test bug (the
  > E11h sentinel corruption). There is **no tier-3**; do not reintroduce it.
- **Tier 2 — count-stub relocation** *(SETTLED, E12)*: a preset that **embeds a sample**
  carries sample state with **count-field lists** (field ids `0x129c`, `0x1422`; type
  `0x12`). Each list holds one or more **class-1 reference stubs** — `classId(BE u32)=1`
  then a **BIG-ENDIAN u32 object-index payload** — and ends with the empty class-3
  sentinel `00 00 00 03 00 00 00 00`. Each stub points at an object AFTER the modulator
  list, so an add/delete/replace shifts it by the modulator subtree's **object
  footprint**. **Rule: relocate EVERY class-1 stub in EVERY count list by
  `(inserted − removed) footprint`** (walk items to the sentinel; do not stop after the
  first — multisample has more stubs). Footprint is **donor-specific** (LFO=`0x10`,
  native Sampler Random=`0x0d`, Polysynth Random donor=`0x0b`) — store it per curated
  donor asset. Base is constant across samples (need only deltas).
  > ⚠ **CORRECTS E11d / the earlier Tier-2 text.** There is **no per-type mirrored
  > state** and **no new-type block** — both were test artifacts: E11d only ever swept
  > `±0x10` (but each type has its own footprint; Random is `+0x0b`), and the "count is
  > two LE u32s" read was a single-byte coincidence (payload is BE, and there can be >2
  > stubs). With correct footprint + complete relocation, add (any/NEW type),
  > replace/type-swap, delete, and slot-bank-at-scale all LOAD and are LIVE — on
  > single-sample AND multisample (E12a–E12e). The E7 Finding-H slot-bank is fully
  > surgery-reachable on a sampled preset (no human authoring needed).

---
