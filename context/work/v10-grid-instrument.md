---
title: V10 — Grid instrument (former Phase 11 design)
kind: brief
state: queued
updated: 2026-10-24
---
# V10 — Construct a useful Grid instrument (Grid authoring design)

**Item:** [V10](../BACKLOG.md), band P3, with [V11](../BACKLOG.md) for the
wave-two extensions. This brief carries the design detail of the former
Phase 11 plan so it is not lost when the phase model is retired. Its sessions
11a to 11e are the sub-items of V10. The wording below is the former plan,
adjusted for D54 and W4-024; it is not yet trimmed to the plain brief register.

## Purpose

Turn the Grid research result of Phase 9 into product tools on
`agent-native-v1`. An agent can read a Grid patch, add and delete modules,
set values, connect cables, and add or remove knob modulation mappings. Each
write is gated by the D52 admission record for the exact Bitwig build.

This is the build-out plan that
[9b step 3](../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#step-3--build-out-planning)
asked for. The operator settled four points in that session:

1. The build-out is a new phase, not 9c.
2. **Wave one adds no obfuscated symbol.** Every native member it uses is one
   of the 76 roles that the doctor accepted on 6.0.6 and 6.1.4. Later
   symbols are justified by a named verb and batched into one new doctor
   version and one consented pass.
3. A new module goes to a free column, or to an explicit position. The write
   refuses when the simulated native layout pass would move an existing
   module. Relocation of an existing module is the first wave-two item.
4. Mapping add and remove are in wave one. An amount change is a remove and
   a re-add in wave one; the mapping gets a new identity.

## Sources

Read these before any session:

- [E299](../evidence/experiments/e299-grid-spike-close-out.md): the 9a
  verbs and their limits.
- [E310](../evidence/experiments/e310-grid-factory-acceptance-and-breadth-close.md):
  the breadth verdicts, with E302 and E304 for the catalog, families, scale,
  and read costs.
- [E316](../evidence/experiments/e316-grid-doctor-606-acceptance.md),
  [E342](../evidence/experiments/e342-grid-doctor-614-acceptance.md),
  [E343](../evidence/experiments/e343-grid-admission-gate-and-upgrade-tool.md),
  [D52](../decisions/d52-grid-upgrade-admission-policy.md), and
  [D53](../decisions/d53-ordinary-operator-consent.md): the admission
  gate and consent.
- [Symbol manifest](../plan/phase-9/9b-grid-symbol-manifest.md) and
  `DOCTOR_ROLES` in `brain/src/grid/admission.ts`: the admitted symbol set.
- [Native attachment design](../plan/phase-9/9a-native-attachment-design.md): the
  layout pass model and the failure-state table.
- [Performance ledger](../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#phase-11-grid-authoring--model-before-implementation):
  the cost model of this phase.
- [D15](../decisions/d15-verification-discipline-settled-2026-07-25.md),
  [D21](../decisions/d21-musical-patch-and-public-tool-grain.md),
  [D44](../decisions/d44-long-writes-are-optimized-then-bounded.md),
  [D54](../decisions/d54-recovery-is-not-a-prerequisite-for-requested-edits.md):
  readback, tool grain, write bounds, and the recovery floor. Grid writes
  are new capabilities and record no inverse ([W4-024](../plan/overlap/wave-4/decisions.md#w4-024--grid-writes-record-no-inverse-operator-undo-is-the-recovery)).

## Scope

| Verb | Wave | Proof it rests on | Remaining check |
|---|---|---|---|
| Read modules, values, layout, cables, mappings | 1 | E276, E304 reads; read roles in the doctor | A product projection in one bounded capture |
| Set a decimal value | 1 | E277, doctor value case | Domain validation on arbitrary atoms |
| Set a boolean value | 1 | E308, doctor boolean case | None beyond the product guards |
| Connect, disconnect, retarget a cable | 1 | E279, E280, doctor cable case | Port validation on arbitrary modules |
| Add a module by catalog type | 1 | E283, E289 factory and attachment; E310 Gates factory | Generalized layout admission; one live check on a larger patch |
| Delete a module | 1 | E281 (incoming cable removed) | Outgoing consumers: Ghostnote disconnects them first; one probe |
| Add and remove a Grid-internal mapping | 1 | E308, doctor mapping case (remove and restore) | One probe on a source and target pair with no prior mapping |
| Change a mapping amount | 1, as remove and re-add | Same | Public amount scale from the domain extent |
| Relocate an existing module | 2 | Position getters only | New setter and edit symbols; doctor version 2 |
| Integer and indexed values | 2 | E304 reads of 828 and 457 | A setter trace; possibly new symbols |
| FX Grid and Note Grid writes | 2 | E302 same-container reads | One write probe per flavour |
| Attach a stateful type (Gates) | 2 | E310 detached factory | Attachment guards for a 236-object tree |
| Resource loading (Sampler, Audio File, Wavetable), array data writes, outer modulators, patches over 64 modules, DSP or audio claims | Out | — | Recorded limits |

Wave one supports **Poly Grid** writes. Reads cover all three flavours
because they share the `module_grid` container (E302). FX and Note writes
need one probe each because their I/O module sets differ.

## Policies

### Admission and symbols

- Every write tool calls `requireGridWriteAdmission` before its first host
  call. A refusal returns the gate's reason and the operator steps that
  `check_grid_support` reports.
- A test asserts that the product Grid symbol set is a subset of
  `DOCTOR_ROLES`. Wave one must keep this test green without changing the
  role list.
- A wave-two session that needs a new member follows the 9b.3 pattern: trace,
  selector with shape and invariant, manifest row, Java harness test, doctor
  case. It adds the role to `DOCTOR_ROLES`, which makes the current accepted
  records incomplete. The session then runs one consented doctor pass on the
  current build. Batch all new symbols of a wave into one doctor version.

### Target and identity

- A Grid device is addressed by durable track ID and top-level device
  position from `read_devices`, the same as other device tools. The tool
  finds `module_grid` by descriptor name under the device contents, not by
  the fixture's child index. A device without that container refuses.
- A module is identified by its loaded module UUID from the read. These
  UUIDs are document-scoped and change on reload (E276). A write validates
  the UUID against a fresh pre-command capture. A module added in the same
  call is referenced by a caller-supplied label.
- Module type comes from the catalog (65 UUIDs, 89 observed aliases in
  [`catalog-updated.json`](../evidence/data/phase9b-focused/catalog-updated.json)).
  The public name is a canonical alias chosen in 11a. An unknown name
  refuses. Editable instance names are route checks, not identity.

### Layout and placement

- The write reads x, y, width, and height of every member (at most 64) and
  simulates the native layout pass with the E284 model, generalized from
  five rectangles to the admitted member count.
- Default placement is the first free column to the right of the maximum
  right edge, at the row of the source module when the call also connects
  the new module, otherwise row 0. The caller can pass an explicit position.
- The write refuses with `layout-would-move` when any predicted rectangle
  differs from its input. It does not search for another position.
- The predicted rectangles are reported, and the readback checks them.

### Delete and consumer cleanup

- E281 proves that the native delete removes the incoming cable of the
  deleted module. It does not prove cleanup of cables into other modules.
- The product disconnects each outgoing consumer with the proved null-source
  setter before the native delete. Each disconnect has its own readback. The
  delete then runs on a module with no outgoing cable. The report lists the
  disconnected consumers.
- 11c runs one probe that deletes a module with an outgoing cable natively on
  a scratch track and records what the host does. The explicit pre-disconnect
  stays the product rule either way; the probe only decides whether a
  surviving dangling edge is a possible state to refuse on.

### Mapping and amount

- A mapping source must be an atom of a Grid member. A source outside module
  membership (E304 found four) refuses as `source-outside-grid`.
- The native amount is in domain units (129 in the E304 example). 11d reads
  the domain extent of the target with the proved extent getter and defines
  a public amount as a signed fraction of that extent. The description
  states the unit. The write checks that the native amount is inside the
  extent before the command.
- Add uses the proved restore command with explicit amount, enabled flag,
  and transfer function. Remove uses the proved removal command. The native
  command appends; other mappings keep their order and identities.

### Failure handling and recovery

- Keep the write lock, the uncertain-state latch, and the no-retry rule for
  every native command. A timeout latches uncertainty and stops writes; it
  never converts to success. The E284 failure-state table applies to
  attachment. Never dispose a detached object after insertion was attempted.
- Every command has a pre-command capture and a paired independent readback
  (D15). A writer receipt is not readback.
- Grid writes record no inverse and offer no `revert_change` path (D54,
  W4-024). The change record is an execution receipt: the operations
  requested, the operations completed, and their independent readback.
  The operator recovers with Bitwig undo, a saved project, or a backup;
  E277 and E279 show one host undo step reverses one native command.
  Document undo remains a research check in the doctor.
- After uncertainty the operator inspects or restarts the host. The tool
  does not save.

### Limits

- At most 64 modules per Grid; a larger patch refuses with the count.
- At most 16 operations per write call (D44). A call stops at the first
  failed operation and reports the completed ones in its receipt.
- One owned detached tree at a time, at most 256 objects and depth 12.
- One bind per call, released at the end. Claims do not survive a call.
- The 48 MiB temporary-host planning allowance stays a planning figure.

## Tool surface

Under D21 a new tool needs a distinct permission class or object boundary.
Three tools result:

| Tool | Kind | Purpose |
|---|---|---|
| `list_grid_module_types` | read, offline | The canonical catalog: type UUID, public name, aliases, flavour availability, known parameter names |
| `read_grid_modules` | read | One Grid device: members with type, name, position, size, stored values with domains, ports, cables, mappings, and the admission standing |
| `edit_grid_modules` | write | An ordered list of operations on one Grid device: `add_module`, `delete_module`, `set_value`, `connect`, `disconnect`, `add_mapping`, `remove_mapping`. Calls `requireGridWriteAdmission` first. One receipt per call; no inverse |

Final names pass the vocabulary test; the step-grid meaning of "grid" in
clip tools (D9) is the reason for the `_modules` suffix. Descriptions bump
`TOOL_DESCRIPTION_VERSION` in the session that adds each tool, with the
[tool maintenance checklist](../README.md#tool-maintenance). The profile
grows from 45 to 48 tools; `check_grid_support` updates its description from
"no Grid write tool yet" in 11b.

Extension side: the probe-only `probe.grid*` methods stay for research. The
product gets normal-profile wire methods (working names `grid.read`,
`grid.bind`, `grid.apply`, `grid.release`) with write-gate classification,
and the fixed-fixture guards of `GridProbeSafety` and
`GridAttachmentLayout.admit` are replaced by generalized guards. The
research drivers keep working.

## Cost model

The [ledger section](../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#phase-11-grid-authoring--model-before-implementation)
holds the model. In short: a read is one mark and one bounded capture
(about 50 ms wire, under 15 ms document on a 31-module patch); a write
operation is one pre-command capture, one command, and two readbacks, so a
one-operation call is about seven wire calls and under 300 ms, and the
16-operation maximum stays under 4 s. Each session measures its path and
records the numbers.

## Sessions

Each session follows the implementation-session rules in
[AGENTS.md](../../AGENTS.md). Live work uses muted scratch tracks in the
operator's chosen project and leaves `grid-probe` unchanged. Each session
ends with an E record, the ledger rows it measured, and clean preserved
state.

### 11a — Product Grid read and catalog

Inputs: E276, E302, E304, `GridGraphRead`, `GridBreadthRules`, the catalog.

1. Add `grid.read` to the normal profile: one document task, one capture,
   a fixed product projection (members, type, name, rectangle, atoms with
   stored value and domain, ports, cables, mappings with source, target,
   amount, enabled, transfer). Keep the 4,096-work, one-second, 64-module,
   256-child, and 1 MiB caps. Find `module_grid` by name.
2. Build the canonical catalog from the 65 observed UUIDs and aliases. Pick
   one public name per type; keep aliases. Record parameter names and
   domains observed in E304 where known.
3. Add `read_grid_modules` and `list_grid_module_types`, descriptions, the
   call-budget rows, and the subset test against `DOCTOR_ROLES`.
4. Live: measure the read on the four-module fixture, WT Parkour (19), and
   Grid Multi FX (31) in all three flavours where a preset exists. Compare
   with E304 wire and document times.

Acceptance: paired reads agree on each fixture; the 83-module Stutter Steps
refuses with its count; descriptions bump; offline tests and budgets pass.

### 11b — Values and cables

Inputs: E277, E279, E280, E308, the doctor value, boolean, and cable cases,
`GridFixtureValue`, `GridFixtureCable`, `GridBreadthCommands`.

1. Add `grid.bind`, `grid.apply`, and `grid.release` with the write lock,
   latch, pre-command capture, and paired readback per operation.
2. Add `edit_grid_modules` with `set_value`, `connect`, and `disconnect`.
   `connect` to an input with a source is a retarget. Validate domains,
   ports, and member identity against the pre-command capture.
3. Execution receipts without inverse operations; `revert_change` and
   `check_revert` refuse Grid changes with a plain reason; `readbackStatusOf`
   cases.
4. Update `check_grid_support` and bump descriptions.
5. Live on a scratch Poly Grid loaded from a stock preset: set and restore
   values, connect, retarget, and disconnect. The operator checks one host
   undo step on one write. Measure.

Acceptance: every write has independent readback; a refused admission sends
no host call (test on the stub bridge); budgets and the D44 bound hold.

### 11c — Add and delete modules

Inputs: E281, E283, E289, E310, the attachment design, `GridDetachedFactory`,
`GridModuleAttachment`, `GridAttachmentLayout`.

1. Generalize layout admission to the admitted member count and the
   placement rule above. Keep checked arithmetic and the rectangle bounds.
2. `add_module` by catalog type with optional position, name, and label;
   `delete_module` with explicit consumer disconnects.
3. Probes before product live use: native delete with an outgoing cable;
   attachment on a 19-module patch with the predicted no-movement layout;
   a factory type other than Amplify from the stateless families.
4. Live: build a small patch in one call (add, connect, set values), read it
   back, then delete it. Measure.

Acceptance: the layout prediction equals the readback on every attached
module; delete leaves no dangling cable; no detached object remains after
any failure path in tests.

### 11d — Mappings

Inputs: E304, E305, E308, the doctor mapping case.

1. Read the domain extents of representative targets and define the public
   amount scale.
2. `add_mapping` and `remove_mapping`; refuse sources outside membership.
3. Probe: add a mapping between a source and target with no prior mapping
   on WT Parkour or SEMtex; remove it; check both endpoint lists.
4. Live: the probe pair and an amount change as remove and re-add.

Acceptance: endpoint lists change only by the named mapping; the amount
round-trips through the public scale; descriptions state the unit.

### 11e — Acceptance, documentation, and cost

1. Ledger rows for every tool path; a comparison with the research numbers.
2. Capability record, PROJECT and interface tool counts, descriptions
   artifact, migration contract.
3. One end-to-end dogfood: from an empty Poly Grid, build and read back a
   playable patch of about ten modules with one mapping. An operator
   listening check is optional and uses the E296 style if run.
4. Close wave one. Record limits. Plan the wave-two doctor version.

### Wave two (planned, each conditional on its probe)

- **11f — Relocation.** Trace the position setter used by the insert body
  and the edit wrapper it needs. Add the roles, doctor version 2, one
  consented pass on the current build. Then `move_module` in
  `edit_grid_modules`, with the same refuse-on-overlap rule.
- **11g — Integer and indexed values.** Trace the setter family of fields
  828 and 457. Batch any new role into the 11f doctor version where the
  schedule allows.
- **11h — FX Grid and Note Grid writes.** One write probe per flavour on
  the existing commands; no new symbol expected.
- **11i — Stateful attachment.** Gates attachment with the generalized
  guards; array data writes stay out until a setter is traced.

## Exit

Wave one exits when the three tools are on `agent-native-v1`, every path has
a ledger row, the subset test against `DOCTOR_ROLES` passes, the dogfood
patch is built and read back, and E records cover 11a through 11e. The
wave-two items stay planned sessions with their probes named.
