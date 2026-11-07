package com.ghostnote.extension;

import com.bitwig.extension.controller.api.*;
import com.google.gson.JsonObject;
import java.lang.reflect.*;
import java.util.*;

/** Check write admission and one-attempt behavior; these proxies do not establish host pressure fidelity. */
public final class PressureProbeTest {
    private static final class Fake implements InvocationHandler {
        final Map<String, Object> children = new HashMap<>();
        Object value;
        boolean failPressure;
        int pressureCalls;
        int velocityCalls;
        @Override public Object invoke(Object proxy, Method method, Object[] args) {
            String name = method.getName();
            if (name.equals("setPressure")) {
                pressureCalls++;
                if (failPressure) throw new IllegalStateException("setter failed");
                return null;
            }
            if (name.equals("setVelocity")) { velocityCalls++; return null; }
            if (name.equals("set")) { value = args[0]; return null; }
            Class<?> result = method.getReturnType();
            if (name.equals("get") && value != null) return value;
            if (name.equals("state")) return value == null ? NoteStep.State.NoteOn : value;
            if (result == void.class) return null;
            if (result == boolean.class) return false;
            if (result == int.class) return 0;
            if (result == double.class) return 0.0;
            if (result == String.class) return "";
            String key = name + Arrays.toString(args);
            // Each creation produces a separate observer/cache, unlike accessors.
            if (name.equals("createLauncherCursorClip")) key += children.size();
            return children.computeIfAbsent(key, ignored -> proxy(result));
        }
    }
    private static Object proxy(Class<?> type) {
        return Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, new Fake());
    }
    private static Fake fake(Object value) { return (Fake) Proxy.getInvocationHandler(value); }
    private static void set(Object value, Object content) { fake(value).value = content; }
    private static void target(Clip clip) {
        set(clip.exists(), true);
        set(clip.getTrack().name(), PressureProbe.TRACK);
        set(clip.getTrack().channelId(), "owned-id");
        set(clip.clipLauncherSlot().sceneIndex(), 0);
        set(clip.clipLauncherSlot().name(), "gn-r02-notes");
    }
    private static void refuses(Runnable action, String part) {
        try { action.run(); } catch (IllegalArgumentException failure) {
            if (!failure.getMessage().contains(part)) throw new AssertionError(failure);
            return;
        }
        throw new AssertionError("did not refuse: " + part);
    }
    public static void main(String[] args) throws Exception {
        CursorTrack track = (CursorTrack) proxy(CursorTrack.class);
        String[] session = {"generation:project"};
        PressureProbe probe = new PressureProbe(track, () -> session[0]);
        List<PinnableCursorClip> clips = fake(track).children.values().stream()
            .map(value -> (PinnableCursorClip) value).toList();
        if (clips.size() != 2 || clips.get(0) == clips.get(1)) throw new AssertionError("independent clips");
        Clip source = (Clip) proxy(Clip.class);
        refuses(() -> probe.point(source, false, false), "exact owned");
        target(source);
        for (PinnableCursorClip clip : clips) target(clip);
        refuses(() -> probe.write("pressure"), "unbound");
        probe.point(source, false, false);
        refuses(() -> probe.write("pressure"), "500 ms");
        Thread.sleep(510);
        set(clips.get(0).getStep(1, 4, 62), NoteStep.State.Empty);
        refuses(() -> probe.write("pressure"), "note identity");
        set(clips.get(0).getStep(1, 4, 62), NoteStep.State.NoteOn);
        session[0] = "another-generation:project";
        refuses(() -> probe.write("pressure"), "session changed");
        session[0] = "generation:project";
        set(clips.get(0).getTrack().channelId(), "foreign-id");
        refuses(() -> probe.write("pressure"), "target or clip pin");
        set(clips.get(0).getTrack().channelId(), "owned-id");
        for (PinnableCursorClip clip : clips) fake(clip.getStep(0, 8, 64)).failPressure = true;
        try { probe.write("pressure"); throw new AssertionError("setter did not throw"); }
        catch (IllegalStateException expected) { /* A thrown setter still consumes the case. */ }
        refuses(() -> probe.write("pressure"), "already attempted");
        probe.write("velocity");
        refuses(() -> probe.write("velocity"), "already attempted");
        int pressure = 0, velocity = 0;
        for (PinnableCursorClip clip : clips) {
            pressure += fake(clip.getStep(0, 8, 64)).pressureCalls;
            velocity += fake(clip.getStep(0, 12, 65)).velocityCalls;
        }
        if (pressure != 1 || velocity != 1) throw new AssertionError("more than one setter call");
        JsonObject read = probe.read();
        if (read.getAsJsonObject("reader").getAsJsonArray("notes").size() != 4)
            throw new AssertionError("fixture read missing");
        System.out.println("Pressure probe admission and one-attempt checks pass.");
    }
}
