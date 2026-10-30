---
title: E385 — R01 round 2 development pass of package v2 (Haiku 5.5 low, Luna high)
kind: evidence
state: done
updated: 2026-10-30
owner: R01
---

# E385 — R01 round 2 development pass of package v2

Dates: 2026-10-29 12:27 UTC to 2026-10-30 10:36 UTC. Stage: **development**,
round 2. Package `round2-development-v2`
([R01-D14](../../../spec/r01-research/decisions/r01-d14-round-2-two-cohorts-harder-ladder.md)),
trimmed task set ([R01-D15](../../../spec/r01-research/decisions/r01-d15-round-2-trimmed-development-pass.md)),
four instances and three repeats. Subscription CLIs only; no API billing or
Bitwig contact. This is development evidence: it supports design decisions
and is not a rigorous result.

## Run

| Cohort | Output | Runs | First attempt | Within budget | Submissions | Stalls | API-equivalent cost |
|---|---|---|---|---|---|---|---|
| Haiku 5.5 `low` | [`round2-v2-dev-r3/`](../data/r01-pilot-runs/round2-v2-dev-r3/) | 684/684 | 581 (85%) | 679 | 809 | 0 | ≈ $5.68 |
| Luna `high` | [`round2-v2-dev-r3-luna/`](../data/r01-pilot-runs/round2-v2-dev-r3-luna/) | 684/684 | 491 (72%) | 641 | 957 | 2 | ≈ $3.50 |

No quota pause occurred. Costs use list rates; the Haiku cost includes
Claude Code's one-hour cache writes at twice the input rate.

- **Parallel cohorts.** The combined run started both cohorts in the pinned
  order. Luna then ran as its own cohort-only process with an identical
  per-cohort order. A watcher stopped the combined run at its first Luna
  attempt (810, manifest and prompt only, unscored), so Haiku comes from the
  combined run and Luna from the cohort-only run. Analysis merges them with
  `round2-analysis.mjs DIR:COHORT …`.
- **Control halt (R01-D16).** At Luna submission 270, the Codex client
  retried over websocket after an idle timeout and added a top-level
  `type: "response.create"`. Policy v4 halted; policy v5 accepts that
  framing. The run continued with `--after-control-halt`, and the re-audited
  answer scored as a first-attempt fail, passing on correction.
- **Sleep stalls (R01-D17).** Submissions 414 and 415 stalled while the Mac
  was in clamshell sleep, and the run halted after the second. It continued
  with `--after-stall-halt`; the resubmission passed first time. Both stalls
  are excluded from elapsed time, and their captures are retained in
  [`halt-captures/`](../data/r01-pilot-runs/round2-v2-dev-r3-luna/halt-captures/).

The merged measures are in
[`analysis-round2-v2-dev-r3.json`](../data/r01-pilot-runs/analysis-round2-v2-dev-r3.json).

## C3 versus C4 FIELDS (paired by level, instance and repeat)

Pooled over each family's levels; first-attempt passes, exact McNemar.

| Family | Haiku C3 / C4 | p | Luna C3 / C4 | p |
|---|---|---|---|---|
| derived-read (4–32 groups) | 32 / **43** of 48 | 0.013 | 34 / 27 of 48 | 0.17 |
| group-retime (16, 32) | 19 / 19 of 24 | 1.0 | 6 / **18** of 24 | 0.0005 |
| regroup (12, 16) | 11 / **22** of 24 | 0.007 | 20 / 19 of 24 | 1.0 |
| member-move (12, 16) | 24 / 23 of 24 | 1.0 | 17 / **24** of 24 | 0.016 |
| range-edit (128–512) | 31 / 33 of 36 | 0.69 | 26 / 30 of 36 | 0.34 |
| preserve-exact (512) | 12 / 12 | 1.0 | 9 / 12 | 0.25 |
| selective-delete (24) | 12 / 12 | 1.0 | 12 / 11 | 1.0 |

- **Every significant C3/C4 difference favours C4 FIELDS.** That holds for
  Haiku on derived reads and regrouping, and for Luna on retiming and member
  moves. There are 14 unadjusted tests. Under Bonferroni (p < 0.0036),
  Luna's retime result holds outright, and Haiku's regroup result is
  borderline.
- **Derived reads split by model.** C4 is clearly better for Haiku: per
  level, C3 falls 12, 8, 7, 5 of 12 while C4 holds 12, 11, 10, 10. Haiku's
  fitted C3 breaking point is about 21 groups (interval 15 to beyond 32).
  Luna leans the other way, without significance: C3 9, 7, 9, 9 against C4
  9, 7, 6, 5, and a fitted C4 breaking point of about 17 groups. Round 1's
  "C3 leads on reading one derived onset" (E379, Luna) is consistent with
  Luna here, but not with Haiku at scale.
