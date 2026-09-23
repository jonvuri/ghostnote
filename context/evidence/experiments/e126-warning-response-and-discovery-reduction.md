---
title: E126 — Warning, response, and discovery reduction passes
kind: evidence
state: active
updated: 2026-09-23
parent: ../../plan/phase-7/7f-follow-up-modulation-warning-tolerance.md
---

# E126 — Warning, response, and discovery reduction passes [K]

## Verdict

One shared `1e-6` host-value tolerance removes false base-to-modulated
warnings from normal numeric noise. Successful `set_parameter` results now
return compact selectors and change IDs under shared device routes. Complete
receipts remain in the change store and in all failure and partial results.
The MCP initialize response now gives clients one compact capability and safety
summary.

The implementation, direct MCP verification, and fresh Codex UI check pass.
Codex loaded the server and called `check_connection`. It did not surface the
server instructions separately from tool schemas.

## Warning tolerance

`BASE_TO_MODULATED_WARNING_TOLERANCE` is `1e-6`.
`hasMeaningfulBaseToModulatedDivergence` is the only general comparison used by
direct and remote inspection, `set_parameter` preflight, fidelity reporting,
and managed FX warnings. Timing tolerances and the modulator-authoring
`1e-3` witness gate did not change.

The live read-only check used `gn-dogfood-1` and its Polysynth:

| Control | Base | Modulated | Result |
|---|---:|---:|---|
| `AMP / AEG D` | 0.18 | 0.18000000715255737 | No modulation warning |
| `AMP / Output` | 0 | 0.8000000021209597 | Modulation warning |

Both inventories were stable. The check issued no write call.

## Compact parameter results

A complete success returns each device route once. Each entry under that route
contains its setting index, exact direct or remote selector, and scalar change
ID. It omits the repeated inline receipt, place, and reversal fields.

Failure, mismatch, unread, and partial results keep complete scalar receipts.
`list_changes` still returns the complete stored records, and each change ID
still reverses one scalar. The request schema and stored change format did not
change. The public description version advanced from
`ghostnote-description-v22` to `ghostnote-description-v23`.

Warnings now group by code and message. Each group lists the affected setting
indexes and parameter selectors.

The size fixture used one device, direct settings, values
`(index + 1) / (count + 1)`, `JSON.stringify`, UTF-8 byte length, and a fixed
`elapsedMs` value of zero.

| Complete success | Before | After | Change |
|---|---:|---:|---:|
| One setting | 817 bytes | 813 bytes | -0.5% |
| 27 settings | 5,924 bytes | 3,181 bytes | -46.3% |

## MCP instructions

The initialize result contains this exact text:

> Ghostnote reads and edits the active Bitwig Studio project: tracks, launcher
> clips, notes, devices, parameters, modulation, device alternates, and verified
> composition workflows. Clients should use a specific read when current state
> is needed. Writes return recorded change IDs; supported writes can be
> inspected or reversed. Delete tools permanently remove containers.

The raw text is 369 UTF-8 bytes. Its JSON serialization is 371 UTF-8 bytes.
The text does not copy tool schemas, parameters, examples, or procedures.

A fresh direct MCP subprocess returned this text separately through the SDK
client and called `check_connection` successfully. It returned project
`gn-dogfood-1`, 4 project tracks, and 8 project rows. `codex mcp get ghostnote`
also confirmed that the local Codex configuration enables the server.

A fresh Codex UI session loaded Ghostnote and called `check_connection` without
using a write or delete tool. It returned the same project, track, and row
counts. Codex did not surface the server instructions separately from tool
schemas. It presented guidance through individual tool descriptions instead.
This is permitted by MCP.

## Verification

- Warning-focused tests: 160 pass.
- Response and description tests: 108 pass.
- MCP initialize test: 1 passes.
- Full brain check: 1,139 tests pass.
- TypeScript typecheck and `git diff --check` pass.
- Live warning inspection and direct live `check_connection` pass.
- Fresh Codex UI load and read-only `check_connection` pass.

## Retrospective

The shared tolerance removed host noise without weakening the separate authored
modulation gate. Compact success results removed repeated data without hiding
any action needed after a partial failure. The server instructions provide a
small capability map without duplicating the tool catalog. A client-specific
AI-session check must state its data boundary before it starts.

The client check confirmed that protocol support does not imply separate UI
presentation. Keep essential operational guidance in tool descriptions.

When a public result field changes, search every live probe consumer before
focused tests. This review found and corrected two stale `changes` readers.
