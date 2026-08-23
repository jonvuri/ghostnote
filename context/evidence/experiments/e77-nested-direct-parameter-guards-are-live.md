---
id: E77
kind: evidence
state: active
source: dogfooding-d02-session-2
---

# E77 — Nested DirectParameter guards are live [K] (2026-08-23)

**Verdict: guarded DirectParameter writes now work at depth 1, depth 2, and in
a Drum Machine pad. Each write keeps the complete top-level fingerprint and a
separate nested-route guard.**

## Guard correction

The old wire guard used the final device position and name as an index into the
top-level device list. A nested device at local position 0 therefore caused
`expectedDeviceName disagrees with expectedDeviceNames[0]` when top-level
position 0 held its container.

The corrected guard has three separate parts:

- The root guard checks the durable track, complete top-level name and enabled
  sequences, and the root container position and name.
- The route guard records each named entry, drum-pad channel, and local device
  position selected for the serialized device cursor.
- The target guard checks the final local position, name, and nested state.

A named descent also checks the live layer name before it selects the nested
device. The write handler compares the recorded route with the requested route
immediately before it changes the value. A nested position cannot alias a
top-level position with the same number.

## Offline proof

Fake, encoder, extension-source, live-adapter, and public-surface regressions
cover top-level, depth-1, depth-2, and drum-pad targets. Negative cases cover a
changed top-level chain, a changed named route, a wrong final device, and changed
pad content.

The public `set_parameter` regression changes and reverses three scalar values
through the complete tool path. The focused cohort passes 306/306. The full
brain check passes 850/850. Extension tests pass.

## Live proof

The deployed extension reloaded fresh in project `New 2`. The 148-method
handshake passed with hash `eb3391803ef4eea4`.

The focused live probe created one owned scratch track. It tested native
Polysynth at depth 1, depth 2, and Drum Machine channel 3. Each target exposed
55 named DirectParameters. `OSC1 Pulse Width` moved from
`0.5000000000000001` to `0.5500000000000002`. Independent readback agreed, and
exact replay restored `0.5000000000000001` at all three targets.

The probe also repeated the held depth-2 interference case. A concurrent
selection change did not retarget the write. Cleanup removed scratch track
`4ae2cd56-b361-49a9-a8dc-a082682263cb`. The exact four-track entry list remained
unchanged.

## Retrospective

Name each positional guard for its coordinate system. A root position and a
nested local position are not interchangeable.
