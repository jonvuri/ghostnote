---
title: E354 — R01 candidate prototypes and Ghostworks corpus
kind: evidence
state: done
updated: 2026-10-25
owner: R01
---

# E354 — R01 candidate prototypes and Ghostworks corpus

## Scope

The operator approved the next offline R01 package and suggested existing
Ghostworks transcriptions as realistic source material. This round implements
bounded prototypes for all four retained ideas and a common deterministic
screen. It follows [E353](e353-producer-pal-offline-formats-and-claims.md) without
changing that historical record. The [research specifications](../../../spec/r01-research/README.md)
and [agent-trial protocol](../../../spec/r01-research/TRIAL-PROTOCOL.md) are
reviewable proposals, not format adoption or proof of agent benefit.

No DAW connection, controller deployment/replacement, library mutation,
transcription inference, saved-project edit, or paid model call occurred.
Ghostworks `get_status`/`list_shard_assets` supplied read-only inventory metadata;
four selected MIDI files were read locally and hash verified.

## Sources and retained artifacts

- [Corpus manifest](../data/r01-candidates/corpus-manifest.json): inventory,
  source identities/hashes, metadata, extraction rule and lineage split.
- [Exact excerpts](../data/r01-candidates/corpus-excerpts.json): source rational
  notes, shifted timing maps, full tails and source event coordinates.
- [Candidate screen](../data/r01-candidates/screen.json): source hashes,
  eight fixtures, per-surface results, six claim controls, measured samples,
  generated before/after examples and explicit refusals.
- [Precision results](../data/r01-candidates/precision-results.json) and
  [upstream adaptation](../data/r01-candidates/precision-upstream.patch).
- Research code: [shared oracle/backend](../../../brain/benchmarks/r01-candidates/common.mjs),
  [screen](../../../brain/benchmarks/r01-candidates/run.mjs),
  [structured surfaces](../../../brain/benchmarks/r01-candidates/structured.mjs),
  [precision adapter](../../../brain/benchmarks/r01-candidates/precision.mjs),
  and [corpus extractor](../../../brain/benchmarks/r01-candidates/corpus.mjs).

Producer Pal remains pinned to `52a4c219eca338b95e94dbfddcffeeb303ff8dd3`.
The adapter copies its source into a disposable directory, applies the retained
seven-file diff and removes that copy afterward. Original tracked upstream
source remains unchanged. No upstream runtime dependency enters the product.
The local environment is Node 24.11.1, Apple M4 Pro; token counts use the retained
E353 tooling, `js-tiktoken` 1.0.21 with `o200k_base`.

## Ghostworks source finding

Discovery returned 303 MIDI assets across 14 MIDI work families. Metadata labels
242 mapped, 57 baked and four legacy/unresolved. Every MIDI record reports
velocity 64; 187 explicitly mark it as a placeholder. These are inventory
observations, not an acoustic transcription-quality assessment.

Four short excerpts from three development works contribute 128 notes:
Engram drums (17), Engram bass (7), Via Purifico piano (94), and Air Loom guitar
(10). There are 121 off-grid onsets and 128 off-grid durations before realization.
Three selected notes cross the selection-window end; full tails are retained.
No normalized-address collisions or minimum-duration promotions occur in these
excerpts. Synthetic cases cover those omissions, dynamics, expression and
explicit musical intent.

Engram includes variable tempo and an internal 5/4-to-4/4 meter change; Air Loom
has a baked implicit-120 clock with unresolved musical pulse. Source maps,
origins and transcription limitations remain explicit. The note-only screen
does not prove variable-clock or acoustic-performance round trips.

Eleven whole MIDI work families remain reserved. No reserved MIDI was opened;
discovery metadata was inspected. All sibling stems, transcriber variants and
derived exports stay with their source family. The retained lineage audit found
no cross-split source-ID/hash overlap. This is a reservation within this round,
not a claim that those works have never been encountered elsewhere. See the
[corpus contract](../../../spec/r01-research/CORPUS.md) for the full limits.

## Deterministic result

Eight fixtures contain 146 notes: four synthetic examples and four real excerpts.
The screen records 48 surface/fixture cells:

| Surface | Full performed-state equality | Explicit unsupported cases |
|---|---:|---|
| Current FIELDS | 8/8 | None among these eight admitted fixtures |
| Current JSON | 8/8 | None among these eight admitted fixtures |
| C3 compact fields | 8/8 | Host admission remains a separate check |
| C4 groups/refinements | 8/8 | Host admission remains a separate check |
| Adapted bar\|beat | 6/8 | Wider-state/multichannel synthetic fixture; channel-10 drum fixture |
| Adapted MIDI JSON | 6/8 | Same two full-state encoding exclusions |

