# Calibration r3 settings repair

The r3 run ID is
`phase8c2-3-json-settings-repair-calibration-r3`. It keeps progression as the
only decision family. Role continuation and revoicing remain regression and
component diagnostics.

A later development run must use 20 progression fixtures. This gives a
smallest primary macro step of 5 percentage points.

The run uses three fresh progression fixtures across all five arms. Each
provider has 15 calls. Run OpenAI and Gemini first for 30 calls.

- If both providers are eligible, return `proceed-development`.
- If neither provider is eligible, return `repair-measurement`.
- Otherwise, return `require-claude`. Only this result permits 15 Claude
  calls.

The request builder uses the declared 4,000-token limit for every provider.
Its deterministic audit compares the declared settings with each request
payload. Each result also records the request settings.

The cheap-stage estimate is USD 0.202548. The maximum estimate is USD
0.719831. The estimate uses the latest observed provider mean call cost and
adds 25 percent.

The operator must approve the exact plan in `runs/calibration-r3-plan.json`.
No r3 provider call is approved. The harness rejects the pending approval
record.
