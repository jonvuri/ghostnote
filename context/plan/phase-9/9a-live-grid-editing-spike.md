---
title: Phase 9a — Live Grid editing spike
kind: plan
state: active
status: V8 detached factory gate passes in E283. Continue with native attachment design.
updated: 2026-10-19
parent: README.md
---

# Phase 9a — Live Grid editing spike

## Question and result

Can Ghostnote create, read, update, and delete modules and cables inside an
existing live Grid device, with independent readback of each change?

Here, a module is a device inside the Grid patch. The outer Poly Grid,
FX Grid, or Note Grid is the host device. Inserting or replacing that host
device does not prove live module or cable editing.

This is a research session. Its result is an operation-by-operation verdict,
a reproducible probe, and evidence. A useful partial or negative result can
close the session. Do not claim a product feature from one successful call.
Do not turn the remaining overlap candidates into Phase 9 commitments.
Musical generation remains the driving agent's responsibility.

The first pass reached a checkpoint in
[E277](../../evidence/experiments/e277-grid-value-write-readback-and-persistence.md).
Read, parameter write, independent readback, UI, undo/redo, and edited-state
save/reload pass on the four-module fixture. The operator selected continuation
of 9a. This supersedes E277's session-close handoff, not its measured results.
Historical evidence and the verified fixture remain unchanged.

## Current continuation — module creation

[E281](../../evidence/experiments/e281-grid-module-delete-and-persistence.md)
passes isolated and connected spare-module deletion, exact paired readback,
single undo/redo, and edited-state reload. The exact baseline project bytes
are restored and reopened. [E282](../../evidence/experiments/e282-detached-grid-factory-probe-preparation.md)
prepares V8. [E283](../../evidence/experiments/e283-detached-grid-factory-lifecycle.md)
passes operator replacement, hello, and both detached factory workflows.
V8 remains loaded. Its two-attempt factory allowance is used.
E277 proves parameter editing. E279/E280 prove cable connect, disconnect,
and native source replacement. These are bounded document operations;
engine adoption and general failure atomicity remain unproved.

Keep the bounded reader, schema discovery, identity checks, and asynchronous
failure handling. Reacquire module UUIDs after each reload. Do not repeat the
broad DSP walk or completed V4–V7 sequences without a new reason. The exact
baseline backup remains the recovery path for tests that save edited state.

### Passed: detached module factory lifecycle (E283)

E281 traces `DbL.pvN(UUID)`, the `xQx` / `JtC` template copy, module
initialization, and native disposal. E282 completes the failure-path design
and prepares a probe for one native Amplify type only. Both guarded workflows pass in E283. Do not attach it to the
Grid in this first probe. Do not interpret a file-loader string as a type
UUID. Do not mutate or clear the host's template cache.

Admit only the exact four-module, two-cable fixture baseline with a fresh
epoch and complete before capture. Use the host factory once. Check the
returned runtime type, fresh module UUID, null parent, contents ownership,
initialization state, native defaults, and bounded module/atom counts.
Capture the detached result twice. Keep the live fixture capture separate.
Dispose the returned detached object through the traced native lifecycle in
a `finally` block. Verify disposal, then read the live Grid twice and require
exact equality. A second independent call must yield a different module UUID
with equal defaults. Compare its cost and verify that disposal did not damage
the cached template. No object handle may survive the call.

Before implementation, account for a factory that throws before returning,
or a timeout during file I/O. No result handle exists for caller cleanup in
the first case. Do not claim rollback, retry an uncertain factory, or dispose
an unproved object. The reader's deadline cannot cancel native file parsing
or monitor waits. Report uncertainty and stop that probe session. If the
native lifecycle cannot be bounded enough for this fixture, record that
specific limit before choosing another creation path.

