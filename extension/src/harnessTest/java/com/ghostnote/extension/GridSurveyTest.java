package com.ghostnote.extension;

import com.google.gson.*;
import java.util.UUID;

/** Survey target, session, timeout, and retired audio-session controls. */
public final class GridSurveyTest {
    private static void check(boolean value) { if (!value) throw new AssertionError(); }
    private static void refuses(Runnable call) {
        try { call.run(); } catch (IllegalArgumentException | IllegalStateException expected) { return; }
        throw new AssertionError("expected refusal");
    }
    public static void run() {
        JsonObject p = new JsonObject();
        p.addProperty("project", "Any project"); p.addProperty("trackId", UUID.randomUUID().toString());
        p.addProperty("trackName", "Scratch"); p.addProperty("deviceIndex", 0);
        for (String name : new String[]{"Poly Grid", "FX Grid", "Note Grid", "Renamed native device"}) {
            p.addProperty("deviceName", name);
            var target = GridSurveySession.Target.parse(p, 16);
            GridSurveySession session = new GridSurveySession();
            refuses(() -> session.idle(true, false));
            refuses(() -> session.idle(false, true));
            session.idle(false, false); session.beginBind();
            refuses(() -> session.idle(false, false));
            Object document = new Object(), track = new Object(), device = new Object();
            GridReadEpoch epoch = new GridReadEpoch(document, track, device);
            session.bound(target, epoch); check(session.ownsGrid());
            refuses(session::beginBind);
            session.require(target, epoch.token).require(epoch.token, document, track, device);
            refuses(() -> session.require(target, "wrong"));
            refuses(() -> session.require(new GridSurveySession.Target("other", target.trackId(),
                target.trackName(), 0, name), epoch.token));
            session.beginCapture(); session.finish();
            session.release(epoch.token); check(!session.ownsGrid());
            session.idle(false, false); session.beginBind(); session.bound(target, new GridReadEpoch(document, track, device));
            session.timeout(); check(session.ownsGrid());
            refuses(() -> session.idle(false, false));
            session.finish(); refuses(() -> session.idle(false, false));
        }
        p.addProperty("deviceIndex", 16); refuses(() -> GridSurveySession.Target.parse(p, 16));
        p.addProperty("deviceIndex", -1); refuses(() -> GridSurveySession.Target.parse(p, 16));
        p.addProperty("deviceIndex", "0"); refuses(() -> GridSurveySession.Target.parse(p, 16));
        p.addProperty("deviceIndex", 0); p.addProperty("trackId", "not-a-uuid");
        refuses(() -> GridSurveySession.Target.parse(p, 16));
        GridEngineProtocol audio = new GridEngineProtocol();
        audio.begin(0, 0); check(audio.active()); audio.release();
        check(audio.used() && !audio.active());
        refuses(() -> audio.begin(1, 1));
        System.out.println("Survey target validation, repeated sessions, stale targets, exclusion, and timeout lock pass.");
    }
}
