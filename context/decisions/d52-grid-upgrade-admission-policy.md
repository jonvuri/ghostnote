---
id: D52
kind: decision
state: active
updated: 2026-10-22
source: phase-9b
---

# D52 — Grid upgrade admission: offline resolution plus guarded runtime admission **[SETTLED 2026-10-22]**

The Grid path uses obfuscated Bitwig symbols. Each Bitwig upgrade can
rename them or change their logic. The goal is to adapt the Grid commands
to each upgrade and keep them safe and reliable, with as little operator
interruption as possible.

[E316](../evidence/experiments/e316-grid-doctor-606-acceptance.md) accepted
the 6.0.6 doctor with offline structural resolution, runtime guards, a
consent-gated scratch-track self-test, and per-call timing. The 6.1.4
upgrade changed logic, not only names, so offline resolution refused
([E331](../evidence/experiments/e331-grid-doctor-614-resolver-refusal.md)).
Sessions 9b.6a–9b.6g then tried to prove complete bounded admission of the
doctor's commands offline before running the doctor on the new build.
[E338](../evidence/experiments/e338-grid-doctor-614-offline-closeout.md)
records the result after 17 checkpoints: resolution is complete, many
local bounds hold under explicit conditions, but every closure step opened
a wider frontier, and several conditions are runtime facts that no offline
check can supply. That criterion does not converge. The 6.0.6 doctor was
accepted without it, with the same replay-worker parity limit.

## Decision

1. **Offline structural resolution stays required.** On each new jar
   fingerprint, the resolver must bind every role or refuse. A name-only
   change passes without agent work. A refusal is a result, not a failure.
2. **Complete offline bounded admission is not a gate.** It is replaced by:
   - a **body-change report**: compare the exact bodies of the role set
     with the last accepted build and list the bodies whose logic changed;
   - a **bounded trace of the changed bodies only**, with one question per
     body: is it the same operation with the same effects on the fixed
     doctor path, or does it add a wait, monitor, queue, compile, or
     callback that a runtime guard or a live measurement must cover;
   - **runtime entry guards** that read, never write, before each native
     command: the same manager and project-document class, empty pending
     and helper state, a false tracking flag, and an owned-tree check
     before disposal. Each guard has a modeled host cost under the ledger;
   - the **consent-gated doctor** on a scratch track, one attempt per
     fingerprint, with paired independent readback, the uncertain-state
     latch, no retry, and per-call timing compared with the last accepted
     build.
3. **Preference order, not blockers:** deterministic offline checks, then
   runtime checks without fixtures, then the doctor with fixtures, then an
   agent trace session. Use the earliest level that gives a reliable
   result. Any level is permitted when safety needs it.
4. **Known parity limits are measured, not proven.** The replay-worker
   hang, global monitor waits, and listener fan-out exist on every build.
   The doctor covers them with consent, timing, and the latch.
5. **Unchanged:** [D15](d15-verification-discipline-settled-2026-07-25.md),
   the strict comparator, the original selectors, the write lock, the
   freshness, selection, journal, replay, and owned-head guards, and the
   rule that a changed selector needs a trace and evidence first.

## Consequences

- The 9b.6c–9b.6g completion criterion "complete resolution and bounded
  admission before probe preparation" is superseded. Their evidence and
  tools stay. Session 9b.6h prepares the guarded doctor on 6.1.4.
- 9b.7 turns this policy into a tool: automatic name-only acceptance, a
  deterministic body-change report, the guard set, and the fingerprint
  cache. The product refuses Grid writes without a cached pass.
- The 9b.6g diagnostic modules are reusable bytecode tools on any future
  jar. Their per-build digests and bounds are inputs to the body-change
  report, not acceptance results.
