---
id: E16u
kind: evidence
state: active
source: FINDINGS.md
---

# E16u — a branch costs ~20 KB on disk and nothing in save time [K] (2026-07-31)

**Verdict: ● measured, and disk is NOT the binding constraint.** Owed since row
C4, which recorded a baseline and stopped. Probe: `e16u-filesize.ts`, four forks
of the heavy fixture, two human ⌘S.

| | |
|---|---|
| baseline | **404,130 bytes**, 10 tracks, ~1 s save (user report) |
| after 4 forks of `gn-E16` | **485,694 bytes**, 14 tracks, **~1 s** — *"exactly the same, perceptually"* |
| delta | **+81,564 bytes over 4 forks ⇒ 20,391 bytes per fork** |
| the fixture's own cost | ~45 KB (C4), so a fork is **0.45×** the original |

⚠ **The old baseline was STALE and was not used.** C4's 385,619 was the
2026-07-26 13:12 backup; the file was already 403,236 by 16:01 that day and had
been churned through two further sessions. Differencing against it would have
measured two sessions of unrelated work.

⚠ **The compression confound was ruled out rather than assumed.** Four *identical*
forks are the best possible case for a compressor, which would have made 20 KB a
floor rather than a cost. `gzip -9` takes the project from 485,694 to 46,021
bytes — **ratio 0.095** — so the file is stored **largely raw** and the delta is a
genuine per-copy cost.

⇒ **Extrapolated, a full 26-fork `A·`–`Z·` lineage adds ~530 KB to a 404 KB
project**, and save time did not move at all across 10 → 14 tracks. **The bank
window (§3.4a) remains the binding constraint on the branch budget; disk is not.**

⚠ **What is NOT measured:** these forks are identical to their original. A real
branch diverges, and divergent device state may not share whatever these shared.
20 KB is the cost of a *fresh* fork, not of a heavily-edited one.

---
