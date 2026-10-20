---
title: Phase 9b — Grid breadth, build discovery, and build-out planning
kind: plan
state: active
status: E304 completes focused reader coverage. Session 9b.3 tests three bounded write cases.
updated: 2026-10-20
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
  The next free number is E305.
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
- **9b.3 — Write probes for the flagged dimensions.** Select one non-decimal
  value, one knob-modulation edge, and one stateful factory case after 9b.2a
  proves their readback. Use Gates/array or Wavetable evidence from E302.
  Resource loading and FX/Note edits remain conditional on sufficient read
  coverage. Batch admitted probes into one build. No native write is authorized
  by a preset name or a partial read alone.
- **9b.3a — Engine-active checks, if the write results require them.**
  Operator listening in the [E296 style](9a-operator-audio-test.md), with fewer
  checks. Set the scope in the 9b.3 result.

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

- **9b.4 — Offline resolvers.** Shape resolvers for every manifest row;
  fake-host tests; jar-scan timing on 6.0.6. Must reproduce the hand-pinned
  table exactly. Enumerate jar entries for default-package classes (`a`,
  `llL`); do not guess names.
- **9b.5 — Live doctor on 6.0.6.** Scratch track, preset insert, read
  sentinel, value, cable, factory, attach and undo, delete and undo, teardown,
  cache write. Measure. Set the budget, consent, and failure policy: one pass
  per fingerprint, no retry on uncertainty, engine state recorded but not
  required, "save first; a failed check can need a Bitwig restart" in the
  consent text.
- **9b.6 — Live doctor on 6.1.x.** After the operator's general update audit,
  with 6.0.6 copied aside. Record which symbols moved and whether any logic
  moved. Step 2 cannot close without this session.
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

**Source.** [E304](../../evidence/experiments/e304-focused-grid-reader-live.md),
the [focused report](../../evidence/data/phase9b-focused/focused-report.json),
the [final projection](../../evidence/data/phase9b-focused/focused-query-v6.json),
and the [schema inventory](../../evidence/data/phase9b-focused/observed-schemas.json).
Use fresh owned muted scratch tracks in the operator's chosen project.
Keep `grid-probe` unchanged. V15 is loaded; batch new native probes into one
build and defer controller replacement to the operator.

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
