package com.ghostnote.extension;

import com.google.gson.*;
import java.util.*;

/** Read existing edit, membership, selection, and engine state. Do not create state. */
public final class GridBreadthWitness {
    private final GridAttachmentSymbols.Symbols s;
    private final GridEngineSymbols.Symbols engine;
    private List<Object> identities;
    public GridBreadthWitness(ClassLoader loader) throws Exception {
        s = new GridAttachmentSymbols.Symbols(loader);
        engine = new GridEngineSymbols.Symbols(loader);
    }
    public GridBreadthWitness(GridDoctorSymbols table) {
        s = new GridAttachmentSymbols.Symbols(table); engine = new GridEngineSymbols.Symbols(table);
    }
    public void requireAtom(Object module, Object contents, Object atom) throws Exception {
        if (s.owner.invoke(contents) != module || s.owner.invoke(atom) != contents
                || (boolean) s.disposed.invoke(contents) || (boolean) s.disposed.invoke(atom))
            throw new IllegalStateException("breadth-atom-ownership");
    }
    /** The project root and its edit document have different native types. */
    record Documents(Object project, Object edit) {}
    static Documents documents(Object project, Object gridEdit, Object projectEdit) {
        if (project == null || gridEdit == null || gridEdit != projectEdit)
            throw new IllegalStateException("breadth-edit-document-mismatch");
        return new Documents(project, gridEdit);
    }
    public JsonObject read(Object grid, Object expectedDocument, JsonObject fixture) throws Exception {
        if (grid.getClass() != s.grid || !engine.document.isInstance(expectedDocument))
            throw new IllegalStateException("breadth-native-root-type");
        Object context = s.context.invoke(grid);
        if (context == null || !(boolean) s.recording.invoke(context))
            throw new IllegalStateException("breadth-not-recording");
        Documents documents = documents(expectedDocument, s.document.invoke(null, grid),
            s.document.invoke(null, expectedDocument));
        Object manager = s.manager.invoke(context), editDocument = documents.edit();
        if (manager == null || (boolean) s.replay.invoke(editDocument)
                || (boolean) s.replaying.invoke(editDocument))
            throw new IllegalStateException("breadth-edit-context");
        Object journal = GridAttachmentSymbols.existing((Map<?, ?>) s.journalMap.get(editDocument), manager);
        List<?> stack = (List<?>) s.stack.get(manager);
        if (!stack.isEmpty() || s.instant.getInt(manager) != 0 || s.longer.getInt(manager) != 0
                || s.locks.getInt(manager) != 0 || s.lockSet.get(manager) != null
                || (boolean) s.active.invoke(journal))
            throw new IllegalStateException("breadth-edit-not-idle");
        Object connection = engine.connection.invoke(documents.project()), state = engine.state.invoke(documents.project());
        boolean active = state == engine.connected.get(null) && connection != null;
        if (!active && !(state == engine.inactive.get(null) && connection == null))
            throw new IllegalStateException("breadth-engine-transition");
        List<?> members = (List<?>) s.members.invoke(grid);
        JsonArray projected = fixture.getAsJsonArray("modules");
        if (members.size() != projected.size() || members.size() > GridBreadthRead.MAX_MODULES
                || (int) s.hiddenCount.invoke(grid) != 0)
            throw new IllegalStateException("breadth-membership-witness");
        Set<Object> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        for (int i = 0; i < members.size(); i++) {
            Object module = members.get(i);
            JsonObject read = projected.get(i).getAsJsonObject();
            if (module.getClass() != s.module || !seen.add(module) || (boolean) s.disposed.invoke(module)
                    || s.owner.invoke(module) != grid || s.parent.invoke(module) != grid
                    || !s.uuid.invoke(module).toString().equals(read.get("uuid").getAsString())
                    || !s.managedId.invoke(module).toString().equals(read.get("id").getAsString()))
                throw new IllegalStateException("breadth-module-ownership");
        }
        Object display = ((Map<?, ?>) s.displayMap.get(grid)).get(s.display.invoke(manager));
        JsonObject selection = new JsonObject(); selection.addProperty("present", display != null);
        Object selectedState = null, focus = null;
        List<?> selected = List.of();
        if (display != null) {
            if ((boolean) s.disposed.invoke(display)) throw new IllegalStateException("breadth-disposed-display");
            selectedState = s.selectionState.get(display);
            if (selectedState == null || (boolean) s.disposed.invoke(selectedState))
                throw new IllegalStateException("breadth-selection-state");
            Object raw = s.selected.get(selectedState);
            selected = raw == null ? List.of() : (List<?>) raw;
            if (selected.size() > members.size()) throw new IllegalStateException("breadth-selection-limit");
            JsonArray selectedIds = new JsonArray();
            Set<Object> unique = Collections.newSetFromMap(new IdentityHashMap<>());
            for (Object item : selected) {
                if (!seen.contains(item) || !unique.add(item)) throw new IllegalStateException("breadth-foreign-selection");
                selectedIds.add(s.uuid.invoke(item).toString());
            }
            selection.add("selected", selectedIds);
            focus = s.focus.get(selectedState);
            if (focus != null) {
                if (focus.getClass() != s.focusClass) throw new IllegalStateException("breadth-focus-class");
                Object focused = s.focusTarget.invoke(focus);
                if (!unique.contains(focused)) throw new IllegalStateException("breadth-focus-target");
                selection.addProperty("focus", s.uuid.invoke(focused).toString());
            }
        }
        // Include null entries. Absence of a Grid display is also preserved.
        List<Object> current = new ArrayList<>(Arrays.asList(grid, context, manager, documents.project(), editDocument, journal,
            state, connection, display, selectedState, focus));
        current.addAll(members); current.addAll(selected);
        if (identities != null) {
            if (identities.size() != current.size()) throw new IllegalStateException("breadth-witness-changed");
            for (int i = 0; i < current.size(); i++)
                if (current.get(i) != identities.get(i)) throw new IllegalStateException("breadth-witness-changed");
        } else identities = current;
        JsonObject result = new JsonObject();
        result.addProperty("editIdle", true); result.addProperty("parentsVerified", true);
        result.addProperty("engineActive", active); result.add("selection", selection);
        return result;
    }
}
