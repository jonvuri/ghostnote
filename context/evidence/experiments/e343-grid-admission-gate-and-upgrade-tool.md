---
title: E343 — Grid admission gate, upgrade tool, and offline rehearsal
kind: evidence
state: active
updated: 2026-10-23
owner: phase-9b
---

# E343 — Grid admission gate, upgrade tool, and offline rehearsal

## Result

Session 9b.7 is complete. The product refuses native Grid writes without
an accepted doctor record for the exact jar fingerprint and host version.
The read tool `check_grid_support` reports that gate. The offline upgrade
check `grid_doctor.upgrade` runs the deterministic D52 stages from explicit
inputs. The isolated rehearsal on the 6.1.4 jar without saved answers
derives the fingerprint and refuses resolution with a specific reason. A
labeled continuation with the traced 6.1.4 inputs reproduces the committed
candidate, selectors, and 36-class census. The diagnostic toolkit is
classified, and the session-owned temporary files are verified and removed.
No live Grid command ran. No cache changed.

Evidence: [`9b7-tool/`](../data/phase9b-doctor/9b7-tool/).
Policy: [D52](../../decisions/d52-grid-upgrade-admission-policy.md),
[D53](../../decisions/d53-ordinary-operator-consent.md).
Prior results: [E316](e316-grid-doctor-606-acceptance.md),
[E342](e342-grid-doctor-614-acceptance.md).

## Product gate

[`brain/src/grid/admission.ts`](../../../brain/src/grid/admission.ts)
reads the cache; it never writes it. `requireGridWriteAdmission` is the
gate of every product Grid write. It hashes the local jar
(`GHOSTNOTE_BITWIG_JAR`, default `/Applications/Bitwig Studio.app`), finds
`<key>.accepted.json` in the cache directory (`GHOSTNOTE_GRID_DOCTOR_CACHE`,
default `.local/grid-doctor`), and admits only a record with verdict
`accepted`, the same fingerprint, the connected host version, all cases
passed with paired readback, every one of the 76 required roles
(`DOCTOR_ROLES`, pinned from the fixed doctor scope), a released and
unlocked teardown with no failure, and no write-authority claim. A record
with 76 unrelated names refuses and names the missing roles. Each other
state is a refusal with one of five reasons. The 6.0.6 and 6.1.4 records
validate against their own fingerprints; the tests rewrite the E342 record
for a fixture jar and check each refusal.

`check_grid_support` is a read on `agent-native-v1`. It takes one revision
mark for the health check and makes no other host call; it reuses the
session's handshake result without running `Session.ready()` again, which
would send a second mark. A session-boundary test on the stub bridge checks
that it sends the same `revision.get` calls as `check_bitwig_connection`
and no second handshake. It reports the host version, the jar fingerprint,
the admission or the refusal, and the operator steps. It cannot run the doctor. The profile has 45 tools; descriptions are
`ghostnote-description-v53`
(`3180edf177fbeda04df21cd860a238df54db8335f558df69299932103dfbb7f3`,
[artifact](../data/phase9b-doctor/9b7-tool/descriptions-v53.json)). No Grid
write tool exists in the profile; a test asserts it.

The jar hash costs 15.627 ms cold and 0.051 ms memoized for the 35,778,607-byte
6.1.4 jar. The call budget adds the row `grid-support: mark 1`. No wire method
or extension change is needed.

## Upgrade tool

[`grid_doctor.upgrade`](../../../brain/src/probes/grid_doctor/upgrade.py)
has two subcommands. `baseline` copies the accepted build's cache record,
candidate, selectors, optional guards, and optional census into one
directory with a hash summary. `check` runs the stages in order and stops at
the first decision or missing input:

