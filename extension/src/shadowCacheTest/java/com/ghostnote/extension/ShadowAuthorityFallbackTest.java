package com.ghostnote.extension;

import java.util.List;
import java.util.Map;
import java.util.Set;
import static com.ghostnote.extension.ShadowProjectCache.*;

/** Check independent fallback, window refusal, and bounded acquisition. */
public final class ShadowAuthorityFallbackTest {
    private static final Address ADDRESS = new Address("owned", 2);
    private static final Coverage COVERAGE = new Coverage(3, 2, true, Set.of("velocity"), Set.of(), "1/512-beat");
    public static void main(String[] args) {
        Source source = new Source(); ShadowAuthorityFallback reader = source.reader();
        reader.start(ADDRESS, COVERAGE); settle(source, reader);
        var result = reader.poll();
        check(result.authorityAvailable() && result.fallbackPerformed() && result.scannedCoordinates() == 256, "full scan acquires authority");
        check(result.authorityNotes().size() == 1 && result.authorityNotes().get(0).channel() == 15, "full scan sees channel 15 without callback coordinates");
        check(!result.complete() && !result.eligible(), "fallback never admits a cache candidate");
        check(result.coverage().equals(COVERAGE), "request coverage is retained");
        source.epoch++;
        check(!reader.poll().authorityAvailable() && reader.poll().authorityNotes() == null, "later polls cannot reuse changed authority");

        source = new Source(); reader = source.reader(); reader.start(ADDRESS, COVERAGE); settle(source, reader);
        final Source epochSource = source; source.readHook = () -> epochSource.epoch++;
        result = reader.poll();
        check(result.reason().equals("authority-window-changed") && !result.authorityAvailable() && result.authorityNotes() == null,
            "change during acquisition discards every note");
        check(reader.poll().reason().equals(result.reason()), "refusal stays terminal");

        source = new Source(); reader = source.reader(); reader.start(ADDRESS, COVERAGE); settle(source, reader);
        final Source callbackSource = source; source.readHook = () -> callbackSource.callbacks++;
        check(reader.poll().reason().equals("authority-window-changed"), "late callback invalidates the candidate");

        source = new Source(); reader = source.reader(); reader.start(ADDRESS, COVERAGE);
        check(reader.cancel("cancelled").terminal() && reader.poll().authorityNotes() == null, "cancellation exposes no authority");
        reader.start(ADDRESS, COVERAGE); settle(source, reader); check(reader.poll().authorityAvailable(), "explicit retry recovers");

        source = new Source(); source.bound = false; reader = source.reader(); reader.start(ADDRESS, COVERAGE);
        source.clock += 5_000_000_001L;
        check(reader.poll().reason().equals("authority-binding-budget"), "binding deadline is bounded");

        source = new Source(); reader = source.reader(); reader.start(ADDRESS, COVERAGE); settle(source, reader);
        source.clock += 40_000_000_001L;
        check(reader.poll().reason().equals("authority-scan-budget"), "overall deadline is bounded");

        source = new Source(); reader = source.reader(); reader.start(ADDRESS, COVERAGE); settle(source, reader);
        final Source expensiveSource = source; source.readHook = () -> expensiveSource.clock += 45_000_001L;
        check(reader.poll().reason().equals("authority-host-work-budget"), "one expensive read refuses publication");
        source = new Source(); reader = source.reader(); reader.start(ADDRESS, COVERAGE); settle(source, reader);
        final Source finalMetadataSource = source;
        source.metadataHook = () -> { if (finalMetadataSource.metadataReads >= 2) finalMetadataSource.silentGuardChange++; };
        check(reader.poll().reason().equals("authority-window-changed"), "fresh guard after final metadata catches an undelivered change");

        source = new Source(); reader = source.reader(); reader.start(ADDRESS, COVERAGE); settle(source, reader);
        check(reader.poll().authorityAvailable(), "stable acquisition precedes retained status test");
        final Source retainedMetadataSource = source;
        source.metadataHook = () -> retainedMetadataSource.silentGuardChange++;
        check(!reader.status().authorityAvailable() && reader.status().authorityNotes() == null,
            "retained status rereads the guard after metadata");
        source = new Source(); reader = source.reader(); reader.start(ADDRESS, COVERAGE); settle(source, reader);
        final Source costlyMetadataSource = source;
        source.metadataHook = () -> { if (costlyMetadataSource.metadataReads >= 2) costlyMetadataSource.clock += 45_000_001L; };
        check(reader.poll().reason().equals("authority-host-work-budget"), "final metadata and guards remain in the batch budget");
        System.out.println("Shadow authority fallback: 10 test groups passed.");
    }
    private static void settle(Source source, ShadowAuthorityFallback reader) {
        reader.poll();
        for (int poll = 0; poll < 29; poll++) { source.clock += 50_000_000L; reader.poll(); }
        source.clock += 50_000_000L;
    }
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
    private static final class Source implements ShadowAuthorityFallback.Source {
        long clock = 1, epoch, callbacks, silentGuardChange;
        int metadataReads;
        boolean bound = true;
        Runnable readHook, metadataHook;
        ShadowAuthorityFallback reader() { return new ShadowAuthorityFallback(this, () -> clock); }
        public void point(Address address) {}
        public void advance() {}
        public boolean bound(Address address) { return bound; }
        public long callbacks() { return callbacks; }
        public Object guard() { return List.of(epoch, silentGuardChange); }
        public long windowVersion() { return epoch; }
        public Map<String, Object> metadata() { metadataReads++; if (metadataHook != null) metadataHook.run(); return Map.of("name", "owned"); }
        public List<Note> read(Coordinate coordinate) {
            if (readHook != null) { Runnable hook = readHook; readHook = null; hook.run(); }
            return coordinate.equals(new Coordinate(4, 127)) ? List.of(new Note(15, 4, 127, Map.of("velocity", .75))) : List.of();
        }
    }
}
