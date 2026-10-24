---
title: Overlap investigation status summary, October 2026
kind: note
state: active
updated: 2026-10-24
---

# Overlap investigation status summary, October 2026

This note summarizes the four overlap documents and states what remains open
after the Phase 9 Grid work. Use it as the entry point before you plan the
remaining candidates. The four documents are unchanged.

| Document | Date | Role |
| --- | --- | --- |
| [Overlap report](../wave-1/OVERLAP_REPORT.md) | 2026-10-17 | First pass from web sources. Eight projects, six feature tables, 40 rows. |
| [Capability audit](../wave-1/OVERLAP_CAPABILITY_AUDIT.md) | 2026-10-19 | Source review of all 40 rows on 12 cloned projects. Corrects the first pass. |
| [Improvement sources](../wave-1/OVERLAP_IMPROVEMENT_SOURCES.md) | 2026-10-17 | Ranked candidate backlog O1 to O13, with acceptance gates. |
| [Audit sources](../wave-1/OVERLAP_AUDIT_SOURCES.md) | 2026-10-17 | Pinned clone commits, offline checks, reference labels, and reproduction steps. |

The clones are under `reference/`, which `.gitignore` excludes. All 12 remain
on disk. The check script and results are in
[`data/overlap-audit/`](../../../evidence/data/overlap-audit).

## Where the investigation stopped

The commit `8a2f790a` (2026-10-18) added the four documents, moved the former
Phase 9 backlog to [Phase 10](../../phase-10/README.md), and started the
[9a live Grid spike](../../phase-9/9a-live-grid-editing-spike.md). The 9a
plan states: "Do not turn the remaining overlap candidates into Phase 9
commitments"
([history, line 30](../../phase-9/9a-live-grid-editing-spike-history.md)).
Phase 9 then ran 9a and 9b to completion. The step 3 output is the
[Phase 11 Grid authoring plan](../../phase-11/README.md).

No plan links the O1 to O13 list. The Phase 10 README keeps the older §4
feature matrix (mixer state, sends, transport, scenes, track creation, group
navigation, Arranger, MPE, groove, browser). The only live pointer to the
audit and improvement documents is the 9a history document. This is the
planning gap to close.

## What the audit corrected

