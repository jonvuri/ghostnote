---
title: Dependencies and unresolved planning choices
kind: note
state: active
updated: 2026-10-24
---

# Dependencies and unresolved planning choices

This document describes possible order constraints. It does not rank user
value or assign an implementation schedule. IDs refer to records in the six
feature-area documents and the delivery document.

## Technical dependencies

Typed edges from [`data/records.json`](data/records.json). A prerequisite
must complete first. An enabling record reduces the work but is not required.
Proof is the record's strongest current evidence level; it is separate from
status. The effort driver names one of the six work shapes below.

| ID | Status | Proof | Prerequisites | Enabling | Effort driver | Owner |
|---|---|---|---|---|---|---|
| SM-1 | Candidate | Source | — | — | `extend-scalar-contract` | Phase 10 feature matrix (mixer state row) |
| SM-2 | Candidate | Source | — | — | `extend-scalar-contract` | Phase 10 feature matrix (sends row) |
| SM-3 | Candidate | Source | — | — | `extend-scalar-contract` | none |
| SM-4 | Candidate | Source | — | — | `extend-scalar-contract` | Phase 10 feature matrix (transport row) |
| SM-5 | Candidate | Source | — | — | `extend-scalar-contract` | none |
| SM-6 | Candidate | Source | — | — | `extend-scalar-contract` | Phase 10 feature matrix (scenes row) |
| SM-7 | Unresolved | Source | — | — | `extend-scalar-contract` | Phase 10 feature matrix (track creation and group navigation rows) |
| SM-8 | Candidate | Source | — | — | `extend-scalar-contract` | Phase 10 feature matrix (groove row) |
| SM-9 | Candidate | Source | — | — | `extend-scalar-contract` | none |
| SM-10 | Unresolved | Source | — | — | `extend-scalar-contract` | none |
| SM-11 | Candidate | Source | — | — | `extend-scalar-contract` | none |
| CA-1 | Candidate | Source | — | — | `extend-scalar-contract` | Phase 10 musical breadth (MPE row) |
| CA-2 | Candidate | Source | — | MP-1 | `offline-representation` | none |
| CA-3 | Candidate | Source | — | GI-4 | `internal-host-editing` | Phase 10 musical breadth (arrangement timeline row) |
| CA-4 | Candidate | Source | CA-3 | GI-4 | `internal-host-editing` | Phase 10 musical breadth (arrangement timeline row) |
| CA-5 | Candidate | Source | CA-3 | GI-4 | `internal-host-editing` | Phase 10 musical breadth (arrangement timeline row) |
| CA-6 | Candidate | Source | — | CA-3, GI-4 | `internal-host-editing` | none |
| CA-7 | Candidate | Source | — | — | `extend-scalar-contract` | none |
| CA-8 | Unresolved | Not found | — | — | `extend-scalar-contract` | none |
| DP-1 | Candidate | Source | — | MP-1 | `extend-scalar-contract` | none |
| DP-2 | Candidate | Source | — | GI-3 | `offline-representation` | none |
| DP-3 | Candidate | Source | — | — | `extend-scalar-contract` | none |
| DP-4 | Candidate | Source | — | MP-1 | `internal-host-editing` | none |
| DP-5 | Candidate | Source | — | MA-1 | `offline-representation` | Phase 10 musical breadth (browser row) |
| DP-6 | Candidate | Source | — | — | `extend-scalar-contract` | none |
| MP-1 | Candidate | Checked offline | — | — | `offline-representation` | none |
| MP-2 | Candidate | Checked offline | — | MP-1 | `offline-representation` | none |
| MP-3 | Candidate | Source | — | MP-1 | `extend-scalar-contract` | none |
| MP-4 | Candidate | Source | — | MP-1, MP-3 | `extend-scalar-contract` | none |
| MP-5 | Candidate | Source | — | MP-1, MP-3 | `extend-scalar-contract` | none |
| MP-6 | Candidate | Source | — | — | `offline-representation` | none |
| MP-7 | Candidate | Source | — | MP-2, MP-6 | `payload-families` | none |
| MP-8 | Candidate | Source | — | MP-1, MP-6 | `payload-families` | none |
| MP-9 | Candidate | Source | — | MP-1, MP-6 | `payload-families` | none |
| MP-10 | Candidate | Source | — | MP-1, MP-6 | `payload-families` | none |
| GI-1 | Planned | Live 6.1.4 | — | — | `internal-host-editing` | Phase 11 wave one |
| GI-2 | Planned | Live 6.0.6 | GI-1 | — | `internal-host-editing` | Phase 11 wave two |
| GI-3 | Candidate | Source | — | MP-1 | `offline-representation` | none |
| GI-4 | Candidate | Source | — | GI-1 | `internal-host-editing` | none |
| GI-5 | Unresolved | Not found | GI-2 | — | `internal-host-editing` | Phase 11 recorded limits |
| GI-6 | Unresolved | Source | — | — | `internal-host-editing` | none |
| MA-1 | Candidate | Source | — | — | `offline-representation` | none |
| MA-2 | Candidate | Source | — | MA-1 | `extend-scalar-contract` | none |
| MA-3 | Component | Live 6.0.6 | — | — | `expose-component` | Phase 7d/7e components; no exposure session selected |
| MA-4 | Component | Checked offline | — | MA-3 | `expose-component` | Phase 7d/7e components; no exposure session selected |
| MA-5 | Candidate | Source | — | MA-1, MA-4 | `expose-component` | none |
| MA-6 | Planned | Checked offline | — | — | `offline-representation` | 8i17 survey |
| MA-7 | Unresolved | Claim | — | — | `expose-component` | none |
| MA-8 | Candidate | Not found | — | — | `expose-component` | Phase 10 backlog |
| DL-1 | Planned | Live 6.1.4 | — | — | `package-artifact` | Phase 10c |
| DL-2 | Planned | Live 6.0.6 | — | MP-1 | `package-artifact` | Phase 10a |
| DL-3 | Planned | Checked offline | — | — | `package-artifact` | Phase 10b |
| DL-4 | Planned | Checked offline | — | — | `package-artifact` | Phase 10 backlog |
| DL-5 | Planned | Live 6.1.4 | — | — | `package-artifact` | Phase 10 backlog |
| DL-6 | Candidate | Checked offline | — | — | `package-artifact` | none; defined in next-session.md |
| DL-7 | Candidate | Checked offline | — | DL-6 | `package-artifact` | Phase 10 publishable artifacts; no brief |
| DL-8 | Unresolved | Not found | — | — | `package-artifact` | Phase 10 publishable artifacts; excluded by 10a |
| DL-9 | Unresolved | Not found | DL-1, DL-5 | — | `package-artifact` | Phase 10 publishable artifacts; excluded by 10a |

