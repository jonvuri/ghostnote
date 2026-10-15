---
title: Phase 8i17 — MIDI musical navigation provider survey
kind: plan
state: planned
status: Reopen the provider survey for harmonic, rhythmic, and arrangement navigation.
updated: 2026-10-15
parent: README.md
prev: 8i16-midi-file-conversion.md
---

# Phase 8i17 — MIDI musical navigation provider survey

## Purpose

Test whether deterministic analysis can help an agent locate musical passages
without reading every note. The operator doubts that generic density or activity
summaries contain enough musical information. Test musically relevant harmony,
rhythm, repeated passages, and arrangement structure. Do not assume that a
compact overview is sufficient.

This survey can run independently of [8i16](8i16-midi-file-conversion.md).
First ship full inline MIDI conversion. The operator wants to test unaided agent
reasoning and measure actual token use before choosing an analysis interface.
No library install, paid model run, or public tool is part of this plan-only step.

## First operator baseline

[E266](../../evidence/experiments/e266-inline-midi-operator-trial.md) records
one completed unaided-agent task: three coherent drum excerpts from the
1,567-note large transcription. The agent used scripts to process the full
inline document and printed summaries and selected patterns. It did not read
all note rows into model context. This supports one task only; it does not
settle arrangement navigation or isolate MIDI token cost. Use the trial as a
baseline example. Freeze source tempo in future tasks: this trial inferred
126 BPM and played at 110 BPM; the earlier design assumption was 120 BPM.
The export coverage issue is fixed in E267.

## Prior evidence

- [E110](../../evidence/experiments/e110-wider-symbolic-provider-survey-selects-music21-and-musicpy.md)
  screened 12 projects and executed five. Music21 10.5.0 was selected for private
  analysis: 8/8 chord cores, two clear keys, but an incorrect definite choice on
  the ambiguous key control. Musicpy 7.15 passed 8/8 chord cores and four voicing
  operations. Partitura 1.9.0 tested key estimation and voice assignment; tonal
  tension remained a candidate. Tonal 6.4.3 returned 8/8 expected chord candidates
  but only 7/8 as first choice. Each executed provider repeated identically three
  times. These are historical versions and narrow controls, not current claims.
- E110 excluded jSymbolic and musif because they extract features rather than
  edit music. Reconsider them: extraction is relevant to this task. Neither had
  an executable evaluation in that survey. MusPy was excluded for lacking the
  required chord and voicing engine. MusicLang and Musicaiz had install blockers;
  review current compatibility before repeating those conclusions.
- [E112](../../evidence/experiments/e112-independent-survey-adds-probe-psychoacoustic-and-symbolic-perceptual-routes.md)
  identified midi-miner for spiral-array tonal tension and melody/bass/harmony
  track classification. It also named Partitura and allin1. These were candidates,
  not validated integrations. allin1 uses audio and is not a MIDI-only baseline.
- [E109](../../evidence/experiments/e109-exact-note-structure-is-the-semantic-boundary.md)
  tested custom motif, weak-subdivision, register, and voice-movement rules on
  small clips. Do not present them as a broad rhythm or segmentation library.
- [E117](../../evidence/experiments/e117-extracted-structure-is-the-reference-default.md)
  found better first-response validity with extracted structure. Main references
  covered only 8 to 16 beats. This does not prove full-arrangement navigation.
- [E120](../../evidence/experiments/e120-symbolic-context-connects-complete-live-state.md)
  connected exact state to compact context, but Music21 was unavailable. Current
  `brain/src/musical/symbolic-context.ts` renders supplied harmony evidence and
  measures note count and pitch span. It does not run a broad theory provider.
  `brain/src/musical/theory.ts` contains the existing Tonal boundary.
- Retained executable probes: `brain/src/probes/phase6e-provider-survey.py`,
  `phase6e-semantic-analysis.py`, and `phase6g-reference-transfer.py`.

## Tasks and method

1. Freeze tasks and operator-marked target spans before provider selection.
   Include “extract the drum groove from the breakdown in the third section.”
   Include repeated sections, fills, sparse passages, changing harmony, ambiguous
   sections, and transcription errors. Test complete arrangements, not only loops.
2. Separate harmonic interpretation, rhythmic description, repetition matching,
   boundary detection, and functional section labels. A deterministic algorithm
   can still give an incorrect musical interpretation.
3. Review primary sources, current maintenance, licenses, installation, and
   dependency cost. Start with Music21, Partitura, midi-miner, jSymbolic, musif,
   and the existing Tonal code. Add candidates for missing rhythm and segmentation
   operations. Prefer existing libraries to broad custom theory code.
4. Compare full notes alone, basic structural summaries, musical analysis plus
   targeted reads, and a combined view. Keep model settings and task inputs equal.
   Measure target-span accuracy, operator agreement, refusals, tokens, calls,
   latency, repeatability, and recovery from a wrong overview. Freeze a bounded
   model-run plan before any paid evaluation.
5. Keep source coverage, timing map, meter, downbeat origin, provider version,
   alternatives, and uncertainty explicit. Correct tempo alone does not establish
   bar alignment. Do not assign velocity dynamics to placeholder-velocity input.
6. Use the six local `good lies` files as optional operator material (source MIDI marks 60 BPM;
   fix the target tempo for each task using the E266 evidence). Use generated fixtures for repository tests. Do not
   redistribute personal note content. Test related parts together where musical
   context is required; a solo drum file may not identify arrangement sections.

## Acceptance and handoff

Record an operation-by-operation provider verdict and executable evidence.
Distinguish tested ability from documented capability. State whether the musical
overview can locate the operator's spans and how much note context it still needs.
Keep negative results. Recommend an interface only after this test; file storage
alone does not solve first-read comprehension. Record token results from real
client usage separately from local tokenizer estimates.

Initial estimates from the design discussion: current FIELDS uses about 28 to
30 tokens per note on the transcriptions, including release velocity. The six
files measured 1,038 to 47,910 tokens with o200k_base; cl100k_base differed by at
most one. A repeated 10,000-note drum case used 288,720 tokens. These are local
payload measurements, not billed client usage or a universal tokenizer bound.

## Retrospective target

Did the task matrix prevent a feature-extraction library from being rejected for
an unrelated editing requirement? Did the summaries preserve the musical facts
needed for the decisions?
