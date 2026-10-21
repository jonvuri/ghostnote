---
title: E318 — Update audit 6.1.4 deployment
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E318 — Update audit 6.1.4 deployment

## Result

The operator completed the section 1 handoff for the
[update audit](../../plan/phase-9/9b-update-audit.md). The normal archive is
deployed. Controller replacement and live compatibility checks are pending.
No bridge call or project write occurred in this deployment session.

The [operator record](../data/bitwig-upgrade-audit/handoff-614/operator-handoff.json)
gives the planned backup and working paths. The copied 6.0.6 app launch and
manual recovery check passed. The operator reports no assets in
`gn-grid-spike` or `gn-scale-test`, and no known missing assets elsewhere.
Other projects were not checked exhaustively. This does not prove complete
saved-file or native graph equality. The operator reports 6.1.4 open to
`gn-upgrade-audit`, with playback stopped.

## Installation and deployment

The [identity record](../data/bitwig-upgrade-audit/handoff-614/deployment.json)
confirms `/Applications/Bitwig Studio.app` reports 6.1.4. Its jar is
35,778,607 bytes, SHA-256
`5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`.
The [process record](../data/bitwig-upgrade-audit/handoff-614/processes.json)
shows PID 69259 from that app owns port 8686. No established bridge
connection is present. No process was stopped. Diva CLAP is present at
`/Library/Audio/Plug-Ins/CLAP/u-he/Diva.clap`.

[`./gradlew copyExtension`](../data/bitwig-upgrade-audit/offline/deployment-614.txt)
passed. The built and deployed archives are equal: 846,149 bytes, SHA-256
`25a5be4398f8825a7eabd2a541e49559ed60002f2d8d6b9db795f45664e4d9d2`.
E317 records the normal registration and full build checks. The expected
contract is normal-v1, 92 methods, hash `8be1975eaa99d78f`.
This expectation is not a live result. The host API and fresh initialization
must be checked after operator replacement.

## Patch notes and acceptance implications

The exact [6.1.4 release notes](https://www.bitwig.com/dl/Bitwig%20Studio/6.1.4/release_notes/)
were read through the official indexed copy. The direct download endpoint
did not load through the browser tool. Version 6.1.4 adds rekordbox library
integration. The cumulative notes also record Sampler filter and sliced
onset persistence fixes in 6.1.3; loop playback and sample replacement fixes
in 6.1.2; and parameter import, saved quality, repeated notes, and Undo fixes
in 6.1.1. Version 6.1.1 removes remote controls and modulation routes for
retired parameters, including Play Mode, Envelope Mode, and Freeze Playhead.
The 6.1 base notes say their set values load, but modulation and automation
are disregarded. Thus the audit must record host migration or absence for
these targets. A loaded preset alone cannot prove preserved modulation.

## Driver correction and verification

The process check found idle Ghostnote MCP servers. The original guard would
refuse these servers even though none had a bridge connection. The guard
now refuses another probe driver or any established connection to port 8686.
It records candidate processes and the socket inventory before connecting.
Idle MCP servers can remain. The check does not lock other clients; no other
client can be started during a driver command. No process is stopped.

The [focused tests](../data/bitwig-upgrade-audit/handoff-614/driver-tests.txt)
pass all 20 cases. They include idle servers, the current process ancestry,
another probe, unknown connected clients, and absent socket inventory.
[Typecheck](../data/bitwig-upgrade-audit/handoff-614/typecheck.txt) passes.
The [context link check](../data/bitwig-upgrade-audit/handoff-614/context-check.txt)
and staged and unstaged diff checks pass.
This correction adds one local socket inventory command at entry. It adds
no host call, product operation, or poll. Product budgets and descriptions
remain unchanged at v52. Host performance measurements remain section 2B work.

The entry check must distinguish idle services from active bridge clients.
The focused tests and driver guide now retain this distinction. No new
repository rule is needed.
