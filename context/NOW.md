---
title: Current state
kind: status
state: active
updated: 2026-10-09
phase: phase-8-agent-native-live-engine
session: 8i7-track-mixer
---

## Now

Next: [8i7](plan/phase-8/8i7-track-mixer.md) (bounded mixer tools, plus two
description items from 8i6), then
[8i8](plan/phase-8/8i8-selection-and-readback-results.md) (E250/E251 result
defects), then [8i10](plan/phase-8/8i10-unprompted-overlay-trials.md)
(operator trials: do agents reach for timing overlays without a leading
prompt?). [9c](plan/phase-9/9c-release-and-upgrade-live-suite.md) is the
release and Bitwig upgrade live suite.

8i9 is complete ([E256](evidence/experiments/e256-overlay-authoring-and-creation.md),
[D47](decisions/d47-clip-creation-binds-claims-to-the-live-clip.md)):
Timing overlays help has a complete example and `templates.timing` with the
host basis rule; a refused claim returns `detail.repair`;
`add_launcher_clip` takes claims with the document's clip ID in one call,
under a D44 expansion limit (largest admitted add 22.2 s). Descriptions v42,
reference revision 3, 40 tools. The operator overlay trial passed: one add
of 32 notes and 64 claims with no refusal; after hand edits, a moved note
lost its claims, a lengthened note's claims went stale, and 60 stayed
current; musical pass. This closes the charter's groove and overlay trials.

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

Preserve in "Night Glass": the Rain Steps drums and the Scene 1 bass clip
`Rain Steps • Pocket Bass` (32 notes, with the operator's two hand edits; its
60 current and 2 stale claims are in the running server process only, and a
restart clears them). The earlier `Rain Pocket • 8 bars` clip is no longer in
Scene 1. Check
current state before live work.

## Last live baseline (8i9)

The deployed normal `ghostnote` archive is unchanged since 8i1: SHA-256
`aae2c7e346c413dc409c572a3e52dc44f983f08ac232ea302e4c0b14f0bc1fb0`, 89
methods, `0ef817f4bac8a8a7`, `fineSteps` 4,194,304, and the `rig.info`
markers `clipMetadataWrite: owned-fields-v1` and `cursorTrackPins.rule:
owned-tracks-pinned-v1`. The 8i3 to 8i9 changes are brain-only. The 8i9
runs used the owned unsaved project "New 2" (Inst 1, Audio 2, FX 1); it was
at baseline after the runs (the track `gn-8i9-overlay` deleted). Bitwig heap
1,096 of 3,072 MiB after the runs. The next free evidence number is E257;
the next decision is D48.
`phase8i9-overlay-add.ts bench|live` measures the overlay add and its
lifecycle; `phase8i3-long-writes.ts identity` checks the selector and the D46
writers; `probe:modulation-routes` checks the route forms;
`phase8i6-format-help.ts` checks the templates and manages a trial track.

## Facts

Add the index row in the same session as a new E or D record. A remote control position is its host slot, not an array index (E254). The modulation writers claim the route, not the sound (D46); a new route form needs a route-suite case first. An agent claim can omit `basis`; `edit_launcher_clip` seals it (D45), and `add_launcher_clip` seals it in the document's clip ID space, then binds it to the live clip (D47). A claim's basis covers the full envelope of each claim it depends on: a revised nominal makes its groove stale. Check many claim bases with one `sealOverlays`, not `dependencyBasis` for each claim. A generated 16,384-note clip uses quarter-beat notes (the reader cell limit). Clip colour no
longer needs the palette (D42); a colour sample must include dark colours.
Report note channels 1-based to the operator. A long write has a D44 limit
in `write-limits.ts`; a new or changed long path measures its largest
admitted case and its revert, and adds or moves a limit with a test. `context/check.rb` needs
`LANG=en_US.UTF-8`. Bitwig
cannot insert a scene above row 0. The first write after an operator scene
change can refuse in the cursor preflight (E3); retry once. Probe
`WireTransport` throws `BridgeError` with the reply code (8i3). Bitwig reports note
pressure as 0 (D37). The normal profile has no `transport.stop`; a live
launch leaves the transport playing for the operator to stop.
`check-publication-candidates.py --write` after a reviewed spec, codec, or
migration contract change. For plug-in work, the operator turns the audio
engine on in the owned project (E244). Adding a device to an unnamed track
makes Bitwig rename the track after the device. Owned cursor tracks stay
pinned (D43): a new owned cursor goes through `Rig.ownCursorTrack`, and
`cursor.pinTrack` refuses `pinned: false`. A cursor without a track holds no
pin. A pinned point leaves the mixer selection alone; only the operator
changes it. A track delete moves the mixer selection (host, E251). The
device routes point a hidden child with `cursor.pointTrack`; only clip
points use `cursor.pointExpanded`. Print the wire call sequence with its
gaps. Run live drivers as one foreground chain, and check `pgrep -f phase8`
first. In zsh, a variable does not split into words: write `${=a}` or each
command out.

Each wire call costs one control-surface turn (about 24 ms); calls sent
together share one turn. `phase8h4c-edit.ts cost|worst|accept`,
`phase8h4g-inventory.ts inventory|add-worst|plan-bench`, and
`phase8h4g-writer-width.ts entry|reviewer|far|heap` print the wire calls. A
probe that sends raw requests on the adapter's transport bypasses the
adapter's request count; keep raw setup apart from timed calls. A
`rig.json` override needs a controller replacement, not a redeploy. A
`fineSteps` override below 4,194,304 makes every live note write refuse
before mutation (D41); a probe that needs a narrow writer passes
`allowNarrowWriter`. The Bitwig live heap grows by about 100 MiB over a long
driver run: deleted tracks stay in the undo history.

Before you attribute a live regression, compare per-call durations in the
wire sequence with the inventory, and rerun once (8i4). Fakes use host
indices and real host labels (8i5). Check a reused driver input against the
current D44 limits before a live run. A trial that must reach a refusal
says "send it as written first" (8i6).

VU audibility oracle (E239): stop every clip and the transport, wait for VU 0,
then launch one track and read the Master VU as well.
