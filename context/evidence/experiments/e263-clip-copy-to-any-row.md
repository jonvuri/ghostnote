---
title: E263 — Clip copy to any row
kind: evidence
state: done
updated: 2026-10-11
owner: phase-8i14
---

# E263 — Clip copy to any row

## Status

[8i14](../../plan/phase-8/8i14-clip-copy-to-any-row.md) is complete. It
closes issue D9 of the
[issue log](../../plan/phase-8/8i-dogfood-issues.md).
`copy_launcher_clips` copies a clip to any empty slot of an Instrument or
Hybrid track, on the same track or on another track, in one write. The
host route is `InsertionPoint.copySlotsOrScenes` on the replace insertion
point of the destination (`slot.copyTo`). The product no longer sends
`slot.duplicateClip`.

Tool descriptions are `ghostnote-description-v47` (fingerprint
`908c26cee0c0d4665312cd4462b77ea0084c1a3d4fd13dc0191e25cfbf5db0f6`).
`stable-v1` descriptions are not changed. The normal build has 93 methods,
hash `8a5639c94fe02f55`, and the `rig.info` marker `clipCopy:
copy-to-slot-v1`.

Data: `context/evidence/data/phase8i14-copy/` (`probe.json`,
`accept.json`, `s4-codex/`, `s4-claude/`, `state-entry.jsonl`). Driver:
`brain/src/probes/phase8i14-copy.ts probe|accept <dir>`.

## API check

The API 25 source (`extension-api-25-sources.jar`) has
`InsertionPoint.copySlotsOrScenes(ClipLauncherSlotOrScene...)`: "Copies
the supplied slots or scenes to this insertion point. If it's not possible
to do so then this does nothing." The method takes one or more sources.
`ClipLauncherSlotOrScene` gives three insertion points:
`replaceInsertionPoint`, `nextSceneInsertionPoint`, and
`previousSceneInsertionPoint`. The probe used only the replace point. The
scene points are outside the session scope.

## Probe

Research profile (`phase-8-probe-v1`, 111 methods, `9b339de4e9bb08da`),
`gn-scale-test`, scratch tracks. The driver read every slot of every
track, the track list, the scene count, the selection, and the content
events before and after each raw `slot.copyTo`. It compared the copy with
the source: the host clip metadata (name, colour, length, play start, loop
fields), the launch settings, and the notes of all 16 channels. The
"rich" source has 256 notes on 16 channels and no metadata or launch
field at its default.

The reply is the same in every case (`success: true`), also when nothing
was copied. The proof is the occupancy and the content.

| Case | Result |
|---|---|
| Same track, row 0 to row 2 | Copied. Content equal. One content event (the destination filled), 94 ms after the request. No other slot changed |
| Same track, row 5 to row 3 (up) | Copied. Content equal. One event |
| Another Instrument track, the same row | Copied. Content equal. One event |
| Another Instrument track, another row | Copied. Content equal. One event |
| Occupied destination | The clip was replaced with the source content. No content event, as with `duplicateClip` (E43) |
| Occupied rows before and after the destination (rows 3 and 5, destination 4) | Copied. The clips in rows 3 and 5 kept their content. The copy has no boundary rule |
| Empty Audio track destination | Copied, content equal. The host changed the track type from Audio to Instrument (the acceptance run recorded the types) |
| Two sources in one call (rows 0 and 5 to row 6 of another track) | The first copy landed in row 6. The second landed in row 11: the host keeps the row offset between the sources. The host added two scenes (10 to 12) |
| A row past the last scene (row 10 of 10 scenes) | Nothing changed. `destExisted` is false |
| A slot of a group track (`Group 5`, row 9) | A clip landed in the group slot (one event). One undo restored the baseline |
| Playing source | Copied, content equal. The source stayed playing; the copy was not playing |
| 16,384 notes | Copied, 16,384 notes, content equal. The event came after 146 ms |

In every case the source kept its content, the track list and the scene
count stayed (except the two cases that the table names), and the slot
selection and the mixer selection did not change.

The first probe run stopped after the two-source case. It left 12 scenes.
The driver deleted the two empty scenes with `delete_scene`
(`restore-scenes`); the second run does this in the case itself.
`probe.json` is the second run.

## Decision

1. **One route.** Every `clip.duplicate` op uses `slot.copyTo`, also for
   the next row. The probe showed no case that only `duplicateClip`
   handles. Automation lanes have no readback (E43), so no evidence
   separates the two routes there. The acceptance run measured the
   next-row copy on the new route: equal content, and the same calls and
   time as the other forms. `slot.duplicateClip` stays registered in this
   extension build and is not sent; its removal from the product profile
   needs an extension build
   ([8i15](../../plan/phase-8/8i15-device-add-revert-report.md), work
   item 6).
2. **One source for each host call.** Several sources keep their row
   offsets and can add scenes. The encoder sends one source. The handler
   refuses `sources` outside the probe profile.
3. **Track types.** The tool admits a copy when the source track and the
   destination track are Instrument or Hybrid tracks. An Audio, Effect, or
   Master track refuses with code `unsupported`, reason
   `copy-destination`, before any write: the host changes the type of an
   empty Audio track that receives a note clip. A group track refuses with
   `group-slot` as before. Before 8i14, the tool admitted a next-row copy
   on an Audio track; no session tested a copy of an audio clip.
4. **Preflight stays.** The source must hold a clip (`absent`), the
   destination must exist (`absent`) and be empty (`occupied`), and each
   slot appears once. The host replaces an occupied destination with no
   event, and does nothing for a missing row.
5. **Selection.** The copy does not move the slot or mixer selection.
   `movesMixerSelection` and the fake did not change.

## Product change

