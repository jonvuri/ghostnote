package com.ghostnote.extension;

import com.google.gson.JsonArray;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

/** Host model for write acquisition: position arrives before item observers, and writes change counts. */
public final class WindowAccessTest {
    private static final ArrayDeque<Runnable> tasks = new ArrayDeque<>();
    private static int groups;

    private static final class Model implements WindowPager.Window {
        final int width;
        final List<String> items = new ArrayList<>();
        final List<Integer> scrolls = new ArrayList<>();
        int position, witnessed;
        boolean stuck, refuseRestore, firstScrollSticks, unreadable, failPosition;

        Model(int width, int count) {
            this.width = width;
            for (int i = 0; i < count; i++) items.add("item-" + i);
        }
        public int width() { return width; }
        public int count() { return items.size(); }
        public int position() {
            if (failPosition) throw new IllegalStateException("position unavailable");
            return position;
        }
        public void scroll(int target) {
            scrolls.add(target);
            if (stuck || (refuseRestore && target == 0) || (firstScrollSticks && scrolls.size() == 1)) return;
            tasks.add(() -> {
                position = Math.min(target, Math.max(0, count() - width));
                tasks.add(() -> witnessed = position);
            });
        }
        public JsonArray snapshot() {
            if (unreadable || witnessed != position) return null;
            JsonArray page = new JsonArray();
            for (int i = position; i < Math.min(count(), position + width); i++)
                page.add(WindowPager.device(i, items.get(i), true));
            return page;
        }
        void renameLocal(int local, String name) {
            check(position == witnessed, "a write must not use stale item observers");
            check(local >= 0 && local < width, "bank-relative handle is in range");
            items.set(witnessed + local, name);
        }
    }

    private static final class Capture<T> {
        WindowAccess.Result<T> result;
        Exception error;
        int replies;
        void done(WindowAccess.Result<T> result, Exception error) {
            this.result = result; this.error = error; replies++;
        }
    }

    private static WindowAccess access() { return new WindowAccess((task, ms) -> tasks.add(task)); }
    private static void drain() {
        int n = 0;
        while (!tasks.isEmpty()) { check(n++ < 10000, "bounded scheduled work"); tasks.remove().run(); }
    }
    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
    private static void run(String name, Runnable test) {
        tasks.clear();
        test.run();
        check(tasks.isEmpty(), "no scheduled work left by " + name);
        groups++;
        System.out.println("PASS " + name);
    }

    public static void main(String[] args) {
        run("absolute targets across each boundary use the intended handle and restore", WindowAccessTest::boundaries);
        run("two endpoints in one page preserve their absolute mapping", WindowAccessTest::range);
        run("layer identity witnesses reject stale pages with identical names", WindowAccessTest::layerWitness);
        run("clamped requests reissue; refused navigation never writes", WindowAccessTest::refusals);
        run("population changes before work refuse; legitimate write effects survive restoration", WindowAccessTest::populations);
        run("work errors and duplicate callbacks never repeat the write", WindowAccessTest::oneWrite);
        run("failed restoration retains the write result and latches before queued writers run", WindowAccessTest::failedRestore);
        run("nested windows restore inside out under one lease", WindowAccessTest::nested);
        run("a nested restoration failure still restores the outer window", WindowAccessTest::nestedFailure);
        run("invalid ranges and simultaneous aliases refuse before navigation", WindowAccessTest::validation);
        run("asynchronous restoration exceptions reply once", WindowAccessTest::asyncException);
        System.out.println("Window access: " + groups + " test groups passed.");
    }

