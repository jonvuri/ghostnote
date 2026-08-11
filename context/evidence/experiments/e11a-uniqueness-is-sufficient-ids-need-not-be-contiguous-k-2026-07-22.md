---
id: E11a
kind: evidence
state: active
source: FINDINGS.md
---

# E11a — `0x1a1b` uniqueness is sufficient; ids need NOT be contiguous [K] (2026-07-22)

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
