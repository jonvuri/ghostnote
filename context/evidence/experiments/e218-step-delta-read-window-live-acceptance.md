---
title: E218 — Step-delta read window live acceptance
kind: evidence
state: active
updated: 2026-10-03
parent: ../../plan/phase-8/8g2b-step-delta-read-window.md
---

# E218 — Step-delta read window live acceptance

## Result

The 8g2b step-delta read window passes live acceptance in the measured scope.
In 147 guarded trials across eight arms, no published, retained, compared, or
exact output contained Q content. Every published set equals the independent
settled exact authority read after return to P. Every admitted comparison has
a confirmed window. Slot inventory refuses because it is outside step coverage.
All results stay `complete:false` and `eligible:false`. D26 and the
[E217 ordering rule](e217-later-callback-ordering-rule.md) remain named
assumptions. This is not a host input fence.

| Arm | Trials | Published | Refused | Foreign | Differs from authority |
|---|---|---|---|---|---|
| Control, no detour | 3 | 3 confirmed matches | 0 | 0 | 0 |
| Same-callback, random op, run 1 | 30 | 13 | 17 | 0 | 0 |
| Same-callback, random op, run 2 | 30 | 18 | 12 | 0 | 0 |
| Separate-callback, 0/20/100 ms dwell | 15 | 1 | 14 | 0 | 0 |
| Exact, random op, runs 1–2 | 24 | 11 | 13 | 0 | 0 |
| Same-callback at an open read window | 20 | 0 | 20 | 0 | 0 |
| Exact at an open read window | 12 | 6 | 6 | 0 | 0 |
| Native tab switches, run 2 | 13 | 12 | 1 | 0 | 0 |

## What the arms show

**Open read windows.** The window arm fired the detour when the last operation
reported comparison reads or a pending confirmation. 13 of the 20 detours were
unseen by value observers: no Q project name arrived. The step window refused
all 13 (`step-window-changed`). The 7 seen detours refused through the resident
callback count (`window-changed`). Identity equality admitted nothing.

**Exact route.** At the scanning stage, the identity guard or the window
refused. At the confirming stage, the 6 unseen detours published P content. The
confirmation had already been scheduled when the detour command ran, and the
host delivers a project switch about 23 ms after its command. Each published
set equals the independent authority. After the detour, every retained exact
output refused (`authority-window-changed`).

**Random injection.** With stage attribution (run 2), unseen detours that still
published landed in binding or settling stages, before any read window opened.
Replay settlement absorbed their deltas. In the same-callback and
separate-callback arms, a detour after the route discarded the retained
snapshot in 20 of 20 cases. One unseen detour during reconciliation
gave `step-window-changed`. Refusal reasons across the random arms are
`window-changed` 23, `identity-window-changed` 18, `automatic-identity-invalidated`
13, and `step-window-changed` 2.

**Native input.** The user switched P→Q→P with the project tabs during a
three-minute loop. One acquisition overlapped a delivered switch and refused.
Other switches landed during an independent read, which refused and waited for
a settled P. Native overlap coverage is thin. Native run 1 stopped by rule
on its first trial: a switch landed inside the independent read. Its own
comparison published P content. The driver now waits for P to stay shown for
3 s before the independent read. That run is a retained diagnostic.

## Implementation under test

Build markers: shadow `8g2b-shadow-step-delta-v1`, root `8g2b-root-step-delta-v1`,
and delivery `e217-callback-ordering-v2`. Config: two shadow observers,
2,048-cell coverage, lifecycle research, and delivery research. See the
[protocol](../format/PHASE8G_PROJECT_CONTINUITY.md#8g2b-step-delta-read-window).

## Method

The [driver](../../../brain/src/probes/e218-step-delta-acceptance.ts) uses the
E216 fixtures. P is `New 8` with a P witness clip at track 0, slots 0 and 1.
Q is `New 9`. Each trial runs a guarded `acquire` with the slot-1 canary, then a
comparison and a status read. Exact arms run `exactStart` instead. A
`deliveryRun` detour fires after a chosen operation. After the detour and a
1.5 s settle, the driver confirms that P is shown. It then reads retained
output again and performs an independent exact read. The arm stops on an
endpoint other than P, a failed authority read, or any foreign or differing
output. No automated arm stopped.

The [analyzer](../../../brain/src/probes/e218-step-delta-acceptance-lib.ts)
treats any pitch-72 note as foreign. It compares each published set with the
independent read by channel, cell, and pitch. Same-callback run 1 and exact
run 1 have no stage attribution. Their refusal labels were recomputed after the
run with the corrected analyzer, which prefers the terminal comparison over a
generic status reason. Each report records this.

## Limits

The independent authority is the same extension through its exact route after
settlement. It is not external to the controller. One witness clip per project
is measured. Controller-issued project actions drive all arms except native.
Slot inventory, coordinates outside coverage, and unsubscribed observers refuse.
Any step or rebind in any shadow observer discards retained output and refuses
open windows; budget effects under load belong to 8g3.

## Artifacts

[Retained reports](../data/e218-step-delta-acceptance/). Brain tests verify the
analyzer and every retained report.

| File | SHA-256 |
|---|---|
| `config-research.json` | `5a7b34d1c86fb68b2f74c899938f85b2ba4627fa8fe0fe9e28f185d4c6cec54f` |
| `fixture-state.json` | `374dd982af134701fe009a0ebfa5111ffd7fa8badc9078c0db1df1b1339fa40a` |
| `control.json` | `22cab18a1fa308dc34d36852891286c1972125e6850f8efeaee727b1bcb71693` |
| `same-callback-1.json` | `c85997161841da5bfc28e1425a1c2fa0ae01fbc622673eb1d33f2dc5e6bf059b` |
| `same-callback-2.json` | `5910efef0a6c0f699d11ec1170cdfde611256936781c7596b54458ff8b1e23e0` |
| `separate-callback.json` | `6f6ff8450b6e63a45f9d6634bc0cbcc6d4c26cd9b2742ec3a020d91fb68c8e07` |
| `exact-1.json` | `4e000a14831e960493196b6b80a4d3a736e444199da87afd30767c8d45625f73` |
| `exact-2.json` | `cb28ded5f188279d5986a44069f697166b6248eba2a44cfd5f3b3a60e2391018` |
| `window-same-callback.json` | `cd9855244dd2dbc181a127417bae8fc7d737445ca37280a736769d1e4427ab86` |
| `window-exact.json` | `dd1dbee8fb988a5f01798113592c8ed9f8185978d6f997ef1a0db5857fc32823` |
| `native-1-diagnostic.json` | `6fdf5727cf786e8b28b0e8ea785c8e5512aff4e7b92eb7bcd1431d20a21dc205` |
| `native-2.json` | `36a36f373e84284cca37991e476e7624f143bb30001f6504bd572abb845d6094` |
