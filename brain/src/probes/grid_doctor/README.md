# Grid doctor on 6.0.6

## Operator consent

State required actions directly: save first and keep playback stopped.
Describe the planned scratch test and the possibility of a restart. Accept
an ordinary answer such as "Saved, go ahead." Do not ask the operator to
repeat a constant from the driver. Consent constants are internal scope
tokens. Record the actual reply separately, or use `--operator-reply` on
the 6.1.4 driver. This option records evidence; it does not infer permission
from text. Existing authorization carries forward within its scope.
[D53](../../../../context/decisions/d53-ordinary-operator-consent.md)
applies to the procedures below, including their historical examples.

## Toolkit

[`toolkit.py`](toolkit.py) classifies each module as a reusable tool or a
per-build diagnostic; `test_toolkit.py` checks the classification. The
per-build diagnostics are the 9b.6 investigation glue. Their reports stay
under `context/evidence/data/phase9b-doctor/614-*` with the checkpoint
snapshots, and the recorded commands below still run.

Start a new Bitwig build with the upgrade check
([E343](../../../../context/evidence/experiments/e343-grid-admission-gate-and-upgrade-tool.md)).
Assemble the accepted build's baseline once, then check the candidate jar
into a new directory. Every stage reads class files as data. No vendor
class is initialized and no host request is sent. The result grants no
write authority; only the consent-gated doctor accepts a fingerprint.

```sh
PYTHONPATH=brain/src/probes python3 -B -m grid_doctor.upgrade baseline \
  --accepted '<the accepted cache record>' \
  --candidate-directory '<directory with candidate.json, selectors.json, optional guards.json>' \
  --census '<the owned-tree census of the accepted build>' \
  --output /absolute/new/baseline

PYTHONPATH=brain/src/probes python3 -B -m grid_doctor.upgrade check \
  --baseline /absolute/new/baseline \
  --jar '<the candidate bitwig.jar>' \
  --old-jar '<the accepted build jar, when not at its recorded path>' \
  --output /absolute/new/check
```

The verdict is `already-accepted`, `name-only-change`, `changed-bodies`,
`resolution-refused`, `input-required`, or `prepared`; `nextStep` names
the next action. After a resolver refusal, an agent trace session records
the table; rerun with `--traced-table`. The census stage needs
`--collector-report` and `--module-report`; the guards stage needs
`--guard-plan`. `--candidate-directory` reuses earlier resource bytes.

The product gate is `brain/src/grid/admission.ts`. It reads
`.local/grid-doctor/<key>.accepted.json` for the local jar fingerprint
(`GHOSTNOTE_BITWIG_JAR`, `GHOSTNOTE_GRID_DOCTOR_CACHE` override the paths)
and the connected host version. `check_grid_support` reports it. Only the
research driver writes the cache.

## Completed 6.0.6 procedure

The V20 pass is complete in
[E316](../../../../context/evidence/experiments/e316-grid-doctor-606-acceptance.md).
Keep both attempt records and the accepted cache. Do not run V20 again.
The commands below record the completed procedure. The separate 9b.6
session must adapt the pinned driver for a new fingerprint.

V20 uses the traced document Undo path. Read
[E315](../../../../context/evidence/experiments/e315-grid-doctor-document-undo.md)
and the
[9b.5b live brief](../../../../context/plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b5b--revised-v20-live-doctor).
V19 failed at native delete Undo in E313. Recovery passed in E314. Keep all
V19 evidence and the original durable attempt record.

This is a research path. A candidate table grants no write authority.
The original 69 E311 roles are unchanged. V20 adds seven doctor roles,
including the document Undo method and its context guards. The bundled
candidate and selectors are in
`context/evidence/data/phase9b-doctor/v20-preparation/`.

Resolve offline from the repository root, into a new output directory:

```sh
python3 brain/src/probes/phase9b-grid-doctor-resolve.py \
  --jar '/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar' \
  --output /absolute/new/output-directory
```

