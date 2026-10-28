---
id: D56
kind: decision
state: active
updated: 2026-10-26
source: r01-codex-admission
---

# D56 — Reject Codex tool use, not unused declarations

The operator accepted a fixed advertised tool set while rejecting actual use:

> Yes, rejecting any actual use is a fine policy. Let's go with that.

R01's Codex policy `r01-codex-no-tool-use-v1` no longer rejects a submission
solely because tools are advertised. Tool definitions remain recorded and
counted as client context. The eventual context policy must pin the chosen
declarations and instructions across arms; this decision does not admit
arbitrary context drift or remove that outstanding implementation gate.

Any invocation attempt rejects the submission, including calls that fail,
are blocked, or produce no useful result. This covers code execution, waiting
for execution, user questions, external tools and other tool calls. A correct
final answer cannot erase earlier use. The auditor inspects structured request
and response call items, stdout events, and raw trace tool-call/code-cell
events, including calls absent from the final answer. It reports observations
across surfaces, not a deduplicated number of executions. Mentions in prose
and tool declarations are not use.

The two E362 isolated probes pass this tool-use check without new inference.
Their remaining issues are the context-policy implementation, subscription
transport retries and effective output ceiling. The four-tool configuration
is still experimental; this change does not silently promote its flags into
the default invocation. Claude's existing empty-tool context policy is unchanged.

[D55](d55-r01-luna-model-selection-evidence.md) continues to govern model
selection. No retry, correction-budget or output-limit policy changes here.
The [control contract](../CLI-CONTROLS.md) records those
policies and their purposes. Earlier E/D records and raw audits remain unchanged;
[new audits and source snapshots](../../../context/evidence/data/r01-codex-tool-policy/manifest.json)
retain the amendment separately.
