---
title: E261 — Automated dogfood process proof
kind: evidence
state: done
updated: 2026-10-11
owner: phase-8i12
---

# E261 — Automated dogfood process proof

## Status

[8i12](../../plan/phase-8/8i12-automated-dogfood-process-proof.md) is
complete. A driving agent ran one fresh Codex session and one fresh Claude
session on the mixer task P1 in `gn-scale-test`, with no operator action
after the entry checks. Both sessions met the goal on the E257 route. The
[runbook](../../plan/phase-8/8i-automated-dogfood-runbook.md), the
[issue log](../../plan/phase-8/8i-dogfood-issues.md), and the
[stretch-set proposal](../../plan/phase-8/8i13-automated-dogfood-stretch-set.md)
exist. No product code and no tool description changed (v46).

## Entry checks

- `pgrep -f phase8`: no process. `npm run probe:hello`: ALL PASS, the 8i8
  build (92 methods, `0bafdd963fa9f5da`, `fineSteps` 4,194,304, the four
  `rig.info` markers of NOW).
- The extension started at 07:26:04 UTC. The `track.list` of that first
  hello had 4 tracks (Inst 1, Audio 2, FX 1, Master). Each later read had
  the 11 tracks of `gn-scale-test`. Inference: the hello ran before the
  project load finished. The hello does not check the project name; the
  runbook does (issue D4).
- Entry state ([state-entry.jsonl](../data/phase8i12-dogfood/state-entry.jsonl)):
  project `gn-scale-test`, mixer `gn-sel` selected (index 8), and no slot
  selected (`selection.status` slot index -1). The E234 baseline names
  slot `gn-A` row 0. The session did not change the slot selection
  (issue D5).
- Clients: `codex-cli 0.162.1`, model `gpt-6.1-sol`, effort medium;
  Claude Code 2.1.292, model `claude-opus-5-5`. Descriptions
  `ghostnote-description-v46`.

## Runner

`tools/dogfood/run-session.sh <codex|claude> <task-file> <out-dir>` makes a
new directory `/tmp/gn-dogfood.*`, runs the client there with
`< /dev/null`, and deletes the directory. It adds the line "Use Ghostnote."
to the task text. `tools/dogfood/extract.mjs` makes the E259-format extract
from the client session file. The commands of the plan needed two
corrections:

- Claude Code did not start the server from an MCP configuration with a
  `cwd` field: the server status was `failed`, and the agent reported it
  and stopped in 7 s
  ([smoke-claude-failed-server](../data/phase8i12-dogfood/smoke-claude-failed-server/events.jsonl)).
  The runner now uses `sh -c "cd <repo>/brain && exec node --import tsx
  src/mcp-server.ts"`.
- The Codex event stream (`--json`) has no script (`exec`) call. The
  rollout file has each call, so the runner copies the client session file
  to `session.jsonl`, and the extract reads that file.

