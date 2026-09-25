---
title: Compact-bar rationale
kind: reference
state: active
updated: 2026-09-25
parent: CONSOLIDATED_COMPACT_BAR.md
---

# Compact-bar rationale

## Purpose

Compact-bar is a task view for an agent that reads and edits music in a live
project. It keeps musical structure visible and keeps edit targets stable. It
is not a general score, performance, interchange, or live-coding language.

The current benchmark profile includes:

- opaque note IDs;
- exact rational starts and durations;
- track, role, region, meter, harmony, pitch, and velocity; and
- a source digest for guarded edits.

Complete host state stays outside this view. A compiler resolves identities,
preserves unnamed fields, applies named insertion defaults, and checks the
complete candidate. This boundary is more important than the spelling of one
event line.

## Goals

Compact-bar must make these tasks direct:

- find musical structure by bar, role, region, and event;
- refer to one existing note without guessing its order;
- express off-grid time without rounding it to a notation grid;
- request a small edit without reconstructing a complete clip;
- keep omitted host fields under compiler control; and
- use materially fewer bytes and tokens than exact JSON.

The fixed Phase 8c corpus meets the Phase 8 byte target. Compact-bar uses
12,148 bytes for all three fixtures. Exact JSON uses 36,402 bytes. The ratio is
33.4%. Per fixture, the ratio is 32.7% to 38.5%.

The dated provider run used 5,513 input tokens for compact-bar and 12,534 for
exact JSON on GPT-5.4 Mini. It used 6,255 and 13,264 on Gemini 3.8 Flash. These
are prompt-specific results, not format constants.

## Non-goals

Compact-bar does not try to replace:

- ABC or LilyPond for printed or exchanged notation;
- Tidal or Strudel for cyclic pattern construction and live transformation;
- Alda for text-based composition and playback;
- MIDI-Like, REMI+, or OctupleMIDI as model input encodings; or
- exact JSON as a complete diagnostic control.

It also does not prove model training familiarity. The comparison measures
observed behavior only. It makes no claim about private training corpora.

## Current status

The Phase 8c text is a benchmark profile. It does not freeze the later public
syntax. [Phase 8f](../../plan/phase-8/8f-consolidated-compact-bar-and-cache-contracts.md)
must select the grammar, D23 timing boundary, defaults, identity rules, and
complete-document semantics.

The reusable package is in the
[compact-bar v0 benchmark](../../../brain/benchmarks/compact-bar-v0/README.md).
[E137](../experiments/e137-compact-bar-prior-art-and-benchmark.md) records the
result.

## Evidence boundary

[E114](../experiments/e114-bar-context-and-guarded-note-patches-pass-two-models.md)
first selected compact events and guarded patches.
[E115](../experiments/e115-established-syntax-does-not-beat-compact-bar-context.md)
tested published labels and equal grammar instructions. The fixed
[legacy baseline manifest](../../../brain/benchmarks/compact-bar-v0/legacy-baselines.json)
maps those claims to their retained fixture and scorer sources.

Current live evidence is separate. [E120](../experiments/e120-symbolic-context-connects-complete-live-state.md)
connects complete live state to one compact read. [E121](../experiments/e121-guarded-agent-note-patches-pass-live-reference-dogfood.md)
proves one guarded live write and exact readback. [E129](../experiments/e129-played-range-consolidation-guidance.md)
proves a range refusal, visible consolidation, reacquisition, one write, and
reversal. None of these live runs is a direct provider-format comparison.
