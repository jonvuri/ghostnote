package com.ghostnote.extension;

import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.Track;
import com.bitwig.extension.controller.api.TrackBank;
import com.bitwig.extension.controller.api.TrackBankContentFilter;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Read direct group membership in a bounded research scope. */
public final class ShadowTopologyControl {
    public static final String REVISION = "8g4-direct-membership-v1";
    public static final int MAX_TRACKS = 16;
    private static final Gson JSON = new Gson();
    record Row(int index, String channelId, String name, int position, boolean isGroup, boolean expanded) { }
    record Bank(int count, int offset, List<String> ids) { }
    record Tree(List<Row> flat, Bank roots, Map<String, Bank> children) { }
    interface Source { Tree read(); }
    private final Source source;
    private long sequence;
    private Runnable listener = () -> { };

    public ShadowTopologyControl(ControllerHost host, Rig rig) {
        int size = Math.min(MAX_TRACKS, rig.config.tracks);
        TrackBank roots = host.createTrackBank(size, 0, 0, false);
        roots.setContentFilter(TrackBankContentFilter.TOP_LEVEL_CHANNELS);
        mark(roots, size);
        TrackBank[] children = new TrackBank[size];
        for (int index = 0; index < size; index++) {
            Track track = rig.trackBank.getItemAt(index);
            track.exists().addValueObserver(v -> changed()); track.channelId().addValueObserver(v -> changed());
            track.position().addValueObserver(v -> changed()); track.isGroup().addValueObserver(v -> changed());
            track.isGroupExpanded().addValueObserver(v -> changed());
            children[index] = track.createTrackBank(size, 0, 0, false);
            children[index].setContentFilter(TrackBankContentFilter.TOP_LEVEL_CHANNELS);
            mark(children[index], size);
        }
        rig.trackBank.itemCount().addValueObserver(v -> changed());
        rig.trackBank.scrollPosition().markInterested();
        rig.trackBank.scrollPosition().addValueObserver(v -> changed());
        source = () -> {
            if (!"ALL_CHANNELS".equals(rig.contentFilterApplied)) throw new IllegalStateException("flat-topology-filter-unproved");
            int count = rig.trackBank.itemCount().get(), offset = rig.trackBank.scrollPosition().get();
            if (count < 0 || count > size || offset != 0) throw new IllegalStateException("flat-topology-window-incomplete");
            List<Row> flat = new ArrayList<>(); Map<String, Bank> direct = new java.util.LinkedHashMap<>();
            for (int index = 0; index < size; index++) {
                Track track = rig.trackBank.getItemAt(index);
                if (track.exists().get() != (index < count)) throw new IllegalStateException("flat-topology-existence-changed");
                if (index >= count) continue;
                Row row = new Row(index, track.channelId().get(), track.name().get(), track.position().get(),
                    track.isGroup().get(), track.isGroupExpanded().get());
                flat.add(row);
                if (row.isGroup()) direct.put(row.channelId(), readBank(children[index], size));
            }
            Bank root = readBank(roots, size);
            if (count != rig.trackBank.itemCount().get() || offset != rig.trackBank.scrollPosition().get())
                throw new IllegalStateException("flat-topology-count-changed");
            return new Tree(flat, root, direct);
        };
    }
    ShadowTopologyControl(Source source) { this.source = source; }
    public void addInvalidationListener(Runnable listener) { this.listener = java.util.Objects.requireNonNull(listener); }
    void changed() { sequence = Math.incrementExact(sequence); listener.run(); }
    private void mark(TrackBank bank, int size) {
        bank.itemCount().markInterested(); bank.scrollPosition().markInterested();
        bank.itemCount().addValueObserver(v -> changed()); bank.scrollPosition().addValueObserver(v -> changed());
        for (int index = 0; index < size; index++) {
            Track track = bank.getItemAt(index);
            track.exists().markInterested(); track.channelId().markInterested();
            track.exists().addValueObserver(v -> changed()); track.channelId().addValueObserver(v -> changed());
        }
    }
    private static Bank readBank(TrackBank bank, int size) {
        int count = bank.itemCount().get(), offset = bank.scrollPosition().get(); List<String> ids = new ArrayList<>();
        if (count < 0 || count > size || offset != 0) throw new IllegalStateException("direct-topology-window-incomplete");
        for (int index = 0; index < size; index++) {
            Track track = bank.getItemAt(index);
            if (track.exists().get() != (index < count)) throw new IllegalStateException("direct-topology-existence-changed");
            if (index < count) ids.add(track.channelId().get());
        }
        if (count != bank.itemCount().get() || offset != bank.scrollPosition().get())
            throw new IllegalStateException("direct-topology-count-changed");
        return new Bank(count, offset, List.copyOf(ids));
    }
    /** Every flat track must have one parent or be a root. Reject cycles and unknown children. */
    static void validate(Tree tree) {
        if (tree.flat().size() > MAX_TRACKS) throw new IllegalStateException("topology-capacity");
        Map<String, Row> rows = new HashMap<>();
        for (int index = 0; index < tree.flat().size(); index++) {
            Row row = tree.flat().get(index);
            if (row.index() != index || row.channelId() == null || row.channelId().isBlank()
                || rows.put(row.channelId(), row) != null) throw new IllegalStateException("topology-flat-address");
        }
        Map<String, String> parent = new HashMap<>(); Set<String> members = new HashSet<>();
        validateBank(tree.roots());
        for (String id : tree.roots().ids()) {
            if (!rows.containsKey(id) || !members.add(id)) throw new IllegalStateException("topology-root-address");
        }
        Set<String> groups = new HashSet<>();
        for (Row row : tree.flat()) if (row.isGroup()) groups.add(row.channelId());
        if (!groups.equals(tree.children().keySet())) throw new IllegalStateException("topology-groups-omitted");
        for (var entry : tree.children().entrySet()) {
            validateBank(entry.getValue());
            for (String id : entry.getValue().ids()) {
                if (!rows.containsKey(id) || !members.add(id)) throw new IllegalStateException("topology-child-address");
                parent.put(id, entry.getKey());
            }
        }
        if (!members.equals(rows.keySet())) throw new IllegalStateException("topology-descendants-omitted");
        for (String id : rows.keySet()) {
            Set<String> seen = new HashSet<>(); String current = id;
            while (current != null) {
                if (!seen.add(current)) throw new IllegalStateException("topology-cycle");
                current = parent.get(current);
            }
        }
    }
    private static void validateBank(Bank bank) {
        if (bank.offset() != 0 || bank.count() < 0 || bank.count() > MAX_TRACKS || bank.count() != bank.ids().size())
            throw new IllegalStateException("topology-bank-incomplete");
    }
    public JsonObject snapshot() {
        JsonObject result = new JsonObject(); long before = sequence;
        result.addProperty("topologyControlRevision", REVISION); result.addProperty("researchOnly", true);
        result.addProperty("complete", false); result.addProperty("eligible", false);
        result.addProperty("hostInputOrderingProved", false); result.addProperty("maximumTracks", MAX_TRACKS);
        result.addProperty("oracle", "direct-child-banks"); result.addProperty("sequenceBeforeRead", before);
        boolean valid = false;
        try {
            Tree tree = source.read(); result.add("tree", JSON.toJsonTree(tree)); validate(tree);
            // A second independent read catches changed addresses and membership without a delivered callback.
            Tree checked = source.read(); validate(checked);
            if (!tree.equals(checked)) throw new IllegalStateException("topology-read-changed");
            if (sequence != before) throw new IllegalStateException("topology-callback-window-changed");
            valid = true;
        } catch (RuntimeException error) { result.addProperty("reason", error.getMessage()); result.addProperty("readError", error.toString()); }
        result.addProperty("sequenceAfterRead", sequence); result.addProperty("callbacksChangedDuringRead", sequence != before);
        result.addProperty("membershipComplete", valid); result.addProperty("coherent", valid);
        result.addProperty("groupMembershipProved", valid); result.addProperty("wrapperDeletionAllowed", false);
        if (valid) result.addProperty("reason", "bounded-direct-membership");
        return result;
    }
}
