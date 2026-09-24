---
title: Phase 7b follow-up — Consolidated clip acquisition
kind: plan
state: active
status: Planned. Prove sparse observer enrichment, then expose one guarded normalized acquisition boundary.
updated: 2026-09-24
parent: 7b-agent-patch-execution-and-reference-dogfood.md
prev: 7b-follow-up-constant-time-launcher-reads.md
next: 7b-follow-up-played-range-consolidation.md
evidence: E24, E51-E54, E116, E119-E121, E129-E130
---

# Phase 7b follow-up — Consolidated clip acquisition

## Purpose

Implement the smallest complete launcher-clip acquisition boundary after E130
proved sparse step-data occupancy replay. Return one normalized compact source
for analysis and guarded writes. Keep the existing exact reader as the
comparison authority until sparse targeted enrichment proves equal coverage.

## First proof: sparse enrichment

The agent-facing document uses a `1/512`-beat realized-time lattice. This does
not prove that one `1/512` step-data view discovers every stored note.

Create one owned controlled fixture with:

- straight and triplet starts through the measured timing floors;
- short and long extents with empty spans;
- notes on all 16 MIDI channels;
- adjacent and overlapping same-pitch notes; and
- every readable optional note field.

Collect the settled `NoteOn` coordinates from `addStepDataObserver` on the
selected 2,048-step cursor. Read all 16 MIDI channels only at those coordinates
with `getStep`. Read each required extent page. Normalize the result and the
existing complete dual-grid result to the proposed lattice. Compare identity,
timing, channels, fields, and late content.

Measure a bounded settlement rule because the observer has no completion
signal. If one grid omits or merges content, test the smallest complete
multi-grid sparse acquisition. If sparse enrichment cannot prove completeness,
keep the existing complete reader. Record the exact failure shape.

## Acquisition boundary

Add one experimental typed acquisition route. It must:

1. resolve one launcher clip by durable track identity and row;
2. capture metadata and complete note coverage across all 16 channels;
3. normalize supported timing into one compact source;
4. state whether the result is authoritative or best-effort;
5. include project, target, content, and source-digest guards; and
6. refuse ambiguous identity, incomplete coverage, unsupported geometry, or a
   normalization collision.

Keep raw host observations internal. Do not expose the E130 reflection probe or
raw step pages as the agent interface.

## Cache boundary

Start without a cache. Measure the selected complete acquisition on short and
long, sparse and dense fixtures. Separate target acquisition, observer
settlement, targeted host reads, bridge transfer, normalization, and total wall
time.

Add an extension mirror only if it reduces a real repeated-read cost. A mirror
must start from a complete scan. Mark warm data as best-effort unless every
missed observer event has a reliable invalidation signal. Invalidate on target,
project, scene, content, grid, or callback uncertainty. Use a complete scan for
a fresh authoritative request.

## Agent connection

Register the route only in the experimental workstation profile. Give a fresh
agent enough source state to reach the E129 played-range refusal. Do not resume
the E129 write trial until acquisition coverage, identity, and freshness pass
independent tests.

## Acceptance criteria

- A controlled comparison proves whether one `1/512` sparse view and targeted
  enrichment are complete.
- The selected host reader preserves every note, channel, and supported field.
- The agent-facing result uses one normalized lattice and detects collisions.
- One identified launcher clip has explicit identity and freshness guards.
- Authoritative and best-effort results cannot be confused.
- Any cache has explicit invalidation and complete-scan fallback rules.
- Timing separates host, bridge, normalization, and total work by extent and
  note density.
- The experimental profile can acquire the exact source needed by E129.
- Owned fixtures are removed, and the live project returns to its baseline.
- Focused tests, the full brain check, extension tests, `context/check.rb`, and
  `git diff --check` pass.

## Out of scope

- A stable public clip-document contract.
- Permanent host clip identity.
- Private or obfuscated Bitwig runtime methods.
- Physical MIDI export or project-file parsing as fresh state.
- A focus-dependent named action.
- The E129 consolidation and write trial itself.

## Completion and return route

After the acquisition route passes, resume the
[played-range consolidation trial](7b-follow-up-played-range-consolidation.md)
in a fresh agent session. Use the new route to reacquire state before and after
visible consolidation.

## Retrospective target

Record whether the agent-facing timing lattice was incorrectly assumed to be a
complete host discovery grid. Keep representation and acquisition claims
separate.
