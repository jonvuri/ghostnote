---
title: Bitwig update audit driver
kind: reference
state: active
updated: 2026-10-21
parent: 9b-update-audit.md
---

# Bitwig update audit driver

This is the execution guide for [section 2](9b-update-audit.md#2-agent-implement-now-then-run-on-the-new-version).
The driver is [bitwig-upgrade-audit.ts](../../../brain/src/probes/bitwig-upgrade-audit.ts).
The [cost model](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#9b-update-audit-driver-model-before-implementation)
applies before live use. Public tool descriptions remain v52.

The completed 6.1.4 audit is accepted in
[E330](../../evidence/experiments/e330-update-audit-614-acceptance.md).
Continuation 4 has no missing case, pending action, or owned object.
Do not rerun the completed commands. The instructions below retain the
procedure and recovery history; 9b.6 uses its own separate preparation.

## Offline preparation

From `brain/`, run this command only for a new directory:

```sh
node --import tsx src/probes/bitwig-upgrade-audit.ts prepare ../context/evidence/data/bitwig-upgrade-audit/preparation
```

Preparation copies the repository single-sample and multisample one-LFO
Sampler presets. It records source hashes, metadata, route inventories,
and all seven retained Sampler preset inventories. It also records the
named composition targets. No source file changes. No catalog is rebuilt.
The generated configuration is an example; its handoff flags are false.

The fixture contains six instrument tracks: a preserved sentinel, notes,
a spare track, a device track, and two Samplers. A track copy adds a seventh
instrument track for one case. The operator can add one group for the
collapsed navigation check. Four-note clips use two MIDI channels, mixed
plain and expressive notes, non-quarter-grid timing, and loop metadata.
No scene is created. Start with seven or eight scene rows and at most eight
empty entry tracks. The stricter product limits still apply.
Select an empty Launcher slot on a preserved entry track before preflight.
Keep a preserved mixer track selected. E258 documents that clip creation
cannot restore an absent prior slot selection. Preflight now refuses that
entry condition before the fixture can be created.

## Section 2B entry

Do not run a live command until the operator reports all section 1 items.
Read the release notes for the exact chosen patch. Verify the running app
path, jar hash, bridge port owner, and competing drivers and clients.
Keep the original projects and backups closed.

Deploy `./gradlew copyExtension` from `extension/`. The operator must fully
remove the controller and select the final matching `ghostnote` product in
the complete list. Wait for confirmation, then run `npm run probe:hello`.
Require normal-v1, 92 methods, hash `8be1975eaa99d78f`, current product
markers, and initialization after deployment and replacement. A toggle or
the orange detected-controller button does not reload Java classes.

Copy `preparation/config.example.json` to `preparation/config.json` and fill
its facts after this handoff. Use the exact host version string. Record the
actual backup and working paths, recovery check, missing-asset result,
app and jar identities, built and deployed archive hashes, bridge PID,
and replacement time. Confirm the selected plug-in is already installed;
Diva CLAP is the retained default. Do not install a plug-in for this test.

All commands below run from `brain/`. `<dir>` is the absolute preparation
directory. Each command uses a fresh adapter and workspace. It reads current
host identities. Persisted state grants no document reference, change ID,
or native claim to a new process.

```sh
npm run probe:upgrade-audit -- preflight <dir> <dir>/config.json
npm run probe:upgrade-audit -- run <dir> setup
npm run probe:upgrade-audit -- run <dir> notes
npm run probe:upgrade-audit -- run <dir> clips
npm run probe:upgrade-audit -- run <dir> mixer
npm run probe:upgrade-audit -- run <dir> controls
npm run probe:upgrade-audit -- run <dir> structure
npm run probe:upgrade-audit -- run <dir> sampler
```

Run one command at a time. Do not start the next command after a failure.
Each case records full wire requests and responses, tool results and costs,
and separate entry/exit reads. The driver checks project, version,
initialization, stopped transport, owned targets, and selection before each
write. Each normal product writer keeps its own freshness and selection
guards. The final comparison includes preserved entry state and the sentinel.

The driver checks the current bridge PID and its executable path before a
connection. It refuses another Node/tsx probe and any established bridge
connection. Idle MCP servers can remain. This is an entry check, not a lock
on other clients; do not start another client during the audit.
It does not stop a process. A directory lock prevents two chains from using
the same record. A stale lock needs inspection; do not remove it to retry
an uncertain write.

## Matrix and independent evidence

| Plan row | Driver case or checkpoint | Independent evidence |
| --- | --- | --- |
| Startup and discovery | `preflight`, repeated at each command | Exact normal method set; hello, host, markers, initialization, process/path, local jar/archive hashes, project, tracks, selection |
| Notes and clip documents | `notes` | Fresh complete documents after sparse and desired writes and reversals; unrelated expressive notes and metadata remain |
| Clip and track structure | `setup`, `clips`, `cleanup` | Nonadjacent row 4 copy, row 6 move, empty slots, source content, occupied-destination refusal with zero write batches, track copy identity and deletion |
| Mixer and selection | `mixer`, selection and group checkpoints | Raw mixer reader; all four fields and reversal; selected track and group folding remain |
| Device controls | `controls` | Fresh direct parameter inventories across two Polysynth instances and one installed plug-in; other instance remains; values restored |
| Device structure | `structure` | Complete FX Layer banks, nested add/copy/move destinations, preserved siblings, enable/disable, explicit removal |
| Presets and modulation | `sampler` and `sampler-observation` | Copied donor inventories, independent live controls/pages, host-saved edited preset routes, operator resource/zone checks, reversal and source hashes |
| Freshness and lifecycle | `notes`, selection and switch checkpoints | Old document reference refuses with zero write batches; content comparison; fresh project reads and a new mixer write/reversal |
| Persistence and playback | save/reopen checkpoints and Sampler observations | Pre-save complete snapshot, saved file copy/hash, equal reopened content, unchanged file on reopen, operator listening and route checks |

The structure case explicitly removes its container. It does not claim a
typed reversal of a move. The clip copy changes identity after a move;
its old change ID cannot remove that clip. The case reads and deletes the
owned copy with the current product operation.

## Sampler export pauses

Run `sampler` with interactive stdin. After each supported attack-route edit,
the driver asks the operator to save the **second** Sampler on the named
track to a new path under the working folder. It then waits on stdin with
no host calls or polls. Keep this one foreground process alive. Operator
wait time does not count toward the active case deadline.

After the export, record one JSON line with these fields:

```json
{"operator":"operator name","resourcesResolved":true,"zonesChecked":true,"selectionRestored":true,"details":"Actual sample names, zone observations, and missing-file result"}
```

Only record facts the operator confirmed. Restore the prior selection before
submitting. The driver reads the new host-saved file with the preset parser.
It requires all original routes and one new attack route at amount 0.3.
It keeps the export, hash, route inventory, metadata, and operator report.
It then reads the current guards and performs the supported in-session
reversal. A missing route, unknown format, or uncertain reply stops the chain.

For the multi resource check, open the second Sampler's Expanded Device
View with the outlined rectangle in its left header, above Remote Controls.
Choose All Zones and inspect the list on the left. Select one zone at a
time to show its waveform below. Record sample names, loaded waveforms,
missing-resource indications, and zone count or ranges. Do not drag zones
or change their ranges. See the
[Sampler guide](https://www.bitwig.com/userguide/latest/synth/) and
[Expanded Device View guide](https://www.bitwig.com/userguide/latest/introduction_to_devices/).
Audible output from the device does not prove that every zone is loaded.
If audition changes mute or volume, restore the audit tracks to muted and
-18 dB before resuming, as well as both selection states and stopped transport.

The normal readers do not expose all sample zones or route amounts. The
host export supplies the route evidence; operator inspection supplies the
resource and zone evidence. The loader reply does not prove either claim.
The source inventory reports the three removed modulation targets separately.
Record host absence, refusal, or migration; do not call a silent loss preserved.

## Operator checkpoints

Each lifecycle checkpoint ends the process and prints the next action.
There is no wait loop. Use `checkpoint <dir> <name>` for these steps:

1. `selection-before`: select the named sentinel mixer track.
   `selection-after`: the driver checks the selection change and does a
   mixer write/reversal. Restore the printed original selection, then run
   `selection-restored`.
2. `group-before`: group only the named notes and spare tracks and collapse
   the new named group. `group-after` runs the note case through the collapsed
   group. Ungroup those tracks, remove the empty group, restore the printed
   selection, and run `group-restored`. The driver never adopts a manually
   added group by its name for deletion.
3. `switch-before`: open a separate stopped `gn-upgrade-audit-switch` project
   under the working folder. Run `switch-away`, return to the audit project,
   restore selection, and run `switch-back`. The away check is read-only.
4. Inspect the retained attack mapping and resources in both original
   Samplers. Record the facts for the observation file below.
5. `save`: ask the operator to save only the audit project and leave it open.
   Wait for save confirmation. `saved` captures its file and hash. Only then
   ask the operator to close and reopen that same working project. Keep it
   stopped, restore selection, and run `reopen`. The driver compares content before it
   reacquires target IDs. It then tests a fresh mixer write and reversal.
6. Inspect both Samplers again. Do one short listening check with the two
   fixtures. The operator starts and stops playback. Restore mute, mixer,
   and selection values before continuing. Do not use a research stop call.
7. Run `checkpoint <dir> sampler-observation <observations.json>`.

The observation file requires `operator`, `observedAt`, `playbackStopped`,
and `single`/`multi` reports. Each report requires `resourcesResolved`,
`zonesChecked`, `audible`, `attackMappingBeforeSave`,
`attackMappingAfterReopen`, and concrete `details`. Set a boolean to true
only after the operator confirms the fact. Each report also has exactly
three `removedTargets` entries, named `Play Mode`, `Freeze Playhead`, and
`Envelope Mode`. Each entry needs `verdict` (`absent`, `refused`, or
`host-migrated`) and an `evidence` string. A required failed or unobserved
fact cannot pass the checkpoint.

## Inspect, cleanup, and failure

```sh
npm run probe:upgrade-audit -- inspect <dir>
npm run probe:upgrade-audit -- cleanup <dir>
```

Inspection reads state without a write. Cleanup requires the same inspected
state, the original channel identities, and an equal preserved baseline.
A pending uncertain write blocks deletion until a recovery plan is reviewed.
Cleanup removes only the proved owned tracks. It checks their absence and
the complete preserved state. Save the clean audit project when prompted,
then run `checkpoint <dir> cleanup-saved`. Run `report <dir>` last.

A failed or interrupted case cannot resume. Do not edit the record to clear
`failure`, `active`, or `pendingWrite`. Keep failed evidence. Inspect the
state and prepare a concrete recovery or correction under section 2B before
another write. There is no automatic cleanup in `finally` and no reconnect.

The first 6.1.4 setup attempt stopped on this documented no-entry-slot
warning. Its independent inspection confirms six owned tracks and one
verified sentinel clip. The `recover-empty-selection` command is limited
to this exact failure and seven-write sequence. The operator first selects
row 0 on the original mixer track. Recovery checks the current content
against the inspection, all owned identities, and the complete unowned
baseline. It then removes the six owned tracks and checks the final content
and selected empty slot. The failure record remains. Recovery cannot resume
or run twice. A new attempt requires a new evidence directory. This does
not claim to restore the original absence of a slot selection.

The second attempt passed setup, notes, clips, and mixer. Its control case
stopped because the driver read the boolean `verified: true` as an object.
`recover-control-reply` is limited to that exact write sequence. It requires
the complete reply and independent control values, proves all other fixture
state unchanged, records resolution of the pending intent, and removes only
the three inserted devices. The complete fixture must match the last passed
case. The original failure and resolved intent remain in the source record.

After this recovery, `fork-recovered <source-dir> <new-dir>` creates a separate
continuation. It keeps the passed case list and records hashes for their
source evidence. Each new live command verifies those hashes and the current
fixture. It does not carry a document reference or a change ID. Run the
failed controls case from its start, then the remaining cases. Do not rerun
the passed note, clip, or mixer cases only to replace the failed record.

The first continuation stopped after disabling its FX Layer. The first
enabled-state read was stale; later independent reads prove the disabled
state. A stale layer count also prevented the first two complete inspections
after switching from FX Layer to Sampler. The tested adapter corrections
bound the enabled-state reads and use the host's non-layer capability to
interpret an empty layer bank. Named-slot coverage does not change.

`recover-structure-readback` requires the exact failed structure sequence,
the observed disabled container, both known nested chains, and unchanged
content elsewhere. It restores enabled state with one new guarded write,
reads the complete nested result, deletes only the owned container, and
checks the full fixture. It does not repeat the failed disable. After a
successful recovery, `fork-recovered` can carry the passed controls case
and earlier evidence into a new continuation. Source proof hashes are
transitive. Rerun structure from its empty device-bank baseline.

E320 records successful structure recovery and a passed structure case in
`continuation-2-614`. Its Sampler case then stopped after inserting the second
Sampler on `gn-ua-0b6c3297-single`. The target ID is present, but the host
reports `Gated Attack Time` instead of `AEG Attack Time`. The operator export
request and required observations are in
[E320](../../evidence/experiments/e320-update-audit-614-device-compatibility.md#sampler-stop-and-next-step).
The command exited; there is no input pause to resume. Do not reuse its
change ID. [E321](../../evidence/experiments/e321-update-audit-sampler-library-export.md)
verifies the library export and complete live content. The name correction
passes offline checks. Both mixer and Launcher selection must be `Inst 1`
row 0 before recovery; selecting the cell alone did not change the mixer.

`recover-sampler-name <dir> <host-export>` checks that exact failure and
insertion, the two saved routes, sample references, the complete live pair,
and unchanged content elsewhere. It deletes only the inserted position 1,
then checks the full fixture. It preserves the original failure. [E322](../../evidence/experiments/e322-update-audit-sampler-recovery.md)
records successful recovery. Continuation 3 passes the corrected identity
check. [E323](../../evidence/experiments/e323-update-audit-single-sampler-pass.md)
passes the fresh single export and reversal.
[E324](../../evidence/experiments/e324-update-audit-sampler-case-pass.md)
completes multi and the full case comparison. After
[E325](../../evidence/experiments/e325-update-audit-selection-write-pass.md),
`selection-restored` and `group-before` pass.
[E326](../../evidence/experiments/e326-update-audit-collapsed-group-pass.md)
records the group snapshot correction. A group Launcher slot represents
aggregate occupancy; it has no readable clip document. The snapshot records
that occupancy and reads each child clip through its own track ID.

`recover-group-snapshot <dir>` admits only the exact pre-write `group-slot`
refusal, with no pending write and a bounded log of reader calls. It checks
the complete grouped fixture and sends no write batch. `fork-recovered`
keeps the original ungrouped checkpoint and pins all parent proofs.
Continuation 4 passes the corrected `group-after` check. The subsequent
`group-restored` check proves complete baseline and selection equality.
[E327](../../evidence/experiments/e327-update-audit-project-switch-pass.md)
passes switch-away and the fresh return mixer write/reversal. Complete
fixture and both selections match the pre-switch baseline. The operator
confirmed the original Samplers' Attack mappings and loaded waveforms in
[the before-save observation](../../evidence/data/bitwig-upgrade-audit/continuation-4-614/sampler-before-save-operator.json).
The save and saved checkpoints pass. The saved evidence copy matches the
working file at 72,901 bytes. Preserve the copy and its
[identity](../../evidence/data/bitwig-upgrade-audit/continuation-4-614/saved-file-verification.json).
[E328](../../evidence/experiments/e328-update-audit-reopen-pass.md) passes
reopen file identity, full fixture equality, and the fresh mixer write/reversal.
Continuation 4 has no pause. The operator confirmed both original Samplers'
mappings and healthy waveforms after reopen and restored selection. The
listening check passes: the operator heard both Samplers. Multi was a bit
quiet with no other audible problem. Complete fixture restoration and
`checkpoint sampler-observation` pass.
[E329](../../evidence/experiments/e329-update-audit-listening-and-cleanup.md)
records the independent inspection and six-track cleanup. The preserved
entry matches. The operator saved the clean working project; `cleanup-saved`
and `report` pass. [E330](../../evidence/experiments/e330-update-audit-614-acceptance.md)
records final acceptance. Continuation 4 has no pause or missing check.
Do not overwrite the saved persistence evidence copy.

The combined observation input retains the confirmed before/after inspections
and listening report. The checkpoint file contains live snapshots. The
[removed-target evidence](../../evidence/data/bitwig-upgrade-audit/continuation-4-614/removed-target-evidence.json)
records the three absent target names. This evidence covers preserved live
control lists and complete source/host route inventories. The donors contain
no removed-target routes, so their migration or rejection is not tested.
The stopped-state return check required no engine change. The operator
later activated the audit project's engine for listening. Exclusive engine
ownership was not independently measured.

For later exports, ask the operator to use Save Preset to Library with the
exact requested name. Find the file under the configured user library; in
this session it is `Documents/Bitwig Studio/Library/Presets/Sampler/`.
Copy it without replacing an existing destination, compare bytes, and retain
its identity. Copy during the operator pause, before supplying the required
observations to the driver. No host calls run during the pause. Require both
mixer and Launcher selection to be restored before resuming.

`live-matrix-complete` requires all cases, human checkpoints, and cleanup.
E330 completes section 3 with exact-build release notes, per-call performance
comparisons, limits, and the upgrade verdict. The separate 9b.6 Grid doctor
still requires its own offline discovery, prepared build, and fresh consent.
