---
title: Handoff — build `bwmod` (the modulator-surgery library)
status: DONE (2026-07-24) — built, tested offline and live; see FINDINGS E13 and
        BWMOD_DESIGN §8. Kept as the record of what was asked for.
updated: 2026-07-24
---

# Handoff: implement `bwmod` — COMPLETE

**Delivered.** `brain/src/bwmod/` implements every editor, `validate()`, the
readers and a curated donor library. 42 offline tests pass (`cd brain && npm test`),
including four byte-identical golden reconstructions and a byte-for-byte
cross-check against the Python reference; all 12 integration cases pass against
live Bitwig 6.0.6 (`npx tsx src/probes/e13-bwmod.ts`), each confirmed by
remote-page readback, with `I-dup-neg` confirming the reject guard fires. No new
format probes were needed — every recipe worked as documented on the first run.

- **What it looks like now:** BWMOD_DESIGN §8 (as built) and FINDINGS E13.
- **The three things the build had to decide** (container presets need an explicit
  `listIndex`; the removed side of a Tier-2 delta needs `removedFootprint` unless
  the object matches a curated donor exactly; unmeasured footprints are refused,
  never guessed) are recorded in DECISIONS D3.

Everything below is the original brief, unchanged.

---

The `.bwpreset` format investigation is done. Every experiment has a [K] verdict and
every "wall" was demolished by a clean control. Your job is to turn the proven byte
recipes into a small, tested TypeScript library — **no new format probes needed.**

## Read first (in order)
1. **`context/spike/BWMOD_DESIGN.md`** — the spec you are implementing: interfaces,
   invariants, `validate()`, and the full unit + integration test matrix (§6). Marked
   "ready to implement"; §0 decisions are all called.
2. **`context/spike/BWFORMAT_SPEC.md`** — the byte layout every editor manipulates.
3. **`context/DECISIONS.md`** D1/D2/D3 — the correctness rules and why they hold.
4. **`context/spike/FINDINGS.md`** — the evidence, newest-first (E12 stub relocation,
   E11h sentinel, E11i `f6`). Consult per-experiment when a rule's rationale matters.

## What you're building
TypeScript in **`brain/src/bwmod/`**, buffer-in/buffer-out immutable. Editors:
`retarget`, `setAmount`, `replaceModulator`, `addModulator`, `deleteModulator`, plus
`validate()` and the readers. Port from the Python reference primitives
(`tools/bwformat/build_e10f_cases.py`, `build_e12d2_cases.py`) — **keep the Python as a
test oracle** (shell out to cross-check byte output).

## The correctness rules that bite (all in BWMOD_DESIGN §0/§3/§5)
- **Snap object bounds to the list SENTINEL** `00 00 00 03 00 00 00 00` — never a diff
  boundary (the E11h off-by-2 → silent whole-preset reject).
- **`0x1a1b` instance id unique** — the one load gate. Ids need not be contiguous; the
  `0x02b9` name is cosmetic.
- **Meta `referenced_modulator_ids`** stays in sync; patch header **`f4`** on meta size change.
- **`f6` re-point** when nonzero + length changed (locate `PK\x03\x04`).
- **Tier-2 (sampled preset): relocate EVERY class-1 stub in EVERY count list**
  (`0x129c`/`0x1422`, BE payloads) by `(inserted − removed) footprint`; footprint is
  per-donor curated metadata.

## Definition of done (BWMOD_DESIGN §7)
6.1 unit tests green in CI (incl. the byte-identical golden reconstructions and the
sentinel/`f4`/`f6`/stub-relocate/validate-negative guards); 6.2 integration tests green
against live Bitwig 6.0.6 via the bridge (I-dup-neg must confirm the guard fires).
**Every edit verified by live load + remote-page readback — a bad route path passes
`validate()` but is a silent no-op.**

## The rig (unchanged)
Bitwig 6.0.6 + ghostnote controller, bridge on `127.0.0.1:8686`. Build/deploy:
`cd extension && gradle copyExtension`. Probes: `cd brain && npx tsx src/probes/eNN-*.ts`
(reuse `e11-load.ts` — manifest-driven load + readback). Fixtures under
`~/Documents/Bitwig Studio/Library/Presets/`. Standing rules: restore gn-A/gn-B after
each live test; a FAIL is often a wrong expectation; isolate one variable.
