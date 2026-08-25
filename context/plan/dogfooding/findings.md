---
title: Dogfooding behavioral findings
kind: status
state: active
updated: 2026-08-25
parent: README.md
---

# Dogfooding behavioral findings

This ledger tracks cross-session hypotheses about public instructions and
multi-tool workflows. The root transcript is the primary source. A session does
not need to call `record_observation`.

Give each finding a stable `DF-###` ID. Count at most one vote from each root
session. Repeated calls in one session are qualifications, not separate votes.
Use these vote values:

- `supports`: the session had the predicted negative outcome.
- `contradicts`: the session completed the relevant workflow without that
  outcome.
- `inconclusive`: the workflow or boundary did not isolate the hypothesis.

Mark vote strength as `incidental`, `repeated`, or `controlled`. An incidental
vote comes from normal musical work. A repeated vote comes from the same result
in a distinct root session. A controlled vote isolates one relevant variable.

Use `watching` for an initial hypothesis. Promote it to `candidate` after a
repeat in a distinct root session or a controlled result. A strong controlled
safety or correctness result can justify immediate containment. Version any
public-description change and retry it in a fresh chat. This policy follows
[D18](../../decisions/d18-branching-the-hybrid-model-at-l3-open-settled-2026-08-06-by-the-.md#e-tool-descriptions-and-observation).

## DF-001 — Owned reversal can look like unauthorized deletion

- State: `watching`
- Confidence: `[I]`
- Candidate surface: `revert_change` description and the permission workflow
  for an exact session-owned reversal.
- Description cohort: `ghostnote-description-v13`.
- Hypothesis: The current public guidance does not reliably distinguish an
  exact owned reversal from deletion of user content. A permission reviewer can
  therefore deny the reversal as unauthorized deletion.
- Intended behavior: An unchanged clip that the same session created can be
  reversed by its change ID. Direct clip deletion remains destructive.
- Negative outcome: A permission reviewer denied the exact reversal before
  Ghostnote ran it. The denial said that the operation would remove a requested
  clip without user authorization, although the creation receipt reported
  `canBeUndone: true`.
- Boundary: The Codex Desktop permission reviewer denied the call. Ghostnote did
  not report the denial and did not mutate the project.

### Session votes

| Root session | Date | Client | Vote | Strength | Observation |
| --- | --- | --- | --- | --- | --- |
| `01a035f0-78a4-7b00-9854-78460d6f8476` | 2026-08-24 | Codex Desktop `0.149.0-alpha.4.1` | `supports` | `incidental` | After an unsupported expression edit and a temporary replacement clip, the reviewer denied both direct deletion of row 0 and reversal of the owned row-0 creation. |

### Qualifications and counterevidence

Direct deletion was correctly classified as destructive. It is not evidence
for changing `revert_change`. In the same root session, after another user
message, the reviewer allowed reversal of the temporary row-1 clip creation.
The session therefore does not isolate description wording from permission
state or conversation context.

### Next discriminating observation

During a natural musical run, capture a second attempt to reverse an unchanged,
unaccepted, session-created clip. Preserve the creation receipt, the
`check_revert` result, the exact request context, and the permission decision.
Do not create a destructive case only to test this finding. Keep the finding at
`watching` until a distinct session repeats it or a controlled check isolates
the cause.

### Current action

Do not revise the public description from this vote alone.
