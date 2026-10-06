package com.ghostnote.extension;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/** Check the 8h3c clip read: capture close rules, the notes-v1 frame golden, the write gate, and classification. */
public final class ClipReaderTest {
    static final Path GOLDEN = Path.of("clip-read.frame.golden.json");
    private static int passed;

    public static void main(String[] args) throws Exception {
        run("one batch and the exists task close the read", ClipReaderTest::closeAfterBoth);
        run("an empty clip closes on the exists task", ClipReaderTest::emptyClose);
        run("callbacks after the close are counted and do not change the copy", ClipReaderTest::afterClose);
        run("release callbacks have state counters and cannot change the close copy", ClipReaderTest::releaseCallbacks);
        run("synthetic faults and research routes require the research profile", ClipReaderTest::diagnosticFaults);
        run("the open task subscribes before it removes the pins (E232)", ClipReaderTest::openOrder);
        run("the bind task selects the row at park, then points (E228)", ClipReaderTest::bindOrder);
        run("a second callback for one cell is a duplicate", ClipReaderTest::duplicates);
        run("a false clipExists value is no start signal", ClipReaderTest::falseExists);
        run("the notes-v1 frame matches the wire golden", ClipReaderTest::frameGolden);
        run("frame encodings: const, dict u8/u16, raw f64/i32, and pages", ClipReaderTest::frameEncodings);
        run("reads run at once; writes wait behind an open read in FIFO order", ClipReaderTest::gateOrder);
        run("a clip read waits for a write lease and for earlier entries", ClipReaderTest::gateLease);
        run("a full queue refuses before the request runs", ClipReaderTest::gateLimit);
        run("every method has a gate class; undo, redo, actions, and unknown methods are writes", ClipReaderTest::classes);
        System.out.println("Clip reader: " + passed + " test groups passed.");
    }

    private static final ArrayDeque<Runnable> queue = new ArrayDeque<>();
    private static void drain() { while (!queue.isEmpty()) queue.poll().run(); }

    private static ClipReadCapture.Fields fields(double velocity) {
        ClipReadCapture.Fields f = new ClipReadCapture.Fields();
        f.doubles[0] = velocity; f.doubles[3] = 0.25; f.doubles[9] = 1;
        f.flags[0] = true;
        return f;
    }

    private static ClipReadCapture capture(int[] closes) {
        queue.clear();
        return new ClipReadCapture(1, queue::add, () -> closes[0]++);
    }

    private static void closeAfterBoth() {
        int[] closes = {0};
        ClipReadCapture c = capture(closes);
        c.step(0, 60, 0, ClipReadCapture.STATE_ON, fields(0.5));
        c.step(1, 60, 0, ClipReadCapture.STATE_SUSTAIN, fields(0));
        check(!c.isClosed(), "no exists task yet");
        drain();
        check(!c.isClosed() && c.batches == 1, "one batch, still waiting for exists");
        c.exists(true);
        drain();
        check(c.isClosed() && closes[0] == 1 && c.closeSeq() == 2 && c.notes().count == 1, "closed with one note");
    }

    private static void emptyClose() {
        int[] closes = {0};
        ClipReadCapture c = capture(closes);
        c.exists(true);
        drain();
        check(c.isClosed() && c.notes().count == 0 && c.batches == 0, "empty close");
    }

    private static void afterClose() {
        int[] closes = {0};
        ClipReadCapture c = capture(closes);
        c.exists(true);
        c.step(0, 60, 0, ClipReadCapture.STATE_ON, fields(0.5));
        drain();
        check(c.isClosed() && c.notes().count == 1, "closed after the batch");
        c.step(0, 60, 0, ClipReadCapture.STATE_EMPTY, fields(0));
        c.step(4, 61, 0, ClipReadCapture.STATE_ON, fields(0.7));
        check(c.afterClose == 2 && c.notes().count == 1 && c.notes().doubles[0][0] == 0.5, "copy is frozen");
    }

