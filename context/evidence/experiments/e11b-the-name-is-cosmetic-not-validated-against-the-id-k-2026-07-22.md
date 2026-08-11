---
id: E11b
kind: evidence
state: active
source: FINDINGS.md
---

# E11b — the `0x02b9` name is cosmetic, not validated against the `0x1a1b` id [K] (2026-07-22)

**Verdict: ● a modulator's `0x02b9` display-index name need not match its `0x1a1b`
instance id — both `name="5"/id=1` and `id=5/name="1"` load (ids kept unique). Only
`0x1a1b` uniqueness gates load; the name string is not cross-checked against it.**
Probe `e11-load` + `build_e11bc_cases.py`, one-field edits on modtest.

Resolves the BWMOD_DESIGN §5-U2 open question: `bwmod` may treat `0x02b9` as cosmetic.
Keeping `name == id` remains the tidy default (matches what Bitwig writes), but it is
not a correctness requirement — freeing add/delete from any name-renumbering duty.

---
