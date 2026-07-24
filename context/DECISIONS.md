---
title: ghostnote — Decisions (evidence-backed)
status: IN PROGRESS — modulator-authoring decisions settled (E10/E11); the remaining
        spike-wide decisions (addressing, scaffold sizes, checkpoint, grid, batch,
        toolchain, transport, escape-hatch) are to be consolidated here at spike close;
        their evidence already lives in FINDINGS (E0–E9).
updated: 2026-07-24
evidence: context/spike/FINDINGS.md (E-numbers), BWFORMAT_SPEC.md, BWMOD_DESIGN.md
---

# ghostnote — DECISIONS

> Each decision cites the FINDINGS experiment(s) that settled it. This file currently
> captures the **modulator-authoring** decisions (the E10/E11 arc, the spike's
> differentiator). Sections marked *PROVISIONAL* are settled enough to build on but
> flagged for the noted follow-up.

---

## D1 — Modulator topology is authored by template-time `.bwpreset` file surgery **[SETTLED]**

The agent constructs modulator topology (add / replace / retarget / delete, any
type, any category) by **byte-editing a `.bwpreset` template** and loading it via
`device.insertFile`; runtime then *drives* what exists (remote-control pages,
amount→0 to disable). There is **no runtime modulator create/route API** (E7 ○).

- **Files are the unit; templates ship as build-time assets** — `insertFile` takes any
  absolute path, the Library is not involved, and the file can be deleted after load
  with no effect (E4h). ⚠ absolute paths only; `.bwpreset` extension required.
- **Format is readable** — `.bwpreset` is encoding `0002` (plain TLV); modulator
  *instances* live in the plain object stream, not the opaque `0004` DSP blobs
  (E10-FindingA). The `.bwdevice`/`.bwmodulator` `0004` files are a dead end.
- **Durable + first-class** — a surgically-authored modulator survives project **save
  → Bitwig restart → reopen**; Bitwig re-serialises it on save and re-parses it cleanly
  (E11g). Not a load-time illusion.
- **Verified end-to-end**: shape from a template → identity by GUID substitution (E4f/
  E4g) → params via the API. "Boring setup" is solved by a curated template library.

**Retires** the E7 Finding-H *slot-bank* as the **default** authoring model (it remains
the right shape only for the Tier-2 case, D2). Recorded per handoff exit criteria.

### The recipe & load invariants (the correctness spec for `bwmod`)
1. **Object bounds MUST snap to the list SENTINEL** — the `0x1a46` modulator list ends
   with an empty `cls 0x0003` sentinel `00 00 00 03 00 00 00 00` (NOT a bare classId 0).
   A diff/insert-derived bound can land 2 bytes into the sentinel and corrupt it →
   whole-preset reject; the error is **alignment-dependent** (it manufactured the false
   "Zebra wall"). End objects at, and insert before, the sentinel. **[E11h — the key
   discovery of this session]**
2. **`0x1a1b` instance id unique** across modulators — the one proven load gate (E10f).
   Need not be contiguous/zero-based (E11a); the `0x02b9` name is cosmetic (E11b);
   same-type duplicates (shared `0x18c6` type-guid, duplicate meta ref) are fine (E11f).
   No embedded-id "freshening" beyond the unique `0x1a1b`.
3. **Meta `referenced_modulator_ids`** = the ordered set of modulator `0x18c6` GUIDs;
   count correct (E10c/E10f). Patch header **`f4`** by the meta byte-delta.
4. **`f6`** (when present) = absolute offset of an embedded DEFLATE-ZIP plugin-state
   blob; re-point it (locate `PK\x03\x04`) after any stream-size change (E11i).
5. **Every edit MUST be verified by live load + remote-page readback** — a bad Ramona
   route path is a *silent* no-op (loads, no modulation, E10b); `validate()` is
   necessary but not sufficient.

### Routing
- Retarget = rewrite the `0x0e3d` Ramona path (any length; stream-only, no meta/f4)
  (E10/E10b). Proven load-safe on every host including plugins.
- **Cross-device routing** works from a **container** modulator (Chain / Instrument-
  or FX-Layer) into a nested device, and is synthesizable + live (E11e). Path form:
  `CONTENTS/DEVICE_CHAIN/<Container>/DEVICE_CHAIN/<idx>:CONTENTS/<PARAM>`. Simple
  (non-container) devices cannot cross-route. Target set is **arbitrary within the
  container**, via the ordinary retarget primitive (no new op).

---

## D2 — Host capability tiers **[Tier 1 SETTLED; Tier 2 = "Tier 1 + stub relocation", SETTLED by E12]**

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

## D3 — `bwmod` library shape **[SETTLED and BUILT 2026-07-24 — `brain/src/bwmod/`]**

