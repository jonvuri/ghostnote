---
title: Current state
kind: status
updated: 2026-11-08
---

## Now

**Next: [B19](work/b19-real-use-tooling-and-annotations.md)** in four
sessions. Session 1 is complete and checked live (main descriptions v60, model
reference revision 6, [D70](decisions/d70-clip-writers-return-the-read-back-document-as-a-file.md));
next is session 2, slot occupancy. The sessions: quick tool wins; whole-project slot occupancy through one new
extension method; overlays, clip annotations and provenance (with a last
format evaluation, a possible final benchmark, and the choice between a
clip-level default and a column binding for uniform release velocity); clip
operations and stateless analysis tools. P01 is merged with B19 session 1;
the merged surface is descriptions v65.

[B18](work/b18-content-event-window.md) is complete and verified live in
[E405](evidence/experiments/e405-b18-content-event-window-live.md). The
content-event ring holds 8,192 events, and `revision.get` returns only the
events after the caller's `since`; a plain mark carries none. A ref's IDs stay
current through 8,192 Launcher slot events after its latest read or check.
One more re-mints fail-closed, with `why: delta-incomplete` and a warning. A
current read or check now restarts the ref's window; run 1 found that it kept
the first-read mark. Descriptions are v59 (46 tools); the normal wire is
unchanged (93 methods, `d6decf985f6b1f36`), with marker `rig.info.contentLog`.
All 2,607 brain tests and extension checks pass. A full-window delta costs
889 KB / 45–51 ms; the ledger has the reply rows.

[P01](work/p01-edit-path-performance.md) continues in parallel in the
`mossy-larch` worktree after integrating completed B18; main proceeds with B19.
The operator confirmed this split on 2026-11-07. The normal controller
replacement and focused scope-read check passed in
[E401](evidence/experiments/e401-p01-scope-read-policy-live.md): the six-device
fixture improved from 1,056 to 621 ms warm median (29 to 17 wire turns), and
three far containers remain settled across repeated reads. The eighteen-device
fixture improved from 2,484 to 1,154 ms (65 to 23 turns). Both acquisition
policies returned identical complete structures; cross-container transfer,
retargeting, scratch cleanup and preserved inventories/selection passed.
The comparison suppresses capability flags on the same LRU build; it is not
an old-build latency comparison. Scope count/width stay three/one.

**P01 adapter check reductions and D67 limits are verified live (2026-11-07).**
Consecutive layer-chain renames now share one stage: one container reading
before the `batch.run` and one wait after it. Chain growth copies are one
apply that reuses readings between copies, and `chain.insert` stages no
longer re-point cursor 0. A guarded `device.insert` reads nothing before its
write (the extension checks the stated chain), and `add_devices` projects the
chain between native devices. [E407](evidence/experiments/e407-p01-adapter-checks-and-d44-live.md):
six chains at position 18 took 7.8 s (E406: 13.7 s), the other E406 cases
2.1–4.5 s, and reverts 1.5–2.9 s; `add_devices` of 16 native devices took
9.1 s (18.7–19.0 s). Above the six-unit limit, units no
longer drive the cost (4×4 native 3.8 s, 16 plug-in units 3.5 s), but
layer-chain growth and existing sources do: 16 chains at 18 took 38.1 s,
and 8 existing sources into 8 chains took 25.6 s.
[D67](decisions/d67-composition-limits-follow-chains-and-existing-sources.md)
therefore replaces D44's `compose_devices` row: at most 8 layer chains and
16 device units, with existing sources counting two. Descriptions are v61;
the wire is unchanged (normal 94 / `526cd7e3760580cc`, already loaded, so no
controller replacement was needed). All 2,624 brain tests pass. Scratch
cleanup and preservation passed in every run.
Writer-clip releases after structural stages stay (about 70 ms; pin state
is not tracked across calls).

**P01 shared relocation readings are verified live (2026-11-07).**
Consecutive existing sources now share one apply, and each relocation reuses
the batch preflight or the previous relocation's proof reading; an unproved
relocation ends the batch.
[E408](evidence/experiments/e408-p01-shared-relocation-readings-live.md):
8 existing sources at position 18 took 17.0 s / 219 turns (E407: 25.6 s /
331), revert 12.0 s; the E406 cases are unchanged. Only brain code changed
(wire 94 / `526cd7e3760580cc`, already loaded); D67 limits and descriptions
v61 are unchanged. All 2,627 brain tests pass.

**P01 named 16-chain seed is verified live (2026-11-07).** Staged
`compose_devices` now inserts its container from a human-saved 16-chain
seed, trimmed to the request's width with the requested chain names written
into the preset, as UTF-16 when not ASCII
([E410](evidence/experiments/e410-p01-unicode-chain-names-in-the-seed.md));
no chain is grown or renamed live.
[E409](evidence/experiments/e409-p01-named-sixteen-chain-seed-live.md):
16 one-device chains at position 18 took 10.9 s (E407: 38.1 s), 8×2 5.8 s
(13.2 s), reverts 1.6–3.5 s.
[D68](decisions/d68-composition-chain-limit-is-the-seed-width.md) raises the
layer-chain limit from 8 to 16; descriptions are v62. Only brain code
changed (wire 94 / `526cd7e3760580cc`, already loaded). All 2,652 brain tests
pass; cleanup and preservation passed.

**P01 one-turn scalar cohorts are verified live (2026-11-07).**
`set_device_controls` writes all settings of one device route in one
`batch.run` and proves them with the executor's single readback, which
compares every unrequested DirectParameter; the adapter's per-write
callbacks, integrity polls, last-stage inventory and pre-write chain read
are gone, and one selection scope lets the write and readback reuse the
preflight's cursor target.
[E411](evidence/experiments/e411-p01-one-turn-scalar-cohorts-live.md): a
native route of 1, 8 or 44 Polysynth controls takes 1.33–1.35 s / 34 calls
(same-session HEAD: 2.2 / 3.4 / 9.4 s); 64 remote controls 1.24 s (4.66 s);
8 nested EQ-5 controls 1.44 s (3.57 s). A refused setting no longer stops
the other settings of its route. `set_track_mixer` was already one read,
one stage and one readback; a mixer-only write now skips the selection
capture (216 ms, was 238). Descriptions v63; only brain code changed (wire
94 / `526cd7e3760580cc`, already loaded). All 2,656 brain tests pass;
cleanup and preservation passed.
[E412](evidence/experiments/e412-p01-device-control-limits-live.md) then
remeasured the limits with Diva (CLAP, 281 IDs): a route costs 2.3 s for 64
or all 281 settings; 4 / 8 / 12 / 16 routes took 9.1 / 18.3 / 26.8 / 36.4 s
(E252: 4 routes 22.5 s).
[D69](decisions/d69-device-control-limits-follow-routes.md) replaces D44's
row: 256 settings on 12 routes (was 64 on 4), folded into descriptions v63.

