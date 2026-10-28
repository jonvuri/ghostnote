# D64 — R01 Luna cohort effort: medium for the rigorous stage

Date: 2026-10-28. Status: accepted by the operator (freeze-review item 4a).

E365 set both cohorts to `low`: Haiku 5.5's lowest effort and the matching
Luna setting. After E375, Luna at `low` failed 42 of the 87 v5 cells in every
repeat. Two development probes then ran every v5 cell at `medium`
([E376](../../../context/evidence/experiments/e376-r01-luna-medium-effort-floor-tasks.md),
[E377](../../../context/evidence/experiments/e377-r01-luna-medium-effort-remaining-tasks.md)).

## Decision

The rigorous-stage Luna cohort runs `gpt-6-luna` at **`medium`** reasoning
effort. Haiku 5.5 stays at `low`. Effort is not tuned per format.

## Rationale

- At medium, cells that fail every repeat fall from 42 to 29, and mixed cells
  rise from 11 to 18. More cells can register a format difference.
- First-attempt passes rise from 119 to 145 of 261. The gains are in boundary
  and multi-step tasks (p01, p08, p09, p16), not on tasks already near Luna's
  ceiling.
- The study asks which format helps capable agents. At low, part of C3's
  source-task deficit comes from Luna failing to recompute explicit onsets,
  which medium partly fixes. The narrower C3/C4 FIELDS gap at medium (10
  versus 16 of 24, against 6 versus 15 at low) is taken as the more
  representative result, not as lost signal.

## Consequences

- Median output per initial answer rises about 1.3× (E377). The Haiku-to-Luna
  generated-token gap shrinks from about 5× to about 3.6× by median; report it
  with results.
- The p10 refusal fell from 9 to 4 of 18 first-attempt at medium; it is
  reported as a behaviour change.
- Codex context policy v3 audits `reasoning.effort` against the profile, so
  the medium cohort needs no further policy change on Codex 0.163.0.
- The development package v5 and its execution manifest keep Luna at `low`;
  E373–E375 remain low-effort results. When the operator freezes, the
  `codex-current` profile changes to `medium` together with the rigorous
  execution manifest. The development-only `codex-current-medium` profile
  then has no further use.
