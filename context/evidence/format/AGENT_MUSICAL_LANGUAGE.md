---
title: Ghostnote agent musical language — experimental reference
status: evidence-backed experimental draft
updated: 2026-09-13
scope: agent context views, proposal languages, exact-state boundary, and conformance
evidence: E109, E114–E116; D9, D15, D21
---

# Ghostnote agent musical language

## Status

Ghostnote has an agent-oriented musical domain-specific language. It is still
experimental. It is a context and proposal language, not the project-state
format and not a direct Bitwig command language.

The language has four boundaries:

1. Canonical exact state owns every host note field and identity.
2. A task selects one compact agent context view.
3. The agent returns a bounded proposal with a source-state guard.
4. A deterministic compiler validates complete candidate state before a live
   adapter write.

The exact-state layer, compiler, and independent readback remain authoritative.
Agent text never becomes authoritative project state.

## Version registry

| Name | Purpose | State |
|---|---|---|
| `ghostnote-agent-context-v0` | Common context envelope and compact event plane | Experimental pure module |
| `compact-bar-v0` | Default realized-note view | Selected by E114 and E115 |
| `groove-two-layer-v0` | Compact view plus a linked groove overlay | Selected by E116 for groove-sensitive work |
| `ghostnote-note-patch-v0` | Agent proposal form from E114 and E116 | Evaluated; product compiler is not built |
| `ghostnote-musical-patch`, version 1 | Current deterministic public generation and transformation request | Implemented; distinct from the agent proposal form |

Do not treat the two patch languages as aliases. The current public musical
patch requests deterministic operations. The experimental agent patch names
opaque source events and is designed for model proposals against one exact
source hash. Phase 7b decides how they compose or whether one replaces part of
the other.

## Modal context rule

Use the smallest view that contains the facts needed by the task.

| Task | Context mode |
|---|---|
| Transpose, delete, revoice, or reharmonize while preserving performed time | `compact-bar-v0` |
| Continue material without reasoning about timing intent | `compact-bar-v0` |
| Quantize nominal time while preserving selected deviations | `groove-two-layer-v0` |
| Scale, replace, or transfer swing, phase, cross-part timing, or local timing | `groove-two-layer-v0` |
| Explain whether an offset is intentional | Groove mode, with provenance and confidence; otherwise abstain |

Compact mode must not contain a groove block. Groove mode must contain one.
This rule keeps the extra timing vocabulary out of unrelated tasks.

## Common envelope

Every context declares:

- schema and mode;
- exact source SHA-256 identity;
- permission or ownership basis;
- beat, track, event, and omitted-field coverage;
- meter and a beat-based tempo map;
- harmony and named regions when available; and
- compact realized events with opaque identity, track, role, rational timing,
  pitch, velocity, mute, and optional articulation.

The compact plane omits host-only fields such as MIDI channel, release velocity,
and note expression when the task does not need them. The exact host state keeps
those values. A later patch preserves them unless a supported operation names
them.

Example:

```text
CONTEXT ghostnote-agent-context-v0 MODE compact-bar-v0
SOURCE aaaa...aaaa PERMISSION "generated MIT project fixture"
COVERAGE 0..2 TRACKS drums,guitar EVENTS 3 OMITS channel,noteExpression,releaseVelocity
METER 4/4
TEMPO 0 105
TEMPO 1/2 106
HARMONY 0 "E9sus4"
REGION main 0..2
EVENT f-h2 TRACK drums ROLE hat LAYER swung REGION main AT 17/64 DUR 1/16 PITCH 42 VELOCITY 72 MUTE false ARTICULATION normal
```

## Groove overlay

The groove block links timing facts to compact event IDs. It does not create a
second note identity set. A sparse block can cover only the events needed by the
task.

A timing reference declares a subdivision, phase, swing ratio, and point or
span shape. Each linked event declares nominal position and duration, realized
duration, reference identity, template contribution, cross-part contribution,
local contribution, signed total deviation, tempo-qualified milliseconds,
optional anchor, confidence, and provenance.

