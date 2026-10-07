---
title: E237 — Musical and clip surface migration
kind: evidence
state: done
updated: 2026-10-08
owner: phase-8h4d
---

# E237 — Musical and clip surface migration

## Status

[8h4d](../../plan/phase-8/8h4d-musical-and-clip-surface-migration.md) is
complete. `agent-native-v1` lists 46 tools: the 34 unretired stable tools, the
three document tools, seven Launcher clip tools, and the generic operation
handle. It retires 19 stable tools, each with a row in the
[migration contract](../../contracts/GHOSTNOTE_MIGRATION_AND_VERIFICATION.md).
No observation call site remains in an agent-native write. The 7b profile is
retired. `stable-v1` is unchanged: its registration hash
(`c16f2a9b…71d5f`, 53 tools) and the v25 artifact still reproduce.

Live, the E45/E48-style workflow (read, copy, edit, launch, show, revert of
the edit and the copy) takes 8 calls and 7,864 ms through `agent-native-v1`,
against 7 calls and 13,344 ms through `stable-v1`. Tool descriptions are at
v30. [D39](../../decisions/d39-long-agent-native-writes-run-in-the-background-on-their-own-name.md)
keeps one background route.

## Changes

1. **Observation decoupling.** `agent-native-v1` runs no observation capture:
   the tool dispatch records a result only on `stable-v1`. The semantic
   confirmation still gates the product status. `record_observation`,
   `read_observation_record`, and `report_observations` are not listed. The
   v1–v3 readers, the `observation.*` wire methods, and every stored record
   stay. On `stable-v1` a storage failure still wraps a write result in
   `partialSuccess` (frozen).
2. **Musical tool retirement.** `read_clip` → `read_launcher_clip`;
   `generate_clip_music`, `transform_clip_music`, `write_notes`, `erase_notes`
   → `edit_launcher_clip`; `inspect_clip_block` → the occupancy of
   `copy_launcher_clips` and `move_launcher_clips`; the three clip music
   operation tools → `background` and `inspect_operation`/`cancel_operation`
   (D39). The v1 planner stays for `stable-v1` and its tests.
3. **Launcher clip names**, on the shared result module:
   `add_launcher_clip` (a desired document without BASE; creation, then the
   edit limb with intent `replace`), `copy_launcher_clips` (explicit pairs; the
   host copies only to the row below on the same track, others refuse
   `unsupported`/`copy-destination`), `move_launcher_clips`,
   `set_launcher_clip_launch_settings`, `set_launcher_clip_properties`,
   `delete_launcher_clip` (destructive), and
   `show_launcher_clip_in_detail_editor` (focus, by address). `launch_clip`,
   `add_scenes`, and `delete_scene` keep their names and move to the shared
   result module; their titles say scene.
4. **One property writer.** `completeClipProperties`
   (`bindings/launcher-clip-edit.ts`) completes every `clip.update` of
   `edit_launcher_clip` and `set_launcher_clip_properties`: the palette guard
   before and after, and the loop end that follows the length.
5. **Occupancy.** Copy and move return `occupancy` for every slot that the
   preflight read, also on a dry run and a refusal. New failure code
   `occupied`. A new read option (`ReadOptions.occupancy`) makes a `clip` or
   `slot` address cost one `slot.status`, with no `clip.read` capture and no
   selection borrow.
6. **Reversal records (D19).** A read, `show_launcher_clip_in_detail_editor`,
   and `launch_clip` create no change record. `launch_clip` runs through a new
   workspace seam (`Workspace.launch`) that uses the executor guards and does
   not record. Each durable effect returns its change ID in `effects`.
7. **7b profile retirement.** `phase-7b-agent-note-patch-v0` is no longer a
   selectable profile; the server refuses it. Its tools moved to the research
   module `brain/src/probes/phase7b-profile.ts` for the historical probes,
   which now call `callExperimental7b`. The frozen registration is
   [phase7b-registration.json](../data/phase8h4d-surface/phase7b-registration.json)
   (`5752e0a7…a40dbf`, the three 7b tools with open custom input types).
8. **Readback.** Copy, move, properties, launch settings, and delete use the
   executor verify read as the readback when it covers every address (D15,
   D38). It is a new host read after the write.

## Offline

`agent-native-clips.test.ts` (15 tests): each tool, the occupancy report,
refusals that write nothing, the D19 record rule for each retained tool in the
group, observation decoupling for `copy_track` and `create_device_alternates`
with a store that fails on every access (no access, no change to the result),
the frozen `stable-v1` contrast, and the background route. Call budgets:
`call-budget.test.ts` adds the 8h4d tools; the live adapter frame test adds
the occupancy read (`revision.get`, `track.list`, `slot.status`).

