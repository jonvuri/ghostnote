---
title: E364 — R01 Haiku 5.5 admission under context policy v2
kind: evidence
state: done
updated: 2026-10-26
owner: R01
---

# E364 — R01 Haiku 5.5 admission under context policy v2

Date: 2026-10-26. Stage: development admission, unscored apart from the
six-cell development check below.

## Result

Haiku 5.5 (`claude-haiku-5-5`, `--effort low`) is admitted for development
runs on the pinned Claude Code 2.1.302 binary (SHA-256
`5262ce9de86243fed0d21edc39b271555d56780d0112e2b194439fe1c6662d37`, unchanged
since E361). A new versioned context policy,
`r01-claude-context-policy-v2`, admits the captured client context. One
unscored control probe and one six-cell development task through the normal
paired runner pass every control gate. All six cells pass on the first
submission. Effort calibration toward Luna has not run; `low` remains
provisional (D57).

The operator's standing scope for bounded subscription CLI probes applied
([retained reply](../data/r01-cli-claude-controls/operator-context.json)). No
reserved passage, pilot instance, API billing route or Bitwig host was used.

## Captured context differs in layout from Haiku 4.5

Policy v1 (E361) rejects the Haiku 5.5 request on eleven checks. The client
text is substantially the same, but Claude Code places it differently for this model:

- **Messages.** The request has two messages. The user message holds only the
  account reminder and the task. A trailing `role: "system"` message holds one
  cache-controlled block that joins the environment, model identity
  (“Haiku 5.5 … knowledge cutoff is June 2026”), token budget and date, plus a
  per-turn `output_config: {effort}`. Under v1, those four items were separate user
  reminders, and the cache breakpoint was on the task block. In v2, the task
  block has no `cache_control`.
- **Request fields.** A thirteenth key, `output_config: {effort: "low"}`;
  `thinking` is `{type: "adaptive", display: "updates"}`; `max_tokens` is the
  client default 128,000 (observed, not pinned, under D57).
- **Betas.** Seventeen entries, adding `per-turn-control-2026-07-01`,
  `mid-conversation-tool-changes-2026-07-01`, `inline-tools-2026-09-15`,
  `mid-conversation-system-clear-at-2026-08-21` and `effort-2025-11-24`.
- **Unchanged.** The three system blocks (billing metadata, SDK identity,
  supplied instruction), metadata shape, empty tool list, stream, thread,
  diagnostics and context-management values.

The [policy](../../../brain/benchmarks/r01-candidates/claude-context-policy.mjs)
now selects by model: v1 (hash `d54829af…d20639`, unchanged) for Haiku 4.5
and v2 (hash `9fb87193…de4806`) for Haiku 5.5. v2 requires the exact layout
above, pins `thinking`, and requires both the request-level and turn-level
`output_config` to equal `{effort: profile.effort}`. Its volatile fields are
the same six as v1's; the working directory and date are now read from the
system-role message. Any other difference fails. Client-added text is
**1,937 bytes** per submission (v1: 2,092).

## Submissions

| Submission | Outcome | Input (uncached + cache write) | Output | Thinking | Elapsed |
|---|---|---:|---:|---:|---:|
| Control probe (two-note JSON edit) | correct, admitted | 2 + 721 | 78 | 0 | 1.6 s |
| `edit-velocity-guitar` / C4 FIELDS | pass, admitted | 2 + 2,136 | 375 | 108 | 3.0 s |
| C3 FIELDS | pass, admitted | 2 + 1,925 | 362 | 114 | 3.9 s |
| Producer Pal bar\|beat | pass, admitted | 2 + 1,990 | 1,854 | 1,674 | 9.1 s |
| Producer Pal MIDI JSON | pass, admitted | 2 + 1,897 | 352 | 134 | 2.5 s |
| Ghostnote FIELDS | pass, admitted | 2 + 2,285 | 506 | 86 | 3.2 s |
| Ghostnote JSON | pass, admitted | 2 + 2,414 | 717 | 125 | 5.7 s |

The runner used selection `haiku55-admission` (seed
`r01-haiku55-admission-v1`, every primary arm of one E358 development task,
up to two corrections each). No correction was needed. Every submission had
one captured request and response, no retry or fallback event, no tool use,
served model `claude-haiku-5-5` in stream, response and usage, and
`allowed` rate-limit status without overage. Output tokens include thinking.
One task and one repetition support no format comparison and no calibration.

**Cache accounting changed.** Every Haiku 4.5 submission in E361 reported zero
cache creation. Under Haiku 5.5, nearly all input is reported as 1-hour cache
creation, with only 2 uncached input tokens and no cache reads, even for the
shared system prefix. The audit's `totalInputTokens` already sums uncached
input, cache creation and cache reads, so the reported totals remain complete.
Reports must not use `input_tokens` alone.

## Verification

From `brain/`, with the pinned Producer Pal checkout and tokenizer tooling:
**192 focused tests pass** ([output](../data/r01-haiku55-admission/verification.txt)).
New tests cover model-based policy selection, an unchanged v1 hash, the
retained v2 capture, cross-model rejection in both directions, and v2 rejection
of a changed model identity, missing system turn, added reminder, mismatched
turn or request effort, fixed thinking, dropped beta, added field or tool,
edited instruction, task cache control, trimmed task bytes and a changed working
directory. A changed `max_tokens` remains observational. A runner test pins the
admission selection.

The retained draft-2 pilot manifest was stale before this session: it still
listed the 12,000 output cap that D57 removed. Its generator now records both
cohorts as admitted and the v2 policy, and the manifest is regenerated; draft 1
remains as pinned by E361.

## Artifacts and reproduction

[Manifest](../data/r01-haiku55-admission/manifest.json) with source and artifact
hashes; [probe capture](../data/r01-haiku55-admission/probe-1/) and
[audit](../data/r01-haiku55-admission/probe-1.audit.json);
[run plan, preflight, results](../data/r01-haiku55-admission/run/) and
per-attempt captures and audits. Raw captures contain account context.

```sh
node benchmarks/r01-candidates/cli-control-probe.mjs claude-current NEW_DIRECTORY OPERATOR_CONTEXT_JSON
node --import tsx benchmarks/r01-candidates/cli-paired-runner.mjs PINNED_PP TOOLING - NEW_DIRECTORY haiku55-admission
```

## Limits and next step

Admission applies to this model, effort setting, CLI version and context
layout; a client change requires a new policy check. The cache-write
reporting is client-reported usage, as under D58. Next for this cohort is
D57 effort calibration: matched development tasks across families and formats,
the same fresh initial submissions for Luna `low` and Haiku at `low` and other
supported levels, compared on median generated tokens.
