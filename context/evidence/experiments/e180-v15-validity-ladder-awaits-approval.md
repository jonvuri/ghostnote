---
title: E180 — V15 validity ladder awaits approval
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4d-follow-up-v15-validity-ladder.md
---

# E180 — V15 validity ladder awaits approval

## Verdict

The v15 offline package passes. It is frozen at the provider-approval
boundary. No live provider or token-count call occurred.

## Repair

V15 fixes the affine expression as
`pitch=(2*axis)-source_pitch+semitones`. It also gives a neutral numeric
example. The exact JSON serialization prompt now uses JSON keys and string
values. It does not leak compact `BASE` or `SOURCE` syntax.

The analysis cohort uses three one-case fixtures, three two-case fixtures, and
two four-case fixtures. Literal serialization is a positive control. Affine
continuation and two-case analysis are moderate. Four-case analysis is stress
work. The shuffled schedule interleaves these levels and keeps every
three-format task block balanced.

## Scoring

V15 removes whole-response musical scoring. Each analysis case has eight
components. Each document note has six components. Document context checks
are response components.

Every primary report cell includes:

- global component correct, planned, and accuracy;
- average per-case component accuracy; and
- perfect case count, total case count, and perfect case rate.

A parse failure keeps every planned case and component with zero credit for
values that cannot be read. Unavailable provider responses remain outside the
scored denominator.

Exact-object JSON has no capability-control threshold. The automatic result
can only say whether the run has enough operational coverage for operator
review.

## Settings and scope

OpenAI and Gemini use medium reasoning. Claude Haiku uses 4,096 thinking
tokens and a 24,000-token total output ceiling. The run keeps the v14 scope of
108 messages per provider and 324 total messages. It allows no retry or
repair.

The planning estimate is USD 4.750000. The hard limits are USD 1.200000 for
OpenAI, USD 0.550000 for Gemini, and USD 4.600000 for Haiku. The total hard
limit is USD 6.350000.

## Frozen identity

- Protocol SHA-256: `d4088228cfb80ebd2eeae3bb5efe60fea1165375c8fa17e117aa0890e12f684d`
- Run-plan SHA-256: `ac92e30192153c476f8b19bc81f7acfbd8919576be95c94962d4736511b490bf`
- Cohort SHA-256: `43f2c7e598fe51481e8a9c84819d6bb9d75aafbbcfc4b078ee308ed5c2325601`
- `FIELDS` SHA-256: `5125c847ad08dc795a82c235b3fcdf42dede5392805db36a3df2a0941c11a30a`
- Local-label SHA-256: `3fcb182bfa6cfa4935a8e4b5c6ef876407fcd27e5bb2e6ac7df3177b2789c349`
- Exact-object JSON SHA-256: `facd901ef30d98dec39f6023a779ce8ee3b3d3cab35e156ba0d6dffc05a99833`

The pinned deterministic check is
`cd brain && npm run benchmark:compact-format-v15`.

## Approval boundary

Do not run a provider command until the operator approves the exact hashes and
the USD 6.350000 hard limit. A prior v14 approval does not apply to v15.

## Retrospective

The v14 hardening audit added component telemetry but kept a strict response
pass as the decision unit. V15 makes the independent case the musical unit and
tests that parse failures cannot erase planned component denominators.
