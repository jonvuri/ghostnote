---
title: Bitwig capability overlap source audit
kind: note
state: active
updated: 2026-10-19
---

# Bitwig capability overlap source audit

Ghostnote's strongest distinction is the checked path from an agent request to
a specific live object, with bounded writes, failure reports, and guarded
reversal. A tool that calls the same Bitwig setter does not necessarily supply
that path. However, the original report understates several other projects and
overstates some Ghostnote guarantees.

This audit covers all **40 rows** in [the original report](OVERLAP_REPORT.md).
It also examines the additional projects in `reference/`. The original report
is unchanged. The [source record](OVERLAP_AUDIT_SOURCES.md) pins the clones,
lists checks, and gives code locations. The
[improvement report](OVERLAP_IMPROVEMENT_SOURCES.md) gives candidate work and
acceptance gates. Existing scope exclusions do not exclude a candidate here.
Musical generation remains the driving agent's responsibility.

## Main corrections

| Priority | Original claim | Source audit result |
| --- | --- | --- |
| High | Direct parameters are now matched | The primitive overlaps. Control Deck uses 128 steps, a 0.02 normalized tolerance, and top-level index/name targeting. Ghostnote has finer writes, nested route guards, stable acquisition, cohort integrity checks, and reversal. See D5–D7. |
| High | Most servers match clip read and write | They implement basic operations. Their grids, channels, selection rules, timing, and verification differ substantially. See C1–C4. |
| High | No other project offers audio analysis to an agent | acidcat registers `analyze_sample`, with spectral and RMS features. It does not establish Ghostnote's complete loudness/crest/silence contract. See A3. |
| High | Sample-stub relocation and golden rebuild remain unique | bwpreset resolves object references and recomputes indices during serialization. Its no-op serializer reproduced all 24 checked Ghostnote preset files byte for byte. Ghostnote retains stronger live edit evidence, but exclusive format ownership is not established. See P8 and F2. |
| High | Control Deck has no cross-chain move or clip writer | It exposes both `bitwig_nest_device` and `bitwig_create_note_clip`. Each is narrower than Ghostnote's corresponding workflow. See D3 and C2. |
| High | A full recursive parse needs Ramona names | bwpreset fully parsed the 24 checked files without those names. All 46 detached donor objects also parsed. Six measured footprint counts agree. See F1 and F3. |
| Medium | Ghostnote has every modulation and safety feature | The matrix itself lists absent Grid and routing features. The current catalog admits 12 of 43 host modulator types. Selection restoration and reversal have explicit limits. See P2, S2, and S4. |
| Medium | Eight projects give the relevant comparison | openwig adds Arranger note/audio insertion, automation, and descriptor reflection. Gig Maestro and DrivenByMoss supply further deterministic control examples. See the additional-project section. |
| Medium | bwpreset's jar-key route is a small ready-made port | Its exact `sYG.class` lookup fails on the installed jar. The codec transfers more readily than the key extractor. See F4. |

These priorities concern decisions based on the report. They are not severity
ratings for defects in Ghostnote's implementation.

## Evidence rules

**Live** means an existing experiment record names the operation, host, result,
and limits. Those runs were not repeated here. **Checked offline** means a
check ran during this audit. **Source** means an implemented path was inspected.
**Claim** means a README or release statement only. **Not found** means no
corresponding path was found in the inspected scope; it does not establish
absence from every version or project.

Ghostnote means the current `agent-native-v1` surface, unless a row explicitly
names the library, a probe, or a historical tool. Historical evidence is read
with the later limits in E254, E258, D44, and NOW. No competing extension was
installed. No live project was read or changed.

## Clips and notes

### C1 Read launcher MIDI clips

**Ghostnote:** The current reader returns a versioned document and a target-bound
reference. Its history includes cross-clip contamination, cursor pinning,
observer settlement, row movement, and cold-read cost. The admitted document
can hold 16,384 notes. The performance ledger reports a typical read at
415–477 ms and the maximum-note case at 1,542 ms. These numbers are not a
benchmark against the other projects. [E232] [E234] [E235] [Ledger]

**Other implementations:** daw-mcp reads `getStep(0, x, y)`, caps the scan to its
cursor width, and follows the person's selected clip. Its note records include
expression fields, but the bulk read is channel 0. WigAI selects a slot, waits
500 ms, and returns a cache indexed by step and pitch, without a channel field
in the result. bitwig_agent has a 1,024-step cursor at 0.25 beat and a cache
keyed by channel, step, and pitch. These are real readers, but they do not match
Ghostnote's complete read contract. [DAW] [WIG] [AGT-init] [AGT]

Control Deck lists slot metadata. Its private `readLauncherTemplate` scans
channel 0 at 0.25 beat and limits source length to 64 beats; this is not an
exposed full-note reader, and the current Arranger dispatch does not call that
old reconstruction path. acidcat extracts `.bwclip` notes by byte signatures
and nearby fields, not by a full clip-object grammar. Mark both as partial for
this row. **Source candidate:** acidcat for an offline `.bwclip` import spike,
with channel and timing validation. [CD-clips] [CD-dispatch] [AC-format]

### C2 Write launcher MIDI clips

**Ghostnote:** A write can preserve untouched notes and expression, check the
document basis, reject unsupported timing before a host write, read the result,
and retain a reversal record. Current MIDI/document normalization uses a
1/512-beat floor. Do not reuse E79's historical 1/64-beat limit as the current
one. Same-pitch overlaps can exist in imported MIDI documents but refuse at the
live clip-write boundary. [E236] [E248] [E265] [NOW]

**Other implementations:** Control Deck's public tool accepts up to 750 notes;
the controller validator permits 4,096, so 750 is the effective MCP limit. It
writes pages with `setStep`, supports channels 0–15, and requires starts on the
chosen grid. Its final check proves clip content exists, not that each note
matches; `notesWritten` is the requested count. WigAI writes to the current
cursor in a 256-step window and validates each note immediately before writing
it. A later invalid note can follow earlier writes. daw-mcp returns success
after `setStep`; bitwig_agent schedules selection and writing, with its own
fixed grid. All have useful primitive overlap. None of these paths establishes
the document, sparse-edit, and refusal-repair contract. [CD-tools] [CD-clips]
[WIG] [DAW] [AGT]

