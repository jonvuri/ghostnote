---
title: E339 — Guarded Grid doctor on 6.1.4: preparation and first attempt
kind: evidence
state: active
updated: 2026-10-23
owner: phase-9b
---

# E339 — Guarded Grid doctor on 6.1.4: preparation and first attempt

## Result

Session 9b.6h prepares the guarded doctor under
[D52](../../decisions/d52-grid-upgrade-admission-policy.md) and runs it on
Bitwig 6.1.4. The body-change report, the changed-body decisions, the
runtime entry guards, the V21 driver, and the V21 probe are complete and
tested. The live result is **incomplete**: the boolean case passes with the
guards; the mapping removal ran once as an uncertain write; the core case
did not run. No acceptance cache exists for 6.1.4. The operator restarted
Bitwig and reopened the saved `gn-grid-spike`; the read-only baseline check
passes. Session [9b.6i](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6i--recovered-baseline-and-second-guarded-pass)
owns the second pass. Step 2 stays open.

Fingerprint:
`5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f:35778607:1790948299000000000`.
Selector SHA-256 (6.1.4 variant):
`0739d6dd3ab19ab42a6ede124ada8d1d5107eb2afd19c7ce37e71abbc9759853`.
Candidate SHA-256 `e47612953f89745b4e09357e7d2dcdf54ffe230ace648d3a53e40411321b5a23`;
guards SHA-256 `92100a9c2e4ef873aacf9e5c5589b96ccfaddf7a188042197714ab671a13dbf5`.
The evidence root is [`614-guarded/`](../data/phase9b-doctor/614-guarded/).

## Offline preparation (items 1–4)

**Body-change report.** [`body-change.json`](../data/phase9b-doctor/614-guarded/body-change.json)
compares the 76 role bodies and 71 traced callee bodies between the two
jars as data. Roles: 57 same bodies, 16 fields unchanged, 2 changed bodies
(`disposal` appends the tracking tail call; `members` uses
`Collections.emptyList()`), 1 access change (`journal-recording-edit`,
private to package). Callees: 63 same, 6 changed (validation observer
notification, pending-add assertion block, listener removal storage and mode
check, three relationship hooks with helper bookkeeping), 2 new-only (the
disposal tail class and the history helper class). All 65 stored label
parities of checkpoint 17 are reproduced. The `managed-id` body compares
equal under the explicit dynamic contract. Run: 10,290 ms, 341.2 MiB.

**Decisions.** [`decisions.json`](../data/phase9b-doctor/614-guarded/decisions.json)
answers the D52 question for each changed body. Three changes are the same
operation (members, recording access, pending-add). The others add a
conditional queue drain, a mode check, helper bookkeeping, or an observer
notification; each maps to a guard or a timed live step.

**Candidate and guards.** [`guarded_candidate.py`](../../../brain/src/probes/grid_doctor/guarded_candidate.py)
rebuilds the 6.1.4 table from the resolved checkpoint-2 symbol table, applies
the one traced selector variant, revalidates all 55 types and 76 members
against the jar, and verifies every guard pin from
[`guard-plan.json`](../data/phase9b-doctor/614-guarded/guard-plan.json):
the readers, writers, and list calls of the three edit-document fields, the
static writers of the two tracking flags (only their own enable and disable
methods), the disposal body's static call to the tail, the project-document
subclass pinned by the journal field, and the 33 owned-tree classes with one
managed class. Scan: 5,295 ms, 187.6 MiB. Resources: 28,052, 49,832, and
8,762 bytes.

**Runtime guards.** [`GridDoctorGuards`](../../../extension/src/main/java/com/ghostnote/extension/GridDoctorGuards.java)
validates the resource provenance and runs the read-only entry guard before
every native command in both the core host and the breadth host: project
document class, same manager, empty helper list, null pending helper, empty
pending list, and both tracking flags false. Before disposal it runs one
extra ownership pass and the exact-class, single-managed-node, and depth
checks. Receipts carry `guards` with each check and `guardNanos`. The
breadth fixture rules and the shared snapshot rules now take the resolved
runtime class names (`GridBreadthRules.Runtime`, `fixtureRuntime`). Survey
and legacy read operations use the validated doctor table on a jar other
than 6.0.6 (`GridReadSymbols.forReads`); research write paths keep the
6.0.6 pin and refuse. The control comparison ignores build-specific
obfuscated names.

**Driver.** [`phase9b-grid-doctor-614.ts`](../../../brain/src/probes/phase9b-grid-doctor-614.ts)
(V21, marker `9b-grid-doctor-v21`) requires host version 6.1.4, the local
resource hashes in the prepared status, the guard receipts, the old 6.0.6
records byte-equal to their committed copies, and a first-attempt record with
exclusive creation. It admits a numbered retry only when every prior record
proves no native command, at most six attempts, with a second fixed consent
string. V20 and its records stay unchanged.

## Verification

- Python: 448 offline tests pass, 31 skipped (`python-tests.log`); the new
  modules add 10 tests.