    private static void releaseCallbacks() {
        int[] closes = {0};
        ClipReadCapture c = capture(closes);
        c.exists(true);
        c.step(512, 127, 15, ClipReadCapture.STATE_ON, fields(0.5));
        drain();
        c.step(512, 127, 15, ClipReadCapture.STATE_EMPTY, fields(0));
        check(c.afterClose == 1, "an empty callback before release still trips the read");
        c.release();
        for (int x = 512; x < 640; x++) c.step(x, 127, 15, ClipReadCapture.STATE_EMPTY, fields(0));
        c.step(0, 60, 0, ClipReadCapture.STATE_SUSTAIN, fields(0));
        c.step(0, 60, 0, ClipReadCapture.STATE_ON, fields(0.7));
        check(c.afterClose == 1 && c.afterRelease == 130, "release does not erase the tripwire count");
        check(c.releaseEmpty == 128 && c.releaseSustain == 1 && c.releaseOn == 1, "all states counted");
        check(c.releaseSamples.size() == 8 && c.releaseSamples.get(0)[0] == 512, "bounded raw samples");
        check(c.notes().count == 1 && c.notes().doubles[0][0] == 0.5, "release cannot change the copy");
        ClipReadCapture open = capture(closes);
        boolean threw = false;
        try { open.release(); } catch (IllegalStateException expected) { threw = true; }
        check(threw, "an open capture cannot end its confirmation window");
    }

    private static void diagnosticFaults() {
        for (RuntimeProfile profile : RuntimeProfile.values()) {
            ClipReader.validateDiagnosticFault(profile, "");
            for (String fault : List.of("duplicate-cell", "step-delta", "unknown")) {
                boolean threw = false;
                try { ClipReader.validateDiagnosticFault(profile, fault); }
                catch (IllegalArgumentException expected) { threw = true; }
                check(threw == (!profile.hasProbeResources() || fault.equals("unknown")), profile + ":" + fault);
            }
            ClipReader.validateDiagnosticRoute(profile, "");
            for (String route : List.of("legacy-open", "unknown")) {
                boolean threw = false;
                try { ClipReader.validateDiagnosticRoute(profile, route); }
                catch (IllegalArgumentException expected) { threw = true; }
                check(threw == (!profile.hasProbeResources() || route.equals("unknown")), profile + ":" + route);
            }
        }
    }

    /** Records route steps. A pin change counts on the host only while the clip is subscribed. */
    private static final class Steps implements ClipReadRoute.Steps {
        final List<String> log = new ArrayList<>();
        boolean subscribed, atPark, hostClipPinned = true;
        public boolean subscribed() { return subscribed; }
        public void subscribe() { subscribed = true; log.add("subscribe"); }
        public void unpinClip() { if (subscribed) hostClipPinned = false; log.add("unpinClip"); }
        public void unpinTrack() { log.add("unpinTrack"); }
        public boolean atPark() { return atPark; }
        public void park() { log.add("park"); }
        public void claimLease() { log.add("claimLease"); }
        public void selectRow() { log.add("selectRow"); }
        public void pointTarget() { log.add("pointTarget"); }
    }

    private static void openOrder() {
        Steps released = new Steps();
        ClipReadRoute.open(released, "");
        check(released.log.equals(List.of("subscribe", "unpinClip", "unpinTrack", "park")), "product open " + released.log);
        check(!released.hostClipPinned, "the unpin reaches the host");
        ClipReadRoute.parked(released);
        check(released.log.size() == 4, "no second subscribe at park");

        Steps open = new Steps();
        open.subscribed = true; open.atPark = true;
        ClipReadRoute.open(open, "");
        check(open.log.equals(List.of("unpinClip", "unpinTrack")), "already subscribed and parked " + open.log);

        Steps legacy = new Steps();
        ClipReadRoute.open(legacy, "legacy-open");
        ClipReadRoute.parked(legacy);
        check(legacy.log.equals(List.of("unpinClip", "unpinTrack", "park", "subscribe")), "legacy open " + legacy.log);
        check(legacy.hostClipPinned, "the legacy unpin does not reach the host");
    }

