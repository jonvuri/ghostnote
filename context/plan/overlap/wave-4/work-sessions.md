---
title: Selected research and cleanup sessions
kind: plan
state: planned
updated: 2026-10-24
---

# Selected research and cleanup sessions

The user selected this split. These are explicit future sessions, not work
performed during this planning turn. They support the V01–13 templates; they
do not all have to finish before V01. Keep one live writer and the normal
operator deployment/admission procedure when a later session reaches host
work. [D54](../../../decisions/d54-recovery-is-not-a-prerequisite-for-requested-edits.md)
is the recovery policy for all sessions.

| Session | Scope | Position |
|---|---|---|
| P01 | Repeated parameter inventories, full clip captures, and useful D19 simplification | Start with early MIDI/device workflow work; first audit offline |
| R01, expanded | Producer Pal comparison, dense claims/overlays, and format naming | Existing format session with V01/02; current notation is the default |
| C01 | Confirm and retire obsolete `stable-v1` machinery | Independent cleanup; before the small release if useful |
| I01 | Track internal-host dependencies and plan whole-tool refusal | As W4-D maps tools/routes; enforce for each new internal capability |

T5 full change-record retention/cloning research is deferred. Do not schedule
a long-session memory benchmark or retention redesign by default. P01 may
follow a specific trace or maintenance dependency into that code if evidence
shows it is a real cost. This is not permission to expand the entire audit.

## P01 — Edit-path performance and recovery cost

