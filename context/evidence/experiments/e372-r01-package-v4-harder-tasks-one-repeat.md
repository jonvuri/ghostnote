---
title: E372 — R01 package v4 (harder tasks): build, rehearsal and one-repeat check
kind: evidence
state: done
updated: 2026-10-27
owner: R01
---

# E372 — R01 package v4 (harder tasks): build, rehearsal and one-repeat check

Date: 2026-10-27. Stage: **development**. These results support design
iteration only; they are not a candidate comparison. Subscription CLI calls
were made within the operator's standing scope. No API billing or Bitwig
contact occurred.

## Package and offline rehearsal

Package `pilot-development-v4`
([D61](../../../spec/r01-research/decisions/d61-r01-package-v4-harder-tasks.md)) replaces p01,
p06, p07, p08 and p09 with harder tasks over input v2. It also gives p09 and
p10 a shared conditional-refusal response line. The build keeps 84 scheduled
cells, 67 eligible cells and 17 exclusions, with the same arms and roles as v3.
All 67 goldens pass, including off-grid 1/1024 spreads on every C3 and C4 arm.

The task-specific rehearsal scores 75 variants as 418 wrong answers on the
eligible cells and rejects all of them; none is rejected as a parse error. No
variant equals the oracle. In particular, both p08 bound errors and the p09
near-miss refusal are now distinguishable. All 61 gratuitous refusals are
rejected, and all 61 unreduced respellings of the oracle pass. The two
unencodable p11 baseline duplicates are unchanged from v3.

A first draft of the p01 rule used quarter 8, but every note sounding at 8
starts there, so counting onsets at 8 also gave the correct answer. The rule
now also requires a note held across T, which selects T = 1919/256. Five notes
start at T, five end there and one is held across it, so the answer is 6.

The 232 focused tests pass, four more than before. The retired v3 execution
manifest still regenerates apart from its source-file hashes.

| Artifact | SHA-256 |
|---|---|
| [v4 package manifest](../data/r01-pilot-inputs/v4/package/manifest.json) | `a8b4dbc1…` |
| [v4 execution manifest](../data/r01-pilot-inputs/v4/execution/manifest.json) | `db026b9b…` |

## Run

`dev-v4-r1` ran one repeat of v4 for both cohorts in the seeded order. The
binaries, Node version and stall policy were unchanged from E371. It completed
in about 33 minutes (15:02–15:35 UTC): 134 of 134 runs and 195 submissions,
with no halt or quota pause.

**First live stall resubmission.** A Luna correction on
`p07-halve-spread-move-anchor--c3-json` (attempt 2) produced no answer before
the 120-second timeout. The runner kept it as a `stall`, consumed no
correction and resubmitted the identical prompt as `resubmitted-after-stall`.
The resubmission answered in 5.9 s, though incorrectly. The run continued, and
`results.json` reports one stall and one resubmission. The stalled submission
is the only one that failed its control audit, because it produced no
response to check. Every other submission passed.

| | Haiku v3 (E371) | **Haiku v4** | Luna v3 (E371) | **Luna v4** |
|---|---|---|---|---|
| First-attempt passes | 67 / 67 | **64 / 67** | 38 / 67 | **35 / 67** |
| Passes within two corrections | 67 / 67 | **67 / 67** | 45 / 67 | **44 / 67** |
| First-attempt passes on the five replaced tasks (29 cells) | 29 / 29 | **27 / 29** | 13 / 29 | **10 / 29** |
| Corrections that passed | 0 / 0 | **3 / 3** | 7 / 53 | **9 / 57** |
| Submissions | 67 | **70** | 120 | **125** |

Per task, first attempt (and within budget):

| Task | Haiku | Luna |
|---|---|---|
| p01 sounding at T | 5/6 (6/6) | 0/6 (1/6) |
| p06 transpose every pitch-34 note | 6/6 | 5/6 (5/6) |
| p07 halve spreads and move anchor | 5/5 | 2/5 (2/5) |
| p08 shift and transpose [F, T) | 5/6 (6/6) | 1/6 (1/6) |
| p09 near-miss delete | 6/6 | 2/6 (5/6) |
| Unchanged tasks | 37/38 (38/38) | 25/38 (30/38) |

Client-reported usage: Haiku 241,728 input and 158,612 output tokens (v3:
223,063 and 124,908); Luna 671,164 and 104,296. On initial submissions,
Haiku's median output rose from 1,316 to 1,655 tokens and Luna's from 245 to
257 (6.4×).

## Findings

### Haiku: harder, but still near the ceiling

Haiku's three first-attempt failures were all corrected on the first
correction:

- **p01 C4 FIELDS:** answered `sounding` 7 instead of 6.
- **p08 baseline FIELDS:** shifted all six notes correctly, but transposed one
  note to pitch 68 instead of 61.
- **p04 C3 FIELDS** (unchanged task): group references disagreed with
  membership.

On first attempts, the five replaced tasks lowered Haiku from 29/29 to 27/29.
Within budget, it remains at 67/67. One repeat cannot tell whether these
three misses are stable.

### Luna: the new tasks catch the intended misreadings

- **p01:** Luna's first answer gave `sounding` 5 on five arms. That is the number of notes
  starting at T, without the note held across it, which is the misreading the
  rule was designed to catch. Its `total` was also wrong on both Producer Pal
  arms and baseline JSON (99–123 instead of 115).
- **p08:** Most errors are fraction arithmetic. Adding 1/8 to values in 256ths
  or 512ths gave +24/256, +26/256, +56/512 or +64/256 instead of +32/256 or
  +64/512.
  The transpositions were usually correct. On bar|beat, Luna also moved the
  note exactly at the excluded upper bound.
- **p09:** Luna answered `REFUSE ambiguous-selector` on two arms, which is the
  near-miss error. It returned the input unchanged on C3 FIELDS and deleted a
  different note on baseline JSON. Three of these four arms passed after
  correction.
- **p07:** C3 answers failed the timing-equation check on member `hb`
  (spread 3/512, halved to 3/1024). One detached-FIELDS answer wrote the
  expression `11+1/64` instead of a rational.
- **p06:** passed on five arms. Bar|beat moved only part of the
  pitch-34 notes.
- **p10:** passed on three arms initially and on all six within budget, with
  the shared response line.

### Defects

No prompt, card or scorer defect was found. The failing answers on the five
replaced tasks were read; each failure follows from the answer, and none
depends on wording that admits a second reading. The p09 and p10 prompts
share every line except the selector values.

## Artifacts

Under [`r01-pilot-runs`](../data/r01-pilot-runs/):

- `dev-v4-r1/` holds the plan, results (SHA-256 `517db228…`), session record
  and progress log.
- [`analysis-v4-r1.json`](../data/r01-pilot-runs/analysis-v4-r1.json)
  (SHA-256 `85da7799…`) contains one classified row for each of the 195
  submissions, from `pilot-analysis.mjs`.

Raw attempt directories remain in the ignored `.tmp/r01-pilot-dev-v4-r1/`.

## Limits

Each cell has one repeat. The inputs are reused development material, and
usage is client-reported. Haiku remains near the ceiling, so v4 separates
the cohorts more than it separates the formats for Haiku. v4 results are not
comparable cell for cell with v3 on the five replaced tasks.