All 44 supported cells pass. C3/C4 also preserve exact source rationals and
supplied context across repeated cycles. PP surface cells use normalized
common-note inputs; authored tuplets are checked separately. A single-channel
external scope could carry the drum channel, but the native notation does not
encode it, so this table retains the full-state exclusion.

One-note velocity edits pass through the common guarded backend on all eight
fixtures, with known-ID correspondence, one changed note, unchanged unrelated
state and an independent reparse. C3/C4 decode-edit-compile routes agree with
that result. On the six PP-admitted fixtures, explicit single-note text proposals
also compile to the same result using a separately counted frozen selection
and base hash. That handle is adapter context, not native PP identity.

The golden harmony edit halves spread while preserving the 3/512 common delay,
durations and dynamics. Exact starts become 4099/512, 2051/256, 8211/1024,
8219/1024 before the declared normalization. Tests cover explicit groups,
overlapping labels, nominal provenance, inferred-state invalidation, ambiguous
timing owners and direct unknown-intent notes.

Six selective/timing-rich current-claim controls preserve the performed notes.
Unrelated velocity edits retain claims; relevant timing edits stale dependencies
through the existing patch engine. The control builder does not translate every
experimental group field or adopt the structured candidates' lifecycle rules.
A review found and fixed prototype prevalidation that initially rejected a
timing change before dependent claims could become stale; a regression covers it.

Separate negative-pickup and normalized-duplicate cases preserve representation
data but refuse current document admission. A 1,024-note local edit changes one
note; add/remove operations, stale views and unrelated concurrent base changes
are tested. Whole-document freshness still refuses unrelated concurrent edits;
there is no general merge claim.

## Precision adaptation and its remaining refusal boundary

The original precision screen passes 80 cases, 254 serialization cycles and
28,604 note-cycle checks. It covers all 512 onset cells and durations through
one quarter across 4/4, 6/8 and 5/4, representative bar boundaries and long times,
overlaps, duplicate multiplicity, state/default suppression, irregular drum
repetition, and ten-cycle authored tuplets without pre-realization quantization.

Independent review then found one-based bar|beat arithmetic crossing a cell
boundary for IEEE-754 neighbors: `1/512 - 2**-60` and `4 - 2**-51`. Retaining
more printed digits does not repair the native parser's arithmetic. The adapter
now reparses its output and compares normalized supported-field multisets.
It refuses a mismatch as `R01_PRECISION_LOSS`; it never silently rounds the
source or claims that all numeric inputs can be serialized faithfully.

An additional 55,296 immediate-neighbor inputs exercise onset and duration
half-cell boundaries. There are 53,248 accepted inputs and 2,048 explicit
bar|beat precision refusals, with no silent normalized losses in the sweep.
All 27,648 MIDI JSON inputs pass. Accepted outputs also pass a second cycle.
These counts are bounded test coverage, not a universal floating-point proof.
The guard adds parse/comparison work to formatting and is included in its
measured cost. The accepted meter denominators are 4 and 8; others refuse.

## Cost interpretation

Raw samples and medians cover encoding, decoding, guarded commands, and the
claim baseline's combined build/seal and separate parse stages. Each has one
warm-up and five local samples; other sessions may be running. Sampled heap deltas are not peak
allocation, retained memory or end-to-end host latency.

Payload token sizes are retained with their information scope. PP note-only
text, current document envelopes and structured source/intent surfaces are not
equal-information alternatives in this screen. No winner, model-performance
gain, runtime optimization or storage migration follows from their sizes.
The future protocol isolates information, views and commands before comparing
practical workflows and counts instructions, retrieval, code and repairs.

## Verification and next step

All 35 new common/structured/corpus tests pass, as do all 286 existing document
and binding tests. The four pinned source files regenerate the retained corpus
exactly. The final deterministic screen and precision suite pass with the
refusals above. Changed local documentation links/anchors and diff checks pass.
The global context checker still reports the same 60 pre-existing missing
reference/sibling-checkout links; this round adds no broken link.

Reproduction commands are in the [package](../../../spec/r01-research/README.md#reproduction-and-completion-boundary),
[precision contract](../../../spec/r01-research/PRODUCER-PAL.md#verification-and-reproduction),
and [corpus contract](../../../spec/r01-research/CORPUS.md#reproduction).
The next deliverable is review of the concrete contracts and a frozen agent
pilot manifest/provider harness. Model/settings and a concrete paid-run budget
remain a later scoped decision. Current product behavior and the original
live-state checkpoint remain unchanged.
