package com.ghostnote.extension.handlers;

import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.DeviceLayerBank;
import com.ghostnote.extension.Bridge;
import com.ghostnote.extension.ContainerScopes;
import com.ghostnote.extension.LayerPageWitness;
import com.ghostnote.extension.Rig;
import com.ghostnote.extension.WindowAccess;
import com.ghostnote.extension.WindowPager;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

/** Paged chain controls. All host handles belong to the existing scope, and its lease spans the reply. */
public final class ChainControlHandlers {
    public static final String RULE = "paged-chain-controls-v1";

    /** Small host seam: snapshot rows carry absolute index, channelId, name and solo, never nested devices. */
    public interface Layers extends WindowPager.Window {
        void select(int local);
        void duplicate(int local);
        void name(int local, String name);
        void solo(int local, boolean value);
        void exclusiveSolo(int local);
    }

    public interface Host {
        ContainerScopes scopes();
        Layers layers(int slot);
        String track();
        String containerName(int slot);
        void validate(int slot, int position, String track);
        void schedule(Runnable task, int ms);
        void blockWrites(String reason);
    }

    private final Host host;
    public ChainControlHandlers(Host host) { this.host = host; }

    public static ChainControlHandlers over(ControllerHost controller, Rig rig) {
        return new ChainControlHandlers(new Host() {
            public ContainerScopes scopes() { return rig.containerScopes; }
            public String track() { return rig.cursorTracks[0].channelId().get(); }
            public String containerName(int slot) { return rig.scopeDevice(slot).name().get(); }
            public void validate(int slot, int position, String expectedTrack) {
                if (!expectedTrack.equals(track()) || rig.scopeRequestedPosition[slot] != position
                        || !rig.scopeSettled(slot) || !rig.scopeDevice(slot).hasLayers().get())
                    throw new IllegalStateException("chain control track or container identity changed");
            }
            public void schedule(Runnable task, int ms) { controller.scheduleTask(task, ms); }
            public void blockWrites(String reason) { rig.writeGate.blockWrites(reason); }
            public Layers layers(int slot) {
                DeviceLayerBank bank = rig.slotLayerBanks[slot];
                return new Layers() {
                    public int width() { return Rig.SLOT_LAYER_BANK; }
                    public int count() { return bank.itemCount().get(); }
                    public int position() { return bank.scrollPosition().get(); }
                    public void scroll(int position) { bank.scrollPosition().set(position); }
                    public JsonArray snapshot() {
                        JsonArray rows = new JsonArray();
                        int size = Math.min(width(), Math.max(0, count() - position()));
                        for (int local = 0; local < size; local++) {
                            var layer = bank.getItemAt(local);
                            if (!layer.exists().get()) return null;
                            JsonObject row = new JsonObject();
                            row.addProperty("index", position() + local);
                            row.addProperty("channelId", layer.channelId().get());
                            row.addProperty("name", layer.name().get());
                            row.addProperty("solo", layer.solo().get());
                            rows.add(row);
                        }
                        return rows;
                    }
                    public void select(int local) { bank.getItemAt(local).selectInEditor(); }
                    public void duplicate(int local) { bank.getItemAt(local).duplicate(); }
                    public void name(int local, String name) { bank.getItemAt(local).name().set(name); }
                    public void solo(int local, boolean value) { bank.getItemAt(local).solo().set(value); }
                    public void exclusiveSolo(int local) { bank.getItemAt(local).solo().toggle(true); }
                };
            }
        });
    }

    public void register(HandlerRegistry r) {
        r.onAsync("chain.select", (p, reply) -> run(Action.SELECT, p, reply));
        r.onAsync("chain.duplicate", (p, reply) -> run(Action.DUPLICATE, p, reply));
        r.onAsync("chain.setName", (p, reply) -> run(Action.RENAME, p, reply));
        r.onAsync("chain.activate", (p, reply) -> run(Action.ACTIVATE, p, reply));
        r.onAsync("chain.setSolo", (p, reply) -> run(Action.SOLO, p, reply));
    }

    private enum Action { SELECT, DUPLICATE, RENAME, ACTIVATE, SOLO }

