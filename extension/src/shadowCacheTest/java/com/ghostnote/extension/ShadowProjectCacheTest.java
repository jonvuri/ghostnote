package com.ghostnote.extension;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import static com.ghostnote.extension.ShadowProjectCache.*;

/** Host-independent tests for sparse cache publication and lifecycle rules. */
public final class ShadowProjectCacheTest {
    private static int passed;
    private static final Coverage FULL = coverage(0, 4096, Set.of("velocity"));
    private static final Coordinate CELL = new Coordinate(0, 60);
    private static final ReplayWitness SETTLED = new ReplayWitness(true, true, true, 1500, 10, 50);
    private static final class Fixture {
        final ShadowProjectCache cache;
        final Map<Coordinate, List<Note>> notes = new HashMap<>();
        final String ref;
        Fixture() { this(new ShadowProjectCache()); }
        Fixture(ShadowProjectCache cache) {
            this.cache = cache;
            ref = cache.create(new Address("track-a", 0), FULL);
            cache.admit(ref); cache.inventoryEnumerated();
        }
        void notes(Coordinate coordinate, List<Note> values) {
            notes.put(coordinate, values); cache.callback(ref, cache.bindingToken(ref), coordinate);
        }
        void drain() { cache.reconcile(ref, c -> notes.getOrDefault(c, List.of()), 2048, 50); }
        void ready() { drain(); check(cache.settleReplay(ref, SETTLED), "replay settles"); }
        Result snapshot() { return snapshot(FULL); }
        Result snapshot(Coverage request) {
            return cache.snapshot(ref, request, Map.of("name", "clip"), c -> notes.getOrDefault(c, List.of()), true, "test-authority");
        }
    }
    public static void main(String[] args) {
        run("empty clip and empty inventory", ShadowProjectCacheTest::empty);
        run("warm membership and all MIDI channels", ShadowProjectCacheTest::channels);
        run("dirty coalescing and zero-dirty eligibility", ShadowProjectCacheTest::dirty);
        run("sustain invalidation and note removal", ShadowProjectCacheTest::remove);
        run("callbacks during reconciliation", ShadowProjectCacheTest::reconcileRace);
        run("callbacks during enrichment", ShadowProjectCacheTest::snapshotRace);
        run("project change during reconciliation", ShadowProjectCacheTest::projectReadRace);
        run("field-only changes and duplicate callbacks", ShadowProjectCacheTest::fields);
        run("coverage overlap and unknown fields", ShadowProjectCacheTest::coverage);
        run("immutable snapshots and historical tokens", ShadowProjectCacheTest::immutable);
        run("typed shadow comparison categories", ShadowProjectCacheTest::comparison);
        run("replay prerequisites and timeout", ShadowProjectCacheTest::replay);
        run("scene and track repair", ShadowProjectCacheTest::repair);
        run("move identity and ambiguity", ShadowProjectCacheTest::move);
        run("replacement, save, project switch", ShadowProjectCacheTest::identity);
        run("reload separates snapshots, callbacks, and rebuild staging", ShadowProjectCacheTest::reloadDomain);
        run("identity guards reuse records and advance on domain changes", ShadowProjectCacheTest::identityQueries);
        run("eviction, width and tail budgets", ShadowProjectCacheTest::admission);
        run("pending backpressure requires rebuild", ShadowProjectCacheTest::pending);
        run("density overflow", ShadowProjectCacheTest::density);
        run("private rebuild, interruption and timeout", ShadowProjectCacheTest::rebuild);
        run("rebuild continuity, staged callbacks and partial inventory", ShadowProjectCacheTest::rebuildEvents);
        run("rewarm and rebuild content generations", ShadowProjectCacheTest::rewarm);
        run("resource failure and inventory changes during staging", ShadowProjectCacheTest::stagingFailure);
        run("structural domain reset", ShadowProjectCacheTest::reset);
        run("incremental enrichment memory budget", ShadowProjectCacheTest::enrichmentMemory);
        run("aggregate sparse memory budget", ShadowProjectCacheTest::memory);
        run("domain object census includes membership and staging", ShadowProjectCacheTest::census);
        run("duration normalization boundaries", ShadowProjectCacheTest::duration);
        run("invalid counters and finite measurements", ShadowProjectCacheTest::invalid);
        System.out.println("Shadow cache: " + passed + " test groups passed.");
    }
    private static void empty() {
        ShadowProjectCache cache = new ShadowProjectCache();
        check(cache.diagnostics().health() == Health.PARTIAL, "unproved empty inventory");
        cache.inventoryEnumerated(); check(cache.diagnostics().health() == Health.COMPLETE, "proved empty inventory");
        Fixture f = new Fixture(); check(f.snapshot().snapshot() == null, "warming is not complete");
        f.ready(); check(f.snapshot().snapshot().notes().isEmpty(), "empty existing clip");
        check(f.cache.clipAt(new Address("track-b", 0)) == null, "absent slot is not empty clip");
    }
    private static void channels() {
        Fixture f = new Fixture(); List<Note> notes = new ArrayList<>();
        for (int channel = 0; channel < 16; channel++) notes.add(note(channel, CELL, .5));
        f.notes(CELL, notes); f.notes(new Coordinate(4095, 127), List.of(note(15, new Coordinate(4095, 127), .75)));
        f.ready(); Snapshot snapshot = f.snapshot().snapshot();
        check(snapshot.notes().size() == 17 && f.cache.occupiedCoordinates(f.ref) == 2, "coordinate counts differ from notes");
        check(f.cache.diagnostics().recorderEstimatedBytes() == 256 + 56 * 2, "sparse membership estimate");
        check(f.cache.diagnostics().retainedSnapshotEstimatedBytes() > 0, "payload estimate is separate");
        check(f.cache.compare(snapshot, FULL, snapshot.metadata(), snapshot.notes()).equals("match"), "all-channel comparison");
    }
    private static void dirty() {
        Fixture f = populated(); long generation = f.cache.contentGeneration(f.ref);
        for (int i = 0; i < 100; i++) f.cache.callback(f.ref, f.cache.bindingToken(f.ref), CELL);
        check(f.cache.diagnostics().pendingCoordinates() == 1, "callbacks coalesce");
        check(f.cache.diagnostics().recorderEstimatedBytes() == 256 + 56 * 2, "occupied and dirty both consume memory");
        check(f.snapshot().snapshot() == null, "positive pending count cannot publish");
        f.drain(); check(f.cache.contentGeneration(f.ref) == generation, "duplicate callbacks do not change content");
        check(f.snapshot().snapshot() != null, "reconciled snapshot publishes");
    }
    private static void remove() {
        Fixture f = populated(); f.notes(CELL, List.of()); f.drain();
        check(f.cache.occupiedCoordinates(f.ref) == 0 && f.snapshot().snapshot().notes().isEmpty(), "sustain or empty cell is not NoteOn");
    }
    private static void reconcileRace() {
        Fixture f = populated(); f.cache.callback(f.ref, f.cache.bindingToken(f.ref), CELL);
        f.cache.reconcile(f.ref, c -> { f.cache.callback(f.ref, f.cache.bindingToken(f.ref), c); return f.notes.get(c); }, 1, 50);
        check(f.cache.diagnostics().pendingCoordinates() == 1, "new callback survives drain"); f.drain();
        check(f.snapshot().snapshot() != null, "next drain completes");
    }
    private static void snapshotRace() {
        Fixture f = populated();
        Result result = f.cache.snapshot(f.ref, FULL, Map.of(), c -> {
            f.cache.callback(f.ref, f.cache.bindingToken(f.ref), c); return f.notes.get(c);
        }, true, "race");
        check(result.snapshot() == null && result.reason().equals("window-changed"), "enrichment race discards candidate");
    }
    private static void projectReadRace() {
        Fixture f = populated(); f.cache.callback(f.ref, f.cache.bindingToken(f.ref), CELL);
        f.cache.reconcile(f.ref, c -> { f.cache.projectChanged(); return f.notes.get(c); }, 10, 50);
        check(f.cache.diagnostics().entries() == 0, "old read cannot restore new project");
    }
    private static void fields() {
        Fixture f = populated(); Snapshot first = f.snapshot().snapshot();
        f.notes(CELL, List.of(note(0, CELL, .9))); f.drain(); Snapshot second = f.snapshot().snapshot();
        check(second.contentGeneration() > first.contentGeneration(), "field change advances content after proof");
        check(!f.cache.isCurrent(first), "old field snapshot is historical");
        f.cache.callback(f.ref, f.cache.bindingToken(f.ref), CELL); f.drain();
        check(f.snapshot().snapshot().contentGeneration() == second.contentGeneration(), "duplicate field callback does not advance content");
    }
    private static void coverage() {
        Fixture f = populated(); Snapshot before = f.snapshot().snapshot();
        Coverage narrow = coverage(0, 1, Set.of("velocity"));
        f.notes(CELL, List.of(note(0, CELL, .1))); f.drain();
        check(f.snapshot(narrow).snapshot().contentGeneration() > before.contentGeneration(), "changed overlap advances generation");
        check(f.snapshot(coverage(0, 4097, Set.of("velocity"))).snapshot() == null, "uncovered span rejected");
        check(f.snapshot(coverage(0, 4096, Set.of("pressure"))).snapshot() == null, "unknown field rejected");
        f.notes(CELL, List.of(new Note(0, 0, 60, Map.of()))); f.drain();
        check(f.snapshot().health() == Health.PARTIAL, "missing enriched field is partial");
    }
    private static void immutable() {
        Fixture f = populated(); Snapshot snapshot = f.snapshot().snapshot();
        expect(UnsupportedOperationException.class, () -> snapshot.notes().clear());
        expect(UnsupportedOperationException.class, () -> snapshot.notes().get(0).fields().put("velocity", .1));
        CallbackToken old = f.cache.bindingToken(f.ref); f.cache.evict(f.ref); f.cache.admit(f.ref);
        check(!f.cache.callback(f.ref, old, CELL) && !f.cache.isCurrent(snapshot), "eviction retires callback and snapshot");
        check(snapshot.notes().size() == 1, "historical snapshot does not mutate");
    }
    private static void comparison() {
        Fixture f = populated(); Snapshot snapshot = f.snapshot().snapshot();
        check(f.cache.compare(snapshot, coverage(0, 1, Set.of("velocity")), snapshot.metadata(), snapshot.notes()).equals("coverage-mismatch"), "coverage mismatch");
        check(f.cache.compare(snapshot, FULL, Map.of("name", "other"), snapshot.notes()).equals("metadata-mismatch"), "metadata mismatch");
        check(f.cache.compare(snapshot, FULL, snapshot.metadata(), List.of()).equals("membership-mismatch"), "membership mismatch");
        check(f.cache.compare(snapshot, FULL, snapshot.metadata(), List.of(note(0, CELL, .2))).equals("field-mismatch"), "field mismatch");
    }
    private static void replay() {
        Fixture f = new Fixture();
        check(!f.cache.settleReplay(f.ref, new ReplayWitness(false, true, true, 1500, 10, 50)), "quiet target lacks canary proof");
        check(!f.cache.settleReplay(f.ref, new ReplayWitness(true, true, true, 1499, 10, 50)), "elapsed settlement gate");
        check(!f.cache.settleReplay(f.ref, new ReplayWitness(true, true, true, 1500, 9, 50)), "poll settlement gate");
        check(!f.cache.settleReplay(f.ref, new ReplayWitness(true, true, true, 5001, 10, 50)), "replay timeout");
        check(f.cache.bindingToken(f.ref) == null, "timeout retires observer token");
    }
    private static void repair() {
        Fixture f = populated(); CallbackToken token = f.cache.bindingToken(f.ref);
        String other = f.cache.create(new Address("track-b", 0), FULL); f.cache.admit(other);
        f.cache.repairScene(0, true);
        check(f.cache.address(f.ref).row() == 1 && f.cache.address(other).row() == 1, "scene rows shift");
        check(!f.cache.callback(f.ref, token, CELL), "epoch invalidates unmoved binding");
        f.cache.admit(f.ref); CallbackToken repaired = f.cache.bindingToken(f.ref);
        f.cache.repairTrackIndex("track-a", true); check(!f.cache.callback(f.ref, repaired, CELL), "track repair changes token");
        f.cache.repairScene(1, false); check(f.cache.diagnostics().entries() == 0, "deleted row retires identities");
    }
    private static void move() {
        Fixture f = populated(); Snapshot snapshot = f.snapshot().snapshot();
        check(f.cache.exactMove(f.ref, new Address("track-b", 2), true, true, true, snapshot.fingerprint()), "proved move retains ID");
        check(f.cache.clipAt(new Address("track-b", 2)).equals(f.ref), "move current address");
        Fixture ambiguous = populated();
        check(!ambiguous.cache.exactMove(ambiguous.ref, new Address("track-b", 2), false, true, true, "same"), "unproved move rejected");
        check(ambiguous.cache.diagnostics().health() == Health.AMBIGUOUS, "ambiguity explicit");
    }
    private static void identity() {
        Fixture f = populated(); CallbackToken token = f.cache.bindingToken(f.ref);
        f.cache.save(); check(f.cache.bindingToken(f.ref).equals(token), "save keeps identity domain");
        String replacement = f.cache.replace(new Address("track-a", 0), FULL);
        check(!replacement.equals(f.ref) && !f.cache.callback(f.ref, token, CELL), "replacement mints ID and rejects late callback");
        long project = f.cache.diagnostics().projectGeneration(); f.cache.projectChanged(); f.cache.projectChanged();
        check(f.cache.diagnostics().projectGeneration() == project + 2, "switch back is new generation");
    }
    private static void reloadDomain() {
        Fixture before = new Fixture(new ShadowProjectCache("init-before"));
        Fixture after = new Fixture(new ShadowProjectCache("init-after"));
        for (Fixture fixture : List.of(before, after)) {
            fixture.notes(CELL, List.of(note(0, CELL, .5))); fixture.ready();
        }
        Snapshot old = before.snapshot().snapshot(), fresh = after.snapshot().snapshot();
        check(old.token().project() == fresh.token().project() && old.token().structure() == fresh.token().structure()
            && old.token().binding() == fresh.token().binding() && old.token().rebuild() == fresh.token().rebuild(),
            "reload test repeats every local token counter");
        check(old.fingerprint().equals(fresh.fingerprint()) && !old.clipRef().equals(fresh.clipRef()),
            "equal content after reload has a fresh logical reference");
        check(!after.cache.isCurrent(old) && after.cache.isCurrent(fresh), "old snapshot cannot cross reload");
        Snapshot wrongToken = new Snapshot(fresh.clipRef(), fresh.address(), old.token(), fresh.contentGeneration(),
            fresh.invalidationSequence(), fresh.coverage(), fresh.metadata(), fresh.notes(), fresh.fingerprint(),
            fresh.payloadEstimatedBytes(), fresh.acquisitionWitness());
        check(!after.cache.isCurrent(wrongToken), "token domain rejects a snapshot even with the fresh reference");
        check(!after.cache.callback(after.ref, old.token(), CELL)
            && after.cache.diagnostics().pendingCoordinates() == 0, "old callback cannot dirty a fresh reference");
        RebuildToken stale = before.cache.beginRebuild(), current = after.cache.beginRebuild();
        check(stale.project() == current.project() && stale.structure() == current.structure()
            && stale.rebuild() == current.rebuild(), "reload test repeats every rebuild counter");
        expect(IllegalStateException.class, () -> after.cache.stage(stale, fresh.address(), FULL,
            fresh.notes(), true, true, false, null));
        expect(IllegalStateException.class, () -> after.cache.stageNonResident(stale, fresh.address(), FULL));
        check(!after.cache.publishRebuild(stale, true, 1), "old rebuild cannot publish");
        after.cache.abortRebuild(stale, "stale-abort");
        after.cache.stage(current, fresh.address(), FULL, fresh.notes(), true, true, false, null);
        check(after.cache.publishRebuild(current, true, 1), "old rebuild cannot abort fresh staging");
        check(!new ShadowProjectCache().diagnostics().initDomain().equals(new ShadowProjectCache().diagnostics().initDomain()),
            "production construction mints a fresh init domain");
    }
    private static void identityQueries() {
        ShadowProjectCache cache = new ShadowProjectCache("guard-test");
        IdentityDomain first = cache.identityDomain(); long version = cache.identityWindowVersion();
        check(first == cache.identityDomain() && version == cache.identityWindowVersion(), "unchanged guard reads reuse the same record");
        cache.save();
        check(first == cache.identityDomain() && version == cache.identityWindowVersion(), "save preserves the identity window");
        cache.projectChanged();
        IdentityDomain changed = cache.identityDomain();
        check(changed != first && first.project() == 1 && changed.project() == 2
            && cache.identityWindowVersion() > version, "project changes advance the guard without mutating its prior record");
        version = cache.identityWindowVersion(); cache.resetInventoryForUnknownStructure("test-structure");
        check(cache.identityWindowVersion() > version, "structure changes advance the window");
        version = cache.identityWindowVersion(); RebuildToken token = cache.beginRebuild();
        check(cache.identityWindowVersion() > version, "rebuild starts advance the window");
        version = cache.identityWindowVersion(); cache.abortRebuild(token, "test-abort");
        check(cache.identityWindowVersion() > version, "rebuild aborts advance the window");
        IdentityDomain afterAbort = cache.identityDomain();
        check(afterAbort == cache.identityDomain() && afterAbort.initDomain().equals("guard-test"), "final guard reads reuse the new record");
        check(!first.equals(new ShadowProjectCache("reload-guard").identityDomain()), "matching counters in a fresh init domain remain distinct");
    }
    private static void admission() {
        ShadowProjectCache cache = new ShadowProjectCache(); List<String> refs = new ArrayList<>();
        for (int i = 0; i <= 512; i++) refs.add(cache.create(new Address("track-a", i), FULL));
        for (String ref : refs) check(cache.admit(ref), "observer admission bounded by LRU eviction");
        check(cache.diagnostics().resident() == 512 && cache.clipReason(refs.get(0)).equals("evicted"), "deterministic eviction");
        String tooWide = cache.create(new Address("track-b", 0), coverage(0, MAX_WIDTH + 1, Set.of()));
        check(!cache.admit(tooWide) && cache.clipHealth(tooWide) == Health.OVERFLOW, "width overflow");
        cache.measurements(50, 50); check(cache.admit(refs.get(0)), "threshold equality allowed");
        cache.measurements(50, 50.01); check(cache.diagnostics().resident() == 0 && !cache.admit(refs.get(0)), "tail budget sheds load");
    }
    private static void pending() {
        Fixture f = new Fixture(); CallbackToken token = f.cache.bindingToken(f.ref);
        for (int i = 0; i < 2048; i++) check(f.cache.callback(f.ref, token, new Coordinate(i, 0)), "queue equality allowed");
        check(!f.cache.callback(f.ref, token, new Coordinate(2048, 0)), "queue overflow");
        check(f.cache.diagnostics().resident() == 0 && !f.cache.admit(f.ref), "backpressure requires rebuild");
        check(!f.cache.callback(f.ref, token, CELL), "shed callbacks rejected");
    }
    private static void density() {
        Fixture f = new Fixture();
        for (int i = 0; i < 2048; i++) { Coordinate c = new Coordinate(i, 0); f.notes(c, List.of(note(0, c, .5))); }
        while (f.cache.diagnostics().pendingCoordinates() > 0) f.drain();
        check(f.cache.occupiedCoordinates(f.ref) == 2048, "density equality allowed");
        Coordinate c = new Coordinate(2048, 0); f.notes(c, List.of(note(0, c, .5))); f.drain();
        check(f.cache.clipHealth(f.ref) == Health.OVERFLOW && f.cache.bindingToken(f.ref) == null, "density overflow retires binding");
    }
    private static void rebuild() {
        Fixture f = populated(); RebuildToken old = f.cache.beginRebuild();
        String staged = f.cache.stage(old, new Address("track-a", 0), FULL, f.notes.get(CELL), true, true, true, f.ref);
        check(f.cache.snapshot(staged, FULL, Map.of(), c -> f.notes.get(c), true, "stage").snapshot() == null, "staging stays private");
        check(f.cache.publishRebuild(old, true, 40_000), "rebuild budget equality allowed");
        RebuildToken expired = f.cache.beginRebuild(); f.cache.stage(expired, new Address("track-a", 0), FULL, List.of(), true, true, true, staged);
        check(!f.cache.publishRebuild(expired, true, 40_001), "rebuild expires");
        RebuildToken newer = f.cache.beginRebuild(); f.cache.stage(newer, new Address("track-a", 0), FULL, List.of(), true, true, false, null);
        check(!f.cache.publishRebuild(expired, true, 1), "old rebuild cannot publish or abort newer work");
        check(f.cache.publishRebuild(newer, true, 1), "newer work survives late completion");
    }
    private static void rebuildEvents() {
        Fixture f = populated(); RebuildToken rebuild = f.cache.beginRebuild();
        String continuous = f.cache.stage(rebuild, new Address("track-a", 0), FULL, f.notes.get(CELL), true, true, true, f.ref);
        check(continuous.equals(f.ref), "complete same-address window keeps ID");
        check(f.cache.callback(continuous, f.cache.bindingToken(continuous), CELL), "staged callback invalidates candidate");
        check(!f.cache.publishRebuild(rebuild, true, 1), "dirty staged candidate cannot publish");
        RebuildToken next = f.cache.beginRebuild();
        String resident = f.cache.stage(next, new Address("track-a", 0), FULL, List.of(), true, true, false, f.ref);
        String nonResident = f.cache.stageNonResident(next, new Address("track-b", 0), FULL);
        check(!resident.equals(f.ref), "gap mints new ID");
        check(f.cache.publishRebuild(next, true, 1), "bounded working set publishes registry");
        check(f.cache.diagnostics().health() == Health.PARTIAL && f.cache.clipHealth(nonResident) == Health.PARTIAL, "non-resident is explicit project partial");
    }
    private static void rewarm() {
        Fixture f = populated(); Snapshot before = f.snapshot().snapshot(); long content = before.contentGeneration();
        f.cache.evict(f.ref); f.cache.admit(f.ref); f.cache.callback(f.ref, f.cache.bindingToken(f.ref), CELL); f.ready();
        check(f.snapshot().snapshot().contentGeneration() == content, "unchanged rewarm retains content revision");
        RebuildToken token = f.cache.beginRebuild();
        String continuous = f.cache.stage(token, new Address("track-a", 0), FULL, List.of(), true, true, true, f.ref);
        check(f.cache.publishRebuild(token, true, 1), "changed continuous rebuild publishes");
        check(continuous.equals(f.ref) && f.cache.contentGeneration(continuous) > content, "changed membership advances continuous revision");
    }
    private static void stagingFailure() {
        ShadowProjectCache cache = new ShadowProjectCache(); RebuildToken token = cache.beginRebuild();
        String ref = cache.stage(token, new Address("track-a", 0), FULL, List.of(note(0, CELL, .5)), true, true, false, null);
        CallbackToken captured = cache.bindingToken(ref); cache.measurePing(51);
        check(cache.diagnostics().recorderEstimatedBytes() == 0 && !cache.publishRebuild(token, true, 1), "resource failure discards all staging");
        check(!cache.callback(ref, captured, CELL) && cache.diagnostics().health() == Health.INVALID, "discarded staging cannot claim complete");
        cache.measurements(0, 0); RebuildToken next = cache.beginRebuild();
        cache.stage(next, new Address("track-a", 0), FULL, List.of(), true, true, false, null);
        cache.create(new Address("track-b", 0), FULL);
        check(!cache.publishRebuild(next, true, 1), "inventory change invalidates old staged publication");
    }
    private static void reset() {
        Fixture f = populated(); CallbackToken old = f.cache.bindingToken(f.ref);
        long project = f.cache.diagnostics().projectGeneration(), structure = f.cache.diagnostics().structuralEpoch();
        f.cache.resetInventoryForUnknownStructure("unknown-topology");
        check(f.cache.diagnostics().entries() == 0 && f.cache.diagnostics().projectGeneration() == project
            && f.cache.diagnostics().structuralEpoch() > structure, "structure reset keeps project but retires registry");
        String fresh = f.cache.create(new Address("track-a", 0), FULL);
        check(!fresh.equals(f.ref) && f.cache.admit(fresh), "fresh inventory creates new identity");
        check(!f.cache.callback(f.ref, old, CELL), "old structural callback rejected");
        f.cache.measureConstruction(50); f.cache.measurePing(10);
        check(f.cache.diagnostics().constructionMs() == 50 && f.cache.diagnostics().pingP95Ms() == 10, "measurement wrappers retain independent values");
    }
    private static void enrichmentMemory() {
        Fixture f = new Fixture();
        for (int i = 0; i < 3; i++) { Coordinate c = new Coordinate(i, 60); f.notes(c, List.of(note(0, c, .5))); }
        f.ready(); String payload = "x".repeat(4_200_000); int[] reads = {0};
        Result result = f.cache.snapshot(f.ref, FULL, Map.of(), c -> {
            reads[0]++; return List.of(new Note(0, c.cell(), c.pitch(), Map.of("velocity", payload)));
        }, true, "memory");
        check(result.snapshot() == null && result.reason().equals("snapshot-memory-budget") && reads[0] == 2,
            "candidate enrichment stops at budget before visiting remaining coordinates");
        check(f.cache.diagnostics().retainedSnapshotEstimatedBytes() == 0, "oversized candidate is not retained");
    }
    private static void memory() {
        ShadowProjectCache cache = new ShadowProjectCache(); RebuildToken token = cache.beginRebuild();
        List<Note> dense = new ArrayList<>();
        for (int i = 0; i < 2048; i++) dense.add(note(0, new Coordinate(i, 0), .5));
        boolean exceeded = false;
        for (int i = 0; i < 200; i++) {
            try { cache.stage(token, new Address("track-a", i), FULL, dense, true, true, false, null); }
            catch (IllegalStateException error) { check(error.getMessage().equals("rebuild memory exceeded"), "sparse memory is limiting resource"); exceeded = true; break; }
        }
        check(exceeded && cache.diagnostics().recorderEstimatedBytes() <= MAX_RECORDER_BYTES, "aggregate memory limit has no silent overflow");
        cache.abortRebuild(token, "test-cleanup"); check(cache.diagnostics().recorderEstimatedBytes() == 0, "aborted staging released");
    }
    private static void census() {
        Fixture f = new Fixture(); List<Note> notes = new ArrayList<>();
        for (int channel = 0; channel < 16; channel++) notes.add(note(channel, CELL, .5));
        f.notes(CELL, notes); f.ready(); f.snapshot();
        f.cache.callback(f.ref, f.cache.bindingToken(f.ref), CELL);
        DomainObjectCensus census = f.cache.diagnostics().domainObjects();
        check(census.clipEntryRecords() == 1 && census.bindingTokenRecords() == 1, "entry and binding records");
        check(census.occupiedCoordinateEntries() == 1 && census.dirtyCoordinateEntries() == 1
            && census.occupiedNoteLists() == 1 && census.membershipNoteRecords() == 16, "sparse membership object census");
        check(census.retainedSnapshotRecords() == 1 && census.retainedNoteRecords() == 16
            && census.retainedFieldEntries() == 16 && census.retainedMetadataEntries() == 1, "enriched retained object census");
        check(census.witnessReferences() == 2 && census.identityAndWitnessEstimatedBytes() > 256, "identity estimate is separate");
        RebuildToken token = f.cache.beginRebuild();
        f.cache.stage(token, new Address("track-a", 0), FULL, notes, true, true, true, f.ref);
        DomainObjectCensus staged = f.cache.diagnostics().domainObjects();
        check(staged.clipEntryRecords() == 2 && staged.membershipNoteRecords() == 16 && staged.retainedSnapshotRecords() == 0,
            "private staging records remain visible in memory census");
        f.cache.abortRebuild(token, "census-cleanup");
        check(f.cache.diagnostics().domainObjects().membershipNoteRecords() == 0, "retired membership storage is released");
    }
    private static void duration() {
        check(ShadowProjectCache.normalizeDurationCells(Double.MIN_VALUE) == 1, "positive minimum duration");
        expect(IllegalArgumentException.class, () -> ShadowProjectCache.normalizeDurationCells(0.0));
        expect(IllegalArgumentException.class, () -> ShadowProjectCache.normalizeDurationCells(-0.0));
        check(ShadowProjectCache.normalizeDurationCells(1) == 512, "ordinary duration");
        double tie = 10.5 / 512;
        check(ShadowProjectCache.normalizeDurationCells(tie) == 11 && ShadowProjectCache.normalizeDurationCells(Math.nextUp(tie)) == 11
            && ShadowProjectCache.normalizeDurationCells(Math.nextDown(tie)) == 10, "duration tie neighborhood");
        long max = 9_007_199_254_740_991L;
        check(ShadowProjectCache.normalizeDurationCells(max / 512.0) == max, "maximum exact cell");
        expect(IllegalArgumentException.class, () -> ShadowProjectCache.normalizeDurationCells((max + 1) / 512.0));
        expect(IllegalArgumentException.class, () -> ShadowProjectCache.normalizeDurationCells(-1));
        expect(IllegalArgumentException.class, () -> ShadowProjectCache.normalizeDurationCells(Double.NaN));
        expect(IllegalArgumentException.class, () -> ShadowProjectCache.normalizeDurationCells(Double.POSITIVE_INFINITY));
    }
    private static void invalid() {
        expect(IllegalArgumentException.class, () -> new CallbackToken("test", -1, 0, 0, 0));
        expect(IllegalArgumentException.class, () -> new RebuildToken("test", 0, -1, 0));
        expect(IllegalArgumentException.class, () -> new CallbackToken(null, 0, 0, 0, 0));
        expect(IllegalArgumentException.class, () -> new RebuildToken("", 0, 0, 0));
        expect(IllegalArgumentException.class, () -> new ShadowProjectCache(""));
        expect(IllegalArgumentException.class, () -> new ReplayWitness(true, true, true, Double.NaN, 10, 50));
        expect(IllegalArgumentException.class, () -> new ShadowProjectCache().measurements(0, Double.POSITIVE_INFINITY));
        expect(IllegalArgumentException.class, () -> new Note(16, 0, 60, Map.of()));
        Fixture f = populated();
        expect(IllegalArgumentException.class, () -> f.cache.measurePing(Double.NaN));
        check(!f.cache.admit(f.ref) && f.cache.bindingToken(f.ref) == null, "invalid measurement blocks cache admission until recheck");
        f.cache.measurements(0, 0); check(f.cache.admit(f.ref), "finite recheck allows fresh binding");
        expect(IllegalArgumentException.class, () -> f.cache.reconcile(f.ref, c -> List.of(), 1, 51));
        String one = ShadowProjectCache.fingerprint(FULL, Map.of("a", 1, "b", 2), List.of(note(1, CELL, .1), note(0, CELL, .2)));
        String two = ShadowProjectCache.fingerprint(FULL, Map.of("b", 2, "a", 1), List.of(note(0, CELL, .2), note(1, CELL, .1)));
        check(one.equals(two), "deterministic fingerprint ordering");
    }
    private static Fixture populated() { Fixture f = new Fixture(); f.notes(CELL, List.of(note(0, CELL, .5))); f.ready(); return f; }
    private static Coverage coverage(long start, int width, Set<String> fields) { return new Coverage(start, width, true, fields, Set.of("portable-repeat"), "1/512-beat"); }
    private static Note note(int channel, Coordinate c, double velocity) { return new Note(channel, c.cell(), c.pitch(), Map.of("velocity", velocity)); }
    private static void check(boolean success, String message) { if (!success) throw new AssertionError(message); }
    private static void expect(Class<? extends Throwable> type, Runnable operation) {
        try { operation.run(); } catch (Throwable error) { if (type.isInstance(error)) return; throw new AssertionError("wrong exception", error); }
        throw new AssertionError("expected " + type.getSimpleName());
    }
    private static void run(String name, Runnable operation) {
        try { operation.run(); passed++; } catch (Throwable error) { throw new AssertionError(name, error); }
    }
}
