---
id: D3
kind: decision
state: active
source: DECISIONS.md
---

# D3 — `bwmod` library shape **[SETTLED and BUILT 2026-07-24 — `brain/src/bwmod/`]**

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

**Modulator authoring is a template-time file-surgery capability with one
list-local load invariant: each `0x1a1b` is unique within its modulator list.
Separate container lists can reuse ids (E71). The result is verified by
readback, not by inspection.** `validate()` is the cheap offline gate that predicts a LOAD; only a live
load plus a remote-page readback proves the modulation is actually live (a wrong Ramona
path passes every offline check and does nothing, E10b). Workstream B builds on
`bwmod` + a curated template/donor library; it does not need any further format work.

### Phase 5 product library policy

**Settled 2026-08-23 by E71–E73.** The product ships one human-authored,
four-entry Instrument Layer template with recorded provenance. It does not copy
a Bitwig bundled preset. It needs no first-run generation or runtime operator
setup. The file composer can retain one through four entries. A seeded live
layer can grow through typed duplication, which is a separate product path.

Standalone `bwmod` publication and external redistribution review remain Phase
6 work. A wider file template, another container shape, or another binary asset
needs a new measured asset and provenance record.

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
