---
title: Bitwig 6.1.x update audit
kind: plan
state: active
updated: 2026-10-21
parent: README.md
next: 9b-grid-breadth-discovery-and-build-out.md#session-9b6--doctor-on-61x
---

# Bitwig 6.1.x update audit

## Scope and start

The operator approved this plan on 2026-10-21. Implement the general
Ghostnote upgrade audit now. The operator does section 1 while the agent
implements section 2A. Do not wait for the update to start offline work.
Section 2B starts only after the operator confirms the section 1 handoff.
Section 3 records the result and prepares the separate 9b.6 session.

This session covers the normal Ghostnote product on one exact 6.1.x build.
It includes Sampler presets and modulation. It does not run native Grid
commands, repeat the completed 6.0.6 doctor, or repeat the 9a audio flow.
The 6.1.x Grid resolver and doctor remain in
[9b.6](9b-grid-breadth-discovery-and-build-out.md#session-9b6--doctor-on-61x).

Read these sources before implementation:

- [NOW](../../NOW.md), [AGENTS.md](../../../AGENTS.md), and
  [E316](../../evidence/experiments/e316-grid-doctor-606-acceptance.md).
- [E40 regression policy](../../evidence/experiments/e40-remote-ci-passes-and-session-5-has-a-regression-policy.md),
  [E272 interface verdicts](../../evidence/experiments/e272-8i-gate-close-out.md),
  and the [8i runbook](../phase-8/8i-automated-dogfood-runbook.md).
- [Performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md) and
  [D15 verification](../../decisions/d15-verification-discipline-settled-2026-07-25.md).
- [Bitwig 6.1 release notes](https://downloads.bitwig.com/6.1/Release-Notes-6.1.html)
  and the release notes for the exact patch selected by the operator.

## 1. Operator: preserve 6.0.6 and install the update

Use these two new local folders. In Finder, use Go to Folder to enter paths.
Keep both folders outside cloud synchronization. If a folder already exists,
use a new suffix and report the actual path. Do not merge with an old backup.

- Backup: `/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1/`.
- Working copies: `/Users/jonvuri/Bitwig Upgrade Work/2026-10-21/`.

### Preserve the project before quitting

1. Stop playback. Keep the current Grid control unchanged. E316 proves its
   in-memory state only; it does not prove that the saved project is equal.
2. Before saving, copy the complete folder
   `/Users/jonvuri/Documents/Bitwig Studio/Projects/gn-grid-spike/`
   to `projects-before-save/gn-grid-spike/` inside the backup folder.
   This preserves the existing disk state separately from the current state.
3. In Bitwig 6.0.6, use Save As to save the current project into
   `gn-grid-spike-recovery/` inside the working folder. Use the filename
   `gn-grid-spike-recovery.bwproject`. Preserve referenced project assets;
   use Collect and Save when needed. Do not overwrite the original project
   or `gn-grid-spike-baseline.bwpreset`.
4. Quit Bitwig. Copy the complete recovery project folder to
   `projects-recovery/gn-grid-spike-recovery/` inside the backup folder.
   Report any save or missing-file error before proceeding.

### Copy the installation and user state

With Bitwig closed, copy each source below to the named destination inside
the backup folder. Copy the complete folders, including hidden files. Use
Finder copies or another method that preserves bundle links and attributes.
Rename only the outer app bundle. Do not edit files inside it.

| Source | Destination inside the backup folder | Action |
| --- | --- | --- |
| `/Applications/Bitwig Studio.app` | `apps/Bitwig Studio 6.0.6.app` | Copy the complete app, then rename the copy. Keep the original in Applications for the update. |
| `/Users/jonvuri/Library/Application Support/Bitwig/Bitwig Studio/` | `user-state/Bitwig Studio/` | Copy the complete folder while Bitwig is closed. This includes settings and library state. |
| `/Users/jonvuri/Library/Preferences/com.bitwig.studio.plist` | `preferences/com.bitwig.studio.plist` | Copy the file. |
| `/Users/jonvuri/Library/Preferences/com.bitwig.studio.plugin.host32.plist` | `preferences/com.bitwig.studio.plugin.host32.plist` | Copy if present. |
| `/Users/jonvuri/Documents/Bitwig Studio/` | `documents/Bitwig Studio/` | Copy the complete folder. This preserves Projects, Library, Extensions, and Controller Scripts. |
| `/Users/jonvuri/.ghostnote/` | `ghostnote/config/` | Copy the complete folder, including `rig.json`. |
| `/Users/jonvuri/Development/ghostnote/.local/grid-doctor/` | `ghostnote/grid-doctor/` | Copy all three current JSON files: original attempt, V20 attempt, and accepted cache. Keep the originals in place. |

The Documents copy must include these specific files:

- `Extensions/ghostnote-0.0.1.bwextension`.
- `Library/Presets/Poly Grid/gn-grid-spike-baseline.bwpreset`.
- `Library/Presets/Sampler/`, including the `gn_sampler*` presets.
- Both complete project folders `Projects/gn-grid-spike/` and
  `Projects/gn-scale-test/`, including their sample folders.

Check Bitwig's configured library and sample locations. Copy any referenced
assets outside the paths above to `external-assets/` in the backup folder,
or record the existing backup that contains them. A project file alone does
not preserve external samples or plug-ins. Keep plug-in versions and content
packages unchanged during this audit.

### Check the copy, then update

1. Open the copied `apps/Bitwig Studio 6.0.6.app` by its full path. Confirm
   that it reports 6.0.6. Run only one Bitwig app at a time. Do not use a
   project double-click or an old Dock shortcut to choose the version.
2. Open the working recovery project. Check for missing assets and confirm
   the visible baseline: only `grid-probe`, `FX 1`, and `Master`;
   `grid-probe` selected, muted, and at -10 dB. Confirm that the control
   patch is present. Record this as a manual recovery check, not proof of
   complete serialized or native graph equality. Do not run the doctor.
3. Quit the copied app. Keep the backup untouched from this point. A failed
   launch or recovery check blocks replacement of the original install.
4. Install the chosen stable 6.1.x build at `/Applications/Bitwig Studio.app`
   with the normal Bitwig update procedure. Launch that exact app and record
   its full version. Do not open the original project folders in the new app.
5. Create a fresh project named `gn-upgrade-audit`, saved under
   `/Users/jonvuri/Bitwig Upgrade Work/2026-10-21/gn-upgrade-audit/`.
   Keep it stopped. Leave controller deployment and fixture setup for the
   coordinated section 2B handoff. Do not change the research control.

Both apps share user state and the deployed extension path. The copied app
is an executable fallback, not an isolated environment. For rollback, quit
6.1.x and open 6.0.6 explicitly with a working copy of an old project.
Restore the matching extension and settings only if needed, with Bitwig
closed. Do not overwrite the preserved backup or restore transient locks
as configuration. Do not assume a project saved by 6.1.x opens in 6.0.6.

**Handoff to the agent:** report the backup and working paths, successful
6.0.6 copy launch and recovery check, exact new version, any missing assets,
and that `gn-upgrade-audit` is open and stopped. No controller replacement
is required until the agent has prepared the normal archive.

## 2. Agent: implement now, then run on the new version

### 2A. Start immediately while section 1 is in progress

All work in this subsection is offline. Do not connect to the bridge, deploy
an archive, edit the operator's backup sources, or inspect the installed jar
while the operator replaces the app. Build tasks must not use deploy tasks.
Do not start another agent unless the operator asks for agent delegation.

1. Inspect the current product and test boundaries. Map each matrix row
   below to an existing check or a new focused driver case. Read the actual
   entry points; old npm aliases, project names, profiles, and method sets
   can be obsolete. `npm run check` uses fake hosts and saved fixtures.
   Passing it cannot establish compatibility with a new Bitwig build.
2. Implement a focused driver at
   `brain/src/probes/bitwig-upgrade-audit.ts` with reusable helpers and
   focused offline tests where needed. Add a clearly named npm entry point.
   Reuse current product operations and independent readers. The driver
   must support explicit preflight, run, inspect, and cleanup phases, plus
   a save/reopen checkpoint. Do not automatically resume writes after a
   failure or reconnect. Persist evidence and owned-object identities, but
   reacquire live references in each new server session.
3. Use the current normal profile for product acceptance. Candidate sources
   include `phase8i13-stretch.ts` for clip/device workflows,
   `phase8i7-mixer.ts` for mixer readback, the live adapter conformance
   cases, and the preset/modulation drivers. Port the needed cases to the
   new project guard. Do not run an old script that expects `gn-scale-test`
   against the preserved original. Do not restore retired wire methods
   merely to make an old harness run.
4. Require the project name `gn-upgrade-audit`, the expected profile, the
   selected host version, and fresh target identities before writes. Use
   unique owned names and refuse collisions. Keep ownership, freshness,
   selection, and readback guards. Refuse a stale reference before a write.
   On an uncertain write, stop the chain and inspect; do not repeat it.
5. Capture entry state and independent post-write state. Include a small
   preserved sentinel track, scene occupancy, mixer, devices, and selection.
   The writer reply is not readback. Cleanup must identify owned objects
   and compare preserved state; a name match alone does not grant ownership.
6. Bound each case before implementation. Start with at most eight owned
   instrument tracks, eight audit scene rows, 256 notes per clip, four
   device units per composition, and 16 changed controls per call. Keep
   the product's stricter limits. Use no overflow or heap stress fixtures.
   Define finite poll counts, deadlines, and a retained-evidence byte cap
   in the driver. Cite the ledger models for unchanged product paths and
   record the expected calls and waits for the new driver. If a fixture
   needs more, revise its cost model before running it.
7. Run `GHOSTNOTE_REQUIRE_ORACLE=1 npm run check` from `brain/` and
   `./gradlew build` from `extension/`. Save logs. Confirm archive profile
   registration. These commands must not deploy. Complete driver preparation
   even if the operator has not finished section 1.

### Audit matrix

| Boundary | Required focused live check |
| --- | --- |
| Startup and discovery | Fresh normal-profile hello; expected methods, hash, markers, API version, project, tracks, and selection. Record the app path, jar hash, archive hash, and initialization time. |
| Notes and clip documents | Read, sparse edit, desired-document write, and revert. Include mixed plain/expressive notes, two MIDI channels, non-grid timing within admitted precision, loop metadata, and independent full readback. Preserve unrelated notes. |
| Clip and track structure | Create, copy to a nonadjacent empty row, move, and delete owned clips/tracks. Check source preservation, destination contents, scene occupancy, and an occupied-destination refusal. |
| Mixer and selection | Read, change, and restore volume, pan, mute, and solo. Independently read raw values. Check selection and one collapsed-group navigation case on owned material. |
| Device controls | Insert a native device and one already installed plug-in. Read control identities/ranges, set a bounded selection, then restore. Switch between two instances of the same type and prove the correct target changed. |
| Device structure | Build a small layer container, add/copy/move devices, enable/disable, then remove or use supported reversals. Check nested destinations and preserved devices. Do not promise a revert for an unsupported move. |
| Presets and modulation | Load a copied donor-based preset, inspect mappings, apply a supported modulation edit or wrapper, and reverse it. Prove the resulting mapping and preserved resources with independent evidence. Include the Sampler cases below. |
| Freshness and lifecycle | Change an owned clip after taking a reference; the stale edit must refuse without another mutation. Coordinate one operator selection change. Switch between two audit projects and verify fresh project/target reads before a write. |
| Persistence and playback | Save and reopen only the audit project. Compare note content, mixer, device controls, and supported modulation state with the pre-save snapshot. Perform one short operator listening check for the Sampler fixture; the operator stops playback. |

For a UI or playback step, pause the driver without polling and state the
single action needed. The normal profile has no `transport.stop`. Do not
use the research profile to bypass that boundary.

### Sampler acceptance

6.1 changes Sampler behavior. Its release notes state that automation and
modulation of Play Mode, Freeze Playhead, and Envelope Mode are disregarded.
This is a host change; do not silently count a loaded preset as preserved.

- Use copied single-sample and multisample `gn_sampler*` fixtures. Confirm
  resource resolution, control identities/ranges, and relevant zone or
  sample state through available independent evidence.
- Exercise a supported existing mapping, such as the current
  `sampler-amp-attack` composition target. Check preset load, Ghostnote
  inspection/edit, and supported reversal. Inspect the resulting state and
  use the short listening check to cover behavior that a loader reply cannot.
- Check whether the retained donor/catalog data exposes the three removed
  modulation targets. Record absence, refusal, or host migration explicitly.
  A silent loss reported as a successful preserved mapping fails the audit.
- If the host does not expose enough state for a claim, report that coverage
  limit. Use an operator inspection or a suitable saved-file inspection;
  do not replace missing evidence with a writer echo.
- Do not overwrite donor sources, regenerate the entire catalog without a
  measured need, or add new 6.1 Sampler features in this session.

### 2B. Deploy and run after the operator handoff

1. Verify the actual running version and app path. Record the new jar
   fingerprint and API version. Check this session's drivers, Ghostnote
   clients, and port 8686 owner. Use one foreground chain and one writer.
   Do not stop unrelated processes.
2. From `extension/`, deploy with `./gradlew copyExtension`. Ask the operator
   to remove the controller fully, then select the final matching
   `ghostnote` product in the complete list. A power toggle, earlier
   duplicate, or orange detected-controller button does not reload it.
   Wait for confirmation; then run `npm run probe:hello` from `brain/`.
   Verify the profile, method count/hash, fresh initialization, and markers.
3. Run the prepared matrix in the audit project. Keep original projects and
   backup files closed. Create the second lifecycle project under the same
   working folder. Do not carry claims or managed IDs across server sessions.
4. Pause for the operator's save, reopen, project switch, selection, and
   playback steps as needed. Resume with fresh preflight and reads. Keep
   saved pre-test snapshots or copies for the persistence check; compare
   their exact file hashes when claiming unchanged saved-file preservation.
5. Inspect failures before cleanup or another write. Remove only proved
   owned scratch objects, then compare the agreed preserved state. Keep
   failed evidence. A failed or skipped required case is not a pass.

## 3. Compare, record, and hand off

1. Write one new E record and add its index row. Store the matrix results,
   offline logs, identities, call logs, entry/exit snapshots, persistence
   comparison, and operator observations under
   `context/evidence/data/bitwig-upgrade-audit/`. Separate observed results
   from the old 6.0.6 evidence and from untested behavior. Do not create an
   E record merely for this planning change.
2. Compare representative per-call costs with the ledger. Use equal
   workloads when possible. Separate cold work, host calls, queue time,
   waits, and operator pauses. Explain a comparable regression over 20
   percent or state the unresolved limit. Do not repeat an uncertain write
   for timing. Do not infer product capacity from this small fixture.
3. Existing cost models apply to unchanged paths. If a compatibility fix
   changes calls, traversal, waits, allocation, or limits, update the model,
   relevant budget tests, ledger, and measurements in the same session.
   Fix bounded compatibility defects needed by this audit and recheck the
   affected boundary. Plan a separate session for a larger redesign.
4. If behavior changes a tool description, update all consumers and bump
   `TOOL_DESCRIPTION_VERSION` and its public artifact in the same session.
   Otherwise descriptions remain v52. Record each required follow-up as an
   explicit session with a source link; keep other limits in the E record.
5. Update NOW with the exact final app/profile/project state and backup
   paths. Record cleanup and any operator-retained audit project. Stage only
   this session's changes; do not commit. Give a concise result, verification,
   and suggested commit message.

Acceptance requires a passing offline gate, verified normal deployment,
results for every required matrix row, explicit Sampler compatibility,
the save/reopen result, and clean preserved-state comparison. A traced
failure is a useful audit result, but does not qualify the upgrade for the
failed product path. Resolve blocking host failures before Grid live work.

After general acceptance, hand off to 9b.6. Keep both old attempt records
and the accepted 6.0.6 cache. The new jar needs its own discovery, driver
adaptation, first-attempt record, and consent-gated doctor. This audit does
not grant native Grid authority or establish the 9b.7 product cache policy.
