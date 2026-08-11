---
id: E11i
kind: evidence
state: active
source: FINDINGS.md
---

# E11i — CORRECTED: the "Zebra wall" was a phantom; Zebra 3 is FULLY surgery-general (CLAP + VST3) [K] (2026-07-24)

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
