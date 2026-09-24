---
title: E130 — Constant-time launcher-clip read search
kind: evidence
state: active
updated: 2026-09-24
parent: ../../plan/phase-7/7b-follow-up-constant-time-launcher-reads.md
---

# E130 — Constant-time launcher-clip read search [K]

## Verdict

Bitwig Studio 6.0.6 and Controller API 25 expose no direct complete note
enumeration. However, `Clip.addStepDataObserver` is a supported sparse
occupancy index. A cursor target, grid, or page change clears the prior occupied
cells and replays the complete occupied view. One note edit reports its changed
cell.

The callback returns only `x`, `y`, and `state`. It has no MIDI channel, note
properties, clip identity, or completion signal. Sixteen notes on the same
time and pitch collapse to one occupancy cell. The observer is not an
authoritative note read by itself.

The selected candidate combines the sparse `NoteOn` coordinates with targeted
`Clip.getStep` reads across all 16 channels. This can avoid calls for empty
time and pitch cells. It remains page-bounded in clip extent, and its complete
field, timing, freshness, and settlement behavior must pass the next
acquisition proof before product use.

## Reproducible public inventory

`tools/controller_api_inventory.rb` reads one exact API jar with `javap
-public`. It expands inherited public methods, includes callback interfaces,
and emits only keyword-relevant signatures. Two independent runs produced the
same report SHA-256:

`9a4b985b352c61b771a6e4ae2a0a6244a7334dd4c43ce0725b7f1b3a57bd83b4`

The inventory used this source:

| Item | Value |
|---|---|
| Bitwig Studio | 6.0.6 |
| Controller API | 25 |
| Gradle coordinate | `com.bitwig:extension-api:25` |
| Jar | `/Users/jonvuri/.gradle/caches/modules-2/files-2.1/com.bitwig/extension-api/25/89a02d0a548787a44265e9053ebf9478c1458df6/extension-api-25.jar` |
| Jar bytes | 167,492 |
| Jar SHA-256 | `842b1a05a1b29b17c4440cb3609c102953e3a0d28be910e743bce6aa2a38d1b6` |
| Public types | 290 |
| Callback types | 28 |
| Declared public methods | 1,825 |
| Inherited-expanded methods | 4,747 |
| Keyword-relevant types | 209 |

The installed application contains exact-version API documentation at
`Contents/Resources/Documentation/control-surface/api`. It also contains the
legacy `ControllerScripts/api` JavaScript helpers. No second Java Controller
API artifact exists in the application or the API 25 Gradle cache. The legacy
helpers add no clip-content read route.

The inventory covered clips, launcher slots, tracks, transport, note input and
output, project and document state, application actions, browser sessions,
callbacks, and types with content, event, data, serialization, transfer,
import, export, stream, drag, or clipboard terms.

## Runtime proxy inventory

The probe-only `api.runtimeMethods` handler used `Class.getMethods()` on ten
live proxy families. It did not invoke discovered methods. The first live
handshake reported Controller API 25, 154 methods, and method hash
`8577020c7328f59a`. The observer follow-up reported 156 methods and method hash
`c6f38b114c5d9074`.

| Target | API methods | Runtime methods | Extra methods | Result |
|---|---:|---:|---:|---|
| host | 125 | 193 | 55 | No content return |
| application | 91 | 149 | 58 | No content return |
| project | 19 | 70 | 51 | No content return |
| track bank | 78 | 159 | 77 | No content return |
| track 0 | 117 | 194 | 62 | No content return |
| launcher slot 0 | 46 | 108 | 60 | Opaque internal clip proxy only |
| fine cursor clip | 81 | 134 | 53 | Internal mutation delegate only |
| launcher cursor clip | 67 | 117 | 50 | No content return |
| arranger cursor clip | 67 | 117 | 50 | No content return |
| transport | 109 | 162 | 53 | No content return |

The launcher-slot proxy exposes internal methods such as `getClip()` and
`createEmptyClipImpl()`. The returned obfuscated type has one method with
internal serialization parameters. It supplies no supported data contract,
target identity, freshness rule, or note enumeration result.

The fine cursor proxy exposes `getDelegateProxy()`. Static inspection of its
return type found internal `updateStep*` methods. They mutate one already
addressed step. They do not enumerate content. The probe did not invoke these
unsupported methods.

## Route assessment

