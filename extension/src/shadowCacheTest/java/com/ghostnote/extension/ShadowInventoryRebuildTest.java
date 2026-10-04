package com.ghostnote.extension;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;

import static com.ghostnote.extension.ShadowProjectCache.*;
import static com.ghostnote.extension.ShadowInventoryRebuild.*;

/** Check private inventory staging, resource bounds, and changed acquisition windows. */
public final class ShadowInventoryRebuildTest {
    private static int passed;
    private static final Coverage COVERAGE = new Coverage(0, 2048, true, Set.of("velocity"),
        Set.of("portableRepeat"), "1/512-beat");
    private static final Guard VERIFIED = new Guard("chain-a", "topology-a", 0, true, true);
    private static final class Clock {
        long nanos;
        long now() { return nanos; }
        void advance(double ms) { nanos += (long) (ms * 1_000_000); }
    }
    private static final class Provider implements InventoryProvider {
        long count = 5;
        boolean full = true;
        double readMs = 20;
        int reads;
        final Clock clock;
        Runnable action = () -> {};
        Provider(Clock clock) { this.clock = clock; }
        public long cellCount() { return count; }
        public boolean fullInventory() { return full; }
        public Slot read(long index) {
            reads++; action.run(); clock.advance(readMs);
            return index == 1 ? null : slot((int) index);
        }
    }
    private static final class Fixture {
        final Clock clock = new Clock();
        final ShadowProjectCache cache = new ShadowProjectCache("inventory-test");
        final Provider provider = new Provider(clock);
        Guard guard = VERIFIED;
        Supplier<Guard> guards = () -> guard;
        ShadowInventoryRebuild coordinator;
        Fixture() { reset(DEFAULT_REGISTRY_METADATA_BUDGET_BYTES); }
        void reset(long budget) { coordinator = new ShadowInventoryRebuild(cache, provider, () -> guards.get(), 20, clock::now, budget); }
        Status finish() { Status result = coordinator.start(); while (!result.terminal()) result = coordinator.step(); return result; }
    }
    public static void main(String[] args) {
        run("retained registry checks the external window", ShadowInventoryRebuildTest::retainedWindow);
        run("private batches and atomic nonresident publication", ShadowInventoryRebuildTest::atomic);
        run("unknown identity stays diagnostic", ShadowInventoryRebuildTest::unknown);
        run("partial banks and changed dimensions refuse publication", ShadowInventoryRebuildTest::partial);
        run("root, structure, and event-window changes abort", ShadowInventoryRebuildTest::external);
        run("core lifecycle, structure, and resource invalidation abort", ShadowInventoryRebuildTest::core);
        run("guard and provider failures are terminal", ShadowInventoryRebuildTest::failures);
        run("final publication guard rejects a changed window", ShadowInventoryRebuildTest::publicationGuard);
        run("bookkeeping memory equality and excess", ShadowInventoryRebuildTest::memory);
        run("combined registry equality, atomic excess, and recovery", ShadowInventoryRebuildTest::combined);
        run("batch and total deadline boundaries", ShadowInventoryRebuildTest::time);
        run("cancel, supersede, and explicit recovery use fresh tokens", ShadowInventoryRebuildTest::recovery);
        run("published registry retires with its core domain", ShadowInventoryRebuildTest::publishedRetirement);
        run("duplicate slots and incomplete coverage refuse", ShadowInventoryRebuildTest::invalidSlots);
        run("preparation and cancellation read no inventory slots", ShadowInventoryRebuildTest::preparation);
        run("selected cell batches keep staging private and need explicit retry", ShadowInventoryRebuildTest::controlledBatches);
        run("selected cell batches retain time and range limits", ShadowInventoryRebuildTest::controlledLimits);
        System.out.println("Shadow inventory rebuild: " + passed + " test groups passed.");
    }

