---
title: bwmod — modulator-surgery library design (interfaces + tests)
status: proposal for a fresh implementation session
updated: 2026-07-22
depends-on: BWFORMAT_SPEC.md (the byte layout), FINDINGS.md E10/E10b/E10c/E10d/E10e/E10f
---

# `bwmod` — a `.bwpreset` modulator-surgery library

> **Purpose.** Turn the proven byte-recipes (spec §6) into a small, tested library
> the brain can call to construct modulator topology on a template `.bwpreset`
> before `insertFile`. **This doc is a design sketch, not code** — implement in a
> fresh session.

## 0. Decisions to make first (call them at the top of the impl session)

1. **Language & home.** The surgery runs **brain-side** (TS) — the brain writes a
   temp `.bwpreset` then sends its absolute path over the bridge (E4h). So the
   shipping library is **TypeScript in `brain/src/bwmod/`**. The Python tooling
   (`tools/bwformat/*.py`) stays as the **reference implementation + analysis**,
   and its `build_e10f_cases.py` primitives are the port source. *Recommended:
   port to TS; keep Python as the oracle for cross-checking (a test can shell out
   to it).* Alternatively keep it Python and have the brain spawn it — simpler to
   reuse, but adds a Python runtime dependency to the product.
2. **Buffer-in/buffer-out, immutable.** Every edit takes a `Buffer` and returns a
   **new** `Buffer`; never mutate input. Enables cheap composition + diffing.
3. **Donor objects come from a template library**, not synthesis. A modulator
   object is *extracted* from a human-authored `.bwpreset` and *transplanted*.
   Ship a curated set (one per modulator type) under `assets/modulators/`.
4. **Validate before load.** Bitwig rejects invalid files silently (0 devices), so
   the library MUST expose a `validate()` that catches the known invariants
   *before* the brain pays an `insertFile` round-trip.
5. **Gate on an EMBEDDED SAMPLE to run STUB RELOCATION, not on device class, and NOT
   to forbid any op (E11d/E11d-2/E12).** The plain 3-step recipe is verified general
   across Polysynth, native FX (Delay+), CLAP (Repro-5), **and a sample-less Sampler**.
   A **loaded sample** adds ONE mechanical step: the sample state holds **count-field
   lists** (fields `0x129c`, `0x1422`; type `0x12`) of **class-1 object-index stubs**
   (`classId(BE u32)=1` + **BE-u32** payload), each sentinel-terminated. Each stub points
   at an object AFTER the modulator list, so every add/delete/replace must shift **every
   stub in every count list** by the modulator subtree's **object footprint**:
   `stub += (insertedFootprint − removedFootprint)`. Footprint is **donor-specific**
   (LFO=`0x10`, native Sampler Random=`0x0d`, Polysynth Random donor=`0x0b`) — so **store
   each curated donor's footprint as asset metadata** (the full recursive object walk
   hits the deep-list schema limit; a measured constant is the robust source). Single
   sample = 2 stubs; multisample = more (measured 4) — walk each list to the sentinel;
   never stop after the first stub. **There is NO new-type block and NO per-type mirrored
   state (E12c):** with correct footprint + complete relocation, add (any/NEW type),
   type-swap, delete, and slot-bank-at-scale all LOAD and are LIVE on single-sample AND
   multisample. `retarget`/`setAmount` need no relocation (no object added/removed). A
   sample-less template is still simplest, but a sampled template is fully general too.
   Keep load+readback mandatory regardless; do NOT assume a new host/preset works without
   a live load test. Port source: `tools/bwformat/build_e12d2_cases.py` (`relocate_stubs`).
6. **Ids: unique, not contiguous (E11a).** `nextFreeInstanceId = max+1` is a safe
   convenience; any value absent from the current `0x1a1b` set is valid, so `delete`
   need not renumber. Same-type duplicates are fine — `referenced_modulator_ids` may
   legitimately contain a repeated guid (E11f), so `addModulator` needs no id/guid
   "freshening" beyond the unique `0x1a1b`.
