---
title: E361 — R01 Claude control admission and paired development rehearsal
kind: evidence
state: done
updated: 2026-10-25
owner: R01
---

# E361 — R01 Claude control admission and paired development rehearsal

## Scope and outcome

This record closes the two Claude control gates left open by
[E360](e360-r01-historical-haiku-cli-capture.md) and exercises the paired runner
end to end on the bounded development slice in the
[brief](../../work/r01-format-comparison.md#resume-up-to-the-freeze). The
operator's standing scope applies: subscription CLI probes within the
established limits, usage monitored by the operator, no further limit
confirmation ([retained reply](../data/r01-cli-claude-controls/operator-context.json)).

- **Client context:** a versioned allowlist, `r01-claude-context-policy-v1`,
  now admits each captured request only if every system block, reminder,
  request field and beta matches exactly, apart from six named volatile fields.
  The delivered task bytes must equal the prompt exactly.
- **Transport retries:** a local fault suite against the pinned Claude Code
  binary shows one HTTP attempt and one captured request file per submission
  under the trial settings for six fault/success scenarios; two positive
  controls detect a permitted retry by HTTP count, request-file count and
  stream event.
- **Rehearsal:** the 11-attempt historical-Haiku slice completed without a
  control or transport stop. All 15 submissions passed admission; 9 of 11
  attempts passed on the first submission; two C3 arms on the group task used
  both corrections without passing.

This is development evidence. It is not a scored pilot, comparative result or
format decision. No reserved passage, API billing route or Bitwig host was used.
Codex controls were not advanced; they remain as recorded in
[E359](e359-r01-cli-controls-and-model-selection.md).

## Client-context policy

The [policy](../../../brain/benchmarks/r01-candidates/claude-context-policy.mjs)
is specific to Claude Code **2.1.302** and `claude-haiku-4-5-20251001`. It
requires, in order:

- three system blocks: billing metadata, the SDK identity line and the supplied
  instruction, with the captured cache-control settings;
- one user message of five reminders (environment, model identity, token budget,
  account context, date) followed by the exact task text;
- the twelve captured request keys, the exact twelve-entry beta list, an empty
  tool list, and the captured stream, thread, diagnostics and context-management
  values.

Volatile fields are limited to the billing version suffix and prompt ID, the
metadata device/account/session identifiers, the working directory (which must
equal the attempt's scratch directory), the account email and the date. The
email is reported only as a SHA-256. Any other difference fails admission;
nothing is normalized to make hashes agree. Each audit counts all client-added
text bytes separately from task bytes: **2,092 client-added bytes** on every
admitted submission. The billing version suffix varied with the prompt
(`364` on initial prompts, `8d5` on corrections, `e09` in E360), consistent
with a prompt-derived value; it is permitted as volatile.

The retained E360 request satisfies the policy. Tests reject an added reminder
or system block, edited instruction, changed token budget or model identity,
an added tool, a dropped beta, an added request field, a changed task byte,
missing task cache control, a mismatched working directory and a different model.

## Transport fault suite

The [fault harness](../../../brain/benchmarks/r01-candidates/claude-transport-faults.mjs)
runs the pinned binary (SHA-256 `5262ce9de86243fed0d21edc39b271555d56780d0112e2b194439fe1c6662d37`)
with the trial invocation against a loopback fake Messages endpoint, a dummy
API key and proxies pointing at a closed local port. No inference occurs and
no header value is recorded.

| Scenario | HTTP attempts | Captured request files | `api_retry` events |
|---|---:|---:|---:|
| Success | 1 | 1 | 0 |
| HTTP 500 | 1 | 1 | 0 |
| HTTP 529 overloaded | 1 | 1 | 0 |
| HTTP 429 rate limit | 1 | 1 | 0 |
| Connection reset before events | 1 | 1 | 0 |
| Connection reset mid-stream | 1 | 1 | 0 |
| Positive control: HTTP 500, one retry allowed | 2 | 2 | 1 |
| Positive control: HTTP 529, one retry allowed | 2 | 2 | 1 |

Every request was streaming, used the requested model and reached only the
Messages path; no nonstreaming or model fallback request occurred. Failed
attempts leave an unindexed request file, which the capture loader already
rejects. The client's own retry loop resends with `x-stainless-retry-count: 0`,
so that header cannot detect retries; HTTP and request-file counts can.

The audit now admits a Claude submission's transport control only when the
fault suite passed for the **same binary hash**, the attempt's four retry and
fallback settings equal those tested, exactly one request was captured, and
no `api_retry` or fallback stream event appeared.

Limits: the fault suite uses API-key authentication against a local endpoint,
not the subscription OAuth route; the in-run single-request-file and stream-event
checks are what cover the live route. A stream-idle watchdog fault was tried
and not retained: the watchdog did not fire within the 120-second wrapper
timeout, which ended the attempt after one HTTP request. Stale-connection
streaming retries were not exercised; each attempt is a fresh process making a
single Messages request.

## Paired development rehearsal

The [runner](../../../brain/benchmarks/r01-candidates/cli-paired-runner.mjs)
built the plan with seed `r01-paired-rehearsal-v1` and wrote it before any
submission. It delivered only each E358 pair's `prompt`, audited each capture
before scoring, scored with the E358 scorer and private oracles held in the
runner process, and submitted corrections only through the explicit repair
state. Configuration hash `b357c2d5…533c1b`; development-manifest hash
`aea36da2…0abf17`. Subscription `pro`, first-party authentication.

| Run order | Cell | Role | Outcome | Submissions |
|---:|---|---|---|---:|
| 1 | `halve-group-spread` / C4 detached FIELDS | diagnostic | pass | 1 |
| 2 | `halve-group-spread` / C4 JSON | diagnostic | pass | 1 |
| 3 | `halve-group-spread` / C3 FIELDS | primary | exhausted | 3 |
| 4 | `halve-group-spread` / C4 FIELDS | primary | pass | 1 |
| 5 | `halve-group-spread` / C3 JSON | diagnostic | exhausted | 3 |
| 6–11 | `edit-velocity-guitar` / PP MIDI JSON, PP bar\|beat, C4 FIELDS, C3 FIELDS, Ghostnote FIELDS, Ghostnote JSON | primary | pass | 1 each |

The four primary arms without a source-context adapter were excluded from the
group task as planned. C3 failures were model errors, not scorer defects: in
the first C3 FIELDS answer the halved residuals in `CONTEXT` are correct, but
the members' explicit onsets are unchanged, so the timing equation fails
validation. Later answers produced either the same validation error or a
parseable but incorrect state. With one repetition these outcomes are anecdotal
and support no format comparison.

**Accounting.** 15 submissions: 27,334 input and 15,311 output tokens
(11,460 thinking), zero cache creation and zero cache reads. Initial
submissions: 18,408 input / 10,137 output; corrections: 8,926 / 5,174. Local
`o200k_base` whole-context count: 28,549. Elapsed process time 108.7 s
(median 6.0 s, maximum 13.4 s). Every rate-limit event reported `allowed`;
no overage was observed. Reported thinking tokens exceeded the 1,024 budget in
**3 of 15** submissions (1,292, 1,346, 1,524), so the budget is a request
setting, not an observed cap.

## Verification

From `brain/`, with `R01_UPSTREAM`/`R01_TOOLING` set to the pinned Producer Pal
checkout and tokenizer tooling: **168 focused tests pass, zero failures** — the
earlier 152 (one E360 expectation updated: its capture now passes the context
policy but stays transport-unverified because its manifest predates binary
pinning), six new control tests, six runner tests and four draft-manifest tests. Runner tests exercise a correction carrying the
full history with equal-form feedback and no golden leakage; exhaustion after
two corrections with no fourth submission; halts on transport and control
failures and quota pauses on 429 or rejected rate-limit evidence without
retrying or scoring; and refusal of a delivered prompt that differs from the
plan. The retained fault suite and draft manifest are rechecked against their
generators.

## Artifacts and reproduction

- [Evidence manifest](../data/r01-claude-paired-rehearsal/manifest.json):
  source and artifact hashes, plus [snapshots](../data/r01-claude-paired-rehearsal/e360-source-snapshots/)
  of the E360-pinned sources changed here.
- [Fault suite](../data/r01-claude-paired-rehearsal/transport-faults/summary.json)
  and per-scenario raw output, server logs and captures.
- [Rehearsal plan](../data/r01-claude-paired-rehearsal/run/plan.json),
  [preflight](../data/r01-claude-paired-rehearsal/run/preflight.json),
  [results](../data/r01-claude-paired-rehearsal/run/results.json) and per-attempt
  raw captures and audits. Raw captures contain account context; they are
  local research evidence, not an anonymized dataset.
- [Draft pilot manifest](../data/r01-pilot-draft/draft-manifest.json), described
  in the [unfrozen pilot draft](../../../spec/r01-research/PILOT-DRAFT.md).

```sh
node benchmarks/r01-candidates/claude-transport-faults.mjs NEW_DIRECTORY
node --import tsx benchmarks/r01-candidates/cli-paired-runner.mjs PINNED_PP TOOLING FAULT_SUMMARY_JSON NEW_DIRECTORY
node --import tsx benchmarks/r01-candidates/pilot-draft.mjs NEW_FILE
```

The fault suite makes no inference. The runner makes up to 33 subscription
submissions and refuses a binary that differs from the fault-tested one.

## Remaining work

The Claude historical cohort is admitted for development use under this
policy and binary. Codex remains blocked on tool and instruction isolation,
served-model evidence, transport retries and output-ceiling verification; the
draft proposes deferring it. Next is operator freeze review of the
[draft](../../../spec/r01-research/PILOT-DRAFT.md#freeze-review-list). Freezing,
reserved-source selection and extraction, and scored execution remain outside
this handoff.
