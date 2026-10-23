---
title: Phase 9b — Grid breadth, build discovery, and build-out planning
kind: plan
state: active
status: E337 links 36 executable contracts and nine fields on 6.1.4. Complete bindings and bounded admission remain unproved. Next is sustained 9b.6g work through probe preparation or a concrete external blocker.
updated: 2026-10-21
parent: README.md
prev: 9a-live-grid-editing-spike.md
---

# Phase 9b — Grid breadth, build discovery, and build-out planning

## Purpose

[9a](9a-live-grid-editing-spike.md) proved the six Grid verbs (read, create,
update, and delete modules and cables) on one Amplify in one four-module Poly
Grid, on pinned Bitwig 6.0.6 ([E299](../../evidence/experiments/e299-grid-spike-close-out.md)).
9b answers the questions that decide whether a general Grid editing surface
can be built, in three steps:

1. **Breadth.** Which dimensions outside the 9a fixture break the 9a model?
2. **Build discovery.** Can the Grid path re-resolve its obfuscated symbols on
   a new Bitwig build, with a consent-gated self-test and a per-build cache?
3. **Build-out planning.** With those results, decide the scope and write the
   real implementation plan.

Each step has several sessions. The session list below is a starting
sequence, not a contract. Reshape it from results.

## Working style

Lighter than 9a. Keep enough rigor to trust a result and enough record to
find it later. Drop the rest.

- One short E record per experimental session: question, what ran, results,
  limits, next. Link the driver's JSON output under `context/evidence/data/phase9b-*/`.
  Add the index row. Planning and documentation cleanup need no new E record.
  Select the next free E number from the evidence index.
- Build fixtures with the public surface on a **scratch track**: `track.create`,
  `device.insertFile` (absolute `.bwpreset` path), `track.setMixer` (mute),
  `track.delete`. The probe profile has all four. Delete the scratch track at
  the end of each session. Use the operator's chosen host project and keep
  existing tracks unchanged. Exact file restoration is needed for a saved
  fixture persistence test or an explicit saved-file preservation requirement.
- Keep paired reads for this Grid research: two captures of the same state
  must agree. Agreement checks stability, not correctness. Check the baseline
  control and relevant graph invariants; write probes also need independent
  post-write evidence. Drop five-capture workflows, per-step screenshots,
  attempt allowances, and file hashes unless a session gives a reason.
- Keep the write lock, uncertain-state latch, and no-retry rule for every new
  native write path. They are cheap and they keep the host safe.
- Record each obfuscated symbol a session adds in the
  [symbol manifest](9b-grid-symbol-manifest.md): class, member, shape,
  validating invariant, first E. Step 2 resolves from this list.
- Extension changes still need a rebuild and operator controller replacement
  ([AGENTS.md](../../../AGENTS.md)). Batch new probe methods into one build
  per session.
- Record wire and document times from the driver output. Compare with the
  [ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md) 9a numbers only
  for a path that ran live. Cite existing cost models for unchanged paths.
  New research probes need a short cost note with bounded host work and memory.
  Changes to host calls, traversal, waits, allocation, or admitted limits need
  a matching measurement under the ledger rules.

## Step 1 — Breadth

Dimensions, in priority order:

| | Dimension | Why it can break the model |
|---|---|---|
| a | Knob-modulation inputs (signal → knob) and outer Bitwig modulators that target module knobs | Not in the E276 projection; most stock patches use them; may share a parameter-input representation with Ghostnote's modulation tools |
| b | Stateful modules: Sampler, Audio File, Wavetable, Steps/sequencer data, scale and curve tables | A type factory gives defaults only; content loading is an unexplored path; engine behavior may differ |
| c | Module catalog (UUID ↔ name) | Needed for any "create module" beyond Amplify. Names: 232 files in `Bitwig Studio.app/Contents/Resources/Library/modules/*.bwmodule`. UUIDs: type field 6369 in read captures, or the live resolver map behind `DbL.pvN(UUID)` (E281). The files are `0004`-encoded; decoding needs the key, which belongs to step 2. "Names plus seen UUIDs" is an acceptable first result. |
| d | FX Grid and Note Grid | Probably the same `module_grid` container; unverified. Different I/O module sets. |
| e | Scale: 20–40 module patches | `GridGraphRead.MAX_WORK` is 4,096; read time and heap at real sizes are unmeasured |
| f | Non-decimal parameter writes (boolean, integer, indexed) and bipolar | Only one decimal atom was written in 9a |

Sessions:

- **9b.1 — Survey preflight and offline inventory.** Stopped before fixture
  setup in [E300](../../evidence/experiments/e300-grid-survey-preflight.md).
  V13 refuses reads after its used audio session and only admits the original
  named Poly Grid fixture. The catalog seed, sample candidates, and symbol
  manifest are recorded. Breadth acceptance is not complete.
- **9b.2 — Scratch reader and survey continuation.** Complete in
  [E302](../../evidence/experiments/e302-stock-grid-survey.md): 12 stock presets,
  the control, 55 observed type UUIDs, and a complete 31-module catalog read.
  Full stock graphs remain incomplete or refused. V14 is loaded and verified.
- **9b.2a — Focused reader coverage.** Complete in
  [E304](../../evidence/experiments/e304-focused-grid-reader-live.md):
  selective routes, paired reads through 31 modules, selected reads on a
  50-module patch, Grid mapping endpoints, Gates data, and Wavetable identity.
- **9b.3 — Bounded write probes.** Complete in
  [E310](../../evidence/experiments/e310-grid-factory-acceptance-and-breadth-close.md),
  with E308 boolean and mapping acceptance. Gates detached defaults and
  disposal pass. Gates attachment is outside the fixed Amplify guards.
  Resource loading and FX/Note writes remain unproved. A preset name or
  partial read is not authority for a new command.
- **9b.3a — Engine-active checks, if the write results require them.**
  Operator listening in the [E296 style](9a-operator-audio-test.md), with fewer
  checks. E310 does not require this session for the stored-state verdicts.
  No new audible-behavior claim follows.

Exit: a verdict per dimension (same model, extension needed, or unknown with
the reason); the module catalog first pass; the symbol manifest complete for
all Grid paths; a list of module families the read path handles.

## Step 2 — Build symbol discovery

Question: on a new Bitwig build, can Ghostnote re-resolve the Grid symbols at
runtime, validate them with a consent-gated self-test on a scratch track, and
cache the result per build fingerprint?

Inputs and patterns:

- The symbol manifest from step 1.
- openwig (GPL; patterns only, no code): method search by parameter shape,
  static-field scans with an invariant (op-id), sentinel validation of a reader
  by walking a known object, a fingerprint cache (`host version + jar length +
  mtime`), and a fail-safe doctor on a throwaway track.
- bitwig-nitro-tools (MIT): select a candidate by an invariant field value,
  never by position or name; a live key dump if the catalog needs decoding.
  bwpreset's static key parse fails on 6.0.6 (audit F4); do not retry it.
- The 9a drivers as self-test bodies. Their exact-graph checks already
  tolerate fresh module UUIDs and managed IDs (E289 reload comparison).

What is already name-independent: the public proxy entry points
(`getDeepestTarget`, `getDocument`, `exec`, `isDocumentThread`), the
serializer property IDs and descriptor name strings, and the module type
UUIDs. What is obfuscated: about 12 descriptor-access methods, about six
command entry points, and the edit-journal ownership counters. The counters
have no shape; recover them behaviorally with a throwaway edit, last, after
the read, value, and cable stages validate.

Sessions:

- **9b.4 — Offline resolvers.** Complete in
  [E311](../../evidence/experiments/e311-grid-offline-resolvers.md): all 69
  member rows and 55 type roles match the pinned table. Failure and renamed
  model tests pass. The bounded scan takes 4.510 seconds. No live authority
  or cross-build acceptance follows.
- **9b.5 — Live doctor on 6.0.6.** Complete in
  [E316](../../evidence/experiments/e316-grid-doctor-606-acceptance.md),
  after the V19 failure and V20 correction. The fixed scope covers scratch
  track, preset insert, read
  sentinel, value, cable, factory, attach and undo, delete and undo, teardown,
  cache write. Measure. Set the budget, consent, and failure policy: one pass
  per fingerprint, no retry on uncertainty, engine state recorded but not
  required, "save first; a failed check can need a Bitwig restart" in the
  consent text.
- **General update audit.** Complete on 6.1.4 in
  [E330](../../evidence/experiments/e330-update-audit-614-acceptance.md).
  The [audit plan](9b-update-audit.md) covers the preserved 6.0.6 install,
  normal-product and Sampler checks, persistence, and clean teardown.
- **9b.6 — Live doctor on 6.1.x.** Offline discovery refuses in
  [E331](../../evidence/experiments/e331-grid-doctor-614-resolver-refusal.md).
  E332 traces changed command contracts. E333 traces document history and
  global disposal tracking. E334 traces inherited parent getters and debug
  event dispatch. E335 finds descriptor overrides and a nested event pump.
  E336 completes the local role census and traces the changed membership
  getter and lock construction. E337 links operation contracts and nine
  fields, and traces the managed-ID bootstraps. E338 closes 9b.6g: all
  roles resolve on both jars, but complete offline bounded admission does
  not converge. D52 adopts guarded runtime admission. Session 9b.6h
  prepares the guarded doctor. Record changed symbols and logic
  separately. Step 2 remains incomplete.
- **9b.7 — Refine into a tool.** A consent-gated check tool with a fingerprint
  cache; Grid tools refuse without a cached pass for the current fingerprint;
  descriptions bump and the usual tool-addition consumers.

Notes: both installs load the same archive from
`~/Documents/Bitwig Studio/Extensions`; the jar-hash gate makes that safe.
6.1 can bump the controller API version; the operator's audit covers the
normal profile.

Exit: the doctor passes on both builds, or a recorded reason it cannot.

## Step 3 — Build-out planning

No implementation in 9b. Use the step 1 and 2 results to decide: which verbs,
module families, and Grid flavours to support; placement and overlap policy
for the native `llL` layout pass; layout writes; outgoing-consumer cleanup on
delete; the cost model for real patch sizes (from the continued survey); failure
handling and recovery; the tool surface and descriptions. Output: an
implementation plan as a new phase or 9c, with a cost model per the
[ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md) rules.

## Session 9b.1 — Stock Grid preset survey (read-only)

**Disposition.** [E300](../../evidence/experiments/e300-grid-survey-preflight.md)
records the V13 refusal and the offline work. No preset was loaded. Continue
this survey in 9b.2 after the reader change below.

**Goal.** Read a sample of stock Grid presets on a scratch track. Classify
dimensions a–e from what it sees. Select the write probes for 9b.3.

**Inputs.**

- 254 preset paths matching `grid` under
  `~/Library/Application Support/Bitwig/Bitwig Studio/installed-packages/5.0/Bitwig/`
  (E300 path inventory; the original estimate was 255). This is a filename
  search, not a complete content classification. Examples:
  `Audio FX - Space, Time, Color/Grid Repeater.bwpreset` and
  `Freeform/Curving Grid.bwpreset`. Find them with
  `rg --files <dir> -g '*.bwpreset' | rg -i grid`.
- The V13 reader implementation and
  [E276 semantic query](../../evidence/data/phase9a-grid-read/semantic-query.json)
  are source inputs. The original no-rebuild assumption failed: V13 cannot
  survey scratch targets. E300 followed the stop-and-plan rule. A dedicated
  read path is now planned for 9b.2.
- Control preset:
  `~/Documents/Bitwig Studio/Library/Presets/Poly Grid/gn-grid-spike-baseline.bwpreset`.
  [E298](../../evidence/experiments/e298-grid-operator-audio-live-test.md) and its
  [closed-file check](../../evidence/data/phase9a-operator-audio/closed-file-check.json)
  identify the saved project, backup, preset, and verified hashes. Keep the
  existing `grid-probe` track unchanged. The E289 edited project is not a baseline.
