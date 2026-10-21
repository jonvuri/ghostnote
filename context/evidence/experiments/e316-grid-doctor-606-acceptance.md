---
title: E316 — Grid doctor passes on 6.0.6
kind: evidence
state: active
updated: 2026-10-20
owner: phase-9b
---

# E316 — Grid doctor passes on 6.0.6

## Result

The authorized V20 scratch doctor passes on Bitwig 6.0.6. All three cases,
76 member-role checks, both Undo stages, final edit-counter validation,
scratch teardown, and preserved-state checks pass. Session 9b.5, including
the 9b.5b revised live pass, is complete. This accepts the research doctor
for the exact tested jar fingerprint and fixed fixtures. It does not grant
product write authority or cross-build acceptance.

The [acceptance record](../data/phase9b-doctor/live-v20/accepted.json)
is byte-for-byte equal to the local accepted cache. Its completion time is
`2026-10-21T04:39:45.945Z`. The driver creates it only after all cases,
scratch removal, final control reads, full state comparison, and clean
doctor status. Both the original failed attempt and the
[separate V20 attempt](../data/phase9b-doctor/live-v20/attempt-record.json)
remain intact. No command or pass is repeated.

Fingerprint:
`382c655d0b9e8db6bd433dc6100ef3a4ee23abf6a6615f79c40f0c2645792c93:34686665:1777550247000000000`.
Selector SHA-256:
`151ebb81d946d1ffc5c281a04f7cd1d3a4442c754f601a7c04e84aa485171d99`.

## Preconditions and runtime

The operator confirmed full controller replacement and consented to one
revised full scratch pass. That answer includes the stated save-first,
possible-restart, and boolean/mapping-repeat scope. The
[hello check](../data/phase9b-doctor/v20-live-preflight/hello.txt) passes:
`phase-8-probe-v1`, 118 methods, hash `2e939035ea90b8b0`, and marker
`9b-grid-doctor-v20` on all direct handlers and `rig.info`.
Initialization is `2026-10-21T04:38:35.619Z` (October 20 local time).
Bridge PID: 42943. The archive is E315's verified deployed archive,
SHA-256 `9627bb8d23587de365aee75ae0703e81b32c71faeb5eb13c29e8dec791b0d481`.

The preflight [process](../data/phase9b-doctor/v20-live-preflight/processes.txt)
and [socket](../data/phase9b-doctor/v20-live-preflight/sockets.txt) checks find
no competing driver or established bridge client. The driver verifies
project, target, and selection before scratch setup. Native guards require
stopped transport and muted scratch tracks. The native witnesses report
an active engine and preserved connection identity. No engine or transport
command is sent.

## Live acceptance

| Stage | Result |
| --- | --- |
| Read sentinel | Complete descriptor schemas, IDs, names, serializer-filter results, relationship shapes, and stable bound identities pass. |
| Boolean | Enable and restore pass on fresh WT Parkour scratch. Three independent pairs agree. |
| Mapping | Remove and restore pass on fresh SEMtex scratch. Three pairs agree. New mapping/reference identities satisfy the existing semantic restoration checks. |
| Value and cable | Set/restore and connect/disconnect pass on the new baseline scratch. Exact graph and witness restoration pass. |
| Detached factory | A fresh Amplify has the expected defaults and 77 owned objects. Paired reads and disposal checks pass. |
| Connected delete and Undo | Deletion removes the spare and its incoming edge. The document Undo guard passes. Two independent reads restore the exact connected graph and witness. |
| Attachment and Undo | The owned transaction adds one Amplify. Exact attachment readback passes. Document Undo returns to the expected prior head, and two reads restore the original graph and witness. |
| Edit counters, last | Frames and instant edits follow 0 → 1 → 0. Long edits and lock counts stay zero. The lock set stays null. The same owned edit survives association, insertion, and close checks. |
| Teardown | All three scratch tracks are removed. Control, tracks, mixer, complete device banks, and selection match the entry baseline. All claims are released and unlocked. |

The [report](../data/phase9b-doctor/live-v20/report.json) contains all case
results and measurements. The two Undo receipts record successful document
context checks; they are followed by separate descriptor pairs. No receipt
is used as graph readback. The [capture validation](../data/phase9b-doctor/live-v20/capture-validation.json)
rechecks 19 independent pairs, all 12 breadth snapshots, the restored core
graphs, four normalized control reads, and the final counter trace. All
51 evidence checks pass.

