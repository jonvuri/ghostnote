---
id: E18f
kind: evidence
state: active
source: FINDINGS.md
---

# E18f — ⚠⚠ ONE REBUILD IS SEVEN UNDO STEPS: the first real cost of the layer model, and it is a UX one [K] (2026-08-02)

**Verdict: ⚠⚠ the rebuild WORKS and it is EXPENSIVE in the one currency the operator
named.** `e18c` proved the mechanism; this runs the `reduce` shape end to end and
measures the three properties that decide whether it ships. Probe: `e18f`.

| | measured | reading |
|---|---|---|
| **COST** | **4276 ms** for 4→2 carrying 2 devices, 6 steps | tolerable, and the delete dominates |
| ⚠⚠ **UNDO** | ⚠⚠ **7 steps for ONE rebuild** | ⚠ **the real regression** |
| **ATOMICITY** | ⚠ **6 of 7 intermediate states hold BOTH containers** | one Cmd-Z lands mid-migration |

### ⚠⚠ The rule, and it generalises well beyond this row

    ONE STRUCTURAL API CALL = ONE UNDO STEP.

The trail is exactly legible against the six rebuild steps, in reverse:

| undo | what came back |
|---|---|
| 1 | the OLD container (un-deletes it — both now present) |
| 2 | `NEW1`'s migrated device |
| 3 | `NEW0`'s migrated device |
| 4 | `NEW1`'s name → `Layer 2` |
| 5 | `NEW0`'s name → `Layer 1` |
| 6 | the second chain (2 → 1) |
| 7 | the FX Layer itself |

⇒ ⚠⚠ **The user's single Cmd-Z does not undo "the take change" — it lands INSIDE the
migration**, with the old and new containers both present and the takes duplicated
across them. Under the TRACK model a branch is one operation and one Cmd-Z, and
**that is the comparison that decides this**.

⚠ **Not fatal on the operator's own bar** — *"it doesn't need to be perfect — track
branching isn't either"* — but it is a per-use cost the track model does not have,
and it is **invisible until the user hits undo once**. That makes it the same shape
as E17's priming hazard: a precondition nobody can see.

⚠ **It also reaches past this row.** Any multi-call operation we ever perform costs
the user N undo steps. That is a general property of the wire, measured here for the
first time, and it applies to the track model too wherever a gesture is more than one
call (fork + rename + lineage group = 3).

### Cost, stated so it is not over-read

| step | ms |
|---|---|
| insert the NEW container (FX Layer) | 777 |
| grow to 2 chains (`layer.select` + `duplicateChannel`) | 805 |
| name the 2 takes | 398 |
| migrate `OLD0` → `NEW0` (copy, across containers) | 297 |
| migrate `OLD1` → `NEW1` (copy, across containers) | 306 |
| ⚠ **DELETE the old container** | ⚠ **1688 — the single most expensive step** |

⚠ **These are WALL-CLOCK and settle-inclusive, poll-quantised at 200–250 ms, not API
latencies.** E17 measured `Device.deleteObject()` at 577 ms, so the 1688 above is
inflated by our own settle policy. Two honest readings: as *"how long the user
waits"* the wall clock is the right number; as *"what Bitwig costs"* it is an upper
bound. ⚠ **The migrations themselves are the CHEAP part** (~300 ms each), so cost
scales gently in the number of devices and is dominated by the fixed container
insert/delete — which is the good news in this table.

### ⚠ Method: the undo arm walks a PROJECT-WIDE stack, and that is dangerous

`app.undo` knows nothing about our fixture. Firing it blindly can undo the
**operator's own work**, which would be an unrecoverable side effect of a
measurement — by far the worst thing this probe could do. Four rails, all held:

1. A full **cross-track fingerprint** before the first undo — track list by identity
   plus the device list of every other track, ⚠ including `gn-A`, the Master and
   `FX 1`, which earlier probes **this same session** wrote to and which a runaway
   undo would reach first.
2. After EVERY undo, everything outside `gn-B` must be byte-identical; the moment it
   is not, the probe **redoes immediately** and aborts with a bound rather than an
   exact count.
3. A hard ceiling of 40 undos.
4. ⚠ Every undo **redone** at the end — verified: `gn-B` returned to the rebuilt
   shape and the outside world was untouched. **Measuring must not mutate.**

⚠ The arm is worth the care because the answer cannot be reasoned out: Bitwig decides
its own undo granularity and nothing in the API documents it.

---
