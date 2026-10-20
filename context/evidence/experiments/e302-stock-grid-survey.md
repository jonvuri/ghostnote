---
title: E302 — Stock Grid survey on V14
kind: evidence
state: active
updated: 2026-10-20
owner: phase-9b
---

# E302 — Stock Grid survey on V14

## Result

The operator replaced the controller and selected `gn-grid-spike`, with the
audio engine active. `npm run probe:hello` passed: `phase-8-probe-v1`, 118
methods, hash `2e939035ea90b8b0`, marker `9b-grid-survey-v14`, initialization
`2026-10-20T15:30:37.799Z`. No competing survey driver was found.

Session 9b.2 surveyed 12 stock presets and the saved 9a control. One extra
candidate was replaced. Grid operations were read-only. Public fixture
operations created, muted, loaded, and deleted 27 scratch tracks across the
broad and catalog passes. All scratch tracks were deleted. No extension
change, native Grid write, engine command, transport command, or save ran.

The [report](../data/phase9b-survey/survey-report.json) contains per-preset
results, costs, and preservation checks. The [catalog](../data/phase9b-survey/catalog-first-pass.json)
contains 55 type UUIDs and 63 observed UUID/name pairs. The names overlap
49 of 232 module filenames. Names can be edited: this is lexical coverage,
not a canonical name map. For example, one type appears as both `Dry/Wet`
and `Steppy`; different types appear as `Crush`.

## Sample and limits

The broad control reads agree and match E276 after instance UUID/managed-ID
normalization. All seven returned stock graph pairs agree, but are incomplete.
Five other presets refuse during route schema discovery, before graph reads.
The catalog projection gives eight complete paired inventories, including
the control. It reads membership, names, and type UUIDs only. It makes no
cable or content claim.

| Preset | Flavour | Catalog modules | Broad graph |
|---|---|---:|---|
| gn-grid-spike-baseline | Poly | 4 | Complete; 2 cables |
| Whispering Loops | Poly | 10 | Incomplete |
| WT Parkour | Poly | 19 | Incomplete |
| SEMtex Motion Seq | Poly | Unknown | Schema child cap |
| Benjolin | Poly | Unknown | Schema child cap |
| Humongous FeedPad | Poly | 8 | Incomplete |
| Grid Repeater | FX | Unknown | Schema child cap |
| Sequenced FX Trigger | FX | 16 | Incomplete |
| Grid Multi FX | FX | 31 | Incomplete |
| Adaptive Crush | FX | 10 | Incomplete |
| Auto Scaler-Arp | Note | 16 | Incomplete |
| Stutter Steps | Note | Unknown | Schema child cap |
| Poly Pitch Envelopes | Note | Unknown | Schema child cap |

Stock cable counts remain unknown. A partial graph cannot prove the total.
`Grid XComp Multiband` had no recognized top-level Grid name after verified
insertion. The driver stopped and deleted its scratch track. The exact
bank was not retained on that first failure; its nesting or renamed-device
cause is unproved. `Adaptive Crush` replaced it. The driver now records the
bank and treats this case as a target-scope result.

The route schema reads all relationships on `device_contents`. One count
above 256 causes `schema-child-limit`, even if the wanted child is small.
The failing relationship is not identified in these replies. Do not infer
that the preset has more than 256 modules. Other graphs reach the shared
4,096-work cap; counters can report 4,097–4,098 after refusal bookkeeping.
Automatic serializer-field discovery also reaches unsupported `v3K` values
in `desktop_settings.color`. That is an editor-color limit, not proof of an
unreadable audio resource. Caps were not raised.

## Dimension verdicts

| Dimension | Verdict | Evidence and remaining scope |
|---|---|---|
| a — Knob and outer modulation | Extension needed; exact connection model unknown | `modulation_source_atom` exposes mappings at 3616/11497. Parameter atoms expose 3615. `inport_connection` exposes source 248 and port index 249. The existing projections omit important mappings and outer-device traversal. No complete knob edge was proved. |
| b — Stateful content | Extension needed | Gates data appears inline as 64 floats at `data_array_component` field 6609, with size 6613. Wavetable schema exposes resource/playback relationships 11161/11162, omitted by the serializer projection. Resource identity and loading remain unproved. Sampler/Audio File coverage is unknown; the filename guess for Whispering Loops actually yielded Wavetable. |
| c — Catalog | First pass complete; canonical mapping needs work | 55 UUIDs, 63 observed name pairs, 49 exact filename overlaps. Aliases and custom names prevent a direct UUID/name dictionary. No module-file decoding. |
| d — FX and Note Grid | Same container model; full read coverage needs extension | Paired catalog reads use `module_grid` in all three flavours. Observed child indices are Poly 7, FX 5, Note 4. Note I/O classes differ. This proves no cross-flavour write. |
| e — Scale | Catalog model works at 31 modules; broad model needs extension | Grid Multi FX has 31 complete paired catalog members. Its broad graph reaches the work cap. Full 20–40-module content/cable coverage remains unproved. |

