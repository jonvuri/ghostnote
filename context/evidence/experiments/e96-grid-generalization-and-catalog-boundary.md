---
title: E96 — compact modulator placement and exact catalog boundary
kind: evidence
state: active
updated: 2026-09-02
parent: ../../plan/phase-5/5t-grid-generalization-and-colourcopy-closeout.md
---

# E96 — compact modulator placement and exact catalog boundary

## Verdict

The repaired three-row allocator works across all 42 curated donors offline.
Twelve donor types also pass exact relocated live page verification on Bitwig
Studio 6.0.6. These 12 types form the supported public catalog. The other 31
host types refuse before a project write.

## Offline repairs

Page verification now accepts either one exact bare page or a complete ordinal
family such as `Classic LFO 1` through `Classic LFO 5`. It rejects missing,
extra, and malformed families. It does not remove numeric suffixes from public
names.

Curated-donor matching now normalizes both grid coordinates, the display name,
and routing fields. Sampled-preset replace and delete therefore identify a
resident donor after a later-column relocation and move every reference stub by
the exact measured footprint.

## Live matrix

`npm run probe:phase5t-grid` passed with contract 0 on Bitwig Studio 6.0.6.
All 42 curated donors formed compact offline cohorts across row and column
transitions. The live public cohort used these relocated pairs:

`XY@0:0, Vibrato@0:1, Vector-8@0:2, Vector-4@1:0, Segments@1:1,
Random@1:2, Ramp@2:0, LFO@2:1, Curves@2:2, Classic LFO@3:0,
Beat LFO@3:1, ADSR@3:2`.

All 12 exact pages and all 12 post-move behavior witnesses passed. One owned
sustained-note clip supplied the declared note-trigger and transport-running
conditions. XY, Vector-4, and Vector-8 each passed one exact operator-control
change and restoration. The Polysynth 55-parameter scalar fingerprint stayed
unchanged. Reversal was exact.

Five Classic LFO instances returned the exact family `Classic LFO 1` through
`Classic LFO 5`. Replacement kept the resident pair `0:1`. Both controls
reversed exactly.

## Envelope Follower discrimination

Envelope Follower produced no exact page on Polysynth or FX Layer at pairs
`4:0`, `0:0`, and `1:0`. An adjacent LFO page appeared in every control. The
failure follows the donor. It does not follow the host or grid pair.

The remaining unsupported types also lack an exact relocated page on both
hosts, except AHDSR and 4-Stage. Each of those objects produces two bare pages
with the same name. This shape cannot prove the exact instance count. Wavetable
LFO retains its external companion-state refusal.

## Observer repair and cleanup

Supplementary remote inventory now retries a complete fresh acquisition. It
does not combine pages from different generations. Delayed-settlement and
never-settles tests cover the boundary.

The live run restored its exact entry track list and stopped transport state
after every case. This was a disposable project and does not replace the saved
five-track baseline.

## Remaining gate

The final ColourCopy task must start in a new projectless Codex conversation.
It must use only public Ghostnote tools and record the operator's explicit
accept or veto. Phase 5 remains active until that dogfood task and the final
closeout matrix pass.

## Verification

- `npm run probe:phase5t-grid`: all cases pass on Bitwig Studio 6.0.6 and exact
  cleanup passes.
- `npm run build:donors`: all 46 curated assets regenerate.
- `npm run check`: typecheck and 998 tests pass.
- `./gradlew test`: passes from `extension/`.
- `npm run probe:hello`: deploy freshness, API 25, and the live 150-method
  contract pass.

## Retrospective

A successful isolated load is not an instance-count witness. Require exact
relocated pages before a donor enters the public catalog.
Map each manifest witness requirement to explicit live probe setup.
