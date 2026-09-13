---
title: Phase 6g — Reference-conditioned continuation and structural transfer
kind: plan
state: planned
status: Ready. E116 selects the groove context and timing contract.
updated: 2026-09-13
parent: README.md
prev: 6f2-groove-intent-and-microtiming-reproducibility.md
next: 6h-agent-sensory-packet-utility.md
---

# Phase 6g — Reference-conditioned continuation and structural transfer

## Purpose

Test whether a host agent produces better musical work when it receives useful
reference context. Compare raw excerpts, extracted structure, and one bounded
specialized continuation model.

This session calls the approach reference-conditioned borrowing or structural
transfer. It measures both useful similarity and direct copying.

## Starting facts

- E114 selects compact bar context and exact guarded patch forms.
- E115 keeps compact bar context as the ordinary event view.
- E116 selects `ghostnote-groove-context-v0` for groove-sensitive tasks. It
  extends live binary timing through `1/512` beat and triplet timing through
  `1/768` beat.
- E109 did not test continuation, style transfer, or reference-conditioned
  generation.
- E110 selects deterministic analysis and voicing helpers, not a creative
  authority.
- [Notochord](https://arxiv.org/abs/2403.12000) is a low-latency probabilistic
  model for structured MIDI events. It supports MIDI prompting, constrained
  sub-event sampling, harmonization, and continuation.
- Its [reference implementation](https://github.com/Intelligent-Instruments-Lab/notochord)
  processes ProgramChange, NoteOn, and NoteOff events. Do not infer complete
  Ghostnote note-expression coverage.
- The Notochord reference checkpoint was trained on the Lakh MIDI dataset. Code,
  checkpoint, and training-data provenance remain separate selection inputs.

## Reference boundary

Use only operator-owned, generated, public-domain, or permissively licensed
reference material. Record the source, license or ownership basis, content hash,
musical range, and exact excerpt used in each arm.

Do not treat a similarity threshold as a legal conclusion. Report exact overlap
and provenance so the operator can decide whether a result is acceptable.

## Tasks

Use at least three independent seed and reference pairs. Cover:

1. Continue a seed for four or eight bars.
2. Produce a variation that keeps one motif identity.
3. Transfer groove and accent structure into new harmony.
4. Transfer harmonic rhythm or voice-leading behavior into a new melody.
5. Apply arrangement roles from one reference to another seed.
6. Combine structure from one reference with rhythm, density, or voicing from
   another.

Keep target length, meter, pitch range, track roles, and required invariants
explicit. A withheld source continuation is a comparison, not the correct
answer.

## Comparison arms

- host agent with the seed only;
- host agent with raw reference excerpts;
- host agent with extracted reference facts and structure;
- host agent with extracted structure plus selected excerpts;
- Notochord prompted by the same MIDI prefix; and
- one deterministic transformation baseline where the task permits it.

Use Notochord only as a bounded experimental baseline. Confirm code and weight
terms, installed size, memory, startup, latency, determinism controls, supported
events, and checkpoint provenance before download. Do not add it to the product
dependency graph in this session.

## Measurements

- seed and hard-constraint preservation;
- requested reference-trait transfer;
- pitch, rhythm, contour, harmony, density, and role similarity;
- exact event, note-sequence, and rhythm-sequence overlap;
- longest unchanged musical span;
- syntax, patch, and compiler success;
- correction turns, token use, latency, memory, and failure behavior; and
- blind operator preference between valid outputs.

Keep objective measurements, agent explanations, and operator judgments in
separate fields. Randomize presentation order for operator comparisons.

## Acceptance criteria

- Every arm receives the same seed, task, limits, and permitted reference data.
- Each result declares reference identity, source permission, model or provider
  version, and exact input coverage.
- Direct copying and structural similarity are measured separately.
- Invalid notes, collisions, timing loss, and broken invariants refuse before a
  live write.
- The result identifies which reference form improves valid output and operator
  preference, or records that reference context does not help.
- The result classifies Notochord as useful baseline, future specialist, or
  rejected for this direction.
- No public generation tool or product dependency is added.
- No retained third-party MIDI, model cache, or live project artifact remains.

## Out of scope

- Training a model on the operator's library.
- Claiming that imitation metrics prove legal safety.
- Unbounded song generation.
- Automatic aesthetic acceptance.
- Publishing generated work or reference material.

## Retrospective target

Record whether raw excerpts or extracted musical structure supplied the useful
reference signal.
