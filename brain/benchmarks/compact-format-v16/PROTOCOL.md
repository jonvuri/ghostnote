# Phase 8c4d medium-difficulty directional protocol

## Purpose

Test whether increased task complexity moves Gemini medium reasoning away from
the v15 ceiling. Do not select a format or estimate a population effect.

## Stable design

Keep all three v15 formats, neutral output grammar for analysis, strict and
loose parsing, case and component scoring, balanced adjacent format blocks,
provider-default temperature, no retry, no repair, exact cost accounting, and
the approval boundary.

Use Gemini at medium thinking with a 12,000-token output limit. Vary task
content only.

## Directional cohort

Use ten unique prompts for each decision family and one sample per format.
This gives a 10-point prompt-level result step. Report case and component
results as primary. Do not describe this small screen as a powered comparison.

- Analysis uses one hard seventh or diminished chord and one eight-value motif
  pair per prompt. Eight represented distractor notes increase local binding
  work without changing the output fields.
- Affine continuation keeps the repaired v15 formula. It uses interleaved
  voices, irregular rational timing, and less convenient factors.
- Literal serialization remains a two-prompt positive control.

The total is 66 provider messages.

## Decision

Return `expand-confirmation` only when both decision families have median
format global component accuracy from 60 through 95 percent, every format has
at least 90 percent structural validity, and all operational gates pass.

Return `revise-harder` above the upper accuracy bound, `revise-easier` below
the floor guard, or `invalid` after an operational or structural failure.

Do not start another provider, add fixtures, or run a confirmation cohort
without a new frozen plan and explicit operator approval.
