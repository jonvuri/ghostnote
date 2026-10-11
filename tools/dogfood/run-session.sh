#!/bin/sh
# Run one fresh agent session for an automated dogfood task (8i12).
#
#   tools/dogfood/run-session.sh <codex|claude> <task-file> <out-dir> [--no-ghostnote-line]
#
# The task file holds the prompt only. The runner adds the line "Use Ghostnote.".
# With --no-ghostnote-line it does not: the agent must find Ghostnote from the task (8i13, S5).
# The client runs in a new empty directory in /tmp, with the Ghostnote MCP server
# of this tree and no computer use. The runner writes these files to <out-dir>:
#
#   prompt.txt      the complete prompt
#   events.jsonl    the client event stream
#   stderr.txt      the client stderr
#   last.txt        the last agent message
#   session.jsonl   the client session file: the complete transcript
#   workdir.txt     the files that the session left in its directory
#   meta.json       client, version, times, exit code, session ID
#
# The runner deletes the /tmp directory. Run one session at a time.
set -u

if [ $# -lt 3 ] || [ $# -gt 4 ] || { [ $# -eq 4 ] && [ "$4" != "--no-ghostnote-line" ]; }; then
  echo "usage: $0 <codex|claude> <task-file> <out-dir> [--no-ghostnote-line]" >&2
  exit 2
fi
SESSION_FILE=
CLIENT=$1
TASK=$2
OUT=$3
REPO=$(cd "$(dirname "$0")/../.." && pwd)
[ -f "$TASK" ] || { echo "no task file: $TASK" >&2; exit 2; }
mkdir -p "$OUT"
OUT=$(cd "$OUT" && pwd)
[ ! -e "$OUT/events.jsonl" ] || { echo "$OUT has a run already" >&2; exit 2; }

PROMPT="$(cat "$TASK")"
[ $# -eq 4 ] || PROMPT="$PROMPT
Use Ghostnote."
printf '%s\n' "$PROMPT" > "$OUT/prompt.txt"
WORK=$(mktemp -d /tmp/gn-dogfood.XXXXXX)
START=$(date -u +%Y-%m-%dT%H:%M:%SZ)
START_S=$(date +%s)

case "$CLIENT" in
  codex)
    VERSION=$(codex --version)
    # The Ghostnote server and the tool approvals come from ~/.codex/config.toml.
    (cd "$WORK" && codex exec --json --skip-git-repo-check --approve-for-me \
      -o "$OUT/last.txt" "$PROMPT" < /dev/null > "$OUT/events.jsonl" 2> "$OUT/stderr.txt")
    CODE=$?
    SESSION=$(jq -r 'select(.type == "thread.started") | .thread_id' "$OUT/events.jsonl" | head -1)
    # The event stream has no script (`exec`) call; the rollout file has each call.
    SESSION_FILE=$(find "$HOME/.codex/sessions" -name "rollout-*-$SESSION.jsonl" | head -1)
    ;;
  claude)
    VERSION=$(claude --version)
    MCP="$WORK.mcp.json"
    # Claude Code ignores a `cwd` field, so the command changes to brain/ itself.
    jq -n --arg start "cd '$REPO/brain' && exec node --import tsx src/mcp-server.ts" \
      '{mcpServers: {ghostnote: {command: "sh", args: ["-c", $start]}}}' > "$MCP"
    # No CLAUDE* variable of a driving Claude session reaches the new session.
    (cd "$WORK" && env -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT -u CLAUDE_CODE_SSE_PORT \
      claude -p "$PROMPT" --permission-mode auto \
      --mcp-config "$MCP" --strict-mcp-config \
      --output-format stream-json --verbose < /dev/null > "$OUT/events.jsonl" 2> "$OUT/stderr.txt")
    CODE=$?
    rm -f "$MCP"
    jq -r 'select(.type == "result") | .result // empty' "$OUT/events.jsonl" > "$OUT/last.txt"
    SESSION=$(jq -r 'select(.type == "system" and .subtype == "init") | .session_id' "$OUT/events.jsonl" | head -1)
    # The session file has the time of each row and the loaded instruction files.
    SESSION_FILE=$(find "$HOME/.claude/projects" -name "$SESSION.jsonl" | head -1)
    ;;
  *)
    echo "unknown client: $CLIENT" >&2
    rmdir "$WORK"
    exit 2
    ;;
esac

[ -n "$SESSION" ] && [ -f "$SESSION_FILE" ] && cp "$SESSION_FILE" "$OUT/session.jsonl"
END=$(date -u +%Y-%m-%dT%H:%M:%SZ)
SECONDS_RUN=$(( $(date +%s) - START_S ))
(cd "$WORK" && find . -mindepth 1 | sort) > "$OUT/workdir.txt"
rm -rf "$WORK"
jq -n --arg client "$CLIENT" --arg version "$VERSION" --arg task "$TASK" --arg workdir "$WORK" \
  --arg start "$START" --arg end "$END" --arg session "$SESSION" --arg sessionFile "${SESSION_FILE:-}" \
  --argjson seconds "$SECONDS_RUN" --argjson exitCode "$CODE" \
  '{client: $client, version: $version, task: $task, workdir: $workdir, start: $start, end: $end,
    seconds: $seconds, exitCode: $exitCode, session: $session, sessionFile: $sessionFile}' > "$OUT/meta.json"
cat "$OUT/meta.json"
exit "$CODE"
