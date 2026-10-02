package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.ControllerHost;
import com.ghostnote.extension.Rig;
import com.ghostnote.extension.ShadowCacheProbe;
import com.ghostnote.extension.ShadowGroupControl;
import com.ghostnote.extension.ShadowProjectCache.Coverage;
import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/** Experimental shadow operations and guarded scene research. Stable readers remain authoritative. */
public final class ShadowCacheHandlers extends HandlerGroup {
    private static final Gson JSON = new Gson();
    public ShadowCacheHandlers(ControllerHost host, Rig rig, ExecState state) { super(host, rig, state); }

    @Override public void register(HandlerRegistry r) { r.on("cache.shadow", this::dispatch); }

    private JsonElement dispatch(JsonObject params) {
        String operation = params.get("operation").getAsString();
        if (operation.equals("trackGroups")) return ShadowGroupControl.snapshot(rig);
        if (operation.equals("sceneSnapshot") || operation.equals("setSceneName")) {
            var scenes = rig.shadowSceneControl;
            if (scenes == null) throw new IllegalStateException("scene research resources are not allocated");
            if (operation.equals("sceneSnapshot")) return scenes.snapshot();
            return scenes.setSceneName(params.get("index").getAsInt(), params.get("expectedName").getAsString(),
                params.get("expectedPosition").getAsInt(), params.get("expectedTotalCount").getAsInt(),
                params.get("expectedBankSize").getAsInt(), params.get("name").getAsString());
        }
        if (operation.startsWith("root")) {
            var root = rig.rootIdentityProbe;
            if (root == null) throw new IllegalStateException("root research resources are not allocated");
            return switch (operation) {
                case "rootSnapshot" -> root.snapshot();
                case "rootTrace" -> root.trace();
                case "rootClearTrace" -> root.clearTrace();
                default -> throw new IllegalArgumentException("unknown root research operation");
            };
        }
        if (operation.startsWith("reuse")) {
            var reuse = rig.observerReuseProbe;
            if (reuse == null) throw new IllegalStateException("reuse research resources are not allocated");
            return switch (operation) {
                case "reuseInfo" -> reuse.info();
                case "reusePoint" -> reuse.point(requireTrack(params.get("trackIndex").getAsInt()),
                    params.get("row").getAsInt(), params.get("expectedChannelId").getAsString());
                case "reusePoll" -> reuse.poll();
                case "reuseStatus" -> reuse.status();
                case "reuseSubscribe" -> reuse.subscribe(params.get("subscribed").getAsBoolean());
                case "reuseReconcile" -> reuse.reconcile();
                case "reuseCompareStart" -> reuse.compareStart();
                case "reuseComparePoll" -> reuse.comparePoll();
                case "reuseCancel" -> reuse.cancel();
                case "reuseTrace" -> reuse.trace();
                case "reuseClearTrace" -> reuse.clearTrace();
                default -> throw new IllegalArgumentException("unknown reuse research operation");
            };
        }
        ShadowCacheProbe probe = rig.shadowCacheProbe;
        if (probe == null) throw new IllegalStateException("shadow cache resources are not allocated");
        probe.observeRig(rig);
        int index = params.has("index") ? params.get("index").getAsInt() : 0;
        return switch (operation) {
            case "info" -> probe.info();
            case "inventory" -> probe.inventory(rig);
            case "rebuild" -> probe.rebuildInventory(rig);
            case "rebuildBegin" -> probe.beginInventoryRebuild(rig);
            case "rebuildPoll" -> params.has("maxCells")
                ? probe.pollInventoryRebuild(rig, params.get("maxCells").getAsInt())
                : probe.pollInventoryRebuild(rig);
            case "rebuildCancel" -> probe.cancelInventoryRebuild(params.get("reason").getAsString());
            case "acquire" -> params.has("canaryTrackIndex")
                ? probe.acquire(requireTrack(params.get("trackIndex").getAsInt()), params.get("row").getAsInt(),
                    requireTrack(params.get("canaryTrackIndex").getAsInt()), params.get("canaryRow").getAsInt())
                : probe.acquire(requireTrack(params.get("trackIndex").getAsInt()), params.get("row").getAsInt());
            case "exactStart" -> params.has("coverage")
                ? probe.exactStart(requireTrack(params.get("trackIndex").getAsInt()), params.get("row").getAsInt(),
                    JSON.fromJson(params.get("coverage"), Coverage.class))
                : probe.exactStart(requireTrack(params.get("trackIndex").getAsInt()), params.get("row").getAsInt());
            case "exactPoll" -> probe.exactPoll();
            case "exactCancel" -> probe.exactCancel(params.get("reason").getAsString());
            case "point" -> params.has("canaryTrackIndex")
                ? probe.point(index, requireTrack(params.get("trackIndex").getAsInt()), params.get("row").getAsInt(),
                    requireTrack(params.get("canaryTrackIndex").getAsInt()), params.get("canaryRow").getAsInt())
                : probe.point(index, requireTrack(params.get("trackIndex").getAsInt()), params.get("row").getAsInt());
            case "poll" -> probe.poll(index);
            case "status" -> probe.status(index);
            case "reconcile" -> probe.reconcile(index);
            case "compareStart" -> probe.compareStart(index);
            case "comparePoll" -> probe.comparePoll();
            case "read" -> probe.readSnapshot(index);
            case "retire" -> probe.retire(index);
            case "invalidate" -> probe.invalidate(params.get("reason").getAsString());
            case "lifecycle" -> probe.lifecycle(params.get("kind").getAsString());
            case "ping" -> probe.ping(params.get("p95Ms").getAsDouble());
            default -> throw new IllegalArgumentException("unknown shadow cache operation: " + operation);
        };
    }
}
