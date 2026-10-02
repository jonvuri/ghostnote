package com.ghostnote.extension;

import com.google.gson.JsonObject;

/** Check mutable scene guards without a running host. */
public final class ShadowSceneControlTest {
    private static final class Fake implements ShadowSceneControl.Source {
        int count = 2, offset, writes, reads, changeAtRead = -1;
        String[] names = {"Scene 1", "Scene 2"};
        boolean badPosition, failName, silentCountChange;
        ShadowSceneControl control;
        @Override public int totalCount() { return count; }
        @Override public int scrollPosition() { return offset; }
        @Override public boolean exists(int index) { return index < count; }
        @Override public String name(int index) {
            reads++; if (reads == changeAtRead) control.changed();
            if (failName) throw new IllegalStateException("name unavailable");
            if (silentCountChange) { silentCountChange = false; count = 3; }
            return index < names.length ? names[index] : "extra";
        }
        @Override public int position(int index) { return badPosition ? index + 1 : index; }
        @Override public void setName(int index, String name) { writes++; names[index] = name; }
        ShadowSceneControl create(int size) { control = new ShadowSceneControl(this, size); return control; }
    }
    public static void main(String[] args) {
        Fake f = new Fake(); ShadowSceneControl c = f.create(128); JsonObject s = c.snapshot();
        check(s.get("sceneControlRevision").getAsString().equals(ShadowSceneControl.REVISION), "scene marker");
        check(s.getAsJsonArray("scenes").size() == 128 && s.get("coherent").getAsBoolean() && s.get("fullWindow").getAsBoolean(), "bounded readable snapshot");
        check(!s.get("sceneIdentityProved").getAsBoolean() && !s.get("hostInputOrderingProved").getAsBoolean(), "no identity promotion");
        JsonObject result = c.setSceneName(1, "Scene 2", 1, 2, 128, "gn-owned-tail");
        check(f.writes == 1 && f.names[1].equals("gn-owned-tail"), "only guarded scene renamed");
        check(result.get("renameDispatched").getAsBoolean() && !result.get("renameConfirmed").getAsBoolean(), "dispatch is not settlement");
        check(result.getAsJsonObject("before").getAsJsonArray("scenes").get(1).getAsJsonObject().get("name").getAsString().equals("Scene 2"), "retain old name");
        f = new Fake(); c = f.create(128); final ShadowSceneControl guarded = c;
        refuses(() -> guarded.setSceneName(1, "other", 1, 2, 128, "new"));
        refuses(() -> guarded.setSceneName(1, "Scene 2", 1, 3, 128, "new"));
        refuses(() -> guarded.setSceneName(1, "Scene 2", 0, 2, 128, "new"));
        refuses(() -> guarded.setSceneName(2, "", 2, 2, 128, "new"));
        f.offset = 1; refuses(() -> guarded.setSceneName(1, "Scene 2", 1, 2, 128, "new"));
        f.offset = 0; f.badPosition = true; refuses(() -> guarded.setSceneName(1, "Scene 2", 1, 2, 128, "new"));
        check(f.writes == 0, "changed scope never writes");
        f = new Fake(); final ShadowSceneControl bounded = f.create(256);
        check(bounded.snapshot().get("bankSize").getAsInt() == 128, "configured window bounded");
        refuses(() -> bounded.setSceneName(-1, "", -1, 2, 128, "new"));
        refuses(() -> bounded.setSceneName(128, "", 128, 2, 128, "new"));
        refuses(() -> bounded.setSceneName(1, "Scene 2", 1, 2, 256, "new"));
        refuses(() -> bounded.setSceneName(1, "Scene 2", 1, 2, 128, " "));
        refuses(() -> bounded.setSceneName(1, "Scene 2", 1, 2, 128, "x".repeat(129)));
        f.count = 129; refuses(() -> bounded.setSceneName(1, "Scene 2", 1, 129, 128, "new"));
        check(f.writes == 0, "bounds never write");
        f = new Fake(); c = f.create(128); f.changeAtRead = 1; s = c.snapshot();
        check(!s.get("coherent").getAsBoolean(), "callback races snapshot");
        f.reads = 0; f.changeAtRead = 3; final ShadowSceneControl racing = c;
        refuses(() -> racing.setSceneName(1, "Scene 2", 1, 2, 128, "new")); check(f.writes == 0, "fresh guard callback refuses");
        f = new Fake(); final ShadowSceneControl errors = f.create(128); f.failName = true; s = errors.snapshot();
        check(!s.get("coherent").getAsBoolean() && !s.get("fullWindow").getAsBoolean(), "read errors diagnostic");
        check(s.getAsJsonArray("scenes").get(0).getAsJsonObject().has("readError"), "row error retained");
        refuses(() -> errors.setSceneName(1, "Scene 2", 1, 2, 128, "new")); check(f.writes == 0, "read error refuses write");
        f = new Fake(); c = f.create(128); f.silentCountChange = true; s = c.snapshot();
        check(!s.get("coherent").getAsBoolean() && !s.get("callbacksChangedDuringRead").getAsBoolean(), "post-count detects change without callback");
        check(!s.get("hostInputOrderingProved").getAsBoolean(), "coherence is not delivery ordering");
        System.out.println("Shadow scene controls: 7 test groups passed.");
    }
    private static void refuses(Runnable action) {
        try { action.run(); } catch (IllegalArgumentException | IllegalStateException expected) { return; }
        throw new AssertionError("expected refusal");
    }
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
}
