---
title: Current state
kind: status
state: active
updated: 2026-09-05
phase: phase-5
session: 5t-final-colourcopy-dogfood-and-closeout
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

## Session 5w result

The public existing-device wrapper and reversal now share one selection scope.
Confirmed track and device targets are reused only while exact identity, route,
pin, generation, and structural-revision guards agree. Structural change,
cursor drift, or target mismatch forces a complete retarget. A newer operator
selection suppresses stale restoration.

A review follow-up repaired three gaps. Selection restoration now uses an
extension-owned lease and one atomic guarded handler. Track-cursor drift clears
the cached track hold before retargeting. The live probe now has repeatable
frontmost and background controls, observed selection-event measurements, and
direct and remote scalar write and reversal cases.

The final control reduced cursor points from 34 to four and observed selection
events from one to zero. Across the background scalar controls, wrapper, and
reversal, target reuse avoided 141 cursor points and reused 31 device targets.
Bitwig stayed backgrounded. Both scalar reversals, the wrapper reversal, exact
source order, and the seven-track baseline passed. E99 records the full matrix.

`npm run check` passes 1,023 tests. Extension compilation, deployment freshness,
the complete live probe, and exact cleanup pass.

## Session 5x result

No safe existing-wrapper update operation is available with the current host
API. The host cannot edit live modulator topology, export the current wrapper,
or read every modulator object, route, amount, setting, and opaque state.

A guarded rebuild can keep the nested device instance and observed scalar
fingerprint. It cannot detect or preserve an unobserved operator edit to the
wrapper. A retained source artifact has the same limit. Version 1 checkpoint
refusal is necessary but does not close the gap for a later live edit.

The public surface is unchanged. E100 records the inventory, strategy matrix,
estimates, and exact future capability trigger. A focused follow-up stays
deferred until the host supplies complete live state capture or equivalent
runtime APIs.

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

The focused queue completed sessions 5u through 5x. Session 5x found that a safe
wrapper update needs a host capability that is not available. Return to 5t for
the final dogfood and closeout.

## Next action

Start the final projectless ColourCopy dogfood task from session 5t. Use only
public Ghostnote tools and get the operator's explicit audition verdict. Then
run the complete closeout matrix if the operator accepts the result.

## Retrospective

Count nested batch methods in the same trace as direct wire calls. Keep cursor
and device reuse inside the workflow scope that owns selection borrowing.
Put the ownership check in the same extension handler as its selection write.
Use a native scalar when the test controls a public method rather than plug-in
callback timing.
Require complete current-state capture before an operation claims to update a
live wrapper.
