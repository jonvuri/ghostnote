---
title: Bitwig `.bwpreset` format — working specification
status: evidence-backed draft (spike E10–E12); enough to build modulator surgery
updated: 2026-07-24
scope: the plain (encoding 0002) container, focused on modulator topology
---

# `.bwpreset` / `.bwclip` / `.bwproject` binary format — working spec

> **Provenance.** Every claim here is backed by a spike experiment (E-number) or
> by direct measurement with `tools/bwformat/bwparse.py` / `bwdiff.py`. Claims are
> tagged **[K]** known/verified, **[I]** inferred (consistent with all evidence,
> not directly isolated), or **[U]** unknown/untested. Do not promote an [I]/[U]
> to [K] without a probe. The whole spike's recurring lesson: confident readings
> from confounded observations are wrong (E10e's "category" gate was one).

---

## 1. Container envelope

A `BtWg` file is a 42-byte ASCII header, then a body whose readability depends on
one header field.

### 1.1 Header (bytes 0..42), all ASCII **[K]**

| bytes | name | meaning |
|---|---|---|
| 0:4 | magic | `BtWg` |
| 4:8 | container | container version, hex — `0003` on Bitwig 6.x |
| 8:12 | **encoding** | **`0002` = plain TLV (readable) · `0004` = opaque** |
| 12:16 | writer | writer/device version, hex (e.g. `00c1`, `00c5`) |
| 16:24 | **f4** | hex; `= objectStreamOffset + 1`. Points at the object stream. |
| 24:32 | f5 | hex; `00000000` in every first-party preset examined **[K for presets]** |
| 32:40 | **f6** | hex; `00000000` when no embedded bulk blob; otherwise **= absolute offset of an embedded DEFLATE-ZIP plugin-state blob** (`PK\x03\x04 … PK\x05\x06`, one entry `plugin-states/<GUID>.<clap-preset\|vstpreset>`) **[K, E11i]** |
| 40:42 | tail | `00` |

- **The encoding field alone predicts readability**, and it tracks file *type*
  exactly across all 361 `BtWg` files on the system **[K, E10-FindingA]**:
  `.bwpreset` / `.bwclip` / `.bwproject` → `0002` plain;
  `.bwdevice` / `.bwmodulator` → `0004` opaque.
- `0004` is **not** any standard compression (no zlib/deflate/gzip/lzma/xz/zstd/lz4
  magic; a decompress-at-every-offset scan finds nothing) and is community-
  confirmed unreadable since Bitwig 3 **[K]**. It holds proprietary DSP. **Modulator
  and device *instances* do NOT live there — they live in the plain `.bwpreset`.**
  Do not spend effort on `0004`.
- **`f6` decoded [K, E11i]:** for a plugin host that embeds its own state (VST3/CLAP,
  e.g. Zebra 3 / u-he), `f6` is the absolute offset of an embedded **ZIP** archive
  (DEFLATE, one `plugin-states/<GUID>` entry) appended after the object stream. It
  slides when content is inserted ahead of it, so a length-changing stream edit must
  re-point `f6` (locate `PK\x03\x04` and write its offset). This plugin-state blob does
  **NOT** mirror modulator topology — swapping a 0-modulator blob under a 1-modulator
  stream still loads; the blob's per-save delta is just a GUID + timestamp nonce. Its
  entry-name GUID is regenerated per save and referenced ~3× in the object stream
  (a linkage id). `f5` meaning still **[U]** — preserve verbatim.

### 1.2 Body layout (encoding `0002`) **[K]**

```
[0 : 42]         header
[42 : f4-1]      META section     — self-describing name/value TLV, space-padded
[f4-1]           one 0x0a byte    — separator between meta and object stream
[f4 : EOF]       OBJECT STREAM    — the root object (numeric-keyed schema)
```

Growing/shrinking the META section shifts the object stream, so **any meta size
change requires patching `f4`** (and only `f4`) **[K, E10f]**.

---

## 2. META section (self-describing TLV) **[K]**

A flat sequence of records, space-padded out to `f4-1`.

```
record := section | field
section:= u32(4)  u32 nameLen  name                      # e.g. "meta"
field  := u32(1)  u32 nameLen  name  u8 type  value
```

META value types seen: `0x08` str (`u32 len + bytes`), `0x02` u8, `0x03` u32,
`0x19` str[] (`u32 count` then `[u32 len, bytes]*`).

Known keys: `application_version_name, branch, comment, creator, device_category,
device_creator, device_id, device_name, device_type, preset_category,
referenced_device_ids, referenced_modulator_ids, referenced_module_ids,
referenced_packaged_file_ids, revision_id, revision_no, tags, type`.

- **`referenced_modulator_ids`** (str[]) — the load-bearing one for modulators: it
  must stay **in sync with the set of modulator GUIDs in the object stream**
  **[K, E10c/E10f]**.
- `revision_id` is a content hash but is **NOT validated on load** — edited files
  load with a stale hash **[K, E10/E10b]**.
- Sample-bearing presets **embed** their audio (AIFF chunks inline);
  `referenced_packaged_file_ids` count is 0 — no external dependency **[K, E10d]**.

---

## 3. OBJECT STREAM (numeric-keyed schema) **[K]**

```
stream := 0x0a  object
object := u32 classId  field*  u32(0)          # 0 fieldId terminates an object
field  := u32 fieldId  u8 type  value
list   := object*  SENTINEL                     # ends with an empty cls-0x0003 object
SENTINEL := 00 00 00 03 00 00 00 00             # NOT a bare classId 0 (E11h)
```

**⚠ List terminator [K, E11h]:** a `0x12` list ends with an empty `cls 0x0003`
**sentinel object** (`00 00 00 03 00 00 00 00`), *not* a bare `classId 0`. A
0-item list is just the sentinel; an N-item list is N adjacent objects then the
sentinel. Reading it as `object* u32(0)` desyncs (the parser eats the sentinel's
`0x0003` as a real item), which is what produced the phantom "unmapped types
0x02/0x06/0x1a" — those were desync noise, not value types. **Editing consequence:
a modulator object's true end is the byte before the sentinel; a diff/insert
boundary can land 2 bytes INTO the sentinel and corrupt it → whole-preset reject
(the alignment-dependent bug that manufactured the false "Zebra wall", E11i). Always
snap object bounds to the sentinel; insert new objects BEFORE it.**

### 3.1 Value types

| type | meaning | encoding |
|---|---|---|
| 0x01 | u8 | 1 byte |
| 0x03 | u32 | 4 bytes BE |
| 0x05 | bool | 1 byte |
| 0x07 | f64 | 8 bytes BE (IEEE double) |
| 0x08 | str | u32 len + UTF-8 (NOT nul-terminated) |
| 0x09 | object | nested `object` |
| 0x12 | list | `list` (objects until classId 0) |
| 0x15 | guid | 16 raw bytes |
| 0x19 | str[] | u32 count + `[u32 len, bytes]*` |
| ~~0x02, 0x06, 0x1a~~ | **RETIRED [K, E11h]** — never real value types; they were list-sentinel DESYNC artifacts (see §3 list grammar). No unmapped scalar types remain in practice. |

- **Critical invariant [K, E10b]:** the `u32` after a `0x09`/`0x12` type byte is a
  **classId, not a byte length**. Nothing in the object stream encodes an absolute
  offset or a byte span. Therefore **length-changing edits inside the stream need
  NO enclosing fixups** — only the edited string's own `u32` length prefix, and
  (if META changed) the header `f4`.
- **Field ids are numeric keys into Bitwig's internal "Ramona" schema**, which is
  **not recoverable by inspection** (bitwig.jar is obfuscated; `com.bitwig.ramona.
  serial`/`.type` packages exist but class names are stripped) **[K]**. Ids are used
  raw. A routing target string like `CONTENTS/F1FREQ` is a **Ramona model path**.
- ⚠ **Parser limitation [K]:** top-level lists now parse (sentinel terminator,
  E11h), but a full recursive dump still stalls in DEEPLY-nested lists inside a
  modulator's CONTENTS (a `type 0x00` desync) where element typing needs the schema.
  This does **not** block targeted editing (locate a string/object by signature,
  snap to the sentinel, edit) — which is all the library needs.

### 3.2 Field ids that matter (measured)

| id | name | notes |
|---|---|---|
| 0x02b9 | name | modulator's display index `"0"/"1"/…`; also object/param names |
| 0x009a | device_name | `'LFO'`, `'Random'`, `'Vibrato'`, … |
| 0x009b | device_creator | `'Bitwig'` |
| 0x009c | device_category | `'LFO'`, `'Note-driven'`, … — **NOT a load gate** (E10f) |
| 0x0124 / 0x0125 | range_lo / range_hi | f64, on a modulation entry |
| 0x0136 | value | f64 |
| 0x0e32 | amount | f64 — modulation amount (0 ⇒ dormant, E7d) |
| 0x0e3d | **routing target** | str — Ramona model path, e.g. `CONTENTS/F1FREQ`; editable any length (E10/E10b) |
| 0x12de | preset_name | embedded name; per-file, expected to differ |
| 0x18c6 | device_guid | 16-byte identity; substitutable (E4g) |
| **0x1a1b** | **instance id** | **u8; MUST be unique per modulator; duplicate ⇒ whole-preset reject (E10f)** |
| 0x1a46 | modulator_list | the `MODULATORS` list (type 0x12) |
| 0x2ab8 | "Chain" GUID | 16-byte, **device/chain-level, NOT per-modulator** (fixed count ~2/file regardless of modulator count; absent from modulator objects); regenerated per save; NOT required unique for load (E10f/E11f) |

### 3.3 Class ids that matter (measured)

| classId | object |
|---|---|
| 0x0001 | a **reference STUB** — `classId(BE u32)=1` then a **BE-u32 payload = an object index** (a linker-style pointer). Not a normal object (no field list). Used by the sampled-Sampler count-field lists (§4, E12b). |
| 0x0003 | the empty form `00 00 00 03 00 00 00 00` is a list **sentinel** (§3, E11h); a class-0x0003 object *with* fields is an ordinary item |
| 0x06c9 | a **modulator instance** |
| 0x075f | the `MODULATORS` wrapper (held by field 0x18f5) |
| 0x018f | a layer **CHAIN** (in `CHAIN_LIST`) |

- **Reference-stub lists [K, E12b]:** a `0x12` list whose items are class-1 stubs is a
  table of object-index pointers, e.g. the sampled-Sampler count fields `0x129c` /
  `0x1422`: `field | 0x12 | [00 00 00 01 <BE-u32 index>]+ | 00 00 00 03 00 00 00 00`.
  A stub's payload shifts when objects are inserted/removed ahead of the referenced
  object (§4). ⚠ Payload is **BIG-endian** — the E11d "LE u32 count" read matched only
  because the values were single-byte.

---

## 4. Modulator sub-structure **[K unless noted]**

A device's modulators live in a wrapper object (classId 0x075f, named
`"MODULATORS"`) whose field 0x1a46 is a **list** (type 0x12) of modulator objects.

