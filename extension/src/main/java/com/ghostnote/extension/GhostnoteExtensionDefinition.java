package com.ghostnote.extension;

import java.util.UUID;

import com.bitwig.extension.api.PlatformType;
import com.bitwig.extension.controller.AutoDetectionMidiPortNamesList;
import com.bitwig.extension.controller.ControllerExtensionDefinition;
import com.bitwig.extension.controller.api.ControllerHost;

public class GhostnoteExtensionDefinition extends ControllerExtensionDefinition {
    private static final UUID DRIVER_ID = UUID.fromString("2a46e58f-5797-4712-8f2e-b67b2d8f5fc8");

    @Override
    public String getName() {
        return "ghostnote";
    }

    @Override
    public String getAuthor() {
        return "jonvuri";
    }

    @Override
    public String getVersion() {
        return "0.0.1";
    }

    @Override
    public UUID getId() {
        return DRIVER_ID;
    }

    @Override
    public String getHardwareVendor() {
        return "ghostnote";
    }

    @Override
    public String getHardwareModel() {
        return "ghostnote bridge";
    }

    @Override
    public int getRequiredAPIVersion() {
        // Matches the extension-api artifact we compile against.
        // Bitwig 6.0.6 reports hostApiVersion 25 (E0 probe).
        return 25;
    }

    @Override
    public int getNumMidiInPorts() {
        // Virtual controller - all communication over TCP
        return 0;
    }

    @Override
    public int getNumMidiOutPorts() {
        return 0;
    }

    @Override
    public void listAutoDetectionMidiPortNames(
            final AutoDetectionMidiPortNamesList list,
            final PlatformType platformType) {
        // No MIDI ports, nothing to auto-detect
    }

    @Override
    public GhostnoteExtension createInstance(final ControllerHost host) {
        return new GhostnoteExtension(this, host);
    }
}