    private static int index(JsonObject params, String key) {
        JsonElement value = params.get(key);
        if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isNumber())
            throw new IllegalArgumentException(key + " must be a nonnegative integer");
        double number = value.getAsDouble();
        if (!Double.isFinite(number) || number < 0 || number > Integer.MAX_VALUE || number != Math.rint(number))
            throw new IllegalArgumentException(key + " must be a nonnegative integer");
        return (int) number;
    }

    private static String string(JsonObject params, String key, boolean required) {
        JsonElement value = params.get(key);
        if (value == null && !required) return null;
        if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isString()
                || value.getAsString().isBlank()) throw new IllegalArgumentException(key + " must be a nonblank string");
        return value.getAsString();
    }

    private void run(Action action, JsonObject input, Bridge.Reply reply) {
        JsonObject params = input.deepCopy();
        int position = index(params, "position");
        int chain = action == Action.RENAME ? -1 : index(params, "chainIndex");
        String track = string(params, "expectedTrackChannelId", action == Action.SOLO || action == Action.ACTIVATE);
        string(params, "expectedName", false);
        string(params, "expectedChannelId", false);
        if (action == Action.RENAME) { string(params, "channelId", true); string(params, "name", true); }
        if (action == Action.SOLO && (!params.has("solo") || !params.get("solo").isJsonPrimitive()
                || !params.get("solo").getAsJsonPrimitive().isBoolean()))
            throw new IllegalArgumentException("solo must be a boolean");
        host.scopes().aim(new int[] {position}, track, new ContainerScopes.Outcome() {
            public void refused(String reason, String detail, JsonObject report) {
                reply.error(new IllegalStateException("container scope " + reason + ": " + detail), 0);
            }
            public void settled(ContainerScopes.Settled settled) {
                int slot = settled.slotOf(position);
                if (slot == ContainerScopes.EMPTY) {
                    settled.release();
                    reply.error(new IllegalArgumentException("no device at position " + position), 0);
                    return;
                }
                try { new Operation(action, params, position, chain, slot, settled, reply).start(); }
                catch (Exception error) { settled.release(); reply.error(error, 0); }
            }
        });
    }

    private final class Operation {
        final Action action;
        final JsonObject params;
        final int position, slot;
        int target;
        final ContainerScopes.Settled settled;
        final Bridge.Reply reply;
        final String track;
        final Layers layers;
        final WindowAccess access = new WindowAccess(host::schedule);
        final LayerPageWitness witness = new LayerPageWitness();
        final JsonArray before = new JsonArray();
        final WindowPager.Window window;
        boolean completed, effectsPossible, duplicated;
        String duplicateId;
        JsonObject result;

        Operation(Action action, JsonObject params, int position, int target, int slot,
                ContainerScopes.Settled settled, Bridge.Reply reply) {
            this.action = action; this.params = params; this.position = position; this.target = target;
            this.slot = slot; this.settled = settled; this.reply = reply;
            track = host.track();
            layers = host.layers(slot);
            window = new WindowPager.Window() {
                public int width() { return layers.width(); }
                public int count() { return layers.count(); }
                public int position() { return layers.position(); }
                public void scroll(int at) { layers.scroll(at); }
                public JsonArray snapshot() {
                    host.validate(slot, Operation.this.position, track);
                    JsonArray rows = layers.snapshot();
                    if (rows == null || !validRows(rows)) return null;
                    return (duplicated ? matchesDuplicate(rows) : witness.matches(rows)) ? rows : null;
                }
            };
        }

        void start() {
            // Resolve channel identities and activation flags without traversing any device windows.
            new WindowPager(host::schedule).read(window, (offset, rows, next) -> {
                witness.accept(rows);
                before.addAll(rows);
                next.accept(null);
            }, (report, error) -> {
                if (error != null) { finish(error); return; }
                try {
                    resolve();
                    if (action == Action.ACTIVATE && before.size() > layers.width()) clearSiblings(0);
                    else applyTarget();
                } catch (Exception failure) { finish(failure); }
            });
        }

        boolean validRows(JsonArray rows) {
            for (int i = 0; i < rows.size(); i++) {
                JsonObject row = rows.get(i).getAsJsonObject();
                if (id(row).isBlank() || id(row).startsWith("ERR")
                        || !row.has("index") || row.get("index").getAsInt() != layers.position() + i
                        || !row.has("name") || !row.get("name").isJsonPrimitive()
                        || !row.get("name").getAsJsonPrimitive().isString()
                        || !row.has("solo") || !row.get("solo").isJsonPrimitive()
                        || !row.get("solo").getAsJsonPrimitive().isBoolean()) return false;
            }
            return true;
        }

        void resolve() {
            if (action == Action.RENAME) {
                String wanted = params.get("channelId").getAsString();
                for (int i = 0; i < before.size(); i++) {
                    if (!wanted.equals(id(before.get(i)))) continue;
                    if (target != -1) throw new IllegalArgumentException("multiple chains report channelId " + wanted);
                    target = i;
                }
                if (target == -1) throw new IllegalArgumentException("no chain has channelId " + wanted);
            }
            if (target >= before.size()) throw new IllegalArgumentException("no chain at index " + target);
            JsonObject row = before.get(target).getAsJsonObject();
            if (params.has("expectedName") && !params.get("expectedName").equals(row.get("name")))
                throw new IllegalArgumentException("chain name changed at index " + target);
            if (params.has("expectedChannelId") && !params.get("expectedChannelId").equals(row.get("channelId")))
                throw new IllegalArgumentException("chain identity changed at index " + target);
            result = new JsonObject();
            result.addProperty("success", true);
            result.addProperty("position", position);
            result.addProperty("chainIndex", target);
            result.addProperty("slot", slot);
            result.addProperty("scopeStatus", "held");
            result.add("sourceName", row.get("name"));
            result.add("sourceChannelId", row.get("channelId"));
            result.addProperty("containerName", host.containerName(slot));
            result.addProperty("trackChannelId", track);
            result.addProperty("route", RULE);
            result.add("aim", settled.report());
            if (action == Action.RENAME) {
                result.add("previousName", row.get("name")); result.add("requested", params.get("name"));
            }
            if (action == Action.SOLO) {
                result.add("previousSolo", row.get("solo")); result.add("requestedSolo", params.get("solo"));
            }
        }

        void applyTarget() {
            access.<Void>withWindow(window, target, target, (offset, page, done) -> {
                checkPopulation();
                int local = target - offset;
                // Window witnesses already prove the absolute identity. The caller's name/ID was checked
                // before any writes, including the sibling clears of activation.
                effectsPossible = true;
                switch (action) {
                    case SELECT -> layers.select(local);
                    case DUPLICATE -> {
                        duplicated = true;
                        layers.select(local); // The brain's earlier chain.select remains load-bearing (E17ak).
                        layers.duplicate(local);
                    }
                    case RENAME -> layers.name(local, params.get("name").getAsString());
                    case SOLO -> layers.solo(local, params.get("solo").getAsBoolean());
                    case ACTIVATE -> {
                        if (before.size() <= layers.width()) {
                            for (int i = 0; i < page.size(); i++) {
                                if (i != local && page.get(i).getAsJsonObject().get("solo").getAsBoolean())
                                    layers.solo(i, false);
                            }
                        }
                        if (!page.get(local).getAsJsonObject().get("solo").getAsBoolean()) layers.exclusiveSolo(local);
                    }
                }
                done.accept(null, null);
            }, (outcome, error) -> finish(error));
        }

        /** Clear exceptional solos in bounded groups before activating the target, including when it is already on. */
        void clearSiblings(int from) {
            List<Integer> indices = new ArrayList<>();
            for (int i = from; i < before.size(); i++) {
                if (i == target || !before.get(i).getAsJsonObject().get("solo").getAsBoolean()) continue;
                if (!indices.isEmpty() && i - indices.get(0) >= layers.width()) break;
                indices.add(i);
            }
            if (indices.isEmpty()) { applyTarget(); return; }
            int first = indices.get(0), last = indices.get(indices.size() - 1);
            access.<Void>withWindow(window, first, last, (offset, page, done) -> {
                checkPopulation();
                for (int index : indices) {
                    effectsPossible = true;
                    layers.solo(index - offset, false);
                }
                done.accept(null, null);
            }, (outcome, error) -> {
                if (error != null) finish(error);
                else try { clearSiblings(last + 1); } catch (Exception failure) { finish(failure); }
            });
        }

        void checkPopulation() {
            if (layers.count() != before.size()) throw new IllegalStateException("chain population changed before write");
        }

        /** E353: the duplicate is inserted immediately after its source. Allow both not-yet-applied and applied views. */
        boolean matchesDuplicate(JsonArray rows) {
            if (layers.count() == before.size()) return witness.matches(rows);
            if (layers.count() != before.size() + 1) return false;
            var seen = new HashSet<String>();
            String candidateId = duplicateId;
            for (JsonElement value : rows) {
                JsonObject row = value.getAsJsonObject();
                String actual = id(row);
                if (actual.isBlank() || actual.startsWith("ERR") || !seen.add(actual)) return false;
                int index = row.get("index").getAsInt();
                if (index == target + 1) {
                    for (JsonElement original : before) if (actual.equals(id(original))) return false;
                    if (candidateId != null && !candidateId.equals(actual)) return false;
                    candidateId = actual;
                } else {
                    int old = index > target + 1 ? index - 1 : index;
                    if (old < 0 || old >= before.size() || !actual.equals(id(before.get(old)))) return false;
                }
            }
            duplicateId = candidateId;
            return true;
        }

        void finish(Exception error) {
            if (completed) return;
            completed = true;
            if (error instanceof WindowPager.RestoreFailure) host.blockWrites(error.getMessage());
            settled.release(); // A batch continuation may start another aim inside reply.
            if (error == null) reply.result(result, 0);
            else reply.error(effectsPossible
                ? new IllegalStateException("chain control failed after work started; effects may have applied: "
                    + error.getMessage(), error) : error, 0);
        }
    }

    private static String id(JsonElement row) {
        JsonElement value = row.getAsJsonObject().get("channelId");
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isString()
            ? value.getAsString() : "";
    }
}
