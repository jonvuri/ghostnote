---
title: E340 — Second guarded Grid doctor pass on 6.1.4: breadth cases pass, disposal guard refuses
kind: evidence
state: active
updated: 2026-10-23
owner: phase-9b
---

# E340 — Second guarded Grid doctor pass on 6.1.4: breadth cases pass, disposal guard refuses

## Result

Session 9b.6i confirms the recovered baseline, rehearses the read paths,
deploys the complete `GridBreadthRules.Runtime` fix, and runs one second
guarded doctor pass on Bitwig 6.1.4 under an explicit exception to the
one-attempt rule ([D52](../../decisions/d52-grid-upgrade-admission-policy.md)).
The **boolean and mapping cases pass completely** with the entry guards and
paired independent readback; the mapping restoration passes for the first
time on 6.1.4. The **core case passes 5 of 12 commands** (value set and
restore, cable connect and disconnect, factory create with 77 owned
objects). The disposal entry guard then **refuses before the native
disposal**: the fresh Amplify's owned tree holds one object of class `wKx`,
which is not in the pinned 33-class set. No disposal ran. The 6.1.4 doctor
result is **incomplete**; no acceptance cache exists. The operator restarted
Bitwig and reopened the saved `gn-grid-spike`; the read-only check after
the restart agrees with the check before the pass.

Fingerprint:
`5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f:35778607:1790948299000000000`.
Candidate, selector, and guard hashes are unchanged from
[E339](e339-grid-doctor-614-guarded-attempt.md). The evidence root is
[`614-second-pass/`](../data/phase9b-doctor/614-second-pass/).

## Preparation

**Offline rule tests.** The Java doctor harness replays the E339 attempt-6
captures through `GridBreadthProtocol` with the runtime names resolved from
the installed jar (`RuU`, `xMq`): the boolean captures pass all stages, the
mapping stage-0 pair and the inspection snapshot pass as the stage-1
readback, and the 6.0.6 pin refuses the same captures with the attempt-6
failure. The harness runs 108 checks (101 in E339). The TypeScript rules
check the same captures (`validateSnapshot`). The archive is unchanged by
the harness change: a clean rebuild reproduces SHA-256
`c08544cd3486543aeb17735cc48423104ff2740321070c7283f8f500b303bcf8`.

**Second-pass policy.** The V21 driver gains
`--second-pass-after-uncertain-write <attempt-6 evidence>` with its own
consent string, policy `9b.6i-second-pass-after-uncertain-write-v1`, and
record `<key>.second-pass.attempt.json`. Admission requires no cache, no
second-pass record, the six 9b.6h records byte-equal to their committed
copies under [`prior-attempts/`](../data/phase9b-doctor/614-second-pass/prior-attempts/),
the sixth record naming the attempt-6 evidence, exactly the three E339
command receipts with the retained scratch track and one inspection, and a
host start (`rig.stats`) after the sixth attempt. The retry policy refuses
the six records (`refused-preflight-limit`). The host bind keeps its pinned
consent token; the record stores the operator's answer and the token.
Timing rows now carry the E339 attempt-6 column.

**Baseline check.** [`phase9b-grid-doctor-614-baseline.ts`](../../../brain/src/probes/phase9b-grid-doctor-614-baseline.ts)
repeats the E339 recovery check as a committed, read-only driver (39 calls)
and compares with a prior check. [`baseline-check/`](../data/phase9b-doctor/614-second-pass/baseline-check/)
agrees with the E339 recovery check: `gn-grid-spike` with only
`grid-probe` (muted), `FX 1`, and `Master`; one Poly Grid; the control pair
matches normalized E276 (four modules, two cables); no scratch, bind, lock,
or foreign owner; doctor phase 0, unused. The comparison excludes the
selection counters and the module and cable `uuid` values, which restart
with each extension instance or project load; the first two
post-replacement and post-restart runs recorded those false differences
([`baseline-check-after-replacement/`](../data/phase9b-doctor/614-second-pass/baseline-check-after-replacement/),
[`recovery/baseline-check/`](../data/phase9b-doctor/614-second-pass/recovery/baseline-check/)).

