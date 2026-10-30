# R01 round 2 — Difficulty-scaled tasks and saturation-resistant measures

Research brief, drafted 2026-10-28 after the first rigorous run
([E379](../evidence/experiments/e379-r01-rigorous-three-repeat-run.md)).
**Status: steps 2–5 are complete (E380–E385). The statistics work before
step 6 is done: the model and package v3 are in
[E386](../evidence/experiments/e386-r01-round2-mixed-model-discordance-and-package-v3.md),
and the v3 pass is
[E387](../evidence/experiments/e387-r01-round2-v3-development-pass.md). Step 6,
revised by [R01-D19](../../spec/r01-research/decisions/r01-d19-round-2-format-dependent-families-before-step-6.md)
to new format-dependent task families, is next.** Parent brief:
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

*Outcome (E380).* The refreshed catalog adds `gpt-6.1-terra` (default effort
`low`). Policy v3 pins Luna's model, so admission needed policy v4, which
selects the context template by model (R01-D13). Both Terra models are
admitted at `low`. `gpt-5.6-terra` remains the default cohort under R01-D9,
and `gpt-6.1-terra` is optional. The operator chose `gpt-5.6-terra` alone
for now ("Just 5.6 first.").

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
7–11 stay unopened. The operator confirmed this development-material rule
(R01-D8); E381 opened only works 4–6.

## Steps

1. **Confirm open decisions** (below) and record them as R01-D9 onward.
2. **Catalog and Terra probe.** Refresh the Codex catalog, then run one
   admission probe of the chosen Terra profile. If Haiku 4.5 is included,
   run one probe to confirm it is still served. *Done (E380): both Terra
   models and uncapped Haiku 4.5 pass every gate.*
3. **Implement offline.**
   - Ladder generators per family, with a level parameter, independent
     oracles and level-aware wrong-answer sets.
   - Large-window extraction rules.
   - A timeout that scales with output.
   - The new measures: pass³, tokens to first correct answer, output size,
     error visibility, breaking-point fit.
   - Package `round2-development-v1`, with an offline rehearsal of every
     level (goldens pass, wrong answers rejected).

   *Done (E381).* There are 116 tasks (29 levels × 4 instances) and 448
   eligible cells. The rehearsal accepts every golden and rejects all 3,546
   wrong answers; 259 focused tests pass. Calibration is 112 initial runs per
   cohort (448 in total, at most 1,344 submissions). R01-D13 records the
   design details.
4. **Calibration pass.** One instance per level and format for every cohort,
   one repeat (development, R01-D11). Adjust levels so each cohort's ladder
   spans from passing to failing, then apply the Terra decision rule. Record
   an E record.
5. **Development pass.** About four instances per level, three repeats
   (R01-D11). Record an E record with breaking points, ceiling costs and
   error visibility.