Do not overwrite prior evidence or regenerate selectors after a refusal.
Inspect the changed code and record its trace first. A changed bundled
report requires a new build and controller replacement.

The operator must fully remove the controller and add the final matching
`ghostnote probe` product in the complete list. A power toggle or an earlier
duplicate can load cached Java classes. The orange circular-arrow button
adds detected controllers; it does not reload the extension.

After replacement confirmation, run `npm run probe:hello` from `brain/`.
Require V20 on all direct handlers and `rig.info`, with a fresh initialization.
Check project, selection, target, competing drivers, and bridge clients.
The operator must save first, keep transport stopped, and consent to one
revised V20 pass on the same fingerprint, including boolean and mapping
checks. A failed check can require a restart. Do not infer this consent from
the earlier V19 answer or the instruction to prepare the correction.

After that answer, run from `brain/` with a new absolute evidence directory:

```sh
node --import tsx src/probes/phase9b-grid-doctor.ts \
  /absolute/new/evidence-directory \
  'I saved first. I consent to one revised V20 scratch doctor pass on the same fingerprint, including boolean and mapping checks. A failed check can require a Bitwig restart.'
```

The consent argument is an internal scope token. Record the actual
operator answer separately. The fixed plan
creates three new muted scratch tracks in sequence, never together.
A complete new-table acceptance requires all three cases and teardown.

The driver checks `.local/grid-doctor/<fingerprint-hash>.attempt.json`
against E313's saved original. It keeps those bytes and creates a separate
`<fingerprint-hash>.v20.attempt.json` before the first scratch write.
Exclusive creation prevents a second V20 pass. Do not remove either file
or edit the original to enable a retry. A complete pass creates the matching
`.accepted.json` only after all roles and preserved-state checks pass.
The product does not consume this cache. An uncertain native write retains
its claim and scratch state. Inspect it; do not repeat the command or delete
its fixture automatically.

## 6.1.4 offline refusal

[E331](../../../../context/evidence/experiments/e331-grid-doctor-614-resolver-refusal.md)
records 53 missing type roles and 76 blocked members. V20 remains unchanged.
Do not deploy its table for 6.1.4. Continue with
[9b.6a](../../../../context/plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6a--resolve-changed-614-structure).

Reproduce the bounded diagnosis from the repository root. The report path
must not exist. Both jars are read as data. No vendor class is initialized.
The diagnostic checks the old table against E315 before comparing builds.

```sh
PYTHONPATH=brain/src/probes python3 -m grid_doctor.diagnose \
  --old-jar '/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1/apps/Bitwig Studio 6.0.6.app/Contents/Java/bitwig.jar' \
  --new-jar '/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar' \
  --selectors context/evidence/data/phase9b-doctor/v20-preparation/selectors.json \
  --old-candidate context/evidence/data/phase9b-doctor/v20-preparation/candidate.json \
  --report /absolute/new/diagnosis.json
```

Exit zero means the diagnostic completed. It does not mean resolution
passed. Inspect `strictResolution`, `typeCensus`, and `memberCensus`.
Shallow candidates and ancestor pairs are hypotheses only. This command
cannot produce a live candidate table or write an acceptance cache.

## 6.1.4 command-contract trace

[E332](../../../../context/evidence/experiments/e332-grid-doctor-614-command-contracts.md)
records changed relationship hooks, a disposal tail call, and recording-edit
access. These changes prevent reuse of the old command contracts. The new
trace utility does not replace the complete resolver. It cannot prepare a
probe, create an attempt record, or write an acceptance cache.

Run the shared diagnostic on either target jar. The source must be the
preserved E315 jar. It validates that jar against the complete E315 table
and caller trace first. The report path must not exist.

