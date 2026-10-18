package com.ghostnote.extension;

import com.google.gson.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

/** Offline signal, sequence, and note ownership failures. No live write is made. */
public final class GridEngineTest {
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
    private static void refuses(Runnable call) { try { call.run(); } catch (RuntimeException expected) { return; } throw new AssertionError("expected refusal"); }
    private static GridEngineWindow window(String name) { return new GridEngineWindow(name,"track","master","gen",0,10000,0); }
    private static void sample(GridEngineWindow w, int kind, int value, long ms) { w.sample(kind,value,kind == 1 ? "master" : "track",ms*1_000_000,10000+ms); }
    private static JsonObject collect(GridEngineWindow w, long end) { return w.collect(1250_000_000L,11250,new long[]{9900,9900},new long[]{end,end}); }
    private static GridEngineWindow pulse(int peak, String fault) {
        GridEngineWindow w = window("B+"); sample(w,0,0,100); w.on(250_000_000L);
        if (!fault.equals("missing-note")) sample(w,2,fault.equals("foreign-note") ? 61 : 60,300);
        sample(w,1,fault.equals("master") ? 2 : 0,450);
        if (!fault.equals("suppressed")) sample(w,0,peak,500);
        if (!fault.equals("off-failed")) { w.off(850_000_000L); sample(w,2,0,900); }
        sample(w,0,0,1100); return w;
    }
    private static void signals() {
        check(collect(pulse(80,""),11200).get("available").getAsBoolean(),"positive signal");
        check(collect(pulse(0,""),11200).get("available").getAsBoolean(),"zero with fresh packets and notes");
        for (String fault : List.of("missing-note","foreign-note","master","suppressed","off-failed"))
            check(!collect(pulse(80,fault),11200).get("available").getAsBoolean(),fault);
        check(!collect(pulse(0,""),9900).get("available").getAsBoolean(),"zero without freshness is unavailable");
        check(!collect(pulse(80,""),13000).get("available").getAsBoolean(),"future packet");
        GridEngineWindow bind = window("Q0"); check(!collect(bind,11200).get("available").getAsBoolean(),"bind value cannot pass");
        for (String fault : List.of("overflow","order","clock","target")) {
            GridEngineWindow w = window("Q0");
            if (fault.equals("overflow")) for (int i=0;i<=2048;i++) sample(w,0,0,100);
            if (fault.equals("order")) { sample(w,0,0,200); sample(w,0,0,100); }
            if (fault.equals("clock")) w.sample(0,0,"track",100_000_000,13000);
            if (fault.equals("target")) w.sample(0,0,"replacement",100_000_000,10100);
            refuses(w::requireHealthy);
        }
        GridEngineWindow backlog = window("B+"); refuses(() -> backlog.on(500_000_000));
        GridEngineWindow consumed = pulse(80,""); collect(consumed,11200); refuses(() -> collect(consumed,11200));
        GridEngineProtocol.requireHalf(63,80,80);
        for (int half : new int[]{0,40,70,80}) refuses(() -> GridEngineProtocol.requireHalf(half,80,80));
        refuses(() -> GridEngineProtocol.requireHalf(63,80,100));
    }
    private static void protocol() {
        GridEngineProtocol p = new GridEngineProtocol(); p.begin(0); refuses(() -> p.begin(1)); refuses(() -> p.factory(1));
        p.signal("Q0",0,1); p.signal("B+",80,2); p.advance("stage1",3); p.signal("B0",0,4);
        p.advance("stage2",5); p.signal("B-return",80,6); p.factory(7); refuses(() -> p.factory(8));
        p.fail("disconnect"); refuses(() -> p.advance("stage3",9)); refuses(() -> p.recovery(true)); p.recovery(false); refuses(() -> p.recovery(false));
        p.release(); refuses(() -> p.begin(10));
        for (String failure : List.of("meter-stale","graph-readback","factory","cable","value","delete","transport","target","overflow","deadline")) {
            GridEngineProtocol f = new GridEngineProtocol(); f.begin(0); f.fail(failure); refuses(() -> f.require("Q0",1));
            check(f.locked(),failure+" latches");
        }
        GridEngineProtocol deadline = new GridEngineProtocol(); deadline.begin(0); refuses(() -> deadline.require("Q0",60_000_000_001L));
    }
    private static void lease() {
        for (String fault : List.of("client-loss","target-before-on","target-before-off","on-failed","off-failed","abort","queued-late")) {
            Object original = new Object(); Object[] current = {original}; AtomicLong clock = new AtomicLong();
            List<Runnable> queue = new ArrayList<>(); List<String> writes = new ArrayList<>(); List<Exception> errors = new ArrayList<>();
            GridEngineWindow w = window("B+");
            GridEngineNoteLease lease = new GridEngineNoteLease(original,new GridEngineNoteLease.Host() {
                public void queue(Runnable r) { queue.add(r); }
                public Object target() { return current[0]; }
                public void guardOn() { w.requireHealthy(); }
                public void note(Object t, boolean on) {
                    check(t == original,"never address replacement"); writes.add(on?"on":"off");
                    if (fault.equals(on?"on-failed":"off-failed")) throw new IllegalStateException(fault);
                }
                public void failure(Exception error) { errors.add(error); }
            },w,clock::get);
            Map<Integer,Runnable> timers = new HashMap<>(); lease.schedule((r,d)->timers.put(d,r));
            check(timers.size()==2,"independent timers");
            if (fault.equals("target-before-on")) current[0] = new Object();
            if (fault.equals("abort")) w.abort("abort");
            clock.set(250_000_000); timers.get(250).run(); check(lease.unfinished(),"queued note unfinished");
            if (fault.equals("queued-late")) clock.set(900_000_000);
            queue.removeFirst().run(); check(!lease.unfinished(),"native completion");
            if (fault.equals("target-before-off")) current[0] = new Object();
            clock.set(850_000_000); timers.get(850).run(); while(!queue.isEmpty()) queue.removeFirst().run();
            if (Set.of("client-loss","on-failed","off-failed").contains(fault)) check(writes.equals(List.of("on","off")),fault);
            else if (fault.equals("target-before-off")) check(writes.equals(List.of("on")),fault);
            else check(writes.isEmpty(),fault);
        }
    }
    private static void identities() {
        Object[] original = {new Object(),new Object(),new Object(),new Object(),new Object()};
        for (int index=-1;index<5;index++) {
            GridEngineIdentity identity = new GridEngineIdentity(original[0],original[1],original[2],original[3],original[4]);
            identity.require(true,original[0],original[1],original[2],original[3],original[4]);
            Object[] changed = original.clone(); if (index>=0) changed[index] = new Object(); boolean connected = index>=0;
            refuses(() -> identity.require(connected,changed[0],changed[1],changed[2],changed[3],changed[4]));
            refuses(() -> identity.require(true,original[0],original[1],original[2],original[3],original[4]));
            identity.requireNoteTarget(original[1]); refuses(() -> identity.requireNoteTarget(new Object()));
            identity.release(); refuses(() -> identity.requireNoteTarget(original[1]));
        }
    }
    private static void graph() throws Exception {
        JsonObject graph = JsonParser.parseString(Files.readString(Path.of(System.getProperty("gridFixtureBaseline")))).getAsJsonObject().getAsJsonObject("graph");
        GridEngineGraph.baseline(graph);
        JsonObject witness = JsonParser.parseString("{\"parentsVerified\":true,\"selection\":{\"selected\":[]},\"edit\":{\"frames\":0,\"instant\":0,\"longer\":0,\"locks\":0,\"lockSet\":false,\"active\":false},\"rectangles\":[{\"x\":-4,\"y\":-2,\"width\":3,\"height\":2},{\"x\":-1,\"y\":-2,\"width\":1,\"height\":1},{\"x\":0,\"y\":-2,\"width\":1,\"height\":1},{\"x\":-1,\"y\":0,\"width\":1,\"height\":1}]}").getAsJsonObject();
        GridEngineGraph.baselineWitness(witness);
        witness.getAsJsonArray("rectangles").get(1).getAsJsonObject().addProperty("height",2);
        refuses(() -> GridEngineGraph.baselineWitness(witness));
        JsonArray original = graph.getAsJsonArray("nodes").deepCopy();
        graph.add("nodes",GridEngineGraph.expected(graph,1));
        check(GridFixtureValue.scalar(GridFixtureValue.node(graph,GridEngineGraph.atom(graph,1,1)),712).getAsDouble()==0,"original amplifier muted");
        graph.add("nodes",GridEngineGraph.expected(graph,2)); check(graph.getAsJsonArray("nodes").equals(original),"exact calibration restore");
        JsonObject life = JsonParser.parseString(Files.readString(Path.of(System.getProperty("gridDetachedBaseline")))).getAsJsonObject().getAsJsonObject("lifecycle");
        JsonObject attached = new JsonObject(); attached.addProperty("managedObjectId",4000); attached.addProperty("managedObjectRegistered",true);
        graph.add("nodes",GridAttachmentGraph.expectedNodes(graph,life.getAsJsonObject("capture0"),attached));
        for (int stage=4;stage<=11;stage++) {
            graph.add("nodes",GridEngineGraph.expected(graph,stage));
            check(graph.getAsJsonArray("nodes").size()==(stage==11?53:61),"stage count "+stage);
            check(GridEngineGraph.reorder(graph).equals(graph.getAsJsonArray("nodes")),"canonical traversal "+stage);
        }
        check(graph.getAsJsonArray("nodes").equals(original),"exact eleven-stage restore");
    }
    public static void run() throws Exception { signals(); protocol(); lease(); identities(); graph(); System.out.println("Engine signal, sequence, graph, and note ownership checks pass."); }
    public static void main(String[] args) throws Exception {
        Path jar=Path.of(args[0]);
        check(HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(jar))).equals(GridReadSymbols.JAR_SHA256),"pinned jar");
        try(var loader=new java.net.URLClassLoader(new java.net.URL[]{jar.toUri().toURL(),jar.resolveSibling("libs.jar").toUri().toURL()},ClassLoader.getPlatformClassLoader())) { new GridEngineSymbols.Symbols(loader); }
        System.out.println("Engine native symbols resolve without vendor initialization.");
    }
}
