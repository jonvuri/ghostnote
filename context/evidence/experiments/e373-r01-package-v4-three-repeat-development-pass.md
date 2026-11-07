---
title: E373 — R01 three-repeat development pass of package v4
kind: evidence
state: done
updated: 2026-10-27
owner: R01
---

# E373 — R01 three-repeat development pass of package v4

Date: 2026-10-27. Stage: **development**. These results support design
iteration only; they are not a candidate comparison. Subscription CLI calls
were made within the operator's standing scope. No API billing or Bitwig
contact occurred.

## Runs

The full pinned plan of `pilot-development-v4`
([D61](../../../spec/r01-research/decisions/d61-r01-package-v4-harder-tasks.md)) has three
repeats, 201 runs per cohort, the seeded order `r01-pilot-order-v1`, at most
two corrections and one resubmission after a stall. `start` matched the v4
execution manifest. The binaries and Node version were unchanged from E371
and E372, and the 232 focused tests passed first.

| Run | Cohorts | Status | Runs finished | Submissions | Time (UTC) |
|---|---|---|---|---|---|
| `dev-v4-r3` | both, full plan | halted (control), Luna run 79 | Haiku 201/201, Luna 77/201 | 347 | 16:27–17:26 |
| `dev-v4-r3-luna` | Luna only, restarted | complete | Luna 201/201 | 382 | 17:27–18:24 |

The results below take Haiku from `dev-v4-r3`, where its cohort completed,
and Luna from the restart. The restart is a recorded subset with its own
seeded order. No quota pause occurred.

### The halt: a Codex request without `access_programs`

`dev-v4-r3` halted on submission 347
(`p11-preserve-window--baseline-json`, repeat 3, initial attempt) with
`codex-client-context-policy-violation`. Normalized, the captured request
differs from the pinned E363 template in one place: the top-level request
field `access_programs` (template `{"cyber":"standard"}`) was absent. Every
model-visible block matched the template, including the base and multi-agent
instructions, the environment context, the four tool declarations and the
exact task bytes.

In the Codex 0.163.0 binary, `access_programs` is a Responses API request
field that selects the account's cyber access tier, filled from the model
catalog's `available_access_programs`. The model does not see it as text. The
client log for submission 347 shows no error. Across every captured Luna
request in seven development runs, the field is present in 1,023 and absent
only in submission 347. The omission therefore looks like a one-off client
event, not a configuration change.

The audit worked as designed: an unadmitted request stops the run. Whether
the policy should tolerate this field's absence is an operator decision and
was not changed. Following the brief, Luna was restarted as a new output with
`--cohorts codex-current`, and it completed without another violation.

### Stalls

Luna stalled three times across both runs: once in `dev-v4-r3` (a p08
bar|beat correction) and twice in the restart (p04 C3 JSON correction and p04
C3 FIELDS initial attempt). Each was resubmitted once with identical bytes,
answered, and the run continued. The stalled submissions are the only other
control-audit failures, because they produced no response. That is 3 stalls
in 517 Luna submissions. Haiku had none.

## Results

| | Haiku 5.5 | Luna |
|---|---|---|
| First-attempt passes | **192 / 201** (95.5%) | **103 / 201** (51.2%) |
| Passes within two corrections | **200 / 201** | **125 / 201** |
| First-attempt passes per repeat | 62, 65, 65 | 35, 33, 35 |
| Cells passing in all three repeats / none / mixed | 60 / 0 / 7 | 28 / 27 / 12 |
| Corrections that passed | 8 / 11 | 22 / 178 |
| Submissions | 212 | 382 |
| Input / output tokens (client-reported) | 730,746 / 529,312 | 2,087,624 / 324,947 |
| Median output on initial submissions | 1,672 | 273 (6.1×) |

Per task, first attempt out of runs (within budget in parentheses):

| Task | Haiku | Luna |
|---|---|---|
| p01 sounding at T (v4) | 18/18 (18) | 1/18 (5) |
| p02 read group timing | 15/15 (15) | 6/15 (6) |
| p03 author six notes | 16/18 (18) | 15/18 (15) |
| p04 author a timed group | 13/15 (15) | 6/15 (8) |
| p05 edit one velocity | 18/18 (18) | 13/18 (15) |
| p06 transpose every pitch-34 note (v4) | 18/18 (18) | 13/18 (13) |
| p07 halve spreads and move anchor (v4) | 15/15 (15) | 6/15 (6) |
| p08 shift and transpose [F, T) (v4) | 17/18 (18) | 0/18 (0) |
| p09 near-miss delete (v4) | 15/18 (17) | 5/18 (12) |
| p10 refuse ambiguous selector | 18/18 (18) | 9/18 (16) |
| p11 preserve window | 18/18 (18) | 17/18 (17) |
| p12 preserve exact wider state | 11/12 (12) | 12/12 (12) |

Primary arms on the same task sets, first attempt (within budget):

