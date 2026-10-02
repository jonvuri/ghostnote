package com.ghostnote.extension;

import com.bitwig.extension.callback.StepDataChangedCallback;
import com.bitwig.extension.callback.BooleanValueChangedCallback;
import com.bitwig.extension.callback.IntegerValueChangedCallback;
import com.bitwig.extension.callback.StringValueChangedCallback;
import com.bitwig.extension.controller.api.Application;
import com.bitwig.extension.controller.api.Project;
import com.bitwig.extension.controller.api.BooleanValue;
import com.bitwig.extension.controller.api.IntegerValue;
import com.bitwig.extension.controller.api.StringValue;
import com.bitwig.extension.controller.api.ClipLauncherSlot;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.NoteOccurrence;
import com.bitwig.extension.controller.api.NoteStep;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonObject;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import static com.ghostnote.extension.ShadowProjectCache.*;

/** Check adapter guards with a host model. These checks do not prove host replay. */
public final class ShadowCacheProbeTest {
    private static int passed;
    private static final int WIDTH = 32;
    private static final Coordinate CELL = new Coordinate(0, 60);

    public static void main(String[] args) throws Exception {
        run("selected callback family", ShadowCacheProbeTest::family);
        run("same-target read preserves the recorder", ShadowCacheProbeTest::sameTarget);
        run("late physical hints read the current target", ShadowCacheProbeTest::lateHint);
        run("forced canary transition and handle reuse", ShadowCacheProbeTest::canary);
        run("callback during reconciliation", ShadowCacheProbeTest::reconcileRace);
        run("callback during enrichment", ShadowCacheProbeTest::enrichmentRace);
        run("coordinate bounds and physical backpressure", ShadowCacheProbeTest::bounds);
        run("combined pending limit across handles", ShadowCacheProbeTest::combinedLimit);
        run("rebind requires a populated canary", ShadowCacheProbeTest::canaryRefusal);
        run("retirement interrupts authority acquisition", ShadowCacheProbeTest::interrupted);
        run("between-poll cancellation ends authority acquisition", ShadowCacheProbeTest::betweenPollCancellation);
        run("retirement and structural reset", ShadowCacheProbeTest::reset);
        run("identity callback retires once per burst", ShadowCacheProbeTest::identityBurst);
        run("diagnostic fields do not change identity", ShadowCacheProbeTest::identityDiagnostics);
        run("stale witness reads refuse", ShadowCacheProbeTest::identityStaleRead);
        run("callback during witness read", ShadowCacheProbeTest::identityGuardRace);
        run("identity callback during membership", ShadowCacheProbeTest::identityMembershipRace);
        run("identity callback during enrichment", ShadowCacheProbeTest::identityEnrichmentRace);
        run("identity callback during authority", ShadowCacheProbeTest::identityAuthorityRace);
        run("trace overflow keeps identity latch", ShadowCacheProbeTest::identityTraceOverflow);
        run("no-chain cannot preserve logical identity", ShadowCacheProbeTest::identityNoChain);
        run("absent child properties are optional", ShadowCacheProbeTest::identityAbsentSources);
        run("identity source read errors refuse", ShadowCacheProbeTest::identityReadError);
        run("configured two-handle LRU acquisition", ShadowCacheProbeTest::poolLru);
        run("pool reservations cancel before publication", ShadowCacheProbeTest::poolCancellation);
        run("cache miss uses independent exact authority", ShadowCacheProbeTest::exactMiss);
        run("unhealthy and overflow cache use exact authority", ShadowCacheProbeTest::exactUnhealthy);
        run("exact authority shares and cancels its handle", ShadowCacheProbeTest::exactSharing);
        run("late exact authority windows refuse", ShadowCacheProbeTest::exactRace);
        run("published inventory detaches on domain changes", ShadowCacheProbeTest::inventoryRetirement);
        run("acquired exact output cancels without host reads", ShadowCacheProbeTest::exactRetainedCancellation);
        run("exact refusal is terminal and retains scope", ShadowCacheProbeTest::exactRefusalShape);
        run("comparison refuses expensive authority work", ShadowCacheProbeTest::comparisonBudget);
        for (String cause : List.of("metadata-mismatch", "membership-mismatch", "field-mismatch", "coverage-mismatch"))
            run("typed comparison accounting: " + cause, () -> comparisonMismatch(cause));
        run("explicit observer and ping measurements", ShadowCacheProbeTest::measurements);
        run("private inventory controls retain terminal cancellation", ShadowCacheProbeTest::inventoryControls);
        run("authority confirms a distinct control after a clip moves", ShadowCacheProbeTest::authorityMovedClip);
        run("missing authority controls refuse and diagnostic errors are nonfatal", ShadowCacheProbeTest::authorityControlFailure);
        System.out.println("Shadow cache adapter: " + passed + " test groups passed.");
    }

    private static void authorityControlFailure() throws Exception {
        Fixture f = new Fixture(); f.readyA(); f.rebind("A", 0);
        f.host.clips.remove("C:0");
        JsonObject refused = f.probe.compareStart(0);
        check(refused.get("terminal").getAsBoolean() && refused.get("reason").getAsString().equals("authority-control-unavailable")
            && field(f.probe, "scan") == null && !refused.has("authorityNotes"), "a missing control cannot leak an active comparison");
        f.rebind("A", 0, "B", 0);
        f.host.authority().failPositionRead = true;
        JsonObject pending = f.probe.compareStart(0);
        check(pending.getAsJsonObject("authorityBinding").get("status").getAsString().equals("unavailable"),
            "an unsupported diagnostic read remains an explicit observation");
        JsonObject result = pending;
        for (int attempt = 0; attempt < 80 && result.get("comparison").getAsString().equals("pending"); attempt++) {
            fastClock(f.probe); result = f.probe.comparePoll();
        }
        check(result.get("comparison").getAsString().equals("match"), "a diagnostic failure cannot replace binding or content guards");
    }

    private static void authorityMovedClip() throws Exception {
        Fixture f = new Fixture(); f.readyA(); Cursor reader = f.host.authority();
        ClipData moved = f.host.clips.remove("A:0"); moved.row = 1; f.host.clips.put("A:1", moved);
        reader.staleSceneIndex = 0;
        f.probe.invalidate("moved-clip-control"); f.rebind("A", 1);
        reader.holdClipPinRead = true;
        JsonObject result = f.probe.compareStart(0);
        for (int attempt = 0; attempt < 8; attempt++) { fastClock(f.probe); result = f.probe.comparePoll(); }
        JsonObject pending = result.getAsJsonObject("authorityBinding");
        check(pending.get("stage").getAsString().equals("canary") && !pending.get("clipPinned").getAsBoolean()
            && !pending.get("distinctControlConfirmed").getAsBoolean(), "a pin request cannot replace confirmed distinct binding");
        check(!pending.get("cacheMembershipUsed").getAsBoolean(), "the authority control does not use sparse membership");
        reader.holdClipPinRead = false;
        for (int attempt = 0; attempt < 80 && result.get("comparison").getAsString().equals("pending"); attempt++) {
            fastClock(f.probe); result = f.probe.comparePoll();
        }
        check(result.get("comparison").getAsString().equals("match") && result.get("authorityDistinctControlConfirmed").getAsBoolean(),
            "a distinct control releases the held scene index and the moved target matches");
        check(reader.staleSceneIndex == null && reader.target == moved && reader.clipPinned && reader.trackPinned,
            "final authority reads the moved clip with both pins confirmed");
        check(result.get("authorityBindingRevision").getAsString().equals("8g-authority-transition-v1"), "authority transition has its own revision");

        reader.holdClipPinRead = true; f.probe.compareStart(0);
        Object scan = field(f.probe, "scan"); setIfPresent(scan, "started", System.nanoTime() - 5_000_001_000L);
        JsonObject expired = f.probe.comparePoll();
        check(expired.get("reason").getAsString().equals("authority-binding-budget") && expired.get("terminal").getAsBoolean()
            && !expired.has("authorityNotes"), "the control cannot extend the existing five-second binding deadline");
        check(expired.has("authorityBinding"), "terminal binding refusal retains the physical diagnostics");
    }

