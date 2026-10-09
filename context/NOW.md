---
title: Current state
kind: status
state: active
updated: 2026-10-09
phase: phase-8-agent-native-live-engine
session: 8i-trial-set
---

## Now

Next: resume the [8i trial set](plan/phase-8/8i-agent-native-hybrid-dogfood.md).
A groove task and an overlay dependency change remain. Preserve the accepted
"ice jungle" material.

8i5 is complete
([E254](evidence/experiments/e254-device-control-identity-and-route-claims.md),
[D46](decisions/d46-modulation-writers-claim-the-route-not-the-sound.md)).

- Remote selectors resolve by host index and both names
  (`resolveRemoteSelector`, `contract/state.ts`). A page lists only the slots
  that hold a control (Blur `Common`: 0, 1, 2, 3, 7). A stale, missing, or
  ambiguous selector refuses before a write (`absent` or `target-changed`,
  reason `remote-selector-*`).
- D46 (operator decision during the session): `wrap_existing_device_modulation`,
  `edit_preset_modulation`, and `compose_devices` run no behavior witness in
  `agent-native-v1` and have no behavior input. They refuse a target ID
  outside the proved route forms (`unproved-route-form`) and claim the
  authored route, not the sound. Native modulation work needs no audio
  engine. `stable-v1` keeps the witness. `npm run probe:modulation-routes`
  is the live route proof: run it after a route-path change and after each
  Bitwig upgrade (18/18 pass, 160 s; audio engine on, Zebra3 installed).
- Live in "New 2": the Sampler ADSR wrap that failed on 2026-10-09 completes;
  wrap 13.6 to 9.4 s, preset edit 7.1 to 2.1 s, composition with 4
  modulators 25.3 to 12.4 s. The ledger has the rows.
- Review fix: authoring and composition still check each target's exact ID
  and name in the new device inventory (an `identity` witness, no samples).
  A miss fails at readback with the change recorded.
- `read_launcher_clip` asks for Patch help on the first read before a patch
  edit. A fresh Codex agent did that and made no repeat read (one read, one
  edit, 24 s).
- Descriptions `ghostnote-description-v40` (v39, used in the trial, frozen). Result schemas
  `ghostnote-device-modulation-wrap/2`, `ghostnote-preset-modulation-edit/2`,
  `ghostnote-device-compose/2`. No extension change. 2,148 brain tests pass.

Open from 8i5:

- No ID-bound CLAP witness in the route suite.
- No tool reports the description version; the operator could not have the
  trial agent confirm v39. Candidate: add it to `check_bitwig_connection`.
- The `phase8i3-long-writes.ts modulation` mode still asks for a 3-chain
  composition with modulators (12 units), which D44 refuses. `identity`
  uses the 6-unit shape.
- [9c](plan/phase-9/9c-release-and-upgrade-live-suite.md) plans the
  release and Bitwig upgrade live suite. It keeps the route suite and
  evaluates every other probe fresh; E40 is out of date and
  `probe:conformance` has no script.
- Interface review candidates 3 to 5 (discovery output, preset read scope,
  authoring type names) need their own scope.

Open from E253: the codec structure check builds a `DocumentError` for each
failed `oneOf` branch; at 16,384 claims the planner takes 6.3 s (a
publication candidate change to fix).

Agent impact from 8i3 to keep in mind: with the D44 limits, the agent splits
larger work into more calls. A split is not atomic; `revert_change` does not
reverse `move_devices` or clip moves; overlapping clip moves split from the
far edge. A container with 3 or more modulated layer chains cannot be built.

Minor review items for a session that already touches the files: `README.md`
has a stale status line and two missing probe scripts (`probe:e00`,
`probe:conformance`). `reverse_existing_device_modulation_wrap` and
`read_preset_modulation` keep `stable-v1` wording.

Open from E250/E251: `add_launcher_clip` leaves the slot selection on the new
clip; a non-add tool whose verify read throws reports `differs`, not
`unavailable`; `delete_track` does not report that Bitwig moves the mixer
selection.

The latest dogfood session added `Pocket Bounce Bass` and the 32-beat clip
`Pocket Bounce v2 - 1 & 3` in Scene 2. Its accepted device order is an
FX Layer with Sampler in `Layer 1`, then Blur. Preserve this result and
the eight-bar IcyShellStab01 duplicate in Scene 2 and its original in Scene 1.
The fresh track read in that session had no Undertow Bass. Check current
state and selection before live work. The operator accepts the generic
pressure warning as a host limit.

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

## Last live baseline (8i5)

The deployed normal `ghostnote` archive is unchanged since 8i1: SHA-256
`aae2c7e346c413dc409c572a3e52dc44f983f08ac232ea302e4c0b14f0bc1fb0`, 89
methods, `0ef817f4bac8a8a7`, `fineSteps` 4,194,304, and the `rig.info`
markers `clipMetadataWrite: owned-fields-v1` and `cursorTrackPins.rule:
owned-tracks-pinned-v1`. The 8i3 to 8i5 changes are brain-only. The last
fixture verification used "New 2" (Inst 1, Audio 2, FX 1; 8 scenes; audio
engine on), at baseline after the 8i5 runs and the trial. "ice jungle" was
not touched. The next free evidence number is E255; the next decision is
D47. Check the current project before live work; dogfood uses "ice jungle".
`phase8i3-long-writes.ts identity` checks the selector and the D46 writers;
`probe:modulation-routes` checks the route forms.

## Facts

Add the index row in the same session as a new E or D record. A remote control position is its host slot, not an array index (E254). The modulation writers claim the route, not the sound (D46); a new route form needs a route-suite case first. An agent claim can omit `basis`; `edit_launcher_clip` seals it (D45). Clip colour no
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

## 8i5 retrospective

- The plan prescribed a typed Sampler family as the fix. Checking the API
  first (no ID on `RemoteControl`, no CLAP typed route) showed that the
  per-call witness was the problem, and the operator removed it from the
  product (D46). A plan that adds a per-call proof states what the proof
  needs (audio engine, notes, handles) and which risk it covers.
- Fakes with dense remote pages and labels equal to parameter names hid both
  failures. Fixtures use host indices and real host labels.
- A driver mode copied from 8i3 asked for a shape that D44 refuses. Check a
  reused driver input against the current limits before the live run.

## 8i4 retrospective

- A live number 30 percent above the ledger came from slow host captures
  in one run, not from the code. Compare per-call durations in the wire
  sequence with the inventory, and rerun once, before you attribute a
  regression.
- The codec checks R22 at parse for a desired document but not for a patch
  (it checks a patch at apply). A plan that changes a codec rule at the
  host boundary names the stage of each check (`parse`, `validateSemantics`,
  `finish`).

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
