---
title: Current state
kind: status
state: active
updated: 2026-10-08
phase: phase-8-agent-native-live-engine
session: 8i3
---

## Now

8i2 is complete ([E251](evidence/experiments/e251-collapsed-group-live-verification.md)).
On the D43 build, the collapsed-group routes pass live in `gn-scale-test`
at one and three group levels: the D34 read, `check_launcher_clips`, the
`cursor.pointExpanded` edit and its revert, and the device route. No product
path or tool description changed (`ghostnote-description-v35`). Two
remaining review sessions come before the second dogfood trial of
[8i](plan/phase-8/8i-agent-native-hybrid-dogfood.md):

1. **Next:** [8i3 — Long device write profile](plan/phase-8/8i3-long-device-write-profile.md):
   staged `compose_devices` at five layer chains (estimate 60–110 s) and
   `set_device_controls` without a bound (about 0.45 s for each control) can
   pass the 60 s client timeout. Measure, optimize, then bound or add a
   background flag (D39 rule).
2. [8i4 — Overlay basis sealing](plan/phase-8/8i4-overlay-basis-sealing.md):
   no tool supplies the R22 basis, so an agent cannot put an overlay claim
   (offline check: omitted basis R12, wrong basis R22).

Then rerun the second trial in "ice jungle". Minor review items for a
session that already touches the files: the four measured-body device tools
keep `stable-v1` wording (`tools.ts:1965`, `:2066`), and `README.md` has a
stale status line and two missing probe scripts (`probe:e00`,
`probe:conformance`).

What 8i2 found: the device route on a collapsed child does not use
`cursor.pointExpanded` (a clip point only). It points a pinned pool cursor
with `cursor.pointTrack`, and it passes. A track delete moves the mixer
selection in Bitwig also when no owned cursor is on the track (control arm);
`delete_track` does not report it. A project switch is visible only to the
operator: Bitwig gives no switch counter.

Open from E250: `add_launcher_clip` leaves the slot selection on the new
clip (Bitwig selects it; no borrow is recorded). A non-add tool whose verify
read throws reports `differs`, not `unavailable`.

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

## Last live baseline (8i2)

The deployed normal `ghostnote` archive is unchanged since 8i1: SHA-256
`aae2c7e346c413dc409c572a3e52dc44f983f08ac232ea302e4c0b14f0bc1fb0`, 89
methods, `0ef817f4bac8a8a7`, `fineSteps` 4,194,304, and the `rig.info`
markers `clipMetadataWrite: owned-fields-v1` and `cursorTrackPins.rule:
owned-tracks-pinned-v1` (`probe:hello` checks both; `rig.stats` has the
re-pin count). The probe build was not deployed (107 methods,
`a4c9dcd1499f498a`). `gn-scale-test` is open and matches its baseline
([baseline-final.json](evidence/data/phase8h4a5-cursor/baseline-final.json)),
with `Group 5` collapsed; the 8i2 fixtures are deleted. "New 2" (Inst 1,
Audio 2, FX 1; 8 scenes) and "New 6" are unchanged. The next free evidence
number is E252; the next decision is D44. Check the current project before
live work; dogfood uses "ice jungle". `phase8i1-follow.ts follow` checks
every tool route in "ice jungle"; `phase8i2-groups.ts` runs the group
matrix (operator steps between modes).

## Facts

Add the index row in the same session as a new E or D record. Clip colour no
longer needs the palette (D42); a colour sample must include dark colours.
Report note channels 1-based to the operator. `context/check.rb` needs
`LANG=en_US.UTF-8`. Bitwig
cannot insert a scene above row 0. The first write after an operator scene
change can refuse in the cursor preflight (E3); retry once. Probe
`WireTransport` throws plain `Error`, not `BridgeError`. Bitwig reports note
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

## 8i2 retrospective

- The plan expected the device route to use `cursor.pointExpanded`. One
  grep of `adapter.ts` shows that it is a clip route. When a plan names the
  wire route of a tool, cite the adapter function that sends it.
- Three driver reruns came from the comparison, not from the product: a
  `-0` against `0`, a collapse state compared with the entry after a
  delete, and document clip IDs that each process assigns. A driver that
  compares across a host event or a process resets its expected state after
  the event and compares content without document IDs.

## 8i1 retrospective

- The diagnosis named the follow mode but not that a point *drives* the
  selection. One raw A/B (pinned and unpinned `pointTrack` on one pool
  cursor) settled the design in two calls. Test the smallest host primitive
  with a control arm before designing around a host behaviour.
- Three later failures came from host pin behaviour that the first fix did
  not model: a delete removes a pin, a project switch brings other pins, and
  a cursor without a track holds none. Each cost a controller replacement.
  Before a deploy, list the host events that can change the state that a fix
  depends on (delete, project switch, reload, no target) and test each one.
- A new field on `RevisionMark` broke every guarded edit live, because the
  mark is inside the published snapshot reference. The fakes did not send
  the field. When an extension reply gains a field, add it to the fake reply
  in the same change.
