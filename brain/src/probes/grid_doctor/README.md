# Grid doctor on 6.0.6

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

The consent argument records the actual operator answer. The fixed plan
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
