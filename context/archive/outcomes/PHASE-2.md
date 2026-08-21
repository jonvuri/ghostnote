---
title: Phase 2 outcome — the clip surface
kind: outcome
state: complete
status: Complete 2026-08-20. All exit evidence, the exact live baseline, local
        checks, and final remote CI pass.
updated: 2026-08-20
phase: phase-2
evidence: E24, E41–E49 · D8–D10, D15, D16, D18–D21
---

# Phase 2 outcome

Phase 2 is complete. It delivers one deterministic
musical patch grammar, generation and transformation tools, launcher-clip
lifecycle and long-clip paging, stash-backed verified application, and explicit
background completion and cancellation.

## Exit evidence

| Criterion | Result | Evidence and qualification |
|---|---|---|
| 1. Useful music through an ordinary MCP client | Complete | [E44](../../evidence/experiments/e44-public-musical-conformance-and-writer-window.md) proves the complete public path. [E45](../../evidence/experiments/e45-first-real-musical-dogfood.md) and [E48](../../evidence/experiments/e48-second-musical-dogfood-and-operation-latency.md) record two accepted natural tasks without direct DAW editing for clip creation. |
| 2. Stash-backed, verified, reversible writes and clip-block protection | Complete, qualified | The Phase 2 planner uses `Workspace.apply` as its only write seam. E44 proves changesets, independent readback, protected four-row variation blocks, and directed reversal. [E46](../../evidence/experiments/e46-long-clip-editing-follow-up.md) proves long metadata and note reversal. Track copies remain after automatic reversal and need directed `delete_track`. Clip delete/recreate remains lossy for play-stop and automation. |
| 3. Complete 21-property regression contract | Complete, qualified | [E24](../../evidence/experiments/e24-gain-inverse-and-complete-note-contract.md) proves all 20 writable properties through an independent handle, including gain through the measured inverse. Pressure refuses before mutation. E44 repeats the complete matrix through the public musical path. Live bank overflow and concurrent editing use E33 and E39 instead of a fresh destructive sweep. |
| 4. Two unprompted dogfood uses | Complete | E45 records six accepted full-phrase variations on two tracks with description v2. E48 records an accepted track copy and two new F Dorian progressions with description v4. The tasks, tool paths, and musical results are distinct. |

## Qualifications

- Theory support is the deterministic Phase 2 corpus and its named notes,
  intervals, chords, scales, modes, keys, detection, progressions, and pitch-
  class sets. Unknown theory values, empty results, impossible MIDI ranges, and
  unsupported operations refuse. This is not a claim of complete style or theory
  coverage.
- Pressure is readable and unwritable. It refuses before mutation. Gain is exact
  through the measured divide-by-two encoder.
- Starts must use a supported exact binary or triplet grid. Host-duration
  normalization is measured only for the supported values on Bitwig 6.0.6 and
  host API 25. Captured durations outside that rule fail the fidelity floor.
- Launcher-clip metadata is exact for the shipped fields. Clip recreation is
  lossy because play-stop writes are inert and automation lanes have no complete
  readback.
- The live public proof deliberately skips fresh bank overflow and concurrent
  editing. Existing focused live evidence covers those hazards. Routine
  regression must not damage the fixed fixture to repeat them.

## Final public cohort

`ghostnote-description-v4` contains 31 tools: 8 read, 1 focus, 18 write, and 4
destructive tools. Its SHA-256 is
`0289ae1611a7c8c6c13b296a0749bd11dc8969df586859e10903b5e6d08d1ca4`.
The v4 artifact is byte-identical to v3; v4 identifies the new `elapsedMs`
operation-status result. Versions 1 through 3 remain frozen.

Tool names carry the measured permission grain. Destructive verbs have separate
names and cannot share a name with a benign case. Annotations are derived from
the four classes and remain future-proofing. No design relies on a host reading
them. `revert_change` is the one declared ordinary-write exception that can
remove session-owned work.

Observation format `ghostnote-observation-record` schema 2 stores instruction,
managed-event, ordinary-use, and musical-use entries. It preserves raw caller
scope, description version, rationale when supplied, explicit accepted, vetoed,
or silent operator response, result identity, and correlated result links. It
reads and migrates schema 1. Unknown schemas refuse without replacement.

## Async verdict

Async completion was built. E45 measured one request beyond the client's
60-second timeout and found long exact reads and verification as the dominant
cost. E47 proves immediate operation identity, terminal status, and cooperative
cancellation on both sides of the first project write. E48 records 34,470 ms at
the server and 34,569 ms through polling for the accepted two-clip generation.

The expression-stage optimization was declined. E44 measured property waits at
less than 3% of the representative workload. E15-F proves that coalescing those
stages across clips can silently lose properties.

## Standing regression matrix

| Class | Owner | Checks | Trigger |
|---|---|---|---|
| Offline CI | GitHub Actions | `npm run check`, including fake conformance, musical corpus and surface goldens, cancellation boundaries, and the required Python oracle; extension Gradle build | Every push and pull request |
| Unattended live, manual start | Repository operator | Phase 1 checks from E40; `probe:2d-rhythm`, `probe:2d-grid`, `probe:2e-lifecycle`, `probe:2g-mcp`, `probe:2h-conformance`, `probe:2i-long`, `probe:2x-async`, and read-only `probe:2k-baseline` | Before a candidate when the related theory, grid, clip lifecycle, planner, public surface, paging, cancellation, adapter, bridge, or host-version path changes |
| Human-assisted live | Repository operator and human editor | `probe:e08b`, `probe:5d-concurrent`, and `probe:5f-ab` | Before a candidate when selection interference or managed A/B changes |
| One-shot evidence | Repository operator | E45 and E48 dogfood clients and latency measurements; E40's drag and bank probes | Only to challenge the evidence, after the related host behavior changes, or for a new natural musical task. Do not replay dogfood as routine conformance. |

Each live owner starts from the documented project, records entry state, and
restores it. E40 owns the Phase 1 command list and bank-overflow qualification.
The Phase 2 baseline probe is read-only and verifies the complete accepted
7-track by 8-row launcher grid, all accepted musical notes, and both observation
links.

## Final remote CI

[GitHub Actions run 32338482416](https://github.com/jonvuri/ghostnote/actions/runs/32338482416)
passed on its first attempt for exact candidate
`5e51b4ce6131437adbab0ab8cd38a0150d0355d3`. The `brain (offline suite)` and
`extension (compile)` jobs both passed. E49 records the job identities, times,
local checks, and final live baseline.

## Phase handoff

Optional Phase 3 has no evidence to run now. Both dogfood tasks used textual
results and `show_changed_clip` without a repeated comparison, navigation, or
partial-revert problem. Its project-wide human-change log also remains blocked
by incomplete observer coverage. Phase 4 is next.
