---
title: Phase 4, session 4e — VST3 and CLAP parameter proof
kind: plan
state: complete
status: Complete. E57 records explicit VST3 and CLAP insertion, parameter
        write, independent readback, replay, failure, and cleanup.
updated: 2026-08-22
parent: README.md
prev: 4d-native-device-catalog.md
next: 4f-deep-parameters-and-remotes.md
scope: VST3 and CLAP insertion, enumeration, write, and readback
evidence: E4b, E4h, E16, E57 · D2, D8
---

# Phase 4, session 4e — VST3 and CLAP parameter proof

> **Purpose.** Prove explicit VST3 and CLAP insertion and arbitrary parameter
> control on installed plugins.

## Carry-in

The extension can insert VST3 and CLAP devices. The contract has only `clap`,
and the public `plugin` source maps every plugin id to CLAP. DirectParameter
enumerates both formats, but E4b's Stochas write did not take. That plugin result
cannot satisfy the phase write criterion.

## Scope

1. Replace the ambiguous plugin source with explicit `vst3` and `clap` contract
   variants. Keep `bitwig` and `file` unchanged.
2. Validate a VST3 class UID and a CLAP id before sending an insertion request.
3. Use installed test plugins with recorded identifiers. Prefer the paired
   Zebra3 VST3 and CLAP installations already used by E16. If either rejects
   host writes, select another installed plugin and record the reason.
4. Insert each format into an owned scratch track. Read back its chain position
   and name rather than assuming either.
5. Enumerate more than eight named DirectParameters, change one non-destructive
   parameter, verify independent readback, and restore its base value.
6. Exercise the failure path with a missing plugin id or a known non-taking
   parameter write. Report it without claiming an API limit.
7. Delete only the inserted devices and confirm the exact entry chain.

## Required boundaries

- Do not install, update, or publish a plugin.
- Do not build a machine-wide plugin inventory or checked-in plugin catalog.
- Do not use a preset load as proof of explicit VST3 or CLAP insertion.
- Do not accept enumeration alone as the write criterion.
- Treat plugin rejection of a host write as plugin-specific unless broader
  evidence proves otherwise.

## Exit criteria

1. VST3 and CLAP are distinct source types through contract, encoder, fake, and
   live handler tests.
2. One VST3 and one CLAP each insert by explicit id and mint the observed device
   position.
3. Each format exposes more than eight named parameters through DirectParameter.
4. One parameter on each format changes and restores with independent readback.
5. A missing plugin or non-taking write fails visibly and leaves no false success
   receipt.
6. Cleanup restores the exact scratch chain and no plugin state remains.
7. Focused tests, full conformance, the brain check, extension tests, context
   check, and `git diff --check` pass.

## Retrospective target

Record whether paired plugin formats gave comparable observer settlement. Keep
the result machine-specific.

## Result

The contract and public tool now use explicit `vst3` and `clap` sources. The
encoder validates a 32-hex-character VST3 class UID and a non-empty CLAP ID
before it emits a frame. The prior generic `plugin` source is removed.

The installed Zebra3 pair passed on one owned empty track. VST3 inserted at
position 0 and exposed 2,185 named DirectParameters. CLAP inserted at position
1 and exposed 2,193. `Attack Rate` changed from `0.5` to `0.55` on each format.
Independent readback agreed, and replay restored `0.5`.

VST3 insertion took 1,388 ms and its inventory settled in 1,238 ms. CLAP
insertion took 1,346 ms and its inventory settled in 1,470 ms. The paired
observer results are comparable on this machine. They are not a general
performance claim.

A valid but absent CLAP ID changed no chain state. Its receipt failed and minted
no device. Cleanup restored the exact empty scratch chain, removed the owned
track, and returned the accepted project to seven tracks.

The full brain check passes 690 tests, including typecheck. Extension tests and
the fresh 145-method handshake pass. Live conformance passes 54/54 with six
expected skips. Exact fixture cleanup and the final read-only 2k baseline pass.
The context and staged diff checks pass. E57 records the complete proof.

The live results showed comparable settlement. The process-control finding was
more actionable: a live command can outlive a completed tool wrapper. Confirm
the process exit, then run exact-ID cleanup after an interrupted suite.