**Verdict:** Keep basic write support, but remove the implication of equal
fidelity. There is no clear upgrade source for Ghostnote's existing writer.

### C3 Arranger clips

**Ghostnote:** No default tool provides general Arranger clip read/write.

**Control Deck:** The active `arrange_launcher_clips` dispatch calls
`handleRecordLauncherArrangement`, not `handleArrangeLauncherClips`. It records
launcher playback at 666 BPM, allows one source slot per track, merges
intervals, and restores tempo and position. It schedules starts with a lead and
launch quantization. Completion reports requested intervals and transport
state; it does not enumerate resulting Arranger clips and verify their exact
bounds. Thus the matrix's unqualified check mark is too strong for exact
Arranger editing. [CD-arranger] [CD-dispatch]

**Other sources:** bitwig_agent can inspect the selected Arranger cursor and
record transport. openwig goes further: `_insertClip`, `_clipCreateAndFill`,
`_insertAudioClip`, and its descriptor reader directly manipulate or read
Arranger content through internal reflection. Its supported environment is
Windows/Bitwig 6.0.6. The local source has opt-in live tests, not evidence of a
run on this workstation. **Source candidate:** openwig is the stronger basis
for a bounded research session; neither path is a small production port.
[AGT] [OW-bridge] [OW-notes] [OW-tests]

### C4 Versioned clip document, sparse patch, and repair on refusal

**Ghostnote:** This is a distinct product capability. The basis binds edits to
observed content; note identities support targeted changes; invalid document
input returns repair information; claims and overlays have separate basis
rules. A writer that accepts an array of notes does not supply these semantics.
E233–E236 and E253–E260 describe the current path. Claims remain local to one
server session. [E233] [E235] [E236] [E253] [E255] [E260]

**Other projects:** No equivalent was found in the inspected MCP request
schemas. bwpreset has graph ownership, fragments, invalid-handle checks, and
atomic validation of some offline edits. Those are relevant design examples,
but they operate on Grid preset graphs, not live clip documents. Do not erase
that distinction by giving both a generic “safe editing” check mark.
[BP-tests] **Source candidate:** none needed for the existing document model.

### C5 Offline MIDI file read and write

**Ghostnote:** This is shipped in the 44-tool profile. It accepts SMF 0/1,
integrates tempo maps with rational arithmetic, states FIFO note pairing,
reports loss, refuses existing output paths, and verifies exported bytes by
reading them again. It does not render sustain/controller effects into note
lengths. E267 and E269 extend snapshot export and document-file handling.
[E265] [E267] [E269]

**acidcat:** `.bwclip` to MIDI conversion is a specific offline conversion.
Its wider MIDI tooling does not, by itself, establish the same document,
tempo, pairing, and publication rules. The original “✓ convert” collapses
these distinct contracts. **Source candidate:** `.bwclip` extraction, plus its
sample/preset metadata search; no reason to replace Ghostnote's SMF path.
[AC-convert] [AC-format]

### C6 Built-in chord and bassline generation

bitwig_agent has theory and generation modules. They overlap the driving
agent's work, not a missing Ghostnote primitive. Keep this row excluded from
adoption. openwig's deterministic `Note` and clip builders remain valid source
candidates; using those builders does not require adopting a composition
algorithm. [AGT-theory] [OW-song]

## Devices and parameters

### D1 Insert a device

**Ghostnote:** The complete workflow resolves native catalog names or supported
plug-in/preset sources, checks the destination, observes the inserted object,
and records the effect. Composition adds ordering and nested-target proofs.
[E56] [E57] [E92] [E258]

**Other projects:** Control Deck implements browser insertion, stock UUID
insertion, CLAP insertion, and sample-file insertion. WigAI and bitwig_agent
also insert by UUID or file path. bwpreset inserts device presets into Grid
slots offline and merges graph dependencies and attachments. Its tests cover
collisions and nested targets. These are real overlaps, not merely README
claims. **Source candidates:** Control Deck's sample/browser paths and
bwpreset's Grid-slot graph handling. Both still need Ghostnote effect and
readback integration. [CD-insert] [WIG] [AGT] [BP-slots]

### D2 Delete a device

**Ghostnote:** Directed deletion checks current structure and reports observed
removal. It does not imply that an arbitrary deleted device can be recreated
with all opaque state. The current call admits at most ten devices. [D44]
[E258] [E264]

**Control Deck:** It checks index and exact name, then calls `deleteObject`.
After 250 ms it returns `previousCount` and `verifiedCount` with success. It
does not compare those counts or require a reduction. Thus the response field
named `verifiedCount` does not prove deletion. Its targeting checks remain
useful, but the completion predicate is weaker than the original report implies.
An isolated fake-host check reproduced success when the delete had no effect
and both counts stayed at one. [Checks]
Gig Maestro and openwig expose selected-device deletion. A selection-based
delete is not equivalent to a durable target and reversal record.
**Source candidate:** none for the existing Ghostnote operation.
[CD-delete] [GM-device] [OW-song]

### D3 Move or copy devices across chains

**Ghostnote:** Chain moves preserve an existing instance. Wrapper work checks
the complete parent-child edge and scalar fingerprint, and a dedicated reverse
path can move that instance back. General `move_devices` does not acquire an
automatic `revert_change` inverse. [E91] [E93] [NOW]

**Control Deck:** Change “—” to partial. `bitwig_nest_device` moves a top-level
child into a parent's native slot and checks the count plus a nested-bank or
cursor witness. It is not general cross-track/cross-chain copy or move. The
handler validates `slotName` against available names but calls the current
cursor slot's `selectInEditor`; it does not explicitly select that requested
name. Its first nested-device check also assumes the child is at index 0 even
though the insertion uses the chain end. These are reasons to test nonempty
and multi-slot parents before treating the operation as complete. [CD-nest]

**Source candidate:** the insertion-point primitive is already in Ghostnote.
The competing workflow is not an evident upgrade.

### D4 Layer chains and nested containers

**Ghostnote:** The difficult work includes fixed empty seeds, exact trimming,
live entry naming, nested coordinates, late-bound outer modulation, partial
checkpoints, and reverse-order cleanup. E93 proves Instrument Layer and FX
Layer and records why a generic Chain is not equivalent. The observed route
depth is two; structural capacities are bounded. D44 further limits current
composition to six weighted device units. Three modulated layer chains cannot
be built in one admitted composition. [E90] [E93] [D44] [NOW]

