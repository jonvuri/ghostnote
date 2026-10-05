package com.ghostnote.extension;

import java.util.Objects;
import java.util.function.LongSupplier;
import java.util.function.Supplier;

import static com.ghostnote.extension.ShadowProjectCache.*;

/** Enumerate a private diagnostic registry. This class has no host handles. */
public final class ShadowInventoryRebuild {
    public static final double BATCH_BUDGET_MS = 45;
    public static final double REBUILD_BUDGET_MS = 40_000;
    public static final int MAX_CONTROL_BATCH_CELLS = 64;
    /** Conservative bookkeeping bound. This is not the sparse recorder or snapshot budget. */
    public static final long DEFAULT_REGISTRY_METADATA_BUDGET_BYTES = MAX_REGISTRY_BYTES;
    private static final double BATCH_TARGET_MS = 40;

    /** The caller supplies a bounded index space. A null slot proves absence at that index. */
    public interface InventoryProvider {
        long cellCount();
        boolean fullInventory();
        Slot read(long index);
    }

    public record Slot(Address address, Coverage coverage) {
        public Slot { Objects.requireNonNull(address); Objects.requireNonNull(coverage); }
    }

    /** The caller changes these values before a lifecycle, structural, or event-window change. */
    public record Guard(String loadedInstanceWitness, String structureWitness, long eventWindowVersion,
                        boolean verified, boolean completeEventWindow) {
        public Guard {
            if (structureWitness == null || structureWitness.isEmpty() || eventWindowVersion < 0
                || (verified && (loadedInstanceWitness == null || loadedInstanceWitness.isEmpty())))
                throw new IllegalArgumentException("invalid inventory guard");
        }
    }

    public record Status(String phase, String reason, long attempt, RebuildToken token, Guard capturedGuard,
                         long enumeratedCells, long totalCells, long presentClips,
                         boolean terminal, boolean registryPublished, boolean fullInventoryEnumerated,
                         boolean identityVerified, boolean membershipComplete, boolean complete, boolean eligible,
                         boolean explicitRetryAvailable, Health cacheHealth, double elapsedMs, double lastBatchMs,
                         long registryMetadataEstimatedBytes, long registryMetadataBudgetBytes,
                         String memoryEstimateScope) {}

    private final ShadowProjectCache cache;
    private final InventoryProvider inventory;
    private final Supplier<Guard> guards;
    private final LongSupplier nanoTime;
    private final long maximumCells, metadataBudget;
    private Guard captured;
    private RebuildToken token;
    private String phase = "idle", reason = "not-started";
    private long attempt, started, ended, next, total, present, metadataBytes;
    private double lastBatchMs;
    private boolean published;

    public ShadowInventoryRebuild(ShadowProjectCache cache, InventoryProvider inventory, Supplier<Guard> guards,
                                  long maximumCells) {
        this(cache, inventory, guards, maximumCells, System::nanoTime, cache.limits().registryBytes());
    }

    public ShadowInventoryRebuild(ShadowProjectCache cache, InventoryProvider inventory, Supplier<Guard> guards,
                                  long maximumCells, LongSupplier nanoTime, long registryMetadataBudgetBytes) {
        this.cache = Objects.requireNonNull(cache);
        this.inventory = Objects.requireNonNull(inventory);
        this.guards = Objects.requireNonNull(guards);
        this.nanoTime = Objects.requireNonNull(nanoTime);
        if (maximumCells < 0 || registryMetadataBudgetBytes < 0)
            throw new IllegalArgumentException("invalid inventory bound");
        this.maximumCells = maximumCells;
        metadataBudget = registryMetadataBudgetBytes;
    }

