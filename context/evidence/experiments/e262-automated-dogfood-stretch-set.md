---
title: E262 — Automated dogfood stretch set
kind: evidence
state: done
updated: 2026-10-11
owner: phase-8i13
---

# E262 — Automated dogfood stretch set

## Status

[8i13](../../plan/phase-8/8i13-automated-dogfood-stretch-set.md) is
complete. The operator selected all five tasks (S1 to S5) with both
clients. A driving agent ran the ten sessions with the
[runbook](../../plan/phase-8/8i-automated-dogfood-runbook.md), with no
operator action. Each session met its goal in the independent state read.
The [issue log](../../plan/phase-8/8i-dogfood-issues.md) has the new rows
D6 to D12. No product code and no tool description changed (v46).

## Entry checks

- `pgrep -f phase8`: no process. `npm run probe:hello`: ALL PASS, the 8i8
  build (92 methods, `0bafdd963fa9f5da`, `fineSteps` 4,194,304, the four
  `rig.info` markers of NOW), 11 tracks. The extension start was 07:26:04
  UTC, the same start as in E261.
- Entry state ([state-entry.jsonl](../data/phase8i13-dogfood/state-entry.jsonl)):
  equal to the E261 entry state. Project `gn-scale-test`, mixer `gn-sel`,
  no slot selected, 10 scenes.
- Clients: `codex-cli 0.162.1`, model `gpt-6.1-sol`, effort medium;
  Claude Code 2.1.292, model `claude-opus-5-5`. Descriptions
  `ghostnote-description-v46`.

## Driver and runner

- `brain/src/probes/phase8i13-stretch.ts <s1|s2|s3|s4> setup|state|cleanup`
  makes each fixture with the product tools and deletes it. `state` prints
  raw wire reads for the tracks, the mixer of every track, the scene count,
  the clip rows of every track (`slot.status`), and the selection. The clip
  documents (S1, S4) and the device list and controls (S2) come from the
  product read tools in the driver process: a raw clip or device read needs
  a cursor. This differs from the plan ("raw wire reads").
- `run-session.sh` has the option `--no-ghostnote-line` for S5.
- Each fixture and its cleanup were checked once before the first agent
  run.
- The first fixture check selected a clip slot. After the track delete,
  `selection.status` kept that slot (`trackIndex` 9, `slotIndex` 0), and
  `slot.status` for it gave `isSelected: false`. The entry state has no
  selected slot, so the comparison after each cleanup leaves out the two
  slot selection fields (issue D11). All other fields were equal after each
  of the ten runs.

## Results

Wall is the runner time. Session is the time from the first to the last
session row. Other calls are scripts (Codex) or tool calls that are not
Ghostnote. A refusal is a Ghostnote result with a `failure`.

| Run | Goal | Ghostnote calls | Other calls | Refusals | Wall | Session |
|---|---|---|---|---|---|---|
| S1 Codex | met | 6 (1 dry run) | 6 scripts | 0 | 59 s | 44 s |
| S1 Claude | met | 5 | 1 `ToolSearch` | 0 | 29 s | 26 s |
| S2 Codex | met | 18 | 10 scripts | 0 | 101 s | 90 s |
| S2 Claude | met | 19 | 1 `ToolSearch` | 1 | 90 s | 88 s |
| S3 Codex | met | 5 | 5 scripts | 0 | 45 s | 29 s |
| S3 Claude | met | 3 | 1 `ToolSearch` | 0 | 18 s | 16 s |
| S4 Codex | met | 13 (2 dry runs) | 8 scripts, 3 `cua_repl` | 1 | 101 s | 88 s |
| S4 Claude | met | 9 (3 dry runs) | 1 `ToolSearch` | 2 | 44 s | 42 s |
| S5 Codex | met | 3 | 5 scripts, 1 `cua_repl` | 0 | 39 s | 26 s |
| S5 Claude | met | 3 | 1 `ToolSearch` | 0 | 12 s | 10 s |

