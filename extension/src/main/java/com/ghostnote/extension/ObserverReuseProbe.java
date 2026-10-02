package com.ghostnote.extension;

import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.NoteStep;
import com.bitwig.extension.controller.api.PinnableCursorClip;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Measure cursor reuse. Callback hints stay outside the domain cache. */
public final class ObserverReuseProbe {
    private static final Gson JSON = new Gson();
    private static final int WIDTH = 2048, KEYS = 128, MAX_HINTS = 2048;
    private static final int MAX_TRACE = 4096, MAX_NOTES = 8192;
    private static final double GRID = 1.0 / 512.0, BATCH_MS = 45;
    private final int scenes;
    private final View resident, authority;
    private final ArrayDeque<Map<String, Object>> events = new ArrayDeque<>();
    private final long constructed = System.nanoTime();
    private long eventSequence, droppedTraceEvents, traceEpoch;
    private long revision, getStepCalls, comparisons, matches, mismatches;
    private String comparison = "not-run", reason = "unbound";
    private Scan scan;
    private JsonObject lastComparison;

    public ObserverReuseProbe(ControllerHost host, RigConfig config) {
        scenes = config.scenes;
        resident = new View(host, "RESIDENT");
        authority = new View(host, "AUTHORITY");
    }

    public JsonObject info() { return status(); }

    public JsonObject status() {
        JsonObject result = base();
        result.add("resident", resident.status());
        result.add("authority", authority.status());
        result.addProperty("comparison", comparison);
        result.addProperty("reason", reason);
        result.addProperty("revision", revision);
        result.addProperty("traceEvents", events.size());
        result.addProperty("traceEpoch", traceEpoch);
        result.addProperty("droppedTraceEvents", droppedTraceEvents);
        result.addProperty("getStepCalls", getStepCalls);
        result.addProperty("comparisons", comparisons);
        result.addProperty("matches", matches);
        result.addProperty("mismatches", mismatches);
        result.addProperty("scanComplete", lastComparison != null);
        result.addProperty("scanNextCoordinate", scan == null ? 0 : scan.next);
        result.addProperty("scanCoordinates", WIDTH * KEYS);
        result.addProperty("scanHostWorkMs", scan == null ? 0 : scan.hostWorkMs);
        result.addProperty("retainedObservationNotes", resident.noteCount);
        return result;
    }

    private JsonObject base() {
        JsonObject result = new JsonObject();
        result.addProperty("instrumentationRevision", "8g-reuse-sparse-replay-v3");
        result.addProperty("researchOnly", true);
        result.addProperty("complete", false);
        result.addProperty("eligible", false);
        result.addProperty("projectScopeComplete", false);
        result.addProperty("callbackSourceIdentityKnown", false);
        result.addProperty("callbackPayloadUsed", false);
        result.addProperty("fullComparisonSeedsRecorder", false);
        result.addProperty("observerKind", "StepDataChangedCallback");
        result.addProperty("observerRegistration", "addStepDataObserver");
        result.addProperty("callbackChannelAvailable", false);
        result.addProperty("steps", WIDTH);
        result.addProperty("keys", KEYS);
        result.addProperty("channels", 16);
        result.addProperty("grid", GRID);
        result.addProperty("maxHintsPerView", MAX_HINTS);
        result.addProperty("maxTraceEvents", MAX_TRACE);
        result.addProperty("maxNotesPerScanView", MAX_NOTES);
        return result;
    }

    /** Cancel earlier work before each new selection request. */
    public JsonObject point(Track target, int row, String expectedChannelId) {
        requireTarget(target, row, expectedChannelId);
        revision++;
        scan = null;
        lastComparison = null;
        comparison = "not-run";
        reason = "binding";
        authority.retire();
        resident.point(target, row, expectedChannelId);
        return status();
    }

    public JsonObject point(Track target, int row) {
        return point(target, row, target.channelId().get());
    }

    private void requireTarget(Track target, int row, String expectedChannelId) {
        if (target == null || !target.exists().get() || expectedChannelId == null
            || expectedChannelId.isBlank() || !expectedChannelId.equals(target.channelId().get()))
            throw new IllegalArgumentException("target channelId does not match the expected source");
        if (row < 0 || row >= scenes)
            throw new IllegalArgumentException("row is outside the configured Launcher bank");
        if (!target.clipLauncherSlotBank().getItemAt(row).hasContent().get())
            throw new IllegalArgumentException("target slot has no clip");
    }