    /** Each explicit retry has a new token. There is no automatic retry loop. */
    public Status start() {
        if (active()) cancel("superseded-rebuild");
        attempt = Math.incrementExact(attempt);
        started = nanoTime.getAsLong(); ended = 0;
        next = total = present = metadataBytes = 0; lastBatchMs = 0;
        captured = null; published = false; phase = "enumerating"; reason = "inventory-in-progress";
        token = cache.beginRebuild();
        try {
            try { captured = guards.get(); }
            catch (RuntimeException error) { return abort("inventory-guard-unavailable"); }
            if (captured == null) return abort("inventory-guard-unavailable");
            if (!cache.allowCombinedGrowth(0)) return abort("combined-storage-budget");
            if (!captured.completeEventWindow()) return abort("inventory-event-gap");
            if (!inventory.fullInventory()) return abort("inventory-outside-configured-bank");
            total = inventory.cellCount();
            if (total < 0 || total > maximumCells) return abort("inventory-cell-bound");
            if (!checkWindow()) return status();
            if (elapsed(started) > BATCH_BUDGET_MS) return abort("inventory-host-work-budget");
        } catch (RuntimeException error) { return abort("inventory-provider-unavailable"); }
        return status();
    }

    /** Stage a cooperative batch. A complete scan publishes only once, after the final guards. */
    public Status step() {
        return stepBatch(Long.MAX_VALUE);
    }

    /** Limit diagnostic progress without changing time or publication guards. */
    public Status step(int maximumBatchCells) {
        if (maximumBatchCells < 1 || maximumBatchCells > MAX_CONTROL_BATCH_CELLS)
            throw new IllegalArgumentException("inventory control batch must contain 1 through 64 cells");
        return stepBatch(maximumBatchCells);
    }

    private Status stepBatch(long maximumBatchCells) {
        if (!active()) return status();
        long batchStarted = nanoTime.getAsLong();
        try {
            if (!checkWindow()) return status();
            long batchEnd = next + Math.min(total - next, maximumBatchCells);
            while (next < batchEnd && elapsed(batchStarted) < BATCH_TARGET_MS) {
                if (!checkWindow()) return status();
                Slot slot = inventory.read(next);
                if (!checkWindow()) return status();
                if (slot != null) {
                    if (slot.coverage().width() > cache.limits().width() || !slot.coverage().allChannels())
                        return abort("inventory-coverage-incomplete");
                    long bytes = registryMetadataEstimate(slot);
                    if (bytes > metadataBudget - metadataBytes) return abort("inventory-bookkeeping-memory-budget");
                    try { cache.stageNonResident(token, slot.address(), slot.coverage(), bytes); }
                    catch (IllegalStateException error) {
                        if ("combined-storage-budget".equals(error.getMessage())) return abort("combined-storage-budget");
                        throw error;
                    }
                    metadataBytes += bytes;
                    present++;
                }
                next++;
                lastBatchMs = elapsed(batchStarted);
                if (lastBatchMs > BATCH_BUDGET_MS) return abort("inventory-host-work-budget");
            }
            lastBatchMs = elapsed(batchStarted);
            if (lastBatchMs > BATCH_BUDGET_MS) return abort("inventory-host-work-budget");
            if (!checkWindow()) return status();
            lastBatchMs = elapsed(batchStarted);
            if (lastBatchMs > BATCH_BUDGET_MS) return abort("inventory-host-work-budget");
            if (next == total) {
                if (!cache.publishRebuild(token, true, elapsed(started))) return abort("inventory-publication-refused");
                if (!checkExternalWindow()) return status();
                Diagnostics after = cache.diagnostics();
                if (!token.initDomain().equals(after.initDomain()) || token.project() != after.projectGeneration()
                    || token.structure() != after.structuralEpoch() || token.rebuild() != after.rebuildGeneration()
                    || after.health() == Health.INVALID || after.health() == Health.OVERFLOW)
                    return abort("inventory-core-window-changed");
                lastBatchMs = elapsed(batchStarted);
                if (lastBatchMs > BATCH_BUDGET_MS) return abort("inventory-host-work-budget");
                if (elapsed(started) > cache.limits().rebuildDeadlineMs()) return abort("inventory-rebuild-budget");
                published = true; phase = "published"; ended = nanoTime.getAsLong();
                reason = captured.verified() ? "inventory-published-nonresident" : "identity-unverified";
            }
        } catch (RuntimeException error) { return abort("inventory-read-or-stage-failed"); }
        return status();
    }