- `brain/src/probes/phase9a-grid-read.ts` as the starting driver. It asserts
  the `grid-probe` track name and the 9a preset hash. Those driver checks and
  the extension's fixed-target checks must not be copied into the scratch
  reader. Keep explicit project and owned-target guards.

**Preparation (9b.2).** Add `brain/src/probes/phase9b-grid-survey.ts`
(or a mode on the 9a driver) that takes an output directory and a list of
preset paths. For each preset: create the scratch track if absent, mute it
with `track.setMixer`, insert the preset with `device.insertFile`, point the
owned cursor, read twice, then remove the device (or delete and recreate the
track). Treat a `MAX_WORK` refusal as a recorded result, not a driver
failure. When a capture reports an unknown class or field, run `schema` on
that object once and extend the projection for the rest of the run; note
each addition.

**Sample.** About 12 presets plus the 9a baseline as the control: four Poly
Grid (one with a Sampler or Audio File, one with Steps or a sequencer, one
heavy with knob modulation, one with 30 or more modules), four FX Grid, and
two or three Note Grid. Choose by name and package category; the operator
can suggest presets. Record the chosen paths.

**Record per preset.** Flavour; module and cable counts; (type UUID, name)
pairs; unknown classes and fields; whether knob-modulation connections
appear and under which class and field; whether stateful content appears
and how (inline bytes, reference, opaque); work units, bytes, wire ms,
document ms; cap refusal.

**Also.** Catalog first pass: the union of (type UUID, name) seen across the
sample, the `Library/modules` filename list, and the coverage of one by the
other. Symbol manifest first version from the existing 9a code (no new
symbols expected).

**Acceptance.** A verdict per dimension a–e (same model, extension needed, or
unknown with the reason); the catalog first pass; the manifest; a selected
scope for 9b.3. The scratch track is deleted. The operator's project is
otherwise unchanged. The operator chooses the host project (suggest
`gn-grid-spike` or a new empty project).

**Rigor.** Two reads per preset must agree, with the control and graph checks
above. Writes are limited to scratch track/device setup, muting, and cleanup.
Evidence is the driver's JSON output in `context/evidence/data/phase9b-survey/`
and one E record for the continuation. E300 contains the preflight only.

**Cost note.** The paired 53-node read workflow is about 15 calls and 0.6 s.
A 40-module patch can exceed the 4,096 work cap or the 1 MiB graph cap;
record it. Do not raise a cap without noting the heap effect.

## Session 9b.2 — Scratch reader and survey continuation

**Disposition.** Complete in [E302](../../evidence/experiments/e302-stock-grid-survey.md).
The implementation and original acceptance below remain the session record.

**Source.** [E300](../../evidence/experiments/e300-grid-survey-preflight.md).
The live refusal occurs before document work:
`GridProbeHandlers` rejects `engine.used() || engine.unfinished()`.
Its later target check admits only `gn-grid-spike` / `grid-probe` / `Poly Grid`.
A fresh controller alone cannot remove that second restriction.

**Prepared implementation.** [E301](../../evidence/experiments/e301-reusable-grid-survey-reader.md)
adds reusable read sessions under the existing `probe.gridRead` method.
The user authorized a flexible reader for this and later sessions. Reads
accept any explicitly named native device in any project; the batch driver
still owns its scratch tracks. Bind, schema, read, status, and release are
separate from the fixed audio protocol. The host jar, target, epoch,
document-thread, work, and unfinished-task checks remain. A timeout locks
the reader until controller replacement. A completed and released audio
session does not block it. No retired write route is enabled.

Use bounded schema discovery to locate the `module_grid` child on each
flavour. The old child-components index 7 is not a general route. When a
capture exposes an unknown class or field, inspect its schema once and
record the projection addition. Keep the current 32-class projection limit,
4,096-work cap, 1 MiB result cap, and graph limits initially. Record cap
refusals; do not turn them into partial success. If a projection cannot
represent the sample within these bounds, record that limit and plan the
required change from evidence.

The [driver](../../../brain/src/probes/phase9b-grid-survey.ts) uses the public
track tools for creation, muting, and deletion, and guarded
`device.insertFile` for presets. A second cursor verifies insertion. It
checks ownership and selection before writes and records uncertain state
without an automatic write retry. Original track/device/mixer state and
selection are checked at entry and exit. Track structure is also checked
between presets. The fixture scope is at most 32 visible tracks and 32
presets. Ask the operator to select the host project before setup.

**Deployment.** Offline checks pass and `./gradlew copyProbeExtension`
deployed V14 in E301. Defer full controller removal and replacement to the
operator under [AGENTS.md](../../../AGENTS.md). Require the final matching
product in the complete list. Wait for confirmation and run `probe:hello`
before the live survey.

**Inputs and acceptance.** Start with the
[13 candidate paths](../../evidence/data/phase9b-survey/sample-plan.json),
[catalog seed](../../evidence/data/phase9b-survey/catalog-seed.json), and
[symbol manifest](9b-grid-symbol-manifest.md). Replace candidates if their
contents do not cover the intended dimensions. Complete the paired reads,
control/invariant checks, per-preset records, verdicts a–e, catalog coverage,
and cleanup specified above. Add E302 or the next free E number. Define the
9b.3 write scope from those reads. No Grid write probe is part of 9b.2.

**Cost model.** Each native capture keeps the E276 descriptor/projection
limits: 4,096 shared work units, depth 12, 256-element schema/scalar arrays,
and 1 MiB result maximum. Keep the earlier 8 MiB temporary-host-heap planning
allowance per capture; it is not a measured peak or a hard memory limit.
Only weak target references survive release. The driver holds at most two
final graphs for comparison, writes captures to disk, and retains compact
summaries and call metadata. Projection tables stay within 32 classes and
1,024 fields.

Each preset permits at most 64 schema calls and 34 captures, plus bind,
status, and release: at most 101 read-session wire calls. The normal complete
case has two final captures, two route schemas, and one schema per observed
class. Unknown classes and absent projected fields add bounded discovery
captures. At 24 ms per wire turn, 101 calls have a rough 2.4 s transport
floor; document work is additional. E276 semantic captures took
43.599–50.752 ms each on the four-module control.

Fixture stages reuse the public models: one-track create 41 wire calls and
889–935 ms (E258); mute about 10 turns and 268 ms (E257); delete 26–29 calls
and 492–594 ms (E258). Project, track, mixer, and selection reads guard the
fixture stages. The driver adds one guarded preset insertion, at most
80 insertion polls, and two cursor points with at most 40 device-list polls
each. Polls have a 50 ms delay. Entry and exit preservation scans each point
at most 32 visible tracks with the same 40-poll bound. Record actual wire,
document, work, byte, and heap results after replacement. No real-size
performance bound is established yet.

### Reusable read-session use

Point owned cursor 0 at the intended track before bind. Send `probe.gridRead`
with `operation: "bind"` and explicit `project`, UUID `trackId`, `trackName`,
integer `deviceIndex`, and `deviceName`. The names need not be the 9a names.
The bound object must have the `native_device` descriptor. Subsequent schema
and read requests use the same target and returned `epoch`.

`schema` takes a bounded descriptor `path`. `read` takes a `path` and an
explicit `projection`. See the E276 query for their shapes. `status` takes
no target and reports bound/busy/locked/unfinished state. `release` takes the
epoch and drops the binding. Release before another bind. There is no
one-shot allowance. A busy, unfinished, or uncertain native session still
refuses other Grid work. Status remains available for inspection.

From `brain/`, run the batch after the operator chooses the project:

```sh
node --import tsx src/probes/phase9b-grid-survey.ts \
  gn-grid-spike /absolute/new/output \
  ../context/evidence/data/phase9b-survey/sample-plan.json
```

For read-only inspection of an existing target, save the five target fields
above in `target.json`, then run:

```sh
node --import tsx src/probes/phase9b-grid-survey.ts \
  read target.json /absolute/new/output optional-projection-query.json
```

Omit the last argument to use the E276 projection. Both driver modes discover
the `module_grid` path. The low-level session also permits other bounded
native descriptor paths for later research. The batch's control compares the
saved 9a graph after normalizing instance UUIDs and managed IDs. Counts in
the summary cover projected modules and audio cables; schema files retain
omitted fields for analysis. They do not imply complete modulation or
stateful-content coverage.

### E302 catalog follow-up

The first V14 stock captures reached the shared work cap and unsupported
stateful values. Use a separate catalog projection for module membership,
names, and type UUIDs. Do not traverse atoms or report cable counts in this
mode. Two route schemas, two captures, bind, status, and release cost seven
read-session calls per preset. The same host work, byte, and fixture limits
apply. This reduces traversal and adds no host symbol or extension change.
E302 records both passes and their costs. The driver parks both survey
cursors on a preserved track before deletion: two bounded points plus a
track read and a repeated ownership/selection check. A preset without one named
top-level Grid is a target-scope result; record its device bank and clean up.

## Session 9b.2a — Focused reader coverage

**Preparation.** [E303](../../evidence/experiments/e303-focused-grid-reader-preparation.md)
implements and deploys V15.
[E304](../../evidence/experiments/e304-focused-grid-reader-live.md) completes
live acceptance, with the recorded scope limits. The instructions below
describe that session.
Use the [focused sample](../../evidence/data/phase9b-focused/sample-plan.json)
and [query](../../evidence/data/phase9b-focused/focused-query.json) with the
survey driver. Extend mapping/resource projections only from observed schemas.

**Source.** [E302](../../evidence/experiments/e302-stock-grid-survey.md), the
[report](../../evidence/data/phase9b-survey/survey-report.json),
[catalog](../../evidence/data/phase9b-survey/catalog-first-pass.json), and
[schema inventory](../../evidence/data/phase9b-survey/observed-schemas.json).

**Goal.** Read the data needed to verify later writes without traversing
unrelated display or engine state. Keep the reusable V14 session model.

- Add selective relationship schemas: report full counts, but enumerate
  bounded headers only for requested fields. Route discovery must not fail
  because an unrelated `device_contents` relationship exceeds 256 children.
  Keep explicit completeness and truncation information; do not silently
  treat a truncated relation as complete.
- Read one knob-input edge and the relevant source/target mapping fields.
  Inspect 3615, 3616, 11497, and `inport_connection` from E302. Distinguish
  Grid signal inputs from outer Bitwig modulation. Record unknowns directly.
- Read Gates array content and Wavetable resource identity through focused
  projections. Find a confirmed Sampler or Audio File preset if needed for
  coverage. Do not infer that content from Whispering Loops or other names.
- Retry one Poly and one Note schema refusal, plus Grid Multi FX at 31
  modules. Use per-module or other bounded reads if one full graph cannot fit.
  Exclude editor color unless it is needed for the question. Keep two matching
  captures and membership/connection checks for each claimed result.
- Keep catalog UUIDs separate from editable names. Add observed aliases and
  provenance; no canonical-name claim from filename overlap alone.

**Cost and checks.** Before implementation, state the requested schema-header
and traversal bounds. Keep 4,096 work and 1 MiB per capture unless evidence
justifies a change. Measure wire/document time and heap deltas. E302 observed
38 MiB process-heap increases on first discovery, so the earlier 8 MiB figure
is not a supported bound. Add focused offline tests and a small live sample.
Batch extension changes into one build; operator replacement remains required.
Use the chosen project and muted scratch tracks, park cursors before deletion,
and compare preserved state at exit. No native Grid write belongs here.

**Output.** E304 or the next free record for live acceptance, updated catalog/schema evidence,
and a specific 9b.3 write scope with an independent readback path for each
admitted operation. Unknown content or unsupported families can remain limits.

### 9b.2a implementation bounds

Selective schema requests name at most 64 relationship IDs and permit at
most 256 child headers in total. An empty ID list requests counts only.
Every relationship reports its full count, whether headers were requested,
the number returned, and whether those headers are complete. A truncated
requested relationship makes the schema incomplete. Unrequested relationships
do not consume the header budget. Missing or scalar IDs are refused.
Requests without this option keep the V14 schema behavior.