    private static void inventoryControls() throws Exception {
        Fixture f = new Fixture(); final int[] reads = {0};
        ShadowInventoryRebuild coordinator = new ShadowInventoryRebuild(f.cache(), new ShadowInventoryRebuild.InventoryProvider() {
            public long cellCount() { return 3; }
            public boolean fullInventory() { return true; }
            public ShadowInventoryRebuild.Slot read(long index) {
                reads[0]++;
                return new ShadowInventoryRebuild.Slot(new Address("control-track", (int) index),
                    new Coverage(0, 1, true, java.util.Set.of(), java.util.Set.of(), "1/512-beat"));
            }
        }, () -> new ShadowInventoryRebuild.Guard(null, "stable", 0, false, true), 3);
        coordinator.start(); setIfPresent(f.probe, "inventoryRebuild", coordinator);
        JsonObject initial = f.probe.info();
        check(initial.get("inventoryControlRevision").getAsString().equals("8g-inventory-preparation-v1"), "inventory controls have a separate revision");
        check(reads[0] == 0 && !initial.get("registryPublished").getAsBoolean(), "prepared staging reads no slots and publishes no registry");
        Method controlled = ShadowCacheProbe.class.getDeclaredMethod("finishInventoryStep", Integer.class); controlled.setAccessible(true);
        JsonObject partial = (JsonObject) controlled.invoke(f.probe, 1);
        check(reads[0] == 1 && partial.getAsJsonObject("inventoryRebuild").get("enumeratedCells").getAsLong() == 1,
            "a selected poll exposes one private cell");
        check(!partial.get("registryPublished").getAsBoolean() && partial.get("inventoryClipEntries").getAsLong() == 0,
            "private present clips cannot become current registry entries");
        f.probe.cancelInventoryRebuild("partial-cancel-control");
        JsonObject terminal = (JsonObject) controlled.invoke(f.probe, 1);
        check(terminal.get("rebuildTerminal").getAsBoolean() && reads[0] == 1 && !terminal.get("registryPublished").getAsBoolean(),
            "terminal polling cannot read or silently retry");
        check(terminal.getAsJsonObject("inventoryRebuild").get("reason").getAsString().equals("partial-cancel-control"), "cancellation keeps its reason");
    }

    private static final String CHAIN = "tracks.0.devices.0.layers.0.channelId";
    private static final String CHAIN_EXISTS = "tracks.0.devices.0.layers.0.exists";

    private static IdentityFixture identityFixture() {
        Fixture f = new Fixture();
        IdentityHost h = new IdentityHost();
        RootIdentityProbe root = h.probe();
        check(root.identityGuard().witnessAvailable(), "existing chain supplies an optional witness: " + root.identityGuard());
        f.probe.attachIdentityProbe(root);
        return new IdentityFixture(f, h, root);
    }
    private record IdentityFixture(Fixture f, IdentityHost host, RootIdentityProbe root) {}

    private static void identityBurst() throws Exception {
        IdentityFixture i = identityFixture(); Fixture f = i.f; f.readyA();
        String oldRef = f.ref("A", 0); CallbackToken old = f.cache().bindingToken(oldRef);
        check(f.probe.info().get("requestedReplayMeasurementAvailable").getAsBoolean(), "settled current target has a replay measurement");
        long count = f.probe.info().get("automaticIdentityInvalidations").getAsLong();
        long reads = i.host.reads, epoch = i.root.identityEpoch();
        i.host.emit(CHAIN_EXISTS, false); i.host.emit(CHAIN_EXISTS, true);
        check(i.host.reads == reads, "callback invalidation does not read the host");
        check(i.root.identityEpoch() == epoch + 2, "A unknown A retains both delivered changes");
        check(f.probe.info().get("automaticIdentityInvalidations").getAsLong() == count + 1, "one retirement per unresolved burst");
        check(!f.cache().hasClip(oldRef) && !f.cache().callback(oldRef, old, CELL), "old refs and callbacks stay retired");
        check(!f.probe.info().get("requestedReplayMeasurementAvailable").getAsBoolean(), "root poison retires replay measurement availability");
        check(f.probe.info().get("optionalLifecycleWitnessSupported").getAsBoolean()
            && f.probe.info().get("lifecycleFallback").getAsString().equals("project-lifecycle-fence-unproved"),
            "optional witness support is distinct from the unproved complete fence");
        f.host.resident(0).emit(0, 60, 2); check(f.pending() == 0, "old physical hints do not enter retired cache");
        f.rebind("A", 0); check(f.compare().get("comparison").getAsString().equals("match"), "forced replay recovers diagnostics");
        check(!oldRef.equals(f.ref("A", 0)), "recovery mints a fresh logical identity");
        i.host.emit(CHAIN, "chain-next");
        check(f.probe.info().get("automaticIdentityInvalidations").getAsLong() == count + 2, "new work rearms the retirement latch");
    }

    private static void identityDiagnostics() throws Exception {
        IdentityFixture i = identityFixture(); Fixture f = i.f; f.readyA();
        String ref = f.ref("A", 0); long epoch = i.root.identityEpoch();
        i.host.emit("application.projectName", "saved-title");
        i.host.emit("application.hasActiveEngine", false);
        i.host.emit("application.canUndo", true); i.host.emit("application.canRedo", true);
        check(i.root.identityEpoch() == epoch && f.cache().hasClip(ref), "title engine and undo do not retire identity");
        check(f.probe.point(0, f.a, 0).get("recorderPreserved").getAsBoolean(), "stable optional witness preserves diagnostics");
        check(!f.compare().get("eligible").getAsBoolean(), "a witness does not prove input ordering");
    }

    private static void identityStaleRead() throws Exception {
        IdentityFixture i = identityFixture(); Fixture f = i.f; f.readyA();
        String ref = f.ref("A", 0); i.host.value(CHAIN).current = "undelivered-chain";
        JsonObject result = f.probe.compareStart(0);
        check(!result.get("authorityAvailable").getAsBoolean() && !f.cache().hasClip(ref), "undelivered fresh mismatch retires and refuses");
    }

    private static void identityGuardRace() throws Exception {
        IdentityFixture i = identityFixture(); Fixture f = i.f; f.readyA();
        long epoch = i.root.identityEpoch();
        i.host.value(CHAIN).readHook = () -> i.host.emit(CHAIN, "chain-during-read");
        RootIdentityProbe.IdentityGuard guard = i.root.identityGuard();
        check(!guard.coherent() && i.root.identityEpoch() > epoch, "read callback changes the captured interval");
        check(f.probe.status(0).get("phase").getAsString().equals("retired"), "guard race retires the binding synchronously");
    }

    private static void identityMembershipRace() throws Exception {
        IdentityFixture i = identityFixture(); Fixture f = i.f; f.readyA();
        Cursor c = f.host.resident(0); c.emit(0, 60, 2);
        c.readHook = () -> i.host.emit(CHAIN, "membership-change");
        JsonObject result = f.probe.reconcile(0);
        check(!result.get("authorityAvailable").getAsBoolean() && f.cache().diagnostics().resident() == 0,
            "membership read cannot publish through identity change");
    }

    private static void identityEnrichmentRace() throws Exception {
        IdentityFixture i = identityFixture(); Fixture f = i.f; f.readyA();
        f.host.resident(0).fieldHook = () -> i.host.emit(CHAIN, "enrichment-change");
        JsonObject result = f.compare();
        check(result.get("comparison").getAsString().equals("window-changed") && !result.has("diagnosticSnapshot"),
            "enrichment candidate is discarded after identity callback");
    }

    private static void identityAuthorityRace() throws Exception {
        IdentityFixture i = identityFixture(); Fixture f = i.f; f.readyA();
        f.host.authority().readHook = () -> i.host.emit(CHAIN, "authority-change");
        JsonObject result = f.compare();
        check(result.get("comparison").getAsString().equals("window-changed") && !result.has("authorityNotes"),
            "authority batch is discarded after identity callback");
        check(f.probe.status(0).get("phase").getAsString().equals("retired"), "authority race retires the resident");
    }