**Other projects:** Control Deck's one-slot nesting overlaps only a narrow
part. bwpreset preserves nested device graphs and exposes Grid-slot targets
offline. DrivenByMoss has layer navigation and controls, but those are not an
agent composition transaction. **Verdict:** Ghostnote has the stronger checked
live composition path in this inspected set. Avoid “all containers” or a
market-wide uniqueness claim. [CD-nest] [BP-slots] [MOSS-layer]

### D5 Any direct parameter beyond eight remote controls

**Ghostnote:** Direct IDs work on native, VST3, and CLAP devices. The history
includes normalized-write resolution, fresh observer generations, same-type
switches, nested route guards, targeted display observers, and stable complete
inventories. E91 checked all 2,185 Zebra3 VST3 rows while moving an instance.
The encoder sends `resolution: 1`; the current agreement tolerance is 0.002.
Typed discrete-domain checks apply where host metadata exists. Exact physical
unit writes are still not general. [E55] [E57] [E77] [E82] [E91] [E98]
[E243] [E244] [GN-encoder] [GN-adapter]

**Control Deck:** It genuinely enumerates stable direct IDs and writes them.
The standard path rounds to 128 levels; a MatrixBrute case uses 256. It accepts
a 0.02 difference and has a conditional VST3 compensation for a 1/16384
signature. The parameter tools address the top-level device bank; selected
nested remote controls are a separate path. This matches access to the API,
not Ghostnote's precision and nested-write contract. [CD-params]

**WigAI and bitwig_agent:** Both relevant implementations use
`CursorRemoteControlsPage`. WigAI's `deviceParameterBank` name does not make it
a DirectParameter bank. Paging or searching these controls by name does not
reach every direct parameter. Change WigAI's “partial by name” to “remote-page
access only in the inspected path”; resolve bitwig_agent's “?” the same way.
Gig Maestro also uses eight remote controls. [WIG] [AGT-init] [GM-device]

**Source candidate:** bwpreset's descriptor-based unit conversion for a bounded
offline feature; do not import Control Deck's coarse write path as an upgrade.

### D6 Write checked by readback

**Ghostnote:** Parameter verification checks identity, requested values, and
unrequested inventory deltas. It distinguishes a completed mismatch from a
failed read. Partial effects remain visible. It does not identify who caused a
concurrent external delta. [E82] [E258] [GN-adapter]

**Control Deck:** Parameter writes compare observed normalized values after a
400 ms delay. Tempo and mixer writes also have bounded verification, with
negative tests. Therefore “parameters only” understates its coverage. However,
there is no corresponding whole-inventory collateral check in this parameter
handler. bitwig_agent returns current/displayed values immediately in the
setter's scheduled task without comparing them with the requested value.
WigAI's setters acknowledge the call. **Verdict:** compare the actual predicate,
not the presence of a `current_value` key. [CD-params] [CD-mixer] [CD-tests]
[AGT] [WIG]

### D7 No dependence on the person's selection

**Ghostnote:** Durable tracks, route guards, owned pinned cursors, and selection
leases reduce interference. E77 includes a depth-two write under a concurrent
selection change. This means the request does not rely on the person's entry
selection; some host operations still move selection temporarily. [E77] [E99]
[E250] [E258]

**Control Deck:** Explicit index/name inputs make its operation independent of
the initial selection. It then calls `selectInMixer`, selects a cursor device,
and waits. Index plus name is not durable identity when two objects have the
same name or the chain changes. No general entry-selection restoration appears
in this path. WigAI and bitwig_agent mix explicit indices with shared selected
cursors. **Verdict:** split explicit addressing, interference resistance, and
selection restoration into separate tests. [CD-select] [WIG] [AGT]

### D8 Device enable and bypass

**Ghostnote:** A bounded batch writes enabled state with structure guards and
readback; the D44 limit is 32 settings. [D44] [GN-device]

**Other projects:** Control Deck reports `enabled` in snapshots, but the
inspected named MCP tools do not provide a dedicated enabled-state setter.
Its generic action tool is not an exact equivalent. WigAI also reports bypass
state. Gig Maestro explicitly implements `device/setEnabled` on its cursor,
and DrivenByMoss has device controls. Separate read support from directed
write support. **Source candidate:** no missing Ghostnote primitive here.
[CD-tools] [CD-select] [WIG] [GM-device]

## Presets and modulation

### P1 Read preset modulator topology

**Ghostnote:** Semantic locations select one device's modulator list. Inspection
reports public types, targets, amounts, and mapping limits. The later editor
checks the file fingerprint and preserves sibling lists. This solves a harder
problem than finding all modulator-looking bytes. [E86] [E87] [GN-inspect]

**bwpreset:** The codec parses arbitrary supported object graphs. The named
`Patch.from_preset` editing API requires a root Grid. Thus general syntax
coverage and Grid-specific semantic authoring must be scored separately.
acidcat's “tree” is a union of path strings; its structure list uses class-name
token patterns. It can omit unreferenced objects and is not a full topology
proof. **Source candidate:** bwpreset's parser and ownership model. [BP-codec]
[BP-import] [AC-format]

### P2 Add or edit modulators on stock devices

**Ghostnote:** The public catalog currently admits **12 types out of 43 host
types**: ADSR, Beat LFO, Classic LFO, Curves, LFO, Ramp, Random, Segments,
Vector-4, Vector-8, Vibrato, and XY. There are 46 donor assets representing
42 curated types; these counts are not interchangeable. E96 gives the exact
page and behavior evidence and the reasons for the remaining refusals.
Sampled-preset operations have further footprint restrictions. [Manifest] [E96]

Editing a preset creates a changed file image and loads it through a recorded
insertion. Modulating an existing live device uses the owned wrapper/move
workflow. Do not describe either as an arbitrary in-place modulator editor for
every existing device. The default profile now proves supported route identity,
not sounding behavior on every call. [E87] [E91] [E254]

**bwpreset:** Its semantic builder is Grid-rooted. It does not yet replace this
stock-device live workflow. Its app-definition templates could widen donor
coverage. openwig has comments about modulator mapping, but the actual exposed
handler here only opens the browser; no programmatic modulator insertion path
was found. **Source candidate:** bwpreset definitions, subject to version and
live instance checks. [BP-import] [BP-defs] [OW-mod]

