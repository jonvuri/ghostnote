package com.ghostnote.extension;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * One exact extension runtime surface.
 *
 * The normal profile contains the product wire. Capture adds the optional
 * recorder wire. Probe adds only the current Phase 8 and D13 regressions.
 * Historical methods stay in source for evidence, but no active profile
 * registers them.
 */
public enum RuntimeProfile {
    NORMAL("normal-v1"),
    CAPTURE("capture-v1"),
    PROBE("phase-8-probe-v1");

    private final String identity;

    RuntimeProfile(String identity) {
        this.identity = identity;
    }

    public String identity() {
        return identity;
    }

    /** Read the exact profile identity that the archive embeds at build time. */
    public static RuntimeProfile bundled() {
        try (InputStream input = RuntimeProfile.class.getResourceAsStream(
                "/ghostnote-runtime-profile.txt")) {
            if (input == null) {
                throw new IllegalStateException("runtime profile resource is missing");
            }
            String bundledIdentity = new String(
                input.readAllBytes(), StandardCharsets.UTF_8).trim();
            for (RuntimeProfile profile : values()) {
                if (profile.identity.equals(bundledIdentity)) {
                    return profile;
                }
            }
            throw new IllegalStateException(
                "unknown bundled runtime profile: " + bundledIdentity);
        } catch (IOException error) {
            throw new IllegalStateException("cannot read runtime profile resource", error);
        }
    }

    public boolean hasProbeResources() {
        return this == PROBE;
    }

    public boolean hasCaptureResources() {
        return this == CAPTURE;
    }

    public boolean includes(String method) {
        return methodNames().contains(method);
    }

    public Set<String> methodNames() {
        return switch (this) {
            case NORMAL -> MethodSets.NORMAL;
            case CAPTURE -> MethodSets.CAPTURE;
            case PROBE -> MethodSets.PROBE;
        };
    }

    /** Fail extension initialization when a source registration has no owner. */
    public void verifyRegistrations(Collection<String> offered) {
        Set<String> actual = Set.copyOf(offered);
        Set<String> missing = new LinkedHashSet<>(MethodSets.ALL_CLASSIFIED);
        missing.removeAll(actual);
        Set<String> unknown = new LinkedHashSet<>(actual);
        unknown.removeAll(MethodSets.ALL_CLASSIFIED);
        if (!missing.isEmpty() || !unknown.isEmpty()) {
            throw new IllegalStateException(
                "wire classification drift: missing=" + missing + ", unknown=" + unknown);
        }
    }

    private static Set<String> methods(String... names) {
        return Set.of(names);
    }

    /** Named blocks are parsed by the wire-golden checker. Keep one name per line. */
    private static final class MethodSets {
        private static final Set<String> PRODUCT = methods(
            "batch.run",
            "branch.duplicateTrack",
            "chain.activate",
            "chain.duplicate",
            "chain.inventory",
            "chain.move",
            "chain.select",
            "chain.setName",
            "clip.create",
            "contract.hello",
            "cursor.clearNote",
            "cursor.clearNotes",
            "cursor.clipMetadata",
            "cursor.getNotes",
            "cursor.getNotesVerbose",
            "cursor.getNotesVerboseAllChannels",
            "cursor.launchSettings",
            "cursor.pin",
            "cursor.pinTrack",
            "cursor.playState",
            "cursor.pointTrack",
            "cursor.scrollToStep",
            "cursor.setClipMetadata",
            "cursor.setLaunchSettings",
            "cursor.setNoteProps",
            "cursor.setNotes",
            "cursor.setStepSize",
            "cursor.status",
            "devcursor.pin",
            "devcursor.selectAt",
            "devcursor.selectFirstInPad",
            "devcursor.selectFirstInSlot",
            "devcursor.selectInLayer",
            "devcursor.selectInSlot",
            "devcursor.selectParent",
            "devcursor.status",
            "device.delete",
            "device.insertBitwig",
            "device.insertClap",
            "device.insertFile",
            "device.insertVst3",
            "device.list",
            "device.moveTo",
            "device.setEnabled",
            "directparam.completion",
            "directparam.list",
            "directparam.set",
            "drumpad.insertDevice",
            "drumpad.list",
            "host.info",
            "layer.list",
            "masterRecorder.start",
            "masterRecorder.status",
            "masterRecorder.stop",
            "navigation.showChangedClip",
            "note.observer.arm",
            "note.observer.prepare",
            "note.observer.read",
            "notify",
            "observation.read",
            "observation.replace",
            "param.list",
            "param.set",
            "ping",
            "remote.list",
            "remote.set",
            "revision.get",
            "rig.info",
            "rig.methods",
            "rig.scanTracks",
            "rig.stats",
            "scene.count",
            "scene.create",
            "scene.delete",
            "selection.status",
            "slot.delete",
            "slot.duplicateClip",
            "slot.launchWithOptions",
            "slot.moveTo",
            "slot.playState",
            "slot.select",
            "slot.status",
            "status.push",
            "track.create",
            "track.delete",
            "track.list",
            "track.resolveByChannelId",
            "track.setName",
            "transport.status",
            "transport.stop"
        );

