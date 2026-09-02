---
title: E94 — ColourCopy retry exposes wrapper position gap
kind: evidence
state: active
updated: 2026-09-01
parent: ../../plan/phase-5/5s-public-generalization-dogfood-and-closeout.md
---

# E94 — ColourCopy retry exposes wrapper position gap

## Question

Can the generalized public surface wrap the existing ColourCopy, keep its
signal position, add useful modulation, and produce an auditionable result?

## Provenance

- Session: `01a06052-39bc-71a3-a155-278872cdfac3`.
- Transcript:
  `~/.codex/sessions/2026/09/01/rollout-2026-09-01T21-13-16-01a06052-39bc-71a3-a155-278872cdfac3.jsonl`.
- Agent: Codex Desktop `0.150.0-alpha.8`, `gpt-5.6-sol`, high effort. The
  transcript reports these values.
- Ghostnote: 53 exposed tools. The transcript exposes the complete tool set.
  Description cohort v20 and source revision
  `6dd70b4aa096ea36c16665c5925d42c5484cc320` were current for the run.
- Host baseline: Bitwig Studio 6.0.6, API 25, 150 extension methods, and build
  hash `73677cd82e4c7cd2`. E93 records this adjacent baseline. The musical
  transcript did not return these values.
- Project: `26.01-1 spread burial guit`, with seven tracks and eight launcher
  rows. The transcript reports this state.

## Result

The run used only public Ghostnote tools. It did not inspect the repository or
use a shell, test, or probe fallback.

The target track had this initial device order:

1. Serato Sample, enabled.
2. ColourCopy, enabled.

ColourCopy returned a stable 30-row DirectParameter inventory. The agent chose
Delay Rate and Regeneration. It requested an LFO amount of 0.48 and a Classic
LFO amount of 0.4.

The first wrap reached the same incorrect position and failed its behavior
witness. Its exact public reversal passed and restored the initial order. The
second wrap then returned this partial result:

- all five write stages applied;
- the same ColourCopy instance moved inside `FX Layer > Layer 1`;
- the 30-row scalar fingerprint stayed exact;
- the LFO and Classic LFO pages both read back;
- both active behavior witnesses failed because the supplementary remote
  inventory did not settle;
- the FX Layer occupied top-level position 0 instead of ColourCopy's original
  position 1.

The operator confirmed that the device panel showed the FX Layer before the
instrument. The transcript ended after the partial result. It contains no
operator audition accept or veto. The project still held the second wrapper at
the end of the session, so no cleanup claim applies.

## Cause and repair

The wrapper inserted its owned container at the track tail, then always moved
it before top-level position 0. Every later witness and reversal assumption
also used position 0. This behavior was correct only when the source device was
already first.

The local repair moves the container before the source device. After the source
moves inside, the container occupies the source's prior signal position. The
reversal now derives its order from the recorded container position. It also
accepts the pre-fix checkpoint shape so the incorrect position-0 layout can be
reversed when the exact checkpoint remains valid.

Focused engine and public-surface tests pass for a source at position 1. They
also pass exact reversal and the pre-fix checkpoint layout. This repair has not
yet passed live Bitwig verification.

## Verdict

The public retry got farther than the source run, but it failed the musical
gate. Position preservation and active behavior still need live proof before
the operator auditions the result.
