---
title: Final Claude run stops on an incomplete read
kind: evidence
state: pending
updated: 2026-09-30
phase: phase-8-agent-native-live-engine
session: phase8c4f-eight-arm-matrix-incomplete-read
---

# E206: Final Claude run stops on an incomplete read

The approved r9 continuation completed sequences 557 and 558. Sequence 559
reached the Claude message endpoint, but its response body ended after 87,269
bytes. The client returned `IncompleteRead`. The response was not complete or
scorable. The frozen policy stopped the run without an automatic repeat.

R9 retained two scored rows at USD 0.083737. The incomplete response has no
provider usage record, so its billed cost is unknown. The manifest keeps one
failed reservation and does not claim that value as measured cost.

A recovery package now selects sequence 559 and sequences 560 through 592. It
has 34 calls. It does not treat `IncompleteRead` as an automatic retry because
the provider can bill a generated response even when the client receives only
part of its body.

The recovery estimate is USD 0.650000. Its hard limit is USD 0.916263. This
keeps the cumulative measured matrix ceiling at USD 16.04678425. The protocol
hash is
`17efbf1441324e4f98ef542c10b1dae849d003784d1133ae49418c9deb3cbcd8`.
The run-plan hash is
`b5eb0c52e0aab800a6793ad75413915ad2a1935da57223710851a5f1bdf8921d`.

No recovery call has occurred. It needs new explicit approval.