    private static void combined() {
        Fixture f = new Fixture(); f.provider.readMs = 0;
        f.cache.attachExternalStorageEstimate(() -> f.coordinator.bookkeepingEstimatedBytes() + f.coordinator.guardEstimatedBytes());
        check(f.finish().registryPublished(), "reference registry publishes");
        long[] extra = {MAX_COMBINED_BYTES - f.cache.combinedEstimatedBytes()};
        f.cache.attachExternalStorageEstimate(() -> extra[0] + f.coordinator.bookkeepingEstimatedBytes() + f.coordinator.guardEstimatedBytes());
        f.cache.resetInventoryForUnknownStructure("combined-model-rebuild");
        check(f.finish().registryPublished() && f.cache.combinedEstimatedBytes() == MAX_COMBINED_BYTES, "registry equality publishes all entries");
        extra[0]++;
        f.cache.resetInventoryForUnknownStructure("combined-model-excess");
        Status excess = f.finish();
        check(excess.terminal() && !excess.registryPublished() && excess.reason().equals("combined-storage-budget"), "registry excess aborts atomically");
        check(f.coordinator.bookkeepingEstimatedBytes() == 0 && f.cache.diagnostics().entries() == 0, "refused registry retains no partial entries");
        extra[0] = 0; check(f.finish().registryPublished(), "explicit registry recovery publishes fresh references");
    }

    private static void preparation() {
        Fixture f = new Fixture(); f.provider.readMs = 0;
        Status prepared = f.coordinator.start();
        check(prepared.phase().equals("enumerating") && prepared.enumeratedCells() == 0 && f.provider.reads == 0,
            "preparation cannot acquire slots or publish even a small inventory");
        check(!prepared.registryPublished() && !prepared.terminal() && !prepared.complete(), "private start remains unavailable");
        Status cancelled = f.coordinator.cancel("live-cancel-control");
        check(cancelled.terminal() && cancelled.reason().equals("live-cancel-control") && !cancelled.registryPublished(), "cancelled start is terminal");
        check(f.coordinator.step(1).equals(cancelled) && f.coordinator.step().equals(cancelled) && f.provider.reads == 0,
            "polling cancellation cannot read, restart, or publish");
    }

    private static void controlledBatches() {
        Fixture f = new Fixture(); f.provider.readMs = 0; f.coordinator.start();
        Status first = f.coordinator.step(1);
        check(first.enumeratedCells() == 1 && f.provider.reads == 1 && !first.terminal() && !first.registryPublished(),
            "one selected cell exposes positive private progress");
        check(f.cache.clipAt(slot(0).address()) == null, "partial candidate cannot enter the published registry");
        Status cancelled = f.coordinator.cancel("partial-control-cancel");
        check(f.coordinator.step(64).equals(cancelled) && f.provider.reads == 1, "a larger poll cannot retry an aborted attempt");
        Status retry = f.coordinator.start();
        check(!retry.token().equals(first.token()) && retry.enumeratedCells() == 0, "an explicit retry uses fresh staging");
        Status next = retry;
        for (int i = 1; i <= 5; i++) {
            next = f.coordinator.step(1);
            check(next.enumeratedCells() == i && next.registryPublished() == (i == 5), "publication needs every requested cell");
        }
        int acquired = f.provider.reads;
        check(f.coordinator.step(1).equals(next) && f.provider.reads == acquired, "publication polls cannot re-enumerate");
    }

    private static void controlledLimits() {
        Fixture boundary = new Fixture(); boundary.provider.readMs = BATCH_BUDGET_MS; boundary.coordinator.start();
        Status equality = boundary.coordinator.step(1);
        check(!equality.terminal() && equality.enumeratedCells() == 1 && equality.lastBatchMs() == BATCH_BUDGET_MS,
            "one selected cell can reach the existing batch boundary");
        Fixture expensive = new Fixture(); expensive.provider.readMs = BATCH_BUDGET_MS + .001; expensive.coordinator.start();
        check(expensive.coordinator.step(1).reason().equals("inventory-host-work-budget"), "a selected cell cannot bypass the batch budget");
        Fixture expired = new Fixture(); expired.provider.readMs = 0; expired.coordinator.start(); expired.clock.advance(REBUILD_BUDGET_MS + .001);
        check(expired.coordinator.step(1).reason().equals("inventory-rebuild-budget") && expired.provider.reads == 0,
            "an expired prepared attempt cannot acquire a first cell");
        Fixture range = new Fixture(); range.coordinator.start();
        for (int cells : new int[] { 0, -1, MAX_CONTROL_BATCH_CELLS + 1 }) {
            try { range.coordinator.step(cells); throw new AssertionError("invalid cell limit accepted"); }
            catch (IllegalArgumentException expected) { }
        }
        check(range.provider.reads == 0 && range.coordinator.status().enumeratedCells() == 0, "invalid controls leave the prepared attempt private");
    }

