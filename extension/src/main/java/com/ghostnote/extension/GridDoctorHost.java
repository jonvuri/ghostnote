package com.ghostnote.extension;

import com.google.gson.*;
import java.util.*;
import static com.ghostnote.extension.GridFixtureValue.*;

/** Fixed scratch doctor. Descriptor captures are separate from command receipts. */
public final class GridDoctorHost implements GridDoctorProtocol.Host {
    private final GridDoctorSymbols table;
    private final GridReadSymbols reader;
    private final Object device, grid, project;
    private final GridAttachmentSymbols.Symbols s;
    private GridDoctorProtocol.Guard guard;
    private JsonObject baseline, last, expected, detachedBefore, transaction;
    private JsonArray expectedNodes;
    private List<String> uuids;
    private List<Object> fixedIdentity;
    private List<?> originalMembers;
    private GridFactorySymbols factory;
    private Object detached, undoEdit, undoPrior;
    private List<Object> owned;
    private boolean disposed;
    private int commandCount;
    private JsonObject metrics = new JsonObject();
    public JsonObject metrics() { return metrics.deepCopy(); }
    private final Map<String, Integer> schemaIds = new HashMap<>();
    public GridDoctorHost(GridDoctorSymbols table, Object device, Object project, GridDoctorProtocol.Guard guard) throws Exception {
        this.table = table; this.device = device; this.project = project; this.guard = guard;
        reader = new GridReadSymbols(table); s = new GridAttachmentSymbols.Symbols(table);
        grid = new GridBreadthRead(reader).grid(device);
        if (grid.getClass() != table.type("grid") || !table.type("project-root").isInstance(project))
            throw new IllegalStateException("doctor-root-types");
        for (JsonElement row : GridDoctorSymbols.resource("grid-doctor-control.json").getAsJsonObject("graph").getAsJsonArray("nodes")) {
            JsonObject n = row.getAsJsonObject(); String name = n.get("className").getAsString();
            int id = n.get("classId").getAsInt();
            Integer old = schemaIds.put(name, id);
            if (old != null && old != id) throw new IllegalStateException("doctor-control-schema-conflict");
        }
    }
    public void guard(GridDoctorProtocol.Guard next) { guard = next; }
    private Object atom(int module, int index) throws Exception {
        return new GridReadExplore(reader).navigate(device, GridFixtureCable.atomPath(module, index));
    }
    private JsonObject graph() throws Exception {
        GridReadExplore route = new GridReadExplore(reader);
        if (route.navigate(device, query().path()) != grid) throw new IllegalStateException("doctor-grid-route");
        JsonObject capture = new GridGraphRead(GridAttachmentGraph.bounded(route.project(query().projection()), 3)).capture(grid);
        if (!capture.get("complete").getAsBoolean() || capture.get("errorCount").getAsInt() != 0
                || capture.getAsJsonArray("nodes").size() > 61) throw new IllegalStateException("doctor-incomplete-capture");
        for (JsonElement item : capture.getAsJsonArray("nodes")) {
            JsonObject n = item.getAsJsonObject();
            if (!Objects.equals(schemaIds.get(n.get("className").getAsString()), n.get("classId").getAsInt()))
                throw new IllegalStateException("doctor-schema-id");
        }
        metrics.add("graphReadNanos", capture.get("documentReadNanos"));
        metrics.add("graphWork", capture.get("work")); metrics.addProperty("queryWork", route.workUnits());
        capture.remove("documentReadNanos"); capture.remove("encodedBytes");
        return capture;
    }
    private Object journal() throws Exception {
        Object manager = s.manager.invoke(s.context.invoke(grid));
        return GridAttachmentSymbols.existing((Map<?, ?>) s.journalMap.get(editDocument()), manager);
    }
    private Object undoHead() throws Exception { return table.method("undo-head").invoke(journal()); }
    private Object editDocument() throws Exception {
        Object a = s.document.invoke(null, grid), b = s.document.invoke(null, project);
        if (a == null || a != b || !table.type("edit-document").isInstance(a))
            throw new IllegalStateException("doctor-edit-document");
        return a;
    }
    private JsonObject witness(JsonObject capture) throws Exception {
        Object context = s.context.invoke(grid), manager = s.manager.invoke(context), doc = editDocument();
        Object journal = GridAttachmentSymbols.existing((Map<?, ?>) s.journalMap.get(doc), manager);
        if (!(boolean) s.recording.invoke(context) || (boolean) s.replay.invoke(doc) || (boolean) s.replaying.invoke(doc)
                || (boolean) s.active.invoke(journal) || !((List<?>) s.stack.get(manager)).isEmpty()
                || table.method("journal-recording-edit").invoke(journal) != null
                || table.method("journal-replay-head").invoke(journal) != null
                || s.instant.getInt(manager) != 0 || s.longer.getInt(manager) != 0 || s.locks.getInt(manager) != 0
                || s.lockSet.get(manager) != null) throw new IllegalStateException("doctor-edit-not-idle");
        Object state = table.method("engine-state").invoke(project), connection = table.method("connection").invoke(project);
        Object active = table.field("connected-state").get(null), inactive = table.field("inactive-state").get(null);
        if (active == inactive || !(state == active && connection != null || state == inactive && connection == null))
            throw new IllegalStateException("doctor-engine-state");
        Object display = GridAttachmentSymbols.existing((Map<?, ?>) s.displayMap.get(grid), s.display.invoke(manager));
        Object selection = s.selectionState.get(display);
        if (selection == null || (boolean) s.disposed.invoke(display) || (boolean) s.disposed.invoke(selection))
            throw new IllegalStateException("doctor-selection-state");
        Object raw = s.selected.get(selection), focus = s.focus.get(selection);
        List<?> selected = raw == null ? List.of() : (List<?>) raw;
        List<?> members = (List<?>) s.members.invoke(grid);
        if (members.size() > 5 || selected.size() > members.size() || (int) s.hiddenCount.invoke(grid) != 0)
            throw new IllegalStateException("doctor-membership-limit");
        Set<Object> unique = Collections.newSetFromMap(new IdentityHashMap<>());
        JsonArray ids = refs(node(capture, 0), 6428), selectedIds = new JsonArray(), rectangles = new JsonArray();
        if (ids.size() != members.size()) throw new IllegalStateException("doctor-membership-count");
        for (int i = 0; i < members.size(); i++) {
            Object module = members.get(i); JsonObject n = node(capture, ids.get(i).getAsInt());
            if (!unique.add(module) || module.getClass() != s.module || s.parent.invoke(module) != grid
                    || s.owner.invoke(module) != grid || (boolean) s.disposed.invoke(module)
                    || !s.uuid.invoke(module).toString().equals(scalar(n, 15).getAsString())
                    || (int) s.x.invoke(module) != scalar(n, 6679).getAsInt()
                    || (int) s.y.invoke(module) != scalar(n, 6680).getAsInt()) throw new IllegalStateException("doctor-member-identity");
            int width = (int) s.width.invoke(module), height = (int) s.height.invoke(module);
            if (width <= 0 || width > 32 || height <= 0 || height > 32) throw new IllegalStateException("doctor-rectangle");
            JsonArray rect = new JsonArray(); rect.add(width); rect.add(height); rectangles.add(rect);
        }
        Set<Object> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        for (Object item : selected) {
            if (!unique.contains(item) || !seen.add(item)) throw new IllegalStateException("doctor-foreign-selection");
            selectedIds.add(s.uuid.invoke(item).toString());
        }
        if (focus != null && (focus.getClass() != s.focusClass || !seen.contains(s.focusTarget.invoke(focus))))
            throw new IllegalStateException("doctor-focus");
        // Preserve the original selection. The spare must not be selected for deletion.
        if (originalMembers == null) {
            originalMembers = new ArrayList<>(members);
            if (members.size() != 4 || seen.contains(members.get(3))) throw new IllegalStateException("doctor-spare-selected");
        }
        List<Object> identity = new ArrayList<>(Arrays.asList(grid, project, doc, context, manager, journal, state,
            connection, display, selection, focus)); identity.addAll(selected);
        if (fixedIdentity != null) {
            if (identity.size() != fixedIdentity.size()) throw new IllegalStateException("doctor-selection-size");
            for (int i = 0; i < identity.size(); i++) if (identity.get(i) != fixedIdentity.get(i))
                throw new IllegalStateException("doctor-preserved-identity");
        } else fixedIdentity = identity;
        JsonObject r = new JsonObject(); r.addProperty("engineActive", state == active);
        r.addProperty("editIdle", true); r.addProperty("identityPreserved", true); r.add("selected", selectedIds);
        r.add("rectangles", rectangles); return r;
    }
    @Override public JsonObject read() throws Exception {
        long started = System.nanoTime(); metrics = new JsonObject();
        JsonObject capture = graph(), r = new JsonObject();
        r.add("graph", capture); r.add("witness", witness(capture));
        if (detached != null) {
            if (disposed) {
                for (Object object : owned) if (!factory.disposed(object)) throw new IllegalStateException("doctor-disposal-readback");
                r.addProperty("disposed", true);
            } else {
                List<Object> current = GridDetachedFactory.ownership(factory, detached);
                if (current.size() != owned.size()) throw new IllegalStateException("doctor-owned-count");
                for (int i = 0; i < current.size(); i++) if (current.get(i) != owned.get(i))
                    throw new IllegalStateException("doctor-owned-tree-changed");
                helperRoles(detached); JsonObject d = factory.capture(detached); GridAttachmentGraph.requireDefaults(d);
                r.add("detached", d.get("nodes")); r.addProperty("ownedObjects", owned.size());
            }
        }
        metrics.addProperty("snapshotNanos", System.nanoTime() - started);
        last = capture; return r;
    }
    private void helperRoles(Object module) throws Exception {
        factory.requireInitialized(module);
        for (String role : List.of("initialization-helper", "remote-helper")) {
            Object helper = table.field(role).get(module);
            if (!table.type(role).isInstance(helper)) throw new IllegalStateException("doctor-helper-role:" + role);
        }
    }
    @Override public void validate(JsonObject read, int completed) {
        JsonObject g = read.getAsJsonObject("graph");
        if (baseline == null) {
            GridEngineGraph.baseline(g); baseline = read.deepCopy(); uuids = GridEngineGraph.uuids(g);
            expectedNodes = g.getAsJsonArray("nodes").deepCopy(); expected = read.getAsJsonObject("witness").deepCopy();
        }
        if (!g.getAsJsonArray("nodes").equals(expectedNodes) || !read.get("witness").equals(expected))
            throw new IllegalStateException("doctor-independent-readback-differs:" + completed);
        if (completed == 5) {
            if (!read.has("detached") || read.get("ownedObjects").getAsInt() != 77)
                throw new IllegalStateException("doctor-detached-read-required");
            if (detachedBefore == null) detachedBefore = read.deepCopy();
            else if (!detachedBefore.get("detached").equals(read.get("detached")))
                throw new IllegalStateException("doctor-detached-read-differs");
        }
        if (completed >= 6 && !read.get("disposed").getAsBoolean()) throw new IllegalStateException("doctor-disposal-required");
        if (completed == 12 && !expectedNodes.equals(baseline.getAsJsonObject("graph").get("nodes")))
            throw new IllegalStateException("doctor-final-baseline");
    }
    private void cable(boolean connect) throws Exception {
        Object destination = atom(3, 3), source = atom(0, 2);
        if (destination.getClass() != table.type("destination-atom") || source.getClass() != table.type("source-atom")
                || table.method("cable-source-getter").invoke(destination) != (connect ? null : source))
            throw new IllegalStateException("doctor-cable-source-identity");
        JsonObject copy = last.deepCopy(), p = property(node(copy, GridEngineGraph.atom(copy, 3, 3)), 7125);
        JsonArray edges = new JsonArray(); if (connect) edges.add(GridEngineGraph.atom(copy, 0, 2));
        p.add("refs", edges); p.addProperty("count", edges.size()); expectedNodes = GridEngineGraph.reorder(copy);
        guard.check(); table.method("cable-source-setter").invoke(destination, connect ? source : null);
    }
    @Override public JsonObject command(String action) throws Exception {
        long start = System.nanoTime(); JsonObject r = new JsonObject(); guard.check(); commandCount++;
        switch (action) {
            case "value-set", "value-restore" -> {
                Object value = atom(3, 1);
                if (value.getClass() != table.type("decimal-atom")) throw new IllegalStateException("doctor-value-runtime");
                double after = action.equals("value-set") ? CHANGED : BASELINE;
                JsonObject copy = last.deepCopy(), n = node(copy, GridEngineGraph.atom(copy, 3, 1));
                for (int id : new int[]{712, 949}) property(n, id).getAsJsonObject("value").addProperty("data", after);
                expectedNodes = copy.getAsJsonArray("nodes"); table.method("native-value-setter").invoke(value, after);
            }
            case "cable-connect", "delete-connect" -> cable(true);
            case "cable-disconnect", "delete-disconnect" -> cable(false);
            case "factory-create" -> {
                factory = new GridFactorySymbols(reader, table, uuids); detached = factory.create();
                owned = GridDetachedFactory.ownership(factory, detached); helperRoles(detached);
                if (owned.size() != 77) throw new IllegalStateException("doctor-factory-owned-limit");
            }
            case "factory-dispose" -> {
                if (detachedBefore == null) throw new IllegalStateException("doctor-no-detached-read");
                factory.dispose(detached); disposed = true;
            }
            case "delete" -> {
                Object spare = new GridReadExplore(reader).navigate(device, GridFixtureModuleDelete.modulePath());
                if (spare.getClass() != table.type("module") || table.method("module-parent").invoke(spare) != grid)
                    throw new IllegalStateException("doctor-delete-parent");
                JsonObject copy = last.deepCopy(), p = property(node(copy, 0), 6428);
                p.getAsJsonArray("refs").remove(3); p.addProperty("count", 3); expectedNodes = GridEngineGraph.reorder(copy);
                expected.getAsJsonArray("rectangles").remove(3);
                undoPrior = undoHead(); table.method("module-delete").invoke(spare); undoEdit = undoHead();
                if (undoEdit == null || undoEdit == undoPrior) throw new IllegalStateException("doctor-delete-edit-not-new");
            }
            case "undo-delete" -> {
                JsonObject copy = baseline.getAsJsonObject("graph").deepCopy();
                JsonObject p = property(node(copy, GridEngineGraph.atom(copy, 3, 3)), 7125);
                JsonArray edges = new JsonArray(); edges.add(GridEngineGraph.atom(copy, 0, 2)); p.add("refs", edges); p.addProperty("count", 1);
                expectedNodes = GridEngineGraph.reorder(copy); expected = baseline.getAsJsonObject("witness").deepCopy();
                undoOwned();
                r.addProperty("documentUndoContextVerified", true);
            }
            case "attach" -> {
                undoPrior = undoHead();
                GridAttachmentSymbols attach = new GridAttachmentSymbols(reader, table, grid, last, uuids, guard::check, () -> {});
                transaction = GridModuleAttachment.run(attach, progress -> transaction = progress);
                transaction.add("editTrace", attach.transactionTrace());
                expectedNodes = GridAttachmentGraph.expectedNodes(last, transaction.getAsJsonObject("capture0"), transaction.getAsJsonObject("attached"));
                JsonArray rectangle = new JsonArray(); rectangle.add(1); rectangle.add(1); expected.getAsJsonArray("rectangles").add(rectangle);
                r.add("transaction", transaction); undoEdit = undoHead();
                if (undoEdit == null || undoEdit != s.associated.get(grid)) throw new IllegalStateException("doctor-attachment-undo-head");
            }
            case "undo-attach" -> {
                expectedNodes = baseline.getAsJsonObject("graph").getAsJsonArray("nodes").deepCopy();
                expected = baseline.getAsJsonObject("witness").deepCopy(); undoOwned();
                r.addProperty("documentUndoContextVerified", true);
            }
            default -> throw new IllegalArgumentException("doctor-action");
        }
        r.addProperty("nativeCommandNanos", System.nanoTime() - start); r.addProperty("commandReturned", true); return r;
    }
    private void undoOwned() throws Exception {
        Object doc = editDocument();
        GridDoctorUndo.run(new GridDoctorUndo.Host() {
            public GridDoctorUndo.State state() throws Exception {
                if (editDocument() != doc) throw new IllegalStateException("doctor-undo-document-changed");
                Object manager = s.manager.invoke(s.context.invoke(grid));
                if (table.method("document-manager").invoke(doc) != manager)
                    throw new IllegalStateException("doctor-undo-manager-changed");
                Object journal = GridAttachmentSymbols.existing((Map<?, ?>) s.journalMap.get(doc), manager);
                return new GridDoctorUndo.State(doc, manager, journal, table.method("undo-head").invoke(journal),
                    table.method("journal-recording-edit").invoke(journal), table.method("journal-replay-head").invoke(journal),
                    (boolean) s.replay.invoke(doc), (boolean) s.replaying.invoke(doc), (boolean) s.active.invoke(journal),
                    (boolean) table.method("document-undo-enabled").invoke(doc),
                    (boolean) table.method("undo-available").invoke(journal));
            }
            public void undoDocument() throws Exception { table.method("undo-command").invoke(doc); }
        }, undoEdit, undoPrior, guard);
    }
    public JsonObject diagnostics() {
        JsonObject r = new JsonObject(); r.addProperty("nativeCommands", commandCount);
        if (transaction != null) r.add("transaction", transaction.deepCopy()); return r;
    }
}