Cost model for the proposed probe: retain 18 sequential wire calls, five
live-fixture captures, and one construction/disposal stage. Add two local
captures of the detached Amplify, expected to have eight projected nodes.
Typical and maximum admitted scope are one fixed type; there is no batch.
Plan about 600 ms summed warm wire time plus 150 ms cursor settlement and
16 MiB temporary heap. This exceeds V7's roughly 550 ms / 8 MiB plan because
it copies and initializes new contents and performs native disposal. Cold
file I/O and cache waits have no measured bound yet. Record first and repeat
factory timings separately; do not label the first call cold without cache
evidence. Keep the 4-second pre-operation deadline and 5-second response
watchdog, with an explicit non-cancellation limit. Measure heap samples and
state that they are not peak or retained heap. Revise this model before code
if the lifecycle design requires more calls or stages.

Acceptance: exact live-fixture preservation, independent detached reads,
distinct new identities, equal repeated native defaults, verified ownership
and disposal, no retained probe handle, measured costs, and explicit failure
limits. This proves factory use only. After it passes, trace and test the
host's collection insertion with one detached Amplify at a free position.
That next stage needs its own cost model, parent/membership readback, UI,
one-step undo/redo, edited reload, and final baseline restoration. Do not
claim live creation from a detached factory result.

#### V8 failure-path design (before implementation)

The factory request is research-only and classified as a write. Admit one
attempt per epoch and at most two attempts per controller initialization.
Resolve all reflection methods before the attempt. Require the exact baseline
and a current route immediately before `DbL.pvN(UUID)`. Mark the attempt before
the call. Never retry inside the handler. No attachment method is exposed.

After return, require exact `DbL` type, null `HEV.I_()` ownership and null
`had.Fuu()` Grid parent, a new UUID, and non-disposed state. Walk only native
owned children (`HEV.dpx(null)`), with identity checks, at most 256 objects,
depth 12, and a 1-second check deadline. Each child must name its owner through
`I_()`. Require the copied contents to belong to this module. The native
factory trace supplies copy provenance; the repeat checks defaults after
disposal. Do not inspect or change the template cache.

Once ownership is proved, use `finally` to dispose through `dC_()`, including
when initialization checks or detached captures fail. Recheck ownership before
disposal. Check `J_()` on every recorded owned object afterward. A failed
ownership proof must not trigger disposal. Report the failed stage, attempt,
return, ownership, and disposal state. Keep only JSON reports and UUID strings
outside the task. No native result handle enters the epoch or response.

A factory exception before return has unknown partial allocation. An ownership
failure or disposal failure also has an uncertain result. Each closes the
handler to further requests until operator replacement. The 5-second watchdog
does the same. It cannot cancel native work; a late return still runs guarded
cleanup, but the timeout response cannot attest that cleanup. Do not issue
another factory call after uncertainty, even if the fixture still reads equal.
The operator must inspect or restart the host before a new probe session.

The detached projection has exactly eight nodes and six atoms. Check the two
helpers set by `OEf.ao_()` without invoking their setters. Capture native
defaults as observations, then require paired and repeated equality. This
does not establish DSP initialization. The ownership walk adds bounded local
reads, not wire calls or write stages. The 18-call / 16 MiB model above still
applies; native parsing and disposal remain non-cancellable.

### Next: native collection attachment

Source: [E283](../../evidence/experiments/e283-detached-grid-factory-lifecycle.md).
The detached factory gate passes. Continue within 9a with one Amplify inserted
at a verified free position in the same fixture. Keep V8 loaded until a
reviewable attachment probe is ready. A new extension build needs operator
replacement and a fresh hello. Do not reset V8's attempt allowance to bypass
its bound.

Before implementation:

1. Finish the native edit-admission and failure trace. The public collection
   wrapper opens a named edit, mutates, invokes a callback, then closes the
   edit. It does not close the edit in a failure handler. Its start helper
   discards the returned boolean. Determine how to refuse an unavailable edit
   before mutation and how to report a throw after the edit starts. Do not
   close an unknown outer edit or claim general rollback.
2. Trace the selection callback and choose the native entry that preserves
   the current selection. The `ffA` wrapper adds `oaA`; `eOi` accepts an
   optional callback. State why the chosen entry includes all required graph
   and notification steps.
