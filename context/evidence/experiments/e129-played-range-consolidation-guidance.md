---
title: E129 — Played-range consolidation guidance
kind: evidence
state: active
updated: 2026-09-24
parent: ../../plan/phase-7/7b-follow-up-played-range-consolidation.md
---

# E129 — Played-range consolidation guidance

## Current verdict

The offline gate passes. The independent live agent gate is pending one
interface decision. The subsequent design exploration selected one consolidated
compact clip direction instead of a narrow exact-source acquisition tool. The
live gate is paused until that interface has a fast acquisition route. No
temporary live clip was created, and the project has no test residue from this
session.

## Implementation

`exact-note-source.ts` now owns one pure clip-range diagnostic. It refuses a
non-zero loop start outside the existing `1e-9` host comparison tolerance. It
also refuses a note that starts before zero, starts at or after the local clip
length, or ends after that length.

The diagnostic keeps the exact clip address, local onset range, loop range, and
complete note-content range. Its remediation is:

> Select this clip in Bitwig and use Consolidate. Then read the clip and preview
> the change again.

Symbolic context checks every addressed clip before it filters events. The note
proposal compiler checks only clips targeted by insert, move, transpose, or
delete operations. Apply uses the same target check on fresh exact state before
the generic changed-source refusal. A refused apply does not write to the
workspace.

The exact source now retains finite negative note starts. This lets the shared
diagnostic give the required actionable refusal instead of losing that observed
state during source validation.

The experimental proposal tool description names the consolidation boundary.
No extension, wire method, named-action wrapper, consolidation transaction, or
low-level note-operation change was added.

## Offline verification

Focused tests cover:

- an offset 16-beat clip with loop and note content at beats 24 through 40;
- negative, at-end, and over-end note coordinates;
- compatible zero-based geometry;
- a non-zero play start and disabled looping;
- intentionally narrow symbolic coverage;
- all four targeted proposal operations;
- an incompatible unrelated clip;
- matching preview and fresh-apply refusal with no workspace write.

The complete brain check passes 1,169 tests. `ruby context/check.rb` and
`git diff --check` pass. The live deployment handshake is also current:
Bitwig 6.0.6, Controller API 25, extension 0.0.1, contract `ghostnote/0`, and
method hash `78368fe47ea0e814`.

## Live-gate boundary

The configured Ghostnote MCP server calls `registerTools` with the stable tool
profile. The played-range refusal is on the experimental agent-proposal profile.
That profile accepts a complete exact-note source, but neither profile exposes
an MCP tool that acquires this source for a fresh agent.

A fresh Codex chat therefore cannot reach the new proposal refusal through its
configured Ghostnote tools. Enabling the experimental profile alone does not
solve this. Adding an exact-source acquisition tool, changing the server profile,
or supplying prepared exact state to the trial would change the interface or
the trial method. The plan does not select one of these options.

The live inventory was read-only. It confirmed two existing affected clips in
`26.36-4 orangebeat`: row 0 on each `Deep House Kit` track has an offset loop.
No duplicate was made because the reachability decision must come first.

The current direction is recorded in
[the consolidated compact-bar design](../format/CONSOLIDATED_COMPACT_BAR.md).
The next session searches the full available Bitwig API for a constant-time or
near-constant-time launcher-clip read before it selects the acquisition
implementation.

## Retrospective

One semantic range check is sufficient offline. The live plan must also name
how an independent agent acquires exact source and enables the experimental
profile. Settle that seam before creating a temporary clip.
