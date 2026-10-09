---
title: E258 — Selection effects and unavailable readback
kind: evidence
state: done
updated: 2026-10-09
owner: phase-8i8
---

# E258 — Selection effects and unavailable readback

## Status

[8i8](../../plan/phase-8/8i8-selection-and-readback-results.md) is
complete. It closes the three result defects of
[E250](e250-reader-follow-mode-repair.md) and
[E251](e251-collapsed-group-live-verification.md):

1. A write whose verification read fails reports readback status
   `unavailable`, with the warning `readback-unavailable`. The change ID stays
   in `effects`. A completed read with other values still reports `differs`.
2. `add_launcher_clip` restores the person's slot selection after Bitwig
   selects the new clip. With no slot selected before, the result says so.
3. `add_tracks`, `delete_track`, and `duplicate_track` restore the mixer
   selection after Bitwig moves it. When the restore is not possible, the
   result names the selected track.

Tool descriptions are `ghostnote-description-v44` (42 tools). `stable-v1` is
not changed.

## Unavailable readback

`Unverified` has a structured `cause`: `read-failed`, `rows-moved`, or
`observer-unstable` (`engine/take.ts`). A receipt sets `readbackUnavailable`
when a verification read failed. The shared result module maps the receipt
(`readbackStatusOf`): a failed op or a completed read with other values is
`differs`; a failed read is `unavailable`; an address that a scene change made
untrusted (E3) stays `differs`. `readbackOrUnavailable` gives a tool's own
read after the write the same result: a throw is the `unavailable` readback
and its warning, not a failure envelope. The edit limb uses the same helpers.

Each write tool of `agent-native-v1` now:

- Reports `unavailable` in the write envelope, with the warning, when every
  read after its last write fails. When the tool's own fresh read after the
  write completes, that read decides the status.
- Lists `unavailable` in `resultContract.readbackStatus`.

The measured bodies (`set_device_controls`, `edit_preset_modulation`, and the
two wrap tools) report failure code `unavailable` at stage `readback` when a
recorded change has a failed verification read. `set_device_controls` then
stops before the next route and returns `readback: 'unavailable'`.

Three changes were needed so that `differs` means a completed read:

- The executor compared no track rename and no track delete. A rename or a
  delete that did not land read back `verified`. The verify now compares the
  name of each renamed track and the absence of each deleted track. This adds
  no host call.
- `add_devices` checked only that the bank was complete. It now checks each
  added device at its position.
- `delete_device` reported an unproved removal as failure `unavailable`. The
  stable body now marks a failed read after a removal (`readback:
  'unavailable'`). The agent-native result is `unavailable` for a failed read
  and `differs` for a completed read with another order. A removal that stops
  the later removals is `partial`. Only a change that applied something is an
  effect: when the revision guard refuses every removal, the call refuses with
  `target-changed` and no effect (review fix).

`set_track_mixer` with a failed readback is now a write result with status
`unavailable`, not a `partial` failure.

`readback-unavailable.test.ts` runs 25 write tools on the fake: one arm where
every read after the last write throws, and one where the write is
acknowledged but the project keeps its earlier state, or `add_tracks` names
the track differently. `compose_devices` and the three preset-modulation
tools need a simulated preset load. The shared rules that they use have their
own tests. A test fails when a new write tool has no case.

## Selection effects

The live adapter's selection scope now reads the mixer track from the
`selection.status` reply that it already reads at entry. The reply carries the
new field `mixerChannelId`. A scope that applies `track.create`,
`track.delete`, or `track.duplicate` reads `selection.status` once at its end.
When the mixer shows another track, it sends `selection.restoreMixer` and
polls until the observer shows the entry track (D15). The extension selects
the track by channelId with `Track.selectInEditor`, the mixer restore of E241.
The selection must still have the revision and the mixer track that the brain
read; otherwise the extension refuses with `selection-changed`, and the newer
selection stays (D43). A gone track refuses with `absent`.

`clip.create` now borrows the selection. Inside a scope, the encoder sends
the scope token, and the extension claims the lease on the new slot before
`createNewLauncherClip`. Thus the host selection of the new clip keeps the
lease, and the scope restores the entry slot. `add_launcher_clip`,
`add_tracks`, and `duplicate_track` run both of their changes in one scope
(`withSelection`). The scope reports a `SelectionOutcome` to the tool, and the
tool turns a move that stays into the warning `slot-selection-moved` or
`mixer-selection-moved`. A slot restore whose poll does not see the entry slot
in 4 s is `unconfirmed`, not `restored`, and also gives
`slot-selection-moved` (review fix).

Build: method `selection.restoreMixer` (normal 92 methods,
`0bafdd963fa9f5da`), the `rig.info` marker `selectionEffects:
mixer-restore-v1`, and `mixerChannelId` in `selection.status`.

## Live acceptance

