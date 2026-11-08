---
title: E412 — P01 set_device_controls limits with one-turn routes, live
kind: evidence
updated: 2026-11-07
owner: P01
---

# E412 — P01 set_device_controls limits with one-turn routes, live

**Positive.** With [E411](e411-p01-one-turn-scalar-cohorts-live.md)'s
one-turn routes, a u-he Diva route (CLAP, 281 DirectParameters) costs about
2.3 s however many settings it has. One route of 64 settings and one of all
281 each took 2.37–2.38 s. Cost grows only with the route count: 4 routes
of 16 settings took 9.1 s (E252: 22.5 s), 8 took 18.3 s, 12 took 26.8 s and
16 took 36.4 s. Every call verified, and the independent readback of every
route found every requested value and every unrequested parameter as
expected. [D69](../../decisions/d69-device-control-limits-follow-routes.md)
sets the limits to 12 routes and 256 settings.

## Session

Bitwig 6.1.4 / API 25, project `gn-scale-test` with the audio engine on;
the operator checked that Diva loads and stopped the transport
([operator record](../data/p01-scalar-limits-live/operator.json)).
`probe:hello` passed with the normal build already loaded (`normal-v1`, 94
methods, `526cd7e3760580cc`, fresh initialization, B18 marker). The brain is
E411's change.

The [driver](../../../brain/src/probes/p01-scalar-limits-live.ts) refuses
another probe driver or bridge client and checks the project and scratch
identity before every write. It owns one scratch track, adds Diva instances
four at a time, and calls `set_device_controls` through the tool's own spec
and input validation with only the two limit checks removed; no tool input
reaches that copy. Each setting writes an endpoint (0 or 1), because some
Diva switches report no discrete domain (E252). After each call the driver
reads every route back with `read_device_controls` and compares all 281
parameters of each. It reverts one setting, deletes the track, and compares
the track list, every original track's `read_devices` structure and the
selection with the baseline. All passed.

## Results

| Case | Settings | ms / wire calls |
|---|---:|---:|
| 4 Diva routes × 16 (the previous limit) | 64 | 9,124 / 191 |
| `revert_change` of one setting | 1 | 2,762 / 61 |
| 8 routes × 16 | 128 | 18,272 / 379 |
| 12 routes × 16 | 192 | 26,787 / 567 |
| 16 routes × 16 | 256 | 36,403 / 755 |
| 1 route × 64 | 64 | 2,378 / 50 |
| 1 route × every continuous control | 281 | 2,370 / 50 |

[Summary](../data/p01-scalar-limits-live/summary.json) from
[summarize.py](../data/p01-scalar-limits-live/summarize.py); the run
directory keeps every wire call.

A Diva route is 2.27–2.28 s at every route count. In the 281-setting call,
the bank read took 0.24 s, the preflight inventory 0.97 s and the readback
0.8 s; each inventory includes two empty-slot descents into Diva (about
0.4 s, E252's bounded descent) and Bitwig's parameter settle. The descent
moves the device cursor, so the write re-points it (about 0.2 s) instead of
reusing the held target. The one `batch.run` with 281 frames took 27 ms.
Single `read_device_controls` calls on Diva took 0.26–1.95 s.

## Interpretation and limits

- Settings no longer add measurable cost; routes do. Under D44's 30 s plan
  budget the route limit is 12 (26.8 s); 16 routes exceed it.
- A plug-in with more DirectParameters than Diva costs more per route, as
  E252 recorded; Ghostnote cannot know the count before it reads.
- Possible later reductions: skip the empty-slot descent in the parameter
  inventories of a top-level control route, if its reads do not need the
  slot structure, and keep the held target across it. Neither is checked
  here.
- One run on one fixture. The 1-route rows and the per-route rate across
  four route counts agree within 0.01 s.