TypeScript, brain-side, buffer-in/buffer-out immutable; Python `tools/bwformat/*.py`
stays as the reference oracle. Editors: `retarget`, `setAmount`, `replaceModulator`,
`addModulator`, `deleteModulator`; a `validate()` that checks D1's invariants (sentinel
integrity first — the top cause of silent reject) before paying an `insertFile`. Golden
test: reconstructing `mp_one_lfo` from `mp_bare` is byte-identical to the real file
(E10f); the sampled analogue reconstructs `gn_sampler_one_lfo`/`one_random` from
`gn_sampler_bare` byte-identical modulo name + per-save GUIDs and loads live (E12c).
Full details + test matrix in BWMOD_DESIGN.md (updated with the sentinel rule and the
Tier-2 **stub-relocation** handling — every class-1 stub in every count list, BE payloads,
`(inserted−removed) footprint`; port source `tools/bwformat/build_e12d2_cases.py`).
2026-07-24 sync: the TS-port-with-Python-oracle choice is now CALLED in the design doc;
the `f6` re-point rule (D1 invariant 4) is folded into its editor invariants, `validate()`,
and test matrix (U-f6); `DonorObject` carries per-donor `footprint` as curated metadata.

**BUILT 2026-07-24 (E13).** `brain/src/bwmod/` ships all five editors, `validate()`, the
readers, and a curated donor library (`brain/assets/modulators/`, footprint + provenance
per donor). `cd brain && npm test` runs 42 offline tests — including four byte-identical
golden reconstructions and a byte-for-byte cross-check against `tools/bwformat` — and
`npx tsx src/probes/e13-bwmod.ts` runs 12 live cases against Bitwig 6.0.6, each verified by
remote-page readback, with I-dup-neg confirming the reject guard. The Python stays as the
reference + oracle; the product has no Python dependency. Fixtures are vendored under
`brain/fixtures/` so the offline half runs in CI. Three build-time refinements are worth
carrying (details in BWMOD_DESIGN §8, evidence in FINDINGS E13):
- a **container preset holds one `0x1a46` list per nested device**, so the editors refuse
  to act without an explicit `listIndex` rather than silently rewriting the wrong device;
- the **removed** side of the Tier-2 footprint delta needs an explicit `removedFootprint`
  unless the resident object matches a curated donor byte-for-byte — GUID equality is not
  enough, since footprint belongs to the object, not the type;
- **unmeasured footprints ship as `null`** and are refused on a sampled preset, never
  guessed (a wrong delta is a silent whole-preset reject).

### Carry-forward

**Modulator authoring is a template-time file-surgery capability with a single load
invariant — a unique `0x1a1b` per modulator — and it is verified by readback, not by
inspection.** `validate()` is the cheap offline gate that predicts a LOAD; only a live
load plus a remote-page readback proves the modulation is actually live (a wrong Ramona
path passes every offline check and does nothing, E10b). Workstream B builds on
`bwmod` + a curated template/donor library; it does not need any further format work.

---

## Sampler (Tier-2) scrutiny — RESOLVED by E12 (2026-07-24)

The Tier-2 residual is closed: **the "new-type wall" was never real** (see D2 and
FINDINGS E12). The five open questions are now answered:

1. **Count-field completeness / multisample — ANSWERED.** The count fields are `0x12`
   **lists** of class-1 object-reference stubs, sentinel-terminated; a multisample has
   MORE stubs (measured 4 vs 2). Rule: relocate EVERY stub in EVERY list. Verified live
   on `gn_sampler_multi_*` (E12d).
2. **Base constant — ANSWERED (yes).** `gn_sampler2_*` (different sample) has the same
   base and behaves identically; `bwmod` needs only deltas (E12d).
3. **New-type block — ANSWERED: it does not exist.** It was a wrong-delta artifact
   (E11d swept only `±0x10`; each donor has its own footprint, Random=`+0x0b`). New-type
   add, type-swap, and ≥2-type slot-bank surgery at scale all LOAD live (E12a/E12c/E12e).
4. **Sample-load recombination — ANSWERED (E12f).** Authored LFO+Random on a
   sample-LESS Sampler, dragged a sample in the UI, saved → Bitwig kept both modulators
   AND materialised the count stubs at **exactly** our predicted values (base + LFO 0x10
   + Random 0x0d = 0x36/0x37); the result reloads live. ⇒ the "author sample-less, then
   add the sample in the UI" workflow yields a consistent preset carrying BOTH — and
   Bitwig computes the stubs with the same footprints we reverse-engineered (independent
   validation of the model).
5. **Other embedded-bulk devices** (convolution IR, wavetable/Grid, nested containers)
   — same stub-relocation pattern expected; lower priority, still untested. The heuristic
   is now "find & relocate the reference stubs", not "give up".

- **Do NOT re-suspect plugin opaque state** (VST3/CLAP) — settled Tier-1 (E11i-corrected).

---

## Consolidate at spike close (evidence already in FINDINGS)

Per SPIKE_PLAN §5, DECISIONS must also record: addressing model & cursor-pool sizes
(E1/E2f/E5), pre-allocation scaffold sizes (E5/HANDOFF-E5), checkpoint fidelity table
(E2/E3), grid/units mapping (E2), batch execution mechanics (E8), toolchain versions
(E0), transport + protocol frame (E0/E9), escape-hatch policy (E6 ○). These are settled
in FINDINGS but not yet transcribed here — do so when writing PROJECT_PLAN.md.
