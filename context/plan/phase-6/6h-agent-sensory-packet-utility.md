---
title: Phase 6h — Agent sensory-packet utility
kind: plan
state: planned
status: Run after 6g. Test whether deterministic evidence improves agent decisions.
updated: 2026-09-13
parent: README.md
prev: 6g-reference-conditioned-continuation-and-structural-transfer.md
next: 6i-workstation-contract-synthesis.md
---

# Phase 6h — Agent sensory-packet utility

## Purpose

Test whether compact deterministic evidence improves host-agent reasoning for
MIDI revision and sound design. Select facts that help the agent choose an edit.
Reject facts that add tokens or false confidence without improving the result.

The agent owns interpretation and edit choice. Providers supply facts,
estimates, coverage, and uncertainty. The operator owns aesthetic acceptance.

## Starting facts

- [E105](../../evidence/experiments/e105-ffmpeg-and-librosa-form-the-audio-fact-boundary.md)
  selects typed audio facts and estimates with exact source coverage.
- [E109](../../evidence/experiments/e109-exact-note-structure-is-the-semantic-boundary.md)
  and [E110](../../evidence/experiments/e110-wider-symbolic-provider-survey-selects-music21-and-musicpy.md)
  select exact note facts and replaceable theory helpers.
- [E113](../../evidence/experiments/e113-loudness-beats-the-affect-head-but-the-reference-gate-blocks-selection.md)
  shows that uncontrolled loudness can dominate an affect comparison. It also
  selects no perceptual provider.
- [E112](../../evidence/experiments/e112-independent-survey-adds-probe-psychoacoustic-and-symbolic-perceptual-routes.md)
  identifies untested psychoacoustic and symbolic routes. These are candidate
  measurements, not listener judgments.

## Packet arms

Compare the same task under these input conditions:

1. Exact source identity and raw notes or audio identity only.
2. Raw deterministic facts and estimates.
3. A task-routed packet with facts, paired deltas, segments, coverage,
   uncertainty, and explicit limits.

Do not add a metric merely because a provider exposes it. Each field needs a
declared decision it might improve.

## MIDI facts

Use a bounded subset of:

- chord and key alternatives;
- interval-class consonance or dissonance;
- voice-leading movement;
- register, density, and onset structure;
- syncopation and motif recurrence;
- symbolic tension curves; and
- reference similarity and exact-copy measurements.

## Audio facts

Use a bounded subset of:

- integrated loudness, peak, silence, and clipping;
- crest or dynamic behavior;
- spectral rolloff and other selected spectral measures;
- voiced pitch and voiced fraction;
- onset density;
- stereo correlation;
- modulation rate; and
- before-and-after segment deltas.

Measure a new psychoacoustic fact only when the task needs it and the provider
has a usable license and independent control.

## Tasks

1. Diagnose which controlled version changed in the requested direction.
2. Select one edit from a fixed, reversible candidate set.
3. Propose a bounded MIDI patch that changes one measured property while
   preserving declared invariants.
4. Explain which facts support the proposal and which facts are insufficient.
5. Predict whether the change is likely audible or musically material.
6. Submit valid results for a blind operator comparison.

Level-match audio comparisons unless loudness is the explicit target. Include
silence, no-change, contradictory-fact, and irrelevant-metric controls. Use
owned or generated audio and MIDI fixtures. A small disposable Bitwig cohort is
allowed only when static fixtures cannot test the decision.

## Measurements

- objectively correct direction choices;
- constraint satisfaction after the proposed edit;
- abstention on insufficient or contradictory evidence;
- unsupported perceptual claims;
- operator preference and cannot-decide rate;
- tokens, tool calls, retries, and latency; and
- packet fields used in the agent's stated reason.

## Acceptance criteria

- All packet arms use the same source pairs, tasks, and agent settings.
- Facts, estimates, agent interpretations, and operator verdicts remain
  separate in every result.
- Loudness-controlled tasks cannot pass through an uncontrolled level cue.
- Silence and no-change controls do not receive confident directional labels.
- The result selects a minimal MIDI packet and a minimal audio packet, or
  records that the packets do not improve decisions.
- Each selected field has a provider, version, unit or type, source identity,
  coverage, uncertainty rule, and explicit decision purpose.
- No public perceptual provider or broad analysis tool is added.
- All owned live and generated artifacts are removed.

## Out of scope

- Treating deterministic metrics as aesthetic truth.
- Training a perceptual model or fitting a probe.
- Selecting a result without an operator verdict.
- Productizing capture, audio analysis, or symbolic analysis.

## Retrospective target

Record which packet field improved a decision and which field only added
ceremony.
