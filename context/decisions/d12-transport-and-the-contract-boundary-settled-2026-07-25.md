---
id: D12
kind: decision
state: active
source: DECISIONS.md
---

# D12 — Transport and the contract boundary **[SETTLED 2026-07-25]**

**The brain speaks the versioned adapter contract; a thin encoder translates to
JSON-RPC 2.0 `category.action` over newline-framed TCP on 127.0.0.1:8686. The wire
frame is an implementation detail, not the interface.**

- Confirmed working end to end (E0), and the MCP SDK sits cleanly on `client.ts`
  with no surprises (E9).
- **The contract is the seam, not the wire** (SPIKE_PLAN §2.4, PHASE-0 §Scope 2).
  The proof is structural: the fake adapter implements the same contract and never
  speaks the wire at all. `WIRE` constants live in exactly one module.
- **Capabilities are DATA VARIANTS, not methods.** One write method (`apply`)
  taking an `Op` union; adding a capability adds a variant and the adapter
  interface never grows. Beat Twin abandoned a 57-tool surface learning this.
- **Versioned by exact equality** (`ghostnote/0`), plus a `methodsHash` over the
  sorted wire-method list so a drifted deployment is caught at connect rather than
  at the first failing write. No range negotiation — nobody ships two adapters at
  once and range logic is the over-engineering trap here.
- ⚠ **The socket is unauthenticated.** The gate is the daemon; the socket is the
  soft underbelly (INITIAL_PROMPT §8j, inherited from Beat Twin). Firewall it; do
  not mistake policy for a boundary.
  > ⚠ 2026-08-07: "the gate is the daemon" → the gate is the **MCP server** (D4
  > rev — there is no daemon). The threat-model posture is unchanged.

> ⚠ **AMENDED 2026-08-07 (D20).** *"One write method"* holds at the ADAPTER
> CONTRACT — the `Op` union does not split. But the **MCP tool surface** above it
> partitions by privilege class — read / write / destructive — so that host
> permission systems can see the destruction boundary (`readOnlyHint`,
> `destructiveHint`). The seam is at tool granularity only; the adapter interface
> still never grows per capability. This is D17g's structural-seam idiom applied
> at the tool layer: a privilege boundary should be a seam, not a remembered rule.
