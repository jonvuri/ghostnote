---
title: E384 — R01 round 2 package v2 calibration (Haiku 5.5 low, Luna high)
kind: evidence
state: done
updated: 2026-10-29
owner: R01
---

# E384 — R01 round 2 package v2 calibration

Date: 2026-10-29, 04:06–05:57 UTC. Stage: **development**, round 2. Package
`round2-development-v2` ([R01-D14](../../../spec/r01-research/decisions/r01-d14-round-2-two-cohorts-harder-ladder.md))
ran with `--instances 1 --repeats 1` for Haiku 5.5 `low` and Luna `high`.
Subscription CLIs only; no API billing or Bitwig contact. Every cell is a
single observation.

## Run

**180/180 runs in 221 submissions**, with no control failure, halt, stall or
quota pause. The slowest submission used 21% of its limit. The package's
rehearsal accepts all 360 goldens and rejects all 3,020 wrong answers. Plan,
results and session are in
[`round2-v2-calibration-r1/`](../data/r01-pilot-runs/round2-v2-calibration-r1/);
the measures are in
[`analysis-round2-v2-calibration-r1.json`](../data/r01-pilot-runs/analysis-round2-v2-calibration-r1.json).

| Cohort | First attempt | Within budget | Submissions | Median generated / reasoning (first attempt) | API-equivalent cost |
|---|---|---|---|---|---|
| Haiku 5.5 `low` | 79/90 | 89/90 | 103 | 6,948 / 2,174 | ≈ $0.65 |
| Luna `high` | 68/90 | 86/90 | 118 | 2,833 / 375 | ≈ $0.37 |

Costs use Anthropic's and OpenAI's standard list rates, with Claude Code's
one-hour cache writes priced at twice the input rate. Codex cache writes are
unreported.

## Ladders: first-attempt passes over primary arms

| Family | Haiku 5.5 `low` | Luna `high` |
|---|---|---|
| derived-read (4, 8, 16, 32 groups) | 2/2 2/2 2/2 1/2 | 2/2 1/2 1/2 **0/2** |
| group-retime (4, 8, 16, 32) | 2/2 1/2 2/2 2/2 | 2/2 1/2 2/2 1/2 |
| regroup (4, 8, 12, 16) | all 2/2 | 2/2 2/2 1/2 2/2 |
| member-move (4, 8, 12, 16) | all 2/2 | all 2/2 |
| range-edit (128, 256, 512 notes) | 6/6 5/6 **3/6** | 5/6 **3/6** **2/6** |
| selective-delete (6, 12, 24) | 6/6 5/6 6/6 | 5/6 5/6 5/6 |
| preserve-performed (512) | 6/6 | 6/6 |
| preserve-exact (512) | 2/2 | 2/2 |

- **Range-edit is the only family that breaks for both cohorts.** Haiku is
  at half at 512, and Luna falls to half at 256 and below at 512. At 512,
  only C3 FIELDS, C4 FIELDS and baseline JSON pass for Haiku; bar|beat,
  baseline FIELDS and MIDI JSON fail. For Luna, only baseline FIELDS and
  baseline JSON pass at 512.
- **Derived-read breaks for Luna in C4 FIELDS from 8 groups** (PFFF), while
  C3 FIELDS passes to 16 (PPPF). This is the same direction as round 1's p02
  split. For Haiku, only C3 FIELDS at 32 fails.
- **The group-edit families barely bend at four times v1's sizes.** Member
  moves pass at 16 for both cohorts and regrouping at 16 for both. Every
  non-pass on those three families is an isolated validator-caught error:
  Luna's C3 retime at 8 and 32, its C4 regroup at 12, and Haiku's C4 retime
  at 8. None forms a trend. Scaling the
  count of independent, repeated operations does not raise difficulty much
  for these cohorts.
- **Selective-delete** stays at 5–6/6. Its failures are mostly bar|beat,
  and one is a Luna baseline JSON miss at 24.

## Error visibility

Validator-caught failures are 5 of Haiku's 14 failed submissions and 8 of
Luna's 32. Luna's C3 FIELDS failures are 4 of 7 validator-caught, against 1 of
8 for C4 FIELDS. bar|beat failures are all silent.

## Implications for the full development pass

As pinned, the pass (1,080 runs per cohort, at most 6,480 submissions,
roughly 12 times this pass's cost) would put most of its runs at the ceiling
on regroup, member-move, retime, delete and preservation. Ceiling runs still
give pass³, cost and output-size data, but no breaking points. Options:

1. **Run as pinned.** Format signal comes mainly from range-edit, read, and
   ceiling costs.
2. **Trim before running.** Keep range-edit and read. Run the group families
   at their top two levels only, as cost-at-ceiling families, and keep
   preservation at 512. This cuts runs substantially.
3. **Change the group families' axis** (for example, chained dependent
   operations rather than more independent ones) in a package v3, with
   another calibration.

The choice is the operator's.

## Limits

Single observations; mid-ladder misses on group families may be noise. The
512-note material is one piano part. Luna's reasoning counts are
client-reported.
