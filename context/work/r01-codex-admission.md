# R01 Codex/Luna admission investigation

Scope: close the Codex proof gates in the [pilot draft](../../spec/r01-research/PILOT-DRAFT.md)
for GPT-6 Luna on Codex 0.163.0, or stop after reasonable investigation and
record the remaining blockers. No pilot run, reserved-source access, provider
substitution or change to operator configuration is in scope.

Investigate an isolated temporary `CODEX_HOME` with a private subscription-auth
copy; inspect actual requests for global instructions, skills and all tool
surfaces. Investigate served-model evidence, effective output ceiling and
transport retry control using supported configuration and bounded local fault
tests. Retain each external submission, including failures. Admission stays
closed until every gate has evidence. Model selection now follows
[D55](../../spec/r01-research/decisions/d55-r01-luna-model-selection-evidence.md); a logical-request
count still cannot substitute for HTTP-attempt counts.

Verification: focused control regressions, replay retained captures, relevant
local fault tests, documentation links and diff checks. Record durable results
in a new E record, update the current status, and stage only this task's changes.

Result: [E362](../evidence/experiments/e362-r01-codex-isolation-and-remaining-gates.md)
verifies global AGENTS/skill isolation and local custom-provider retry controls.
Stopped as requested with tools, remaining context policy, served identity,
subscription-route retries and output ceiling still blocking admission. Two
correct unscored subscription edits and all local failures are retained; 58
focused regressions pass. Luna remains pending in the pilot.

Follow-up: the operator relaxed the model gate in D55. Current audits of the
retained Luna successes pass model selection while continuing to report missing
independent served identity. Tools/context, transport and output-ceiling gates
remain unchanged. The [control contract](../../spec/r01-research/CLI-CONTROLS.md)
also corrects E362’s description: nested patch/resource/clock declarations were
removed by the stronger namespace exclusions, leaving the four function tools.
The amendment passes 60 focused tests, including request-only selection,
conflicting metadata, failed completion, reroutes and version/model scope.
Both retained isolated probes pass model selection on replay and still fail
the four remaining controls; no new external call occurred. New audits,
verification output and E362 source snapshots are retained in the
[amendment manifest](../evidence/data/r01-codex-model-policy/manifest.json).

The next operator reply accepts rejecting actual tool use instead of unused
declarations ([D56](../../spec/r01-research/decisions/d56-r01-codex-reject-tool-use.md)). The auditor
now detects invocation evidence in requests, responses, stdout and raw trace
events, including failed calls and calls omitted from the final answer. Both
isolated E362 probes pass this check on replay. The remaining gates are the
fixed context/tool-declaration allowlist implementation, subscription retries
and effective output ceiling. These are not silently relaxed. All 63 focused
tests pass, including trace-only and blocked-call regressions; no new model
call ran. The [tool-policy manifest](../evidence/data/r01-codex-tool-policy/manifest.json)
retains fresh audits, verification and prior source snapshots.

The operator then removes hard output ceilings ([D57](../../spec/r01-research/decisions/d57-r01-natural-token-use.md)).
Current cohort profiles omit research caps; the auditor retains observed limits
without using them for admission. Historical settings remain reproducible.
Haiku 5.5 uses adaptive effort, so its calibration toward Luna generated-token
usage is recorded as pending usable development controls; low remains provisional.
The retry rule is unchanged: transport repetition concerns token/latency accounting,
whereas correctness-driven repetition would constitute hidden repair.
All 64 focused tests pass. Both retained isolated Luna captures now fail only
context-policy implementation and subscription retry control. No new model
call ran. Fresh audits, verification and prior source snapshots are in the
[natural-token-policy manifest](../evidence/data/r01-natural-token-policy/manifest.json).

Completed: [D58](../../spec/r01-research/decisions/d58-r01-retries-are-reporting.md) moves retries into
reporting and accepts normal in-turn self-correction. [E363](../evidence/experiments/e363-r01-codex-luna-admission.md)
implements the fixed context policy, promotes the inspected stronger controls
into the normal invocation and verifies a fresh correct admitted Luna edit.
No Codex gate remains for this configuration. Haiku 5.5 admission and effort
calibration are explicitly deferred to next session. No pilot ran.
All 70 focused regressions pass; changed documentation links and diff checks
pass. Fresh usage is 3,021 input / 55 output tokens, with no reported reasoning
tokens; this smoke check is not effort calibration. Prior E/D records remain
unchanged. Evidence and source snapshots are retained in E363’s manifest.
