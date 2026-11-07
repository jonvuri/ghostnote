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
import com.google.gson.JsonPrimitive;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The registered chain.insert route against real scope, gate, pager and window code. Device counts arrive
 * in later host tasks after a modeled delay, and the model rejects any insertion issued while an earlier
 * insertion into the same chain has not landed: E403 found that such insertions do not keep their order.
 */
public final class ChainInsertHandlersTest {
    private static final long MS = 1_000_000L;
    private static int groups;
    private static Path preset;

    private record Landing(int chain, long due, String device) { }

    private static final class Model implements ChainInsertHandlers.Host, ContainerScopes.Scopes {
        final ArrayDeque<Runnable> tasks = new ArrayDeque<>();
        final WriteGate gate = new WriteGate(tasks::add, () -> 0L, 8);
        final ContainerScopes scopes = new ContainerScopes(this);
        final HandlerRegistry registry = new HandlerRegistry(RuntimeProfile.NORMAL, gate);
        final int[] wanted = {0, 1, 2}, reported = {0, 1, 2};
        final List<String> top = new ArrayList<>(List.of("Pre", "FX Layer", "Post"));
        final List<String> names = new ArrayList<>();
        final List<List<String>> chains = new ArrayList<>();
        final List<String> calls = new ArrayList<>();
        final List<Landing> landings = new ArrayList<>();
        final Map<Integer, Integer> delays = new HashMap<>();
        final Set<Integer> neverLand = new HashSet<>();
        final Bank bank = new Bank();
        String track = "track-a", container = "FX Layer";
        long clock;
        boolean failRestore, stuck, scopeLost;
        Runnable onInsert = () -> { };

        Model(int layers) {
            for (int i = 0; i < layers; i++) { names.add("layer-" + i); chains.add(new ArrayList<>()); }
            new ChainInsertHandlers(this).register(registry);
        }
        public ContainerScopes scopes() { return scopes; }
        public String trackId() { return track; }
        public String containerName(int slot) { return container; }
        public boolean ready(int slot, int position, String expected) {
            return expected.equals(track) && reported[slot] == position && settled(slot) && !scopeLost;
        }
        public WindowPager.Window topWindow() {
            return new WindowPager.Window() {
                public int width() { return 16; }
                public int count() { return top.size(); }
                public int position() { return 0; }
                public void scroll(int position) { }
                public JsonArray snapshot() {
                    JsonArray rows = new JsonArray();
                    for (int i = 0; i < top.size(); i++) {
                        JsonObject row = new JsonObject();
                        row.addProperty("index", i); row.addProperty("name", top.get(i)); row.addProperty("enabled", true);
                        rows.add(row);
                    }
                    return rows;
                }
            };
        }
        public WindowPager.Window layers(int slot) { return bank; }
        public int deviceCount(int slot, int local) {
            int absolute = bank.seenPosition + local;
            return absolute < chains.size() ? chains.get(absolute).size() : 0;
        }
        public void insert(int slot, int local, ChainInsertHandlers.Source source) {
            check(gate.writeLeases() == 1 && scopes.open(), "insertion holds the write lease and scope");
            check(bank.position == bank.seenPosition, "writer uses settled item observers");
            int absolute = bank.position + local;
            check(landings.stream().noneMatch(l -> l.chain() == absolute), "preceding device must land before the next setter");
            String device = source.kind() + ":" + source.value();
            int call = calls.size();
            calls.add(absolute + ":" + device);
            if (!neverLand.contains(call)) landings.add(new Landing(absolute, clock + delays.getOrDefault(call, 20) * MS, device));
            onInsert.run();
        }
        public long nanoTime() { return clock; }
        public void schedule(Runnable task, int ms) { tasks.add(() -> { clock += ms * MS; task.run(); }); }
        public void blockWrites(String reason) { gate.blockWrites(reason); }
        public int scopeCount() { return 3; }
        public int deviceBank() { return 16; }
        public boolean held(int slot) { return true; }
        public int requestedPosition(int slot) { return wanted[slot]; }
        public boolean settled(int slot) { return wanted[slot] == reported[slot]; }
        public void scroll(int slot, int position) { wanted[slot] = position; tasks.add(() -> reported[slot] = position); }
        public int deviceCount() { return top.size(); }
        public String trackChannelId() { return track; }
        public String describe(int slot) { return "model"; }
        public String scopeStatus(int slot) { return "held"; }
        public WriteGate.Lease writeLease() { return gate.writeLease(); }

