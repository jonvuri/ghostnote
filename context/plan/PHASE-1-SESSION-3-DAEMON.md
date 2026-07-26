---
title: Phase 1, session 3 — ghostnoted: the daemon, observers, and concurrency
status: not started
updated: 2026-07-25
parent: PHASE-1-ENGINE.md
prev: PHASE-1-SESSION-2-TAKES.md
next: PHASE-1-SESSION-4-CONTROL-LAYER.md
scope: PHASE-1-ENGINE.md item 1
evidence: E1, E3, E8, E9, E15-A · D4, D6, D10, D12
---

# Phase 1, session 3 — `ghostnoted`

> **Purpose.** Turn sessions 1 and 2 from libraries into a **process**: the single
> owner of the bridge connection, the adapter, the take store and the change log.
> This is also the only place Bitwig **observers** can live — which is what makes
> the change log trustworthy while the user is editing concurrently (§8d), and
> what finally closes the `sceneEpoch` blind spot Phase 0 shipped knowingly.

## Why this is third

D4 settled the topology, and its reasoning is about *lifetime and privilege*: an
MCP stdio server is a subprocess of the chat client, so in-memory checkpoints die
with the session, and **every channel into that process is a channel the agent can
also use** — leaving revert-as-a-human-verb nowhere to live. The daemon exists to
give the store a lifetime longer than a conversation and a privilege boundary the
agent is on the wrong side of.

It comes after the engine and the store because it *hosts* them. A daemon built
first would have nothing to serve and would acquire lifecycle bugs before anything
it manages had correctness ones.

## Scope

### In

1. **The process.** `ghostnoted`, spawn-on-demand from its first client (the
   expected lifecycle per PHASE-1 §Scope 1). One bridge connection, one adapter,
   one engine, one store.
2. **⚠ Single-instance enforcement.** Two daemons racing for one bridge socket is
   the failure mode PHASE-1 §Risks calls "the classic time sink." A second
   instance must refuse to start, loudly.
3. **The local API.** Loopback only. Minimal for Phase 1 — enough for the MCP
   client to write and for session 4's control layer to be driven — but designed
   as **the API Phase 3's web view will consume**, because it is, and retrofitting
   is what §3's reorderable-seam note is trying to avoid.
4. **The MCP server as a client.** `brain/src/mcp-server.ts` already exists as an
   E9 skeleton and the SDK "sits cleanly on `client.ts` with no surprises." It
   stops owning an adapter and starts calling the daemon.
