package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.Device;
import com.bitwig.extension.controller.api.DeviceLayer;
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
        r.on("chain.move", params -> chainMove(params));
        // ⚠⚠ Session 3f step 6b-2 — PRODUCT surface, the first write that reaches
        // inside a container. See the block comment above `chainSelect`.
        r.on("chain.select", params -> chainSelect(params));
        r.on("chain.duplicate", params -> chainDuplicate(params));
        r.on("chain.setName", params -> chainSetName(params));
        r.on("chain.activate", params -> chainActivate(params));
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
            // ⚠⚠ E17 — the readback whose absence made `e17k` uninterpretable and
            // forced a human-assisted probe. A row firing a named action at a
            // layer can now assert "it IS selected" as a PRECONDITION, separately
            // from its question (the e16o discipline).
            obj.addProperty("selectedInEditor", rig.layerSelectedInEditor[l]);
            obj.addProperty("selected", rig.layerSelected[l]);

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
        // Whether the selection observers survived init — same reasoning as the
        // mixer status: "every layer reads selected=false" means something
        // different depending on whether the observers were ever attached.
        result.addProperty("layerSelectionStatus", rig.layerSelectionStatus);
        result.addProperty("layerSelectionLegacyStatus", rig.layerSelectionLegacyStatus);
        // ⚠ E17 row 3 — the CONTAINER-SCOPED cursor, reported alongside the
        // indexed bank so `layer.insertViaCursor` can be read against it. E4e's
        // architectural negative is that an InsertionPoint must bind to a
        // referent and "layer 3" has none until it exists; that argument is about
        // INDEXED addressing, and this is the non-indexed alternative. Whether
        // the cursor has a referent when the container has zero chains is half of
        // row 3's answer, and nothing has ever read it.
        putGuarded(result, "cursorLayerExists", () -> rig.cursorLayer0.exists().get());
        putGuarded(result, "cursorLayerName", () -> rig.cursorLayer0.name().get());
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
            JsonObject scope = new JsonObject();
            scope.addProperty("slot", s);
            scope.addProperty("status", rig.slotScopeStatus[s]);
            Device slot = rig.cursorDeviceBanks[0].getDevice(s);
            putGuarded(scope, "deviceExists", () -> slot.exists().get());
            putGuarded(scope, "deviceName", () -> slot.name().get());
            putGuarded(scope, "hasLayers", () -> slot.hasLayers().get());
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
                    chain.addProperty("index", l);
                    putGuarded(chain, "name", () -> layer.name().get());
                    putGuarded(chain, "channelId", () -> layer.channelId().get());
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
                        dev.addProperty("index", d);
                        putGuarded(dev, "name", () -> nested.name().get());
                        putGuarded(dev, "enabled", () -> nested.isEnabled().get());
                        devices.add(dev);
                    }
                    chain.add("devices", devices);
                    chain.addProperty("deviceCount",
                        rig.slotLayerDeviceBanks[s][l].itemCount().get());
                    chains.add(chain);
                }
            }
            scope.add("chains", chains);
            scope.addProperty("chainCount", existing);
            // ⚠⚠ Session 3f step 6b — THE BANK SIZES, and they are not decoration.
            // This enumeration SKIPS empty bank slots, so a full bank and an
            // overflowing one produce byte-identical replies: "four chains, none
            // of them named X" is either a complete answer or a partial one, and
            // only the size separates the two. The resolver reports a chain it
            // cannot see as outside the window rather than as absent, and without
            // these numbers it cannot tell which it is looking at. An extension
            // too old to send them makes the reader treat EVERY view as partial
            // (`methodsHash` is over method names and cannot see a field appear,
            // so silence has to fail closed).
            scope.addProperty("chainBankSize", Rig.SLOT_LAYER_BANK);
            scope.addProperty("deviceBankSize", Rig.SLOT_LAYER_DEVICE_BANK);
            scopes.add(scope);
        }
        JsonObject result = new JsonObject();
        result.add("scopes", scopes);
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
     * ⚠⚠ E18 §3.1 — relocate a device that is INSIDE a chain.
     *
     * Source is always `slotLayerDeviceBanks[srcSlot][srcLayer][srcDevice]` — a
     * device nested in a container's chain, which no wire method has ever been able
     * to name as a SOURCE. Destination is either the track's top-level chain or
     * another chain, in the same container or a different one.
     *
     * ⚠ Every input is validated BEFORE the call (standing rule 3c): an exception
     * Bitwig defers to its own thread escapes every extension frame and takes the
     * DAW down (E14-A1).
     *
     * ⚠ The source is required to EXIST before the verb fires. Aimed at an empty
     * bank slot, `moveDevices` is a silent no-op byte-identical to an API refusal —
     * the e16o trap, which nearly published a false negative on the inbound row and
     * is why `requireLayer` exists at all. A handler that throws here turns the
     * whole class of mistake into an error message instead of a wrong finding.
     *
     * ⚠ Verified by a `chain.inventory` / `device.list` DIFF, never by this return:
     * the acknowledgement is identical whether or not anything moved (E6 blocker 4).
     */
    private JsonElement chainMove(JsonObject params) {
        String src = params.has("src") ? params.get("src").getAsString() : "chain";
        int srcSlot = params.has("srcSlot") ? params.get("srcSlot").getAsInt() : -1;
        int srcLayer = params.has("srcLayer") ? params.get("srcLayer").getAsInt() : -1;
        int srcDevice = params.get("srcDevice").getAsInt();
        String dst = params.has("dst") ? params.get("dst").getAsString() : "top";
        String verb = params.has("verb") ? params.get("verb").getAsString() : "move";
        String where = params.has("where") ? params.get("where").getAsString() : "chainEnd";
        String ref = params.has("cursor") ? params.get("cursor").getAsString() : "0";

        if (!"top".equals(src) && !"chain".equals(src)) {
            throw new IllegalArgumentException("src must be top or chain: " + src);
        }
        if ("chain".equals(src) && (srcSlot < 0 || srcSlot >= Rig.SLOT_SCOPES)) {
            throw new IllegalArgumentException("srcSlot out of scope range: " + srcSlot);
        }
        if ("chain".equals(src) && (srcLayer < 0 || srcLayer >= Rig.SLOT_LAYER_BANK)) {
            throw new IllegalArgumentException("srcLayer out of bank range: " + srcLayer);
        }
        int sourceBankSize = "chain".equals(src)
            ? Rig.SLOT_LAYER_DEVICE_BANK : rig.config.deviceBank;
        if (srcDevice < 0 || srcDevice >= sourceBankSize) {
            throw new IllegalArgumentException("srcDevice out of bank range: " + srcDevice);
        }
        if (!"top".equals(dst) && !"chain".equals(dst)) {
            throw new IllegalArgumentException("dst must be top or chain: " + dst);
        }
        if (!"move".equals(verb) && !"copy".equals(verb)) {
            throw new IllegalArgumentException("verb must be move or copy: " + verb);
        }
        if (!"chainStart".equals(where) && !"chainEnd".equals(where)) {
            throw new IllegalArgumentException("where must be chainStart or chainEnd: " + where);
        }
        if (params.has("expectedTrackChannelId")) {
            String expectedTrack = params.get("expectedTrackChannelId").getAsString();
            String actualTrack = rig.cursorTracks[0].channelId().get();
            if (!expectedTrack.equals(actualTrack)) {
                throw new IllegalArgumentException(
                    "chain.move track identity changed: expected " + expectedTrack + ", got " + actualTrack);
            }
        }
        if ("chain".equals(src) && rig.slotLayerBanks[srcSlot] == null) {
            throw new IllegalArgumentException(
                "source scope " + srcSlot + " was never built: " + rig.slotScopeStatus[srcSlot]
                + " (standing rule 13 — a missing handle and an API refusal look identical)");
        }

        Device source = "chain".equals(src)
            ? rig.slotLayerDeviceBanks[srcSlot][srcLayer].getDevice(srcDevice)
            : rig.cursorDeviceBanks[0].getDevice(srcDevice);
        if ("chain".equals(src) && params.has("expectedSourceChain")) {
            String expected = params.get("expectedSourceChain").getAsString();
            String actual = rig.slotLayerBanks[srcSlot].getItemAt(srcLayer).name().get();
            if (!expected.equals(actual)) {
                throw new IllegalArgumentException(
                    "source chain identity changed: expected \"" + expected + "\", got \"" + actual + "\"");
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
        if ("chain".equals(src)) r.addProperty("srcScopeStatus", rig.slotScopeStatus[srcSlot]);
        // ⚠ Read the source BEFORE the verb fires. Afterwards the banks re-index
        // (E3: deleting device[0] shifts the survivor from 1 to 0), so this handle
        // no longer necessarily refers to what moved — and a name read after the
        // fact is how a probe reports the wrong device.
        putGuarded(r, "sourceName", () -> source.name().get());
        putGuarded(r, "sourceExists", () -> source.exists().get());
        if ("chain".equals(src)) {
            putGuarded(r, "sourceChain",
                () -> rig.slotLayerBanks[srcSlot].getItemAt(srcLayer).name().get());
            putGuarded(r, "sourceContainer",
                () -> rig.cursorDeviceBanks[0].getDevice(srcSlot).name().get());
        }
        if (!source.exists().get()) {
            throw new IllegalArgumentException(
                "no device at " + src + " source " + srcSlot + " / chain " + srcLayer + " / index " + srcDevice
                + " — aimed at an empty slot this verb is a silent no-op byte-identical to a "
                + "refusal (the e16o trap)");
        }

        com.bitwig.extension.controller.api.InsertionPoint target;
        if ("top".equals(dst)) {
            target = "chainStart".equals(where)
                ? rig.cursorTrack(ref).startOfDeviceChainInsertionPoint()
                : rig.cursorTrack(ref).endOfDeviceChainInsertionPoint();
        } else {
            int dstSlot = params.get("dstSlot").getAsInt();
            int dstLayer = params.get("dstLayer").getAsInt();
            if (dstSlot < 0 || dstSlot >= Rig.SLOT_SCOPES) {
                throw new IllegalArgumentException("dstSlot out of scope range: " + dstSlot);
            }
            if (dstLayer < 0 || dstLayer >= Rig.SLOT_LAYER_BANK) {
                throw new IllegalArgumentException("dstLayer out of bank range: " + dstLayer);
            }
            if (rig.slotLayerBanks[dstSlot] == null) {
                throw new IllegalArgumentException(
                    "destination scope " + dstSlot + " was never built: " + rig.slotScopeStatus[dstSlot]);
            }
            if ("chain".equals(src) && dstSlot == srcSlot && dstLayer == srcLayer) {
                throw new IllegalArgumentException(
                    "the destination chain is the source chain, so the move is a no-op by "
                    + "construction and would be indistinguishable from a failure");
            }
            DeviceLayer destination = rig.slotLayerBanks[dstSlot].getItemAt(dstLayer);
            if (!destination.exists().get()) {
                throw new IllegalArgumentException(
                    "no chain at scope " + dstSlot + " / index " + dstLayer + " — the slot device is "
                    + rig.cursorDeviceBanks[0].getDevice(dstSlot).name().get());
            }
            if ("top".equals(src) && srcDevice == dstSlot) {
                throw new IllegalArgumentException("a container cannot be relocated into one of its own chains");
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
            r.addProperty("dstLayer", dstLayer);
            r.addProperty("dstScopeStatus", rig.slotScopeStatus[dstSlot]);
            putGuarded(r, "dstChain", () -> destination.name().get());
            putGuarded(r, "dstContainer",
                () -> rig.cursorDeviceBanks[0].getDevice(dstSlot).name().get());
            target = "chainStart".equals(where)
                ? destination.startOfDeviceChainInsertionPoint()
                : destination.endOfDeviceChainInsertionPoint();
        }

        if ("move".equals(verb)) {
            target.moveDevices(source);
        } else {
            target.copyDevices(source);
        }
        return r;
    }

    // ======================================================================
    // ⚠⚠ Session 3f step 6b-2 — CHAIN CREATION, as product surface.
    //
    // `e17ak` closed this as the one typed route that works, after the whole
    // spike had recorded it as impossible: SELECT the chain
    // (`DeviceChain.selectInEditor()`), then call `Channel.duplicate()` on it.
    // Four arms on a fresh FX Layer that had never been clicked — no primer ○,
    // `layer.pointCursor` ○, `insertViaCursor` ○, and `layer.select` ●● — with
    // the sibling `DuplicableObject.duplicateObject()` genuinely dead beside it.
    // No focus, no priming, no foreground, no human.
    //
    // ⚠⚠ **These three are NOT `layer.select` / `layer.duplicateChannel` /
    // `layer.setName` under new names, and the difference is the handle.** Those
    // act on `rig.layerBank0`, which follows `cursorDevice0`. That is
    // disqualifying three times over for a product route:
    //
    //   - the container becomes a HIDDEN argument (the e16o trap), where
    //     `chain.inventory` — the reader these must agree with — names it by
    //     parameter;
    //   - reader and writer would address containers through different handles,
    //     so a chain resolved at slot 1 could be duplicated somewhere else;
    //   - `cursorDevice0` is what `param.set` writes through, so moving it to
    //     reach a container would silently re-aim every parameter write near it.
    //
    // These read through `Rig.slotLayerBanks[slot]` instead: the same banks
    // `chain.inventory` enumerates, hung off top-level device SLOTS, with the
    // container named by a parameter and no cursor to steal.
    //
    // ⚠ The DEVIATION is named rather than glossed over, because this project's
    // most repeated lesson is that sibling verbs and sibling handles disagree
    // (`copyDevices` ○ beside `moveDevices` ●; `duplicateObject()` ○ beside
    // `Channel.duplicate()` ●). `e17ak` measured these two calls on a
    // `DeviceLayer` from `layerBank0`; this is the same interface and the same
    // two calls on a `DeviceLayer` from `slotLayerBanks`. Live conformance is
    // what closes that gap — nothing here should be read as having closed it.
    //
    // ⚠ SELECT IS ITS OWN CALL, deliberately, and that is not tidiness. E2: a
    // write is not visible to a read in the same request. `e17ak` fired the
    // select as a separate call one turn earlier, so a handler that selected and
    // duplicated in one breath would be testing a timing nobody has measured,
    // and the failure mode is a silent ○ indistinguishable from "the route does
    // not work". The brain sends `chain.select`, settles, and only then sends
    // `chain.duplicate`.
    //
    // ⚠ Every one of them is verified by a `chain.inventory` DIFF, never by its
    // own return value: the acknowledgement is identical whether or not anything
    // happened (E6 blocker 4).
    // ======================================================================

    /**
     * ⚠ Make a chain the editor selection — `e17ak`'s enabling half.
     *
     * `DeviceLayer` is a `DeviceChain`, so it carries `selectInEditor()`, and
     * `e17y` proved our call sets the identical flag a human click does.
     *
     * ⚠ It refuses a chain whose name is not the one the caller observed. The
     * bank re-indexes when a chain is added or removed (E3, one level down), so a
     * position learned from an earlier reply can name a different chain by the
     * time it is used — and selecting the wrong one means duplicating the wrong
     * one, silently, with a healthy acknowledgement.
     */
    private JsonElement chainSelect(JsonObject params) {
        DeviceLayer layer = requireSlotLayer(params);
        JsonObject r = describeSlotLayer(params, layer);
        layer.selectInEditor();
        return r;
    }

    /**
     * ⚠⚠ `Channel.duplicate()` on an already-selected chain — the create itself.
     *
     * ⚠ It calls `selectInEditor()` again first, and that is belt AND braces
     * rather than a substitute for `chain.select`. The load-bearing selection is
     * the one made in the PREVIOUS request, which has had a turn to land; this
     * one costs nothing, and covers the case where something moved the selection
     * in between. If it were the only one, this row would depend on a same-turn
     * visibility that E2 says does not exist.
     *
     * ⚠ Returns the source's identity read BEFORE the verb fires. Afterwards the
     * bank re-indexes and this handle may describe whatever slid into the slot
     * (E3, `e16t`) — and the brain identifies the COPY by diffing channelIds
     * across two inventories, so what it needs from here is what was there
     * before, not a guess about what is there now.
     */
    private JsonElement chainDuplicate(JsonObject params) {
        DeviceLayer layer = requireSlotLayer(params);
        JsonObject r = describeSlotLayer(params, layer);
        layer.selectInEditor();
        layer.duplicate();
        return r;
    }

    /**
     * ⚠⚠ Rename the chain carrying this `channelId` — BY IDENTITY, never by name
     * and never by position.
     *
     * **Why it cannot be addressed like everything else.** A duplicate arrives
     * carrying its source's NAME, so at the moment this runs the container holds
     * two chains one name cannot tell apart; and a bank POSITION is exactly what
     * the duplicate just invalidated. Either way a wrong guess renames the
     * SOURCE and leaves the copy wearing the source's name — which breaks every
     * address anyone held to the source, in a way nothing would report.
     *
     * ⚠ `channelId` is worthless ACROSS a project load — the loader mints it
     * afresh (E17ad 8/8, E18b), which is why `ChainAddress` addresses by name —
     * and it is exactly right WITHIN the turn that just observed it, which is
     * the only window this is used in.
     *
     * ⚠ It REFUSES an id it cannot find, and refuses again if two chains somehow
     * report the same one. Falling back to a position here would reintroduce the
     * whole hazard the id exists to remove.
     */
    private JsonElement chainSetName(JsonObject params) {
        int slot = requireSlotScope(params);
        String channelId = params.get("channelId").getAsString();
        String name = params.get("name").getAsString();
        // Validated BEFORE the write: a chain's name is its only durable
        // identifier (E18b), so a blank one is not a weak name but no name.
        if (name.trim().isEmpty()) {
            throw new IllegalArgumentException("name must not be blank");
        }

        DeviceLayer target = null;
        int at = -1;
        for (int l = 0; l < Rig.SLOT_LAYER_BANK; l++) {
            DeviceLayer candidate = rig.slotLayerBanks[slot].getItemAt(l);
            if (!candidate.exists().get() || !channelId.equals(candidate.channelId().get())) {
                continue;
            }
            if (target != null) {
                throw new IllegalArgumentException(
                    "two chains in scope " + slot + " report channelId " + channelId
                    + " — refusing rather than renaming whichever was enumerated first");
            }
            target = candidate;
            at = l;
        }
        if (target == null) {
            throw new IllegalArgumentException(
                "no chain in scope " + slot + " has channelId " + channelId
                + " — the container holds " + countSlotChains(slot) + " chains. Refusing rather "
                + "than falling back to a position, which is what this id exists to avoid");
        }

        final DeviceLayer chain = target;
        JsonObject r = ok();
        r.addProperty("slot", slot);
        r.addProperty("layerIndex", at);
        r.addProperty("scopeStatus", rig.slotScopeStatus[slot]);
        r.addProperty("requested", name);
        // Read BEFORE the write, so a reply describes what was there rather than
        // what we just put there (`e16t`).
        putGuarded(r, "previousName", () -> chain.name().get());
        putGuarded(r, "trackChannelId", () -> rig.cursorTracks[0].channelId().get());
        chain.name().set(name);
        return r;
    }

    /** Make one chain the sole soloed chain in this container. */
    private JsonElement chainActivate(JsonObject params) {
        DeviceLayer target = requireSlotLayer(params);
        String expectedTrack = params.get("expectedTrackChannelId").getAsString();
        String actualTrack = rig.cursorTracks[0].channelId().get();
        if (!expectedTrack.equals(actualTrack)) {
            throw new IllegalArgumentException(
                "chain.activate track identity changed: expected " + expectedTrack + ", got " + actualTrack);
        }
        int slot = params.get("slot").getAsInt();
        int targetIndex = params.get("layerIndex").getAsInt();
        JsonObject r = describeSlotLayer(params, target);

        // Clear any exceptional multi-solo state first. Then use the measured
        // exclusivity primitive only when the requested target is not already on;
        // toggle(true) on an already-soloed target would turn it off.
        for (int l = 0; l < Rig.SLOT_LAYER_BANK; l++) {
            if (l == targetIndex) continue;
            DeviceLayer sibling = rig.slotLayerBanks[slot].getItemAt(l);
            if (sibling.exists().get() && sibling.solo().get()) {
                sibling.solo().set(false);
            }
        }
        if (!target.solo().get()) {
            target.solo().toggle(true);
        }
        return r;
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

    /**
     * The scope index, validated — and validated BEFORE any Bitwig call.
     *
     * ⚠ Standing rule 3c: an exception Bitwig defers to its own thread escapes
     * every extension frame and takes the DAW down (E14-A1).
     *
     * ⚠ Standing rule 13: a scope that was never BUILT and an API that declines
     * are indistinguishable in the outcome, and three false ○s in E17 came from
     * exactly that. A missing bank throws with its own recorded status rather
     * than behaving like an empty container.
     */
    private int requireSlotScope(JsonObject params) {
        int slot = params.get("slot").getAsInt();
        if (slot < 0 || slot >= Rig.SLOT_SCOPES) {
            throw new IllegalArgumentException("slot out of scope range: " + slot);
        }
        if (rig.slotLayerBanks[slot] == null) {
            throw new IllegalArgumentException(
                "scope " + slot + " was never built: " + rig.slotScopeStatus[slot]
                + " (standing rule 13 — a missing handle and an API refusal look identical)");
        }
        return slot;
    }

    /**
     * The chain a call is about to act on, resolved through the CURSOR-FREE slot
     * scope and checked against the name the caller observed.
     *
     * ⚠ The name check is the whole point. A bank position is not an identity: a
     * chain bank re-indexes when a chain is added or removed (E3, one level
     * down), so a position learned from one reply can name a different chain in
     * the next request. Aimed at the wrong chain, both verbs above succeed and
     * report `ok`.
     *
     * ⚠ An absent chain throws rather than no-op'ing, for the e16o reason: aimed
     * at an empty bank slot these verbs are silent no-ops byte-identical to an
     * API refusal, and that has published false negatives in this codebase
     * before.
     */
    private DeviceLayer requireSlotLayer(JsonObject params) {
        int slot = requireSlotScope(params);
        int layerIndex = params.get("layerIndex").getAsInt();
        if (layerIndex < 0 || layerIndex >= Rig.SLOT_LAYER_BANK) {
            throw new IllegalArgumentException("layerIndex out of bank range: " + layerIndex);
        }
        DeviceLayer layer = rig.slotLayerBanks[slot].getItemAt(layerIndex);
        if (!layer.exists().get()) {
            throw new IllegalArgumentException(
                "no chain at scope " + slot + " index " + layerIndex + " — the slot device is "
                + rig.cursorDeviceBanks[0].getDevice(slot).name().get()
                + ", holding " + countSlotChains(slot) + " chains");
        }
        if (params.has("expectedName")) {
            String expected = params.get("expectedName").getAsString();
            String actual = layer.name().get();
            if (!expected.equals(actual)) {
                throw new IllegalArgumentException(
                    "chain at scope " + slot + " index " + layerIndex + " is named \"" + actual
                    + "\", not \"" + expected + "\" — the bank re-indexed since it was observed, "
                    + "and acting on a stale position would hit a chain nobody addressed");
            }
        }
        return layer;
    }

    /** Identify the chain a call is about to act on, read BEFORE the act (`e16t`). */
    private JsonObject describeSlotLayer(JsonObject params, DeviceLayer layer) {
        JsonObject r = ok();
        r.addProperty("slot", params.get("slot").getAsInt());
        r.addProperty("layerIndex", params.get("layerIndex").getAsInt());
        r.addProperty("scopeStatus", rig.slotScopeStatus[params.get("slot").getAsInt()]);
        putGuarded(r, "sourceName", () -> layer.name().get());
        putGuarded(r, "sourceChannelId", () -> layer.channelId().get());
        putGuarded(r, "containerName",
            () -> rig.cursorDeviceBanks[0].getDevice(params.get("slot").getAsInt()).name().get());
        // ⚠ Named beside the rest: a scope index means nothing without knowing
        // which TRACK the device bank is on (the e16o trap, one level up), and
        // these banks follow `cursorTracks[0]`.
        putGuarded(r, "trackChannelId", () -> rig.cursorTracks[0].channelId().get());
        return r;
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