DIET updates the documentation that prescribes checks; P01 examines their
runtime implementation. Apply the [current maintenance policy](../../../README.md#maintenance)
when an inherited plan prescribes a capture or recovery step. Retain the
required outcomes and assess whether the mechanism earns its cost.

**Inputs:** [T1/T2/T6](simplification.md), D54, D15, D38, D49, D52, the
[performance ledger](../../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md), and
current executor, adapter, write-set, stash, and surface code. Reuse E247,
E252, E253, E257, and [E353](../../../evidence/experiments/e353-scrollable-container-scopes-product-live.md)
traces before collecting new measurements.

**Questions:** which inventories/captures are needed to identify and execute
the requested edit? Which exist only to construct a later reversal? Can one
fresh preflight or independent post-write capture serve multiple checks?
Does adding an operation require inverse, label, ownership, or reporting
work that the product no longer needs?

**Work:**

1. Trace a scalar device edit, a clip-property edit, and a targeted note
   edit. Include a destructive operation if it exposes capture with no useful
   recovery, such as container deletion. Count calls, waits, data volume,
   and code paths; distinguish historical measurements from current traces.
2. Label each step: identity/input validation, requested result, collateral
   preservation, concurrency, recovery only, or shared. Do not remove a
   shared capture because its variable happens to be named `stash`.
3. For T1, test sharing stable inventories and narrowing deletion capture.
   Preserve target identity and required coupling checks. For T2, distinguish
   name/colour changes from loop/range edits that can affect content.
4. Under D54, remove recovery-only requirements from a selected path when
   benefit is concrete. Compare direct effect receipts with full takes where
   relevant. No new inverse is required for a new capability. Do not silently
   break existing `revert_change`; either retain its path or explicitly retire
   the affected promise, including descriptions and callers.
5. Retain broad invariants in regression and version-upgrade tests even when
   they need not run on every product call. D15 is still the current product
   readback rule. If a specific optimization needs to change it, state that
   exact claim and evidence boundary; D54 alone does not waive it.
6. Implement and verify the bounded improvements justified by the audit.
   If a route needs new host evidence, prepare a focused live check. Keep
   native journal/transaction operations distinct from agent history: they
   can be required for the host command itself. Do not strip D52 guards.
7. **Container-scope read policy (B08, E353).** A structure read of a track
   aims a scope at every device past position 2 in turn, containers or not,
   and the highest-slot choice sends scope 2 back to position 2 on every
   read (six devices: four scrolls, about 115 ms each). Adopt both cheaper
   policies: skip the scope for a device whose top-level entry shows no
   layers (`hasLayers` is already marked on every scope slot; add it to the
   `device.list` row or read it from the resting scope), and rotate the far
   scopes so the last-used far positions stay settled across reads. Then
   assess the window shape with the same traces: whether three one-wide
   scopes is the right count once `read_devices` only aims at containers,
   and whether a resting position other than `s` serves the common
   project better. Measure before and after on the E353 scratch shape and
   update the ledger `containerScope` rows.
8. **Staged `compose_devices` under D55 (first application).** Per native
   device the staged path pays about 3.5 s each way (E252): the insertion
   landing (about 1 s) and the move are the host's; the rest is per-stage
   readback (a settled DirectParameter inventory before and after the move
   for the scalar fingerprint, the container structure proof, the
   remote-control page checks). Rebuild the path as: insert the container
   (and position it), name the chains in one stage, insert every device
   directly into its chain's `endOfDeviceChainInsertionPoint()` in one
   `batch.run` (no insert-then-move; the chain scopes already expose the
   insertion points that `chain.move` uses), wait for the devices to land,
   and read the container back once through the scope. Prove the direct
   chain insertion live first (an E record on a scratch track: native,
   VST3, CLAP, preset), since a wrong insertion point is a silent no-op.
   Then re-derive the D44 unit weights from the new measurements (E254
   already showed 2 devices with 2 container modulators at 12.4 s after
   D46; the `write-limits.ts` comment still describes the retired behavior
   sampling) and lift the 6-unit bound to whatever the landing time
   supports. The same rule then goes over `set_device_controls` cohorts,
   the modulation writers, relocation proofs, and clip property captures:
   one readback at the end of each call. Descriptions, tests, cost budgets,
   and the ledger change together.

**Acceptance:** a call/obligation table, measured or source-supported benefit,
a retain/remove/share verdict per step, relevant behavior tests, updated
cost budgets, and independent live checks for changed host behavior. Exercise
wrong targets, concurrent edits, failed readback, and partial completion.
Keep fixture cleanup separate from product recovery promises. Name any
remaining limit instead of launching another broad audit.

A guarded agent-facing host undo tool is a named option only if workflows
show the operator repeating undo for agent edits; W4-024 keeps operator-only
undo as the default.

**Exit:** changes are concrete and reviewable, or a specific unresolved route
has a bounded next probe. No claimed speedup without comparable measurements.
A demonstrated maintenance reduction can justify a change without a runtime
speedup. Do not treat D19 as a hidden gate or re-request its policy retirement.

## R01 — Formats, claims, and public naming

Extend the [existing R01 brief](workflow-sequence.md#r01--producer-pal-notation-comparison).
Keep Ghostnote's current FIELDS/JSON notation by default. Compare bar|beat,
MIDI JSON, Stark, and transforms as possible authoring surfaces or sources of
specific improvements. No default format replacement is selected.

Add dense claims/overlays (T3) to the same analysis:

- Separate actual note/clip data, identity and stale-edit guards, and musical
  interpretation metadata. Preserve the first two when evaluating the third.
- Attribute basis sealing, dependency expansion, validation, and projection
  costs using E253/E256 and representative fixtures. Compare small realistic
  documents as well as admitted extremes. No-claim calls already skip sealing.
- Compare keep/optimize/optional/external options for claims. Include the cost
  of changing a tested format and whether Ghostworks or an agent needs the
  metadata. Do not assume that external analysis requires deleting annotations.
- Prepare and run bounded offline comparative tests for promising candidates;
  record fidelity, edit semantics, instruction/token cost, and failures.
  Host binding claims need separate host evidence.
- Propose a short public format name. Separate a display/package rename from
  schema IDs, file extensions, or a breaking version change.

**Acceptance:** per-format capability/loss table, claims cost/ownership verdict,
examples and test results or a ready test brief where more setup is needed,
and naming options. Retaining the current notation is a successful outcome.
Do not add a new format or migrate callers without the resulting selection.

## C01 — Audit and retire stable-v1

**Inputs:** D40, E272, Phase 10 retirement scope, profile registries, server
instructions, historical drivers, frozen tests, and the normal tool wrappers.
The intent is removal after confirming the old machinery has no distinct
current requirement. This is not just a review with no follow-through.

1. Inventory every selectable profile, default, CLI/environment option, old
   result schema, operation handle, musical patch path, and profile-specific
   behavior witness. Identify active callers and code reused by normal tools.
2. Confirm the Phase 8i rollback period is complete. For shared code, retain
   or relocate the implementation before removing old registration. A normal
   wrapper importing an old module is a migration task, not proof that the
   obsolete public profile must stay.
3. Remove `stable-v1` selection and exclusive runtime machinery. Make old
   configuration fail clearly or give a documented migration path. Remove or
   update obsolete tests while keeping live host-trap coverage. Preserve
   historical E/D records, raw fixtures, and source evidence.
4. Update current probe/CLI consumers deliberately. Do not rewrite historical
   results to look as if they ran on the new profile. Retain an offline fixture
   or clearly archived driver where needed to interpret old evidence.
5. Update tools, instructions, public artifacts, counts, and versions where
   affected. Run normal profile/schema/wire checks and relevant tests. After
   deployment and operator replacement, run `probe:hello`; run focused live
   checks if the shared runtime path changed.

**Acceptance:** an audit disposition for every old-only entry, no advertised
or selectable `stable-v1`, normal tools and current drivers work, no accidental
loss of shared behavior, and a short migration note. If a distinct current
need is found, name it and revise that bounded part before removal. Do not
block retirement on hypothetical users of an unpromised legacy surface.

## I01 — Internal-host dependency register and refusal boundary

Use [host-access.md](host-access.md) as the initial class register. This is a
capability mapping task within W4-D, not a new general platform project.

1. Trace each advertised tool and selected future tool through its required
   routes, shared initialization, and admission checks. Record per-tool or
   argument-dependent variants, not only broad classes. Mark untraced entries
   unknown; do not infer public access from a public-sounding tool name.
2. Classify primary controller, required internal-host, conditional internal,
   offline/local, or diagnostic. Separate host API access from preset-file
   parsing. Record dependency evidence, tested build, refusal behavior, and
   proof of primary-only operation.
3. If any required internal dependency is unavailable, refuse the entire
   requested tool before its first mutation. Do not execute a public subset
   or substitute a lossy route silently. Keep support diagnostics available.
4. Isolate optional initialization and negotiate capabilities so internal
   failure does not block independent primary tools. Prove this with failure
   injection and the focused host tests needed by the implementation.
5. Distinguish preflight refusal from failure after mutation starts. On the
   latter, stop, report applied/uncertain effects, and keep required locks.
   There is no general rollback or all-or-nothing claim under D54. Separate
   tool calls are not one transaction.

**Acceptance:** each shipped/selected tool has an access classification and
source; known unsupported internals cause a pre-write whole-tool refusal;
primary and diagnostic behavior is tested independently. Unknown planned
routes remain explicit research questions. Extend this register whenever a
new route changes a tool's dependency class.
