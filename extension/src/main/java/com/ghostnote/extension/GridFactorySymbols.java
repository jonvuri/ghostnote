package com.ghostnote.extension;

import com.google.gson.*;
import java.lang.reflect.*;
import java.util.*;
import static com.ghostnote.extension.GridFixtureValue.*;

/** Fixed V8 factory and lifecycle symbols. GridReadSymbols checks the host jar. */
public final class GridFactorySymbols implements GridDetachedFactory.Host {
    public static final String TYPE = "a6cd650b-c4de-46c6-8741-c07a0a9bfec2";
    private final GridReadSymbols symbols;
    private final Set<String> liveUuids;
    private final Class<?> moduleClass;
    private final Method factory, owner, children, disposed, dispose, parent, uuid;
    private final Field helper, remoteHelper;

    public GridFactorySymbols(GridReadSymbols symbols, ClassLoader loader, List<String> liveUuids) throws Exception {
        this.symbols = symbols; this.liveUuids = Set.copyOf(liveUuids);
        moduleClass = Class.forName("com.bitwig.flt.document.core.master.device.DbL", false, loader);
        Class<?> base = Class.forName("com.bitwig.ramona.core.HEV", false, loader);
        Class<?> device = Class.forName("com.bitwig.flt.document.core.master.device.OEf", false, loader);
        factory = moduleClass.getMethod("pvN", UUID.class);
        owner = base.getMethod("I_"); children = base.getMethod("dpx", String.class);
        disposed = base.getMethod("J_"); dispose = base.getMethod("dC_");
        parent = moduleClass.getMethod("Fuu"); uuid = device.getMethod("VEb");
        helper = device.getDeclaredField("kyi"); remoteHelper = device.getDeclaredField("rdo");
        helper.setAccessible(true); remoteHelper.setAccessible(true);
    }

    public static GridFixtureCable.Input parse(JsonObject params) {
        if (params.has("before") || params.has("after") || params.has("typeUuid"))
            throw new IllegalArgumentException("factory type and baseline are fixed");
        JsonObject guard = params.deepCopy();
        guard.addProperty("before", "none"); guard.addProperty("after", "sine");
        return GridFixtureCable.parse(guard);
    }

    public Object create() throws Exception { return factory.invoke(null, UUID.fromString(TYPE)); }
    public Object owner(Object object) throws Exception { return owner.invoke(object); }
    public List<?> children(Object object) throws Exception { return (List<?>) children.invoke(object, new Object[]{null}); }
    public boolean disposed(Object object) throws Exception { return (boolean) disposed.invoke(object); }
    public void dispose(Object object) throws Exception { dispose.invoke(object); }
    public void requireRoot(Object module) throws Exception {
        if (module == null || module.getClass() != moduleClass || owner(module) != null || parent.invoke(module) != null)
            throw new IllegalStateException("factory-result-not-detached-module");
        Object id = uuid.invoke(module);
        if (!(id instanceof UUID) || liveUuids.contains(id.toString()))
            throw new IllegalStateException("factory-module-uuid-not-fresh");
    }
    public void requireInitialized(Object module) throws Exception {
        if (helper.get(module) == null || remoteHelper.get(module) == null)
            throw new IllegalStateException("factory-initialization-helpers-missing");
        Object contents = new GridReadExplore(symbols).navigate(module,
            List.of(new GridReadExplore.Step("module", 406, "device_contents", 0)));
        if (owner(contents) != module) throw new IllegalStateException("factory-contents-not-owned");
    }
    public JsonObject capture(Object module) throws Exception {
        GridReadExplore explore = new GridReadExplore(symbols);
        JsonObject graph = new GridGraphRead(explore.project(query().projection())).capture(module);
        graph.addProperty("queryWork", explore.workUnits());
        for (int i = 0; i < 3; i++)
            graph.addProperty("encodedBytes", graph.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length);
        requireGraph(graph, uuid.invoke(module).toString());
        return graph;
    }
    public static void requireGraph(JsonObject graph, String uuid) {
        if (!graph.get("complete").getAsBoolean() || graph.get("errorCount").getAsInt() != 0
                || graph.getAsJsonArray("nodes").size() != 8)
            throw new IllegalStateException("detached-graph-incomplete-or-outside-limit");
        JsonObject module = node(graph, graph.get("root").getAsInt());
        JsonArray contents = refs(module, 406);
        if (!module.get("className").getAsString().equals("module") || contents.size() != 1
                || !scalar(module, 15).getAsString().equals(uuid)
                || !scalar(module, 404).getAsString().equals("Amplify"))
            throw new IllegalStateException("detached-module-changed");
        JsonObject body = node(graph, contents.get(0).getAsInt());
        if (!body.get("className").getAsString().equals("module_contents")
                || !scalar(body, 6369).getAsString().equals(TYPE) || refs(body, 173).size() != 6)
            throw new IllegalStateException("detached-contents-changed");
        for (JsonElement item : graph.getAsJsonArray("nodes")) {
            JsonObject atom = item.getAsJsonObject();
            if (atom.get("className").getAsString().equals("audio_destination_atom") && !refs(atom, 7125).isEmpty())
                throw new IllegalStateException("detached-input-connected");
        }
    }
}
