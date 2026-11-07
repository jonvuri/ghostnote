# R01-D19 — Round 2: format-dependent task families before step 6

Date: 2026-10-30. Status: **accepted by the operator** ("I agree with those
new task families (especially since they seem to provide more color on what
the new C3 / C4 formats are aimed at addressing), but why add one stronger
model? … simply adding those harder tasks without changing models might bear
fruit?", then "Yes. Draft that and write to the brief docs").

## Context

The brief's step 6 proposed a tool-loop evaluation and stronger cohorts after
the development pass. [E387](../../../context/evidence/experiments/e387-r01-round2-v3-development-pass.md)
argues against both for now:

- **Haiku is under-challenged.** Its v3 pairs were 60 discordant, 57
  both-pass and 3 both-fail. Luna's were 63, 53 and 28.
- **Corrections already act as a short tool loop.** Within two corrections,
  Haiku reaches 47–48/48 on reads and 72/72 on writes in both C3 and C4
  FIELDS, so its format differences vanish under feedback. Luna's write
  difference survives: C3 60/84, C4 82/84.
- **Stronger cohorts would saturate the current tasks** and need their own
  admissions.
- **Count scaling barely raises difficulty.** Scaling the count of
  independent operations (E384) did little; the families R01-D15 deferred
  target representation instead.

## Decision

- **Step 6 becomes task design.** New families make difficulty come from how
  a format represents structure: derived timing, overlapping memberships,
  large surrounding state, and interpretation provenance. They are what C3
  and C4 FIELDS are meant to address. The brief's handoff of 2026-10-30
  (after E387) lists them.
- **Cohorts stay Haiku 5.5 `low` and Luna `high`,** with per-cohort ladders
  (R01-D11) aimed at about 50% first-attempt success and many discordant
  pairs.
- **Method.** Calibrate with one instance per level and one repeat, then run
  a fresh-instance pass with one repeat (R01-D18). Analyse with the
  E386/E387 model, pinning the instance × format term without repeats.
- **Deferred.** The tool-loop evaluation, stronger cohorts and the round-2
  freeze. They are reconsidered only if the new families saturate both
  cohorts, or if a question needs them. The transfer question (do results
  hold for the stronger agents the product serves) is the main reason to
  add a stronger cohort later.

## Consequences

- The brief's agentic-evaluation criteria remain recorded but no longer
  trigger step 6 by themselves. The correction data answers most of what a
  loop would measure at current difficulty.
- C4 FIELDS against the baseline formats on performed material stays open.
  Larger real windows need material beyond works 4–6.