    public Status cancel(String cause) {
        if (cause == null || cause.isEmpty()) throw new IllegalArgumentException("invalid cancellation reason");
        return active() || published ? abort(cause) : status();
    }

    public Status status() {
        if (published && !publicationCurrent()) {
            published = false;
            phase = "aborted";
            reason = "inventory-publication-retired";
            metadataBytes = 0;
            ended = nanoTime.getAsLong();
        }
        if (published) checkExternalWindow();
        boolean terminal = "published".equals(phase) || "aborted".equals(phase);
        return new Status(phase, reason, attempt, token, captured, next, total, present, terminal, published, published,
            captured != null && captured.verified(), false, false, false, "aborted".equals(phase),
            cache.diagnostics().health(), "idle".equals(phase) ? 0 : elapsedTo(started, terminal ? ended : nanoTime.getAsLong()),
            lastBatchMs, metadataBytes, metadataBudget, "current-attempt extension-owned registry bookkeeping estimate; excludes prior registry, host, sparse recorder, and enriched snapshots");
    }
    /** Current bookkeeping only. Unlike status(), this getter makes no guard or host read. */
    public long bookkeepingEstimatedBytes() { return metadataBytes; }
    public long guardEstimatedBytes() {
        return captured == null ? 0 : 128L + 2L * (captured.structureWitness().length()
            + (captured.loadedInstanceWitness() == null ? 0 : captured.loadedInstanceWitness().length()));
    }

    private boolean publicationCurrent() {
        IdentityDomain current = cache.identityDomain();
        return token != null && token.initDomain().equals(current.initDomain()) && token.project() == current.project()
            && token.structure() == current.structure() && token.rebuild() == current.rebuild();
    }

    private boolean active() { return "enumerating".equals(phase); }

    private boolean checkWindow() {
        if (elapsed(started) > cache.limits().rebuildDeadlineMs()) { abort("inventory-rebuild-budget"); return false; }
        if (!cache.isRebuildCurrent(token)) {
            abort("inventory-core-window-changed"); return false;
        }
        return checkExternalWindow();
    }

    private boolean checkExternalWindow() {
        Guard current;
        try { current = guards.get(); }
        catch (RuntimeException error) { abort("inventory-guard-unavailable"); return false; }
        if (current == null) { abort("inventory-guard-unavailable"); return false; }
        if (!current.completeEventWindow()) { abort("inventory-event-gap"); return false; }
        if (!captured.equals(current)) { abort("inventory-external-window-changed"); return false; }
        if (!inventory.fullInventory()) { abort("inventory-outside-configured-bank"); return false; }
        if (inventory.cellCount() != total) { abort("inventory-cell-count-changed"); return false; }
        return true;
    }

    private Status abort(String cause) {
        cache.abortRebuild(token, cause);
        metadataBytes = 0;
        phase = "aborted"; reason = cause; published = false; ended = nanoTime.getAsLong();
        return status();
    }

    /** Count copied identity and coverage text plus conservative record and map storage. */
    public static long registryMetadataEstimate(Slot slot) {
        long bytes = 512L + 2L * slot.address().trackId().length() + 2L * slot.coverage().timingBasis().length();
        for (String field : slot.coverage().fields()) bytes = Math.addExact(bytes, 64L + 2L * field.length());
        for (String field : slot.coverage().unsupportedFields()) bytes = Math.addExact(bytes, 64L + 2L * field.length());
        return bytes;
    }

    private double elapsed(long from) { return elapsedTo(from, nanoTime.getAsLong()); }
    private static double elapsedTo(long from, long to) {
        long nanos = to - from;
        if (nanos < 0) throw new IllegalStateException("inventory clock moved backwards");
        return nanos / 1_000_000.0;
    }
}