Each session loaded the client's global instruction file only. No session
left a file in its directory. No Claude session had a permission denial.
No Codex Ghostnote call was refused as "not approved"; this includes
`delete_launcher_clip`, `revert_change`, and the modulation wrap tools.
Residue: none after each cleanup. The data of each run is in
`context/evidence/data/phase8i13-dogfood/<task>-<client>/`.

### S1. Mixer and clips on several tracks

- **Goal**: met for both clients. Scene 2 holds four clips named `B` with
  the notes of Scene 1. Scene 1 is unchanged. Lead is muted; Bass raw is
  0.7943282 and Pad raw is 0.5843414. The other 11 tracks are the same.
- **Report**: both agree with the state.
- **Route, Codex**: `list_tracks`; a `copy_launcher_clips` dry run with
  `read_track_mixer` (lines 28, 29); `copy_launcher_clips` (4 copies,
  2.8 s); `set_launcher_clip_properties` (4 clips, 4.3 s);
  `set_track_mixer` (3 tracks). Two of the six scripts are tool
  discovery; the first listing was cut at 41,171 characters (issue D1).
- **Route, Claude**: `list_tracks`, `copy_launcher_clips` and
  `read_track_mixer` together, then `set_launcher_clip_properties` and
  `set_track_mixer` together. No dry run.
- No refusal, no retry, no repeat read, no detour.

### S2. Device structure and a request to undo

- **Goal**: met for both clients. The device list (Polymer only) and each
  Polymer control value (7 direct parameters, each remote control) are
  equal before and after. The mixer of every track is the same.
- **Route, both**: `add_devices` (EQ+, Delay+), `move_devices` (Delay+ to
  position 1), `wrap_existing_device_modulation` (LFO to `CONTENTS/MIX`,
  amount 0.3, in an FX Layer; 11.2 s and 11.9 s). Then the restore:
  `reverse_existing_device_modulation_wrap` (7.2 s and 7.4 s), a second
  `move_devices` back, and two `revert_change` calls for the two
  `add_devices` effects. Count for each client: 2 reverts, 1 reversal
  tool, 1 manual restore (the move back). No agent tried `revert_change`
  on the move.
- **Report**: partly met for both. Each report says that nothing stays
  that it could not undo; the state agrees. No report says that
  `revert_change` cannot reverse the device move and that the agent moved
  the device back by hand (issue D6). Both say that the route was verified
  but that the mix movement was not observed. Claude lists the restore
  steps and says that it did not compare the Polymer values; Codex
  compared the direct parameters before and after.
- **Refusal, Claude**: one `read_device_controls` with a `layer-chain`
  route to Delay+, 3 s after the wrap result, returned `authority-unavailable`
  with `standing: unstable` (line 54). The agent did not retry (issue D7).
- **Observation**: each `revert_change` of an `add_devices` effect
  returned `fidelity: none` and an empty `restored` list, and the device
  was deleted. `check_revert` (Claude, lines 63, 64) returned
  `fullyRestorable: true` with an empty `wouldRestore` list (issue D8).
- Codex made six `read_devices` calls; four follow a structural write in
  the same script. Claude called `check_bitwig_connection` and
  `read_track_mixer` (twice); the task did not need them.

### S3. A request above a D44 limit, with one missing target

- **Goal**: met for both clients. T01 to T12 hold raw 10^(-n/60), from
  0.9623506 to 0.6309573. No track was added. The other tracks are the
  same.
- **Report**: both say that T13 does not exist and was not set. Claude
  also says that T10 was at -10 dB before and gives the two change IDs.
- **Route**: no `outside-limit` refusal. Each agent split the request
  into 8 and 4 tracks before the first write; the `set_track_mixer`
  description gives the limit. Codex read the mixer first (two
  `read_track_mixer` calls, 8 and 4 tracks); Claude did not. The refusal
  path was not exercised.

### S4. Clip and scene structure