```
MODULATORS wrapper (0x075f)
└─ list 0x1a46  [ no count prefix; objects adjacent; ends at classId 0 ]   (E10d)
   ├─ modulator (0x06c9)
   │    0x02b9 name        "0"                 display index
   │    0x009a device_name "LFO"
   │    0x009c category    "LFO"               (not a gate)
   │    0x18c6 guid        <16 bytes>          type identity
   │    0x1a1b instanceId  0                   UNIQUE within preset  ← the gate
   │    0x18c7 CONTENTS (object)
   │         params (RATE/DEPTH/FORM/…) as f64/u8/bool
   │         routing: 0x0e3d target-path (str) + amount (0x0e32) + range (0x0124/5)
   ├─ modulator (0x06c9)  instanceId 1  …
   └─ …
```

- **Routing lives inside the modulator object** (target string + amount + range),
  not a central table **[K]**. Retargeting = rewrite the `0x0e3d` string.
- A modulator's identity is its `0x18c6` GUID; its type-specific payload lives in
  its `CONTENTS`. A GUID-only swap fails (payload mismatches the new type); a
  **whole-object** swap works **[K, E10f]**.
- ⚠ Not every enumerable param forms a valid `0x0e3d` target path — a wrong path
  is a **silent no-op** (loads, no modulation). Verify by readback **[K, E10b]**.

