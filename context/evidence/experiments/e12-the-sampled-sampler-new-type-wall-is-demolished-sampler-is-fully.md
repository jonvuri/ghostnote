---
id: E12
kind: evidence
state: active
source: FINDINGS.md
---

# E12 — the sampled-Sampler "new-type wall" is DEMOLISHED; Sampler is fully general (Tier 1 + stub relocation) [K] (2026-07-24)

**Verdict: ● the E11d "sampled Sampler blocks new modulator types" wall was NEVER
REAL — it was a wrong-delta artifact (E11d only ever swept `±0x10`, but each
modulator has its OWN object footprint) compounded, on multisample, by an
incomplete stub relocation. With the correct model, EVERY op — add (same type),
add (NEW type), replace/type-swap, delete, duplicate-at-scale — LOADS and is LIVE
on a sampled Sampler, single-sample AND multisample. There is NO per-type mirrored
state in the sample; the Sampler collapses into Tier 1 given one mechanical
relocation step.** This is the fourth "wall" in the spike to fall to a clean
control (after E10e category, E11d Sampler-as-device, E11i Zebra) — the user's
distrust of the wall was correct. Tools: `tools/bwformat/build_e12{a,a2,c_golden,
d,d2,e}*.py` + `walk2.py`, probe `brain/src/probes/e11-load.ts`, on fixtures
`gn_sampler_{bare,one_lfo,one_random,lfo_random,no_sample}`, `gn_sampler2_{bare,
one_lfo}`, `gn_sampler_multi_{bare,one_lfo}` (Priority-1/2 pairs authored this session).

### The corrected model — object-index reference stubs, relocated by footprint [K]

A **sampled** preset embeds sample state containing **count-field lists** (field
ids `0x129c`, `0x1422`; value type `0x12` list). Each list holds one or more
**class-1 reference stubs** and ends with the empty class-3 sentinel:

```
field 0x129c | type 0x12 | [ 00 00 00 01  <BE-u32 payload> ]+  | 00 00 00 03 00 00 00 00
             (list)         └ class-1 stub: classId=1, then an OBJECT-INDEX u32 ┘   (sentinel)
```

- Each stub's payload is an **object index** (a linker-style pointer) to an object
  that sits AFTER the modulator list in stream order. Inserting/removing a
  modulator shifts those indices by the modulator subtree's **object footprint**,
  so every stub must be deltaed by `(inserted footprint − removed footprint)`.
- **Payload is BIG-ENDIAN** (E11d's "little-endian u32 count" read the same small
  number by single-byte coincidence; it breaks past 0xff — use BE).
- **Footprint is donor-specific** (the exact object's count, not the type):
  LFO donor = **0x10**, native Sampler Random = **0x0d**, Polysynth Random donor
  = **0x0b**. So `bwmod` must know each curated donor's footprint (measure/store
  per asset — the full recursive object walk hits the documented deep-list schema
  limit, §11 KNOWN LIMITATION, so a stored constant is the robust source).
- **Stub COUNT scales with sample complexity:** single sample = 2 stubs (one per
  count list); a multisample (≥2 zones) = more (measured: 2 in the `0x129c` region
  + 2 in the `0x1422` list = 4). The rule is **relocate EVERY class-1 stub in EVERY
  count list** — a signature-based "first stub only" relocation silently rejects
  multisample.
- **A sample-less Sampler has NO count lists** (`gn_sampler_no_sample`), so it needs
  no relocation — it is plain Tier 1 (E11d-2, unchanged).

### E12a — the wall is a wrong-delta artifact; delta = object footprint, EXACT [K]

