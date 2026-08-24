---
title: D02 — Drum Machine and surface hardening
kind: status
state: complete
updated: 2026-08-24
parent: README.md
session: d02-complete
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

### Outcome — complete

[E76](../../evidence/experiments/e76-public-native-drum-machine-composition-is-live.md)
records the implementation and live proof. `compose_drum_machine` resolves all
native names before one recorded write. It maps notes 36 through 51 to separate
pads 0 through 15 and returns exact top-level and nested witnesses.

The four-pad MCP check created `v1 Kick`, `v1 Snare`, `v1 Hat`, and `v0 Hat` on
pads 0, 2, 6, and 10. Complete readback passed. Guarded reversal removed the
owned Drum Machine, and cleanup restored the exact entry track list. MCP
`tools/list` returned 46 tools. Fresh Codex session
`01a030d1-b936-7460-841b-12d685238356` exposed the compatible public schema and
made no Bitwig change. The full brain check passes 842/842, extension tests pass,
and the 148-method handshake passes.

Staged review hardening fixed two completion gaps. A late pad-preflight failure
now returns and records a partial receipt. Reversal guards only the pad stages
that succeeded. Final verification requires two equal, complete pad inventories
and rejects extra nested devices and occupied unrequested pads. The repeated
live four-pad check passed and restored the exact entry track list. The full
brain check now passes 846/846.

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

### Outcome — complete

[E77](../../evidence/experiments/e77-nested-direct-parameter-guards-are-live.md)
records the correction and live proof. The write guard now treats the complete
top-level fingerprint, the nested route, and the final cursor target as separate
identities. Named descents verify their live entry names before selection. The
extension records each route step and compares the full route immediately before
the scalar write.

Fake, live-adapter, and public-surface regressions cover top-level, depth-1,
depth-2, and drum-pad targets. Negative cases cover each identity boundary. The
focused cohort passes 306/306, and the full brain check passes 850/850.

The live probe changed and restored `OSC1 Pulse Width` on native Polysynth at
depth 1, depth 2, and Drum Machine channel 3. The 148-method handshake and
extension tests pass. Cleanup restored the exact four-track `New 2` entry list.

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

### Outcome — complete

[E78](../../evidence/experiments/e78-cohort-parameter-writes-are-live.md)
records the implementation and live proof. `set_parameter` now partitions
ordered settings into stable device-route and parameter-view cohorts. One fresh
inventory supplies the scalar prior values and guards. One complete inventory
verifies all cohort values after the writes.

Each scalar target keeps its own change ID, prior value, receipt, and reversal.
The live adapter serializes complete parameter mutation pipelines. A target or
structural failure stops later settings in that cohort. Earlier verified
cohorts remain in the partial result.

Fake, live-adapter, public-surface, encoder, and extension-source regressions
cover trace count, failure, concurrency, mixed routes, durable guards, and
reversal. The focused cohort passes 247/247. The full brain check passes
856/856, and extension tests pass.

The live depth-2 Polysynth case changed four remote controls in 4.383 seconds.
This is 86.8 percent faster than the 33.3-second source baseline. The trace had
one preflight inventory, four guarded writes, and one complete readback. Four
independent reversals restored the exact prior values. Cleanup restored the
exact four-track `New 2` entry list.

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

### Outcome — complete

[E79](../../evidence/experiments/e79-container-and-note-refusals-are-explicit.md)
records the public wording, result semantics, note refusal, and exposure proof.
The Layer composer now states that its entries run in parallel and receive the
same MIDI input. Instrument alternates name Instrument Layer, reject the
Instrument Selector interpretation, and define exclusive solo as auditioning.
Drum Machine composition states its per-MIDI-note pad routing.

Successful structure results include the observed container kind and routing
semantics. Note-grid validation now runs in the shared contract. An off-grid
start or duration returns one safe correction with the 1/64-beat grid floor
before either adapter writes.

The registered MCP server exposes 46 tools. Fresh Codex session
`01a03121-6f22-7461-b357-18053b3d272a` distinguished the three container tools
through capability discovery and made no Ghostnote, shell, file, or Bitwig call.
The focused cohort passes 156/156. The full brain check passes 859/859.

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

### Outcome — complete with qualifications

[E80](../../evidence/experiments/e80-repeat-drum-dogfood-succeeds-with-qualifications.md)
records fresh Codex session `01a0313d-a405-7063-a184-d7263ac256d6`.
The unchanged prompt produced one verified native Drum Machine with six
separately routed synthesized pad voices. Its eight-beat clip contained 31
notes. Every note fit the writable grid on the first attempt. The operator
accepted the result.

