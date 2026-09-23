---
title: Phase 7f follow-up — Warning, response, and discovery reduction
kind: plan
state: complete
status: Complete. E126 records all fixes, measurements, live checks, and client behavior; resume 7f.
updated: 2026-09-23
parent: 7f-hybrid-workstation-dogfood.md
prev: 7e-audio-capture-and-analysis-composition.md
next: 7f-hybrid-workstation-dogfood.md
---

# Phase 7f follow-up — Warning, response, and discovery reduction

## Purpose

Stop normal host numeric noise from producing false modulation warnings. Keep
real base-to-modulated divergence and automation visible. Then reduce successful
`set_parameter` results without removing failure or reversal evidence. Finally,
give MCP clients one compact summary of Ghostnote's capabilities and operating
boundaries.

## Progress

[E126](../../evidence/experiments/e126-warning-response-and-discovery-reduction.md)
records the completed implementation and measurements. All code, focused
tests, the live warning spot check, the direct MCP initialize check, and the
full brain check pass.

A fresh Codex UI session also loaded Ghostnote and called `check_connection`
successfully. Codex did not surface the MCP server instructions separately from
tool schemas. The direct SDK client did surface them separately, which confirms
that the server emits the protocol field and the Codex client can ignore it.

## Selected fix

Use one shared `1e-6` comparison tolerance for warnings that compare a stored
normalized base value with an observed modulated value. This is a host-value
comparison tolerance. It is not an audibility threshold.

The current `1e-9` checks warn on ordinary live values such as `0.18` versus
`0.18000000715255737`. Existing evidence gives enough separation for `1e-6`:
the prior unmodulated probe used that tolerance, the smallest proved live
modulation was approximately `0.0024`, and authored-modulation verification
uses a separate `0.001` default gate.

## Work

1. Define one named helper or constant for meaningful base-to-modulated
   divergence.
2. Use it in direct-parameter and remote-control inspection warnings,
   `set_parameter` preflight warnings, fidelity reporting, and managed FX
   warnings.
3. Do not change parameter write verification, settlement, or the explicit
   modulation-witness thresholds used by modulator authoring.
4. Add boundary tests for exact equality, float-representation noise below the
   tolerance, divergence above the tolerance, and automation without
   modulation.
5. Run a live read-only spot check. Confirm that ordinary float noise produces
   no warning and a materially divergent control still does.

## Follow-on fix: compact successful parameter results

Apply this reduction only after the warning threshold passes its focused tests.

1. Keep complete scalar change records in the change store. Do not weaken
   write guards, independent readback, partial-success reporting, or reversal.
2. For an all-success `set_parameter` result, return shared device routes once.
   Return each changed parameter selector and change ID without repeating the
   complete receipt, place, and reversal structure for every scalar.
3. Keep detailed inline receipts for failures, mismatches, unread targets, and
   partial success. Keep full successful details available through
   `list_changes` when a later task needs them.
4. Group identical warnings by code and message. Include their setting indexes
   and parameter selectors instead of repeating the warning text once per
   setting.
5. Update the result contract and description version for the compact success
   shape. Keep the request schema and recorded change format unchanged.
6. Measure the serialized result bytes for one single-setting success and one
   27-setting success before and after the change.

## Follow-on fix: MCP server instructions

Apply this addition after the response reduction. Keep it independent of tool
schemas and tool-search implementation.

1. Set the MCP `instructions` field in the `McpServer` options. Do not build a
   custom capability index.
2. State that Ghostnote reads and edits the active Bitwig Studio project. Name
   the main capability families: tracks, launcher clips, notes, devices,
   parameters, modulation, device alternates, and verified composition
   workflows.
3. State the cross-tool boundaries once: use a specific read when current state
   is needed, writes return recorded change IDs, supported writes can be
   inspected or reversed, and delete tools permanently remove containers.
4. Do not repeat individual tool schemas, parameter details, examples, or
   long procedures. Keep those facts in the individual tool descriptions.
5. Add a protocol-level test that reads the initialize result and checks the
   exact compact instructions. Measure its serialized size.
6. Confirm in a fresh Codex session that the server loads and its tools remain
   callable. Record whether the client surfaces the instructions separately;
   MCP permits clients to ignore them.

## Acceptance criteria

- All general base-to-modulated warning paths use the same named tolerance.
- The observed `0.18` and `0.18000000715255737` pair produces no modulation
  warning.
- A difference greater than `1e-6` produces a modulation warning.
- Automation warnings remain independent of modulation warnings.
- Authored-modulation verification keeps its existing task-specific gates.
- A successful parameter cohort retains every change ID and changed selector.
- A 27-setting success does not repeat the same track, device, place, and
  reversal fields in 27 complete receipts.
- Partial and failed cohorts retain exact per-setting effects and diagnostics.
- `list_changes` still returns the complete stored receipts used for reversal.
- The `set_parameter` request schema and recorded change format do not change.
- The compact success result and tool description use a new description
  version.
- The MCP initialize result contains one concise `instructions` value that
  identifies Ghostnote's Bitwig scope, capability families, write records,
  reversal support, and destructive boundary.
- The server instructions do not duplicate tool schemas or detailed
  procedures, and their serialized size is recorded.
- A fresh Codex session can load Ghostnote and call `check_connection` after
  the instructions change.
- Focused tests, the full brain check, the context check, and
  `git diff --check` pass.

## Out of scope

- A custom tool-search index or a change to Codex tool-discovery behavior.
- Changes to device-alternate lifecycle verification.
- A new batch change identity or a change to reversal grain.
- An audibility or perceptual threshold.
- Closing S16 or completing the 7f dogfood run.

## Retrospective target

Record whether one shared tolerance removed false warnings without weakening a
real modulation witness, and whether compact success results removed repeated
data without hiding any action needed after a partial failure. Record whether
the MCP instructions gave a useful capability map without duplicating the tool
catalog.
