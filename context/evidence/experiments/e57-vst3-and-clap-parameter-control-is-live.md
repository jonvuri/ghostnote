---
id: E57
kind: evidence
state: active
source: phase-4-session-4e-plugin-parameter-proof
---

# E57 — VST3 and CLAP parameter control is live [K] (2026-08-22)

**Verdict: explicit VST3 and CLAP insertion, DirectParameter enumeration,
write, independent readback, and exact replay passed on the installed Zebra3
pair. The result is machine-specific.**

## Contract and failure behavior

The device source union now has separate `vst3` and `clap` variants. A VST3
source carries a 32-hex-character class UID. A CLAP source carries a non-empty
ID without surrounding space or control characters. The encoder rejects an
invalid identifier before it emits an insertion frame. The former public
`plugin` source no longer exists.

`device.insertVst3` is now product wire. The fake, encoder, surface, wire guard,
and live adapter cover both formats. If structural readback cannot identify an
inserted position, the insertion receipt fails. It does not mint a device or
claim success.

## Live proof

The probe created one owned empty instrument track in project `26.05-2 moon`.
It inserted these installed plugins by explicit ID:

- Zebra3 VST3 class UID `D39D5B69D6AF42FA123456785A334D44`.
- Zebra3 CLAP ID `com.u-he.Zebra3`.

The VST3 inserted at observed position 0 in 1,388 ms. It exposed 2,185 named
DirectParameters. The CLAP inserted at observed position 1 in 1,346 ms. It
exposed 2,193 named DirectParameters.

On each format, `Attack Rate` moved from `0.5` to `0.55`. A separate parameter
read agreed with the requested value. Exact replay restored `0.5` and a second
read confirmed it.

The VST3 inventory settled in 1,238 ms. The CLAP inventory settled in 1,470 ms.
This single paired sample showed comparable observer settlement. It is not a
cross-machine performance claim.

A valid but absent CLAP ID, `com.ghostnote.missing-plugin-4e`, changed no chain
state. The adapter returned a failed insertion receipt with no minted device.
The result is a missing installed plugin on this machine, not an API limit.

## Cleanup and verification

The probe deleted only the two inserted devices, confirmed the exact empty
scratch chain, removed its owned track, and restored the project to seven
tracks. The complete live conformance suite then passed 54 rows with six
expected skips. Its exact fixture cleanup removed both owned tracks. The final
read-only 2k baseline passed the complete 7-by-8 launcher grid and both accepted
observation records.

The full brain check passes 690 tests, including typecheck. Extension tests,
the fresh 145-method handshake, context check, and staged diff checks pass.

## Retrospective

Live commands can outlive a tool wrapper that reports completion. Track the
actual process until it exits. Run exact-ID fixture cleanup after an interrupted
live suite before any baseline claim.
