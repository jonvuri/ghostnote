package com.ghostnote.extension;

import com.bitwig.extension.controller.api.Action;
import com.bitwig.extension.controller.api.Application;
import com.bitwig.extension.controller.api.ClipLauncherSlotBank;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.NoteStep;
import com.bitwig.extension.controller.api.PinnableCursorClip;
import com.bitwig.extension.controller.api.Project;
import com.bitwig.extension.controller.api.Track;
import com.bitwig.extension.controller.api.TrackBank;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

/**
 * E216 research recorder. It measures observer delivery and per-callback coherence
 * across controller-issued project switches. It grants no cache eligibility.
 *
 * All methods run on the control-surface thread. The ticker, scripted steps, and
 * observers write one ordered record. Command records are separate from observer
 * records, but both come from this process. Neither is a host input fence.
 */
public final class DeliveryCoherenceProbe {
    public static final String MARKER = "e216-delivery-coherence-v1";
    /** 8g2b ordering mode: each tick schedules zero-delay confirmations of its step count. */
    public static final String ORDERING_MARKER = "e217-callback-ordering-v2";
    /** 8g5b slot mode: launcher occupancy in a fixed flat window, with slot callbacks in the same record. */
    public static final String SLOT_MARKER = "e222-slot-delivery-v1";
    static final int SLOT_TRACKS = 4, SLOT_ROWS = 8, SLOT_CLIP_BEATS = 4;
    /** Confirmation chain depth per tick. Depth 1 is the rule under test. */
    static final int CONFIRM_DEPTH = 2;
    /** Witness window: keys 60..75 and steps 0..15 at 1/16. */
    static final int WINDOW_STEPS = 16, WINDOW_KEYS = 16, BASE_KEY = 60;
    /** P witness at key 60, steps 0..3. Q witness at key 72, steps 8..11. */
    static final int P_Y = 0, Q_Y = 12, P_X = 0, Q_X = 8, WITNESS_WIDTH = 4;
    /** Scratch coordinate for step toggles: key 66, step 15. */
    static final int SCRATCH_X = 15, SCRATCH_Y = 6;
    private static final int EVENT_CAPACITY = 16_384, TICK_CAPACITY = 16_384, COMMAND_CAPACITY = 1_024;
    private static final long MAX_SPIN_MS = 1_000;

    private final ControllerHost host;
    private final Application application;
    private final Track root;
    private final CursorTrack cursorTrack;
    private final PinnableCursorClip clip;
    private final TrackBank slotBank;
    private final long originNanos = System.nanoTime();
    private final ArrayDeque<JsonObject> events = new ArrayDeque<>(), ticks = new ArrayDeque<>(), commands = new ArrayDeque<>();
    private long sequence, eventsDropped, ticksDropped, commandsDropped;
    private long tickCount, tickCallbacks, inTickChanges, stepCallbacks, slotCallbacks;
    private String lastSlotSignature = "";
    private boolean tickerActive, ordering;
    private long tickerGeneration;
    private String lastTickSignature = "";
    private long runGeneration;
    private int runRemaining;
    private String runError = "";

    public DeliveryCoherenceProbe(ControllerHost host, Application application, Project project) {
        this.host = host;
        this.application = application;
        root = project.getRootTrackGroup();
        cursorTrack = host.createCursorTrack("GN_CT_DELIVERY", "ghostnote delivery research", 0, 0, true);
        clip = cursorTrack.createLauncherCursorClip(WINDOW_STEPS, WINDOW_KEYS);
        clip.setStepSize(0.25);
        clip.scrollToKey(BASE_KEY);
        clip.scrollToStep(0);
        observe("projectName", application.projectName());
        observe("hasActiveEngine", application.hasActiveEngine());
        observe("rootChannelId", root.channelId());
        observe("cursorChannelId", cursorTrack.channelId());
        observe("cursorName", cursorTrack.name());
        observe("cursorMute", cursorTrack.mute());
        observe("clipExists", clip.exists());
        cursorTrack.exists().markInterested();
        clip.addStepDataObserver((x, y, state) -> {
            stepCallbacks++;
            JsonObject event = event("stepData");
            event.addProperty("x", x);
            event.addProperty("y", y);
            event.addProperty("state", state);
            push(events, event, EVENT_CAPACITY, true);
        });
        slotBank = host.createTrackBank(SLOT_TRACKS, 0, SLOT_ROWS, true);
        for (int t = 0; t < SLOT_TRACKS; t++) {
            Track track = slotBank.getItemAt(t);
            track.exists().markInterested();
            track.channelId().markInterested();
            ClipLauncherSlotBank slots = track.clipLauncherSlotBank();
            for (int r = 0; r < SLOT_ROWS; r++) slots.getItemAt(r).hasContent().markInterested();
            final int trackIndex = t;
            slots.addHasContentObserver((row, has) -> {
                slotCallbacks++;
                JsonObject event = event("slot");
                event.addProperty("t", trackIndex);
                event.addProperty("s", row);
                event.addProperty("has", has);
                push(events, event, EVENT_CAPACITY, true);
            });
        }
    }

