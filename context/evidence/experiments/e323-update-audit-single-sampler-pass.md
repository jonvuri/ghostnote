---
title: E323 — Single Sampler export and reversal pass
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E323 — Single Sampler export and reversal pass

## Result

The corrected single-Sampler edit passes the fresh host-export comparison
and supported in-session reversal. The original Sampler remains, its base
controls match the pre-edit values, and the copied donor hash is unchanged.
The multi edit then passes insertion, page, and parameter-identity checks.
The same driver is paused for the multi export. The whole Sampler case and
general update audit are not yet accepted.

## Single export and reversal

The operator confirmed `7 Reso Chime.aiff`, Single mode, a loaded waveform,
and no missing-sample warning. Both `Inst 1` selections were restored, with
transport stopped. The agent found the freshly saved file in the Sampler
library and copied it without overwriting an existing destination. The
[copy record](../data/bitwig-upgrade-audit/continuation-3-614/single-export-copy.json)
retains equal-byte verification and the operator report.

The working file is
`/Users/jonvuri/Bitwig Upgrade Work/2026-10-21/gn-ua-0b6c3297-single-edited.bwpreset`.
It contains 12,077 bytes, SHA-256
`0fb789227b67543fa6650ccc02e4c6b3f123894046aeb630e934d469c2ad496e`.
The [evidence copy](../data/bitwig-upgrade-audit/continuation-3-614/sampler-single-host-export.bwpreset)
and [full single result](../data/bitwig-upgrade-audit/continuation-3-614/sampler-single-edit.json)
retain the host-saved bytes, route inventory, metadata, direct controls,
remote pages, and operator observations.

The driver checked file freshness, bounded size, complete inspection,
retention of the original route, one appended attack route at amount 0.3,
and equal sample references. The host-saved version is 6.1.4. Both routes
target `CONTENTS/AMP_ATTACK_TIME`; the original packaged sample reference
remains. Single mode supplies the relevant sample-state observation; this
does not claim multisample-zone coverage or audible behavior.

Fresh live guards passed before reversal. The same server session used its
current change ID. Independent reversal readback confirms removal of only
the inserted Sampler at position 1. A separate device-bank read leaves one
Sampler, the original controls match, and a fresh donor inspection confirms
the original fingerprint. No expired change ID was reused.

## Multi pause

The [current summary](../data/bitwig-upgrade-audit/continuation-3-614/single-pass-multi-pause.json)
records both edit verdicts, the single reversal, costs, and the pause.
The multi edit passes host, LFO page, and target-identity checks. Its fresh
host export and operator observations remain pending. The source metadata
references these two packaged samples:

- `Bitwig/Sampled Synths Vol. 1:13/samples/ASM Chords/ASM Chord C7.wav`.
- `Bitwig/Sampled Synths Vol. 1:13/samples/ASM Chords/ASM Chord C9.wav`.

The operator was asked to save the SECOND Sampler on
`gn-ua-0b6c3297-multi` to the library as `gn-ua-0b6c3297-multi-edited`,
check both named samples and missing-resource indications in the multisample
editor, and report visible zone count or ranges. Then restore the `Inst 1`
track header and first empty Launcher cell, with transport stopped.
The agent will copy the fresh file to
`/Users/jonvuri/Bitwig Upgrade Work/2026-10-21/gn-ua-0b6c3297-multi-edited.bwpreset`.

Terminal session `88497` remains alive, command
`7e46a0eb-7916-463d-8d40-3fdc7144c387`, in `continuation-3-614`.
No host calls run while paused. Do not start another client or rerun the
case. After the operator handoff, copy and verify the export, then supply
only confirmed observations to the existing driver. It will check the file,
reverse in-session, and compare the full fixture. If the driver exits,
preserve its state and inspect before any recovery write.

## Costs, checks, and limits

| Operation | Elapsed | Logical calls | Wire turns | Summed wire time |
| --- | --- | --- | --- | --- |
| Single edit (E322) | 2,266.752 ms | 71 | 57 | 1,309 ms |
| Single reversal | 1,396.586 ms | 50 | 35 | 815 ms |
| Multi edit | 2,245.071 ms | 71 | 57 | 1,303 ms |

The multi edit has the same call count as the single edit. It is not an equal
sample-resource workload. Operator pause time is excluded. No timing-only
repeat was made. The existing ledger models apply; no implementation or
public description changed. E321's full gate still passes all 2,450 tests.
All inherited evidence hashes match. Documentation links and staged diffs
were checked.

Six owned audit tracks remain in stopped `gn-upgrade-audit`. The single track
has its original Sampler; the multi track has two Samplers until the pending
export and reversal. The driver retains its lock and active case, with no
failure or uncertain write. No project save, launch, engine, or Grid command
was sent. Finish the multi export, then the remaining operator checkpoints,
persistence, listening, and cleanup from the
[driver guide](../../plan/phase-9/9b-update-audit-driver.md). General acceptance
still gates the separate 9b.6 doctor.
