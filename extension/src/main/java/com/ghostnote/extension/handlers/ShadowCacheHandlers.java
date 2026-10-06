package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.ControllerHost;
import com.ghostnote.extension.Rig;
import com.ghostnote.extension.ShadowCacheProbe;
import com.ghostnote.extension.ShadowGroupControl;
import com.ghostnote.extension.ShadowTopologyControl;
import com.ghostnote.extension.SoundingCellBudget;
import com.ghostnote.extension.ShadowProjectCache.Coverage;
import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/** Experimental shadow operations and guarded scene research. Stable readers remain authoritative. */
public final class ShadowCacheHandlers extends HandlerGroup {
    private static final Gson JSON = new Gson();
    public ShadowCacheHandlers(ControllerHost host, Rig rig, ExecState state) { super(host, rig, state); }

    @Override public void register(HandlerRegistry r) {
        r.on("cache.shadow", this::dispatch);
        r.on("cache.configure", this::configure);
    }

    /** 8h1a research control. It applies the complete request or refuses it without a change. */
    private JsonElement configure(JsonObject params) {
        ShadowCacheProbe probe = rig.shadowCacheProbe;
        if (probe == null) throw new IllegalStateException("shadow cache resources are not allocated");
        return probe.configure(params, rig);
    }

    private JsonElement fixture(String operation, JsonObject params) {
        var fixture = rig.kneeFixture;
        if (fixture == null) throw new IllegalStateException("knee fixture resources are not allocated");
        return switch (operation) {
            case "fixtureStatus" -> fixture.status();
            case "fixturePoint" -> fixture.point(requireTrack(params.get("trackIndex").getAsInt()));
            case "fixtureSelect" -> fixture.select(requireTrack(params.get("trackIndex").getAsInt()), params.get("row").getAsInt());
            case "fixturePin" -> fixture.pin(params.get("pinned").getAsBoolean());
            case "fixtureWrite" -> fixture.write(params.get("count").getAsLong(), params.get("width").getAsLong(),
                params.get("from").getAsLong(), params.get("size").getAsInt(),
                params.has("semitones") ? params.get("semitones").getAsInt() : 0,
                params.has("durationCap") ? params.get("durationCap").getAsLong() : 64);
            case "fixtureReconstruct" -> fixture.reconstruct(params.get("count").getAsLong(), params.get("width").getAsLong(),
                params.get("from").getAsLong(), params.get("size").getAsInt(),
                params.get("fromShift").getAsInt(), params.get("toShift").getAsInt());
            case "fixtureTranspose" -> fixture.transpose(params.get("semitones").getAsInt());
            case "fixtureRead" -> fixture.read(params.getAsJsonArray("coordinates"));
            case "fixtureEdit" -> fixture.edit(params.getAsJsonArray("ops"));
            case "fixtureDecorate" -> fixture.decorate(params.get("count").getAsLong(), params.get("width").getAsLong(),
                params.get("from").getAsLong(), params.get("size").getAsInt());
            default -> throw new IllegalArgumentException("unknown knee fixture operation");
        };
    }

    /** 8h1b sounding-cell research. Every reply keeps complete:false and eligible:false. */
    private JsonElement sounding(String operation, JsonObject params) {
        var sounding = rig.soundingProbe;
        if (sounding == null) throw new IllegalStateException("sounding research resources are not allocated");
        return switch (operation) {
            case "soundingStatus" -> sounding.status();
            case "soundingAct" -> sounding.act(params.get("role").getAsString(), params.get("action").getAsString(), params,
                this::requireTrack);
            case "soundingTrace" -> sounding.trace(params.get("role").getAsString(), params.get("enabled").getAsBoolean());
            case "soundingReset" -> sounding.resetCounters(params.get("role").getAsString());
            case "soundingSince" -> sounding.traceSince(params.get("role").getAsString(), params.get("since").getAsLong(),
                params.has("limit") ? params.get("limit").getAsInt() : 4096);
            case "soundingEdit" -> {
                if (rig.kneeFixture == null) throw new IllegalStateException("knee fixture resources are not allocated");
                yield rig.kneeFixture.edit(params.getAsJsonArray("ops"));
            }
            case "soundingBudget" -> {
                sounding.budget().configure(params.get("budgetCells").getAsLong(), params.get("clipLimitCells").getAsLong());
                yield sounding.budget().status();
            }
            case "soundingAdmit" -> {
                var busy = new java.util.HashSet<String>();
                if (params.has("busy")) params.getAsJsonArray("busy").forEach(value -> busy.add(value.getAsString()));
                var result = SoundingCellBudget.json(sounding.budget().admit(params.get("key").getAsString(),
                    params.get("cells").getAsLong(), busy));
                result.add("budget", sounding.budget().status());
                yield result;
            }
            case "soundingTouch" -> {
                var result = new JsonObject();
                result.addProperty("resident", sounding.budget().touch(params.get("key").getAsString()));
                result.add("budget", sounding.budget().status());
                yield result;
            }
            case "soundingRelease" -> {
                var result = new JsonObject();
                result.addProperty("released", sounding.budget().release(params.get("key").getAsString()));
                result.add("budget", sounding.budget().status());
                yield result;
            }
            default -> throw new IllegalArgumentException("unknown sounding research operation");
        };
    }

