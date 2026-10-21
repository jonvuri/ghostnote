---
title: E330 — Bitwig 6.1.4 normal-product audit accepted
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E330 — Bitwig 6.1.4 normal-product audit accepted

## Verdict and scope

The general update audit accepts Bitwig 6.1.4 for the tested normal-product
paths and fixtures. All required matrix rows pass after the recorded
compatibility corrections and guarded recoveries. The operator saved the
clean working project. The final live state matches the preserved baseline,
with no audit tracks or pending write. Sections 1, 2A, 2B, and 3 are complete.

The [acceptance record](../data/bitwig-upgrade-audit/continuation-4-614/acceptance.json)
pins the matrix evidence by hash, records exact build identity, and retains
all limits. The [driver report](../data/bitwig-upgrade-audit/continuation-4-614/report.json)
is `live-matrix-complete`, with no missing check, failure, active command,
or pending pause. The accepted continuation does not erase the earlier
failures. All 20 inherited proof hashes match.

This result permits the separate 9b.6 preparation. It does not grant native
Grid write authority, validate the new-build Grid doctor, or establish the
9b.7 product cache policy. The accepted 6.0.6 doctor cache and both attempt
records remain unchanged.

## Exact identity and operator handoff

| Item | Verified value |
| --- | --- |
| Application | `/Applications/Bitwig Studio.app`, Bitwig Studio 6.1.4 |
| Jar SHA-256 | `5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f` |
| Normal archive SHA-256 | `25a5be4398f8825a7eabd2a541e49559ed60002f2d8d6b9db795f45664e4d9d2` |
| Loaded profile | `normal-v1`, 92 methods, hash `8be1975eaa99d78f`, API 25 |
| Initialization | `2026-10-21T13:31:16.452Z` |
| Bridge process | PID 69259, checked before each live command |
| Backup | `/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1/` |
| Working folder | `/Users/jonvuri/Bitwig Upgrade Work/2026-10-21/` |

E318 records the operator handoff and normal deployment. The copied 6.0.6
launch and recovery check passed. The operator reported no assets in
`gn-grid-spike` or `gn-scale-test` and no known missing assets elsewhere;
other projects were not checked exhaustively. The operator performed all
controller replacements, project saves, project switches, engine activation,
and playback actions. The agent sent no save, transport, engine, or native
Grid command during this audit.

## Complete matrix

| Boundary | Result and evidence |
| --- | --- |
| Startup and discovery | Exact version, API, normal method set, markers, initialization, app path, jar/archive hashes, project, selection, and client checks pass at each command. E318/E319 and the final preflight records establish identity. |
| Notes and documents | Sparse and desired-state edits, two MIDI channels, expressive notes, non-quarter timing, loop metadata, reversal, and effect-free stale-reference refusal pass. E320 and the inherited notes case. |
| Clip and track structure | Owned creation, nonadjacent copy, source preservation, occupied-slot refusal, move/return, deletion, and track duplicate/delete pass. E320. |
| Mixer and selection | Volume, pan, mute, solo, separate raw readback, and reversal pass. Operator selection change and restoration pass in E325. Collapsed-group edits and full ungrouped restoration pass in E326. |
| Device controls | Two Polysynth instances and the installed Diva plug-in pass identity, bounded setting, independent verification, and restoration checks. E320. |
| Device structure | Layer-container build, nested device operations, enable/disable, reversal or removal, and complete preserved-content comparison pass. E320. |
| Presets and modulation | Both Samplers pass supported Attack edits, independent host-export inspection, preserved original routes and resources, and supported reversals. E323/E324. E329 adds before/after persistence observations and explicit removed-target evidence. |
| Freshness and lifecycle | Stale edit refusal sends no write batch. Selection and collapsed-group cases pass. Project switch and fresh return write/reversal pass in E327. |
| Persistence and playback | Saved-file identity and full observable fixture equality pass after reopen; fresh write/reversal pass in E328. Both Samplers are heard after reopen, with restored fixture equality in E329. |
| Cleanup and clean save | Separate inspection, removal of six proved owned tracks, independent absence checks, full preserved baseline, and final clean-save verification pass. E329 and the final records below. |

The [acceptance JSON](../data/bitwig-upgrade-audit/continuation-4-614/acceptance.json)
links each row to primary case or checkpoint files and their hashes.

## Corrections and verification

The shared adapter now waits for bounded enabled-state readback: at most
eight reads and seven additional 25 ms waits, with no repeated setter.
It also accepts an explicit absent layer bank with an empty list despite a
stale host count. E320 records the cost model, delayed-host tests, call-budget
checks, guarded recovery, and successful live structure case.

The native Sampler named recipe accepts `Gated Attack Time` after device
binding, alongside the retained `AEG Attack Time` label. Explicit ID/name
targets remain exact. The initially observed label must stay stable during
sampling. This adds no host call or wait. E321 records the correction and
full product gate; E323/E324 prove the corrected live path.

Driver corrections handle valid boolean verification replies, require an
empty preserved Launcher selection at entry, preserve exact failure evidence,
and represent group slots as aggregate occupancy. Idle unconnected MCP
servers are allowed; competing bridge connections and probe drivers are
refused. Recovery never repeats an uncertain write blindly. Separate
continuations retain transitive proof hashes and fresh session references.

Verification retained for the final implementation:

- E321's [required full brain gate](../data/bitwig-upgrade-audit/sampler-name-check-614/final-full-check.txt):
  TypeScript, required Python oracle, 2,450 tests, zero failures or skips.
