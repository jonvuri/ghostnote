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

Treat this as a host-exposure defect until isolated. In a new chat, name one
missing tool explicitly in the initial prompt and inspect the exposed tool set.
Compare that set with the server's `tools/list` result. Determine whether this is
a 40-tool limit, deferred discovery failure, schema rejection, description budget,
or another Codex host rule. Do not remove tools or shorten descriptions before
that comparison.

## Lead 2 — a stale selected track index blocks reads

The first `inspect_devices` and eight parallel `read_clip` calls all failed with:

```text
Invalid params: no track at index: 5
```

The agent then refreshed `list_tracks`, retried `inspect_devices`, refreshed
`check_connection`, and retried one `read_clip`. The same error remained. The
project had four tracks, so index `5` could not name a current track.

The leading code hypothesis is stale UI-selection restoration after a project
change:

- `LiveAdapter.captureSelection()` accepts any nonnegative observed track and
  slot indexes.
- `LiveAdapter.devices()` captures selection before its fresh track scan.
- `LiveAdapter.restoreSelectionNow()` sends the saved indexes to `slotSelect`
  without checking them against the current project window.
- `HandlerGroup.requireTrack()` then rejects saved index `5` because the current
  four-track bank has no such item.

This is not yet proved. Reproduce it with the smallest focused call after a
project switch. Observe selection status before the call. Confirm whether the
read itself succeeds and only restoration fails. A fix must preserve valid human
selection and skip or safely invalidate a selection that belongs to the prior
project. Add an offline regression and a focused live project-switch check.

## Product-surface gap

The requested native synthesized drum rack is not directly expressible through
the current public surface. There is no public drum-rack composition tool. The
surface can append a top-level device and can inspect a drum-pad route, but it
cannot populate drum pads with synthesized devices. Loading a prepared preset
would not satisfy the requested from-scratch workflow.

Keep this separate from both defects above. After the defects are fixed, decide
whether a real musical retry should use a narrower goal or whether dogfooding has
justified a new Phase 6 drum-rack composition item.

## Next engineering session

1. Reproduce and classify the 40-of-45 Codex exposure issue.
2. Reproduce the stale selection index with one read-only call.
3. Fix the proved boundary and add regression coverage.
4. Start a new Codex musical chat and retry a goal the public surface can fully
   express.
