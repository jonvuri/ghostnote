---
title: Current state
kind: status
state: active
updated: 2026-10-11
phase: phase-8-agent-native-live-engine
session: 8i12-automated-dogfood-process-proof
---

## Now

Next: the operator selects the tasks of the
[8i13 stretch set](plan/phase-8/8i13-automated-dogfood-stretch-set.md)
(recommended: all five, S1 to S5, with both clients; the 8i11 claim
repairs are not in the set, because claims do not survive a session
resume). Then 8i13 runs them with the
[runbook](plan/phase-8/8i-automated-dogfood-runbook.md) and adds to the
[issue log](plan/phase-8/8i-dogfood-issues.md) (D1 to D5 are open for the
operator review). The 8i gate close-out
([8i plan](plan/phase-8/8i-agent-native-hybrid-dogfood.md), item 14)
follows the stretch set and its operator review: check the 8i acceptance
criteria against the E records, give each Phase 8 interface a verdict, and
write the Phase 9 handoff with the 9b artifact inventory.
[9c](plan/phase-9/9c-release-and-upgrade-live-suite.md) is the release and
Bitwig upgrade live suite.

8i12 is complete ([E261](evidence/experiments/e261-automated-dogfood-process-proof.md)).
`tools/dogfood/run-session.sh` ran one fresh Codex and one fresh Claude
session on the mixer task P1 in `gn-scale-test`. Both met the goal on the
E257 route (3 Ghostnote calls, no refusal; Codex 46 s, Claude 13 s). No
product, extension, or description change (v46).

Keep in mind for the trials: with the D44 limits, an agent splits larger
work into more calls. A split is not atomic; `revert_change` does not
reverse `move_devices` or clip moves; overlapping clip moves split from the
far edge. A container with 3 or more modulated layer chains cannot be built.

Preserve in "ice jungle": `Pocket Bounce Bass` and the 32-beat clip
`Pocket Bounce v2 - 1 & 3` in Scene 2 (device order: an FX Layer with
Sampler in `Layer 1`, then Blur); the eight-bar IcyShellStab01 duplicate in
Scene 2 and its original in Scene 1. The last fresh track read there had no
Undertow Bass. Check current state and selection before live work. The
operator accepts the generic pressure warning as a host limit.

