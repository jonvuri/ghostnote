# Phase 8c4d harder medium-difficulty directional protocol

## Purpose

Test whether one more task-only complexity increase moves OpenAI medium
reasoning away from the v16 ceiling. Do not select a format or estimate a
population effect.

## Stable design

Keep all three v15 formats, neutral analysis output grammar, strict and loose
parsing, case and component scoring, balanced adjacent format blocks,
provider-default temperature, no retry, no repair, exact cost accounting, and
the approval boundary.

Use OpenAI at medium reasoning with a 12,000-token output limit. Vary task
content only.

## Directional cohort

Use ten unique prompts for each decision family and one sample for each format.
This gives a 10-point prompt-level result step. Report case and component
results as primary. Do not describe this screen as a powered comparison.

- Analysis uses three independent hard chord and eight-value motif cases per
  prompt. It interleaves source events and eight distractors.
- Affine continuation uses six notes and one explicit affine parameter set for
  each voice. It requires a canonical sort after transformation.
- Literal serialization remains a two-prompt positive control.

The total is 66 OpenAI messages.

## Decision

Return `expand-confirmation` only when both decision families have median
format global component accuracy from 60 through 95 percent, every format has
at least 90 percent structural validity, and all operational gates pass.

Return `revise-harder` above the accuracy bound, `revise-easier` below the
floor guard, or `invalid` after an operational or structural failure.

Stop after OpenAI. Do not run Haiku for any non-promising result. A promising
result still needs a new frozen Haiku supplement, exact cost authority, and
explicit approval.
