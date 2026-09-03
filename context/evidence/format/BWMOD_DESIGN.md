---
title: bwmod — modulator-surgery library design (interfaces + tests)
status: BUILT (2026-07-24) — `brain/src/bwmod/`; 42 unit tests + the Python oracle
        cross-check green offline, all 12 integration cases green on live Bitwig
        6.0.6. See §8 for what the build changed. Evidence: FINDINGS E13.
updated: 2026-08-23
depends-on: BWFORMAT_SPEC.md (the byte layout), FINDINGS.md E10–E12 (esp. E11h sentinel,
            E11i f6, E12 stub relocation), E71 (container list scope)
---

# `bwmod` — a `.bwpreset` modulator-surgery library

> **Purpose.** Turn the proven byte-recipes (spec §6) into a small, tested library
> the brain can call to construct modulator topology on a template `.bwpreset`
> before `insertFile`. **This doc is a design sketch, not code** — implement in a
> fresh session.

## 0. Ground decisions (all settled; decision 1 called 2026-07-24)

1. **Language & home.** The surgery runs **brain-side** (TS) — the brain writes a
   temp `.bwpreset` then sends its absolute path over the bridge (E4h). So the
   shipping library is **TypeScript in `brain/src/bwmod/`**. The Python tooling
   (`tools/bwformat/*.py`) stays as the **reference implementation + analysis**,
   and its `build_e10f_cases.py` primitives are the port source. **DECIDED
   (2026-07-24): port to TS; keep Python as the oracle** — tests may shell out to
   `tools/bwformat` to cross-check byte output. (The keep-it-Python alternative is
   rejected: it would add a Python runtime dependency to the product.)
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
6. **Grid pairs: list-local, unique, and compact for new objects (E88/E95).**
   The pair is the load identity and the UI coordinate. Add uses the first free
   position in a three-row, column-major grid. Replace keeps its resident pair.
   Separate container lists can reuse pairs. Deletion does not renumber
   residents. Same-type duplicates are valid (E11f). Plain presets can repeat a GUID in
   `referenced_modulator_ids`; containers keep one ordered unique GUID set.
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
8. **Re-point `f6` after any stream-length change when a plugin-state blob is
   embedded (E11i; DECISIONS D1 invariant 4).** When header `f6` ≠ 0 it is the
   absolute offset of an embedded DEFLATE-ZIP plugin-state blob (`PK\x03\x04 …`)
   appended after the object stream (VST3/CLAP hosts that embed their own state,
   e.g. Zebra 3). Any edit that grows/shrinks bytes ahead of it slides the blob,
   so every length-changing editor MUST finish by re-locating `PK\x03\x04` and
   rewriting `f6` (no-op when `f6 == 0`). The blob itself does NOT mirror
   modulator topology (E11i-corrected) — only the pointer needs maintenance.
   `f5` is still [U] — preserve verbatim, never synthesize.

## 1. Types

