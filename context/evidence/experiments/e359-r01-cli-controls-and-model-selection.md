---
title: E359 — R01 CLI controls and historical model selection
kind: evidence
state: done
updated: 2026-10-25
owner: R01
---

# E359 — R01 CLI controls and historical model selection

## Scope and outcome

The operator requested the next R01 step and model choices comparable to the
first research round. This record establishes control findings, not completion
of the experimental-controls gate. **No scored or paired model run occurred.**
The retained attempts comprise one local configuration rejection, one rejected
historical-model request and one correct unscored synthetic edit. No API-key
billing, Bitwig work or reserved Ghostworks passage access was used.

The [control contract](../../../spec/r01-research/CLI-CONTROLS.md) documents
commands, model recommendations, accounting and remaining gates. The independent
[historical inventory](../../../spec/r01-research/MODEL-HISTORY.md) identifies the
decisive model matrix as GPT-5.4 mini, Gemini 3.8 Flash and Haiku 4.5, distinguishing
earlier Sonnet work and the separate side-ledger diagnostic.

## Retained probes

All attempts used Codex CLI **0.163.0**, ChatGPT login, a fresh scratch working
directory, the same two-note velocity task and no wrapper retry. Raw artifacts
and exact invocation-source snapshots are retained; newer controls are not
retroactively attributed to these attempts.

| Attempt | Result | Control consequence |
|---|---|---|
| [Configuration rejection](../data/r01-cli-controls/config-rejection/manifest.json) | Exit 1 before inference; built-in `openai` provider cannot be overridden to set request/stream retries | Removed rejected settings for the following probes; transport retry suppression remains unresolved |
| [Historical model](../data/r01-cli-controls/codex-historical/manifest.json) | HTTP 400 `model_not_found`; ChatGPT-backed Codex explicitly does not support `gpt-5.4-mini-2026-03-17` | Not an eligible historical model, and not a musical failure |
| [Current model](../data/r01-cli-controls/codex-current/manifest.json) | `gpt-6-luna`, low reasoning requested; exact edit passes, exit 0, one logical completed inference | Requested model is usable for a smoke edit, but served identity, advertised tools, injected instructions and retry control prevent scoring |

The [current audit](../data/r01-cli-controls/codex-current/audit.json) reports
**5,263 input tokens, including 3,456 cached input tokens; 55 output tokens**.
The response reports zero reasoning tokens. The process elapsed **2,955.66 ms**;
that single observation is not a latency comparison. No tools executed, but the
Luna request advertises `functions` and `collaboration` namespaces inside an
`additional_tools` input block, including `functions.exec` and
`collaboration.spawn_agent`. The unsupported historical model's
fallback metadata advertised `request_user_input`; the endpoint still rejected
the requested model. Metadata fallback is not evidence of model substitution.

Codex request capture revealed bundled skill instructions and global AGENTS
preferences despite the isolation flags. It also includes permission,
environment, collaboration and multi-agent instruction blocks. Raw captures
make these costs inspectable; disabling a feature does not necessarily remove
its instructions. The latest invocation adds two supported skill-suppression
settings, but those changes have not been live-verified and do not establish
global AGENTS suppression.

Neither captured Codex response identifies the served model. The successful
trace's requested-model field and the local catalog are not independent proof.
One logical request likewise does not establish that no HTTP retry occurred.
All three retained control audits fail, including the semantically correct edit.

Claude Code **2.1.302** configuration research identifies the exact historical
Haiku model and fixed 1,024-token thinking budget, with a 12,000 output ceiling
matching the initial historical batch. Its runtime probe remains pending the
operator's answer about disabled usage credits. No Claude call occurred in
this step; documentation support is not account-entitlement evidence. Gemini
is not provided by either selected CLI. Luna is a proposed small-model class
replacement, not an equivalent historical snapshot.

## Offline controls and verification

The planner and repair state machine add seeded paired ordering, exact settings
hashes, visible exclusions and explicit bounded correction turns. Transport or
control failures stop a sequence; they cannot consume a musical repair or
silently trigger a fallback. Fixed-thinking budgets and adaptive effort are
distinct configurations.

The [offline order rehearsal](../data/r01-cli-controls/development-order.json)
expands E358's 76 eligible cells over two proposed models: **152 initial slots**,
**46 exclusions**, **456 maximum attempts** including two possible corrections.
It retains 28 diagnostic slots separately from 124 primary slots. Seed:
`r01-cli-controls-v1`; repetitions: one; per-attempt ceiling: 120 seconds.
No inference was performed by the planner. This is not the frozen scored pilot
or permission to run all these attempts.

**148 focused tests pass, zero failures**, on Node **v24.11.1**: the prior 113
tests plus 20 invocation/audit checks and 15 planning/repair checks. New checks
cover credential exclusion, fixed/adaptive settings, requested versus served
identity, reroutes, retries, injected context/tools, invalid usage counters,
cache arithmetic, process failures, retained real captures, paired coverage,
seed determinism, settings hashes and bounded correction histories. Product
code is unchanged. E358 source pins, artifact hashes, local documentation links
and whitespace were checked; earlier E records remain unchanged.
The sole whitespace warning is a trailing blank line in the captured
configuration-rejection stderr; it is retained to preserve the exact raw output.

Independent review caught the initial auditor missing `additional_tools` and
using only the last overage event. The new auditor includes nested tool
declarations and preserves any observed overage; regression tests cover both.
Historical smoke-audit source is retained unchanged for E358 reproducibility.

From `brain/`, run the E358 focused command plus:

```sh
node --test benchmarks/r01-candidates/cli-controls.test.mjs benchmarks/r01-candidates/cli-control-audit.test.mjs benchmarks/r01-candidates/cli-trial-plan.test.mjs
```

The [evidence manifest](../data/r01-cli-controls/manifest.json) pins new sources
and retained files. Each probe manifest also pins the exact controls and driver
used at execution time. `auditProbe(directory, tokenizer)` reproduces Codex
audits; local counts use `js-tiktoken@1.0.21/o200k_base`. `buildTrialPlan` reproduces
the order from E358's manifest with the settings embedded in the retained plan.
Both APIs are offline. The external probe driver is explicitly separate.

## Remaining work

The [brief checklist](../../work/r01-format-comparison.md#immediate-next-steps)
keeps experimental controls open: validate Claude's actual capture after the
account-state answer; resolve Codex instruction/model/retry/output-limit
evidence; integrate and rehearse the eligible runner with paired prompts and
the scorer. Freeze the pilot only after those gates are satisfied. No candidate
adoption or comparison winner is claimed.