    public JsonObject poll() {
        resident.advance();
        if ("settled".equals(resident.phase)) reason = "settled-research-only";
        return status();
    }

    /** Change one clip subscription counter only when its requested state changes. */
    public JsonObject subscribe(boolean subscribed) {
        if (resident.subscribed != subscribed) {
            scan = null;
            lastComparison = null;
            comparison = "not-run";
            reason = "subscription-changed";
            resident.setSubscribed(subscribed);
        }
        return status();
    }

    public JsonObject cancel() {
        revision++;
        scan = null;
        lastComparison = null;
        resident.retire();
        authority.retire();
        comparison = "cancelled";
        reason = "cancelled";
        return status();
    }

    public JsonObject trace() {
        JsonObject result = status();
        result.add("events", JSON.toJsonTree(events));
        result.addProperty("sourceOrigin", "unknown; arrival context is diagnostic only");
        return result;
    }

    public JsonObject clearTrace() {
        events.clear();
        droppedTraceEvents = 0;
        traceEpoch++;
        return status();
    }

    /** Read current data for physical hints. Never use callback state as note data. */
    public JsonObject reconcile() {
        if (!resident.ready() || !"settled".equals(resident.phase) || resident.hintOverflow) {
            reason = resident.hintOverflow ? "hint-overflow-full-scan-required" : "resident-not-settled";
            return status();
        }
        long started = System.nanoTime(), expectedRevision = revision, expectedBinding = resident.bindingRevision;
        long callbacksAtStart = resident.callbacks;
        Map<String, Object> before = metadata(resident.clip);
        List<Map.Entry<Integer, Long>> work = resident.hints.entrySet().stream()
            .map(entry -> Map.entry(entry.getKey(), entry.getValue())).toList();
        List<Map<String, Object>> changed = new ArrayList<>();
        int coordinates = 0;
        for (Map.Entry<Integer, Long> entry : work) {
            if (coordinates > 0 && elapsed(started) >= BATCH_MS) break;
            int key = entry.getKey();
            long callbacksBefore = resident.callbacks;
            List<Map<String, Object>> notes;
            try { notes = read(resident.clip, key); }
            catch (RuntimeException error) { reason = "reconcile-read-error:" + error.getClass().getSimpleName(); break; }
            if (revision != expectedRevision || !resident.ready()
                || !before.equals(metadata(resident.clip)) || callbacksBefore != resident.callbacks) {
                reason = "reconcile-window-changed";
                break;
            }
            int oldSize = resident.observed.getOrDefault(key, List.of()).size();
            if (resident.noteCount - oldSize + notes.size() > MAX_NOTES) {
                reason = "observation-note-limit";
                break;
            }
            if (notes.isEmpty()) resident.observed.remove(key);
            else resident.observed.put(key, notes);
            resident.noteCount += notes.size() - oldSize;
            resident.hints.remove(key, entry.getValue());
            changed.add(Map.of("cell", key / KEYS, "pitch", key % KEYS, "notes", notes));
            coordinates++;
        }
        JsonObject result = status();
        result.addProperty("reconciledCoordinates", coordinates);
        result.addProperty("hostWorkMs", elapsed(started));
        result.add("changedCoordinates", JSON.toJsonTree(changed));
        result.addProperty("observationComplete", false);
        boolean current = revision == expectedRevision && resident.bindingRevision == expectedBinding && resident.ready()
            && "settled".equals(resident.phase) && before.equals(metadata(resident.clip)) && callbacksAtStart == resident.callbacks;
        result.addProperty("sparseObservationCurrent", current && resident.hints.isEmpty() && !resident.hintOverflow);
        result.addProperty("sparseObservationAvailable", current);
        result.addProperty("sparseRevisionBefore", expectedRevision);
        result.addProperty("sparseRevisionAfter", revision);
        result.addProperty("sparseBindingBefore", expectedBinding);
        result.addProperty("sparseBindingAfter", resident.bindingRevision);
        result.addProperty("sparseCallbacksBefore", callbacksAtStart);
        result.addProperty("sparseCallbacksAfter", resident.callbacks);
        result.add("sparseNotes", JSON.toJsonTree(flatten(resident.observed)));
        result.add("sparseMetadata", JSON.toJsonTree(before));
        return result;
    }

    /** Bind an independent handle after the resident handle is pinned. */
    public JsonObject compareStart() {
        scan = null;
        lastComparison = null;
        if (!resident.ready() || !"settled".equals(resident.phase)) {
            comparison = "refused";
            reason = "resident-not-settled";
            return status();
        }
        requireTarget(resident.target, resident.row, resident.expectedId);
        authority.point(resident.target, resident.row, resident.expectedId);
        scan = new Scan();
        comparison = "binding-authority";
        reason = "independent-authority-binding";
        return status();
    }

