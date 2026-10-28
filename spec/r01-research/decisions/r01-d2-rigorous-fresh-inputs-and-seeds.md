# R01-D2 — Rigorous-stage inputs and seeds

Date: 2026-10-28. Status: accepted by the operator (freeze-review item 2).

## Decision

- **Works.** The rigorous stage takes the next unused works in the seeded
  selection order (`r01-pilot-selection-v1`): work 4 *trailing*, work 5
  *the gapra whitewood* and work 6 *open spaces*. Works A–C remain
  development material. A work that yields no admissible window is replaced
  by the next work in the order; every refusal is recorded.
- **Roles.** The three accepted works fill the task roles A, B and C in
  order, so the frozen task rules apply unchanged.
- **Window.** Input v2's densest-admissible-window rule
  ([E367](../../../context/evidence/experiments/e367-r01-pilot-inputs-v2-dense-windows-velocities.md)),
  with the existing refusal rules and the target-rule refusal of
  [R01-D3](r01-d3-target-rule-window-refusal.md).
- **Seeds.** Synthetic tasks use `r01-pilot-synthetic-v2`; real-source
  velocities use `r01-pilot-velocity-v2`. The order seed stays
  `r01-pilot-order-v1`: it reveals nothing about content, and the new
  prompt hashes and Luna's new configuration give a new materialized order
  anyway.
