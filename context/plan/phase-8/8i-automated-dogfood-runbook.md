---
title: 8i automated dogfood runbook
kind: reference
state: active
updated: 2026-10-11
parent: 8i-agent-native-hybrid-dogfood.md
---

# 8i automated dogfood runbook

This runbook is the loop that worked in 8i12
([E261](../../evidence/experiments/e261-automated-dogfood-process-proof.md)).
A driving agent runs fresh agent sessions on mechanical tasks in the owned
project `gn-scale-test`, checks each transcript and the project state, and
logs issues. It does not use computer use, and it does not change product
code or tool descriptions.

Run each command from the repository root unless the step says `brain/`.
Run one session at a time. In zsh, write each command out; a variable does
not split into words.

## 1. Entry checks (once)

1. Ask the operator to open Bitwig with `gn-scale-test`. Wait for the
   answer; a project that still loads gives a wrong track list.
2. `pgrep -f phase8` must print nothing.
3. In `brain/`: `npm run probe:hello`. Require ALL PASS and the build
   markers of `context/NOW.md`.
4. In `brain/`: `node --import tsx src/probes/phase8i7-mixer.ts trial-state
   all > <run-dir>/state-entry.jsonl`. The last row must have `"project":
   "gn-scale-test"`. Keep the file: it is the baseline for the final
   comparison.
5. Record `codex --version`, `claude --version`, and
   `TOOL_DESCRIPTION_VERSION` (`brain/src/surface/description-cohort.ts`).
   The models are in the first `source` rows of each extract.

`<run-dir>` is a directory in `/tmp`, for example `/tmp/gn-8i13`.

## 2. Task file

A task file is plain text in `tools/dogfood/tasks/<id>-<name>.txt`. It
holds the prompt only, as an operator would write it: no tool name, no
sequence, no repository path. The runner adds the line "Use Ghostnote.";
with `--no-ghostnote-line` as the fourth argument it does not (S5 of 8i13).
Each task also has, in its plan: the setup command, the check, the
baseline (when one exists), and the cleanup command.

## 3. One run

For each task and each client (`codex`, then `claude`):

1. Setup. Run the task's setup command in `brain/`. For P1:
   `node --import tsx src/probes/phase8i7-mixer.ts trial-setup`.
2. State before: `... trial-state all > <run-dir>/<task>-<client>-before.jsonl`
   (or the state command of the task).
3. Session:
   `tools/dogfood/run-session.sh <client> tools/dogfood/tasks/<file> <run-dir>/<task>-<client>`.
   The out directory must be new. Give the command a timeout of at least
   10 minutes. The runner prints `meta.json` and returns the client exit
   code.
4. State after: the same state command, to `...-after.jsonl`. This is the
   independent read; do not take the state from the transcript.
5. Extract:
   `node tools/dogfood/extract.mjs <client> <out-dir>/session.jsonl > <out-dir>/extract.jsonl`.
6. Evaluate (section 5).
7. Cleanup. Run the task's cleanup command (P1: `trial-cleanup`), then the
   state command again. It must equal `state-entry.jsonl` (`diff` prints
   nothing). Do not start the next run before it does. After a clip
   write, `selection.status` keeps the last slot of a deleted track
   (issue D11): compare without `slotTrackIndex` and `slotIndex`
   (`jq -c 'del(.slotTrackIndex, .slotIndex)'` on each file).

The 8i13 tasks S1 to S4 use `node --import tsx
src/probes/phase8i13-stretch.ts <task> setup|state|cleanup`. Its `state`
is the state command of the task; the comparison with `state-entry.jsonl`
uses `phase8i7-mixer.ts trial-state all`.

### What the runner does

```sh
# Codex: automatic review; the server comes from ~/.codex/config.toml
cd /tmp/gn-dogfood.XXXXXX && codex exec --json --skip-git-repo-check \
  --approve-for-me -o <out>/last.txt "$PROMPT" < /dev/null > <out>/events.jsonl

# Claude Code: automatic permission mode, Ghostnote server only
cd /tmp/gn-dogfood.XXXXXX && claude -p "$PROMPT" --permission-mode auto \
  --mcp-config <file> --strict-mcp-config \
  --output-format stream-json --verbose < /dev/null > <out>/events.jsonl
```

