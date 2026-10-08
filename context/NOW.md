---
title: Current state
kind: status
state: active
updated: 2026-10-08
phase: phase-8-agent-native-live-engine
session: 8i-next
---

## Now

[8i0](plan/phase-8/8i0-clip-metadata-and-colour-tolerance.md) is complete
([E249](evidence/experiments/e249-clip-metadata-and-colour-tolerance.md),
[D42](decisions/d42-clip-colour-tolerance-and-metadata-ownership.md)); it is
staged, not committed. The next session resumes
[8i](plan/phase-8/8i-agent-native-hybrid-dogfood.md) with the retained
musical trial as input.

What 8i0 changed: a `clip.update` names its owned fields. A rename, length,
or loop edit writes no colour and needs no palette. Any RGB is accepted and
verified within one byte; reversal restores only the owned fields, so a later
change to another field stays. Live finding: Bitwig makes a colour below about
CIE L* 33 lighter (black reads back `[81,81,81]`); the tool reports it as
`differs`. Descriptions are `ghostnote-description-v34`. Property calls take
1,414–1,436 ms (E247: 1,447); copy, extend, and 153 inserts take 1,760 ms.

The first musical dogfood trial passed after one revision. The operator kept
the eight-bar IcyShellStab01 duplicate in Scene 2 of "ice jungle" and its
original in Scene 1. Preserve both. The operator accepts the generic pressure
warning as a host limit, with no agent-behavior finding.

# What 8h gives 8i

- `agent-native-v1` is the default profile (D40): 39 tools, descriptions
  `ghostnote-description-v33`. `stable-v1` is the frozen rollback through 8i.
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

## Last live baseline (8i0)

The normal `ghostnote` build has archive SHA-256
`598428673b4a0c12f4e4a05a29ceb081594a0f510608905486a3b27092cee9c6`,
89 methods, `0ef817f4bac8a8a7`, `fineSteps` 4,194,304, and the `rig.info`
marker `clipMetadataWrite: owned-fields-v1` (`probe:hello` checks it). The
probe build was not deployed in 8i0 (107 methods, `a4c9dcd1499f498a`). The
8i0 live trials ran in the owned project "New 2" (Inst 1, Audio 2, FX 1;
8 scenes), which is unchanged after them. "New 6" holds the earlier operator
fixture. The 8h anchor is `gn-scale-test`
([baseline-final.json](evidence/data/phase8h4a5-cursor/baseline-final.json)).
The next free evidence number is E250; the next decision is D43. Check the
current project before live work; dogfood uses "ice jungle".

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
makes Bitwig rename the track after the device.

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

## 8i0 retrospective

- The plan modelled only the E83 byte conversion. The live sample found the
  lightness floor because it included black and dark blues. Sample the
  extremes of every dimension of a host conversion before a policy rests on
  it.
- A colour restore loses up to one byte, so the fake now models that loss.
  It exposed that a second reversal in order blocked on our own conversion.
  Model each measured host loss in the fake before testing reversal.

## 8h4g retrospective

- Print the wire call sequence with its gaps, not only sums by method.
- Run live drivers as one foreground chain under the background runner, and
  check `pgrep -f phase8h4` first. In zsh, a command in a variable does not
  split into words (`$W args` fails); write each command out.
- A worst case needs the dimension that the cost scales with. The first
  session used the largest note count; the write cost scaled with distinct
  writer pages. State the scaling quantity in the cost model before a "worst
  case" supports a decision. The continuation's model named the retained
  heap of a wide writer before the probe, so the park was planned work.
- The writer view record is a cache of the last *confirmed* view, not of the
  host state: the preflight skips repeated views, so a batch can end on
  another grid. The first park trusted the record (review P1, beat 64). Set
  the state that a frame depends on in the same turn, or derive it from the
  frames sent.
