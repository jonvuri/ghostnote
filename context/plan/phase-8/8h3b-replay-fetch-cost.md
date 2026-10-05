---
title: Phase 8h3b — Replay fetch cost
kind: plan
state: planned
status: Planned. Measure where the replay note fetch spends its time, and select a fetch format for the product reader.
updated: 2026-10-05
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h3a-cold-read-dealbreaker-check.md
next: 8h3c-cold-reader-promotion.md
evidence: E227; D30
---

# Phase 8h3b — Replay fetch cost

## Why

A replay cold read completes in the host in 46–698 ms
([E227](../../evidence/experiments/e227-replay-cold-read.md)). The brain then
fetches the decoded notes over the bridge. On dense clips the fetch can be as
slow as the read:

| Fixture | Notes | Bridge | Pages | Fetch |
|---|---:|---:|---:|---:|
| `n4096-64` | 4,096 | 211 KiB | 1 | 40 ms |
| `n16384-512` | 16,384 | 872 KiB | 1 | 70 ms |
| `n131072-2048` | 131,072 | 6.7 MiB | 8 | 379 ms |

The research fetch (`replayNotes`) sends JSON rows of about 53 bytes for each
note, in pages of 16,384 rows. Each page is one bridge request. The cost of
extension encoding, the wire, and brain parsing is not separated.

The fix must be in place before
[8h3c](8h3c-cold-reader-promotion.md) moves the reader to the product path,
so that the wire format and its goldens change only once.

## Entry

Run after [8h3a](8h3a-cold-read-dealbreaker-check.md) has no open
dealbreaker. Start from the 8h2a research build and the E227 fixtures
`n16384-512`, `n131072-2048`, and `sustain-2048`. Use an owned project, never
`gn-scale-test` (D29). Follow the reload procedure in `AGENTS.md`.

## Work, in order

### 1. Break down the current cost

For each fixture, measure at least 10 fetches. Record for each page:

- extension encode time (`encodeMs`), and the controller-thread time of the
  request;
- bytes on the wire and the transport frame count;
- the brain time from send to receipt, and the parse time; and
- the time between pages.

Name the largest cost. Check whether a page blocks the controller thread long
enough to delay other bridge requests; record ping during the fetch.

### 2. Try the candidate fixes

Try each fix that is a small change, alone, on the same fixtures:

1. **Page size.** One page for the whole read, and pages of 65,536 rows.
2. **Columnar encoding.** One array for each field, not one object for each
   row. Omit a field that has its default value on every note.
3. **Compact encoding.** Integer arrays, or a packed binary block in the JSON
   frame, if the transport accepts it without a format change.
4. **Encode off the controller thread.** Copy the decoded notes in the close
   task, then encode them on another thread. Use this only if the decoded
   state cannot change after the close.

Check each against the exact decode of E227: every field of every note must
match.

### 3. Select the product format

Select one fetch format by measured total time (read plus fetch), the
controller-thread block, and code size. Record the reason. The product reader
in 8h3c uses this format. Write the wire goldens in 8h3c, not here.

## Acceptance criteria

- The fetch cost of each fixture is broken down into encode, wire, receipt,
  and parse, with ping during the fetch.
- Each candidate fix that ran has paired times and an exact decode.
- One format is selected with its measured reason, for use in 8h3c.
- Research results keep `complete:false` and `eligible:false`. Owned projects
  are closed without saving. The original rig config and the normal archive
  are restored, with a fresh normal hello.
- Brain check, extension check, wire goldens, context check, and
  `git diff --check` pass.

## Out of scope

- Product migration of the reader (8h3c).
- Changes to the stable bridge transport for other methods.