    private static void bindOrder() {
        Steps s = new Steps();
        ClipReadRoute.bind(s);
        check(s.log.equals(List.of("claimLease", "selectRow", "pointTarget")), "bind " + s.log);
    }

    private static void duplicates() {
        int[] closes = {0};
        ClipReadCapture c = capture(closes);
        c.step(0, 60, 0, ClipReadCapture.STATE_ON, fields(0.5));
        c.step(0, 60, 1, ClipReadCapture.STATE_ON, fields(0.5));
        c.step(0, 61, 0, ClipReadCapture.STATE_ON, fields(0.5));
        check(c.duplicates == 0, "channels and pitches stay separate");
        c.step(0, 60, 0, ClipReadCapture.STATE_ON, fields(0.6));
        c.step(0, 61, 0, ClipReadCapture.STATE_EMPTY, fields(0));
        c.exists(true);
        drain();
        check(c.duplicates == 2 && c.notes().count == 2, "duplicate and removal are both counted");
        check(ClipReadCapture.key(15, 4_194_303, 127) != ClipReadCapture.key(0, 4_194_303, 127), "key keeps channel");
    }

    private static void falseExists() {
        int[] closes = {0};
        ClipReadCapture c = capture(closes);
        c.exists(false);
        drain();
        check(!c.isClosed(), "false is no signal");
    }

    /** The frame fixture that the brain decoder test also reads. */
    static ClipReadCapture.Notes goldenNotes() {
        int[] closes = {0};
        ClipReadCapture c = capture(closes);
        // Note 0: a fresh host note. Note 1: disabled controls with raw values. Note 2: a removed note.
        // Note 3: channel 15 at the last cell.
        double[][] doubles = {
            {100 / 127.0, 0, 0, 1.0, 0, 0, 0, 0, 0, 1, 0, 0, 0},
            {64 / 127.0, 0.5, 0.25, 0.75, 0.5, -0.25, 0, 0.125, 2, 0.3, 0.5, -0.5, 0.75},
            {90 / 127.0, 0, 0, 0.5, 0, 0, 0, 0, 0, 1, 0, 0, 0},
            {127 / 127.0, 0, 0, 1 / 512.0, 0, 0, 0.5, 0, -12, 1, 0, 0, 0},
        };
        int[][] ints = {{0, 1, 1, 0}, {3, 8, 85, -2}, {0, 1, 1, 0}, {0, 1, 1, 0}};
        boolean[][] flags = {
            {true, false, true, true, true},
            {false, true, false, false, false},
            {true, false, true, true, true},
            {true, false, true, true, true},
        };
        int[][] at = {{0, 60, 0}, {512, 62, 3}, {700, 64, 0}, {4_194_303, 127, 15}};
        for (int i = 0; i < 4; i++) {
            ClipReadCapture.Fields f = new ClipReadCapture.Fields();
            System.arraycopy(doubles[i], 0, f.doubles, 0, f.doubles.length);
            System.arraycopy(ints[i], 0, f.ints, 0, f.ints.length);
            System.arraycopy(flags[i], 0, f.flags, 0, f.flags.length);
            c.step(at[i][0], at[i][1], at[i][2], ClipReadCapture.STATE_ON, f);
        }
        c.step(700, 64, 0, ClipReadCapture.STATE_EMPTY, new ClipReadCapture.Fields());
        c.exists(true);
        drain();
        return c.notes();
    }

