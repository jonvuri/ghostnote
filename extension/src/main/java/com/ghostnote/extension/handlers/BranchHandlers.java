package com.ghostnote.extension.handlers;

import com.ghostnote.extension.Rig;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.DuplicableObject;
import com.bitwig.extension.controller.api.Send;
import com.bitwig.extension.controller.api.Track;
import com.bitwig.extension.controller.api.TrackBankContentFilter;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.util.HashSet;
import java.util.Set;

/**
 * E16 — branches as duplicated tracks.
 *
 * The whole idea in `spike/SPIKE-E16-BRANCHES-AS-TRACKS.md` rests on one call
 * nobody has probed: can a TOP-LEVEL track be duplicated, and does the copy
 * carry state? Row A is the gate and this group exists to reach it cheaply.
 *
 * ⚠ Three duplication routes are exposed rather than one, because the doc pass
 * says they are three different methods and E4c is the reason not to trust that
 * they behave alike. `DeviceLayer` also extends `Channel`, and BOTH
 * `duplicateObject()` and `duplicate()` were silent no-ops on it (E4c routes 1
 * and 2) — a compile-time yes is not a runtime yes for anything reached through
 * a supertype. So the probe tries each and reports which ones actually made a
 * track:
 *
 *   channelDuplicate   Channel.duplicate()               v1,  "Duplicates the track."
 *   duplicateObject    DuplicableObject.duplicateObject() v19, Track ⊂ Channel ⊂ DuplicableObject
 *   hostDuplicate      ControllerHost.duplicateObjects(undoName, …) v19, the E14-G call
 *   copyTracksAfter    Track.afterTrackInsertionPoint().copyTracks(…)  — see below
 *   copyTracksBefore   Track.beforeTrackInsertionPoint().copyTracks(…)
 *
 * The rest of the group is readback for rows B5/E/G: mixer state a duplicate
 * either carries or does not, and the VU oracle that answers "is this making
 * sound" without asking a human to hear a 100ms window.
 */
public final class BranchHandlers extends HandlerGroup {
    public BranchHandlers(ControllerHost host, Rig rig, ExecState state) {
        super(host, rig, state);
    }

    @Override
    public void register(HandlerRegistry r) {
        r.on("branch.groupTrack", params -> groupTrack(params));
        r.on("branch.duplicateTrack", params -> duplicateTrack(params));
        r.on("branch.moveTrack", params -> moveTrack(params));
        r.on("branch.mixer", params -> mixer(params));
        r.on("branch.setMixer", params -> setMixer(params));
        r.on("branch.vu", params -> vu(params));
        r.on("branch.contentFilter", params -> contentFilter(params));
        r.on("branch.createParentTrack", params -> createParentTrack(params));
    }

    /**
     * E22 regression probe only. This method is registered so the destructive
     * finding remains reproducible, but it is banned from the product wire map.
     * Its durable-id and selection checks cannot observe Bitwig's primary focus:
     * Group can pass every check here and still edit the target's device chain.
     */
    private JsonElement groupTrack(JsonObject params) {
        JsonObject result = new JsonObject();
        if (params.has("ifRevision")) {
            long expectedRevision = params.get("ifRevision").getAsLong();
            if (expectedRevision != state.revision) {
                result.addProperty("applied", false);
                result.addProperty("rejected", true);
                result.addProperty("reason", "stale-revision");
                result.addProperty("expected", expectedRevision);
                result.addProperty("actual", state.revision);
                return result;
            }
        }

        int trackIndex = params.get("trackIndex").getAsInt();
        Track track = requireTrack(trackIndex);
        String expected = params.get("expectedChannelId").getAsString();
        String actual = track.channelId().get();
        if (!expected.equals(actual)) {
            throw new IllegalArgumentException(
                "track identity changed before grouping: expected " + expected + ", found " + actual);
        }

        com.bitwig.extension.controller.api.Action action = rig.application.getAction("Group");
        if (action == null) {
            throw new IllegalStateException("Bitwig action Group is unavailable");
        }

        // Capture structural identity before the final selection precondition.
        // E17's method guard is literal: once cursor + mixer selection are read,
        // invoke Group immediately, with no helper or even a read in between.
        Set<String> beforeIds = new HashSet<>();
        for (int i = 0; i < rig.config.tracks; i++) {
            Track candidate = rig.trackBank.getItemAt(i);
            if (candidate.exists().get()) beforeIds.add(candidate.channelId().get());
        }

        String cursor = params.has("cursor") ? params.get("cursor").getAsString() : "0";
        String selected = rig.cursorTrack(cursor).channelId().get();
        if (!expected.equals(selected)) {
            throw new IllegalArgumentException(
                "cursor selection did not settle before grouping: expected " + expected + ", found " + selected);
        }
        if (rig.selectedMixerTrackIndex != trackIndex) {
            throw new IllegalArgumentException(
                "mixer selection changed before grouping: expected bank row " + trackIndex
                    + ", found " + rig.selectedMixerTrackIndex);
        }

        // This method is intentionally invoked as a top-level RPC, not through
        // batch.run: the Group action is a UI command and a nested registry
        // dispatch acknowledges it without making Live execute it. Own the same
        // atomic guard -> claim -> apply protocol here instead.
        long revision = ++state.revision;
        action.invoke();
        host.scheduleTask(() -> expandCreatedGroup(beforeIds, 0), 25);

        result.addProperty("success", true);
        result.addProperty("applied", true);
        result.addProperty("revision", revision);
        result.addProperty("selectionVerified", true);
        result.addProperty("channelId", actual);
        result.addProperty("action", "Group");
        return result;
    }

