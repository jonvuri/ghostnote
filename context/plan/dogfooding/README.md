---
title: Open dogfooding loop
kind: plan
state: active
updated: 2026-08-23
parent: ../ROADMAP.md
---

# Open dogfooding loop

This loop owns the work between Phase 5 and the first Phase 6 backlog item. It
stays open until the operator explicitly closes it. Real musical work chooses
the next task. Phase 6a remains next after this loop closes.

## Environment

- Use Codex in the ChatGPT desktop app. Start one projectless chat for each
  musical run.
- Use the global Codex MCP configuration documented in the repository
  [README](../../../README.md#connect-codex). Start a new chat after a server,
  tool schema, or tool description change.
- Keep one Ghostnote chat active at a time. Each chat owns one MCP server and
  one bridge connection.
- Give the musical chat no repository access. Tell it not to use shell commands,
  tests, or probes. The chat must use only the public Ghostnote tools.
- Preserve accepted material. Make subjective work auditionable when practical.
  Wait for an explicit accept or veto. Reverse rejected work only when the
  recorded pre-state makes reversal safe.

## Bootstrap history

Session `01a0303d-ee7f-7d53-b691-9ae3caae375a` tested the first Codex setup.
Its MCP entry passed `tsx src/mcp-server.ts` as one argument to `npx`, so
Ghostnote did not register. The agent then discovered and drove the server with
manual shell JSON-RPC. That fallback inherited the shell network sandbox and
needed permission to reach `127.0.0.1:8686`.

The configuration in the repository [README](../../../README.md#connect-codex)
fixed native registration. Do not grant broad network permission for this old
failure. If native tools are absent, check the argument array and restart Codex.
The global file is shared by Codex desktop, CLI, and IDE clients. Chat and Work
do not read it.

## Iteration loop

1. Start a new musical chat with one concrete musical goal and the safety rules
   above.
2. Audition the result. Record the chat session ID, accept or veto, project
   state, writes, refusals, and unexpected behavior.
3. Start an engineering session in this repository. Read `context/NOW.md`, this
   file, and the latest run record.
4. Locate the full transcript by session ID. Treat it as the primary artifact.
   Separate host exposure, agent behavior, tool description or schema, brain,
   extension, Bitwig API, and musical-result defects.
5. Reproduce the smallest safe case. Do not change code or descriptions until
   the failing boundary is known.
6. Implement and verify the complete fix. Use offline tests first. Run a focused
   live check when the defect crosses the Bitwig boundary. Leave the project at
   its documented baseline.
7. Start a new musical chat and retry the real workflow. Do not treat a probe as
   a substitute for this retry.
8. Add a run record and update `context/NOW.md`. Promote a durable measurement to
   evidence or a decision only after it is proved.

## Transcript lookup

Codex desktop transcripts are stored under `~/.codex/sessions`. Find a root
transcript from its session ID:

```sh
rg -l --hidden '"id":"SESSION_ID"' ~/.codex/sessions
```

Read the `session_meta` entry first. Use a transcript whose `thread_source` is
`user` and whose `originator` is `Codex Desktop`. Do not confuse it with a
guardian or other subagent transcript. Extract user and assistant messages,
tool calls, tool results, permission requests, and the final state. Keep the
original JSONL as the authoritative record.

## Run records

- [Run ledger](runs.md) — session IDs, transcripts, agent builds, models, public
  surfaces, Bitwig baselines, and provenance.
- [D01 — native Codex lo-fi jungle attempt](d01-native-codex-lofi-jungle.md) —
  native MCP startup passed; both focused defects are fixed.
- [D02 — Drum Machine and surface hardening](d02-drum-machine-and-surface-hardening.md)
  — complete. Public pad composition, parameter integrity, exact clip colors,
  and partial observation verdicts are proved.

Add each new root musical or exposure session to the run ledger. Mark whether a
version was observed in that transcript, derived from the source timeline, or
taken from an adjacent live baseline. Do not present a baseline as a
session-observed value.

## Close condition

Only an explicit operator request closes this loop. At closeout, summarize the
accepted musical results, remaining defects, verified configuration, and the
next Phase 6 item. Then restore `context/NOW.md` to the selected Phase 6 work.