Route discovery requests field 406, then field 173. Focused reads use one
module or atom at a time. Each capture keeps 4,096 shared work units, depth
12, 256 scalar-array entries, 32 projection classes, 1,024 projected fields,
and a 1 MiB response. Path navigation keeps its existing limits. No native
write, subscription, or new pinned member is planned.

The focused driver permits at most 64 modules, 256 atoms per module,
256 schema calls, and 1,024 graph calls per preset. It refuses at these
limits. A pair is two independent document captures. Membership captures
bracket the focused reads; managed IDs join atom references only within the
bound session. Store captures on disk and retain only compact summaries and
the current pair. The maximum read-session call count is 1,283, including
bind, status, and release; the 24 ms wire floor is 30.792 seconds. Typical
call count depends on the observed atoms and is measured in the live run.
Fixture setup and cleanup keep the E302 model.

The result and traversal bounds limit retained capture data. They do not
bound native getter allocations or process heap. Reserve 48 MiB temporary
heap for planning, above E302's observed 38 MiB increase; this is neither
an enforced bound nor a measured peak. Record per-call heap samples and
wire/document times before a performance claim. Retained driver summaries
have a 4 MiB cap, plus the current graphs, catalog, and membership records.

V15 live discovery finds 50 modules in SEMtex and 83 in Stutter Steps.
The first run reaches the 1,024-capture budget on SEMtex and the 4,096-work
budget on the Stutter catalog. Keep both caps and the 64-module scope.
For continuation, select detailed SEMtex reads by observed module index;
still check every module's atom membership. Read catalog entries as paired
single-module captures, before and after the detailed reads. This adds four
schema calls and changes catalog captures from four to four per module.
The 1,024-capture ceiling stays fixed. Stutter remains outside the admitted
module count and is reported as a refusal after route discovery.

## Session 9b.3 — Bounded write probes

**Progress.** [E305](../../evidence/experiments/e305-grid-write-command-preparation.md)
records command tracing. [E306](../../evidence/experiments/e306-bounded-grid-writer-preparation.md)
records the V16 writer, driver, offline checks, and deployment.
[E307](../../evidence/experiments/e307-grid-write-guard-refusal.md) records three
V16 refusals before native entry and clean scratch removal.
[E308](../../evidence/experiments/e308-grid-write-live-and-factory-lock.md) passes
the boolean and mapping cases on V17. The factory read locks after creation.
[E309](../../evidence/experiments/e309-grid-factory-process-recovery.md) records
authorized process recovery.
[E310](../../evidence/experiments/e310-grid-factory-acceptance-and-breadth-close.md)
passes the fresh V18 factory case and all exit checks. Session 9b.3 is complete.
The procedures below retain the implementation and recovery history.

**Source.** [E304](../../evidence/experiments/e304-focused-grid-reader-live.md),
the [focused report](../../evidence/data/phase9b-focused/focused-report.json),
the [final projection](../../evidence/data/phase9b-focused/focused-query-v6.json),
and the [schema inventory](../../evidence/data/phase9b-focused/observed-schemas.json).
Use fresh owned muted scratch tracks in the operator's chosen project.
Keep `grid-probe` unchanged. E310 verifies V18 after operator replacement,
then proves factory disposal, scratch removal, and preserved state.

Trace and validate the native command for each case before live use.
Descriptor IDs identify independent reads; they do not identify safe setters.
Keep input/domain validation, ownership, selection, freshness, the native
write lock, and the uncertain-state latch. A timeout or uncertain write
requires inspection and must not trigger an automatic write retry.

| Case | Target and operation | Independent readback required |
|---|---|---|
| Non-decimal value | WT Parkour, Gates module 9, type `8d644ad7-8d77-4f05-a36e-04a57f719635`; `Use Device Phase`, atom 7, preset identifier `DEVICE_PHASE`. Change stored boolean false to true, then restore. | A fresh descriptor capture reads boolean field 210. Paired membership and unrelated values must agree. The current 9a double setter is not authority for a boolean command. |
| Grid knob mapping | SEMtex, Modulator Out module 13/source atom 1 to Lowpass module 24/decimal atom 0. Remove and restore this one existing mapping after the native mapping command is proved. | Source 3616 and target 3615 must agree with mapping source 3635 and destination reference 3739 → atom 65. Restore amount 3611, enabled 11481, transfer 11338, and the observed flags. Preserve auxiliary mappings 11497 and the input route 6194 → 614 → 248/249. |
| Stateful factory | Create one Gates module with the observed type UUID. Check detached defaults, then attach and remove it only if the existing lifecycle guards apply. | Use a separate fresh read after each command. Verify type, fresh instance UUID, exact membership, array 6609/size 6613, stored parameter values, and affected connections. A factory return or writer capture is not independent readback. |

The mapping source type is `098ad9c6-b4c9-4ec1-887f-eaf588611056`.
The target type is `2ddd3d4f-04b9-4ad5-a6f7-08e01df14c0f`. Re-resolve every
instance, atom, and mapping in the new session. E304's managed IDs must not
be reused. Module indices and editable names are route checks, not canonical
type identifiers. The observed mapping amount is 129 in native units;
do not reinterpret it as a percentage.

Resource loading, outer Bitwig modulation, FX/Note writes, Sampler/Audio File,
and patches above the 64-module scope are not admitted by E304. Unknown
content can remain a recorded limit. An engine-active listening check,
if required by the write results, belongs to 9b.3a.

**Cost and acceptance.** Read the performance ledger before implementation.
Budget the actual native command stages and focused readbacks. E304's
31-module reader used 782 read-session calls; a write probe should select
the required fields and preserved state explicitly within the same work,
result, and driver caps. Measure each changed path and explain any comparable
regression over 20 percent. End with no owned scratch object, matching
preserved state, and a released reader/writer. Record each case as passed,
refused, or unknown, plus the reason, in E305 or the next free record.

### Writer implementation after E305

Continue 9b.3 with the
[command trace](../../evidence/data/phase9b-writes/command-trace.md) and
[metadata resolver](../../../extension/src/main/java/com/ghostnote/extension/GridBreadthCommands.java).
E306 connects the resolver to private research handlers. These requirements
apply to implementation and live acceptance:

1. Add an owned scratch writer protocol. Reuse the survey target and epoch
   guards. Exclude the survey, audio runner, and other native writers while
   a command or its readback is pending. A timeout or failed readback keeps
   the write lock. Retain bounded read-only inspection after uncertainty.
2. Admit only the selected typed targets. Validate a fresh descriptor
   baseline, current project, ownership, selection, and command domain
   immediately before each command. Require paired independent reads after
   it. The old fixed-fixture write routes remain retired.
3. For the mapping, prove one source/target match and that 129 is inside the
   native domain before removal. Restore enabled, transfer, auxiliary flags,
   and polyphonic state. Permit new identity only for the selected mapping
   and its destination reference. The native command appends; preserve the
   relative order and identities of every other mapping. Do not normalize
   arbitrary managed IDs or unrelated list order.
4. Separate factory creation, detached descriptor reads, disposal, and
   disposal readback into distinct native tasks. Keep at most one owned
   detached tree, with the existing 256-object/depth-12 traversal limits.
   Read type, fresh UUID, array size/data, and stored parameters. Report
   attachment as refused if the existing lifecycle guards do not apply.
   A new general attachment path is outside this conditional probe.
5. Build the foreground driver from the survey fixture workflow. Use new
   muted scratch tracks. Budget all partitions and guards, test state
   transitions and uncertainty, and measure every admitted live path.
   Park both cursors before scratch deletion. Check preserved state and
   the normalized E276 control at exit.

Use E306 or the next free record for implementation or live acceptance.
The conditional 9b.3a listening session stays separate.

### V16 cost model and live continuation

Use the fixed [three-case plan](../../evidence/data/phase9b-writes/write-plan.json)
with [the driver](../../../brain/src/probes/phase9b-grid-writes.ts).
The normal case uses 13 sequential bridge calls: two status calls, one
selection read, bind, six independent reads, two commands, and release.
Nine calls queue document tasks. Each command also takes a fresh descriptor
snapshot before native entry. All three cases total 39 protocol/guard calls,
27 document tasks, six native commands, and 24 snapshots. At the E246
24 ms primitive cost, 39 calls have a 936 ms wire floor. This excludes
fixture work, cold metadata resolution, native work, and both control reads.

One snapshot admits 64 modules, 256 children per relationship, 32 runtime
classes, 4,096 descriptor work units, and one second of descriptor traversal.
Selected modules get stored-value and connection reads; other modules get
identity, type, name, and position. No full-patch parameter claim follows.
One result is below 1 MiB, with 4 KiB reserved for its wrapper. Scalar text
has a cumulative 512 Ki-character cap. Route discovery has a separate
4,096-work/one-second cap. Each command checks the route again before entry.
Membership witnesses visit at most 64 modules. Atom ownership checks cover
only the selected modules and share the snapshot's child/work caps.

The factory retains one detached tree, at most 256 objects and depth 12.
The normal factory case uses five bounded ownership traversals. Creation,
paired reads, disposal, and paired disposal reads use separate tasks.
No attachment runs. A request times out after five seconds. Native work can
continue after timeout; the lock remains. Native entry requires the
four-second deadline and the current target/selection guards. The session
expires after 15 minutes. Uncertainty admits at most two read-only inspections.
It never admits a repeated command or automatic fixture deletion.

Fixture setup and cleanup retain the E302 public-path model and polling
limits: 80 insertion polls, 40 polls per cursor point, and 32 preserved
tracks. Both cursors park before deletion. Two unchanged semantic control
reads compare the preserved Grid with E276; each keeps the 101-call maximum.
The driver writes captures to disk. It retains bounded snapshots and call
metadata. Keep the 48 MiB temporary-host planning allowance; it is not an
enforced or measured peak.

After operator replacement, run `npm run probe:hello` in `brain/`. Require
`phase-8-probe-v1`, 118 methods, hash `2e939035ea90b8b0`, a fresh initialization,
and marker `9b-grid-writes-v17`. Check competing drivers and clients.
Then run one foreground chain:

```sh
node --import tsx src/probes/phase9b-grid-writes.ts gn-grid-spike /absolute/new/output-directory
```

Record queue, document, command, snapshot, wire, result-size, and heap samples.
Compare the unchanged control reads with E276/E304. Compare changed reads
only when their scope is comparable. No product call budget changed.
Record passed, refused, or unknown for each case in the next free E record.
Close 9b.3 only after cleanup and preserved-state checks pass.

### V17 guard correction after E307

The controller proxy returns the `Svr` project root. The edit lookup returns
its `cZl` wrapper. V16 compared these distinct types and refused every case
before native entry. V17 compares the Grid's edit wrapper with the wrapper
looked up from the project root. It reads journal/replay state on the edit
wrapper and engine state on the project root. It preserves both identities.
Regression checks cover different/null wrappers and native receiver types.

The change adds one existing, read-only `cZl.ffA(ikl)` lookup per snapshot,
including an inspection. It adds no bridge call or command stage. The full
three-case model adds 24 root lookups. All traversal/result caps stay fixed.
No new obfuscated member is used. Live cost and command acceptance need V17.

E307's unchanged control has the same 1,606 query and 278 graph work units
as E304. First capture wire times rise to 77.758/78.174 ms; second captures
take 47.881/47.982 ms. Document times are also higher. The cause is not proved.
Keep this as a performance limit. Use the already planned V17 control pairs
to remeasure the path; do not add write repetitions for timing.

### V18 recovery after E308

**Complete in E310.** The operator confirms replacement; fresh V18 hello,
factory creation/defaults/disposal, scratch cleanup, and preserved-state
checks pass. The following procedure records the recovery boundary.

Read
[E308](../../evidence/experiments/e308-grid-write-live-and-factory-lock.md) and
its final status. Boolean and mapping cases passed; do not repeat them.
The factory command returned, but the detached reader rejected duplicate
managed IDs. E308 used both read-only inspections and retained the lock and
scratch with 236 undisposed objects. No disposal or attachment ran.
[E309](../../evidence/experiments/e309-grid-factory-process-recovery.md) now
proves full process exit and recovery. The old scratch is absent.

