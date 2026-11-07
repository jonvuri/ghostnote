# R01-D16 — Codex context policy v5 and continuing a re-audited control halt

Date: 2026-10-29. Status: **accepted by the operator** ("Yes, that proposed
fix sounds fine, and yes, continue from where it halted.").

## Context

The Luna-only development pass of package v2 (R01-D15) halted on submission
270 (`r2-range-L128-i3--pp-midi-json`, initial attempt). The first inference
failed with "stream disconnected before completion: idle timeout waiting for
websocket", and the Codex client retried by itself. The retried request added a
top-level `type: "response.create"` and three `client_metadata` entries;
policy v4 already strips `client_metadata`. Every model-visible field was
byte-identical to the first request, which passed. Policy v4 rejected the
unknown top-level field, so the run halted after 195 of 684 runs. The
retry itself is reporting only (D58).

## Decision

- **Policy v5** (`r01-codex-context-policy-v5`) accepts a top-level `type`
  only when it equals `response.create`, and reports it as
  `transportFraming`. Any other value fails as
  `unexpected-codex-transport-framing`. Every model-visible field compares
  as in v4. The halted submission's capture is retained in
  [`r01-codex-policy-v5/halted-attempt`](../../../context/evidence/data/r01-codex-policy-v5/halted-attempt/),
  and the policy tests use it.
- **Continuation.** `cli-pilot-runner.mjs resume … --after-control-halt`
  re-audits the halted submission under the current policy. It must now
  pass, and it is scored as if it had passed when submitted. Its record
  keeps the original issues and the re-auditing policy (`reaudit`). The run
  continues from that run's repair state with the same pinned plan, without
  resubmitting it. The option is for development runs only.

## Consequences

- Luna's 195 finished runs were audited under v4; submissions from
  submission 270 on are audited under v5. The session records mark the
  change.
- The pinned v2 execution manifest still names v4 in its controls; it was
  written before this change.
