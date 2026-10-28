---
title: E379 — R01 rigorous-stage three-repeat run
kind: evidence
state: done
updated: 2026-10-28
owner: R01
---

# E379 — R01 rigorous-stage three-repeat run

Date: 2026-10-28. Stage: **rigorous**. The operator approved the run after
[E378](e378-r01-rigorous-inputs-and-execution-manifest.md). Package
`pilot-rigorous-v1` ran against its pinned execution manifest, with every
version frozen by [R01-D1](../../../spec/r01-research/decisions/r01-d1-rigorous-freeze-versions.md).
Subscription CLI calls were made within the operator's standing scope. No API
billing or Bitwig contact occurred. Results are reported under
[R01-D7](../../../spec/r01-research/decisions/r01-d7-rigorous-reporting.md):
within each cohort, with no cross-provider ranking. This record does not
decide format adoption.

## Run

Both cohorts ran in full, three repeats each: Haiku 5.5 at `low` and Luna at
`medium`, on Claude Code 2.1.302 (binary `5262ce9d…`) and Codex 0.163.0. The
run took 04:37 to 06:21 UTC: **522/522 runs finished in 752 submissions**.
No control failure, halt, quota pause or restart occurred. Two Luna
corrections stalled; each identical resubmission recovered. These two stalls
are the only submissions without a passing control audit.

The first session was stopped by the operator's agent after one scored
submission, because the background job had a two-hour limit. The same output
continued with `resume --after-interruption` as a detached process. The
second session lists no unscored interrupted attempt; the order and every
result belong to the one pinned plan.

## Results

| Cohort | First attempt | Within budget | Submissions | Per repeat (first) | Cells failing every repeat |
|---|---|---|---|---|---|
| Haiku 5.5 `low` | 247/261 | 261/261 | 275 | 80, 83, 84 | 1 (p01 baseline JSON) |
| Luna `medium` | 138/261 | 187/261 | 477 | 44, 43, 51 | 29 |

### Source tasks: C3 FIELDS versus C4 FIELDS (primary)

First-attempt passes out of 3 per cell, with the diagnostics alongside.

| Task | Haiku C3 / C4 FIELDS | Luna C3 / C4 FIELDS | Luna C3 JSON / C4 JSON / detached |
|---|---|---|---|
| p02 read one derived onset | 3 / 3 | **3 / 0** | 3 / 0 / 0 |
| p04 author a known spread | 3 / 3 | 0 / **3** | 0 / 0 / 3 |
| p07 halve spreads, move anchor | 3 / 3 | 1 / **3** | 0 / 3 / 1 |
| p12 preserve exact state | 3 / 2 | 3 / 3 | 3 / 3 / – |
| p13 read a derived-onset window | 3 / 3 | 0 / 0 | 0 / 0 / 1 |
| p14 group existing notes | 3 / 3 | 0 / 0 | 0 / 1 / 0 |
| p15 move a member between groups | 3 / 3 | 0 / **3** | 2 / 3 / 1 |
| p16 retime two groups | 3 / 3 | 1 / **3** | 2 / 3 / 2 |
| **Total** | **24 / 23** | **8 / 15** | 10 / 13 / 8 (of 21) |

Within budget: Haiku 24/24 on both FIELDS arms; Luna C3 FIELDS 14/24 and C4 FIELDS 17/24.

- **Haiku** is at the ceiling on source tasks. The one C4 miss is p12.
- **Luna** repeats the development split (E375, E377). C4 leads on the
  onset-changing edits p04, p07, p15 and p16 (12/12 versus 2/12). C3 leads on
  reading one derived onset (p02, 3/3 versus 0/3, and 0/3 on every C4 arm).
  Neither FIELDS arm passes p13 or p14.
- p13 is a near-floor task for Luna, as R01-D4 anticipated (1/15 across all
  arms). On p14, 9 of Luna's 14 failed first attempts are parse or validation
  errors; the inspected C3 FIELDS case is a timing-equation mismatch that
  the C3 validator rejects. The rest are wrong states.

### Performed tasks: six primary arms

First-attempt / within-budget, out of 24 per arm (8 tasks × 3 repeats).

| Arm | Haiku | Luna |
|---|---|---|
| Ghostnote FIELDS | 23 / 24 | 15 / 21 |
| Ghostnote JSON | 21 / 24 | 16 / 19 |
| C3 FIELDS | 24 / 24 | 16 / 21 |
| C4 FIELDS | 22 / 24 | 18 / 22 |
| Producer Pal bar\|beat | 20 / 24 | **5 / 12** |
| MIDI JSON | 24 / 24 | 14 / 20 |

Producer Pal bar|beat is again the hardest performed arm for both cohorts.
For Luna, it fails across p01, p03, p05, p06, p08 and p09. Other notable
performed-task results:

- Haiku's hardest task is p01, the sounding count on *open spaces* (12/18).
- Luna's weakest are p09 (2/18) and p08 (4/18). Nine of Luna's p09 first
  attempts refuse as `ambiguous-selector`. The selector is unambiguous: one
  pitch-38 note lies in [8, 4609/512), with neighbours just below 8 and at the
  excluded bound. These are gratuitous refusals on the intended near miss.
- The required p10 refusal passed 18/18 for Haiku and 12/18 for Luna.

### Cost and accounting

| | Haiku | Luna |
|---|---|---|
| Median output, initial answers | 1,505 tokens | 381 tokens |
| Total client-reported output | 626,761 | 376,289 |
| Total client-reported input | 895,292 | 2,471,458 |
| Median elapsed per submission | 7.0 s | 4.5 s |
| Corrections used | 14 | 214 |

The generated-token gap is 3.95× by median, against about 3.6× expected from
E377. Haiku input is reported from `totalInputTokens`, mostly as cache
writes. Luna input includes its fixed client context and its many
corrections. Usage is client-reported, and HTTP retry totals for Codex remain
unknown (D58).

## Comparison with development (context only)

Development results never count toward rigorous results; they are listed for
context. At the same settings, development v5 gave Haiku 252/261 (E375) and
Luna 145/261 (E376+E377), with C3 versus C4 FIELDS on source tasks of 10
versus 16 of 24 for Luna. The fresh inputs reproduce each cohort's level and
the C3/C4 split.

## Artifacts

[`r01-pilot-runs/rigorous-r3/`](../data/r01-pilot-runs/rigorous-r3/) holds
`plan.json` (`934ad0fc…`), `results.json` (`6336ff52…`), both session records
and `progress.txt` (both sessions' logs). The raw attempt directories (73 MB)
stay in ignored `.tmp/r01-rigorous-run/`, as in development.
[`analysis-rigorous-r3.json`](../data/r01-pilot-runs/analysis-rigorous-r3.json)
(`2dd5505a…`, from `pilot-analysis.mjs`) classifies all 752 submissions.
[`summary-rigorous-r3.json`](../data/r01-pilot-runs/summary-rigorous-r3.json)
(`2b68f01b…`) holds the tables above. The summary is produced by a one-off
aggregation over `results.json` (per-cohort first/within tallies by task, arm
and task × arm), not by a retained script.

## Limits

- Two small models under one pinned client each; this does not establish
  adoption for capable-agent workflows.
- Each cell has three repeats on one set of fresh inputs. Role C's window is
  half the size of A and B (E378).
- Source-task conclusions cover only C3 versus C4. Current-document and
  Producer Pal arms are excluded there, because no annotation adapter is
  supplied.