Non-decimal and bipolar atoms occur in captures, but no new setter was tested.
The [schema inventory](../data/phase9b-survey/observed-schemas.json) records
35 descriptor/runtime pairs and their first captured schema. It covers
oscillator, value, audio/note I/O, modulation, array, transport, and display
classes. Presence in an incomplete graph is not full family support.
The [symbol manifest](../../plan/phase-9/9b-grid-symbol-manifest.md) retains
all pinned members. No new obfuscated member was added.

## Driver repairs and preservation

After the first batch, cursor 0 had an empty track identity. The next
preflight stopped before a fixture write. [Inspection](../data/phase9b-survey/cursor-inspection.json)
and [read-only repointing](../data/phase9b-survey/cursor-recovery.json)
proved recovery through another existing track. The driver now parks both
survey cursors on a preserved track before deletion. Two later batches
complete with equal entry/exit snapshots. The added cost is two bounded
cursor points, a track read, and a repeated ownership/selection check per
delete. The 40-poll bound per point is unchanged.

The [first entry](../data/phase9b-survey/live-v14/before.json), both later
entries, and both later exits are equal. The original three tracks, device
banks, mixer state, and selection remain unchanged. `grid-probe` is muted
at -10 dB. A [final paired read](../data/phase9b-survey/live-v14-preserved/result.json)
proves the original four-module/two-cable graph still matches the normalized
E276 baseline. Every run exits without an owned scratch track or uncertain
write. A [final status check](../data/phase9b-survey/final-state.json) confirms
that the reader is released and unlocked. The engine was reported active
at entry; it was not independently measured or changed. Scratch setup can
mark the project modified. Saved-file identity and the UI save marker were
not tested.

The driver also accepts an explicit catalog query and keeps `presetPath`
separate from the descriptor path. Earlier batch results overloaded `path`;
the report resolves preset filenames from the saved target records.

## Cost and verification

The initial control captures take 46.647 and 49.446 ms on the wire, within
E276's 43.599–50.752 ms range. Broad captures take 41.587–52.908 ms on the
wire and 1.454–14.018 ms in document tasks. These include incomplete reads.
Returned graphs are 35,831–112,980 bytes. Catalog captures take
45.672–50.491 ms wire, 0.360–3.080 ms document, 424–2,449 shared work units,
and 4,414–30,860 bytes. The largest complete inventory has 31 modules.

Each successful catalog session has seven read-session calls. Fixture
setup and guards dominate the batch: its 13 candidates use 1,719 logged
wire calls with 40,694.520 ms summed call time. Concurrent public frames
mean summed call time is not batch wall time. The report retains all run
ranges and logs. Product call budgets and descriptions remain unchanged
at v52.

Catalog heap samples change by 0–2 MiB. Broad samples change by 2–38 MiB.
Two first-discovery captures show 38 MiB increases; process heap includes
other host work and is not an allocation or peak measurement. The prior
8 MiB planning allowance is not supported as a bound. Session 9b.2a must
measure focused traversal and revise that estimate before generalization.
No stable full-graph performance or memory bound is claimed.

Typecheck and all eight focused survey tests pass. The offline report
checks snapshot equality, baseline equivalence, and clean exits. Context
links and diff checks pass. The extension is unchanged from E301's checked
and deployed V14.

## Next and lesson

[9b.2a](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b2a--focused-reader-coverage)
adds selective schema discovery and focused parameter/resource projections.
Retest representative refusals and the 31-module patch. Then 9b.3 can test
one non-decimal value, one knob-modulation edge, and one stateful factory
case with sufficient independent readback. Keep resource loading and
cross-flavour edits conditional on those reader results.

Park research cursors before deleting their track. Keep resource and
connection questions separate from editor-only fields. Filename-based
candidate selection needs content checks; it does not establish coverage.