```sh
PYTHONPATH=brain/src/probes python3 -m grid_doctor.migrate \
  --old-jar '/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1/apps/Bitwig Studio 6.0.6.app/Contents/Java/bitwig.jar' \
  --new-jar '/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar' \
  --report /absolute/new/migration.json
```

Exit zero means that the diagnostic completed. Read `result`, `reason`, and
`coverage`. A `traced-subset` result is not complete resolution. A `refused`
result with `changed-required-contracts` records a traced incompatibility.
Both results have `completeTable: false` and `writeAuthority: false`.

The method contract keeps flags, signatures, local reference identities,
literals, control flow, and exception handlers. Unrelated class members do
not contribute to the key. Cross-method bindings keep shared type and member
identities equal. They distinguish document Undo from same-shape Redo.
Missing or multiple matches cause refusal. A body-only access comparison or
disposal prefix comparison is diagnostic evidence only. Neither can select
a live member. Dynamic calls require bootstrap evidence that this utility
does not yet support; they cause refusal when required.

E333 extends these trace inputs as described below. Keep the V20 driver
unchanged.

## 6.1.4 ownership and disposal admission

[E333](../../../../context/evidence/experiments/e333-grid-doctor-614-ownership-admission.md)
records a measured refusal. Document ownership helpers scan retained history.
Global disposal tracking has debug mode writers and an uncapped queue drain.
The fixed scratch-object limit does not bound those paths. Continue with
[9b.6c](../../../../context/plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6c--establish-bounded-admission-and-complete-resolution).

Reproduce the diagnostic from the repository root. The report path must not
exist. The jar must match E332's target hash and seed traces. Explicit owner
expansions follow verified direct references; they are investigation inputs
for this jar, not reusable selectors.

```sh
PYTHONPATH=brain/src/probes python3 -B -m grid_doctor.ownership \
  --jar '/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar' \
  --seed context/evidence/data/phase9b-doctor/614-structural/migration.json \
  --expand-owner dgJ --expand-owner cQy --expand-owner cQz \
  --expand-owner eTi --expand-owner com/bitwig/ramona/core/zjj \
  --expand-owner dfb --expand-owner com/bitwig/ramona/core/oDc \
  --expand-owner com/bitwig/ramona/core/bnq \
  --report /absolute/new/trace.json
```

Exit zero means the reference scan completed. The report still has
`result: refused`, `completeTable: false`, and `writeAuthority: false`.
Read its method traces and `limitsOfEvidence`. Dynamic-call bootstrap
entries are retained as evidence; this does not add dynamic-call equivalence
to the shared resolver. The scan cannot measure the runtime tracking mode,
queue size, or document history. Do not initialize vendor classes, change
the mode, or deploy a partial table to obtain those facts.


## 6.1.4 admission boundaries

[E334](../../../../context/evidence/experiments/e334-grid-doctor-614-admission-boundaries.md)
records inherited parent getters and the queued debug tracking command.
Document history bounds and native command non-reentrancy remain unproved.
Continue with
[9b.6d](../../../../context/plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6d--complete-receiver-contracts-and-admission).

Run the offline trace from the repository root. The output path must not
exist. The utility validates E333's jar and seed methods before it uses the
explicit investigation plan. Plan names are not reusable selectors.

```sh
PYTHONPATH=brain/src/probes python3 -B -m grid_doctor.admission \
  --jar '/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar' \
  --seed context/evidence/data/phase9b-doctor/614-ownership/trace.json \
  --plan context/evidence/data/phase9b-doctor/614-admission/trace-plan.json \
  --report /absolute/new/trace.json
```

Exit zero means the diagnostic completed. It still reports `result: refused`,
`boundedAdmission: false`, `completeTable: false`, and `writeAuthority: false`.
Superclass results cover in-jar concrete class receivers. They do not prove
runtime fixture types or external subclasses. Bootstrap entries are evidence;
the shared comparator still refuses unchecked dynamic calls. No vendor
class is initialized, and no host or debug request is sent. Do not change
the tracking mode or deploy a partial table to bypass this refusal.