The [capture archive](../data/phase9b-doctor/live-v20/captures.zip) preserves
80 exact JSON files: 38 doctor reads, four control reads, and 38 control
schema results. Each byte is checked before the loose file is removed.
The [manifest](../data/phase9b-doctor/live-v20/capture-manifest.json) records
sizes and SHA-256 hashes. The [call log](../data/phase9b-doctor/live-v20/calls.json.gz)
passes an exact compression round trip.

## Final state

The [entry](../data/phase9b-doctor/live-v20/before.json) and
[exit](../data/phase9b-doctor/live-v20/after.json) snapshots are equal and
match E314's recovered baseline. Project: `gn-grid-spike`. Only `grid-probe`,
`FX 1`, and `Master` remain. `grid-probe` is selected, muted, and at -10 dB.
Its two control pairs match normalized E276: four modules and two cables.
No doctor write targets the control track.

A separate [read-only check](../data/phase9b-doctor/live-v20/final-read-only.json)
after driver disconnect confirms the three tracks, original mixer fields,
preserved selection, and clean reader/breadth/doctor status. It sends seven
read requests. The doctor is phase 3, used, released, and not failed. No
claim is bound, busy, locked, timeout-locked, unfinished, or foreign-owned.
The final [socket check](../data/phase9b-doctor/live-v20/exit-sockets.txt)
shows only the Bitwig listener. No competing probe driver remains.

No save, engine, transport, restart, or controller command is sent. Saved-file
identity and the UI save marker are not tested. This is an in-memory baseline
check; no saved-fixture persistence claim is made. The normal profile is
not restored. Claims and managed native IDs do not transfer to another
session. Public tool descriptions remain v52.

## Measurements and limits

The driver sends 542 calls and returns 1,671,828 successful-response bytes.
Summed wire time is 15,080.174 ms. The interval from durable attempt creation
to cache creation is 16,248 ms; this excludes earlier preflight work.
Runtime metadata validation takes 37.818 ms. The E315 offline scan and
resource measurements still apply. No resolver scan is repeated here.

The successful plan uses exactly 16 native command requests, 38 independent
read requests, and three binds: 57 doctor document tasks. All tasks return
timing receipts. Document work totals 229.244 ms; its maximum is 28.944 ms.
Maximum queue time is 2.294 ms. Core graph/query work ranges are
235–321/1,379–1,833. Core snapshot time is 1.035–5.362 ms. Boolean descriptor
work is 791; mapping descriptor work is 1,517–1,567. Whole-JVM heap samples
peak at 1,148 MiB. The largest positive per-task heap delta is 8 MiB.
These are heap samples, not retained allocation or process RSS measurements.

Selected native-command samples:

| Command | V19 ms | V20 ms | Change |
| --- | ---: | ---: | ---: |
| Boolean enable | 2.087 | 1.262 | -39.6% |
| Mapping removal | 10.565 | 19.897 | +88.3% |
| Mapping restoration | 17.708 | 12.892 | -27.2% |
| Detached factory | 1.480 | 2.655 | +79.4% |
| Detached disposal | 0.447 | 0.550 | +23.3% |
| Delete Undo | Failed; no receipt | 3.984 | No comparable success |
| Attachment | Not reached | 21.660 | New sample |
| Attachment Undo | Not reached | 1.039 | New sample |

The report preserves all 16 per-command samples. Mapping removal, detached
factory, and disposal exceed the 20-percent comparison threshold. The V20
change does not alter those native command bodies; its core witness adds
two getters outside their command timer. That does not establish a cause
for the increases. Each command has one sample per pass, and host state and
timing noise are not separated. Mapping restoration is faster than V19 but
still slower than E308's 8.196 ms sample. These remain research latency
limits for 9b.6 comparison. The one-pass authorization is not extended for
timing repeats. All samples remain within the declared task and traversal
bounds. Product call budgets and latency claims do not change.

Acceptance is limited to the tested fixed fixtures, projection, command
sequence, and exact 6.0.6 fingerprint. E310's resource, outer-modulator,
Gates-attachment, flavour, scale, and non-boolean-write limits remain.
No additional 9a audio or unrelated breadth test runs. Step 2 still needs
the separate [9b.6 test](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6--doctor-on-61x)
after the operator's general update audit, with 6.0.6 copied aside. Product
cache enforcement belongs to 9b.7.
