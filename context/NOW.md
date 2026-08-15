---
title: Current state
kind: status
state: active
updated: 2026-08-15
phase: phase-1
session: phase-1-session-3f-h
---

# Now

Phase 1 is **ready to resume at session 3f-h**. The isolated knowledge-base
detour is complete. Session 3f-g winner collapse is complete and verified live,
including the review fixes below, which were re-proved live against a rebuilt and
redeployed jar. The audible evidence is the earlier measurement and was not
re-taken.

⚠ The detour was a context-tree session. It ran no probe and left every baseline
and constraint below untouched. Its only change outside `context/` is
`extension/build.gradle`, which gained a build-irrelevant configuration that
resolves the Bitwig API source — the jar is byte-identical across it.
**3f-h resumes now, with nothing about its scope or acceptance changed.**

## Detour — capability knowledge base, complete 2026-08-15

Brief and outcome record:
[archive/outcomes/KNOWLEDGE-BASE.md](archive/outcomes/KNOWLEDGE-BASE.md).

The tree now has a fourth evidence axis:
[`evidence/capability/`](evidence/capability/INDEX.md), a sibling of
`evidence/format/`. It holds the **current reading** of a measured fact,
organized by subject, and it is rewritten in place when superseded. Experiment
files stay frozen and are cited, never edited.

Six pages were seeded: `containers`, `identity`, `devices`, `banks`, `actions`
and `host-api`. `README.md`'s authority order now separates the current reading
from the dated record, and a capability question routes to the new index first.

What the detour settled, beyond the axis itself:

- ⚠⚠ **The Selector is closed for live A/B.** A deactivated Selector chain is
  fully disabled: its tail continues sounding, and a newly activated chain takes
  no input until it is active. Recorded at `[I]` (user, live, 2026-08-15) with
  the probe that would raise it to `[K]`. **Layer chains remain the product
  path**, and this reopens nothing.
- ⚠ **The stale "Selectors cannot be seeded" conflation is corrected in place.**
  *No verb creates a chain* stands `[K]`; *no shell can be obtained* is
  superseded by the build-time preset route. The stale statement lives at
  `handlers/ContainerHandlers.java:188` and is left as it is — a code comment is
  not authority, and the capability page now carries the current reading.
- ⚠ **Two claims in the brief were corrected by source reads.** `hasLayers()` is
  marked on bank devices too, not only `exists()` and `name()`. And
  `createEqualsValue` is no longer unprobed — E16t measured it, and
  `Rig.java:1174` uses it.
- **`reference/BitX` is mined and framed accurately**: seven device UUIDs at
  `[I]`, four parameter-ID maps at `[I]`, and three unused mechanisms recorded as
  leads. ⚠ It is a ~3,100-line command runner that creates no structure. It gave
  data and one existence proof, no technique.

⚠ Nothing was adopted. Every `[U]` and `[I]` names the probe that would settle it
and leaves it unrun.

Return: reopen `plan/phase-1/3f-fork-chain.md` and start 3f-h below.

The case for taking the detour is in the brief and is not repeated here.

Return: reopen `plan/phase-1/3f-fork-chain.md` and start 3f-h below.

## Baseline

- `copy_track`, nested address grammar, chain observation, `chain.create`,
  `chain.rename`, `chain.relocate` and `chain.activate` are complete.
- The bundled one-entry empty Instrument Layer seed is live-proved. Fresh
  Instrument and FX containers are autonomous and every entry is explicitly
  named before its durable address is used.
- A chain is addressed by container position plus name. Its `channelId` is minted
  again on project load and is used only as a within-turn creation witness.
- Product container reads and writes use the same cursor-free
  `Rig.slotLayerBanks`; they do not move `cursorDevice0`.
- `chain.relocate` covers top→chain, chain→top and chain→chain move/copy on one
  track. Complete source/destination sequence readback proves removal, append,
  population and order; acknowledgement is not evidence. Before the first
  stage, both adapters project the complete caller-ordered request across source
  positions, container compaction, destination identity and cumulative capacity.
