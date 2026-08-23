---
id: E65
kind: evidence
state: active
source: phase-5-session-5a-modulator-add
---

# E65 — Checkpointed modulator add is live [K] (2026-08-22)

**Verdict: one curated modulator add now runs through the executor, returns a
revertible take, and proves live modulation through one exact remote selector.**

## Product path

`authorModulatorAdd()` reads one absolute template, loads a curated donor, adds
its route, and runs `validate()` before any project write. It writes the edited
preset to a fresh temporary directory and loads it through `device.insert`.
The executor returns the take and the observed device address. The temporary
preset is removed after the apply call.

The result calls the preset load structural. Its `exact` restore label applies
only to deleting the observed insertion and restoring the prior absence. It
does not claim byte-exact readback of opaque preset state.

The path keeps these refusals:

- A relative or non-preset template path refuses before file access.
- An unmeasured donor on a sampled preset refuses before `apply()`.
- A remote name that has zero or several exact candidates is not proof.
- Host automation, unknown automation state, base movement, or no
  base-to-`modulatedValue` divergence is not proof of the authored route.
- A caller cannot set a zero divergence threshold to bypass the liveness proof.

## Live proof

The focused probe created one owned instrument track and used the human-saved
Polysynth bare template. It added `lfo-sampler` with amount 1 and routed it to
`CONTENTS/F1FREQ`.

| Check | Result |
|---|---|
| Executor checkpoint | Applied, with one observed device mint at chain index 0 |
| Structural report | `modulator.add`, 0 to 1 modulators, no validation warning |
| Exact witness | Page 3 `FILTER`, control 0 `Filt Freq` |
| Samples | 10 samples at 80 ms intervals |
| Maximum divergence | 0.0036105915451828396 |
| Base spread | 0 |
| Reversal | Deleted the observed device; no unrestored state |
| Cleanup | Removed the owned track and restored the exact seven-track entry list |

The first selector attempt used the control name alone. The complete host
inventory returned three candidates: `FILTER`, `FILTER/EG`, and `Common`.
Name-only verification refused. The final proof used the exact `FILTER` page.

## Observer repairs

Remote inventory settlement now compares page and control identity only. It
does not compare dynamic `modulatedValue` data. The returned inventory still
uses the newest sampled values.

A new remote observation generation also seeds its pages from the current
confirmed device. Re-selecting the current device does not produce another
page-name callback. Exact target acquisition now happens before the generation
reset.

## Verification

- `npm run check`: 768/768 pass.
- Focused adapter and authoring tests: 92/92 pass.
- `./gradlew test`: passes.
- `npm run probe:phase5a-authoring`: all five live checks pass.
- The exact accepted project track list is restored after each live attempt.

The authoring fixture reads the generated preset while it exists, confirms its
edited route, and validates it. A post-validation observer confirms that the
same bytes reach the executor only after the validation gate passes.

## Qualification

This result proves one add on an unsampled Polysynth template. It does not yet
prove replace, retarget, delete, sampled-preset relocation, container routing,
or a public tool.

## Retrospective

The live selector refusal made the duplicate host pages explicit. Future
modulation probes must name both the page and control in their planned witness.
Proof thresholds and optional observer fields must have fail-closed boundary
tests.
