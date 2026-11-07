# R02 — Independently reproduce note pressure

## Goal and current scope

Distinguish a missing setup condition from a Bitwig public-API defect, then
produce a corrected route or a reproducible upstream report. R01 is running
in a separate worktree; this checkout owns R02. The product's pressure
refusals and warnings remain governed by
[D37](../decisions/d37-note-pressure-is-a-blind-host-limit.md).

## Earlier evidence

- [E15-E](../evidence/experiments/e15-phase-0-findings-bank-window-and-same-request-write-semantics.md)
  tested setter writes. Pressure appeared in the writing cursor, but not in
  other cursors or after retargeting the writer. Sixteen other properties
  persisted. The earlier same-cursor conclusions were retracted. The
  [driver](../../brain/src/probes/e15d-persist.ts) retains the 500 ms waits,
  addresses, control writes, and retarget sequence; it does not retain a
  standalone raw run artifact or inspector confirmation for that sweep.
- [E236](../evidence/experiments/e236-document-edit-limb.md) tested a
  human-authored value separately: inspector Pressure 51%, channel 0,
  pitch 36, cell 0. Its [raw record](../evidence/data/phase8h4c-edit/pressure.json)
  retains three cold and three verbose reads, all zero, on API 25. Those
  routes share `NoteStep.pressure()`. The record identifies the extension
  surface but does not independently identify the application binary or
  timestamp each pressure sample. It is not a current-build reproduction.

## Offline audit — 2026-10-29

The four relevant clone HEADs match the [source register](../plan/overlap/wave-3/sources.md).
A source search across the pinned references found four static `NoteStep`
pressure implementations. Hardware aftertouch handlers are separate.

