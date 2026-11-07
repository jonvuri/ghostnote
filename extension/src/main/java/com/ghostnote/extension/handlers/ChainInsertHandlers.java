package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.ControllerHost;
import com.ghostnote.extension.Bridge;
import com.ghostnote.extension.ContainerScopes;
import com.ghostnote.extension.DeviceFingerprint;
import com.ghostnote.extension.DeviceWindow;
import com.ghostnote.extension.LayerPageWitness;
import com.ghostnote.extension.Rig;
import com.ghostnote.extension.WindowAccess;
import com.ghostnote.extension.WindowPager;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.function.BiConsumer;

/**
 * P01 product route: insert one to eight sources at the end of a named layer chain, in request order,
 * without selecting or moving a device (E403).
 *
 * <p>An end insertion lands in a later host task, and several immediate end insertions do not preserve
 * their order. Before source {@code i}, the chain's device count must therefore reach
 * {@code expectedDeviceCount + i}. After the last source, the reply also waits for the final count, so the
 * next request can address the complete chain. A count is not a content proof: the caller makes the one
 * independent content readback (D65).
 */
public final class ChainInsertHandlers extends HandlerGroup {
    public static final String MARKER = "chain-insert-v1";
    public static final String RULE = MARKER;
    static final int MAX_SOURCES = 8;
    static final int POLL_MS = 5;
    /** Each count wait may last this long; a slow plug-in can take seconds to load. */
    static final long WAIT_MS = 10_000;

    public record Source(String kind, String value) { }

    public interface Host {
        ContainerScopes scopes();
        String trackId();
        String containerName(int slot);
        /** The scope still names the expected track and position, has settled, and has layers. */
        boolean ready(int slot, int position, String track);
        WindowPager.Window topWindow();
        WindowPager.Window layers(int slot);
        int deviceCount(int slot, int localChain);
        void insert(int slot, int localChain, Source source);
        /** Monotonic time in nanoseconds. */
        long nanoTime();
        void schedule(Runnable task, int ms);
        void blockWrites(String reason);
    }

    private final Host backend;
    private boolean busy;

