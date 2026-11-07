---
title: E355 — R01 subscription CLI smoke tests
kind: evidence
state: done
updated: 2026-10-25
owner: R01
---

# E355 — R01 subscription CLI smoke tests

## Scope and result

The operator authorized trying subscription CLI trials: “Great. Let's try it
then, keeping an eye out for issues with experimental control and traps as we
spin up.” Two unscored calls used the same synthetic two-note development
prompt: change only note `b`'s velocity to 91 and return the complete JSON.
Both returned exactly the expected object, preserving all other values/order.
No candidate comparison, held-out passage, API-key call or DAW operation ran.

| Observation | Codex | Claude Code |
|---|---|---|
| CLI version | 0.163.0 | 2.1.302 |
| Requested model; effort | `gpt-6-luna`; low | `claude-haiku-5-5`; low |
| Model reported in retained stream | Absent | `claude-haiku-5-5` |
| Authentication preflight | ChatGPT | `claude.ai`, Pro, first party |
| Total input tokens | 8,724 | 3,044 |
| Cached input read | 6,912 (included above) | 649 (included above) |
| Cache input written | 0 | 2,393 (included above) |
| Final output tokens | 55 | 78 |
| Reported reasoning/thinking output | 0 | 0 |
| Process wall time | 3,742.8 ms | 2,126.1 ms |
| Observed tool calls | 0 | 0 |

These are single transport observations, not speed, cost or model-quality
comparisons. Both streams report cache reuse despite fresh conversations.
Provider counters measure the CLI request context, not just the displayed
note payload or subscription quota. Claude's list-price estimate was
$0.00052429; the stream reports `isUsingOverage: false`, so that estimate is
not an API charge. Codex does not report a dollar cost or overage status here.

## Isolation and traps found

- Both ran in new empty temporary directories with environment allowlisting,
  excluding API credentials and provider/model overrides. The driver inherited
  authentication locations without copying credentials or changing HOME.
  Local user configuration, project instructions/customizations, MCP and tools
  were disabled using the available CLI controls. Exact arguments are retained.
- Claude's sandboxed authentication check falsely appeared logged out because
  it could not access the Keychain. A check outside that sandbox confirmed the
  existing subscription. The inference processes used that authorized access;
  Codex itself retained a read-only tool sandbox. Claude `--bare` was avoided
  because it bypasses normal OAuth/Keychain discovery.
- Claude advertised no tools, MCP servers, skills or slash commands. Three
  built-in plugins remained in its initialization metadata despite safe mode.
  No subagent or tool ran. This does not prove an empty system prompt.
- Codex's under-development `skip_host_skill_discovery` flag emitted an
  `item.completed` error-type warning. The initial driver's broad classification
  incorrectly counted it as tool activity and exited 1; the child CLI exited 0.
  The corrected auditor distinguishes notices, tool activity and unknown items.
  Replaying retained logs fixed classification without another model call.
- Claude's intermediate assistant event reported eight output tokens, while its
  final result reported 78. Final usage is authoritative. Its three input
  categories add to 3,044; Codex's cached-input count is already part of 8,724.
- Codex's retained stream lacks an independently reported model identifier.
  The requested ID and configuration are recorded, but exact served-model
  verification remains open before scored trials. CLI context overhead,
  built-ins, cache state and version drift also need explicit controls.

## Artifacts and verification

Each attempt directory contains the prompt, hashed manifest, untouched stdout
and stderr, initial summary, and corrected offline audit:
[Codex manifest](../data/r01-cli-smoke-codex/manifest.json),
[Codex stream](../data/r01-cli-smoke-codex/stdout.jsonl),
[Codex audit](../data/r01-cli-smoke-codex/audit.json);
[Claude manifest](../data/r01-cli-smoke-claude/manifest.json),
[Claude stream](../data/r01-cli-smoke-claude/stdout.jsonl),
[Claude audit](../data/r01-cli-smoke-claude/audit.json).
The manifests' driver hashes match the preserved
[initial driver](../data/r01-cli-smoke-driver-initial.mjs).
The [current driver](../../../brain/benchmarks/r01-candidates/cli-smoke.mjs)
uses the corrected [auditor](../../../brain/benchmarks/r01-candidates/cli-smoke-audit.mjs).

Three audit tests pass against retained logs and injected tool/error cases:

```sh
node --test brain/benchmarks/r01-candidates/cli-smoke-audit.test.mjs
```

To make another subscription call, run the following from the repository root
with a new output directory and `codex` or `claude`. This is an external call,
not an offline reproduction; no automatic retries or fallback model are used.

```sh
node brain/benchmarks/r01-candidates/cli-smoke.mjs codex /tmp/new-r01-codex-smoke
```

The [trial protocol](../../../spec/r01-research/TRIAL-PROTOCOL.md#subscription-cli-route)
records the controls needed before scoring. CLI behavior was checked against
installed help and the official [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference),
[Claude CLI reference](https://code.claude.com/docs/en/cli-reference),
[headless guide](https://code.claude.com/docs/en/headless), and
[usage-accounting guide](https://code.claude.com/docs/en/agent-sdk/cost-tracking).
