# B19 — Real-use tooling, clip annotations and provenance

## Goal

Act on what real Ghostnote use showed
([E392](../evidence/experiments/e392-r01-real-usage-by-capability-cell.md),
[E393](../evidence/experiments/e393-r01-round3-real-use-followups.md)):
17 of 20 note writes generated whole clips by script, three were single-turn
transforms written as ID lists, and nothing used multi-turn identity. The
largest costs came from the tool surface, not the notation. Per-note timing
overlays made up about 95% of written bytes and were never used, while the
information that mattered was clip-level: source, intended feel and tempo
decisions. B19 runs as three sessions in this order, after
[B18](b18-content-event-window.md). The proposal numbers below refer to the
table in E393 section 3.

## Session 1 — Quick tool wins (independent of the overlay decision)

1. **Trust verified writes (proposal 1).** The add/edit descriptions say that
   `readback.status: verified` is an independent readback (D15,
   [D38](../decisions/d38-a-shared-preflight-read-is-the-stash-only-on-the-targeted-route.md))
   and that `readback.base` serves the next edit. Add `readback.clipId`
   ([D47](../decisions/d47-clip-creation-binds-claims-to-the-live-clip.md))
   and `documentOutputPath` on writes. Real use: 77 same-turn re-reads of
   verified writes, 2.08 MB and 166 s across nine sessions.
2. **Read to file (proposal 2).** `read_launcher_clip` recommends
   `documentOutputPath` as `read_midi_file` does; warn on inline documents
   above about 48 KB; cap dry-run change lists. Real use: 0 of 224 reads in
   the largest session used a file; Codex truncated 24 results.
3. **Stop routing agents to per-note timing overlays (proposal 3, stopgap).**
   Remove "keep" from `TIMING_FEEL_ROUTE`
   (`brain/src/surface/document-help.ts`) and the per-note method in the
   reference's Timing overlays section, or route only on an explicit request
   for feel. This is correct whichever way session 2 decides.
4. **Slot occupancy (proposal 4).** `list_launcher_slots`, first brain-only
   over the existing one-turn `slot.status` read (about 1.2 s for 48 slots),
   with a later extension method for whole-project occupancy. Real use: 172
   empty-slot reads.
5. **MIDI import release velocity (proposal 8, revised).** The repeated
   `WITH {"releaseVelocity":…}` comes from MIDI import, not Bitwig round trips:
   D35 already makes Bitwig's 100/127 the default. `midi/conversion.ts` takes
   a note-off's velocity byte (often 0 in transcriptions) and maps a note-on
   with velocity 0 to 64/127, so every imported row carries a non-default
   value. Decide whether an absent or conventional MIDI release velocity
   imports as the document default; keep the column-binding idea only if a
   case remains.

Checks: description version bump and tests for every changed description;
ledger rows and call-budget tests for the new tool; one focused live check of
the new tool and the write-result fields.

## Session 2 — Overlays, clip annotations and provenance

**Question.** Should document 1.0 drop overlays entirely (nominal, groove,
tempo, meter, harmony, role, motif, region; SPEC R12–R24), keeping note IDs,
and replace them with durable clip provenance, a small set of clip-level
annotations, and stateless analysis tools (session 3)? Real use wrote only
timing overlays, never read them, and lost them on every save, move and copy;
harmony, role, motif and region were never used (E393 section 2).

**Format evaluation first.** The operator will make one more pass over the
format evidence and may design a final benchmark. Without overlays, C3 and C4
largely reduce to baseline FIELDS rows, because their differences concern
inline group timing context. Questions to settle:
- FIELDS against MIDI JSON (and against the JSON form of the document) for
  overlay-free note documents, including A2 host fields.