The deployed normal archive has SHA-256
`72ce96cb3185ad5930dc3159c6a7dcb9ec36b393fad5d201b70a70d049877893`.
`probe:hello` passed with all markers. The driver
`phase8i8-selection.ts accept` ([accept.json](../data/phase8i8-selection/accept.json))
ran twice in `gn-scale-test`. The entry selection was slot `gn-A` row 0 and
mixer `gn-sel`. The driver used only `gn-8i8-` scratch tracks.

| Step | Tool | Result (run 2) | ms | Calls | Turns | Selection after |
|---|---|---|---:|---:|---:|---|
| add-a | `add_tracks` | verified | 935 | 41 | 23 | entry (mixer restored) |
| add-clip | `add_launcher_clip`, typical | verified | 2,039 | 73 | 49 | entry (slot restored) |
| rename, revert | `rename_track`, `revert_change` | verified, verified | 378; 428 | 15; 19 | 9; 11 | entry |
| add-quiet | `add_tracks` | verified | 889 | 41 | 23 | entry (mixer restored) |
| delete-quiet (E251 control arm) | `delete_track`, never read | verified | 594 | 29 | 16 | entry (mixer restored) |
| delete-pointed | `delete_track`, after a clip read | verified | 506 | 26 | 13 | entry (the host did not move it) |
| duplicate-b | `duplicate_track` | verified | 948 | 42 | 24 | entry (mixer restored) |
| delete-selected | `delete_track` of the selected track | verified, `mixer-selection-moved` (`absent`) | 508 | 27 | 14 | the host's neighbour |
| delete-b | `delete_track` | verified | 492 | 26 | 13 | entry |

Run 1, before the `duplicate_track` restore, had the same results within
6 percent. Its duplicate moved the mixer selection to the copy and did not
restore it: this live observation added `track.duplicate` to the restore.
After each run the track list equalled the entry, and the slot and mixer
selection were the entry selection.

In E251 the delete of a read track moved the mixer selection to `FX 1`. Here
the delete of a read track did not move it. The delete of a track that was
never read moved it in both sessions. The restore reads after each delete, so
it does not depend on which case occurs.

## Cost

Item 1 adds no host call. The selection restore adds frames only at the end of
a scope with a track create, delete, or duplicate: one `selection.status`
read, and, when the host moved the selection, one `selection.restoreMixer`
and the confirming poll (normally one read). This is three turns, against the
two turns of the plan: the third is the D15 poll, without which the next
scope can capture the moved selection. The outer scope of `add_tracks`,
`duplicate_track`, and `add_launcher_clip` saves one entry capture (two
calls).

| Path | 8i8 | Reference | Change |
|---|---:|---|---|
| `add_tracks`, one track | 889–935 ms; 41 calls | E247: 835–841 ms, 46 | +6 to +11 percent; −5 calls |
| `add_launcher_clip`, typical | 2,037–2,039 ms; 73 calls | E250: 2,158 ms, 77 | −6 percent; −4 calls |
| `delete_track`, host moved the mixer | 594 ms; 29 calls | E250: 476 ms, 25 | +25 percent: the restore (3 turns, about 100 ms) |
| `delete_track`, mixer not moved | 492–508 ms; 26 calls | E250: 476 ms, 25 | +3 to +7 percent; the end read |
| `duplicate_track` | 948 ms; 42 calls | E247: 817–844 ms, 46 | +12 to +16 percent |
| `rename_track` | 378–384 ms; 15 calls | E247: 381 ms | unchanged |

The `delete_track` regression of 25 percent is the accepted cost of the
restore when Bitwig moved the selection: three control turns and the observer
poll. Without the move it is one turn. Heap: no new allocation.

The offline call budgets are not changed: the fake makes no selection calls.
`adapter.test.ts` holds the new frame budget (`8i8 call budget`: the entry
read, the read after the move, the guarded restore, and one poll).

## Limits

- A person's mixer click inside the write turn of a track create, delete, or
  duplicate looks like the host move, and the restore replaces it. A click
  after the read at the end of the scope is kept (`selection-changed`).
  `adapter.test.ts` records both.
- The device-layer selection that `chain.create` moves is still not restored;
  nothing reads it back (`borrowsSelection` comment).
- A refused content step of `add_launcher_clip` reports the selection warning
  in `detail.selection`. No fake test reaches this branch: the creation check
  refuses every invalid document before the write.
- `compose_devices` and the preset-modulation tools have no per-tool fake run
  for an unavailable readback.

## Verification

- Review fixes (no live path changed on success, so no live rerun): a
  deletion that the guard refuses reports no effect; an unconfirmed slot
  restore warns. Each has a regression test.
- Brain: `npm run check`, 2,310 of 2,310 tests. New:
  `readback-unavailable.test.ts` (49 tool arms, the shared rules, the
  measured-body code, and the contract check), `selection-effects.test.ts`,
  the live adapter selection tests, and the 8i8 wiremap test.
- Extension: `./gradlew build verifyExtensionArchives clipReaderTest`; the
  archive registrations and runtime profiles agree.
- Live: `probe:hello` all pass; the acceptance driver passed twice.