The Claude MCP file starts the server with `sh -c "cd <repo>/brain && exec
node --import tsx src/mcp-server.ts"`. Claude Code does not start the
server from a `cwd` field. The runner removes the `CLAUDECODE` variables of
a driving Claude session. Each run starts a new server from the brain
source, so claims do not cross sessions and a changed description needs no
deploy.

The runner writes `prompt.txt`, `events.jsonl`, `stderr.txt`, `last.txt`,
`session.jsonl`, `workdir.txt`, and `meta.json`, and deletes the `/tmp`
directory.

## 4. Approvals and transcripts

- Codex: `--approve-for-me` approved a Ghostnote write tool that has no
  entry in `~/.codex/config.toml` (E261). No `-c
  mcp_servers.ghostnote.tools.<tool>.approval_mode` entry is needed. When
  a write call is refused as "not approved", log it and pass that entry for
  the tool.
- Claude: `--permission-mode auto` approved the Ghostnote calls. The
  `result` row of the event stream lists `permission_denials`.
- The complete transcript is `session.jsonl`, the copy of the client
  session file: `~/.codex/sessions/<date>/rollout-*-<thread id>.jsonl` or
  `~/.claude/projects/-private-tmp-gn-dogfood-<suffix>/<session id>.jsonl`.
  The Codex event stream has no script call, so do not count calls from
  it.
- The Codex rollout log cuts a tool result over about 24,000 characters.
  The extract cuts at 2,000 characters and gives the full length in `cut`;
  pass a larger third argument to `extract.mjs` when a result matters.
- The sessions load the client's global instruction file only ("Stay
  concise and to the point."). Check the `instructions` row of each
  extract.
- Computer use is not enabled. The Codex computer-use plug-in (`cua_repl`)
  stays available to the agent; a call to it is a detour. A `getState`
  call returns the list of the applications on the operator's computer
  (issue D10): remove that list from the evidence copy.

## 5. Evaluation checklist

Write one verdict for each run in the E record:

- **Goal**: met, partly met, or not met, from the state files and the
  task's check. Compare before and after for each object that the task
  must not change.
- **Report**: `last.txt` agrees with the state. Name each claim that the
  state does not support.
- **Route**: from `extract.jsonl`, count the `ghostnote` rows, the `tool`
  and `script` rows, the rows with a status other than `completed` or a
  `failure` in the result (refusals), the retries, and the repeat reads.
  Give the runner wall time and the time from the first to the last
  session row. Name each detour with its `line`: a computer-use attempt, a
  shell or file action (`workdir.txt` must be empty), a help or reference
  request that the task did not need, or a call that repeats a result the
  agent had. The client's tool discovery (a Codex tool-listing script, a
  Claude `ToolSearch`) is not a detour; count it. Compare with the task
  baseline.
- **Residue**: none after cleanup.

State a cause as an inference when the transcript has no reasoning text.

## 6. Issue log and evidence

- Add each issue that a verdict names to the
  [issue log](8i-dogfood-issues.md), with the next free `D` number of that
  log. Leave the decision column empty.
- Copy `extract.jsonl`, `events.jsonl`, `meta.json`, `last.txt`,
  `prompt.txt`, and the state files to
  `context/evidence/data/<session>/<task>-<client>/`. In a Claude
  `events.jsonl`, keep only the session, model, permission, directory,
  server, and tool fields of the `init` row. Do not copy `session.jsonl`
  (it holds the client's system text).
- After the copy, delete `<run-dir>`. `/tmp` must hold no needed artifact.

## 7. Exit checks

- `trial-state all` equals `state-entry.jsonl` (the slot fields apart,
  issue D11).
- `ls /tmp | grep gn-dogfood` prints nothing.
- The operator stops the transport when a task launched a clip.