1. **Complete in E309.** The operator confirms that the project is only for
   this work and authorizes recovery without saving. The agent selects No
   at the named project save prompt, verifies process exit, restarts Bitwig,
   and opens the saved project. The old scratch is absent.
2. **Process exit and restart complete in E309.** PID 14292 is gone; the new
   bridge PID is 24537. V18 loads at `2026-10-20T20:03:41.731Z`. The saved
   project has no old scratch, and reader and writer are unlocked. The operator
   has been asked to fully remove the controller
   and choose the final matching `ghostnote probe` product in the complete
   list. A toggle or earlier duplicate can load cached classes. The orange
   arrow adds detected controllers; it does not reload the extension.
3. After confirmation, run `npm run probe:hello`. Require V18 on both direct
   handlers, fresh initialization after the V18 deployment, profile
   `phase-8-probe-v1`, 118 methods, and hash `2e939035ea90b8b0`. Check the new
   process, project, selection, and competing clients. Do not reuse a claim
   or managed native ID. Process exit ends the old in-memory object lifetime;
   it does not prove the skipped native disposal command.
4. Re-establish ownership of any retained scratch from fresh observations:
   channel `b8077f74-8e28-4394-a3b3-ffb654b7ba22`, exact recorded name,
   muted mixer, and one Poly Grid from WT Parkour. Reconcile the preserved
   tracks with the E308 entry snapshot. If the operator reopens the saved
   project without scratch, prove its absence. Park both survey cursors on
   `grid-probe` before deleting a retained, newly verified scratch track.
   Capture the unchanged semantic control before the new factory run.
5. Run one foreground factory-only chain with a new output directory:

   ```sh
   node --import tsx src/probes/phase9b-grid-writes.ts gn-grid-spike /absolute/new/output-directory factory-only
   ```

   This uses the fixed [factory-only plan](../../evidence/data/phase9b-writes/factory-only-plan.json).
   It creates a fresh muted fixture and a new detached object. It cannot
   continue the old locked claim. Keep independent read pairs and ownership,
   freshness, selection, write-lock, and uncertain-state guards. No attachment.
6. Measure the changed detached projection. Require paired defaults, disposal,
   paired disposal readback, release, scratch removal, full preserved-state
   comparison, and the final E276 control pair. Record recovery and the new
   factory verdict in a new E record. Only then close 9b.3 and start 9b.4.

V18 uses ownership-order identities only for the detached tree. Its map has
at most 256 entries; construction consumes the existing descriptor work and
time budgets. It replaces detached field-14 reads, adds no bridge call or
document task, and retains every other bound. The factory-only normal case
uses 13 protocol/guard calls, nine document tasks, two commands, and eight
snapshots, plus the existing fixture and control workflow. Keep the 48 MiB
planning allowance. Do not repeat a write for timing.

V18 also uses runtime marker methods. Archive checks reject copied version
labels in Core, survey, and probe consumers. Hello checks both direct handler
markers with two read-only calls. The driver reuses its existing status calls.
Descriptions remain v52. The conditional 9b.3a listening session is not needed
for the stored-state verdicts; no audible-behavior claim follows.

## Session 9b.4 — Offline resolvers

**Disposition.** Complete in [E311](../../evidence/experiments/e311-grid-offline-resolvers.md).
The requirements below remain the acceptance criteria for this session.

