# R01-D8 — Round 2 is a version reset; the next rigorous round reuses works 1–3

Date: 2026-10-28. Status: accepted by the operator; the development-material
rule was confirmed on the same day.

The rigorous run ([E379](../../../context/evidence/experiments/e379-r01-rigorous-three-repeat-run.md))
left Haiku 5.5 near the ceiling and Luna near the floor on several tasks.
The operator approved a second development round built on difficulty-scaled
tasks and saturation-resistant measures
([brief](../../../context/work/r01-round-2-difficulty-scaling.md)). Only five
reserved works (7–11) remain unopened.

## Decision

- **Version reset.** Round 2 changes the task set, difficulty, window rules
  and metrics substantially. It is a new design version, not a revision of
  package v5 or `pilot-rigorous-v1`.
- **Work reuse.** After round 2's development stage, the next rigorous round
  restarts the seeded work order at works 1–3 (*Re:turning*, *Our Taproot*,
  *Good Lies*) and proceeds through the order as needed. Works opened earlier
  under the previous version are eligible again.
- **Development material for round 2.** Works 1–3 are not used while round 2 is being tuned,
  since they return as its rigorous material. Round 2 develops on works 4–6,
  which the first rigorous round consumed, and on a new synthetic seed.
- **Results stay separate.** E379 remains the rigorous result of the first
  version. Round-2 results are never pooled with it.

## Rationale

The protection that matters here is against design tuning on the material,
not model memory: every submission is a fresh, stateless call. Tasks,
windows and difficulty change under the reset, so earlier exposure of works
1–3 under the old tasks does not inform round-2 tuning, provided round 2 is
tuned on other material. This conserves the unopened works 7–11.

## Consequences

- The first round's freeze (R01-D1–R01-D7) does not bind round 2. Round 2
  drafts and freezes its own versions before its rigorous stage.
- The work-order record gains a round label. A round-2 rigorous selection
  skips round-2 development works, not round-1 works.