| Stage | Input | Result |
| --- | --- | --- |
| `fingerprint` | the candidate jar | SHA-256, size, mtime, key; `already-accepted` when equal to the baseline |
| `resolve` | the baseline selectors | the table, or a refusal with a per-role type census; `--traced-table` continues after every member and the complete table pass the structural validation of the baseline selectors |
| `body-change` | the baseline jar and table | role rows; `--closure` adds the traced callee labels |
| `census` | `--collector-report`, `--module-report`, optional `--read` | the owned-tree class set and the comparison with the baseline census |
| `guards` | `--guard-plan` | the three resources; `--candidate-directory` reuses earlier bytes |

The verdicts are `already-accepted`, `resolution-refused`, `name-only-change`,
`changed-bodies`, `prepared`, and `input-required`. Each names the next step.
Every stage reads class files as data; no vendor class is initialized, no
host request is sent, and the report sets `writeAuthority: false`. The
consent-gated doctor on the probe profile remains the only way to accept a
fingerprint.

Two refactors support the tool. `owned_census.run_census` takes explicit
roles, forms, and optional receivers and read; a missing optional input gives
a `None` check, not a pass. `guarded_candidate.prepare_resources` takes a
table and guard plan directly; the 9b.6j procedure calls it with its
checkpoint inputs and the traced access variant. A census without pinned
receivers or a live read is accepted by the guard preparation; the live
exact-class guard still refuses an unknown class.

## Offline rehearsal

The workspace was `/tmp/gn-9b7/rehearsal/`, removed at closeout. The
[baseline](../data/phase9b-doctor/9b7-tool/rehearsal/baseline-606.json)
comes from E316's accepted record, the V20 candidate and selectors, and the
6.0.6 census of E341. Excluded: every cache under `.local/grid-doctor`, the
`614-*` checkpoint and census reports, the prepared resources, and prior
verdicts.

Primary run ([log](../data/phase9b-doctor/9b7-tool/rehearsal/check-primary.log),
[report](../data/phase9b-doctor/9b7-tool/rehearsal/check-primary/upgrade.json)):

```sh
PYTHONPATH=brain/src/probes python3 -B -m grid_doctor.upgrade check \
  --baseline /tmp/gn-9b7/rehearsal/baseline-606 \
  --jar '/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar' \
  --old-jar '/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1/apps/Bitwig Studio 6.0.6.app/Contents/Java/bitwig.jar' \
  --output /tmp/gn-9b7/rehearsal/check-primary
```

The fingerprint is
`5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f:35778607:1790948299000000000`,
key `d0d92c1e…`, the same as E342. The resolver refuses with
`boolean-atom:expected-one-candidate:found-0`. The type census resolves 2 of
55 type roles (`layout-pass`, `source-interface`), with 53 missing and none
ambiguous; E331 reported the same 53 missing roles. The verdict is
`resolution-refused` with the agent trace session as the next step. The
recorded run takes 4,510.983 ms and peaks at 187,252,736 bytes RSS (the
first run, before the review fixes: 4,688.674 ms). No manual step.

Continuation ([log](../data/phase9b-doctor/9b7-tool/rehearsal/check-continuation.log),
[report](../data/phase9b-doctor/9b7-tool/rehearsal/check-continuation/upgrade.json),
[comparison](../data/phase9b-doctor/9b7-tool/rehearsal/continuation-comparison.json)):
the same command with the traced table (`614-census/prepared/candidate.json`),
the checkpoint-17 closure and collector reports, the checkpoint-4 module
report, the E340 stage-5 read, `--refused-class wKx`, the E341 guard plan,
and `--candidate-directory 614-guarded`. These inputs are saved 6.1.4
answers; this run checks the later stages, not reproducibility without them.
The traced table passes structural validation against the baseline
selectors (`structuralValidation: pass`). The body-change stage reports 76 roles (57 same, 16 fields same, 2 changed:
`disposal` and `members`; 1 access change: `journal-recording-edit`) and 65
closure callees (63 same, 2 changed: `validation`, `pending-add`). E339 also
listed `listener-removal`, three hooks, and two new-only rows; those need the
removal and migration reports, which the tool does not take. The census
derives the same 36 classes as E341, adds `dgk`, `vta`, and `wKx`, finds one
managed class, and compares equal class sets with the 6.0.6 census; all 36
rows differ only in the base disposal tail (61 to 63 instructions, E341).
The guards stage prepares 1 type, 5 fields, and 36 classes. The candidate
and selectors are byte-equal to `614-census/prepared/`; `guards.json` differs
only in `ownedTree.reportSha256`, the hash of the fresh census report. The
recorded run takes 11,310.502 ms and peaks at 338,280,448 bytes RSS (the
first run: 11,614.006 ms, 336,117,760 bytes).

