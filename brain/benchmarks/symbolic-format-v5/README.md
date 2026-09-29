# Symbolic-format v5 full matrix

This package freezes the fresh eight-arm symbolic-format matrix. It reuses the
v4 adapters and repaired component scorer. It changes only deterministic
fixture parameters needed for content freshness.

The matrix has these arms:

- compact bar `FIELDS`;
- compact bar local labels;
- exact object JSON;
- ABC 2.1 composite;
- Strudel 1.2.0 composite;
- LilyPond 2.24.4 composite;
- MusicXML 4.0 composite; and
- Ghostnote MIDI-like profile.

Each provider receives 74 messages per arm and 592 messages in total. Across
OpenAI, Gemini, and Claude Haiku, the plan has 1,776 messages.

Run the offline screen from `brain/`:

```sh
npm run benchmark:symbolic-format-v5
```

Print the frozen plan:

```sh
python3 -B benchmarks/symbolic-format-v5/benchmark.py --print-plan
```

Do not use `--provider` until the operator approves the exact plan and the USD
20.250000 total hard limit. The run makes no retry or repair call.
