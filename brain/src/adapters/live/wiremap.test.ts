/**
 * The wire-surface guard — the offline half of "the Phase-0 handler split changed
 * nothing".
 *
 * `extension/methods.golden.json` was extracted from ProbeHandlers' dispatch
 * switch BEFORE the split, and the split's own generator refused to rewrite it
 * unless every pre-split name survived. These tests re-check that from the other
 * side, by parsing the registrations out of the Java source — so a fat-fingered
 * rename fails here, offline, the moment it happens, rather than at the first
 * probe run against a live DAW.
 *
 * The live confirmation is `rig.methods` during the Phase-0 sitting.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { WIRE_METHODS_BANNED, WIRE_METHODS_FORBIDDEN, WIRE_METHODS_USED } from './wiremap.js';
// Shared with `npm run wire:golden`, which is what regenerates the file these
// tests check. Two copies of the scraper would let the generator and the checker
// drift into agreeing on something wrong.
import { methodsHash, readGolden, scrapeRegistrations } from '../../tools/wire-golden.js';

const golden = readGolden();
const registeredMethods = (): string[] => scrapeRegistrations();

test('W-registry: every registration in the Java source is in the golden, and vice versa', () => {
  const registered = registeredMethods().sort();
  assert.deepEqual(registered, [...golden.methods].sort(),
    'the extension registers a different method set than extension/methods.golden.json records');
  assert.equal(registered.length, golden.count);
});

test('W-registry: no method is registered twice', () => {
  const registered = registeredMethods();
  const seen = new Set<string>();
  const dupes = registered.filter((m) => (seen.has(m) ? true : (seen.add(m), false)));
  // A switch with duplicate case labels does not compile; a Map.put silently
  // wins. HandlerRegistry.on throws at init, and this catches it before deploy.
  assert.deepEqual(dupes, [], 'duplicate handler registration would silently shadow at runtime');
});

test('W-split: the split was a no-op — every pre-split method survived', () => {
  const carried = golden.methods.filter((m) => !golden.addedInPhase0.includes(m)).sort();
  assert.deepEqual(carried, [...golden.preSplitMethods].sort(),
    'the handler split dropped or renamed a wire method — the archived probes would break');
  assert.equal(carried.length, golden.preSplitCount);
});

test('W-split: session 1 added only the two contract meta-methods', () => {
  assert.deepEqual([...golden.addedInSession1].sort(), ['contract.hello', 'rig.methods']);
});

test('W-split: session 2 added only E14 probe surface, nothing the contract can reach', () => {
  // The UI probe (PHASE-0 §Scope item 5) needs a wire surface, and adding one
  // moves `methodsHash` — which is the whole reason the golden has to be
  // regenerated and `probe:hello` re-run before the sitting. What must NOT
  // happen is a probe method quietly becoming product surface, so the shape of
  // the addition is asserted rather than just its size.
  assert.ok(golden.addedInSession2.every((m) => m.startsWith('ui.')),
    `session 2 added a non-ui method: ${golden.addedInSession2.filter((m) => !m.startsWith('ui.')).join(', ')}`);
  const reachable = golden.addedInSession2.filter((m) => WIRE_METHODS_USED.includes(m));
  assert.deepEqual(reachable, [], 'E14 is a probe, not a capability — the contract must not reach any of it');
  // ⚠ Every post-split addition must be accounted for by exactly one sitting's
  // bucket. The equality is the bookkeeping guard: a method that appears on the
  // wire without landing in a named bucket is one nobody has had to justify.
  assert.deepEqual([...golden.addedInPhase0].sort(),
    [...golden.addedInSession1, ...golden.addedInSession2,
      ...(golden.addedInE16 ?? []), ...(golden.addedInE20 ?? [])].sort());
});

test('E16: the branch probe surface is probe surface, and the contract cannot reach it', () => {
  // E16 asks whether a branch can be a duplicated track. Nothing about it is
  // decided (SPIKE-E16 §4 kill criteria), so none of its wire methods may become
  // reachable from the contract before the rows return verdicts — the same rule
  // that kept E14 out, for the same reason.
  // Named one by one rather than by prefix: the list IS the record of what the
  // mini-spike put on the wire, and a prefix rule would let the next addition in
  // unnoticed.
  // ⚠ Session 4 added three, all for §3.1 (can an existing device be MOVED into
  // a layer?). They are relocation-verb probe surface and nothing else:
  // `layer.moveDeviceInto` is the exact sibling of `layer.copyDeviceInto`, whose
  // ○ in E4d rested on a single mechanism; `device.moveTo` is the same-track
  // CONTROL, without which a no-op into a layer cannot be told from a verb that
  // does nothing anywhere; `layer.pasteInto` is the independent clipboard route
  // the complete-recall sweep turned up. None may become product surface.
  //
  // ⚠ Session 5 added five, in ONE restart because a Java change costs a full
  // Bitwig restart and three rows needed one. Named individually for the same
  // reason as the rest: the list IS the record, and a prefix rule would let the
  // next addition in unnoticed.
  //   slot.moveTo       §3.4f — moves a launcher clip. ⚠ Defaults to
  //                     `replaceInsertionPoint().moveSlotsOrScenes()`; the
  //                     `ClipLauncherSlotOrScene.moveTo` this is named after is
  //                     @Deprecated (API 4) and is reachable only by asking for
  //                     it by name, per standing rule 9.
  //   slot.epoch        §3.4f — the detector, and the actual point of the row:
  //                     a counter driven by per-bank `hasContent` observers, so
  //                     "is a clip move detectable" can be answered PUSHED
  //                     rather than only polled.
  //   layer.setMixer    the DeviceLayer-mute lead — `Channel` on a layer chain,
  //                     which would be a device-scoped A/B reaching the master
  //                     and the FX returns that no fork can.
  //   equals.status     §3.4g — reads the pre-allocated `createEqualsValue`
  //   equals.tryCreate  matrix, and asks standing rule 13's question directly.
  //
  // ⚠ Session 6 (E17) added NINE, again in one restart, because five of the six
  // capability rows needed Java and a Java change costs a full Bitwig restart.
  // E17 asks whether DEVICE branching should be layer chains rather than track
  // forks; nothing about it is decided either, so the same rule applies — none
  // of it may become product surface before the rows return verdicts.
  //   device.selectInEditor  row 1's ENABLING call, and the reason the row was
  //                     never probeable: a named action fires against the UI
  //                     selection, and `devcursor.selectAt` does not set it —
  //                     it moves our own non-following cursor. So no previous
  //                     sitting had ever fired an action with a DEVICE selected.
  //   layer.select      the same, one level down, via `DeviceChain.selectInEditor`
  //                     and `Channel.selectInMixer`. ⚠ `DeviceChain.select()` is
  //                     @Deprecated and is deliberately NOT wired (rule 9).
  //   layer.delete      row 4 — `DeleteableObject` on a layer. E4d probed
  //   layer.deleteViaHost      duplicate and never probed delete, and this row
  //                     alone is the minimum viable unlock: revert-by-delete is
  //                     what makes a branch exact regardless of contents (§4.2).
  //   layer.duplicateViaHost  row 2's third mechanism, the one `duplicateObject`'s
  //                     own javadoc names. Routes 1 and 2 re-ran ○ in `e17b`
  //                     with the precondition proved, so this is what is left.
  //   layer.setName     row 5 — `name()` is a SettableStringValue, but E4c saw
  //                     layers rename themselves after their content. Decides
  //                     whether §1b's naming scheme survives the move to layers.
  //   layer.soloToggle  row 6 — `SoloValue.toggle(exclusive)`, the exclusivity
  //                     primitive. The question is SCOPE, not whether it sets.
  //   layer.pointCursor ⚠ session 7's ONE addition, and the reason for a second
  //                     restart: `e17l` proved with a human in the loop that the
  //                     named actions DO act on a selected layer (Copy+Paste 4→5,
  //                     Delete 4→3) — so rows 3 and 4 are UNREACHABLE, not closed,
  //                     and the only broken link is our own selection.
  //                     `CursorChannel.selectChannel()` is the mechanism E16j
  //                     watched `Group` obey for TRACKS; this is its exact
  //                     analogue on `CursorDeviceLayer`, never once called.
  //   layer.insertViaCursor  row 3 — the last untried reading of the vendor's own
  //   layer.insertAtStart    documentation (a chain is created as a SIDE EFFECT
  //                     of adding a device to the container) plus the last
  //                     unexercised InsertionPoint source on a layer, which is
  //                     its control. Both expected ○: E4e is a reasoned negative.
  const allowed = [
    'transport.play', 'device.insertVst3',
    'device.moveTo', 'layer.moveDeviceInto', 'layer.pasteInto',
    'slot.moveTo', 'slot.epoch', 'layer.setMixer',
    'equals.status', 'equals.tryCreate',
    'device.selectInEditor', 'layer.select', 'layer.pointCursor',
    'layer.delete', 'layer.deleteViaHost', 'layer.duplicateViaHost',
    'layer.setName', 'layer.soloToggle',
    'layer.insertViaCursor', 'layer.insertAtStart',
    // ⚠ E17, the reopened selection question. Named individually with a reason
    // each, because a wildcard here would let the next session add anything.
    //
    // `layer.selectLegacy` — `DeviceChain.select()`, the FOURTH setter and the one
    //   never tried. An API sweep found TWO selection concepts on a chain
    //   (select/addIsSelectedObserver, both @Deprecated; selectInEditor/
    //   addIsSelectedInEditorObserver, current) and E17 only ever used the second.
    //   Rule 9 was applied and it IS deprecated, so it is expected to throw — it is
    //   wired guarded so the throw is RECORDED rather than assumed.
    // `layer.selectionState` — the reader the question turns on, isolated from
    //   `layer.list` so the read cannot perturb the selection it measures.
    // `app.selectionNotifications` — Bitwig's OWN device-layer selection
    //   notification, as a second oracle that can disagree with the observer.
    'layer.selectLegacy', 'layer.selectionState', 'app.selectionNotifications',
    // ⚠ The `*Action()` routes — `DeleteableObject.deleteObjectAction()` and
    //   `DuplicableObject.duplicateObjectAction()`, both returning a
    //   HardwareActionBindable with `invoke()`. NEVER called before. Named here
    //   because the duplicate case proved which SIBLING METHOD you call decides the
    //   outcome: `DuplicableObject.duplicateObject()` is dead on a layer while
    //   `Channel.duplicate()` creates a chain. So `deleteObject()` refusing says
    //   nothing about `deleteObjectAction()`.
    // `track.deleteViaAction` — ⚠ the VERB CONTROL. Track and DeviceLayer are
    //   SIBLINGS (both bare `Channel`s; DeviceLayer's interface body is empty), so
    //   this is the identical inherited call differing only in receiver. Without it
    //   a ○ on the layer side is uninterpretable. ⚠ It deletes a track: probe
    //   surface only, unreachable from the contract like every destructive route.
    'layer.deleteViaAction', 'layer.duplicateViaAction', 'track.deleteViaAction',
    // ⚠⚠ E18 §3.1's TWO, and they are the whole reason for its restart. The chain
    //   DELETE is exhausted — both `DeleteableObject` forms, each with and without
    //   the selection precondition that unlocked CREATE, each bracketed by a Track
    //   sibling control deleting in the same run, and with a mechanism that predicts
    //   the ○. So the operator proposed working WITHOUT a delete: clone the
    //   container with fewer chains, migrate the devices across, delete the old
    //   container. ⚠ E16n only ever measured `moveDevices` INTO a chain; every
    //   direction that strategy needs — chain → top level, chain → chain, and chain
    //   → chain across DIFFERENT containers — has never been tested, and no wire
    //   method could even name a device inside a chain as a SOURCE.
    // `chain.move`      the mover. Carries BOTH verbs, because sibling verbs on this
    //   very interface disagree (`copyDevices` ○ beside `moveDevices` ●, E4d/E16n)
    //   and because copy is the better product primitive here: a copy-then-delete
    //   rebuild never has the device missing from the signal path, which is the
    //   operator's explicit bar about glitchy intermediate states.
    // `chain.inventory` guard #2 in one call — the slot, its chains, and the devices
    //   inside those chains, read together. Three E17 probes read "nothing happened"
    //   while a container was duplicated one level above where they looked, and
    //   `e17ac` shipped that blind spot a third time after it had been written up as
    //   a method trap. It also reports `slotScopeStatus`, because standing rule 13
    //   makes "the handle was never built" and "the API declines" indistinguishable
    //   in the outcome — three false ○s in E17 came from exactly that.
    // ⚠ Both read through `Rig.slotLayerBanks`, layer banks hung off top-level
    //   device SLOTS rather than off `cursorDevice0`. `layerBank0` follows the
    //   cursor, so only ONE container is addressable at a time — fatal for the
    //   cross-container direction, where scoping to the destination re-scopes the
    //   handle pointing at the source. It also removes the e16o trap from the row:
    //   the container is named by a parameter instead of by hidden cursor state.
    'chain.move', 'chain.inventory',
  ];
  const e16 = golden.addedInE16 ?? [];
  const unexpected = e16.filter((m) => !m.startsWith('branch.') && !allowed.includes(m));
  assert.deepEqual(unexpected, [], `E16 added an unexpected method: ${unexpected.join(', ')}`);
  const reachable = e16.filter((m) => WIRE_METHODS_USED.includes(m));
  assert.deepEqual(reachable, [], 'E16 is a mini-spike, not a capability — the contract must not reach any of it');
});

test('E20: session 3′s early-probe surface is probe surface, and the contract cannot reach it', () => {
  // ⚠ Session 3′ measures four design-gating unknowns BEFORE the clip block is
  // designed (PHASE-1 §Re-plan row 3′). Every one of these is a call nobody had
  // ever made, and the whole point of running them early is that the design gets
  // to depend on a measurement instead of a javadoc — so none of it may become
  // contract surface here. Session 3″ owns what the clip block exposes, under
  // D18c's fresh-language rule, and a name minted in a probe would freeze the
  // vocabulary the moment before the vocabulary is designed.
  //
  // Named one by one, with a reason each, for the same reason E16's list is: the
  // list IS the record, and a prefix rule would let the next addition in
  // unnoticed.
  //
  //   slot.launchWithOptions  ⚠⚠ THE ONE THE CLIP HALF RESTS ON. Per-call
  //                     quantisation ("1"/"8") and, decisively,
  //                     "continue_or_synced" — take B picks up at A's position
  //                     instead of restarting, which is the only answer to
  //                     E16m's beat-alignment complaint and something no mute,
  //                     solo or chain switch can imitate. ⚠ Both strings are
  //                     validated in the handler before Bitwig sees them: the API
  //                     takes free strings, and E14-A1 established that a value
  //                     Bitwig rejects asynchronously takes the DAW down.
  //   slot.duplicateClip  the primitive that mints the next take. Its javadoc is
  //                     three words and says nothing about WHERE the copy lands,
  //                     which is the only part the append-only geometry depends
  //                     on. Carries BOTH routes (slot and bank) because sibling
  //                     verbs on these interfaces demonstrably disagree.
  //   slot.playState    isPlaying / isPlaybackQueued / isStopQueued. The QUEUED
  //                     half is what separates "the launch was quantised and is
  //                     waiting for the bar" from "the call did nothing".
  //   cursor.playState  `Clip.playingStep()` — the only handle in the API that
  //                     can say where inside a clip playback is, and therefore
  //                     the only thing that can turn "continue_or_synced" from
  //                     an impression into a measurement with a control arm.
  //   ui.get            reads one setting back WITH ITS LENGTH, for the
  //                     `getDocumentState()` capacity sweep (D18d's record lands
  //                     there). Standing rule 1: a write that truncated and a
  //                     write that landed are indistinguishable from the ack.
  const allowed = [
    'slot.launchWithOptions', 'slot.duplicateClip', 'slot.playState',
    'cursor.playState', 'ui.get',
  ];
  const e20 = golden.addedInE20 ?? [];
  const unexpected = e20.filter((m) => !allowed.includes(m));
  assert.deepEqual(unexpected, [], `session 3′ added an unexpected method: ${unexpected.join(', ')}`);
  const reachable = e20.filter((m) => WIRE_METHODS_USED.includes(m));
  assert.deepEqual(reachable, [],
    'these are probes for a design that has not been made — the contract must not reach any of it');
});

test('W-hash: the golden hash matches its own method list', () => {
  // The extension computes this same value in handlers/Contract.java and returns
  // it from contract.hello, so a drifted deployment is caught at connect.
  assert.equal(methodsHash([...golden.methods].sort()), golden.methodsHash);
});

test('W-contract: every method the encoder can emit exists in the extension', () => {
  const unknown = WIRE_METHODS_USED.filter((m) => !golden.methods.includes(m));
  assert.deepEqual(unknown, [], 'the encoder would call a method the extension does not register');
});

test('W-contract: the contract reaches only a deliberate subset of the wire', () => {
  // The gap is the design, not incompleteness: the rest is probe surface. If this
  // ever approaches parity, the contract has drifted into being a 1:1 RPC facade
  // — which is the Beat Twin 57-tool failure the union shape exists to avoid.
  assert.ok(WIRE_METHODS_USED.length < golden.methods.length / 2,
    `contract reaches ${WIRE_METHODS_USED.length} of ${golden.methods.length} wire methods`);
});

test('W-banned: no banned method is reachable from the contract (E6, E3)', () => {
  for (const [method, why] of Object.entries(WIRE_METHODS_BANNED)) {
    assert.ok(!WIRE_METHODS_USED.includes(method), `${method} must stay unreachable: ${why}`);
    // It must still be REGISTERED, because the probes that established the ban
    // run against it and they are the live regression suite.
    assert.ok(golden.methods.includes(method), `${method} should remain on the wire for the probes`);
  }
});

test('W-forbidden: a method that CRASHES Bitwig is not registered at all (E14-A1)', () => {
  // ⚠ The inverse of W-banned, and the distinction is the point. A banned method
  // stays on the wire because the probe that banned it is a regression test worth
  // keeping runnable. A FORBIDDEN one cannot be re-run: `ui.signalFire` took
  // Bitwig down with an unsaved project, and the throw arrived on Bitwig's own
  // thread where no extension try/catch could contain it. So the registration
  // itself is the hazard, and this test is what stops it being re-added by
  // someone reading the E14 plan and wondering why row A looks unfinished.
  for (const [method, why] of Object.entries(WIRE_METHODS_FORBIDDEN)) {
    assert.ok(!golden.methods.includes(method), `${method} must NOT be registered: ${why}`);
    assert.ok(!WIRE_METHODS_USED.includes(method), `${method} must not be reachable either: ${why}`);
    assert.ok(!Object.keys(WIRE_METHODS_BANNED).includes(method),
      `${method} is forbidden, not banned — the banned list requires it to stay registered`);
  }
});

test('W-forbidden: no handler source registers a forbidden method (E14-A1)', () => {
  // The golden could in principle be edited to hide a registration, so this
  // checks the Java directly rather than trusting the record of it.
  const registered = registeredMethods();
  for (const [method, why] of Object.entries(WIRE_METHODS_FORBIDDEN)) {
    assert.ok(!registered.includes(method), `${method} is registered in the extension: ${why}`);
  }
});

test('W-banned: no source outside src/probes/ mentions a banned wire method', () => {
  // The only real enforcement of a "never" rule is a test that greps for it.
  const srcRoot = join(import.meta.dirname, '..', '..');
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'probes' || entry.name === 'node_modules') continue;
        walk(path);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;
      // wiremap.ts names them in order to ban them; that is the one exemption.
      if (path.endsWith(join('live', 'wiremap.ts')) || path.endsWith('wiremap.test.ts')) continue;
      const src = readFileSync(path, 'utf8');
      for (const method of Object.keys(WIRE_METHODS_BANNED)) {
        if (src.includes(`'${method}'`) || src.includes(`"${method}"`)) {
          offenders.push(`${path} mentions ${method}`);
        }
      }
    }
  };
  walk(srcRoot);
  assert.deepEqual(offenders, [], 'a banned wire method leaked outside the probe layer');
});