        private static final Set<String> OPTIONAL_CAPTURE = methods(
            "masterRecorder.start",
            "masterRecorder.status",
            "masterRecorder.stop",
            "transport.status",
            "transport.stop"
        );

        private static final Set<String> ACTIVE_PROBE = methods(
            "api.runtimeMethods",
            "app.actions",
            "app.invokeAction",
            "app.redo",
            "app.undo",
            "app.undoState",
            "branch.groupTrack",
            "cache.scale",
            "stepdata.observer.enrich",
            "stepdata.observer.prepare",
            "stepdata.observer.read"
        );

        private static final Set<String> HISTORICAL = methods(
            "app.selectionNotifications",
            "branch.contentFilter",
            "branch.createParentTrack",
            "branch.mixer",
            "branch.moveTrack",
            "branch.setMixer",
            "branch.vu",
            "chainselector.set",
            "chainselector.status",
            "cursor.duplicateContent",
            "cursor.moveNote",
            "cursor.pointToClipOf",
            "cursor.setAndReadNote",
            "devcursor.selectFirstInKeyPad",
            "devcursor.selectFirstInLayer",
            "devcursor.selectInChannel",
            "device.duplicate",
            "device.insertFileAt",
            "device.moveIntoSlot",
            "device.nesting",
            "device.selectInEditor",
            "drumpad.duplicate",
            "echo",
            "equals.status",
            "equals.tryCreate",
            "layer.copyDeviceInto",
            "layer.delete",
            "layer.deleteViaAction",
            "layer.deleteViaHost",
            "layer.duplicate",
            "layer.duplicateChannel",
            "layer.duplicateViaAction",
            "layer.duplicateViaHost",
            "layer.insertAtStart",
            "layer.insertDevice",
            "layer.insertFile",
            "layer.insertRelative",
            "layer.insertViaCursor",
            "layer.moveDeviceInto",
            "layer.pasteInto",
            "layer.pointCursor",
            "layer.select",
            "layer.selectLegacy",
            "layer.selectionState",
            "layer.setMixer",
            "layer.setName",
            "layer.soloToggle",
            "param.modulated",
            "param.touch",
            "remote.selectPage",
            "remote.setMapping",
            "revision.bump",
            "slot.duplicateObject",
            "slot.epoch",
            "slot.launch",
            "track.deleteViaAction",
            "transport.play"
        );

        private static final Set<String> NORMAL;
        private static final Set<String> CAPTURE;
        private static final Set<String> PROBE;
        private static final Set<String> ALL_CLASSIFIED;

        static {
            LinkedHashSet<String> normal = new LinkedHashSet<>(PRODUCT);
            normal.removeAll(OPTIONAL_CAPTURE);
            NORMAL = Set.copyOf(normal);
            CAPTURE = PRODUCT;

            LinkedHashSet<String> probe = new LinkedHashSet<>(NORMAL);
            probe.addAll(ACTIVE_PROBE);
            PROBE = Set.copyOf(probe);

            LinkedHashSet<String> classified = new LinkedHashSet<>(PRODUCT);
            classified.addAll(ACTIVE_PROBE);
            classified.addAll(HISTORICAL);
            ALL_CLASSIFIED = Set.copyOf(classified);

            if (!PRODUCT.containsAll(OPTIONAL_CAPTURE)
                    || PRODUCT.size() != 90
                    || NORMAL.size() != 85
                    || PROBE.size() != 96
                    || HISTORICAL.size() != 57
                    || ALL_CLASSIFIED.size() != 158) {
                throw new IllegalStateException("invalid runtime wire classification");
            }
        }
    }
}