    private void observe(String name, com.bitwig.extension.controller.api.Value<?> value) {
        value.markInterested();
        if (value instanceof com.bitwig.extension.controller.api.StringValue string)
            string.addValueObserver(v -> recordValue(name, v));
        else if (value instanceof com.bitwig.extension.controller.api.BooleanValue bool)
            bool.addValueObserver(v -> recordValue(name, v));
        else throw new IllegalArgumentException("unsupported observed value: " + name);
    }

    private void recordValue(String name, Object value) {
        JsonObject event = event("value");
        event.addProperty("name", name);
        event.addProperty("value", String.valueOf(value));
        push(events, event, EVENT_CAPACITY, true);
    }

    private JsonObject event(String kind) {
        JsonObject event = new JsonObject();
        event.addProperty("seq", ++sequence);
        event.addProperty("us", (System.nanoTime() - originNanos) / 1_000);
        event.addProperty("tick", tickCount);
        event.addProperty("kind", kind);
        return event;
    }

    private void push(ArrayDeque<JsonObject> queue, JsonObject value, int capacity, boolean eventQueue) {
        if (queue.size() >= capacity) {
            queue.removeFirst();
            if (eventQueue) eventsDropped++;
            else if (queue == ticks) ticksDropped++;
            else commandsDropped++;
        }
        queue.addLast(value);
    }

    /** One coherent read from the delivered controller-side state. */
    String signature() {
        StringBuilder value = new StringBuilder();
        value.append(application.projectName().get()).append('|')
            .append(root.channelId().get()).append('|')
            .append(cursorTrack.channelId().get()).append('|')
            .append(clip.exists().get() ? 'C' : '-').append('|')
            .append(witness(P_X, P_Y)).append('|').append(witness(Q_X, Q_Y)).append('|')
            .append(cursorTrack.mute().get() ? 'M' : '-').append('|')
            .append(stepState(SCRATCH_X, SCRATCH_Y));
        return value.toString();
    }

    /** Occupancy of the fixed slot window. `X` has content, `.` is empty, and `-` is an absent track. */
    String slotSignature() {
        StringBuilder value = new StringBuilder(SLOT_TRACKS * (SLOT_ROWS + 1));
        for (int t = 0; t < SLOT_TRACKS; t++) {
            if (t > 0) value.append(',');
            Track track = slotBank.getItemAt(t);
            boolean exists = track.exists().get();
            for (int r = 0; r < SLOT_ROWS; r++)
                value.append(!exists ? '-' : track.clipLauncherSlotBank().getItemAt(r).hasContent().get() ? 'X' : '.');
        }
        return value.toString();
    }

    private String witness(int x0, int y) {
        StringBuilder bits = new StringBuilder(WITNESS_WIDTH);
        for (int x = x0; x < x0 + WITNESS_WIDTH; x++) bits.append(stepState(x, y));
        return bits.toString();
    }

    private char stepState(int x, int y) {
        NoteStep.State state = clip.getStep(0, x, y).state();
        return state == NoteStep.State.NoteOn ? 'N' : state == NoteStep.State.NoteSustain ? 's' : '.';
    }