## 6.1.4 receiver and event contracts

[E335](../../../../context/evidence/experiments/e335-grid-doctor-614-receiver-dispatch.md)
records a descriptor predicate override, ancestor-step allocation, and a
round-trip event pump. Fixed-command exclusion and history growth remain
unproved. Continue with
[9b.6e](../../../../context/plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6e--fixture-contracts-and-command-closure).

Run the offline diagnostic from the repository root. The output path must
not exist. The utility verifies E334's jar and seed traces before it scans
the explicit plan. Plan names are investigation inputs, not role selectors.

```sh
PYTHONPATH=brain/src/probes python3 -B -m grid_doctor.receiver_trace \
  --jar '/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar' \
  --seed context/evidence/data/phase9b-doctor/614-admission/trace.json \
  --plan context/evidence/data/phase9b-doctor/614-receivers/trace-plan.json \
  --report /absolute/new/trace.json
```

Exit zero means the diagnostic completed. It still reports `result: refused`,
`completeTable: false`, `boundedAdmission: false`, and `writeAuthority: false`.
Resolved sites identify symbolic declarations. They do not select runtime
virtual targets. Unresolved references with matching signatures are reported
separately; they are not proved target callers. No vendor class is initialized,
and no host request, candidate table, attempt, or cache is produced. The
strict comparator and V20 driver remain unchanged.

## 6.1.4 complete local role census and fixture trace

[E336](../../../../context/evidence/experiments/e336-grid-doctor-614-fixture-contracts.md)
records the local census for all 76 members on both jars. It also follows
the membership call through the exact insertion-body contract. The changed
terminal getter, disposal tail, and recording-access contracts remain
refused. A local method pool is not a complete receiver or operation binding.

Run from the repository root. Each report path must not exist:

```sh
PYTHONPATH=brain/src/probes python3 -B -m grid_doctor.role_contracts \
  --old-jar '/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1/apps/Bitwig Studio 6.0.6.app/Contents/Java/bitwig.jar' \
  --new-jar '/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar' \
  --report /absolute/new/role-contracts.json

PYTHONPATH=brain/src/probes python3 -B -m grid_doctor.receiver_trace \
  --jar '/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar' \
  --seed context/evidence/data/phase9b-doctor/614-receivers/trace.json \
  --plan context/evidence/data/phase9b-doctor/614-fixtures/trace-plan.json \
  --report /absolute/new/fixture-trace.json
```

Exit zero means the diagnostic completed, not that admission passed.
The reports retain `completeTable: false` and `writeAuthority: false`.
Fields, abstract methods, and unsupported source contracts are separate
from executable method pools. A truncated pool retains its complete count
and cannot select a role. The strict comparator is unchanged.

The fixture trace reproduces E335's seed methods. Its plan contains pinned
investigation inputs, not selectors. The exact empty-array begin route
skips one lock wait. This does not close nested commands or establish
history bounds. No vendor class is initialized and no host request is sent.
Continue with
[9b.6f](../../../../context/plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6f--role-bindings-and-traced-variants).

## 6.1.4 operation bindings and variant evidence

[E337](../../../../context/evidence/experiments/e337-grid-doctor-614-operation-bindings.md)
links 36 executable role contracts, nine fields, and 25 type inputs on 6.1.4.
It traces the managed-ID supplier and its second bootstrap. Complete role
resolution and bounded admission remain refused. Continue with
[9b.6g](../../../../context/plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6g--descriptor-anchors-and-bootstrap-contracts).

Run from the repository root. The report path must not exist:

```sh
PYTHONPATH=brain/src/probes python3 -B -m grid_doctor.role_bindings \
  --old-jar '/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1/apps/Bitwig Studio 6.0.6.app/Contents/Java/bitwig.jar' \
  --new-jar '/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar' \
  --report /absolute/new/bindings.json
```

