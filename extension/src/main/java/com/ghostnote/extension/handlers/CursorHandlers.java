package com.ghostnote.extension.handlers;

import com.ghostnote.extension.ClipLaunch;
import com.ghostnote.extension.ClipMetadata;
import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.Clip;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.PinnableCursorClip;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Cursor-pool addressing and UI-selection observation (E1).
 *
 * The pool is non-following CursorTracks plus their PinnableCursorClips; the
 * only pointing mechanism that works is track-then-slot (E1), and pointing
 * borrows the user's UI selection as a side effect — which is exactly why E6
 * bans named actions, since they would fire against the target we just moved.
 *
 * Split out of ProbeHandlers.java in Phase 0; the method bodies are unchanged.
 */
public final class CursorHandlers extends HandlerGroup {
    /** 8h4a4 build marker: `cursor.status` and `cursor.playState` report `trackChannelId`. */
    public static final String CURSOR_IDENTITY = "cursor-channel-id-v1";
    /** 8i0 build marker: `cursor.setClipMetadata` accepts `fields` and any colour byte triple (D42). */
    public static final String CLIP_METADATA_WRITE = "owned-fields-v1";

    public CursorHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("cursor.pin", params -> cursorPin(params));
        r.on("cursor.pinTrack", params -> cursorPinTrack(params));
        r.on("cursor.pointTrack", params -> cursorPointTrack(params));
        r.on("cursor.pointToClipOf", params -> cursorPointToClipOf(params));
        r.on("cursor.status", params -> cursorStatus(params));
        r.on("cursor.playState", params -> cursorPlayState(params));
        r.on("cursor.launchSettings", params -> cursorLaunchSettings(params));
        r.on("cursor.setLaunchSettings", params -> cursorSetLaunchSettings(params));
        r.on("cursor.clipMetadata", params -> cursorClipMetadata(params));
        r.on("cursor.setClipMetadata", params -> cursorSetClipMetadata(params));
        r.on("cursor.duplicateContent", params -> cursorDuplicateContent(params));
        r.on("selection.status", params -> selectionStatus());
        r.on("equals.status", params -> equalsStatus(params));
        r.on("equals.tryCreate", params -> equalsTryCreate());
    }

    // ------------------------------- Phase 2 session 2e: clip lifecycle probe

    /** Read every candidate launcher-clip metadata value through one cursor. */
    private JsonElement cursorClipMetadata(JsonObject params) {
        // 8h4a: the `clip.read` reply holds the same block (ClipMetadata).
        return ClipMetadata.read(rig.clip(params.get("cursor").getAsString()));
    }

    /** Set candidate metadata fields independently for the live probe. */
    private JsonElement cursorSetClipMetadata(JsonObject params) {
        Clip clip = rig.clip(params.get("cursor").getAsString());
        if (params.has("fields")) {
            return setOwnedClipMetadata(clip, params);
        }
        if (params.has("lengthBeats")) {
            String name = params.get("name").getAsString();
            double length = requireBeat(params, "lengthBeats", false);
            double playStart = requireBeat(params, "playStartBeats", true);
            double loopStart = requireBeat(params, "loopStartBeats", true);
            double loopEnd = requireBeat(params, "loopEndBeats", false);
            if (loopEnd <= loopStart || Math.abs(loopStart + length - loopEnd) > 1e-9) {
                throw new IllegalArgumentException(
                    "clip metadata must have a positive loop length and loop end "
                    + "equal to loop start plus length");
            }
            var color = params.getAsJsonArray("colorBytes");
            if (color.size() != 3) {
                throw new IllegalArgumentException("colorBytes must contain red, green, and blue");
            }
            int red = requireColorByte(color.get(0).getAsInt(), "red");
            int green = requireColorByte(color.get(1).getAsInt(), "green");
            int blue = requireColorByte(color.get(2).getAsInt(), "blue");

            // E43: a loop-start write can move the play markers. Write the loop
            // first, then restore the writable play start. Play-stop writes are
            // accepted but ignored and are not part of the product contract.
            clip.getLoopLength().set(length);
            clip.getLoopStart().set(loopStart);
            clip.getPlayStart().set(playStart);
            clip.isLoopEnabled().set(params.get("loopEnabled").getAsBoolean());
            clip.setName(name);
            // D02 Session 8: target the launcher slot by its verified position.
            // The brain supplies the live-measured wire bytes for this route.
            int trackIndex = params.get("trackIndex").getAsInt();
            int slotIndex = params.get("slotIndex").getAsInt();
            rig.trackBank.getItemAt(trackIndex).clipLauncherSlotBank().getItemAt(slotIndex)
                .color().set(colorByteCenter(red), colorByteCenter(green), colorByteCenter(blue));
            return ok();
        }
        boolean touched = false;
        if (params.has("name")) {
            clip.setName(params.get("name").getAsString());
            touched = true;
        }
        if (params.has("playStart")) {
            clip.getPlayStart().set(requireBeat(params, "playStart", true));
            touched = true;
        }
        if (params.has("playStop")) {
            clip.getPlayStop().set(requireBeat(params, "playStop", false));
            touched = true;
        }
        if (params.has("loopEnabled")) {
            clip.isLoopEnabled().set(params.get("loopEnabled").getAsBoolean());
            touched = true;
        }
        if (params.has("loopStart")) {
            clip.getLoopStart().set(requireBeat(params, "loopStart", true));
            touched = true;
        }
        if (params.has("loopLength")) {
            clip.getLoopLength().set(requireBeat(params, "loopLength", false));
            touched = true;
        }
        if (params.has("color")) {
            var color = params.getAsJsonArray("color");
            if (color.size() != 3) {
                throw new IllegalArgumentException("color must contain red, green, and blue");
            }
            float red = requireColor(color.get(0).getAsDouble(), "red");
            float green = requireColor(color.get(1).getAsDouble(), "green");
            float blue = requireColor(color.get(2).getAsDouble(), "blue");
            clip.color().set(red, green, blue);
            touched = true;
        }
        if (!touched) {
            throw new IllegalArgumentException("set at least one clip metadata field");
        }
        return ok();
    }

    /**
     * 8i0 (D42): write only the named fields. The brain adds the marker
     * dependencies: a loop-start write also writes the length and restores the
     * play start (E43). Loop end has no setter. Colour is any byte triple.
     */
    private JsonElement setOwnedClipMetadata(Clip clip, JsonObject params) {
        var fields = new java.util.HashSet<String>();
        for (JsonElement field : params.getAsJsonArray("fields")) {
            fields.add(field.getAsString());
        }
        if (fields.isEmpty()) {
            throw new IllegalArgumentException("fields must name at least one clip metadata field");
        }
        for (String field : fields) {
            if (!java.util.List.of("lengthBeats", "loopStartBeats", "playStartBeats", "loopEnabled", "name", "color")
                    .contains(field)) {
                throw new IllegalArgumentException("unknown clip metadata field " + field);
            }
        }
        // Validate every value before the first setter.
        double length = fields.contains("lengthBeats") ? requireBeat(params, "lengthBeats", false) : 0;
        double loopStart = fields.contains("loopStartBeats") ? requireBeat(params, "loopStartBeats", true) : 0;
        double playStart = fields.contains("playStartBeats") ? requireBeat(params, "playStartBeats", true) : 0;
        int[] color = null;
        if (fields.contains("color")) {
            var bytes = params.getAsJsonArray("color");
            if (bytes.size() != 3) {
                throw new IllegalArgumentException("color must contain red, green, and blue bytes");
            }
            color = new int[] {
                requireColorByte(bytes.get(0).getAsInt(), "red"),
                requireColorByte(bytes.get(1).getAsInt(), "green"),
                requireColorByte(bytes.get(2).getAsInt(), "blue"),
            };
        }
        if (fields.contains("lengthBeats")) clip.getLoopLength().set(length);
        if (fields.contains("loopStartBeats")) clip.getLoopStart().set(loopStart);
        if (fields.contains("playStartBeats")) clip.getPlayStart().set(playStart);
        if (fields.contains("loopEnabled")) clip.isLoopEnabled().set(params.get("loopEnabled").getAsBoolean());
        if (fields.contains("name")) clip.setName(params.get("name").getAsString());
        if (color != null) {
            int trackIndex = params.get("trackIndex").getAsInt();
            int slotIndex = params.get("slotIndex").getAsInt();
            rig.trackBank.getItemAt(trackIndex).clipLauncherSlotBank().getItemAt(slotIndex)
                .color().set(colorByteCenter(color[0]), colorByteCenter(color[1]), colorByteCenter(color[2]));
        }
        return ok();
    }

    /** Probe-only route for the Clip.duplicateContent() candidate. */
    private JsonElement cursorDuplicateContent(JsonObject params) {
        Clip clip = rig.clip(params.get("cursor").getAsString());
        clip.duplicateContent();
        return ok();
    }

    private static double requireBeat(JsonObject params, String name, boolean allowZero) {
        double value = params.get(name).getAsDouble();
        if (!Double.isFinite(value) || value < 0 || (!allowZero && value == 0)) {
            throw new IllegalArgumentException(
                name + " must be " + (allowZero ? "a non-negative" : "a positive")
                + " finite beat value");
        }
        return value;
    }

    private static float requireColor(double value, String name) {
        if (!Double.isFinite(value) || value < 0 || value > 1) {
            throw new IllegalArgumentException(name + " must be between 0 and 1");
        }
        return (float)value;
    }

    private static int requireColorByte(int value, String name) {
        if (value < 0 || value > 255) {
            throw new IllegalArgumentException(name + " must be between 0 and 255");
        }
        return value;
    }

    private static float colorByteCenter(int value) {
        return value == 255 ? 1f : (value + 0.5f) / 255f;
    }

    private JsonElement cursorPin(JsonObject params) {
        requirePoolClip(params).isPinned().set(params.get("pinned").getAsBoolean());
        return ok();
    }

    /** D43: an owned cursor track stays pinned, so only {@code pinned: true} is accepted. */
    private JsonElement cursorPinTrack(JsonObject params) {
        String ref = params.get("cursor").getAsString();
        if (!params.get("pinned").getAsBoolean()) {
            throw new IllegalArgumentException("cursor track " + ref + " stays pinned (D43): an unpinned cursor can "
                + "follow and drive the selection; a pinned cursor track still moves when it is pointed");
        }
        rig.cursorTrack(ref).isPinned().set(true);
        return ok();
    }

    private JsonElement cursorPointTrack(JsonObject params) {
        String ref = params.get("cursor").getAsString();
        int trackIndex = params.get("trackIndex").getAsInt();
        Track target = requireTrack(trackIndex);
        if (params.has("selectionOwnerToken")) {
            rig.claimSelectionOwnership(
                params.get("selectionOwnerToken").getAsString(), trackIndex, -1);
        } else {
            rig.clearSelectionOwnership();
        }
        CursorTrack cursor = rig.cursorTrack(ref);
        // D43: a pinned cursor track moves and leaves the selection. The set sends nothing when it is pinned.
        cursor.isPinned().set(true);
        cursor.selectChannel(target);
        return ok();
    }

    /** CursorClip.selectClip: point pool cursor at whatever `from` points at. */
    private JsonElement cursorPointToClipOf(JsonObject params) {
        PinnableCursorClip cursor = requirePoolClip(params);
        Clip from = rig.clip(params.get("from").getAsString());
        cursor.selectClip(from);
        return ok();
    }

    /**
     * Per-field try/catch: on unmarked values this reports the error string
     * instead of failing the whole request — deliberate, to document which
     * reads require markInterested (E2 observer-gotcha probe).
     */
    private JsonElement cursorStatus(JsonObject params) {
        String ref = params.get("cursor").getAsString();
        Clip clip = rig.clip(ref);
        JsonObject result = new JsonObject();
        putGuarded(result, "exists", () -> clip.exists().get());
        putGuarded(result, "loopLength", () -> clip.getLoopLength().get());
        putGuarded(result, "trackExists", () -> clip.getTrack().exists().get());
        putGuarded(result, "trackName", () -> clip.getTrack().name().get());
        putGuarded(result, "trackPosition", () -> clip.getTrack().position().get());
        // 8h4a4: the position counts sibling tracks only, not the flat bank
        // index. Confirm a target by this identity.
        putGuarded(result, "trackChannelId", () -> clip.getTrack().channelId().get());
        putGuarded(result, "slotExists", () -> clip.clipLauncherSlot().exists().get());
        putGuarded(result, "sceneIndex", () -> clip.clipLauncherSlot().sceneIndex().get());
        putGuarded(result, "slotName", () -> clip.clipLauncherSlot().name().get());
        if (clip instanceof PinnableCursorClip pinnable) {
            putGuarded(result, "isPinned", () -> pinnable.isPinned().get());
            putGuarded(result, "cursorTrackPosition", () -> rig.cursorTrack(ref).position().get());
            putGuarded(result, "cursorTrackPinned", () -> rig.cursorTrack(ref).isPinned().get());
        }
        return result;
    }

    /**
     * ⚠⚠ E20a — WHERE INSIDE THE CLIP playback is, through a pool cursor.
     *
     * This is the measurement `"continue_or_synced"` lives or dies by: take B is
     * claimed to pick up at take A's position rather than restarting
     * (E18-VERDICT §4a″-bis), and `playingStep()` is the only handle in the API
     * that can say so. `-1` means nothing is playing, so "silent" and "playing at
     * step 0" stay distinguishable — which matters, because the control arm's whole
     * assertion is that `"from_start"` DOES report step 0.
     *
     * ⚠ **A separate method rather than three more fields on `cursor.status`, and
     * that is deliberate.** `contract.hello`'s `methodsHash` is over method NAMES,
     * so a new field on an existing reply passes a stale-extension handshake
     * unnoticed — the exact gap that cost a sitting and produced `deploy.ts`. A new
     * NAME moves the hash, so a jar Bitwig never loaded is caught at connect rather
     * than by a probe check failing for what looks like a Bitwig reason.
     *
     * ⚠ `sampledAtMs` and `playPosition` are read here, beside the step, so a
     * caller can place the reading on the timeline without a second round trip
     * inserting itself between the two halves of one observation.
     */
    private JsonElement cursorPlayState(JsonObject params) {
        String ref = params.get("cursor").getAsString();
        Clip clip = rig.clip(ref);
        JsonObject result = new JsonObject();
        result.addProperty("sampledAtMs", System.currentTimeMillis());
        putGuarded(result, "playingStep", () -> clip.playingStep().get());
        putGuarded(result, "exists", () -> clip.exists().get());
        putGuarded(result, "loopLength", () -> clip.getLoopLength().get());
        putGuarded(result, "sceneIndex", () -> clip.clipLauncherSlot().sceneIndex().get());
        putGuarded(result, "trackPosition", () -> clip.getTrack().position().get());
        putGuarded(result, "trackChannelId", () -> clip.getTrack().channelId().get());
        putGuarded(result, "playPosition", () -> rig.transport.playPosition().get());
        putGuarded(result, "isPlaying", () -> rig.transport.isPlaying().get());
        return result;
    }

    // -------------------------------- Phase 1 session 3e: per-clip launching

    /**
     * Read the three per-clip settings that decide how the HUMAN'S own launcher
     * click behaves.
     *
     * ⚠ A new method name, not fields on {@link #cursorStatus}: the contract
     * handshake hashes method names. Session 3 proved that extending an existing
     * reply lets a stale jar pass the handshake, so every new capability starts
     * with a new name even when an older reply would be a tempting home for it.
     */
    private JsonElement cursorLaunchSettings(JsonObject params) {
        Clip clip = rig.clip(params.get("cursor").getAsString());
        JsonObject result = new JsonObject();
        putGuarded(result, "exists", () -> clip.exists().get());
        putGuarded(result, "sceneIndex", () -> clip.clipLauncherSlot().sceneIndex().get());
        // 8h4a5: the `clip.read` launch block holds the same values (ClipLaunch).
        ClipLaunch.read(clip).entrySet().forEach(e -> result.add(e.getKey(), e.getValue()));
        return result;
    }

    /**
     * Set one or more per-clip launch settings through a pointed cursor.
     *
     * The enum strings are validated BEFORE Bitwig sees them. The API accepts
     * free strings and E14-A1 established that an asynchronous host rejection can
     * escape the request's try/catch and take down the DAW. A partial object is
     * deliberate: the arm needs to vary one setting while holding the other two
     * constant, and a caller must not read-then-rewrite values it did not mean to
     * touch.
     */
    private JsonElement cursorSetLaunchSettings(JsonObject params) {
        Clip clip = rig.clip(params.get("cursor").getAsString());
        boolean touched = false;

        if (params.has("launchQuantization")) {
            String value = params.get("launchQuantization").getAsString();
            requireOneOf("launchQuantization", value, LAUNCH_QUANTIZATIONS);
            clip.launchQuantization().set(value);
            touched = true;
        }
        if (params.has("launchMode")) {
            String value = params.get("launchMode").getAsString();
            requireOneOf("launchMode", value, LAUNCH_MODES);
            clip.launchMode().set(value);
            touched = true;
        }
        if (params.has("useLoopStartAsQuantizationReference")) {
            clip.useLoopStartAsQuantizationReference().set(
                params.get("useLoopStartAsQuantizationReference").getAsBoolean());
            touched = true;
        }
        if (!touched) {
            throw new IllegalArgumentException(
                "set at least one of launchQuantization, launchMode, or "
                + "useLoopStartAsQuantizationReference");
        }
        return ok();
    }

    /** Legal values verbatim from the API 16 Clip javadoc. */
    private static final String[] LAUNCH_QUANTIZATIONS = {
        "default", "none", "8", "4", "2", "1", "1/2", "1/4", "1/8", "1/16",
    };
    private static final String[] LAUNCH_MODES = {
        "default", "from_start", "continue_or_from_start", "continue_or_synced", "synced",
    };

    /** Refuse a free-string parameter Bitwig might reject asynchronously. */
    private static void requireOneOf(String name, String value, String[] legal) {
        for (String candidate : legal) {
            if (candidate.equals(value)) {
                return;
            }
        }
        throw new IllegalArgumentException(
            name + " \"" + value + "\" is not one of " + java.util.Arrays.toString(legal)
            + " — refusing rather than letting Bitwig reject it asynchronously (E14-A1)");
    }

    // --------------------------------- E16 §3.4g: createEqualsValue as a guard

    /**
     * Read the pre-allocated equals matrix (see `Rig.buildEqualsProbes`).
     *
     * ⚠ Returns only pairs that read TRUE by default, plus the total, because the
     * matrix is 65 entries and 60-odd `false`s are noise that hides the answer.
     * `all: true` dumps everything for the run that needs to prove a pair went
     * false rather than merely stopped being mentioned — the distinction E16r's
     * bank-window row turned on, where "not in the list" and "reported absent"
     * are different claims.
     *
     * ⚠ Every read goes through `putGuarded`, so a value that was created but not
     * successfully marked reports its own error rather than failing the request.
     * That matters here more than usual: `Rig.equalsStatus` says whether the BUILD
     * survived, and these say whether the READ does, and rule 13 could bite at
     * either point.
     */
    private JsonElement equalsStatus(JsonObject params) {
        boolean all = params.has("all") && params.get("all").getAsBoolean();
        JsonObject pairs = new JsonObject();
        int trues = 0;
        for (var entry : rig.equalsProbes.entrySet()) {
            Boolean value = null;
            try {
                value = entry.getValue().get();
            } catch (Exception e) {
                pairs.addProperty(entry.getKey(), "ERR:" + e.getMessage());
                continue;
            }
            if (Boolean.TRUE.equals(value)) {
                trues++;
            }
            if (all || Boolean.TRUE.equals(value)) {
                pairs.addProperty(entry.getKey(), value);
            }
        }
        JsonObject result = new JsonObject();
        result.addProperty("buildStatus", rig.equalsStatus);
        result.addProperty("pairCount", rig.equalsProbes.size());
        result.addProperty("trueCount", trues);
        result.add("pairs", pairs);
        return result;
    }

    /**
     * ⚠ Ask standing rule 13's question DIRECTLY: does `createEqualsValue` throw
     * when called outside `init()`?
     *
     * Rule 13 predicts it does — it is a `create*`, and four unrelated subsystems
     * enforce init-only allocation with the same sentence. But the rule is stated
     * as a DEFAULT to assume, not a law that has been checked on this method, and
     * the difference decides whether the guard can ever be built on demand for an
     * arbitrary pair or must always come out of a fixed pre-allocated matrix. The
     * matrix is the expensive answer: it bounds the guard to pairs we predicted.
     *
     * ⚠ Deliberately does NOT `markInterested` the result. Creating and marking
     * are separate hazards and this asks about creating; marking an object whose
     * legality is exactly what is in question would confound the two, and the
     * read below reporting an observer-gotcha error is itself informative.
     *
     * Safe to run: E14-C2 and E14-I5 both provoked this same init-only refusal at
     * request time and both were contained. The one that was NOT contained was
     * `Signal.fire()`, where Bitwig raised on its own thread — a different shape,
     * and the reason `ui.signalFire` is FORBIDDEN rather than merely banned.
     */
    private JsonElement equalsTryCreate() {
        JsonObject result = ok();
        try {
            var fresh = rig.cursorTracks[0].createEqualsValue(rig.trackBank.getItemAt(0));
            result.addProperty("created", true);
            putGuarded(result, "readsAs", () -> fresh.get());
        } catch (Throwable t) {
            result.addProperty("created", false);
            result.addProperty("threw", t.getClass().getSimpleName());
            result.addProperty("message", String.valueOf(t.getMessage()));
        }
        return result;
    }

    // ------------------------------------------- E1: UI selection tracking

    private JsonElement selectionStatus() {
        rig.refreshStaleSlotSelection();
        JsonObject result = new JsonObject();
        result.addProperty("trackIndex", rig.selectedTrackIndex);
        result.addProperty("slotIndex", rig.selectedSlotIndex);
        result.addProperty("mixerTrackIndex", rig.selectedMixerTrackIndex);
        result.addProperty("changes", rig.selectionChanges);
        result.addProperty("revision", rig.selectionRevision);
        // 8h4a: the project in which each value was observed, and the current project. A value from
        // another project is not a selection here (E233).
        result.addProperty("slotProject", rig.slotSelectionProject);
        result.addProperty("mixerProject", rig.mixerSelectionProject);
        result.addProperty("project", rig.currentProjectName());
        return result;
    }
}
