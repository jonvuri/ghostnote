---
title: E317 — Update audit offline preparation
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E317 — Update audit offline preparation

## Result and scope

Section 2A of the [update audit](../../plan/phase-9/9b-update-audit.md) is
implemented offline. The [driver guide](../../plan/phase-9/9b-update-audit-driver.md)
maps every required row to a case or operator checkpoint. The normal product
has not been tested on 6.1.x. The operator has not reported the section 1
handoff. There was no bridge connection, deployment, installed-jar scan,
project write, or change to the backup sources in this session.

The driver has explicit preflight, run, inspect, cleanup, and persistence
phases. It records owned channel identities, independent state, full wire
calls, and tool costs. It uses a new adapter and workspace for each command.
It does not reuse a document reference or change ID across commands. A
failure or interruption blocks another case. Inspection is read-only.
Cleanup requires the inspected state and proved ownership. An uncertain
write keeps its intent and blocks deletion pending a reviewed recovery.

The cases use the current normal product dispatch. They cover sparse and
desired note edits, two MIDI channels, expressive notes, non-quarter-grid
timing, loop state, copy/move/delete, raw mixer readback, two native instances,
an installed plug-in, and nested device structure. The sentinel and entry
state are compared after each case. Operator checkpoints cover selection,
a collapsed group, a second audit project, save/reopen, and listening.

## Sampler evidence preparation

The [preparation directory](../data/bitwig-upgrade-audit/preparation/state.json)
contains copied single-sample and multisample one-LFO fixtures. Their source
hashes and metadata are in the
[single-sample inventory](../data/bitwig-upgrade-audit/preparation/donor-single.json)
and [multisample inventory](../data/bitwig-upgrade-audit/preparation/donor-multi.json).
The [retained catalog scan](../data/bitwig-upgrade-audit/preparation/retained-sampler-catalog.json)
records all seven repository Sampler presets and the named composition targets.
No donor source or catalog was changed.

The selected donors expose the attack mapping. They do not expose Play Mode,
Freeze Playhead, or Envelope Mode in their decoded route inventories. This
is a source observation only. It does not prove host migration or absence
from the live parameter inventory. The
[6.1 release notes](https://downloads.bitwig.com/6.1/Release-Notes-6.1.html)
state that modulation and automation of those three targets are disregarded.
The exact patch notes and the live verdict remain section 2B work.

After each supported attack edit, the driver pauses without polling. The
operator saves the inserted Sampler to a new working path. The driver reads
that host export and requires the original routes, their ranges, the new
attack amount, and the same sample resource references. It records operator
zone and resource observations, then performs the supported reversal in the
same server session. A loader reply cannot satisfy these checks.

The later save/reopen result compares complete observable content and the
saved-file hash. Separate operator observations cover sample zones, retained
mappings, the three removed targets, and the short listening check. Missing
required evidence cannot produce a complete matrix verdict.

## Verification

- [Required brain gate](../data/bitwig-upgrade-audit/offline/brain-check.txt):
  `GHOSTNOTE_REQUIRE_ORACLE=1 npm run check`. Typecheck and all 2,436 tests
  pass, with zero failures and zero skips.
- [Focused driver tests](../data/bitwig-upgrade-audit/offline/driver-tests.txt):
  18 pass. The tests exercise current product recipes on the fake host,
  refusal before writes, stale ownership, interruption, evidence bounds,
  preserved-state cleanup, and host-export route validation.
- [Extension build](../data/bitwig-upgrade-audit/offline/extension-build.txt):
  `./gradlew build` passes, including the host proxy tests and archive
  registration checks. No deploy task ran.
- [Normal archive identity](../data/bitwig-upgrade-audit/offline/archive.json):
  normal-v1, 846,149 bytes, SHA-256
  `25a5be4398f8825a7eabd2a541e49559ed60002f2d8d6b9db795f45664e4d9d2`.
  Registration is `GhostnoteExtensionDefinition`. This is the built archive,
  not a verified deployment.
- Context link validation and `git diff --check` pass.

The [initial full gate](../data/bitwig-upgrade-audit/offline/brain-check-initial.txt)
failed one existing marker test. It searched for a removed `MARKER` constant
in `GridSurveyHandlers` and required an old survey driver to use the newest
marker. The test now checks the delegated handler chain and current V20
doctor pin. The runtime handlers and old survey pin did not change. The
hello API check still requires 25; its label now names the compiled API
rather than identifying that API exclusively with Bitwig 6.0.6.

## Cost and limits

The [driver model](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#9b-update-audit-driver-model-before-implementation)
bounds host work and evidence. The driver adds no product path and changes
no product call budget. It admits eight owned instrument tracks, eight scene
rows, 256 notes per clip, four composition device units, and 16 controls per
call. Each command has a 6,000-call limit and 15-minute active deadline;
each request has a 60-second deadline. Evidence is capped at 64 MiB with a
2 MiB failure reserve. Operator waits have no host calls. The retained fixture
uses six tracks and four notes per clip.

Live calls and host measurements in this session: **zero**. Section 2B must
measure representative per-call costs and compare equal workloads with the
existing ledger. Offline test times do not establish host performance or
upgrade compatibility. Public descriptions remain v52. The old Grid cache,
attempt records, deployed profile, and research control were not touched.

## Handoff and lesson

Continue with section 2B after the operator reports the backup paths,
successful 6.0.6 recovery check, exact new version, missing-asset result,
and stopped audit project. Use the prepared normal archive and operator
controller replacement procedure. Section 3 records general acceptance
before the separate 9b.6 doctor.

Two checks prevented unsafe assumptions. A moved clip cannot use its original
copy change ID for reversal; the case now reads and deletes the owned copy.
Marker tests must follow the runtime marker source after a delegation change.
The focused tests retain both lessons. No new repository rule is needed.
