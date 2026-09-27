# Calibration r2 result

The frozen run ID was
`phase8c2-3-json-grammar-repair-calibration-r2`. OpenAI and Gemini each
completed 30 calls with the requested model and no transport error. The
recorded cost was USD 0.324077. The cheap-stage estimate was USD 0.338800.

The frozen stopping rule returned `repair-measurement`. Progression was
eligible on OpenAI at 4/6 control trials and below the band on Gemini at 1/6.
Role continuation passed 6/6 control trials on both providers and reached a
complete ceiling. The result does not permit a Claude run.

The repaired metadata contract had no failure. One OpenAI tuple response used
noncanonical note order. No Gemini response had a syntax failure.

The integrity audit found that the inherited provider helper sent a
3,000-token output limit. The r2 plan declared 4,000 tokens. Two OpenAI
progression calls stopped at the lower limit. Preserve the r2 responses and
protocol, but do not use them to select a representation.

Demote role continuation to a regression and component diagnostic. Retain
progression as the only calibration decision family. A new provider-bearing
run must prove that its request builder uses the frozen settings before it can
receive approval.
