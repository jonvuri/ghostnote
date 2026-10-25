---
title: Wave 4 decision sessions
kind: plan
state: complete
updated: 2026-10-24
---

# Decision sessions

These are historical wave-4 decision steps. The [report](report.html)
and [decision log](decisions.md) retain their sources and outcomes. The
[backlog](../../../BACKLOG.md) now selects implementation work and its order;
it replaced the proposed W4-D matrix step. The prompts below describe the
planning session, not current authorization or work that must be selected again.

## W4-A — Select a workflow and its result

**Status:** complete 2026-10-24 (W4-002 through W4-012, W4-018).

The workflow order and relative priorities are settled by W4-002 through
W4-011. W4-012 accepts the working plan. Use the [13 variations](workflow-sequence.md) and their
[case data](sequence.json). They apply practical functional acceptance to the
[coverage assessment](coverage.md). Do not ask for the order or priority areas
again.

First make the main sequence concrete: a useful MIDI sketch, detailed edits,
arrangement and automation, audio editing and readback, performable sound and
Grid, then mixing. A blocked research route must not hold all other cases.
The proposal names four investigations in W4-C.

V01–13 are templates. The user supplies current real material when each
session runs. Ask about input-specific acceptance only when it changes the
implementation. Post-device/pre-fader clip readback, sample CRUD first,
current notation by default, and tested-version-only release support are
settled. Use the [concrete side-effect examples](remaining-decisions.md)
when an actual route needs a preservation choice.

**Acceptance:** each template names the functions it exercises and a useful
observable result. Actual fixtures, scale, latency, permitted manual steps,
and field boundaries are selected at execution. D54 removes a universal
reversal requirement; it does not permit unintended changes.

## W4-B — Select boundaries and support promises

**Status:** complete 2026-10-24 (W4-013 through W4-017, W4-019 through W4-024).

Use [architecture.md](architecture.md), the selected
[work sessions](work-sessions.md), and [remaining case-specific choices](remaining-decisions.md).

- P01 owns repeated inventories, full captures, and useful D19 simplification
  under D54. T5 retention research is deferred unless evidence shows a cost.
- Expanded R01 owns Producer Pal comparison, dense claims, and naming.
  Keep FIELDS/JSON by default. C01 audits and removes obsolete stable-v1.
- I01 tracks each tool/route's internal dependency and whole-tool refusal.
  The behavior is selected; transitive classification and failure proof remain.
- Release support is an explicit tested Bitwig list with no guarantee outside
  it. Prepare clean docs and simple versions, likely GitHub release assets.
- Keep client reuse small. Agent-mediated Ghostworks handoff remains enough
  unless a concrete task justifies more. HTTP remains logged intent only.

**Acceptance:** concrete tool/route owners, no hidden D19 obligation, scoped
refusal behavior, and a small release slice. Do not reopen the settled floor
or ask the user to supply every workflow's material in advance.

## W4-C — Assess routes for selected capabilities

**Status:** briefs complete 2026-10-24; the investigations themselves run with
their variations.

Use [work-sessions.md](work-sessions.md) for P01/C01/I01 and the expanded
R01. Keep the other bounded briefs in [workflow-sequence.md](workflow-sequence.md):

| Brief | Timing and output |
|---|---|
| R01 — Producer Pal formats | With V01/02. Keep FIELDS/JSON by default; compare Producer Pal formats, dense claims, and names. Prepare offline tests for promising candidates. |
| R02 — Pressure | With V02. Audit E15/E236 and external handlers; plan an independent reproduction and upstream evidence if confirmed. |
| R03 — Track readback | Start at V05, before V07. Find quick inaudible post-device/pre-fader clip readback; prove range and completion. |
| R04 — Live setters | With V08/09. Revisit remote and modulation setters separately; retain Phase 11 for Grid. |
| R05 — Name resolution | With V01. Re-probe popup-browser discovery with a wait and filter reset; fall back to the offline catalog and explicit IDs. |

These are planned investigations, not completed tests or host authorization.
R01 can start offline. R02 begins with an offline audit. Each live brief needs
its own bounded scope and the normal admission and operator steps.

