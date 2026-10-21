---
title: E322 — Sampler recovery and corrected live identity
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E322 — Sampler recovery and corrected live identity

## Result

The operator selected the `Inst 1` track header and first empty Launcher
cell. Guarded recovery passed. It removed only the extra Sampler, preserved
the original failure, and proved the complete fixture and both selections
equal to the last passed structure case.

A fresh continuation passed the corrected single-Sampler edit's host,
page, and parameter-identity checks. The driver is paused for a fresh host
export before reversal. The full Sampler case is not yet accepted. No new
product code or extension deployment was needed in this step.

## Recovery proof

The [recovery record](../data/bitwig-upgrade-audit/continuation-2-614/sampler-name-recovery.json)
retains the export hash, decoded routes, complete before/after snapshots,
resolved intent, and command `7bac59a5-e53f-49e1-90e1-90a0d5237570`.
The [command log](../data/bitwig-upgrade-audit/sampler-name-check-614/recovery.txt)
reports successful cleanup and complete fixture restoration. The current
version, initialization, stopped transport, project, selection, ownership,
source hashes, and competing clients were checked before the write.

The export from E321 proves both attack routes and the original sample
reference. Fresh independent reads prove the exact two-Sampler pair,
unchanged base values, and preserved content elsewhere. The driver then
deleted only device position 1 and independently read the remaining bank
and full fixture. Both mixer and Launcher selection are `Inst 1`, row 0.
The source failure remains. Its pending intent is resolved and retained
in the recovery record. The expired change ID was not reused.

## Corrected live edit and pause

[Continuation 3](../data/bitwig-upgrade-audit/continuation-3-614/state.json)
keeps the previously passed cases and
[transitive source proofs](../data/bitwig-upgrade-audit/continuation-3-614/inherited-evidence.json).
All hashes were checked before live work. No source state pinned by these
proofs may change. The failed Sampler case started from its restored fixture.

The [edit summary](../data/bitwig-upgrade-audit/sampler-name-check-614/corrected-edit-summary.json)
records command `7e46a0eb-7916-463d-8d40-3fdc7144c387`. Insertion, both LFO
pages, and the measured Sampler parameter identity pass. The normal profile
does not sample modulation activity. This result does not replace the host
export, resource observations, or listening check.

The same foreground driver remains alive at the single-preset export pause.
Its terminal session is `88497`. No host calls run during the pause. Do not
start another live client or restart the case. The operator must save the
second Sampler on `gn-ua-0b6c3297-single` to the library as
`gn-ua-0b6c3297-single-edited`. The agent then copies it to
`/Users/jonvuri/Bitwig Upgrade Work/2026-10-21/gn-ua-0b6c3297-single-edited.bwpreset`.
The requested observations cover the sample name, Single mode, visible
waveform, and absence of a missing-sample indication. Both selections must
return to `Inst 1` row 0, with transport stopped, before the input reply.
These fresh observations have not yet been reported.

Supply only confirmed observations to the existing driver's input. It will
inspect the fresh file, compare routes and sample references, check the live
guards, and perform the supported reversal within the same server session.
It then starts the multi case and pauses for its export. If this driver
exits or its server session is lost, preserve the state and inspect before
recovery. Its current change ID does not authorize work in another session.

## Costs and verification

[Measured costs](../data/bitwig-upgrade-audit/sampler-name-check-614/recovery-and-edit-costs.json):

| Operation | Elapsed | Logical host calls | Wire turns | Summed wire time |
| --- | --- | --- | --- | --- |
| Recovery deletion | 2,489.033 ms | 85 | 71 | 1,635 ms |
| Corrected single edit | 2,266.752 ms | 71 | 57 | 1,309 ms |
| E320 failed single edit | 2,150.036 ms | 71 | 57 | 1,183 ms |

The corrected edit retains the same call count and takes about 5.4% longer
than the failed name-check sample. This is one local comparison, not a
cross-version capacity result. The operation returns a different verdict.
There was no timing-only repeat. Operator pause time is excluded. The
[ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#9b-update-audit-driver-model-before-implementation)
retains the unchanged model and these measurements.

E321's final offline gate passes all 2,450 tests, including the oracle.
No implementation changed here, so that gate remains applicable. The initial
`tsx` CLI continuation launch was denied local IPC before executing the
driver. A following command found no state and made no connection. The
empty directory was removed, then the direct Node runner created the
continuation and ran the case. No host write was repeated because of these
local launch errors.

## Current state and next step

Bitwig 6.1.4 retains the normal E319 profile and initialization. The project
is `gn-upgrade-audit`, stopped at the admitted stages. Six owned tracks
remain. The single track again has two Samplers because the corrected edit
is awaiting export and reversal. The multi track retains its original
Sampler. Complete fixture restoration was proved immediately before the
corrected edit; the driver retains the independent post-edit reads.

Finish the single and multi export checkpoints, then the remaining selection,
group, project-switch, save/reopen, listening, and cleanup checks from the
[driver guide](../../plan/phase-9/9b-update-audit-driver.md). Keep all prior
failures, recoveries, exports, and continuation proofs. General acceptance
and the separate 9b.6 Grid doctor remain pending.
