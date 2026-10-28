---
title: Current state
kind: status
updated: 2026-10-28
---

## Now

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
scales with output. **Next: round 2 step 2** (catalog refresh and probes),
then offline implementation.
R01's outcome (adoption, claims, naming) waits for round 2.
Works A–C are development material (E366); only development runs have occurred. E353 remains the
initial source/codec/claim-cost evidence. Stark is excluded; no format adoption,
product runtime change or scored model comparison occurred. Annotation persistence,
storage ownership and live checks remain deferred. The live state below was
not rechecked by R01.

[B08](work/b08-scrollable-container-scopes.md) research is complete with a
**go** verdict. [E352](evidence/experiments/e352-scrollable-container-scopes-retarget-live.md)
records that a layer bank hung off a one-wide scrollable device bank retargets
to the container at the scrolled position, including position 3, with the
complete identity correct on the first read at 0 ms wait (polled 23 ms, one
status round trip); nested chain and device windows scroll with total
`itemCount`; out-of-range scrolls clamp; a solo written through a scrolled
scope read back through an independent scope and the cursor route. The probe
profile gained `probe.scopeScroll` (120 methods, hash `eee07e622b789114`)
with an offline-tested driver. B08 implementation is next in the
[backlog](BACKLOG.md): scrollable product scopes, the five chain tools and
`compose_devices` past position 2, call-budget tests, and a re-measured
`containerScope` ledger row. The brief's result section lists the design
notes from the probe. R01, R02, and P01 follow.

[V14 — Add devices and presets by name](work/v14-add-devices-by-name.md) is
complete. `resolve_device_name` (46 tools, descriptions v54) resolves an exact
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

The [backlog](BACKLOG.md) now orders B08, R01, R02, then the P01 offline audit.
R01 also assesses the first-save annotation-continuity limitation
recorded in the V01 closeout.

[DIET](work/instruction-diet.md) is complete and independently reviewed.
Use the shorter [context guide](README.md) for relevant reading. D54 governs
inherited prescriptions; P01 examines runtime checks and recovery costs.
The [V10 brief](work/v10-grid-instrument.md) retains the Grid design and
identifies proposed mechanisms for assessment during implementation.

## Live state

- Bitwig **6.1.4**, API 25, `/Applications/Bitwig Studio.app`. Jar SHA-256
  `5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`,
  35,778,607 bytes, mtime `1790948299000000000`.
- The normal `ghostnote` archive was restored with `copyExtension` after the
  B08 probe (SHA-256
  `ae998a5d238b34665243523c48c4dd073d7cc82dd3e5d872525e7ea0051f7524`; the jar
  now carries the probe class, normal profile unchanged). The operator
  confirmed replacement; `npm run probe:hello` passed: `normal-v1`, API 25,
  92 methods, hash `8be1975eaa99d78f`, expected build markers, fresh
  initialization at `2026-10-25T20:05:43.639Z`. The Ghostnote MCP server
  answered product tools again after that replacement; it had stopped
  answering after the earlier replacement to the probe build (E352).
- Current foreground project: `gn-scale-test`, 11 tracks and 10 scenes.
  E352 deleted its scratch track `gn-b08`; `list_tracks` then listed the
  original 11 tracks with unchanged IDs, the four-chain `gn-lay4` structure
  read back unchanged, and the mixer selection stayed on `gn-sel`. No scratch
  track, solo flag, or popup remains. Re-read project, target, and selection
  before more writes.
- Preserved V01 project: `engram purifico`, saved under the Ghostworks construct
  of the same name. It contains Addictive Drums 2 (operator set GM mapping),
  Engram Bass, Purifico Stabs, FX 1, and Master. The first two Launcher scenes
  hold six verified clips, accepted after operator audition. Playback state
  has not been re-read since that audition. The last mixer read showed the
  three musical tracks at -10 dB, centered, unmuted, and unsoloed.
  Source contributions are confirmed; the saved-project path and verification
  summary are in the V01 brief. Its temporary working files were removed.
  Re-read project, target, and selection before further writes.
  Baseline: 46 normal tools, descriptions v54.
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
