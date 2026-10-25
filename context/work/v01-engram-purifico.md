# V01 — Engram / Via Purifico sketch

## Scope

User request (2026-10-25): use coherent drum passages and the rough bass
contour from Engram's Large-from-stems transcription. Substantially transform
Via Purifico's piano into articulated chord stabs and vamps, with a driving,
slightly funky feel. Work in the current project, initially `New 2`, with
the user's existing Addictive Drums 2 track.

Build two contrasting eight-bar Launcher sections using existing tools.
Analyze source notes before choosing passages; retain provenance and edited
documents locally. Preserve the drum instrument and unrelated tracks. Resolve
an instrument or preset by name when choosing sounds. Verify each live write
through independent tool readback; audition is a separate musical judgment.

## Session state

Normal build handshake passed earlier in this session. Current project and
device reads confirmed Addictive Drums 2, FX 1, and Master. Process inspection
found no probe driver and one connected Ghostnote client (PID 84650); other
idle MCP processes were left alone. The UI showed stopped transport at 110 BPM,
4/4, with the drum track selected and empty visible Launcher slots.

Ghostworks construct: `191b61cc-0309-455b-a08c-98a48b6ae22e` (`engram purifico`).
All three source preparations were confirmed after the populated project was
saved through Bitwig's UI. Bitwig created a nested project folder; Ghostworks
now records `project/engram purifico/engram purifico.bwproject`.
Working documents and analysis were temporary and were removed at the user's
request after acceptance. The saved Ghostworks project and source records remain.

Selected source assets, independently hash-checked by `read_midi_file`:

| Part | Asset | SHA-256 |
|---|---|---|
| Engram drums, Large from drums stem | `a503469a-7a12-433b-83c3-db0d57ae0052` | `ebe6ceb5e5d058f09a8e5e0d588b0623408804aecbd5ccb5ce9934637bbcd7da` |
| Engram bass, Large from bass stem | `aeb2577d-6f28-4656-8c09-ca9ab6ace3a6` | `09c8a005daec90ef2ba75989a3c5990965972583d88ecb43ac592d0a5094d5fe` |
| Via Purifico piano, Large from piano stem | `5462ee54-ca0b-4706-b4aa-9db263c8686f` | `b1a4c888dbe512d63b7975da181a793f777a659a3267a6610204af36fea9cd1f` |

Reads retained source beat coordinates and tempo maps. Source velocities are
placeholders (64), so dynamics will be authored. Engram's main pulse is about
130 BPM; Via Purifico's is 86.665 BPM. Piano rhythm and harmony will be adapted
deliberately rather than reproducing source elapsed time.

## Result

V01 is complete. On 2026-10-25 the operator auditioned the sketch and said:
“Sounds fantastic. This passes muster for me”. The accepted result is two
Launcher sections; Arranger work remains V03.

- 130 BPM, 4/4; Scene 1 is A and Scene 2 is B. Each contains three looping
  eight-bar clips. There are 537 notes across the six clips.
- A drums use source beats 80–112; B assembles source bars beginning at beats
  240, 244, 240, 244, 256, 260, 240, and 252. The repeated kick/hat/snare
  vocabulary remains; authored downbeats, dynamics, and a B turnaround add
  drive. Source clap detections become soft snare notes, with coincident
  duplicates consolidated. The operator said “I changed it to GM midi map”.
- Bass uses source beats 240–272 for A and 408–440 for B. Pitches preserve
  the source contour, with shorter articulation, repeated long notes, and
  added root anchors. `Electric Bass - Fingered` was resolved by its installed
  preset filename and loaded on `Engram Bass`.
- Piano condenses harmonic cells from Via Purifico beats 0–12 into minor
  ninth/eleventh and major ninth voicings, transposed and revoiced around
  G-sharp minor. The original arpeggio rhythm becomes alternating syncopated
  stabs; B adds responses and higher voicings. `Grand Piano` was resolved by
  its installed preset filename and loaded on `Purifico Stabs`.
- All parts share deliberately authored light sixteenth timing offsets.
  Source velocities were placeholders; all final dynamics are authored.
  Source transcriptions were not modified.

Track IDs: drums `4841c6e7-56e5-468b-badc-14ad814c2588`, bass
`6add847b-a988-4a88-9b17-f18cd7f098ba`, piano
`130f6624-7380-403a-9a85-342b7e63a0dc`. All three read back unmuted,
unsoloed, centered, and at -10 dB. FX 1 and Master remain present.

## Verification and limits

The authoring script checked note bounds, duplicate addresses, and same-pitch
overlap. Every clip creation independently read back with status `verified`
and no discrepancies; note counts were A 110/38/98 and B 125/40/126
(drums/bass/piano). Both preset additions independently verified their device
orders. The UI showed 130 BPM after the tempo edit. Save Project completed,
the bridge reported `engram purifico`, and Ghostworks verified the saved file
and confirmed all three contributions. A subsequent piano B cold read showed
126 notes and the 0–32 loop.

The saved project SHA-256 at confirmation was
`6d83a2916769cebe192ed112ac144300726b3ab52c188d6279d6c48f0bdc64be`.
Authoring documents, source-note analysis, per-note derivations, the script,
and live receipts were temporary and have been deleted at the user's request.
The project rename invalidated the server's earlier clip identities, and the
new cold read had no overlays. The authoring files retained those overlays
until cleanup; they are not preserved in the saved Bitwig file.

The operator's audition establishes musical acceptance; the agent did not
hear playback. Current playback state must be read again before further live
work. No runtime implementation was changed.

## Closeout assessment

The requested rhythm, pitch, duration, and velocity transformations produced
two independently verified sections, and the operator accepted their sound.
The existing drum device and unrelated tracks were retained. There were no
pre-existing musical notes in the target slots to preserve, so this session
does not add evidence for difficult in-place preservation (V02).

Named preset discovery used the installed filesystem: `Electric Bass - Fingered`
and `Grand Piano` each resolved to an exact `.bwpreset` file. Independent
device readback confirmed insertion of each Sampler, not byte-level preset
equivalence. This meets the selected brief's practical named-preset outcome
through the existing file route. It does not prove the native-catalog or popup
browser discovery routes named in the broader sequence; R05 remains next.

No blocking V01 implementation defect was observed. Follow-ups and boundaries:

- **First-save annotation continuity:** changing `New 2` to `engram purifico`
  left the piano B cold read with new IDs and no timing overlays. The notes,
  loop, and realized groove remained. `Session.ready()` rebuilds when the
  project-name field changes, consistent with this observation. R01 should
  assess continuity across first save/rename, distinguishing it from genuine
  project switches. This is an observed usability limitation, not evidence
  that persistent annotations are already promised. No live repair was needed
  for the accepted sketch; the authoring files were subsequently deleted.
- **Tempo and save:** these used the UI because normal tools lack the needed
  verbs. Tempo belongs to V03's transport scope; project save remains B06.
  Bitwig's nested save folder was handled by Ghostworks' existing actual-path
  argument, without implementation work.
- **Discovery output volume:** printing full Ghostworks asset results exposed
  large repeated timing/provenance payloads. Filtering the returned data before
  printing was sufficient here. Bounded discovery summaries would be an
  external Ghostworks improvement; this was not a Ghostnote write failure.
- **Expected refusals/setup:** the mixer tool refused a Master read without
  writing, as its contract specifies. The operator set the drum plug-in's GM
  map. Neither requires V01 implementation work.

Runtime code and public tool descriptions are unchanged. Documentation link
and diff checks passed at closeout; task documentation is staged, not committed.