### Relationship notes

The notes below explain the edges above in words.

| Candidate or family | Prerequisite or enabling input | Relationship |
|---|---|---|
| [MP-1 recursive codec](modulation-and-presets.md) | Existing fixture/oracle suite and bounded parser design | Does not need a `0004` key or a complete name schema |
| MP-2 computed footprints | Context-aware parsing or complete graph serialization; MP-1 is the proposed route | Must prove insertion-boundary effects, not only detached counts |
| MP-3 enabled and MP-4 modes | Reliable route identity and field editing | Can start on the existing editor if that boundary is proved; no forced full codec rewrite |
| MP-5 scale sources | Owned source references and path rewriting | More than a route scalar edit; MP-3 alone is insufficient |
| MP-6 donor-free construction | Exact-build definition reader and schema/default validation | Current hardcoded extractor fails; MP-1 can proceed independently |
| MP-7 catalog breadth | A named refusal family; MP-2 or MP-6 only when relevant | Some types need better witnesses or payload support instead of a new parser |
| MP-8/9/10 payloads and bindings | Applicable schemas, resource/owner identity, and persistence checks | Split by payload; not automatically blocked on all Grid product work |
| [DP-1 physical units](devices-and-parameters.md) | Authoritative descriptors and a verified live conversion | Route modes are not a prerequisite; normalized display samples are insufficient |
| DP-2 remote-page authoring | Owner and parameter target representation | Related to offline authoring; not covered by the current Grid plan |
| [SM-2 sends](session-and-mixing.md) | Send/destination identity and units; current mixer conventions | No dependency on the preset codec or Grid |
| SM-5 cue markers | Bank acquisition, sorting identity, and transport preservation | No dependency on exact Arranger note editing |
| [CA-2 bwclip import](clips-and-arrangement.md) | Clip corpus and loss contract; MP-1 can help parse | Preset round trips do not prove the clip format |
| CA-4/5 Arranger writes | CA-3-quality read and target proof; current-build command admission | Existing Grid discovery can help; it does not grant write authority |
| CA-6 automation | Parameter owner, lane identity, time model, and independent read | Can be a separate bounded spike; scalar setters do not suffice |
| [MA-1 search](media-and-analysis.md) | Index/source identity and bounded queries | Can ship without MA-2 insertion |
| MA-2 audio insertion | File identity and destination-specific verification | Does not require semantic audio analysis |
| MA-3 capture and MA-4 facts | Existing component contracts and verified artifact identity | Independently useful; capture success survives analysis failure |
| MA-6 musical navigation | Existing 8i17 task and provider survey | Independent of the Grid plan and live Arranger writing |
| [GI-1/2 Grid product work](grid-and-internal-access.md) | Phase 11 admission, symbol, and validation gates | Existing selected plan; a new breadth plan must not duplicate it |
| [DL-2 bwmod publication](delivery.md) | Origin review and selected standalone API | A new codec could change extraction scope; choose order explicitly |

