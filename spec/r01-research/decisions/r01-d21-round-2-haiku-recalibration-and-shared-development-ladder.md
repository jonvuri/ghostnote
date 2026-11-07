# R01-D21 — Round 2: Haiku recalibration and a shared development ladder for the families

Date: 2026-10-31. Status: **accepted; delegated by the operator** ("Proceed
to test Haiku on higher levels to recalibrate it, and then make a call on
your own of which levels to support for Haiku. If we do go up a difficulty
level, then set up both levels for both models so that we test each model on
the same tasks overall. Then run the full development pass."). The rule
below was written before any v5 result existed.

## Context

[E389](../../../context/evidence/experiments/e389-r01-round2-v4-calibration.md)
calibrated the format-dependent families
([R01-D20](r01-d20-round-2-format-dependent-family-designs-and-calibration.md)).
Haiku 5.5 `low` passed 30/32 on the first attempt, so it saturates every v4
level. Luna `high` passed 12/32, and 8 of its 16 C3/C4 pairs were
discordant.

## Decision

**1. Haiku recalibration (package `round2-development-v5-haiku`).** One
instance per level and one repeat, on C3 and C4 FIELDS, at these levels:

| Family | Levels |
|---|---|
| query-edit | 48, 64, 96 groups |
| overlap-edit | 12, 16, 24 memberships |
| interp-maintain | 16, 24, 32 edits |

Large-edit is not probed, because the R01-D20 output cap stops it at 384
notes.

**2. Haiku's levels (pre-stated rule).** For each probed family, consider
the probed levels together with the E389 levels. Haiku's *break* is the
lowest level at or above the v4 top level at which Haiku fails at least one
of its two first attempts (C3 or C4).
- **Break found:** Haiku's development levels are the break and the next
  probed level, or the break alone if it is the top level.
- **No break:** Haiku is reported as saturated, and its development level is
  the top probed level.
- **Large-edit:** Haiku has no levels of its own.

**3. Luna's levels (from E389).** These are levels at or between the
discordant cells, staying off the floor:

| Family | Levels |
|---|---|
| query-edit | 8, 16 groups |
| overlap-edit | 4, 6 memberships |
| large-edit | 128, 256 notes |
| interp-maintain | 2, 4 edits |

Interp is at Luna's first-attempt floor everywhere, so it takes the lowest
two levels.

**4. Shared development ladder.** Each family's development levels are the
sorted union of Haiku's and Luna's levels. Both models run the identical
task set: packages `round2-development-v6-haiku` and
`round2-development-v6-luna` hold the same tasks and prompts.
- 12 fresh instances (2–13; instance 1 was used in calibration) × 1 repeat
  (R01-D18).
- C3 and C4 FIELDS; no diagnostics.
- Selection v6 (seed `r01-round2-order-v6`) labels the full pass
  `development`.
- Both models run in parallel under v3's controls.

**5. Analysis.** Use the E386/E387 model per model, with family-level C4
effects and level as a cell effect. Report sign tests on discordant pairs
per family, and each model's levels separately (Luna's levels, Haiku's
levels).

## Consequences

- Each model also runs the other model's levels. Cells at a model's ceiling
  or floor add little paired information, but they keep the task sets
  identical, as the operator asked.
- If Haiku saturates every probed level, the families do not challenge it at
  any practical size. That outcome is reported and bears on the deferred
  stronger-cohort question (R01-D19).
