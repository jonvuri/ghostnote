---
title: Phase 5v — semantic parameter units and fail-closed guidance
kind: plan
state: planned
status: Planned. Recheck Controller API unit support and stop unproved value conversion.
updated: 2026-09-03
parent: README.md
prev: 5u-settlement-budget-and-nested-remote-reliability.md
next: 5w-selection-borrowing-and-background-stability.md
evidence: E4, E4b, E55, E58, E64, E82, dogfood session 01a0690e-1761-76b1-9e8e-635bfa35e583
---

# Phase 5v — semantic parameter units and fail-closed guidance

## Purpose

Recheck whether Ghostnote can read and write parameter values in semantic host
units. If exact conversion is unavailable, prevent callers from presenting a
guessed normalized value as a proved musical setting.

## Starting facts and questions

During dogfood session `01a0690e-1761-76b1-9e8e-635bfa35e583`, the agent tried
to set a Classic LFO rate to `1.5 measures`. Ghostnote exposed a normalized
remote value. The agent searched for a conversion, attempted computer use, then
wrote a guessed normalized value and described it as the requested duration.
The result did not prove that semantic value.

Earlier work found that typed `Parameter` handles can expose display text.
DirectParameter display observers did not populate in the original probe.
Current remote controls inherit the `Parameter` API, but Ghostnote's remote
inventory returns normalized base and modulated values without display text.
The public write schema accepts only normalized values. These facts do not yet
prove whether an exact semantic write path exists.

Investigate the operator's recollection that the Controller API cannot do this.
If that is confirmed, evaluate whether negative instructions are useful. Also
compare them with stronger schema, capability, and result designs that make an
unsupported conversion explicit.

## Work order

1. Audit E4, E4b, E55, E58, E64, E82, the current extension, and the local
   Bitwig API 25 surface. Distinguish display observation, discrete value names,
   normalized writes, text parsing, value conversion, and inverse conversion.
2. Inspect `Parameter`, `SettableRangedValue`, `RemoteControl`, DirectParameter,
   typed native views, and plug-in views. Record an authoritative method matrix.
   Do not infer a negative from one missing method.
3. Run focused read-only probes on Classic LFO Rate and Timebase. Include
   continuous, stepped, tempo-synced, and free-running states. Determine whether
   display text is stable, complete, target-bound, and available on remote
   controls.
4. Test whether the API can request an exact semantic value such as
   `1.5 measures`, or can only write a normalized value and observe the result.
   Require independent semantic readback for any positive claim.
5. Select the public contract from the evidence:
   - If exact semantic writes are supported, expose typed unit input and return
     exact semantic readback.
   - If only bounded discrete choices are exact, expose only those returned
     choices.
   - If inverse conversion is unavailable, keep normalized writes explicit and
     refuse to claim a semantic target that Ghostnote cannot prove.
6. Evaluate agent guidance after the contract decision. Prefer positive
   capability fields, typed schemas, and explicit refusal results. Add a narrow
   negative instruction only if an agent test shows that the stronger contract
   still invites invented conversion.
7. Add surface and agent-facing conformance tests. The unsupported case must not
   trigger web search, repository fallback, or computer-use fallback.
8. Restore every changed parameter and remove all disposable live content.

## Acceptance criteria

- One evidence record states exactly which semantic read and write capabilities
  API 25 provides for each inspected parameter path.
- Classic LFO Rate and Timebase have live observations in representative modes.
- A `1.5 measures` claim succeeds only with independent exact host readback.
- An unsupported semantic request returns a clear boundary before any scalar
  write. It never substitutes a guessed normalized value.
- The public schema and result distinguish normalized, displayed, discrete,
  and semantic values.
- An agent-facing test stays within Ghostnote and reports the boundary without
  trying web or computer-use workarounds.
- Exact parameter restoration and live cleanup pass.

## Out of scope

- A general parser for every plug-in display string.
- Approximate calibration tables learned from UI screenshots.
- Selection and application-focus repair.
- Existing-wrapper updates.

## Handoff

Session 5w isolates selection borrowing and Bitwig foreground changes. Carry
forward only semantic settings that this session proves.
