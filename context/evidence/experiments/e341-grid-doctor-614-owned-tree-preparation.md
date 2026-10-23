---
title: E341 — Owned-tree census and third-pass preparation on 6.1.4
kind: evidence
state: active
updated: 2026-10-23
owner: phase-9b
---

# E341 — Owned-tree census and third-pass preparation on 6.1.4

## Result

The offline part of 9b.6j is prepared, tested, and deployed. The third live
pass has not run. Full controller replacement, hello, a fresh baseline
check, and new operator consent are required next. No third-pass attempt
record or 6.1.4 cache exists. Step 2 remains incomplete.

Work resumes from Claude Code session
`08360a57-6a44-444a-9d00-fb8601639d72`, which stopped at its usage limit.
It left `owned_census.py`, two census reports, their comparison, a guard
plan, and partial candidate-preparation changes. It had not deployed or
run a third pass. This session reproduces its report contents, adds tests,
finishes guard preparation and admission, and deploys the probe.

Evidence: [`614-census/`](../data/phase9b-doctor/614-census/).
Policy: [D52](../../decisions/d52-grid-upgrade-admission-policy.md).
Prior result: [E340](e340-grid-doctor-614-second-guarded-pass.md).

## Census and disposal trace

[`owned_census.py`](../../../brain/src/probes/grid_doctor/owned_census.py)
reads both jars as class-file data. It resolves serialized objects through
relationship descriptors, including inherited descriptors and inline edges.
It follows constructors, serialization hooks, module factory calls,
ancestor init methods, static factories, and bounded helper calls.
Conditional creation paths contribute to the class set.

Both builds derive 36 corresponding classes: the 33 prior classes and
three additions. The serialized counts and strong relationship forms
agree. Each stored read reports 77 owned objects.

| Class | 6.0.6 | 6.1.4 | Creation evidence |
| --- | --- | --- | --- |
| Continuous parameter port, ID 92 | `vPq` | `wKx` | `rce.bl_()` calls `wKx.cfM(String, nyh)` and stores it through `rce.MRY(gez)` for `Hgx`. |
| Boolean port, ID 98 | `FEG` | `dgk` | Init methods on `Wkj` and `RuU` call port factories and store the result. |
| Double audio port, ID 1840 | `tqA` | `vta` | `BgP.iW2()` and `BgP.Bpn()` call port factories and add the results to lists. |

[`decisions.json`](../data/phase9b-doctor/614-census/decisions.json)
records each added class's disposal chain, exact body digests, and calls.
All disposal overrides compare equal under the existing body contract.
The base disposal differs from 61 to 63 instructions. This is the tracking
tail already traced in E339. The D52 flag guard and the single timed live
disposal cover that change. No new disposal effect is identified.

[`reproduction.json`](../data/phase9b-doctor/614-census/reproduction.json)
checks all input hashes and reproduces both report contents after sorting
creation and reachability rows. The interrupted script used set iteration,
which changed row order. The script now sorts those rows. The original
reports remain unchanged. The old read's hash agrees with the E316 capture
manifest; its extracted file is `/tmp/gn-9b6j-e316-captures/preset-2-stage-5-read-0.json`.

## Guards and admission

The new guard resource holds 36 exact classes. The single managed node,
256-node limit, and depth limit of 12 remain. The Java harness uses the
same owned-tree rule as the live path with inert class names and owners.
It replays both E340 stage-5 projections and the inspection, adds each new
port class as a separate regression input, and checks unknown classes,
missing or duplicate managed nodes, depth, and size refusals. The E339
resource still refuses `wKx`.

The E340 detached projection is not the full ownership census. The harness
does not claim to reconstruct all 77 objects or their runtime owner links.
The live guard must check those facts before disposal.

The candidate and selectors are byte-equal to E339. Reuse is allowed only
when the new preparation reproduces their table and selectors. New guards:
`d14cf2f564cc5b2b534bef726dce9b4c5e8e03db0cdabe4a52431c88be3cf819`,
9,140 bytes (E339: 8,762 bytes).

