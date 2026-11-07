# R01 Stage-A pilot, draft 2 — development complete, rigorous stage frozen

**Status (2026-10-28): development is complete and the rigorous stage is
frozen ([freeze review](#freeze-review-v5)); its inputs are materialized in
[E378](../../context/evidence/experiments/e378-r01-rigorous-inputs-and-execution-manifest.md), and the three-repeat rigorous run is [E379](../../context/evidence/experiments/e379-r01-rigorous-three-repeat-run.md).** Earlier status: review answers recorded; both cohorts admitted for development. The operator
answered the draft-1 review list on 2026-10-26 ([answers](#review-answers)).
Under the [trial stages](#trial-stages) below,
this pilot is in the **development** stage: its inputs may be reused, and the
formats, cards, tasks and harness may be tuned between versioned runs. Results
from this stage support design iteration, not candidate comparison. A later
**rigorous** stage freezes every version and runs on fresh inputs. Every plan,
result and report states its stage.

Both cohorts are admitted (E363, [E364](../../context/evidence/experiments/e364-r01-haiku55-admission.md));
Haiku effort is calibrated to `low` ([E365](../../context/evidence/experiments/e365-r01-haiku-effort-calibration.md)). No pilot submission has been made. No
reserved note passage has been opened and no work has been selected. The
[machine-readable manifest](../../context/evidence/data/r01-pilot-draft/draft-2-manifest.json)
comes from the [generator](../../brain/benchmarks/r01-candidates/pilot-draft.mjs),
which computes coverage with the runner's eligibility rules and reads
reserved-work metadata only. The draft-1 [manifest](../../context/evidence/data/r01-pilot-draft/draft-manifest.json)
and its [generator sources](../../context/evidence/data/r01-pilot-draft/draft-1-sources/)
remain as pinned by E361.

The [trial protocol](TRIAL-PROTOCOL.md) governs the method; this draft supplies
its concrete Stage-A choices. [E361](../../context/evidence/experiments/e361-r01-claude-controls-and-paired-rehearsal.md)
supplies the development rehearsal that exercised the runner, scorer and
correction path end to end with historical Haiku 4.5.

## Trial stages

The operator set this posture on 2026-10-26. The first research round spent
many rounds protecting held-out material before the design or formats had
settled; the operator stated the opposite priority: “I'm not concerned with
being overly rigorous with experimental peeking here. Rather the opposite.”
R01 agent trials therefore run in two labeled stages.

- **Development (current).** Inputs may be reused across runs, including the
  pilot's real windows and synthetic instances. Formats, cards, task wording,
  oracles, windows and harness may change between runs; each change is
  versioned and every run records the versions it used. No freeze is
  required. Results guide design and tuning and support no comparative or
  adoption claim.
- **Rigorous.** Starts by operator decision once the design and formats
  appear well tuned. Freeze every version, select fresh inputs that no model
  saw in development, then apply the [trial protocol's](TRIAL-PROTOCOL.md)
  freeze, materialization, stop and no-post-hoc-deletion rules. Only this
  stage supports candidate comparison.
- **Fresh material.** Reserved works used in development become development
  material. The rigorous stage takes the next unused works in the same seeded
  selection order and a new synthetic seed.
- **Labels.** Every plan, result file, evidence record and summary states
  `development` or `rigorous`. Development results never count toward
  rigorous results.

Both stages keep the controls that make an observation interpretable: control
audits before scoring, independent oracles, equal-form correction feedback,
full accounting and retention of failures. Development relaxes material
protection and design stability, not measurement validity.

## Provider admission and model cohort

| Cohort | Proposal | Admission state |
|---|---|---|
| Current Haiku 5.5 (`claude-haiku-5-5`, adaptive effort low (calibrated in E365), no research output cap, Claude Code 2.1.302) | **Pilot cohort** | **Admitted** for development in [E364](../../context/evidence/experiments/e364-r01-haiku55-admission.md): context policy v2 (system-role turn layout, 17 betas, adaptive thinking), one control probe and six admitted first-attempt passes through the normal runner. E365 calibrates effort to `low`. |
| GPT-6 Luna through Codex 0.163.0 | **Pilot cohort** | **Admitted** in [E363](../../context/evidence/experiments/e363-r01-codex-luna-admission.md): isolated home, fixed four-tool context, no tool use, matching model/settings and successful final edit. [D58](decisions/d58-r01-retries-are-reporting.md) moves retries into reporting; D57 removes hard output ceilings. |
| Historical Haiku 4.5 (`claude-haiku-4-5-20251001`) | Not a pilot cohort | Admitted for development in E361; retained as rehearsal evidence. |

A cohort joins pilot runs only after its own admission; one cohort may start
while the other is pending. Results are compared within each pinned cohort; no
cross-provider token ranking is proposed. Token usage is compared only to
calibrate Haiku effort toward Luna before freezing the cohorts (D57).
Small models test this research condition; they do not establish adoption for the intended capable-agent
workflow. A capable-model cohort would need its own scope decision.

Thinking tokens are reported as observed. Exceeding a requested budget is
expected Haiku behavior, not a control failure: historical Haiku exceeded its
1,024-token budget in 3 of 15 rehearsal submissions (maximum 1,524). Haiku 5.5
uses adaptive effort and has no fixed budget. Every rehearsal submission
reported zero cache reads and writes.

[D57](decisions/d57-r01-natural-token-use.md) permits natural token
use without a research output cap. After usable development controls are in
place, calibrate Haiku adaptive effort on matched development tasks toward
Luna low-effort generated-token usage (reasoning plus answer), then use one
setting across all formats. Input/context overhead is reported separately.
[E365](../../context/evidence/experiments/e365-r01-haiku-effort-calibration.md) chose `low`, Haiku's lowest supported effort. On 38 matched
cells, Luna `low` reported no reasoning and generated a median of 65.5 tokens;
Haiku `low` generated 401.5 (6.1×). Answer-only portions are within 1.34×,
so the remaining gap is adaptive thinking, which effort cannot remove.
Provider defaults still apply, and the 120-second timeout is unchanged.

## Tasks, arms and coverage

Twelve instances, two per protocol family. Six use real windows from three
reserved works (A, B, C; two instances share each work's window). Six use a new
synthetic seed family for known intent, explicit refusals and wider state.
Cards, shared instructions, scope text and response contracts are the E358
versions; only task requests, inputs and oracles are new.

| ID | Family | Cohort | Source | Required result |
|---|---|---|---|---|
| `p01-read-count-window` | Read | Performed | Work A | Total notes and notes before window quarter 8 |
| `p02-read-group-timing` | Read | Source | Synthetic | Named member's delay, residual and derived onset |
| `p03-author-constrained` | Authoring | Performed | Synthetic | Six notes fully specified in prose, from an empty input |
| `p04-author-known-spread` | Authoring | Source | Synthetic | Declared four-member group from stated anchor, delay, residuals, IDs and order |
| `p05-edit-velocity-large` | Individual edit | Performed | Work B | One described note's velocity becomes 91 (37 if already 91) in a window of up to 128 notes |
| `p06-edit-transpose` | Individual edit | Performed | Work C | One described note moves up two semitones |
| `p07-halve-group-spread` | Group arithmetic | Source | Synthetic | Halve even grid-cell residuals; keep delay, durations, protected state |
| `p08-shift-onset-range` | Group arithmetic | Performed | Work A | Every onset in a stated half-open range moves later by 1/8 quarter |
| `p09-delete-one-note` | Count change | Performed | Work B | Delete one exact pitch/onset match |
| `p10-refuse-ambiguous-pitch` | Count change | Performed | Synthetic | `REFUSE ambiguous-selector` for a pitch selector with two matches at distinct onsets |
| `p11-preserve-window` | Preservation | Performed | Work C | Complete irregular window rewritten unchanged |
| `p12-preserve-exact-wider` | Preservation | Source | Synthetic | Non-grid timing, wider fields and opaque annotation unchanged; no groups |

Target selection for real-source edits must be a deterministic rule over the
normalized window, fixed before materialization (for example, the first note at or after the
median sorted index whose pitch/onset is unique and whose edited result neither
collides nor leaves MIDI range). `p10` uses a pitch-only ambiguity at distinct
onsets so the current-document arms remain eligible; E358's same-pitch/onset
ambiguity excluded them.

**Arms.** Six primary arms: Ghostnote FIELDS and JSON, C3 FIELDS, C4 group-local
FIELDS, adapted Producer Pal bar|beat and MIDI JSON. C4 keeps note rows inside
their groups. Three diagnostics run only on source tasks: C3 JSON, C4 JSON and
C4 detached FIELDS; the detached control is excluded where there are no groups.
Source tasks exclude the current-document and Producer Pal arms because no
matched annotation adapter is supplied, as in E358. Exclusions are listed
per cell in the manifest and never count as success.

| Per repeat | Count |
|---|---|
| Scheduled cells | 84 |
| Eligible primary | 56 (performed 8 × 6, source 4 × 2) |
| Eligible diagnostic | 11 (source 4 × 3, less one detached exclusion) |
| Explicit exclusions | 17 |

With **three repeats**, each cohort has **201 initial attempts** (168 primary,
33 diagnostic), 51 retained exclusions, and at most two corrections each:
**603 maximum submissions**. Two cohorts give 402 initial attempts and at most
1,206 submissions per full development pass. The protocol's 216 figure assumed
every arm eligible on all 12 instances; it is not this budget. The rehearsal
used 15 submissions for 11 initial attempts; expected use is a projection, not
a limit. Development passes may cover a subset of cells; each plan records its
selection.

**Package v5 counts ([D63](decisions/d63-r01-package-v5-group-timing-tasks.md)).**
Package `pilot-development-v5` adds four synthetic source tasks for the C3/C4
question, each on C3 and C4 FIELDS (primary) and the three diagnostics:

| ID | Family | Required result |
|---|---|---|
| `p13-read-derived-window` | Read | IDs of every note with performed onset in [X, Y), onset order, ties by ID; three timed groups, a timing-free group and loose notes |
| `p14-group-existing-notes` | Group arithmetic | Five loose notes become one stated timed group; spreads chosen so every onset is unchanged |
| `p15-move-member-between-groups` | Group arithmetic | One note moves between timed groups at a stated spread and stays in a timing-free group |
| `p16-retime-two-groups` | Group arithmetic | One group's anchor moves later and another's spreads double; untimed and loose notes stay |

| Per repeat | Draft 2 / v4 | v5 |
|---|---|---|
| Scheduled cells | 84 | 120 |
| Eligible primary | 56 | 64 (adds source 4 × 2) |
| Eligible diagnostic | 11 | 23 (adds source 4 × 3) |
| Explicit exclusions | 17 | 33 (adds 4 per new task) |

With three repeats, v5 has **261 initial attempts** (192 primary, 69
diagnostic) and at most **783 submissions** per cohort; two cohorts give 522
and 1,566.

**Source-task exclusion.** No annotation adapter or sidecar is supplied, and
the formats are not modified to carry annotations. Every report lists these
exclusions explicitly and limits source-task conclusions to C3 versus C4; they
say nothing about current Ghostnote claims or Producer Pal.

## Information parity

Within each instance, every eligible arm receives byte-identical shared
instructions, task scope, request and response contract, plus its own card and
native input carrying the same facts; build-time fact hashes enforce this (E358).
Performed tasks score the common onset-floor/duration-nearest realization at
1/512 after one normalization. Source tasks score exact rational spellings, IDs,
array orders, context and opaque fields. No arm receives inferred labels or
intent that another eligible arm lacks.

## Reserved sources and extraction rules

Lineage eligibility uses [retained metadata](../../context/evidence/data/r01-candidates/corpus-manifest.json)
only and follows the [corpus contract](CORPUS.md#reserved-works-and-contamination-boundary).

- **Eligible works:** the 11 reserved MIDI work families. Psychomania Splices
  has no MIDI asset and is ineligible. Before selection, refresh the inventory
  and rerun the split validator for shared signal IDs, source asset IDs and
  content hashes; a new or changed registration requires a lineage review, and
  missing provenance makes a work ineligible rather than independent.
- **Work selection:** sort eligible shard IDs, then apply the planner's SHA-256
  rejection-sampling shuffle with seed `r01-pilot-selection-v1`. Works A, B and C
  are the first three; later works are ordered replacements.
- **Asset pool:** assets under `transcript-muscriptor-large/` with a General MIDI
  program below 128 from the path prefix. Every eligible work has at least one
  (1–8). Shuffle asset IDs within the work with the same seed and work ID.
  The Producer Pal adapter runs with drum mode off, so drum assets are excluded.
- **Stage use:** development takes works A, B and C from the order below; they
  then remain development material. The rigorous stage takes the next unused
  works in the same order.
- **Window:** 16 encoded quarters, every onset in the half-open interval,
  complete durations retained, at most 128 notes. Development input v1 started
  at the asset's first onset; v2 ([E367](../../context/evidence/experiments/e367-r01-pilot-inputs-v2-dense-windows-velocities.md))
  takes each work's densest admissible window across all its pool assets,
  starting at a note onset, with ties to the earlier asset and start.
- **Velocities:** transcriptions carry placeholder velocity 64. From v2,
  real-source inputs carry seeded synthetic dynamics (`r01-pilot-velocity-v1`),
  which are not recovered performance dynamics.
- **Refusals:** unpaired or unclosed note events, zero-duration notes, more than
  128 or fewer than 16 notes, a same-pitch normalized-onset collision, invalid
  or conflicting timing metadata, or a content-hash mismatch. Collisions at
  1/512 are expected to be rare; refusing them keeps every arm eligible. The
  16-note minimum is new relative to the corpus contract and may be tuned in
  development.
- **Next window:** the first onset at or after the refused start plus 16 quarters,
  at most eight windows per asset; then the next asset; then the next work.
  Every refusal is recorded.
- **Timing provenance:** record mapped or baked timing at extraction and report
  the two separately. Do not infer musical intent from a transcription.
- **Synthetic family:** seed `r01-pilot-synthetic-v1` for the development
  stage (the rigorous stage uses a new seed), disjoint from earlier
  development fixtures, generating `p02`–`p04`, `p07`, `p10` and `p12` with
  known declared intent and independently specified expected results.

## Execution, scoring and stop rules

- **Pins per run:** stage label, CLI version and binary SHA-256, each cohort's
  admitted context policy or Codex control version, any retained transport fault-suite
  result for that binary, model settings, the Producer Pal pin and precision
  patch, tokenizer `js-tiktoken@1.0.21/o200k_base`, card and source hashes,
  and the manifest version. Development runs record changed versions instead
  of freezing them; the rigorous stage freezes them. A CLI or binary change
  requires a new context-policy check before any further attempt; retry fault
  evidence is optional reporting (D58).
- **Order:** the planner's seeded shuffle with seed `r01-pilot-order-v1`:
  randomized instance/repeat blocks, then randomized arms within each block.
  The materialized order is written before the first submission.
- **Retries and self-correction:** D58 reports retries and recovered errors;
  normal in-turn self-correction is successful if the final answer passes.
  HTTP counts may be unknown and reported usage may omit interrupted work.
- **Attempts:** fresh process and scratch directory per submission, no tool use,
  120 seconds each, no wrapper retry or fallback. Corrections are fresh
  single-turn submissions carrying the original prompt, every previous answer
  and identical-form feedback: the scorer's reason code plus the native
  validation message (at most 400 characters). Expected values, differences
  and golden responses are never disclosed. Correction context is counted.
- **Admission before scoring:** each submission must pass the control audit
  (model selection under the cohort's policy, captured requests with matching
  settings and context, no tool use, valid usage and successful completion)
  before its answer is scored. Codex declarations may remain as fixed client
  context under D56; Claude retains its empty-tool policy.
- **Scoring:** independent oracles; report first-attempt and within-budget
  success, parse/validation failures separately from semantic mismatches,
  required versus gratuitous refusals, and the multiset differences. Producer
  Pal's tolerant parser means semantic success does not certify strict syntax.
- **Accounting:** final provider usage with cache and thinking categories,
  local whole-context tokens, client-added context bytes, correction context,
  elapsed time and outcome for every submission, including failures.
- **Stop rules:** a control or transport failure halts the run; quota evidence
  pauses it without changing the billing route. On resume, the interrupted
  attempt is resubmitted as a new submission labeled `resumed-after-quota`;
  the paused submission stays recorded as a quota outcome and consumes no
  correction. A harness, oracle or source defect halts the run, invalidates
  affected cells and requires a versioned correction and rerun of all
  affected paired conditions. No significance-based early stopping and no
  post hoc deletion of tasks, arms or failures. In the development stage,
  earlier results remain recorded under their versions.

## Materialization

Development materialization is recorded in
[E366](../../context/evidence/experiments/e366-r01-pilot-development-inputs.md). It covers the
selected works and assets, window bounds (no refusal occurred), synthetic
instance values and edit targets. Payload, oracle and prompt hashes are in the
[pilot package](../../context/evidence/data/r01-pilot-inputs/package/manifest.json).
Input v2 (E367) supersedes these windows, targets and velocities, and its
package is `pilot-development-v2`. Its
[execution manifest](../../context/evidence/data/r01-pilot-inputs/v2/execution/manifest.json)
pins the materialized order and the task-specific offline rehearsal
([E368](../../context/evidence/experiments/e368-r01-pilot-execution-manifest-and-rehearsal.md)).
Package `pilot-development-v3` keeps these inputs and revises prompt wording
after E370 ([D60](decisions/d60-r01-package-v3-prompts-and-stall-resubmission.md)). Its
[execution manifest](../../context/evidence/data/r01-pilot-inputs/v3/execution/manifest.json)
also pins the one-resubmission stall policy. Package `pilot-development-v4`
([D61](decisions/d61-r01-package-v4-harder-tasks.md)) keeps the
same inputs and cells but replaces p01, p06, p07, p08 and p09 with harder
tasks, so the instance descriptions in the tasks table above describe v3 for
those five. Package `pilot-development-v5`
([D63](decisions/d63-r01-package-v5-group-timing-tasks.md)) is v4
plus `p13`–`p16`; its
[execution manifest](../../context/evidence/data/r01-pilot-inputs/v5/execution/manifest.json)
is current. The
deterministic edit-target and synthetic-generator rules are fixed before
materialization; development may revise them with a version change. After
extraction, pin the values in an execution manifest that carries its stage
label, and rehearse the new tasks offline (goldens accepted, deliberate wrong
answers and gratuitous refusals rejected) before the first submission. The
rigorous stage repeats this with fresh inputs after its freeze.

<a id="freeze-review-v5"></a>

## Freeze-review list after package v5 (for operator decision)

Drafted 2026-10-27 after [E374](../../context/evidence/experiments/e374-r01-package-v5-group-timing-one-repeat.md)
and [E375](../../context/evidence/experiments/e375-r01-package-v5-three-repeat-development-pass.md).

**Answered and frozen 2026-10-28.** The operator accepted every item as
proposed (4a earlier as D64) and confirmed the freeze: items 1–7 are
[R01-D1](decisions/r01-d1-rigorous-freeze-versions.md) to
[R01-D7](decisions/r01-d7-rigorous-reporting.md). For item 2 the order seed
stays `r01-pilot-order-v1`; for item 3 the next window is the next-densest
admissible candidate; for item 6 a halted pass may restart its unfinished
cohorts once, in the pinned order. The rigorous path is implemented offline
(the brief's [rigorous resume](../../context/work/r01-format-comparison.md#resume-rigorous-stage));
works 4–6 were then extracted (E378). The list below is
retained as proposed.

**1. Versions to freeze.**

| Item | Proposed value | Source |
|---|---|---|
| Task set | Package v5's 16 task templates (`p01`–`p16`), task revision 5, rules schema `r01-pilot-task-rules-v4`, regenerated on fresh inputs | D61, D63 |
| Prompts and cards | Prompt revision 2; instruction and card revision 2 (bar\|beat card with d/t suffixes) | D60 |
| Scoring | `r01-scoring-v2-functional-rationals` | D59 |
| Feedback | `r01-feedback-v2-locating`, at most two corrections | D59 |
| Claude context | `r01-claude-context-policy-v2` (SHA-256 `9fb87193…`), Claude Code 2.1.302 binary `5262ce9d…` | E364 |
| Codex context | `r01-codex-context-policy-v3` (`access_programs` optional; `reasoning.effort` equals the profile's), Codex 0.163.0 | E363, D62, E376 |
| Retries | Reporting only (`r01-retries-reported-v1`) | D58 |
| Cohorts and effort | `claude-haiku-5-5` at `low`; `gpt-6-luna` at **`medium`** (decided, D64); no per-format effort | E365, D57, D64 |
| Tooling | Producer Pal pin `52a4c219…` with the precision patch, `js-tiktoken@1.0.21`, Node v24.11.1 | adapter contract |

A binary or CLI change before the rigorous run requires a new context-policy
check, as in development.

**2. Fresh inputs.** The rigorous stage takes the next unused works in the
seeded order: work 4 *trailing*, work 5 *the gapra whitewood* and work 6
*open spaces* (titles from retained metadata; no note content opened). Proposed
window rule: input v2's densest admissible window per work (E367), with the
existing refusal and next-window rules. Proposed seeds:
`r01-pilot-synthetic-v2` for synthetic tasks and `r01-pilot-velocity-v2` for
synthetic velocities. The order seed may stay `r01-pilot-order-v1` (it reveals
nothing about content) or move to `r01-pilot-order-v2`.

**3. Target-rule failure on fresh windows.** The real-source rules (p01
boundary time, p06 pitch, p08 range, p09 near miss) throw when a window has no
eligible case, and no fallback is defined. Proposal: treat that as a window
refusal and advance with the existing next-window rule, then record it.

**4. Task coverage.** Decide whether to keep `p13` and `p14`. Luna failed both
in every format and every repeat (0/30), so they do not separate the formats
for Luna. Haiku passed 25/30, so they still measure that cohort. At medium
effort ([E376](../../context/evidence/experiments/e376-r01-luna-medium-effort-floor-tasks.md)),
Luna passed p14 8/15 but p13 only 1/15, without a C3/C4 difference; Luna's
cohort effort stays `low` unless changed here. Proposal: keep both tasks, and
report them as floor tasks for Luna (at `medium`, p13 stays near the floor).

**4a. Luna effort — answered 2026-10-28: `medium`
([D64](decisions/d64-r01-luna-cohort-effort-medium.md)).** At medium on all 87 cells
([E377](../../context/evidence/experiments/e377-r01-luna-medium-effort-remaining-tasks.md)),
Luna rose from 119 to 145 of 261 first-attempt (Haiku `low`: 252). Cells failing
every repeat fell from 42 to 29, and median output rose 1.3×. p10 refusals fell
(9 to 4 of 18), and the C3/C4 FIELDS gap on source tasks narrowed (C3 6 to 10,
C4 15 to 16 of 24). Haiku stays at `low`. The development package keeps Luna at
`low`; the profile changes at the freeze.

**5. Repeats and counts.** Three repeats: 261 initial attempts and at most
783 submissions per cohort (522 and 1,566 for both). E375 used 802
submissions and took about 1 hour 40 minutes.

**6. Stop rules.** As in development: a control failure halts; a stall gets
one identical resubmission and a second consecutive stall halts; a quota
pause resumes with a labeled resubmission. In development, a halted cohort
was restarted as a new cohort-only output with its own seeded order (E373).
Decide whether the rigorous stage allows that restart, and whether a restart
must use the full plan's order for that cohort.

**7. Reporting.** Proposal: the primary source-task result is C3 FIELDS
versus C4 FIELDS per cohort, reported per task with JSON and detached
diagnostics alongside; performed tasks compare the six primary arms within
each cohort. Report source-task exclusions, the generated-token gap (E375:
5.0× by median), stalls and client-reported usage. Development showed that
C4 leads on onset-changing edits and C3 on reading a single derived onset
(E375); the rigorous report should keep that split rather than pool the
source tasks.

<a id="freeze-review-list"></a>

## Review answers

Operator answers of 2026-10-26 to the draft-1 freeze-review list:

1. **Model roster:** Haiku 5.5 and GPT-6 Luna. Both admissions are pending in
   a separate session; historical Haiku 4.5 is not a pilot cohort.
2. **Task coverage:** the twelve instances and three repeats are accepted to
   start.
3. **Source tasks:** no annotation adapter, sidecar or format modification.
   Keep the C3/C4-only source cohort and report its exclusions clearly.
4. **Window rules:** refuse windows with a normalization collision.
5. **Feedback detail:** reason code plus native validation message.
6. **Quota pause:** resume with the interrupted attempt as a new labeled
   submission.
7. **Edit-target rules and synthetic generator:** accepted as drafted, under
   the development-stage posture rather than a strict pre-registration.
8. **Thinking budget:** exceeding the budget is known, expected Haiku
   behavior; report observed counts without a separate check.

Both cohorts are now admitted (E363, E364). Haiku effort is calibrated in
E365. The [pilot runner](../../brain/benchmarks/r01-candidates/cli-pilot-runner.mjs)
implements this draft's order, subsets, stage labels and quota-resume rule.
The development inputs and `p01`–`p12` package exist (E366). Remaining before
the first development run: the pinned execution manifest and the extended
offline rehearsal ([materialization](#materialization)).
The operator decides when the rigorous stage starts.
