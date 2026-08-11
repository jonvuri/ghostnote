---
id: E10
kind: evidence
state: active
source: FINDINGS.md
---

# E10 — The `.bwpreset` format is readable, and routing targets are editable (2026-07-20)

**Verdict: ● modulation ROUTING TARGETS are fully parameterisable — E7 Finding F's
○ is overturned.** The `.bwpreset` container was decoded well enough to read
modulator topology, and a modulator's routing target turns out to be a plain
length-prefixed UTF-8 string holding a parameter path. Rewriting it **moves the
modulation**, in both directions of length change, loading cleanly via
`insertFile`. Probes `e10-retarget` (length-preserving) + `e10b-varlen`
(variable-length, both directions), all green. Reader + editing helper live at
`tools/bwformat/bwparse.py`. This **collapses the target axis of E7 Finding H's
slot-bank** (below). Credit: the user brought the zezic/bitwig-device-hacks and
bwEdit-Python leads that prompted re-opening a closed ○.

### Finding A — `.bwmodulator` is a dead end, and the header says why (○, but informative)

The header's third field is an **encoding discriminator**, and it alone predicts
readability. Verified across **all 361** BtWg files shipped with or written by
Bitwig 6.0.6 — the correlation is exact, with no exceptions:

| extension | encoding | payload | count |
|---|---|---|---|
| `.bwpreset` / `.bwclip` / `.bwproject` | `0002` | **plain, parseable** | 167 |
| `.bwdevice` / `.bwmodulator` | `0004` | opaque | 194 |

`0004` is **not** any standard compression: a brute-force zlib/raw-deflate/gzip
scan at every offset yields zero decompressible regions, and there is no
lzma/xz/zstd/lz4 magic anywhere. Entropy ~6.7–7.5 (the low end explained by ~5KB
of space padding, not by structure).

**Why the community tooling looked promising and isn't.** `zezic/bitwig-device-hacks`
`repack.py` performs **no decompression at all** — it splices raw bytes at
hardcoded offsets, which works because *its* `Math.bwmodulator` is plain. That
file is `BtWg` **0001**/`0002` with readable TLV and Nitro DSP source in the
clear; Bitwig 6.0.6 ships the same device as **0003**/`0004`. The format moved
on and the repo is archived. ⇒ **This CONFIRMS and sharpens E7 Finding D rather
than overturning it.** `openwig` has no `BtWg` knowledge whatsoever (it is a
controller-script bridge) — not a format lead at all.

⇒ **Do not spend further time on `.bwmodulator`/`.bwdevice`.** They hold Bitwig's
proprietary DSP implementations. **Modulator instances and their routing do not
live there — they live inside `.bwpreset`, which is plain.** E7 Finding D's
"`.bwmodulator` files are binary-compressed" was right about the file and wrong
about where the interesting content is.

### Finding B — the container grammar (●)

```
header  [0:4]'BtWg' [4:8]container [8:12]ENCODING [12:16]writer
        [16:24]f4 -> object-stream root offset (+1) [24:32]f5 [32:40]f6 [40:42]'00'
meta    self-describing name/value TLV, space-padded (creator, device_id,
        referenced_modulator_ids, revision_id, …)
stream  u8(0x0a) u32 rootClassId field* u32(0)
object  := u32 classId, field*, u32(0)
field   := u32 fieldId, u8 type, value
types   := 0x01 u8 | 0x03 u32 | 0x05 bool | 0x07 f64 | 0x08 str
           0x09 object | 0x12 list | 0x15 guid16 | 0x19 str[]
```

A modulator instance decodes to:

```
<cls 0x06c9> {
  0x009a device_name    = 'LFO'
  0x18c6 device_guid    = ad947004-…          <- the identity E7e/g patched
  0x18c7 obj 'CONTENTS' [ … 'LFO' [
      0x0e3d ROUTING_TARGET = 'CONTENTS/F1FREQ'   <- a plain string
      0x0124 range_lo = -36   0x0125 range_hi = 36
      0x0e32 amount   = 0.5
  ] ]
}
```

⚠ **Field ids are numeric keys into a schema that is NOT recoverable by
inspection** — `bitwig.jar` is obfuscated across ~17k classes with no plaintext
field names, and the native audio engine has none either. Ids are therefore
reported raw; only the handful that matter are named.

