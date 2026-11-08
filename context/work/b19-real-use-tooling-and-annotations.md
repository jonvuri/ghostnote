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
decisions. B19 runs as four sessions in this order, after
[B18](b18-content-event-window.md). The proposal numbers below refer to the
table in E393 section 3. On 2026-11-08 the operator moved slot occupancy
(proposal 4) to its own extension session (session 2) and moved the release
velocity question (proposal 8) to the overlay session (session 3).

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
   for feel. This is correct whichever way session 3 decides.

Checks: description version bump and tests for every changed description; one
focused live check of the write-result fields.

## Session 2 — Whole-project slot occupancy (proposal 4, extension route)

**Goal.** A `list_launcher_slots` tool backed by one new normal-profile
extension method that returns every occupied Launcher slot in one call. Real
use made 172 empty-slot reads (54 s) to find free slots (E393 section 3).

**Why not the brain-only route.** `slot.status` answers for one slot, and each
sequential call costs one turn, about 24 ms
([ledger](../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md)). `batch.run` cannot
combine the reads, because its reply drops every op result except
`directparam.set` (`BatchHandlers.runOp`). A brain-only listing is therefore
linear in the slots scanned: about 1.2 s for 48 slots, 12 s for 512, 50 s for
2,048 and 13 minutes for the whole 256 × 128 bank (estimates from the per-turn
cost).

**Basis.** The rig's track bank is 256 tracks × 128 scenes (`RigConfig`), and
`Rig` marks `exists` and `hasContent` interested for every slot at init, so the
values are cached. `rig.scanTracks` (`CoreHandlers.rigScanTracks`) already
loops over every slot in one call but returns only a count. The cost of that
loop inside one call is unmeasured; its `scanMicros` field can measure it.

**Questions.**
- Reply shape: sparse occupied (track, scene) pairs, plus whatever track
  identity binds them to `list_tracks` (index, channel ID or name). Decide
  whether clip names or play state belong in it; the default is occupancy only.
- Projects beyond the bank window: report overflow as `track.list` does
  (`itemCount` against `bankSize`) and decide whether paging, as in B17, is
  needed now or only when a real project exceeds the window.
- Group tracks and nested tracks: confirm how the flat bank represents them.
- Freshness: whether the reply carries a revision mark, so that a following
  write can check that the listing is still current.

**Checks.** The new wire method changes the normal profile's method count and
hash: add a deliberate build marker, deploy with `./gradlew copyExtension`, and
have the operator replace the controller before `npm run probe:hello`. Ledger
row, call-budget test, description version bump with tests, and one focused
live check that times the call on a large grid and compares the listing with
`slot.status` reads. Check probe consumers of `rig.scanTracks` before changing
it.

## Session 3 — Overlays, clip annotations and provenance

**Question.** Should document 1.0 drop overlays entirely (nominal, groove,
tempo, meter, harmony, role, motif, region; SPEC R12–R24), keeping note IDs,
and replace them with durable clip provenance, a small set of clip-level
annotations, and stateless analysis tools (session 4)? Real use wrote only
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

**Uniform release velocity (proposal 8).** Choose one complete rule; the
operator ruled out a partial measure such as normalizing only MIDI import
(2026-11-08). The operator regards a clip-level default as the safest
candidate and is seriously considering a column binding, because release
velocity is rarely used.
- **Clip-level default.** A clip states its release velocity once; rows that
  match it omit the field. This amends R04, under which an omitted covered
  field means the portable default, and therefore D35.
- **Column binding.** The encoder binds a uniform or mostly uniform field as a
  column and omits it from the matching rows (a canonical-binding rule
  amendment). It could cover other uniform fields later.

Either rule must keep exact values, so that readback (D15) still compares
equal state. The evidence collected on 2026-11-08:
- D35 sets the default to 100/127 because Bitwig gives exactly that value to
  a drawn note and to a note written through the API (E235, E245). It was not
  a loudness choice. Drawn and API-written notes therefore already omit the
  field.