- E326's later [focused driver tests](../data/bitwig-upgrade-audit/group-snapshot-fix-614/tests.txt):
  28 pass, plus [typecheck](../data/bitwig-upgrade-audit/group-snapshot-fix-614/typecheck.txt).
  These cover the later group snapshot correction. The full gate was not
  rerun for that driver-only correction.
- E317's [extension build](../data/bitwig-upgrade-audit/offline/extension-build.txt):
  host proxy tests and archive registration checks pass. Extension code did
  not change after that build.
- Focused live checks pass for each changed host boundary. Final evidence
  hashes, context links, and staged diffs pass. No code changed during the
  final listening or cleanup steps.

Public schemas and tool promises are unchanged. Descriptions remain v52.
All session changes are staged for review; no commit is made.

## Patch notes and Sampler compatibility

E318 records the exact
[6.1.4 release notes](https://www.bitwig.com/dl/Bitwig%20Studio/6.1.4/release_notes/)
read through the official indexed copy; the direct endpoint did not load in
that session. The 6.1.4 patch adds rekordbox library integration. Cumulative
notes include Sampler parameter import, quality, repeated-note, Undo,
loop/replacement, filter, and sliced-onset persistence fixes in 6.1.1–6.1.3.

The [6.1 base notes](https://downloads.bitwig.com/6.1/Release-Notes-6.1.html)
say modulation and automation of Play Mode, Freeze Playhead, and Envelope
Mode are disregarded. The 6.1.1 notes remove related remote controls and
modulation routes. The audit does not claim preservation of these targets.

Both preserved live direct-control reads contain 53 parameters and omit
those exact names. Complete donor and 6.1.4 host-export route inventories
contain only Attack routes. Since the donors have no removed-target routes,
actual migration or rejection is untested. This is fixture-specific absence,
not a global host capability claim.

The retained Attack mappings and healthy waveforms are confirmed before save
and after reopen. Single uses `7 Reso Chime.aiff`; multi uses `ASM Chord C7.wav`
and `ASM Chord C9.wav`. The operator hears both. Multi is a bit quiet, with
no other audible issue. Complete readback proves no lasting mixer or device
change from listening. No loudness, equal-level, or audio-latency study was
performed. Operator inspection and host exports supplement normal readers,
which do not expose all sample zones or modulation amounts.

## Performance verdict and limits

Existing models apply except for E320's documented bounded enabled readback.
Operator pauses are excluded. No uncertain write or passed case was repeated
for timing. These small-fixture results do not establish product capacity.

| Comparable or near-comparable operation | Current result | Reference and limit |
| --- | --- | --- |
| Polysynth single control | 2,308.567–2,312.621 ms, 66 calls | E252: 2,283 ms; about +1.1–1.3%, different selected control. |
| Diva control | 3,445.531 ms, 80 calls | E252: 3,429 ms; about +0.5%, one sample. |
| Launcher copy | 869.414 ms, 37 calls | E263: 853–888 ms, same calls; source contents differ. |
| Occupied refusal | 94.931 ms, six calls | E263: 94 ms, six calls. |
| Four-field mixer after reopen | 261.630 ms, 15 calls, 10 turns | E327: 266.076 ms; -1.7%, equal operation/calls. |
| Mixer reversal after reopen | 359.557 ms, 22 calls, 14 turns | E327: 361.299 ms; -0.5%, equal operation/calls. |
| Single-track cleanup, 29-call subset | 584.303–602.821 ms, 16 turns | E258: 594 ms; -1.6% to +1.5%; contents and sessions differ. |

E326's collapsed note edits and reversals are 21–22% slower than the earlier
ungrouped case. The grouped cursor path uses six fewer calls and turns.
The stale refusal is 34.7% slower with equal call counts but a different
group state. These samples do not isolate a version regression or timing
noise. This unresolved comparison limit is retained; no matched old/new
performance verdict is claimed for that path. It does not change the passed
correctness result. E316's native-research timing limits remain separate.

## Final state and handoff

The [final clean-save checkpoint](../data/bitwig-upgrade-audit/continuation-4-614/cleanup-saved.json)
proves the live preserved baseline. Only `Inst 1`, `Audio 2`, `FX 1`, and
`Master` remain. Mixer and Launcher selection are `Inst 1`, row 0. Transport
is stopped. No owned track, active driver, lock, failure, or uncertain write
remains in continuation 4. Prior failure records remain intact.

The operator retains the cleaned working audit project and separate switch
project under the working folder. The
[clean saved file](../data/bitwig-upgrade-audit/continuation-4-614/clean-saved-file.json)
is 34,259 bytes, SHA-256
`573084e28ef7e241e3d52fd24265b1302d6f8cc22695270e3d11386e80d4398f`.
The operator confirmation, current live baseline, file modification time,
and changed hash establish this final save. The clean file was not reopened
a second time.

The separate 72,901-byte persistence evidence copy remains unchanged at
SHA-256 `b01ba21f2f2a6d790fddbc9663a278721d23d14935a4dc067f76e4bdf809970b`.
Backups, original projects, donor sources, old Grid evidence, attempts, and
cache are preserved. Exclusive engine activation is operator-confirmed;
its ownership was not independently measured.

Next is [9b.6](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6--doctor-on-61x).
Start with bounded offline discovery and caller traces for this jar. Adapt
the pinned driver and first-attempt policy to the new fingerprint. Do not
reuse the 6.0.6 cache or V20's E313-specific retry admission. Prepare and test
the new probe before deployment. Controller replacement and fresh scratch
consent remain operator actions. This completed audit does not authorize a
new native live pass by itself.

Actionable lessons from E321/E326 remain: bind compatibility aliases to the
verified device, test the actual group snapshot boundary, and give operator
save and reopen as separate steps with a file capture between them.
