---
title: E320 — Update audit 6.1.4 device compatibility
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E320 — Update audit 6.1.4 device compatibility

## Result

The operator selected the first empty Launcher slot on `Inst 1`. The E319
recovery passed. A new attempt passed setup, notes, clips, and mixer. Two
guarded recoveries then removed the failed control and structure fixtures.
Separate continuations passed controls and structure. The Sampler case
stopped after insertion because parameter `CONTENTS/AMP_ATTACK_TIME` reports
`Gated Attack Time`, while the retained target expects `AEG Attack Time`.
The upgrade audit is not accepted. The Sampler identity guard remains intact.

Two shared adapter corrections pass offline checks and the affected live
device case. Enabled-state verification now permits bounded read-only
settlement. An empty layer bank with `hasLayers: false` is complete even
when the host retains a stale layer count. Neither correction changes a
tool schema or public promise. Descriptions remain v52. The loaded normal
extension is unchanged; no controller replacement is needed for these
TypeScript changes.

## Attempts and recovery

All commands used one foreground driver and one live writer. Each command
checked the version, initialization, project, stopped transport, ownership,
selection, and competing connections. Failed writes were inspected before
recovery. No uncertain write was repeated for timing.

| Record | Result and retained evidence |
| --- | --- |
| [First attempt](../data/bitwig-upgrade-audit/preparation/state.json) | [Empty-selection recovery](../data/bitwig-upgrade-audit/preparation/empty-selection-recovery.json) removed all six first-attempt tracks. Original content matches entry. The newly selected empty slot remains selected. The E319 failure remains. |
| [Second attempt](../data/bitwig-upgrade-audit/attempt-2-614/state.json) | Setup, notes, clips, and mixer passed. Controls stopped because the driver expected an object for the valid boolean `verified: true`. [Recovery](../data/bitwig-upgrade-audit/attempt-2-614/control-reply-recovery.json) proved the written value independently, resolved the pending intent, removed the three inserted devices, and restored the full fixture. |
| [First continuation](../data/bitwig-upgrade-audit/continuation-614/state.json) | Controls passed. Structure stopped on stale enabled-state readback. Two inspections then stopped on a stale Sampler layer count. After correction, [complete inspection](../data/bitwig-upgrade-audit/continuation-614/c450ec46-69b8-4901-a93d-d0abe46a1958-inspection.json) proved the exact disabled FX Layer and unchanged content elsewhere. [Recovery](../data/bitwig-upgrade-audit/continuation-614/structure-readback-recovery.json) enabled it, read it independently, removed it, and restored the full fixture. |
| [Second continuation](../data/bitwig-upgrade-audit/continuation-2-614/state.json) | Structure passed. Sampler stopped on the parameter name. The pending intent and original failure remain. No Sampler recovery has run. |

The driver now accepts both documented verification forms and rejects false
or malformed verdicts. Each recovery admits only its exact failed sequence
and proved owned content. `fork-recovered` starts a separate continuation
after successful recovery. It checks transitive hashes of the source states,
recovery records, and passed case evidence before each live command. It does
not transfer document references or change IDs. Do not edit those source
records or clear their failures.

## Passed live coverage

- Notes: mixed MIDI channels, non-quarter timing, expression, sparse edits,
  desired-state edits, reversals, and stale-reference refusal without a write.
- Clips: nonadjacent copy, occupied-slot refusal, move and return, deletion,
  track duplication, and owned duplicate removal.
- Mixer: four fields written, independently read, and restored.
- Controls: two Polysynth instances and Diva; independent parameter reads,
  preservation of the other instance, reversals, and device removal.
- Structure: FX Layer with two nested chains, insertion, copy, move,
  disable, reversal, deletion, and complete preserved-state comparison.

Each passed case returns to the same audit fixture. The original four
tracks and selection match entry in the last complete
[structure snapshot](../data/bitwig-upgrade-audit/continuation-2-614/structure.json).
Sampler, manual selection/group checks, project switching, save/reopen,
listening, final cleanup, and section 3 acceptance remain incomplete.

## Adapter changes and costs

The failed disable had succeeded in the host. Its first independent read,
43.8 ms after the batch, still reported enabled. A later read at 129.8 ms
reported disabled. The [trace](../data/bitwig-upgrade-audit/live-614/enabled-readback-trace.json)
retains both observations. The adapter now makes at most eight independent
device-chain reads. Additional reads each wait 25 ms. The complete chain
must retain its names, order, and all unrelated enabled values. A changed
or incomplete chain refuses immediately. The setter runs once.

