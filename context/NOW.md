---
title: Current state
kind: status
state: active
updated: 2026-10-06
phase: phase-8-agent-native-live-engine
session: 8h3e-planned
---

# Now

The [8h3e plan](plan/phase-8/8h3e-cache-machinery-trim.md) is complete. The
next session implements it. 8h3c2 is committed (`cf3b870`).

## Plan summary

- **Identity:** a snapshot reference is the product `RevisionMark`, the
  durable address, and one `ghostnote-launcher-source/1` content fingerprint.
  Binding, rebuild, and content generations and the canary are retired.
- **Verdicts:** `incomparable`, `uncovered`, `identity-changed`, `absent`,
  `stale` (with the new snapshot), and `current`, from the existing
  `contentDelta` over the full stored mark. The executor checks references at
  its stash read and refuses before any mutation.
- **Exposure:** experimental tool profile only. The stable profile and the
  normal wire (87 methods, `ca139a3e62a55e68`) do not change. 8h4 owns the
  compact-bar document tools.
- **Trim:** delete the resident-grid research code and keep the retained
  offline verifiers. Keep `ChangeWatchProbe`. Topology and slot inventory
  are not promoted.
- Record the choices in D32 and the results in E233.

## Live baseline

Unchanged since E232. Normal `ghostnote` is loaded; the active anchor is
`gn-scale-test`, and all ten track IDs match the E231 baseline. Fresh hello
passes `normal-v1`, 87 methods, hash `ca139a3e62a55e68`, `clip-reader-v1`,
`closeRule: confirm-before-release-v1`, and
`openRule: subscribe-before-unpin-v1`. Normal archive SHA-256:
`a9e7b69b060e317d8ef569d5cde76099d5fa5a0b536067440b7a464f0a549ea1`. Rig config
SHA-256: `256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0`.

## Facts and retrospective

The 8h3e outline named 8g identity tokens that exist only in probe code. The
product `RevisionMark` already covers the pull case. Before a plan promotes
a mechanism, check the product code for an equal mechanism. A settable value
that a controller sets while its object is unsubscribed may not reach the
host (E232). Report note channels 1-based to the operator. Do not pipe a
verifier into `tail` when its exit status matters. `context/check.rb` needs
`LANG=en_US.UTF-8`.
