# R01 round 2 — Difficulty-scaled tasks and saturation-resistant measures

Research brief, drafted 2026-10-28 after the first rigorous run
([E379](../evidence/experiments/e379-r01-rigorous-three-repeat-run.md)).
**Status: decisions answered (R01-D8–R01-D12); nothing is implemented.** Parent brief:
[R01](r01-format-comparison.md). Round 2 is a version reset
([R01-D8](../../spec/r01-research/decisions/r01-d8-round-2-version-reset-and-work-reuse.md)).

## Why

E379 answered the first round's question on its own terms, but it cannot
speak for capable agents:

- Haiku 5.5 passed 247/261 on the first attempt and 261/261 within budget.
  On source tasks, C3 and C4 FIELDS scored 24 and 23 of 24. The tasks, not
  the formats, set the limit.
- Luna failed 29 of 87 cells in every repeat, and p13 and p14 sat at the
  floor in both formats. Where everything fails, formats cannot be told apart
  either.
- Fixed-difficulty tasks therefore separate formats only for a model whose
  ability happens to sit in the task's range. A capable agent would put
  every cell at the ceiling.

Round 2 replaces fixed tasks with **difficulty ladders**: each format is
measured by how far it can be pushed before a model breaks. It adds
**measures that still differ at the ceiling**. It ends with a decision on an
agentic tool-loop evaluation (step 3 of the earlier proposal), and an
assessment of adding or switching to Terra on the Codex side.

## Questions

1. **Breaking point.** For each model and format, at what difficulty does
   first-attempt success fall below 50%? Does the C3/C4 split of E375/E379
   (C4 for onset-changing edits, C3 for reading one derived onset) hold,
   grow or reverse as difficulty rises?
2. **Cost at the ceiling.** Where a model passes in every format, what does
   each format cost: reliability across repeats, generated tokens
   (reasoning and answer), elapsed time, output size and collateral edits?
3. **Error visibility.** What share of each format's failures does its own
   validator catch (parse or validation errors), and what share are silent
   wrong states? This is the main input to the agentic decision.
4. **Codex cohort.** Does Luna degrade so far on harder levels that it stops
   separating formats? If so, should Terra be added beside it or replace it?

## Design

### Difficulty ladders

Only operations whose cost depends on the format are scaled; musical
judgement is not (Phase 8: creative tasks mainly measure model skill). Each
family varies **one axis** from the current task as level 1. The other axes
stay at base.

| Family (from) | Axis | Proposed levels |
|---|---|---|
| Derived-onset read (p02, p13) | Timed groups whose members are read, with boundary cases | 1, 2, 4, 8 groups |
| Group retime (p16) | Groups changed in one request (anchor moves and spread scaling mixed) | 1, 2, 4, 8 groups |
| Regroup existing notes (p14) | Loose notes converted into timed groups | 1 group of 5, then 2, 4 and 6 groups |
| Member move (p15) | Members moved between timed groups | 1, 2, 4, 6 members |
| Performed range edit (p08) | Window size at a fixed edit, with range size scaling | 64, 128, 256, 512 notes |
| Selective delete (p09) | Same-pitch near misses around the target range | 1, 3, 6 near misses |
| Preservation at scale (p11, p12) | Window size, exact state returned unchanged | 128, 256, 512 notes; more if material allows |

Levels are a first guess. A one-instance calibration pass (step 4) adjusts
them, so each model's ladder spans from passing to failing. Ladders may
differ between cohorts, but every format within a cohort shares the same
ladder.

**Window size limits real material.** Per inventory metadata, most pool
assets in works 4–6 hold under about 500 notes, and only a few hold more.
Real-source levels above about 512 notes may need synthetic material or a
rule for merging tracks. Decide this in step 3; whole-asset windows lift the
current 16-quarter, 128-note cap for scale levels only.

**Timeout.** The 120-second limit confounds large outputs. At Haiku's
observed rate (about 1,500 output tokens in 7 s), a 512-note preservation
answer may approach it. Proposal: scale the timeout with expected output
size, and report elapsed time as a measure rather than letting the limit
decide outcomes.

### Arms

Keep the six primary arms on performed families and C3/C4 FIELDS on source
families. Run the three source diagnostics (C3 JSON, C4 JSON, detached C4) on
one level per family only, unless they prove informative. This keeps the
budget on the axis that matters.

### Measures

Report these per model × format × family × level:

- First-attempt and within-budget success; **pass³** (all three repeats pass).
- **Breaking point.** The level where first-attempt success crosses 50%, from
  a logistic fit over levels with instance as a paired factor. Report
  intervals, not single numbers.
- **Generated tokens to first correct answer,** reasoning included, and
  elapsed time to it.
- **Output size** in local tokens, the format's intrinsic size cost.
- **Collateral edits** from the response analysis (unintended removals or
  additions).
- **Error visibility.** The share of failures that are parse or validation
  errors, compared with silent wrong states, per format.

Analyse with paired tests per instance (McNemar-style per level, or a
mixed-effects logistic model). More distinct instances beat more repeats
(E373: Luna repeats agreed on 55 of 67 cells), so use about four instances
per level; calibration uses one repeat and full passes three (R01-D11).

### Cohorts

| Cohort | Status | Role in round 2 |
|---|---|---|
| Haiku 5.5, `low` | Admitted (E364) | Continues; ladders must reach above its ceiling |
| Luna, `medium` | Admitted (E363, D64) | Continues; assessed for degradation (question 4) |
| Haiku 4.5, thinking budget 1,024, no output cap | Admitted for development on this binary (E361, context policy v1); needs a probe | Development cohort (R01-D10); rigorous inclusion decided later |
| Terra (`gpt-5.6-terra`), `low` | Not admitted | Assessed (R01-D9); see below |

