---
id: E11h
kind: evidence
state: active
source: FINDINGS.md
---

# E11h — the modulator list is SENTINEL-terminated; this was the real gap (and killed the "Zebra wall") [K] (2026-07-24)

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
