# 9b.6g checkpoint 13: listener maps and ancestor allocation

This checkpoint is not session completion. No command or complete table is
admitted. No live request, deployment, attempt, cache change, or vendor
initialization was made. Continue the active 9b.6g work list.

## Local contracts and tests

`listener_map_variant.py` compares one null-guarded fresh `HashMap(1)` with
the default-constructor form. The map must be stored in the same private
static field. The check removes only the literal, changes only the external
constructor signature, and preserves all other tokens and branch targets.
It rejects handlers, back edges, branches into the allocation, and extra
matching sites. Eight inert tests check the projection and its exclusions.
This comparison does not establish equal allocation, capacity, or growth.
It does not admit listener registration or callbacks.

`port-setter-contracts-2.json` matches all 63 local contracts. Four use this
explicit variant: `CKx.TtY(foz)`, `CKx.lYc(foz)`, `LKb.Hnt(foz)`, and
`UqJ.IwV(foz)`. Their different constructor inputs remain in the report.
`listener-map-renamed-1.json` checks each source contract and target
projection on the corresponding renamed fixture with unrelated additions.
The strict comparator is unchanged.

`history-aggregate-1.json` adds wrapper construction and getter bodies to
the ancestor-loop count. The complete catalog uses three property classes:
`deT`, `deU`, and `deX`. Their per-ancestor vendor instruction bounds are
74, 71, and 66. Their vendor call bounds are 12, 11, and 11. Each allocates
one wrapper and calls the external `Object` constructor once. The result
matches on both real jars. Fifteen supporting local contracts match.

The aggregate bound is **12 + 74D vendor instructions, 1 + 12D vendor
calls, D wrapper objects, and D external Object constructor calls**.
It requires the exact receiver contracts, initialized disabled assertions,
and a stable, finite parent chain with no cycle. It excludes class
initialization, external constructor bodies, and exception paths. The
getter and constructor evidence does not observe a runtime parent chain.
Keep the separate H + S × D helper-match model.

## Bundled runtime evidence

The fixed extraction set adds `IdentityHashMap` and now has 33 classes.
`runtime-comparison-8.json` records hashes for the four new extraction
reports. ARM64 and x64 class data match within each build. Across builds,
only the previously identified `ReferenceQueue` class differs. The
`IdentityHashMap` class hash is
`52ed4966b1f44161c19fd38ca1edc9ebe5dda0791420a98b4ae3cf9b800469ad`.
No bundled runtime class was loaded or initialized.

`identity-map-model-1.json` records 10,920 inert bytecode-interpreter cases.
They cover capacities 2 through 64, every start slot, collision lengths,
wrapped lookup sequences, and present and absent non-null keys. The model
interprets the extracted `get`, `maskNull`, `hash`, and `nextKeyIndex`
bodies. It substitutes an inert value for native identity hashing.

For K prior collisions, a found-key lookup stays within **45 + 24K** JDK
instructions. An absent-key lookup stays within **43 + 24K**. Each calls
native identity hashing once. The model reaches the stated instruction
bound in 5,586 cases. A valid stable table with an empty key slot is a
required condition. Capacity, entry limits, native work, monitor waits,
and concurrent changes are not measured or admitted.

## Verification and reproduction

The full offline suite ran 322 tests: 292 passed and 30 integration tests
were skipped. It includes 224 new unit tests for 9b.6g. The full log is
`gn-9b6g-unit-regression-20.log` in `development.zip`. The 10,920 inert
runtime cases are separate from that unit-test count. `git diff --check`
passed. Complete resilience and host checks remain gated.

`development.zip` and its manifest preserve 36 new or changed development
files after checkpoint 12: 11,816,136 raw bytes and 599,911 archive bytes.
The source archive and inventory record the diagnostic implementation.
Use `PYTHONPATH=brain/src/probes python3 -B` for jar-analysis scripts.
The four `runtime-*-8.sh` scripts reproduce the class-data extraction with
the recorded external `jimage` tool. Inputs remain at the fixed paths from
prior checkpoints. Reports and scripts retain their input hashes.

The setter comparison used 9,645.727 ms and 370,475,008 peak RSS bytes.
Its report is 4,141,034 bytes. The ancestor aggregate used 8,717.970 ms and
364,658,688 peak RSS bytes; its report is 3,713,822 bytes. The inert JDK
model used 2,089.891 ms. All reports fit the existing work and size limits.
An initial documentation patch did not match its expected context and made
no change. The subsequent patch updated the exact paragraph.

## Next dependencies

Close the fixed command paths and their callbacks. Bound actual listener
map entries and establish stability. Close factory clone state, defaults,
initialized disposal, history growth, resource-helper exclusion, manager
changes, replay, and failure paths. The new local bounds are inputs to that
work. They are not a reason to stop or prepare a partial probe.
