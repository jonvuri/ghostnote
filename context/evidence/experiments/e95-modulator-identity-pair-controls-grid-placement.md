---
title: E95 — modulator identity pair controls grid placement
kind: evidence
state: active
updated: 2026-09-01
parent: ../../plan/phase-5/5s-public-generalization-dogfood-and-closeout.md
---

# E95 — modulator identity pair controls grid placement

## Question

Does the generalized wrapper place every transplanted modulator in a visible,
compact, and interactive tile?

## Provenance

- Session: `01a06065-f052-79e2-9f4a-19c07231869e`.
- Transcript:
  `~/.codex/sessions/2026/09/01/rollout-2026-09-01T21-34-48-01a06065-f052-79e2-9f4a-19c07231869e.jsonl`.
- Agent: Codex Desktop `0.150.0-alpha.8`, `gpt-5.6-sol`, high effort. The
  transcript reports these values.
- Ghostnote: 53 exposed tools from description cohort v20 at source revision
  `1edf227e8f9a5ffcecd0d81018a7c8df978d487a`. Exposure is observed. The
  description and revision are timeline facts.
- Host baseline: Bitwig Studio 6.0.6, API 25, 150 extension methods, and build
  hash `73677cd82e4c7cd2`. E93 records this adjacent baseline. The musical
  transcript did not return these values.
- Project: `26.01-1 spread burial guit`, with seven tracks and eight launcher
  rows. The transcript reports this state.

## Result

The run used only public Ghostnote tools. It did not inspect the repository or
use a shell, test, or probe fallback.

The position repair passed live. The owned FX Layer replaced ColourCopy at
position 1 after Serato Sample. The same ColourCopy instance and its stable
30-row scalar fingerprint remained inside the container.

The agent requested these modulators in order:

1. LFO to Delay Rate.
2. Random to Regeneration.
3. Beat LFO to Brightness.
4. Classic LFO to Stereo Phase.

All four objects and routes existed. Fresh reads found all four remote pages.
The operator also confirmed that Classic LFO modulated its parameter and
appeared in the inspector. The modulator panel was wrong: Beat LFO had several
empty spaces before it, and Classic LFO had no visible tile. The wrapper call
itself returned a partial result because its immediate supplementary remote
inventory did not settle. Later reads did settle. No explicit audition accept
or veto was recorded.

## Cause

E88 proved that the `0x1a1a`/`0x1a1b` pair is the list-local load identity. It
did not test the pair's UI meaning. The host-authored 43-modulator zoo advances
`0x1a1a` after each group of three and repeats `0x1a1b` values 0, 1, and 2.
The operator screenshot now identifies those fields as a three-row grid:

- `0x1a1a` is the column;
- `0x1a1b` is the row.

The old authoring kept each donor's original column and assigned a global row.
For this request it deterministically wrote `0:0`, `0:1`, `2:2`, and `3:3`.
That created the visible diagonal gaps. The fourth object remained valid and
active, but row 3 put its tile outside the panel.

## Repair

Add now selects the first free slot in a three-row, column-major grid. The same
request writes `0:0`, `0:1`, `0:2`, and `1:0`. A deleted gap is reused. Replace
keeps the resident grid pair instead of moving the replacement to donor state.

Focused binary and wrapper-composition regressions pass. They cover the exact
four donor types and the compact pair sequence. Live Bitwig verification of
the repaired grid remains open.

## Verdict

The wrapper-position repair is live. The generalized musical retry is still
open because modulator-grid usability needs a repaired live retry and the
workflow still needs an explicit operator audition verdict.