⚠ **Known reader limitation:** a full tree dump stops partway. After an object's
terminator the next `u32` is ambiguous — next list item's classId, or parent's
next field id, both non-zero — and the real decoder disambiguates from the
schema. **This does not limit targeted editing**, which never needs a complete
parse: locate a length-prefixed string, rewrite it.

### Finding C — retargeting works, and is variable-length (●)

Two-sided by design: the modulation must **leave** the old target *and*
**arrive** at the new one. "Left the old target" alone is equally consistent
with a corrupted file that silently dropped the route.

| probe | edit | Δ size | old target | new target |
|---|---|---|---|---|
| e10 | `CONTENTS/F1FREQ` → `CONTENTS/F1RESO` | 0 | 0.4665 → **0.0000** | 0.0000 → **0.3948** |
| e10b | → `CONTENTS/OSC1_PITCH` | **+4** | **0.0000** | **0.5000** |
| e10b | → `CONTENTS/NOISE` | **−1** | **0.0000** | **1.0000** |

(divergence = `|modulatedValue − value|`)

**The variable-length result also confirms the format inference.** Inserting or
removing bytes shifts everything after the edit, and Bitwig still honours it ⇒
the `u32` after a `0x09`/`0x12` type byte really is a **classId, not a byte
length**. Nothing in the container encodes an absolute offset or a span an edit
could invalidate, and the meta `revision_id` hash is **not validated** (e10
changed content without touching it). ⇒ **a length-changing edit needs NO
enclosing fixups — only the edited string's own u32 prefix.**

⚠ **`CONTENTS/<param_id>` is NOT a universal path rule.** `CONTENTS/GAIN` loaded
cleanly and silently carried **no** modulation despite `GAIN` being enumerable
(it sits among the nested `EFFECT_CHAIN` strings, so its real path is deeper). A
wrong path is a **silent no-op**, like every other insert trap in this spike ⇒
**every retarget must be confirmed by readback.**

### Method note — a false negative caught twice in one experiment

Both of this experiment's initial FAILs were **wrong test expectations, not
results** (the standing rule, again):

1. `e10`'s first run failed its **own baseline**. It measured modulation as
   *movement over time*, but modtest's LFO is **transport-synced**, so with the
   transport stopped it holds a fixed phase — diverging strongly while never
   moving. Had only the patched phase been run, `F1FREQ: 0.0000` would have read
   as "the edit destroyed the route" and been recorded ○. **Measure divergence
   (E7 Finding B), never movement.**
2. `e10b`'s first SHORTER case used `CONTENTS/PAN` and failed — but its separate
   *target-is-enumerable* sanity check showed `PAN` is not enumerable at all. A
   bad fixture, not a negative. It only stayed distinguishable because the probe
   asserts "target exists" separately from "route landed".

⇒ **keep asserting fixture validity separately from the hypothesis**; it is what
stops a broken fixture from being written down as a capability ○.

### Decision impact → DECISIONS / PROJECT_PLAN

- **E7 Finding F is overturned for the template-authoring path.** Routing-target
  change remains ○ at **runtime** (the map idiom is inert, even foregrounded —
  that stands), but it is ● at **template-build time**, via a string edit. E7's
  error was generalising "no runtime path" to "needs hazardous binary topology
  surgery". Retargeting is the same edit class as E4g's device-GUID swap —
  substitution into a structurally valid file — not the structural atom splicing
  that crashes Bitwig.
- **E7 Finding H's slot-bank collapses on the target axis.** It sized templates
  as `N targets × M types` of dormant pre-wired modulators *because targets were
  believed fixed at authoring time*. They are not. **One template per modulator
  TYPE now covers every target.** The remaining explosion is `type` alone.
- **The target set is no longer "curated, not arbitrary"** — the residual noted
  in Finding H is lifted, subject to the readback rule above.
- **Carry-forward:** `tools/bwformat/bwparse.py` (container reader +
  `patch_string` length-aware editor) joins the templating helper on the Phase-1
  list. The GUID-substitution helper (E4f/E4g) and this share one home.

### Limits of this evidence (do not over-read)

Verified on **one** fixture: modtest.bwpreset, one Polysynth, one LFO modulator,
three targets on the same device. **Not** tested: adding a route where none
exists (that means synthesising new objects, not editing a string — genuinely
the crash-prone end); targets reaching **across** devices in a chain; other
modulator types or host devices. E7g's modulator-GUID-swap ○ still stands and is
now *explained* — a modulator carries a type-specific `CONTENTS` payload
alongside its GUID, so a bare 16-byte swap leaves LFO-shaped payload under
another type's identity.

---
