# ghostnote spike — findings log

One section per experiment, appended as run. Verdicts: ● confirmed working /
◐ partial / ○ failed or unavailable.

---

## E13 — `bwmod` is BUILT: the byte recipes are a tested TS library, green offline and live [K] (2026-07-24)

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

## E12 — the sampled-Sampler "new-type wall" is DEMOLISHED; Sampler is fully general (Tier 1 + stub relocation) [K] (2026-07-24)

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

## E11g — surgically-authored modulators SURVIVE project save + Bitwig restart [K] (2026-07-24)

**Verdict: ● a modulator added by pure file surgery persists through a full project
save → Bitwig quit → relaunch → reopen. It is not a load-time-only illusion: Bitwig
accepts the surgical device as first-class, RE-SERIALISES it into the project on save
(in its own canonical form), and re-parses it cleanly on a cold restart. This retires
E4h's standing "everything is verified in-session only" caveat for modulator
authoring.** Probes `e11g-load.ts` / `e11g-verify.ts`, driven interactively.

- **Method:** built `mp_one_lfo` + a surgically-added **Random** (sentinel-correct
  recipe) → `insertFile` onto gn-A → confirmed modulator pages `[…, LFO, Random]` →
  user saved the project, fully quit Bitwig, relaunched, reopened → reconnected the
  bridge and read gn-A back.
- **Result:** gn-A returned exactly one `Polysynth` whose remote pages still include
  **both `LFO` and `Random`**. A fresh Polysynth has zero modulator pages, so the
  surviving `[LFO, Random]` set can only be the persisted surgical topology — no
  ambiguity. The round-trip through Bitwig's *own* serializer (save re-writes the
  device) is a stronger guarantee than a mere in-session load.
- **Decision impact:** durability is settled — `bwmod`-authored presets are real,
  saveable, portable project content, not transient. Combined with E4h (templates
  ship as build-time assets, deletable after load), modulator authoring is fully
  first-class end-to-end. No caveat outstanding.

---

## E11e — cross-device routing works from CONTAINER modulators, and is SYNTHESISABLE + live [K] (2026-07-24)

**Verdict: ● a modulator on a CONTAINER device (Chain/layer) can target a param in a
DIFFERENT device nested inside it, via a structured `0x0e3d` path — and that route is
SYNTHESISABLE by the ordinary retarget (rewrite `0x0e3d`), producing LIVE modulation on
the chosen nested device+param. Simple (non-container) devices cannot cross-route at
all (user-confirmed — a modulator only reaches its own device).** Probe `e11e-live.ts`
+ retarget builder, on user-authored `gn_crossdev_outer` (Chain ⊃ Polysynth→Delay+, an
outer LFO routed to the inner Delay+ Mix).

### The cross-device path form [K]
```
CONTENTS/DEVICE_CHAIN/Chain/DEVICE_CHAIN/1:CONTENTS/MIX
└container contents┘└─ nested device chain ─┘└idx┘└ nested device param ┘
```
`CONTENTS/DEVICE_CHAIN/<ContainerName>/DEVICE_CHAIN/<deviceIndex>:CONTENTS/<PARAM>` —
`<deviceIndex>` selects the device within the container's chain (`0`=Polysynth,
`1`=Delay+), then `CONTENTS/<PARAM>` is the same per-device path form as a top-level
route (native `CONTENTS/<NAME>`; a nested CLAP/VST would use its `ROOT_GENERIC_MODULE/
PID<hex>` tail). Compare single-device forms: native `CONTENTS/F1FREQ`, CLAP
`CONTENTS/ROOT_GENERIC_MODULE/PID<hex>` (E4b/E11d).

### Synthesis is live, not just loadable [K]
Retargeting the outer LFO to three targets — all LOAD; liveness read by descending the
device cursor into the container's `CHAIN` slot (`devcursor.selectFirstInSlot{slot:"CHAIN"}`)
and scanning the nested device's remote pages for `modulatedValue ≠ value`:

| synthesized route | loads | live on nested device |
|---|---|---|
| `…/1:CONTENTS/MIX` (control, Delay+) | ● | (target is 2nd device; not scanned) |
| `…/1:CONTENTS/BLUR` (Delay+, other param) | ● | — |
| **`…/0:CONTENTS/F1FREQ`** (the OTHER nested device, Polysynth) | ● | ● **`FILTER/Filt Freq` diverges 0.002** |

Rewriting the path to point at a *different nested device and param* (Polysynth
`F1FREQ`) yields real modulation there — a wrong path would read exactly `0.000`
(silent no-op, E10b). So the container-modulator target set is **arbitrary within the
container** (any nested device by index, any of its params), reachable by the standard
`0x0e3d` retarget — not a curated set.

### Decision impact
- **Cross-device modulation is authored the same way as any route** — `bwmod.retarget`
  handles it with no new primitive; only the path *form* is richer
  (`DEVICE_CHAIN/<name>/DEVICE_CHAIN/<idx>:CONTENTS/<param>`). Same readback caveat
  (a bad path is a silent no-op — verify live).
- **The modulator must live on a container** (Chain/Instrument-Layer/FX-Layer); a
  simple device's modulator is confined to that device. So a patch that wants
  cross-device modulation must wrap the targets in a container (the E4d/E10d container
  work already gives us those).
- Confirms the E7-era "target set is arbitrary vs curated" question → **arbitrary**
  (for container modulators, within the container).
- Gotcha: nested-device modulation is invisible to a container-scoped `remote.list`;
  readback must descend into the nested device (`selectFirstInSlot`) — the container's
  own pages only show its modulator, not the target.

---

## E11h — the modulator list is SENTINEL-terminated; this was the real gap (and killed the "Zebra wall") [K] (2026-07-24)

**Verdict: ● the `0x1a46` modulator list ends with an empty `cls 0x0003` SENTINEL
object — the 8 bytes `00 00 00 03 00 00 00 00` — NOT a bare `classId 0`. This one
fact (a) explains the phantom "unmapped stream types `0x02/0x06/0x1a`" (they were
parser DESYNC artifacts, not real types), (b) completes the parser's top-level list
handling, and (c) exposed a 2-byte object-bounds bug that had manufactured the
entire E11i "Zebra wall" (see the corrected E11i below).** Tools: `bwparse.py`
(now sentinel-aware), `walk.py` (scratch field-walker), on `mp_bare`/`mp_one_lfo`/
`modtest` (0/1/3 modulators) + the Zebra fixtures.

### The list grammar, corrected

```
list (type 0x12) := object*  +  00 00 00 03 00 00 00 00    (empty cls-0x0003 sentinel)
  0 modulators:  <sentinel only>
  1 modulator :  [0x06c9 object] <sentinel>
  3 modulators:  [obj][obj][obj] <sentinel>
```

Measured directly: `mp_bare`'s `0x1a46` content is exactly the 8 sentinel bytes;
`mp_one_lfo` is `[06c9 modulator]` + sentinel; `modtest` is three `06c9` objects +
sentinel. The old grammar in the spec (`list := object* u32(0)`) was WRONG — there
is no bare `classId 0` terminator; the parser read the sentinel's `0x0003` classId
as a real list item and ran off the rails, which surfaced as the bogus
"unknown type 0x1a/0x02/0x06" stalls. `bwparse.py` now stops a list on the sentinel
(fallback to `classId 0`) and walks the whole top-level modulator list.

### The bug it exposed — object bounds must END at the sentinel

`build_e11i/e11d`'s extractor took the object's end from difflib's `insert`
boundary. That boundary can land **2 bytes INTO the sentinel** (the object's
trailing `00`s alias the sentinel's leading `00`s), leaving a corrupted
`00 03 00 00 00 00 00 00` → Bitwig rejects the whole preset. Fix: snap the object
end to the `00 00 00 03 00 00 00 00` sentinel (`build_e11i_cases.py`,
`build_e11d_recheck.py`). ⚠ The bug is **alignment-dependent** — it only triggered
for Zebra's boundary bytes; Delay+/Repro/sample-less-Sampler aligned exactly (0
offset) and loaded even with the buggy extractor. That is exactly what made it a
dangerous latent trap: works on most hosts, silently corrupts a few.

### Decision impact
- **`bwmod` MUST snap modulator-object bounds to the sentinel** and insert new
  objects BEFORE it — never trust a diff/insert boundary. This is a hard correctness
  rule (a golden test should assert the sentinel is intact after every edit).