    /** Poll the structural readback and expand one unambiguous newly-created group. */
    private void expandCreatedGroup(Set<String> beforeIds, int attempt) {
        Track created = null;
        for (int i = 0; i < rig.config.tracks; i++) {
            Track candidate = rig.trackBank.getItemAt(i);
            if (!candidate.exists().get() || !candidate.isGroup().get()
                    || beforeIds.contains(candidate.channelId().get())) {
                continue;
            }
            if (created != null) return; // Concurrent new groups: fail closed.
            created = candidate;
        }
        if (created != null) {
            created.isGroupExpanded().set(true);
            return;
        }
        if (attempt < 80) {
            host.scheduleTask(() -> expandCreatedGroup(beforeIds, attempt + 1), 25);
        }
    }

    /**
     * Move an existing track to a chosen place — `InsertionPoint.moveTracks(Track…)`.
     *
     * ⚠ Row A concluded "placement is not ours to choose" on the evidence of ONE
     * call: `copyTracks`, which compiles, acknowledges and does nothing. This is
     * its sibling on the same interface and it was never probed, so that
     * conclusion currently rests on an untested generalisation from a single
     * mechanism — which is the shape standing rule 10 exists to catch.
     *
     * It matters beyond tidiness. If a duplicate can be MOVED after it is made,
     * then "duplicate, then place" is a two-step route to the placement
     * `copyTracks` could not give us: branches could be gathered, ordered, or
     * moved next to a group's existing child — which is how a track gets INSIDE
     * a group when no API creates one (row E3).
     *
     * Expect nothing: the prior from `copyTracks` is that this is a no-op too.
     * The probe diffs positions by `channelId` rather than trusting the return.
     */
    private JsonElement moveTrack(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        Track anchor = requireTrack(params.get("anchorTrackIndex").getAsInt());
        String where = params.has("where") ? params.get("where").getAsString() : "after";
        if (!"after".equals(where) && !"before".equals(where)) {
            throw new IllegalArgumentException("where must be 'after' or 'before': " + where);
        }

        JsonObject result = ok();
        result.addProperty("where", where);
        result.addProperty("movedName", track.name().get());
        result.addProperty("movedChannelId", track.channelId().get());
        result.addProperty("anchorName", anchor.name().get());
        result.addProperty("anchorChannelId", anchor.channelId().get());
        result.addProperty("anchorIsGroup", anchor.isGroup().get());

        if ("after".equals(where)) {
            anchor.afterTrackInsertionPoint().moveTracks(new Track[] { track });
        } else {
            anchor.beforeTrackInsertionPoint().moveTracks(new Track[] { track });
        }
        return result;
    }

