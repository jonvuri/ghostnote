package com.ghostnote.extension.handlers;

import com.ghostnote.extension.*;
import com.google.gson.*;
import java.util.*;

/** Registered handlers against delayed window observers and independent mutable track contents. */
public final class DeviceMutationHandlersTest {
    private static int groups;
    private static final class Item {
        final String name;
        boolean enabled = true;
        Item(String name) { this.name = name; }
    }
    private static final class Model implements DeviceMutationHandlers.Host {
        final ArrayDeque<Runnable> tasks = new ArrayDeque<>();
        final WriteGate gate = new WriteGate(tasks::add, () -> 0L, 8);
        final HandlerRegistry registry = new HandlerRegistry(RuntimeProfile.NORMAL, gate);
        final List<List<Item>> tracks = List.of(new ArrayList<>(), new ArrayList<>());
        final Bank[][] banks = new Bank[2][2];
        int writes, stalePages;
        boolean failRestore, throwAfterWrite, noOp, stuck, changeTrack, unavailableCount;
        Model(int count) {
            for (int c = 0; c < 2; c++) {
                for (int i = 0; i < count; i++) tracks.get(c).add(new Item("track-" + c + "-device-" + i));
                banks[c][0] = new Bank(c, 16); banks[c][1] = new Bank(c, 1);
            }
            refresh(); new DeviceMutationHandlers(this).register(registry);
        }
        public int cursors() { return 2; }
        public String track(int cursor) { return changeTrack ? "changed" : "track-" + cursor; }
        public WindowPager.Window window(int cursor, boolean anchor) { return banks[cursor][anchor ? 1 : 0]; }
        public WriteGate.Lease lease() { return gate.writeLease(); }
        public void schedule(Runnable task, int ms) { tasks.add(task); }
        public void blockWrites(String reason) { gate.blockWrites(reason); }
        public void mutate(String method, JsonObject p, int cursor, int source, int anchor) {
            check(gate.leases() > 0, "lease held at mutation");
            List<Item> items = tracks.get(cursor);
            Item target = source < 0 ? null : items.get(banks[cursor][0].position + source);
            Item relative = anchor < 0 ? null : items.get(banks[cursor][1].position + anchor);
            check(source < 0 || (source < 16 && banks[cursor][0].snapshot() != null), "settled physical source");
            check(anchor < 0 || (anchor == 0 && banks[cursor][1].snapshot() != null), "independent physical anchor");
            writes++;
            if (noOp) return;
            switch (method) {
                case "device.delete" -> items.remove(target);
                case "device.setEnabled" -> target.enabled = p.get("enabled").getAsBoolean();
                case "device.moveTo" -> {
                    String where = ChainMoveHandlers.text(p, "where", "after");
                    items.remove(target);
                    int at = switch (where) {
                        case "chainStart" -> 0;
                        case "chainEnd" -> items.size();
                        case "before" -> items.indexOf(relative);
                        default -> items.indexOf(relative) + 1;
                    };
                    items.add(at, target);
                }
                default -> items.add(new Item("inserted"));
            }
            tasks.add(this::refresh);
            if (throwAfterWrite) throw new IllegalStateException("host threw after applying");
        }
        void refresh() { for (var cursor : banks) for (Bank bank : cursor) bank.refresh(); }
        void drain() { int count = 0; while (!tasks.isEmpty()) { check(++count < 30000, "bounded work"); tasks.remove().run(); } }
        Capture send(String method, JsonObject p) {
            Capture capture = new Capture(); registry.dispatch(method, p, capture); drain();
            check(capture.replies == 1 && gate.leases() == 0, "one reply after release"); return capture;
        }
        JsonObject params(int cursor, int index) {
            JsonObject p = new JsonObject(); p.addProperty("cursor", Integer.toString(cursor)); p.addProperty("deviceIndex", index);
            p.addProperty("expectedTrackChannelId", "track-" + cursor);
            JsonArray names = new JsonArray(), enabled = new JsonArray();
            for (Item item : tracks.get(cursor)) { names.add(item.name); enabled.add(item.enabled); }
            p.add("expectedDeviceNames", names); p.add("expectedDeviceEnabled", enabled);
            p.addProperty("enabled", false); p.addProperty("expectedEnabled", true);
            return p;
        }
        void restored() {
            for (var cursor : banks) for (Bank bank : cursor) check(bank.position == 0, "all windows restored");
            check(gate.blockedReason() == null || gate.blockedReason().isEmpty(), "no false latch");
        }
        final class Bank implements WindowPager.Window {
            final int cursor, width;
            int position, seenPosition;
            JsonArray seen;
            Bank(int cursor, int width) { this.cursor = cursor; this.width = width; }
            public int width() { return width; }
            public int count() { return unavailableCount ? -1 : tracks.get(cursor).size(); }
            public int position() { return position; }
            public void scroll(int target) {
                if (stuck || (failRestore && writes > 0 && target == 0)) return;
                tasks.add(() -> { position = Math.min(target, Math.max(0, count() - width)); tasks.add(this::refresh); });
            }
            void refresh() {
                position = Math.min(position, Math.max(0, count() - width)); seenPosition = position;
                seen = new JsonArray();
                for (int i = position; i < Math.min(count(), position + width); i++) {
                    Item item = tracks.get(cursor).get(i); seen.add(WindowPager.device(i, item.name, item.enabled));
                }
            }
            public JsonArray snapshot() {
                if (position != seenPosition) { stalePages++; return null; }
                return seen.deepCopy();
            }
        }
    }
    private static class Capture implements Bridge.Reply {
        JsonObject value; Exception error; int replies;
        public void result(JsonElement result, long queued) { value = result.getAsJsonObject(); replies++; }
        public void error(Exception failure, long queued) { error = failure; replies++; }
    }
    private static void check(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
    private static void run(String name, Runnable test) { test.run(); groups++; System.out.println("PASS " + name); }
    public static void main(String[] args) {
        run("first and last delete/enable on seventeen/eighteen-device tracks across pool cursors", () -> {
            for (int count : new int[] {17, 18}) for (int cursor : new int[] {0, 1})
                for (int index : new int[] {0, count - 1}) for (String method : List.of("device.delete", "device.setEnabled")) {
                    Model m = new Model(count); List<Item> expected = new ArrayList<>(m.tracks.get(cursor));
                    List<Item> other = new ArrayList<>(m.tracks.get(1 - cursor)); Item target = expected.get(index);
                    Capture result = m.send(method, m.params(cursor, index));
                    check(result.error == null, "mutation: " + result.error);
                    if (method.equals("device.delete")) expected.remove(index); else check(!target.enabled, "target disabled");
                    check(m.tracks.get(cursor).equals(expected) && m.tracks.get(1 - cursor).equals(other), "exact contents preserved");
                    for (Item item : m.tracks.get(cursor)) if (item != target) check(item.enabled, "unrelated enabled state");
                    check(m.writes == 1 && m.stalePages > 0, "one write after delayed pages"); m.restored();
                }
        });
        run("every insertion route crosses the sixteenth-device boundary with a complete fingerprint", () -> {
            for (int count : new int[] {0, 15, 16, 17, 18}) for (String method : DeviceMutationHandlers.METHODS)
                if (method.startsWith("device.insert")) {
                    Model m = new Model(count); JsonObject p = m.params(1, 0);
                    p.addProperty("uuid", "00000000-0000-0000-0000-000000000001"); p.addProperty("clapId", "plugin.id");
                    p.addProperty("vst3Id", "0123456789abcdef0123456789abcdef"); p.addProperty("path", "/tmp/example.bwpreset");
                    List<Item> before = new ArrayList<>(m.tracks.get(1));
                    Capture result = m.send(method, p); check(result.error == null, "insert: " + result.error);
                    check(m.tracks.get(1).size() == count + 1 && m.tracks.get(1).subList(0, count).equals(before), "append preserves devices");
                    check(m.tracks.get(0).size() == count && m.writes == 1, "correct pool cursor"); m.restored();
                }
        });
        run("distant reorder holds independent source and anchor on their owning pool cursor", () -> {
            for (int count : new int[] {17, 18}) for (int cursor : new int[] {0, 1})
                for (int source : new int[] {0, count - 1}) for (String where : List.of("before", "after", "chainStart", "chainEnd")) {
                    Model m = new Model(count); int anchor = source == 0 ? count - 1 : 0;
                    JsonObject p = m.params(cursor, source); p.addProperty("where", where); p.addProperty("anchorIndex", anchor);
                    List<Item> expected = new ArrayList<>(m.tracks.get(cursor)); Item item = expected.get(source), relative = expected.get(anchor);
                    expected.remove(item);
                    int at = switch (where) { case "chainStart" -> 0; case "chainEnd" -> expected.size();
                        case "before" -> expected.indexOf(relative); default -> expected.indexOf(relative) + 1; };
                    expected.add(at, item);
                    Capture result = m.send("device.moveTo", p); check(result.error == null, "reorder: " + result.error);
                    check(m.tracks.get(cursor).equals(expected) && m.writes == 1, "exact reorder");
                    check(result.value.get("sourceName").getAsString().equals(item.name), "pre-write result identity"); m.restored();
                }
        });
        run("whole-chain names and enabled state include overflow and unrelated first-page devices", () -> {
            for (int index : new int[] {0, 17}) for (boolean enabled : new boolean[] {true, false}) {
                Model m = new Model(18); JsonObject p = m.params(0, 17);
                if (enabled) m.tracks.get(0).get(index).enabled = false;
                else p.getAsJsonArray("expectedDeviceNames").set(index, new JsonPrimitive("wrong"));
                m.refresh(); check(m.send("device.delete", p).error != null && m.writes == 0, "fingerprint refuses"); m.restored();
            }
        });
        run("malformed indices, identities and insertion identifiers refuse without effects", () -> {
            for (String key : List.of("cursor", "deviceIndex")) for (String raw : List.of("-1", "1.5", "2147483648", "null", "\"invalid\"")) {
                Model m = new Model(18); JsonObject p = m.params(0, 17); p.add(key, JsonParser.parseString(raw));
                check(m.send("device.delete", p).error != null && m.writes == 0, "malformed " + key); m.restored();
            }
            for (String key : List.of("expectedTrackChannelId", "expectedName", "expectedSourceName")) {
                Model m = new Model(18); JsonObject p = m.params(0, 17); p.addProperty(key, "wrong");
                check(m.send("device.delete", p).error != null && m.writes == 0, "identity " + key); m.restored();
            }
            Model m = new Model(18); JsonObject p = m.params(0, 17); p.addProperty("vst3Id", "invalid");
            check(m.send("device.insertVst3", p).error != null && m.writes == 0, "bad insertion ID");
            p = m.params(0, 18); check(m.send("device.delete", p).error != null && m.writes == 0, "absent target"); m.restored();
        });
        run("failed navigation and changed track refuse before writing", () -> {
            for (boolean stuck : new boolean[] {true, false}) {
                Model m = new Model(18); JsonObject p = m.params(0, 17); m.stuck = stuck;
                if (!stuck) m.tasks.add(() -> m.changeTrack = true);
                check(m.send("device.delete", p).error != null && m.writes == 0, "navigation refused"); m.restored();
            }
        });
        run("an unavailable population cannot be mistaken for an empty insertion target", () -> {
            Model m = new Model(0); JsonObject p = m.params(0, 0); p.addProperty("clapId", "example.plugin");
            m.unavailableCount = true; m.refresh();
            Capture result = m.send("device.insertClap", p);
            check(result.error != null && m.writes == 0 && m.tracks.get(0).isEmpty(), "unknown count refuses"); m.restored();
        });
        run("no-op and thrown partial mutations are attempted once and retain actual effects", () -> {
            for (boolean noOp : new boolean[] {true, false}) {
                Model m = new Model(18); m.noOp = noOp; m.throwAfterWrite = !noOp;
                Capture result = m.send("device.delete", m.params(0, 17));
                check(m.writes == 1 && m.tracks.get(0).size() == (noOp ? 18 : 17), "one attempt");
                check(noOp ? result.error == null : result.error.getMessage().contains("effects may have applied"), "honest partial result"); m.restored();
            }
        });
        run("restoration failure latches before queued writes and releases once", () -> {
            Model m = new Model(18); m.failRestore = true; Capture first = new Capture(), queued = new Capture();
            m.registry.dispatch("device.setEnabled", m.params(0, 17), first);
            m.registry.dispatch("device.delete", m.params(1, 0), queued); m.drain();
            check(first.error != null && first.error.getMessage().contains("effects may have applied"), "truthful restore failure");
            check(queued.error != null && m.writes == 1 && m.gate.leases() == 0 && first.replies == 1 && queued.replies == 1, "latch precedes release");
            check(!m.tracks.get(0).get(17).enabled, "correct effect retained");
        });
        run("distant reorder partial effects and anchor restoration failures never repeat", () -> {
            for (boolean restoreFailure : new boolean[] {true, false}) {
                Model m = new Model(18); m.failRestore = restoreFailure; m.throwAfterWrite = !restoreFailure;
                JsonObject p = m.params(1, 0); p.addProperty("anchorIndex", 17);
                Item source = m.tracks.get(1).get(0); Capture result = m.send("device.moveTo", p);
                check(result.error != null && result.error.getMessage().contains("effects may have applied"), "partial reorder result");
                check(m.writes == 1 && m.tracks.get(1).get(17) == source, "reorder effect retained");
                if (restoreFailure) check(m.gate.blockedReason() != null, "anchor restore failure latched");
                else m.restored();
            }
        });
        run("batch continuation runs after both reorder windows restore", () -> {
            Model m = new Model(18); Capture second = new Capture();
            Capture first = new Capture() { public void result(JsonElement value, long queued) {
                super.result(value, queued); m.restored(); check(m.gate.leases() == 0, "lease released");
                m.registry.invokeAsync("device.delete", m.params(0, 17), second);
            }};
            JsonObject p = m.params(0, 0); p.addProperty("anchorIndex", 17);
            m.registry.dispatch("device.moveTo", p, first); m.drain();
            check(first.error == null && second.error == null && m.writes == 2 && second.replies == 1, "batch operations complete"); m.restored();
        });
        System.out.println("Device mutations: " + groups + " test groups passed.");
    }
}
