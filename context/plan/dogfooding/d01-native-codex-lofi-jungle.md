---
title: D01 — native Codex lo-fi jungle attempt
kind: status
state: blocked
updated: 2026-08-23
parent: README.md
---

# D01 — native Codex lo-fi jungle attempt

## Session

- Session ID: `01a0304d-f855-73d0-99f9-38d3bb3486d8`.
- Transcript: `~/.codex/sessions/2026/08/23/rollout-2026-08-23T15-26-51-01a0304d-f855-73d0-99f9-38d3bb3486d8.jsonl`.
- Host: ChatGPT desktop, Codex mode, version `0.149.0-alpha.4.1`.
- Started: `2026-08-23T20:26:51.349Z`.
- Project: `New 2`, with four visible tracks and eight launcher rows.
- Goal: Create a high-tempo, soft-spoken lo-fi jungle beat. Build native
  synthesized drums on the first instrument track and write a sparse jungle
  clip. Use no samples.

The prompt prohibited repository access, shell commands, tests, and probes. The
agent complied. Calls through the Codex orchestration tool were native Ghostnote
MCP calls, not shell execution.

## Result

The corrected MCP configuration worked. Ghostnote registered as a native MCP
server and reached Bitwig without a network permission request. `check_connection`
reported project `New 2`. `list_tracks` returned the four complete durable track
identities.

No Bitwig content changed. No clip or device write began. The agent stopped when
it could not read a safe pre-state. It recorded and closed observation
`bedca1dc-6744-4c85-b8f2-ebf473585130` with correlation ID
`96a07065-430c-465e-a536-b51c1d56b4f7`.

## Lead 1 — Codex exposed only 40 of 45 tools

The server has 45 registered tools. Codex exposed 40 in this chat. These five
public clip-authoring tools were absent:

- `generate_clip_music`
- `transform_clip_music`
- `start_clip_music_operation`
- `write_notes`
- `add_clip`

The agent explicitly checked `start_clip_music_operation` and `write_notes`; both
were `undefined`. It also looked for a deferred tool-search mechanism and found
none. The missing set prevented the MIDI part of the requested workflow.

The missing set is not consistent with a 40-tool limit or an ordering cutoff.
The exposed list is alphabetized and has five holes. A local schema inventory
found one exact shared property: these five schemas emit JSON Schema
`prefixItems`. No exposed schema emits it.

Two recurrence tuples cause the shared property:

- `surface/tools.ts` uses a two-number tuple for `write_notes` and `add_clip`.
- `musical/patch.ts` uses the same tuple for `generate_clip_music`,
  `transform_clip_music`, and the nested patch in
  `start_clip_music_operation`.

OpenAI documents support for ordinary arrays with `minItems` and `maxItems`, but
does not list `prefixItems` in its supported JSON Schema subset. This makes
host-side schema rejection the leading cause. It remains an inference until a
fresh Codex chat proves the A/B result.

## Lead 2 — a stale selected track index blocks reads

The first `inspect_devices` and eight parallel `read_clip` calls all failed with:

```text
Invalid params: no track at index: 5
```

The agent then refreshed `list_tracks`, retried `inspect_devices`, refreshed
`check_connection`, and retried one `read_clip`. The same error remained. The
project had four tracks, so index `5` could not name a current track.

The code trace isolates stale UI-selection restoration after a project change:

- `LiveAdapter.captureSelection()` accepts any nonnegative observed track and
  slot indexes.
- `LiveAdapter.devices()` captures selection before its fresh track scan.
- `LiveAdapter.restoreSelectionNow()` sends the saved indexes to `slotSelect`
  without checking them against the current project window.
- `HandlerGroup.requireTrack()` then rejects saved index `5` because the current
  four-track bank has no such item.

The requested reads resolve the durable target to current track index `0`. The
only index `5` used by these paths comes from the saved selection. Both device
and clip reads restore that saved pair before returning, so a restore failure can
mask a successful content read. A focused live check must still confirm the wire
sequence after a project switch.

