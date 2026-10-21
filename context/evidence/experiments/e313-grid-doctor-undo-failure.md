---
title: E313 — Grid doctor stops at native Undo
kind: evidence
state: active
updated: 2026-10-20
owner: phase-9b
---

# E313 — Grid doctor stops at native Undo

## Result

The authorized V19 doctor pass fails at `undo-delete`. Bitwig 6.0.6 is not
accepted. No accepted-build cache exists. The driver does not retry the
command or remove the uncertain fixture. The doctor remains bound and
locked. Session 9b.5 requires recovery and a complete Undo caller trace.

The operator confirmed controller replacement and consented to the full
scratch doctor, including the boolean and mapping cases. The
[hello check](../data/phase9b-doctor/hello-v19.txt) passes: profile
`phase-8-probe-v1`, 118 methods, hash `2e939035ea90b8b0`, and marker
`9b-grid-doctor-v19` on all three direct handlers and `rig.info`.
Initialization is `2026-10-21T04:07:41.553Z` (October 20 local time).
The archive is the E312 archive. Before the pass, process and socket checks
find no competing driver or established bridge client. The driver checks
the project, selection, target identities, and complete track bank.

The [report](../data/phase9b-doctor/live-v19/report.json) records 445 wire
calls and 13 native command attempts. Twelve commands return and pass their
independent read pairs. The thirteenth command throws. The driver exits
with status 1. The [attempt record](../data/phase9b-doctor/attempt-record.json)
remains in `.local/grid-doctor/`. It prevents an automatic second pass.

## Live checks

| Case | Result |
| --- | --- |
| Boolean | Enable and restore pass. All three independent read pairs pass. The claim is released and the scratch track is removed. |
| Mapping | Remove and restore pass. All three pairs pass. Restoration creates new mapping and reference IDs, as required. The semantic fields and unrelated state match. The claim is released and the scratch track is removed. |
| Core value | Set and restore pass. The restored graph and witness equal the initial state. |
| Core cable | Connect and disconnect pass. The restored graph and witness equal the initial state. |
| Detached factory | Amplify creation, 77-object ownership, defaults, and disposal pass. The attached graph stays equal to the initial state. |
| Connected delete | Connect the spare input, then delete the spare Amplify. Both commands pass their paired readbacks. Three modules remain. |
| Delete Undo | The exact-head and availability guards admit one call. The native journal throws while it tries to restore the module. No restoration is proved. |
| Remaining core stages | Cable removal, attachment, attachment Undo, and the final edit-counter trace are not reached. |
| Complete acceptance | Fails. Core role coverage and teardown are incomplete. No product write authority is granted. |

The sentinel and core witness checks run before the completed stages. They
check the descriptor schema, document identity, module relationships,
selection, layout, idle edit state, and engine connection identity. The
engine is active. These partial results do not accept all 72 roles. The
idle counter values do not replace the final owned-edit counter trace.

The [capture archive](../data/phase9b-doctor/live-v19/captures.zip) contains
51 exact JSON files: 19 control schemas, two control captures, and 30 doctor
reads. The [manifest](../data/phase9b-doctor/live-v19/capture-manifest.json)
records each file's size and SHA-256. Each archived byte is checked before
the loose copy is removed. The [call log](../data/phase9b-doctor/live-v19/calls.json.gz)
also passes an exact compression round trip. Offline checks confirm all 15
independent pairs. The [breadth validation](../data/phase9b-doctor/live-v19/breadth-validation.json)
rechecks all 12 breadth snapshots with the existing semantic validator.
The report records 38 evidence checks.

## Failure and offline trace

The [failure](../data/phase9b-doctor/live-v19/failure.json) contains the
complete exception. `daR.wi2()` calls `cZv.eJS()` for the owned delete edit.
The replay reaches the `auxiliary_devices` insertion hook. That hook tries
to invoke `cZv.eOi(...)` on a null edit object.

The [offline trace](../data/phase9b-doctor/undo-failure-trace.json) reads
`daR` bytecode from the same jar, without class initialization. It shows:

- The insertion hook calls `daR.YLA()` for the recording edit.
- `YLA()` returns field `wi2` when present, or field `NaF` otherwise.
  It does not return the undo head or the replay-head field `kG`.
- `wi2()` sets `kG`, invokes the head's undo body, and clears `kG` only
  after that body returns. It does not establish either recording edit.