        void drain() {
            int steps = 0;
            while (!tasks.isEmpty()) {
                check(steps++ < 100_000, "bounded tasks");
                for (var it = landings.iterator(); it.hasNext(); ) {
                    Landing landing = it.next();
                    if (landing.due() > clock) continue;
                    chains.get(landing.chain()).add(landing.device());
                    it.remove();
                }
                tasks.remove().run();
            }
        }
        Capture send(JsonObject p) {
            Capture reply = new Capture(this); registry.dispatch("chain.insert", p, reply); drain();
            released(reply);
            return reply;
        }
        void released(Capture reply) {
            check(reply.replies == 1 && !scopes.open() && gate.leases() == 0 && gate.writeLeases() == 0,
                "one reply and released scope and lease");
        }

        final class Bank implements WindowPager.Window {
            int position, seenPosition;
            public int width() { return 5; }
            public int count() { return names.size(); }
            public int position() { return position; }
            public void scroll(int target) {
                if (stuck || (failRestore && !calls.isEmpty() && target == 0)) return;
                tasks.add(() -> {
                    position = Math.min(target, Math.max(0, count() - width()));
                    tasks.add(() -> seenPosition = position);
                });
            }
            public JsonArray snapshot() {
                JsonArray rows = new JsonArray();
                for (int i = 0; i < Math.min(5, names.size() - seenPosition); i++) {
                    JsonObject row = new JsonObject();
                    row.addProperty("index", position + i);
                    row.addProperty("channelId", "id-" + (seenPosition + i));
                    row.addProperty("name", names.get(seenPosition + i));
                    row.addProperty("solo", false);
                    rows.add(row);
                }
                return rows;
            }
        }
    }

    private static class Capture implements Bridge.Reply {
        final Model model;
        JsonObject value; Exception error; int replies;
        List<Integer> countsAtReply;
        long clockAtReply;
        Capture(Model model) { this.model = model; }
        public void result(JsonElement value, long queued) { this.value = value.getAsJsonObject(); record(); }
        public void error(Exception error, long queued) { this.error = error; record(); }
        void record() {
            replies++; clockAtReply = model.clock;
            countsAtReply = model.chains.stream().map(List::size).toList();
        }
        String message() { return error == null ? "" : error.getMessage(); }
    }

    private static JsonObject source(String kind, String value) {
        JsonObject s = new JsonObject(); s.addProperty("kind", kind); s.addProperty("value", value); return s;
    }
    private static JsonObject nativeSource(int n) { return source("native", String.format("00000000-0000-0000-0000-%012d", n)); }
    private static JsonObject request(String chain, int expectedCount, JsonObject... sources) {
        JsonObject p = new JsonObject();
        p.addProperty("position", 1); p.addProperty("expectedDeviceCount", expectedCount);
        p.addProperty("expectedTrackChannelId", "track-a"); p.addProperty("expectedContainerName", "FX Layer");
        p.addProperty("expectedChainName", chain);
        JsonArray array = new JsonArray();
        for (JsonObject s : sources) array.add(s);
        if (sources.length == 0) array.add(nativeSource(1));
        p.add("sources", array);
        return p;
    }
    private static List<String> devices(String... values) { return List.of(values); }
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
    private static void run(String name, Runnable test) { test.run(); groups++; System.out.println("PASS " + name); }
    private static boolean possibleEffects(Capture reply, int attempted) {
        return reply.message().startsWith("chain.insert failed after work started; effects may have applied: attempted "
            + attempted + " source(s): ");
    }
    private static boolean plain(Capture reply) { return reply.error != null && !reply.message().contains("effects may have applied"); }

    public static void main(String[] args) throws Exception {
        preset = Files.createTempFile("chain-insert-", ".bwpreset");
        try {
            tests();
        } finally { Files.delete(preset); }
        System.out.println("ChainInsertHandlersTest: " + groups + " test groups passed.");
    }