    private static void identityTraceOverflow() throws Exception {
        IdentityFixture i = identityFixture(); Fixture f = i.f; f.readyA();
        long epoch = i.root.identityEpoch(), count = f.probe.info().get("automaticIdentityInvalidations").getAsLong();
        for (int index = 0; index < 2200; index++) i.host.emit(CHAIN, "chain-" + index);
        check(i.root.identityEpoch() == epoch + 2200, "trace overflow does not lose the invalidation epoch");
        check(i.root.trace().get("traceDroppedTotal").getAsLong() > 0, "trace overflow is explicit");
        check(f.probe.info().get("automaticIdentityInvalidations").getAsLong() == count + 1, "trace capacity does not affect burst latch");
        i.root.clearTrace(); check(i.root.identityEpoch() == epoch + 2200, "trace clear does not clear the identity epoch");
    }

    private static void identityNoChain() throws Exception {
        Fixture f = new Fixture(); IdentityHost h = new IdentityHost(); h.value(CHAIN_EXISTS).current = false;
        RootIdentityProbe root = h.probe(); f.probe.attachIdentityProbe(root); f.readyA();
        String old = f.ref("A", 0);
        check(!root.identityGuard().witnessAvailable(), "empty witness window stays unknown");
        check(f.probe.point(0, f.a, 0).get("reason").getAsString().equals("identity-unverified-requires-forced-canary"),
            "no-chain cannot preserve the logical recorder through a new request");
        f.rebind("A", 0); check(!old.equals(f.ref("A", 0)), "forced no-chain replay starts a new local identity domain");
        check(!f.compare().get("eligible").getAsBoolean(), "content comparison stays ineligible without a witness");
    }

    private static void identityAbsentSources() {
        IdentityHost h = new IdentityHost();
        h.value("tracks.1.channelId").deliverInitial = false;
        h.value("tracks.0.devices.1.name").deliverInitial = false;
        h.value("tracks.0.devices.0.layers.1.channelId").deliverInitial = false;
        RootIdentityProbe root = h.probe();
        check(root.identityGuard().witnessAvailable(), "absent child observers do not block the existing candidate");
        IdentityHost active = new IdentityHost(); active.value(CHAIN).deliverInitial = false;
        check(!active.probe().identityGuard().coherent(), "an active candidate needs its delivered source value");
    }

    private static void identityReadError() throws Exception {
        IdentityFixture i = identityFixture(); Fixture f = i.f; f.readyA();
        i.host.value(CHAIN).readHook = () -> { throw new IllegalStateException("host read failed"); };
        JsonObject result = f.probe.point(0, f.a, 0);
        check(!result.get("authorityAvailable").getAsBoolean() && result.get("reason").getAsString().equals("identity-source-read-error"),
            "failed source read retires and refuses");
    }

    private static void poolLru() throws Exception {
        IdentityFixture i = identityFixture(); Fixture f = i.f;
        JsonObject a = f.probe.acquire(f.a, 0); int first = a.get("index").getAsInt();
        f.settle(first); check(f.compare(first).get("comparison").getAsString().equals("match"), "first pool target matches");
        JsonObject b = f.probe.acquire(f.b, 0); int second = b.get("index").getAsInt();
        f.settle(second); check(f.compare(second).get("comparison").getAsString().equals("match"), "second pool target matches");
        check(first != second, "two configured handles serve the first two targets");
        JsonObject c = f.probe.acquire(f.c, 0, f.b, 0);
        check(c.get("index").getAsInt() == first && c.getAsJsonObject("poolVictim").get("trackId").getAsString().equals("A"),
            "third target retires the least recently used target before binding");
        f.settle(first); check(f.compare(first).get("comparison").getAsString().equals("match"), "third target matches after canary replay");
        a = f.probe.acquire(f.a, 0, f.c, 0);
        check(a.get("index").getAsInt() == second && a.getAsJsonObject("poolVictim").get("trackId").getAsString().equals("B"),
            "A B C A uses two fixed handles and evicts the next oldest target");
        f.settle(second); check(f.compare(second).get("comparison").getAsString().equals("match"), "reacquired target matches");
        long commands = f.host.bindingCommands;
        check(f.probe.acquire(f.a, 0).get("recorderPreserved").getAsBoolean() && commands == f.host.bindingCommands,
            "stable warm acquire preserves the recorder and updates recency");
        check(f.host.stepObservers == 3, "LRU acquisition allocates no additional observers");
    }

    private static void poolCancellation() throws Exception {
        IdentityFixture i = identityFixture(); Fixture f = i.f;
        f.probe.acquire(f.a, 0);
        ShadowHandlePool pool = (ShadowHandlePool)field(f.probe, "handlePool");
        ShadowHandlePool.Reservation old = pool.entries().get(0).reservation();
        check(old != null && pool.find(new Address("A", 0)) < 0, "pending target is private");
        f.probe.retire(0);
        check(!pool.accept(old, true) && pool.entries().stream().noneMatch(ShadowHandlePool.Entry::reserved), "retirement cancels the reservation");
        f.probe.acquire(f.b, 0, f.c, 0);
        i.host.emit(CHAIN, "new-instance");
        check(pool.entries().stream().allMatch(entry -> entry.address() == null && !entry.reserved()), "identity poison clears all pool targets");
        check(f.probe.status(0).get("phase").getAsString().equals("retired"), "pending physical binding is retired too");
    }

    private static void exactMiss() throws Exception {
        IdentityFixture i = identityFixture(); Fixture f = i.f;
        check(f.ref("B", 0) == null, "target is absent from the cache registry");
        JsonObject result = f.exact(f.b, new Coverage(0, 1, true, java.util.Set.of("velocity"), java.util.Set.of(), "1/512-beat"));
        check(result.get("authorityAvailable").getAsBoolean() && result.get("fallbackPerformed").getAsBoolean(), "miss acquires independent authority");
        check(result.get("authorityNoteCount").getAsInt() == 1 && result.getAsJsonArray("authorityNotes").get(0).getAsJsonObject().get("channel").getAsInt() == 15,
            "full authority scan includes channel 15");
        check(result.getAsJsonObject("coverage").get("width").getAsInt() == 1
            && result.get("scannedCoordinates").getAsInt() == 128, "exact request coverage controls the scan");
        check(f.ref("B", 0) == null && f.cache().diagnostics().resident() == 0, "exact fallback does not admit residence or seed membership");
        check(!result.get("eligible").getAsBoolean() && !result.get("complete").getAsBoolean(), "independent diagnostic authority stays ineligible");
    }

    private static void exactUnhealthy() throws Exception {
        Fixture f = new Fixture(); f.readyA(); f.cache().requireRebuild("test unhealthy");
        check(f.exact(f.b, null).get("authorityAvailable").getAsBoolean(), "unhealthy model does not block explicit independent authority");
        f = new Fixture(); f.readyA(); Cursor resident = f.host.resident(0);
        for (int key = 0; key <= MAX_PENDING; key++) resident.emit(key / 128, key % 128, 2);
        f.probe.reconcile(0);
        check(f.probe.info().get("physicalHintOverflow").getAsBoolean(), "physical overflow is present before fallback");
        check(f.exact(f.b, null).get("authorityAvailable").getAsBoolean(), "overflow cache can use independent bounded authority");
        check(f.cache().diagnostics().resident() == 0, "fallback does not repair or admit the overflow cache");
    }

    private static void exactSharing() throws Exception {
        Fixture f = new Fixture(); f.readyA(); f.probe.compareStart(0);
        check(f.probe.exactStart(f.b, 0).get("reason").getAsString().equals("authority-busy"), "comparison owns the shared authority handle");
        f.probe.retire(0); f.probe.exactStart(f.b, 0);
        check(f.probe.exactCancel("test-cancel").get("phase").getAsString().equals("refused"), "explicit fallback cancellation is terminal");
        check(!f.probe.exactPoll().has("authorityNotes"), "cancelled fallback exposes no notes");
        check(f.exact(f.b, null).get("authorityAvailable").getAsBoolean(), "a new explicit request recovers");
        check(f.host.stepObservers == 3, "exact fallback uses the existing authority observer");
    }