The prompt-to-audition time fell from 21 minutes 9 seconds in the source run to
5 minutes 39 seconds. The new run used 99.5 seconds of recorded Ghostnote call
time before its first audition request. Five retired native-device name
refusals consumed 19.9 seconds. The run did not record its entry project
revision or content epoch.

One likely binary kick value did not verify. The result reported the mismatch,
but the agent did not correct or reverse it. Every later pad cohort verified.
This qualifies the nested-tone acceptance criterion without invalidating the
routed Drum Machine result.

The continued chord run did not use device-alternate operations. It called the
one-entry structure composer, which always creates an Instrument Layer, and
left the Polysynth nested there. A failed `add_device` call treated `Delay+` as
a UUID, added nothing, and returned partial success. The agent rendered delay
as MIDI echo notes instead. The operator accepted the tonal revision and the
final musical result.

E80 also records an unexplained Polysynth release change, two metadata color
mismatches, one avoidable full-clip rewrite, one rationale-conflict retry, and a
partial operator verdict that the three-state observation record cannot express
exactly.

## Finding classification

The repeat run found more than description problems.

- `add_device` reported partial success although its first and only insertion
  added no device. This is a confirmed result-classification bug.
- The Bitwig UUID field accepted `Delay+` and sent it to the live adapter. This
  is a confirmed preflight-validation bug.
- Exact-name top-level insertion is absent. This is a public capability gap.
- Drum composition refusals did not name the failed catalog inputs. This is a
  confirmed result-diagnostic defect.
- Attack Click accepted a value that its readback did not represent. The result
  detected the mismatch, but the interface did not prevent earlier cohort
  writes. This is a parameter-domain correctness gap.
- The temporary Polysynth release change is an integrity risk. The transcript
  does not prove whether the operator or Ghostnote changed it.
- Clip-color bytes did not read back exactly. This is a confirmed live contract
  mismatch. The responsible boundary is not yet isolated.
- The observation model cannot record a partial verdict. This is a data-model
  gap. Its rationale replacement rule is also missing from the public
  description.

No material description error caused the Layer or delay result.
`compose_device_structure` stated that it creates a parallel Instrument Layer.
`add_device` stated that a Bitwig identifier must be a UUID. The agent chose the
wrong operations despite those descriptions. `set_parameter` also stated that
readback must agree, and its result reported the Attack Click mismatch.

Two smaller description or diagnostic issues did affect the run. The
`record_observation` description did not state that an explicit rationale is
write-once. The catalog refusal did not identify the invalid name. Parameter
domain metadata is an interface-data issue, not primarily a prose issue.

Complete Sessions 6 through 9 before the next musical dogfood chat.

## Session 6 — Native insertion and catalog correctness

### Objective

Add exact-name top-level native insertion. Reject invalid explicit UUIDs and
report insertion and catalog failures without false partial success.

### Evidence

- The agent inspected three alternate tool descriptions but called no alternate
  lifecycle operation. It called `compose_device_structure` with one
  `Polysynth`. The final top-level inventory contained only `Instrument Layer`.
- The agent passed `{from: "bitwig", id: "Delay+"}` to `add_device`. The public
  description called this field a Bitwig UUID, but its schema required only a
  non-empty string.
- The call took 6.0 seconds. It returned `applied: false`,
  `partialSuccess: true`, and `added: []`. Its only change receipt contained a
  failed `device.insertBitwig` stage. No insertion landed.
- The surface computes partial success from `receipt.applied` even when the
  insertion stage failed and minted no device. This conflicts with its stated
  contract, which reserves partial success for an earlier landed insertion.
- Five `compose_drum_machine` calls refused obsolete `E-*` names. Each result
  omitted the failed input. The retries took 19.9 seconds before the agent
  isolated `E-Kick` and searched outside Ghostnote.

### Interfaces

- Public tools and result contracts: `add_device` and
  `compose_drum_machine` in `brain/src/surface/tools.ts`.
- Drum composition orchestration:
  `brain/src/surface/drum-machine-composition.ts`.
- Catalog identity and exact-name resolution:
  `brain/src/native-catalog/catalog.ts` and
  `brain/assets/native-devices/catalog.json`.
- Shared mutation contract and execution: `device.insert` in
  `brain/src/contract`, `Workspace.apply`, and `Executor.run`.