### 4.1 The one load-time invariant proven so far

**Every modulator's `0x1a1b` instance id must be unique within the preset. A
duplicate causes Bitwig to reject the ENTIRE preset (silently — 0 devices load).**
Category, slot position, object length, and donor origin are all **irrelevant**
**[K, E10f: the one-byte M1 test + B1/B1n + C1/C1n controls]**. The id set need not
be contiguous or zero-based — sparse `[0,1,5]`, high `[9,4,7]`, and permuted `[2,0,1]`
all load; **uniqueness is the whole rule** **[K, E11a]**. Same-type duplicates are
fine: two modulators may share a `0x18c6` type guid and produce a duplicate
`referenced_modulator_ids` entry (Bitwig disambiguates display names itself)
**[K, E11f]**.

⚠ **The recipe is broad; the one complication is an EMBEDDED SAMPLE/BULK BLOB, not any
device class and NOT plugin opaque state [K, E11d/E11d-2/E11h/E11i-corrected/E12].** The
full add/replace/delete recipe (below) loads as-is on **Polysynth, a native FX
(Delay+), a CLAP plugin (Repro-5), a VST3 *and* CLAP plugin (Zebra 3 — a plugin's
own DEFLATE-ZIP state does NOT mirror modulators), and a sample-less Sampler** — every
host tested, once no sample is embedded. CLAP/VST routing targets use a deeper path
form, `CONTENTS/ROOT_GENERIC_MODULE/PID<hex>`, vs native `CONTENTS/<NAME>`.

