package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.Device;
import com.bitwig.extension.controller.api.InsertionPoint;
import com.ghostnote.extension.Bridge;
import com.ghostnote.extension.DeviceFingerprint;
import com.ghostnote.extension.DeviceWindow;
import com.ghostnote.extension.Rig;
import com.ghostnote.extension.WindowAccess;
import com.ghostnote.extension.WindowPager;
import com.ghostnote.extension.WriteGate;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.util.List;

/** Absolute top-level mutations, with one bank and an independent anchor owned by each pool cursor. */
public final class DeviceMutationHandlers {
    public static final String RULE = "paged-device-mutations-v1";
    public static final List<String> METHODS = List.of("device.insertBitwig", "device.insertClap", "device.insertVst3",
        "device.insertFile", "device.delete", "device.setEnabled", "device.moveTo");
    public interface Host {
        int cursors();
        String track(int cursor);
        WindowPager.Window window(int cursor, boolean anchor);
        WriteGate.Lease lease();
        void mutate(String method, JsonObject params, int cursor, int source, int anchor);
        void schedule(Runnable task, int ms);
        void blockWrites(String reason);
    }
    private final Host host;
    public DeviceMutationHandlers(Host host) { this.host = host; }
    public static DeviceMutationHandlers over(ControllerHost controller, Rig rig) {
        return new DeviceMutationHandlers(new Host() {
            public int cursors() { return rig.config.cursorPool; }
            public String track(int cursor) { return rig.cursorTracks[cursor].channelId().get(); }
            public WindowPager.Window window(int cursor, boolean anchor) {
                return new DeviceWindow(anchor ? rig.cursorDeviceAnchors[cursor] : rig.cursorDeviceBanks[cursor],
                    anchor ? 1 : rig.config.deviceBank);
            }
            public WriteGate.Lease lease() { return rig.writeGate.writeLease(); }
            public void mutate(String method, JsonObject p, int cursor, int sourceIndex, int anchorIndex) {
                Device source = sourceIndex < 0 ? null : rig.cursorDeviceBanks[cursor].getDevice(sourceIndex);
                InsertionPoint end = rig.cursorTracks[cursor].endOfDeviceChainInsertionPoint();
                switch (method) {
                    case "device.insertBitwig" -> end.insertBitwigDevice(java.util.UUID.fromString(p.get("uuid").getAsString()));
                    case "device.insertClap" -> end.insertCLAPDevice(p.get("clapId").getAsString());
                    case "device.insertVst3" -> end.insertVST3Device(p.get("vst3Id").getAsString());
                    case "device.insertFile" -> end.insertFile(p.get("path").getAsString());
                    case "device.delete" -> source.deleteObject();
                    case "device.setEnabled" -> source.isEnabled().set(p.get("enabled").getAsBoolean());
                    case "device.moveTo" -> {
                        String where = ChainMoveHandlers.text(p, "where", "after");
                        InsertionPoint target = switch (where) {
                            case "chainStart" -> rig.cursorTracks[cursor].startOfDeviceChainInsertionPoint();
                            case "chainEnd" -> end;
                            case "before" -> rig.cursorDeviceAnchors[cursor].getDevice(anchorIndex).beforeDeviceInsertionPoint();
                            default -> rig.cursorDeviceAnchors[cursor].getDevice(anchorIndex).afterDeviceInsertionPoint();
                        };
                        target.moveDevices(source);
                    }
                    default -> throw new IllegalArgumentException("unknown device mutation");
                }
            }
            public void schedule(Runnable task, int ms) { controller.scheduleTask(task, ms); }
            public void blockWrites(String reason) { rig.writeGate.blockWrites(reason); }
        });
    }
    public void register(HandlerRegistry registry) {
        registry.onAsync("device.insertBitwig", (params, reply) -> run("device.insertBitwig", params, reply));
        registry.onAsync("device.insertClap", (params, reply) -> run("device.insertClap", params, reply));
        registry.onAsync("device.insertVst3", (params, reply) -> run("device.insertVst3", params, reply));
        registry.onAsync("device.insertFile", (params, reply) -> run("device.insertFile", params, reply));
        registry.onAsync("device.delete", (params, reply) -> run("device.delete", params, reply));
        registry.onAsync("device.setEnabled", (params, reply) -> run("device.setEnabled", params, reply));
        registry.onAsync("device.moveTo", (params, reply) -> run("device.moveTo", params, reply));
    }
    public void run(String method, JsonObject input, Bridge.Reply reply) {
        JsonObject p = input.deepCopy();
        // CursorPool serializes pool references as decimal strings; historical probes also use numbers.
        if (p.has("cursor") && p.get("cursor").isJsonPrimitive() && p.getAsJsonPrimitive("cursor").isString()) {
            String ref = p.get("cursor").getAsString();
            if (!ref.matches("[0-9]+")) throw new IllegalArgumentException("invalid pool cursor");
            try { p.addProperty("cursor", Integer.parseInt(ref)); }
            catch (NumberFormatException error) { throw new IllegalArgumentException("cursor out of pool range"); }
        }
        int cursor = p.has("cursor") ? ChainMoveHandlers.index(p, "cursor") : 0;
        if (cursor >= host.cursors()) throw new IllegalArgumentException("cursor out of pool range");
        boolean insert = method.startsWith("device.insert");
        int source = insert ? -1 : ChainMoveHandlers.index(p, "deviceIndex");
        String where = ChainMoveHandlers.text(p, "where", "after");
        int anchor = -1;
        if (method.equals("device.moveTo")) {
            if (!List.of("before", "after", "chainStart", "chainEnd").contains(where))
                throw new IllegalArgumentException("invalid move destination");
            if (where.equals("before") || where.equals("after")) anchor = ChainMoveHandlers.index(p, "anchorIndex");
            if (anchor == source) throw new IllegalArgumentException("anchor must differ from source");
        }
        DeviceFingerprint.validate(p, method.equals("device.setEnabled"));
        switch (method) {
            case "device.insertBitwig" -> java.util.UUID.fromString(ChainMoveHandlers.text(p, "uuid", null));
            case "device.insertClap" -> {
                String id = ChainMoveHandlers.text(p, "clapId", null);
                if (id == null || !id.equals(id.trim()) || id.chars().anyMatch(c -> c < 0x20 || c == 0x7f))
                    throw new IllegalArgumentException("invalid clapId");
            }
            case "device.insertVst3" -> {
                String id = ChainMoveHandlers.text(p, "vst3Id", null);
                if (id == null || !id.matches("[0-9A-Fa-f]{32}")) throw new IllegalArgumentException("invalid vst3Id");
            }
            case "device.insertFile" -> {
                if (ChainMoveHandlers.text(p, "path", null) == null) throw new IllegalArgumentException("path required");
            }
            case "device.setEnabled" -> { bool(p, "enabled"); bool(p, "expectedEnabled"); }
            default -> { }
        }
        new Operation(method, p, cursor, source, anchor, reply).start();
    }
    private static boolean bool(JsonObject p, String key) {
        JsonElement value = p.get(key);
        if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isBoolean())
            throw new IllegalArgumentException(key + " must be a boolean");
        return value.getAsBoolean();
    }
    private final class Operation {
        final String method, track;
        final JsonObject p;
        final int cursor, source, anchor;
        final Bridge.Reply reply;
        final WindowPager.Window bank, anchors;
        final WindowAccess access = new WindowAccess(host::schedule);
        WriteGate.Lease lease;
        JsonArray fingerprint;
        JsonObject result;
        boolean effectsPossible, completed;
        Operation(String method, JsonObject p, int cursor, int source, int anchor, Bridge.Reply reply) {
            this.method = method; this.p = p; this.cursor = cursor; this.source = source; this.anchor = anchor; this.reply = reply;
            track = host.track(cursor); bank = host.window(cursor, false); anchors = host.window(cursor, true);
        }
        void start() {
            lease = host.lease();
            try {
                DeviceFingerprint.read(p, bank, () -> host.track(cursor), host::schedule, (rows, error) -> {
                    if (error != null) { finish(error); return; }
                    fingerprint = rows;
                    try {
                        checkIndex(source); checkIndex(anchor);
                        if (source >= 0) {
                            expect("expectedName", source); expect("expectedSourceName", source);
                            if (method.equals("device.setEnabled") && bool(p, "expectedEnabled")
                                    != rows.get(source).getAsJsonObject().get("enabled").getAsBoolean())
                                throw new IllegalArgumentException("device enabled state changed");
                        }
                        if (anchor >= 0) expect("expectedAnchorName", anchor);
                        if (source < 0) write(-1, -1);
                        else access.<Void>withWindow(bank, source, source, (offset, page, next) -> {
                            checkPage(bank, page);
                            if (anchor < 0) { write(source - offset, -1); next.accept(null, null); }
                            else access.<Void>withWindow(anchors, anchor, anchor, (anchorOffset, anchorPage, complete) -> {
                                checkPage(anchors, anchorPage);
                                checkPage(bank, bank.snapshot());
                                write(source - offset, anchor - anchorOffset); complete.accept(null, null);
                            }, (report, failure) -> next.accept(null, failure));
                        }, (report, failure) -> finish(failure));
                    } catch (Exception failure) { finish(failure); }
                });
            } catch (Exception error) { finish(error); }
        }
        void checkIndex(int index) {
            if (index >= fingerprint.size()) throw new IllegalArgumentException("no device at index " + index);
        }
        void expect(String key, int index) {
            if (p.has(key) && !p.get(key).equals(fingerprint.get(index).getAsJsonObject().get("name")))
                throw new IllegalArgumentException(key + " identity changed");
        }
        void checkPage(WindowPager.Window window, JsonArray page) {
            if (!track.equals(host.track(cursor))) throw new IllegalStateException("track identity changed");
            if (window.count() != fingerprint.size() || page == null) throw new IllegalStateException("device window changed");
            for (var row : page) {
                int index = row.getAsJsonObject().get("index").getAsInt();
                if (index < 0 || index >= fingerprint.size() || !row.equals(fingerprint.get(index)))
                    throw new IllegalStateException("device identity changed at " + index);
            }
        }
        void write(int localSource, int localAnchor) {
            if (!track.equals(host.track(cursor))) throw new IllegalStateException("track identity changed");
            result = new JsonObject(); result.addProperty("success", true); result.addProperty("route", RULE);
            if (method.equals("device.moveTo")) {
                result.addProperty("where", ChainMoveHandlers.text(p, "where", "after"));
                result.addProperty("deviceIndex", source); result.addProperty("sourceExists", true);
                result.add("sourceName", fingerprint.get(source).getAsJsonObject().get("name"));
                if (anchor >= 0) {
                    result.addProperty("anchorIndex", anchor); result.add("anchorName", fingerprint.get(anchor).getAsJsonObject().get("name"));
                }
            }
            effectsPossible = true;
            host.mutate(method, p, cursor, localSource, localAnchor);
            if (source < 0) finish(null);
        }
        void finish(Exception error) {
            if (completed) return;
            completed = true;
            if (error instanceof WindowPager.RestoreFailure) host.blockWrites(error.getMessage());
            lease.release();
            if (error == null) reply.result(result, 0);
            else reply.error(effectsPossible ? new IllegalStateException(method
                + " failed after work started; effects may have applied: " + error.getMessage(), error) : error, 0);
        }
    }
}