**Terra.** The Codex catalog captured on 2026-10-26 lists `gpt-5.6-terra`
("Older balanced model for straightforward work", medium default
effort). It lists no GPT-6 Terra. The same catalog lists `gpt-6-sol`,
`gpt-6.1-sol` and `gpt-6-astra` as stronger options. Steps:

1. Refresh the catalog (no inference) and confirm which Terra the operator
   means.
2. Admit it on Codex 0.163.0. Policy v3 checks model and effort against the
   profile, so one probe should settle admission without a policy change.
3. Run it on the calibration pass beside Luna, at `low` (R01-D9).

**Decision rule (development, fixed before the calibration data).**

| Outcome | Action |
|---|---|
| Luna's breaking point is at level 1 on most families (no format signal) and Terra's is not | Switch the Codex cohort to Terra |
| Luna separates formats on some families, and Terra adds separation on others | Add Terra as a third cohort |
| Terra breaks at about the same levels as Luna | Keep Luna; Terra adds cost without information |

Cost and stall rate are reported alongside, but they do not decide.

### Material

Under R01-D8, round 2 develops on works 4–6 (consumed by the first rigorous
round) and a new synthetic seed (`r01-round2-synthetic-v1`). Works 1–3 are
not used until round 2's rigorous stage, which loops back to them; works
7–11 stay unopened. The development-material part of R01-D8 is proposed and
awaits confirmation.

## Steps

1. **Confirm open decisions** (below) and record them as R01-D9 onward.
2. **Catalog and Terra probe.** Refresh the Codex catalog, then run one
   admission probe of the chosen Terra profile. If Haiku 4.5 is included,
   run one probe to confirm it is still served.
3. **Implement offline.**
   - Ladder generators per family, with a level parameter, independent
     oracles and level-aware wrong-answer sets.
   - Large-window extraction rules.
   - A timeout that scales with output.
   - The new measures: pass³, tokens to first correct answer, output size,
     error visibility, breaking-point fit.
   - Package `round2-development-v1`, with an offline rehearsal of every
     level (goldens pass, wrong answers rejected).
4. **Calibration pass.** One instance per level and format for every cohort,
   one repeat (development, R01-D11). Adjust levels so each cohort's ladder
   spans from passing to failing, then apply the Terra decision rule. Record
   an E record.
5. **Development pass.** About four instances per level, three repeats
   (R01-D11). Record an E record with breaking points, ceiling costs and
   error visibility.
6. **Decision point.** Use the criteria below for the agentic evaluation,
   decide whether to add capable cohorts (for example Sonnet 5.5 or Opus 5.5
   through Claude Code, or `gpt-6.1-sol` or `gpt-6-astra` through Codex, each
   with its own admission), then freeze round 2.
7. **Rigorous round 2** on works 1–3 (R01-D8), proceeding through the order
   as needed.

## Agentic evaluation (step 3 of the proposal): decision criteria

Proceed to a tool-loop evaluation (offline fake host, real document tools,
turn budget; measures are completion, tool calls, tokens and
self-correction) if either holds:

- Breaking points differ between formats for at least one cohort. A loop
  then tests whether the difference survives feedback, which is the
  product's real workflow.
- Validator-caught errors are a large share of failures for some format
  (proposed threshold: at least a third). A loop can turn caught errors into
  recoveries, which single-shot scoring cannot show.

Defer it if every format breaks at the same levels and ceiling costs differ
by less than about 20%. Round 2 then answers the question without it.

## Budget

Rough per cohort for a full pass, before calibration trims it: 7 families ×
4 levels × 4 instances × about 6 arms (2 to 5 on source families) × 3
repeats is about 1,200 initial runs. Larger windows make each run cost
more. With four cohorts, a full pass is many hours on subscription CLIs.
The one-repeat calibration pass (one instance per level) is about a twelfth
of that. Step 3 produces a firm count before any run.

## Decisions (2026-10-28)

The operator answered the open decisions:

| ID | Decision |
|---|---|
| [R01-D8](../../spec/r01-research/decisions/r01-d8-round-2-version-reset-and-work-reuse.md) | Version reset; develop on works 4–6 and seed `r01-round2-synthetic-v1`; rigorous round 2 restarts at works 1–3 (development part confirmed) |
| [R01-D9](../../spec/r01-research/decisions/r01-d9-round-2-terra-cohort.md) | Assess `gpt-5.6-terra` at `low`; rigorous inclusion by the Terra decision rule |
| [R01-D10](../../spec/r01-research/decisions/r01-d10-round-2-haiku45-cohort.md) | Haiku 4.5 joins development (thinking 1,024, no output cap); rigorous inclusion decided later |
| [R01-D11](../../spec/r01-research/decisions/r01-d11-round-2-ladders-and-repeats.md) | Families and levels as proposed; about four instances per level; calibration one repeat, full runs three |
| [R01-D12](../../spec/r01-research/decisions/r01-d12-round-2-output-scaled-timeout.md) | Timeout scales with expected output; elapsed time is reported |

The sections above incorporate these decisions. **Next: step 2** (catalog refresh and
Terra and Haiku 4.5 probes), then step 3 (offline implementation).

## Scope

Subscription CLI only, within the standing scope; no API billing, Bitwig or
controller contact. No product runtime change. Development results never
count toward rigorous results. E379 remains the first round's rigorous
result.