    /** Scan both fixed windows in short batches. No result is a cache admission. */
    public JsonObject comparePoll() {
        if (scan == null) return lastComparison == null ? status() : lastComparison.deepCopy();
        Scan work = scan;
        if (revision != work.revision || !resident.ready()) return abort("window-changed");
        if (elapsed(work.started) > 60_000) return abort("scan-timeout");
        if (!work.authorityReady) {
            authority.advance();
            if ("retired".equals(authority.phase)) return abort("authority-binding-failed");
            if (!"settled".equals(authority.phase)) return status();
            if (!authority.ready()) return abort("authority-not-bound");
            work.authorityReady = true;
            work.residentCallbacks = resident.callbacks;
            work.authorityCallbacks = authority.callbacks;
            work.residentMetadata = metadata(resident.clip);
            work.authorityMetadata = metadata(authority.clip);
            work.sparseBeforeScan.putAll(resident.observed);
            work.sparseNoteCountBeforeScan = resident.noteCount;
            work.sparseHintsBeforeScan = resident.hints.size();
            comparison = "scanning";
        }
        if (!windowStable(work)) return abort("window-changed");
        long started = System.nanoTime();
        try {
            while (work.next < WIDTH * KEYS && elapsed(started) < BATCH_MS) {
                int key = work.next++;
                List<Map<String, Object>> left = read(resident.clip, key);
                List<Map<String, Object>> right = read(authority.clip, key);
                work.leftCount += left.size();
                work.rightCount += right.size();
                if (work.leftCount > MAX_NOTES || work.rightCount > MAX_NOTES)
                    return abort("scan-note-limit");
                if (!left.isEmpty()) work.left.put(key, left);
                if (!right.isEmpty()) work.right.put(key, right);
            }
        } catch (RuntimeException error) {
            return abort("read-error:" + error.getClass().getSimpleName());
        } finally { work.hostWorkMs += elapsed(started); }
        if (!windowStable(work)) return abort("window-changed");
        if (work.next < WIDTH * KEYS) return status();
        comparisons++;
        boolean equal = work.left.equals(work.right)
            && work.residentMetadata.equals(work.authorityMetadata);
        comparison = equal ? "match" : "mismatch";
        reason = equal ? "empirical-current-window-match" : "empirical-current-window-mismatch";
        if (equal) matches++; else mismatches++;
        JsonObject result = status();
        result.addProperty("scanComplete", true);
        result.addProperty("resultIsHistoricalObservation", true);
        result.addProperty("observedRevision", work.revision);
        result.addProperty("scanElapsedMs", elapsed(work.started));
        result.addProperty("scanHostWorkMs", work.hostWorkMs);
        result.addProperty("residentNoteCount", work.leftCount);
        result.addProperty("authorityNoteCount", work.rightCount);
        result.add("residentNotes", JSON.toJsonTree(flatten(work.left)));
        result.add("authorityNotes", JSON.toJsonTree(flatten(work.right)));
        result.add("residentMetadata", JSON.toJsonTree(work.residentMetadata));
        result.add("authorityMetadata", JSON.toJsonTree(work.authorityMetadata));
        result.add("residentSparseNotesBeforeScan", JSON.toJsonTree(flatten(work.sparseBeforeScan)));
        result.addProperty("residentSparseNoteCountBeforeScan", work.sparseNoteCountBeforeScan);
        result.addProperty("residentSparseHintsBeforeScan", work.sparseHintsBeforeScan);
        result.addProperty("sparseMatchesResidentScan", work.sparseBeforeScan.equals(work.left));
        result.addProperty("sparseMatchesAuthorityScan", work.sparseBeforeScan.equals(work.right));
        result.addProperty("unknownFields", "portableRepeat,articulation");
        if (!windowStable(work)) {
            comparisons--;
            if (equal) matches--; else mismatches--;
            return abort("window-changed");
        }
        // A diagnostic scan must not seed or repair the sparse recorder.
        scan = null;
        lastComparison = result.deepCopy();
        return result;
    }

    private boolean windowStable(Scan work) {
        return revision == work.revision && resident.ready() && authority.ready()
            && work.residentMetadata.equals(metadata(resident.clip))
            && work.authorityMetadata.equals(metadata(authority.clip))
            && resident.callbacks == work.residentCallbacks && authority.callbacks == work.authorityCallbacks;
    }