- Live encoding and completion: `brain/src/adapters/live/encoder.ts`,
  `brain/src/adapters/live/adapter.ts`, and
  `brain/src/adapters/live/wiremap.ts`.
- Extension write boundary: `device.insertBitwig` in
  `extension/src/main/java/com/ghostnote/extension/handlers/DeviceHandlers.java`.

### Work

1. Add the minimum public operation for one or more ordered exact native-device
   names. Resolve all names before the first write.
2. Append each resolved UUID through the current typed insertion path. Keep the
   complete top-level name and enabled-state guard for each stage.
3. Return absent and non-unique caller-supplied names in one safe refusal.
   Apply the same diagnostic to Drum Machine composition.
4. Apply the catalog UUID validator to explicit Bitwig UUID inputs before the
   adapter runs.
5. Derive `partialSuccess` only from a proved earlier insertion. A failed first
   stage with `added: []` must report no partial success.
6. Return one exact position and reversible receipt per inserted device.
7. Add schema, surface, fake, live-adapter, failure-classification, and reversal
   regressions. Run one live `Polysynth` then `Delay+` insertion and exact
   cleanup.

### Acceptance criteria

- One exact-name call produces `Polysynth → Delay+` as two top-level devices.
- No Instrument Layer, alternate lifecycle, public UUID, preset path, or asset
  path is required for that result.
- Unknown and non-unique names refuse before a write and identify every failed
  caller-supplied name.
- A non-UUID explicit Bitwig identifier refuses before the adapter.
- A failed first insertion returns `applied: false`, `partialSuccess: false`,
  and `added: []`.
- Each successful insertion has exact readback and safe reversal while its
  complete top-level guard remains valid.
- Focused tests, the full brain check, extension tests, the handshake, and live
  cleanup pass.

### Outcome — complete

[E81](../../evidence/experiments/e81-exact-name-native-insertion-is-live.md)
records the implementation and live proof. Public `add_native_devices` resolves
one through 16 ordered native-device names before writing. It appends each
resolved device at the top level after a fresh complete name and enabled-state
read. Each successful stage returns an exact position and reversible receipt.

Exact-name catalog failures now return every absent or non-unique caller input.
Drum Machine composition uses the same diagnostic. Explicit `add_device`
Bitwig identifiers must use the lowercase canonical UUID form before the
adapter or encoder can run. A failed first insertion with no proved position
returns `applied: false`, `partialSuccess: false`, and `added: []`.

The live MCP check created `Polysynth → Delay+` as two top-level devices on one
owned track. Complete readback passed. Guarded reversal removed both devices in
reverse order with no positional caveat. Cleanup restored the exact five-track
entry list in project `New 3`. MCP `tools/list` returned 47 tools. The full
brain check passes 867/867. Extension tests, deploy freshness, and the
148-method handshake pass.

## Session 7 — DirectParameter domains and collateral integrity

### Objective

Refuse unrepresentable DirectParameter values before any cohort write. Detect
or prevent changes to parameters that the cohort did not request.

### Evidence

- The first drum call requested 42 settings. Four kick settings verified.
  `CONTENTS/ATTACK_CLICK` requested `0.28` and read back as `0`. The result then
  reported partial success and stopped the cohort.
- The public inventory returned the parameter and its normalized value, but it
  did not return a usable discrete domain for this control. The observed
  behavior was binary. The agent did not reverse or correct the mismatch.
- The first complete Polysynth read at session time 01:04 returned
  `CONTENTS/R = 0.01`. Neither later tonal revision cohort requested that
  parameter. The next complete read at 01:09 returned `0.325`. The agent reset
  it to `0.01`, and independent readback showed `1.00 %`.
- The public surface supplies a full preflight inventory to
  `applyParameterCohort`. The live adapter skips its internal complete cohort
  postread when that supplied preflight exists. The executor verifies requested
  scalar addresses, but it does not compare unrelated parameters in the stable
  inventory. The current path can therefore miss collateral changes.
- The transcript cannot distinguish an operator edit from a write-path side
  effect. A focused live reproduction must do so before a code fix.

### Interfaces

- Public discovery and mutation: `inspect_device_parameters` and
  `set_parameter` in `brain/src/surface/tools.ts`.
- Parameter state types: `brain/src/contract/state.ts` and parameter addresses
  in `brain/src/contract/address.ts`.
- Cohort orchestration: `Workspace.applyParameterCohort` in
  `brain/src/surface/workspace.ts` and `Executor.runParameterCohort` in
  `brain/src/engine/executor.ts`.
