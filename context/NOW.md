---
title: Current state
kind: status
state: active
updated: 2026-10-08
phase: phase-8-agent-native-live-engine
session: 8i4
---

## Now

8i3 and its limit follow-up are complete and staged, not committed
([E252](evidence/experiments/e252-long-device-write-profile.md),
[D44](decisions/d44-long-writes-are-optimized-then-bounded.md), D39
amendment). Every `agent-native-v1` write has a measured largest admitted
case. Nine guard-keeping changes removed the cost that grew with the input
(staged 5×4 compose 102 s, Drum Machine 16 pads 72 s → 12.5 s, 44 control
writes 21 s → 9.4 s, 8 preset checks 45 s → 7 s). Then the D44 limits in
`brain/src/surface/write-limits.ts` refuse a larger request before any
read or write (`outside-limit`, the limit in `detail`). The longest admitted
call is 33.5 s (properties of 8 clips of 16,384 notes). No background flag.
No extension change. Descriptions are `ghostnote-description-v37` (v36
frozen).

The limit follow-up (E252 "Limit follow-up", `final3/`): `set_device_controls`
admits 4 device routes (4 Diva routes of 16 settings: 22.5 s) and
`delete_device` 10 devices (10 native 25.2 s, 10 Divas 20.7 s). The plug-in
weight in `compose_devices` stays 2 (6 Diva chains would revert in about
32 s, estimate). Each bounded input states "At most N … in one call" in its
schema text, with no `maxItems`; `write-limits.test.ts` checks the JSON
schema text, the description, and the refusal. `move_launcher_clips` now
states its 8-row limit. All 2,127 brain tests pass; "New 3" is at its
baseline.

Agent impact to keep in mind (8i3 review): with the limits, the agent splits
larger work into more calls. A split is not atomic; `revert_change` does not
reverse `move_devices` or clip moves; overlapping clip moves split from the
far edge. A container with 3 or more modulated layer chains cannot be built
(container modulators come only from `compose_devices`); this is the one
shape that the limits remove.

### Next

1. [8i4 — Overlay basis sealing](plan/phase-8/8i4-overlay-basis-sealing.md):
   no tool supplies the R22 basis, so an agent cannot put an overlay claim
   (offline check: omitted basis R12, wrong basis R22). Commit the staged
   8i3 change first, or continue on top of it.

Then rerun the second trial in "ice jungle". Minor review items for a
session that already touches the files: `README.md` has a stale status line
and two missing probe scripts (`probe:e00`, `probe:conformance`).
`reverse_existing_device_modulation_wrap` and `read_preset_modulation` keep
`stable-v1` wording (8i3 gave the wrap its own text).

What 8i3 found besides the cost: a copy of more than about 20 clips cannot
be reverted (24 launcher content events); clip property and launch-setting
writes of more than 8 clips always refused after reading (8 writer cursors);
a delete of more than 8 clips could not be reverted; a wrap with 16
modulators never proves its pages (16-page window). D44 turns each into an
early `outside-limit`. The behavior proof needs the audio engine, and some
controls (Polysynth filter frequency, filter envelope depth) move less than
the proof divergence for an LFO. A plug-in with many more parameters than
Diva (281) has a higher fixed cost; that dimension stays unbounded.

Open from E250/E251: `add_launcher_clip` leaves the slot selection on the new
clip; a non-add tool whose verify read throws reports `differs`, not
`unavailable`; `delete_track` does not report that Bitwig moves the mixer
selection.

"ice jungle" holds the Undertow Bass track and clip from the failed trial
(the clip can hold notes from the stopped piano-roll input); the operator
decides on it. The operator kept the eight-bar IcyShellStab01 duplicate in
Scene 2 and its original in Scene 1. Preserve both. The slot selection is
Ice Shells row 1; the mixer selection is Undertow Bass. The operator accepts
the generic pressure warning as a host limit.

# What 8h gives 8i

