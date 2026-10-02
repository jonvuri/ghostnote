package com.ghostnote.extension;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.UUID;

/** Domain cache for experimental reads. It has no host handles or write authority. */
public final class ShadowProjectCache {
    public static final int MAX_WIDTH = 131_072;
    public static final int MAX_OBSERVERS = 512;
    public static final int MAX_OCCUPIED = 2_048;
    public static final int MAX_PENDING = 2_048;
    public static final long MAX_RECORDER_BYTES = 16L * 1024 * 1024;
    public static final long MAX_SNAPSHOT_BYTES = 16L * 1024 * 1024;
    public static final String FINGERPRINT_VERSION = "shadow-normalized-v1";
    public static final double GRID = 1.0 / 512;

    public enum Health { INVALID, REBUILDING, WARMING, COMPLETE, DIRTY, REPAIRING, PARTIAL, OVERFLOW, AMBIGUOUS }
    public record Address(String trackId, int row) {
        public Address {
            if (trackId == null || trackId.isEmpty() || row < 0) throw new IllegalArgumentException("invalid address");
        }
    }
    public record Coordinate(long cell, int pitch) implements Comparable<Coordinate> {
        public Coordinate {
            if (cell < 0 || pitch < 0 || pitch > 127) throw new IllegalArgumentException("invalid coordinate");
        }
        @Override public int compareTo(Coordinate other) {
            int cells = Long.compare(cell, other.cell);
            return cells != 0 ? cells : Integer.compare(pitch, other.pitch);
        }
    }
    public record CallbackToken(String initDomain, long project, long structure, long binding, long rebuild) {
        public CallbackToken { domain(initDomain); counter(project); counter(structure); counter(binding); counter(rebuild); }
    }
    public record Coverage(long startCell, int width, boolean allChannels, Set<String> fields,
                           Set<String> unsupportedFields, String timingBasis) {
        public Coverage {
            if (startCell < 0 || width < 1 || startCell > Long.MAX_VALUE - width)
                throw new IllegalArgumentException("invalid coverage");
            fields = Collections.unmodifiableSet(new TreeSet<>(fields));
            unsupportedFields = Collections.unmodifiableSet(new TreeSet<>(unsupportedFields));
            if (!Collections.disjoint(fields, unsupportedFields) || !"1/512-beat".equals(timingBasis))
                throw new IllegalArgumentException("invalid field or timing coverage");
        }
        public boolean contains(Coordinate coordinate) {
            return coordinate.cell >= startCell && coordinate.cell < startCell + width;
        }
        public boolean covers(Coverage request) {
            return startCell <= request.startCell && startCell + width >= request.startCell + request.width
                && allChannels && (!request.allChannels || allChannels)
                && fields.containsAll(request.fields) && unsupportedFields.containsAll(request.unsupportedFields);
        }
    }
    public record Note(int channel, long cell, int pitch, Map<String, Object> fields) {
        public Note {
            if (channel < 0 || channel > 15) throw new IllegalArgumentException("invalid MIDI channel");
            new Coordinate(cell, pitch);
            fields = immutableMap(fields);
        }
        public Coordinate coordinate() { return new Coordinate(cell, pitch); }
    }
    public record Snapshot(String clipRef, Address address, CallbackToken token, long contentGeneration,
                           long invalidationSequence, Coverage coverage, Map<String, Object> metadata,
                           List<Note> notes, String fingerprint, long payloadEstimatedBytes, String acquisitionWitness) {
        public Snapshot {
            counter(contentGeneration); counter(invalidationSequence); counter(payloadEstimatedBytes);
            metadata = immutableMap(metadata);
            notes = List.copyOf(notes);
        }
    }
    /** The adapter must read all 16 channels and return only NoteOn values. */
    @FunctionalInterface public interface Authority { List<Note> readCoordinate(Coordinate coordinate); }
    public record ReplayWitness(boolean populatedCanary, boolean targetBound, boolean freshAuthorityMatched,
                                double elapsedMs, int unchangedPolls, double minimumPollIntervalMs) {
        public ReplayWitness { measure(elapsedMs); measure(minimumPollIntervalMs); if (unchangedPolls < 0) throw new IllegalArgumentException("invalid polls"); }
        public boolean settled() {
            return populatedCanary && targetBound && freshAuthorityMatched && elapsedMs >= 1_500
                && elapsedMs <= 5_000 && unchangedPolls >= 10 && minimumPollIntervalMs >= 50;
        }
    }
    public record Result(Health health, String mode, String reason, Snapshot snapshot) {}
    public record RebuildToken(String initDomain, long project, long structure, long rebuild) {
        public RebuildToken { domain(initDomain); counter(project); counter(structure); counter(rebuild); }
    }
    public record IdentityDomain(String initDomain, long project, long structure, long rebuild) {
        public IdentityDomain { domain(initDomain); counter(project); counter(structure); counter(rebuild); }
    }
    public record Diagnostics(Health health, String reason, String initDomain, long projectGeneration, long structuralEpoch,
                              long rebuildGeneration, int entries, int resident, int warming, int dirty,
                              int occupiedCoordinates, int pendingCoordinates, long rejectedCallbacks,
                              long recorderEstimatedBytes, long retainedSnapshotEstimatedBytes, long retainedNoteRecords,
                              double constructionMs, double replayMs, double rebuildMs, double pingP95Ms,
                              long hits, long misses, long evictions, long invalidations, DomainObjectCensus domainObjects) {}
    /** Count cache-owned records and entries. Exclude transient copies, JVM overhead, and host objects. */
    public record DomainObjectCensus(long clipEntryRecords, long bindingTokenRecords, long occupiedCoordinateEntries,
                                    long dirtyCoordinateEntries, long membershipNoteRecords, long occupiedNoteLists,
                                    long retainedSnapshotRecords, long retainedNoteRecords, long retainedFieldEntries,
                                    long retainedMetadataEntries, long witnessReferences, long identityAndWitnessEstimatedBytes) {}

