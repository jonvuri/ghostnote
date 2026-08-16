---
id: E30
kind: evidence
state: active
source: phase-1-session-5d-concurrent-editing-third-attempt
---

# E30 — Owned cleanup needs a host-normalized fingerprint [K] (2026-08-16)

**Verdict: the third 5d attempt stopped during setup. Bitwig readback added
note properties that were absent from the sparse write recipe. The strict
cleanup comparison refused both owned clips. Phase 1 exit criterion 2 remains
unproved.**

## Live result

The standing probe confirmed all 10 durable track identities, the project and
scene windows, the exact empty observation record, and the stopped transport.
It selected zero-based row 9 on `gn-B`, `gn-lay`, and `gn-lay4` after live
readback found all three cells empty.

The probe created a target clip on `gn-B` and a drag clip on `gn-lay`. It wrote
one identifying note to each clip. Independent readback found both notes with
the requested start, pitch, velocity, and duration. It also found the same
host-supplied values on each note: release velocity `100 / 127`, four enabled
state flags, and recurrence `[1, 1]`.

The stored cleanup fingerprints contained only the four requested note fields.
`canonicalNotes` compares the complete serialized records. The first exact
fingerprint check therefore failed before the human prompt and production
write window. No concurrent-editing claim was measured.

## Cleanup

Automatic cleanup refused both clips because it used the same sparse stored
fingerprints. This was the safe result for the current comparison rule.

A directed cleanup compared each complete live note record with the record from
the failed probe output. It then deleted only `gn-B` row 9 and `gn-lay` row 9 by
durable identity. Final readback found those cells and `gn-lay4` row 9 empty.
It found selection at track 0, row 1, the exact empty schema-v1 observation
record, and the transport stopped. The final mark was revision 515, scene epoch
2, and content epoch 302. No probe residue remains.

## Decision impact

The E29 early-registration repair stores a write recipe, not the complete form
that independent readback returns. A focused repair must keep cleanup safe from
clip creation through setup and must promote verified host-normalized readback
to the exact cleanup fingerprint. It must also refuse added notes and changes
to authored fields.

Run the human 5d proof again only after the focused repair passes offline and
live. This attempt does not change D6 or D15.

## Retrospective

A cleanup fingerprint must distinguish the sparse write recipe from the exact
host-normalized readback. No repository instruction change is needed.
