package com.ghostnote.extension;

import com.google.gson.*;
import java.lang.reflect.Method;
import java.util.*;

/** Native work for one bound scratch case. Every read uses new descriptor state. */
public final class GridBreadthHost implements GridBreadthProtocol.Host {
    private final GridReadSymbols symbols;
    private final Object grid, document;
    private final String kind;
    private final GridBreadthCommands commands;
    private final GridBreadthWitness witness;
    private GridBreadthRead last;
    private JsonObject fixture, metrics = new JsonObject();
    private Object booleanAtom, source, destination, linear, detached;
    private GridFactorySymbols lifecycle;
    private List<Object> owned;
    private Method factory;
    private boolean disposed;
    private JsonObject detachedPair;
    public GridBreadthHost(GridReadSymbols symbols, Object grid, Object document, String kind) throws Exception {
        this.symbols = symbols; this.grid = grid; this.document = document; this.kind = kind;
        commands = new GridBreadthCommands(grid.getClass().getClassLoader());
        witness = new GridBreadthWitness(grid.getClass().getClassLoader());
    }
    public GridBreadthHost(GridReadSymbols symbols, GridDoctorSymbols table, Object grid, Object document, String kind) {
        if (!Set.of("boolean", "mapping").contains(kind)) throw new IllegalArgumentException("doctor-breadth-case");
        this.symbols = symbols; this.grid = grid; this.document = document; this.kind = kind;
        commands = new GridBreadthCommands(table); witness = new GridBreadthWitness(table);
    }
    public JsonObject metrics() { return metrics.deepCopy(); }
    public void requireTarget(Object grid, Object document) {
        if (this.grid != grid || this.document != document)
            throw new IllegalStateException("breadth-grid-target-changed");
    }
    @Override public JsonObject read() throws Exception {
        return read(false);
    }
    /** Keep descriptor evidence available when a witness no longer agrees. */
    public JsonObject inspect() throws Exception { return read(true); }
    private JsonObject read(boolean inspection) throws Exception {
        long start = System.nanoTime();
        last = new GridBreadthRead(symbols); fixture = last.fixture(grid, kind);
        JsonObject result = new JsonObject(); result.add("fixture", fixture);
        try {
            for (JsonElement entry : fixture.getAsJsonArray("modules")) {
                JsonObject module = entry.getAsJsonObject();
                if (!module.has("atoms")) continue;
                Object nativeModule = last.object(module.get("id").getAsString());
                Object contents = last.one(nativeModule, 406);
                for (JsonElement atom : module.getAsJsonArray("atoms"))
                    witness.requireAtom(nativeModule, contents,
                        last.object(atom.getAsJsonObject().get("id").getAsString()));
            }
            result.add("witness", witness.read(grid, document, fixture));
        }
        catch (Exception error) {
            if (!inspection) throw error;
            result.addProperty("witnessFailure", diagnostic(error));
        }
        if (detached != null) {
            try {
            if (disposed) {
                for (Object object : owned)
                    if (!lifecycle.disposed(object)) throw new IllegalStateException("breadth-disposal-not-proved");
                result.addProperty("disposed", true);
            } else {
                try { requireOwned(); lifecycle.requireInitialized(detached); }
                catch (Exception error) {
                    if (!inspection) throw error;
                    result.addProperty("ownershipFailure", diagnostic(error));
                }
                JsonObject all = new JsonObject();
                last.detachedScope(owned);
                JsonObject module = last.module(detached, true, all);
                // Detached audio inputs must have no external connection.
                for (JsonElement a : module.getAsJsonArray("atoms")) if (!inspection) {
                    JsonObject f = a.getAsJsonObject().getAsJsonObject("fields");
                    if (f.has("7125") && !f.getAsJsonArray("7125").isEmpty())
                        throw new IllegalStateException("breadth-detached-input-connected");
                }
                JsonObject state = new JsonObject(); state.add("module", module); state.add("mappings", all);
                if (owned != null) state.addProperty("ownedObjects", owned.size());
                result.add("detached", state);
                if (!inspection && detachedPair != null && !detachedPair.equals(state))
                    throw new IllegalStateException("breadth-detached-defaults-changed");
                if (!inspection) detachedPair = state.deepCopy();
            }
            } catch (Exception error) {
                if (!inspection) throw error;
                result.addProperty("detachedFailure", diagnostic(error));
            }
            if (inspection) {
                JsonObject disposal = new JsonObject();
                disposal.addProperty("rootDisposed", lifecycle.disposed(detached));
                if (owned != null) {
                    int count = 0;
                    for (Object object : owned) if (lifecycle.disposed(object)) count++;
                    disposal.addProperty("ownedObjects", owned.size());
                    disposal.addProperty("disposedObjects", count);
                }
                result.add("disposalInspection", disposal);
            }
        }
        GridBreadthRead.bounded(result);
        metrics = new JsonObject(); metrics.addProperty("descriptorWork", last.work());
        metrics.addProperty("snapshotNanos", System.nanoTime() - start);
        return result;
    }
    private static String diagnostic(Exception error) {
        String text = error.toString(); return text.substring(0, Math.min(1024, text.length()));
    }
    private Object atom(int module, int index) {
        return last.object(GridBreadthRules.atom(fixture, module, index).get("id").getAsString());
    }
    @Override public void admit(String action) throws Exception {
        if (action.startsWith("boolean-")) {
            GridBreadthRules.gates(GridBreadthRules.module(fixture, 9));
            booleanAtom = atom(9, 7);
            if (booleanAtom.getClass() != commands.booleanAtom) throw new IllegalStateException("breadth-boolean-runtime");
        } else if (action.startsWith("mapping-")) {
            String mapping = GridBreadthRules.selectedMapping(fixture);
            if (action.equals("mapping-remove") != (mapping != null))
                throw new IllegalStateException("breadth-mapping-presence");
            source = atom(13, 1); destination = atom(24, 0);
            if (source.getClass() != commands.sourceAtom || !commands.targetAtom.isInstance(destination))
                throw new IllegalStateException("breadth-mapping-runtime");
            Object domain = commands.targetDomain.invoke(destination);
            double extent = (double) commands.domainExtent.invoke(domain);
            if (!Double.isFinite(extent) || extent < 129) throw new IllegalStateException("breadth-mapping-clamp");
            linear = null;
            for (Object value : commands.transfer.getEnumConstants()) {
                if (value.toString().equals("LINEAR")) {
                    if (linear != null) throw new IllegalStateException("breadth-transfer-ambiguous");
                    linear = value;
                }
            }
            if (linear == null) throw new IllegalStateException("breadth-transfer-absent");
        } else if (action.equals("factory-create")) {
            if (detached != null) throw new IllegalStateException("breadth-factory-used");
            List<String> uuids = new ArrayList<>();
            for (JsonElement module : fixture.getAsJsonArray("modules"))
                uuids.add(module.getAsJsonObject().get("uuid").getAsString());
            lifecycle = new GridFactorySymbols(symbols, grid.getClass().getClassLoader(), uuids);
            factory = Class.forName("com.bitwig.flt.document.core.master.device.DbL", false,
                grid.getClass().getClassLoader()).getMethod("pvN", UUID.class);
        } else if (action.equals("factory-dispose")) {
            if (disposed || detachedPair == null) throw new IllegalStateException("breadth-factory-not-read");
            requireOwned();
        } else throw new IllegalArgumentException("breadth-action");
    }
    private GridDetachedFactory.Host ownershipHost() {
        return new GridDetachedFactory.Host() {
            public Object create() { throw new UnsupportedOperationException(); }
            public void requireRoot(Object object) throws Exception { lifecycle.requireRoot(object); }
            public Object owner(Object object) throws Exception { return lifecycle.owner(object); }
            public List<?> children(Object object) throws Exception { return lifecycle.children(object); }
            public boolean disposed(Object object) throws Exception { return lifecycle.disposed(object); }
            public void requireInitialized(Object object) throws Exception { lifecycle.requireInitialized(object); }
            public JsonObject capture(Object object) { throw new UnsupportedOperationException(); }
            public void dispose(Object object) { throw new UnsupportedOperationException(); }
        };
    }
    private void requireOwned() throws Exception {
        if (detached == null || owned == null || disposed) throw new IllegalStateException("breadth-no-detached-owner");
        List<Object> current = GridDetachedFactory.ownership(ownershipHost(), detached);
        if (current.size() != owned.size()) throw new IllegalStateException("breadth-owned-tree-changed");
        for (int i = 0; i < current.size(); i++)
            if (current.get(i) != owned.get(i)) throw new IllegalStateException("breadth-owned-tree-changed");
    }
    @Override public void command(String action) throws Exception {
        switch (action) {
            case "boolean-enable" -> commands.setBoolean.invoke(booleanAtom, true);
            case "boolean-restore" -> commands.setBoolean.invoke(booleanAtom, false);
            case "mapping-remove" -> commands.removeMapping.invoke(source, destination);
            case "mapping-restore" -> commands.restoreMapping.invoke(source, destination, 129.0, true, linear, null);
            case "factory-create" -> {
                detached = factory.invoke(null, UUID.fromString(GridBreadthCommands.GATES_TYPE));
                owned = GridDetachedFactory.ownership(ownershipHost(), detached);
                lifecycle.requireInitialized(detached);
            }
            case "factory-dispose" -> {
                lifecycle.dispose(detached);
                disposed = true;
            }
            default -> throw new IllegalArgumentException("breadth-action");
        }
    }
}