**A loaded sample adds ONE MECHANICAL STEP — reference-stub relocation — not a
capability limit [K, E12].** The sample state contains **count-field lists** (fields
`0x129c`, `0x1422`; type `0x12`) of **class-1 object-index stubs** (§3.3), sentinel-
terminated. Each stub points at an object AFTER the modulator list, so any add/delete/
replace must shift EVERY stub by the modulator subtree's **object footprint**:
`newStub = oldStub + (insertedFootprint − removedFootprint)`, BE payloads, applied to
**every** stub in **every** count list (single sample = 2 stubs; multisample = more —
measured 4). Footprint is **donor-specific** (LFO=`0x10`, native Sampler Random=`0x0d`,
Polysynth Random donor=`0x0b`) — store it per curated donor. With this step, add (any
type incl. **NEW types**), replace/type-swap, delete, and slot-bank-at-scale all LOAD and
are LIVE on single-sample AND multisample Samplers (E12a–E12e). ⇒ **Gate on "does the
preset embed a sample/bulk blob" only to decide whether to run the relocation step — NOT
whether an op is possible. Every op is possible; always verify by load + readback.**
> ⚠ CORRECTS the earlier text (E11d): there is **no per-type mirrored state** and **no
> new-type block** — E11d only swept `±0x10` (each donor has its own footprint), and read
> the BE payload as a single LE "count". A sample-less template is still the simplest
> path, but a sampled template is now fully general too. (And do NOT re-introduce a
> "plugin opaque state" hazard — E11i was a list-sentinel test bug.)

---

## 5. Layer chains (for completeness) **[K, E10d]**

Layer containers hold a `CHAIN_LIST` of chain objects (`"CHAIN0"`, `"CHAIN1"`, …,
classId 0x018f), delimited exactly like modulators. Chains can be **deleted**
(trim a wide template down to N chains). ⚠ The **last** chain has no exact end
(its tail belongs to the parent) — trim by dropping earlier chains instead.
Adding/creating chains from nothing is still ○ (E4d/E4e, API side).

---

## 6. Verified edit operations (the capability surface)

| op | recipe | evidence |
|---|---|---|
| **retarget** | rewrite `0x0e3d` string (any length) | E10/E10b |
| **replace / type-swap** | swap the whole 0x06c9 object; assign a **unique** `0x1a1b`; sync meta ref | E10f-C1 |
| **add** | insert object into 0x1a46 list; unique `0x1a1b`; append meta ref; patch `f4` | E10f-B1 |
| **delete** | remove the object; (sync meta ref) | E10c/E10d |
| **vary settings (runtime)** | remote-control page writes; drive `amount` to 0 to disable | E7d |

**Add/replace recipe, in full (the reference is `tools/bwformat/build_e10f_cases.py`):**
1. object → the `MODULATORS` list (adjacent, no separators, no count field);
2. its `0x1a1b` **and** `0x02b9` set to an id unused by any sibling (max+1 is safe);
3. its GUID appended to / replaced in meta `referenced_modulator_ids` (bump the
   `0x19` str[] count);
4. if META size changed, patch header `f4` by the byte delta.

**Golden validation [K]:** reconstructing `mp_one_lfo` from `mp_bare` via this
recipe is **byte-identical** to the real Bitwig-saved file except the embedded
name and the volatile `0x2ab8` GUID — the recipe reproduces exactly what Bitwig
writes.

All failure modes are **graceful** (whole-file reject, or silent no-op for a bad
path) — never a host crash — but also **silent**, so **every edit must be verified
by load + remote-page readback**.

---

## 7. Do-not-pursue / dead ends (so a fresh session doesn't re-walk them)

- **Encoding `0004`** (`.bwdevice`/`.bwmodulator`): opaque, no known decode since
  BW3. Community tools (zezic/bitwig-device-hacks `repack.py`) only ever worked on
  the BW1 `0001` plain era. `openwig` has no format knowledge (it's a controller-
  script bridge; also GPL — read-only intelligence, not liftable). `carlca`'s
  parser is a weaker meta-only heuristic.
- **Recovering the Ramona field-id → name schema** by grepping the jar/engine: not
  possible (obfuscated). Work from measured field ids instead.
- **Runtime** modulator create/route APIs: ○ (E7). All construction is
  template-time file surgery + runtime *driving* of what exists.
