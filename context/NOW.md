---
title: Current state
kind: status
state: active
updated: 2026-10-06
phase: phase-8-agent-native-live-engine
session: 8h3d-complete
---

# Now

[8h3d — Change awareness](plan/phase-8/8h3d-change-awareness.md) is
complete. Changes are staged for review. No commit was made.

Read [E231](evidence/experiments/e231-change-awareness.md) and the staged
diff for review. The next implementation session is
[8h3c2 — Reader row binding](plan/phase-8/8h3c2-reader-row-binding.md), then
[8h3e](plan/phase-8/8h3e-cache-machinery-trim.md).

## Result

- **Selected design: pull only.** Read at use time and compare the
  `pull-fp-v1` fingerprint. Pull detected every test edit, including a
  `1/512` nudge and an operator edit in the Bitwig editor. One clip takes
  183–633 ms; surveys of 16 and 64 typical clips take 3.4 s and 12.8 s.
- No clip, slot, or flat-bank value reports a note edit. Do not test again.
- Watched clips detect every note edit in 24–66 ms. They cost about
  300 bytes per sounding cell (+154 MiB at 32 typical clips) and save only
  latency, not tool calls or result size. `ChangeWatchProbe` stays research.
- **Defect:** the product reader binds only the row that its cursor holds
  for a track. Reads of other rows on multi-clip tracks refuse with
  `bound-target-mismatch`; no wrong data is published. 8h3c2 fixes it.
- Brain check (1,894 tests), extension check, the retained-artifact verifier, context
  check, and `git diff --check` pass.

## Live baseline

The operator closed owned `New 2` without saving and restored normal
`ghostnote`. No fixture or research archive remains. The active anchor is
`gn-scale-test`; all ten track IDs match the E230 baseline.

Fresh hello passes `normal-v1`, 87 methods, hash `ca139a3e62a55e68`,
`clip-reader-v1`, and `closeRule: confirm-before-release-v1`.
Initialization is `2026-10-06T03:18:15.343Z`. Normal archive SHA-256:
`4ce50cd267c3b61fb1dc3af56eb7794ff7ab40f9f74fca85e697b4ddb4e4f1bc`.
Rig config SHA-256 is unchanged:
`256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0`.

## Facts and retrospective

Acceptance for any reader route must include rows other than 0 on a
multi-clip track, with a distinct clip per row. Equal content in two rows
hides a wrong bind. Report note channels 1-based to the operator; driver
output is host channel 0-based. Make live edits change the current value, so
that a rerun is not a no-op. Time an edit from its request, not from a writer
bind before it. `context/check.rb` needs `LANG=en_US.UTF-8`.