| Route | Identity and freshness | Coverage and fields | Requirements and effects | Cost and verdict |
|---|---|---|---|---|
| Public note enumeration | No method exists. | No result exists. | None. | Unavailable. |
| `Clip.getStep` | A pinned cursor plus fresh address guards identifies the clip. | Complete only after all required grids, time cells, pitches, and 16 channels are scanned. `NoteStep` supplies the measured fields. | Needs grid and page settlement. It is read-only. | Proportional to scanned cells. It remains authoritative. |
| Serialization, transfer, or drag payload | Public clip objects expose no payload. Runtime types are opaque and unsupported. | No declared note schema or completeness rule. | Private runtime access would be version-fragile and unsafe. | Rejected. |
| Clipboard or selected-note data | Application copy and paste calls return no payload. | Selection content cannot be read. | Depends on focus and UI selection and can mutate state. | Rejected. |
| MIDI conversion, export, or bounce | No public route targets memory or a stream for one clip. | No live clip result exists. | Physical file export is forbidden by the plan. | Rejected. |
| Playback monitoring | Track note callbacks report played pitch and velocity. | They omit stored durations, channels, full expression, muted or skipped notes, and unplayed content. | Requires transport playback and cannot prove clip identity or completion. | Proportional to playback duration and incomplete. Rejected. |
| Note-step observer | Callbacks are target-scoped. Initial state is not replayed. | It supplies note fields but misses four enable-field changes. | Needs an initial authority and uncertainty invalidation. | A partial wake hint only. Rejected as authority. |
| Step-data observer | Target, grid, and page changes replay occupied cells. Edits report changed cells. | It supplies only `x`, `y`, and occupancy state. Channels and fields are absent. | It needs bounded settlement because no completion signal exists. Extent still needs pages. | Selected as a sparse index, not as authority. |
| Sparse observer plus targeted `getStep` | The observer identifies occupied coordinates for the current cursor page. | Sixteen channel reads at each `NoteOn` coordinate can return complete `NoteStep` fields. | Needs target guards, page coverage, settlement, and comparison with the complete reader. | Credible note-count-proportional candidate. Not yet promoted. |
| Persistent mirror | A session-local target key and content epoch can identify a warm entry. | It can retain complete fields only after an authoritative acquisition. Silent or ambiguous changes break coverage. | Needs explicit invalidation and an authoritative fallback. It has no project side effect. | Near-constant local warm read after initialization. Best-effort only. |
| Project or document state | Project values are coarse. Document state stores extension settings. | Neither contains clip events. | Read-only. | Rejected. |
| MIDI input, output, or note input | These objects address hardware events or inject notes. | They do not read stored clip data. | Hardware I/O or live event injection is outside this read. | Rejected. |
| Browser or content provider | Clip browsing selects content for insertion. | It does not return live project clip notes. | Can change browser or project state if committed. | Rejected. |
| Project-file parsing | It can address saved bytes, not the current live object. | Saved content can be stale and has no live freshness proof. | Requires file access and a saved project. | Rejected as a live read. |
| Named application action | No action returns semantic note data. | No coverage is declared. | It depends on focus and selection. | Rejected. |

## Observer follow-up

The follow-up came from an
[Akai Fire Nudger example](https://github.com/wimvandenborre/AkaiFireNudger/blob/api-18/src/main/java/com/akai/fire/sequence/DrumSequenceMode.java).
Its `observingNotes` name is a local callback. The relevant public API method is
`addStepDataObserver`. E53 tested `addNoteStepObserver`, not this observer
family.

One owned 16-beat fixture contained 83 page-zero notes and one late note. It
included all 16 MIDI channels at one coordinate, 48 dense notes, binary notes,
and triplet starts at `1/768`, `256/768`, `767/768`, and near beat 15.

At `1/512`, the initial target replay produced 101 callbacks and 71 final
non-empty cells. The final view contained 68 `NoteOn` cells and three sustain
cells. The 16-channel collision produced one occupied cell. Changing to an
empty clip produced 101 clearing callbacks. Changing back reproduced the same
view. Changing to a different clip with identical content produced 101 clears
and 101 replay callbacks. This proves a complete occupancy replay for the new
target, not only a content delta.

The `1/512` view discovered all tested page-zero triplet pitches. Changing to
`1/768` replayed the exact triplet coordinates. Moving to the late page cleared
the old view and replayed the one late note. Adding one note produced one
`NoteOn` callback. Clearing it produced one empty callback.

Target replay callbacks began 150 to 173 ms after preparation in the final
run. Each target replay burst finished in less than 0.6 ms. The `1/768` grid
replay began after 145 ms and spanned 2.1 ms. Page and edit callbacks began
after approximately 48 ms. These values describe callback arrival, not a
completion contract. The probe used conservative stable polling because the
API supplies no end marker.

The result corrects the initial static conclusion. Callback work follows
occupied and previously occupied cells for the tested page. It does not scan
all 2,048 by 128 cells through the bridge. It still needs one cursor page per
extent window and targeted channel enrichment before it can return complete
notes.

## Selected candidate and next proof

Keep the existing 2,048-step cursor. Use `addStepDataObserver` to collect the
settled `NoteOn` coordinates for each required page. At each coordinate, call
`getStep` for all 16 channels and retain every `NoteOn` result. Compare all
fields and normalized timing with the current complete dual-grid reader.

The next proof must measure observer settlement, targeted host reads, bridge
transfer, normalization, and total time across short and long, sparse and dense
clips. It must prove complete page coverage, all channels, same-pitch adjacency
and overlap, late notes, and optional fields. It must also decide a bounded
settlement rule without claiming that stable polling is a host completion
signal.

## Verification and live baseline

The deterministic inventory check, extension build, full brain check with
1,170 tests, context check, wire-golden check, and whitespace check pass. The
live hello, runtime inventory, and step-data observer probes pass after the
control surface was removed and added again.

The runtime inventory was read-only. The observer probe created one owned track
and three owned clips, then removed them. It restored the exact four-track
selection and stopped transport baseline. It created no file and left no test
residue.

## Retrospective

Static method inventory did not reveal the replay semantics of
`addStepDataObserver`. Live-test each observer family before classifying it by
the behavior of another observer. Keep the generated inventory and probes. A
deployed controller change requires removing and adding the control surface.
Toggling it off and on does not reload the controller.