3. Bound the layout pass. Read x/y/width/height for all four existing modules
   and the new Amplify. Admit dimensions 1–8 and a total vertical span at most
   16 cells. Check a free candidate position (2, 0), then simulate the traced
   `llL` pass and require no movement of existing modules. Refuse an unexpected
   rectangle before insertion. Do not infer dimensions from the UI alone.
4. Define ownership transfer and cleanup separately from detached disposal.
   Before insertion, retain V8's ownership and initialization checks. After
   an insertion attempt, never dispose merely because a method threw or a
   parent read is null. First account for membership and undo ownership.
   Report an uncertain partial insertion and stop writes when proof fails.
   Preserve a bounded read-only recovery path and the verified project backup.

Proposed success cost: 18 sequential wire calls, five fixture captures,
two detached captures, one construction stage, and one native insertion edit.
Typical and maximum scope are four modules before and five after, two cables,
and one fixed Amplify type. Allow 650 ms summed warm wire time plus 150 ms
cursor settlement and 16 MiB temporary heap. V8 measured 508–591 ms wire,
including detached disposal. Attachment replaces that disposal with ownership
transfer, native edit bookkeeping, notification, and the bounded layout pass.
The after projection grows from 53 to 61 nodes. No extra wire turn is planned.
Native file I/O and edit execution remain non-cancellable. Revise these figures
before code if the failure design requires another stage or call.

Acceptance: fresh identity, exact native defaults at the admitted position,
parent equal to the intended Grid, exact five-member collection, two equal
independent after reads, and no unrelated graph or selection change. Check the
UI, one-step undo/redo, saved edited-state reload with fresh UUIDs, and the
final exact baseline-file restoration and fresh read. Each undo/redo check adds
one action call and a separate paired read workflow; it is not part of the
18-call insertion budget. Retain first/repeat timing, native-stage timing,
queue/completion, payload, and heap samples. No broad module-type, DSP, or
failure-atomicity claim follows from this fixture test.

## Read first

1. [NOW](../../NOW.md), then the
   [performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md).
2. [Overlap capability audit](../../evidence/OVERLAP_CAPABILITY_AUDIT.md),
   especially P5, P7, P9, F4, F5, and the openwig section; the
   [improvement sources](../../evidence/OVERLAP_IMPROVEMENT_SOURCES.md), O7,
   O8, and O12; and the
   [source pins and offline checks](../../evidence/OVERLAP_AUDIT_SOURCES.md).
3. [Device capability record](../../evidence/capability/devices.md),
   [BWFORMAT spec](../../evidence/format/BWFORMAT_SPEC.md), and
   [E4f](../../evidence/experiments/e4f-can-presets-be-synthesised-at-runtime-2026-07-19.md).
   Their historical limits describe the examined paths. They do not forbid
   this new reflection experiment.
4. [E77](../../evidence/experiments/e77-nested-direct-parameter-guards-are-live.md),
   [E91](../../evidence/experiments/e91-existing-device-modulation-wrapper-is-live.md),
   [E254](../../evidence/experiments/e254-device-control-identity-and-route-claims.md),
   and [E258](../../evidence/experiments/e258-selection-effects-and-unavailable-readback.md)
   for target identity, preservation, and readback limits.

## Source map and established limits

Use the pinned clones in `reference/`. In this worktree, read them at
`/Users/jonvuri/Development/ghostnote/reference` in the main checkout. Record
HEAD and local changes before use. Do not update a clone during this audit.

