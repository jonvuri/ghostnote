---
id: D54
kind: decision
state: active
updated: 2026-10-24
source: wave-4-recovery-floor
---

# D54 — Recovery is not a prerequisite for requested edits

## Source and scope

The user set this floor during wave 4:

> nearly any loss that is an expected side effect of executing the tool is acceptable, and we generally do not need reversal.

The user also said to keep working machinery unless a simpler design improves
maintenance or performance. D19 must not remain an implicit requirement that
adds work to later implementation sessions.

This decision supersedes D19's blanket requirement for Ghostnote-owned
agent-edit reversal and the mandatory reversal-evidence obligation for every
durable edit. It also supersedes requirements in D16/D17 and the historical
fidelity-floor policy to retain recovery machinery solely to satisfy that
blanket obligation. Earlier records remain unchanged as history.

## Rule

1. A tool must perform its requested effect, with the expected side effects
   of its stated operation. It must not silently perform a broader operation
   because that is easier to implement. Lack of a Ghostnote inverse is not,
   by itself, a reason to refuse a useful supported edit.
2. Normal Bitwig undo, saved projects, and backups are acceptable general
   recovery mechanisms. Ghostnote need not supply transactional undo, a
   single undo step per tool call, or a complete inverse. This is a recovery
   posture, not a new claim that every host path is undoable or backed up.
   The operator performs host undo. The extension's research-profile
   `app.undo` method is not a normal tool; wave-4 W4-024 keeps this
   operator-only default and names a guarded tool as a later option.
3. Remove or simplify reversal preparation, records, or gates when a selected
   session shows a maintenance or performance benefit. Do not weaken working
   behavior merely to reach this floor. New capabilities need no bespoke
   reversal implementation solely because D19 previously required one.
4. Keep target identity, input validation, completion and partial-effect
   reporting, and the checks needed to perform the intended edit correctly.
   A full reversible stash is not required for an honest execution receipt.
   Do not automatically repeat an uncertain write.
5. Keep broad regression and upgrade evidence in the test/research layer
   where it need not run on every product call. D15 remains the current
   independent-readback rule. A proposed per-tool change to that rule must
   identify the claim, retained evidence, and amended obligation explicitly.
6. Existing reversal tools must keep their advertised behavior until a named
   implementation session changes or retires them. D49 still governs their
   truthful results. Native host transaction/journal mechanics, D52 admission,
   and scratch-test cleanup are not removed merely because they mention undo.

## Implementation consequence

The [performance session](../plan/overlap/wave-4/work-sessions.md#p01--edit-path-performance-and-recovery-cost)
will separate correctness checks from recovery-only work. It can simplify
D19-related product machinery within this policy when a concrete benefit is
established. It must update affected tools, descriptions, tests, and cost
models together. Do not ask the user to authorize this policy again.

No runtime code changes in this decision session. Current tool counts,
reversal outputs, pressure warnings, and exact-build admission stay as
implemented. Full history-retention research is deferred unless evidence
shows a performance or maintenance problem.

## Meaning of expected side effects

Deleting a track removes its contents. Deleting five specified notes does
not, by that operation's meaning alone, authorize loss of other notes'
expression. Knowing that an implementation can cause extra loss does not
make that loss part of the requested operation. An existing explicitly
accepted lossy route retains its stated contract; this decision neither
withdraws it nor expands its loss allowance.

The [concrete examples](../plan/overlap/wave-4/remaining-decisions.md#examples-for-functional-equivalence)
separate clear cases from choices still needing the user's judgment. Resolve
those choices when the relevant capability is implemented. Do not impose a
new universal exact-restoration requirement through preservation wording.
