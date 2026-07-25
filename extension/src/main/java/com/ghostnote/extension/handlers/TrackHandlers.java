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
        r.on("track.resolveByChannelId", params -> trackResolveByChannelId(params));
        r.on("clip.create", params -> clipCreate(params));
        r.on("slot.status", params -> slotStatus(params));
        r.on("slot.select", params -> slotSelect(params));
        r.on("slot.delete", params -> slotDelete(params));
        r.on("slot.launch", params -> slotLaunch(params));
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
