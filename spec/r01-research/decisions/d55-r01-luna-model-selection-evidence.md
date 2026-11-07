---
id: D55
kind: decision
state: active
updated: 2026-10-26
source: r01-codex-admission
---

# D55 — Admit pinned Luna selection without server attestation

The operator relaxed R01's served-model proof gate after reviewing E362:

> Yeah, this model does not re-route ever as far as I know. Relax the gate.

For `gpt-6-luna` through Codex **0.163.0**, policy
`r01-codex-luna-request-model-v1` accepts model selection when there is one
captured request naming the pinned model, one successful logical inference,
successful process/turn completion and no observed reroute. Any conflicting
served-model or model-usage metadata still fails the gate. An initialization
label alone cannot replace the captured request. CLI/model changes require
reconsidering this scoped policy. Claude keeps its served-model requirement.

The auditor reports `modelSelectionPass` separately from `modelVerified`,
which continues to describe independent served-model evidence. A successful
request-only audit reports `modelEvidenceBasis` as
`captured-request-success-no-reroute`; missing server attestation remains
visible without blocking model selection. This is an accepted research
assumption, not a new finding that Luna can never reroute.

[E359](../../../context/evidence/experiments/e359-r01-cli-controls-and-model-selection.md)
retains an unsupported-model request rejected with HTTP 400 `model_not_found`.
[E362](../../../context/evidence/experiments/e362-r01-codex-isolation-and-remaining-gates.md)
retains two successful isolated Luna requests without served-model metadata.
Under this amendment, those requests pass model selection but still fail the
other controls. Earlier E records and raw audits remain unchanged; current
re-audits are retained [separately](../../../context/evidence/data/r01-codex-model-policy/manifest.json).

Tool exposure, context policy, transport retries and output-ceiling rules are
unchanged. No authenticated proxy or further model call is needed to implement
this decision. The [control contract](../CLI-CONTROLS.md)
and [pilot](../PILOT-DRAFT.md) describe the amended gate.