- MIDI 1.0 convention is 64 (40H): a device without release velocity sends
  note-offs at 64, and a receiver treats a note-on with velocity 0 as a
  note-off (a [secondary copy of the spec text](https://www.lim.di.unimi.it/IEEE/MIDI/SOT1.HTM);
  [Ardour issue 5797](https://tracker.ardour.org/view.php?id=5797)). The
  official MIDI Association text was not checked.
- MIDI import (`brain/src/midi/conversion.ts`, the `source.push` in the note
  pairing loop) takes a note-off's velocity byte and maps a note-on with
  velocity 0 to 64/127. A note-off at 0 (common in transcriptions) imports as
  0, a note-on at 0 or a note-off at 64 as 64/127, and Ghostnote's own export
  writes 100, so only its own files return without the field.
- The read side has the same problem: host clips can already hold a uniform
  0 or 64, from earlier imports or from keyboards that send the MIDI 64.
  Omitting that value from a read would state 100/127 under R04; writing
  that document back would change the notes or fail readback. Omission
  without a stated clip value is therefore not an option.

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

## Session 4 — Clip operations and stateless analysis tools

Design after session 3, because these tools replace what overlays were meant
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

### Session 1 (2026-11-08): complete

- **Trust verified writes.** The add and edit descriptions share one result
  statement: `verified` is a new read after the write, independent of the
  writer, and needs no second read; `readback.base` and the new
  `readback.clipId` serve the next edit; with `mintedIds` 0 every note keeps
  its ID. Both writers take `documentOutputPath`
  ([D70](../decisions/d70-clip-writers-return-the-read-back-document-as-a-file.md)):
  the read-back document goes to a new file, and an edit dry run writes the
  expected document. The destination is checked before any host call; a
  failed publication after the write adds warning `document-file-unwritten`
  and leaves the write applied.
- **Read to file.** `read_launcher_clip` now recommends `documentOutputPath`
  as `read_midi_file` does. Every inline document above 48 KB (both reads, a
  write readback, a dry run) returns warning `large-inline-document`. Each
  dry-run change list holds at most 64 entries, with `changes.truncated`
  naming the cut lists; plan keeps the counts.
- **Timing overlays.** The route and the read `reference` input request
  Timing overlays only when the user asks to record or analyze timing feel
  as claims; notes carry feel in their onsets. The reference's method keeps
  its steps behind the same condition. Model reference revision 6.
- **Checks.** Descriptions v60 (46 tools). All 2,612 brain tests pass (five
  new: writer clip ID and file output, an occupied output path refused
  before any host call, the large-inline warning, the dry-run cap) and the
  document conformance check matches. No wire, extension or call-budget
  change; the ledger is unchanged. A running MCP server must restart to load v60.
- **Live check (operator-approved, 2026-11-08).** The restarted MCP server
  served v60 and reference revision 6. `probe:hello` found a P01 worktree
  extension build (94 methods, `526cd7e3760580cc`, extra `chain.insert`)
  rather than main's 93-method golden; its diff from main touches only device
  and chain code, so the clip routes were main's. Connection healthy on
  `gn-scale-test`. On empty slot `gn-B` row 9: an add with
  `documentOutputPath` read back verified, `clipId` `c1`, `mintedIds` 0, file
  readback verified. A patch built only from that result (its base and clip
  ID, no read) dry-ran with the expected document to a file, then applied
  verified on the targeted route; the read-back file, the dry-run file and a
  later fresh read to file were byte-identical (sha256 `e067b280…`), and the
  fresh read was identity `current` on the written ref. An edit naming an
  existing output path refused `occupied` at stage input with no effect. The
  scratch clip was deleted and the slot reads empty. The add left the new
  clip's slot selected (no slot was selected before; warning
  `slot-selection-moved`).
