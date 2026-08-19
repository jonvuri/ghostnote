package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.ClipLauncherSlot;
import com.bitwig.extension.controller.api.ClipLauncherSlotBank;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.RemoteControl;
import com.bitwig.extension.controller.api.Track;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Tracks, clips and launcher slots (E1, E2c, E2f).
 *
 * `track.resolveByChannelId` is the stable-addressing primitive: channelId is
 * the ONE durable track key (E2f — survives index shift, rename, and a full
 * save/restart cycle), so callers address by UUID and re-resolve to an index.
 *
 * Split out of ProbeHandlers.java in Phase 0; the method bodies are unchanged.
 */
public final class TrackHandlers extends HandlerGroup {
    public TrackHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("track.create", params -> trackCreate(params));
        r.on("track.setName", params -> trackSetName(params));
        r.on("track.list", params -> trackList());
        r.on("track.delete", params -> trackDelete(params));
        r.on("track.deleteViaAction", params -> trackDeleteViaAction(params));
        r.on("track.resolveByChannelId", params -> trackResolveByChannelId(params));
        r.on("clip.create", params -> clipCreate(params));
        r.on("slot.status", params -> slotStatus(params));
        r.on("slot.select", params -> slotSelect(params));
        r.on("slot.delete", params -> slotDelete(params));
        r.on("slot.launch", params -> slotLaunch(params));
        r.on("slot.launchWithOptions", params -> slotLaunchWithOptions(params));
        r.on("slot.duplicateClip", params -> slotDuplicateClip(params));
        r.on("slot.duplicateObject", params -> slotDuplicateObject(params));
        r.on("slot.playState", params -> slotPlayState(params));
        r.on("slot.moveTo", params -> slotMoveTo(params));
        r.on("slot.epoch", params -> slotEpoch());
    }

    /** Probe-only route for DuplicableObject.duplicateObject(). */
    private JsonElement slotDuplicateObject(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        int slotIndex = params.get("slotIndex").getAsInt();
        if (slotIndex < 0 || slotIndex >= rig.config.scenes) {
            throw new IllegalArgumentException(
                "slotIndex outside the scene bank window: " + slotIndex
                + " (window " + rig.config.scenes + ")");
        }
        track.clipLauncherSlotBank().getItemAt(slotIndex).duplicateObject();
        return ok();
    }

    /**
     * ⚠ Legal values, VERBATIM from the API 16 javadoc for
     * `ClipLauncherSlotOrScene.launchWithOptions(String, String)`.
     *
     * Copied rather than derived because there is nothing to derive them from: the
     * API takes free strings and documents the accepted set in prose. They are the
     * whole reason {@link #slotLaunchWithOptions} validates before it calls — see
     * the note there.
     */
    private static final String[] LAUNCH_QUANTIZATIONS = {
        "default", "none", "8", "4", "2", "1", "1/2", "1/4", "1/8", "1/16",
    };
    private static final String[] LAUNCH_MODES = {
        "default", "from_start", "continue_or_from_start", "continue_or_synced", "synced",
    };

    private JsonElement trackCreate(JsonObject params) {
        int position = params.get("position").getAsInt();
        rig.application.createInstrumentTrack(position);
        return ok();
    }

    private JsonElement trackSetName(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        track.setName(params.get("name").getAsString());
        return ok();
    }

    private JsonElement trackList() {
        JsonArray tracks = new JsonArray();
        for (int i = 0; i < rig.config.tracks; i++) {
            Track track = rig.trackBank.getItemAt(i);
            if (!track.exists().get()) {
                continue;
            }
            JsonObject obj = new JsonObject();
            obj.addProperty("index", i);
            obj.addProperty("name", track.name().get());
            obj.addProperty("position", track.position().get());
            obj.addProperty("type", track.trackType().get());
            obj.addProperty("channelId", track.channelId().get());
            tracks.add(obj);
        }
        JsonObject result = new JsonObject();
        result.add("tracks", tracks);
        result.addProperty("count", tracks.size());
        // Bank-window overflow (E5, standing rule 5): `count` is what we can SEE.
        // `itemCount` is what the project claims to hold and `bankSize` is the
        // window — when itemCount > bankSize the caller is half-blind and must
        // refuse to operate rather than silently snapshot a partial project.
        result.addProperty("itemCount", rig.trackBank.itemCount().get());
        result.addProperty("bankSize", rig.config.tracks);
        return result;
    }

    /**
     * ⚠⚠ E17 row 4 — THE VERB CONTROL for `layer.deleteViaAction`, and it only
     * works as a control because of the type hierarchy.
     *
     *     Channel extends DeviceChain, DeleteableObject, DuplicableObject
     *        ↑                              ↑
     *     Track                        DeviceLayer   (an EMPTY interface body:
     *     + isGroup, position, …        `interface DeviceLayer extends Channel {}`)
     *
     * `Track` and `DeviceLayer` are **siblings**, both plain `Channel`s, and both
     * inherit `deleteObjectAction()` from the same place. So this is the identical
     * call on the identical inherited method, differing only in the receiver — the
     * strongest control shape available, and the one that made `e17f`'s ○ worth
     * something (`Device.deleteObject()` ● beside `DeviceLayer.deleteObject()` ○).
     *
     *   this ● and the layer ○  ⇒ the route works; DeviceLayer specifically declines
     *   both ○                  ⇒ the `*Action()` form is dead everywhere, and the
     *                             layer result measures nothing about layers
     *
     * ⚠ Without it, a ○ on the layer side is uninterpretable — exactly the mistake
     * that let a dozen E17 negatives stand for most of the spike.
     *
     * ⚠ This DELETES A TRACK. It is probe surface only, banned from the contract
     * like every other destructive route (standing rule 6 / E6 blocker 3).
     */
    private JsonElement trackDeleteViaAction(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        JsonObject r = ok();
        putGuarded(r, "name", () -> track.name().get());
        putGuarded(r, "channelId", () -> track.channelId().get());
        // ⚠ Rule 13 again: init-time handle, indexed by bank slot.
        int ti = params.get("trackIndex").getAsInt();
        r.addProperty("handleStatus", rig.trackDeleteActionStatus);
        try {
            if (rig.trackDeleteAction == null || ti >= rig.trackDeleteAction.length
                || rig.trackDeleteAction[ti] == null) {
                r.addProperty("actionInvoke", "NO HANDLE: " + rig.trackDeleteActionStatus);
                return r;
            }
            rig.trackDeleteAction[ti].invoke();
            r.addProperty("actionInvoke", "returned");
        } catch (Throwable t) {
            r.addProperty("actionInvoke",
                "THREW:" + t.getClass().getSimpleName() + ":" + t.getMessage());
        }
        return r;
    }

    private JsonElement trackDelete(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        track.deleteObject();
        return ok();
    }

    /**
     * Re-resolve a track to its current bank index by stable channel UUID.
     * This is the candidate stable-addressing primitive: address by UUID,
     * scan the bank to find the current index/name.
     */
    private JsonElement trackResolveByChannelId(JsonObject params) {
        String wanted = params.get("channelId").getAsString();
        JsonObject result = new JsonObject();
        for (int i = 0; i < rig.config.tracks; i++) {
            Track track = rig.trackBank.getItemAt(i);
            if (track.exists().get() && wanted.equals(track.channelId().get())) {
                result.addProperty("found", true);
                result.addProperty("index", i);
                result.addProperty("name", track.name().get());
                result.addProperty("position", track.position().get());
                result.addProperty("type", track.trackType().get());
                return result;
            }
        }
        result.addProperty("found", false);
        return result;
    }

    private JsonElement clipCreate(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        int slotIndex = params.get("slotIndex").getAsInt();
        int lengthBeats = params.has("lengthBeats") ? params.get("lengthBeats").getAsInt() : 4;
        track.createNewLauncherClip(slotIndex, lengthBeats);
        return ok();
    }

    private JsonElement slotStatus(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        int slotIndex = params.get("slotIndex").getAsInt();
        ClipLauncherSlot slot = track.clipLauncherSlotBank().getItemAt(slotIndex);
        JsonObject result = new JsonObject();
        result.addProperty("exists", slot.exists().get());
        result.addProperty("hasContent", slot.hasContent().get());
        result.addProperty("isSelected", slot.isSelected().get());
        return result;
    }

    /**
     * Point the *UI selection* at a slot. Mechanisms:
     *  - "slot":  ClipLauncherSlot.select()
     *  - "track": Track.selectSlot(slotIndex)
     */
    private JsonElement slotSelect(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        int slotIndex = params.get("slotIndex").getAsInt();
        String mechanism = params.has("mechanism") ? params.get("mechanism").getAsString() : "slot";

        switch (mechanism) {
            case "slot":
                track.clipLauncherSlotBank().getItemAt(slotIndex).select();
                break;
            case "track":
                track.selectSlot(slotIndex);
                break;
            default:
                throw new IllegalArgumentException("unknown mechanism: " + mechanism);
        }
        return ok();
    }

    /**
     * ⚠ E16 §3.4f — MOVE a launcher clip, so the detectability question has an
     * event to detect.
     *
     * ⚠ **`ClipLauncherSlotOrScene.moveTo(dest)` is `@Deprecated`** — *"Use
     * `replaceInsertionPoint()` instead"*, since API 4 — and standing rule 9 is
     * about exactly this: a deprecated handle is not merely untidy, E7's
     * `getModulationSource(int)` threw and took the whole extension down. So the
     * DEFAULT route here is the modern one, and the deprecated call is reachable
     * only by asking for it by name.
     *
     * The modern route lands on `InsertionPoint.moveSlotsOrScenes(…)` — the same
     * 14-member interface whose sibling verb `moveDevices` overturned E4d last
     * session, which is a pleasing symmetry and also a warning: the verbs on this
     * interface demonstrably disagree with each other, so a ○ from one says
     * nothing about the others.
     *
     * ⚠ **The API move is the CONTROL here, not the experiment.** The threat model
     * is a HUMAN dragging a clip between scenes — that is the scenario E16l raised
     * and the one §1's tolerant fallback exists for — and a human drag needs no
     * wire method at all. This exists so the same question can be asked a second
     * way, silently and repeatably, and so a difference between the two (if any)
     * is visible rather than assumed. If the human drag and this disagree about
     * what fires, THAT is the finding.
     *
     * Verified by `slot.epoch` and by `slot.status` on both ends, never by this
     * return: the acknowledgement is identical whether or not anything moved
     * (E6 blocker 4).
     */
    private JsonElement slotMoveTo(JsonObject params) {
        Track from = requireTrack(params.get("trackIndex").getAsInt());
        Track to = requireTrack(params.get("toTrackIndex").getAsInt());
        int slotIndex = params.get("slotIndex").getAsInt();
        int toSlotIndex = params.get("toSlotIndex").getAsInt();
        String route = params.has("route") ? params.get("route").getAsString() : "insertionPoint";
        if (!"insertionPoint".equals(route) && !"deprecatedMoveTo".equals(route)) {
            throw new IllegalArgumentException(
                "route must be insertionPoint or deprecatedMoveTo: " + route);
        }
        if (from == to && slotIndex == toSlotIndex) {
            throw new IllegalArgumentException(
                "source and destination are the same slot, so the move is a no-op by "
                + "construction and would be indistinguishable from a failure");
        }

        ClipLauncherSlot source = from.clipLauncherSlotBank().getItemAt(slotIndex);
        ClipLauncherSlot dest = to.clipLauncherSlotBank().getItemAt(toSlotIndex);

        JsonObject result = ok();
        result.addProperty("route", route);
        // ⚠ Read both ends BEFORE the move. Afterwards these handles describe
        // whatever now occupies those positions, which is the whole point.
        putGuarded(result, "sourceHadContent", () -> source.hasContent().get());
        putGuarded(result, "destHadContent", () -> dest.hasContent().get());
        result.addProperty("epochBefore", rig.launcherContentEpoch);

        if ("insertionPoint".equals(route)) {
            dest.replaceInsertionPoint().moveSlotsOrScenes(source);
        } else {
            source.moveTo(dest);
        }
        return result;
    }

    /**
     * ⚠ E16 §3.4f — the detector: how many launcher-content callbacks have fired,
     * and what the last {@link Rig#CONTENT_LOG} of them said.
     *
     * The epoch is meaningless in absolute terms — Bitwig delivers initial values
     * through the same callbacks, so it starts nonzero — and every caller must
     * baseline it before the event and diff after. What carries the finding is
     * the LOG: a move should read as a pair, one slot emptying and another
     * filling. A create is one fill; a delete is one empty. If the pair appears,
     * moved clips are detectable without polling and without suspicion, and
     * §3.2.3's extension-side observer should watch content and not merely scene
     * count. If nothing fires, §1's fingerprint-then-recreate fallback carries the
     * whole weight, and that is worth knowing before the engine leans on it.
     *
     * `sceneCountChanges` rides along because §3.2.3 predicted its own blind spot
     * — a move changes no count — and a prediction next to its measurement is
     * cheaper than a prediction alone.
     */
    private JsonElement slotEpoch() {
        JsonObject result = new JsonObject();
        result.addProperty("epoch", rig.launcherContentEpoch);
        result.addProperty("sceneCountChanges", rig.sceneCountChanges);
        result.addProperty("sceneCount", rig.lastSceneCount);
        result.addProperty("selectionChanges", rig.selectionChanges);
        JsonArray log = new JsonArray();
        // Oldest-first out of the ring, so the reader sees the order events
        // happened rather than the order they happen to sit in the array.
        int size = Math.min(rig.launcherContentEpoch, Rig.CONTENT_LOG);
        for (int k = 0; k < size; k++) {
            int idx = (rig.launcherContentEpoch - size + k) % Rig.CONTENT_LOG;
            Rig.ContentEvent event = rig.contentLog[idx];
            log.add(event == null ? null : event.legacy());
        }
        result.add("log", log);
        return result;
    }

    private JsonElement slotDelete(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        int slotIndex = params.get("slotIndex").getAsInt();
        track.clipLauncherSlotBank().getItemAt(slotIndex).deleteObject();
        return ok();
    }

    /**
     * Touch/release a param handle — the controller-side "finger on the
     * control" signal. E7 routing sweep: with a RemoteControl in mapping mode,
     * does a programmatic touch complete the mapping (the UI idiom is
     * enter-mapping-then-touch-a-param)?
     */
    /** Launch a launcher clip (starts transport). E7e: per-voice modulators
     * only produce output while notes sound. */
    private JsonElement slotLaunch(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        track.clipLauncherSlotBank().getItemAt(params.get("slotIndex").getAsInt()).launch();
        return ok();
    }

    /**
     * ⚠⚠ E20a — launch with a PER-CALL quantisation and launch mode (API 16).
     *
     * The clip block's entire ergonomic claim runs through this call and none of it
     * had ever been run: `"1"`/`"8"` forces a take switch onto the bar or the
     * 8-bar phrase regardless of the project's own launch quantisation, and
     * ⚠⚠ `"continue_or_synced"` makes the incoming take pick up at the outgoing
     * one's position instead of restarting the loop — the same bar rendered
     * differently, which E16m asked for and no mute, solo or chain switch can
     * imitate (E18-VERDICT §4a″-bis, §4c).
     *
     * ⚠⚠ **BOTH STRINGS ARE VALIDATED BEFORE THE CALL, AND THIS IS NOT TIDINESS.**
     * Standing rule 3c exists because of E14-A1: `Signal.fire()` returned normally
     * and Bitwig threw the refusal LATER, on its own thread, inside a runnable
     * deferred from our call — where no handler try/catch reaches it — and took the
     * DAW down with an unsaved project open. The API takes these as free strings
     * and documents the accepted set in prose, so an unrecognised value is exactly
     * the shape of input that gets rejected somewhere we cannot catch. `uiSet`
     * already refuses out-of-range enum values on the same reasoning; this is that
     * precedent applied one subsystem over.
     *
     * ⚠ The reply reports the state BEFORE the call and never claims the launch
     * happened: a quantised launch has not happened yet when this returns — that is
     * the point of it — so an ack that claimed success would be false by
     * construction (E6 blocker 4). `slot.playState` is where the verdict comes
     * from, polled.
     */
    private JsonElement slotLaunchWithOptions(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        int slotIndex = params.get("slotIndex").getAsInt();
        String quantization = params.get("quantization").getAsString();
        String launchMode = params.get("launchMode").getAsString();
        requireOneOf("quantization", quantization, LAUNCH_QUANTIZATIONS);
        requireOneOf("launchMode", launchMode, LAUNCH_MODES);

        ClipLauncherSlot slot = track.clipLauncherSlotBank().getItemAt(slotIndex);
        JsonObject result = ok();
        result.addProperty("quantization", quantization);
        result.addProperty("launchMode", launchMode);
        result.addProperty("epochBefore", rig.launcherContentEpoch);
        result.addProperty("requestedAtMs", System.currentTimeMillis());
        putGuarded(result, "hadContent", () -> slot.hasContent().get());
        putGuarded(result, "wasPlaying", () -> slot.isPlaying().get());
        slot.launchWithOptions(quantization, launchMode);
        return result;
    }

    /**
     * ⚠⚠ E20b — `duplicateClip`, the primitive that mints the next take.
     *
     * The API sweep found it (E18-VERDICT §4b) and nothing had run it. Its javadoc
     * is three words — *"Duplicates the clip."* — and says nothing about WHERE the
     * copy lands, which is the only part the clip-block geometry depends on: an
     * APPEND leaves every existing address intact, an INSERT shifts every row below
     * it and invalidates them all, the way `Scene.deleteObject()`'s compaction does
     * (E3). The append-only discipline E18-VERDICT §4b proposes is built on an
     * assumption about a call nobody had made.
     *
     * ⚠ TWO ROUTES, per standing rule 10: `ClipLauncherSlot.duplicateClip()` (API
     * 10) and `ClipLauncherSlotBank.duplicateClip(int)` (API 1). They are different
     * methods on different types and a ○ from one says nothing about the other —
     * the same lesson `slot.moveTo`'s two routes are here to remember.
     *
     * ⚠ The whole COLUMN is read before the call and returned. Where the copy
     * landed is not something the return value of a void method can tell us, and a
     * caller that only checked the row it expected would read an insert as a
     * success. The probe diffs the column.
     */
    private JsonElement slotDuplicateClip(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        int slotIndex = params.get("slotIndex").getAsInt();
        String route = params.has("route") ? params.get("route").getAsString() : "slot";
        if (!"slot".equals(route) && !"bank".equals(route)) {
            throw new IllegalArgumentException("route must be slot or bank: " + route);
        }
        if (slotIndex < 0 || slotIndex >= rig.config.scenes) {
            throw new IllegalArgumentException(
                "slotIndex outside the scene bank window: " + slotIndex + " (window " + rig.config.scenes + ")");
        }

        ClipLauncherSlotBank slots = track.clipLauncherSlotBank();
        JsonObject result = ok();
        result.addProperty("route", route);
        result.addProperty("epochBefore", rig.launcherContentEpoch);
        JsonArray before = new JsonArray();
        for (int j = 0; j < rig.config.scenes; j++) {
            final int row = j;
            JsonObject cell = new JsonObject();
            cell.addProperty("slotIndex", row);
            putGuarded(cell, "hasContent", () -> slots.getItemAt(row).hasContent().get());
            before.add(cell);
        }
        result.add("columnBefore", before);

        if ("slot".equals(route)) {
            slots.getItemAt(slotIndex).duplicateClip();
        } else {
            slots.duplicateClip(slotIndex);
        }
        return result;
    }

    /**
     * ⚠ E20a — is the slot playing, queued to play, or queued to stop?
     *
     * `isPlaybackQueued()` is the one worth the wire method. A quantised launch
     * spends the rest of the bar in exactly that state, so it is what distinguishes
     * *"the switch was scheduled and is waiting for the boundary"* from *"the call
     * did nothing"* — two outcomes that look identical if all you can see is
     * `isPlaying`.
     *
     * `sampledAtMs` is stamped INSIDE the extension, on the control-surface thread,
     * rather than by the caller when the reply arrives: the probe times a transition
     * against a bar boundary, and a bridge round trip sitting between the read and
     * the timestamp would be charged to Bitwig.
     */
    private JsonElement slotPlayState(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        int slotIndex = params.get("slotIndex").getAsInt();
        ClipLauncherSlot slot = track.clipLauncherSlotBank().getItemAt(slotIndex);
        JsonObject result = new JsonObject();
        result.addProperty("sampledAtMs", System.currentTimeMillis());
        putGuarded(result, "hasContent", () -> slot.hasContent().get());
        putGuarded(result, "isPlaying", () -> slot.isPlaying().get());
        putGuarded(result, "isPlaybackQueued", () -> slot.isPlaybackQueued().get());
        putGuarded(result, "isStopQueued", () -> slot.isStopQueued().get());
        putGuarded(result, "playPosition", () -> rig.transport.playPosition().get());
        return result;
    }

    /** Refuse a free-string parameter Bitwig might reject asynchronously (rule 3c). */
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
}
