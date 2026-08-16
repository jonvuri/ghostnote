---
id: E38
kind: evidence
state: active
source: phase-1-session-5g-repair-two-clip-revert-confirmation
---

# E38 — Pin confirmation polls without restarting the point [K] (2026-08-16)

**Verdict: target confirmation and dual-pin confirmation are now separate
states. A confirmed target keeps its pending pins while the bounded retry polls
them. The focused two-clip revert and independent readback pass.**

## Diagnosis

The pre-repair filtered `C-revert` case and the focused durable-track sequence
both passed. Thus, the E37 delay did not reproduce on demand. Attempt tracing
still exposed a deterministic retry defect. A pin miss restarted the complete
point, which first unpinned both handles. Each retry canceled the pin state that
it was waiting to confirm.

The final focused run recorded target and pin checks separately. Complete
target replies arrived in 89–102 ms. Complete dual-pin replies arrived in
67–74 ms after the pin frames. This run settled on the first check for each
state. E37 remains the evidence that the same state can exceed one check under
the full-suite load.

## Repair

`LiveAdapter.pointAtClip` now has target and pin-confirmation states. A target
miss repeats the complete unpin and point sequence. After the exact target
arrives, a pin miss keeps both pin requests active and polls status in place.
It repeats the point only if the target moves.

The operation still has eight attempts. Acceptance still requires the exact
track, exact row, cursor-clip pin, and cursor-track pin in one status reading.
The final refusal now says whether the target failed or the target arrived but
one or both pins failed.

The offline cursor model can delay pins for several settle cycles. One
regression confirms that three-cycle pin settlement does not resend the point
or pin frames. A second confirms that pins which never settle refuse after the
eight-attempt bound. The earlier never-arrives target regression remains green.

## Live result

The focused probe now includes the complete expression write, executor clear,
revert, and independent readback ordering. All ten checks passed. The executor
stashed both clips, the revert completed, and cursor 2 independently read pan
`-0.25` from clip A and `0.5` from clip B.

Cleanup removed both temporary clips. Final readback matched all 10 durable
tracks, 10 scenes, launcher occupancy, selection at track 0 row 1, the exact
empty observation record, `Change · 4a-live-check`, and stopped transport. All
three cursor tracks and clips were unpinned on `gn-lay` row 0.

## Verification

- Focused cursor regressions: 6/6.
- Full offline check: 545/545, with typecheck green.
- Extension Gradle test: pass.
- Live handshake: 134 methods / `c2aa57be11e1f47e`; deployed build fresh.
- Focused live two-clip revert: 10/10; exact cleanup.
- Context check and `git diff --check`: pass.

## Decision impact

D6 now separates target acquisition from dual-pin settlement. A retry cannot
cancel pending pins after the target is confirmed. Session 5g must run again in
one complete invocation. The focused result does not complete it.

## Retrospective

A cleanup probe must restore the documented fixture selection. Restoring only
its entry selection can preserve residue from an earlier failed run. No
repository instruction change is needed.
