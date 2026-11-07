# R01 — Offline format comparison

## Scope

The initial comparison covered Ghostnote FIELDS/JSON and Producer Pal bar|beat,
MIDI JSON, Stark, and transforms. Stark is excluded from further candidate
development by the operator; its earlier results remain historical evidence.
Start from the [original brief](../plan/overlap/wave-4/workflow-sequence.md#r01--producer-pal-notation-comparison)
and [expanded brief](../plan/overlap/wave-4/work-sessions.md#r01--formats-claims-and-public-naming).
The current format remains the product default while research stays open to
retaining, adapting, or replacing parts of it. No adoption is presumed.

The operator requested this work in a separate worktree, with **no live Bitwig
or controller-extension checks**. Source inspection, external documentation,
pure codec tests, fake-host tests, and local measurements are in scope. Any
required live evidence belongs to a later session. No deployment, connection,
controller replacement, running-client restart, or saved-project change is
part of this research.

### R01 protocol decisions

R01's research-protocol decisions D55–D64 and R01-D1 onward are kept with the R01 specification
in [`spec/r01-research/decisions/`](../../spec/r01-research/decisions/), not in
the project's [decision index](../decisions/INDEX.md). They govern only this
research, not general Ghostnote development. They were first written to
`context/decisions/`, which is the path recorded in retained source snapshots
and manifests. They keep their IDs because retained, hashed artifacts cite them
(for example, the package manifests cite D59, D61 and D63).

| ID | Decision |
|---|---|
| [D55](../../spec/r01-research/decisions/d55-r01-luna-model-selection-evidence.md) | Luna model selection rests on the captured pinned request, without server attestation |
| [D56](../../spec/r01-research/decisions/d56-r01-codex-reject-tool-use.md) | Codex: unused tool declarations are admitted context; any tool use fails |
| [D57](../../spec/r01-research/decisions/d57-r01-natural-token-use.md) | No hard output ceilings; effort is calibrated instead |
| [D58](../../spec/r01-research/decisions/d58-r01-retries-are-reporting.md) | Retries and recovered errors are reported, not admission gates |
| [D59](../../spec/r01-research/decisions/d59-r01-functional-equivalence-and-locating-feedback.md) | Functionally equivalent answers pass; feedback locates errors without expected values |
| [D60](../../spec/r01-research/decisions/d60-r01-package-v3-prompts-and-stall-resubmission.md) | Package v3 prompts; one identical resubmission after a stall |
| [D61](../../spec/r01-research/decisions/d61-r01-package-v4-harder-tasks.md) | Package v4: five harder tasks |
| [D62](../../spec/r01-research/decisions/d62-r01-codex-access-programs-optional.md) | Codex policy v2: `access_programs` may be absent |
| [D63](../../spec/r01-research/decisions/d63-r01-package-v5-group-timing-tasks.md) | Package v5: group-timing tasks p13–p16 |
| [D64](../../spec/r01-research/decisions/d64-r01-luna-cohort-effort-medium.md) | Luna runs at `medium` in the rigorous stage |
| [R01-D1](../../spec/r01-research/decisions/r01-d1-rigorous-freeze-versions.md) | Rigorous freeze: package v5 tasks, prompts, cards, scoring, feedback, policies, effort and tooling |
| [R01-D2](../../spec/r01-research/decisions/r01-d2-rigorous-fresh-inputs-and-seeds.md) | Rigorous inputs: works 4–6 as roles A–C, densest windows, seeds `synthetic-v2`/`velocity-v2`, order seed unchanged |
| [R01-D3](../../spec/r01-research/decisions/r01-d3-target-rule-window-refusal.md) | A target rule without an eligible case refuses the window; the next-densest candidate, then the next work, follows |
| [R01-D4](../../spec/r01-research/decisions/r01-d4-floor-tasks-kept.md) | Keep p13 and p14; report p13 as a Luna near-floor task |
| [R01-D5](../../spec/r01-research/decisions/r01-d5-rigorous-repeats.md) | Three repeats: 261 initial and at most 783 submissions per cohort |
| [R01-D6](../../spec/r01-research/decisions/r01-d6-rigorous-stop-and-restart.md) | Development stop rules; a halted pass restarts its unfinished cohorts once, in the pinned order |
| [R01-D7](../../spec/r01-research/decisions/r01-d7-rigorous-reporting.md) | Report C3 vs C4 FIELDS per task and cohort; six primary arms on performed tasks |
| [R01-D8](../../spec/r01-research/decisions/r01-d8-round-2-version-reset-and-work-reuse.md) | Round 2 is a version reset; it develops on works 4–6, and its rigorous round restarts at works 1–3 |
| [R01-D9](../../spec/r01-research/decisions/r01-d9-round-2-terra-cohort.md) | Round 2 assesses `gpt-5.6-terra` at `low` |
| [R01-D10](../../spec/r01-research/decisions/r01-d10-round-2-haiku45-cohort.md) | Haiku 4.5 is a round-2 development cohort (thinking 1,024, no output cap) |
| [R01-D11](../../spec/r01-research/decisions/r01-d11-round-2-ladders-and-repeats.md) | Round-2 ladders as proposed; calibration one repeat, full runs three |
| [R01-D12](../../spec/r01-research/decisions/r01-d12-round-2-output-scaled-timeout.md) | Round-2 timeout scales with expected output |
| [R01-D13](../../spec/r01-research/decisions/r01-d13-round-2-admission-and-offline-design.md) | Round-2 implementation details: Codex context policy v4 and Terra admission, window rule, ladders, timeout formula and measures |
| [R01-D14](../../spec/r01-research/decisions/r01-d14-round-2-two-cohorts-harder-ladder.md) | Round 2 continues with Haiku 5.5 `low` and Luna `high` on a harder shared ladder (package v2) |
| [R01-D15](../../spec/r01-research/decisions/r01-d15-round-2-trimmed-development-pass.md) | Trimmed round-2 development pass |
| [R01-D16](../../spec/r01-research/decisions/r01-d16-round-2-codex-websocket-framing-and-reaudited-continuation.md) | Codex context policy v5; continuing a re-audited control halt |
| [R01-D17](../../spec/r01-research/decisions/r01-d17-round-2-continuation-after-sleep-stall-halt.md) | Continuing after a sleep-caused stall halt; operator manages power |
| [R01-D18](../../spec/r01-research/decisions/r01-d18-round-2-discordant-levels-fresh-instances.md) | Analysis model, per-cohort discordant levels and fresh instances over repeats (package v3; accepted, run as E387) |
| [R01-D19](../../spec/r01-research/decisions/r01-d19-round-2-format-dependent-families-before-step-6.md) | Round 2's step 6 becomes format-dependent task families on the current cohorts; tool loop and stronger cohorts deferred |
| [R01-D20](../../spec/r01-research/decisions/r01-d20-round-2-format-dependent-family-designs-and-calibration.md) | Format-dependent family designs, calibration ladders and v4 packages (run as E388, E389) |
| [R01-D21](../../spec/r01-research/decisions/r01-d21-round-2-haiku-recalibration-and-shared-development-ladder.md) | Haiku recalibration and one shared development ladder for both models (run as E390, E391) |
| [R01-D22](../../spec/r01-research/decisions/r01-d22-capability-grid-focus.md) | R01 focus: a capability grid of state (A1–A3) and interaction (B1–B3), with the desirable features mapped onto it |

Record further R01 protocol decisions, including the freeze-review answers,
in that directory and this table; do not add them to the project decision
index. Only R01's outcome (format adoption, claims or public naming) belongs
in the project decision index. Number new R01 decisions R01-D1, R01-D2, and
so on, so they cannot collide with project D numbers.

## Focus: capability grid (R01-D22, 2026-10-31)

R01 now organises its questions on two axes
([R01-D22](../../spec/r01-research/decisions/r01-d22-capability-grid-focus.md)).

- **State, by authority:**
  - *A1 performed core* (pitch, onset, duration, velocity).
  - *A2 authoritative host state* (channel, expression, mute, chance and
    similar; loss makes a write unsafe).
  - *A3 annotative context* (groups, timing intent, nominal timing,
    provenance, interpretation state, annotations, overlays; loss
    degrades, and the context can go stale or be recomputed).
- **Interaction:**
  - *B1 restatement* (each turn returns everything).
  - *B2 addressed editing* (sparse operations aimed by ID or selector).
  - *B3 sustained editing* (addressed edits across turns, with lineage,
    stale-base safety and preservation of unseen state).

The operator's desirable features map onto axis B:
- local addressability is B2;
- state continuity and edit lineage are B3.

Their reassessment ([below](#reassessment-of-the-earlier-rationale)) carries
over unchanged:
- addressability is useful but not Ghostnote-only;
- continuity is partly outside the notation;
- lineage is conditional, and no three-way merge exists.

An overlay is A3 content whose attachment depends on B3 identity.

**Evidence by cell.**

| Cells | Evidence |
|---|---|
| A1/B1 | All performed comparisons. FIELDS arms hold up against MIDI JSON; only C4 over MIDI JSON for Luna on 512-note range edits is significant (E386); bar\|beat is weakest |
| A2/B1 | Preserve-exact and large-edit rich fields |
| A3/B1 | C3 against C4 FIELDS only. C4 is better for Luna's edits (reads lean C3) and for Haiku's derived reads and regrouping, and cheaper for Haiku |
| A1–A2/B2 | Phase 8's single-turn ID patches, with preservation and stale checks supplied by the compiler (E115, E137, E121) |
| B3 (all) and A3/B2 | Unmeasured for every format |

### Real usage and holistic reassessment (2026-10-31)

Steps 1–2 below are done in
[E392](../evidence/experiments/e392-r01-real-usage-by-capability-cell.md):
11 product sessions (9 Codex, 2 Claude Code), 564 Ghostnote calls.
- **Where use falls:** 17 of 20 note-write interactions were A1/B1 scripted
  generation. Three were single-turn A1/B2 patches whose natural form was a
  range, selector or transform. B3 never occurred: the operator curated in
  Bitwig between turns, and each turn started from fresh reads.
- **Live format:** every applied write verified exact; two same-turn refusals,
  neither caused by the notation. Agents used FIELDS as a script target through
  `documentPath`, rarely as text. A3 appeared only as unrequested per-note
  overlays (about 95% of written bytes), which no turn used and which never
  survived a save, move, copy or hand edit.
- **Largest costs are outside the notation:** empty-slot probing by full
  reads, re-reading verified writes, hand-copied reads, overlay guidance and
  missing structural operations (slice, duplicate-and-patch, range and selector
  transforms).

**Reassessment of R01 (E353–E391 under E392).**
- *What stands:* C4 and baseline FIELDS hold up against MIDI JSON for A1/B1,
  bar|beat is weakest, and on inline A3 group structure C4 beats C3 FIELDS
  for Luna's onset-changing edits and for Haiku's derived reads and
  regrouping, while Luna's reads lean C3 (E375–E391). These are sound
  development results, summarised in
  [FINDINGS.md](../../spec/r01-research/FINDINGS.md).
- *What real use says:* that inline A3 condition did not occur. Real cost and
  risk sit in tool design, guidance and host identity, which R01's notation
  comparison cannot move. A rigorous round or a stronger cohort would sharpen
  an answer whose product consequence is small today.
- *B2/B3:* B3 is not the priority. It needs identity and A3 that survive save,
  move and copy first; that is persistence and host work, not notation. B2
  demand is for range, selector and transform operations, a tool-surface
  question rather than an ID-patch format question.
- *Outcome:* no evidence supports changing the live format; C4's advantage
  applies only if inline group authoring becomes common. Overlay claims should
  become opt-in. Naming has no new input.

**Proposed next steps (operator decision; R01-D23 records it).**
1. *Recommended:* conclude R01's format comparison at the development stage.
   Record standing conclusions, keep the live format, do not run round 2's
   rigorous round or a stronger cohort, and leave C4 as a documented candidate
   for inline group authoring.
2. Open a product item for E392's tool-design costs: clip occupancy in the
   track listing, descriptions that treat a verified write result as
   sufficient and prefer `documentOutputPath`, overlay guidance limited to
   requests, and slice, duplicate-and-patch and range or selector operations.
3. Check the unexplained mid-turn ID re-mint (E392) in a focused live probe,
   because it would break even same-session B2.
4. Revisit B2/B3 evaluation after a revision-heavy real session or once
   identity persistence exists.

Alternatives: freeze round 2 for the rigorous round as planned (its
format-dependent families still separate formats for Luna), or pivot R01's
remaining effort to an offline evaluation of selector and range operations.

### Round 3: real-use follow-ups (R01-D23, 2026-10-31)

The operator paused the format comparison at the development stage, kept R01
open and opened round 3
([R01-D23](../../spec/r01-research/decisions/r01-d23-pause-format-comparison-and-open-round-3.md)).
The comparison's results are packaged in
[FINDINGS.md](../../spec/r01-research/FINDINGS.md).
[E393](../evidence/experiments/e393-r01-round3-real-use-followups.md) records
the three offline investigations.
- **ID re-mint:** a Ghostnote design limit, not an agent or Bitwig mistake;
  confirmed live.
  More than 24 slot fill/empty events after a read exceed the extension's
  event window, so the brain fails closed (`delta-incomplete`) and re-mints
  IDs, while the result shows only `identity-changed`.
- **Timing overlays:** reference guidance placed per-note `nominal` and
  `groove` claims on every note whenever timing was to be made or *kept*.
  Declared overlays did represent requested feel; inferred ones only restated
  the notes. Nothing read either kind, and the operator's timing questions
  were answered against source MIDI. Clip-level intent and provenance were the
  information that mattered.
- **Tool costs:** nine ranked proposals; the cheapest three are description
  changes (trust verified writes, read to file, route overlay guidance only on
  request).

**Next.** The operator accepted a session order (2026-11-07):
[B18](b18-content-event-window.md) fixes the event window, then
[B19](b19-real-use-tooling-and-annotations.md) runs quick tool wins,
then overlays, clip annotations and provenance (R01's format evaluation
resumes there, possibly with a final benchmark), then clip operations and
analysis tools. R01 stays open until B19 session 2 settles the format and
claims questions.

### Former next-session checklist (done in E392 and above)

1. **Real-world usage by cell.** Investigate every local Codex session that
   used Ghostnote so far. Sessions are under `~/.codex/sessions/` (with
   `~/.codex/archived_sessions/` and `~/.codex/session_index.jsonl`); find
   them by their Ghostnote MCP tool calls. Classify each Ghostnote
   interaction into grid cells. Consider:
   - which state the turn touched (A1–A3);
   - whether it restated, addressed, or continued earlier edits over turns
     (B1–B3);
   - which authoring conveniences were wanted.

   Count sessions, turns and tool calls per cell. Keep transcripts local:
   record counts and short paraphrased examples, not private content.
2. **Live format performance in those cells.** Assess how the current live
   document format (Ghostnote document 1.0 with compact-bar FIELDS) performed
   there: successes, failures, refusals, repairs, wasted restatement,
   preservation or identity problems, payload sizes and tool-call counts.
   Separate format causes from host, tool-design and model causes.
3. **Holistic reassessment.** With that data, reassess R01 as a whole:
   - its findings so far (E353–E391);
   - the open round-2 step 4 (freeze for the rigorous round, or a stronger
     model);
   - whether B2/B3 evaluation (multi-turn or patch-based, the tool loop
     R01-D19 deferred) is now the priority;
   - what R01's outcome needs: adoption, claims and naming.

   Record the result as an E record and the decision as R01-D23 or later,
   then propose next steps to the operator.

## Current checkpoint: candidate package ready

The operator approved continuing the proposed package and suggested Ghostworks
shard transcriptions as realistic corpus material: “With that, no, no other
notes - proceed.” The [research package](../../spec/r01-research/README.md) now
contains explicit contracts, executable bounded prototypes for all four ideas,
matched examples, a common comparison oracle, selective/timing-rich baseline
controls, and a [staged trial protocol](../../spec/r01-research/TRIAL-PROTOCOL.md).

[E354](../evidence/experiments/e354-r01-candidate-prototypes-and-shard-corpus.md)
records the results. Four hash-verified Ghostworks excerpts supply 128 irregular
notes from three works; synthetic cases add known intent, expressive state and
boundary stress. Eleven whole MIDI work families remain reserved. All 44
supported format/fixture cells pass; four cells explicitly exclude state absent
from PP text. All 35 new tests and 286 existing document/binding tests pass.
The PP adaptation includes a reparse guard: the 55,296-input immediate-neighbor
sweep accepts 53,248 cases and explicitly refuses 2,048 bar|beat cases rather
than silently changing normalized cells. This is bounded research coverage.

The operator subsequently approved trying subscription CLI trials, with close
attention to experimental controls. [E355](../evidence/experiments/e355-r01-subscription-cli-smoke.md)
records one successful unscored synthetic edit through each CLI. Authentication,
final usage and output capture work; the record identifies token/cache semantics,
built-in client context and Codex served-model verification as control issues.
The exact approval and scope are retained there. No held-out source was opened.

The operator then approved trying [group-local FIELDS](../../spec/r01-research/NESTED-FIELDS.md)
for C4 after identifying the loss of colocation in separate group/note tables.
[E356](../evidence/experiments/e356-r01-nested-fields-prototype.md) retains the reply,
implemented grammar and limits, 12 exact-state fixture checks, 59 passing focused
tests and two successful unscored subscription development edits. Nested rows
use 31.98% fewer local payload tokens than equivalent C4 JSON on the eight
development fixtures. The JSON encoding stays a reference; the nested surface
is the forward model-facing candidate. This does not establish a task advantage.

The [C3 FIELDS surface](../../spec/r01-research/COMPACT-FIELDS.md) is now implemented
and verified in [E357](../evidence/experiments/e357-r01-compact-fields-prototype.md).
It keeps performed notes explicit, with adjacent nominal fields and retained
shared group context. No new model call or reserved-source read was needed.

[E358](../evidence/experiments/e358-r01-matched-development-pairs.md) now records
11 matched cards, 14 paired development tasks, explicit eligibility, a bounded
encoding/layout control and offline scoring rehearsal. All 76 eligible pairs
preserve their input facts and pass their golden outputs; 23 exclusions remain
visible. No model call or reserved-source read occurred.

[E359](../evidence/experiments/e359-r01-cli-controls-and-model-selection.md)
adds pinned CLI invocations, captured-request audits, a seeded order rehearsal
and bounded explicit repair accounting (148 focused tests pass). The
[model inventory](../../spec/r01-research/MODEL-HISTORY.md) identifies exact
historical settings. Codex rejects the historical GPT-5.4 mini snapshot;
Luna is a newer small-model comparison. Its correct synthetic edit still fails
control admission: tools/instructions remain injected, served-model evidence
is missing, and transport retries are unverified.
[E360](../evidence/experiments/e360-r01-historical-haiku-cli-capture.md) verifies
historical Haiku 4.5 with the exact fixed thinking budget and output cap through
a correct subscription edit. All 152 focused tests pass. The operator monitors
usage and reports no added credits; disabled-credit confirmation is no longer
a prerequisite. Claude client-context policy and transport retry evidence remain
open. The [control guide](../../spec/r01-research/CLI-CONTROLS.md)
retains exact settings and remaining gates. No scored trial ran.

[E361](../evidence/experiments/e361-r01-claude-controls-and-paired-rehearsal.md)
completes the Claude controls. A versioned context policy admits only the
captured client blocks, fields and betas, with six named volatile fields and
exact task bytes. A local fault suite on the pinned binary shows one HTTP
attempt and one captured request per submission under the trial settings;
positive controls detect a permitted retry. The paired runner then completed
the 11-attempt historical-Haiku development slice: all 15 submissions passed
admission, 9 attempts passed first time, and the C3 FIELDS and C3 JSON group
edits exhausted both corrections. This is development evidence only. Codex
controls were not advanced. 168 focused tests pass.

The operator answered draft 1's review list, which produced
[pilot draft 2](../../spec/r01-research/PILOT-DRAFT.md). It defines Haiku 5.5
and Luna cohorts, twelve instances, three repeats, 201 initial attempts and
603 maximum submissions per cohort, and a labeled development stage before a
frozen rigorous stage. Luna is admitted
([E363](../evidence/experiments/e363-r01-codex-luna-admission.md)), and Haiku 5.5
is admitted under context policy v2
([E364](../evidence/experiments/e364-r01-haiku55-admission.md)). Haiku's effort
is calibrated to `low`
([E365](../evidence/experiments/e365-r01-haiku-effort-calibration.md)).

Next: development runs; see [resume: development runs](#resume-development-runs).
Under the development stage, works A–C may be opened and reused before any
freeze. The rigorous stage takes the next unused works. No candidate has been
selected and no scored model comparison has run. API-funded runs,
adoption/migration, annotation persistence, storage ownership and live host
checks remain deferred. Prototype performance and payload sizes do not
establish agent benefit. The earlier checkpoint below retains the direction
that governed this package.

### Immediate next steps

- [x] **C3 FIELDS surface:** implemented note-centered rows with adjacent
  optional musical fields, retaining JSON as the semantic reference and C4's
  distinct group-local presentation. Exact round trips, edits, refusals and
  matched payload costs are verified on the development corpus in
  [E357](../evidence/experiments/e357-r01-compact-fields-prototype.md).
- [x] **Matched cards and paired development tasks:** the
  [development package](../../spec/r01-research/DEVELOPMENT-PAIRS.md) covers
  comprehension, authoring, individual/group edits, preservation and refusals.
  Eleven cards and 76 eligible pairs pass offline fact/golden checks (E358).
  C3/C4 JSON and detached C4 FIELDS remain separately marked diagnostics;
  C4 JSON changes both encoding and layout, while detached FIELDS retains
  identical local row bodies and counts added references.
- [x] **Claude control admission:** context policy v1 and the local transport
  fault suite admit historical Haiku for development under the pinned binary
  (E361). A CLI or binary change requires a new policy check and suite run.
- [x] **Paired development runner and rehearsal:** the runner audits each
  capture before scoring, retains every attempt and submits corrections only
  through the explicit repair state. The 11-attempt slice completed with 15
  admitted submissions (E361).
- [x] **Prepare freeze review:** the draft-1 pilot listed the proposed cohort,
  coverage, counts, rules, seeds and freeze-review decisions; no reserved
  passage was opened.
- [x] **Review answers and stage posture:** the operator answered the review
  list on 2026-10-26 ([pilot draft 2](../../spec/r01-research/PILOT-DRAFT.md#review-answers)).
  The draft's [trial stages](../../spec/r01-research/PILOT-DRAFT.md#trial-stages) record a
  labeled development stage (reused inputs, tunable formats and design)
  before a frozen rigorous stage on fresh inputs. Cohorts: Haiku 5.5 and Luna.
- [x] **Codex control admission:** [E363](../evidence/experiments/e363-r01-codex-luna-admission.md)
  closes the remaining context-policy implementation and verifies a fresh
  correct Luna edit through the normal runner. D55 accepts pinned request-model
  evidence, D56 rejects tool use, D57 removes hard output ceilings and D58
  moves retries into reporting. Normal in-turn self-correction is successful.
- [x] **Haiku 5.5 admission:** [E364](../evidence/experiments/e364-r01-haiku55-admission.md)
  adds context policy v2 for the client's system-role turn layout and admits
  one control probe and six first-attempt passes on one development task
  through the normal runner.
- [x] **Haiku effort calibration:** [E365](../evidence/experiments/e365-r01-haiku-effort-calibration.md)
  chooses `low`, Haiku's lowest effort. Its median generated tokens remain
  6.1× Luna `low` on 38 matched cells, entirely from reasoning.
- [x] **Development runs:** the
  [pilot runner](../../brain/benchmarks/r01-candidates/cli-pilot-runner.mjs) with
  pilot plans and quota resume is done. The inputs are built: works A–C, the
  synthetic seed and the `p01`–`p12` package
  ([E366](../evidence/experiments/e366-r01-pilot-development-inputs.md)); input
  version 2 uses dense windows, distinct targets and synthetic velocities
  ([E367](../evidence/experiments/e367-r01-pilot-inputs-v2-dense-windows-velocities.md)).
  The execution manifest is pinned and the task-specific offline rehearsal
  passes ([E368](../evidence/experiments/e368-r01-pilot-execution-manifest-and-rehearsal.md)). Two one-repeat runs are done ([E369](../evidence/experiments/e369-r01-first-development-run-one-repeat.md), [E370](../evidence/experiments/e370-r01-second-development-run-and-response-analysis.md)). D59 retuned scoring and feedback, and D60 fixed the prompts (package v3) and added the stall policy. The one-repeat check of v3 is done ([E371](../evidence/experiments/e371-r01-package-v3-one-repeat-check.md)); Haiku reached 67/67, so D61 made five tasks harder in package v4, and its one-repeat check is done ([E372](../evidence/experiments/e372-r01-package-v4-harder-tasks-one-repeat.md)). The three-repeat pass of v4 is done ([E373](../evidence/experiments/e373-r01-package-v4-three-repeat-development-pass.md)). [D62](../../spec/r01-research/decisions/d62-r01-codex-access-programs-optional.md) relaxes the Codex policy for `access_programs`. Package v5 ([D63](../../spec/r01-research/decisions/d63-r01-package-v5-group-timing-tasks.md)) adds four group-timing tasks; its one-repeat check ([E374](../evidence/experiments/e374-r01-package-v5-group-timing-one-repeat.md)) and three-repeat pass ([E375](../evidence/experiments/e375-r01-package-v5-three-repeat-development-pass.md)) are done. See [resume: development runs](#resume-development-runs).
- [ ] **Freeze review:** the [freeze-review list](../../spec/r01-research/PILOT-DRAFT.md#freeze-review-v5) is drafted and awaits the operator's answers.
- [ ] **Later — rigorous stage:** by operator decision, freeze all versions,
  extract fresh works and a new synthetic seed, pin materialized inputs and
  prompts, and run under the full protocol.

### Resume: rigorous stage

This is the current entry point. On 2026-10-28 the operator answered the
[freeze-review list](../../spec/r01-research/PILOT-DRAFT.md#freeze-review-v5)
as proposed (R01-D1 to R01-D7, with D64) and confirmed the freeze.

**Implemented offline (staged).** The rigorous path runs beside the
development one; development package v5 and its manifest are unchanged and
still start.

- *Profiles.* `codex-current` is `medium` (D64). Plans take profiles by stage
  (`profilesFor` in `cli-controls.mjs`): development-stage plans keep Luna at
  `low`, so v2–v5 manifests and E369–E377 still regenerate. The
  `codex-current-medium` probe remains development-only.
- *Tasks.* `pilotTasks(windows, { revision, seeds })` takes the synthetic and
  velocity seeds; `RIGOROUS_SEEDS` are `r01-pilot-synthetic-v2` and
  `r01-pilot-velocity-v2`. `targetRuleFailure(role, notes)` runs a role's
  target rules (A p08; B p05, p09; C p01, p06) and names the first that
  finds no case.
- *Inputs.* `selectRigorousWindows` (rules `r01-pilot-selection-rules-v3`)
  skips the development works, ranks every admissible window of a work's pool
  assets by note count, asset order and start, and accepts the first that has
  no collision and passes the role's target rules (R01-D3). Without a target
  refusal it equals input v2's rule (tested). The CLI's fifth argument
  `rigorous` writes `r01-pilot-windows-rigorous-v1`.
- *Package.* `buildRigorousPackage` builds `pilot-rigorous-v1`: v5's task
  revision 5, prompt revision 2 and cards on the rigorous windows, with the
  rigorous seeds stated beside the unchanged rules schema v4.
- *Execution manifest.* `buildExecutionManifest` follows the package stage;
  a rigorous manifest records the freeze decisions and Luna at `medium`.
- *Runner.* The stage comes from the package. A rigorous start needs a pinned
  manifest and is a full pass, or `--restart-of HALTED_OUTPUT --cohorts …` for
  the halted pass's unfinished cohorts (R01-D6). Each restarted cohort must
  match the pinned configuration and order; a restart cannot be restarted.
- *Check.* Nine new tests in `pilot-rigorous.test.mjs`; 246 focused tests
  pass. An end-to-end build on the development windows relabeled `rigorous`
  (no new work opened) shows that the new seeds rehearse cleanly: 87 goldens
  pass, all 568 wrong answers and 81 gratuitous refusals are rejected, and no
  variant is non-distinguishing.

**Materialized — [E378](../evidence/experiments/e378-r01-rigorous-inputs-and-execution-manifest.md).**
With the operator's go-ahead, steps 1–3 below ran. Works 4–6 fill roles A–C
(126, 128 and 62 notes); one R01-D3 refusal moved *trailing* from its 128-note
window to a 126-note one. Package `pilot-rigorous-v1` and its
[execution manifest](../evidence/data/r01-pilot-inputs/rigorous/execution/manifest.json)
are pinned; the rehearsal accepts every golden and rejects all 568 wrong
answers. The operator approved the run (step 4), and it is
[E379](../evidence/experiments/e379-r01-rigorous-three-repeat-run.md):
522/522 runs, no control failure or halt, and two recovered stalls. Haiku
passed 247/261 first-attempt and Luna 138/261. Source tasks repeat the
development split: C4 FIELDS leads on onset-changing edits and C3 on reading
one derived onset (Luna C3 8 versus C4 15 of 24). bar|beat is the hardest
performed arm. Haiku's ceiling and Luna's floor limit what E379 says about
capable agents, so the operator approved a second development round with
difficulty-scaled tasks: the operator answered the
[round 2 brief](r01-round-2-difficulty-scaling.md)'s decisions (R01-D8–R01-D12).
Steps 2 and 3 are complete:
[E380](../evidence/experiments/e380-r01-round2-catalog-and-admission-probes.md)
admits both Terra models and uncapped Haiku 4.5, and
[E381](../evidence/experiments/e381-r01-round2-offline-implementation.md)
builds package `round2-development-v1` and its rehearsal (R01-D13). **Next is
the calibration pass, after the operator's go-ahead.** R01's outcome (format adoption, claims and naming)
waits for round 2. Works 7–11 remain unopened. The steps as run, from `brain/`:

1. Refresh the inventory and run `node --import tsx
   benchmarks/r01-candidates/pilot-inputs.mjs RAW_INVENTORY LIBRARY_ROOT
   ../context/evidence/data/r01-pilot-inputs/rigorous/windows.json
   ../context/evidence/data/r01-pilot-inputs/inventory.json rigorous`
   (as in E366/E367; the lineage check must pass, and the reduced inventory
   must match). Record every refusal.
2. `pilot-package.mjs PINNED_PP TOOLING
   ../context/evidence/data/r01-pilot-inputs/rigorous/package rigorous`.
3. `pilot-execution.mjs PINNED_PP pilot-rigorous-v1
   ../context/evidence/data/r01-pilot-inputs/rigorous/execution`; the
   rehearsal must accept every golden and reject every wrong answer.
4. After the operator's go: run `node --import tsx
   benchmarks/r01-candidates/cli-pilot-runner.mjs start
   /tmp/ghostnote-r01-producer-pal /tmp/ghostnote-r01-tooling
   pilot-rigorous-v1 ../.tmp/NEW_OUTPUT` in the background (both cohorts,
   three repeats, about 2 hours or more with Luna at `medium`). Check the CLI
   versions first. If it halts, apply R01-D6 (`--restart-of`). Copy the
   outputs to `context/evidence/data/r01-pilot-runs/`, analyse them under
   R01-D7 and record an E record.

### Resume: development runs

**Complete; superseded by [resume: rigorous stage](#resume-rigorous-stage).**
The text below is retained as the development record. Pilot draft 2's
[materialization](../../spec/r01-research/PILOT-DRAFT.md#materialization),
[source rules](../../spec/r01-research/PILOT-DRAFT.md#reserved-sources-and-extraction-rules),
[execution rules](../../spec/r01-research/PILOT-DRAFT.md#execution-scoring-and-stop-rules)
and [tasks table](../../spec/r01-research/PILOT-DRAFT.md#tasks-arms-and-coverage)
define what to build. The
[trial protocol](../../spec/r01-research/TRIAL-PROTOCOL.md) governs the method.

**Scope.** Use subscription CLI calls within the operator's standing scope
([retained reply](../evidence/data/r01-cli-claude-controls/operator-context.json));
do not ask for limit confirmation again. Do not use API billing, Bitwig or the
controller. Reserved works A–C may be selected, extracted and reused as
development material. Do not open later works in the seeded order; they belong
to the rigorous stage. The operator decides when to freeze.

**Order.**

1. **Runner (offline) — done.** The
   [pilot runner](../../brain/benchmarks/r01-candidates/cli-pilot-runner.mjs)
   plans both cohorts with order seed `r01-pilot-order-v1`, three repeats and
   at most two corrections; a test reproduces draft 2's 201 initial and 603
   maximum submissions per cohort on a pilot-shaped manifest. Recorded subsets
   (`--cohorts`, `--tasks`, `--repeats`) are marked `subset`. Plans carry a
   stage label outside the configuration hash, which must match the package
   (`r01-pilot-package-v1` carries its own; the E358 package is development
   only). `runSequence` now keeps a quota submission as a `quota` outcome
   outside the repair state; `resume` continues it with a byte-identical
   `resumed-after-quota` submission, including mid-correction, and carries
   finished runs forward. Halted runs refuse to resume. Results are written
   after every run with per-cohort counts; `resume --after-interruption`
   restarts an interrupted run and lists its unscored attempt directories.
   Resume refuses a changed package, plan or CLI binary. Packages load as
   `development` or a directory, with artifact and prompt hashes checked.
   Usage: `node --import tsx benchmarks/r01-candidates/cli-pilot-runner.mjs
   start PINNED_PP TOOLING PACKAGE NEW_OUTPUT [options]` or `resume PINNED_PP
   TOOLING OUTPUT`. Development runs E369 and E370 used it. D60 adds one
   identical resubmission after a timeout without an answer.
2. **Inputs — done ([E366](../evidence/experiments/e366-r01-pilot-development-inputs.md)).**
   The refreshed inventory matches the retained manifest and the lineage checks
   pass. Works A–C are Re:turning (piano, 38 notes, baked), Our Taproot (bass,
   24, mapped) and Good Lies (bass, 24, mapped); each first window was accepted.
   The package (`pilot-development` in the runner, under
   [r01-pilot-inputs](../evidence/data/r01-pilot-inputs/)) matches draft 2:
   67 eligible cells and 17 exclusions. Its offline rehearsal accepts every
   golden and rejects every wrong answer and gratuitous refusal. **Input v2
   ([E367](../evidence/experiments/e367-r01-pilot-inputs-v2-dense-windows-velocities.md))
   is current:** each work's densest admissible window across its pool assets
   (piano 103, guitar 72 and bass 115 notes), distinct targets for instances
   that share a window, and seeded synthetic velocities over the transcriber's
   placeholder 64. Its prompts are 1.6× larger than v1's. Package
   `pilot-development-v4` (D61, below) keeps these inputs and is current.
3. **Pin and rehearse offline — done ([E368](../evidence/experiments/e368-r01-pilot-execution-manifest-and-rehearsal.md)).**
   The [execution manifest](../evidence/data/r01-pilot-inputs/v2/execution/manifest.json)
   is labeled `development` and pins the package, per-cell payload, prompt,
   card and oracle hashes, the plan hash and both cohorts' materialized order
   (201 runs each). `start` on `pilot-development-v2` refuses a mismatch; a
   recorded subset is checked run by run. The rehearsal accepts all 67 goldens
   and rejects all 389 task-specific wrong answers (5–7 per task) and 61
   gratuitous refusals. Three variants are equal to the oracle in these inputs
   and two cannot be encoded by the baseline arms; both kinds are listed, not
   counted. Regenerate with `pilot-execution.mjs PINNED_PP pilot-development-v2 NEW_DIR`.
   Any package, task, profile or seed change requires a new manifest. The
   current manifest is v4's (step 4). Package builds: `pilot-package.mjs
   PINNED_PP TOOLING NEW_DIR [VERSION]`.
4. **Run and tune (in progress).** History: the first recorded subset (one repeat, both
   cohorts) is [E369](../evidence/experiments/e369-r01-first-development-run-one-repeat.md): Haiku 58/67 first-attempt and 65/67 within budget,
   Luna 39/67 and 42/67, with no control failure. [D59](../../spec/r01-research/decisions/d59-r01-functional-equivalence-and-locating-feedback.md) then made functionally
   equivalent answers pass (rationals by value) and made correction feedback
   locate errors without giving expected values. Offline re-scoring raises Haiku
   to 60/67 and 66/67. The runner now uses the re-pinned
   [execution manifest](../evidence/data/r01-pilot-inputs/v2/execution-2/manifest.json),
   which carries the scoring and feedback versions; its rehearsal still rejects
   all 389 wrong answers and accepts 61 respelled oracles. The second
   one-repeat run and the first response analysis are [E370](../evidence/experiments/e370-r01-second-development-run-and-response-analysis.md). Haiku passed
   62/67 on the first attempt and 67/67 within budget. Luna halted twice on
   120-second transport stalls, which the current stop rule turns into
   run-ending halts. The analysis found four prompt defects: p06's "at 8" also
   matches index 8; the source `TASK SCOPE` is copied into answers; p02/p12
   spelling wording; and an unexplained bar|beat `d` suffix. Luna corrections
   pass 4/89. [D60](../../spec/r01-research/decisions/d60-r01-package-v3-prompts-and-stall-resubmission.md) then fixed the prompts
   in package `pilot-development-v3` (same inputs and oracles; 1,290 fewer prompt
   tokens per repeat). It also added one identical resubmission after a
   timeout without an answer. The
   [v3 execution manifest](../evidence/data/r01-pilot-inputs/v3/execution/manifest.json)
   pins it; the rehearsal still accepts all 67 goldens and rejects all 389
   wrong answers. Packages v1 and v2 are retired for new starts. The one-repeat
   check of v3 is [E371](../evidence/experiments/e371-r01-package-v3-one-repeat-check.md):
   it completed without a halt; Haiku passed 67/67 on the first attempt, and
   Luna passed 38/67 and 45/67. The four defects are gone and no new prompt or
   scorer defect was found. No submission stalled, so the stall policy was not
   exercised live. Because Haiku was at the ceiling,
   [D61](../../spec/r01-research/decisions/d61-r01-package-v4-harder-tasks.md) replaced p01, p06,
   p07, p08 and p09 with harder tasks in package `pilot-development-v4` (same
   inputs and cells) and gave p09 and p10 a shared conditional-refusal response
   line. Its [execution manifest](../evidence/data/r01-pilot-inputs/v4/execution/manifest.json)
   pins it; the rehearsal rejects all 418 wrong answers. The one-repeat check
   is [E372](../evidence/experiments/e372-r01-package-v4-harder-tasks-one-repeat.md):
   Haiku passed 64/67 on the first attempt (67/67 within budget) and Luna 35/67
   (44/67). The first live stall was resubmitted and the run continued. No
   defect was found. The three-repeat pass is
   [E373](../evidence/experiments/e373-r01-package-v4-three-repeat-development-pass.md):
   Haiku 192/201 first-attempt (200/201 within budget), Luna 103/201
   (125/201). The full run halted once on a Codex request without the
   `access_programs` field (1 of 1,024 captured Luna requests); Luna was
   restarted as a cohort-only run and completed. Three stalls were all
   recovered by resubmission. Producer Pal bar|beat is the hardest arm for both
   cohorts, and C4 FIELDS outscored C3 FIELDS on source tasks. Package
   `pilot-development-v5` ([D63](../../spec/r01-research/decisions/d63-r01-package-v5-group-timing-tasks.md))
   adds four group-timing source tasks, p13–p16; its
   [execution manifest](../evidence/data/r01-pilot-inputs/v5/execution/manifest.json)
   is current. The one-repeat check is
   [E374](../evidence/experiments/e374-r01-package-v5-group-timing-one-repeat.md)
   (no defect; no v6) and the three-repeat pass is
   [E375](../evidence/experiments/e375-r01-package-v5-three-repeat-development-pass.md).
   Packages v1–v4 are retired for new starts. Version every
   change to formats, cards, wording or the harness. Record results in new E
   records.

**Decisions after E373.** The operator relaxed the Codex `access_programs`
check ([D62](../../spec/r01-research/decisions/d62-r01-codex-access-programs-optional.md)). The
operator also approved one more focused development session before the freeze.
It adds a few targeted group-timing tasks, drafted below as package v5.

**Status after E375: development runs are complete; the operator decides the
freeze.** Package v5 was built as drafted below
([D63](../../spec/r01-research/decisions/d63-r01-package-v5-group-timing-tasks.md)); the actual
count is 33 exclusions per repeat, not 17. The one-repeat check
([E374](../evidence/experiments/e374-r01-package-v5-group-timing-one-repeat.md))
found no defect. Haiku was at 95% and Luna at 25% on the new tasks; v6 was not
built, because Luna's failures are the targeted operations and easing them
would put Haiku at the ceiling. The three-repeat pass
([E375](../evidence/experiments/e375-r01-package-v5-three-repeat-development-pass.md))
completed without a halt: Haiku 252/261 and Luna 119/261 first-attempt. On the
eight source tasks, C3 versus C4 FIELDS was 23 versus 24 of 24 for Haiku and 6
versus 15 for Luna. C4 leads on onset-changing edits (Luna 12/12 versus 0/12);
C3 leads on reading one derived onset (p02, 3/3 versus 0/3). The
[freeze-review list](../../spec/r01-research/PILOT-DRAFT.md#freeze-review-v5)
awaits the operator's answers. A follow-up probe
([E376](../evidence/experiments/e376-r01-luna-medium-effort-floor-tasks.md))
ran Luna at medium effort on p13 and p14: p14 8/15 and p13 1/15 first-attempt
(0/15 each at low), with no C3/C4 difference. It added the development-only
profile `codex-current-medium` and Codex context policy v3, which checks
`reasoning.effort` against the profile.
[E377](../evidence/experiments/e377-r01-luna-medium-effort-remaining-tasks.md)
ran the other 14 tasks at medium: over all 87 cells Luna rose from 119 to 145
of 261 first-attempt. p10 refusals fell (9 → 4 of 18), and the C3/C4 FIELDS gap
narrowed (C3 6 → 10, C4 15 → 16 of 24). The operator answered freeze item 4a:
Luna runs at `medium` in the rigorous stage
([D64](../../spec/r01-research/decisions/d64-r01-luna-cohort-effort-medium.md)); the other items
remain open. Do not freeze, open works 4–6 or start the
rigorous stage without them.

**Package v5 session (done; retained as drafted).**

*Why.* R01's core open question is C3 (explicit onsets with shared group
context) versus C4 (group-local rows with derived onsets). E373 has only 12
runs per arm per cohort on that question (Haiku 12 vs 11, Luna 9 vs 6 of 12,
favouring C4). The performed-task arms are at Haiku's ceiling, and further
across-the-board hardening would push Luna to the floor (27 of its 67 cells
fail every repeat). Luna repeats agree on 55 of 67 cells, so new distinct
instances add more information than more repeats. Difficulty must come from
operations whose cost depends on the format, not from musical judgement
(Phase 8: creative tasks mainly measured model skill).

*Scope.* Package v5 = v4 unchanged plus four synthetic source-cohort tasks,
`p13`–`p16`. Each is eligible on C3 FIELDS and C4 FIELDS (primary) and C3 JSON,
C4 JSON and C4 detached FIELDS (diagnostics), with groups present. That adds
20 cells per repeat: 87 eligible cells, 17 exclusions and 261 runs per cohort
over three repeats. Use the synthetic seed `r01-pilot-synthetic-v1` with new
draw domains, task revision 5 and prompt revision 2. Cards and scoring are
unchanged. Calibration target on the new tasks: Haiku about 80–90% and Luna
about 40–60% on the first attempt. Tune at most once, with a version bump, if a
one-repeat check falls far outside that band.

| Task (draft ID) | Operation | What the formats must do | Planned wrong answers (well-formed) |
|---|---|---|---|
| `p13-read-derived-window` | Read. Three timed groups (4–5 members each), a timing-free group and 2–3 loose notes. Return `{"ids": [...]}`: every note whose performed onset is in [X, Y), in ascending onset order, ties by ID. X and Y are chosen so that some derived onsets fall just inside and just outside the range. | C3 lists every onset; C4 requires anchor + delay + spread for each grouped note. This is the plainest read-side test of the C3/C4 trade-off. | omits the delay; uses spread only; inclusive upper bound; skips loose notes; skips the timing-free group's members; ID order instead of onset order |
| `p14-group-existing-notes` | Edit. Five loose notes with explicit onsets become one new timed group with stated id, label, provenance, anchor (whole quarter at or below the first onset) and delay. The answer must choose spreads so that **every onset is unchanged**. | C3 keeps `at` and adds context, groups cells and spreads. C4 must move the rows into a GROUP block and convert `at` to `spread`. Requires subtraction at mixed denominators. | onsets moved to anchor + spread (delay dropped); spreads measured from the anchor, not anchor + delay; group without timing; performanceOrder missing; one note left loose |
| `p15-move-member-between-groups` | Edit. Move one note from timed group A to timed group B at a stated spread, appended to B's members and performanceOrder. It also leaves a timing-free group that contains it. Its onset follows B's equation; every other note is unchanged. | Membership and one timing owner across two groups. C3 updates CONTEXT, the groups cell and the explicit onset. C4 moves the row and REFs between blocks. | onset unchanged; still listed in A; inserted at the front of B; removed from the timing-free group; B's anchor used without its delay |
| `p16-retime-two-groups` | Edit, two steps. Move group A's anchor later by a stated amount and double group B's spreads. A timing-free group spans members of both; a loose note sits between them. | Several derived onsets change in two groups at once. The protected members and the loose note must not move. In C3, every changed onset must be recomputed. | only A changed; only B changed; B's spreads halved; the loose note moved; A's delay also moved; the timing-free group dropped |

Optional fifth if the four come out too easy: larger authoring with a
six-member timed group plus a timing-free group that shares two members, all
stated in prose (extends p04).

*Steps.*

1. Read NOW, this section, [D61](../../spec/r01-research/decisions/d61-r01-package-v4-harder-tasks.md),
   [E373](../evidence/experiments/e373-r01-package-v4-three-repeat-development-pass.md)
   and the v4 code path: `pilot-tasks.mjs` (`syntheticTasks`,
   `wideSpreadGroup`), `pilot-execution.mjs` (`WRONG`), `pilot-package.mjs`,
   `cli-pilot-runner.mjs` (`PACKAGES`) and their tests. v4 is the template.
2. Implement the generators (task revision 5 = revision 4 plus p13–p16;
   earlier tasks byte-identical), the wrong-answer sets and package version 5.
   Register `pilot-development-v5` and retire v4. Add tests: v4 cells and
   prompts are unchanged; the new tasks have consistent group equations, one
   timing owner, boundary cases present in p13, unchanged onsets in p14, and
   the stated moves in p15/p16. Record the task design as D63.
3. Build the package and the v5 execution manifest. The rehearsal must accept
   every golden, reject every wrong answer by semantic mismatch (not a parse
   error), accept unreduced respellings and list anything not distinguishing.
   Update PILOT-DRAFT.md's counts.
4. Run one repeat of v5 (both cohorts, about 40 minutes), classify it and
   read the failing answers on p13–p16. If the new tasks fall well outside the
   calibration band, or a wording or scorer defect appears, revise once as v6
   and recheck. Record the result as an E record.
5. Run three repeats (about 2.5 hours; 261 runs per cohort). If a cohort
   halts, keep the completed cohort and restart the halted one with
   `--cohorts`. Record an E record that reports C3 vs C4 on all eight source
   tasks with per-task detail, the bar|beat finding and the token gap.
6. Draft the freeze-review list for the operator: versions to freeze
   (package, cards, scoring, feedback, policies, effort), fresh works from the
   seeded order, a new synthetic seed, repeats and stop rules. Do not freeze
   or open new works without the operator's decision.

Run recipe: from `brain/`, check `claude --version` (2.1.302) and
`codex --version` (0.163.0) and run the focused tests. Then run
`node --import tsx benchmarks/r01-candidates/cli-pilot-runner.mjs start
/tmp/ghostnote-r01-producer-pal /tmp/ghostnote-r01-tooling PACKAGE
../.tmp/NEW_OUTPUT [--repeats 1]` in the background, with stdout and stderr in
sibling files. Copy `plan.json`, `results.json`, `sessions/` and the stderr log
(as `progress.txt`) to `context/evidence/data/r01-pilot-runs/`. Classify with
`pilot-analysis.mjs PINNED_PP RUN_DIR` and read the failing answers.

**Carry forward.**

- Report Haiku input from `totalInputTokens`. Haiku 5.5 reports nearly all
  input as cache writes, and `input_tokens` is about 2 (E364).
- A Claude Code or Codex version or binary change requires a new
  context-policy check before further calls. The Codex policy is v3 (D62 plus the E376 effort check). Policy v2 is specific to Claude
  Code 2.1.302 and Haiku 5.5.
- Report the Haiku/Luna generated-token gap with results (E365: 6.1× median
  at Haiku `low`). Do not tune effort per format. D64 sets Luna to `medium`
  for the rigorous stage (gap about 3.6×); change the `codex-current` profile
  together with the rigorous execution manifest, not before.
- Luna stalled in about 2 of 142 submissions in E370, none of 120 in E371,
  1 of 125 in E372 and 3 of 517 in E373; every resubmission recovered. Report
  stalls and resubmissions.
- A halted run cannot resume. If one cohort completed, keep it and restart the
  halted cohort as a new output with `--cohorts` (E373). The restart is a
  subset with its own seeded order. A second consecutive stall on one attempt still halts, and a
  halted run cannot resume: restart it as a new output with `--cohorts`.
- Results scored before D59 (E369) are not directly comparable;
  `pilot-analysis.mjs` re-scores with the current scorer.

**Bootstrap.** Last verified with Node v24.11.1, Codex 0.163.0 and Claude Code
2.1.302 (SHA-256 `5262ce9d…6662d37`). Tooling is at
`/tmp/ghostnote-r01-producer-pal` (Producer Pal pin `52a4c219…`) and
`/tmp/ghostnote-r01-tooling` (`js-tiktoken@1.0.21`). Temporary paths may
disappear; rebuild them from the [adapter contract](../../spec/r01-research/PRODUCER-PAL.md)
and the [lockfile](../evidence/data/r01-format-comparison/package-lock.json).
From `brain/`, run:
`R01_UPSTREAM=… R01_TOOLING=… node --import tsx --test benchmarks/r01-candidates/*.test.mjs`
(237 tests after E376). The worktree holds staged, uncommitted R01 work; preserve
it, stage only task changes, and do not commit.

### Resume up to the freeze

**Historical; superseded by [resume: development runs](#resume-development-runs).**
This handoff was completed in E361. Codex and Haiku 5.5 admission followed in
E363 and E364. Its instructions to keep reserved passages unopened and its
test counts predate the development-stage posture. The text below is retained
as written.

This section was the continuation entry point after E360. The operator clarified
that the handoff should reach **up to**, not through, the freeze. Preparatory
implementation, bounded subscription control probes and the small development
rehearsal are in scope. Stop with a concrete, reviewable draft and a list of
remaining decisions; do not declare the pilot frozen. Do not open or parse
reserved note passages, run held-out trials, use API billing or contact Bitwig.
Do not request subscription-limit confirmation again: the operator will monitor
usage, and their exact reply is retained in
[E360's context record](../evidence/data/r01-cli-claude-controls/operator-context.json).

**Read and bootstrap.** Start with this checklist, the
[CLI control guide](../../spec/r01-research/CLI-CONTROLS.md),
[development package](../../spec/r01-research/DEVELOPMENT-PAIRS.md), and
[trial protocol](../../spec/r01-research/TRIAL-PROTOCOL.md). E358 supplies paired
prompts/oracles; E359 supplies the offline order/repair machinery; E360 supplies
the verified Haiku capture. Their evidence records are historical and should
not be rewritten. The worktree currently holds staged, uncommitted R01 work;
preserve it and stage only subsequent task changes, without committing.

Last verified environment: Node v24.11.1, Codex 0.163.0, Claude Code 2.1.302.
The existing development tooling is at `/tmp/ghostnote-r01-producer-pal` and
`/tmp/ghostnote-r01-tooling`; temporary paths may disappear. Verify the Producer
Pal pin/precision patch and tokenizer version from the
[adapter contract](../../spec/r01-research/PRODUCER-PAL.md) and retained
[tooling lockfile](../evidence/data/r01-format-comparison/package-lock.json),
and reconstruct missing tooling from those pins, not latest versions.
Use `R01_UPSTREAM` and `R01_TOOLING` overrides if paths change. Run the seven
focused tests listed in [E358](../evidence/experiments/e358-r01-matched-development-pairs.md#artifacts-and-reproduction)
plus `cli-controls.test.mjs`, `cli-control-audit.test.mjs` and
`cli-trial-plan.test.mjs` from `brain/`; the current total is 152 tests. CLI
version drift requires new control validation rather than reusing admission.

**First implementation work.** Haiku's profile is
`claude-haiku-4-5-20251001`, fixed thinking budget 1,024 and output ceiling
12,000, with no adaptive effort or temperature override. Establish a versioned
allowlist for the captured system/reminder blocks, explicit permitted volatile
fields, and an audit that rejects unexpected instructions or tools while
counting all delivered context. Preserve model/task bytes; do not normalize
away meaningful context to make hashes agree. Validate retry/fallback controls
at the transport boundary using local fault tests or captured client evidence
where possible; repeated successful inferences do not prove absence of retries.

The current `auditControl` deliberately emits
`claude-client-context-policy-pending` and
`transport-retry-control-unverified`. Implement evidence-backed checks and
regression tests before removing those gates; do not bypass them to obtain a
passing verdict. Codex additionally lacks served-model evidence and contains
nested tool declarations/global instructions. Do not change the operator's
global configuration to solve isolation. If a control cannot be established,
record the specific blocker and continue independent draft preparation rather
than claiming a clean trial or broadening spending/scope.

**Runner seams and the first paired rehearsal.** The current
[probe driver](../../brain/benchmarks/r01-candidates/cli-control-probe.mjs) submits
only its hard-coded two-note task. It is not a paired executor.
`buildTrialPlan`, `createRepairState` and `recordAttempt` in
[the planner](../../brain/benchmarks/r01-candidates/cli-trial-plan.mjs) are offline
helpers; `auditProbe` checks the fixed smoke answer. Build the paired runner
using `invocation`/capture auditing and
[`scoreResponse`](../../brain/benchmarks/r01-candidates/development-surfaces.mjs).
Deliver only each E358 pair's `prompt`; private oracles and gold responses must
remain inaccessible to the model. Audit controls before scoring, retain every
raw attempt, and separate transport/control failures from task failures.

Use historical Haiku first, after its gates pass, with one repetition of:

- `edit-velocity-guitar`: six eligible primary arms.
- `halve-group-spread`: C3/C4 FIELDS primary arms plus C3 JSON, C4 JSON and
  detached C4 FIELDS diagnostics; the other four primary arms remain explicitly
  excluded for this source-context task.

This is **11 initial attempts** (eight primary, three diagnostic), with at most
two explicit corrections each: **33 maximum submissions**, 120 seconds each.
Record a fixed seed and paired ordering before submission. Preserve diagnostic
labels and equal feedback/tuning opportunities. A control/transport failure
stops the sequence; quota failure pauses rather than switching billing routes.
Validate the repair path with offline fault cases even if all initial answers
pass; do not manufacture model failures or add calls merely to consume repairs.
The existing 152-slot rehearsal file covers a larger offline matrix and must
not be submitted wholesale. This small run is development evidence only.

**Ready-for-freeze deliverable.** Prepare a draft pilot specification/manifest,
explicitly marked unfrozen, containing:

- Provider admission evidence and a recommended model cohort. Haiku is the
  historical bridge; include Luna only after its independent gates pass, or
  explicitly propose deferring it. Small models test this research condition;
  they do not establish adoption for the intended capable-agent workflow.
- Task-family coverage, proposed instances/templates, information parity,
  primary/diagnostic arms and predeclared exclusions; preserve C4 colocation.
  Use the protocol's 12-task, three-repeat Stage-A proposal as a starting point,
  calculate actual eligible counts, and count repairs/diagnostics separately.
  Do not mistake the old 216-cell proposal for an approved executable budget.
- Metadata-only lineage eligibility and proposed source-selection/extraction
  rules from the [corpus contract](../../spec/r01-research/CORPUS.md#reserved-works-and-contamination-boundary):
  at least three independent reserved MIDI work families, seeded selection,
  16-quarter windows capped at 128 notes, deterministic rejection/next-window
  rules, and a separate synthetic seed family for known intent. Do not inspect
  reserved note content to fill the draft or select appealing passages.
- Cards/prompt templates, source/tool/config pins, context and usage policies,
  pairing/repetition seeds, independent oracle/scoring rules, syntax versus
  semantic reporting, feedback/repair limits and run-wide stop rules.
- A short freeze-review list: proposed model roster, final task/arm coverage,
  initial/maximum attempt counts, and any unresolved admission or design choice.
  Exact held-out payload/oracle hashes cannot exist before extraction; mark
  their later materialization step explicitly instead of fabricating pins or
  calling a template-only draft a fully frozen execution manifest.

Record new measurements once in a new E record, update this checklist and NOW,
and stage the verified task changes. The handoff is ready for freeze review
when the admitted-provider runner/rehearsal works and the draft makes all
remaining choices visible. If a gate remains blocked, report that narrower
state honestly; do not label the pilot ready just because documents exist.

## Checkpoint: candidate specifications and experiment design next

The operator retains **all ideas 1–4** for investigation. The deeper discussion
of idea 4 does not select it over the others. Current Ghostnote remains the
product default and the experimentally tested baseline. This checkpoint
records research direction, not a replacement-format decision.

| Idea | Retained direction | Next specification work |
|---|---|---|
| 1 | Current Ghostnote documents with musical commands and task-specific views | Specify the view, selectors, operation arguments, affected-field rules, and compilation to patches. This is an interaction contract, not necessarily a new document format. Compare ordinary code as well. |
| 2 | Producer Pal bar\|beat and MIDI JSON with minimal precision fixes | Specify and implement research-only exact timing output and grid-aware comparisons. Keep unmodified upstream as a diagnostic reference; do not broaden this arm into an intent-language redesign. |
| 3 | Realized notes with compact optional musical fields | Specify timing/group fields, shared metadata, editing and invalidation behavior, and whether a compact surface expands into existing claims or changes their internal representation. |
| 4 | Musical groups/events with optional precise performance refinements | Specify arbitrary labeled groups, explicit note references/times, optional structured musical properties, and a direct representation for unknown intent or irregular notes. |

**Stark is out of the forward shortlist**, including model trials. Its timing,
duration, dynamics, and overlap limits do not fit the intended workload. The
operator does not generally plan to use small models; future model selection
should reflect the intended capable-agent workflow. Historical small-model
results remain evidence with their original limits, not the optimization target.
Ideas 5 (pattern instances) and 6 (performance relationships) remain optional
later directions; neither is a required new comparison arm.

The accepted precision loss is at the 1/512-quarter-note-beat normalization
boundary. It does not authorize additional silent losses of dynamics,
durations, channels, expression, or unrelated host state. DAW round-tripping
is a desirable outcome; performed-note equivalence, musical-intent continuity,
and logical note correspondence are distinct results.

### Grouping refinement to carry forward

Explore arbitrary groups with optional conventional labels (such as chord
identity), freeform prose, and numerical properties only where useful. Notes
need not be presented chronologically if their times are explicit. Overlapping
groups should reference one note definition rather than duplicate its state.
Group membership, presentation order, and any meaningful performance order
(such as strum order) need separate definitions. Freeform descriptions provide
agent context; they do not automatically supply deterministic transform rules.
Distinguish authored intent from inferred labels and specify what happens to
each when its notes change. Do not require a full timing decomposition merely
to label a phrase or chord.

Current Ghostnote already accepts unordered events, then canonicalizes them
chronologically within each clip; group references are sorted by ID. It has
harmony/role/motif/region overlays through the existing claim machinery, not
the lightweight group surface proposed here. See the
[normalizer](../../brain/src/document/semantic.ts) and
[overlay types](../../brain/src/document/model.ts). A candidate must explicitly
decide whether to preserve authored presentation or generate task-specific
views; rearranging presentation must not change notes or targeting.

### Planned Producer Pal precision changes

The pinned bar|beat and MIDI JSON parsers already accept precise fractional
positions and durations. Source inspection identifies restricted output
fraction choices, rounded decimal output, and tolerance-based comparisons as
the first adaptation targets. For bar|beat, account for whole-note fractions
and meter-relative beat positions; for MIDI JSON, account for its meter-scaled
timing units. Reuse existing fraction syntax where possible. Prefer exact
normalized values over merely adding a fixed number of decimal places, and
audit grouping/default suppression for distinct cells treated as equal.

E353 already records a timing value changing cells after serialization and
reimport. A precision fix must preserve the final normalized event, including
duration, across all supported meters and boundary cases. It must not silently
quantize every authored tuplet before the declared realization boundary.
Record the upstream pin and adaptation diff; keep research modifications out
of the product. The research adaptation is now implemented and boundedly
verified in E354; see the [precision contract](../../spec/r01-research/PRODUCER-PAL.md)
for supported meters, field limits and explicit native-arithmetic refusals.

### Completed and still open

Completed: the initial source/codec/cost screen (E353), the historical research
review, three-perspective brainstorming, and the forward shortlist above;
then the candidate contracts, matched examples, common oracle, bounded
prototypes and draft model-trial protocol in E354. The brainstorm examples
below remain historical sketches; the research package contains executable
specifications. Still open: review/refinement, a frozen provider-ready pilot,
agent evidence and any resulting product decision.

Annotation persistence across save/rename/reopen/session boundaries, storage
ownership, product adoption/migration, and all live host checks remain
deferred. No new external model benchmark has run. A paid trial's specific
run and cost remain a separately scoped decision under D25; no approval is
needed now to prepare specifications, fixtures, or offline prototypes.

## Questions and comparison design

The operator's earlier format rationale supplies hypotheses, not requirements:

1. **Local addressability:** can a small change name only its target? Compare
   event-ID patches, pitch/time merge keys, selectors, and programmatic edits.
   Measure request size separately from the amount of host state rewritten.
2. **State continuity:** which properties survive, and how is continuity
   established? Distinguish authoritative host fields from annotations whose
   absence or staleness may be acceptable for a task.
3. **Edit lineage:** what correspondence survives a timing/pitch change?
   Examine change reports, concurrent edits, and three-way merge possibilities.
   Do not label a possible identity-based design as implemented behavior.
4. **Additional benefits:** look for composition shorthand, musical units,
   pattern reuse, selectors, transformations, readable summaries, tolerant
   input, instruction economy, and useful defaults. Their value need not
   depend on replacing the snapshot representation.

Keep four layers explicit: serialization, semantic model, edit operations,
and host binding. Durable attachment to a source document is a separate
lifecycle question. Event IDs have uses beyond annotations; annotation
support does not require choosing a persistence policy.

**Deferred by the operator:** whether annotations should survive first
save/rename, reopening, or separate sessions, and which component owns durable
storage. Assess the current limitation and possible approaches without making
any of those behaviors a format-selection gate. Ghostworks metadata needs
remain an open consumer question, not an inferred requirement.

## Evidence plan

Pin the upstream commit, documentation, parser/serializer and instruction
sources. Exercise shared fixtures plus explicit unsupported cases. Report
exact differences and refusals; avoid pooling unlike semantic models into a
single score. Count instruction and payload tokens separately with a named
local tokenizer. No paid model trials are part of this initial round.

Attribute claim work using separate parse, seal, validation, dependency
expansion, and carry/projection stages, with small cases and bounded large
cases. Existing E253/E256 are historical evidence, not current host timings.
Do not change runtime behavior or prescribe externalizing claims before
comparing its costs and lost capabilities.

## Initial offline result

[E353](../evidence/experiments/e353-producer-pal-offline-formats-and-claims.md)
records the pinned source comparison, 65 round-trip attempts, 12 executable
witnesses, local token counts, and eight claim-cost cases with three samples
each. All 286 existing codec/binding tests passed. No product behavior changed.

The first rounds support examining **authoring and editing conveniences
independently of snapshot storage**. Producer Pal has local edit requests
without persistent note IDs, compact repeated patterns, chord/drum shorthand,
and transforms over existing notes. Ghostnote retains explicit event identity,
sparse field updates, wider state coverage, and optional interpretation data.
Neither family supplies every desired property: Ghostnote rejects negative
pickups and unnormalized realized triplets; Producer Pal's serializers lose
some fine timing and do not encode the wider Ghostnote event model.

### Per-surface disposition

These record the initial screen. The checkpoint above governs the forward
shortlist; none is a product format selection.

| Surface | What is promising | Limit / next comparison |
|---|---|---|
| Current FIELDS / JSON | Explicit sparse changes, supported-property preservation, identity-based reports, exact admitted document round trips | Retain as the baseline. Test whether its envelope, timing plane, and instruction burden are justified for each task; existing complexity is not its own justification. General three-way merging is not implemented. |
| bar\|beat | Repeats, copies, pattern cycles, absolute note-value durations, and musical position spelling compress authored structures | Test as an authoring surface or source of syntax ideas. Its statefulness and meter-relative positions need agent trials. Current serializer precision cannot be used as a lossless Ghostnote snapshot codec. |
| MIDI JSON | Small instruction fragment; explicit per-note data; tolerant input; tested exact triplet and pickup cases | Test a programmatic input route against existing Ghostnote JSON. The name does not mean standard JSON output; defaults and pitch/time replacement differ from sparse field updates. Preserve its low instruction cost without assuming its entire model must be adopted. |
| Stark | Very short drum patterns, explicit rests, repeats, chord symbols | Excluded from further research by the operator: its limitations do not fit the intended expressive workload. Historical results retained. |
| Transforms | Selectors, arithmetic, pattern variation, and count-changing edits can express musical operations directly | Strong candidate for a separate edit surface, regardless of notation. Prototype compilation into an ordinary guarded Ghostnote patch, with explicit collision, timing, randomness, and affected-field behavior. Directly wrapping the upstream host writer would not establish Ghostnote preservation. |

The comparison does not require importing Producer Pal code. That checkout is
GPL-3.0-or-later; it is used as research input only. A selected implementation
would need its own dependency and packaging choice.

### Reassessment of the earlier rationale

- **Local addressability survives scrutiny as a useful dimension, not an
  exclusive Ghostnote advantage.** Both products have compact single-target
  requests. ID patches and pitch/time/selector edits offer different tradeoffs.
- **State continuity is partly outside the notation.** Producer Pal carries
  supported raw fields around the text representation for edits. Ghostnote
  models more of that state explicitly. A source field not expressible in text
  can still be preserved by a binding; a field expressible in text may still
  lack a working host setter.
- **Lineage is conditional.** Ghostnote keeps IDs through a verified authored
  move within its identity domain; it cannot recover arbitrary human moves or
  cross-session identity. Producer Pal transforms retain object correspondence
  within an operation, while its host write route strips Live note IDs. Neither
  observation establishes durable lineage. Ghostnote's stale-base refusal is
  not a three-way merge.

### Claims: cost and ownership options

| Option | Evidence / benefit | Cost or unresolved issue |
|---|---|---|
| Keep current optional claims | Existing lifecycle preserves unchanged interpretation and exposes stale dependencies; small examples are inexpensive locally | Dense per-note claims create substantial parse/validation/carry work and large payloads |
| Optimize the implementation | Pure-stage measurements put much more time in parse/validation/carry than in explicit sealing; E253 gives an earlier schema-validation profile | Must preserve rejection, dependency, and stale-state semantics. Benchmark discriminated validation, index reuse, and repeated validation separately before adopting a change |
| Use claims more selectively | The format already permits no claims. Phrase/group metadata can sometimes express a task without two envelopes per note | A group label cannot substitute for per-note nominal timing when that task requires it. Test actual authoring needs; do not just remove data to win a size comparison |
| Move analysis/annotations to an external store | Could keep routine note I/O smaller and separate analysis providers from DAW editing | Joining metadata to fresh notes still needs identity and dependency checks. Cross-session storage/ownership is unresolved; externalization alone does not make that problem disappear |

**Initial verdict:** keep optional claims available while testing selective
use and implementation costs. The measurements do not justify making all
analysis mandatory, deleting annotations, or choosing an external owner.
Author/provider provenance belongs with interpretations; host observations and
edit guards have independent authority. Ghostworks may be a consumer or storage
candidate, but its needs have not been established by this research.

The first-save finding is a binding lifecycle limitation: `Session.ready()`
treats a changed project-name field as a project change, and identity guards
retire old attachments. The current spec's statement that saving keeps the
identity domain needs this implementation qualification. Merely retaining a
document file does not re-establish attachment to live notes. Persistence
requirements, storage ownership, and a repair remain deferred; none blocks
the format comparison.

### Public naming options

| Display name | Rationale | Tradeoff |
|---|---|---|
| Ghostnote Document | Accurate for notes, clip state, patches, and annotations; already established | Less compact and musical than the alternatives |
| Ghostnote Notes | Short and easy to explain | Understates clip metadata and overlays |
| Ghostnote Score | Suggests a portable musical document | Can imply engraving or notation semantics the format does not provide |

Keep **Ghostnote Document** as the working name pending review. FIELDS and JSON
remain encoding labels. These are naming proposals, not a name-availability
check. A display/package rename can leave `ghostnote-document/1.0`, `.gndoc`,
and `.gndoc.json` unchanged; schema/extension migration is a separate decision.

## Next offline research brief

The next phase specifies candidates and a fair experiment before running model
trials. The current evidence is a deterministic capability screen, not proof
that any new surface improves agent musical work.

1. **Define the common comparison contract.** Specify normalized realized
   notes and supported fields, meter/time units, rounding, duration/end-time
   rules, collisions/overlaps, and explicit refusals. Keep source timing,
   intended nominal timing, and realized timing distinct. Define note-value
   equivalence independently of serialization, intent, and identity. Specify
   matching and ambiguity reporting for partially changed documents. Do not
   make every candidate adopt Ghostnote syntax to be scored.
2. **Specify candidates 1–4 with matched worked examples.** Each needs a
   bounded grammar/schema or tool contract, defaults and scoping, addressing,
   one-note and group-edit semantics, preservation behavior, and invalid-input
   examples. Define whether prose is context or executable semantics; separate
   presentation order from event timing. Show the same drums, bass, dense
   harmony, and irregular imported passage before and after representative
   edits. Specify retrieval/expansion of details omitted by a view. Keep the
   simplest viable variant of each idea before adding optional features.
3. **Build bounded offline prototypes.** Implement the planned bar|beat and
   MIDI JSON precision changes and the minimum adapters needed for the other
   specified candidates. A shared guarded edit backend can isolate surface
   effects. Test supported-field preservation, one-to-one identity where
   available, generated/removed-note reporting, and honest refusal on unknown
   or stale targets. Do not assume general merging. Keep intent provenance
   and stale behavior explicit without requiring today's claim envelopes.
4. **Establish deterministic capability and cost results.** Exercise every
   normalized onset cell within representative beats, durations, meter changes
   or supported fixed meters, bar boundaries, tuplets, pickups, overlaps,
   collisions, repeated pitches/channels, and long sustains. Mark unsupported
   cases explicitly; capability exclusions must not disappear from reported
   results. Test equivalent spellings and repeated parse/serialize cycles.
   Include dense irregular offsets and repeated editing, not only clean
   patterns. Measure parsing, validation, expansion, carry/projection where
   applicable, and memory separately from model token cost. For an optimization
   claiming unchanged semantics, retain the same valid/invalid corpus.
5. **Design staged agent comparisons.** First isolate representation/read
   views with comparable information and backend tools; separately isolate
   command/selector advantages while keeping state representation fixed. Then
   compare practical end-to-end candidate workflows. Use a common task corpus
   and outcome rubric rather than identical output syntax. Test added musical
   information as an explicit factor, so an improvement cannot be misattributed
   solely to notation. Avoid an unmanageably large full cross-product of every
   grammar, view, tool, and annotation variant.
6. **Freeze the trial protocol and evaluation set.** Select models/settings
   representative of the operator's intended usage, equal tuning and example
   budgets, paired tasks, repeated observations, repair limits, and stopping
   criteria. Keep development and held-out tasks separate. Predeclare success
   and permitted loss for each task, count instructions/retrieval/code/payloads/
   repairs, and report correctness, latency, unintended changes, and uncertainty
   by task family. Retain current FIELDS/JSON with appropriate selective and
   timing-rich claims as strong baselines. A smaller payload is not a win if
   it drops needed information or increases repairs. Keep objective adherence
   separate from musical preference; preference judgments can be a later
   explicitly scoped assessment without live DAW checks here.

The task matrix must cover authoring, comprehension, individual edits,
arithmetic/group transforms, supported-state preservation, edit correspondence,
and normalized readback, plus cost and error recovery. Include a small edit in
a large clip, count-changing edits, an unrelated concurrent change, ambiguous
group membership, and unknown intent. No candidate must support every feature
to participate, but its limits must remain visible rather than being pooled
away into a single score. Define adoption criteria before the trials, allowing
retaining the baseline or adopting only commands/views to be successful results.

The reviewable candidate-specification and experiment package is now available
at the current checkpoint above. No format migration, paid trial, or live host
work is part of this package. Historical results and the brainstorm below
informed it; they do not substitute for its tests or future agent evidence.

## Candidate brainstorm: expressive timing and compact musical structure

This records the earlier brainstorm, including proposals subsequently narrowed
by the checkpoint above. In particular, references to Stark or as-is-only
Producer Pal comparisons below are historical, not instructions for new work.

The operator's next priority is frequent nudging and humanization across drums,
bass, and dense or loosely strummed harmony, alongside agent authoring,
comprehension, individual-note edits, and arithmetic transforms. Loss at the
accepted 1/512-beat boundary is acceptable. Equivalent DAW readback is desirable;
recovering the original symbolic expression is a separate question. The
existing format's earlier model trials remain the baseline to beat.

Three subagents independently examined existing surfaces, evolution of
Ghostnote, and a new hybrid notation. They read the shared research but did not
consult one another. Their convergence is a design signal, not an empirical
result or independent model validation. No candidate was implemented, no
external model benchmark was run, and no live work occurred in this brainstorm.
All syntax below is illustrative, not supported syntax or a selected grammar.

### What each perspective returned

| Perspective | Leading proposals | Main reservation |
|---|---|---|
| Existing surfaces | Musical selectors/arithmetic over current documents; bar\|beat authoring followed by deterministic performance realization; generated task-specific views; Producer Pal as-is controls | A compact authoring recipe may become awkward after irregular edits or DAW import. Pinned Producer Pal serializers do not preserve every accepted timing cell. |
| Evolve Ghostnote | Integrated nominal timing and precise displacement; shared group timing with per-note residuals; patterns with instance exceptions; batched current annotations as a control | Shared structure must earn its complexity on irregular playing. Shorter syntax alone does not remove runtime claim-validation costs. |
| New hybrid | Musical events with optional performance refinements; motif instances; realized events with compact musical fields; a declarative performance graph | A DAW performance does not uniquely identify its generating structure. Defaults, dependencies, and exceptions can make effects hard to predict. |

### Candidate families

1. **Current document plus musical commands and task views.** Keep the
   current state model. Generate compact read views for the task and compile
   selectors/arithmetic into guarded patches. For example, `bass.onset +=
   3/512`, `note n42.velocity = 91`, or `chord c7.spread *= 1/2`. The last
   command needs a known chord anchor and spread definition. Compare this
   with ordinary code over the same document; a new command language must
   justify itself. Views reduce context costs, but do not by themselves
   reduce stored-claim processing.
2. **Producer Pal surfaces as-is, plus a separate adapted arm.** Try
   bar\|beat for repeated composition, MIDI JSON for explicit irregular notes,
   and Stark for tasks that accept its timing/dynamic limits. An adapted
   variant could add deterministic timing/dynamic realization to a musical
   skeleton. Count that adaptation and its instructions explicitly. As-is
   serializers are not a faithful 1/512 snapshot route: E353's
   `341/512 -> 0.666 -> 340/512` witness changes a normalized cell. An exact
   adapter is a different candidate from unmodified upstream behavior.
3. **Realized notes with compact musical fields.** Preserve exact performed
   notes as primary state, with optional nominal timing and group references
   directly alongside them. Share provenance and dependency declarations
   where appropriate. Compute deviations from actual and nominal timing for
   edits. This is the conservative semantic competitor to a symbolic-first
   design. A syntax-only version that compiles into current claims is a useful
   control; reducing runtime objects or changing invalidation is separate work.
4. **Musical events with optional precise refinements.** Express the nominal
   event once and augment it with performance displacement, duration, or
   dynamic refinements. Share a chord's nominal anchor and common delay,
   retaining each member's exact pitch, spread, duration, and dynamics. An
   event with unknown intent has a direct performed-note representation.
   This was the strongest new-format direction across the evolution and
   hybrid perspectives, and is closely related to the existing-surface
   agent's skeleton-plus-performance proposal.
5. **Patterns or motif instances with local exceptions.** Compress the
   repeated musical scaffold while permitting distinct performance for every
   occurrence. An individual edit changes an instance; a pattern edit
   explicitly changes its uses. Addresses refer to stable instance/member
   handles, not current sorted note positions. Dense exceptions must have a
   straightforward flat representation. Treat repetition as an independently
   testable feature of candidates 2–4, not a prerequisite for musical timing.
6. **Declarative performance relationships.** Express relationships such as
   bass following kick with an anticipation, or a chord with a parameterized
   strum and residual humanization. Realize one deterministic note result.
   This is the most exploratory proposal: dependency order, affected-note
   prediction, local overrides, and reconciliation are substantial problems.
   Ordinary code plus explicit notes is an essential simpler competitor.

An illustrative shared-timing representation for candidate 4 is:

```text
units: beats; performance offsets: 1/512 beat
chord c7 nominal=8 commonDelay=+3
  a C3  spread=0   duration=2    velocity=90
  b E3  spread=6   duration=7/4  velocity=84
  c G3  spread=13  duration=3/2  velocity=82
  d B3  spread=21  duration=1    velocity=78
```

The first two performed starts are `8 + 3/512` and `8 + 9/512`.
`spread *= 1/2` tightens the strum while retaining common lateness;
`b.pitch = F3` edits one member. A prototype must specify fractional-tick
rounding and whether a timing edit preserves duration or end time. For
non-grid nominal positions such as triplets, it must also specify whether
displacement is relative to ideal nominal time or its normalized cell. Keep
normalization error distinguishable from expressive timing; neither implicit
repeated rounding nor an unspecified choice is acceptable.

This structure need not force every performance into swing/strum components.
Simple offsets can suffice. Components become useful when the edit needs to
distinguish them. Arbitrary independent deviations still require per-note
information; compact structure cannot eliminate that information cost.
Declared intent and inferred interpretation must remain distinguishable.
An imported note's precise timing does not establish its intended nominal
position, chord membership, or groove decomposition.

### Preliminary evaluation of convergence

All three perspectives favor one deterministic performed result, optional
structure, and a direct representation for irregular or uninterpreted notes.
All support shared musical structure plus local refinements, though the
existing-surface perspective prefers putting that in an authoring frontend.
The evolution and hybrid perspectives independently rank integrated timing
and group structure highest. Pattern instances recur in both, with the same
warning about exception growth. The existing-surface perspective ranks
commands over current data first; this is a useful competing explanation for
the hoped-for benefits, not merely an implementation detail of a new format.

The strongest initial comparison is therefore current Ghostnote against
**compact musical fields** and **integrated musical events with performance
refinements**, while separately testing **commands/views over current data**.
Producer Pal as-is remains a serious external control. Add pattern syntax
only where examples show a useful advantage; keep relationship graphs as an
exploratory option. This is a research shortlist, not a product selection.

Historical support is bounded. [E114](../evidence/experiments/e114-bar-context-and-guarded-note-patches-pass-two-models.md)
supports compact context with exact guarded edits.
[E116](../evidence/experiments/e116-fine-timing-and-two-layer-groove-contract-pass.md)
provides small controlled evidence for explicit timing intent, not proof of
the current claim-envelope design.
[E137](../evidence/experiments/e137-compact-bar-prior-art-and-benchmark.md)
shows successful augmented notation. The later
[adjudicated comparison](../evidence/format/FORMAT_BENCHMARK_PRODUCT_REVIEW.md#matrix-8-notation-ledger-and-analysis-channels)
found substantial disagreement between independently emitted notation and
complete ledgers. It did not directly test these integrated refinements.

### Concrete comparison tasks and failure criteria

Start by writing equivalent worked examples and explicit operation semantics,
then implement bounded offline parsers/realizers only for selected candidates.
Use fixtures that include:

- Humanized drums: swing, shared delay, isolated pushes, flams, and an
  irregular fill; reduce looseness without erasing the intentional pushes.
- Syncopated bass: triplets, anticipations, varying note lengths, and timing
  relationships to drums; transpose or move one note and transfer a groove.
- Dense harmony: common lateness, strum spread, unequal lengths, local
  deviations, and repeated pitches; halve spread while preserving the other
  specified timing components and edit an inner voice independently.
- Repetition followed by exceptions: edit one occurrence, edit the template,
  insert a note, then reconcile simulated DAW edits without re-randomizing
  untouched events or forcing them back into the old pattern.
- Irregular imported music with unknown intent: preserve its performed notes
  and represent uncertainty. Do not award invented musical explanations.

Compare authoring, comprehension, individual edits, transforms, and readback
separately. Include current selective/no-claim and timing-claim baselines.
Keep information and backend capabilities equal when isolating notation;
separately test whether extra intent information helps. Hold the document
fixed when testing commands and hold the write route fixed when testing views.
Count instructions, retrieval, code, payloads, and corrections, alongside
task success, unintended changes, local CPU/memory, and implementation cost.
Use fresh held-out examples after tuning; eventual model trials need a
predeclared paired protocol and the scoped decision already described above.
Do not infer agent benefit from character counts or subagent agreement.

For note equivalence, expand both representations and apply the same explicit
normalization and supported-field rules. Compare note multisets, including
multiplicity, pitch, channel, onset, duration, and every other field covered by
the comparison. Check clip/meter/loop metadata separately when in scope.
This can establish equality across different notation. A few changed notes
require an explicit correspondence rule, with ambiguous matches reported.
Equal performed notes do not establish equal intent or durable identities;
normalization collisions and host admission limits remain explicit. Simulated
readback is sufficient for this offline comparison, but does not establish
host behavior. All actual DAW checks stay deferred.

## Deferred host follow-up

Only a selected behavior change needs new host evidence. The follow-up should
name that claim rather than rerun unrelated controller checks:

- First save/rename versus a true project switch; reopening and same-title
  projects if durable attachment is selected. Compare observed identity cues
  before designing a persistent association.
- A selected authoring/transform route: independent readback of intended notes
  and affected/unaffected fields, including timing normalization, collisions,
  expression, and loop offsets. Codec tests cannot prove the binding.
- Any claimed reduction in live claim cost: measure the relevant ledger row
  and retained call budget after the implementation is selected.

Future deployment, controller replacement, handshake, target checks, and live
writer coordination belong to that session. This worktree has established no
fresh live-state claims.