- Which compact ideas survive: FIELDS over JSON, no carried state (bar|beat's
  silent failures), redundancy for error visibility (C3's validator catches),
  and Producer Pal-style compact selector or transform requests.
- Whether a final benchmark is needed, and if so its arms, cohorts (including
  a capable model) and B2 tasks.

**Design outcomes.**
- A D record on overlay removal or reduction, changing the spec, reference,
  bindings and descriptions together; migration of stored claims.
- Durable clip provenance: source file and hash, bar range, tempo decision;
  carried through copy and move (proposal 6) and matchable across re-mints
  by an ID-independent note fingerprint (proposal 7). Decide where it lives
  (clip metadata, a Ghostworks record, or both).
- Clip-level annotations only where they improve agent reasoning (intended
  feel, declared tempo and meter); criteria for admitting one.

**Entry points.**
- R01: [FINDINGS.md](../../spec/r01-research/FINDINGS.md) (standing results
  and reusable harnesses), the [R01 brief](r01-format-comparison.md) (its
  [round 3 section](r01-format-comparison.md#round-3-real-use-follow-ups-r01-d23-2026-10-31)),
  [R01-D22](../../spec/r01-research/decisions/r01-d22-capability-grid-focus.md),
  [R01-D23](../../spec/r01-research/decisions/r01-d23-pause-format-comparison-and-open-round-3.md),
  the [round 2 brief](r01-round-2-difficulty-scaling.md), and the candidate
  specs [COMPACT-FIELDS.md](../../spec/r01-research/COMPACT-FIELDS.md) (C3),
  [NESTED-FIELDS.md](../../spec/r01-research/NESTED-FIELDS.md) (C4) and
  [PRODUCER-PAL.md](../../spec/r01-research/PRODUCER-PAL.md).
- Phase 8 format history: [Phase 8 README](../plan/phase-8/README.md);
  [8c compact-bar prior art](../plan/phase-8/8c-compact-bar-prior-art-and-benchmark.md);
  [8c4f full-matrix decision](../plan/phase-8/8c4f-full-matrix-decision.md) and
  [native versus composite diagnostic](../plan/phase-8/8c4f-native-versus-composite-diagnostic.md);
  [8f consolidated contracts](../plan/phase-8/8f-consolidated-compact-bar-and-cache-contracts.md);
  [8f2 reference codec](../plan/phase-8/8f2-reference-codec-and-model-format-reference.md);
  [D24](../decisions/d24-forward-compact-benchmarks-retain-fields-and-local-labels.md),
  [D25](../decisions/d25-fields-json-document-format-and-publication.md);
  [E115](../evidence/experiments/e115-established-syntax-does-not-beat-compact-bar-context.md),
  [E137](../evidence/experiments/e137-compact-bar-prior-art-and-benchmark.md),
  [E177](../evidence/experiments/e177-gemini-local-label-diagnostic-selects-local-labels.md).
- Phase 8 overlay history: [8i4 basis sealing](../plan/phase-8/8i4-overlay-basis-sealing.md),
  [8i9 authoring and creation](../plan/phase-8/8i9-overlay-authoring-and-creation.md),
  [8i10 unprompted overlay trials](../plan/phase-8/8i10-unprompted-overlay-trials.md)
  ([E259](../evidence/experiments/e259-unprompted-overlay-trials.md), the origin
  of the timing-feel route), [8i11 claim replacement](../plan/phase-8/8i11-claim-replacement-repair.md);
  [D45](../decisions/d45-the-edit-limb-seals-explicit-overlay-claims.md),
  [D47](../decisions/d47-clip-creation-binds-claims-to-the-live-clip.md).
- Contract: [SPEC.md](../../spec/ghostnote-document-v1/SPEC.md) R12–R24,
  [FIELDS.md](../../spec/ghostnote-document-v1/FIELDS.md),
  [MODEL-REFERENCE.md](../../spec/ghostnote-document-v1/MODEL-REFERENCE.md).

## Session 3 — Clip operations and stateless analysis tools

Design after session 2, because these tools replace what overlays were meant
to provide.
- **Structural operations (proposal 5).** Create a clip from a source clip,
  beat range and shift, with an optional patch, preserving ID lineage: slice,
  split, and duplicate-and-vary. Real use restated 114–126 notes for light
  variations and wrote long REMOVE lists to split clips.
- **Stateless analysis and transforms.** What agents improvised in Python:
  crop, retime, drum-map remap, pitch-class or scale transforms, voice
  separation, groove extraction, and comparison of a clip with its source. A
  source-comparison check would have answered every timing question in E393.
- **Selectors.** Selector or range patch records and server-side transforms
  conflict with [D21](../decisions/d21-musical-patch-and-public-tool-grain.md)
  and [D51](../decisions/d51-document-file-paths.md); revisit them with this
  evidence. Script-generated ID patches were cheap (466 UPDATEs, 13 KB), so the
  case for selectors is about agent effort and errors rather than bytes.
  Producer Pal's compact transforms ([E353](../evidence/experiments/e353-producer-pal-offline-formats-and-claims.md))
  are prior art.

Each operation needs ledger rows, call-budget tests and a focused live check.

## Result

Not started.
