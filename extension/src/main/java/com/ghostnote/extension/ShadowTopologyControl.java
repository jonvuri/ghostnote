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
    public static final int MAX_TRACKS = 512;
    public static final String CANDIDATE_REVISION = "8g5a-topology-candidates-v1";
    private static final Gson JSON = new Gson();
    record Row(int index, String channelId, String name, int position, boolean isGroup, boolean expanded) { }
    record Bank(int count, int offset, List<String> ids) { }
    record Tree(List<Row> flat, Bank roots, Map<String, Bank> children) { }
    record GroupCount(int count, int offset, boolean exists, Row master) { }
    interface Source { Tree read(); }
    private final Source source;
    private final Supplier<JsonObject> candidates;
    private final int scopeSize;
    private final JsonObject allocation;
    private final boolean countedRoute;
    private long sequence;
    private Runnable listener = () -> { };

    public ShadowTopologyControl(ControllerHost host, Rig rig) {
        long started = System.nanoTime();
        JsonObject before = jvmMemory();
        int size = rig.config.topologyTracks();
        if (size == 0) throw new IllegalArgumentException("topology allocation is disabled");
        scopeSize = size;
        countedRoute = rig.config.cacheTopologyCounted;
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
            children[index] = track.createTrackBank(countedRoute ? 1 : size, 0, 0, false);
            children[index].setContentFilter(TrackBankContentFilter.TOP_LEVEL_CHANNELS);
            mark(children[index], countedRoute ? 1 : size);
            if (!countedRoute) {
                parents[index] = track.createParentTrack(0, 0);
                markTrack(parents[index]);
            }
        }
        rig.trackBank.itemCount().addValueObserver(v -> changed());
        rig.trackBank.scrollPosition().markInterested();
        rig.trackBank.scrollPosition().addValueObserver(v -> changed());
        int[] requestedOffsets = new int[size]; java.util.Arrays.fill(requestedOffsets, -1);
        source = () -> {
            if (!"ALL_CHANNELS".equals(rig.contentFilterApplied)) throw new IllegalStateException("flat-topology-filter-unproved");
            int count = rig.trackBank.itemCount().get(), offset = rig.trackBank.scrollPosition().get();
            if (count < 0 || count > size || offset != 0) throw new IllegalStateException("flat-topology-window-incomplete");
            List<Row> flat = new ArrayList<>(); Map<String, Bank> direct = new java.util.LinkedHashMap<>();
            Map<String, GroupCount> counts = new java.util.LinkedHashMap<>(); boolean warming = false;
            for (int index = 0; index < size; index++) {
                Track track = rig.trackBank.getItemAt(index);
                if (track.exists().get() != (index < count)) throw new IllegalStateException("flat-topology-existence-changed");
                if (index >= count) continue;
                Row row = new Row(index, track.channelId().get(), track.name().get(), track.position().get(),
                    track.isGroup().get(), track.isGroupExpanded().get());
                flat.add(row);
                if (row.isGroup()) {
                    if (countedRoute) {
                        TrackBank bank = children[index];
                        if (!prepareMasterWindow(bank, size, requestedOffsets, index)) warming = true;
                        counts.put(row.channelId(), readGroupCount(bank));
                    } else {
                        JsonObject raw = readRows(children[index], size);
                        List<Row> rows = new ArrayList<>();
                        for (var value : raw.getAsJsonArray("rows")) rows.add(JSON.fromJson(value, Row.class));
                        direct.put(row.channelId(), directChildren(readBank(children[index], size), rows, row));
                    }
                }
            }
            Bank root = readBank(roots, size);
            if (count != rig.trackBank.itemCount().get() || offset != rig.trackBank.scrollPosition().get())
                throw new IllegalStateException("flat-topology-count-changed");
            if (warming) throw new IllegalStateException("topology-master-window-warming");
            if (countedRoute) return countedTree(flat, root, counts, size);
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
                if (countedRoute) {
                    if (track.isGroup().get()) direct.add(id, JSON.toJsonTree(readGroupCount(children[index])));
                    continue;
                }
                JsonObject parent = new JsonObject();
                boolean exists = parents[index].exists().get(); parent.addProperty("exists", exists);
                if (exists) parent.add("row", JSON.toJsonTree(readRow(parents[index], index)));
                parentRows.add(id, parent);
                if (track.isGroup().get()) direct.add(id, JSON.toJsonTree(readRows(children[index], size)));
            }
            result.add("parents", parentRows); result.add("children", direct);
            return result;
        };
        allocation = new JsonObject();
        allocation.add("before", before); allocation.add("after", jvmMemory());
        allocation.addProperty("constructionMs", (System.nanoTime() - started) / 1_000_000.0);
    }
    ShadowTopologyControl(Source source) { this(source, null); }
    ShadowTopologyControl(Source source, Supplier<JsonObject> candidates) {
        this(source, candidates, MAX_TRACKS);
    }
    ShadowTopologyControl(Source source, Supplier<JsonObject> candidates, int capacity) {
        if (capacity < 1 || capacity > 512) throw new IllegalArgumentException("invalid topology capacity");
        this.source = source; this.candidates = candidates; scopeSize = capacity; allocation = new JsonObject();
        countedRoute = false;
    }
    public int capacity() { return scopeSize; }
    /** Source estimate for the controller wrapper, two reference arrays, and requested offsets. */
    public long bookkeepingEstimatedBytes() { return 304L + 20L * scopeSize; }
    /** Read the shared JVM. These values do not measure extension or host allocation. */
    public static JsonObject jvmMemory() {
        Runtime runtime = Runtime.getRuntime();
        long committed = runtime.totalMemory(), free = runtime.freeMemory();
        JsonObject result = new JsonObject();
        result.addProperty("capturedEpochMs", System.currentTimeMillis());
        result.addProperty("usedBytes", committed - free); result.addProperty("committedBytes", committed);
        result.addProperty("maximumBytes", runtime.maxMemory()); result.addProperty("scope", "shared-jvm");
        result.addProperty("forcedGc", false);
        return result;
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
    private static GroupCount readGroupCount(TrackBank bank) {
        Track master = bank.getItemAt(0); boolean exists = master.exists().get();
        return new GroupCount(bank.itemCount().get(), bank.scrollPosition().get(), exists,
            exists ? readRow(master, 0) : null);
    }
    /** Request each new master offset once. A pending window cannot admit membership. */
    static boolean prepareMasterWindow(TrackBank bank, int capacity, int[] requested, int index) {
        int count = bank.itemCount().get();
        if (count < 1 || count > capacity) throw new IllegalStateException("topology-child-count-incomplete");
        int target = count - 1;
        if (bank.scrollPosition().get() == target) return true;
        if (requested[index] != target) {
            requested[index] = target; bank.scrollPosition().set(target);
        }
        return false;
    }
    /** Preorder and each direct degree determine one ordered forest. UUIDs come from the flat bank. */
    static Tree countedTree(List<Row> flat, Bank roots, Map<String, GroupCount> counts, int capacity) {
        if (flat.size() > capacity) throw new IllegalStateException("topology-capacity");
        Set<String> groups = new HashSet<>();
        for (Row row : flat) if (row.isGroup()) groups.add(row.channelId());
        if (!groups.equals(counts.keySet())) throw new IllegalStateException("topology-groups-omitted");
        Map<String, List<String>> ids = new java.util.LinkedHashMap<>();
        var owners = new java.util.ArrayDeque<String>(); var remaining = new java.util.ArrayDeque<Integer>();
        List<String> rootIds = new ArrayList<>();
        for (Row row : flat) {
            while (!remaining.isEmpty() && remaining.peek() == 0) { remaining.pop(); owners.pop(); }
            if (owners.isEmpty()) rootIds.add(row.channelId());
            else {
                ids.get(owners.peek()).add(row.channelId());
                remaining.push(remaining.pop() - 1);
            }
            if (row.isGroup()) {
                GroupCount count = counts.get(row.channelId()); Row master = count.master();
                if (count.count() < 1 || count.count() > capacity || count.offset() != count.count() - 1
                    || !count.exists() || master == null || master.index() != 0
                    || !row.channelId().equals(master.channelId()) || master.isGroup() || master.expanded())
                    throw new IllegalStateException("topology-counted-master-unproved");
                ids.put(row.channelId(), new ArrayList<>());
                owners.push(row.channelId()); remaining.push(count.count() - 1);
            }
        }
        while (!remaining.isEmpty() && remaining.peek() == 0) { remaining.pop(); owners.pop(); }
        if (!remaining.isEmpty()) throw new IllegalStateException("topology-descendants-omitted");
        if (!rootIds.equals(roots.ids())) throw new IllegalStateException("topology-counted-roots-disagree");
        Map<String, Bank> children = new java.util.LinkedHashMap<>();
        ids.forEach((id, values) -> children.put(id, new Bank(values.size(), 0, List.copyOf(values))));
        Tree tree = new Tree(List.copyOf(flat), roots, children); validate(tree, capacity); return tree;
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
        result.addProperty("bankTrackHandles", countedRoute ? 2 * scopeSize : (1 + scopeSize) * scopeSize);
        result.addProperty("parentTrackHandles", countedRoute ? 0 : scopeSize); result.addProperty("stepDataObservers", 0);
        result.addProperty("heapMeasured", false); result.addProperty("hostMemoryMeasured", false);
        result.addProperty("selectedRoute", route());
        result.addProperty("bookkeepingEstimatedBytes", bookkeepingEstimatedBytes());
        result.addProperty("parentHandlesDiagnosticOnly", !countedRoute);
        result.add("allocationMeasurement", allocation.deepCopy());
        return result;
    }
    private String route() {
        return countedRoute ? "counted-preorder-with-uuid-master" : "direct-child-banks-with-uuid-group-master";
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
        validate(tree, MAX_TRACKS);
    }
    static void validate(Tree tree, int capacity) {
        if (tree.flat().size() > capacity) throw new IllegalStateException("topology-capacity");
        Map<String, Row> rows = new HashMap<>();
        for (int index = 0; index < tree.flat().size(); index++) {
            Row row = tree.flat().get(index);
            if (row.index() != index || row.channelId() == null || row.channelId().isBlank()
                || rows.put(row.channelId(), row) != null) throw new IllegalStateException("topology-flat-address");
        }
        Map<String, String> parent = new HashMap<>(); Set<String> members = new HashSet<>();
        validateBank(tree.roots(), capacity);
        for (String id : tree.roots().ids()) {
            if (!rows.containsKey(id) || !members.add(id)) throw new IllegalStateException("topology-root-address");
        }
        Set<String> groups = new HashSet<>();
        for (Row row : tree.flat()) if (row.isGroup()) groups.add(row.channelId());
        if (!groups.equals(tree.children().keySet())) throw new IllegalStateException("topology-groups-omitted");
        for (var entry : tree.children().entrySet()) {
            validateBank(entry.getValue(), capacity);
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
        validateBank(bank, 512);
    }
    private static void validateBank(Bank bank, int capacity) {
        if (bank.offset() != 0 || bank.count() < 0 || bank.count() > capacity || bank.count() != bank.ids().size())
            throw new IllegalStateException("topology-bank-incomplete");
    }
    public JsonObject snapshot() {
        JsonObject result = new JsonObject(); long before = sequence, started = System.nanoTime();
        result.addProperty("topologyControlRevision", countedRoute ? "8g5c-counted-preorder-v1" : REVISION);
        result.addProperty("researchOnly", true);
        result.addProperty("complete", false); result.addProperty("eligible", false);
        result.addProperty("hostInputOrderingProved", false); result.addProperty("maximumTracks", scopeSize);
        result.addProperty("oracle", route()); result.addProperty("sequenceBeforeRead", before);
        boolean valid = false;
        try {
            Tree tree = source.read(); result.add("tree", JSON.toJsonTree(tree)); validate(tree, scopeSize);
            // A second independent read catches changed addresses and membership without a delivered callback.
            Tree checked = source.read(); validate(checked, scopeSize);
            if (!tree.equals(checked)) throw new IllegalStateException("topology-read-changed");
            if (sequence != before) throw new IllegalStateException("topology-callback-window-changed");
            valid = true;
        } catch (RuntimeException error) { result.addProperty("reason", error.getMessage()); result.addProperty("readError", error.toString()); }
        result.addProperty("sequenceAfterRead", sequence); result.addProperty("callbacksChangedDuringRead", sequence != before);
        result.addProperty("membershipComplete", valid); result.addProperty("coherent", valid);
        result.addProperty("groupMembershipProved", valid); result.addProperty("wrapperDeletionAllowed", false);
        if (valid) result.addProperty("reason", countedRoute ? "bounded-counted-preorder-membership" : "bounded-uuid-group-master-membership");
        result.addProperty("readMs", (System.nanoTime() - started) / 1_000_000.0);
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