### P3 Modulators on Grid devices

**Ghostnote:** No supported general Grid authoring workflow is established by
the current surface. “—” should mean that boundary, not that the binary library
cannot encounter a Grid object.

**bwpreset:** `Patch.modulator` builds module state and routes on a Grid root.
Its verification ledger records generated Poly Grid loads and audible
modulation. FX Grid, Note Grid, per-voice behavior, assets, and several newer
state options still need live checks. **Source candidate:** strong for an
offline Poly Grid feature; do not claim all Grid variants are live-proved.
[BP-build] [BP-live]

### P4 Routing target and amount

**Ghostnote:** The library changes targets and amounts, and the public paths
bind those changes to inspected lists and proved route forms. Cross-device
container routes survived relocation in specific live tests. D46 does not
extend that proof to every syntactically valid path. [E68] [E85] [E87] [E254]

**bwpreset:** `make_routing` writes target, descriptor, amount, flags, and scale
source. Amount is in the parameter's native units unless `normalized=True`
uses a known descriptor range. It checks ownership and rejects unsupported
normalized ranges. The same field ID does not prove that the two public
amount inputs have the same meaning. **Source candidate:** descriptor and
ownership logic, with unit-specific tests. [BP-route] [BP-tests]

### P5 Routing mode, scale source, and enabled flag

**Ghostnote:** No public editor for all three fields is established in the
current modulation tools. Existing unknown fields can survive byte surgery;
preservation is not named edit support.

**bwpreset:** Seven modes are mapped: linear, absolute linear, inverse absolute
linear, cubic, inverse cubic, positive rectify, and negative rectify. Mode
codes are `0, 2, 3, 4, 5, 6, 7`; do not assume a contiguous 0–6 enum. The
writer uses `0x2c4c`, `0x2d2c`, and `0x2d3b`; tests cover mode/scale/enable
and deletion of a scale source. The completion ledger leaves live verification
pending. **Source candidate:** good bounded port. Start with enabled state,
then modes, then scale-source ownership and remapping. [BP-route] [BP-model]
[BP-tests] [BP-status]

### P6 Grid patch authoring with modules and cables

**Ghostnote:** No named product capability. Research now proves semantic reads,
guarded parameter writes, and bounded cable connect, disconnect, and native
source replacement on a four-module Poly Grid fixture. Cable undo/redo and
edited-state save/reload pass. E281 adds isolated and connected spare-module
deletion, exact readback, undo/redo, and persistence. Module creation and DSP
adoption remain unproved.
See [E277](experiments/e277-grid-value-write-readback-and-persistence.md) and
[E279](experiments/e279-grid-cable-connect-disconnect-and-persistence.md), and
[E280](experiments/e280-grid-retarget-and-module-delete-probe.md), and
[E281](experiments/e281-grid-module-delete-and-persistence.md).
This does not establish general Grid authoring.

**bwpreset:** This is its central feature, with typed ports, module instances,
cables, remote pages, fragments, deletion/reindexing, and preserved unknown
state. Tests include foreign ownership, dangling handles, failed import, and
dependency boundaries. The inspected project is substantially more developed
than a serializer demo. **Source candidate:** high functional value, medium or
large integration effort. A deterministic graph tool leaves creative decisions
with the agent. Prove one oscillator/filter/output Poly Grid path before FX,
Note, feedback, and per-voice claims. [BP-build] [BP-tests] [BP-live]

### P7 Modulator construction without a saved donor

**Ghostnote:** Raw donor bytes and manifest provenance are the present
construction source. A catalog entry alone does not eliminate that dependency.
[GN-donors] [Manifest]

**bwpreset:** `module_definition` builds templates from installed application
definitions, and schema discovery reads `.bwmodulator` resources. This removes
the need for a user-saved donor for supported definitions; it still depends on
the installed app, recovered schema, and special payload handling. Its
completion ledger reports 43 modulator definitions, not 43 fully live-tested
stock-device workflows. **Source candidate:** strong, but blocked as a direct
drop-in on this installation by the jar-key lookup failure. [BP-defs]
[BP-schema] [BP-key] [Checks]

### P8 Sampled presets with valid reference stubs

**Ghostnote:** E67 proves all four multisample stubs moving by exactly 16
objects for a specific LFO donor. E69 brackets selected donor counts with
accepted and rejected loads. The code matches resident donor bytes and refuses
unknown footprints. This is strong evidence for the admitted edits, not for
all sampled content. [E67] [E69] [GN-stubs] [GN-donors]

**bwpreset:** References become shared object identities on parse. Serialization
assigns fresh indices, so relocating a subtree need not use a per-donor delta.
Assets and slots also have tests for shared references, opaque state, and
attachment collisions. This is a substantive competing implementation of the
underlying problem. The audit reproduced both sampled fixtures and plug-in
attachments byte for byte without an edit; that does not prove edited samples
load or sound correctly. **Source candidate:** high priority. Port the graph
or compute contextual counts while retaining the existing live gates.
[BP-codec] [BP-assets] [BP-slots] [Checks]

### P9 Apply to a device in the live project

**Ghostnote:** Distinguish inserting an authored preset from wrapping an existing
instance. The wrapper keeps the same device instance and checks observed
scalars and structure. It cannot read back every byte of opaque plug-in state.
Current default modulation results report `behaviorWitness: not-run` and their
route claim. Separate conformance runs supply behavior evidence. [E91] [E254]

**Other projects:** bitwig_agent and openwig insert `.bwpreset` paths through
host insertion points. That is real live loading, but not exact-instance
replacement with a scoped checkpoint and a guarded inverse. bwpreset supplies
files and a verification framework, not a shipped Ghostnote-like agent apply
transaction. **Source candidate:** use Ghostnote's existing load boundary for
new bwpreset-derived files. [AGT] [OW-mod] [BP-live]

## Audio and mixer

### A1 Mixer volume, pan, mute, and solo

**Ghostnote:** E257 establishes the raw fader law `dB = 60 × log10(raw)`,
readback, and reversal. This matters because plausible linear-to-normalized
conversions can give the wrong level. [E257]

