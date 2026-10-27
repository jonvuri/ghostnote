package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.Device;
import com.bitwig.extension.controller.api.InsertionPoint;
import com.ghostnote.extension.Bridge;
import com.ghostnote.extension.ContainerScopes;
import com.ghostnote.extension.DeviceWindow;
import com.ghostnote.extension.LayerPageWitness;
import com.ghostnote.extension.Rig;
import com.ghostnote.extension.WindowAccess;
import com.ghostnote.extension.WindowPager;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/** One transfer with independently held chain endpoints; named slots retain their existing route. */
public final class ChainMoveHandlers {
    public static final String RULE = "paged-chain-moves-v1";

    /** Absolute wire endpoint plus the local handles acquired for this operation. */
    public static final class Endpoint {
        final int position, chain;
        int slot = -1, local = -1;
        String id, name, containerName;
        Endpoint(int position, int chain) { this.position = position; this.chain = chain; }
        boolean top() { return position < 0; }
    }

    public interface Host {
        ContainerScopes scopes();
        String track();
        int topCount();
        int topWidth();
        WindowPager.Window layers(int slot);
        String containerName(int slot);
        WindowPager.Window devices(Endpoint source);
        /** May re-aim a scope after the transfer shifts its container's top-level position. */
        boolean ready(Endpoint endpoint, int position, String track, boolean afterWork);
        void validateTop(JsonObject params);
        void transfer(Endpoint source, int localDevice, Endpoint destination, String verb, String where);
        void schedule(Runnable task, int ms);
        void blockWrites(String reason);
    }

    private final Host host;
    public ChainMoveHandlers(Host host) { this.host = host; }

    public static ChainMoveHandlers over(ControllerHost controller, Rig rig, Consumer<JsonObject> validateTop) {
        var controls = ChainControlHandlers.over(controller, rig);
        return new ChainMoveHandlers(new Host() {
            final int[] reaimChecks = new int[Rig.SLOT_SCOPES];
            public ContainerScopes scopes() { return rig.containerScopes; }
            public String track() { return rig.cursorTracks[0].channelId().get(); }
            public int topCount() { return rig.cursorDeviceBanks[0].itemCount().get(); }
            public int topWidth() { return rig.config.deviceBank; }
            public WindowPager.Window layers(int slot) { return controls.layers(slot); }
            public String containerName(int slot) { return rig.scopeDevice(slot).name().get(); }
            public WindowPager.Window devices(Endpoint endpoint) {
                return new DeviceWindow(endpoint.top() ? rig.cursorDeviceBanks[0]
                    : rig.slotLayerDeviceBanks[endpoint.slot][endpoint.local],
                    endpoint.top() ? rig.config.deviceBank : Rig.SLOT_LAYER_DEVICE_BANK);
            }
            public boolean ready(Endpoint endpoint, int position, String expectedTrack, boolean afterWork) {
                if (!expectedTrack.equals(track())) throw new IllegalStateException("chain.move track identity changed");
                if (endpoint.top()) return rig.cursorDeviceBanks[0].scrollPosition().get() == 0;
                int slot = endpoint.slot;
                if (afterWork) {
                    boolean changed = rig.scopeRequestedPosition[slot] != position;
                    boolean pending = !rig.scopeSettled(slot);
                    // Re-issue a clamped scope periodically, allowing observer delivery between requests.
                    if (changed || (pending && ++reaimChecks[slot] % 10 == 0)) {
                        rig.scopeRequestedPosition[slot] = position;
                        rig.scopeBanks[slot].scrollPosition().set(position);
                    }
                    if (changed || !pending) reaimChecks[slot] = 0;
                }
                return rig.scopeRequestedPosition[slot] == position && rig.scopeSettled(slot)
                    && rig.scopeDevice(slot).hasLayers().get();
            }
            public void validateTop(JsonObject params) { validateTop.accept(params); }
            public void transfer(Endpoint source, int localDevice, Endpoint destination, String verb, String where) {
                Device device = source.top() ? rig.cursorDeviceBanks[0].getDevice(localDevice)
                    : rig.slotLayerDeviceBanks[source.slot][source.local].getDevice(localDevice);
                var chain = destination.top() ? rig.cursorTracks[0]
                    : rig.slotLayerBanks[destination.slot].getItemAt(destination.local);
                InsertionPoint target = "chainStart".equals(where)
                    ? chain.startOfDeviceChainInsertionPoint() : chain.endOfDeviceChainInsertionPoint();
                if ("move".equals(verb)) target.moveDevices(device); else target.copyDevices(device);
            }
            public void schedule(Runnable task, int ms) { controller.scheduleTask(task, ms); }
            public void blockWrites(String reason) { rig.writeGate.blockWrites(reason); }
        });
    }

