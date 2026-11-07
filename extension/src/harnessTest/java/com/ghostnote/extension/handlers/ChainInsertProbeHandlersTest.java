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
import java.nio.file.Files;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

/** Research-route admission, deferred page observers and one-shot failure semantics. */
public final class ChainInsertProbeHandlersTest {
    private static final class Model implements ChainInsertProbeHandlers.Host, ContainerScopes.Scopes {
        final ArrayDeque<Runnable> tasks = new ArrayDeque<>();
        final WriteGate gate = new WriteGate(tasks::add, () -> 0L, 8);
        final ContainerScopes scopes = new ContainerScopes(this);
        final HandlerRegistry registry = new HandlerRegistry(RuntimeProfile.PROBE, gate);
        final int[] wanted = {0, 1, 2}, reported = {0, 1, 2};
        final Bank bank = new Bank();
        final List<String> calls = new ArrayList<>(), effects = new ArrayList<>();
        final int[] counts = new int[6];
        String track = "track-a", scratch = ChainInsertProbeHandlers.SCRATCH;
        int failAt, stalePages;
        boolean noOp, failRestore, stuck;
        Model() { new ChainInsertProbeHandlers(this).register(registry); }
        public ContainerScopes scopes() { return scopes; }
        public String trackId() { return track; }
        public String trackName() { return scratch; }
        public String containerName(int slot) { return "FX Layer"; }
        public boolean ready(int slot, int position, String expected) { return expected.equals(track) && reported[slot] == position; }
        public WindowPager.Window layers(int slot) { return bank; }
        public int deviceCount(int slot, int local) { return counts[bank.seenPosition + local]; }
        public void insert(int slot, int local, ChainInsertProbeHandlers.Source source) {
            check(gate.writeLeases() == 1 && scopes.open(), "insertion holds the write lease and scope");
            check(bank.position == bank.seenPosition, "writer uses settled item observers");
            check(counts[bank.position + local] >= calls.size(), "preceding device must land before the next setter");
            String value = (bank.position + local) + ":" + source.kind() + ":" + source.value();
            calls.add(value);
            if (!noOp) {
                effects.add(value);
                int absolute = bank.position + local;
                // Device-count observer arrives separately from the setter's return.
                tasks.add(() -> tasks.add(() -> counts[absolute]++));
            }
            if (calls.size() == failAt) throw new IllegalStateException("injected after effect");
        }
        public void schedule(Runnable task, int ms) { tasks.add(task); }
        public void blockWrites(String reason) { gate.blockWrites(reason); }
        public int scopeCount() { return 3; }
        public int deviceBank() { return 16; }
        public boolean held(int slot) { return true; }
        public int requestedPosition(int slot) { return wanted[slot]; }
        public boolean settled(int slot) { return wanted[slot] == reported[slot]; }
        public void scroll(int slot, int position) { wanted[slot] = position; tasks.add(() -> reported[slot] = position); }
        public int deviceCount() { return 18; }
        public String trackChannelId() { return track; }
        public String describe(int slot) { return "model"; }
        public String scopeStatus(int slot) { return "held"; }
        public WriteGate.Lease writeLease() { return gate.writeLease(); }
        void drain() {
            int steps = 0;
            while (!tasks.isEmpty()) { check(steps++ < 20000, "bounded tasks"); tasks.remove().run(); }
        }
        Capture send(JsonObject p) {
            Capture reply = new Capture(); registry.dispatch("probe.chainInsert", p, reply); drain();
            check(reply.replies == 1 && !scopes.open() && gate.leases() == 0, "one reply and released handles");
            return reply;
        }
        JsonObject status() { return send(operation("status")).value; }
        final class Bank implements WindowPager.Window {
            int position, seenPosition;
            public int width() { return 5; }
            public int count() { return 6; }
            public int position() { return position; }
            public void scroll(int target) {
                if (stuck || (failRestore && !calls.isEmpty() && target == 0)) return;
                tasks.add(() -> { position = Math.min(target, 1); tasks.add(() -> seenPosition = position); });
            }
            public JsonArray snapshot() {
                if (position != seenPosition) stalePages++;
                JsonArray rows = new JsonArray();
                for (int i = 0; i < Math.min(5, 6 - seenPosition); i++) {
                    JsonObject row = new JsonObject();
                    row.addProperty("index", position + i);
                    row.addProperty("channelId", "id-" + (seenPosition + i));
                    row.addProperty("name", "layer-" + (seenPosition + i));
                    rows.add(row);
                }
                return rows;
            }
        }
    }
    private static final class Capture implements Bridge.Reply {
        JsonObject value; Exception error; int replies;
        public void result(JsonElement value, long queued) { this.value = value.getAsJsonObject(); replies++; }
        public void error(Exception error, long queued) { this.error = error; replies++; }
    }
    private static JsonObject operation(String op) { JsonObject p = new JsonObject(); p.addProperty("operation", op); return p; }
    private static JsonObject source(String kind, String value) {
        JsonObject s = new JsonObject(); s.addProperty("kind", kind); s.addProperty("value", value); return s;
    }
    private static JsonObject request(int chain) {
        JsonObject p = operation("insert");
        p.addProperty("position", 17); p.addProperty("chainIndex", chain);
        p.addProperty("expectedDeviceCount", 0);
        p.addProperty("expectedTrackChannelId", "track-a"); p.addProperty("expectedContainerName", "FX Layer");
        p.addProperty("expectedChannelId", "id-" + chain); p.addProperty("expectedChainName", "layer-" + chain);
        JsonArray sources = new JsonArray(); sources.add(source("native", "00000000-0000-0000-0000-000000000001"));
        p.add("sources", sources); return p;
    }
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }

    public static void main(String[] args) throws Exception {
        var preset = Files.createTempFile("p01-source-", ".bwpreset");
        try {
            for (int chain : new int[] {0, 5}) {
                Model m = new Model(); JsonObject p = request(chain);
                p.getAsJsonArray("sources").add(source("vst3", "0123456789ABCDEF0123456789ABCDEF"));
                p.getAsJsonArray("sources").add(source("clap", "org.example.effect"));
                p.getAsJsonArray("sources").add(source("preset", preset.toString()));
                Capture r = m.send(p);
                check(r.error == null && m.calls.size() == 4 && m.effects.equals(m.calls), "four ordered calls: " + r.error);
                check(m.calls.get(0).startsWith(chain + ":native:") && m.calls.get(1).startsWith(chain + ":vst3:")
                    && m.calls.get(2).startsWith(chain + ":clap:") && m.calls.get(3).startsWith(chain + ":preset:"), "absolute target and order");
                check(!r.value.get("verified").getAsBoolean() && m.bank.position == 0 && m.stalePages > 0, "receipt only, witnessed restoration");
                check(m.send(p).error != null && m.calls.size() == 4, "pending inspection prevents a second insertion");
                JsonObject ack = operation("acknowledge"); ack.addProperty("receipt", 100);
                check(m.send(ack).error != null, "wrong receipt refuses");
                ack.addProperty("receipt", r.value.get("receipt").getAsInt());
                check(m.send(ack).error == null && m.status().get("pendingReceipt").getAsInt() == 0, "explicit inspection acknowledgement");
            }
            for (String malformed : new String[] {"-1", "1.5", "2147483648", "\"5\"", "null"}) {
                Model m = new Model(); JsonObject p = request(5); p.add("chainIndex", JsonParser.parseString(malformed));
                check(m.send(p).error != null && m.calls.isEmpty() && m.scopes.status().get("aims").getAsInt() == 0, "bad index before navigation");
            }
            for (JsonObject bad : List.of(source("native", "bad"), source("vst3", "bad"), source("clap", " padded "),
                    source("preset", "/missing.bwpreset"), source("other", "x"))) {
                Model m = new Model(); JsonObject p = request(5); p.getAsJsonArray("sources").add(bad);
                check(m.send(p).error != null && m.calls.isEmpty() && m.scopes.status().get("aims").getAsInt() == 0, "whole source list before navigation");
            }
            for (String field : List.of("expectedTrackChannelId", "expectedContainerName", "expectedChannelId", "expectedChainName")) {
                Model m = new Model(); JsonObject p = request(5); p.addProperty(field, "wrong");
                check(m.send(p).error != null && m.calls.isEmpty(), "stale identity refuses " + field);
            }
            Model foreign = new Model(); foreign.scratch = "unrelated";
            check(foreign.send(request(0)).error != null && foreign.calls.isEmpty(), "scratch name required");
            Model missing = new Model(); check(missing.send(request(6)).error != null && missing.calls.isEmpty(), "missing chain refuses");
            Model wrongCount = new Model(); wrongCount.counts[5] = 2;
            check(wrongCount.send(request(5)).error != null && wrongCount.calls.isEmpty(), "unexpected starting count refuses before insertion");
            Model stuck = new Model(); stuck.stuck = true;
            check(stuck.send(request(5)).error != null && stuck.calls.isEmpty(), "stuck page refuses without effects");
            Model noOp = new Model(); noOp.noOp = true;
            check(!noOp.send(request(5)).value.get("verified").getAsBoolean() && noOp.effects.isEmpty(), "no-op is never called verified");
            Model blocked = new Model(); blocked.noOp = true;
            JsonObject blockedRequest = request(5); blockedRequest.getAsJsonArray("sources").add(source("clap", "org.example.never"));
            Capture blockedReply = blocked.send(blockedRequest);
            check(blockedReply.error != null && blocked.calls.size() == 1 && blocked.status().get("uncertain").getAsBoolean(),
                "a missing count landing blocks the next insertion without repeating the first");
            Model append = new Model(); append.counts[5] = 4;
            JsonObject appendRequest = request(5); appendRequest.addProperty("expectedDeviceCount", 4);
            appendRequest.getAsJsonArray("sources").add(source("clap", "org.example.effect"));
            check(append.send(appendRequest).error == null && append.counts[5] == 6 && append.calls.size() == 2,
                "append waits for delayed counts across the device-page boundary");
            Model partial = new Model(); partial.failAt = 2; JsonObject p = request(5);
            p.getAsJsonArray("sources").add(source("clap", "org.example.effect"));
            p.getAsJsonArray("sources").add(source("clap", "org.example.never"));
            Capture failed = partial.send(p);
            check(failed.error != null && failed.error.getMessage().contains("effects uncertain") && partial.effects.size() == 2, "truthful partial effects");
            check(partial.bank.position == 0 && partial.status().get("uncertain").getAsBoolean(), "restore and latch");
            JsonObject ack = operation("acknowledge"); ack.addProperty("receipt", 1);
            check(partial.send(ack).error != null && partial.send(p).error != null && partial.calls.size() == 2, "uncertain write cannot be cleared or repeated");
            Model restore = new Model(); restore.failRestore = true;
            Capture first = new Capture(), queued = new Capture();
            restore.registry.dispatch("probe.chainInsert", request(5), first);
            restore.registry.dispatch("probe.chainInsert", request(0), queued); restore.drain();
            check(first.replies == 1 && first.error != null && queued.replies == 1 && queued.error != null
                && restore.effects.size() == 1 && restore.gate.blockedReason() != null && restore.gate.leases() == 0,
                "failed restore latches the gate before queued writes can run");
            System.out.println("ChainInsertProbeHandlersTest: PASS");
        } finally { Files.delete(preset); }
    }
}