    public ChainInsertHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
        var controls = ChainControlHandlers.over(host, rig);
        backend = new Host() {
            public ContainerScopes scopes() { return rig.containerScopes; }
            public String trackId() { return rig.cursorTracks[0].channelId().get(); }
            public String containerName(int slot) { return rig.scopeDevice(slot).name().get(); }
            public boolean ready(int slot, int position, String track) {
                return track.equals(trackId()) && rig.scopeRequestedPosition[slot] == position
                    && rig.scopeSettled(slot) && rig.scopeDevice(slot).hasLayers().get();
            }
            public WindowPager.Window topWindow() { return new DeviceWindow(rig.cursorDeviceBanks[0], rig.config.deviceBank); }
            public WindowPager.Window layers(int slot) { return controls.layers(slot); }
            public int deviceCount(int slot, int local) { return rig.slotLayerDeviceBanks[slot][local].itemCount().get(); }
            public void insert(int slot, int local, Source source) {
                var point = rig.slotLayerBanks[slot].getItemAt(local).endOfDeviceChainInsertionPoint();
                switch (source.kind()) {
                    case "native" -> point.insertBitwigDevice(UUID.fromString(source.value()));
                    case "vst3" -> point.insertVST3Device(source.value());
                    case "clap" -> point.insertCLAPDevice(source.value());
                    case "preset" -> point.insertFile(source.value());
                    default -> throw new IllegalArgumentException("unknown source kind");
                }
            }
            public long nanoTime() { return System.nanoTime(); }
            public void schedule(Runnable task, int ms) { host.scheduleTask(task, ms); }
            public void blockWrites(String reason) { rig.writeGate.blockWrites(reason); }
        };
    }

    /** Offline host-model seam. */
    public ChainInsertHandlers(Host backend) { super(null, null, null); this.backend = backend; }

    @Override public void register(HandlerRegistry registry) { registry.onAsync("chain.insert", this::run); }

    private static String text(JsonObject p, String key) {
        String value = ChainMoveHandlers.text(p, key, null);
        if (value == null) throw new IllegalArgumentException(key + " is required");
        return value;
    }

    static List<Source> sources(JsonObject p) {
        if (!p.has("sources") || !p.get("sources").isJsonArray()) throw new IllegalArgumentException("sources must be an array");
        var input = p.getAsJsonArray("sources");
        if (input.isEmpty() || input.size() > MAX_SOURCES)
            throw new IllegalArgumentException("one through " + MAX_SOURCES + " sources required");
        List<Source> result = new ArrayList<>();
        for (int i = 0; i < input.size(); i++) {
            try {
                var value = input.get(i);
                if (!value.isJsonObject()) throw new IllegalArgumentException("source must be an object");
                JsonObject source = value.getAsJsonObject();
                String kind = text(source, "kind"), id = text(source, "value");
                switch (kind) {
                    case "native" -> {
                        if (!UUID.fromString(id).toString().equals(id)) throw new IllegalArgumentException("canonical native UUID required");
                    }
                    case "vst3" -> {
                        if (!id.matches("[0-9A-Fa-f]{32}")) throw new IllegalArgumentException("invalid VST3 class UID");
                    }
                    case "clap" -> {
                        if (!id.equals(id.trim()) || id.chars().anyMatch(c -> c < 0x20 || c == 0x7f))
                            throw new IllegalArgumentException("invalid CLAP id");
                    }
                    case "preset" -> {
                        Path path = Path.of(id);
                        if (!path.isAbsolute() || !id.toLowerCase(Locale.ROOT).endsWith(".bwpreset") || !Files.isRegularFile(path))
                            throw new IllegalArgumentException("existing absolute .bwpreset required");
                    }
                    default -> throw new IllegalArgumentException("unknown source kind");
                }
                result.add(new Source(kind, id));
            } catch (IllegalArgumentException error) {
                throw new IllegalArgumentException("sources[" + i + "]: " + error.getMessage(), error);
            }
        }
        return result;
    }

    public void run(JsonObject input, Bridge.Reply reply) {
        JsonObject p = input.deepCopy();
        // Validate the whole request before acquiring a scope or calling a setter.
        int position = ChainMoveHandlers.index(p, "position");
        int deviceCount = ChainMoveHandlers.index(p, "expectedDeviceCount");
        String track = text(p, "expectedTrackChannelId"), container = text(p, "expectedContainerName");
        String chainName = text(p, "expectedChainName");
        String chainId = ChainMoveHandlers.text(p, "expectedChannelId", null);
        List<Source> sources = sources(p);
        DeviceFingerprint.validate(p, false);
        if (busy) throw new IllegalStateException("another chain.insert is in progress");
        busy = true;
        try {
            backend.scopes().aim(new int[] {position}, track, new ContainerScopes.Outcome() {
                public void refused(String reason, String detail, JsonObject report) {
                    busy = false;
                    reply.error(new IllegalStateException("container scope " + reason + ": " + detail), 0);
                }
                public void settled(ContainerScopes.Settled scopes) {
                    int slot;
                    try {
                        slot = scopes.slotOf(position);
                        if (slot == ContainerScopes.EMPTY) throw new IllegalArgumentException("no device at top-level position " + position);
                    } catch (Exception error) {
                        busy = false; scopes.release(); reply.error(error, 0); return;
                    }
                    new Insertion(p, position, slot, deviceCount, track, container, chainName, chainId, sources, scopes, reply).start();
                }
            });
        } catch (Exception error) { busy = false; throw error; }
    }

    private final class Insertion {
        final JsonObject params;
        final int position, slot, deviceCount;
        final String track, container, chainName, expectedChainId;
        final List<Source> sources;
        final ContainerScopes.Settled scopes;
        final Bridge.Reply reply;
        final LayerPageWitness witness = new LayerPageWitness();
        WindowPager.Window raw;
        int chain = -1, attempts, dependencyPolls, landed;
        String chainId;
        boolean finished;

        Insertion(JsonObject params, int position, int slot, int deviceCount, String track, String container,
                String chainName, String expectedChainId, List<Source> sources, ContainerScopes.Settled scopes,
                Bridge.Reply reply) {
            this.params = params; this.position = position; this.slot = slot; this.deviceCount = deviceCount;
            this.track = track; this.container = container; this.chainName = chainName;
            this.expectedChainId = expectedChainId; this.sources = sources; this.scopes = scopes; this.reply = reply;
        }

        void validate() {
            if (!backend.ready(slot, position, track) || !container.equals(backend.containerName(slot)))
                throw new IllegalStateException("track or container identity changed");
        }

        void start() {
            try {
                validate();
                var names = params.get("expectedDeviceNames");
                if (names == null || names.isJsonNull()) { readLayers(); return; }
                DeviceFingerprint.read(params, backend.topWindow(), backend::trackId, backend::schedule, (rows, error) -> {
                    if (error != null) { finish(error); return; }
                    try { validate(); readLayers(); } catch (Exception failure) { finish(failure); }
                });
            } catch (Exception error) { finish(error); }
        }

        void readLayers() {
            raw = backend.layers(slot);
            WindowPager.Window window = new WindowPager.Window() {
                public int width() { return raw.width(); }
                public int count() { return raw.count(); }
                public int position() { return raw.position(); }
                public void scroll(int target) { validate(); raw.scroll(target); }
                public JsonArray snapshot() {
                    validate();
                    JsonArray page = raw.snapshot();
                    return page != null && witness.matches(page) ? page : null;
                }
            };
            JsonArray rows = new JsonArray();
            new WindowPager(backend::schedule).read(window, (offset, page, next) -> {
                witness.accept(page); rows.addAll(page); next.accept(null);
            }, (report, error) -> {
                if (error != null) { finish(error); return; }
                try {
                    for (int i = 0; i < rows.size(); i++) {
                        if (!chainName.equals(rows.get(i).getAsJsonObject().get("name").getAsString())) continue;
                        if (chain >= 0) throw new IllegalArgumentException("more than one chain is named \"" + chainName + "\"");
                        chain = i;
                    }
                    if (chain < 0) throw new IllegalArgumentException("no chain is named \"" + chainName + "\"");
                    JsonObject target = rows.get(chain).getAsJsonObject();
                    chainId = target.get("channelId").getAsString();
                    if (expectedChainId != null && !expectedChainId.equals(chainId))
                        throw new IllegalArgumentException("expectedChannelId identity changed");
                    new WindowAccess(backend::schedule).<Void>withWindow(window, chain, chain, (offset, page, next) -> {
                        validate();
                        if (!page.get(chain - offset).equals(target)) throw new IllegalStateException("chain page changed");
                        insertWhenReady(chain - offset, 0, backend.nanoTime(), next);
                    }, (unused, failure) -> finish(failure));
                } catch (Exception failure) { finish(failure); }
            });
        }

        /** False while the held chain row is not observable; a different observed chain throws. */
        boolean held(int local) {
            JsonArray page = raw.snapshot();
            if (page == null || local >= page.size() || raw.position() + local != chain) return false;
            JsonObject row = page.get(local).getAsJsonObject();
            if (!chainId.equals(row.get("channelId").getAsString()) || !chainName.equals(row.get("name").getAsString()))
                throw new IllegalStateException("chain identity changed");
            return true;
        }

        /** Before source {@code index}, wait for the preceding source's count; index == size waits for the last. */
        void insertWhenReady(int local, int index, long since, BiConsumer<Void, Exception> next) {
            try {
                validate();
                dependencyPolls++;
                boolean observedChain = held(local);
                int observed = backend.deviceCount(slot, local);
                long expected = (long) deviceCount + index;
                if (observedChain && observed > expected)
                    throw new IllegalStateException("unexpected device population: chain holds " + observed
                        + " devices; expected " + expected);
                if (!observedChain || observed != expected) {
                    if (backend.nanoTime() - since >= WAIT_MS * 1_000_000L) throw new IllegalStateException(index == 0
                        ? "chain holds " + observed + " devices; expected " + expected
                        : "source " + (index - 1) + " did not land within " + WAIT_MS + " ms; chain holds " + observed
                            + " devices; expected " + expected);
                    backend.schedule(() -> insertWhenReady(local, index, since, next), POLL_MS);
                    return;
                }
                if (index == sources.size()) { landed = observed - deviceCount; next.accept(null, null); return; }
                attempts++;
                backend.insert(slot, local, sources.get(index));
                long inserted = backend.nanoTime();
                backend.schedule(() -> insertWhenReady(local, index + 1, inserted, next), POLL_MS);
            } catch (Exception error) { next.accept(null, error); }
        }

        void finish(Exception error) {
            if (finished) return;
            finished = true;
            if (error instanceof WindowPager.RestoreFailure) backend.blockWrites(error.getMessage());
            busy = false;
            scopes.release();
            if (error != null) {
                reply.error(attempts > 0 ? new IllegalStateException("chain.insert failed after work started; "
                    + "effects may have applied: attempted " + attempts + " source(s): " + error.getMessage(), error)
                    : error, 0);
                return;
            }
            JsonObject result = new JsonObject();
            result.addProperty("success", true);
            result.addProperty("route", RULE);
            result.addProperty("attempted", attempts);
            result.addProperty("landed", landed);
            result.addProperty("chainIndex", chain);
            result.addProperty("chainName", chainName);
            result.addProperty("chainChannelId", chainId);
            result.addProperty("containerName", container);
            result.addProperty("position", position);
            result.addProperty("dependencyPolls", dependencyPolls);
            result.add("aim", scopes.report());
            reply.result(result, 0);
        }
    }
}