**Rehearsal.** With the operator's scratch consent on the installed E339
build, [`phase9b-grid-doctor-614-rehearsal.ts`](../../../brain/src/probes/phase9b-grid-doctor-614-rehearsal.ts)
ran the control read before and after and one survey read of each fixture
on its own muted scratch track ([`rehearsal/`](../data/phase9b-doctor/614-second-pass/rehearsal/):
562 calls, 16.0 s wire, three scratch tracks removed, `after` equals
`before`). The baseline preset agrees (4 modules, 2 cables). WT Parkour and
SEMtex read as `incomplete-read-recorded` under the survey's own caps
(`schema-work-or-time-limit`, `unsupported-value`, 5 captures each), as in
E302; both pairs agree and no pinned name refused.

**Deployment.** [`deployment.txt`](../data/phase9b-doctor/614-second-pass/deployment.txt):
`copyProbeExtension` deployed `c08544cd…bcf8` (858,498 bytes), equal to the
E339 built copy and to a clean rebuild; bundled resources unchanged. After
the operator's full controller replacement, [`hello.txt`](../data/phase9b-doctor/614-second-pass/hello.txt)
passes: `phase-8-probe-v1`, 118 methods, hash `2e939035ea90b8b0`, marker
`9b-grid-doctor-v21` on all handlers, fresh initialization
`2026-10-23T13:22:28.130Z`. The baseline check passed again
([`baseline-check-after-replacement-2/`](../data/phase9b-doctor/614-second-pass/baseline-check-after-replacement-2/)).
No probe driver or established bridge client existed
([`preflight/`](../data/phase9b-doctor/614-second-pass/preflight/)).

## Live pass

The operator saved first and answered with the exact second-pass consent.
The driver created the second-pass record at `2026-10-23T13:24:40.821Z`
with the six prior hashes and `hostStartedMs` 1792761748130
([copy](../data/phase9b-doctor/614-second-pass/second-pass-attempt-record.json)).
Evidence: [`live-v21-second-pass/`](../data/phase9b-doctor/614-second-pass/live-v21-second-pass/)
(435 calls, 11.6 s wire).

| Case | Result |
| --- | --- |
| Boolean (WT Parkour) | Enable and restore pass; all seven guard checks true on both commands; three independent pairs agree; cancelled nothing; released. |
| Mapping (SEMtex) | Removal and restoration pass; the restored mapping and reference identities are new; normalized readback equals the baseline; released. |
| Core (baseline preset) | `value-set`, `value-restore`, `cable-connect`, `cable-disconnect`, and `factory-create` pass with paired readback. The detached Amplify has 77 owned objects (E316: 77). The `factory-dispose` entry guard refuses: `doctor-owned-tree-class:wKx`. |

The refusal is inside `GridDoctorHost` before `factory.dispose`: the
ownership pass found the same 77 objects, then the exact-class check met
`wKx`. The protocol locked, the driver inspected once, and no command was
repeated. The inspection equals the stage-5 reads: the graph and witness
are unchanged, the detached module is present, nothing is disposed. The
`nativeCommands` diagnostic reads 6 because the counter increments at
command entry; `completed` stays 5. The scratch track
`gn-9b-write-0912c91e-20ac-4064-a7fd-96668b522acc` and the detached module
stayed until the restart.

**`wKx`.** Read from the jar as data: `wKx extends v1U implements f1h`, a
settings-value class built by static factories (`wKx.cfM(String, nyh)`).
No owned-tree class declares a field of that type. Two ancestors of
owned classes reference it: `rce` (ancestor of `Hgx`) creates one in its
init method `bl_()`, and `BVs` (ancestor of the managed class `hpW`) casts
to it in `Txc()`. The checkpoint-17 collection conditions that produced the
33-class set did not include this ancestor-created object. Its 6.0.6
counterpart and its disposal body are not traced here.