The fast path still uses one read. The delayed path adds at most seven host
reads and 175 ms of waits. Offline tests exercise delayed delivery, a silent
no-op, and unrelated changes. The corrected live disable and reversal passed
on their first reads. They took 762.918 ms and 679.388 ms, with 34 wire calls
each. This live result proves the fast path; the delayed path is tested
offline. Recovery enabled the existing container in 706.288 ms and 31 calls.

After an FX Layer read, the host returned `hasLayers: false`, an empty layer
list, and a stale count of two for Sampler. The adapter now uses the explicit
absence flag and empty list together. A nonempty list still refuses. This
adds no call or wait and does not extend named-slot coverage. The subsequent
complete inspection and structure case passed.

[Per-command and per-write costs](../data/bitwig-upgrade-audit/live-614/progress-costs.json)
retain the measurements, including failures and recovery. All commands
remain below the 6,000-call bound. Representative comparisons are:

| Operation | 6.1.4 | Earlier result and limit |
| --- | --- | --- |
| One Polysynth control | 2,312.621 and 2,308.567 ms; 66 calls each | E252: 2,283 ms. Similar operation, different selected control; about 1.1–1.3% higher. |
| Diva control | 3,445.531 ms; 80 calls | E252: 3,429 ms; about 0.5% higher. This is one sample. |
| Four mixer fields | 267.748 ms; 15 calls | E257: 268 ms for one field and 272 ms for 32. Batching cost is consistent; workloads differ. |
| One Launcher copy | 869.414 ms; 37 calls | E263: 853–888 ms and 37 calls. Source contents differ. |
| Occupied-slot refusal | 94.931 ms; 6 calls | E263: 94 ms and 6 calls. |

These samples do not show a comparable regression above 20 percent. They
do not establish product capacity or a complete upgrade performance verdict.
No write was repeated solely to measure timing. The
[ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#9b-update-audit-driver-model-before-implementation)
records the changed worst-case read budget and bounded recovery models.

## Sampler stop and next step

The [failed edit](../data/bitwig-upgrade-audit/continuation-2-614/107c1a49-be2f-4d59-b0d0-27a0649b42ca-failure.json)
inserted a second Sampler on `gn-ua-0b6c3297-single`. Both LFO pages were
observed. The parameter ID is present, but its name differs. The original
single and multisample controls also report `Gated Attack Time` for this ID.
The tool correctly reports an applied write with unavailable readback.
Its edited-file report is not proof of host route or resource preservation.

The operator was asked to save that second Sampler as
`/Users/jonvuri/Bitwig Upgrade Work/2026-10-21/gn-ua-0b6c3297-single-name-check.bwpreset`,
report the sample name, resource resolution, and sample/zone state, then
restore `Inst 1` row 0 with playback stopped. The response is pending.
No live command runs while the operator prepares this export.

Continue the same update-audit session with the saved-file route/resource
inspection and a fresh complete live inspection. Use that evidence to
define a narrow identity adaptation, its tests, and exact Sampler recovery.
Preserve this failure. Continue in a new record only after recovery proves
the full fixture. Do not reuse the expired change ID or rerun the failed
edit blindly. Then finish the remaining matrix and operator checkpoints.
The separate 9b.6 Grid doctor remains gated on general audit acceptance.

## Verification and final state

The final [required offline gate](../data/bitwig-upgrade-audit/live-614/final-full-check.txt)
passes all 2,446 tests, with no failure or skip. The
[focused compatibility checks](../data/bitwig-upgrade-audit/live-614/compatibility-tests.txt)
pass all 208 tests, including adapter frame and surface call budgets.
[Recovery tests](../data/bitwig-upgrade-audit/live-614/structure-recovery-tests.txt)
pass all 25 cases. [Typecheck](../data/bitwig-upgrade-audit/live-614/structure-recovery-typecheck.txt)
passes. Tests assert the additional read bound and one setter on delay.

Bitwig 6.1.4 remains in the normal profile with the E319 initialization and
E318 archive. The last proved project is stopped `gn-upgrade-audit`. Six
`gn-ua-0b6c3297-` tracks remain. The device test track is empty. The single
track has its original Sampler plus the failed inserted Sampler; the multi
track has its original Sampler. Full preserved state was last proved before
the Sampler edit. A complete post-edit snapshot is still required. No driver
or evidence lock remains, but the Sampler pending-write latch remains.
No save, launch, engine, or Grid command was sent by the agent. Original
projects, backup files, and donor fixtures were not changed.

## Lesson

The audit harness must use the same verdict parser as its simulated tests.
The tests now exercise boolean and combined verdicts through that parser.
For observer delays, retain the setter result separately from independent
readback and bound only the reads. The new adapter tests enforce this rule.