- Only `chain.relocate` may route a nested device. `device.delete`, `param.set`
  and every other nested-device write still refuse through
  `assertDevicesRoutable`; `chain.move` is product-reachable only through this
  typed verb.
- Every observed sibling carries exact solo state or switching refuses.
  `chain.activate` makes one named chain the sole soloed sibling and accepts
  success only after an independent complete container readback proves it.
- `switch_device_alternate` exposes switching without mixing in creation or
  reduction. Automatic reversal reports that it cannot restore the prior soloed
  alternate; the caller can switch back explicitly by name.
- `inspect_device_alternates`, `create_device_alternates` and
  `fill_device_alternate` expose complete readback, autonomous named creation and
  ordered move/copy fill. Inspection reports raw `soloed` observations and names
  an `exclusiveActive` entry only from a complete all-known sibling read with
  exactly one solo. They state the device-only object boundary explicitly.
- Creation validates all requested names before insertion. A requested first
  name matching the seed entry is still written explicitly through a temporary
  unique name, so later fill never relies on an untouched auto-naming entry.
- ⚠ An untouched shipped chain auto-renames to its first inserted device in
  Bitwig. Lifecycle writes therefore use explicitly named chains; the live
  conformance row discovered and now exercises that boundary.
- The current wire golden is 147 methods / `7f212c48cd3dab75`; a rebuilt and
  redeployed jar was proved fresh after a controller reload through `hello()`.
- Brain typecheck and 439/439 offline tests pass, including atomic multi-device
  fill refusal, non-sorted move compaction and pre-insertion name validation.
  Fresh live conformance passes 51/0/6, including both zero-stage projected-fill
  refusals. Production MCP smoke passes every P0-P10 check with the truthful
  solo-state structure, removes its copied track, and final cleanup removes both
  conformance-owned fixture tracks.

## Session 3f-g — complete 2026-08-15, verified live including its review pass

Purpose: implement the common destructive lifecycle by extracting one named
winner at the container's original signal position and deleting the container.

Acceptance:

1. Name the surviving alternate explicitly and preflight its complete ordered
   device sequence before the destructive boundary.
2. Move every winner device out in order and restore the container's original
   signal-chain position rather than appending at the end.
3. Reapply or report chain-level state that moving devices does not carry.
4. Delete the container only after extraction is independently proved; keep the
   destructive tool seam separate from benign creation/fill.
5. Measure the audible effect on the rebuilt track itself and keep unmeasured
   cross-device modulation outside the claim.
6. Pass offline checks, extension build, live conformance, production MCP smoke,
   context check and `git diff --check` with no residue.

Out of scope: selective reduction while several alternates survive.

Implementation status, 2026-08-15:

- `keep_device_alternate` is a separate destructive production tool. It requires
  a complete top-level order, complete named-winner order and exact
  name/mute/solo/volume/pan/colour state before the first move.
- Winner devices move out in order. Fresh full-track plus empty-winner readback
  gates a name-guarded container delete; a typed tail-relative top-level move
  then restores the original signal position and exact final order.
- State that does not move is reported rather than implied restored; sends are
  reported as absent and cross-device modulation remains explicitly unmeasured.
- Brain typecheck and **444/444** offline tests pass, including multi-device
  position preservation, unknown-state refusal and extraction-window preflight.
  Extension Gradle test passes. The rebuilt controller is deployed and proved
  fresh. Full live conformance passes **51/0/6**; the first run exposed a
  pre-existing observer-population race in the switch fixture, whose bounded
  test-only wait and mint-independent cleanup are now covered by the clean run.
- Production MCP smoke passes every **P0-P11** check. It collapsed a named FX
  winner after extraction proof, reported exact non-carried state, restored the
  Organ at the container's former position before its following anchor, and
  removed the exact copied track it minted.