    /**
     * Duplicate one track by a named route.
     *
     * Standing rule 3c: every input is validated BEFORE the call. `requireTrack`
     * already refuses an out-of-bank or non-existent index, and an unknown route
     * throws before anything Bitwig-side is touched — a handler's try/catch is
     * not a safety net for what Bitwig defers to its own thread (E14-A1).
     */
    private JsonElement duplicateTrack(JsonObject params) {
        Track track = requireTrack(params.get("trackIndex").getAsInt());
        String route = params.has("route") ? params.get("route").getAsString() : "channelDuplicate";
        String undoName = params.has("undoName") ? params.get("undoName").getAsString() : "";

        JsonObject result = ok();
        result.addProperty("route", route);
        result.addProperty("sourceName", track.name().get());
        result.addProperty("sourceChannelId", track.channelId().get());

        switch (route) {
            case "channelDuplicate":
                // Product calls always carry this guard. Keep it immediately
                // adjacent to the mutating call: a bank row is positional, and
                // validating it earlier in the callback would leave room for a
                // future prelude to separate the check from the write.
                verifyExpectedChannelId(params, track);
                track.duplicate();
                break;
            case "duplicateObject":
                verifyExpectedChannelId(params, track);
                track.duplicateObject();
                break;
            case "hostDuplicate":
                verifyExpectedChannelId(params, track);
                if (undoName.isEmpty()) {
                    host.duplicateObjects(new DuplicableObject[] { track });
                } else {
                    host.duplicateObjects(undoName, new DuplicableObject[] { track });
                    result.addProperty("undoName", undoName);
                }
                break;
            // A FOURTH route the E16 plan did not know about, found by walking
            // InsertionPoint rather than the duplicate-shaped names:
            // `InsertionPoint.copyTracks(Track…)`. It is the only route that says
            // WHERE the copy goes — every other one lands where Bitwig decides —
            // which is what a branch topology (row E3's groups, row F2's clutter)
            // would actually need. `anchorTrackIndex` is the track the copy lands
            // beside; it defaults to the source, reproducing "adjacent".
            case "copyTracksAfter":
            case "copyTracksBefore": {
                int anchorIndex = params.has("anchorTrackIndex")
                    ? params.get("anchorTrackIndex").getAsInt()
                    : params.get("trackIndex").getAsInt();
                Track anchor = requireTrack(anchorIndex);
                result.addProperty("anchorName", anchor.name().get());
                if ("copyTracksAfter".equals(route)) {
                    anchor.afterTrackInsertionPoint().copyTracks(new Track[] { track });
                } else {
                    anchor.beforeTrackInsertionPoint().copyTracks(new Track[] { track });
                }
                break;
            }
            default:
                throw new IllegalArgumentException("unknown duplication route: " + route);
        }
        return result;
    }

    /** Optional only for archived probes; production always supplies it. */
    private void verifyExpectedChannelId(JsonObject params, Track track) {
        if (!params.has("expectedChannelId")) return;
        String expected = params.get("expectedChannelId").getAsString();
        String actual = track.channelId().get();
        if (!expected.equals(actual)) {
            throw new IllegalArgumentException(
                "track identity changed before duplication: expected " + expected + ", found " + actual);
        }
    }