    private static final Comparator<Note> NOTE_ORDER = Comparator.comparingInt(Note::channel)
        .thenComparingLong(Note::cell).thenComparingInt(Note::pitch);
    private static final class Entry {
        final String ref;
        Address address;
        Coverage coverage;
        CallbackToken token;
        final Map<Coordinate, List<Note>> occupied = new HashMap<>();
        final Map<Coordinate, Long> dirty = new LinkedHashMap<>();
        Health health = Health.PARTIAL;
        String reason = "non-resident";
        boolean resident;
        boolean replay;
        boolean addressAssigned;
        long sequence;
        long content;
        long lastUsed;
        Snapshot retained;
        String membershipWitness;
        String snapshotWitness;
        Coverage snapshotCoverage;
        long snapshotContentGeneration;
        Entry(String ref, Address address, Coverage coverage) { this.ref = ref; this.address = address; this.coverage = coverage; }
    }
    private final Map<String, Entry> entries = new LinkedHashMap<>();
    private final Map<Address, String> slots = new HashMap<>();
    private final String initDomain;
    private IdentityDomain identityDomain;
    private Map<String, Entry> staging;
    private long project = 1, structure, binding, rebuild, nextId, clock, rejected, hits, misses, evictions, invalidations;
    private Health health = Health.PARTIAL;
    private String reason = "inventory-incomplete";
    private boolean inventoryComplete;
    private boolean eventGap;
    private boolean measurementsValid = true;
    private double constructionMs, replayMs, rebuildMs, pingP95Ms;
    private long rebuildStartedNanos;

    /** Start a fresh identity domain even if the local counters repeat after reload. */
    public ShadowProjectCache() { this(UUID.randomUUID().toString()); }
    ShadowProjectCache(String initDomain) { domain(initDomain); this.initDomain = initDomain; }

    /** Reuse the immutable guard while the identity domain remains current. */
    public IdentityDomain identityDomain() {
        if (identityDomain == null || identityDomain.project != project || identityDomain.structure != structure
            || identityDomain.rebuild != rebuild) identityDomain = new IdentityDomain(initDomain, project, structure, rebuild);
        return identityDomain;
    }

    /** All component counters increase. This checked sum needs no allocation or inventory walk. */
    public long identityWindowVersion() { return Math.addExact(project, Math.addExact(structure, rebuild)); }

    public String create(Address address, Coverage coverage) {
        if (staging != null) requireRebuild("inventory-changed-during-rebuild");
        if (slots.containsKey(address)) throw new IllegalArgumentException("occupied slot");
        String ref = mint();
        entries.put(ref, new Entry(ref, address, coverage)); slots.put(address, ref); refreshHealth();
        return ref;
    }
    public String replace(Address address, Coverage coverage) { deleteAt(address); return create(address, coverage); }
    public String clipAt(Address address) { return slots.get(address); }
    public boolean hasClip(String ref) { return entries.containsKey(ref); }
    public void delete(String ref) {
        if (staging != null) requireRebuild("inventory-changed-during-rebuild");
        Entry entry = entries.remove(ref);
        if (entry == null) return;
        retire(entry); slots.remove(entry.address); invalidations++; refreshHealth();
    }
    public void deleteAt(Address address) { String ref = slots.get(address); if (ref != null) delete(ref); }
    public void inventoryEnumerated() { inventoryComplete = true; refreshHealth(); }
    public void projectChanged() {
        project = increment(project); structure = increment(structure); rebuild = increment(rebuild);
        entries.values().forEach(this::retire); entries.clear(); slots.clear(); staging = null;
        inventoryComplete = false; eventGap = false; health = Health.INVALID; reason = "project-generation-changed";
    }
    public void save() { /* Save does not change the loaded identity domain. */ }
    public CallbackToken bindingToken(String ref) { return entry(ref).token; }
    public Health clipHealth(String ref) { return entry(ref).health; }
    public Address address(String ref) { return entry(ref).address; }
    public long contentGeneration(String ref) { return entry(ref).content; }
    public long invalidationSequence(String ref) { return entry(ref).sequence; }
    public int occupiedCoordinates(String ref) { return entry(ref).occupied.size(); }
    /** Confirm the first target of an unused observer without changing its callback token. */
    public void assignInitialAddress(String ref, Address address) {
        Entry entry = entry(ref);
        if (entry.addressAssigned || !entry.resident || entry.replay || !entry.dirty.isEmpty()
            || !entry.occupied.isEmpty() || (slots.containsKey(address) && !ref.equals(slots.get(address))))
            throw new IllegalStateException("initial address assignment is unavailable");
        slots.remove(entry.address); entry.address = address; slots.put(address, ref); entry.addressAssigned = true;
    }
    public void invalidate(String ref, String cause) { fail(entry(ref), Health.INVALID, cause); }
    public String clipReason(String ref) { return entry(ref).reason; }

