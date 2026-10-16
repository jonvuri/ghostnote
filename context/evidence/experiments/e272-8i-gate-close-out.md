---
title: E272 — 8i gate close-out and Phase 9 handoff
kind: evidence
state: done
updated: 2026-10-16
owner: phase-8i
---

# E272 — 8i gate close-out and Phase 9 handoff

## Status

The [8i gate](../../plan/phase-8/8i-agent-native-hybrid-dogfood.md) is
closed. This record checks the 8i acceptance criteria against E249 to E271,
gives each Phase 8 interface a verdict, and hands the publication candidates
to [9b](../../plan/phase-9/9b-compact-bar-publication-review.md). No product
code, tool description, or live project changed in this session. The
deployed controller is the 8i15 build; descriptions are v52.

Main Phase 8 verdict (the [retrospective target](../../plan/phase-8/8i-agent-native-hybrid-dogfood.md#retrospective-target)):
Ghostnote behaved like an instrument. Fresh agents with no repository access
read and wrote Document 1.0 clips, mixers, and devices from the tool
descriptions alone (E255: five agents, no format rejection; E262: ten
sessions, 3 to 19 calls each, every goal met). The work that the agent still
had to manage was named and removed inside 8i: timing claims needed a
description route (v45, E259), claim replacement needed a repair (E260),
and large documents needed a file route (D51, E270). Two residual costs stay
as limits: the Codex Desktop client hides deferred tools until a prompt names
Ghostnote (E259), and a client cuts large results, which makes an agent
print or reread (interface review, D1, D15).

## Acceptance criteria

| Criterion | State | Evidence |
|---|---|---|
| The cache remains correct through the real lifecycle events | Void | The resident cache was removed in 8h3e (E233) after the cold reader became the only read path (E230). Its replacement passed: a stale D32 reference refuses before a write (E233, 23 live verdicts); a project switch, a saved cursor record, and a collapsed group give fresh reads (E250, E251) |
| Version 1.0 supports complete and sparse reads and edits with the declared loss, defaults, and preservation | Met | E236 and E247 (the live matrix), E255 (create and patch by five fresh agents), E256 (32 notes and 64 claims in one add), E262 S1 and S4 (clip copies with equal notes), E265 and E269 (file encodings round-trip) |
| Overlay identities and dependencies survive or invalidate correctly; removal leaves notes unchanged; musical judgments have their own verdict | Met | E253 (sealed basis; a dependency edit makes a claim stale), E256 (a moved note loses its claims, a lengthened note's claims go stale, 60 stay current; the operator's musical pass is recorded apart), E260 (duplicate-claim repair; T1 rerun without refusal) |
| FIELDS and JSON conversion preserves accepted live values; the model reference matches the specification and codec | Met | `document:artifacts` matches; the codec corpus (24 conformance cases, 3 binding cases) passes; the model reference is revision 5 with its identity file; E269 reads and writes the same document as FIELDS and JSON files |
| The simplified surface needs less coaching, fewer calls, lower latency, or fewer tokens | Met, with one retained cost | No coaching: E255, E256, E262. Calls: 3 to 19 for each E262 task; S4 copy went from three writes to one (E263). Latency: E239 and E247 (the 16,384-note edit 48.0 to 8.3 s). Tokens: Claude output tokens 161,362 to 19,378 with file paths (E270); a file read result 21.6 KB to 1.8 KB (E271). Retained: the E45/E48 workflow needs one more call and more bytes (E239) |
| Computer use and Ghostnote have a clear division of labor | Met, partly shown | The audit's surface classes hold. In the trials the operator made the UI edits (E256, E259) and the agents reacquired state with a fresh read. Computer use was used for discovery only when a client hid the tool list (E259, E262 S4 and S5: issue D10). No 8i task needed an agent's computer use for a focus-dependent step |
| Strong verification appears only where the risk tier requires it | Met | D44 bounds the long writes; D46 removes the behavior witness from the modulation writers; D49 makes the revert fidelity state what it restored; E258 reports a failed verification read as `unavailable`. The costliest retained safeguard, the control inventory around a control write (E247), did not limit trial work: the sound-design turn of the second trial took 26 calls in about 96 s, and E262 S2 wrote controls without a wait |
| Failures and partial results let the agent continue or stop safely | Met, with one recorded limit | A refused document or claim returns `detail.repair` (E255, E260); a failed readback is `unavailable` (E258); a revert names the removed objects (E264); an overlap names its pairs before any host call (E271); S3 split a request above the D44 limit and reported the missing track (E262). Limit: a `read_device_controls` 3 s after a wrap returned `authority-unavailable` with no retry hint (D7, no action by the operator) |
| Every owned change or fixture is retained by operator choice or removed exactly | Met | `gn-scale-test` returned to its E234 baseline after each of the ten E262 runs and the E263 and E264 drivers (issue D11: the selection fields are left out of the comparison). The operator keeps the named material in "Night Glass", "ice jungle", and `lie sword` (see NOW). E265 to E271 removed their files |
| Each Phase 8 interface has a verdict | Met | [Interface verdicts](#interface-verdicts) |
| Publication candidates and known limits are handed to 9b with an artifact inventory | Met | [Phase 9 handoff](#phase-9-handoff); the [candidate inventory](../../contracts/GHOSTNOTE_PUBLICATION_CANDIDATES.json) (101 entries) |
| Complete repository checks and the relevant live gates pass | Met | [Verification](#verification); the live gates of E263 and E264 on the 8i15 build; today's `probe:hello` passes on that build |

## Trial set

| Trial set item | Evidence |
|---|---|
| Project and clip discovery | E255 (five fresh agents), E259 (tool discovery), E262 S5 (both clients found Ghostnote from the task alone) |
| Compact musical reading and explanation | The second musical trial ([interface review](../../plan/phase-8/8i-trial-2-interface-review.md)), E259 T2, E266 (three drum excerpts from a 1,567-note transcription) |
| A complete desired document and a sparse note edit | E255, E256, E259 T1 (add, then edit), E260 |
| Nominal rhythm under the normalized timing boundary | E259 and E260 (nominal `1/4` claims; the 1/512 onset floor and its repair) |
| A groove task that preserves or transfers timing intent | E256 (operator trial), E259 reruns (T1 kept the step-2 feel; T2 kept the shaker's pattern and pushes) |
| An overlay dependency change | E253, E256 (moved and lengthened notes) |
| A repeated read that should benefit from the cache | Void: E230 and E233 removed the resident cache. Every read is fresh |
| A structural change or rebuild condition | E262 S2 (device add, move, route, restore) and S4 (clip move, delete, copy; scene add), E251 (collapsed groups), E250 (project switch) |
| A visible UI-only action followed by structured reacquisition | E256 (two hand edits, then a fresh read that reported the claim states), E259 T1 step 3 |
| A failure, ambiguity, or over-limit fallback | E262 S3 (13 tracks above the limit of 8: a split and a report), S4 (occupied slot; the scene limit), E259 and E260 (claim refusals and repair), E270 D16 (an overlap refusal; the agent repaired the document) |
| A subjective musical choice with an operator verdict | The second musical trial (pass), E256 (musical pass), E259 (first T1 run neutral; the reruns accepted; the first T2 loss heard), E266 |

## Agent-behavior gates

| Gate | Result | Evidence |
|---|---|---|
| Select Ghostnote when structured state or precise action adds value | Pass, with a client limit | E262 S5 (both clients); E259 (Codex Desktop needs the name in the prompt) |
| Use computer control for visual and focus-dependent work | Partly shown | No 8i task needed it from the agent; discovery attempts only (E259, D10) |
| Read and produce FIELDS with the model reference and no repository tutorial | Pass | E255, E256 |
| Distinguish realized timing from nominal rhythm and inferred groove | Pass | E259 reruns, E260 |
| Recognize stale overlay interpretations after note or context changes | Pass in the operator trial; partial in the automated trial | E256 (reported correctly); E259 T1 step 3 named the edited notes, not their claim states |
| Notice cache health, coverage, and fallback | Void for the cache; pass for limits | E262 S3 (the D44 split); E268 and E270 (file routes for large documents) |
| Avoid treating a UI observation as exact structured state | Pass | E256, E259 T1 step 3 (fresh reads after hand edits) |
| Avoid bypassing a refusal through a lower-level tool | Pass | E262 (no bypass in ten sessions; dry runs before the S4 writes); E270 (document repair after the overlap refusal) |
| Recover from one stale or changed state without corrupting the project | Pass | The second trial (a fresh read supplied the new base after an octave change), E256, E260 |

## 8h inputs

- **The document edit limb.** Fresh agents used `read_launcher_clip` and
  `edit_launcher_clip` without coaching (E255, E256, E259, E262). No trial
  clip write took more than 10 s: the largest were the 36-note add with 72
  claims (2,881 ms, E259) and the four S1 copies. The admitted bounds stay
  at 6.6 to 8.3 s for 16,384 notes (E247, E248) and 33.5 s for the longest
  device write (E252).
- **The control inventory.** Its cost did not limit real device work in
  the trials (see the verification criterion). A narrower readback needs no
  decision now.

## Interface verdicts

`Graduate` means that fresh-agent trials used the interface for real work
without coaching. `Retain` means that the live proof holds and no 8i trial
changes it. `Retire` means that the interface leaves the product. No
interface needs a revise verdict: each candidate defect has an operator
decision in the [issue log](../../plan/phase-8/8i-dogfood-issues.md) or a
recorded limit.

| Interface | Verdict | Evidence and limits |
|---|---|---|
| `agent-native-v1` profile: 44 tools, descriptions v52, one address, health, result, and error vocabulary (D40) | Graduate | E239, E255 to E271. The default since D40 |
| Connection and project sensors: `check_bitwig_connection`, `list_tracks` | Graduate | The first calls of every trial (E261, E262) |
| Launcher clip document limb: `read_launcher_clip`, `edit_launcher_clip`, `add_launcher_clip`, `check_launcher_clips`, `get_document_reference` (D21, D32, D47) | Graduate | E255, E256, E259, E260, E262 S1 and S4. Limit: a read of the largest clip returns 8.6 MB (E256) |
| Overlay claims: Timing overlays help, templates, repair, claims on creation (D45, D47) | Graduate | E253, E256, E259, E260. Limits: claims live in one server session; `edit_launcher_clip` has no claim expansion limit (E256) |
| Clip structure limbs: `copy_launcher_clips`, `move_launcher_clips`, `delete_launcher_clip`, `set_launcher_clip_properties`, `set_launcher_clip_launch_settings` (D42) | Graduate | E249, E262 S1 and S4, E263. Limit: `revert_change` does not reverse a clip move |
| `launch_clip`, `show_launcher_clip_in_detail_editor` | Retain | E239 and E247 live proof; no 8i trial measured them |
| Track and scene limbs: `add_tracks`, `duplicate_track`, `rename_track`, `delete_track`, `add_scenes`, `delete_scene` | Retain | E237, E239; the 8i drivers build and remove every fixture with them (E261 to E264). Limit: no scene insert above row 0 (E262 S4) |
| Track mixer: `read_track_mixer`, `set_track_mixer` (D48) | Graduate | E257, E261, E262 S1 and S3 |
| Device sensors: `read_devices`, `read_device_controls` | Graduate | E254 (host-index selectors), E262 S2, the second trial. Limit: issue D7 |
| `list_modulator_types`, `read_preset_modulation` | Retain | E238; the second trial. Limit: an unsupported preset result names no cause ([interface review](../../plan/phase-8/8i-trial-2-interface-review.md), no approved change) |
| Device limbs: `add_devices`, `move_devices`, `set_device_controls` (D44) | Graduate | E252, E254, E262 S2, E264. Limit: `revert_change` does not reverse `move_devices` (issue D6, no action) |
| `copy_devices`, `set_device_enabled`, `delete_device` | Retain | E238, E239, E247 recipes; D20 for the delete |
| Layer-chain operations: `compose_devices`, `duplicate_layer_chain`, `rename_layer_chain`, `set_layer_chain_solo` (D18) | Retain | E238, E247; D44 bounds (E252). Limit: a container with 3 or more modulated layer chains cannot be built |
| Modulation workflow: `edit_preset_modulation`, `wrap_existing_device_modulation`, `reverse_existing_device_modulation_wrap` (D46) | Retain | E254, E262 S2. The audit's `Defer` stands; the live route proof (`probe:modulation-routes`) moves to the 9c suite |
| Change records: `list_changes`, `check_revert`, `revert_change` (D49) | Graduate | E262 S2, E264 |
| MIDI and document files: `read_midi_file`, `write_midi_file`, `documentPath`, `documentOutputPath` (D50, D51, `midi-document-v2`) | Retain | E265 to E271; client trials on v49 to v51 (E266, E268, E270). Limit: no client trial has used v52; the v52 changes are verified by drivers and tests (E271) |
| Ghostnote Document 1.0: SPEC, FIELDS, EBNF, schema, codec, conformance corpus | Graduate to 9b | The publication candidate below; E236, E247, E255, E256 |
| Model format reference (revision 5) and document help | Graduate to 9b | E255, E256, E259, E260 |
| Host binding and identity and overlay rules (`ghostnote-binding/1`, D23, D31) | Graduate for live use | E236, E253, E256. 9b publishes only the relevant binding material (D25) |
| Pull snapshot references and the cold reader (D32, `clip-reader-v3`, D41, D43) | Graduate | E230, E233, E248, E250, E251 |
| Resident and shadow cache (8g, 8h1) | Retired | E233; the cache items of the 8i trial set are void |
| Wire `normal-v1` (92 methods, `8be1975eaa99d78f`) and `phase-8-probe-v1` (111 methods, `9b339de4e9bb08da`) | Retain | Private transport with goldens and `probe:hello`; 9c owns the live suite |
| `stable-v1` profile | Retire | D40 names its removal after 8i. Planned in the [Phase 9 backlog](../../plan/phase-9/README.md#packaging--hygiene) |
| Description cohort versioning and its public artifact | Retain | v52 (`ccc7d870…c3ea`); the cohort tests freeze each version |
| Automated dogfood runbook, runner, and issue log | Retain | E261, E262, E270 |
| Performance ledger and call budgets | Retain | E247; every 8i session with a live path updated it |
| Risk-tiered verification (D15, D20, D44, D46, D49) | Retain | See the verification criterion |
| Phase 7 format families I01 to I24 | The audit dispositions hold | [Workstation interfaces](../format/WORKSTATION_INTERFACES.md), 8i closeout status |

## Comparison

The 8i charter asked for a comparison with retained Phase 7 and
pre-promotion numbers where the task is equivalent. The retained numbers
are in the [performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md)
and E247; 8i adds these:

| Measure | Before | After | Source |
|---|---|---|---|
| Clip copy to a row that is not the next row | 3 writes (copy, copy, remove) | 1 write, 853 to 888 ms | E262 S4, E263 |
| Device-add revert report | `fidelity: none`, empty lists | the removed device named; fidelity states what the revert restored | E262 S2, E264 |
| Claude output tokens for the chord task | 161,362 | 19,378 | E268, E270 |
| `read_midi_file` file-mode result with 512 tempo events | 21,633 characters; context grew by 10,255 tokens | 1,834 bytes | E270, E271 |
| Overlap in a desired document | 12 adapter calls and an empty clip | refused before any host call, with pairs | E270 D16, E271 |
| Snapshot export | refused; coverage changed to `all` with loop loss | accepted with observed MIDI fields | E266, E267 |
| Fresh-agent mixer task (P1) | — | 3 Ghostnote calls, 10 to 26 s session | E261, E262 S5 |
| Sound-design turn of the second trial | — | 26 calls, about 96 s, six manual sample calls after a failed witness | Interface review; repaired in 8i5 (E254) |

Not every metric improved. The E45/E48 workflow keeps one more call and
more bytes (E239). The second trial's 52 calls include repairs that 8i5
removed, but no rerun of that trial measured the saving.

## Phase 9 handoff

### 9b artifact inventory

The [candidate inventory](../../contracts/GHOSTNOTE_PUBLICATION_CANDIDATES.json)
holds the exact path, version, SHA-256, dependencies, and redistribution
status of every candidate file (101 entries, checked by
`check-publication-candidates.py`). The families and their version
authorities:

| Family | Paths | Version and hash authority | Dependencies | Redistribution |
|---|---|---|---|---|
| Specification | `spec/ghostnote-document-v1/SPEC.md`, `FIELDS.md`, `fields.ebnf`, `schema.json`, `CONFORMANCE.md`, `EXAMPLES.md` | `ghostnote-document/1.0`; file hashes in the inventory (`SPEC.md` `47ca69c6…`) | `brain/src/document/`, `LICENSE` | MIT with the repository notice; 9b confirms the package scope |
| Reference codec and CLI | `brain/src/document/*.ts`, `CODEC.md`, `document-artifacts.ts`, `document-standalone-check.ts`, `brain/package.json`, lockfile | `ghostnote-document/1.0`; source hashes in the inventory | ES2022, Node module support, the lockfile | MIT; dependency notices need 9b review |
| Conformance corpus and examples | `spec/ghostnote-document-v1/conformance/v1/` (24 cases), `examples/` (8 documents; semantic hashes in `examples/expected.json`, `e45ac1d9…`), `bindings/v1/` (3 cases) | `ghostnote-document/1.0`; byte and semantic hashes kept apart | Codec-generated | Generated repository music, MIT |
| Model format reference | `MODEL-REFERENCE.md`, `MODEL-REFERENCE.identity.json` | format 1.0, reference revision 5, SHA-256 `a1303abc…3ed7` | Codec examples; `get_document_reference` serves it | MIT |
| Host binding | `HOST-BINDING.md`, `IDENTITY-AND-OVERLAYS.md`, `HOST-HANDOFF.md`, `brain/src/bindings/*.ts`, the pull snapshot and migration contracts | `ghostnote-binding/1` | `brain/src/contract/`, `SPEC.md` | MIT; publish only the portable rules (D25) |
| Product review and reproduction guide | `context/evidence/format/FORMAT_BENCHMARK_PRODUCT_REVIEW.md` (`305f2d2c…`), `COMPACT_BAR_REPRODUCIBILITY.md` (`893295b1…`), E209, E213 | Frozen evidence | The two benchmark roots | Third-party and provider evidence: 9b review |
| Corrected eight-arm matrix | `brain/benchmarks/symbolic-format-v5/` (59 files, tree hash `c4e205d0…`), `runs/2026-09-30-corrected-assessment.json`, `corrected_assessment.py` | Frozen reproduction candidate | Imports the v4 adapters: the root alone is not a proven closure | Provider responses: 9b review |
| Native and composite addendum | `brain/benchmarks/native-composite-v1/` (53 files, tree hash `d10ea4ef…`), `PROTOCOL.md`, `audits/` | Frozen reproduction candidate | Python and optional format executables | Provider responses: 9b review |
| Licenses | `LICENSE` (MIT), `NOTICE` (daw-mcp attribution) | Repository snapshot | — | Required in every package |

Outside the format package, for the extension review that Phase 9 can
make: the normal controller archive (8i15 build, SHA-256
`8f7f6c895cb7e11e4ea654b4fccbc8d52df439d3aadebae47b6174d3a91c6928`,
92 methods, `8be1975eaa99d78f`), the probe build (111 methods,
`9b339de4e9bb08da`), the `agent-native-v1` profile with descriptions v52,
the [MIDI conversion contract](../../contracts/MIDI_FILE_CONVERSION.md)
(`midi-document-v2`), and the [performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md).
The normal runtime and the public surface have stable owners: the wire
goldens and `probe:hello`, the call-budget tests and the ledger, and the
description cohort tests. These are not part of the 9b format package.

### Version 1.0 changes that the benchmark did not measure

The benchmark (E209, E213) scored FIELDS with local labels before version
1.0 existed. 9b must state these later changes with their own identity:

- rational timing with the normalized 1/512 acquisition view and the FIFO
  pairing of cell collisions (D23, D31, R07);
- overlays and claims: sealed basis, stale and removed states, repair
  (D45, D47; E253, E256, E260);
- the model reference revisions 1 to 5: Timing overlays templates, the
  analysis method, and claim repair;
- document files and MIDI conversion (D50, D51), which are Ghostnote
  routes, not format rules.

The live-use records E255, E256, E259, E260, E262, and E270 are bounded
validation with their own scope. They are not benchmark scores.

### Known limits handed to 9b

- Normalized timing loss is explicit and not reversible (D23). A same-key
  overlap after normalization is paired FIFO, not shortened (R07, E271).
- A client cuts large results; the format has no size rule. The product
  answers with file routes (D51) and a bounded tempo report (E271).
- The two benchmark roots are not a proven reproduction closure; 9b must
  resolve the imported dependencies before it claims offline reproduction.
- Provider responses, vendor material, and the operator's music ("Night
  Glass", "ice jungle", `lie sword`, `good lies`) are not redistributable.
  Only generated fixtures carry an MIT provenance.
- The 9b model-reference row of the migration contract named revision 1;
  the current revision is 5. This record corrects it.
- No client trial has used descriptions v52. The v52 changes are offline
  (a report shape and a pre-check); the controller is unchanged since
  8i15. A rerun with the [runbook](../../plan/phase-8/8i-automated-dogfood-runbook.md)
  can run at any time; it does not gate 9b.
- The [8i17 survey](../../plan/phase-8/8i17-midi-musical-navigation-survey.md)
  (musical navigation in large MIDI files) is planned and independent.

## Live state

`probe:hello` on 2026-10-16 passed on the 8i15 build (92 methods,
`8be1975eaa99d78f`, host API 25, every `rig.info` marker of NOW; the
running extension started after the deployed file). The open project was
`lie sword` (4 tracks: MODO DRUM, chords, FX 1, Master; 20 scenes). No
read beyond the hello and no write ran. The operator-retained material of
NOW is unchanged.

## Verification

- `npm run check`: TypeScript and 2,372 tests pass.
- `./gradlew test --offline`: the extension tests pass; the wire goldens
  are unchanged (normal 92, probe 111).
- `npm run document:conformance`, `document:standalone`, and
  `document:bindings` pass; `document-artifacts.ts --check` reports
  "Document artifacts match".
- `check-publication-candidates.py`: 101 entries match, then `--write`
  after the migration contract edit of this session.
- `LANG=en_US.UTF-8 ruby context/check.rb` and `git diff --check` pass.
- `npm run probe:hello`: ALL PASS (above).

## Records

- The [8i plan](../../plan/phase-8/8i-agent-native-hybrid-dogfood.md) is
  done, with its closeout table; the cache items of the trial set and the
  criteria are marked void.
- The [Phase 8 README](../../plan/phase-8/README.md) is done; 8i17 stays
  planned under it. The [roadmap](../../plan/ROADMAP.md) and the root
  README state lines are current.
- [9b](../../plan/phase-9/9b-compact-bar-publication-review.md) has the
  8i handoff section; the [Phase 9 README](../../plan/phase-9/README.md)
  has its entry condition met and the `stable-v1` retirement item.
- `PROJECT.md`, the [workstation interfaces](../format/WORKSTATION_INTERFACES.md)
  8i status, the migration contract, and the candidate inventory status
  are current (44 tools, v52, 92 methods, reference revision 5).

## Retrospective

The close-out reconstructed the acceptance table from 23 E records and six
reference documents. The 8h closeout kept its table in the plan; 8i did
not, so each session's result had to be mapped again here. For the next
gate, add the criteria table to the plan at the first session and fill one
row for each completed session. Three documents carried a stale tool count
(`PROJECT.md`, the workstation interfaces status, the migration contract
table): NOW now names them beside the description artifact in the
tool-addition fact.