The conformance rule is:

```text
deviation = reference phase + template + cross-part + local
realized position = nominal position + deviation
```

The realized position and duration must equal the compact event. Deviation
milliseconds must use the tempo active at the nominal position.

Example:

```text
GROOVE ghostnote-groove-context-v0
REFERENCE funk-hat SUBDIVISION 1/4 PHASE 0 SWING 17:15 SHAPE span:1/128
TIMING f-h2 NOMINAL 1/4 NOMINAL_DUR 1/16 REALIZED_DUR 1/16 REF funk-hat TEMPLATE 1/64 CROSS 0 LOCAL 0 DEVIATION 1/64 DEVIATION_MS 8.928571 ANCHOR none CONFIDENCE 1 PROVENANCE declared:"generated-funk-control-v0"
```

This form distinguishes facts that the compact event cannot identify. The
performed position `17/64` does not by itself show whether the cause is template
swing, reference phase, a cross-part relation, or a local exception.

## Authority and failure rules

| Data | Authority |
|---|---|
| Host note state and opaque identity | Exact observation |
| Rational conversion and timing arithmetic | Deterministic rule |
| Harmony label or inferred timing intent | Derived result with provider or rule identity |
| Agent explanation and edit choice | Proposal |
| Applied note state | Independent complete readback |
| Musical quality | Operator verdict |

The context parser refuses duplicate identities, incomplete coverage, unknown
regions, unknown timing references, missing anchors, unreduced rationals,
inconsistent deviations, inconsistent realized timing, and incorrect
tempo-qualified milliseconds.

Unsupported live timing is a later compiler refusal. The current measured
family ends at `1/512` beat for binary timing and `1/768` beat for matched
triplet timing.

## Conformance suite

The pure implementation is in
[agent-context.ts](../../../brain/src/musical/agent-context.ts). The golden
corpus is in
[agent-context-corpus.ts](../../../brain/src/musical/agent-context-corpus.ts).
Its v0 fingerprint is
`988840b62a1e6d5cb0daa05185c0f33f176d2af77083e595f3c75a663de462b0`.

The suite has four layers:

1. Language tests validate modes, rational arithmetic, coverage, identity
   links, reference links, tempo-qualified timing, deterministic rendering, and
   refusal behavior.
2. The existing musical patch tests validate deterministic materialization,
   collision handling, preservation, stochastic seeds, and exact compilation.
3. The 6f, 6f1, and 6f2 probes test model comprehension, token cost, patch
   proposals, and reproducibility across model providers.
4. Live conformance and timing probes test adapter settlement, exact readback,
   refusal, reversal, and project cleanup.

Add every new language feature to the pure corpus before a model or live test.
Give each semantic change a new schema, mode, patch, or corpus version. Keep old
fingerprints frozen. A wording-only change that changes tokenization also needs
a reviewed corpus fingerprint.

## Dogfood gates

Phase 7 can connect this module to real project reads only after these checks:

- render one context from complete exact clip state;
- declare all omitted and unavailable fields;
- preserve one source hash through an agent proposal;
- show a complete planned before and after state;
- reject stale identity and timing loss before mutation;
- verify one accepted result through independent readback; and
- collect an explicit operator verdict for musical quality.

The module is not registered as a public tool. It has no Bitwig dependency and
cannot mutate a project.

## Workstation interface review

Phase 6i treats this language as one interface family in the full workstation
map. The review also covers public tool schemas, the extension wire protocol,
exact-state and change records, deterministic patch formats, reference and
sensory packets, documentation records, audio artifacts and facts, and preset
or donor manifests.

This language must own only compact agent context and bounded agent proposals.
It must not duplicate exact project state, deterministic operation requests,
wire transport, or provider result authority. Phase 6i checks those boundaries
and their producer-to-consumer seams. Phase 6j audits their verification and
translation cost. Phase 7f tests the selected seams during composed dogfood.