- Live inventory, preflight, postread, and comparison:
  `prepareParameterCohort` and cohort completion in
  `brain/src/adapters/live/adapter.ts`.
- Extension inventory and write boundary:
  `ParamHandlers.directparam.set`, `DeviceHandlers` route guards, and the
  DirectParameter observers and completion state in `Rig.java`.

### Work

1. Use a scratch device to measure Attack Click at `0`, `0.28`, and `1`.
   Record its observed discrete count, names, display values, and normalized
   readback.
2. Find why its public inventory did not provide a usable domain. Preserve
   optional metadata only when the host proves it.
3. Refuse a normalized value that is not representable before any scalar in its
   cohort writes. Return the allowed domain in safe result data.
4. Reproduce the two tonal revision cohorts exactly. Read the complete stable
   inventory after each scalar or smallest safe stage. Exclude operator edits.
5. If a write changes an unrequested parameter, stop and report that collateral
   delta. If no drift reproduces, add a complete-inventory comparison that can
   distinguish a concurrent edit from an owned write.
6. Restore every parameter and remove all scratch content. Add fake,
   live-adapter, surface, and extension regressions for both boundaries.

### Acceptance criteria

- Attack Click `0.28` either verifies exactly or refuses before any cohort
  write with its measured representable domain.
- A failed domain check cannot leave four earlier kick changes behind.
- The exact tonal revision sequence does not change `CONTENTS/R`, or the result
  reports the unrequested change and does not claim full verification.
- Complete-inventory comparison has a documented concurrency rule. It does not
  attribute an operator edit to Ghostnote without evidence.
- Exact reversal restores every measured scalar. Focused tests, the full brain
  check, extension tests, the handshake, and live cleanup pass.

### Outcome — complete

[E82](../../evidence/experiments/e82-direct-parameter-domains-and-integrity-are-live.md)
records the implementation and live proof. A typed v1 Kick observer now
returns the host-proved discrete domain for Attack Click. The measured domain
is `[0, 1]`, with `Off` and `On` display values. A request for `0.28` refuses
before the first scalar in its same-route cohort and returns the allowed values.

The live adapter reads the complete DirectParameter inventory after each
scalar. An unrequested delta stops later writes. The report attributes the
delta only to the cohort write window because the host does not identify its
author. The executor also compares the supplied complete preflight inventory
with final readback.

The exact two Polysynth tonal cohorts left `CONTENTS/R` at `0.01` before,
between, and after the cohorts. All 19 requested tonal scalars and both Attack
Click endpoint writes reversed exactly. Cleanup restored the accepted
five-track list. The full brain check passes 873/873. Extension tests, deploy
freshness, and the 148-method handshake pass.

## Session 8 — Exact clip-color bytes

### Objective

Make the public clip-color contract exact for all supported byte values, or
narrow the public input domain to values that Bitwig can return exactly.

### Evidence

- The first metadata call requested blue byte `78` and read back `77`.
- A retry requested `77` and read back `76`. The second predictable mismatch
  did not identify a safe replacement value.
- The encoder sends integer `colorBytes`. The extension writes each byte as
  `byte / 255f`. The live adapter reads a host float and uses
  `Math.round(value * 255)`. A one-byte loss can occur across this boundary.
- Current encoder and fake-adapter tests prove the requested wire values. They
  do not prove the complete live byte round trip.

### Interfaces

- Public contract: `set_clip_metadata` in `brain/src/surface/tools.ts`.
- Wire encoding: `colorBytes` in `brain/src/adapters/live/encoder.ts`.
- Live readback conversion: clip metadata handling in
  `brain/src/adapters/live/adapter.ts`.
- Extension set and read routes: `cursor.setClipMetadata` and
  `cursor.clipMetadata` in
  `extension/src/main/java/com/ghostnote/extension/handlers/CursorHandlers.java`.

### Work

1. Run a focused live matrix around the failing values and byte boundaries.
   Record requested bytes, sent floats, host floats, and returned bytes.
2. Isolate float conversion from host color quantization. Do not add a retry
   heuristic before this measurement.
3. Correct the conversion if every byte is representable. Otherwise, define
   and validate the exact supported byte domain before a write.
4. Add encoder, extension-source, live-adapter, surface, and reversal
   regressions. Restore the exact prior clip metadata.

### Acceptance criteria