7. **Object bounds MUST snap to the list SENTINEL (E11h) — hard correctness rule.**
   The `0x1a46` list ends with an empty `cls 0x0003` sentinel `00 00 00 03 00 00 00 00`
   (not a bare `classId 0`). A modulator object's true end is the byte before that
   sentinel. **A diff/insert-derived boundary can land 2 bytes INTO the sentinel and
   corrupt it → whole-preset reject**, and this is *alignment-dependent* (it slipped
   past on most hosts and only bit Zebra 3 — which manufactured the false "opaque-state
   wall" the corrected E11i retracts). `extractModulator`/`deleteModulator`/`addModulator`
   MUST end objects at, and insert new objects before, the sentinel. `validate()` and a
   golden test MUST assert the sentinel is intact and well-formed after every edit.
   Corollary: **plugin opaque state (VST3/CLAP DEFLATE-ZIP, e.g. Zebra 3) is NOT a
   hazard** — do not special-case it. The only bulk-content gate is decision 5's
   embedded sample.

## 1. Types

```ts
interface Header {
  container: string;      // "0003"
  encoding: '0002' | '0004';
  writer: string;
  streamOffset: number;   // = f4 - 1 (the 0x0a marker); root object at f4
}

interface Modulator {
  index: number;          // physical position in the MODULATORS list (0-based)
  name: string;           // field 0x02b9 (display index as string)
  deviceName: string;     // 0x009a e.g. "LFO"
  category: string;       // 0x009c e.g. "LFO" | "Note-driven" (informational)
  guid: string;           // 0x18c6, canonical 8-4-4-4-12
  instanceId: number;     // 0x1a1b — the uniqueness-gated field
  routing: Routing | null;
  span: [number, number]; // absolute byte bounds of the object (see caveats)
}

interface Routing {
  target: string;         // 0x0e3d Ramona path, e.g. "CONTENTS/F1FREQ"
  amount: number;         // 0x0e32
  rangeLo?: number; rangeHi?: number;
}

interface ValidationResult {
  ok: boolean;
  problems: string[];     // human-readable; empty iff ok
}
```

## 2. Reader interface (pure, read-only)

```ts
function parseHeader(buf: Buffer): Header;
function readMeta(buf: Buffer): Map<string, string | number | string[]>;
function listModulators(buf: Buffer): Modulator[];
function listChains(buf: Buffer): Chain[];            // layer containers (E10d)
function nextFreeInstanceId(buf: Buffer): number;     // max(existing 0x1a1b)+1
```

Implementation notes:
- Locate the `MODULATORS` list and its items by signature (`0x1a46` list, then
  0x06c9 objects). The list ends with the empty `cls 0x0003` sentinel
  `00 00 00 03 00 00 00 00` (spec §3, E11h) — so the **last** modulator's end IS
  well-defined: it is the byte before the sentinel. Prefer a `mp_bare`-style diff to
  find item starts, but **always SNAP the object end to the sentinel** (`buf.indexOf`
  the sentinel near the diff boundary): the raw diff boundary can be 2 bytes off and
  corrupt the sentinel (decision 7, the E11i bug). `listEnd` = sentinel start;
  `addModulator` inserts before it; `deleteModulator` removes `[itemStart, nextStart)`
  leaving the sentinel untouched.

## 3. Editor interface (buffer→buffer, immutable)

```ts
// Retarget an existing modulator's route (any-length string, E10/E10b).
function retarget(buf: Buffer, index: number, target: string): Buffer;

// Set modulation amount (0 disables; the slot-bank lever, E7d).
function setAmount(buf: Buffer, index: number, amount: number): Buffer;

// Replace a modulator with a donor object (type-swap; unique id auto-assigned,
// meta ref swapped). Any category (E10f).
function replaceModulator(buf: Buffer, index: number, donor: DonorObject): Buffer;

// Add a donor as a NEW modulator (unique id, meta ref appended, f4 patched).
function addModulator(buf: Buffer, donor: DonorObject, routing?: Routing): Buffer;

// Remove a modulator (object + meta ref).
function deleteModulator(buf: Buffer, index: number): Buffer;
```

`DonorObject` = a modulator object extracted from a template, plus its GUID:

```ts
interface DonorObject { bytes: Buffer; guid: string; category: string; }
function extractModulator(templatePreset: Buffer, index: number): DonorObject;
```

**Invariants every editor MUST maintain (this is the library's correctness spec):**
1. **Unique `0x1a1b`** across all modulators (the load gate, E10f); need not be
   contiguous (E11a). `addModulator`/`replaceModulator` assign `nextFreeInstanceId`.
   The `0x02b9` name is **cosmetic — not validated against the id (E11b)**; keeping
   `name == id` is the tidy default (what Bitwig writes) but not required, so
   add/delete need do no name-renumbering.
2. **meta `referenced_modulator_ids` == the set of modulator GUIDs**, in order,
   count correct (E10c/E10f).
3. **`f4` == meta-end offset** after any meta size change (E10f).
4. Object/list terminators intact; no stray bytes; total length accounting exact.

## 4. Low-level (exported for tests + advanced use)

```ts
function patchString(buf, absOffset, newValue): Buffer;   // rewrites u32 len + bytes
function setF4(buf, newStreamOffset): Buffer;
function appendMetaRef(buf, guid): Buffer;                // bumps 0x19 count, patches f4
function removeMetaRef(buf, guid): Buffer;
function findModulatorList(buf): { listStart: number; itemStarts: number[]; listEnd?: number };
```

## 5. `validate(buf): ValidationResult`

Checks, in order, the invariants that predict a load (cheap; run before insertFile):
- header well-formed; encoding `0002`; `f4` points at a `0x0a` byte.
- **`0x1a46` list ends with an intact `00 00 00 03 00 00 00 00` sentinel**, and the
  last modulator object's terminator abuts it exactly (the E11h/E11i off-by-2 guard —
  the single most common way an edit silently rejects).
- `0x1a1b` values across modulators are **unique** (the proven gate).
- meta `referenced_modulator_ids` set == modulator-GUID set; count matches.
- if the preset embeds a sample (count-field lists present): every class-1 stub in
  every count list (`0x129c`/`0x1422`) has been relocated by `(inserted − removed)
  footprint` (BE payloads); no stub left stale. (New-type introduction is allowed — it
  is NOT a failure mode; E12.)
- every `0x0e3d` route target is non-empty (can't verify path validity offline — a
  warning, not an error; the real check is readback).
- total-length / terminator sanity.

`validate` returning `ok` is **necessary but not sufficient** — the sufficient
check is a live load + remote-page readback (a bad Ramona path passes validate but
carries no modulation, E10b). Keep both.

---

## 6. Tests the library must satisfy

### 6.1 Pure unit tests (no Bitwig; fast, run in CI)

| # | test | asserts |
|---|---|---|
| U-parse | `listModulators(modtest)` | `[Vibrato/0, Expressions/1, LFO/2]` with ids `[0,1,2]` |
| U-roundtrip | `parse(x)` then re-serialize | byte-identical to `x` for all fixtures |
| **U-golden** | `addModulator(mp_bare, LFO-donor)` | **byte-identical to real `mp_one_lfo`** except name + `0x2ab8` GUID (the E10f reconstruction) |
| U-unique | `addModulator` / `replaceModulator` twice | assigned ids are distinct and `= nextFreeInstanceId` |
| U-metasync | after add/replace/delete | `referenced_modulator_ids` set == modulator-GUID set; count correct |
| U-f4 | after any meta size change | `f4-1` indexes a `0x0a`; meta length matches |
| **U-sentinel** | after add/replace/delete | the `0x1a46` list still ends with an intact `00 00 00 03 00 00 00 00` sentinel; the last object's terminator abuts it exactly (guards the E11i off-by-2 bug) |
| U-stub-relocate | add/delete/replace on a sample-bearing preset (incl. multisample + NEW type) | EVERY class-1 stub in EVERY count list deltaed by `(inserted − removed) footprint` (BE); golden: reconstruct `gn_sampler_one_random` from `gn_sampler_bare` byte-identical modulo name + per-save GUIDs (E12c); new-type add LOADS (not refused) |
| U-retarget-len | retarget to shorter AND longer paths | length delta reflected; `f4` unchanged (stream-only edit) |
| U-immutable | every editor | input buffer unchanged (deep-equal to a pre-copy) |
| U-validate-neg | hand-build a duplicate `0x1a1b` | `validate().ok === false`, names the collision |
| U-validate-neg2 | drop a meta ref | `validate().ok === false` |

### 6.2 Integration tests (against live Bitwig via the bridge)

Model on `e10f-addcat.ts`: build files, `insertFile`, read remote pages, restore
fixtures. Each asserts **load + the expected modulator page(s)**.

| # | test | asserts |
|---|---|---|
| I-add | `addModulator(one_lfo, Random)` | loads; pages `[LFO, Random]` |
| I-replace | `replaceModulator(modtest, 1, ClassicLFO)` | loads; `Classic LFO` live at slot 1 |
| I-retarget | `retarget(modtest, LFO-idx, "CONTENTS/F1RESO")` | loads; modulation on F1RESO, not F1FREQ (divergence readback) |
| I-delete | `deleteModulator(modtest, 1)` | loads; slot gone; siblings intact |
| I-dup-neg | force a duplicate `0x1a1b` | **rejected** (0 devices) — the negative control |
| I-crosscat | replace a Note-driven slot with an LFO donor | loads (category is not a gate) |
| I-compose | add + retarget + setAmount in one build | loads; the composed route is live |

### 6.3 Property/fuzz (nice-to-have)

- For random sequences of add/replace/delete/retarget starting from a fixture:
  `validate()` stays `ok`, ids stay unique, and (sampled) the result loads.

---

## 7. Definition of done

- All 6.1 pass in CI; all 6.2 pass against Bitwig 6.0.6; I-dup-neg confirms the
  guard fires. `validate()` catches every 6.1 negative **before** a load.
- The library replaces `build_e10f_cases.py`'s ad-hoc surgery; that script becomes
  a thin caller (or is retired).
- Carry-forward note in DECISIONS: modulator authoring is a template-time
  file-surgery capability with a single load invariant (unique `0x1a1b`), verified
  by readback.
