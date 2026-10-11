---
title: Phase 8i12 automated dogfood process proof
kind: plan
state: planned
status: Planned. Prove one repeatable automated dogfood session with Codex and with Claude, then propose the session goals for the stretch set.
updated: 2026-10-11
parent: README.md
prev: 8i11-claim-replacement-repair.md
next: 8i-agent-native-hybrid-dogfood.md
evidence: E255, E257, E259, E260
---

# Phase 8i12 automated dogfood process proof

The 8i trials stretched some parts of Ghostnote only a little: the mixer
tools in real work, device structure writes, work that the D44 limits
split, reversal limits, clip and scene structure, and refusal repairs. The
operator ran each earlier trial by hand. This session proves an automated
loop for mechanical tasks, so that later sessions can stretch those parts
without the operator.

Aesthetic goals stay with the operator. An automated task has a mechanical
goal that the driving agent can check.

## The loop

1. The driving agent takes one task from the task list.
2. It sets up the fixture and records the state before the run.
3. It starts one fresh agent session (Codex or Claude) in automatic
   review mode, with the Ghostnote MCP server. Computer use is not part
   of the loop: the tasks need no UI action. The session gets the task
   text only: no repository, no tool names, no sequence.
4. When the session ends, the driving agent reads the transcript and makes
   an independent read of the project state. It gives a verdict on the
   goal and on the route (see [Evaluation](#evaluation)).
5. It adds each issue to the issue log, restores the fixture, and takes the
   next task. It does not change product code. The operator reviews the log
   in a later live session.

## Work

### 1. Entry checks

- Read `context/NOW.md`. Ask the operator to open Bitwig with the owned
  project `gn-scale-test` at its E234 baseline. Check `pgrep -f phase8`,
  then `npm run probe:hello` (the 8i8 build markers of NOW).
- Record the client versions (`codex --version`, `claude --version`), the
  default models, and the description version (v46 expected).

### 2. Session runner

Add `tools/dogfood/run-session.sh <codex|claude> <task-file> <out-dir>`.
It makes a new empty directory in `/tmp`, runs the client there with
`< /dev/null`, and writes the event stream, the last message, the start
and end times, and the exit code to `<out-dir>`. A task file holds the
prompt only. The runner adds the line "Use Ghostnote." (E259: without a
mention, a Codex Desktop agent did not find the server).

Start from these commands and correct them in the session:

```sh
# Codex (0.162.1): automatic review, no per-tool approvals
codex exec --json --skip-git-repo-check --approve-for-me \
  -o last.txt "$PROMPT" < /dev/null > events.jsonl

# Claude Code (2.1.292): automatic permission mode, Ghostnote only
claude -p "$PROMPT" --permission-mode auto \
  --mcp-config ghostnote.mcp.json --strict-mcp-config \
  --output-format stream-json --verbose < /dev/null > events.jsonl
```

`ghostnote.mcp.json` starts `node --import tsx src/mcp-server.ts` in
`brain/`, as the Codex configuration does. Each run starts a new server,
so claims do not cross sessions.

Questions that this step must answer, each with a transcript:

- Codex: does `--approve-for-me` approve Ghostnote write tools without the
  `-c mcp_servers.ghostnote.tools.<tool>.approval_mode` entries? If not,
  the runner passes one entry for each write tool.
- Codex: E257 recorded one refused computer-use call (`cua_repl`) before
  the first Ghostnote call. Does it still occur, and does it cost more
  than one call? Do not enable computer use.
- Claude: does the session load `~/.claude/CLAUDE.md` and no repository
  file? The Codex trials had the same global instruction only.
- Both: where is the complete transcript (the event stream, or the session
  file in `~/.codex/sessions` or `~/.claude/projects`), and is a tool
  result cut (Codex cuts at about 24,000 characters)?

### 3. Proving task

Run the task once with each client. Restore the fixture between the runs.

**P1, structured write (baseline E257).** Setup:
`phase8i7-mixer.ts trial-setup` (tracks Pad and Chords at -10 dB, centre).
Prompt: "In the open Bitwig project, set the Pad track to -18 dB and the
Chords track to -12 dB, and pan Chords a little to the right." Check:
`phase8i7-mixer.ts trial-state` shows raw 0.50119 and 0.63096 (±0.0001)
and a Chords pan above 0; no other track changed. Baseline: 4 Ghostnote
calls, no refusal, 42 s. Cleanup: `trial-cleanup`.

The task has a known result and a known route, so a difference comes
from the runner or the client, not from the task.

### 4. Evaluation

For each run, write one extract in the E259 format and one verdict:

- **Goal**: met, partly met, or not met, from the independent read.
- **Report**: the agent's last message agrees with the state.
- **Route**: Ghostnote calls, calls to other tools, refusals, retries,
  repeat reads, wall time, and each detour with its transcript line. A
  detour is a computer-use attempt, a file-system or shell action, a help
  request that the task did not need, or a call that repeats a result the
  agent already had. Compare P1 with the E257 baseline.
- **Residue**: none, after cleanup.

The driving agent states causes as inferences when the transcript has no
reasoning text (the interface review rule).

### 5. Issue log and runbook

- Add `8i-dogfood-issues.md` (kind `reference`): one row for each issue,
  with an ID, the task, the client, the transcript reference, what
  happened, what was expected, the suspected owner (description, tool,
  client, or agent), and the operator's decision (empty until the review).
- Add `8i-automated-dogfood-runbook.md` (kind `reference`): the exact
  steps of the loop as they worked, the commands for each client, the
  approvals, the transcript paths, the evaluation checklist, and the task
  file format. A later driving agent must be able to follow it with no
  other source.

### 6. Stretch-set proposal

Propose the tasks for the next session; the operator selects them. Each
proposal names its goal, fixture, check, and cleanup. Each task must need
no UI action. Candidate areas, from the 8i coverage review:

- mixer changes together with clip work on several tracks;
- device structure: `compose_devices`, `move_devices`, and a modulation
  route, with a request to undo the work (`revert_change` does not reverse
  `move_devices` or clip moves);
- a request above a D44 limit, which the agent must split and which can
  stop part-way;
- clip copy, move, delete, and scene structure (no insert above row 0);
- the 8i11 repairs: a task that leads to a duplicate claim or a positive
  `atDelta`; the driver can make the hand edit of T1 step 3 with a probe
  write, and the check is that the agent names the stale and removed
  claims (E259); and
- tool discovery without the "Use Ghostnote." line, for each client.

Add the selected tasks as session 8i13 with a source link.

## Cost model

No live path changes and no host call is added. The driver adds the 8i7
trial setup, state, and cleanup calls (E257). No tool description changes
unless the runs show a description fault; a fault goes to the issue log,
not into this session.

## Acceptance

- The runner starts a fresh session for each client from an empty
  directory, without an operator action after the entry checks.
- Each of the two runs (P1, two clients) has a transcript extract, an
  independent state read, and a verdict.
- Each step-2 question has an answer in the E record.
- The runbook and the issue log exist, and the issue log has every issue
  that the verdicts name.
- `gn-scale-test` is at its E234 baseline: no Pad or Chords track, slot
  `gn-A` row 0 and mixer `gn-sel` selected. The `/tmp` directories hold no
  needed artifact.
- A new E record (E261) with its index row; `context/check.rb` passes.
- NOW names the stretch-set proposal as the next operator decision.

## Out of scope

Computer use, product or description changes, aesthetic verdicts, work in
"Night Glass" or "ice jungle", parallel sessions, and the gate close-out
(it follows the stretch set and its review).
