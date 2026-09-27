# Targeted holdout r1 plan

The targeted holdout uses the 20 reserved progression fixtures. It compares
the three cells that development froze:

- `exact-object-json-midi`, as the control and full-capability fallback;
- `exact-object-json-pc-register`, as the pitch candidate; and
- `tuple-json-midi`, as the shape candidate.

Each provider has 60 isolated calls. The total scope is 180 calls. OpenAI and
Gemini keep the 5,000-token limit. Claude uses 7,000 tokens because six
development responses stopped at the 5,000-token limit. All providers use
their low-effort setting and default temperature.

Tuple MIDI passes when its paired primary result is no more than 5 percentage
points below exact-object MIDI on at least two providers. Exact-object
pitch-class/register passes when its pitch-critical result improves by at
least 5 percentage points on at least two providers. On the same providers,
its primary result must be no more than 5 percentage points below
exact-object MIDI.

The holdout selects each experimental cell that passes its frozen gate. It
returns `select-for-phase8c3` when at least one experimental cell passes.
Otherwise, it returns `do-not-select`. Exact-object MIDI remains the recorded
fallback, but the control cannot cause a positive holdout decision by itself.

Native MIDI-like did not enter holdout. Do not make a holdout provider call
without explicit approval for the frozen plan.
