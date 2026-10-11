---
title: Phase 8i15 device-add revert report
kind: plan
state: planned
status: Planned. Follows 8i14. Make `revert_change` and `check_revert` report a reverted device add correctly.
updated: 2026-10-11
parent: README.md
prev: 8i14-clip-copy-to-any-row.md
next: 8i-agent-native-hybrid-dogfood.md
evidence: E262
---

# Phase 8i15 device-add revert report

Issue D8 of the [issue log](8i-dogfood-issues.md)
([E262](../../evidence/experiments/e262-automated-dogfood-stretch-set.md), S2).
`revert_change` of an `add_devices` effect deleted the device, and the
independent read confirmed it. The result said the opposite:

- `add_devices` returned each effect with `fidelity: exact`.
- `check_revert` returned `wouldWriteAnything: true`, `fullyRestorable:
  true`, and empty `wouldRestore` and `wouldNotRestore` lists.
- `revert_change` returned `applied: true`, readback `verified`, an
  effect with `fidelity: none`, and empty `restored` and `notRestored`
  lists.

An agent that reads the result can conclude that nothing was restored.
Transcripts: `phase8i13-dogfood/s2-codex/extract.jsonl`, lines 39, 69, 70;
`s2-claude/extract.jsonl`, lines 63, 64, 72, 74.

## Where to look

These are inferences from one read of the code; confirm each one first.

- The revert result takes `restored` from `reversalReport`
  (`brain/src/surface/report.ts`): `plan.addresses` mapped through the
  write targets of the original change. A device removal seems to add no
  address, so the list is empty while `plan.ops` holds the delete.
  `fullyRestorable` is true because `plan.ops` is not empty.
- The effect fidelity is the fidelity of the reversal change itself
  (`effectOf`, `agent-native-retained.ts`; `labelTarget`,
  `brain/src/engine/fidelity.ts`): a `device.delete` target has
  `restore: 'none'` (`write-set.ts`, "no device recreation"). So `none`
  says "this delete cannot be reversed", not "the revert restored
  nothing". The field name does not make that clear.
- The same shape can occur for each reversal whose inverse is a removal:
  `add_tracks`, `duplicate_track`, `add_scenes`, `add_launcher_clip`,
  `copy_launcher_clips`, `duplicate_layer_chain`. S4 showed a
  `copy_launcher_clips` revert with a filled `restored` list and
  `fidelity: lossy`. Survey each one with the fake adapter before the
  design.

## Work

1. Reproduce with the fake adapter: `add_devices`, `check_revert`,
   `revert_change`. Then survey the other removal reversals for the same
   empty lists.
2. Report the removal. `check_revert` and `revert_change` name each
   object that the reversal removes (for a device: track, position, and
   name), in `wouldRestore` and `restored` or in a new field (for
   example `removed`). Choose one form for all removal reversals and
   keep the result contract tests in step.
3. Fidelity. Decide and record (D49 if it is a contract decision) what
   the effect fidelity of a `revert_change` result states. The
   recommendation: the result states how completely the revert restored
   the prior state, and the fact that the revert itself has no revert
   goes in a separate field or caveat. A device add that is removed with
   a verified readback is then not `none`.
4. Update the `revert_change` and `check_revert` descriptions for the
   new field and the fidelity meaning. Bump `TOOL_DESCRIPTION_VERSION`
   and the public artifact (v48 when 8i14 made v47).
5. Tests: unit tests for the device case and for each surveyed tool that
   changes; the result contract test; `readback-unavailable.test.ts`
   stays green.
6. Live check in `gn-scale-test` on a scratch track: `add_devices` (two
   devices), `check_revert`, `revert_change` for each; the result names
   each removed device and the track holds the prior device list.

## Cost model

No host call is added: the report is built from the plan and the change
record that the tools hold. The call-budget tests must pass unchanged.
The live check measures `revert_change` of a device add once and
compares it with S2 (1.4 s to 2.3 s for each call, client time included).

## Acceptance

- `check_revert` and `revert_change` of a device add name the device
  that the revert removes; no list that should hold it is empty.
- The fidelity of the revert result agrees with the verified state, and
  the meaning of the field is in the description.
- Each other removal reversal has the same report form, or the E record
  states why it differs.
- Unit and contract tests pass; no call budget changes.
- Descriptions bumped with the public artifact.
- An E record (E264 when 8i14 used E263) with its index row and the live
  result. Mark D8 in the issue log.
- `gn-scale-test` is at its baseline.

## Out of scope

A revert for `move_devices` (D6), the `authority-unavailable` control
read after a wrap (D7), and a change to what a revert can restore.
