---
id: D30
kind: decision
state: active
source: e227-replay-cold-read
---

# D30 — Replay batch and start signal are named assumptions **[SETTLED 2026-10-05]**

The user accepts two named API assumptions for a replay cold read:

> 1. **Replay batch.** A cursor clip proxy that binds a clip delivers its
>    complete step replay in one delivery batch. With D27, the zero-delay task
>    that the first replay callback schedules runs after the complete replay.
> 2. **Start signal.** The `clipExists` value callback of the bound target
>    arrives in the replay batch or after it. The zero-delay task that it
>    schedules therefore runs after the complete replay, also for an empty
>    clip.

[E227](../evidence/experiments/e227-replay-cold-read.md) supports both: 160 of
160 binds from an empty park target, at 0 to 1,048,513 sounding cells and 64
to 8,192 beats. Each replay was one batch, and both tasks saw every callback. A
2 s observation after each bind found no late callback. E227 does not prove
either rule. The host does not expose batch boundaries.

## What this decision does not accept

- Native input, a target that changes during the bind, and other host
  versions are not covered. E227 used controller-issued binds.
- A bind from a populated clip is not covered. E227 bound from an empty park
  target.
- A Ghostnote write during the replay is not covered. E227 found that such a
  write can be applied after the replay and delivered after the step-delta
  confirmation. Ghostnote writes queue behind an open read (8h2b).
- A second callback for one decoded cell in the binding is not a replay. The
  read must refuse it.
- No cache or reader result becomes eligible. The 8h gates still apply.

## Consequence

With D26 and D27, a full-width 1/512 bind is a complete cold read. The read
closes at the later of the task from the first step callback and the task from
the target `clipExists` callback. An empty clip closes on the `clipExists`
task alone.

Revoke this decision if a callback of the same binding arrives after either
task, or if a closed read differs from an independent exact read.