    private void tick(long generation) {
        if (!tickerActive || generation != tickerGeneration) return;
        tickCallbacks++;
        long seqBefore = sequence;
        String start = signature(), slots = slotSignature(), end = signature(), slotsEnd = slotSignature();
        tickCount++;
        boolean changedInside = !start.equals(end) || !slots.equals(slotsEnd);
        if (changedInside) inTickChanges++;
        if (ordering || changedInside || !start.equals(lastTickSignature) || !slots.equals(lastSlotSignature) || seqBefore != sequence) {
            JsonObject tick = event("tick");
            tick.addProperty("start", start);
            tick.addProperty("steps", stepCallbacks);
            tick.addProperty("slots", slots);
            tick.addProperty("slotCallbacks", slotCallbacks);
            if (changedInside) { tick.addProperty("end", end); tick.addProperty("slotsEnd", slotsEnd); }
            push(ticks, tick, TICK_CAPACITY, false);
            if (ordering) {
                long tickSeq = tick.get("seq").getAsLong(), steps = stepCallbacks, slotCount = slotCallbacks;
                host.scheduleTask(() -> confirm(generation, tickSeq, steps, slotCount, 1), 0);
            }
        }
        lastTickSignature = end;
        lastSlotSignature = slotsEnd;
        host.scheduleTask(() -> tick(generation), 0);
    }

    /** Record the step count that a task scheduled from a tick sees. */
    private void confirm(long generation, long tickSeq, long tickSteps, long tickSlots, int depth) {
        // tickSeq names the scheduling callback: a tick or an RPC record.
        if (!tickerActive || generation != tickerGeneration) return;
        JsonObject record = event("confirm");
        record.addProperty("tickSeq", tickSeq);
        record.addProperty("depth", depth);
        record.addProperty("tickSteps", tickSteps);
        record.addProperty("steps", stepCallbacks);
        record.addProperty("tickSlotCallbacks", tickSlots);
        record.addProperty("slotCallbacks", slotCallbacks);
        push(ticks, record, TICK_CAPACITY, false);
        if (depth < CONFIRM_DEPTH) host.scheduleTask(() -> confirm(generation, tickSeq, tickSteps, tickSlots, depth + 1), 0);
    }

    /** Record one bridge request callback. In ordering mode it also schedules confirmations. */
    public JsonObject ping() {
        JsonObject record = event("rpc");
        record.addProperty("steps", stepCallbacks);
        record.addProperty("slotCallbacks", slotCallbacks);
        push(ticks, record, TICK_CAPACITY, false);
        if (ordering && tickerActive) {
            long generation = tickerGeneration, rpcSeq = record.get("seq").getAsLong(), steps = stepCallbacks, slotCount = slotCallbacks;
            host.scheduleTask(() -> confirm(generation, rpcSeq, steps, slotCount, 1), 0);
        }
        JsonObject result = new JsonObject();
        result.addProperty("seq", record.get("seq").getAsLong());
        return result;
    }

    public JsonObject start() { return start(false); }

    public JsonObject start(boolean orderingMode) {
        ordering = orderingMode;
        tickerActive = true;
        long generation = ++tickerGeneration;
        lastTickSignature = lastSlotSignature = "";
        host.scheduleTask(() -> tick(generation), 0);
        return status();
    }

    public JsonObject stop() {
        tickerActive = false;
        tickerGeneration++;
        return status();
    }

    public JsonObject clear() {
        events.clear();
        ticks.clear();
        commands.clear();
        eventsDropped = ticksDropped = commandsDropped = 0;
        tickCallbacks = inTickChanges = stepCallbacks = slotCallbacks = 0;
        lastTickSignature = lastSlotSignature = "";
        return status();
    }

    public JsonObject status() {
        JsonObject result = new JsonObject();
        result.addProperty("marker", MARKER);
        result.addProperty("orderingMarker", ORDERING_MARKER);
        result.addProperty("slotMarker", SLOT_MARKER);
        result.addProperty("slotCallbacks", slotCallbacks);
        result.addProperty("slotSignature", slotSignature());
        result.addProperty("slotWindowTracks", SLOT_TRACKS);
        result.addProperty("slotWindowRows", SLOT_ROWS);
        result.addProperty("slotObservers", SLOT_TRACKS);
        result.addProperty("slotHandles", SLOT_TRACKS * SLOT_ROWS);
        result.addProperty("ordering", ordering);
        result.addProperty("researchOnly", true);
        result.addProperty("complete", false);
        result.addProperty("eligible", false);
        result.addProperty("sequence", sequence);
        result.addProperty("nowUs", (System.nanoTime() - originNanos) / 1_000);
        result.addProperty("tickerActive", tickerActive);
        result.addProperty("tickCount", tickCount);
        result.addProperty("tickCallbacks", tickCallbacks);
        result.addProperty("inTickChanges", inTickChanges);
        result.addProperty("stepCallbacks", stepCallbacks);
        result.addProperty("eventsRetained", events.size());
        result.addProperty("ticksRetained", ticks.size());
        result.addProperty("commandsRetained", commands.size());
        result.addProperty("eventsDropped", eventsDropped);
        result.addProperty("ticksDropped", ticksDropped);
        result.addProperty("commandsDropped", commandsDropped);
        result.addProperty("runGeneration", runGeneration);
        result.addProperty("runRemaining", runRemaining);
        result.addProperty("runError", runError);
        result.addProperty("signature", signature());
        return result;
    }