    public void register(HandlerRegistry registry, HandlerRegistry.AsyncHandler legacy) {
        registry.onAsync("chain.move", (params, reply) -> {
            String src = text(params, "src", "chain"), dst = text(params, "dst", "top");
            // Named slots keep their cursor route; top-to-top probes keep the earlier behavior.
            if (src.equals("slot") || dst.equals("slot") || (src.equals("top") && dst.equals("top")))
                legacy.handle(params, reply);
            else run(params, reply);
        });
    }

    static int index(JsonObject params, String key) {
        var value = params.get(key);
        if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isNumber())
            throw new IllegalArgumentException(key + " must be a nonnegative integer");
        double number = value.getAsDouble();
        if (!Double.isFinite(number) || number < 0 || number > Integer.MAX_VALUE || number != Math.rint(number))
            throw new IllegalArgumentException(key + " must be a nonnegative integer");
        return (int) number;
    }

    static String text(JsonObject params, String key, String fallback) {
        var value = params.get(key);
        if (value == null) return fallback;
        if (!value.isJsonPrimitive() || !value.getAsJsonPrimitive().isString() || value.getAsString().isBlank())
            throw new IllegalArgumentException(key + " must be a nonblank string");
        return value.getAsString();
    }

    public void run(JsonObject input, Bridge.Reply reply) {
        JsonObject params = input.deepCopy();
        String src = text(params, "src", "chain"), dst = text(params, "dst", "top");
        String verb = text(params, "verb", "move"), where = text(params, "where", "chainEnd");
        if ((!src.equals("top") && !src.equals("chain")) || (!dst.equals("top") && !dst.equals("chain")))
            throw new IllegalArgumentException("paged relocation requires top or chain endpoints");
        if (!verb.equals("move") && !verb.equals("copy")) throw new IllegalArgumentException("invalid relocation verb");
        if (!where.equals("chainStart") && !where.equals("chainEnd")) throw new IllegalArgumentException("invalid insertion point");
        if (!text(params, "cursor", "0").equals("0"))
            throw new IllegalArgumentException("chain.move endpoints belong to cursor 0");
        int device = index(params, "srcDevice");
        Endpoint source = endpoint(params, src, "src"), destination = endpoint(params, dst, "dst");
        if (source.top() && destination.top()) throw new IllegalArgumentException("use device.move for top-level reordering");
        if (source.top() && device >= host.topWidth()) throw new IllegalArgumentException("srcDevice out of bank range");
        if (source.position == destination.position && source.chain == destination.chain)
            throw new IllegalArgumentException("destination chain is the source chain");
        if (source.top() && device == destination.position)
            throw new IllegalArgumentException("a container cannot be relocated into its own chain");
        for (String key : new String[] {"expectedSourceChain", "expectedDestinationChain", "expectedSourceChannelId",
                "expectedDestinationChannelId", "expectedSourceName", "expectedTrackChannelId"}) text(params, key, null);
        List<Endpoint> endpoints = new ArrayList<>();
        if (!source.top()) endpoints.add(source);
        if (!destination.top()) endpoints.add(destination);
        host.scopes().aimIndependent(endpoints.stream().mapToInt(e -> e.position).toArray(),
            text(params, "expectedTrackChannelId", null), new ContainerScopes.Outcome() {
                public void refused(String reason, String detail, JsonObject report) {
                    reply.error(new IllegalStateException("container scope " + reason + ": " + detail), 0);
                }
                public void settled(ContainerScopes.Settled scopes) {
                    try {
                        for (int i = 0; i < endpoints.size(); i++) {
                            endpoints.get(i).slot = scopes.slotAt(i);
                            if (scopes.slotAt(i) == ContainerScopes.EMPTY) throw new IllegalArgumentException("missing endpoint container");
                        }
                        new Operation(params, source, destination, endpoints, device, verb, where, scopes, reply).start();
                    } catch (Exception error) { scopes.release(); reply.error(error, 0); }
                }
            });
    }

    private static Endpoint endpoint(JsonObject params, String kind, String prefix) {
        return kind.equals("top") ? new Endpoint(-1, -1)
            : new Endpoint(index(params, prefix + "Position"), index(params, prefix + "Chain"));
    }

    private final class Operation {
        final JsonObject params;
        final Endpoint source, destination;
        final List<Endpoint> endpoints;
        final int device, beforeTopCount;
        final String verb, where, track;
        final ContainerScopes.Settled scopes;
        final Bridge.Reply reply;
        final WindowAccess access = new WindowAccess(host::schedule);
        final List<WindowPager.Window> windows = new ArrayList<>();
        final List<JsonArray> metadata = new ArrayList<>();
        boolean effectsPossible, completed;
        JsonObject result;

        Operation(JsonObject params, Endpoint source, Endpoint destination, List<Endpoint> endpoints, int device,
                String verb, String where, ContainerScopes.Settled scopes, Bridge.Reply reply) {
            this.params = params; this.source = source; this.destination = destination; this.endpoints = endpoints;
            this.device = device; this.verb = verb; this.where = where; this.scopes = scopes; this.reply = reply;
            track = host.track(); beforeTopCount = host.topCount();
        }

        void start() {
            if ((source.top() || destination.top()) && (beforeTopCount > host.topWidth()
                    || (destination.top() && beforeTopCount == host.topWidth())))
                throw new IllegalArgumentException("mixed relocation exceeds the top-level write window");
            host.validateTop(params);
            readMetadata(0);
        }

        /** Container positions can shift under a mixed transfer; follow only its observed count projection. */
        boolean ready(Endpoint endpoint) {
            int position = endpoint.position;
            if (effectsPossible && (source.top() || destination.top())) {
                int delta = host.topCount() - beforeTopCount;
                int expected = source.top() ? (verb.equals("move") ? -1 : 0) : 1;
                if (delta != 0 && delta != expected) throw new IllegalStateException("unexpected top-level population after transfer");
                if (delta != 0 && (destination.top() ? where.equals("chainStart") : device < position)) position += delta;
            }
            return host.ready(endpoint, position, track, effectsPossible);
        }

        void readMetadata(int at) {
            if (at == endpoints.size()) { acquire(0, this::finish); return; }
            Endpoint endpoint = endpoints.get(at);
            WindowPager.Window raw = host.layers(endpoint.slot);
            LayerPageWitness witness = new LayerPageWitness();
            WindowPager.Window window = guarded(raw, () -> ready(endpoint), witness);
            JsonArray rows = new JsonArray();
            windows.add(window); metadata.add(rows);
            new WindowPager(host::schedule).read(window, (offset, page, next) -> {
                witness.accept(page); rows.addAll(page); next.accept(null);
            }, (report, error) -> {
                if (error != null) { finish(error); return; }
                try {
                    if (endpoint.chain >= rows.size()) throw new IllegalArgumentException("missing endpoint chain");
                    JsonObject row = rows.get(endpoint.chain).getAsJsonObject();
                    endpoint.id = row.get("channelId").getAsString(); endpoint.name = row.get("name").getAsString();
                    endpoint.containerName = host.containerName(endpoint.slot);
                    String prefix = endpoint == source ? "expectedSource" : "expectedDestination";
                    expect(prefix + "Chain", endpoint.name); expect(prefix + "ChannelId", endpoint.id);
                    readMetadata(at + 1);
                } catch (Exception failure) { finish(failure); }
            });
        }

        void acquire(int at, Consumer<Exception> done) {
            if (at == endpoints.size()) { acquireDevice(done); return; }
            Endpoint endpoint = endpoints.get(at);
            access.<Void>withWindow(windows.get(at), endpoint.chain, endpoint.chain, (offset, page, next) -> {
                if (windows.get(at).count() != metadata.get(at).size()) throw new IllegalStateException("chain population changed");
                endpoint.local = endpoint.chain - offset;
                acquire(at + 1, error -> next.accept(null, error));
            }, (result, error) -> done.accept(error));
        }

        boolean endpointHeld(Endpoint endpoint) {
            if (!ready(endpoint)) return false;
            if (endpoint.top()) return true;
            WindowPager.Window layers = host.layers(endpoint.slot);
            JsonArray rows = layers.snapshot();
            return layers.position() + endpoint.local == endpoint.chain && rows != null
                && endpoint.local < rows.size()
                && endpoint.id.equals(rows.get(endpoint.local).getAsJsonObject().get("channelId").getAsString());
        }

        void acquireDevice(Consumer<Exception> done) {
            WindowPager.Window window = guarded(host.devices(source), () -> endpointHeld(source), null);
            access.<Void>withWindow(window, device, device, (offset, page, next) -> {
                if (!endpointHeld(source) || !endpointHeld(destination)) throw new IllegalStateException("endpoint identity changed before transfer");
                host.validateTop(params);
                String name = page.get(device - offset).getAsJsonObject().get("name").getAsString();
                expect("expectedSourceName", name);
                result = new JsonObject();
                result.addProperty("success", true); result.addProperty("verb", verb);
                result.addProperty("dst", destination.top() ? "top" : "chain"); result.addProperty("where", where);
                result.addProperty("sourceName", name); result.addProperty("sourceExists", true);
                describe(source, true); describe(destination, false);
                result.addProperty("route", RULE); result.add("aim", scopes.report());
                effectsPossible = true;
                host.transfer(source, device - offset, destination, verb, where);
                next.accept(null, null);
            }, (result, error) -> done.accept(error));
        }

        void describe(Endpoint endpoint, boolean src) {
            if (endpoint.top()) return;
            result.addProperty(src ? "srcSlot" : "dstSlot", endpoint.slot);
            result.addProperty(src ? "sourcePosition" : "dstPosition", endpoint.position);
            result.addProperty(src ? "sourceChain" : "dstChainName", endpoint.name);
            result.addProperty(src ? "sourceContainer" : "dstContainer", endpoint.containerName);
            result.addProperty(src ? "sourceChannelId" : "destinationChannelId", endpoint.id);
            result.addProperty(src ? "srcScopeStatus" : "dstScopeStatus", "held");
            if (!src) result.addProperty("dstChain", endpoint.chain);
        }

        void expect(String key, String actual) {
            if (params.has(key) && !params.get(key).getAsString().equals(actual))
                throw new IllegalArgumentException(key + " identity changed");
        }

        void finish(Exception error) {
            if (completed) return;
            completed = true;
            if (error instanceof WindowPager.RestoreFailure) host.blockWrites(error.getMessage());
            scopes.release();
            if (error == null) reply.result(result, 0);
            else reply.error(effectsPossible ? new IllegalStateException(
                "chain.move failed after work started; effects may have applied: " + error.getMessage(), error) : error, 0);
        }
    }

    private static WindowPager.Window guarded(WindowPager.Window raw, java.util.function.BooleanSupplier ready,
            LayerPageWitness witness) {
        return new WindowPager.Window() {
            public int width() { return raw.width(); }
            public int count() { return raw.count(); }
            public int position() { return raw.position(); }
            public void scroll(int position) { ready.getAsBoolean(); raw.scroll(position); }
            public JsonArray snapshot() {
                if (!ready.getAsBoolean()) return null;
                JsonArray rows = raw.snapshot();
                return rows != null && (witness == null || witness.matches(rows)) ? rows : null;
            }
        };
    }
}
