---
id: D41
kind: decision
state: active
updated: 2026-10-08
source: phase-8h4g
---

# D41 — The writer window is the reader width, and a writer parks after each write **[SETTLED 2026-10-08]**

The write cost of a note stage scales with its distinct writer pages. Each
page needs the E46 check (about 210 ms). At 512 steps (E44), one valid edit
needed 512 checks and took 111 s, above the 60 s client timeout (E45).
[E248](../evidence/experiments/e248-writer-cursor-width.md) measured the
wider window.

## Rule

- The pool writer cursors have the reader width: `fineSteps` = 4,194,304
  (`ClipReader.WIDTH`). Every admitted clip is one writer page at every grid.
  The E46 check of each distinct page stays; there is one page for each view.
- At the end of each apply, the adapter parks each writer that the apply
  used: `cursor.setStepSize` to a 1-beat grid and `cursor.scrollToStep` to
  step 8,192 (the reader width), sent together in send order. The park sets
  its own grid, because a batch can end on a grid that the view record does
  not hold (mixed grids, review P1). A held writer then keeps no clip cells
  in the heap (E248: 176 MiB for 524,288 cells unparked; 4 MiB parked). The
  next write confirms its own page, so the park needs no settle or check.
- The width is a requirement, not a default only. `rig.json` can still set
  `fineSteps` for research, but the live adapter refuses every note write
  (`note.write`, `note.insert`, `note.remove`, `note.props`) before the
  selection borrow and any stage when the reported width is not 4,194,304,
  or when no `hello` reported it: `WriterWidthError`, tool code `unhealthy`
  (review P2). It refuses all note writes, not only long ones, so a
  configuration fault fails at once and not by clip shape. Other writes run.
  This also covers `stable-v1`, which shares the adapter. Focused tests of the
  multi-page path set `allowNarrowWriter`.
- A dense scan (`cursor.getNotes*`) of a window wider than 8,192 steps needs
  `maxX`.
- The `fine` read cursor (`noteReadSteps`, E52) and the cold reader do not
  change.

## Consequences

- The review case takes 2.3 s (add) and 1.8 s (edit); the 16,384-note
  whole-clip edit 6.6 s. The background route stays out of
  `agent-native-v1` (D39 amendment).
- A write at the reader limit holds the written clip until the park. The ZGC
  used peak of an add at 2,097,152 cells was 2,450–2,786 MiB of 3,072
  (the read alone: 2,168–2,196). The reader limit (E246) bounds it.
- Each note apply costs one more turn (about 24 ms) for the park.