5. **⚠ Observers — the capability that justifies the process.** Three jobs:
   - **Scene ops.** `LiveAdapter.sceneEpoch` counts only *our own* scene ops
     ([adapter.ts:72](../../brain/src/adapters/live/adapter.ts#L72)); a scene the
     **user** creates or deletes does not move it, so a stale scene-relative
     address still resolves as `found` while E3's compaction has already shifted
     every row beneath it. That is precisely the silent mis-write the epoch exists
     to prevent. Phase 0 documented it at the field, in `address.ts`, and in
     `PHASE-0-SESSION-2.md` item 5 as a **P1 dependency, not an oversight**. This
     session closes it.
   - **User edits inside the write-set** — the stale-take problem. The revision
     guard catches *ordering*; a take whose stash no longer describes the clip is
     a different failure.
   - **The change log's "what the user did"** side, which Phase 3 renders.
6. **All writes through the daemon** (standing rule 7 / D10). The revision counter
   guards ordering across processes but **cannot detect omission** — a bypassing
   write leaves a silent gap in the take log. Make the bypass structurally
   awkward, not merely discouraged.
7. **Lifecycle.** Bitwig restart, project change, bridge disconnect and reconnect,
   stale sockets, orphaned processes.

### Out

- The in-Bitwig panel — session 4. This session may poll a `ui.state` method, but
  builds no UI.
- Push notifications from extension to daemon — session 6 (optional). Polling is
  the Phase-1 answer; see Decisions.
- Authentication. D12 is explicit: **the socket is unauthenticated**, the gate is
  the daemon, and the socket is the soft underbelly. Firewall it; do not mistake
  policy for a boundary. Nothing in this session should imply otherwise.
- The web view — Phase 3.

## Decisions this session must make

- **Daemon lifecycle: spawn-on-demand vs. login agent.** PHASE-1 names
  spawn-on-demand as expected. *Recommendation: keep it* — a login agent is a
  packaging problem and a debugging tax for a personal tool.
- **⚠ What happens to in-flight state when Bitwig restarts or the project
  changes.** The sharpest question in the session. The take store is project-keyed
  (session 2), so a project change is a store switch — but an in-flight batch, a
  pinned cursor pool and a revision counter all belong to a Bitwig that just went
  away. *Recommendation: treat bridge disconnect as fatal to session state and
  cheap to rebuild* (re-`hello`, re-resolve, re-pin) rather than trying to
  reconcile — D6 already forbids trusting any held index across a structural op,
  and a restart is the largest structural op there is.
- **How the daemon learns a human pressed a button.** The Bridge is
  request/response only; a `Signal` fires *inside the extension*. *Recommendation:
  the daemon polls a `ui.state` method at a modest interval.* It needs nothing new,
  and a revert button is a rare deliberate act where 100ms of latency is invisible.
  Session 6 generalizes this into a push, which is the same machinery as deferred
  batch responses — worth knowing, not worth waiting for.
- **What the local API's shape is** — the decision Phase 3 inherits. HTTP +
  WebSocket on loopback is what PHASE-3 §Scope 1 assumes.
- **Detection vs. resolution for stale takes.** PHASE-1 is explicit: *"Detection
  matters more than resolution here — surface it, don't guess."* Decide what
  "surface it" concretely means before writing the detector.

## Exit criteria

1. The daemon spawns on demand, holds **one** bridge connection, and a second
   instance refuses to start.
2. Two clients (the MCP server and a test client) operate through one daemon
   without interfering, and the revision guard arbitrates between them.
3. **A scene created or deleted by the user in Bitwig bumps the epoch** and a
   pre-existing scene-relative address is then refused rather than silently
   resolved — closing `PHASE-0-SESSION-2.md` item 5's first bullet.
4. A user edit inside a take's write-set is **detected and surfaced**, with the
   take marked stale rather than silently reverted over.
5. A bridge disconnect and reconnect leaves the daemon working, with pool cursors
   re-pinned and no stale indices in use.
6. The MCP client can write only through the daemon, and the take log has no
   agent-reachable mutation path (session 2's split API, now across a process
   boundary).

## Risks

- **⚠ Daemon lifecycle bugs are the classic time sink** (PHASE-1 §Risks) — stale
  sockets, orphaned processes, two daemons racing. Mitigation, per that doc: the
  extension's revision counter is **already** the cross-process arbiter of
  ordering (E8, thread-confined to the control-surface thread and therefore atomic
  for free). Lean on it rather than inventing daemon-side locking.
- **Observers are a new failure surface at `init()`.** Standing rule 9 / D11:
  check `@Deprecated` before wiring any handle there, because some deprecations
  throw and take the whole extension down (E7-Finding-0). And D7's amended rule —
  **anything Bitwig hands out is init-only until proven otherwise**, now on four
  independent subsystems. `npm run probe:hello` after every deploy.
- **The local API grows into Phase 3's UI backend by accident.** Mitigation:
  PHASE-3 §Scope 1 already says it must be designed as an API a second client
  would use. Keep Phase 1's surface small and honest rather than convenient.
- **Observer volume.** E5 measured scale on *empty* tracks; device-side scale is
  explicitly unmeasured (`PROJECT_PLAN.md` §7 → P4). Scene and clip observers are
  a different population from device banks, but this is the session that would
  first notice, so watch the control-surface tick.
