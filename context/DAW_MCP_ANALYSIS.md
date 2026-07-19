---
title: ghostnote — daw-mcp Critical Analysis & Reuse Recommendation
status: settled (recommendation made; spike may adjust details)
updated: 2026-07-18
---

# daw-mcp — Critical Analysis & Reuse Recommendation

> Companion to `INITIAL_PROMPT.md`. Analyzes the local clone at `./daw-mcp`
> (v0.8.4, MIT © 2025 Zdeněk Neuman / PX-Audio) and answers the §12 design
> question: **fork directly vs. clean-start using it as reference.**
>
> **Recommendation up front: clean-start. Do not fork.** Copy idioms and
> whole functions liberally (MIT permits it; keep attribution), but the
> repo's central architectural choice — selection-coupled clip addressing —
> is the exact anti-pattern ghostnote's posture forbids, and it is woven
> through every layer: extension, protocol, and TS server.

---

## 1. What it is (facts)

- **Size:** ~1.5k lines Java (Bitwig extension), ~2.9k lines TS (MCP server),
  plus a Python Ableton remote script we don't care about.
- **Architecture:** TS MCP server (stdio) ↔ newline-delimited JSON-RPC 2.0
  over local TCP (port 8181) ↔ thin Java `.bwextension`. **Identical to the
  architecture locked in `INITIAL_PROMPT.md` §2** — this is independent
  validation that the shape works end-to-end, including on the exact
  Phase-1 feature set (launcher clip note read/write).
- **Scope:** clip launcher only, MIDI notes only. No devices, no params,
  no sends, no browser, no tempo-set. Dual-DAW (Bitwig + Ableton) behind a
  unified tool surface.
- **Toolchain:** Java 11, `com.bitwig:extension-api:18` (Bitwig 5.x era),
  Gradle with a tidy `.bwextension` jar-packaging + `copyExtension` deploy
  task, Gson bundled. Installed Bitwig here is **6.0.6** — API version bump
  required (confirm current artifact on `maven.bitwig.com` at spike start).
- **Tests:** none automated. `tests/e2e-prompts.md` is a manual prompt
  script. No fake adapter, no contract. The §12 "build-early" item gets
  zero head start from this repo.

## 2. What it validates (keep as evidence, not code)

