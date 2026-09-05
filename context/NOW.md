---
title: Current state
kind: status
state: active
updated: 2026-09-04
phase: phase-5
session: 5w-selection-borrowing-and-background-stability
---

# Now

Phases 1, 2, and 4 are complete. Phase 3 remains deferred. Phase 5 remains
active until the final ColourCopy dogfood task gets an explicit operator verdict
and the closeout matrix passes. Phase 6a stays blocked.

## Stable baseline

The accepted live project has seven tracks and eight launcher rows. Its track
list is `guit sample src | guit sample | Serato Sample | Pigments | XO | FX 1 |
Master`. The first track keeps `Serato Sample | PITCHMAP | ColourCopy`.

## Session 5u result

Nested ColourCopy settlement is repaired:

- One shared workflow policy uses a 12-second deadline, 250 ms retries, and a
  maximum of three observations. It reports elapsed time, cause, and last
  progress. It rejects a result that arrives after the deadline and distinguishes
  an attempt limit from no progress.
- The adapter accepts complete remote pages that contain an existing unnamed
  slot. It does not expose that slot as a target.
- Nested remote generations can use the final confirmed route index when
  Bitwig reports sibling equality late.
- Remote pages use separate preparation frames before a complete bank read.
  This handles a new controller instance whose observers all start on page 0.
- Same-device page and behavior witnesses share inventories and sample reads.
- Each behavior witness keeps the settlement report from its own verification
  stage. Initial wrapper fingerprints use the same shared policy.
- General composition no longer nests 40- or 80-read inventory loops inside
  outer behavior retries.

Live cold and warm wrappers both proved LFO to `Frequency` and Classic LFO to
`Stereo Phase` on nested ColourCopy. The complete calls took 50,677 ms and
50,409 ms. A forced stale generation settled in 2,111 ms. Both reversals
restored the exact source device order and seven-track entry list. E97 records
the policy table and measurements.

`npm run check`, extension tests, deployment freshness, the complete 5u live
probe, and exact cleanup pass.

## Session 5v result

API 25 exposes normalized values, formatted display text, and typed discrete
domains. Its raw-value range is undefined, and it has no text parser or inverse
display-to-value conversion.

The public surface now reports normalized, displayed, discrete, and semantic
capabilities separately. Remote controls return display and discrete metadata.
An explicit semantic request fails before workspace access. The `1.5 measures`
live request returned zero changes and did not substitute a normalized value.
Direct and remote discrete-domain violations refuse the complete scalar cohort
before any write.

Classic LFO Rate proved continuous Hz displays at three normalized values.
Timebase proved 12 exact divisions from `32/1` through `1/64`. Every scalar and
the wrapper reversed. E98 records the complete API matrix and live result.

`npm run check`, extension compilation, deployment freshness, the complete 5v
live probe, and exact cleanup pass.

## Post-fix dogfood review

Session `01a0690e-1761-76b1-9e8e-635bfa35e583` produced the three-modulator
ColourCopy wrapper and then rebuilt it with a requested fourth modulator. The
review found four issues:

1. Nested remote inventory timed out during both final behavior checks.
2. The agent guessed a normalized value for `1.5 measures` and tried web and
   computer-use fallbacks instead of reporting an unproved semantic value.
3. Bitwig repeatedly returned to the foreground, with repeated selection and
   cursor retargeting as a possible cause.
4. The surface had no update operation, so the agent reversed and rebuilt the
   wrapper without proving all prior modulator state.

The focused queue is 5u settlement policy, 5v semantic units, 5w selection and
background stability, and 5x wrapper update feasibility. Return to 5t for the
final dogfood and closeout after 5x.

## Next action

Run session 5w. Isolate selection borrowing, repeated retargeting, and Bitwig
foreground changes. Then run 5x before a new final dogfood task.

## Retrospective

A modulator page belongs to its owning container, not its nested target. State
that distinction in live probe plans to prevent an avoidable retry. Controller
reload remains an operator action; always verify deployment freshness after it.
Apply shared scalar guards to both direct and remote parameter routes.
