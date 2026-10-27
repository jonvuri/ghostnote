package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Bridge;
import com.ghostnote.extension.ContainerScopes;
import com.ghostnote.extension.RuntimeProfile;
import com.ghostnote.extension.WriteGate;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

/** Runs the registered product handlers with deferred host observers, independent state, and the real gate. */
public final class ChainControlHandlersTest {
    private static int groups;
    private static final class Layer {
        final String id;
        String name;
        boolean solo;
        Layer(String id, String name, boolean solo) { this.id = id; this.name = name; this.solo = solo; }
        Layer copy() { return new Layer(id, name, solo); }
    }

    private static final class Model implements ChainControlHandlers.Host, ContainerScopes.Scopes {
        final ArrayDeque<Runnable> tasks = new ArrayDeque<>();
        final List<Layer> actual = new ArrayList<>();
        final List<String> writes = new ArrayList<>();
        final WriteGate gate = new WriteGate(tasks::add, () -> 0L, 8);
        final ContainerScopes scopes = new ContainerScopes(this);
        final HandlerRegistry registry = new HandlerRegistry(RuntimeProfile.NORMAL, gate);
        final Bank[] banks = {new Bank(), new Bank(), new Bank()};
        final int[] wanted = {0, 1, 2}, reported = {0, 1, 2};
        String track = "track-a", selected;
        boolean noDuplicate, throwAfterDuplicate, failRestoreAfterWrite, corruptDuplicate, stopAfterSolo;
        int duplicates, stalePages;

        Model(int count) {
            for (int i = 0; i < count; i++) actual.add(new Layer("id-" + i, "layer-" + i, false));
            refresh();
            new ChainControlHandlers(this).register(registry);
        }
        public ContainerScopes scopes() { return scopes; }
        public ChainControlHandlers.Layers layers(int slot) { return banks[slot]; }
        public String track() { return track; }
        public String containerName(int slot) { return "FX Layer"; }
        public void validate(int slot, int position, String expected) {
            if (!track.equals(expected) || reported[slot] != position) throw new IllegalStateException("target changed");
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
        public String describe(int slot) { return "model scope " + slot; }
        public String scopeStatus(int slot) { return "held"; }
        public WriteGate.Lease writeLease() { return gate.writeLease(); }

        void refresh() { for (Bank bank : banks) bank.refresh(); }
        void drain() {
            int steps = 0;
            while (!tasks.isEmpty()) {
                check(steps++ < 20000, "bounded work");
                tasks.remove().run();
            }
        }
        Capture send(String method, JsonObject params) {
            Capture capture = new Capture();
            registry.dispatch(method, params, capture);
            drain();
            check(capture.replies == 1 && !scopes.open() && gate.leases() == 0, "one reply, closed aim, released lease");
            return capture;
        }
        void restored() {
            for (Bank bank : banks) check(bank.position == 0 && bank.seenPosition == 0, "restored bank and item observers");
            check(gate.blockedReason() == null || gate.blockedReason().isEmpty(), "no false restoration latch");
        }

        final class Bank implements ChainControlHandlers.Layers {
            int position, seenPosition, scrolls;
            List<Layer> seen = new ArrayList<>();
            boolean stuck;
            void refresh() {
                seenPosition = position;
                seen = actual.stream().skip(position).limit(width()).map(Layer::copy).toList();
            }
            public int width() { return 5; }
            public int count() { return actual.size(); }
            public int position() { return position; }
            public void scroll(int target) {
                scrolls++;
                if (stuck || (failRestoreAfterWrite && !writes.isEmpty() && target == 0)) return;
                tasks.add(() -> {
                    position = Math.min(target, Math.max(0, count() - width()));
                    tasks.add(this::refresh); // Reported position arrives before the item observers.
                });
            }
            public JsonArray snapshot() {
                if (position != seenPosition) stalePages++;
                JsonArray rows = new JsonArray();
                for (int i = 0; i < seen.size(); i++) {
                    Layer layer = seen.get(i);
                    JsonObject row = new JsonObject();
                    row.addProperty("index", position + i);
                    row.addProperty("channelId", layer.id);
                    row.addProperty("name", layer.name);
                    row.addProperty("solo", layer.solo);
                    rows.add(row);
                }
                return rows;
            }
            Layer local(int local) {
                check(position == seenPosition && local >= 0 && local < width(), "writer uses a settled in-range handle");
                String id = seen.get(local).id;
                return actual.stream().filter(layer -> layer.id.equals(id)).findFirst().orElseThrow();
            }
            public void select(int local) {
                String id = local(local).id;
                writes.add("select:" + id);
                tasks.add(() -> selected = id);
            }
            public void duplicate(int local) {
                String source = local(local).id;
                check(source.equals(selected), "duplicate uses the selection made in the earlier operation");
                writes.add("duplicate:" + source);
                if (noDuplicate) return;
                // Independent host state changes; observer rows arrive in a later task.
                int index = actual.indexOf(local(local));
                Layer copy = new Layer("new-" + ++duplicates, actual.get(index).name, actual.get(index).solo);
                actual.add(corruptDuplicate ? 0 : index + 1, copy);
                tasks.add(Model.this::refresh);
                if (throwAfterDuplicate) throw new IllegalStateException("uncertain duplicate");
            }
            public void name(int local, String name) {
                Layer layer = local(local); writes.add("name:" + layer.id); layer.name = name;
                tasks.add(Model.this::refresh);
            }
            public void solo(int local, boolean value) {
                Layer layer = local(local); writes.add("solo:" + layer.id + ":" + value); layer.solo = value;
                if (stopAfterSolo) stuck = true;
                tasks.add(Model.this::refresh);
            }
            public void exclusiveSolo(int local) {
                Layer target = local(local); writes.add("exclusive:" + target.id);
                check(!target.solo, "never toggle an already-soloed target off");
                for (Layer layer : actual) layer.solo = layer == target;
                tasks.add(Model.this::refresh);
            }
        }
    }

