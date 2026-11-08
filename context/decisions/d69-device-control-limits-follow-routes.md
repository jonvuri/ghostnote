---
id: D69
kind: decision
state: active
updated: 2026-11-07
source: P01
---

# D69 — Device-control limits follow routes

## Source and scope

[D44](d44-long-writes-are-optimized-then-bounded.md) limited
`set_device_controls` to 64 settings on 4 device routes when each setting
had its own write turn and readback (E252: 4 Diva routes of 16 settings took
22.5 s). [E411](../evidence/experiments/e411-p01-one-turn-scalar-cohorts-live.md)
writes each route in one turn with one readback, as
[D65](d65-proved-routes-run-with-one-readback.md) rule 5 asks, and
[E412](../evidence/experiments/e412-p01-device-control-limits-live.md)
measures the limits again. The user asked for the remeasurement on
2026-11-07. This decision replaces D44's `set_device_controls` row; D44's
rule and its other rows are unchanged.

## Rule

`set_device_controls` admits at most **256 settings** on at most **12
device routes** in one call. A larger request refuses before any read or
write with `outside-limit` and the limit in detail; the tool description and
the `settings` schema text state both limits.

## Why

- A route is one write turn between two complete inventories, so its cost
  no longer grows with its settings: one Diva route took 2.4 s for 64 or for
  all 281 settings. A native route takes about 1.3 s (E411).
- Routes set the cost. With Diva, 12 routes took 26.8 s and 16 took 36.4 s,
  so 12 is the largest route count under D44's 30 s plan budget. Twelve
  native routes are about 16 s.
- 256 settings were written and verified (16 routes of 16), and 281 in one
  route; settings add no measured cost. The setting limit bounds the input
  size, not the time.
- A plug-in with more DirectParameters than Diva costs more per route
  (E252); this stays the unbounded dimension that the route limit cannot
  see before the read.