The first report overstated Ghostnote in some rows and understated other
projects. The [main corrections table](../wave-1/OVERLAP_CAPABILITY_AUDIT.md#main-corrections)
has the full list. The material points:

- **Control Deck** exposes `bitwig_nest_device` and `bitwig_create_note_clip`.
  The first report showed neither. Its direct-parameter setter uses 128 steps
  and a 0.02 tolerance, so "matched" is too strong in the other direction.
- **acidcat** registers `analyze_sample` for an agent. "No other project
  offers audio analysis to an agent" was wrong.
- **bwpreset** round-trips all 24 Ghostnote preset files byte for byte and
  parses all 46 detached donors. A full `0002` parse does not need Ramona
  names. Exclusive ownership of stub relocation and golden rebuild is not
  established.
- **openwig**, **Gig Maestro**, and **DrivenByMoss** were missing from the
  first report. openwig has reflection-based Arranger insertion, automation,
  and a descriptor walker.
- Ghostnote's own limits: the public catalog admits 12 of 43 host modulator
  types ([P2](../wave-1/OVERLAP_CAPABILITY_AUDIT.md#p2-add-or-edit-modulators-on-stock-devices)),
  route mode, scale source, and enabled flag are not exposed
  ([P5](../wave-1/OVERLAP_CAPABILITY_AUDIT.md#p5-routing-mode-scale-source-and-enabled-flag)),
  and selection restoration and reversal have explicit scope limits
  ([S2](../wave-1/OVERLAP_CAPABILITY_AUDIT.md#s2-change-log-and-guarded-revert-of-agent-edits),
  [S4](../wave-1/OVERLAP_CAPABILITY_AUDIT.md#s4-selection-restored-after-a-write)).

The durable distinction is narrower than "unique": target identity,
preservation, refusal, independent readback, and guarded reversal across live
edits.

## Offline facts not yet acted on

The [checks table](../wave-1/OVERLAP_AUDIT_SOURCES.md#checks-run) records these results.
They ran on the 6.0.6 jar before the 2026-10-21 upgrade to 6.1.4.

| Fact | Consequence | Status |
| --- | --- | --- |
| `0x02` is a real value type; 4 occurrences in checked files | [BWFORMAT_SPEC §3.1](../../../evidence/format/BWFORMAT_SPEC.md) still marks `0x02`, `0x06`, `0x1a` as RETIRED (E11h). `0x06` and `0x1a` were not found. | Correction not applied |
| bwpreset decodes `0004` definitions offline | [BWFORMAT_SPEC §7](../../../evidence/format/BWFORMAT_SPEC.md) still says "Do not spend effort on `0004`". | Correction not applied |
| Control Deck sets direct parameters by ID with readback | [E4](../../../evidence/experiments/e4-direct-parameter-layer-6a-differentiator-2026-07-19.md) line 94 still calls this "the genuinely novel capability". | Correction not applied |
| Computed object counts match all 6 measured donor footprints; Expressions counts 8 | A full parse can replace fixed footprints in `donors.ts` and `stubs.ts`. E69's 10 to 57 bracket did not test 8. | Candidate O2 |
| bwpreset key extractor fails: `sYG.class` absent | Donor-free modulators need a version-specific key resolver. Untested on 6.1.4. | Candidate O7 blocker |
| acidcat metadata writer grows the file and keeps the old body offset | Do not port `edit_bitwig`. | Closed, not recommended |
| Control Deck delete returns success on a no-op | Do not copy its completion predicate. | Closed, not recommended |

## Candidate status

| Candidate | Short name | Status after Phase 9 |
| --- | --- | --- |
| O1 | Recursive preset parser and serializer comparison | Open. Ranked first. Offline. |
| O2 | Computed footprints and sampled-donor gate | Open. Follows O1. |
| O3 | Route enabled state and modes | Open. Small, changes tool descriptions. |
| O4 | Cue-marker tools | Open. Small live feature. |
| O5 | Track sends | Open. Extends the mixer contract. Also in Phase 10 §4. |
| O6 | Sample search and explicit file insertion | Open. Split read-only search from insertion. |
| O7 | App definitions and donor-free modulators | Open. Blocked on the jar key for the current build. |
| O8 | Offline Grid authoring and remote pages | Superseded. Phase 11 takes the live native route. Remote-page authoring is still unplanned. |
| O9 | Descriptor-backed units and routing scale sources | Open. Follows O3. |
| O10 | Capture and analysis as tools | Open. Components exist with live proof (E124, E125). |
| O11 | Offline `.bwclip` import | Open. Research aid first. |
| O12 | Descriptor reflection, Arranger, and automation | Partly touched. The 9b doctor found the `com/bitwig/ramona/` packages (E331, E337) but produced no field-name table. Arranger and automation remain open. Overlaps Phase 10 "arrangement timeline". |
| O13 | Curves, wavetables, sample-player state, bindings | Open. Follows O7 and O8. Large. |

The improvement document also lists
[sources not recommended for a direct port](../wave-1/OVERLAP_IMPROVEMENT_SOURCES.md#sources-not-recommended-for-a-direct-port).

## Items to preserve

- **Licenses.** openwig is GPL-3.0-or-later. DrivenByMoss is LGPLv3. BitX
  has no license file. WigAI and Gig Maestro say MIT only in their READMEs.
  Resolve terms before any copy; a `NOTICE` entry alone is not sufficient.
- **Matrix rule.** A future overlap report records the pinned dispatch path,
  the verification predicate, and one limiting counterexample for each check
  mark. Control Deck's two Arranger workflows, only one dispatched, caused the
  largest error in the first matrix.
- **Stale pins.** The documents state 44 tools and descriptions v52. The
  current surface is 45 tools and v53 (E343). Bitwig is now 6.1.4.
- **Stash.** `stash@{1}` holds the September `NITRO_OVERLAP.md` that the first
  report superseded. `stash@{0}` is `8a-first`. Neither is referenced by a
  plan.
- **Musical generation** remains the driving agent's responsibility in all
  four documents.

## Suggested next planning step

Decide one of two placements for the open candidates, then write the plan:

1. Merge O3, O4, O5, O6, O10, and O12 into the Phase 10 §4 feature matrix,
   and place O1, O2, O7, O9, O11, and O13 as a `bwmod` track in the same
   phase.
2. Open a new phase before Phase 10 for the normal-tool feature matrix, with
   Phase 10 kept for publication and release.

In either case, apply the three documentation corrections above in one short
session first. They need no live work.
