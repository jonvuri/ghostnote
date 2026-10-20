---
title: Phase 9b — Grid breadth, build discovery, and build-out planning
kind: plan
state: active
status: Step 1 (breadth) starts with session 9b.1, a read-only survey of stock Grid presets on a scratch track.
updated: 2026-10-19
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
  The next free number is E300.
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

- **9b.1 — Stock preset survey, read-only.** Defined below. Classifies a–e
  from reads alone and selects what needs a write probe.
- **9b.2 — Write probes for the flagged dimensions.** Likely: connect and
  disconnect a modulation input; factory and attach one stateful module and
  load content if a path is found; one non-decimal write; one FX Grid and one
  Note Grid edit. One probe build and one controller replacement.
- **9b.3 — Engine-active checks, if 9b.2 needs them.** Operator listening in
  the [E296 style](9a-operator-audio-test.md), with fewer checks.

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
delete; the cost model for real patch sizes (from the 9b.1 numbers); failure
handling and recovery; the tool surface and descriptions. Output: an
implementation plan as a new phase or 9c, with a cost model per the
[ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md) rules.

## Session 9b.1 — Stock Grid preset survey (read-only)

**Goal.** Run the existing read path over a sample of stock Grid presets on
a scratch track. Classify dimensions a–e from what it sees. Select the write
probes for 9b.2.

**Inputs.**

- 255 stock Grid presets under
  `~/Library/Application Support/Bitwig/Bitwig Studio/installed-packages/5.0/Bitwig/`
  (for example `Audio FX - Space, Time, Color/Grid Repeater.bwpreset`,
  `Freeform/Curving Grid.bwpreset`). Find them with
  `rg --files <dir> -g '*.bwpreset' | rg -i grid`.
- The V13 research probe, still deployed (NOW). `probe.gridRead` with the
  [E276 semantic query](../../evidence/data/phase9a-grid-read/semantic-query.json)
  and its `schema` operation. No extension change is expected, so no
  controller replacement. If a read needs a new method, stop, record it, and
  plan the build for 9b.2.
- Control preset:
  `~/Documents/Bitwig Studio/Library/Presets/Poly Grid/gn-grid-spike-baseline.bwpreset`.
  [E298](../../evidence/experiments/e298-grid-operator-audio-live-test.md) and its
  [closed-file check](../../evidence/data/phase9a-operator-audio/closed-file-check.json)
  identify the saved project, backup, preset, and verified hashes. Keep the
  existing `grid-probe` track unchanged. The E289 edited project is not a baseline.
- `brain/src/probes/phase9a-grid-read.ts` as the starting driver. It asserts
  the `grid-probe` track name and the 9a preset hash; the survey driver drops
  both.

**Preparation (small code).** Add `brain/src/probes/phase9b-grid-survey.ts`
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
scope for 9b.2. The scratch track is deleted. The operator's project is
otherwise unchanged. The operator chooses the host project (suggest
`gn-grid-spike` or a new empty project).

**Rigor.** Two reads per preset must agree, with the control and graph checks
above. Writes are limited to scratch track/device setup, muting, and cleanup.
Evidence is the driver's JSON output in `context/evidence/data/phase9b-survey/`
and one E record (E300).

**Cost note.** One 53-node read is about 15 calls and 0.6 s. A 40-module
patch can exceed the 4,096 work cap or the 1 MiB graph cap; record it. Do
not raise a cap in this session without noting the heap effect.
