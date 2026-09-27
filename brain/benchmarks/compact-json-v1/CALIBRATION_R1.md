# Calibration r1 result

The frozen run ID was `phase8c2-3-compact-json-calibration-r1`. OpenAI,
Gemini, and Claude each completed 70 calls. All 210 calls used the requested
models and had no transport error.

| Provider | Estimated cost | Recorded cost |
|---|---:|---:|
| OpenAI | USD 0.404167 | USD 0.416980 |
| Gemini | USD 0.256802 | USD 0.215447 |
| Claude | USD 1.429609 | USD 1.931190 |
| Total | USD 2.090578 | USD 2.563617 |

The provider dashboards remain the external spend authority.

The result is `repair-measurement`. Progression was at a floor on OpenAI and
Gemini. Revoicing passed all 18 control trials and was at a ceiling. Role
continuation was eligible, but JSON order failures prevent reuse of its format
comparison.

`calibration_report.py` verifies the three manifests, raw-response hashes,
models, prompts, approval, retained summary, and costs. It records the prompt
defect: the one-note example did not specify multi-voice collection order or
task-specific metadata.

Do not revise the frozen r1 responses or protocol. Do not use r1 to select a
format.
