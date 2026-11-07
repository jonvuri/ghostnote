# R01 format comparison: findings at the pause

This is the citable summary of R01's note-format comparison as it stood when
the operator paused it on 2026-10-31
([R01-D23](decisions/r01-d23-pause-format-comparison-and-open-round-3.md)).
Every number below comes from the cited E record; consult that record for
method, artifacts and limits. The [R01 brief][brief] and the
[round 2 brief][r2] hold the full history.

## 1. Status and scope

- **Paused at the development stage.** Round 2's step 4 was resolved as
  neither option: no rigorous round 2 and no stronger cohort. The live format
  (Ghostnote document 1.0 with compact-bar FIELDS) stays the product default.
  C4 remains a documented candidate for inline group authoring. R01 itself
  stays open for round 3, which investigates the real-use costs found in
  [E392]. Packages, harnesses and resume notes are intact (section 5).
- **Stage labels** ([trial stages](PILOT-DRAFT.md#trial-stages)). *Development*
  runs reuse inputs and tune formats, tasks and harness; they guide design and
  support no adoption claim. *Rigorous* runs freeze every version and use
  fresh inputs. **[E379] is the only rigorous run** (round 1, frozen by
  [R01-D1](decisions/r01-d1-rigorous-freeze-versions.md)–[R01-D7](decisions/r01-d7-rigorous-reporting.md)).
  Every round-2 result (E382–E391) is development evidence; round 2 is a
  version reset and never pools with E379
  ([R01-D8](decisions/r01-d8-round-2-version-reset-and-work-reuse.md)).
- **What ran.** Offline codecs, oracles and screens (E353–E358); CLI control
  admission (E359–E365); round 1 development passes (E369–E377), rigorous
  inputs (E378) and run (E379); round 2 calibration and development passes
  (E380–E391); a real-use classification (E392). All model calls used
  subscription CLIs with captured-request audits; none touched Bitwig.
- **What did not run.** Candidate 1's command/view API, multi-turn or
  tool-loop trials, any B2/B3 agent task, any capable cohort (for example
  Sonnet or Opus 5.5), and any rigorous round-2 run. Works 1–3 (round-2
  rigorous material) and 7–11 remain unused for round 2.
- **Cohorts.** Haiku 5.5 (`claude-haiku-5-5`) at `low` throughout. Luna
  (`gpt-6-luna`) at `low` in round 1 development, `medium` in E379
  ([D64](decisions/d64-r01-luna-cohort-effort-medium.md)) and `high` in round
  2 ([R01-D14](decisions/r01-d14-round-2-two-cohorts-harder-ladder.md)).
  Results are reported within each cohort; providers are not ranked
  ([R01-D7](decisions/r01-d7-rigorous-reporting.md)). Haiku 4.5 and
  `gpt-5.6-terra` appear only in E382's calibration.

## 2. Candidates and arms

- **Baseline:** current Ghostnote document, as FIELDS and as JSON
  ([README](README.md#candidate-1-current-documents-commands-and-views)).
  Candidate 1 adds commands and views over it; that API was screened offline
  only.
- **C2, Producer Pal adaptation:** bar|beat and MIDI JSON, precision-adapted
  with a reparse guard ([PRODUCER-PAL.md](PRODUCER-PAL.md)).
- **C3, explicit notes:** every row has an explicit onset and duration, with
  adjacent nominal fields and group references
  ([COMPACT-FIELDS.md](COMPACT-FIELDS.md); JSON reference in
  [STRUCTURED.md](STRUCTURED.md#candidate-3-compact-realized-notes)).
- **C4, group-local FIELDS:** note rows sit inside their timed groups, and
  onsets derive from anchor, delay and spread
  ([NESTED-FIELDS.md](NESTED-FIELDS.md); JSON reference in
  [STRUCTURED.md](STRUCTURED.md#candidate-4-grouped-timing-with-direct-fallback)).
- **Arms in agent trials:** six primary arms on performed tasks (baseline
  FIELDS and JSON, C3 FIELDS, C4 FIELDS, bar|beat, MIDI JSON). Source tasks
  compare C3 against C4 only, because no annotation adapter exists for the
  baseline or Producer Pal; C3 JSON, C4 JSON and detached C4 FIELDS are
  diagnostics ([pilot arms](PILOT-DRAFT.md#tasks-arms-and-coverage)).

## 3. Standing results on the R01-D22 grid

Cells follow [R01-D22](decisions/r01-d22-capability-grid-focus.md): state A1
performed core, A2 authoritative host state, A3 annotative context; interaction
B1 restatement, B2 addressed editing, B3 sustained editing. "First attempt"
means a pass without correction feedback.

### A1/B1: performed formats

1. **bar|beat is the weakest performed arm** (strong for both cohorts).
   - *Rigorous* ([E379]): first-attempt passes of 24 per arm were bar|beat 20
     (Haiku) and 5 (Luna `medium`), against 21–24 and 14–18 for the other
     five arms.
   - *Development* ([E386], mixed-effects model on [E385]): every other arm
     beats bar|beat with odds ratio 7.9–21 for Haiku (each p ≤ 0.0001) and
     7.2–47 for Luna `high` (each p ≤ 0.0004). The deficit survives
     instance-clustered sign tests ([E385], p ≤ 0.04). Every round-1 pass
     agrees ([E373], [E375], [E377]).
   - Its failures are almost always silent wrong states ([E384], [E385]);
     causes include carried velocity/duration state and grid-plus-offset
     positions ([E373]).
2. **Baseline FIELDS, C3 and C4 hold up against MIDI JSON; differences among
   them are mostly not established.** In E379 the five non-bar|beat arms are
   within 21–24/24 (Haiku) and 14–18/24 (Luna). In [E386] only one non-bar|beat
   contrast is significant: C4 FIELDS over MIDI JSON for Luna `high`, OR 6.0
   (2.0–20), p = 0.002. It rests on range edits whose 512-note windows come
   from one piano part. Luna's range-edit ladder ([E385]) falls 12, 7, 3 of
   12 for baseline JSON and 5, 5, 4 for MIDI JSON at 128/256/512 notes, while
   baseline FIELDS, C3 and C4 stay at or above half to 512. At 128 notes on
   fresh windows ([E387]) baseline FIELDS and C3 scored 12/12, C4 10/12, and
   no C4 contrast was significant.
3. **Payload size at the ceiling** (descriptive). For 512-note preservation,
   Haiku's median first answers were bar|beat 5,915 local tokens, MIDI JSON
   9,246, C3 9,768, C4 10,287, baseline FIELDS 11,888 and baseline JSON
   16,503 ([E385]; [E382] gives the same order, 2.6× range).

### A2/B1: host state carried through restatement

4. **Exact preservation of wider state is at the ceiling** for both cohorts:
   p12 (non-grid timing, wider fields, opaque annotation) passed 3/3 per
   FIELDS arm for Luna in [E379] and [E375]; 512-note preserve-exact passed
   12/12 on both FIELDS arms for Haiku and 9 (C3) and 12 (C4) for Luna in
   [E385]. Rich-field large edits are reported under A3 (E391). This measures
   cost, not a separation.

### A3/B1: inline group structure, C3 against C4 FIELDS

5. **Luna: C4 is better for edits that change onsets** (strong, replicated).
   - *Rigorous* ([E379], Luna `medium`): on p04, p07, p15 and p16, C4 12/12
     against C3 2/12; all source tasks C4 15/24 against C3 8/24 (within
     budget 17 against 14). No significance test is reported for round 1.
   - *Development:* [E375] (Luna `low`) 12/12 against 0/12 on the same tasks.
     [E385] retime 18 against 6 of 24 (cluster sign test p = 0.016) and
     member-move 24 against 17 (p = 0.031). [E386] models writes at OR 6.0
     (2.4–17), p = 0.0002; [E387] replicates on fresh instances at OR 8.2
     (3.7–21), p < 0.00001. [E391] format-dependent families: overall OR 1.98
     (1.10–3.7), p = 0.023; query-selected edits 5.9 (1.6–25), p = 0.007;
     edits in large documents 9.0 (2.1–49), p = 0.002. The lead survives
     corrections (E391 within budget C4 103/144 against C3 75/144).
   - *Mechanism:* C3's explicit onsets must be recomputed when group timing
     changes; Luna's C3 failures are mostly timing-equation mismatches the
     parser rejects ([E375]). C4 derives onsets, so that error cannot occur.
6. **Luna: reads lean C3, not significantly beyond round 1's single task.**
   Reading one derived onset (p02) passed C3 3/3 and C4 0/3 in [E379] and
   [E375]. At scale, reads lean C3 without significance: [E386] OR 0.52
   (0.18–1.5), [E387] 0.50 (0.21–1.2), p = 0.11. The read × C4 interaction is
   significant in both (OR 0.09, p = 0.0006; 0.06, p < 0.00001), so a pooled
   Luna estimate mixes opposite effects.
7. **Haiku: C4 is better for derived reads and regrouping, not for edits in
   general.** [E387]: reads OR 10.2 (3.5–36), p = 0.00001 (sign test 23
   against 4); regroup sign test 13 against 4, p = 0.049; retime leans C3,
   11 against 5, p = 0.21; writes overall OR 1.3, p = 0.44. E386's Haiku
   write advantage (OR 3.2) was therefore not confirmed. On the
   format-dependent families Haiku shows no accuracy difference: 263/288,
   discordant pairs 11 against 12, OR 1.28, p = 0.58 ([E391]).
8. **Haiku: C4 reaches the same correct answers more cheaply** (consistent
   across passes). Median generated tokens on both-pass pairs: retime C3 2.4×
   C4 ([E385]) and 3.4× (37,059 against 10,893, [E387]); on E391's families
   C4 needs 0.63 (query), 0.64 (overlap), 0.75 (large edit) and 0.92
   (interpretation) of C3's tokens ([E391]; 55–68% on query in [E390]).
9. **Overlapping memberships and interpretation maintenance show no format
   difference** at these sample sizes ([E391]: Luna overlap 8 against 8
   discordant pairs; interp OR 0.67, p = 0.51).
10. **Error visibility favours C3.** C3's redundant timing turns inconsistent
    edits into validator-caught failures; other formats mostly fail
    silently. Luna's validator-caught share of failed submissions: C3 FIELDS
    59/87 (68%) against C4 5/56 ([E385]); 96/130 (74%) against 9/64 ([E387]);
    first-attempt 88/105 against 45/89, or 72/88 against 42/86 without
    non-attempts ([E391]). Haiku's shares are small (C3 8/51 in E387).
11. **Luna abandons long C3 answers.** At query 64–96 groups, 17 of 24 C3
    first answers were empty, refusals or bare headers, against 3 of 24 for
    C4; C3 answers are about 1.5× larger ([E391]).

### A1–A2/B2 and B3

12. **No agent trial measured B2 or B3 in R01.** Offline, a one-note edit in
    a 1,024-note fixture costs 70 FIELDS tokens, 93 Ghostnote JSON, 14 MIDI
    JSON merge and 11 transform tokens; these are different contracts
    (Ghostnote carries a base hash and stable IDs; Producer Pal's merge
    restates matched notes and resets omitted fields such as probability)
    ([E353]). Single-turn ID patches were measured earlier, outside R01
    ([E115], [E137]; live [E121]).

### Cohort behaviour and controls

13. **Haiku sat near the ceiling and Luna near the floor in round 1.** E379:
    Haiku 247/261 first attempt (261 within budget); Luna 138/261 (187), with
    29 cells failing every repeat ([E379]). p13 (derived-onset window) and
    p14 (group existing notes) were at Luna's floor in every format ([E375]).
    This motivated round 2's difficulty ladders.
14. **Luna's `medium` floor is largely a no-reasoning mode.** At `medium`, 84
    of 112 calibration first attempts reported zero reasoning tokens; at
    `high`, floor tasks rose from 5/26 to 24/26 ([E383]). Round 1's Luna
    split may partly reflect whether it chose to reason. Moving `low` to
    `medium` raised Luna from 119 to 145 of 261 ([E377]).
15. **Luna corrects poorly; Haiku corrects well.** For example, 22 of 178
    Luna corrections passed in [E373]; Haiku used 14 corrections in each of
    [E375] and [E379]. Luna also makes gratuitous refusals on near misses (9
    `ambiguous-selector` refusals on p09 in [E379]).
16. **Token gap.** Haiku `low` generates far more than Luna on the same
    tasks: median first-answer ratio 6.1× ([E365], 38 matched cells), 5.0×
    ([E375]) and 3.95× ([E379]), almost entirely reasoning.

### Offline codec results

17. **Producer Pal precision.** Unadapted bar|beat and MIDI JSON change fine
    1/512 timing ([E353]); MIDI JSON emits `341/512` as `0.666`, which
    Ghostnote's import floors one cell early. With the adaptation's reparse
    guard, a 55,296-input boundary sweep accepts 53,248 and refuses 2,048
    bar|beat cases explicitly, with no silent loss; all 27,648 MIDI JSON
    inputs pass ([E354]). Producer Pal note text carries no channel,
    expression, mute or release velocity ([E353]).
18. **Surface size.** C4 group-local FIELDS uses 31.98% fewer local tokens
    than C4 JSON ([E356]); C3 FIELDS uses 11.75% fewer than C3 JSON ([E357]).
    Equal-information size is not an agent result.

## 4. What is not established

- **Rigorous confirmation of round 2.** Every C3/C4 effect at scale and every
  format-dependent family result is development evidence, tuned on works 4–6
  and synthetic seeds. Only E379's round-1 split is rigorous, and E379 has no
  significance tests.
- **Transfer to capable models.** Both cohorts are small models; Haiku
  saturates most families. Whether C4's advantages persist, vanish or
  reverse for stronger models is unmeasured.
- **Differences among baseline FIELDS, C3, C4 and MIDI JSON** on performed
  tasks, except Luna's C4 over MIDI JSON at large range edits.
- **B2 and B3 for every format, and A2/B2 and A3/B2.** These are the cells
  where IDs, colocation and patch syntax should matter most and where MIDI
  JSON cannot compete by construction ([R01-D22](decisions/r01-d22-capability-grid-focus.md)).
- **Tool-loop behaviour.** Round 2's agentic criteria held (breaking points
  differ; C3's validator catches over a third of Luna's failures), but the
  loop was deferred ([R01-D19](decisions/r01-d19-round-2-format-dependent-families-before-step-6.md)).
- **Persistence, host identity across save/move/copy, and live host writes**
  of any candidate.

## 5. Reusable assets and how to resume

- **Codecs and oracles** (`brain/benchmarks/r01-candidates/`): independent
  rational oracle `common.mjs`; `compact-fields.mjs` (C3),
  `nested-fields.mjs` (C4), `structured.mjs` (JSON references) and
  `precision.mjs` (Producer Pal adapter). [Directory][code].
- **Round 1 harness:** inputs, packages and execution manifests
  (`pilot-inputs.mjs`, `pilot-package.mjs`, `pilot-execution.mjs`), the runner
  `cli-pilot-runner.mjs` with control audits and restart rules, and
  `pilot-analysis.mjs`. Control settings: [CLI-CONTROLS.md](CLI-CONTROLS.md);
  protocol: [TRIAL-PROTOCOL.md](TRIAL-PROTOCOL.md) and
  [PILOT-DRAFT.md](PILOT-DRAFT.md).
- **Round 2 harness:** ladder generators and format-dependent families
  (`round2-tasks.mjs`, `round2-families.mjs`), `round2-package.mjs`,
  `round2-analysis.mjs`, and the statistics scripts `round2-glmm.py`,
  `round2-glmm-families.py` and `round2-design.py` (run with
  `uv run --script`).
- **Data:** [`r01-pilot-runs/`][runs] (plans, results, analyses and summaries
  for every run, including `rigorous-r3/`), [`r01-pilot-inputs/`][inputs]
  (round 1 windows, packages and manifests, including `rigorous/`),
  [`r01-round2/`][round2] (round 2 windows and packages v2–v6), and
  [`r01-candidates/`][cand] (screen and precision results). Raw attempt
  directories stayed in ignored `.tmp/`.
- **Corpus:** [CORPUS.md](CORPUS.md) and the seeded work order. Round 2's
  rigorous material is works 1–3; works 7–11 remain unopened
  ([R01-D8](decisions/r01-d8-round-2-version-reset-and-work-reuse.md)).
- **Resume points:** the brief's [rigorous-stage resume][resume-rig] (exact
  commands that produced E378–E379) and [development-run resume][resume-dev];
  round 2's [step 4 and the format-dependent family steps][r2-steps]. The
  external Producer Pal checkout and tokenizer follow [E353]'s reproduction;
  [E387] records a rebuild after `/tmp` cleanup.

## 6. Relation to real use

[E392] classified 11 real product sessions (564 Ghostnote calls): 17 of 20
note-write interactions were A1/B1 scripted generation, three were
single-turn A1/B2 transforms, and B3 never occurred. No failure was caused by
the notation; the largest costs were tool design, guidance and host identity.
R01's C3/C4 differences concern models reading and writing A3 group
structure inline, which real use did not exercise. The A1/B1 results above
support keeping the live format; C4's advantages matter only if inline group
authoring becomes common.

[brief]: ../../context/work/r01-format-comparison.md
[r2]: ../../context/work/r01-round-2-difficulty-scaling.md
[resume-rig]: ../../context/work/r01-format-comparison.md#resume-rigorous-stage
[resume-dev]: ../../context/work/r01-format-comparison.md#resume-development-runs
[r2-steps]: ../../context/work/r01-round-2-difficulty-scaling.md#next-steps-handoff-2026-10-30-after-e387-format-dependent-families
[code]: ../../brain/benchmarks/r01-candidates/
[runs]: ../../context/evidence/data/r01-pilot-runs/
[inputs]: ../../context/evidence/data/r01-pilot-inputs/
[round2]: ../../context/evidence/data/r01-round2/
[cand]: ../../context/evidence/data/r01-candidates/
[E115]: ../../context/evidence/experiments/e115-established-syntax-does-not-beat-compact-bar-context.md
[E121]: ../../context/evidence/experiments/e121-guarded-agent-note-patches-pass-live-reference-dogfood.md
[E137]: ../../context/evidence/experiments/e137-compact-bar-prior-art-and-benchmark.md
[E353]: ../../context/evidence/experiments/e353-producer-pal-offline-formats-and-claims.md
[E354]: ../../context/evidence/experiments/e354-r01-candidate-prototypes-and-shard-corpus.md
[E356]: ../../context/evidence/experiments/e356-r01-nested-fields-prototype.md
[E357]: ../../context/evidence/experiments/e357-r01-compact-fields-prototype.md
[E365]: ../../context/evidence/experiments/e365-r01-haiku-effort-calibration.md
[E373]: ../../context/evidence/experiments/e373-r01-package-v4-three-repeat-development-pass.md
[E375]: ../../context/evidence/experiments/e375-r01-package-v5-three-repeat-development-pass.md
[E377]: ../../context/evidence/experiments/e377-r01-luna-medium-effort-remaining-tasks.md
[E379]: ../../context/evidence/experiments/e379-r01-rigorous-three-repeat-run.md
[E382]: ../../context/evidence/experiments/e382-r01-round2-calibration-pass.md
[E383]: ../../context/evidence/experiments/e383-r01-round2-luna-high-effort-floor-probe.md
[E384]: ../../context/evidence/experiments/e384-r01-round2-v2-calibration.md
[E385]: ../../context/evidence/experiments/e385-r01-round2-v2-development-pass.md
[E386]: ../../context/evidence/experiments/e386-r01-round2-mixed-model-discordance-and-package-v3.md
[E387]: ../../context/evidence/experiments/e387-r01-round2-v3-development-pass.md
[E390]: ../../context/evidence/experiments/e390-r01-round2-haiku-recalibration.md
[E391]: ../../context/evidence/experiments/e391-r01-round2-v6-development-pass.md
[E392]: ../../context/evidence/experiments/e392-r01-real-usage-by-capability-cell.md