    public boolean admit(String ref) {
        Entry candidate = entry(ref);
        if (candidate.resident) { candidate.lastUsed = increment(clock); clock = candidate.lastUsed; return true; }
        if (eventGap || staging != null || !measurementsValid || pingP95Ms > 50 || constructionMs > 50) return false;
        if (candidate.coverage.width > MAX_WIDTH) { fail(candidate, Health.OVERFLOW, "view-width-limit"); return false; }
        while (residentCount() >= MAX_OBSERVERS || recorderBytes() + 256 > MAX_RECORDER_BYTES) {
            Entry victim = entries.values().stream().filter(e -> e.resident)
                .min(Comparator.comparingLong((Entry e) -> e.lastUsed).thenComparing(e -> e.ref)).orElse(null);
            if (victim == null) return false;
            retire(victim); victim.health = Health.PARTIAL; victim.reason = "evicted"; evictions++;
        }
        candidate.resident = true; candidate.replay = false; candidate.token = token();
        candidate.health = Health.WARMING; candidate.reason = "replay-incomplete";
        candidate.lastUsed = increment(clock); clock = candidate.lastUsed; refreshHealth(); return true;
    }
    public void evict(String ref) {
        Entry entry = entry(ref); retire(entry); entry.health = Health.PARTIAL; entry.reason = "evicted"; evictions++; refreshHealth();
    }
    public boolean callback(String ref, CallbackToken captured, Coordinate coordinate) {
        Entry entry = staging != null && staging.containsKey(ref) ? staging.get(ref) : entries.get(ref);
        if (entry == null || !entry.resident || captured == null || !captured.equals(entry.token)
            || !current(captured) || !entry.coverage.contains(coordinate) || (eventGap && staging == null)) {
            rejected++; return false;
        }
        entry.sequence = increment(entry.sequence); entry.dirty.put(coordinate, entry.sequence); invalidations++;
        if (entry.replay) entry.health = Health.DIRTY;
        entry.reason = "dirty-coordinates";
        if (pendingCount() > MAX_PENDING) { requireRebuild("dirty-backpressure"); health = Health.REBUILDING; return false; }
        if (recorderBytes() + stagingBytes() > MAX_RECORDER_BYTES) { shedAll(Health.OVERFLOW, "memory-budget"); return false; }
        refreshHealth(); return true;
    }
    public boolean settleReplay(String ref, ReplayWitness witness) {
        Entry entry = entry(ref); replayMs = witness.elapsedMs;
        if (!entry.resident || !current(entry.token)) return false;
        if (witness.elapsedMs > 5_000) { retire(entry); entry.health = Health.WARMING; entry.reason = "replay-budget"; refreshHealth(); return false; }
        if (!witness.settled() || !entry.dirty.isEmpty()) return false;
        String membership = membershipFingerprint(entry);
        if (entry.membershipWitness != null && !entry.membershipWitness.equals(membership)) entry.content = increment(entry.content);
        entry.membershipWitness = membership;
        entry.replay = true; entry.health = Health.COMPLETE; entry.reason = "within-budget"; refreshHealth(); return true;
    }
    /** Reconcile a bounded batch. A callback during a read leaves its coordinate dirty. */
    public int reconcile(String ref, Authority authority, int maximumCoordinates, double budgetMs) {
        if (maximumCoordinates < 1) throw new IllegalArgumentException("invalid batch size");
        measure(budgetMs); if (budgetMs > 50) throw new IllegalArgumentException("host-work budget exceeds 50 ms");
        Entry entry = entry(ref); if (!entry.resident || !current(entry.token)) return 0;
        long started = System.nanoTime(); int done = 0;
        for (Map.Entry<Coordinate, Long> work : new ArrayList<>(entry.dirty.entrySet())) {
            if (done >= maximumCoordinates || elapsed(started) >= budgetMs) break;
            CallbackToken captured = entry.token; long sequence = entry.sequence;
            List<Note> notes;
            try { notes = validateNotes(authority.readCoordinate(work.getKey()), work.getKey(), Set.of()); }
            catch (RuntimeException error) { fail(entry, Health.INVALID, "authority-unavailable"); return done; }
            if (!captured.equals(entry.token) || !current(captured)) return done;
            if (elapsed(started) > budgetMs) { fail(entry, Health.INVALID, "reconciliation-budget"); return done; }
            if (entry.sequence != sequence) continue;
            List<Note> membership = notes.stream().map(n -> new Note(n.channel, n.cell, n.pitch, Map.of())).toList();
            List<Note> previous = entry.occupied.getOrDefault(work.getKey(), List.of());
            if (!previous.equals(membership) && entry.replay) { entry.content = increment(entry.content); entry.retained = null; }
            if (membership.isEmpty()) entry.occupied.remove(work.getKey()); else entry.occupied.put(work.getKey(), membership);
            entry.dirty.remove(work.getKey(), work.getValue()); done++;
            if (entry.occupied.size() > MAX_OCCUPIED) { fail(entry, Health.OVERFLOW, "clip-density-limit"); return done; }
            if (recorderBytes() + stagingBytes() > MAX_RECORDER_BYTES) { shedAll(Health.OVERFLOW, "memory-budget"); return done; }
        }
        entry.health = entry.dirty.isEmpty() ? (entry.replay ? Health.COMPLETE : Health.WARMING) : (entry.replay ? Health.DIRTY : Health.WARMING);
        entry.reason = entry.health == Health.COMPLETE ? "within-budget" : "replay-or-dirty-incomplete";
        if (entry.replay && entry.dirty.isEmpty()) entry.membershipWitness = membershipFingerprint(entry);
        refreshHealth(); return done;
    }

