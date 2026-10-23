# 9b.6g checkpoint 14: resource receivers and initialized disposal

This checkpoint is not session completion. No complete table or command is
admitted. No live request, vendor initialization, deployment, attempt, or
cache change was made. Continue the active 9b.6g work list.

## Resource receiver check

`resource-catalog-exclusion-3.json` resolves two new-build descriptor
anchors: `analyzable_sample_reference_handle` (5604, runtime `WzZ`) and
`simple_single_sample_resource` (534, runtime `Ydr`). Each has one
constructor and class-getter match. None of the 55 fixed catalog receivers
is a subtype of either runtime class.

The report reuses `helpers-1.json` for the five direct `IPH` call sites.
Four callers are declared by `WzZ`; one is declared by `Ydr`. It preserves
the incoming scan's method-handle and unresolved-reference records. These
methods cannot run with an exact fixed catalog object as their receiver.
This is not a complete command exclusion. Other object references,
application callbacks, reflection, native calls, and dynamic calls remain
separate requirements.

The first two attempts required the same named anchors in the source jar
and refused. `resource-anchor-0-2.json` records zero matches for both.
`resource-label-search-1.json` scans the source class data for the two
literal labels and finds neither. No source counterpart or cross-build
resource equivalence is asserted. The successful report checks the new
resource receivers only. It does not infer that the source build has no
resource behavior.

## Initialized listener disposal

`disposal_wrappers.listener_flags_delegate` retains the enabled branches.
Each checked block reads its own private boolean flag. If enabled, it gets
the listener owner, removes its own final listener, and clears that same
flag. The method then calls its superclass disposal method. No getter or
removal body is replaced with a no-op. Handlers, changed branches, different
fields, mutable listeners, duplicate fields, extra work, and a different
superclass delegate are refused.

Seven new inert tests cover all flag combinations and partial failure.
When the second removal fails, the first removal and flag clear remain.
The second flag remains true. This requires the existing uncertain-state
latch; it does not permit a disposal retry.

`disposal-listener-bounds-2.json` checks `tqm.dC_` on 6.0.6 and `Hgx.ix_` on
6.1.4. Both real jars and both renamed fixtures have the same local maximum:
**25 instructions and five calls**. The all-false path costs nine
instructions. The wrapper and four getter/removal contracts match across
the real jars. Callee bodies, listener storage, tracking mode, recursive
superclass disposal, and failure paths remain separate.

The initial bounds script expected a direct Hgx member binding in its seed.
That binding was absent. Version 2 uses the existing runtime-class binding
and the bound inherited disposal slot. The local comparison then verifies
the wrapper and its references. Both attempts are preserved.

The template has one Hgx node. Its `bipolar_panel_value` property (6411)
contains a BMo node. Its `name_panel_value` (6841) and
`associated_modulation_source` (6846) are null. All three property flags are
394 and include the clone bit. The existing fixed collector traces bind
6411 to `rXz.Z1C`, 6841 to `rXz.dnz`, and 6846 to `rXz.cp_`. These file and
schema facts do not prove listener multiplicity or clone-state stability.
Do not substitute the old all-false disposal condition after initialization.

## Verification and reproduction

The full offline suite ran 329 tests: 299 passed and 30 integration tests
were skipped. It includes 231 new 9b.6g unit tests. The focused disposal
suite passed 18 tests. Logs are in `development.zip`. `git diff --check`
passed. Complete resilience and host checks remain gated.

The archive preserves 22 new or changed development files after checkpoint
13: 4,608,240 raw bytes and 222,709 archive bytes. The manifest records
hashes and byte counts. The source archive and inventory record the exact
diagnostic implementation. Run jar-analysis scripts with
`PYTHONPATH=brain/src/probes python3 -B`. They use the unchanged fixed jar
paths and the prior checkpoint inputs.

The resource receiver report used 6,564.487 ms and 193,937,408 peak RSS
bytes; its report is 37,373 bytes. The disposal report used 19,532.210 ms
and 505,561,088 peak RSS bytes; its report is 3,523,315 bytes. All results
fit the existing work, memory, and report limits.