- TCP-in-extension works and survives real sessions; `ServerSocket` +
  thread pool + **`host.scheduleTask(..., 0)` to marshal every request onto
  the control-surface thread** is the load-bearing pattern
  ([MCPServer.java:91](daw-mcp/bitwig-extension/src/main/java/com/pxaudio/bitwigmcp/server/MCPServer.java#L91)).
- Pull-based note reading (`getStep()` scan filtered on `NoteOn`) is
  reliable and synchronous — they explicitly abandoned observer-push for
  reads. Confirms §5's idiom.
- The full `NoteStep` property surface (velocity, duration, gain, pan,
  pressure, timbre, transpose, chance+`setIsChanceEnabled`, mute) round-trips
  in practice. Confirms §5 "Exact" checkpoint-fidelity claim is plausible.
- `sceneBank.itemCount()` observer caching, flat track bank
  (`createTrackBank(..., true)`) for group-nested tracks, `markInterested`
  checklists — small hard-won idioms worth lifting wholesale.
- Their observer-timing comment ([ClipHandler.java:532-539](daw-mcp/bitwig-extension/src/main/java/com/pxaudio/bitwigmcp/handlers/ClipHandler.java#L532-L539)):
  observer callbacks cannot fire while a handler blocks the control-surface
  thread — so create-then-poll within one request is impossible. Directly
  shapes how ghostnote's batch executor must sequence structural ops
  (§8i `scheduleTask` pacing).

## 3. Where it conflicts with ghostnote (why not fork)

### 3a. Selection-coupled addressing — the disqualifier

Every note operation routes through a **single `cursorClip` that follows
the user's UI selection** ([BitwigMCPExtension.java:72](daw-mcp/bitwig-extension/src/main/java/com/pxaudio/bitwigmcp/BitwigMCPExtension.java#L72)).
"Explicit" addressing is implemented as: select the slot in the UI, then
**sleep 400ms** (`selectionDelayMs`) and hope the cursor settled before
writing. This is precisely the fragility `INITIAL_PROMPT.md` §8d
(address-don't-select) and open question #1 exist to eliminate: under
optimistic application the user is *expected* to be clicking around while
the agent writes, and any click mid-batch retargets the writes to the
wrong clip. Their own docs acknowledge the hack and defer the fix.
This assumption saturates the extension (`getClip()` everywhere), the
protocol ("if omitted, uses cursor selection"), and the TS helpers
(`clip-selection.ts`). Forking means excavating it from every layer.

### 3b. No verification, no batch semantics

Writes return `{"success": true}` blind — literally fire-and-forget, the
thing §8c says must be replaced by write-then-read-back, and what Beat Twin
called a release blocker. There are no revisions, no idempotent request
IDs, no write-set concept, no checkpoint anything. The entire §8 execution
model has no counterpart here. Also, TS-side "batch" tools are loops of
single JSON-RPC calls — one round-trip (+ scheduleTask hop) per note.
Fine for 16 steps; wrong shape for ghostnote's patch-sized batches.

### 3c. Global init-time grid quantization

`gridResolution` is fixed in config at init; beat positions are converted
to step indices by `Math.round(x / stepSize)` — silent quantization loss.
Conflicts with the §7 units convention (note starts in beats, relative to
clip). Bitwig's step grid is a real constraint, but the *design response*
(one global coarse grid) is theirs, not forced. Ghostnote should decide
grid handling deliberately (spike experiment E2).

### 3d. Baggage and gaps

- **Dual-DAW abstraction** (Ableton extension, `DAWClientManager`, `daw`
  params, feature-parity matrices) — pure weight for a Bitwig-only project.
- **No device/param layer at all** — the §6a differentiator gets zero head
  start; the hardest new code is new regardless.
- **Framing bug-in-waiting:** the Java side accumulates input until Gson
  parses ([MCPServer.java:80-99](daw-mcp/bitwig-extension/src/main/java/com/pxaudio/bitwigmcp/server/MCPServer.java#L80-L99));
  one malformed line poisons the buffer for the connection's lifetime.
  Ghostnote should do strict newline framing on both sides.
- Old API level (18 vs Bitwig 6), Java 11, `dist/` committed, version
  sourced from `package.json` — all trivia, but all friction in a fork.

## 4. Reuse inventory

| Disposition | Item | Where |
|---|---|---|
| **Copy near-verbatim** | Gradle `.bwextension` packaging + `copyExtension` deploy task (bump API + Java) | `bitwig-extension/build.gradle` |
| **Copy near-verbatim** | TCP server + `scheduleTask` thread-marshaling skeleton (fix framing) | `server/MCPServer.java` |
| **Copy near-verbatim** | `NoteStep` idioms: `noteStepToJson`, pull-based `getStep` scan, property setters incl. `chance`+`setIsChanceEnabled`, `moveStep`, `clearSteps` | `handlers/ClipHandler.java` |
| **Copy near-verbatim** | `markInterested` checklists; flat `createTrackBank(..., true)`; `sceneBank.itemCount()` observer; `findEmptySlots` | `BitwigMCPExtension.java`, `ClipHandler.java` |
| **Copy near-verbatim** | TS TCP client: newline framing, pending-request map keyed by id, per-request timeout | `mcp-server/src/daw-client.ts` (strip the manager) |
| **Copy near-verbatim** | Shared JSON config file convention (platform paths, defaults-on-missing) | `config/ConfigReader.java`, `src/config.ts` |
| **Adapt** | JSON-RPC 2.0 `category.action` method scheme + error-code mapping — fine as transport frame; ghostnote's methods will be batch/patch-level, not per-note | `PROTOCOL.md`, `CommandDispatcher.java` |
| **Adapt** | Lean wire format `[x, y, vel, dur]` (~10-15× token savings) — good instinct, applies to ghostnote's patch schema instead | `CLAUDE.md` |
| **Reject** | Cursor-clip selection addressing, `selectionDelayMs`, `clip.getSelection` flow | everywhere |
| **Reject** | Dual-DAW abstraction, Ableton code, `daw` params | `ableton-extension/`, `DAWClientManager` |
| **Reject** | Tool-per-operation MCP surface (~20 tools) — ghostnote is patch-first ("the patch is the interface") | `src/tools/definitions.ts` |
| **Reject** | Blind `{"success": true}` responses; no-readback posture | all handlers |
| **Reject** | Global `gridResolution` design (decide our own in spike E2) | config + `ClipHandler` |

**Net expectation:** roughly 40–50% of ghostnote's Phase-1 *Java* lines can
start life as edited daw-mcp code; maybe 15% of the TS (client + config).
The architecture needs zero invention — it's validated. Everything that
makes ghostnote *ghostnote* (pinned addressing, write-set checkpoints,
readback verification, patch surface, device params) is new code.

## 5. Verdict

**Clean-start in a fresh repo; keep `./daw-mcp` checked out as a reference
quarry (untracked).** This matches the "steal ideas and implementation
pieces liberally, customize architecture and interfaces" instinct exactly.
Forking would mean paying excavation cost on the addressing model, the
protocol, and the tool surface simultaneously — the three places ghostnote
most needs to be different — to save ~700 lines of copyable Java.

License hygiene: MIT — retain a copyright/attribution notice (e.g. a
`NOTICE` or README credit: "portions derived from daw-mcp © 2025 Zdeněk
Neuman / PX-Audio, MIT") for any lifted code.