The diagnostic validates the old table and reproduces E336's censuses and
membership routes before it propagates exact operation identities. It never
selects from a truncated global pool. Fields require a linked operation,
matching access, and a matching lookup declaration. The variant traces
retain E332's disposal and recording snapshots, the membership routes,
and managed-ID bootstrap dependencies. They admit no comparator variant.

Exit zero means the diagnostic completed. It does not mean resolution or
admission passed. Read every member status, unbound type, unclosed call,
and unsupported contract. The report always has `completeTable: false`,
`boundedAdmission: false`, and `writeAuthority: false`. No vendor class is
initialized. No host call, candidate, attempt, or acceptance cache is produced.
Run large diagnostic test groups in separate processes so earlier groups'
peak RSS does not trigger a later scan's unchanged process limit.

## 6.1.4 guarded doctor (9b.6h)

[E339](../../../../context/evidence/experiments/e339-grid-doctor-614-guarded-attempt.md)
records the V21 preparation under [D52](../../../../context/decisions/d52-grid-upgrade-admission-policy.md)
and the first guarded live attempt on 6.1.4. The V20 driver and its 6.0.6
records stay pinned and unchanged. Do not run V20 again.

Prepare the 6.1.4 resources from the resolved checkpoint-2 symbol table.
The output files must not exist. Every pin in the guard plan is verified
against the jar as data; no vendor class is loaded.

```sh
PYTHONPATH=brain/src/probes python3 -B -m grid_doctor.guarded_candidate \
  --jar '/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar' \
  --symbols context/evidence/data/phase9b-doctor/614-resolution/checkpoint-2/symbols.json \
  --plan context/evidence/data/phase9b-doctor/614-guarded/guard-plan.json \
  --collector-report context/evidence/data/phase9b-doctor/614-resolution/checkpoint-17/collection-conditions-17.json \
  --output /absolute/new/output-directory
```

The body-change report compares the 76 role bodies and 71 traced callee
bodies between 6.0.6 and 6.1.4. The report path must not exist:

```sh
PYTHONPATH=brain/src/probes python3 -B -m grid_doctor.body_change \
  --old-jar '/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1/apps/Bitwig Studio 6.0.6.app/Contents/Java/bitwig.jar' \
  --new-jar '/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar' \
  --report /absolute/new/body-change.json
```

`decisions.json` in `614-guarded/` answers the D52 question for each changed
body and maps it to a guard or a timed live step. The extension bundles
`grid-doctor-candidate.json`, `grid-doctor-selectors.json`, and
`grid-doctor-guards.json` from `614-guarded/`. `GridDoctorGuards` checks the
project-document class, the same manager, the empty helper list, the null
pending helper, the empty pending list, and the two false tracking flags
before each native command, and the exact-class owned tree before disposal.

The V21 driver requires host version 6.1.4, the marker `9b-grid-doctor-v21`,
and the internal consent token in its source. Obtain ordinary approval for
the stated scope, then run it from `brain/` with a new
absolute evidence directory:

```sh
node --import tsx src/probes/phase9b-grid-doctor-614.ts /absolute/new/evidence-directory '<consent>'
```

The first run creates `.local/grid-doctor/<fingerprint-hash>.attempt.json`
with exclusive creation. A retry is admitted only with the explicit
`--retry-after-refused-preflight <prior evidence dirs> '<retry consent>'`
arguments, only when every prior record proves that no native command ran,
and at most six attempts in total. E339 records six attempts on 6.1.4: five
refused before any native command, and the sixth as an uncertain write
after the mapping removal. No seventh attempt is admitted by the driver.
Do not remove or edit any attempt record to enable a run. A new pass needs
its own session, consent, and an explicit exception recorded in the plan.

## 6.1.4 second guarded pass (9b.6i)

