---
title: Verification reduction briefs
kind: plan
state: planned
updated: 2026-09-21
parent: README.md
---

# Verification reduction briefs

These are optional follow-ups from the
[6j audit](../../evidence/format/WORKSTATION_VERIFICATION.md). They are not part
of the completed audit implementation. Start a reduction only in its named
session or a focused successor. Prove the required module first. Record the
before/after work counts and wall time on the same input. Reject a reduction
that loses evidence, changes a refusal, or saves no useful work.

## R1 — Share a fresh note preflight with the stash

**Owner:** A focused successor to 7b. **Priority:** First host-cost candidate.

The [musical planner](../../../brain/src/musical/planner.ts) reads complete
preflight state. The [executor](../../../brain/src/engine/executor.ts) then
reads its stash. E119 shows why an extra complete read can be material. E78
already supplies a separate same-route scalar preflight path; it does not
establish a note preflight path.

**Equivalent evidence:** One immutable, complete snapshot must cover every
actual write-set address, all 16 channels, metadata, host defaults, the correct
project/generation/epochs/window and the complete clear/replay scope. It must
retain the original observation mark and exact prior values. Recheck target,
revision, content coverage and fidelity at apply. A revision counter alone
cannot detect every external edit. Agent context, a hash, or an old preview
cannot serve as the stash. No unsupported freshness proof means no reuse.

**Gate:** Add an internal typed handoff only after this proof exists. Test
external note edits, changed generation/scene/project, missing channels,
expanded protected destinations, caller mutation of the snapshot, partial
apply, exact reversal and observer loss. Keep independent final readback and
its eligible retry. Compare complete takes and refusal behavior with the old
path, then run one disposable live write/reversal with exact cleanup. Count
preflight/stash scans separately. Claim only the measured saved scan, not a
whole write-time percentage before the run.

## R2 — Share one checked context render and its fingerprint

**Owner:** 7a after S04 works. **Priority:** Low; E119 local costs are small.

`renderAgentContext` validates. `fingerprintAgentContext` renders and validates
again. A parse/render/fingerprint caller would validate three times and render
twice. E119 measures this possible call sequence; no live context caller exists.

**Equivalent evidence:** Validate unknown input at the module boundary. Keep an
immutable validated value, produce one exact rendered string, and hash those
same UTF-8 bytes in the context-render domain. Preserve strict schemas, all
semantic checks, omitted fields, mode isolation and the frozen corpus hash.
Do not replace S03's complete exact-source hash with this fingerprint.

**Gate:** The old and proposed paths must produce equal text, digests and refusal
results for both corpus modes, reordered inputs, invalid links, source changes,
large inputs and attempted mutation after validation. Measure parse, validation,
render and text hash as separate spans; do not infer savings by subtracting
inclusive medians. Keep public unknown-input entry points safe. No live proof
is needed for this pure change.

## R3 — Give document extraction the already verified bytes

**Owner:** 7c while closing S14. **Priority:** Required boundary design; avoid
an unnecessary second open.

E104 requires the strong TS manifest and byte gate at each offline open. The
probe's Python retrieval loader checks fewer conditions. Do not stack both
loaders or import the weaker one as the product gate.

**Equivalent evidence:** Pass the exact immutable bytes that passed all manifest,
version, compatibility, size, media and hash checks to extraction. Bind the
result/index to source digest, extractor and tokenizer settings. An in-memory
verified result can serve multiple hits from that open. A later open still
verifies the source. Path, mtime or an index ID alone is insufficient.

**Gate:** Test corrupt manifests/bytes, a path changed after validation, stale
indexes, changed extractor settings, missing families, no-match and an older
guide used for a new-version claim. The consumer must process the checked bytes
or refuse. Measure source open/hash, extraction/build and warm query separately.
No downloads or live Bitwig session are needed for the pure controls.

## R4 — Compute and route only required facts

**Owner:** 7d; 7a for a selected MIDI comparison; 7e for capture separation.
**Priority:** Keep the first provider small.

E118 selects task fields; its broad raw arm and unused edit metrics are
historical. E103's embedded signal analysis is not part of artifact capture.
The planned router must project existing typed facts, not call providers again.

**Equivalent evidence:** Retain the exact source bytes/digest, provider version,
formula/settings, sample/channel coverage, silence gate, uncertainty and paired
compatibility checks. A reusable fact must match all of these fields. Verify a
mutable file again at its use boundary and detect change during analysis. No
cross-request cache is authorized by matching paths alone. Candidate metrics
remain predictions until independent post-write evidence exists.

**Gate:** Match the selected facts/deltas against the controlled complete run.
Test same bytes/different aliases, equal metrics/different hashes, changed bytes,
changed frame/channel/tail settings, silence, missing required fields, unmapped
properties and the 0.2 LU brightness control. Assert unused providers do not
start. Capture must still return a valid artifact if optional analysis is absent.
Measure byte checks, requested provider compute, result validation and routing
separately. Report only the observed avoided calls/fields and elapsed time.

## Work that remains essential or unknown

No brief removes target guards, source verification at a new trust boundary,
complete candidate validation, independent post-write readback, reversal
ownership checks, or the measured grid wait. Existing E78/E97 sharing is already
implemented. A larger fine reader needs a new controlled experiment if 7a finds
it necessary; its benefit is unknown. [8b](../phase-8/8b-probe-runtime-retirement.md)
owns historical runtime allocation, with initialization and observer-load proof.