6. **Format-dependent task families** (R01-D19, replacing the original
   decision point). Design, calibrate and run new families on the current
   cohorts. See the [handoff](#next-steps-handoff-2026-10-30-after-e387-format-dependent-families).
   The agentic evaluation, capable cohorts (for example Sonnet 5.5 or Opus
   5.5 through Claude Code, or `gpt-6.1-sol` or `gpt-6-astra` through Codex,
   each with its own admission) and the round-2 freeze follow only if a
   question needs them.
7. **Rigorous round 2** on works 1–3 (R01-D8), proceeding through the order
   as needed.

## Agentic evaluation (step 3 of the proposal): decision criteria

*Deferred by R01-D19.* E387's corrections already act as a short loop:
Haiku's C3/C4 differences vanish within two corrections, and Luna's write
difference survives. The criteria below remain recorded.

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
| [R01-D13](../../spec/r01-research/decisions/r01-d13-round-2-admission-and-offline-design.md) | Implementation details: Codex context policy v4 and Terra admission, window rule, ladder specifics, timeout formula and measures (accepted) |
| [R01-D14](../../spec/r01-research/decisions/r01-d14-round-2-two-cohorts-harder-ladder.md) | Haiku 5.5 `low` and Luna `high` on one harder shared ladder (package v2); Terra and Haiku 4.5 leave the development pass |
| [R01-D15](../../spec/r01-research/decisions/r01-d15-round-2-trimmed-development-pass.md) | Trimmed development pass: range-edit and reads in full; other families at their top levels |
| [R01-D16](../../spec/r01-research/decisions/r01-d16-round-2-codex-websocket-framing-and-reaudited-continuation.md) | Codex context policy v5 (websocket framing) and continuing a re-audited control halt |
| [R01-D17](../../spec/r01-research/decisions/r01-d17-round-2-continuation-after-sleep-stall-halt.md) | Continuing after a sleep-caused stall halt; the operator manages host power |
| [R01-D18](../../spec/r01-research/decisions/r01-d18-round-2-discordant-levels-fresh-instances.md) | The analysis model, per-cohort levels chosen for discordance, and fresh instances over repeats (package v3; accepted, run as E387) |
| [R01-D19](../../spec/r01-research/decisions/r01-d19-round-2-format-dependent-families-before-step-6.md) | Step 6 becomes format-dependent task families on the current cohorts; the tool loop and stronger cohorts are deferred |

The sections above incorporate these decisions. Steps 2–4 are complete.
The calibration pass ([E382](../evidence/experiments/e382-r01-round2-calibration-pass.md))
ran 448/448 runs with no halt or stall. Haiku 5.5 and Terra stay near the
ceiling, Haiku 4.5 spans pass to fail on four families, and Luna is at its
floor at level 1 on three. **Next: the operator decides** the proposed
per-cohort levels and the Terra rule reading (add Terra as a third Codex
cohort). Then build package v2 and per-cohort selection for step 5.
[E383](../evidence/experiments/e383-r01-round2-luna-high-effort-floor-probe.md)
reran six of Luna's floor tasks at `high`: 24/26 first-attempt, against 5/26
at `medium`. Luna `medium` mostly skips reasoning. The operator then chose
Haiku 5.5 `low` and Luna `high` on one harder ladder
([R01-D14](../../spec/r01-research/decisions/r01-d14-round-2-two-cohorts-harder-ladder.md)).
Its calibration ([E384](../evidence/experiments/e384-r01-round2-v2-calibration.md))
breaks range-edit for both cohorts and derived reads for Luna, but the group
edit families barely bend. The operator chose the trimmed pass (R01-D15).
[E385](../evidence/experiments/e385-r01-round2-v2-development-pass.md) is
step 5:
- **C3 vs C4:** every significant difference favours C4 FIELDS (Haiku: reads
  and regroup; Luna: retime and member move).
- **Other formats:** bar|beat is the weakest performed arm, and Luna's C3
  FIELDS failures are 68% validator-caught.
- **Agentic criteria:** both hold.

Step 6 waited for the statistics work below; R01-D19 later revised it to
format-dependent task families. [E386](../evidence/experiments/e386-r01-round2-mixed-model-discordance-and-package-v3.md)
has done its three statistics items offline:
- **Model:** C4 over C3 FIELDS for Haiku on reads and writes, and for Luna on
  writes; Luna's reads lean C3, a significant interaction.
- **Settled:** bar|beat's deficit.
- **Next pass:** package v3 is built for R01-D18 and awaits the operator.

## Next steps (handoff, 2026-10-30)

The operator chose to strengthen the statistics before step 6, keeping
Haiku 5.5 `low` and Luna `high` as cohorts. Start with
[E385](../evidence/experiments/e385-r01-round2-v2-development-pass.md),
including its correction section. Its per-repeat McNemar p-values overstate
the evidence, and cluster-aware tests (level × instance) are the reporting
basis. Findings to carry:
- **Firm:** bar|beat is worse than every other performed arm.
- **Likely:** C4 FIELDS ≥ C3 FIELDS. Haiku pooled p = 0.017; Luna's edits
  favour C4 (retime p = 0.016, member-move p = 0.031). Luna's reads lean C3,
  without significance.
- **Not significant:** C4 FIELDS against the baseline formats.

Do these three items in order; each is offline until a run is approved.
*Done (E386, R01-D18, E387); see the [status below](#status-2026-10-30-package-v3-run-e387).*

1. **Fit a mixed-effects logistic model to E385's existing results**
   (E385 option 4).
   - **Data:**
     [`analysis-round2-v2-dev-r3.json`](../evidence/data/r01-pilot-runs/analysis-round2-v2-dev-r3.json),
     one row per run, with cohort, family, level, instance, repetition, arm
     and `firstAttemptPass`.
   - **Model:** per cohort, `pass ~ format + family × level + (1 | instance)`,
     where instance means (family, level, instance). Fit C3 against C4
     FIELDS on source families, and all six arms on performed families. Add
     a pre-stated `format × family-group` term (edits against reads), so
     Luna's read/edit split is estimated, not averaged away.
   - **Ceiling cells:** use a mild penalty or a Bayesian fit; preservation
     and delete are mostly all-pass.
   - **Tooling:** a small offline Python step is fine (for example
     statsmodels' binomial mixed GLM, or a penalized fit). Keep the script
     beside the analysis and report odds ratios with 95% intervals.
   - **Purpose:** this is a development check of the method. Write the
     model down so it can be pre-registered for the rigorous round.
2. **Choose the difficulty cases that maximize discordance**
   (cases where one format passes and the other fails).
   - From E385's rows, count discordant clusters per cohort × family ×
     level for each planned comparison (C4 vs C3, bar|beat vs the others).
     Ties waste runs.
   - Candidates from E385:
     - Haiku: reads at 16–32 groups, regroup at 12–16;
     - Luna: retime at 16–32, reads at 16–32, member-move at 12–16;
     - range-edit at 256–512 for the performed arms.
   - Consider levels between or above the tested ones only where the
     ladder had not yet crossed. Drop all-pass ceiling cells, except
     where a cost-at-ceiling measure needs them.
   - The result is a per-cohort level list. R01-D11 allows per-cohort
     ladders; all formats within a cohort share one.
3. **Reconfigure toward more instances and fewer repeats**, then build a
   package for operator approval.
   - **Question first:** are some repeats still worth keeping? Use E385's
     three repeats: within-instance agreement per cohort, arm and family,
     and how often a single repeat would have flipped a cluster's C3/C4
     verdict.
   - **Options:** one repeat everywhere; or one repeat plus a small repeated
     subset as a stability check (for example two repeats on a fixed share
     of instances). Use item 1's model to compare the power of 12 instances
     × 1 repeat against 4 × 3 at equal cost.
   - **Build:** synthetic families make instances free (`round2-tasks.mjs`,
     `INSTANCES`). Range-edit is limited by real material: the 512-note
     windows all come from one piano part (E381). Decide the instance count
     per family under that limit, and record the choice as an R01-D record.
   - **Before any run:** a new package version, its offline rehearsal and
     an execution manifest; then ask the operator.

### Status (2026-10-30): package v3 run (E387)

[E386](../evidence/experiments/e386-r01-round2-mixed-model-discordance-and-package-v3.md)
records the three items.

1. **Model.** [`round2-glmm.py`](../evidence/data/r01-pilot-runs/round2-glmm.py)
   fits the model per cohort with random effects for the instance and for
   instance × format. The second term correlates repeats, so they do not
   count as independent. Odds ratios for C4 over C3 FIELDS:
   - Haiku: writes 3.2 (p = 0.019), reads 5.7 (p = 0.004);
   - Luna: writes 6.0 (p = 0.0002), reads 0.52 (n.s.), read × format
     interaction p = 0.0006.

   bar|beat is worse than every arm (p ≤ 0.0004). C4 against the baselines
   is open, except Luna's C4 over MIDI JSON. R01-D18 writes the model down
   for pre-registration.
2. **Discordance** selects per-cohort levels (R01-D18's rule). bar|beat no
   longer selects levels.
3. **Instances over repeats.** At equal cost, 12 × 1 is at least as powerful
   as 4 × 3 everywhere, and a single repeat reverses a cluster's verdict in
   only 3 of 384 cases. Range-edit is the exception. Works 4–6 hold only four
   fresh low-overlap 128-note windows and none at 256 or 512 notes, so it
   keeps three repeats on those four.

The operator approved R01-D18, and the pass ran as
[E387](../evidence/experiments/e387-r01-round2-v3-development-pass.md):
- **Haiku:** reads favour C4 (OR 10.2) and regrouping favours C4, but
  retiming leans C3. E385's general write advantage for Haiku is not
  confirmed.
- **Luna:** edits favour C4 (OR 8.2) and reads lean C3 (n.s.), with a
  significant interaction.
- **Model rule:** the model now pins the instance × format term when there
  are no repeats.

**Next: step 6 as revised by R01-D19**, the format-dependent families in the
[handoff below](#next-steps-handoff-2026-10-30-after-e387-format-dependent-families).
Carry these findings:
- C3 vs C4 depends on task type: C4 for edits (Luna) and for reads and
  regrouping (Haiku).
- bar|beat is the weakest performed arm.
- C4 against the baselines is unresolved, and larger windows need material
  beyond works 4–6.

The v3 commands, for reference (each package's full pass is its own cohort;
no `--cohorts` or `--repeats` is needed):

```
node --import tsx benchmarks/r01-candidates/cli-pilot-runner.mjs start /tmp/ghostnote-r01-producer-pal /tmp/ghostnote-r01-tooling round2-development-v3-haiku ../.tmp/r01-round2-v3-dev-haiku
node --import tsx benchmarks/r01-candidates/cli-pilot-runner.mjs start /tmp/ghostnote-r01-producer-pal /tmp/ghostnote-r01-tooling round2-development-v3-luna ../.tmp/r01-round2-v3-dev-luna
```

Pinned tooling now lives in the ignored `.tmp/r01-tooling/` (`producer-pal`,
`tooling`), because the periodic `/tmp` cleanup deleted the old copies
(E387). Pass those two paths where commands name `/tmp/ghostnote-r01-…`.

**Standing rules for runs.** Development runs use the subscription CLIs.
Tell the operator when a long run needs the lid open and power connected;
do not start `caffeinate` or change power settings (R01-D17). Cohorts can
run as parallel per-cohort processes with identical orders (E385).
Continuations exist for control halts (`--after-control-halt`, R01-D16)
and sleep stalls (`--after-stall-halt`, R01-D17). Analyse merged runs with
`round2-analysis.mjs DIR:COHORT …`. 265 focused tests pass
(`R01_UPSTREAM=../.tmp/r01-tooling/producer-pal
R01_TOOLING=../.tmp/r01-tooling/tooling node --import tsx --test
benchmarks/r01-candidates/*.test.mjs` from `brain/`). Start passes longer
than two hours as detached processes (`nohup … &`); a background tool limit
stopped E387's first start. The v1 calibration command, from `brain/`, was:
`node --import tsx benchmarks/r01-candidates/cli-pilot-runner.mjs start
/tmp/ghostnote-r01-producer-pal /tmp/ghostnote-r01-tooling
round2-development-v1 ../.tmp/NEW_OUTPUT --instances 1 --repeats 1`. Add
`--cohorts …,codex-terra-6-1` to include the newer Terra. Run it in the
background, check the CLI versions first, then analyse with
`round2-analysis.mjs` and record an E record.

## Next steps (handoff, 2026-10-30, after E387): format-dependent families

R01-D19 replaces step 6's loop and cohort decisions with new task families on
the current cohorts.
- **Aim:** more **discordant** pairs (one format passes, the other fails),
  not more failures. In E387, Haiku had 57 both-pass pairs against 3
  both-fail, so it has the most room.
- **Qualifying families:** difficulty comes from how a format represents
  structure, not from counting more independent operations (E384).
- **Formats:** the families also show what C3 FIELDS (explicit per-note
  timing with nominal columns) and C4 FIELDS (notes defined inside their
  timed groups) are meant to address.

### Family designs (to refine during implementation)

| Family | Task | Scaling axis | Why the format matters |
|---|---|---|---|
| **Query-selected edit** | Edit the notes or groups selected by a derived property: for example, transpose every note whose performed onset lies in [X, Y), or move the anchor of every group with a member there. Near misses sit at the boundaries. | Candidates near the boundaries, and groups scanned | C4 must derive onsets to select, then edit structure. C3 can read onsets but must keep its equations consistent. It combines E385's two separating operations: derived reads and group edits. |
| **Overlapping memberships** | Edit, through one group, a note that also belongs to other timed or timing-free groups: move it, retime its group, or remove it from one group only. Every other membership, order and spread must stay consistent. | Memberships per note and overlapping groups | C4 defines each note in one group and references it elsewhere; C3 repeats context per note. It tests C4's colocation claim. |
| **Edit within large state** | A small edit (one group retime or member move) inside a large synthetic document of many groups, loose notes and rich fields, with everything else preserved exactly. | Surrounding notes and groups (synthetic, so no material limit) | Preservation alone was at the ceiling, and edits alone bend. Together they test whether a format's size and structure cause collateral damage. |
| **Interpretation maintenance** (optional) | Edits under mixed provenance. Inferred nominal timing or groove must become `stale` where an edit invalidates it, while declared intent stays current. | Affected interpretations and provenance mix | It exercises C3's nominal columns and both formats' provenance rules, which no current family tests. |

The arms are C3 and C4 FIELDS (source families, R01-D7). Add the C4 JSON
control at one level per family only if it helps separate encoding from
layout.

### Steps

1. **Implement offline.**
   - Generators with a level parameter and independent oracles.
   - Level-aware wrong answers: boundary errors, lost memberships,
     collateral changes and missed stale marks.
   - Package v4 per cohort on the R01-D18 machinery, with fresh seeds or
     instances.
   - Offline rehearsal (goldens pass, wrong answers rejected) and focused
     tests.
2. **Calibration** (operator approval first). One instance per level, four
   levels per family, one repeat, both cohorts: for three families, about 24
   runs per cohort, under an hour. Choose per-cohort levels near 50% with
   discordance in view; ladders may differ between cohorts.
3. **Development pass** (operator approval first). About 12 fresh instances ×
   one repeat at the chosen levels: for three families at three levels,
   about 216 runs per cohort, roughly 3–4 hours in parallel. Record an E
   record using the E387 model (C4 effect per family group, interactions)
   and sign tests.
4. **Then decide with the operator.**
   - If the families separate formats, consider freezing round 2 for the
     rigorous round on works 1–3.
   - If they saturate both cohorts, consider a stronger cohort: the transfer
     question R01-D19 defers.

## Scope

Subscription CLI only, within the standing scope; no API billing, Bitwig or
controller contact. No product runtime change. Development results never
count toward rigorous results. E379 remains the first round's rigorous
result.