    private static void frameGolden() throws Exception {
        JsonObject frame = NoteFrame.encode(goldenNotes(), 0, ClipReader.PAGE);
        String text = new GsonBuilder().setPrettyPrinting().create().toJson(frame) + "\n";
        if ("1".equals(System.getenv("GN_REGEN_FRAME_GOLDEN"))) Files.writeString(GOLDEN, text, StandardCharsets.UTF_8);
        check(Files.exists(GOLDEN), "golden exists; run with GN_REGEN_FRAME_GOLDEN=1 to write it");
        JsonObject golden = JsonParser.parseString(Files.readString(GOLDEN, StandardCharsets.UTF_8)).getAsJsonObject();
        check(golden.equals(frame), "frame equals " + GOLDEN);
        check(frame.get("count").getAsInt() == 3 && frame.get("next").getAsInt() == -1, "removed note is omitted");
    }

    private static void frameEncodings() {
        int[] closes = {0};
        ClipReadCapture c = capture(closes);
        for (int i = 0; i < 70_000; i++) {
            ClipReadCapture.Fields f = fields(i % 128 / 127.0);
            f.doubles[3] = (i + 1) / 1024.0; // 70,000 distinct durations: raw f64
            f.doubles[4] = (i % 300) / 600.0; // 300 distinct gains: u16
            c.step(i, i % 128, i % 16, ClipReadCapture.STATE_ON, f);
        }
        c.exists(true);
        drain();
        JsonObject all = NoteFrame.encode(c.notes(), 0, ClipReader.PAGE);
        String columns = all.get("columns").toString();
        check(columns.contains("[\"duration\",\"raw\",\"f64\"]"), "duration raw f64: " + columns);
        check(columns.contains("[\"gain\",\"dict\",\"u16\"]"), "gain u16");
        check(columns.contains("[\"velocity\",\"dict\",\"u8\"]"), "velocity u8");
        check(columns.contains("[\"cell\",\"raw\",\"i32\"]"), "cell raw i32");
        check(columns.contains("[\"pressure\",\"const\"]") && columns.contains("[\"isChanceEnabled\",\"const\"]"), "consts");
        int bytes = Base64.getDecoder().decode(all.get("data").getAsString()).length;
        // channel, pitch, velocity: u8; cell: i32; duration: f64; gain: u16.
        check(bytes == 70_000 * (1 + 1 + 4 + 1 + 8 + 2), "section bytes " + bytes);
        JsonObject first = NoteFrame.encode(c.notes(), 0, 65_536);
        check(first.get("next").getAsInt() == 65_536 && first.get("size").getAsInt() == 65_536, "first page");
        check(first.get("columns").toString().contains("[\"duration\",\"dict\",\"u16\"]"), "a page has its own tables");
        JsonObject second = NoteFrame.encode(c.notes(), 65_536, 65_536);
        check(second.get("size").getAsInt() == 70_000 - 65_536 && second.get("next").getAsInt() == -1, "last page");
        ClipReadCapture none = capture(closes);
        none.exists(true);
        drain();
        JsonObject empty = NoteFrame.encode(none.notes(), 0, 10);
        check(empty.get("count").getAsInt() == 0 && empty.get("data").getAsString().isEmpty(), "empty frame");
    }

    private static WriteGate gate(int limit, long[] now) {
        queue.clear();
        return new WriteGate(queue::add, () -> now[0], limit);
    }

    private static void gateOrder() {
        long[] now = {0};
        WriteGate g = gate(8, now);
        List<String> log = new ArrayList<>();
        check(g.submit(WriteGate.Kind.WRITE, q -> log.add("w0:" + q)), "write admitted");
        check(g.submit(WriteGate.Kind.CLIP_READ, q -> log.add("read")), "read opened");
        check(g.readOpen(), "read is open");
        now[0] = 10;
        g.submit(WriteGate.Kind.WRITE, q -> log.add("w1:" + q));
        g.submit(WriteGate.Kind.READ, q -> log.add("r:" + q));
        g.submit(WriteGate.Kind.CLIP_READ, q -> log.add("read2:" + q));
        g.submit(WriteGate.Kind.WRITE, q -> log.add("w2:" + q));
        check(log.equals(List.of("w0:0", "read", "r:0")) && g.waiting() == 3, "write queued, read ran: " + log);
        now[0] = 30;
        g.readClosed();
        check(queue.size() == 1, "one entry per task");
        queue.poll().run();
        check(log.get(3).equals("w1:20") && g.readOpen() == false, "first write after close: " + log);
        queue.poll().run();
        check(log.get(4).equals("read2:20") && g.readOpen(), "the queued read opens in order");
        check(queue.isEmpty() && g.waiting() == 1, "the later write waits for the second read");
        g.readClosed();
        drain();
        check(log.get(5).equals("w2:20") && g.waiting() == 0, "the last write runs: " + log);
        boolean threw = false;
        try { g.readClosed(); } catch (IllegalStateException expected) { threw = true; }
        check(threw, "closing twice is an error");
    }

