package com.ghostnote.extension;

import com.google.gson.*;
import java.net.URLClassLoader;
import java.nio.file.*;
import java.util.*;

/** Candidate metadata and protocol failures. No vendor class is initialized. */
public final class GridDoctorTest {
    interface Work { void run() throws Exception; }
    static int tests;
    static void refuses(Work work) throws Exception {
        tests++;
        try { work.run(); } catch (IllegalStateException | IllegalArgumentException | NullPointerException expected) { return; }
        throw new AssertionError("expected refusal");
    }
    static final class Host implements GridDoctorProtocol.Host {
        int value, writes; boolean throwsAfterWrite, invalid;
        public JsonObject read() { JsonObject r = new JsonObject(); r.addProperty("value", value); return r; }
        public void validate(JsonObject r, int stage) { if (invalid) throw new IllegalStateException("invalid-readback"); }
        public JsonObject command(String action) {
            writes++; value++;
            if (throwsAfterWrite) throw new IllegalStateException("uncertain-command");
            return new JsonObject();
        }
    }
    static void pair(GridDoctorProtocol p, Host h) throws Exception { p.read(h); p.read(h); }
    public static void main(String[] args) throws Exception {
        tests += GridDoctorUndoTest.run();
        GridDoctorProtocol p = new GridDoctorProtocol(); Host h = new Host();
        refuses(p::action); refuses(() -> p.release(false)); p.read(h); refuses(p::action); p.read(h);
        refuses(() -> p.read(h)); refuses(() -> p.command("attach", h, () -> {}));
        for (String action : GridDoctorProtocol.ACTIONS) {
            p.command(action, h, () -> {}); refuses(p::action); pair(p, h);
        }
        p.release(false); refuses(p::action); refuses(() -> p.read(h));
        if (h.writes != 12) throw new AssertionError("command budget"); tests++;
        GridDoctorProtocol stale = new GridDoctorProtocol(); Host changed = new Host(); pair(stale, changed); changed.value++;
        refuses(() -> stale.command("value-set", changed, () -> {}));
        if (changed.writes != 0 || !stale.status().get("locked").getAsBoolean()) throw new AssertionError("stale write");
        stale.release(true);
        GridDoctorProtocol uncertain = new GridDoctorProtocol(); Host failure = new Host(); pair(uncertain, failure); failure.throwsAfterWrite = true;
        refuses(() -> uncertain.command("value-set", failure, () -> {})); refuses(() -> uncertain.command("value-set", failure, () -> {}));
        refuses(() -> uncertain.release(true)); refuses(() -> uncertain.release(false));
        uncertain.inspect(); uncertain.inspect(); refuses(uncertain::inspect);
        if (failure.writes != 1) throw new AssertionError("uncertain command repeated");
        GridDoctorProtocol mismatch = new GridDoctorProtocol(); Host mismatchHost = new Host(); mismatch.read(mismatchHost); mismatchHost.value++;
        refuses(() -> mismatch.read(mismatchHost));
        GridDoctorProtocol guard = new GridDoctorProtocol(); Host guarded = new Host(); pair(guard, guarded);
        refuses(() -> guard.command("value-set", guarded, () -> { throw new IllegalStateException("selection-changed"); }));
        if (guarded.writes != 0) throw new AssertionError("guarded write");
        JsonObject candidate = GridDoctorSymbols.resource("grid-doctor-candidate.json"), rules = GridDoctorSymbols.resource("grid-doctor-selectors.json");
        GridDoctorSymbols.validateReport(candidate, rules); tests++;
        JsonObject missing = candidate.deepCopy(); missing.getAsJsonArray("members").remove(0);
        refuses(() -> GridDoctorSymbols.validateReport(missing, rules));
        JsonObject duplicate = candidate.deepCopy(); duplicate.getAsJsonArray("members").set(1, duplicate.getAsJsonArray("members").get(0));
        refuses(() -> GridDoctorSymbols.validateReport(duplicate, rules));
        JsonObject wrong = candidate.deepCopy(); wrong.getAsJsonArray("members").get(0).getAsJsonObject().addProperty("lookup", "cZl");
        refuses(() -> GridDoctorSymbols.validateReport(wrong, rules));
        JsonObject live = candidate.deepCopy(); live.getAsJsonObject("verdict").addProperty("liveValidation", "pass");
        refuses(() -> GridDoctorSymbols.validateReport(live, rules));
        Path jar = Path.of(args[0]);
        try (var loader = new URLClassLoader(new java.net.URL[]{jar.toUri().toURL(), jar.resolveSibling("libs.jar").toUri().toURL()},
                ClassLoader.getPlatformClassLoader())) {
            GridDoctorSymbols table = new GridDoctorSymbols(loader, jar, candidate, rules);
            if (table.metadata().get("members").getAsInt() != 76) throw new AssertionError("member count");
            if (table.type("project-root") == table.type("edit-document")) throw new AssertionError("receiver alias");
            new GridAttachmentSymbols.Symbols(table); new GridEngineSymbols.Symbols(table); new GridBreadthCommands(table);
            tests++;
            JsonObject wrongMtime = candidate.deepCopy(); wrongMtime.addProperty("jarMtimeNs", 0);
            refuses(() -> new GridDoctorSymbols(loader, jar, wrongMtime, rules));
            JsonObject wrongHash = candidate.deepCopy(); wrongHash.addProperty("jarSha256", "0".repeat(64));
            refuses(() -> new GridDoctorSymbols(loader, jar, wrongHash, rules));
            JsonObject wrongField = candidate.deepCopy(); wrongField.getAsJsonArray("members").get(0).getAsJsonObject().addProperty("name", "notARealMember");
            try { new GridDoctorSymbols(loader, jar, wrongField, rules); throw new AssertionError("fabricated member"); }
            catch (NoSuchMethodException expected) { tests++; }
        }
        System.out.println("Grid doctor: " + tests + " checks pass. No vendor initialization or live command.");
    }
}
