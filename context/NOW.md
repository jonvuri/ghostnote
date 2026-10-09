---
title: Current state
kind: status
state: active
updated: 2026-10-09
phase: phase-8-agent-native-live-engine
session: 8i8-selection-and-readback-results
---

## Now

Next: [8i8](plan/phase-8/8i8-selection-and-readback-results.md) (E250/E251
result defects), then [8i10](plan/phase-8/8i10-unprompted-overlay-trials.md)
(operator trials: do agents reach for timing overlays without a leading
prompt?). [9c](plan/phase-9/9c-release-and-upgrade-live-suite.md) is the
release and Bitwig upgrade live suite.

8i7 is complete ([E257](evidence/experiments/e257-track-mixer.md),
[D48](decisions/d48-track-mixer-writes-host-raw-values.md)):
`read_track_mixer` and `set_track_mixer` read and set exact volume dB, pan,
mute, and nonexclusive solo on up to 8 tracks, with field-level guarded
reversal. Read 2 turns (about 50 ms), write 10 turns (about 270 ms),
reversal 14 turns (about 365 ms), for 1 or 8 tracks. A fresh Codex agent
set Pad -18 dB and Chords -12 dB in one write. Descriptions v43, 42 tools;
v43 also states the pitch names (60 is C3) and gives two modulation tools
`agent-native-v1` text. 8i9 closed the charter's groove and overlay trials
(E256).

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

## Last live baseline (8i7)

The deployed normal `ghostnote` archive is the 8i7 build: SHA-256
`f1e9cc407ea16905f0abd24da9c7d91cc237889883f7a4839322a1f22d5e82c5`, 91
methods, `64d13fa7b66ad7f9`, `fineSteps` 4,194,304, and the `rig.info`
markers `trackMixer: track-mixer-raw-v1`, `clipMetadataWrite:
owned-fields-v1`, and `cursorTrackPins.rule: owned-tracks-pinned-v1`. Init
110 ms. The 8i7 runs used the owned unsaved project "New 3": Inst 1 (a
launcher clip with volume automation), Audio 2, Hybrid 3, Group 4
(collapsed, child Audio 1), FX 1 (arranger volume automation), Master. The
operator made the clip, the automation, Hybrid 3, and Group 4 for the
kind and refusal tests; they can go. It was at that baseline after the
runs, with no driver track left. Bitwig heap 750 of 3,072 MiB after the
runs. The next free evidence number is E258; the next decision is D49.
`phase8i7-mixer.ts measure|hold|release|trial-*` measures the mixer tools
and manages the UI and trial tracks; `phase8i7-mixer-gate.ts` (probe
profile) holds the unit gate; `phase8i9-overlay-add.ts bench|live`,
`phase8i3-long-writes.ts identity`, and `probe:modulation-routes` stay as
before. The current drivers accept the 8i7 build (`NORMAL_8I7`).

## Facts

Add the index row in the same session as a new E or D record. A track
volume is the host raw value: dB = 60·log10(raw), so -18 dB is raw
10^(-18/60) (D48); `setRaw` lands, a plain `set` does not. A mixer field with
automation refuses; a mixer reversal restores each field that the readback proved
and that still holds what the change left; a mixer batch carries the
scene guard of the tool's prior read. A Codex trial that uses a new write tool needs its
approval (`-c mcp_servers.ghostnote.tools.<tool>.approval_mode="approve"`)
and `< /dev/null`; the operator's Codex has a computer-use plugin
(`cua_repl`) that agents call first. A remote control position is its host slot, not an array index (E254). The modulation writers claim the route, not the sound (D46); a new route form needs a route-suite case first. An agent claim can omit `basis`; `edit_launcher_clip` seals it (D45), and `add_launcher_clip` seals it in the document's clip ID space, then binds it to the live clip (D47). A claim's basis covers the full envelope of each claim it depends on: a revised nominal makes its groove stale. Check many claim bases with one `sealOverlays`, not `dependencyBasis` for each claim. A generated 16,384-note clip uses quarter-beat notes (the reader cell limit). Clip colour no
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