The driver adds policy `9b.6j-third-pass-after-owned-tree-refusal-v1`,
argument `--third-pass-after-owned-tree-refusal`, its own consent string,
and exclusive `<key>.third-pass.attempt.json`. Admission requires the seven
unchanged 6.1.4 records, exactly nine E340 receipts and one inspection,
byte-equal receipt and stop evidence, a host start after the second pass,
and no cache or third-pass record. The dry admission check passes against
the local records. The retry and second-pass policies still refuse.
See [`admission-check.json`](../data/phase9b-doctor/614-census/admission-check.json).
The cache conditions remain all 76 roles, teardown, both control reads,
and preserved state. Timing output adds comparison with E340.

## Baseline, deployment, and preservation

The [read-only baseline check](../data/phase9b-doctor/614-census/baseline-check/result.json)
sends 39 calls and agrees with E340's recovery check. Project:
`gn-grid-spike`; only `grid-probe`, `FX 1`, and `Master`; control muted;
four control modules and two cables; no scratch residue or active claim.
Initialization is `2026-10-23T13:54:52.195Z`. The process check finds no
running doctor driver. Port 8686 has only the Bitwig listener and no
established client. No unrelated process is stopped.

`./gradlew copyProbeExtension` deploys the probe archive:
SHA-256 `e9a31bb89c0fd050b38696256199fa04e0e533361ed6b08cc8fb28c8502592a4`,
859,341 bytes. All three bundled resource hashes match the prepared files
([`archive.json`](../data/phase9b-doctor/614-census/archive.json)).
The marker remains `9b-grid-doctor-v21`; the guard hash and 36-class
metadata distinguish this build. The running controller has not yet been
replaced. Do not infer that deployment loaded the new Java classes.

[`preservation.json`](../data/phase9b-doctor/614-census/preservation.json)
finds 223 of 224 entry files unchanged; only the deployed archive differs.
All seven 6.1.4 records and all three 6.0.6 records match their committed
copies. No saved-file identity claim is made. The two `/tmp/gn-9b6j-*`
directories from the interrupted session remain for the 9b.7 cleanup.

## Verification and measurements

- Python: 16 focused census, preparation, and body-change tests pass.
- TypeScript: typecheck passes; all 2,468 tests pass. The first full-suite
  launch was blocked by the sandbox's IPC restriction before tests ran;
  the unrestricted launch passes.
- Java: `./gradlew check gridDoctorTest` passes; the doctor harness runs
  135 checks without vendor initialization or a live command.
- Census reproduction: 6.0.6 takes 5,667.749 ms, peak RSS 195,231,744 bytes;
  6.1.4 takes 5,839.649 ms, process peak RSS 208,322,560 bytes. These run in
  one process; the second RSS value includes earlier work.
- Resource preparation: 5,582.541 ms, peak RSS 189,775,872 bytes. The reused
  candidate retains E339's original metrics; `preparation.json` records
  this scan's measurements.
- Changed-document links and frontmatter pass. The full context check
  reports 18 pre-existing missing-frontmatter errors in unchanged files.
  No broken link is reported.
- The baseline check sends 39 calls. No new native-command timing exists.
  The [ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#9b6j-owned-tree-census-and-third-guarded-pass--model-before-implementation)
  states the unchanged wire budget and added prepare-time class loads.

## Limits and next step

The bounded census is an over-approximation under its stated reachability
rules. It is not proof of every possible runtime object. An unknown exact
class still causes the live guard to refuse before disposal. No product
performance or write-authority claim changes. Public descriptions are
unchanged. Product cache enforcement remains in 9b.7.

Continue the planned [9b.6j run](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6j--owned-tree-census-and-third-guarded-pass)
after operator replacement. Verify fresh hello and baseline before asking
for the new save-first consent. Run once, preserve an uncertain state,
and compare timing with E316, E339, and E340. Session acceptance is pending.

## Retrospective

A projected capture can omit owned classes. State that coverage explicitly
and test omitted classes separately. Sort traversal evidence before writing
reports so independent runs can compare their content reliably.
