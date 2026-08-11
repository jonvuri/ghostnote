---
id: E11f
kind: evidence
state: active
source: FINDINGS.md
---

# E11f — same-TYPE repeated ADD loads; `addModulator` needs no id-freshening [K] (2026-07-22)

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
