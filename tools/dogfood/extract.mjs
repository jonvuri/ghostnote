#!/usr/bin/env node
// Make the transcript extract of one automated dogfood session (8i12), in the E259 row format.
//
//   node tools/dogfood/extract.mjs <codex|claude> <session-file> [limit] > extract.jsonl
//
// The session file is the complete transcript: the Codex rollout file
// (~/.codex/sessions/<date>/rollout-*-<id>.jsonl) or the Claude session file
// (~/.claude/projects/<directory>/<id>.jsonl). `run-session.sh` copies it to
// <out-dir>/session.jsonl. A result or an output over `limit` characters
// (default 2,000) is cut; the row then has `cut` with the full length.
//
// Row kinds: source, instructions, user, assistant, script, script-output,
// ghostnote, and tool (a call to a tool that is not Ghostnote).
import { readFileSync } from 'node:fs';

const [client, file, limitText] = process.argv.slice(2);
if (!['codex', 'claude'].includes(client) || !file) {
  console.error('usage: extract.mjs <codex|claude> <session-file> [limit]');
  process.exit(2);
}
const limit = Number(limitText ?? 2000);
const rows = readFileSync(file, 'utf8').split('\n').filter((line) => line !== '').map((line) => JSON.parse(line));
const say = (row) => console.log(JSON.stringify(row));
const cut = (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > limit ? { text: text.slice(0, limit), cut: text.length } : { text };
};
const textOf = (content) => typeof content === 'string' ? content
  : content.map((part) => part.text ?? '').join('');

say({ kind: 'source', client, file: file.replace(process.env.HOME, '~'),
  extract: `messages, script calls, and tool calls; a result over ${limit} characters is cut` });

if (client === 'codex') {
  rows.forEach((row, index) => {
    const line = index + 1;
    const at = row.timestamp;
    const item = row.payload;
    if (row.type === 'turn_context') {
      say({ line, at, kind: 'source', model: item.model, effort: item.effort, approvalPolicy: item.approval_policy,
        sandbox: item.sandbox_policy?.type ?? item.sandbox_policy, cwd: item.cwd });
    } else if (row.type === 'response_item' && item.type === 'message' && item.role !== 'developer') {
      const text = textOf(item.content);
      if (item.role === 'user' && text.startsWith('# AGENTS.md instructions')) say({ line, at, kind: 'instructions', ...cut(text) });
      else say({ line, at, kind: item.role, text });
    } else if (row.type === 'response_item' && item.type === 'custom_tool_call') {
      say({ line, at, kind: 'script', input: item.input });
    } else if (row.type === 'response_item' && item.type === 'custom_tool_call_output') {
      const { text, cut: length } = cut(item.output);
      say({ line, at, kind: 'script-output', output: text, ...(length ? { cut: length } : {}) });
    } else if (row.type === 'event_msg' && item.type === 'item_completed' && item.item.type === 'McpToolCall') {
      const call = item.item;
      const { text, cut: length } = cut(call.result ?? call.error);
      say({ line, at, kind: call.server === 'ghostnote' ? 'ghostnote' : 'tool', ...(call.server === 'ghostnote' ? {} : { server: call.server }),
        tool: call.tool, arguments: call.arguments, status: call.status,
        ms: Math.round(call.duration.secs * 1000 + call.duration.nanos / 1e6), result: text, ...(length ? { cut: length } : {}) });
    }
  });
} else {
  const results = new Map();
  rows.forEach((row) => {
    if (row.type !== 'user' || typeof row.message.content === 'string') return;
    for (const part of row.message.content) {
      if (part.type === 'tool_result') results.set(part.tool_use_id, { part, at: row.timestamp });
    }
  });
  rows.forEach((row, index) => {
    const line = index + 1;
    const at = row.timestamp;
    if (row.type === 'attachment' && row.attachment.type === 'instructions') {
      say({ line, at, kind: 'instructions', files: row.attachment.files.map((entry) => entry.path) });
    } else if (row.type === 'attachment' && row.attachment.type === 'model') {
      say({ line, at, kind: 'source', model: row.attachment.identity?.modelId ?? row.attachment.model, cwd: row.cwd, permissionMode: row.permissionMode });
    } else if (row.type === 'user' && typeof row.message.content === 'string') {
      say({ line, at, kind: 'user', text: row.message.content });
    } else if (row.type === 'assistant') {
      for (const part of row.message.content) {
        if (part.type === 'text') say({ line, at, kind: 'assistant', text: part.text });
        if (part.type !== 'tool_use') continue;
        const result = results.get(part.id);
        const { text, cut: length } = cut(result?.part.content ?? '');
        const ghostnote = part.name.startsWith('mcp__ghostnote__');
        say({ line, at, kind: ghostnote ? 'ghostnote' : 'tool', tool: part.name.replace('mcp__ghostnote__', ''), arguments: part.input,
          status: result === undefined ? 'no-result' : result.part.is_error ? 'failed' : 'completed',
          // The wall time from the call row to the result row; it includes the client overhead.
          ms: result === undefined ? null : Date.parse(result.at) - Date.parse(at), result: text, ...(length ? { cut: length } : {}) });
      }
    }
  });
}