    /** Acquire requested fields only at occupied coordinates. Publication needs zero dirty work. */
    public Result snapshot(String ref, Coverage request, Map<String, Object> metadata, Authority authority,
                           boolean authorityAvailable, String acquisitionWitness) {
        Entry entry = entry(ref);
        String refusal = eligibility(entry, request);
        if (refusal != null) { misses++; return fallback(entry, refusal, authorityAvailable); }
        CallbackToken captured = entry.token; long sequence = entry.sequence;
        Map<String, Object> frozenMetadata = immutableMap(metadata);
        long bytes = payloadEstimate(frozenMetadata, List.of(), request);
        long otherRetainedBytes = retainedBytes() - (entry.retained == null ? 0 : entry.retained.payloadEstimatedBytes);
        if (bytes > MAX_SNAPSHOT_BYTES || otherRetainedBytes + bytes > MAX_SNAPSHOT_BYTES)
            return fallback(entry, "snapshot-memory-budget", authorityAvailable);
        List<Note> notes = new ArrayList<>(); long started = System.nanoTime();
        try {
            for (Coordinate coordinate : new TreeSet<>(entry.occupied.keySet())) {
                if (!request.contains(coordinate)) continue;
                if (elapsed(started) > 50) return fallback(entry, "enrichment-budget", authorityAvailable);
                List<Note> enriched = validateNotes(authority.readCoordinate(coordinate), coordinate, request.fields);
                List<Note> membership = enriched.stream().map(n -> new Note(n.channel, n.cell, n.pitch, Map.of())).toList();
                if (!membership.equals(entry.occupied.get(coordinate))) {
                    callback(ref, captured, coordinate); return fallback(entry, "authority-membership-mismatch", authorityAvailable);
                }
                for (Note note : enriched) {
                    Map<String, Object> fields = new TreeMap<>();
                    for (String field : request.fields) fields.put(field, note.fields.get(field));
                    long noteBytes = 128L + 2L * canonicalLength(fields);
                    if (noteBytes > MAX_SNAPSHOT_BYTES - bytes || otherRetainedBytes + bytes + noteBytes > MAX_SNAPSHOT_BYTES)
                        return fallback(entry, "snapshot-memory-budget", authorityAvailable);
                    bytes += noteBytes;
                    notes.add(new Note(note.channel, note.cell, note.pitch, fields));
                }
            }
        } catch (MissingField error) { return new Result(Health.PARTIAL, authorityAvailable ? "exact-fallback" : "refuse", authorityAvailable ? "field-coverage-incomplete" : "authority-unavailable", null); }
        catch (RuntimeException error) { fail(entry, Health.INVALID, "authority-unavailable"); return fallback(entry, "authority-unavailable", false); }
        if (elapsed(started) > 50) return fallback(entry, "enrichment-budget", authorityAvailable);
        if (!captured.equals(entry.token) || !current(captured) || sequence != entry.sequence || !entry.dirty.isEmpty())
            return fallback(entry, "window-changed", authorityAvailable);
        notes.sort(NOTE_ORDER);
        String fingerprint = fingerprint(request, frozenMetadata, notes);
        if (bytes > MAX_SNAPSHOT_BYTES || retainedBytes() - (entry.retained == null ? 0 : entry.retained.payloadEstimatedBytes) + bytes > MAX_SNAPSHOT_BYTES) {
            entry.retained = null; return fallback(entry, "snapshot-memory-budget", authorityAvailable);
        }
        if ((entry.retained != null && acquiredContentChanged(entry.retained, request, frozenMetadata, notes))
            || (entry.retained == null && entry.snapshotContentGeneration == entry.content && request.equals(entry.snapshotCoverage)
                && entry.snapshotWitness != null && !entry.snapshotWitness.equals(fingerprint))) entry.content = increment(entry.content);
        entry.snapshotWitness = fingerprint; entry.snapshotCoverage = request; entry.snapshotContentGeneration = entry.content;
        Snapshot snapshot = new Snapshot(ref, entry.address, captured, entry.content, sequence, request, frozenMetadata,
            notes, fingerprint, bytes, acquisitionWitness);
        entry.retained = snapshot; entry.lastUsed = increment(clock); clock = entry.lastUsed; hits++;
        return new Result(Health.COMPLETE, "shadow-cache", "within-budget", snapshot);
    }
    public boolean isCurrent(Snapshot snapshot) {
        Entry entry = entries.get(snapshot.clipRef);
        return entry != null && eligibility(entry, snapshot.coverage) == null && snapshot.token.equals(entry.token)
            && snapshot.contentGeneration == entry.content && snapshot.invalidationSequence == entry.sequence;
    }
    public String compare(Snapshot cached, Coverage authorityCoverage, Map<String, Object> metadata, List<Note> authorityNotes) {
        if (!isCurrent(cached)) return "window-changed";
        if (!cached.coverage.equals(authorityCoverage)) return "coverage-mismatch";
        if (!cached.metadata.equals(immutableMap(metadata))) return "metadata-mismatch";
        List<Note> sorted = new ArrayList<>(authorityNotes); sorted.sort(NOTE_ORDER);
        if (cached.notes.size() != sorted.size()) return "membership-mismatch";
        for (int index = 0; index < sorted.size(); index++) {
            Note actual = sorted.get(index), expected = cached.notes.get(index);
            if (actual.channel != expected.channel || actual.cell != expected.cell || actual.pitch != expected.pitch) return "membership-mismatch";
            if (!actual.fields.equals(expected.fields)) return "field-mismatch";
        }
        return "match";
    }

