package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.Clip;
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
        r.on("selection.status", params -> selectionStatus());
        r.on("equals.status", params -> equalsStatus(params));
        r.on("equals.tryCreate", params -> equalsTryCreate());
    }

    private JsonElement cursorPin(JsonObject params) {
        requirePoolClip(params).isPinned().set(params.get("pinned").getAsBoolean());
        return ok();
    }

    private JsonElement cursorPinTrack(JsonObject params) {
        int i = params.get("cursor").getAsInt();
        rig.cursorTracks[i].isPinned().set(params.get("pinned").getAsBoolean());
        return ok();
    }

    private JsonElement cursorPointTrack(JsonObject params) {
        String ref = params.get("cursor").getAsString();
        Track target = requireTrack(params.get("trackIndex").getAsInt());
        rig.cursorTrack(ref).selectChannel(target);
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
        putGuarded(result, "launchQuantization", () -> clip.launchQuantization().get());
        putGuarded(result, "launchMode", () -> clip.launchMode().get());
        putGuarded(result, "useLoopStartAsQuantizationReference",
            () -> clip.useLoopStartAsQuantizationReference().get());
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
        JsonObject result = new JsonObject();
        result.addProperty("trackIndex", rig.selectedTrackIndex);
        result.addProperty("slotIndex", rig.selectedSlotIndex);
        result.addProperty("mixerTrackIndex", rig.selectedMixerTrackIndex);
        result.addProperty("changes", rig.selectionChanges);
        return result;
    }
}