| Tool | Adapter calls (call-budget test) |
|---|---|
| `add_launcher_clip`, 16 notes | mark 3, tracks 2, read 3, resolve 2, apply 2, delta 4, clipRead 3 |
| `copy_launcher_clips`, one pair | mark 1, tracks 1, read 3, resolve 1, apply 1, delta 1 |
| `set_launcher_clip_properties`, one clip | mark 1, tracks 1, read 3, resolve 1, apply 1, delta 1 |
| `launch_clip` | mark 1, tracks 1, read 4, apply 1, delta 1 |
| `show_launcher_clip_in_detail_editor` | mark 2, tracks 1, read 1, resolve 1 |

## Live acceptance

Driver `brain/src/probes/phase8h4d-workflow.ts workflow`; owned unsaved project
`New 3`; normal profile, 8h4c2 build (no extension change). Track
`gn-8h4d-workflow`, the typical clip (256 notes, 16 channels, 64 beats) in
row 0. Each block ends at the raw baseline: an independent raw `clip.read` of
row 0 equals the first read, and rows 1 and 2 are empty
([workflow.json](../data/phase8h4d-surface/workflow.json); `verify-offline`
recomputes the totals).

| Step | `stable-v1` | ms | bytes | `agent-native-v1` | ms | bytes |
|---|---|---:|---:|---|---:|---:|
| Read | `read_clip` (channel 0) | 664 | 3,946 | `read_launcher_clip` | 468 | 10,957 |
| Copy | `copy_clip_down` | 2,897 | 2,135 | `copy_launcher_clips` | 1,249 | 688 |
| Edit | `write_notes`, 16 notes | 1,179 | 1,498 | `read_launcher_clip`, `edit_launcher_clip` | 474, 1,579 | 11,250, 910 |
| Launch | `launch_clip` | 684 | 373 | `launch_clip` | 750 | 424 |
| Show | `show_changed_clip` | 578 | 301 | `show_launcher_clip_in_detail_editor` | 264 | 232 |
| Revert edit | `revert_change` | 4,860 | 2,971 | `revert_change` | 1,562 | 2,971 |
| Revert copy | `revert_change` | 2,482 | 3,867 | `revert_change` | 1,518 | 3,648 |
| Total | 7 calls | 13,344 | 15,091 | 8 calls | 7,864 | 31,080 |

The agent-native result bytes are higher because `read_launcher_clip`
returns the complete clip on 16 channels; `read_clip` returns one channel. The
agent-native edit needs its own read for the base. The stable copy also writes
the launch settings of both clips. The agent-native edit is targeted, so its
reversal is the targeted inverse.

Other measurements:

- **Add.** `add_launcher_clip` with 16 notes on 16 channels: 2,611 ms (read
  364, plan 19, write 955), route targeted, readback `verified`; the clip
  loops over 8 beats as the document asks. `add_clip` on `stable-v1`:
  1,827 ms. Reverting the add takes two calls (4,707 and 1,518 ms).
- **Background.** A 64-note velocity patch (whole-clip) with `background`:
  the handle returns in 1 ms; `inspect_operation` reports `completed` after
  2,057 ms (8 polls at 250 ms); the operation took 1,914 ms; readback
  `verified`.
- **Launch.** Four alternating pairs: `stable-v1` median 696 ms,
  `agent-native-v1` 764 ms (+10 percent: the track check and the occupancy
  check). The first version read the slot as a `clip` address, which the live
  adapter answers with a `clip.read` capture and a selection borrow
  (1,077 ms, +55 percent). A wire trace named the cause; the occupancy read
  option removed it.
- **Edit remeasure** (`phase8h4c-edit.ts cost`; the property writer moved):
  one read and a 16-note insertion 2,030–2,058 ms, edit 1,538–1,550 ms, 56–58
  wire calls ([edit-cost.json](../data/phase8h4d-surface/edit-cost.json)).
  E246: 1,877–1,936 ms, 1,449–1,470 ms, 56–58 calls. The call count and the
  plan time (about 115 ms) are the same; the turns were slower this run
  (about 24–26 ms against 20–22 ms). The difference is 6–8 percent.

## Compatibility

- Removed from `agent-native-v1` only; `stable-v1` lists all 53 tools with
  the frozen wording. A client on `agent-native-v1` that calls a retired name
  gets `no such tool`.
- The `phase-7b-agent-note-patch-v0` server profile no longer starts. Ten
  historical probes import the research module instead of the profile.
- `ReadOptions` gains `occupancy`; `Workspace` gains an optional `launch`.
  `FAILURE_CODES` gains `occupied`.

## Verification

Brain check (2,032 tests), extension check (19 reader groups; archive
registrations agree), wire goldens current (normal 88, `68d457c4c4d1d7b3`),
the publication inventory, the context check, and `git diff --check`. The
live project `New 3` held only its default tracks after the runs.

## Retrospective

The first launch timing was 55 percent slower than stable. The cost model
counted an occupancy read as one turn, but the live adapter reads a `clip`
address with its length. A wire trace before the cost model would have shown
it. The ledger now names the occupancy read.
