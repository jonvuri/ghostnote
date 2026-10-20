---
title: 8i automated dogfood runbook
kind: reference
state: active
updated: 2026-10-19
parent: 8i-agent-native-hybrid-dogfood.md
---

# 8i automated dogfood runbook

This reusable runbook comes from 8i12 and 8i13 ([E261](../../evidence/experiments/e261-automated-dogfood-process-proof.md),
[E262](../../evidence/experiments/e262-automated-dogfood-stretch-set.md)).
The [dogfood archive](../../archive/outcomes/PHASE-8-DOGFOOD.md) holds their
results. A selected new session defines its task, clients, fixture, allowed
interfaces, and acceptance checks. Use fresh clients and check the resulting
state independently. A trial records defects; its scope does not include
product fixes unless the selected session includes them.

The commands below are the retained Phase 8 recipes for `gn-scale-test`.
They do not establish that project's current state or authorize a deployment.
Read the selected driver's build and fixture requirements before reuse. The
normal 8i15 build is recorded in [E272](../../evidence/experiments/e272-8i-gate-close-out.md);
[NOW](../../NOW.md) identifies the current deployment. If they differ, use the
selected session's deployment or driver plan before running the recipe.

Run each command from the repository root unless the step says `brain/`.
Run one session at a time. In zsh, write each command out; a variable does
not split into words.

## 1. Entry checks (once)

1. Confirm the operator's chosen project, target, and selection. When a
   project must be opened, wait for loading to finish and read its name.
   A successful hello alone can report tracks from the prior project (E261).
2. Check current probe drivers and Ghostnote clients for competing live work.
   Use process names for this session, not a fixed `phase8` search. Run one
   foreground driver chain and one live writer at a time. See [AGENTS.md](../../../AGENTS.md#live-work).
3. In `brain/`: `npm run probe:hello`. Require ALL PASS and the profile,
   method hash/count, and markers expected by the selected driver. Controller
   replacement, when needed, follows AGENTS.md.
4. Capture the relevant fixture and preserved state before setup. For the
   old fixture, run `node --import tsx src/probes/phase8i7-mixer.ts trial-state
   all > <run-dir>/state-entry.jsonl` in `brain/`; its project must be
   `gn-scale-test`. Keep this state for the final comparison.
5. Record the versions of the clients used and `TOOL_DESCRIPTION_VERSION`
   (`brain/src/surface/description-cohort.ts`). The models are in the first
   `source` rows of each extract.

`<run-dir>` is a directory in `/tmp`, for example `/tmp/gn-8i13`.

## 2. Task file

A task file is plain text in `tools/dogfood/tasks/<id>-<name>.txt`. It
holds the prompt only, as an operator would write it: no tool name, no
sequence, no repository path. The runner adds the line "Use Ghostnote.";
with `--no-ghostnote-line` as the fourth argument it does not (S5 of 8i13).
For a hybrid trial, put "Use Ghostnote and computer use as you see fit."
at the end of the task file and pass `--no-ghostnote-line`. Keep a discovery
trial's prompt unchanged when tool discovery is its question. Each selected
task states its setup, result check, relevant preserved state, and cleanup.

## 3. One run

For each selected task and client (the Phase 8 order was Codex, then Claude):

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
7. Cleanup. Remove the owned fixture (P1: `trial-cleanup`) and compare the
   relevant preserved state with the entry state. Investigate a difference
   before another run. For the old `trial-state all` comparison, omit only
   `slotTrackIndex` and `slotIndex`: `selection.status` can retain a deleted
   track's slot (8i issue D11). Use
   `jq -c 'del(.slotTrackIndex, .slotIndex)'` on each file. Do not omit content
   or mixer differences. Saved-file hashes are needed only for a persistence
   test or an explicit saved-file preservation requirement.

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
- Check the loaded instructions and available tools in each extract. The
  Phase 8 sessions loaded only the client's global instruction file. Do not
  assume a later client's environment is identical.
- Phase 8 mechanical tasks did not need computer use, but Codex could still
  discover `cua_repl`. Judge its use against the selected task's allowed
  interfaces. A `getState` result can list the operator's applications (8i
  issue D10); remove that list from the evidence copy.

## 5. Evaluation checklist

Write one verdict for each run in the E record:

- **Goal**: met, partly met, or not met, from the state files and the
  task's check. Compare before and after for each object that the task
  must not change.
- **Report**: `last.txt` agrees with the state. Name each claim that the
  state does not support.
- **Route**, when discovery, call count, or latency is part of the question:
  count calls from the full client session file, using `extract.jsonl` as the
  index. Report relevant refusals, retries, repeat reads, and detours with
  source lines. Separate runner wall time from active session time. Compare
  with a baseline only when the tasks and conditions match. Tool discovery
  counts as a call, but is not itself a detour. Other trials need only the
  transcript details that explain a result or defect.
- **Residue**: none after cleanup.

State a cause as an inference when the transcript has no reasoning text.

## 6. Issue log and evidence

- Record actionable defects and other limits in the selected session's
  record. The [8i issue log](8i-dogfood-issues.md) is closed history; do not
  append new issues there. Follow the repository's session-planning rule for
  follow-up work.
- Copy `extract.jsonl`, `events.jsonl`, `meta.json`, `last.txt`,
  `prompt.txt`, and the state files to
  `context/evidence/data/<session>/<task>-<client>/`. In a Claude
  `events.jsonl`, keep only the session, model, permission, directory,
  server, and tool fields of the `init` row. Do not copy `session.jsonl`
  (it holds the client's system text).
- After the copy, delete `<run-dir>`. `/tmp` must hold no needed artifact.

## 7. Exit checks

- Owned scratch objects are removed and relevant preserved state matches
  entry. The old fixture uses `trial-state all` with the D11 slot exception.
- This run's temporary work directory is removed and needed evidence is
  retained. Do not require all unrelated `gn-dogfood` directories to be absent.
- The operator stops the transport when a task launched a clip.
