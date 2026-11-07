package com.ghostnote.extension;

import com.google.gson.JsonArray;
import com.bitwig.extension.controller.api.Device;
import com.bitwig.extension.controller.api.DeviceBank;
import java.lang.reflect.Proxy;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

/** Host model: scroll position arrives before item observers; final pages clamp to count minus width. */
public final class WindowPagerTest {
    private static final ArrayDeque<Runnable> tasks = new ArrayDeque<>();
    private static final class Model implements WindowPager.Window {
        final int width;
        int count, position, witnessed;
        boolean stuck, refuseRestore, firstScrollSticks;
        final List<Integer> scrolls = new ArrayList<>();
        Model(int width, int count) { this.width = width; this.count = count; }
        public int width() { return width; }
        public int count() { return count; }
        public int position() { return position; }
        public void scroll(int target) {
            scrolls.add(target);
            if (stuck || (refuseRestore && target == 0) || (firstScrollSticks && scrolls.size() == 1)) return;
            tasks.add(() -> {
                position = Math.min(target, Math.max(0, count - width));
                tasks.add(() -> witnessed = position);
            });
        }
        public JsonArray snapshot() {
            if (witnessed != position) return null;
            JsonArray rows = new JsonArray();
            for (int i = position; i < Math.min(count, position + width); i++)
                rows.add(WindowPager.device(i, "device-" + i, true));
            return rows;
        }
    }
    private static final class Capture {
        JsonArray rows = new JsonArray();
        Exception error;
        WindowPager.Result result;
        int replies;
        void done(WindowPager.Result result, Exception error) { this.result = result; this.error = error; replies++; }
    }
    private static WindowPager pager() { return new WindowPager((task, ms) -> tasks.add(task)); }
    private static void drain() {
        int n = 0;
        while (!tasks.isEmpty()) { check(n++ < 10000, "bounded tasks"); tasks.remove().run(); }
    }
    private static Capture read(Model model) {
        Capture capture = new Capture();
        pager().read(model, (offset, rows, done) -> { capture.rows.addAll(rows); done.accept(null); }, capture::done);
        drain();
        check(capture.replies == 1, "one reply");
        return capture;
    }
    private static void check(boolean ok, String message) { if (!ok) throw new AssertionError(message); }
    /** Exercise the actual top-level row encoder, including delayed capability observers. */
    private static void layerCapability() {
        boolean[] layers = {false};
        int[] layerReads = {0};
        Device device = (Device) Proxy.newProxyInstance(Device.class.getClassLoader(), new Class<?>[] {Device.class},
            (proxy, method, args) -> Proxy.newProxyInstance(method.getReturnType().getClassLoader(),
                new Class<?>[] {method.getReturnType()}, (value, accessor, ignored) -> {
                    if (!accessor.getName().equals("get")) throw new AssertionError(accessor.getName());
                    return switch (method.getName()) {
                        case "exists", "isEnabled" -> true;
                        case "position" -> 0;
                        case "name" -> "FX Layer";
                        case "hasLayers" -> { layerReads[0]++; yield layers[0]; }
                        default -> throw new AssertionError(method.getName());
                    };
                }));
        DeviceBank bank = (DeviceBank) Proxy.newProxyInstance(DeviceBank.class.getClassLoader(),
            new Class<?>[] {DeviceBank.class}, (proxy, method, args) -> {
                if (method.getName().equals("getDevice")) return device;
                return Proxy.newProxyInstance(method.getReturnType().getClassLoader(),
                    new Class<?>[] {method.getReturnType()}, (value, accessor, ignored) -> {
                        if (!accessor.getName().equals("get")) throw new AssertionError(accessor.getName());
                        return method.getName().equals("itemCount") ? 1 : 0;
                    });
            });
        JsonArray nested = new DeviceWindow(bank, 1).snapshot();
        check(layerReads[0] == 0 && !nested.get(0).getAsJsonObject().has("hasLayers"),
            "nested windows do not read an unsubscribed capability");
        Capture capture = new Capture();
        pager().read(new DeviceWindow(bank, 1, true),
            (offset, rows, done) -> { capture.rows.addAll(rows); done.accept(null); }, capture::done);
        layers[0] = true; // The name/position arrived before the capability.
        drain();
        check(capture.error == null && capture.replies == 1 && capture.result.polls() == 3,
            "capability must agree on two tasks before the page is accepted");
        check(capture.rows.get(0).getAsJsonObject().get("hasLayers").getAsBoolean(), "complete capability row");
    }
    public static void main(String[] args) {
        layerCapability();
        for (int[] shape : new int[][] {{5, 6}, {4, 5}, {16, 17}, {4, 11}, {4, 0}, {4, 4}}) {
            Model model = new Model(shape[0], shape[1]);
            Capture capture = read(model);
            check(capture.error == null && capture.rows.size() == shape[1], "complete count");
            for (int i = 0; i < shape[1]; i++)
                check(capture.rows.get(i).getAsJsonObject().get("index").getAsInt() == i, "absolute unique indices");
            check(model.position == 0 && model.witnessed == 0, "restore before reply");
            check(capture.result.pages() == Math.max(1, (shape[1] + shape[0] - 1) / shape[0]), "page count");
        }
        Model clamped = new Model(4, 5); clamped.firstScrollSticks = true;
        check(read(clamped).error == null && clamped.scrolls.size() >= 3, "reissue clamped scroll");
        Model hung = new Model(4, 5); hung.stuck = true;
        Capture refused = read(hung);
        check(refused.error != null && !(refused.error instanceof WindowPager.RestoreFailure), "hung page refuses after restoring");
        Model unrestored = new Model(4, 5); unrestored.refuseRestore = true;
        check(read(unrestored).error instanceof WindowPager.RestoreFailure, "restoration failure distinguished");
        Capture unreadable = new Capture();
        pager().read(new WindowPager.Window() {
            public int width() { return 5; }
            public int count() { return 4; }
            public int position() { return 0; }
            public void scroll(int target) { check(target == 0, "no navigation away from zero"); }
            public JsonArray snapshot() { return null; }
        }, (offset, rows, next) -> next.accept(null), unreadable::done);
        drain();
        check(unreadable.error != null && !(unreadable.error instanceof WindowPager.RestoreFailure),
            "an unreadable window that stayed at zero refuses without a false restoration latch");

        Model changing = new Model(4, 5);
        Capture changed = new Capture();
        pager().read(changing, (offset, rows, done) -> { changing.count++; done.accept(null); }, changed::done);
        drain();
        check(changed.error != null && changing.position == 0 && changed.replies == 1, "count change refuses once");

        Model pending = new Model(4, 5);
        int[] requested = {0};
        Capture canceled = new Capture();
        pager().read(new WindowPager.Window() {
            public int width() { return pending.width(); }
            public int count() { return pending.count(); }
            public int position() { return 0; }
            public void scroll(int target) { requested[0] = target; }
            public JsonArray snapshot() { return pending.snapshot(); }
        }, (offset, rows, next) -> next.accept(null), canceled::done);
        while (requested[0] == 0) tasks.remove().run();
        pending.count++;
        drain();
        check(canceled.error != null && canceled.replies == 1 && requested[0] == 0,
            "a refused read actively cancels navigation whose position has not arrived");

        Model failedOuter = new Model(5, 6);
        Capture nestedFailure = new Capture();
        pager().read(failedOuter, (offset, rows, next) -> {
            if (offset == 0) { next.accept(null); return; }
            next.accept(new WindowPager.RestoreFailure(new IllegalStateException("inner failed")));
        }, nestedFailure::done);
        drain();
        check(nestedFailure.error instanceof WindowPager.RestoreFailure && failedOuter.position == 0,
            "an inner restore failure does not leave the outer read window displaced");

        Model outer = new Model(5, 6);
        Capture nested = new Capture();
        WriteGate gate = new WriteGate(tasks::add, () -> 0L, 8);
        var lease = gate.writeLease();
        List<String> order = new ArrayList<>();
        pager().read(outer, (offset, rows, done) -> {
            Model inner = new Model(4, 5);
            pager().read(inner, (at, devices, next) -> next.accept(null), (report, error) -> {
                check(inner.position == 0, "nested restore before outer advance"); done.accept(error);
            });
        }, (report, error) -> { nested.done(report, error); lease.release(); order.add("reply"); });
        gate.submit(WriteGate.Kind.WRITE, waited -> order.add("write"));
        drain();
        check(nested.error == null && outer.position == 0 && gate.leases() == 0, "nested paging and lease");
        check(order.equals(List.of("reply", "write")), "writer waits until reply and restoration");
        for (int count : new int[] {6, 11}) {
            Model layers = new Model(5, count);
            LayerPageWitness witness = new LayerPageWitness();
            Capture captured = new Capture();
            int[] stalePages = {0};
            pager().read(new WindowPager.Window() {
                public int width() { return layers.width(); }
                public int count() { return layers.count(); }
                public int position() { return layers.position(); }
                public void scroll(int target) { layers.scroll(target); }
                public JsonArray snapshot() {
                    JsonArray rows = new JsonArray();
                    for (int i = 0; i < Math.min(width(), count() - position()); i++) {
                        var row = WindowPager.device(position() + i, "same layer name", true);
                        row.addProperty("channelId", "layer-" + (layers.witnessed + i));
                        row.addProperty("reportedChannelIndex", 999); // Not an index within this bank.
                        rows.add(row);
                    }
                    if (!witness.matches(rows)) { stalePages[0]++; return null; }
                    return rows;
                }
            }, (offset, rows, next) -> { witness.accept(rows); captured.rows.addAll(rows); next.accept(null); }, captured::done);
            drain();
            check(captured.error == null && captured.rows.size() == count && layers.position == 0,
                "layer ids stitch and restore without assuming local channelIndex");
            check(stalePages[0] > 0, "old ids at newly reported positions cannot settle");
            var collision = captured.rows.get(0).deepCopy().getAsJsonObject();
            collision.addProperty("channelId", "layer-1");
            JsonArray bad = new JsonArray(); bad.add(collision);
            check(!witness.matches(bad), "identity at another absolute index refuses");
        }
        check(RuntimeProfile.kind("device.list") == WriteGate.Kind.WRITE, "paged read serializes with writers");
        // Batch invocation bypasses submit, so it must honor a failed-restoration latch too.
        var registry = new com.ghostnote.extension.handlers.HandlerRegistry(RuntimeProfile.NORMAL, gate);
        int[] writes = {0}, errors = {0}, replies = {0};
        registry.on("device.delete", params -> { writes[0]++; return new JsonArray(); });
        registry.on("ping", params -> new JsonArray());
        registry.onAsync("chain.observe", (params, reply) -> { writes[0]++; reply.result(new JsonArray(), 0); });
        Bridge.Reply reply = new Bridge.Reply() {
            public void result(com.google.gson.JsonElement value, long queued) { replies[0]++; }
            public void error(Exception error, long queued) { errors[0]++; }
        };
        var held = gate.writeLease();
        registry.dispatch("device.delete", new com.google.gson.JsonObject(), reply);
        gate.blockWrites("test restoration failure");
        held.release();
        drain();
        registry.dispatch("device.delete", new com.google.gson.JsonObject(), reply);
        registry.invokeAsync("device.delete", new com.google.gson.JsonObject(), reply);
        registry.invokeAsync("chain.observe", new com.google.gson.JsonObject(), reply);
        registry.dispatch("ping", new com.google.gson.JsonObject(), reply);
        check(writes[0] == 0 && errors[0] == 4 && replies[0] == 1 && gate.leases() == 0,
            "queued, fresh and batch writes refuse; diagnostics still reply; no lease leaked");
        System.out.println("PASS WindowPager: boundaries, overlap, delayed witnesses, retries, refusal, restoration, nested leases");
    }
}
