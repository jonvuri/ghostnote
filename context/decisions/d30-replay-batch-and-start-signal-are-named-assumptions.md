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

## E228 coverage

[E228](../evidence/experiments/e228-cold-read-dealbreaker-check.md) adds 120
matching binds from park, 48 ordered row cases at rows 0, 1, and 63, 40 reads
after executed velocity writes, and 500 qualifying soak binds. Half of the
soak binds ran with transport playing. These reads had exact close captures
and no callback after close. An additional 125 stopped soak attempts also
passed; they do not count toward the required playback set.

The reader must bind from park and select the row before pointing. A direct
bind lacks the accepted start signal. A delayed batch reply confirms scheduling,
not execution. The read must wait until scheduled writes have executed in a
prior controller task. Writes that execute during the read remain excluded.

This adds evidence for the same named assumptions. It does not prove them or
admit a product reader. E228 confirms temporary visible selection changes.
The user accepts them for modal use. Restore the full entry selection at
close under the E99 lease, then unsubscribe for release. A lost lease must
refuse restoration. This selection rule does not change the D30 assumptions.

## What this decision does not accept

- Native input, a target that changes during the bind, and other host
  versions are not covered. E227 used controller-issued binds.
- A bind from a populated clip is not covered. E227 bound from an empty park
  target.
- A Ghostnote write during the replay is not covered. E227 found that such a
  write can be applied after the replay and delivered after the step-delta
  confirmation. Ghostnote writes queue behind an open read (8h3c).
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