- The corrected own-track listening evidence heard collapse **4/4** versus
  placebo **0/4** across two blind sets. A separate randomized validity gate
  heard the proved 1200ms stop/relaunch control and not its placebo. The first
  setup that muted Master and a distracted gate were voided; stale VU readings
  while stopped are recorded as an oracle limit, not silence evidence.
- Exact-ID cleanup removed `gn-conf-A` and `gn-conf-B`; every audio and production
  copy removed its own minted id. The project returned to its 10-track baseline
  with Master visible.

Review pass, 2026-08-15 — three defects confirmed against the code and each
reproduced by a failing offline case before it was fixed:

- ⚠⚠ **A restoration two identical names could not prove reported success.**
  The whole position proof is a top-level NAME sequence, because a device has no
  durable id to diff — so a winner device sharing a name with a surviving
  top-level device made "it moved back" and "nothing happened" the same reading,
  and the answer said `finalPositionConfirmed: true` either way. The proof and
  the batch precondition now refuse a move whose projected order spells the
  order it started from, and `keep_device_alternate` projects the whole
  restoration **before the container is destroyed** and refuses there — the only
  point at which a refusal is still worth anything. No stronger observable
  exists to fall back on; if a device identity is ever measured, that is what
  relaxes this.
- ⚠ **The container delete carried no durable track guard.** It pointed a cursor
  by BANK ROW and guarded only the device NAME, so a track bank that changed
  since the scan aimed it at another track, where an identically named container
  ("FX Layer" is the ordinary case) satisfied the guard and was deleted with an
  `ok` reply. `device.delete` now sends `expectedTrackChannelId` — the same
  guard `device.relocate` already had — and the extension refuses on mismatch.
- ⚠ **Uncertainty after the delete reported less than a refusal would have.**
  The unconfirmed-removal path returned without the captured
  name/mute/solo/volume/pan/colour/sends state and under a key no other path
  used. Every outcome after the first write now carries that state, and removal
  is a three-way answer read off a fresh complete order — removed, not removed,
  or unconfirmed — never a receipt's opinion. A throw after the first write is
  reported as a partial outcome rather than as the surface's blanket "nothing
  was written", which it would have been.

⚠ **Two prior claims are corrected by this pass.** The shared conformance row's
collapse fixture held three identically named devices, so its restoration was
never provable by its own oracle; it now builds the winner and its following
anchor out of three distinct devices. And the production smoke left the
container LAST, where any winner is "restored" by appending it — so P10's
position half was unfalsifiable. The probe now adds one ordinary device after
the container and asserts the kept device reads back at the container's former
position, before that anchor.

⚠⚠ **A fourth defect surfaced only when the fixes met a real DAW, and it was
measured rather than guessed at.** `LiveAdapter.containerScope` re-points cursor
0 and reads `chain.inventory`, waiting the **`cursorPoint`** budget (25ms) — a
budget borrowed from what a cursor POINT costs, while this reply arrives through
`Rig.slotLayerBanks`, which must follow the cursor to another track first.
Measured: re-pointing between tracks and reading immediately, the reply named the
track just pointed at **0/6 at 0ms, 3/6 at 25ms, 5/6 at 50ms, 6/6 from 100ms**.
Nothing was ever mis-reported — the identity guard fails closed — but every
container write refused roughly half the time when the cursor had been elsewhere,
and `C-chain-switch` failed **two live runs in three** on exactly that. A
mismatch is now retried within a bound (8 passes, `cursorPoint` on the first and
`trackStruct` after) because a mismatch is a staleness signal and never an
observation; every other miss still answers at once, because each of those IS
one. The bound counts ATTEMPTS, not wall-clock: a clock spins hot wherever
`settle` is not real time, which is every offline test of this class.

Verification at this boundary — everything below was actually run:

