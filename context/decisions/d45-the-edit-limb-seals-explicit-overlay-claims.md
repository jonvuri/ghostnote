---
id: D45
kind: decision
state: active
updated: 2026-10-09
source: phase-8i4
---

# D45 — The edit limb seals explicit overlay claims **[SETTLED 2026-10-09]**

A current overlay must carry its R22 `basis`. The model reference tells the
author to "use the supplied dependency-basis utility for a new claim". The
benchmark prompts supplied it; no `agent-native-v1` tool did. An agent could
not put a claim without a reimplementation of R22, R25, and R26 (8i review:
omitted basis R12, wrong basis R22).

## Rule

`edit_launcher_clip` is the supplied utility. The rule is a host input rule
in [HOST-BINDING.md](../../spec/ghostnote-document-v1/HOST-BINDING.md#overlay-basis-sealing).
The portable grammar and the model reference revision do not change.

1. **Stated claims only.** A current claim that the call states can omit
   `basis`: each `OVERLAY_PUT`, and each `OVERLAY` of a desired document that
   omits `basis` or differs from the stored claim. The tool computes the
   basis on the state after the event and clip changes of the same call.
2. **A supplied basis is checked, not replaced.** A mismatch on a stated
   claim refuses with `invalid-input`, reason `R22`, and
   `detail.expectedBasis`. A wrong value can mean a wrong dependency list, so
   the tool does not overwrite it.
3. **No reseal.** A retained claim and a stale claim are never sealed. A
   retained current claim over a changed dependency still refuses with the
   codec R22 error and no expected value. A stale claim keeps its prior basis
   (R12 requires it). Patch application keeps the R23 lifecycle.

## Consequences

- A fresh agent can author a nominal and a groove claim with no repository
  helper; the result is a valid Document 1.0
  ([E253](../evidence/experiments/e253-overlay-basis-sealing.md)).
- The implementation is `brain/src/bindings/overlay-seal.ts`: a parse that
  admits the omitted basis, and a seal in the planner before the codec
  applies the proposal. It uses the codec internals, as `overlay-carry.ts`
  does; the codec API does not change.
- No host turn is added. The seal costs about 10 percent of the planner time
  when the call states claims (E253); a call without claims has no seal work.
- Tool descriptions: `ghostnote-description-v38`.