    private JsonObject abort(String cause) {
        scan = null;
        lastComparison = null;
        comparison = "window-changed".equals(cause) ? "window-changed" : "refused";
        reason = cause;
        return status();
    }

    private static List<Map<String, Object>> flatten(Map<Integer, List<Map<String, Object>>> values) {
        List<Map<String, Object>> result = new ArrayList<>();
        values.values().forEach(result::addAll);
        return result;
    }

    private List<Map<String, Object>> read(PinnableCursorClip clip, int coordinate) {
        int x = coordinate / KEYS, y = coordinate % KEYS;
        List<Map<String, Object>> notes = new ArrayList<>();
        for (int channel = 0; channel < 16; channel++) {
            getStepCalls++;
            NoteStep step = clip.getStep(channel, x, y);
            if (step.state() != NoteStep.State.NoteOn) continue;
            Map<String, Object> fields = new LinkedHashMap<>();
            fields.put("velocity", step.velocity());
            fields.put("releaseVelocity", step.releaseVelocity());
            fields.put("velocitySpread", step.velocitySpread());
            double rawDuration = step.duration();
            long cells = ShadowCacheProbe.normalizeDurationCells(rawDuration);
            fields.put("duration", cells * GRID);
            fields.put("durationCells", cells);
            fields.put("rawDuration", rawDuration);
            double rawGain = step.gain(), rawTimbre = step.timbre();
            fields.put("gain", rawGain);
            fields.put("rawGain", rawGain);
            fields.put("pan", step.pan());
            fields.put("pressure", step.pressure());
            fields.put("timbre", (rawTimbre + 1) / 2);
            fields.put("rawTimbre", rawTimbre);
            fields.put("transpose", step.transpose());
            fields.put("chance", step.chance());
            fields.put("isChanceEnabled", step.isChanceEnabled());
            fields.put("isMuted", step.isMuted());
            fields.put("isOccurrenceEnabled", step.isOccurrenceEnabled());
            fields.put("occurrence", step.occurrence().name());
            fields.put("isRecurrenceEnabled", step.isRecurrenceEnabled());
            fields.put("recurrenceLength", step.recurrenceLength());
            fields.put("recurrenceMask", step.recurrenceMask());
            fields.put("isRepeatEnabled", step.isRepeatEnabled());
            fields.put("repeatCount", step.repeatCount());
            fields.put("repeatCurve", step.repeatCurve());
            fields.put("repeatVelocityCurve", step.repeatVelocityCurve());
            fields.put("repeatVelocityEnd", step.repeatVelocityEnd());
            for (Object value : fields.values()) {
                if (value instanceof Double number && !Double.isFinite(number))
                    throw new IllegalStateException("host note has a non-finite value");
            }
            notes.add(Map.of("channel", channel, "cell", x, "pitch", y, "fields", Map.copyOf(fields)));
        }
        return notes;
    }