    public void repairScene(int row, boolean insertion) {
        if (row < 0) throw new IllegalArgumentException("invalid row");
        structure = increment(structure);
        for (Entry entry : new ArrayList<>(entries.values())) {
            if (!insertion && entry.address.row == row) { delete(entry.ref); continue; }
            if (entry.address.row >= row) entry.address = new Address(entry.address.trackId, entry.address.row + (insertion ? 1 : -1));
            repair(entry);
        }
        rebuildSlots(); health = Health.REPAIRING; reason = "scene-repair";
    }
    /** The caller must prove that the same channelId remains in the track inventory. */
    public void repairTrackIndex(String trackId, boolean sameChannelIdConfirmed) {
        if (trackId == null || trackId.isEmpty()) throw new IllegalArgumentException("invalid track ID");
        if (!sameChannelIdConfirmed) { requireRebuild("track-identity-unproved"); return; }
        structure = increment(structure); entries.values().forEach(this::repair);
        health = Health.REPAIRING; reason = "track-index-repair";
    }
    public void deleteTrack(String trackId) {
        structure = increment(structure);
        for (Entry entry : new ArrayList<>(entries.values())) {
            if (entry.address.trackId.equals(trackId)) delete(entry.ref); else repair(entry);
        }
        health = Health.REPAIRING; reason = "track-delete-repair";
    }
    public boolean exactMove(String ref, Address destination, boolean orderedEmptyFill,
                             boolean destinationKnownEmpty, boolean completeWindow, String freshFingerprint) {
        Entry entry = entry(ref);
        if (!orderedEmptyFill || !destinationKnownEmpty || !completeWindow || slots.containsKey(destination)
            || entry.retained == null || !entry.retained.fingerprint.equals(freshFingerprint) || !isCurrent(entry.retained)) {
            requireRebuild("ambiguous-move"); health = Health.AMBIGUOUS; return false;
        }
        structure = increment(structure); slots.remove(entry.address); entry.address = destination;
        slots.put(destination, ref); entries.values().forEach(this::repair);
        health = Health.REPAIRING; reason = "exact-move-repair"; return true;
    }
    public void requireRebuild(String cause) {
        eventGap = true; structure = increment(structure); rebuild = increment(rebuild); staging = null;
        shedAll(Health.INVALID, cause);
    }
    /** Rebuild retries always receive a new token. Staging never serves a read. */
    public RebuildToken beginRebuild() {
        rebuild = increment(rebuild); entries.values().forEach(this::retire);
        staging = new LinkedHashMap<>(); rebuildStartedNanos = System.nanoTime();
        health = Health.REBUILDING; reason = "rebuild-in-progress";
        return new RebuildToken(initDomain, project, structure, rebuild);
    }
    /** A stage is an independently acquired complete inventory item. */
    public String stage(RebuildToken token, Address address, Coverage coverage, List<Note> notes,
                        boolean canaryPassed, boolean targetSettled, boolean completeEventWindow,
                        String continuousRef) {
        if (!validRebuild(token) || !canaryPassed || !targetSettled || !coverage.allChannels || coverage.width > MAX_WIDTH)
            throw new IllegalStateException("incomplete rebuild stage");
        if (staging.values().stream().anyMatch(e -> e.address.equals(address))) throw new IllegalArgumentException("duplicate rebuild address");
        Entry previous = continuousRef == null ? null : entries.get(continuousRef);
        boolean continuous = completeEventWindow && !eventGap && previous != null && previous.address.equals(address);
        String ref = continuous ? continuousRef : mint();
        Entry entry = new Entry(ref, address, coverage);
        if (continuous) {
            entry.content = previous.content;
            entry.membershipWitness = previous.coverage.equals(coverage) ? previous.membershipWitness : null;
            entry.snapshotWitness = previous.snapshotWitness; entry.snapshotCoverage = previous.snapshotCoverage;
            entry.snapshotContentGeneration = previous.snapshotContentGeneration;
        }
        Map<Coordinate, List<Note>> grouped = new HashMap<>();
        for (Note note : notes) {
            if (!coverage.contains(note.coordinate())) throw new IllegalArgumentException("rebuild note outside coverage");
            grouped.computeIfAbsent(note.coordinate(), ignored -> new ArrayList<>()).add(note);
        }
        if (grouped.size() > MAX_OCCUPIED || staging.values().stream().filter(e -> e.resident).count() >= MAX_OBSERVERS) throw new IllegalStateException("rebuild capacity exceeded");
        for (Map.Entry<Coordinate, List<Note>> coordinate : grouped.entrySet()) {
            List<Note> verified = validateNotes(coordinate.getValue(), coordinate.getKey(), Set.of());
            entry.occupied.put(coordinate.getKey(), verified.stream().map(n -> new Note(n.channel, n.cell, n.pitch, Map.of())).toList());
        }
        String membership = membershipFingerprint(entry);
        if (entry.membershipWitness != null && !entry.membershipWitness.equals(membership)) entry.content = increment(entry.content);
        entry.membershipWitness = membership;
        entry.resident = true; entry.replay = true; entry.token = token(); entry.addressAssigned = true; entry.health = Health.COMPLETE; entry.reason = "within-budget";
        staging.put(ref, entry);
        if (stagingBytes() + recorderBytes() > MAX_RECORDER_BYTES) { staging.remove(ref); throw new IllegalStateException("rebuild memory exceeded"); }
        return ref;
    }
    /** Include non-resident clips so inventory enumeration does not truncate the project. */
    public String stageNonResident(RebuildToken token, Address address, Coverage coverage) {
        if (!validRebuild(token)) throw new IllegalStateException("invalid rebuild token");
        if (staging.values().stream().anyMatch(e -> e.address.equals(address))) throw new IllegalArgumentException("duplicate rebuild address");
        String ref = mint(); staging.put(ref, new Entry(ref, address, coverage)); return ref;
    }
    public boolean publishRebuild(RebuildToken token, boolean fullInventoryEnumerated, double elapsedMs) {
        measure(elapsedMs); rebuildMs = elapsedMs;
        if (!validRebuild(token) || !fullInventoryEnumerated || !measurementsValid || constructionMs > 50 || pingP95Ms > 50
            || recorderBytes() + stagingBytes() > MAX_RECORDER_BYTES || pendingCount() > MAX_PENDING
            || staging.values().stream().anyMatch(e -> e.resident && (e.health != Health.COMPLETE || !e.dirty.isEmpty()))
            || elapsedMs > 40_000 || elapsed(rebuildStartedNanos) > 40_000) {
            abortRebuild(token, elapsedMs > 40_000 ? "rebuild-budget" : "rebuild-interrupted"); return false;
        }
        entries.clear(); entries.putAll(staging); staging = null; rebuildSlots();
        eventGap = false; inventoryComplete = true; refreshHealth(); return true;
    }
    public void abortRebuild(RebuildToken token, String cause) {
        if (token == null || !initDomain.equals(token.initDomain) || token.project != project
            || token.structure != structure || token.rebuild != rebuild) return;
        rebuild = increment(rebuild); staging = null; eventGap = true; shedAll(Health.INVALID, cause);
    }
    public boolean isRebuildCurrent(RebuildToken token) { return validRebuild(token); }
    /** Start a new structural identity domain before a fresh inventory scan. */
    public void resetInventoryForUnknownStructure(String cause) {
        structure = increment(structure); rebuild = increment(rebuild);
        entries.values().forEach(this::retire); entries.clear(); slots.clear(); staging = null;
        inventoryComplete = false; eventGap = false; health = Health.REBUILDING; reason = cause;
    }
    public void measureConstruction(double constructionMs) { measurements(constructionMs, pingP95Ms); }
    public void measurePing(double pingP95Ms) { measurements(constructionMs, pingP95Ms); }
    public void measurements(double constructionMs, double pingP95Ms) {
        try { measure(constructionMs); measure(pingP95Ms); }
        catch (IllegalArgumentException error) { measurementsValid = false; shedAll(Health.INVALID, "invalid-measurement"); throw error; }
        measurementsValid = true; this.constructionMs = constructionMs; this.pingP95Ms = pingP95Ms;
        if (constructionMs > 50) shedAll(Health.INVALID, "cache-construction-budget");
        else if (pingP95Ms > 50) shedAll(Health.INVALID, "tail-latency-budget");
    }
    public Diagnostics diagnostics() {
        return new Diagnostics(health, reason, initDomain, project, structure, rebuild, entries.size(), residentCount(),
            (int) entries.values().stream().filter(e -> e.health == Health.WARMING).count(),
            (int) entries.values().stream().filter(e -> !e.dirty.isEmpty()).count(),
            entries.values().stream().mapToInt(e -> e.occupied.size()).sum(), pendingCount(), rejected,
            recorderBytes() + stagingBytes(), retainedBytes(),
            entries.values().stream().filter(e -> e.retained != null).mapToLong(e -> e.retained.notes.size()).sum(),
            constructionMs, replayMs, rebuildMs, pingP95Ms, hits, misses, evictions, invalidations, domainObjects());
    }
    /** Use R07 nearest-cell duration rounding. A tie rounds up. Keep at least one cell. */
    public static long normalizeDurationCells(double duration) {
        if (!Double.isFinite(duration) || duration <= 0) throw new IllegalArgumentException("invalid host duration");
        double cells = duration * 512;
        if (!Double.isFinite(cells) || cells > 9_007_199_254_740_991L)
            throw new IllegalArgumentException("host duration exceeds exact cell range");
        long lower = (long) Math.floor(cells);
        return Math.max(1, lower + (cells - lower >= 0.5 ? 1 : 0));
    }
    private DomainObjectCensus domainObjects() {
        List<Entry> owned = new ArrayList<>(entries.values());
        if (staging != null) owned.addAll(staging.values());
        long bindings = 0, occupied = 0, dirty = 0, membershipNotes = 0, snapshots = 0, snapshotNotes = 0;
        long fieldEntries = 0, metadataEntries = 0, witnesses = 0, identityBytes = 40L + 2L * initDomain.length();
        for (Entry entry : owned) {
            if (entry.token != null) bindings++;
            occupied += entry.occupied.size(); dirty += entry.dirty.size();
            membershipNotes += entry.occupied.values().stream().mapToLong(List::size).sum();
            // This estimate covers identity and witness text plus fixed record storage.
            identityBytes += 256L + 2L * (entry.ref.length() + entry.address.trackId.length());
            for (String witness : new String[] {entry.membershipWitness, entry.snapshotWitness}) {
                if (witness != null) { witnesses++; identityBytes += 40L + 2L * witness.length(); }
            }
            if (entry.retained != null) {
                snapshots++; snapshotNotes += entry.retained.notes.size(); metadataEntries += entry.retained.metadata.size();
                fieldEntries += entry.retained.notes.stream().mapToLong(note -> note.fields.size()).sum();
            }
        }
        return new DomainObjectCensus(owned.size(), bindings, occupied, dirty, membershipNotes, occupied,
            snapshots, snapshotNotes, fieldEntries, metadataEntries, witnesses, identityBytes);
    }
    public static String fingerprint(Coverage coverage, Map<String, Object> metadata, List<Note> notes) {
        List<Note> ordered = new ArrayList<>(notes); ordered.sort(NOTE_ORDER);
        StringBuilder input = new StringBuilder();
        canonical(input, FINGERPRINT_VERSION); canonical(input, coverage.startCell); canonical(input, coverage.width);
        canonical(input, coverage.allChannels); canonical(input, new ArrayList<>(coverage.fields));
        canonical(input, new ArrayList<>(coverage.unsupportedFields)); canonical(input, coverage.timingBasis); canonical(input, metadata);
        for (Note note : ordered) { canonical(input, note.channel); canonical(input, note.cell); canonical(input, note.pitch); canonical(input, note.fields); }
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(input.toString().getBytes(StandardCharsets.UTF_8));
            return FINGERPRINT_VERSION + ":" + java.util.HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
    }

