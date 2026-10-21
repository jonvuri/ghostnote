package com.ghostnote.extension;

import com.google.gson.JsonObject;
import java.util.function.Consumer;

/** Exercise the document replay boundary and the protocol latch with inert objects. */
final class GridDoctorUndoTest {
    interface Work { void run() throws Exception; }
    static int checks;
    static void require(boolean value) { checks++; if (!value) throw new AssertionError("Undo check"); }
    static void refuses(Work work) throws Exception {
        try { work.run(); } catch (IllegalStateException expected) { checks++; return; }
        throw new AssertionError("expected Undo refusal");
    }
    static final class Host implements GridDoctorUndo.Host {
        Object document = new Object(), manager = new Object(), journal = new Object();
        final Object owned = new Object(), prior = new Object();
        Object head = owned, recording, replayHead;
        boolean replay, replaying, active, enabled = true, available = true;
        boolean failReplay, skipReplayFlag, changeManager, wrongHead;
        int commands, states;
        public GridDoctorUndo.State state() {
            states++;
            return new GridDoctorUndo.State(document, manager, journal, head, recording, replayHead,
                replay, replaying, active, enabled, available);
        }
        public void undoDocument() {
            commands++; replaying = !skipReplayFlag; replayHead = head;
            // The real relationship hook must bypass recording during replay.
            if (!replaying && recording == null) throw new IllegalStateException("missing-replay-context");
            if (failReplay) throw new IllegalStateException("native-replay-failed");
            head = wrongHead ? new Object() : prior; replayHead = null; replaying = false;
            if (changeManager) manager = new Object();
        }
        void run() throws Exception { GridDoctorUndo.run(this, owned, prior, () -> {}); }
    }
    static int run() throws Exception {
        Host pass = new Host(); pass.run(); require(pass.commands == 1 && pass.states == 2 && pass.head == pass.prior);
        for (Consumer<Host> change : java.util.List.<Consumer<Host>>of(
                h -> h.recording = new Object(), h -> h.replayHead = h.owned,
                h -> h.replaying = true, h -> h.replay = true, h -> h.active = true,
                h -> h.enabled = false, h -> h.available = false, h -> h.head = h.prior,
                h -> h.document = null, h -> h.manager = null, h -> h.journal = null)) {
            Host h = new Host(); change.accept(h); refuses(h::run); require(h.commands == 0);
        }
        Host guard = new Host(); refuses(() -> GridDoctorUndo.run(guard, guard.owned, guard.prior,
            () -> { throw new IllegalStateException("stale-selection"); })); require(guard.commands == 0);
        Host manager = new Host(); manager.changeManager = true; refuses(manager::run); require(manager.commands == 1);
        Host head = new Host(); head.wrongHead = true; refuses(head::run); require(head.commands == 1);
        Host context = new Host(); context.skipReplayFlag = true; refuses(context::run);
        require(context.commands == 1 && context.replayHead == context.owned);
        for (String action : java.util.List.of("undo-delete", "undo-attach")) {
            Host nativeHost = new Host(); nativeHost.failReplay = true;
            GridDoctorProtocol protocol = new GridDoctorProtocol();
            GridDoctorProtocol.Host host = new GridDoctorProtocol.Host() {
                public JsonObject read() { return new JsonObject(); }
                public void validate(JsonObject value, int stage) {}
                public JsonObject command(String next) throws Exception {
                    if (next.equals(action)) nativeHost.run();
                    return new JsonObject();
                }
            };
            for (String next : GridDoctorProtocol.ACTIONS) {
                protocol.read(host); protocol.read(host);
                if (next.equals(action)) break;
                protocol.command(next, host, () -> {});
            }
            refuses(() -> protocol.command(action, host, () -> {}));
            require(nativeHost.commands == 1 && nativeHost.replaying && nativeHost.replayHead == nativeHost.owned);
            require(protocol.status().get("locked").getAsBoolean());
            refuses(() -> protocol.command(action, host, () -> {}));
            refuses(() -> protocol.release(true)); refuses(() -> protocol.release(false));
            require(nativeHost.commands == 1);
        }
        return checks;
    }
}
