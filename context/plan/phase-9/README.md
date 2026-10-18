---
title: Phase 9 — Overlap investigation
kind: plan
state: active
status: E292 stops the V12 live test at Q0 before notes or edits. Exact inactive restoration passes; 9a remains active.
updated: 2026-10-19
parent: ../ROADMAP.md
prev: ../phase-8/README.md
next: ../phase-10/README.md
---

# Phase 9 — Overlap investigation

Fill in this phase as the overlap investigation continues. The operator has
not selected its full scope. The former Phase 9 plans are now in
[Phase 10](../phase-10/README.md).

The selected [9a — Live Grid editing spike](9a-live-grid-editing-spike.md)
continues from the verified
[E277 checkpoint](../../evidence/experiments/e277-grid-value-write-readback-and-persistence.md).
The operator selected continued module/cable investigation within 9a.
[E281](../../evidence/experiments/e281-grid-module-delete-and-persistence.md)
passes bounded native module deletion, undo/redo, and persistence. The exact
fixture baseline is restored.
[E283](../../evidence/experiments/e283-detached-grid-factory-lifecycle.md)
passes the V8 detached factory gate.
[E284](../../evidence/experiments/e284-native-grid-attachment-design.md)
completes the [attachment design](9a-native-attachment-design.md).
[E285](../../evidence/experiments/e285-native-grid-attachment-probe.md) implements,
checks, and deploys V9.
[E286](../../evidence/experiments/e286-grid-attachment-witness-wire-fix.md) confirms
V9 loaded, then records a pre-factory witness-encoding refusal and exact baseline
recovery. V10 fixes that defect. [E287](../../evidence/experiments/e287-grid-attachment-managed-identity.md)
records native insertion and close, followed by a managed-ID readback stop.
V11 adds native registration proof. [E288](../../evidence/experiments/e288-v11-restored-baseline.md)
confirms operator recovery, V11 hello, and paired baseline reads.
[E289](../../evidence/experiments/e289-native-grid-attachment-and-persistence.md)
passes two V11 attachments, exact paired readback, preserved layout and
selection, one-step undo/redo, and edited-state reload. The exact baseline is
restored and reopened. Both V11 factory attempts were used.
[E290](../../evidence/experiments/e290-grid-engine-adoption-design.md) completes
the [engine adoption design](9a-engine-adoption-design.md). No engine adoption
is claimed; no live state changed in E290.
9a remains active. The wider scope is not selected.

[E291](../../evidence/experiments/e291-grid-engine-probe-implementation.md)
implements V12 and passes the offline checks for the engine contract. The
archive was built without deployment in E291. E292 records its deployment
and bounded live attempt. No DSP adoption result is claimed.

[E292](../../evidence/experiments/e292-grid-engine-quiet-gate-refusal.md) confirms
V12 loading and inactive baseline preparation. The active run refuses signal
before any test note at Q0. No graph edit or factory runs. Exact inactive restoration and session release
pass. Next is the planned baseline signal and failure evidence design in 9a.
DSP adoption remains unproved.