Session 9b.6i is the one planned exception to the one-attempt rule on the
6.1.4 fingerprint, after the sixth 9b.6h attempt left the mapping removal
uncertain and the operator restarted Bitwig. Keep all six attempt records
and their committed copies under `614-second-pass/prior-attempts/`
byte-equal. The driver refuses the second pass when any record changes.

Confirm the recovered baseline first. The check is read-only: no scratch
track, no doctor bind, no native command. The output directory must not
exist. The optional second argument compares the check with a prior check.

```sh
node --import tsx src/probes/phase9b-grid-doctor-614-baseline.ts \
  /absolute/new/output-directory \
  /absolute/prior/baseline-check.json
```

Rehearse the read paths on the installed build before any doctor consent.
The rehearsal makes one muted scratch track per fixture in sequence,
inserts the preset, reads it with the survey reader, and deletes the
track with readback; the control read runs before and after. The operator
must save first and allow the scratch tracks. A survey cap is a recorded
verdict, not a refusal.

```sh
node --import tsx src/probes/phase9b-grid-doctor-614-rehearsal.ts /absolute/new/output-directory
```

Then deploy the built probe with `copyProbeExtension`, ask for full
controller replacement, run `npm run probe:hello`, and obtain the
operator's ordinary approval for the second pass. The driver uses
`SECOND_PASS_CONSENT` as its internal scope token.
Run from `brain/` with a new absolute evidence directory and the
attempt-6 evidence directory:

```sh
node --import tsx src/probes/phase9b-grid-doctor-614.ts /absolute/new/evidence-directory \
  '<second-pass consent>' --second-pass-after-uncertain-write \
  /absolute/path/to/614-guarded/live-v21-attempt-6
```

The driver admits the pass only when no cache and no second-pass record
exist, the six records are byte-equal to their copies, the sixth record
names the attempt-6 evidence, that evidence holds exactly the three E339
command receipts with the retained scratch track and one inspection, and
the host started after the sixth attempt (`rig.stats`). It creates
`<fingerprint-hash>.second-pass.attempt.json` with exclusive creation; the
host bind keeps its pinned consent token. A complete pass writes the
matching `.accepted.json` after all 76 roles, teardown, both control
reads, and the preserved-state check. The product does not consume it.

[E340](../../../../context/evidence/experiments/e340-grid-doctor-614-second-guarded-pass.md)
records the second pass: the boolean and mapping cases pass, the core case
passes five commands, and the disposal entry guard refuses on the owned-tree
class `wKx`. Seven 6.1.4 records exist; the driver refuses a retry and a
second second-pass. The preservation check is reproducible from the
repository root; the report path must not exist:

```sh
PYTHONPATH=$PWD/brain/src/probes python3 -B -m grid_doctor.preservation \
  --inventory context/evidence/data/phase9b-doctor/614-resolution/entry-inventory.json \
  --session <session> --report /absolute/new/preservation.json
```

Continue with
[9b.6j](../../../../context/plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6j--owned-tree-census-and-third-guarded-pass).

## 6.1.4 owned-tree census and third pass (9b.6j)

[E341](../../../../context/evidence/experiments/e341-grid-doctor-614-owned-tree-preparation.md)
records preparation recovered from an interrupted Claude Code session.
The census derives 36 corresponding classes on both builds. It adds the
continuous parameter port (`vPq` / `wKx`), boolean port (`FEG` / `dgk`),
and double audio port (`tqA` / `vta`). The set includes conditional init
paths. The live guard still checks each exact class, one managed node,
at most 256 nodes, and depth at most 12.

Run the census once per build. Use the paths in each report's `inputs`
under `614-census/`; the old read is in E316's `captures.zip`, with its
hash in `capture-manifest.json`. Extract it to a new file. All report paths
must be new. No vendor class is initialized.

