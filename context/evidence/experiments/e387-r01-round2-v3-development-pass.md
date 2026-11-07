---
title: E387 — R01 round 2 development pass of package v3 (fresh instances, one repeat)
kind: evidence
state: done
updated: 2026-10-30
owner: R01
---

# E387 — R01 round 2 development pass of package v3

Date: 2026-10-30, 13:51–18:31 UTC. Stage: **development**, round 2.
Packages `round2-development-v3-haiku` and `round2-development-v3-luna`
([R01-D18](../../../spec/r01-research/decisions/r01-d18-round-2-discordant-levels-fresh-instances.md),
accepted; built in [E386](e386-r01-round2-mixed-model-discordance-and-package-v3.md)).
Subscription CLIs only; no API billing or Bitwig contact. This is the first
fresh test of E386's model and of E385's findings. It is development
evidence, not a rigorous result.

## Run

| Cohort | Output | Runs | First attempt | Within budget | Submissions | Stalls | Duration |
|---|---|---|---|---|---|---|---|
| Haiku 5.5 `low` | [`round2-v3-dev-haiku/`](../data/r01-pilot-runs/round2-v3-dev-haiku/) | 240/240 | 174 (73%) | 239 | 312 | 0 | 3 h 25 min |
| Luna `high` | [`round2-v3-dev-luna/`](../data/r01-pilot-runs/round2-v3-dev-luna/) | 336/336 | 209 (62%) | 304 | 514 | 1 | 4 h 40 min |

The cohorts ran as parallel processes, each as its package's pinned full
pass. Neither halted, and no quota pause occurred. One Luna correction
stalled (`r2-read-L48-i15--c4-fields`) and passed on its identical
resubmission. Reported provider tokens were Haiku 3.06 M input and 3.76 M
output, and Luna 5.21 M input and 2.15 M output.

- **Aborted first start.** The first launch ran under a tool limit that
  would have stopped it after two hours. Both processes were stopped about a
  minute in, while each had one unscored initial submission in flight. Those
  directories are kept outside the evidence as `.tmp/…-aborted-start`, and
  the full passes restarted from scratch in the same pinned order.
- **Tooling loss and rebuild.** At 11:00 local time the periodic `/tmp`
  cleanup deleted every file in the pinned Producer Pal checkout and the
  tokenizer install. The running processes held what they needed in memory,
  and scoring continued normally. For the analysis, both were rebuilt in the
  ignored `.tmp/r01-tooling/` following E353's reproduction: Producer Pal at
  `52a4c219…` with Peggy-generated parsers, and the tooling reinstalled from
  its retained lockfile. The operator approved running it. Its
  regeneration of E385's merged analysis is identical to the retained file.

Measures: [`analysis-round2-v3-dev.json`](../data/r01-pilot-runs/analysis-round2-v3-dev.json).
Model: [`glmm-round2-v3-dev.json`](../data/r01-pilot-runs/glmm-round2-v3-dev.json).

## Model specification correction

With one run per instance and format, the instance × format term `v` cannot
be told apart from Bernoulli noise. Fitted as pre-stated, its SD ran to
2.3–3.6 (E385: 0.5–0.6). The estimates then depended on the prior: a wider
format prior moved Haiku's read odds ratio from 39 to 277. `round2-glmm.py`
now pins `v` near zero when no instance × format cell has repeats. The
instance term then carries the clustering, since each format has one
observation per instance. Fits with repeats are unchanged; refitting E385
reproduces every contrast exactly. With `v` pinned, the v3 estimates are
stable under the wider prior and 50 quadrature nodes. For a rigorous round,
the pre-registered model should state this rule. Range-edit, with three
repeats, keeps `v`.

## C3 versus C4 FIELDS

First-attempt passes of 12 (instances 5–16, one repeat):

