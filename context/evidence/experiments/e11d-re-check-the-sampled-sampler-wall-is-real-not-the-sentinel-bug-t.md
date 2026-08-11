---
id: E11d
kind: evidence
state: active
source: FINDINGS.md
---

# E11d RE-CHECK — the sampled-Sampler wall is REAL (not the sentinel bug); two-tier map confirmed [K] (2026-07-24)

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
