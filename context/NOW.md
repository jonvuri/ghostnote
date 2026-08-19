---
title: Current state
kind: status
state: active
updated: 2026-08-19
phase: phase-2
session: 2i-long-clip-follow-up
---

# Now

Session 2i is complete. E45 records the first real musical dogfood task, the
accepted six-clip result, three focused correctness repairs, and the blocking
latency finding. The focused long-clip follow-up is next. Session 2x follows it,
then session 2j starts the second dogfood use.

## Accepted live result

Project `26.05-2 moon` has the original 32-beat Lead and Harmony clips in row 1.
Rows 2 through 4 hold three verified full-phrase variations on each track. Lead
row 2 is open in the Edit layout. The operator auditioned and kept all six
variation clips. The observation record marks the final instruction accepted.

## Findings

- Exact 32-beat reads need paging across the fixed 512-step cursor window.
- Additive note writes now confirm and pin the exact target before mutation.
- A note stage wider than the writer pool and a note beyond the writer window
  refuse before mutation.
- A timed-out 60-second request continued to mutate. E45 activates the deferred
  async-completion follow-up with explicit cancellation semantics.
- The 2i follow-up owns the operator-requested public clip-length update,
  long-writer paging, and the incorrect long-clip reversal qualification.
- Session 2x owns completion and cancellation after a client timeout.

## Verification

- Six final public writes: no mismatch.
- Six independent final clip reads: exact intended notes and 32-beat lengths.
- `npm run check`: 629/629 pass.
- The extension build, deployment, context check, and diff check pass.

## Retrospective

Confirm whether a musical unit means a beat-grid span or a complete clip before
planning phrase variations. Compare long requests with both cursor widths and
the client timeout before mutation.
