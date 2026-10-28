# D62 — R01 Codex context policy v2: `access_programs` may be absent

Date: 2026-10-27. Status: accepted by the operator.

[E373](../../../context/evidence/experiments/e373-r01-package-v4-three-repeat-development-pass.md)'s
full run halted when one Luna request omitted the top-level request field
`access_programs`. The pinned E363 template has the value `{"cyber":"standard"}`.
Every model-visible block in that request matched the template exactly. The
field is present in 1,023 of the 1,024 captured Luna requests across seven
development runs. In Codex 0.163.0 it selects the account's cyber access tier,
taken from the model catalog, and the model does not see it as text. The
operator chose to relax the policy for this field.

## Decision

`r01-codex-context-policy-v2` replaces v1 in the
[policy](../../../brain/benchmarks/r01-candidates/codex-context-policy.mjs):

- `access_programs` is an **optional field**. When it is absent, the audit
  records it in `absentOptionalFields` and does not fail.
- When present, it must equal the template value. Any other value, including
  `{}` or `null`, fails as before.
- Everything else is unchanged. The template, its hash, the volatile fields
  and the requirement that every model-visible block and the exact task bytes
  match all stay the same. The absence of any other request field still fails.

Re-auditing E373's halted submission 347 under v2 admits it and reports
`absentOptionalFields: ["access_programs"]`. A neighbouring normal submission
reports none. A new test covers absence, changed values and the absence of
another field.

The policy is not part of the plan or the v4 execution manifest, so the pinned
v4 plan is unchanged. The draft-2 pilot manifest now names v2 and was
regenerated. Earlier audits remain as recorded under v1.

## Scope

This applies only to the Codex 0.163.0 / Luna cohort. A changed Codex version
or binary still requires a new context-policy check. If the field is absent in
more than isolated requests, or appears with a different value, that is a
reason to reopen this decision.