Use wave-3 source cells as leads. Inspect the pinned implementation for each
selected verb. Compare public controller access, internal-host access, the
existing file route, and any acceptable operator step. Keep proof and
preference in separate fields. Do not investigate all records by default.

For a selected sound-design task, start with one blocked modulator, route,
remote mapping, or container. A live Grid path does not establish a live
outer-modulator or remote-page path. For a song task, test the required
Arranger read before its direct writes. Launcher recording is an explicit
alternate workflow with different editing behavior.

For each proposed investigation, state the useful result, current evidence,
unknown predicate, bounded probe, host work and memory, and stop condition.
A successful source inspection can select a probe; it cannot claim a live
capability. Obtain the required live scope before a probe. Apply the
[performance ledger](../../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md)
to changed live paths. Compare task-equivalent results before claiming a
speed advantage. Keep a working file route until a replacement is proved.

**Acceptance:** selected route or a bounded investigation per required gap;
fallback, preservation, recovery, and upgrade limits; no invented effort
estimate. Do not block independent useful work on an unrelated route result.

## W4-D — Select the matrix and implementation roadmap

**Status:** replaced by the [backlog](../../../BACKLOG.md) on 2026-10-24.
The row/verb matrix is not built; each item writes its own brief when it
reaches the top. The owner reconciliation below is applied in the backlog.

Promote only selected work from the [scope overlay](scope.json). The overlay
contains all 58 wave-3 records but does not authorize their implementation.

Build the planned matrix at row-and-verb level. Each selected cell must have:
workflow, priority, owner/layer, current status and proof, target result,
required preservation, expected side effects, host-access class, refusal, dependencies, verification, cost
model, and implementation session. Retain links to the original predicates
and counterexamples. Add new rows only when wave 3 lacks the needed result.
Project creation/open, richer audio output, and client support may need new
rows; do not hide them inside project save or master capture.

Reconcile these existing owners:

| Existing work | Wave-4 treatment |
|---|---|
| Phase 11 / GI-1 and GI-2 | Keep its accepted Grid scope. 11a remains the next already-planned Grid session. Choose its position relative to other workflows explicitly. Grid writes record no inverse and have no revert path (W4-024); the plan and ledger are updated. |
| 8i17 / MA-6 | The user's direction moves analysis outside Ghostnote support. Retain the survey as source material. Do not schedule it as a new Ghostnote provider build. Select archive, external handoff, or a narrower host-read requirement during roadmap reconciliation. |
| Phase 5 | Keep accepted behavior. Review closeout only where the selected live route or support boundary changes its need. |
| 10a, 10b, 10c | Retain owners; prepare a lightweight product/format release slice under W4-015. Do not require standalone bwmod to publish first. Reuse 10b artifacts and a scoped 10c suite; review only the assets actually shipped. |
| MA-1 | Split cross-project library search from Bitwig browser discovery. Ghostworks and DP-5 have different responsibilities. |
| MA-4 through MA-7 | External analysis direction. Inventory callers before moving or retiring existing modules. No deletion or migration is implied. |

**Acceptance:** selected vision, planned capability matrix, sequenced sessions,
explicit deferred work, owner reconciliation, and one next implementation
brief. Each implementation brief names scope, proof, cost, expected effects, and
any recovery it actually offers. D54 requires no bespoke inverse.
Update NOW and the roadmap. Keep historical E/D records unchanged.

## Proposed sequence and later work

[workflow-sequence.md](workflow-sequence.md) replaces the earlier three short
capability sketches. Its V01–13 cases are the accepted working direction, not a measured
schedule or selected implementation briefs. [sequence.json](sequence.json) states dependencies and functional
acceptance. Existing tools can satisfy steps without new implementation.

With the main path and broad scope accepted, produce the W4-D matrix and
implementation sessions. Resolve only case-specific ambiguities as they arise. Consolidate lower-priority
platform, live-control, structure/reuse, and bonus-device work later. HTTP
remains in the decision log; no backlog item is created in this session.