    private static void boundaries() {
        for (int[] shape : new int[][] {{5, 6}, {4, 5}, {16, 17}, {4, 11}, {16, 34}}) {
            for (int index : new int[] {0, shape[0] - 1, shape[0], shape[1] - 1}) {
                Model model = new Model(shape[0], shape[1]);
                var captured = new Capture<String>();
                int[] writes = {0};
                access().withWindow(model, index, index, (offset, page, done) -> {
                    check(page.get(index - offset).getAsJsonObject().get("name").getAsString().equals("item-" + index),
                        "settled target identity");
                    model.renameLocal(index - offset, "changed");
                    writes[0]++;
                    done.accept("applied", null);
                }, captured::done);
                check(writes[0] == 0, "no work before a separate scheduled arrival check");
                drain();
                check(captured.error == null && captured.replies == 1 && writes[0] == 1, "one successful write and reply");
                for (int i = 0; i < model.count(); i++)
                    check(model.items.get(i).equals(i == index ? "changed" : "item-" + i), "preserve unrelated items");
                check(model.position == 0 && model.witnessed == 0, "restore before reply");
                check(captured.result.workStarted() && captured.result.value().equals("applied"), "retain work result");
                if (index < model.width) check(model.scrolls.isEmpty(), "first-page write needs no scroll");
            }
        }
    }

    private static void range() {
        Model model = new Model(4, 10);
        var captured = new Capture<Void>();
        access().withWindow(model, 4, 7, (offset, page, done) -> {
            check(offset == 4 && page.size() == 4, "both endpoints are held at once");
            model.renameLocal(4 - offset, "source");
            model.renameLocal(7 - offset, "destination");
            done.accept(null, null);
        }, captured::done);
        drain();
        check(captured.error == null && model.items.get(4).equals("source") && model.items.get(7).equals("destination"),
            "both intended endpoints changed");
    }

    private static void layerWitness() {
        Model model = new Model(5, 11);
        LayerPageWitness witness = new LayerPageWitness();
        JsonArray observed = new JsonArray();
        for (int i = 0; i < model.count(); i++) {
            var row = WindowPager.device(i, "same name", true);
            row.addProperty("channelId", "layer-" + i);
            observed.add(row);
        }
        witness.accept(observed);
        int[] stale = {0};
        WindowPager.Window window = new WindowPager.Window() {
            public int width() { return model.width(); }
            public int count() { return model.count(); }
            public int position() { return model.position(); }
            public void scroll(int position) { model.scroll(position); }
            public JsonArray snapshot() {
                JsonArray page = new JsonArray();
                for (int i = 0; i < Math.min(width(), count() - position()); i++) {
                    var row = WindowPager.device(position() + i, "same name", true);
                    row.addProperty("channelId", "layer-" + (model.witnessed + i));
                    row.addProperty("reportedChannelIndex", 999);
                    page.add(row);
                }
                if (!witness.matches(page)) { stale[0]++; return null; }
                return page;
            }
        };
        var captured = new Capture<Void>();
        access().withWindow(window, 10, 10, (offset, page, done) -> {
            check(page.get(10 - offset).getAsJsonObject().get("channelId").getAsString().equals("layer-10"),
                "the target arrived by identity, not by its repeated name or channelIndex");
            done.accept(null, null);
        }, captured::done);
        drain();
        check(captured.error == null && captured.replies == 1 && stale[0] >= 2 && model.witnessed == 0,
            "reject stale arrival and restoration pages");
    }

    private static void refusals() {
        Model clamped = new Model(4, 5); clamped.firstScrollSticks = true;
        var repaired = new Capture<Void>();
        access().withWindow(clamped, 4, 4, (offset, page, done) -> done.accept(null, null), repaired::done);
        drain();
        check(repaired.error == null && clamped.scrolls.equals(List.of(1, 1, 0)), "repair a clamped scroll");
        for (boolean unreadable : new boolean[] {false, true}) {
            Model model = new Model(4, 5); model.stuck = true; model.unreadable = unreadable;
            var captured = new Capture<Void>();
            access().withWindow(model, unreadable ? 0 : 4, unreadable ? 0 : 4,
                (offset, page, done) -> { throw new AssertionError("refused navigation must not write"); }, captured::done);
            drain();
            check(captured.replies == 1 && captured.error != null
                && !(captured.error instanceof WindowPager.RestoreFailure) && !captured.result.workStarted(),
                "refuse without a false restoration latch when still at zero");
        }
        // A nonzero request may still be pending when a pre-write count change causes refusal.
        // Restoration must actively supersede it, not merely observe the old zero position twice.
        Model pending = new Model(4, 5);
        int[] requested = {0};
        var canceled = new Capture<Void>();
        access().withWindow(new WindowPager.Window() {
            public int width() { return pending.width(); }
            public int count() { return pending.count(); }
            public int position() { return 0; }
            public void scroll(int target) { requested[0] = target; }
            public JsonArray snapshot() { return pending.snapshot(); }
        }, 4, 4, (offset, page, done) -> {
            throw new AssertionError("population change must refuse before work");
        }, canceled::done);
        check(requested[0] == 1, "nonzero navigation was requested");
        pending.items.add("unexpected");
        drain();
        check(canceled.error != null && !canceled.result.workStarted() && requested[0] == 0,
            "the last host request is zero even when the earlier navigation has not arrived");
    }

