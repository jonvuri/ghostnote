package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.ControllerHost;
import com.ghostnote.extension.Bridge;
import com.ghostnote.extension.ContainerScopes;
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
import java.util.UUID;

/** P01 research only: insert sources directly at a layer's end, without selecting or moving a device.
 * The reply is an attempt receipt, never a readback. An investigator must independently verify the chain
 * before acknowledging the receipt. An uncertain invocation stays latched until controller replacement.
 */
public final class ChainInsertProbeHandlers extends HandlerGroup {
    public static final String MARKER = "p01-chain-insert-v2";
    public static final String SCRATCH = "gn-p01-insert";
    private static final int DEPENDENCY_POLL_MS = 5, MAX_DEPENDENCY_POLLS = 400;
    public record Source(String kind, String value) { }
    public interface Host {
        ContainerScopes scopes();
        String trackId();
        String trackName();
        String containerName(int slot);
        boolean ready(int slot, int position, String track);
        WindowPager.Window layers(int slot);
        int deviceCount(int slot, int localChain);
        void insert(int slot, int localChain, Source source);
        void schedule(Runnable task, int ms);
        void blockWrites(String reason);
    }
    private final Host backend;
    private long sequence, pending;
    private boolean busy, uncertain;

    public ChainInsertProbeHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
        var controls = ChainControlHandlers.over(host, rig);
        backend = new Host() {
            public ContainerScopes scopes() { return rig.containerScopes; }
            public String trackId() { return rig.cursorTracks[0].channelId().get(); }
            public String trackName() { return rig.cursorTracks[0].name().get(); }
            public String containerName(int slot) { return rig.scopeDevice(slot).name().get(); }
            public boolean ready(int slot, int position, String track) {
                return track.equals(trackId()) && SCRATCH.equals(trackName())
                    && rig.scopeRequestedPosition[slot] == position && rig.scopeSettled(slot)
                    && rig.scopeDevice(slot).hasLayers().get();
            }
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
            public void schedule(Runnable task, int ms) { host.scheduleTask(task, ms); }
            public void blockWrites(String reason) { rig.writeGate.blockWrites(reason); }
        };
    }
    /** Offline host-model seam. */
    public ChainInsertProbeHandlers(Host backend) { super(null, null, null); this.backend = backend; }
    @Override public void register(HandlerRegistry registry) { registry.onAsync("probe.chainInsert", this::run); }

    private JsonObject status() {
        JsonObject result = new JsonObject();
        result.addProperty("marker", MARKER); result.addProperty("busy", busy);
        result.addProperty("pendingReceipt", pending); result.addProperty("uncertain", uncertain);
        result.addProperty("scratchName", SCRATCH);
        return result;
    }
    private static String text(JsonObject p, String key) {
        String value = ChainMoveHandlers.text(p, key, null);
        if (value == null) throw new IllegalArgumentException(key + " is required");
        return value;
    }
    private static List<Source> sources(JsonObject p) {
        if (!p.has("sources") || !p.get("sources").isJsonArray()) throw new IllegalArgumentException("sources must be an array");
        var input = p.getAsJsonArray("sources");
        if (input.isEmpty() || input.size() > 6) throw new IllegalArgumentException("one through six sources required");
        List<Source> result = new ArrayList<>();
        for (var value : input) {
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
                    if (!path.isAbsolute() || !id.toLowerCase(java.util.Locale.ROOT).endsWith(".bwpreset") || !Files.isRegularFile(path))
                        throw new IllegalArgumentException("existing absolute .bwpreset required");
                }
                default -> throw new IllegalArgumentException("unknown source kind");
            }
            result.add(new Source(kind, id));
        }
        return result;
    }

    public void run(JsonObject input, Bridge.Reply reply) {
        JsonObject p = input.deepCopy();
        String operation = text(p, "operation");
        if (operation.equals("status")) { reply.result(status(), 0); return; }
        if (operation.equals("acknowledge")) {
            int receipt = ChainMoveHandlers.index(p, "receipt");
            if (busy || uncertain || pending == 0 || receipt != pending)
                throw new IllegalStateException("receipt cannot be acknowledged; inspect uncertain effects before replacement");
            pending = 0;
            reply.result(status(), 0);
            return;
        }
        if (!operation.equals("insert")) throw new IllegalArgumentException("unknown operation");
        if (busy || uncertain || pending != 0) throw new IllegalStateException("prior insertion awaits independent inspection");
        // Validate the whole request before acquiring or moving any handle.
        int position = ChainMoveHandlers.index(p, "position"), chain = ChainMoveHandlers.index(p, "chainIndex");
        int deviceCount = ChainMoveHandlers.index(p, "expectedDeviceCount");
        String track = text(p, "expectedTrackChannelId"), container = text(p, "expectedContainerName");
        String chainId = text(p, "expectedChannelId"), chainName = text(p, "expectedChainName");
        List<Source> sources = sources(p);
        if (!track.equals(backend.trackId()) || !SCRATCH.equals(backend.trackName()))
            throw new IllegalArgumentException("point cursor 0 at the owned gn-p01-insert track first");
        busy = true;
        final long receipt = ++sequence;
        try {
            backend.scopes().aim(new int[] {position}, track, new ContainerScopes.Outcome() {
                public void refused(String reason, String detail, JsonObject report) {
                    busy = false; reply.error(new IllegalStateException(reason + ": " + detail), 0);
                }
                public void settled(ContainerScopes.Settled scopes) {
                    int slot = scopes.slotOf(position);
                    if (slot == ContainerScopes.EMPTY) {
                        busy = false; scopes.release(); reply.error(new IllegalArgumentException("container is absent"), 0); return;
                    }
                    new Insertion(receipt, position, chain, slot, deviceCount, track, container, chainId, chainName, sources, scopes, reply).start();
                }
            });
        } catch (Exception error) { busy = false; throw error; }
    }

    private final class Insertion {
        final long receipt;
        final int position, chain, slot, deviceCount;
        final String track, container, chainId, chainName;
        final List<Source> sources;
        final ContainerScopes.Settled scopes;
        final Bridge.Reply reply;
        final LayerPageWitness witness = new LayerPageWitness();
        int attempts, dependencyPolls;
        boolean finished;
        Insertion(long receipt, int position, int chain, int slot, int deviceCount, String track, String container, String chainId,
                String chainName, List<Source> sources, ContainerScopes.Settled scopes, Bridge.Reply reply) {
            this.receipt = receipt; this.position = position; this.chain = chain; this.slot = slot;
            this.deviceCount = deviceCount;
            this.track = track; this.container = container; this.chainId = chainId; this.chainName = chainName;
            this.sources = sources; this.scopes = scopes; this.reply = reply;
        }
        void validate() {
            if (!backend.ready(slot, position, track) || !container.equals(backend.containerName(slot)))
                throw new IllegalStateException("container identity changed");
        }
        void start() {
            try {
                validate();
                WindowPager.Window raw = backend.layers(slot);
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
                        if (chain >= rows.size()) throw new IllegalArgumentException("chain is absent");
                        JsonObject target = rows.get(chain).getAsJsonObject();
                        if (!chainId.equals(target.get("channelId").getAsString()) || !chainName.equals(target.get("name").getAsString()))
                            throw new IllegalArgumentException("chain identity changed");
                        new WindowAccess(backend::schedule).<Void>withWindow(window, chain, chain, (offset, page, next) -> {
                            validate();
                            if (!page.get(chain - offset).equals(target)) throw new IllegalStateException("chain page changed");
                            insertWhenReady(chain - offset, 0, 0, next);
                        }, (unused, failure) -> finish(failure));
                    } catch (Exception failure) { finish(failure); }
                });
            } catch (Exception error) { finish(error); }
        }
        /** A later end insertion depends on the preceding device landing. Wait for count only;
         * the caller still makes the sole independent content readback after this request. */
        void insertWhenReady(int local, int index, int polls, java.util.function.BiConsumer<Void, Exception> next) {
            try {
                validate();
                dependencyPolls++;
                int observed = backend.deviceCount(slot, local);
                long expected = (long) deviceCount + index;
                if (observed > expected) throw new IllegalStateException("unexpected device population before source " + index);
                if (observed != expected) {
                    if (polls >= MAX_DEPENDENCY_POLLS) throw new IllegalStateException("preceding insertion did not land; do not repeat");
                    backend.schedule(() -> insertWhenReady(local, index, polls + 1, next), DEPENDENCY_POLL_MS);
                    return;
                }
                pending = receipt;
                attempts++;
                backend.insert(slot, local, sources.get(index));
                if (index + 1 == sources.size()) next.accept(null, null);
                else backend.schedule(() -> insertWhenReady(local, index + 1, 0, next), DEPENDENCY_POLL_MS);
            } catch (Exception error) { next.accept(null, error); }
        }
        void finish(Exception error) {
            if (finished) return;
            finished = true;
            if (error != null && attempts > 0) uncertain = true;
            if (error instanceof WindowPager.RestoreFailure) {
                uncertain = true; backend.blockWrites(error.getMessage());
            }
            busy = false;
            scopes.release();
            if (error != null) {
                reply.error(attempts > 0 ? new IllegalStateException("insertion attempted " + attempts
                    + " source(s); effects uncertain, do not repeat: " + error.getMessage(), error) : error, 0);
                return;
            }
            JsonObject result = status();
            result.addProperty("attempted", attempts); result.addProperty("verified", false);
            result.addProperty("dependencyPolls", dependencyPolls);
            result.addProperty("chainChannelId", chainId); result.addProperty("receipt", receipt);
            reply.result(result, 0);
        }
    }
}