**Control Deck:** The original table omits an implemented overlap. It writes
normalized volume/pan and booleans, then verifies all requested fields. Its
controller tests cover setters that do not take effect. bitwig_agent maps
negative dB through `10^(dB/20) × 0.8` into a normalized fader. That is not the
measured Ghostnote contract. It returns intended settings without an equivalent
settlement comparison. **Source candidate:** Gig Maestro's sends and related
controls extend breadth; no replacement for Ghostnote's volume law is needed.
[CD-mixer] [CD-tests] [AGT] [GM-sends]

### A2 Capture master output to a file

**Ghostnote:** Implemented and previously live-tested, but absent from the
default tool profile. E125 includes recorder ownership, saved-project
association, file settlement, SHA-256, sample range, and failure cleanup. It
does not isolate the selected clip from other master output or establish
sample-exact alignment. The live example had 788 ms lead and 273 ms tail.
[E125] [GN-audio]

**openwig:** `render_to_wav` records the default Windows WASAPI loopback while
the arrangement plays. It checks for silence. This can capture system output;
it is not Bitwig's own offline bounce or a portable master-file identity
contract. **Source candidate:** low for macOS capture. Exposing Ghostnote's
existing composition is a more direct candidate than porting this renderer.
[OW-render]

### A3 Loudness, brightness, crest, and silence facts

**Ghostnote:** E124 and E125 tie facts to verified bytes, channel scope, sample
range, and provider results. These components are not default tools. [E124]
[E125] [GN-audio]

**acidcat:** `analyze_sample` is an MCP tool. It invokes
`extract_audio_features`, which computes spectral centroid, RMS, and other
features with librosa. The MCP surface also provides BPM/key analysis and
similarity search. Thus “no other project offers analysis to an agent” is
false. These features do not automatically equal integrated loudness, a crest
contract, bounded silence intervals, or verified source-byte identity.
**Source candidate:** strong for library search and optional feature analysis;
retain Ghostnote's source and scope validation. [AC-mcp] [AC-analysis]

### A4 Stem separation and audio to MIDI

**Ghostnote:** Missing from the default feature set. Transcription and
separation are analysis/transformation capabilities, so the exclusion of
musical generation does not automatically exclude them.

**Superpowers:** The public repository supplies installers and release claims,
not the implementation source needed to audit or borrow the algorithms. There
is no clone in `reference/`. Retain claim-level support for the menu features;
do not call it a verified open-source donor. No solid separation/transcription
implementation was identified in the other inspected paths. **Source
candidate:** none established in this set. [SP]

## Safety and operations

### S1 Readback on every write

**Ghostnote:** Interpret this as a public write-result contract, not a promise
that every write succeeds or can be fully observed. E258 distinguishes
`verified`, `differs`, and `unavailable`; failed reads retain recorded effects.
Its fake suite covers many write tools, with explicit gaps for preset loads
and composition. Modulation behavior is not sampled on each default call.
The 123 focused tests run here include the unavailable-readback suite.
[E258] [E254] [GN-readback] [Checks]

**Others:** Control Deck verifies parameters, tempo, mixer, and selected
structural facts. Its clip write checks occupancy, and its generic action tool
only acknowledges invocation. bwpreset has strong offline validation for some
graph operations. “The other projects state none of these safety features” is
therefore too broad. There is still no inspected equivalent to Ghostnote's
uniform effect/readback envelope across these live tool families. [CD-tests]
[CD-clips] [CD-dispatch] [BP-tests]

### S2 Change log and guarded revert of agent edits

**Ghostnote:** This remains a substantial distinction. Reversal checks the
current target and recorded state instead of blindly undoing recent host
commands. E264 separates revert fidelity from redo fidelity and names removed
objects. Added devices must be reverted newest first. General device/clip
moves, track creation, scene creation, and layer duplication do not all have
automatic complete inverses. Session-local records do not survive a new
server session. [E264] [NOW]

**Other projects:** Gig Maestro's transaction can call application undo once
per completed operation. The source does not establish that one RPC operation
equals one undo event or that no human action intervened. openwig also exposes
undo/redo. Neither is a guarded inverse of a named agent change. No equivalent
checkpoint system was found in Control Deck. **Source candidate:** no upgrade
to the existing Ghostnote reversal model. [GM-transaction] [OW-song]

### S3 Separate destructive tools

**Ghostnote:** D20's separate directed operations and current guard/refusal
rules are meaningful. This is permission structure, not universal prevention
of destructive effects. A revert can itself remove an object. [E264] [GN-device]

**Control Deck:** Delete tools require current index and exact name. However,
`bitwig_invoke_action` exposes a generic action ID, and clip replacement uses
`replace=true`. Those routes do not preserve the same narrow destructive-tool
boundary. Gig Maestro's generic dispatcher and transaction are similarly broad.
**Verdict:** partial safety overlap; do not equate MCP annotations or a “safe”
name with equivalent authority checks. [CD-tools] [CD-dispatch] [GM-transaction]

### S4 Selection restored after a write

**Ghostnote:** E258 proves slot and mixer restoration for specific operations
and reports when restoration is unavailable. It explicitly leaves device-layer
selection from `chain.create` unrestored. A person's mixer click inside the
write turn can be indistinguishable from the host's own move and be replaced.
Thus the unqualified check mark needs a scope note. [E258]

**Others:** Control Deck's device path actively changes track/device selection;
no general restore scope is present. Restoring transport position after
Arranger recording is a different capability. WigAI and bitwig_agent use
selected cursors without a comparable lease and restore outcome.
**Source candidate:** none identified. [CD-select] [CD-arranger] [WIG] [AGT]

### S5 Call budgets and performance ledger

**Ghostnote:** The ledger connects primitive costs, complete product paths,
maximum admitted inputs, heap, and regression causes. Call-budget tests detect
extra adapter/wire calls. This is a material capability: the history includes
a 111-second long-clip write reduced by a wider writer and parked cursors, plus
composition limits chosen after live measurement. [Ledger] [E248] [D44]

**Others:** Control Deck has bounded queues, timeouts, and tests for stalled
requests. Those are useful, but they are not a measured per-tool cost contract.
openwig has waits and bounded traversals. No corresponding live performance
ledger was found in the inspected projects. Do not claim Ghostnote is faster
without running comparable workloads. [CD-tests] [OW-notes]

### S6 Versioned tool descriptions