```sh
PYTHONPATH=brain/src/probes python3 -B -m grid_doctor.owned_census census \
  --jar '<jar for this build>' \
  --symbols context/evidence/data/phase9b-doctor/614-resolution/checkpoint-2/symbols.json \
  --collector-report context/evidence/data/phase9b-doctor/614-resolution/checkpoint-17/collection-conditions-17.json \
  --module-report '<checkpoint-4 module-old-2.json or module-new-2.json>' \
  --read '<E316 or E340 core stage-5 read>' \
  --report /absolute/new/census.json
```

Add `--refused-class wKx` for 6.1.4. Compare the two reports with the
`compare --old <606 report> --new <614 report> --report <new path>`
subcommand. The result is an offline candidate set, not runtime acceptance.
The E340 capture projects only some owned objects. The Java harness replays
that projection and checks each added port class as a separate inert input.
It does not claim to replay all 77 owned objects.

Prepare the new guard resource without changing the E339 resources:

```sh
PYTHONPATH=brain/src/probes python3 -B -m grid_doctor.guarded_candidate \
  --jar '/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar' \
  --symbols context/evidence/data/phase9b-doctor/614-resolution/checkpoint-2/symbols.json \
  --plan context/evidence/data/phase9b-doctor/614-census/guard-plan.json \
  --collector-report context/evidence/data/phase9b-doctor/614-census/census-614.json \
  --candidate-directory context/evidence/data/phase9b-doctor/614-guarded \
  --output /absolute/new/prepared
```

The extension bundles `614-census/prepared/guards.json`. The candidate and
selectors remain byte-equal to E339. The driver expects 36 owned classes
and the new guard hash. It adds
`--third-pass-after-owned-tree-refusal <E340 second-pass evidence directory>`
and uses `THIRD_PASS_CONSENT` as its internal scope token. Obtain ordinary
approval after save-first confirmation and the fresh baseline check. Record
the actual answer with `--operator-reply '<actual reply>'` or linked evidence.
The bind uses the existing host consent token.

Admission requires all seven local 6.1.4 records to match their committed
copies, exactly nine E340 receipts and one inspection, the E340 refusal,
a host start after that pass, and no cache or third-pass record. The driver
creates `<key>.third-pass.attempt.json` exclusively. A retry or another
second pass still refuses. Do not edit a record to enable a run.

Before the third pass, obtain full controller replacement from the operator,
then run `npm run probe:hello` and the read-only baseline check. Require the
probe profile, 118 methods, hash `2e939035ea90b8b0`, marker
`9b-grid-doctor-v21`, and fresh initialization. Doctor preparation must show
guard hash `d14cf2f564cc5b2b534bef726dce9b4c5e8e03db0cdabe4a52431c88be3cf819`.
Send each operator question in a separate turn. Compare command timing with
E316, E339, and E340. The cache still requires all roles, teardown, both
control reads, and preserved state. Never repeat an uncertain command.


[E342](../../../../context/evidence/experiments/e342-grid-doctor-614-acceptance.md)
completes the third pass: all 76 roles, 16 commands, 19 readback pairs,
teardown, and preserved state pass. The 6.1.4 cache exists. Do not run the
accepted doctor again. Continue with 9b.7; product cache enforcement is
not implemented by this research cache.

## 9b.7 — Product gate and upgrade tool

[E343](../../../../context/evidence/experiments/e343-grid-admission-gate-and-upgrade-tool.md)
records the gate, the tool, the isolated rehearsal, and the cleanup. The
rehearsal baseline came from E316's accepted record, the V20 candidate and
selectors, and the 6.0.6 census. Without saved 6.1.4 answers, the check
refuses resolution with 53 missing type roles. With the traced table, the
checkpoint-17 closure and collector reports, the checkpoint-4 module
report, the E340 stage-5 read, `--refused-class wKx`, the E341 guard plan,
and `--candidate-directory 614-guarded`, it reproduces the committed
candidate, selectors, and census; `guards.json` differs only in the census
report hash. See the [Toolkit](#toolkit) section for the commands.
