---
id: E82
kind: evidence
state: active
source: dogfooding-d02-session-7
---

# E82 — DirectParameter domains and integrity are live [K] (2026-08-23)

**Verdict: Attack Click now exposes its exact binary normalized domain. An
invalid value refuses before its cohort writes. Complete inventory checks did
not reproduce the earlier Polysynth release change and can report a later
unrequested delta without naming its author.**

## Domain boundary

The extension now adds typed v1 Kick parameter handles to its existing typed
Polysynth handles. The public inventory preserves discrete metadata only when
the host returns it. Attack Click returned these live values:

- Normalized `0`, display `Off`.
- Normalized `1`, display `On`.
- Discrete count `2`, with host names `false` and `true`.

The engine derives the allowed normalized domain `[0, 1]` from this host count.
It checks every DirectParameter setting in one cohort before the adapter gets
the first scalar. The focused public call first requested Decay `0.42` and then
Attack Click `0.28`. It refused the complete cohort, returned `[0, 1]`, and
left the complete kick inventory unchanged.

## Collateral integrity

The live adapter now reads the complete stable DirectParameter inventory after
each scalar. It permits differences only for requested parameters whose stages
have run. An unrequested value, name, presence, device identity, or inventory
change stops all later scalar writes.

The host observer does not identify the author of a parameter change. The
result therefore states only that an unrequested delta occurred in the cohort
write window and that its author is unknown. The executor also compares the
complete public preflight inventory with final readback. It puts collateral
disagreements on the first scalar receipt so that the public result cannot
claim complete verification.

Fake, live-adapter, and public-surface regressions cover an injected external
edit. They prove that the report does not call the edit a Ghostnote edit or an
operator edit.

## Live reproduction

The focused proof ran against Bitwig Studio 6.0.6 and host API 25. It created
one owned track with v1 Kick and Polysynth.

Attack Click first read as `1`. Writes to `0` and `1` read back exactly with
the expected display values. The `0.28` cohort refused before its earlier
Decay request wrote. Reverse-order reversal restored the initial value `1`
without a caveat.

The proof then seeded the exact Polysynth source state from E80 and repeated
both tonal revision cohorts. Complete inventory reads returned
`CONTENTS/R = 0.01` before the first cohort, between the cohorts, and after the
second cohort. No unrequested delta occurred. This result does not identify the
author of the earlier E80 change.

All 19 tonal changes reversed in reverse order and restored the complete seeded
inventory. Cleanup removed the owned track and restored the exact accepted
five-track list with no scratch content.

## Verification

- Complete brain test suite: 873/873 pass.
- Extension build and tests: pass.
- Live domain and integrity proof: pass.
- Contract handshake: 148 methods, hash `eb3391803ef4eea4`.
- Deploy freshness: pass.
- Live cleanup: exact accepted track list restored.

The public description cohort is `ghostnote-description-v12`. It contains 47
tools.

## Retrospective

Run deployment freshness before behavior probes that depend on new observer
handles. A stale controller can make correct brain code appear to lack new host
metadata.
