---
id: E11d
kind: evidence
state: active
source: FINDINGS.md
---

# E11d — modulator surgery is GENERAL across FX + CLAP, but Sampler REJECTS it [K] (2026-07-22)

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