**Ghostnote:** The separate description cohort is v52, with 44 tools. It is
part of the migration and test process. NOW states that no client trial used
v52; versioning does not prove that the current wording was independently
understood. [NOW] [GN-descriptions]

**Others:** Server/package versions, tool schemas, agent skills, and API docs
exist. No separate description-cohort process equivalent to Ghostnote's was
found in the inspected sources. Keep this as an operational distinction,
not a musical capability or proof of general safety. No description changed
in this audit. [CD-tools] [BP-status]

## Format reverse engineering

### F1 Full parse of the 0002 object stream

**Ghostnote:** `stream.ts` deliberately uses signatures and bounded slices.
Its comment says a full recursive parse is impossible without Ramona schema
names. The audit directly disproves that statement for the checked corpus.
The comment and original spec were not changed. [GN-stream]

**bwpreset:** The codec handles 21 value tags, object/list terminators,
references, maps, tagged values, strings, arrays, and attachments. All 23
Ghostnote fixtures plus the layer seed parsed completely and serialized byte
for byte. All 46 raw donor objects were consumed completely. The checked
preset fields include real `0x02` values: the zoo contains field `0x2c14`
with value 2048, and the two Zebra3 LFO files contain `0x1319` with value
1041. These require more than an 8-bit value. The run does not establish real
fixture use of `0x06` or `0x1a`; those remain source-supported types here.
It also does not prove every installed preset, future format, or malformed
input. **Source candidate:** strongest immediate reuse opportunity.
[BP-codec] [Checks]

**acidcat:** The Bitwig reader uses bounded scans and pattern extraction.
Score it as heuristic metadata/structure reading, not partial progress through
the same recursive grammar. [AC-format]

### F2 Write 0002

**Ghostnote:** Byte surgery is narrow, but it has independent Python-oracle
checks, golden reconstruction, metadata dependency maintenance, attachment
offset repair, and targeted live load evidence. The focused oracle tests
passed in this audit. [GN-oracle] [GN-bwtests] [Checks]

**bwpreset:** Full graph serialization and reference reindexing are real. The
24 byte-exact no-op round trips are stronger evidence than a README claim,
but they do not establish semantic edit correctness or a valid live load after
each edit. Its unknown-state and fragment tests are further useful sources.
[BP-codec] [BP-tests]

**acidcat:** Resolve “?” to “experimental metadata writer only.”
`edit_bitwig` splices strings but does not repair header body/attachment
offsets. In this audit, changing `creator` on `mp_bare.bwpreset` added 35
bytes and kept the body offset unchanged. bwpreset then rejected the result
while parsing at the old offset. The edit was in memory only. Do not borrow
this writer for Ghostnote presets. [AC-write] [Checks]

### F3 Load gates and footprints

**Ghostnote:** The important evidence is causal: duplicated identity pairs
reject, exact counts load while adjacent counts reject, sibling lists remain
unchanged, and sampled references point to the correct objects. Grid
coordinates form a list-local identity pair; the display name is separate.
[E67] [E69] [E95] [GN-bwtests]

**bwpreset:** It uses three-row coordinates and graph-based reference indices.
Its default layout is not equivalent to Ghostnote's tested duplicate-pair
rejection contract; caller-supplied coordinates need separate validation.
However, computed counts now have direct local support: all six non-null
manifest footprints agree with parsed object counts. [BP-build] [Checks]

The old `expressions-poly` donor parses as **eight objects**. E69 swept deltas
10–57 and called that the complete possible range. The actual count is below
its lower bound. This corrects the search premise, not the live verdict. An
eight-object delta may still fail for another reason. Also, removing catalog
refusals requires page/instance and payload proof; many refusals are not
footprint failures. [E69] [E96] **Source candidate:** contextual footprint
calculation followed by a narrow Expressions live test.

### F4 Decode 0004 definitions

**bwpreset:** The source reads one obfuscated class method, recovers 128 bytes,
and decodes salted streams offline. That is a real implementation. On this
installed Bitwig jar, `installed_key()` fails because
`com/bitwig/base/serial/file/sYG.class` is absent. No key or proprietary
definition content was saved. [BP-key] [Checks]

**Nitro:** Its key extraction and `nitro-std` live-JVM route concern different
artifacts. They do not directly prove decoding of `.bwmodulator` `0004`
streams. Replace the original Nitro partial cell with “different format.”
**Source candidate:** bwpreset's decoder, after a version-specific key resolver
or structural discovery. openwig may inform discovery, but it is not already
a replacement extractor. [NITRO] [OW-bridge]

### F5 Ramona field names

No complete numeric-field-ID-to-name table was found. openwig does materially
change the research baseline: its descriptor walker obtains class names,
numeric property IDs, relationships, and values from live document objects.
Its note reader interprets selected numeric IDs and class names. That is
partial schema access, not all field names. [OW-bridge] [OW-notes]

**Source candidate:** prioritize a bounded read-only descriptor experiment over
an undirected jar search. Verify the mapping on a known object and exact host
build. Keep missing properties, truncation, and filter fallback visible. The
walker can fall back to including properties when its serialization filter is
unresolved; output must not silently become an authoritative schema.

### F6 Nitro DSP decompile

**Nitro tools:** The compiled DSP parsing/decompilation and archive tooling are
implemented. The project itself says modified/repacked image loader acceptance
is unproved. Runtime standard-library extraction also requires a live JVM.
This work is relevant to device internals but does not implement live agent
parameter, modulation, or preset-edit contracts. [NITRO]

**Ghostnote:** No equivalent DSP decompiler is claimed. **Source candidate:**
useful for a future DSP-specific research task, not a low-cost way to fill the
present live-control gaps. Earlier out-of-scope decisions are not the reason
for this lower priority; the missing end-to-end loading proof is.

### F7 Live load proof

This row needs an object and operation, not a single check mark. Ghostnote has
live proofs for admitted native, sampled, plug-in, wrapper, and container
cases on 6.0.6. E96 still refuses most host modulator types; E254 deliberately
moves sounding-route checks into conformance. [E67] [E91] [E96] [E254]

