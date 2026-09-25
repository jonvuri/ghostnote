---
title: Phase 8a — Agent-native product posture and interface audit
kind: plan
state: planned
status: First Phase 8 session after the played-range consolidation live gate.
updated: 2026-09-25
parent: README.md
prev: ../phase-7/7b-follow-up-played-range-consolidation.md
next: 8b-runtime-and-surface-cleanup.md
evidence: E119-E129, E134; D4, D8, D16, D19, D20, D23
---

# Phase 8a — Agent-native product posture and interface audit

## Purpose

Decide how Ghostnote should complement a frontier agent that already has
reasoning, vision, clicking, and typing. Select a smaller, faster, and more
coherent product posture before the cache and compact-bar work harden the
current architecture.

This is a product and architecture investigation. It can recommend changes to
earlier verification, reversal, and interface decisions. It does not keep a
rule only because the current code implements it.

## Questions

1. Which structured observations are faster or more reliable than visual
   inspection?
2. Which typed actions improve materially on computer use?
3. Which workflow tools duplicate reasoning that the agent can perform?
4. Which checks prevented a measured failure, and which add only latency or
   ceremony?
5. Which changes need strong guards, independent readback, or owned reversal?
6. Which changes are cheap to observe and correct through Bitwig or computer
   use?
7. Which tool, address, result, and error conventions have diverged?
8. Which experimental profiles and formats should merge, graduate, or retire?

## Work

1. Inventory every public and experimental tool, module, profile, wire method,
   result family, change record, and custom format.
2. Trace real use through E120, E121, E127, E128, E129, the played-range live
   trial, and representative earlier dogfood.
3. Record observed latency, host calls, model round trips, result bytes or
   tokens, operator intervention, and failures caught by verification.
4. Classify each surface as sensor, limb, workflow, diagnostic, probe, or
   historical compatibility.
5. Compare each surface with the available computer-use route. Keep a typed
   route only when it improves precision, speed, observability, or repeatability.
6. Define risk tiers for read-only work, observable scalar edits, bounded note
   edits, structural changes, destructive actions, and external UI actions.
7. For each tier, select the minimum target check, conflict check, result
   evidence, readback, ownership, and reversal policy.
8. Review naming, addressing, pagination, errors, success results, change IDs,
   profiles, and discovery as one interface.
9. Produce a retain, merge, revise, retire, or defer decision for every item.
10. Identify earlier decisions that need amendment. State the evidence required
    before changing each one.

## Deliverables

- A concise agent-native product doctrine.
- A complete surface and runtime disposition table.
- A risk-tiered verification and reversal policy.
- A target tool vocabulary and shared address, result, and error conventions.
- Measured latency, call, and token baselines for representative workflows.
- An ordered migration list for 8b and 8h.
- A list of decisions and reference documents that need revision.

## Acceptance criteria

- Every current public tool and normal-runtime wire method has a disposition.
- Every retained safeguard names the measured failure or risk that justifies it.
- The audit does not treat computer use as either universally sufficient or
  universally untrustworthy.
- Destructive, ambiguous, and hard-to-observe changes remain distinct from
  cheap observable edits.
- The target surface removes duplicate authority and unnecessary format
  translations.
- The proposed reductions include measurable latency, call, or token goals.
- The plan preserves a stable comparison path for cache and interface work.
- No production behavior changes in this audit session.
- `context/check.rb` and `git diff --check` pass.

## Out of scope

- Implementing the cache.
- Freezing the compact-bar public specification.
- Removing methods before their product or probe owner is resolved.
- External publication.

## Retrospective target

Record the largest mismatch between the current architecture and actual agent
use. Prefer one concrete simplification over a general call for less ceremony.
