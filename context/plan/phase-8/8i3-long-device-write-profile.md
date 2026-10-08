---
title: Phase 8i3 long device write profile
kind: plan
state: done
status: Complete (E252, D44). Nine guard-keeping optimizations, then D44 limits; the longest admitted call is 33.5 s, and no admitted call reaches 45 s. Next: 8i4.
updated: 2026-10-08
parent: README.md
prev: 8i2-collapsed-group-live-verification.md
next: 8i4-overlay-basis-sealing.md
evidence: E45, E47, E238, E244, E247, E248, E252; D15, D18, D39, D41, D44
---

# Phase 8i3 long device write profile

## Result

Complete ([E252](../../evidence/experiments/e252-long-device-write-profile.md),
[D44](../../decisions/d44-long-writes-are-optimized-then-bounded.md), D39
amendment). Every write has a measured largest admitted case. The changes:
a live-generation cohort integrity poll, one layer-chain naming stage,
structure-only container proofs, a drum pad poll, shared modulation sample
rounds, no slot descent on layer-chain moves, and two empty-slot descents
instead of eight. Then the D44 limits refuse a larger request before any
read or write (`outside-limit`). No background flag was needed. Tool
descriptions are `ghostnote-description-v36`; the limit follow-up made
them v37 (4 control routes, 10 removals, limits in the schema text).

## Cause

The 8h4g amendment of
[D39](../../decisions/d39-long-agent-native-writes-run-in-the-background-on-their-own-name.md)
removed the background route from `agent-native-v1`. Its reason: the worst
case is far under the 60 s MCP client timeout (E45), and the staged
composition of four layer chains (30.5 s, E247) is the longest direct call.
That benchmark used one native device in each layer chain. The inputs admit
more work:

- `compose_devices` accepts five layer chains of up to four devices. Every
  shape other than "one native device in each layer chain, appended" uses
  the staged backend. E247: 2 chains 17.5 s, 4 chains 30.5 s, so about 6.5 s
  for each added one-device chain. Extrapolated: 5 chains of 2 devices about
  60 s; 5 chains of 4 devices about 90–110 s. These are not measured.
- `set_device_controls` has no upper bound on `settings`. E247: 1 control
  2.6 s, 27 controls 14.4 s, so about 0.45 s for each added control on
  Polysynth. About 120 controls would pass 60 s. A plug-in such as Diva
  (281 IDs; one write 8.3 s, E238) can reach that in one request.

After the timeout the client stops waiting, but the brain continues until
the cancellation reaches the next workspace boundary (E45, E47). The agent
gets a timeout with no effect list, and a retry can duplicate devices. The
AGENTS.md cost-model rule requires the largest admitted case.

Operator preference: profile the paths for real. If a measured case is over
budget, look for optimizations first. Bound the input or add a background
flag only for what remains over budget.

## Budget

D39 set a 30 s plan budget for a direct call with verification, and the
60 s client timeout is the ceiling. Use these in this session:

- Target: the largest admitted input of each tool finishes in at most 30 s.
- Ceiling: no admitted input may reach 45 s (a 15 s margin to the timeout
  for host variance, plug-in load, and a busy project).

## Entry reads

- The [performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md),
  E247 (composition benchmark and the 27-control write), E238 (device
  structure migration, Diva), E244 (DirectParameter display), D15 (control
  write verification), D18 (device structure), D39 and its amendment.
- `brain/src/surface/agent-native-devices.ts` (input schemas and the staged
  composition), `general-device-composition.ts`, `device-controls.ts`
  (`setDeviceControls` cohorts), `drum-machine-composition.ts`, and the
  executor stages for `device.insert`, `device.relocate`, `chain.rename`,
  and `param.set`.
- `brain/src/probes/phase8h4e-devices.ts` (`benchmark`) and
  `phase8h4g-inventory.ts` (wire call sequences).
- `brain/src/surface/call-budget.test.ts`.

## Work