    /**
     * ⚠ E16 row E3 — does `createParentTrack` CREATE a group, or merely return a
     * proxy to one that already exists?
     *
     * The javadoc says "Creates an object that represent[s] the parent track",
     * which reads exactly like `createCursorTrack` — an accessor. On that basis
     * row E3 recorded group creation as unavailable, from a DOC PASS, which is
     * the thing standing rule 10 exists to forbid.
     *
     * A third-party extension (gregrossdev/bitwig-extensions, `gig-maestro`)
     * implements its `track/createGroup` RPC as exactly this call on a
     * CursorTrack, and its design notes assert "the only way to create a group is
     * Track.createParentTrack(numSends, numScenes), which creates a parent group
     * above the current track". ⚠ Their only test is
     * `verify(mockCursorTrack).createParentTrack(4, 5)` — a MOCK assertion that
     * the call was made, with no live verification anywhere in the repo. So it is
     * a hypothesis of the E4c kind ("a supertype method is a claim, not a
     * capability"), and this handler exists to settle it by readback.
     *
     * Two routes, because they may not behave alike: their CursorTrack and our
     * bank Track. The probe diffs `track.list` before and after; nothing here
     * trusts the returned proxy.
     *
     * ⚠ TWO hazards, hence the per-field guards below:
     *   - `create*` is the shape standing rule 13 says is init-only ("This can
     *     only be called during driver initialization"). A runtime call may
     *     throw, and this reports that rather than dying.
     *   - reading `name()`/`channelId()` on a proxy nobody marked interested
     *     throws too (E2's observer gotcha), so every read is separately
     *     guarded and reports its own error string.
     */
    private JsonElement createParentTrack(JsonObject params) {
        String route = params.has("route") ? params.get("route").getAsString() : "cursorTrack";
        int sends = params.has("sends") ? params.get("sends").getAsInt() : rig.config.sends;
        int scenes = params.has("scenes") ? params.get("scenes").getAsInt() : rig.config.scenes;
        if (sends < 0 || scenes < 0) {
            throw new IllegalArgumentException("sends and scenes must be >= 0");
        }

        JsonObject r = ok();
        r.addProperty("route", route);
        r.addProperty("sends", sends);
        r.addProperty("scenes", scenes);

        Track subject;
        switch (route) {
            case "cursorTrack": {
                String ref = params.has("cursor") ? params.get("cursor").getAsString() : "0";
                subject = rig.cursorTrack(ref);
                r.addProperty("cursor", ref);
                break;
            }
            case "bankTrack":
                subject = requireTrack(params.get("trackIndex").getAsInt());
                break;
            default:
                throw new IllegalArgumentException("route must be cursorTrack or bankTrack: " + route);
        }

        try {
            r.addProperty("subjectName", subject.name().get());
        } catch (Throwable t) {
            r.addProperty("subjectName", "READ_FAILED: " + t.getMessage());
        }

        try {
            Track parent = subject.createParentTrack(sends, scenes);
            r.addProperty("returnedProxy", parent != null);
            // Each read separately guarded: an unmarked value throws (E2), and a
            // throw here would hide whether the CALL itself succeeded.
            try {
                r.addProperty("parentExists", parent.exists().get());
            } catch (Throwable t) {
                r.addProperty("parentExists", "READ_FAILED: " + t.getMessage());
            }
            try {
                r.addProperty("parentName", parent.name().get());
            } catch (Throwable t) {
                r.addProperty("parentName", "READ_FAILED: " + t.getMessage());
            }
            try {
                r.addProperty("parentIsGroup", parent.isGroup().get());
            } catch (Throwable t) {
                r.addProperty("parentIsGroup", "READ_FAILED: " + t.getMessage());
            }
        } catch (Throwable t) {
            r.addProperty("returnedProxy", false);
            r.addProperty("callError", t.getClass().getSimpleName() + ": " + t.getMessage());
        }
        return r;
    }

    /**
     * E16 — change what the flat track bank is allowed to SEE, at runtime.
     *
     * ⚠ The hazard this exists to answer: a COLLAPSED group's children leave the
     * bank entirely under the default filter. `itemCount` drops and
     * `track.resolveByChannelId` returns `found:false` — byte-identical to the
     * answer a DELETED track gives (E2f/D1) — while the child is still audible.
     * `ALL_CHANNELS` claims to include tracks "not visible in the mixer".
     *
     * Two things are unknown and this method is how they get measured: whether
     * `setContentFilter` works at all AFTER init (standing rule 13 says most
     * Bitwig resources are init-only, so it may silently do nothing), and
     * whether ALL_CHANNELS really restores folded children. Both are answered by
     * calling this and re-reading `track.list` — never by the return value,
     * which is only an acknowledgement (E4c).
     *
     * Validated against the enum before the call: it is a Beta API and a bad
     * name must not throw onto the control-surface thread (rule 3c).
     */
    private JsonElement contentFilter(JsonObject params) {
        String name = params.get("filter").getAsString();
        if (!"TOP_LEVEL_CHANNELS".equals(name) && !"ALL_VISIBLE_CHANNELS".equals(name)
            && !"ALL_CHANNELS".equals(name)) {
            throw new IllegalArgumentException(
                "filter must be TOP_LEVEL_CHANNELS, ALL_VISIBLE_CHANNELS or ALL_CHANNELS: " + name);
        }
        JsonObject r = ok();
        r.addProperty("requested", name);
        r.addProperty("appliedAtInit", rig.contentFilterApplied);
        try {
            rig.trackBank.setContentFilter(TrackBankContentFilter.valueOf(name));
            r.addProperty("called", true);
        } catch (Throwable t) {
            // Beta API: report rather than take the extension down.
            r.addProperty("called", false);
            r.addProperty("error", t.getClass().getSimpleName() + ": " + t.getMessage());
        }
        return r;
    }

