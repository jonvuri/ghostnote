---
id: E9
kind: evidence
state: active
source: FINDINGS.md
---

# E9 — MCP smoke test: the SDK sits cleanly on client.ts (2026-07-20)

**Verdict: ● no surprises — it just works.** A minimal MCP server exposing two
tools (`ping`, `read_notes`) backed by `client.ts` speaks MCP over stdio and is
driven end-to-end by an MCP client, with **zero bridge-side changes**. Probe
`e09-mcp` (all green). Pure Phase-1 wiring de-risk; nothing architectural. This
is the last spike experiment — every SPIKE_PLAN §4 row is now done.

### What was wired

- **`brain/src/mcp-server.ts`** — `@modelcontextprotocol/sdk` v1.29 `McpServer`
  over `StdioServerTransport`, two tools registered via `registerTool`
  (zod-typed input schemas). Both tool handlers call straight into the existing
  `BridgeClient` / `lib.ts` helpers (`client.request('ping')`, `point` +
  `getNotes`) — the MCP layer is a thin shell over `client.ts`, no new bridge
  protocol.
- **Probe `e09-mcp`** — an MCP *client* (`Client` + `StdioClientTransport`, the
  same transport Claude Code uses) spawns the server as a subprocess, lists
  tools, and calls both. Results:
  - `tools/list` → `[ping, read_notes]` (discovery works).
  - `ping` → `{pong:true, thread:"Control Surface Session"}` (round-trips the
    bridge through the MCP layer).
  - `read_notes(trackA, 0)` → `[[0,60,100,1]]` (the gn-A slot-0 fingerprint,
    read via `point`+`getNotes` through `client.ts`).

### Notes for the build

- **stdout is the MCP transport** — the server must never `console.log`
  (diagnostics to stderr only). The one operational gotcha; trivially avoided.
- The MCP server runs as its **own process with its own bridge connection**;
  the `Bridge`'s multi-client accept (E0) handles it alongside probe clients
  with no contention. Two TCP clients on `:8686` coexist fine.
- **Carry-forward:** `mcp-server.ts` is a Phase-1 skeleton — the tool set grows,
  but the shape (MCP tool → `client.ts` call → JSON-in-text result) is settled.
  `client.ts` needs nothing added to sit under MCP.

### Decision impact → DECISIONS / PROJECT_PLAN

- **The MCP layer sits cleanly on `client.ts`** — Phase 1's transport stack
  (MCP SDK ↔ `client.ts` ↔ TCP bridge ↔ extension) is de-risked end to end. No
  architectural work; the remaining effort is defining the real tool surface
  (the contract), not plumbing.
- **`@modelcontextprotocol/sdk` + `zod`** are the confirmed Phase-1 deps for the
  brain's MCP front end.

---
