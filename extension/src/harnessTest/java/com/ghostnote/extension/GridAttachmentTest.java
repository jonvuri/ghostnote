package com.ghostnote.extension;

import com.google.gson.*;
import java.util.*;
import java.nio.file.*;

/** Failure injection for the attachment boundary. No host object is constructed. */
public final class GridAttachmentTest {
    private static final class Node {
        Node owner; boolean disposed; final List<Node> children = new ArrayList<>();
    }
    private static final class Fake implements GridModuleAttachment.Host {
        final String mode; final Node root = new Node();
        int creates, inserts, closes, disposals, ownedChecks;
        Fake(String mode) {
            this.mode = mode;
            for (int i = 0; i < 76; i++) { Node n = new Node(); n.owner = root; root.children.add(n); }
        }
        void fail(String point) { if (mode.equals(point)) throw new IllegalStateException(point); }
        public void preflight() { fail("preflight"); }
        public void guard() { fail("guard"); }
        public Object create() { creates++; fail("factory"); return root; }
        public Object owner(Object n) { return ((Node)n).owner; }
        public List<?> children(Object n) { return ((Node)n).children; }
        public boolean disposed(Object n) { return ((Node)n).disposed; }
        public void requireRoot(Object n) { fail("ownership"); }
        public void requireInitialized(Object n) { fail("initialization"); }
        public JsonObject capture(Object n) { fail("capture"); JsonObject g = new JsonObject(); g.add("nodes", new JsonArray()); return g; }
        public JsonObject prepare(Object n) { fail("layout"); return new JsonObject(); }
        public boolean begin(Object n) { fail("start-throw"); return !mode.equals("start-false"); }
        public void proveEdit() { fail("unowned-start"); }
        public void associate() { fail("association"); }
        public void requireOwnedEdit() { ownedChecks++; if (mode.equals("lost-edit") && ownedChecks == 2) throw new IllegalStateException("lost edit"); }
        public void insert(Object n) {
            inserts++; fail("record-before-list");
            root.owner = new Node(); fail("partial-insert");
        }
        public boolean close() { closes++; fail("close-throw"); return !mode.equals("close-false"); }
        public void requireIdle() { fail("not-idle"); }
        public JsonObject attached(Object n) { fail("selection-change"); return new JsonObject(); }
        public void requireAbsent(Object n) { fail("unexpected-member"); }
        public void dispose(Object n) { disposals++; root.disposed = true; root.children.forEach(v -> v.disposed = true); }
    }
    public static void run() throws Exception {
        for (String mode : List.of("success", "preflight", "guard", "factory", "ownership", "initialization", "capture", "layout",
                "start-throw", "start-false", "unowned-start", "association", "record-before-list", "partial-insert",
                "lost-edit", "close-throw", "close-false", "not-idle", "selection-change")) {
            Fake h = new Fake(mode); List<JsonObject> reports = new ArrayList<>(); boolean failed = false;
            try { GridModuleAttachment.run(h, reports::add); } catch (Exception error) { failed = true; }
            check(failed != mode.equals("success"), mode);
            check(h.creates == (Set.of("preflight", "guard").contains(mode) ? 0 : 1), mode + " factory count");
            boolean beforeInsert = Set.of("preflight", "guard", "factory", "ownership", "initialization", "capture", "layout",
                "start-throw", "start-false", "unowned-start", "association").contains(mode);
            check(h.inserts == (beforeInsert ? 0 : 1), mode + " insertion count");
            boolean ownsEdit = !Set.of("preflight", "guard", "factory", "ownership", "initialization", "capture", "layout",
                "start-throw", "start-false", "unowned-start", "lost-edit").contains(mode);
            check(h.closes == (ownsEdit ? 1 : 0), mode + " close count");
            boolean dispose = Set.of("initialization", "capture", "layout", "start-throw", "start-false", "unowned-start", "association").contains(mode);
            check(h.disposals == (dispose ? 1 : 0), mode + " disposal count");
            check(reports.getLast().get("stage").getAsString().equals(failed ? "uncertain-stop" : "complete"), mode);
        }
        layout(); readback(); asynchronous(); editAndSelection(); captureBounds(); selectionWireRoundTrip();
        System.out.println("Attachment: edit failures, partial insertion, readback, layout, limits, and late completion pass.");
    }
    private static String id(int n) { return new UUID(0, n).toString(); }
    private static GridAttachmentLayout.Rect r(int id, int x, int y, int w, int h) { return new GridAttachmentLayout.Rect(id(id),x,y,w,h); }
    private static void layout() {
        var base = List.of(r(1,-4,-2,3,2), r(2,-1,-2,1,2), r(3,0,-2,2,2), r(4,-1,0,1,2));
        check(GridAttachmentLayout.admit(base, r(5,0,0,1,2)).size() == 5, "free attachment");
        refuses(() -> GridAttachmentLayout.admit(base, r(4,0,0,1,2)));
        refuses(() -> GridAttachmentLayout.requireFree(List.of(r(1,0,0,2,2),r(2,1,1,1,1))));
        refuses(() -> r(1,0,0,0,2)); refuses(() -> r(1,0,0,9,1));
        refuses(() -> r(1,Integer.MAX_VALUE,0,2,1));
        refuses(() -> GridAttachmentLayout.requireFree(List.of(r(1,0,-16,1,1), r(2,0,16,1,1))));
        var tie = GridAttachmentLayout.simulate(List.of(r(1,0,0,1,1), r(2,0,0,1,1)),id(2));
        check(tie.get(0).uuid().equals(id(2)) && tie.get(1).x() == 1, "inserted-first tie");
        // Compare each admitted width/height combination with the row frontier model.
        int admitted = 0;
        for (int w = 1; w <= 8; w++) for (int h = 1; h <= 8; h++) {
            var result = GridAttachmentLayout.admit(base,r(5,0,0,w,h));
            check(result.size() == 5,"bounded prediction"); admitted++;
        }
        check(admitted == 64,"all free detached sizes");
    }
    private static JsonObject fixture(String property) throws Exception {
        return JsonParser.parseString(Files.readString(Path.of(System.getProperty(property)))).getAsJsonObject();
    }
    private static void readback() throws Exception {
        JsonObject before = fixture("gridFixtureBaseline").getAsJsonObject("graph");
        JsonObject detached = fixture("gridDetachedBaseline").getAsJsonObject("lifecycle").getAsJsonObject("capture0");
        JsonObject attached = new JsonObject(); attached.addProperty("managedObjectId", 4000);
        attached.addProperty("managedObjectRegistered", true);
        var expected = GridAttachmentGraph.expectedNodes(before,detached,attached);
        check(expected.size() == 61,"expected appended graph");
        check(GridFixtureValue.scalar(expected.get(53).getAsJsonObject(),6679).getAsInt() == 2,"target x");
        check(GridFixtureValue.refs(expected.get(54).getAsJsonObject(),173).get(5).getAsInt() == 60,"rebased atom refs");
        check(GridFixtureValue.scalar(expected.get(59).getAsJsonObject(),14).getAsInt() == 4000,"registered ID replaces detached zero");
        for (int id : new int[]{0,-1,Integer.MIN_VALUE}) {
            JsonObject invalid = attached.deepCopy(); invalid.addProperty("managedObjectId",id);
            refuses(() -> GridAttachmentGraph.expectedNodes(before,detached,invalid));
        }
        JsonObject duplicateBefore = before.deepCopy();
        JsonObject existingAtom = duplicateBefore.getAsJsonArray("nodes").asList().stream()
            .map(JsonElement::getAsJsonObject).filter(n -> n.get("className").getAsString().equals("nitro_atom")).findFirst().orElseThrow();
        GridFixtureValue.property(existingAtom,14).getAsJsonObject("value").addProperty("data","4000");
        refuses(() -> GridAttachmentGraph.expectedNodes(duplicateBefore,detached,attached));
        JsonObject unregistered = attached.deepCopy(); unregistered.addProperty("managedObjectRegistered",false);
        refuses(() -> GridAttachmentGraph.expectedNodes(before,detached,unregistered));
        Object atom = new Object(), context = new Object();
        GridAttachmentSymbols.requireRegistered(atom,4000,context,context,atom);
        refuses(() -> GridAttachmentSymbols.requireRegistered(atom,0,context,context,atom));
        refuses(() -> GridAttachmentSymbols.requireRegistered(atom,4000,context,new Object(),atom));
        refuses(() -> GridAttachmentSymbols.requireRegistered(atom,4000,context,context,new Object()));
        JsonObject after = before.deepCopy(); after.add("nodes",expected); JsonObject witness = new JsonObject();
        GridProbeSafety safety = new GridProbeSafety(); safety.attempt("a"); refuses(() -> safety.attempt("a")); safety.attempt("b"); refuses(() -> safety.attempt("c"));
        safety.expect(expected,witness); safety.readback(after,witness); safety.readback(after,witness); safety.release(false);
        check(!safety.locked(),"paired read release"); safety.expect(expected,witness);
        JsonObject changedId = after.deepCopy();
        GridFixtureValue.property(GridFixtureValue.node(changedId,59),14).getAsJsonObject("value").addProperty("data","4001");
        refuses(() -> GridAttachmentGraph.requireRead(changedId,witness,expected,witness));
        JsonObject changed = after.deepCopy(); changed.addProperty("complete",false);
        refuses(() -> safety.readback(changed,witness)); check(safety.locked(),"read failure lock");
        refuses(() -> safety.recoveryBind(true)); safety.recoveryBind(false); safety.recoveryRead(); safety.recoveryRead();
        refuses(safety::recoveryRead); safety.release(false); refuses(() -> safety.recoveryBind(false)); refuses(() -> safety.attempt("d"));
        var missing = new GridProbeSafety(); missing.expect(expected,witness); missing.readback(after,witness); missing.release(false);
        check(missing.locked(),"missing second read locks");
        JsonObject badDefault = detached.deepCopy(); GridFixtureValue.property(GridFixtureValue.node(badDefault,3),712).getAsJsonObject("value").addProperty("data",0.5);
        refuses(() -> GridAttachmentGraph.requireDefaults(badDefault));
    }
    private static void asynchronous() {
        List<Runnable> queued = new ArrayList<>(), completion = new ArrayList<>(), timers = new ArrayList<>();
        var state = new GridReadJob.State(); var safety = new GridProbeSafety(); int[] replies = new int[3];
        GridReadJob.start(queued::add, (r,d) -> (d == 0 ? completion : timers).add(r), () -> {
            timers.getFirst().run(); check(state.unfinished(),"timeout cannot finish native task");
            refuses(() -> safety.recoveryBind(state.unfinished())); return 1;
        }, r -> replies[0]++, e -> replies[1]++, () -> { safety.lock(); replies[2]++; },state);
        queued.getFirst().run(); completion.forEach(Runnable::run);
        check(!state.unfinished() && safety.locked() && Arrays.equals(replies,new int[]{0,0,1}),"late return stays locked");
        safety.recoveryBind(state.unfinished());
        queued.clear(); completion.clear(); timers.clear(); var cancelled = new GridReadJob.State();
        GridReadJob.start(queued::add,(r,d)->(d==0?completion:timers).add(r),()->{ throw new AssertionError("cancelled task ran"); },
            r->{throw new AssertionError();},e->{throw new AssertionError();},()->{},cancelled);
        timers.getFirst().run(); queued.getFirst().run(); check(!cancelled.unfinished(),"timeout before entry skips work");
    }
    private static void editAndSelection() {
        var missing = new HashMap<>(); refuses(() -> GridAttachmentSymbols.existing(missing,"display"));
        check(missing.isEmpty(),"missing selection or journal creates no state");
        Object context = new Object(), manager = new Object(), document = new Object(), journal = new Object(), frame = new Object(), edit = new Object();
        var idle = new GridAttachmentSymbols.Edit(context,manager,document,journal,null,null,0,0,0,0,false,false);
        var owned = new GridAttachmentSymbols.Edit(context,manager,document,journal,frame,edit,1,1,0,0,false,true);
        GridAttachmentSymbols.idle(idle); GridAttachmentSymbols.requireNewEdit(idle,owned,edit);
        refuses(() -> GridAttachmentSymbols.idle(owned));
        refuses(() -> GridAttachmentSymbols.requireNewEdit(idle,idle,null));
        refuses(() -> GridAttachmentSymbols.requireNewEdit(idle,owned,new Object()));
        for (int variant = 0; variant < 11; variant++) {
            var changed = new GridAttachmentSymbols.Edit(variant==0?new Object():context,variant==1?new Object():manager,
                variant==2?new Object():document,variant==3?new Object():journal,variant==4?new Object():frame,
                variant==5?new Object():edit,1,variant==6?2:1,variant==7?1:0,variant==8?1:0,variant==9,variant!=10);
            refuses(() -> GridAttachmentSymbols.requireSameEdit(owned,changed,edit));
        }
        JsonObject json = new JsonObject(); Object state = new Object(), focus = new Object(), module = new Object();
        var selection = new GridAttachmentSymbols.Selection(context,state,focus,List.of(module),json);
        GridAttachmentSymbols.sameSelection(selection,selection);
        for (int variant = 0; variant < 4; variant++) {
            var changed = new GridAttachmentSymbols.Selection(variant==0?new Object():context,variant==1?new Object():state,
                variant==2?new Object():focus,variant==3?List.of(new Object()):List.of(module),json);
            refuses(() -> GridAttachmentSymbols.sameSelection(selection,changed));
        }
    }
    private static void captureBounds() throws Exception {
        var reader = GridAttachmentGraph.bounded(new GridGraphRead.Reader() {
            public String name(Object o) { return "test"; }
            public int classId(Object o) { return 1; }
            public List<?> properties(Object o) { return List.of(); }
            public int id(Object p) { return (int)p; }
            public String propertyName(Object p) { return "test"; }
            public boolean included(Object p,Object o) { return true; }
            public boolean relationship(Object p) { return true; }
            public int childCount(Object p,Object o) { return (int)o; }
            public Object child(Object p,Object o,int i) { throw new AssertionError("out-of-bound child read"); }
            public Object value(Object p,Object o) { return null; }
        });
        check(reader.childCount(6428,5)==5,"five members admitted");
        try { reader.childCount(6428,6); throw new AssertionError("six members admitted"); } catch (IllegalStateException expected) {}
        check(reader.childCount(7125,1)==1 && reader.childCount(7125,1)==1,"two cables admitted");
        try { reader.childCount(7125,1); throw new AssertionError("third cable admitted"); } catch (IllegalStateException expected) {}
    }
    private static void selectionWireRoundTrip() {
        Gson bridgeCodec = new Gson();
        JsonObject old = new JsonObject(); old.add("selected", new JsonArray()); old.add("focus", JsonNull.INSTANCE);
        check(!old.equals(JsonParser.parseString(bridgeCodec.toJson(old))),"V9 null-focus mismatch reproduced");
        for (String focus : new String[]{null, id(1)}) {
            JsonArray selected = new JsonArray(); if (focus != null) selected.add(focus);
            JsonObject nativeSelection = GridAttachmentSymbols.selectionJson(selected, focus);
            JsonObject result = new JsonObject(); result.add("selection", nativeSelection);
            JsonObject envelope = new JsonObject(); envelope.add("result", result);
            JsonObject wire = JsonParser.parseString(bridgeCodec.toJson(envelope)).getAsJsonObject().getAsJsonObject("result");
            check(wire.equals(result),"selection survives response encoding and request parsing");
            check(nativeSelection.has("focus") == (focus != null),"optional focus field");
            if (focus != null) check(nativeSelection.get("focus").getAsString().equals(focus),"focused UUID retained");
        }
    }
    private static void refuses(Runnable action) {
        try { action.run(); } catch (RuntimeException expected) { return; }
        throw new AssertionError("expected refusal");
    }
    private static void check(boolean pass,String label) { if (!pass) throw new AssertionError(label); }
    public static void main(String[] args) throws Exception {
        Path jar = Path.of(args[0]);
        String hash = HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(jar)));
        check(hash.equals(GridReadSymbols.JAR_SHA256),"pinned host jar");
        try (var loader = new java.net.URLClassLoader(new java.net.URL[]{jar.toUri().toURL()}, ClassLoader.getPlatformClassLoader())) {
            new GridAttachmentSymbols.Symbols(loader);
        }
        System.out.println("Attachment native symbols resolve against pinned jar without initialization.");
    }
}
