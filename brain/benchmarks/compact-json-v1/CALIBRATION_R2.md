# Calibration r2 repair

The repaired run ID is
`phase8c2-3-json-grammar-repair-calibration-r2`. It uses three fresh
progression fixtures and three fresh role-continuation fixtures. Revoicing is
demoted to a regression and component diagnostic because all 18 r1 control
trials passed.

## Prompt and scorer repair

The repaired prompt supplies exact task metadata, a complete multi-voice
example, explicit collection order, and explicit progression coverage rules.
The scorer adds `exact_metadata` for JSON arms.

| Requirement | Scorer check | Focused mutation |
|---|---|---|
| Copy score, bars, tracks, and regions exactly. | `exact_metadata` | Change only tempo. |
| Order every collection by the stated rule. | Parser canonical-order check | Move one row. |
| Cover every listed progression pitch class. | `harmony_and_bass_inversion` | Remove one required class. |

The output limit is 4,000 tokens. All model effort settings stay low.

## Conditional provider order

Each provider has 30 calls. Run OpenAI and Gemini first for 60 calls.

- If both providers pass both families, return `proceed-development`.
- If both providers fail either family, return `repair-measurement`.
- Otherwise, return `require-claude`. Only this result permits Claude's 30
  calls.

The cheap-stage estimate is USD 0.338800. The maximum estimate is USD
1.373366. The estimate uses the observed r1 mean call cost and adds 25 percent.

The operator must approve the exact plan in `runs/calibration-r2-plan.json`.
No r2 provider call is approved. The harness rejects the pending approval
record.

After approval, run OpenAI and Gemini with new dated output paths. Summarize
both runs before any Claude call. Do not start development from a calibration
approval.