    private static void gateLease() {
        long[] now = {0};
        WriteGate g = gate(8, now);
        List<String> log = new ArrayList<>();
        WriteGate.Lease lease = g.lease();
        check(g.submit(WriteGate.Kind.WRITE, q -> log.add("w")), "write runs during a lease");
        g.submit(WriteGate.Kind.CLIP_READ, q -> log.add("read"));
        g.submit(WriteGate.Kind.WRITE, q -> log.add("w-after-read"));
        drain();
        check(log.equals(List.of("w")) && !g.readOpen(), "read waits for the lease: " + log);
        lease.release();
        lease.release();
        check(g.leases() == 0, "a second release has no effect");
        drain();
        check(log.equals(List.of("w", "read")) && g.readOpen(), "read opens after the lease: " + log);
        g.readClosed();
        drain();
        check(log.equals(List.of("w", "read", "w-after-read")), "then the write");
        // A throwing entry does not stop the queue.
        g.submit(WriteGate.Kind.CLIP_READ, q -> { });
        g.submit(WriteGate.Kind.WRITE, q -> { throw new RuntimeException("x"); });
        g.submit(WriteGate.Kind.WRITE, q -> log.add("w3"));
        g.readClosed();
        try { drain(); } catch (RuntimeException expected) { }
        drain();
        check(log.get(log.size() - 1).equals("w3"), "queue continues after an error");
    }

    private static void gateLimit() {
        long[] now = {0};
        WriteGate g = gate(2, now);
        int[] runs = {0};
        g.submit(WriteGate.Kind.CLIP_READ, q -> { });
        check(g.submit(WriteGate.Kind.WRITE, q -> runs[0]++) && g.submit(WriteGate.Kind.WRITE, q -> runs[0]++), "two fit");
        check(!g.submit(WriteGate.Kind.WRITE, q -> runs[0]++), "third refused");
        check(g.refusedTotal() == 1 && runs[0] == 0, "refused entry never ran");
        g.readClosed();
        drain();
        check(runs[0] == 2, "admitted entries ran");
    }

    private static void classes() {
        for (RuntimeProfile profile : RuntimeProfile.values()) {
            for (String method : profile.methodNames()) check(RuntimeProfile.kind(method) != null, method);
        }
        for (String method : List.of("app.undo", "app.redo", "app.invokeAction", "batch.run", "cursor.setNotes",
                "slot.select", "cursor.pointTrack", "remote.list", "no.such.method")) {
            check(RuntimeProfile.kind(method) == WriteGate.Kind.WRITE, method + " is a write");
        }
        check(RuntimeProfile.kind("clip.read") == WriteGate.Kind.CLIP_READ, "clip.read opens a read");
        check(RuntimeProfile.kind("clip.readPage") == WriteGate.Kind.READ, "clip.readPage is a read");
        check(RuntimeProfile.NORMAL.includes("clip.read") && RuntimeProfile.NORMAL.includes("clip.readPage"),
            "normal profile has the reader");
    }

    private static void run(String name, ThrowingRunnable test) throws Exception {
        test.run();
        passed++;
        System.out.println("ok - " + name);
    }

    private interface ThrowingRunnable { void run() throws Exception; }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