bwpreset records generated Poly Grid loads, audible modulation, remotes, Steps,
Segments, and selected newer modules on 6.1.3. Its pending table explicitly
lists FX/Note Grid, feedback, per-voice, assets, bindings, and slot devices.
That evidence is narrower than full feature completion, but it is not
negligible. Nitro's untested modified-image acceptance should be “unproved,”
not a partial success. acidcat's metadata editor asks for reload validation.
**Source candidate:** preserve both projects' operation-specific live matrices
when testing ports. [BP-live] [NITRO] [AC-write]

## Additional cloned projects

| Project | What the source adds | Assessment for Ghostnote |
| --- | --- | --- |
| openwig | Reflection-based Arranger MIDI/audio insertion; automation breakpoints; descriptor traversal; Windows loopback capture | Major research source. Version resolution, document-thread scheduling, selected cursors, and restoration need review. Its project reader can create a temporary baseline track when reading parameter differences; do not treat every read API as non-mutating. [OW-bridge] [OW-project] |
| Gig Maestro in `bitwig-extensions` | Sends, cue markers, groove controls, selected-device operations, transactions, RPC/CLI surface | Good breadth examples. Eight remote controls are not all direct parameters. `undoAll` is not guarded reversal. Named Arranger UI handlers are not direct clip editing. [GM-device] [GM-arranger] [GM-sends] [GM-transaction] |
| DrivenByMoss | Layer/device navigation, note expression, transport/automation controls, OSC | Useful mature controller patterns. These do not by themselves supply agent identity, readback, or change records. Review its LGPL terms before choosing a copy strategy. [MOSS-layer] [MOSS-clip] |
| BitX | Clip/cue-name commands, selector switching, sends, MIDI program changes, tempo changes | Deterministic commands can inform breadth. They do not show the complete checked workflow. No license file was found in this checkout; no copy recommendation until permission terms are clear. [BITX] |
| bitwig-device-hacks | Historical Bitwig 2.0 Math modulator repacking | Historical context; Nitro and bwpreset are stronger current starting points for their respective formats. [HACKS] |

## Audit conclusion

The source supports a narrower and more useful distinction than “Ghostnote is
unique”: Ghostnote has unusually extensive evidence for target identity,
preservation, refusal, readback, and recovery across live edits. Those hard
parts are often absent from apparently similar tools. Its own guarantees are
bounded and must stay explicit.

bwpreset is the clearest implementation source for a missing capability.
Control Deck adds several real primitives omitted by the first report.
openwig is the strongest new source for capabilities beyond the public API.
acidcat is useful for search and analysis, but its Bitwig writer is not a
sound replacement for `bwmod`.

The next decisions and required proofs are in
[the improvement report](OVERLAP_IMPROVEMENT_SOURCES.md). No implementation,
tool description, controller, or live project changed in this audit.

