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
            layers.add(obj);
        }
        JsonObject result = new JsonObject();
        result.add("layers", layers);
        result.addProperty("count", existing);
        putGuarded(result, "hasLayers", () -> rig.cursorDevice0.hasLayers().get());
        // Whether the layer mixer handles survived init at all — see Rig. A row
        // that reads `mute` as ERR everywhere means something different depending
        // on this: "the handle was never marked" or "the API refuses it".
        result.addProperty("layerMixerStatus", rig.layerMixerStatus);
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
            pads.add(obj);
        }
        JsonObject result = new JsonObject();
        result.add("pads", pads);
        result.addProperty("count", pads.size());
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
        rig.drumPadBank0.getItemAt(padIndex).insertionPoint()
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
