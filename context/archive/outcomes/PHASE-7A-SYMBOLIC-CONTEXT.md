---
title: Phase 7a — Symbolic context and read-only analysis
kind: plan
state: complete
status: Complete. Exact live state now renders compact context; 7b is next.
updated: 2026-09-21
parent: ../../plan/phase-7/README.md
prev: ../../plan/phase-6/6j-verification-cost-audit.md
next: ../../plan/phase-7/7b-agent-patch-execution-and-reference-dogfood.md
---

# Phase 7a — Symbolic context and read-only analysis

## Purpose

Implement the selected agent-facing symbolic context as an independent,
read-only experimental module. Prove it in one real analysis and revision task
without writing the proposed revision.

## Work completed

1. Added `ghostnote-exact-note-source-v0`, `exact-note-json-v0`, the
   `exact-note-source-v0` hash domain, source-scoped event IDs and valid track
   aliases.
2. Connected complete snapshots to `ghostnote-agent-context-v0` in
   `compact-bar-v0` mode through `symbolic-context-v0`.
3. Added only `note-count-v0` and `pitch-span-v0` for the selected task.
4. Kept exact facts, derived measurements, inferred alternatives and authority
   records separate.
5. Added lazy module discovery, isolated startup, finite deadlines and correlated
   request/result checks.
6. Ran one live module-only analysis and returned an unapplied note proposal.

Music21 was not enabled. Its missing capability was explicit and did not block
the selected task. No paired MIDI decision needed S10.

## Result

[E120](../../evidence/experiments/e120-symbolic-context-connects-complete-live-state.md)
records the implementation fixtures, live context, exact hashes, timing,
unapplied revision and unchanged project boundary. S03, S04 and the in-process
S17 boundary are implemented. S05 remains conditional on a selected theory
task. S10 remains conditional on a paired decision.

The exact wrapper preserves complete host state. The agent receives only the
compact context and external source, provider, coverage and authority metadata.
The strict v0 context grammar and its golden fingerprint did not change.

## Acceptance record

| Criterion | Result |
|---|---|
| Source, coverage, schemas, providers and capabilities | Every symbolic result carries them. Missing Music21 is explicit. |
| Ambiguous theory | Controlled alternatives remain inferred evidence and do not enter exact facts. |
| Session 6f field preservation | Complete exact state keeps channel, release, recurrence and expression outside compact text. |
| Independent module | Supplied state renders without Bitwig, Python, capture, audio or documentation. |
| No project write | Live entry and exit marks and selection were equal. Effects were `none`. |
| Verification | Focused tests, 1,053-test brain check, live handshake, live module run, context check and diff check passed. |

## Verification cost

The 2,048-step reader used three pages and one reset for the selected four-beat
clip. Complete host acquisition took 2,321.882 ms. Exact canonicalization and
hashing took 10.811 ms. The cold module request took 18.285 ms and the warm
request took 0.775 ms. E120 lists non-overlapping local phases and nested adapter
spans. No optimization or verification reduction was made.

## Limits

- The module is experimental and is not a public tool.
- `compact-bar-v0` is the only enabled mode in this module profile.
- The task declared meter and tempo. The adapter did not observe them.
- No theory provider ran. Harmony, role and articulation stayed unavailable.
- The proposal is neither compiled nor validated. Session 7b owns that work.
- The run measures one small live clip. It does not define a latency SLA.

## Retrospective

The agent used pitch and the pitch-span measurement. It ignored velocity. The
integration exposed the live decoder's default mute elision. The projection now
names that live-only rule, while supplied state without mute still refuses.
