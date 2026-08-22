---
title: Phase 4, session 4h1 — device observer efficiency
kind: plan
state: complete
status: Complete. E61 removes the remote page loop and stabilizes plugin scalar completion.
updated: 2026-08-22
parent: README.md
prev: 4h-device-performance-gate.md
next: 4i-device-surface.md
scope: Bounded remote inventory and stable plugin scalar completion
evidence: E55, E58, E59, E60 · D7, D10
---

# Phase 4, session 4h1 — device observer efficiency

> **Purpose.** Remove the repeated observer work that blocks the public device
> surface.

## Carry-in

E60 measured 334 bridge requests for one depth-2 remote change and replay. It
also found intermittent unstable post-write generations on Zebra3 inventories
with more than 2,000 parameters. Cold and warm managed builds both took about
50 seconds. Plugin load is not the dominant cost.

## Scope

1. Add one bounded complete remote-page reply if the Bitwig API can expose all
   required pages without repeated page selection. Keep page names, control
   counts, target generation, and exact existing-control counts.
2. If the API cannot support that reply, record the limit and reduce repeated
   full inventories around one known remote target without weakening proof.
3. Define a reliable parameter post-write completion path for large plugin
   inventories. Never replay a mutation after an uncertain result.
4. Reuse a confirmed target only inside one operation and only while all exact
   target fields remain current.
5. Re-run E60 native, plugin, deep, remote, managed, interference, reversal,
   cleanup, and clip-regression workloads.

## Exit criteria

1. One remote inventory has no repeated per-page bridge polling loop when one
   bounded reply can preserve the same semantics.
2. VST3 and CLAP writes return stable exact readback on three cold and three
   warm runs without mutation replay.
3. The managed warm build has no failed intermediate scalar receipt.
4. The new counts and budgets replace the provisional E60 ceilings.
5. The serialized cursor is accepted or a wider isolated pool has direct
   measurement and the same interference proof.
6. The public device surface is unblocked or one host API limit is explicit.
7. Focused tests, the brain check, extension tests, context check, and both diff
   checks pass.

## Result

Complete. One bounded reply now returns up to 16 remote pages with exact page,
control, target, and generation proof. The accepted nine-page route uses no
page-selection calls. Remote replay fell from 335 to 182 bridge requests.

Direct parameter writes now use one exact target-bound completion generation.
They do not repeat the mutation or request a full post-write inventory. Read and
preflight inventories can re-arm a stale observer generation at most three
times without a write.

Three cold and three warm managed trials passed VST3 and CLAP exact readback,
reversal, interference, and cleanup. E61 replaces the provisional budgets and
accepts the serialized device cursor. Session 4i is unblocked.

## Retrospective

A longer poll did not repair a generation that stayed stale. Keep bounded
generation re-arm separate from mutation completion.