    /** Everything about a track's mixer strip that a duplicate could drop (row B5). */
    private JsonElement mixer(JsonObject params) {
        int index = params.get("trackIndex").getAsInt();
        Track track = requireTrack(index);
        JsonObject r = new JsonObject();
        r.addProperty("index", index);
        r.addProperty("name", track.name().get());
        r.addProperty("channelId", track.channelId().get());
        r.addProperty("position", track.position().get());
        r.addProperty("type", track.trackType().get());
        r.addProperty("isGroup", track.isGroup().get());
        r.addProperty("isGroupExpanded", track.isGroupExpanded().get());
        r.addProperty("volume", track.volume().value().get());
        r.addProperty("volumeDisplayed", track.volume().value().displayedValue().get());
        r.addProperty("pan", track.pan().value().get());
        r.addProperty("mute", track.mute().get());
        r.addProperty("solo", track.solo().get());
        r.addProperty("mutedBySolo", track.isMutedBySolo().get());
        r.addProperty("activated", track.isActivated().get());
        r.addProperty("color", colorOf(track));

        JsonArray sends = new JsonArray();
        // Null when the rig was built with sends=0 — reading them is then simply
        // not on offer, and saying so beats a NullPointerException on the
        // control-surface thread (E16 / standing rule 3c).
        for (int s = 0; rig.sendBanks[index] != null && s < rig.config.sends; s++) {
            Send send = rig.sendBanks[index].getItemAt(s);
            if (!send.exists().get()) {
                continue;
            }
            JsonObject obj = new JsonObject();
            obj.addProperty("index", s);
            obj.addProperty("name", send.name().get());
            obj.addProperty("value", send.value().get());
            obj.addProperty("enabled", send.isEnabled().get());
            // Both, because they are not the same fact: `sendMode` is what is
            // CONFIGURED (and AUTO configures nothing explicitly), `isPreFader`
            // is what Bitwig RESOLVED it to. Row E2's verdict depends on the
            // resolved one, so reading only the setting would be rule-1 blind.
            obj.addProperty("preFader", send.isPreFader().get());
            obj.addProperty("sendMode", send.sendMode().get());
            sends.add(obj);
        }
        r.add("sends", sends);
        r.addProperty("sendCount",
            rig.sendBanks[index] == null ? -1 : rig.sendBanks[index].itemCount().get());
        return r;
    }