| Source | Relevant implementation | What it does not establish |
| --- | --- | --- |
| openwig, audit pin `d9ffed4cd3ea` | `src/openwig/controller/openwig_bridge.control.js`: `getDeepestTarget`, `_walkObj`, `obj.walk_device`, `_runOnDocumentThread`, `_findCommandsByOpIds`, `_insertAutomationPoints`, `_runResolverProbe` | No implemented Grid module/cable CRUD path or lossless preset exporter was found. Its stated tested platform is Windows, Bitwig 6.0.6. This workstation has not run it. |
| openwig | `controller/symbols_default.json`; `_discoverReader`, `_loadSymbols`, `_fingerprint` in the bridge | Bootstrap names still matter. Structural discovery and a cache do not prove support for every new build. |
| bwpreset, audit pin `202bf50c31ac` | `bwpreset/codec.py`, `build.py` (`Patch.from_preset`), `graph.py`, `bindings.py`, `model.py`; `docs/verification.md` | Generic file parsing does not supply live host operations. The high-level editor requires a root Grid. |
| bwpreset | `bwpreset/encoding.py` and `definitions.py` | The fixed `sYG.class` lookup fails on the installed jar. No key change was proved. Schema-dependent editing can need this resolver even when plain `0002` parsing works. |
| Control Deck, audit pin `45933855dcbf` | `controller/ControlDeck.control.js`, `handleSaveDevicePreset` | Invokes Save to Library and optionally Enter. It neither enters the requested name nor verifies an output file. It is not a verified export API. |
| Ghostnote | `extension/src/main/java/com/ghostnote/extension/handlers/ApiInventoryHandlers.java`, `Rig.java`, `handlers/DeviceHandlers.java`, `handlers/HandlerRegistry.java`; `brain/src/probes/`; `brain/src/bwmod/` | Public parameter writes and preset insertion do not prove access to a Grid's internal graph. |

openwig reaches the internal document behind a controller proxy. Its walker
uses serialization descriptors to read class names, numeric property IDs,
values, and child relationships. It can start at a selected device rather
than the whole track. This is a concrete lead for the Ramona investigation.
It is not a complete field-ID-to-name dictionary.

The walker uses `identityHashCode` for repeated objects. That is not a durable
project ID and can collide. Its JSON has depth and work limits, and some
values become strings. The serializer filter can fall back to including
properties when resolution fails. The `doctor` flag named `serialize` checks
filter resolution; it does not prove file serialization. None of these
outputs is automatically a complete, restorable device snapshot.

openwig also matches remote-control targets to document atoms and searches
for a native-value-to-normalized-value method (`device.remote_atom_ids`,
`device.remote_normalize`, `_findNormalizeFn`). These are useful source leads
for parameter identity and units. Its heuristic can select a method from one
current-value match; verify multiple known values before adopting a mapping.

openwig already invokes internal commands for Arranger clips and notes, and
discovers an automation insertion method. This supports the method of
investigation, not a claim that equivalent Grid commands exist. Some discovery
paths invoke candidate methods or test writes. They are not read-only scans.
Its asynchronous completion counter also advances after caught failures.
Do not treat notification, method return, or a requested count as readback.

The offline audit parsed and byte-round-tripped 24 Ghostnote preset files.
That supports use of bwpreset as a comparison parser. It does not prove that
an edited arbitrary Grid preset loads, or that a reinserted device preserves
automation bindings, external routes, opaque state, or DSP state.

## Initial scope and fixture

Start with one native Poly Grid in a separate disposable project. Save a
baseline before reflection. The operator can prepare and save this fixture
if no verified automated route exists. Do not use the live projects listed
in NOW as experiment targets.

Use a small known patch: an oscillator and output, plus two identical module
types with different values and positions. Include a spare compatible port
or destination for cable retargeting. Record the exact module types, port
names, values, coordinates, and cables from the UI. Save its `.bwpreset` as an
independent comparison fixture. Record the project and preset hashes.

The saved E274 fixture is `gn-grid-spike`, with track `grid-probe` and one
first-slot device named `Poly Grid`. Its patch is Sine -> Amplify 25% -> Audio
Out, with a disconnected Amplify 50% below the first Amplify. It has four
modules and two cables. Keep the default outer modulators. Mute the track and
save both the project and device preset before capture. The preset is
`gn-grid-spike-baseline.bwpreset` in
`~/Documents/Bitwig Studio/Library/Presets/Poly Grid/`. E274 records its exact
values, positions, ports, file paths, and hashes.

