---
id: D65
kind: decision
state: active
updated: 2026-10-25
source: B08 closeout review
---

# D65 — Proved routes run with one readback at the end

## Source and scope

The user set this posture on 2026-10-25, reviewing the staged
`compose_devices` cost after B08:

> I don't think any mid-operation readbacks are worth saving. Our new policy
> is a more relaxed posture around rigor and verification, in favor of
> speedy operation. In general we should rely on thorough live and offline
> testing to prove operations work, but then trust that they do at runtime.
> And, we don't need to be concerned about operators changing things
> concurrently mid-batch — that's generally not how users will use this
> (they will use the agent or make manual edits, not both simultaneously).
> If anything, we could just have one readback at the end of
> `compose_devices`.

This decision amends the runtime half of D15 and the per-stage proof design
that D44 bounded. D15's rules stay for research and tests: a route is
proved by readback through a different handle before it ships, and inputs
are validated before any host call. D54 (recovery is not a prerequisite)
and D53 (ordinary consent) are unchanged. Earlier records stay as history.

## Rule

1. **A route proved in the test and research layer is trusted at runtime.**
   A product tool does not re-prove each host stage of a multi-stage
   operation. Mid-operation readbacks whose only purpose is to confirm that
   a proved stage happened (settled inventories between stages, per-stage
   structure proofs, per-stage fingerprints) are removed.
2. **At most one readback, at the end of a tool call.** A tool that already
   reads its result back keeps one such reading, through a handle other
   than the writer, after its last stage; that reading is the receipt and
   where a failure is reported with the completed effects. This rule caps
   readbacks; it does not add one. A tool whose result has no stable
   reading (`launch_clip`, `show_launcher_clip_in_detail_editor`) or is not
   in the host (`write_midi_file`) stays without one, and a tool that reads
   back only part of its effect keeps that scope. A stage that needs a host
   object to exist before the next stage can address it (an inserted device
   before a write into it) may wait for that object; waiting is not a
   proof.
3. **Concurrent operator edits during a batch are not a design case.**
   Per-stage freshness checks, re-reads that exist to detect a human edit
   between stages, and refusals built on them are not required. Input
   validation against the caller's stated expectation (for example an
   `expectedDeviceOrder` from the last read) stays, because it is cheap and
   catches a stale agent, not a concurrent human.
4. **Rigor lives in tests and E records.** Offline suites, conformance
   cases, call-budget tests, and focused live E records are where a route
   is shown to work. A route without that evidence is not promoted to a
   trusted runtime path by this decision.
5. **Batch where the host allows.** Stages that do not depend on each
   other's results go in one `batch.run`; the time budget of a tool is the
   host's own landing time plus one readback, and D44's unit weights are
   re-derived from that, not from the retired per-stage proofs.
6. **Keep** input validation before host calls (D15 rule 3, a crash
   hazard), target identity (durable IDs, pinned cursors, D43), the D52
   Grid admission gate, selection protection, and truthful partial-effect
   reporting. This decision removes proof work, not correctness checks that
   decide what the write addresses.

## Implementation consequence

`compose_devices` is the first application: insert the container, name the
chains in one stage, insert each device directly into its chain's insertion
point (one batch, no insert-then-move), wait for the devices to land, and
read the container back once. P01 carries the audit of the other staged
paths (`set_device_controls` cohorts, modulation writers, relocation proofs,
clip property captures) under the same rule, and re-weights the D44 limits
from the new measurements. Descriptions, tests, cost budgets, and the ledger
change together. Existing E records that measured the per-stage design keep
their historical values.
