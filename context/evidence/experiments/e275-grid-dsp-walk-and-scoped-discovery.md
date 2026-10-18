---
title: E275 — Grid DSP walk and scoped discovery
kind: evidence
state: active
updated: 2026-10-18
owner: phase-9a
---

# E275 — Grid DSP walk and scoped discovery

## Result

The operator replaced the controller for [E274](e274-grid-root-read-and-contents-bridge.md).
The V2 hello passed. Initialization was `2026-10-18T14:01:10.940Z`, with
112 methods, hash `1632f304f2cdb820`, and marker `9a-grid-read-v2`.
The profile is `phase-8-probe-v1`. No other phase8 or phase9 driver was running.

The first V2 capture reached `device_contents`. It then entered the internal
DSP component graph. The walk returned incomplete, before it found the four
visible modules. The driver saved the result, stopped, and released its epoch.
No internal write, manual value change, or CRUD test ran. The semantic read
gate has not passed.

V3 adds bounded schema discovery and explicit property projections. It is
built, tested offline, and deployed. Its replacement and live measurement are
pending. This is a continuation of the existing [9a read gate](../../plan/phase-9/9a-live-grid-editing-spike.md).

## V2 evidence and cost

See the [entry](../data/phase9a-grid-read/live-02/entry.json),
[binding](../data/phase9a-grid-read/live-02/binding.json),
[capture](../data/phase9a-grid-read/live-02/capture-0.json), and
[call trace](../data/phase9a-grid-read/live-02/calls.json).
The root device UUID is still `e3aebd87-3e23-4de1-8d96-da410b00d77d`.
This agrees across controller replacement, not a project reload test.

The capture has 56 nodes, 507 work units, and 43,086 graph bytes. It reports
17 errors, with 16 bounded messages: unsupported `v3K` values, depth limits,
an unknown binary value, and an array limit. Internal objects include voice
processing, delay compensation, native code atoms, and component connections.
These are not the fixture's semantic module/cable graph. No limit was raised
to make the walk pass.

| Operation | Wire elapsed | Document task | Queue | Completion |
|---|---|---|---|---|
| Bind | 62.806 ms | See binding | See binding | See binding |
| Capture | 48.016 ms | 7.532 ms | 0.061 ms | 23.056 ms |

The document walk took 5.654 ms. Process heap samples increased by 2 MiB.
This is not peak allocation or retained heap. The trace has 13 wire calls,
including the release. A separate public state read followed the failure.
Its [exit state](../data/phase9a-grid-read/live-02/exit-state.json) has the same
project and selection. Both [fixture file hashes](../data/phase9a-grid-read/live-02/files.json)
were checked again and are unchanged.

Wire time is close to V1's 47.393/48.148 ms. Document time increased by more
than 20 percent as the scope grew from 2 to 56 nodes. This is explained by the
additional traversal, not a product-path regression. The plan requires a stop
on incomplete required readback, so the same failed walk was not repeated for
a timing claim. V3 must get a new matching live measurement.

## Offline route discovery

The installed jar pin is unchanged. A bounded local string search found the
host's `module_grid` schema. Narrow javap inspections followed these leads:

- `S2E.cYf()` searches the device contents' top-level component list for `gOr`.
  The inspected method does not create or change an object. It was not invoked.
- `gOr` uses descriptor `Grz`, named `module_grid`. Its preset identifier is
  `MODULES`.
- `Grz` declares `auxiliary_devices`, property 6428, with module descriptor
  `WZo`. Its flags are 409, so the serializer filter also excludes it.
- `WZo` declares a module's `device_contents`, property 406. Its base `GCp`
  supplies `grid_x` and `grid_y`. The module contents schema is `HVJ`.

These facts identify a candidate route. They do not establish the live module
list or its parameter/cable mapping. The next read must confirm the route.
The [inspection record](../data/phase9a-grid-read/environment-v3.json) hashes
38 named classes. Vendor bytecode remains outside Git. No third-party source
was copied into the new reader.

## V3 read protocol

`probe.gridRead` retains bind, read, and release. It adds `schema`, within the
same research-only method and fixture guards. It has no mutation operation.
A schema call reads one object's descriptor metadata and immediate child
headers. It does not read scalar values or recurse through child descriptors.
`complete` applies only to that schema request, not to a semantic Grid read.

A path has at most 12 steps. Each step names the expected parent descriptor
class, property ID, property name, and child index. It must be a relationship.
A missing, renamed, ambiguous, scalar, null, or out-of-range step refuses.
Each relationship has at most 256 children. The route is checked again after
the read; the resolved root must be the same object. Existing document, track,
device, epoch, and public-route guards still apply.

