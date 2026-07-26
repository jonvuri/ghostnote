package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.DuplicableObject;
import com.bitwig.extension.controller.api.Send;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * E16 — branches as duplicated tracks.
 *
 * The whole idea in `spike/SPIKE-E16-BRANCHES-AS-TRACKS.md` rests on one call
 * nobody has probed: can a TOP-LEVEL track be duplicated, and does the copy
 * carry state? Row A is the gate and this group exists to reach it cheaply.
 *
 * ⚠ Three duplication routes are exposed rather than one, because the doc pass
 * says they are three different methods and E4c is the reason not to trust that
 * they behave alike. `DeviceLayer` also extends `Channel`, and BOTH
 * `duplicateObject()` and `duplicate()` were silent no-ops on it (E4c routes 1
 * and 2) — a compile-time yes is not a runtime yes for anything reached through
 * a supertype. So the probe tries each and reports which ones actually made a
 * track:
 *
 *   channelDuplicate   Channel.duplicate()               v1,  "Duplicates the track."
 *   duplicateObject    DuplicableObject.duplicateObject() v19, Track ⊂ Channel ⊂ DuplicableObject
 *   hostDuplicate      ControllerHost.duplicateObjects(undoName, …) v19, the E14-G call
 *   copyTracksAfter    Track.afterTrackInsertionPoint().copyTracks(…)  — see below
 *   copyTracksBefore   Track.beforeTrackInsertionPoint().copyTracks(…)
 *
 * The rest of the group is readback for rows B5/E/G: mixer state a duplicate
 * either carries or does not, and the VU oracle that answers "is this making
 * sound" without asking a human to hear a 100ms window.
 */