    private static void populations() {
        Model changed = new Model(4, 5);
        var refused = new Capture<Void>();
        WindowAccess access = access();
        access.withWindow(changed, 4, 4, (offset, page, done) -> {
            throw new AssertionError("population changed before write");
        }, refused::done);
        changed.items.add("unexpected");
        drain();
        check(refused.error != null && !refused.result.workStarted() && changed.position == 0, "pre-write change refuses");
        for (boolean insert : new boolean[] {true, false}) {
            Model model = new Model(4, 5);
            var captured = new Capture<String>();
            access.withWindow(model, 4, 4, (offset, page, done) -> {
                if (insert) model.items.add("new");
                else model.items.remove(4);
                done.accept("applied", null);
            }, captured::done);
            drain();
            check(captured.error == null && captured.result.workStarted() && model.count() == (insert ? 6 : 4)
                && model.position == 0 && model.witnessed == 0, "a structural edit may change the restoration count");
        }
    }

    private static void oneWrite() {
        for (boolean throwsError : new boolean[] {true, false}) {
            Model model = new Model(4, 5);
            var captured = new Capture<String>();
            var error = new IllegalStateException("uncertain write");
            int[] writes = {0};
            access().withWindow(model, 4, 4, (offset, page, done) -> {
                writes[0]++;
                model.renameLocal(4 - offset, "changed");
                if (throwsError) throw error;
                done.accept("partial", error);
                done.accept("must be ignored", null);
            }, captured::done);
            drain();
            check(writes[0] == 1 && captured.replies == 1 && captured.error == error && captured.result.workStarted(),
                "no retry or false acquisition refusal after work starts");
            check(model.items.get(4).equals("changed") && model.position == 0, "preserve the correct effect and restore");
            if (!throwsError) check(captured.result.value().equals("partial"), "retain partial result");
        }
    }

    private static void failedRestore() {
        Model model = new Model(4, 5); model.refuseRestore = true;
        WriteGate gate = new WriteGate(tasks::add, () -> 0L, 8);
        var lease = gate.writeLease();
        var captured = new Capture<String>();
        int[] writes = {0};
        var registry = new com.ghostnote.extension.handlers.HandlerRegistry(RuntimeProfile.NORMAL, gate);
        registry.on("device.delete", params -> { writes[0]++; return new JsonArray(); });
        int[] errors = {0};
        registry.dispatch("device.delete", new com.google.gson.JsonObject(), new Bridge.Reply() {
            public void result(com.google.gson.JsonElement value, long queued) { throw new AssertionError("queued write ran"); }
            public void error(Exception error, long queued) { errors[0]++; }
        });
        access().<String>withWindow(model, 4, 4, (offset, page, done) -> {
            model.renameLocal(4 - offset, "changed");
            done.accept("applied", null);
        }, (result, error) -> {
            captured.done(result, error);
            check(error instanceof WindowPager.RestoreFailure, "restoration failure is explicit");
            gate.blockWrites(error.getMessage());
            lease.release();
        });
        drain();
        check(captured.replies == 1 && captured.result.workStarted() && captured.result.value().equals("applied")
            && model.items.get(4).equals("changed"), "truthful applied result survives restoration failure");
        check(writes[0] == 0 && errors[0] == 1 && gate.leases() == 0, "latch before releasing the writer lease");
    }

