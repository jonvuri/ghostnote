---
id: E4f
kind: evidence
state: active
source: FINDINGS.md
---

# E4f — Can presets be SYNTHESISED at runtime? (2026-07-19)

**Verdict: ◐ parameterised construction from templates is viable; synthesis
of novel shapes is not.** Asked whether `insertFile` can build arbitrary
layer structures on the fly with no presets prepared in advance. Five gates,
probe `e04f`. The answer is meaningfully better than "ship a preset library"
but short of "generate anything".

### The format

`.bwpreset` is `BtWg` magic + a tag/length/value record stream with readable
field names (`device_id`, `device_name`, `referenced_device_ids`,
`preset_category`). Structural presets are small (FX Layer default 6.6KB);
sample-bearing ones reach megabytes (a user Drum Machine preset: 5MB).

### The gates

| gate | question | result |
|---|---|---|
| 1 | does `insertFile` accept an arbitrary path? | ● loads from the app bundle |
| 2 | does an unregistered copy in `/tmp` load? | ● **files are the unit, not Library entries** |
| 3 | does patching the ASCII UUID swap the device? | ○ **silently loads the ORIGINAL** |
| 4 | does patching the binary GUID swap it? | ● **loads the substituted device** |
| 5 | is the substituted device functional? | ● enumerates + accepts param writes |

- **Gates 1–2 are the enabling result:** the agent can **write a file at
  runtime, anywhere on disk, and load it**. Presets need not pre-exist in
  the Library.
- **Gate 3 is a new trap.** A preset carries the device UUID **twice in
  ASCII** (`device_id`, `referenced_device_ids`) — both metadata — and
  **once as a raw 16-byte big-endian GUID**, which is the real identity.
  Patching only the ASCII copies loads the **original** device with no error:
  a silent wrong-result, not a failure.
- **Gate 4:** patching the binary GUID (length-preserving, no offsets shift)
  makes Bitwig load the substituted device. Identity is parameterisable.
- **Gate 5 is what makes it useful:** the substituted device is **live** —
  it enumerates its own params via DirectParameter and accepts writes
  (`CONTENTS/OUTPUT` → 0.25). It reported only 7 params, i.e. it loaded in a
  near-default state rather than faithfully inheriting the donor's payload —
  **which does not matter**, because state can be set through the API.

⇒ **The pipeline: take the SHAPE from a template preset, substitute device
identities by GUID, then set every parameter via E4/E4b.** The preset only
has to be structurally valid; its stored state is irrelevant.

### What is still out of reach

- **No save/export API.** Only `Device.loadPreset(int)` and the browser
  exist. The agent can never **capture** a structure it or the user built, so
  every template must originate from a human saving one in the UI (or from
  synthesis).
- **Novel shapes require real format work.** Changing a template's *topology*
  — going from a 2-layer to a 5-layer container — means splicing TLV chain
  blocks in an undocumented binary format. Prior art exists but is partial
  and explicitly hazardous: bwEdit-Python's changelog records fixing an
  "FX chain atom (**no longer crashes Bitwig**)". Treat host crashes as the
  expected failure mode of malformed structures.
- ⇒ a **finite template library, one per shape** (2/3/4-layer, etc.), covers
  the realistic space cheaply. Shapes are few; device choices and parameters
  are the varying part, and both are parameterisable.

### ⚠ Limit of this evidence — NOW CLOSED by E4g

E4f could only prove substitution on a **single-device** preset and inferred
the multi-layer case. **E4g verified it directly** against a user-built
4-chain template: per-layer devices are independently swappable. The
inference was correct; see E4g below.

### Decision impact

- **Phase 1/2:** ship a small template library + a GUID-substitution helper;
  never attempt from-scratch preset synthesis.
- **Contract:** structure creation for layer containers is "instantiate a
  known shape, then configure", not "compose arbitrary topology".
- **New trap for the gotcha list:** ASCII-only UUID patching silently loads
  the wrong device — patch the binary GUID, and always verify the loaded
  device's name (readback, as everywhere else in this spike).

---
