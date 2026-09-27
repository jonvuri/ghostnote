# Phase 8c2 targeted holdout

This protocol tests the label-only compact candidate on fresh generated
fixtures. The initial six-arm analysis selected this candidate on all three
providers. Full v0-style compact did not pass the development gate.

The holdout is fixed before provider calls. Do not revise the candidate from
its result. A pass selects label-only compact for the Phase 8c3 full matrix. It
does not unblock Phase 8f.

## Scope

The arms are compact-bar v1, label-only compact, exact JSON, and native
MIDI-Like. Each provider gets 72 calls:

- three new fixtures for each of the four hard families;
- one new fixture for each of the three guards; and
- one new motif prompt repeated three times for each arm.

The holdout has 216 calls across OpenAI, Gemini, and Claude. The motif prompt
now gives the required new-note IDs. This correction makes the primary
identity-arm sentinel score well-defined.

## Offline checks

Run from brain:

~~~sh
python3 benchmarks/compact-format-v2/holdout.py --self-test
python3 benchmarks/compact-format-v2/holdout.py \
  --check benchmarks/compact-format-v2/expected-holdout-deterministic.json
~~~

The checks reject fixture-hash overlap with the initial development cohort and
the retained symbolic-format v1 cohort.

## Approval gate

The provider action requires a separate approval file. It must match the
holdout run ID, protocol hash, and run-plan hash. Approval for the initial
six-arm run does not approve this holdout.

After explicit approval, run each provider with holdout.py and a new dated
output path. Summarize only the three complete provider manifests.

The holdout uses the frozen development margins. It requires a 5-point hard
macro improvement, no guard regression larger than 5 points, no repeated
candidate-only family loss, an input-token ratio of at most 0.90 to exact JSON,
and an output-byte ratio of at most 0.80 to exact JSON. At least two providers
must pass. No other provider can have a hard macro loss larger than 5 points.
