---
id: E32
kind: evidence
state: active
source: phase-1-session-5d-concurrent-editing-fourth-attempt
---

# E32 — Pinned writes survive human clip and track edits [K] (2026-08-16)

**Verdict: Phase 1 exit criterion 2 is met. All 40 production writes landed on
the pinned target while the operator moved another clip and selected clips on
four tracks. The executor borrowed selection once and restored it once.**

## Live result

`probe:5d-concurrent` confirmed all 10 durable track identities and the
documented project, row, observation, transport, and selection baseline. Live
readback claimed three empty row-10 cells. The probe created its write target on
`gn-B`, its drag clip on `gn-lay`, and reserved `gn-lay4` as the destination.
An independent cursor promoted both cleanup fingerprints before the human
window.

The production executor applied and verified 40 note writes. The operator moved
the drag clip from `gn-lay` row 10 to `gn-lay4` row 10 and made five selections
outside the write target and home cell across four tracks. The selection monitor
observed every counter change. It recorded one arrival at the write target and
one final arrival at the home cell.

Independent readback found all 40 requested note identities and non-zero pan
values on `gn-B` row 10. It found no target write on the moved clip and no change
on a non-probe clip. The executor reported the drag as one empty event for the
durable `gn-lay` identity and one filled event for the durable `gn-lay4`
identity.

## Cleanup

Revert restored the exact host-normalized target fingerprint through the
independent cursor. Automatic cleanup removed the moved drag clip and the write
target. It restored the pre-probe selection to track 0, row 1 and preserved the
exact empty schema-v1 observation record. The initial transport check was
stopped, and the probe did not operate the transport. No directed cleanup was
needed.

## Verification

- Human-assisted live proof: 16/16.
- Full offline check: 540/540, with typecheck green.
- Context check: 150 active documents and all links pass.
- `git diff --check`: pass.

## Decision impact

D6, D10, and D15 are unchanged. The result closes Session 5d and Phase 1 exit
criterion 2. Session 5e is next.

## Retrospective

The standing probe gave the operator exact source, destination, and exclusion
cells. No repository instruction change is needed.
