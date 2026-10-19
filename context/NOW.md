---
title: Current state
kind: status
state: active
updated: 2026-10-19
phase: phase-9-overlap-investigation
session: 9a-close-out
---

## Now

Phase 8 is complete. The 8i gate closed in
[E272](evidence/experiments/e272-8i-gate-close-out.md): every 8i criterion
is met (the cache criterion is void, E230 and E233), each Phase 8 interface
has a verdict (no revise; the resident cache and `stable-v1` retire), and
[10b](plan/phase-10/10b-compact-bar-publication-review.md) has the handoff
with the artifact inventory (101 entries). The main Phase 8 verdict is that
Ghostnote behaved like an instrument.

[9a — Live Grid editing spike](plan/phase-9/9a-live-grid-editing-spike.md)
is complete in [E299](evidence/experiments/e299-grid-spike-close-out.md).
Native module/cable operations and persistence pass within the fixed-fixture
scope. [E298](evidence/experiments/e298-grid-operator-audio-live-test.md) passes
all eight operator audio checks, eleven native graph stages, and exact baseline
restoration. The 9a index links the final verdict, limits, evidence, source
code, and completed listening procedure. Earlier automated signal designs are
historical; native meter research is deferred and does not gate this result.

Next: select next steps in a separate planning session, as the user requested.
No implementation scope is selected. Wider Phase 9 remains provisional.
Keep the research probe deployed by operator choice. V13's test session is
used and released. Do not repeat its preparation, run, or restoration workflow.
The close-out changed documentation only; it made no live request.

The former Phase 9 is now [Phase 10](plan/phase-10/README.md): publication
plans 10a/10b, the release and upgrade suite 10c, and the `stable-v1` retirement
backlog (D40, E272). Historical Phase 9 handoffs refer to that moved work. The
[8i17 survey](plan/phase-8/8i17-midi-musical-navigation-survey.md) (musical
navigation in large MIDI files; E266 and E268 are its inputs) runs
independently. No client trial has used descriptions v52; a rerun with the
[runbook](plan/phase-8/8i-automated-dogfood-runbook.md) is optional and
does not gate 10b.

Live material to preserve, until the operator says otherwise:

- `lie sword`: the three MIDI files in `good lies/extracted-drums`; track 2
  is `chords` (trackId `0a288e89…`). The last observed state is the end of
  the E270 Codex session: rows 0–3 hold its four 8-bar clips, and the
  project was saved. The close-out hello saw this project open (4 tracks,
  20 scenes) and made no read beyond the hello.
- "ice jungle": `Pocket Bounce Bass` and the 32-beat clip `Pocket Bounce
  v2 - 1 & 3` in Scene 2 (device order: an FX Layer with Sampler in `Layer
  1`, then Blur); the eight-bar IcyShellStab01 duplicate in Scene 2 and its
  original in Scene 1. The operator accepts the generic pressure warning
  as a host limit.
- Night Glass (the trial testbed): the Rain Steps drums and the Scene 1
  bass clip `Rain Steps • Pocket Bass` (32 notes, two hand edits, no
  claims); the Scene 1 shaker with its original timing and the operator's
  backup in a lower scene; Scene 2 with `Rain Steps • Scene 2 Bass` and
  the agent's copies of the Scene 1 drums, pad, chords, and shaker clips.

Check current state and selection before any live work. Claims belong to
one server session and do not survive a new thread or resume.

## Retained deployment and last verified fixture (E298, 2026-10-19)