    private static void retainedWindow() {
        Fixture f = new Fixture(); check(f.finish().registryPublished(), "stable model window publishes");
        f.guard = new Guard("chain-a", "topology-a", 2, true, true);
        Status result = f.coordinator.status();
        check(!result.registryPublished() && result.reason().equals("inventory-external-window-changed")
            && f.cache.diagnostics().health() == Health.INVALID, "equal root endpoints cannot retain a changed event window");
        int reads = f.provider.reads;
        check(!f.coordinator.step().registryPublished() && f.provider.reads == reads, "terminal registry poll cannot reacquire");
        check(f.finish().registryPublished(), "recovery requires an explicit new attempt");
        f.guards = () -> { throw new AssertionError("cancellation must not read the host"); };
        check(f.coordinator.cancel("callback-cancel").terminal() && !f.coordinator.status().registryPublished(),
            "callback cancellation retires retained inventory without source reads");
    }

    private static void atomic() {
        Fixture f = new Fixture();
        String oldRef = f.cache.create(new Address("old-track", 0), COVERAGE);
        f.cache.admit(oldRef); f.cache.inventoryEnumerated();
        f.cache.settleReplay(oldRef, new ReplayWitness(true, true, true, 1500, 10, 50));
        Snapshot old = f.cache.snapshot(oldRef, COVERAGE, Map.of(), c -> List.of(), true, "old-authority").snapshot();
        Status initial = f.coordinator.start();
        check(initial.phase().equals("enumerating") && !f.cache.isCurrent(old), "staging blocks old snapshots");
        Status batch = f.coordinator.step();
        check(batch.enumeratedCells() == 2 && batch.presentClips() == 1 && !batch.terminal(), "bounded monotonic batch");
        check(f.cache.clipAt(slot(0).address()) == null && f.cache.clipAt(old.address()).equals(oldRef), "candidate addresses remain private");
        Status done = batch;
        while (!done.terminal()) done = f.coordinator.step();
        check(done.registryPublished() && done.fullInventoryEnumerated() && done.enumeratedCells() == 5
            && done.presentClips() == 4 && done.cacheHealth() == Health.PARTIAL, "atomic complete registry has nonresident clips");
        check(!done.membershipComplete() && !done.complete() && !done.eligible(), "enumeration is not membership completeness");
        check(!f.cache.hasClip(oldRef) && f.cache.hasClip(f.cache.clipAt(slot(0).address())), "publish replaces the old registry once");
        check(f.cache.diagnostics().resident() == 0 && f.cache.diagnostics().occupiedCoordinates() == 0, "inventory allocates no residence");
    }

    private static void unknown() {
        Fixture f = new Fixture(); f.guard = new Guard(null, "unknown-stable-window", 0, false, true);
        Status done = f.finish();
        check(done.registryPublished() && !done.identityVerified() && done.reason().equals("identity-unverified"),
            "a stable unknown window permits new diagnostic identities only");
        String old = f.cache.clipAt(slot(0).address());
        check(f.finish().registryPublished() && !old.equals(f.cache.clipAt(slot(0).address())),
            "same-address registry retries never infer continuity");
        f.provider.count = 0;
        Status empty = f.finish();
        check(empty.registryPublished() && !empty.complete() && !empty.eligible(), "empty full inventory does not prove identity");
    }

    private static void partial() {
        Fixture f = new Fixture(); f.provider.full = false;
        check(f.coordinator.start().reason().equals("inventory-outside-configured-bank"), "partial bank cannot publish");
        f.provider.full = true; f.provider.count = 21;
        check(f.coordinator.start().reason().equals("inventory-cell-bound"), "provider index space must be bounded");
        f.provider.count = 5; f.coordinator.start(); f.coordinator.step(); f.provider.count++;
        check(f.coordinator.step().reason().equals("inventory-cell-count-changed"), "dimensions cannot change during staging");
        f.provider.count = 5; f.coordinator.start(); f.coordinator.step(); f.provider.full = false;
        check(f.coordinator.step().reason().equals("inventory-outside-configured-bank"), "coverage must remain full");
    }

