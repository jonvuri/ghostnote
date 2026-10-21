---
title: Bounded write command trace
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
evidence: E305
---

# Bounded write command trace

The [manifest](trace-manifest.json) pins the local Bitwig 6.0.6 jar and
the `javap -p -c` output for each inspected class. No vendor code is copied.

## Boolean

The E304 Gates atom has runtime class `QY`. `Xuo.eOi(boolean)` checks
the object state and dispatches to `QY.NaF(boolean)`. That method checks
`GCG()`, opens a named edit, calls the base setter, updates the stored
boolean through `ffA(boolean)`, and closes the edit. It can return without
a change when `GCG()` is true. Descriptor field 210 is the stored value;
`hhJ()` reads a different value. Use descriptor readback.

`QY.ffA(double)` also reaches this path, but adds a threshold and an outer
edit. The probe must use the boolean command with an actual boolean.
Do not select a method from the descriptor ID.

## Mapping

`Net.cG3(Hjt)` dispatches to `NDn.eOi(Hjt)`. It finds the first mapping
whose destination reference resolves to the exact target atom, opens
`Clear modulation`, removes that mapping, and closes the edit. Admission
must prove exactly one such mapping before this command.

`Net.eOi(Hjt,double,boolean,jas,NDn)` dispatches to the matching `NDn.ffA`.
It checks the destination domain and calls
`ikl.ffA(rHj,Runnable,HEV,ziZ)`. The latter calls its five-argument
overload, which opens an edit, calls `Runnable.run()` inline, and closes
the edit. This path is synchronous. The presence of a Runnable alone does
not mean deferred work.

The private callback clamps the amount to the target's `MTu.NCM()` range.
It changes an existing matching mapping, or creates a destination reference
and calls the mapping factory. The final optional `NDn` is an auxiliary
source. The selected E304 mapping has no auxiliary source. Its amount is
129 native units, enabled is true, transfer is LINEAR, and polyphonic is
true. Both auxiliary flags are false.

Creation appends a new mapping. It does not preserve the old mapping or
reference identity, or the old list position. A restore comparison must
permit only those specific changes. It must retain the relative order and
identities of all other mappings. A general identity normalization would
hide unrelated changes.

## Gates factory and lifecycle

`DbL.pvN(UUID)` is the existing E281 type factory. The new type argument is
`8d644ad7-8d77-4f05-a36e-04a57f719635`. The factory and ownership symbols
are unchanged. Initialization can load module content; its latency and
native allocation have no hard bound.

The existing attachment implementation is not a general lifecycle guard.
It requires four original modules, at most five members, a 77-object
detached tree, an eight-node Amplify capture, and fixed placement `(2,0)`.
WT Parkour has 19 modules; its Gates module has 17 atoms. Do not relax these
checks or call the existing attachment runner with Gates.

The detached probe must retain ownership across separate command and read
tasks. It must read the new module twice, then dispose only the same proved
detached tree. A later read must check disposal. A factory response does not
prove the defaults. Attachment needs a separate admission proof.

## Planned bounds

Use one writer and one document task at a time. Each command needs a fresh
paired descriptor baseline and two separate post-command reads. Keep the
reader's existing 4,096-work, depth-12, 256-array, and 1 MiB response limits.
The driver scope remains 64 modules. Partition membership and target reads
when a complete capture does not fit.

The boolean and mapping cases each have two native commands. Detached
factory and disposal add two commands. This is six command calls and at
least 18 read calls: one initial pair and two pairs after commands per
case. Each partition adds a pair at every affected boundary. The 24-call
minimum has a 576 ms transport floor at 24 ms per turn. It excludes bind,
release, guards, fixture setup, and schema discovery.

Retain the E304 48 MiB temporary-heap planning allowance for descriptor
work. Retain at most one detached tree, with 256 objects and depth 12.
Those limits bound traversal and retained references, not factory
allocation. Record native command, document-task, wire, and heap samples
on the admitted live path. Do not make a product performance claim.
