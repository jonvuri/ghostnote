---
title: Phase 2, session 2g — MCP clip surface v1
kind: plan
state: planned
updated: 2026-08-16
parent: README.md
prev: ../../archive/outcomes/PHASE-2-SESSION-2F-APPLICATION-PLANNER.md
next: 2h-conformance.md
scope: Phase 2 public tool surface
evidence: E20c, E22 · D18–D20
---

# Phase 2, session 2g — MCP clip surface v1

> **Purpose.** Expose the proven musical planner through a small public surface
> that an agent can use without learning one tool per musical verb.

## Scope

1. Implement the tool grain settled in 2a. The starting shape is one generation
   tool and one existing-content transformation tool that share the versioned
   musical patch grammar.
2. Keep low-level note and clip lifecycle tools available for exact requests.
   Do not duplicate their behavior inside a broad musical tool.
3. Review names, titles, descriptions, schemas, privilege classes, result text,
   and required procedures as one public artifact.
4. State object scope, beats and channel units, direct-write behavior, merge or
   replace behavior, loss reports, clip-block rules, and reversal limits.
5. Preserve the D20 name boundary. A destructive operation cannot share a tool
   name with generation, transformation, or other benign work.
6. Create a new description-cohort identity. Do not edit the frozen
   `ghostnote-description-v1` artifact in place.
7. Extend observation only with fields needed to evaluate musical tool choice and
   usefulness. Keep raw instruction, tool version, result identity, and operator
   response.
8. Smoke the public path through an ordinary MCP client.

## Out of scope

- new musical algorithms or adapter methods;
- a tool per chord, scale, or transform;
- automatic surface changes from one anecdote;
- a web UI.

## Exit criteria

1. Every 2a corpus request can use the public surface without a bespoke tool.
2. Schema validation catches incompatible patch versions and invalid musical
   inputs before a write.
3. Every write tool reaches the project only through the 2f planner and
   `Workspace.apply`.
4. The description golden fails on an unversioned public change.
5. Lexical and privilege tests cover the complete new cohort.
6. An ordinary MCP client generates, transforms, reads, reverts, and opens a
   changed clip in Bitwig.
7. Focused tests, full offline tests, typecheck, context check, and
   `git diff --check` pass.