- Requested supported color bytes read back exactly on all three channels.
- Unsupported bytes refuse before a write and return the exact supported rule.
- The result does not recommend a blind one-byte retry.
- Exact metadata reversal, focused tests, the full brain check, extension
  tests, the handshake, and live cleanup pass.

### Outcome — complete

[E83](../../evidence/experiments/e83-exact-clip-color-palette-is-live.md)
records the implementation and live proof. Arbitrary RGB bytes are not safely
invertible through the host color conversion. The public contract now accepts
27 live-proved colors: 26 Bitwig palette colors and the existing Ghostnote
legacy blue. Each has one explicit requested-to-wire mapping.

An unsupported requested color returns the complete named palette and refuses
before any read or write. An unsupported prior color also refuses before a
write because exact reversal is not possible. The result explicitly rejects a
blind one-byte retry. The executor and encoder repeat these guards below the
public surface.

The live matrix returned the exact requested bytes for all 27 colors on all
three channels. Public `[145,105,78]` refusal left the complete clip metadata
unchanged. Public red `[217,46,36]` verified independently, and ordinary
reversal restored the complete prior metadata. Cleanup restored the accepted
five-track list. The focused suite passes 309/309. The full brain check passes
881/881. Extension tests, deploy freshness, and the 148-method handshake pass.

## Session 9 — Observation revision and partial verdicts

### Objective

Make observation enrichment rules explicit. Represent a verdict that accepts
one requested scope and vetoes another without falsifying the original
instruction.

### Evidence

- The first acceptance enrichment supplied a second rationale. The record
  refused replacement with `ObservationConflictError`. The agent retried
  without the rationale.
- The public description said that enrichment can add a rationale. It did not
  say that the first explicit rationale is immutable.
- The operator accepted the rhythm but rejected the first chord timbre. The
  agent marked the complete chord instruction as `vetoed`, then began a new
  device-only instruction. The stored verdict loses the accepted rhythm part.
- `operatorResponse` has only `silent`, `accepted`, and `vetoed`. Current reports
  count one state per instruction.

### Interfaces

- Public schema and wording: `record_observation` in
  `brain/src/surface/tools.ts`.
- Session correlation: `ObservationCapture` in
  `brain/src/observation/capture.ts`.
- Stored schema, enrichment conflicts, and migration:
  `brain/src/observation/record.ts`.
- Aggregation and response rates: `brain/src/observation/report.ts`.

### Work

1. State that each first explicit rationale and operator response is
   write-once. Return an actionable conflict that names the preserved field.
2. Choose the smallest stable partial-verdict model. It can use scoped response
   items or an explicit mixed response, but it must preserve the original raw
   instruction and result links.
3. Define report aggregation for the new representation. Migrate old records
   without changing their meaning.
4. Add record, capture, public-surface, schema, conflict, migration, and report
   regressions. Repeat the exact accepted-rhythm and vetoed-timbre case.

### Acceptance criteria

- “Rhythm accepted; chord timbre vetoed” is stored without marking the whole
  mixed instruction accepted or vetoed.
- A second different rationale refuses with stable public wording before a
  record write. Repeating the same value is idempotent.
- Existing observations and reports keep their meaning after migration.
- Focused tests and the full brain check pass. No Bitwig write is required.

### Outcome — complete

[E84](../../evidence/experiments/e84-observation-partial-verdicts-are-explicit.md)
records the model, public contract, migration, aggregation, and focused proof.
Observation schema v3 represents a partial verdict as one `mixed` instruction
with exact caller-supplied accepted and vetoed response items. The original raw
instruction and result links stay unchanged.

The first explicit rationale and first explicit response are write-once. A
different value refuses with stable wording that names the preserved field and
states that the record did not change. Repeating the same value is idempotent.
The public regression proves that a rationale conflict does not call the record
replacement boundary.

Reports count `mixed` once at the instruction level and count accepted and
vetoed scoped items separately. Schemas v1 and v2 migrate without changing old
verdict meaning. The focused cohort passes 115/115, and the complete brain check
passes 885/885. No Bitwig write was required or made.

## Retrospective

Return a partial receipt when a later stage fails after an earlier write. Verify
owned containers from a complete inventory. Name each positional guard for its
coordinate system. State container execution and MIDI-routing semantics at the
public boundary. Assert all required guarded wire fields in the encoder before
the first live run. Record root run identities and version provenance in one
ledger. Separate confirmed bugs from capability gaps and unresolved integrity
risks. Measure complete host color tuples before defining a component
conversion.
Count a partial verdict at both the instruction and scoped-item levels.
