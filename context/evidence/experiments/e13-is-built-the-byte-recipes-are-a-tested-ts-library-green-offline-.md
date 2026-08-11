---
id: E13
kind: evidence
state: active
source: FINDINGS.md
---

# E13 — `bwmod` is BUILT: the byte recipes are a tested TS library, green offline and live [K] (2026-07-24)

**Verdict: ● the whole E10–E12 capability surface now exists as `brain/src/bwmod/`
— buffer-in/buffer-out, immutable, with `validate()` and a curated donor library.
42 unit tests pass offline (including four BYTE-IDENTICAL golden reconstructions
and a byte-for-byte cross-check against the Python reference), and all 12
integration cases pass against live Bitwig 6.0.6, each confirmed by remote-page
readback. The negative control fires: a forced duplicate `0x1a1b` is rejected
(0 devices).** This is the last spike deliverable; no new format probes were
needed — every recipe worked as documented on the first live run. Code:
`brain/src/bwmod/`, tests `brain/src/bwmod/*.test.ts`, probe
`brain/src/probes/e13-bwmod.ts`, donors `brain/assets/modulators/`, fixtures
vendored under `brain/fixtures/`.

### What was verified

| layer | result |
|---|---|
| goldens (offline) | `mp_one_lfo` from `mp_bare`, `gn_sampler_one_lfo`/`one_random` from `gn_sampler_bare`, **and `gn_sampler_multi_one_lfo` from `gn_sampler_multi_bare`** all reconstruct byte-identically modulo the embedded name + per-save `0x2ab8` GUIDs |
| oracle (offline) | add/replace/delete/retarget byte-identical to `tools/bwformat` on Polysynth, single-sample, multisample and Zebra3-CLAP — the ONLY divergence is `f6`, which the port re-points and the reference never did (E11i post-dates those scripts) |
| live (E13 probe) | add, replace, retarget, delete, cross-category replace, compose, sampled add / NEW-type add / delete, multisample add — all LOAD with the expected modulator pages; retarget and compose show live modulation on `Reso` with `Filt Freq` confirmed clean (the divergence control); `I-dup-neg` REJECTS |

### New facts, learned by building (small, all [K])

1. **A CONTAINER preset carries one `0x1a46` list PER NESTED DEVICE.** The
   4-chain Instrument Layer fixture has several. `bwmod` therefore REFUSES a
   modulator edit on such a file unless the caller names a `listIndex` —
   "edit the first list" would silently rewrite whichever nested device happened
   to serialize first. `validate()` reports this as a WARNING, not a problem:
   the file loads fine, it is just outside single-device editing.
2. **META ends with a `u32(0)` terminator, then the space padding** out to
   `f4-1`. Spec §2 described the records but not the terminator.
3. **Modulator remote pages are APPENDED AFTER the device's own pages, and a
   Note-driven modulator contributes NO page.** Polysynth owns 8 pages, Sampler
   3; `modtest`'s three modulators yield only `[Vibrato, LFO]` because
   Expressions has no page. Duplicates are disambiguated by Bitwig as
   `LFO 1`/`LFO 2` (E11f). Any readback assertion must calibrate against a
   modulator-free `bare` preset rather than assume a page count.
4. **Footprint identification must be by exact OBJECT bytes, not by GUID.** Two
   LFOs of the same type from different presets differ in params and may differ
   in footprint, so `bwmod` matches a resident modulator against the curated set
   byte-for-byte (normalizing only the id, name, and route target/amount — the
   fields its own editors rewrite, which E12e proved add no objects) and DEMANDS
   an explicit `removedFootprint` when there is no match. A guessed footprint is
   a silent whole-preset reject.
5. **The footprints are corroborated offline.** The `bare -> one_X` stub deltas
   in the fixtures are exactly the measured footprints — LFO `0x10`, Sampler
   Random `0x0d`, and `gn_sampler_lfo_random` at `0x10 + 0x0d` — so the E12a
   load-triangulation is now also a CI assertion, not just a live measurement.
   Only 3 of the 7 curated donors have measured footprints; the rest ship as
   `null` (Tier-1 usable, refused on a sampled preset) rather than guessed.

### Decision impact
- D3 is DONE — see DECISIONS D3 and BWMOD_DESIGN §8 (as-built).
- The Python `tools/bwformat/*.py` stays as the reference + CI oracle exactly as
  decision 1 intended; the product has no Python dependency.
- Carry-forward: modulator authoring is a template-time file-surgery capability
  with a single load invariant (unique `0x1a1b`), verified by readback.

---