- Brain typecheck plus **451/451** offline tests (7 new regression cases: the
  indistinguishable-move proof and precondition, the duplicate-name collapse
  refusal, the not-removed report, the unconfirmed report, the lagging-inventory
  retry and its bound). Extension Gradle build green; `git diff --check` clean.
- The jar was rebuilt, atomically deployed and the controller reloaded;
  `probe:hello` proved the running build fresh and ALL PASS. ⚠ The wire golden
  is unchanged at 147 methods / `7f212c48cd3dab75` because `methodsHash` is over
  method NAMES and this change adds a PARAMETER — the hash cannot see it, exactly
  as it could not see step 6b-1's reply fields, so the redeploy was the proof and
  a matching hash would not have been.
- Live conformance passes **51/0/6**, five runs in total: three consecutive after
  the settle fix, then two more after the bound was changed from a clock to an
  attempt count. Before that fix the same suite ran 50/1/6, 51/0/6, 50/1/6.
- Production MCP smoke passes **P0-P13**, 14/14 with zero failures. ⚠ P10-P12 are
  new and they close a real hole: creation and fill both leave the container
  LAST, where restoring the winner and appending it are the same result, so the
  position half of the old P10 could not fail. With one ordinary device added
  after the container, the live answer reads
  `finalDeviceOrder: ["Instrument Layer", "Organ", "Polysynth"]` — the kept Organ
  back at the removed container's position 1, before its Polysynth anchor, with a
  recorded `reorderChange`. That is acceptance item 2 proved live for the first
  time.
- Exact-ID cleanup removed each copied track it minted, and
  `probe:conformance-cleanup` removed `gn-conf-A` and `gn-conf-B`. The project is
  back to its documented 10-track baseline with Master visible and no residue.
- ⚠ **The audible evidence was NOT re-taken.** It stands as the earlier
  measurement; nothing in this pass changes what a successful collapse does to
  the signal, and nothing here re-proves it.

## Session 3f-h — selective reduction

⚠ This is the next session. The knowledge-base detour above changed nothing in
its scope or acceptance.

Purpose: remove one explicitly named alternate while preserving several named
survivors by rebuilding the container.

Acceptance:

1. Preflight every survivor's complete ordered devices and exact reported state.
2. Preserve survivor names and multi-device order through the rebuild.
3. Restore or explicitly report mute, solo, volume, pan and colour.
4. Never report completion after a partial rebuild; remove the old container only
   after the replacement structure is independently proved.
5. Keep cross-device modulation outside the claim until its indexed route is
   measured.
6. Pass offline, extension, live conformance, production smoke, context and diff
   checks with no residue.

## Following slices

| Slice | Focus |
|---|---|
| 3f-i | complete lifecycle production smoke and handoff to 3g |

Selective reduction is a Phase 1 requirement, not optional. Session 3g does not
start until creation, filling, switching, collapse and selective reduction are
autonomous, live-proven to their stated boundary, and mechanically honest on the
production surface.

## Constraints carried forward

- A fresh FX Layer has one chain; a fresh Instrument Layer has zero. Production
  creation uses the bundled one-entry seed for the latter.
- Explicitly name a chain before relying on its `ChainAddress`; an untouched
  shipped chain can auto-name itself when first filled.
- Every typed chain delete refuses. Reduction therefore relocates devices and
  deletes the container; selective reduction rebuilds the surviving set.
- Relocation and rebuild must preserve multi-device order. Collapse must restore
  the container's original signal-chain position rather than append at
  `chainEnd`.
- Moving devices does not carry chain-level state. Reapply or report name, mute,
  solo, volume, pan and colour; chains have no sends.
- Keep cross-device modulation outside the claim until its indexed route is
  measured, and measure the audible effect on the rebuilt track itself.
- Device-alternate tools may reopen `layer` or `chain` in the surface vocabulary
  only deliberately, with a rewritten reason in `naming.ts`. Session 3f owns the
  minimum wording needed by each tool; 3g reviews and freezes the versioned
  description cohort.