- There is no exception handler around that invocation in `wi2()`.

The direct low-level journal call lacks a required recording context in
this pass. This is a doctor integration failure, not evidence that native
Undo is unsupported by Bitwig. A valid head and an availability predicate
do not prove a complete command context. The supported caller and its
begin/end and exception paths must be traced before any replacement call.
No selector is regenerated, no guard is weakened, and no second live
command is tried. A global Undo or an improvised edit wrapper is not used.

The single [failure inspection](../data/phase9b-doctor/live-v19/preset-2-inspection.json)
equals the last paired snapshot after deletion. It shows three modules,
the disposed detached tree, and an idle edit witness. This does not prove
that all internal journal state recovered. The exception path can leave
the replay-head field set. The uncertainty latch remains necessary.

## Preserved and retained state

The [final read-only capture](../data/phase9b-doctor/final-read-only.json)
checks state after the driver disconnects. It sends six read requests and
does not claim, write, release, or delete an object.

- Project: `gn-grid-spike`. Original tracks remain `grid-probe`, `FX 1`,
  and `Master`. Their mixer fields match the entry snapshot by channel ID.
  FX 1 and Master indices shift because the scratch track remains.
- `grid-probe` remains selected, muted, and at -10 dB. Its entry control
  pair matches normalized E276. No write targets it.
- Retained scratch: `gn-9b-write-969c9fda-a8c8-4e03-9417-9bf16b03c2be`,
  channel ID `dbe98766-c544-48fd-98a5-46e62d553be4`, index 1, muted.
- Doctor: phase 2, failed, used, bound, and locked. It has no running or
  unfinished native task and no timeout lock. The core attempted count is
  nine; eight commands completed. The inspection count is one.
- Final control graph, complete device banks, and full baseline comparison
  are not run because the uncertain doctor still owns the claim. Teardown
  is incomplete. Do not describe the project as restored.

No engine, transport, save, restart, or controller command is sent. The
transport is stopped at the admitted native stages. Saved-file identity
and the UI save marker are not tested. The normal profile is not restored.
Claims do not transfer to a later session.

## Measurements

The driver uses 12,051.603 ms of summed wire time and returns 1,205,337
successful-response bytes. This is not total wall time. Runtime table
validation takes 39.034 ms. The E312 scan time and resource sizes still
apply; no resolver scan is repeated for this pass.

There are 47 doctor document-task attempts: three binds, 30 independent
reads, 13 commands, and one inspection. Forty-six return timing receipts.
The failed Undo task has no timing receipt. Successful tasks sum to
240.571 ms of document work. Maximum queue time is 1.156 ms; maximum
document time is 21.828 ms. Core graph work is 235–279 and query work is
1,379–1,607 per recorded snapshot. Core snapshot time is 1.183–8.437 ms.
Heap samples peak at 978 MiB for the whole Bitwig JVM. The largest positive
per-task heap delta is 8 MiB. A later read reports 404 MiB heap use. These
samples are not retained allocation or peak RSS measurements.

Comparable E308 native-command samples show changes above 20 percent:
boolean enable 1.253 → 2.087 ms (+66.5 percent), mapping remove
4.577 → 10.565 ms (+130.8 percent), and mapping restore
8.196 → 17.708 ms (+116.1 percent). Boolean restore falls from
0.775 to 0.559 ms. The report keeps every per-call sample. The complete
doctor task adds the schema sentinel and table-based path. Those checks
do not by themselves explain the native-command time increase. Each
operation has one sample; timing noise and host state are not separated.
No uncertain write is repeated for timing. These are unresolved research
latency increases, not a product latency claim. The next integration
session must account for them before another live measurement. Public
host-call budgets and descriptions remain unchanged at v52.

## Next session and retrospective

Follow [9b.5a](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b5a--recover-and-trace-the-undo-caller).
Recover the saved project through an operator restart without saving the
failed scratch state. Verify the baseline independently after recovery.
Trace the complete supported Undo caller before changing the implementation.
Keep the durable attempt record. Another live pass needs a documented scope
and new explicit authorization; it is not an automatic retry.

The actionable lesson is to trace callers as well as a candidate command
body. For journal commands, the manifest must include the recording edit,
replay state, and exception cleanup contract. Head identity alone is not
a sufficient admission rule.