```ts
interface Header {
  container: string;      // "0003"
  encoding: '0002' | '0004';
  writer: string;
  streamOffset: number;   // = f4 - 1 (the 0x0a marker); root object at f4
  f6: number;             // 0 = no embedded plugin-state blob; else absolute offset of its PK\x03\x04 (E11i, decision 8)
}

interface Modulator {
  index: number;          // physical position in the MODULATORS list (0-based)
  name: string;           // field 0x02b9 (display index as string)
  deviceName: string;     // 0x009a e.g. "LFO"
  category: string;       // 0x009c e.g. "LFO" | "Note-driven" (informational)
  guid: string;           // 0x18c6, canonical 8-4-4-4-12
  instanceGroup: number;  // 0x1a1a — grid column and first identity part
  instanceId: number;     // 0x1a1b — grid row and second identity part
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

`DonorObject` = a modulator object extracted from a template, plus its GUID and
its measured **object footprint** (decision 5):

```ts
interface DonorObject { bytes: Buffer; guid: string; category: string; footprint: number; }
function extractModulator(templatePreset: Buffer, index: number, footprint: number): DonorObject;
```

⚠ `footprint` cannot be computed by extraction (the deep-list schema limit, spec
§3.1) — it is curated asset metadata, measured once per donor (E12a load-triangulation
or the E12b field-walk) and passed in. Only Tier-2 (sampled) edits consume it.

**Invariants every editor MUST maintain (this is the library's correctness spec):**
1. Each `0x1a1a`/`0x1a1b` pair is unique within its list (the load gate, E88).
   The pair is also the UI grid coordinate (E95). Add allocates the first free
   slot in a three-row, column-major grid. Replace keeps the resident slot. The
   `0x02b9` name is cosmetic (E11b); new objects use the linear grid slot number.
2. **meta `referenced_modulator_ids` == the set of modulator GUIDs**, in order,
   count correct (E10c/E10f).
3. **`f4` == meta-end offset** after any meta size change (E10f).
4. Object/list terminators intact; no stray bytes; total length accounting exact.
5. **`f6` re-pointed** whenever it is nonzero and the edit changed byte length
   ahead of the blob: locate `PK\x03\x04`, rewrite `f6` (decision 8, E11i).

## 4. Low-level (exported for tests + advanced use)

```ts
function patchString(buf, absOffset, newValue): Buffer;   // rewrites u32 len + bytes
function setF4(buf, newStreamOffset): Buffer;
function repointF6(buf): Buffer;                          // locate PK\x03\x04, rewrite header f6; no-op when f6 == 0 (decision 8)
function appendMetaRef(buf, guid): Buffer;                // bumps 0x19 count, patches f4
function removeMetaRef(buf, guid): Buffer;
function findModulatorList(buf): { listStart: number; itemStarts: number[]; listEnd?: number };
```

## 5. `validate(buf): ValidationResult`

Checks, in order, the invariants that predict a load (cheap; run before insertFile):
- header well-formed; encoding `0002`; `f4` points at a `0x0a` byte.
- if `f6` ≠ 0: the bytes at `f6` are exactly `PK\x03\x04` (the plugin-state blob
  pointer is not stale — the E11i slide guard, decision 8).
- **`0x1a46` list ends with an intact `00 00 00 03 00 00 00 00` sentinel**, and the
  last modulator object's terminator abuts it exactly (the E11h/E11i off-by-2 guard —
  the single most common way an edit silently rejects).
- each `0x1a1a`/`0x1a1b` pair is **unique within the selected list**.
- meta `referenced_modulator_ids` matches the list for a plain preset. For a
  container, it contains the required ordered unique GUID set across lists.
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
| U-unique | `addModulator` twice and `replaceModulator` twice | added pairs are unique; replacements keep the resident pair |
| U-grid | add LFO, Random, Beat LFO, and Classic LFO from mixed donor sources | pairs are compact `0:0`, `0:1`, `0:2`, `1:0`; a deleted gap is reused |
| U-metasync | after add/replace/delete | `referenced_modulator_ids` set == modulator-GUID set; count correct |
| U-f4 | after any meta size change | `f4-1` indexes a `0x0a`; meta length matches |
| U-f6 | add/delete on a plugin-state-bearing fixture (`gn_zebra3clap_one_lfo`) | `f6` == the post-edit offset of `PK\x03\x04`; a preset with `f6 == 0` leaves it 0 |
| **U-sentinel** | after add/replace/delete | the `0x1a46` list still ends with an intact `00 00 00 03 00 00 00 00` sentinel; the last object's terminator abuts it exactly (guards the E11i off-by-2 bug) |
| U-stub-relocate | add/delete/replace on a sample-bearing preset (incl. multisample + NEW type) | EVERY class-1 stub in EVERY count list deltaed by `(inserted − removed) footprint` (BE); golden: reconstruct `gn_sampler_one_random` from `gn_sampler_bare` byte-identical modulo name + per-save GUIDs (E12c); new-type add LOADS (not refused) |
| U-retarget-len | retarget to shorter AND longer paths | length delta reflected; `f4` unchanged (stream-only edit) |
| U-immutable | every editor | input buffer unchanged (deep-equal to a pre-copy) |
| U-validate-neg | hand-build a duplicate identity pair | `validate().ok === false`, names the collision |
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
| I-dup-neg | force a duplicate identity pair | **rejected** (0 devices) — the negative control |
| I-crosscat | replace a Note-driven slot with an LFO donor | loads (category is not a gate) |
| I-compose | add + retarget + setAmount in one build | loads; the composed route is live |

### 6.3 Property/fuzz (nice-to-have)

- For random sequences of add/replace/delete/retarget starting from a fixture:
  `validate()` stays `ok`, ids stay unique, and (sampled) the result loads.

---

## 7. Definition of done — MET (2026-07-24)

- ✅ All 6.1 pass in CI (`cd brain && npm test` — 42 tests, plus the Python-oracle
  cross-check); all 6.2 pass against Bitwig 6.0.6 (`npx tsx src/probes/e13-bwmod.ts`
  — 12 cases); I-dup-neg confirms the guard fires. `validate()` catches every 6.1
  negative **before** a load.
- ✅ The library supersedes `build_e10f_cases.py`'s ad-hoc surgery. That script and
  its siblings are KEPT VERBATIM as the reference implementation and CI oracle
  (decision 1) — they are the record FINDINGS cites, so they are annotated as
  superseded rather than rewritten.
- ✅ Carry-forward note recorded in DECISIONS D3.

---

## 8. As built (2026-07-24)

Everything in §1–§6 shipped as specified. What the build added or sharpened —
each item is a place the design was silent and the code had to make a call:

- **Container presets are refused, not guessed at.** A layer/chain preset holds
  one `0x1a46` list PER NESTED DEVICE, which §2 did not anticipate.
  `findModulatorList` / `listModulators` take an optional `listIndex`; without
  one they THROW when several lists are present, because editing "the first
  list" would silently rewrite whichever nested device serialized first.
  `validate()` reports it as a warning (the file loads; it is just out of scope).
- **`removedFootprint`.** §5's `(inserted − removed) footprint` needs the REMOVED
  side, which the design left implicit. `deleteModulator`/`replaceModulator` take
  `{ removedFootprint }`; when omitted, the resident object must match a curated
  donor byte-for-byte (`identifyCuratedDonor`, normalizing both grid
  coordinates, id, name, and route — the fields that editors rewrite, which
  E12e proved add no objects).
  No match and no explicit value ⇒ a loud refusal. Never a guess.
- **Unmeasured footprints ship as `null`.** At the initial build, only
  `lfo-sampler` (0x10), `random-sampler` (0x0d), and `random-poly` (0x0b) were
  measured. Phase 5e added `classiclfo-poly` (0x0c) and `vibrato-poly` (0x0f).
  `lfo-poly` and `expressions-poly` remain Tier 1 only and refuse on a sampled
  preset. A CI test re-derives 0x10/0x0d from the fixtures' own `bare -> one_X`
  stub deltas and checks all five sampled donors.
- **`routes: Routing[]`** alongside `routing` — a modulator may drive several
  targets, so `retarget`/`setAmount` take an optional `routeIndex` (default 0).
- **`ValidationResult.warnings`**, for the conditions §5 called warnings (empty
  route target, container preset) — `ok` stays driven by `problems` alone.
- **`listChains` resolves starts only**, with the last chain's `end` as `null`,
  faithfully to E10d. There are deliberately no chain editors.
- **Test-matrix additions:** a fourth golden (multisample reconstruction,
  byte-identical — E12d had only load-tested it); the offline footprint
  corroboration; a container-preset test; and negatives for a stale `f6` and a
  stale count stub.
- **One divergence from the Python oracle, by design:** the port re-points `f6`
  and the reference scripts never did (the rule post-dates them, E11i). The
  oracle test asserts the difference is confined to those header bytes.

Live readback needs one calibration the design did not mention: modulator pages
are appended AFTER the device's own remote pages, a Note-driven modulator can
contribute no page, and Bitwig disambiguates repeated instances as `LFO 1` and
`LFO 2`. Exact verification accepts one bare page or the complete ordinal family
from 1 through N. It rejects missing, extra, and malformed families. It does not
remove numeric suffixes from public names. `e13-bwmod.ts` loads each device's
modulator-free `bare` fixture first to learn its page count instead of assuming
one. E96 narrows public support to types with an exact relocated live page.
