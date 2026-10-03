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
import java.util.function.Supplier;

/** Read direct group membership in a bounded research scope. */
public final class ShadowTopologyControl {
    public static final String REVISION = "8g5a-uuid-group-master-v1";
    public static final int MAX_TRACKS = 16;
    public static final String CANDIDATE_REVISION = "8g5a-topology-candidates-v1";
    private static final Gson JSON = new Gson();
    record Row(int index, String channelId, String name, int position, boolean isGroup, boolean expanded) { }
    record Bank(int count, int offset, List<String> ids) { }
    record Tree(List<Row> flat, Bank roots, Map<String, Bank> children) { }
    interface Source { Tree read(); }
    private final Source source;
    private final Supplier<JsonObject> candidates;
    private final int scopeSize;
    private long sequence;
    private Runnable listener = () -> { };

    public ShadowTopologyControl(ControllerHost host, Rig rig) {
        int size = Math.min(MAX_TRACKS, rig.config.tracks);
        scopeSize = size;
        TrackBank roots = host.createTrackBank(size, 0, 0, false);
        roots.setContentFilter(TrackBankContentFilter.TOP_LEVEL_CHANNELS);
        mark(roots, size);
        TrackBank[] children = new TrackBank[size];
        Track[] parents = new Track[size];
        for (int index = 0; index < size; index++) {
            Track track = rig.trackBank.getItemAt(index);
            track.exists().addValueObserver(v -> changed()); track.channelId().addValueObserver(v -> changed());
            track.position().addValueObserver(v -> changed()); track.isGroup().addValueObserver(v -> changed());
            track.isGroupExpanded().addValueObserver(v -> changed());
            children[index] = track.createTrackBank(size, 0, 0, false);
            children[index].setContentFilter(TrackBankContentFilter.TOP_LEVEL_CHANNELS);
            mark(children[index], size);
            parents[index] = track.createParentTrack(0, 0);
            markTrack(parents[index]);
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
                if (row.isGroup()) {
                    JsonObject raw = readRows(children[index], size);
                    List<Row> rows = new ArrayList<>();
                    for (var value : raw.getAsJsonArray("rows")) rows.add(JSON.fromJson(value, Row.class));
                    direct.put(row.channelId(), directChildren(readBank(children[index], size), rows, row));
                }
            }
            Bank root = readBank(roots, size);
            if (count != rig.trackBank.itemCount().get() || offset != rig.trackBank.scrollPosition().get())
                throw new IllegalStateException("flat-topology-count-changed");
            return new Tree(flat, root, direct);
        };
        candidates = () -> {
            JsonObject result = new JsonObject();
            result.add("flat", JSON.toJsonTree(readRows(rig.trackBank, size)));
            result.add("roots", JSON.toJsonTree(readRows(roots, size)));
            JsonObject direct = new JsonObject(), parentRows = new JsonObject();
            for (int index = 0; index < size; index++) {
                Track track = rig.trackBank.getItemAt(index);
                if (!track.exists().get()) continue;
                String id = track.channelId().get();
                JsonObject parent = new JsonObject();
                boolean exists = parents[index].exists().get(); parent.addProperty("exists", exists);
                if (exists) parent.add("row", JSON.toJsonTree(readRow(parents[index], index)));
                parentRows.add(id, parent);
                if (track.isGroup().get()) direct.add(id, JSON.toJsonTree(readRows(children[index], size)));
            }
            result.add("parents", parentRows); result.add("children", direct);
            return result;
        };
    }
    ShadowTopologyControl(Source source) { this(source, null); }
    ShadowTopologyControl(Source source, Supplier<JsonObject> candidates) {
        this.source = source; this.candidates = candidates; scopeSize = MAX_TRACKS;
    }
    public void addInvalidationListener(Runnable listener) { this.listener = java.util.Objects.requireNonNull(listener); }
    void changed() { sequence = Math.incrementExact(sequence); listener.run(); }
    /** Count of delivered topology callbacks. It makes no host read. */
    public long sequence() { return sequence; }
    private void mark(TrackBank bank, int size) {
        bank.itemCount().markInterested(); bank.scrollPosition().markInterested();
        bank.itemCount().addValueObserver(v -> changed()); bank.scrollPosition().addValueObserver(v -> changed());
        for (int index = 0; index < size; index++) {
            Track track = bank.getItemAt(index);
            markTrack(track);
        }
    }
    private void markTrack(Track track) {
        track.exists().markInterested(); track.channelId().markInterested(); track.name().markInterested();
        track.position().markInterested(); track.isGroup().markInterested(); track.isGroupExpanded().markInterested();
        track.exists().addValueObserver(v -> changed()); track.channelId().addValueObserver(v -> changed());
        track.position().addValueObserver(v -> changed()); track.isGroup().addValueObserver(v -> changed());
        track.isGroupExpanded().addValueObserver(v -> changed());
    }
    private static Row readRow(Track track, int index) {
        return new Row(index, track.channelId().get(), track.name().get(), track.position().get(),
            track.isGroup().get(), track.isGroupExpanded().get());
    }
    private static JsonObject readRows(TrackBank bank, int size) {
        Bank address = readBank(bank, size); List<Row> rows = new ArrayList<>();
        for (int index = 0; index < address.count(); index++) rows.add(readRow(bank.getItemAt(index), index));
        JsonObject result = JSON.toJsonTree(address).getAsJsonObject(); result.add("rows", JSON.toJsonTree(rows));
        if (!address.equals(readBank(bank, size))) throw new IllegalStateException("candidate-bank-changed");
        return result;
    }
    /** These counts exclude the existing flat bank. Heap and host memory are not measured. */
    public JsonObject resources() {
        JsonObject result = new JsonObject();
        result.addProperty("maximumTracks", scopeSize); result.addProperty("banks", 1 + scopeSize);
        result.addProperty("bankTrackHandles", (1 + scopeSize) * scopeSize);
        result.addProperty("parentTrackHandles", scopeSize); result.addProperty("stepDataObservers", 0);
        result.addProperty("heapMeasured", false); result.addProperty("hostMemoryMeasured", false);
        result.addProperty("selectedRoute", "direct-child-banks-with-uuid-group-master");
        result.addProperty("parentHandlesDiagnosticOnly", true);
        return result;
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
    /** E221 identifies the group master by UUID. Its position and name are not keys. */
    static Bank directChildren(Bank raw, List<Row> rows, Row owner) {
        validateBank(raw);
        if (!owner.isGroup() || rows.size() != raw.count()) throw new IllegalStateException("topology-group-master-shape");
        int self = 0; List<String> ids = new ArrayList<>();
        for (int index = 0; index < rows.size(); index++) {
            Row row = rows.get(index);
            if (row.index() != index || !raw.ids().get(index).equals(row.channelId()))
                throw new IllegalStateException("topology-group-master-address");
            if (owner.channelId().equals(row.channelId())) {
                self++;
                if (row.isGroup() || row.expanded()) throw new IllegalStateException("topology-group-master-shape");
            } else ids.add(row.channelId());
        }
        if (self != 1) throw new IllegalStateException("topology-group-master-count");
        return new Bank(ids.size(), 0, List.copyOf(ids));
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
        List<String> preorder = new ArrayList<>();
        for (String root : tree.roots().ids()) appendPreorder(root, tree.children(), preorder);
        if (!preorder.equals(tree.flat().stream().map(Row::channelId).toList()))
            throw new IllegalStateException("topology-flat-order");
    }
    private static void appendPreorder(String id, Map<String, Bank> children, List<String> order) {
        order.add(id);
        Bank bank = children.get(id);
        if (bank != null) for (String child : bank.ids()) appendPreorder(child, children, order);
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
        result.addProperty("oracle", "direct-child-banks-with-uuid-group-master"); result.addProperty("sequenceBeforeRead", before);
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
        if (valid) result.addProperty("reason", "bounded-uuid-group-master-membership");
        return result;
    }
    /** Run candidate measurements only for an explicit research read. */
    public JsonObject measurementSnapshot() {
        JsonObject result = snapshot();
        // Candidate reads cannot admit membership or change the existing graph rule.
        if (candidates != null) result.add("candidates", candidateSnapshot());
        if (sequence != result.get("sequenceBeforeRead").getAsLong()) {
            result.addProperty("sequenceAfterRead", sequence); result.addProperty("callbacksChangedDuringRead", true);
            result.addProperty("membershipComplete", false); result.addProperty("coherent", false);
            result.addProperty("groupMembershipProved", false); result.addProperty("reason", "topology-callback-window-changed");
        }
        return result;
    }
    private JsonObject candidateSnapshot() {
        JsonObject result = new JsonObject(); long before = sequence;
        result.addProperty("revision", CANDIDATE_REVISION); result.addProperty("complete", false);
        result.addProperty("eligible", false); result.addProperty("routeProved", false);
        result.addProperty("sequenceBeforeRead", before); result.add("resources", resources());
        boolean coherent = false;
        try {
            JsonObject first = candidates.get(); result.add("first", first);
            JsonObject second = candidates.get(); result.add("second", second);
            if (!first.equals(second)) throw new IllegalStateException("candidate-read-changed");
            if (sequence != before) throw new IllegalStateException("candidate-callback-window-changed");
            coherent = true;
        } catch (RuntimeException error) { result.addProperty("readError", error.toString()); }
        result.addProperty("coherent", coherent); result.addProperty("sequenceAfterRead", sequence);
        return result;
    }
}
