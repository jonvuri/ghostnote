---
title: E371 — R01 one-repeat development check of package v3
kind: evidence
state: done
updated: 2026-10-27
owner: R01
---

# E371 — R01 one-repeat development check of package v3

Date: 2026-10-27. Stage: **development**. These results support design
iteration only; they are not a candidate comparison. Subscription CLI calls
were made within the operator's standing scope. No API billing or Bitwig
contact occurred.

## Run

`dev-v3-r1` runs one repeat of package `pilot-development-v3`
([D60](../../../spec/r01-research/decisions/d60-r01-package-v3-prompts-and-stall-resubmission.md))
for both cohorts in the seeded order, with `stallResubmissions: 1`, at most two
corrections and a 120-second timeout. `start` checked the v3 execution
manifest (package manifest `fe2d49c6…`). Binaries were unchanged: Claude Code
2.1.302 (SHA-256 `5262ce9d…6662d37`) and Codex 0.163.0, on Node v24.11.1. The
228 focused tests passed before the run.

The run **completed** in about 28 minutes (14:06–14:34 UTC): 134 of 134 runs and
187 submissions, with no halt, quota pause, stall or resubmission. Every
submission passed its control audit.

Results use the current scorer (D59). The E369 and E370 columns are re-scored
on the same basis; v3 has the same cells and order as v2.

| | Haiku E369 | Haiku E370 (r1b) | **Haiku v3** | Luna E369 | Luna E370 (r1c, 44 runs) | **Luna v3** |
|---|---|---|---|---|---|---|
| First-attempt passes | 60 / 67 | 62 / 67 | **67 / 67** | 39 / 67 | 25 / 44 | **38 / 67** |
| Passes within two corrections | 66 / 67 | 67 / 67 | **67 / 67** | 42 / 67 | 26 / 44 | **45 / 67** |
| Corrections that passed | 10 / 12 | 5 / 6 | **0 / 0** | 3 / 53 | 1 / 36 | **7 / 53** |
| Corrections identical to the previous answer | 5 | 1 | **0** | 28 | 12 | **16** |
| Write submissions returning the input unchanged | 0 | 0 | **0** | 21 | 9 | **16** |
| Submissions | 79 | 73 | **67** | 120 | 80 | **120** |

Client-reported usage for v3: Haiku 223,063 input and 124,908 output tokens
(r1b: 254,694 and 198,287); Luna 638,766 and 97,038 (E369: 643,413 and
99,533). Haiku input is `totalInputTokens`, almost entirely 1-hour cache
writes. On initial submissions, Haiku generated a median 1,316 tokens and
Luna 245 (5.4×; E365 measured 6.1× on its matched cells). The median initial
Haiku input rose from 2,973 to 3,004 tokens because the bar|beat card grew.
That increase offsets part of the saving from removing `TASK SCOPE`.

## Did D60 work?

### Prompt fixes: yes

- **p06 selector.** Haiku passed p06 on all seven arms on the first attempt. It
  made no wrong-note transposition, including on Producer Pal MIDI JSON, where
  it had transposed the index-8 note in E369 and r1b.
- **No `TASK SCOPE`.** No v3 prompt contains the block. None of Haiku's five p04
  answers contains `displayMeter`, `channelPolicy` or `timingPolicy`, and all
  pass on the first attempt (r1b: two C4 arms needed a correction).
- **Spelling wording.** p02, p04 and p12 passed on every Haiku arm on the
  first attempt.
- **bar|beat card.** The card now documents `d` (dotted, ×3/2) and `t`
  (triplet, ×2/3). None of the 31 bar|beat answers from either cohort used
  them, and Haiku passed every bar|beat cell on the first attempt.

All eleven Haiku cells that needed a correction in E369 or r1b passed on the
first attempt. With one repeat, this shows that the defects are removed; it
does not establish a stable rate.

### Stall policy: not exercised

