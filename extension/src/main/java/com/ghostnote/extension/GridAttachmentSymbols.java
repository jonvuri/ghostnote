package com.ghostnote.extension;

import com.google.gson.*;
import java.lang.reflect.*;
import java.util.*;
import static com.ghostnote.extension.GridFixtureValue.*;

/** Exact attachment symbols. Construction resolves methods without invoking native edits. */
public final class GridAttachmentSymbols implements GridModuleAttachment.Host {
    @FunctionalInterface public interface Guard { void check() throws Exception; }
    public static final class Symbols {
        final Class<?> grid, module, focusClass, nitro;
        final Method members, hiddenCount, x, y, width, height, owner, parent, disposed, uuid;
        final Method context, recording, manager, document, display, active, currentEdit, documentEdit, replay, replaying;
        final Method label, begin, associate, insert, close, focusTarget, managedId, registered;
        final Field stack, instant, longer, locks, lockSet, journalMap, associated, displayMap, selectionState, selected, focus;
        final Object emptyLocks;
        public Symbols(ClassLoader loader) throws Exception {
            grid = type(loader, "com.bitwig.flt.document.core.master.device.gOr");
            module = type(loader, "com.bitwig.flt.document.core.master.device.DbL");
            Class<?> base = type(loader, "com.bitwig.ramona.core.HEV");
            Class<?> ikl = type(loader, "com.bitwig.ramona.core.ikl");
            Class<?> nhx = type(loader, "com.bitwig.flt.document.core.master.device.NHx");
            Class<?> dtr = type(loader, "com.bitwig.flt.document.core.master.device.DtR");
            Class<?> qho = type(loader, "com.bitwig.flt.document.core.master.device.QHo");
            Class<?> u = type(loader, "com.bitwig.ramona.core.uX1"), ibf = type(loader, "com.bitwig.ramona.core.Ibf");
            nitro = type(loader, "dkb"); managedId = base.getMethod("WKy"); registered = u.getMethod("ffA", int.class);
            Class<?> doc = type(loader, "cZl"), journal = type(loader, "daR"), selectionBase = type(loader, "YJr");
            Class<?> locksType = type(loader, "com.bitwig.ramona.core.wfl");
            emptyLocks = Array.newInstance(locksType, 0);
            members = nhx.getMethod("eJS"); hiddenCount = nhx.getMethod("vl");
            x = dtr.getMethod("cI_"); y = dtr.getMethod("kyi"); width = qho.getMethod("pfb"); height = qho.getMethod("rdo");
            owner = base.getMethod("I_"); disposed = base.getMethod("J_"); parent = module.getMethod("Fuu");
            uuid = type(loader, "com.bitwig.flt.document.core.master.device.OEf").getMethod("VEb");
            context = ikl.getMethod("mSv"); recording = u.getMethod("MkF"); manager = u.getMethod("Ode");
            document = doc.getMethod("ffA", ikl); display = ibf.getMethod("NaF"); active = journal.getMethod("eOi");
            currentEdit = journal.getMethod("NaF"); documentEdit = doc.getMethod("jBn");
            replay = doc.getMethod("EbT"); replaying = doc.getMethod("Mkn");
            label = method(grid, "ffA", Collection.class);
            begin = method(ikl, "ffA", String.class, emptyLocks.getClass()); close = method(ikl, "hoE");
            associate = grid.getMethod("aJp");
            insert = method(grid, "ffA", Collection.class, int.class, int.class, boolean.class,
                type(loader, "com.bitwig.flt.document.core.master.device.RHk"));
            stack = field(ibf, "SRu"); instant = field(ibf, "pvN"); longer = field(ibf, "QiZ");
            locks = field(ibf, "wi2"); lockSet = field(ibf, "MkF"); journalMap = field(doc, "W2P");
            associated = field(grid, "pvN"); displayMap = field(nhx, "kG");
            selectionState = field(type(loader, "nST"), "ffA"); selected = field(selectionBase, "JD1"); focus = field(selectionBase, "GC");
            focusClass = type(loader, "mbe"); focusTarget = type(loader, "QAi").getMethod("pvN");
            if (begin.getReturnType() != boolean.class || close.getReturnType() != boolean.class
                    || label.getReturnType() != String.class || insert.getReturnType() != void.class
                    || managedId.getReturnType() != int.class || registered.getReturnType() != base)
                throw new IllegalStateException("attachment-symbol-signature");
        }
        private static Class<?> type(ClassLoader loader, String name) throws Exception { return Class.forName(name, false, loader); }
        private static Method method(Class<?> type, String name, Class<?>... args) throws Exception {
            Method m = type.getDeclaredMethod(name, args); m.setAccessible(true); return m;
        }
        private static Field field(Class<?> type, String name) throws Exception {
            Field f = type.getDeclaredField(name); f.setAccessible(true); return f;
        }
    }
    record Edit(Object context, Object manager, Object document, Object journal, Object frame, Object edit,
                        int frames, int instant, int longer, int locks, boolean lockSet, boolean active) {}
    record Selection(Object display, Object state, Object focus, List<?> selected, JsonObject json) {}
    private final Symbols s;
    private final GridReadSymbols reader;
    private final Object grid;
    private final GridFactorySymbols factory;
    private final Guard route;
    private final Runnable factoryAttempt;
    private final JsonObject graph;
    private List<?> original;
    private List<GridAttachmentLayout.Rect> rectangles;
    private Selection selection;
    private Edit idle, ownedEdit;
    private GridAttachmentLayout.Rect detached;