    private static void exactRace() throws Exception {
        IdentityFixture i = identityFixture(); Fixture f = i.f;
        f.host.authority().readHook = () -> i.host.emit(CHAIN, "fallback-instance-change");
        JsonObject result = f.exact(f.b, null);
        check(!result.get("authorityAvailable").getAsBoolean() && !result.has("authorityNotes"), "root race discards the exact output");
        f = new Fixture(); result = f.exact(f.b, null); check(result.get("authorityAvailable").getAsBoolean(), "stable exact result precedes late callback");
        f.host.authority().emit(0, 60, 2); result = f.probe.exactPoll();
        check(!result.get("authorityAvailable").getAsBoolean() && !result.has("authorityNotes"), "late callback invalidates retained exact authority");
    }

    private static void inventoryRetirement() throws Exception {
        for (boolean automatic : new boolean[] {false, true}) {
            IdentityFixture i = identityFixture(); Fixture f = i.f;
            f.probe.point(0, f.a, 0);
            ShadowInventoryRebuild coordinator = new ShadowInventoryRebuild(f.cache(), new ShadowInventoryRebuild.InventoryProvider() {
                public long cellCount() { return 1; }
                public boolean fullInventory() { return true; }
                public ShadowInventoryRebuild.Slot read(long index) {
                    return new ShadowInventoryRebuild.Slot(new Address("old-project", 0), new Coverage(0, 1, true, java.util.Set.of(), java.util.Set.of(), "1/512-beat"));
                }
            }, () -> new ShadowInventoryRebuild.Guard(null, "stable", 0, false, true), 1);
            coordinator.start(); check(coordinator.step().registryPublished(), "regression starts with a published registry");
            setIfPresent(f.probe, "inventoryRebuild", coordinator); setIfPresent(f.probe, "inventoryEnumerated", true);
            if (automatic) {
                long reads = i.host.reads; i.host.emit(CHAIN, "new-project-chain");
                check(i.host.reads == reads, "root retirement detaches inventory without host reads");
            } else f.probe.lifecycle("switch");
            JsonObject info = f.probe.info();
            check(f.cache().diagnostics().entries() == 0 && !info.get("registryPublished").getAsBoolean()
                && !info.get("inventoryEnumerated").getAsBoolean(), "new domain cannot inherit the old registry flags");
            check(info.getAsJsonObject("lastRetiredInventoryRebuild").get("retired").getAsBoolean(), "retirement remains visible as history");
            Method finish = ShadowCacheProbe.class.getDeclaredMethod("finishInventoryStep"); finish.setAccessible(true); finish.invoke(f.probe);
            JsonObject polled = f.probe.info();
            check(!polled.get("inventoryEnumerated").getAsBoolean() && polled.get("inventoryClipEntries").getAsLong() == 0,
                "old terminal polling cannot resurrect inventory flags");
            check(polled.get("rebuildTerminal").getAsBoolean()
                && polled.getAsJsonObject("inventoryRebuild").get("phase").getAsString().equals("aborted")
                && polled.getAsJsonObject("inventoryRebuild").get("explicitRetryAvailable").getAsBoolean(),
                "retired polling ends with an explicit abort and permits an explicit new attempt");
            check(!coordinator.status().registryPublished(), "the detached helper also rejects its old core token");
        }
    }

    private static void exactRetainedCancellation() throws Exception {
        IdentityFixture i = identityFixture(); Fixture f = i.f;
        check(f.exact(f.b, null).get("authorityAvailable").getAsBoolean(), "independent authority is acquired before root change");
        long reads = i.host.reads; i.host.emit(CHAIN, "new-loaded-instance");
        check(i.host.reads == reads && !f.probe.exactPoll().has("authorityNotes"), "root callback discards retained output without proxy reads");
        f = new Fixture(); check(f.exact(f.b, null).get("authorityAvailable").getAsBoolean(), "authority is acquired before structural change");
        f.probe.invalidate("unknown-structure"); f.cache().resetInventoryForUnknownStructure("unknown-structure");
        check(!f.probe.exactPoll().get("authorityAvailable").getAsBoolean(), "unknown structure retires retained authority too");
    }

    private static void exactRefusalShape() throws Exception {
        Fixture f = new Fixture(); check(f.exact(f.b, null).get("authorityAvailable").getAsBoolean(), "old exact authority is acquired");
        Coverage unsupported = new Coverage(0, WIDTH + 1, true, java.util.Set.of("velocity"), java.util.Set.of(), "1/512-beat");
        JsonObject refused = f.probe.exactStart(f.a, 0, unsupported);
        check(refused.get("terminal").getAsBoolean() && refused.get("phase").getAsString().equals("refused")
            && refused.get("reason").getAsString().equals("authority-coverage-unavailable"), "scope refusal is terminal");
        check(refused.getAsJsonObject("address").get("trackId").getAsString().equals("A")
            && refused.getAsJsonObject("coverage").get("width").getAsInt() == WIDTH + 1, "refusal retains the new request scope");
        check(!f.probe.exactPoll().get("authorityAvailable").getAsBoolean() && !refused.has("authorityNotes"), "unsupported request retires the old acquired payload");
        f.probe.exactStart(f.b, 0); refused = f.probe.exactStart(f.a, 0);
        check(refused.get("terminal").getAsBoolean() && refused.get("reason").getAsString().equals("authority-busy"), "busy request itself refuses explicitly");
        check(((ShadowAuthorityFallback)field(f.probe, "exactFallback")).active(), "busy refusal preserves existing active work");
        f.probe.exactCancel("test cleanup"); f.probe.setTotalExperimentalStepDataObservers(513);
        refused = f.probe.exactStart(f.a, 0);
        check(refused.get("terminal").getAsBoolean() && refused.get("reason").getAsString().equals("combined-observer-budget"), "budget refusal is terminal");
        FakeHost host = new FakeHost(); host.clip("A", 0);
        RigConfig config = new RigConfig(); config.cacheShadowObservers = 0; config.cacheShadowSteps = WIDTH;
        refused = new ShadowCacheProbe(host.host(), config).exactStart(host.track("A"), 0);
        check(refused.get("terminal").getAsBoolean() && refused.get("phase").getAsString().equals("refused"), "missing authority refuses explicitly");
    }

    private static void comparisonBudget() throws Exception {
        Fixture f = new Fixture(); f.readyA();
        f.host.authority().readHook = () -> {
            long deadline = System.nanoTime() + 60_000_000L;
            while (System.nanoTime() < deadline) Thread.onSpinWait();
        };
        JsonObject result = f.compare();
        check(result.get("comparison").getAsString().equals("authority-host-work-budget")
            && result.get("reason").getAsString().equals("authority-host-work-budget") && result.get("terminal").getAsBoolean(),
            "one blocking authority read ends the comparison with a budget refusal");
        check(!result.get("authorityAvailable").getAsBoolean() && !result.has("diagnosticSnapshot") && !result.has("authorityNotes"),
            "over-budget output exposes no acquired authority or candidate");
        check(result.get("mismatches").getAsLong() == 0 && result.get("matches").getAsLong() == 1
            && result.get("windowChanges").getAsLong() == 0, "a budget refusal is neither a match, mismatch, nor changed window");
        check(result.getAsJsonObject("comparisonRefusalsByCause").get("authority-host-work-budget").getAsLong() == 1,
            "the refusal exposes its cause once");
        check(f.probe.comparePoll().getAsJsonObject("comparisonRefusalsByCause").get("authority-host-work-budget").getAsLong() == 1,
            "terminal polling cannot recount a refusal");
    }

