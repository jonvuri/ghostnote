---
title: MusicXML and MIDI-like probe awaits approval
kind: evidence
state: superseded
updated: 2026-09-29
phase: phase-8-agent-native-live-engine
session: phase8c4f-musicxml-midi-probe
---

# E199: MusicXML and MIDI-like probe awaits approval

The `symbolic-format-v4` package adds MusicXML 4.0 and the Ghostnote MIDI-like
profile without changing the completed v3 package. The MusicXML adapter uses a
pinned `score-partwise` subset, one part per overlap-safe lane, declared exact
divisions, rests for gaps, and a Ghostnote side ledger. The MIDI-like adapter
is explicitly a repository profile, not a public standard.

Both adapters parse their public surface and side ledger independently. A
surface failure does not erase ledger-based musical scoring. The deterministic
screen injects broken surfaces and confirms that musical components remain
measurable while structure and alignment fail.

The exact 19 selected tasks have no ID-free content-hash overlap with the v3
probe or inherited v19 cohort. They contain no internal content duplicate. All
suite, adapter, perfect-score, repair, freshness, schedule, and prompt-size
checks pass.

The frozen probe has 38 Gemini calls on `gemini-3.8-flash` with low thinking.
The recent-cost estimate is USD 0.090000. The hard limit is USD 0.200000. There
are no retries or repair calls.

The protocol hash is
`73987ce70c0b2864b728ebe41b53fc605b56433e04ea4850f6e40951d998e8bf`.
The run-plan hash is
`46de6fc3bac85a3508a8c698a2f26109229170783d7381c8d6653f3cb4d62408`.

No provider request has been made. The approval record remains pending.

[E200](e200-musicxml-midi-probe-validates-final-matrix-arms.md) records the
approved run and supersedes this pre-run state.

The final matrix template now contains the exact eight requested arms. It has
592 messages per provider and 1,776 messages across three providers. Alda is
the main optional omission. Its lower practical use and the existing breadth
make it unnecessary for the current product decision.