    private static void nested() {
        Model layers = new Model(5, 6), devices = new Model(4, 5);
        WindowAccess access = access();
        WriteGate gate = new WriteGate(tasks::add, () -> 0L, 8);
        var lease = gate.writeLease();
        List<String> order = new ArrayList<>();
        var captured = new Capture<String>();
        access.<String>withWindow(layers, 5, 5, (layerOffset, page, outerDone) -> {
            access.<String>withWindow(devices, 4, 4, (deviceOffset, rows, innerDone) -> {
                check(layers.position == 1, "outer target remains held while the inner target settles");
                devices.renameLocal(4 - deviceOffset, "changed");
                innerDone.accept("applied", null);
            }, (result, error) -> {
                check(devices.position == 0 && layers.position == 1, "inner restores before outer release");
                order.add("inner restored");
                outerDone.accept(result.value(), error);
            });
        }, (result, error) -> {
            check(layers.position == 0 && devices.position == 0, "both restored at reply");
            captured.done(result, error);
            order.add("reply");
            lease.release();
        });
        gate.submit(WriteGate.Kind.WRITE, waited -> order.add("next write"));
        drain();
        check(captured.error == null && captured.replies == 1 && gate.leases() == 0, "one result and no lease leak");
        check(order.equals(List.of("inner restored", "reply", "next write")), "queued writers wait for every restore");
    }

    private static void nestedFailure() {
        Model outer = new Model(5, 6), inner = new Model(4, 5); inner.refuseRestore = true;
        var captured = new Capture<String>();
        WindowAccess access = access();
        access.withWindow(outer, 5, 5, (offset, page, outerDone) -> {
            access.<String>withWindow(inner, 4, 4, (at, rows, innerDone) -> innerDone.accept("applied", null),
                (result, error) -> outerDone.accept(result.value(), error));
        }, captured::done);
        drain();
        check(captured.error instanceof WindowPager.RestoreFailure && captured.replies == 1
            && outer.position == 0 && inner.position == 1, "restore outer even when inner restoration failed");
    }

    private static void validation() {
        for (int[] range : new int[][] {{-1, 0}, {2, 1}, {0, 4}, {0, Integer.MAX_VALUE}}) {
            Model model = new Model(4, 5);
            boolean refused = false;
            try {
                access().withWindow(model, range[0], range[1], (offset, page, done) -> {
                    throw new AssertionError("invalid range reached work");
                }, (result, error) -> { throw new AssertionError("invalid range must throw synchronously"); });
            } catch (IllegalArgumentException expected) { refused = true; }
            check(refused && model.scrolls.isEmpty() && tasks.isEmpty(), "range rejected before navigation");
        }
        WindowAccess access = access();
        Model model = new Model(4, 5);
        var captured = new Capture<Void>();
        access.withWindow(model, 4, 4, (offset, page, done) -> {
            boolean refused = false;
            try { access.withWindow(model, 0, 0, (at, rows, next) -> next.accept(null, null), (result, error) -> {}); }
            catch (IllegalStateException expected) { refused = true; }
            check(refused && model.position == 1, "same window cannot alias another held endpoint");
            done.accept(null, null);
        }, captured::done);
        drain();
        check(captured.error == null, "outer use succeeds");
        access.withWindow(model, 0, 0, (offset, page, done) -> done.accept(null, null), captured::done);
        drain();
        check(captured.error == null && captured.replies == 2, "window can be acquired after its release");
    }

    private static void asyncException() {
        Model model = new Model(4, 5);
        var captured = new Capture<String>();
        access().withWindow(model, 0, 0, (offset, page, done) -> tasks.add(() -> {
            model.failPosition = true;
            done.accept("partial", new IllegalStateException("work failed"));
        }), captured::done);
        drain();
        check(captured.error instanceof WindowPager.RestoreFailure && captured.replies == 1
            && captured.result.workStarted() && captured.result.value().equals("partial")
            && captured.error.getSuppressed().length == 1, "async failure preserves the result and both errors");
    }
}
