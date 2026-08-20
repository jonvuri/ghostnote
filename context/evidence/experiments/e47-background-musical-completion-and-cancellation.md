---
id: E47
kind: evidence
state: active
source: phase-2-session-2x
---

# E47 — Background musical completion and cancellation pass live [K] (2026-08-19)

**Verdict: long musical work now has an immediate operation id, explicit
terminal status, and cooperative cancellation at the MCP boundary. Offline tests
prove both sides of the first project write. An ordinary-MCP live probe confirms
completion, cancellation, exact readback, and clean teardown.**

## Scope correction

The old session brief proposed a deferred Bridge response and expression-stage
coalescing. Current measurements do not support that route:

- E45 measured 15.482 seconds for one source read and about 32 seconds for six
  final reads. The complete corrected request took more than two minutes.
- E44 measured expression waits as a small part of the same workload.
- Production `LiveAdapter.apply()` already waits for every stage to complete.
  The Bridge `delayMs` acceptance-only path is not the production path.

The observed timeout crosses the MCP client-to-brain boundary. Session 2x puts
completion and cancellation there and leaves the extension wire unchanged.

## Delivered behavior

- `start_clip_music_operation` accepts generation or transformation patch v1 and
  returns an operation id before work starts.
- `inspect_clip_music_operation` reports `accepted`, `running`, `cancelling`,
  `completed`, `cancelled`, or `failed`. Only the last three are terminal.
- A completed operation returns the complete result of the existing direct tool.
- `cancel_clip_music_operation` requests a cooperative stop. It is idempotent for
  a terminal operation.
- MCP request cancellation also stops direct tools at the next workspace
  boundary.
- `ghostnote-description-v3` freezes the new public names, schemas, and wording.

The operation registry belongs to one workspace session. It catches every task
rejection. No background rejection can become an unhandled process rejection.

## Cancellation boundary

Cancellation before the first write becomes terminal with zero changes and zero
notes. Cancellation after a project write starts remains `cancelling` while the
executor completes the write, independent readback, and session recording. The
terminal result then lists that applied change. No later project mutation remains
after terminal status.

This rule does not claim instant cancellation. One current workspace call can
finish first. It makes the wait explicit and prevents recovery from racing it.

## Preserved behavior

The direct musical tools remain available. The Bridge, handler registry,
revision counter, `planStages`, fake adapter, and wire golden did not change.
E15-F still prevents unsafe property-stage coalescing. Thread confinement stays
structural because no new extension callback or thread exists.

The expression optimization is ○ for this session. It does not address the
measured latency bound, and its E15-F safety cost remains.

## Verification

- Focused completion, cancellation, surface, and description tests: 75/75 pass.
  The write-boundary test pauses after the adapter mutation becomes visible and
  before executor verification and session recording. Cancellation stays
  non-terminal until both finish.
- Full offline check: 644/644 pass, including typecheck. An ordinary MCP client
  cancellation stops a direct musical tool after its current preflight read and
  before the next workspace write.
- Extension Gradle test build: pass; no extension source changed.
- Live handshake: protocol, 139-method golden, and deployment age pass.
- `probe:2x-async`: pass through the registered ordinary-MCP surface. Start
  returned `accepted` in 3 ms. Inspection reached `completed` in 10.8 seconds
  with one applied exact change and the complete musical result.
- Independent `read_clip` found the note and pan value. Exact reversal restored
  an empty channel.
- A second start returned `cancelling` after cancellation. It reached terminal
  `cancelled` with no recorded change.
- Teardown removed the disposable Lead row 5 clip. Lead rows 1 through 4 stayed
  occupied, and the entry selection coordinates were restored.

## Retrospective

Put a test pause at the boundary it claims to prove. A pause after
`workspace.apply()` returned did not cover in-flight verification.
