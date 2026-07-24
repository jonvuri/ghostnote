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

## D2 — Host capability tiers **[Tier 1 SETTLED; Tier 2 PROVISIONAL — Sampler under scrutiny]**

Gate on **whether the preset embeds a sample / bulk blob**, NOT on device class, and
**never** on plugin opaqueness. Always confirm a new host/preset with a live load test.

- **Tier 1 — fully general** (plain recipe, all ops incl. NEW-type introduction):
  native instruments/FX (Polysynth, Delay+), CLAP plugins (Repro-5), **VST3 + CLAP
  plugins (Zebra 3)**, and a **sample-less Sampler**. A plugin's own opaque state
  (Zebra's DEFLATE-ZIP `plugin-states/…`) does **not** mirror modulator topology —
  swapping a 0-mod blob under a 1-mod stream still loads (E11i-corrected).
  > ⚠ The original E11i "opaque-topology mirror / tier-3" claim was a test bug (the
  > E11h sentinel corruption). There is **no tier-3**; do not reintroduce it.
- **Tier 2 — count-mirrored** *(PROVISIONAL)*: a preset that **embeds a sample** mirrors
  the modulator count in two **little-endian** u32s (`0x129c` base `0x19`, `0x1422` base
  `0x1a`; value = base + `0x10`·count; sigs `00 00 12 9c 12 00 00 00 01 00 00 00` /
  `00 00 14 22 12 …`). Same-type add/delete work **iff** both u32s are deltaed by
  `±0x10`·n; **new-type introduction / type-swap is genuinely blocked** even with the
  count fix and sentinel-correct bounds (the sample's per-type state can't be
  synthesised) — re-confirmed in the E11d RE-CHECK. For a Tier-2 slot-bank the *type set*
  is fixed at author time (the E7 Finding-H shape is correct here), but same-type
  duplicate / retune / delete are surgery-reachable within it.

---

## D3 — `bwmod` library shape (feeds Workstream B, not yet built) **[SETTLED — see BWMOD_DESIGN.md]**

TypeScript, brain-side, buffer-in/buffer-out immutable; Python `tools/bwformat/*.py`
stays as the reference oracle. Editors: `retarget`, `setAmount`, `replaceModulator`,
`addModulator`, `deleteModulator`; a `validate()` that checks D1's invariants (sentinel
integrity first — the top cause of silent reject) before paying an `insertFile`. Golden
test: reconstructing `mp_one_lfo` from `mp_bare` is byte-identical to the real file
(E10f). Full details + test matrix in BWMOD_DESIGN.md (updated this session with the
sentinel rule and the Tier-2 count-u32 handling).

---

## Open for a FRESH SESSION — scrutinize the Sampler (Tier-2) more

The Tier-2 conclusion is solid on the fixtures tested but the user wants deeper
scrutiny before `bwmod` depends on it. Carry-forward context:

- **Use sentinel-correct bounds + the count-u32 handler.** The port source is
  `tools/bwformat/build_e11d_recheck.py` (sentinel-correct extractor + `bump_count`).
  The earlier E11d/E11d-2/E11c Sampler builds used the *buggy* extractor; re-derive with
  the fixed one. Fixtures: `Sampler/gn_sampler_{bare,one_lfo,no_sample}`.
- **Open questions to settle:**
  1. **Count-u32 completeness / multisample.** Only two count u32s were seen, on a
     single-sample preset. A Sampler with **multiple samples / zones / a multisample**
     may mirror MORE state (or more count fields). Untested — build a multi-zone fixture
     and re-run add/delete. (E11d flagged this; E11c only scaled *duplicate* counts.)
  2. **Is the base constant?** `0x19`/`0x1a` bases were stable across the tested pair;
     confirm the **delta (`±0x10`) approach** holds across *different* sampled presets
     (so `bwmod` never needs the absolute base).
  3. **New-type block — mechanism & boundary.** Confirmed real, but is it strictly
     per-*type* (i.e. can you duplicate/retune/delete any type the template already
     contains, at scale)? Verify a template with ≥2 types, then surgery within it. Is
     there *any* surgical route to introduce a new type (e.g. co-patching the sample
     state)? Expected ○, but record.
  4. **Sample-load recombination [U] (deferred, §4.4).** Author modulators on a
     sample-LESS Sampler, then load a sample in the UI — does the sample-load regenerate
     the mirrored count so the result is consistent? Only matters for a preset that must
     carry BOTH a sample and surgical modulators. Likely a runtime/UI path, not surgery.
  5. **Other embedded-bulk devices** (convolution IR, wavetable/Grid, nested containers)
     — same "embeds a bulk blob" risk pattern; lower priority, still untested.
- **Do NOT re-suspect plugin opaque state** (VST3/CLAP) — settled Tier-1 (E11i-corrected).

---

## Consolidate at spike close (evidence already in FINDINGS)

Per SPIKE_PLAN §5, DECISIONS must also record: addressing model & cursor-pool sizes
(E1/E2f/E5), pre-allocation scaffold sizes (E5/HANDOFF-E5), checkpoint fidelity table
(E2/E3), grid/units mapping (E2), batch execution mechanics (E8), toolchain versions
(E0), transport + protocol frame (E0/E9), escape-hatch policy (E6 ○). These are settled
in FINDINGS but not yet transcribed here — do so when writing PROJECT_PLAN.md.