Sweeping the stub delta for add-Random-to-one_lfo: LOADS at **+0x0b** (the Poly
Random donor's footprint) and rejects at every neighbour incl. E11d's **+0x10**.
Triangulated (each op loads at exactly ONE delta, rejects at both neighbours):

| op | rejects | **LOADS** | rejects | meaning |
|---|---|---|---|---|
| add 2nd LFO | 0x0f | **+0x10** | 0x11 | LFO footprint 0x10 |
| **add Random (NEW type)** | 0x0a | **+0x0b** | 0x0c | Random-donor footprint 0x0b |
| replace LFO→Random | −0x04 | **−0x05** | −0x06 | = −0x10 + 0x0b (net) |

All loads are LIVE (Amp EG/Attack diverges). ⇒ E11d's "new-type genuinely blocked
even with the count fix" was purely because it never tried the Random-sized delta.

### E12b — mechanism: the count fields are lists of class-1 object-reference stubs [K]

Byte-level: `0x129c`/`0x1422` are `0x12` lists; each item is `00 00 00 01`
(classId 1) + a BE-u32 payload; the list ends at the class-3 sentinel. A class-1
stub holding a u32, in a format with no other classId-1 usage, is an object
reference. Independent corroboration: a field-walk of the LFO donor reaches exactly
**16 objects** (=0x10, the LFO footprint) before the modulator's trailing scalar
fields (`0x1a1a`, then `0x1a1b` instanceId) begin. The full recursive walk still
stalls inside deeply-nested modulator param lists (the documented schema limit) —
not needed; the count-list grammar is now fully cracked. `walk2.py` is the scratch
walker; the count-list handling is the port-source for `bwmod`'s relocation step.

### E12c — no per-type mirrored state; golden reconstruction loads [K]

Device-body diff of real `one_lfo` vs `one_random` (modulator objects excised):
the **ONLY** structural difference is the two stub values (`0x29→0x26`,
`0x2a→0x27`); everything else is the meta type-GUID, the embedded name, and
per-save GUID/hash volatiles. **There is no per-type state** — refuting E11d's "the
sample keeps per-type internal state surgery cannot reconstruct." Golden test
(E10f standard): reconstructing `one_lfo` from sample-only `bare` (insert native
donor → meta ref → f4 → relocate +0x10) is **byte-identical except the embedded
name**; reconstructing `one_random` (+0x0d, a NEW type from a sample-only template)
differs only in name + per-save GUIDs. Both reconstructions **LOAD** (`[LFO]` live,
`[Random]`).

### E12d — base constant across samples; multisample general [K]

- **Base is constant:** `gn_sampler2` (a different single sample) has the same
  base `0x19/0x1a` and behaves identically (add/new-type/delete all load). ⇒
  `bwmod` needs only deltas, never an absolute base.
- **Multisample:** `gn_sampler_multi` (≥2 zones) has **4** stubs. Relocating only
  the signature-matched 3 → REJECT; relocating **all 4** (BE, every class-1 item in
  every count list) by the footprint → add-LFO, **add-Random (new type)**, delete
  all LOAD and are live. Settles DECISIONS Q1 (multisample = more stubs, same rule)
  + Q2 (base constant).

### E12e — full slot-bank surgery within a sampled ≥2-type template, at scale [K]

On `gn_sampler_lfo_random` (LFO id 0 + Random id 1), with complete relocation:
duplicate (+2 LFO +2 Random → 6 modulators), scale (+6 LFO → 8), delete the
Random, and retune (retarget the LFO route CONTENTS/AMP_ATTACK_TIME →
…/AMP_DECAY_TIME — stream-only, **NO** relocation, since no object is added/removed).
**All LOAD and are LIVE.** ⇒ the E7 Finding-H slot-bank is fully surgery-reachable
on a sampled preset — no human authoring required.

### E12f — sample-load recombination works, and Bitwig CONFIRMS our footprints [K]

Authored LFO + Random on a **sample-less** Sampler (`gn_sampler_no_sample` — count
lists empty/absent, Tier 1, no relocation) → loaded onto gn-A → **user dragged a
sample in the UI and saved** as `gn_sampler_recomb`. Parsing the saved file: both
modulators kept (meta refs `[LFO, Random]`, ids `[0,1]`, pages `LFO`+`Random`), the
sample is embedded, AND Bitwig **materialised the count stubs at exactly the predicted
values — `0x129c=0x36`, `0x1422=0x37` = base `0x19/0x1a` + LFO `0x10` + Random `0x0d`**.
Reload round-trips (loads `[LFO, Random]`, live Attack 0.379). ⇒ (a) the "author
sample-less, then add the sample in the UI" workflow yields a **consistent preset
carrying BOTH** a sample and surgical modulators; and (b) **Bitwig computes the stubs
with the same footprints we reverse-engineered** — an independent, from-Bitwig's-side
validation of the whole relocation model. Resolves DECISIONS Q4 (the last open Tier-2
question). Probe `e11g-load.ts` (interactive load-and-leave) + reload via `e11-load.ts`.

### Decision impact

- **Tier 2 is not a capability limit — it is "Tier 1 + stub relocation".** Retire
  the "new-type block" and the "sampled slot-bank must be human-authored" claims.
  Gate on "embeds a sample/bulk blob" only to decide *whether to run the relocation
  step*, not *whether an op is possible*.
- **`bwmod` Tier-2 handler:** on add/delete/replace, delta EVERY class-1 stub in
  EVERY count list (`0x129c`/`0x1422`, BE payloads, walk items to the class-3
  sentinel) by `(inserted − removed) footprint`. Footprint is per-donor — store it
  with each curated donor asset. Retarget/setAmount need no relocation.
- **E12f RESOLVED (below):** sample-load recombination works and Bitwig materialises
  the stubs at our exact predicted footprints. The only residual is footprints for
  other embedded-bulk devices (convolution IR, wavetable/Grid) — untested but now
  lower-risk (the heuristic is "relocate reference stubs", not "give up").

---