- **Cost at the ceiling favours C4 for Haiku.** Where both pass, Haiku's C3
  answers take far more generation: retime 24,118 against 10,145 median
  generated tokens (2.4×), and member-move 11,164 against 6,229 (1.8×). The
  output sizes themselves are close: C3 is 1.3–1.5× larger on these
  families.

### Correction: repeats are clustered

The McNemar tests above treat each repeat as an independent pair. The three
repeats of one instance share the task, though, so they overstate the
evidence. A sign test over instance-level clusters (level × instance; C4
FIELDS passes minus C3 FIELDS passes over the repeats) gives:

| Family | Haiku: C4 better / C3 better / tied clusters, p | Luna |
|---|---|---|
| derived-read | 9 / 1 / 6, **0.021** | 2 / 7 / 7, 0.18 |
| group-retime | 2 / 2 / 4, 1.0 | 7 / 0 / 1, **0.016** |
| regroup | 6 / 1 / 1, 0.125 | 1 / 2 / 5, 1.0 |
| member-move | 0 / 1 / 7, 1.0 | 6 / 0 / 2, **0.031** |
| All source families pooled | 17 / 5, **0.017** | 18 / 9, 0.12 |

The direction is unchanged, but the evidence is weaker. Haiku's regroup
difference is no longer significant, and Luna's retime result falls from
p = 0.0005 to 0.016. bar|beat's deficit survives clustering: against every
other performed arm it is worse in 10–16 of 20 clusters and better in at
most 2 (p ≤ 0.04 for both cohorts; ≤ 0.002 against every arm except Luna's
MIDI JSON). Cluster-aware tests are the reporting basis from here on.

## Performed formats (six primary arms)

- **bar|beat is the weakest arm.** Range-edit passes 6/8/6 (Haiku) and
  2/1/1 (Luna) of 12 at 128/256/512 notes. Selective-delete at 24 near
  misses passes 4/12 and 2/12, with pass³ 0/4 for both. Its failures are
  almost always silent wrong states.
- **Luna's range-edit breaking points differ by format.** Baseline JSON
  falls 12, 7, 3 (fitted breaking point about 332 notes, interval 286–436).
  MIDI JSON holds at 5, 5, 4, and bar|beat breaks below 128. Baseline
  FIELDS, C3 and C4 stay at or above half to 512. For Haiku, every arm but
  bar|beat stays above 75% at every size.
- **Ceiling cost on 512-note preservation** (both cohorts, nearly all pass)
  repeats E382's ordering. Haiku's median first answers are bar|beat 5,915
  local tokens, MIDI JSON 9,246, C3 9,768, C4 10,287, baseline FIELDS 11,888
  and baseline JSON 16,503. Elapsed time follows the same order.

## Error visibility

Validator-caught share of failed submissions:

| Arm | Haiku | Luna |
|---|---|---|
| C3 FIELDS | 7/51 | **59/87 (68%)** |
| C4 FIELDS | 0/18 | 5/56 |
| bar\|beat | 4/33 | 2/90 |
| baseline JSON | 0/4 | 0/24 |

Other arms: 1 or fewer each. C3 FIELDS' explicit timing equations let its
validator catch most of Luna's inconsistent edits. Every other format fails
mostly silently.

## Against the brief's questions and criteria

1. **Breaking points.** They separate formats for Luna on range-edit
   (bar|beat, MIDI JSON and baseline JSON break; the others hold) and on
   derived reads (C4 near 17 groups), and for Haiku on derived reads (C3
   near 21 groups). Most other ladders do not cross 50% for the FIELDS arms.
2. **Cost at the ceiling.** Output size differs 2.8× across formats on
   preservation. Haiku's C3 generation runs 1.8–2.4× C4's on group edits.
3. **Error visibility.** It is concentrated in C3 FIELDS (68% for Luna).
4. **Codex cohort.** Luna `high` separates formats on four families without
   reaching the floor (R01-D14 replaced the Terra assessment).

**Agentic criteria (brief):** both hold. Breaking points differ between
formats for both cohorts, and validator-caught failures exceed a third for C3
FIELDS (Luna). The brief's step 6 therefore points toward a tool-loop
evaluation; that decision is the operator's.

## Limits

- Development material and package; works 4–6 only, and the 512-note
  windows come from one piano part.
- The group families ran only at their top two levels (R01-D15), so their
  results are not breaking points.
- Cohorts run at different efforts. Cross-provider differences are reported
  side by side, not ranked.
- The p-values are unadjusted except where noted.