## Measurements

Per-command samples, one each
([`timing-comparison.json`](../data/phase9b-doctor/614-second-pass/live-v21-second-pass/timing-comparison.json),
written by the session; the driver writes it only on a complete pass):

| Command | 9b.6i ms | E316 ms | Change | E339 ms | Change |
| --- | ---: | ---: | ---: | ---: | ---: |
| Boolean enable | 2.044 | 1.262 | +62.1% | 1.593 | +28.3% |
| Boolean restore | 0.242 | 0.256 | −5.7% | 0.237 | +2.0% |
| Mapping removal | 13.952 | 19.897 | −29.9% | 4.078 | +242.2% |
| Mapping restoration | 19.540 | 12.892 | +51.6% | — | — |
| Value set | 2.506 | 3.122 | −19.7% | — | — |
| Value restore | 1.385 | 0.642 | +115.8% | — | — |
| Cable connect | 4.787 | 3.419 | +40.0% | — | — |
| Cable disconnect | 1.205 | 1.311 | −8.1% | — | — |
| Detached factory | 1.793 | 2.655 | −32.5% | — | — |

Entry guards: 0.468 ms on the first command, then 0.013–0.123 ms. Document
tasks: boolean enable 4.30 ms, mapping removal 25.21 ms, mapping
restoration 22.61 ms, value restore 7.16 ms, cable connect 8.75 ms. Six
samples exceed the 20 percent threshold against E316 and two against E339;
no cause is established, host state and timing noise are not separated,
and no command was repeated for timing. All admitted bounds held.

## Recovery and final state

The operator quit Bitwig without saving, restarted, and reopened the saved
`gn-grid-spike`. [`recovery/hello.txt`](../data/phase9b-doctor/614-second-pass/recovery/hello.txt)
passes with fresh initialization `2026-10-23T13:54:52.195Z`.
[`recovery/baseline-check-2/`](../data/phase9b-doctor/614-second-pass/recovery/baseline-check-2/)
confirms the baseline and agrees with the pre-pass check (39 calls). The
saved-file identity was not tested. Claims from the pass do not survive the
restart.

[`preservation.json`](../data/phase9b-doctor/614-second-pass/preservation.json)
(`grid_doctor.preservation`): 223 of 224 entry-inventory files unchanged;
the one difference is the deployed archive. The six 9b.6h records and the
three 6.0.6 records are byte-equal to their committed copies. The local
attempt directory now holds seven 6.1.4 records.

## Verification

- TypeScript: `tsc --noEmit` clean; the driver and baseline test files add
  five tests; the full suite passes ([`typescript-tests.txt`](../data/phase9b-doctor/614-second-pass/typescript-tests.txt)).
- Java: `./gradlew check` passes; `gridDoctorTest` runs 108 checks.
- Live: hello after replacement and after restart; baseline checks before
  the pass, after replacement, and after restart.

## Limits

- No 6.1.4 acceptance, cache, or product write authority. The disposal,
  delete, document Undo, attachment, and edit-counter roles are untested on
  6.1.4; the first guarded disposal refused.
- The owned-tree class set is incomplete for 6.1.4 by at least `wKx`. The
  set must be re-derived with ancestor init methods or a runtime class
  census before any third pass; the disposal body of `wKx` is untraced.
- Seven attempt records exist for this fingerprint. The driver refuses a
  retry and a second second-pass; a third pass needs its own policy,
  consent, and plan entry.
- The timing increases have no established cause.

## Retrospective

The exact-class owned-tree guard did its job: it refused before the
command and left a certain state. The lesson is in the guard's derivation:
a static collection of owned classes must follow ancestor init methods and
static factories, or be checked against a runtime class census from a
read-only pass, before it is pinned. Read-only and consent questions to the
operator were sent one per turn after a client issue hid a question that
was followed by other tool calls in the same turn.