    public JsonObject trace() {
        JsonObject result = status();
        result.add("events", array(events));
        result.add("ticks", array(ticks));
        result.add("commands", array(commands));
        return result;
    }

    private static JsonArray array(ArrayDeque<JsonObject> values) {
        JsonArray array = new JsonArray();
        for (JsonObject value : values) array.add(value);
        return array;
    }

    /**
     * Run scripted steps. A negative delay runs the step in the same callback as
     * the previous step. Guarded steps refuse unless the delivered project name
     * and cursor channel equal the expected owned values at execution time.
     */
    public JsonObject run(JsonArray script) {
        if (runRemaining > 0) throw new IllegalStateException("a delivery run is active");
        List<List<JsonObject>> callbacks = new ArrayList<>();
        List<Long> delays = new ArrayList<>();
        for (JsonElement element : script) {
            JsonObject step = element.getAsJsonObject();
            validate(step);
            long delay = step.has("delayMs") ? step.get("delayMs").getAsLong() : 0;
            if (delay < 0 && !callbacks.isEmpty()) callbacks.get(callbacks.size() - 1).add(step);
            else {
                List<JsonObject> group = new ArrayList<>();
                group.add(step);
                callbacks.add(group);
                delays.add(Math.max(0, delay));
            }
        }
        if (callbacks.isEmpty()) throw new IllegalArgumentException("empty delivery script");
        long generation = ++runGeneration;
        runRemaining = callbacks.size();
        runError = "";
        schedule(generation, callbacks, delays, 0);
        return status();
    }

    private void schedule(long generation, List<List<JsonObject>> callbacks, List<Long> delays, int index) {
        if (index >= callbacks.size()) return;
        host.scheduleTask(() -> {
            if (generation != runGeneration) return;
            for (JsonObject step : callbacks.get(index)) {
                try { execute(step); }
                catch (RuntimeException error) {
                    runError = error.getClass().getSimpleName() + ": " + error.getMessage();
                    runRemaining = 0;
                    command(step, "error").addProperty("error", runError);
                    return;
                }
            }
            runRemaining--;
            schedule(generation, callbacks, delays, index + 1);
        }, delays.get(index));
    }

    private static void validate(JsonObject step) {
        String op = step.get("op").getAsString();
        switch (op) {
            case "invoke" -> step.get("id").getAsString();
            case "spin" -> {
                long ms = step.get("ms").getAsLong();
                if (ms <= 0 || ms > MAX_SPIN_MS) throw new IllegalArgumentException("spin must be 1.." + MAX_SPIN_MS + " ms");
            }
            case "mute", "scratchStep" -> {
                step.get("expectedProject").getAsString();
                step.get("expectedCursorChannelId").getAsString();
            }
            case "writeWitness", "clearWitness" -> {
                String side = step.get("side").getAsString();
                if (!side.equals("P") && !side.equals("Q")) throw new IllegalArgumentException("side must be P or Q");
                step.get("expectedProject").getAsString();
                step.get("expectedCursorChannelId").getAsString();
            }
            case "mark" -> step.get("label").getAsString();
            case "slotCreate", "slotDelete", "slotRecreate" -> {
                int track = step.get("track").getAsInt(), row = step.get("row").getAsInt();
                if (track < 0 || track >= SLOT_TRACKS || row < 0 || row >= SLOT_ROWS)
                    throw new IllegalArgumentException("slot outside the delivery window");
                step.get("expectedProject").getAsString();
                step.get("expectedTrackChannelId").getAsString();
            }
            default -> throw new IllegalArgumentException("unknown delivery step: " + op);
        }
    }

