---
title: Current state
kind: status
state: active
updated: 2026-10-16
phase: phase-8-agent-native-live-engine
session: 8i-gate-close-out
---

## Now

Next: the 8i gate close-out
([8i plan](plan/phase-8/8i-agent-native-hybrid-dogfood.md), item 14): check
the 8i acceptance criteria against the E records, give each Phase 8
interface a verdict, and write the Phase 9 handoff with the 9b artifact
inventory. The resident cache is gone (8h3e): mark the cache items of the
trial set and of the criteria as void, with E230 and E233.
[9c](plan/phase-9/9c-release-and-upgrade-live-suite.md) is the release and
Bitwig upgrade live suite.

The operator reviewed the [issue log](plan/phase-8/8i-dogfood-issues.md)
(D1 to D12): only D9 and D8 get a fix; the other rows need no action. Both
are fixed (E263, E264).

8i20 is complete ([E271](evidence/experiments/e271-midi-tempo-report-and-overlap-precheck.md)).
It fixes issues D15 and D16 from the
[E270](evidence/experiments/e270-document-file-rerun.md) rerun of 8i19
([E269](evidence/experiments/e269-document-file-paths.md),
[D51](decisions/d51-document-file-paths.md)). `read_midi_file` returns the
fixed `report.sourceTempo` summary, not the tempo map (conversion
`midi-document-v2`). A same-key overlap in a desired document refuses from
`add_launcher_clip` and a replace edit before any host call, with
`detail.overlaps` and `detail.overlapPairs`. Descriptions are v52 (44 tools);
the controller remains 8i15. No client trial has used v52. 8i18 (E266, E267)
made `write_midi_file` accept unchanged snapshots; do not change snapshot
coverage to `all`.

Ghostworks transcriptions now carry tempo maps and meters (E270): for
example 512 events at 95.5–127.9 BPM in the `feeding time` guitar, and 247
events at 125.987–125.988 BPM in the `good lies` drums. No two consecutive
values are equal, so the 8i20 merge does not reduce them (E271). Omit
`targetBpm` for them. E266
and E268 used the earlier 60 BPM files (E266 `targetBpm: 126`; E268 an
inferred 100 BPM grid), so state the source file version in comparisons. The separate
[8i17 plan](plan/phase-8/8i17-midi-musical-navigation-survey.md) has the E266
example. E268 adds inputs for it: the first-turn analysis quality, the
Ghostworks source context, and client limits (Codex cut the 67,046-token read
to 16,740; Claude Code saved it to a file). 8i17 can run independently of the
gate close-out.

Preserve `lie sword` and the three MIDI files in `good lies/extracted-drums`.
For E270 the operator renamed and cleared track 2 to `chords` (trackId
`0a288e89…`) before each session. The last observed state is the end of the
Codex session: rows 0–3 hold its four 8-bar clips, and the project was
saved. Earlier comparison clips can be in alternate saves. Check
current state before live work.

Keep in mind for the trials: with the D44 limits, an agent splits larger
work into more calls. A split is not atomic; `revert_change` does not
reverse `move_devices` or clip moves; overlapping clip moves split from the
far edge. A container with 3 or more modulated layer chains cannot be built.

Preserve in "ice jungle": `Pocket Bounce Bass` and the 32-beat clip
`Pocket Bounce v2 - 1 & 3` in Scene 2 (device order: an FX Layer with
Sampler in `Layer 1`, then Blur); the eight-bar IcyShellStab01 duplicate in
Scene 2 and its original in Scene 1. The last fresh track read there had no
Undertow Bass. Check current state and selection before live work. The
operator accepts the generic pressure warning as a host limit.