    private static void tests() {
        run("delayed count delivery preserves request order and the reply follows the final landing", () -> {
            for (int[] delays : new int[][] {{0, 0, 0, 0}, {50, 1, 300, 7}, {2000, 9000, 5, 4000}}) {
                Model m = new Model(6);
                for (int i = 0; i < delays.length; i++) m.delays.put(i, delays[i]);
                JsonObject vst3 = source("vst3", "0123456789ABCDEF0123456789ABCDEF");
                JsonObject clap = source("clap", "org.example.effect");
                JsonObject file = source("preset", preset.toString());
                Capture r = m.send(request("layer-2", 0, nativeSource(1), vst3, clap, file));
                check(r.error == null, "ordered insertion: " + r.error);
                check(m.chains.get(2).equals(devices("native:00000000-0000-0000-0000-000000000001",
                    "vst3:0123456789ABCDEF0123456789ABCDEF", "clap:org.example.effect", "preset:" + preset)), "request order");
                check(r.countsAtReply.get(2) == 4 && m.landings.isEmpty(), "reply only after the final count");
                JsonObject v = r.value;
                check(v.get("success").getAsBoolean() && v.get("route").getAsString().equals("chain-insert-v1")
                    && v.get("attempted").getAsInt() == 4 && v.get("landed").getAsInt() == 4
                    && v.get("chainIndex").getAsInt() == 2 && v.get("chainName").getAsString().equals("layer-2")
                    && v.get("chainChannelId").getAsString().equals("id-2")
                    && v.get("containerName").getAsString().equals("FX Layer") && v.get("position").getAsInt() == 1
                    && v.get("dependencyPolls").getAsInt() >= 5 && v.get("aim").isJsonObject(), "reply fields: " + v);
                check(m.bank.position == 0 && m.gate.blockedReason() == null, "window restored without a latch");
                for (int i = 0; i < 6; i++) if (i != 2) check(m.chains.get(i).isEmpty(), "unrelated chains preserved");
            }
        });
        run("append to a populated chain on a later layer page", () -> {
            for (int chain : new int[] {7, 11}) {
                Model m = new Model(12);
                m.chains.get(chain).addAll(List.of("a", "b", "c", "d"));
                m.delays.put(0, 100);
                Capture r = m.send(request("layer-" + chain, 4, nativeSource(1), source("clap", "org.example.effect")));
                check(r.error == null, "append: " + r.error);
                check(m.chains.get(chain).equals(devices("a", "b", "c", "d", "native:00000000-0000-0000-0000-000000000001",
                    "clap:org.example.effect")), "appended after existing devices");
                check(m.calls.stream().allMatch(c -> c.startsWith(chain + ":")), "absolute target across pages");
                check(r.value.get("chainIndex").getAsInt() == chain && r.value.get("landed").getAsInt() == 2, "absolute chain index");
                check(m.bank.position == 0, "layer window restored");
            }
        });
        run("a wrong initial count refuses before any setter", () -> {
            Model higher = new Model(6); higher.chains.get(2).addAll(List.of("a", "b"));
            Capture r = higher.send(request("layer-2", 0));
            check(plain(r) && r.message().contains("unexpected device population") && higher.calls.isEmpty(), "higher count: " + r.message());
            check(higher.clock < 100 * MS, "an excess count refuses without waiting");
            Model lower = new Model(6);
            Capture slow = lower.send(request("layer-2", 3));
            check(plain(slow) && slow.message().contains("chain holds 0 devices; expected 3") && lower.calls.isEmpty(),
                "lower count: " + slow.message());
            check(lower.clock >= ChainInsertHandlers.WAIT_MS * MS, "a short count waits for a late observer first");
        });
        run("absent, duplicate and mismatched chains refuse before any setter", () -> {
            Model absent = new Model(6);
            Capture r = absent.send(request("missing", 0));
            check(plain(r) && r.message().contains("no chain is named") && absent.calls.isEmpty(), "absent chain");
            for (int duplicate : new int[] {3, 9}) {
                Model m = new Model(12); m.names.set(duplicate, "layer-1");
                Capture d = m.send(request("layer-1", 0));
                check(plain(d) && d.message().contains("more than one chain") && m.calls.isEmpty(), "duplicate chain name across pages");
            }
            Model channel = new Model(6);
            JsonObject p = request("layer-2", 0); p.addProperty("expectedChannelId", "id-3");
            check(plain(channel.send(p)) && channel.calls.isEmpty(), "channel id mismatch");
            Model matched = new Model(6);
            JsonObject q = request("layer-2", 0); q.addProperty("expectedChannelId", "id-2");
            check(matched.send(q).error == null && matched.calls.size() == 1, "matching channel id");
            for (String field : List.of("expectedTrackChannelId", "expectedContainerName")) {
                Model m = new Model(6); JsonObject wrong = request("layer-2", 0); wrong.addProperty(field, "wrong");
                check(plain(m.send(wrong)) && m.calls.isEmpty(), "stale identity refuses " + field);
            }
            Model empty = new Model(6); JsonObject far = request("layer-2", 0); far.addProperty("position", 5);
            Capture e = empty.send(far);
            check(plain(e) && e.message().contains("no device") && empty.calls.isEmpty(), "absent container");
            check(empty.send(request("layer-2", 0)).error == null, "a refusal clears the busy flag");
        });
        run("the final landing bounds the reply and its timeout reports possible effects", () -> {
            Model slow = new Model(6); slow.delays.put(1, 3000);
            Capture r = slow.send(request("layer-2", 0, nativeSource(1), nativeSource(2)));
            check(r.error == null && r.countsAtReply.get(2) == 2 && r.clockAtReply >= 3000 * MS, "reply waits for a slow final load");
            Model lost = new Model(6); lost.neverLand.add(1);
            Capture t = lost.send(request("layer-2", 0, nativeSource(1), nativeSource(2)));
            check(possibleEffects(t, 2) && t.message().contains("source 1 did not land within 10000 ms"), "final timeout: " + t.message());
            check(lost.calls.size() == 2 && lost.chains.get(2).size() == 1 && lost.bank.position == 0, "retained partial effects");
            check(t.clockAtReply >= ChainInsertHandlers.WAIT_MS * MS && t.clockAtReply < 11_000 * MS, "time-bounded wait");
        });
        run("a missing intermediate landing stops without further setters", () -> {
            Model m = new Model(6); m.neverLand.add(0);
            Capture r = m.send(request("layer-2", 0, nativeSource(1), nativeSource(2), nativeSource(3)));
            check(possibleEffects(r, 1) && r.message().contains("source 0 did not land") && m.calls.size() == 1,
                "no further setter: " + r.message());
            Model late = new Model(6); late.delays.put(0, 9900);
            check(late.send(request("layer-2", 0, nativeSource(1), nativeSource(2))).error == null
                && late.chains.get(2).size() == 2, "a load within the time bound continues");
        });
        run("the entire request is validated before navigation", () -> {
            List<JsonObject> bad = new ArrayList<>();
            for (JsonObject invalid : List.of(source("native", "bad"), source("native", "00000000-0000-0000-0000-00000000000A"),
                    source("vst3", "bad"), source("clap", " padded "), source("clap", "a\u0001b"),
                    source("preset", "/missing.bwpreset"), source("preset", "relative.bwpreset"), source("other", "x"))) {
                bad.add(request("layer-2", 0, nativeSource(1), source("vst3", "0123456789ABCDEF0123456789ABCDEF"),
                    invalid, nativeSource(4)));
            }
            JsonObject nine = request("layer-2", 0); for (int i = 0; i < 8; i++) nine.getAsJsonArray("sources").add(nativeSource(i + 2));
            bad.add(nine);
            JsonObject none = request("layer-2", 0); none.add("sources", new JsonArray()); bad.add(none);
            JsonObject notArray = request("layer-2", 0); notArray.addProperty("sources", "x"); bad.add(notArray);
            for (String field : List.of("position", "expectedDeviceCount"))
                for (String raw : List.of("-1", "1.5", "2147483648", "\"5\"", "null")) {
                    JsonObject p = request("layer-2", 0); p.add(field, JsonParser.parseString(raw)); bad.add(p);
                }
            for (String field : List.of("expectedTrackChannelId", "expectedContainerName", "expectedChainName")) {
                JsonObject missing = request("layer-2", 0); missing.remove(field); bad.add(missing);
                JsonObject blank = request("layer-2", 0); blank.addProperty(field, " "); bad.add(blank);
            }
            JsonObject blankChannel = request("layer-2", 0); blankChannel.addProperty("expectedChannelId", ""); bad.add(blankChannel);
            JsonObject enabledOnly = request("layer-2", 0); enabledOnly.add("expectedDeviceEnabled", new JsonArray()); bad.add(enabledOnly);
            for (JsonObject p : bad) {
                Model m = new Model(6);
                Capture r = m.send(p);
                check(plain(r) && m.calls.isEmpty() && m.scopes.status().get("aims").getAsInt() == 0, "validation precedes aim: " + p);
            }
            Model m = new Model(6);
            Capture third = m.send(bad.get(0));
            check(third.message().startsWith("sources[2]: "), "the invalid source is named: " + third.message());
            Model eight = new Model(6); JsonObject p = request("layer-2", 0);
            for (int i = 0; i < 7; i++) p.getAsJsonArray("sources").add(nativeSource(i + 2));
            check(eight.send(p).error == null && eight.chains.get(2).size() == 8, "eight sources are accepted");
        });
        run("the optional top-level guard is complete and checked before insertion", () -> {
            for (String mode : List.of("match", "name", "enabled", "length")) {
                Model m = new Model(6);
                JsonObject p = request("layer-2", 0);
                JsonArray names = new JsonArray(), enabled = new JsonArray();
                for (String name : m.top) { names.add(name); enabled.add(true); }
                if (mode.equals("name")) names.set(2, new JsonPrimitive("Other"));
                if (mode.equals("enabled")) enabled.set(1, new JsonPrimitive(false));
                if (mode.equals("length")) { names.remove(2); enabled.remove(2); }
                p.add("expectedDeviceNames", names); p.add("expectedDeviceEnabled", enabled);
                Capture r = m.send(p);
                if (mode.equals("match")) check(r.error == null && m.calls.size() == 1, "matching guard: " + r.error);
                else check(plain(r) && m.calls.isEmpty(), "guard mismatch refuses: " + mode);
            }
        });
        run("an identity change mid-run stops after the attempted source", () -> {
            for (String change : List.of("container", "track", "chain", "scope")) {
                Model m = new Model(12);
                m.onInsert = () -> {
                    switch (change) {
                        case "container" -> m.container = "Other";
                        case "track" -> m.track = "track-b";
                        case "chain" -> m.names.set(9, "renamed");
                        default -> m.scopeLost = true;
                    }
                };
                Capture r = m.send(request("layer-9", 0, nativeSource(1), nativeSource(2)));
                check(possibleEffects(r, 1) && m.calls.size() == 1, change + " change stops: " + r.message());
            }
        });
        run("restore failure blocks writes before queued work can run", () -> {
            Model m = new Model(12); m.failRestore = true;
            Capture first = new Capture(m), queued = new Capture(m);
            m.registry.dispatch("chain.insert", request("layer-9", 0), first);
            m.registry.dispatch("chain.insert", request("layer-1", 0), queued); m.drain();
            check(possibleEffects(first, 1) && m.gate.blockedReason() != null, "restore failure latched: " + first.message());
            check(queued.replies == 1 && queued.error != null && m.calls.size() == 1, "queued write refused");
            m.released(first);
        });
        run("a concurrent request is refused while one is in progress", () -> {
            Model m = new Model(6);
            Capture second = new Capture(m);
            m.onInsert = () -> { if (second.replies == 0) m.registry.invokeAsync("chain.insert", request("layer-3", 0), second); };
            Capture first = m.send(request("layer-2", 0));
            check(first.error == null && second.replies == 1 && second.message().contains("in progress"), "busy refusal: " + second.message());
            check(m.calls.size() == 1 && m.chains.get(3).isEmpty(), "the refused request has no effect");
            Capture queuedA = new Capture(m), queuedB = new Capture(m);
            m.registry.dispatch("chain.insert", request("layer-4", 0), queuedA);
            m.registry.dispatch("chain.insert", request("layer-5", 0), queuedB); m.drain();
            check(queuedA.error == null && queuedB.error == null && m.calls.size() == 3, "gated requests run in turn");
        });
        run("a stuck layer page refuses without effects", () -> {
            Model m = new Model(12); m.stuck = true;
            check(plain(m.send(request("layer-9", 0))) && m.calls.isEmpty(), "stuck page");
        });
    }
}