    /**
     * Write mixer state — used to BUILD a fixture worth duplicating, and to A/B by mute.
     *
     * ⚠ `setImmediately`, never `set` (standing rule 3 / E4). Measured again here
     * and the scope is wider than E4 recorded: a plain `value().set()` on
     * **track volume, pan and sends** is swallowed exactly as it is on a device
     * parameter — the write acknowledges, the readback never moves. Volume, pan
     * and Send are all `Parameter`, so the take-over strategy owns them too;
     * `color()` and `mute()` are not, and they land with a plain `set`.
     */
    private JsonElement setMixer(JsonObject params) {
        int index = params.get("trackIndex").getAsInt();
        Track track = requireTrack(index);
        JsonObject r = ok();
        if (params.has("volume")) {
            track.volume().value().setImmediately(params.get("volume").getAsDouble());
            r.addProperty("volume", params.get("volume").getAsDouble());
        }
        if (params.has("pan")) {
            track.pan().value().setImmediately(params.get("pan").getAsDouble());
        }
        if (params.has("mute")) {
            track.mute().set(params.get("mute").getAsBoolean());
            r.addProperty("mute", params.get("mute").getAsBoolean());
        }
        if (params.has("solo")) {
            track.solo().set(params.get("solo").getAsBoolean());
        }
        if (params.has("activated")) {
            track.isActivated().set(params.get("activated").getAsBoolean());
        }
        if (params.has("groupExpanded")) {
            track.isGroupExpanded().set(params.get("groupExpanded").getAsBoolean());
            r.addProperty("groupExpanded", params.get("groupExpanded").getAsBoolean());
        }
        if (params.has("color")) {
            JsonArray rgb = params.getAsJsonArray("color");
            if (rgb.size() < 3) {
                throw new IllegalArgumentException("color must be [r,g,b] in 0..1");
            }
            track.color().set(rgb.get(0).getAsFloat(), rgb.get(1).getAsFloat(), rgb.get(2).getAsFloat());
        }
        if (params.has("sendIndex")) {
            int sendIndex = params.get("sendIndex").getAsInt();
            if (rig.sendBanks[index] == null) {
                throw new IllegalArgumentException("rig was built with sends=0; no send bank exists");
            }
            if (sendIndex < 0 || sendIndex >= rig.config.sends) {
                throw new IllegalArgumentException("sendIndex out of bank range: " + sendIndex);
            }
            Send send = rig.sendBanks[index].getItemAt(sendIndex);
            if (params.has("sendValue")) {
                send.value().setImmediately(params.get("sendValue").getAsDouble());
            }
            if (params.has("sendEnabled")) {
                send.isEnabled().set(params.get("sendEnabled").getAsBoolean());
            }
            // Row E2. Validated against the documented enum BEFORE the call:
            // SettableEnumValue takes a String, so a typo would otherwise be a
            // silent no-op of exactly the kind E4c is about, and the row would
            // then measure POST twice and call it a clean result (rule 3c).
            if (params.has("sendMode")) {
                String mode = params.get("sendMode").getAsString();
                if (!"AUTO".equals(mode) && !"PRE".equals(mode) && !"POST".equals(mode)) {
                    throw new IllegalArgumentException("sendMode must be AUTO, PRE or POST: " + mode);
                }
                send.sendMode().set(mode);
                r.addProperty("sendMode", mode);
            }
            r.addProperty("sendIndex", sendIndex);
        }
        return r;
    }

    /**
     * The audibility oracle (rows E1/E2/E5).
     *
     * `now` is the last VU level Bitwig reported; `hold` is a peak that only
     * rises until reset. Arm with `{reset:true}`, do the thing, read `hold` —
     * that answers "did ANY signal appear on this track in that window", which
     * is what "is there a moment when both branches are audible" reduces to.
     */
    private JsonElement vu(JsonObject params) {
        boolean reset = params.has("reset") && params.get("reset").getAsBoolean();
        JsonArray tracks = new JsonArray();
        for (int i = 0; i < rig.config.tracks; i++) {
            Track track = rig.trackBank.getItemAt(i);
            if (!track.exists().get()) {
                continue;
            }
            JsonObject obj = new JsonObject();
            obj.addProperty("index", i);
            obj.addProperty("name", track.name().get());
            obj.addProperty("channelId", track.channelId().get());
            // ⚠ The hold array is BANK-INDEXED, so a structural change re-points
            // slot i at a different track and the accumulated peak silently
            // becomes the PREVIOUS occupant's. Measured the hard way: FX 1 had
            // accumulated 38, a duplicate landed on FX 1's slot, and the copy's
            // "peak" came back as exactly 38 — a check passed on another track's
            // number. So the slot self-invalidates the moment its identity
            // changes, and says so, rather than handing back a plausible lie.
            String channelId = track.channelId().get();
            boolean identityChanged = rig.vuIdentity[i] != null
                && !rig.vuIdentity[i].equals(channelId);
            if (identityChanged) {
                rig.vuHold[i] = 0;
                rig.vuNow[i] = 0;
            }
            rig.vuIdentity[i] = channelId;
            obj.addProperty("now", rig.vuNow[i]);
            obj.addProperty("hold", rig.vuHold[i]);
            obj.addProperty("identityChanged", identityChanged);
            obj.addProperty("mute", track.mute().get());
            obj.addProperty("mutedBySolo", track.isMutedBySolo().get());
            tracks.add(obj);
            if (reset) {
                rig.vuHold[i] = 0;
            }
        }
        JsonObject r = new JsonObject();
        r.add("tracks", tracks);
        r.addProperty("range", Rig.VU_RANGE);
        r.addProperty("reset", reset);
        r.addProperty("isPlaying", rig.transport.isPlaying().get());
        return r;
    }

    private static String colorOf(Track track) {
        return String.format("%.3f,%.3f,%.3f",
            track.color().red(), track.color().green(), track.color().blue());
    }
}