One read-only smoke prompt ("Which tracks are in the open Bitwig project?
Change nothing.") passed with each client before P1:
[smoke-codex](../data/phase8i12-dogfood/smoke-codex/events.jsonl) (42 s,
one `list_tracks`) and
[smoke-claude](../data/phase8i12-dogfood/smoke-claude/events.jsonl) (10 s,
one tool search and one `list_tracks`).

## Step-2 questions

| Question | Answer | Transcript |
|---|---|---|
| Codex: does `--approve-for-me` approve Ghostnote write tools without the per-tool entries? | Yes for `set_track_mixer`, which has no entry in the operator's configuration (E257: blocked without one). The session ran with approval policy `on-request` and the `workspace-write` sandbox. The script that made the write took 3.0 s; the Ghostnote call took 321 ms. Inference: the automatic review is most of the difference. One write tool was tested | [p1-codex extract](../data/phase8i12-dogfood/p1-codex/extract.jsonl), lines 8, 31–34 |
| Codex: does the refused `cua_repl` call still occur? | No call in the smoke run or in P1 (E257: one refused call in each of two runs). The plug-in is still available to the session; the runner does not disable it | [p1-codex events](../data/phase8i12-dogfood/p1-codex/events.jsonl) |
| Claude: does the session load `~/.claude/CLAUDE.md` and no repository file? | Yes. The `instructions` row of the session file lists `~/.claude/CLAUDE.md` only. Codex loaded its global `AGENTS.md` ("Stay concise and to the point.") only. Each client also loads its own skills and plug-in listings | [p1-claude extract](../data/phase8i12-dogfood/p1-claude/extract.jsonl), line 11; p1-codex extract, line 6 |
| Both: where is the complete transcript, and is a tool result cut? | Codex: `~/.codex/sessions/<date>/rollout-*-<thread id>.jsonl`; the event stream is not complete (no script call). Claude: `~/.claude/projects/-private-tmp-gn-dogfood-<suffix>/<session id>.jsonl`; it has the same calls as the event stream, plus the row times and the instruction files. No Ghostnote result was cut: the largest was 2,125 characters (Codex) and 1,894 (Claude). The Codex client cut the output of the agent's tool-listing script (23,318 tokens before the cut). The cut of a large Ghostnote result was not exercised | `meta.json` of each run (`sessionFile`) |

## P1 runs

Setup `phase8i7-mixer.ts trial-setup`: tracks Pad and Chords at -10 dB,
centre. Prompt: "In the open Bitwig project, set the Pad track to -18 dB
and the Chords track to -12 dB, and pan Chords a little to the right." and
the runner line "Use Ghostnote.". The independent read is `trial-state
all`: one raw `track.mixer` call for all 13 tracks, before and after.

| Measure | E257 (Codex 0.159.2, v43) | Codex | Claude |
|---|---|---|---|
| Ghostnote calls | 3 | 3 | 3 |
| Calls to other tools | 1 refused `cua_repl` | 2 scripts (tool listing) | 1 `ToolSearch` |
| Refusals, retries, repeat reads | 0 | 0 | 0 |
| Wall time (runner) | 42 s | 46 s | 13 s |
| First to last session row | — | 24 s | 11 s |
| Pad raw | 0.50119 | 0.5011872 | 0.5011872 |
| Chords raw | 0.63096 | 0.6309573 | 0.6309573 |
| Chords pan | 0.15 | 0.15 | 0.20 |
| Other tracks and selection | — | unchanged | unchanged |
| Files left in the session directory | — | none | none |

The plan gave the E257 baseline as 4 Ghostnote calls; E257 has 3 Ghostnote
calls and 1 computer-use call.

### Codex

Extract: [p1-codex/extract.jsonl](../data/phase8i12-dogfood/p1-codex/extract.jsonl);
thread `01a129de-6d8c-7103-9089-0fb939a4ac1b`.

- **Goal**: met. Pad -18.0 dB, Chords -12.0 dB, pan 0.15; the other 11
  tracks and the selection are the same
  ([before](../data/phase8i12-dogfood/p1-codex/state-before.jsonl),
  [after](../data/phase8i12-dogfood/p1-codex/state-after.jsonl)).
- **Report**: agrees. "Pad: −18 dB; Chords: −12 dB, panned 15% right".
- **Route**: `list_tracks` (177 ms), `read_track_mixer` for both tracks
  (75 ms), `set_track_mixer` with three fields (321 ms): the E257 route. No
  refusal, no retry, no repeat read, no computer-use attempt, no shell or
  file action. Before the first Ghostnote call, the agent ran two scripts
  that list the Ghostnote tools and print two descriptions (lines 13 and
  17). This is the client's tool discovery, not a detour; the first
  listing was 23,318 tokens before the client cut it (issue D1). The
  process ended 21 s after the last message (issue D2).
- **Residue**: none. After `trial-cleanup`, `trial-state all` equals the
  entry state.

### Claude

Extract: [p1-claude/extract.jsonl](../data/phase8i12-dogfood/p1-claude/extract.jsonl);
session `68c0491e-d424-4afe-abe2-81829ef6a749`.

- **Goal**: met. Pad -18.0 dB, Chords -12.0 dB, pan 0.20; the other 11
  tracks and the selection are the same
  ([before](../data/phase8i12-dogfood/p1-claude/state-before.jsonl),
  [after](../data/phase8i12-dogfood/p1-claude/state-after.jsonl)).
- **Report**: agrees. It states the 20 % pan as its own choice and names
  the change ID for a revert.
- **Route**: one `ToolSearch` that selects the three tools by name (the
  client defers MCP tools; 40 ms), then `list_tracks`, `read_track_mixer`,
  `set_track_mixer`: the E257 route. No refusal, no retry, no repeat read,
  no shell or file action, no permission denial. The session file has no
  reasoning text.
- **Residue**: none. After `trial-cleanup`, `trial-state all` equals the
  entry state.

## Driver change

`phase8i7-mixer.ts trial-setup` refused `gn-scale-test`: its guard admitted
an unsaved project only (8i7 used "New 3"). The plan names `gn-scale-test`,
and the trial modes add and delete only the tracks Pad and Chords, so
`trial-setup` now requires `gn-scale-test`. `measure` and `hold` keep the
old guard. `trial-state all` prints every track and the selection. No host
call was added to a live path; no call budget and no ledger number changed.

## Final state

`gn-scale-test`: no Pad or Chords track; the mixer of all 11 tracks and the
selection equal the entry state (mixer `gn-sel`; no slot selected, as at
entry). No `/tmp/gn-dogfood.*` directory remains. The clients keep their
own session files (`~/.codex/sessions`, `~/.claude/projects`).

## Limits

- One task, one run for each client. The loop is proved for a short
  structured write; a long session, a refusal, and a large result are not
  exercised.
- The Codex session has the operator's other MCP servers and the
  computer-use plug-in available. Claude has the Ghostnote server only
  (`--strict-mcp-config`) but keeps its built-in tools (shell, files, web).
- Wall times include client start and end; compare the session-row times.
- The automatic approval was tested on one Codex write tool and one Claude
  write tool.

## Retrospective

The plan named a driver mode and a project that the driver guard did not
admit together, and gave the baseline call count from memory. A plan that
reuses a driver mode in a new project should run its guard once (a
read-only mode is enough) when the plan is written.