Night Glass is the operator's testbed for the trials. Preserve the Rain
Steps drums and the Scene 1 bass clip `Rain Steps • Pocket Bass` (32 notes,
with the operator's two hand edits; no claims). After the 8i11 rerun
(E260), the Scene 1 shaker clip has the original timing, and the operator's
backup copy is in a lower scene. Scene 2 holds the bass clip `Rain Steps •
Scene 2 Bass` (step-2 state) and the agent's copies of the Scene 1 drums,
pad, chords, and shaker clips. The agent launched Scene 2; the operator
stops the transport. Check current state before live work.

## Last live baseline (8i8)

The deployed normal `ghostnote` archive is the 8i8 build: SHA-256
`72ce96cb3185ad5930dc3159c6a7dcb9ec36b393fad5d201b70a70d049877893`, 92
methods, `0bafdd963fa9f5da`, `fineSteps` 4,194,304, and the `rig.info`
markers `selectionEffects: mixer-restore-v1`, `trackMixer:
track-mixer-raw-v1`, `clipMetadataWrite: owned-fields-v1`, and
`cursorTrackPins.rule: owned-tracks-pinned-v1`. The 8i8 runs used
`gn-scale-test` with scratch tracks only. After 8i12 it is at its E234
baseline with mixer `gn-sel` selected; `selection.status` reports no
selected slot (as at the 8i12 entry; the baseline names slot `gn-A` row 0,
issue D5). "New 3" (8i7) was not opened. The next free evidence number is
E262; the next decision is D49. `phase8i7-mixer.ts trial-setup` now
requires `gn-scale-test`; `trial-state all` prints the mixer of every
track and the selection.
`phase8i8-selection.ts accept` runs the selection arms; the current drivers
accept the 8i8 build (`NORMAL_8I8`, `assertCurrentNormal`).
`phase8i7-mixer.ts`, `phase8i9-overlay-add.ts`, `phase8i3-long-writes.ts
identity`, and `probe:modulation-routes` stay as before.

## Facts

Automated dogfood (E261): follow the runbook. Count calls from the client
session file (`session.jsonl`), not the Codex event stream, which has no
script call. Codex `--approve-for-me` approves a Ghostnote write tool
without a per-tool entry. Claude Code does not start an MCP server from a
`cwd` field. Read the project name (`trial-state all`) after the hello: a
hello that runs while the project loads lists other tracks.

Codex Desktop starts one Ghostnote server for each thread, from the brain
source: a new thread loads changed descriptions with no deploy, and claims do
not cross threads. A trial's first prompt ends with "Use Ghostnote and
computer use as you see fit." (without it, the agent used only computer use).
Agents request the reference sections that a description names. A
duplicate current claim names both IDs (repair `duplicate-claim`); R15 at
`.data.atDelta` is the onset floor: atDelta is in (−1/512, 0]. The Codex
rollout log cuts tool results over about 24,000 characters; take numbers
from the event rows or the agents' script output. A `codex://threads/<id>`
link is `~/.codex/sessions/<date>/rollout-*-<id>.jsonl`; Ghostnote calls are
its `McpToolCall` items. Copy the E259 extract format.

Add the index row in the same session as a new E or D record. A readback
status is `unavailable` only for a failed read (`Unverified.cause`
`read-failed`); use `readbackStatusOf` and `readbackOrUnavailable` in a new
write tool, and add its case to `readback-unavailable.test.ts`. An op that
makes Bitwig move the mixer selection goes in `movesMixerSelection`
(live adapter) and in the fake; a two-change tool runs in one
`withSelection` scope. A track
volume is the host raw value: dB = 60·log10(raw), so -18 dB is raw
10^(-18/60) (D48); `setRaw` lands, a plain `set` does not. A mixer field with
automation refuses; a mixer reversal restores each field that the readback proved
and that still holds what the change left; a mixer batch carries the
scene guard of the tool's prior read. A Codex trial that uses a new write tool needs its
approval (`-c mcp_servers.ghostnote.tools.<tool>.approval_mode="approve"`)
and `< /dev/null`; the operator's Codex has a computer-use plugin
(`cua_repl`) that agents call first. A remote control position is its host slot, not an array index (E254). The modulation writers claim the route, not the sound (D46); a new route form needs a route-suite case first. An agent claim can omit `basis`; `edit_launcher_clip` seals it (D45), and `add_launcher_clip` seals it in the document's clip ID space, then binds it to the live clip (D47). A claim's basis covers the full envelope of each claim it depends on: a revised nominal makes its groove stale. Check many claim bases with one `sealOverlays`, not `dependencyBasis` for each claim. A generated 16,384-note clip uses quarter-beat notes (the reader cell limit). Clip colour no
longer needs the palette (D42); a colour sample must include dark colours.
Report note channels 1-based to the operator. A long write has a D44 limit
in `write-limits.ts`; a new or changed long path measures its largest
admitted case and its revert, and adds or moves a limit with a test. `context/check.rb` needs
`LANG=en_US.UTF-8`. Bitwig
cannot insert a scene above row 0. The first write after an operator scene
change can refuse in the cursor preflight (E3); retry once. Probe
`WireTransport` throws `BridgeError` with the reply code (8i3). Bitwig reports note
pressure as 0 (D37). The normal profile has no `transport.stop`; a live
launch leaves the transport playing for the operator to stop.
`check-publication-candidates.py --write` after a reviewed spec, codec, or
migration contract change. For plug-in work, the operator turns the audio
engine on in the owned project (E244). Adding a device to an unnamed track
makes Bitwig rename the track after the device. Owned cursor tracks stay
pinned (D43): a new owned cursor goes through `Rig.ownCursorTrack`, and
`cursor.pinTrack` refuses `pinned: false`. A cursor without a track holds no
pin. A pinned point leaves the mixer selection alone; only the operator
changes it. A track delete, create, or duplicate moves the mixer selection (host, E251); the tools restore it (E258). The
device routes point a hidden child with `cursor.pointTrack`; only clip
points use `cursor.pointExpanded`. Print the wire call sequence with its
gaps. Run live drivers as one foreground chain, and check `pgrep -f phase8`
first. In zsh, a variable does not split into words: write `${=a}` or each
command out.

Each wire call costs one control-surface turn (about 24 ms); calls sent
together share one turn. `phase8h4c-edit.ts cost|worst|accept`,
`phase8h4g-inventory.ts inventory|add-worst|plan-bench`, and
`phase8h4g-writer-width.ts entry|reviewer|far|heap` print the wire calls. A
probe that sends raw requests on the adapter's transport bypasses the
adapter's request count; keep raw setup apart from timed calls. A
`rig.json` override needs a controller replacement, not a redeploy. A
`fineSteps` override below 4,194,304 makes every live note write refuse
before mutation (D41); a probe that needs a narrow writer passes
`allowNarrowWriter`. The Bitwig live heap grows by about 100 MiB over a long
driver run: deleted tracks stay in the undo history.

Before you attribute a live regression, compare per-call durations in the
wire sequence with the inventory, and rerun once (8i4). Fakes use host
indices and real host labels (8i5). Check a reused driver input against the
current D44 limits before a live run. A trial that must reach a refusal
says "send it as written first" (8i6).

VU audibility oracle (E239): stop every clip and the transport, wait for VU 0,
then launch one track and read the Master VU as well.
