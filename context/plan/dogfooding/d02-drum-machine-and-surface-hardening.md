---
title: D02 — Drum Machine and surface hardening
kind: status
state: active
updated: 2026-08-23
parent: README.md
session: public-drum-machine-composition
---

# D02 — Drum Machine and surface hardening

## Source run

- Session ID: `01a0307a-5c55-7871-8a5f-f3402bfb8547`.
- Transcript:
  `~/.codex/sessions/2026/08/23/rollout-2026-08-23T16-15-20-01a0307a-5c55-7871-8a5f-f3402bfb8547.jsonl`.
- Host: ChatGPT desktop, Codex mode, version `0.149.0-alpha.4.1`.
- Project: `New 2`.
- Goal: Build a native synthesized Drum Machine and a sparse lo-fi jungle clip.

### Retry prompt

Use this prompt unchanged in Session 5:

```text
Use ghostnote to work in the currently open Bitwig project. Do not inspect or edit the ghostnote repository, and do not run shell commands, tests, or probes.
Goal: To create a beat that is high-tempo but soft-spoken, lo-fi jungle, from scratch. To begin the session, convert the first instrument track into a drum rack using native Bitwig devices for drum synthesis (no samples) that sound similar to amen break drums, and populate it with a typical, but sparse jungle beat MIDI clip.
Preserve existing accepted material unless I explicitly ask to replace or delete it. Make subjective revisions auditionable when practical. Verify each result through ghostnote. Wait for my explicit accepted or vetoed response after I audition it. Keep accepted musical results and reverse rejected work when it is safe.
```

The agent built an Instrument Layer approximation. Its entries ran in parallel
and did not route MIDI notes to separate drum voices. It found the limitation
late and stated it only after the operator asked about routing. The operator
used exclusive solo during audition. The final `Ghost Hat` solo state was
intentional and is not a defect.

The current public Ghostnote surface cannot populate Drum Machine pads. This is
a public product gap, not a Bitwig API gap. E4d proves that the registered
`drumpad.insertDevice` primitive can insert a native device into an empty pad and
create its chain. The sessions below expose that capability and fix the clear
correctness, latency, and clarity defects found in the same run. They do not add
special agent instructions for this one misunderstanding.

## Session 1 — Public native Drum Machine composition

### Objective

Add one public operation, provisionally `compose_drum_machine`, that creates a
new native Drum Machine and fills one through 16 reachable pads with one native
Bitwig drum device each. The caller names MIDI notes and exact native device
names. It does not supply UUIDs, preset paths, binary edits, or UI state.

### Work

1. Add the minimum contract and adapter path for inserting a native device into
   an empty Drum Machine pad. Reuse the registered typed insertion primitive.
   Do not use named actions.
2. Resolve each exact native device name through the existing catalog. Refuse an
   unknown or non-unique match before writing.
3. Define and verify the public mapping between the 16 reachable pad channels
   and MIDI notes. The initial range is C1 through D-sharp 2, MIDI notes 36
   through 51. Reject duplicate or out-of-window notes before writing.
4. Insert a new Drum Machine after a fresh complete track-device read. Populate
   requested pads in caller order. Do not edit an existing container or delete
   an existing device in this first slice.
5. Return the top-level container kind and the exact MIDI-note, pad-channel, and
   nested-device witnesses. Report partial completion without overstating the
   final structure.
6. Record the new container as one owned composition change. Reversal removes
   only that complete inserted Drum Machine while its last proved position and
   structure remain valid.
7. Add fake, contract, surface, schema, and live-adapter regressions. Run a live
   four-pad check with `v1 Kick`, `v1 Snare`, `v1 Hat`, and `v0 Hat`, then remove
   all test content.

### Acceptance criteria

- A fresh call creates exactly one top-level Drum Machine, not an Instrument
  Layer or Selector.
- MIDI notes 36, 38, 42, and 46 resolve to four separate pads containing the
  four requested native devices.
- One note addresses one pad. No composed voice runs for every MIDI note.
- Duplicate notes, unreachable notes, unknown devices, occupied target pads,
  stale device order, and incomplete readback refuse or report partial state
  without a false `verified` result.
- The public tool exposes no UUID, file, preset, focus, or selection control.
- `revert_change` removes the owned Drum Machine and leaves prior track content
  unchanged.
- MCP `tools/list` and a fresh Codex chat expose the new tool with a compatible
  schema. Focused tests, the full brain check, extension tests, the handshake,
  and the live check pass. The live project has no test residue.

## Session 2 — Correct nested DirectParameter guards

### Objective

Make DirectParameter writes work at depth 1, depth 2, and inside a drum pad
without weakening the complete top-level device-order and enabled-state guard.

### Work

1. Reproduce the run's exact failure:
   `expectedDeviceName disagrees with expectedDeviceNames[0]` on a nested native
   device.
2. Separate the top-level container guard from the nested cursor-target guard.
   Do not compare a nested device name or nested position with the top-level
   device list.
3. Confirm the complete top-level name and enabled fingerprint, the container
   position, every named or drum-pad route step, and the final nested device
   identity before the write.
4. Preserve exact completion or independent readback. A stale top-level chain,
   renamed entry, changed pad content, or wrong nested device must refuse.
