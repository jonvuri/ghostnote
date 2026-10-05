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
        run("public adapter refuses an absent input window", ShadowCacheProbeTest::continuityUnavailable);
        run("unseen equal-endpoint detour refuses by construction", ShadowCacheProbeTest::continuityUnseen);
        run("independent model revision fences an unseen detour", ShadowCacheProbeTest::continuityRevision);
        run("independent revision changes during guard construction", ShadowCacheProbeTest::continuityConstruction);
        run("silent model changes during target settlement", ShadowCacheProbeTest::continuitySettlement);
        run("silent model changes during reconciliation", ShadowCacheProbeTest::continuityReconciliation);
        run("silent model changes during enrichment", ShadowCacheProbeTest::continuityEnrichment);
        run("final metadata cannot publish across a detour", ShadowCacheProbeTest::continuityMetadata);
        run("retained snapshots cannot cross a detour", ShadowCacheProbeTest::continuityRetained);
        run("unavailable model window cannot admit acquisition", ShadowCacheProbeTest::continuityProviderFailure);
        run("changed initialization rejects equal guard counters", ShadowCacheProbeTest::continuityReload);
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
        run("step window: mid-batch read refuses after the batch remainder", ShadowCacheProbeTest::stepMidBatch);
        run("step window: seen detour deltas discard retained output", ShadowCacheProbeTest::stepSeenDetour);
        run("step window: equal-content detour without deltas", ShadowCacheProbeTest::stepEqualContent);
        run("step window: covered change without a callback is accepted (D26 boundary)", ShadowCacheProbeTest::stepD26Boundary);
        run("step window: late hint races refuse publication", ShadowCacheProbeTest::stepLateHint);
        run("step window: cancellation is terminal and recovery is explicit", ShadowCacheProbeTest::stepCancellation);
        run("step window: rebinding and canary steps cannot confirm", ShadowCacheProbeTest::stepRebind);
        run("step window: identity equality and init changes", ShadowCacheProbeTest::stepIdentity);
        run("step window: uncovered reads refuse", ShadowCacheProbeTest::stepUncovered);
        run("step window: exact authority waits for confirmation", ShadowCacheProbeTest::stepExact);
        run("8g3: enrichment runs bounded batches across polls", ShadowCacheProbeTest::enrichmentBatches);
        run("8g3: retirement and step changes release a partial candidate", ShadowCacheProbeTest::enrichmentInterrupted);
        run("8g3: one resource accounting boundary", ShadowCacheProbeTest::resourceAccounting);
        run("8g5c: combined equality, confirmed fallback, payload release, and recovery", ShadowCacheProbeTest::combinedStorage);
        run("8g4: unknown topology retires pending and retained output", ShadowCacheProbeTest::topologyRefusal);
        run("8g4: progress reads never advance acquisition", ShadowCacheProbeTest::progressRead);
        run("8g5b slot window: confirmation admits occupancy without identity", ShadowCacheProbeTest::slotAdmits);
        run("8g5b slot window: a slot callback during enumeration refuses", ShadowCacheProbeTest::slotDuringEnumeration);
        run("8g5b slot window: a mid-batch read refuses after the batch remainder", ShadowCacheProbeTest::slotMidBatch);
        run("8g5b slot window: structure callbacks refuse", ShadowCacheProbeTest::slotStructure);
        run("8g5b slot window: later callbacks discard retained occupancy", ShadowCacheProbeTest::slotRetained);
        run("8g5b slot window: delete and recreate without a callback mints no identity", ShadowCacheProbeTest::slotRecreateBoundary);
        run("8g5b slot window: coverage and identity refusals", ShadowCacheProbeTest::slotRefusals);
        run("8h1a: configuration refuses above allocation and applies atomically", ShadowCacheProbeTest::kneeConfigure);
        run("8h1a: promoted reads use cached membership without a dense oracle", ShadowCacheProbeTest::kneePromoted);
        run("8h1a: fixture spec golden values match the brain oracle", ShadowCacheProbeTest::kneeSpec);
        System.out.println("Shadow cache adapter: " + passed + " test groups passed.");
    }

    private static void kneeConfigure() throws Exception {
        Fixture f = new Fixture(); f.readyA();
        Limits before = f.cache().limits();
        for (JsonObject request : List.of(object("activeObservers", 3), object("width", WIDTH + 1), object("scenes", 9),
                object("occupied", 0))) {
            JsonObject refused = f.probe.configure(request, null);
            check(!refused.get("applied").getAsBoolean() && refused.has("reason"), "over-allocation request refuses: " + request);
            check(f.cache().limits().equals(before) && f.probe.status(0).get("phase").getAsString().equals("complete"),
                "a refused request changes nothing");
        }
        JsonObject request = object("activeObservers", 1); request.addProperty("width", 16); request.addProperty("occupied", 4);
        request.addProperty("pending", 4096); request.addProperty("snapshotBytes", 1L << 32); request.addProperty("replayDeadlineMs", 9_000);
        JsonObject applied = f.probe.configure(request, null);
        check(applied.get("applied").getAsBoolean(), "an allocated request applies");
        Limits limits = f.cache().limits();
        check(limits.width() == 16 && limits.occupied() == 4 && limits.pending() == 4096 && limits.snapshotBytes() == 1L << 32
            && limits.replayDeadlineMs() == 9_000 && limits.combinedBytes() == before.combinedBytes(), "absent values keep current limits");
        JsonObject active = applied.getAsJsonObject("active");
        check(active.get("observers").getAsInt() == 1 && active.get("width").getAsInt() == 16
            && active.get("subscribedObservers").getAsLong() == 1, "the inactive suffix is unsubscribed");
        check(applied.getAsJsonObject("allocation").get("observers").getAsInt() == 2
            && applied.getAsJsonObject("allocation").get("width").getAsInt() == WIDTH, "allocation stays fixed");
        check(f.probe.info().get("complete").getAsBoolean() == false && f.cache().diagnostics().entries() == 0,
            "configuration ends the identity domain");
        boolean inactive = false;
        try { f.probe.status(1); } catch (IllegalArgumentException expected) { inactive = true; }
        check(inactive, "an inactive handle refuses");
        f.rebind("A", 0);
        check(f.compare().get("comparison").getAsString().equals("match"), "the active prefix binds and matches at the new width");
    }

    private static void kneePromoted() throws Exception {
        Fixture f = new Fixture(); f.readyA();
        long authority = f.probe.info().get("authorityGetStepCalls").getAsLong();
        JsonObject warm = promoted(f, "compact");
        check(warm.get("comparison").getAsString().equals("promoted-unverified") && warm.get("readMode").getAsString().equals("promoted-research")
            && !warm.get("complete").getAsBoolean() && !warm.get("eligible").getAsBoolean() && !warm.get("denseOracle").getAsBoolean(),
            "a warm promoted read is research output: " + warm);
        check(warm.get("settlementWitness").getAsString().equals("warm-complete"), "a warm read uses the settled replay");
        check(warm.getAsJsonArray("compactNotes").size() == 1 && warm.getAsJsonArray("compactNotes").get(0).getAsJsonArray().get(2).getAsInt() == 60
            && !warm.has("authorityNotes") && !warm.has("diagnosticSnapshot"), "compact payload carries membership values only");
        check(f.probe.info().get("authorityGetStepCalls").getAsLong() == authority, "a promoted read makes no dense authority read");
        check(promoted(f, "none").get("noteCount").getAsInt() == 1 && !promoted(f, "none").has("compactNotes"), "no payload keeps the count");
        f.rebind("B", 0);
        JsonObject cold = promoted(f, "full");
        check(cold.get("settlementWitness").getAsString().equals("membership-window-only-unverified")
            && cold.has("diagnosticSnapshot") && cold.get("noteCount").getAsInt() == 1, "a cold read settles from membership only: " + cold);
        check(f.probe.info().get("authorityGetStepCalls").getAsLong() == authority, "a cold promoted read makes no dense authority read");
        boolean refused = false;
        try { f.probe.promotedStart(0, 1, "verbose"); } catch (IllegalArgumentException expected) { refused = true; }
        check(refused, "an unknown payload refuses");
    }

    /** The same golden values are in phase8h1a-knee-lib.test.ts. */
    private static void kneeSpec() {
        long[][] expected = {{0, 0, 24, 1, 4}, {4, 1, 31, 38, 4}, {8, 2, 38, 75, 4}, {12, 3, 45, 112, 4}, {16, 4, 52, 22, 1}};
        for (int i = 0; i < 5; i++) {
            long[] row = {ShadowKneeFixture.cell(i, 5, 17), ShadowKneeFixture.channel(i), ShadowKneeFixture.pitch(i),
                ShadowKneeFixture.velocity(i), ShadowKneeFixture.durationCells(i, 5, 17)};
            check(java.util.Arrays.equals(row, expected[i]), "fixture spec row " + i + ": " + java.util.Arrays.toString(row));
        }
        check(ShadowKneeFixture.cell(0, 1, 4_194_304) == 4_194_303 && ShadowKneeFixture.cell(131_071, 131_072, 4_194_304) == 4_194_303,
            "the final cell is always occupied");
        check(ShadowKneeFixture.durationCells(10, 131_072, 131_072) == 1, "a full clip uses one-cell notes");
        check(ShadowKneeFixture.durationCells(0, 5, 17, 3) == 3 && ShadowKneeFixture.durationCells(0, 4096, 1_048_576, 1_000_000) == 256,
            "the duration cap bounds sustained cells and never reaches the next note");
    }

    private static JsonObject promoted(Fixture f, String payload) throws Exception {
        JsonObject result = f.probe.promotedStart(0, Integer.MAX_VALUE, payload);
        for (int attempt = 0; attempt < 80 && result.get("comparison").getAsString().equals("pending"); attempt++) {
            fastClock(f.probe); f.host.runTasks(); result = f.probe.comparePoll();
        }
        return result;
    }

    private static JsonObject object(String key, Number value) { JsonObject result = new JsonObject(); result.addProperty(key, value); return result; }

    private static void topologyRefusal() throws Exception {
        for (boolean retained : List.of(false, true)) {
            Fixture f = new Fixture(); final boolean[] complete = {true}; final int[] reads = {0};
            ShadowTopologyControl control = new ShadowTopologyControl(() -> {
                reads[0]++; if (!complete[0]) throw new IllegalStateException("unknown descendant");
                return ShadowTopologyControlTest.plain();
            });
            f.probe.attachTopologyControl(control); f.probe.observeTopology(); f.readyA();
            if (retained) f.compare(); else f.probe.compareStart(0);
            int prior = reads[0]; long commands = f.host.bindingCommands;
            complete[0] = false; control.changed();
            check(reads[0] == prior && f.host.bindingCommands == commands, "topology callback reads no provider and sends no host command");
            f.probe.observeTopology();
            JsonObject result = f.probe.compareStatus();
            check(!result.has("diagnosticSnapshot") && !result.has("authorityNotes") && !result.has("scanId"), "retirement exposes no scan or current payload");
            check(!f.probe.status(0).has("historicalSnapshot"), "retained output is discarded");
            check(f.probe.point(0, f.a, 0, f.c, 0).get("reason").getAsString().equals("group-topology-unproved"), "incomplete topology cannot rebind");
            complete[0] = true; f.probe.observeTopology(); f.rebind("A", 0);
            check(f.compare().get("comparison").getAsString().equals("match"), "complete topology recovers with new binding and fresh authority");
        }
    }
    private static void progressRead() throws Exception {
        Fixture f = new Fixture(); f.readyA();
        JsonObject active = f.probe.compareStart(0); long id = active.get("scanId").getAsLong();
        for (int n = 0; n < 3; n++) {
            JsonObject status = f.probe.compareStatus();
            check(status.get("scanId").getAsLong() == id && status.get("scanProgressCoordinates").getAsInt() == 0,
                "read-only progress holds the same active acquisition");
            check(!status.has("authorityNotes") && !status.has("diagnosticSnapshot"), "progress exposes no current payload");
        }
        f.probe.retire(0); check(!f.probe.compareStatus().has("scanId"), "retired acquisition has no active ID");
        f.rebind("A", 0); check(f.probe.compareStart(0).get("scanId").getAsLong() > id, "a new scan has a distinct ID");
    }

    /** Thirty notes and 4 ms per coordinate need several 40 ms enrichment batches. */
    private static Fixture batchedFixture() throws Exception {
        Fixture f = new Fixture();
        for (int x = 1; x <= 30; x++) f.host.clip("A", 0).notes.put(new Cell(x % 16, x, 60), fields(.5));
        f.readyA();
        f.host.resident(0).everyRead = () -> { long end = System.nanoTime() + 250_000L; while (System.nanoTime() < end) Thread.onSpinWait(); };
        return f;
    }

    /** Poll until the scan reports the enrichment stage with partial candidate work. */
    private static JsonObject untilEnriching(Fixture f) throws Exception {
        JsonObject result = f.probe.compareStart(0);
        for (int attempt = 0; attempt < 80; attempt++) {
            if (result.has("scanStage") && result.get("scanStage").getAsString().equals("enrichment")
                && result.getAsJsonObject("snapshotCandidate").get("phase").getAsString().equals("enriching")) return result;
            check(result.get("comparison").getAsString().equals("pending"), "comparison stays pending before enrichment: " + result);
            fastClock(f.probe); f.host.runTasks(); result = f.probe.comparePoll();
        }
        throw new AssertionError("enrichment stage was not observed");
    }

    private static void enrichmentBatches() throws Exception {
        Fixture f = batchedFixture();
        long before = f.probe.info().get("enrichmentBatches").getAsLong();
        JsonObject partial = untilEnriching(f);
        noOutput(partial);
        check(!partial.has("diagnosticSnapshot") && !partial.has("authorityNotes") && !partial.has("historicalSnapshot"),
            "partial enrichment exposes no candidate or authority values");
        JsonObject accounting = partial.getAsJsonObject("resourceAccounting");
        check(accounting.get("candidateSnapshotEstimatedBytes").getAsLong() > 0 && accounting.get("retainedSnapshotEstimatedBytes").getAsLong() == 0
            && accounting.get("candidatePhase").getAsString().equals("enriching"), "the candidate is accounted while the old snapshot is replaced");
        JsonObject candidate = partial.getAsJsonObject("snapshotCandidate");
        check(candidate.get("lastBatchMs").getAsDouble() <= ENRICHMENT_BATCH_MS && candidate.get("coordinatesDone").getAsInt() < 31,
            "one poll runs one bounded batch");
        JsonObject result = partial;
        for (int attempt = 0; attempt < 80 && result.get("comparison").getAsString().equals("pending"); attempt++) {
            fastClock(f.probe); f.host.runTasks(); result = f.probe.comparePoll();
        }
        check(result.get("comparison").getAsString().equals("match") && f.snapshot(result).notes().size() == 31,
            "batched enrichment matches independent authority");
        check(result.get("enrichmentBatches").getAsLong() - before > 1, "enrichment needed more than one batch");
        JsonObject phases = result.getAsJsonObject("scanPhaseTimesMs");
        for (String phase : List.of("membership", "authority-binding", "authority-reads", "settlement-confirmation", "enrichment", "result-confirmation", "ended"))
            check(phases.has(phase), "phase time is reported: " + phase);
        check(phases.get("enrichmentHostWorkMs").getAsDouble() > 0 && phases.get("authorityHostWorkMs").getAsDouble() > 0,
            "host work stays separate from wall phase times");
        JsonObject done = result.getAsJsonObject("resourceAccounting");
        check(done.get("candidateSnapshotEstimatedBytes").getAsLong() == 0 && done.get("retainedSnapshotEstimatedBytes").getAsLong()
            == f.snapshot(result).payloadEstimatedBytes(), "publication moves the estimate into the retained snapshot");
    }

    private static void enrichmentInterrupted() throws Exception {
        Fixture f = batchedFixture();
        untilEnriching(f);
        f.probe.retire(0);
        JsonObject retired = f.probe.info();
        check(retired.getAsJsonObject("resourceAccounting").get("candidateSnapshotEstimatedBytes").getAsLong() == 0
            && retired.getAsJsonObject("resourceAccounting").get("snapshotDomainEstimatedBytes").getAsLong() == 0
            && retired.getAsJsonObject("lastSnapshotCandidate").get("phase").getAsString().equals("retired"),
            "retirement releases the partial candidate");
        noOutput(f.probe.comparePoll());
        check(field(f.probe, "scan") == null && !f.probe.comparePoll().has("diagnosticSnapshot"), "no scan or output remains");
        f.host.resident(0).everyRead = null; f.rebind("A", 0); f.host.resident(0).everyRead = () -> {
            long end = System.nanoTime() + 250_000L; while (System.nanoTime() < end) Thread.onSpinWait(); };
        untilEnriching(f);
        f.host.resident(1).emit(0, 60, 2);
        fastClock(f.probe); f.host.runTasks();
        JsonObject changed = f.probe.comparePoll();
        check(changed.get("comparison").getAsString().equals("step-window-changed") && changed.get("terminal").getAsBoolean()
            && !changed.has("diagnosticSnapshot"), "a step between batches refuses the candidate");
        check(changed.getAsJsonObject("resourceAccounting").get("snapshotDomainEstimatedBytes").getAsLong() == 0,
            "a step change retains no candidate or snapshot");
        f.host.resident(0).everyRead = null; f.rebind("A", 0);
        check(f.compare().get("comparison").getAsString().equals("match"), "an explicit new attempt recovers with fresh values");
    }

    private static void combinedStorage() throws Exception {
        Fixture f = new Fixture(); f.readyA(); f.probe.point(1, f.b, 0); f.settle(1); f.compare(1);
        JsonObject calibration = f.compare();
        long peak = calibration.getAsJsonObject("publicationResourceAccounting").get("totalEstimatedBytes").getAsLong();
        long[] external = {MAX_COMBINED_BYTES - peak};
        var original = (java.util.function.LongSupplier)field(f.cache(), "externalStorageBytes");
        f.cache().attachExternalStorageEstimate(() -> external[0] + original.getAsLong());
        JsonObject equal = f.compare();
        check(equal.get("comparison").getAsString().equals("match")
            && equal.getAsJsonObject("publicationResourceAccounting").get("totalEstimatedBytes").getAsLong() == MAX_COMBINED_BYTES,
            "adapter publishes equality with two resident payloads and authority staging");
        external[0]++;
        JsonObject excess = f.compare();
        check(excess.get("comparison").getAsString().equals("combined-storage-budget")
            && excess.get("authorityAvailable").getAsBoolean() && excess.get("fallbackPerformed").getAsBoolean()
            && excess.get("stepWindowConfirmed").getAsBoolean() && !excess.has("diagnosticSnapshot"),
            "one estimated byte of excess returns confirmed exact authority without a snapshot");
        check(f.cache().resources().snapshotDomainEstimatedBytes() == 0
            && !f.probe.status(0).has("historicalSnapshot") && !f.probe.status(1).has("historicalSnapshot"),
            "shedding releases both core and adapter payload references");
        external[0] = 0;
        check(f.compare().get("comparison").getAsString().equals("match"), "explicit cache recovery");
        check(f.exact(f.a, null).get("authorityAvailable").getAsBoolean(), "explicit exact request remains available");
    }
    private static void resourceAccounting() throws Exception {
        Fixture f = new Fixture(); f.readyA();
        Cursor resident = f.host.resident(0);
        resident.emit(3, 61, 2); resident.emit(4, 61, 2);
        JsonObject info = f.probe.info(), accounting = info.getAsJsonObject("resourceAccounting");
        long hints = info.get("physicalPendingHints").getAsLong();
        check(hints == 2 && accounting.get("physicalHintQueueEstimatedBytes").getAsLong() == 56 * hints
            && accounting.get("externalRecorderEstimatedBytes").getAsLong() == 56 * hints, "hint queues count in the recorder domain");
        check(accounting.get("recorderDomainEstimatedBytes").getAsLong() == accounting.get("residentRecorderEstimatedBytes").getAsLong()
            + accounting.get("stagingRecorderEstimatedBytes").getAsLong() + 56 * hints, "the recorder domain sums its parts");
        long total = accounting.get("recorderDomainEstimatedBytes").getAsLong() + accounting.get("snapshotDomainEstimatedBytes").getAsLong()
            + accounting.get("authorityDomainEstimatedBytes").getAsLong() + accounting.get("registryAttemptEstimatedBytes").getAsLong()
            + accounting.get("identityAndWitnessEstimatedBytes").getAsLong()
            + accounting.get("topologyDomainEstimatedBytes").getAsLong() + accounting.get("slotDomainEstimatedBytes").getAsLong();
        check(accounting.get("totalEstimatedBytes").getAsLong() == total, "the total adds every domain once");
        check(accounting.get("combinedLimitSelected").getAsBoolean() && accounting.get("combinedLimitBytes").getAsLong() == MAX_COMBINED_BYTES
            && !accounting.get("heapMeasured").getAsBoolean()
            && !accounting.get("hostMemoryMeasured").getAsBoolean() && !accounting.get("serializedBytesAreMemoryMeasurement").getAsBoolean()
            && accounting.get("recorderLimitBytes").getAsLong() == MAX_RECORDER_BYTES && accounting.get("snapshotLimitBytes").getAsLong() == MAX_SNAPSHOT_BYTES,
            "limits and unmeasured quantities are explicit");
        f.probe.reconcile(0);
        JsonObject exact = f.exact(f.a, null);
        check(exact.get("authorityAvailable").getAsBoolean(), "exact authority acquires");
        JsonObject staged = f.probe.info().getAsJsonObject("resourceAccounting");
        check(staged.get("exactAuthorityStagingEstimatedBytes").getAsLong() > 0
            && staged.get("authorityDomainEstimatedBytes").getAsLong() == staged.get("exactAuthorityStagingEstimatedBytes").getAsLong(),
            "retained exact output stays in the authority domain");
        f.probe.exactCancel("accounting-test");
        check(f.probe.info().getAsJsonObject("resourceAccounting").get("authorityDomainEstimatedBytes").getAsLong() == 0,
            "cancellation releases authority staging");
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
            fastClock(f.probe); f.host.runTasks(); result = f.probe.comparePoll();
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
        for (int attempt = 0; attempt < 8; attempt++) { fastClock(f.probe); f.host.runTasks(); result = f.probe.comparePoll(); }
        JsonObject pending = result.getAsJsonObject("authorityBinding");
        check(pending.get("stage").getAsString().equals("canary") && !pending.get("clipPinned").getAsBoolean()
            && !pending.get("distinctControlConfirmed").getAsBoolean(), "a pin request cannot replace confirmed distinct binding");
        check(!pending.get("cacheMembershipUsed").getAsBoolean(), "the authority control does not use sparse membership");
        reader.holdClipPinRead = false;
        for (int attempt = 0; attempt < 80 && result.get("comparison").getAsString().equals("pending"); attempt++) {
            fastClock(f.probe); f.host.runTasks(); result = f.probe.comparePoll();
        }
        check(result.get("comparison").getAsString().equals("match") && result.get("authorityDistinctControlConfirmed").getAsBoolean(),
            "a distinct control releases the held scene index and the moved target matches");
        check(reader.staleSceneIndex == null && reader.target == moved && reader.clipPinned && reader.trackPinned,
            "final authority reads the moved clip with both pins confirmed");
        check(result.get("authorityBindingRevision").getAsString().equals("8g-authority-transition-v1"), "authority transition has its own revision");

        reader.holdClipPinRead = true; f.probe.compareStart(0);
        f.host.runTasks(); f.probe.comparePoll(); // The confirmed membership window starts the authority binding.
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

    private static void continuityUnavailable() throws Exception {
        Fixture f = new Fixture();
        ShadowCacheProbe live = new ShadowCacheProbe(f.host.host(), f.config);
        for (JsonObject result : List.of(live.point(0, f.a, 0), live.point(0, f.a, 0, f.b, 0),
            live.acquire(f.a, 0), live.exactStart(f.a, 0), live.compareStart(0))) {
            check(result.get("reason").getAsString().equals("identity-probe-unavailable"), "missing probe refuses every read route");
            noOutput(result);
        }
        noOutput(live.inventory(null)); noOutput(live.beginInventoryRebuild(null)); noOutput(live.pollInventoryRebuild(null));
        check(!live.info().get("registryPublished").getAsBoolean(), "missing continuity cannot publish inventory");
        check(f.host.bindingCommands == 0, "refusal cannot move a physical target");
    }

    private static void continuityUnseen() throws Exception {
        Fixture f = new Fixture(); f.readyA();
        String old = f.ref("A", 0); CallbackToken token = f.cache().bindingToken(old);
        IdentityHost h = new IdentityHost(); RootIdentityProbe root = h.probe(false);
        var before = root.identityGuard(); long callbacks = root.trace().get("callbackCount").getAsLong();
        // Model native commands change the root without observer delivery.
        List<String> nativeCommands = new ArrayList<>();
        nativeCommands.add("B:engine-on:1"); h.value("root.channelId").current = "root-B";
        nativeCommands.add("A:engine-on:2"); h.value("root.channelId").current = "root-id";
        check(nativeCommands.size() == 2 && before.equals(root.identityGuard()), "independent model log has a detour with equal endpoints");
        check(root.trace().get("callbackCount").getAsLong() == callbacks && !before.acquisitionAllowed(),
            "equal sampled observations never prove the input window");
        f.probe.attachIdentityProbe(root);
        for (int attempt = 0; attempt < 2; attempt++) {
            for (JsonObject result : List.of(f.probe.point(0, f.a, 0), f.probe.point(0, f.a, 0, f.b, 0),
                f.probe.acquire(f.a, 0), f.probe.exactStart(f.a, 0), f.probe.compareStart(0))) {
                check(result.get("reason").getAsString().equals("project-continuity-unproved"), "canary, exact, and fresh attempts cannot assert continuity");
                noOutput(result);
            }
            noOutput(f.probe.comparePoll()); noOutput(f.probe.exactPoll()); noOutput(f.probe.status(0));
            noOutput(f.probe.inventory(null)); noOutput(f.probe.beginInventoryRebuild(null));
            check(!f.probe.info().get("registryPublished").getAsBoolean(), "unproved roots cannot publish a registry");
            f.probe.lifecycle("save");
        }
        check(!f.cache().hasClip(old) && !f.cache().callback(old, token, CELL) && f.cache().diagnostics().resident() == 0,
            "uncertainty retires old references and tokens permanently");
    }

    private static void continuityRevision() throws Exception {
        IdentityFixture i = identityFixture(); Fixture f = i.f; f.readyA();
        String old = f.ref("A", 0); CallbackToken token = f.cache().bindingToken(old);
        long epoch = i.root.identityEpoch();
        i.host.inputWindow = "B-generation-1"; i.host.inputWindow = "A-generation-2";
        noOutput(f.probe.compareStart(0)); noOutput(f.probe.comparePoll());
        check(i.root.identityEpoch() == epoch && !f.cache().hasClip(old) && !f.cache().callback(old, token, CELL),
            "independent revision retires equal roots without delivered callbacks");
        f.rebind("A", 0);
        check(f.compare().get("comparison").getAsString().equals("match") && !old.equals(f.ref("A", 0)),
            "explicit recovery has a new ref and fresh independent values");
        String fresh = f.ref("A", 0); f.probe.lifecycle("save");
        check(fresh.equals(f.ref("A", 0)), "model save preserves identity inside the fenced generation");
    }

    private static void continuityConstruction() throws Exception {
        IdentityFixture i = identityFixture(); i.f.readyA();
        i.host.value(CHAIN).readHook = () -> i.host.inputWindow = "A-generation-2";
        check(!i.root.identityGuard().coherent(), "window changes during construction reject the guard");
        noOutput(i.f.probe.compareStart(0));
    }

    private static void continuitySettlement() throws Exception {
        IdentityFixture i = identityFixture(); Fixture f = i.f;
        f.probe.acquire(f.a, 0);
        f.host.resident(0).bindingHook = () -> i.host.inputWindow = "A-generation-2";
        for (int poll = 0; poll < 5; poll++) { fastClock(f.probe); noOutput(f.probe.poll(0)); }
        ShadowHandlePool pool = (ShadowHandlePool)field(f.probe, "handlePool");
        check(pool.entries().stream().allMatch(entry -> entry.address() == null && !entry.reserved()),
            "target confirmation cannot accept a reservation across an unseen transition");
    }

    private static void continuityReconciliation() throws Exception {
        IdentityFixture i = identityFixture(); i.f.readyA();
        Cursor cursor = i.f.host.resident(0); cursor.emit(0, 60, 2);
        cursor.readHook = () -> i.host.inputWindow = "A-generation-2";
        noOutput(i.f.probe.reconcile(0));
        check(i.f.cache().diagnostics().resident() == 0, "silent read revision discards reconciliation");
    }

    private static void continuityEnrichment() throws Exception {
        IdentityFixture i = identityFixture(); i.f.readyA();
        i.f.host.resident(0).fieldHook = () -> i.host.inputWindow = "A-generation-2";
        noOutput(i.f.compare());
        check(i.f.cache().diagnostics().resident() == 0, "silent field revision discards candidate and residence");
    }

    private static void continuityMetadata() throws Exception {
        IdentityFixture i = identityFixture(); i.f.readyA();
        i.f.host.authority().reads.clear();
        i.f.host.authority().metadataHook = () -> i.host.inputWindow = "A-generation-2";
        JsonObject result = i.f.compare();
        noOutput(result);
        check(result.get("comparison").getAsString().equals("window-changed"), "final metadata detour cannot publish");
    }

    private static void continuityRetained() throws Exception {
        IdentityFixture i = identityFixture(); i.f.readyA();
        i.host.inputWindow = "A-generation-2";
        noOutput(i.f.probe.status(0));
        check(i.f.probe.status(0).get("phase").getAsString().equals("retired"), "retained output check retires the binding");
    }

    private static void continuityProviderFailure() {
        IdentityHost h = new IdentityHost();
        RootIdentityProbe root = new RootIdentityProbe(h.node(ControllerHost.class, "host"), "model-init",
            h.node(Project.class, "project"), h.node(Application.class, "application"),
            () -> { throw new IllegalStateException("window unavailable"); });
        check(!root.identityGuard().acquisitionAllowed(), "a failed external provider supplies no continuity proof");
        Fixture f = new Fixture(); f.probe.attachIdentityProbe(root);
        noOutput(f.probe.point(0, f.a, 0)); noOutput(f.probe.exactStart(f.a, 0));
    }

    private static void continuityReload() {
        IdentityHost h = new IdentityHost(); RootIdentityProbe a = h.probe();
        RootIdentityProbe b = new RootIdentityProbe(h.node(ControllerHost.class, "host"), "different-init",
            h.node(Project.class, "project"), h.node(Application.class, "application"), () -> h.inputWindow);
        check(a.identityGuard().epoch() == b.identityGuard().epoch() && !b.identityEpochCurrent(a.identityGuard()),
            "equal counters, roots, and input windows cannot cross initialization domains");
    }

    private static void noOutput(JsonObject result) {
        check(!result.get("complete").getAsBoolean() && !result.get("eligible").getAsBoolean(), "all live gates remain closed");
        for (String field : List.of("authorityNotes", "authorityMetadata", "authorityCoverage", "diagnosticSnapshot", "historicalSnapshot"))
            check(!result.has(field), "refused output cannot retain " + field);
    }

    // 8g2b step-delta read window. Tasks model the E217 rule: a scheduled task runs after the batch remainder.
    private static IdentityFixture stepFixture() { return stepFixture(new IdentityHost()); }
    private static IdentityFixture stepFixture(IdentityHost h) {
        Fixture f = new Fixture(); RootIdentityProbe root = h.stepProbe();
        check(root.identityGuard().acquisitionAllowed(), "a coherent root admits the step-delta protocol: " + root.identityGuard());
        f.probe.attachIdentityProbe(root);
        return new IdentityFixture(f, h, root);
    }
    private static final Map<Cell, Map<String, Object>> Q_CONTENT = Map.of(new Cell(0, 8, 72), fields(.5));
    private static long info(Fixture f, String field) { return f.probe.info().get(field).getAsLong(); }
    private static boolean holdsForeign(Fixture f) {
        for (Object view : (Object[]) field(f.probe, "views")) {
            Result retained = (Result) field(view, "lastResult");
            if (retained != null && retained.snapshot().notes().stream().anyMatch(n -> n.cell() == 8 && n.pitch() == 72)) return true;
        }
        String ref = f.ref("A", 0);
        return ref != null && f.cache().hasClip(ref) && f.cache().occupiedCoordinates(ref) > 1;
    }
    /** Drive a comparison until the given stage has scheduled its confirmation. Do not run that task. */
    private static void driveTo(Fixture f, String stage) throws Exception {
        f.probe.compareStart(0);
        for (int attempt = 0; attempt < 80; attempt++) {
            Object scan = field(f.probe, "scan");
            check(scan != null, "comparison is still active before " + stage);
            if (stage.equals(field(scan, "stage"))) return;
            fastClock(f.probe); f.host.runTasks(); f.probe.comparePoll();
        }
        throw new AssertionError("comparison did not reach " + stage);
    }

    private static void stepMidBatch() throws Exception {
        IdentityFixture i = stepFixture(); Fixture f = i.f; f.readyA();
        String old = f.ref("A", 0); long refusals = info(f, "stepWindowRefusals");
        JsonObject[] started = new JsonObject[1];
        f.host.detour("A", 0, Q_CONTENT, () -> started[0] = f.probe.compareStart(0));
        check(started[0].get("comparison").getAsString().equals("pending") && !started[0].has("authorityNotes"),
            "a same-callback start/end check sees no change and admits nothing");
        f.host.runTasks();
        JsonObject result = f.probe.comparePoll();
        check(result.get("comparison").getAsString().equals("step-window-changed") && result.get("terminal").getAsBoolean(),
            "the batch remainder changes the window before its confirmation: " + result.get("comparison"));
        noOutput(result); noOutput(f.probe.status(0));
        check(!f.cache().hasClip(old) && !holdsForeign(f) && info(f, "stepWindowRefusals") == refusals + 1,
            "the binding retires and no foreign membership remains");
        for (int poll = 0; poll < 2; poll++) check(f.probe.comparePoll().get("comparison").getAsString().equals("step-window-changed"),
            "step refusal stays terminal across polls");
        f.rebind("A", 0); JsonObject recovered = f.compare();
        check(recovered.get("comparison").getAsString().equals("match") && !old.equals(f.ref("A", 0)),
            "explicit recovery needs a new reference and fresh values");
        check(f.snapshot(recovered).notes().size() == 1 && f.snapshot(recovered).notes().get(0).pitch() == 60, "recovery reads P content");
    }

    private static void stepSeenDetour() throws Exception {
        IdentityFixture i = stepFixture(); Fixture f = i.f; f.readyA();
        check(f.probe.status(0).has("historicalSnapshot"), "a confirmed match retains output");
        RootIdentityProbe.IdentityGuard before = i.root.identityGuard();
        f.host.detour("A", 0, Q_CONTENT, () -> { });
        check(before.equals(i.root.identityGuard()), "identity values stay equal across the detour");
        check(!f.probe.status(0).has("historicalSnapshot") && info(f, "retainedStepWindowDiscards") == 1,
            "step deltas discard retained output despite equal identity");
        JsonObject result = f.compare();
        check(result.get("comparison").getAsString().equals("match") && !holdsForeign(f),
            "hints re-read the P endpoint and the new comparison has no foreign content");
    }

    private static void stepEqualContent() throws Exception {
        IdentityFixture i = stepFixture(); Fixture f = i.f; f.readyA();
        long changes = info(f, "stepWindowChanges");
        // Q shows equal covered content, so the host sends no step callback.
        check(f.probe.status(0).has("historicalSnapshot") && info(f, "stepWindowChanges") == changes,
            "an equal-content detour without deltas cannot expose different content");
        check(f.compare().get("comparison").getAsString().equals("match"), "equal content still matches");
    }

    private static void stepD26Boundary() throws Exception {
        IdentityFixture i = stepFixture(); Fixture f = i.f; f.readyA();
        long refusals = info(f, "stepWindowRefusals");
        // A covered change without a callback violates D26. The window accepts it by design.
        f.host.clips.get("A:0").notes.put(new Cell(3, 9, 64), fields(.625));
        check(f.probe.status(0).has("historicalSnapshot"), "D26 boundary: retained output stays exposed without a callback");
        JsonObject result = f.compare();
        check(info(f, "stepWindowRefusals") == refusals && result.get("comparison").getAsString().equals("membership-mismatch"),
            "D26 boundary: windows confirm; only the independent authority shows the silent change");
    }

    private static void stepLateHint() throws Exception {
        for (boolean afterConfirmation : new boolean[] {false, true}) {
            IdentityFixture i = stepFixture(); Fixture f = i.f; f.readyA();
            driveTo(f, "result");
            if (afterConfirmation) f.host.runTasks();
            f.host.resident(0).emit(0, 60, 2);
            f.host.runTasks();
            JsonObject result = f.probe.comparePoll();
            check(result.get("comparison").getAsString().equals("step-window-changed"),
                "a late hint " + (afterConfirmation ? "after" : "before") + " confirmation refuses publication");
            noOutput(result);
            check(f.probe.status(0).get("phase").getAsString().equals("retired"), "the late hint retires the binding");
        }
    }

    private static void stepCancellation() throws Exception {
        for (String stage : List.of("membership", "settlement", "result")) {
            IdentityFixture i = stepFixture(); Fixture f = i.f; f.readyA();
            CallbackToken old = f.cache().bindingToken(f.ref("A", 0)); driveTo(f, stage);
            f.probe.retire(0); f.host.runTasks();
            for (int poll = 0; poll < 2; poll++) {
                JsonObject result = f.probe.comparePoll();
                check(result.get("comparison").getAsString().equals("window-changed"), "cancellation at " + stage + " stays terminal");
                noOutput(result);
            }
            f.rebind("A", 0);
            // Explicit retirement evicts the reference. Recovery replays under a fresh binding token.
            check(f.compare().get("comparison").getAsString().equals("match") && !old.equals(f.cache().bindingToken(f.ref("A", 0))),
                "recovery after cancellation at " + stage + " uses a fresh binding and values");
        }
        IdentityFixture i = stepFixture(); Fixture f = i.f; f.readyA();
        f.probe.point(0, f.b, 0, f.c, 0);
        for (int attempt = 0; attempt < 20 && field(((Object[]) field(f.probe, "views"))[0], "canaryRead") == null; attempt++) {
            fastClock(f.probe); f.host.runTasks(); f.probe.poll(0);
        }
        check(field(((Object[]) field(f.probe, "views"))[0], "canaryRead") != null, "the canary read is pending");
        f.probe.retire(0); f.host.runTasks();
        check(f.probe.poll(0).get("phase").getAsString().equals("retired") && !f.probe.status(0).get("canaryVerifiedForBinding").getAsBoolean(),
            "a late canary confirmation cannot revive a retired binding");
    }

    private static void stepRebind() throws Exception {
        IdentityFixture i = stepFixture(); Fixture f = i.f; f.readyA();
        driveTo(f, "membership");
        f.probe.point(1, f.b, 0); f.host.runTasks();
        JsonObject result = f.probe.comparePoll();
        check(result.get("comparison").getAsString().equals("step-window-changed"), "another observer's rebind cannot confirm the window");
        noOutput(result);
        f = stepFixture().f; f.readyA(); f.probe.point(0, f.b, 0, f.c, 0);
        Object view = ((Object[]) field(f.probe, "views"))[0];
        for (int attempt = 0; attempt < 20 && field(view, "canaryRead") == null; attempt++) { fastClock(f.probe); f.host.runTasks(); f.probe.poll(0); }
        f.host.resident(0).emit(5, 72, 2); f.host.runTasks();
        JsonObject canary = f.probe.poll(0);
        check(canary.get("reason").getAsString().equals("step-window-changed") && canary.get("phase").getAsString().equals("retired"),
            "a step during canary confirmation refuses the canary");
    }

    private static void stepIdentity() throws Exception {
        IdentityHost h = new IdentityHost(); h.value(CHAIN_EXISTS).current = false;
        IdentityFixture i = stepFixture(h); Fixture f = i.f;
        check(i.root.identityGuard().chainIds().isEmpty(), "the step-delta protocol does not need chain IDs");
        f.probe.point(0, f.a, 0); f.settle();
        f.probe.compareStart(0);
        for (int poll = 0; poll < 5; poll++) { fastClock(f.probe); JsonObject pending = f.probe.comparePoll(); noOutput(pending);
            check(!pending.has("authorityNotes"), "equal identity without a confirmed window admits nothing"); }
        f.host.runTasks();
        JsonObject result = f.compare();
        check(result.get("comparison").getAsString().equals("match") && result.get("stepWindowConfirmed").getAsBoolean(),
            "confirmed windows admit the comparison");
        IdentityHost other = new IdentityHost();
        RootIdentityProbe a = other.stepProbe();
        RootIdentityProbe b = new RootIdentityProbe(other.node(ControllerHost.class, "host"), "different-init",
            other.node(Project.class, "project"), other.node(Application.class, "application"), () -> StepDeltaWindow.PROTOCOL, true);
        check(!b.identityEpochCurrent(a.identityGuard()), "a changed init nonce rejects equal step-delta guards");
        Object first = field(f.probe, "stepWindow"), second = field(stepFixture().f.probe, "stepWindow");
        check(!((StepDeltaWindow) first).value().initNonce().equals(((StepDeltaWindow) second).value().initNonce()),
            "each adapter instance has its own window domain");
        check(!new IdentityHost().probe(false).identityGuard().acquisitionAllowed(), "no provider still refuses");
    }

    private static void stepUncovered() throws Exception {
        IdentityFixture i = stepFixture(); Fixture f = i.f;
        for (JsonObject result : List.of(f.probe.inventory(null), f.probe.beginInventoryRebuild(null), f.probe.pollInventoryRebuild(null))) {
            noOutput(result);
            check(!f.probe.info().get("registryPublished").getAsBoolean()
                && f.probe.info().get("fallbackReason").getAsString().equals("inventory-outside-step-coverage"), "slot inventory stays refused");
        }
        Coverage outside = new Coverage(0, WIDTH + 1, true, java.util.Set.of("velocity"), java.util.Set.of(), "1/512-beat");
        check(f.probe.exactStart(f.a, 0, outside).get("reason").getAsString().equals("authority-coverage-unavailable"),
            "an exact read outside observer coverage refuses");
        f.host.resident(0).subscribed = false;
        f.probe.point(0, f.a, 0); f.settle();
        JsonObject unsubscribed = f.probe.compareStart(0);
        check(unsubscribed.get("reason").getAsString().equals("observer-unsubscribed"), "an unsubscribed observer cannot open a window");
    }

    private static void stepExact() throws Exception {
        IdentityFixture i = stepFixture(); Fixture f = i.f;
        JsonObject result = f.probe.exactStart(f.b, 0);
        Object exact = field(f.probe, "exactFallback");
        for (int attempt = 0; attempt < 120 && !"confirming".equals(field(exact, "phase")); attempt++) {
            fastClock(f.probe); long now = System.nanoTime();
            if ((long) field(exact, "boundAt") != 0) {
                setIfPresent(exact, "boundAt", now - 1_600_000_000L); setIfPresent(exact, "pollAt", now - 60_000_000L); setIfPresent(exact, "quietPolls", 10);
            }
            f.host.runTasks(); result = f.probe.exactPoll();
        }
        check("confirming".equals(field(exact, "phase")) && !result.has("authorityNotes"), "the final exact read waits for confirmation");
        f.host.authority().emit(0, 60, 2); f.host.runTasks();
        result = f.probe.exactPoll();
        check(result.get("reason").getAsString().equals("authority-step-window-changed") && !result.has("authorityNotes"),
            "a batch remainder refuses exact output");
        check(f.exact(f.b, null).get("authorityAvailable").getAsBoolean(), "an explicit new exact attempt recovers");
    }

    private static final String CHAIN = "tracks.0.devices.0.layers.0.channelId";
    private static final String CHAIN_EXISTS = "tracks.0.devices.0.layers.0.exists";

    // 8g5b slot-delta window. Scheduled tasks model D27: a task runs after the batch remainder.
    private static final class FakeSlots implements ShadowCacheProbe.SlotSource {
        final List<String> tracks = List.of("A", "B", "C");
        final int rows = 8;
        final java.util.Set<Address> occupied = new java.util.LinkedHashSet<>();
        long slotCallbacks, structureCallbacks, reads;
        String refusal;
        /** One delivered hasContent callback. A coalesced change calls set() only. */
        void callback(Address address, boolean has) { set(address, has); slotCallbacks++; }
        void set(Address address, boolean has) { if (has) occupied.add(address); else occupied.remove(address); }
        public long slotCallbacks() { return slotCallbacks; }
        public long structureCallbacks() { return structureCallbacks; }
        public String coverageRefusal() { return refusal; }
        public long maximumCells() { return (long) tracks.size() * rows; }
        public JsonObject resources() { return new JsonObject(); }
        public ShadowInventoryRebuild.InventoryProvider inventory(Coverage coverage) {
            return new ShadowInventoryRebuild.InventoryProvider() {
                public long cellCount() { return (long) tracks.size() * rows; }
                public boolean fullInventory() { return refusal == null; }
                public ShadowInventoryRebuild.Slot read(long index) {
                    reads++;
                    Address address = new Address(tracks.get((int) (index / rows)), (int) (index % rows));
                    return occupied.contains(address) ? new ShadowInventoryRebuild.Slot(address, coverage) : null;
                }
            };
        }
    }
    private record SlotFixture(Fixture f, FakeSlots slots) {}
    private static SlotFixture slotFixture() {
        IdentityFixture i = stepFixture(); FakeSlots slots = new FakeSlots();
        slots.set(new Address("A", 0), true); slots.set(new Address("C", 5), true);
        i.f.probe.attachSlotSource(slots);
        return new SlotFixture(i.f, slots);
    }
    private static java.util.Map<Address, String> listed(JsonObject result) {
        java.util.Map<Address, String> rows = new java.util.LinkedHashMap<>();
        for (var value : result.getAsJsonArray("occupancy")) {
            JsonObject row = value.getAsJsonObject();
            rows.put(new Address(row.get("trackId").getAsString(), row.get("row").getAsInt()), row.get("ref").getAsString());
        }
        return rows;
    }
    private static void noOccupancy(JsonObject result, String reason) {
        noOutput(result);
        check(!result.get("occupancyAdmitted").getAsBoolean() && !result.has("occupancy"), "refused occupancy has no rows: " + result.get("reason"));
        check(result.get("reason").getAsString().equals(reason), "occupancy refusal is " + reason + ", not " + result.get("reason"));
    }

    private static void slotAdmits() throws Exception {
        SlotFixture s = slotFixture(); Fixture f = s.f();
        JsonObject published = f.probe.inventory(null);
        check(!published.get("registryPublished").getAsBoolean() && published.get("registryPendingSlotConfirmation").getAsBoolean()
            && !published.get("inventoryEnumerated").getAsBoolean(), "a complete scan stays pending inside its read callback");
        noOccupancy(f.probe.inventoryList(null), "slot-window-pending");
        f.host.runTasks();
        JsonObject list = f.probe.inventoryList(null);
        check(list.get("occupancyAdmitted").getAsBoolean() && list.get("registryPublished").getAsBoolean(), "a later confirmation admits occupancy");
        check(listed(list).keySet().equals(s.slots().occupied), "published occupancy equals the source");
        check(!list.get("clipIdentityClaimed").getAsBoolean() && !list.get("clipIdentityFromOccupancy").getAsBoolean()
            && !list.get("complete").getAsBoolean() && !list.get("eligible").getAsBoolean(), "occupancy claims no identity or eligibility");
        check(list.get("slotWindowConfirmations").getAsLong() == 1, "one confirmation admits one read");
    }

    private static void slotDuringEnumeration() throws Exception {
        SlotFixture s = slotFixture(); Fixture f = s.f();
        f.probe.beginInventoryRebuild(null);
        f.probe.pollInventoryRebuild(null, 4);
        s.slots().callback(new Address("B", 7), true);
        JsonObject result = f.probe.pollInventoryRebuild(null, 64);
        check(!result.get("registryPublished").getAsBoolean() && result.get("fallbackReason").getAsString().equals("slot-window-changed"),
            "a slot callback during enumeration refuses");
        f.host.runTasks();
        noOccupancy(f.probe.inventoryList(null), "slot-window-changed");
        long reads = s.slots().reads;
        f.probe.pollInventoryRebuild(null);
        check(s.slots().reads == reads, "a refused attempt cannot resume or retry");
        f.probe.rebuildInventory(null); f.host.runTasks();
        JsonObject recovered = f.probe.inventoryList(null);
        check(recovered.get("occupancyAdmitted").getAsBoolean() && listed(recovered).containsKey(new Address("B", 7)),
            "an explicit new attempt reads the new occupancy");
    }

    private static void slotMidBatch() throws Exception {
        SlotFixture s = slotFixture(); Fixture f = s.f();
        // The read runs between the two halves of one batch: Q occupancy appears, then P returns.
        Address foreign = new Address("B", 3);
        s.slots().set(foreign, true); s.slots().set(new Address("A", 0), false);
        JsonObject read = f.probe.inventory(null);
        check(read.get("registryPendingSlotConfirmation").getAsBoolean(), "the foreign read is still pending");
        s.slots().callback(new Address("A", 0), false); s.slots().callback(foreign, true);
        s.slots().callback(foreign, false); s.slots().callback(new Address("A", 0), true);
        f.host.runTasks();
        noOccupancy(f.probe.inventoryList(null), "slot-window-changed");
        check(f.probe.info().get("slotWindowRefusals").getAsLong() == 1, "the refusal is counted once");
    }

    private static void slotStructure() throws Exception {
        SlotFixture s = slotFixture(); Fixture f = s.f();
        f.probe.inventory(null);
        s.slots().structureCallbacks++;
        f.host.runTasks();
        noOccupancy(f.probe.inventoryList(null), "slot-window-changed");
        f.probe.rebuildInventory(null);
        f.host.runTasks();
        check(f.probe.inventoryList(null).get("occupancyAdmitted").getAsBoolean(), "explicit recovery confirms a new window");
        s.slots().structureCallbacks++;
        noOccupancy(f.probe.inventoryList(null), "slot-window-changed");
    }

    private static void slotRetained() throws Exception {
        SlotFixture s = slotFixture(); Fixture f = s.f();
        f.probe.inventory(null); f.host.runTasks();
        java.util.Map<Address, String> first = listed(f.probe.inventoryList(null));
        s.slots().callback(new Address("A", 0), false);
        noOccupancy(f.probe.inventoryList(null), "slot-window-changed");
        check(!f.probe.info().get("registryPublished").getAsBoolean(), "retained occupancy is discarded");
        // A late confirmation from the old read cannot revive the publication.
        f.host.runTasks();
        noOccupancy(f.probe.inventoryList(null), "slot-window-changed");
        s.slots().callback(new Address("A", 0), true);
        f.probe.rebuildInventory(null); f.host.runTasks();
        java.util.Map<Address, String> second = listed(f.probe.inventoryList(null));
        check(second.keySet().equals(first.keySet()), "equal occupancy returns");
        for (Address address : first.keySet())
            check(!first.get(address).equals(second.get(address)), "each rebuild mints new references at equal occupancy");
    }

    private static void slotRecreateBoundary() throws Exception {
        SlotFixture s = slotFixture(); Fixture f = s.f();
        f.probe.inventory(null); f.host.runTasks();
        java.util.Map<Address, String> first = listed(f.probe.inventoryList(null));
        // A coalesced delete and recreate leaves equal occupancy and no callback. Occupancy stays correct.
        s.slots().set(new Address("A", 0), false); s.slots().set(new Address("A", 0), true);
        JsonObject same = f.probe.inventoryList(null);
        check(same.get("occupancyAdmitted").getAsBoolean() && listed(same).equals(first),
            "equal occupancy without a callback is still correct occupancy");
        check(!same.get("clipIdentityClaimed").getAsBoolean(), "the publication claims no identity across the recreate");
        f.probe.rebuildInventory(null); f.host.runTasks();
        check(!listed(f.probe.inventoryList(null)).get(new Address("A", 0)).equals(first.get(new Address("A", 0))),
            "a new rebuild mints a new reference; it is never inferred from equal occupancy");
        // A changed occupancy without a callback is the documented assumption boundary, not a defect.
        s.slots().set(new Address("C", 6), true);
        JsonObject boundary = f.probe.inventoryList(null);
        check(boundary.get("occupancyAdmitted").getAsBoolean() && !listed(boundary).containsKey(new Address("C", 6)),
            "an occupancy change without a callback is outside the window guarantee");
    }

    private static void slotRefusals() throws Exception {
        SlotFixture s = slotFixture(); Fixture f = s.f();
        s.slots().refusal = "slot-coverage-track-limit";
        JsonObject refused = f.probe.inventory(null);
        check(refused.get("reason").getAsString().equals("slot-coverage-track-limit") && !refused.get("registryPublished").getAsBoolean(),
            "incomplete slot coverage refuses");
        check(!f.probe.inventoryList(null).has("occupancy"), "incomplete coverage lists nothing");
        s.slots().refusal = null;
        f.probe.inventory(null); f.host.runTasks();
        check(f.probe.inventoryList(null).get("occupancyAdmitted").getAsBoolean(), "complete coverage admits again");
        f.probe.lifecycle("switch");
        noOccupancy(f.probe.inventoryList(null), f.probe.info().get("fallbackReason").getAsString());
        check(f.cache().diagnostics().entries() == 0, "a lifecycle change removes occupancy");
        Fixture plain = new Fixture();
        ShadowCacheProbe live = new ShadowCacheProbe(plain.host.host(), plain.config);
        live.attachSlotSource(new FakeSlots());
        noOutput(live.inventory(null));
        check(!live.info().get("registryPublished").getAsBoolean(), "a slot source without an identity probe still refuses");
    }

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

    private static void identityNoChain() {
        Fixture f = new Fixture(); IdentityHost h = new IdentityHost(); h.value(CHAIN_EXISTS).current = false;
        RootIdentityProbe root = h.probe(); f.probe.attachIdentityProbe(root);
        check(!root.identityGuard().witnessAvailable(), "empty witness window stays unknown");
        for (JsonObject result : List.of(f.probe.point(0, f.a, 0), f.probe.point(0, f.a, 0, f.b, 0),
            f.probe.acquire(f.a, 0), f.probe.exactStart(f.a, 0))) {
            check(result.get("reason").getAsString().equals("identity-witness-unavailable")
                && !result.get("authorityAvailable").getAsBoolean(), "no-chain refuses all acquisition routes");
        }
        check(f.cache().diagnostics().resident() == 0, "forced replay cannot create a no-chain residence");
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
        String inputWindow = "model-input-window-0";
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
            return probe(true);
        }
        RootIdentityProbe stepProbe() {
            return new RootIdentityProbe(node(ControllerHost.class, "host"), "init-identity-test", node(Project.class, "project"),
                node(Application.class, "application"), () -> StepDeltaWindow.PROTOCOL, true);
        }
        RootIdentityProbe probe(boolean fenced) {
            if (!fenced) return new RootIdentityProbe(node(ControllerHost.class, "host"), "init-identity-test",
                node(Project.class, "project"), node(Application.class, "application"));
            return new RootIdentityProbe(node(ControllerHost.class, "host"), "init-identity-test", node(Project.class, "project"),
                node(Application.class, "application"), () -> inputWindow);
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
            probe = new ShadowCacheProbe(host.host(), config, true);
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
                host.runTasks();
                JsonObject status = probe.poll(index);
                String phase = status.get("phase").getAsString();
                // A settled canary stays pending until its step window is confirmed.
                if ((phase.equals("settled") || phase.equals("complete")) && status.get("canaryPhase").getAsString().equals("target")) {
                    probe.reconcile(index); return;
                }
                check(!phase.equals("retired"), "binding remains live: " + status);
            }
            throw new AssertionError("binding did not settle");
        }

        JsonObject compare() throws Exception { return compare(0); }
        JsonObject compare(int index) throws Exception {
            JsonObject result = probe.compareStart(index);
            for (int attempt = 0; attempt < 80 && result.get("comparison").getAsString().equals("pending"); attempt++) {
                fastClock(probe);
                host.runTasks();
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
                host.runTasks();
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
        /** Scheduled tasks run only when a test runs a later host callback. */
        final java.util.ArrayDeque<Runnable> tasks = new java.util.ArrayDeque<>();
        void runTasks() { for (int n = tasks.size(); n > 0 && !tasks.isEmpty(); n--) tasks.removeFirst().run(); }

        ClipData clip(String track, int row) {
            return clips.computeIfAbsent(track + ":" + row, key -> new ClipData(track, row));
        }
        Track track(String id) { return proxy(Track.class, new Cursor(this, id, false), "track", false); }
        Cursor resident(int index) { return cursors.stream().filter(c -> c.id.contains("RESIDENT")).toList().get(index); }
        Cursor authority() { return cursors.stream().filter(c -> c.id.contains("AUTHORITY")).findFirst().orElseThrow(); }
        ControllerHost host() {
            return proxy(ControllerHost.class, (object, method, args) -> {
                if (method.getName().equals("scheduleTask")) { tasks.add((Runnable) args[0]); return null; }
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
        /** P->Q->P in one batch. The action runs between the two halves, like a mid-batch callback. */
        void detour(String track, int row, Map<Cell, Map<String, Object>> q, Runnable midBatch) {
            ClipData clip = clips.get(track + ":" + row);
            Map<Cell, Map<String, Object>> p = new LinkedHashMap<>(clip.notes);
            List<Cursor> bound = cursors.stream().filter(c -> c.target == clip).toList();
            clip.notes.clear(); clip.notes.putAll(q);
            for (Cursor c : bound) { p.keySet().forEach(cell -> c.emit(cell.x, cell.y, 0)); q.keySet().forEach(cell -> c.emit(cell.x, cell.y, 2)); }
            midBatch.run();
            clip.notes.clear(); clip.notes.putAll(p);
            for (Cursor c : bound) { q.keySet().forEach(cell -> c.emit(cell.x, cell.y, 0)); p.keySet().forEach(cell -> c.emit(cell.x, cell.y, 2)); }
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
        Runnable readHook, fieldHook, metadataHook, bindingHook, everyRead;
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
            if (name.equals("setIsSubscribed")) throw new IllegalStateException("deprecated since API version 10: subscription is counter based");
            if (name.equals("getStep")) {
                if (readHook != null) { Runnable hook = readHook; readHook = null; hook.run(); }
                if (everyRead != null) everyRead.run();
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
                if (property.equals("sceneIndex") && bindingHook != null) {
                    Runnable hook = bindingHook; bindingHook = null; hook.run();
                }
                if (property.equals("getLoopLength") && metadataHook != null && !reads.isEmpty()) {
                    Runnable hook = metadataHook; metadataHook = null; hook.run();
                }
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
