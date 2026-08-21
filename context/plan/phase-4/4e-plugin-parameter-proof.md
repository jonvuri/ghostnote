---
title: Phase 4, session 4e — VST3 and CLAP parameter proof
kind: plan
state: planned
status: Planned after 4c. Separate plugin source types and prove both formats
        through the general parameter path.
updated: 2026-08-21
parent: README.md
prev: 4d-native-device-catalog.md
next: 4f-deep-parameters-and-remotes.md
scope: VST3 and CLAP insertion, enumeration, write, and readback
evidence: E4b, E4h, E16 · D2, D8
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
