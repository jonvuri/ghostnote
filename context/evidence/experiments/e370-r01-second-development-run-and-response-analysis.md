---
title: E370 — R01 second one-repeat development run and first response analysis
kind: evidence
state: done
updated: 2026-10-27
owner: R01
---

# E370 — R01 second one-repeat development run and first response analysis

Date: 2026-10-27. Stage: **development**. These results support design
iteration only; they are not a candidate comparison. Subscription CLI calls
were made within the operator's standing scope. No API billing or Bitwig
contact occurred.

## Runs

The second development run repeats the one-repeat subset of
[E369](e369-r01-first-development-run-one-repeat.md) under
[D59](../../../spec/r01-research/decisions/d59-r01-functional-equivalence-and-locating-feedback.md)
(`r01-scoring-v2-functional-rationals`, `r01-feedback-v2-locating`) and the
re-pinned execution manifest. Package, seeded order and prompts are identical
to E369's. The binaries were unchanged.

| Run | Cohorts | Status | Runs finished | Submissions |
|---|---|---|---|---|
| `dev-v2-r1b` | both | halted (transport), Luna run 38 | Haiku 67/67, Luna 37/67 | 135 |
| `dev-v2-r1c` | Luna only, restarted | halted (transport), run 44 | Luna 43/67 | 80 |

Results in this record use the current scorer for all three runs. E369's
results are therefore re-scored under D59.

| | Haiku E369 | Haiku r1b | Luna E369 | Luna r1c (first 44 runs) |
|---|---|---|---|---|
| First-attempt passes | 60 / 67 | **62 / 67** | 39 / 67 | 25 / 44 (E369 on the same cells: 26) |
| Passes within two corrections | 66 / 67 | **67 / 67** | 42 / 67 | 26 / 44 |
| Corrections that passed | 10 / 12 | 5 / 6 | 3 / 53 | 1 / 36 |
| Corrections identical to the previous answer | 5 | 1 | 28 | 12 |

Every completed submission passed its control audit.

## Findings

### Run-blocking: Luna transport stalls

Both halts were Luna submissions killed at the 120-second timeout after the
stream went silent:

- **r1b:** a p08 bar|beat correction stopped 3 s after "content part added".
- **r1c:** an initial p10 refusal, which normally takes about 2 s, stopped
  less than 1 s after the response began.

No usage or answer was reported. E369 had no Luna submission over 30 s in 120
submissions. These runs had two stalls in about 142. Under
`stopOnTransportFailure`, one stall halts the whole pass, and halted runs
cannot resume. A three-repeat pass of about 600 Luna submissions would
therefore probably not complete. This requires a policy decision.

### Prompt defects

1. **p06's selector is ambiguous.** "The note at 8 with pitch 56" also
   matches the note at **index** 8, which has pitch 56 at onset 47/64. Haiku
   transposed exactly that note on two formats in E369 and on Producer Pal
   MIDI JSON again in r1b. The request should say "onset 8". p05 and p09 use
   the same wording, but their fractional onsets (23/2) make an index reading
   unlikely.
2. **The source-cohort `TASK SCOPE` reads like document content.** For p04,
   an authoring task from empty input, Haiku copied `displayMeter`,
   `channelPolicy` and `timingPolicy` into the output on both C4 arms. Locating
   feedback (`$.displayMeter: unexpected`) fixed this on the next attempt.
   The scope's `timingPolicy` ("exact source values and spellings") also
   conflicts with D59.
3. **Spelling wording.** p02 ("reduced rational strings") and p12 ("exact
   rational spellings") ask for more than scoring now requires (D59).
4. **The bar|beat card example uses notation its grammar never explains.**
   The `d` suffix in `n/8d` appears in all eight bar|beat prompts without
   explanation.

### Model behavior (not defects)

- **Luna often returns the input unchanged on write tasks.** This happened in
  21 failed E369 submissions and 9 in r1c, mostly on p08 (whose range [4, 6)
  holds exactly four notes) and on Producer Pal p05 and p09.
- **Luna corrections almost never succeed:** 4 of 89, with or without
  locating feedback. Locating feedback reduced word-for-word repeats from 28
  of 53 to 12 of 36 but did not improve pass rates. Haiku corrections succeed
  in 15 of 18.
- **Luna fails p01 counting on every format.** `before` is 27–30 instead of
  21; the comparison requires ordering fractions such as 3911/512 and
  4167/512.
- **p02 on C4 is harder by design.** C4 derives a member's onset from anchor,
  delay and spread, whereas C3 lists the onset explicitly. Luna failed every
  C4 p02 run and passed every C3 p02 run. This is a format signal, not a
  defect.
- **Haiku's remaining failures are isolated wrong edits,** mostly on
  bar|beat, and are corrected within budget.

## Artifacts

Under [`r01-pilot-runs`](../data/r01-pilot-runs/):

- `dev-v2-r1b/` and `dev-v2-r1c/` hold each run's plan, results (SHA-256
  `81c4c2d2…` and `f9804568…`), session record and progress log, with the
  halting attempt's process record, stderr, stdout and audit in `halt/`.
- [`analysis-r1-r1b-r1c.json`](../data/r01-pilot-runs/analysis-r1-r1b-r1c.json)
  (SHA-256 `7804b6f1…`) contains one classified row for each submission in
  the three runs.

The classifications come from
[`pilot-analysis.mjs`](../../../brain/benchmarks/r01-candidates/pilot-analysis.mjs).
From `brain/`, run:
`node --import tsx benchmarks/r01-candidates/pilot-analysis.mjs PINNED_PP RUN_DIR...`

Raw attempt directories remain in the ignored `.tmp/` directory.

## Limits

Each cell has one or two repeats, and r1c covers only the first 44 Luna runs
in seeded order. The runs reuse development inputs. Usage is client-reported.