    private static Map<String, Object> metadata(PinnableCursorClip clip) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("name", clip.clipLauncherSlot().name().get());
        result.put("playStart", clip.getPlayStart().get());
        result.put("playStop", clip.getPlayStop().get());
        result.put("isLoopEnabled", clip.isLoopEnabled().get());
        result.put("loopStart", clip.getLoopStart().get());
        result.put("loopLength", clip.getLoopLength().get());
        result.put("colorRed", clip.color().red());
        result.put("colorGreen", clip.color().green());
        result.put("colorBlue", clip.color().blue());
        result.put("colorAlpha", clip.color().alpha());
        for (Object value : result.values()) {
            if (value instanceof Number number && !Double.isFinite(number.doubleValue()))
                throw new IllegalStateException("host metadata has a non-finite value");
        }
        return Map.copyOf(result);
    }

    private static double elapsed(long since) { return (System.nanoTime() - since) / 1_000_000.0; }

    private final class View {
        final String id;
        final CursorTrack track;
        final PinnableCursorClip clip;
        final LinkedHashMap<Integer, Long> hints = new LinkedHashMap<>();
        final TreeMap<Integer, List<Map<String, Object>>> observed = new TreeMap<>();
        Track target;
        String expectedId, phase = "unbound";
        int row = -1, quietPolls, noteCount, carriedCoordinates;
        boolean subscribed = true, hintOverflow;
        long bindingRevision, callbacks, callbacksWhileUnsubscribed, callbacksDuringBinding;
        long outOfBoundsCallbacks, hintDrops, started, settledAt, lastPoll, lastCallbacks;
        long subscribeCalls, unsubscribeCalls, hintSequence, sameTargetPreserves, targetTransitions;
        boolean recorderPreserved;

        View(ControllerHost host, String id) {
            this.id = id;
            track = host.createCursorTrack("GN_OBSERVER_REUSE_" + id, "ghostnote reuse " + id, 0, scenes, false);
            track.exists().markInterested();
            track.channelId().markInterested();
            track.isPinned().markInterested();
            clip = track.createLauncherCursorClip(WIDTH, KEYS);
            subscribed = clip.isSubscribed();
            clip.setStepSize(GRID);
            clip.exists().markInterested();
            clip.isPinned().markInterested();
            clip.clipLauncherSlot().sceneIndex().markInterested();
            clip.clipLauncherSlot().name().markInterested();
            clip.getPlayStart().markInterested();
            clip.getPlayStop().markInterested();
            clip.isLoopEnabled().markInterested();
            clip.getLoopStart().markInterested();
            clip.getLoopLength().markInterested();
            clip.color().markInterested();
            clip.addStepDataObserver(this::record);
        }

        void record(int x, int y, int rawState) {
            String state = switch (rawState) { case 0 -> "Empty"; case 1 -> "Sustain"; case 2 -> "NoteOn"; default -> "Unknown"; };
            callbacks++;
            long sequence = ++eventSequence;
            boolean actualSubscribed = clip.isSubscribed();
            if (!actualSubscribed) callbacksWhileUnsubscribed++;
            if (!"settled".equals(phase)) callbacksDuringBinding++;
            Map<String, Object> event = new LinkedHashMap<>();
            event.put("sequence", sequence);
            event.put("elapsedMs", elapsed(constructed));
            event.put("view", id);
            event.put("x", x);
            event.put("y", y);
            event.put("rawState", rawState);
            event.put("channelAvailable", false);
            event.put("state", state);
            event.put("phaseAtArrival", phase);
            event.put("bindingRevisionAtArrival", bindingRevision);
            event.put("subscribedAtArrival", subscribed);
            event.put("actualSubscribedAtArrival", actualSubscribed);
            if (events.size() == MAX_TRACE) { events.removeFirst(); droppedTraceEvents++; }
            events.addLast(Map.copyOf(event));
            if (x < 0 || x >= WIDTH || y < 0 || y >= KEYS || rawState < 0 || rawState > 2) {
                outOfBoundsCallbacks++;
                return;
            }
            int coordinate = x * KEYS + y;
            if (!hints.containsKey(coordinate) && hints.size() == MAX_HINTS) {
                hintOverflow = true;
                hintDrops++;
                return;
            }
            hints.put(coordinate, ++hintSequence);
        }

        void point(Track target, int row, String expectedId) {
            bindingRevision++;
            recorderPreserved = "settled".equals(phase) && ready() && clip.isSubscribed()
                && expectedId.equals(this.expectedId) && row == this.row && !hintOverflow;
            if (recorderPreserved) {
                sameTargetPreserves++;
                this.target = target;
                return;
            }
            targetTransitions++;
            carriedCoordinates = observed.size();
            // Old coordinates are read again from the confirmed current target.
            for (Integer coordinate : observed.keySet()) {
                if (!hints.containsKey(coordinate) && hints.size() >= MAX_HINTS) { hintOverflow = true; hintDrops++; break; }
                hints.putIfAbsent(coordinate, ++hintSequence);
            }
            observed.clear();
            noteCount = 0;
            this.target = target;
            this.row = row;
            this.expectedId = expectedId;
            phase = "track";
            started = System.nanoTime();
            settledAt = lastPoll = 0;
            quietPolls = 0;
            clip.isPinned().set(false);
            track.isPinned().set(false);
            track.selectChannel(target);
        }

        void retire() {
            bindingRevision++;
            phase = "retired";
            recorderPreserved = false;
            hints.clear();
            observed.clear();
            noteCount = 0;
            hintOverflow = false;
        }

        void setSubscribed(boolean value) {
            if (subscribed == value) return;
            subscribed = value;
            if (value) { clip.subscribe(); subscribeCalls++; }
            else { clip.unsubscribe(); unsubscribeCalls++; }
        }

        void advance() {
            if ("retired".equals(phase) || "unbound".equals(phase)) return;
            if (target == null || !target.exists().get() || !expectedId.equals(target.channelId().get())) {
                phase = "retired";
                reason = "source-identity-changed";
                return;
            }
            if (!"settled".equals(phase) && elapsed(started) > 5_000) {
                phase = "retired";
                reason = "binding-settlement-timeout";
                return;
            }
            switch (phase) {
                case "track" -> {
                    if (track.exists().get() && expectedId.equals(track.channelId().get())) {
                        track.isPinned().set(true);
                        phase = "track-pin";
                    }
                }
                case "track-pin" -> {
                    if (track.isPinned().get() && expectedId.equals(track.channelId().get())) {
                        target.selectSlot(row);
                        phase = "slot";
                    }
                }
                case "slot" -> {
                    if (track.isPinned().get() && expectedId.equals(track.channelId().get())
                        && clip.exists().get() && row == clip.clipLauncherSlot().sceneIndex().get()) {
                        clip.isPinned().set(true);
                        phase = "clip-pin";
                    }
                }
                case "clip-pin" -> {
                    if (ready()) {
                        phase = "settling";
                        settledAt = System.nanoTime();
                        lastCallbacks = callbacks;
                        lastPoll = 0;
                        quietPolls = 0;
                    }
                }
                case "settling" -> {
                    if (!ready()) { phase = "retired"; reason = "bound-target-changed"; return; }
                    if (lastPoll == 0 || elapsed(lastPoll) >= 50) {
                        quietPolls = callbacks == lastCallbacks ? quietPolls + 1 : 0;
                        lastCallbacks = callbacks;
                        lastPoll = System.nanoTime();
                    }
                    if (elapsed(settledAt) >= 1_500 && quietPolls >= 10) phase = "settled";
                }
                case "settled" -> {
                    if (!ready()) { phase = "retired"; reason = "bound-target-changed"; }
                }
                default -> throw new IllegalStateException("unknown binding phase");
            }
        }

        boolean ready() {
            return expectedId != null && target != null && target.exists().get()
                && expectedId.equals(target.channelId().get()) && track.exists().get()
                && expectedId.equals(track.channelId().get()) && clip.exists().get()
                && row == clip.clipLauncherSlot().sceneIndex().get()
                && track.isPinned().get() && clip.isPinned().get();
        }

        JsonObject status() {
            JsonObject result = new JsonObject();
            result.addProperty("phase", phase);
            result.addProperty("expectedChannelId", expectedId);
            result.addProperty("expectedRow", row);
            result.addProperty("bindingRevision", bindingRevision);
            result.addProperty("subscribed", subscribed);
            result.addProperty("actualSubscribed", clip.isSubscribed());
            result.addProperty("callbacks", callbacks);
            result.addProperty("callbacksWhileUnsubscribed", callbacksWhileUnsubscribed);
            result.addProperty("callbacksDuringBinding", callbacksDuringBinding);
            result.addProperty("outOfBoundsCallbacks", outOfBoundsCallbacks);
            result.addProperty("pendingHints", hints.size());
            result.addProperty("hintOverflow", hintOverflow);
            result.addProperty("hintDrops", hintDrops);
            result.addProperty("quietPolls", quietPolls);
            result.addProperty("trackId", track.channelId().get());
            result.addProperty("sceneIndex", clip.clipLauncherSlot().sceneIndex().get());
            result.addProperty("trackPinned", track.isPinned().get());
            result.addProperty("clipPinned", clip.isPinned().get());
            result.addProperty("bound", ready());
            result.addProperty("subscribeCalls", subscribeCalls);
            result.addProperty("unsubscribeCalls", unsubscribeCalls);
            result.addProperty("recorderPreserved", recorderPreserved);
            result.addProperty("sameTargetPreserves", sameTargetPreserves);
            result.addProperty("targetTransitions", targetTransitions);
            result.addProperty("carriedCoordinates", carriedCoordinates);
            result.addProperty("observedNoteCount", noteCount);
            result.addProperty("observedCoordinates", observed.size());
            return result;
        }
    }

    private final class Scan {
        final long revision = ObserverReuseProbe.this.revision;
        final long started = System.nanoTime();
        final TreeMap<Integer, List<Map<String, Object>>> left = new TreeMap<>(), right = new TreeMap<>(), sparseBeforeScan = new TreeMap<>();
        long residentCallbacks, authorityCallbacks;
        Map<String, Object> residentMetadata, authorityMetadata;
        boolean authorityReady;
        int next, leftCount, rightCount, sparseNoteCountBeforeScan, sparseHintsBeforeScan;
        double hostWorkMs;
    }
}
