---
title: E321 — Sampler library export and name compatibility
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E321 — Sampler library export and name compatibility

## Result

The operator saved the second Sampler through Save Preset to Library. The
file was found in `Documents/Bitwig Studio/Library/Presets/Sampler/` and copied
to the requested working path. The source and copy have equal bytes. The
host export retains the original attack route, the added route at amount
0.3, and the original packaged sample reference. The live inspection proves
that all content outside the inserted Sampler is unchanged.

The named Sampler attack recipe now accepts the measured `Gated Attack Time`
label. Explicit parameter targets still require the exact supplied name.
The audit route comparison now admits Bitwig's numbered LFO labels while
checking positions, target IDs, ranges, and amounts. A bounded recovery is
implemented. It has not run. Recovery and the corrected Sampler live case
remain pending; the upgrade is not accepted.

## Export and operator observations

[Copy record](../data/bitwig-upgrade-audit/sampler-name-check-614/copy.json):

- Source: `/Users/jonvuri/Documents/Bitwig Studio/Library/Presets/Sampler/gn-ua-0b6c3297-single-name-check.bwpreset`.
- Destination: `/Users/jonvuri/Bitwig Upgrade Work/2026-10-21/gn-ua-0b6c3297-single-name-check.bwpreset`.
- Size: 12,081 bytes. SHA-256:
  `4fff38ebccb992c3474edea1f1b181f0333c1541a83cd014956c4233b176388b`.
- The source was preserved. An identical
  [evidence copy](../data/bitwig-upgrade-audit/sampler-name-check-614/host-export.bwpreset)
  is retained in the repository.

The [operator record](../data/bitwig-upgrade-audit/sampler-name-check-614/operator.json)
records `7 Reso Chime.aiff` and a reported sample rate of 44.1 kHz. The
attached screenshot shows Single mode, a visible stereo waveform, root C3,
gain 0 dB, and the displayed play range from 0 ms to 2.03 s. This is a
single sample; no multisample-zone claim is made. A visible loaded waveform
supports this sample observation, but is not a scan of all project resources.

The [decoded export](../data/bitwig-upgrade-audit/sampler-name-check-614/inspection.json)
has application version 6.1.4. Both source and export reference
`Bitwig/Crossfading Synths:3/samples/7 Reso Chime.aiff`. The original route
remains on modulator position 0 with amount 3.0600000000000014 and range
[-3, 1]. The new route is at position 1 with amount 0.3 and the same range.
Both target `CONTENTS/AMP_ATTACK_TIME`.

Bitwig saved the modulator names as `LFO 1` and `LFO 2`. The old audit compared
the source label `LFO` literally and reported a lost route. The
[corrected comparison](../data/bitwig-upgrade-audit/sampler-name-check-614/comparison.json)
passes. It admits only the complete numbered sequence for the LFO category,
retains each modulator position, and requires the new route on the appended
modulator. Wrong labels, order, positions, IDs, ranges, or amounts refuse.
The decoded parameter display name comes from the inspection catalog; it is
not a live host name witness. The wire controls establish the live rename.

## Live inspection and selection

The [read-only command log](../data/bitwig-upgrade-audit/sampler-name-check-614/live-inspection.txt)
records a complete inspection in the
[current attempt](../data/bitwig-upgrade-audit/continuation-2-614/state.json).
The single track has two enabled Samplers at positions 0 and 1. Their base
parameter values match. The original Sampler controls and all other fixture
content match the last passed structure case. No recovery write was sent.

The operator selected `Inst 1` row 0 and confirmed stopped transport. Readback
confirms that Launcher selection, but mixer selection remains
`gn-ua-0b6c3297-single`. The operator was asked to select the `Inst 1` track
header as well and keep row 0 selected and transport stopped. That response
is pending. No automatic selection write is made.

## Compatibility correction and recovery

The internal named recipe admits `Gated Attack Time` only after the existing
preset inspection binds the target to native Sampler. The owned-composition
path carries the same alias after its existing device binding check. The
original `AEG Attack Time` label remains valid. Explicit ID/name targets get
no alias. Other devices and unknown names still refuse. Behavior sampling
and remote fallback use the initially observed exact name; a later name
change refuses even when both names belong to the recipe.

The fix adds no host call or wait. The surface performs one bounded lookup
in the decoded entry list for nested targets. Public input schemas and tool
descriptions remain unchanged at v52. No extension deployment is needed.
The [ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#9b-update-audit-driver-model-before-implementation)
records this model and the recovery bound. Live measurement of the corrected
Sampler case remains required.

`recover-sampler-name <dir> <host-export>` accepts only the observed failure
and single insertion. It checks the host-saved routes, current version,
sample references, exact Sampler pair, both complete control banks, and
unchanged content elsewhere. Both mixer and Launcher selection must match
the baseline. It resolves the pending intent only after this proof, removes
position 1, and compares the full fixture independently. It does not reuse
the expired change ID. The failure and resolved intent remain in the source
record. After success, `fork-recovered` creates a new continuation with
transitive source hashes. Only the failed Sampler case must restart.

The driver prompt now names Save Preset to Library and the expected preset
name. The agent can copy that file to the working folder while the driver
is paused. The driver reads no host state during that pause. Host export and
operator observations remain required for each corrected single and multi
edit before its supported reversal.

## Verification and continuation

The [final required gate](../data/bitwig-upgrade-audit/sampler-name-check-614/final-full-check.txt)
passes TypeScript checks, the Python oracle, and all 2,450 tests, with no
failure or skip.
The focused tests cover both named labels, explicit-name refusal, wrong
device refusal, later name drift, owned composition, route preservation,
and the exact recovery boundary. The earlier
[focused run](../data/bitwig-upgrade-audit/sampler-name-check-614/focused-tests.txt)
passed 93 tests. An initial typecheck found an unsupported test option; it
was removed before the full gate. No product write was made during that fix.

After the operator restores both selections, run the reviewed recovery from
the [driver guide](../../plan/phase-9/9b-update-audit-driver.md#inspect-cleanup-and-failure).
Then create a fresh continuation and run Sampler with the corrected recipe.
Complete the remaining operator checkpoints, persistence, listening, and
cleanup in the same update-audit session. Keep all E320 failures and source
proofs. The separate 9b.6 doctor remains gated on general acceptance.

## Lesson

Save Preset to Library is the available host action. Give the operator a
preset name, then find and copy the result. State mixer selection and
Launcher selection separately; selecting a Launcher cell does not prove
the mixer selection. The driver guide now uses both instructions.