A projected read names descriptor classes and exact property IDs. It requires
all named fields on each visited class. An unclassified visited class or a
missing field makes the read incomplete. The selection can include fields
excluded by the file serializer. Filter errors still fail. Output marks these
fields `explicit-projection`; the saved query states their exact scope. An
unknown selected scalar or binary value still makes the capture incomplete.
This does not weaken the semantic gate: all four fixture modules, both directed
cables, duplicate identities, layout, and the test scalar must be independently
accounted for before that gate can pass. A projection is not a lossless device
serialization.

Limits: 32 projected classes, 64 fields per class, 1,024 selected fields total,
128-character query labels, 4,096 schema/query work units, and 1 MiB encoded
schema or graph. Path navigation, descriptor scans, and projected graph visits
share the query work limit. Default unprojected reads keep their existing
4,096-unit walk limit. The final identity-route check has its own bounded path
validation. Schema/query work has a one-second cooperative deadline; the final
route check has the same bound. The five-second asynchronous deadline remains.
No individual host getter can be preempted.

One schema or projected read uses one wire call, one document task, and one
controller completion. Paths add local descriptor scans and a final route
check, not wire calls or write stages. The four-turn capture target and 8 MiB
planning estimate remain unmeasured for this view. Both typical and largest
admitted fixture costs need live checks. No product call budget changed.

The driver has `schema` and `project` modes. Each uses the same project/build
checks, bind, two settled reads, file-hash checks, selection check, and release.
It saves the query beside the results. On a returned incomplete graph, it now
also records exit selection and file hashes before closing the connection.
A wire failure remains an error; it is not reported as a complete schema.

## Next run

V3 archive SHA-256:
`e3e9b05af6cd46fc722918eeb0a0c8e5f58916d3f484b39e948763c32ca6692e`.
See [deployment](../data/phase9a-grid-read/deployment-v3.json). Expected marker:
`9a-grid-read-v3`. Method count/hash and profile are unchanged. The running
controller was V2 at deployment. The normal archive has not been restored.

The operator must fully remove the controller and add the final matching
`ghostnote probe` in the complete list. Wait for confirmation. Then run
`npm run probe:hello` from `brain/`. Start with the saved
[contents schema query](../data/phase9a-grid-read/schema-contents-query.json):

```sh
node --import tsx src/probes/phase9a-grid-read.ts schema '/Users/jonvuri/Documents/Bitwig Studio/Projects/gn-grid-spike/gn-grid-spike.bwproject' '/Users/jonvuri/Documents/Bitwig Studio/Library/Presets/Poly Grid/gn-grid-spike-baseline.bwpreset' /absolute/new-output-directory /absolute/context/evidence/data/phase9a-grid-read/schema-contents-query.json
```

Use the returned child headers to identify the actual `module_grid` index.
Inspect its schema before selecting its fields. Save each query and result in
a new directory. Keep the fixture unchanged until the baseline projection
covers all required fields. Then continue the manual delta, selection-away,
and project reload checks in 9a. No write experiment is authorized by a schema
success alone.

## Verification and verdict

The extension build, archive checks, and Grid harness pass. New controls cover
schema reads without scalar access or child recursion, path class/name/index
guards, scalar-path refusal, child/property limits, missing projected classes
and fields, selected unknown binary values, filter failures, shared work bounds,
and invalid query numbers, duplicates, and path lengths. Brain typecheck and
all 236 focused wire, adapter, and call-budget tests pass. Public descriptions
remain v52, 44 tools; no public tool description changed. Context validation
passes with 631 active documents. See the
[verification record](../data/phase9a-grid-read/verification-v3.json).

| Dimension | Verdict |
|---|---|
| Correct outer device and contents access | Proved on the fixture |
| Complete module/cable read | V2 incomplete; V3 unmeasured |
| Independent UI/preset baseline | E274 baseline preserved |
| Manual scalar delta, selection-away, project reload | Not attempted |
| Module create/update/delete; cable create/retarget/delete | Not attempted |
| Engine adoption, edited persistence, mutation recovery | Not attempted |
| Cleanup | No patch mutation; epoch released; selection and files unchanged |

## Retrospective

A recursive device-contents walk reaches DSP definitions before user modules.
Use one-object schema discovery to locate the semantic container, then state
an explicit field projection. This avoids changing the archive for each new
field query and keeps excluded fields visible in the query contract.