- **Goal**: met for both clients. Seq holds A in rows 0 and 2, D in row 3,
  B in row 5, and nothing in row 1. The clip rows of the other tracks are
  the same. The scene count is 10.
- **Report**: both state the scene limit (Ghostnote adds scenes only at
  the end). Claude gives two alternatives. Codex adds "computer control of
  Bitwig was denied".
- **Route**: `copy_launcher_clips` copies only to the next row. Each agent
  copied row 0 to row 1, then row 1 to row 2, then removed the row 1 copy:
  Codex with `revert_change` of the first copy, Claude with
  `delete_launcher_clip`. That is three writes for one copy (issue D9).
  Refusals: Codex, a `move_launcher_clips` dry run from row 1 to row 2
  (`occupied`, boundary row 3; line 66). Claude, a `copy_launcher_clips`
  dry run before the move (`occupied`, line 31) and a
  `move_launcher_clips` dry run of rows 0 to 7 (`absent`, line 32), a
  check of the shift alternative. Each refusal changed nothing. Codex read
  four clips at the end.
- **Detour, Codex**: three `cua_repl` calls, with "Use Ghostnote." in the
  prompt (issue D10). `getApp("Ghostnote")` failed (line 15). `getState()`
  completed and returned the list of the applications on the operator's
  computer (line 20); the evidence copy does not hold the list. After
  `list_tracks`, `getApp("com.bitwig.studio")` was refused: "Computer Use
  was not approved to use Bitwig Studio" (line 40).

### S5. Tool discovery without the Ghostnote line

The prompt is P1 with no "Use Ghostnote." line. The baseline is E261: 3
Ghostnote calls.

- **Goal**: met for both clients. Pad -18.0 dB, Chords -12.0 dB, pan 0.15
  (Codex) and 0.20 (Claude). The other tracks and the selection are the
  same.
- **Report**: both agree with the state.
- **Route, Codex**: the first call was `cua_repl`
  `getApp("Bitwig Studio")`, refused as not approved (line 15). The next
  script searched the tool list for "bitwig", track volume, or "daw" and
  found Ghostnote. Then the E261 route: `list_tracks`, `read_track_mixer`,
  `set_track_mixer`.
- **Route, Claude**: one `ToolSearch` that selects the three Ghostnote
  tools by name, then the E261 route. Ghostnote is the only MCP server of
  the Claude session.
- Both clients reached Ghostnote. In E259, a Codex Desktop agent did not;
  that session had computer use approved. Here the refusal sent the agent
  to the tool list. Inference: with computer use approved for Bitwig, the
  Codex agent can stay on computer use.

## Final state

`gn-scale-test`: no fixture track; 11 tracks, 10 scenes, and the mixer of
every track equal the entry state; mixer `gn-sel` selected.
`selection.status` reports the last selected slot of a deleted track
(`trackIndex` 9, `slotIndex` 2); no slot is selected (issue D11). No task
launched a clip. No `/tmp/gn-dogfood.*` directory and no `/tmp/gn-8i13`
directory remains.

## Limits

- One run for each task and client.
- The `outside-limit` refusal (S3) and a `revert_change` call on a device
  move (S2) were not exercised: each agent avoided them from the
  descriptions.
- The clip and device state of S1, S2, and S4 comes from the product read
  tools in a separate process, not from raw wire reads.
- A Claude call time is the time between the call row and the result row;
  it includes the client and the automatic approval. Do not compare the
  clients by call time.
- The Codex session has the operator's other MCP servers and the
  computer-use plug-in. Claude has the Ghostnote server only.
- S5 used a Codex session in which computer use of Bitwig is not approved.

## Retrospective

The plan asked for raw wire reads of clips and devices; the bridge has no
such read without a cursor. The runbook comparison ("must equal
`state-entry.jsonl`") fails after the first clip write. A plan for a new
fixture driver should name the wire methods of each state field, and the
baseline state file should not hold a field that a fixture changes for
good. The runbook now has the comparison without the slot fields.