- BWFORMAT_SPEC §3 list grammar updated: sentinel terminator, not `classId 0`.
- Full RECURSIVE parsing (nested lists inside a modulator's CONTENTS) still stalls
  deeper (a `type 0x00` desync) — genuinely schema-limited (the documented KNOWN
  LIMITATION) and NOT needed: `bwmod` uses targeted/diff bounds, now sentinel-aware.
- Gotcha for §11: the "unmapped types 0x02/0x06/0x1a" are retired — they never
  existed as value types; they were sentinel-desync noise.
- **Sheds light on E10d (layer chains):** `CHAIN_LIST` is a `0x12` list (field
  `0x08e0`) and a cls-0x0003 sentinel sits after the last chain — so E10d's "the last
  chain has no exact end" limitation is very likely LIFTABLE via a sentinel-aware
  parse (would make last-chain deletion precise, not just "drop earlier chains").
  Not fully confirmed (chains nest — 14× `0x018f` for a 4-chain template), but a solid
  lead when chain-surgery is needed. Scope-checked the rest: E10f's byte-identical
  golden proves Polysynth extraction was 0-offset, so E10f/E11a/b/c/f are unaffected;
  the only bug-exposed rejects were Sampler (real) + Zebra (phantom), both re-checked.

---

## E11i — CORRECTED: the "Zebra wall" was a phantom; Zebra 3 is FULLY surgery-general (CLAP + VST3) [K] (2026-07-24)

> **⚠ This OVERTURNS the original E11i (2026-07-23), which claimed Zebra rejects all
> modulator-set surgery via an "opaque topology mirror" and invented a "tier-3".
> That was entirely a 2-byte list-SENTINEL corruption bug in the test extractor
> (E11h). There is NO tier-3, NO opaque-topology hazard, and CLAP-vs-VST3 is not an
> axis. The wrong entry is deleted; this is the record.**

**Verdict: ● with sentinel-correct object bounds, EVERY modulator-set op — add
(same type), add (NEW type), replace/type-swap, delete — LOADS on Zebra 3 in BOTH
CLAP and VST3, exactly like native/Repro-5. A plugin's opaque embedded state
(Zebra ships a DEFLATE ZIP `plugin-states/<GUID>.clap-preset`) is NOT a modulator-
surgery hazard.** Probe `e11-load` + `tools/bwformat/build_e11i_cases.py` (sentinel
fix), on `gn_zebra3{clap,vst}_{bare,one_lfo}`.

| op | Zebra3 CLAP | Zebra3 VST3 |
|---|---|---|
| add 2nd LFO (same type) | ● `[LFO 1, LFO 2]` | ● `[LFO 1, LFO 2]` |
| **add Random (NEW type)** | ● `[LFO, Random]` | ● `[LFO, Random]` |
| replace LFO→Random | ● `[Random]` | ● `[Random]` |
| delete | ● empty | ● empty |

### What was really going on (post-mortem of five wrong readings)
The original entry chased the reject through five confident-wrong theories, each
killed by a control — the spike's recurring lesson, this time on the tester:
1. "opaque ZIP mirrors the modulator" → **refuted**: swapping bare's 0-mod plugin
   state under a 1-mod object stream (GUID-relinked) LOADS. The ZIP payload delta
   bare↔one_lfo is just a per-save GUID + timestamp nonce; it does not gate anything.
   (`f6` merely points at the ZIP; it slides when the object is inserted ahead of it.)
2. "`0x07b1` companion object is the gate" → **refuted**: every host has one
   (`"Filter"`/`"Tone"`/`"LFO"`); removing it from a loading preset still loads.
3. "`0x131a` registration record is the gate" → **refuted**: removing it changed
   nothing.
4. "the `0/1` flag / a counter byte" → **refuted**: reverting both, still rejected.
5. The real cause: the object-bounds extractor was 2 bytes long, corrupting the
   list sentinel (E11h). Fixing the bound → everything loads.

### Decision impact
- **Zebra 3 (CLAP + VST3) is Tier 1 (fully general).** VST/CLAP opaque state does
  not mirror modulator topology. The "embedded-bulk-content hazard" is NOT a plugin
  property.
- **Retarget** (rewrite `0x0e3d`, any length) is confirmed load-safe here too — a
  universal floor, but no longer the *ceiling* on Zebra.
- The tier map collapses to TWO tiers (see the E11d re-check). Delete the invented
  tier-3 everywhere it was written.

---

## E11d RE-CHECK — the sampled-Sampler wall is REAL (not the sentinel bug); two-tier map confirmed [K] (2026-07-24)

**Verdict: ● re-running the sampled-Sampler matrix with sentinel-correct bounds
CONFIRMS E11d-2: same-type add/delete work with the ±0x10 count-u32 fix, and
NEW-TYPE introduction is genuinely BLOCKED — it still rejects even with correct
bounds AND the count fix. Unlike Zebra, this wall is not a test artifact; the
embedded sample really mirrors PER-TYPE modulator state that surgery cannot
synthesise.** Probe `e11-load` + `tools/bwformat/build_e11d_recheck.py`, on the
sampled `gn_sampler_{bare,one_lfo}`.

| op | no count-fix | + count-u32 fix (±0x10) |
|---|---|---|
| add 2nd LFO (same type) | ○ REJECT | ● **LOAD** `[…, LFO 1, LFO 2]` |
| add Random (NEW type) | ○ REJECT | ○ **REJECT** |
| replace LFO→Random | ○ REJECT | ○ REJECT (count unchanged) |
| delete | ○ REJECT | ● **LOAD** |

- The two count-mirror u32s are **little-endian**, value `= base + 0x10·count`
  (`0x129c` base `0x19`, `0x1422` base `0x1a`), located by sigs
  `00 00 12 9c 12 00 00 00 01 00 00 00` / `00 00 14 22 12 …`. add/delete delta both
  by ±`0x10` per modulator (confirms E11c's u32 read; carries past one byte at count 15).
- `0x129c` is **absent on a sample-less Sampler** (`gn_sampler_no_sample`) — the
  count fields are the sample's, so gate on "embeds a sample/bulk blob", not device.

### Decision impact — the FINAL two-tier map
- **Tier 1 — fully general** (plain recipe, all ops incl. NEW type): native
  (Polysynth, Delay+), CLAP (Repro-5), **Zebra 3 (CLAP + VST3)**, sample-less Sampler.
- **Tier 2 — count-mirrored** (same-type add/delete need ±0x10 on both count-u32s;
  NEW-type / type-swap ○): a preset that **embeds a sample/bulk blob** — verified on
  Sampler. Gate on embedded bulk content, NOT device class.
- ~~Tier 3~~ — deleted (Zebra phantom). Plugin opaque state is Tier 1.
- For a Tier-2 slot-bank the modulator *type set* is fixed at author time (the E7
  Finding-H slot-bank shape) — but same-type duplication + retune + delete are
  surgery-reachable within it.

---

## E11d-2 — the Sampler "wall" was the loaded SAMPLE, not the device [K] (2026-07-23)

**Verdict: ● a SAMPLE-LESS Sampler is fully modulator-surgery-general — the plain
3-step recipe adds/replaces/deletes AND introduces NEW types AND holds multiple
types, exactly like Delay+/Repro/Polysynth. The entire E11d Sampler exception was
caused by the embedded sample, whose state mirrors the modulator count and blocks
type introduction. This CORRECTS E11d.** The user caught the confound: the E11d
Sampler fixtures had `7 Reso Chime.aiff` loaded; they authored `gn_sampler_no_sample`
(truly bare) which settled it.

### The evidence

The two count-u32 fields (`0x129c`/`0x1422`) are **absent from a sample-less Sampler**
and are **introduced by loading a sample** — a `no_sample→bare` diff shows the sample
adds its ~731 B data structure *plus* the 8-byte block `01 00 00 00 1a 00 00 00 03 00
00 00 00` (the `0x1422` count field). And `bare` (sample, **0** modulators) already
carries `0x19`/`0x1a` there — so those fields belong to the sample's state and merely
*track* modulator count (`base + 0x10·count`).

On `gn_sampler_no_sample` (no count fields exist), the plain recipe loads everything:

| build (plain 3-step recipe) | result |
|---|---|
| + LFO | ● LOAD |
| + **Random (a NEW type)** | ● **LOAD** — the exact op E11d found impossible on the sampled Sampler |
| + LFO + Random (two distinct types) | ● LOAD |

### Corrected model of the Sampler

- **Sample-less Sampler:** general. Plain recipe, any op, any type, multi-type. No
  count field to maintain. Same as every other host tested.
- **Sampled Sampler:** the embedded sample carries modulator-mirroring state, so
  (a) same-type add/delete needs the two count-u32s deltaed by `±0x10` (E11d/E11c),
  and (b) introducing a NEW type is rejected even with the count fix (the sample's
  state has no entry for the new type; surgery can't synthesise it).

### Decision impact (supersedes E11d's)

- **The Sampler is NOT a host-class exception.** `bwmod`'s plain recipe covers
  Polysynth, native FX, CLAP, **and sample-less Sampler**. The host-gating in
  BWMOD_DESIGN should key on **"does this device embed a sample"**, not on device name.
- **Slot-bank on Sampler is fully achievable by surgery — author it sample-less.** The
  agent can add one modulator of every type to a bare Sampler (ns_add_random_newtype +
  ns_two_types prove new-type + multi-type; E11c's 32-scale extends it). The earlier
  "must be human-authored" conclusion for Sampler is **retracted** for the sample-less
  path.
- **Only when a preset must carry BOTH a sample and surgically-authored modulators**
  do the sampled-Sampler constraints apply: maintain the count-u32s for same-type
  add/delete; new-type introduction on an already-sampled preset is ○. Open question
  [U]: whether authoring modulators sample-less and loading the sample afterward
  recombines cleanly (the sample-load would need to regenerate its mirrored count) —
  untested; likely a runtime/UI path, not file surgery.
- **Residual it opened [RESOLVED by E11i-corrected, 2026-07-24]:** the worry that a
  plugin's opaque state chunk (VST3/CLAP) might mirror modulator state *like the sample*
  is **disproven** — Zebra 3 (VST3 **and** CLAP) is fully surgery-general; its DEFLATE-ZIP
  plugin state does not gate the modulator set. The hazard is specifically an **embedded
  sample/bulk blob**, not plugin opaqueness. Convolution IR / wavetable / nested
  containers remain untested but are lower-suspicion now (the "opaque = hazard" heuristic
  was wrong). The original E11i "opaque topology mirror" reading was a test bug (E11h).
- Credit: the user's `gn_sampler_no_sample` minimal pair is what isolated sample-vs-device.

---

## E11c — surgery scales to 32 modulators on both hosts; Sampler count is a real u32 [K] (2026-07-22)

**Verdict: ● 32 modulators load — on Polysynth (32, five mixed types) and on Sampler
(32 LFO duplicates). No count/limit surprise. The Sampler count field is a genuine
u32 (`base + 0x10·count`) that carries cleanly past the single-byte boundary. A
Sampler's CAPACITY is therefore not the slot-bank blocker — the type-introduction wall
(E11d) is, and scale does not move it.** Probe `e11-load` +
`tools/bwformat/build_e11bc_cases.py`.

| host | build | result |
|---|---|---|
| Polysynth | 8 / 16 / 32 modulators cycling 5 distinct types (LFO, Random, Classic LFO, Vibrato, Expressions) | ● all LOAD |
| Sampler | 8 / 16 / 32 LFO duplicates, count-u32 = `0x99` / `0x119` / `0x219` | ● all LOAD (`LFO 1…LFO 32`) |

- **The Sampler count is a u32, not a byte.** `base + 0x10·count` overflows one byte at
  count 15, but N=16 (`0x00000119`) and N=32 (`0x00000219`) both load — so it carries
  correctly and scales to any realistic slot-bank size. `bwmod`'s Sampler handler
  should read/write it as a u32 (both fields), delta `±0x10` per add/remove. (This
  Sampler scale used the *sampled* fixture — the count u32s exist only because a sample
  is loaded; a sample-less Sampler has no such field and needs no fix. See E11d-2.)
- **This confirms capacity + count-scaling, NOT type introduction.** The Sampler test
  duplicates ONE type (LFO); surgery still cannot add a NEW type to a Sampler (E11d).
  ⇒ on permissive hosts (Polysynth/Delay+/Repro) the agent can build a full multi-type
  slot-bank by surgery outright; on Sampler-class hosts the slot-bank must be
  human-authored once, but this proves such a template is valid at scale and the agent
  can duplicate/delete/retune within it.
- ⚠ **Note-driven types (Expressions) expose no remote page** (seen in E11a too), so
  page-count readback UNDERCOUNTS modulators — the meta-ref / `0x06c9`-object count is
  the true count. Assert on that, not on page names.

---

## E11b — the `0x02b9` name is cosmetic, not validated against the `0x1a1b` id [K] (2026-07-22)

**Verdict: ● a modulator's `0x02b9` display-index name need not match its `0x1a1b`
instance id — both `name="5"/id=1` and `id=5/name="1"` load (ids kept unique). Only
`0x1a1b` uniqueness gates load; the name string is not cross-checked against it.**
Probe `e11-load` + `build_e11bc_cases.py`, one-field edits on modtest.

Resolves the BWMOD_DESIGN §5-U2 open question: `bwmod` may treat `0x02b9` as cosmetic.
Keeping `name == id` remains the tidy default (matches what Bitwig writes), but it is
not a correctness requirement — freeing add/delete from any name-renumbering duty.

---

## E11d — modulator surgery is GENERAL across FX + CLAP, but Sampler REJECTS it [K] (2026-07-22)

> **⚠ PARTIALLY CORRECTED BY E11d-2 (2026-07-23).** The "Sampler is a special case"
> reading below is right about the *sampled* Sampler but wrong to attribute it to the
> device: the E11d Sampler fixtures had a sample loaded, and the sample — not the
> Sampler — is what mirrors modulator count and blocks type introduction. A
> **sample-less** Sampler is fully surgery-general. Read E11d-2 for the corrected
> model. The Delay+/Repro/CLAP results and the count-u32 mechanics below stand.

**Verdict: ● the add/replace/delete recipe generalizes beyond Polysynth to a native
FX (Delay+) and a CLAP plugin (Repro-5) — loads AND lives. Sampler is a special case,
now fully diagnosed: it mirrors modulator state in its own device body, so (a)
add/delete of an ALREADY-PRESENT type works once two count-bytes are maintained, but
(b) introducing a NEW modulator type or type-swapping is rejected — the Sampler keeps
per-type internal state surgery cannot reconstruct.** Probes `e11-load` +
`tools/bwformat/build_e11d_cases.py` (+ follow-up isolation builds), on user-authored
bare/one_lfo minimal pairs for Sampler, Delay+, Repro-5.

### What generalizes (all three hosts, structural — [K])

All three are encoding `0002` (plain/parseable), including the CLAP. The modulator
sub-structure is identical in kind: `0x075f` MODULATORS wrapper, `0x1a46` list,
`0x06c9` object, `0x1a1b` unique id, `0x18c6` type guid (`ad947004` — the LFO type
guid is **host-agnostic**, same bytes everywhere), meta `referenced_modulator_ids`,
`f4`. The routing-target **path form differs exactly where E4b predicted**:

| host | kind | route path form |
|---|---|---|
| Sampler | native instrument | `CONTENTS/AMP_ATTACK_TIME` |
| Delay+ | native FX | `CONTENTS/BLUR` |
| Repro-5 | CLAP plugin | `CONTENTS/ROOT_GENERIC_MODULE/PID3c` (plugin-param id) |

### The load matrix

| case | Sampler | Delay+ | Repro-5 |
|---|---|---|---|
| base (one_lfo) | ● LOAD (live: AmpEG/Attack div 0.38) | ● LOAD (Blur 0.35) | ● LOAD (Cutoff 0.34) |
| add 2nd LFO | ○ **REJECT** | ● LOAD, `[LFO 1, LFO 2]`, Blur div→**0.75** | ● LOAD, `[LFO 1, LFO 2]`, Cutoff→**0.50** |
| replace w/ Random | ○ **REJECT** | ● LOAD, `[Random]` | ● LOAD, `[Random]` |
| delete the modulator | ○ **REJECT** | ● LOAD, LFO page gone | — |

Delay+/Repro: full generality — add stacks a live second route (divergence rises),
replace type-swaps, delete removes. **A CLAP plugin modulator route is authorable by
file surgery**, deeper path form and all.

### Ruling out a construction artifact (the isolation that reopened it)

The standing rule (a FAIL is often a wrong expectation) got a full workout:
- **Object bounds are correct.** The extracted LFO object is 826/837/847 B for
  delay/sampler/repro — differing *exactly* by the routing-string length delta
  (`BLUR` 13, `AMP_ATTACK_TIME` 24 = +11, `…/PID3c` 34 = +21).
- **Meta + f4 machinery is identical** to what loads on Delay+/Repro.
- **Not add-specific: DELETE also rejects on Sampler** while the identical delete
  LOADS on Delay+ — so it is not insertion placement; *any* modulator-list edit
  rejected. This is what pointed at Sampler-internal mirrored state.

### The mechanism, fully diagnosed [K]

A byte-diff of Sampler bare↔one_lfo is otherwise **clean** (3335/3341 stream bytes
equal) — the misleadingly-tiny 8-byte common *suffix* was just two late 1-byte diffs.
Beyond the modulator object + preset-name meta, **exactly two single bytes** in the
Sampler device body change when a modulator is added — and **Delay+ has none**. Both
sit immediately after an identical `[field][0x12 list][classId 1]` structure (fields
`0x129c` and `0x1422`), and both move by **exactly +0x10** per modulator:
`0x19→0x29→0x39` and `0x1a→0x2a→0x3a` for count `0→1→2`. **They encode the modulator
count** (byte = base + 0x10·count).

Confirmed by controlled patch pairs (each differs ONLY in those two bytes):

| built case | flags | result |
|---|---|---|
| delete, flags left at 1-count | 0x29/0x2a | ○ REJECT |
| **delete + flags→0-count** | 0x19/0x1a | ● LOAD (0 modulators) |
| add 2nd LFO, flags left at 1-count | 0x29/0x2a | ○ REJECT |
| **add 2nd LFO + flags→2-count** | 0x39/0x3a | ● LOAD `[LFO 1, LFO 2]` |

So add/delete on Sampler need one extra step: **±0x10 on both count bytes.** The
robust form is a *delta* (no need to know the base), located by the two signatures
`00 00 12 9c 12 00 00 00 01 00 00 00 <byte>` and `00 00 14 22 12 …`.

**But type introduction is a harder wall [K].** Further isolation:
- replace LFO→LFO identical → LOAD; replace with the route **shortened** (object
  shrinks 14 B, size change) → LOAD ⇒ size is not mirrored.
- replace LFO→**Random** (type/guid swap) → REJECT at **every** flag value (0/1/2).
- ADD a **Random** (a type NOT already present) with flags→2 → **REJECT**.

⇒ Adding/removing instances of a type **already present** works; **introducing a new
modulator type, or type-swapping, does not** — the Sampler holds per-type internal
state (registration/routing keyed by modulator type) that file surgery cannot
synthesise. The count bytes are necessary but not sufficient for a new type.

### Decision impact

- **`bwmod` add/replace/delete is verified general on Polysynth + native FX (Delay+)
  + CLAP (Repro-5)** — instrument, effect, and external-plugin axes. NOT
  Polysynth-specific. CLAP/VST routing uses the deeper `CONTENTS/ROOT_GENERIC_MODULE/
  PID<hex>` form, editable like any route — lifting most of E4b's worry.
- **Sampler needs a device-specific handler** in `bwmod`: on add/delete, delta the
  two count bytes by ±0x10 (find them by signature). Load+readback stays mandatory.
- **On Sampler, type set is fixed at template time.** The agent can duplicate,
  delete, and retune modulators of types the template already contains, but cannot
  introduce a new type by surgery. This is exactly the shape of the retired E7
  Finding H **slot-bank** — so for Sampler-class devices the slot-bank (a template
  pre-seeded with one dormant modulator per desired type) is the *right* pattern,
  even though it is retired for Polysynth/FX/CLAP. Other sample/state-heavy natives
  may share this; untested.
- Only two count bytes were seen on this (sample-less) Sampler; a Sampler with loaded
  samples/zones may mirror more state — untested, flag it if pursued.

---

## E11a — `0x1a1b` uniqueness is sufficient; ids need NOT be contiguous [K] (2026-07-22)

**Verdict: ● a unique `0x1a1b` set loads even when sparse or permuted — contiguity
is NOT a load requirement.** So `bwmod` may reuse a freed instance id and `delete`
need not renumber siblings; `next-free = max+1` stays a safe default but is
over-strict, not mandatory. Probe `e11-load` + `tools/bwformat/build_e11a_cases.py`,
one-byte edits on `modtest` (loads at `[0,1,2]`).

Each case edits all three modulators' `0x1a1b` u8 **and** their `0x02b9` name digit
together (kept equal, so this does NOT also test the E11b name/id question):

| case | id/name set | property | result |
|---|---|---|---|
| C0 | `[0,1,2]` | contiguous (control) | ● LOAD |
| A_sparse | `[0,1,5]` | unique, gap at 2..4 | ● LOAD |
| A_high | `[9,4,7]` | unique, none zero, sparse | ● LOAD |
| A_perm | `[2,0,1]` | `{0,1,2}` permuted across slots | ● LOAD |

All four load identically (pages `[…, Vibrato, LFO]` unchanged). The gate proven in
E10f is exactly and only **uniqueness** — not range, not zero-basing, not order.

### Decision impact
- **`bwmod.deleteModulator` need not renumber** the surviving modulators; removing an
  object + its meta ref is enough (ids stay unique, just sparse).
- **`nextFreeInstanceId` = max+1** remains the simple, safe assignment (guaranteed
  unused), now known to be a *convenience*, not a correctness requirement — any
  value absent from the current set is equally valid.
- Removes E10f's "must ids be contiguous?" caveat.

---

## E11f — same-TYPE repeated ADD loads; `addModulator` needs no id-freshening [K] (2026-07-22)

**Verdict: ● two modulators of the SAME type (same donor object) coexist in one
preset and load. A duplicate `0x18c6` device GUID and the duplicate
`referenced_modulator_ids` entry it forces are BOTH accepted by Bitwig.** So the
library's `addModulator` needs **no "freshen embedded ids" step** beyond the
already-proven unique-`0x1a1b` assignment. Probe `e11f-dupdonor` +
`tools/bwformat/build_e11f_cases.py`, on `mp_one_lfo` + repeated Random/LFO donors.

### The handoff's premise was wrong — measurement corrected it first

E11 §1f hypothesised that adding two modulators from the same donor would collide
their per-instance `0x2ab8` "Chain" GUID. **A modulator object embeds no `0x2ab8`
at all** — measured directly: the LFO donor (646B) and Random donor (551B) each
contain exactly one `0x009a`, one `0x18c6`, one `0x1a1b`, and **zero** `0x2ab8`.
The `0x2ab8` count is a fixed **2 per file** regardless of modulator count (modtest
has 3 modulators but 2 `0x2ab8`; `mp_one_lfo` has 1 modulator but 2 `0x2ab8`) — it
is **device/chain-level, not per-modulator**. So same-donor adds never touch it, and
there is nothing to freshen there.

The real per-object ids are only two: `0x1a1b` (unique instance id, the proven gate)
and `0x18c6` (the **type** GUID). `referenced_modulator_ids` == the ordered set of
`0x18c6` values, verbatim. Critically, `0x18c6` is **shared across all instances of
a type** — LFO is `ad947004…` and Random is `bf29a7b0…` in *every* preset examined.
Therefore a same-type add necessarily produces a **duplicate `0x18c6`** in the
stream and a **duplicate entry** in `referenced_modulator_ids`. That is the real
question, and it is now settled: **both duplicates load.** (Freshening `0x18c6` is
not even an option — a random value would no longer name a real modulator type.)

### The matrix (ids kept unique throughout; the single variable is same-type duplication)

| case | edit | `0x1a1b` | `referenced_modulator_ids` | result | pages |
|---|---|---|---|---|---|
| F0 | `mp_one_lfo` unmodified | `[0]` | `[LFO]` | ● LOAD | `[LFO]` |
| F1 | add Random once (control == E10f-B1) | `[0,1]` | `[LFO, Rand]` | ● LOAD | `[LFO, Random]` |
| **F2** | add SAME Random donor **twice** | `[0,1,2]` | `[LFO, Rand, Rand]` | ● LOAD | `[LFO, Random 1, Random 2]` |
| **F3** | add a 2nd **LFO** (dup of existing type) | `[0,1]` | `[LFO, LFO]` | ● LOAD | `[LFO 1, LFO 2]` |

F1 is the add-once control; F2/F3 add a duplicate type. No confound — `0x1a1b`
stayed unique in every case, so the only thing that changed F1→F2/F3 is the
type-duplication (and its forced GUID/meta duplication).

### Side finding — display names are auto-disambiguated by Bitwig, not by us

The `0x02b9` name string we set is the slot index (`"0"/"1"/"2"`). The remote-page
**display** names came back as `"Random 1"/"Random 2"` and `"LFO 1"/"LFO 2"` — and
note the FIRST one is renumbered too (F1 shows bare `"Random"`, F2 shows `"Random
1"`). So the visible page name is derived at runtime from `device_name` + a
duplicate-disambiguation suffix; it is **cosmetic and independent of `0x02b9`**. The
library need not (and should not) try to author these suffixes.

### Decision impact

- **`bwmod.addModulator`/`replaceModulator`: assign a unique `0x1a1b`, append/replace
  the `0x18c6` GUID in `referenced_modulator_ids`, patch `f4` — and nothing else.**
  No embedded-id freshening. Two instances of one type are a supported, first-class
  case (`referenced_modulator_ids` may legitimately contain duplicate GUIDs).
- **BWFORMAT_SPEC §3.2 `0x2ab8` note to sharpen:** it is device/chain-level (fixed
  count per file), NOT a per-modulator field — so it is irrelevant to modulator add.
- Removes E10f's "same donor twice?" caveat. Untested edges remaining: id
  contiguity (E11a), name/id independence (E11b), scale (E11c), non-Polysynth
  hosts (E11d), cross-device routing (E11e), save+reload durability (E11g).

---

## E10 — The `.bwpreset` format is readable, and routing targets are editable (2026-07-20)

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

## E10f — Modulator construction is UNLOCKED; the gate is a unique instance ID (2026-07-21)

**Verdict: ● modulators can be ADDED, REPLACED (any type/category), retargeted,
and deleted by `.bwpreset` surgery. The only load-time invariant is that field
`0x1a1b` — a unique per-modulator instance ID — stay unique. E10e's "category"
gate and E10c's "insertion blocked" are BOTH overturned; they were this one field
all along.** Probe `e10f-addcat` + `tools/bwformat/build_e10f_cases.py`, on
user-authored minimal-pair presets. This collapses E7 Finding H's slot-bank
almost entirely — modulator topology is now agent-constructible from templates.
Credit: the user's minimal-pair presets (and the `_same` methodology control)
are what made the differential analysis possible.

### The controlled matrix (each pair isolates ONE variable)

| test | edit | `0x1a1b` set | result |
|---|---|---|---|
| **M1** | modtest, flip slot-1's `0x1a1b` 1→0 — **one byte, nothing else** | `[0,0,2]` | ○ REJECT |
| C0 | modtest unmodified | `[0,1,2]` | ● load |
| **C1** vs **C1n** | replace modtest slot-1 with Classic LFO | `[0,1,2]` / `[0,0,2]` | ● load / ○ REJECT |
| **B1** vs **B1n** | ADD Random as a 2nd modulator to one_lfo | `[0,1]` / `[0,0]` | ● load / ○ REJECT |
| A1 | replace Expressions(Note-driven) at slot 0 with Classic LFO(LFO) | unique | ● load |

**M1 is the clincher:** a single byte that duplicates an ID turns a loading preset
into a rejected one, with nothing else changed. **C1/C1n and B1/B1n** each differ
*only* in whether `0x1a1b` stays unique. **A1** loads a cross-category swap
(Note-driven → LFO) — category is not a gate.

### What `0x1a1b` is

A **unique per-modulator instance id**, u8, one occurrence per modulator object.
Across every preset examined it is distinct within a file (modtest `[0,1,2]`,
modzoo `[0,1]`, singles `[0]`). It is NOT the display slot (the `0x02b9` name
string is the visible index; they coincide only because none of these presets had
a modulator deleted/reordered). Bitwig validates its uniqueness on load and
**rejects the whole preset on a collision** — the same graceful whole-file refusal
as every other invalid edit, never a crash.

### The full modulator-construction capability (all ● now)

| operation | how | evidence |
|---|---|---|
| retarget a route | rewrite the `0x0e3d` target-path string (any length) | E10/E10b |
| change TYPE / replace | swap the whole object (GUID+payload), **assign a unique `0x1a1b`**, fix meta ref | E10f C1 |
| ADD a modulator | insert object into MODULATORS list, unique `0x1a1b`, append meta ref, patch `f4` | E10f B1 |
| DELETE a modulator | remove the object (+ its meta ref) | E10c/E10d |
| vary settings live | remote-control page writes at runtime | E7d |

The add/replace recipe in full (from `build_e10f_cases.py`, now the reference):
1. object goes into the `MODULATORS` list (field `0x1a46`), objects adjacent, no
   separators, no count field (E10d);
2. its `0x1a1b` **and** `0x02b9` name set to an id unused by any sibling
   (max-existing + 1 is safe);
3. its GUID appended to (or replaced in) meta `referenced_modulator_ids` (a `0x19`
   str[] with a u32 count — bump the count);
4. if meta size changed, patch header `f4` (the only offset pointer; `f5`/`f6` are
   always 0) by the byte delta.

Verified end to end: a `mp_bare → mp_one_lfo` reconstruction was **byte-identical**
to the real Bitwig-saved file except the name and a volatile per-instance "Chain"
GUID (field `0x2ab8`) — so the machinery reproduces exactly what Bitwig writes.

### Method — three wrong turns, each caught by isolation (the spike's whole thesis, again)

This experiment reached the right answer only after **three** confident-but-wrong
readings, every one killed by a cleaner control:
1. **"Category is the gate" (E10e).** Spurious: slot-0 replaces happened to
   preserve id-uniqueness; the slot-1 one didn't. A1 (cross-category, unique ids →
   load) killed it.
2. **"Slot position is the gate."** A1 loads at slot 0, C1 loads at slot 1 — both
   fine once ids are unique. Position never mattered.
3. **"`0x1a1b` = slot position, must equal the index."** Wrong: it is an
   *instance id*, only required unique. A broken B1n control (a stale
   pre-rename gave it a unique id by accident, so it loaded and muddied the
   picture) hid this for one run; fixing the control gave the clean
   unique-vs-duplicate split. **The one-byte M1 test is what made it
   incontrovertible** — change exactly one thing, observe exactly one flip.

⚠ Untested edges (do not overclaim): whether ids must also be *contiguous* or may
be sparse (all evidence is contiguous-from-0); whether the `0x02b9` name string is
independently validated (it was kept equal to `0x1a1b` in every passing case);
scale beyond 3 modulators; and non-Polysynth hosts. The per-instance "Chain" GUID
(`0x2ab8`) regenerates per save but was NOT required unique for a load here.

### Decision impact → DECISIONS / PROJECT_PLAN (significant)

- **E7 Finding H's slot-bank is largely retired.** The agent does not need a fat
  template of dormant pre-wired modulators. It can **add, remove, type-swap, and
  retarget modulators directly** on a `.bwpreset` from a plain template, then
  `insertFile`. One small template per device (or even a bare device) suffices;
  the modulation graph is constructed by file surgery + verified by remote-page
  readback (E7d), all length-free.
- **Modulator authoring joins device/param authoring as a template-time
  capability.** The remaining hard ○ is unchanged: no *runtime* API for any of
  this (E7 Finding 0/F), and no save/export API (E4f) — templates still originate
  from a human, but now a *minimal* one, not a curated matrix.
- **Carry-forward:** promote `build_e10f_cases.py`'s primitives into a
  `tools/bwformat` modulator library (`list_modulators`, `next_free_id`,
  `add/replace/delete/retarget`, meta+`f4` maintenance). It is Phase-1/2 quality;
  the byte offsets and the `0x1a1b`/meta/`f4` invariants are the spec.
- **The invariant to enforce in code:** every modulator's `0x1a1b` unique; meta
  `referenced_modulator_ids` in sync with the object set; `f4` = meta end. Always
  verify by load + remote-page readback (a duplicate id fails the whole file
  silently — the standing readback rule).

---

## E10e — TYPE substitution: the "category" reading was WRONG (see E10f) (2026-07-21)
> **⚠ CORRECTED BY E10f (2026-07-21).** This entry concluded type substitution is
> gated by modulator **category** (`0x009c`). That was a **spurious correlation**.
> E10f isolated the real invariant: a unique per-modulator instance id (`0x1a1b`).
> E10e-R1/R2 replaced a slot-0 modulator whose id (0) matched the donor's, keeping
> ids unique → load; E10e-R3 replaced a slot-1 modulator, so the donor's id (0)
> **collided** with the slot-0 modulator's id (0) → duplicate → reject. Category
> tracked the outcome only because the donor's native id happened to be 0. Type
> substitution works **across categories** (E10f-A1), at any slot, given a unique
> id. Read the mechanics below, but take the verdict from E10f. The length-vs-gate
> reasoning (R1/R2/R3) and the "length is not the gate" result remain correct.

### E10e original writeup (mechanics still valid; the "category" verdict is not)

**Verdict: ◐→● type substitution works by whole-object replacement WITHIN a
modulator category; the earlier ○ was a cross-category confound, not a real
wall.** E10c concluded "the container rejects object INSERTION outright" from a
`Expressions → Classic LFO` replace that failed. That was three confounds in a
trench coat — length, donor-foreignness, and content. Isolating them shows the
real gate is **category compatibility**, and same-category replacement loads
cleanly at any length. Probe `e10e-replace`, all green. This **reopens the type
axis of E7 Finding H** (partly). Credit: the user pushed for the length-isolated
replace test and the minimal-pair strategy that will finish the job.

### The isolation

`insertFile` of modtest (Polysynth + Vibrato[LFO] + Expressions[Note-driven] +
LFO), each variant a whole-object replace with meta `referenced_modulator_ids`
repaired. Donor length tuned by padding an empty string field (E10b's trick):

| variant | replace | Δlen | result |
|---|---|---|---|
| S1 | pad modtest's own LFO object in place (no replace) | +80 | ● loads (padding is neutral) |
| R1 | Vibrato[LFO,slot0] ← **Classic LFO[LFO]**, padded to EXACT 773B | **0** | ● loads, live Classic LFO |
| R2 | Vibrato[LFO,slot0] ← **Classic LFO[LFO]**, native 579B | **−194** | ● loads, live Classic LFO |
| R3 | Expressions[**Note-driven**,slot1] ← Classic LFO[LFO] (E10c repro) | **+120** | ○ whole preset rejected |

**Length is decisively OUT:** R2 loads *shorter*, R3 rejects *longer*. And in
R1/R2 the Classic LFO **instantiated live** — its own remote page appeared and
the untouched slot-2 LFO→F1FREQ route survived. This is the exact swap E7g got
"Missing" from (GUID-only), now working because the whole object (GUID + payload)
moves together.

### Why E10c was wrong — the category field

All five modulators (Vibrato, Expressions, LFO, Classic LFO, Random) share
**classId `0x06c9`**, so class does not gate it. The field that splits the result
is **category (`0x009c`)**:

| modulator | category | as donor into an LFO slot |
|---|---|---|
| Vibrato, LFO, Classic LFO, Random | `LFO` | ● works |
| Expressions | `Note-driven` | ○ rejected |

E10c's `Expressions → Classic LFO` and E7g's cross-family GUID swaps were all
**`Note-driven`/other ↔ `LFO`** — category mismatches. The container appears to
reject a modulator whose category is incompatible with its slot/context. A
Note-driven modulator taps the note stream; an LFO is free-running — plausibly a
different connection shape the graph won't accept in that position.

### ⚠ Open confound — category vs slot POSITION (hands off to minimal-pair presets)

R1/R2 replace **slot 0**; R3 replaces **slot 1**. Both donor presets carry ONLY
`LFO`-category modulators, so "same category" and "slot 0" cannot be separated
with current fixtures, and neither can "cross category" from "slot 1". The
competing hypothesis — *replace works only at slot 0* — is not yet excluded.
**This is the single open question.** It needs minimal-pair presets specifically:
a `Note-driven` modulator at **slot 0**, and an `LFO` at **slot 1**. Then:
`Note[slot0] ← LFO` failing would confirm category; `LFO[slot1] ← LFO` loading
would kill the position hypothesis.

### Decision impact (provisional, pending the confound)

- **The type axis of E7 Finding H shrinks from "impossible" to "within-category".**
  If category is the gate (likely), one template per **category** covers every
  type in it — LFO, Classic LFO, Beat LFO, Steps, Random, etc. are one template,
  not five. That is a large reduction, short of fully free but far from E10c's ○.
- **E10c's headline claim is corrected**, not deleted: object *insertion* (adding
  a modulator, growing the count) is still untested-as-blocked; only *replacement*
  is now shown to work. Deletion (E10c) and replacement (here) both work; adding
  remains the open ✗.
- **`patch`-level type swap** joins the templating helper: replace the whole
  modulator object from a same-category donor, repair `referenced_modulator_ids`,
  verify by remote-page readback. Length-free.

### Method note — the contradiction WAS the finding (again)

The first e10e run (R1/R2 only) concluded "replace works at ANY length" and would
have been recorded as flatly contradicting E10c. Adding R3 — the exact E10c
scenario — reproduced the rejection and revealed the category boundary hiding
under the length variable. **Reproducing the prior result inside the new harness
is what converted a contradiction into the actual mechanism.** Do not record a
"we overturned X" without re-running X's exact case in the new setup.

---

## E10c — Modulator TYPE substitution: GUID+payload does NOT solve it (2026-07-20)
> **⚠ SUPERSEDED IN PART by E10e (2026-07-21).** E10c's "the container rejects
> object INSERTION outright" over-generalised from a single **cross-category**
> replace (`Expressions[Note-driven] → Classic LFO[LFO]`). E10e shows
> **same-category REPLACE works** at any length; the rejection E10c saw is a
> category-compatibility gate, not a blanket insertion block. E10c's DELETE
> result and the still-open *add-a-modulator* (grow the count) question stand.
> Read E10c's mechanics below, but take its verdict from E10e.

**Verdict: ○ type substitution stays closed — but for a completely different
reason than E7g assumed, and modulator DELETION is ● as a side effect.** E10
explained E7g's GUID-only failure as "the payload is type-specific, so swap
both". That explanation was right about the mechanism and **wrong about the
remedy**: splicing the whole modulator object (GUID *and* payload together) does
not work either, because **the container rejects object INSERTION outright**.
Probe `e10c-typeswap`, all green (it asserts the negative). E7 Finding H keeps
one template per modulator type.

### The isolation (the part that matters)

Object bounds come from the MODULATORS list: every item begins
`<u32 classId> 0x02b9 str '<index>'`, so consecutive item starts delimit each
object exactly. Four variants on modtest, replacing/removing the `Expressions`
modulator:

| variant | edit | result |
|---|---|---|
| **DELETE** | drop the `Expressions` object | **● loads** — `Vibrato` + `LFO` pages intact |
| **DUP** | replace it with a same-file `Vibrato` **copy** | ○ whole preset fails to load |
| **FOREIGN** | replace it with modzoo's `Classic LFO` object | ○ whole preset fails to load |
| **FOREIGN + meta** | same, plus `referenced_modulator_ids` repaired | ○ whole preset fails to load |

**DUP is the decisive row.** A well-formed object copied from the *same file*
cannot be malformed, and it is still rejected — so the problem is **insertion
itself**, not the donor, not foreignness, not the GUID/payload pairing. The
`referenced_modulator_ids` repair (a length-preserving ASCII fix, motivated by
E7g's "Missing" GUID being the one absent from that list) changed nothing, so
that hypothesis is dead too.

Failure mode is **whole-preset rejection** (chain EMPTY), which is more severe
than E7g's unwired/page-less/"Missing" — but still **graceful, never a host
crash**, consistent with every substitution-class edit in this spike.

### DELETE is a real capability (●)

Removing exactly `[start, end)` yields a valid preset that loads with the
remaining modulators live. This is worth two things:
1. **It proves the object bounds are byte-exact** — otherwise the file would be
   corrupt. The delimiting rule above is sound.
2. **Modulators can be REMOVED from a template.** A fat donor template can be
   trimmed down, which is the opposite direction from the slot-bank's
   `Amount = 0` dormancy trick and costs nothing at runtime.

### Why the E10 optimism did not carry over

E10/E10b edits were **value-level**: rewrite a string inside an existing object,
including at changed length. Those are fine. E10c is **structure-level**: change
how many objects exist. The container tolerates the first and rejects the second
(except deletion). This is the line E4f drew from the outside — "value/GUID
substitution ≈ safe; new topology ≈ hazardous" — now measured from the inside,
and *sharper*: new topology does not crash, it simply will not load.

⚠ **The mechanism is NOT identified.** Something makes an added object invalid
and it is not size (E10b changed sizes freely), not GUID uniqueness (FOREIGN's
GUID is unique to the file and still failed), and not the meta reference list.
Candidates not yet tested: a per-file object/instance id that must be unique, or
a count//checksum the reader validates. **Do not build on insertion** until this
is understood; it is the one place a wrong assumption could silently produce
files that load but misbehave.

### Decision impact

- **The `type` axis of E7 Finding H stands as the residual explosion.** One
  human-authored template per modulator type; the `target` axis is collapsed by
  E10, the `settings` axis by E7d, and `count` can now only shrink (DELETE), not
  grow.
- **Answers the open question directly:** knowing a modulator's GUID *and* its
  default payload is **not** sufficient. The substitution issue was never an
  information problem, so no amount of harvesting default payloads fixes it.
- **Adds `patch`-level deletion** to the templating helper alongside the string
  editor and GUID substitution.

---

## E10d — Sweep: what else the readable format changes (2026-07-20)

A pass over the earlier findings asking which ones the `.bwpreset` decode
(E10–E10c) actually moves. Two do, one materially. Probe `e10d-chaintrim`, all
green, plus offline analysis.

### Finding A — layer chains can be TRIMMED, collapsing E4f's "template per shape" (●)

E10c's remove-yes/insert-no asymmetry generalises one level up. Chains are
`CHAIN_LIST` items delimited exactly like modulators
(`<u32 classId> 0x02b9 str 'CHAIN<n>'`), and deleting them works. Against the
E4g 4-chain Instrument Layer (Phase-4, Polysynth, Organ, Sampler):

| trim | result |
|---|---|
| drop CHAIN2 (middle) | ● `[Phase-4, Polysynth, Sampler]` |
| drop CHAIN0 (first) | ● `[Polysynth, Organ, Sampler]` |
| drop CHAIN1+CHAIN2 | ● `[Phase-4, Sampler]` |
| drop CHAIN0+CHAIN1+CHAIN2 | ● `[Sampler]` — a 1-chain stack |

⇒ **E4f's "a finite template library, one per SHAPE (2-layer, 3-layer, 4-layer…)"
collapses to ONE wide template plus a trim step.** This does **not** contradict
E4d/E4e — growing a layer container is still impossible, and that reasoned
negative stands untouched. It removes the *need* to grow: author wide once, trim
down per use.

⚠ **The LAST chain cannot be deleted** — it has no exact end, because everything
after it (the list terminator, the enclosing object's remaining fields) belongs
to the parent. Drop the chains *before* it instead; that still reaches N=1.

⚠ **Another probe-bug-as-false-negative, caught only by the position sweep.** The
first run fell back to `b.length` for the last chain's end, cut off the whole
enclosing tail, and Bitwig rejected the file. That reads exactly like "deleting
the last chain is unsupported" — a capability ○ — but was a bug in the probe.
E10c had already guarded this case (`end = -1`); this probe did not. **Testing
the same operation in several POSITIONS is what exposed it**, the same way
multi-mechanism sweeps expose the others.

### Finding B — E4h's sample caveat is closed: presets EMBED audio (●)

E4h left open whether sample-bearing presets embed or merely reference audio,
flagging it as a possible external dependency. Reading the containers settles it:

| preset | size | embedded audio chunks | `referenced_packaged_file_ids` |
|---|---|---|---|
| Sampler "Ringwave" | 530 KB | 2 AIFF | **count = 0** |
| Drum Machine "PS2 corruption" | 5.0 MB | **24 AIFF** | **count = 0** |

The audio is **inside the file**. Original absolute source paths appear as
provenance metadata only (alongside internal `samples/<name>.wav` names), and
nothing external is referenced. ⇒ **E4h's "templates are a build-time asset, not
a runtime dependency" holds even for sample-bearing presets** — they are just
large. The residual dependency risk is retired.

### Finding C — the param catalog can be read structurally, not scraped (◐ minor)

E4 already harvests device param IDs from the bundle's
`device-settings/<uuid>/Default.bwpreset` via `strings | grep`, and noted the
output needs a resolve-check because it includes non-param tokens (`CONTENTS`,
`MODULATORS`, `FAKE1`). The decode explains *why*: those tokens are **object
names** (field `0x02b9`) at a different tree depth from parameter entries, not
noise. A structural read can distinguish them, which would remove the
per-ID live resolve-check. **Not pursued** — E4's scrape already works and the
catalog is a Phase-1 item; recorded so it is not re-derived.

### Checked and NOT changed

- **E4d/E4e (layers cannot be created)** — unchanged. E10c shows object
  insertion is rejected outright, which independently corroborates the ○ from
  the file side rather than the API side.
- **E4f "no save/export API"** — unchanged. The format is readable but nothing
  lets the agent *capture* a live structure; templates still originate from a
  human saving one.
- **E7 Findings A–E (remote controls, `modulatedValue`, drive-at-runtime)** —
  unchanged; all runtime, untouched by file-format work.
- **E6 (named actions)** — unchanged and still do-not-use.
- **E1/E2/E3/E5/E8 (addressing, fidelity, structural ops, scale, batching)** —
  no contact with the file format.

---

## E9 — MCP smoke test: the SDK sits cleanly on client.ts (2026-07-20)

**Verdict: ● no surprises — it just works.** A minimal MCP server exposing two
tools (`ping`, `read_notes`) backed by `client.ts` speaks MCP over stdio and is
driven end-to-end by an MCP client, with **zero bridge-side changes**. Probe
`e09-mcp` (all green). Pure Phase-1 wiring de-risk; nothing architectural. This
is the last spike experiment — every SPIKE_PLAN §4 row is now done.

### What was wired

- **`brain/src/mcp-server.ts`** — `@modelcontextprotocol/sdk` v1.29 `McpServer`
  over `StdioServerTransport`, two tools registered via `registerTool`
  (zod-typed input schemas). Both tool handlers call straight into the existing
  `BridgeClient` / `lib.ts` helpers (`client.request('ping')`, `point` +
  `getNotes`) — the MCP layer is a thin shell over `client.ts`, no new bridge
  protocol.
- **Probe `e09-mcp`** — an MCP *client* (`Client` + `StdioClientTransport`, the
  same transport Claude Code uses) spawns the server as a subprocess, lists
  tools, and calls both. Results:
  - `tools/list` → `[ping, read_notes]` (discovery works).
  - `ping` → `{pong:true, thread:"Control Surface Session"}` (round-trips the
    bridge through the MCP layer).
  - `read_notes(trackA, 0)` → `[[0,60,100,1]]` (the gn-A slot-0 fingerprint,
    read via `point`+`getNotes` through `client.ts`).

### Notes for the build

- **stdout is the MCP transport** — the server must never `console.log`
  (diagnostics to stderr only). The one operational gotcha; trivially avoided.
- The MCP server runs as its **own process with its own bridge connection**;
  the `Bridge`'s multi-client accept (E0) handles it alongside probe clients
  with no contention. Two TCP clients on `:8686` coexist fine.
- **Carry-forward:** `mcp-server.ts` is a Phase-1 skeleton — the tool set grows,
  but the shape (MCP tool → `client.ts` call → JSON-in-text result) is settled.
  `client.ts` needs nothing added to sit under MCP.

### Decision impact → DECISIONS / PROJECT_PLAN

- **The MCP layer sits cleanly on `client.ts`** — Phase 1's transport stack
  (MCP SDK ↔ `client.ts` ↔ TCP bridge ↔ extension) is de-risked end to end. No
  architectural work; the remaining effort is defining the real tool surface
  (the contract), not plumbing.
- **`@modelcontextprotocol/sdk` + `zod`** are the confirmed Phase-1 deps for the
  brain's MCP front end.

---

## E8 — Concurrency & safety mechanics: the batch/revision machinery holds (2026-07-20)

**Verdict: ● the §8 batch-execution and safety mechanisms all behave under
load and interference.** A server-side batch handler collapses N round-trips to
one control-surface turn (**232× faster** for the fast note-write class); staged
`delayMs` pacing respects the ~600ms device-insert settle (E3); mid-batch
`showPopupNotification` is a usable progress signal that does not stall the
batch; a monotonic revision counter rejects stale writes whole; and writes land
on a pinned cursor's target through concurrent user editing (E1b extended from
reads to writes). Probes `e08-batch` (A–D, automated) + `e08b-interference`
(the user-at-keyboard write test). This is **infrastructure de-risking**, not an
open architectural question — and the batch executor + revision counter are
real Phase-1 carry-forward code (`ProbeHandlers.batchRun`, `revision`).

### The batch executor — one request, one turn (Finding A, ●)

The Bridge already marshals every RPC onto the single control-surface thread via
`host.scheduleTask(…, 0)`, so **N separate requests pay N scheduling turns** (the
~24ms tick floor each, E5). A `batch.run` handler carries N ops in one request →
one task → **one turn**, dispatching each op through the existing handler table
(`dispatch(method, params)` reused verbatim per op). Measured on 240 single-note
writes to one clip:

| path | client wall | server work |
|---|---|---|
| `batch.run` (240 ops, 1 request) | **25 ms** | 1 367 µs for all 240 `setStep`s |
| 240 separate RPCs | **5 804 ms** | — |

**232× faster wall-clock.** The E2 two-turn write rule applies **once to the
whole batch**, not per op: all 240 writes land in one turn and become verifiable
one turn later, regardless of N. ⇒ the batch is the right primitive for the fast
op classes (note/param writes); a per-op-RPC design would pay the tick tax N
times for nothing.

### Staged pacing for ops that settle across turns (Finding B, ●)

A single synchronous turn is wrong for ops that materialise across turns — a
device insert (~600ms, E3), a track create (~144ms) — because a later op that
depends on the settle (a write into a just-inserted device) would run before the
device exists. `batch.run` takes an optional `delayMs`: ops are then handed to
`host.scheduleTask` one settle-budget apart, and the response **returns
immediately** (`{paced:true, scheduled:N}`) rather than blocking. A mixed batch
of 3 note writes + 2 Polysynth inserts paced at 650ms returned in 26ms and
drained fully in **3.3s** with all 5 ops landed (3 notes + 2 devices), confirmed
by readback. ⇒ **batches mixing note and structural/device ops stage naturally:
a fast phase in one turn, structural ops paced at their settle budget.**
Completion is confirmed by the standing verify-by-readback rule, not by the
batch response (which only acknowledges acceptance for a paced batch).

⚠ **Async-completion is a Phase-1 design point, not yet built.** The Bridge
writes a handler's response when it *returns*, so a paced batch cannot deliver a
single "all done" response at the end within the current contract — the probe
polls readback instead. A production executor that wants a completion callback
needs an async-response protocol (a handler returning a "deferred" sentinel and
the executor writing the final frame later). Recorded for `DECISIONS`.

### Mid-batch notification is a clean progress signal (Finding C, ●)

`showPopupNotification` invoked as ops interleaved into a paced batch
(`notify 0% → write → notify 50% → write → notify 100%`) fired all three popups
spaced across the batch without stalling it (notes still landed on schedule).
Because `notify` is just another dispatched method, progress UX is free — no
special batch machinery. ⇒ **the progress-UX baseline is "interleave notify ops
in a paced batch."**

### The stale-revision guard — optimistic concurrency (Finding D, ●)

A monotonic `long revision` counter on the executor implements the §8 stale-write
rejection:
- `batch.run({ops, ifRevision})`: if `ifRevision` is present and ≠ the current
  revision, the batch is **rejected whole** — nothing applied — returning
  `{applied:false, rejected:true, reason:"stale-revision", expected, actual}`.
  Verified: after an interfering `revision.bump`, a batch tagged with the old
  revision applied **zero** of its ops (note count unchanged), and resubmitting
  against the fresh revision applied cleanly.
- Acceptance claims the next revision immediately (`++revision`), so a second
  batch against the old revision is rejected even while a paced batch is still
  draining — correct in-flight semantics.

**Where revision state lives (the settled question):** on the **executor**
(`ProbeHandlers`), NOT on the `Rig` (which holds pre-allocated Bitwig handles) —
revision is executor policy, not a DAW object. And because **every request is
dispatched on the one control-surface thread**, the counter is touched
single-threaded and is **naturally serialized with the writes it guards** — no
lock, no atomic needed. That thread-confinement is the load-bearing property: it
is what makes "check revision, then apply, then bump" atomic for free.

### Write-under-interference — E1b extended to writes (Finding E, ●)

`e08b` pinned a pool cursor to gn-A (track + clip pin, the robust E1/E4 hold) and
streamed **40 paced note writes** over a ~16s window while the user clicked,
dragged, and switched clips/tracks elsewhere. Result across **21 observed
selection changes**: all **40/40 writes landed on gn-A's exact target cells** and
the cursor stayed pinned to (gn-A, slot 0). ⇒ the pinned-cursor addressing model
survives concurrent user editing **during a live batch**, not just for reads
(E1b) — the write path has the same immunity.

⚠ **Note-adjacency truncation (a real fidelity gotcha, found via a test
"FAIL").** The first `e08b` run failed an exact content match despite 40/40 cells
written: consecutive **same-pitch** notes each with `dur=1` (4 steps at
stepSize 0.25) truncate each other to `0.25` — Bitwig ends a note where the next
same-pitch note begins. This is correct DAW behavior, not a batch defect; the
test expectation was wrong (encoded a duration Bitwig won't keep). Fixed by
writing one distinct pitch per note. ⇒ **for snapshots/checkpoints: a written
note duration is not guaranteed to survive if another note follows on the same
pitch — readback is the source of truth (as everywhere in this spike), and a
checkpoint stores what `getStep` reports, never what was requested.**

### Decision impact → DECISIONS ("batch execution mechanics")

- **Batch execution model:** the executor sends **one `batch.run` request
  carrying N ops**, never N round-trips. Fast ops (note/param writes) run
  synchronously in one control-surface turn (232× the throughput); structural/
  device ops are **staged with `delayMs`** at their settle budget (~600ms device,
  ~144ms track, E3). The E2 two-turn write→verify rule applies once per batch.
- **Revision / optimistic concurrency:** a monotonic revision counter lives **on
  the executor**, thread-confined to the control-surface thread (no locking).
  Writes carry `ifRevision`; a mismatch **rejects the whole batch, applies
  nothing**. Acceptance bumps the revision so in-flight batches invalidate later
  stale submissions. This is the §8 stale-write guard, now demonstrated.
- **Progress UX:** interleave `showPopupNotification` ops into a paced batch —
  fires without stalling, no special machinery.
- **Async batch completion is an open Phase-1 build item** (not a blocker): the
  current Bridge writes a response on handler return, so a paced batch reports
  acceptance, not completion. A completion callback needs a deferred-response
  protocol. Verification today is by readback, which is the standing rule anyway.
- **Write-under-interference holds** — the pinned-cursor model is safe for
  optimistic apply while the user keeps editing. Combined with revision guarding,
  the two interference vectors (the user moves the selection; the user changes
  state we assumed) are both covered: pinning defeats the first, revision the
  second.
- **Note-duration is a readback-only fidelity fact** — same-pitch adjacency
  truncates; snapshot what `getStep` reports.

### Carry-forward

`ProbeHandlers.batchRun` (synchronous fast path + `delayMs` staged pacing, per-op
dispatch through the existing table + per-op error capture) and the `revision`
counter with `revision.get`/`revision.bump` + the `ifRevision` guard are
**Phase-1-quality infrastructure** — the batch executor is real Phase-1 code, not
a throwaway probe. Lift them; the only addition Phase 1 needs is (a) snapshot/
replay for revert composed on top (E3's primitive) and (b) the async-completion
protocol for paced batches.

---

## E7 — Modulators: author-by-template, drive-at-runtime (2026-07-19)

**Verdict: ◐→ author-by-template, drive-at-runtime, via a slot-bank.** Runtime
authoring of modulation is ○ (no create API; map idiom inert even foregrounded;
classic modulation-source API **uncallable**, throws at init). BUT modulation
baked into a template `.bwpreset` **materialises via `insertFile`, routing intact
and live — verified ● (E7b)**, the E4g pattern one level deeper, and the agent
then fully **reads/writes the modulator's own controls** at runtime via its
auto-created remote page (E7d ●) — including gating a route on/off by driving
`Amount` (0.839↔0.000). The two levers that would have given *arbitrary*
flexibility are both closed: **routing-target change** is unreachable in every
runtime state incl. foregrounded (E7f ○), and **modulator-type GUID substitution
fails** (unwired / page-less / "Missing" — E7e/g ○, unlike clean device
substitution E4g). ⇒ the shippable design is a **slot-bank template** (Finding H):
one fat per-device template with dormant pre-wired modulator slots the agent
switches on and tunes. Arbitrary-target routing is a sequenced-later binary
escape hatch. Probes `e07-modulators` / `e07b-modtemplate` / `e07c-modparams` /
`e07d-modtweak` / `e07e-modswap` / `e07f-routing` / `e07g-samefamily`. Resolves
§12 #6, the last ◐. Credit: the template + slot-bank path was opened by the user
pushing back on the initial "never author" ○ — the E4c→E4d single-mechanism
over-generalisation, caught again.

### Finding 0 — the classic ModulationSource API is UNCALLABLE (○, the headline)

The API sweep found `Device.getModulationSource(int)`, `Macro
.getModulationSource()`, `ModulationSource.{isMapped,isMapping,toggleIsMapping}`
and recorded §12 #6 as "partial surface exists." **That surface cannot be
touched from a modern controller extension.** A build that carried
`getModulationSource(i)` handles (created at init, like every other rig view)
**crashed the whole extension on load** with Bitwig's hard-deprecation guard:

> `ghostnote did something wrong — This has been deprecated since API version 2:
> Use remote controls instead`
> `DeviceProxy.getModulationSource → deprecatedFail` (BitwigStudio.log)

This is not a soft `@Deprecated` you can ignore: `deprecatedFail` **throws**,
`init()` aborts, and the bridge never binds. The interface docs corroborate the
redirect — `Macro` is `@Deprecated` ("Macros no longer exist as built in
features… the user can customize pages of controls"), and `ModulationSource`
itself is `@Deprecated`. ⇒ **the rig carries NO getModulationSource/Macro
handles**; doing so is a load-time crash, not a runtime no-op. Everything below
uses the surface Bitwig redirects to: **remote controls**.

⚠ **New gotcha class (worse than a silent no-op):** some API methods are
*fatally* deprecated — calling one at init takes the extension down with a user
popup. `getModulationSource`, `getMacro`, and the whole `ModulationSource`/
`Macro`/`RemoteControl(old)` mapping family are the known members. **Check for
`@Deprecated` on the javadoc interface/method before wiring any handle at
init** — a deprecated method here is a crash, not a warning. (Countermeasure
added to Method notes.)

### Finding A — remote controls are fully readable (●)

`Device.createCursorRemoteControlsPage(n)` + `RemoteControlsPage.getParameter(i)`
→ `RemoteControl` (which **extends `Parameter`**). On a freshly-inserted
Polysynth: **9 pages** (`OSC1, OSC2, MIX, FILTER, FILTER/EG, AMP, Envelope,
Common, Vibrato`), 8 remotes on page 0, each self-describing
(`[0]"Osc1Pitch"=0.500, [1]"Sync1"=0.000, …`). `pageCount`, `pageNames`,
`selectedPageIndex` all read. This is the modern macro/mod surface and it
enumerates cleanly, re-scoping as the cursor repoints (same pool model as E4).

### Finding A2 — the agent can DRIVE a remote control end to end (●)

`RemoteControl.value().setImmediately(v)` (it's a `Parameter`, so E4's
take-over rule applies). Writing remote[0] "Osc1Pitch" → 0.8 moved **both** the
remote (0.800) **and its pre-mapped device parameter `OSC1_PITCH` → 0.800**,
verified by reading the Polysynth param handle. ⇒ **remotes are a live control
surface**: any macro a user or a template has already wired, the agent can
turn. This is the **indirect route to modulation sound-design** — you don't
build the modulation graph, you drive the knobs it exposes.

### Finding B — `Parameter.modulatedValue()` works; the checkpoint lever (●)

`Parameter.modulatedValue()` returns a `RangedValue` (not deprecated) and reads
for every param handle. With no modulation, `value == modulatedValue` exactly
(0 divergence), and `modulatedValue` tracks a base-value write (F1FREQ→0.200,
mv=0.200). ⇒ **this is the checkpoint-fidelity lever for modulation:** a
modulated param reports `value` (the static base we can set/snapshot) separately
from `modulatedValue` (what is actually heard). Revert correctness reads the
base; "what's happening now" reads the modulated value. Pairs with E4's
`hasAutomation()` flag as the two "this param isn't holding a static write"
signals.

### Finding C — the map idiom is inert headless (○)

`RemoteControl.isBeingMapped()` is the modern "enter mapping mode, then touch a
target" idiom. `set(true)` is **accepted without error but does not take**:
`isBeingMappedBefore=false → isBeingMappedAfter=false`. Mapping mode won't even
*latch* from a background controller, let alone complete (completion needs a
real UI parameter touch). **Same focus dependency that made E6 named actions
inert** — creating a route programmatically is out of reach. Recorded, not
fought (per the timebox rule).

### Finding D — modulators cannot be CREATED (○)

No `insertModulator` API and no modulator-specific `InsertionPoint`. Swept
`insertFile(<abs .bwmodulator>)` at **every** device-chain insertion point —
track end-of-chain, `afterDeviceInsertionPoint`, `beforeDeviceInsertionPoint` —
with `LFO.bwmodulator` / `ADSR.bwmodulator`: **inert at all three** (chain
1→1, no change, no error). A `.bwmodulator` is not chain content, and there is
no insertion point that binds to a device's modulator slot. (Multi-mechanism
sweep per the no-false-negatives rule — this ○ is not a single-mechanism miss.)
⚠ **`.bwmodulator` files are binary-compressed** (`BtWg0003…` header, not the
readable TLV that `.bwpreset` uses), so the E3/E4 structured UUID harvest does
not apply to the standalone files.

### Finding D2 — template-borne modulation MATERIALISES (● E7b, verified)

Finding D's ○ is correct but **narrow**: it disproves *runtime* modulator
creation and *bare `.bwmodulator`* insertion. It does **not** disprove
modulation shipped inside a `.bwpreset` — and community tooling said that is
exactly where modulators live:

- **`jaxter184/bwEdit-Python`** — a Python editor for the binary preset/device
  format; its changelog reads *"Added support for modulators,"* and the UI
  shows an **atom graph** where you click a node to start a connection and wire
  it to another atom. ⇒ **modulators + their routing are atoms *inside* the
  `.bwpreset` payload**, not separate insertables. This is the same binary
  substrate E4f–E4g patch by GUID. (Its later *"Fixed FX chain atom (no longer
  crashes Bitwig)"* is the same host-crash warning E4f already flagged —
  malformed structural atoms crash the host, so editing modulator topology at
  the binary level is hazardous.)
- **`zezic/bitwig-device-hacks`** — hand-writes `.bwmodulator` files (Nitro DSP)
  and drops them into the **modulator *library folder***. Confirms modulators
  load as discrete file artifacts **via the library/browser, not a chain
  insertion point** — which is *why* Finding D's `insertFile(.bwmodulator)` was
  inert (wrong destination), not evidence modulators are unreachable.
- **`zezic/bitwig-whitelister`** — patches `bitwig.jar`; adjacent confirmation
  that device/modulator identity is **UUID-keyed** (as E4f/E4g found for
  devices). Not insertion evidence.

⇒ **Confirmed, mirroring E4d overturning E4c.** A user built a minimal template
(a Polysynth with an **LFO wired to Filter Frequency**) and saved it as a
preset — necessarily by hand, since there is **no save API** (E4f). Probe
`e07b-modtemplate` loaded it via `insertFile` and sampled the F1FREQ handle over
~1s:

| sample | base `value` | `modulatedValue` |
|---|---|---|
| 0 | 0.490 | 0.317 |
| 1 | 0.490 | 0.738 |
| 2 | 0.490 | 0.934 |
| 3 | 0.490 | 0.935 |
| 4 | 0.490 | 0.703 |
| 5 | 0.490 | 0.320 |

The base value sat **rock-still at 0.490** while `modulatedValue` swept a full
LFO cycle. ⇒ the modulator **materialised from the preset, its routing survived,
and it is live** — with zero modulation authored by us. The E4f–E4h "shape from
a template" pipeline extends to modulation; it does not stop at it.

**Bonus — this is the checkpoint model working on a real modulated param.** The
static base (0.490) is what a snapshot captures and a revert restores;
`modulatedValue` is what is heard. Finding B's claim is no longer hypothetical:
snapshot `value`, and treat a divergent `modulatedValue` as "this param is under
modulation, its static write is not the whole story."

⚠ **Authoring the routing at the BINARY level is still out of scope.** E7b used
a *whole* user-built preset, unedited. Editing modulator topology inside the
`.bwpreset` (adding/rewiring atoms à la bwEdit-Python) is the same undocumented,
host-crashing binary work E4f ruled out — templates come from a human saving
one, not from atom surgery. Whether per-modulator GUID substitution works like
per-device substitution (E4g) is untested — see the cardinality note in
Finding E.

### Finding E — a loaded modulator is READ+WRITE at runtime (● E7c/E7d)

The follow-up question: once a modulator materialises from a template, can the
agent reach the **modulator's own controls** (the LFO's rate/depth), or only the
modulated target? **Yes — via remote-control pages.** Probes `e07c-modparams`
(discovery) + `e07d-modtweak` (read+write).

- **Discovery (E7c):** the modulator's params do NOT appear in the device's
  DirectParameter tree (bare Polysynth 55 ids → modtest 55, delta 0). Instead,
  **adding a modulator adds a remote-controls PAGE named after it**: the bare
  Polysynth has 9 pages (`OSC1…Vibrato`); modtest has 10 — a new **`LFO`** page.
- **Read (E7d):** selecting the `LFO` page (by `selectedPageIndex`) re-scopes
  the rig's RemoteControl handles to the modulator's own controls:
  **`Rate=0.440, Timebase, Tilt, Curve, Delay, Fade-in, Mode, Amount=1.000`** —
  the LFO's full control set, self-describing.
- **Write (E7d):** `Rate` → 0.85 round-trips (it's a `Parameter`, so
  `setImmediately` applies). And driving **`Amount` → 0 collapsed the F1FREQ
  modulation sweep from 0.839 spread to 0.000** — writing the modulator's own
  control had the exact expected effect on the heard value.

⚠ **`selectNextPageMatching(expr, …)` did NOT land the page** from a string like
`"LFO"` (stayed on page 0, silently — another silent no-op). Selecting by
explicit `selectedPageIndex` after finding the name in `pageNames()` is the
reliable idiom.

⇒ **The SETTINGS axis of any modulator is fully runtime-addressable** through
its auto-created remote page. Load one template, then tweak rate/shape/depth/
amount live — no template-per-setting.

### Cardinality (the "N+1" question) — sized precisely

Given E7b (materialise) + E7d (tweak), the template-explosion concern shrinks to
three axes, only some of which need per-template variants:

| axis | covered at runtime? | cost |
|---|---|---|
| modulator **settings** (rate/shape/depth/amount…) | ● yes (E7d, remote page) | free — one template |
| modulator **type** (LFO↔Random↔ADSR) | ○ no | GUID substitution FAILS (E7e/g); **template variant per type** |
| routing **target** (filter↔pitch↔…) | ○ no (E7f: closed even foregrounded) | template variant, or hazardous atom edit |
| modulator **count** (add another) | ○ no (creation ○) | template variant, or hazardous atom edit |

So runtime driving removes the largest contributor (settings). The remaining
explosion is `type × target × count`, and the two levers that might have collapsed
it were **both probed and both closed** — see Findings F and G. What is left is
the **slot-bank template design** (Finding H).

### Finding F — a runtime routing-target angle does NOT exist (○, exhaustive)

Before accepting that changing a modulator's *target* needs binary work, swept
every remaining live angle (probe `e07f-routing`, + full-recall offline grep):

- **Offline recall** (`member-search-index`, all 25 API versions + `new-list`):
  no route-creating member anywhere — only the dead `ModulationSource` mapping
  family and hardware-binding (`addBinding*`, which maps *hardware controls*, not
  modulation sources). Notably `bitwig.jar` *does* carry internal
  `ModulatorInsertionPoint` / `clipboard/modulator` classes — **Bitwig has the
  concept and does not export it.**
- **Named actions**: `map`→1 (`toggle_mappings_browser_panel`, a panel toggle),
  `learn`→1 (`show_online_learning`, docs), `modulat`/`assign`→0. Nothing that
  creates a route, and E6 already disqualified actions anyway.
- **The mapping gesture headless**: `RemoteControl.isBeingMapped().set(true)` →
  stays `false` (won't latch); `Parameter.touch(true)` + write + release forms
  no route; driving the remote after does not move the target.
- **The mapping gesture FOREGROUNDED** (user brought Bitwig frontmost — the E6
  escape that revived global actions): **still inert.** `isBeingMapped` still
  won't latch; no route forms. This is *stronger* than E6 — foreground did not
  help at all. ⇒ modulation-routing creation is closed in every runtime state.

### Finding G — modulator GUID substitution does NOT work (○, overturns the E4g-analog hope)

The device-identity swap that worked cleanly for *devices* (E4g) **fails for
modulators.** Probes `e07e-modswap` + `e07g-samefamily`, with UUIDs harvested by
diffing two user templates (modtest = Polysynth+LFO; modzoo = Polysynth+Classic
LFO+Random; the exclusive UUIDs are the modulators, confirmed by loading modzoo
and reading its `Classic LFO`/`Random` remote pages). Patched modtest's LFO GUID
(`ad947004`, single binary occurrence, length-preserving) to three targets:

| swapped-in GUID | is | result |
|---|---|---|
| `ca8cc421` (Polysynth built-in Vibrato) | internal | materialises ("Vibrato 2" page) but **route DROPS** — dead even with a note held + Rate/Amount driven |
| `dcacb71b` (Polysynth built-in) | internal | **page-less**, no modulation |
| `39f4b136` (Classic LFO) | external modulator | **"Missing"** — unloadable, though it loads fine in its own preset |

Three targets, three distinct failure modes — never a clean wired type-swap.
**Why it differs from E4g:** a device's identity *is* its GUID, so a swap is
total; a modulator instance additionally carries **type-specific payload +
routing atoms**, and a bare 16-byte GUID swap leaves that payload describing the
old type — so Bitwig loads it unwired (internal type it can reconcile), page-less,
or "Missing" (external type whose payload it can't find). ⇒ **the type axis
cannot be collapsed by substitution; each modulator type needs its own template
(or slot).** (Failures were graceful — unwired / page-less / "Missing", never a
crash — which still supports the substitution-class risk read; it just doesn't
*work* for modulators.)

### Finding H — the slot-bank template design (the practical answer to N+1)

Given F (no runtime routing) + G (no type substitution) + E7d (Amount gates a
route: 0.839↔0.000) + E7b (templates carry live routing), the flexible-but-safe
construction is a **fat template per device with a bank of dormant modulator
slots**:

- Ship one template per device carrying **N×M pre-wired modulators**: for each
  of N curated targets (filter, pitch, amp…) × M types (LFO, Random, ADSR…), a
  real modulator wired to that target with **`Amount = 0`** (dormant, inaudible).
- **Runtime "add an LFO to the filter"** = find the (LFO→filter) slot, set its
  `Amount > 0`, then drive rate/shape live (all proven in E7d). "Remove" = Amount
  back to 0. "Swap LFO for Random on the filter" = Amount-down the LFO slot,
  Amount-up the Random slot.
- This moves the explosion **from template-count to slot-count inside one
  template** — and a device holds many modulators cheaply, so it is tractable.
  One human-authored template per device covers its whole curated modulation
  matrix; no per-combination presets, no binary editing.
- **Residual:** the target set is **curated, not arbitrary** — only the N targets
  pre-wired in the template can be modulated. Reaching an *arbitrary* device
  param as a target still requires binary topology surgery (add a connection
  atom), which stays the **sequenced-later escape hatch** — genuinely hazardous
  (novel structure, the crash-prone end of E4f/bwEdit-Python) and only worth it
  if the curated-target set proves too limiting in practice.

⚠ **On the host-crash risk (re-evaluated):** the danger is not uniform. E4g
proved *length-preserving, structurally-valid substitution* (device GUID swap)
loads cleanly, and G confirms modulator GUID swaps also **fail gracefully, never
crash**. The crashes bwEdit-Python fixed were *structural* atom edits (FX-chain
atoms) — the topology end, which is exactly what arbitrary-target routing would
require. Also note Bitwig's "isolation" improvements are about **plugin**
sandboxing (VST/CLAP in a separate process); a malformed native `.bwpreset` is
parsed by Bitwig's **own** deserialiser, which those improvements do not protect
— so "Bitwig got better at isolation" does not de-risk native-format surgery.
Risk tracks *how far the edit deviates from a valid structure*: value/GUID
substitution ≈ safe (but ineffective for modulators); new topology ≈ crash-prone.

### The modulation capability map (settles §6 device matrix, was ◐/unknown)

| capability | verdict | mechanism |
|---|---|---|
| read a param's post-modulation value | ● | `Parameter.modulatedValue()` |
| read remote-control pages (name/value) | ● | `createCursorRemoteControlsPage` |
| **drive** a wired remote/macro | ● | `RemoteControl.value().setImmediately` |
| read/write a loaded modulator's OWN controls | ● | its auto-created remote page (E7d) |
| read a device's modulators via typed API | ○ | `getModulationSource` deprecated-uncallable |
| create a modulator at RUNTIME | ○ | no API; `insertFile(.bwmodulator)` inert |
| author a modulation routing at RUNTIME | ○ | map idiom inert headless |
| ship modulation in a template `.bwpreset` | ● | materialises live via `insertFile`, routing intact (E7b) |
| vary a templated modulator's settings | ● | remote-page writes (E7d) — no per-setting template |
| gate a templated route on/off at runtime | ● | drive its `Amount` to 0 / up (E7d/H) — the slot-bank lever |
| swap a templated modulator's TYPE by GUID | ○ | fails: unwired / page-less / "Missing" (E7e/g) |
| change a routing TARGET at runtime | ○ | closed even foregrounded (E7f) |
| edit modulation topology (target/count) in binary | ○ | undocumented, host-crashing (E4f); sequenced-later escape hatch |

### Decision impact → DECISIONS

- **Modulation is author-by-template, drive-at-runtime** — the same posture as
  structure (E4d–E4h). The agent cannot add modulators or draw routes at
  runtime, but a template `.bwpreset` a human built once carries the modulators
  AND their routing, materialises live via `insertFile` (E7b ●), and the agent
  then drives it (remotes, `modulatedValue` readback, param writes). Rank
  *runtime authoring* out of scope; rank *modulated templates + driving them* IN
  as a Phase-2 capability. Ship a template library that includes
  modulator-bearing patches, not just device/param shapes.
- **Adopt the slot-bank template design for modulation flexibility (Finding H).**
  Neither runtime routing (F) nor GUID type-substitution (G) works, so the way to
  avoid a template-per-combination explosion is **one fat template per device
  with a bank of dormant (`Amount=0`) modulator slots**, each pre-wired to a
  curated target×type. Runtime selects/deselects by driving `Amount`, then tunes
  rate/shape live. Target set is **curated, not arbitrary**; arbitrary-target
  routing stays a **sequenced-later binary-topology escape hatch** (hazardous,
  the crash-prone end — only if curation proves too limiting).
- **`modulatedValue` is a required checkpoint field, not optional.** E7b proved a
  modulated param's base `value` and heard `modulatedValue` genuinely diverge
  (base pinned at 0.490 while the heard value swept a full LFO cycle). Snapshot
  the base; flag divergence (with `hasAutomation()`, E4) as "static write ≠ what
  is heard."
- **Reinforces the templating posture (E4f–E4h).** As with layer construction,
  the modulation graph is **user/template-authored, agent-driven**: ship
  templates whose modulators are pre-wired to remote controls, and the agent
  drives the remotes. A "make an LFO wobble the filter" tool would be
  undeliverable from the API; "turn the wobble macro this patch exposes" is a
  parameter write.
- **Checkpoint model gains `modulatedValue`.** Snapshot/restore the *base*
  `value`; a divergent `modulatedValue` (or `hasAutomation()`, E4) flags a param
  whose static write won't be what's heard — surface it, don't silently trust
  the base.
- **Escape-hatch tally, with E6:** first named actions (○, hazardous), now
  modulator authoring (○). The typed API is the whole toolbox; where it has no
  primitive, the answer is templates + driving, not a back door.
- **Carry-forward:** the remote-controls apparatus (`createCursorRemoteControlsPage`
  + `RemoteControl` handles, `remote.list`/`remote.set`) and the
  `param.modulatedValue` readback are Phase-1-quality; lift them. The
  `getModulationSource`/`Macro` path is a **do-not-touch** landmine.

---

## E6 — Named actions: unusable AND hazardous (2026-07-19)

**Verdict: ○ the named-action escape hatch is unavailable to a background
agent, and actively dangerous.** `Application.getActions()` exposes 781
actions, but invoking them from a controller extension is GUI-state
dependent, unverifiable, and — for the useful ones — operates on the exact
selection our own addressing manipulates. Probe `e06` + diagnostics
`e06-diag2/3/4/6/7`. Reduced-urgency experiment; the answer is a clean "don't."

### The surface

781 actions in 20 categories; ~264 are pure view/panel/zoom/focus ops
irrelevant to a headless agent. Typed APIs already cover the compositional
verbs (duplicateObject/deleteObject/insertFile/param writes). The genuine
**no-typed-API residual** is small: **`Group`/`Ungroup`** (track grouping —
confirmed no typed `createGroup`; only `isGroup()`/`navigateIntoTrackGroup`
exist) and **`wrap`/`unwrap`** (automation-clip conversion).

### Why they don't work for us — the behavioural model

`invoke()` resolves the action and returns cleanly (the bridge path is fine —
`resolvedName` confirms the right action), but EFFECT depends on GUI state:

- **Global actions need Bitwig to be the FOREGROUND OS app.** `Create Scene`
  bumped the scene count 9→10 when the user held Bitwig frontmost (diag3);
  backgrounded, it was a silent no-op while typed `scene.create` worked on
  identical state (diag2). Same for the `Undo` action vs typed `app.undo`.
- **Editing actions additionally dispatch against PANEL keyboard focus**,
  which the controller API cannot set. `ClipLauncherSlot.select()` sets object
  selection (Bitwig's own `isSelected` observer fires) but NOT panel focus, so
  `Duplicate` on a selected clip does nothing — even foregrounded (diag3). It
  duplicated the clip only after a `focus_or_toggle_clip_launcher` action was
  invoked first (diag4). A background agent can satisfy neither precondition.

### The hazard — actions clobber the selection our addressing sets

The decisive finding. With a **track** selected and no clip-panel focus,
foregrounded `Duplicate` duplicates the **whole track** (diag7: gn-A → a
second "gn-A" at the next index). And **our addressing selects the track it
points at** — `cursorTrack.selectChannel(track)` (E1) sets the UI selection
as a side effect. So invoking `Duplicate` while a pool cursor is active
**duplicated the gn-A fixture**, silently, and unpinned the cursor.

Over this experiment's foreground diagnostic runs it created **7 orphan gn-A
duplicates** before the mechanism was understood (cleaned up by channelId,
E2f). A pure view action (a zoom) is harmless to a pinned cursor (probe phase
D), so the danger is specifically **state-changing actions firing against a
selection we did not intend them to see** — and our infrastructure is
constantly setting that selection.

### Checkpoint implication

`invoke()` returns `void` and an inapplicable action is a silent no-op (no
throw). Actions therefore carry **zero readback** — an executor could never
confirm what one did, on top of not controlling whether it fires. That is
disqualifying for the optimistic-apply + verify model (§8c).

### Decision impact → DECISIONS

- **Policy: ghostnote does not use named actions.** They need foreground +
  panel focus a background agent cannot assume, return nothing to verify, and
  operate on the UI selection our own pointing mechanism sets — a corruption
  risk against our infrastructure tracks. Rely exclusively on typed APIs.
- **The no-typed-API residual (track Group/Ungroup, automation wrap/unwrap)
  is an accepted capability gap.** It is organisational/automation-plumbing,
  not compositional; forgoing it is cheap. Revisit only if a concrete need
  appears, and even then not via `getActions()`.
- **New rule reinforced:** because pointing a cursor selects its track,
  *nothing* in the executor should ever invoke a selection-consuming action.
  This also flags that our pointing borrows UI selection (the E1 wart) has a
  sharper consequence than cosmetic — it is why an action would hit the wrong
  target.
- Escape-hatch verdict for §12: **there is effectively no action-based escape
  hatch.** The typed API surface (E1–E4h) is the whole toolbox; where it has
  no primitive (multi-layer authoring, grouping), the answer is templates
  (E4f–E4h) or "out of scope", not actions.

---

## E4h — Templates as repo assets, not Library entries (2026-07-19)

**Verdict: ● presets can ship with the project.** The Bitwig Library is not
involved: `insertFile` takes any filesystem path, and after loading, the file
is no longer referenced. Probe `e04h`, all green.

| test | result |
|---|---|
| absolute path to a repo asset | ● loads all 4 chains |
| **relative path** | ○ **does not load** |
| spaces, em dash, parentheses in path | ● fine |
| **non-`.bwpreset` extension** | ○ **does not load** |
| missing file | ○ silent no-op, no error |
| **file deleted after loading** | ● structure + devices unaffected |

### The two operational rules

- **Paths must be ABSOLUTE.** The extension runs inside Bitwig, so a relative
  path resolves against *Bitwig's* working directory, not the brain's. The
  brain must resolve repo-relative asset paths before they cross the bridge.
- **The `.bwpreset` extension is REQUIRED.** Bitwig dispatches on the
  filename, not the content — byte-identical data named `.template` is
  ignored. Repo assets must keep the extension.

Both failure modes are **silent**, as is a missing file: `insertFile` gives
no negative acknowledgement, matching the documented *"some things may not
make sense to insert… nothing happens"* semantics. ⇒ every insert must be
confirmed by reading back the resulting chain contents.

### Presets are a build-time asset, not a runtime dependency

After `insertFile`, the preset file was **deleted** and the loaded structure
was unaffected — all four chains intact, devices still live (55 params
enumerated, writable). `insertFile` copies content into the project; nothing
retains a reference.

⇒ **templates belong in the repo** (e.g. `assets/presets/*.bwpreset`),
version-controlled alongside the code, with no dependency on the user's
Bitwig Library and no install step. They are inputs to a build, not
installed content.

⚠ **Caveat:** verified in-session only. A project save + reload would confirm
it fully, and **sample-bearing** presets are the case to watch — a Sampler
chain may *reference* audio files rather than embed them, which would
reintroduce an external dependency the structural devices do not have.

### Decision impact

- **Ship templates in-repo**; no Library installation, no user setup beyond
  the one-time authoring of each shape.
- **Contract/executor:** absolute paths only; assert the `.bwpreset`
  extension at the tool boundary (a wrong name fails silently otherwise);
  verify every insert by chain readback.
- Revisit embedding vs. referencing if a template ever contains samples.

---

## E4g — Per-layer substitution VERIFIED on a 4-chain template (2026-07-19)

**Verdict: ● parameterised multi-layer construction works.** E4f's one
outstanding inference is now a measured result. Probe `e04g`, all green,
against a template the user built by hand (an Instrument Layer with
Phase-4 / Polysynth / Organ / Sampler) — the only way to obtain one, since
there is no save API.

### Template anatomy

Each device's identity appears **exactly once** as a raw 16-byte GUID, at a
distinct offset, with the container first:

| offset | device | role |
|---|---|---|
| 6 346 | Instrument Layer | container |
| 8 023 | Phase-4 | chain 1 |
| 14 312 | Polysynth | chain 2 |
| 19 014 | Organ | chain 3 |
| 22 174 | Sampler | chain 4 |

25 011 bytes for a 4-chain instrument stack — templates are small.

### Results

- **The untouched template instantiates all four chains in one
  `insertFile` call**, each holding the device the user placed there.
- **Single swap (Organ → Polymer): only that chain changed.**
  `[Phase-4, Polysynth, Organ, Sampler]` → `[Phase-4, Polysynth, Polymer,
  Sampler]`. The other three chains were untouched. **This is the result the
  whole templating story rested on.**
- **Double swap (Phase-4 → Polymer, Sampler → Polysynth) in one file:** both
  changed independently, the untouched Organ chain survived →
  `[Polymer, Polysynth, Organ, Polysynth]`.
- **The substituted device is live at depth:** descended into the patched
  chain, `isNested=true`, 7 direct params enumerated, and a write landed
  (`CONTENTS/OUTPUT` → 0.25).
- **Stale ASCII metadata is ignored.** Only the binary GUID was patched;
  `referenced_device_ids` still named Organ and instantiation was unaffected.
  ⇒ that metadata is not consulted when loading — patching the binary GUID
  alone is sufficient and correct. (E4f gate 3's trap stands: patching *only*
  the ASCII does nothing.)

### The construction pipeline, now fully evidenced

1. **Shape** — instantiate a template preset via `insertFile` (any path, no
   Library registration needed; E4f gates 1–2).
2. **Devices** — patch per-chain binary GUIDs, one occurrence each,
   length-preserving so no offsets shift (E4g).
3. **State** — set every parameter through the param API (E4/E4b), at depth
   via `selectFirstInLayer` (E4c). The preset's stored state is irrelevant.

A template is needed **per shape** (a 4-chain stack, a 3-chain stack…), not
per sound. Shapes are few and small; devices and parameters are the varying
part and both are now parameterisable.

### Decision impact

- **"Boring setup" is a solved problem** for layer containers, via templates
  rather than the absent create-layer API. Promote it to a Phase-2
  deliverable with a known implementation path.
- **Ship a template library** — a handful of hand-built shapes, plus a GUID
  substitution helper and a device-UUID catalog (already harvestable, E4/E4d).
- **Always verify the loaded structure by readback** (chain contents by
  name), as everywhere else in this spike — substitution failures are silent.
- Bootstrapping templates requires a human once per shape; that is a
  one-time setup cost, not a per-use one.

---

## E4f — Can presets be SYNTHESISED at runtime? (2026-07-19)

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

## E4d — Chain CREATION: E4c's ○ was WRONG (2026-07-19)

**Verdict: ● complex device structures CAN be built programmatically — via
drum pads and via preset files.** E4c concluded "layers can be filled and
navigated but never created" from a single mechanism. Challenged, swept
properly, and **overturned**. Probe `e04d` (all green) + `e04d-diag`.
**Third false negative of this spike from a single-mechanism check** (after
CLAP params and channelId) — the pattern is now undeniable, see Method.

### Seven routes tested; three work

| # | route | result |
|---|---|---|
| 1 | `DeviceLayer.duplicateObject()` | ✗ silent no-op |
| 2 | `DeviceLayer.duplicate()` (as Channel) | ✗ silent no-op |
| 3 | `InsertionPoint.copyDevices()` into a layer | ✗ silent no-op |
| 4 | **`InsertionPoint.insertFile(preset)`** | **● 12-pad structure in 268ms** |
| 5 | **`DrumPad.insertionPoint().insertBitwigDevice()`** | **● creates chains** |
| 6 | **`Device.duplicateObject()` on a container** | **● clones WITH contents** |
| 7 | named actions (`getActions()`, 781 of them) | ✗ none create chains |

### ROUTE 5 — drum pads are fully buildable AND addressable

**`DrumPad` has its own `insertionPoint()` that `DeviceLayer` lacks** — that
asymmetry is the whole story. Inserting into an *empty* pad **creates the
chain**: a fresh Drum Machine reports 0 pads, and pads appear as they are
filled (0→1→2, built entirely programmatically, no UI).

Addressing into them works too, with a gotcha:
- **`selectFirstInChannel(drumPadBank.getItemAt(i))` is the right idiom** —
  `DrumPad` is a `Channel`, so the same call used for tracks works. Verified
  on pads 0 and 3: cursor lands on the nested device, **14/16 params resolve**.
- ⚠ **`selectFirstInKeyPad(n)` takes a MIDI KEY, not a pad index.** Key 36
  (C1) = pad 0; passing `0` silently leaves the cursor on the Drum Machine
  (another silent no-op). Verified across keys 0/36/60 in `e04d-diag`.

⇒ **"Build me a drum kit with N chains, each with its own devices and
routing" is fully in reach.**

### ROUTE 4 — insertFile materialises arbitrary structure in one call

`insertFile()` with a `.bwpreset` loaded a 12-pad Drum Machine — a complete
multi-chain structure with all its devices and routing — **in 268ms, one
call**. This is the general escape hatch for *any* complex structure,
including the ones with no creation API: build it once in the UI, save it,
and the agent can materialise it thereafter. Presets are ordinary files, so a
library of them is a shippable asset.

### ROUTE 6 — containers duplicate wholesale

`Device.duplicateObject()` on a populated FX Layer produced a second FX Layer
**carrying its nested contents** (1 layer, 1 device inside). So an existing
structure can be replicated even where it cannot be authored from scratch.

### The residual gap (genuine, but much narrower than E4c claimed)

What remains impossible: **adding a layer to a layer-type container.**
FX Layer ships with exactly one chain and will not grow; Instrument Layer,
Note FX Layer and the Selectors ship with **zero** and cannot be seeded — no
duplicate, copy, or insert route reaches them, and no named action exists.
So a *multi-layer instrument stack* still cannot be authored from nothing.

### Why — the architectural reason (E4e; positive, not just empirical)

Challenged to prove this is a real API gap rather than another missed
surface, five independent lines of evidence converge, and they explain
*why* rather than merely restating the observation:

1. **Primary source — the Bitwig user guide** states the design difference
   outright. Drum Machine: *"Corresponding with the 128 possible MIDI notes,
   Drum Machine offers up to 128 device chains, each called a drum chain."*
   Instrument Layer: *"there is only one Add Device button in the main
   interface of Instrument Layer, with each added device being placed on a
   **newly created** instrument chain."*
   ⇒ **Drum chains are a fixed, pre-addressable grid indexed by MIDI note;
   layer chains have no predetermined slots and come into existence only as
   a side effect of adding a device.**
2. **That is exactly why the API can offer one and not the other.** An
   `InsertionPoint` must bind to a referent. Pad 36 is well-defined while
   empty, so `DrumPad.insertionPoint()` — javadoc: *"InsertionPoint that can
   be used to insert content in this drum pad"* — is meaningful. "Layer 3"
   has no referent until it exists, so there is nothing to hand back.
3. **Version history shows deliberateness, not oversight.**
   `DrumPad.insertionPoint()` was added at **API v7** to a v1 class — a
   targeted addition. Through **v25**, `DeviceLayer` (v1) still has no
   equivalent. Bitwig also added creating-insertion-points where a referent
   exists (`nextSceneInsertionPoint`), so the pattern is consistent.
4. **The javadoc documents our silent no-op as intended behaviour:**
   InsertionPoint inserts *"as if the user had dragged and dropped them to
   this insertion point… **Some things may not make sense to insert in which
   case nothing happens**."* The no-op is specified, not a bug.
5. **Ecosystem corroboration.** DrivenByMoss — the most comprehensive Bitwig
   extension in existence — exposes only read/navigate/select in its
   `LayerImpl`/`LayerBankImpl`; no creation path, no workaround comment.

**Coverage is now exhaustive (E4e).** Every `InsertionPoint` source in the
API has been exercised. The last two, `before`/`afterDeviceInsertionPoint`
anchored on a device *inside* a layer, add to that layer's **own chain**
(1→2→3 devices) and never spawn a sibling layer.

**Honest limit of this evidence:** no Bitwig document or forum post says
"the API cannot create device layers" in so many words. What exists is a
documented architectural reason plus converging structural evidence. This is
a **reasoned negative**, the strongest available — not merely an empirical
one, and no longer a bare "we tried and it didn't work".

**But the use case is not blocked**, because: drum machines cover multi-chain
construction natively (route 5), and any layer structure can be materialised
from a saved preset (route 4) and then duplicated (route 6) and driven at
depth (E4c). The practical Phase-1 posture is **a preset library + drum-pad
construction**, not "structure creation is unavailable".

### Decision impact (supersedes E4c's ○)

- **Chain construction is IN scope.** Rank it as a viable Phase-2 capability,
  not a blocked one. The boring-setup use case is served.
- **Ship a preset library.** `insertFile` turns "complex routing" into a data
  problem; presets are the unit of reusable structure.
- **Drum pads are the native multi-chain primitive** — prefer a Drum Machine
  over an Instrument Layer whenever the agent must *build* N chains. This is
  not a workaround but a consequence of the design: pads are addressable
  slots, layers are not.
- **Layer-type containers are user-authored, agent-driven.** The contract
  should express "work inside the structure you find" for layers, and
  "build the structure" only for drum machines and preset instantiation.
  A tool that promises to construct instrument layers would be undeliverable.
- **Pad addressing = `selectFirstInChannel(pad)`**, never `selectFirstInKeyPad`
  with an index.
- Named actions (781) contain **nothing** for chain creation — one less reason
  to reach for the escape hatch (feeds E6).

---

## E4c — Device nesting: layers, pads, slots, selectors (2026-07-19)

> **⚠ AMENDED BY E4d:** this section's "nesting structure cannot be CREATED"
> conclusion is **WRONG** — it tested one mechanism. Drum pads, `insertFile`
> and container duplication all create structure. The claim that survives is
> narrower: *layer-type containers* cannot grow new layers. Read with E4d.
> The Drum Machine claim below is also wrong — see the correction there.

**Verdict: ◐ nested devices can be NAVIGATED and DRIVEN perfectly; creation
is possible by routes this experiment did not test (see E4d).**
Probes `e04c` (all green) + `e04c-diag` / `e04c-diag2` (the controlled trials
that corrected the first run's expectations).

### Four mechanisms, not one

The plan said "device layers". The API actually has four distinct nesting
surfaces, and a device advertises which it offers:

| device | hasLayers | layers shipped | hasDrumPads | slotNames |
|---|---|---|---|---|
| Polysynth (flat) | false | 0 | false | FX, Note FX |
| **FX Layer** | true | **1** | false | — |
| Note FX Layer | true | **0** | false | — |
| Instrument Layer | true | **0** | false | FX |
| Instrument Selector | true | 0 (+ChainSelector, chainCount=1) | false | FX |

### The headline: E4's param apparatus works at depth, unchanged

`CursorDevice.selectFirstInLayer(0)` moves **the same device cursor** into the
nested chain, and every E4 handle follows it down:

- cursor `"FX Layer"` → `selectFirstInLayer(0)` → cursor `"Polysynth"`,
  **14/16 param handles resolve**, self-describing exactly as at top level
  (`F1FREQ="Filter Frequency"=2.59 kHz`).
- **Writes land at depth**: `F1FREQ` → 0.200, displayed "50.6 Hz".
- `isNested()` correctly flips true for the nested device.
- **Nesting is real**: the top-level chain still reports only the container.
- **The model is RECURSIVE** — FX Layer inside FX Layer, descend twice, and
  params still resolve 14/16 at depth 2. The layer bank **re-scopes to
  whatever the cursor points at**, so one pre-allocated bank serves every
  depth. ⇒ **deep device addressing needs no new machinery** — E4's pool +
  repoint model extends downward for free.
- Insert into a layer via `DeviceLayer.endOfDeviceChainInsertionPoint()`
  (DeviceLayer *is* a DeviceChain), ~143ms — same budget as a top-level
  insert. A layer **renames itself after its content** ("Layer 1" →
  "Polysynth"), so layer names are not stable identifiers.

### The gap: layers cannot be created (○)

There is **no create-layer API**. `Device` offers `createLayerBank` /
`createCursorLayer` — *views*, not constructors. Consequences, all confirmed
by controlled trial (`e04c-diag2`):

- **FX Layer ships with exactly one chain.** Inserting at layerIndex 1 or 2
  **silently no-ops** — no error, no new layer, count stays 1.
- **Note FX Layer / Instrument Layer / Instrument Selector ship with ZERO
  chains**, so they cannot be populated programmatically *at all*. The
  container inserts fine and reports `hasLayers=true`, and every insert into
  it vanishes silently.
- ⇒ **`hasLayers=true` does NOT imply a layer exists.** Check the layer
  bank's count, never the capability flag.
- ⇒ Programmatic multi-layer construction (build an Instrument Layer with 3
  layered synths) is **out of reach**; only single-chain FX Layer is
  drivable. Deep work is limited to structures the *user* built.

### Silent no-op traps (the E2 family, now three members)

Both new traps are invisible without readback — same shape as E2's empty-slot
clip trap and E4's swallowed `set()`:

- **Inserting into a non-existent layer index** — no error, nothing happens.
- **`selectFirstInSlot("FX")` on an EMPTY slot** leaves the cursor exactly
  where it was (`exists=true`, same name, `isNested=false`), looking healthy.
- ⇒ reinforces the standing rule: **verify the cursor's target before every
  write**; a mis-descend is undetectable from the cursor's own state.

### Not verified: drum pads — ⚠ AND THE STATED REASON WAS FALSE

E4c recorded that **"Drum Machine has no `Default.bwpreset` in the app
bundle"** and concluded the offline catalog harvest was incomplete. **Both
claims are wrong.** Drum Machine is present:
`8ea97e45-0255-40fd-bc7e-94419741e9d1`, and it loads.

**Root cause of the miss — a genuinely nasty search trap.** Preset files
store names as `<length-byte><name>`. macOS `strings` strips the length byte
only when it is non-printable; `0x0C` (form feed) survives. So a device whose
name is **exactly 12 characters** emits `\fDrum Machine`, and an anchored
grep for `^Drum Machine$` silently fails. Exactly **7 of 151** devices are
affected — every one with a 12-character name:

> Drum Machine · Freq Shifter · HW Clock Out · Note Repeats · Oscilloscope ·
> Peak Limiter · Stereo Split

(The tell was visible and ignored: "Stereo Split" sorted out of alphabetical
order in the container dump, because of its invisible prefix.)

**Correct harvest method:** extract the structured field —
`strings f | grep -A1 '^device_name$' | sed -n 2p | tr -d '\f'` — never grep
for an anchored name. The catalog **is** complete (151 devices with presets);
E3/E4's claim stands and the "hole" recorded here did not exist.

Drum pad *behaviour* is now verified in **E4d** (pads are creatable and
addressable).

### Decision impact

- **Phase 2 ranking:** deep device work (drum pads, layered synths) is
  **read/drive-capable but not build-capable**. Sound-design *into* existing
  user-built layers is viable and cheap; "construct me a layered patch" is
  not. Rank direct-param sound design above structural device building.
- **Param model:** unchanged and validated at depth — one cursor-device pool
  covers arbitrary nesting. No per-depth allocation.
- **Addressing:** layer *names* are content-derived and unstable; address
  layers by index within the cursor's current scope, and re-verify after any
  descend. (No layer equivalent of `channelId` was found — worth the same
  stable-id question in Phase 1 that E2f settled for tracks.)
- **Catalog (§6a):** the bundle harvest is incomplete; the catalog builder
  needs a fallback for devices with no preset (browser enumeration, E6).

---

## E5 — Scale limits (§12 #5, the last open question) (2026-07-19)

**Verdict: ● no knee exists in any plausible range — pre-allocation is far
cheaper than §3a feared, and the binding constraint is not performance but
the bank WINDOW.** Probes `e05` (12-config sweep) + `e05b` (re-measured
against a populated 54-track / 387-clip project). All checks green.

### Method: config-driven sizes + hot-reload

`Rig`'s sizes moved from `static final` constants to `RigConfig`, loaded at
init from `~/.ghostnote/rig.json`. The sweep writes a config, forces a
re-init, and re-measures — no rebuild per data point. Each config carries a
`stamp` echoed by `rig.stats`, so the probe can prove it is talking to the
**new** init rather than a bridge that never went down.

- **⚠ `touch` does NOT trigger the hot-reload.** Bitwig watches for a
  *content* change, not an mtime bump. The reload primitive is rewriting the
  deployed file (`cp build/libs/…bwextension "$EXT/…"`). Reload → bridge
  answering again is **~3.0–3.3s**, flat across every size tested.
- Instrumentation added: `rig.stats` (construct/init nanos, sizes, stamp,
  heap) and `rig.scanTracks` (full bank scan cost + warm-up readiness).

### The numbers — empty project (e05, 6 tracks)

| config | slots | construct | init | warm-up | scan | ping p50/p95 |
|---|---|---|---|---|---|---|
| 16×16 (E0–E4 baseline) | 256 | 6.4ms | 11.4ms | ~265ms | 869µs | 24.1 / 25.8 |
| 64×64 | 4 096 | 9.0ms | 12.0ms | ~272ms | 631µs | 24.2 / 25.4 |
| 128×128 | 16 384 | 29.0ms | 32.4ms | ~270ms | 525µs | 23.9 / 25.0 |
| 256×128 | 32 768 | 42.9ms | 47.0ms | ~261ms | 611µs | 23.8 / 25.4 |
| **512×128** | **65 536** | **75.7ms** | **81.0ms** | ~267ms | 853µs | 23.9 / 25.3 |
| cursorPool=16 | 4 096 | 9.0ms | 16.1ms | ~258ms | 439µs | 23.9 / 25.2 |
| paramHandles=256 | 4 096 | 23.4ms | 26.7ms | ~260ms | 412µs | 23.9 / 25.3 |
| gridSteps=512 | 4 096 | 38.9ms | 42.7ms | ~277ms | 548µs | 23.8 / **34.5** |

Init cost is **linear and tiny**: ~1.2µs per slot object. Even 65 536 slots
costs 81ms of init, once, on a hot-reload nobody watches.

### The numbers that matter — populated project (e05b, 54 tracks / 387 clips)

Built in a scratch project (+48 instrument tracks × 8 clips), measured, then
torn down by channelId set-difference.

| config | construct | warm-up | **full scan** | ping p50/p95 | visible |
|---|---|---|---|---|---|
| 32×32 (undersized) | 5.7ms | 127ms | 748µs | 23.9 / 25.8 | **32 tracks / 227 clips** |
| 64×64 | 7.8ms | 116ms | 3 261µs | 23.8 / 25.3 | 54 / 387 |
| 128×128 | 17.2ms | 112ms | **6 235µs** | 24.1 / 25.3 | 54 / 387 |
| 256×128 | 33.1ms | 115ms | 5 019µs | 23.7 / 25.3 | 54 / 387 |

- **Init/warm-up/latency stayed flat under load.** Loading the bank with real
  tracks and clips did not change init cost or thread latency at all.
- **The one cost that DOES scale with content is a full bank scan** — it
  loops scenes × *existing* tracks: 3.3ms at 64 scenes, 6.2ms at 128. This is
  a per-*operation* tax, not an init tax, and it is our own handler's shape.
  Routine addressing (`resolveByChannelId`) only touches track rows, never
  slots, so it does not pay this.
- **Ping p50 is pinned at ~24ms in every single configuration.** That is the
  control-surface tick floor (matching E1's ~25ms settle), not a load signal —
  it never moved, so we never found load. The only p95 excursion in the whole
  matrix was gridSteps=512 (34.5ms), the largest single allocation.

### The real constraint: the bank window is a HARD CAP

With a 54-track project and TRACKS=32, **22 tracks and 160 clips were simply
invisible** — not slow, absent. `channelId` (E2f) resolves only inside the
window, so:

- **Scaffold size bounds the maximum addressable project size**, exactly as
  the plan suspected. Tracks past the window cannot be addressed, and their
  clips cannot be snapshotted — a **checkpoint blind spot**, which is worse
  than a perf problem: a revert could silently miss state it never saw.
- ⇒ Phase 1 must **detect** window overflow (compare bank-visible count
  against the project's true track count) and refuse/flag rather than operate
  half-blind. Do not treat bank size as a tuning knob.

### Recommended shipped sizes (evidence-backed)

Since cost is linear-and-negligible and undersizing is a correctness failure,
**size generously**: `TRACKS=256`, `SCENES=128`, `CURSOR_POOL=8`,
`DEVICE_BANK=16`, `paramHandles=64`, `GRID_STEPS=128` (+ the fine cursor).
That is ~50ms of init — imperceptible — and covers projects far larger than
this one will realistically drive. Keep them **config-tunable**; `RigConfig`
already is exactly that mechanism and is worth carrying into Phase 1.

### Cold start + project-open — measured (E5c), caveat closed

The above was hot-reload init only. Probe `e05c` records a live timeline
(ping RTT for control-surface stalls + `rig.scanTracks` for bank population),
detecting project transitions and bridge outages on its own. The same
48-track project was saved to disk and opened at **256×128** and at **16×16**;
Bitwig's own load time cancels between the two rounds.

| event | rig | bank settle | max RTT | stalls |
|---|---|---|---|---|
| New Project (54→4 tracks) | 256×128 | 28ms | 24ms | 0 |
| Open saved project (0→54, 387 clips) | 256×128 | <1 sample | 23ms | 0 |
| **Cold start** (quit + relaunch) | 256×128 | 25ms | 28ms | 0 |
| Open saved project after relaunch | 256×128 | <1 sample | 23ms | 0 |
| New Project (16→4) | 16×16 | 15ms | 25ms | 0 |
| Open saved project (0→16, 99 clips) | 16×16 | <1 sample | 24ms | 0 |

- **Cold-start init = 108.3ms** at 256×128, vs 33–43ms for the same rig on a
  hot reload — a cold JVM with Bitwig launching around it costs ~3×. It is
  still 108ms inside a **13.4-second** application launch (~0.8% of it).
- **Project-open cost is not measurable.** Bank repopulation finished inside
  one sample period at both rig sizes, and **no ping exceeded 28ms in the
  entire session — zero stalls** (threshold 100ms). The scaffold never
  blocked the control-surface thread.
- ⚠ **Do not read the "0ms/1ms settle" figures as literal.** The recorder's
  sampling period is ~50–75ms (each iteration pays the ~24ms tick twice), so
  the honest claim is *below measurement resolution*, not *instant*.
- ⚠ The 16×16 round is a **floor, not a like-for-like control**: at that size
  the rig only sees 16 of the 54 tracks, so it has less to populate partly
  because it is blind to the rest. It confirms nothing pathological happens
  at small sizes; round 1 is the load-bearing evidence.

**Bonus — E2f re-confirmed at scale.** Teardown resolved and deleted **all 48
tracks by channelId** using UUIDs captured *before* the project was saved,
before a full Bitwig quit + relaunch, and before the project was reopened.
48/48 resolved, 0 absent, 0 pre-existing tracks harmed. channelId persistence
across save/restart now holds at 48 tracks, not just the 6 of E2f.

### Caveats — what these numbers do NOT cover

- **The populated project was synthetic**: empty instrument tracks with empty
  clips, no devices/plugins. A real 54-track project has a device chain per
  track, and `DEVICE_BANK` observers stream per chain. Device-side scale is
  unmeasured.
- **Heap figures in the probe output are noise** — whole-JVM, shared with
  Bitwig, GC-dependent (they swing 282M→1186M between adjacent rows). They
  are logged for trend only and should not be read as extension cost.
- The `paramHandles=256` config cycles the 16 curated Polysynth IDs, so it
  measures *handle allocation* cost, not 256 distinct params.

### Decision impact

- **§12 #5 answered ●.** No knee below 65k slots; pre-allocation is not the
  scaling risk §3a treated it as. Ship generous sizes (above), config-tunable.
- **New correctness rule → DECISIONS:** bank-window overflow is a checkpoint
  hazard. Detect it and fail loudly; never operate on a partially-visible
  project.
- **Batch executor:** a full bank scan is ~3–6ms, cheap enough to do freely
  but not per-op in a tight loop; prefer channelId resolution, which skips
  slot iteration entirely.
- **Carry forward:** `RigConfig` + the `rig.stats`/`rig.scanTracks` handlers
  are Phase-1-quality and worth lifting; the config+hot-reload loop is a
  reusable measurement rig. `e05c`'s recorder (transition + stall detection
  tolerant of bridge outages) is the tool for any future latency question.
- **Cold start costs ~108ms of a ~13s launch** — no reason to lazy-init or
  tier the scaffold. Allocate everything up front, as §3a intended.

---

## API surface sweep (2026-07-19)

Systematic pass after the two misses, using both tools. **member-search-index
(complete recall) is primary** — the DirectParameter core methods we missed
are API version **1**, invisible to any recent-versions scan; only the full
member index surfaces old-but-unnoticed capabilities. new-list.html is
secondary (recent additions only).

### Recent additions (API 19→25, from new-list.html) — design-relevant

- **`DuplicableObject.duplicateObject()` (v19)** + `ControllerHost
  .duplicateObjects` — clean structural duplication primitive for
  clips/tracks/scenes; better than copy/paste actions. Feeds the Create
  column and a cheap "duplicate this clip" op.
- **`RangedValue.discreteValueCount()` (v20) + `discreteValueNames()`
  (v23)** — stepped/enum **param introspection**: tells continuous from
  discrete params and gives enum option names (filter type "LP/HP/BP").
  Real refinement for the §6a param layer/catalog — a 3-position switch
  must not take an arbitrary 0..1. Adopt in the param model.
- **`RangedValue.getOrigin()` (v20)** — a param's default/center (e.g. pan
  center); useful for reset and relative edits.
- **`Parameter.hasAutomation()` / `deleteAllAutomation()` (v19)** —
  **checkpoint-fidelity flag**: an automated param won't hold a static
  write (automation overrides it). Revert-correctness must check this.
- **`Track.createTrackBank/createMainTrackBank/createEffectTrackBank`
  (v25)** — per-track scoped banks for **group-track navigation** (children
  of a group). Our host-level flat bank covers top level; these reach
  nested tracks if projects use groups.
- **`TrackBank.setSupportsDeviceChainChannels` (v24)** — affects whether
  device-chain channels appear in a bank; awareness flag.
- Swept, NOT applicable: MasterRecorder (v20), createLastClickedParameter
  (v20, selection-following — against our model), ScrollbarModel/Timeline
  zoom (v21), MidiIn.hardwareAddress (v21), audio-hardware I/O matchers
  (v22), channelIndex (v22, the mutable index).

### Complete-recall concept grep (member-search-index, ALL versions)

- **Modulators — §12 #6 answered ◐ (was "entirely unknown," not ○):**
  `Device.getModulationSource(int)`, `Macro.getModulationSource()`,
  `ModulationSource.{isMapped,isMapping,toggleIsMapping,name}`,
  `Parameter.modulatedValue()` (read post-modulation value). So existing
  modulation sources are accessible and mapping is togglable (the
  enter-mapping-mode-then-touch-a-param idiom). **Creation** of a modulator
  is likely via device insertion (modulators are devices w/ UUIDs) — to
  verify. Promote §12 #6 from unknown to "partial, probe in E7".
- **Device layers (nested chains):** `Device.hasLayers()`,
  `createLayerBank(int)`, `createCursorLayer()`, `DeviceLayerBank
  .getChannel(int)`, `CursorDevice.selectFirst/LastInLayer(int)`. This is
  how to address INTO layered instruments / drum machines / FX layers —
  our device model is top-level-chain only so far. Needed for deep device
  work (drum pads, instrument layers).
- **Full browser session API (richer than §6 assumed):** typed sessions —
  `Browser.get{Preset,Device,Sample,Music,Clip,MultiSample}Session()`,
  `createSessionBank`, `startBrowsing/commitSelectedResult/cancelBrowsing`,
  `shouldAudition`; `BrowserColumn.createItemBank/entryCount`. Still modal/
  stateful, but a real typed content-search surface, not just a popup.
  Keeps `insertBitwigDevice(UUID)`/`insertFile(path)` as the simple path,
  browser as the search fallback (as §6 concluded) — but the fallback is
  more capable than recorded.
- **Rich duplication primitives:** `Clip.duplicate()`,
  `Clip.duplicateContent()` (double a pattern in place — nice compositional
  op), `ClipLauncherSlot.duplicateClip()`, `ClipLauncherSlotBank
  .duplicateClip(int)`, `Channel.duplicate()`. Multiple clean "copy"
  routes for structural ops.
- **Groove engine:** `ControllerHost.createGroove()`, `Groove
  .{getShuffleAmount,getShuffleRate,getAccentAmount,getAccentPhase,
  getAccentRate,getEnabled}` — global shuffle/accent; a lever for
  feel/humanization beyond per-note timing.
- **Quantize:** `Clip.quantize(double)` (a §8b "clean prior-state, no
  inverse" op), `Application.recordQuantizationGrid/recordQuantizeNoteLength`.
- **Remote controls (the 8/page path we superseded):** confirmed present
  (`Device.createCursorRemoteControlsPage`, `RemoteControlsPage
  .getParameter(int)`, `pageCount/pageNames`) — deprioritized given
  createParameter + DirectParameter give unrestricted access.

### Decision impact

- Param model adopts discrete/enum introspection (`discreteValueCount` +
  `discreteValueNames`) and an `hasAutomation` fidelity check.
- Structural ops gain `duplicateObject`/`duplicateContent` as first-class
  primitives (create-with-content, pattern doubling).
- New scoped experiments to slot into the plan: **device layers** (deep
  device addressing) and a real **modulators** probe (E7 upgraded from
  "expect ○" to "partial surface exists").
- Group-track navigation (`Track.createTrackBank`) noted for projects with
  groups; our flat host bank remains the default.

---

## Method: how we verify the API surface

Two misses (CLAP DirectParameter API, `channelId`) traced to the SAME
recall failure: grepping individual javadoc class pages for methods already
suspected to exist. High precision, low recall. Corrected method:

- **Authoritative sources are bundled and prose-complete** at
  `/Applications/Bitwig Studio.app/Contents/Resources/Documentation/control-surface/api/`
  — full Javadoc with method-level prose ("Reports the channel UUID"; the
  take-over-strategy caveat on `set()`; observer semantics), "Since" version
  tags, superinterface/inherited-method links. There is **no separate
  conceptual scripting guide bundled** (only this javadoc + hardware PDFs).
- **For complete recall, grep the search index, not class pages:**
  `member-search-index.js` lists **all 1968 members** across every class;
  one grep for a concept ("channelId", "DirectParameter") surfaces every
  match regardless of which class it's on. This catches things a
  Track-scoped grep misses (e.g. identity lives on supertype `Channel`).
- **Mine `new-list.html` by API version — but know its limit:** it catches
  capabilities *recently added* (channelId=20, createParameter=12) that
  prior art predates. It does NOT catch old-but-missed capabilities — the
  DirectParameter core is API **1** and invisible here. So new-list is a
  supplement; member-search-index is the recall backstop.
- **Read whole class pages incl. "All Superinterfaces" + inherited
  methods** before concluding a capability is absent.
- **Empirical testing remains essential — the prose does NOT document
  behavior.** Every behavioral gotcha we hit was undocumented: gain reads
  2×, `setGain`/`setTimbre` clobber pressure, scene deletion compacts rows,
  empty-slot pointing silently no-ops, `set()` swallowed by take-over,
  direct-write needs `resolution=1`. Docs describe the surface; only
  driving the live API reveals the behavior.
- **Rule: never record a capability ○ from a partial pass.** Confirm
  against member-search-index + new-list + a live probe first.
- **⚠ Some deprecations are FATAL, not soft (E7).** Before wiring any handle at
  init, check the javadoc interface/method for `@Deprecated`: methods like
  `Device.getModulationSource`, `Device.getMacro`, and the whole `Macro`/
  `ModulationSource` family call Bitwig's `deprecatedFail`, which **throws** —
  calling one in the `Rig` constructor aborts `init()` and crashes the
  extension with a user popup (bridge never binds). A deprecated method here is
  a load-time crash, not a runtime no-op. Grep the app-bundle javadoc for
  `Deprecated` on the interface line and every method you intend to call.
- **THE RECURRING FAILURE MODE — four instances now.** Every false negative
  in this spike came from testing *one* mechanism and generalising to "the
  API cannot do this":
  1. CLAP params ○ — checked only the typed path, missed DirectParameter.
  2. Track identity ○ — checked `Track`, missed `channelId` on `Channel`.
  3. Chain creation ○ (E4c) — checked only layer-index insertion, missed
     drum pads, `insertFile`, and container duplication (E4d).
  4. Drum Machine "absent from the bundle" (E4c) — a brittle anchored grep
     against a binary format, defeated by an invisible length byte.
  **Countermeasure, now mandatory before any ○:** enumerate *every* type that
  could carry the capability (walk supertypes: `DrumPad` has an
  `insertionPoint()` that `DeviceLayer` does not); enumerate *every* verb
  (`insert*`, `duplicate*`, `copy*`, `move*`, `paste`, `insertFile`, named
  actions); and prefer structured extraction over text matching when reading
  Bitwig's binary formats. Three of the four misses were found only because
  someone pushed back on a confident negative.

---

## E4b — CLAP params via the DirectParameter API (2026-07-19)

**Verdict: ● CLAP direct params ARE accessible — my E4 negative was wrong.**
Prompted by a challenge to the E4 CLAP claim. The typed specific-device
path has no CLAP variant, but `Device` carries a second, **format-agnostic
`DirectParameter` API** (the older one `createParameter` "replaced") that
works on CLAP, VST, and Bitwig devices alike. Probe `e04b`.

### What works (proven on a real CLAP: Stochas, `org.surge-synth-team.stochas`)

- **Self-enumeration**: `addDirectParameterIdObserver` emits an array of
  **all** param IDs — no IDs known upfront (unlike `createParameter`).
  Stochas: 55 params; Polysynth via the same API: 55 params.
- **Names**: `addDirectParameterNameObserver(maxChars, cb)` → per-id names
  ("L1 speed", "L1 steps/measure", "OSC1 Pulse Width", "AEG Attack"). All
  55 named on both devices.
- **Values**: `addDirectParameterNormalizedValueObserver(cb)` → per-id 0..1
  (Polysynth reported real defaults: Attack 0.07, Sustain 0.95).
- **Writes**: `setDirectParameterValueNormalized(id, value, resolution)`
  works on Bitwig F1FREQ (0.693→0.200). **⚠ resolution matters:**
  `resolution=1` took; `resolution=128` did NOT within 1.5s. Use
  `resolution=1` (or investigate the intended semantics). Stochas's own
  params didn't move on write — plugin-specific (some plugins reject host
  writes / gate on host-automation state), not an API limit.

### Mechanism comparison — two parameter APIs, pick per case

| | `createParameter` (E4) | `DirectParameter` (E4b) |
|---|---|---|
| Devices | VST2/VST3/Bitwig (typed) | **any incl. CLAP** |
| Discovery | IDs/indices known upfront | **self-enumerates all IDs** |
| Access | pull (`get()`) | **push (observers, init-time)** |
| Handles | pre-allocated at init | one observer set per cursor device |
| Displays | ✅ `displayedValue()` ("2.59 kHz") | ◐ observer didn't populate (below) |
| Writes | `setImmediately` | `setDirectParameterValueNormalized(…,1)` |

**Implication for the param layer:** DirectParameter is the better
*discovery/enumeration* primitive (self-listing, format-agnostic, one
observer set covers any pointed device) and reaches CLAP. `createParameter`
remains better where displayed values and stable pull-reads matter (Bitwig
internal, known VST indices). A pool cursor-device can carry BOTH: direct
observers for enumeration + typed handles for the devices we deeply support.

### Open detail (not blocking)

- **`addDirectParameterValueDisplayObserver` didn't populate** display
  strings for either device (names/values did). Hypothesis: the display
  channel is **page-scoped** (the DirectParameter API has
  `setParameterPage`/`nextParameterPage`/`isParameterPageSectionVisible`),
  so displays may only stream for the active parameter page, needing page
  navigation to cover all params. Deferred; displayed values are available
  anyway via `createParameter` for typed devices, and normalized values
  suffice for CLAP readback. Revisit in Phase 1 if CLAP display strings are
  wanted.

### Decision impact (updates E4)

- **CLAP is IN scope for direct params** (enumerate + name + value + write),
  via DirectParameter. §6a "VST/CLAP" claim restored for CLAP; the
  differentiator is broader than E4 concluded.
- Param layer carries two APIs by role: DirectParameter for enumeration/CLAP,
  createParameter for typed pull-reads + displays.
- Write via DirectParameter: pass `resolution=1`.
- **Lesson:** a negative capability claim from a single missing-method grep
  is unsafe in this API — verify against the whole `Device` surface + a live
  test before recording an ○. (Good catch by the user.)

---

## E4 — Direct parameter layer (§6a differentiator) (2026-07-19)

**Verdict: ● the differentiating capability WORKS and exceeds the plan.**
`createParameter` gives named, valued, settable, repointable handles far
past the 8-per-remote-page ceiling, and the Bitwig-internal param IDs —
INITIAL_PROMPT's "harder case" needing semi-manual harvesting — turn out
to be **sitting in the app bundle as plain text**. Probe `e04`, all green.

### Enumeration proof (§6a "effective enumeration")

Pre-allocated 16 `SpecificBitwigDevice.createParameter(String id)` handles
on a repointable cursor device. Pointed at a freshly-inserted Polysynth,
14/16 resolved (2 harvested IDs were section markers, not params), each
**self-describing**: name + normalized value + human displayed value, e.g.
`F1FREQ="Filter Frequency"=2.59 kHz`, `F1RESO="Filter Resonance"=39.5 %`,
`OSCMIX="OSC 1/2 Mix"=0.00 %`. This is the WigAI issue-#15 gap closed:
arbitrary count of named params, not capped at 8. Params became live
**~194ms after device insert** (device insert itself ~144ms).

### Param ID harvesting — much easier than assumed (§6a upgrade)

Bitwig-internal device param IDs are readable straight from
`…/Bitwig Studio.app/Contents/Resources/Library/device-settings/<uuid>/
Default.bwpreset` (`strings | grep -E '^[A-Z][A-Z0-9_]{2,}$'`). Polysynth
yielded 63 tokens, ~14/16 sampled were valid createParameter IDs (rest are
section markers: CONTENTS, MODULATORS, FAKE1…). **No `can-copy-device-and-
param-ids` context-menu workflow needed** — the whole internal-device
catalog is harvestable offline from the bundle. Promotes §6a's "one-time
semi-manual harvest, plausibly a community artifact" to "a script over the
app bundle." (Validity still needs a resolve-check per ID against a live
device, since presets include non-param tokens.)

### Read/write + the take-over trap

- **`param.value().setImmediately(v)` works** (0..1 normalized); round-trips
  exactly and the displayed string tracks it (`0.25`→"75.4 Hz",
  `0.8`→"6.08 kHz").
- **⚠ `param.value().set(v)` is SILENTLY SWALLOWED** by the controller's
  take-over strategy (a plain `set` "may not be set immediately if the user
  configured a take over strategy" — value stayed exactly at the preset
  default). ⇒ **all agent param writes must use `setImmediately`, never
  `set`.** This is the param-layer analogue of E2's gain/pressure traps:
  another silent-no-op write path that only readback verification would
  catch. → DECISIONS.

### Repointing — the pre-allocation architecture question, ANSWERED

`createParameter` handles bind to the **cursor device**, not a fixed slot,
and follow it as it repoints:
- **Within a chain:** `selectDevice(bank.getDevice(i))` moved the cursor
  across two Polysynths; the same 16 handles read/wrote each independently
  (device[1] F1FREQ=0.1 vs device[0]=0.8, no cross-talk).
- **Across tracks:** pointing the parent cursor-track at gn-B moved the
  device cursor (FIRST_INSTRUMENT follow) to gn-B's device; handles read it.
- ⇒ **the §3a "pre-allocate a pool, repoint" strategy applies to params
  exactly as it did to clips (E1).** A modest pool of cursor-devices ×
  N param handles covers the session; no per-slot allocation explosion.

### Type specificity + pinning subtleties

- **`SpecificBitwigDevice(uuid)` view is device-type-specific:** pointed at
  a Polymer, all Polysynth param handles report `exists=false`. So a param
  pool must carry a view **per device type** we want deep access to (the
  cursor device itself still enumerates any device's name/position). Per-type
  ID catalogs are the unit of the eventual catalog.
- **Device-cursor `isPinned` is subordinate to its track cursor:** pinning
  the device cursor does NOT hold the device when its parent cursor-track is
  repointed (params jumped to gn-A's device after a track move). **The
  robust hold is: pin the TRACK cursor (E1) + address the device by
  `selectDevice(index)`.** With the track pinned, params stayed on gn-B's
  device (GAIN=0.33) under a selection change. → DECISIONS: device pool
  addressing = pinned track cursor + explicit device index, not device-pin.

### Scope note (superseded by E4b)

- The **typed** specific-device path is VST2/VST3/Bitwig only — no
  `createSpecificClapDevice`. My first reading ("CLAP direct params NOT
  accessible") was **WRONG**: it ruled out one path and missed the
  format-agnostic `DirectParameter` API. See E4b — CLAP params ARE
  accessible. VST index-path (`SpecificPluginDevice.createParameter(int)`)
  still unexercised (needs a known VST id-at-init); deferred.

### Decision impact

- **§6a differentiator confirmed buildable** — named/valued param access at
  arbitrary count, repointable via the pool model, with an offline-harvestable
  internal-device catalog. This is the genuinely novel capability and it holds.
- **Writes: `setImmediately` only** (take-over swallows `set`).
- **Device addressing model:** pinned track cursor + `selectDevice(index)`;
  per-device-type `SpecificBitwigDevice` views; pool of cursor-devices ×
  param handles sized in E5.
- **Param catalog:** promote to a straightforward Phase-1/2 deliverable
  (harvest bundle → resolve-check per device). CLAP excluded; VST via index.

---

## E3 — Structural ops & revert correctness (2026-07-19)

**Verdict: ● the optimistic-application posture is sound — native undo is
unusable for batch revert (as §8a predicted), and snapshot-based revert
works even for the hardest structural case.** Probes `e03` + `e03b`.

### The headline: undo granularity (§8a confirmed, decisively)

**Bitwig does NOT coalesce operations into undo transactions.** A 4-note
write took **exactly 4 undos** to unwind whether sent as one request
(4 `setStep` in a single handler call) or four separate requests. There is
no `beginUndoStep`/grouping hook in the API. Combined with the stack being
**project-global** (`canUndo` stayed true after we cleared our own notes —
our earlier structural ops were still on it), this kills native undo as a
revert mechanism outright: "undo the agent's last batch" maps to N global
history entries interleaved with the user's own edits. **Owning revert is
mandatory, exactly as INITIAL_PROMPT §8a assumed — now proven, not
assumed.**

### Revert-fidelity roundtrip (§8b confirmed)

Full cycle works: snapshot a clip's notes (verbose scan) → `deleteObject`
the whole clip → recreate via `createNewLauncherClip` → re-point cursor →
replay snapshot → readback matches exactly. **Structural delete is losslessly
reversible via snapshot replay**, no inverse-op algebra needed. This is the
§8b primitive demonstrated end-to-end on the launcher.

### Deletion surface — all four levels work

`deleteObject()` confirmed working with settle times:
Track ~140ms (E1) · ClipLauncherSlot ~24–145ms (E2/E3) · **Device ~140ms**
· **Scene ~instant**. Every structural create has a working delete ⇒ every
structural create is revertible.

### Devices (bonus E4 head start)

- **Insert Bitwig device by UUID works**: `cursorTrack
  .endOfDeviceChainInsertionPoint().insertBitwigDevice(UUID)`. Settle
  ~600–640ms (real plugin load, much slower than note/track ops — batches
  touching devices must budget for this).
- **Device chain re-indexes on delete** (like tracks): deleting device[0]
  shifted the survivor from index 1→0.
- **DeviceBank on a pool cursor track enumerates the chain** (name+exists);
  `itemCount()` gives true length.
- **Device UUID catalog harvested** from
  `…/Bitwig Studio.app/Contents/Resources/Library/device-settings/<uuid>/
  Default.bwpreset`: Polysynth `a9ffacb5-33e9-4fc7-8621-b1af31e410ef`,
  Polymer `8f58138b-…`, Sampler `468bc14b-…`, Test Tone, Organ, Sine, FM-4,
  Phase-4. The §6a "harvest a device catalog" idea is mechanically trivial
  for Bitwig internal devices — the whole map is sitting in the app bundle.

### Scenes — compaction + a real staleness trap

- `Project.createScene()` appends at the end (instant); `Scene.deleteObject()`
  via `sceneBank.getScene(i)` works.
- **Deleting a scene COMPACTS rows below it upward** (confirmed by pitch:
  markers at rows 9/10 moved to 8/9, row 10 emptied). So scene deletion
  shifts clip addresses — the launcher grid is not sparse/absolute.
- **⚠ A pinned cursor's `sceneIndex()` goes PERMANENTLY STALE after scene
  compaction** (still read 10 after 3.1s while the clip was really at row 9).
  Its content tracking and clip-object binding stayed perfect (pitch 64),
  and `trackPosition` tracks track-structural changes correctly (E1) — but
  `sceneIndex` does **not** track scene-structural changes on a held pin.
  ⇒ **after any scene create/delete, the executor must re-point/re-resolve
  cursors; never trust a pre-existing pin's sceneIndex across a scene
  structural op.** Note this interacts with our `point()` verification,
  which checks `sceneIndex === expected` — re-point fresh (re-run
  `selectSlot`) rather than trusting the stale pin.

### Two "FAILs" in the probe output — both are the findings, not defects

`e03` and `e03b` each show one FAIL: they are the *stale-sceneIndex*
behavior above, asserted as expectations that Bitwig violates. The
extension is behaving correctly; the assertions document real API
behavior. No open defect.

### Decision impact

- **Revert design (DECISIONS): own it via snapshot-replay; do not touch
  native undo.** Confirmed feasible and lossless for notes + structural
  delete.
- **Batch executor:** budget ~600ms per device insert; re-resolve cursors
  after scene ops; the existing "verify target before write" rule (E2)
  extends to "re-point after any structural change, don't trust held
  positional metadata."
- **Param catalog (§6a):** Bitwig-internal device UUID→name map is free
  from the app bundle; promotes the catalog idea from "semi-manual harvest"
  to "trivial for internal devices" (VST/CLAP still need the index-scan
  approach — E4).
- Full CRUD deletion surface confirmed ⇒ no structural op is a revert
  dead-end.

---

## E2 — Note round-trip fidelity, grid, observer gotcha (2026-07-18)

**Verdict: ● §5's "Exact" checkpoint-fidelity claim holds for the note
surface, with one asterisk (gain).** Probes: `e02` (full sweep, partially
contaminated by external project-state changes mid-run) + `e02b`
(clean re-characterization on known clips).

### Write/read mechanics

- **`setStep` is NOT visible in the same request** — immediate `getStep`
  after `setStep` in one handler returns `Empty`. It IS visible on the
  next request (~25ms incl. round-trip). ⇒ readback verification (§8c)
  must be a separate tick after the write batch, never inline.
- **`getStep` scan cost is trivial:** 512×128 grid = 65k steps scans in
  2–10ms; 64×128 in ~0.4–1ms. Full-clip snapshots are effectively free.
- **Observer gotcha, precisely characterized:** `getStep`/`NoteStep` needs
  NO subscription at all (works on a cursor with zero `markInterested`).
  Every `Value.get()` (exists, name, position…) throws
  `"Either call markInterested() or add at least one observer in init"`
  without a mark. ⇒ mark everything scalar; note data is implicit.
- **Muted notes remain visible** to the NoteOn scan with `isMuted=true` —
  snapshots see them.

### Expression property fidelity (21-property sweep; re-verified on clean fixture)

All setters accepted; round-trip exact (±2e-3) for: velocity,
releaseVelocity, velocitySpread, duration, pan, timbre (float noise only),
transpose (fractional ok), chance+enable, occurrence (enum)+enable,
recurrence (length+mask)+enable, repeat count/curve/velocityCurve/
velocityEnd+enable, isMuted. Two API quirks, both now precisely modeled:

- **`gain` reads back 2× the written value** (reproducible on clean
  state: set 0.7 → immediate read 0.7 [cached] → settled read 1.4; javadoc
  claims 0..1 both ways). Checkpoint restore mapping: write `read/2`.
  Verify the inverse mapping holds in Phase 1; likely a Bitwig doc/API bug.
- **`setGain` and `setTimbre` each RESET `pressure` to 0** (isolated in
  e02e; every other property is innocent; pressure re-set afterwards
  sticks). ⇒ property-write ordering rule: **pressure last** (or at least
  after gain/timbre) in any note-property batch — and §8c readback
  verification catches violations structurally.

### Grid

- **`setStepSize` works at runtime** (note at beat 1.0 re-indexed 4→8
  after 0.25→0.125 switch; needs a settle wait — not instant).
- **Triplet grids work** (stepSize 1/6 round-trips).
- **Off-grid notes are visible on coarser grids, snapped DOWN** (a note
  at beat 0.09375 scans as x=0 on the 0.25 grid) — coarse scans don't
  lose notes but misreport positions; snapshots should scan at the
  finest grid.
- ⇒ grid is a *view*; resolution is per-cursor and changeable. The
  contract can stay beats-native and quantize per operation to a chosen
  grid; no global init-time grid needed (daw-mcp's design was
  unnecessarily rigid).

### Addressing corollaries (feed the batch executor design)

- **Pointing at an EMPTY slot silently lands the cursor on the WRONG
  clip** — observed staying on the previous clip in one trial and
  attaching to a different clip on the target track (slot 0) in another;
  in both cases status looks healthy. ⇒ create-clip must precede
  pointing; the executor MUST verify the cursor's target (track position
  + scene index) before every write — a mis-point is undetectable
  afterwards from the cursor's own state.
- **No stale reads after clip deletion:** `ClipLauncherSlot.deleteObject()`
  (works, ~24ms) leaves the cursor with `exists=false`, scan returns 0
  notes. Cursor reads are trustworthy when `exists=true` + target
  verified.
- **The e02 cross-session anomalies are fully resolved by E2c** (track
  identity bug — see that section): the "fixture" was actually the FX and
  Master rows. Bonus discovery: `createNewLauncherClip` + full note
  editing WORKS on FX/Master launcher slots. After cleanup (E2d) the
  whole E1a + E2 suite re-ran green on a genuine instrument-track
  fixture.
- **Arranger cursor clip:** created fine; `exists=false` with no
  arrangement clip selected. Deeper arrangement probing stays out of
  scope (§9 lean).

### Decision impact

- Checkpoint design (§8b): full-fidelity note snapshots are cheap and
  exact (gain excepted) — snapshot = verbose scan of the write-set clips.
- Readback loop: write → next-tick verify → report; ~25ms per turn.
- Units (§7): contract in beats; extension quantizes via per-op stepSize.
- E3 signals banked: both Track and ClipLauncherSlot `deleteObject()`
  confirmed working.

---

## E2f — Stable track identity DOES exist: channelId (UUID) (2026-07-19)

**Verdict: ● E2c's "no stable track addressing" was too strong — I missed
`Channel.channelId()`, a per-track UUID (API 20+).** Prompted by the same
"did we miss part of the API?" challenge that surfaced CLAP. Probe `e02f`,
all green. bank index and name remain brittle (E2c stands on those), but
they are **not the only identifiers** — there is a stable one.

### What channelId is

`track.channelId()` → `StringValue`, javadoc "Reports the channel UUID."
Every track (incl. FX and Master) reports a distinct, UUID-shaped id, e.g.
gn-A = `b07f6b06-8f4f-4f4f-802d-ddf1a5190515`. (`channelIndex()`, API 22,
also exists but is just the mutable index as a value.)

### Proven stable (in-session)

- **Survives index shifts:** inserting a track ahead of gn-A/gn-B shifted
  their positions but their channelIds (and the tracks they name) were
  unchanged.
- **Survives rename:** renaming gn-A→"renamed-A" left channelId identical.
- **Clean tombstone:** a deleted track's UUID resolves to found=false — no
  aliasing onto whatever slid into its index.
- **Re-resolvable:** scanning the bank for a matching channelId returns the
  track's *current* index/name/type — the addressing primitive
  (`track.resolveByChannelId`). gn-A's UUID was byte-identical across
  separate probe runs and all structural churn this session; a
  delete+recreate of gn-B correctly minted a NEW UUID (recreated = new
  object).

### The addressing model this unlocks

**Address tracks by channelId, resolve to a live index/object on demand.**
This is the serializable identity E2c said was missing:
- Store channelId in patches/checkpoints, not bank index or name.
- On each operation, `resolveByChannelId` → current index → point a pool
  cursor (E1). Combines with E1's pinned-cursor *in-session* handle: UUID
  is the durable key, the pinned cursor is the fast live handle.
- The E2c fixture bug (identifying a created track by "last Instrument"
  positional heuristic → renamed/deleted the wrong track) is exactly what
  UUID-diff prevents. **The corrected probe identifies a newly-created
  track as "the channelId not present before"** — robust regardless of
  where `createInstrumentTrack` actually drops it (which E2f re-confirmed
  is inconsistent: the newcomer landed at index 0 here vs index 1 in E2c).

### Cross-SESSION persistence — ● CONFIRMED

User saved the project, fully quit Bitwig, and reopened. All six tracks'
channelIds matched the captured UUIDs **byte-for-byte** (gn-A
`b07f6b06-…`, gn-B `9096b9f6-…`, plus Inst 1/Audio 2/FX 1/Master).
channelId is a **persistent, serializable** identity that survives a full
application restart + project reload — exactly the durable key checkpoints
need. (Recreated tracks get a fresh UUID; a given track keeps its UUID for
the life of the project.)

### Decision impact (amends E2c)

- **Track addressing = channelId (UUID) as the stable key + resolve-to-index
  + pool cursor.** Supersedes "no stable addressing"; E2c's brittleness
  finding now applies specifically to *index and name*, not identity.
- Checkpoints/patches serialize channelIds, never indices/names.
- Same question worth checking for clips/scenes/devices: is there an
  equivalent stable id? (Slots are addressed within a track; scenes have
  `sceneIndex` which E3 showed shifts. Worth a pass in Phase 1.)
- **Lesson reinforced (twice now): don't record a capability ○ from a
  partial API pass.** channelId (API 20) and the DirectParameter API were
  both present and both initially missed.

---

## E2c — Track identity: the fixture-contamination root cause (2026-07-18)

> **Amended by E2f:** the "no stable track addressing" conclusion is too
> strong — `channelId()` (UUID) IS stable. This section's brittleness
> findings apply to **bank index and name specifically**, which remain the
> wrong things to address by. Read with E2f.

**Verdict: ● the cross-session anomalies were OUR bug — addressing tracks
by (bank index | name) is unsound. Three API facts, all confirmed by
controlled trials (`e02c`):**

1. **The flat TrackBank includes the FX section and the MASTER track**
   after the regular tracks. `trackType()` distinguishes them
   (Instrument/Audio/Effect/Master/Hybrid/Group). daw-mcp-derived code
   treated bank size as "number of regular tracks" — wrong.
2. **`Application.createInstrumentTrack(position)` does not honor bank
   positions:** requesting the end (9) landed at index 7 (end of the
   *regular* section, before FX/Master); requesting 0 landed at index 1.
   The position argument cannot be trusted; the only safe procedure is
   create → diff the bank → locate the new row empirically.
3. **Default track names auto-renumber** ("Inst 2", "Audio 3" are
   positional auto-names, not stable identities). Name-based identity is
   meaningless for unnamed tracks, and `setName(bankIndex)` renames
   whatever currently sits at that index.

**Combined effect on E1/E2 sessions:** every `ensureFixtureTracks` run
created a track that landed *not* at the assumed index, then renamed the
wrong row — accumulating orphaned "Inst N" tracks and, at least once,
sticking the fixture name onto the tail of the bank (the row typed
Master now carries the name "gn-A"). Cross-session name lookups then
found the wrong tracks, explaining the E2 phase D/E anomalies and the
user's "gn-A wasn't there" observation. In-session fingerprint-verified
results (all of E1's core verdicts, E2's mechanics) are self-consistent
and stand.

**Resolution (same day):** user visually confirmed (screenshots): the
Master row was named "gn-A", fixture clips lived on the FX/Master rows,
and the default template was Inst+Audio+FX+Master — every extra
Instrument row was a ghostnote orphan. Cleanup probe (`e02d`) removed
our clips from FX/Master, restored the Master name, and deleted the five
verified-empty orphans; fixture code (`lib.ensureFixtureTracks`) now
matches by name+type, locates created tracks as last-Instrument-row, and
poll-verifies renames. E1a and E2 both re-ran green on the clean fixture.

**Decision impact (batch executor / contract):**
- Track creation in the contract must return the *located* new track
  (create → diff → verify), never assume the requested position.
- All track addressing must be type-aware; Effect/Master rows are never
  fixture/rename/delete targets by index.
- Rename operations must poll-verify the rename landed where intended.
- This is the strongest argument yet for §8e verification semantics:
  every structural op needs its own readback, not just note writes.

---

## E1 — Addressing: pointing, pinning, cursor pool (2026-07-18)

**Verdict: ● address-don't-select is achievable.** The pool-of-cursors
architecture works: writes land on programmatically chosen clips and are
immune to concurrent user interaction. E1a: 26/28 (the 2 "failures" were
mechanism discovery, see below). E1b (interactive): all real checks passed;
the one FAIL was a mis-designed control test (see 4).

### The working architecture

Per pool slot: a dedicated `CursorTrack` created with
`shouldFollowSelection=false` + its `PinnableCursorClip`
(`cursorTrack.createLauncherCursorClip(w, h)`). Pointing mechanism —
the only one of three candidates that works (**"trackThenSlot"**):

```java
cursorTrack.selectChannel(trackBank.getItemAt(t));  // point the track
track.selectSlot(s);                                 // point the slot
// then pin: cursorClip.isPinned().set(true)
```

Settle is **~25ms, verifiable by polling** `clip.getTrack().position()` +
`clip.clipLauncherSlot().sceneIndex()` — vs. daw-mcp's blind 400ms sleep.

Rejected mechanisms: `slot.select()` alone (pool clips do not follow
global clip selection — their cursor tracks don't follow, and the clip
cursor is scoped to its track) and `CursorClip.selectClip(followerClip)`
(does not repoint cross-track; timed out).

### Evidence highlights

1. **Pool independence ●** — 3 cursors pinned to 3 different clips
   concurrently, each reads back its own fingerprint.
2. **User-interference immunity ●** — 20/20 write+readback cycles correct
   while the user clicked continuously around the session view
   (27 selection changes observed during the test window).
3. **Structural shift: pins follow the object ●** — creating a track at
   position 0 shifted the pinned cursor's reported position +1 with
   content intact; deleting restored it. Bank *indices* drift (fixture
   moved between sessions in testing) ⇒ the brain must resolve addresses
   to objects (via pointed cursors), never store raw bank indices.
4. **Selection-following is opt-in by construction ●** — pool cursors
   never follow user selection even unpinned (`followSelection=false` at
   creation). The E1b "control test" FAIL was this architecture working:
   the test wrongly expected an unpinned pool cursor to follow a click
   (compounded by clicking an already-selected clip = no change event).
   Pinning is belt-and-suspenders on top of a non-following cursor.
5. **`Track.deleteObject()` works ●** (~144ms settle) — early E3 positive:
   structural revert has a delete primitive at least for tracks.

### Wrinkles / carried questions

- **Pointing borrows the UI selection.** `selectSlot` visibly moves the
  user's selection (2 changes during 3-cursor setup; user confirmed
  visually). Not a correctness problem, but a UX wart under optimistic
  application. Phase-1 candidates: restore prior selection after a batch,
  and/or investigate selection-free pointing further. → DECISIONS.
- **Pin behavior when the user drags/moves the pinned clip is ambiguous ◐.**
  After drag-away, the cursor still reported sceneIndex=0 *and* 2 notes —
  consistent with either stale cached reads on a dead cursor or the drag
  not doing what we assumed. Needs a controlled retest in E2 including
  `clip.exists()` in every read (readback verification catches this class
  of problem regardless, per §8c).
- Reads on a non-existent/stale cursor may serve cached step data —
  E2 must characterize `getStep` behavior when `exists()` is false.

### Decision impact

- Addressing model (DECISIONS-to-be): **pool of pinned, non-following
  cursor tracks + clips; point via trackThenSlot; verify settle by poll;
  address objects, not indices.** Pool size TBD in E5.
- daw-mcp's `selectionDelayMs` approach is confirmed obsolete.
- §12 open question #1: answered **yes** (pinning survives user
  interaction), with the drag-a-pinned-clip caveat above.

---

## E0 — Toolchain bring-up (2026-07-18)

**Verdict: ● complete.** Extension builds, loads in Bitwig 6.0.6, and the
full TCP round-trip works. All 8 probe checks pass (`brain: npm run probe:e00`).

### Settled facts

| Item | Value |
|---|---|
| Bitwig | 6.0.6, reports `hostApiVersion` **25** at runtime |
| extension-api artifact | **25** (only version served on maven.bitwig.com; older versions are unpublished) |
| Extension runtime JVM | **Java 25** (Azul), bundled with Bitwig |
| Bytecode target | `--release 21` works; Bitwig's own bundled extensions are also major-65 (Java 21) |
| Build | Gradle 9.6 + local JDK 26 cross-compiling to 21; `gradle copyExtension` deploys |
| Transport | TCP loopback :8686, newline-delimited JSON-RPC 2.0 — confirmed incl. 20KB payloads, unicode, out-of-band error frames |
| Threading | requests marshaled via `host.scheduleTask` run on thread `"Control Surface Session"` |

### Gotchas discovered (the E0 blocker)

1. **Extension discovery is via ServiceLoader, not the manifest.** Bitwig 6
   requires `META-INF/services/com.bitwig.extension.ExtensionDefinition`
   listing the definition class. The `Extension-Class` manifest attribute
   (which daw-mcp's build.gradle sets) is ignored — daw-mcp's *released*
   jar contains the services file even though its Gradle build doesn't
   create it. Without it: `extension-registry error … No extensions found
   in <jar>`, and the extension silently never appears in the vendor list.
2. **The bundled javadoc's API-version annotations lag.** Newest "API
   version N" mentions in 6.0.6's bundled docs stop at 22, but the host
   actually serves 25. Trust `host.getHostApiVersion()` (or the maven
   artifact), not doc-annotation archaeology.
3. **Bitwig watches the Extensions folder and hot-reloads on file change.**
   Redeploying a running extension restarts it in place (bridge socket
   comes back up) — no Bitwig restart needed after the initial add. Errors
   from a failed scan appear in `~/Library/Logs/Bitwig/BitwigStudio.log`
   under `extension-registry`.
4. First-time activation is manual: Settings → Controllers → Add
   Controller → vendor "ghostnote" (no auto-detect with 0 MIDI ports).

### Decision impact

- Toolchain decision (DECISIONS-to-be): Java 21 target, extension-api 25,
  Gradle 9, Gson bundled. No obstacles found.
- Transport decision: TCP + newline JSON-RPC confirmed viable; strict
  per-line framing with -32700-and-continue verified (a malformed line
  does not poison the connection).
- Hot-reload (gotcha 3) makes the spike iteration loop fast:
  `gradle copyExtension` + rerun probe, no UI interaction.

---
