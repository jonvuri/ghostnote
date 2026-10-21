---
title: E314 — Grid doctor recovery after restart
kind: evidence
state: active
updated: 2026-10-20
owner: phase-9b
---

# E314 — Grid doctor recovery after restart

## Result

The operator restarted Bitwig and reopened `gn-grid-spike` after the
[E313](e313-grid-doctor-undo-failure.md) failure. Recovery checks pass.
No scratch track remains. Tracks, mixer fields, complete device banks,
and selection match E313's entry and E310's baseline. Two independent
control reads agree and match normalized E276: four modules and two cables.
All reader and writer status checks are unbound and unlocked.

The [recovery report](../data/phase9b-doctor/recovery-v19/report.json)
records the comparisons. The [before](../data/phase9b-doctor/recovery-v19/before.json)
and [after](../data/phase9b-doctor/recovery-v19/after.json) snapshots are
equal. `grid-probe` remains selected, muted, and at -10 dB. FX 1 and Master
are back at indices 1 and 2. Their device banks are empty. The Grid reader
uses a new claim and releases it after the independent pair and schema
reads. No old doctor claim is reused or released.

This result verifies recovery only. V19's Undo implementation is unchanged.
The doctor has no complete live acceptance. The durable attempt file is
byte-for-byte equal to E313's saved copy. It still prevents an automatic
second pass. No accepted-build cache exists.

## Runtime and verification

The [hello check](../data/phase9b-doctor/recovery-v19/hello.txt) passes:
`phase-8-probe-v1`, 118 methods, hash `2e939035ea90b8b0`, and marker
`9b-grid-doctor-v19` on all direct handlers and `rig.info`.
Initialization is `2026-10-21T04:23:02.366Z` (October 20 local time).
The bridge PID is 42943. The
[process check](../data/phase9b-doctor/recovery-v19/processes.txt) and
[socket check](../data/phase9b-doctor/recovery-v19/sockets.txt) show no
competing probe driver or established bridge client before verification.
The E312 archive remains deployed. No build or deployment runs.

The [final status](../data/phase9b-doctor/recovery-v19/final-status.json)
shows no busy, locked, timeout-locked, unfinished, or foreign-owned probe.
The new doctor state is phase 0, unused, and not failed. No `doctorPrepare`,
`doctorBind`, native write, Undo, scratch creation, scratch deletion,
transport, engine, or save command is sent. Only read requests and the
existing cursor/read-claim operations run. The verification does not test
engine state, transport state, saved-file identity, or the UI save marker.
The normal profile is not restored.

The [control archive](../data/phase9b-doctor/recovery-v19/control-captures.zip)
contains 19 schema results and two independent graph reads. Each archived
byte matches its original before the loose file is removed. The
[manifest](../data/phase9b-doctor/recovery-v19/capture-manifest.json) records
all 21 sizes and SHA-256 hashes. The
[summary](../data/phase9b-doctor/recovery-v19/control-summary.json) records
the graph result and measurement scope. Instance UUIDs and managed IDs
use the existing control normalization; other projected fields must match.
Omitted fields and outer-device modulators are outside this check.

## Cost and continuation

The recovery driver sends 64 calls. Summed wire time is 2,049.551 ms;
elapsed time is 2,577.793 ms; successful responses total 155,016 bytes.
These figures exclude the separate hello check. Both control reads use
1,606 query-work units and 278 graph-work units. Document times are
6.788 and 3.127 ms. Heap deltas are 2 and 0 MiB. This reuses the bounded
survey read path and its existing performance model. It adds no product
host calls or admitted limits. No write is repeated for measurement.

Recovery steps 1 and 2 of
[9b.5a](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b5a--recover-and-trace-the-undo-caller)
are complete. Continue with the offline supported-Undo caller trace and
the recording-edit and exception contracts. A revised live pass remains
a separate, explicitly authorized action. Public descriptions remain v52.
