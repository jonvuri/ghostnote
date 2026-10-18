package com.ghostnote.extension;

import java.lang.reflect.*;
import java.time.Instant;
import java.util.UUID;

/** Read-only engine and meter access, plus the exact Track note command body. */
public final class GridEngineSymbols {
    public static final class Symbols {
        final Class<?> document, meter, notes;
        final Method state, connection, channelMeter, meterValue, noteInput, noteOn, noteOff, velocity;
        final Field connected, inactive, packet;
        public Symbols(ClassLoader loader) throws Exception {
            document = Class.forName("com.bitwig.flt.document.core.master.Svr", false, loader);
            state = Class.forName("com.bitwig.flt.document.core.master.Ymq", false, loader).getMethod("AAO");
            inactive = Class.forName("rjH", false, loader).getField("ffA");
            connection = document.getMethod("jnZ"); connected = Class.forName("rjH", false, loader).getField("cG3");
            channelMeter = Class.forName("com.bitwig.flt.document.core.iface.ytV", false, loader).getMethod("ZzB");
            meterValue = Class.forName("wEM", false, loader).getMethod("pvN");
            meter = Class.forName("DxI", false, loader); packet = meter.getDeclaredField("EbT"); packet.setAccessible(true);
            notes = Class.forName("GkS", false, loader); noteInput = notes.getMethod("Ye3");
            Class<?> input = Class.forName("iwZ", false, loader);
            noteOn = input.getMethod("ffA", int.class, int.class, float.class);
            noteOff = input.getMethod("eOi", int.class, int.class, float.class);
            velocity = Class.forName("HLJ", false, loader).getMethod("ffA", int.class);
            if (packet.getType() != Instant.class || state.getReturnType() != connected.getType()
                    || !connection.getReturnType().getName().equals("cYQ") || noteInput.getReturnType() != input
                    || noteOn.getReturnType() != void.class || noteOff.getReturnType() != void.class || velocity.getReturnType() != float.class)
                throw new IllegalStateException("engine-symbol-signature");
        }
    }
    private final Symbols s;
    private GridEngineIdentity identity;
    public final String generation = UUID.randomUUID().toString();
    public GridEngineSymbols(ClassLoader loader) throws Exception { s = new Symbols(loader); }
    private Object meter(Object channel) throws Exception {
        Object value = s.meterValue.invoke(s.channelMeter.invoke(channel));
        if (value == null || value.getClass() != s.meter) throw new IllegalStateException("engine-existing-meter-absent");
        return value;
    }
    public void bind(Object document, Object channel, Object master) throws Exception {
        if (identity != null) throw new IllegalStateException("engine-already-bound");
        Object c = connected(document), a = meter(channel), b = meter(master);
        if (!s.notes.isInstance(channel) || a == b || channel == master) throw new IllegalStateException("engine-channel-identity");
        identity = new GridEngineIdentity(c, channel, master, a, b); packets(document, channel, master);
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
            s.connection.invoke(document), channel, master, meter(channel), meter(master));
    }
    public long[] packets(Object document, Object channel, Object master) throws Exception {
        require(document, channel, master);
        Object a = s.packet.get(meter(channel)), b = s.packet.get(meter(master));
        if (!(a instanceof Instant) || !(b instanceof Instant)) throw new IllegalStateException("engine-packet-unavailable");
        return new long[]{((Instant)a).toEpochMilli(), ((Instant)b).toEpochMilli()};
    }
    public void note(Object channel, boolean on) throws Exception {
        if (identity == null) throw new IllegalStateException("engine-not-bound");
        identity.requireNoteTarget(channel);
        // AbstractTrackProxy startNote/stopNote use this body after exec().
        // Run it inside our guarded document task to prevent a target change in a second queue.
        (on ? s.noteOn : s.noteOff).invoke(s.noteInput.invoke(channel), 0, 60, s.velocity.invoke(null, on ? 80 : 0));
    }
    public void release() { if (identity != null) identity.release(); identity = null; }
}
