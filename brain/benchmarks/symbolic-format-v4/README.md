# Symbolic-format v4 follow-up probe

This package adds MusicXML 4.0 and the Ghostnote MIDI-like profile to the
repaired symbolic-format matrix. It does not change the completed v3 package.

The MusicXML arm uses a pinned `score-partwise` subset. Each overlap-safe lane
is one part. Integer duration values use a declared number of divisions per
quarter note. A Ghostnote side ledger supplies stable IDs and velocity.

The MIDI-like arm is a Ghostnote profile. It is not a public MIDI text
standard. It uses absolute rational time and duration tokens with the same
side-ledger contract.

Both adapters parse the notation and side ledger independently. Musical
components come from the ledger. Structure, notation-ledger alignment, and
canonical form remain separate diagnostics.

Run the offline screen from `brain/`:

```sh
npm run benchmark:symbolic-format-v4
```

Print the exact eight-arm matrix template:

```sh
python3 -B benchmarks/symbolic-format-v4/benchmark.py --print-matrix-template
```

Print the frozen two-arm probe plan:

```sh
python3 -B benchmarks/symbolic-format-v4/benchmark.py --print-plan
```

The probe has 38 Gemini messages. It uses low thinking and makes no retry or
repair call. Do not use `--provider` until the operator approves the exact plan
and the USD 0.200000 hard limit.

The MusicXML subset follows the W3C MusicXML 4.0 structure and duration rules:

- https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/score-partwise/
- https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/divisions/
- https://www.w3.org/2021/06/musicxml40/tutorial/midi-compatible-part/
