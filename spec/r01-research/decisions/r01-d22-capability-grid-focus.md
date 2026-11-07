# R01-D22 — R01 focus: a capability grid of state and interaction

Date: 2026-10-31. Status: **accepted by the operator** ("These axes and grid
make sense to me. Record this all as a new focus of r01…").

## Context

R01 has compared formats in two task cohorts:
- **Performed:** core notes; IDs and order are not scored.
- **Source:** exact source state with groups, timing intent, nominal timing,
  provenance and annotations.

Phase 8 used a different split, native against composite (side-ledger) arms.
Neither split covers what the product does over a working session. The
operator first proposed three nested tiers: performance only, sustained
editing, and deep context-aware editing. Overlays straddled two of those
tiers, because their content and their attachment depend on different
things. Separating *what state exists* from *how editing happens over time*
removes that overlap.

## Decision

R01 organises its questions, evidence and next steps on two independent axes.

**Axis A: state, ordered by authority.**

| Level | Contents | Loss means |
|---|---|---|
| A1 Performed core | pitch, onset, duration, velocity | a wrong musical result |
| A2 Authoritative host state | channel, expression, mute, chance, release velocity and other host-owned note properties | an unsafe write |
| A3 Annotative context | groups and memberships, timing intent (anchor, delay, spread, ownership), nominal timing, provenance, interpretation state, annotations, overlays | degradation: the context can be marked stale, dropped or recomputed |

**Axis B: interaction.**

| Level | Meaning |
|---|---|
| B1 Restatement | each turn returns the complete state |
| B2 Addressed editing | sparse operations aimed by ID or selector; small requests change only their targets |
| B3 Sustained editing | addressed edits across turns, with identity through changes (lineage), stale-base safety, and preservation of state the turn did not show |

Authoring conveniences (patterns, repeats, selectors, transforms) are a
separate axis. Any cell can have or lack them. Persistence across save,
reopen and sessions is a deferred lifecycle question, not a cell.

**The operator's desirable features (from the compact-bar rationale), mapped
to the grid.**

| Feature | Cell | Reassessment (R01 brief, after E353) |
|---|---|---|
| Local addressability: sparse operations and compact changes, the same mechanism seen from two sides (target one event instead of restating the clip) | B2 | A useful dimension, not a Ghostnote-only advantage. Producer Pal also has compact single-target requests (pitch, time and selector edits without IDs). ID patches and selector edits trade off differently. Measure request size separately from host state rewritten. |
| State continuity: property preservation and stable overlays (the edited event is still the same logical event) | B3, over A2 and A3 | Partly outside the notation. A binding can preserve fields the text never shows, and a field shown in text may lack a host setter. The operator's distinction holds and becomes the A axis: host properties (A2) are authoritative and can make a write unsafe; overlays (A3) can sometimes be dropped or recomputed. |
| Edit lineage: identity through timing/pitch changes, three-way merging, meaningful change reports | B3 | Conditional. Ghostnote keeps IDs through a verified authored move within its identity domain, but cannot recover arbitrary human moves or cross-session identity. Producer Pal keeps correspondence within one transform, but its host write strips IDs. No general three-way merge is implemented anywhere; Ghostnote's stale-base refusal is a safety rule, not a merge. |

**Interpretation lifecycle** (mark inferred interpretations stale, keep
declared intent) is the A3 rule a format must follow at every B level.
**An overlay** is A3 content whose attachment depends on B3 identity.

**Evidence so far.**

| | B1 Restatement | B2 Addressed | B3 Sustained |
|---|---|---|---|
| A1 Performed core | R01 performed cohort (E369–E385, E387); Phase 8 native arms | Phase 8 ID patches, single turn (E115, E137); the compiler supplied preservation and stale checks | — |
| A2 Host state | R01 preserve-exact and large-edit rich fields (E381–E385, E391) | Phase 8 (the compiler preserved omitted fields); E121 live patch | — |
| A3 Annotative context | R01 source cohort, C3 against C4 only (E375–E391) | — | — |

**Measured standings.**
- **A1/B1:** C4 and baseline FIELDS hold up against MIDI JSON and beat it
  for Luna on larger range edits. bar|beat is weakest. MIDI JSON is slightly
  smaller.
- **A3/B1:** C4 beats C3 FIELDS for Luna (E387, E391). For Haiku, C4 wins on
  reads and regrouping, and is otherwise cheaper at equal accuracy.
- **Unmeasured:** B3 for every format, and B2 beyond single-turn A1 patches.
  Those are the cells where IDs, colocation and patch syntax should matter
  most, and where MIDI JSON cannot compete by construction.

## Consequences

- **What R01's next round targets** depends on where real use falls on the
  grid. The next session first establishes that from the operator's local
  Codex sessions, and assesses the live format (Ghostnote document 1.0,
  compact-bar FIELDS) in those cells. Only then does it reassess R01 as a
  whole.
- **Round 2's step 4** (freeze for the rigorous round, or a stronger model)
  waits for that reassessment rather than being decided alone.