- Extension: `slot.copyTo` (`TrackHandlers.slotCopyTo`) is a product
  method. Normal 93 methods, capture 98, probe 111.
- Brain: the `clip.duplicate` op accepts any destination slot that is not
  the source slot (`validateOps`). The encoder sends one `slot.copyTo`
  frame for each op. The fake copies to the destination track.
- `copy_launcher_clips`: the next-row refusal is removed. The track-type
  check runs after the track read (stage `resolve`).
- Tests: the tool tests (each destination form, the reverts, the
  refusals), the encoder test, the wire map and golden tests, and the
  call-budget test. 2,321 tests pass; `gradlew check` passes.

## Acceptance (live)

Normal profile, the 8i14 build, `gn-scale-test`, scratch tracks
(`accept.json`). Each copy is one tool call with one write stage
(`batch.run`) and one `slot.copyTo` frame. After each call the driver
compared every slot, the track list, the scene count, the mixer values of
every track, and the selection.

| Step | Result | Time | Wire calls, turns |
|---|---|---:|---|
| Copy to the next row | verified, content equal | 863 ms | 37, 22 |
| Copy to row 4, between occupied rows 3 and 5 | verified, content equal; the neighbours kept their content | 853 ms | 37, 22 |
| Copy to another Instrument track | verified, content equal | 868 ms | 37, 22 |
| Instrument to Hybrid; Hybrid, the same track; Hybrid to Instrument | verified, content equal; the Hybrid track stayed Hybrid | 888; 853; 857 ms | 37, 22 |
| `revert_change` of each copy | verified; the destination slot is empty again | 1,115–1,179 ms | 42, 27 |
| Audio track destination | `unsupported`, stage `resolve`, no write | 25 ms | 2, 1 |
| Occupied destination | `occupied`, stage `acquire`, no write | 94 ms | 6, 4 |
| A row past the last scene | `absent`, stage `resolve`, no write | 23 ms | 2, 1 |
| 8 clips of 16,384 notes to another track (the D44 limit) | verified, 8 slots filled; the first copy equals its source | 8,368 ms | 170, 106 |
| Its revert | verified, 8 slots empty | 14,574 ms | 182, 118 |

In each successful step only the destination slot changed. No mixer value,
track, scene count, or selection changed. The Hybrid arms ran on a scratch
duplicate of the baseline track `Instrument Layer`.

### Cost

The plan expected the stages and turns of the baseline. The call budget
is the same: mark 1, tracks 1, read 3, resolve 1, apply 1, delta 1 (the
call-budget test now also holds a copy to a row that is not the next
row). One clip: 853–888 ms against 924 ms (E247, another project). The
largest case: 8,368 ms against 13,192 ms, and its revert 14,574 ms
against 24,623 ms (E252, project "New 6", same-track next rows). These
times are lower than the ledger rows; no number regressed. The different
project and fixture can explain the difference, so the session claims no
gain from the route. The apply stage is one host call for each copy.

## S4 rerun

[Runbook](../../plan/phase-8/8i-automated-dogfood-runbook.md), the S4
task file, and `phase8i13-stretch.ts s4`. `codex-cli 0.162.1` and Claude
Code 2.1.292; descriptions v47. The entry state equals the 8i13 entry
state (the slot fields apart, issue D11).

| Run | Goal | Ghostnote calls | Other calls | Refusals | Copy writes | Wall | Session |
|---|---|---|---|---|---|---|---|
| S4 Codex | met | 7 (1 dry run) | 5 scripts, 1 `cua_repl` | 0 | 1 | 70 s | 57 s |
| S4 Claude | met | 6 (2 dry runs) | 1 `ToolSearch` | 1 | 1 | 29 s | 26 s |

E262: Codex 13 calls and 101 s; Claude 9 calls and 44 s; three writes for
the copy in each.

- **Goal**: met for both clients. Seq holds A in rows 0 and 2, D in row 3,
  B in row 5, and nothing in row 1. The scene count is 10.
- **Report**: both state the scene limit (Ghostnote adds scenes only at
  the end). Codex adds that computer access to Bitwig was not approved.
  Claude offers the shift alternative and asks.
- **Route**: each agent moved row 1 to row 5, deleted row 2, then copied
  row 0 to row 2 with one `copy_launcher_clips` call (Codex line 39,
  Claude line 42). Claude's refusal is a `copy_launcher_clips` dry run
  before the delete (`occupied`, line 31); it changed nothing.
- **Detour, Codex**: one `cua_repl` call for Bitwig after the clip work
  (line 44), refused as not approved (issue D10). The evidence copy holds
  no application list.
- **Residue**: none. After each cleanup the state equals the entry state.

## State after the session

`gn-scale-test` is at its E234 baseline: the baseline tracks, 10 scenes,
the entry mixer values, and mixer `gn-sel` selected.
`selection.status` reports a slot index of a deleted fixture track (issue
D11). The deployed archive is the normal 8i14 build, SHA-256
`5621e60d9ac16e4207f4e9ba047d5a418e9e8dbb1f88e3e17b853922bdb2aa8a`. The
probe's playing-source case left the transport playing for the operator.

## Limits

- A copy of an audio clip was not tested: the tools cannot make one. The
  tool admits Hybrid tracks, so a Hybrid track can hold an audio clip
  source.
- Clip automation in a copy was not compared (no readback, E43).
- A group track slot accepts a raw copy. The tool refuses group tracks.
- The scene insertion points and copies of scenes were not probed.
- The Hybrid arms used a duplicate of one baseline Hybrid track.

## Retrospective

The plan cases did not say what a multi-source copy can do to the scene
count, and the first probe run left two scenes. The driver now deletes
scenes that a case adds. A probe of a host verb with several targets must
compare the scene count and restore it in the case. The session
instructions need no change.
