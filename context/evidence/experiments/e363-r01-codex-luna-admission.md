# E363 — Codex/Luna admission under the revised R01 controls

Date: 2026-10-26. Stage: unscored development admission.

## Result

GPT-6 Luna is admitted on the pinned Codex 0.163.0 configuration. A fresh
subscription edit through the normal control-probe invocation returns the
correct answer and passes every audit gate. No Codex blocker remains for this
configuration. Haiku 5.5 admission and effort calibration are deferred to the
next session at the operator's request; no pilot or reserved-source task ran.

The [manifest](../data/r01-codex-admitted/manifest.json) retains source hashes,
earlier-policy source snapshots, the fresh raw capture and audit, replayed
E362 audits, and regression output. The successful probe's exact pre-formatting
`cli-controls.mjs` bytes are preserved under `probe-source-snapshots`.

## Policy and implementation

[D55](../../../spec/r01-research/decisions/d55-r01-luna-model-selection-evidence.md) accepts matching
request-model evidence without independent server attestation.
[D56](../../../spec/r01-research/decisions/d56-r01-codex-reject-tool-use.md) rejects any actual tool
invocation, including failed/blocked attempts, while allowing fixed declarations.
[D57](../../../spec/r01-research/decisions/d57-r01-natural-token-use.md) removes the hard output ceiling.
[D58](../../../spec/r01-research/decisions/d58-r01-retries-are-reporting.md) moves retries, recovered
errors and fallback notices into reporting and accepts model self-correction
within a turn. Model switching, terminal failure and context drift still fail.

The auditor checks every captured request for model/settings/context rather
than requiring one logical inference. It records unknown HTTP counts honestly
and labels usage as client-reported, potentially missing interrupted generation.
The paired runner carries that report into each submission and does not charge
retries against explicit scorer-guided corrections. Historical retry fault
proof is optional. No new fault test or authenticated proxy was needed.

The new `r01-codex-context-policy-v1` pins a normalized, model-visible request
template from E362's stronger probe: four function tools, the supplied base
instruction, team-role and no-proactive-delegation instructions, environment
and exact task bytes. Named volatility covers message/turn IDs, creation times,
scratch cwd/root and date; prompt-cache key and client transport metadata are
not model-visible context. Request output caps are observed independently.
Anything else must match exactly. Context hashes and serialized byte counts
remain available. Normal invocation now uses the stronger namespace exclusions.

## Fresh subscription check

- Model: `gpt-6-luna`, low effort; binary `codex-cli 0.163.0`, SHA-256
  `8813367285524ac798dd96d1b071aea30d58708c7226fd236cd275cf1cfdee31`.
- One fresh invocation, isolated temporary `CODEX_HOME`, subscription auth,
  120-second timeout, no wrapper retries; private scratch/auth copy removed.
- Task: change only note `b`'s velocity from 84 to 91 in the retained two-note
  JSON example. Final object matches exactly; note `a` and other fields remain.
- `controlPass:true`, `probeAnswerMatches:true`, no issues; request-model
  selection passes, independent `modelVerified:false` remains explicit.
- Four tools advertised, zero invocation evidence; no global AGENTS or skills.
- Reported input: 3,021 tokens, cache reads/writes: 0; output: 55 tokens,
  reasoning output: 0. Elapsed: 2,834.94 ms. This tiny check is not calibration.
- One captured request and response; zero inference failures or retry notices.
  HTTP-attempt count remains unknown, not inferred to be one.

## Verification and limits

All 70 focused tests pass. They cover retry reporting, recovered versus terminal
failure, per-request model/settings checks, exact context and task validation,
tool/schema drift, trace-only calls, final-answer selection after an intermediate
wrong answer, and paired-run accounting without extra corrections.
The retained stronger E362 probe now passes; the broader baseline remains
ineligible because its context differs. Earlier raw evidence and decisions are
unchanged. Changed documentation links/anchors and diff checks pass.

Admission applies to this model, CLI version and fixed context, not future
client changes. The paired pilot still needs its planned stage/resume support
and task materialization. This result establishes controls, not comparative
format quality, full HTTP accounting or cross-model token equivalence.
