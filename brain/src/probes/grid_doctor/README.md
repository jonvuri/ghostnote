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
