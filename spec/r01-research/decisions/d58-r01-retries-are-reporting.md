# D58 — R01 retries are reporting, and in-turn self-correction is normal

Date: 2026-10-26. Status: accepted by the operator.

The operator relaxes the retry gate almost entirely into reporting. The model
may revise its reasoning or answer within a turn; a correct final answer is
normal successful operation. There is no external orchestrator evaluating and
selecting intermediate answers in this harness. Earlier discussion conflated
model self-correction with externally supplied scorer feedback.

Remove the one-HTTP-attempt and one-logical-inference admission requirements,
the mandatory transport fault suite, and rejection solely for observed retries,
recovered errors or client fallback notices. Keep captured request/response
counts, inference failures, retry/fallback events, elapsed time and raw usage
in reports. Unknown HTTP-attempt totals remain unknown. Client-reported token
usage may omit interrupted/retried generation; do not present it as complete
transport accounting or reconstruct hidden consumption from logical counts.

A submission still needs a successful terminal outcome, valid reported usage,
the pinned model and settings in every captured request, the accepted context
and no tool invocation. Actual model switching or conflicting model evidence
still fails model admission. Repeated requests are checked, not discarded.
Orphan request captures can represent failed retries and remain in accounting;
malformed capture references or unindexed response bodies still fail validation.

Score the final completed answer. Self-correction does not consume the explicit
correction budget. The harness still performs one CLI invocation per submission,
with a 120-second timeout. Scorer feedback after that invocation remains a
separate, recorded correction under the existing two-correction budget; the
wrapper does not acquire an unbounded retry loop. No new retry fault tests are
required for admission; previous measurements remain available as reporting.

Luna's request-model policy is now `r01-codex-luna-request-model-v2`.
This amends D55's single-request condition and D57's retained retry rule. Their
original records remain unchanged. Haiku 5.5 admission and effort calibration
are explicitly deferred to the next session.