**Source.** Start with the [symbol manifest](9b-grid-symbol-manifest.md),
[E310 breadth disposition](../../evidence/experiments/e310-grid-factory-acceptance-and-breadth-close.md#breadth-disposition-and-limits),
and the [E305 command trace](../../evidence/data/phase9b-writes/command-trace.md).
Use the pinned implementations as the expected result:
`GridReadSymbols`, `GridWriteSymbols`, `GridFactorySymbols`,
`GridAttachmentSymbols`, `GridEngineSymbols`, `GridBreadthCommands`, and
`GridBreadthWitness`. The E307 receiver distinction and E308 detached identity
scope remain required invariants. All work in this session is offline.

1. Derive a shape resolver for every manifest row and type dependency. Read
   the local 6.0.6 jar as data. Enumerate default-package classes, including
   `a` and `llL`; do not infer a package or choose by enumeration order.
2. Keep candidate discovery separate from validation. Require the expected
   signatures, inheritance, descriptor or operation invariants, and receiver
   roles. Reject missing or ambiguous candidates. Pinned names are the test
   oracle, not the discovery algorithm. Do not initialize vendor classes or
   run a native edit to make an offline test pass.
3. Add fake-host tests for missing, ambiguous, inherited, and wrong-receiver
   candidates. Compare the complete resolved table with the hand-pinned
   6.0.6 manifest. Identify each invariant that needs the explicit 9b.5 live
   doctor; an offline shape match does not grant write authority.
4. Before implementation, record the bounded scan cost and memory model in
   the performance ledger. Measure jar enumeration, candidate search, and
   validation separately on 6.0.6. Report jar fingerprint, entry/class counts,
   elapsed time, and memory limits. No bridge calls or live project changes
   belong to this session.
5. Record results and exact unresolved limits in a new E record, update the
   manifest and 9b.5 inputs, and stage the session changes without a commit.
   Acceptance requires the exact pinned table, focused failure tests, and
   measured scan cost. Do not claim cross-build acceptance from 6.0.6 alone.

The operator preserves 6.0.6 before the 6.1.x update. The
[general audit](9b-update-audit.md) prepares checks before the update and
runs them on the new version. It is not a prerequisite for this offline session.
The existing 9b.5/9b.6 doctor and step-3 build-out plan own the broader live
scope. Carry E310's unproved resource, outer-modulator, attachment, flavour,
scale, and non-boolean-write limits into that planning.

## Session 9b.5 — Live doctor on 6.0.6

**Disposition.** Complete in
[E316](../../evidence/experiments/e316-grid-doctor-606-acceptance.md): all
76 V20 role checks, both Undo stages, final counters, and teardown pass.
The research cache is written only after baseline verification. E313–E315
record the failed V19 attempt, recovery, and corrected document Undo path.

**Source.** Read [E311](../../evidence/experiments/e311-grid-offline-resolvers.md),
the [resolved table and live-invariant list](../../evidence/data/phase9b-resolvers/report.json),
the [resolver instructions](../../../brain/src/probes/grid_symbols/README.md),
the symbol manifest, E310, and the performance ledger. This session owns
live integration. The Python resolver is an offline prototype; it has no
bridge entry point and creates no accepted-build cache.

1. Integrate the resolved role table with the doctor. Bind it to the exact
   jar fingerprint. Keep discovery separate from live validation. Refuse a
   missing, ambiguous, changed, or unvalidated role. Preserve the project
   root/edit-document distinction. Use owned-tree IDs for detached objects.
2. Define the doctor call, traversal, wait, and memory budgets before adding
   the live path. Include scan time and result transfer. The E311 sample is
   not a cold-disk or stable latency bound. Keep public descriptions and all
   tool consumers accurate if this session changes a public tool.
3. Prepare a bounded scratch-track doctor and obtain explicit operator
   consent before its live writes. Consent must state: save first; a failed
   check can need a Bitwig restart. Allow one pass per fingerprint. Record
   engine state; do not require it. Do not retry an uncertain command.
4. Test the read sentinel, value, cable, detached factory, attachment/undo,
   and delete/undo stages. Resolve and test the edit counters last, with the
   throwaway edit and transaction trace. Check every manifest live invariant,
   including helper roles and connection identity. Do not infer identity
   from an idle zero or a non-null helper alone.
5. Preserve selection and unrelated state. Require independent readback,
   clean up owned scratch objects, and verify the agreed baseline. Write an
   accepted-build cache only after every required stage and teardown pass.
   Record measurements and limits in a new E record.

Controller replacement remains an operator action. Follow the repository
reload and hello checks if the extension changes. Do not reuse E310 claims.
No new live pass was run in 9b.4. Retain E310's resource, outer-modulator,
Gates-attachment, flavour, scale, and non-boolean-write limits for step 3.

Session 9b.6 owns the 6.1.x test after the operator's general update audit.
If a structural selector refuses the new build, inspect the changed shape
and record the new trace before changing the selector. Never regenerate
selectors from guessed obfuscated names as a fallback. Step 2 stays open
until the explicit two-build doctor result is recorded.


### 9b.5 continuation — Operator-gated live pass

Sources: [E312](../../evidence/experiments/e312-grid-doctor-preparation.md),
[E313](../../evidence/experiments/e313-grid-doctor-undo-failure.md), and the
[driver instructions](../../../brain/src/probes/grid_doctor/README.md).

The operator confirmed replacement and consented to the full scratch pass.
The hello check verifies V19, a fresh initialization, and all expected
markers. Boolean and mapping checks pass and their scratch tracks are
removed. Eight core commands pass paired readback. The next command,
`undo-delete`, throws in the native journal. Attachment and the final
edit-counter trace are not reached. The doctor remains bound and locked.
The muted core scratch track remains. No accepted cache exists, and the
complete exit baseline is not verified. E313 records the partial results,
measurements, failure inspection, and final read-only state.

### Session 9b.5a — Recover and trace the Undo caller

**Source.** Read E313, its failure trace and final state, E312, the symbol
manifest, the performance ledger, and the doctor implementation. This is
recovery and a corrected command-contract investigation. It does not
permit another V19 doctor attempt.

Preparation is complete in
[E315](../../evidence/experiments/e315-grid-doctor-document-undo.md). V20
uses document Undo and passes offline checks. Its archive is deployed; no
V20 live pass runs. Continue with 9b.5b below. Recovery steps 1 and 2 pass in
[E314](../../evidence/experiments/e314-grid-doctor-recovery.md). The scratch
track is gone. Both preserved-state snapshots match E313 entry and E310;
the control pair matches normalized E276. All probe claims are unbound and
unlocked. Keep the attempt record. Do not repeat the recovery procedure
without a new reason.

1. Have the operator restart Bitwig and reopen the saved `gn-grid-spike`
   project without saving the failed scratch state. Do not run Undo, delete
   the uncertain scratch, release its claim, or reset the latch. Keep the
   attempt record and all E313 evidence. Controller replacement remains an
   operator action if required. Run `npm run probe:hello` after restart.
2. Check the project, selection, tracks, mixer, device banks, and both
   independent control reads. Compare with the E313 entry/E310 baseline.
   Verify that no scratch track remains and no writer is bound or locked.
   Do not infer restoration from a successful restart. Record any saved
   project difference before a write. Claims from the failed pass do not
   transfer.
3. Trace the supported caller of `daR.wi2()` offline. Follow the recording
   edit, begin/end, replay, exception, and cleanup paths. E313 shows that
   the head and availability predicate alone do not establish the required
   context. Do not invent a wrapper, use global Undo as a fallback, or
   weaken the ownership checks. Change structural selectors only after the
   new trace proves their roles.
4. Implement the corrected bounded command only after the caller contract
   is complete. Add failure tests for missing recording context and replay
   exceptions. Test both delete and attachment Undo admission. Preserve
   exact edit ownership, independent pairs, timeout and uncertainty locks,
   and the complete-pass cache rule. Model any added tasks, calls, waits,
   and allocations before implementation. Account for E313's native timing
   increases; do not repeat uncertain writes for timing.
5. Prepare and verify any changed archive. Record the result in a new E
   record. Define a separate revised live session with its exact scratch
   scope and recovery boundary. A new pass on the same fingerprint needs
   an explicit exception to the one-pass rule and fresh operator consent.
   Preserve the original attempt record; do not delete it to enable a run.
   Keep passed breadth and 9a audio tests out of that scope unless a stated
   acceptance dependency requires them and the operator authorizes them.

Acceptance: independently verified recovery, a complete supported Undo
caller trace or a proved limitation, bounded implementation and focused
checks if feasible, and an explicit plan for any required new live pass.
No 6.0.6 acceptance or 9b.6 transition follows from partial role results.


### Session 9b.5b — Revised V20 live doctor

**Source.** Read [E315](../../evidence/experiments/e315-grid-doctor-document-undo.md),
[E314](../../evidence/experiments/e314-grid-doctor-recovery.md), E313,
the performance ledger, and the
[driver instructions](../../../brain/src/probes/grid_doctor/README.md).
**Disposition.** Complete in
[E316](../../evidence/experiments/e316-grid-doctor-606-acceptance.md).
The operator confirmed replacement and consented to the revised pass.
All three cases and teardown pass. The research cache is written. Keep
both attempt records and do not run this pass again.

1. Obtain operator confirmation of full controller replacement. Require
   full removal and the final matching `ghostnote probe` product in the
   complete list. A toggle or earlier duplicate can load cached classes.
   Run `npm run probe:hello`; require fresh initialization, profile
   `phase-8-probe-v1`, 118 methods, hash `2e939035ea90b8b0`, and marker
   `9b-grid-doctor-v20` on all direct handlers and `rig.info`.
2. Obtain explicit consent for one revised V20 pass on the same fingerprint.
   State save first, the possible restart, and the new boolean and mapping
   checks. This is a specific exception to the original one-pass rule.
   The complete 76-role acceptance uses the fixed three-case plan. Do not
   infer consent from the V19 answer or the implementation request.
3. Check project, target, selection, stopped transport, competing drivers,
   and clients. Keep `grid-probe` unchanged. Run one foreground driver with
   three new muted scratch fixtures in sequence. Preserve the E313 attempt
   bytes. A distinct exclusive V20 attempt record admits only this new pass.
4. Require document-manager identity, exact owned/prior undo heads, idle
   recording and replay state, and paired descriptors for both Undo stages.
   Validate the owned edit-counter transition last. On a native exception,
   retain the latch and fixture; do not clear replay flags or retry. The
   existing bounded inspection and operator-recovery rules still apply.
5. Verify all 76 roles, both final control reads, full preserved-state
   comparison, scratch removal, and clean status before cache creation.
   Record queue, document, wire, traversal, and heap measurements. Compare
   the E313 per-command samples, including its unresolved timing increases.
   Never repeat an uncertain write for timing. Use a new E record for the
   actual outcome, and update the handoff from the measured state.

Acceptance: one complete V20 pass plus teardown, or an exact refusal/failure
record with its recovery plan. Partial results grant no acceptance. The
6.1.x step remains separate and follows the general update audit. Do not
repeat the completed 9a audio flow or unrelated breadth writes.


## Session 9b.6 — Doctor on 6.1.x

**Offline result.** [E331](../../evidence/experiments/e331-grid-doctor-614-resolver-refusal.md)
records 53 missing strict type roles and 76 blocked member roles. The
boolean candidate's ancestor trace shows added fields and methods. No live
attempt or deployment occurs. E332 then traces changed command contracts
in 9b.6a. E333–E337 record the later contract and admission refusals.
[E338](../../evidence/experiments/e338-grid-doctor-614-offline-closeout.md)
closes the offline work under [D52](../../decisions/d52-grid-upgrade-admission-policy.md).
Continue with 9b.6h below for steps 3–5.

**Entry ready.** [E330](../../evidence/experiments/e330-update-audit-614-acceptance.md)
accepts the normal-product audit on 6.1.4 and records the jar fingerprint,
normal deployment, cleanup, and clean save. Start with offline discovery.
This acceptance does not grant native write authority or replace the fresh
scratch consent in step 4.

**Source.** Read [E316](../../evidence/experiments/e316-grid-doctor-606-acceptance.md),
E315's Undo caller trace, the symbol manifest, E311's resolver instructions,
and the performance ledger. Start after the
[general update audit](9b-update-audit.md), with the 6.0.6 install copied
aside. That plan owns parallel offline preparation and the operator update,
then normal-product live checks on 6.1.x. This session is separate
from the completed 6.0.6 pass. It does not authorize an update or another
6.0.6 write.

1. Record the new install, jar fingerprint, API version, and operator audit
   result. Preserve the 6.0.6 evidence, attempt files, and acceptance cache.
   The two installs share the deployed extension path; keep deployments
   separate and require the correct product after controller replacement.
2. Run bounded offline discovery on the new jar. Compare all required roles
   with E315. Record changed symbols and changed logic separately. If a
   selector refuses, trace the changed shape before changing that selector.
   Do not guess obfuscated names or infer live acceptance from a match.
3. Adapt the pinned driver, candidate resources, host-version guard, and
   attempt policy for the new fingerprint. The V20 driver deliberately
   requires 6.0.6 and its specific E313 retry record; do not use it unchanged.
   A new fingerprint gets its own first-attempt record. It cannot reuse the
   6.0.6 cache or reset an old attempt. Keep complete-pass cache admission,
   fixed scratch ownership, paired readback, selection protection, and the
   uncertain-state latch. Model and test any changed host work first.
4. Prepare the new probe, pass focused offline checks, and defer controller
   replacement to the operator. Run hello after confirmation. Obtain fresh
   scratch consent: save first; failure can require restart. Admit one pass
   for the new fingerprint. Keep the existing control unchanged.
5. Run the required role checks and teardown. Record engine state without
   requiring it. Validate edit counters last. Compare per-call costs with
   E316, including its unresolved mapping and factory timing increases.
   Repeat no uncertain command. Write a cache only after every role and
   baseline check passes. Record a new E result and the exact final state.

Acceptance: a complete new-build doctor result, or a traced and measured
reason it cannot pass. Close step 2 only with the explicit two-build result.
Product cache enforcement and public tool descriptions remain in 9b.7.


### Session 9b.6a — Resolve changed 6.1.4 structure

**Result.** [E332](../../evidence/experiments/e332-grid-doctor-614-command-contracts.md)
records a specific traced refusal. The shared local comparator matches the
Undo caller subset but refuses changed relationship hooks, a disposal tail
call, and recording-edit access. It is not the complete reusable resolver.
No probe is prepared. Session 9b.6b below carries forward all incomplete
criteria from this brief.

**Source.** [E331](../../evidence/experiments/e331-grid-doctor-614-resolver-refusal.md),
its [diagnosis](../../evidence/data/phase9b-doctor/614-preparation/diagnosis.json),
E311's resolver rules, E315's caller trace, and E316's acceptance limits.
The 6.1.4 normal-product audit remains accepted in E330.

**Reusable resolution.** Build a reusable method for future updates. Use
6.0.6 and 6.1.4 as test cases for the same resolution procedure. Replacing
the 6.0.6 hashes with 6.1.4 hashes alone does not meet this goal.

Identify each role from the evidence needed for that role: signatures,
inheritance, descriptor IDs, caller relationships, and bounded command
traces. Limit each selector's dependencies to those needed to distinguish
the role and check its contract. An unrelated field or method addition must
not invalidate the role solely because a whole-class hash changes. Retain
enough evidence to refuse missing, ambiguous, or incompatible candidates.

This method need not resolve every future build automatically. If a required
relationship or command behavior changes, refuse and require a new trace.
A structural match still requires the consent-gated live doctor before
acceptance is cached for that exact build fingerprint. Product enforcement
of that cache remains in 9b.7.

**Work.** Establish the new type identities from structural relationships,
stable entry points, descriptor contracts, and bounded code traces. The
35 unique shallow hypotheses are investigation inputs only. Resolve the
14 missing shallow types and six ambiguous pools without a name or position
fallback. In particular, trace object/context, project root, edit document,
journal, and recording/replay ownership. Explain added members separately
from changed command bodies. Retrace the complete document Undo caller and
its relationship hooks on 6.1.4; E315 is not a new-build proof.

Preserve the E311/E315 selectors and all old evidence. Record each changed
selector's evidence before revising the rules. Keep the shared resolution
procedure separate from any required build-specific rule variants. Each
variant needs a traced contract difference; a changed build number or hash
alone is not a reason to add one. Keep the missing/ambiguous refusal behavior.
Test added members and changed reference types as well as full renaming and
enumeration changes. Require all 55 type roles and 76 member roles,
signatures, receiver relationships, and operation
edges to validate. Compare the complete table with E315. A partial table
cannot be bundled for live use. Model any added scan work before implementation.

After complete offline resolution, perform 9b.6 steps 3–4: adapt the driver,
candidate resources, exact jar/host guard, deliberate build marker, and a
new-fingerprint first-attempt record. Test wrong-build cache refusal,
duplicate attempts, old-record preservation, incomplete-role refusal, and
uncertain-write retention. Keep paired independent readback, fixed scratch
ownership, selection guards, and complete-pass cache admission. Preserve
all 6.0.6 attempt and cache bytes. A changed host path needs a revised cost
model; otherwise cite the E315/E316 model.

Build and deploy only after the offline checks pass. Ask the operator to
fully remove the controller and select the final matching `ghostnote probe`
product in the complete list. Wait for confirmation, then run hello and
check the fresh initialization, profile, method count/hash, and markers.
Obtain fresh save-first scratch consent with the possible-restart warning
before 9b.6 step 5. Recheck the project, target, selection, and competing
clients. The current project was last verified as `gn-upgrade-audit`; the
fixed doctor expects `gn-grid-spike`. Do not infer a project switch or consent.

**Resilience checks.** Test the shared procedure on both jars as data. Do not
repeat the accepted 6.0.6 live doctor. Add inert-model tests that show:

- Renaming and enumeration changes preserve the resolved roles.
- Unrelated added fields and methods preserve the resolved roles, including
  additions to referenced types that do not change a required contract.
- Changes to required signatures, receiver relationships, operation edges,
  or command traces cause refusal until supported by new evidence.
- Missing candidates and duplicate candidates cause refusal. A weaker
  fallback cannot turn an ambiguous result into acceptance.

Require complete resolution of all 55 type roles and 76 member roles on both
jars through the shared procedure. Record which contracts are shared, which
need traced variants, and which future changes still require investigation.
Two passing builds and these tests establish only the tested resilience.
They do not establish support for all future updates.

**Acceptance.** A reusable resolver that passes the resilience checks, a
complete traced candidate table, and a tested probe ready for operator
replacement, or a specific traced refusal with the next work
planned from that result. A ready probe is not live acceptance. The live
role checks, teardown, E316 timing comparison, and two-build result remain
requirements of 9b.6. Public cache enforcement remains in 9b.7.

### Session 9b.6b — Trace new ownership and disposal contracts

**Result.** [E333](../../evidence/experiments/e333-grid-doctor-614-ownership-admission.md)
records a measured refusal. The trace covers all direct set consumers,
object/edit helpers, cleanup bootstraps, tracking mode writers, and direct
tracking callers in the jar. Document history and the global tracking queue
have no admitted scratch bound. No rule variant or probe is prepared. The
complete resolver and live doctor remain incomplete. Continue with 9b.6c.

**Source.** [E332](../../evidence/experiments/e332-grid-doctor-614-command-contracts.md),
its [migration trace](../../evidence/data/phase9b-doctor/614-structural/migration.json),
the [6.0.6 subset control](../../evidence/data/phase9b-doctor/614-structural/source-control.json),
E331's complete type census, and the 9b.6a criteria above. Keep all prior
evidence and original selectors unchanged. The last live state remains E330.

1. Trace producers, consumers, and cleanup for the new document-owned set
   `dfI.dnz` and object/edit helpers reached by `dfL` insertion and removal.
   Establish their behavior during ordinary edits, document replay, and
   exceptions. Keep the journal identity, recording edit, replay-head,
   owned-head, and selection checks. The recording getter has the same body
   with changed access. Record that contract difference before adding a rule
   variant. Do not infer safety from the unchanged outer Undo body.
2. Trace the new disposal tracking mode and its callers. The enabled
   `thz.cfM(Object)` branch uses a monitor, drains a global reference queue,
   and allocates a reference for each disposed object. Establish a bounded
   admission and cost model, or refuse the path. Do not assume the mode is
   disabled, change its flag, or initialize classes during offline discovery.
3. Complete the shared role resolver under all 9b.6a criteria. E332's local
   comparator is a component, not a type or member table. It provides eight
   type trace inputs; the other 47 still require investigation. Resolve all
   55 types and 76 members on both jars. Use descriptor contracts, required
   signatures, receiver relationships, and operation edges. Retain strict
   refusal for missing, ambiguous, and incompatible candidates. Trace any
   required dynamic-call bootstrap before adding support. Separate local
   changes from class additions. Record evidence before any rule revision.
4. Run the full resilience suite on both jars and inert models. Test complete
   renaming and enumeration changes; unrelated additions on receivers and
   referenced types; and refusal for changed required signatures, receivers,
   operation edges, command traces, missing roles, and duplicates. The local
   E332 tests do not replace these complete-table tests.
5. Only after a complete table and the changed cost model pass, perform
   9b.6 steps 3–4. Prepare and test the new driver, resources, exact host/jar
   guard, build marker, and first-attempt policy. Preserve old attempt/cache
   bytes and test wrong-build, duplicate, incomplete-role, and uncertain-write
   refusal. Deploy only a complete tested probe. Controller replacement is
   an operator action; wait for confirmation before hello. Fresh save-first
   scratch consent and the fixed project are still required for live work.

**Acceptance.** A complete reusable resolver and tested probe ready for
operator replacement, or a specific measured refusal with its next work
planned. E332 does not grant new-build or product write authority. The live
doctor, cleanup, per-call comparison with E316, and explicit two-build result
remain in 9b.6. Product cache enforcement remains in 9b.7.

### Session 9b.6c — Establish bounded admission and complete resolution

**Result.** [E334](../../evidence/experiments/e334-grid-doctor-614-admission-boundaries.md)
records a specific measured refusal. The ancestor walk and parent getter
census cover 2,818 concrete object classes. Debug tracking commands use the
application event queue. History limits and command non-reentrancy remain
unproved. No complete table or probe exists. Continue with 9b.6d below.

**Source.** [E333](../../evidence/experiments/e333-grid-doctor-614-ownership-admission.md),
its [trace](../../evidence/data/phase9b-doctor/614-ownership/trace.json),
E332's command comparison, E331's complete census, E315/E316, the symbol
manifest, and the performance ledger. Preserve all old selectors, traces,
attempts, and cache bytes. E330 remains the last verified live state.

1. Establish a bounded admission for the changed paths before probe
   preparation. The ownership model must cover document set `dfI.dnz`,
   list `Z1C`, pending helper `dEI`, helper object sets, and ancestor walks.
   Trace the inherited `LaE` contract and required virtual receivers. Prove
   the relevant descriptor flags for the fixed fixture. Distinguish normal
   edits, replay, and failures. Do not infer an empty document history from
   a small scratch tree or use constructor capacity as a size limit.
2. Establish disposal mode stability across a native command, or refuse.
   E333 traces the debug enable/disable callers, other tracking producers,
   global monitor, queue drain, and allocation. A single false flag read
   does not prove stability. Do not change the mode, drain the queue, or
   acquire a new vendor monitor as a workaround. Any proposed synchronization
   needs a traced lock-order and exception contract before implementation.
   The tracker report itself drains and allocates; it is not a bounded
   admission read. Keep the uncertain-state latch and independent readback.
3. Complete the shared resolver under every 9b.6a criterion. Resolve all
   55 type roles and 76 member roles on both jars with descriptor contracts,
   required signatures, receiver relationships, and operation edges. Trace
   before adding any build variant. E333 retains bootstrap evidence but
   adds no dynamic-call equivalence rule. Keep E332's strict comparator
   until the required bootstrap contracts are validated. Missing, ambiguous,
   or incompatible candidates must refuse. A partial table cannot be bundled.
4. Run the complete-table resilience suite on both jars and inert models.
   Require full renaming and enumeration independence; unrelated additions
   on receivers and referenced types; and refusal for changed required
   signatures, receivers, operation edges, command bodies, missing roles,
   and duplicates. The E333 diagnostic tests do not replace these checks.
5. Only after complete resolution and bounded admission pass, perform
   9b.6 steps 3–4. Adapt the driver, candidate resources, exact host/jar
   guard, build marker, and new-fingerprint first-attempt record. Test
   wrong-build caches, duplicate attempts, incomplete roles, uncertain-write
   retention, and preservation of all 6.0.6 records. Keep journal identity,
   recording-edit, replay-head, owned-head, freshness, and selection guards.
6. Deploy only the complete tested probe. The operator must fully remove
   the controller and select the final matching `ghostnote probe` product
   in the complete list. Wait for confirmation before hello. Check the
   fresh initialization, profile, method count/hash, and markers. Obtain
   fresh save-first scratch consent with the restart warning. Verify the
   fixed `gn-grid-spike` project, target, selection, and competing clients.
   Do not infer a switch from the last `gn-upgrade-audit` state. Do not repeat
   the accepted 6.0.6 live doctor or the 9a audio flow.

**Acceptance.** A complete reusable resolver and tested probe ready for
operator replacement, or a specific measured refusal with the next work
planned. No live check is authorized by a trace or candidate table alone.
The 6.1.4 live role checks, complete cleanup, E316 per-call timing comparison,
and explicit two-build result still belong to 9b.6. Step 2 stays open until
that result passes. Product cache enforcement remains in 9b.7.


### Session 9b.6d — Complete receiver contracts and admission

**Result.** [E335](../../evidence/experiments/e335-grid-doctor-614-receiver-dispatch.md)
records a measured refusal. The receiver census finds a flag-test override
and ancestor-step allocation. The event trace finds a round-trip pump and
two waiting paths. Fixed-command exclusion and history growth remain
unproved. The complete resolver and probe remain incomplete. Continue with
9b.6e below.

**Source.** [E334](../../evidence/experiments/e334-grid-doctor-614-admission-boundaries.md),
its [trace](../../evidence/data/phase9b-doctor/614-admission/trace.json) and
[explicit investigation plan](../../evidence/data/phase9b-doctor/614-admission/trace-plan.json),
E333's retained-history trace, E332's command comparison, E331's complete
census, and the unchanged 9b.6a/9b.6c criteria above. All old selectors,
attempts, caches, and evidence remain preservation inputs. E330 is the last
verified live state.

1. Complete the structural role and descriptor contracts as offline work.
   Use the shared resolver on both jars for all 55 types and 76 members.
   Preserve signatures, receiver relationships, operation edges, and strict
   missing/ambiguous/incompatible refusal. Separate added class members from
   changed required bodies. Trace before adding a build variant. Do not
   weaken the comparator for an unchecked dynamic call. E334's names and
   superclass census are investigation inputs, not reusable selectors.
2. Use those contracts to identify the fixed fixture's descriptor flags and
   runtime receiver requirements. Follow `LaE`, all admitted parent getters,
   covariant delegates, the `xmC` assertion dependencies, and the relationship
   ancestor walk. Derive checks for `dnz`, `Z1C`, `dEI`, helper sets, storage
   capacity, and ancestor depth. Include normal edits, replay, cleanup,
   allocation, and failure paths. A size read is not a bound on later growth;
   the fixed command sequence needs a traced maximum. Do not infer an empty
   history or a history bound from 256 scratch objects.
3. Finish the event contract from `ControlSurfaceObject.exec` through
   `sdu.cfM(gGV)`, `Dr2.cfM(gGV)`, the event drain, and runnable execution.
   E334 traces `leaks` registration to `dpN.asyncExec` and the shared app
   singleton. Check native callback paths for nested event dispatch before
   using a disabled-mode read within the same task. Trace all relevant mode
   writers and any proposed exclusion. A shared thread check alone is not
   admission. Do not change the mode, drain the queue, or acquire a new vendor
   monitor. Any synchronization proposal needs lock-order and exception proof.
4. Run every complete-table resilience check from 9b.6a on both jars and
   inert models. Require renaming and enumeration independence, unrelated
   additions on receivers and referenced types, and refusal for changed
   signatures, receivers, operation edges, command traces, missing roles,
   and duplicate candidates. E334's local lookup tests do not satisfy this.
5. Only a complete table and bounded admission can proceed to 9b.6 steps
   3–4. Adapt and test the driver, resources, exact host/jar guard, build
   marker, and new-fingerprint first-attempt record. Test wrong-build caches,
   duplicate attempts, incomplete roles, uncertain-write retention, and exact
   preservation of the 6.0.6 records. Retain independent paired readback,
   fixed ownership, journal/recording/replay/owned-head checks, freshness,
   selection guards, the write lock, and the uncertain-state latch.
6. Deploy only a complete tested probe. Controller replacement remains an
   operator action: full removal, then the final matching `ghostnote probe`
   product in the complete list. Wait for confirmation before hello. Check
   fresh initialization, profile, method count/hash, and markers. Obtain
   fresh save-first scratch consent with the restart warning. Verify the
   fixed project, target, selection, and competing clients. Do not infer a
   switch from `gn-upgrade-audit`. Do not repeat the accepted 6.0.6 live
   doctor or the 9a audio flow.

**Acceptance.** A complete reusable resolver and tested probe ready for
operator replacement, or a specific measured refusal with next work planned.
The new-build live role checks, full teardown, E316 per-call comparison, and
explicit two-build result remain requirements of 9b.6. Step 2 stays open.
Product cache enforcement remains in 9b.7.


### Session 9b.6e — Fixture contracts and command closure

**Result.** [E336](../../evidence/experiments/e336-grid-doctor-614-fixture-contracts.md)
records a measured refusal. The local census covers all 76 members on both
jars. It finds a changed terminal membership getter in addition to E332's
disposal and recording-access changes. The exact empty-array begin route
skips one lock wait; nested command closure and history growth remain
unproved. Complete role bindings and descriptor subtypes remain unresolved.
No complete table, driver, or probe is prepared. Continue with 9b.6f.

**Source.** [E335](../../evidence/experiments/e335-grid-doctor-614-receiver-dispatch.md),
its [trace](../../evidence/data/phase9b-doctor/614-receivers/trace.json) and
[investigation plan](../../evidence/data/phase9b-doctor/614-receivers/trace-plan.json),
E334's parent getter census, E333's history paths, E332's command comparison,
E331's complete role census, and all 9b.6a/9b.6d criteria. E330 remains the
last verified live state. Keep original selectors, evidence, attempts,
caches, the deployed archive, and saved fixtures unchanged.

1. Complete the shared 55-type/76-member role procedure on both jars. Use
   signatures, receiver relationships, descriptor IDs, and operation edges.
   Separate unrelated additions from changed required bodies. Trace every
   required variant before admission. Keep the strict comparator and
   missing, duplicate, ambiguous, and incompatible refusal. Investigation
   names and whole-class replacement hashes cannot serve as selectors.
2. Bind the fixed fixture's descriptor subtypes and parent chains. Account
   for `deX.nVd()` returning true, all `X_()` overrides that the fixture can
   reach, and the `deU.E3()` wrapper allocation. Complete E334's covariant
   parent delegates and `xmC` context dependencies. Keep symbolic declaration
   lookup separate from virtual dispatch. A class census is not a runtime
   fixture receiver proof.
3. Trace each admitted command, replay, disposal, and failure callback to
   exclude or bound the E335 event pumps. Follow `XKG.cfM(Set)` through the
   edit-opening lock-set construction and `cQq.Hnt()` through its request
   caller `AJH.MRY(cQq)`. Bind the actual `Rzi.UNj()` receiver. The empty-set
   callback proof applies only to that exact call; entry lock count zero
   does not prove that every nested call has an empty set. Retain unresolved
   interface, native, reflection, and external edges. Do not infer absence
   from a missing direct caller or acquire a new vendor monitor. Preserve
   E334's mode-writer census and E335's single/batch queue paths.
4. Derive enforceable entry and fixed-sequence growth limits for `dnz`,
   `Z1C`, `dEI`, helper-set entries, storage capacities, and ancestor depth.
   Include wrapper allocation, pending helpers, ordinary recording, replay,
   cleanup, and partial failure. Do not derive these limits from 256 scratch
   objects or from one size read. Keep freshness, selection, journal identity,
   recording/replay/owned-head checks, the write lock, and the uncertainty
   latch. Do not change tracking mode or drain a queue to obtain admission.
5. Run the complete-table resilience suite required by 9b.6a on both jars
   and inert models. Cover full renaming and reordering, unrelated additions
   on receivers and referenced types, and changed signatures, receivers,
   operation edges, command traces, missing roles, and duplicate candidates.
   E335's 23 diagnostic tests do not replace these checks.
6. Only complete resolution and bounded admission can proceed to 9b.6
   steps 3–4. Adapt and test the driver, exact build guard, resources, marker,
   and new-fingerprint first attempt. Test wrong-build caches, duplicate
   attempts, incomplete roles, uncertain-write retention, and exact old
   record preservation. Deploy only a complete tested probe. The operator
   must fully remove the controller and select the final matching
   `ghostnote probe` product from the complete list. Wait for confirmation,
   then run hello and verify profile, method count/hash, fresh initialization,
   and markers. Obtain fresh save-first scratch consent with the restart
   warning, and verify project, target, selection, and competing clients.
   Do not infer a project switch or repeat the accepted 6.0.6 or 9a flows.

**Acceptance.** A complete reusable resolver and bounded, tested probe ready
for operator replacement, or a specific measured refusal with next work
planned. The new-build live role checks, teardown, E316 per-call comparison,
and explicit two-build result remain requirements of 9b.6. Step 2 stays
open. Product cache enforcement remains in 9b.7.

### Session 9b.6f — Role bindings and traced variants

**Result.** [E337](../../evidence/experiments/e337-grid-doctor-614-operation-bindings.md)
records a measured refusal. The shared procedure links 36 executable role
contracts, nine fields, and 25 type inputs on 6.1.4. Seven fields and all
five abstract dispatch contracts remain unbound. The managed-ID supplier
has a second bootstrap and descriptor dependencies. No strict comparator
variant is admitted. No complete table or probe is ready. Continue with 9b.6g.

**Source.** [E336](../../evidence/experiments/e336-grid-doctor-614-fixture-contracts.md),
its [role census and membership routes](../../evidence/data/phase9b-doctor/614-fixtures/role-contracts.json),
[focused trace](../../evidence/data/phase9b-doctor/614-fixtures/trace.json),
[plan](../../evidence/data/phase9b-doctor/614-fixtures/trace-plan.json), and
all 9b.6a/9b.6e criteria. Read E335–E331, E315/E316, the symbol manifest,
and the performance ledger. E330 remains the last verified live state.
Preserve original selectors, diagnostic code and evidence, attempts,
caches, deployed archive, and saved fixtures.

1. Complete the shared 55-type/76-member binding procedure on both jars.
   Use E336's exact method pools as inputs, not accepted roles. Bind the
   16 fields through operation edges and the five abstract methods through
   receiver contracts. Resolve ambiguous bodies without name or order
   fallbacks. Trace the managed-ID bootstrap before any comparator variant.
   Keep incomplete, duplicate, ambiguous, and incompatible refusal.
2. Trace variants for disposal, recording-edit access, and the terminal
   membership getter. Both builds already have a superclass delegate.
   Account for `Collections.EMPTY_LIST` versus `Collections.emptyList()`,
   external-call and initialization costs, and actual receiver dispatch.
   Keep the strict comparator unchanged unless a separate, tested variant
   has explicit evidence. Do not normalize calls and field reads globally.
3. Bind the fixed descriptor IDs, subtypes, parent getters, `X_`, `nVd`, and
   `deU.E3` allocation. Account for the null `dve.ULc` override and the
   inherited parent/context walk. Bind the actual context among the six
   concrete classes; the hierarchy census is not runtime evidence.
4. Complete every fixed command's normal, replay, close, disposal, and
   failure closure. E336 excludes the lock wait only for the exact empty-array
   begin route. Bind other collectors and their ancestor-derived lock sets.
   Trace the `AJH.bLK` → `MRY(cQq)` → `ping` wait path and its command
   reachability. Keep E335's queue and mode-writer evidence. Retain unresolved
   interface, native, reflection, and external edges; do not infer absence.
5. Derive enforceable entry and fixed-sequence growth limits for `dnz`,
   `Z1C`, `dEI`, helper sets, storage, and ancestor depth. Include pending
   helpers, wrappers, ordinary recording, replay, cleanup, and partial
   failure. No limit follows from one size read or 256 scratch objects.
   Do not change tracking mode, drain a queue, or acquire a new vendor monitor.
   Keep all selection, freshness, journal, recording/replay, owned-head,
   write-lock, and uncertain-state guards.
6. Run the full 9b.6a resilience suite against complete tables on both jars
   and inert models. E336's diagnostic tests do not replace that suite.
   Only complete resolution and bounded admission can proceed to the
   9b.6 steps 3–4 driver, exact build guard, resources, marker, and first
   attempt. Retain all wrong-build, duplicate-attempt, incomplete-role,
   uncertain-write, and exact old-record preservation checks.

**Acceptance.** A complete reusable resolver and bounded, tested probe ready
for operator replacement, or a specific measured refusal with next work
planned. Operator replacement, fresh save-first scratch consent, project
and client verification, new-build live role checks, teardown, and E316
per-call comparison remain later gates. Do not repeat the accepted 6.0.6
doctor or 9a audio flow. Step 2 stays open; 9b.7 owns product cache enforcement.


### Session 9b.6g — Descriptor anchors and bootstrap contracts

**Source.** [E337](../../evidence/experiments/e337-grid-doctor-614-operation-bindings.md)
and its [operation and variant report](../../evidence/data/phase9b-doctor/614-bindings/bindings.json).
Read E336–E331, E315/E316, the symbol manifest, and the performance ledger.
Keep the technical and safety criteria from 9b.6a and 9b.6f. The completion
and stop rules below replace their generic "measured refusal with next work
planned" endpoint for this session. Preserve original
selectors, diagnostic code and evidence, attempts, caches, deployed normal
archive, saved fixtures, and the E337 entry inventory. E330 remains the last
verified live state.

**Objective and session boundary.** Complete the remaining offline work in
one sustained session: reusable resolution on both jars, bounded admission,
the resilience tests, and new-build driver and probe preparation. Descriptor
anchors and bootstrap contracts are the starting tasks. Continue through
all seven work items below. A new proof gap, diagnostic refusal, or completed
trace is an intermediate result. Keep actionable offline work in 9b.6g.
Do not create 9b.6h solely to carry that work forward.

**Execution and progress.** Keep one work list in this session plan. At entry,
map each missing role or admission condition to its evidence, dependency,
and next concrete check. Distinguish a diagnostic type input from an accepted
role. Track complete role coverage, closed command paths, enforceable bounds,
and passing integration checks. Counts of tests, traces, or E records alone
do not establish completion.

Work first on dependencies that block several requirements. Reuse the
preserved census and traces when their inputs and contracts are unchanged.
If a check fails, inspect its cause, implement or trace the next justified
step, and continue other independent offline work. Add newly found work to
this same list. If a requirement cannot be met under the current scope,
record the evidence and the effect on the fixed doctor before proposing a
scope change. Do not weaken a guard to obtain a complete table.

Keep intermediate outputs as checkpoints. A context handoff or interruption
continues 9b.6g from that checkpoint; it does not create a new session or
justify another full census. Run focused tests at each changed boundary.
Run the complete resilience and driver suites at their integration gates.
Repeat passed checks only after a relevant change, failure, or unresolved
risk. Use separate processes for large test groups under the existing RSS
limit. Keep one entry inventory and a final preservation check for an
uninterrupted offline session. Recheck inputs after a restart or possible
external change. Write the final E record and handoff at the session outcome;
an intermediate trace does not require a separate E record.

**Work.**

1. Complete the shared 55-type/76-member procedure on both jars. Use E337's
   exact operation links as trace inputs. Supply descriptor or stable entry
   anchors for the 30 unbound type roles, seven fields, four ambiguous
   executable roles, and eleven unbound truncated pools. The seven fields
   are initialization helper, remote helper, selection state, selected
   modules, focus, connected state, and inactive state. Do not enlarge a
   retained sample to infer uniqueness. Require operation edges, access,
   signatures, and lookup receiver relationships for every accepted role.
2. Trace and test explicit bootstrap contracts before adding support.
   Managed ID uses both LambdaMetafactory and StringConcatFactory. Bind the
   implementation handle, method types, recipe, captured receiver, descriptor
   getter, name getter, and assertion/reporting branches. Account for class
   initialization and external calls. Keep unsupported forms refused.
   Do not modify the strict comparator globally to erase dynamic calls.
3. Finish the separate disposal, recording-access, and membership variants.
   The membership terminal changes a field read to an external call. Trace
   the applicable JDK dependency and its initialization assumptions before
   making an equivalence or cost claim. Both builds already have delegates.
   Keep the tracking-mode, queue, failure, and uncertain-state requirements.
4. Bind all five abstract roles through fixed receiver contracts. Bind the
   fixed descriptor IDs, subtypes, parent getters, X_, nVd, and deU.E3 wrapper
   allocation. Account for the null context override and parent/context
   walks. Identify the actual context among the six concrete classes.
   A hierarchy census or operation type input is not runtime evidence.
5. Complete every fixed command's normal, replay, close, disposal, and
   failure closure. Preserve E336's narrow empty-array exclusion. Bind the
   other lock collectors and ancestor-derived sets. Establish reachability
   or exclusion of AJH.bLK → MRY(cQq) → ping and its wait. Keep E335's
   event-pump and mode-writer evidence. Retain unresolved interface, native,
   reflection, dynamic, and external edges; do not infer their absence.
6. Derive enforceable entry and fixed-sequence growth limits for dnz, Z1C,
   dEI, helper sets, storage, ancestor depth, pending helpers, and wrappers.
   Include ordinary recording, replay, cleanup, and partial failure. Keep
   H + S × D. Do not change tracking mode, drain a queue, or acquire a new
   vendor monitor. Preserve all selection, freshness, journal, replay,
   owned-head, write-lock, and uncertain-state guards.
7. Run the complete 9b.6a resilience suite on both complete tables and inert
   models. E337's diagnostic tests do not replace it. Only complete resolution
   and bounded admission permit 9b.6 steps 3–4: new-build driver, exact build
   guard, resources, marker, and first-attempt policy. Retain wrong-build,
   duplicate-attempt, incomplete-role, uncertain-write, and exact old-record
   preservation checks. After those gates pass, finish the driver, resources,
   build guard, first-attempt policy, and probe in this session. Build and
   deploy with `copyProbeExtension`, then request operator replacement under
   the repository procedure. Do not defer ready preparation to another
   session merely because offline resolution has finished.

**Outcome (2026-10-22).** The session ends under its second stop rule.
[E338](../../evidence/experiments/e338-grid-doctor-614-offline-closeout.md)
records complete resolution on both jars and the conditional bounds of
checkpoints 1–17. Offline bounded admission of every command path does not
converge: each closure opened a wider frontier, and cache warmness, pending
state, listener counts, actual document and context classes, and table
capacity are runtime facts. [D52](../../decisions/d52-grid-upgrade-admission-policy.md)
replaces that criterion with guarded runtime admission. The work list below
is closed; its open rows become 9b.6h guards or 9b.7 tooling. The evidence,
checkpoints, and diagnostic modules stay.

**9b.6g work list (closed by E338).** Entry files are recorded in the
[entry inventory](../../evidence/data/phase9b-doctor/614-resolution/entry-inventory.json).
E337 supplies diagnostic inputs only. No role is accepted from a type input.
[Checkpoint 16](../../evidence/data/phase9b-doctor/614-resolution/checkpoint-16/README.md)
records the factory disposal wrappers and conditional tree bounds.
[Checkpoint 17](../../evidence/data/phase9b-doctor/614-resolution/checkpoint-17/README.md)
records the HashMap removal bound, owned collector bounds, factory closure
branch table, command closure cores, and history growth formulas.
The [2026-10-22 agent handoff](9b6g-agent-handoff-2026-10-22.md) records
the user-requested pause, remaining dependencies, and work after checkpoint 16.
Its preservation supplement retains the latest HashMap models and runtime
comparison. It does not establish bounded admission or session completion.
Checkpoint 15 records browsing call exclusions, listener storage, and release hooks.
Checkpoint 14 records resource receiver exclusions and initialized disposal.
Checkpoint 13 records listener maps, JDK lookup costs, and ancestor allocation.
Checkpoint 12 records relationship flags and the ancestor-loop check.
Checkpoint 11 records the generated port descriptors and their invariant costs.
Checkpoint 10 records the instance-read conditions and the root loop check.

| Work | Evidence and dependency | Next check | State |
| --- | --- | --- | --- |
| Boolean, decimal, destination, source, native-device, nitro, and child-object types; value, cable, and boolean commands | E337 inputs plus source anchors | All 55 types and 76 symbolic members validate on both jars. Finish command admission. | Symbolic checks pass |
| Device, position, named, property, domain, project, engine, display, selection, focus, and helper types | Eight source anchors and nine source role witnesses | Both complete renamed models retain all identities and local role contracts with unrelated additions. Finish command-trace integration. | Symbolic checks pass |
| Initialization, remote, selection, selected-modules, focus, connected, and inactive fields | Exact operation witnesses and lookup checks | All 16 fields bind. Retain access, signature, and receiver tests. | Symbolic checks pass |
| Name, UUID, height, and recording ambiguity; eleven truncated pools | Complete counts and concrete value-setter override | All identities bind without selection from retained samples. | Symbolic checks pass |
| Managed ID and both bootstraps | Exact supplier, handles, method types, and concat recipe | Local contracts pass. Check the disabled-assertion guard and external initialization requirements. | Admission active |
| Disposal, recording access, and membership variants | Explicit local variants; bundled JDK class data; checkpoint 17 mode-writer scan | Local contracts pass. The volatile tracking flag has two writers, both reachable only through the `agent_debug` client behind the `testing-features` configuration. The writer stays retained. The old build has no mode. Complete runtime provenance and a task-atomicity or configuration guard. | Admission active |
| Five abstract roles and fixed receiver contracts | 30 captured descriptor pairs, 454 captured properties, 49 combined capture and factory descriptor types, and ten domain descriptor pairs | All captured properties and 1,137 source registrations bind on both jars. The 369 direct invariant reads have 450 matching local contracts. The 53 descriptor getters have 106 matching contracts. Root array-loop costs pass on both real and renamed jars. Aggregate costs cover 780 value properties and one lock under explicit conditions. Finish object invariants, array stability, ancestor flags, and live context guards. Earlier renamed-model checks remain separate from the larger read set. | Active |
| Factory template, hidden children, and disposal targets | Both bundled Amplify files; bounded codec and binary reader; descriptor registry traces; checkpoint 17 collector, HashMap, and factory closure reports | Earlier results stand (see checkpoints 5–16). Checkpoint 17 adds: one HashMap removal costs at most 160 + 29N linked or 719 + 110N + 308H tree instructions under exact-receiver and identity-key conditions; the null-key collector allocates a fresh `ArrayList` and costs at most 550 vendor and 2,291 + 39K JDK instructions on the worst of the 33 receivers; the serialized tree has one managed node, so M = 1 holds for serialized data only; the warm module route hits its UUID cache only after an earlier load in the same process, so the first call in a fresh process is cold and compiles; the compile skip is decidable from the copied Nitro lists; both browsing setters are excluded for the fixed command path; the `b_:Hgx` closure group was refused at the 512-method limit; the clone can wait without a timeout when the calling thread has no scoped queue. Close the cold first-call condition, the refused group, the clone queue wait, the Hgx listener single-object form, and the runtime tree guard. | Active |
| Normal commands, replay, close, disposal, and failure paths | Helper and ping incoming scans; bounded backward index; checkpoint 17 exact-dispatch cores for 13 roots on both jars | No ping, manager push or pop, or manager-switch label is in any core. No fixed command reaches the lock wait: the default collector returns the shared empty static set, three commands pass empty arrays, and delete invalidates before any wait. Replay handler tables match across builds; a replay worker failure hangs the document thread on both builds and is a parity limit. The 6.1.4 validation tail adds one observer notification. Close the frontier edges (listener fire sites, `Runnable` and `Supplier` parameters, `oDc.ng_`, iterators), pending runnables at close, and listener counts. Add the document-manager and project-document class checks to the doctor witness. | Active |
| History, capacity, depth, pending helpers, and wrapper growth | E334 H + S × D; E335 allocation; checkpoint 17 exact dfI/dgJ bodies and inert model | Earlier predicate and ancestor results stand. Checkpoint 17 pins 50 exact 6.1.4 bodies. One history hook costs at most 8 + 64H + 59S + 13N + 12SD vendor instructions; the 13N term is table capacity, which iterator removal never shrinks. Doctor objects with a false relationship predicate add nothing to the helper list, pending slot, or retained set. No true schema predicate lies on the checked parent chain. The global property listener map has 22 monitor entry sites with listener dispatch under the lock; its wait stays open. An entry gate that requires an empty helper list and a null pending helper makes each hook constant; it needs two new edit-document field roles. Close the relationships above `native_device` and the count of final-flag removal events per fixed command. | Active |
| Complete resilience and integration gates | 319 new unit tests; 387 offline tests pass and 30 integration tests skip; six structural mutations and one read-dependency mutation refused | Finish complete command-trace and two-build integrated checks. Rerun earlier field scans that used an owner-only prefilter; a reference can name a subclass. Extend `runtime_dependencies` with `java/util/Collection` and the list helper methods that the history model stubs. Structural tests do not prove bounded admission. | Active |
| Driver, resources, build guard, marker, attempt policy, and deployment | 9b.6 steps 3–4; E315/E316 | Prepare and test only after complete resolution and bounded admission pass. | Gated |
| Runtime entry guards and new roles | Checkpoint 17 reports | Define the new-build roles and witness checks that the offline bounds require: edit-document helper list and pending helper (empty and null), the document-manager equality and project-document class in the witness, a read-only pending-list role, and the pre-disposal owned-tree guard (exact classes, one managed node, node and depth limits). Each adds a host read; model its cost under the ledger before implementation. | Planned |

**Completion and stop rules.** End the offline session at one of these
reviewable outcomes:

- Complete resolution on both jars, bounded and tested admission, and the
  prepared and deployed probe. Report the verification and request full
  operator controller replacement. This is the normal operator boundary.
- A specific external dependency that prevents further required progress.
  First complete the independent offline work. State the missing input,
  unavailable artifact, required runtime observation, or user decision;
  cite the evidence; and identify the exact action that permits continuation.
  An untraced call or unsupported comparator form is not by itself such a
  dependency. Explain why the available offline checks cannot resolve it.
- A demonstrated incompatibility with a required contract or work bound.
  Supply a reproducible result, assess the feasible alternatives, and state
  which requirement or scope decision would have to change. Keep the path
  refused and request that decision. Another partial diagnostic report does
  not meet this condition.

An explicit operator request to stop also ends work. If work is interrupted
for another reason, report it as incomplete and retain a concrete checkpoint
under 9b.6g. Do not mark that checkpoint as accepted completion or copy the
same remaining work into a successor session.

After replacement confirmation, run hello and verify the fresh profile and
markers. Fresh save-first scratch consent, project and client verification,
live role checks, teardown, and E316 per-call comparison remain the 9b.6 live
gates. A need for runtime evidence does not authorize a partial table, native
write, or new probe deployment before its existing preparation gates pass.
Do not repeat the accepted 6.0.6 doctor or the 9a audio flow. Step 2 stays
open until the explicit two-build result; 9b.7 owns product cache enforcement.

### Session 9b.6h — Guarded doctor on 6.1.4

**Source.** [D52](../../decisions/d52-grid-upgrade-admission-policy.md),
[E338](../../evidence/experiments/e338-grid-doctor-614-offline-closeout.md),
[checkpoint 17](../../evidence/data/phase9b-doctor/614-resolution/checkpoint-17/README.md),
[E316](../../evidence/experiments/e316-grid-doctor-606-acceptance.md),
E315, the [symbol manifest](9b-grid-symbol-manifest.md), the
[performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md),
and the 9b.6 steps 3–5 above. Keep the 9b.6 and 9b.6a safety criteria.
E330 remains the last verified live state. The 9b.6g diagnostic modules
under `brain/src/probes/grid_doctor/` are the trace tools for this session.

**Objective.** Prepare, deploy, and run the consent-gated doctor on 6.1.4
under D52: offline resolution, a body-change report, bounded traces of the
changed bodies only, runtime entry guards, and the live self-test with
per-call timing. End at the operator replacement gate, then at the doctor
result. Prefer deterministic offline checks; add a guard where a runtime
fact decides; use fixtures and agent traces where safety needs them.

**Work.**

1. **Body-change report.** Compare the exact bodies of the complete role
   set on 6.0.6 and 6.1.4 with the existing digests and contracts. List
   each body whose logic changed, not only its name. Known changes: the
   validation tail observer notification, the pending-add assertion, the
   membership getter, the disposal tracking tail, recording access, the
   managed-ID bootstraps, listener storage, and the helper set. Record the
   report under a new evidence directory.
2. **Changed-body decisions.** For each changed body, answer one question:
   same operation and effects on the fixed doctor path, or a new wait,
   monitor, queue, compile, or callback. Use the exact-dispatch core and
   bounded trace tools. Map each new effect to a guard in item 3 or to a
   timed live step. Do not reopen the universal closure.
3. **Runtime entry guards.** Read-only checks before each native command,
   each with a modeled host cost under the ledger and a call-budget update:
   the same manager and project-document class in the witness; the
   edit-document helper list empty and pending helper null (two new field
   roles); the pending-list role empty; the tracking flag false; an
   owned-tree check before disposal (exact classes in the 33-class set,
   one managed node, node and depth limits). Treat the cold first factory
   call as a timed, consented live step; the compile is unavoidable on the
   first add in a process. Keep every existing guard.
4. **Driver and probe.** Adapt the pinned driver, candidate resources,
   exact host and jar guard, deliberate build marker, and first-attempt
   policy for the 6.1.4 fingerprint. Preserve V20 and its old attempt and
   cache bytes. Test wrong build, duplicate attempt, incomplete roles,
   uncertain-write retention, and exact old-record preservation. Keep
   paired independent readback and complete-pass cache admission.
5. **Deploy and run.** Build with `copyProbeExtension`, request full
   operator controller replacement, run hello, verify the fresh profile
   and markers, obtain fresh save-first scratch consent, verify project,
   target, selection, and competing clients, then run one doctor pass.
   Compare per-call costs with E316. Never repeat an uncertain command.
   Record the E result, the exact final state, and the cache outcome.
6. **Toolkit consolidation (can move to 9b.7).** Classify the 98 diagnostic
   modules: reusable tools (`scan`, `ownership.method_trace`,
   `read_dataflow`, `conditional_contracts`, `constructor_bounds`,
   `call_paths`, `bounded_trace`, `command_closure`, `runtime_dependencies`,
   `renamed_fixture`, `mutated_fixture`, the inert JDK models) and
   per-build diagnostics (the `fixed_*`, `*_variants`, `*_contracts`,
   `factory_closure`, `history_growth`, `owned_collectors`, `listener_*`
   families). Keep the tools and their tests; archive the diagnostic glue
   with its checkpoint snapshot. Verify every `/tmp/gn-9b6g-*` file against
   the checkpoint manifests, then delete the temporary copies. Extend
   `runtime_dependencies` and recheck owner-only prefilter scans only if a
   changed-body trace needs them.

**Acceptance.** A complete 6.1.4 doctor result with the guard set, the
body-change report, and per-call timing; or a traced and measured reason
it cannot pass under D52. Close step 2 only with the explicit two-build
result. Product cache enforcement, the deterministic upgrade tool, and
public descriptions remain in 9b.7.
