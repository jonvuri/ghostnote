---
title: Phase 8h4d — Musical and clip surface migration
kind: plan
state: planned
status: Planned. Retires the old musical read and write tools and the observation workflow from agent-native-v1, and applies the Launcher clip names.
updated: 2026-10-06
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h4c-document-edit-limb.md
next: 8h4e0-direct-parameter-display-probe.md
evidence: E20b, E43, E45, E48, E128, E135; D19, D21, D25
---

# Phase 8h4d — Musical and clip surface migration

## Why

After 8h4b and 8h4c, two read routes and four write routes do the same
musical work. The observation workflow stores agent memory a second time
(8a). The clip tools do not name Launcher scope.

## Work, in order

### 1. Observation decoupling and retirement

- Remove automatic capture from `generate_clip_music`,
  `transform_clip_music`, `copy_clip_down`, `copy_track`, and
  `create_device_alternates`. A storage failure must not change a write
  result; add a test for each site.
- Remove `record_observation`, `read_observation_record`, and
  `report_observations` from `agent-native-v1`. Keep the v1–v3 readers and
  the `observation.*` wire methods for old projects. Record the compatibility
  policy in the migration contract. Delete no stored record.

### 2. Musical tool retirement

Remove from `agent-native-v1`, with one migration row each:

- `read_clip`, `acquire_clip_note_source` → `read_launcher_clip`;
- `generate_clip_music`, `transform_clip_music`, `write_notes`,
  `erase_notes` → `edit_launcher_clip`. The agent owns generation and
  transformation. Keep the v1 planner as a comparison implementation in
  tests only;
- `inspect_clip_block` → repeated `read_launcher_clip` plus boundary
  occupancy. Add bounded occupancy for explicit rows to the `list_tracks` or
  the copy and move preflight result first; the migration contract requires
  it;
- `inspect_clip_music_operation`, `start_clip_music_operation`,
  `cancel_clip_music_operation`: these exist because a long edit exceeded the
  MCP client request timeout. E45 measured a 60 s client timeout, after which
  the brain continued to mutate the project (E47). Ghostnote does not set this
  timeout, and clients can change it. Use 60 s as the measured budget. Remove
  the three tools only if the 8h4c worst-case edits all finish in at most
  30 s, end to end, with verification. If not, add one generic operation
  handle and record the measured times.

Retire the `phase-7b-agent-note-patch-v0` profile. Its comparison owners
(E131 pairing, E230, the E233 matrix) are discharged. Keep its frozen
registration fixture as evidence.

### 3. Launcher clip names

In `agent-native-v1`, on the shared result module:

- `add_clip` → `add_launcher_clip`. It accepts the Document 1.0 content
  and lowers it through the 8h4c path.
- `copy_clip_down` → `copy_launcher_clips` with explicit sources and
  destinations. Keep the occupancy guards (E20b).
- `move_clip_block` → `move_launcher_clips`. The contiguous range is in the
  request. Keep structural re-resolution.
- `set_clip_launch` → `set_launcher_clip_launch_settings`;
  `set_clip_metadata` → `set_launcher_clip_properties`. Overlapping
  property writes in `edit_launcher_clip` and here use one writer.
- `delete_clip` → `delete_launcher_clip`, a separate destructive name.
- `show_changed_clip` → `show_launcher_clip_in_detail_editor`.
- `launch_clip`, `add_scenes`, `delete_scene` keep their names. Use `scene` in
  titles and descriptions and `row` only in addresses.

### 4. Reversal records

Under D19, reads, navigation, launch, and transport create no change record.
Add a test that each retained tool in this group creates a record only for a
durable effect.

## Acceptance criteria

- Each removed tool has a migration or incompatibility row in the migration
  contract.
- No observation call site remains in a write path. Old records still read.
- A representative E45/E48-style workflow runs live through `agent-native-v1`:
  copy, edit, launch, show, revert. Record tool calls, result bytes, and wall
  time against the same workflow on `stable-v1`.
- `stable-v1` is unchanged. Brain check, extension check, wire goldens,
  context check, and `git diff --check` pass. Record the evidence as E237.

## Out of scope

- Device tools (8h4e). Track tools and the profile cut (8h4f).
- Removal of observation wire methods or stored-record readers.
