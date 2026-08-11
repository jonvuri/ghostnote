---
id: D15
kind: decision
state: active
source: DECISIONS.md
---

# D15 — Verification discipline **[SETTLED 2026-07-25]**

Three rules that each cost a wrong finding or a crash to learn. They are cheap to
follow and expensive to skip.

1. **Readback is the only truth** (standing rule 1). Offline validation is
   necessary, never sufficient — a wrong modulator route passes `validate()` and
   silently does nothing (E10b).
2. **⚠ Verify a write through a DIFFERENT handle than the one that made it**
   (standing rule 3a). Bitwig's cursors cache what you wrote and report it back
   whether or not it landed. **Two findings were wrong for exactly this reason** —
   E15-C was retracted outright and E15-D was misdiagnosed — and E15-E found a
   property that only ever existed in the writing cursor's cache. An independent
   cursor, or the same one after a re-point, is what makes rule 1 actually bite.
3. **⚠ VALIDATE INPUTS BEFORE CALLING; a handler's `try/catch` is not a safety
   net.** An exception Bitwig DEFERS to its own thread escapes every extension
   frame and takes the application down. `Signal.fire()` returned normally and
   threw later on `BitwigStudioMain`'s thread, killing Bitwig with an unsaved
   project open (E14-A1). Compare E7-Finding-0, which crashed the extension at
   init; this is the same hazard class at runtime, one level worse.

**Corollary, and the reason the fake exists:** every trap the fake models cites
the FINDINGS experiment that established it, and each is covered three ways — a
direct model test, a conformance case, and a runnable live probe. A trap that is
always mitigated is a trap whose model can rot undetected, which is why the direct
tests assert the MISBEHAVIOUR rather than the fix.

---
