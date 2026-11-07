---
title: E360 — Historical Haiku subscription CLI capture
kind: evidence
state: done
updated: 2026-10-25
owner: R01
---

# E360 — Historical Haiku subscription CLI capture

## Scope and result

The operator clarified: “Don't worry about subscription limits; I have a large
subscription and will monitor it as we run. For what it's worth though, I have
no credits added right now.” The [exact reply and interpretation](../data/r01-cli-claude-controls/operator-context.json)
are retained. Disabled credits are no longer a run prerequisite, and the reply
does not establish that the account setting is disabled. API keys remain
excluded and first-party subscription authentication is required.

One historical-Haiku subscription control probe succeeded. Its exact two-note
velocity edit is correct. **The captured request and response both identify
`claude-haiku-4-5-20251001`**, verifying the historical model is available through
this account's Claude Code route. The request uses enabled thinking with a
**1,024-token budget**, **`max_tokens:12000`**, no temperature field and an empty
tool list. No tools executed. CLI version: **2.1.302**. This is one unscored
synthetic control attempt, not a paired format result or historical score
replication. No held-out passage or host was accessed.

## Capture and accounting

The [probe manifest](../data/r01-cli-claude-controls/claude-historical/manifest.json)
pins the invocation, environment, source hashes, system/task text and operator
context. The [audit](../data/r01-cli-claude-controls/claude-historical/audit.json)
and [raw index](../data/r01-cli-claude-controls/claude-historical/api-bodies/index.jsonl)
retain one indexed request/response pair and no orphan captures.

- Final usage: **612 input tokens, 221 output tokens**, including **162 thinking
  tokens**; both input cache categories are zero. Raw response usage and the
  terminal result agree exactly. Interim assistant events report six output
  tokens and must not replace the final count.
- Process time: **3,290.84 ms**; reported API duration: **2,256 ms**. These are
  single observations, not performance estimates.
- The CLI's **$0.001717** value is a list-price estimate, not evidence of a
  charge. The rate event reports `isUsingOverage:false` and `out_of_credits`.
  Those observations do not impose a new billing prerequisite.
- Model-usage metadata advertises a 32,000 output capability; the effective
  request ceiling is 12,000. The auditor checks the request.
- Full serialized context uses **747 local `o200k_base` tokens**. This differs
  from provider input accounting; their subtraction is not hidden overhead.

The request has three system blocks: billing metadata, SDK identity and the
supplied task instruction. Five additional reminders carry environment,
model identity, token-budget, account and date context. Exact capture makes
these inspectable, but a fresh scratch directory and replacement system prompt
do not eliminate all client-added context. Raw capture contains account context;
it is local research evidence, not an anonymized public dataset.

The loader validates index references and request/response model/message IDs,
counts orphan requests instead of hiding them, and independently compares
final response usage with the terminal result. The audit preserves any observed
overage event while leaving usage monitoring to the operator.

## Verification and remaining work

**152 focused tests pass, zero failures**: the previous 148 plus four captured
Claude regression checks. Tests cover the real model/settings/answer/usage,
orphan requests, duplicate or escaping index references, response identity
drift and final-usage disagreement. The existing overage test now checks
observation retention without rejecting operator-monitored subscription usage.
Documentation links, source/artifact hashes and diff whitespace were checked;
the earlier E359 raw-stderr whitespace exception remains unchanged.

Earlier E records and raw artifacts are unchanged. The
[new evidence manifest](../data/r01-cli-claude-controls/manifest.json) pins current
sources and captures, and maps E359's changed source files to exact preserved
snapshots for reproduction. The actual probe's source files are separately
retained beside its manifest. Reproduce the audit with `auditProbe(directory,
tokenizer)` from the [auditor](../../../brain/benchmarks/r01-candidates/cli-control-audit.mjs),
using `js-tiktoken@1.0.21/o200k_base`; this performs no model call.

The control audit still rejects scoring pending a frozen Claude client-context
policy and transport-level retry evidence. One logical completed request does
not prove there were no HTTP retries, even with configured zero retries. Next:
finish those controls and rehearse the eligible paired development runner.
Codex's previously identified control gaps remain. The
[brief](../../work/r01-format-comparison.md#immediate-next-steps) tracks these
steps; no further subscription-limit confirmation is needed within scope.