## Toolkit and cleanup

[`toolkit.py`](../../../brain/src/probes/grid_doctor/toolkit.py) classifies
the 57 package modules: 27 reusable tools and 30 per-build diagnostics. A
test checks that each module is classified once and each reusable tool has
a test. The modules stay in place so the recorded E331–E342 commands still
run; the diagnostics' reports stay with their checkpoint snapshots.

[`cleanup.py`](../data/phase9b-doctor/9b7-tool/cleanup.py) verified and
removed the session-owned temporary files
([inventory](../data/phase9b-doctor/9b7-tool/cleanup.json)): 2,626 files,
725,199,790 bytes. 1,396 files matched a checkpoint development manifest;
80 matched E316's capture manifest; the built archive matched E339's hash;
the development diagnosis equals `614-preparation/diagnosis.json` except
timing and input paths. 56 unreferenced development scripts, logs, and small
reports are in
[`tmp-preserved.zip`](../data/phase9b-doctor/9b7-tool/tmp-preserved.zip)
(152,704 bytes). 96 regenerable work outputs and 996 vendor-derived files
(mutant jars, extracted runtime and JDK classes, one class dump) are
recorded by hash only. Nothing was deleted before the inventory was written.
Nineteen older `/tmp/gn-*` entries from 9b.5 and 9b.6i are outside this
session's scope and remain.

## Verification

- TypeScript: typecheck passes; all 2,480 tests pass (12 new). The call
  budget, vocabulary, description cohort, server profile, and tool-kind
  tests take the 45th tool; the session test checks the mark budget at the
  session boundary.
- Python: 465 tests pass with 42 skipped (10 new in `test_upgrade` and
  `test_toolkit`; the inert fixtures read no vendor jar). Eleven more tests
  skip than before the cleanup: they need the removed renamed fixtures and
  extracted JDK data under `/tmp`.
- Java: unchanged; no extension deployment.
- Changed-document links and frontmatter: `ruby context/check.rb` and
  `git diff --check` at closeout.

## Limits

- The gate hashes the jar at the configured path and compares the host
  version from the handshake. A second install of the same version at
  another path is not detected. The extension does not report its jar.
- No product Grid write tool exists. The gate is enforced by convention and
  test: the build-out plan must call `requireGridWriteAdmission` in each
  Grid write tool before any host call.
- The product cannot run the doctor. Acceptance of a new fingerprint remains
  the driver procedure on the probe profile with ordinary operator consent.
- The census and guard stages need build-specific inputs (collector report,
  module report, guard plan) that a trace session derives. The tool refuses
  with the missing input named; it does not derive them.
- The hook and listener-removal callee rows of E339 are not part of the
  tool's body-change stage.
- The next minor version is the stronger test of reuse; the rehearsal is
  not a blind test.

## Review fixes

An independent review found three P2 problems, each confirmed and fixed
before staging: the gate counted roles instead of checking the required
set; the traced table skipped the structural validation; and the host-info
accessor ran `Session.ready()` again, which costs a second revision mark
that the fake-adapter budget test cannot see. The rehearsal was rerun after
the fixes; the outputs above are from that run.

## Retrospective

A shell `cd` inside one command persisted into later commands and placed
copies under `brain/src/probes/context/`. Use absolute paths in every
multi-step command. Record each stage's limits in the tool output so a
refusal names the missing input rather than a traceback. A call budget
measured on the fake adapter does not see the session's own marks; test a
new tool's budget through a real `Session` on the stub bridge as well.