**P01 metadata-only clip reads are verified live (2026-11-08).**
`set_launcher_clip_properties` and `set_launcher_clip_launch_settings` read
metadata or launch settings through a pointed cursor instead of replaying the
clip's notes, and pass that read to the executor as the stash (D65); one
verify read remains. A cursor readback lagged one rename by more than 90 ms,
so the executor rereads (at most four times, 144 ms apart) while a written
field reads its old value, without repeating the write.
[E413](evidence/experiments/e413-p01-metadata-only-clip-reads-live.md): one
clip of any size takes 0.74–0.81 s (HEAD: 1.1–1.5 s typical, 2.8 s at 16,384
notes); 8 clips of 16,384 notes 4.1–4.3 s for a rename (23.7 s) or launch
settings (16.4 s), reverts 7.1–7.5 s (36.9 / 22.1 s). Descriptions v64;
only brain code changed (wire 94 / `526cd7e3760580cc`, already loaded). All
2,661 brain tests pass; cleanup and preservation passed. Two pre-existing
findings are open in the
[brief](work/p01-edit-path-performance.md#metadata-only-clip-reads--live-2026-11-08):
a spurious collapsed-group point on an ungrouped track, and `delete_track`
reporting `differs` for a track with large clips. The project's launcher slot
selection is now FX 1, row 8 (it had none; the adapter cannot clear one).
Remaining P01 items are optional.

Ordered direct insertion is now proved in
[E403](evidence/experiments/e403-ordered-direct-chain-insertion.md). V2 waits
for the preceding source's device count before the next end insertion. Native
triples, appends to populated chains, mixed native/VST3/CLAP/preset sources,
and top-level/layer/device page boundaries all passed with final independent
readback. E402's immediate-loop ordering failures remain historical evidence;
call reversal is not a general fix. Scratch was removed and original
inventories/selection matched. The D65 composition rewrite and D44 reweighting
are still open; the research method is not a product tool.

[E404](evidence/experiments/e404-structural-device-deletion.md) implements and
verifies the next P01 reduction: pure `device.delete` batches take structural
stash/final snapshots, preserving mixed-batch scalar captures and the honest
non-recreation result. On the comparison fixture, parameter-inventory calls
fell from 8 to 0 and wire calls from 84 to 61. The two diagnostic time samples
ran under concurrent offline-test load and are not stable latency bounds.
Both scratch tracks were removed and preservation checks passed.

**Session cleanup is closed by operator report (2026-11-07).** The operator
reports replacing the controller with normal `ghostnote`, but it may be a build
from intervening work in another worktree, and explicitly requests no cleanup
verification. No cleanup handshake was run in this worktree. B18 subsequently verified its
own normal build in E405; that is not verification of this combined worktree.
The earlier restoration deployment remains historical evidence. Establish the intended build and fresh live context before
future P01 host work; no controller replacement is pending for this session.

Before reconciliation, typecheck, 81 focused executor/call-budget tests
and extension checks passed.
The full brain suite passed 2,608/2,609 tests; the one planner timing test
exceeded its 4-second bound under concurrent load, then its three-test file
passed alone. That P01 checkpoint used descriptions v57 / 46 tools; B18 now
brings the combined source to descriptions v59 / 46 tools. At that checkpoint, the idle MCP server was from the shared checkout; a brain server must load this
worktree's updated code to use these brain changes.

[E400](evidence/experiments/e400-p01-offline-cost-attribution.md) and the brief
retain the obligation audit. The D65 composition integration is verified live
in E406, the adapter reductions and D67 limits in E407, and shared relocation
readings in E408, and one-turn scalar cohorts in E411 (above).
Clip-metadata capture reductions are verified live in E413.

The [reconciliation checkpoint](work/p01-edit-path-performance.md#reconciliation-and-parallel-queues--2026-11-07)
records P01's evidence renumbering to E400–E404, both retained probes, and
parallel-work coordination. The operator committed that first reconciliation
after typecheck, all 2,610 brain tests and the offline extension check passed.
The new B18 reconciliation is recorded in the
[B18 integration checkpoint](work/p01-edit-path-performance.md#b18-integration--2026-11-07).
The combined tree passes typecheck, all 2,615 brain tests and the offline
extension check. Normal wire remains 93 methods; probe wire remains
123 / `f8f2b5ec8531c93d`. B18 resolution edits await operator staging and the
merge commit. No combined P01/B18 build has been deployed from this worktree.

[R01](work/r01-format-comparison.md)'s [candidate package](../spec/r01-research/README.md)
is ready for review: contracts, bounded offline prototypes for ideas 1–4,
matched examples, a common oracle, and a staged agent-trial protocol.
[E354](evidence/experiments/e354-r01-candidate-prototypes-and-shard-corpus.md)
records four Ghostworks excerpts (128 notes), synthetic stress cases, 44 passing
supported format/fixture cells and four explicit full-state exclusions.
Producer Pal precision adaptations preserve tested normalized state or explicitly
refuse; a 55,296-input boundary sweep includes 2,048 bar|beat precision refusals.
All 35 new tests and 286 existing document/binding tests pass. Eleven MIDI work
families are reserved for future evaluation. The
[checkpoint](work/r01-format-comparison.md#current-checkpoint-candidate-package-ready)
identifies contract review and a frozen agent pilot as next.
[E355](evidence/experiments/e355-r01-subscription-cli-smoke.md) records two successful
unscored subscription CLI edits, provider token counters, and isolation/accounting
traps. [E356](evidence/experiments/e356-r01-nested-fields-prototype.md) adds the
accepted group-local FIELDS surface for C4: 12 fixtures preserve exact state,
59 focused tests pass, and two unscored subscription edits succeed without
repairs. Its eight development payloads use 31.98% fewer local tokens than
equivalent C4 JSON; this is not comparative agent evidence.
[E357](evidence/experiments/e357-r01-compact-fields-prototype.md) completes C3's
FIELDS surface with adjacent nominal columns, 12 passing fixture checks and
82 passing focused tests. [E358](evidence/experiments/e358-r01-matched-development-pairs.md)
adds 11 matched cards and 14 development tasks: 76 eligible pairs pass offline
fact/golden checks, with 23 explicit exclusions and a bounded layout control.
[E359](evidence/experiments/e359-r01-cli-controls-and-model-selection.md) adds
CLI request audits, seeded paired ordering, bounded explicit repairs and a
historical model inventory; 148 focused tests pass. The historical GPT-5.4 mini
snapshot is rejected by ChatGPT-backed Codex. A Luna edit succeeds but fails
control admission because of advertised tools, injected instructions, missing
served-model evidence and unresolved transport retries.
[E360](evidence/experiments/e360-r01-historical-haiku-cli-capture.md) verifies the
exact historical Haiku model, 1,024-token thinking budget and 12,000 output cap
through a correct subscription CLI edit with raw capture. The operator monitors
subscription usage; disabled-credit confirmation is not required. All 152
focused tests pass.
[E361](evidence/experiments/e361-r01-claude-controls-and-paired-rehearsal.md)
closes the Claude gates: a versioned context policy admits only the captured
client blocks with exact task bytes, and a local fault suite on the pinned
binary shows one HTTP attempt and one captured request per submission, with
positive controls detecting permitted retries. The paired runner completed the
11-attempt historical-Haiku development slice: 15 admitted submissions, 9
first-attempt passes, two C3 group edits exhausted both corrections. This is
development evidence only; 168 focused tests pass. Codex controls were not
advanced. The operator answered the [pilot draft](../spec/r01-research/PILOT-DRAFT.md#review-answers)'s
review list: cohorts Haiku 5.5 and GPT-6 Luna, 12 instances × 3 repeats
(201 initial attempts and 603 maximum submissions per cohort), C3/C4-only
source tasks with exclusions reported, collision windows refused.
The draft's [trial stages](../spec/r01-research/PILOT-DRAFT.md#trial-stages) add a labeled
development stage, with reused inputs and tunable formats, before a frozen
rigorous stage on fresh inputs. Both cohort admissions are now complete
(E363 and E364 below).
[E362](evidence/experiments/e362-r01-codex-isolation-and-remaining-gates.md)
completes the focused Codex investigation: an isolated `CODEX_HOME` removes
global AGENTS and skills; two unscored Luna edits succeed. Stronger controls
leave four function tools advertised. Local custom-provider fault tests show
one HTTP request with retries disabled and two with one retry allowed, both
represented as one logical inference. Subsequent decisions accept request-model
selection (D55), reject actual tool use instead of declarations (D56), remove
hard output ceilings (D57) and move retries into reporting (D58).
[E363](evidence/experiments/e363-r01-codex-luna-admission.md) admits Luna on the
pinned Codex 0.163.0 configuration: the normal runner uses the stronger four-tool
context, every captured request is checked against the fixed policy, and a fresh
correct subscription edit passes all gates. Normal in-turn self-correction is
accepted; HTTP totals remain unknown and usage is client-reported. [E364](evidence/experiments/e364-r01-haiku55-admission.md)
admits Haiku 5.5 at provisional `low` effort on the unchanged Claude Code
binary. Context policy v2 covers the client's new layout, which moves
environment, identity, budget and date into a trailing system-role turn. One
probe and six first-attempt passes on one development task pass every gate;
input is now reported as 1-hour cache writes.
[E365](evidence/experiments/e365-r01-haiku-effort-calibration.md) calibrates
Haiku effort to `low`, its lowest setting. On 38 matched development cells,
Haiku `low` still generates 6.1× Luna `low` by median (401.5 vs 65.5 tokens):
Luna reported no reasoning, while answer-only portions are within 1.34×.
197 focused tests pass. The [pilot runner](../brain/benchmarks/r01-candidates/cli-pilot-runner.mjs)
now plans both cohorts in the seeded pilot order (201 initial and 603 maximum
submissions per cohort), records subsets and stage labels, writes results
after every run and resumes quota pauses with a labeled resubmission; 207
focused tests pass and no submission has been made with it.
[E366](evidence/experiments/e366-r01-pilot-development-inputs.md) builds the
development inputs. A fresh inventory matches the retained manifest and the
lineage checks pass. Seeded selection opened only works A–C (Re:turning piano,
Our Taproot bass and Good Lies bass; 38, 24 and 24 notes), and their first
windows were accepted. The synthetic seed and `p01`–`p12` package match draft
2 (67 eligible cells and 17 exclusions per repeat), and the offline rehearsal
accepts every golden. [E367](evidence/experiments/e367-r01-pilot-inputs-v2-dense-windows-velocities.md)
replaces these with input v2. Each work's densest admissible window
(piano 103, guitar 72, bass 115 notes) replaces the sparse first windows.
Instances that share a window target different notes, and seeded synthetic
velocities replace placeholder 64. Prompts are 1.6× larger. 221 focused tests
pass. [E368](evidence/experiments/e368-r01-pilot-execution-manifest-and-rehearsal.md)
pins a development-labeled execution manifest for `pilot-development-v2`
(package, per-cell payload/prompt/oracle hashes and both cohorts'
materialized order); the runner refuses a start that disagrees. The extended
rehearsal accepts all 67 goldens and rejects all 389 task-specific wrong
answers and 61 gratuitous refusals; 225 focused tests pass.
[E369](evidence/experiments/e369-r01-first-development-run-one-repeat.md) is the
first development run: one repeat, 134 runs and 199 submissions, with no control
failure or quota pause. Haiku 5.5 passed 58/67 on the first attempt and 65/67
within two corrections; Luna passed 39/67 and 42/67. Luna missed p01 counting and
the p08 range shift on every format. Haiku's p07 C3 failure is a correct answer
with unreduced rationals. [D59](../spec/r01-research/decisions/d59-r01-functional-equivalence-and-locating-feedback.md)
now scores functionally equivalent answers as passes and makes correction
feedback locate errors without giving expected values. The execution manifest
was re-pinned (`v2/execution-2`). Offline re-scoring raises Haiku to 60/67
first-attempt. [E370](evidence/experiments/e370-r01-second-development-run-and-response-analysis.md)
repeats the one-repeat run and adds the first response analysis. Haiku passed
62/67 on the first attempt and 67/67 within budget. Luna halted twice on
120-second stream stalls, and its corrections pass 4/89. Four prompt defects
were found, including p06's selector, which also matches index 8.
[D60](../spec/r01-research/decisions/d60-r01-package-v3-prompts-and-stall-resubmission.md) fixes all four in package
`pilot-development-v3` (same inputs and oracles; the rehearsal still passes) and
adds one identical resubmission after a timeout without an answer. 228 focused
tests pass. [E371](evidence/experiments/e371-r01-package-v3-one-repeat-check.md)
checks v3 with one repeat. The run completed without a halt. Haiku passed 67/67
on the first attempt, and Luna passed 38/67 and 45/67 within budget. The four
defects are gone, and no new prompt or scorer defect was found. No submission
stalled, so the stall policy was not exercised live.
[D61](../spec/r01-research/decisions/d61-r01-package-v4-harder-tasks.md) then replaced p01, p06,
p07, p08 and p09 with harder tasks in package `pilot-development-v4` (same
inputs and cells); its rehearsal rejects all 418 wrong answers, and 232
focused tests pass. [E372](evidence/experiments/e372-r01-package-v4-harder-tasks-one-repeat.md)
checks v4 with one repeat: Haiku passed 64/67 on the first attempt (67/67
within budget) and Luna 35/67 (44/67). One Luna stall was resubmitted and the
run continued. No defect was found.
[E373](evidence/experiments/e373-r01-package-v4-three-repeat-development-pass.md)
is the three-repeat pass of v4. Haiku passed 192/201 on the first attempt
(200/201 within budget) and Luna 103/201 (125/201). Producer Pal bar|beat is
the hardest arm for both cohorts (Haiku 20/24, Luna 2/24 on performed tasks).
The full run halted once on a Codex request without the `access_programs`
field (1 of 1,024 Luna requests, no model-visible difference). Luna was
restarted as a cohort-only run and completed. Three stalls were recovered by
resubmission. [D62](../spec/r01-research/decisions/d62-r01-codex-access-programs-optional.md)
then relaxed the Codex context policy (v2): the field may be absent and is
reported, and E373's halted request passes on re-audit.
[D63](../spec/r01-research/decisions/d63-r01-package-v5-group-timing-tasks.md) adds four synthetic
group-timing source tasks (p13–p16) in package `pilot-development-v5`: 87
eligible cells and 33 exclusions per repeat. Its rehearsal rejects all 568 wrong
answers, and 236 focused tests pass.
[E374](evidence/experiments/e374-r01-package-v5-group-timing-one-repeat.md)'s
one-repeat check found no defect (Haiku 19/20 and Luna 5/20 on the new tasks),
so no v6 was built.
[E375](evidence/experiments/e375-r01-package-v5-three-repeat-development-pass.md)
is the three-repeat pass, completed without a halt or stall: Haiku 252/261 and
Luna 119/261 first-attempt. On the eight source tasks, C3 versus C4 FIELDS was
23 versus 24 of 24 for Haiku and 6 versus 15 for Luna. C4 leads on
onset-changing edits, and C3 leads on reading one derived onset. bar|beat
remains the hardest performed arm, and the median generated-token gap is 5.0×.
[E376](evidence/experiments/e376-r01-luna-medium-effort-floor-tasks.md), an
operator-requested probe, ran Luna at medium effort on the floor tasks: p14
rose from 0/15 to 8/15 first-attempt, and p13 from 0/15 to 1/15, with no
C3/C4 difference. Codex context policy v3 now checks `reasoning.effort`
against the profile; the probe profile runs only in development subsets.
237 focused tests pass.
[E377](evidence/experiments/e377-r01-luna-medium-effort-remaining-tasks.md)
ran the other 14 tasks at medium: over all 87 cells, Luna rose from 119 to
145 of 261 first-attempt (Haiku `low`: 252). The gains are on boundary and
multi-step tasks. The p10 refusal fell from 9 to 4 of 18, and the C3/C4 FIELDS
gap on source tasks narrowed (C3 6 → 10, C4 15 → 16 of 24).
[D64](../spec/r01-research/decisions/d64-r01-luna-cohort-effort-medium.md) records the operator's
answer to freeze item 4a: Luna runs at `medium` in the rigorous stage, and
Haiku stays at `low`. The operator then answered items 1–7 as proposed
([R01-D1](../spec/r01-research/decisions/r01-d1-rigorous-freeze-versions.md)
to [R01-D7](../spec/r01-research/decisions/r01-d7-rigorous-reporting.md)) and
**confirmed the freeze** on 2026-10-28. The rigorous path is implemented
offline: stage-keyed profiles (`codex-current` at `medium`; development plans
keep `low`), seeded task generation, rigorous window selection with the
target-rule refusal, package `pilot-rigorous-v1`, a stage-aware execution
manifest and a once-only cohort restart in the pinned order. 246 focused
tests pass. On the development windows, the new seeds rehearse cleanly.
[E378](evidence/experiments/e378-r01-rigorous-inputs-and-execution-manifest.md)
materializes the rigorous stage. Works 4–6 fill roles A–C (126, 128 and 62
notes), and one target-rule refusal occurred. Package `pilot-rigorous-v1` and a
rigorous execution manifest are pinned (Haiku `low`, Luna `medium`, 261 runs
each); the rehearsal rejects all 568 wrong answers.
[E379](evidence/experiments/e379-r01-rigorous-three-repeat-run.md) is the
rigorous run: 522/522 runs in 752 submissions, with no control failure or
halt and two recovered stalls. Haiku `low` passed 247/261 on the first
attempt (261 within budget) and Luna `medium` 138/261 (187). On source
tasks, C3 versus C4 FIELDS was 24 versus 23 for Haiku and 8 versus 15 for
Luna. C4 leads on onset-changing edits, and C3 on reading one derived onset.
bar|beat is the hardest performed arm. Because Haiku sits at the ceiling and
Luna near the floor, the operator approved a second development round:
difficulty ladders, saturation-resistant measures, a Terra assessment and a
later decision on an agentic tool-loop evaluation. Round 2 is a version reset
whose rigorous round restarts at works 1–3
([R01-D8](../spec/r01-research/decisions/r01-d8-round-2-version-reset-and-work-reuse.md)).
The operator answered the
[round 2 brief](work/r01-round-2-difficulty-scaling.md)'s decisions
(R01-D9–R01-D12): Terra (`gpt-5.6-terra`, `low`) and Haiku 4.5 join
development, calibration uses one repeat and full runs three, and the timeout
scales with output.
[E380](evidence/experiments/e380-r01-round2-catalog-and-admission-probes.md)
refreshes the Codex catalog. It now also lists `gpt-6.1-terra`. Both Terra
models pass admission probes at `low` under Codex context policy v4, which
selects the fixed-context template by model. Haiku 4.5, with a 1,024-token
thinking budget and no output cap, passes under policy v1.
[E381](evidence/experiments/e381-r01-round2-offline-implementation.md)
builds the ladders offline. It selects N-note windows of works 4–6 (64–512
notes; only one piano part supplies 512) and generates 116 tasks across 8
families. Package `round2-development-v1` has 448 eligible cells, and its
rehearsal accepts every golden and rejects all 3,546 wrong answers. Each
family level has a pinned output-scaled timeout (130–1,120 s); the round-2
measures and a pinned execution manifest are ready. 259 focused tests pass.
[R01-D13](../spec/r01-research/decisions/r01-d13-round-2-admission-and-offline-design.md)
records the details; the operator accepted them and chose `gpt-5.6-terra`
as the only Terra for now.
[E382](evidence/experiments/e382-r01-round2-calibration-pass.md) is the
calibration pass: 448/448 runs in 639 submissions over about five hours, with
no halt, stall or quota pause. First-attempt passes were Haiku 5.5 104/112,
Terra 96/112, Haiku 4.5 85/112 and Luna 49/112. Haiku 5.5 and Terra stay at
or near the ceiling, Haiku 4.5 spans pass to fail on four families, and Luna
is at its floor at level 1 on three. Preservation is at the ceiling for
everyone, but output size there varies 2.6× by format. bar|beat is the
hardest range-edit arm. **Next: the operator decides** the proposed
per-cohort levels and the Terra rule reading (add Terra beside Luna); then
package v2 and the development pass.
[E383](evidence/experiments/e383-r01-round2-luna-high-effort-floor-probe.md),
an operator-requested probe, reran six of Luna's floor tasks at `high`. It
passed 24/26 on the first attempt (`medium` 5/26) and 26/26 within budget.
Luna's `medium` floor is mostly a no-reasoning mode: 84 of its 112 calibration
first attempts reported zero reasoning.
The operator then chose Haiku 5.5 `low` and Luna `high` on one harder ladder
([R01-D14](../spec/r01-research/decisions/r01-d14-round-2-two-cohorts-harder-ladder.md),
package `round2-development-v2`, clean rehearsal).
[E384](evidence/experiments/e384-r01-round2-v2-calibration.md) is its
calibration: 180/180 runs, no halt, about $1 at API rates. First-attempt
passes were Haiku 79/90 and Luna 68/90. Range-edit breaks for both (512 for
Haiku, 256 for Luna), and Luna's derived reads break in C4 FIELDS from 8
groups while C3 holds to 16. Regroup, member-move, retime and delete barely
bend at four times v1's sizes. The operator chose a trimmed pass
([R01-D15](../spec/r01-research/decisions/r01-d15-round-2-trimmed-development-pass.md)).
[E385](evidence/experiments/e385-r01-round2-v2-development-pass.md) is that
development pass: four instances and three repeats, with Haiku 5.5 `low` and
Luna `high` run in parallel. It cost about $9 at API rates.
- **Results:** Haiku passed 581/684 first-attempt and Luna 491/684.
- **C3 vs C4:** every significant C3/C4 difference favours C4 FIELDS: Haiku
  on derived reads (43 vs 32/48) and regrouping (22 vs 11/24), and Luna on
  retiming (18 vs 6/24; cluster-aware p = 0.016, since repeats are correlated) and member moves (24 vs 17/24).
- **Other formats:** bar|beat is the weakest performed arm. Luna's
  baseline-JSON range edits break near 330 notes. C3 FIELDS catches 68% of
  Luna's failures at the validator.
- **Agentic criteria:** both of the brief's criteria hold.
- **Incidents:** a websocket-framing control halt (policy v5,
  [R01-D16](../spec/r01-research/decisions/r01-d16-round-2-codex-websocket-framing-and-reaudited-continuation.md))
  and sleep stalls
  ([R01-D17](../spec/r01-research/decisions/r01-d17-round-2-continuation-after-sleep-stall-halt.md))
  were continued without losing finished runs.

[E386](evidence/experiments/e386-r01-round2-mixed-model-discordance-and-package-v3.md)
does the three statistics steps offline.
- **Model:** a mixed-effects model with clustered repeats gives C4 over C3
  FIELDS for Haiku (writes OR 3.2, reads 5.7) and for Luna on writes (6.0).
  Luna's reads lean C3 (n.s.), and its read/write interaction is significant.
- **Settled:** bar|beat is worse than every other arm.
- **Next pass:** at equal cost, 12 instances × 1 repeat beats 4 × 3.
  Per-cohort packages `round2-development-v3-haiku` and `-luna` (240 and 336
  runs, fresh instances, clean rehearsal) are pinned.

The operator accepted
[R01-D18](../spec/r01-research/decisions/r01-d18-round-2-discordant-levels-fresh-instances.md),
and [E387](evidence/experiments/e387-r01-round2-v3-development-pass.md) ran it
on fresh instances: 576 runs, no halt.
- **Haiku:** C4 is confirmed for reads (OR 10.2) and regrouping, but its
  retiming leans C3, so Haiku's general write advantage is not confirmed.
- **Luna:** C4 is confirmed for edits (OR 8.2), and its reads lean C3.
- **Model:** with one repeat, the model pins its instance × format term.
- **Tooling:** pinned tooling now lives in `.tmp/r01-tooling/` after a
  `/tmp` cleanup deleted the old copies.

[R01-D19](../spec/r01-research/decisions/r01-d19-round-2-format-dependent-families-before-step-6.md)
turns step 6 into new format-dependent task families on the same two
cohorts; the tool loop and stronger cohorts are deferred.
[E388](evidence/experiments/e388-r01-round2-format-dependent-families-offline.md)
builds the families offline.
- **Families:** query-selected edits, overlapping memberships, edits within
  large state and interpretation maintenance. Each is synthetic and has
  level-aware wrong answers.
- **Packages:** `round2-development-v4-haiku` and `-luna` share one
  uncalibrated ladder. Each holds 16 tasks and 32 C3/C4 FIELDS cells, and
  its full pass is the calibration.
- **Rehearsal:** every golden passes, and all 316 wrong answers per package
  are rejected. 272 focused tests pass.

The operator accepted
[R01-D20](../spec/r01-research/decisions/r01-d20-round-2-format-dependent-family-designs-and-calibration.md),
and [E389](evidence/experiments/e389-r01-round2-v4-calibration.md) ran the
calibration: 64 runs in 29 minutes, with no halt or stall.
- **Haiku:** at the ceiling. It passed 30/32 on the first attempt and 32/32
  within budget; its only misses were two C4 cells.
- **Luna:** near 50%, with discordance. It passed 12/32 on the first
  attempt (C3 6, C4 6) and 24/32 within budget, with 4 C3-only and 4
  C4-only pairs. Interpretation maintenance is at its first-attempt floor
  (0/8).
- **Error visibility:** 6 of 10 Luna C3 failures were validator-caught,
  against 3 of 10 for C4.
- **Defects:** none found.

The operator then delegated Haiku's levels and the development pass
([R01-D21](../spec/r01-research/decisions/r01-d21-round-2-haiku-recalibration-and-shared-development-ladder.md),
with the level rule fixed before data).
[E390](evidence/experiments/e390-r01-round2-haiku-recalibration.md) probed
Haiku at 2–3× the v4 tops: it passed 17/18, breaking only at query 64.
[E391](evidence/experiments/e391-r01-round2-v6-development-pass.md) ran one
shared ladder for both models on 12 fresh instances (576 runs, no halt).
- **Luna:** C4 beats C3 FIELDS overall (OR 2.0, p = 0.023), on query edits
  (5.9, p = 0.007) and inside large documents (9.0, p = 0.002). Overlap is
  even, and interp leans C3 without significance.
- **Haiku:** no accuracy difference (263/288). For the same correct answers,
  C4 generates about two-thirds of C3's tokens (query 0.63, overlap 0.64,
  large 0.75, interp 0.92).
- **Luna abandons long C3 answers:** at query 64–96, 17/24 C3 first answers
  were non-attempts, against 3/24 in C4.
- **Error visibility:** C3 catches more of its own failures.

The operator then made a **capability grid** R01's focus
([R01-D22](../spec/r01-research/decisions/r01-d22-capability-grid-focus.md),
[brief](work/r01-format-comparison.md#focus-capability-grid-r01-d22-2026-10-31)).
- **State:** A1 performed core, A2 authoritative host state, A3 annotative
  context.
- **Interaction:** B1 restatement, B2 addressed editing, B3 sustained
  editing.
- **Desirable features:** local addressability is B2; state continuity and
  edit lineage are B3.
- **Evidence:** R01 and Phase 8 have measured only B1 and single-turn B2.
  B3 is unmeasured for every format.

[E392](evidence/experiments/e392-r01-real-usage-by-capability-cell.md)
classified real use: 11 product sessions (9 Codex, 2 Claude Code), 564
Ghostnote calls.
- **Cells:** 17 of 20 note-write interactions were A1/B1 generation by
  script; three were single-turn B2 patches that were really range or
  transform edits; B3 never occurred.
- **Live format:** every applied write verified exact, and no failure was
  caused by the notation. Agents used FIELDS as a script target through file
  paths. Unrequested per-note overlays were about 95% of written bytes, were
  never used, and never survived a save, move or copy.
- **Costs:** mostly tool design, guidance and host identity: slot probing by
  full reads, re-reading verified writes, and missing slice, duplicate and
  selector operations.

The operator paused the format comparison at the development stage and
opened round 3 ([R01-D23](../spec/r01-research/decisions/r01-d23-pause-format-comparison-and-open-round-3.md));
results are packaged in [FINDINGS.md](../spec/r01-research/FINDINGS.md).
[E393](evidence/experiments/e393-r01-round3-real-use-followups.md) answers
round 3 offline:
- **ID re-mint:** Ghostnote's fail-closed 24-event slot window, not the
  agent or Bitwig; the result hides the `delta-incomplete` reason. A live
  probe confirmed it: IDs survive 24 events after a read and re-mint at 25,
  with or without concurrent reads.
- **Timing overlays:** description routing put per-note claims on every note
  whenever timing was made or kept. Declared ones matched requested feel, but
  nothing read them; timing questions were answered against source MIDI.
- **Tool costs:** nine ranked proposals, three of them description-only.

Works A–C are development material (E366); only development runs have occurred. E353 remains the
initial source/codec/claim-cost evidence. Stark is excluded; no format adoption,
product runtime change or scored model comparison occurred. Annotation persistence,
storage ownership remain deferred. R01's only live work is the E393 probe
recorded below.

R02's local work is complete. On 2026-11-07, the user confirmed filing the
upstream report with the [minimal reproduction](../extension/repro/pressure-getter/README.md):
one script, one Launcher clip, one note, no note observer. The
[closeout](work/r02-pressure-reproduction.md#closeout--2026-11-07) retains the
actual confirmation. No ticket reference, submitted text, console output, or
upstream response was supplied; filing does not add a new measured result to
E399. Any upstream follow-up is external and does not block other work.

[R02](work/r02-pressure-reproduction.md) has completed the audit and live
pressure reproduction. [E399](evidence/experiments/e399-pressure-getter-blindness-live.md)
shows human pressure 51% and API pressure 75% in the inspector, surviving
reselection and cursor retargeting, while both API readers return zero.
Velocity controls pass. This corrects the earlier inert-setter inference;
[D66](decisions/d66-pressure-refusal-is-a-verification-limit.md) retains product
refusal because independent API verification is unavailable. Current
explanations and descriptions are v58 (46 tools); write admission is unchanged.
The [local report draft](work/r02-pressure-upstream-report.md) remains supporting
material; the user filed using the minimal repro. The planning note wrongly
assigned filing to the agent and has been corrected. The agent sent nothing;
no external communication by the agent is authorized.

The owned scratch track was removed; all original track IDs/names and mixer
selection match. The UI shows no item selected, but the bridge retains the
deleted Launcher slot's old index. That discrepancy is recorded, not treated
as exact selection restoration. The normal build was loaded afterwards
(E393 and E405 handshakes). R01 is merged into `main`; only the P01
worktree remains open.

[B17 session 7](work/b17-extension-owned-window-scrolling.md#session-7-result)
is complete and verified live in
[E398](evidence/experiments/e398-integrated-paged-writes-live.md). The integrated
normal build composes five-device and six-chain shapes at positions 17 and 18,
duplicates and controls the sixth chain, transfers overflow devices between
chains, containers and the track, and inserts, disables, reorders and deletes
past the sixteen-device window. Width-derived admission caps are retired;
D44's six-unit budget, named-slot bounds and parameter restrictions remain.
Descriptions are v57 (46 tools); normal wire: 93 methods, hash
`d6decf985f6b1f36`.

Two live integration fixes are in the brain: a discarded population-changing
read retries once without replaying a write, and overflow deletion uses a
structural snapshot instead of an unsupported parameter cursor. An initial
composition failure now reports possible effects truthfully. All 2,601 brain
tests and extension checks pass. Both scratch fixtures were removed; original
track/device inventories and selection match the baseline. No controller
replacement was pending at the B17 closeout. No competing client was present then.

E398's dense six-chain structure read costs six turns / median 862 ms.
Five-device composition took 26.3 s; six-chain composition took 44.4 s, close
to D44's exceptional 45 s ceiling. These are fixture-specific costs. P01 owns
the repeated proof work and the six-unit budget review. Main proceeds with
B19 after completing B18 while P01 continues in its parallel worktree. New clients load the current brain; an already
running MCP server must restart to pick up these fixes.

Earlier checkpoints remain in [E395](evidence/experiments/e395-extension-owned-container-scopes-live.md)
(session 1, extension-owned scopes) and
[E397](evidence/experiments/e397-paged-device-and-layer-reads-live.md)
(session 2, complete paged reads). Their smaller-fixture timings are historical.

[B08](work/b08-scrollable-container-scopes.md) is complete and verified live.
[E394](evidence/experiments/e394-scrollable-container-scopes-product-live.md)
records the product build composing FX Layers at top-level positions 3 and 5,
`read_devices` listing their chains, the five chain tools and a move between
the two far containers applying and reading back, the solo read back through
the cursor route and a second scope, cleanup, and one defect fixed in the
session (a scope scrolled on a track with fewer devices clamps and stays; the
adapter now re-issues the scroll). That build had 93 methods, hash
`a44ce79ed75df81b`, with `chain.scroll`; descriptions were v55 (46 tools).
The `containerScope` ledger row has a far-position variant (about 305 ms, 11
turns). [D65](decisions/d65-proved-routes-run-with-one-readback.md) sets the new
runtime posture: routes proved in tests and E records are trusted at
runtime, a tool call makes one independent readback at the end, and
concurrent operator edits are not a design case.
P01 has implemented the container-scope read policy in `ContainerScopes.choose`
and the brain (skip non-containers and retain far scopes). Its parallel queue
now rebuilds staged `compose_devices` under D65: direct chain insertion in one
batch, one final readback and re-derived D44 weights, followed by other staged
paths.

[V14 — Add devices and presets by name](work/v14-add-devices-by-name.md) is
complete. `resolve_device_name` (46 tools, descriptions v54 then) resolves an exact
stock-device, VST3, CLAP, or Bitwig-preset name from the running host's
installation, preferences, indexes, and content locations with no Bitwig call.
[E351](evidence/experiments/e351-device-name-resolution-live.md) records all
four live insertions, configuration refresh and removal in one session,
ambiguity with explicit disambiguation, and cleanup.

V01's [Engram / Via Purifico sketch](work/v01-engram-purifico.md) is complete:
two saved eight-bar Launcher sections at 130 BPM, independently verified and
accepted after operator audition. No blocking V01 implementation defect was
observed. [R05](work/r05-browser-name-resolution.md) research is complete
with a positive native-discovery route. [E348](evidence/experiments/e348-browser-native-result-identities.md)
records 60 sampled native/VST3/CLAP/preset identities checked against independent
sources, successful cleanup, and the limits of coverage. The brief proposes a
minimal resolver contract; no public resolver or new insertion route was added.
Normal controller restoration and its fresh handshake are complete. Existing
catalog/explicit-ID/path tools remain the product interface.

[R06](work/r06-native-index-discovery.md) establishes a fast offline plug-in
route: 407 VST3/CLAP entries, 28 identity checks, and complete prior instrument
name lists match. [E349](evidence/experiments/e349-direct-plugin-index-discovery.md)
records 7.69 ms median local read/parse/check cost, an undecoded native/preset
preamble, and remaining index-refresh limits.
[E350](evidence/experiments/e350-library-roots-from-preferences.md) adds a
preferences-based root-discovery route: a temporary sound-content location was
detected on disk after addition and removal while Bitwig remained running.
Original location settings and project/selection context were verified afterward.
V14 turned these results into the public resolver.

The [backlog](BACKLOG.md) puts B19 first on main (B18 is done), with P01
in parallel here; R01 stays open until B19's
overlay session. That session also settles the first-save annotation
continuity limitation recorded in the V01 closeout.

[DIET](work/instruction-diet.md) is complete and independently reviewed.
Use the shorter [context guide](README.md) for relevant reading. D54 governs
inherited prescriptions; P01 examines runtime checks and recovery costs.
The [V10 brief](work/v10-grid-instrument.md) retains the Grid design and
identifies proposed mechanisms for assessment during implementation.

## Live state

- On 2026-11-07 the operator reported normal `ghostnote` replacement after
  intervening work in other worktrees. Cleanup is closed without a handshake
  at their request. E405 later recorded a verified B18 build. All controller,
  project and client observations below require refresh before new live work.
- E403/E404 cleanup left `gn-scale-test` with its original eleven tracks,
  complete observed device inventories and selected identities: mixer
  `gn-sel`, index 8, channel `6fb96670-abde-4958-9147-f573a4b43918`, no
  Launcher slot selected. The insertion scratch and both deletion scratch
  tracks were removed. No launch or save ran. Latest exit scopes were closed
  with 146 aims, zero refusals and no write block. No insertion receipt
  remained pending. The inspected idle client was PID 58395, this session's
  MCP server. Refresh live claims and clients before further writes.
- Bitwig **6.1.4**, API 25, `/Applications/Bitwig Studio.app`. Jar SHA-256
  `5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`,
  35,778,607 bytes, mtime `1790948299000000000`.
- **2026-11-07 (E405, B18), the latest recorded live work:** the B18 normal archive
  (SHA-256 `87cb84d1f94317b092e10e15d31129922976f0e51abc979897dcf0fbe94e7c2c`)
  was loaded in that session. The operator replied "Replaced; run it all". The fresh
  initialization was `2026-11-07T15:39:12.761Z`: `normal-v1`, 93 methods,
  `d6decf985f6b1f36`, `contentLog` 8192. Two driver runs created and deleted
  scratch track `gn-b18-window` in `gn-scale-test`. The 11-track list matches
  entry, and mixer selection stayed on the entry track. Launcher
  `selection.status` again reports the stale index 9 / slot 0; it is not a
  verified selection. No launch or save ran.
- **2026-10-31 (E393 probe):** scratch track
  `gn-r3-window` in `gn-scale-test` was created and deleted; the track list
  matches its entry state and the mixer selection stayed on `gn-sel`.
  `selection.status` afterwards still reported Launcher index 9 / slot 0, the
  stale bridge index R02 recorded; do not treat it as a verified selection.
- R02 live experiment used the verified probe initialization
  `2026-10-29T13:49:14.427Z`, marker `r02-pressure-v1`, 122 methods,
  hash `a8455ecb24cf6f8c`. Its
  [deployment record](evidence/data/r02-pressure/deployment-01.json) and
  [E399](evidence/experiments/e399-pressure-getter-blindness-live.md) retain
  build hashes, all attempts, samples, controls and cleanup.
- R02 scratch track `d9ca38aa-221e-4ae1-b02f-f14fa3a9e644` is removed.
  All eleven original track IDs/names match; mixer `gn-sel` remains selected.
  Launcher `selection.status` retains deleted index 9 / slot 0 despite the
  UI showing no item selected. Do not resolve that index to a new track and
  treat it as a verified selection. No playback launch or save ran.
- The normal `ghostnote` archive was redeployed after R02
  ([restoration record](evidence/data/r02-pressure/normal-restoration.json)).
  On 2026-10-31 the E393 handshake found a fresh `normal-v1` initialization
  (`2026-10-31T21:04:25Z`, API 25, 93 methods, hash `d6decf985f6b1f36`), so
  the normal build was loaded after R02.
- At the B17 closeout, the normal `ghostnote` archive was deployed, SHA-256
  `ac17f782d2ac4252c8259c06aee242d08f2356ac48072853973ef499c6eee5d8`.
  The operator replied “Controller replaced”. Fresh handshake passed on
  initialization `2026-10-28T02:58:49.135Z`: `normal-v1`, API 25, 93 methods,
  hash `d6decf985f6b1f36`; markers `paged-windows-v3`,
  `paged-chain-controls-v1`, `paged-chain-moves-v2`, and
  `paged-device-mutations-v1`. This handshake predates the R02 deployment.
  P01 cleanup is closed by the later operator report above.
- B17 closeout project: `gn-scale-test`, 11 tracks and 10 scenes.
  Both owned `gn-b17w` tracks were removed: first
  `f11d8e43-b4af-4f63-b94a-11f635dfcd38`, then
  `d5082b46-5af5-4672-81ba-3b14f59a42bb`. All original track/device inventories
  match their baseline. Mixer selection is `gn-sel` (index 8, channel
  `6fb96670-abde-4958-9147-f573a4b43918`); no Launcher slot is selected.
  Selection revision advanced 1 → 5 during the scratch lifecycles; selected
  identity is preserved. No playback launch or project save ran. Final scope
  status: closed, 435 aims, zero refusals; no write block. Owned drivers exited;
  unrelated editor processes were left alone. Re-check live claims, project,
  selection, clients and targets on resume. [E398](evidence/experiments/e398-integrated-paged-writes-live.md)
  retains attempts, corrections, timings and preservation comparisons.
- Preserved V01 project: `engram purifico`, saved under the Ghostworks construct
  of the same name. It contains Addictive Drums 2 (operator set GM mapping),
  Engram Bass, Purifico Stabs, FX 1, and Master. The first two Launcher scenes
  hold six verified clips, accepted after operator audition. Playback state
  has not been re-read since that audition. The last mixer read showed the
  three musical tracks at -10 dB, centered, unmuted, and unsoloed.
  Source contributions are confirmed; the saved-project path and verification
  summary are in the V01 brief. Its temporary working files were removed.
  Re-read project, target, and selection before further writes.
  Current source: 46 normal tools, descriptions v59; running server version unconfirmed.
- `.tmp/grid-doctor/` holds the local accepted 6.0.6 and 6.1.4 records and
  attempt records; the admission reader and doctor drivers now use this path.
  The whole `.tmp/` directory is ignored. Experimental evidence remains under
  `context/evidence/`; historical records retain their original `.local/` paths.
  A running brain process must restart to pick up the changed default path.
  [V10](work/v10-grid-instrument.md#operational-doctor-storage) will replace
  this development path with durable per-user application-data storage.

## Preserve

- The 6.0.6 install, backups, and donors under
  `/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1/`: the baseline
  jar for the upgrade tool.
- Evidence data under `evidence/data/phase9b-doctor/` and the E records it
  belongs to. Nineteen older `/tmp/gn-*` entries from 9b.5 and 9b.6i remain
  and are not named by any plan.
- Timing increases in E342 are research limits; no stable latency claim or
  timing retry is authorized.