    private static void external() {
        for (Guard changed : List.of(new Guard("chain-b", "topology-a", 0, true, true),
            new Guard("chain-a", "topology-b", 0, true, true), new Guard("chain-a", "topology-a", 1, true, true),
            new Guard("chain-a", "topology-a", 0, true, false))) {
            Fixture f = new Fixture(); f.coordinator.start();
            f.provider.action = () -> f.guard = changed;
            Status result = f.coordinator.step();
            check(result.phase().equals("aborted") && result.enumeratedCells() == 0 && !result.registryPublished(),
                "an event during a read rejects the slot before staging");
            check(f.cache.diagnostics().domainObjects().clipEntryRecords() == 0, "aborted candidates are released");
        }
    }

    private static void core() {
        Fixture changed = new Fixture(); changed.coordinator.start();
        changed.provider.action = changed.cache::projectChanged;
        check(changed.coordinator.step().reason().equals("inventory-core-window-changed"), "project changes retire staging");
        Fixture structural = new Fixture(); structural.coordinator.start();
        structural.cache.resetInventoryForUnknownStructure("host-structure");
        check(structural.coordinator.step().reason().equals("inventory-core-window-changed"), "external core reset retires token");
        Fixture resource = new Fixture(); resource.coordinator.start(); resource.cache.measurePing(51);
        check(resource.coordinator.step().reason().equals("inventory-core-window-changed"), "resource shedding retires token");
    }

    private static void failures() {
        Fixture read = new Fixture(); read.coordinator.start();
        read.provider.action = () -> { throw new IllegalStateException("read failed"); };
        check(read.coordinator.step().terminal() && read.coordinator.status().phase().equals("aborted"), "read failure is terminal");
        Fixture guard = new Fixture(); guard.coordinator.start();
        guard.guards = () -> { throw new IllegalStateException("guard failed"); };
        check(guard.coordinator.step().reason().equals("inventory-guard-unavailable"), "guard failure cannot publish");
        Fixture initial = new Fixture(); initial.guards = () -> null;
        check(initial.coordinator.start().reason().equals("inventory-guard-unavailable"), "missing initial guard refuses");
        initial.guards = () -> { throw new IllegalStateException("initial guard failed"); };
        check(initial.coordinator.start().reason().equals("inventory-guard-unavailable"), "initial guard exception refuses");
    }

    private static void memory() {
        Fixture equality = new Fixture(); equality.provider.count = 1; equality.provider.readMs = 0;
        equality.reset(registryMetadataEstimate(slot(0)));
        check(equality.finish().registryPublished(), "bookkeeping threshold equality is allowed");
        Fixture above = new Fixture(); above.provider.count = 1; above.reset(registryMetadataEstimate(slot(0)) - 1);
        Status result = above.finish();
        check(result.reason().equals("inventory-bookkeeping-memory-budget") && result.presentClips() == 0
            && result.registryMetadataEstimatedBytes() == 0, "excess is rejected before allocating a candidate entry");
        check(above.cache.diagnostics().recorderEstimatedBytes() == 0, "bookkeeping bound is separate from sparse recorder bytes");
    }

    private static void publicationGuard() {
        Fixture f = new Fixture(); f.provider.count = 1; f.provider.readMs = 0;
        f.guards = () -> f.cache.diagnostics().entries() == 0 ? VERIFIED
            : new Guard("chain-b", "topology-a", 0, true, true);
        check(f.finish().reason().equals("inventory-external-window-changed")
            && !f.coordinator.status().registryPublished(), "post-publication guard failure invalidates the candidate");
        check(f.cache.diagnostics().health() == Health.INVALID, "changed publication cannot serve a current snapshot");
    }

    private static void time() {
        Fixture equality = new Fixture(); equality.provider.count = 1; equality.provider.readMs = 45;
        check(equality.finish().registryPublished(), "batch threshold equality is allowed");
        Fixture above = new Fixture(); above.provider.readMs = 45.01;
        check(above.finish().reason().equals("inventory-host-work-budget"), "blocking host work over budget aborts");
        Fixture deadline = new Fixture(); deadline.provider.count = 0; deadline.coordinator.start(); deadline.clock.advance(40_000);
        check(deadline.coordinator.step().registryPublished(), "total deadline equality is allowed");
        Fixture expired = new Fixture(); expired.coordinator.start(); expired.clock.advance(40_000.01);
        check(expired.coordinator.step().reason().equals("inventory-rebuild-budget"), "expired staging cannot publish");
    }

