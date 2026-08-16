---
id: E24
kind: evidence
state: active
source: phase-1-session-5b-fidelity
---

# E24 — Gain has an exact inverse and 20 of 21 note properties round-trip [K] (2026-08-16)

**Verdict: Bitwig reports note gain at exactly twice the setter input. The
write-side inverse is `requested / 2`. With that one correction, 20 note
properties apply, verify, and revert exactly. Pressure remains unwritable and is
refused before mutation.**

## Independent handles

The focused harness partitions the rig before either adapter starts:

- cursor `0` is the only writer;
- cursor `1` is the only read witness;
- the executor delegates all reads to the witness adapter;
- neither adapter can allocate the other cursor.

This makes D15 structural. A test cannot select the writing cursor for stash,
verification, or final readback by accident.

## Gain measurement

The raw setter sweep used `0.1`, `0.25`, `0.4`, `0.49`, `0.5`, `0.51`, `0.6`,
`0.7`, and `1.0`. Each sample reset gain to zero first. Two witness reads at
each value were identical. Readback was exactly:

| Setter input | Witness readback |
|---:|---:|
| 0.10 | 0.20 |
| 0.25 | 0.50 |
| 0.40 | 0.80 |
| 0.49 | 0.98 |
| 0.50 | 1.00 |
| 0.51 | 1.02 |
| 0.60 | 1.20 |
| 0.70 | 1.40 |
| 1.00 | 2.00 |

The reset read back as zero. The widened curve produced the same result in the
measurement run and both final-regression runs.

An earlier narrow run did not reset between samples and one `0.5` write did not
replace the prior `0.25` value. The repeated witness read was stable at the old
`0.5` readback. The reset control separated setter timing from the mapping and
made all later curves identical.

## Contract result

`orderedNoteProps` now emits `gain / GAIN_READ_SCALE`. This is the one shared
property encoder used by the fake and live adapters. `NOTE_PROP_FIDELITY.gain`
is now `exact`; gain is no longer withheld during replay.

`npm run probe:5-fidelity` passed 12 checks:

- all 10 fixture identities matched the baseline;
- one empty row was claimed from live readback;
- the raw gain curve and zero revert passed through cursor `1`;
- the table contained 20 exact properties and one unwritable property;
- one independent read contained every exact property;
- the executor patch applied with no disagreement through witness-only reads;
- reversal returned all 20 exact properties to the initial readback;
- pressure refused and witness readback stayed unchanged;
- the probe clip was removed;
- the original selection was restored.

The extension and wire method set did not change. The probe left no clip or
other project residue.

## Retrospective

Reset state between curve samples. This separates mapping from a write that did
not land. The focused probe now enforces this rule. No repository instruction
change is needed.