- TypeScript: `tsc --noEmit` clean; 2,461 tests pass (`typescript-tests-6.txt`).
- Java: `./gradlew check` passes; the doctor harness runs 101 checks on
  the installed jar, including 13 guard resource refusals.
- Deployments: four probe archives in [`deployment.txt`](../data/phase9b-doctor/614-guarded/deployment.txt);
  the last deployed is `4c2e738166473f15310fbf62e0e024e9f6f602bfad2d25733e3b16d7ea05d98a`
  (858,389 bytes). The complete rule fix is built but not deployed:
  `c08544cd3486543aeb17735cc48423104ff2740321070c7283f8f500b303bcf8`
  (copy in `/tmp/gn-9b6h-probe-built-5.bwextension`).
- Hello after each replacement: `phase-8-probe-v1`, 118 methods, hash
  `2e939035ea90b8b0`, marker v21 on all handlers, fresh initialization.

## Live attempts

The operator replaced the controller five times and gave the stated consent
before each attempt. All records are under `.local/grid-doctor/` with key
`d0d92c1e…c101`; each attempt directory is `live-v21*` in the evidence root.

| Attempt | Stopped at | Native commands | Cause and fix |
| --- | --- | ---: | --- |
| 1 | control read `bind` | 0 | Legacy reader pinned to the 6.0.6 jar; `forReads` fallback |
| 2 | control read `bind` | 0 | Survey handler had its own pin; same fallback |
| 3 | control comparison | 0 | Driver compared obfuscated names; normalized |
| 4 | boolean first read | 0 | `GridBreadthRules` literal `QY`; `Runtime` parameter |
| 5 | boolean first read (driver) | 0 | `phase9b-grid-writes` literal `QY`; `fixtureRuntime` |
| 6 | mapping paired readback | 3 | `compareFixture` default runtime; fixed offline, not deployed |

Attempts 1–5 created no doctor bind or scratch write except 4 and 5, which
bound the boolean scratch case, refused on its first read, cancelled, and
deleted the scratch track with verified readback; `after` equalled `before`
each time. Attempt 6: the boolean case passed both commands with all guards
true and paired readback; the mapping case passed its entry guard and ran
`mapping-remove` (receipt returned, 4.078 ms), then the first independent
read refused in the last pinned rule. The protocol locked, the driver
inspected once, and no command was repeated. The inspection read shows the
exact stage-1 removal transform and an unchanged witness; that is one host
read, not the paired readback, so the removal remains an uncertain write.
The scratch track `gn-9b-write-cd22e865-c44b-4845-b93a-3d4e744a8de3` stayed.

Per-call samples (one each): boolean enable 1.593 ms (E316 1.262 ms,
+26.2 percent), boolean restore 0.237 ms, mapping removal 4.078 ms (E316
19.897 ms, −79.5 percent). First entry guard 2.058 ms cold, then
0.013–0.014 ms. Document tasks 9.26, 1.07, and 6.76 ms; queue time at most
0.53 ms; descriptor work 791 and 1,567 as in E316. No cause is established
for the changes. See the [ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#9b6h-guarded-doctor-on-614--model-before-implementation).

## Recovery and final state

The operator restarted Bitwig and reopened the saved `gn-grid-spike`
without saving the scratch state. [`recovery/`](../data/phase9b-doctor/614-guarded/recovery/)
records hello (fresh initialization `2026-10-23T04:09:14.066Z`, bridge PID
99464, probe profile) and a 35-call read-only check: project
`gn-grid-spike` on 6.1.4; only `grid-probe`, `FX 1`, and `Master`;
`grid-probe` muted; mixer channel `c784d25c…`; no scratch track; probe
status unbound, unlocked, no foreign owner; doctor phase 0, unused, not
failed; one control read pair agrees with the normalized E276 control (four
modules, two cables, paired). The transport was reported stopped. Saved-file
identity was not tested. Claims from the attempts do not survive the
restart.

[`preservation.json`](../data/phase9b-doctor/614-guarded/preservation.json):
223 of the 224 entry-inventory files are unchanged; the one difference is the
deployed extension archive, replaced on purpose. The three 6.0.6 records are
byte-equal to their committed copies. The V20 driver, selectors, candidate,
and all prior evidence are unchanged.

## Limits

- No 6.1.4 acceptance, cache, or product write authority. Mapping
  restoration and all core roles are untested on 6.1.4.
- The guards read one instant; stability between the guard and the command
  is not proved. The replay-worker hang, the global listener monitor, the
  validation observer fan-out, and the cold first factory call remain
  measured or untested limits.
- The six attempt records are retained. The driver refuses a seventh; a
  new pass needs an explicit session policy and fresh consent.

## Retrospective

Exercise every read-only path on the new build before asking for scratch
consent: the control read, the survey read of each fixture preset, and the
driver's own comparisons against the saved captures. Grep every rule and
driver file for literal obfuscated names before deployment; five of the six
refusals were such literals outside the resolved table, and each cost a
controller replacement. Add the read-only rehearsal to the plan of the next
live session.
