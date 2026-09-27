# Calibration r3 result

The frozen run ID was
`phase8c2-3-json-settings-repair-calibration-r3`. OpenAI and Gemini each
completed 15 calls with the requested model and no transport error. The
recorded cost was USD 0.198778. The cheap-stage estimate was USD 0.202548.

The result is `proceed-development`. Progression passed 3/6 control trials on
OpenAI and 2/6 on Gemini. Both providers are inside the frozen eligibility
band. The result does not permit or need a Claude calibration run.

The request settings matched the frozen 4,000-token limit. One Gemini
exact-object MIDI response stopped at the limit after 3,358 thinking tokens.
A development plan must use at least 5,000 output tokens and must audit the
request payload.

Progression is the only decision family. A development run needs 20 fixtures
to give a smallest primary macro step of 5 percentage points. Development is
a separate provider-bearing run and needs explicit approval.
