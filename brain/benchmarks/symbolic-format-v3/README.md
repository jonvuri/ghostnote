# Symbolic-format v3 matrix template

This package prepares the Phase 8c4f full-format matrix. It keeps the repaired
v19 task suite, but separates fixtures, format adapters, scoring, and run
policy. A new format needs one adapter in `formats.py`. It does not need a new
task generator or scorer.

The package also freezes a small external-format probe. The probe uses ABC 2.1,
Strudel 1.2.0 mini-notation, and LilyPond 2.24.4. Each arm is a composite. The
public notation carries the musical surface. A Ghostnote side ledger carries
stable IDs and velocity. The parser checks that the two parts agree.

Run the offline screen from `brain/`:

```sh
npm run benchmark:symbolic-format-v3
```

Print a full-matrix template for all registered formats:

```sh
python3 -B benchmarks/symbolic-format-v3/benchmark.py \
  --print-matrix-template
```

Print the frozen probe plan:

```sh
python3 -B benchmarks/symbolic-format-v3/benchmark.py --print-plan
```

The probe has 57 Gemini messages. It uses low thinking and makes no retry or
repair call. Do not use `--provider` until the operator approves the exact plan
and the USD 0.350000 hard limit.

The old `one-cycle-mini` arm remains a Ghostnote profile. It is not Strudel or
Tidal mini-notation. The old MIDI-like, REMI+, and OctupleMIDI arms are also
adapted profiles. Their registered names now state that fact.