Keep the initial probe to one Grid, at most 8 modules, and at most 12 cables.
The final reduced CRUD cycle can use fewer. The largest admitted research
fixture is 16 modules and 24 cables. Do not widen it until the smaller case
passes. FX Grid, Note Grid, feedback, polyphonic behavior, nested Grids, and
embedded sample state are separate evidence dimensions. A Poly Grid result
does not implicitly pass them.

## Work sequence

### 1. Inspect the current host and build the smallest probe

- Record the installed Bitwig version, build, API version, jar SHA-256,
  operating system, Java runtime, and current Ghostnote build.
- Inspect the actual controller proxy classes and the existing probe
  registration boundary. Determine whether Ghostnote's Java extension can
  reach the same target as openwig's GraalJS controller. Do not assume that
  success in one runtime transfers to the other.
- Resolve a narrow device-target accessor and descriptor enumeration path.
  Inspect signatures and bytecode before invoking an unknown method. Avoid
  a scan that calls every no-argument getter on a live object.
- Prefer a probe-only Java handler in the existing research extension. If
  access requires a different runtime, record why and use a minimal isolated
  bridge. Do not install openwig's complete control surface or run its
  mutating `doctor` against a working project.
- Keep reflection handles and results bounded. Bind each request to the
  expected project, track, device route, and observed host-device identity.
  Use a fresh epoch for handles; reject handles from another device or epoch.

Before live work, deploy the research archive with `./gradlew copyProbeExtension`
from `extension/`. The operator must fully remove the old controller and add
the final matching `ghostnote probe` product in the complete list. A power
toggle or an earlier duplicate can load cached classes. Never operate the
Settings controller list through computer use. Wait for confirmation, then
run `npm run probe:hello` from `brain/`. Check the profile, method count/hash,
fresh initialization, and a deliberate spike build marker. Normal and probe
deployment overwrite the same archive.

### 2. Prove a read before any internal write


[E276](../../evidence/experiments/e276-grid-semantic-read-and-value-probe.md)
passes this gate on the four-module fixture. The saved semantic projection
accounts for all fixture values and directed patch cables. Module UUIDs change
on project reload; reacquire them. This is not a complete serialized device.
V4 passes the guarded parameter test in E277. The read gate alone does not
prove commands or DSP adoption.

Capture the selected Grid's bounded raw graph on the correct document thread.
Return raw descriptor IDs, typed values, relationships, completeness status,
and all errors. Also derive a small semantic result: host identity, modules,
module type/instance identity, parameters, layout, and cables with source and
destination module/port. Keep inference separate from raw observations.
State the domain of each parameter value: stored/native, normalized, enum,
or unknown. Do not apply a 0–1 write rule to an unclassified internal value.

Compare the result with the UI and parsed saved preset. Reconcile differences
in representation rather than requiring byte equality between live and saved
state. Change one known value, position, or cable manually, then recapture.
Use one change at a time to identify fields and relationships. Restore the
baseline after each comparison.

The read gate requires all fixture modules and cables, correct endpoint
direction, distinct identities for duplicate types, and the expected scalar
change. Read twice after settlement. Repeat after selecting a different
device. A truncated walk, unresolved filter, missing relationship, or unknown
binary value is a reported limit; it cannot count as a complete read.

Use a per-capture Java identity map to detect repeated references. Investigate
native persistent IDs separately. Do not use object addresses or identity
hashes as cross-reload identity. After save/reload, reacquire the graph and
compare semantic content.

### 3. Locate the host's Grid operations

Use the observed Grid/module classes and descriptors to narrow the search in
the installed jar. Inspect commands and factories for module insertion,
parameter/layout change, module deletion, and cable connect/disconnect.
Search numeric command IDs, parameter types, and call sites. openwig's
Arranger command IDs are examples, not Grid command IDs.

For each candidate, record the receiver, method or command, argument types,
target identity, thread, transaction/undo requirements, notification behavior,
and expected graph delta. Prefer the host's own commands. Direct field writes
may bypass graph maintenance and engine updates. Do not use them merely
because reflection makes them accessible.

