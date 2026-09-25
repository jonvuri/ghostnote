---
title: E136 — Runtime and surface cleanup establishes lean profiles
kind: evidence
state: active
updated: 2026-09-25
parent: ../../plan/phase-8/8b-runtime-and-surface-cleanup.md
---

# E136 — Runtime and surface cleanup establishes lean profiles

## Verdict

Session 8b replaced one 157-method runtime with three explicit active profiles.
The normal runtime has 85 product methods. It does not register probe or audio
capture methods. The capture runtime adds five recorder and transport methods.
The probe runtime adds the four Phase 8 cache and API methods and D13's six
banned regression methods. The 57 historical methods remain in source and in a
separate historical inventory. No active profile registers them.

Each archive embeds its profile identity. `contract.hello`, `rig.info`,
`rig.stats`, and `rig.methods` report that identity. A client can require the
exact profile and method hash. The three archives replace one configured
controller file and use the same controller ID. This avoids duplicate controller
registrations.

## Method ownership

| Profile | Identity | Methods | Hash | Owner |
|---|---|---:|---|---|
| Normal | `normal-v1` | 85 | `bba7383dce25c0f0` | Product core, reads, writes, observation compatibility, and navigation |
| Capture | `capture-v1` | 90 | `677718209312bd96` | Normal product plus five Phase 7e capture methods |
| Probe | `phase-8-probe-v1` | 95 | `226dd8c1467c7c3b` | Normal product plus four Phase 8 methods and six D13 methods |
| Historical source | Not deployable | 157 | `905bc2531512025b` | Source and evidence navigation only |

`RuntimeProfile` owns the complete classification. Extension initialization
fails if a source registration is missing from the classification or if the
classification names no source registration. The active goldens are generated
from that classification. The historical golden is not a deployable profile.

The probe-only Phase 8 methods are `api.runtimeMethods` and the three
`stepdata.observer.*` methods. E130, E131, and E134 own them through 8g. The
probe-only D13 methods are `app.actions`, `app.invokeAction`, `app.undo`,
`app.redo`, `app.undoState`, and `branch.groupTrack`. They remain unreachable
from every product encoder. `ui.signalFire` remains absent from all profiles.

The npm command list no longer advertises 120 source probes or one compound
command that call one of the 57 historical methods. Their source files remain
beside the active probes, with an
[archive note](../../../brain/src/probes/HISTORICAL_WIRE_PROBES.md), so existing
evidence links stay valid.

## Host-object ownership

| Object family | Active owner and disposition |
|---|---|
| Application, project, track bank, scene bank, tracks, and launcher slots | Product core, addressing, selection, revision, track, scene, and slot methods |
| Pool cursor tracks and clips, fine cursor, note-observer cursor, and note observer | Product clip and complete E131 note routes |
| Device cursor, device banks, layer and drum-pad banks, parameter handles, Remote Controls, and DirectParameter observers | Product device, chain, parameter, and control routes |
| Device-position equality values | Product target-settlement guard; 32 values remain |
| Layer mixer, colour, and send handles | Product `layer.list` state used by chain reads |
| Observation settings and status controls | Product observation compatibility and status surface |
| Transport | Product `cursor.playState` and `slot.playState` clock; capture adds control methods |
| MasterRecorder | Capture profile only |
| Follower clip, arranger clip, and step-data observer | Probe profile only; owned by E130, E131, and E134 |
| Undo flags and group flags | Probe profile only; owned by D13 regressions |
| Notification settings, bare cursor pair, track mixer and send handles, VU observers, layer selection observers, action handles, cursor layer, chain selector, and the track and clip equality matrix | Historical only; no active runtime allocation |

The normal runtime reports 33,891 explicitly counted host proxies and 838
observer callbacks at the default 256-track, 128-scene configuration. Source
accounting gives the old runtime 37,563 explicit proxies. Session 8b removed
3,672, or 9.8%. The removed set includes 2,112 equality values, 1,280 track-send
objects, 272 action handles, and eight other historical or optional objects.

The old runtime had 1,103 source-counted observer callbacks. Normal now has 838.
The 265 removed callbacks are 256 track VU observers, eight layer-selection
observers, and one step-data observer. The probe reports 839 because it keeps
the step-data observer. These counts exclude host-internal objects that one API
proxy can create.

## Live measurements

The pre-change live baseline used the same default configuration. Five heap
samples were 494 MB. Construction was 160,635 microseconds and initialization
was 198,295 microseconds. The live wire had 157 methods and hash
`905bc2531512025b`.

| Runtime | Construction | Initialization | Five whole-JVM heap samples | Explicit proxies | Callbacks |
|---|---:|---:|---|---:|---:|
| Old shared runtime | 160,635 µs | 198,295 µs | 494, 494, 494, 494, 494 MB | 37,563, source-derived | 1,103, source-derived |
| Normal | 30,161 µs | 45,945 µs | 516, 516, 516, 516, 516 MB | 33,891 | 838 |
| Probe | 35,145 µs | 49,880 µs | 548, 552, 554, 558, 562 MB | 33,893 | 839 |

Normal construction fell by 81.2%. Normal initialization fell by 76.8%. The
final normal heap samples came after repeated normal and probe profile reloads
in the same Bitwig JVM. They were 22 MB above the entry baseline and below the
probe samples. Whole-JVM heap is a trend signal, not an extension allocation
measurement. The object and callback counts are the stable comparison.

Both live handshakes matched their exact goldens. The probe boundary also
enumerated 781 named actions without invoking one, read undo state without a
write, inspected ten API proxy families, and completed a stable empty step-data
snapshot. No named action, undo, redo, or group operation ran. The open project
remained at five listed tracks and eight scenes. The final normal runtime also
returned complete `cursor.playState` and `slot.playState` replies from its
product-owned transport clock.

## Surface result

The public description cohort is `ghostnote-description-v24`. The
`delete_clip` description now states that reversal restores notes, length, name,
colour, loop properties, and launch settings. It states that separate play or
stop activity and automation are not restored. The related `revert_change`
description now states the same boundary. Runtime behavior did not change.

`layer.list` no longer reports historical selection and cursor-layer probe
fields. Product chain, mixer, colour, send, and device fields remain.
`observation.read` and `observation.replace` remain in the normal runtime for
automatic capture and stored-record compatibility.

## Verification

- `./gradlew test jar captureJar probeJar`: passed; all archives contain their
  exact profile resource.
- `npm run wire:golden`: 157 historical declarations and all three active
  goldens matched.
- `npm run check`: passed.
- `npm run probe:hello`: normal and probe live handshakes passed.
- `npm run probe:phase8b-boundary`: all read-only probe-boundary checks passed.
- `ruby context/check.rb`: passed with intact links.
- `git diff --check`: passed.

## Retrospective

The controller keeps its configured definition class when an alternate archive
is deployed. A manifest-only profile selector therefore did not work. Embed the
profile identity in each archive and let the configured definition read it.
Future alternate builds must test the live identity before they run a probe.
