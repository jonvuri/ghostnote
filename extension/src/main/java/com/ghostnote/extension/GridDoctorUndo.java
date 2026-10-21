package com.ghostnote.extension;

/** Admit one owned document Undo. Native exceptions must retain the caller's latch. */
public final class GridDoctorUndo {
    public record State(Object document, Object manager, Object journal, Object head,
                        Object recordingEdit, Object replayHead, boolean replay,
                        boolean replaying, boolean active, boolean enabled, boolean available) {}
    public interface Host {
        State state() throws Exception;
        void undoDocument() throws Exception;
    }
    private static void idle(State s) {
        if (s.document == null || s.manager == null || s.journal == null || s.recordingEdit != null
                || s.replayHead != null || s.replay || s.replaying || s.active)
            throw new IllegalStateException("doctor-undo-context-not-idle");
    }
    public static void run(Host host, Object owned, Object prior, GridDoctorProtocol.Guard guard) throws Exception {
        State before = host.state(); idle(before);
        if (owned == null || owned == prior || before.head != owned || !before.enabled || !before.available)
            throw new IllegalStateException("doctor-undo-edit-changed-or-disabled");
        guard.check();
        // The document method owns the replay flag. Do not reset native state on an exception.
        host.undoDocument();
        State after = host.state(); idle(after);
        if (after.document != before.document || after.manager != before.manager || after.journal != before.journal
                || after.head != prior)
            throw new IllegalStateException("doctor-undo-return-state");
        // This check proves command context only. Two later graph reads must prove restoration.
    }
    private GridDoctorUndo() {}
}