## Effort drivers, not estimates

| Work shape | Examples | Main source of work |
|---|---|---|
| Extend an existing public scalar contract | Track fields, sends, route enabled | Target/domain proof, observers, readback, and reversal |
| Expose an existing component | Capture, audio facts | Public contract, profile wiring, current-provider checks, failure isolation |
| Add offline representation or indexing | Recursive codec, bwclip import, sample search | Corpus coverage, malformed input, resource identity, dependencies |
| Add internal host content editing | Arranger, automation, outer modulators if selected | Version discovery, identity, bounded commands, ownership, persistence, recovery |
| Expand payload families | Curves, samples, wavetables, bindings | Different state formats and behavior witnesses for each family |
| Package an accepted artifact | bwmod or Document 1.0 | Origin review, standalone closure, consumer tests, support and release terms |

These categories do not justify day or week estimates. A short upstream
function can still require a large Ghostnote integration. The later report
should show what is known and what must be investigated before estimating.

## Vision choices for the later report

The user has not selected high-level dimensions or priority weights yet.
Prepare comparisons that help them answer these questions:

- Is the main goal editing existing sounds, building new instruments, mixing,
  constructing songs, or understanding reference material?
- Does success mean complete common workflows or maximum primitive coverage?
- How valuable are offline artifacts compared with edits to the current project?
- Which missing modulator types, media formats, or device routes block real work?
- How much operator setup is acceptable for live checks and capture?
- Is release a near-term objective, or can personal capabilities come first?
- Should internal-host work carry its own phase and compatibility budget?

No answer is inferred in this pass. Do not use ease of implementation as a
substitute for user value.

### Provisional user statement, 2026-10-24

The user stated, while reviewing these inputs, that capabilities and speed
outweigh perfection and pristine state or revertability, and that functional
equivalence is the requirement. This is a provisional statement, not a
decision. The user wants the comparisons and more context on D15
(verification discipline) and D49 (revert fidelity) before answering the
vision questions above.

Consequences for the later report: present revert and recovery as secondary
weights, not as gates on every candidate; keep the proof-level field so the
user can see what is known without it deciding the order; and include a short
plain summary of what [D15](../../../decisions/d15-verification-discipline-settled-2026-07-25.md)
and [D49](../../../decisions/d49-revert-fidelity-states-what-the-revert-restored.md) commit to, so the user
can decide with context. Several existing decisions assume the stricter
stance; resolving that is the user's call and is not done here. D15 and D49
are unchanged.

## Phase placement choices

[Phase 10](../../phase-10/README.md) is a bag of independently schedulable
breadth and release items. It can hold selected normal-tool sessions.
A separate feature phase could keep its implementation work apart from
publication. Neither choice is settled here.

The [roadmap](../../ROADMAP.md) also retains Phase 5 closeout and the independent
[8i17 survey](../../phase-8/8i17-midi-musical-navigation-survey.md).
Phase 5's broad historical language is not evidence that all modulator types
are supported. [E96](../../../evidence/experiments/e96-grid-generalization-and-catalog-boundary.md)
and the current tool descriptions define the admitted boundary.

The next report should show these existing owners before adding new sessions.
Its planned scope is in [next-session](next-session.md).