5. Add offline regressions for top-level, depth-1, depth-2, and drum-pad targets.
   Include negative guard cases for each boundary.
6. Run one live nested DirectParameter write and exact reversal. Leave the
   fixture unchanged.

### Acceptance criteria

- The D02 nested native-device case writes and verifies its requested base
  value.
- Every existing top-level guard remains effective.
- Nested route identity has its own explicit guard and cannot alias a top-level
  device at the same numeric position.
- Depth-1, depth-2, and drum-pad regressions pass through fake and live-adapter
  paths.
- Focused tests, the full brain check, extension tests, the handshake, and the
  live reversal pass. No fixture state changes remain.

## Session 3 — Cohort parameter writes

### Objective

Remove repeated full acquisition work when one `set_parameter` call changes
several controls on the same stable device route. Keep scalar receipts and exact
readback.

### Work

1. Record a wire trace and wall time for four remote controls on one depth-2
   device. Use the source run's 33.3-second result as the comparison baseline.
2. Partition settings into stable cohorts by track, top-level fingerprint,
   complete nested route, and parameter view.
3. Acquire and validate one fresh inventory per cohort. Apply the cohort through
   one guarded execution path, then acquire one complete readback for all
   requested controls.
4. Keep one receipt and prior value per scalar target. Preserve exact reversal
   and partial-success reporting.
5. Stop a cohort after a structural or target-identity failure. Do not continue
   through settings that are known to share the same invalid guard.
6. Preserve setting order across different routes. Do not parallelize writes to
   the same device cursor.
7. Add trace-count, failure, concurrency, mixed-route, and reversal regressions.
   Run a focused live timing check and restore all values.

### Acceptance criteria

- Four settings on one unchanged nested route use one preflight inventory and
  one complete post-write inventory, not four independent acquisition cycles.
- Every scalar value is verified and has its own reversible receipt.
- A failed cohort does not attempt later settings behind the same invalid
  target. Earlier verified cohorts remain reported as partial success.
- The four-control live case is at least 50 percent faster than the recorded
  33.3-second baseline. Record the trace and exact wall time.
- Focused tests, the full brain check, extension tests, and the live reversal
  pass. No fixture state changes remain.

## Session 4 — Clear container semantics and note refusals

### Objective

Make the public surface state container execution and MIDI routing directly.
Return the safe, actionable reason when clip timing is outside the writable
grid.

### Work

1. State that `compose_device_structure` creates an Instrument Layer whose
   entries run in parallel and receive the same MIDI input. State that it does
   not create Drum Machine pads or per-note routing.
2. State that instrument `create_device_alternates` uses an Instrument Layer,
   not an Instrument Selector. Explain that exclusive solo is for auditioning
   one entry and does not map MIDI notes.
3. Make relevant structure results name the observed container kind and routing
   semantics. Do not require an agent to infer them from a later top-level read.
4. Describe `compose_drum_machine` as per-MIDI-note routing and keep its result
   witnesses explicit.
5. Preserve the actionable `note.write` grid detail. A refusal must name the
   finest supported grid and identify timing as the cause. Do not expose
   unrelated internal or filesystem detail.
6. Add description-cohort and refusal regressions. Start a fresh Codex chat to
   confirm every public tool remains exposed and that the three container tools
   are distinguishable from their descriptions alone.

### Acceptance criteria

- No public description calls an Instrument Layer a generic Instrument
  container or implies that it is an Instrument Selector.
- The Layer, alternate, and Drum Machine descriptions answer how MIDI reaches
  their entries without an additional tool call.
- An off-grid note write returns the existing safe grid reason. One correction
  is sufficient; blind timing retries are not required.
- The description and schema cohort advances. MCP `tools/list`, a fresh Codex
  exposure check, focused tests, and the full brain check pass.
- No Bitwig content changes during the exposure check.

## Session 5 — Repeat the same musical dogfood

### Objective

Run the same musical prompt from a new projectless Codex chat. Do not add hints
about Layers, Selectors, pad routing, grid limits, or prior agent behavior.

### Work

1. Restore the first instrument track to an agreed empty baseline. Record the
   project revision, content epoch, track shape, device order, and launcher
   slots.
2. Start a fresh Codex chat with the original D02 source prompt unchanged.
3. Record the session ID, approval wait intervals, tool durations, refusals,
   writes, live structure, and final clip.
4. Confirm that the result uses a Drum Machine with separately routed native
   synthesized voices and that the MIDI pitches match the populated pads.
5. Audition the result. Record explicit acceptance or veto and reverse rejected
   work when the recorded pre-state makes it safe.
6. Compare the run with the source session. Separate approval time, agent time,
   Ghostnote execution time, and Bitwig observation time.

### Acceptance criteria

- The same prompt produces a real Drum Machine with separate per-note routing.
- The agent does not substitute an Instrument Layer or Selector for the
  requested rack.
- Nested tone edits verify when the selected native device exposes the requested
  controls.
- Representable notes write without a trial-and-error grid search.
- The run record states exact timing, refusals, final state, and the operator's
  accept or veto result.
- The project finishes at the accepted result or its exact recorded baseline.

## Retrospective

State container execution and MIDI-routing semantics at the public boundary.
Do not rely on an agent to infer them from product history or Bitwig vocabulary.
