# R01-D20 — Round 2: format-dependent family designs, ladders and calibration packages

Date: 2026-10-30. Status: **accepted by the operator** ("These choices are
fine with me. Proceed with the calibration run."). The offline build is
[E388](../../../context/evidence/experiments/e388-r01-round2-format-dependent-families-offline.md).

## Context

[R01-D19](r01-d19-round-2-format-dependent-families-before-step-6.md) makes
step 6 of the [round 2 brief](../../../context/work/r01-round-2-difficulty-scaling.md)
task design: new families whose difficulty comes from how a format represents
structure, run on Haiku 5.5 `low` and Luna `high`. The brief's handoff
sketched the families and left their details to implementation.

## Decision

**Families.** All four families run, including the optional interpretation
family. Each is synthetic (seed `r01-round2-families-v1`), scales one axis,
and runs on C3 and C4 FIELDS only.

| Family | Task | Axis and calibration levels |
|---|---|---|
| Query-selected edit (`query`) | Select by input performed onset in [X, Y): transpose those notes up 12 semitones, and move the anchor of every timed group with a member in range later by an odd multiple of 1/16 | Timed groups scanned: 4, 8, 16, 32. Half are near-miss groups planted at the bounds (latest member at X − d or X + d; earliest at Y + d or Y − d) |
| Overlapping memberships (`overlap`) | Four changes: retime an owner group that references other notes, double the spreads of a timed overlay that references notes, set one heavy note's spread, and remove another heavy note from one non-owner group only | Memberships of each heavy note: 2, 4, 6, 8 (L + 1 overlay groups) |
| Edit within large state (`large`) | Move one member between adjacent groups and retime one group, inside a rich document (channels, expression, annotations, chance, mapped and note-local nominal timing, inferred groups, presentation orders) | Notes: 64, 128, 256, 384 |
| Interpretation maintenance (`interp`) | Mixed edits (spread, velocity, pitch, duration, anchor, loose onset), then exactly the contract's lifecycle updates | Edits: 2, 4, 8, 12 |

- **Order.** Note-array order equals C4 block traversal in every input and
  expected state, so neither surface needs order cells and no edit changes a
  note's home.
- **Lifecycle.** The existing task contract already states the rules. The
  interpretation oracle agrees with the reference editor (`structured.mjs`
  `editNote`) wherever that editor applies. The other families avoid
  lifecycle triggers on edited notes, so they measure only their own axis.
- **Large-edit cap.** The top level is 384 notes (about 21k output tokens
  in C3). At 512 notes, an answer would need about 28k tokens, well beyond
  the 19k proven in v2's preservation runs and close to common CLI output
  limits. A truncated answer would look like a format failure.
- **No diagnostics.** The C4 JSON control is deferred until a family shows
  a C3/C4 split that needs encoding separated from layout.

**Packages and selection.**

- Packages `round2-development-v4-haiku` and `round2-development-v4-luna`
  share the same ladder and prompts. Each holds 16 tasks (4 families × 4
  levels × instance 1) and 32 eligible cells. The ladders may diverge after
  calibration (R01-D11).
- Selection v4 (seed `r01-round2-order-v4`) is v3's per-cohort selection. Its
  full pass is labeled `calibration`.
- Timeouts follow R01-D12 (180–1,360 s).
- The controls are v3's: Claude context policy v2, Codex context policy v5,
  and the R01-D16 and R01-D17 continuations.

**Calibration (step 2), on approval.** Each package runs its full pass as one
process, with both cohorts in parallel: 32 initial runs per cohort, at most
96 submissions. Expected duration is about an hour.

**Level choice after calibration.** Choose per-cohort levels near 50%
first-attempt success, with C3/C4 discordance in view. Then build package v5
on fresh instances (about 12 × 1 repeat) for the development pass (step 3).

## Consequences

- The proposed levels are guesses. Large-edit and query-edit can be extended
  synthetically if a cohort stays at the ceiling. Overlap-edit and
  interp-maintain can scale further by adding memberships or edits.
- Analysis reuses the E386/E387 model. All four families are writes, so the
  read × format term does not apply to them; family-level C4 effects need
  enough fresh instances in the development pass.
