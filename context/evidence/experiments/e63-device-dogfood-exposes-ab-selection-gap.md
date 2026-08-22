---
id: E63
kind: evidence
state: active
source: phase-4-session-4j-dogfood
---

# E63 — Device dogfood exposes an A/B selection gap [K] (2026-08-22)

**Verdict: the public parameter inventory was sufficient for one accepted sound-
design task. The task also showed that factual alternate-tool descriptions do
not tell an agent when a subjective revision should become an A/B alternate.**

## Natural task

The open project was `26.05-2 moon`. `Harmony – Open Minor` started with
`Key Filter+ → Repro-5`. The task was to make it wider and more atmospheric.
The registered version-5 device surface appended Chorus+ and Reverb. It returned
six named Chorus+ parameters and 13 named Reverb parameters.

The first result used a slow, shallow chorus and a restrained reverb. The
operator asked for a more prominent and colder reverb. Exact returned ids set
the revised normalized values:

| Device | Parameter | Value |
|---|---|---:|
| Chorus+ | LFO Speed | 0.22 |
| Chorus+ | Modulation Depth | 0.35 |
| Chorus+ | Mix | 0.30 |
| Reverb | Room Size | 0.72 |
| Reverb | Reverb Time | 0.50 |
| Reverb | Mix | 0.38 |
| Reverb | Stereo Width | 0.78 |
| Reverb | Low Band Reverb Factor | 0.10 |
| Reverb | High Band Reverb Factor | 0.46 |

Fresh independent inventories confirmed every value. The operator could not
judge the revision without A/B comparison.

## A/B result

Managed device alternates already existed, but the initial task did not select
them. The target also had four top-level devices by then. A new appended
container was outside the two observable container positions. One guarded
internal relocation moved the empty Instrument Layer to position 1. Guarded
internal rename and create operations made `Original` and `Revised`. This was a
setup exception, not a new public route.

The registered alternate tools then copied Repro-5 into `Original`, moved
`Repro-5 → Chorus+ → Reverb` into `Revised`, and selected `Original`
exclusively. Deep public inventories confirmed that the moved Chorus+ and Reverb
kept their values. The operator compared both versions and kept `Revised`.

The directed `keep_device_alternate` operation removed `Original` and the
container. Complete readback proved the final top-level order:

`Key Filter+ → Repro-5 → Chorus+ → Reverb`

The accepted change is not yet saved.

## Selection-policy finding

Description versions 1 through 5 explain the device-alternate mechanics,
boundaries, cost, switching, and destructive collapse. They do not map request
intent to alternate use. No planner or classifier supplies that policy. The
agent therefore used direct writes for a request that the operator understood as
a version to compare.

The operator accepted this candidate policy for evidence only [I]:

- Use a device alternate for subjective or comparative language such as
  `version`, `variation`, `try`, `alternative`, or `more` and `less`, when
  audition decides the winner.
- Use direct writes for explicit replacement commands such as setting one exact
  value, disabling one device, or restoring prior state.
- Ask only when the intent is ambiguous and alternate construction has a
  material cost or structural limit.

This is one natural session. D18 says not to revise descriptions from one
ordinary preference. The cohort and its fingerprint do not change. A later
distinct use can confirm, reject, or refine the policy.

## Friction

- One two-device top-level inspection first returned an incomplete view. A
  bounded read-only retry returned the complete chain before any write.
- The public alternate creator cannot complete when its appended container lands
  after position 1. This natural four-device case needed the internal setup
  exception described above.
- Multi-setting parameter requests landed, but the dogfood client did not print
  their final receipts. Fresh independent inventories proved the exact values
  before the session continued.

## Retrospective

The general parameter inventory was sufficient. No device-specific view is
needed. The missing part was intent-sensitive alternate selection, not parameter
access.