    private static void comparisonMismatch(String cause) throws Exception {
        Fixture f = new Fixture();
        check(f.probe.acquire(f.a, 0).get("poolDecision").getAsString().equals("reserved"), "the fixture reserves pool residence");
        f.settle(); check(f.compare().get("comparison").getAsString().equals("match"), "the pooled target matches initially");
        String ref = f.ref("A", 0); Snapshot old = f.snapshot(f.compare());
        check(f.probe.info().get("matches").getAsLong() == 2 && f.probe.info().get("mismatches").getAsLong() == 0,
            "matching scans do not count as mismatches");
        Coverage original = (Coverage) field(f.probe, "coverage");
        if (cause.equals("membership-mismatch") || cause.equals("field-mismatch")) {
            f.host.authority().readHook = () -> {
                ClipData independent = new ClipData("A", 0);
                independent.notes.put(new Cell(0, 0, 60), fields(cause.equals("field-mismatch") ? .75 : .25));
                if (cause.equals("membership-mismatch")) independent.notes.put(new Cell(15, 1, 61), fields(.5));
                f.host.authority().target = independent;
            };
        } else f.host.resident(0).fieldHook = () -> {
            if (cause.equals("metadata-mismatch")) f.host.authority().nameOverride = "different-name";
            else {
                // Change the comparison request after snapshot capture to exercise coverage failure.
                try { setIfPresent(f.probe, "coverage", new Coverage(0, WIDTH - 1, true, original.fields(), original.unsupportedFields(), original.timingBasis())); }
                catch (IllegalAccessException error) { throw new AssertionError(error); }
            }
        };
        JsonObject failed = f.compare();
        check(failed.get("comparison").getAsString().equals(cause), "the independent fixture supplies " + cause + ": " + failed);
        check(failed.get("mismatches").getAsLong() == 1 && failed.get("matches").getAsLong() == 2
            && failed.get("windowChanges").getAsLong() == 0, "one failed scan counts one mismatch only");
        check(failed.getAsJsonObject("mismatchesByCause").size() == 1
            && failed.getAsJsonObject("mismatchesByCause").get(cause).getAsLong() == 1, "diagnostics retain the exact cause");
        check(!failed.has("diagnosticSnapshot") && !failed.get("complete").getAsBoolean() && !failed.get("eligible").getAsBoolean(),
            "a mismatch exposes no current cached snapshot or open gate");
        check(f.cache().diagnostics().resident() == 0 && !f.cache().isCurrent(old)
            && f.probe.status(0).get("phase").getAsString().equals("retired") && !f.probe.status(0).has("historicalSnapshot"),
            "a mismatch retires residence and retained adapter output");
        check(((ShadowHandlePool) field(f.probe, "handlePool")).find(new Address("A", 0)) == -1,
            "a mismatch releases the physical pool entry");
        for (int poll = 0; poll < 2; poll++) check(f.probe.comparePoll().get("mismatches").getAsLong() == 1,
            "terminal polling cannot recount a mismatch");
        f.host.authority().nameOverride = null; setIfPresent(f.probe, "coverage", original);
        f.rebind("A", 0);
        check(f.compare().get("comparison").getAsString().equals("match"), "explicit recovery matches");
        check(f.probe.info().get("mismatches").getAsLong() == 1
            && f.probe.info().getAsJsonObject("mismatchesByCause").get(cause).getAsLong() == 1,
            "later success cannot erase the failure");
    }

    private static void measurements() throws Exception {
        Fixture f = new Fixture();
        check(!f.probe.info().get("requestedReplayMeasurementAvailable").getAsBoolean()
            && !f.probe.info().get("optionalLifecycleWitnessSupported").getAsBoolean(), "unbound probe has no replay measurement or optional witness");
        check(!f.probe.info().get("pingMeasurementAvailable").getAsBoolean(), "zero default is not a ping measurement");
        f.probe.ping(0); check(f.probe.info().get("pingMeasurementAvailable").getAsBoolean(), "explicit finite zero ping is a measurement");
        try { f.probe.ping(Double.NaN); throw new AssertionError("NaN accepted"); } catch (IllegalArgumentException expected) { }
        check(!f.probe.info().get("pingMeasurementAvailable").getAsBoolean(), "invalid ping clears measurement availability");
        check(!f.probe.info().get("cacheBudgetMeasurementsComplete").getAsBoolean(), "invalid ping keeps budget measurements incomplete");
        f.probe.ping(0);
        f.readyA();
        check(f.probe.info().get("cacheBudgetMeasurementsComplete").getAsBoolean(), "explicit ping and current replay complete the measurements");
        f.probe.retire(0);
        check(!f.probe.info().get("requestedReplayMeasurementAvailable").getAsBoolean(), "all retired views have no current replay measurement");
        f.probe.point(0, f.b, 0, f.c, 0);
        check(!f.probe.info().get("requestedReplayMeasurementAvailable").getAsBoolean(), "new binding cannot reuse historical replay timing");
        f.probe.setTotalExperimentalStepDataObservers(513);
        check(f.probe.point(0, f.a, 0).get("reason").getAsString().equals("combined-observer-budget"), "combined observer limit rejects admission");
        check(f.probe.info().get("shadowStepDataObservers").getAsInt() == 3, "combined total does not alter legacy shadow count");
    }

    /** A fixed source graph permits callbacks and reads to be changed independently. */
    private static final class IdentityHost {
        final Map<String, IdentityValue> values = new HashMap<>(); long reads;
        IdentityHost() {
            value("project.exists").current = true; value("root.exists").current = true;
            value("root.channelId").current = "root-id"; value("master.channelId").current = "root-id";
            value("application.projectName").current = "title"; value("application.hasActiveEngine").current = true;
            value("tracks.itemCount").current = 1;
            value("tracks.0.exists").current = true; value("tracks.0.channelId").current = "A";
            value("tracks.0.name").current = "track"; value("tracks.0.devices.itemCount").current = 1;
            value("tracks.0.devices.0.exists").current = true; value("tracks.0.devices.0.name").current = "Layer";
            value("tracks.0.devices.0.hasLayers").current = true; value("tracks.0.devices.0.layers.itemCount").current = 1;
            value(CHAIN_EXISTS).current = true; value(CHAIN).current = "chain-A";
            value("tracks.0.devices.0.layers.0.name").current = "layer";
            value("tracks.0.devices.0.layers.0.devices.itemCount").current = 1;
        }
        IdentityValue value(String path) { return values.computeIfAbsent(path, key -> new IdentityValue()); }
        void emit(String path, Object next) { IdentityValue v = value(path); v.current = next; v.notifyObserver(); }
        RootIdentityProbe probe() {
            return new RootIdentityProbe(node(ControllerHost.class, "host"), "init-identity-test", node(Project.class, "project"), node(Application.class, "application"));
        }
        <T> T node(Class<T> type, String path) {
            return proxy(type, (object, method, args) -> {
                String name = method.getName(); Class<?> result = method.getReturnType();
                if (name.equals("createMasterTrack")) return node(result, "master");
                if (name.equals("createMainTrackBank")) return node(result, "tracks");
                if (name.equals("getRootTrackGroup")) return node(result, "root");
                if (name.equals("getItemAt")) {
                    Class<?> item = path.equals("tracks") ? Track.class : path.endsWith(".layers")
                        ? com.bitwig.extension.controller.api.DeviceLayer.class : com.bitwig.extension.controller.api.Device.class;
                    return node(item, path + "." + args[0]);
                }
                if (name.equals("createDeviceBank")) return node(result, path + ".devices");
                if (name.equals("createLayerBank")) return node(result, path + ".layers");
                if (BooleanValue.class.isAssignableFrom(result) || IntegerValue.class.isAssignableFrom(result) || StringValue.class.isAssignableFrom(result)) {
                    IdentityValue v = value(path + "." + name);
                    if (v.current == null) v.current = BooleanValue.class.isAssignableFrom(result) ? false : IntegerValue.class.isAssignableFrom(result) ? 0 : "";
                    return proxy(result, (ignored, operation, arguments) -> {
                        if (operation.getName().equals("get")) {
                            reads++; if (v.readHook != null) { Runnable hook = v.readHook; v.readHook = null; hook.run(); }
                            return v.current;
                        }
                        if (operation.getName().equals("addValueObserver")) { v.observer = arguments[arguments.length - 1]; if (v.deliverInitial) v.notifyObserver(); }
                        return zero(operation.getReturnType());
                    });
                }
                return zero(result);
            });
        }
    }
    private static final class IdentityValue {
        Object current, observer; Runnable readHook; boolean deliverInitial = true;
        void notifyObserver() {
            if (observer instanceof BooleanValueChangedCallback b) b.valueChanged((boolean)current);
            else if (observer instanceof IntegerValueChangedCallback i) i.valueChanged((int)current);
            else if (observer instanceof StringValueChangedCallback s) s.valueChanged((String)current);
        }
    }

