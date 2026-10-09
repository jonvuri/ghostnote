---
title: E253 — Overlay basis sealing
kind: evidence
state: done
updated: 2026-10-09
owner: phase-8i4
---

# E253 — Overlay basis sealing

## Status

[8i4](../../plan/phase-8/8i4-overlay-basis-sealing.md) is complete.
`edit_launcher_clip` now computes the R22 basis of each current claim that
the call states
([D45](../../decisions/d45-the-edit-limb-seals-explicit-overlay-claims.md)).
An agent can put a nominal and a groove claim with literal JSON and no
repository helper. The stored and returned document is a valid Document 1.0.
The portable grammar, the codec API, and the model reference revision did not
change. No host turn was added; the call budgets did not change. No extension
change. Tool descriptions are `ghostnote-description-v38`.

## Before

The 8i review put one nominal claim through `OVERLAY_PUT` offline: an omitted
basis refused with R12, 64 zeros with R22, and only a basis from the
repository helper applied. The 8i4 driver on HEAD (32f7536) confirmed it live
in "New 3": the agent-shaped put refused before any host call with
`invalid-input`, rule R12, path `$.overlayPut[0]`.

## Change

- `brain/src/bindings/overlay-seal.ts`: `parseSealable` is the codec parse
  with `basis` optional on each current claim. It marks the omitted claims
  and gives them a placeholder. In a desired document it parses each current
  claim as stale, so that the parse does not check R22 before the seal.
  `sealProposal` restores the state and builds the proposed state. For a
  patch, the proposed state is the base after the event and clip changes
  (overlays stripped), with the kept and put claims. For a desired document,
  it is the document itself. Then it checks the references of each stated
  current claim (R21) and computes its basis in dependency order. An omitted
  basis gets the value. A supplied basis that differs refuses with
  `detail.expectedBasis`. The codec validates the sealed proposal when it
  applies it.
- The planner seals before the codec apply. On the guarded route it seals
  after the BASE checks. On a replacement it seals before the rebind; a
  replacement with overlays must still use the clip ID of a read.
- A call without a current claim has no seal work.

## Offline results

`agent-native-edit.test.ts` adds five tests with literal claim JSON:

| Case | Result |
|---|---|
| Patch: move a note late by 1/16, put a nominal and a groove that depends on it | Applied, verified; both current; each basis equals `dependencyBasis` on the read document; a later read returns the same claims |
| Desired document with a new claim without basis | Applied, route `none`; current and sealed |
| Supplied wrong basis on a put | `invalid-input`, reason R22, `detail.expectedBasis` equals the helper value; no write |
| Stale claim without basis | `invalid-input`, R12 (a stale claim keeps its prior basis) |
| Put on an event that the same patch removes | `invalid-input`, R21 (dangling event); no write |
| Desired document retains the current claim and changes its dependency | `invalid-input`, R22 from the codec, no `expectedBasis` (not resealed) |
| Unrelated velocity edit | The claim stays current with the same envelope |
| Dependency edit (duration) | The claim goes stale and keeps its sealed basis |
| Desired document sends the stale claim as current again | Explicit: R22 with `expectedBasis` |
| Claim remove | No effect; the notes do not change |

The helper-based overlay tests and the corpus test pass unchanged.

## Live results

Driver `brain/src/probes/phase8i4-overlay-seal.ts seal`, in "New 3" (the open
owned project; the plan named "New 2", and the driver works only on its own
track). Artifact: [`data/phase8i4-overlay-seal/seal.json`](../data/phase8i4-overlay-seal/seal.json).

| Step | Route | Wall | Calls / turns | Result |
|---|---|---:|---|---|
| Control whole-clip velocity edit (no claim) | whole-clip | 2,290 ms (rerun 1,686) | 52 / 40 | verified |
| Move the subject 1/16 late, put nominal and groove (no basis) | targeted | 1,584 ms (plan 43 ms) | 45 / 36 | verified; both current and sealed |
| Read | — | 410 ms | 14 / 10 | the same sealed claims |
| Unrelated velocity edit | whole-clip | 2,592 ms (rerun 1,908) | 55 / 43 | both claims current |
| Dependency edit (duration 1/16) | whole-clip | 2,654 ms (rerun 1,902) | 55 / 43 | both stale, bases unchanged |
| Remove both claims | none | 806 ms (read 357, readback 409) | 24 / 18 | no effect; events unchanged |

Then every write was reverted (6 changes) and the track was deleted. The
track list equals the list before the run.

## Cost

Cost model: no new host turn, hashing in the brain. Measured:

- The planner time of a call with claims (35–43 ms) equals that of the
  control call without claims (35 ms).
- A claim-only call is one fresh read and one readback read, no write:
  806 ms. The plan estimated about 400 ms plus the readback.
- Offline `phase8h4g-inventory.ts seal-bench` (a patch that changes every
  velocity and puts one claim without basis on each note): 1,024 claims
  408 ms, 4,096 claims 1,553 ms, 16,384 claims 6,344 ms. The same patch with
  helper bases on HEAD: 365, 1,388, and 5,770 ms. The seal adds about
  10 percent. A profile of 16,384 claims puts most of the time in the codec
  structure check of each overlay: it constructs a `DocumentError` for each
  failed `oneOf` branch (about 6 s of 12 s in the profiled run, over the
  repeated validations). That cost is in the codec before 8i4. A codec
  optimization is a publication candidate change; it is left open.
- `phase8h4g-inventory.test.ts` adds a 4,096-claim case under the 4,000 ms
  planner budget, with the linear scaling check. The 16,384-note case without
  claims stays 1.2 s.
- `call-budget.test.ts` adds the claim-only route: mark 2, tracks 1,
  clipRead 2, delta 2. The seal adds no adapter call; every other budget is
  unchanged.
- `phase8h4c-edit.ts cost`: the 16-note insert 1,344–1,379 ms (ledger
  1,367–1,428 ms); one read and the insert 1,762–1,815 ms (ledger
  1,790–1,832 ms). Unchanged.

### The slow whole-clip edits of the first run

In the first run, the whole-clip edits took 2.3–2.7 s, against 1,725–1,740 ms
in the ledger (E247). The HEAD build gave 2,360 ms for the control edit in the
same session, so 8i4 did not cause it. The wire sequences show the cause.
The call count was the same as in the inventory (52 calls). The difference
was the executor verify `clip.read` straight after the write: 680–910 ms,
against about 190 ms for every other capture.

Two later runs on the 8i4 code had no slow capture:

- `phase8h4g-inventory.ts inventory`
  ([`inventory.json`](../data/phase8i4-overlay-seal/inventory.json)):
  `edit-whole-1` 1,666 ms (ledger 1,740), `edit-targeted-16` 1,339 ms
  (1,451), `read-clip` 413 ms (477). No step was more than 15 percent slower
  than E247. The sum of the steps is 69.3 s (E247: 74.8 s).
- The same seal driver again
  ([`seal-rerun.json`](../data/phase8i4-overlay-seal/seal-rerun.json)): the
  control edit took 1,686 ms, the unrelated and dependency edits took
  1,902–1,908 ms (the moved note), and every `clip.read` took 165–196 ms.

The slow capture is host state at the time of the first runs, not a product
path. Its cause is not known (Bitwig was not restarted). The ledger rows do
not change.

## Verification

`npm run check` (2,134 tests), `document:conformance` (252),
`document:bindings`, `document:artifacts`, `document:standalone`,
`check-publication-candidates.py --write` (the binding sources changed),
`context/check.rb`, and `git diff --check` pass.
