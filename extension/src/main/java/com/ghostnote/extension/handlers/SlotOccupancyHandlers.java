package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.ClipLauncherSlotBank;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

/**
 * B19 session 2: every occupied Launcher slot of the track bank in one call.
 *
 * `slot.status` answers for one slot, one turn each (about 24 ms), and `batch.run` drops the results of read
 * ops, so a listing built from it grows with the slots scanned (E393: 172 empty-slot reads, 54 s). The rig marks
 * `exists` and `hasContent` interested on every slot at init, so this loop reads cached values only.
 *
 * The reply also carries the revision mark of the same handler run: the listing and its mark describe one
 * moment, with no event between them. `rig.scanTracks` is left unchanged; the E5 probes read its count reply.
 */
public final class SlotOccupancyHandlers extends HandlerGroup {
    /** Deliberate build marker for `rig.info`. */
    public static final String RULE = "slot.occupancy: tracks with occupied scene indices and the same-turn mark (B19)";

    /** The cached bank values that the scan reads. Separate so the scan has an offline test. */
    public interface Source {
        int tracks();
        int scenes();
        boolean exists(int track);
        String channelId(int track);
        String name(int track);
        int position(int track);
        String type(int track);
        boolean hasContent(int track, int scene);
    }

    public SlotOccupancyHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("slot.occupancy", params -> occupancy());
    }

    /**
     * Every existing track in bank order, each with the ascending scene indices whose slot has content. A track
     * with no clip has an empty `occupied` array, so the reply also lists the tracks that are wholly free.
     */
    public static JsonArray scan(Source source) {
        JsonArray tracks = new JsonArray();
        for (int i = 0; i < source.tracks(); i++) {
            if (!source.exists(i)) continue;
            JsonArray occupied = new JsonArray();
            for (int j = 0; j < source.scenes(); j++) {
                if (source.hasContent(i, j)) occupied.add(j);
            }
            JsonObject row = new JsonObject();
            row.addProperty("index", i);
            row.addProperty("channelId", source.channelId(i));
            row.addProperty("name", source.name(i));
            row.addProperty("position", source.position(i));
            row.addProperty("type", source.type(i));
            row.add("occupied", occupied);
            tracks.add(row);
        }
        return tracks;
    }

    private JsonObject occupancy() {
        long start = System.nanoTime();
        JsonArray tracks = scan(rigSource(rig));
        long scanMicros = (System.nanoTime() - start) / 1000;

        JsonObject result = new JsonObject();
        result.add("tracks", tracks);
        // The revision.get fields, from the same run as the scan. See BatchHandlers.revisionGet.
        result.addProperty("revision", state.revision);
        result.addProperty("generation", rig.epochGeneration);
        String project = "";
        try {
            if (rig.projectName != null) project = rig.projectName.get();
        } catch (Throwable ignored) {
            // Left empty: the brain treats an unnameable project as unknown.
        }
        result.addProperty("project", project == null ? "" : project);
        result.addProperty("projectStatus", rig.projectStatus);
        result.addProperty("sceneEpoch", rig.sceneCountChanges);
        result.addProperty("sceneCount", rig.lastSceneCount);
        result.addProperty("contentEpoch", rig.launcherContentEpoch);
        result.add("unpinnedCursorTracks", rig.unpinnedCursorTracks());
        // The track.list overflow pair: itemCount is the project total, bankSize the window.
        result.addProperty("itemCount", rig.trackBank.itemCount().get());
        result.addProperty("bankSize", rig.config.tracks);
        result.addProperty("sceneBankSize", rig.config.scenes);
        result.addProperty("scanMicros", scanMicros);
        return result;
    }

    private static Source rigSource(Rig rig) {
        return new Source() {
            private Track track(int i) { return rig.trackBank.getItemAt(i); }
            private ClipLauncherSlotBank slots(int i) { return track(i).clipLauncherSlotBank(); }
            public int tracks() { return rig.config.tracks; }
            public int scenes() { return rig.config.scenes; }
            public boolean exists(int i) { return track(i).exists().get(); }
            public String channelId(int i) { return track(i).channelId().get(); }
            public String name(int i) { return track(i).name().get(); }
            public int position(int i) { return track(i).position().get(); }
            public String type(int i) { return track(i).trackType().get(); }
            public boolean hasContent(int i, int j) { return slots(i).getItemAt(j).hasContent().get(); }
        };
    }
}
