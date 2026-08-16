---
id: E36
kind: evidence
state: active
source: phase-1-session-5g-repair-two-clip-properties
---

# E36 — Two-clip isolation needs track and clip pin confirmation [K] (2026-08-16)

**Verdict: E35 was a physical cursor ownership failure. Clip B held both
authored notes and both pan values, while clip A was empty. The repair pins and
confirms both the cursor track and cursor clip before it records a reusable
hold.**

## Diagnosis

`probe:5g-repair` reproduced the earlier read, clear, plain-write, and
expression-write sequence on two temporary clips. The production allocator
assigned clip A to cursor 0 and clip B to cursor 1. Live status then showed both
physical cursors on clip B. Cursor 0 was unpinned, but the adapter still cached
it as holding clip A.

The first independent read found clip A empty and clip B holding both notes.
Clip B carried pan `-0.25` on clip A's note and pan `0.5` on its own note. Thus,
E35 did not expose a stale note-property read or an E15-F property-stage loss.
The earlier clip A write had reached clip B because a stale hold suppressed the
required point.

`pointAtClip` had confirmed the target before its asynchronous pin settled. A
clip-pin confirmation alone was also insufficient. The unpinned owning
`CursorTrack` could still follow the next track selection and move the clip
handle with it.

## Repair

Each point attempt now unpins both the cursor track and cursor clip. It sends
the complete track and slot point, confirms the exact target, pins both handles,
waits, and confirms the track position, scene row, clip pin, and track pin in
one status reading. Only then can the adapter cache the hold.

A direct adapter call clears verified holds when it returns. Reuse continues
only inside `preserveSelection`, where the executor owns the complete pipeline.
This prevents an out-of-band re-point between direct calls from being hidden by
the allocator cache. Structural invalidation and the E15-F stage order are
unchanged.

The offline cursor model now includes delayed clip and track pins. It also
models an unpinned cursor following the next launcher selection. Regressions
cover two different clips after delayed pinning and a direct call after an
out-of-band re-point.

## Live result

The final focused run passed all eight checks. The writer and independent
cursor each read pan `-0.25` from clip A and `0.5` from clip B. The writer gave
the same result after both physical handles moved away and re-pointed.

Cleanup removed both temporary clips. Final readback matched all 10 durable
tracks, 10 scenes, launcher occupancy, selection at track 0 row 1, the exact
empty observation record, `Change · 4a-live-check`, and stopped transport. All
three cursor tracks and clips were unpinned on `gn-lay` row 0.

## Verification

- Focused adapter, encoder, and staging tests: 87/87.
- Full offline check: 543/543, with typecheck green.
- Extension Gradle test: pass.
- Live handshake: 134 methods / `c2aa57be11e1f47e`; deployed build fresh.
- Focused live repair probe: 8/8; exact cleanup.
- Context check and `git diff --check`: pass.

## Decision impact

D6 now requires the complete cursor track and clip pin lifecycle. A cached hold
cannot outlive a direct adapter call. Session 5g must run again in one complete
invocation; this focused proof does not complete it.

## Retrospective

Model one pool slot as a cursor-track and cursor-clip pair. Confirm both pins
before the adapter records physical ownership. No repository instruction change
is needed.