    private JsonElement dispatch(JsonObject params) {
        String operation = params.get("operation").getAsString();
        if (operation.startsWith("sounding")) return sounding(operation, params);
        if (operation.equals("allocationStats")) {
            JsonObject result = new JsonObject();
            result.addProperty("revision", "8h1a-allocation-v1");
            result.addProperty("projectName", rig.projectName == null ? "" : rig.projectName.get());
            result.addProperty("activeTracks", rig.activeTracks);
            result.addProperty("activeScenes", rig.activeScenes);
            result.addProperty("trackItemCount", rig.trackBank.itemCount().get());
            result.addProperty("sceneItemCount", rig.sceneBank.itemCount().get());
            result.addProperty("complete", false); result.addProperty("eligible", false);
            result.add("jvmMemory", ShadowTopologyControl.jvmMemory());
            result.addProperty("topologyAllocated", rig.shadowTopologyControl != null);
            if (rig.shadowTopologyControl != null) result.add("topology", rig.shadowTopologyControl.resources());
            result.addProperty("flatBankTracks", rig.config.tracks);
            result.addProperty("slotObservers", rig.config.tracks);
            result.addProperty("slotHandles", (long) rig.config.tracks * rig.config.scenes);
            return result;
        }
        if (operation.equals("trackTopology")) {
            if (rig.shadowTopologyControl == null) throw new IllegalStateException("topology resources are not allocated");
            return rig.shadowTopologyControl.measurementSnapshot();
        }
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
        if (operation.startsWith("delivery")) {
            var delivery = rig.deliveryProbe;
            if (delivery == null) throw new IllegalStateException("delivery research resources are not allocated");
            return switch (operation) {
                case "deliveryStatus" -> delivery.status();
                case "deliveryStart" -> delivery.start(params.has("ordering") && params.get("ordering").getAsBoolean());
                case "deliveryPing" -> delivery.ping();
                case "deliveryStop" -> delivery.stop();
                case "deliveryClear" -> delivery.clear();
                case "deliveryTrace" -> delivery.trace();
                case "deliveryRun" -> delivery.run(params.getAsJsonArray("script"));
                default -> throw new IllegalArgumentException("unknown delivery research operation");
            };
        }
        if (operation.startsWith("fixture")) return fixture(operation, params);
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
            case "inventoryList" -> probe.inventoryList(rig);
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
            case "promotedStart" -> probe.promotedStart(index,
                params.has("maxEnrichmentCoordinates") ? params.get("maxEnrichmentCoordinates").getAsInt() : Integer.MAX_VALUE,
                params.has("payload") ? params.get("payload").getAsString() : "compact");
            case "compareStart" -> params.has("maxEnrichmentCoordinates")
                ? probe.compareStart(index, params.get("maxEnrichmentCoordinates").getAsInt()) : probe.compareStart(index);
            case "comparePoll" -> probe.comparePoll();
            case "compareStatus" -> probe.compareStatus();
            case "read" -> probe.readSnapshot(index);
            case "retire" -> probe.retire(index);
            case "invalidate" -> probe.invalidate(params.get("reason").getAsString());
            case "lifecycle" -> probe.lifecycle(params.get("kind").getAsString());
            case "ping" -> probe.ping(params.get("p95Ms").getAsDouble());
            default -> throw new IllegalArgumentException("unknown shadow cache operation: " + operation);
        };
    }
}