    private static void family() {
        Fixture f = new Fixture();
        check(f.host.stepObservers == 3 && f.host.noteObservers == 0, "shadow uses only step-data observers");
        FakeHost host = new FakeHost();
        new ObserverReuseProbe(host.host(), f.config);
        check(host.stepObservers == 2 && host.noteObservers == 0, "reuse research uses the selected callback family");
    }

    private static void sameTarget() throws Exception {
        Fixture f = new Fixture();
        f.readyA();
        String ref = f.ref("A", 0);
        long commands = f.host.bindingCommands;
        long binding = f.cache().bindingToken(ref).binding();
        JsonObject status = f.probe.point(0, f.a, 0);
        check(status.get("recorderPreserved").getAsBoolean(), "same-target request preserves the recorder");
        check(f.host.bindingCommands == commands, "same-target read issues no bind command");
        check(f.cache().occupiedCoordinates(ref) == 1 && f.cache().bindingToken(ref).binding() == binding,
            "membership and binding token survive the read");
        check(f.compare().get("comparison").getAsString().equals("match"), "preserved recorder matches authority");
    }

    private static void lateHint() throws Exception {
        Fixture f = new Fixture();
        f.readyA();
        f.rebind("B", 0);
        f.compare();
        Cursor resident = f.host.resident(0);
        resident.emit(0, 60, 0);
        resident.emit(4, 70, 2);
        String ref = f.ref("B", 0);
        f.probe.reconcile(0);
        check(f.cache().occupiedCoordinates(ref) == 1, "old empty state cannot remove the current channel");
        JsonObject result = f.compare();
        Snapshot snapshot = f.snapshot(result);
        check(snapshot.notes().size() == 1 && snapshot.notes().get(0).channel() == 15,
            "current target supplies the note channel");
        check(snapshot.notes().get(0).fields().get("velocity").equals(.875), "old payload cannot supply current fields");
        check(resident.reads.stream().anyMatch(read -> read.equals("B:0:15:0:60")), "hints re-read current target");
        check(!result.get("eligible").getAsBoolean(), "source-neutral hints do not establish eligibility");
    }

    private static void canary() throws Exception {
        Fixture f = new Fixture();
        f.readyA();
        Cursor resident = f.host.resident(0);
        f.probe.retire(0);
        int before = resident.transitions.size();
        f.rebind("B", 0);
        List<String> changes = resident.transitions.subList(before, resident.transitions.size());
        check(changes.indexOf("C:0") >= 0 && changes.lastIndexOf("B:0") > changes.indexOf("C:0"),
            "reset passes through a distinct canary before target");
        check(f.compare().get("comparison").getAsString().equals("match"), "reused target matches authority");
        check(f.host.stepObservers == 3, "reuse does not register another observer");
        f.probe.retire(0);
        f.rebind("C", 0, "A", 0);
        f.compare();
        before = resident.transitions.size();
        f.rebind("B", 0);
        changes = resident.transitions.subList(before, resident.transitions.size());
        check(changes.indexOf("B:0") >= 0 && changes.indexOf("C:0") > changes.indexOf("B:0")
            && changes.lastIndexOf("B:0") > changes.indexOf("C:0"),
            "current canary escapes before canary replay and final target");
        check(f.compare().get("comparison").getAsString().equals("match"), "escape path returns exact target");
    }

    private static void reconcileRace() throws Exception {
        Fixture f = new Fixture();
        f.readyA();
        Cursor resident = f.host.resident(0);
        resident.emit(0, 60, 2);
        resident.readHook = () -> resident.emit(0, 60, 2);
        f.probe.reconcile(0);
        check(f.pending() > 0, "callback during reads stays pending");
        JsonObject refused = f.probe.compareStart(0);
        check(!refused.get("complete").getAsBoolean(), "pending physical work cannot produce complete output");
        f.probe.reconcile(0);
        check(f.pending() == 0, "next drain consumes the stable ticket");
        check(f.compare().get("comparison").getAsString().equals("match"), "stable retry matches authority");
    }

    private static void enrichmentRace() throws Exception {
        Fixture f = new Fixture();
        f.readyA();
        Cursor resident = f.host.resident(0);
        resident.fieldHook = () -> resident.emit(0, 60, 2);
        JsonObject result = f.compare();
        check(result.get("comparison").getAsString().equals("window-changed"), "enrichment callback discards the comparison");
        check(!result.has("diagnosticSnapshot") && !result.get("authorityAvailable").getAsBoolean(),
            "changed window does not expose the discarded authority or candidate");
        check(f.pending() > 0, "enrichment callback remains queued");
        f.probe.reconcile(0);
        check(f.compare().get("comparison").getAsString().equals("match"), "enrichment retry matches authority");
    }

    private static void bounds() throws Exception {
        Fixture f = new Fixture();
        f.readyA();
        Cursor resident = f.host.resident(0);
        resident.emit(-1, 60, 2);
        resident.emit(WIDTH, 60, 2);
        resident.emit(0, -1, 2);
        resident.emit(0, 128, 2);
        check(f.pending() == 0, "coordinates outside coverage never enter pending work");
        for (int key = 0; key <= MAX_PENDING; key++) resident.emit(key / 128, key % 128, 2);
        JsonObject status = f.probe.status(0);
        check(status.get("physicalHintOverflow").getAsBoolean(), "physical hint overflow is explicit");
        check(f.pending() <= MAX_PENDING, "physical storage stays bounded");
        check(!f.probe.compareStart(0).get("complete").getAsBoolean(), "overflow never publishes complete output");
    }

    private static void reset() throws Exception {
        Fixture f = new Fixture();
        f.readyA();
        String oldRef = f.ref("A", 0);
        CallbackToken oldToken = f.cache().bindingToken(oldRef);
        long oldPhysicalRevision = f.probe.status(0).get("physicalBindingRevision").getAsLong();
        f.probe.retire(0);
        f.host.resident(0).emit(0, 60, 2);
        check(f.cache().diagnostics().pendingCoordinates() == 0, "retired hints cannot enter the domain queue");
        check(f.probe.status(0).get("physicalBindingRevision").getAsLong() > oldPhysicalRevision,
            "retirement advances the physical revision");
        f.rebind("A", 0);
        f.compare();
        check(!f.cache().callback(oldRef, oldToken, CELL), "old captured domain token stays rejected");
        f.cache().repairScene(0, true);
        f.host.shiftRows(0);
        f.rebind("A", 1, "C", 1);
        check(f.ref("A", 1).equals(oldRef), "known scene repair retains logical identity");
        check(f.compare().get("comparison").getAsString().equals("match"), "repaired address matches authority");
        f.cache().resetInventoryForUnknownStructure("test unknown structure");
        f.probe.retire(0);
        f.rebind("B", 1, "C", 1);
        check(!f.ref("B", 1).equals(oldRef), "unknown structure starts a new identity domain");
        check(f.compare().get("comparison").getAsString().equals("match"), "bounded handle survives domain reset");
    }

    private static void combinedLimit() throws Exception {
        Fixture f = new Fixture();
        f.readyA();
        f.probe.point(1, f.b, 0);
        f.settle(1);
        check(f.compare(1).get("comparison").getAsString().equals("match"), "second handle warms independently");
        String refA = f.ref("A", 0), refB = f.ref("B", 0);
        f.cache().callback(refA, f.cache().bindingToken(refA), CELL);
        for (int key = 0; key < 1024; key++) f.host.resident(0).emit(key / 128, key % 128, 2);
        for (int key = 0; key < 1023; key++) f.host.resident(1).emit(key / 128, key % 128, 2);
        JsonObject status = f.probe.status(0);
        check(status.get("pendingWorkItemsIncludingPhysicalHints").getAsLong() == MAX_PENDING
            && !status.get("physicalHintOverflow").getAsBoolean(), "physical and domain work share one inclusive limit");
        f.host.resident(1).emit(7, 127, 2);
        status = f.probe.reconcile(0);
        check(status.get("physicalHintOverflow").getAsBoolean(), "the next distinct ticket exceeds the combined limit");
        check(f.cache().bindingToken(refA) == null && f.cache().bindingToken(refB) == null,
            "backpressure retires every resident domain token");
        check(f.probe.point(0, f.a, 0, f.c, 0).get("reason").getAsString().contains("rebuild-required"),
            "overflow recovery cannot bypass rebuild");
    }