No submission stalled. The slowest Luna submission took 43.9 s (median
5.0 s), and no Luna submission stalled in 120, compared with two stalls in
about 142 in E370. The run did not halt, but the resubmission path was not
needed, so this run provides no live evidence for it. Offline tests remain its
only verification. The stall counters are present and zero in `results.json`.

## Luna behavior

Luna's first-attempt rate is essentially unchanged from E369 (38 vs 39 of 67).
Its failures are model errors, not prompt or scorer defects:

- **Unchanged input remains common.** 16 write submissions returned the
  input unchanged: p08 (seven submissions on four arms), p06 and p09 on bar|beat
  (three each) and p05 on both Producer Pal arms (three).
- **Corrections improved slightly but remain weak.** 7 of 53 corrections passed
  (E369 3/53; r1c 1/36), and 16 repeated the previous answer word for word.
- **p01 counting fails on every arm, as before.** Luna reported `before` from 25
  to 56 instead of 21. On four arms at least one answer also miscounted
  `total` (94–105 instead of 103); E369 did so on two arms.
- **Small-fraction arithmetic.** On p04 C3 JSON and C3 FIELDS, and on p07
  C3 FIELDS, Luna computed 1/64 as 12/512 or 16/512 instead of 8/512. The
  C3 timing-equation check rejected these answers, while the C4 arms, which
  derive onset, were unaffected. One C3 JSON answer also had an extra `]` and
  was repeated unchanged after locating parse feedback.
- **Copy errors in long surfaces.** A p08 baseline FIELDS correction applied the
  intended shift but replaced three distant durations with pitch/256. A p08 C4
  FIELDS answer changed seven notes outside [4, 6).
- **Stateful bar|beat.** On p11, which asks for the input unchanged, Luna
  expanded bar|beat chord lines into one note per line, assigned velocity
  and duration changes to the wrong chord members and dropped one note
  (27 changed notes). The
  first correction passed. p03 bar|beat placed onsets in the wrong bars on
  every attempt, as in all earlier runs.
- **p10 refusal.** Luna missed the ambiguity on four arms initially: it returned
  the input unchanged, deleted one of the two matching notes or answered
  `REFUSE not-found`. Three arms passed after one correction, but bar|beat did
  not. E369 passed two of these arms (baseline JSON and C4 FIELDS) on
  the first attempt. The only p10
  prompt change in v3 is the removed `TASK SCOPE` block, and r1c (with the
  block) also failed baseline JSON. One repeat cannot attribute this; the
  three-repeat pass should be checked for it.
- Changes from E369 on individual cells otherwise go both ways. p04 C4 JSON and
  p09 Producer Pal MIDI JSON improved to first-attempt passes. p04 C3 JSON
  regressed to a failure, as it did in r1c.

## New defects

None was found in prompts, cards or the scorer. Every failing Luna answer
listed above was read. Each failure follows from the answer itself; none
depends on wording that admits a second reading. All 67 Haiku first-attempt
passes were accepted by the scorer that passed E368's and D59's rehearsals.

## Artifacts

Under [`r01-pilot-runs`](../data/r01-pilot-runs/):

- `dev-v3-r1/` holds the plan, results (SHA-256 `db69d614…`), session record
  and progress log.
- [`analysis-v3-r1.json`](../data/r01-pilot-runs/analysis-v3-r1.json)
  (SHA-256 `e6796005…`) contains one classified row for each of the 187
  submissions, from
  [`pilot-analysis.mjs`](../../../brain/benchmarks/r01-candidates/pilot-analysis.mjs).

Raw attempt directories remain in the ignored `.tmp/r01-pilot-dev-v3-r1/`.

## Limits

Each cell has one repeat. The stall policy was not exercised live. The inputs
are reused development material, and usage is client-reported. Haiku's 67/67
result is a ceiling on these tasks, so this package no longer separates the
formats for Haiku without more repeats or harder tasks.
