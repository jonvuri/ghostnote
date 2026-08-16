---
title: Current state
kind: status
state: active
updated: 2026-08-16
phase: phase-1
session: phase-1-session-4b-change-navigation
---

# Now

Phase 1 session 4a and its review follow-up are complete. The reduced pane,
status update, local repair, hidden large record, and restart persistence pass
live. Probe cleanup is failure-safe, and status cannot cross a detected project
or extension boundary. Session 4 has no pane action button, polling loop, or
automatic progress-notification policy.

## Baseline

- `copy_track` is ordinary track CRUD. Device alternates and clip blocks are
  independent managed representations.
- The observation record is empty. The project has its exact 10 baseline track
  ids, including `FX 1` and Master, with no probe residue.
- The hidden per-project record survives a full restart. Its field is absent
  from the controller pane, and the pane remains responsive.
- `ghostnote-description-v1` remains the frozen 15-tool cohort at SHA-256
  `9fa9bc1cc390f7a274b64b41c6aea26235562822ed7f804d9f6aac7dea540ebd`.
- The wire golden and running controller are 133 methods /
  `e4f565baa157c5a2`.
- `Last change` persists as `Change · 4a-live-check`. Its hidden product mirror
  restores a user edit without a server request.

## Session 4a review follow-up — complete 2026-08-16

The status path carries the generation and project name from the write receipt.
The brain checks session readiness before publication. The extension checks the
same identity before it updates document state. A detected project switch,
extension restart, unknown identity, or switch during the wire call returns the
successful tool result with a separate status failure.

The live status probe now enters its cleanup guard before it can replace the
observation record. It attempts to restore the saved value after a readback
timeout, disconnect, or later probe failure.

Verification: brain typecheck and **513/513** tests; extension Gradle test;
context check; `git diff --check`.

## Session 4a — complete 2026-08-16, verified live

The controller pane now shows only `Last change`. It also constructs a hidden
product status mirror and the hidden observation record. The Signal, Enum,
slot, shape, notification, hardware, bitmap, and other E14 product apparatus is
retired. Historical probes and evidence remain in the repository.

The brain sends one `status.push` request after a confirmed non-empty tool
change. Status names ordinary track copies, device alternates, clip alternates,
mixed managed results, generic changes, and reversals. Refusals, rejected
batches, unconfirmed results, and zero-write reversals preserve the prior value.
Each tool execution now captures its own recorded changes. Concurrent calls
cannot borrow another call's change id or category, and the highest session
sequence remains visible when calls finish out of order.
The extension repairs status edits through setting observers. The hidden mirror
separates project-load callbacks from user edits. It has no timer, bridge read,
or extension-to-server event path.

Verification: brain typecheck and **503/503** tests; extension Gradle test;
context check; `git diff --check`; wire golden and live handshake **133 /
`e4f565baa157c5a2`**. A focused live probe confirmed the reduced responsive
pane, local edit repair, and hidden 262144-character record. After save, full
restart, and reopen, status persisted and edit repair still passed. The probe
restored the observation record to its exact empty baseline.

## Session 3g-e — complete 2026-08-16, verified live

The read-only raw view returns the complete canonical record. Descriptive
reporting reconciles instruction, managed-event, and ordinary-use totals. It
cross-tabulates requested scope against separate device-event, clip-event, and
track-copy counts. It reports silent, accepted, and vetoed responses with choice
diversity. It adds no score, recommendation, redirect, or dispatch rule.

The six-case production record survived save, full restart, and reopen exactly.
The initial cleanup exposed and recovered a positional multi-track deletion
defect. `delete_track` now rejects repeated ids and removes several tracks from
the highest observed position to the lowest. The corrected cleanup passed live
and restored all 10 baseline ids and the prior empty record.

Verification: brain typecheck and **492/492** tests; extension Gradle test;
context check; `git diff --check`; live conformance **52/0/6**; restart smoke
**P0-P7**; corrected cleanup **3/3**.

## Next session

Complete [session 4b](plan/phase-1/4b-change-navigation.md). Add explicit
navigation from a recorded clip change to Bitwig's editor.

## Retrospective

Use a hidden product-owned mirror when a visible document setting must reject
user edits. Bitwig can report the default before the saved project value, so the
visible observer alone cannot identify an edit.

Use an execution-scoped write seam when concurrent calls need exact ownership.
A before-and-after scan of shared session history cannot identify the caller.

Put project identity in the status command. A readiness preflight alone cannot
cover a reconnect or project switch that occurs during the next wire call.
