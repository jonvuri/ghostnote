# 9b.6g checkpoint 3

This is an intermediate checkpoint. Session 9b.6g remains active. No complete
admission table, candidate, attempt, cache, or deployment is produced. No
vendor class is initialized. No host request is sent.

## Fixed reads and wrappers

The four `dataflow-2` reports check all 49 captured property paths on both
real builds and both fully renamed inert models. Each report visits 2,372
states and instructions. The old build has 422 calls; the new build has 424.
All paths pass. The interpreter now checks special-call receivers, refuses
private virtual calls, and enforces the ledger's 16,000-call limit. These
checks do not change the fixed paths. Exact receiver types, descriptor
instances, property IDs, and assertion fields remain runtime conditions.

The real-build data-flow checks take 3,951.582 and 4,076.355 ms. Peak RSS is
179,912,704 and 184,991,744 bytes. The renamed checks take 4,972.636 and
5,095.465 ms, with peak RSS of 194,953,216 and 198,574,080 bytes. These are
offline scan measurements, not host timings.

The wrapper reports bind two relationship factories and 11 factory,
constructor, and initializer contracts on each real build and renamed model.
Each factory allocates one wrapper. The conditional vendor instruction
bounds are 34 and 32, with five vendor constructor calls each. The bounds
exclude class initialization and the external `Object` constructor.
Assertion guards and ancestor depth still need enforcement. The factories
are selected from bound property classes by signature and operation shape.
Target class names are not selectors.

The full-jar dependency mutation changes the membership getter's receiver
load to null. Symbolic roles and property contracts still resolve. The
fixed-read integration refuses the `module_contents.child_components` path
with `read-flow-field-receiver`. The failed read reports are retained in
`callee-mutant-reads`. The development archive retains the mutation script,
inert model hash, earlier pipeline results, and refusal log.

The 53-test run passes. After the receiver and limit checks, the focused
read suite passes 13 tests, including three new cases. The earlier offline
regression run passes 116 tests and skips 30 integration tests. No complete
command-admission or driver integration result follows from these tests.

## Command dependencies

The callback reports retain these findings:

- The project journal has a concrete override. Its close hook calls project
  validation and updates Undo state. The base no-op callback is insufficient.
- The validation invalidation filter includes property ID 6428, the Grid
  membership property. An unchanged validation flag at entry cannot exclude
  validation work after deletion or attachment.
- A context manager change can call the end-of-event queue drain. The
  same-manager branch avoids that call. The drain can run queued callbacks
  and has no local iteration cap.
- Replay queues a worker and calls `Semaphore.acquire`. This call does not
  itself pump application events. The worker reads the edit file. Worker
  failure and the existing non-interruptible native timeout remain limits.
- Failure notification can enqueue another callback. Enqueueing a callback
  is distinct from running it. Later queue drains still need closure checks.

The constructor-argument report finds four captured relationship inputs with
bit 32 clear: source, device contents, child components, and auxiliary
devices. It does not prove constructor forwarding, runtime field values,
all generated properties, or the project and track ancestor chain. No
zero-growth history invariant is admitted.

The development archive also contains coarse forward command walks. They
retain receiver hypotheses and unresolved virtual, dynamic, and external
calls. They are investigation aids, not data-flow or exclusion proofs.
Version 1 starts some walks at symbolic declarations; version 2 starts at
the concrete root hypothesis and retains unresolved lookups. Do not use
version 1 as a concrete root-dispatch proof.

## Runtime dependencies and next checks

Selected JDK class data match between ARM64 and x64 for each bundled build.
Of the 26 classes in the architecture comparison, only `ReferenceQueue`
differs between builds. Its constructor and initializer traces match.
The later 27-class report adds `Float` and the integer and map helpers used
by tracker initialization. These are bytecode checks. Initialization state,
VM behavior, and live tracker mode are not observed.

Continue the work list in the session plan. Bind the validation and property
notification callbacks. Check manager identity through command begin,
close, and replay. Complete the pending-helper and ancestor proofs, then
derive history and storage bounds. Complete command resilience before
driver or probe preparation. A retained unresolved edge is not a blocker
handoff or an accepted endpoint.

`development.zip` contains files added or changed since checkpoint 2.
`development-manifest.json` gives their hashes. The archive includes scripts,
reports, failed attempts, method dumps, and tests. `source-inventory.json`
records the diagnostic source at this checkpoint. The original entry
inventory remains the preservation baseline. No old evidence is replaced.