Determine how the host commits document changes and informs the audio engine.
Queue only one operation at a time. Return explicit success/error and an
operation ID, then take a fresh read. Do not block the document thread or
poll a shared GraalJS context concurrently, as openwig warns against this.

### 4. Run one bounded CRUD cycle with independent readback

| Object | Create | Read | Update | Delete |
| --- | --- | --- | --- | --- |
| Module | Insert a known native type with defaults and a fresh identity | Type, identity, parameters, layout, ports | Change a known parameter and layout; verify the same module changed | Remove the exact module; verify its absence and the disposition of incident cables |
| Cable | Connect one known compatible output/input pair | Endpoints, direction, and any stored cable attributes | Retarget one endpoint; distinguish a native update from disconnect/connect | Disconnect the exact edge; verify unrelated edges remain |

Run the least disruptive write first: one known parameter change. Read it
back, then restore it. Continue to module creation, cable creation, update,
and deletion only after the preceding operation has a clear result.

Capture a complete before/after graph at each stage. Verify the requested
delta and the preservation of unrelated modules, parameters, cables, outer
device identity, and sentinel devices on the track. Independent readback must
read current host objects; it must not echo the request or a cached model.

For cable update, report disconnect/connect as a composite operation if that
is the available path. State whether it is atomic, what intermediate state
occurs, and how a failure after disconnect is recovered. Do not call the pair
a native cable-update primitive.

Check duplicate module types, duplicate edges, incompatible ports, stale
handles, deletion with incident cables, and target changes between discovery
and execution. Refuse invalid input before mutation where possible. Record
partial effects otherwise. A read failure must remain distinct from a
completed read that disagrees.

On the isolated fixture, verify that a routing or parameter change reaches
the running engine with a controlled audible or metered witness. Bound the
level and stop the test afterward. A correct document graph alone does not
prove DSP adoption. Save and reload the edited project, reacquire identities,
and verify persistent topology and values. Restore the original baseline and
verify cleanup through a fresh read.

### 5. Close with a bounded verdict

Use separate verdicts for module C/R/U/D, cable C/R/U/D, independent readback,
engine adoption, save/reload, and recovery. Mark each as proved on the fixture,
partial, blocked by a named condition, or not attempted. Record exact host
build and discovered symbols with the result.

Budget the first pass at one working session: about 2 hours for access and
read discovery, then up to 2 hours for a narrow command search and reduced
CRUD cycle if the read gate passes. These are investigation bounds, not a
promise of success. Stop repeated speculative calls after a crash, unresolved
target identity, incomplete required readback, or unexplained collateral
change. Restore the fixture and capture the failure before further work.

Do not silently substitute preset replacement when live editing fails. A
separate fallback verdict can describe export, offline edit, and reinsertion.
Automatic capture still needs file identity and settlement proof; replacement
still needs automation and external-route preservation proof. The jar-key
resolver is not a prerequisite for the live descriptor-read attempt.

## Cost model and measurement

These are starting budgets for the research probe, not measured promises.
One sequential bridge turn is about 24 ms in the ledger. Internal document
work and engine settlement add time; they are not bounded by that number.

| Path | Typical fixture | Largest admitted fixture |
| --- | --- | --- |
| Graph read | 4–8 modules, up to 12 cables; 1 cold capture; target at most 4 turns: acquire/guard, queue, completion/result, final guard; about 96 ms transport floor | 16 modules, 24 cables; same turns and 1 capture; walk depth at most 12, at most 4,096 property visits, 1 MiB encoded result |
| One primitive write with readback | 2 fresh captures (before/after), 1 mutation stage; target at most 12 turns, about 288 ms transport floor | Same counts and caps; budget 2 s elapsed per operation before investigation |
| Cable retarget through disconnect/connect | 2 mutation stages; an intermediate read adds 1 capture; target at most 20 turns, about 480 ms transport floor | Same caps; budget 3 s elapsed; expose both stages and partial effects |
| Discovery | One cold symbol scan per exact build, outside per-operation timing | Narrow class set first; maximum 60 s per scan attempt; do not retain jar-wide class inventories in the live path |