    private static class Capture implements Bridge.Reply {
        JsonObject value;
        Exception error;
        int replies;
        public void result(JsonElement value, long queued) { this.value = value.getAsJsonObject(); replies++; }
        public void error(Exception error, long queued) { this.error = error; replies++; }
    }
    private static JsonObject params(int index) {
        JsonObject params = new JsonObject();
        params.addProperty("position", 17);
        params.addProperty("chainIndex", index);
        params.addProperty("expectedName", "layer-" + index);
        params.addProperty("expectedChannelId", "id-" + index);
        params.addProperty("expectedTrackChannelId", "track-a");
        return params;
    }
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
    private static void run(String name, Runnable test) {
        test.run(); groups++; System.out.println("PASS " + name);
    }

    public static void main(String[] args) {
        run("solo writes at first, sixth and eleventh chains preserve every other flag", () -> {
            for (int count : new int[] {5, 6, 11}) for (int target : new int[] {0, count - 1}) {
                Model model = new Model(count);
                model.actual.get(1).solo = true; model.refresh();
                JsonObject p = params(target); p.addProperty("solo", true);
                Capture result = model.send("chain.setSolo", p);
                check(result.error == null, "solo result: " + result.error);
                for (int i = 0; i < count; i++) check(model.actual.get(i).solo == (i == target || i == 1), "unrelated solo unchanged");
                check(result.value.get("chainIndex").getAsInt() == target, "reply keeps the absolute index");
                model.restored();
            }
        });
        run("activation clears multi-solo flags on every page, including when the target is already soloed", () -> {
            for (boolean on : new boolean[] {false, true}) for (int target : new int[] {0, 5, 10}) {
                Model model = new Model(11);
                for (Layer layer : model.actual) layer.solo = true;
                model.actual.get(target).solo = on; model.refresh();
                Capture result = model.send("chain.activate", params(target));
                check(result.error == null, "activate result: " + result.error);
                for (int i = 0; i < 11; i++) check(model.actual.get(i).solo == (i == target), "exclusive result across pages");
                model.restored();
            }
        });
        run("rename finds an ID on the last page even when every name is identical", () -> {
            Model model = new Model(11);
            for (Layer layer : model.actual) layer.name = "same";
            model.refresh();
            JsonObject p = params(0); p.remove("expectedName"); p.remove("expectedChannelId");
            p.addProperty("channelId", "id-10"); p.addProperty("name", "renamed");
            Capture result = model.send("chain.setName", p);
            check(result.error == null && model.actual.get(10).name.equals("renamed"), "identity-based rename");
            for (int i = 0; i < 10; i++) check(model.actual.get(i).name.equals("same"), "preserve duplicate-name siblings");
            check(result.value.get("chainIndex").getAsInt() == 10 && model.stalePages > 0, "absolute index and delayed observers");
            model.restored();
        });
        run("duplication across the boundary restores shifted identities and the copy can be renamed", () -> {
            for (int source : new int[] {0, 4, 5, 9}) {
                Model model = new Model(11);
                check(model.send("chain.select", params(source)).error == null, "separate source selection");
                Capture duplicated = model.send("chain.duplicate", params(source));
                check(duplicated.error == null && model.actual.size() == 12 && model.duplicates == 1,
                    "one duplicate: " + duplicated.error);
                check(model.actual.get(source + 1).id.equals("new-1"), "duplicate is immediately after source");
                JsonObject rename = params(0); rename.remove("expectedName"); rename.remove("expectedChannelId");
                rename.addProperty("channelId", "new-1"); rename.addProperty("name", "copy");
                check(model.send("chain.setName", rename).error == null, "rename newly observed identity");
                check(model.actual.get(source + 1).name.equals("copy"), "copy renamed");
                for (int i = 0; i < 11; i++) {
                    Layer old = model.actual.get(i <= source ? i : i + 1);
                    check(old.id.equals("id-" + i) && old.name.equals("layer-" + i), "preserve originals");
                }
                model.restored();
            }
        });
        run("a duplicate no-op or thrown partial write is never repeated", () -> {
            for (boolean noOp : new boolean[] {true, false}) {
                Model model = new Model(11); model.noDuplicate = noOp; model.throwAfterDuplicate = !noOp;
                model.selected = "id-5";
                Capture result = model.send("chain.duplicate", params(5));
                check(model.writes.stream().filter(w -> w.startsWith("duplicate:")).count() == 1, "one attempt only");
                check(model.actual.size() == (noOp ? 11 : 12), "retain actual effects");
                if (noOp) check(result.error == null, "acknowledgement is not proof of duplication");
                else check(result.error != null && result.error.getMessage().contains("effects may have applied"), "truthful uncertain result");
                model.restored();
            }
        });
        run("malformed indices, stale identity, missing IDs and wrong track refuse without a write", () -> {
            for (String raw : new String[] {"-1", "1.5", "2147483648", "\"5\"", "null"}) {
                Model model = new Model(6); JsonObject p = params(5); p.add("chainIndex", JsonParser.parseString(raw));
                p.addProperty("solo", true);
                check(model.send("chain.setSolo", p).error != null && model.writes.isEmpty(), "invalid index refusal");
                check(model.scopes.status().get("aims").getAsInt() == 0, "validate before aim");
            }
            for (String field : new String[] {"expectedName", "expectedChannelId", "expectedTrackChannelId"}) {
                Model model = new Model(6); JsonObject p = params(5); p.addProperty(field, "wrong"); p.addProperty("solo", true);
                check(model.send("chain.setSolo", p).error != null && model.writes.isEmpty(), "stale target refuses: " + field);
                model.restored();
            }
            Model model = new Model(6); JsonObject p = params(0); p.addProperty("channelId", "missing"); p.addProperty("name", "new");
            check(model.send("chain.setName", p).error != null && model.writes.isEmpty(), "rename never falls back to index");
            model.restored();
        });
        run("stuck navigation refuses before any write", () -> {
            Model model = new Model(6); for (var bank : model.banks) bank.stuck = true;
            JsonObject p = params(5); p.addProperty("solo", true);
            check(model.send("chain.setSolo", p).error != null && model.writes.isEmpty(), "bounded refusal");
            model.restored();
        });
        run("duplicate channel IDs across pages refuse without writing", () -> {
            Model model = new Model(6);
            model.actual.set(5, new Layer("id-0", "layer-5", false)); model.refresh();
            JsonObject p = params(5); p.addProperty("solo", true);
            check(model.send("chain.setSolo", p).error != null && model.writes.isEmpty(), "ambiguous identity refuses");
            model.restored();
        });
        run("activation reports partial effects when a later page cannot be acquired", () -> {
            Model model = new Model(11); model.stopAfterSolo = true;
            model.actual.get(0).solo = true; model.actual.get(5).solo = true; model.refresh();
            Capture result = model.send("chain.activate", params(10));
            check(result.error != null && result.error.getMessage().contains("effects may have applied"), "partial failure is explicit");
            check(!model.actual.get(0).solo && model.actual.get(5).solo && !model.actual.get(10).solo
                && model.writes.size() == 1, "retain the completed clear without retrying or inventing completion");
            model.restored();
        });
        run("restoration failure preserves applied effects and blocks a queued control before lease release", () -> {
            Model model = new Model(11); model.failRestoreAfterWrite = true;
            JsonObject p = params(10); p.addProperty("solo", true);
            Capture first = new Capture(), queued = new Capture();
            model.registry.dispatch("chain.setSolo", p, first);
            JsonObject next = params(0); next.addProperty("solo", true);
            model.registry.dispatch("chain.setSolo", next, queued);
            model.drain();
            check(first.error != null && first.error.getMessage().contains("effects may have applied")
                && model.actual.get(10).solo, "preserve the applied solo and uncertain reply");
            check(queued.error != null && !model.actual.get(0).solo && model.writes.size() == 1, "queued writer refused");
            check(first.replies == 1 && queued.replies == 1 && model.gate.leases() == 0 && !model.scopes.open(), "closed exactly once");
        });
        run("an unexpected duplicate placement refuses restoration without repeating the duplicate", () -> {
            Model model = new Model(11); model.selected = "id-5"; model.corruptDuplicate = true;
            Capture result = model.send("chain.duplicate", params(5));
            check(result.error != null && model.duplicates == 1 && model.actual.size() == 12, "unexpected result remains visible");
            check(model.gate.blockedReason() != null && !model.gate.blockedReason().isEmpty(), "unproved restoration latches");
        });
        run("reply releases the scope before a batch continuation starts another control", () -> {
            Model model = new Model(6);
            JsonObject first = params(5); first.addProperty("solo", true);
            JsonObject next = params(0); next.addProperty("solo", true);
            Capture second = new Capture();
            Capture capture = new Capture() {
                public void result(JsonElement value, long queued) {
                    super.result(value, queued);
                    check(!model.scopes.open() && model.gate.leases() == 0, "release before reply");
                    model.registry.invokeAsync("chain.setSolo", next, second);
                }
            };
            model.registry.dispatch("chain.setSolo", first, capture); model.drain();
            check(capture.error == null && second.error == null && second.replies == 1
                && model.actual.get(5).solo && model.actual.get(0).solo, "both controls complete");
            model.restored();
        });
        System.out.println("Chain controls: " + groups + " test groups passed.");
    }
}