    private static void canaryRefusal() throws Exception {
        Fixture f = new Fixture();
        f.readyA();
        long commands = f.host.bindingCommands;
        JsonObject refused = f.probe.point(0, f.b, 0);
        check(refused.get("reason").getAsString().equals("populated-canary-required-for-rebind")
            && f.host.bindingCommands == commands, "different-target request cannot discard the recorder without canary");
        f.host.clip("empty", 0);
        f.probe.point(0, f.b, 0, f.host.track("empty"), 0);
        JsonObject result = null;
        for (int attempt = 0; attempt < 20; attempt++) {
            fastClock(f.probe);
            result = f.probe.poll(0);
            if (result.get("phase").getAsString().equals("retired")) break;
        }
        check(result != null && result.get("reason").getAsString().equals("populated-canary-replay-unavailable"),
            "empty canary never establishes replay");
        check(!result.get("complete").getAsBoolean() && !result.get("eligible").getAsBoolean(),
            "failed canary remains ineligible");
    }

    private static void interrupted() throws Exception {
        Fixture f = new Fixture();
        f.readyA();
        f.host.authority().readHook = () -> f.probe.retire(0);
        JsonObject result = f.compare();
        check(result.get("comparison").getAsString().equals("window-changed") && !result.has("diagnosticSnapshot"),
            "retirement discards the in-progress authority window");
        f.rebind("A", 0);
        check(f.compare().get("comparison").getAsString().equals("match"), "interrupted handle recovers through canary");
    }

    private static void betweenPollCancellation() throws Exception {
        for (String action : List.of("retire", "rebind", "invalidate", "lifecycle")) {
            Fixture f = new Fixture();
            f.readyA();
            check(f.probe.compareStart(0).get("comparison").getAsString().equals("pending"),
                "authority acquisition starts before cancellation");
            long changes = f.probe.info().get("windowChanges").getAsLong();
            switch (action) {
                case "retire" -> f.probe.retire(0);
                case "rebind" -> f.probe.point(0, f.b, 0, f.c, 0);
                case "invalidate" -> f.probe.invalidate("test structural invalidation");
                case "lifecycle" -> f.probe.lifecycle("switch");
                default -> throw new AssertionError(action);
            }
            for (int poll = 0; poll < 2; poll++) {
                JsonObject result = f.probe.comparePoll();
                check(result.get("comparison").getAsString().equals("window-changed"),
                    action + " ends the pending comparison between polls");
                check(!result.get("complete").getAsBoolean() && !result.get("authorityAvailable").getAsBoolean()
                    && !result.has("diagnosticSnapshot") && !result.has("authorityNotes"),
                    "cancelled acquisition exposes no current result");
                check(result.get("windowChanges").getAsLong() == changes + 1,
                    "one cancellation counts one discarded window");
                check(result.get("mismatches").getAsLong() == 0 && result.get("matches").getAsLong() == 1
                    && result.getAsJsonObject("mismatchesByCause").size() == 0
                    && result.getAsJsonObject("comparisonRefusalsByCause").size() == 0,
                    "a changed window has separate accounting from mismatches and refusals");
            }
            f.rebind("A", 0);
            check(f.compare().get("comparison").getAsString().equals("match"),
                action + " recovers through a fresh canary transition");
        }
    }

    private static final class Fixture {
        final FakeHost host = new FakeHost();
        final RigConfig config = new RigConfig();
        final Track a, b, c;
        final ShadowCacheProbe probe;

        Fixture() {
            host.clip("A", 0).notes.put(new Cell(0, 0, 60), fields(.25));
            host.clip("B", 0).notes.put(new Cell(15, 0, 60), fields(.875));
            host.clip("C", 0).notes.put(new Cell(5, 2, 72), fields(.5));
            a = host.track("A"); b = host.track("B"); c = host.track("C");
            config.cacheShadowObservers = 2; config.cacheShadowSteps = WIDTH; config.scenes = 8;
            probe = new ShadowCacheProbe(host.host(), config);
            cache().inventoryEnumerated();
        }

        ShadowProjectCache cache() { return (ShadowProjectCache)field(probe, "cache"); }
        String ref(String track, int row) { return cache().clipAt(new Address(track, row)); }
        long pending() { return probe.status(0).get("physicalPendingHints").getAsLong(); }

        void readyA() throws Exception {
            probe.point(0, a, 0);
            settle();
            check(compare().get("comparison").getAsString().equals("match"), "initial populated target matches");
        }

        void rebind(String track, int row) throws Exception { rebind(track, row, "C", 0); }
        void rebind(String track, int row, String canaryTrack, int canaryRow) throws Exception {
            probe.point(0, host.track(track), row, host.track(canaryTrack), canaryRow);
            settle();
        }

        void settle() throws Exception { settle(0); }
        void settle(int index) throws Exception {
            for (int attempt = 0; attempt < 60; attempt++) {
                fastClock(probe);
                JsonObject status = probe.poll(index);
                String phase = status.get("phase").getAsString();
                if (phase.equals("settled") || phase.equals("complete")) { probe.reconcile(index); return; }
                check(!phase.equals("retired"), "binding remains live: " + status);
            }
            throw new AssertionError("binding did not settle");
        }

        JsonObject compare() throws Exception { return compare(0); }
        JsonObject compare(int index) throws Exception {
            JsonObject result = probe.compareStart(index);
            for (int attempt = 0; attempt < 80 && result.get("comparison").getAsString().equals("pending"); attempt++) {
                fastClock(probe);
                result = probe.comparePoll();
            }
            check(!result.get("comparison").getAsString().equals("pending"), "comparison terminates");
            return result;
        }

        JsonObject exact(Track target, Coverage request) throws Exception {
            JsonObject result = request == null ? probe.exactStart(target, 0) : probe.exactStart(target, 0, request);
            for (int attempt = 0; attempt < 120 && (!result.has("terminal") || !result.get("terminal").getAsBoolean()); attempt++) {
                fastClock(probe);
                Object exact = field(probe, "exactFallback"); long now = System.nanoTime();
                if ((long)field(exact, "boundAt") != 0) {
                    setIfPresent(exact, "boundAt", now - 1_600_000_000L);
                    setIfPresent(exact, "pollAt", now - 60_000_000L);
                    setIfPresent(exact, "quietPolls", 10);
                }
                result = probe.exactPoll();
            }
            check(result.has("terminal") && result.get("terminal").getAsBoolean(), "explicit authority request terminates: " + result);
            return result;
        }

        Snapshot snapshot(JsonObject result) {
            check(result.has("diagnosticSnapshot"), "comparison includes a diagnostic snapshot");
            Object view = ((Object[])field(probe, "views"))[0];
            return ((Result)field(view, "lastResult")).snapshot();
        }
    }

    private record Cell(int channel, int x, int y) {}
    private static final class ClipData {
        String track, name;
        int row;
        final Map<Cell, Map<String, Object>> notes = new LinkedHashMap<>();
        ClipData(String track, int row) { this.track = track; this.row = row; name = track + "-" + row; }
    }
    private static Map<String, Object> fields(double velocity) {
        return Map.of("velocity", velocity, "duration", 2 * GRID, "chance", .375,
            "isChanceEnabled", false, "timbre", -.5, "gain", 1.25);
    }

    private static final class FakeHost {
        final Map<String, ClipData> clips = new HashMap<>();
        final Map<String, Integer> selectedRows = new HashMap<>();
        final List<Cursor> cursors = new ArrayList<>();
        int stepObservers, noteObservers;
        long bindingCommands;

