---
title: 9b — Grid symbol manifest
kind: note
state: active
status: E316 passes all 76 V20 roles on 6.0.6. E334 traces ownership and event dispatch; bounded admission and the complete 6.1.4 table remain incomplete.
updated: 2026-10-21
parent: 9b-grid-breadth-discovery-and-build-out.md
---

# 9b — Grid symbol manifest

This manifest lists the obfuscated members used by the current Grid code.
It is an input to [step 2](9b-grid-breadth-discovery-and-build-out.md#step-2--build-symbol-discovery).
[E300](../../evidence/experiments/e300-grid-survey-preflight.md) records the
source inventory and signature check. The invariants below are the existing
9a checks or the required resolver checks. They are not new live results.

Pinned build: Bitwig 6.0.6, jar SHA-256
`382c655d0b9e8db6bd433dc6100ef3a4ee23abf6a6615f79c40f0c2645792c93`.

Class prefixes in the tables:

- `D.` = `com.bitwig.flt.document.core.master.device.`
- `R.` = `com.bitwig.ramona.core.`
- `M.` = `com.bitwig.flt.document.core.master.`
- `S.` = `com.bitwig.ramona.serial.`
- A class without a prefix is in the default package. Java library types use
  their usual short names.

Each row gives the lookup class. A method can be inherited. Method shapes
are instance methods unless the row says `static`. Fields are instance
fields unless the row says `static`. A shape alone does not select a safe
candidate. First E identifies the first relevant trace or implementation
record; live acceptance can be later.

Source keys:
[R](../../../extension/src/main/java/com/ghostnote/extension/GridReadSymbols.java),
[W](../../../extension/src/main/java/com/ghostnote/extension/GridWriteSymbols.java),
[F](../../../extension/src/main/java/com/ghostnote/extension/GridFactorySymbols.java),
[A](../../../extension/src/main/java/com/ghostnote/extension/GridAttachmentSymbols.java),
[E](../../../extension/src/main/java/com/ghostnote/extension/GridEngineSymbols.java).

## Descriptor reads

| Role | Class | Member and signature | Shape for resolution | Validating invariant | Source | First E |
|---|---|---|---|---|---|---|
| Descriptor | R.HEV | `mW_(): cYx` | No arguments; descriptor result | Known object reports `native_device`, `module_grid`, or `module` | R | E273 |
| Class ID | cXV | `pea(): int` | Descriptor integer getter | ID and name agree with saved control schema | R | E273 |
| Name | cXZ | `lSJ(): String` | Shared descriptor/property base getter | Names include `device_contents` and `child_components` | R | E273 |
| Properties | cXV | `ciZ(): List` | Descriptor list getter | Unique IDs include 406, 173, and 6428 on the appropriate objects | R | E273 |
| Property ID | cYs | `QiZ(): int` | Property-base integer getter | ID/name pairs agree with control schema | R | E273 |
| Enabled field | cYF | `nM_(): boolean` | Property boolean getter | Root contents field 406 is enabled | R | E273 |
| Serialization filter | S.vWM | `ffA(cYF,R.HEV): boolean` | Property plus object, boolean result | Root contents is excluded; explicit bridge admits it | R | E273 |
| Filter instance | S.vWM | `cG3: S.vWM` | Static final same-type field | Filter result agrees with the serializer control | R | E273 |
| Scalar read | cYF | `eOi(R.HEV): Object` | One object argument | Known name, type UUID, and stored scalar agree | R | E273 |
| Child count | cYH | `wi2(R.HEV): int` | Relationship subclass; one object | Counts agree with enumerated children and bounds | R | E273 |
| Child read | cYH | `eOi(R.HEV,int): R.FZ1` | Relationship subclass; object and index | Children have expected descriptor classes and identities | R | E273 |

The root bridge also pins `D.S2E`. It accepts field 406 only when the
field is named `device_contents`, is enabled, and is a relationship.
`cYH` is the relationship type test. These class pins need resolution too.

## Value, cable, and delete paths

| Role | Class | Member and signature | Shape for resolution | Validating invariant | Source | First E |
|---|---|---|---|---|---|---|
| Native value setter | ccA | `kyi(double): void` | One double; base of tqm | Independent stored value changes; unrelated graph stays equal | W | E276 |
| Cable source getter | D.UL | `D1G(): D.yWH` | Destination base; source result | Result is the exact before-source object | W | E278 |
| Cable source setter | D.UL | `ffA(a): void` | Source interface argument; null disconnects | Independent destination field 7125 has the expected edge | W | E278 |
| Module parent | D.had | `Fuu(): D.cbl` | Module base; container result | Exact parent is the bound Grid | W | E280 |
| Module delete | D.had | `qON(): void` | No arguments | Membership removes only the named spare; incoming edge disappears | W | E280 |

Class checks also pin `tqm` (value), `D.mvZ` (destination), `D.WAr`
(source), `a` (source interface), `D.gOr` (Grid), and `D.DbL` (module).
The source interface is the default-package class `a`, not a guessed package.
The checks remain limited to the 9a fixture. A boolean or indexed writer is
not proved by the double setter.

## Factory and object lifecycle

| Role | Class | Member and signature | Shape for resolution | Validating invariant | Source | First E |
|---|---|---|---|---|---|---|
| Module factory | D.DbL | `pvN(UUID): D.DbL` | Static UUID factory | Amplify type round trip; detached object; fresh instance UUID | F | E281 |
| Owner | R.HEV | `I_(): R.HEV` | Object-base parent getter | Detached root has null owner; contents owner is module | F, A | E282 |
| Owned children | R.HEV | `dpx(String): List` | Nullable string argument | Bounded acyclic owned tree; every child's owner agrees | F | E282 |
| Disposed flag | R.HEV | `J_(): boolean` | Object-base boolean getter | False before disposal; true for all owned objects after disposal | F, A | E282 |
| Disposal | R.HEV | `dC_(): void` | Object-base no-argument command | Independent lifecycle checks prove disposal of the detached tree | F | E282 |
| Module parent | D.DbL | `Fuu(): D.cbl` | Module container getter | Null before attach; bound Grid after attach | F, A | E282 |
| Instance UUID | D.OEf | `VEb(): UUID` | Device-base UUID getter | Matches field 15; factory UUID differs from live UUIDs | F, A | E282 |
| Initialization helper | D.OEf | `kyi: D.XuU` | Protected helper field | Non-null after factory initialization | F | E282 |
| Remote helper | D.OEf | `rdo: qOW` | Protected helper field | Non-null after factory initialization | F | E282 |

The helper checks are weak selectors: non-null does not prove a candidate's
role. Step 2 must combine their type/use trace with the factory control.
The fixed factory type is Amplify,
`a6cd650b-c4de-46c6-8741-c07a0a9bfec2`.

## Attachment, layout, selection, and edit ownership

| Role | Class | Member and signature | Shape for resolution | Validating invariant | Source | First E |
|---|---|---|---|---|---|---|
| Members | D.NHx | `eJS(): List` | Grid ancestor; list getter | Membership and UUID order match field 6428 | A | E284 |
| Hidden count | D.NHx | `vl(): int` | Grid ancestor; integer getter | Zero in the admitted fixture | A | E284 |
| X | D.DtR | `cI_(): int` | Module ancestor; integer getter | Equals module field 6679 | A | E284 |
| Y | D.DtR | `kyi(): int` | Same module ancestor | Equals module field 6680 | A | E284 |
| Width | D.QHo | `pfb(): int` | Module ancestor; integer getter | Positive bounded rectangle; detached/attached width agrees | A | E284 |
| Height | D.QHo | `rdo(): int` | Same module ancestor | Positive bounded rectangle; detached/attached height agrees | A | E284 |
| Context | R.ikl | `mSv(): R.uX1` | Document-object context getter | Grid and managed atom share the bound context | A | E284 |
| Recording | R.uX1 | `MkF(): boolean` | Context boolean getter | True before the admitted edit | A | E284 |
| Manager | R.uX1 | `Ode(): R.Ibf` | Context manager getter | Stable manager identity through the edit | A | E284 |
| Document | cZl | `ffA(R.ikl): cZl` | Static object-to-document lookup | Same document as the proxy and edit context | A | E284 |
| Display key | R.Ibf | `NaF(): String` | Manager string getter | Existing key in the Grid display map | A | E284 |
| Journal active | daR | `eOi(): boolean` | Journal boolean getter | False at idle, true only in the owned edit | A | E284 |
| Current journal edit | daR | `NaF(): cZv` | Journal edit getter | Identity equals document current edit after begin | A | E284 |
| Current document edit | cZl | `jBn(): cZv` | Document edit getter | Same owned edit before insertion and close | A | E284 |
| Replay flag | cZl | `EbT(): boolean` | Document boolean getter | False before and during the admitted edit | A | E284 |
| Replaying flag | cZl | `Mkn(): boolean` | Document boolean getter | False before and during the admitted edit | A | E284 |
| Insert label | D.gOr | `ffA(Collection): String` | Private label method | Native insert label for the one-module collection | A | E284 |
| Begin | R.ikl | `ffA(String,R.wfl[]): boolean` | Protected edit opener; empty lock array | True; one owned frame and instant counter 1 | A | E284 |
| Close | R.ikl | `hoE(): boolean` | Protected no-argument edit closer | True; idle frame/counter state after one close | A | E284 |
| Associate edit | D.gOr | `aJp(): void` | No-argument Grid command | Associated field is the owned edit | A | E284 |
| Insert body | D.gOr | `ffA(Collection,int,int,boolean,D.RHk): void` | Package-private body; callback type distinguishes overload | False copy mode, null callback; ownership transfers and old layout stays equal | A | E284 |
| Frame stack | R.Ibf | `SRu: Stack` | Private final stack | Size 0 → 1 → 0; frame identity stays fixed during edit | A | E284 |
| Instant edits | R.Ibf | `pvN: int` | Private integer; no unique shape | 0 → 1 → 0 in the owned edit | A | E284 |
| Long edits | R.Ibf | `QiZ: int` | Private integer; no unique shape | Stays zero in the owned instant edit | A | E284 |
| Lock count | R.Ibf | `wi2: int` | Private integer; no unique shape | Stays zero with the empty lock array | A | E284 |
| Lock set | R.Ibf | `MkF: Set` | Private set | Null throughout the admitted edit | A | E284 |
| Journal map | cZl | `W2P: Map` | Private final map | Existing manager key returns the same journal; no creation | A | E284 |
| Associated edit | D.gOr | `pvN: cZv` | Private edit field | Exact owned edit after associate | A | E284 |
| Display map | D.NHx | `kG: Map` | Protected final map | Existing display-key entry; no state creation | A | E284 |
| Selection state | nST | `ffA: Tu` | Protected selection field | Existing live selection object | A | E284 |
| Selected modules | YJr | `JD1: List` | Protected selection list | Every selected object is a Grid member; exact preservation | A | E284 |
| Focus | YJr | `GC: rez` | Protected focus field | Null or mbe whose target is selected | A | E284 |
| Focus target | QAi | `pvN(): R.HEV` | Focus wrapper target getter | Target is one of the selected member identities | A | E284 |
| Managed ID | R.HEV | `WKy(): int` | Final object ID getter | Positive ID on the attached nitro atom | A | E287 |
| Registered lookup | R.uX1 | `ffA(int): R.HEV` | Context integer lookup | Lookup returns the exact attached atom | A | E287 |

Additional type pins: `dkb` is the nitro atom; `mbe` is the admitted focus
wrapper; `R.wfl` is the lock-array component; `D.RHk` selects the insertion
body overload. These are part of the resolver dependency graph. The width
and height methods return `int`; the native backing values use signed bytes.

The three integer counters have no unique structural shape. Zero values in
an idle document cannot identify them. Resolve them last, with a throwaway
edit and the transaction trace. Shape plus a zero-value check is also weak
for hidden count and replay flags. Do not claim general resolution from those
checks alone. Selection and journal access must read existing map entries;
native lookup helpers can create missing state.

## Engine connection guards

| Role | Class | Member and signature | Shape for resolution | Validating invariant | Source | First E |
|---|---|---|---|---|---|---|
| Engine state | M.Ymq | `AAO(): rjH` | Document ancestor; state getter | Connected/inactive value agrees with connection state | E | E290 |
| Connection | M.Svr | `jnZ(): cYQ` | Document connection getter | Non-null and stable during active test; null when inactive | E | E290 |
| Connected state | rjH | `cG3: rjH` | Static final same-type field | Identity equals active state with non-null connection | E | E290 |
| Inactive state | rjH | `ffA: rjH` | Static final same-type field | Identity equals inactive state with null connection | E | E291 |

`M.Svr` is also the document type guard. These members prove connection
identity only. They do not prove DSP adoption, packet freshness, or audio.
Retired meter symbols from V12 are outside this current-code manifest.

## Stable entry points and bounded projection

`getDeepestTarget`, `getDeepestProxy`, `getDocument`, `exec(Runnable)`, and
`isDocumentThread` are name-independent entry points for this investigation.
`exec` is declared on
`com.bitwig.flt.control_surface.proxy.ControlSurfaceObject`. Keep the proxy
identity, epoch, and document-thread checks when symbols are re-resolved.

The [E276 projection](../../evidence/data/phase9a-grid-read/semantic-query.json)
holds the descriptor names and numeric property IDs. Its path uses device
contents field 406, then child-components field 173 at index 7. That index
is a fixture assumption, not a resolved Grid identity. The survey must find
`module_grid` through bounded schema reads before it uses this projection
on another flavour. Type UUIDs are distinct from loaded module UUIDs.

No symbol or projection field was added in 9b.1. V13's session and target
admission guards prevent the planned scratch reads; see
[9b.2](9b-grid-breadth-discovery-and-build-out.md#session-9b2--scratch-reader-and-survey-continuation).

## E302 breadth observations

[E302](../../evidence/experiments/e302-stock-grid-survey.md) adds no pinned
obfuscated member. The [observed schema inventory](../../evidence/data/phase9b-survey/observed-schemas.json)
records 35 descriptor/runtime pairs with property IDs, names, and source
captures. These are discovery data, not additional resolver dependencies.

Follow-up fields include parameter mappings 3615; modulation-source mappings
3616/11497; inport source 248 and port index 249; array data 6609 and size
6613; Wavetable resource relationships 11161/11162. Their presence does not
prove a complete edge or resource model. Session 9b.2a validates that scope
before a write path pins any new member.

## E304 focused reads

[E304](../../evidence/experiments/e304-focused-grid-reader-live.md) adds no
obfuscated member. The [final query](../../evidence/data/phase9b-focused/focused-query-v6.json)
and [schemas](../../evidence/data/phase9b-focused/observed-schemas.json) record
the proved descriptor routes:

- Mapping source 3635 and destination reference 3739 → atom 65, with amount
  3611, enabled 11481, and transfer function 11338. Source 3616 and target
  3615 agree for five selected Grid edges. Source auxiliary list 11497 is
  observed separately.
- Modulation source settings 6194 → inports 614 → source component 248 and
  outport index 249. The source component belongs to the same Grid module.
- Gates data 6609 and size 6613, with stored boolean 210, integer 828, and
  indexed 457 values.
- Wavetable 11161/11162 → resource 11287 → handle 1204 → reference 4766 →
  file identity fields 1298/3386/3284/23/24/25. Reference fields
  4767/4024/11284/11285 give the name, sub-path, cycle size, and table size.

These are read routes, not setter symbols. Session 9b.3 must trace and
validate any new command before it adds a manifest dependency.

## E305 command candidates

[E305](../../evidence/experiments/e305-grid-write-command-preparation.md)
adds the following metadata dependencies in
[GridBreadthCommands](../../../extension/src/main/java/com/ghostnote/extension/GridBreadthCommands.java).
They pass resolution on the pinned jar.
[E306](../../evidence/experiments/e306-bounded-grid-writer-preparation.md) connects
them to the V16 research writer. E308 later proves these boolean and mapping
commands in the fixed cases. Keep their scope distinct from the 9a paths.

| Role | Lookup class | Member and signature | Required live invariant | First E |
|---|---|---|---|---|
| Boolean command | Xuo | `eOi(boolean): void` | Runtime class QY; Gates DEVICE_PHASE; independent field 210 changes and restores | E305 |
| Remove mapping | D.Net | `cG3(Hjt): void` | Runtime source NDn; exactly one matching target; both endpoint lists lose only that mapping | E305 |
| Restore mapping | D.Net | `eOi(Hjt,double,boolean,jas,D.NDn): void` | Exact target and native amount; no auxiliary source; new mapping restores all observed fields | E305 |
| Target domain | Hjt | `aGJ(): MTu` | Same target atom as the destination reference | E305 |
| Domain extent | MTu | `NCM(): double` | Finite native extent admits 129 without clamping | E305 |

Additional type checks use `QY`, `Hjt`, `jas`, and `D.NDn`. A method can be
inherited; the lookup class need not be its declaring class. The Gates type
argument adds no factory member. Attachment retains the original fixed
Amplify guards.

E306 reuses the existing attachment and engine witness symbols for edit
state, document identity, module/atom ownership, selection, and connection
identity. It does not create a Grid display or journal. It reuses factory
ownership, initialization, and disposal symbols for the detached Gates tree.
The fixed descriptor fields come from E304. No additional obfuscated member
is pinned. The command and witness metadata checks pass before deployment.

E307 distinguishes the `Svr` project root from the `cZl` edit wrapper.
V17 calls the existing `cZl.ffA(ikl)` lookup on both the Grid and project
root and requires the same non-null wrapper. Journal and replay members
use that wrapper. Engine state and connection members use the project root.
The witness retains both identities. No new member is added. Offline
metadata checks now test this receiver distinction as well as signatures.

E308 passes the boolean and mapping commands with independent paired reads.
The Gates factory returns, but detached field-14 aliases prevent readback.
V18 uses ownership-scoped identities for detached reads. It adds no pinned
member. E308 alone does not prove factory disposal or attachment.

E310 passes the fresh V18 Gates factory case. Paired descriptors prove the
17-atom defaults on a 236-object detached tree. Separate disposal read tasks
check every owned object's disposed flag. All fixture and control comparisons
pass. The existing factory/lifecycle symbols now have this additional typed
case; their first-E entries above stay unchanged. No Gates attachment or
resource loading is proved. Use ownership-scoped identities for detached
reads and document IDs for attached objects. No new member is pinned.

## E311 offline resolution

[E311](../../evidence/experiments/e311-grid-offline-resolvers.md) resolves all
69 rows above and 55 type dependencies on the pinned 6.0.6 jar. The
[resolved table](../../evidence/data/phase9b-resolvers/report.json) records
lookup and declaring classes separately. `MTu.NCM()` is declared on `TNT`;
`TNT` is therefore a resolver dependency. The `llL` layout class is included
because the 9b.4 brief requires it. No layout command is admitted.

The [selectors](../../../brain/src/probes/grid_symbols/selectors.json) use
name-free class shapes and normalized use traces. The pinned manifest is
the test oracle. Missing and ambiguous candidates are refused. A complete
renaming of the inert jar model reproduces the same roles. This proves the
tested structural selection, not cross-build behavior or write authority.

The members getter is linked to the insertion body. The document-edit getter
is linked to edit association. Value and boolean wrapper traces follow the
fixed fixture runtime types. The three edit counters use distinct bytecode
use traces; zero values do not identify them. Their runtime meanings still
need the final throwaway-edit stage of 9b.5.

Every live invariant in the tables remains a 9b.5 requirement. In particular,
check descriptor IDs/names, helper initialization, disposed-tree ownership,
selection identity, edit ownership, and engine connection identity. Keep the
E307 project-root/edit-document distinction and E308 detached identity scope.
An offline match does not satisfy any of these live checks.


## E312 doctor-only undo supplement

The original 69 rows and E311 selectors remain unchanged. The 9b.5 doctor
adds three candidates after the local trace in
[E312](../../evidence/experiments/e312-grid-doctor-preparation.md):
`daR.MkF(): cZv` is the undo head, `daR.kG(): boolean` is its availability
predicate, and `daR.wi2(): void` is the journal undo command. The
[supplemental selectors](../../../brain/src/probes/grid_doctor/undo-selectors.json)
resolve by normalized use traces. The combined candidate table has 72 rows
and the same 55 types. The active current-edit getter is not an undo-head
witness after close. [E313](../../evidence/experiments/e313-grid-doctor-undo-failure.md)
tests the candidate path. The direct journal undo call throws because the
relationship insertion hook has no recording edit. Head identity and
availability do not establish that context. The full caller, recording edit,
replay state, and exception cleanup contract belong to
[9b.5a](9b-grid-breadth-discovery-and-build-out.md#session-9b5a--recover-and-trace-the-undo-caller).
The original selectors and candidate report remain unchanged. No complete
live role acceptance or accepted cache exists.


## E315 document Undo correction

[E315](../../evidence/experiments/e315-grid-doctor-document-undo.md) completes
9b.5a's caller trace. The relationship hooks must skip recording while the
document replay flag is set. No new recording edit is required. V20 replaces
`undo-command` with `cZl.OTd(): void` and adds `document-undo-enabled`,
`document-manager`, `journal-replay-head`, and `journal-recording-edit`.
The table has 76 members and 55 types. A two-edge call trace distinguishes
Undo from same-shape Redo. The original 69 selectors and V19 evidence remain
unchanged. Both Undo stages require the exact prior head after return and
independent graph restoration. Exceptions keep the latch; Ghostnote does
not reset native replay state. Live acceptance belongs to
[9b.5b](9b-grid-breadth-discovery-and-build-out.md#session-9b5b--revised-v20-live-doctor).


## E316 live acceptance on 6.0.6

[E316](../../evidence/experiments/e316-grid-doctor-606-acceptance.md)
completes the 76-role V20 doctor on the exact E315 jar fingerprint. Both
document Undo stages and the final owned-edit counter trace pass. All
three scratch tracks are removed; paired control and complete preserved
state match the baseline. The accepted research cache is written only
then. This acceptance covers the fixed fixtures and declared projection.
It does not grant product write authority or accept another Bitwig build.
The separate [9b.6 session](9b-grid-breadth-discovery-and-build-out.md#session-9b6--doctor-on-61x)
owns the 6.1.x result after the operator update audit.


## E331 cross-build refusal on 6.1.4

[E331](../../evidence/experiments/e331-grid-doctor-614-resolver-refusal.md)
compares the unchanged E315 rules with the installed 6.1.4 jar. Only the
layout type (`llL` → `axc`) and source interface (`a` → `led`) pass strict
type selection. The other 53 type roles have no match. All 76 members have
unresolved type dependencies, so no 6.1.4 member table is accepted.

The [diagnostic census](../../evidence/data/phase9b-doctor/614-preparation/diagnosis.json)
records all roles and a boolean-atom ancestor hypothesis. Added fields and
methods explain structural drift; shallow matches do not prove identities
or command behavior. Keep the pinned manifest above as the 6.0.6 record.
[9b.6a](9b-grid-breadth-discovery-and-build-out.md#session-9b6a--resolve-changed-614-structure)
must trace the new types and commands before revising selectors.

## E332 command-contract refusal on 6.1.4

[E332](../../evidence/experiments/e332-grid-doctor-614-command-contracts.md)
traces the project/document/journal Undo chain with a local contract key
that excludes unrelated class members. Cross-method bindings distinguish
Undo from Redo. Eight type roles have trace inputs, not accepted runtime
identities. No complete 6.1.4 member table exists.

The relationship hooks add document-owned set and object/edit operations.
Object disposal adds conditional global tracking with a queue-drain loop.
The recording-edit getter keeps its body but changes access. The diagnostic
refuses these contracts. No original selector or manifest pin changes.
[9b.6b](9b-grid-breadth-discovery-and-build-out.md#session-9b6b--trace-new-ownership-and-disposal-contracts)
must finish the changed contracts, cost model, complete role resolution,
and resilience checks before probe preparation.


## E334 admission boundary trace on 6.1.4

[E334](../../evidence/experiments/e334-grid-doctor-614-admission-boundaries.md)
traces inherited ancestor checks, parent getter declarations and delegates,
and the queued debug tracking command. It does not establish bounded
history or native command non-reentrancy. The complete 55-type/76-member
resolver and all resilience criteria remain in
[9b.6d](9b-grid-breadth-discovery-and-build-out.md#session-9b6d--complete-receiver-contracts-and-admission).
The trace plan is an investigation input. No selector, public tool
description, candidate resource, or deployed probe changes.