[AC-analysis]: https://github.com/hed0rah/acidcat/blob/2d0a0479bd4527b1ffcb8610b3568788198c749c/src/acidcat/core/analysis/features.py#L104
[AC-convert]: https://github.com/hed0rah/acidcat/blob/2d0a0479bd4527b1ffcb8610b3568788198c749c/src/acidcat/commands/convert.py#L1
[AC-format]: https://github.com/hed0rah/acidcat/blob/2d0a0479bd4527b1ffcb8610b3568788198c749c/src/acidcat/core/formats/bitwig.py#L208
[AC-mcp]: https://github.com/hed0rah/acidcat/blob/2d0a0479bd4527b1ffcb8610b3568788198c749c/src/acidcat/mcp_server/schema.py#L48
[AC-write]: https://github.com/hed0rah/acidcat/blob/2d0a0479bd4527b1ffcb8610b3568788198c749c/src/acidcat/core/write/edits.py#L167
[AGT]: https://github.com/gatovillano/bitwig_agent/blob/e17ac4033a7c5619e2371d0d733b0a4bb4b686d4/java-extension/src/main/java/com/bitwig/agent/BridgeHttpServer.java#L350
[AGT-init]: https://github.com/gatovillano/bitwig_agent/blob/e17ac4033a7c5619e2371d0d733b0a4bb4b686d4/java-extension/src/main/java/com/bitwig/agent/BitwigAgentExtension.java#L130
[AGT-theory]: https://github.com/gatovillano/bitwig_agent/blob/e17ac4033a7c5619e2371d0d733b0a4bb4b686d4/python/bitwig_agent/theory/chords.py#L1
[BITX]: https://github.com/wimvandenborre/BitX/blob/23768a4e9dbcf161e4a4b53a732ff704d10039cb/src/main/java/com/personal/BitXFunctions.java#L554
[BP-assets]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/tests/test_assets.py#L42
[BP-build]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/build.py#L425
[BP-codec]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/codec.py#L66
[BP-defs]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/definitions.py#L12
[BP-import]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/build.py#L465
[BP-key]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/encoding.py#L10
[BP-live]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/docs/verification.md#L1
[BP-model]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/model.py#L79
[BP-route]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/build.py#L342
[BP-schema]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/schema.py#L250
[BP-slots]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/slots.py#L1
[BP-status]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/docs/completion-status.md#L1
[BP-tests]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/tests/test_core_completion.py#L111
[CD-arranger]: https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L1755
[CD-clips]: https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L1360
[CD-delete]: https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L2143
[CD-dispatch]: https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L1989
[CD-insert]: https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L638
[CD-mixer]: https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L1297
[CD-nest]: https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L937
[CD-params]: https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L2370
[CD-select]: https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L277
[CD-tests]: https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/test/controller.test.mjs#L1
[CD-tools]: https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/src/index.mjs#L55
[Checks]: ../../context/evidence/OVERLAP_AUDIT_SOURCES.md
[D44]: ../decisions/d44-long-writes-are-optimized-then-bounded.md
[DAW]: https://github.com/ptaczek/daw-mcp/blob/a30cbf62f8741265550fc2d638b0cd56559255e6/bitwig-extension/src/main/java/com/pxaudio/bitwigmcp/handlers/ClipHandler.java#L258
[E124]: experiments/e124-audio-facts-and-sensory-packets-connect-verified-files.md
[E125]: experiments/e125-audio-capture-composes-with-verified-file-analysis.md
[E232]: experiments/e232-reader-row-binding.md
[E233]: experiments/e233-pull-snapshot-references.md
[E234]: experiments/e234-write-boundary-and-reader-hardening.md
[E235]: experiments/e235-document-read-and-identity-registry.md
[E236]: experiments/e236-document-edit-limb.md
[E243]: experiments/e243-collapsed-cursor-and-parameter-settle.md
[E244]: experiments/e244-direct-parameter-display-observer.md
[E248]: experiments/e248-writer-cursor-width.md
[E250]: experiments/e250-reader-follow-mode-repair.md
[E253]: experiments/e253-overlay-basis-sealing.md
[E254]: experiments/e254-device-control-identity-and-route-claims.md
[E255]: experiments/e255-document-format-discovery.md
[E257]: experiments/e257-track-mixer.md
[E258]: experiments/e258-selection-effects-and-unavailable-readback.md
[E260]: experiments/e260-claim-replacement-repair.md
[E264]: experiments/e264-device-add-revert-report.md
[E265]: experiments/e265-inline-midi-file-conversion.md
[E267]: experiments/e267-midi-snapshot-export.md
[E269]: experiments/e269-document-file-paths.md
[E55]: experiments/e55-direct-parameter-core-is-live.md
[E56]: experiments/e56-native-device-catalog-is-reproducible-and-resolved.md
[E57]: experiments/e57-vst3-and-clap-parameter-control-is-live.md
[E67]: experiments/e67-sampled-preset-authoring-is-live.md
[E68]: experiments/e68-container-cross-device-routing-is-live.md
[E69]: experiments/e69-donor-scope-and-footprints-are-complete.md
[E77]: experiments/e77-nested-direct-parameter-guards-are-live.md
[E82]: experiments/e82-direct-parameter-domains-and-integrity-are-live.md
[E85]: experiments/e85-general-directparameter-modulation-targets-are-live.md
[E86]: experiments/e86-semantic-preset-modulation-inspection-is-complete.md
[E87]: experiments/e87-list-scoped-topology-is-complete.md
[E90]: experiments/e90-fx-layer-late-binding-is-live.md
[E91]: experiments/e91-existing-device-modulation-wrapper-is-live.md
[E92]: experiments/e92-general-device-source-composition-is-live.md
[E93]: experiments/e93-container-shape-and-capacity.md
[E95]: experiments/e95-modulator-identity-pair-controls-grid-placement.md
[E96]: experiments/e96-grid-generalization-and-catalog-boundary.md
[E98]: experiments/e98-parameter-units-and-semantic-writes-fail-closed.md
[E99]: experiments/e99-selection-borrowing-and-background-stability.md
[GM-arranger]: https://github.com/gregrossdev/bitwig-extensions/blob/de79a747a62b50e1488cc9ef49617d129804e3ff/gig-maestro/src/main/java/dev/gregross/gig/handlers/ArrangerHandler.java#L136
[GM-device]: https://github.com/gregrossdev/bitwig-extensions/blob/de79a747a62b50e1488cc9ef49617d129804e3ff/gig-maestro/src/main/java/dev/gregross/gig/handlers/DeviceHandler.java#L25
[GM-sends]: https://github.com/gregrossdev/bitwig-extensions/blob/de79a747a62b50e1488cc9ef49617d129804e3ff/gig-maestro/src/main/java/dev/gregross/gig/handlers/SendHandler.java#L20
[GM-transaction]: https://github.com/gregrossdev/bitwig-extensions/blob/de79a747a62b50e1488cc9ef49617d129804e3ff/gig-maestro/src/main/java/dev/gregross/gig/handlers/TransactionHandler.java#L24
[GN-adapter]: ../../brain/src/adapters/live/adapter.ts
[GN-audio]: ../../brain/src/audio/index.ts
[GN-bwtests]: ../../brain/src/bwmod/bwmod.test.ts
[GN-descriptions]: ../../brain/src/surface/description-cohort.ts
[GN-device]: ../../brain/src/surface/agent-native-devices.ts
[GN-donors]: ../../brain/src/bwmod/donors.ts
[GN-encoder]: ../../brain/src/adapters/live/encoder.ts
[GN-inspect]: ../../brain/src/surface/preset-modulation-inspection.ts
[GN-oracle]: ../../brain/src/bwmod/oracle.test.ts
[GN-readback]: ../../brain/src/surface/readback-unavailable.test.ts
[GN-stream]: ../../brain/src/bwmod/stream.ts
[GN-stubs]: ../../brain/src/bwmod/stubs.ts
[HACKS]: https://github.com/zezic/bitwig-device-hacks/blob/59aa058e3fc725d202b6309c5251960a588e37a2/README.md#L1
[Ledger]: ../../context/contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md
[MOSS-clip]: https://github.com/git-moss/DrivenByMoss/blob/836117be7c17318a0f93cb414e333516a91a5436/src/main/java/de/mossgrabers/bitwig/framework/daw/CursorClipImpl.java#L1
[MOSS-layer]: https://github.com/git-moss/DrivenByMoss/blob/836117be7c17318a0f93cb414e333516a91a5436/src/main/java/de/mossgrabers/bitwig/framework/daw/data/LayerImpl.java#L1
[Manifest]: ../../brain/assets/modulators/manifest.json
[NITRO]: https://github.com/blakebratcher/bitwig-nitro-tools/blob/a34c1d61c7e48b1531fb3fba5e4c06d9e1e0cf16/README.md#L140
[NOW]: ../../context/NOW.md
[OW-bridge]: https://github.com/Axyom/openwig/blob/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d/src/openwig/controller/openwig_bridge.control.js#L490
[OW-mod]: https://github.com/Axyom/openwig/blob/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d/src/openwig/controller/openwig_bridge.control.js#L2214
[OW-notes]: https://github.com/Axyom/openwig/blob/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d/src/openwig/read/notes.py#L1
[OW-project]: https://github.com/Axyom/openwig/blob/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d/src/openwig/read/project.py#L66
[OW-render]: https://github.com/Axyom/openwig/blob/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d/src/openwig/wire/render.py#L1
[OW-song]: https://github.com/Axyom/openwig/blob/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d/src/openwig/song.py#L82
[OW-tests]: https://github.com/Axyom/openwig/blob/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d/tests/test_autoadapt_live.py#L1
[SP]: https://github.com/kalifrn6-art/bitwig-superpowers
[WIG]: https://github.com/csabacsaba/WigAI/blob/6b567eb90ad3702a88f80398cf6ecbd74d1b5306/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java#L115
