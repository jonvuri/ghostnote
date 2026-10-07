---
id: D39
kind: decision
state: active
updated: 2026-10-08
source: phase-8h4d
---

# D39 — Long agent-native writes run in the background on their own name **[SETTLED 2026-10-08]**

The 8h4d plan keeps an asynchronous route when a worst-case edit does not
finish in at most 30 s, end to end, with verification. E246 measured a
whole-clip edit of 16,384 notes at the reader limit at 48.0 s. E45 measured a
60 s MCP client timeout, after which the brain continued to mutate the project
(E47). The three clip music operation tools of `stable-v1` start only the v1
musical planner, which `agent-native-v1` retires.

## Rule

- In `agent-native-v1`, a long write takes `background: true` on its own tool:
  `edit_launcher_clip` and `add_launcher_clip`. The call returns an operation
  handle at once (`ghostnote-operation/1`). The operation runs the same tool
  body through the cancellable workspace and records each change that it
  makes.
- One generic handle reads and cancels any such operation:
  `inspect_operation` (read) and `cancel_operation` (write). A completed
  operation carries the result of the direct call. A terminal state means that
  the operation makes no later project change.
- There is no generic start tool. The tool name is the permission grain (D20,
  E20c): a `start_operation` that names another tool would carry one blanket
  grant for every write that it can start.
- `agent-native-v1` does not list `start_clip_music_operation`,
  `inspect_clip_music_operation`, or `cancel_clip_music_operation`.
  `stable-v1` keeps them unchanged.

## Why

48.0 s is under the measured 60 s timeout but above the 30 s budget of the
plan, and Ghostnote does not set the client timeout. A flag on the tool keeps
the permission on the tool name and keeps one result shape for the direct and
the background call. The operation registry and the cooperative cancellation
already exist (session 2j, E48).

## Consequences

- A background call does not publish a product status: the status publication
  runs on the direct dispatch path only.
- Operations live in the server process only, like base refs. A restart loses
  them; the change records stay in the session stash.
- 8h4g tries to bring the worst case under 30 s, then decides whether to
  remove the route. The 60 s client timeout is the real ceiling, so removal
  is possible also above 30 s with a clear margin to 60 s.