| Family | Haiku C3 / C4 by level | Luna C3 / C4 by level |
|---|---|---|
| derived-read 8, 16, 32, 48 | 8/11, 7/12, 4/11, 6/10 | 7/7, 5/5, 10/4, 6/4 |
| group-retime 16, 32, 48 | 9/6, 10/9, 11/9 | 3/9, 1/9, 1/5 |
| regroup | 12, 16, 24: 10/12, 5/9, 6/9 | 16, 24: 11/10, 8/8 |
| member-move 16, 24 | — | 6/12, 4/12 |

Model (odds ratio for C4 over C3, 95% profile interval):

| Cohort | Writes | Reads | Read × C4 interaction |
|---|---|---|---|
| Haiku 5.5 `low` | 1.3 (0.6–2.9), p = 0.44 | **10.2** (3.5–36), p = 0.00001 | **7.6** (2.1–31), p = 0.002 |
| Luna `high` | **8.2** (3.7–21), p < 0.00001 | 0.50 (0.21–1.2), p = 0.11 | **0.06** (0.02–0.20), p < 0.00001 |

Paired sign tests over instances agree. Each count is the number of
instances where one format passed and the other failed:
- **Haiku reads:** C4 better in 23, C3 in 4 (p = 0.0003).
- **Haiku regroup:** C4 13, C3 4 (p = 0.049).
- **Haiku retime:** C3 11, C4 5 (p = 0.21).
- **Luna retime:** C4 18, C3 0.
- **Luna member-move:** C4 14, C3 0.
- **Luna reads:** C3 16, C4 8 (p = 0.15).

**Against E385.**
- **Confirmed:** C4 is better for Haiku's reads (stronger here) and for
  Luna's writes.
- **Luna's split holds.** Its reads lean C3 without significance in both
  passes, and the read/write interaction is again significant.
- **Not confirmed: Haiku's write advantage for C4 (E385 OR 3.2).** It
  separates by family. Regrouping favours C4, but retiming leans C3, and E385
  had already split on retime (2 / 2 clusters). Haiku's C4 advantage is
  therefore firm for reads and regrouping, not for edits in general.
- **Cost at the ceiling.** Where both formats pass, Haiku's C3 retime
  answers take 3.4× C4's generated tokens (median 37,059 against 10,893);
  E385 measured 2.4×. Haiku's C3 retime passes are correct but costly.
- **Error visibility.** C3 FIELDS' validator catches 96 of Luna's 130 failed
  C3 submissions (74%) and 8 of Haiku's 51. For C4 FIELDS, it catches 9 of 64
  and 0 of 22.

## Range-edit at 128 notes (Luna, instances 5–8 × 3 repeats)

First-attempt passes of 12:
- baseline FIELDS 12, C3 FIELDS 12, baseline JSON 11, MIDI JSON 11;
- C4 FIELDS 10;
- bar|beat 6.

Every arm except C4 FIELDS beats bar|beat (p = 0.012–0.048). C4 against
every other arm is not significant, with wide intervals over only four
instances. This repeats E385's 128-note picture: baseline formats at least
match C4 at this size.

## Implications

- **C3 vs C4 depends on task type and model.**
  - C4 FIELDS clearly helps edits for Luna.
  - It clearly helps reads and regrouping for Haiku.
  - Luna's reads and Haiku's retiming lean C3, though not significantly.
  - No pooled "C4 is better" claim fits both cohorts. The read/write split
    is the stable finding.
- **Instances over repeats worked.** A single-repeat pass on fresh instances
  confirmed the main E385 effects with narrower intervals, at less than half
  E385's runs.
- **Brief's agentic criteria.**
  - Breaking points still differ between formats.
  - C3 FIELDS' validator still catches about three quarters of Luna's
    failures.
  - Both criteria for a tool-loop evaluation still hold.

## Limits

- Development material, synthetic source families, and two cohorts at
  different efforts.
- New levels were uncalibrated. Haiku retime 48 and regroup 24 behaved like
  their neighbours, so the ladders did not reach a new regime.
- Range-edit rests on four real windows at one size.
- The model rule for `v` was set after seeing this pass's fit. It changes
  only how clustering is represented, and the sign tests reach the same
  conclusions.
