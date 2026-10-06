---
title: Current state
kind: status
state: active
updated: 2026-10-06
phase: phase-8-agent-native-live-engine
session: 8h3c2-complete
---

# Now

[8h3c2 — Reader row binding](plan/phase-8/8h3c2-reader-row-binding.md) is
complete. Changes are staged for review. No commit was made.

Read [E232](evidence/experiments/e232-reader-row-binding.md) and the staged
diff for review. The next session is
[8h3e](plan/phase-8/8h3e-cache-machinery-trim.md): write its full plan
first. It is still an outline.

## Result

- **Cause:** the host did not apply the reader's unpin, because the reader
  sent it while its clip was unsubscribed. The clip stayed pinned to the row of
  its first read on each track, also after a controller reload.
- **Fix:** the open task subscribes on the prior target, removes the clip and
  track pins, and then parks. The D30 close, confirmation, and release order,
  the E99 lease, and the bound-target guard are unchanged. Marker:
  `openRule: subscribe-before-unpin-v1`.
- **Old pins:** the adapter retries one time after a row mismatch on the
  requested track. A pin from an earlier build costs one refused read.
- **Cost:** the prior clip replays to no capture: about 1 ms after a typical
  clip and about 73 ms after a 1,048,576-cell clip.
- Acceptance: 108 of 108 matrix reads with zero refusals, 40 of 40
  alternating reads, the forced mismatch refuses, and the E230 paired,
  selection, and gate cases pass at rows 0 and 1.
- **Open observation:** one read in 2,200 did not restore the slot
  selection. The cause is not known.
- Brain check (1,898 tests), extension check, the E232 and E230 offline
  verifiers, context check, and `git diff --check` pass.

## Live baseline

The operator closed owned `New 3` without saving. Normal `ghostnote` is
loaded. No fixture or research archive remains. The active anchor is
`gn-scale-test`; all ten track IDs match the E231 baseline.

Fresh hello passes `normal-v1`, 87 methods, hash `ca139a3e62a55e68`,
`clip-reader-v1`, `closeRule: confirm-before-release-v1`, and
`openRule: subscribe-before-unpin-v1`. Initialization is
`2026-10-06T04:40:55.408Z`. Normal archive SHA-256:
`a9e7b69b060e317d8ef569d5cde76099d5fa5a0b536067440b7a464f0a549ea1`.
Rig config SHA-256 is unchanged:
`256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0`.

## Facts and retrospective

A settable value that a controller sets while its object is unsubscribed
may not reach the host. The local value still changes, so a later equal
`set` sends nothing. Check host state after a subscribe. When one cursor
fails and another works, first compare their lifecycle on the same tracks:
subscribe, pin, and park. That control found this cause after six route
candidates had failed. Report note channels 1-based to the operator. Do not
pipe a verifier into `tail` when its exit status matters. `context/check.rb`
needs `LANG=en_US.UTF-8`.