## Product-surface gap

The requested native synthesized drum rack is not directly expressible through
the current public surface. There is no public drum-rack composition tool. The
surface can append a top-level device and can inspect a drum-pad route, but it
cannot populate drum pads with synthesized devices. Loading a prepared preset
would not satisfy the requested from-scratch workflow.

Keep this separate from both defects above. After the defects are fixed, decide
whether a real musical retry should use a narrower goal or whether dogfooding has
justified a new Phase 6 drum-rack composition item.

## Focused follow-up session 1 — restore Codex clip-tool exposure

### Objective

Prove the schema rejection and make all 45 public tools available in a fresh
native Codex chat. Do not change tool names, descriptions, or public recurrence
values.

### Work

1. Record the server's 45-name `tools/list` result. Start a fresh Codex chat that
   names `write_notes` in the initial prompt, then record the exposed tool names.
2. Replace both homogeneous two-number tuple schemas with arrays that require
   exactly two numbers. Preserve the public `[length, mask]` value and narrow it
   to the contract tuple after validation.
3. Add a host-schema compatibility regression. It must inspect every public tool
   schema and reject `prefixItems`.
4. Run the focused surface tests and the full brain check.
5. Start another fresh Codex chat. Confirm that all five previously missing tools
   are exposed and callable. Do not make a Bitwig write in this exposure check.

### Acceptance criteria

- MCP `tools/list` still returns the same 45 public names.
- Codex exposes all 45 names, including the five clip-authoring tools.
- Recurrence still accepts exactly `[length, mask]` and rejects other lengths.
- The compatibility regression and full brain check pass.
- No Bitwig content changes.

### Outcome — complete

[E74](../../evidence/experiments/e74-homogeneous-recurrence-schemas-restore-codex-tools.md)
records the completed A/B result. MCP `tools/list` kept the same 45 names. The
five tuple-style schemas became homogeneous number arrays with exact length two.
The compatibility regression rejects both `prefixItems` and draft-7
array-valued `items` across every public schema.

Fresh Codex session `01a03069-d710-7150-885e-74845fb88f50` named `write_notes`
in its initial prompt and exposed all 45 Ghostnote tools. It reported the five
previously missing tools as callable. It called no Ghostnote tool. The focused
tests pass 80/80, the description cohort tests pass 9/9, and the full brain
check passes 826/826. No Bitwig content changed. Public schema cohort v8 records
the schema change without changing tool names, descriptions, or recurrence
values.

## Focused follow-up session 2 — invalidate stale selection restoration

### Objective

Preserve a valid current human clip selection, but never restore a cached pair
that no longer names the selected slot in the foreground project.

### Work

1. Reproduce one read-only call after a project switch. Record
   `selection.status`, the content-read result, and the restore frame separately.
2. Make `LiveAdapter.captureSelection()` accept a nonnegative pair only after
   `slot.status` confirms that the exact current slot has `isSelected: true`.
   Treat only an invalid cached track or row as no saved selection. Propagate an
   unrelated bridge failure.
3. Add an offline regression with cached track index `5` and a current four-track
   project. The device or clip read must return its content and must not send an
   invalid restore.
4. Keep the existing valid-selection regression. It must prove that a current
   human selection is restored exactly once.
5. Deploy the extension if the fix changes its wire behavior. Run one focused
   live project-switch check and leave both projects unchanged.

### Acceptance criteria

- A stale selection cannot mask a successful device or clip read.
- No restore frame names a track or row that is absent from the current project.
- A valid current human clip selection is preserved.
- Offline regressions and the full brain and extension checks pass.
- The live project-switch check changes no Bitwig content.

## Dogfood gate

Complete and verify both focused sessions before the next musical dogfood chat.
Then retry a goal that the current public surface can express fully. Keep the
drum-rack product gap separate from these two fixes.
