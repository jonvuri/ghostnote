package com.ghostnote.extension;

import java.lang.reflect.*;
import java.util.UUID;

/** Engine connection guards only. No meter access or note commands. */
public final class GridEngineSymbols {
    public static final class Symbols {
        final Class<?> document;
        final Method state, connection;
        final Field connected, inactive;
        public Symbols(ClassLoader loader) throws Exception {
            document = Class.forName("com.bitwig.flt.document.core.master.Svr", false, loader);
            state = Class.forName("com.bitwig.flt.document.core.master.Ymq", false, loader).getMethod("AAO");
            inactive = Class.forName("rjH", false, loader).getField("ffA");
            connection = document.getMethod("jnZ"); connected = Class.forName("rjH", false, loader).getField("cG3");
            if (state.getReturnType() != connected.getType() || !connection.getReturnType().getName().equals("cYQ"))
                throw new IllegalStateException("engine-symbol-signature");
        }
        public Symbols(GridDoctorSymbols table) {
            document = table.type("project-root"); state = table.method("engine-state");
            connection = table.method("connection"); connected = table.field("connected-state");
            inactive = table.field("inactive-state");
        }
    }
    private final Symbols s;
    private GridEngineIdentity identity;
    public final String generation = UUID.randomUUID().toString();
    public GridEngineSymbols(ClassLoader loader) throws Exception { s = new Symbols(loader); }
    public void bind(Object document, Object channel, Object master) throws Exception {
        if (identity != null || channel == master) throw new IllegalStateException("engine-binding");
        identity = new GridEngineIdentity(connected(document), channel, master);
    }
    public void requireInactive(Object document) throws Exception {
        if (!s.document.isInstance(document) || s.state.invoke(document) != s.inactive.get(null) || s.connection.invoke(document) != null)
            throw new IllegalStateException("engine-not-inactive");
    }
    private Object connected(Object document) throws Exception {
        if (!s.document.isInstance(document) || s.state.invoke(document) != s.connected.get(null)) throw new IllegalStateException("engine-not-connected");
        Object result = s.connection.invoke(document); if (result == null) throw new IllegalStateException("engine-connection-absent"); return result;
    }
    public void require(Object document, Object channel, Object master) throws Exception {
        if (identity == null) throw new IllegalStateException("engine-not-bound");
        identity.require(s.document.isInstance(document) && s.state.invoke(document) == s.connected.get(null),
            s.connection.invoke(document), channel, master);
    }
    public void release() { if (identity != null) identity.release(); identity = null; }
}
