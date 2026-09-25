---
title: Phase 8d — Cache identity and lifecycle
kind: plan
state: planned
status: Resolve operational identity and recovery before selecting the cache contract.
updated: 2026-09-25
parent: README.md
prev: 8c-compact-bar-prior-art-and-benchmark.md
next: 8e-cache-scale-limits-and-degradation.md
evidence: E2, E3, E16s, E19, E130-E134; D6, D23
---

# Phase 8d — Cache identity and lifecycle

## Purpose

Determine how a project-wide clip cache follows live Bitwig state through
structural change, project change, and controller restart. Resolve the stale
scene-index result from E134 as an identity and address-lifecycle problem.

Do not implement the product cache in this session. Use a temporary probe and
the stable E131 reader as comparison authority.

## Starting facts

- Bitwig supplies durable track channel IDs but no durable launcher-clip ID.
- A pinned clip proxy can keep the correct content after scene compaction while
  its reported scene index stays stale.
- Launcher-content observers can report moves while the controller remains
  loaded.
- D23 accepts one MIDI channel, pitch, and `1/512` cell as normalized note
  identity.
- E134 proves fixed-view correctness only for its measured lifecycle cases. It
  does not prove save, close, and reopen recovery.

## Lifecycle matrix

Cover these cases with exact entry and exit state:

- note add, remove, move, and field-only edit;
- clip create, delete, move, duplicate, replace, and clear;
- scene create and deletion before, at, and after an observed clip;
- track create, move, duplicate, group change, and deletion;
- identical clips at several addresses;
- user edits through Bitwig while Ghostnote remains connected;
- controller unload and reload;
- project save, close, reopen, and switch to another project;
- project switch back to the first project;
- callbacks that arrive after a structural epoch changes; and
- a failed or interrupted registry rebuild.

Use populated canary transitions before every observer replay conclusion. Treat
callbacks as channel-free coordinate invalidations and reconcile all 16 MIDI
channels.

## Identity questions

1. Which proxy state survives compaction, movement, deletion, and replacement?
2. Which address fields become stale, and which event exposes that fact?
3. Can one session-local logical clip ID follow an unambiguous move?
4. When do content and address evidence identify one clip, and when are two
   identical candidates ambiguous?
5. Which structural events permit incremental address repair?
6. Which events require a complete slot-registry rebuild?
7. What survives a controller reload or project reopen?
8. How does a project generation invalidate prior handles, logical IDs, dirty
   work, and agent patch bases?

## Required outputs

- A state machine for cache entries, addresses, observers, health, and project
  generation.
- An explicit distinction between logical clip identity, current address, slot
  identity, and content fingerprint.
- Incremental repair rules and complete rebuild triggers.
- Ambiguity and replacement rules that never guess between identical clips.
- Cancellation rules for late callbacks and in-progress rebuilds.
- A list of lifecycle facts that the Controller API cannot prove.
- Inputs required by the compact-bar clip-reference contract in 8f.

## Acceptance criteria

- Every lifecycle arm compares normalized cache state with a fresh settled
  `1/512` scan and records any E131 diagnostic difference separately.
- Scene compaction has a repeatable explanation and recovery rule.
- Clip deletion and replacement cannot preserve the old clip's logical identity
  silently.
- Project change invalidates all prior handles and pending work.
- Save, close, reopen, and controller reload have explicit recovery results.
- Identical-candidate ambiguity refuses or mints new identities; it never
  guesses.
- Incremental repair and complete rebuild have separate measured costs.
- The probe leaves no project residue and the stable extension is restored.
- Focused checks, the brain check, extension checks, context check, live hello,
  and `git diff --check` pass.

## Out of scope

- Selecting maximum observer counts or memory budgets.
- Freezing public compact-bar syntax.
- Making cached reads authoritative.
- Permanent cross-project clip identity.

## Retrospective target

Record the smallest event set that can keep the registry correct. If no event
set is sufficient, prefer an explicit rebuild over additional identity guesses.