| Source | Setup and addressing | Pressure handling and evidence limit |
|---|---|---|
| [DrivenByMoss, pin 836117b](https://github.com/git-moss/DrivenByMoss/blob/836117be7c17318a0f93cb414e333516a91a5436/src/main/java/de/mossgrabers/bitwig/framework/daw/CursorClipImpl.java) | Requires API 21; track-owned Launcher cursor, init-time `addNoteStepObserver`, 16-channel cache, initial 0.25-beat step length. `getStep(channel, step, note)` uses the current page. Scalar interests and observer enabling are explicit. | `updateStepPressure` clamps to 0..1 and updates its own `StepInfoImpl` cache before the API setter. During editing, `sendClipData` runs every 100 ms and sends multiple fields; callbacks for actively edited cells are ignored. Other callbacks copy `NoteStep.pressure()` into the cache. No independent pressure readback or pressure test was found in the inspected source. A display update is not persistence proof. |
| [openwig, pin d9ffed4](https://github.com/Axyom/openwig/blob/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d/src/openwig/controller/openwig_bridge.control.js) | `loadAPI(18)`; creates both host-level Arranger and Launcher cursors, preferring Arranger for `gCursorClip`. Registers an Arranger note observer at init. `clip.set_step_size` changes the current grid. | `clip.set_step_attr` gets channel 0 / x / y, rejects an empty step, invokes `setPressure(v)`, and immediately returns the requested value. The observer stores pitch/channel/start/duration/velocity, not pressure. No pressure-specific settlement or independent verification was found. Its preferred target differs from Ghostnote's Launcher target. |
| [Gig Maestro, pin de79a74](https://github.com/gregrossdev/bitwig-extensions/blob/de79a747a62b50e1488cc9ef49617d129804e3ff/gig-maestro/src/main/java/dev/gregross/gig/handlers/NoteHandler.java) | API 25; named track-owned 256 × 128 Launcher cursor. No explicit note-step observer registration was found in its extension/cache setup. Getter and setter address channel 0 at the current grid; step-size changes are separate requests. | `clip/setNoteExpressions` validates pressure 0..1 and invokes the same setter. `clip/getNotes` reads the same cursor, omitting zero pressure. The online notes smoke test waits between operations but checks ordinary note presence/removal, permits skips when notes do not populate, and never tests pressure. The inspected JUnit note tests use mocks; the expression setter assertion is for pan. |
| [daw-mcp, pin a30cbf6](https://github.com/ptaczek/daw-mcp/blob/a30cbf62f8741265550fc2d638b0cd56559255e6/bitwig-extension/src/main/java/com/pxaudio/bitwigmcp/handlers/ClipHandler.java) | Requires API 18; selection-following track-owned Launcher cursor, configurable size/grid initialized with `setStepSize`; explicit clip/track scalar interests. No note-step observer registration was found in extension initialization. Setter accepts a channel, defaulting to 0. | `setNoteProperty` gets the addressed step and calls `setPressure`, then returns success. Note reads use that same cursor. No pressure assertion was found in its retained end-to-end prompts/results, nor independent observer/readback proof in the handler. |

The installed API 25 documentation defines `pressure()` as a 0..1 value and
`setPressure(double)` as updating a note **started** at that position. Both
date to API 10. It documents no extra pressure subscription or explicit
commit/flush call. `addNoteStepObserver` observes note steps; `setStepSize`
changes the beat duration represented by x. This supports testing settled
`NoteOn` cells on a fixed grid, not setting properties immediately after
creating a note or changing the grid. Ghostnote's old E15 probes separated
those stages; the new experiment keeps that separation explicit.

The API pages inspected are the installed `NoteStep.html`, `Clip.html`, and
`CursorClip.html` under
`/Applications/Bitwig Studio.app/Contents/Resources/Documentation/control-surface/api/com/bitwig/extension/controller/api/`.
The existing production getter and observer already call `NoteStep.pressure()`;
the raw handler calls `setPressure`. No inspected source supplied a missing
pressure-specific setup step. This is a source-audit result, not proof of a
current host defect.

GitHub issue searches on 2026-10-29 covered DrivenByMoss pressure, openwig
pressure, Framework4Bitwig pressure, and `"setPressure" Bitwig`:

- [Framework4Bitwig #236](https://github.com/teotigraphix/Framework4Bitwig/issues/236)
  reported stale inspector displays for several expression setters. Selecting
  another note and returning refreshed the display. The thread marked the
  fix complete in December 2019. It motivates an inspector reselection
  control; it does not establish the present getter/persistence defect.
- [DrivenByMoss #244](https://github.com/git-moss/DrivenByMoss/issues/244)
  requests Akai Fire pressure/timbre editing; the response adds it to a
  wishlist. It supplies no independent pressure result. Other pressure hits
  concerned live hardware aftertouch or unrelated feature requests.
- No matching modern static-pressure reproduction was found in those
  searches. This is a bounded search result, not a claim that none exists.

## Reproduction prepared

Inspect the pinned reference implementations, installed API 25 contract,
observer registration, grid/channel addressing, update timing, and evidence
of independent verification. Search upstream issues separately from source
inspection. Static note pressure, expression envelopes, and live MIDI
aftertouch are separate subjects.

Prepare a probe-only public-API path with two independently observed cursor
clips, direct `getStep`, `pressure`, `setPressure`, and velocity calls. It
must bypass the document codec, planner, and `NoteHandlers`. Preserve raw
getter samples and observer callbacks, with bounded waits and a build marker.

Use one owned track, `gn-r02-pressure`, with two four-beat Launcher clips:
`gn-r02-notes` at slot 0 and `gn-r02-park` at slot 1. At a fixed 0.25-beat
grid, the test clip has distinct note starts: channel 0 / x0 / pitch60
(zero control), channel 1 / x4 / pitch62 (human pressure), channel 0 / x8 /
pitch64 (setter pressure), channel 0 / x12 / pitch65 (velocity control).
The operator sets the second note's Pressure to 51% and changes its velocity
to a distinct value, recording the inspector values and confirming its
identity. The velocity change is a positive control for human-edit observation.
Capture both readers before writes. Write pressure 0.75 once to the third
note, inspect both cursors and the inspector, then separately write velocity
0.5 to the fourth note. Do not repeat an uncertain write. Retargeting the
writer away and back tests cache persistence separately. Inspector checks
include deselecting and reselecting the note to avoid a stale display.

Before live work, verify the deployed probe, fresh initialization, active
project, selection, and competing drivers/clients. The handler must bind its
writes to the owned track, exact clip, session, and note starts. No playback
or save is needed. Remove the owned fixture afterward and verify original
tracks and selection. Reopening a saved fixture is a separate experiment if
the first reproduction leaves a persistence question.

## Completion

Record exact host/build identifiers, extension source and archive hash,
timings, raw reads/callbacks, operator observations, and cleanup. If confirmed,
prepare the upstream report before filing. If inconclusive, identify the
missing condition instead of declaring a defect. The preparation checkpoint below predates the completed live result.
The final session result and local report are recorded at the end of this brief.

## Offline result and resume point

The [public-API probe](../../extension/src/main/java/com/ghostnote/extension/PressureProbe.java)
has independent writer/reader clips and init-time callbacks, fixed cells and
grid, exact fixture/session checks, and one attempt per setter case even if
the setter throws. Its [transport wrapper](../../extension/src/main/java/com/ghostnote/extension/handlers/PressureHandlers.java)
exists only in the probe profile. Normal tools and D37 behavior are unchanged.
The [foreground driver](../../brain/src/probes/r02-pressure.ts) records raw
wire exchanges and bounded samples at approximately 0/100/500/1500 ms. It
uses product tools only to create/remove the fixture, then direct public-API
reads/writes for the experiment. A disk attempt marker prevents resending a
setter case after a timeout. Callback target labels are observed values and
can lag during retargeting; use settled getter identities to interpret them.

The user paused host work: “I need to quit Bitwig for a while - continue until
you would need it again and then stop.” No deployment, Bitwig connection,
scratch creation, pressure write, or upstream submission ran in this session.

Resume when Bitwig is available:

1. Recheck competing Ghostnote clients/drivers. Deploy from `extension/` with
   `./gradlew copyProbeExtension`, then ask the operator to replace the
   controller with **ghostnote probe**. No replacement is currently pending.
2. After confirmation, run `npm run probe:hello` from `brain/`. Require
   `phase-8-probe-v1`, 122 methods, hash `a8455ecb24cf6f8c`, a fresh init time,
   and marker `r02-pressure-v1`. Record the application binary/version and
   deployed archive hash. No Grid write is part of this experiment.
3. Recheck the project and selection. From `brain/`, run
   `node --import tsx src/probes/r02-pressure.ts setup OUT PROJECT`, with a
   new evidence directory and the exact confirmed project name. Setup must
   confirm all four note identities in both readers before continuing.
4. Record the operator's human pressure/velocity edits and run `read OUT`.
   Run `pressure OUT`, inspect both reader results and the reselected note's
   inspector, then decide whether to proceed with `velocity OUT`. Record each
   actual observation. The writer echo is diagnostic only.
5. Use `away OUT`, confirm the writer reached the empty parking clip, then
   `back OUT` to test loss of the writer cache. Do not infer persistence from
   a failed retarget. Run `cleanup OUT` only after the necessary observations
   are retained. It removes the owned track and checks original track names,
   identities, and selection. Recheck preservation if any step fails.
6. Write the current-build E record and concrete upstream draft only after
   this evidence is collected. Restore the normal controller before returning
   to product work, following the usual replacement and handshake procedure.

Offline verification passed:

- `./gradlew check`: all extension harnesses and archive checks, including
  R02 target/session/settlement refusals, independent clip allocation, and
  one-attempt behavior after a thrown setter; normal/probe isolation and the
  write-gate classification also pass.
- `npx tsc --noEmit` and the 56 wire-contract tests.
- `node --import tsx src/probes/r02-pressure.ts check`: parses the intended
  note addresses and exercises fixture creation and removal on the fake
  adapter, preserving the original track identities and names.
- `LANG=en_US.UTF-8 ruby context/check.rb` and `git diff --check`.

These checks do not establish host behavior. The fixture's live pointing,
callback delivery, inspector observations, and cleanup still require the
focused live run. No public description change or version bump is needed for
this probe-only addition. Changes are staged without a commit; suggested
commit: `research: prepare independent R02 pressure reproduction`.

## Live resume — 2026-10-29

The operator resumed: “Bitwig is ready now - proceed.” No established bridge
client or foreground probe driver was present; unrelated idle editor MCP
processes were left alone. `./gradlew copyProbeExtension` passed its runtime
profile check and atomically deployed the R02 archive. The
[deployment record](../evidence/data/r02-pressure/deployment-01.json) retains
the installed Bitwig 6.1.4 binary hash, deployed archive hash, exact probe and
driver source hashes, and expected handshake. Operator replacement with
**ghostnote probe** is pending. Run `probe:hello` only after confirmation;
no R02 host request or fixture write had run at that checkpoint.

The operator then replied “Controller replaced”. The
[handshake](../evidence/data/r02-pressure/hello-02.txt) passed on initialization
`2026-10-29T13:49:14.427Z`. The first attempt failed in the local tsx IPC
sandbox before connecting. The
[setup record](../evidence/data/r02-pressure/live-01/1793281818849-setup.json)
retains the baseline, fixture creation, four snapshots from both readers,
callbacks, and the full wire exchange. Both readers confirmed the exact four
note starts and zero pressure. Owned track ID:
`d9ca38aa-221e-4ae1-b02f-f14fa3a9e644`.

Setup stopped at its final selection comparison: clip creation changed an
empty Launcher selection into the owned test clip; the original `gn-sel`
mixer identity was preserved. The successful fixture was inspected and kept,
not recreated. The driver now reports this bounded setup effect instead of
claiming that an empty selection was restored. The
[state review](../evidence/data/r02-pressure/live-01/state.json) explicitly
retains the original incomplete setup verdict and the evidence used to
establish fixture readiness. TypeScript and the offline fixture check pass
after that correction. No extension change or new deployment was needed.

## Session result — 2026-10-29

[E399](../evidence/experiments/e399-pressure-getter-blindness-live.md) is the
measurement record. The human screenshot showed pressure 51% and velocity
60%; both independent API handles saw velocity 0.6 and pressure zero. A single
`setPressure(0.75)` changed E3's inspector to 75%, while the separate reader
stayed zero. A single velocity control write read back as 0.5 in both handles.
Both cursor handles retargeted to the empty clip and back; the writer's 0.75
echo became zero, yet reselected inspector values remained 75% and 51%.

The source audit found no missing pressure-specific subscription/commit step.
This is a confirmed getter/observer disagreement on the tested route, not
proof that the setter is inert. No saved-file reload or playback test ran.
[D66](../decisions/d66-pressure-refusal-is-a-verification-limit.md) corrects
D37's rationale without relaxing product admission. Current refusal messages,
fidelity/revert explanations, capability and host-binding documentation now
say that independent verification is unavailable. The 46-tool description
artifact is v58; frozen legacy descriptions and earlier E/D records remain.

Scratch deletion succeeded. An independent inventory read confirms all eleven
original IDs/names and the original mixer selection. The cleanup assertion
failed because `selection.status` retained deleted index 9 / slot 0, even
though the UI showed no selected item and an empty editor. No write was
repeated. Raw failure evidence and the later review remain; the state file
marks removal verified, not the raw cleanup command as passed. Selection
observer invalidation on track deletion is an outstanding follow-up outside
this pressure reproduction.

The normal archive was redeployed successfully. Operator replacement with
**ghostnote** was requested but is unconfirmed; the fresh normal handshake
must wait for that reply. No live write is needed to complete this experiment.
The [restoration record](../evidence/data/r02-pressure/normal-restoration.json)
retains the deployed archive hash and status. Claims must be re-established
before future host work.

The [upstream report](r02-pressure-upstream-report.md) remains local. The user
clarified: “I mentioned that I would file upstream if this issue was
reconfirmed.” The workflow sequence is corrected: the user handles filing;
no agent contact, submission or transmission is authorized. A Chrome support
page opening was attempted but failed because that browser surface was
unavailable. No report, message or attachment was sent.

Verification after the live result:

- `./gradlew check` passes, including the new pressure probe admission,
  consumed-attempt checks, profile isolation and archive checks.
- `npm run typecheck` and the offline fixture driver check pass.
- The full brain suite ran 2,602 tests: 2,600 passed; two assertions expected
  the superseded refusal wording. Those assertions now check the verification
  explanation. All 214 tests in the affected model, surface and description
  suites pass on rerun. No failing test remains. The initial sandbox attempt
  failed before tests because tsx could not open its IPC pipe; the approved
  rerun executed the suite.
- Context links (795 documents), changed anchors, and diff whitespace checks
  pass. The v58 description hash is
  `36e7ef9662dfb7abd62bfe6db8fa5bbbd2703bb23362d38d6e6a6c8866748c46`.
  Normal wire remains 93 methods / `d6decf985f6b1f36`; no product call budget
  or runtime write path changed. This record was first numbered E370; the
  merge with R01's records (E353–E393) renumbered it E399, and D56 became D66.

Task changes are staged without a commit. Suggested commit:
`research: reproduce pressure readback blindness and correct write rationale`.

## Targeting clarification — 2026-11-07

The report's earlier “because they share the cursor track” explanation was
an inference, not an isolated measurement. E399's recorded co-retargeting
stands, but its causal attribution should not be treated as established.
The driver calls `cursor.pointExpanded` before `writerAway`/`writerBack`:
`GroupPoint` unpins the source clip, selects the target track's slot, selects
that channel on the shared CursorTrack, and repins the source before the
probe calls `writer.selectClip(source)`. No sample separated those stages.

Both probe handles use the unnamed `createLauncherCursorClip(16, 128)`
overload. The installed API also offers an overload with an ID and name;
this run did not compare distinct IDs or distinct parent cursors. Its docs
say `selectClip` selects the supplied clip in this cursor and pinning stops
following user selection; they do not establish sibling-target independence.
Do not infer the host's internal cursor identity from separate Java objects.

The product pool instead allocates one uniquely named CursorTrack per clip
cursor. E36 records successful different-clip reads through separate pool
cursors. This probe does not establish a pool-wide retargeting defect or
behavior across earlier versions. The local upstream draft now reports the
observed movement and exact sequence without asserting its cause. No live
operation was performed for this clarification.

## Minimal reproduction — prepared 2026-11-07

The user requested the smallest reproduction before another live check.
[PressureGetter.control.js](../../extension/repro/pressure-getter/PressureGetter.control.js)
is a standalone API 25 script with one selection-following Launcher clip view
and a Read button. It reads `getStep(0, 0, 60)` state, velocity and pressure;
there are no note observers, setters, pins, cursor-track objects, delays,
retargets, or automatic fixture operations. The fixture is one manually
created note at the start of one Launcher clip, channel 1 / pitch 60,
velocity 60% / pressure 51%. The button callback is a signal observer, not a
note observer. State and velocity appear in the same output line so pressure
zero cannot be mistaken for proof while the intended note is unavailable.

API signatures were checked against the installed API 25 documentation;
`node --check` passes. Host behavior remains pending. This standalone script
has no Ghostnote bridge, so the archive deployment/hello procedure does not
apply to it. The operator loads **Repro → Pressure Getter**; its versioned
output identifies the loaded script. No live call or fixture write has run.

Installed the exact script at
`~/Documents/Bitwig Studio/Controller Scripts/PressureGetter.control.js`.
Source and installed SHA-256 match:
`e1849d8203d93b334de78202598f50014e4733d5aaa3e5dbe9cd015621e50f06`.
Operator loading and the one-note live check are pending. Context links and
diff checks pass; these preparation changes are staged without a commit.
Suggested commit: `research: add minimal observer-free pressure getter repro`.

## Closeout — 2026-11-07

The user confirmed: “Great, I have filed the report with the clean minimal
repro. Record this outcome and we'll wrap up.” R02's local work is closed;
any upstream response or follow-up is external. The user performed the
filing. No agent message, submission or attachment upload was made.

The filed reproduction is the standalone, one-note observer-free script.
The exact submitted text, ticket reference and minimal-run console output
were not supplied, so this closeout records the filing confirmation without
inventing a new live measurement or claiming the local draft is the exact
submission. E399 remains the retained measured evidence; earlier E/D records
are unchanged. Product pressure refusal remains governed by D66.

No additional host operation ran at closeout. The earlier normal-controller
replacement/handshake remains unconfirmed, and the minimal script remains
installed. The prior scratch removal and Launcher selection-reporting
exception retain their recorded scope. Re-establish live state when host
work resumes; these caveats do not hold the requested local closeout open.

Updated NOW, backlog, the local report and repro instructions. Documentation
links and diff checks pass. Changes are staged without committing.
Suggested commit: `research: close R02 with user-filed minimal pressure repro`.
