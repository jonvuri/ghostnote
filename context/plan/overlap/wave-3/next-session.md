---
title: Input synthesis and vision review
kind: plan
state: complete
updated: 2026-10-24
---

# Input synthesis and vision review

## Purpose

The [static report](report.html) completes this session. It helps the user
compare feature dimensions and possible sequences. It does not select an
implementation order. The next step is [vision selection](vision-selection.md).
The work and acceptance criteria below define the completed session.

## Sources

Read [current surface](current-surface.md), the six feature-area documents,
[sources](sources.md), [delivery](delivery.md), and [dependencies](dependencies.md).
Use [`data/records.json`](data/records.json) as the source of the matrices;
the documents are its readable view. The external implementation register supplies the per-project columns with
the same row keys.
Resolve a disputed fact from its primary code, evidence, or decision link.
No earlier overlap report is required.

The external comparison data is in the [external register](external-register.md)
and `data/records.json` (`externalCells`). Read it from there; do not derive
it again from the wave-1 audit. Its freshness limit is the pinned clone set.

## Work

1. Confirm the baseline version and check for new implementation since this
   collection. Update inputs before calculating coverage.
2. Group capabilities by user outcome and technical dimension. Keep live
   control, offline authoring, analysis, and release distinct where needed.
3. Build feature matrices that distinguish reads, writes, creation, deletion,
   preservation, reversal, and persistence. Mark Product, Component, Research,
   Planned, Candidate, and Unresolved explicitly.
4. Show alternate views: workflow coverage, proof strength, source options,
   dependencies, integration effort drivers, and maintenance burden. State
   unmeasured effort instead of inventing estimates or a universal score.
5. Use visualizations where they clarify dependencies or coverage. Keep
   evidence links available from the underlying records.
6. Present several possible sequences with their tradeoffs. Make the user's
   desired outcomes explicit before selecting a new phase or session order.
7. Reconcile existing Phase 10, Phase 11, Phase 5 closeout, and 8i17 owners.
   Create implementation briefs only for work the user selects.

## Acceptance

- Every record ID in [`data/records.json`](data/records.json) has a
  disposition in the report or an explicit exclusion reason.
- Every feature claim has a source and one of the five proof levels (Live
  with build, Checked offline, Source, Claim, Not found). Source code alone
  is not called live proof. Historical measurements retain scope and version.
- Every check mark follows the matrix rule: pinned dispatch path or Ghostnote
  tool path, actual success predicate, and one limiting counterexample.
  "Not found" is shown as such, never as "absent".
- Status and proof level stay separate in every view. A single colour ramp
  does not merge them.
- Current tools are not counted again as wholly missing features.
- Unknown values and unresolved product choices remain visible.
- The report can be read without prior overlap waves. Every external claim
  in it traces to a register cell or states that no cell exists.
- Proposed phase placement is distinguishable from an accepted decision.

## Companion session: correct working format references

`DL-6` in [delivery](delivery.md) defines a bounded documentation session.
Read the retained codec result, E276, the current format spec, and parser
comment. Correct the `0x02`, recursive-parser, `0004`, and scoped descriptor
statements without changing runtime behavior or historical E/D records.
Preserve the tested sentinel and sampled-reference rules.

Acceptance: accurate current claims, primary source links, unchanged runtime
logic, context/link checks, and a clean diff check. This correction can run
with report preparation. It is not a prerequisite for every feature candidate.

## Completion

The report includes all 58 record dispositions and all 266 claim or planning
cells. It separates status, proof, and build; preserves source predicates and
limits; and presents workflow, source, dependency, effort, and sequence views.
The baseline remains 45 tools, v53, and installed Bitwig 6.1.4. No live work ran.

DL-6 is complete. Current format and parser references now state the scoped
codec, field-type, encoding, and descriptor evidence. Runtime logic and
historical E/D records are unchanged. See the [changelog](CHANGELOG.md) and
[build checks](report/README.md).