Stop at the property or byte cap and report incomplete data. Heap planning:
allow about 1 KiB per visited property plus 4 MiB for result buffers and
identity tables, at most about 8 MiB of additional retained data per capture.
This estimate needs measurement. Bound scalar/array sizes as well as visit
count; do not retain two complete reflection graphs between calls. Release
object handles at the end of the probe epoch.

The ledger's settled DirectParameter inventory costs about 290 ms, and a
container read costs about 8 turns (190 ms). A descriptor read may avoid
observer settlement, but it performs different work and may cost more. Do
not promise a speedup. Record queue time, document-thread time, completion
time, wire turns, payload size, and heap for both admitted fixture sizes.
Report actual counts if the async protocol requires extra calls. Compare
repeat runs and explain a regression above 20 percent. Add measured probe
numbers to the ledger without replacing unrelated product baselines.

## Acceptance and handoff

Measured gates through [E281](../../evidence/experiments/e281-grid-module-delete-and-persistence.md):

| Gate | State |
|---|---|
| Exact environment, clone pins, and narrow bytecode path | Recorded |
| Probe bounds, identity, incomplete reads, and asynchronous failures | Offline checks pass |
| Research archive and deliberate marker | V8 replacement and the 116-method hello pass in E283. V8 remains loaded. |
| Saved fixture and UI/preset comparison baseline | Recorded; four modules and two cables |
| Complete semantic read, manual delta, selection change, save/reload | Passed on the four-module Poly Grid fixture; module UUIDs change on reload |
| Commands, CRUD, engine adoption, recovery, and cleanup | Parameter write, bounded cable connect/disconnect/retarget, and spare-module deletion pass readback, UI, undo/redo, persistence, and cleanup. Deletion passes with an incoming cable. Detached factory lifecycle passes in E283. Live attachment, layout writes, outgoing-consumer cleanup, and engine adoption remain unproved. |
| Final operation verdict and normal-profile restoration | Module investigation continues; research profile remains deployed. No final 9a close verdict. |

- The evidence records the exact environment, clone pins, fixture baseline,
  discovery method, commands, raw captures, and operation-by-operation verdict.
- A positive live CRUD verdict includes current-host readback, unrelated-state
  preservation, engine adoption, persistence, and baseline restoration.
  A partial verdict names the missing proof without claiming general support.
- Discovery and probes are reproducible on the named build. Unknown builds
  fail explicitly. Store a jar hash with any symbol map; names alone do not
  establish compatibility.
- Keep the implementation research-only. No public tool or description change
  is required for this spike. If a product change is proposed, plan it
  separately with call budgets, description changes, and broader conformance.
- openwig is GPL-3.0; bwpreset is MIT. Record source provenance for any reused
  implementation. Do not assume that a NOTICE entry alone settles reuse.
  Keep vendor jars, keys, and extracted definitions out of committed artifacts.
- Test the probe's bounds, incomplete-read reporting, identity checks, and
  asynchronous failure reporting offline. Run the focused extension checks
  and live fixture sequence needed by the implementation. Do not run unrelated
  live drivers against an unknown controller build.
- Write the next free E record, add its index entry, and update NOW. Update the
  capability record only with measured results. Any worthwhile follow-up gets
  a named planned session after scope selection; other limits stay in the E
  record. Restore the normal archive through the operator replacement process
  and repeat `probe:hello`, or state explicitly that the probe remains deployed.
- Run `LANG=en_US.UTF-8 ruby context/check.rb` and `git diff --check`. Stage only
  session changes. Do not commit.

## Planning retrospective

The overlap matrix hid the difference between a descriptor reader and a
complete live editor. Keep these separate acceptance gates, and use the
device-rooted reader first. This avoids repeating a broad jar search without
an observed Grid object to guide it.
