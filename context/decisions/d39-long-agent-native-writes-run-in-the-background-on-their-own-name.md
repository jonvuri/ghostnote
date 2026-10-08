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

## 8h4g amendment: the background route leaves `agent-native-v1` — 2026-10-08

[E247](../evidence/experiments/e247-performance-review-and-closeout.md) and
[E248](../evidence/experiments/e248-writer-cursor-width.md) bring the worst
case under the 30 s budget, with verification:

- The write cost scales with distinct writer pages (about 210 ms for each
  page check), not with the note count. At 512 steps one valid edit needed
  512 pages: 111 s. [D41](d41-the-writer-window-is-the-reader-width.md) sets
  the writer window to the reader width, so every admitted clip is one page.
  That edit now takes 1.8 s. **The removal depends on D41.**
- A whole-clip edit of 16,384 notes at the reader limit takes 6.6 s
  (E246: 48.0 s). The write check before the batch confirms each writer view
  once; the planner takes about 1.2 s (E246: 12.0 s).
- `add_launcher_clip` of 16,384 notes takes 6.4 s.
- What remains scales with the property stages (one for each channel with
  nondefault expression), the notes (the planner), and the capture (bounded
  by the reader limit). The margin to the 60 s MCP client timeout (E45) is
  more than 50 s.

The route had a cost for each agent: the agent had to choose the flag, poll
`inspect_operation`, and read a second result envelope. With the worst case
far under the timeout, the cost has no benefit. The rule changes:

- `edit_launcher_clip` and `add_launcher_clip` have no `background` input in
  `agent-native-v1`. A call with `background` fails input validation.
- `inspect_operation` and `cancel_operation` leave `agent-native-v1`
  (39 tools). Tool descriptions are at v33.
- `stable-v1` keeps its clip music operations unchanged (the rollback
  through 8i).
- The operation registry stays in the workspace for the `stable-v1`
  operations.

The no-generic-start rule stays: a later long write gets a flag on its own
tool name. The staged composition of four layer chains (30.5 s, E247) is the
longest direct call; it never had a background route.
