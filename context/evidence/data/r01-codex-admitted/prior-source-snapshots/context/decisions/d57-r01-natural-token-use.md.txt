# D57 — R01 permits natural token use and calibrates Haiku effort

Date: 2026-10-26. Status: accepted by the operator.

The operator removes the hard output/token ceiling as an R01 admission
requirement for both pilot cohorts. Let each small model use the reasoning
and output it needs, and tune Haiku to roughly match Luna's token usage.
This supersedes the ceiling gate described in E362 and the earlier controls.

Current Luna and Haiku 5.5 profiles no longer request a research output cap.
Keep observed request limits and actual usage in the audit; absent or different
limits do not fail admission. Client/provider defaults and intrinsic limits
can still apply. Historical reproduction profiles retain their old settings,
and earlier evidence remains unchanged. The separate 120-second submission
timeout and explicit correction budget remain in force.

Haiku 5.5 always uses adaptive reasoning: tune `--effort`, not the historical
Haiku 4.5 `MAX_THINKING_TOKENS` setting. Anthropic's
[Claude Code model documentation](https://code.claude.com/docs/en/model-config#adaptive-reasoning-and-fixed-thinking-budgets)
states that fixed thinking budgets do not apply to Haiku 5.5.

Calibration uses a small, fixed set of matched development tasks across task
families and formats, with fresh initial submissions and the same repetitions
for each model/setting. Hold Luna at low effort; start Haiku at low and compare
other supported levels if needed. Compare median generated tokens (reasoning
plus answer, without double-counting reasoning already included in output),
retain the distribution and separate reasoning counters where available, and
choose one Haiku effort for the whole cohort. Record failures and usage gaps.
Do not use input tokens to tune reasoning: tool and instruction overhead differ
between clients. Approximate token matching is a practical resource alignment,
not a claim of equal compute or cross-provider tokenizer equivalence. Do not
choose settings by format correctness or tune separately for each format.
Freeze the chosen effort before rigorous evaluation; report any remaining gap.

Calibration remains pending both current cohorts' usable development controls.
The two tiny Luna smoke edits and historical Haiku 4.5 rehearsal cannot establish
a Haiku 5.5 setting. `low` remains an initial setting, not a measured match.
No new model call is required to remove the ceiling gate.

The retry rule is unchanged by this decision. Ordinary transport retries do
not inherently give correctness feedback: a rejected request can add only
latency; a lost response can hide generated tokens or cause another sample.
Those are accounting/reliability concerns. An answer-driven retry or selection
among candidate answers would instead add hidden repair. E362 establishes the
accounting gap, not evidence that Codex performs correctness-driven retries.
