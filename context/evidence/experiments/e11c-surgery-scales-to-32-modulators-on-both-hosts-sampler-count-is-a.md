---
id: E11c
kind: evidence
state: active
source: FINDINGS.md
---

# E11c — surgery scales to 32 modulators on both hosts; Sampler count is a real u32 [K] (2026-07-22)

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
