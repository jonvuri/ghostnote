---
id: D53
kind: decision
state: active
updated: 2026-10-23
source: phase-9b
---

# D53 — Accept ordinary operator consent **[SETTLED 2026-10-23]**

## Context

During 9b.6j, the operator rejected a request to repeat a long consent
sentence. The operator asked for direct instructions and a general consent
question, then answered "Saved, go ahead."

The procedure had confused internal driver tokens with operator wording.
Commit `f61fe15f` added an exact-string instruction to the guarded-doctor
README. Commit `b7788bff` described the second-pass token as the operator's
exact answer. The 9b.6j driver, README, handoff, and agent prompt repeated
that pattern. [D52](d52-grid-upgrade-admission-policy.md) requires consent
for the scratch test; it does not require a prescribed sentence.

## Decision

- State any required operator action directly. Explain the planned scope
  and material risk when consent is needed.
- Accept ordinary approval for that scope. Do not require the operator to
  repeat a sentence, policy ID, or internal token.
- Keep the actual reply in evidence. A driver can use a stable internal
  scope token. Do not label that token as the operator's verbatim reply.
- Carry authorization forward within its scope. Ask again only when a
  material change requires a new decision.
- Keep validation, ownership, freshness, selection, attempt limits,
  independent readback, and uncertain-state handling. Consent wording
  does not replace these checks.

## Implementation

`AGENTS.md` and the driver README state this rule. The 6.1.4 driver can
record an ordinary answer with `--operator-reply`; it does not classify
permission from the words. Historical attempts and evidence stay unchanged.
[E342](../evidence/experiments/e342-grid-doctor-614-acceptance.md) records
this session's actual reply separately from the internal third-pass token.
The 9b.7 product flow must use the same separation.
