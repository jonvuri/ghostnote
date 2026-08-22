---
id: E59
kind: evidence
state: active
source: phase-4-session-4g-managed-fx-chain
---

# E59 — Managed FX-chain workflow is live [K] (2026-08-22)

**Verdict: one managed workflow composes mixed-format insertion, parameter
control, device enabled state, relocation, and exact owned-device reversal. It
uses each last accepted complete name-and-enabled chain as the next mutation
boundary.**

## Managed boundary and checkpoint

The workflow uses a small orchestration layer above the executor. It appends one
device, reads the complete chain, and records the address that Bitwig minted. It
then resolves parameters from that accepted observation. If the requested
position differs, it relocates the appended device before a confirmed anchor.
It never predicts an address from the requested order.

Each structure, parameter, and enabled-state mutation carries the prior accepted
complete top-level device-name and enabled-state sequences. The adapter refuses
an incomplete bank before a managed write and a full bank before insertion. It
also refuses when either sequence changes before the mutation. It does not
create a fresh expected value from the same read that performs the write.

The checkpoint retains both the minted address and the current address from the
last accepted complete observation. Mint provenance records what the insertion
created. The current address is the only position used for later writes and
reversal. This distinction is required because a managed relocation makes the
minted position stale.

The take reports these promises:

- An inserted device reverts by deletion at its current observed owned
  position.
- A scalar parameter or enabled-state change restores the entry base value, or
  disappears when reversal removes its owned inserted device.
- Deletion of a device that existed before the take remains `none`.

## Mixed-chain proof

The focused probe creates one owned scratch track in project `26.05-2 moon`.
It seeds `Tool` and `Delay+`, then inserts a native Polysynth, Zebra3 VST3,
Zebra3 CLAP, and a Sampler preset file. The final observed name sequence is:

```text
Tool, Polysynth, Zebra3, Zebra3, Delay+, Sampler
```

Append readback mints positions `2, 3, 4, 5`. Managed relocation produces
current positions `1, 2, 3, 5`. Each inserted device receives one independently
verified parameter write. The native device uses `OSC1 Pulse Width`. The preset
uses exact DirectParameter ID `CONTENTS/TRANSPOSE`, which Bitwig displays as
`Pitch Transpose`. Both Zebra3 formats use exact DirectParameter ID
`CONTENTS/PID111`, which Bitwig displays as `Attack Rate`. The workflow also
changes the entry `Delay+` enabled state and records its exact before and
readback values.

The report separates failed writes, non-taking writes, and warnings. Parameter
warnings include modulation or automation state observed before or after the
write. The live workflow expects no failed or non-taking scalar write.

## Refusal and recovery proof

An incomplete device bank refuses before the host receives an apply request.
The concurrent-edit case appends one owned Polysynth. A second adapter then
inserts `EQ+` and moves it before that Polysynth. The stale scalar address would
now point at `EQ+`. Guarded executor acquisition refuses the parameter before
the write. An independent read confirms that the shifted Polysynth value did
not change.

The failure returns a recovery handle for the last proved managed boundary. It
does not claim the unrelated `EQ+`. After exact sentinel cleanup restores that
boundary, retry deletes the owned Polysynth and restores the entry chain. A
failed reversal follows the same rule: it returns the last proved continuation
instead of replaying a mutation whose landing state is uncertain.

Normal reversal restores the entry `Delay+` enabled state first. It then
deletes owned devices from the highest current position to the lowest. This
restores the exact two-device entry chain even though the owned current
positions are not the append positions.

## Identity limit

The complete name-and-enabled fingerprint detects position shifts, name
changes, and enabled-state changes. It is not device identity. Replacing one
device with another device that has the same name and enabled state remains
indistinguishable. The managed workflow fails closed on every difference it can
observe and does not claim that this residual case is solved.

## Cleanup and verification

The probe reverses the managed take, removes only its two seed devices and its
owned track, and restores the entry selection. It also confirms the accepted
track baseline after cleanup.

Focused adapter and managed-workflow tests pass 108/108. Shared fake
conformance passes 60/60. The full brain check passes 750/750, including
typecheck. Extension tests pass. The fresh Bitwig 6.0.6/API 25 handshake passes
all 147 methods with hash `f58c5ded93d5f743`. The managed live proof passes all
ten rows. Full live conformance passes 54/54 with six expected skips.
Conformance cleanup removes its two generated fixture tracks. The final
read-only 2k baseline passes with seven tracks and no launcher residue. Context
check passes for 199 active documents. Working-tree and staged diff checks pass.

## Retrospective

Dependent minted-address work needs a small orchestration layer. The static
executor cannot derive later operation addresses from insertion readback in the
same precomputed write set. The layer remains small because it delegates each
read, guarded apply, take, and report to the existing host seam.

The important recovery object is the last accepted complete observation, not
the original minted position. Preserve mint provenance for ownership, update
current positions only after exact proof, and return the last proved
continuation after a failure. Use distinguishable fixture devices when cursor
identity must be unique. No context-process change is needed.