| Arm | Haiku, 8 performed tasks | Luna, 8 performed tasks |
|---|---|---|
| Ghostnote FIELDS (`baseline-fields`) | 24/24 (24) | 17/24 (19) |
| Ghostnote JSON (`baseline-json`) | 23/24 (24) | 13/24 (16) |
| C3 FIELDS | 23/24 (24) | 14/24 (19) |
| C4 FIELDS | 24/24 (24) | 15/24 (19) |
| Producer Pal MIDI JSON | 24/24 (24) | 12/24 (17) |
| Producer Pal bar\|beat | **20/24 (23)** | **2/24 (3)** |

| Arm | Haiku, 4 source tasks | Luna, 4 source tasks |
|---|---|---|
| C3 FIELDS | 11/12 (12) | 6/12 (6) |
| C4 FIELDS | 12/12 (12) | 9/12 (9) |

Diagnostics: Haiku 31/33 first-attempt (33 within budget), Luna 15/33 (17).

## Findings

### Haiku is no longer at the ceiling, but only just

Haiku missed 9 of 201 first attempts, 7 cells were mixed across repeats and
none failed in every repeat. All failures but one were corrected.

- **bar|beat** has 4 of the 9 misses: p03 twice, with one authored note
  wrong, and p09 twice. On p09 Haiku deleted the right note but rewrote
  chord lines one note per line and shifted two velocities by one position.
  This is the same carried-state hazard Luna showed on p11 in E371. One p09
  bar|beat run failed all three attempts, which is Haiku's only unrecovered
  run.
- **p09 C3 FIELDS:** one run deleted the right note and altered another.
- **Source-task authoring:** on p04, C3 group references disagreed with
  membership once and a detached-FIELDS header was wrong once. On p12 C3
  JSON, Haiku once added empty `groups` and `musical` context.
- **p08 baseline JSON:** got six of the edited notes wrong once.

The v4 tasks themselves were nearly all first-attempt passes for Haiku
(83/87 across p01 and p06–p09). Its remaining errors come mostly from
format-specific surface handling.

### Luna is stable across repeats and fails the new tasks consistently

Luna's first-attempt totals per repeat were 35, 33 and 35, and 55 of its 67
cells gave the same result in all three repeats.

- **p01:** 1/18. Luna counts notes that start at T and misses the held note,
  as in E372.
- **p08:** 0/18 on the first attempt and 0/18 within budget. Errors are
  fraction arithmetic on 1/8 at mixed denominators and, on bar|beat,
  whole-window rewrites changing 54–76 notes.
- **p09:** 5/18. Luna refuses the near miss (`REFUSE ambiguous-selector`) or
  returns the input unchanged. Corrections bring it to 12/18.
- **bar|beat:** 2/24 on performed tasks. Luna often returns the input
  unchanged (p05, p06, p09). It writes beat offsets without the required
  `n` prefix, such as `1|1+265/512`, which the parser rejects (p03, every
  repeat). It also disturbs carried velocities and durations (p06 after
  correction, p11). bar|beat p11 passes in two repeats, so the arm
  can be read and written; the failures are model errors.
- **Corrections remain weak:** 22 of 178 passed.

### Format signals (development only)

These come from one development pass on reused inputs and do not compare
candidates. Two patterns appear in both cohorts:

- **Producer Pal bar|beat is the hardest performed arm,** for Haiku (20/24)
  and especially Luna (2/24). The cause is its carried velocity and duration
  state and its grid-plus-offset positions.
- **On source tasks, C4 FIELDS outscored C3 FIELDS** for both cohorts (Haiku
  12 vs 11, Luna 9 vs 6 of 12). C3's explicit onsets must be recomputed
  when spreads change, and Luna's failures there are timing-equation
  mismatches.

Among the other performed arms, Haiku is at 23–24/24 on all five. For Luna,
the five arms are within 12–17/24 and overlap given three repeats.

### Defects

No prompt, card or scorer defect was found. The failing answers were read
for every Haiku failure and for Luna's bar|beat, p01, p08 and p09 failures.
Each failure follows from the answer. bar|beat parse rejections are offsets
without the `n` prefix that the card's grammar requires. The halt is a client
request-field event, described above.

## Artifacts

Under [`r01-pilot-runs`](../data/r01-pilot-runs/):

- `dev-v4-r3/` holds the halted run's plan, results (SHA-256 `c1e6bf1e…`),
  session and progress log. `halt/` holds submission 347's process record,
  stderr, stdout, manifest and audit, the normalized template difference
  (`context-diff.txt`) and the `access_programs` scan across all runs
  (`access-programs-scan.txt`).
- `dev-v4-r3-luna/` holds the restart's plan, results (SHA-256
  `121e60e3…`), session and progress log.
- `analysis-v4-r3.json` (`02ab8437…`) and `analysis-v4-r3-luna.json`
  (`5091ef46…`) classify every submission of each run with
  `pilot-analysis.mjs`. `summary-v4-r3.json` (`19e62649…`) holds the
  per-task, per-arm and per-repeat counts above.

Raw attempt directories remain in the ignored `.tmp/`.

## Limits

This is development evidence on reused works A–C and one synthetic seed;
prompts were tuned on these inputs. Three repeats give small counts per
cell. Luna's results come from a restarted cohort-only plan, whose seeded
order differs from the pinned full order. Usage is client-reported. Haiku
remains close to the ceiling on most arms.
