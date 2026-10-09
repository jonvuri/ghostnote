---
title: Current state
kind: status
state: active
updated: 2026-10-09
phase: phase-8-agent-native-live-engine
session: 8i-trial-2
---

## Now

8i4 is complete and staged, not committed
([E253](evidence/experiments/e253-overlay-basis-sealing.md),
[D45](decisions/d45-the-edit-limb-seals-explicit-overlay-claims.md)).
`edit_launcher_clip` is the supplied dependency-basis utility: a current
claim that the call states (each `OVERLAY_PUT`, and each `OVERLAY` of a
desired document that omits `basis` or differs from the stored claim) can
omit `basis`. The tool computes it on the state after the note changes of
the same call. A supplied basis that does not match refuses with reason R22
and `detail.expectedBasis`. Retained and stale claims are never sealed. The
code is `brain/src/bindings/overlay-seal.ts`; the rule is in
`HOST-BINDING.md` ("Overlay basis sealing"). No grammar, codec API, or model
reference change. No host turn; no extension change. Descriptions are
`ghostnote-description-v38` (v37 frozen).

Live in "New 3" (HEAD refused the same agent-shaped put with R12): a nominal
and a dependent groove put in the call that moves their note sealed and
verified; an unrelated edit kept them current; a dependency edit made them
stale with the sealed basis; a remove had no effect. All writes were
reverted; the track list equals the baseline. All 2,134 brain tests pass.

Open from E253: the codec structure check builds a `DocumentError` for each
failed `oneOf` branch; at 16,384 claims the planner takes 6.3 s (a
publication candidate change to fix). The first E253 run had slow
post-write captures (whole-clip edits 2.3 s); the inventory (1,666 ms) and
a rerun (1,686 ms) on the same code did not, so the ledger stands.

### Next

1. Rerun the second 8i trial in "ice jungle"
   ([8i charter](plan/phase-8/8i-agent-native-hybrid-dogfood.md)). The trial
   set needs a groove task and an overlay dependency change; both are now
   possible without a repository helper.

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

## Last live baseline (8i4)

The deployed normal `ghostnote` archive is unchanged since 8i1: SHA-256
`aae2c7e346c413dc409c572a3e52dc44f983f08ac232ea302e4c0b14f0bc1fb0`, 89
methods, `0ef817f4bac8a8a7`, `fineSteps` 4,194,304, and the `rig.info`
markers `clipMetadataWrite: owned-fields-v1` and `cursorTrackPins.rule:
owned-tracks-pinned-v1`. The 8i3 and 8i4 changes are brain-only. Bitwig has
the owned project "New 3" open (Inst 1, Audio 2, FX 1; 8 scenes; the audio
engine is on), at its baseline; `gn-scale-test`, "New 2", and "New 6" are
unchanged. The next free evidence number is E254; the next decision is D46.
Check the current project before live work; dogfood uses "ice jungle".
`phase8i4-overlay-seal.ts seal` checks the claim lifecycle live on its own
track.

## Facts

Add the index row in the same session as a new E or D record. An agent claim can omit `basis`; `edit_launcher_clip` seals it (D45). Clip colour no
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