The user chose to retain V13 during E299 close-out. The state below was last
verified in E298; E299 made no fresh live observation. V13 is deployed:
`phase-8-probe-v1`, 118 methods, `2e939035ea90b8b0`, marker
`gridReadProbe: 9a-grid-audio-v13`. The
[deployment record](evidence/data/phase9a-operator-audio/deployment-v13.json)
confirms the built and deployed archive match, SHA-256
`ed8934be54f937bfe0cd805589435260c60c27dead4a06ea94c24eea052694d3`.
The operator confirmed replacement. The [fresh hello](evidence/data/phase9a-operator-audio/hello-v13.txt)
passes with V13 and initialization `2026-10-18T21:39:53.989Z`.
[E298's final verification](evidence/data/phase9a-operator-audio/verification-live.json)
records the completed run and exact restoration. The session is used, inactive,
released, and not locked. No epoch or native task remains open; recovery is
unused. Do not repeat any V13 workflow. The normal profile is not restored.

The operator closed `gn-grid-spike` without saving. File checks passed while
closed; no baseline file replacement was needed. The agent reopened the exact
saved baseline. Final paired reads pass with reacquired identities. The fixture
is selected and unstarred, with the original four-module, two-cable graph,
rectangles, empty Grid selection, idle edit, and parents. Track `grid-probe`
is muted at -10 dB, armed, active, and not soloed. The engine is inactive and
transport is stopped at 1.1.1.00. Poly Grid and MW/Expressions are unchanged.
No project was saved. No other live material was edited.

The saved project and backup are byte-identical, SHA-256
`af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f`.
Project path:
`/Users/jonvuri/Documents/Bitwig Studio/Projects/gn-grid-spike/gn-grid-spike.bwproject`.
Backup: `/tmp/gn-grid-spike-e280-baseline.bwproject`.
Preset path:
`/Users/jonvuri/Documents/Bitwig Studio/Library/Presets/Poly Grid/gn-grid-spike-baseline.bwpreset`.
The preset is unchanged. The edited-state copy is
`/tmp/gn-grid-spike-e289-attached.bwproject`; it is not the current baseline.

Operator clarification: `gn-scale-test` was open by chance. Its unsaved
changes are not important. It has no preservation, inspection, or restoration
requirement for 9a. Do not treat its state as a 9a gate.

## Previous normal baseline (8i15 build)

The previous normal `ghostnote` archive is the 8i15 build: SHA-256
`8f7f6c895cb7e11e4ea654b4fccbc8d52df439d3aadebae47b6174d3a91c6928`, 92
methods, `8be1975eaa99d78f`, `fineSteps` 4,194,304, and the `rig.info`
markers `clipCopy: copy-to-slot-v1`, `selectionEffects: mixer-restore-v1`,
`trackMixer: track-mixer-raw-v1`, `clipMetadataWrite: owned-fields-v1`,
and `cursorTrackPins.rule: owned-tracks-pinned-v1`. The prior probe build had
111 methods, `9b339de4e9bb08da`. `probe:hello` passed on 2026-10-16 (E272)
and at 9a entry. `selection.status` can report a slot of a deleted scratch
track (issue D11). Descriptions are v52 (44 tools);
no live project changed in 8i16 and 8i18 to 8i20, E272, or E299. The
next free evidence number is E300; the next decision is D52; the next
issue row is D17. The live drivers accept 8i15 (`NORMAL_8I15`,
`assertCurrentNormal`); see E263 and E264 for their commands and cleanup.

## Facts

MIDI and document files: use the [conversion contract](contracts/MIDI_FILE_CONVERSION.md)
(`midi-document-v2`). The offline drivers are `phase8i16-midi-files.ts
<absolute MIDI directory>`, `phase8i19-document-files.ts <absolute MIDI
file>`, and `phase8i20-tempo-report.ts <absolute MIDI file>...`; the live
read check is `phase8i19-live-read.ts <track name> <row>`. They remove their
files. R07 normalization can create same-pitch overlaps: use the FIFO
pairing rule, not note shortening; a clip write refuses the overlap before
any host call and `detail.overlaps` names the pairs. `read_midi_file`
returns the fixed `report.sourceTempo` summary. Ghostworks transcriptions
carry tempo maps with no two equal consecutive values, so the equal merge
does not reduce them; omit `targetBpm` for them, and state the source file
version in a comparison (E266 and E268 used the earlier 60 BPM files). A
document file is FIELDS when its first record is `DOC`; a JSON object is
JSON. Name files `.gndoc` or `.gndoc.json`. `write_midi_file` accepts
unchanged snapshots; do not change snapshot coverage to `all`.

For automated trials, use the [runbook](plan/phase-8/8i-automated-dogfood-runbook.md),
the [E261 links](evidence/experiments/e261-automated-dogfood-process-proof.md),
and the [E262 fixtures](evidence/experiments/e262-automated-dogfood-stretch-set.md).
Count calls from the client session file. End a trial's first prompt with
"Use Ghostnote and computer use as you see fit." Read the project name after
the hello; a hello during project loading can list other tracks. With the
D44 limits an agent splits larger work into more calls; a split is not
atomic; `revert_change` does not reverse `move_devices` or clip moves; a
container with 3 or more modulated layer chains cannot be built.

Live work: check `pgrep -f phase8` first and run one foreground driver
chain. Check the current project, the selection, and the driver's input
against D44 before a write. Before a regression claim, inspect per-call
durations and rerun once. Restore scratch fixtures to their documented
baseline. The normal profile has no `transport.stop`; the operator stops
playback after a launch.

Revert device adds newest first (`next.revert.changeIds`); the other order
refuses `target-changed` (E264). A revert's `fidelity` states what it
restored; `redoFidelity` states its reversal. `check_revert` names
`wouldRemove`, and `revert_change` names `readback.removed`.
`slot.duplicateClip` is probe-only. Before retiring a wire method, search
the advertised drivers in `brain/src/probes`.

For a new write tool, use `readbackStatusOf` and `readbackOrUnavailable`,
and add its case to `readback-unavailable.test.ts`. `unavailable` means a
failed read only. Add selection-moving ops to `movesMixerSelection` and the
fake; a two-change tool uses one `withSelection` scope (E258). Cursor
tracks stay pinned (D43). Mixer volume is raw: dB = 60·log10(raw); writes
use `setRaw` (D48).

Add the index row with each new E or D record. Check context with
`LANG=en_US.UTF-8 ruby context/check.rb`. A reviewed spec, codec, or
migration contract change runs `check-publication-candidates.py --write`.
Tool additions and description bumps must update the server list, the
profile inventory, the document-help consumers, the description artifact,
and the tool counts in `PROJECT.md`, the workstation interfaces status,
and the migration contract in the same session.