    private String eligibility(Entry entry, Coverage request) {
        if (eventGap || staging != null || !measurementsValid || !entry.resident || entry.token == null || !current(entry.token)) return "generation-invalid";
        if (!entry.replay || entry.health == Health.WARMING) return "replay-incomplete";
        if (entry.health != Health.COMPLETE || !entry.dirty.isEmpty()) return "dirty-or-unhealthy";
        if (!entry.coverage.covers(request)) return "coverage-incomplete";
        if (recorderBytes() > MAX_RECORDER_BYTES || entry.occupied.size() > MAX_OCCUPIED || request.width > MAX_WIDTH
            || residentCount() > MAX_OBSERVERS || pendingCount() > MAX_PENDING || constructionMs > 50 || pingP95Ms > 50)
            return "budget-exceeded";
        return null;
    }
    private Result fallback(Entry entry, String cause, boolean available) {
        return new Result(entry.health, available ? "exact-fallback" : "refuse", available ? cause : "authority-unavailable", null);
    }
    private Entry entry(String ref) { Entry result = staging != null && staging.containsKey(ref) ? staging.get(ref) : entries.get(ref); if (result == null) throw new IllegalArgumentException("unknown clip reference"); return result; }
    private String mint() { nextId = increment(nextId); return initDomain + "-p" + project + "-clip-" + String.format("%020d", nextId); }
    private CallbackToken token() { binding = increment(binding); return new CallbackToken(initDomain, project, structure, binding, rebuild); }
    private boolean current(CallbackToken token) { return token != null && initDomain.equals(token.initDomain)
        && token.project == project && token.structure == structure && token.rebuild == rebuild; }
    private boolean validRebuild(RebuildToken token) { return staging != null && token != null && initDomain.equals(token.initDomain)
        && token.project == project && token.structure == structure && token.rebuild == rebuild; }
    private static void domain(String value) {
        if (value == null || value.isEmpty()) throw new IllegalArgumentException("invalid init domain");
    }
    private void retire(Entry entry) {
        if (entry.replay) entry.membershipWitness = membershipFingerprint(entry);
        binding = increment(binding); entry.token = null; entry.resident = false; entry.replay = false;
        entry.dirty.clear(); entry.occupied.clear(); entry.retained = null;
    }
    private void repair(Entry entry) { retire(entry); entry.health = Health.REPAIRING; entry.reason = "rebind-required"; }
    private void fail(Entry entry, Health state, String cause) { retire(entry); entry.health = state; entry.reason = cause; refreshHealth(); }
    private void shedAll(Health state, String cause) {
        if (staging != null) {
            staging.values().forEach(this::retire); staging = null;
            rebuild = increment(rebuild); eventGap = true;
        }
        entries.values().forEach(entry -> { retire(entry); entry.health = state; entry.reason = cause; });
        health = state; reason = cause;
    }
    private int residentCount() { return (int) entries.values().stream().filter(e -> e.resident).count(); }
    private int pendingCount() { return entries.values().stream().mapToInt(e -> e.dirty.size()).sum()
        + (staging == null ? 0 : staging.values().stream().mapToInt(e -> e.dirty.size()).sum()); }
    private long recorderBytes() { return entries.values().stream().filter(e -> e.resident).mapToLong(e -> 256L + 56L * (e.occupied.size() + e.dirty.size())).sum(); }
    private long stagingBytes() { return staging == null ? 0 : staging.values().stream().filter(e -> e.resident).mapToLong(e -> 256L + 56L * (e.occupied.size() + e.dirty.size())).sum(); }
    private long retainedBytes() { return entries.values().stream().filter(e -> e.retained != null).mapToLong(e -> e.retained.payloadEstimatedBytes).sum(); }
    private void rebuildSlots() { slots.clear(); entries.values().forEach(entry -> slots.put(entry.address, entry.ref)); }
    private void refreshHealth() {
        if (eventGap || staging != null) return;
        if (!inventoryComplete) { health = Health.PARTIAL; reason = "inventory-incomplete"; return; }
        health = entries.values().stream().allMatch(e -> e.health == Health.COMPLETE) ? Health.COMPLETE : Health.PARTIAL;
        reason = health == Health.COMPLETE ? "within-budget" : "working-set-partial";
    }
    private static List<Note> validateNotes(List<Note> input, Coordinate coordinate, Set<String> fields) {
        if (input == null) throw new IllegalArgumentException("authority unavailable");
        Set<Integer> channels = new HashSet<>(); List<Note> notes = new ArrayList<>(input);
        for (Note note : notes) {
            if (!note.coordinate().equals(coordinate) || !channels.add(note.channel)) throw new IllegalArgumentException("invalid normalized authority");
            for (String field : fields) if (!note.fields.containsKey(field) || note.fields.get(field) == null) throw new MissingField();
        }
        notes.sort(NOTE_ORDER); return List.copyOf(notes);
    }
    private static String membershipFingerprint(Entry entry) {
        List<Note> notes = entry.occupied.values().stream().flatMap(List::stream).toList();
        return fingerprint(entry.coverage, Map.of(), notes);
    }
    /** Compare the acquired overlap when a caller changes field or span coverage. */
    private static boolean acquiredContentChanged(Snapshot previous, Coverage coverage,
                                                  Map<String, Object> metadata, List<Note> notes) {
        if (!previous.metadata.equals(metadata)) return true;
        long start = Math.max(previous.coverage.startCell, coverage.startCell);
        long end = Math.min(previous.coverage.startCell + previous.coverage.width, coverage.startCell + coverage.width);
        Set<String> fields = new TreeSet<>(previous.coverage.fields); fields.retainAll(coverage.fields);
        Map<String, Note> before = new HashMap<>(), after = new HashMap<>();
        for (Note note : previous.notes) if (note.cell >= start && note.cell < end) before.put(note.channel + ":" + note.cell + ":" + note.pitch, note);
        for (Note note : notes) if (note.cell >= start && note.cell < end) after.put(note.channel + ":" + note.cell + ":" + note.pitch, note);
        if (!before.keySet().equals(after.keySet())) return true;
        for (String key : before.keySet()) for (String field : fields)
            if (!java.util.Objects.equals(before.get(key).fields.get(field), after.get(key).fields.get(field))) return true;
        return false;
    }
    private static final class MissingField extends RuntimeException {}
    private static long increment(long value) { if (value == Long.MAX_VALUE) throw new IllegalStateException("generation exhausted"); return value + 1; }
    private static void counter(long value) { if (value < 0) throw new IllegalArgumentException("negative counter"); }
    private static void measure(double value) { if (!Double.isFinite(value) || value < 0) throw new IllegalArgumentException("invalid measurement"); }
    private static double elapsed(long started) { return (System.nanoTime() - started) / 1_000_000.0; }
    private static Map<String, Object> immutableMap(Map<String, Object> input) {
        if (input == null) throw new IllegalArgumentException("null domain map");
        Map<String, Object> output = new TreeMap<>();
        input.forEach((key, value) -> { if (key == null) throw new IllegalArgumentException("null field"); output.put(key, freeze(value)); });
        return Collections.unmodifiableMap(output);
    }
    private static Object freeze(Object value) {
        if (value instanceof String || value instanceof Boolean || value instanceof Integer || value instanceof Long) return value;
        if (value instanceof Double number) { if (!Double.isFinite(number)) throw new IllegalArgumentException("nonfinite domain value"); return number; }
        if (value instanceof Float number) { if (!Float.isFinite(number)) throw new IllegalArgumentException("nonfinite domain value"); return number; }
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> copy = new TreeMap<>();
            map.forEach((key, child) -> { if (!(key instanceof String text)) throw new IllegalArgumentException("nontext field"); copy.put(text, freeze(child)); });
            return Collections.unmodifiableMap(copy);
        }
        if (value instanceof List<?> list) return list.stream().map(ShadowProjectCache::freeze).toList();
        if (value == null) return null;
        throw new IllegalArgumentException("mutable or unsupported domain value");
    }
    private static void canonical(StringBuilder output, Object value) {
        if (value == null) { output.append("null;"); return; }
        if (value instanceof Map<?, ?> map) {
            output.append('{');
            new TreeMap<>(map).forEach((key, child) -> { canonical(output, key); canonical(output, child); });
            output.append('}'); return;
        }
        if (value instanceof List<?> list) { output.append('['); list.forEach(child -> canonical(output, child)); output.append(']'); return; }
        String text = value.toString(); output.append(value.getClass().getSimpleName()).append(':').append(text.length()).append(':').append(text).append(';');
    }
    /** Estimate canonical storage without a second copy of the candidate payload. */
    private static long canonicalLength(Object value) {
        if (value == null) return 5;
        if (value instanceof Map<?, ?> map) {
            long length = 2;
            for (Map.Entry<?, ?> entry : map.entrySet()) length += canonicalLength(entry.getKey()) + canonicalLength(entry.getValue());
            return length;
        }
        if (value instanceof List<?> list) {
            long length = 2; for (Object child : list) length += canonicalLength(child); return length;
        }
        String text = value.toString();
        return value.getClass().getSimpleName().length() + 3L + Integer.toString(text.length()).length() + text.length();
    }
    private static long payloadEstimate(Map<String, Object> metadata, List<Note> notes, Coverage coverage) {
        long length = canonicalLength(metadata) + canonicalLength(new ArrayList<>(coverage.fields))
            + canonicalLength(new ArrayList<>(coverage.unsupportedFields));
        for (Note note : notes) length += canonicalLength(note.fields);
        return 256L + 128L * notes.size() + 2L * length;
    }
}
