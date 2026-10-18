---
title: Phase 9 — Overlap investigation
kind: plan
state: active
status: E289 passes bounded native attachment and persistence. Engine adoption design is next; 9a remains active.
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
restored and reopened. Both factory attempts are used; V11 remains loaded.
The next 9a session is [engine adoption design](9a-live-grid-editing-spike.md#next-session--engine-adoption-design).
9a remains active. The wider scope is not selected.
