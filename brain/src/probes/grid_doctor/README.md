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

Continue with
[9b.6b](../../../../context/plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6b--trace-new-ownership-and-disposal-contracts).
That session must finish the changed contracts and the complete reusable
resolver before it prepares a probe. Keep the V20 driver unchanged.
