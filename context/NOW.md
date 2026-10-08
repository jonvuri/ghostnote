---
title: Current state
kind: status
state: active
updated: 2026-10-08
phase: phase-8-agent-native-live-engine
session: 8i-next
---

## Now

The 8i1 reader repair is complete
([E250](evidence/experiments/e250-reader-follow-mode-repair.md),
[D43](decisions/d43-owned-cursor-tracks-stay-pinned.md)) and staged, not
committed. The next session reruns the second dogfood trial of
[8i](plan/phase-8/8i-agent-native-hybrid-dogfood.md) in "ice jungle".

What 8i1 changed: in a project that was saved with the ghostnote cursor
records, an unpinned owned cursor follows the selection, and its point
drives the selection. Every owned cursor track now stays pinned (14 tracks);
a point changes only the clip pin. The extension pins a cursor again after a
track delete or a project switch, when the cursor has a track. `revision.get`
lists unpinned cursors, and the health check refuses with `unhealthy`. The
selection lease also accepts the mixer track of the claim, because a pinned
point no longer moves the mixer. A failed verify read after a write keeps
the receipt: `add_launcher_clip` reports and records the creation.
Descriptions are `ghostnote-description-v35` (`check_bitwig_connection`).

Open from E250: the collapsed-group read and point routes, with pinned
finders, were not run live (no group track in the projects used); run them
in `gn-scale-test` or an owned project with a group before the trial relies
on groups. `add_launcher_clip` leaves the slot selection on the new
clip (Bitwig selects it; no borrow is recorded). A non-add tool whose verify
read throws reports `differs`, not `unavailable`.

"ice jungle" holds the Undertow Bass track and clip from the failed trial
(the clip can hold notes from the stopped piano-roll input); the operator
decides on it. The operator kept the eight-bar IcyShellStab01 duplicate in
Scene 2 and its original in Scene 1. Preserve both. The 8i1 driver only read
the existing tracks; its scratch track is deleted. The slot selection is
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

## Last live baseline (8i1)

The deployed normal `ghostnote` archive has SHA-256
`aae2c7e346c413dc409c572a3e52dc44f983f08ac232ea302e4c0b14f0bc1fb0`, 89
methods, `0ef817f4bac8a8a7`, `fineSteps` 4,194,304, and the `rig.info`
markers `clipMetadataWrite: owned-fields-v1` and `cursorTrackPins.rule:
owned-tracks-pinned-v1` (`probe:hello` checks both; `rig.stats` has the
re-pin count). The probe build was not deployed (107 methods,
`a4c9dcd1499f498a`). "New 2" (Inst 1, Audio 2, FX 1; 8 scenes) is unchanged
after the 8i1 cost run. "New 6" holds the earlier operator fixture. The 8h
anchor is `gn-scale-test`
([baseline-final.json](evidence/data/phase8h4a5-cursor/baseline-final.json)).
The next free evidence number is E251; the next decision is D44. Check the
current project before live work; dogfood uses "ice jungle".
`phase8i1-follow.ts follow` checks every tool route in "ice jungle" with
selection and pin readback.

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
changes it. Print the wire call sequence with its gaps. Run live drivers as
one foreground chain, and check `pgrep -f phase8` first. In zsh, a variable
does not split into words: write `${=a}` or each command out.

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

## 8i0 retrospective

- The plan modelled only the E83 byte conversion. The live sample found the
  lightness floor because it included black and dark blues. Sample the
  extremes of every dimension of a host conversion before a policy rests on
  it.
- A colour restore loses up to one byte, so the fake now models that loss.
  It exposed that a second reversal in order blocked on our own conversion.
  Model each measured host loss in the fake before testing reversal.