Night Glass is the operator's testbed for the trials. Preserve the Rain
Steps drums and the Scene 1 bass clip `Rain Steps • Pocket Bass` (32 notes,
with the operator's two hand edits; no claims). After the 8i11 rerun
(E260), the Scene 1 shaker clip has the original timing, and the operator's
backup copy is in a lower scene. Scene 2 holds the bass clip `Rain Steps •
Scene 2 Bass` (step-2 state) and the agent's copies of the Scene 1 drums,
pad, chords, and shaker clips. The agent launched Scene 2; the operator
stops the transport. Check current state before live work.

## Last live baseline (8i15)

The deployed normal `ghostnote` archive is the 8i15 build: SHA-256
`8f7f6c895cb7e11e4ea654b4fccbc8d52df439d3aadebae47b6174d3a91c6928`, 92
methods, `8be1975eaa99d78f`, `fineSteps` 4,194,304, and the `rig.info`
markers `clipCopy: copy-to-slot-v1`, `selectionEffects: mixer-restore-v1`,
`trackMixer: track-mixer-raw-v1`, `clipMetadataWrite: owned-fields-v1`,
and `cursorTrackPins.rule: owned-tracks-pinned-v1`. The 8i15 build has no
new marker: the method count and hash identify it. The probe build has
111 methods, `9b339de4e9bb08da` (unchanged; it keeps
`slot.duplicateClip`). `gn-scale-test` is at its E234 baseline with 10
scenes and mixer `gn-sel` selected; `selection.status` reports a slot of
a deleted scratch track (track index 9, row 0; issue D11). The transport
was not started in 8i15. "New 3" (8i7) was not opened. The next free
evidence number is E272; the next decision is D52; the next issue row is
D17. The current live drivers accept 8i15 (`NORMAL_8I15`,
`assertCurrentNormal`). See E263 and E264 for their commands and cleanup.
No live project was opened or changed in 8i16, 8i18, 8i19, or 8i20; 8i19
made live reads only, after `probe:hello` passed on the 8i15 build.

## Facts

MIDI and document files: use the [conversion contract](contracts/MIDI_FILE_CONVERSION.md).
The offline drivers are `phase8i16-midi-files.ts <absolute MIDI directory>`
and `phase8i19-document-files.ts <absolute MIDI file>`; the live read check is
`phase8i19-live-read.ts <track name> <row>`. They remove their files. R07
normalization can create same-pitch overlaps: use the stated FIFO pairing rule,
not note shortening. The 8i20 driver `phase8i20-tempo-report.ts <absolute MIDI
file>...` measures result sizes and the export round trip. A clip write still
refuses the overlap; `detail.overlaps` names the pairs. A document file is FIELDS when its first record is `DOC`;
a JSON object is JSON. Name files `.gndoc` or `.gndoc.json`, not `.gn`.

For automated trials, use the [E261 runbook links](evidence/experiments/e261-automated-dogfood-process-proof.md)
and [E262 stretch fixtures](evidence/experiments/e262-automated-dogfood-stretch-set.md).
Count calls from the client session file. End a trial's first prompt with
"Use Ghostnote and computer use as you see fit." Claims belong to one server
session and do not survive a new thread or resume. Read the project name after
the hello; a hello during project loading can list other tracks.

Live work: check `pgrep -f phase8` first and run one foreground driver chain.
Check current project, selection, and the driver's input against D44 before a
write. Before a regression claim, inspect per-call durations and rerun once.
Restore scratch fixtures to their documented baseline. The normal profile has
no `transport.stop`; the operator stops playback after a launch.

Revert device adds newest first (`next.revert.changeIds`). The other order
refuses `target-changed` (E264). A revert's `fidelity` states what it restored;
`redoFidelity` states its reversal. `check_revert` names `wouldRemove`, and
`revert_change` names `readback.removed`. `slot.duplicateClip` is probe-only.
Before retiring a wire method, search the advertised drivers in `brain/src/probes`.

For a new write tool, use `readbackStatusOf` and `readbackOrUnavailable`, and
add its case to `readback-unavailable.test.ts`. `unavailable` means a failed
read only. Add selection-moving ops to `movesMixerSelection` and the fake;
a two-change tool uses one `withSelection` scope (E258). Cursor tracks stay
pinned (D43). Mixer volume is raw: dB = 60·log10(raw); writes use `setRaw` (D48).

Add the index row with each new E or D record. Check context with
`LANG=en_US.UTF-8 ruby context/check.rb`. A reviewed spec, codec, or migration
contract change runs `check-publication-candidates.py --write`. Tool additions
must update the server list, profile inventory, document-help consumers, and
description artifact in the same session.
