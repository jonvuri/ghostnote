# R01-D13 — Round 2: cohort admission basis and offline design

Date: 2026-10-28. Status: **accepted by the operator** on 2026-10-28 ("All
of these choices sound good to me. Proceed with calibration."). It fixes the details that R01-D9 to
R01-D12 left to steps 2 and 3 of the
[round 2 brief](../../../context/work/r01-round-2-difficulty-scaling.md).
Evidence: [E380](../../../context/evidence/experiments/e380-r01-round2-catalog-and-admission-probes.md)
(admission) and [E381](../../../context/evidence/experiments/e381-r01-round2-offline-implementation.md)
(offline build).

## Decision

### Cohorts and admission

- **Codex context policy v4** selects the fixed-context template by model.
  Luna's template is unchanged. `gpt-6.1-terra` receives Luna's context
  exactly, apart from the model name. `gpt-5.6-terra` has its own template,
  captured from its probe: it advertises one tool fewer
  (`request_user_input_async`) and receives a shorter, model-specific
  multi-agent hint in place of Luna's role instructions. Everything else
  compares as in v3.
- **Model selection.** Codex responses never name the served model.
  [D55](d55-r01-luna-model-selection-evidence.md)'s basis (the captured
  request names the model, the turn succeeds, and no reroute occurs) applies
  to both Terra models as `r01-codex-terra-request-model-v1`.
- **Which Terra.** The refreshed catalog lists `gpt-6.1-terra` ("GPT-6.1
  Terra Codex model", default effort `low`), which was absent when R01-D9
  chose `gpt-5.6-terra`. Both are admitted at `low`. The round-2 default
  cohort stays `gpt-5.6-terra` (`codex-terra`) under R01-D9;
  `codex-terra-6-1` is an optional cohort. The operator answered on
  2026-10-28: "Just 5.6 first." Calibration therefore runs `gpt-5.6-terra`
  only; `gpt-6.1-terra` stays admitted but unscheduled.
- **Profiles.** Haiku 5.5 `low` (`claude-current`); Luna `medium`
  (`codex-current-medium`, D64); Haiku 4.5 with a 1,024-token thinking budget
  and no output cap (`claude-historical-uncapped`, context policy v1; the
  client sends `max_tokens` 32,000); Terra `low`.

### Material

- **Windows** (`r01-round2-windows-v1`): N consecutive notes of one pool asset of
  works 4–6, without the 16-quarter cap. A window never splits a chord. It is
  refused on a normalization collision or when a target rule of a family that
  uses its size finds no case. Instances cycle over the works that can supply
  N notes, in seeded order. A later instance from the same work takes the
  candidate with the smallest largest overlap with earlier windows, and no
  window repeats an earlier one.
- **No track merging or synthetic padding.** Works 4–6 supply every size up
  to 512 notes. At 512, one asset (*the gapra whitewood* piano) supplies all
  four instances, so instances 2–4 overlap earlier ones. 1,024-note
  preservation levels are not built.

### Ladders

R01-D11's families and starting levels are unchanged. Details:

- **Derived-onset read** (p02, p13): G timed groups and the p13 window query.
  The query spans the first group's second member to the last group's fourth
  member. It contains a tie whose ID order differs from note-array order and
  an untimed timing-free member.
- **Group retime** (p16): group i of G changes; even i moves its anchor, odd
  i doubles its spreads. Level 2 is round 1's p16.
- **Regroup** (p14): K five-note sets become K timed groups. **Member move**
  (p15): M moves over ceil(M/2) target/source pairs.
- **Range edit** (p08): an N-note window; the range holds N/16 to N/8 notes
  and starts at or after note index N/3.
- **Selective delete** (p09): a fixed 128-note real window into which one
  target and K same-pitch near misses are planted at a pitch with no notes
  nearby. Notes are renumbered so planted IDs do not stand out. Planting
  gives exact near-miss counts, which real material does not supply.
- **Preservation** runs as two series: performed p11 on the six primary
  arms, and exact p12 on the source arms. The p12 series uses the same real
  windows at exact source timing, with wider fields on a fixed subset of
  notes.
- **Diagnostics** (C3 JSON, C4 JSON, detached C4) run at the second level of
  each source family.
- **Seeds:** synthetic `r01-round2-synthetic-v1`, velocity
  `r01-round2-velocity-v1`, order `r01-round2-order-v1`. Four instances per
  level.

### Timeout and measures

- **Timeout** (`r01-round2-timeout-v1`, R01-D12): per family level,
  `ceil((120 s + 60 ms × T) / 10 s) × 10 s`. T is the largest golden response
  in local o200k tokens over the level's arms and instances. Limits range
  from 130 s to 1,120 s. They are pinned in the package and plan.
- **Measures** (`r01-round2-measures-v1`): first-attempt and within-budget
  success, pass³ (three repeats), generated tokens and elapsed time to the
  first correct answer, first-answer local tokens, collateral edits and
  validator-caught failure share. Breaking points use a ridge-penalized
  logistic fit on log2(level) with a 95% instance-cluster bootstrap. A ladder
  that never crosses 50% is reported as above or below its range. C3 versus
  C4 FIELDS is tested per level with an exact McNemar test.

## Consequences

- A calibration pass is `cli-pilot-runner.mjs start … round2-development-v1
  OUTPUT --instances 1 --repeats 1`. It schedules 112 initial runs per cohort
  (448 for four cohorts, at most 1,344 submissions).
- Level changes after calibration need a new package version and execution
  manifest. Results from different packages are never pooled.
- Round 1's packages, plans and execution manifests are unchanged; their
  regeneration checks still pass.
