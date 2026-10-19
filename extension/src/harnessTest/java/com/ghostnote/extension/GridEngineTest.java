package com.ghostnote.extension;

import com.google.gson.*;
import java.nio.file.*;
import java.util.*;

/** Offline operator gates, sequence, and failure evidence. No live write is made. */
public final class GridEngineTest {
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
    private static void refuses(Runnable call) { try { call.run(); } catch (RuntimeException expected) { return; } throw new AssertionError("expected refusal"); }
    private static void ack(GridEngineProtocol p, String name, long now) {
        check(p.acknowledge(p.session(), name, "yes", "yes", now, now, now, now), "yes accepted");
    }
    private static void protocol() {
        GridEngineProtocol p = new GridEngineProtocol(); p.begin(0,0);
        refuses(() -> p.begin(1,1)); refuses(() -> p.advance("stage1",1,1)); refuses(() -> p.factory(1));
        refuses(() -> p.acknowledge("wrong", "B+", "yes", "yes", 1,1,1,1));
        refuses(() -> p.acknowledge(p.session(), "B+", "yes", "é".repeat(65), 1,1,1,1));
        refuses(() -> p.acknowledge(p.session(), "B+", "yes", "yes", 2,1,1,1));
        refuses(() -> ack(p,"B0",1));
        ack(p,"B+",120_000_000_000L); // Human wait does not use the segment allowance.
        refuses(() -> ack(p,"B+",120_000_000_001L));
        p.advance("stage1",120_000_000_001L,120_000_000_001L);
        ack(p,"B0",120_000_000_002L); p.advance("stage2",120_000_000_003L,120_000_000_003L);
        ack(p,"B-return",120_000_000_004L); p.factory(120_000_000_005L); refuses(() -> p.factory(120_000_000_006L));
        JsonObject context = new JsonObject(); context.addProperty("nativeUnfinished",true);
        p.fail("disconnect",context,120_000_000_007L,42);
        JsonObject frozen = p.status().getAsJsonObject("firstFailure").deepCopy();
        context.addProperty("nativeUnfinished",false); p.fail("later",context,99,99);
        p.status().getAsJsonObject("firstFailure").addProperty("reason","changed");
        check(p.status().getAsJsonObject("firstFailure").equals(frozen),"first failure is immutable");
        refuses(() -> p.advance("stage3",120_000_000_008L,42)); refuses(() -> p.recovery(true));
        p.recovery(false); refuses(() -> p.recovery(false)); p.release(); refuses(() -> p.begin(200,200));
        GridEngineProtocol segment = new GridEngineProtocol(); segment.begin(0,0); ack(segment,"B+",1);
        refuses(() -> segment.require("stage1",60_000_000_002L));
        GridEngineProtocol total = new GridEngineProtocol(); total.begin(0,0);
        refuses(() -> ack(total,"B+",900_000_000_001L));
        for (String verdict : List.of("no","unsure")) {
            GridEngineProtocol f = new GridEngineProtocol(); f.begin(0,0);
            check(!f.acknowledge(f.session(),"B+",verdict,verdict,1,1,1,1),"negative answer");
            f.fail("operator-"+verdict,new JsonObject(),1,1);
            check(f.status().getAsJsonObject("firstFailure").getAsJsonArray("answers").size()==1,"negative answer frozen");
            refuses(() -> f.advance("stage1",2,2));
        }
        GridEngineProtocol all = new GridEngineProtocol(); all.begin(0,0);
        check(all.acknowledge(all.session(),"B+","yes","\u0001".repeat(127)+"x",1,1,1,1),"maximum first answer");
        Map<Integer,String> gates=Map.of(1,"B0",2,"B-return",5,"N+",6,"N0",7,"N-half",8,"N-return",11,"R+");
        for(int stage=1;stage<=11;stage++) {
            all.advance("stage"+stage,stage*2,stage*2);
            if(gates.containsKey(stage)) check(all.acknowledge(all.session(),gates.get(stage),"yes","\u0001".repeat(127)+"x",
                stage*2+1,stage*2+1,stage*2+1,stage*2+1),"maximum escaped answer");
        }
        check(all.complete(),"all eight answers and eleven stages required");
        refuses(() -> ack(all,"R+",99));
        JsonObject maximumContext = new JsonObject(); maximumContext.addProperty("data","x".repeat(3000));
        all.fail("x".repeat(1000),maximumContext,100,100);
        check(GridEngineProtocol.encoded(all.status())<32*1024,"status cap");
        check(GridEngineProtocol.encoded(all.status().get("firstFailure"))<16*1024,"evidence cap");
        check(all.status().getAsJsonObject("firstFailure").get("reason").getAsString().length()==512,"reason cap");
        check(GridEngineProtocol.muteMatches(true,false) && GridEngineProtocol.muteMatches(false,true),"mute boundaries");
        check(!GridEngineProtocol.muteMatches(true,true) && !GridEngineProtocol.muteMatches(false,false),"mute mismatch");
    }
    private static void lifetime() {
        Bridge.ClientLifetime life = new Bridge.ClientLifetime(); int[] calls={0};
        check(life.connected(),"client initially connected"); life.observe(() -> calls[0]++);
        life.close(); life.close(); check(!life.connected() && calls[0]==1,"disconnect once");
        life.observe(() -> calls[0]++); check(calls[0]==2,"late listener sees disconnect");
    }
    private static void identities() {
        Object[] original = {new Object(),new Object(),new Object()};
        for (int index=-1;index<3;index++) {
            GridEngineIdentity identity = new GridEngineIdentity(original[0],original[1],original[2]);
            identity.require(true,original[0],original[1],original[2]);
            Object[] changed = original.clone(); if (index>=0) changed[index] = new Object(); boolean connected = index>=0;
            refuses(() -> identity.require(connected,changed[0],changed[1],changed[2]));
            refuses(() -> identity.require(true,original[0],original[1],original[2])); identity.release();
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
    public static void run() throws Exception { protocol(); lifetime(); identities(); graph(); System.out.println("Engine operator gates, lifetime, sequence, and graph checks pass."); }
    public static void main(String[] args) throws Exception {
        Path jar=Path.of(args[0]);
        check(HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(jar))).equals(GridReadSymbols.JAR_SHA256),"pinned jar");
        try(var loader=new java.net.URLClassLoader(new java.net.URL[]{jar.toUri().toURL(),jar.resolveSibling("libs.jar").toUri().toURL()},ClassLoader.getPlatformClassLoader())) { new GridEngineSymbols.Symbols(loader); }
        System.out.println("Engine native symbols resolve without vendor initialization.");
    }
}
