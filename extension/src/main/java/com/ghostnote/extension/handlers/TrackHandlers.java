package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.ClipLauncherSlot;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.RemoteControl;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Tracks, clips and launcher slots (E1, E2c, E2f).
 *
 * `track.resolveByChannelId` is the stable-addressing primitive: channelId is
 * the ONE durable track key (E2f — survives index shift, rename, and a full
 * save/restart cycle), so callers address by UUID and re-resolve to an index.
 *
 * Split out of ProbeHandlers.java in Phase 0; the method bodies are unchanged.
 */
public final class TrackHandlers extends HandlerGroup {
    public TrackHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("track.create", params -> trackCreate(params));
        r.on("track.setName", params -> trackSetName(params));
        r.on("track.list", params -> trackList());
        r.on("track.delete", params -> trackDelete(params));
        r.on("track.deleteViaAction", params -> trackDeleteViaAction(params));
        r.on("track.resolveByChannelId", params -> trackResolveByChannelId(params));
        r.on("clip.create", params -> clipCreate(params));
        r.on("slot.status", params -> slotStatus(params));
        r.on("slot.select", params -> slotSelect(params));
        r.on("slot.delete", params -> slotDelete(params));
        r.on("slot.launch", params -> slotLaunch(params));
        r.on("slot.moveTo", params -> slotMoveTo(params));
        r.on("slot.epoch", params -> slotEpoch());
    }

    private JsonElement trackCreate(JsonObject params) {
        int position = params.get("position").getAsInt();
        rig.application.createInstrumentTrack(position);
        return ok();
    }

    private JsonElement trackSetName(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        track.setName(params.get("name").getAsString());
        return ok();
    }

    private JsonElement trackList() {
        JsonArray tracks = new JsonArray();
        for (int i = 0; i < rig.config.tracks; i++) {
            Track track = rig.trackBank.getItemAt(i);
            if (!track.exists().get()) {
                continue;
            }
            JsonObject obj = new JsonObject();
            obj.addProperty("index", i);
            obj.addProperty("name", track.name().get());
            obj.addProperty("position", track.position().get());
            obj.addProperty("type", track.trackType().get());
            obj.addProperty("channelId", track.channelId().get());
            tracks.add(obj);
        }
        JsonObject result = new JsonObject();
        result.add("tracks", tracks);
        result.addProperty("count", tracks.size());
        // Bank-window overflow (E5, standing rule 5): `count` is what we can SEE.
        // `itemCount` is what the project claims to hold and `bankSize` is the
        // window — when itemCount > bankSize the caller is half-blind and must
        // refuse to operate rather than silently snapshot a partial project.
        result.addProperty("itemCount", rig.trackBank.itemCount().get());
        result.addProperty("bankSize", rig.config.tracks);
        return result;
    }

    /**
     * ⚠⚠ E17 row 4 — THE VERB CONTROL for `layer.deleteViaAction`, and it only
     * works as a control because of the type hierarchy.
     *
     *     Channel extends DeviceChain, DeleteableObject, DuplicableObject
     *        ↑                              ↑
     *     Track                        DeviceLayer   (an EMPTY interface body:
     *     + isGroup, position, …        `interface DeviceLayer extends Channel {}`)
     *
     * `Track` and `DeviceLayer` are **siblings**, both plain `Channel`s, and both
     * inherit `deleteObjectAction()` from the same place. So this is the identical
     * call on the identical inherited method, differing only in the receiver — the
     * strongest control shape available, and the one that made `e17f`'s ○ worth
     * something (`Device.deleteObject()` ● beside `DeviceLayer.deleteObject()` ○).
     *
     *   this ● and the layer ○  ⇒ the route works; DeviceLayer specifically declines
     *   both ○                  ⇒ the `*Action()` form is dead everywhere, and the
     *                             layer result measures nothing about layers
     *
     * ⚠ Without it, a ○ on the layer side is uninterpretable — exactly the mistake
     * that let a dozen E17 negatives stand for most of the spike.
     *
     * ⚠ This DELETES A TRACK. It is probe surface only, banned from the contract
     * like every other destructive route (standing rule 6 / E6 blocker 3).
     */
    private JsonElement trackDeleteViaAction(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        JsonObject r = ok();
        putGuarded(r, "name", () -> track.name().get());
        putGuarded(r, "channelId", () -> track.channelId().get());
        // ⚠ Rule 13 again: init-time handle, indexed by bank slot.
        int ti = params.get("trackIndex").getAsInt();
        r.addProperty("handleStatus", rig.trackDeleteActionStatus);
        try {
            if (rig.trackDeleteAction == null || ti >= rig.trackDeleteAction.length
                || rig.trackDeleteAction[ti] == null) {
                r.addProperty("actionInvoke", "NO HANDLE: " + rig.trackDeleteActionStatus);
                return r;
            }
            rig.trackDeleteAction[ti].invoke();
            r.addProperty("actionInvoke", "returned");
        } catch (Throwable t) {
            r.addProperty("actionInvoke",
                "THREW:" + t.getClass().getSimpleName() + ":" + t.getMessage());
        }
        return r;
    }

    private JsonElement trackDelete(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        track.deleteObject();
        return ok();
    }

    /**
     * Re-resolve a track to its current bank index by stable channel UUID.
     * This is the candidate stable-addressing primitive: address by UUID,
     * scan the bank to find the current index/name.
     */
    private JsonElement trackResolveByChannelId(JsonObject params) {
        String wanted = params.get("channelId").getAsString();
        JsonObject result = new JsonObject();
        for (int i = 0; i < rig.config.tracks; i++) {
            Track track = rig.trackBank.getItemAt(i);
            if (track.exists().get() && wanted.equals(track.channelId().get())) {
                result.addProperty("found", true);
                result.addProperty("index", i);
                result.addProperty("name", track.name().get());
                result.addProperty("position", track.position().get());
                result.addProperty("type", track.trackType().get());
                return result;
            }
        }
        result.addProperty("found", false);
        return result;
    }

    private JsonElement clipCreate(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        int slotIndex = params.get("slotIndex").getAsInt();
        int lengthBeats = params.has("lengthBeats") ? params.get("lengthBeats").getAsInt() : 4;
        track.createNewLauncherClip(slotIndex, lengthBeats);
        return ok();
    }

    private JsonElement slotStatus(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        int slotIndex = params.get("slotIndex").getAsInt();
        ClipLauncherSlot slot = track.clipLauncherSlotBank().getItemAt(slotIndex);
        JsonObject result = new JsonObject();
        result.addProperty("exists", slot.exists().get());
        result.addProperty("hasContent", slot.hasContent().get());
        result.addProperty("isSelected", slot.isSelected().get());
        return result;
    }

    /**
     * Point the *UI selection* at a slot. Mechanisms:
     *  - "slot":  ClipLauncherSlot.select()
     *  - "track": Track.selectSlot(slotIndex)
     */
    private JsonElement slotSelect(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        int slotIndex = params.get("slotIndex").getAsInt();
        String mechanism = params.has("mechanism") ? params.get("mechanism").getAsString() : "slot";

        switch (mechanism) {
            case "slot":
                track.clipLauncherSlotBank().getItemAt(slotIndex).select();
                break;
            case "track":
                track.selectSlot(slotIndex);
                break;
            default:
                throw new IllegalArgumentException("unknown mechanism: " + mechanism);
        }
        return ok();
    }

    /**
     * ⚠ E16 §3.4f — MOVE a launcher clip, so the detectability question has an
     * event to detect.
     *
     * ⚠ **`ClipLauncherSlotOrScene.moveTo(dest)` is `@Deprecated`** — *"Use
     * `replaceInsertionPoint()` instead"*, since API 4 — and standing rule 9 is
     * about exactly this: a deprecated handle is not merely untidy, E7's
     * `getModulationSource(int)` threw and took the whole extension down. So the
     * DEFAULT route here is the modern one, and the deprecated call is reachable
     * only by asking for it by name.
     *
     * The modern route lands on `InsertionPoint.moveSlotsOrScenes(…)` — the same
     * 14-member interface whose sibling verb `moveDevices` overturned E4d last
     * session, which is a pleasing symmetry and also a warning: the verbs on this
     * interface demonstrably disagree with each other, so a ○ from one says
     * nothing about the others.
     *
     * ⚠ **The API move is the CONTROL here, not the experiment.** The threat model
     * is a HUMAN dragging a clip between scenes — that is the scenario E16l raised
     * and the one §1's tolerant fallback exists for — and a human drag needs no
     * wire method at all. This exists so the same question can be asked a second
     * way, silently and repeatably, and so a difference between the two (if any)
     * is visible rather than assumed. If the human drag and this disagree about
     * what fires, THAT is the finding.
     *
     * Verified by `slot.epoch` and by `slot.status` on both ends, never by this
     * return: the acknowledgement is identical whether or not anything moved
     * (E6 blocker 4).
     */
    private JsonElement slotMoveTo(JsonObject params) {
        Track from = requireTrack(params.get("trackIndex").getAsInt());
        Track to = requireTrack(params.get("toTrackIndex").getAsInt());
        int slotIndex = params.get("slotIndex").getAsInt();
        int toSlotIndex = params.get("toSlotIndex").getAsInt();
        String route = params.has("route") ? params.get("route").getAsString() : "insertionPoint";
        if (!"insertionPoint".equals(route) && !"deprecatedMoveTo".equals(route)) {
            throw new IllegalArgumentException(
                "route must be insertionPoint or deprecatedMoveTo: " + route);
        }
        if (from == to && slotIndex == toSlotIndex) {
            throw new IllegalArgumentException(
                "source and destination are the same slot, so the move is a no-op by "
                + "construction and would be indistinguishable from a failure");
        }

        ClipLauncherSlot source = from.clipLauncherSlotBank().getItemAt(slotIndex);
        ClipLauncherSlot dest = to.clipLauncherSlotBank().getItemAt(toSlotIndex);

        JsonObject result = ok();
        result.addProperty("route", route);
        // ⚠ Read both ends BEFORE the move. Afterwards these handles describe
        // whatever now occupies those positions, which is the whole point.
        putGuarded(result, "sourceHadContent", () -> source.hasContent().get());
        putGuarded(result, "destHadContent", () -> dest.hasContent().get());
        result.addProperty("epochBefore", rig.launcherContentEpoch);

        if ("insertionPoint".equals(route)) {
            dest.replaceInsertionPoint().moveSlotsOrScenes(source);
        } else {
            source.moveTo(dest);
        }
        return result;
    }

    /**
     * ⚠ E16 §3.4f — the detector: how many launcher-content callbacks have fired,
     * and what the last {@link Rig#CONTENT_LOG} of them said.
     *
     * The epoch is meaningless in absolute terms — Bitwig delivers initial values
     * through the same callbacks, so it starts nonzero — and every caller must
     * baseline it before the event and diff after. What carries the finding is
     * the LOG: a move should read as a pair, one slot emptying and another
     * filling. A create is one fill; a delete is one empty. If the pair appears,
     * moved clips are detectable without polling and without suspicion, and
     * §3.2.3's extension-side observer should watch content and not merely scene
     * count. If nothing fires, §1's fingerprint-then-recreate fallback carries the
     * whole weight, and that is worth knowing before the engine leans on it.
     *
     * `sceneCountChanges` rides along because §3.2.3 predicted its own blind spot
     * — a move changes no count — and a prediction next to its measurement is
     * cheaper than a prediction alone.
     */
    private JsonElement slotEpoch() {
        JsonObject result = new JsonObject();
        result.addProperty("epoch", rig.launcherContentEpoch);
        result.addProperty("sceneCountChanges", rig.sceneCountChanges);
        result.addProperty("sceneCount", rig.lastSceneCount);
        result.addProperty("selectionChanges", rig.selectionChanges);
        JsonArray log = new JsonArray();
        // Oldest-first out of the ring, so the reader sees the order events
        // happened rather than the order they happen to sit in the array.
        int size = Math.min(rig.launcherContentEpoch, Rig.CONTENT_LOG);
        for (int k = 0; k < size; k++) {
            int idx = (rig.launcherContentEpoch - size + k) % Rig.CONTENT_LOG;
            Rig.ContentEvent event = rig.contentLog[idx];
            log.add(event == null ? null : event.legacy());
        }
        result.add("log", log);
        return result;
    }

    private JsonElement slotDelete(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        int slotIndex = params.get("slotIndex").getAsInt();
        track.clipLauncherSlotBank().getItemAt(slotIndex).deleteObject();
        return ok();
    }

    /**
     * Touch/release a param handle — the controller-side "finger on the
     * control" signal. E7 routing sweep: with a RemoteControl in mapping mode,
     * does a programmatic touch complete the mapping (the UI idiom is
     * enter-mapping-then-touch-a-param)?
     */
    /** Launch a launcher clip (starts transport). E7e: per-voice modulators
     * only produce output while notes sound. */
    private JsonElement slotLaunch(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        track.clipLauncherSlotBank().getItemAt(params.get("slotIndex").getAsInt()).launch();
        return ok();
    }
}
