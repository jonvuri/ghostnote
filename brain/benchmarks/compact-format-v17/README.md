# Compact format v17

This package freezes the second medium-effort task-difficulty calibration. It
keeps the v16 formats, component scoring, OpenAI setting, schedule blocks,
failure policy, and cost accounting. It changes only task content.

Analysis has three independent hard cases per prompt. Each case has a hard
chord and an eight-value motif pair. The source interleaves all chord notes and
eight distractor notes. Scoring remains independent for each case and
component.

Affine continuation keeps six source events. Each voice has an explicit axis,
semitone offset, output start, and rhythmic factor. The model must select the
rule from the source voice, calculate the note fields, and sort the output
canonically. The output schema and component scorer do not change.

The directional stage contains OpenAI only. It has ten fresh prompts for each
decision family and format, plus two serialization controls per format. The
maximum is 66 messages. OpenAI uses medium reasoning and a 12,000-token output
limit.

Run the pinned offline check from `brain`:

```sh
python3 -B benchmarks/compact-format-v17/benchmark.py \
  --check benchmarks/compact-format-v17/expected-deterministic.json
```

No provider request is approved. The operator must approve the exact protocol,
run plan, cohort, candidates, runner, 66-message limit, and USD 0.650000 hard
limit.

Stop after OpenAI. Do not run Haiku automatically. A promising OpenAI result
needs a separate frozen Haiku supplement and explicit approval.