    private static void recovery() {
        Fixture f = new Fixture(); Status first = f.coordinator.start(); f.coordinator.step();
        Status cancel = f.coordinator.cancel("test-cancel");
        check(cancel.explicitRetryAvailable() && !cancel.registryPublished() && cancel.registryMetadataEstimatedBytes() == 0,
            "cancel releases staging and allows an explicit retry");
        Status retry = f.coordinator.start();
        check(retry.attempt() > first.attempt() && !retry.token().equals(first.token()), "retry mints a new token");
        Status superseding = f.coordinator.start();
        check(superseding.attempt() > retry.attempt() && !superseding.token().equals(retry.token()), "superseding attempt retires old staging");
        f.cache.abortRebuild(first.token(), "late-old-cancel");
        Status done = f.coordinator.step(); while (!done.terminal()) done = f.coordinator.step();
        check(done.registryPublished(), "old attempt cannot abort current publication");
        check(f.coordinator.step().token().equals(done.token()), "terminal step cannot start a hidden retry");
    }

    private static void publishedRetirement() {
        for (String change : List.of("project", "structure", "gap", "rebuild")) {
            Fixture f = new Fixture(); Status first = f.finish();
            f.cache.save(); check(f.coordinator.status().registryPublished(), "save keeps the current registry token");
            switch (change) {
                case "project" -> f.cache.projectChanged();
                case "structure" -> f.cache.resetInventoryForUnknownStructure("structure changed");
                case "gap" -> f.cache.requireRebuild("event gap");
                case "rebuild" -> f.cache.beginRebuild();
                default -> throw new AssertionError(change);
            }
            Status retired = f.coordinator.status();
            check(retired.phase().equals("aborted") && !retired.registryPublished()
                && retired.reason().equals("inventory-publication-retired"), "old published token cannot describe the new domain");
            check(f.coordinator.step().token().equals(first.token()) && !f.coordinator.step().registryPublished(),
                "terminal polling cannot restore old publication or start a retry");
            Status retry = f.finish();
            check(retry.registryPublished() && retry.attempt() > first.attempt() && !retry.token().equals(first.token()),
                "explicit retry creates a new current publication");
        }
    }

    private static void invalidSlots() {
        Fixture duplicate = new Fixture(); duplicate.provider.count = 3;
        ShadowInventoryRebuild coordinator = new ShadowInventoryRebuild(duplicate.cache, new InventoryProvider() {
            public long cellCount() { return 2; }
            public boolean fullInventory() { return true; }
            public Slot read(long index) { return slot(0); }
        }, () -> VERIFIED, 2, duplicate.clock::now, DEFAULT_REGISTRY_METADATA_BUDGET_BYTES);
        coordinator.start(); check(coordinator.step().reason().equals("inventory-read-or-stage-failed"), "duplicate address cannot publish");
        Fixture coverage = new Fixture();
        ShadowInventoryRebuild invalid = new ShadowInventoryRebuild(coverage.cache, new InventoryProvider() {
            public long cellCount() { return 1; }
            public boolean fullInventory() { return true; }
            public Slot read(long index) {
                return new Slot(new Address("track-new", 0), new Coverage(0, MAX_WIDTH + 1, true, Set.of(), Set.of(), "1/512-beat"));
            }
        }, () -> VERIFIED, 1, coverage.clock::now, DEFAULT_REGISTRY_METADATA_BUDGET_BYTES);
        invalid.start(); check(invalid.step().reason().equals("inventory-coverage-incomplete"), "over-limit coverage cannot publish");
    }

    private static Slot slot(int row) { return new Slot(new Address("track-new", row), COVERAGE); }
    private static void check(boolean pass, String reason) { if (!pass) throw new AssertionError(reason); }
    private static void run(String name, Runnable test) {
        try { test.run(); passed++; } catch (Throwable error) { throw new AssertionError(name, error); }
    }
}