    public GridAttachmentSymbols(GridReadSymbols reader, Object grid, JsonObject graph, List<String> uuids,
            Guard route, Runnable factoryAttempt) throws Exception {
        this.s = new Symbols(grid.getClass().getClassLoader()); this.reader = reader; this.grid = grid; this.graph = graph;
        this.factory = new GridFactorySymbols(reader, grid.getClass().getClassLoader(), uuids);
        this.route = route; this.factoryAttempt = factoryAttempt;
        if (grid.getClass() != s.grid) throw new IllegalStateException("attachment-wrong-grid-class");
    }
    static Object existing(Map<?, ?> map, Object key) {
        Object value = map.get(key);
        if (value == null) throw new IllegalStateException("attachment-existing-state-absent");
        return value;
    }
    private List<?> members() throws Exception {
        Object value = s.members.invoke(grid);
        if (!(value instanceof List<?> list) || list.size() > 5) throw new IllegalStateException("attachment-membership-limit");
        List<Object> result = new ArrayList<>(); Set<Object> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        Set<String> ids = new HashSet<>();
        for (Object item : list) {
            if (item == null || item.getClass() != s.module || !seen.add(item) || !ids.add(uuid(item))
                    || (boolean) s.disposed.invoke(item)) throw new IllegalStateException("attachment-member-identity");
            result.add(item);
        }
        return result;
    }
    private String uuid(Object item) throws Exception {
        Object id = s.uuid.invoke(item); if (!(id instanceof UUID)) throw new IllegalStateException("attachment-no-uuid");
        return id.toString();
    }
    private GridAttachmentLayout.Rect rectangle(Object item) throws Exception {
        return new GridAttachmentLayout.Rect(uuid(item), (int) s.x.invoke(item), (int) s.y.invoke(item),
            (int) s.width.invoke(item), (int) s.height.invoke(item));
    }
    private List<GridAttachmentLayout.Rect> rectangles(List<?> items) throws Exception {
        List<GridAttachmentLayout.Rect> result = new ArrayList<>();
        for (Object item : items) result.add(rectangle(item));
        GridAttachmentLayout.requireFree(result); return List.copyOf(result);
    }
    private Edit edit() throws Exception {
        Object context = s.context.invoke(grid);
        if (context == null || !(boolean) s.recording.invoke(context)) throw new IllegalStateException("attachment-not-recording");
        Object manager = s.manager.invoke(context), document = s.document.invoke(null, grid);
        if (manager == null || document == null || (boolean) s.replay.invoke(document) || (boolean) s.replaying.invoke(document))
            throw new IllegalStateException("attachment-edit-context");
        // Read the existing journal. The native lookup can create a missing journal.
        Object journal = existing((Map<?, ?>) s.journalMap.get(document), manager);
        List<?> frames = (List<?>) s.stack.get(manager);
        if (frames.size() > 1) throw new IllegalStateException("attachment-outer-edit");
        return new Edit(context, manager, document, journal, frames.isEmpty() ? null : frames.get(0),
            s.currentEdit.invoke(journal), frames.size(), s.instant.getInt(manager), s.longer.getInt(manager),
            s.locks.getInt(manager), s.lockSet.get(manager) != null, (boolean) s.active.invoke(journal));
    }
    private static boolean sameContext(Edit a, Edit b) {
        return a.context == b.context && a.manager == b.manager && a.document == b.document && a.journal == b.journal;
    }
    static void idle(Edit e) {
        if (e.frames != 0 || e.instant != 0 || e.longer != 0 || e.locks != 0 || e.lockSet || e.active)
            throw new IllegalStateException("attachment-edit-not-idle");
    }
    public void requireIdle() throws Exception {
        Edit e = edit(); idle(e);
        if (idle != null && !sameContext(idle, e)) throw new IllegalStateException("attachment-edit-context-changed");
    }
    private Selection selection(List<?> items, Edit edit) throws Exception {
        Object state = existing((Map<?, ?>) s.displayMap.get(grid), s.display.invoke(edit.manager));
        if (state == null || (boolean) s.disposed.invoke(state)) throw new IllegalStateException("attachment-selection-state-absent");
        Object gn = s.selectionState.get(state);
        if (gn == null || (boolean) s.disposed.invoke(gn)) throw new IllegalStateException("attachment-selection-absent");
        Object raw = s.selected.get(gn);
        List<?> selected = raw == null ? List.of() : (List<?>) raw;
        if (selected.size() > items.size()) throw new IllegalStateException("attachment-selection-limit");
        JsonArray ids = new JsonArray(); Set<Object> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        for (Object item : selected) {
            if (!identityContains(items, item) || !seen.add(item)) throw new IllegalStateException("attachment-selection-foreign");
            ids.add(uuid(item));
        }
        Object focus = s.focus.get(gn); String focusUuid = null;
        if (focus != null) {
            if (focus.getClass() != s.focusClass) throw new IllegalStateException("attachment-focus-form");
            Object item = s.focusTarget.invoke(focus);
            if (!identityContains(selected, item)) throw new IllegalStateException("attachment-focus-not-selected");
            focusUuid = uuid(item);
        }
        return new Selection(state, gn, focus, new ArrayList<>(selected), selectionJson(ids, focusUuid));
    }
    static JsonObject selectionJson(JsonArray selected, String focusUuid) {
        JsonObject json = new JsonObject(); json.add("selected", selected.deepCopy());
        // Match the bridge encoding. Gson omits null object members.
        if (focusUuid != null) json.addProperty("focus", focusUuid);
        return json;
    }
    private static boolean identityContains(List<?> items, Object item) { return items.stream().anyMatch(v -> v == item); }
    private static boolean sameItems(List<?> a, List<?> b) {
        if (a.size() != b.size()) return false;
        for (int i = 0; i < a.size(); i++) if (a.get(i) != b.get(i)) return false;
        return true;
    }
    static void sameSelection(Selection a, Selection b) {
        if (a.display != b.display || a.state != b.state || a.focus != b.focus || !sameItems(a.selected, b.selected)
                || !a.json.equals(b.json)) throw new IllegalStateException("attachment-selection-changed");
    }
    public JsonObject witness() throws Exception {
        List<?> items = members(); List<GridAttachmentLayout.Rect> rects = rectangles(items); Edit e = edit();
        JsonArray membership = refs(node(graph, graph.get("root").getAsInt()), 6428);
        if (!graph.get("complete").getAsBoolean() || graph.get("errorCount").getAsInt() != 0 || membership.size() != items.size())
            throw new IllegalStateException("attachment-witness-graph-incomplete");
        int cables = 0;
        for (JsonElement value : graph.getAsJsonArray("nodes")) {
            JsonObject n = value.getAsJsonObject();
            if (n.get("className").getAsString().equals("audio_destination_atom")) cables += refs(n, 7125).size();
        }
        if (cables > 2) throw new IllegalStateException("attachment-cable-limit");
        JsonObject result = new JsonObject(); JsonArray jsonRects = new JsonArray(), ids = new JsonArray();
        for (int i = 0; i < items.size(); i++) {
            Object item = items.get(i); GridAttachmentLayout.Rect r = rects.get(i);
            JsonObject n = node(graph, membership.get(i).getAsInt());
            if (!scalar(n, 15).getAsString().equals(r.uuid()) || scalar(n, 6679).getAsInt() != r.x()
                    || scalar(n, 6680).getAsInt() != r.y() || s.owner.invoke(item) != grid || s.parent.invoke(item) != grid)
                throw new IllegalStateException("attachment-membership-or-parent-disagrees");
            jsonRects.add(r.json()); ids.add(r.uuid());
        }
        result.add("moduleUuids", ids); result.add("rectangles", jsonRects); result.add("selection", selection(items, e).json);
        result.addProperty("parentsVerified", true); result.add("edit", editJson(e)); return result;
    }
    private static JsonObject editJson(Edit e) {
        JsonObject r = new JsonObject(); r.addProperty("frames", e.frames); r.addProperty("instant", e.instant);
        r.addProperty("longer", e.longer); r.addProperty("locks", e.locks); r.addProperty("lockSet", e.lockSet);
        r.addProperty("active", e.active); return r;
    }
    public JsonObject diagnostics() {
        JsonObject result = new JsonObject();
        try { result.add("edit", editJson(edit())); } catch (Exception e) { result.addProperty("editError", GridModuleAttachment.errorText(e)); }
        try {
            JsonArray ids = new JsonArray(), owners = new JsonArray();
            for (Object item : members()) {
                ids.add(uuid(item)); JsonObject o = new JsonObject(); o.addProperty("uuid", uuid(item));
                o.addProperty("ownerIsGrid", s.owner.invoke(item) == grid); o.addProperty("parentIsGrid", s.parent.invoke(item) == grid); owners.add(o);
            }
            result.add("moduleUuids", ids); result.add("ownership", owners);
        } catch (Exception e) { result.addProperty("membershipError", GridModuleAttachment.errorText(e)); }
        return result;
    }
    public void preflight() throws Exception {
        idle = edit(); idle(idle); original = members();
        if (original.size() != 4 || (int) s.hiddenCount.invoke(grid) != 0) throw new IllegalStateException("attachment-membership-changed");
        rectangles = rectangles(original); selection = selection(original, idle); witness();
    }
    public void guard() throws Exception { route.check(); }
    public JsonObject prepare(Object module) throws Exception {
        requireIdle(); List<?> current = members();
        if (!sameItems(original, current) || !rectangles.equals(rectangles(current)) || (int) s.hiddenCount.invoke(grid) != 0)
            throw new IllegalStateException("attachment-baseline-changed");
        sameSelection(selection, selection(current, edit())); requireRoot(module); requireAbsent(module);
        JsonObject result = new JsonObject(); result.add("layout", GridAttachmentLayout.admit(rectangles, detached = rectangle(module)));
        result.add("selection", selection.json.deepCopy()); return result;
    }
    public boolean begin(Object module) throws Exception {
        return (boolean) s.begin.invoke(grid, s.label.invoke(grid, List.of(module)), s.emptyLocks);
    }
    public void proveEdit() throws Exception {
        Edit e = edit();
        requireNewEdit(idle, e, s.documentEdit.invoke(e.document)); ownedEdit = e;
    }
    public void associate() throws Exception {
        s.associate.invoke(grid);
        if (s.associated.get(grid) != ownedEdit.edit) throw new IllegalStateException("attachment-edit-association");
    }
    public void requireOwnedEdit() throws Exception {
        Edit e = edit();
        requireSameEdit(ownedEdit, e, s.documentEdit.invoke(e.document));
    }
    static void requireNewEdit(Edit idle, Edit e, Object current) {
        if (!sameContext(idle, e) || e.frames != 1 || e.frame == null || e.instant != 1 || e.longer != 0 || e.locks != 0
                || e.lockSet || !e.active || e.edit == null || current != e.edit)
            throw new IllegalStateException("attachment-edit-not-owned");
    }
    static void requireSameEdit(Edit owned, Edit e, Object current) {
        if (owned == null) throw new IllegalStateException("attachment-edit-not-owned");
        requireNewEdit(owned, e, current);
        if (e.frame != owned.frame || e.edit != owned.edit) throw new IllegalStateException("attachment-owned-edit-changed");
    }
    public void insert(Object module) throws Exception { s.insert.invoke(grid, List.of(module), 2, 0, false, null); }
    public boolean close() throws Exception { return (boolean) s.close.invoke(grid); }
    public JsonObject attached(Object module) throws Exception {
        List<?> current = members();
        if (current.size() != 5 || !sameItems(original, current.subList(0, 4)) || current.get(4) != module
                || s.owner.invoke(module) != grid || s.parent.invoke(module) != grid || (int) s.hiddenCount.invoke(grid) != 0)
            throw new IllegalStateException("attachment-transfer-unproved");
        List<GridAttachmentLayout.Rect> after = rectangles(current);
        if (!after.subList(0, 4).equals(rectangles) || after.get(4).x() != 2 || after.get(4).y() != 0
                || after.get(4).width() != detached.width() || after.get(4).height() != detached.height())
            throw new IllegalStateException("attachment-layout-changed");
        sameSelection(selection, selection(current, edit()));
        GridReadExplore explore = new GridReadExplore(reader);
        Object contents = explore.navigate(module, List.of(new GridReadExplore.Step("module", 406, "device_contents", 0)));
        Object atom = explore.navigate(contents, List.of(new GridReadExplore.Step("module_contents", 173, "child_components", 4)));
        if (atom.getClass() != s.nitro || s.owner.invoke(contents) != module || s.owner.invoke(atom) != contents)
            throw new IllegalStateException("attachment-managed-atom-owner");
        int managedId = (int) s.managedId.invoke(atom);
        requireRegistered(atom, managedId, s.context.invoke(atom), idle.context,
            managedId > 0 ? s.registered.invoke(idle.context, managedId) : null);
        JsonObject result = new JsonObject(); result.addProperty("uuid", uuid(module)); result.addProperty("parentsVerified", true);
        result.addProperty("managedObjectId", managedId); result.addProperty("managedObjectRegistered", true);
        result.addProperty("selectionUnchanged", true); result.add("rectangle", after.get(4).json()); return result;
    }
    static void requireRegistered(Object atom, int id, Object context, Object expectedContext, Object registered) {
        if (atom == null || id <= 0 || context == null || context != expectedContext || registered != atom)
            throw new IllegalStateException("attachment-managed-identity-unproved");
    }
    public void requireAbsent(Object module) throws Exception {
        if (identityContains(members(), module)) throw new IllegalStateException("attachment-member-cannot-dispose");
    }
    public void admitFactory() throws Exception { route.check(); factoryAttempt.run(); }
    public Object create() throws Exception { return factory.create(); }
    public Object owner(Object object) throws Exception { return factory.owner(object); }
    public List<?> children(Object object) throws Exception { return factory.children(object); }
    public boolean disposed(Object object) throws Exception { return factory.disposed(object); }
    public void dispose(Object object) throws Exception { factory.dispose(object); }
    public void requireRoot(Object object) throws Exception { factory.requireRoot(object); }
    public void requireInitialized(Object object) throws Exception { factory.requireInitialized(object); }
    public JsonObject capture(Object object) throws Exception {
        JsonObject capture = factory.capture(object); GridAttachmentGraph.requireDefaults(capture); return capture;
    }
}