- `agent-native-v1` is the default profile (D40): 39 tools, descriptions
  `ghostnote-description-v35`. `stable-v1` is the frozen rollback through 8i.
- Every write is a direct call. The background route left `agent-native-v1`
  (D39 amendment). This depends on D41: the pool writer cursors have the
  reader width (4,194,304 steps), so every admitted clip is one writer page,
  and a writer parks on an empty window after each write.
- Measured: the 16,384-note whole-clip edit 6.6 s; a 512-note edit on a
  2,048-beat clip at the 1/512 grid 1.8 s (111 s at 512 steps); one read and
  one 16-note insert 1.8 s; the E45/E48 workflow 6,745 ms (`stable-v1`
  12,773 ms). What still grows with the content: one property stage for each
  channel with nondefault expression, the planner (notes), and the capture
  (bounded by the reader limit).
- The [performance ledger](contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md) has the
  cost, reference, and call budget of each tool. The 8i charter carries the
  two 8h facts: the document edit limb removed the most agent work; the
  parameter inventories around a device control write are the costliest
  safeguard (27 controls: 14.4 s).

## Last live baseline (8i3)

The deployed normal `ghostnote` archive is unchanged since 8i1: SHA-256
`aae2c7e346c413dc409c572a3e52dc44f983f08ac232ea302e4c0b14f0bc1fb0`, 89
methods, `0ef817f4bac8a8a7`, `fineSteps` 4,194,304, and the `rig.info`
markers `clipMetadataWrite: owned-fields-v1` and `cursorTrackPins.rule:
owned-tracks-pinned-v1`. The 8i3 changes are brain-only. Bitwig has the
owned project "New 3" open (Inst 1, Audio 2, FX 1; 8 scenes; the audio
engine is on), at its baseline; `gn-scale-test`, "New 2", and "New 6" are
unchanged. The next free evidence number is E253; the next decision is D45.
Check the current project before live work; dogfood uses "ice jungle".
`phase8i3-long-writes.ts` measures each long write at its D44 limit (one
command for each arm; `plugins` and `modulation` need the audio engine).

## Facts

Add the index row in the same session as a new E or D record. Clip colour no
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

VU audibility oracle (E239): stop every clip and the transport, wait for VU 0,
then launch one track and read the Master VU as well.

## 8i3 limit follow-up retrospective

- The plan asked for a weight-1 trial of 6 Diva chains, but `compose_devices`
  admits at most 5 layer chains. When a plan proposes a trial input, check
  it against the tool schema first.

## 8i3 retrospective

- Review fix: test a fast path against every identity field in its settled
  reference. Test partial recovery with an operator edit as well as an
  interrupted owned write; derive expected state from proved receipts.
- The plan's inventory listed device tools and the clip batches "from the
  ledger". The ledger had only one-clip costs, and the clip limits came
  from host limits (8 writer cursors, 24 content events, 16 remote pages)
  that no plan named. When a plan bounds a batch tool, list the host
  windows that the batch crosses (`RigConfig`, `Rig.CONTENT_LOG`) first.
- Four driver reruns came from inputs, not from the product: Diva switches
  with no discrete domain, LFO targets below the proof divergence, a move
  boundary row, and an early `exit` that skipped cleanup. A live driver
  writes values every control can hold (endpoints), measures time without
  asserting a per-control proof, and cleans up in `finally` only.
- A `git stash` of `adapter.ts` during a running live chain removed the
  edits for a few seconds. Do not stash a file that a running driver can
  load; test the old code in a worktree.

## 8i2 retrospective

- The plan expected the device route to use `cursor.pointExpanded`. One
  grep of `adapter.ts` shows that it is a clip route. When a plan names the
  wire route of a tool, cite the adapter function that sends it.
- Three driver reruns came from the comparison, not from the product: a
  `-0` against `0`, a collapse state compared with the entry after a
  delete, and document clip IDs that each process assigns. A driver that
  compares across a host event or a process resets its expected state after
  the event and compares content without document IDs.