public final class BranchHandlers extends HandlerGroup {
    public BranchHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("branch.duplicateTrack", params -> duplicateTrack(params));
        r.on("branch.mixer", params -> mixer(params));
        r.on("branch.setMixer", params -> setMixer(params));
        r.on("branch.vu", params -> vu(params));
    }

    /**
     * Duplicate one track by a named route.
     *
     * Standing rule 3c: every input is validated BEFORE the call. `requireTrack`
     * already refuses an out-of-bank or non-existent index, and an unknown route
     * throws before anything Bitwig-side is touched — a handler's try/catch is
     * not a safety net for what Bitwig defers to its own thread (E14-A1).
     */
    private JsonElement duplicateTrack(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        String route = params.has("route") ? params.get("route").getAsString() : "channelDuplicate";
        String undoName = params.has("undoName") ? params.get("undoName").getAsString() : "";

        JsonObject result = ok();
        result.addProperty("route", route);
        result.addProperty("sourceName", track.name().get());
        result.addProperty("sourceChannelId", track.channelId().get());

        switch (route) {
            case "channelDuplicate":
                track.duplicate();
                break;
            case "duplicateObject":
                track.duplicateObject();
                break;
            case "hostDuplicate":
                if (undoName.isEmpty()) {
                    host.duplicateObjects(new DuplicableObject[] { track });
                } else {
                    host.duplicateObjects(undoName, new DuplicableObject[] { track });
                    result.addProperty("undoName", undoName);
                }
                break;
            // A FOURTH route the E16 plan did not know about, found by walking
            // InsertionPoint rather than the duplicate-shaped names:
            // `InsertionPoint.copyTracks(Track…)`. It is the only route that says
            // WHERE the copy goes — every other one lands where Bitwig decides —
            // which is what a branch topology (row E3's groups, row F2's clutter)
            // would actually need. `anchorTrackIndex` is the track the copy lands
            // beside; it defaults to the source, reproducing "adjacent".
            case "copyTracksAfter":
            case "copyTracksBefore": {
                int anchorIndex = params.has("anchorTrackIndex")
                    ? params.get("anchorTrackIndex").getAsInt()
                    : params.get("trackIndex").getAsInt();
                Track anchor = requireTrack(anchorIndex);
                result.addProperty("anchorName", anchor.name().get());
                if ("copyTracksAfter".equals(route)) {
                    anchor.afterTrackInsertionPoint().copyTracks(new Track[] { track });
                } else {
                    anchor.beforeTrackInsertionPoint().copyTracks(new Track[] { track });
                }
                break;
            }
            default:
                throw new IllegalArgumentException("unknown duplication route: " + route);
        }
        return result;
    }

    /** Everything about a track's mixer strip that a duplicate could drop (row B5). */
    private JsonElement mixer(JsonObject params) {
        int index = params.get("trackIndex").getAsInt();
        Track track = requireTrack(index);
        JsonObject r = new JsonObject();
        r.addProperty("index", index);
        r.addProperty("name", track.name().get());
        r.addProperty("channelId", track.channelId().get());
        r.addProperty("position", track.position().get());
        r.addProperty("type", track.trackType().get());
        r.addProperty("isGroup", track.isGroup().get());
        r.addProperty("volume", track.volume().value().get());
        r.addProperty("volumeDisplayed", track.volume().value().displayedValue().get());
        r.addProperty("pan", track.pan().value().get());
        r.addProperty("mute", track.mute().get());
        r.addProperty("solo", track.solo().get());
        r.addProperty("mutedBySolo", track.isMutedBySolo().get());
        r.addProperty("activated", track.isActivated().get());
        r.addProperty("color", colorOf(track));

        JsonArray sends = new JsonArray();
        // Null when the rig was built with sends=0 — reading them is then simply
        // not on offer, and saying so beats a NullPointerException on the
        // control-surface thread (E16 / standing rule 3c).
        for (int s = 0; rig.sendBanks[index] != null && s < rig.config.sends; s++) {
            Send send = rig.sendBanks[index].getItemAt(s);
            if (!send.exists().get()) {
                continue;
            }
            JsonObject obj = new JsonObject();
            obj.addProperty("index", s);
            obj.addProperty("name", send.name().get());
            obj.addProperty("value", send.value().get());
            obj.addProperty("enabled", send.isEnabled().get());
            obj.addProperty("preFader", send.isPreFader().get());
            sends.add(obj);
        }
        r.add("sends", sends);
        r.addProperty("sendCount",
            rig.sendBanks[index] == null ? -1 : rig.sendBanks[index].itemCount().get());
        return r;
    }

    /**
     * Write mixer state — used to BUILD a fixture worth duplicating, and to A/B by mute.
     *
     * ⚠ `setImmediately`, never `set` (standing rule 3 / E4). Measured again here
     * and the scope is wider than E4 recorded: a plain `value().set()` on
     * **track volume, pan and sends** is swallowed exactly as it is on a device
     * parameter — the write acknowledges, the readback never moves. Volume, pan
     * and Send are all `Parameter`, so the take-over strategy owns them too;
     * `color()` and `mute()` are not, and they land with a plain `set`.
     */
    private JsonElement setMixer(JsonObject params) {
        int index = params.get("trackIndex").getAsInt();
        Track track = requireTrack(index);
        JsonObject r = ok();
        if (params.has("volume")) {
            track.volume().value().setImmediately(params.get("volume").getAsDouble());
            r.addProperty("volume", params.get("volume").getAsDouble());
        }
        if (params.has("pan")) {
            track.pan().value().setImmediately(params.get("pan").getAsDouble());
        }
        if (params.has("mute")) {
            track.mute().set(params.get("mute").getAsBoolean());
            r.addProperty("mute", params.get("mute").getAsBoolean());
        }
        if (params.has("solo")) {
            track.solo().set(params.get("solo").getAsBoolean());
        }
        if (params.has("activated")) {
            track.isActivated().set(params.get("activated").getAsBoolean());
        }
        if (params.has("color")) {
            JsonArray rgb = params.getAsJsonArray("color");
            if (rgb.size() < 3) {
                throw new IllegalArgumentException("color must be [r,g,b] in 0..1");
            }
            track.color().set(rgb.get(0).getAsFloat(), rgb.get(1).getAsFloat(), rgb.get(2).getAsFloat());
        }
        if (params.has("sendIndex")) {
            int sendIndex = params.get("sendIndex").getAsInt();
            if (rig.sendBanks[index] == null) {
                throw new IllegalArgumentException("rig was built with sends=0; no send bank exists");
            }
            if (sendIndex < 0 || sendIndex >= rig.config.sends) {
                throw new IllegalArgumentException("sendIndex out of bank range: " + sendIndex);
            }
            Send send = rig.sendBanks[index].getItemAt(sendIndex);
            if (params.has("sendValue")) {
                send.value().setImmediately(params.get("sendValue").getAsDouble());
            }
            if (params.has("sendEnabled")) {
                send.isEnabled().set(params.get("sendEnabled").getAsBoolean());
            }
            r.addProperty("sendIndex", sendIndex);
        }
        return r;
    }

    /**
     * The audibility oracle (rows E1/E2/E5).
     *
     * `now` is the last VU level Bitwig reported; `hold` is a peak that only
     * rises until reset. Arm with `{reset:true}`, do the thing, read `hold` —
     * that answers "did ANY signal appear on this track in that window", which
     * is what "is there a moment when both branches are audible" reduces to.
     */
    private JsonElement vu(JsonObject params) {
        boolean reset = params.has("reset") && params.get("reset").getAsBoolean();
        JsonArray tracks = new JsonArray();
        for (int i = 0; i < rig.config.tracks; i++) {
            Track track = rig.trackBank.getItemAt(i);
            if (!track.exists().get()) {
                continue;
            }
            JsonObject obj = new JsonObject();
            obj.addProperty("index", i);
            obj.addProperty("name", track.name().get());
            obj.addProperty("channelId", track.channelId().get());
            obj.addProperty("now", rig.vuNow[i]);
            obj.addProperty("hold", rig.vuHold[i]);
            obj.addProperty("mute", track.mute().get());
            obj.addProperty("mutedBySolo", track.isMutedBySolo().get());
            tracks.add(obj);
            if (reset) {
                rig.vuHold[i] = 0;
            }
        }
        JsonObject r = new JsonObject();
        r.add("tracks", tracks);
        r.addProperty("range", Rig.VU_RANGE);
        r.addProperty("reset", reset);
        r.addProperty("isPlaying", rig.transport.isPlaying().get());
        return r;
    }

    private static String colorOf(Track track) {
        return String.format("%.3f,%.3f,%.3f",
            track.color().red(), track.color().green(), track.color().blue());
    }
}
