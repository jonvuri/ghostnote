---
title: Current state
kind: status
state: active
updated: 2026-10-16
phase: phase-9-breadth-and-release
session: operator-selects-next
---

## Now

Phase 8 is complete. The 8i gate closed in
[E272](evidence/experiments/e272-8i-gate-close-out.md): every 8i criterion
is met (the cache criterion is void, E230 and E233), each Phase 8 interface
has a verdict (no revise; the resident cache and `stable-v1` retire), and
[9b](plan/phase-9/9b-compact-bar-publication-review.md) has the handoff
with the artifact inventory (101 entries). The main Phase 8 verdict is that
Ghostnote behaved like an instrument.

Next: the operator selects the next session. The
[Phase 9 README](plan/phase-9/README.md) names
[9a](plan/phase-9/9a-bwmod-publication-review.md) (the `bwmod` publication
review) as the first selected item; [9b](plan/phase-9/9b-compact-bar-publication-review.md)
is ready with its handoff; [9c](plan/phase-9/9c-release-and-upgrade-live-suite.md)
is the release and Bitwig upgrade live suite; the `stable-v1` retirement is
a Phase 9 backlog item (D40, E272); and the
[8i17 survey](plan/phase-8/8i17-midi-musical-navigation-survey.md) (musical
navigation in large MIDI files; E266 and E268 are its inputs) runs
independently. No client trial has used descriptions v52; a rerun with the
[runbook](plan/phase-8/8i-automated-dogfood-runbook.md) is optional and
does not gate 9b.

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

## Last live baseline (8i15 build; hello 2026-10-16)

The deployed normal `ghostnote` archive is the 8i15 build: SHA-256
`8f7f6c895cb7e11e4ea654b4fccbc8d52df439d3aadebae47b6174d3a91c6928`, 92
methods, `8be1975eaa99d78f`, `fineSteps` 4,194,304, and the `rig.info`
markers `clipCopy: copy-to-slot-v1`, `selectionEffects: mixer-restore-v1`,
`trackMixer: track-mixer-raw-v1`, `clipMetadataWrite: owned-fields-v1`,
and `cursorTrackPins.rule: owned-tracks-pinned-v1`. The probe build has 111
methods, `9b339de4e9bb08da` (it keeps `slot.duplicateClip`). `probe:hello`
passed on 2026-10-16 (E272). `gn-scale-test` is at its E234 baseline with
10 scenes and mixer `gn-sel` selected; `selection.status` can report a slot
of a deleted scratch track (issue D11). Descriptions are v52 (44 tools);
no live project changed in 8i16 and 8i18 to 8i20 or in the close-out. The
next free evidence number is E273; the next decision is D52; the next
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