1. **Inventory.** List the largest admitted input of every
   `agent-native-v1` write tool from its schema. Give each an extrapolated
   cost from the ledger. Measure live each case whose estimate is above
   20 s. Expected candidates: `compose_devices` (staged, five chains, up to
   four devices; a Drum Machine with 16 pads), `set_device_controls` (a
   native device's complete inventory and a plug-in with many IDs),
   `add_devices` (16 sources, native and plug-in), and `delete_device`
   (no upper bound). Check the clip batch tools at 64 entries and
   `add_tracks` at 16 from the ledger; measure only if the estimate is
   above 20 s.
2. **Profile.** For each measured case, record the wall time and the wire
   call sequence with its gaps. Split the time into host stages, proof
   polls, settles, inventories, and brain planning. Name the part that grows
   with the input.
3. **Optimize.** For each case over the target, find the waste before any
   limit. Candidates to test, not to assume:
   - staged composition: insert each device straight into its layer chain
     instead of an insertion at the end and a move; share one structural
     proof between stages; batch the layer-chain renames;
   - `set_device_controls`: one write stage and one complete readback
     inventory for a cohort, not one for each control, if D15's readback
     stays exact;
   - `add_devices` and `delete_device`: share bank reads and inventories
     between entries.
   Do not remove a guard only because it is slow. For each changed guard,
   name the failure it covered, the replacement evidence, and the measured
   saved work (8h rule). Test a host primitive with a control arm before a
   design depends on it (8i1 retrospective).
4. **Decide.** For each case still over the target after optimization:
   - bound the input so that the measured worst case is under the target,
     and refuse a larger request before any write (`outside-limit`, with
     the bound in `detail`); or
   - give the tool a `background: true` flag on its own name, under the
     D39 rule (no generic start tool).
   Prefer a bound when real work fits in it, because a background route
   adds agent work (D39 amendment). Record the decision as D44 (check the
   number is free) and amend D39: correct the "longest direct call"
   statement.
5. **Descriptions.** Update the affected tool descriptions (for example the
   "each about 4 s" stage costs and any new bound). Bump
   `TOOL_DESCRIPTION_VERSION` and its public artifact, and report the new
   version.

## Cost model

Numbers from the ledger. The live runs replace the estimates.

| Case | Host work | Expected cost |
|---|---|---|
| Staged composition, 4 chains × 1 device (reference) | Container insertion, 4 renames, 4 insertions, 4 moves, structural proofs | 30.5 s (E247) |
| Staged, 5 chains × 2 devices | 1 container, 5 renames, 10 insertions, 10 moves | About 60 s (estimate) |
| Staged, 5 chains × 4 devices (largest admitted) | 1 container, 5 renames, 20 insertions, 20 moves | About 90–110 s (estimate) |
| Drum Machine, 16 pads | 1 container insertion and 16 pad insertions in one apply; readback up to 6 polls | Not measured; each pad insertion has a 4,000 ms proof deadline |
| `set_device_controls`, 27 controls (reference) | 1 cohort; preflight inventory, 27 writes, readback | 14.4 s, 276 wire calls (E247) |
| `set_device_controls`, 120 controls, native | Same, linear in controls | About 56 s (estimate) |
| `set_device_controls`, many controls on a 281-ID plug-in | Same; about 4 s for each complete inventory | Not measured; one write 8.3 s (E238) |
| `add_devices`, 16 sources | 16 insertions, each with a complete order read and a proof | Native about 23 s (1.4 s each, E247); plug-in up to the 4,000 ms deadline each |
| `delete_device`, many devices | Bank reads and two parameter inventories for each removed device | One container 3.1–3.3 s, about 100 wire calls (E247) |

Heap: plug-in instances add engine load in Bitwig, not extension heap. The
parameter inventories are transient. The live heap grows about 100 MiB over
a long driver run (undo history); restart Bitwig before the run if it is
already high, and record the heap at the start and the end.

### Review fixes: cost model

The two review fixes keep the successful path's host turns, cold reads,
write stages, and heap unchanged. This applies to one control and one
rename, and to the D44 limits of 64 settings on two routes and six device
units. The parameter poll adds one scalar identity comparison. A mismatch
uses the existing settled-inventory fallback (about 0.36 s on a native
device, versus about 50 ms for two polls). A failed name stage derives its
checkpoint from proved rename receipts. It removes the extra structure read
(about eight host turns, 190 ms) and allocates at most five entry names.
E252 remains the cost reference. Rerun the controls and composition arms
after the fixes; use offline fault injection for the two failure paths.

## Live procedure

Use an owned scratch track in an owned project ("New 2" or a new project),
not "ice jungle". For plug-in arms, the operator turns the audio engine on
(E244). Run the drivers as one foreground chain; check `pgrep -f phase8`
first. Remove every fixture track. If an optimization changes the
extension, deploy with `./gradlew copyExtension` and ask the operator for a
full controller replacement; then run `npm run probe:hello`.

## Acceptance

- Every write tool has a measured or a bounded largest admitted case. Each
  is at most 30 s, or has a recorded reason and is under 45 s.
- No admitted input can reach the 60 s client timeout.
- Each optimization keeps its guard, or names the replaced guard, the
  replacement evidence, and the saved work.
- A bound refuses before any write, with a stable code and the bound in
  `detail`; tests cover the refusal.
- Call-budget tests and the ledger change together; a regression above
  20 percent on an existing row has a named cause.
- Tool descriptions match the measured costs and bounds; the description
  version is bumped when wording changes.
- `npm run check`, extension tests, wire goldens (if a frame changes),
  `context/check.rb`, and `git diff --check` pass. The owned project ends at
  its baseline.

## Records and handoff

Record the measurements as E252 (check the number is free) and the decision
as D44 with the D39 amendment. Update the ledger rows and limits, the 8i
charter, and `context/NOW.md`: route to
[8i4](8i4-overlay-basis-sealing.md).