    private void execute(JsonObject step) {
        String op = step.get("op").getAsString();
        switch (op) {
            case "invoke" -> {
                String id = step.get("id").getAsString();
                Action action = application.getAction(id);
                JsonObject record = command(step, action == null ? "unresolved" : "invoked");
                if (action == null) throw new IllegalArgumentException("unresolved action: " + id);
                action.invoke();
                record.addProperty("returnedUs", (System.nanoTime() - originNanos) / 1_000);
            }
            case "spin" -> spin(step);
            case "mute" -> {
                guard(step);
                JsonObject record = command(step, "mute");
                boolean value = cursorTrack.mute().get();
                for (int n = 0; n < step.get("count").getAsInt(); n++) {
                    value = !value;
                    cursorTrack.mute().set(value);
                }
                record.addProperty("finalRequested", value);
            }
            case "scratchStep" -> {
                guard(step);
                JsonObject record = command(step, "scratchStep");
                boolean on = stepState(SCRATCH_X, SCRATCH_Y) == 'N';
                for (int n = 0; n < step.get("count").getAsInt(); n++) {
                    if (on) clip.clearStep(0, SCRATCH_X, SCRATCH_Y);
                    else clip.setStep(0, SCRATCH_X, SCRATCH_Y, 100, 0.25);
                    on = !on;
                }
                record.addProperty("finalRequestedOn", on);
            }
            case "writeWitness", "clearWitness" -> {
                guard(step);
                command(step, op);
                boolean p = step.get("side").getAsString().equals("P");
                int x0 = p ? P_X : Q_X, y = p ? P_Y : Q_Y;
                for (int x = x0; x < x0 + WITNESS_WIDTH; x++) {
                    if (op.equals("writeWitness")) clip.setStep(0, x, y, 100, 0.25);
                    else clip.clearStep(0, x, y);
                }
            }
            case "mark" -> command(step, "mark");
            case "slotCreate", "slotDelete", "slotRecreate" -> {
                Track track = slotGuard(step);
                int row = step.get("row").getAsInt();
                var slot = track.clipLauncherSlotBank().getItemAt(row);
                boolean had = slot.hasContent().get();
                JsonObject record = command(step, op);
                record.addProperty("hadContent", had);
                if (op.equals("slotCreate") == had) throw new IllegalStateException("slot guard refused: hasContent=" + had);
                // slotRecreate deletes and creates in one callback. Delivered state stays confined until it returns.
                if (!op.equals("slotCreate")) slot.deleteObject();
                if (!op.equals("slotDelete")) track.createNewLauncherClip(row, SLOT_CLIP_BEATS);
            }
            default -> throw new IllegalArgumentException("unknown delivery step: " + op);
        }
    }

    /** Refuse unless the delivered project name and the window track UUID equal the owned values. */
    private Track slotGuard(JsonObject step) {
        String project = application.projectName().get();
        Track track = slotBank.getItemAt(step.get("track").getAsInt());
        String channel = track.exists().get() ? track.channelId().get() : "";
        if (!step.get("expectedProject").getAsString().equals(project)
            || !step.get("expectedTrackChannelId").getAsString().equals(channel))
            throw new IllegalStateException("slot guard refused: project=" + project + " track=" + channel);
        return track;
    }

    private void guard(JsonObject step) {
        String project = application.projectName().get(), channel = cursorTrack.channelId().get();
        if (!step.get("expectedProject").getAsString().equals(project)
            || !step.get("expectedCursorChannelId").getAsString().equals(channel)
            || !clip.exists().get())
            throw new IllegalStateException("guard refused: project=" + project + " cursor=" + channel
                + " clip=" + clip.exists().get());
    }

    /** Hold the callback and record every signature change inside it. */
    private void spin(JsonObject step) {
        JsonObject record = command(step, "spin");
        long until = System.nanoTime() + step.get("ms").getAsLong() * 1_000_000;
        String previous = signature(), first = previous;
        long reads = 1;
        JsonArray changes = new JsonArray();
        while (System.nanoTime() < until) {
            String current = signature();
            reads++;
            if (!current.equals(previous)) {
                JsonObject change = new JsonObject();
                change.addProperty("us", (System.nanoTime() - originNanos) / 1_000);
                change.addProperty("value", current);
                if (changes.size() < 64) changes.add(change);
                previous = current;
            }
        }
        long seqBefore = record.get("seq").getAsLong();
        record.addProperty("first", first);
        record.addProperty("reads", reads);
        record.add("changes", changes);
        record.addProperty("eventsDuringSpin", sequence - seqBefore);
        record.addProperty("endedUs", (System.nanoTime() - originNanos) / 1_000);
    }

    private JsonObject command(JsonObject step, String kind) {
        JsonObject record = event("command");
        record.addProperty("op", kind);
        record.add("step", step.deepCopy());
        push(commands, record, COMMAND_CAPACITY, false);
        return record;
    }
}
