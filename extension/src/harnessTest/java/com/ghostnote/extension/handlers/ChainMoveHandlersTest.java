package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Bridge;
import com.ghostnote.extension.ContainerScopes;
import com.ghostnote.extension.RuntimeProfile;
import com.ghostnote.extension.WindowPager;
import com.ghostnote.extension.WriteGate;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

/** Registered relocation handler, real scope/gate/window code, and independently mutable host state. */
public final class ChainMoveHandlersTest {
    private static int groups;
    private static final class Layer {
        final String id;
        final List<String> devices = new ArrayList<>();
        Layer(String id) { this.id = id; for (int i = 0; i < 10; i++) devices.add(id + "-device-" + i); }
    }
    private static final class Container {
        final String name;
        final List<Layer> layers = new ArrayList<>();
        Container(String name) { this.name = name; for (int i = 0; i < 11; i++) layers.add(new Layer(name + "-" + i)); }
    }
    private static final class Model implements ChainMoveHandlers.Host, ContainerScopes.Scopes {
        final ArrayDeque<Runnable> tasks = new ArrayDeque<>();
        final List<Container> top = new ArrayList<>();
        final List<String> events = new ArrayList<>();
        final WriteGate gate = new WriteGate(tasks::add, () -> 0L, 8);
        final ContainerScopes scopes = new ContainerScopes(this);
        final HandlerRegistry registry = new HandlerRegistry(RuntimeProfile.NORMAL, gate);
        final int[] wanted = {0, 1, 2}, reported = {0, 1, 2};
        final Bank[] layers = new Bank[3];
        final Bank[][] devices = new Bank[3][5];
        final Bank topBank;
        String track = "track";
        int writes, stalePages;
        boolean noOp, throwAfterWrite, failDeviceRestore, failLayerRestore, stuck, corruptSource;
        Model() {
            for (int i = 0; i < 3; i++) top.add(new Container("container-" + i));
            for (int slot = 0; slot < 3; slot++) {
                layers[slot] = new Bank(slot, -1);
                for (int local = 0; local < 5; local++) devices[slot][local] = new Bank(slot, local);
            }
            topBank = new Bank(-1, -1);
            refresh();
            new ChainMoveHandlers(this).register(registry, (params, reply) -> {
                throw new IllegalArgumentException("legacy route");
            });
        }
        public ContainerScopes scopes() { return scopes; }
        public String track() { return track; }
        public int topCount() { return top.size(); }
        public WindowPager.Window topWindow() { return topBank; }
        public WindowPager.Window layers(int slot) { return layers[slot]; }
        public String containerName(int slot) { return top.get(reported[slot]).name; }
        public WindowPager.Window devices(ChainMoveHandlers.Endpoint endpoint) {
            return endpoint.top() ? topBank : devices[endpoint.slot][endpoint.local];
        }
        public boolean ready(ChainMoveHandlers.Endpoint endpoint, int position, String expected, boolean after) {
            if (!track.equals(expected)) throw new IllegalStateException("track changed");
            if (endpoint.top()) return true;
            if (after && (wanted[endpoint.slot] != position || !settled(endpoint.slot))) scroll(endpoint.slot, position);
            return wanted[endpoint.slot] == position && settled(endpoint.slot);
        }
        Layer layer(int slot, int local) { return top.get(reported[slot]).layers.get(layers[slot].position + local); }
        public void transfer(ChainMoveHandlers.Endpoint src, int local, ChainMoveHandlers.Endpoint dst, String verb, String where) {
            check(gate.leases() > 0 && scopes.open(), "writer holds lease");
            if (!src.top() && !dst.top() && src.position == dst.position) check(src.slot != dst.slot, "independent same-container handles");
            for (var endpoint : new ChainMoveHandlers.Endpoint[] {src, dst}) if (!endpoint.top()) {
                check(layer(endpoint.slot, endpoint.local).id.equals(endpoint.id), "both endpoint identities held at write");
                check(layers[endpoint.slot].seenPosition == layers[endpoint.slot].position, "settled chain observer");
            }
            Bank bank = (Bank) devices(src);
            check(bank.position == bank.seenPosition && local >= 0 && local < bank.width(), "settled source device handle");
            String name = src.top() ? top.get(bank.position + local).name : layer(src.slot, src.local).devices.get(bank.position + local);
            check(name.equals(bank.seen.get(local).getAsJsonObject().get("name").getAsString()), "source observed before index shift");
            writes++; events.add("write:" + name);
            if (noOp) return;
            Layer destination = dst.top() ? null : layer(dst.slot, dst.local);
            if (verb.equals("move")) {
                if (src.top()) top.remove(bank.position + local); else layer(src.slot, src.local).devices.remove(bank.position + local);
            }
            if (destination == null) top.add(where.equals("chainStart") ? 0 : top.size(), new Container(name));
            else destination.devices.add(where.equals("chainStart") ? 0 : destination.devices.size(), name);
            tasks.add(this::refresh);
            if (throwAfterWrite) throw new IllegalStateException("uncertain host transfer");
        }
        public void schedule(Runnable task, int ms) { tasks.add(task); }
        public void blockWrites(String reason) { events.add("block"); gate.blockWrites(reason); }
        public int scopeCount() { return 3; }
        public int deviceBank() { return 16; }
        public boolean held(int slot) { return true; }
        public int requestedPosition(int slot) { return wanted[slot]; }
        public boolean settled(int slot) { return wanted[slot] == reported[slot]; }
        public void scroll(int slot, int position) {
            wanted[slot] = position;
            tasks.add(() -> { reported[slot] = position; tasks.add(this::refresh); });
        }
        public int deviceCount() { return top.size(); }
        public String trackChannelId() { return track; }
        public String describe(int slot) { return "scope " + slot; }
        public String scopeStatus(int slot) { return "held"; }
        public WriteGate.Lease writeLease() { return gate.writeLease(); }
        void refresh() {
            for (int slot = 0; slot < 3; slot++) {
                layers[slot].refresh();
                for (Bank bank : devices[slot]) bank.refresh();
            }
            topBank.refresh();
        }
        void drain() {
            int count = 0;
            while (!tasks.isEmpty()) { check(++count < 30000, "bounded work"); tasks.remove().run(); }
        }
        Capture send(JsonObject params) {
            Capture capture = new Capture(); registry.dispatch("chain.move", params, capture); drain();
            check(capture.replies == 1 && gate.leases() == 0 && !scopes.open(), "one reply and released lease");
            return capture;
        }
        void restored() {
            for (int slot = 0; slot < 3; slot++) {
                check(layers[slot].position == 0, "chain window restored");
                for (Bank bank : devices[slot]) check(bank.position == 0, "device window restored");
            }
            check(topBank.position == 0, "top window restored");
            check(gate.blockedReason() == null || gate.blockedReason().isEmpty(), "no false write latch");
        }
        final class Bank implements WindowPager.Window {
            final int slot, local;
            int position, seenPosition;
            JsonArray seen = new JsonArray();
            Bank(int slot, int local) { this.slot = slot; this.local = local; }
            boolean layerBank() { return slot >= 0 && local < 0; }
            public int width() { return slot < 0 ? 16 : layerBank() ? 5 : 4; }
            public int count() {
                if (slot < 0) return top.size();
                if (reported[slot] >= top.size()) return 0;
                if (layerBank()) return top.get(reported[slot]).layers.size();
                if (layers[slot].position + local >= top.get(reported[slot]).layers.size()) return 0;
                return layer(slot, local).devices.size();
            }
            public int position() { return position; }
            public void scroll(int target) {
                events.add((layerBank() ? "layer" : "device") + ":" + slot + ":" + target);
                if (stuck || (writes > 0 && target == 0 && (layerBank() ? failLayerRestore : failDeviceRestore))) return;
                if (layerBank() && target == 0 && writes > 0) for (Bank bank : devices[slot])
                    check(bank.position == 0 || failDeviceRestore, "device windows restore before their parent chain window");
                tasks.add(() -> {
                    position = Math.min(target, Math.max(0, count() - width()));
                    tasks.add(Model.this::refresh); // Deliberately separate position and item arrivals.
                });
            }
            void refresh() {
                position = Math.min(position, Math.max(0, count() - width()));
                seenPosition = position; seen = new JsonArray();
                for (int i = position; i < Math.min(count(), position + width()); i++) {
                    JsonObject row = new JsonObject(); row.addProperty("index", i);
                    if (layerBank()) {
                        row.addProperty("channelId", top.get(reported[slot]).layers.get(i).id);
                        row.addProperty("name", "same"); // Names cannot substitute for chain identities.
                    } else {
                        row.addProperty("name", slot < 0 ? top.get(i).name : layer(slot, local).devices.get(i));
                        row.addProperty("enabled", true);
                    }
                    seen.add(row);
                }
            }
            public JsonArray snapshot() {
                if (position != seenPosition) stalePages++;
                if (!layerBank()) return position == seenPosition ? seen.deepCopy() : null;
                JsonArray result = seen.deepCopy();
                for (int i = 0; i < result.size(); i++) result.get(i).getAsJsonObject().addProperty("index", position + i);
                if (corruptSource && slot == 0 && position > 0 && !result.isEmpty())
                    result.get(0).getAsJsonObject().addProperty("channelId", "wrong-id");
                return result;
            }
        }
    }
    private static class Capture implements Bridge.Reply {
        JsonObject value; Exception error; int replies;
        public void result(JsonElement value, long queued) { this.value = value.getAsJsonObject(); replies++; }
        public void error(Exception error, long queued) { this.error = error; replies++; }
    }
    private static JsonObject params(int srcPosition, int srcChain, int srcDevice, int dstPosition, int dstChain, String verb) {
        JsonObject p = new JsonObject();
        p.addProperty("src", srcPosition < 0 ? "top" : "chain"); p.addProperty("srcDevice", srcDevice);
        if (srcPosition >= 0) {
            p.addProperty("srcPosition", srcPosition); p.addProperty("srcChain", srcChain);
            p.addProperty("expectedSourceChain", "same");
            p.addProperty("expectedSourceChannelId", "container-" + srcPosition + "-" + srcChain);
        }
        p.addProperty("dst", dstPosition < 0 ? "top" : "chain");
        if (dstPosition >= 0) {
            p.addProperty("dstPosition", dstPosition); p.addProperty("dstChain", dstChain);
            p.addProperty("expectedDestinationChain", "same");
            p.addProperty("expectedDestinationChannelId", "container-" + dstPosition + "-" + dstChain);
        }
        p.addProperty("verb", verb); p.addProperty("expectedTrackChannelId", "track");
        p.addProperty("expectedSourceName", srcPosition < 0 ? "container-" + srcDevice
            : "container-" + srcPosition + "-" + srcChain + "-device-" + srcDevice);
        return p;
    }
    private static void check(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
    private static void run(String name, Runnable test) { test.run(); groups++; System.out.println("PASS " + name); }
    public static void main(String[] args) {
        run("overflow move/copy holds both endpoints across same and different containers", () -> {
            for (String verb : List.of("move", "copy")) for (int dest : new int[] {0, 1})
                for (int[] indices : new int[][] {{0, 4, 10}, {5, 9, 0}, {10, 5, 5}}) {
                    Model m = new Model(); int src = indices[0], dev = indices[1], dst = indices[2];
                    Layer a = m.top.get(0).layers.get(src), b = m.top.get(dest).layers.get(dst);
                    List<String> beforeA = new ArrayList<>(a.devices), beforeB = new ArrayList<>(b.devices);
                    List<String> untouched = new ArrayList<>(m.top.get(2).layers.get(0).devices);
                    Capture result = m.send(params(0, src, dev, dest, dst, verb));
                    check(result.error == null, "transfer result: " + result.error);
                    beforeB.add(beforeA.get(dev)); if (verb.equals("move")) beforeA.remove(dev);
                    check(a.devices.equals(beforeA) && b.devices.equals(beforeB), "exact source/destination effects");
                    check(m.top.get(2).layers.get(0).devices.equals(untouched), "unrelated devices preserved");
                    check(m.writes == 1 && result.value.get("sourceName").getAsString().endsWith("device-" + dev), "one transfer, pre-write name");
                    m.restored();
                }
        });
        run("six-chain/five-device boundary clamps the source window after moving its last device", () -> {
            for (String verb : List.of("move", "copy")) for (String where : List.of("chainStart", "chainEnd")) {
                Model m = new Model();
                for (Container container : m.top) {
                    container.layers.subList(6, 11).clear();
                    for (Layer layer : container.layers) layer.devices.subList(5, 10).clear();
                }
                Layer source = m.top.get(0).layers.get(5), destination = m.top.get(1).layers.get(5);
                destination.devices.clear(); m.refresh();
                List<List<String>> before = m.top.stream().flatMap(c -> c.layers.stream())
                    .map(layer -> new ArrayList<>(layer.devices)).map(list -> (List<String>) list).toList();
                JsonObject p = params(0, 5, 4, 1, 5, verb); p.addProperty("where", where);
                Capture result = m.send(p);
                check(result.error == null, "exact boundary result: " + result.error);
                check(source.devices.size() == (verb.equals("move") ? 4 : 5)
                    && destination.devices.equals(List.of("container-0-5-device-4")), "boundary effects");
                var all = m.top.stream().flatMap(c -> c.layers.stream()).toList();
                for (int i = 0; i < all.size(); i++) if (all.get(i) != source && all.get(i) != destination)
                    check(all.get(i).devices.equals(before.get(i)), "every unrelated chain preserved");
                m.restored();
            }
        });
        run("chain-to-track start/end transfers restore a shifted container", () -> {
            for (String verb : List.of("move", "copy")) for (String where : List.of("chainStart", "chainEnd")) {
                Model m = new Model(); Container original = m.top.get(0); Layer source = original.layers.get(10);
                JsonObject p = params(0, 10, 9, -1, -1, verb); p.addProperty("where", where);
                Capture result = m.send(p);
                check(result.error == null, "mixed result: " + result.error);
                check(source.devices.size() == (verb.equals("move") ? 9 : 10), "source effect");
                check(result.value.get("sourceContainer").getAsString().equals("container-0"), "pre-transfer container name retained");
                check(m.top.get(where.equals("chainStart") ? 0 : 3).name.equals("container-0-10-device-9"), "top destination");
                check(m.top.contains(original), "original container retained"); m.restored();
            }
        });
        run("top-to-chain handles a destination shifted by source removal", () -> {
            for (String verb : List.of("move", "copy")) for (int source : new int[] {0, 2}) {
                Model m = new Model(); Container container = m.top.get(1); Layer destination = container.layers.get(10);
                Capture result = m.send(params(-1, -1, source, 1, 10, verb));
                check(result.error == null, "top-to-chain result: " + result.error);
                check(destination.devices.get(10).equals("container-" + source), "correct destination survives reindexing");
                check(result.value.get("dstContainer").getAsString().equals("container-1"), "destination reply name retained");
                check(m.top.indexOf(container) == (verb.equals("move") && source == 0 ? 0 : 1), "projected container index"); m.restored();
            }
        });
        run("a later move uses the freshly shifted source device index", () -> {
            Model m = new Model();
            check(m.send(params(0, 5, 4, 1, 10, "move")).error == null, "first move");
            JsonObject p = params(0, 5, 4, 1, 10, "move"); p.addProperty("expectedSourceName", "container-0-5-device-5");
            check(m.send(p).error == null, "second move after shift");
            check(m.top.get(1).layers.get(10).devices.subList(10, 12).equals(List.of("container-0-5-device-4", "container-0-5-device-5")), "source identity across calls");
            m.restored();
        });
        run("identity guards, malformed indices and unsupported routes refuse without a transfer", () -> {
            for (String field : List.of("expectedSourceChannelId", "expectedDestinationChannelId", "expectedSourceName",
                    "expectedSourceChain", "expectedDestinationChain", "expectedTrackChannelId")) {
                Model m = new Model(); JsonObject p = params(0, 5, 4, 1, 10, "move"); p.addProperty(field, "wrong");
                check(m.send(p).error != null && m.writes == 0, "guard refuses: " + field); m.restored();
            }
            for (String field : List.of("srcDevice", "srcChain", "dstChain", "srcPosition", "dstPosition"))
                for (String raw : List.of("-1", "1.5", "2147483648", "\"5\"", "null")) {
                    Model m = new Model(); JsonObject p = params(0, 5, 4, 1, 10, "move"); p.add(field, JsonParser.parseString(raw));
                    check(m.send(p).error != null && m.writes == 0, "malformed index");
                    check(m.scopes.status().get("aims").getAsInt() == 0, "validation precedes aim");
                }
            for (JsonObject p : List.of(params(0, 5, 4, 0, 5, "copy"), params(-1, -1, 1, 1, 5, "move"),
                    params(-1, -1, 16, 1, 5, "move"))) {
                Model m = new Model(); check(m.send(p).error != null && m.writes == 0, "unsupported endpoint refused");
            }
        });
        run("no-op and thrown partial transfers never repeat and retain actual effects", () -> {
            for (boolean noOp : new boolean[] {true, false}) {
                Model m = new Model(); m.noOp = noOp; m.throwAfterWrite = !noOp;
                Capture result = m.send(params(0, 10, 9, 1, 10, "move"));
                check(m.writes == 1 && m.top.get(0).layers.get(10).devices.size() == (noOp ? 10 : 9), "one attempt with retained effects");
                check(noOp ? result.error == null : result.error.getMessage().contains("effects may have applied"), "truthful acknowledgement or partial failure");
                m.restored();
            }
        });
        run("failed device or layer restoration latches before queued work can run", () -> {
            for (boolean device : new boolean[] {true, false}) {
                Model m = new Model(); m.failDeviceRestore = device; m.failLayerRestore = !device;
                Capture first = new Capture(), queued = new Capture();
                m.registry.dispatch("chain.move", params(0, 10, 9, 1, 10, "copy"), first);
                m.registry.dispatch("chain.move", params(0, 0, 0, 1, 0, "copy"), queued); m.drain();
                check(first.error != null && first.error.getMessage().contains("effects may have applied"), "partial result explicit");
                check(queued.error != null && m.writes == 1 && first.replies == 1 && queued.replies == 1, "queued transfer blocked");
                check(m.gate.leases() == 0 && !m.scopes.open() && m.events.contains("block"), "latch and release");
                if (device) for (var bank : m.layers) check(bank.position == 0, "outer windows restore despite inner failure");
            }
        });
        run("mixed partial and no-op transfers retain the correct container through restoration", () -> {
            for (boolean noOp : new boolean[] {true, false}) for (boolean toTop : new boolean[] {true, false}) {
                Model m = new Model(); m.noOp = noOp; m.throwAfterWrite = !noOp;
                JsonObject p = toTop ? params(0, 10, 9, -1, -1, "move") : params(-1, -1, 0, 1, 10, "move");
                p.addProperty("where", "chainStart");
                Capture result = m.send(p);
                check(m.writes == 1 && (noOp ? result.error == null
                    : result.error.getMessage().contains("effects may have applied")), "mixed transfer never repeats");
                check(m.top.size() == (noOp ? 3 : toTop ? 4 : 2), "retain actual mixed effects"); m.restored();
            }
        });
        run("seventeen/eighteen-device mixed transfers page top-level sources and guards", () -> {
            for (int count : new int[] {16, 17, 18}) for (String verb : List.of("move", "copy"))
                for (boolean toTop : new boolean[] {true, false}) for (String where : List.of("chainStart", "chainEnd")) {
                    Model m = new Model();
                    while (m.top.size() < count) m.top.add(new Container("container-" + m.top.size()));
                    m.refresh();
                    JsonObject p = toTop ? params(count - 1, 10, 9, -1, -1, verb)
                        : params(-1, -1, count - 1, 1, 10, verb);
                    p.addProperty("where", where);
                    JsonArray names = new JsonArray(), enabled = new JsonArray();
                    for (Container item : m.top) { names.add(item.name); enabled.add(true); }
                    p.add("expectedDeviceNames", names); p.add("expectedDeviceEnabled", enabled);
                    Container preserved = m.top.get(2);
                    Capture result = m.send(p);
                    check(result.error == null, "mixed overflow: " + result.error);
                    check(m.writes == 1 && m.top.contains(preserved), "one transfer preserves unrelated container");
                    check(m.top.size() == count + (toTop ? 1 : verb.equals("move") ? -1 : 0), "population projection");
                    if (toTop) check(m.top.get(where.equals("chainStart") ? 0 : count).name
                        .equals("container-" + (count - 1) + "-10-device-9"), "overflow source device");
                    else check(m.top.get(1).layers.get(10).devices.contains("container-" + (count - 1)), "overflow top source");
                    m.restored();
                }
        });
        run("overflow top-source shifts, partial effects, and restoration failures retain their destination", () -> {
            for (int source : new int[] {0, 17}) for (String mode : List.of("apply", "no-op", "throw", "restore")) {
                Model m = new Model();
                while (m.top.size() < 18) m.top.add(new Container("container-" + m.top.size()));
                int destination = source == 0 ? 17 : 16;
                Container preserved = m.top.get(destination); Layer chain = preserved.layers.get(10);
                m.noOp = mode.equals("no-op"); m.throwAfterWrite = mode.equals("throw");
                m.failDeviceRestore = mode.equals("restore"); m.refresh();
                Capture result = m.send(params(-1, -1, source, destination, 10, "move"));
                check(m.writes == 1 && m.top.contains(preserved), "one write retains destination");
                check(chain.devices.size() == (m.noOp ? 10 : 11), "actual effects retained");
                check(m.top.indexOf(preserved) == destination - (!m.noOp && source < destination ? 1 : 0), "far container shift");
                if (mode.equals("throw") || (mode.equals("restore") && source == 17))
                    check(result.error != null && result.error.getMessage().contains("effects may have applied"), "partial result");
                else check(result.error == null, "completed transfer: " + result.error);
                if (mode.equals("restore") && source == 17) check(m.gate.blockedReason() != null, "top restoration failure latched");
                else m.restored();
            }
        });
        run("overflow fingerprint mismatches and named slots refuse", () -> {
            for (boolean enabledMismatch : new boolean[] {true, false}) {
                Model m = new Model();
                while (m.top.size() < 18) m.top.add(new Container("container-" + m.top.size()));
                m.refresh();
                JsonObject p = params(-1, -1, 17, 1, 5, "copy");
                JsonArray names = new JsonArray(), enabled = new JsonArray();
                for (Container item : m.top) { names.add(item.name); enabled.add(true); }
                if (enabledMismatch) enabled.set(17, new com.google.gson.JsonPrimitive(false));
                else names.set(17, new com.google.gson.JsonPrimitive("wrong"));
                p.add("expectedDeviceNames", names); p.add("expectedDeviceEnabled", enabled);
                check(m.send(p).error != null && m.writes == 0, "complete overflow guard"); m.restored();
            }
            Model m = new Model(); JsonObject p = params(0, 5, 4, 1, 5, "copy"); p.addProperty("dst", "slot");
            Capture result = m.send(p);
            check(result.error != null && result.error.getMessage().equals("legacy route") && m.writes == 0, "named slot delegates to bounded legacy route");
        });
        run("batch continuation starts only after endpoints and lease are released", () -> {
            Model m = new Model(); Capture second = new Capture();
            Capture first = new Capture() {
                public void result(JsonElement value, long queued) {
                    super.result(value, queued); m.restored();
                    check(!m.scopes.open() && m.gate.leases() == 0, "release precedes batch continuation");
                    m.registry.invokeAsync("chain.move", params(0, 5, 5, 0, 0, "copy"), second);
                }
            };
            m.registry.dispatch("chain.move", params(0, 0, 4, 0, 10, "copy"), first); m.drain();
            check(first.error == null && second.error == null && first.replies == 1 && second.replies == 1 && m.writes == 2, "sequential transfers");
            m.restored();
        });
        run("navigation failure and stale overlapping chain IDs refuse before work", () -> {
            for (boolean stuck : new boolean[] {true, false}) {
                Model m = new Model(); m.stuck = stuck; m.corruptSource = !stuck;
                check(m.send(params(0, 10, 9, 1, 10, "copy")).error != null && m.writes == 0, "no uncertain navigation write");
                m.restored();
            }
        });
        System.out.println("Chain moves: " + groups + " test groups passed.");
    }
}
