# D61 — R01 package v4: harder tasks over the same inputs

Date: 2026-10-27. Status: accepted by the operator.

After [E371](../../../context/evidence/experiments/e371-r01-package-v3-one-repeat-check.md),
Haiku 5.5 passed all 67 cells on the first attempt at its lowest effort, so the
package no longer separated the formats for that cohort. The operator chose to
skip the three-repeat v3 pass and approved six ways to make the tasks harder.
Package `pilot-development-v4` applies them.

## Package v4 (`pilot-development-v4`)

Package v4 keeps input v2, prompt revision 2, the cards, scoring (D59),
feedback and the 67 eligible cells with their 17 exclusions. It changes the
following, each under task revision 4 (rules schema `r01-pilot-task-rules-v3`):

| Change | Task (new ID) | What makes it harder |
|---|---|---|
| Per-note arithmetic and boundary read | `p01-read-sounding-at` (work C) | Count notes sounding at T (onset ≤ T < onset + duration). T is the note onset nearest quarter 8 at which another note ends and a third is held across; it is 1919/256. Counting onsets before T, excluding notes that start at T or including notes that end at T all give a different count. |
| More targets per edit | `p06-transpose-every-pitch` (work C) | Transpose every note of one pitch: the pitch with the most notes from 5 to 10 that can all move up two semitones without colliding (pitch 34, eight notes across the window). |
| Off-grid group arithmetic and a second step | `p07-halve-spread-move-anchor` (synthetic) | A six-member group with three odd spread cells, so halving gives 1/1024 values; the anchor also moves. Each member onset must be recomputed. The protected group shares two members. |
| Two-step edit with onset bounds | `p08-shift-transpose-range` (work A) | Shift by 1/8 and transpose up two semitones every note in [F, T). Both bounds are note onsets (1213/256 and 3471/512), so the note at F must move and the note at T must not. |
| Near-miss selector | `p09-delete-near-miss` (work B) | The p10 wording, but the second note of the same pitch sits exactly at the excluded upper bound, so the correct answer is the deletion, not a refusal. |

p01 moves from work A to work C, because work A has no onset at which another
note ends. p02–p05, p11 and p12 are unchanged.

**Conditional-refusal response line.** In v3 the response line differed by
task type: "Return only the specified REFUSE code when its condition holds."
for p10 and "Return only the complete native output surface." for writes. This
line would reveal whether p09 is a refusal. p09 and p10 now share "Return the
complete native output surface, or only the specified REFUSE code when its
condition holds." p10 therefore carries version 2; its input and oracle are
unchanged.

The task-specific rehearsal has new wrong answers for each replaced task, such
as the near-miss refusal on p09, both bound errors on p08 and grid-floored
halves on p07. All 418 are rejected; none is dropped as equal to the oracle.

Packages v1–v3 are retired for new starts and still load for analysis. The
retained v3 execution manifest still regenerates except for its source-file
hashes, because the shared harness files changed.

## Not changed

Authoring (p03, p04) and preservation (p11, p12) are unchanged, as are the
cards, cohorts, effort settings, order seed, repeats and the stall policy.
Development-stage results on v4 are not comparable cell for cell with v3 for
the five replaced tasks.
