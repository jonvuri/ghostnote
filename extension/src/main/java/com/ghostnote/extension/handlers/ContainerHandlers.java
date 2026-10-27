package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Bridge;
import com.ghostnote.extension.ContainerScopes;
import com.ghostnote.extension.DeviceWindow;
import com.ghostnote.extension.WindowPager;
import com.ghostnote.extension.LayerPageWitness;
import java.util.function.Consumer;
import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.Device;
import com.bitwig.extension.controller.api.DeviceBank;
import com.bitwig.extension.controller.api.DeviceChain;
import com.bitwig.extension.controller.api.DeviceLayer;
import com.bitwig.extension.controller.api.DeviceSlot;
import com.bitwig.extension.controller.api.DrumPad;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Nested containers: device layers, drum pads and chain selectors (E4c, E4d, E4e).
 *
 * Mostly exploration surface, retained because it is what the E4c/E4d probes
 * run against. Findings baked in: hasLayers=true does NOT imply a layer exists
 * (check the bank count, never the capability flag); layers rename themselves
 * after their content so layer names are not identities; and
 * selectFirstInKeyPad takes a MIDI KEY, not a pad index (E4d).
 *
 * Split out of ProbeHandlers.java in Phase 0; the method bodies are unchanged.
 */
public final class ContainerHandlers extends HandlerGroup {
    public ContainerHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("layer.list", params -> layerList());
        r.on("layer.insertDevice", params -> layerInsertDevice(params));
        r.on("layer.duplicate", params -> layerDuplicate(params));
        r.on("layer.duplicateChannel", params -> layerDuplicateChannel(params));
        r.on("layer.copyDeviceInto", params -> layerCopyDeviceInto(params));
        r.on("layer.moveDeviceInto", params -> layerMoveDeviceInto(params));
        r.on("layer.pasteInto", params -> layerPasteInto(params));
        r.on("layer.insertFile", params -> layerInsertFile(params));
        r.on("layer.insertRelative", params -> layerInsertRelative(params));
        r.on("layer.setMixer", params -> layerSetMixer(params));
        // ⚠ E17 — the six capability rows. See the block comment above
        // `layerDelete` for why each of these is on the wire and what a ○ from it
        // would and would not mean.
        r.on("layer.select", params -> layerSelect(params));
        r.on("layer.pointCursor", params -> layerPointCursor(params));
        r.on("layer.delete", params -> layerDelete(params));
        r.on("layer.deleteViaHost", params -> layerDeleteViaHost(params));
        r.on("layer.duplicateViaHost", params -> layerDuplicateViaHost(params));
        r.on("layer.setName", params -> layerSetName(params));
        r.on("layer.soloToggle", params -> layerSoloToggle(params));
        r.on("layer.insertViaCursor", params -> layerInsertViaCursor(params));
        r.on("layer.insertAtStart", params -> layerInsertAtStart(params));
        r.on("layer.selectLegacy", params -> layerSelectLegacy(params));
        r.on("layer.selectionState", params -> layerSelectionState());
        r.on("layer.deleteViaAction", params -> layerDeleteViaAction(params));
        r.on("layer.duplicateViaAction", params -> layerDuplicateViaAction(params));
        // ⚠⚠ E18 §3.1 — the REBUILD strategy's gating direction. See `chainMove`.
        r.on("chain.inventory", params -> chainInventory());
        // B17: the extension owns the scopes. `chain.observe` and every chain
        // write name an absolute container position; each aims and settles a
        // scope for it in later tasks and replies once (`ContainerScopes`).
        r.onAsync("chain.observe", this::chainObserve);
        r.onAsync("chain.move", this::chainMove);
        ChainControlHandlers.over(host, rig).register(r);
        r.on("drumpad.list", params -> drumPadList());
        r.on("drumpad.insertDevice", params -> drumPadInsertDevice(params));
        r.on("drumpad.duplicate", params -> drumPadDuplicate(params));
        r.on("chainselector.status", params -> chainSelectorStatus());
        r.on("chainselector.set", params -> chainSelectorSet(params));
    }

    /** Enumerate the layers of the pointed device and the devices inside each. */
    private JsonElement layerList() {
        JsonArray layers = new JsonArray();
        int existing = 0;
        for (int l = 0; l < Rig.LAYER_BANK; l++) {
            final int layerIndex = l;
            DeviceLayer layer = rig.layerBank0.getItemAt(l);
            if (!layer.exists().get()) {
                continue;
            }
            existing++;
            JsonObject obj = new JsonObject();
            obj.addProperty("index", l);
            obj.addProperty("name", layer.name().get());
            // ⚠ E16 — the `Channel` half of a DeviceLayer, read rather than assumed.
            // Guarded per field so an unmarked or unsupported one names itself
            // instead of failing the whole enumeration: the interesting outcome is
            // "mute reads but volume does not", and a request-level failure would
            // hide it. `channelId` is here because if a layer has one, layers have
            // durable identity — which E16l's complete pass never thought to ask,
            // having enumerated `Channel` for tracks only.
            putGuarded(obj, "mute", () -> layer.mute().get());
            putGuarded(obj, "solo", () -> layer.solo().get());
            putGuarded(obj, "activated", () -> layer.isActivated().get());
            putGuarded(obj, "volume", () -> layer.volume().value().get());
            putGuarded(obj, "pan", () -> layer.pan().value().get());
            putGuarded(obj, "channelId", () -> layer.channelId().get());
            // ⚠ E18 §3.1 — the chain-level state a rebuild has to carry by hand.
            // Moving devices carries the DEVICES and nothing else, so anything read
            // here is something the migration must re-apply or silently lose.
            putGuarded(obj, "color", () -> String.format("%.3f,%.3f,%.3f",
                layer.color().red(), layer.color().green(), layer.color().blue()));
            JsonArray sends = new JsonArray();
            try {
                if (rig.layerSendBanks[l] != null) {
                    for (int s = 0; s < Rig.LAYER_SEND_BANK; s++) {
                        com.bitwig.extension.controller.api.Send send =
                            rig.layerSendBanks[l].getItemAt(s);
                        if (!send.exists().get()) {
                            continue;
                        }
                        JsonObject row = new JsonObject();
                        row.addProperty("index", s);
                        row.addProperty("name", send.name().get());
                        row.addProperty("value", send.value().get());
                        sends.add(row);
                    }
                }
            } catch (Throwable t) {
                obj.addProperty("sendsError", t.getClass().getSimpleName() + ":" + t.getMessage());
            }
            obj.add("sends", sends);
            JsonArray devices = new JsonArray();
            for (int d = 0; d < Rig.LAYER_DEVICE_BANK; d++) {
                Device nested = rig.layerDeviceBanks[l].getDevice(d);
                if (!nested.exists().get()) {
                    continue;
                }
                JsonObject dev = new JsonObject();
                dev.addProperty("index", d);
                dev.addProperty("name", nested.name().get());
                devices.add(dev);
            }
            obj.add("devices", devices);
            putGuarded(obj, "deviceCount", () -> rig.layerDeviceBanks[layerIndex].itemCount().get());
            layers.add(obj);
        }
        JsonObject result = new JsonObject();
        result.add("layers", layers);
        result.addProperty("count", existing);
        putGuarded(result, "itemCount", () -> rig.layerBank0.itemCount().get());
        result.addProperty("bankSize", Rig.LAYER_BANK);
        result.addProperty("deviceBankSize", Rig.LAYER_DEVICE_BANK);
        putGuarded(result, "hasLayers", () -> rig.cursorDevice0.hasLayers().get());
        // Whether the layer mixer handles survived init at all — see Rig. A row
        // that reads `mute` as ERR everywhere means something different depending
        // on this: "the handle was never marked" or "the API refuses it".
        result.addProperty("layerMixerStatus", rig.layerMixerStatus);
        // ⚠ Rule 13, reported per handle group: "every chain reads 0,0,0 and no
        // sends" means something different depending on whether these ever marked.
        result.addProperty("layerColorStatus", rig.layerColorStatus);
        result.addProperty("layerSendsStatus", rig.layerSendsStatus);
        // Named, not counted (e16t): which device the bank is actually scoped to.
        // Every layer call reaches its target through this cursor, so a row that
        // does not report it cannot tell a refusal from a mis-aimed read.
        putGuarded(result, "cursorDeviceName", () -> rig.cursorDevice0.name().get());
        return result;
    }

    /**
     * ⚠ E16 — drive a layer chain's mixer. The mirror of `branch.setMixer`, one
     * level down, and the whole of the DeviceLayer-mute lead.
     *
     * **Why this could matter more than it looks.** The track-native model buys a
     * lineage-level A/B by muting a group (E16m ●, sends and all), but it cannot
     * reach the two places E16r showed leave the addressable set FIRST — the
     * master and the FX returns — because an FX return cannot be forked at all
     * (other tracks' sends still feed the original, §4.8). A device-scoped A/B is
     * the only mechanism that reaches them, and until now the only candidate was a
     * chain selector, which needs a multi-chain preset a human has to build by
     * hand (Selectors ship with zero chains and E16o proved no verb seeds them).
     * If a layer chain's `mute()` works, the 4-chain Instrument Layer fixture
     * already on disk is enough, and it costs no bank slot and no C5 glitch.
     *
     * ⚠ **What it would NOT buy, so the row is not oversold.** Layer chains run in
     * PARALLEL, so muting is not switching: §4.4 wants a single readable "which
     * branch is live", and N mute flags is exactly the thing §4.4 exists to
     * replace — E16m found the same shape one level up, where a child's own flag
     * says nothing about whether its lineage is audible. A ChainSelector's
     * `activeChainIndex()` IS that single readable integer. So this is the cheap
     * A/B that works today with an asset we have; the selector remains the answer
     * to §4.4, and §3.4e still has to be measured.
     *
     * ⚠ The destination is implicit in `cursorDevice0` — `rig.layerBank0` follows
     * it — so the container must be the SELECTED device when this is called. That
     * is the trap E16o nearly published a false negative on: aimed at a device
     * with no layers this is a silent no-op that is byte-identical to an API
     * refusal. `hasLayers` and the layer's own `exists` are checked first so the
     * handler refuses loudly instead, and the probe still asserts the precondition
     * separately from its question.
     */
    private JsonElement layerSetMixer(JsonObject params) {
        int layerIndex = params.get("layerIndex").getAsInt();
        if (layerIndex < 0 || layerIndex >= Rig.LAYER_BANK) {
            throw new IllegalArgumentException("layerIndex out of bank range: " + layerIndex);
        }
        DeviceLayer layer = rig.layerBank0.getItemAt(layerIndex);
        if (!layer.exists().get()) {
            throw new IllegalArgumentException(
                "no layer at index " + layerIndex + " — the cursor device is "
                + rig.cursorDevice0.name().get() + ", hasLayers="
                + rig.cursorDevice0.hasLayers().get());
        }

        JsonObject r = ok();
        r.addProperty("layerIndex", layerIndex);
        r.addProperty("layerName", layer.name().get());
        if (params.has("mute")) {
            boolean value = params.get("mute").getAsBoolean();
            layer.mute().set(value);
            r.addProperty("mute", value);
        }
        if (params.has("solo")) {
            boolean value = params.get("solo").getAsBoolean();
            layer.solo().set(value);
            r.addProperty("solo", value);
        }
        if (params.has("activated")) {
            boolean value = params.get("activated").getAsBoolean();
            layer.isActivated().set(value);
            r.addProperty("activated", value);
        }
        if (params.has("volume")) {
            double value = params.get("volume").getAsDouble();
            layer.volume().value().setImmediately(value);
            r.addProperty("volume", value);
        }
        if (params.has("pan")) {
            layer.pan().value().setImmediately(params.get("pan").getAsDouble());
        }
        // ⚠ E18 §3.1 — the WRITE half. Reading colour and sends says what a rebuild
        // would lose; writing them says whether it can put them back. A read-only
        // measurement would answer half the question and the wrong half: "the old
        // chain was blue" is useless if the new one cannot be made blue.
        if (params.has("color")) {
            JsonObject c = params.get("color").getAsJsonObject();
            layer.color().set(
                (float) c.get("r").getAsDouble(),
                (float) c.get("g").getAsDouble(),
                (float) c.get("b").getAsDouble());
            r.add("color", c);
        }
        if (params.has("sendIndex")) {
            int sendIndex = params.get("sendIndex").getAsInt();
            if (sendIndex < 0 || sendIndex >= Rig.LAYER_SEND_BANK) {
                throw new IllegalArgumentException("sendIndex out of bank range: " + sendIndex);
            }
            if (rig.layerSendBanks[layerIndex] == null) {
                throw new IllegalArgumentException(
                    "the send bank was never built: " + rig.layerSendsStatus
                    + " (rule 13 — a missing handle and a refusal look identical)");
            }
            com.bitwig.extension.controller.api.Send send =
                rig.layerSendBanks[layerIndex].getItemAt(sendIndex);
            // ⚠ Refuse rather than write into a slot that does not exist: a no-op on
            // an absent send is byte-identical to the API declining (the e16o trap).
            if (!send.exists().get()) {
                throw new IllegalArgumentException(
                    "no send at index " + sendIndex + " on chain " + layerIndex
                    + " — a DeviceLayer may legitimately have none; that is a finding, not a write");
            }
            send.value().setImmediately(params.get("sendValue").getAsDouble());
            r.addProperty("sendIndex", sendIndex);
        }
        return r;
    }

    // ======================================================================
    // ⚠ E17 — the six capability rows for the LAYER branching model.
    //
    // The question underneath all of them: should DEVICE branching be layer
    // chains inside one track rather than forked tracks? A layer costs no bank
    // slot (E16r's ceiling is the track model's budget), reaches the master and
    // the FX returns (which no fork can, §4.8), does not glitch on switch
    // (§3.4e, 0/4 vs 0/4 against duplication's 5/5) and costs ~0 bytes against a
    // fork's 20,391 (E16u). What it lacks is the ability to GROW: E4d/E4e is a
    // reasoned negative that layer-type containers cannot gain chains.
    //
    // ⚠ Every one of these is a candidate for the E16n shape — a sibling verb,
    // never called, on a destination that demonstrably works — and every one is
    // verified by a `layer.list` DIFF, never by its own return value. The
    // acknowledgement is identical whether or not anything happened (E6 blocker
    // 4), and `rig.layerBank0` follows `cursorDevice0`, so the container must be
    // the SELECTED device for any of them to reach their target at all (the
    // e16o trap: aimed at a device with no layers, every one of these is a
    // silent no-op byte-identical to an API refusal).
    //
    // Deprecation checked on all of them per standing rule 9: `selectInEditor`
    // (v1), `selectInMixer` (v1), `deleteObject` (v10), `duplicateObject` (v19),
    // `SoloValue.toggle` (v1), `name()` (SettableStringValue) and
    // `startOfDeviceChainInsertionPoint` (v7) are all current.
    // ⚠ `DeviceChain.select()` IS @Deprecated and is deliberately NOT wired —
    // `selectInEditor()` is its living equivalent.
    // ======================================================================

    /**
     * ⚠ E17 rows 1/2/4 — make a LAYER CHAIN the UI selection.
     *
     * **This is the enabling call for row 1 and it did not exist before.** A
     * named action fires against the UI selection (E6 blocker 3), and until now
     * nothing on the wire could point that selection at anything but a track.
     * `DeviceLayer` is a `DeviceChain`, so it carries `selectInEditor()` — and it
     * is a `Channel`, so it also carries `selectInMixer()`. Neither has ever been
     * called. Without one of them, "fire `Group` with a chain selected" is not a
     * probe that can be written, and row 1's ○ would be about our reach rather
     * than about Bitwig.
     *
     * ⚠ Two mechanisms rather than one on purpose. This spike's most repeated
     * lesson is that sibling verbs on the same object disagree — `copyDevices` ○
     * beside `moveDevices` ● (E16n), `copyTracks` ○ beside three working
     * duplication verbs (row A), `DrumPad.insertionPoint()` ● where `DeviceLayer`
     * has none (E4d). A single-mechanism ○ here would be the sixth false negative
     * of exactly that shape.
     */
    /**
     * ⚠ E17 — `DeviceChain.select()`, the FOURTH setter, and the one nobody tried.
     *
     * **Why it exists as a probe target.** An API sweep for `selectInEditor` found
     * it on exactly three types — `Scene`, `DeviceChain`, `Device` — and turned up
     * something the whole session missed: `DeviceChain` carries **two** selection
     * concepts, not one.
     *
     *     selectInEditor()  ←→  addIsSelectedInEditorObserver     (current)
     *     select()          ←→  addIsSelectedObserver             (both @Deprecated)
     *
     * Every E17 probe used the first pair. The second was never called.
     *
     * ⚠ **Rule 9 was applied before wiring, and this IS @Deprecated** — so it is
     * expected to THROW, exactly as its sibling `addIsSelectedObserver` did at init
     * ("This has been deprecated since API version 2"). It is wired anyway, and
     * guarded, for one reason: a throw RECORDED is a measurement, where a method
     * never called is an assumption. `e17o` is the cautionary case — it recorded a
     * ● from a mechanism that turned out to do nothing.
     *
     * ⇒ Read a thrown result as "the legacy selection concept is unreachable from
     * API v25", not as "chains cannot be selected".
     */
    /**
     * ⚠⚠ E17 row 4 — `DeleteableObject.deleteObjectAction().invoke()`, the route
     * nobody has called.
     *
     * **Why this exists, and why the prior is better than it looks.** A type sweep
     * shows `DeviceLayer` is literally `interface DeviceLayer extends Channel {}` —
     * an empty body — while `Track extends Channel` too. They are SIBLINGS, and
     * `track.delete` reaches `Track.deleteObject()`, the *same inherited method*
     * that refuses on a layer. So the refusal is not "layers are not deletable"; it
     * is one specific method declining on one of two sibling types.
     *
     * ⚠ **And the duplicate case already proved which-method-you-call decides it:**
     *
     *     DuplicableObject.duplicateObject()   ○ dead on a layer
     *     Channel.duplicate()                  ● creates a chain (with a selection)
     *
     * Two sibling verbs, opposite outcomes. `Channel` declares its own bespoke
     * `duplicate()` but **no delete at all** — deletion arrives only via
     * `DeleteableObject`, which offers exactly two forms. We have called one.
     *
     *     deleteObject()          ○ measured, e17f / e17q / e17al
     *   ⚠ deleteObjectAction()    → HardwareActionBindable → invoke()  ← NEVER CALLED
     *
     * ⇒ A ○ on `deleteObject()` says nothing about this. It is the last untried
     * typed route to destroying a chain, and destroy is the only half of the branch
     * lifecycle still missing after `e17ak` made creation autonomous.
     *
     * ⚠ Guarded: a throw is DATA, not a dead bridge (the `layerSelectLegacy`
     * lesson, where a @Deprecated call returned instead of throwing).
     * ⚠ `requireLayer` refuses when the cursor is not on the container, so a no-op
     * from an empty bank can never be misread as a refusal (the e16o trap).
     */
    private JsonElement layerDeleteViaAction(JsonObject params) {
        DeviceLayer layer = requireLayer(params);
        JsonObject r = describeLayer(layer, params.get("layerIndex").getAsInt());
        // ⚠ Rule 13: the handle was obtained at INIT. Calling `deleteObjectAction()`
        // here throws "This can only be called during driver initialization" — which
        // is exactly what the first attempt measured, three times, as a false ○.
        int idx = params.get("layerIndex").getAsInt();
        r.addProperty("handleStatus", rig.layerDeleteActionStatus);
        try {
            if (rig.layerDeleteAction[idx] == null) {
                r.addProperty("actionInvoke", "NO HANDLE: " + rig.layerDeleteActionStatus);
                return r;
            }
            rig.layerDeleteAction[idx].invoke();
            r.addProperty("actionInvoke", "returned");
        } catch (Throwable t) {
            r.addProperty("actionInvoke",
                "THREW:" + t.getClass().getSimpleName() + ":" + t.getMessage());
        }
        return r;
    }

    /**
     * ⚠ E17 rows 2/3 — `DuplicableObject.duplicateObjectAction().invoke()`.
     *
     * The mirror of the above, and worth having even though `Channel.duplicate()`
     * already gives us autonomous creation: if the `*Action()` form turns out to be
     * the one that works for DELETE, we should know whether it also works for
     * DUPLICATE. Two verbs behaving the same way through the same form is a
     * mechanism; one working alone is a curiosity.
     *
     * ⚠ It also discriminates a real possibility — that `*Action()` invokes the
     * same UI pathway a named action does, in which case it may carry the same
     * focus precondition (`e17ab`). If this needs a human click and
     * `Channel.duplicate()` does not, that is the tell.
     */
    private JsonElement layerDuplicateViaAction(JsonObject params) {
        DeviceLayer layer = requireLayer(params);
        JsonObject r = describeLayer(layer, params.get("layerIndex").getAsInt());
        int idx = params.get("layerIndex").getAsInt();
        r.addProperty("handleStatus", rig.layerDuplicateActionStatus);
        try {
            if (rig.layerDuplicateAction[idx] == null) {
                r.addProperty("actionInvoke", "NO HANDLE: " + rig.layerDuplicateActionStatus);
                return r;
            }
            rig.layerDuplicateAction[idx].invoke();
            r.addProperty("actionInvoke", "returned");
        } catch (Throwable t) {
            r.addProperty("actionInvoke",
                "THREW:" + t.getClass().getSimpleName() + ":" + t.getMessage());
        }
        return r;
    }

    private JsonElement layerSelectLegacy(JsonObject params) {
        DeviceLayer layer = requireLayer(params);
        JsonObject r = describeLayer(layer, params.get("layerIndex").getAsInt());
        // ⚠ Guarded so a deprecated throw is DATA rather than a dead bridge.
        try {
            layer.select();
            r.addProperty("legacySelect", "returned");
        } catch (Throwable t) {
            r.addProperty("legacySelect",
                "THREW:" + t.getClass().getSimpleName() + ":" + t.getMessage());
        }
        return r;
    }

    /**
     * ⚠⚠ E17 — the reader the whole question turns on, isolated from `layer.list`.
     *
     * **What this is for.** `cursorLayerName` tells us WHICH chain is current;
     * `addIsSelectedInEditorObserver` tells us whether **Bitwig considers a chain
     * selected**. Those are different claims, and only the second discriminates
     * the open question: a HUMAN's click makes a chain actionable (`e17l`:
     * Copy+Paste 4→5, Delete 4→3, fired by US), while our `selectInEditor()` sets
     * a highlight the human can SEE (`e17u`) that named actions then ignore
     * entirely (`e17v`/`e17x` — the panel's current DEVICE decides in all four
     * cells).
     *
     *   observer fires for the HUMAN and not for us ⇒ our call sets a lookalike
     *       state; the hunt narrows to what the click writes.
     *   observer fires for BOTH ⇒ the selection really is the same object and the
     *       actions read a THIRD thing — which moves the investigation off
     *       selection entirely and onto dispatch.
     *
     * ⚠ Separate from `layer.list` on purpose: `layer.list` walks every layer's
     * device bank, and a read that does more work than the question needs is a
     * read that can perturb what it measures (`e17l` had our own list call steal
     * the human's selection). This touches the observer arrays and nothing else.
     *
     * ⚠ Both status strings are reported. "Every chain reads false" means something
     * completely different depending on whether the observer ever attached — and
     * this session already lost the current observer to being marked beside its
     * @Deprecated sibling in one try block (`FAILED@0`), which is why they are now
     * split and reported independently.
     */
    private JsonElement layerSelectionState() {
        JsonObject result = new JsonObject();
        result.addProperty("editorObserver", rig.layerSelectionStatus);
        result.addProperty("legacyObserver", rig.layerSelectionLegacyStatus);
        JsonArray rows = new JsonArray();
        for (int l = 0; l < rig.layerSelectedInEditor.length; l++) {
            JsonObject row = new JsonObject();
            row.addProperty("index", l);
            row.addProperty("selectedInEditor", rig.layerSelectedInEditor[l]);
            row.addProperty("selected", rig.layerSelected[l]);
            rows.add(row);
        }
        result.add("layers", rows);
        // ⚠ Named beside the flags: an index means nothing without knowing which
        // container the bank is scoped to (the e16o trap).
        putGuarded(result, "cursorDeviceName", () -> rig.cursorDevice0.name().get());
        putGuarded(result, "cursorLayerExists", () -> rig.cursorLayer0.exists().get());
        putGuarded(result, "cursorLayerName", () -> rig.cursorLayer0.name().get());
        return result;
    }

    private JsonElement layerSelect(JsonObject params) {
        DeviceLayer layer = requireLayer(params);
        String where = params.has("where") ? params.get("where").getAsString() : "editor";
        // Validate BEFORE calling: an exception Bitwig defers to its own thread
        // escapes every extension frame and takes the DAW down (E14-A1, rule 3c).
        if (!"editor".equals(where) && !"mixer".equals(where)) {
            throw new IllegalArgumentException("where must be editor or mixer: " + where);
        }
        JsonObject r = describeLayer(layer, params.get("layerIndex").getAsInt());
        r.addProperty("where", where);
        if ("editor".equals(where)) {
            layer.selectInEditor();
        } else {
            layer.selectInMixer();
        }
        return r;
    }

    /**
     * ⚠⚠ E17 rows 3+4 REOPENED — point the LAYER CURSOR at a chain, which is the
     * one selection mechanism with a proven precedent and the one nobody tried.
     *
     * **What `e17l` established with a human in the loop, and why this method
     * exists.** The user reported that selecting a layer in Bitwig and pressing
     * copy/paste duplicates it. `e17k` drove that from our side —
     * `layer.select` (`DeviceChain.selectInEditor()` and `Channel.selectInMixer()`)
     * followed by `Duplicate`, and by `Copy`+`Paste` — and got 4 → 4 on every
     * route. `e17l` then split the variable with a human:
     *
     *   ARM A  human selects the layer AND copies/pastes   ● 4 → 5
     *   ARM B  human selects, WE fire Copy+Paste           ⚠ ● 4 → 5
     *   ARM C  human selects, WE fire Delete               ⚠⚠ ● 4 → 3, correct chain
     *
     * ⇒ **The named actions reach a selected layer perfectly well. What fails is
     * OUR selection.** So rows 3 and 4 are not closed, they are UNREACHABLE —
     * which is exactly what row 1 turned out to be before `device.selectInEditor`
     * existed. `E17-VERDICT.md`'s central claim rests on this one gap.
     *
     * ⚠ **The precedent, and it is a strong one.** E16j watched the `Group` action
     * wrap *exactly* the track that `cursor.pointTrack` had selected — and
     * `cursor.pointTrack` is `CursorTrack.selectChannel(track)`. So
     * `CursorChannel.selectChannel()` demonstrably SETS the UI selection where
     * `selectInEditor()` apparently does not. `CursorDeviceLayer` is also a
     * `CursorChannel` (11 supertypes, walked in the E17 complete-recall pass), and
     * `rig.cursorLayer0` has existed since E4c without ever being pointed at
     * anything. This is the exact analogue, one level down, of the call that
     * already works for tracks.
     *
     * ⚠ Note what row 3 measured about this cursor: `cursorLayer0.exists()` is
     * FALSE on every container, even ones WITH chains — it never acquires a
     * referent on its own. That is precisely what `selectChannel` is for, and it
     * also means `exists()` becoming true is a readback that the point landed.
     */
    private JsonElement layerPointCursor(JsonObject params) {
        DeviceLayer layer = requireLayer(params);
        JsonObject r = describeLayer(layer, params.get("layerIndex").getAsInt());
        // Read the cursor BEFORE, so the probe can diff rather than trust.
        putGuarded(r, "cursorLayerExistedBefore", () -> rig.cursorLayer0.exists().get());
        putGuarded(r, "cursorLayerNameBefore", () -> rig.cursorLayer0.name().get());
        rig.cursorLayer0.selectChannel(layer);
        return r;
    }

    /**
     * ⚠ E17 row 4 — DELETE a layer chain. `DeviceLayer` extends
     * `DeleteableObject`; **E4d probed duplicate and never probed delete.**
     *
     * ⚠⚠ **`e17l` REOPENED this row.** With a human-set layer selection, the
     * `Delete` NAMED ACTION removed the correct chain (4 → 3, verified by
     * channelId). So a chain IS removable; what these typed calls prove is only
     * that `DeleteableObject.deleteObject()` does not honour it. Read the ○ below
     * as "the typed verb refuses", never as "chains cannot be deleted".
     *
     * ⚠ **This row alone is the minimum viable unlock for the layer model**,
     * because revert-by-delete is what makes a branch exact regardless of its
     * contents (§4.2) — the strongest single argument for the whole track-native
     * model, one level down. With `moveDevices` ● (E16n) and `insertFile` ●
     * (E4d route 4), delete is the last piece of a create-by-rebuild loop:
     * materialise N chains from a preset, trim to the shape wanted, move the
     * human's own device in. If it works and rows 1–3 all fail, layers are still
     * usable — just more expensive to grow.
     *
     * ⚠ Watch for a REMOVABLE-BUT-NOT-ADDABLE asymmetry, because that is exactly
     * the shape E10c and E10d already found one level down IN THE FILE FORMAT
     * (chains are trimmable, not insertable; the last chain specifically is not).
     * Two independent layers of the product showing the same asymmetry would be a
     * finding in its own right rather than a coincidence.
     */
    private JsonElement layerDelete(JsonObject params) {
        DeviceLayer layer = requireLayer(params);
        JsonObject r = describeLayer(layer, params.get("layerIndex").getAsInt());
        layer.deleteObject();
        return r;
    }

    /**
     * ⚠ E17 row 4, route 2 — `ControllerHost.deleteObjects(DeleteableObject…)`.
     *
     * The independent mechanism, and the javadoc for `deleteObject()` points at
     * it by name (*"If you want to delete multiple objects at once, see
     * Host.deleteObjects()"*). It is a different code path on Bitwig's side —
     * `ui.deleteObjects` already exercises it, but only ever on clip launcher
     * slots, so it has never been aimed at a layer. Cheap to add while the jar is
     * open, and this is the row where "independent mechanism" has paid five times.
     */
    private JsonElement layerDeleteViaHost(JsonObject params) {
        DeviceLayer layer = requireLayer(params);
        JsonObject r = describeLayer(layer, params.get("layerIndex").getAsInt());
        host.deleteObjects(new com.bitwig.extension.controller.api.DeleteableObject[] { layer });
        return r;
    }

    /**
     * ⚠ E17 row 2, route 3 — `ControllerHost.duplicateObjects(DuplicableObject…)`.
     *
     * `e17b` re-ran E4d routes 1 and 2 with the precondition proved and both
     * still no-op, so the ○ is now about layers rather than about a mis-aimed
     * cursor. This is the third mechanism, and the one `duplicateObject()`'s own
     * javadoc names. If it fires where the direct call does not, the ○ was never
     * about the capability at all.
     */
    private JsonElement layerDuplicateViaHost(JsonObject params) {
        DeviceLayer layer = requireLayer(params);
        JsonObject r = describeLayer(layer, params.get("layerIndex").getAsInt());
        host.duplicateObjects(new com.bitwig.extension.controller.api.DuplicableObject[] { layer });
        return r;
    }

    /**
     * ⚠ E17 row 5 — RENAME a layer chain, and read it back.
     *
     * `DeviceChain.name()` is a `SettableStringValue`, so the write is typed as
     * possible. **The question is whether it STICKS.** E4c recorded that a layer
     * renames itself after its content ("Layer 1" → "Polysynth" once a Polysynth
     * lands in it), which means a set may be silently overwritten the next time
     * the chain changes.
     *
     * ⚠ **This decides whether §1b's naming scheme survives the move to layers.**
     * Under the track model the lineage tag lives in the track name, and E16q
     * proved the middle dot round-trips exactly. If layer names are volatile the
     * tag needs a different home — and `channelId` cannot be it, because a tag has
     * to be human-readable and human-editable BY DESIGN. So the probe must set the
     * name, then CHANGE THE CHAIN'S CONTENTS and re-read, which is the case that
     * actually bites; a set-then-read is the easy half and proves little.
     */
    private JsonElement layerSetName(JsonObject params) {
        DeviceLayer layer = requireLayer(params);
        String name = params.get("name").getAsString();
        JsonObject r = describeLayer(layer, params.get("layerIndex").getAsInt());
        r.addProperty("requested", name);
        layer.name().set(name);
        return r;
    }

    /**
     * ⚠ E17 row 6 — `SoloValue.toggle(boolean exclusive)` on a layer chain.
     *
     * `layer.setMixer` already writes `solo`, so this is not about whether the
     * flag sets. **The question is SCOPE, and `toggle(exclusive)` is the
     * exclusivity primitive itself.** Track solo is project-global, which would
     * make it useless here — soloing take B would silence the drums. The evidence
     * that Bitwig models solo PER CONTAINER is `DrumPadBank.hasSoloedPads()` /
     * `clearSoloedPads()`: solo state scoped to one device.
     *
     * ⚠ But the counter-evidence is now on the record too, and it is the kind
     * that should be stated before the measurement rather than after:
     * `DeviceLayerBank` declares exactly ONE member (`getChannel`) and has no
     * `hasSoloedLayers` / `clearSoloedLayers` equivalent. Bitwig gave drum pads a
     * container-scoped solo vocabulary and gave device layers none.
     *
     * If it IS container-scoped, it is the mutually-exclusive selection gesture
     * the user asked for in session 5's closing exchange — one call, no selector,
     * no routing, and a readable "which one is live" that N mute flags cannot give.
     *
     * ⚠ Measure the scope with the MASTER as oracle and at least one unrelated
     * track playing. A solo that silences the project reads identically to one
     * that does not, if the project is silent — rows D–G trap 6, and session 5
     * shipped exactly that mistake once (`fxOnChain0: 0` vs `fxOnChain1: 0`
     * passing as a green).
     */
    private JsonElement layerSoloToggle(JsonObject params) {
        DeviceLayer layer = requireLayer(params);
        boolean exclusive = !params.has("exclusive") || params.get("exclusive").getAsBoolean();
        JsonObject r = describeLayer(layer, params.get("layerIndex").getAsInt());
        r.addProperty("exclusive", exclusive);
        layer.solo().toggle(exclusive);
        return r;
    }

    /**
     * ⚠ E17 row 3 — insert through the CONTAINER-SCOPED cursor rather than a bank
     * index. The one reading of the primary source nobody has tested.
     *
     * The Bitwig user guide, quoted in E4e, describes chain creation as a SIDE
     * EFFECT of adding a device to the container: *"there is only one Add Device
     * button in the main interface of Instrument Layer, with each added device
     * being placed on a **newly created** instrument chain."* Everything tried so
     * far inserted into an EXISTING chain addressed by index (E4c, E16n) or called
     * a duplication verb. E4e's architectural argument is that an `InsertionPoint`
     * must bind to a referent and "layer 3" has none until it exists — which is an
     * argument about INDEXED addressing specifically.
     *
     * ⚠ `cursorDevice0.createCursorLayer()` is not indexed. It is a cursor scoped
     * to the container, and it is the closest thing the API has to "the
     * container's own insertion point" — a complete sweep of the javadoc finds
     * exactly 11 methods returning an `InsertionPoint` and not one of them hangs
     * off a container `Device`. So this is the last untried reading, and it costs
     * one call.
     *
     * ⚠ Expect nothing. E4e is a REASONED negative with five converging lines of
     * evidence, and the user agrees row 3 looks genuinely closed. This is here
     * because it is cheap and because E4c's ○ was overturned by E4d, which was
     * overturned in part by E16n — not because the prior is good.
     */
    private JsonElement layerInsertViaCursor(JsonObject params) {
        String uuid = params.get("uuid").getAsString();
        java.util.UUID id = java.util.UUID.fromString(uuid);
        JsonObject r = ok();
        // The cursor layer's own state, read BEFORE the insert: whether it even
        // has a referent is half the answer, and afterwards it may have moved.
        putGuarded(r, "cursorLayerExists", () -> rig.cursorLayer0.exists().get());
        putGuarded(r, "cursorLayerName", () -> rig.cursorLayer0.name().get());
        putGuarded(r, "containerName", () -> rig.cursorDevice0.name().get());
        putGuarded(r, "containerHasLayers", () -> rig.cursorDevice0.hasLayers().get());
        rig.cursorLayer0.endOfDeviceChainInsertionPoint().insertBitwigDevice(id);
        return r;
    }

    /**
     * ⚠ E17 row 3, the last unexercised `InsertionPoint` SOURCE on a layer.
     *
     * E4c and E16n both went through `endOfDeviceChainInsertionPoint()`.
     * `startOfDeviceChainInsertionPoint()` is its sibling, added at the same API
     * version (v7), and has never been called on a `DeviceLayer`. E4e claims
     * every `InsertionPoint` source has been exercised; a javadoc sweep says 11
     * exist and this is one of them, so the claim is exhaustive about SOURCES
     * enumerated and not about sources CALLED ON A LAYER.
     *
     * ⚠ It should land in the same chain, not spawn a sibling — that is the
     * expected result and it is the CONTROL for `layerInsertViaCursor` above: if
     * this one lands and that one does nothing, the difference is the cursor, not
     * the verb.
     */
    private JsonElement layerInsertAtStart(JsonObject params) {
        DeviceLayer layer = requireLayer(params);
        java.util.UUID id = java.util.UUID.fromString(params.get("uuid").getAsString());
        JsonObject r = describeLayer(layer, params.get("layerIndex").getAsInt());
        layer.startOfDeviceChainInsertionPoint().insertBitwigDevice(id);
        return r;
    }

    /**
     * Resolve a layer and REFUSE loudly if it is not there.
     *
     * ⚠ The e16o trap in one place. `rig.layerBank0` follows `cursorDevice0`, so
     * the container is a hidden argument to every call above — and aimed at a
     * device with no layers, each of them is a silent no-op indistinguishable
     * from an API refusal. That nearly published a false negative on the
     * `moveDevices` row, and it is the reason E4d's ○ on duplication had to be
     * re-run at all. A handler that throws here turns the whole class of mistake
     * into an error message instead of a wrong finding.
     */
    private DeviceLayer requireLayer(JsonObject params) {
        int layerIndex = params.get("layerIndex").getAsInt();
        if (layerIndex < 0 || layerIndex >= Rig.LAYER_BANK) {
            throw new IllegalArgumentException("layerIndex out of bank range: " + layerIndex);
        }
        DeviceLayer layer = rig.layerBank0.getItemAt(layerIndex);
        if (!layer.exists().get()) {
            throw new IllegalArgumentException(
                "no layer at index " + layerIndex + " — the cursor device is "
                + rig.cursorDevice0.name().get() + ", hasLayers="
                + rig.cursorDevice0.hasLayers().get()
                + ". Point the device cursor at the CONTAINER first (the e16o trap).");
        }
        return layer;
    }

    /**
     * Identify the layer a call is about to act on, read BEFORE the act.
     *
     * ⚠ Named, not counted — `e16t` reported "matches 1 bank row" and naming the
     * row turned that into the finding that a pinned cursor slides onto its
     * target's heir. After a delete or a duplicate the bank re-indexes, so a read
     * taken afterwards may describe whatever slid into the slot (E3).
     */
    private JsonObject describeLayer(DeviceLayer layer, int layerIndex) {
        JsonObject r = ok();
        r.addProperty("layerIndex", layerIndex);
        putGuarded(r, "layerName", () -> layer.name().get());
        putGuarded(r, "channelId", () -> layer.channelId().get());
        putGuarded(r, "containerName", () -> rig.cursorDevice0.name().get());
        return r;
    }

    /**
     * Insert a Bitwig device INSIDE a layer's device chain. DeviceLayer is a
     * DeviceChain, so it carries its own insertion point — this is how the
     * chain one level down gets populated.
     */
    private JsonElement layerInsertDevice(JsonObject params) {
        int layerIndex = params.get("layerIndex").getAsInt();
        String uuid = params.get("uuid").getAsString();
        rig.layerBank0.getItemAt(layerIndex).endOfDeviceChainInsertionPoint()
            .insertBitwigDevice(java.util.UUID.fromString(uuid));
        return ok();
    }

    // ------------------------- E4c-2: routes to CREATING nesting structure

    /** DeviceLayer implements DuplicableObject — does duplicating make a layer? */
    private JsonElement layerDuplicate(JsonObject params) {
        rig.layerBank0.getItemAt(params.get("layerIndex").getAsInt()).duplicateObject();
        return ok();
    }

    /** DeviceLayer also implements Channel, which has its own duplicate(). */
    private JsonElement layerDuplicateChannel(JsonObject params) {
        rig.layerBank0.getItemAt(params.get("layerIndex").getAsInt()).duplicate();
        return ok();
    }

    /** Copy an existing top-level device into a layer's chain. */
    private JsonElement layerCopyDeviceInto(JsonObject params) {
        int layerIndex = params.get("layerIndex").getAsInt();
        int deviceIndex = params.get("deviceIndex").getAsInt();
        rig.layerBank0.getItemAt(layerIndex).endOfDeviceChainInsertionPoint()
            .copyDevices(rig.cursorDeviceBanks[0].getDevice(deviceIndex));
        return ok();
    }

    /**
     * ⚠ E16 §3.1 — MOVE an existing top-level device into a layer's chain.
     *
     * The exact sibling of `layerCopyDeviceInto` above, deliberately written as
     * its mirror image so the two differ in one verb and nothing else. E4d route
     * 3 recorded `copyDevices` into a layer as a silent no-op and concluded that
     * devices cannot be relocated into layer chains — **from that single
     * mechanism**, which is the shape that has produced four false negatives in
     * this spike (CLAP params, channelId, chain creation, group creation). E4d
     * itself exists only because E4c's ○ was overturned the same way.
     *
     * ⚠ The javadoc gives no reason to expect a different answer: `moveDevices`
     * and `copyDevices` carry identical wording ("If it's not possible to do so
     * then this does nothing"), and the class doc documents the silent no-op as
     * INTENDED. So the case for probing is empirical, not documentary, and it
     * rests on one measured fact: **this same insertion point demonstrably
     * accepts inserts** — E4c landed a new Bitwig device in an existing layer
     * chain through `endOfDeviceChainInsertionPoint()` in ~143ms. The
     * destination is alive; only `copyDevices` was mute on it. Row A saw exactly
     * this pattern one level up, where `copyTracks` was a no-op while three
     * duplication verbs on the same object all worked.
     *
     * Why it matters beyond tidiness: FX returns cannot be forked (other tracks'
     * sends still feed the original), so if devices can be relocated into layer
     * chains then a chain selector becomes a device-scoped A/B that costs no
     * bank slot, no duplication glitch, and reaches the master and the returns —
     * which the track-native model cannot.
     *
     * ⚠ Verified by `layer.list` / `device.list` DIFF, never by this return: the
     * acknowledgement is identical whether or not anything moved (E6 blocker 4).
     */
    private JsonElement layerMoveDeviceInto(JsonObject params) {
        int layerIndex = params.get("layerIndex").getAsInt();
        int deviceIndex = params.get("deviceIndex").getAsInt();
        if (layerIndex < 0 || layerIndex >= Rig.LAYER_BANK) {
            throw new IllegalArgumentException("layerIndex out of bank range: " + layerIndex);
        }
        if (deviceIndex < 0) {
            throw new IllegalArgumentException("deviceIndex must be >= 0: " + deviceIndex);
        }
        Device source = rig.cursorDeviceBanks[0].getDevice(deviceIndex);
        JsonObject r = ok();
        // Read the source BEFORE moving it: afterwards the bank re-indexes and
        // this handle may be pointing at whatever slid into its place (E3).
        putGuarded(r, "sourceName", () -> source.name().get());
        putGuarded(r, "sourceExists", () -> source.exists().get());
        rig.layerBank0.getItemAt(layerIndex).endOfDeviceChainInsertionPoint().moveDevices(source);
        return r;
    }

    /**
     * ⚠ E16 §3.1 route 2 — `InsertionPoint.paste()` into a layer's chain.
     *
     * The complete-recall sweep of all 1968 API members found exactly three
     * device-relocation verbs on `InsertionPoint`: `copyDevices` (○, E4d),
     * `moveDevices` (above) and this. It is a genuinely INDEPENDENT mechanism —
     * it takes its content from the clipboard rather than from a `Device`
     * handle — so it can succeed where both of the others fail, and it is worth
     * having on the wire before spending a second Bitwig restart to add it.
     *
     * ⚠ **This handler cannot fill the clipboard, and that is deliberate.**
     * Doing so would mean `Application.cut()`/`copy()`, which act on the UI
     * SELECTION our own addressing sets — E6 blocker 3, the mechanism that made
     * seven orphan duplicates, and observed live again in `e16j`. So the probe
     * asks the human to copy a device by hand and then calls this, which keeps
     * the hazardous half outside the extension entirely. If the route turns out
     * to work, whether to automate the clipboard at all is a separate decision
     * with its own risk, and it stays the user's (rule 10).
     */
    private JsonElement layerPasteInto(JsonObject params) {
        int layerIndex = params.get("layerIndex").getAsInt();
        if (layerIndex < 0 || layerIndex >= Rig.LAYER_BANK) {
            throw new IllegalArgumentException("layerIndex out of bank range: " + layerIndex);
        }
        rig.layerBank0.getItemAt(layerIndex).endOfDeviceChainInsertionPoint().paste();
        return ok();
    }

    /** Insert a file (preset/multisample/etc.) into a layer's chain. */
    private JsonElement layerInsertFile(JsonObject params) {
        rig.layerBank0.getItemAt(params.get("layerIndex").getAsInt())
            .endOfDeviceChainInsertionPoint().insertFile(params.get("path").getAsString());
        return ok();
    }

    /**
     * The last untested InsertionPoint sources: before/after an EXISTING
     * nested device. Does inserting relative to a device inside a layer add
     * to that layer's chain, or spawn a sibling layer?
     */
    private JsonElement layerInsertRelative(JsonObject params) {
        int layerIndex = params.get("layerIndex").getAsInt();
        int deviceIndex = params.get("deviceIndex").getAsInt();
        String uuid = params.get("uuid").getAsString();
        boolean after = !params.has("where") || "after".equals(params.get("where").getAsString());
        Device anchor = rig.layerDeviceBanks[layerIndex].getDevice(deviceIndex);
        java.util.UUID id = java.util.UUID.fromString(uuid);
        if (after) {
            anchor.afterDeviceInsertionPoint().insertBitwigDevice(id);
        } else {
            anchor.beforeDeviceInsertionPoint().insertBitwigDevice(id);
        }
        return ok();
    }

    // ======================================================================
    // ⚠⚠ E18 §3.1 — moving a device OUT of a chain, and ACROSS containers.
    //
    // **The whole rebuild strategy gates on one untested direction.** A chain
    // cannot be deleted by any typed route — exhausted across both
    // `DeleteableObject` forms with a `Track` sibling control deleting in the same
    // run, and with a mechanism that predicts it (a `DeviceLayer` honours the verb
    // `Channel` declares itself and declines every verb it merely inherits). So the
    // operator proposed working without a delete:
    //
    //     reduce    clone the container with fewer chains, migrate devices across,
    //               delete the OLD container (`Device.deleteObject()` is ● already)
    //     collapse  migrate the chosen chain's devices out to top level, then
    //               delete the container
    //
    // ⚠ E16n measured `moveDevices` in ONE direction only — top level INTO a chain.
    // Every direction the strategy actually needs is unmeasured:
    //
    //     chain → top level                 NEVER TESTED   (collapse depends on it)
    //     chain → chain, same container      NEVER TESTED
    //     chain → chain, DIFFERENT containers NEVER TESTED (reduce depends on it)
    //
    // ⚠ **And `Ungroup` is not a way around this.** That was suggested as the
    // device-level analogue of E16's K3 pattern and it is circular: K3 is
    // *delete-all-but-one then Ungroup*, which works at TRACK level because track
    // delete works. At device level delete is the blocked thing, so it cannot be
    // step one.
    //
    // ⚠ **Why the cross-container direction needs its own scopes.** `layerBank0`
    // follows `cursorDevice0`, so source and destination cannot be in two different
    // containers at once — scoping to the destination re-scopes the handle pointing
    // at the source. `Rig.slotLayerBanks` exists for exactly this and nothing else.
    //
    // ⚠ **Both verbs, deliberately.** This spike's most repeated lesson is that
    // sibling verbs on the same interface disagree: `copyDevices` ○ beside
    // `moveDevices` ● (E4d/E16n), `duplicateObject()` ○ beside `Channel.duplicate()`
    // ● (e17ak/e17am), `copyTracks` ○ beside three working duplication verbs. A
    // single-mechanism ○ here would be the sixth false negative of that shape.
    // ⚠ And COPY is not merely completeness for this row — it is the better product
    // primitive: a copy-then-delete-container rebuild never has the device missing
    // from the signal path, where a move does. The operator's bar is explicitly
    // *"low on (or free of) intermediate states that are undesirable or glitchy"*.
    // ======================================================================

    /**
     * ⚠ E18 §3.1 — read the FULL container structure of the pointed track through
     * the cursor-free slot scopes.
     *
     * **Guard #2 in one call.** Three separate E17 probes read "nothing happened"
     * while a container was being duplicated one level above where they looked, and
     * `e17ac` shipped the same blind spot a third time after it had been diagnosed
     * and written up as a method trap. Every level a relocation can land on —
     * the slot, its chains, and the devices inside those chains — is reported here
     * together, so a probe cannot accidentally read one of them.
     *
     * ⚠ Reports `slotScopeStatus` per scope. "Zero chains everywhere" means
     * something completely different depending on whether the bank was ever built
     * (standing rule 13), and a probe must abort rather than score if it was not.
     */
    private JsonElement chainInventory() {
        JsonArray scopes = new JsonArray();
        for (int s = 0; s < Rig.SLOT_SCOPES; s++) {
            scopes.add(describeScope(s));
        }
        JsonObject result = new JsonObject();
        result.add("scopes", scopes);
        // B08: the reference bank's device count and width, so a reader can tell
        // "no device at the requested position" (a real observation) from a
        // scope that has not settled yet.
        result.addProperty("scopeCount", Rig.SLOT_SCOPES);
        putGuarded(result, "deviceCount", () -> rig.cursorDeviceBanks[0].itemCount().get());
        result.addProperty("deviceBankSize", rig.config.deviceBank);
        result.add("cursorScope", describeCursorScope());
        // Named beside the scopes: an index means nothing without knowing which
        // TRACK the device bank is on (the e16o trap, one level up).
        putGuarded(result, "trackName", () -> rig.cursorTracks[0].name().get());
        // ⚠⚠ And the DURABLE half of that guard, added in session 3f step 6b when
        // this became product surface. A name is not an identity (standing rule 2)
        // and two tracks may share one, so a reader that has just pointed cursor 0
        // at a channelId compares against THIS and refuses the whole observation
        // on a mismatch. It is the only field here that can prove the reply
        // describes the track that was asked about.
        putGuarded(result, "trackChannelId", () -> rig.cursorTracks[0].channelId().get());
        return result;
    }

    /**
     * One scope as `chain.inventory` and `chain.observe` report it: the scope's one-wide bank (`position` is
     * what the bank reports after clamping, `requestedPosition` what it was last asked for, `settled` the
     * identity guard), the slot device, and its chains with their devices.
     */
    private JsonObject describeScope(int s) {
        JsonObject scope = new JsonObject();
        scope.addProperty("slot", s);
        scope.addProperty("status", rig.slotScopeStatus[s]);
        if (rig.scopeBanks[s] == null) {
            return scope;
        }
        final int scopeIndex = s;
        final DeviceBank scopeBank = rig.scopeBanks[s];
        Device slot = rig.scopeDevice(s);
        scope.addProperty("requestedPosition", rig.scopeRequestedPosition[s]);
        putGuarded(scope, "position", () -> scopeBank.scrollPosition().get());
        putGuarded(scope, "settled", () -> rig.scopeSettled(scopeIndex));
        putGuarded(scope, "canScrollForwards", () -> scopeBank.canScrollForwards().get());
        putGuarded(scope, "canScrollBackwards", () -> scopeBank.canScrollBackwards().get());
        putGuarded(scope, "deviceExists", () -> slot.exists().get());
        putGuarded(scope, "deviceName", () -> slot.name().get());
        putGuarded(scope, "devicePosition", () -> slot.position().get());
        putGuarded(scope, "hasLayers", () -> slot.hasLayers().get());
        putGuarded(scope, "hasSlots", () -> slot.hasSlots().get());
        JsonArray slotNames = new JsonArray();
        try {
            for (String name : slot.slotNames().get()) slotNames.add(name);
        } catch (Throwable t) {
            scope.addProperty("slotNamesError",
                t.getClass().getSimpleName() + ":" + t.getMessage());
        }
        scope.add("slotNames", slotNames);
        JsonArray chains = new JsonArray();
        int existing = 0;
        if (rig.slotLayerBanks[s] != null) {
            for (int l = 0; l < Rig.SLOT_LAYER_BANK; l++) {
                DeviceLayer layer = rig.slotLayerBanks[s].getItemAt(l);
                if (!layer.exists().get()) {
                    continue;
                }
                existing++;
                JsonObject chain = new JsonObject();
                // B17: the index is absolute within the container. Session 1 keeps the chain window at rest,
                // so it equals the window index; session 2 pages the window and keeps the index absolute.
                chain.addProperty("index", rig.slotLayerBanks[s].scrollPosition().get() + l);
                putGuarded(chain, "name", () -> layer.name().get());
                putGuarded(chain, "channelId", () -> layer.channelId().get());
                putGuarded(chain, "reportedChannelIndex", () -> layer.channelIndex().get());
                // Product switching needs the exact flag for EVERY sibling.
                // Guarded silence is preserved as a missing field, which the
                // brain refuses rather than guessing as false.
                putGuarded(chain, "solo", () -> layer.solo().get());
                putGuarded(chain, "mute", () -> layer.mute().get());
                putGuarded(chain, "volume", () -> layer.volume().value().get());
                putGuarded(chain, "pan", () -> layer.pan().value().get());
                putGuarded(chain, "color", () -> String.format("%.3f,%.3f,%.3f",
                    layer.color().red(), layer.color().green(), layer.color().blue()));
                JsonArray devices = new JsonArray();
                for (int d = 0; d < Rig.SLOT_LAYER_DEVICE_BANK; d++) {
                    Device nested = rig.slotLayerDeviceBanks[s][l].getDevice(d);
                    if (!nested.exists().get()) {
                        continue;
                    }
                    JsonObject dev = new JsonObject();
                    dev.addProperty("index", rig.slotLayerDeviceBanks[s][l].scrollPosition().get() + d);
                    putGuarded(dev, "name", () -> nested.name().get());
                    putGuarded(dev, "enabled", () -> nested.isEnabled().get());
                    devices.add(dev);
                }
                chain.add("devices", devices);
                chain.addProperty("deviceWindowPosition", rig.slotLayerDeviceBanks[s][l].scrollPosition().get());
                chain.addProperty("deviceCount",
                    rig.slotLayerDeviceBanks[s][l].itemCount().get());
                chains.add(chain);
            }
        }
        scope.add("chains", chains);
        scope.addProperty("visibleChainCount", existing);
        if (rig.slotLayerBanks[s] != null) {
            scope.addProperty("chainCount", rig.slotLayerBanks[s].itemCount().get());
            scope.addProperty("chainWindowPosition", rig.slotLayerBanks[s].scrollPosition().get());
        }
        // Session 5r: itemCount distinguishes a full bank from overflow.
        // The bank sizes remain explicit so a projected create can refuse
        // before it writes past the complete window. Older extensions omit
        // itemCount, and the adapter treats that omission as incomplete.
        scope.addProperty("chainBankSize", Rig.SLOT_LAYER_BANK);
        scope.addProperty("deviceBankSize", Rig.SLOT_LAYER_DEVICE_BANK);
        scope.addProperty("namedSlotStatus", "held");
        try {
            scope.addProperty("namedSlotComplete",
                !slot.hasSlots().get() && slot.slotNames().get().length == 0);
        } catch (Throwable t) {
            scope.addProperty("namedSlotComplete", false);
            scope.addProperty("namedSlotError",
                t.getClass().getSimpleName() + ":" + t.getMessage());
        }
        return scope;
    }

    /**
     * The cursor-bound named-slot view. A Chain device's slot devices are visible only after the device cursor
     * enters its nonempty CHAIN slot; the sibling bank is reported with the recorded parent route, so the brain
     * can bind it to one top-level container.
     */
    private JsonObject describeCursorScope() {
        JsonObject cursorScope = new JsonObject();
        cursorScope.addProperty("status", "held");
        putGuarded(cursorScope, "deviceExists", () -> rig.cursorDevice0.exists().get());
        putGuarded(cursorScope, "deviceName", () -> rig.cursorDevice0.name().get());
        cursorScope.addProperty("deviceIndex", rig.currentDirectParameterDeviceIndex());
        putGuarded(cursorScope, "isNested", () -> rig.cursorDevice0.isNested().get());
        cursorScope.addProperty("namedSlotComplete", false);
        try {
            int topIndex = rig.directParameterTopLevelIndex;
            boolean namedRoute = rig.directParameterRouteKinds.size() == 1
                && "deviceSlot".equals(rig.directParameterRouteKinds.get(0));
            if (rig.cursorDevice0.isNested().get() && namedRoute
                    && topIndex >= 0 && topIndex < rig.config.deviceBank) {
                Device parent = rig.cursorDeviceBanks[0].getDevice(topIndex);
                String slotName = rig.directParameterRouteNames.get(0);
                cursorScope.addProperty("parentDeviceIndex", topIndex);
                putGuarded(cursorScope, "parentDeviceName", () -> parent.name().get());
                putGuarded(cursorScope, "slotName", () -> rig.cursorDeviceChain0.name().get());
                JsonObject entry = new JsonObject();
                entry.addProperty("name", slotName);
                JsonArray devices = new JsonArray();
                for (int d = 0; d < Rig.SLOT_LAYER_DEVICE_BANK; d++) {
                    Device nested = rig.cursorDeviceSiblings0.getDevice(d);
                    if (!nested.exists().get()) continue;
                    JsonObject dev = new JsonObject();
                    dev.addProperty("index", d);
                    putGuarded(dev, "name", () -> nested.name().get());
                    putGuarded(dev, "enabled", () -> nested.isEnabled().get());
                    devices.add(dev);
                }
                entry.add("devices", devices);
                int count = rig.cursorDeviceSiblings0.itemCount().get();
                entry.addProperty("deviceCount", count);
                entry.addProperty("deviceBankSize", Rig.SLOT_LAYER_DEVICE_BANK);
                cursorScope.add("namedSlot", entry);
                cursorScope.addProperty("namedSlotComplete",
                    parent.exists().get()
                        && slotName.equals(rig.cursorDeviceChain0.name().get())
                        && count <= Rig.SLOT_LAYER_DEVICE_BANK && devices.size() == count);
            }
        } catch (Throwable t) {
            cursorScope.addProperty("namedSlotError",
                t.getClass().getSimpleName() + ":" + t.getMessage());
        }
        return cursorScope;
    }

    // ======================================================================
    // B17 — extension-owned scopes.
    //
    // `chain.observe` and every chain write name a container by its ABSOLUTE
    // top-level position (and a chain by its absolute index inside the
    // container). The extension aims a scope at each named position through
    // `ContainerScopes`, polls until it settles (or refuses after the bound),
    // performs the read or write through the settled scope, and replies once.
    // The brain holds no scope slot and sends no scroll. A reply carries `aim`
    // (polls, scrolls, elapsed) so a live driver can see what the settle cost.
    // ======================================================================

    private interface ScopeWork {
        JsonElement run(ContainerScopes.Settled settled) throws Exception;
    }

    /**
     * Settle a scope at each position, run the work through them, reply once, and release the write lease.
     * A refused aim (track not confirmed, scope not settled within the bound, no free scope) replies an error
     * and changes nothing. `expectedTrackChannelId`, when sent, is polled by the aim and so proves the scopes
     * describe the track the caller asked about.
     */
    private void withScopes(int[] positions, JsonObject params, Bridge.Reply reply, ScopeWork work) {
        String expectedTrack = params.has("expectedTrackChannelId")
                && !params.get("expectedTrackChannelId").isJsonNull()
            ? params.get("expectedTrackChannelId").getAsString() : null;
        rig.containerScopes.aim(positions, expectedTrack, new ContainerScopes.Outcome() {
            @Override public void settled(ContainerScopes.Settled settled) {
                // Release BEFORE the reply: a batch continues with its next op from inside the reply, and
                // that op may open the next scope operation in the same task.
                JsonElement result;
                try {
                    result = work.run(settled);
                } catch (Exception error) {
                    settled.release();
                    reply.error(error, 0);
                    return;
                }
                settled.release();
                reply.result(result, 0);
            }

            @Override public void refused(String reason, String detail, JsonObject report) {
                reply.error(new IllegalStateException("container scope " + reason + " after "
                    + report.get("polls").getAsInt() + " polls: " + detail), 0);
            }
        });
    }

    /** Relocation endpoints retain their first-window bound until the B17 move/copy integration. */
    private int requirePosition(JsonObject params, String field) {
        if (!params.has(field) || !params.get(field).isJsonPrimitive()
                || !params.get(field).getAsJsonPrimitive().isNumber()) {
            throw new IllegalArgumentException(field + " must be an integer position");
        }
        double raw = params.get(field).getAsDouble();
        if (!Double.isFinite(raw) || raw != Math.rint(raw) || raw < 0 || raw >= rig.config.deviceBank) {
            throw new IllegalArgumentException(
                field + " must be an integer in 0.." + (rig.config.deviceBank - 1) + ": " + raw);
        }
        return (int) raw;
    }

    /**
     * Relocations still require the first chain window. Paged controls validate absolute indices in
     * ChainControlHandlers; lifting this bound also requires acquiring both relocation endpoints.
     */
    private int requireChainIndex(JsonObject params, String field) {
        if (!params.has(field) || !params.get(field).isJsonPrimitive()
                || !params.get(field).getAsJsonPrimitive().isNumber()) {
            throw new IllegalArgumentException(field + " must be an integer chain index");
        }
        double raw = params.get(field).getAsDouble();
        if (!Double.isFinite(raw) || raw != Math.rint(raw) || raw < 0 || raw >= Rig.SLOT_LAYER_BANK) {
            throw new IllegalArgumentException(field + " must be an integer in 0.." + (Rig.SLOT_LAYER_BANK - 1)
                + ": " + raw + " (writes past the window arrive in B17 session 3)");
        }
        return (int) raw;
    }

    /**
     * B17: observe one container by position. The reply carries the settled scope (`scope`, in the shape of
     * one `chain.inventory` scope), or no `scope` when the position holds no device (`deviceCount` says so), the
     * cursor-bound named-slot view, the track identity, and the aim's cost.
     */
    private void chainObserve(JsonObject params, Bridge.Reply reply) {
        // Read reach is independent of the write limits retained until B17 session 3.
        if (!params.has("position") || !params.get("position").isJsonPrimitive()
                || !params.get("position").getAsJsonPrimitive().isNumber())
            throw new IllegalArgumentException("position must be a nonnegative integer");
        double raw = params.get("position").getAsDouble();
        if (!Double.isFinite(raw) || raw != Math.rint(raw) || raw < 0 || raw > Integer.MAX_VALUE)
            throw new IllegalArgumentException("position must be a nonnegative integer");
        int position = (int) raw;
        String expectedTrack = params.has("expectedTrackChannelId")
            ? params.get("expectedTrackChannelId").getAsString() : null;
        rig.containerScopes.aim(new int[] {position}, expectedTrack, new ContainerScopes.Outcome() {
            @Override public void settled(ContainerScopes.Settled settled) {
                int slot = settled.slotOf(position);
                JsonObject result = ok();
                result.addProperty("position", position);
                result.addProperty("slot", slot);
                result.addProperty("deviceCount", settled.deviceCount());
                result.addProperty("deviceBankSize", rig.config.deviceBank);
                result.addProperty("scopeCount", Rig.SLOT_SCOPES);
                result.addProperty("chainBankSize", Rig.SLOT_LAYER_BANK);
                result.addProperty("chainDeviceBankSize", Rig.SLOT_LAYER_DEVICE_BANK);
                Consumer<Exception> finish = error -> {
                    if (error instanceof WindowPager.RestoreFailure) rig.writeGate.blockWrites(error.getMessage());
                    settled.release();
                    if (error != null) { reply.error(error, 0); return; }
                    result.add("cursorScope", describeCursorScope());
                    putGuarded(result, "trackName", () -> rig.cursorTracks[0].name().get());
                    putGuarded(result, "trackChannelId", () -> rig.cursorTracks[0].channelId().get());
                    result.add("aim", settled.report());
                    reply.result(result, 0);
                };
                if (slot < 0) { finish.accept(null); return; }
                pageScope(slot, (scope, error) -> {
                    if (scope != null) result.add("scope", scope);
                    finish.accept(error);
                });
            }
            @Override public void refused(String reason, String detail, JsonObject report) {
                reply.error(new IllegalStateException("container scope " + reason + ": " + detail), 0);
            }
        });
    }

    /** A settled non-layer device has no layer window, even when the host retains old bank values. */
    static boolean completeNonLayerScope(JsonObject scope) {
        JsonElement hasLayers = scope.get("hasLayers");
        if (hasLayers == null || !hasLayers.isJsonPrimitive()
                || !hasLayers.getAsJsonPrimitive().isBoolean() || hasLayers.getAsBoolean()) return false;
        scope.add("chains", new JsonArray());
        scope.addProperty("chainCount", 0);
        scope.addProperty("visibleChainCount", 0);
        scope.addProperty("paged", true);
        scope.addProperty("chainPages", 0);
        scope.addProperty("devicePages", 0);
        return true;
    }

    private void pageScope(int slot, java.util.function.BiConsumer<JsonObject, Exception> done) {
        JsonObject initial = describeScope(slot);
        if (completeNonLayerScope(initial)) {
            done.accept(initial, null);
            return;
        }
        JsonArray chains = new JsonArray();
        int[] devicePages = {0};
        WindowPager pager = new WindowPager(host::scheduleTask);
        LayerPageWitness witness = new LayerPageWitness();
        pager.read(new WindowPager.Window() {
            @Override public int width() { return Rig.SLOT_LAYER_BANK; }
            @Override public int count() { return rig.slotLayerBanks[slot].itemCount().get(); }
            @Override public int position() { return rig.slotLayerBanks[slot].scrollPosition().get(); }
            @Override public void scroll(int position) { rig.slotLayerBanks[slot].scrollPosition().set(position); }
            @Override public String describe() {
                return "layer window scope=" + slot + ", count=" + count() + ", position=" + position()
                    + ", chains=" + describeScope(slot).getAsJsonArray("chains");
            }
            @Override public JsonArray snapshot() {
                int size = Math.min(width(), Math.max(0, count() - position()));
                for (int i = 0; i < size; i++) {
                    DeviceLayer layer = rig.slotLayerBanks[slot].getItemAt(i);
                    if (!layer.exists().get()) return null;
                }
                JsonArray page = describeScope(slot).getAsJsonArray("chains");
                return witness.matches(page) ? page : null;
            }
        }, (offset, page, next) -> {
            witness.accept(page);
            pageChainDevices(pager, slot, offset, page, 0, chains, devicePages, next);
        },
        (report, error) -> {
            if (error != null) { done.accept(null, error); return; }
            JsonObject scope = describeScope(slot);
            scope.add("chains", chains);
            scope.addProperty("chainCount", report.count());
            scope.addProperty("visibleChainCount", chains.size());
            scope.addProperty("paged", true);
            scope.addProperty("chainPages", report.pages());
            scope.addProperty("devicePages", devicePages[0]);
            done.accept(scope, null);
        });
    }

    private void pageChainDevices(WindowPager pager, int slot, int offset, JsonArray page, int index,
            JsonArray chains, int[] devicePages, Consumer<Exception> done) {
        if (index >= page.size()) { done.accept(null); return; }
        JsonObject chain = page.get(index).getAsJsonObject();
        int local = chain.get("index").getAsInt() - offset;
        JsonArray devices = new JsonArray();
        pager.read(new DeviceWindow(rig.slotLayerDeviceBanks[slot][local], Rig.SLOT_LAYER_DEVICE_BANK),
            (deviceOffset, rows, next) -> { devices.addAll(rows); next.accept(null); },
            (report, error) -> {
                if (error != null) { done.accept(error); return; }
                chain.add("devices", devices);
                chain.addProperty("deviceCount", report.count());
                chain.addProperty("devicePages", report.pages());
                devicePages[0] += report.pages();
                chains.add(chain);
                pageChainDevices(pager, slot, offset, page, index + 1, chains, devicePages, done);
            });
    }

    /**
     * ⚠⚠ E18 §3.1 — relocate a device that is INSIDE a chain, or into one.
     *
     * A chain endpoint names its container's absolute top-level position (`srcPosition`/`dstPosition`) and
     * the chain's absolute index (`srcChain`/`dstChain`); the aim settles one scope for each distinct
     * position, so a move between two containers holds both at once. A named-slot endpoint names its
     * container position too and goes through the cursor-bound slot handle. A top-level endpoint is the
     * track's own chain.
     *
     * ⚠ Every input is validated BEFORE the call (standing rule 3c): an exception Bitwig defers to its own
     * thread escapes every extension frame and takes the DAW down (E14-A1).
     *
     * ⚠ The source is required to EXIST before the verb fires. Aimed at an empty bank slot, `moveDevices` is a
     * silent no-op byte-identical to an API refusal (the e16o trap).
     *
     * ⚠ Verified by a container or `device.list` DIFF, never by this return: the acknowledgement is identical
     * whether or not anything moved (E6 blocker 4).
     */
    private void chainMove(JsonObject params, Bridge.Reply reply) {
        String src = params.has("src") ? params.get("src").getAsString() : "chain";
        String dst = params.has("dst") ? params.get("dst").getAsString() : "top";
        String verb = params.has("verb") ? params.get("verb").getAsString() : "move";
        String where = params.has("where") ? params.get("where").getAsString() : "chainEnd";
        String ref = params.has("cursor") ? params.get("cursor").getAsString() : "0";
        if (!"top".equals(src) && !"chain".equals(src) && !"slot".equals(src)) {
            throw new IllegalArgumentException("src must be top, chain, or slot: " + src);
        }
        if (!"top".equals(dst) && !"chain".equals(dst) && !"slot".equals(dst)) {
            throw new IllegalArgumentException("dst must be top, chain, or slot: " + dst);
        }
        if (!"move".equals(verb) && !"copy".equals(verb)) {
            throw new IllegalArgumentException("verb must be move or copy: " + verb);
        }
        if (!"chainStart".equals(where) && !"chainEnd".equals(where)) {
            throw new IllegalArgumentException("where must be chainStart or chainEnd: " + where);
        }
        if (!params.has("srcDevice") || !params.get("srcDevice").isJsonPrimitive()
                || !params.get("srcDevice").getAsJsonPrimitive().isNumber()) {
            throw new IllegalArgumentException("chain.move needs an integer srcDevice");
        }
        int srcDevice = params.get("srcDevice").getAsInt();
        int srcPosition = "top".equals(src) ? -1 : requirePosition(params, "srcPosition");
        int srcChain = "chain".equals(src) ? requireChainIndex(params, "srcChain") : -1;
        int dstPosition = "top".equals(dst) ? -1 : requirePosition(params, "dstPosition");
        int dstChain = "chain".equals(dst) ? requireChainIndex(params, "dstChain") : -1;
        int sourceBankSize = !"top".equals(src) ? Rig.SLOT_LAYER_DEVICE_BANK : rig.config.deviceBank;
        if (srcDevice < 0 || srcDevice >= sourceBankSize) {
            throw new IllegalArgumentException("srcDevice out of bank range: " + srcDevice);
        }
        if ("slot".equals(src) && "slot".equals(dst)) {
            throw new IllegalArgumentException(
                "a named-slot to named-slot move has only one cursor-bound slot handle");
        }
        if ("chain".equals(src) && "chain".equals(dst) && srcPosition == dstPosition && srcChain == dstChain) {
            throw new IllegalArgumentException(
                "the destination chain is the source chain, so the move is a no-op by "
                + "construction and would be indistinguishable from a failure");
        }
        if (!"top".equals(src) && "slot".equals(dst) && dstPosition == srcPosition) {
            throw new IllegalArgumentException(
                "the destination named slot is the source chain, so the move is a no-op");
        }
        if ("top".equals(src) && "chain".equals(dst) && srcDevice == dstPosition) {
            throw new IllegalArgumentException("a container cannot be relocated into one of its own chains");
        }
        if ("top".equals(src) && "slot".equals(dst) && srcDevice == dstPosition) {
            throw new IllegalArgumentException(
                "a container cannot be relocated into one of its own named slots");
        }
        // The chain endpoints are what the scopes serve; a named-slot endpoint is cursor-bound.
        int[] positions = "chain".equals(src) && "chain".equals(dst) ? new int[] {srcPosition, dstPosition}
            : "chain".equals(src) ? new int[] {srcPosition}
            : "chain".equals(dst) ? new int[] {dstPosition}
            : new int[0];
        withScopes(positions, params, reply, settled -> {
            if (params.has("expectedTrackChannelId")) {
                String expectedTrack = params.get("expectedTrackChannelId").getAsString();
                String actualTrack = rig.cursorTracks[0].channelId().get();
                if (!expectedTrack.equals(actualTrack)) {
                    throw new IllegalArgumentException(
                        "chain.move track identity changed: expected " + expectedTrack + ", got " + actualTrack);
                }
            }
            verifyExpectedTopLevelDevices(params);
            int srcSlot = -1;
            if ("chain".equals(src)) {
                srcSlot = settled.slotOf(srcPosition);
                if (srcSlot == ContainerScopes.EMPTY) {
                    throw new IllegalArgumentException("no device at source position " + srcPosition
                        + " — the track holds " + settled.deviceCount() + " devices");
                }
            }
            DeviceChain sourceNamedSlot = "slot".equals(src)
                ? requireCursorNamedSlot(srcPosition, params, "expectedSourceChain") : null;
            Device source = "chain".equals(src)
                ? rig.slotLayerDeviceBanks[srcSlot][srcChain].getDevice(srcDevice)
                : "slot".equals(src)
                    ? rig.cursorDeviceSiblings0.getDevice(srcDevice)
                : rig.cursorDeviceBanks[0].getDevice(srcDevice);
            if ("chain".equals(src)) {
                DeviceLayer sourceChain = rig.slotLayerBanks[srcSlot].getItemAt(srcChain);
                if (!sourceChain.exists().get()) {
                    throw new IllegalArgumentException("no chain at position " + srcPosition + " index "
                        + srcChain + " — the device is " + rig.scopeDevice(srcSlot).name().get()
                        + ", holding " + countSlotChains(srcSlot) + " chains");
                }
                if (params.has("expectedSourceChain")) {
                    String expected = params.get("expectedSourceChain").getAsString();
                    String actual = sourceChain.name().get();
                    if (!expected.equals(actual)) {
                        throw new IllegalArgumentException(
                            "source chain identity changed: expected \"" + expected + "\", got \"" + actual + "\"");
                    }
                }
            }
            if ("slot".equals(src) && params.has("expectedSourceChain")) {
                String expected = params.get("expectedSourceChain").getAsString();
                String actual = sourceNamedSlot.name().get();
                if (!expected.equals(actual)) {
                    throw new IllegalArgumentException(
                        "source named-slot identity changed: expected \"" + expected
                        + "\", got \"" + actual + "\"");
                }
            }
            if (params.has("expectedSourceName")) {
                String expected = params.get("expectedSourceName").getAsString();
                String actual = source.name().get();
                if (!expected.equals(actual)) {
                    throw new IllegalArgumentException(
                        "source device identity changed: expected \"" + expected + "\", got \"" + actual + "\"");
                }
            }
            JsonObject r = ok();
            r.addProperty("verb", verb);
            r.addProperty("dst", dst);
            r.addProperty("where", where);
            if ("chain".equals(src)) {
                final int slot = srcSlot;
                r.addProperty("srcSlot", slot);
                r.addProperty("srcScopeStatus", rig.slotScopeStatus[slot]);
                putGuarded(r, "sourceChain", () -> rig.slotLayerBanks[slot].getItemAt(srcChain).name().get());
                putGuarded(r, "sourceContainer", () -> rig.scopeDevice(slot).name().get());
                r.addProperty("sourcePosition", srcPosition);
            }
            if ("slot".equals(src)) {
                r.addProperty("srcScopeStatus", "cursor-held");
                putGuarded(r, "sourceChain", () -> sourceNamedSlot.name().get());
                putGuarded(r, "sourceContainer",
                    () -> rig.cursorDeviceBanks[0].getDevice(srcPosition).name().get());
                r.addProperty("sourcePosition", srcPosition);
            }
            // ⚠ Read the source BEFORE the verb fires. Afterwards the banks re-index
            // (E3: deleting device[0] shifts the survivor from 1 to 0), so this handle
            // no longer necessarily refers to what moved — and a name read after the
            // fact is how a probe reports the wrong device.
            putGuarded(r, "sourceName", () -> source.name().get());
            putGuarded(r, "sourceExists", () -> source.exists().get());
            if (!source.exists().get()) {
                throw new IllegalArgumentException(
                    "no device at " + src + " source position " + srcPosition + " / chain " + srcChain
                    + " / index " + srcDevice
                    + " — aimed at an empty slot this verb is a silent no-op byte-identical to a "
                    + "refusal (the e16o trap)");
            }

            com.bitwig.extension.controller.api.InsertionPoint target;
            if ("top".equals(dst)) {
                target = "chainStart".equals(where)
                    ? rig.cursorTrack(ref).startOfDeviceChainInsertionPoint()
                    : rig.cursorTrack(ref).endOfDeviceChainInsertionPoint();
            } else if ("chain".equals(dst)) {
                int dstSlot = settled.slotOf(dstPosition);
                if (dstSlot == ContainerScopes.EMPTY) {
                    throw new IllegalArgumentException("no device at destination position " + dstPosition
                        + " — the track holds " + settled.deviceCount() + " devices");
                }
                DeviceLayer destination = rig.slotLayerBanks[dstSlot].getItemAt(dstChain);
                if (!destination.exists().get()) {
                    throw new IllegalArgumentException(
                        "no chain at position " + dstPosition + " index " + dstChain + " — the device is "
                        + rig.scopeDevice(dstSlot).name().get() + ", holding " + countSlotChains(dstSlot) + " chains");
                }
                if (params.has("expectedDestinationChain")) {
                    String expected = params.get("expectedDestinationChain").getAsString();
                    String actual = destination.name().get();
                    if (!expected.equals(actual)) {
                        throw new IllegalArgumentException(
                            "destination chain identity changed: expected \"" + expected
                            + "\", got \"" + actual + "\"");
                    }
                }
                r.addProperty("dstSlot", dstSlot);
                r.addProperty("dstChain", dstChain);
                r.addProperty("dstPosition", dstPosition);
                r.addProperty("dstScopeStatus", rig.slotScopeStatus[dstSlot]);
                putGuarded(r, "dstChainName", () -> destination.name().get());
                putGuarded(r, "dstContainer", () -> rig.scopeDevice(dstSlot).name().get());
                target = "chainStart".equals(where)
                    ? destination.startOfDeviceChainInsertionPoint()
                    : destination.endOfDeviceChainInsertionPoint();
            } else {
                DeviceChain destination = requireCursorNamedSlot(
                    dstPosition, params, "expectedDestinationChain");
                if (params.has("expectedDestinationChain")) {
                    String expected = params.get("expectedDestinationChain").getAsString();
                    String actual = destination.name().get();
                    if (!destination.exists().get() || !expected.equals(actual)) {
                        throw new IllegalArgumentException(
                            "destination named-slot identity changed: expected \"" + expected
                            + "\", got \"" + actual + "\"");
                    }
                }
                r.addProperty("dstPosition", dstPosition);
                r.addProperty("dstScopeStatus", "cursor-held");
                putGuarded(r, "dstChainName", () -> destination.name().get());
                putGuarded(r, "dstContainer",
                    () -> rig.cursorDeviceBanks[0].getDevice(dstPosition).name().get());
                target = "chainStart".equals(where)
                    ? destination.startOfDeviceChainInsertionPoint()
                    : destination.endOfDeviceChainInsertionPoint();
            }
            r.add("aim", settled.report());
            if ("move".equals(verb)) {
                target.moveDevices(source);
            } else {
                target.copyDevices(source);
            }
            return r;
        });
    }

    /** Return the one cursor-bound named slot after exact parent validation. */
    private DeviceChain requireCursorNamedSlot(
            int containerIndex, JsonObject params, String expectedNameField) {
        Device parent = rig.cursorDeviceBanks[0].getDevice(containerIndex);
        if (!parent.exists().get() || !rig.cursorDevice0.exists().get()
                || !rig.cursorDevice0.isNested().get()
                || rig.directParameterTopLevelIndex != containerIndex
                || rig.directParameterRouteKinds.size() != 1
                || !"deviceSlot".equals(rig.directParameterRouteKinds.get(0))) {
            throw new IllegalArgumentException(
                "cursor named-slot container changed before relocation");
        }
        String slotName = rig.directParameterRouteNames.get(0);
        if (!rig.cursorDeviceChain0.exists().get()
                || !slotName.equals(rig.cursorDeviceChain0.name().get())) {
            throw new IllegalArgumentException(
                "cursor named-slot scope is not complete");
        }
        if (params.has(expectedNameField)) {
            String expected = params.get(expectedNameField).getAsString();
            if (!expected.equals(slotName)) {
                throw new IllegalArgumentException(
                    "cursor named-slot identity changed: expected \"" + expected
                    + "\", got \"" + slotName + "\"");
            }
        }
        return rig.cursorDeviceChain0;
    }

    /** Verify the complete top-level name and enabled-state guard before relocation. */
    private void verifyExpectedTopLevelDevices(JsonObject params) {
        if (!params.has("expectedDeviceNames") || params.get("expectedDeviceNames").isJsonNull()) {
            if (params.has("expectedDeviceEnabled")
                    && !params.get("expectedDeviceEnabled").isJsonNull()) {
                throw new IllegalArgumentException(
                    "chain.move expectedDeviceEnabled requires expectedDeviceNames");
            }
            return;
        }
        JsonElement namesValue = params.get("expectedDeviceNames");
        if (!namesValue.isJsonArray()) {
            throw new IllegalArgumentException("chain.move expectedDeviceNames must be an array");
        }
        JsonArray names = namesValue.getAsJsonArray();
        if (names.size() > rig.config.deviceBank) {
            throw new IllegalArgumentException("chain.move expected device chain exceeds the bank");
        }
        if (rig.cursorDeviceBanks[0].itemCount().get() != names.size()) {
            throw new IllegalArgumentException("chain.move top-level device count changed");
        }
        JsonArray enabled = null;
        if (params.has("expectedDeviceEnabled")
                && !params.get("expectedDeviceEnabled").isJsonNull()) {
            JsonElement enabledValue = params.get("expectedDeviceEnabled");
            if (!enabledValue.isJsonArray()) {
                throw new IllegalArgumentException("chain.move expectedDeviceEnabled must be an array");
            }
            enabled = enabledValue.getAsJsonArray();
            if (enabled.size() != names.size()) {
                throw new IllegalArgumentException(
                    "chain.move expectedDeviceEnabled must align with expectedDeviceNames");
            }
        }
        for (int i = 0; i < names.size(); i++) {
            JsonElement expectedName = names.get(i);
            if (!expectedName.isJsonPrimitive() || !expectedName.getAsJsonPrimitive().isString()) {
                throw new IllegalArgumentException(
                    "chain.move expectedDeviceNames[" + i + "] must be a string");
            }
            Device actual = rig.cursorDeviceBanks[0].getDevice(i);
            if (!actual.exists().get() || !expectedName.getAsString().equals(actual.name().get())) {
                throw new IllegalArgumentException(
                    "chain.move top-level device name changed at index " + i);
            }
            if (enabled != null) {
                JsonElement expectedEnabled = enabled.get(i);
                if (!expectedEnabled.isJsonPrimitive()
                        || !expectedEnabled.getAsJsonPrimitive().isBoolean()) {
                    throw new IllegalArgumentException(
                        "chain.move expectedDeviceEnabled[" + i + "] must be a boolean");
                }
                if (expectedEnabled.getAsBoolean() != actual.isEnabled().get()) {
                    throw new IllegalArgumentException(
                        "chain.move top-level enabled state changed at index " + i);
                }
            }
        }
    }

    /** How many chains the scope can currently see — for a refusal's message only. */
    private int countSlotChains(int slot) {
        int existing = 0;
        for (int l = 0; l < Rig.SLOT_LAYER_BANK; l++) {
            if (rig.slotLayerBanks[slot].getItemAt(l).exists().get()) {
                existing++;
            }
        }
        return existing;
    }

    private JsonElement drumPadList() {
        JsonArray pads = new JsonArray();
        for (int p = 0; p < Rig.DRUM_PAD_BANK; p++) {
            DrumPad pad = rig.drumPadBank0.getItemAt(p);
            if (!pad.exists().get()) {
                continue;
            }
            JsonObject obj = new JsonObject();
            obj.addProperty("index", p);
            obj.addProperty("name", pad.name().get());
            JsonArray devices = new JsonArray();
            for (int d = 0; d < rig.config.deviceBank; d++) {
                Device nested = rig.drumPadDeviceBanks0[p].getDevice(d);
                if (!nested.exists().get()) {
                    continue;
                }
                JsonObject device = new JsonObject();
                device.addProperty("index", d);
                device.addProperty("name", nested.name().get());
                devices.add(device);
            }
            obj.add("devices", devices);
            obj.addProperty("deviceCount", rig.drumPadDeviceBanks0[p].itemCount().get());
            obj.addProperty("deviceBankSize", rig.config.deviceBank);
            pads.add(obj);
        }
        JsonObject result = new JsonObject();
        result.add("pads", pads);
        result.addProperty("count", pads.size());
        putGuarded(result, "itemCount", () -> rig.drumPadBank0.itemCount().get());
        result.addProperty("bankSize", Rig.DRUM_PAD_BANK);
        putGuarded(result, "hasDrumPads", () -> rig.cursorDevice0.hasDrumPads().get());
        return result;
    }

    /**
     * DrumPad has its OWN insertionPoint() that DeviceLayer lacks — the
     * asymmetry suggests empty pads can be filled, i.e. chains created.
     */
    private JsonElement drumPadInsertDevice(JsonObject params) {
        int padIndex = params.get("padIndex").getAsInt();
        String uuid = params.get("uuid").getAsString();
        if (params.has("expectedTrackChannelId")) {
            String expectedTrack = params.get("expectedTrackChannelId").getAsString();
            String actualTrack = rig.cursorTracks[0].channelId().get();
            if (!expectedTrack.equals(actualTrack)) {
                throw new IllegalArgumentException(
                    "drumpad.insertDevice track identity changed: expected "
                        + expectedTrack + ", got " + actualTrack);
            }
            int expectedIndex = params.get("expectedDeviceIndex").getAsInt();
            int actualIndex = rig.currentDirectParameterDeviceIndex();
            String expectedName = params.get("expectedContainerName").getAsString();
            String actualName = rig.cursorDevice0.name().get();
            if (rig.cursorDevice0.isNested().get() || expectedIndex != actualIndex
                    || !expectedName.equals(actualName)) {
                throw new IllegalArgumentException(
                    "drumpad.insertDevice container identity changed");
            }
        }
        if (padIndex < 0 || padIndex >= Rig.DRUM_PAD_BANK) {
            throw new IllegalArgumentException("drumpad.insertDevice padIndex is outside the bank");
        }
        DrumPad pad = rig.drumPadBank0.getItemAt(padIndex);
        if (params.has("expectedTrackChannelId") && pad.exists().get()) {
            throw new IllegalArgumentException(
                "drumpad.insertDevice target pad " + padIndex + " is occupied");
        }
        pad.insertionPoint()
            .insertBitwigDevice(java.util.UUID.fromString(uuid));
        return ok();
    }

    private JsonElement drumPadDuplicate(JsonObject params) {
        rig.drumPadBank0.getItemAt(params.get("padIndex").getAsInt()).duplicateObject();
        return ok();
    }

    private JsonElement chainSelectorStatus() {
        JsonObject result = new JsonObject();
        putGuarded(result, "exists", () -> rig.chainSelector0.exists().get());
        putGuarded(result, "chainCount", () -> rig.chainSelector0.chainCount().get());
        putGuarded(result, "activeChainIndex", () -> rig.chainSelector0.activeChainIndex().get());
        return result;
    }

    private JsonElement chainSelectorSet(JsonObject params) {
        if (params.has("cycle")) {
            if ("next".equals(params.get("cycle").getAsString())) {
                rig.chainSelector0.cycleNext();
            } else {
                rig.chainSelector0.cyclePrevious();
            }
        } else {
            rig.chainSelector0.activeChainIndex().set(params.get("index").getAsInt());
        }
        return ok();
    }
}
