---
title: E120 — Symbolic context connects complete live state
kind: evidence
state: active
updated: 2026-09-21
parent: ../../plan/phase-7/7a-symbolic-context-and-read-only-analysis.md
---

# E120 — Symbolic context connects complete live state

## Verdict

The experimental symbolic module now accepts complete exact note state and
renders the frozen compact context. The live module-only run explained one
complete clip and returned an unapplied revision. It made no project write.

S03, S04 and the in-process part of S17 are implemented. S05 was not enabled
because the selected task did not need theory. S10 was not selected. Missing
Music21 reduced the descriptor to `degraded` without disabling exact rendering
or the live Bitwig adapter.

## Implemented boundary

`ghostnote-exact-note-source-v0` wraps one or more complete snapshot clips. It
keeps the captured revision mark, guarded addresses, complete track and clip
metadata, all 16 MIDI channels, and every observed `NoteRecord` property. The
`exact-note-json-v0` serializer sorts clips, channels, notes and object keys. The
exact-source boundary rejects undefined or non-finite values, duplicate note
keys, incomplete reads, stale generations and inconsistent address guards. Its
SHA-256 domain is `exact-note-source-v0`.

The wrapper creates source-scoped event IDs and valid `t-N` track aliases after
it hashes the exact payload. These derived maps are not part of the source hash.
The compact projection keeps the full exact source outside agent text. It names
all omitted and unavailable fields, preserves source and provider versions, and
separates exact facts, deterministic measurements, inferred alternatives and
annotation authority.

The local `ghostnote-workstation-module-v0` registry discovers modules without
starting them. The first relevant request starts only its selected module. It
checks request ID, source digest, accepted and emitted schemas, deadline and
response correlation. Missing startup dependencies and late or mismatched
responses fail only that module.

## Conformance fixtures

The S03 fixture has two clips, all 16 channels, raw host track IDs that are not
valid context identifiers, non-ASCII metadata, reordered object keys, negative
zero, a `1/768`-beat duration, recurrence and optional expression. It pins the
canonical source digest:

`2b840c8ba867ca2496120ae8c81d49e4e99835fc40d1f5d2a71c431a848f37fc`

The tests also cover duplicate notes, missing, unreachable and unstable reads,
non-finite values, incomplete channel coverage, stale generation and inconsistent
address guards. Unicode is not normalized. Ordered recurrence tuples remain
ordered.

The S04 fixture maps two same-pitch notes on different MIDI channels to distinct
event IDs. It covers exact rational conversion, invalid raw track IDs, absent
musical intent, selected and ambiguous harmony evidence, annotation coverage,
field authority, empty-context refusal, missing tempo, stale generation,
unsupported measurements and live default mute elision. An ambiguous harmony
keeps its alternatives and does not become an exact fact.

The S17 fixtures prove inert discovery, isolated missing Python, continued
Bitwig-adapter availability, supplied-state rendering without Bitwig, response
correlation, timeout refusal and no automatic retry. No provider was installed.

## Live module-only run

The root was the current Codex IDE session. The client was Codex on the host's
GPT-5 family. The exact model build and reasoning setting were not exposed to
the repository run, so the record does not invent them. The enabled stable
boundary was Bitwig adapter `ghostnote/0`. The enabled experimental module was
`ghostnote-symbolic-context` version 0. Permission covered one read-only analysis
of the selected clip. Starting Bitwig was the only external application action.
There was no project write, file artifact, capture or operator audition verdict.

The run used the selected launcher clip on `gn-sel`, row 0, in
`gn-scale-test`. The entry and exit marks were equal: revision 0, scene epoch 3,
content epoch 32790, generation
`dc2c3b09-a337-44b5-80e3-14cb708d0c7c`, 10 tracks and 10 scenes. The selected
track and row also stayed at 7 and 0. Effects were `none`.

Bitwig Studio 6.0.6 used Controller API 25 and extension 0.0.1. The deployed
method hash was `78368fe47ea0e814`. The reader advertised 2,048 steps. The
four-beat dual-grid read used three bulk pages and one page-zero reset. It read
one clip, 16 channels and three notes. The exact canonical payload was 2,287
bytes with source hash
`583479b910d2d3ae10c9ceb7acf56c63813be6672152110208f930bd98084960`.

The compact text was 775 bytes with context-domain hash
`b2d85d362baa192398506e5a20d41cb825cf37629118efe201d3e55d70ad7c89`.
The task declared 4/4 and 120 BPM. These were task inputs, not host observations.
The exact events were:

- `e-1`: MIDI 48, beat 0, duration 4, velocity 100.
- `e-2`: MIDI 55, beat 0, duration 4, velocity 100.
- `e-3`: MIDI 60, beat 0, duration 4, velocity 100.

The deterministic measurements were three notes and a 12-semitone pitch span.
Harmony, musical role and articulation were unavailable. The live note decoder
omits default `isMuted: false`. The projection applies that named live-adapter
default only for a live source and records its authority and warning. Supplied
state without an observed mute value still refuses. The frozen v0 renderer also
prints `ARTICULATION normal` when the optional field is absent. The result warns
that this token is not an observation.

## Agent explanation and unapplied revision

Exact facts show three equal-velocity notes with the same onset and four-beat
duration. The pitch content is C3, G3 and C4. The 12-semitone measurement covers
one octave. The description “a sustained open fifth with an octave-doubled C”
is an agent interpretation. It is not a theory-provider fact.

The agent proposed moving the middle voice up one octave. This would leave C3,
C4 and G4 and increase the predicted span to 19 semitones:

```json
{
  "schema": "ghostnote-note-patch-v0",
  "base_sha256": "583479b910d2d3ae10c9ceb7acf56c63813be6672152110208f930bd98084960",
  "ops": [
    { "op": "transpose", "note_ids": ["e-2"], "semitones": 12 }
  ]
}
```

The proposal is an edit request only. Session 7a did not compile, validate or
apply it. Session 7b owns complete candidate validation and any later write.

## Timing

The live run measured these separate boundaries. Child adapter spans are inside
the host-acquisition total and must not be added to it.

| Boundary | Elapsed time |
|---|---:|
| Complete host acquisition, inclusive | 2,321.882 ms |
| Exact-source canonicalization and hash | 10.811 ms |
| Cold source validation | 0.560 ms |
| Cold projection | 0.454 ms |
| Cold strict context validation | 4.455 ms |
| Cold render and context hash | 11.609 ms |
| Cold module request, inclusive | 18.285 ms |
| Warm source validation | 0.113 ms |
| Warm projection | 0.123 ms |
| Warm strict context validation | 0.175 ms |
| Warm render and context hash | 0.276 ms |
| Warm module request, inclusive | 0.775 ms |

The measured adapter child spans were 235.370 ms for target acquisition,
23.979 ms for metadata, 50.799 ms for page turns, 435.756 ms for grid
settlement, 546.456 ms for bulk page reads, 150.787 ms for the page reset,
1.575 ms for reconciliation and 49.355 ms for selection restoration. Host waits
and bridge work explain the difference from the local format costs.

These values describe one small live clip on this workstation. They do not set
a product SLA or a larger-clip bound.

## Verification and cleanup

The focused 7a suite passed 11 tests. The full brain check passed 1,053 tests.
The live handshake passed against the deployed extension before the module run.
The run used no capture, audio, documentation, theory or model provider. No
temporary project object, generated file, provider environment or test residue
was created.

## Retrospective

The agent used event pitch and `pitch-span-v0` to choose the revision. It ignored
velocity because all three values were equal and velocity was outside the task.
The live default-elision rule was the useful integration finding. A supplied
exact state must not inherit that adapter-specific rule.