        ClipData clip(String track, int row) {
            return clips.computeIfAbsent(track + ":" + row, key -> new ClipData(track, row));
        }
        Track track(String id) { return proxy(Track.class, new Cursor(this, id, false), "track", false); }
        Cursor resident(int index) { return cursors.stream().filter(c -> c.id.contains("RESIDENT")).toList().get(index); }
        Cursor authority() { return cursors.stream().filter(c -> c.id.contains("AUTHORITY")).findFirst().orElseThrow(); }
        ControllerHost host() {
            return proxy(ControllerHost.class, (object, method, args) -> {
                if (method.getName().equals("createCursorTrack")) {
                    Cursor cursor = new Cursor(this, (String)args[0], true);
                    cursors.add(cursor);
                    return proxy(CursorTrack.class, cursor, "track", false);
                }
                return zero(method.getReturnType());
            });
        }
        void select(String track, int row) {
            bindingCommands++;
            selectedRows.put(track, row);
            for (Cursor cursor : cursors) {
                if (track.equals(cursor.track) && !cursor.clipPinned) cursor.bind(clips.get(track + ":" + row));
            }
        }
        void shiftRows(int at) {
            List<ClipData> values = new ArrayList<>(clips.values()); clips.clear();
            for (ClipData data : values) { if (data.row >= at) data.row++; clips.put(data.track + ":" + data.row, data); }
        }
    }

    private static final class Cursor {
        final FakeHost host;
        final String id;
        String track;
        String nameOverride;
        boolean trackPinned, clipPinned, subscribed = true;
        int width;
        ClipData target;
        Integer staleSceneIndex;
        boolean holdClipPinRead;
        boolean failPositionRead;
        StepDataChangedCallback callback;
        Runnable readHook, fieldHook;
        final List<String> transitions = new ArrayList<>(), reads = new ArrayList<>();
        Cursor(FakeHost host, String id, boolean cursor) { this.host = host; this.id = id; track = cursor ? "" : id; }

        void emit(int x, int y, int state) { if (callback != null) callback.stepStateChanged(x, y, state); }
        void bind(ClipData next) {
            if (next == target) return;
            staleSceneIndex = null;
            ClipData old = target;
            target = next;
            if (next != null) transitions.add(next.track + ":" + next.row);
            if (old != null) old.notes.keySet().forEach(cell -> emit(cell.x, cell.y, 0));
            if (next != null) next.notes.keySet().forEach(cell -> emit(cell.x, cell.y, 2));
        }

        Object call(Object object, Method method, Object[] args, String property, boolean clip) {
            String name = method.getName();
            if (name.equals("toString")) return id + ":" + property;
            if (name.equals("hashCode")) return System.identityHashCode(object);
            if (name.equals("equals")) return object == args[0];
            if (name.equals("createLauncherCursorClip")) {
                width = (Integer)args[args.length - 2];
                return proxy(method.getReturnType(), this, "clip", true);
            }
            if (name.equals("addStepDataObserver")) { callback = (StepDataChangedCallback)args[0]; host.stepObservers++; return null; }
            if (name.equals("addNoteStepObserver")) { host.noteObservers++; return null; }
            if (name.equals("selectChannel")) {
                host.bindingCommands++;
                track = ((Track)args[0]).channelId().get();
                if (!clipPinned) bind(host.clips.get(track + ":" + host.selectedRows.getOrDefault(track, 0)));
                return null;
            }
            if (name.equals("selectSlot")) { host.select(track, (Integer)args[0]); return null; }
            if (name.equals("getItemAt") && property.equals("clipLauncherSlotBank")) {
                int row = (Integer)args[0];
                return proxy(ClipLauncherSlot.class, (o, m, a) -> {
                    if (m.getName().equals("hasContent")) return proxy(m.getReturnType(), (v, gm, ga) -> gm.getName().equals("get") ? host.clips.containsKey(track + ":" + row) : zero(gm.getReturnType()));
                    return zero(m.getReturnType());
                });
            }
            if (name.equals("isSubscribed")) return subscribed;
            if (name.equals("subscribe")) { subscribed = true; return null; }
            if (name.equals("unsubscribe")) { subscribed = false; return null; }
            if (name.equals("getStep")) {
                if (readHook != null) { Runnable hook = readHook; readHook = null; hook.run(); }
                int channel = (Integer)args[0], x = (Integer)args[1], y = (Integer)args[2];
                reads.add((target == null ? "none" : target.track + ":" + target.row) + ":" + channel + ":" + x + ":" + y);
                Map<String, Object> values = target == null ? null : target.notes.get(new Cell(channel, x, y));
                return proxy(NoteStep.class, (o, m, a) -> {
                    if (m.getName().equals("state")) return values == null ? NoteStep.State.Empty : NoteStep.State.NoteOn;
                    if (m.getName().equals("x")) return x;
                    if (m.getName().equals("y")) return y;
                    if (m.getName().equals("channel")) return channel;
                    if (values != null && m.getName().equals("velocity") && fieldHook != null) {
                        Runnable hook = fieldHook; fieldHook = null; hook.run();
                    }
                    if (m.getName().equals("occurrence")) return NoteOccurrence.ALWAYS;
                    if (values != null && values.containsKey(m.getName())) return values.get(m.getName());
                    return zero(m.getReturnType());
                });
            }
            if (name.equals("set") && property.equals("isPinned")) {
                host.bindingCommands++;
                if (clip) clipPinned = (Boolean)args[0]; else trackPinned = (Boolean)args[0];
                return null;
            }
            if (name.equals("get")) {
                if (property.equals("position") && failPositionRead) throw new IllegalStateException("diagnostic unavailable");
                return switch (property) {
                    case "exists" -> clip ? target != null : !track.isEmpty();
                    case "channelId" -> track;
                    case "sceneIndex" -> staleSceneIndex != null ? staleSceneIndex : target == null ? -1 : target.row;
                    case "name" -> nameOverride != null ? nameOverride : target == null ? "" : target.name;
                    case "isPinned" -> clip ? clipPinned && !holdClipPinRead : trackPinned;
                    case "getPlayStop", "getLoopLength" -> 4.0;
                    default -> zero(method.getReturnType());
                };
            }
            if (method.getReturnType().isInterface()) return proxy(method.getReturnType(), this, name, clip);
            return zero(method.getReturnType());
        }
    }

    private static <T> T proxy(Class<T> type, Cursor cursor, String property, boolean clip) {
        return proxy(type, (object, method, args) -> cursor.call(object, method, args, property, clip));
    }
    private static <T> T proxy(Class<T> type, InvocationHandler handler) {
        return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] {type}, handler));
    }
    private static Object zero(Class<?> type) {
        if (type == boolean.class) return false;
        if (type == int.class) return 0;
        if (type == long.class) return 0L;
        if (type == float.class) return 0f;
        if (type == double.class) return 0d;
        return null;
    }
    private static Object field(Object object, String name) {
        try { Field field = object.getClass().getDeclaredField(name); field.setAccessible(true); return field.get(object); }
        catch (ReflectiveOperationException error) { throw new AssertionError(error); }
    }
    private static void setIfPresent(Object object, String name, Object value) throws IllegalAccessException {
        try { Field field = object.getClass().getDeclaredField(name); field.setAccessible(true); field.set(object, value); }
        catch (NoSuchFieldException ignored) { }
    }
    private static void fastClock(ShadowCacheProbe probe) throws Exception {
        long now = System.nanoTime();
        List<Object> views = new ArrayList<>(List.of((Object[])field(probe, "views")));
        views.add(field(probe, "authority"));
        for (Object view : views) {
            setIfPresent(view, "started", now - 1_600_000_000L);
            setIfPresent(view, "bindingStarted", now - 1_600_000_000L);
            setIfPresent(view, "lastPoll", now - 60_000_000L);
            setIfPresent(view, "unchanged", 10);
            setIfPresent(view, "lastCallbacks", field(view, "callbacks"));
        }
        Object scan = field(probe, "scan");
        if (scan != null && (long)field(scan, "authorityBoundAt") != 0)
            setIfPresent(scan, "authorityBoundAt", now - 1_600_000_000L);
    }
    @FunctionalInterface private interface Test { void run() throws Exception; }
    private static void run(String name, Test test) throws Exception {
        try { test.run(); passed++; }
        catch (Throwable error) { throw new AssertionError(name, error); }
    }
    private static void check(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
}
